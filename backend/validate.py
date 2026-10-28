"""三条机械不变量校验 —— 不需要人判，可直接当 CI。

百炼兼容接口不支持 json_schema，schema 只能写在 prompt 里靠模型遵循。
所以这一层不是"加固"，是**必须有**：没有它，模型跑偏你根本不知道。

三条：
  1. 覆盖    —— 输出条数 == 我们自己算出的 JD 条数（条数是外部真值，不是模型报的）
  2. requirement 逐字 —— 每条必须逐字取自我们切出的 JD 原文
  3. evidence 逐字   —— 每条 matched 的 quote 必须逐字出现在简历正文里

第 3 条的陷阱：pypdf layout 模式会在列间插入大段空格，NFKC 也会改写字符。
所以逐字比对必须在「压掉空白 + NFKC 归一」之后做，否则合法引用会被误判为
幻觉。见 _norm。
"""
import re
import unicodedata

_WS = re.compile(r"\s+")


def _norm(s):
    """归一化后再比对：NFKC + 压掉所有空白。"""
    if not s:
        return ""
    return _WS.sub("", unicodedata.normalize("NFKC", str(s)))



def validate(report, jd_items, resume_text):
    """返回 [错误字符串]，空列表 = 通过。"""
    errs = []

    reqs = report.get("requirements")
    if not isinstance(reqs, list):
        return ["requirements 不是数组"]

    # ---- 不变量 1：覆盖 ----
    if len(reqs) != len(jd_items):
        errs.append(
            "覆盖不符：JD 实际 %d 条，输出 %d 条" % (len(jd_items), len(reqs))
        )

    declared = (report.get("meta") or {}).get("jdRequirementCount")
    if declared is not None and declared != len(jd_items):
        errs.append(
            "meta.jdRequirementCount=%s 与实际 %d 条不符" % (declared, len(jd_items))
        )

    # ---- 不变量 2：requirement 逐字 ----
    jd_norm = [_norm(x) for x in jd_items]
    jd_set = set(jd_norm)
    seen = set()
    for i, r in enumerate(reqs):
        if not isinstance(r, dict):
            errs.append("第 %d 项不是对象" % (i + 1))
            continue
        rq = _norm(r.get("requirement"))
        verbatim_ok = False
        if not rq:
            errs.append("第 %d 项 requirement 为空" % (i + 1))
        elif rq not in jd_set:
            errs.append(
                "第 %d 项 requirement 不是 JD 原文（改写/合并/拆分）：%.40s"
                % (i + 1, r.get("requirement"))
            )
        else:
            verbatim_ok = True
        if rq in seen:
            errs.append("第 %d 项 requirement 重复" % (i + 1))
        seen.add(rq)

        # 顺序 —— 只在逐字过了之后才查。
        # 否则一个根因报两条错：逐字挂的那项必然也 != jd_norm[i]，
        # 顺序错误就成了噪音，把真正的顺序问题淹掉。
        if verbatim_ok and i < len(jd_norm) and rq != jd_norm[i]:
            errs.append("第 %d 项顺序与 JD 不一致" % (i + 1))

        # ---- 状态与必填字段 ----
        st = r.get("status")
        if st not in ("matched", "gap", "unknown"):
            errs.append("第 %d 项 status 非法：%s" % (i + 1, st))
            continue

        if st == "matched":
            ev = r.get("evidence") or {}
            quote = ev.get("quote")
            if not quote:
                errs.append("第 %d 项 matched 但没有 evidence.quote" % (i + 1))
            # ---- 不变量 3：evidence 逐字 ----
            elif _norm(quote) not in _norm(resume_text):
                errs.append(
                    "第 %d 项 evidence.quote 不在简历原文里（幻觉）：%.40s"
                    % (i + 1, quote)
                )
            if not ev.get("section"):
                errs.append("第 %d 项 matched 但没有 evidence.section" % (i + 1))
        elif st == "gap":
            if r.get("severity") not in ("blocking", "major", "minor"):
                errs.append(
                    "第 %d 项 gap 的 severity 非法：%s" % (i + 1, r.get("severity"))
                )
            if not r.get("suggestion"):
                errs.append("第 %d 项 gap 但没有 suggestion" % (i + 1))
        else:
            if not r.get("whyUnclear"):
                errs.append("第 %d 项 unknown 但没有 whyUnclear" % (i + 1))

    return errs
