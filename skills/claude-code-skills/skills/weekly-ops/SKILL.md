---
name: weekly-ops
description: This skill should be used when the user asks to "run weekly ops", "weekly briefing", "run my recurring tasks", or "/weekly-ops". Autonomously runs recurring workflows based on the current date, passes context between tasks, and produces a Weekly Briefing summary document.
argument-hint: "[--only task1,task2] [--dry-run]"
allowed-tools: Read, Write, Edit, Bash, Glob, Grep, WebSearch, WebFetch, Task, TodoWrite
---

Run the weekly operations orchestrator. Determine which recurring tasks are due, execute each one, share context between them, and produce a Weekly Briefing.docx summarizing outcomes.

Arguments: $ARGUMENTS

## Phase 0: Parse Arguments and Determine Due Tasks

### Argument Parsing

- `--only task1,task2`: Run only the specified tasks. Valid task names: `check-in`, `site-review`, `claude-md`, `newsletter`, `software-check`, `research-reorg`.
- `--dry-run`: Show which tasks would run without executing them.
- No arguments: Run all tasks due based on today's date.

### Task Schedule

Determine today's date and day of week, then build the task list:

#### Weekly Tasks (every Friday, or when run manually)
1. `check-in`: Process any unprocessed Friday check-in notes and update the Action Item Tracker.
2. `action-review`: Review the Action Item Tracker for overdue items and flag them.

#### Monthly Tasks (run once per month, typically first run of the month)
3. `site-review`: Run the $AUTHOR_WEBSITE site review for last month.
4. `newsletter`: Generate the District AI Newsletter (due on the 27th, but can run anytime in the month).
5. `claude-md`: Run the CLAUDE.md optimization/audit.
6. `software-check`: Check for outdated Python packages, Homebrew packages, and npm globals.
7. `research-reorg`: Scan ~/Documents/Research/ for loose files and ensure proper subfolder organization.

### Due Logic

```
today = current date
day_of_week = today's weekday (0=Monday, 6=Sunday)

weekly_tasks_due = (day_of_week == 4)  # Friday
  OR --only flag includes a weekly task

monthly_tasks_due = (today.day <= 7)  # First week of month
  OR --only flag includes a monthly task

For newsletter specifically: due if today.day >= 25 OR --only includes it
```

If `--only` is provided, ignore the schedule and run exactly those tasks.

If `--dry-run`, print the task list with due/not-due status and stop.

### Initialize Shared Context

Create the shared context file at a temporary location:

```python
import json, os
from datetime import datetime

context = {
    "run_date": datetime.now().isoformat(),
    "tasks_planned": [],      # filled after determining due tasks
    "tasks_completed": [],
    "tasks_failed": [],
    "check_in": {
        "files_processed": 0,
        "action_items_extracted": 0,
        "overdue_items": []
    },
    "site_review": {
        "report_path": "",
        "top_findings": [],
        "blog_topics": [],
        "action_items": []
    },
    "newsletter": {
        "generated": False,
        "month": "",
        "article_count": 0
    },
    "claude_md": {
        "files_audited": 0,
        "changes_made": []
    },
    "software_check": {
        "outdated_packages": [],
        "updates_available": 0
    },
    "research_reorg": {
        "files_moved": 0,
        "folders_created": []
    },
    "errors": []
}

context_path = os.path.expanduser("~/.claude/weekly-ops-context.json")
with open(context_path, "w") as f:
    json.dump(context, f, indent=2)
```

## Phase 1: Execute Due Tasks

Run each due task as a separate Task agent. After each task completes, update the shared context file. Process tasks in this order:

### Task 1: check-in (Weekly)

Launch a Task agent with `subagent_type: "general-purpose"`:

Prompt the agent to:
1. Check `$ONEDRIVE_WORK/Meeting Notes/Friday Check-In/Raw/` for unprocessed .docx files (files without a corresponding cleaned version).
2. If unprocessed files exist, process them using the check-in pipeline:
   - Read each raw file, clean up the notes, write cleaned DOCX to Cleaned/ directory
   - Extract action items and update the Action Item Tracker
   - Export PDFs
3. Report back: number of files processed, action items extracted, and any errors.

After completion, update shared context:
```python
context["check_in"]["files_processed"] = <count>
context["check_in"]["action_items_extracted"] = <count>
context["tasks_completed"].append("check-in")
```

### Task 2: action-review (Weekly)

Launch a Task agent with `subagent_type: "general-purpose"`:

Prompt the agent to:
1. Read `$ONEDRIVE_WORK/Meeting Notes/Friday Check-In/Action Item Tracker.xlsx`
2. Find all items with Status = "Open" or "In Progress"
3. Flag items older than 14 days as overdue
4. Return: list of overdue items with person, department, description, and age in days

After completion, update shared context:
```python
context["check_in"]["overdue_items"] = [
    {"person": "...", "department": "...", "item": "...", "days_old": N}
]
context["tasks_completed"].append("action-review")
```

### Task 3: site-review (Monthly)

Launch a Task agent with `subagent_type: "general-purpose"`:

Prompt the agent to run the site-review workflow for last month. The agent should:
1. Determine last month's name and year
2. Execute the full site-review process (GA4 data pull, content audit, trend research, report compilation)
3. Save the report to `~/Documents/Website Reviews/`
4. Return: report file path, top 3 findings, blog topic suggestions, and action items

After completion, update shared context:
```python
context["site_review"]["report_path"] = "<path>"
context["site_review"]["top_findings"] = ["...", "...", "..."]
context["site_review"]["blog_topics"] = ["...", "..."]
context["site_review"]["action_items"] = ["...", "..."]
context["tasks_completed"].append("site-review")
```

### Task 4: newsletter (Monthly, due ~27th)

Launch a Task agent with `subagent_type: "general-purpose"`:

Prompt the agent to run the newsletter generation workflow:
1. Read shared context for any site-review blog topics to consider as newsletter content
2. Execute the full newsletter generation process for next month
3. Return: whether generation succeeded, target month, article count

After completion, update shared context:
```python
context["newsletter"]["generated"] = True
context["newsletter"]["month"] = "<month>"
context["newsletter"]["article_count"] = N
context["tasks_completed"].append("newsletter")
```

### Task 5: claude-md (Monthly)

Launch a Task agent with `subagent_type: "general-purpose"`:

Prompt the agent to:
1. Find all CLAUDE.md files in `~/Desktop/` (the main repo) and `~/.claude/`
2. For each file: check for stale content, redundancy, formatting issues
3. Suggest improvements but do NOT apply changes without listing them first
4. Return: files audited, list of suggested changes

After completion, update shared context:
```python
context["claude_md"]["files_audited"] = N
context["claude_md"]["changes_made"] = ["...", "..."]
context["tasks_completed"].append("claude-md")
```

### Task 6: software-check (Monthly)

Run directly (no agent needed, simple commands):

```bash
# Homebrew
brew outdated 2>/dev/null

# Python packages
pip3 list --outdated 2>/dev/null

# npm globals
npm outdated -g 2>/dev/null
```

Capture the output and update shared context:
```python
context["software_check"]["outdated_packages"] = [list of package names]
context["software_check"]["updates_available"] = N
context["tasks_completed"].append("software-check")
```

### Task 7: research-reorg (Monthly)

Run directly (no agent needed):

1. Scan `~/Documents/Research/` for any .docx, .pdf, or .md files sitting in the root instead of in a subfolder
2. If found, suggest moving them into appropriate topic subfolders based on filename
3. List any empty subfolders that could be cleaned up
4. Do NOT move or delete files, just report findings

Update shared context:
```python
context["research_reorg"]["files_moved"] = 0  # report only, no moves
context["research_reorg"]["loose_files"] = ["...", "..."]
context["tasks_completed"].append("research-reorg")
```

## Phase 2: Error Handling

For any task that fails:
1. Capture the error message
2. Add to `context["tasks_failed"]` with the task name and error
3. Add to `context["errors"]` with details
4. Continue with remaining tasks (do not abort the run)

## Phase 3: Generate Weekly Briefing

After all tasks complete (or fail), generate the Weekly Briefing document.

Read the final shared context, then use Python to build the briefing:

```python
# Use the briefing generator script
# Script location: ~/.claude/skills/weekly-ops/scripts/briefing-generator.py
```

Run the briefing generator script, passing the context file path as an argument:

```bash
python3 ~/.claude/skills/weekly-ops/scripts/briefing-generator.py ~/.claude/weekly-ops-context.json
```

The script produces: `~/Documents/Weekly Briefings/Weekly Briefing - YYYY-MM-DD.docx`

Create the `~/Documents/Weekly Briefings/` directory if it doesn't exist.

## Phase 4: Commit and Cleanup

1. If any files in the git repo changed (CLAUDE.md edits, skill updates), stage and commit:
   ```
   git add -A && git commit -m "Weekly ops: <date> - <summary of changes>"
   ```
   Only commit repo files, not OneDrive/Documents files.

2. Clean up the temporary context file:
   ```bash
   rm ~/.claude/weekly-ops-context.json
   ```

3. Open the briefing document:
   ```bash
   open ~/Documents/Weekly\ Briefings/Weekly\ Briefing\ -\ YYYY-MM-DD.docx
   ```

## Phase 5: Summary Output

Print a concise run summary:

```
Weekly Ops Complete - <date>
===========================

Tasks Run:     <N>
Completed:     <N>
Failed:        <N>

Results:
- Check-in: <N> files processed, <N> action items
- Action Review: <N> overdue items flagged
- Site Review: Report saved to <path>
- Newsletter: <month> issue generated (<N> articles)
- CLAUDE.md: <N> files audited, <N> changes suggested
- Software: <N> updates available
- Research: <N> loose files found

Briefing: ~/Documents/Weekly Briefings/Weekly Briefing - <date>.docx

Errors:
<list any errors, or "None">
```
