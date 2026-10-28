"""校验器的反向测试 —— 不调模型，不花钱，秒级。

**不会失败的校验器等于没有。** validate.py 是整个 skill 唯一的质量闸门
（百炼兼容接口不支持 json_schema，schema 只能靠模型自觉遵循），所以必须
证明它对每一类已知违规都会报错，而不只是对正确输出放行。

每个 case 对应一个真实出现过或预计会出现的失败模式，不是凭空造的。

用法:
    python3 test_validate.py
"""
import sys

import validate

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"

JD = [
    "本科及以上学历,工作时间3-5年",
    "良好的逻辑分析及沟通表达能力",
    "熟悉推荐系统或搜索排序",
]
RESUME = (
    "教育经历\n"
    "某大学 工商管理 本科 2019-2023\n"
    "工作经历\n"
    "某公司 产品经理 2023-2026\n"
    "  负责推荐策略的需求梳理与 A/B 实验设计\n"
    "  与算法团队协作推进大模型相关功能落地\n"
)


def ok(**kw):
    """一份完全合法的输出，各 case 在它基础上改坏一处。"""
    base = {
        "overall": {"score": 50, "verdict": "stretch", "oneLine": "x"},
        "requirements": [
            {
                "requirement": JD[0],
                "status": "matched",
                "evidence": {"quote": "某大学 工商管理 本科 2019-2023",
                             "section": "教育经历"},
            },
            {
                "requirement": JD[1],
                "status": "unknown",
                "whyUnclear": "简历没有可判断沟通表达的具体事实",
            },
            {
                "requirement": JD[2],
                "status": "gap",
                "severity": "blocking",
                "suggestion": "补一段真实参与排序策略的经历",
            },
        ],
        "meta": {"jdRequirementCount": 3},
    }
    base.update(kw)
    return base


def merged():
    """两条合并成一条 —— 模型最常见的错，且会让「覆盖」自证。"""
    r = ok()
    r["requirements"] = r["requirements"][1:]
    r["requirements"][0]["requirement"] = JD[0] + " " + JD[1]
    r["meta"]["jdRequirementCount"] = 2
    return r


def rewritten():
    """requirement 被改写成更顺口的话 —— 逐字这条就没了。"""
    r = ok()
    r["requirements"][0]["requirement"] = "本科及以上,3到5年经验"
    return r


def numbered_prefix():
    """带上 prompt 里的编号前缀 —— 真实发生过（百度 AI 策略产品经理那条）。"""
    r = ok()
    r["requirements"][0]["requirement"] = "1. " + JD[0]
    return r


def reordered():
    """顺序被打乱 —— 逐字全过，只有顺序错。检验顺序那条是独立生效的。"""
    r = ok()
    rs = r["requirements"]
    rs[0], rs[1] = rs[1], rs[0]
    return r


def hallucinated_evidence():
    """evidence 引了简历里没有的话 —— 最危险的一类，会直接骗到用户。"""
    r = ok()
    r["requirements"][0]["evidence"]["quote"] = "某大学 计算机科学 硕士 2019-2023"
    return r


def gap_no_severity():
    r = ok()
    del r["requirements"][2]["severity"]
    return r


def gap_no_suggestion():
    r = ok()
    del r["requirements"][2]["suggestion"]
    return r


def unknown_no_why():
    """unknown 不带理由 —— 那 unknown 就退化成了逃避档位。"""
    r = ok()
    del r["requirements"][1]["whyUnclear"]
    return r


def matched_no_evidence():
    r = ok()
    del r["requirements"][0]["evidence"]
    return r


def bad_status():
    r = ok()
    r["requirements"][0]["status"] = "partial"
    return r


def duplicated():
    """同一条抄两遍来凑数 —— 条数对了，覆盖其实没做到。"""
    r = ok()
    r["requirements"][2] = dict(r["requirements"][0])
    return r


def whitespace_variant():
    """全角/空白差异 —— 这个**必须放行**，否则合法引用被当幻觉。

    pypdf layout 模式会在列间插大段空格，NFKC 也改写字符。
    这是反向测试里唯一一条「期望通过」的。
    """
    r = ok()
    r["requirements"][0]["requirement"] = "本科及以上学历，工作时间3-5年"
    r["requirements"][0]["evidence"]["quote"] = "某大学   工商管理   本科 2019-2023"
    return r


# (名字, 构造函数, 期望报错)
CASES = [
    ("正确输出", ok, False),
    ("全角/空白差异", whitespace_variant, False),
    ("两条合并成一条", merged, True),
    ("requirement 被改写", rewritten, True),
    ("带编号前缀", numbered_prefix, True),
    ("顺序打乱", reordered, True),
    ("evidence 幻觉", hallucinated_evidence, True),
    ("gap 缺 severity", gap_no_severity, True),
    ("gap 缺 suggestion", gap_no_suggestion, True),
    ("unknown 缺 whyUnclear", unknown_no_why, True),
    ("matched 缺 evidence", matched_no_evidence, True),
    ("status 非法值", bad_status, True),
    ("同一条重复凑数", duplicated, True),
]


def main():
    bad = 0
    for name, make, want_err in CASES:
        errs = validate.validate(make(), JD, RESUME)
        got_err = bool(errs)
        if got_err == want_err:
            tag = "%s✓%s" % (GREEN, RESET)
        else:
            tag = "%s✗%s" % (RED, RESET)
            bad += 1
        print("%s %-22s 期望%s 实际%s"
              % (tag, name,
                 "报错" if want_err else "放行",
                 "报错" if got_err else "放行"))
        if errs and got_err == want_err:
            print("    %s%s%s" % (DIM, errs[0][:72], RESET))
        elif errs and got_err != want_err:
            for e in errs:
                print("    %s%s%s" % (RED, e[:72], RESET))

    print()
    if bad:
        print("%s%d 个 case 不符合预期%s" % (RED, bad, RESET))
        return 1
    print("%s全部 %d 个 case 符合预期。校验器该抓的抓、该放的放。%s"
          % (GREEN, len(CASES), RESET))
    return 0


if __name__ == "__main__":
    sys.exit(main())
