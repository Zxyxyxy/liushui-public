---
name: check-in
description: Clean up Friday leadership check-in notes into polished DOCX/PDF files and maintain an action item tracker.
argument-hint: "[file.docx | --all | --tracker]"
---

Process Friday leadership team check-in notes from messy raw notes into polished, consistently formatted documents.

Arguments: $ARGUMENTS

## Base Path

```
$ONEDRIVE_WORK/Meeting Notes/Friday Check-In/
```

Subdirectories:
- `Raw/` — original messy DOCX files (upload new notes here)
- `Cleaned/` — polished DOCX output
- `PDF/` — PDF exports

Create subdirectories if they don't exist.

## Modes

### 1. Single file: `/check-in path/to/file.docx`
Process one file through the full pipeline.

### 2. Batch: `/check-in --all`
Process all unprocessed .docx files in the base directory:
- Enumerate all .docx files in the `Raw/` subdirectory
- **Skip non-check-in files**: Capital Project Meeting.docx, Data Dashboard Preparation.docx, Electric Bus FAQ.docx, Electric Bus Points.docx, Friday Check.docx, $AUTHOR_NAME.docx, Operations Team Meeting Notes Sept 6.docx
- Skip files that already have a corresponding `Cleaned/Friday Check-Ins - YYYY-MM-DD.docx`
- Parse dates from filenames (see Date Parsing below)
- Process in chronological order
- Print progress: "Processing 7/33: Feb 20 2026..."
- Regenerate tracker at the end

#### Agent Teams for Batch Processing

When processing 5+ files, use agent teams for parallel processing:

1. **Create the team**: `TeamCreate` with `team_name: "check-in-batch"`.
2. **Enumerate and filter files first** (skip list, already-processed check), then parse dates.
3. **Create one task per file** via `TaskCreate`. Include the file path, parsed date, and output paths in the task description.
4. **Spawn 3-4 teammates** via `Agent` tool with `team_name: "check-in-batch"`, `subagent_type: "general-purpose"`, named `processor-1` through `processor-4`. Launch all in a single message.
5. Each teammate checks `TaskList` for available tasks, claims one via `TaskUpdate`, processes it through Steps 0-3 (safety check, read, AI cleanup, write cleaned DOCX), marks it completed, then claims the next available task.
6. **Coordinator monitors via `TaskList`**. When all file tasks are complete, collect all extracted action items, regenerate the Action Item Tracker, batch-export PDFs, then shut down teammates and `TeamDelete`.

For fewer than 5 files, process sequentially without teams.

### 3. Tracker only: `/check-in --tracker`
Regenerate Action Item Tracker.xlsx from all existing cleaned files.

## Department Head Mapping

Use this lookup to expand first names found in the notes:

```python
DEPT_HEADS = {
    "debbie": "[Name] - Tech Purchasing & Administration",
    "karen": "[Name] - School Nutrition",
    "julie": "[Name] - Data & EIS",
    "ellen": "[Name] - Finance",
    "melissa": "[Name] - Human Resources",
    "phillip": "[Name] - Maintenance & Facilities",
    "roger": "[Name] - Custodial Services",
    "chuck": "[Name] - Technology",
    "tracie": "[Name] - Coordinated School Health",
    "kristen": "[Name] - Transportation & Operations",
}
```

## Pipeline (per file)

### Step 0: Safety check

Before writing any cleaned file, check if a `Cleaned/Friday Check-Ins - YYYY-MM-DD.docx` already exists AND has been modified more recently than the corresponding raw file. If so, back it up to `~/Documents/Friday Check-In Backups/Friday Check-Ins - YYYY-MM-DD.backup.docx` before overwriting. Create the backup directory if it doesn't exist. This prevents losing manual edits.

### Step 1: Read raw text

Run this Python to extract all paragraph text from the source DOCX:

```python
from docx import Document
import json, sys

doc = Document(sys.argv[1])
paragraphs = []
for p in doc.paragraphs:
    paragraphs.append({
        "text": p.text,
        "style": p.style.name if p.style else "Normal",
        "level": p.paragraph_format.left_indent
    })
print(json.dumps(paragraphs, indent=2, default=str))
```

### Step 2: AI cleanup

Read the raw paragraph JSON and restructure it. Rules:

1. **Parse the date** from the filename or content. Standardize to "Month Day, Year" (e.g., "February 20, 2026").

2. **Identify department sections** by looking for standalone paragraphs that match a first name from DEPT_HEADS (case-insensitive). Also handle variations like "Attendee: Karen, School Nutrition" or "Karen (Nutrition)".

3. **Clean up each person's notes**:
   - Fix obvious typos and spelling errors
   - Convert sentence fragments into clean, complete sentences
   - Organize into a bullet hierarchy: major topics as top-level bullets, supporting details as sub-bullets
   - Maintain third-person perspective ("Karen reported..." not "I reported...")
   - Preserve all factual content, do NOT add information that isn't in the original
   - Keep proper nouns, acronyms, and specific numbers exactly as stated

4. **Extract action items** from each person's section. An action item is any commitment, deadline, follow-up, or decision that requires future action. For each, capture:
   - Person (full name)
   - Department
   - Action item description (clean sentence)
   - Due date (if mentioned, otherwise blank)

5. If a file has duplicate content (same meeting notes appearing twice with different formatting), merge them into one clean version.

### Step 3: Write cleaned DOCX

Run Python to generate the formatted document. Use this structure:

```python
from docx import Document
from docx.shared import Pt, Inches, RGBColor
from docx.enum.text import WD_ALIGN_PARAGRAPH
import sys, json, os

def create_cleaned_doc(title_date, sections, output_path):
    """
    title_date: str like "February 20, 2026"
    sections: list of dicts with keys: heading, bullets
      bullets: list of dicts with keys: text, level (0 or 1)
    """
    doc = Document()

    # Set default font
    style = doc.styles['Normal']
    font = style.font
    font.name = 'Calibri'
    font.size = Pt(11)

    # Title
    title = doc.add_heading(f'Friday Check-Ins - {title_date}', level=0)
    for run in title.runs:
        run.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)

    for section in sections:
        # Department heading
        h = doc.add_heading(section['heading'], level=2)
        for run in h.runs:
            run.font.color.rgb = RGBColor(0x1F, 0x38, 0x64)

        # Bullet content
        for bullet in section['bullets']:
            level = bullet.get('level', 0)
            style_name = 'List Bullet' if level == 0 else 'List Bullet 2'
            p = doc.add_paragraph(bullet['text'], style=style_name)
            for run in p.runs:
                run.font.name = 'Calibri'
                run.font.size = Pt(11)

    doc.save(output_path)
    print(f"Saved: {output_path}")
```

Output filename: `Cleaned/Friday Check-Ins - YYYY-MM-DD.docx`

### Step 4: Update action item tracker

Append extracted action items to the tracker (see Tracker section below).

### Step 5: Export PDF

```python
from docx2pdf import convert
convert(cleaned_path, pdf_path)
```

Output: `PDF/Friday Check-Ins - YYYY-MM-DD.pdf`

## Action Item Tracker (xlsx)

File: `Action Item Tracker.xlsx` in the base Friday Check-In directory.

### Sheet 1: Action Items

Headers (row 1, navy #1F3864 fill, white text, Calibri 11pt bold):
| Date | Person | Department | Action Item | Status | Due Date | Follow-Up Notes |

- Column widths: A=14, B=22, C=35, D=50, E=16, F=14, G=40
- Status dropdown: Open, In Progress, Complete
- Person dropdown: all 10 department head full names
- Frozen header row
- Alternating light blue rows (#D6E4F0)
- Date format: YYYY-MM-DD
- All new action items default Status to "Open"

### Sheet 2: Dashboard

Row 1: Title "Friday Check-In Action Items - Dashboard" (navy, 14pt bold)

Row 3: Headers: Person | Open | In Progress | Complete | Total

Rows 4-13: One row per department head (full name) with COUNTIFS formulas:
```
=COUNTIFS('Action Items'!B:B,A4,'Action Items'!E:E,"Open")
=COUNTIFS('Action Items'!B:B,A4,'Action Items'!E:E,"In Progress")
=COUNTIFS('Action Items'!B:B,A4,'Action Items'!E:E,"Complete")
=B4+C4+D4
```

Row 14: Totals row with SUM formulas

Row 16: "Completion Rate:" with formula `=IF(E14>0,D14/E14,0)` formatted as percentage

Row 17: "Date Range:" with `=MIN('Action Items'!A:A)&" to "&MAX('Action Items'!A:A)`

Same styling: navy headers, alternating rows, Calibri 11pt, frozen header.

### Creating/updating the tracker

If the tracker doesn't exist, create it fresh with the structure above.

If it exists, read existing rows first to avoid duplicates. A duplicate is defined as matching Date + Person + Action Item text. Append only new items.

## Date Parsing from Filenames

Handle these known filename patterns:
- `Feb 20 2026.docx` → 2026-02-20
- `February 14 2025 .docx` → 2025-02-14
- `Dec 13 2024.docx` → 2024-12-13
- `Friday Check-In Notes – October 17, 2025.docx` → 2025-10-17
- `Oct 24 2025 Friday Check-Ins.docx` → 2025-10-24
- `October 25 2024 Friday Checkin.docx` → 2024-10-25
- `Check-Ins Friday August 2.docx` → 2024-08-02 (no year = 2024)
- `Friday January 17.docx` → 2025-01-17 (no year = 2025)
- `Friday September 19.docx` → 2024-09-19
- `Sept 6.docx` → 2024-09-06
- `August 16.docx` → 2024-08-16
- `Nov 8 2024 check in notes.docx` → 2024-11-08
- `Jan 31 2025 Notes.docx` → 2025-01-31
- `September 13 Check-In.docx` → 2024-09-13
- `Friday_Check-In_Notes_April_11_2025.docx` → 2025-04-11
- `September 5 2025.docx` → 2025-09-05
- `Dec 5 2025.docx` → 2025-12-05

Strategy: strip the .docx extension, remove known prefixes/suffixes (Friday, Check-In, Check-Ins, Checkin, Notes), then parse the remaining date components with dateutil.parser or manual matching.

## Rules

- Never lose information from the original notes. The cleanup adds structure and fixes grammar, but every fact must be preserved.
- When uncertain about a name mapping, keep the original text and flag it in output.
- For batch mode, process files sequentially to avoid overwhelming the system.
- If a DOCX can't be read (corrupted, password-protected), skip it and report the error.
- Always create Cleaned/ and PDF/ directories if they don't exist.
- After processing, report: number of files processed, action items extracted, and any skipped files.
