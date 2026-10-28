---
name: job-finder
description: Find and rank current job openings for a friend or candidate. Takes a resume (PDF or image), spawns parallel research agents across job boards and ATS endpoints, produces a .docx "Job Match Brief" and .xlsx tracker. Use when the user says "/job-finder", "find jobs for <name>", "job search for my friend", or hands over a resume looking for openings.
---

# Job Finder

Single-shot pipeline: resume in, ranked job openings out. Designed for helping someone (a friend, family member, mentee, or yourself) look for work. Research and rank only, never auto-apply.

## What this is and isn't

This skill is a research helper. It scans public job boards and applicant-tracking system (ATS) endpoints, ranks postings against the candidate's resume, and produces a brief plus a tracker. It is not:

- A resume tailoring service
- A cover-letter writer
- An auto-apply bot
- A vetted-opportunity feed

Treat the output as a starting point. Verify every posting before applying. Listings on aggregators are often stale or republished.

## Trigger

- `/job-finder`, "find jobs for <name>", "job search for my friend", "look for jobs"
- Or any time the user hands over a resume PDF/image with a job-search framing

## Inputs

- **Resume path.** Default to most recent resume-shaped file in `~/Downloads/` (.pdf, .png, .jpg, .jpeg).
- **Optional overrides** (ask only if not obvious from the resume): preferred locations, salary floor, remote-only vs hybrid vs onsite, target titles to add or exclude.

## Configuration

Two placeholders to find-and-replace before you run this:

| Variable | Description | Default |
|---|---|---|
| `$JOB_SEARCH_ROOT` | Where to write deliverables | `~/Documents/Job Search/<Name>/` |
| `$AUTHOR_NAME` | Your name for the brief's "Prepared by" line | (your name) |

## Pipeline

### Phase 1: Parse resume

Read the file. PDF: `pypdf`. Image: use the `Read` tool (Claude vision handles PNG/JPG natively).

Extract a `candidate_profile.json` and write it to the run folder:

```json
{
  "legal_name": "...",
  "preferred_name": "...",
  "contact": {"email": "...", "phone": "...", "city": "...", "state": "..."},
  "current_role": {"title": "...", "company": "...", "since": "YYYY"},
  "target_titles": ["...", "..."],
  "years_experience": 0,
  "top_skills": ["...", "..."],
  "education": [{"degree": "...", "institution": "...", "year": "..."}],
  "salary_signal": null,
  "remote_preference": "remote|hybrid|onsite|unknown",
  "willing_to_relocate": true,
  "sectors": ["nonprofit", "higher-ed", "..."]
}
```

Heuristics:
- `target_titles` should reflect the resume's headline (the line under the name) plus close adjacents. Resist title-inflation. If the resume says "grant writer," don't auto-add "VP of Development."
- `years_experience` from the earliest role's start date to today.
- `willing_to_relocate` defaults to true unless the resume locks them to a region.
- `sectors` from employer types in work history (nonprofit, higher-ed, gov, startup, etc).

Sanity check: show the user the parsed name + top 3 target titles + location in one short message before fan-out. They confirm or correct. This prevents 4 agents wasting time on the wrong target.

Pseudocode:
```python
import pypdf, json
def parse_pdf(path):
    r = pypdf.PdfReader(path)
    return "\n".join(p.extract_text() or "" for p in r.pages)
# images: just Read the file via the harness; vision handles it
```

### Phase 2: Parallel agent fan-out

Spawn all four agents in a single message (multiple `Agent` tool calls in one block) using `subagent_type: "general-purpose"`. Each receives the candidate profile and its dedicated prompt file from `prompts/`.

| Agent | Prompt file | Mandate |
|---|---|---|
| `job-board-searcher` | `prompts/job_board_searcher.md` | Indeed, Glassdoor, Wellfound, ZipRecruiter, public LinkedIn search results. Current postings matching target titles + location radius. |
| `company-targeter` | `prompts/company_targeter.md` | Identify 15-25 mission-aligned employers and check their careers pages directly via Greenhouse/Lever/Ashby/Workable ATS endpoints. |
| `remote-specialist` | `prompts/remote_specialist.md` | RemoteOK, We Work Remotely, Working Nomads, Himalayas. Remote-only listings. |
| `salary-intel` | `prompts/salary_intel.md` | Market salary ranges for the target titles in the candidate's location, for context in the brief. |

Each returns JSON. Schema for the three search agents:

```json
[
  {
    "title": "...",
    "company": "...",
    "location": "...",
    "remote_status": "remote|hybrid|onsite",
    "salary_range": "$X - $Y" | null,
    "posted_date": "YYYY-MM-DD" | null,
    "url": "https://...",
    "source": "indeed|glassdoor|greenhouse|...",
    "raw_excerpt": "first ~200 chars of the posting",
    "fit_signals": ["matches grant-writing experience", "mission-aligned"]
  }
]
```

Salary-intel returns `{title, location, p25, p50, p75, source_notes}[]`.

### Phase 2.5: Link validation

Aggregator listings go stale fast. Indeed and ZipRecruiter routinely show jobs that have already been filled, expired, or were republished from years ago. To prevent dead links in the brief, run a fact-check pass after fan-out completes.

Merge results from the three search agents. Dedupe by `(company.lower(), normalize(title))`, keep the entry with the most complete fields. Score a quick preliminary fit (0-100) using `skills_match * 0.5 + experience_match * 0.5` only, fast heuristic. Take the top 50.

Spawn the `link-validator` agent (`prompts/link_validator.md`, `subagent_type: "general-purpose"`) on those 50. The validator:

- WebFetches each URL.
- Classifies the response:
  - `live`: posting page loads, title and company match the listing
  - `expired`: page shows "this job is no longer accepting applications," "position filled," etc.
  - `redirected`: URL redirects to the company's general careers page or job-board home
  - `not_found`: HTTP 404, 410, or page-not-found content
  - `suspicious`: page asks for fees, has no employer info, or is missing the original posting
- Pulls the `posted_date` from the live page when visible (more reliable than aggregator metadata).
- Returns the same listing schema plus a `validation_status` field and an optional `validation_note` explaining anything weird.

Drop everything except `live`. If `live` count drops below 25, expand the validation pool to top 75 and revalidate. Log the kill rate (e.g., "validated 50, dropped 18 expired/dead, kept 32 live") so the user sees the brief is honest.

Validator runs sequentially per URL with a small concurrency cap to avoid rate-limiting boards.

### Phase 3: Score and rank

Score the validated survivors on 6 dimensions per `scoring_rubric.md`. Compute weighted 0-100 and assign A (>=85), B (70-84), C (55-69), D (<55). Drop anything below D-floor (<=40) unless the pool is thin.

### Phase 4: Synthesize

Top 10 by score get a 2-3 sentence writeup: why it fits, what to highlight in the cover letter, any concerns (e.g., low salary, far commute, sector mismatch). Next 15-25 go into a "spread bets" table without narrative.

### Phase 5: Output

Run folder: `$JOB_SEARCH_ROOT/<Candidate Legal Name>/<YYYY-MM-DD>/`.

If the folder exists for today's date, append `-2`, `-3`, etc. Never overwrite a prior run.

Write two artifacts:

#### 1. `<Name> Job Match Brief.docx` (python-docx)

Sections:
- Header: candidate name, generation date, "Prepared by $AUTHOR_NAME."
- Executive summary: 4 bullets covering market read, top fits, salary expectations, recommended next moves.
- Top 10 picks: each with title, company, location, salary if known, posted date, direct apply URL, 2-3 sentence narrative, and the letter grade.
- Spread bets table: rank, grade, company, title, location, salary, URL.
- Salary context: short table of p25/p50/p75 for the candidate's target titles.
- Methodology + freshness: which boards were searched, total postings reviewed, link-validation kill rate (e.g., "32 of 50 candidates passed live-link verification"), when this brief was generated, when to re-run.

No emoji. Headings only in bold. Standard professional formatting.

#### 2. `<Name> Job Tracker.xlsx` (openpyxl)

One sheet, formatted as an Excel Table named `JobTracker` (so it sorts/filters cleanly).

Columns:
`Rank | Grade | Company | Title | Location | Remote | Salary | Posted | URL | Source | Apply Status | Date Applied | Notes`

`Apply Status` cells get data-validation dropdown: `Not Started, Applied, Phone Screen, Interview, Offer, Rejected, Withdrawn`. Default: `Not Started`.

`URL` cells should be Excel hyperlinks (clickable).

Conditional formatting: row tinted by grade (A=green, B=light-green, C=yellow, D=light-orange).

## Report back

After the run, tell the user:
- Where the deliverables live (full paths).
- Total postings reviewed, how many made A/B grade.
- Top 3 picks by name.
- Anything weird (e.g., "candidate's resume says City X but most matches are remote, flagged in the brief").
- Suggested next step: email the brief + tracker to the candidate.

## Privacy

Resumes are personal data. Treat them carefully:

- Don't paste raw resume text into web searches. Search by derived terms (titles, skills, location) only.
- Don't write the candidate's name, email, or phone number into prompts that go to external search services.
- Local file storage is fine. If you sync the run folder to cloud storage, make sure the candidate has consented.
- If you're running this on someone else's resume without their knowledge, stop and get permission first.
- If the candidate is yourself and your situation is sensitive (e.g., active employment you don't want disclosed), keep all output local and don't sync to shared drives.

## What this skill does NOT do

- Tailor the resume per posting.
- Draft cover letters.
- Auto-apply via Puppeteer/Playwright.
- Run on a schedule. Single-shot only, re-run when the candidate wants a refresh.

These are obvious v2 candidates. Don't sneak them into v1.

## Common mistakes to avoid

- Inflating target titles beyond what the resume supports. The candidate will apply to roles they're not qualified for and get demoralized.
- Trusting `posted_date` from job aggregators, they often republish stale listings. If the agent can't verify freshness from the original ATS endpoint, mark `posted_date: null` rather than guess.
- Skipping the sanity-check confirmation in Phase 1. Wrong target titles = 4 agents producing noise.
- Letting LinkedIn results dominate just because LinkedIn shows up first. Mission-aligned ATS-direct postings (Greenhouse/Lever) often beat aggregator results for quality.

## Example invocation

> User: "Find jobs for my friend Alex, resume in Downloads."

1. Read `~/Downloads/Alex Rivera Resume.pdf`.
2. Extract profile: Alex Rivera, target titles `["Director of Grants", "Grant Writer", "Development Manager"]`, sectors `["nonprofit", "higher-ed"]`, location and preferences derived from the resume.
3. Confirm with user: "Targeting grants/development roles for Alex in their region + remote. Sound right?"
4. Spawn 4 agents in parallel.
5. Score, rank, write brief + tracker to `$JOB_SEARCH_ROOT/Alex Rivera/<today>/`.
6. Report back with top 3 picks and the file paths.
