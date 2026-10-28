---
name: notebooklm-pipeline
description: "Automated NotebookLM pipeline: create notebook, add sources, then generate video podcast + report + infographic + slides in parallel. Takes a topic, folder of docs, or URLs."
---

# NotebookLM Pipeline

Automates the full NotebookLM workflow: create a notebook, add/research sources, wait for indexing, then spawn parallel agents to generate all artifact types simultaneously.

## When This Skill Activates

User says `/notebooklm-pipeline` or asks to "run the full NotebookLM pipeline" / "create everything from NotebookLM" / "generate all NotebookLM artifacts for..."

## Invocation

```
/notebooklm-pipeline <topic-or-sources> [options]
```

Examples:
- `/notebooklm-pipeline "Impact of AI on K-12 assessment"` -- research mode
- `/notebooklm-pipeline ~/Documents/Research/salary-study/` -- folder of docs
- `/notebooklm-pipeline https://url1.com https://url2.com "Focus on policy"` -- URLs with instructions

## Execution Plan

### Phase 1: Setup (main agent)

1. Parse arguments to detect mode:
   - Quoted topic string with no file/URL path: **research mode**
   - File paths or URLs: **source mode**
   - Folder path: **folder mode** (glob for `.pdf`, `.docx`, `.pptx`, `.txt`, `.md` -- skip `.xlsx`, `.odt`, `.png`, `.DS_Store`)
   - Mixed (URLs + topic): add URLs + research the topic

2. Verify auth:
   ```bash
   notebooklm status
   ```
   If this fails, tell user to run `notebooklm login` and stop.

3. Create notebook:
   ```bash
   notebooklm create "<title>" --json
   ```
   Parse the notebook ID from JSON output. Use topic or folder name as title.

4. Create output directory:
   ```bash
   mkdir -p ~/Documents/NotebookLM/<notebook-title>/
   ```

5. Add sources depending on mode:
   - **Research mode**: `notebooklm source add-research "<topic>" --mode deep --no-wait --notebook <notebook_id>`
   - **Source mode**: `notebooklm source add <path-or-url> --json --notebook <notebook_id>` for each source
   - **Folder mode**: Glob for supported files, add each with `notebooklm source add <file> --json --notebook <notebook_id>`

### Phase 2: Source Processing

Wait for all sources to finish processing using background bash with `run_in_background: true`.

**For research mode:**
```bash
notebooklm research wait -n <notebook_id> --import-all --timeout 1800
```

**For source/folder mode:**
```bash
for each source_id:
  notebooklm source wait <source_id> -n <notebook_id> --timeout 600
```

**IMPORTANT:** The main agent MUST wait for source processing to complete (via TaskOutput) before Phase 3. Sources must be indexed before generation can succeed.

### Phase 3: Parallel Generation (4 artifacts)

Once sources are ready, kick off all 4 generate commands in parallel (one Bash call each), then wait for each via background tasks.

**Output directory:** `~/Documents/NotebookLM/<notebook-title>/`

#### Artifact 1: Video Podcast
```bash
notebooklm generate video "Comprehensive overview of the topic, suitable for educators" --json --notebook <notebook_id>
# Parse task_id, then:
notebooklm artifact wait <task_id> -n <notebook_id> --timeout 2700
notebooklm download video "<output_dir>/podcast.mp4" -a <task_id> -n <notebook_id>
```

#### Artifact 2: Report (Briefing Doc)
```bash
notebooklm generate report --format briefing-doc --json --notebook <notebook_id>
# Parse task_id, then:
notebooklm artifact wait <task_id> -n <notebook_id> --timeout 900
notebooklm download report "<output_dir>/report.md" -a <task_id> -n <notebook_id>
```

#### Artifact 3: Infographic
```bash
notebooklm generate infographic --json --notebook <notebook_id>
# Parse task_id, then:
notebooklm artifact wait <task_id> -n <notebook_id> --timeout 900
notebooklm download infographic "<output_dir>/infographic.png" -a <task_id> -n <notebook_id>
```

#### Artifact 4: Slide Deck
```bash
notebooklm generate slide-deck --json --notebook <notebook_id>
# Parse task_id, then:
notebooklm artifact wait <task_id> -n <notebook_id> --timeout 2700
notebooklm download slide-deck --format pptx "<output_dir>/slides.pptx" -a <task_id> -n <notebook_id>
```

Each artifact: generate in parallel Bash calls, then wait+download via `run_in_background: true` tasks, collecting results with TaskOutput.

If generation fails with rate limiting, wait 5 minutes and retry once.

### Phase 4: Summary (main agent)

After all 4 generation tasks complete (use TaskOutput to collect results):

1. Collect results from all tasks
2. Report a summary table:

```
## Pipeline Results

| Artifact    | Status | File |
|-------------|--------|------|
| Video       | ...    | ...  |
| Report      | ...    | ...  |
| Infographic | ...    | ...  |
| Slides      | ...    | ...  |

Output: ~/Documents/NotebookLM/<title>/
Notebook ID: <id>
```

3. If any artifacts failed, note the failure reason and suggest retrying via `/notebooklm`

## Error Handling

- Auth failure at start: stop and tell user to run `notebooklm login`
- Source processing timeout: report which sources failed, ask whether to proceed with available sources
- Generation rate limit: each agent retries once after 5-minute wait, then reports failure
- Download failure: agent checks artifact status first, reports if still in progress
- All tasks use explicit `-n <notebook_id>` flags to avoid context file conflicts between parallel agents

## Key Constraints

- Always use `--notebook <notebook_id>` or `-n <notebook_id>` on every command (parallel agent safety)
- Never use `notebooklm use` in this pipeline (shared context file conflicts)
- Output directory: `~/Documents/NotebookLM/<notebook-title>/`
- Depends on the `notebooklm` CLI being installed (`pip install notebooklm-py`)

## Unsupported File Formats

- XLSX files are rejected by NotebookLM upload (400 Bad Request). Upload the PDF version of the same data instead.
- ODT files are also rejected. Convert to DOCX or PDF before uploading.
- When globbing a folder, filter out `.xlsx`, `.odt`, `.DS_Store`, and `.png` files.

## Subagent Bash Permissions

- Background agents spawned with `run_in_background: true` may not have Bash permissions and will silently fail on CLI commands.
- Preferred pattern: run `generate --json` in the main thread, then `artifact wait` + `download` via `run_in_background: true` background bash tasks.
- Collect results with TaskOutput.
