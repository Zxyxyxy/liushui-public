"""JD 任职要求分条 —— 确定性，不用模型。

为什么必须确定性：
    skill 的核心不变量是「JD 有几条要求，输出就有几项」。如果条数由模型自己
    报，这个不变量是自证的、等于没有——模型把两条合并成一条、同时报 count=4，
    校验照样通过。所以条数必须在调模型**之前**算出来，作为外部真值注入。

分条规则按 jobs.db 里 44133 条真实 requirement 统计得出：
    43971 条（99.6%）用换行分条  → 换行为主
    22515 条含「1、」 13635 条含「1.」 → 数字前缀需剥离
    百度系用「-」开头，部分用「•」「·」
    59 条含「1)」 → 括号式极少，一并处理
"""
import re
import unicodedata

# 数字序号前缀。**分隔符后面不能紧跟数字**，否则会吃掉小数和千分位：
#   3.5年以上工作经验   剥成  5年以上工作经验   ← 年限被改小
#   5,000万日活产品经验  剥成  000万日活产品经验 ← 量级被改掉
# 这类损坏逐字校验抓不到，因为 JD 侧和模型输出侧用的是同一份被改坏的文本，
# 两边一致、校验通过，错的是源头。
#
# 判据：真序号的分隔符后面跟文字（`1.本科及以上`），小数点和千分位后面跟数字
# （`3.5年`、`5,000万`）。所以只对可能出现在数字中间的分隔符（. ， ,）加
# (?!\d)，`、` `:` `)` 不会出现在数字内部，无需设限（`2、3年以上经验` 里
# 那个 `3` 是正文，`2、` 是序号，照剥）。
_NUM_PREFIX = (
    r"[（(]\d{1,2}[)）]"        # （1） (1) —— 带括号，无歧义
    r"|\d{1,2}[)）、:：]"       # 1) 1） 1、 1：
    r"|\d{1,2}[.，,](?!\d)"     # 1. 1， —— 但 3.5 / 5,000 不算
)

# 行首序号/项目符号：1、 1. 1) （1） - • · ● ▪ 等
_BULLET = re.compile(
    r"^\s*(?:"
    + _NUM_PREFIX
    + r"|[-—–*•·●▪○◆·]+"              # - • · 等符号
    r"|[一二三四五六七八九十]{1,2}[、.)）]"  # 一、 二、
    r")\s*"
)

# 纯噪声行：只有标题、空白、或"任职要求"这类小标题
_NOISE = re.compile(
    r"^\s*$"
    r"|^[\s\-—=*#]+$"
    r"|^(任职要求|岗位要求|职位要求|我们希望你|你需要具备|Requirements?|Qualifications?)"
    r"[:：]?\s*$",
    re.IGNORECASE,
)


def split_requirements(raw):
    """把 requirement 原文切成一条条要求。

    返回 [str]，每条已剥离序号前缀和首尾标点，但**内容本身逐字保留**
    （evidence 校验和 prompt 里的 requirement 都依赖这个逐字性）。
    """
    if not raw:
        return []
    text = unicodedata.normalize("NFKC", str(raw))

    # 主路径：按换行切
    lines = [ln for ln in text.splitlines()]
    items = [ln for ln in lines if not _NOISE.match(ln)]

    # 回退：整段没换行（0.4% 的数据），按「数字序号」或「；」切
    if len(items) <= 1 and text.strip():
        body = items[0] if items else text
        # 优先按数字序号切，保留序号位置。
        # 这里的分隔符集合比 _NUM_PREFIX 窄（不含 ， , : ：）——切分是在**句中**
        # 找位置，`，` 和 `：` 在正文里太常见，会把一条要求切碎。
        # (?!\d) 同样必要，否则 `3.5年` 会在小数点处被切开。
        parts = re.split(r"(?=[（(]\d{1,2}[)）]|\d{1,2}[)）、]|\d{1,2}\.(?!\d))", body)
        parts = [p for p in parts if p.strip()]
        if len(parts) <= 1:
            parts = re.split(r"[；;]", body)
        items = [p for p in parts if not _NOISE.match(p)]

    out = []
    for it in items:
        s = _BULLET.sub("", it).strip()
        s = s.strip(" \t；;，,。.、")
        # 太短的不是一条要求（多半是切碎的残渣，如「等」「及」「以上」）。
        #
        # 阈值曾经是 6，会丢掉合法的短要求：`熟悉SQL`（5 字）、`本科以上`（4 字）、
        # `英语六级`（4 字）。**丢一条比改坏一条更危险**——条数这个注入 prompt 的
        # 外部真值就少了一条，模型压根没见过它，诊断里这条要求凭空消失，而三条
        # 不变量全绿（两边用的是同一份缺条的列表）。
        #
        # 小标题由 _NOISE 兜，不靠长度。所以这里只需要挡住 1-3 字的残渣。
        # TODO 阈值 4 还没用真实数据验过，跑 test_minlen.py 确认 4/5 字段里
        #      合法要求的占比，再决定要不要再降。
        if len(s) < 4:
            continue
        out.append(s)
    return out


def dedupe_keep_order(items):
    seen = set()
    out = []
    for x in items:
        if x not in seen:
            seen.add(x)
            out.append(x)
    return out
