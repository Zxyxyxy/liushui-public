"""单次诊断 —— 拿任意一份简历和任意一条 JD 跑一遍，人类可读地打出来。

和 run_eval.py 的分工：
    run_eval.py  跑固定 fixtures，输出红绿灯，回归用
    diagnose.py  跑任意输入，输出可读报告，人工核判定用

用法:
    # JD 从文件读
    python3 diagnose.py --resume private/我的简历.txt --jd private/jd.txt

    # JD 直接粘在命令行（注意会进 shell history，简历别这么传）
    python3 diagnose.py --resume private/我的简历.txt --jd-text "1、本科及以上..."

    # 用已有的真实 JD fixture（1-6），省得自己找 JD
    python3 diagnose.py --resume private/我的简历.txt --jd-fixture 1

    # 跟全部 6 条真实 JD 挨个比
    python3 diagnose.py --resume private/我的简历.txt --all-fixtures

⚠️ 真实简历放 private/（已在 .gitignore 里），不要放 fixtures/——那个目录
   要提交，只放手造的假简历。
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

GREEN, RED, YELLOW, CYAN, DIM, BOLD, RESET = (
    "\033[32m", "\033[31m", "\033[33m", "\033[36m", "\033[2m", "\033[1m",
    "\033[0m"
)

_MARK = {"matched": "%s✓%s" % (GREEN, RESET),
         "gap": "%s✗%s" % (RED, RESET),
         "unknown": "%s?%s" % (YELLOW, RESET)}


def read_resume(path):
    """读简历。PDF/DOCX 还不支持 —— parser 模块还没从 serve.py 抽出来。"""
    ext = os.path.splitext(path)[1].lower()
    if ext in (".pdf", ".docx", ".doc"):
        raise SystemExit(
            "还不能直接读 %s。\n"
            "  parser 模块（PDF/DOCX → 结构化）还没从 WhatAJob 的 serve.py 抽出来，\n"
            "  这是 backend/README.md 里记着的待办。\n"
            "\n"
            "  现在的办法：把简历内容复制成 .txt 再传进来。\n"
            "  建议保留章节标题（教育经历 / 实习经历 / 技能特长），\n"
            "  evidence.section 字段依赖它们定位。" % ext
        )
    with open(path, encoding="utf-8") as f:
        return f.read()


def load_jd_items(args):
    """返回 [(标签, [要求...])]。"""
    if args.jd:
        with open(args.jd, encoding="utf-8") as f:
            raw = f.read()
        return [(os.path.basename(args.jd), jdmod.split_requirements(raw))]

    if args.jd_text:
        return [("命令行 JD", jdmod.split_requirements(args.jd_text))]

    with open(os.path.join(SKILL, "fixtures", "jds.json"), encoding="utf-8") as f:
        jds = json.load(f)
    if args.all_fixtures:
        return [("%s/%s" % (j["company"], j["title"][:20]), j["requirements"])
                for j in jds]
    n = args.jd_fixture or 1
    if not 1 <= n <= len(jds):
        raise SystemExit("--jd-fixture 要在 1-%d 之间" % len(jds))
    j = jds[n - 1]
    return [("%s/%s" % (j["company"], j["title"][:20]), j["requirements"])]


def build_user_msg(resume_text, jd_items, focus=""):
    """和 run_eval.py 保持一致 —— 编号进 id 属性，不做行内前缀。

    两处必须同步：这里改了 run_eval.py 也要改，否则 eval 验过的 prompt
    和实际跑的不是同一个。
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


def show(label, report, jd_items, resume_text, meta):
    print("%s%s%s" % (BOLD, label, RESET))

    errs = validator.validate(report, jd_items, resume_text)
    derived = verdictmod.derive(report.get("requirements") or [])
    model_overall = report.get("overall") or {}

    if errs:
        print("  %s✗ %d 条不变量失败%s" % (RED, len(errs), RESET))
        for e in errs[:8]:
            print("      · %s" % e)
        print("  %s判定内容仍打在下面，但这次输出不可信%s" % (DIM, RESET))
    else:
        print("  %s✓ 三条机械不变量通过%s" % (GREEN, RESET))

    print()
    print("  %s结论%s  %s%d 分 / %s%s" % (DIM, RESET, BOLD, derived["score"],
                                        derived["verdict"], RESET))
    if model_overall.get("verdict") != derived["verdict"]:
        print("  %s（模型自报 %s，不一致是正常的，我们用规则算的那个）%s"
              % (DIM, model_overall.get("verdict"), RESET))
    if model_overall.get("oneLine"):
        print("  %s一句话%s  %s" % (DIM, RESET, model_overall["oneLine"]))

    print()
    for r in report.get("requirements") or []:
        st = r.get("status")
        print("  %s %s" % (_MARK.get(st, st), r.get("requirement")))
        if st == "matched":
            ev = r.get("evidence") or {}
            print("      %s凭据%s 「%s」 %s(%s)%s"
                  % (CYAN, RESET, ev.get("quote"), DIM, ev.get("section"), RESET))
        elif st == "gap":
            print("      %s缺口%s %s  %s→ %s%s"
                  % (RED, RESET, r.get("severity"), DIM, r.get("suggestion"),
                     RESET))
        else:
            print("      %s看不出%s %s%s%s"
                  % (YELLOW, RESET, DIM, r.get("whyUnclear"), RESET))

    st_count = {}
    for r in report.get("requirements") or []:
        st_count[r.get("status")] = st_count.get(r.get("status"), 0) + 1
    print()
    print("  %s%s | %.1fs | %s in / %s out tokens | %s%s"
          % (DIM, st_count, meta.get("elapsed", 0), meta.get("prompt_tokens"),
             meta.get("completion_tokens"), meta.get("model"), RESET))
    print()
    return not errs


def main():
    ap = argparse.ArgumentParser(
        description="拿一份简历和一条 JD 跑一次诊断",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    ap.add_argument("--resume", required=True, help="简历 .txt 路径")
    g = ap.add_mutually_exclusive_group()
    g.add_argument("--jd", help="JD 原文 .txt 路径")
    g.add_argument("--jd-text", help="JD 原文直接写在命令行")
    g.add_argument("--jd-fixture", type=int, help="用第 N 条真实 JD fixture（1-6）")
    g.add_argument("--all-fixtures", action="store_true",
                   help="跟全部 6 条真实 JD 挨个比")
    ap.add_argument("--focus", default="", help="特别想知道什么")
    ap.add_argument("--dump", help="原始 JSON 存到这个目录")
    args = ap.parse_args()

    resume_text = read_resume(args.resume)
    jobs = load_jd_items(args)

    import llm
    print()
    print("%s简历 %s（%d 字）| %s / %s | thinking=%s%s"
          % (DIM, os.path.basename(args.resume), len(resume_text),
             llm.PROVIDER, llm.MODEL,
             "on" if os.environ.get("LLM_THINKING") == "1" else "off", RESET))
    print()

    if args.dump:
        os.makedirs(args.dump, exist_ok=True)

    with open(os.path.join(SKILL, "prompt.md"), encoding="utf-8") as f:
        prompt = f.read()

    clean = 0
    for i, (label, jd_items) in enumerate(jobs, 1):
        if not jd_items:
            print("%s✗ %s 分条后是空的，JD 原文可能格式不对%s" % (RED, label, RESET))
            continue
        user = build_user_msg(resume_text, jd_items, args.focus)
        try:
            report, meta = llm.chat_json(prompt, user)
        except Exception as e:
            print("%s✗ %s 调用失败%s %s" % (RED, label, RESET, e))
            continue

        if args.dump:
            with open(os.path.join(args.dump, "%02d.json" % i), "w",
                      encoding="utf-8") as f:
                json.dump({"label": label, "jd": jd_items, "meta": meta,
                           "report": report}, f, ensure_ascii=False, indent=2)

        if show("[%d/%d] %s" % (i, len(jobs), label), report, jd_items,
                resume_text, meta):
            clean += 1

    if len(jobs) > 1:
        print("=" * 52)
        print("不变量全过 %d / %d" % (clean, len(jobs)))
    return 0


if __name__ == "__main__":
    sys.exit(main())
