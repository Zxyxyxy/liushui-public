"""把工具结果（Markdown）转成 PDF。和 Word 导出一样：用户点「下载 PDF」时才现转，不预先生成、不落盘。

排版规则和 docx_export 保持一致（标题、列表、表格、引用、作答框、「只要简历」），区别在中文字体：
PDF 要把字体嵌进文件，换台电脑打开才不会乱码。优先用系统自带的黑体；都找不到时（比如部署到 Linux）
退回 reportlab 内置的宋体，那个不嵌入，由阅读器提供，常见阅读器都支持。
"""

import io
import os
import re
from typing import List, Optional, Tuple
from xml.sax.saxutils import escape

from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.cidfonts import UnicodeCIDFont
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from docx_export import QUESTION_HEADING, resume_section

INK = colors.HexColor("#111827")
GRAY = colors.HexColor("#6B7280")
WATER = colors.HexColor("#0077B6")
LINE = colors.HexColor("#CBD5E1")
MARGIN_X, MARGIN_Y = 16 * mm, 18 * mm
WIDTH = A4[0] - 2 * MARGIN_X

# （常规, 加粗）。只能用 TrueType 轮廓的字体：reportlab 读不了 CFF 轮廓的 OTF / TTC（比如思源黑体）
_FONT_FILES = [
    ("/System/Library/Fonts/STHeiti Light.ttc", "/System/Library/Fonts/STHeiti Medium.ttc"),
    ("C:/Windows/Fonts/msyh.ttc", "C:/Windows/Fonts/msyhbd.ttc"),
]
# 字体里没有表情符号：✅ ⚠️ 🔴 这类原样放进去会变成方块，去掉
_EMOJI = re.compile("[\U0001F000-\U0001FAFF\u2600-\u27BF\u2B00-\u2BFF\uFE0F\u200D\u20E3]")
_INLINE = re.compile(r"(\*\*[^*]+\*\*|__[^_]+__|`[^`]+`|\*[^*\s][^*]*\*|\[[^\]]+\]\([^)]+\))")
_LIST = re.compile(r"^(\s*)([-*+•]|\d+[.、)])\s+(.*)$")
_TABLE_SEP = re.compile(r"^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$")

_fonts: Optional[Tuple[str, str]] = None


def _register() -> Tuple[str, str]:
    global _fonts
    if _fonts:
        return _fonts
    for reg, bold in _FONT_FILES:
        if not (os.path.exists(reg) and os.path.exists(bold)):
            continue
        try:
            pdfmetrics.registerFont(TTFont("LS-CN", reg, subfontIndex=0))
            pdfmetrics.registerFont(TTFont("LS-CN-Bold", bold, subfontIndex=0))
            _fonts = ("LS-CN", "LS-CN-Bold")
            break
        except Exception:
            continue
    if not _fonts:
        pdfmetrics.registerFont(UnicodeCIDFont("STSong-Light"))
        _fonts = ("STSong-Light", "STSong-Light")
    # 登记成一族，段落里的 <b> 才会换成加粗字体
    pdfmetrics.registerFontFamily(_fonts[0], normal=_fonts[0], bold=_fonts[1], italic=_fonts[0], boldItalic=_fonts[1])
    return _fonts


def _styles(reg: str, bold: str) -> dict:
    body = ParagraphStyle("body", fontName=reg, fontSize=10.5, leading=16, textColor=INK,
                          wordWrap="CJK", spaceAfter=3)
    s = {"body": body}
    for lvl, size, color in ((1, 16, WATER), (2, 13.5, WATER), (3, 11.5, INK), (4, 10.5, INK)):
        s[lvl] = ParagraphStyle(f"h{lvl}", parent=body, fontName=bold, fontSize=size, leading=size * 1.45,
                                textColor=color, spaceBefore=12 if lvl <= 2 else 8, spaceAfter=4, keepWithNext=1)
    s["title"] = ParagraphStyle("title", parent=body, fontName=bold, fontSize=18, leading=24, spaceAfter=2)
    s["meta"] = ParagraphStyle("meta", parent=body, fontSize=9, textColor=GRAY, spaceAfter=10)
    s["quote"] = ParagraphStyle("quote", parent=body, leftIndent=10, textColor=GRAY)
    s["code"] = ParagraphStyle("code", parent=body, fontSize=9, leading=13, leftIndent=8, textColor=GRAY, spaceAfter=0)
    s["cell"] = ParagraphStyle("cell", parent=body, fontSize=9.5, leading=14, spaceAfter=0)
    s["cellHead"] = ParagraphStyle("cellHead", parent=s["cell"], fontName=bold)
    s["answer"] = ParagraphStyle("answer", parent=body, fontSize=9, textColor=GRAY, spaceAfter=0)
    return s


def _inline(text: str) -> str:
    """Markdown 行内语法换成 reportlab 段落标记；其余文字一律转义，免得 < & 弄坏排版。"""
    text = text.replace("[ ] ", "□ ").replace("[x] ", "■ ").replace("[X] ", "■ ")
    text = _EMOJI.sub("", text)
    out = []
    for part in _INLINE.split(text):
        if not part:
            continue
        if (part.startswith("**") and part.endswith("**")) or (part.startswith("__") and part.endswith("__")):
            out.append(f"<b>{escape(part[2:-2])}</b>")
        elif part.startswith("`") and part.endswith("`"):
            out.append(f'<font color="#C0265A">{escape(part[1:-1])}</font>')
        elif part.startswith("*") and part.endswith("*") and len(part) > 2:
            out.append(escape(part[1:-1]))   # 中文字体没有斜体，按正文显示
        elif part.startswith("[") and "](" in part:
            out.append(escape(part[1:part.index("](")]))
        else:
            out.append(escape(part))
    return "".join(out).strip()


def _cells(line: str) -> List[str]:
    line = line.strip()
    if line.startswith("|"):
        line = line[1:]
    if line.endswith("|"):
        line = line[:-1]
    return [c.strip() for c in line.split("|")]


def _table(rows: List[List[str]], s: dict) -> Table:
    n = max(len(r) for r in rows)
    rows = [r + [""] * (n - len(r)) for r in rows]
    # 列宽按每列最长的内容分，过窄过宽都夹一下
    weights = [min(40, max(4, max(len(r[i]) for r in rows))) for i in range(n)]
    widths = [WIDTH * w / sum(weights) for w in weights]
    data = [[Paragraph(_inline(c), s["cellHead"] if ri == 0 else s["cell"]) for c in r] for ri, r in enumerate(rows)]
    t = Table(data, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("GRID", (0, 0), (-1, -1), 0.5, LINE),
        ("BACKGROUND", (0, 0), (-1, 0), colors.HexColor("#F1F5F9")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
        ("LEFTPADDING", (0, 0), (-1, -1), 5), ("RIGHTPADDING", (0, 0), (-1, -1), 5),
        ("TOPPADDING", (0, 0), (-1, -1), 3), ("BOTTOMPADDING", (0, 0), (-1, -1), 4),
    ]))
    return t


def _answer_box(s: dict) -> Table:
    t = Table([[Paragraph("我的回答：", s["answer"])]], colWidths=[WIDTH], rowHeights=[100])
    t.setStyle(TableStyle([("BOX", (0, 0), (-1, -1), 0.6, LINE), ("VALIGN", (0, 0), (-1, -1), "TOP")]))
    return t


def build(md: str, title: str, meta: str, mode: str = "full") -> bytes:
    reg, bold = _register()
    s = _styles(reg, bold)
    story: list = []
    if mode == "resume":
        md = resume_section(md) or md
    else:
        story += [Paragraph(_inline(title), s["title"]), Paragraph(escape(meta), s["meta"])]

    lines = md.splitlines()
    i, pending_answer = 0, False

    def flush_answer():
        nonlocal pending_answer
        if pending_answer:
            story.extend([Spacer(1, 4), _answer_box(s), Spacer(1, 8)])
            pending_answer = False

    while i < len(lines):
        line = lines[i]
        st = line.strip()
        if st.startswith("```"):
            i += 1
            while i < len(lines) and not lines[i].strip().startswith("```"):
                raw = lines[i]
                lead = len(raw) - len(raw.lstrip(" "))
                story.append(Paragraph("&nbsp;" * lead + escape(raw.lstrip(" ")), s["code"]))
                i += 1
            i += 1
            continue
        hm = re.match(r"^(#{1,6})\s+(.*)", st)
        if hm:
            flush_answer()
            lvl, text = min(len(hm.group(1)), 4), hm.group(2).strip()
            story.append(Paragraph(_inline(text), s[lvl]))
            if mode == "practice" and lvl >= 2 and QUESTION_HEADING.match(text):
                pending_answer = True
            i += 1
            continue
        if st.startswith("|") and i + 1 < len(lines) and _TABLE_SEP.match(lines[i + 1].strip()):
            rows = [_cells(st)]
            i += 2
            while i < len(lines) and lines[i].strip().startswith("|"):
                rows.append(_cells(lines[i]))
                i += 1
            story.extend([Spacer(1, 3), _table(rows, s), Spacer(1, 6)])
            continue
        if re.match(r"^(-{3,}|\*{3,}|_{3,})$", st):
            i += 1
            continue   # 分隔线：和 Word 一样靠标题分段
        if st.startswith(">"):
            story.append(Paragraph(_inline(st.lstrip("> ").strip()), s["quote"]))
            i += 1
            continue
        lm = _LIST.match(line)
        if lm:
            depth = len(lm.group(1).replace("\t", "  ")) // 2
            marker, text = lm.group(2), lm.group(3)
            style = ParagraphStyle(f"li{depth}", parent=s["body"], leftIndent=16 + 14 * depth,
                                   bulletIndent=3 + 14 * depth, bulletFontName=reg, spaceAfter=2)
            bullet = marker if marker[0].isdigit() else ("•" if depth == 0 else "·")
            story.append(Paragraph(_inline(text), style, bulletText=bullet))
            i += 1
            continue
        if st:
            story.append(Paragraph(_inline(st), s["body"]))
        i += 1
    flush_answer()

    def footer(canvas, doc):
        canvas.saveState()
        canvas.setFont(reg, 8)
        canvas.setFillColor(GRAY)
        canvas.drawRightString(A4[0] - MARGIN_X, 10 * mm, str(doc.page))
        canvas.restoreState()

    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=MARGIN_X, rightMargin=MARGIN_X,
                            topMargin=MARGIN_Y, bottomMargin=MARGIN_Y, title=title, author="流水")
    doc.build(story or [Spacer(1, 1)], onFirstPage=footer, onLaterPages=footer)
    return buf.getvalue()
