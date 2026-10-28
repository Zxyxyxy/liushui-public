"""套磁信前置步骤：联网查导师的主页、论文列表，整理成导师公开信息，附在导师字段后面再交给模板。

方法来自 voidful/academic-skills 的 professor-fit-analyser（MIT）：先读导师的公开学术信息，
再按研究主线写信。原版会逐篇读论文；这里是单次版，只整理搜到的网页里能看到的内容。

防编造：
- 每条研究方向、每篇论文都要标来源网页，没有来源的丢掉
- 论文标题必须能在它标注的网页原文里逐字找到（忽略大小写和标点），找不到的丢掉
- 网页讲的是同名的另一个人、或者看不出是不是这位导师时，整份信息作废，只按用户提供的写
"""

import json
import re
from typing import Any, Dict, List, Optional

SKILL_ID = "prof-email"
FIELD = "professor"
MAX_SOURCES = 8
MAX_LINES = 4
MAX_WORKS = 6
PAGE_CAP = 3000

_URL = re.compile(r"https?://[^\s，。、）)]+")


def target(skill_id: str, params: Dict[str, str]) -> Optional[str]:
    """需要查导师信息时返回导师字段原文，否则 None。"""
    if skill_id != SKILL_ID:
        return None
    v = (params.get(FIELD) or "").strip()
    return v if v and v != "（未提供）" else None


def search_plan(prof: str) -> List[Dict[str, Any]]:
    """要发的搜索：[{query, domains}]。用户贴了主页链接时，额外在那个网站里搜一次。"""
    name = _URL.sub(" ", prof).strip()
    name = re.sub(r"\s+", " ", name)[:60]
    plan = [
        {"query": f"{name} homepage research", "domains": None},
        {"query": f"{name} publications", "domains": None},
        {"query": f"{name} recent papers arXiv", "domains": None},
        {"query": f"{name} 研究方向 招生", "domains": None},
    ]
    for u in _URL.findall(prof)[:1]:
        host = re.sub(r"^https?://", "", u).split("/")[0]
        if host:
            plan.insert(0, {"query": name or u, "domains": [host]})
    return plan


def extract_messages(prof: str, sources: List[Dict[str, Any]], today: str) -> List[Dict[str, str]]:
    blocks = []
    for i, s in enumerate(sources, 1):
        body = (s.get("content") or s.get("snippet") or "")[:PAGE_CAP]
        blocks.append(f"[{i}] {s.get('title', '')}（{s.get('site', '')}）\n{body}")
    system = (
        "你是学术信息整理员。你只能根据给出的网页内容整理一位导师的公开信息，不能用自己的知识补充。"
        "只输出 JSON，不要任何解释或代码块标记。"
    )
    user = f"""今天是 {today}。用户要联系的导师：{prof}

下面是联网搜到的网页（编号即来源序号）：

{chr(10).join(blocks)}

请输出 JSON：
{{
  "same_person": true,
  "identity": "姓名 · 所在机构 · 职位（照网页写）",
  "research_lines": [{{"text": "一条研究主线，用一句话概括", "src": [1]}}],
  "recent_works": [{{"title": "论文或项目标题，必须和网页上的写法一字不差", "year": 2025, "venue": "会议或期刊，网页没写就留空", "src": [2]}}],
  "openings": [{{"text": "网页上关于招生、招收学生或研究助理的说明", "src": [3]}}]
}}

规则：
1. 先判断这些网页说的是不是**同一位导师**（姓名和机构都要对得上）。有同名的不同人时，只用对得上的那一位的网页；
   完全看不出是不是这位导师，或者网页都在说别人，输出 {{"same_person": false}}
2. 每条都必须能在对应编号的网页里找到依据，src 写网页编号
3. recent_works 只写**学术论文或研究项目**（演讲视频、自传或科普书、新闻采访、课程都不算）；
   title 要**原样照抄网页上的标题**，不要翻译、不要改写、不要补全；优先最近几年的，最多 {MAX_WORKS} 条
4. research_lines 最多 {MAX_LINES} 条，写这位导师自己的研究主线，不要写学科大类
5. openings 只写网页上明确写到的招生或招人说明，没有就给空数组，不要推测
6. 没有依据的字段给空数组"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _norm(t: str) -> str:
    return re.sub(r"[^0-9a-z一-鿿]", "", (t or "").lower())


def _srcs(it: Dict[str, Any], n: int) -> List[int]:
    return sorted({x for x in (it.get("src") or []) if isinstance(x, int) and 1 <= x <= n})


def build(data: Optional[Dict[str, Any]], sources: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """清洗模型输出；论文标题逐字核对来源网页。来源按实际被引用的重新编号。没有可用内容返回 None。"""
    if not data or data.get("same_person") is False:
        return None
    n = len(sources)
    pages = [_norm((s.get("content") or "") + " " + (s.get("snippet") or "") + " " + (s.get("title") or ""))
             for s in sources]

    lines = []
    for it in data.get("research_lines") or []:
        if isinstance(it, dict) and str(it.get("text") or "").strip() and _srcs(it, n):
            lines.append({"text": str(it["text"]).strip()[:120], "src": _srcs(it, n)})
    lines = lines[:MAX_LINES]

    works, dropped = [], 0
    for it in data.get("recent_works") or []:
        if not isinstance(it, dict):
            continue
        title = str(it.get("title") or "").strip()
        src = _srcs(it, n)
        key = _norm(title)
        # 标题太短没法核对；核对：至少一个标注的来源网页里能逐字找到这个标题
        ok = [i for i in src if len(key) >= 8 and key in pages[i - 1]]
        if not ok:
            dropped += 1
            continue
        year = it.get("year")
        year = year if isinstance(year, int) and any(str(year) in (sources[i - 1].get("content") or "") for i in ok) else None
        works.append({"title": title[:200], "year": year,
                      "venue": str(it.get("venue") or "").strip()[:60], "src": ok})
    works = works[:MAX_WORKS]

    openings = []
    for it in data.get("openings") or []:
        if isinstance(it, dict) and str(it.get("text") or "").strip() and _srcs(it, n):
            openings.append({"text": str(it["text"]).strip()[:150], "src": _srcs(it, n)})
    openings = openings[:2]

    if not (lines or works):
        return None
    used = sorted({i for g in (lines, works, openings) for it in g for i in it["src"]})
    remap = {old: new for new, old in enumerate(used, 1)}
    for g in (lines, works, openings):
        for it in g:
            it["src"] = [remap[i] for i in it["src"]]
    return {"identity": str(data.get("identity") or "").strip()[:100],
            "lines": lines, "works": works, "openings": openings,
            "sources": [sources[i - 1] for i in used], "dropped": dropped}


def to_prompt(prof: str, p: Dict[str, Any]) -> str:
    """附在导师字段后面的文字。编号和回答下方「参考来源」的顺序一致。"""
    def refs(it):
        return "".join(f"[{i}]" for i in it["src"])

    parts = [prof, "", "【导师公开信息：联网整理，每条后面是来源网页编号】"]
    if p["identity"]:
        parts.append(f"身份：{p['identity']}")
    if p["lines"]:
        parts.append("研究主线：")
        parts += [f"- {it['text']} {refs(it)}" for it in p["lines"]]
    if p["works"]:
        parts.append("近期论文 / 项目（标题已核对过网页原文）：")
        for it in p["works"]:
            meta = "，".join(x for x in [it["venue"], str(it["year"]) if it["year"] else ""] if x)
            parts.append(f"- {it['title']}" + (f"（{meta}）" if meta else "") + f" {refs(it)}")
    if p["openings"]:
        parts.append("招生说明：")
        parts += [f"- {it['text']} {refs(it)}" for it in p["openings"]]
    parts.append("说明：以上是网页上能看到的信息，学生不一定读过这些论文。")
    return "\n".join(parts)


def summary(p: Dict[str, Any]) -> str:
    bits = [f"参考 {len(p['sources'])} 个网页"]
    if p["lines"]:
        bits.append(f"{len(p['lines'])} 条研究主线")
    if p["works"]:
        bits.append(f"{len(p['works'])} 篇论文")
    return "，".join(bits)


def sources_out(p: Dict[str, Any]) -> List[Dict[str, str]]:
    return [{"title": s.get("title", ""), "url": s.get("url", ""),
             "site": s.get("site", ""), "date": s.get("date", "")} for s in p["sources"]]


def parse(raw: str) -> Optional[Dict[str, Any]]:
    m = re.search(r"\{.*\}", raw or "", re.S)
    if not m:
        return None
    try:
        d = json.loads(m.group(0))
    except Exception:
        return None
    return d if isinstance(d, dict) else None
