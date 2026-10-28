"""
基于 LLM 的检索系统（不需要 Embedding API）

直接用 LLM 来匹配最合适的 skill
"""

import os
import json
from typing import List, Dict
from dataclasses import dataclass


@dataclass
class SearchResult:
    skill_id: str
    skill_name: str
    score: float
    rank: int


class LLMBasedRetrieval:
    """基于 LLM 的检索系统"""

    def __init__(self):
        from skill_retrieval import load_skills_from_frontend_data
        self.skills = {s.id: s for s in load_skills_from_frontend_data()}
        print(f"✓ 已加载 {len(self.skills)} 个 skills")

    def search(self, query: str, top_k: int = 5) -> List[SearchResult]:
        """
        使用 LLM 检索

        Args:
            query: 用户查询
            top_k: 返回前 K 个结果

        Returns:
            检索结果列表
        """
        # 构建 skill 列表
        skills_desc = []
        for skill_id, skill in self.skills.items():
            skills_desc.append(f"{skill_id}: {skill.name} - {skill.promise}")

        # 构建 prompt
        prompt = f"""用户查询："{query}"

请从以下 30 个工具中，选出最匹配的 {top_k} 个，按匹配度排序：

{chr(10).join(skills_desc)}

请直接返回 JSON 格式（不要有其他文字）：
[
  {{"skill_id": "xxx", "confidence": 0.95}},
  ...
]
"""

        # 调用 LLM
        try:
            import requests
            response = requests.post(
                (os.getenv("OPENAI_BASE_URL") or "https://api.openai.com/v1").rstrip("/") + "/chat/completions",
                headers={
                    "Authorization": f"Bearer {os.getenv('OPENAI_API_KEY')}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "gpt-4",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.3
                },
                timeout=30
            )

            if response.status_code == 200:
                result = response.json()
                content = result['choices'][0]['message']['content']

                # 解析 JSON
                try:
                    matches = json.loads(content)
                except:
                    # 如果返回的不是纯 JSON，尝试提取
                    import re
                    json_match = re.search(r'\[.*\]', content, re.DOTALL)
                    if json_match:
                        matches = json.loads(json_match.group())
                    else:
                        raise Exception("无法解析 LLM 返回的结果")

                # 构建结果
                results = []
                for rank, match in enumerate(matches[:top_k], 1):
                    skill_id = match['skill_id']
                    if skill_id in self.skills:
                        results.append(SearchResult(
                            skill_id=skill_id,
                            skill_name=self.skills[skill_id].name,
                            score=match.get('confidence', 0.8),
                            rank=rank
                        ))

                return results
            else:
                raise Exception(f"API 调用失败: {response.status_code} - {response.text[:200]}")

        except Exception as e:
            print(f"✗ LLM 检索失败: {e}")
            # 降级到关键词匹配
            return self._keyword_fallback(query, top_k)

    def _keyword_fallback(self, query: str, top_k: int) -> List[SearchResult]:
        """关键词匹配降级方案"""
        scores = []
        query_lower = query.lower()

        for skill_id, skill in self.skills.items():
            score = 0
            # 名称匹配
            if skill.name in query or any(tag in query for tag in skill.tags):
                score += 2

            # 关键词匹配
            keywords = {
                'ppt': ['ppt', '演示', '汇报', '幻灯片'],
                'excel': ['excel', '表格', '公式', 'xls'],
                '简历': ['简历', 'resume', '求职', 'cv'],
                '英文': ['英文', 'english', '润色', 'polish'],
                '文书': ['文书', 'essay', 'ps', '申请'],
                '笔记': ['笔记', 'note', '整理'],
                'pdf': ['pdf', '文档', '总结'],
            }

            for key, words in keywords.items():
                if any(w in query_lower for w in words):
                    if key in skill_id or key in skill.name.lower():
                        score += 1

            scores.append((skill_id, score))

        # 排序
        scores.sort(key=lambda x: x[1], reverse=True)

        # 构建结果
        results = []
        for rank, (skill_id, score) in enumerate(scores[:top_k], 1):
            results.append(SearchResult(
                skill_id=skill_id,
                skill_name=self.skills[skill_id].name,
                score=min(score / 3.0, 1.0),
                rank=rank
            ))

        return results


if __name__ == "__main__":
    print("测试 LLM 检索系统...")

    retrieval = LLMBasedRetrieval()

    test_queries = [
        "我要做PPT",
        "这个Excel公式看不懂",
        "帮我改简历",
    ]

    for query in test_queries:
        print(f"\n查询: {query}")
        results = retrieval.search(query, top_k=3)
        for r in results:
            print(f"  {r.rank}. {r.skill_name} (score: {r.score:.2f})")
