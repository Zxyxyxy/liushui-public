"""图在节点间传递的状态。

LangGraph 的每个节点收到完整 state，返回一个**局部 dict**（只含它改动的
字段），框架自动合并。所以节点不要返回整个 state，只返回自己写的那几个键。

Python 3.9 没有 typing.NotRequired，用 total=False 表达「字段都可缺省」。
"""
from typing import Any, Dict, List, Optional, TypedDict


class FlowState(TypedDict, total=False):
    # ── 输入 ───────────────────────────────────────────────
    # 自然语言诉求（走意图识别）。与 skill_id 二选一。
    user_input_text: str
    # 直接指定的 skill（用户在工具页点运行）。给了就跳过意图识别。
    skill_id: Optional[str]
    # 表单字段，key 必须与 skill prompt 模板的变量名一致
    user_fields: Dict[str, str]

    # ── 意图识别产出 ────────────────────────────────────────
    scene: str                    # study | job | abroad | exam
    intent_type: str              # simple | multi | longterm
    matched_skills: List[str]     # 候选 skill id，按相关度排序
    chosen_skill: Optional[str]   # 最终选中的 skill
    intent_reason: List[str]      # 可解释的判断依据，给用户看

    # ── 执行产出 ───────────────────────────────────────────
    raw_output: str
    credits_used: int
    # 输出是否被 max_tokens 截断。来自 API 的 finish_reason，不是猜的。
    truncated: bool

    # ── 检验产出 ───────────────────────────────────────────
    valid: bool
    validation_notes: List[str]
    # 已经重跑过几次执行节点（首次执行不计）。execute 节点自己累加。
    retry_count: int
    # 这类失败重试也没用（缺参数、skill 不存在），直接放弃，别浪费一次调用
    no_retry: bool

    # ── 最终产出 ───────────────────────────────────────────
    final_output: str
    # 给前端写入工作台的结构化记录：{run, timeline_event, suggested_todos}
    workspace_record: Dict[str, Any]
    error: Optional[str]


# 检验不合格时最多**额外**重跑几次执行节点，即最多执行 MAX_RETRY + 1 次。防死循环。
MAX_RETRY = 2
