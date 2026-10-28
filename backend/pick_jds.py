"""从 jobs.db 取真实 JD 存成 fixtures，替换 eval 里手写的占位。

用法:
    python3 pick_jds.py                 # 默认取 6 条，覆盖不同岗位族
    python3 pick_jds.py --keyword 算法 --n 3
"""
import argparse
import json
import os
import sqlite3

import jd as jdmod

DB = os.path.expanduser(
    "~/Desktop/zxy/CodingProgram/WhatAJob/data/jobs.db"
)
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)),
                   "..", "skills", "resume-jd-match", "fixtures", "jds.json")

# 覆盖不同岗位族，用来测 family 错配那一类
DEFAULT_PICKS = [
    ("推荐算法", None),
    ("后端开发", None),
    ("前端开发", None),
    ("产品经理", None),
    ("数据分析", None),
    ("测试开发", None),
]


def fetch(conn, keyword, min_items=4, max_items=9):
    """取一条 requirement 能干净切成 min_items~max_items 条的真实 JD。"""
    rows = conn.execute(
        """SELECT company, title, location, requirement, url
           FROM jobs
           WHERE title LIKE ? AND requirement IS NOT NULL
             AND LENGTH(requirement) BETWEEN 100 AND 900
           ORDER BY LENGTH(requirement)
           LIMIT 60""",
        ("%" + keyword + "%",),
    ).fetchall()
    for r in rows:
        items = jdmod.split_requirements(r["requirement"])
        if min_items <= len(items) <= max_items:
            return {
                "company": r["company"],
                "title": r["title"],
                "location": r["location"],
                "url": r["url"],
                "requirements_raw": r["requirement"],
                "requirements": items,
                "requirementCount": len(items),
            }
    return None


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--keyword")
    ap.add_argument("--n", type=int, default=6)
    ap.add_argument("--db", default=DB)
    args = ap.parse_args()

    conn = sqlite3.connect(args.db)
    conn.row_factory = sqlite3.Row

    picks = [(args.keyword, None)] if args.keyword else DEFAULT_PICKS[: args.n]
    out = []
    for kw, _ in picks:
        got = fetch(conn, kw)
        if got:
            out.append(got)
            print("✓ %-8s → [%s] %s（%d 条要求）"
                  % (kw, got["company"], got["title"], got["requirementCount"]))
        else:
            print("✗ %-8s → 没找到合适的" % kw)
    conn.close()

    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(out, f, ensure_ascii=False, indent=2)
    print("\n已写入 %s（%d 条）" % (os.path.normpath(OUT), len(out)))


if __name__ == "__main__":
    main()
