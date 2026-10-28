---
name: newsletter
description: Generate a monthly AI newsletter for a school district
argument-hint: "[optional: Month Year]"
allowed-tools: Read, Write, Edit, Bash, WebSearch, WebFetch, Glob, Grep
---

Generate a complete District AI Newsletter issue.

## Determine the Target Month

- If `$ARGUMENTS` is provided (e.g., "April 2026"), use that as the target month.
- If no argument, default to **next month** from today's date.
- Set `MONTH_YEAR` to the full month name and year (e.g., "March 2026").

## Step 1: Read Reference Files

1. Read the House Style Guide:
   `$ONEDRIVE_WORK/AI/Newsletters/District AI Newsletter House Style Guide.txt`

2. Read the Article Archive to know what has already been shared:
   `$ONEDRIVE_WORK/AI/Newsletters/Reference/AI Newsletter Archive.xlsx`

3. Read the must-include links file:
   `$ONEDRIVE_WORK/AI/Newsletters/must-include-links.txt`
   - Each non-blank, non-comment line is a URL that MUST appear in this issue.
   - Visit each link to determine its type (article, video, tool, podcast) and place it in the appropriate section.

## Step 2: Find Fresh Content (3-Agent Team)

Use agent teams to discover content in parallel:

### Team Setup

1. **Create the team**: `TeamCreate` with `team_name: "newsletter-<month>"` (e.g., `newsletter-march-2026`).
2. **Create 3 tasks** via `TaskCreate`:
   - **Article search**: Find 8+ current articles about AI in K-12 education from the past 30 days
   - **Media search**: Find 1-2 AI education podcasts, 1-2 new AI tools for educators, and any video resources
   - **Must-include research**: Visit each must-include link, determine its type (article, video, tool, podcast), and write a summary for placement
3. **Spawn 3 teammates** via `Agent` tool with `team_name`, names: `article-finder`, `media-finder`, `link-researcher`. Launch all in a single message. Use `subagent_type: "general-purpose"`.
4. **Pass the archive data** to each agent so they can cross-check. Every URL and title must be checked against the archive. If already shared, find a replacement.
5. **Monitor via `TaskList`**. When all 3 complete, collect results, verify all links work, and proceed to Step 3.
6. **Shut down teammates** and `TeamDelete` after newsletter generation is complete (Step 7).

## Step 3: Generate the Newsletter

Follow the House Style Guide sections and formatting. The newsletter must include:

- **Month header** (e.g., "March 2026")
- **District AI News** (check if AI Study Group dates need updating)
- **Sharing** (leave placeholders for educator testimonials)
- **Training** (include Table of Teaching Tools SharePoint link + 2-3 resources)
- **Reading** (8+ real, verified articles NOT in the archive)
- **Listening** (1-2 podcast recommendations)
- **New AI to Try** (1-2 tool spotlights)
- **Monthly Challenge** (fresh engagement question with Microsoft Forms link)

Not every optional section is required. Include what you have content for; skip what you don't.

### Tone Rules

- Write in the author's voice: formal but conversational, concise
- Do NOT use dashes in the writing (use commas or rewrite)
- Do not invent local district facts
- Flag uncertain facts for verification
- Target length: skimmable in 3-5 minutes

## Step 4: Save Output Files

Create the month's output folder and save two files:

```
$ONEDRIVE_WORK/AI/Newsletters/<MONTH_YEAR>/
```

1. **Smore Paste Version** (`<MONTH_YEAR> Smore Paste Version.txt`) - Plain text formatted for pasting into Smore
2. **HTML Version** (`<MONTH_YEAR> HTML Version.html`) - Formatted HTML version

## Step 5: Update the Archive

The archive workbook has three sheets. Update all three:
`$ONEDRIVE_WORK/AI/Newsletters/Reference/AI Newsletter Archive.xlsx`

1. **Article Archive** sheet: Add all newly included articles (Title, URL, Newsletter Month).
2. **Newsletter Summary** sheet: Add a new row with:
   - Month (e.g., "March 2026")
   - Smore URL: leave blank (user will provide after publishing)
   - Key Topics: comma-separated summary of the issue's main themes
   - Article Count: total content items in the issue
3. **Quick Stats** sheet: Update Total Articles Archived, Total Newsletters, and Date Range.

## Step 6: Clear Must-Include Links

After successful generation, clear the contents of:
`$ONEDRIVE_WORK/AI/Newsletters/must-include-links.txt`

Replace with just the header comment so the file is ready for next month:
```
# Must-Include Links for Next Newsletter
# Add one URL per line. Use # comments for context.
# This file is cleared after each newsletter generation.
```

## Step 7: Print Pre-Publish Checklist

Display a summary:

```
Sources I Used
--------------
[List each source URL used in the newsletter]

the author's 2 Minute Pre-Publish Check
-----------------------------------
[ ] All article links verified and working
[ ] No articles duplicated from previous issues
[ ] AI Study Group dates are current
[ ] Sharing section has placeholders or real quotes
[ ] Challenge question is fresh
[ ] Tone is right: conversational, no dashes, concise
[ ] Both files saved to <MONTH_YEAR> folder
[ ] Article Archive updated
[ ] Newsletter Summary row added (Smore URL blank until published)
[ ] Quick Stats updated
[ ] Must-include links file cleared
```

After publishing on Smore, send the URL and it will be added to the Newsletter Summary sheet.
