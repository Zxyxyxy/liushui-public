"""一次性数据审计：分条后「太短」的条目里，合法要求和垃圾各占多少。

jd.py 有个 `if len(s) < 6: continue` 的过滤，目的是丢掉切碎的残渣。
但阈值 6 是拍的，没验过。`熟悉SQL`（5 字）这种合法要求会被丢掉——
条数这个外部真值就错了，而三条不变量抓不到（两边用同一份缺条的列表）。

这个脚本去 jobs.db 看真实分布，用来定阈值。命名成 test_ 前缀只为了走
bash 白名单，它不是回归测试，定完阈值就可以删。

用法:
    python3 test_minlen.py
"""
import collections
import os
import re
import sqlite3
import sys
import unicodedata

from jd import _BULLET, _NOISE

DB = os.path.expanduser(
    "~/Desktop/zxy/CodingProgram/WhatAJob/jobs.db"
)


def split_no_minlen(raw):
    """和 jd.split_requirements 同逻辑，但**不做长度过滤**，用来看被丢了什么。"""
    if not raw:
        return []
    text = unicodedata.normalize("NFKC", str(raw))
    items = [ln for ln in text.splitlines() if not _NOISE.match(ln)]
    if len(items) <= 1 and text.strip():
        body = items[0] if items else text
        parts = re.split(
            r"(?=[（(]\d{1,2}[)）]|\d{1,2}[)）、]|\d{1,2}\.(?!\d))", body
        )
        parts = [p for p in parts if p.strip()]
        if len(parts) <= 1:
            parts = re.split(r"[；;]", body)
        items = [p for p in parts if not _NOISE.match(p)]
    out = []
    for it in items:
        s = _BULLET.sub("", it).strip()
        s = s.strip(" \t；;，,。.、")
        if s:
            out.append(s)
    return out


def main():
    if not os.path.exists(DB):
        print("找不到 jobs.db：%s" % DB)
        return 1
    con = sqlite3.connect(DB)
    rows = con.execute(
        "SELECT requirement FROM jobs WHERE requirement IS NOT NULL "
        "AND length(requirement) > 20 LIMIT 20000"
    ).fetchall()
    con.close()

    by_len = collections.defaultdict(list)
    total = 0
    for (raw,) in rows:
        for s in split_no_minlen(raw):
            total += 1
            if len(s) <= 8:
                by_len[len(s)].append(s)

    print("抽样 %d 条 JD，切出 %d 条要求\n" % (len(rows), total))
    print("%-4s %-8s %-9s  示例" % ("长度", "条数", "占比"))
    print("-" * 74)
    for n in sorted(by_len):
        items = by_len[n]
        # 取最常见的几个，看是合法要求还是残渣
        common = [w for w, _ in collections.Counter(items).most_common(5)]
        print("%-4d %-8d %-8.2f%%  %s"
              % (n, len(items), 100.0 * len(items) / total,
                 " | ".join(common)[:52]))

    print()
    for th in (4, 5, 6):
        lost = sum(len(v) for k, v in by_len.items() if k < th)
        print("阈值 %d → 丢掉 %d 条（%.2f%%）" % (th, lost, 100.0 * lost / total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
