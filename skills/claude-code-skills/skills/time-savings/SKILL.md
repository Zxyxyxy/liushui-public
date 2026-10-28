---
name: time-savings
description: Generate a Time Savings Tracker spreadsheet (.xlsx) with a Task Log and Summary dashboard.
---

Generate a Claude Code Time Savings Tracker spreadsheet and open it.

## Steps

1. **Write and run the Python script below** using Bash. The script generates the .xlsx file.
2. **Open the file** with `open ~/Downloads/Claude_Code_Time_Savings_<today>.xlsx`

## Python Script

Run this exactly via `python3 -c '...'` or write to a temp file and execute:

```python
import os
from datetime import date
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side, numbers
from openpyxl.utils import get_column_letter
from openpyxl.worksheet.datavalidation import DataValidation
from openpyxl.chart import BarChart, Reference

today = date.today().isoformat()
output_path = os.path.expanduser(f"~/Downloads/Claude_Code_Time_Savings_{today}.xlsx")

wb = Workbook()

# ── Sheet 1: Task Log ──────────────────────────────────────────────
ws_log = wb.active
ws_log.title = "Task Log"

headers = ["Date", "Category", "Description", "Est. Hours Saved"]
header_font = Font(name="Calibri", bold=True, color="FFFFFF", size=11)
header_fill = PatternFill(start_color="2F5496", end_color="2F5496", fill_type="solid")
thin_border = Border(
    left=Side(style="thin", color="B4C6E7"),
    right=Side(style="thin", color="B4C6E7"),
    top=Side(style="thin", color="B4C6E7"),
    bottom=Side(style="thin", color="B4C6E7"),
)

for col_idx, header in enumerate(headers, 1):
    cell = ws_log.cell(row=1, column=col_idx, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = thin_border

# Column widths
ws_log.column_dimensions["A"].width = 14
ws_log.column_dimensions["B"].width = 30
ws_log.column_dimensions["C"].width = 50
ws_log.column_dimensions["D"].width = 18

# Freeze header row
ws_log.freeze_panes = "A2"

# Format columns for rows 2-500
for row in range(2, 501):
    # Date format
    ws_log.cell(row=row, column=1).number_format = "YYYY-MM-DD"
    # Hours format — 1 decimal
    ws_log.cell(row=row, column=4).number_format = "0.0"

# Category dropdown validation
categories = [
    "Calendar Rebuild",
    "Research Report",
    "File Restructure",
    "Daily Workflow",
    "Dissertation Review",
    "Student Paper Review",
    "Document Review",
    "Document Conversion",
    "Newsletter Generation",
    "Data Analysis / Dashboard",
    "Script/Automation Creation",
    "Policy/Contract Drafting",
    "Website/SEO Updates",
    "Enrollment Pipeline",
    "Other",
]
dv = DataValidation(
    type="list",
    formula1='"' + ",".join(categories) + '"',
    allow_blank=True,
    showDropDown=False,
)
dv.error = "Please select a category from the list."
dv.errorTitle = "Invalid Category"
dv.prompt = "Pick a category"
dv.promptTitle = "Category"
ws_log.add_data_validation(dv)
dv.add("B2:B500")

# Alternating row shading for readability
light_fill = PatternFill(start_color="D6E4F0", end_color="D6E4F0", fill_type="solid")
for row in range(2, 501):
    if row % 2 == 0:
        for col in range(1, 5):
            ws_log.cell(row=row, column=col).fill = light_fill

# ── Sheet 2: Summary ───────────────────────────────────────────────
ws_sum = wb.create_sheet("Summary")

# Title
title_cell = ws_sum.cell(row=1, column=1, value="Claude Code — Time Savings Summary")
title_cell.font = Font(name="Calibri", bold=True, size=14, color="2F5496")
ws_sum.merge_cells("A1:C1")

# Column headers
sum_headers = ["Category", "Total Hours Saved", "Est. Dollar Value"]
for col_idx, header in enumerate(sum_headers, 1):
    cell = ws_sum.cell(row=3, column=col_idx, value=header)
    cell.font = header_font
    cell.fill = header_fill
    cell.alignment = Alignment(horizontal="center", vertical="center")
    cell.border = thin_border

ws_sum.column_dimensions["A"].width = 30
ws_sum.column_dimensions["B"].width = 20
ws_sum.column_dimensions["C"].width = 20

# Category rows with SUMIFS formulas
for i, cat in enumerate(categories):
    row = 4 + i
    ws_sum.cell(row=row, column=1, value=cat).border = thin_border
    hours_cell = ws_sum.cell(row=row, column=2)
    hours_cell.value = f'=SUMIFS(\'Task Log\'!D:D,\'Task Log\'!B:B,A{row})'
    hours_cell.number_format = "0.0"
    hours_cell.border = thin_border
    hours_cell.alignment = Alignment(horizontal="center")
    dollar_cell = ws_sum.cell(row=row, column=3)
    dollar_cell.value = f"=B{row}*B{4 + len(categories) + 3}"
    dollar_cell.number_format = '"$"#,##0'
    dollar_cell.border = thin_border
    dollar_cell.alignment = Alignment(horizontal="center")

# Grand total row
total_row = 4 + len(categories)
for col in range(1, 4):
    ws_sum.cell(row=total_row, column=col).border = thin_border
ws_sum.cell(row=total_row, column=1, value="GRAND TOTAL").font = Font(bold=True, size=11)
gt_hours = ws_sum.cell(row=total_row, column=2)
gt_hours.value = f"=SUM(B4:B{total_row - 1})"
gt_hours.number_format = "0.0"
gt_hours.font = Font(bold=True, size=11)
gt_hours.alignment = Alignment(horizontal="center")
gt_dollars = ws_sum.cell(row=total_row, column=3)
gt_dollars.value = f"=SUM(C4:C{total_row - 1})"
gt_dollars.number_format = '"$"#,##0'
gt_dollars.font = Font(bold=True, size=11)
gt_dollars.alignment = Alignment(horizontal="center")

# Hourly rate input
rate_row = total_row + 2
ws_sum.cell(row=rate_row, column=1, value="Assumed Hourly Rate:").font = Font(italic=True)
rate_cell = ws_sum.cell(row=rate_row, column=2, value=64.72)
rate_cell.number_format = '"$"#,##0'
rate_cell.alignment = Alignment(horizontal="center")
ws_sum.cell(row=rate_row + 1, column=1, value="(Change this value to adjust dollar estimates)").font = Font(
    italic=True, color="808080", size=9
)

# Bar chart
chart = BarChart()
chart.type = "col"
chart.title = "Hours Saved by Category"
chart.y_axis.title = "Hours"
chart.x_axis.title = None
chart.style = 10
chart.width = 22
chart.height = 14

data = Reference(ws_sum, min_col=2, min_row=3, max_row=total_row - 1)
cats_ref = Reference(ws_sum, min_col=1, min_row=4, max_row=total_row - 1)
chart.add_data(data, titles_from_data=True)
chart.set_categories(cats_ref)
chart.shape = 4
ws_sum.add_chart(chart, f"A{rate_row + 3}")

# Save
wb.save(output_path)
print(f"Saved: {output_path}")
```

## After Running

Report to the user:
- File saved to `~/Downloads/Claude_Code_Time_Savings_<date>.xlsx`
- **Task Log** sheet: enter tasks with date, category (dropdown), description, and estimated hours saved
- **Summary** sheet: auto-calculates totals per category, dollar value (default $75/hr — editable), and includes a bar chart
- Suggested hours per category:
  - Calendar Rebuild: ~3 hrs
  - Research Report: ~8 hrs
  - File Restructure: ~3 hrs
  - Daily Workflow: ~0.17 hrs (10 min)

## Rules

- Always use today's date in the filename
- If the file already exists for today, overwrite it (user is regenerating)
- Do NOT ask for input — just generate and open
