---
name: newsletter-link
description: Add a link to the must-include list for the next AI newsletter.
disable-model-invocation: true
allowed-tools: Read, Edit
argument-hint: "[url] [optional notes]"
---

Add a link to the District AI Newsletter must-include links file for the next monthly run.

The link to add: $0
Optional notes/context: $1

## Steps

1. Read the file `$ONEDRIVE_WORK/AI/Newsletters/must-include-links.txt`
2. If notes were provided, append a comment line: `# <notes>`
3. Append the URL on a new line
4. Confirm to the user what was added and show the current list of queued links

## Rules

- Do NOT remove existing links from the file
- Each link must be on its own line
- Keep the file clean and readable
- Preserve the header comments at the top of the file
