"""漏斗统计：从阶段变化记录算转化、流失、每一步用时和每周投递 / 提交量。工作台「求职数据」「申请数据」页和对话快照共用。

口径：
- 求职漏斗从「已投递」算起，「想投」不算投递；留学从「已提交」算起，「选校中」「准备材料」不算
- 往回拖视为纠正：退回到前面某一轮时，之后走过的那几步作废，不算到过
- 「已结束」不进漏斗，只记这条是在哪一轮之后结束的
- 求职的笔试/测评可以跳过：直接从投递进一面的，也算过了笔试这一关（和看板一致）
- 留学的「面试」很多项目没有，不进漏斗，单独数收到面试的有几所
- 某一步的样本不到 MIN_SAMPLE 条时不给百分比（rate 为 None），只给人数，免得 1/1=100% 这种数字误导人
"""

from datetime import date, datetime, timedelta
from typing import Any, Dict, List, Optional, Tuple

CONFIG = {
    "job": {"funnel": ["applied", "test", "interview1", "interview2", "interview3", "hr", "offer"],
            "pre": {"wish"}, "interview": "interview1", "side": None, "offer": "offer"},
    "abroad": {"funnel": ["submitted", "admitted", "enrolled"],
               "pre": {"shortlist", "prep"}, "interview": None, "side": "interview", "offer": "admitted"},
}
MIN_SAMPLE = 5
WEEKS = 8


def _dt(s: Optional[str]) -> Optional[datetime]:
    if not s:
        return None
    try:
        d = datetime.fromisoformat(s)
    except ValueError:
        try:
            d = datetime.fromisoformat(s[:19])
        except ValueError:
            return None
    return d.astimezone().replace(tzinfo=None) if d.tzinfo else d


def _path(t: Dict[str, Any], logs: List[Dict[str, Any]], cfg: Dict[str, Any]) -> Tuple[List[Tuple[int, datetime]], bool]:
    """回放一条的阶段记录，得到有效路径 [(漏斗里第几轮, 进入时间)]，以及它现在是不是已结束。"""
    funnel, pre = cfg["funnel"], cfg["pre"]
    created = _dt(t.get("created_at")) or datetime.now()
    path: List[Tuple[int, datetime]] = []

    def enter(stage: str, at: datetime) -> None:
        if stage in pre:
            path.clear()          # 退回「想投」「选校中」：等于没投过，之后重新算
            return
        if stage not in funnel:
            return
        i = funnel.index(stage)
        while path and path[-1][0] > i:
            path.pop()            # 往回拖：后面那几步作废
        if not path or path[-1][0] < i:
            path.append((i, at))

    if logs and logs[0].get("from_stage"):
        enter(logs[0]["from_stage"], created)
    elif not logs:
        enter(t["stage"], created)
    for l in logs:
        if l["to_stage"] != "closed":
            enter(l["to_stage"], _dt(l.get("at")) or created)
    # 以当前阶段为准兜底：记录缺了几条时，路径也要走到当前这一轮
    if t["stage"] != "closed":
        enter(t["stage"], _dt(t.get("updated_at")) or created)
    return path, t["stage"] == "closed"


def _rate(a: int, b: int) -> Optional[float]:
    return round(a / b, 3) if b >= MIN_SAMPLE else None


def compute(ws: Dict[str, Any], today: Optional[date] = None) -> Dict[str, Any]:
    today = today or date.today()
    kind = ws.get("kind") if ws.get("kind") in CONFIG else "job"
    cfg = CONFIG[kind]
    funnel = cfg["funnel"]
    labels = {s["id"]: s["label"] for s in ws.get("stages", [])}
    logs_by: Dict[str, List[Dict[str, Any]]] = {}
    for l in ws.get("stage_log", []):
        logs_by.setdefault(l["target_id"], []).append(l)
    for ls in logs_by.values():
        ls.sort(key=lambda l: l.get("at") or "")

    rows = []
    for t in ws.get("targets", []):
        path, closed = _path(t, logs_by.get(t["id"], []), cfg)
        if path:
            rows.append((t, path, closed))
    n = len(rows)
    last = len(funnel) - 1
    reached = [sum(1 for _, p, _ in rows if p[-1][0] >= i) for i in range(len(funnel))]
    ended = [sum(1 for _, p, c in rows if c and p[-1][0] == i) for i in range(len(funnel))]

    steps = []
    for i, sid in enumerate(funnel):
        days = []
        for _, p, _ in rows:
            for k, (idx, at) in enumerate(p[:-1]):
                if idx == i:
                    d = (p[k + 1][1] - at).total_seconds() / 86400
                    if d >= 0:
                        days.append(d)
        passed = reached[i + 1] if i < last else None
        steps.append({
            "id": sid, "label": labels.get(sid, sid), "reached": reached[i],
            "passed": passed, "rate": _rate(passed, reached[i]) if passed is not None else None,
            "ended": ended[i],
            "avg_days": round(sum(days) / len(days), 1) if days else None, "days_n": len(days),
        })

    if cfg["side"]:
        # 留学的面试不进漏斗：数现在在面试、或者记录里进过面试的
        side = cfg["side"]
        interviews = sum(1 for t, _, _ in rows if t["stage"] == side
                         or any(l["to_stage"] == side for l in logs_by.get(t["id"], [])))
    else:
        interviews = reached[funnel.index(cfg["interview"])]
    offers = reached[funnel.index(cfg["offer"])]

    monday = today - timedelta(days=today.weekday())
    starts = [monday - timedelta(weeks=k) for k in range(WEEKS - 1, -1, -1)]
    weekly = {s: 0 for s in starts}
    for _, p, _ in rows:
        d = p[0][1].date()
        wk = d - timedelta(days=d.weekday())
        if wk in weekly:
            weekly[wk] += 1

    stuck = max(range(len(funnel)), key=lambda i: ended[i]) if any(ended) else None
    return {
        "kind": kind,
        "total": n,
        "active": sum(1 for _, p, c in rows if not c and p[-1][0] < last),
        "closed": sum(1 for _, _, c in rows if c),
        "interviews": interviews,
        "offers": offers,
        "enrolled": reached[last] if kind == "abroad" else None,
        "interview_rate": _rate(interviews, n),
        "offer_rate": _rate(offers, n),
        "steps": steps,
        "stuck": {"id": funnel[stuck], "label": labels.get(funnel[stuck], funnel[stuck]), "count": ended[stuck]}
                 if stuck is not None else None,
        "weekly": [{"week": s.isoformat(), "count": weekly[s]} for s in starts],
        "min_sample": MIN_SAMPLE,
    }


def summary_line(ws: Dict[str, Any]) -> str:
    """给对话快照用的一行数据摘要。太少时不给，免得模型拿两三条数据下结论。"""
    s = compute(ws)
    if s["total"] < 3:
        return ""
    if s["kind"] == "abroad":
        line = (f"申请数据：已提交 {s['total']} 所，收到面试 {s['interviews']} 所，录取 {s['offers']} 所，"
                f"已确认入读 {s['enrolled']} 所，已结束 {s['closed']} 所")
    else:
        line = (f"求职数据：投递 {s['total']} 条，进入面试 {s['interviews']} 条，拿到 offer {s['offers']} 条，"
                f"已结束 {s['closed']} 条")
    if s["stuck"] and s["stuck"]["count"] >= 2:
        line += f"；结束得最多的是「{s['stuck']['label']}」这一轮（{s['stuck']['count']} 条）"
    return line
