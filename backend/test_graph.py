"""图结构测试：用假执行器验证节点流转、重试循环、分支，不花钱不联网。

跑法：python3 -W ignore test_graph.py
"""
from graph import build_graph
from graph import nodes
from skill_executor import SkillResult


class FakeSkill:
    def __init__(self, i, n, p, sc):
        self.id, self.name, self.promise, self.scene = i, n, p, sc


SKILLS = {
    "excel-formula": FakeSkill("excel-formula", "Excel 公式解释", "拆解公式", "study"),
    "resume-fix": FakeSkill("resume-fix", "简历修改", "重写经历", "job"),
    # 纯 fixture：故意不在 FakeExec.skill_prompts 里，用来打 skip 分支。
    # 不要换成真实 skill id——上架列表里的 skill 现在应当全部可执行。
    "not-executable": FakeSkill("not-executable", "未接入执行的 skill", "仅用于测试 skip 分支", "job"),
}

GOOD = "## 结果\n\n" + "这是一份足够长的真实输出内容，包含具体的分析和建议。" * 4


class FakeExec:
    """可编程的假执行器。outputs 是每次调用依次返回的结果。"""

    skill_prompts = {"excel-formula": "x", "resume-fix": "y"}
    client = None
    model = "fake"

    def __init__(self, outputs):
        self.outputs = list(outputs)
        self.calls = 0

    def execute(self, sid, fields, max_tokens=8000):
        self.calls += 1
        out = self.outputs.pop(0) if self.outputs else GOOD
        if isinstance(out, str):
            return SkillResult(success=True, output=out, credits_used=17)
        return out  # 直接给 SkillResult（测失败路径）


def run(name, executor, state):
    """跑一次图并打印关键结果。LLM 检验会因 client=None 失败而自动跳过。"""
    nodes.set_deps(executor=executor, skills=SKILLS, fallback_search=None)
    app = build_graph()
    r = app.invoke(state)
    print(f"\n── {name} ──")
    print(f"  执行次数    : {getattr(executor, 'calls', 0)}")
    print(f"  chosen_skill: {r.get('chosen_skill')}")
    print(f"  valid       : {r.get('valid')}")
    print(f"  retry_count : {r.get('retry_count')}")
    print(f"  notes       : {r.get('validation_notes')}")
    rec = r.get("workspace_record") or {}
    print(f"  ws.status   : {(rec.get('run') or {}).get('status')}")
    print(f"  ws.todos    : {rec.get('suggested_todos')}")
    print(f"  output[:60] : {(r.get('final_output') or '')[:60]!r}")
    return r


if __name__ == "__main__":
    print("=" * 64)
    print("LangGraph 图结构测试（假执行器，不调真实 LLM）")
    print("=" * 64)

    # 1. 一次就成功
    ex = FakeExec([GOOD])
    r = run("正常路径：一次成功", ex,
            {"skill_id": "excel-formula", "user_fields": {"formula": "=A1"}})
    assert r.get("valid") is True
    assert ex.calls == 1, f"不该重试，实际执行 {ex.calls} 次"
    assert r.get("retry_count", 0) == 0

    # 2. 前两次输出过短 → 触发重试 → 第三次成功
    #    MAX_RETRY=2 的含义是「额外重跑 2 次」，所以总共该执行 3 次。
    ex = FakeExec(["短", "还是短", GOOD])
    r = run("重试路径：2次太短后成功", ex,
            {"skill_id": "excel-formula", "user_fields": {"formula": "=A1"}})
    assert r.get("valid") is True, "重试后应成功"
    assert ex.calls == 3, f"应执行 3 次（首次 + 2 次重试），实际 {ex.calls} 次"
    assert r.get("retry_count") == 2, f"应记 2 次重试，实际 {r.get('retry_count')}"

    # 3. 一直失败 → 重试耗尽放弃。执行次数必须被 MAX_RETRY 卡住，不能无限循环
    ex = FakeExec(["短", "短", "短", "短", "短"])
    r = run("放弃路径：始终太短", ex,
            {"skill_id": "excel-formula", "user_fields": {"formula": "=A1"}})
    assert r.get("valid") is not True, "重试耗尽应判失败"
    assert ex.calls == 3, f"应在 3 次执行后放弃，实际 {ex.calls} 次"
    assert r["workspace_record"]["run"]["status"] == "failed"
    assert "已自动重试 2 次" in r["final_output"], "失败说明里的次数要和实际一致"

    # 4. skill 不可执行 → skip 分支，只给推荐
    ex = FakeExec([GOOD])
    r = run("skip 路径：skill 未接入执行", ex,
            {"skill_id": "not-executable", "user_fields": {}})
    assert r["workspace_record"]["run"]["status"] == "skipped"
    assert r.get("valid") is not True
    assert ex.calls == 0, "skip 分支不该调执行器"

    # 5. 执行器返回失败（缺参数）→ 不重试，直接失败
    ex = FakeExec([SkillResult(success=False, output="", credits_used=0,
                               error="缺少必需参数: 'formula'")])
    r = run("失败路径：缺少参数不重试", ex,
            {"skill_id": "excel-formula", "user_fields": {}})
    assert r.get("valid") is not True
    assert ex.calls == 1, f"参数错误不该重试，实际执行 {ex.calls} 次"
    assert r["workspace_record"]["run"]["status"] == "failed"
    # 一次都没重试过，就不能对用户说「已自动重试」
    assert "已自动重试" not in r["final_output"], "没重试过却谎报重试次数"

    print("\n" + "=" * 64)
    print("✓ 全部断言通过：正常/重试/放弃/skip/失败 五条路径都符合预期")
    print("=" * 64)
