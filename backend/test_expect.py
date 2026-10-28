"""断言器测试 —— 不调模型，秒级。

expect.py 是质量闸门。闸门本身坏了比没有闸门更糟：没有闸门时你知道自己没在测，
闸门坏了你以为自己在测。所以这里的重点是**它该失败的时候真的失败**，尤其是
两类静默失效：

    选择器空命中  → 必须失败（在空集上「对所有命中项成立」恒真）
    键名拼错      → 必须失败（statusNo 漏个 t 就再也不会报错）

用法:
    python3 test_expect.py
"""
import sys

import expect as ex
import verdict as verdictmod

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"

RESUME = "技能特长\n熟练掌握 React，全量用 TypeScript 编写\n英语 CET-6\n"
JD = ["熟练掌握 React 或 Vue", "熟悉 TypeScript", "有 Node.js 服务端开发经验者优先"]


def rpt(*items):
    return {"requirements": list(items)}


def m(req, quote):
    return {"requirement": req, "status": "matched",
            "evidence": {"quote": quote, "section": "技能特长"}}


def g(req, sev):
    return {"requirement": req, "status": "gap", "severity": sev,
            "suggestion": "补一下"}


def u(req):
    return {"requirement": req, "status": "unknown", "whyUnclear": "没写"}


GOOD = rpt(
    m(JD[0], "熟练掌握 React"),
    m(JD[1], "全量用 TypeScript 编写"),
    g(JD[2], "minor"),
)

# (名字, expect 对象, report, 期望是否通过)
CASES = [
    # ---- 该通过的 ----
    ("全对", {"requirementCount": 3,
              "assert": [{"requirementContains": "者优先", "severityIs": "minor"},
                         {"allMatchedHaveVerbatimEvidence": True},
                         {"orderMatchesJd": True},
                         {"noDuplicateRequirements": True}]},
     GOOD, True),
    ("选择器带空格差异也要能命中",
     {"assert": [{"requirementContains": "Node.js服务端", "statusIs": "gap"}]},
     GOOD, True),
    ("statusNot 没踩中",
     {"assert": [{"requirementContains": "TypeScript", "statusNot": ["gap", "unknown"]}]},
     GOOD, True),

    # ---- 该失败的：静默失效那两类 ----
    ("选择器空命中 —— 恒真，必须报",
     {"assert": [{"requirementContains": "推荐算法", "statusNot": ["matched"]}]},
     GOOD, False),
    ("键名拼错 —— statusNo 漏个 t",
     {"assert": [{"requirementContains": "TypeScript", "statusNo": ["matched"]}]},
     GOOD, False),
    ("只有选择器没有谓词",
     {"assert": [{"requirementContains": "TypeScript"}]}, GOOD, False),
    ("既没选择器也没全局谓词", {"assert": [{"why": "忘了写断言"}]}, GOOD, False),
    ("severityIs 但那条不是 gap —— 不能当没这字段跳过",
     {"assert": [{"requirementContains": "TypeScript", "severityIs": "minor"}]},
     GOOD, False),

    # ---- 该失败的：判定真的错了 ----
    ("statusIs 不符",
     {"assert": [{"requirementContains": "者优先", "statusIs": "matched"}]},
     GOOD, False),
    ("severityIs 不符 —— 者优先判成 blocking",
     {"requirementCount": 3,
      "assert": [{"requirementContains": "者优先", "severityIs": "minor"}]},
     rpt(m(JD[0], "熟练掌握 React"), m(JD[1], "全量用 TypeScript 编写"),
         g(JD[2], "blocking")), False),
    ("evidence 幻觉",
     {"assert": [{"allMatchedHaveVerbatimEvidence": True}]},
     rpt(m(JD[0], "精通 React 源码"), m(JD[1], "全量用 TypeScript 编写"),
         g(JD[2], "minor")), False),
    ("顺序打乱",
     {"assert": [{"orderMatchesJd": True}]},
     rpt(m(JD[1], "全量用 TypeScript 编写"), m(JD[0], "熟练掌握 React"),
         g(JD[2], "minor")), False),
    ("同一条重复凑数",
     {"assert": [{"noDuplicateRequirements": True}]},
     rpt(m(JD[0], "熟练掌握 React"), m(JD[0], "熟练掌握 React"), g(JD[2], "minor")),
     False),
    ("手数条数和分条器不符 —— 报 jd.py 的问题",
     {"requirementCount": 5}, GOOD, False),
    ("verdict 不在白名单里", {"verdict": ["mismatch"]}, GOOD, False),
    ("verdictNot 踩中",
     {"assert": [{"verdictNot": ["strong", "fit"]}]}, GOOD, False),
    ("多条命中时每条都要成立 —— 只有一条踩雷也要报",
     {"assert": [{"requirementContains": "熟", "statusIs": "matched"}]},
     rpt(m(JD[0], "熟练掌握 React"), u(JD[1]), g(JD[2], "minor")), False),
    ("requirements 不是数组", {"requirementCount": 3},
     {"requirements": None}, False),
]


def main():
    bad = 0
    for name, exp, report, want_pass in CASES:
        derived = verdictmod.derive(report.get("requirements") or [])
        errs = ex.check(exp, report, JD, RESUME, derived)
        ok = (not errs) == want_pass
        if not ok:
            bad += 1
        print("%s %-46s %s"
              % ("%s✓%s" % (GREEN, RESET) if ok else "%s✗%s" % (RED, RESET),
                 name, "应通过" if want_pass else "应失败"))
        if not ok:
            print("    %s实际 %s%s"
                  % (RED, "通过了" if not errs else errs, RESET))
        elif errs:
            print("    %s%s%s" % (DIM, errs[0], RESET))

    print()
    if bad:
        print("%s%d 个 case 不符合预期%s" % (RED, bad, RESET))
        return 1
    print("%s全部 %d 个 case 符合预期。断言器该失败的会失败。%s"
          % (GREEN, len(CASES), RESET))
    return 0


if __name__ == "__main__":
    sys.exit(main())
