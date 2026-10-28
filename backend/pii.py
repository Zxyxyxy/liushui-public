"""PII 脱敏与还原。

为什么需要：简历/JD/文书这类 skill 天然含手机号、邮箱等个人信息。
1. 不少模型网关有内容安全审查，带手机号的 prompt 直接 403 prompt_review_blocked；
2. 合规上也不该把用户 PII 原样发给第三方 LLM（最小化传输原则）。

做法是可逆替换：发出去前把真值换成占位符 〔手机号1〕，模型在改写结果里会
原样保留这个占位符，拿回来后再换回真值。真值全程不出本机。

    text, mapping = mask_pii(raw)      # 发给 LLM 的是 text
    final = unmask_pii(output, mapping)  # 还给用户的是 final

注意：不处理姓名。中文姓名没有可靠的正则特征，误伤率太高（「张总监」「李项目」
都会被打掉），而姓名对简历改写本身是有用的上下文。真要处理得上 NER，不在当前范围。
"""
import re
from typing import Dict, Tuple

# 顺序有讲究：先长后短。身份证 18 位里含 11 位数字串，若先跑手机号会把身份证咬掉一段。
_PATTERNS = [
    # 邮箱放最前面：邮箱里可能含长数字串，先摘走避免被数字类规则切碎
    ("邮箱", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    # 18 位身份证（末位可能是 X）
    ("身份证", re.compile(r"(?<!\d)\d{17}[\dXx](?!\d)")),
    # 银行卡 16-19 位
    ("银行卡", re.compile(r"(?<!\d)\d{16,19}(?!\d)")),
    # 手机号 1 开头 11 位。前后加边界，避免从更长数字串里抠出一段
    ("手机号", re.compile(r"(?<!\d)1[3-9]\d{9}(?!\d)")),
]


def mask_pii(text: str) -> Tuple[str, Dict[str, str]]:
    """把 PII 替换成占位符。返回 (脱敏后文本, {占位符: 真值})。"""
    if not text:
        return text, {}

    mapping: Dict[str, str] = {}
    seen: Dict[str, str] = {}  # 真值 -> 占位符，同一个值复用同一占位符
    counters: Dict[str, int] = {}

    for label, pattern in _PATTERNS:
        def _sub(m):
            real = m.group(0)
            if real in seen:
                return seen[real]
            counters[label] = counters.get(label, 0) + 1
            token = f"〔{label}{counters[label]}〕"
            seen[real] = token
            mapping[token] = real
            return token

        text = pattern.sub(_sub, text)

    return text, mapping


def unmask_pii(text: str, mapping: Dict[str, str]) -> str:
    """把占位符换回真值。模型没保留占位符时该项自然不还原，不报错。"""
    if not text or not mapping:
        return text
    for token, real in mapping.items():
        text = text.replace(token, real)
    return text
