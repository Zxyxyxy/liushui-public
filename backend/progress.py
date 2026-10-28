"""从对话里识别求职 / 留学申请进度，生成「加入工作台？」的建议。用户确认后才写入，这里只负责识别和核对。

只看用户自己说的话：助手的回复里常有举例和假设（「比如你下周三面」），不能当成事实。
每条建议都要带用户原话，代码核对原话确实出现在用户消息里，对不上的丢掉。
日期一律换算成具体的 YYYY-MM-DD，算不出来就不建议日期。

求职和留学一次识别：用户开了留学工作台、或者这句话明显在说留学，就把两边都交给模型，
每条建议带 ws（job / abroad）说明归到哪个工作台。
"""

import json
import re
from datetime import date, timedelta
from typing import Any, Dict, List, Optional, Tuple

import workspace_db as W

USER_CAP = 3000          # 最近几轮用户原话最多取多少字
MAX_SUGGESTIONS = 10   # 一句话里常常连说好几所学校
WEEKDAYS = "一二三四五六日"

# 明显和求职、留学进度无关的话，不浪费一次模型调用
_HINT = re.compile(
    r"投|面试|一面|二面|三面|终面|hr面|HR面|笔试|测评|offer|Offer|OFFER|挂了|凉了|过了|通过|拒|内推|网申|"
    r"截止|ddl|DDL|签约|三方|实习|校招|秋招|春招|岗位|宣讲|群面|无领导|"
    r"递|提交|录取|录了|押金|入读|留学|申请|文书|推荐信|套磁|雅思|托福|IELTS|TOEFL|GRE|GMAT|"
    r"(下|这|本)?(周|星期)[一二三四五六日天]|明天|后天|\d{1,2}[月/.-]\d{1,2}", re.I)
# 只有留学才会说的词：命中了就算用户还没开留学工作台，也把留学这边交给模型
_ABROAD_ONLY = re.compile(r"递了|提交了|录取|录了|拒信|押金|入读|留学|文书|推荐信|套磁|雅思|托福|IELTS|TOEFL|GRE|GMAT|"
                          r"硕士|博士|研究生|MSc|MPhil|PhD|\bR[123]\b", re.I)

# 岗位 / 项目名常见的结尾：模型把「AI 产品岗」「MSc Marketing」当成公司、学校名时靠它拦下
_ROLE_TAIL = {
    "job": re.compile(r"(岗|岗位|职位|实习|实习生|工程师|经理|专员|助理|管培|管培生|培训生|分析师|设计师|开发|运营|产品|研究员|顾问)$", re.I),
    "abroad": re.compile(r"(项目|专业|硕士|博士|学位|课程|program|programme)$", re.I),
}
# 学位开头的也是项目名：「MSc Marketing」「MA Finance」
_DEGREE_HEAD = re.compile(r"^(msc|ma|mba|mfin|mphil|phd|meng|llm|bsc|ba|master'?s?|mres)\b", re.I)

KIND = {
    "job": {
        "title": "求职", "item": "投递", "org": "公司或单位", "org_eg": "字节、中海油、国家电网",
        "role": "岗位", "role_eg": "「AI 产品岗」「后端开发」「管培生」", "start": "applied",
        "eg": "「一面过了」「周五笔试」「投了美团」",
        "rules": "「投了」新建投递（阶段默认就是已投递）；「一面过了」表示要进下一轮：stage 记为下一轮（interview2），"
                 "不是 interview1；「挂了」「被拒」记为 closed；「拿到 offer」记为 offer",
    },
    "abroad": {
        "title": "留学申请", "item": "申请", "org": "学校", "org_eg": "UCL、港大、NUS",
        "role": "项目或专业", "role_eg": "「Business Analytics」「MSc Marketing」「金融硕士」", "start": "prep",
        "eg": "「今天递了 UCL」「收到港大面试」「NUS 录了」",
        "rules": "「递了」「提交了」记为 submitted；「收到面试」记为 interview（说了日期再加一条 event）；"
                 "「录了」「拿到录取 / offer」（含有条件录取）记为 admitted；「交了押金」「确认去读」记为 enrolled；"
                 "「被拒」「收到拒信」「不申了」记为 closed；只说「在准备 X 的材料」记为 prep",
    },
}


def worth_checking(user_text: str) -> bool:
    return bool(user_text and _HINT.search(user_text))


def _user_texts(history: List[Dict[str, Any]], turns: int = 3) -> List[str]:
    """最近几轮用户亲口说的话。带附件的消息只取用户打的字（_text），不取拼进去的文件全文。"""
    out = []
    for m in reversed(history):
        if m.get("role") != "user" or m.get("_run"):
            continue   # 表单运行的那条是系统拼的「我用 XX 工具提交了……」，不是用户的话
        t = (m.get("_text") if "_text" in m else m.get("content") or "").strip()
        if t:
            out.append(t)
        if len(out) >= turns:
            break
    return list(reversed(out))


def _date_table(today: date) -> str:
    lines = []
    for i in range(0, 15):
        d = today + timedelta(days=i)
        tag = {0: "今天", 1: "明天", 2: "后天"}.get(i, "")
        lines.append(f"{d.isoformat()} 周{WEEKDAYS[d.weekday()]}{('（' + tag + '）') if tag else ''}")
    return "\n".join(lines)


def extract_messages(user_texts: List[str], sections: Dict[str, Dict[str, Any]], today: date) -> List[Dict[str, str]]:
    """sections：{kind: {targets, stages}}，这次交给模型的工作台（求职一定有，留学视情况）。"""
    latest = user_texts[-1][-USER_CAP:]
    earlier = "\n".join(f"- {t}" for t in user_texts[:-1])[-USER_CAP:] or "（没有）"
    both = len(sections) > 1
    blocks = []
    for k, sec in sections.items():
        c = KIND[k]
        known = "\n".join(f"- id={t['id']} {t['org']} {t.get('role', '')}（当前阶段：{t['stage']}）"
                          for t in sec["targets"]) or "（还没有）"
        ids = "、".join(f"{s['id']}={s['label']}" for s in sec["stages"])
        blocks.append(f"【{c['title']}工作台，ws={k}】\n已有的{c['item']}：\n{known}\n可用的阶段 id：{ids}\n"
                      f"org 是{c['org']}（{c['org_eg']}），role 是{c['role']}；{c['role_eg']}是{c['role']}，不是 org。\n"
                      f"阶段规则：{c['rules']}")
    ws_rule = ("每条都要写 ws：求职的事写 job，留学申请的事写 abroad。公司 / 学校已经在哪个工作台里就写哪个；"
               "都还没有就看语境（学校、项目、递交、录取是 abroad；公司、岗位、笔试是 job）。\n" if both else "")
    eg = "；".join(KIND[k]["eg"] for k in sections)
    system = ("你是求职和留学申请进度记录员。只从用户亲口说的话里提取明确的事实，不推测、不补充。"
              "只输出 JSON，不要任何解释或代码块标记。")
    user = f"""今天是 {today.isoformat()}（周{WEEKDAYS[today.weekday()]}）。往后两周的日期对照：
{_date_table(today)}

用户**这一句**（只从这一句里找新的进度）：
{latest}

用户前面说过的话（只用来判断这一句说的是哪家公司 / 哪所学校，**里面的进度之前已经处理过，不要再输出**）：
{earlier}

{chr(10).join(blocks)}

请找出用户话里**明确说出的**进度，输出 JSON：
{{"items": [
  {{"type": "target", "ws": "job 或 abroad", "org": "公司 / 学校名", "role": "岗位 / 项目，没说就留空", "quote": "这一句里提到它的那段原话"}},
  {{"type": "role", "ws": "同上", "target": "已有的 id，或者同一次输出里新建的公司 / 学校名", "role": "岗位 / 项目", "quote": "原话"}},
  {{"type": "stage", "ws": "同上", "target": "已有的 id，或者同一次输出里新建的公司 / 学校名", "stage": "阶段 id", "quote": "原话"}},
  {{"type": "event", "ws": "同上", "target": "同上，可以为空", "title": "如：字节二面、UCL 截止", "kind": "interview / test / deadline / other", "date": "YYYY-MM-DD", "quote": "原话"}},
  {{"type": "todo", "ws": "同上", "target": "同上，可以为空", "text": "要做的事", "due": "YYYY-MM-DD 或空", "quote": "原话"}}
]}}

规则：
1. quote 必须是**这一句**里连续的一段，原样照抄，不改字
2. {ws_rule}**org 只能是公司或学校的名字**，岗位、项目、专业不是 org。
   这一句只说了岗位 / 项目、没说公司 / 学校时，说的是前面提到的那一家：
   它已经在工作台里，输出 type=role 给它补上；它是这一次刚提到的新的，把岗位 / 项目写进它的 target；
   完全看不出是哪一家，就什么都不输出
3. 只记用户说的**已经发生或已经确定**的事：{eg}。
   「想投」「打算申」「要不要投」「如果下周面试」这类意向和假设不记；问题（「XX 怎么准备」）本身不是进度
4. 已经在工作台里的，用它的 id，不要再新建 target；用户只提到名字没提进度的，不要输出
5. 阶段按上面各工作台的阶段规则记；新建的那一条阶段默认就是开头那一步，不用再输出同一个阶段
6. 日期必须能从原话和上面的对照表**确定到具体某一天**，否则不要输出这条 event（todo 可以不带 due）。语言考试的 kind 用 test
7. 用户说的是别人的事（「我室友拿了字节 offer」「同学被 UCL 录了」）不记
8. 没有可记的就输出 {{"items": []}}"""
    return [{"role": "system", "content": system}, {"role": "user", "content": user}]


def _norm(t: str) -> str:
    return re.sub(r"\s+", "", t or "")


def _looks_like_role(org: str, role: str, kind: str = "job") -> bool:
    o = org.strip().lower()
    tail = _ROLE_TAIL.get(kind, _ROLE_TAIL["job"])
    return (bool(tail.search(o)) or bool(tail.search(_norm(o)))
            or (kind == "abroad" and bool(_DEGREE_HEAD.search(o)))
            or (bool(role) and _norm(o) == _norm(role).lower()))


def build(data: Optional[Dict[str, Any]], user_texts: List[str], sections: Dict[str, Dict[str, Any]],
          today: date) -> List[Dict[str, Any]]:
    """核对模型输出：原话必须出现在用户消息里；工作台、阶段、日期、引用都要合法。生成给前端确认的建议。"""
    if not data:
        return []
    said = _norm(user_texts[-1]) if user_texts else ""   # 只有最新这一句是新进度的来源
    kinds = list(sections)
    by_id = {t["id"]: (k, t) for k, sec in sections.items() for t in sec["targets"]}
    by_org = {k: {t["org"].strip().lower(): t for t in sec["targets"]} for k, sec in sections.items()}
    new_orgs: Dict[Tuple[str, str], Dict[str, Any]] = {}
    out: List[Dict[str, Any]] = []

    def find_org(k: str, ref: str) -> Optional[Dict[str, Any]]:
        r = ref.lower()
        return by_org[k].get(r) or next((t for o, t in by_org[k].items() if o and (o in r or r in o)), None)

    def resolve(ref: str, k: Optional[str]) -> Optional[Tuple[str, Dict[str, str]]]:
        """引用 → （工作台, {target_id 或 new_org, org}）。已有的 id 以它实际所在的工作台为准。"""
        ref = (ref or "").strip()
        if not ref:
            return None
        if ref in by_id:
            kk, t = by_id[ref]
            return kk, {"target_id": ref, "org": t["org"]}
        for kk in ([k] if k else []) + [x for x in kinds if x != k]:
            hit = find_org(kk, ref)
            if hit:
                return kk, {"target_id": hit["id"], "org": hit["org"]}
            if (kk, ref.lower()) in new_orgs:
                org = new_orgs[(kk, ref.lower())]["org"]
                return kk, {"new_org": org, "org": org}
        return None

    def valid_date(d: str) -> Optional[str]:
        try:
            x = date.fromisoformat((d or "")[:10])
        except ValueError:
            return None
        return x.isoformat() if today - timedelta(days=30) <= x <= today + timedelta(days=180) else None

    items = [i for i in (data.get("items") or []) if isinstance(i, dict)]
    # 先处理新建的投递 / 申请，后面的阶段和日程才能引用它
    items.sort(key=lambda i: 0 if i.get("type") == "target" else 1)
    for it in items:
        quote = str(it.get("quote") or "").strip()
        if len(_norm(quote)) < 2 or _norm(quote) not in said:
            continue   # 原话核对不上就不建议
        k = it.get("ws") if it.get("ws") in sections else ("job" if "job" in sections else kinds[0])
        kind = it.get("type")
        if kind == "target":
            org = str(it.get("org") or "").strip()[:60]
            role = str(it.get("role") or "").strip()[:60]
            if not org or _looks_like_role(org, role, k):
                continue   # 把岗位 / 项目当成了公司 / 学校，不新建
            hit = resolve(org, k)
            if hit and hit[1].get("target_id"):
                # 其实已经在工作台里：有岗位 / 项目就补上，没有就什么都不做
                hk, ref = hit
                if role and not by_id[ref["target_id"]][1].get("role"):
                    out.append({"type": "role", "ws": hk, **ref, "role": role, "quote": quote})
                continue
            if hit:
                continue   # 同一次输出里已经新建过
            sug = {"type": "target", "ws": k, "org": org, "role": role, "quote": quote}
            new_orgs[(k, org.lower())] = sug
            out.append(sug)
        elif kind == "role":
            hit, role = resolve(str(it.get("target") or ""), k), str(it.get("role") or "").strip()[:60]
            if not hit or not role:
                continue
            hk, ref = hit
            if ref.get("new_org"):
                sug = new_orgs[(hk, ref["new_org"].lower())]
                sug["role"] = sug["role"] or role
                continue   # 新建的：直接写进那一条，不单独成一条
            if (by_id[ref["target_id"]][1].get("role") or "").strip() == role:
                continue
            out.append({"type": "role", "ws": hk, **ref, "role": role, "quote": quote})
        elif kind == "stage":
            hit, st = resolve(str(it.get("target") or ""), k), it.get("stage")
            if not hit:
                continue
            hk, ref = hit
            stages = sections[hk]["stages"]
            if st not in {s["id"] for s in stages}:
                continue
            if ref.get("target_id") and by_id[ref["target_id"]][1]["stage"] == st:
                continue   # 已经是这个阶段了
            if ref.get("new_org") and st == KIND[hk]["start"]:
                continue   # 新建的本来就在开头那一步
            out.append({"type": "stage", "ws": hk, **ref, "stage": st,
                        "stage_label": next(s["label"] for s in stages if s["id"] == st), "quote": quote})
        elif kind in ("event", "todo"):
            hit = resolve(str(it.get("target") or ""), k)
            hk, ref = hit if hit else (k, {})
            if kind == "event":
                d = valid_date(str(it.get("date") or ""))
                title = str(it.get("title") or "").strip()[:60]
                if not d or not title:
                    continue
                ek = it.get("kind") if it.get("kind") in ("interview", "test", "deadline", "other") else "other"
                out.append({"type": "event", "ws": hk, **ref, "title": title, "kind": ek, "date": d, "quote": quote})
            else:
                text = str(it.get("text") or "").strip()[:100]
                if not text:
                    continue
                out.append({"type": "todo", "ws": hk, **ref, "text": text,
                            "due": valid_date(str(it.get("due") or "")) or "", "quote": quote})
        if len(out) >= MAX_SUGGESTIONS:
            break
    # 新建的投递 / 申请就算后面没有阶段、日程引用它，也照样保留：「投了美团」「递了 UCL」本身就是一条进度
    return out


def _sections(user_id: str, text: str) -> Dict[str, Dict[str, Any]]:
    """这次要交给模型的工作台。求职一定有；留学在用户开过留学工作台、或者这句话明显在说留学时才有。"""
    out: Dict[str, Dict[str, Any]] = {}
    ws = W.get_workspace(user_id, W.ensure_default(user_id, "job"))
    if ws:
        out["job"] = {"targets": ws["targets"], "stages": ws["stages"]}
    aid = W.find_workspace(user_id, "abroad")
    if aid or _ABROAD_ONLY.search(text):
        aw = W.get_workspace(user_id, aid) if aid else None
        out["abroad"] = {"targets": aw["targets"] if aw else [], "stages": W.STAGES["abroad"]}
    return out


def suggest(user_id: str, history: List[Dict[str, Any]], call_json, today: date) -> List[Dict[str, Any]]:
    texts = _user_texts(history)
    if not texts or not worth_checking(texts[-1]):
        return []
    sections = _sections(user_id, texts[-1])
    if not sections:
        return []
    try:
        from grounding import parse
        raw = call_json(extract_messages(texts, sections, today))
        return build(parse(raw), texts, sections, today)
    except Exception as e:
        print(f"⚠️  进度识别失败：{e}")
        return []


def apply(user_id: str, items: List[Dict[str, Any]], thread_id: Optional[str]) -> Dict[str, int]:
    """用户确认后写入工作台。前端可能改过内容，这里重新校验一遍，不信任传来的 id。
    每条按 ws 写进对应的工作台；留学工作台还没开的，这时建好。"""
    state: Dict[str, Dict[str, Any]] = {}

    def ctx(k: str) -> Dict[str, Any]:
        if k not in state:
            ws_id = W.ensure_default(user_id, k)
            ws = W.get_workspace(user_id, ws_id) or {"targets": [], "stages": W.STAGES[k]}
            state[k] = {"ws_id": ws_id, "own": {t["id"] for t in ws["targets"]},
                        "stage_ids": {s["id"] for s in ws["stages"]}, "created": {}}
        return state[k]

    counts = {"targets": 0, "roles": 0, "stages": 0, "events": 0, "todos": 0}
    touched = set()

    def tid_of(it, c):
        if it.get("target_id") in c["own"]:
            return it["target_id"]
        return c["created"].get(str(it.get("new_org") or "").strip().lower())

    for it in sorted([i for i in items if isinstance(i, dict)], key=lambda i: 0 if i.get("type") == "target" else 1)[:20]:
        k = it.get("ws") if it.get("ws") in W.STAGES else "job"
        c = ctx(k)
        kind = it.get("type")
        if kind == "target":
            t = W.add_target(user_id, c["ws_id"], {"org": it.get("org"), "role": it.get("role"), "stage": KIND[k]["start"]})
            if t:
                c["created"][t["org"].strip().lower()] = t["id"]
                c["own"].add(t["id"])
                touched.add(t["id"])
                counts["targets"] += 1
        elif kind == "role":
            tid, role = tid_of(it, c), str(it.get("role") or "").strip()[:60]
            if tid and role and W.update_target(user_id, tid, {"role": role}):
                touched.add(tid)
                counts["roles"] += 1
        elif kind == "stage" and it.get("stage") in c["stage_ids"]:
            tid = tid_of(it, c)
            if tid and W.update_target(user_id, tid, {"stage": it["stage"]}):
                touched.add(tid)
                counts["stages"] += 1
        elif kind == "event":
            tid = tid_of(it, c)
            if W.add_event(user_id, c["ws_id"], str(it.get("title") or ""), str(it.get("date") or ""),
                           str(it.get("kind") or "other"), tid):
                counts["events"] += 1
                if tid:
                    touched.add(tid)
        elif kind == "todo":
            tid = tid_of(it, c)
            if W.add_todo(user_id, c["ws_id"], str(it.get("text") or ""), str(it.get("due") or ""), tid):
                counts["todos"] += 1
                if tid:
                    touched.add(tid)
    if thread_id:
        for tid in touched:
            W.link_thread(user_id, tid, thread_id)
    return counts


# ── 工具结果自动归类 ────────────────────────────────────────────────────────

def match_target(user_id: str, hint: str, kind: str = "job") -> Optional[Dict[str, Any]]:
    """表单里填的公司岗位（留学是学校项目）正好对上工作台里**唯一**一条时，返回它。对上多条或对不上就返回 None，交给用户选。"""
    hint = (hint or "").lower()
    ws_id = W.find_workspace(user_id, kind) if hint else None
    if not ws_id:
        return None
    ws = W.get_workspace(user_id, ws_id)
    hits = [t for t in (ws or {}).get("targets", []) if len(t["org"].strip()) >= 2 and t["org"].strip().lower() in hint]
    if len(hits) > 1 and any(t.get("role") for t in hits):
        hits = [t for t in hits if t.get("role") and t["role"].strip().lower() in hint] or hits
    return hits[0] if len(hits) == 1 else None
