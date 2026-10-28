"""把用户当前的求职 / 留学申请进度拼成一段简短的上下文，注入到每轮对话的 system prompt 里；
另外负责工具表单的工作台预填。

快照只给模型「导向」，不把全量数据塞进去：只显示进行中的（已结束的不显示），每条只有名称、阶段、
带了哪些材料、最近一个日程。每类最多 8 条、600 字。用户没开的那类工作台不出现。

JD、文书全文太长，不放快照；工具表单里引用某一条时，另外走 form_prefill 把它们带进去。
"""

from datetime import date
from typing import Any, Dict, List, Optional, Tuple

import workspace_db as W

SECTIONS = {
    "job": {
        "head": "【用户当前的求职进度，供参考；不要原文重复，用来理解背景和推荐工具】",
        "rule": "标了［已存 JD］［已绑简历］的投递，用户要对它用匹配度、面试题等求职工具时直接调用工具，"
                "参数里只写公司和岗位，简历、JD 参数留空，不要写任何占位说明；系统会从工作台带入完整内容。"
                "也不要再让用户粘贴。",
        "tags": (("已存 JD", "jd"), ("已绑简历", "resume_output_id")),
    },
    "abroad": {
        "head": "【用户当前的留学申请进度，供参考；不要原文重复，用来理解背景和推荐工具】",
        "rule": "标了［已绑文书］的申请，用户要对它用文书诊断、多校适配、去 AI 腔等留学工具时直接调用工具，"
                "参数里写学校和项目，文书参数留空，不要写任何占位说明；系统会从工作台带入完整文书。"
                "也不要再让用户粘贴。",
        "tags": (("已存项目要求", "jd"), ("已绑文书", "resume_output_id")),
    },
}
TIER_LABEL = {"reach": "冲刺", "match": "主申", "safety": "保底"}
EVENT_SHORT = {"interview": "🎤面试", "test": "📝笔试", "deadline": "⏰截止", "other": "📌"}
MAX_TARGETS = 8
MAX_CHARS = 600


def _section(user_id: str, kind: str, today: date) -> str:
    ws_id = W.find_workspace(user_id, kind)
    ws = W.get_workspace(user_id, ws_id) if ws_id else None
    if not ws:
        return ""
    active = [t for t in ws["targets"] if t["stage"] != "closed"][:MAX_TARGETS]
    if not active:
        return ""
    conf = SECTIONS[kind]
    labels = {s["id"]: s["label"] for s in ws["stages"]}
    # 每条的下一个未完成日程（最近一个）
    next_ev: Dict[str, Any] = {}
    for e in ws["events"]:
        if e.get("done") or not e.get("target_id"):
            continue
        tid = e["target_id"]
        if tid not in next_ev or e["date"] < next_ev[tid]["date"]:
            next_ev[tid] = e
    lines = [conf["head"]]
    if any(str(t.get(col) or "").strip() for t in active for _, col in conf["tags"]):
        lines.append(conf["rule"])   # 放在前面：后面的条目多了会被截断，这条规则不能丢
    try:
        import workspace_stats
        line = workspace_stats.summary_line(ws)
        if line:
            lines.append(line)
    except Exception:
        pass
    for t in active:
        line = f"- {t['org']}"
        if t.get("role"):
            line += f" · {t['role']}"
        extra = [labels.get(t["stage"], t["stage"])]
        if TIER_LABEL.get(t.get("tier") or ""):
            extra.append(TIER_LABEL[t["tier"]])
        line += f"（{'，'.join(extra)}）"
        line += "".join(f"［{x}］" for x, col in conf["tags"] if str(t.get(col) or "").strip())
        ev = next_ev.get(t["id"])
        if ev:
            d = (date.fromisoformat(ev["date"][:10]) - today).days
            when = "今天" if d == 0 else f"{d} 天后" if d > 0 else f"已过 {-d} 天"
            line += f" — 下一步：{EVENT_SHORT.get(ev['kind'], '📌')}{ev['title']} {when}"
        lines.append(line)
    return "\n".join(lines)[:MAX_CHARS]


def build(user_id: str) -> str:
    """返回可以直接追加到 system prompt 的字符串，或空字符串（没有数据）。"""
    today = date.today()
    return "\n\n".join(s for s in (_section(user_id, k, today) for k in SECTIONS) if s)


# 工具表单里能从工作台带入的字段
#   doc   绑定的那份材料：求职是简历，留学是文书
#   req   存下的要求原文：求职的 JD；留学的项目要求并进 program 一起带
#   label 「公司 · 岗位」/「学校 · 项目」
PREFILL = {
    "job": {"doc": ("resume", "background"), "req": ("jd",), "label": ("target_role", "position"), "noun": "简历"},
    "abroad": {"doc": ("essay", "text"), "req": (), "label": ("program", "target"), "noun": "文书"},
}
SHORT_JD = 80        # 模型自己往 JD 栏写的常常只是「字节 产品岗」，比工作台里存的短得多就换成完整的
SHORT_DOC = 200      # 不到这么多字的不可能是一份真简历 / 文书：多半是模型写的占位说明，换成绑定的那版


def form_prefill(user_id: str, field_keys: List[str], hint: str,
                 given: Optional[Dict[str, str]] = None, kind: str = "job") -> Tuple[Dict[str, str], str]:
    """工具表单：hint 对上工作台里唯一一条投递 / 申请时，把它绑定的材料、要求、名称带进表单。
    这条没绑材料、或者根本对不上时，材料栏用用户最近存的那份原文。
    已经有内容的字段不动（只写了占位说明、岗位名这类短内容的除外）。
    返回（补好的表单，来源说明，没带入就是空串）。"""
    import progress
    cfg = PREFILL.get(kind, PREFILL["job"])
    out = dict(given or {})
    keys = set(field_keys)
    t = progress.match_target(user_id, hint, kind) if hint else None
    src = []

    dk = next((k for k in cfg["doc"] if k in keys), None)
    if dk and len(out.get(dk, "").strip()) < SHORT_DOC:
        rid = (t or {}).get("resume_output_id")
        o = W.get_output(user_id, rid) if rid else None
        if not (o and o.get("output")):
            o = W.latest_doc_source(user_id, kind)   # 兜底：最近存的原文
        text = (o or {}).get("output") or ""
        if text and len(text) > len(out.get(dk, "").strip()):
            out[dk] = text[:8000]
            src.append(f"{cfg['noun']}「{o['skill_name']}」")

    if t:
        label = t["org"] + (f" · {t['role']}" if t.get("role") else "")
        req = (t.get("jd") or "").strip()
        for k in cfg["req"]:
            cur = out.get(k, "").strip()
            if req and k in keys and (not cur or (len(cur) < SHORT_JD and len(req) > len(cur))):
                out[k] = req[:4000]
                src.append(f"「{label}」的 JD")
        for k in cfg["label"]:
            if k in keys and not out.get(k, "").strip():
                if kind == "abroad" and k == "program" and req:
                    out[k] = f"{label}\n项目要求：{req[:1500]}"
                    src.append(f"「{label}」的项目要求")
                else:
                    out[k] = label
    return out, "、".join(src)
