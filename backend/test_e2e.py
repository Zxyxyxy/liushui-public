"""
端到端测试 - Query → 检索 → 执行 Skill

测试完整流程：
1. 用户输入 query
2. 检索系统找到最匹配的 skill
3. Skill 执行器调用 LLM 执行
4. 返回结果

使用方法：
    # 测试单个 query
    python test_e2e.py --query "帮我改简历，目标是产品经理"

    # 批量测试（使用 test dataset 前 10 条）
    python test_e2e.py --batch 10

    # 测试特定 skill
    python test_e2e.py --skill resume-fix
"""

import argparse
import json
import time
from typing import Dict, Any

from skill_retrieval import EmbeddingClient, SkillRetrieval
from skill_executor import SkillExecutor, SkillResult


class E2ETest:
    """端到端测试"""

    def __init__(self, llm_provider: str = "bailian"):
        """
        初始化测试环境

        Args:
            llm_provider: LLM 提供商
        """
        print("初始化端到端测试环境...")

        # 1. 加载检索系统
        print("  [1/2] 加载检索索引...")
        embedding_client = EmbeddingClient(provider="openai", model="text-embedding-3-small")
        self.retrieval = SkillRetrieval.load_index("skill_index.json", embedding_client)

        # 2. 初始化 skill 执行器
        print(f"  [2/2] 初始化 Skill 执行器（{llm_provider}）...")
        self.executor = SkillExecutor(llm_provider=llm_provider)

        print("✓ 环境准备完成\n")

    def test_single_query(self, query: str, user_input: Dict[str, Any] = None, execute: bool = True):
        """
        测试单个 query

        Args:
            query: 用户查询
            user_input: 用户输入参数（执行 skill 时需要）
            execute: 是否执行 skill（False 时只检索）

        Returns:
            测试结果
        """
        print("=" * 70)
        print(f"测试 Query: {query}")
        print("=" * 70)

        # Step 1: 检索
        print("\n[Step 1] 检索匹配的 Skills...")
        start_time = time.time()
        results = self.retrieval.search(query, top_k=3)
        retrieval_time = time.time() - start_time

        print(f"✓ 检索完成（耗时 {retrieval_time:.2f}s）\n")
        print("Top-3 检索结果:")
        for result in results:
            skill = self.retrieval.skills[result.skill_id]
            print(f"  {result.rank}. {result.skill_name} (score: {result.score:.4f})")
            print(f"     ID: {result.skill_id}")
            print(f"     功能: {skill.promise}")

        # Step 2: 执行 skill（如果启用）
        if not execute:
            print("\n[跳过执行] 仅检索模式")
            return {
                "query": query,
                "top_skill": results[0].skill_id,
                "retrieval_time": retrieval_time,
            }

        print("\n" + "=" * 70)
        print(f"[Step 2] 执行 Skill: {results[0].skill_name}")
        print("=" * 70)

        best_skill_id = results[0].skill_id

        # 检查是否提供了必需参数
        if user_input is None:
            print("\n⚠️  需要提供用户输入参数才能执行 skill")
            print(f"   该 skill 需要的参数: {self._get_required_fields(best_skill_id)}")
            return {
                "query": query,
                "top_skill": best_skill_id,
                "retrieval_time": retrieval_time,
                "executed": False,
                "reason": "缺少必需参数"
            }

        # 执行 skill
        start_time = time.time()
        result = self.executor.execute(best_skill_id, user_input)
        execution_time = time.time() - start_time

        if result.success:
            print(f"\n✓ 执行成功（耗时 {execution_time:.2f}s）")
            print(f"✓ 消耗积分: {result.credits_used}")
            print("\n" + "-" * 70)
            print("输出结果:")
            print("-" * 70)
            print(result.output)
            print("-" * 70)

            return {
                "query": query,
                "top_skill": best_skill_id,
                "retrieval_time": retrieval_time,
                "execution_time": execution_time,
                "credits_used": result.credits_used,
                "executed": True,
                "output_length": len(result.output)
            }
        else:
            print(f"\n✗ 执行失败: {result.error}")
            return {
                "query": query,
                "top_skill": best_skill_id,
                "retrieval_time": retrieval_time,
                "executed": False,
                "error": result.error
            }

    def test_specific_skill(self, skill_id: str, user_input: Dict[str, Any]):
        """
        测试特定 skill（跳过检索）

        Args:
            skill_id: skill ID
            user_input: 用户输入参数
        """
        print("=" * 70)
        print(f"直接测试 Skill: {skill_id}")
        print("=" * 70)

        skill = self.retrieval.skills.get(skill_id)
        if not skill:
            print(f"✗ Skill 不存在: {skill_id}")
            return

        print(f"\nSkill 信息:")
        print(f"  名称: {skill.name}")
        print(f"  功能: {skill.promise}")

        print("\n执行中...")
        start_time = time.time()
        result = self.executor.execute(skill_id, user_input)
        execution_time = time.time() - start_time

        if result.success:
            print(f"\n✓ 执行成功（耗时 {execution_time:.2f}s）")
            print(f"✓ 消耗积分: {result.credits_used}")
            print("\n" + "-" * 70)
            print("输出结果:")
            print("-" * 70)
            print(result.output)
            print("-" * 70)
        else:
            print(f"\n✗ 执行失败: {result.error}")

    def test_batch(self, n: int = 10):
        """
        批量测试（使用 test dataset）

        Args:
            n: 测试前 N 条
        """
        print("=" * 70)
        print(f"批量测试（前 {n} 条 Easy 级别）")
        print("=" * 70)

        # 加载测试数据
        from test_retrieval import load_test_dataset
        test_cases = load_test_dataset("easy")[:n]

        results = []
        for i, case in enumerate(test_cases, 1):
            print(f"\n[{i}/{n}] Query: {case['query']}")

            # 检索
            search_results = self.retrieval.search(case['query'], top_k=3)
            top_skill = search_results[0].skill_id
            ground_truth = case['ground_truth']

            # 判断是否命中
            hit = top_skill in ground_truth
            print(f"  预测: {top_skill}")
            print(f"  真值: {', '.join(ground_truth)}")
            print(f"  结果: {'✓ 命中' if hit else '✗ 未命中'}")

            results.append({
                "query": case['query'],
                "predicted": top_skill,
                "ground_truth": ground_truth,
                "hit": hit,
            })

        # 统计
        hits = sum(1 for r in results if r['hit'])
        accuracy = hits / len(results)

        print("\n" + "=" * 70)
        print("批量测试结果")
        print("=" * 70)
        print(f"测试数量: {len(results)}")
        print(f"命中数: {hits}")
        print(f"准确率: {accuracy:.2%}")

        return results

    def _get_required_fields(self, skill_id: str) -> list:
        """获取 skill 需要的参数"""
        skill_fields = {
            "resume-fix": ["resume_content", "target_role"],
            "excel-formula": ["formula"],
            "en-polish": ["text", "register"],
            "ps-diagnose": ["essay", "program"],
            "pdf-digest": ["document_text", "depth"],
            "note-tidy": ["notes"],
            "ppt-outline": ["topic", "minutes", "audience", "material"],
            "jd-match": ["resume", "jd"],
        }
        return skill_fields.get(skill_id, [])


def main():
    parser = argparse.ArgumentParser(description="端到端测试")
    parser.add_argument("--query", type=str, help="测试单个查询")
    parser.add_argument("--skill", type=str, help="直接测试特定 skill")
    parser.add_argument("--batch", type=int, help="批量测试 N 条")
    parser.add_argument("--llm", type=str, default="bailian", choices=["bailian", "deepseek", "openai"], help="LLM 提供商")
    parser.add_argument("--no-execute", action="store_true", help="仅检索，不执行 skill")

    args = parser.parse_args()

    # 初始化测试环境
    tester = E2ETest(llm_provider=args.llm)

    if args.query:
        # 测试单个 query
        # 这里需要用户提供具体参数，示例只做检索
        tester.test_single_query(args.query, execute=not args.no_execute)

    elif args.skill:
        # 测试特定 skill（需要提供测试数据）
        print("请在代码中提供测试数据")
        print(f"示例：")
        print(f'  tester.test_specific_skill("{args.skill}", {{...}})')

    elif args.batch:
        # 批量测试
        tester.test_batch(args.batch)

    else:
        # 默认：演示流程
        print("演示端到端流程\n")

        # 示例 1: Excel 公式解释（完整流程）
        print("=" * 70)
        print("示例 1: Excel 公式解释")
        print("=" * 70)
        tester.test_specific_skill(
            "excel-formula",
            {"formula": "=INDEX(B:B,MATCH(1,(C:C=F2)*(D:D=G2),0))"}
        )

        print("\n" + "=" * 70)
        print("示例 2: 批量检索测试（前 5 条）")
        print("=" * 70)
        tester.test_batch(5)


if __name__ == "__main__":
    main()
