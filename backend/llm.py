"""LLM 客户端 —— 只用标准库，不装 SDK。

所有供应商都走 OpenAI 兼容格式（`POST /chat/completions`），所以换供应商
只是换 base_url + model + key 三个值，代码一行不用动。这是当初不用 openai
包的原因之一，也是为什么 D8「先定一家」不等于「锁死一家」。

用 LLM_PROVIDER 选供应商：

    export LLM_PROVIDER=gateway      # 自建 / 第三方 OpenAI 兼容网关（需配 LLM_BASE_URL）
    export LLM_PROVIDER=bailian      # 阿里云百炼（默认，产品目标供应商）
    export LLM_PROVIDER=deepseek     # DeepSeek 官方
    export LLM_PROVIDER=ollama       # 本地，不花钱不联网

每家要读的 key 环境变量不同，见 _PROVIDERS。想完全手动指定就设
LLM_BASE_URL / LLM_MODEL / LLM_API_KEY，它们优先于 preset。

--- 供应商的坑（都已处理）---

百炼:
  1. response_format={"type":"json_object"} 时 messages 里**必须出现 "json"
     这个词**，否则服务端 400 直接拒。见 _ensure_json_hint。
  2. 兼容接口只接受 json_object，**不支持 json_schema**。所以 schema 只能写在
     prompt 里靠模型遵循，校验必须自己做（validate.py）。这不是可选项。

OpenAI 兼容网关（One-API 一类）:
  3. 模型列表（GET /v1/models）里列出的模型**不等于能调**——没绑定渠道的会
     返回 403「未配置可用路由」。实测 claude-* 和 qwen3.7-* 都不通，
     deepseek-v4-pro / glm-5.3-flash 通。别照着列表猜。
  4. 开发期用来验流程很方便，上生产前换成正式供应商。

推理型模型（deepseek-*-flash 一类）:
  5. 思维链也算 completion token。max_tokens 给小了会出现 finish_reason
     =length 而 content 为空字符串——不是报错，是静默截断。所以
     _MAX_TOKENS 默认给得大，且 content 为空时明确报错而不是往下传。
"""
import json
import os
import time
import urllib.error
import urllib.request

# (base_url, 默认模型, key 环境变量候选)
_PROVIDERS = {
    "bailian": (
        "https://dashscope.aliyuncs.com/compatible-mode/v1",
        "qwen-plus",
        ("DASHSCOPE_API_KEY",),
    ),
    "gateway": (
        os.environ.get("LLM_BASE_URL", ""),
        "deepseek-v4-pro",
        ("LLM_API_KEY", "OPENAI_API_KEY"),
    ),
    "deepseek": (
        "https://api.deepseek.com/v1",
        "deepseek-chat",
        ("DEEPSEEK_API_KEY",),
    ),
    "ollama": (
        "http://localhost:11434/v1",
        "qwen2.5:7b",
        (),  # 本地不需要 key
    ),
}

PROVIDER = os.environ.get("LLM_PROVIDER", "bailian").strip().lower()
if PROVIDER not in _PROVIDERS:
    raise SystemExit(
        "LLM_PROVIDER=%r 不认识。可选：%s"
        % (PROVIDER, " / ".join(sorted(_PROVIDERS)))
    )

_base, _model, _key_envs = _PROVIDERS[PROVIDER]

# 显式覆盖 > QWEN_*（历史变量，保持兼容）> preset
BASE_URL = (
    os.environ.get("LLM_BASE_URL")
    or os.environ.get("QWEN_BASE_URL")
    or _base
)
MODEL = os.environ.get("LLM_MODEL") or os.environ.get("QWEN_MODEL") or _model

_TIMEOUT = 180
_MAX_TOKENS = int(os.environ.get("LLM_MAX_TOKENS", "8000"))

# 关思维链。默认开（1），LLM_THINKING=1 可以关掉这个关闭、恢复思维链。
#
# 为什么要关：这个 skill 是分类 + 抽取，不是推理题。网关上能调的模型全是
# 自适应推理，真实任务实测 38-78 秒 / 4000-6000 out token，产品里等不了。
# deepseek-v4-flash 实测 thinking={"type":"disabled"} 干净生效：out 腰斩，
# 逐条判定条数不变，message.reasoning_content 字段消失。
#
# ⚠️ 开关名各家不统一，且**不认识的参数会被静默忽略，照样返回 200**。所以
# 加新供应商时必须用 probe_nothink.py 实测 out token 有没有真的降，不能看
# 有没有报错。glm-5.3-flash 就是反例：没有任何开关能关掉它的思维链，能压低
# token 的那两个（chat_template_kwargs / extra_body）直接把 JSON 弄坏了。
_NO_THINK = {
    # deepseek 系认这个（reasoning_effort=none、chat_template_kwargs 也行，
    # 三个等效，挑最标准的）
    "deepseek": {"thinking": {"type": "disabled"}},
    # 百炼 qwen 系官方开关，接百炼时用 probe_nothink.py 复验
    "bailian": {"enable_thinking": False},
}


def _no_think_params(model):
    """按模型名挑关思维链的参数。认不出来就不加——加错了是静默无效，不如不加。"""
    if os.environ.get("LLM_THINKING") == "1":
        return {}
    name = (model or "").lower()
    if name.startswith("deepseek"):
        return _NO_THINK["deepseek"]
    if PROVIDER == "bailian" or name.startswith("qwen"):
        return _NO_THINK["bailian"]
    return {}


class LLMError(RuntimeError):
    pass


def _api_key():
    explicit = os.environ.get("LLM_API_KEY")
    if explicit:
        return explicit
    for name in _key_envs:
        v = os.environ.get(name)
        if v:
            return v
    if PROVIDER == "ollama":
        return "ollama"  # 本地不校验，给个占位
    raise LLMError(
        "LLM_PROVIDER=%s 需要 key，但 %s 都是空的。\n"
        "  export %s=...    （或写进 backend/.env，那个文件已在 .gitignore 里）"
        % (PROVIDER, " / ".join(_key_envs), _key_envs[0])
    )


def _ensure_json_hint(messages):
    """百炼要求：用 json_object 时 messages 必须含 'json' 字面词，否则 400。

    其他供应商不要求，但多一句没坏处，就不分供应商处理了。
    """
    joined = " ".join(m.get("content") or "" for m in messages)
    if "json" in joined.lower():
        return messages
    out = list(messages)
    out[-1] = dict(out[-1])
    out[-1]["content"] = (out[-1].get("content") or "") + "\n\n只输出 JSON。"
    return out


def chat_json(system, user, model=None, temperature=0, retries=2):
    """调模型并解析 JSON。失败重试，最后仍失败则抛 LLMError。

    返回 (data, meta)；meta 含 token 用量和耗时，用于成本核算。
    """
    messages = _ensure_json_hint([
        {"role": "system", "content": system},
        {"role": "user", "content": user},
    ])
    payload = {
        "model": model or MODEL,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": _MAX_TOKENS,
        "response_format": {"type": "json_object"},
    }
    payload.update(_no_think_params(model or MODEL))
    body = json.dumps(payload, ensure_ascii=False).encode("utf-8")

    last = None
    for attempt in range(retries + 1):
        # Request 每次重建 —— urlopen 读过一次的 Request 不能复用
        req = urllib.request.Request(
            BASE_URL.rstrip("/") + "/chat/completions",
            data=body,
            headers={
                "Authorization": "Bearer " + _api_key(),
                "Content-Type": "application/json",
            },
            method="POST",
        )
        t0 = time.time()
        try:
            with urllib.request.urlopen(req, timeout=_TIMEOUT) as resp:
                raw = json.loads(resp.read().decode("utf-8"))
            choice = (raw.get("choices") or [{}])[0]
            content = (choice.get("message") or {}).get("content") or ""
            if not content.strip():
                # 推理模型把 max_tokens 烧在思维链上了，静默截断
                raise LLMError(
                    "返回内容为空（finish_reason=%s）。多半是 max_tokens 不够，"
                    "推理型模型的思维链也算 completion token。"
                    "试 export LLM_MAX_TOKENS=16000，或换个非推理模型。"
                    % choice.get("finish_reason")
                )
            data = json.loads(content)
            usage = raw.get("usage") or {}
            return data, {
                "elapsed": round(time.time() - t0, 2),
                "prompt_tokens": usage.get("prompt_tokens"),
                "completion_tokens": usage.get("completion_tokens"),
                "provider": PROVIDER,
                "model": payload["model"],
                "attempt": attempt + 1,
            }
        except urllib.error.HTTPError as e:
            detail = e.read().decode("utf-8", "ignore")[:400]
            last = LLMError("HTTP %s: %s" % (e.code, detail))
            # 4xx 是请求本身的问题（key 错、模型名错、参数错），重试没用
            if 400 <= e.code < 500 and e.code != 429:
                raise last
        except LLMError as e:
            last = e  # 空返回，重试一次有可能就好了
        except json.JSONDecodeError as e:
            last = LLMError("返回的不是合法 JSON: %s" % e)
        except Exception as e:  # 网络抖动等
            last = LLMError("%s: %s" % (type(e).__name__, e))
        if attempt < retries:
            time.sleep(1.5 * (attempt + 1))
    raise last


def list_models():
    """GET /models —— 看这个 endpoint 上有哪些模型名。

    注意：列出来不等于能调（网关会对未绑定渠道的模型返回 403）。
    """
    req = urllib.request.Request(
        BASE_URL.rstrip("/") + "/models",
        headers={"Authorization": "Bearer " + _api_key()},
    )
    with urllib.request.urlopen(req, timeout=30) as resp:
        raw = json.loads(resp.read().decode("utf-8"))
    return sorted(m.get("id") for m in (raw.get("data") or []))
