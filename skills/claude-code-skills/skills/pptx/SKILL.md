---
name: pptx
description: Generate a professional PowerPoint presentation from a folder of source documents and a prompt.
argument-hint: "<folder-path> <prompt describing the presentation>"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, Task
---

Generate a polished `.pptx` presentation by reading source documents from a folder and synthesizing them according to a user prompt.

Target folder and prompt: $ARGUMENTS

## Argument Parsing

```
/pptx <folder-path> <prompt describing the presentation>
```

- The first token that resolves to an existing directory is the folder path.
- Everything after the folder path is the presentation prompt.
- Example: `/pptx ~/Documents/Budget "Board update on Q3 budget performance and projections"`

If no folder path is provided, ask the user for one. If no prompt is provided, ask the user what the presentation should cover.

## Step 1: Scan the Folder

Use Glob to find all supported files in the folder:
- `.docx`, `.pdf`, `.txt`, `.md`, `.xlsx`, `.csv`, `.pptx`

Report what was found. If the folder is empty or has no supported files, tell the user.

## Step 2: Extract Text from Source Documents

### Parallel Extraction via Agent Teams (4+ source files)

When the folder contains 4 or more source documents, use agent teams for parallel extraction:

1. **Create the team**: `TeamCreate` with `team_name: "pptx-extraction"`.
2. **Create one task per source file** via `TaskCreate`, with the file path and extraction method in each task description.
3. **Spawn 2-3 teammates** via `Agent` tool with `team_name: "pptx-extraction"`, `subagent_type: "general-purpose"`, named `extractor-1`, `extractor-2`, etc. Launch all in a single message.
4. **Assign files** evenly across teammates via `TaskUpdate`.
5. Each teammate extracts text from its assigned files using the methods below and sends results back via `SendMessage`.
6. **Monitor via `TaskList`**. When all tasks complete, collect extracted text, then shut down teammates and `TeamDelete`.

For 3 or fewer source files, extract sequentially without teams.

### Extraction Methods

Read each file to extract its text content. Use Python scripts via Bash for binary formats:

### .docx files
```python
from docx import Document
doc = Document("FILE_PATH")
text = []
for p in doc.paragraphs:
    if p.text.strip():
        text.append(p.text)
for table in doc.tables:
    for row in table.rows:
        row_text = [cell.text.strip() for cell in row.cells]
        text.append(" | ".join(row_text))
print("\n".join(text))
```

### .pdf files
```python
import fitz
doc = fitz.open("FILE_PATH")
for page in doc:
    print(page.get_text())
```

### .xlsx files
```python
from openpyxl import load_workbook
wb = load_workbook("FILE_PATH", data_only=True)
for ws in wb.worksheets:
    print(f"--- Sheet: {ws.title} ---")
    for row in ws.iter_rows(values_only=True):
        vals = [str(v) if v is not None else "" for v in row]
        print(" | ".join(vals))
```

### .pptx files (existing presentations)
```python
from pptx import Presentation
prs = Presentation("FILE_PATH")
for i, slide in enumerate(prs.slides, 1):
    print(f"--- Slide {i} ---")
    for shape in slide.shapes:
        if shape.has_text_frame:
            print(shape.text_frame.text)
```

### .txt, .md, .csv files
Use the Read tool directly.

## Step 3: Analyze Content and Design Slide Structure

Synthesize all extracted content according to the user's prompt. Design a slide outline with 8-20 slides. For each slide, specify:
- Slide type (from the types below)
- Section label (small gold caps text above the title, e.g., "BACKGROUND", "KEY FINDINGS")
- Title text
- Body content (bullets, cards, table data, quote text, etc.)

### Available Slide Types

| Type | Function Name | Use Case |
|------|--------------|----------|
| Title Slide | `make_title_slide()` | Opening: navy BG, gold borders, Georgia title, subtitle, date |
| Section Divider | `make_section_slide()` | Full-navy slide with large Georgia title and description |
| Content w/ Cards | `make_card_slide()` | Light BG, navy header, 2-6 white cards with gold left accent |
| Two-Column Cards | `make_two_column_cards()` | Light BG, navy header, 2x2 or 2x3 grid of white cards |
| List Slide | `make_list_slide()` | Numbered items as horizontal bars with heading + description |
| Table Slide | `make_table_slide()` | Data table with navy header cells and description column |
| Quote Slide | `make_quote_slide()` | Navy BG, blue panel with gold accent, italicized quote |
| Callout Boxes | `make_callout_slide()` | Side-by-side colored panels (navy, blue, green, red) |
| Timeline Slide | `make_timeline_slide()` | Horizontal timeline with dated events |
| Closing Slide | `make_closing_slide()` | Navy BG, gold borders, closing message |

### Content Rules

- Max 6 bullets/cards per slide
- Tables max 7 data rows per slide (split across slides if more)
- Always include a Title Slide first and a Closing Slide last
- If source docs are very large, summarize rather than overflow
- Use a variety of slide types for visual interest
- Alternate between navy-background and light-background slides for rhythm

## Step 4: Generate the Python Script

Compose a self-contained Python script that generates the presentation. Write it to `/tmp/pptx_gen_<timestamp>.py`. The script must include all helper functions below and the slide content from Step 3.

### Topic and Filename

Derive a 2-4 word topic from the prompt (underscored, Title Case). Output file:
```
~/Documents/Presentation_<Topic>_<YYYY-MM-DD>.pptx
```

### Complete Python Helper Code

The generated script MUST include all of the following code. Copy it exactly into every generated script, then add the slide-building calls after it.

```python
import os
from datetime import date
from pptx import Presentation
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from lxml import etree

# ── Color Palette (matches the branded presentation style) ─────────────
NAVY = RGBColor(0x1B, 0x3A, 0x6B)
BLUE = RGBColor(0x2E, 0x55, 0x99)
DARK_BLUE = RGBColor(0x24, 0x3D, 0x6B)
DEEP_NAVY = RGBColor(0x1A, 0x2E, 0x54)
GOLD = RGBColor(0xC9, 0xA8, 0x4C)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
LIGHT_BG = RGBColor(0xF0, 0xF2, 0xF5)
WARM_BG = RGBColor(0xFD, 0xFA, 0xF3)
DARK_TEXT = RGBColor(0x2C, 0x2C, 0x2C)
MID_TEXT = RGBColor(0x44, 0x44, 0x44)
LIGHT_NAVY_TEXT = RGBColor(0xAA, 0xBB, 0xD4)
LIGHT_BLUE_TEXT = RGBColor(0xC0, 0xD0, 0xE8)
LIGHT_GOLD_TEXT = RGBColor(0xD8, 0xE4, 0xF4)
MUTED_TEXT = RGBColor(0x66, 0x88, 0xAA)
GRAY_ACCENT = RGBColor(0xCC, 0xCC, 0xCC)
DARK_RED = RGBColor(0x6B, 0x1B, 0x1B)
DARK_GREEN = RGBColor(0x1A, 0x4A, 0x2A)
GREEN_TEXT = RGBColor(0x7F, 0xD9, 0xA8)
RED_TEXT = RGBColor(0xFF, 0xAA, 0xAA)

# ── Layout Constants (standard widescreen 10" x 5.625") ──────────
SLIDE_WIDTH = Inches(10)
SLIDE_HEIGHT = Inches(5.625)
MARGIN = Inches(0.3)
HEADER_HEIGHT = Inches(1.0)
BODY_TOP = Inches(1.1)
CONTENT_WIDTH = Inches(9.4)
GOLD_BAR_THICKNESS = Inches(0.08)

# ── Presentation Setup ───────────────────────────────────────────
prs = Presentation()
prs.slide_width = SLIDE_WIDTH
prs.slide_height = SLIDE_HEIGHT
prs.core_properties.author = "$AUTHOR_NAME"

BLANK_LAYOUT = prs.slide_layouts[6]
slide_counter = [0]


def set_slide_bg(slide, color):
    """Set solid background fill for a slide."""
    fill = slide.background.fill
    fill.solid()
    fill.fore_color.rgb = color


def rect(slide, left, top, width, height, fill_color):
    """Add a filled rectangle shape with no border."""
    shape = slide.shapes.add_shape(1, left, top, width, height)
    shape.fill.solid()
    shape.fill.fore_color.rgb = fill_color
    shape.line.fill.background()
    return shape


def text_box(slide, left, top, width, height):
    """Add a text box and return its text frame."""
    txBox = slide.shapes.add_textbox(left, top, width, height)
    txBox.text_frame.word_wrap = True
    return txBox.text_frame


def set_text(tf_or_p, text, size, color, font="Calibri", bold=False, italic=False, align=PP_ALIGN.LEFT):
    """Set text properties on a paragraph or the first paragraph of a text frame."""
    if hasattr(tf_or_p, 'paragraphs'):
        p = tf_or_p.paragraphs[0]
    else:
        p = tf_or_p
    p.text = text
    p.font.size = Pt(size)
    p.font.color.rgb = color
    p.font.name = font
    p.font.bold = bold
    p.font.italic = italic
    p.alignment = align
    return p


def add_header_bar(slide, section_label, title_text, subtitle_text=""):
    """Add navy header bar with gold left edge, section label in gold caps, and Georgia title."""
    # Gold left edge
    rect(slide, Inches(0), Inches(0), Inches(0.2), SLIDE_HEIGHT, GOLD)
    # Navy header
    rect(slide, Inches(0.2), Inches(0), Inches(9.8), HEADER_HEIGHT, NAVY)
    # Section label
    if section_label:
        tf = text_box(slide, Inches(0.5), Inches(0), Inches(5.0), Inches(0.35))
        set_text(tf, section_label.upper(), 8, GOLD, bold=True)
    # Title
    tf2 = text_box(slide, Inches(0.5), Inches(0.3), Inches(9.3), Inches(0.65))
    title_size = 22 if len(title_text) > 40 else 26
    set_text(tf2, title_text, title_size, WHITE, font="Georgia", bold=True)
    # Subtitle
    if subtitle_text:
        tf3 = text_box(slide, Inches(0.5), Inches(0.55), Inches(9.3), Inches(0.4))
        set_text(tf3, subtitle_text, 14, WHITE, font="Georgia")


def add_navy_header_bar(slide, section_label, title_text, subtitle_text=""):
    """Add header bar for navy-background slides: gold top bar, label, Georgia title."""
    # Gold top bar
    rect(slide, Inches(0), Inches(0), SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)
    # Section label pill
    if section_label:
        tf = text_box(slide, Inches(0.4), Inches(0.2), Inches(3.0), Inches(0.3))
        set_text(tf, section_label.upper(), 8, WHITE, bold=True)
    # Title
    tf2 = text_box(slide, Inches(0.4), Inches(0.6), Inches(9.0), Inches(0.7))
    title_size = 30 if len(title_text) > 30 else 36
    set_text(tf2, title_text, title_size, WHITE, font="Georgia", bold=True)
    # Subtitle
    if subtitle_text:
        tf3 = text_box(slide, Inches(0.4), Inches(1.3), Inches(9.2), Inches(0.4))
        set_text(tf3, subtitle_text, 13, LIGHT_NAVY_TEXT, italic=True)


def add_source_line(slide, source_text):
    """Add a small italicized source attribution at the bottom of a slide."""
    tf = text_box(slide, Inches(0.4), Inches(5.2), Inches(9.0), Inches(0.3))
    set_text(tf, source_text, 9, MUTED_TEXT, italic=True)


def make_card(slide, left, top, width, height, heading, body_text, accent_color=GOLD):
    """Create a white card with a colored left accent bar, heading, and body text."""
    # White card background
    rect(slide, left, top, width, height, WHITE)
    # Gold left accent
    rect(slide, left, top, Inches(0.1), height, accent_color)
    # Heading
    tf_h = text_box(slide, left + Inches(0.2), top + Inches(0.1), width - Inches(0.3), Inches(0.3))
    set_text(tf_h, heading, 12, NAVY, bold=True)
    # Body
    if body_text:
        tf_b = text_box(slide, left + Inches(0.2), top + Inches(0.4), width - Inches(0.3), height - Inches(0.5))
        set_text(tf_b, body_text, 10, MID_TEXT)


def make_numbered_card(slide, left, top, width, height, number, heading, body_text, accent_color=GOLD):
    """Create a white card with a number badge, heading, and body text."""
    # White card background
    rect(slide, left, top, width, height, WHITE)
    # Gold left accent
    rect(slide, left, top, Inches(0.1), height, accent_color)
    # Number badge
    badge = rect(slide, left + Inches(0.1), top + Inches(0.3), Inches(0.4), Inches(0.4), NAVY)
    badge.text_frame.word_wrap = False
    set_text(badge.text_frame, str(number), 11, WHITE, bold=True, align=PP_ALIGN.CENTER)
    # Heading
    tf_h = text_box(slide, left + Inches(0.6), top + Inches(0.1), width - Inches(0.7), Inches(0.3))
    set_text(tf_h, heading, 12, NAVY, bold=True)
    # Body
    if body_text:
        tf_b = text_box(slide, left + Inches(0.6), top + Inches(0.4), width - Inches(0.7), height - Inches(0.5))
        set_text(tf_b, body_text, 10, MID_TEXT)


# ═══════════════════════════════════════════════════════════════════
# SLIDE TYPE FUNCTIONS
# ═══════════════════════════════════════════════════════════════════

def make_title_slide(title, subtitle="", context_line="", date_text=None, author="$AUTHOR_FULL"):
    """
    Opening slide: navy background, gold border accents, Georgia title.
    context_line: small text at top (e.g., course name, meeting name).
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, NAVY)

    # Gold border bars (top, bottom, left sidebar)
    rect(slide, Inches(0), Inches(0), SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)
    rect(slide, Inches(0), SLIDE_HEIGHT - GOLD_BAR_THICKNESS, SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)
    rect(slide, Inches(0), GOLD_BAR_THICKNESS, Inches(0.55), SLIDE_HEIGHT - GOLD_BAR_THICKNESS * 2, BLUE)
    rect(slide, Inches(0), GOLD_BAR_THICKNESS, Inches(0.18), SLIDE_HEIGHT - GOLD_BAR_THICKNESS * 2, GOLD)

    # Context line (small gold text)
    if context_line:
        tf = text_box(slide, Inches(0.7), Inches(0.7), Inches(8.8), Inches(0.3))
        set_text(tf, context_line, 9, GOLD, bold=True)

    # Title (large Georgia)
    title_top = Inches(1.1) if context_line else Inches(1.5)
    tf2 = text_box(slide, Inches(0.7), title_top, Inches(6.8), Inches(1.9))
    title_size = 36 if len(title) > 30 else 44
    set_text(tf2, title, title_size, WHITE, font="Georgia", bold=True)

    # Subtitle (Georgia italic, gold)
    if subtitle:
        tf3 = text_box(slide, Inches(0.7), title_top + Inches(1.9), Inches(6.8), Inches(0.7))
        set_text(tf3, subtitle, 26, GOLD, font="Georgia", italic=True)

    # Date
    if date_text is None:
        date_text = date.today().strftime("%B %d, %Y")
    tf4 = text_box(slide, Inches(0.7), Inches(3.8), Inches(6.8), Inches(0.3))
    set_text(tf4, date_text, 13, LIGHT_NAVY_TEXT)

    # Author
    tf5 = text_box(slide, Inches(0.7), Inches(4.2), Inches(8.5), Inches(0.3))
    set_text(tf5, author, 11, MUTED_TEXT)

    return slide


def make_section_slide(section_title, description="", label=""):
    """
    Full-navy section divider with gold top bar and large Georgia title.
    Use between major sections for visual rhythm.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, NAVY)

    # Gold top bar
    rect(slide, Inches(0), Inches(0), SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)

    # Label
    if label:
        tf = text_box(slide, Inches(0.4), Inches(0.3), Inches(3.0), Inches(0.3))
        set_text(tf, label.upper(), 8, WHITE, bold=True)

    # Section title
    tf2 = text_box(slide, Inches(0.4), Inches(0.7), Inches(9.0), Inches(0.8))
    set_text(tf2, section_title, 36, WHITE, font="Georgia", bold=True)

    # Description
    if description:
        tf3 = text_box(slide, Inches(0.4), Inches(1.6), Inches(9.2), Inches(0.5))
        set_text(tf3, description, 13, LIGHT_NAVY_TEXT, italic=True)

    return slide


def make_card_slide(section_label, title, cards, bg_color=None):
    """
    Light-background slide with navy header and white cards with gold left accents.
    cards: list of dicts with 'heading' and 'text' keys.
    Arranges 1-6 cards in a responsive layout.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, bg_color or LIGHT_BG)
    add_header_bar(slide, section_label, title)

    n = len(cards)
    if n <= 3:
        # Single row
        card_w = Inches(4.7) if n == 2 else Inches(3.0)
        gap = Inches(0.15)
        start_x = Inches(0.3)
        for i, card in enumerate(cards):
            x = start_x + i * (card_w + gap)
            make_card(slide, x, Inches(1.15), card_w, Inches(1.1),
                      card.get('heading', ''), card.get('text', ''),
                      card.get('accent', GOLD))
    else:
        # Two rows, 2-3 per row
        cols = (n + 1) // 2
        card_w = Inches(4.7) if cols == 2 else Inches(3.0)
        gap = Inches(0.15)
        start_x = Inches(0.3)
        row_h = Inches(1.1)
        row_gap = Inches(0.15)
        for i, card in enumerate(cards):
            row = i // cols
            col = i % cols
            x = start_x + col * (card_w + gap)
            y = Inches(1.15) + row * (row_h + row_gap)
            make_card(slide, x, y, card_w, row_h,
                      card.get('heading', ''), card.get('text', ''),
                      card.get('accent', GOLD))

    return slide


def make_two_column_cards(section_label, title, cards, bg_color=None):
    """
    Two-column card grid on light background with navy header.
    cards: list of dicts with 'heading' and 'text' keys.
    Arranged in 2 columns, stacking vertically.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, bg_color or LIGHT_BG)
    add_header_bar(slide, section_label, title)

    card_w = Inches(4.7)
    left_x = Inches(0.3)
    right_x = Inches(5.2)
    card_h = Inches(1.1)
    gap = Inches(0.15)
    start_y = Inches(1.15)

    for i, card in enumerate(cards):
        col = i % 2
        row = i // 2
        x = left_x if col == 0 else right_x
        y = start_y + row * (card_h + gap)
        make_card(slide, x, y, card_w, card_h,
                  card.get('heading', ''), card.get('text', ''),
                  card.get('accent', GOLD))

    return slide


def make_list_slide(section_label, title, items, bg_color=None):
    """
    Numbered list items as horizontal bars.
    items: list of dicts with 'heading' and 'text' keys.
    Light background with navy header. Each item gets a number badge.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, bg_color or LIGHT_BG)
    add_header_bar(slide, section_label, title)

    item_h = Inches(0.75)
    gap = Inches(0.08)
    start_y = Inches(1.15)

    for i, item in enumerate(items):
        y = start_y + i * (item_h + gap)
        make_numbered_card(slide, Inches(0.3), y, CONTENT_WIDTH, item_h,
                           i + 1, item.get('heading', ''), item.get('text', ''),
                           item.get('accent', GRAY_ACCENT if i < len(items) - 1 else NAVY))

    return slide


def make_table_slide(section_label, title, headers, rows, bg_color=None):
    """
    Table with navy label cells and description column.
    headers: list of column headers.
    rows: list of lists (each row's cell values).
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, bg_color or WARM_BG)

    # Full-width navy header
    rect(slide, Inches(0), Inches(0), SLIDE_WIDTH, HEADER_HEIGHT, NAVY)
    if section_label:
        tf = text_box(slide, Inches(0.5), Inches(0), Inches(5.0), Inches(0.3))
        set_text(tf, section_label.upper(), 8, GOLD, bold=True)
    tf2 = text_box(slide, Inches(0.5), Inches(0.3), Inches(9.0), Inches(0.65))
    set_text(tf2, title, 26, WHITE, font="Georgia", bold=True)

    num_rows = len(rows) + 1
    num_cols = len(headers)
    table_width = CONTENT_WIDTH
    row_height = min(Inches(0.55), (SLIDE_HEIGHT - Inches(1.3)) / num_rows)
    table_height = row_height * num_rows

    table_shape = slide.shapes.add_table(
        num_rows, num_cols, Inches(0.3), Inches(1.1), table_width, table_height
    )
    table = table_shape.table

    # Header row
    for j, header in enumerate(headers):
        cell = table.cell(0, j)
        cell.text = header
        cell.fill.solid()
        cell.fill.fore_color.rgb = NAVY
        p = cell.text_frame.paragraphs[0]
        p.font.size = Pt(11)
        p.font.color.rgb = WHITE
        p.font.name = "Calibri"
        p.font.bold = True
        p.alignment = PP_ALIGN.CENTER
        cell.vertical_anchor = MSO_ANCHOR.MIDDLE

    # Data rows
    for i, row_data in enumerate(rows):
        for j, val in enumerate(row_data):
            cell = table.cell(i + 1, j)
            cell.text = str(val)
            cell.fill.solid()
            cell.fill.fore_color.rgb = WHITE
            p = cell.text_frame.paragraphs[0]
            p.font.size = Pt(10.5)
            p.font.color.rgb = DARK_TEXT
            p.font.name = "Calibri"
            p.alignment = PP_ALIGN.CENTER if j > 0 else PP_ALIGN.LEFT
            cell.vertical_anchor = MSO_ANCHOR.MIDDLE

    # Thin borders
    tbl = table._tbl
    A_NS = 'http://schemas.openxmlformats.org/drawingml/2006/main'
    for tc in tbl.iter(f'{{{A_NS}}}tc'):
        tcPr = tc.find(f'{{{A_NS}}}tcPr')
        if tcPr is None:
            tcPr = etree.SubElement(tc, f'{{{A_NS}}}tcPr')
        for border_name in ['lnL', 'lnR', 'lnT', 'lnB']:
            ln = etree.SubElement(tcPr, f'{{{A_NS}}}{border_name}')
            ln.set('w', '6350')
            solidFill = etree.SubElement(ln, f'{{{A_NS}}}solidFill')
            srgb = etree.SubElement(solidFill, f'{{{A_NS}}}srgbClr')
            srgb.set('val', 'CCCCCC')

    return slide


def make_quote_slide(quote_text, attribution="", label=""):
    """
    Navy-background slide with a blue quote panel and gold left accent.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, NAVY)

    # Gold top bar
    rect(slide, Inches(0), Inches(0), SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)

    # Label
    if label:
        tf = text_box(slide, Inches(0.4), Inches(0.2), Inches(3.0), Inches(0.3))
        set_text(tf, label.upper(), 8, WHITE, bold=True)

    # Quote panel
    panel = rect(slide, Inches(0.4), Inches(1.0), Inches(9.2), Inches(2.0), BLUE)
    rect(slide, Inches(0.4), Inches(1.0), Inches(0.15), Inches(2.0), GOLD)

    # Quote text
    tf_q = text_box(slide, Inches(0.7), Inches(1.1), Inches(8.8), Inches(1.4))
    set_text(tf_q, f'\u201c{quote_text}\u201d', 13, WHITE, font="Georgia", italic=True)

    # Attribution
    if attribution:
        tf_a = text_box(slide, Inches(0.7), Inches(2.5), Inches(8.8), Inches(0.3))
        set_text(tf_a, f'\u2014 {attribution}', 10, GOLD)

    return slide


def make_callout_slide(section_label, title, panels, subtitle=""):
    """
    Side-by-side colored panels for comparison or key points.
    panels: list of dicts with 'heading', 'items' (list of strings), and optional 'color', 'text_color'.
    2-3 panels arranged horizontally.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, NAVY)

    add_navy_header_bar(slide, section_label, title, subtitle)

    n = len(panels)
    panel_gap = Inches(0.2)
    total_gap = panel_gap * (n - 1)
    panel_w = int((CONTENT_WIDTH - total_gap) / n)
    panel_h = Inches(3.0)
    panel_top = Inches(1.8) if subtitle else Inches(1.5)
    default_colors = [BLUE, DEEP_NAVY, DARK_RED, DARK_GREEN]

    for i, panel_data in enumerate(panels):
        x = Inches(0.3) + i * (panel_w + panel_gap)
        bg = panel_data.get('color', default_colors[i % len(default_colors)])
        text_c = panel_data.get('text_color', LIGHT_BLUE_TEXT)

        # Panel background
        p_rect = rect(slide, x, panel_top, panel_w, panel_h, bg)

        # Heading
        tf_h = text_box(slide, x + Inches(0.15), panel_top + Inches(0.1),
                        panel_w - Inches(0.3), Inches(0.35))
        set_text(tf_h, panel_data.get('heading', ''), 11, GOLD, bold=True)

        # List items
        items = panel_data.get('items', [])
        for j, item_text in enumerate(items):
            tf_item = text_box(slide, x + Inches(0.15), panel_top + Inches(0.5) + j * Inches(0.35),
                               panel_w - Inches(0.3), Inches(0.35))
            set_text(tf_item, f'\u2713  {item_text}', 10, text_c)

    return slide


def make_timeline_slide(section_label, title, events, bg_color=None):
    """
    Horizontal timeline with dated events.
    events: list of dicts with 'date', 'text', and optional 'color' (for the dot/bar).
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, bg_color or NAVY)

    add_navy_header_bar(slide, section_label, title)

    n = len(events)
    start_y = Inches(1.5)
    row_h = Inches(0.5)
    gap = Inches(0.08)

    for i, event in enumerate(events):
        y = start_y + i * (row_h + gap)
        dot_color = event.get('color', BLUE)
        text_color = event.get('text_color', LIGHT_NAVY_TEXT)

        # Date dot
        rect(slide, Inches(0.3), y, Inches(0.3), Inches(0.3), dot_color)

        # Connector line
        if i < n - 1:
            rect(slide, Inches(0.45), y + Inches(0.3), Inches(0.02), gap + Inches(0.2), BLUE)

        # Date label
        tf_d = text_box(slide, Inches(0.8), y - Inches(0.05), Inches(1.5), Inches(0.35))
        set_text(tf_d, event.get('date', ''), 10, LIGHT_NAVY_TEXT, bold=True)

        # Event bar
        bar_color = event.get('bar_color', DEEP_NAVY)
        rect(slide, Inches(2.5), y, Inches(7.1), Inches(0.35), bar_color)

        # Event text
        tf_e = text_box(slide, Inches(2.7), y, Inches(6.9), Inches(0.35))
        set_text(tf_e, event.get('text', ''), 10.5, text_color)

    return slide


def make_closing_slide(title="Thank You", subtitle="Questions & Discussion",
                       body_text="", footer="", author="$AUTHOR_FULL"):
    """
    Closing slide: navy background with gold borders, Georgia title, optional body text.
    """
    slide_counter[0] += 1
    slide = prs.slides.add_slide(BLANK_LAYOUT)
    set_slide_bg(slide, NAVY)

    # Gold borders (top, bottom, left)
    rect(slide, Inches(0), Inches(0), SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)
    rect(slide, Inches(0), SLIDE_HEIGHT - GOLD_BAR_THICKNESS, SLIDE_WIDTH, GOLD_BAR_THICKNESS, GOLD)
    rect(slide, Inches(0), GOLD_BAR_THICKNESS, Inches(0.18), SLIDE_HEIGHT - GOLD_BAR_THICKNESS * 2, GOLD)

    # Title
    tf = text_box(slide, Inches(0.5), Inches(0.8), Inches(9.0), Inches(0.8))
    set_text(tf, title, 38, WHITE, font="Georgia", bold=True)

    # Subtitle (gold, italic)
    if subtitle:
        tf2 = text_box(slide, Inches(0.5), Inches(1.8), Inches(8.5), Inches(0.8))
        set_text(tf2, subtitle, 15, GOLD, font="Georgia", italic=True)

    # Body text
    if body_text:
        tf3 = text_box(slide, Inches(0.5), Inches(2.6), Inches(8.5), Inches(1.5))
        set_text(tf3, body_text, 12, LIGHT_BLUE_TEXT)

    # Divider line
    rect(slide, Inches(0.5), Inches(4.3), Inches(9.0), Inches(0.02), BLUE)

    # Footer
    if footer:
        tf4 = text_box(slide, Inches(0.5), Inches(4.5), Inches(9.0), Inches(0.3))
        set_text(tf4, footer, 10, MUTED_TEXT)

    # Author
    tf5 = text_box(slide, Inches(0.5), Inches(4.9), Inches(9.0), Inches(0.3))
    set_text(tf5, author, 11, GOLD, bold=True)

    return slide
```

### After the helper functions, the script must:

1. Call the slide-building functions in order with the content from the outline
2. Save and print the path:
```python
output_path = os.path.expanduser(f"~/Documents/Presentation_{TOPIC}_{date.today().isoformat()}.pptx")
prs.save(output_path)
print(f"Saved: {output_path}")
```

## Step 5: Execute the Script

Run the generated script:
```
python3 /tmp/pptx_gen_<timestamp>.py
```

If it fails, read the error, fix the script, and re-run.

## Step 6: Clean Up and Open

1. Delete the temp script: `rm /tmp/pptx_gen_<timestamp>.py`
2. Open the presentation: `open ~/Documents/Presentation_<Topic>_<YYYY-MM-DD>.pptx`

## Step 7: Report

Print a summary:
```
Presentation complete.
File: ~/Documents/Presentation_<Topic>_YYYY-MM-DD.pptx
Slides: <count>
Slide types used: <list>
Source files read: <list>
```

## Professional Styling Reference

All styling is handled by the helper functions above. Design matches the branded presentation style:

- **Slide Size:** Standard widescreen 10" x 5.625"
- **Colors:** Navy (#1B3A6B), Blue (#2E5599), Gold (#C9A84C), Light BG (#F0F2F5), Warm BG (#FDFAF3)
- **Fonts:** Georgia for titles (22-44pt), Calibri for body (10-13pt)
- **Design Elements:**
  - Gold accent bars (thin lines on edges, card accents)
  - Gold left sidebar on title/closing slides
  - Navy header bars with gold section labels in small caps
  - White card-based layouts with gold left edge accents
  - Number badges (navy squares with white text)
- **Rhythm:** Alternate between navy-background and light-background slides
- **Cards:** White rectangles with gold left accent, bold navy heading, gray body text
- **All slides use Blank layout** for full styling control

## Rules

- Author metadata: "$AUTHOR_NAME"
- Default author line: "$AUTHOR_FULL"
- Do NOT ask for unnecessary input. Parse the arguments and generate.
- If extraction fails for one file, skip it and note it in the report.
- The generated Python script must be fully self-contained (no imports from external custom modules).
- Use `python-pptx` (already installed) and `lxml` (already installed).
- For PDFs, use `fitz` (PyMuPDF). If not installed, `pip3 install PyMuPDF` first.
- Always test the script execution. If it errors, fix and re-run.
- Clean up the temp script after successful generation.
