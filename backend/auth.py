"""账号：邮箱 + 密码，邀请码注册，签名令牌。

接口：
    POST /api/auth/register  { email, password, nickname?, invite_code }
    POST /api/auth/login     { email, password }
    GET  /api/auth/me        Authorization: Bearer <token>

其它接口取当前用户用 current_user()，**身份只认令牌，不认请求体里的 user_id**——
客户端传来的 id 谁都能伪造。

设计取舍：
- 密码用 PBKDF2-HMAC-SHA256。没用 scrypt：本机 Python 链接的是 LibreSSL，
  hashlib.scrypt 不一定存在；PBKDF2 是标准库保证有的。迭代次数写进哈希串里，
  以后调高不影响老用户登录。
- 令牌用 itsdangerous 签名（Flask 自带依赖，不新增包）。无状态，30 天过期。
- 签名密钥来自 .env 的 AUTH_SECRET。没配就用进程内随机密钥并大声警告——
  能跑，但每次重启所有人都要重新登录。
"""
import hashlib
import hmac
import os
import re
import secrets
import time
from typing import Dict, List, Optional

from flask import Blueprint, jsonify, request
from itsdangerous import BadSignature, SignatureExpired, URLSafeTimedSerializer

from db import RegisterError, get_user_by_email, get_user_by_id, register_user

bp = Blueprint("auth", __name__)

TOKEN_MAX_AGE = 30 * 24 * 3600
PBKDF2_ITERATIONS = 600_000          # OWASP 对 PBKDF2-HMAC-SHA256 的建议值
MIN_PASSWORD = 8
MAX_PASSWORD = 128                   # 设上限：PBKDF2 的耗时随输入变长，不设就是 DoS 入口
_EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

# ── 令牌 ────────────────────────────────────────────────────

_serializer: Optional[URLSafeTimedSerializer] = None


def _get_serializer() -> URLSafeTimedSerializer:
    """懒加载：必须等 simple_server 把 .env 读进环境变量之后再取密钥。"""
    global _serializer
    if _serializer is None:
        secret = os.environ.get("AUTH_SECRET")
        if not secret:
            secret = secrets.token_hex(32)
            print("⚠️  未配置 AUTH_SECRET，使用临时密钥：服务重启后所有登录会失效。")
            print("   上线前必须在 .env 里设一个固定的长随机串。")
        _serializer = URLSafeTimedSerializer(secret, salt="liushui-auth")
    return _serializer


def issue_token(user_id: str) -> str:
    return _get_serializer().dumps({"uid": user_id})


def current_user() -> Optional[dict]:
    """从 Authorization: Bearer 头解出当前用户；没登录/令牌无效/用户已不存在 → None。"""
    header = request.headers.get("Authorization", "")
    if not header.startswith("Bearer "):
        return None
    try:
        data = _get_serializer().loads(header[7:].strip(), max_age=TOKEN_MAX_AGE)
    except (BadSignature, SignatureExpired):
        return None
    return get_user_by_id(data.get("uid", ""))


def auth_required_response():
    """统一的未登录响应。code 让前端据此弹登录框，而不是靠匹配文案。"""
    return jsonify({"success": False, "code": "auth_required", "error": "请先登录"}), 401


# ── 密码 ────────────────────────────────────────────────────

def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, PBKDF2_ITERATIONS)
    return f"pbkdf2_sha256${PBKDF2_ITERATIONS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        algo, iters, salt_hex, hash_hex = stored.split("$")
        if algo != "pbkdf2_sha256":
            return False
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)   # 常数时间比较
    except Exception:
        return False


# 用户不存在时也跑一遍校验，让「邮箱没注册」和「密码错」耗时一致，
# 不给攻击者一个探测邮箱是否注册的计时侧信道
_DUMMY_HASH = hash_password("dummy-password-for-timing")


# ── 失败次数限制（进程内，目前只用在注册接口）──────────────────────
# 单进程够内测用。上多实例时要换成共享存储（Redis 之类），否则每个进程各算各的。

_fail_log: Dict[str, List[float]] = {}
FAIL_LIMIT = 5
FAIL_WINDOW = 10 * 60


def _client_ip() -> str:
    return request.remote_addr or "unknown"


def _blocked(key: str) -> bool:
    now = time.time()
    recent = [t for t in _fail_log.get(key, []) if now - t < FAIL_WINDOW]
    _fail_log[key] = recent
    return len(recent) >= FAIL_LIMIT


def _record_fail(key: str) -> None:
    _fail_log.setdefault(key, []).append(time.time())


def _too_many():
    return jsonify({"success": False, "code": "rate_limited",
                    "error": "尝试次数太多了，请 10 分钟后再试"}), 429


# ── 接口 ────────────────────────────────────────────────────

def _public(user: dict) -> dict:
    return {"id": user["id"], "email": user["email"], "nickname": user["nickname"]}


def _normalize_email(raw) -> str:
    return (raw or "").strip().lower()


@bp.route("/api/auth/register", methods=["POST"])
def register():
    data = request.json or {}
    email = _normalize_email(data.get("email"))
    password = data.get("password") or ""
    invite_code = (data.get("invite_code") or "").strip().upper()
    nickname = (data.get("nickname") or "").strip()[:20]

    if not _EMAIL_RE.match(email) or len(email) > 254:
        return jsonify({"success": False, "code": "bad_email", "error": "邮箱格式不对"}), 400
    if len(password) < MIN_PASSWORD:
        return jsonify({"success": False, "code": "weak_password",
                        "error": f"密码至少 {MIN_PASSWORD} 位"}), 400
    if len(password) > MAX_PASSWORD:
        return jsonify({"success": False, "code": "bad_password",
                        "error": f"密码不能超过 {MAX_PASSWORD} 位"}), 400
    if not invite_code:
        return jsonify({"success": False, "code": "invite_invalid",
                        "error": "请填写邀请码"}), 400

    # 按 IP 限制：防止拿注册接口批量试邀请码
    ip_key = "reg:" + _client_ip()
    if _blocked(ip_key):
        return _too_many()

    try:
        user = register_user(
            email, hash_password(password), nickname or email.split("@")[0][:20], invite_code
        )
    except RegisterError as e:
        if e.code == "invite_invalid":
            _record_fail(ip_key)   # 只有猜邀请码失败才计数，邮箱重复不算攻击
        status = 409 if e.code == "email_taken" else 400
        return jsonify({"success": False, "code": e.code, "error": e.message}), status

    return jsonify({"success": True, "token": issue_token(user["id"]), "user": _public(user)})


@bp.route("/api/auth/login", methods=["POST"])
def login():
    data = request.json or {}
    email = _normalize_email(data.get("email"))
    password = data.get("password") or ""

    # 登录不限失败次数、不锁定（产品决定）。注册接口仍按 IP 限制，防止批量试邀请码
    user = get_user_by_email(email) if len(password) <= MAX_PASSWORD else None
    ok = verify_password(password, user["password_hash"] if user else _DUMMY_HASH)
    if not (user and ok):
        return jsonify({"success": False, "code": "bad_credentials",
                        "error": "邮箱或密码不对"}), 401

    return jsonify({"success": True, "token": issue_token(user["id"]), "user": _public(user)})


@bp.route("/api/auth/me", methods=["GET"])
def me():
    user = current_user()
    if not user:
        return auth_required_response()
    return jsonify({"success": True, "user": _public(user)})
