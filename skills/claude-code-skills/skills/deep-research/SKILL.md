# Deep Research: $ARGUMENTS

Conduct a comprehensive, source-verified research analysis on the topic above. Uses 4 parallel agents researching from distinct source categories, cross-references findings, verifies URLs, and produces a .docx report with a source reliability matrix.

## Phase 0: Setup

Generate a short, descriptive folder name (lowercase, hyphens). Create working directories and initialize the run log.

```
mkdir -p "~/Documents/Research/<topic-folder>/drafts"
```

**Initialize the run log** at `~/Documents/Research/<topic-folder>/deep_research_run_log.md`:

```markdown
# Deep Research Run Log
- Topic: <topic>
- Started: <ISO timestamp>
- Completed: (pending)

## Agent Activity
| Agent | Category | Attempt | Status | Findings | Sources | Confidence Range | Notes |
|-------|----------|---------|--------|----------|---------|------------------|-------|

## Retries
(none)

## Synthesis
- Contradictions found: (pending)
- URLs verified: (pending)
- Single-source claims: (pending)

## Summary
(pending)
```

## Phase 1: Launch 4 Source-Category Agents

### Team Setup

1. **Create the team**: `TeamCreate` with `team_name: "deep-research-<topic-slug>"`.
2. **Create 4 tasks** via `TaskCreate`, one per source category.
3. **Spawn 4 teammates** via the `Agent` tool, ALL IN A SINGLE MESSAGE for parallel execution. Use `subagent_type: "general-purpose"` and assign each a `name` matching its category.
4. **Log each launch** to the run log.

### Structured Output Format

Every agent MUST return findings in this exact format:

```markdown
## Findings

### Finding 1: <title>
- **Claim**: <specific factual claim>
- **Evidence**: <supporting detail, data, quotes>
- **Confidence**: <high|medium|low> — <reason for rating>
- **Source**: <Author/Org (Year). Title. URL>

### Finding 2: <title>
...

## Source List
1. <Author/Org (Year). Title. URL> — Confidence: <high|medium|low>
2. ...

## Gaps & Limitations
- <areas that could not be adequately covered and why>
```

**Confidence scoring guidance** (include in every agent brief):
- **High**: Primary source, peer-reviewed, official government data, or well-established facts with multiple corroborating sources
- **Medium**: Reputable secondary source (major news outlet, industry report, well-known org), single expert opinion, or data that is plausible but not independently verified
- **Low**: Blog post, opinion piece, single anecdotal report, outdated data (>5 years for fast-moving fields), or source with potential bias

### Agent Assignments

**Agent 1 — Government & Official Sources** (`gov-sources`):
Search exclusively for government publications, official reports, regulatory documents, legislative records, and public agency data. Sources should come from .gov domains, international governmental organizations, official statistics bureaus, and public regulatory filings. For education topics, prioritize state DOE, USED, state legislature records, and NCES data. Rate each finding's confidence based on data recency and source authority.

**Agent 2 — News & Journalism** (`news-sources`):
Search for reporting from major news outlets, investigative journalism, and reputable media coverage. Prioritize original reporting over aggregation. Include both national outlets and relevant regional/trade press. Look for interviews with key figures, timeline of events, and public discourse around the topic. Distinguish between news reporting (higher confidence) and opinion/editorial (lower confidence). Flag any paywalled sources.

**Agent 3 — Academic & Peer-Reviewed Research** (`academic-sources`):
Search for peer-reviewed journal articles, meta-analyses, systematic reviews, working papers, and university research center publications. Report effect sizes, sample sizes, and methodology quality where available. Prioritize recent studies (last 10 years) but include seminal older work. Use Google Scholar, ERIC, PubMed, JSTOR, and similar. Distinguish between experimental/causal evidence (higher confidence) and correlational/observational studies (medium confidence).

**Agent 4 — Industry, Practitioner & Nonprofit Sources** (`industry-sources`):
Search for industry reports, white papers, case studies, practitioner guides, nonprofit/NGO publications, conference proceedings, and professional organization resources. Include think tanks, foundations, consulting firms, and trade associations. Look for implementation guides, best practices, ROI analyses, and real-world examples. Rate confidence lower for sources with clear commercial interest or advocacy bias.

**Add to every agent's brief**: "Return your findings in the structured format provided. If you encounter rate limits or errors, include what you were able to find and clearly state what areas you could not cover. Each finding must have a confidence rating. Your work is independent of other agents — complete as much as possible regardless of any issues."

## Phase 2: Monitor with Fault Tolerance

Monitor `TaskList` for agent completion. Process agents as they finish — do NOT wait for all 4 to complete before starting work on available results.

### Validation Criteria

An agent's output **passes** if:
- At least 5 distinct findings with confidence scores
- At least 5 unique sources with URLs
- Findings follow the structured format

An agent **fails** if:
- Fewer than 3 findings or 3 sources
- Output is mostly error messages or boilerplate
- No confidence scores provided

### On Failure: Retry with Backoff

When an agent fails:

1. **Log the failure** in the run log (agent name, reason, attempt number).
2. **Wait with exponential backoff**:
   - Retry 1: `sleep 30`
   - Retry 2: `sleep 60`
   - Retry 3: `sleep 120`
3. **Spawn a replacement agent** with the same name, brief, and `team_name`.
4. **Log the retry** in the run log.

### After 3 Failed Retries: Proceed Without

If an agent fails all 3 retries:
1. **Mark as permanently failed** in the run log.
2. **Proceed with available results** — the other 3 agents' findings are still valid.
3. **Note the missing source category** in the final report's Source Reliability Matrix.

### Completion Gate

Proceed to Phase 3 when at least 3 of 4 agents have returned valid results. If only 2 agents succeed, still proceed but prominently note the coverage gaps.

## Phase 3: Synthesis & Cross-Referencing

Spawn a single synthesis agent OR perform this analysis directly. This is the core value-add of deep-research.

### 3a. Cross-Reference Findings

Build a **claim matrix** — for each major claim or finding across all agents:

| Claim | Gov | News | Academic | Industry | Agreement | Notes |
|-------|-----|------|----------|----------|-----------|-------|
| <claim> | ✓/✗/— | ✓/✗/— | ✓/✗/— | ✓/✗/— | <full/partial/single/conflicting> | <detail> |

- **✓** = source category supports this claim
- **✗** = source category contradicts this claim
- **—** = source category did not address this claim

Flag these situations explicitly:
- **Contradictions**: Two or more source categories report conflicting findings. Document both sides.
- **Single-source claims**: A claim supported by only one source category. These need extra scrutiny — note them clearly.
- **Universal agreement**: All reporting categories align. Highest confidence.

### 3b. Verify URLs

For every unique URL in the combined source list, use `WebFetch` to verify the URL resolves (HTTP 200). Track results:

| URL | Status | Notes |
|-----|--------|-------|
| <url> | ✓ Live / ✗ Dead / ⚠ Redirect / ⏭ Skipped | <detail> |

Rules:
- If a URL is dead, search for the source title to find an updated link. If found, replace it.
- If a URL redirects, note the final destination.
- If a URL is behind a paywall or login wall, mark as "⚠ Paywalled" but keep it.
- Skip URL verification for .gov URLs that return 403 (common for programmatic access) — mark as "⏭ Gov-blocked, likely valid".
- **Do not let URL verification block report generation.** Set a reasonable timeout and move on.
- Maximum 30 URLs to verify. If more than 30 sources, verify the top 30 by citation frequency and skip the rest.

### 3c. Confidence Aggregation

For each source, compute an aggregate confidence score:

- **Source type weight**: Government/Academic = 1.0, News = 0.8, Industry = 0.7
- **Agent confidence**: High = 1.0, Medium = 0.7, Low = 0.4
- **URL status**: Live = 1.0, Redirect/Paywalled = 0.8, Dead = 0.3, Skipped = 0.7
- **Corroboration bonus**: Cited by 2+ agents = +0.1, cited by 3+ = +0.2

**Aggregate score** = Source type weight × Agent confidence × URL status + Corroboration bonus (cap at 1.0)

Classify: ≥0.8 = High Reliability, 0.5-0.79 = Medium Reliability, <0.5 = Low Reliability

Log all synthesis results to the run log.

## Phase 4: Compile the Report

### Report Structure

#### Title Page
- Title: `Deep Research Report: <Topic>`
- Date: `<YYYY-MM-DD>`
- Source categories covered, total sources, claims analyzed

#### Executive Summary
- 1-2 page overview: key findings, bottom-line assessment, confidence level in overall conclusions.
- Note any source categories that failed or had thin coverage.

#### 1. Background & Context
- What is this topic? Key terms, history, and why it matters now.

#### 2. Key Findings
- Organized by theme (NOT by source category).
- Each finding includes inline citation and confidence indicator:
  - 🟢 High confidence (supported by multiple source categories)
  - 🟡 Medium confidence (supported by 1-2 categories, no contradictions)
  - 🔴 Low confidence (single source, contradicted, or weak evidence)
- Weave government, news, academic, and industry perspectives together.

#### 3. Points of Contradiction
- Claims where source categories disagree.
- Present both/all sides with their supporting evidence.
- Assess which position has stronger evidence and why.

#### 4. Single-Source Claims
- Claims supported by only one source category.
- Why they matter (if they do).
- What additional evidence would be needed to confirm.

#### 5. Practical Implications
- What should a decision-maker take away?
- Recommended actions, ordered by confidence level.
- What questions remain unanswered?

#### 6. Source Reliability Matrix
- Table of ALL sources with:
  - Author/Organization
  - Year
  - Title
  - Source category (Gov/News/Academic/Industry)
  - Agent confidence rating
  - URL status (Live/Dead/Redirect/Paywalled)
  - Aggregate reliability score
  - Cited by (which agents)
- Sorted by aggregate reliability score (highest first).
- Summary stats: X sources total, X high reliability, X medium, X low, X dead URLs replaced.

#### 7. References
- Full citation list, deduplicated, sorted alphabetically.
- Format: Author/Organization (Year). *Title*. URL [Reliability: High/Medium/Low]

### For Education Topics

Add these additional sections:
- **Federal & State Policy Context**: ESSA, IDEA, state DOE guidance, state legislation
- **State Data Appendix**: state-specific statistics, district comparisons, growth data
- Redirect the gov-sources agent to prioritize state DOE and state legislature
- Redirect the industry-sources agent to include education practitioner orgs (ASCD, Learning Forward, NASSP, etc.)

## Phase 5: Fact-Check Pass

1. Save preliminary .docx to drafts folder.
2. Run `/fact-check` on the preliminary report (Tier 1 checks).
3. Fix ERROR-level issues. Address straightforward WARNING-level issues.
4. Log fact-check results to run log.
5. Delete preliminary draft after fixes applied.

## Phase 6: Generate Final .docx

1. **Write a Python script** using `python-docx` to generate the final report. The script must:
   - Use Calibri 11pt as default font
   - Apply Heading 1/2/3 styles for section hierarchy
   - Format the Source Reliability Matrix as a proper Word table with header row shading
   - Use colored text or cell shading for confidence indicators (green/yellow/red)
   - Include the claim cross-reference matrix as a formatted table
   - Format inline citations consistently

2. **Save the .docx** to `~/Documents/Research/<topic-folder>/YYYY-MM-DD <Topic> Deep Research Report.docx`

3. **Save the generation script** to `~/Documents/Research/scripts/`

4. **Save the run log** — keep `deep_research_run_log.md` in the topic folder.

5. **Clean up** drafts directory and temp files.

6. **Open the file**:
   ```
   open "~/Documents/Research/<topic-folder>/YYYY-MM-DD <Topic> Deep Research Report.docx"
   ```

## Finalize Run Log

```markdown
## Summary
- Agents spawned: <count> (4 original + N retries)
- Successful agents: <X>/4
- Total sources: <count>
- Sources by reliability: <X> high, <X> medium, <X> low
- URLs verified: <X>/<total> (<X> live, <X> dead replaced, <X> skipped)
- Contradictions flagged: <count>
- Single-source claims: <count>
- Fact-check: <X> errors fixed, <X> warnings addressed
- Elapsed time: <duration>
```

## Confirm to User

Report the final file path and a brief summary:
- Sources found (with reliability breakdown)
- Contradictions flagged
- Single-source claims noted
- Any source categories that had issues
- Run log location
