"""岗位信息补充：用户只写了岗位名称、没贴 JD 时，先联网搜这个岗位的公开招聘信息，
整理成一段岗位画像，附在岗位字段后面再交给工具。

原则：
- 只在「岗位字段很短、像是岗位名称」时触发；用户贴了完整 JD 就不搜，以用户给的为准
- 画像只能来自搜到的网页，每条标来源序号；搜不到或网页不相关时返回空，工具照常按岗位名称运行
- 注入的文字明确告诉工具：这是公开招聘信息的归纳，不是这家公司的正式 JD，
  也不是候选人的经历，不得写进简历或自我介绍里当成候选人做过的事
"""

import json
from typing import Any, Dict, List, Optional, Tuple

# 哪些工具需要岗位画像，以及岗位写在哪个字段
ROLE_FIELD = {
    "resume-fix": "target_role",
    "resume-fix-story": "target_role",
    "resume-fix-campus": "target_role",
    "self-intro": "target_role",
    "self-intro-pitch": "target_role",
    "interview-q": "jd",
}

# 字段超过这个长度，多半是用户贴了 JD，不再补
SHORT_ROLE = 60
MAX_SOURCES = 6
ITEM_CAP = 6     # 每一类最多几条


def role_to_profile(skill_id: str, params: Dict[str, str]) -> Optional[Tuple[str, str]]:
    """需要补岗位信息时返回 (字段 key, 岗位名称)，否则 None。"""
    key = ROLE_FIELD.get(skill_id)
    if not key:
        return None
    role = (params.get(key) or "").strip()
    if not role or role == "（未提供）" or len(role) > SHORT_ROLE or "\n" in role:
        return None
    return key, role


def queries(role: str) -> List[str]:
    return [f"{role} 岗位职责 任职要求", f"{role} 招聘 能力要求 面试"]


def profile_messages(role: str, sources: List[Dict[str, Any]], today: str) -> List[Dict[str, str]]:
    blocks = []
    for i, s in enumerate(sources, 1):
        body = (s.get("content") or s.get("snippet") or "")[:2500]
        blocks.append(f"[{i}] {s.get('title', '')}（{s.get('site', '')}）\n{body}")
    system = (
        "你是招聘信息分析员。你只能根据给出的网页内容归纳岗位要求，不能用自己的知识补充。"
        "只输出 JSON，不要任何解释或代码块标记。"
    )
    user = f"""今天是 {today}。目标岗位：{role}

下面是联网搜到的网页（编号即来源序号）：

{chr(10).join(blocks)}

请归纳这个岗位在公开招聘信息里通常要求什么，输出 JSON：
{{
  "relevant": true,
  "duties": [{{"text": "核心职责，一句话", "src": [1]}}],
  "skills": [{{"text": "常见能力或硬性要求，一句话", "src": [2]}}],
  "keywords": ["JD 里高频出现的关键词"],
  "interview_focus": [{{"text": "面试常考察的点", "src": [3]}}]
}}

规则：
1. 每条都必须能在对应编号的网页里找到依据，src 写网页编号；找不到依据的不要写
2. 网页讲的不是这个岗位（或者是培训广告、无关文章）时，不要引用它
3. 所有网页都不相关时，输出 {{"relevant": false}}
4. 职责、能力、面试点各最多 {ITEM_CAP} 条，关键词最多 10 个
5. 写的是这类岗位的共性要求。先**提炼共性**：不同网页里说法不同、但本质是同一件事的
   （如一个写「撰写产品方案」，另一个写「梳理运营手册」，都是把需求落成文档推动落地），
   合并成一条通用说法，把这些网页的编号都写进 src
6. 只在一个网页出现、明显属于某个具体业务方向（如教育、电商、某个产品线）的要求，
   句末用括号注明方向，例如「（教育方向）」；这类方向专属的条目，职责和要求各**最多 2 条**，
   放在共性条目后面
7. keywords 只写能力、技能、方法和工具类的词（如「需求分析」「SQL」「竞品分析」），
   不要写岗位名称、学历、毕业年份、实习时长这类条件
8. 只有网页明确是这家公司的招聘时，才能说「该公司要求」
9. interview_focus 只在网页**明确写到**面试、笔试的流程或考察内容时才写；
   不要把任职要求换个说法当成面试考察点，没有就给空数组"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _items(data: Dict[str, Any], key: str, n: int) -> List[Dict[str, Any]]:
    out = []
    for it in data.get(key) or []:
        if not isinstance(it, dict):
            continue
        text = str(it.get("text") or "").strip()
        src = [x for x in (it.get("src") or []) if isinstance(x, int) and 1 <= x <= n]
        if text and src:   # 没有来源的条目一律丢掉
            out.append({"text": text[:120], "src": sorted(set(src))})
    # 被越多招聘页提到的越靠前：共性要求排在单个岗位的特殊要求前面
    out.sort(key=lambda it: -len(it["src"]))
    return out[:ITEM_CAP]


def build(data: Optional[Dict[str, Any]], sources: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """清洗模型输出：只留有来源的条目；来源按实际被引用的重新编号。没有可用内容返回 None。"""
    if not data or not data.get("relevant", True):
        return None
    n = len(sources)
    duties, skills, focus = (_items(data, k, n) for k in ("duties", "skills", "interview_focus"))
    if not (duties or skills):
        return None
    keywords = [str(k).strip()[:20] for k in (data.get("keywords") or []) if str(k).strip()][:10]

    used = sorted({i for group in (duties, skills, focus) for it in group for i in it["src"]})
    remap = {old: new for new, old in enumerate(used, 1)}
    for group in (duties, skills, focus):
        for it in group:
            it["src"] = [remap[i] for i in it["src"]]
    cited = [sources[i - 1] for i in used]
    return {"duties": duties, "skills": skills, "keywords": keywords,
            "interview_focus": focus, "sources": cited}


def to_prompt(role: str, profile: Dict[str, Any]) -> str:
    """附在岗位字段后面的文字。工具模板原样收到，不需要改模板。"""
    def lines(group):
        return "\n".join(f"- {it['text']}" for it in group)

    parts = [
        role,
        "",
        "【岗位画像：联网整理的公开招聘信息，仅供参考】",
        "说明：这是同类岗位招聘信息的归纳，不是这家公司的正式 JD，也不是候选人的经历。"
        "只用来判断岗位看重什么；不得把其中任何一条当成候选人做过的事写进结果；"
        "候选人材料里没有依据的能力，要作为差距指出，而不是替他补上。",
    ]
    if profile["duties"]:
        parts += ["核心职责：", lines(profile["duties"])]
    if profile["skills"]:
        parts += ["常见要求：", lines(profile["skills"])]
    if profile["keywords"]:
        parts += ["高频关键词：" + "、".join(profile["keywords"])]
    if profile["interview_focus"]:
        parts += ["面试常考察：", lines(profile["interview_focus"])]
    return "\n".join(parts)


def summary(profile: Dict[str, Any]) -> str:
    """过程步骤里给用户看的一行"""
    n = len(profile["sources"])
    kw = "、".join(profile["keywords"][:4])
    return f"参考 {n} 个招聘页面" + (f"，关键词：{kw}" if kw else "")


def sources_out(profile: Dict[str, Any]) -> List[Dict[str, str]]:
    return [{"title": s.get("title", ""), "url": s.get("url", ""),
             "site": s.get("site", ""), "date": s.get("date", "")} for s in profile["sources"]]


def parse(raw: str) -> Optional[Dict[str, Any]]:
    import re
    m = re.search(r"\{.*\}", raw or "", re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except Exception:
        return None
    return d if isinstance(d, dict) else None
