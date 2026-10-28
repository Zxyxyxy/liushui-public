"""探针二 —— 能不能关掉思维链。

背景（probe_models.py 的结论是错的，别照着用）：
    用「中国首都是哪」这种简单问题筛推理模型无效。网关上的模型是**自适应推理**：
    简单问题 deepseek-v4-flash 只花 46 out token，真实的简历×JD 任务上飙到 6086。
    所以「非推理模型」这个筛选维度在这个网关上不存在——三个能调的模型
    （deepseek-v4-pro / v4-flash / glm-5.3-flash）真实任务全部 38-78 秒。

    38 秒对产品不可接受，所以唯一的出路是显式关掉思维链。

各家的开关名不统一，OpenAI 兼容层通常透传其中一种。这个脚本把已知的几种
都试一遍，看哪个真的把 out token 压下来了。

判据不是「有没有报错」——不认识的参数多数被静默忽略，照样返回 200。
所以必须比对 out token：只有明显下降才算生效。

用法:
    python3 probe_nothink.py                    # 测所有能调的模型 × 所有开关
    python3 probe_nothink.py --model glm-5.3-flash
"""
import argparse
import copy
import json
import os
import sys
import time
import urllib.error
import urllib.request

BASE = os.environ.get("LLM_BASE_URL", "https://api.openai.com/v1")

MODELS = ["deepseek-v4-flash", "glm-5.3-flash", "deepseek-v4-pro"]

# 已知的几种关思维链写法。none 是基线，必须排第一。
SWITCHES = [
    ("none", {}),
    ("enable_thinking=false", {"enable_thinking": False}),
    ("thinking.type=disabled", {"thinking": {"type": "disabled"}}),
    ("thinking.type=none", {"thinking": {"type": "none"}}),
    ("reasoning_effort=none", {"reasoning_effort": "none"}),
    ("reasoning_effort=minimal", {"reasoning_effort": "minimal"}),
    ("reasoning.enabled=false", {"reasoning": {"enabled": False}}),
    ("chat_template_kwargs", {"chat_template_kwargs": {"enable_thinking": False}}),
    ("extra_body.enable_thinking", {"extra_body": {"enable_thinking": False}}),
]

# 必须是个「值得想一会儿」的任务，否则自适应模型根本不触发思维链，测不出差别。
# 用一个缩微版的逐条判定，形状和真实 skill 一致。
SYS = (
    "你是招聘匹配助手。对照 JD 逐条判定简历是否满足，"
    "只输出 json：{\"items\":[{\"requirement\":\"原文\",\"status\":\"matched|gap|unknown\"}]}"
)
USER = """<resume>
张某  产品经理
2022-2025 某电商公司 推荐业务产品经理
- 负责首页推荐位的产品设计，与算法团队对接需求
- 主导大模型客服助手从 0 到 1 上线
教育：某大学 工商管理 本科
</resume>

<jd requirement_count="3">
1. 硕士及以上学历，计算机、数学、统计相关专业
2. 熟悉主流推荐算法（协同过滤、DSSM、DIN 等），有大规模推荐系统落地经验
3. 熟练掌握 Python/C++
</jd>

共 3 条，items 必须正好 3 项，requirement 逐字照抄。只输出 json。"""

GREEN, RED, YELLOW, DIM, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
)


def key():
    for v in ("LLM_API_KEY", "OPENAI_API_KEY"):
        k = os.environ.get(v)
        if k:
            return k
    raise SystemExit("没有 key。在 backend/.env 里配 LLM_API_KEY")


def call(model, extra, api_key, timeout=180):
    payload = {
        "model": model,
        "messages": [
            {"role": "system", "content": SYS},
            {"role": "user", "content": USER},
        ],
        "temperature": 0,
        "response_format": {"type": "json_object"},
    }
    payload.update(copy.deepcopy(extra))
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
        body = e.read().decode("utf-8", "ignore")
        try:
            body = json.loads(body).get("error", {}).get("message", body)
        except Exception:
            pass
        return {"err": "HTTP %s: %s" % (e.code, body[:70])}
    except Exception as e:
        return {"err": "%s: %s" % (type(e).__name__, str(e)[:70])}

    ch = (raw.get("choices") or [{}])[0]
    msg = ch.get("message") or {}
    content = msg.get("content") or ""
    usage = raw.get("usage") or {}

    n_items = None
    try:
        n_items = len(json.loads(content).get("items") or [])
    except Exception:
        pass

    return {
        "elapsed": round(time.time() - t0, 1),
        "out": usage.get("completion_tokens"),
        "items": n_items,
        # 有些网关把思维链单独放在这个字段，而不是塞进 content
        "has_reasoning_field": bool(
            msg.get("reasoning_content") or msg.get("reasoning")
        ),
        "empty": not content.strip(),
    }


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", help="只测一个模型")
    args = ap.parse_args()

    api_key = key()
    models = [args.model] if args.model else MODELS

    print("%s网关 %s%s" % (DIM, BASE, RESET))
    print("%s判据：out token 明显下降才算开关生效。不认识的参数多数被静默忽略。%s\n"
          % (DIM, RESET))

    for model in models:
        print("%s%s%s" % (YELLOW, model, RESET))
        print("  %-32s %7s %7s %6s  %s" % ("开关", "耗时", "out", "items", "备注"))
        print("  " + "-" * 66)
        base_out = None
        best = None
        for label, extra in SWITCHES:
            d = call(model, extra, api_key)
            if "err" in d:
                print("  %-32s %s%s%s" % (label, RED, d["err"], RESET))
                continue
            if d["empty"]:
                print("  %-32s %7.1fs %7s %6s  %s空返回%s"
                      % (label, d["elapsed"], d["out"], "-", RED, RESET))
                continue

            note = ""
            if label == "none":
                base_out = d["out"]
                note = "%s基线%s" % (DIM, RESET)
            elif base_out and d["out"]:
                ratio = d["out"] / base_out
                if ratio < 0.55:
                    note = "%s✓ 生效 (out 降到 %.0f%%)%s" % (GREEN, ratio * 100, RESET)
                    if best is None or d["out"] < best[1]:
                        best = (label, d["out"], d["elapsed"])
                else:
                    note = "%s无效%s" % (DIM, RESET)
            if d["has_reasoning_field"]:
                note += " %s(思维链在 reasoning_content 字段)%s" % (DIM, RESET)

            print("  %-32s %7.1fs %7s %6s  %s"
                  % (label, d["elapsed"], d["out"], d["items"], note))

        if best:
            print("  %s→ 最优：%s，out %s→%s，%.1fs%s"
                  % (GREEN, best[0], base_out, best[1], best[2], RESET))
        else:
            print("  %s→ 没有开关能关掉它的思维链%s" % (RED, RESET))
        print()
    return 0


if __name__ == "__main__":
    sys.exit(main())
