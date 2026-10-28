"""
测试 Skill 检索系统

使用方法：
    # 1. 建立索引
    python test_retrieval.py --build-index

    # 2. 测试单个查询
    python test_retrieval.py --query "我要做PPT"

    # 3. 运行完整评估（50条测试数据）
    python test_retrieval.py --eval

    # 4. 评估特定难度
    python test_retrieval.py --eval --difficulty easy
"""

import sys
import json
import argparse
from pathlib import Path
from typing import List, Dict

from skill_retrieval import (
    EmbeddingClient,
    SkillRetrieval,
    load_skills_from_frontend_data,
)


def load_test_dataset(difficulty: str = "all") -> List[Dict]:
    """
    加载测试数据集

    Args:
        difficulty: 'all' | 'easy' | 'medium' | 'hard'

    Returns:
        测试用例列表
    """
    # 50 条测试数据（从 test-dataset.md 转换而来）
    #
    # 原始数据集有 60 条，是按 29 个上架 skill 写的。上架列表收敛到 18 个真实
    # 接入执行的 skill 后，按两条规则重做，**没有**改写任何 query 去迁就存活
    # 的 skill（编出来的 query 测不出真实检索能力）：
    #   1. 多标签用例：剔掉已下架的 id，保留剩下的标签。
    #   2. 剔完一个标签都不剩的用例：整条删除——用户这个意图现在平台确实不提供，
    #      留着只会把「检索不准」和「功能没有」混在一条指标里。
    # 删掉的 10 条及其原 ground_truth（等对应 skill 上架后照原样加回来）：
    #   easy_007 写汇报讲稿 report-script     easy_008 检查PPT ppt-review
    #   easy_015 模拟面试 mock-interview      easy_017 投递进度 job-tracker
    #   easy_019 简历能力标签 resume-extract  easy_025 项目对比 school-compare
    #   easy_029 复习进度 review-tracker      easy_030 长期规划 expert-planner
    #   medium_010 申请时间线 apply-timeline  medium_019 材料清单 doc-checklist
    # id 保留原编号（故意留空档），空档本身就是「这条被删了」的记录。
    dataset = {
        "easy": [
            # 学习提效场景（8条）
            {"id": "easy_001", "query": "我要做一个关于人工智能的课程汇报PPT", "ground_truth": ["ppt-outline"], "difficulty": "easy"},
            {"id": "easy_002", "query": "这个Excel公式看不懂什么意思", "ground_truth": ["excel-formula"], "difficulty": "easy"},
            {"id": "easy_003", "query": "帮我把这个PDF课件总结一下", "ground_truth": ["pdf-digest"], "difficulty": "easy"},
            {"id": "easy_004", "query": "需要生成一个Excel表格记录社团经费", "ground_truth": ["excel-build"], "difficulty": "easy"},
            {"id": "easy_005", "query": "课堂笔记太乱了想整理一下", "ground_truth": ["note-tidy"], "difficulty": "easy"},
            {"id": "easy_006", "query": "英文论文写完了想润色一下", "ground_truth": ["en-polish"], "difficulty": "easy"},
            {"id": "easy_009", "query": "这个Excel表格公式报错了找不到原因", "ground_truth": ["excel-formula"], "difficulty": "easy"},
            {"id": "easy_010", "query": "老师的课件有50页想快速看懂重点", "ground_truth": ["pdf-digest"], "difficulty": "easy"},

            # 求职实习场景（7条）
            {"id": "easy_011", "query": "帮我改简历", "ground_truth": ["resume-fix"], "difficulty": "easy"},
            {"id": "easy_012", "query": "看看我的简历和这个JD匹配度怎么样", "ground_truth": ["jd-match"], "difficulty": "easy"},
            {"id": "easy_013", "query": "明天面试需要准备自我介绍", "ground_truth": ["self-intro"], "difficulty": "easy"},
            {"id": "easy_014", "query": "预测一下面试可能会问什么问题", "ground_truth": ["interview-q"], "difficulty": "easy"},
            {"id": "easy_016", "query": "刚面试完想复盘一下", "ground_truth": ["interview-review"], "difficulty": "easy"},
            {"id": "easy_018", "query": "简历需要针对产品经理岗位优化", "ground_truth": ["resume-fix", "jd-match"], "difficulty": "easy"},
            {"id": "easy_020", "query": "准备字节跳动的产品经理面试", "ground_truth": ["interview-q", "self-intro"], "difficulty": "easy"},

            # 留学申请场景（4条）
            {"id": "easy_021", "query": "评估一下我的背景能申请什么学校", "ground_truth": ["bg-assess"], "difficulty": "easy"},
            {"id": "easy_022", "query": "帮我选校定位", "ground_truth": ["school-pick"], "difficulty": "easy"},
            {"id": "easy_023", "query": "文书初稿写完了想检查逻辑", "ground_truth": ["ps-diagnose"], "difficulty": "easy"},
            {"id": "easy_024", "query": "完全不知道文书怎么写", "ground_truth": ["ps-draft"], "difficulty": "easy"},

            # 学习考试场景（3条）
            {"id": "easy_026", "query": "距离考研还有3个月帮我排个学习计划", "ground_truth": ["study-plan"], "difficulty": "easy"},
            {"id": "easy_027", "query": "把这些错题整理归类一下", "ground_truth": ["mistake-book"], "difficulty": "easy"},
            {"id": "easy_028", "query": "三本参考书内容重复想合并总结", "ground_truth": ["material-digest"], "difficulty": "easy"},
        ],

        "medium": [
            {"id": "medium_001", "query": "明天要做课程汇报，从准备到讲稿都需要", "ground_truth": ["ppt-outline"], "difficulty": "medium"},
            {"id": "medium_002", "query": "投递秋招需要完整准备", "ground_truth": ["resume-fix", "jd-match", "self-intro", "interview-q"], "difficulty": "medium"},
            {"id": "medium_003", "query": "英国商业分析专业申请材料准备", "ground_truth": ["school-pick", "ps-draft"], "difficulty": "medium"},
            {"id": "medium_004", "query": "帮我把这段英文改得更学术", "ground_truth": ["en-polish"], "difficulty": "medium"},
            {"id": "medium_005", "query": "我的简历总是投了没回音", "ground_truth": ["resume-fix", "jd-match"], "difficulty": "medium"},
            {"id": "medium_006", "query": "不知道该申请什么专业", "ground_truth": ["bg-assess"], "difficulty": "medium"},
            {"id": "medium_007", "query": "期末周要复习5门课", "ground_truth": ["study-plan", "material-digest"], "difficulty": "medium"},
            {"id": "medium_008", "query": "社团招新需要做个宣讲PPT", "ground_truth": ["ppt-outline"], "difficulty": "medium"},
            {"id": "medium_009", "query": "面试腾讯产品经理岗位需要准备什么", "ground_truth": ["interview-q", "self-intro"], "difficulty": "medium"},
            {"id": "medium_011", "query": "Excel表格需要自动计算公式", "ground_truth": ["excel-build", "excel-formula"], "difficulty": "medium"},
            {"id": "medium_012", "query": "把上课拍的照片笔记整理成文字", "ground_truth": ["note-tidy"], "difficulty": "medium"},
            {"id": "medium_013", "query": "简历和岗位要求差距在哪", "ground_truth": ["jd-match"], "difficulty": "medium"},
            {"id": "medium_014", "query": "GPA 3.4雅思7.0能申请英国什么学校", "ground_truth": ["bg-assess", "school-pick"], "difficulty": "medium"},
            {"id": "medium_015", "query": "考前刷题错了好多想分析原因", "ground_truth": ["mistake-book"], "difficulty": "medium"},
            {"id": "medium_016", "query": "个人陈述写了800字总觉得不对", "ground_truth": ["ps-diagnose"], "difficulty": "medium"},
            {"id": "medium_017", "query": "要做数据分析作业需要Excel模板", "ground_truth": ["excel-build"], "difficulty": "medium"},
            {"id": "medium_018", "query": "群面下周要参加想练习", "ground_truth": ["self-intro"], "difficulty": "medium"},
            {"id": "medium_020", "query": "考研政治完全没开始怎么安排", "ground_truth": ["study-plan"], "difficulty": "medium"},
        ],

        "hard": [
            {"id": "hard_001", "query": "马上要答辩了有点紧张", "ground_truth": ["ppt-outline"], "difficulty": "hard"},
            {"id": "hard_002", "query": "感觉自己条件一般不知道能不能出国", "ground_truth": ["bg-assess", "school-pick"], "difficulty": "hard"},
            {"id": "hard_003", "query": "投了20家公司都石沉大海", "ground_truth": ["resume-fix", "jd-match"], "difficulty": "hard"},
            {"id": "hard_004", "query": "下周presentation老师说要准备充分", "ground_truth": ["ppt-outline"], "difficulty": "hard"},
            {"id": "hard_005", "query": "想转专业但不知道方向", "ground_truth": ["bg-assess"], "difficulty": "hard"},
            {"id": "hard_006", "query": "复习进度落后了好焦虑", "ground_truth": ["study-plan"], "difficulty": "hard"},
            {"id": "hard_007", "query": "老板让我整个数据表格", "ground_truth": ["excel-build"], "difficulty": "hard"},
            {"id": "hard_008", "query": "HR面应该怎么准备", "ground_truth": ["interview-q", "self-intro"], "difficulty": "hard"},
            {"id": "hard_009", "query": "文书中介改完了我自己再看看", "ground_truth": ["ps-diagnose"], "difficulty": "hard"},
            {"id": "hard_010", "query": "这门课知识点太多了记不住", "ground_truth": ["material-digest", "note-tidy"], "difficulty": "hard"},
        ],
    }

    if difficulty == "all":
        return dataset["easy"] + dataset["medium"] + dataset["hard"]
    else:
        return dataset.get(difficulty, [])


def build_index(output_path: str = "skill_index.json"):
    """建立并保存索引"""
    print("=" * 60)
    print("建立 Skill 索引")
    print("=" * 60)

    # 1. 加载上架的 skill（数量以 skill_retrieval 的列表为准）
    skills = load_skills_from_frontend_data()
    print(f"✓ 加载了 {len(skills)} 个上架 skill")

    # 2. 初始化 Embedding 客户端
    print("\n初始化 Embedding 客户端（OpenAI text-embedding-3-small）...")
    embedding_client = EmbeddingClient(provider="openai", model="text-embedding-3-small")

    # 3. 建立索引
    retrieval = SkillRetrieval(embedding_client)
    retrieval.index_skills(skills, show_progress=True)

    # 4. 保存索引
    print(f"\n保存索引到 {output_path}...")
    retrieval.save_index(output_path)

    print("\n✓ 索引建立完成！")
    print(f"  - 索引文件: {output_path}")
    print(f"  - 元数据文件: {output_path.replace('.json', '_meta.json')}")


def test_query(query: str, top_k: int = 5):
    """测试单个查询"""
    print("=" * 60)
    print(f"测试查询: {query}")
    print("=" * 60)

    # 加载索引
    embedding_client = EmbeddingClient(provider="openai", model="text-embedding-3-small")
    retrieval = SkillRetrieval.load_index("skill_index.json", embedding_client)

    # 检索
    results = retrieval.search(query, top_k=top_k)

    # 显示结果
    print(f"\nTop-{top_k} 检索结果:\n")
    for result in results:
        skill = retrieval.skills[result.skill_id]
        print(f"{result.rank}. {result.skill_name}")
        print(f"   ID: {result.skill_id}")
        print(f"   相似度: {result.score:.4f}")
        print(f"   功能: {skill.promise}")
        print(f"   标签: {', '.join(skill.tags)}")
        print()


def run_evaluation(difficulty: str = "all"):
    """运行完整评估"""
    print("=" * 60)
    print(f"运行评估 (难度: {difficulty})")
    print("=" * 60)

    # 加载索引
    embedding_client = EmbeddingClient(provider="openai", model="text-embedding-3-small")
    retrieval = SkillRetrieval.load_index("skill_index.json", embedding_client)

    # 加载测试数据
    test_cases = load_test_dataset(difficulty)
    print(f"\n加载了 {len(test_cases)} 条测试用例")

    # 运行评估
    print("\n开始评估...")
    metrics = retrieval.evaluate(test_cases)

    # 显示结果
    print("\n" + "=" * 60)
    print("评估结果")
    print("=" * 60)
    print(f"Precision@1:  {metrics.precision_at_1:.2%}")
    print(f"Precision@3:  {metrics.precision_at_3:.2%}")
    print(f"Recall@3:     {metrics.recall_at_3:.2%}")
    print(f"MRR:          {metrics.mrr:.4f}")

    # 目标对比
    print("\n目标基准:")
    print(f"Precision@1:  ≥ 70%  {'✓' if metrics.precision_at_1 >= 0.70 else '✗'}")
    print(f"Recall@3:     ≥ 90%  {'✓' if metrics.recall_at_3 >= 0.90 else '✗'}")
    print(f"MRR:          ≥ 0.75 {'✓' if metrics.mrr >= 0.75 else '✗'}")

    # 保存结果
    result_file = f"eval_results_{difficulty}.json"
    with open(result_file, "w", encoding="utf-8") as f:
        json.dump({
            "difficulty": difficulty,
            "test_cases": len(test_cases),
            "metrics": metrics.to_dict(),
            "timestamp": __import__("datetime").datetime.now().isoformat(),
        }, f, ensure_ascii=False, indent=2)

    print(f"\n✓ 结果已保存到 {result_file}")

    # 分难度统计（如果是 all）
    if difficulty == "all":
        print("\n" + "=" * 60)
        print("分难度统计")
        print("=" * 60)

        for diff in ["easy", "medium", "hard"]:
            cases = load_test_dataset(diff)
            m = retrieval.evaluate(cases)
            print(f"\n{diff.upper()} ({len(cases)} 条):")
            print(f"  P@1: {m.precision_at_1:.2%}  R@3: {m.recall_at_3:.2%}  MRR: {m.mrr:.4f}")


def main():
    parser = argparse.ArgumentParser(description="测试 Skill 检索系统")
    parser.add_argument("--build-index", action="store_true", help="建立索引")
    parser.add_argument("--query", type=str, help="测试单个查询")
    parser.add_argument("--eval", action="store_true", help="运行完整评估")
    parser.add_argument("--difficulty", choices=["all", "easy", "medium", "hard"], default="all", help="评估难度")
    parser.add_argument("--top-k", type=int, default=5, help="返回 Top-K 结果")

    args = parser.parse_args()

    if args.build_index:
        build_index()
    elif args.query:
        test_query(args.query, top_k=args.top_k)
    elif args.eval:
        run_evaluation(args.difficulty)
    else:
        parser.print_help()


if __name__ == "__main__":
    main()
