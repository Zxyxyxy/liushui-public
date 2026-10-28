"""分条器测试 —— 不调模型，秒级。

jd.py 和 validate.py 一样是承重的：**条数是注入 prompt 的外部真值**，
分条错了，下游全错，而且三条不变量抓不到——JD 侧和模型输出侧用的是同一份
被改坏的文本，两边一致、校验通过，错的是源头。

重点防「内容被悄悄改掉」这一类：剥序号时吃掉小数点、千分位。

用法:
    python3 test_jd.py
"""
import sys

from jd import split_requirements, _BULLET

GREEN, RED, DIM, RESET = "\033[32m", "\033[31m", "\033[2m", "\033[0m"

# (输入, 期望 _BULLET 剥完的结果)
BULLET_CASES = [
    # --- 必须剥掉的真序号 ---
    ("1. 本科及以上学历", "本科及以上学历"),
    ("2、熟悉SQL", "熟悉SQL"),
    ("3)熟悉推荐系统", "熟悉推荐系统"),
    ("（4）有大规模落地经验", "有大规模落地经验"),
    ("10.统招本科", "统招本科"),
    ("- 熟悉 Java", "熟悉 Java"),
    ("• 有电商经验", "有电商经验"),
    ("一、专业不限", "专业不限"),
    ("2、3年以上经验", "3年以上经验"),  # 序号 2、+ 正文 3年——`、`不会出现在数字内部

    # --- 绝不能碰的：数字本身 ---
    ("3.5年以上工作经验", "3.5年以上工作经验"),
    ("5,000万日活产品经验", "5,000万日活产品经验"),
    ("1.5年以上相关经验", "1.5年以上相关经验"),
    ("2.0以上绩点", "2.0以上绩点"),
    ("1年以上推荐系统经验", "1年以上推荐系统经验"),
    ("本科及以上学历", "本科及以上学历"),
    ("CET-6 及以上", "CET-6 及以上"),
]


def check_bullet():
    bad = 0
    print("=== _BULLET 剥序号 ===")
    for raw, want in BULLET_CASES:
        got = _BULLET.sub("", raw)
        ok = got == want
        if not ok:
            bad += 1
        print("%s %-26s → %r%s"
              % ("%s✓%s" % (GREEN, RESET) if ok else "%s✗%s" % (RED, RESET),
                 raw, got, "" if ok else "  %s期望 %r%s" % (RED, want, RESET)))
    return bad


def check_split():
    """分条结果必须逐字保留内容，只剥序号。"""
    bad = 0
    print()
    print("=== split_requirements ===")

    cases = [
        (
            "换行 + 序号（99.6% 的真实数据走这条）",
            "任职要求：\n1. 本科及以上学历\n2. 3.5年以上工作经验\n3. 熟悉SQL",
            ["本科及以上学历", "3.5年以上工作经验", "熟悉SQL"],
        ),
        (
            "无换行，按序号回退切（0.4%）",
            "1、本科及以上学历；2、熟悉推荐系统；3、有1.5年以上经验",
            ["本科及以上学历", "熟悉推荐系统", "有1.5年以上经验"],
        ),
        (
            "无换行无序号，按分号切",
            "熟悉 Java 或 Go；熟悉 MySQL、Redis；有高并发服务经验",
            ["熟悉 Java 或 Go", "熟悉 MySQL、Redis", "有高并发服务经验"],
        ),
        (
            "小标题和空行要丢掉",
            "岗位要求\n\n- 计算机相关专业\n\n- 熟悉 Python\n",
            ["计算机相关专业", "熟悉 Python"],
        ),
        (
            "带小数的要求不能被切开",
            "1. 3.5年以上经验\n2. 日活5,000万以上产品经验",
            ["3.5年以上经验", "日活5,000万以上产品经验"],
        ),
        (
            "短要求不能被长度过滤丢掉",
            "1. 熟悉SQL\n2. 本科以上\n3. 英语六级",
            ["熟悉SQL", "本科以上", "英语六级"],
        ),
        (
            "1-3 字的残渣该丢",
            "1. 熟悉推荐系统\n2. 等\n3. 及以上",
            ["熟悉推荐系统"],
        ),
    ]

    for name, raw, want in cases:
        got = split_requirements(raw)
        ok = got == want
        if not ok:
            bad += 1
        print("%s %s"
              % ("%s✓%s" % (GREEN, RESET) if ok else "%s✗%s" % (RED, RESET), name))
        if ok:
            print("    %s%s%s" % (DIM, got, RESET))
        else:
            print("    %s实际 %s%s" % (RED, got, RESET))
            print("    %s期望 %s%s" % (DIM, want, RESET))
    return bad


def main():
    bad = check_bullet() + check_split()
    print()
    if bad:
        print("%s%d 个 case 不符合预期%s" % (RED, bad, RESET))
        return 1
    print("%s全部通过。序号剥干净了，数字没被动。%s" % (GREEN, RESET))
    return 0


if __name__ == "__main__":
    sys.exit(main())
