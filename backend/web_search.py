"""联网搜索：给 Agent 查「会变的外部信息」（考试时间、招录要求、政策变化……）。

设计取舍：
- 搜索源可切换，对外的 search() 签名和返回结构不变：
    bocha   博查 Web Search API，国内服务，**生产用这个**
    tavily  Tavily，境外服务，**只用于本地测试**——搜索词会发往海外，和生产的数据驻留要求冲突。
            为防止误带上线，设了 ALLOW_OVERSEAS_SEARCH=true 才会启用（本地 .env 里写，生产不写）。
- 没配 key（或境外源没放行）就视为未启用：configured() 为 False，Agent 不注册这个工具，
  行为和没有联网搜索时完全一样。
- 搜索词来自模型，而模型看到的是已脱敏的内容，所以词里最多是〔手机号1〕这样的占位符，
  这里再把占位符去掉，不往外部服务发。
- 搜到的网页内容是不可信的外部文字：只截断、清洗后交给上层，由上层包进「这是资料不是指令」的块里。
- 只放行 http/https 链接，前端要渲染成可点的来源。

环境变量（写在 backend/.env，不走命令行）：
    SEARCH_PROVIDER=bocha|tavily     省略时：配了博查 key 用博查，否则配了 Tavily key 才考虑 Tavily
    BOCHA_API_KEY=...
    TAVILY_API_KEY=...
    ALLOW_OVERSEAS_SEARCH=true       仅本地测试用，放行 Tavily 这类境外源
"""
import json
import os
import re
import urllib.error
import urllib.request
from typing import Dict, List, Optional
from urllib.parse import urlparse

TIMEOUT = 15             # 秒。要网页正文会慢一些；再慢就放弃，不能拖住整轮对话
MAX_RESULTS = 5
SNIPPET_CAP = 400        # 每条摘要最多留多少字
CONTENT_CAP = 8000       # 每个网页正文最多留多少字（事实核对用）
BOCHA_URL = "https://api.bochaai.com/v1/web-search"
TAVILY_URL = "https://api.tavily.com/search"

# 找官方一手来源时限定这些域名（Tavily 的 include_domains）。政府网站的收录可能会漏，
# 所以这一路搜索是「补充」而不是替代：捞到就是一手来源，捞不到就退回普通搜索，
# 由 grounding 把来源标成媒体报道，而不是硬说成官方。
OFFICIAL_HINTS = [
    "gov.cn", "mohrss.gov.cn", "scs.gov.cn", "moe.gov.cn",
    "neea.edu.cn", "chsi.com.cn", "edu.cn",
]

OVERSEAS = {"tavily"}    # 搜索词会出境的源


def _provider() -> str:
    """当前生效的搜索源；没有可用的返回空串。"""
    want = os.environ.get("SEARCH_PROVIDER", "").strip().lower()
    have = {
        "bocha": bool(os.environ.get("BOCHA_API_KEY")),
        "tavily": bool(os.environ.get("TAVILY_API_KEY")),
    }
    overseas_ok = os.environ.get("ALLOW_OVERSEAS_SEARCH", "").lower() in ("1", "true", "yes")

    def usable(p: str) -> bool:
        return have.get(p, False) and (p not in OVERSEAS or overseas_ok)

    if want:
        return want if usable(want) else ""
    for p in ("bocha", "tavily"):
        if usable(p):
            return p
    return ""


def configured() -> bool:
    return bool(_provider())


def _clean_query(q: str) -> str:
    q = re.sub(r"〔[^〕]*〕", " ", q or "")          # 脱敏占位符不外发
    q = re.sub(r"\s+", " ", q).strip()
    return q[:100]


def _safe_url(u: str) -> str:
    try:
        p = urlparse(u or "")
    except Exception:
        return ""
    return u if p.scheme in ("http", "https") and p.netloc else ""


def _text(v, cap: int) -> str:
    t = re.sub(r"\s+", " ", str(v or "")).strip()
    return t if len(t) <= cap else t[:cap] + "…"


def _body(v) -> str:
    """网页正文，用于事实核对。保留换行，压掉多余空白，截到 CONTENT_CAP。"""
    t = re.sub(r"[ \t　]+", " ", str(v or ""))
    t = re.sub(r"\n\s*\n+", "\n", t).strip()
    return t[:CONTENT_CAP]


def _post_json(url: str, key: str, payload: dict) -> dict:
    req = urllib.request.Request(
        url, data=json.dumps(payload).encode("utf-8"), method="POST",
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    with urllib.request.urlopen(req, timeout=TIMEOUT) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _search_bocha(query: str, count: int) -> List[Dict[str, str]]:
    data = _post_json(BOCHA_URL, os.environ["BOCHA_API_KEY"],
                      {"query": query, "summary": True, "count": count})
    # 兼容 {data: {webPages: {value: [...]}}} 和直接 {webPages: ...} 两种外层
    root = data.get("data") if isinstance(data.get("data"), dict) else data
    items = ((root.get("webPages") or {}).get("value")) or []
    out = []
    for it in items:
        url = _safe_url(it.get("url"))
        if not url:
            continue
        out.append({
            "title": _text(it.get("name"), 80),
            "url": url,
            "site": _text(it.get("siteName") or urlparse(url).netloc, 40),
            "snippet": _text(it.get("summary") or it.get("snippet"), SNIPPET_CAP),
            "content": _body((it.get("summary") or "") + "\n" + (it.get("snippet") or "")),
            "date": _text(it.get("datePublished") or it.get("dateLastCrawled"), 20)[:10],
        })
    return out


def _search_tavily(query: str, count: int, include_domains: Optional[List[str]] = None) -> List[Dict[str, str]]:
    # include_raw_content：要网页正文。事实核对要拿模型摘的原文片段去对照，只有摘要的话，
    # 很多日期根本不在摘要里，会把「网页里明明有」误判成找不到。
    # include_domains：研究流程里专门用来找官方一手来源（见 web_search.OFFICIAL_HINTS）。
    payload: Dict[str, object] = {"query": query, "max_results": count, "search_depth": "basic",
                                  "include_answer": False, "include_raw_content": True}
    if include_domains:
        payload["include_domains"] = list(include_domains)
    data = _post_json(TAVILY_URL, os.environ["TAVILY_API_KEY"], payload)
    out = []
    for it in data.get("results") or []:
        url = _safe_url(it.get("url"))
        if not url:
            continue
        out.append({
            "title": _text(it.get("title"), 80),
            "url": url,
            "site": _text(urlparse(url).netloc, 40),
            "snippet": _text(it.get("content"), SNIPPET_CAP),
            "content": _body(it.get("raw_content") or it.get("content")),
            "date": _text(it.get("published_date"), 20)[:10],
        })
    return out


_BACKENDS = {"bocha": _search_bocha, "tavily": _search_tavily}


def search(query: str, count: int = MAX_RESULTS,
           include_domains: Optional[List[str]] = None) -> Dict[str, object]:
    """返回 {ok, results, error}。出错不抛异常——搜索失败不应该让整轮对话失败，
    上层照样让模型凭常识回答，并如实说没搜到。

    include_domains 只在服务商支持时生效；不支持的服务忽略这个参数，退化成普通搜索，
    不会报错。"""
    q = _clean_query(query)
    if not q:
        return {"ok": False, "results": [], "error": "搜索词为空"}
    provider = _provider()
    if not provider:
        return {"ok": False, "results": [], "error": "联网搜索未启用"}
    count = max(1, min(count, MAX_RESULTS))
    try:
        if provider == "tavily":
            results = _search_tavily(q, count, include_domains)
        else:
            results = _BACKENDS[provider](q, count)
    except urllib.error.HTTPError as e:
        return {"ok": False, "results": [], "error": f"搜索服务返回 {e.code}"}
    except Exception:
        return {"ok": False, "results": [], "error": "搜索服务暂时连不上"}
    return {"ok": True, "results": results[:count], "error": ""}
