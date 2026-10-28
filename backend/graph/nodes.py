"""图的各个节点。

每个节点签名都是 (state) -> 局部 dict，只返回自己改动的字段。
节点内部不抛异常——失败写进 state 的 error/valid，由图的条件边决定怎么走。
这样一个节点挂掉不会让整个请求 500。

依赖注入：节点需要 skill_executor 和 skills_dict，但它们由 Flask 层在启动时
构造。这里用 set_deps() 注入，避免 graph 层 import Flask 层造成循环依赖。
"""
import json
import re
from typing import Any, Dict, List, Optional

from .state import MAX_RETRY, FlowState

# ── 依赖注入 ────────────────────────────────────────────────
_executor = None      # SkillExecutor 实例，可能为 None（没配 key）
_skills: Dict = {}    # skill_id -> Skill（来自 skill_retrieval）
_fallback_search = None  # 关键词检索函数，LLM 意图识别失败时兜底


def set_deps(executor=None, skills=None, fallback_search=None):
    """Flask 层启动时调用，把已构造好的依赖注入图层。"""
    global _executor, _skills, _fallback_search
    _executor = executor
    if skills is not None:
        _skills = skills
    if fallback_search is not None:
        _fallback_search = fallback_search


def executable_ids() -> set:
    return set(_executor.skill_prompts.keys()) if _executor else set()


# ── 节点 1：意图识别 ────────────────────────────────────────

_SCENES = ("study", "job", "abroad", "exam")
_INTENT_TYPES = ("simple", "multi", "longterm")


def _intent_prompt(text: str, candidates: List[Dict[str, str]]) -> str:
    """把候选 skill 列表塞进 prompt，让模型在**已有 skill 里选**，不要自己编。"""
    lines = [f"- {c['id']}：{c['name']}——{c['promise']}" for c in candidates]
    return f"""你是一个任务路由器。用户描述了一件想做的事，你要判断意图并从给定的
skill 列表里选出最合适的一个。

用户输入：
{text}

可选的 skill（只能从这里选，不要发明新的 id）：
{chr(10).join(lines)}

判断规则：
- intent_type=simple：边界清晰，一个 skill 跑一次就能交付
- intent_type=multi：需要好几步、多个 skill 接力才能做完
- intent_type=longterm：跨周/跨月持续推进的目标，需要长期跟进

只输出 JSON，格式：
{{"scene": "study|job|abroad|exam",
  "intent_type": "simple|multi|longterm",
  "matched_skills": ["最相关的skill_id", "次相关的", "第三个"],
  "reason": "一句话说明为什么这么判断（给用户看，不要提到 JSON 或 prompt）"}}"""


def intent_node(state: FlowState) -> Dict[str, Any]:
    """识别意图 + 选 skill。

    入口若已带 skill_id（用户在工具页直接点运行），直接透传不做识别。
    LLM 失败时降级到关键词检索（_fallback_search）。
    """
    # 已指定 skill：跳过识别
    if state.get("skill_id"):
        sid = state["skill_id"]
        skill = _skills.get(sid)
        return {
            "chosen_skill": sid,
            "scene": getattr(skill, "scene", "study") if skill else "study",
            "intent_type": "simple",
            "matched_skills": [sid],
            "intent_reason": ["用户直接指定了工具"],
        }

    text = (state.get("user_input_text") or "").strip()
    if not text:
        return {
            "chosen_skill": None,
            "matched_skills": [],
            "intent_reason": [],
            "error": "没有输入内容",
        }

    # 先用关键词检索缩小候选范围（也是 LLM 失败时的兜底结果）
    fallback_hits: List[Dict] = []
    if _fallback_search:
        try:
            fallback_hits = _fallback_search(text, 8) or []
        except Exception:
            fallback_hits = []

    candidates = [
        {"id": h["skill_id"], "name": h["skill_name"], "promise": h.get("promise", "")}
        for h in fallback_hits
    ]
    # 关键词一个都没命中：把全部 skill 作为候选交给 LLM 判断
    if not candidates:
        candidates = [
            {"id": s.id, "name": s.name, "promise": s.promise}
            for s in list(_skills.values())[:30]
        ]

    # LLM 意图识别
    if _executor is not None and candidates:
        try:
            data = _chat_json(_intent_prompt(text, candidates))
            matched = [
                sid for sid in (data.get("matched_skills") or [])
                if sid in _skills
            ]
            scene = data.get("scene")
            itype = data.get("intent_type")
            if matched:
                reason = []
                if data.get("reason"):
                    reason.append(str(data["reason"]))
                return {
                    "scene": scene if scene in _SCENES else _guess_scene(matched),
                    "intent_type": itype if itype in _INTENT_TYPES else "simple",
                    "matched_skills": matched,
                    "chosen_skill": matched[0],
                    "intent_reason": reason,
                }
        except Exception as e:
            print(f"[intent] LLM 识别失败，降级关键词匹配：{e}")

    # 降级：用关键词检索的第一名
    if fallback_hits:
        ids = [h["skill_id"] for h in fallback_hits]
        return {
            "scene": _guess_scene(ids),
            "intent_type": "simple",
            "matched_skills": ids,
            "chosen_skill": ids[0],
            "intent_reason": ["按关键词匹配推荐"],
        }

    return {
        "chosen_skill": None,
        "matched_skills": [],
        "intent_reason": ["没有找到匹配的工具"],
    }


def _guess_scene(skill_ids: List[str]) -> str:
    for sid in skill_ids:
        s = _skills.get(sid)
        if s is not None:
            return s.scene
    return "study"


def _chat_json(prompt: str) -> Dict:
    """让模型返回 JSON 并解析。复用 executor 的 client，不新建连接。

    图自己发起的 LLM 调用（意图识别、结果检验）走的不是 SkillExecutor.execute，
    所以那里的脱敏管不到这里——必须在本函数内单独脱敏。检验 prompt 里带的是
    用户表单摘要，简历开头常含手机号，不脱敏既会泄露 PII，也会被网关内容审查
    拦成 403。模型输出里若保留了占位符，解析前换回真值。

    模型常把 JSON 包在 ```json 里，或前后带解释文字，所以要抠出最外层 {}。
    """
    from pii import mask_pii, unmask_pii

    masked, pii_map = mask_pii(prompt)
    resp = _executor.client.chat.completions.create(
        model=_executor.model,
        messages=[
            {"role": "system", "content": "你只输出 JSON，不输出任何其他文字。"},
            {"role": "user", "content": masked},
        ],
        max_tokens=2000,
        temperature=0,
    )
    content = (resp.choices[0].message.content or "").strip()
    content = unmask_pii(content, pii_map)
    return json.loads(_extract_json(content))


def _extract_json(text: str) -> str:
    """从可能带 ``` 或解释文字的输出里抠出 JSON 对象。"""
    text = re.sub(r"^```(?:json)?|```$", "", text.strip(), flags=re.MULTILINE).strip()
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        return text[start : end + 1]
    return text


# ── 节点 2：路由 ────────────────────────────────────────────


def route_node(state: FlowState) -> Dict[str, Any]:
    """路由本身不改状态，判定逻辑在条件边 route_decide 里。

    这里只补一条可解释的理由，让前端能显示「为什么走了这条路」。
    """
    chosen = state.get("chosen_skill")
    reason = list(state.get("intent_reason") or [])

    if not chosen:
        reason.append("没有匹配到可执行的工具，只给推荐")
    elif chosen not in executable_ids():
        skill = _skills.get(chosen)
        name = getattr(skill, "name", chosen) if skill else chosen
        reason.append(f"「{name}」暂未接入真实执行，先给推荐")
    elif state.get("intent_type") in ("multi", "longterm"):
        reason.append("这是多步骤/长期目标，建议用工作台管起来")

    return {"intent_reason": reason}


def route_decide(state: FlowState) -> str:
    """条件边：决定 route 之后去 execute 还是直接 workspace。

    返回值是分支名，在 build.py 里映射到具体节点。
    """
    chosen = state.get("chosen_skill")
    if not chosen or chosen not in executable_ids():
        return "skip"
    # 多步骤/长期目标：单个 skill 覆盖不全，但用户既然指定了就还是跑
    # （只有没指定 skill_id 的自然语言入口才拦）
    if not state.get("skill_id") and state.get("intent_type") in ("multi", "longterm"):
        return "skip"
    return "run"


# ── 节点 3：执行 ────────────────────────────────────────────


def execute_node(state: FlowState) -> Dict[str, Any]:
    """调真实 LLM 跑 skill。复用 SkillExecutor.execute（含 PII 脱敏、关思维链）。"""
    if _executor is None:
        return {
            "raw_output": "",
            "valid": False,
            "error": "执行器未初始化（未配置 LLM API Key）",
            # 没有执行器，重跑还是没有，别空转三次
            "no_retry": True,
        }

    skill_id = state.get("chosen_skill")
    fields = state.get("user_fields") or {}

    # retry_count 在这里累加，而不是在 validate 里。
    # validate 是「先加计数再判断要不要重试」，那个计数就包含了尚未发生的那次重跑，
    # 判断边界和给用户看的次数都会差一：MAX_RETRY=2 实际只重跑 1 次，却报「已重试 2 次」。
    # 改成由执行节点自增：被 validate 打回来时 valid 已是 False，据此认出这是重跑。
    retry = state.get("retry_count", 0)
    if state.get("valid") is False:
        retry += 1

    result = _executor.execute(skill_id, fields)

    if not result.success:
        return {
            "raw_output": "",
            "credits_used": 0,
            "error": result.error,
            "retry_count": retry,
            # 缺参数 / skill 不存在这类错误换多少次都一样，不进重试循环
            "no_retry": True,
            "valid": False,
        }

    return {
        "raw_output": result.output,
        "credits_used": result.credits_used,
        "retry_count": retry,
        "truncated": result.truncated,
        "error": None,
    }


# ── 节点 4：结果检验 ────────────────────────────────────────

# 先用规则筛明显问题，规则说不清的再花一次 LLM 调用。省钱也省延迟。
_PLACEHOLDER_RE = re.compile(r"〔(手机号|邮箱|身份证|银行卡)\d+〕")


def validate_node(state: FlowState) -> Dict[str, Any]:
    """检验执行结果质量。不合格则由条件边决定是否重试。"""
    # 注意：本节点不改 retry_count，计数由 execute_node 自增（见那里的注释）。
    out = state.get("raw_output") or ""
    notes: List[str] = []

    # 执行节点已经失败了，不用再检验
    if state.get("error"):
        return {"valid": False, "validation_notes": [f"执行失败：{state['error']}"]}

    # ── 规则检验 ──
    if not out.strip():
        return {"valid": False, "validation_notes": ["输出为空"]}

    if len(out.strip()) < 40:
        return {
            "valid": False,
            "validation_notes": [f"输出过短（{len(out.strip())} 字），可能被截断"],
        }

    # 残留脱敏占位符说明还原失败，这是 bug 不是模型问题，重试无用
    if _PLACEHOLDER_RE.search(out):
        notes.append("⚠️ 输出中残留脱敏占位符，PII 还原可能不完整")

    # 截断只认 API 的 finish_reason。曾经用「末尾没有终止标点」猜，误报极多：
    # markdown 的末行常是不带句末标点的要点，凡是以中文字符、% 或数字结尾的
    # 完整输出都会被判成截断。
    # 注意这里不判 valid=False——同样的 max_tokens 重跑只会再截一次，白花三次调用。
    if state.get("truncated"):
        notes.append("输出被 max_tokens 截断（finish_reason=length）")

    # ── LLM 检验（规则没拦下来时）──
    if _executor is not None:
        try:
            skill = _skills.get(state.get("chosen_skill") or "")
            promise = getattr(skill, "promise", "") if skill else ""
            data = _chat_json(
                f"""判断下面这份 AI 输出是否合格地完成了任务。

任务承诺：{promise or "（未知）"}
用户输入的关键信息：{_brief(state.get("user_fields") or {})}

AI 输出（可能被截断显示）：
{out[:3000]}

判断标准：是否答非所问、是否只有空话没有具体内容、是否明显不完整。
宽松一点——只要实质完成了任务就算合格，不要因为风格或细节不完美就判不合格。

只输出 JSON：{{"valid": true/false, "reason": "一句话理由"}}"""
            )
            if data.get("valid") is False:
                return {
                    "valid": False,
                    "validation_notes": notes + [f"质量自检未通过：{data.get('reason', '')}"],
                }
            notes.append("已通过质量自检")
        except Exception as e:
            # 检验本身挂了不该拖垮主流程——结果已经拿到了，放过
            print(f"[validate] LLM 检验失败，跳过：{e}")
            notes.append("质量自检跳过（检验调用失败）")

    return {"valid": True, "validation_notes": notes}


def _brief(fields: Dict[str, str], limit: int = 200) -> str:
    """把表单字段压成一行摘要，避免把整份简历再塞一遍进检验 prompt。"""
    parts = []
    for k, v in fields.items():
        v = (v or "").replace("\n", " ")
        parts.append(f"{k}={v[:60]}")
    s = "；".join(parts)
    return s[:limit]


def validate_decide(state: FlowState) -> str:
    """条件边：合格→落工作台；不合格且还有重试次数→回 execute；否则放弃。"""
    if state.get("valid"):
        return "ok"
    if state.get("no_retry"):
        return "give_up"
    if state.get("retry_count", 0) < MAX_RETRY:
        return "retry"
    return "give_up"


# ── 节点 5：落工作台 ────────────────────────────────────────

# 按场景给的建议 todo。工作台的用途是记录秋招/留学申请进度，
# 所以建议要落在「下一步该做什么」上，而不是复述结果。
_TODO_HINTS = {
    "job": ["核对简历里的量化数据是否真实", "投递后记录投递时间和进度"],
    "abroad": ["确认各校截止日期", "把材料清单逐项打勾"],
    "exam": ["把计划拆到本周日历", "每周回填实际完成量"],
    "study": ["按结果整理成交付物", "提交前再自查一遍"],
}


def workspace_node(state: FlowState) -> Dict[str, Any]:
    """整理最终输出 + 生成工作台记录（run / 时间线事件 / 建议 todo）。

    不直接写库——当前工作台状态在前端 localStorage，这里只产出结构化数据，
    由前端用现有的 addRun / addTodo 落地。
    """
    chosen = state.get("chosen_skill")
    skill = _skills.get(chosen or "")
    name = getattr(skill, "name", chosen or "未知工具") if skill else (chosen or "未知工具")
    scene = state.get("scene") or getattr(skill, "scene", "study")

    out = state.get("raw_output") or ""
    valid = bool(state.get("valid"))
    notes = list(state.get("validation_notes") or [])

    # 没跑执行（skip 分支）：给推荐，不算失败
    if not out and not state.get("error"):
        recs = state.get("matched_skills") or []
        rec_lines = []
        for sid in recs[:4]:
            s = _skills.get(sid)
            if s:
                mark = "" if sid in executable_ids() else "（暂未接入真实执行）"
                rec_lines.append(f"- **{s.name}**{mark}：{s.promise}")
        body = "\n".join(rec_lines) or "- 暂无匹配的工具"
        final = f"## 建议使用以下工具\n\n{body}"
        if state.get("intent_type") in ("multi", "longterm"):
            final += "\n\n> 这件事需要多步推进，建议在工作台建一个目标来跟踪进度。"
        return {
            "final_output": final,
            "valid": False,
            "workspace_record": _record(
                chosen, name, scene, summary=f"{name} · 仅推荐未执行",
                status="skipped", credits=0, todos=[],
            ),
            "validation_notes": notes,
        }

    # 执行失败 / 重试耗尽
    if not valid:
        reason = state.get("error") or "；".join(notes) or "未通过质量自检"
        retried = state.get("retry_count", 0)
        final = f"## 运行未成功\n\n{reason}"
        # 报实际重试次数。参数缺失那类走 no_retry 直接放弃，一次没重试过，
        # 这里就不能说「已重试 N 次」。
        if retried > 0:
            final += f"\n\n已自动重试 {retried} 次仍未通过，建议调整输入后重试。"
        return {
            "final_output": final,
            "workspace_record": _record(
                chosen, name, scene, summary=f"{name} · 运行失败",
                status="failed", credits=0, todos=[],
            ),
            "validation_notes": notes,
        }

    # 成功
    todos = _TODO_HINTS.get(scene, [])
    return {
        "final_output": out,
        "workspace_record": _record(
            chosen, name, scene,
            summary=_summarize(name, out),
            status="success",
            credits=state.get("credits_used", 0),
            todos=todos,
        ),
        "validation_notes": notes,
    }


def _summarize(name: str, out: str, limit: int = 70) -> str:
    """从输出里抽一行当摘要，写进工作台时间线。

    时间线上写「xx · 运行完成」等于什么都没说，所以取第一句有内容的正文
    （跳过 Markdown 标题、列表符号、代码围栏）。抽不到再退回通用文案。
    """
    for raw in out.splitlines():
        line = raw.strip().lstrip("#>-*+ ").strip()
        if not line or line.startswith("```") or line.startswith("|"):
            continue
        line = re.sub(r"[*_`]", "", line)
        if len(line) < 8:
            continue
        return f"{name}：{line[:limit]}" + ("…" if len(line) > limit else "")
    return f"{name} · 运行完成"


def _record(
    skill_id: Optional[str],
    name: str,
    scene: str,
    summary: str,
    status: str,
    credits: int,
    todos: List[str],
) -> Dict[str, Any]:
    """工作台记录。字段名对齐前端 RunRecord / TimelineEvent（data/types.ts）。"""
    return {
        "run": {
            "toolId": skill_id or "",
            "toolName": name,
            "credits": credits,
            "status": status,
            "summary": summary,
        },
        "timeline_event": {
            "title": f"运行 {name}",
            "detail": summary,
            "kind": "run",
        },
        "suggested_todos": todos,
        "scene": scene,
    }
