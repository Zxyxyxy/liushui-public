"""AI 日报：每天一份，所有人看同一份，用户免费看。

内容源和写法来自 zarazhangrui/follow-builders（README 声明 MIT，仓库没有 LICENSE 文件）：
她的仓库每天用 GitHub Actions 把 AI 一线从业者的 X 动态、播客文字稿、官方博客抓成三个 JSON。
我们只读这三个 JSON，按她的 prompt 规则写成中文日报，末尾加一个「今日概念」。

取数顺序：jsDelivr CDN（国内能连）→ fastly 镜像 → GitHub 原始地址。
CDN 有缓存，拿到的可能是前一天的数据（T+1），这在用户要求的范围内；页面上会写清数据是哪天生成的。

每天只调一次模型：同一个「数据生成时间」只生成一次，结果存在数据库里。
"""

import json
import re
import threading
import urllib.request
from datetime import datetime
from typing import Any, Dict, List, Optional

REPO = "zarazhangrui/follow-builders"
FEEDS = ("feed-x.json", "feed-podcasts.json", "feed-blogs.json")
MIRRORS = (
    "https://cdn.jsdelivr.net/gh/" + REPO + "@main/{f}",
    "https://fastly.jsdelivr.net/gh/" + REPO + "@main/{f}",
    "https://raw.githubusercontent.com/" + REPO + "/main/{f}",
)
TIMEOUT = 20
TWEET_CAP = 600          # 每条推文最多留多少字
TRANSCRIPT_CAP = 6000    # 每期播客文字稿最多留多少字（够提炼要点，不撑爆上下文）
BLOG_CAP = 3000
SOURCE_LINK = "https://github.com/zarazhangrui/follow-builders"

_lock = threading.Lock()
_memo: Dict[str, Any] = {"at": 0.0, "value": None}
MEMO_SECONDS = 3600      # 一小时内重复请求直接返回，不再去 CDN 取数


def _ensure_table():
    from db import _conn
    with _conn() as c:
        c.execute("""CREATE TABLE IF NOT EXISTS ai_digests (
            feed_date TEXT PRIMARY KEY,      -- 数据生成日期（取三个 feed 里最新的 generatedAt）
            created_at TEXT NOT NULL,
            content TEXT NOT NULL            -- JSON：{markdown, concept, items, feed_generated_at}
        )""")


def _fetch(name: str) -> Optional[Dict[str, Any]]:
    for tpl in MIRRORS:
        url = tpl.format(f=name)
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers={"User-Agent": "liushui"}),
                                        timeout=TIMEOUT) as r:
                data = json.loads(r.read().decode("utf-8"))
            if isinstance(data, dict) and data.get("generatedAt"):
                return data
        except Exception:
            continue
    return None


def _clip(t: str, n: int) -> str:
    t = re.sub(r"\s+", " ", t or "").strip()
    return t if len(t) <= n else t[:n] + "…"


def _safe_url(u: str) -> str:
    return u if isinstance(u, str) and re.match(r"^https?://", u) else ""


def load_feeds() -> Optional[Dict[str, Any]]:
    """取三个 feed，整理成带编号的条目。每条都必须有原文链接，没链接的丢掉（No link = not real）。"""
    raw = {n: _fetch(n) for n in FEEDS}
    if not any(raw.values()):
        return None
    items: List[Dict[str, Any]] = []
    for b in (raw["feed-x.json"] or {}).get("x") or []:
        for t in b.get("tweets") or []:
            url = _safe_url(t.get("url"))
            if url and (t.get("text") or "").strip():
                items.append({"kind": "x", "who": b.get("name", ""), "bio": _clip(b.get("bio", ""), 160),
                              "text": _clip(t["text"], TWEET_CAP), "url": url, "date": t.get("createdAt", "")})
    for p in (raw["feed-podcasts.json"] or {}).get("podcasts") or []:
        url = _safe_url(p.get("url"))
        if url and (p.get("transcript") or "").strip():
            items.append({"kind": "podcast", "who": p.get("name", ""), "title": p.get("title", ""),
                          "text": _clip(p["transcript"], TRANSCRIPT_CAP), "url": url, "date": p.get("publishedAt", "")})
    for g in (raw["feed-blogs.json"] or {}).get("blogs") or []:
        url = _safe_url(g.get("url"))
        body = g.get("content") or g.get("text") or g.get("summary") or ""
        if url and body.strip():
            items.append({"kind": "blog", "who": g.get("source") or g.get("name", ""), "title": g.get("title", ""),
                          "text": _clip(body, BLOG_CAP), "url": url, "date": g.get("publishedAt", "")})
    gen = max((d.get("generatedAt") or "") for d in raw.values() if d)
    for i, it in enumerate(items, 1):
        it["n"] = i
    return {"generated_at": gen, "items": items}


def digest_messages(feeds: Dict[str, Any], today: str) -> List[Dict[str, str]]:
    blocks = []
    for it in feeds["items"]:
        head = {"x": "X 动态", "podcast": "播客", "blog": "官方博客"}[it["kind"]]
        title = f"《{it['title']}》" if it.get("title") else ""
        bio = f"（简介：{it['bio']}）" if it.get("bio") else ""
        blocks.append(f"[{it['n']}] {head} · {it['who']}{bio} {title}\n{it['text']}")
    system = (
        "你是一位懂行的 AI 行业编辑，给中国大学生写每日 AI 动态。你只能根据给出的原始材料写，"
        "不能用自己的知识补充事实。只输出 JSON，不要任何解释或代码块标记。"
    )
    user = f"""今天是 {today}。下面是 AI 一线从业者最近的 X 动态、播客文字稿和官方博客（编号即来源序号）：

{chr(10).join(blocks)}

请写一份中文 AI 日报，输出 JSON：
{{
  "headline": "今天最值得知道的一件事，一句话",
  "sections": [
    {{"title": "X 动态 / 播客 / 官方博客", "items": [
      {{"who": "人名 + 身份或公司，如「Replit CEO Amjad Masad」", "summary": "要点", "quote": "原文中最有代表性的一句（可选）", "src": [1]}}
    ]}}
  ],
  "concept": {{"term": "今日概念（英文术语原样保留）", "plain": "用大白话讲清楚它是什么，2-3 句", "why": "为什么今天的内容里会出现它，1 句", "src": [2]}}
}}

写作规则（来自 Follow Builders 的规则，必须遵守）：
1. **只写材料里真实存在的内容**，每一条都要标来源编号 src；没有来源的不要写。不编造引语，不揣测谁在做什么，不评论谁没发言；
   含义不明、需要猜才能看懂的动态（如一句玩笑、一句暗语）直接跳过，不要写「像是在暗示……」
2. 只挑有实质内容的：原创观点、产品发布、技术讨论、行业分析、经验教训。跳过日常闲聊、无评论转发、广告、「活动很棒」这类内容
3. 介绍人时写全名加身份或公司，不写 @用户名，也不只写姓
4. X 动态每人 2-4 句；同一人的多条合成一段；有大胆预测或反主流观点的放在最前面
5. 播客写 150-300 字：先一句「核心观点」，再写讲者是谁、为什么值得听，优先写反直觉或非常具体的经验，避免泛泛的道理；把专业知识翻译成普通大学生能懂的话；不要写「在这期节目中」这类话
6. 博客写 100-200 字：直接说核心发布或发现，有数字就写数字，有实际影响（新 API、新能力、政策变化）就点明
7. 没有新内容的分类整个省略；内容太多时只保留最有价值的 8-12 条
8. 中文要自然，像懂行的朋友在聊天；AI、LLM、GPU、API、agent、RAG、token、prompt 等术语和人名、公司名、产品名保留英文；不用破折号
9. 「今日概念」从今天的材料里挑一个大学生可能不熟悉、但值得懂的术语，用大白话讲清楚；讲解可以用你的常识，但这个术语必须真的出现在材料里，src 写出现它的条目
10. quote 必须是材料里的原句（英文原样照抄，后面括号附中文意思），找不到合适的就留空"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def build(data: Optional[Dict[str, Any]], feeds: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """清洗模型输出：来源编号必须存在；引语必须能在原文里找到，找不到的删掉。生成 markdown。"""
    if not data:
        return None
    by_n = {it["n"]: it for it in feeds["items"]}

    def srcs(x):
        return [i for i in (x.get("src") or []) if isinstance(i, int) and i in by_n]

    def norm(t):
        return re.sub(r"[^0-9a-z]", "", (t or "").lower())

    # 揣测性的说法：规则里禁止了，模型仍会写，这里在代码里拦掉整条（不是改字，是不放）
    guess = re.compile(r"暗示|似乎|像是|看起来是|看上去是|或许|也许|可能(在|有|是|会|将)|疑似|据推测|推测|"
                       r"耐人寻味|造势|预告|透露出|意味深长|让人猜测|引发猜测")

    sections, used = [], []
    for sec in data.get("sections") or []:
        rows = []
        for it in (sec.get("items") if isinstance(sec, dict) else None) or []:
            if not isinstance(it, dict) or not str(it.get("summary") or "").strip():
                continue
            if guess.search(str(it["summary"])):
                continue
            s = srcs(it)
            if not s:
                continue
            quote = str(it.get("quote") or "").strip()
            en = re.split(r"[（(]", quote)[0]
            if quote and (len(norm(en)) < 12 or not any(norm(en) in norm(by_n[i]["text"]) for i in s)):
                quote = ""   # 引语核对不上原文就不放
            rows.append({"who": str(it.get("who") or "").strip(), "summary": str(it["summary"]).strip(),
                         "quote": quote, "src": s})
            used += s
        if rows:
            sections.append({"title": str(sec.get("title") or "").strip(), "items": rows})
    if not sections:
        return None

    concept = data.get("concept") if isinstance(data.get("concept"), dict) else {}
    cs = srcs(concept)
    term = str(concept.get("term") or "").strip()
    if not (term and cs and any(term.lower() in by_n[i]["text"].lower() for i in cs)):
        concept = None   # 术语得真的出现在材料里
    else:
        concept = {"term": term, "plain": str(concept.get("plain") or "").strip(),
                   "why": str(concept.get("why") or "").strip(), "src": cs}
        used += cs

    order = sorted(set(used))
    remap = {old: new for new, old in enumerate(order, 1)}
    refs = lambda s: "".join(f"[{remap[i]}]" for i in s)   # noqa: E731
    headline = str(data.get("headline") or "").strip()
    # 标题也不能揣测；而且它常常概括的是被拦掉的那条，所以有揣测词就整句不放
    lines = [f"**{headline}**", ""] if headline and not guess.search(headline) else []
    for sec in sections:
        lines += [f"## {sec['title']}", ""]
        for it in sec["items"]:
            lines.append(f"**{it['who']}** {refs(it['src'])}" if it["who"] else refs(it["src"]))
            lines.append(it["summary"])
            if it["quote"]:
                lines.append(f"> {it['quote']}")
            lines.append("")
    if concept:
        lines += ["## 今日概念", "", f"**{concept['term']}** {refs(concept['src'])}", concept["plain"]]
        if concept["why"]:
            lines.append(f"*为什么今天会看到它：{concept['why']}*")
        lines.append("")
    lines.append(f"内容源自 [Follow Builders]({SOURCE_LINK}) 每日抓取的公开动态，由 AI 整理成中文，观点属于原作者。")
    sources = [{"title": (by_n[i].get("title") or f"{by_n[i]['who']} 的动态")[:80], "url": by_n[i]["url"],
                "site": {"x": "X", "podcast": "播客", "blog": "博客"}[by_n[i]["kind"]], "date": by_n[i]["date"][:10]}
               for i in order]
    # 首页弹窗和卡片用的概述：标题 + 前几条的「谁 · 一句话」，不带来源编号
    highlights = []
    for sec in sections:
        for it in sec["items"]:
            first = re.split(r"(?<=[。！？])", it["summary"])[0].strip()
            highlights.append({"who": it["who"], "text": first[:70] + ("…" if len(first) > 70 else "")})
    preview = {"headline": headline if headline and not guess.search(headline) else "",
               "highlights": highlights[:4], "count": len(highlights)}
    return {"markdown": "\n".join(lines).strip(), "sources": sources, "concept": concept, "preview": preview}


def get_today(call_json, today: str) -> Optional[Dict[str, Any]]:
    """返回当天的日报；同一份数据只生成一次。拿不到新数据时返回最近一份缓存。
    一小时内的重复请求直接用内存里的结果，不再去 CDN 取数。"""
    import time
    if _memo["value"] and time.time() - _memo["at"] < MEMO_SECONDS:
        return _memo["value"]
    _ensure_table()
    with _lock:
        if _memo["value"] and time.time() - _memo["at"] < MEMO_SECONDS:
            return _memo["value"]
        out = _load_or_build(call_json, today)
        if out:
            _memo.update(at=time.time(), value=out)
        return out


def _load_or_build(call_json, today: str) -> Optional[Dict[str, Any]]:
    from db import _conn
    feeds = load_feeds()
    if feeds and feeds["items"]:
        key = feeds["generated_at"][:10]
        with _conn() as c:
            row = c.execute("SELECT content FROM ai_digests WHERE feed_date=?", (key,)).fetchone()
        if row:
            return json.loads(row[0])
        try:
            from grounding import parse
            d = build(parse(call_json(digest_messages(feeds, today))), feeds)
        except Exception:
            d = None
        if d:
            d["feed_generated_at"] = feeds["generated_at"]
            with _conn() as c:
                c.execute("INSERT OR REPLACE INTO ai_digests VALUES (?, ?, ?)",
                          (key, datetime.now().isoformat(timespec="seconds"), json.dumps(d, ensure_ascii=False)))
            return d
    with _conn() as c:
        row = c.execute("SELECT content FROM ai_digests ORDER BY feed_date DESC LIMIT 1").fetchone()
    return json.loads(row[0]) if row else None
