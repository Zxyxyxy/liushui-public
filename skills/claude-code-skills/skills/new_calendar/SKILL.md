---
name: new_calendar
description: Shift a school calendar Excel file to the next school year, preserving all formatting. Rebuilds month grids with correct day-of-week alignment.
argument-hint: "[target_years, e.g. 2029-2030]"
---

Shift the most recent school calendar to a new school year using the `new_calendar.py` script.

Target years: $ARGUMENTS

## How It Works

The script works directly with the .xlsx XML (ZIP structure) to preserve ALL formatting:
- **Never touches xl/styles.xml** — fonts, fills, borders, merged cells, print settings are byte-for-byte identical
- Rebuilds month grids with correct day-of-week alignment for the new year
- Updates shared strings (title, month headers, event text)
- Shifts Excel serial date values by the correct delta
- Handles the Grade Periods sheet (auto-detects date context even if title year differs)
- Clears holiday/event colors from grid cells (user re-applies for new year)

## Steps

1. **Determine the source file.** If the user provides a file path, use it. Otherwise, find the most recent calendar:
   ```
   ls -t $ONEDRIVE_WORK/Calendar/*/Board\ Proposal/*.xlsx | head -1
   ```
   If no Board Proposal exists, look in the year folder directly:
   ```
   ls -t $ONEDRIVE_WORK/Calendar/*/*.xlsx | head -1
   ```

2. **Determine target years.** If $ARGUMENTS contains a year pair (e.g., "2029-2030"), use it. Otherwise, detect the source year and add 1 (e.g., 2027-2028 source → 2028-2029 target).

3. **Run the script:**
   ```
   python3 ~/Scripts/new_calendar.py "<source_file>" "<target_years>"
   ```

4. **Report results** to the user:
   - Output file path
   - Any layout warnings (months needing manual row adjustment)
   - Remind them of the next steps (apply holiday colors, update events, etc.)

5. **Open in Excel:**
   ```
   open -a "Microsoft Excel" "<output_file>"
   ```

## Layout Warnings

Some year transitions cause months to need more grid rows than allocated (e.g., a month starting on Saturday with 31 days needs 6 rows). The script warns about these and the user adjusts in Excel. This is expected and unavoidable without restructuring the entire sheet layout.

## Output Location

New calendars are saved to:
`$ONEDRIVE_WORK/Calendar/<YYYY-YYYY>/`

The filename mirrors the source with updated years.

## Rules

- Always use the XML-based script (not openpyxl) — the calendar file has font family values that break openpyxl
- Never modify the source file
- If the target year folder already has a file with the same name, warn the user before overwriting
