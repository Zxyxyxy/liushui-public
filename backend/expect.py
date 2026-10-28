"""eval.jsonl 的 expect 断言求值 —— 质量闸门，和三条机械不变量是两层不同性质的东西。

为什么必须单独一层：
    三条不变量（覆盖 / requirement 逐字 / evidence 逐字）只管**形式**。
    一条逐字正确的引用，用来支撑一个编出来的推论，三条全绿。实测见过：
    拿「与算法团队对接需求」证明「乐于协作」——引用没错，推论是编的；
    以及把该判 unknown 的学历判成 matched。不变量对这类错判是结构性盲的。

    所以 expect 这层管**判得对不对**。它需要人先把答案写下来（eval.jsonl 里
    那些 statusIs / severityIs），不是自动的，这也是它跑得少的原因。

两个必须堵住的坑 —— 断言层最常见的失效模式是「永远通过」：

  1. 选择器空命中算失败。
     `{"requirementContains": "推荐算法", "statusNot": ["matched"]}`
     如果没有一条 requirement 含「推荐算法」（JD 改了、分条器切碎了），
     "对所有命中项成立" 在空集上恒真，断言静默通过。必须报错。

  2. 不认识的键算失败。
     写成 `statusNo`（漏个 t）就再也不会失败了。这和 `thinking={"type":
     "disabled"}` 被后端静默忽略却仍返回 200 是同一类问题：**不报错不等于生效**。
     所以键是白名单，不在表里就报错。

支持的断言:
    顶层
        requirementCount  int    我们自己切出的条数必须等于它（这是对 jd.py 的检验，
                                 不是对模型的——条数是注入 prompt 的外部真值）
        verdict           [str]  规则推导的 verdict 必须在这个集合里（不看模型自报的）
    assert 数组里，带选择器的
        requirementContains str  选中所有含该子串的 requirement，下面的谓词对每条都要成立
        statusIs          str
        statusNot         [str]
        severityIs        str
        severityNot       [str]
    assert 数组里，全局的（不带选择器）
        verdictNot                   [str]
        allMatchedHaveVerbatimEvidence  bool
        orderMatchesJd                  bool
        noDuplicateRequirements         bool
    说明字段（不参与判定）
        why               str    失败时打出来，写清楚这条断言在防什么
"""
import re
import unicodedata

_WS = re.compile(r"\s+")

_SELECTORS = {"requirementContains"}
_ITEM_PREDS = {"statusIs", "statusNot", "severityIs", "severityNot"}
_GLOBAL_PREDS = {
    "verdictNot",
    "allMatchedHaveVerbatimEvidence",
    "orderMatchesJd",
    "noDuplicateRequirements",
}
_DOC = {"why", "note"}
_KNOWN = _SELECTORS | _ITEM_PREDS | _GLOBAL_PREDS | _DOC


def _norm(s):
    """和 validate._norm 同一套归一：NFKC + 压掉空白。

    必须一致。JD 原文里「3 年以上」带空格，eval.jsonl 里手写的选择器
    「3 年以上」空格位置未必一样，不归一就选不中。
    """
    if not s:
        return ""
    return _WS.sub("", unicodedata.normalize("NFKC", str(s)))


def _select(reqs, needle):
    """返回 [(序号, 条目)]，序号从 1 起，用来在失败信息里定位。"""
    n = _norm(needle)
    return [(i, r) for i, r in enumerate(reqs, 1)
            if isinstance(r, dict) and n in _norm(r.get("requirement"))]


def _check_item(idx, r, key, want):
    """单条谓词。返回错误字符串或 None。"""
    st = r.get("status")
    sev = r.get("severity")
    if key == "statusIs":
        if st != want:
            return "第 %d 项 status 应为 %s，实际 %s" % (idx, want, st)
    elif key == "statusNot":
        if st in want:
            return "第 %d 项 status 不该是 %s" % (idx, st)
    elif key == "severityIs":
        # severity 只存在于 gap。status 不是 gap 时直接算失败，
        # 而不是「没这个字段所以跳过」——跳过就又是一条永不失败的断言。
        if st != "gap":
            return ("第 %d 项要求 severity=%s，但它不是 gap（status=%s），"
                    "severity 无从谈起" % (idx, want, st))
        if sev != want:
            return "第 %d 项 severity 应为 %s，实际 %s" % (idx, want, sev)
    elif key == "severityNot":
        if st == "gap" and sev in want:
            return "第 %d 项 severity 不该是 %s" % (idx, sev)
    return None


def _check_global(key, want, reqs, jd_items, resume_text, derived):
    errs = []
    if key == "verdictNot":
        if derived["verdict"] in want:
            errs.append("规则推导 verdict=%s，在禁止集合 %s 里"
                        % (derived["verdict"], want))
    elif key == "allMatchedHaveVerbatimEvidence":
        if want:
            body = _norm(resume_text)
            for i, r in enumerate(reqs, 1):
                if r.get("status") != "matched":
                    continue
                q = ((r.get("evidence") or {}).get("quote"))
                if not q:
                    errs.append("第 %d 项 matched 却没有 evidence.quote" % i)
                elif _norm(q) not in body:
                    errs.append("第 %d 项 evidence.quote 不在简历原文里：%.36s" % (i, q))
    elif key == "orderMatchesJd":
        if want:
            jd_norm = [_norm(x) for x in jd_items]
            for i, r in enumerate(reqs):
                if i >= len(jd_norm):
                    break
                if _norm(r.get("requirement")) != jd_norm[i]:
                    errs.append("第 %d 项与 JD 第 %d 条不对应" % (i + 1, i + 1))
    elif key == "noDuplicateRequirements":
        if want:
            seen = set()
            for i, r in enumerate(reqs, 1):
                k = _norm(r.get("requirement"))
                if k in seen:
                    errs.append("第 %d 项 requirement 与前面重复" % i)
                seen.add(k)
    return errs


def check(exp, report, jd_items, resume_text, derived):
    """返回 [错误字符串]，空列表 = 这条 case 的质量期望全部满足。

    exp         eval.jsonl 里那个 expect 对象
    derived     verdict.derive() 的结果 —— 用规则算的，不用模型自报的
    """
    errs = []
    reqs = report.get("requirements")
    if not isinstance(reqs, list):
        return ["requirements 不是数组，质量断言无从谈起"]

    # ---- 顶层：条数 ----
    # 注意比的是 len(jd_items) 而不是 len(reqs)。前者是 jd.py 切出来的，
    # 手数的 requirementCount 对不上它 = 分条器错了；后者对不上是覆盖不变量
    # 的事，validate.py 已经管了。两件事分开报。
    want_n = exp.get("requirementCount")
    if want_n is not None and want_n != len(jd_items):
        errs.append("分条器切出 %d 条，eval 手数是 %d 条 —— jd.py 的问题，"
                    "不是模型的" % (len(jd_items), want_n))

    # ---- 顶层：verdict 白名单 ----
    want_v = exp.get("verdict")
    if want_v and derived["verdict"] not in want_v:
        errs.append("规则推导 verdict=%s（%d 分），期望在 %s 里"
                    % (derived["verdict"], derived["score"], want_v))

    # ---- assert 数组 ----
    for n, a in enumerate(exp.get("assert") or [], 1):
        why = a.get("why") or ""
        tail = "（%s）" % why if why else ""

        unknown_keys = set(a) - _KNOWN
        if unknown_keys:
            errs.append("assert[%d] 有不认识的键 %s —— 拼错的断言永远不会失败，"
                        "所以这里按失败算" % (n, sorted(unknown_keys)))
            continue

        needle = a.get("requirementContains")
        if needle is not None:
            hits = _select(reqs, needle)
            if not hits:
                errs.append("assert[%d] 选择器「%s」没命中任何 requirement —— "
                            "断言在空集上恒真，等于没写%s" % (n, needle, tail))
                continue
            preds = set(a) & _ITEM_PREDS
            if not preds:
                errs.append("assert[%d] 只有选择器没有谓词，什么都没断言" % n)
                continue
            for idx, r in hits:
                for key in preds:
                    e = _check_item(idx, r, key, a[key])
                    if e:
                        errs.append("assert[%d] %s%s" % (n, e, tail))
        else:
            preds = set(a) & _GLOBAL_PREDS
            if not preds:
                errs.append("assert[%d] 既没有选择器也没有全局谓词，什么都没断言" % n)
                continue
            for key in preds:
                for e in _check_global(key, a[key], reqs, jd_items,
                                       resume_text, derived):
                    errs.append("assert[%d] %s%s" % (n, e, tail))

    return errs
