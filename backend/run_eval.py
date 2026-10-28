"""eval runner —— 跑 skill，校验三条机械不变量，输出红绿灯。

用法:
    python3 run_eval.py --dry          # 不调模型，只验分条器和校验器（不花钱）
    python3 run_eval.py                # 真调 Qwen-Plus
    python3 run_eval.py --case 1       # 只跑第 N 条
"""
import argparse
import json
import os
import sys

import jd as jdmod
import validate as validator
import verdict as verdictmod

HERE = os.path.dirname(os.path.abspath(__file__))
SKILL = os.path.join(HERE, "..", "skills", "resume-jd-match")
FIXTURES = os.path.join(SKILL, "fixtures")

GREEN, RED, YELLOW, DIM, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[2m", "\033[0m"
)


def load_prompt():
    with open(os.path.join(SKILL, "prompt.md"), encoding="utf-8") as f:
        return f.read()


def load_jds():
    with open(os.path.join(FIXTURES, "jds.json"), encoding="utf-8") as f:
        return json.load(f)


def load_resume(name):
    with open(os.path.join(FIXTURES, name), encoding="utf-8") as f:
        return f.read()


def build_user_msg(resume_text, jd_items, focus=""):
    """JD 逐条包进 <req> 标签给模型 —— 条数是外部真值，不让模型自己数。

    编号必须放在 id 属性里，不能写成 "1. xxx" 那种行内前缀。
    行内前缀会让「requirement 逐字照抄」产生歧义——编号算不算原文的一部分？
    实测 6 条里有 1 条把 "1. " 一起抄进了 requirement，逐字校验直接挂。
    契约有歧义就会被随机违反，比稳定违反更难查。放进属性就没东西可抄错。
    """
    tagged = "\n".join(
        "<req id=\"%d\">%s</req>" % (i + 1, x) for i, x in enumerate(jd_items)
    )
    return (
        "<resume>\n%s\n</resume>\n\n"
        "<jd requirement_count=\"%d\">\n%s\n</jd>\n\n"
        "<focus>%s</focus>\n\n"
        "上面 JD 共 %d 条要求，requirements 数组必须正好 %d 项，顺序与 id 一致。\n"
        "requirement 字段 = <req> 标签内的文本，逐字照抄，"
        "**不要带上 id、不要加编号前缀、不要加标点**。\n"
        "只输出 JSON。"
        % (resume_text, len(jd_items), tagged, focus,
           len(jd_items), len(jd_items))
    )


def run_case(case, prompt, dry):
    resume_text = load_resume(case["resume"])
    jd_items = case["jd"]["requirements"]
    user = build_user_msg(resume_text, jd_items, case.get("focus", ""))

    if dry:
        # 造一份"完全正确"的假输出，用来验证校验器本身不误报
        fake = {
            "overall": {"score": 0, "verdict": "mismatch", "oneLine": "dry-run"},
            "requirements": [
                {"requirement": x, "status": "unknown", "whyUnclear": "dry-run"}
                for x in jd_items
            ],
            "meta": {"jdRequirementCount": len(jd_items)},
        }
        return fake, {"dry": True}, resume_text, jd_items

    import llm
    report, meta = llm.chat_json(prompt, user)
    return report, meta, resume_text, jd_items


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dry", action="store_true", help="不调模型")
    ap.add_argument("--case", type=int, help="只跑第 N 条（1 起）")
    ap.add_argument("--dump", help="把每条的原始输出存进这个目录，供人工核查")
    args = ap.parse_args()

    prompt = load_prompt()
    jds = load_jds()

    # 跑之前把配置打出来 —— 对比两轮结果时，不写清楚是哪个配置跑的就没法比
    if not args.dry:
        import llm
        print("provider=%s  model=%s  thinking=%s"
              % (llm.PROVIDER, llm.MODEL,
                 "on" if os.environ.get("LLM_THINKING") == "1" else "off"))
        print()

    if args.dump:
        os.makedirs(args.dump, exist_ok=True)

    # 目前只有一份简历 fixture，先和所有 JD 组合跑
    cases = [
        {
            "id": "pm-recsys × %s/%s" % (j["company"], j["title"][:18]),
            "resume": "resume-pm-recsys.txt",
            "jd": j,
        }
        for j in jds
    ]
    if args.case:
        cases = cases[args.case - 1: args.case]

    passed = failed = 0
    cost = {"prompt": 0, "completion": 0}

    for i, case in enumerate(cases, 1):
        print("%s[%d/%d] %s%s" % (DIM, i, len(cases), case["id"], RESET))
        try:
            report, meta, resume_text, jd_items = run_case(case, prompt, args.dry)
        except Exception as e:
            print("  %s✗ 调用失败%s %s" % (RED, RESET, e))
            failed += 1
            continue

        if args.dump:
            safe = "".join(c if c.isalnum() else "_" for c in case["id"])[:60]
            with open(os.path.join(args.dump, "%02d_%s.json" % (i, safe)),
                      "w", encoding="utf-8") as f:
                json.dump({"case": case["id"], "jd": jd_items, "meta": meta,
                           "report": report}, f, ensure_ascii=False, indent=2)

        errs = validator.validate(report, jd_items, resume_text)

        # 分数由规则算，覆盖模型给的
        derived = verdictmod.derive(report.get("requirements") or [])
        model_overall = report.get("overall") or {}

        if meta.get("prompt_tokens"):
            cost["prompt"] += meta["prompt_tokens"]
            cost["completion"] += meta.get("completion_tokens") or 0

        if errs:
            failed += 1
            print("  %s✗ %d 条不变量失败%s" % (RED, len(errs), RESET))
            for e in errs[:6]:
                print("      · %s" % e)
            if len(errs) > 6:
                print("      · …还有 %d 条" % (len(errs) - 6))
        else:
            passed += 1
            print("  %s✓ 三条不变量通过%s" % (GREEN, RESET))

        if not args.dry:
            st = {}
            for r in report.get("requirements") or []:
                st[r.get("status")] = st.get(r.get("status"), 0) + 1
            print("    判定 %s | 规则算分 %d/%s | 模型自报 %s"
                  % (st, derived["score"], derived["verdict"],
                     model_overall.get("verdict")))
            if model_overall.get("verdict") != derived["verdict"]:
                print("    %s↑ 模型自报与规则推导不一致（正常，我们用规则那个）%s"
                      % (YELLOW, RESET))
            print("    %s%.1fs, %s tokens in / %s out%s"
                  % (DIM, meta.get("elapsed", 0), meta.get("prompt_tokens"),
                     meta.get("completion_tokens"), RESET))
        print()

    print("=" * 52)
    print("通过 %s%d%s / 失败 %s%d%s / 共 %d"
          % (GREEN, passed, RESET, RED if failed else DIM, failed, RESET,
             len(cases)))
    if cost["prompt"]:
        print("token 合计：%d in / %d out" % (cost["prompt"], cost["completion"]))
        print("%s（单价按百炼控制台当前 qwen-plus 价目自行折算）%s" % (DIM, RESET))
    if args.dry:
        print("%sdry-run：只验证了分条器和校验器，没调模型%s" % (DIM, RESET))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
