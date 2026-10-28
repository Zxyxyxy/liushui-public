"""组装 LangGraph 状态图。

    START → intent → route
    route ─(run)──→ execute → validate
    route ─(skip)─→ workspace → END
    validate ─(ok)──────→ workspace → END
    validate ─(retry)───→ execute        ← 循环，上限 MAX_RETRY
    validate ─(give_up)─→ workspace → END

图编译一次全局复用（无状态，线程安全；状态都在 invoke 传入的 FlowState 里）。
"""
from langgraph.graph import END, START, StateGraph

from .nodes import (
    execute_node,
    intent_node,
    route_decide,
    route_node,
    validate_decide,
    validate_node,
    workspace_node,
)
from .state import FlowState


def build_graph():
    """组装并编译图。返回可 invoke 的 CompiledStateGraph。"""
    g = StateGraph(FlowState)

    g.add_node("intent", intent_node)
    g.add_node("route", route_node)
    g.add_node("execute", execute_node)
    g.add_node("validate", validate_node)
    g.add_node("workspace", workspace_node)

    g.add_edge(START, "intent")
    g.add_edge("intent", "route")

    # 路由分支：能跑就跑，否则直接给推荐
    g.add_conditional_edges(
        "route",
        route_decide,
        {"run": "execute", "skip": "workspace"},
    )

    g.add_edge("execute", "validate")

    # 检验分支：合格落地 / 不合格重试 / 重试耗尽放弃
    g.add_conditional_edges(
        "validate",
        validate_decide,
        {"ok": "workspace", "retry": "execute", "give_up": "workspace"},
    )

    g.add_edge("workspace", END)

    return g.compile()
