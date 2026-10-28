"""
持久化存储层 — SQLite

数据库文件 liushui.db 与本脚本同目录（已加入 .gitignore）。
两张表：
  reviews(id, skill_id, user_id, nickname, rating, text, verified, created_at)
  runs   (id, skill_id, user_id, credits, status, summary, created_at)
"""

import json
import sqlite3
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

DB_PATH = Path(__file__).parent / "liushui.db"


def _conn() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")   # 并发写安全
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db() -> None:
    """建表（幂等）。服务启动时调用一次。"""
    with _conn() as conn:
        conn.executescript("""
            CREATE TABLE IF NOT EXISTS reviews (
                id          TEXT PRIMARY KEY,
                skill_id    TEXT NOT NULL,
                user_id     TEXT NOT NULL,
                nickname    TEXT NOT NULL,
                rating      INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
                text        TEXT NOT NULL,
                verified    INTEGER NOT NULL DEFAULT 0,
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_reviews_skill ON reviews(skill_id, created_at DESC);

            CREATE TABLE IF NOT EXISTS runs (
                id          TEXT PRIMARY KEY,
                skill_id    TEXT NOT NULL,
                user_id     TEXT NOT NULL,
                credits     INTEGER NOT NULL DEFAULT 0,
                status      TEXT NOT NULL DEFAULT 'success',
                summary     TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_runs_skill_user ON runs(skill_id, user_id);

            -- 账号：邮箱 + 密码，注册必须带邀请码（内测控规模、追渠道）
            CREATE TABLE IF NOT EXISTS users (
                id            TEXT PRIMARY KEY,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                nickname      TEXT NOT NULL,
                invite_code   TEXT NOT NULL,
                created_at    TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS invite_codes (
                code        TEXT PRIMARY KEY,
                max_uses    INTEGER NOT NULL DEFAULT 1,
                used_count  INTEGER NOT NULL DEFAULT 0,
                note        TEXT NOT NULL DEFAULT '',   -- 发给谁/哪个渠道，用来追踪来源
                created_at  TEXT NOT NULL
            );

            -- Agent 对话：threads 是会话，chat_messages 存每一条消息（含工具调用）
            CREATE TABLE IF NOT EXISTS chat_threads (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                title       TEXT NOT NULL DEFAULT '',
                created_at  TEXT NOT NULL,
                updated_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_threads_user ON chat_threads(user_id, updated_at DESC);

            CREATE TABLE IF NOT EXISTS chat_messages (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                thread_id   TEXT NOT NULL,
                payload     TEXT NOT NULL,   -- 一条 OpenAI 格式消息的 JSON
                created_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_chat_msgs_thread ON chat_messages(thread_id, id);

            -- 积分账本：只追加、不改不删。余额 = 该用户所有流水之和，没有单独存的余额，
            -- 不会出现「余额」和「流水」对不上。ref 是业务编号，同一用户同一 kind 下唯一，
            -- 重复提交（网络重试、连点）不会重复记账。
            CREATE TABLE IF NOT EXISTS ledger (
                id          INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id     TEXT NOT NULL,
                amount      INTEGER NOT NULL,          -- 正数入账，负数扣费
                kind        TEXT NOT NULL,             -- grant 发放 / spend 消耗 / refund 退款
                title       TEXT NOT NULL DEFAULT '',
                ref         TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                UNIQUE(user_id, kind, ref)
            );
            CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id, id DESC);

            -- 用户偏好。choose_variant=1：识别到同类备选工具时让我自己挑；0：直接用最推荐的那个
            CREATE TABLE IF NOT EXISTS user_prefs (
                user_id        TEXT PRIMARY KEY,
                choose_variant INTEGER NOT NULL DEFAULT 0
            );

            -- 上传文件：原件存磁盘（stored_name 是服务端生成的，不含用户输入），
            -- 提取出的文字存这里；到 expires_at 后原件和文字一起清掉
            CREATE TABLE IF NOT EXISTS uploads (
                id          TEXT PRIMARY KEY,
                user_id     TEXT NOT NULL,
                name        TEXT NOT NULL,       -- 展示用的文件名，已清洗，绝不参与路径拼接
                stored_name TEXT NOT NULL,
                kind        TEXT NOT NULL,       -- pdf / docx
                size        INTEGER NOT NULL,
                chars       INTEGER NOT NULL,
                truncated   INTEGER NOT NULL DEFAULT 0,
                text        TEXT NOT NULL,
                created_at  TEXT NOT NULL,
                expires_at  TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_uploads_user ON uploads(user_id, expires_at);
        """)
        # 老库补列：digest_off=1 表示用户取消了每日开屏卡片（AI 日报 + 当日日程）
        cols = {r["name"] for r in conn.execute("PRAGMA table_info(user_prefs)")}
        if "digest_off" not in cols:
            conn.execute("ALTER TABLE user_prefs ADD COLUMN digest_off INTEGER NOT NULL DEFAULT 0")


# ── Runs ─────────────────────────────────────────────────────────────────────

def add_run(skill_id: str, user_id: str, credits: int,
            status: str = "success", summary: str = "") -> str:
    """落一条运行记录，返回生成的 id。"""
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO runs(id, skill_id, user_id, credits, status, summary, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?)",
            (run_id, skill_id, user_id, credits, status, summary, now),
        )
    return run_id


def get_user_counts() -> dict:
    """每个 skill 的真实使用人数（按 user_id 去重，只算成功的运行）。

    一次查出全部，避免给 18 个 skill 挨个查一遍。返回 {skill_id: 人数}，
    没跑过的 skill 不会出现在结果里。
    """
    with _conn() as conn:
        rows = conn.execute(
            "SELECT skill_id, COUNT(DISTINCT user_id) AS n FROM runs "
            "WHERE status='success' GROUP BY skill_id"
        ).fetchall()
    return {r["skill_id"]: r["n"] for r in rows}


def has_run(skill_id: str, user_id: str) -> bool:
    """该用户是否跑过该 skill（用于评价 verified 标志）。"""
    with _conn() as conn:
        row = conn.execute(
            "SELECT 1 FROM runs WHERE skill_id=? AND user_id=? LIMIT 1",
            (skill_id, user_id),
        ).fetchone()
    return row is not None


# ── Reviews ──────────────────────────────────────────────────────────────────

def add_review(skill_id: str, user_id: str, nickname: str,
               rating: int, text: str) -> dict:
    """写入评价，自动判断 verified，返回完整评价 dict。"""
    review_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    verified = 1 if has_run(skill_id, user_id) else 0
    with _conn() as conn:
        conn.execute(
            "INSERT INTO reviews(id, skill_id, user_id, nickname, rating, text, verified, created_at) "
            "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
            (review_id, skill_id, user_id, nickname, rating, text, verified, now),
        )
    return {
        "id": review_id,
        "skill_id": skill_id,
        "user_id": user_id,
        "nickname": nickname,
        "rating": rating,
        "text": text,
        "verified": bool(verified),
        "created_at": now,
    }


def get_reviews(skill_id: str, limit: int = 50) -> list[dict]:
    """按时间倒序返回评价列表。"""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, skill_id, user_id, nickname, rating, text, verified, created_at "
            "FROM reviews WHERE skill_id=? ORDER BY created_at DESC LIMIT ?",
            (skill_id, limit),
        ).fetchall()
    return [
        {
            "id": r["id"],
            "skill_id": r["skill_id"],
            "user_id": r["user_id"],
            "nickname": r["nickname"],
            "rating": r["rating"],
            "text": r["text"],
            "verified": bool(r["verified"]),
            "created_at": r["created_at"],
        }
        for r in rows
    ]


def get_review_stats(skill_id: str) -> Optional[dict]:
    """返回 {avg_rating, count, dist} 供前端渲染星级分布。"""
    with _conn() as conn:
        row = conn.execute(
            "SELECT COUNT(*) as cnt, AVG(rating) as avg FROM reviews WHERE skill_id=?",
            (skill_id,),
        ).fetchone()
        if not row or row["cnt"] == 0:
            return None
        dist_rows = conn.execute(
            "SELECT rating, COUNT(*) as n FROM reviews WHERE skill_id=? GROUP BY rating",
            (skill_id,),
        ).fetchall()
    total = row["cnt"]
    dist = {i: 0 for i in range(1, 6)}
    for d in dist_rows:
        dist[d["rating"]] = d["n"]
    pct = [round(dist[5 - i] / total * 100) for i in range(5)]
    return {
        "avg_rating": round(row["avg"], 1),
        "count": total,
        "dist_pct": pct,   # [5星%, 4星%, 3星%, 2星%, 1星%]
    }


# ── 账号 ─────────────────────────────────────────────────────────────────────

class RegisterError(Exception):
    """注册失败。code 给前端分支用，message 直接展示给用户。"""

    def __init__(self, code: str, message: str):
        super().__init__(message)
        self.code = code
        self.message = message


def register_user(email: str, password_hash: str, nickname: str, invite_code: str) -> dict:
    """注册 = 核销邀请码 + 建用户，必须在同一个事务里。

    顺序不能反：先核销再建用户，任何一步失败整个事务回滚，邀请码不会白白被用掉。
    核销用「UPDATE ... WHERE used_count < max_uses」一条语句完成判断和加一，
    两个人同时抢最后一个名额时，只有一个能改到行。
    """
    uid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    try:
        with _conn() as conn:
            if conn.execute("SELECT 1 FROM users WHERE email=?", (email,)).fetchone():
                raise RegisterError("email_taken", "这个邮箱已经注册过了，直接登录就行")
            cur = conn.execute(
                "UPDATE invite_codes SET used_count = used_count + 1 "
                "WHERE code=? AND used_count < max_uses",
                (invite_code,),
            )
            if cur.rowcount == 0:
                # 不区分「不存在」和「用完了」，避免被拿来试探哪些码有效
                raise RegisterError("invite_invalid", "邀请码无效或已被用完")
            conn.execute(
                "INSERT INTO users(id, email, password_hash, nickname, invite_code, created_at) "
                "VALUES (?,?,?,?,?,?)",
                (uid, email, password_hash, nickname, invite_code, now),
            )
            conn.execute(
                "INSERT INTO ledger(user_id, amount, kind, title, ref, created_at) VALUES (?,?,?,?,?,?)",
                (uid, INITIAL_CREDITS, "grant", "新用户体验积分", "initial", now),
            )
    except sqlite3.IntegrityError:
        # 并发注册同一邮箱，被 UNIQUE 约束挡下（事务已回滚，邀请码没被消耗）
        raise RegisterError("email_taken", "这个邮箱已经注册过了，直接登录就行")
    return {"id": uid, "email": email, "nickname": nickname, "created_at": now}


def get_user_by_email(email: str) -> Optional[dict]:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE email=?", (email,)).fetchone()
    return dict(row) if row else None


def get_user_by_id(user_id: str) -> Optional[dict]:
    with _conn() as conn:
        row = conn.execute("SELECT * FROM users WHERE id=?", (user_id,)).fetchone()
    return dict(row) if row else None


def create_invite_codes(count: int, max_uses: int = 1, note: str = "") -> list:
    """批量生成邀请码。字符表去掉了 0/O/1/I 这类易混字符，方便手抄口述。"""
    import secrets
    alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"
    now = datetime.now(timezone.utc).isoformat()
    codes = []
    with _conn() as conn:
        while len(codes) < count:
            code = "".join(secrets.choice(alphabet) for _ in range(8))
            try:
                conn.execute(
                    "INSERT INTO invite_codes(code, max_uses, used_count, note, created_at) "
                    "VALUES (?,?,0,?,?)",
                    (code, max_uses, note, now),
                )
                codes.append(code)
            except sqlite3.IntegrityError:
                continue   # 撞码了，重抽
    return codes


def invite_stats() -> list:
    """每个邀请码的使用情况，运营看渠道转化用。"""
    with _conn() as conn:
        rows = conn.execute(
            "SELECT code, max_uses, used_count, note, created_at FROM invite_codes "
            "ORDER BY created_at DESC"
        ).fetchall()
    return [dict(r) for r in rows]


# ── Agent 对话 ───────────────────────────────────────────────────────────────

def create_thread(user_id: str, title: str = "") -> str:
    tid = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.execute(
            "INSERT INTO chat_threads(id, user_id, title, created_at, updated_at) VALUES (?,?,?,?,?)",
            (tid, user_id, title, now, now),
        )
    return tid


def get_thread(thread_id: str) -> Optional[dict]:
    with _conn() as conn:
        row = conn.execute(
            "SELECT id, user_id, title, created_at, updated_at FROM chat_threads WHERE id=?",
            (thread_id,),
        ).fetchone()
    return dict(row) if row else None


def list_threads(user_id: str, limit: int = 30) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, title, created_at, updated_at FROM chat_threads "
            "WHERE user_id=? ORDER BY updated_at DESC LIMIT ?",
            (user_id, limit),
        ).fetchall()
    return [dict(r) for r in rows]


def append_messages(thread_id: str, messages: list) -> None:
    """按顺序追加消息（OpenAI 格式的 dict，含 tool_calls / tool 结果）。"""
    if not messages:
        return
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        conn.executemany(
            "INSERT INTO chat_messages(thread_id, payload, created_at) VALUES (?,?,?)",
            [(thread_id, json.dumps(m, ensure_ascii=False), now) for m in messages],
        )
        conn.execute("UPDATE chat_threads SET updated_at=? WHERE id=?", (now, thread_id))


def set_thread_title(thread_id: str, title: str) -> None:
    """只在标题还是空的时候写，避免后续轮次覆盖首句标题。"""
    with _conn() as conn:
        conn.execute("UPDATE chat_threads SET title=? WHERE id=? AND title=''", (title, thread_id))


def rename_thread(thread_id: str, user_id: str, title: str) -> bool:
    """改会话标题，只改属于 user_id 的会话。"""
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        cur = conn.execute(
            "UPDATE chat_threads SET title=?, updated_at=? WHERE id=? AND user_id=?",
            (title, now, thread_id, user_id),
        )
        return cur.rowcount > 0


def replace_last_turn(thread_id: str, new_messages: list) -> None:
    """重新生成：把最后一条用户消息及其后的所有消息换成 new_messages，一个事务内完成。"""
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, payload FROM chat_messages WHERE thread_id=? ORDER BY id", (thread_id,)
        ).fetchall()
        cut = None
        for r in rows:
            if json.loads(r["payload"]).get("role") == "user":
                cut = r["id"]
        if cut is not None:
            conn.execute("DELETE FROM chat_messages WHERE thread_id=? AND id>=?", (thread_id, cut))
        conn.executemany(
            "INSERT INTO chat_messages(thread_id, payload, created_at) VALUES (?,?,?)",
            [(thread_id, json.dumps(m, ensure_ascii=False), now) for m in new_messages],
        )
        conn.execute("UPDATE chat_threads SET updated_at=? WHERE id=?", (now, thread_id))


def delete_thread(thread_id: str, user_id: str) -> bool:
    """删除会话及其所有消息。只删属于 user_id 的会话，返回是否实际删了行。"""
    with _conn() as conn:
        owned = conn.execute(
            "SELECT 1 FROM chat_threads WHERE id=? AND user_id=?", (thread_id, user_id)
        ).fetchone()
        if not owned:
            return False
        conn.execute("DELETE FROM chat_messages WHERE thread_id=?", (thread_id,))
        conn.execute("DELETE FROM chat_threads WHERE id=?", (thread_id,))
        return True


def load_messages(thread_id: str) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT payload FROM chat_messages WHERE thread_id=? ORDER BY id", (thread_id,)
        ).fetchall()
    return [json.loads(r["payload"]) for r in rows]



# ── 积分 ─────────────────────────────────────────────────────────────────────

INITIAL_CREDITS = 200   # 每个账号的初始积分。改这里即可，已发放的不受影响


class InsufficientCredits(Exception):
    def __init__(self, balance: int, need: int):
        super().__init__(f"积分不足：余额 {balance}，需要 {need}")
        self.balance = balance
        self.need = need


def _balance(conn, user_id: str) -> int:
    return conn.execute("SELECT COALESCE(SUM(amount),0) FROM ledger WHERE user_id=?",
                        (user_id,)).fetchone()[0]


def get_balance(user_id: str) -> int:
    with _conn() as conn:
        return _balance(conn, user_id)


def grant_credits(user_id: str, amount: int, title: str, ref: str) -> bool:
    """发放积分。同一个 ref 只会发一次，返回这次是否真的发了。"""
    now = datetime.now(timezone.utc).isoformat()
    try:
        with _conn() as conn:
            conn.execute(
                "INSERT INTO ledger(user_id, amount, kind, title, ref, created_at) VALUES (?,?,?,?,?,?)",
                (user_id, amount, "grant", title, ref, now))
        return True
    except sqlite3.IntegrityError:
        return False


def ensure_initial_grant(user_id: str) -> None:
    """没领过初始积分的账号补发一次（老账号启动时走这里，幂等）。"""
    grant_credits(user_id, INITIAL_CREDITS, "新用户体验积分", "initial")


def spend_credits(user_id: str, amount: int, title: str, ref: str) -> int:
    """扣积分，返回扣完的余额。余额不足抛 InsufficientCredits，什么都不记。

    判断余额和写流水在同一个写事务里（BEGIN IMMEDIATE 先拿写锁），
    两个请求同时来也不会把余额扣成负数。同一个 ref 重复调用不会重复扣。
    """
    now = datetime.now(timezone.utc).isoformat()
    conn = _conn()
    try:
        conn.isolation_level = None
        conn.execute("BEGIN IMMEDIATE")
        try:
            dup = conn.execute("SELECT 1 FROM ledger WHERE user_id=? AND kind='spend' AND ref=?",
                               (user_id, ref)).fetchone()
            bal = _balance(conn, user_id)
            if dup:
                conn.execute("COMMIT")
                return bal
            if bal < amount:
                conn.execute("ROLLBACK")
                raise InsufficientCredits(bal, amount)
            conn.execute(
                "INSERT INTO ledger(user_id, amount, kind, title, ref, created_at) VALUES (?,?,?,?,?,?)",
                (user_id, -amount, "spend", title, ref, now))
            conn.execute("COMMIT")
            return bal - amount
        except InsufficientCredits:
            raise
        except Exception:
            conn.execute("ROLLBACK")
            raise
    finally:
        conn.close()


def refund_credits(user_id: str, ref: str, title: str) -> int:
    """退还 ref 对应的那笔扣费。没扣过或已退过则什么都不做。返回当前余额。"""
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        row = conn.execute("SELECT amount FROM ledger WHERE user_id=? AND kind='spend' AND ref=?",
                           (user_id, ref)).fetchone()
        if row:
            try:
                conn.execute(
                    "INSERT INTO ledger(user_id, amount, kind, title, ref, created_at) VALUES (?,?,?,?,?,?)",
                    (user_id, -row["amount"], "refund", title, ref, now))
            except sqlite3.IntegrityError:
                pass   # 已经退过
        return _balance(conn, user_id)


def list_ledger(user_id: str, limit: int = 30) -> list:
    with _conn() as conn:
        rows = conn.execute(
            "SELECT id, amount, kind, title, created_at FROM ledger WHERE user_id=? "
            "ORDER BY id DESC LIMIT ?", (user_id, limit)).fetchall()
    return [{"id": str(r["id"]), "amount": r["amount"], "kind": r["kind"],
             "title": r["title"], "date": r["created_at"][:10]} for r in rows]


def spent_total(user_id: str) -> int:
    """累计净消耗（扣费减去退款）。"""
    with _conn() as conn:
        v = conn.execute(
            "SELECT COALESCE(SUM(amount),0) FROM ledger WHERE user_id=? AND kind IN ('spend','refund')",
            (user_id,)).fetchone()[0]
    return -v


# ── Prefs ────────────────────────────────────────────────────────────────────

def get_prefs(user_id: str) -> dict:
    with _conn() as conn:
        r = conn.execute("SELECT choose_variant, digest_off FROM user_prefs WHERE user_id=?",
                         (user_id,)).fetchone()
    return {"choose_variant": bool(r["choose_variant"]) if r else False,
            "digest_off": bool(r["digest_off"]) if r else False}


def set_choose_variant(user_id: str, value: bool) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO user_prefs(user_id, choose_variant) VALUES (?,?) "
            "ON CONFLICT(user_id) DO UPDATE SET choose_variant=excluded.choose_variant",
            (user_id, 1 if value else 0))


def set_digest_off(user_id: str, value: bool) -> None:
    with _conn() as conn:
        conn.execute(
            "INSERT INTO user_prefs(user_id, digest_off) VALUES (?,?) "
            "ON CONFLICT(user_id) DO UPDATE SET digest_off=excluded.digest_off",
            (user_id, 1 if value else 0))


# ── Uploads ──────────────────────────────────────────────────────────────────

def add_upload(user_id: str, name: str, stored_name: str, kind: str, size: int,
               text: str, truncated: bool, ttl_days: int) -> dict:
    now = datetime.now(timezone.utc)
    row = {
        "id": str(uuid.uuid4()), "user_id": user_id, "name": name,
        "stored_name": stored_name, "kind": kind, "size": size,
        "chars": len(text), "truncated": 1 if truncated else 0, "text": text,
        "created_at": now.isoformat(),
        "expires_at": (now + timedelta(days=ttl_days)).isoformat(),
    }
    with _conn() as conn:
        conn.execute(
            "INSERT INTO uploads(id,user_id,name,stored_name,kind,size,chars,truncated,text,"
            "created_at,expires_at) VALUES (:id,:user_id,:name,:stored_name,:kind,:size,:chars,"
            ":truncated,:text,:created_at,:expires_at)", row)
    return row


def get_upload(upload_id: str, user_id: str) -> Optional[dict]:
    """只返回属于该用户且未过期的文件。"""
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        r = conn.execute(
            "SELECT * FROM uploads WHERE id=? AND user_id=? AND expires_at>?",
            (upload_id, user_id, now)).fetchone()
    return dict(r) if r else None


def count_live_uploads(user_id: str) -> int:
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        return conn.execute(
            "SELECT COUNT(*) FROM uploads WHERE user_id=? AND expires_at>?",
            (user_id, now)).fetchone()[0]


def pop_upload(upload_id: str, user_id: str) -> Optional[dict]:
    """删掉一条登记并返回它（调用方据此删磁盘文件）。不属于该用户则什么都不做。"""
    with _conn() as conn:
        r = conn.execute("SELECT * FROM uploads WHERE id=? AND user_id=?",
                         (upload_id, user_id)).fetchone()
        if r is None:
            return None
        conn.execute("DELETE FROM uploads WHERE id=?", (upload_id,))
    return dict(r)


def pop_expired_uploads() -> list:
    now = datetime.now(timezone.utc).isoformat()
    with _conn() as conn:
        rows = conn.execute("SELECT * FROM uploads WHERE expires_at<=?", (now,)).fetchall()
        conn.execute("DELETE FROM uploads WHERE expires_at<=?", (now,))
    return [dict(r) for r in rows]
