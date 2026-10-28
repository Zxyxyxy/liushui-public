"""模型探针 —— 一次性测出「哪些能调」和「哪些是推理模型」。

为什么需要它：
  1. 网关 GET /v1/models 列出 41 个，但列出 ≠ 能调（没绑渠道的返回 403
     「未配置可用路由」）。照着列表猜会浪费很多时间。
  2. resume-jd-match 要的是**分类 + 抽取**，不是生成。推理模型把思维链也算
     completion token，deepseek-v4-pro 实测 78 秒 / 4309 out——产品里用户
     等不了。所以必须先筛掉推理模型。

判断推理模型的办法：给一个答案只有几个 token 的问题。
  非推理模型 out ≈ 10-30
  推理模型   out ≈ 数百到数千（思维链算在里面）

用法:
    python3 probe_models.py                 # 测默认候选
    python3 probe_models.py --all            # 测网关列出的全部
    python3 probe_models.py --models a,b,c    # 只测指定的
"""
import argparse
import json
import os
import sys
import time
import urllib.error
import urllib.request



def _load_env():
    """和 simple_server 一样从 .env / config.env 读配置：密钥不用在命令行里输入。已有的环境变量不覆盖。"""
    here = os.path.dirname(os.path.abspath(__file__))
    for fn in (".env", "config.env"):
        try:
            with open(os.path.join(here, fn), encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip().strip('"').strip("'"))
        except FileNotFoundError:
            pass


_load_env()


def _base():
    """网关地址：LLM_BASE_URL 优先，其次是后端实际在用的 OPENAI_BASE_URL（补齐 /v1）。"""
    b = os.environ.get("LLM_BASE_URL") or os.environ.get("OPENAI_BASE_URL") or "https://api.openai.com/v1"
    b = b.rstrip("/")
    return b if b.endswith("/v1") else b + "/v1"


BASE = _base()

# 候选：偏非推理、偏快、偏便宜。claude-* / qwen3.7-* 按 llm.py 注释实测 403，
# 仍放进来复验一次——渠道配置会变。
CANDIDATES = [
    "glm-5.3-flash",
    "glm-5.3",
    "gemini-2.5-flash-lite",
    "gemini-2.5-flash",
    "gemini-3.1-flash-lite",
    "gemini-3.5-flash",
    "deepseek-v4-flash",
    "deepseek-v4.1-flash",
    "kimi-k2.5",
    "claude-haiku-4-5-20251001",
    "qwen3.7-plus",
]

# 答案极短的问题：非推理模型几十个 token 就该答完
PROBE_SYS = "你只输出 JSON，不要解释。"
PROBE_USER = '中国的首都是哪里？用 json 回答：{"city": "..."}'

GREEN, RED, YELLOW, DIM, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
)


def key():
    for v in ("LLM_API_KEY", "OPENAI_API_KEY"):
        k = os.environ.get(v)
        if k:
            return k
    raise SystemExit("没找到 key：backend/.env 里要有 OPENAI_API_KEY 或 LLM_API_KEY")


def list_models(api_key):
    req = urllib.request.Request(
        BASE.rstrip("/") + "/models",
        headers={"Authorization": "Bearer " + api_key},
    )
    with urllib.request.urlopen(req, timeout=20) as r:
        return sorted(m["id"] for m in json.loads(r.read())["data"])


def probe(model, api_key, timeout=90):
    """返回 (ok, 详情 dict)。"""
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": PROBE_SYS},
            {"role": "user", "content": PROBE_USER},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    req = urllib.request.Request(
        BASE.rstrip("/") + "/chat/completions",
        data=json.dumps(payload, ensure_ascii=False).encode("utf-8"),
        headers={
            "Authorization": "Bearer " + api_key,
            "Content-Type": "application/json",
        },
        method="POST",
    )
    t0 = time.time()
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            raw = json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        detail = e.read().decode("utf-8", "ignore")
        try:
            detail = json.loads(detail).get("error", {}).get("message", detail)
        except Exception:
            pass
        return False, {"err": "HTTP %s: %s" % (e.code, detail[:90])}
    except Exception as e:
        return False, {"err": "%s: %s" % (type(e).__name__, str(e)[:90])}

    elapsed = time.time() - t0
    choice = (raw.get("choices") or [{}])[0]
    content = (choice.get("message") or {}).get("content") or ""
    usage = raw.get("usage") or {}
    out = usage.get("completion_tokens")

    # 结构化输出是否真的遵守
    json_ok = False
    try:
        json_ok = isinstance(json.loads(content), dict)
    except Exception:
        pass

    return True, {
        "elapsed": round(elapsed, 1),
        "out": out,
        "in": usage.get("prompt_tokens"),
        "json_ok": json_ok,
        "finish": choice.get("finish_reason"),
        "empty": not content.strip(),
        "preview": content.strip().replace("\n", " ")[:40],
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--all", action="store_true", help="测网关列出的全部模型")
    ap.add_argument("--models", help="逗号分隔的模型名")
    args = ap.parse_args()

    api_key = key()
    if args.models:
        models = [m.strip() for m in args.models.split(",") if m.strip()]
    elif args.all:
        models = list_models(api_key)
    else:
        models = CANDIDATES

    print("%s网关 %s · 后端当前用的模型：%s%s" % (DIM, BASE, os.environ.get("OPENAI_MODEL") or "（未设置）", RESET))
    print("%s探针：一个答案只有几个 token 的问题。out 很大 = 推理模型%s\n"
          % (DIM, RESET))
    print("%-30s %7s %7s %6s  %s" % ("模型", "耗时", "out", "json", "备注"))
    print("-" * 74)

    usable = []
    for m in models:
        ok, d = probe(m, api_key)
        if not ok:
            print("%-30s %s%s%s" % (m, RED, d["err"], RESET))
            continue
        if d["empty"]:
            print("%-30s %7.1fs %7s %6s  %s空返回 (finish=%s)%s"
                  % (m, d["elapsed"], d["out"], "-", RED, d["finish"], RESET))
            continue

        # out > 80 基本可以断定有思维链（这个问题答案就几个 token）
        reasoning = (d["out"] or 0) > 80
        tag = "%s推理型%s" % (YELLOW, RESET) if reasoning else "%s非推理%s" % (GREEN, RESET)
        print("%-30s %7.1fs %7s %6s  %s  %s%s%s"
              % (m, d["elapsed"], d["out"], "✓" if d["json_ok"] else "✗",
                 tag, DIM, d["preview"], RESET))
        if not reasoning and d["json_ok"]:
            usable.append((m, d["elapsed"], d["out"]))

    print("\n" + "=" * 74)
    if usable:
        usable.sort(key=lambda x: x[1])
        print("%s非推理且 JSON 合规，按耗时排序：%s" % (GREEN, RESET))
        for m, e, o in usable:
            print("  %-30s %.1fs  out=%s" % (m, e, o))
        print("\n下一步：拿最快的两三个跑真实 eval 对比质量")
        print("  LLM_PROVIDER=gateway LLM_MODEL=%s python3 run_eval.py --case 1"
              % usable[0][0])
    else:
        print("%s没有既非推理又 JSON 合规的。%s" % (RED, RESET))
    return 0


if __name__ == "__main__":
    sys.exit(main())
