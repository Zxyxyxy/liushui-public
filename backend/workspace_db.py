"""工作台：求职（以及之后的留学）项目管理的数据层。

结构是通用的：一个用户有若干工作台（第一期只用「秋招」一个），每个工作台下挂多条「目标」：
  求职：公司 × 岗位；留学：学校 × 项目。阶段列表按 kind 不同而不同。
每条目标有阶段、关键日期、待办，以及关联的工具结果和对话。

工具结果（outputs）由服务端在工具运行成功时自动写入，不依赖前端；
它先挂在工作台上，之后（阶段三）再按公司岗位归到某条目标。
"""

import json
import uuid
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from db import _conn

# 各类工作台的阶段。前后顺序就是看板的列顺序；最后两个是「结束」态
STAGES: Dict[str, List[Dict[str, str]]] = {
    "job": [
        {"id": "wish", "label": "想投"},
        {"id": "applied", "label": "已投递"},
        {"id": "test", "label": "笔试/测评"},
        {"id": "interview1", "label": "一面"},
        {"id": "interview2", "label": "二面"},
        {"id": "interview3", "label": "三面"},
        {"id": "hr", "label": "HR 面"},
        {"id": "offer", "label": "已拿 offer"},
        {"id": "closed", "label": "已结束"},
    ],
    "abroad": [
        {"id": "shortlist", "label": "选校中"},
        {"id": "prep", "label": "准备材料"},
        {"id": "submitted", "label": "已提交"},
        {"id": "interview", "label": "面试"},
        {"id": "admitted", "label": "录取"},        # 含有条件录取，条件写在备注里
        {"id": "enrolled", "label": "已确认入读"},  # 交了押金：多拿几个录取是常态，最后去哪要单独标出来
        {"id": "closed", "label": "已结束"},        # 被拒、撤回、放弃
    ],
}
# 留学申请的选校梯度
TIERS = ("reach", "match", "safety")
# 新建留学申请时自动生成的材料清单，用不上的可以删
CHECKLIST = ("个人陈述（PS）", "简历（CV）", "推荐信", "成绩单", "语言成绩")
DEFAULT_WS = {
    "job": {"name": "秋招工作台", "icon": "💼", "goal": "拿到一份满意的 offer"},
    "abroad": {"name": "留学申请工作台", "icon": "🌏", "goal": "拿到心仪项目的录取"},
}
TEXT_CAP = 2000        # 备注、JD 等长文本的上限
OUTPUT_CAP = 60000     # 一份工具结果最多存多长


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _id() -> str:
    return uuid.uuid4().hex[:16]


def init_tables() -> None:
    with _conn() as c:
        c.executescript("""
            CREATE TABLE IF NOT EXISTS workspaces (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                kind        TEXT NOT NULL,          -- job / abroad
                name        TEXT NOT NULL,
                icon        TEXT NOT NULL DEFAULT '',
                goal        TEXT NOT NULL DEFAULT '',
                deadline    TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_ws_user ON workspaces(user_id);

            -- 一条目标：求职是公司 × 岗位，留学是学校 × 项目
            CREATE TABLE IF NOT EXISTS ws_targets (
                id          TEXT PRIMARY KEY,
                ws_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                org         TEXT NOT NULL,          -- 公司 / 学校
                role        TEXT NOT NULL DEFAULT '', -- 岗位 / 项目
                city        TEXT NOT NULL DEFAULT '',
                channel     TEXT NOT NULL DEFAULT '', -- 官网、内推、招聘 App……
                stage       TEXT NOT NULL,
                jd          TEXT NOT NULL DEFAULT '',
                note        TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_targets_ws ON ws_targets(ws_id);

            -- 关键日期：截止、笔试、面试……
            CREATE TABLE IF NOT EXISTS ws_events (
                id          TEXT PRIMARY KEY,
                ws_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                target_id   TEXT REFERENCES ws_targets(id) ON DELETE CASCADE,
                title       TEXT NOT NULL,
                date        TEXT NOT NULL,          -- YYYY-MM-DD，可带 HH:MM
                kind        TEXT NOT NULL DEFAULT 'other', -- deadline / test / interview / other
                done        INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_events_ws ON ws_events(ws_id, date);

            CREATE TABLE IF NOT EXISTS ws_todos (
                id          TEXT PRIMARY KEY,
                ws_id       TEXT NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
                target_id   TEXT REFERENCES ws_targets(id) ON DELETE SET NULL,
                text        TEXT NOT NULL,
                due         TEXT NOT NULL DEFAULT '',
                done        INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_todos_ws ON ws_todos(ws_id);

            -- 工具结果：服务端在运行成功时写入
            CREATE TABLE IF NOT EXISTS ws_outputs (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                ws_id       TEXT REFERENCES workspaces(id) ON DELETE SET NULL,
                target_id   TEXT REFERENCES ws_targets(id) ON DELETE SET NULL,
                skill_id    TEXT NOT NULL,
                skill_name  TEXT NOT NULL,
                credits     INTEGER NOT NULL DEFAULT 0,
                thread_id   TEXT,                   -- 结果出自哪个对话，点了能回去接着聊
                hint        TEXT NOT NULL DEFAULT '', -- 表单里填的公司岗位等，给阶段三归类用
                output      TEXT NOT NULL,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_outputs_user ON ws_outputs(user_id, created_at);
            CREATE INDEX IF NOT EXISTS idx_outputs_ws ON ws_outputs(ws_id);
        """)
        c.executescript("""
            -- 阶段变化记录：投递详情里的进度时间线，也是之后算漏斗（笔试通过率、面试转化率）的依据
            CREATE TABLE IF NOT EXISTS ws_stage_log (
                id          TEXT PRIMARY KEY,
                target_id   TEXT NOT NULL REFERENCES ws_targets(id) ON DELETE CASCADE,
                from_stage  TEXT NOT NULL DEFAULT '',
                to_stage    TEXT NOT NULL,
                at          TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_stage_log_target ON ws_stage_log(target_id, at);

            -- 投递关联的对话：用户确认过进度的对话挂在投递下，点了能回去接着聊
            CREATE TABLE IF NOT EXISTS ws_target_threads (
                target_id   TEXT NOT NULL REFERENCES ws_targets(id) ON DELETE CASCADE,
                thread_id   TEXT NOT NULL,
                summary     TEXT NOT NULL DEFAULT '',   -- 一句话：这个对话做到哪了
                updated_at  TEXT NOT NULL,
                PRIMARY KEY (target_id, thread_id)
            );
        """)
        cols = {r[1] for r in c.execute("PRAGMA table_info(ws_targets)")}
        if "resume_output_id" not in cols:
            # 这条投递用的哪版简历：指向工作台里的一份简历类工具结果
            c.execute("ALTER TABLE ws_targets ADD COLUMN resume_output_id TEXT "
                      "REFERENCES ws_outputs(id) ON DELETE SET NULL")
        if "tier" not in cols:
            # 留学申请的选校梯度：reach 冲刺 / match 主申 / safety 保底；求职投递不用，留空
            c.execute("ALTER TABLE ws_targets ADD COLUMN tier TEXT NOT NULL DEFAULT ''")
        # 「谈 offer」阶段已删除：还停在这个阶段的投递归到「已拿 offer」，阶段记录同步改写
        c.execute("UPDATE ws_targets SET stage='offer' WHERE stage='offer_talk'")
        c.execute("UPDATE ws_stage_log SET to_stage='offer' WHERE to_stage='offer_talk'")
        c.execute("UPDATE ws_stage_log SET from_stage='offer' WHERE from_stage='offer_talk'")
        _merge_duplicates(c)
        # 每个用户每类只自动建一个：首页和工作台同时打开时会并发请求，靠唯一索引兜住
        c.execute("CREATE UNIQUE INDEX IF NOT EXISTS uq_ws_user_kind ON workspaces(user_id, kind)")


def _merge_duplicates(c) -> None:
    """早期并发请求可能给同一用户建了两个同类工作台：把后建的里面的东西挪到最早那个，再删掉后建的。"""
    dups = c.execute("SELECT user_id, kind FROM workspaces GROUP BY user_id, kind HAVING COUNT(*) > 1").fetchall()
    for user_id, kind in dups:
        ids = [r[0] for r in c.execute("SELECT id FROM workspaces WHERE user_id=? AND kind=? ORDER BY created_at",
                                       (user_id, kind))]
        keep, extra = ids[0], ids[1:]
        for wid in extra:
            for table in ("ws_targets", "ws_events", "ws_todos", "ws_outputs"):
                c.execute(f"UPDATE {table} SET ws_id=? WHERE ws_id=?", (keep, wid))
            c.execute("DELETE FROM workspaces WHERE id=?", (wid,))


# ── 工作台 ─────────────────────────────────────────────────────────────────

def ensure_default(user_id: str, kind: str = "job") -> str:
    """每个用户第一次用工作台时，自动建一个对应类型的工作台。返回它的 id。"""
    with _conn() as c:
        row = c.execute("SELECT id FROM workspaces WHERE user_id=? AND kind=? ORDER BY created_at LIMIT 1",
                        (user_id, kind)).fetchone()
        if row:
            return row["id"]
        d = DEFAULT_WS[kind]
        now = _now()
        # 并发时另一个请求可能刚建好：唯一索引让这里静默跳过，再取已有的那个
        c.execute("INSERT OR IGNORE INTO workspaces VALUES (?,?,?,?,?,?,?,?,?)",
                  (_id(), user_id, kind, d["name"], d["icon"], d["goal"], "", now, now))
        return c.execute("SELECT id FROM workspaces WHERE user_id=? AND kind=?", (user_id, kind)).fetchone()["id"]


def find_workspace(user_id: str, kind: str) -> Optional[str]:
    """这个用户这一类的工作台 id，没有就返回 None。和 ensure_default 不同，不会顺手建一个。"""
    with _conn() as c:
        row = c.execute("SELECT id FROM workspaces WHERE user_id=? AND kind=? ORDER BY created_at LIMIT 1",
                        (user_id, kind)).fetchone()
        return row["id"] if row else None


def _own_ws(c, user_id: str, ws_id: str) -> Optional[Dict[str, Any]]:
    row = c.execute("SELECT * FROM workspaces WHERE id=? AND user_id=?", (ws_id, user_id)).fetchone()
    return dict(row) if row else None


def list_workspaces(user_id: str) -> List[Dict[str, Any]]:
    ensure_default(user_id, "job")
    with _conn() as c:
        rows = c.execute("SELECT * FROM workspaces WHERE user_id=? ORDER BY created_at", (user_id,)).fetchall()
        out = []
        for r in rows:
            w = dict(r)
            w["target_count"] = c.execute("SELECT COUNT(*) FROM ws_targets WHERE ws_id=?", (w["id"],)).fetchone()[0]
            w["open_todos"] = c.execute("SELECT COUNT(*) FROM ws_todos WHERE ws_id=? AND done=0", (w["id"],)).fetchone()[0]
            out.append(w)
        return out


def get_workspace(user_id: str, ws_id: str) -> Optional[Dict[str, Any]]:
    """工作台全量：目标、日期、待办、工具结果（不含结果正文，正文单独取）。"""
    with _conn() as c:
        w = _own_ws(c, user_id, ws_id)
        if not w:
            return None
        w["stages"] = STAGES[w["kind"]]
        w["targets"] = [dict(r) for r in c.execute(
            "SELECT * FROM ws_targets WHERE ws_id=? ORDER BY updated_at DESC", (ws_id,))]
        w["threads"] = [dict(r) for r in c.execute(
            "SELECT l.target_id, l.thread_id, l.summary, l.updated_at, th.title FROM ws_target_threads l "
            "JOIN ws_targets t ON t.id=l.target_id JOIN chat_threads th ON th.id=l.thread_id "
            "WHERE t.ws_id=? AND th.user_id=? ORDER BY l.updated_at DESC", (ws_id, user_id))]
        w["stage_log"] = [dict(r) for r in c.execute(
            "SELECT l.* FROM ws_stage_log l JOIN ws_targets t ON t.id=l.target_id "
            "WHERE t.ws_id=? ORDER BY l.at", (ws_id,))]
        w["events"] = [dict(r) | {"done": bool(r["done"])} for r in c.execute(
            "SELECT * FROM ws_events WHERE ws_id=? ORDER BY date", (ws_id,))]
        w["todos"] = [dict(r) | {"done": bool(r["done"])} for r in c.execute(
            "SELECT * FROM ws_todos WHERE ws_id=? ORDER BY done, created_at DESC", (ws_id,))]
        w["outputs"] = [dict(r) for r in c.execute(
            "SELECT id, ws_id, target_id, skill_id, skill_name, credits, thread_id, hint, created_at, "
            "substr(output, 1, 160) AS preview FROM ws_outputs WHERE ws_id=? ORDER BY created_at DESC",
            (ws_id,))]
        return w


def update_workspace(user_id: str, ws_id: str, fields: Dict[str, Any]) -> bool:
    allowed = {k: str(v)[:200] for k, v in fields.items() if k in ("name", "goal", "deadline", "icon")}
    if not allowed:
        return False
    with _conn() as c:
        if not _own_ws(c, user_id, ws_id):
            return False
        sets = ", ".join(f"{k}=?" for k in allowed)
        c.execute(f"UPDATE workspaces SET {sets}, updated_at=? WHERE id=?", (*allowed.values(), _now(), ws_id))
        return True


def delete_workspace(user_id: str, ws_id: str) -> bool:
    with _conn() as c:
        if not _own_ws(c, user_id, ws_id):
            return False
        c.execute("DELETE FROM ws_outputs WHERE ws_id=? AND user_id=?", (ws_id, user_id))
        c.execute("DELETE FROM workspaces WHERE id=?", (ws_id,))
        return True


# ── 目标（投递） ────────────────────────────────────────────────────────────

def _clean_target(fields: Dict[str, Any], kind: str) -> Dict[str, str]:
    stage_ids = {s["id"] for s in STAGES[kind]}
    out = {}
    for k in ("org", "role", "city", "channel"):
        if k in fields:
            out[k] = str(fields[k] or "").strip()[:100]
    for k in ("jd", "note"):
        if k in fields:
            out[k] = str(fields[k] or "").strip()[:TEXT_CAP]
    if "stage" in fields and fields["stage"] in stage_ids:
        out["stage"] = fields["stage"]
    if "tier" in fields:
        out["tier"] = fields["tier"] if kind == "abroad" and fields["tier"] in TIERS else ""
    return out


def add_target(user_id: str, ws_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with _conn() as c:
        w = _own_ws(c, user_id, ws_id)
        if not w:
            return None
        f = _clean_target(fields, w["kind"])
        if not f.get("org"):
            return None
        tid, now = _id(), _now()
        f.setdefault("stage", STAGES[w["kind"]][0]["id"])
        c.execute("INSERT INTO ws_targets(id, ws_id, org, role, city, channel, stage, jd, note, tier, created_at, updated_at) "
                  "VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
                  (tid, ws_id, f["org"], f.get("role", ""), f.get("city", ""), f.get("channel", ""),
                   f["stage"], f.get("jd", ""), f.get("note", ""), f.get("tier", ""), now, now))
        _log_stage(c, tid, "", f["stage"])
        if w["kind"] == "abroad":
            for text in CHECKLIST:
                c.execute("INSERT INTO ws_todos VALUES (?,?,?,?,?,?,?)", (_id(), ws_id, tid, text, "", 0, now))
        c.execute("UPDATE workspaces SET updated_at=? WHERE id=?", (now, ws_id))
        return dict(c.execute("SELECT * FROM ws_targets WHERE id=?", (tid,)).fetchone())


def _log_stage(c, target_id: str, from_stage: str, to_stage: str) -> None:
    c.execute("INSERT INTO ws_stage_log VALUES (?,?,?,?,?)", (_id(), target_id, from_stage, to_stage, _now()))


def _own_target(c, user_id: str, target_id: str):
    return c.execute("SELECT t.*, w.kind FROM ws_targets t JOIN workspaces w ON w.id=t.ws_id "
                     "WHERE t.id=? AND w.user_id=?", (target_id, user_id)).fetchone()


def update_target(user_id: str, target_id: str, fields: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    with _conn() as c:
        t = _own_target(c, user_id, target_id)
        if not t:
            return None
        f = _clean_target(fields, t["kind"])
        if "org" in f and not f["org"]:
            del f["org"]
        if "resume_output_id" in fields:
            rid = fields["resume_output_id"] or None
            if rid and not c.execute("SELECT 1 FROM ws_outputs WHERE id=? AND user_id=?", (rid, user_id)).fetchone():
                return None
            f["resume_output_id"] = rid
        if "stage" in f and f["stage"] != t["stage"]:
            _log_stage(c, target_id, t["stage"], f["stage"])
        if f:
            sets = ", ".join(f"{k}=?" for k in f)
            c.execute(f"UPDATE ws_targets SET {sets}, updated_at=? WHERE id=?", (*f.values(), _now(), target_id))
        return dict(c.execute("SELECT * FROM ws_targets WHERE id=?", (target_id,)).fetchone())


def delete_target(user_id: str, target_id: str) -> bool:
    with _conn() as c:
        t = _own_target(c, user_id, target_id)
        if not t:
            return False
        if t["kind"] == "abroad":
            # 自动生成的材料清单跟着申请一起删：留着会变成一堆分不清是哪所学校的「推荐信」
            q = ",".join("?" * len(CHECKLIST))
            c.execute(f"DELETE FROM ws_todos WHERE target_id=? AND text IN ({q})", (target_id, *CHECKLIST))
        c.execute("DELETE FROM ws_targets WHERE id=?", (target_id,))
        return True


def link_thread(user_id: str, target_id: str, thread_id: str, summary: str = "") -> bool:
    """把一个对话挂到投递下。两边都必须是这个用户自己的。"""
    with _conn() as c:
        if not _own_target(c, user_id, target_id):
            return False
        if not c.execute("SELECT 1 FROM chat_threads WHERE id=? AND user_id=?", (thread_id, user_id)).fetchone():
            return False
        c.execute("INSERT INTO ws_target_threads VALUES (?,?,?,?) ON CONFLICT(target_id, thread_id) "
                  "DO UPDATE SET updated_at=excluded.updated_at, "
                  "summary=CASE WHEN excluded.summary != '' THEN excluded.summary ELSE ws_target_threads.summary END",
                  (target_id, thread_id, (summary or "")[:120], _now()))
        return True


def set_thread_summary(user_id: str, thread_id: str, summary: str) -> None:
    """更新一个对话在所有关联投递下的「做到哪了」。"""
    with _conn() as c:
        c.execute("UPDATE ws_target_threads SET summary=?, updated_at=? WHERE thread_id=? AND target_id IN "
                  "(SELECT t.id FROM ws_targets t JOIN workspaces w ON w.id=t.ws_id WHERE w.user_id=?)",
                  ((summary or "")[:120], _now(), thread_id, user_id))


def threads_of_user(user_id: str) -> List[str]:
    with _conn() as c:
        return [r[0] for r in c.execute(
            "SELECT DISTINCT l.thread_id FROM ws_target_threads l JOIN ws_targets t ON t.id=l.target_id "
            "JOIN workspaces w ON w.id=t.ws_id WHERE w.user_id=?", (user_id,))]


# ── 关键日期 / 待办 ─────────────────────────────────────────────────────────

def _check_target(c, user_id: str, ws_id: str, target_id: Optional[str]) -> Optional[str]:
    if not target_id:
        return None
    t = _own_target(c, user_id, target_id)
    return target_id if t and t["ws_id"] == ws_id else None


def add_event(user_id: str, ws_id: str, title: str, date: str, kind: str = "other",
              target_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    title, date = (title or "").strip()[:100], (date or "").strip()[:16]
    if not title or not date:
        return None
    kind = kind if kind in ("deadline", "test", "interview", "other") else "other"
    with _conn() as c:
        if not _own_ws(c, user_id, ws_id):
            return None
        eid = _id()
        c.execute("INSERT INTO ws_events VALUES (?,?,?,?,?,?,?,?)",
                  (eid, ws_id, _check_target(c, user_id, ws_id, target_id), title, date, kind, 0, _now()))
        return dict(c.execute("SELECT * FROM ws_events WHERE id=?", (eid,)).fetchone())


def update_event(user_id: str, event_id: str, fields: Dict[str, Any]) -> bool:
    with _conn() as c:
        row = c.execute("SELECT e.id FROM ws_events e JOIN workspaces w ON w.id=e.ws_id WHERE e.id=? AND w.user_id=?",
                        (event_id, user_id)).fetchone()
        if not row:
            return False
        if "done" in fields:
            c.execute("UPDATE ws_events SET done=? WHERE id=?", (1 if fields["done"] else 0, event_id))
        if fields.get("title"):
            c.execute("UPDATE ws_events SET title=? WHERE id=?", (str(fields["title"])[:100], event_id))
        if fields.get("date"):
            c.execute("UPDATE ws_events SET date=? WHERE id=?", (str(fields["date"])[:16], event_id))
        return True


def delete_event(user_id: str, event_id: str) -> bool:
    with _conn() as c:
        n = c.execute("DELETE FROM ws_events WHERE id=? AND ws_id IN (SELECT id FROM workspaces WHERE user_id=?)",
                      (event_id, user_id)).rowcount
        return n > 0


def add_todo(user_id: str, ws_id: str, text: str, due: str = "",
             target_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    text = (text or "").strip()[:200]
    if not text:
        return None
    with _conn() as c:
        if not _own_ws(c, user_id, ws_id):
            return None
        tid = _id()
        c.execute("INSERT INTO ws_todos VALUES (?,?,?,?,?,?,?)",
                  (tid, ws_id, _check_target(c, user_id, ws_id, target_id), text, (due or "")[:16], 0, _now()))
        row = dict(c.execute("SELECT * FROM ws_todos WHERE id=?", (tid,)).fetchone())
        return row | {"done": False}


def update_todo(user_id: str, todo_id: str, fields: Dict[str, Any]) -> bool:
    with _conn() as c:
        row = c.execute("SELECT t.id FROM ws_todos t JOIN workspaces w ON w.id=t.ws_id WHERE t.id=? AND w.user_id=?",
                        (todo_id, user_id)).fetchone()
        if not row:
            return False
        if "done" in fields:
            c.execute("UPDATE ws_todos SET done=? WHERE id=?", (1 if fields["done"] else 0, todo_id))
        if fields.get("text"):
            c.execute("UPDATE ws_todos SET text=? WHERE id=?", (str(fields["text"])[:200], todo_id))
        if "due" in fields:
            c.execute("UPDATE ws_todos SET due=? WHERE id=?", (str(fields["due"] or "")[:16], todo_id))
        return True


def delete_todo(user_id: str, todo_id: str) -> bool:
    with _conn() as c:
        n = c.execute("DELETE FROM ws_todos WHERE id=? AND ws_id IN (SELECT id FROM workspaces WHERE user_id=?)",
                      (todo_id, user_id)).rowcount
        return n > 0


def upcoming(user_id: str, today: str, days: int = 7) -> Dict[str, Any]:
    """这周要做的：未来 days 天的日程和到期待办，外加已经过期但还没处理的。按日期排。"""
    from datetime import date, timedelta
    end = (date.fromisoformat(today) + timedelta(days=days)).isoformat()
    with _conn() as c:
        ws_ids = [r[0] for r in c.execute("SELECT id FROM workspaces WHERE user_id=?", (user_id,))]
        if not ws_ids:
            return {"items": [], "overdue": 0}
        q = ",".join("?" * len(ws_ids))
        orgs = {r[0]: (r[1], r[2]) for r in c.execute(
            f"SELECT id, org, role FROM ws_targets WHERE ws_id IN ({q})", ws_ids)}
        items = []
        for r in c.execute(f"SELECT * FROM ws_events WHERE ws_id IN ({q}) AND done=0 AND substr(date,1,10) <= ? "
                           "ORDER BY date", (*ws_ids, end)):
            org = orgs.get(r["target_id"])
            items.append({"type": "event", "id": r["id"], "ws_id": r["ws_id"], "title": r["title"],
                          "date": r["date"][:10], "kind": r["kind"], "target_id": r["target_id"],
                          "org": org[0] if org else "", "role": org[1] if org else ""})
        for r in c.execute(f"SELECT * FROM ws_todos WHERE ws_id IN ({q}) AND done=0 AND due != '' "
                           "AND substr(due,1,10) <= ? ORDER BY due", (*ws_ids, end)):
            org = orgs.get(r["target_id"])
            items.append({"type": "todo", "id": r["id"], "ws_id": r["ws_id"], "title": r["text"],
                          "date": r["due"][:10], "kind": "todo", "target_id": r["target_id"],
                          "org": org[0] if org else "", "role": org[1] if org else ""})
    items.sort(key=lambda x: x["date"])
    for it in items:
        it["overdue"] = it["date"] < today
    return {"items": items, "overdue": sum(1 for x in items if x["overdue"])}


# ── 工具结果 ────────────────────────────────────────────────────────────────

# 每个工具里「公司 / 岗位 / 学校 / 项目」写在哪个字段：阶段三按这个归到对应投递
HINT_FIELDS = ("target_role", "position", "jd", "program", "role", "company", "target", "country", "major")
SCENE_TO_KIND = {"job": "job", "abroad": "abroad"}


def record_output(user_id: str, scene: str, skill_id: str, skill_name: str, credits: int,
                  output: str, thread_id: Optional[str], fields: Optional[Dict[str, str]] = None) -> str:
    """工具运行成功后由服务端调用。求职和留学类工具的结果自动进对应工作台；其他场景先不挂工作台。"""
    kind = SCENE_TO_KIND.get(scene)
    ws_id = ensure_default(user_id, kind) if kind else None   # 第一次用留学工具时顺手建好留学工作台
    hint = ""
    if fields:
        parts = [str(fields.get(k) or "").strip() for k in HINT_FIELDS]
        hint = " / ".join(p[:60] for p in parts if p and p != "（未提供）")[:200]
    oid = _id()
    with _conn() as c:
        c.execute("INSERT INTO ws_outputs VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  (oid, user_id, ws_id, None, skill_id, skill_name, int(credits or 0), thread_id,
                   hint, (output or "")[:OUTPUT_CAP], _now()))
        if ws_id:
            c.execute("UPDATE workspaces SET updated_at=? WHERE id=?", (_now(), ws_id))
    return oid


# 用户自己上传或粘贴的原文（求职是简历，留学是文书）：和工具结果存在同一张表里，
# 绑定投递 / 申请、预填表单、工作台展示都直接复用。
# 只存解析出来的文字，不依赖上传文件（上传文件到期会被清理），所以不会失效。
RESUME_SOURCE = "resume-source"
DOC_SOURCE = {"job": RESUME_SOURCE, "abroad": "essay-source"}


def add_doc_source(user_id: str, name: str, text: str, kind: str = "job") -> Dict[str, Any]:
    ws_id = ensure_default(user_id, kind)
    oid, now = _id(), _now()
    name = (name or "").strip()[:40] or ("文书原文" if kind == "abroad" else "简历原文")
    source = DOC_SOURCE[kind]
    with _conn() as c:
        c.execute("INSERT INTO ws_outputs VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  (oid, user_id, ws_id, None, source, name, 0, None, "", text[:OUTPUT_CAP], now))
        c.execute("UPDATE workspaces SET updated_at=? WHERE id=?", (now, ws_id))
    return {"id": oid, "ws_id": ws_id, "target_id": None, "skill_id": source, "skill_name": name,
            "credits": 0, "thread_id": None, "hint": "", "created_at": now, "preview": text[:160]}


def latest_doc_source(user_id: str, kind: str = "job") -> Optional[Dict[str, Any]]:
    with _conn() as c:
        row = c.execute("SELECT * FROM ws_outputs WHERE user_id=? AND skill_id=? ORDER BY created_at DESC LIMIT 1",
                        (user_id, DOC_SOURCE[kind])).fetchone()
        return dict(row) if row else None


def list_outputs(user_id: str, limit: int = 50) -> List[Dict[str, Any]]:
    """所有工具结果（不分工作台），给「运行历史」用。"""
    with _conn() as c:
        return [dict(r) for r in c.execute(
            "SELECT id, ws_id, target_id, skill_id, skill_name, credits, thread_id, hint, created_at, "
            "substr(output, 1, 160) AS preview FROM ws_outputs WHERE user_id=? ORDER BY created_at DESC LIMIT ?",
            (user_id, limit))]


def get_output(user_id: str, output_id: str) -> Optional[Dict[str, Any]]:
    with _conn() as c:
        row = c.execute("SELECT * FROM ws_outputs WHERE id=? AND user_id=?", (output_id, user_id)).fetchone()
        return dict(row) if row else None


def update_output(user_id: str, output_id: str, fields: Dict[str, Any]) -> bool:
    """把一份结果挂到某条投递上（或取消挂接）。"""
    with _conn() as c:
        row = c.execute("SELECT * FROM ws_outputs WHERE id=? AND user_id=?", (output_id, user_id)).fetchone()
        if not row:
            return False
        if "target_id" in fields:
            tid = fields["target_id"] or None
            if tid:
                t = _own_target(c, user_id, tid)
                if not t:
                    return False
                c.execute("UPDATE ws_outputs SET target_id=?, ws_id=? WHERE id=?", (tid, t["ws_id"], output_id))
            else:
                c.execute("UPDATE ws_outputs SET target_id=NULL WHERE id=?", (output_id,))
        return True


def delete_output(user_id: str, output_id: str) -> bool:
    with _conn() as c:
        return c.execute("DELETE FROM ws_outputs WHERE id=? AND user_id=?", (output_id, user_id)).rowcount > 0


# ── 浏览器旧数据迁移 ─────────────────────────────────────────────────────────

DEMO_IDS = {"ws-autumn", "ws-abroad", "ws-course"}


def import_local(user_id: str, payload: Dict[str, Any]) -> Dict[str, int]:
    """把浏览器里用户自己保存过的记录搬到账号下。演示数据（固定 id 的三个工作台和里面的预置条目）不搬。

    旧版本地数据只有运行摘要，没有结果正文，所以搬过来的是一条「待办」或「运行记录」，不是完整结果。
    """
    ws_id = ensure_default(user_id, "job")
    demo_todo_ids = {f"t{i}" for i in range(1, 14)}
    demo_run_ids = {f"r{i}" for i in range(1, 11)}
    n_todos = n_runs = 0
    for w in (payload.get("workspaces") or [])[:10]:
        if not isinstance(w, dict):
            continue
        for t in (w.get("todos") or [])[:200]:
            if isinstance(t, dict) and t.get("id") not in demo_todo_ids and str(t.get("text") or "").strip():
                if add_todo(user_id, ws_id, str(t["text"]), str(t.get("due") or "")):
                    n_todos += 1
        for r in (w.get("runs") or [])[:200]:
            if isinstance(r, dict) and r.get("id") not in demo_run_ids:
                n_runs += _import_run(user_id, ws_id, r)
    for r in (payload.get("runs") or [])[:200]:
        if isinstance(r, dict) and r.get("id") not in demo_run_ids:
            n_runs += _import_run(user_id, ws_id, r)
    return {"todos": n_todos, "runs": n_runs}


def _import_run(user_id: str, ws_id: str, r: Dict[str, Any]) -> int:
    sid, name = str(r.get("toolId") or ""), str(r.get("toolName") or "")
    if not sid or not name:
        return 0
    with _conn() as c:
        # 同一个工具同一天的旧记录只搬一次（旧版会在全局历史和工作台里各记一条）
        date = str(r.get("date") or "")[:10]
        dup = c.execute("SELECT 1 FROM ws_outputs WHERE user_id=? AND skill_id=? AND substr(created_at,1,10)=? "
                        "AND hint='（从浏览器迁移）'", (user_id, sid, date)).fetchone()
        if dup:
            return 0
        created = (date + "T00:00:00+00:00") if len(date) == 10 else _now()
        c.execute("INSERT INTO ws_outputs VALUES (?,?,?,?,?,?,?,?,?,?,?)",
                  (_id(), user_id, ws_id, None, sid, name, int(r.get("credits") or 0), None,
                   "（从浏览器迁移）", f"旧版本地记录，只保留了摘要：{str(r.get('summary') or '')[:200]}", created))
    return 1
