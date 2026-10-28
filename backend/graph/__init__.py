"""LangGraph 编排层。

链路：意图识别 → 路由 → 执行 → 结果检验（不合格重试）→ 落工作台

对外只暴露 build_graph()，Flask 层拿到编译好的图直接 invoke。
"""
from .build import build_graph
from .state import FlowState

__all__ = ["build_graph", "FlowState"]
