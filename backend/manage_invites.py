"""邀请码管理（运营用）。

    python3 manage_invites.py create --count 20 --note "内测第一批-班级群"
    python3 manage_invites.py create --count 1 --max-uses 200 --note "公众号推广链接"
    python3 manage_invites.py list

--max-uses 不传默认 1000（一个码可注册 1000 人）。
给不同渠道/推广人用不同的码，note 写清楚渠道名，
list 里就能直接看每个渠道带来多少注册，用于结算推广工资。
"""
import argparse

from db import create_invite_codes, init_db, invite_stats


def main():
    p = argparse.ArgumentParser(description="邀请码管理")
    sub = p.add_subparsers(dest="cmd", required=True)

    c = sub.add_parser("create", help="生成邀请码")
    c.add_argument("--count", type=int, default=1, help="生成几个码")
    c.add_argument("--max-uses", type=int, default=1000, help="每个码最多可注册几人（默认 1000）")
    c.add_argument("--note", default="", help="发给谁 / 哪个渠道")

    sub.add_parser("list", help="查看使用情况")

    args = p.parse_args()
    init_db()

    if args.cmd == "create":
        if args.count < 1 or args.max_uses < 1:
            p.error("--count 和 --max-uses 都必须 >= 1")
        for code in create_invite_codes(args.count, args.max_uses, args.note):
            print(code)
    else:
        rows = invite_stats()
        if not rows:
            print("还没有邀请码")
            return
        print(f"{'邀请码':<10}{'已用/上限':<10}备注")
        for r in rows:
            print(f"{r['code']:<10}{r['used_count']}/{r['max_uses']:<8}{r['note']}")


if __name__ == "__main__":
    main()
