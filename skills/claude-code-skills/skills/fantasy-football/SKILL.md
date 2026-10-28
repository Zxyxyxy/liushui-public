---
name: fantasy-football
description: AI-powered fantasy football assistant with draft prep, live draft, weekly matchup, and trade analysis modes. Uses parallel research agents for current data.
argument-hint: "draft | live-draft | week <N> | trade <give> for <get>"
---

# Fantasy Football Assistant: $ARGUMENTS

Multi-mode fantasy football assistant using parallel web research agents for real-time data. Based on Jason's multi-AI draft prep workflow.

## Phase 0: Parse Mode & Load Config

Read `~/.claude/fantasy-football-config.json` for league settings. If the file doesn't exist, create it with the defaults below:

```json
{
  "league": {
    "teams": 10,
    "scoring": "PPR",
    "draft_type": "snake",
    "roster_size": 16,
    "starters": 9,
    "positions": {
      "QB": {"start": 1, "max": 4},
      "RB": {"start": 2, "max": 8},
      "WR": {"start": 2, "max": 8},
      "TE": {"start": 1, "max": 3},
      "FLEX": {"start": 1, "eligible": ["RB", "WR", "TE"]},
      "DST": {"start": 1, "max": 3},
      "K": {"start": 1, "max": 3}
    },
    "bench": 7,
    "ir": 1
  },
  "draft_position": null,
  "roster": {},
  "season_year": 2026
}
```

Parse `$ARGUMENTS` to determine the mode:

| Input Pattern | Mode |
|---------------|------|
| `draft` | Draft Prep |
| `live-draft` | Live Draft |
| `week <N>` or no arguments | Weekly Matchup |
| `trade <players> for <players>` | Trade Analyzer |

If no arguments and it's NFL season (Sept-Jan), default to Weekly Matchup for the current week. If offseason, default to Draft Prep.

---

## Mode 1: Draft Prep

Full preseason research producing a comprehensive draft guide.

### Step 1: Launch 4 Research Agents in Parallel

Spawn ALL 4 agents in a SINGLE MESSAGE using the `Agent` tool with `subagent_type: "general-purpose"`. Each agent uses `WebSearch` and `WebFetch` to pull current data.

**Include in every agent brief:**
- League format: `<teams>-team <scoring> league, <draft_type> draft`
- Season year from config
- "Return findings in the structured format below. Rate each finding's confidence as high/medium/low with a reason. Use WebSearch and WebFetch to find current data, not training knowledge. Complete as much as possible."

**Agent 1 -- Rankings & Projections** (`rankings-agent`):
Search for current ADP data, expert consensus rankings, and positional tier rankings for the upcoming season. Find:
- Overall top-200 consensus rankings (aggregate multiple expert sources)
- Positional tier breaks (where value drops off at each position)
- ADP vs expert rank discrepancies (value picks and overdrafts)
- Positional scarcity analysis (when to target each position)
- Zero-RB vs Hero-RB vs Robust-RB strategy recommendations for this year

Sources to search: FantasyPros ECR, ESPN, Yahoo, NFL.com, The Athletic, PFF, underdog fantasy ADP.

**Agent 2 -- Injuries & News** (`news-agent`):
Search for offseason player movement, injuries, and depth chart changes affecting fantasy value. Find:
- Key free agency signings and their fantasy impact
- Significant injuries (ACL tears, holdouts, suspensions)
- Training camp battles at key positions
- Coaching changes and new offensive scheme impacts
- Rookie landing spots and projected roles (post-NFL Draft)

Sources to search: ESPN injury reports, Rotoworld/NBC Sports, NFL team beat reporters, PFF news.

**Agent 3 -- Matchups & Schedules** (`matchups-agent`):
Search for schedule-based analysis and strength-of-schedule data. Find:
- Full-season strength of schedule by position (QB, RB, WR, TE)
- Playoff schedule analysis (Weeks 15-17): which players have favorable matchups
- Divisional matchup advantages (teams that play weak divisions)
- Early-season schedule (Weeks 1-4) for streaming considerations
- Bye week clusters to avoid

Sources to search: FantasyPros SOS, PFF schedule analysis, football outsiders, fantasy points allowed data.

**Agent 4 -- Advanced Analytics** (`analytics-agent`):
Search for efficiency metrics, usage data, and breakout models. Find:
- Target share and air yards leaders from last season
- Snap count percentages and usage trends
- Efficiency metrics: yards per route run, yards after contact, true catch rate
- Breakout candidate models and second-year player profiles
- Aging curves and decline candidates
- Rookie profiles with college production and draft capital analysis

Sources to search: PFF, Player Profiler, Fantasy Points Data, reception perception, next-gen stats.

### Agent Output Format

Each agent must return:

```markdown
## Findings

### Finding 1: <title>
- **Claim**: <specific factual claim>
- **Evidence**: <supporting data or context>
- **Fantasy Impact**: <how this affects draft strategy>
- **Confidence**: <high|medium|low> -- <reason>
- **Source**: <Author/Site (Year). Title. URL>

### Finding 2: <title>
...

## Source List
1. <full citation with URL>
2. ...

## Key Takeaways
- <3-5 bullet summary of most actionable findings>
```

### Step 2: Collect and Cross-Reference

Process agent results as they complete. Build a consolidated view:

1. Cross-reference rankings across agents (does the analytics data support the consensus rankings?)
2. Flag contradictions (e.g., one agent says "breakout" while another shows injury concern)
3. Identify convergence points (multiple agents supporting the same conclusion = higher confidence)

### Step 3: Generate Draft Prep Report (.docx)

Create the output directory:
```
mkdir -p ~/Documents/Fantasy\ Football/
```

Write a Python script using `python-docx` (run with `/opt/anaconda3/bin/python3`) to generate a report with these sections:

#### Report Structure

1. **Strategy Overview**
   - Recommended draft approach for this league format (zero-RB, hero-RB, balanced)
   - Key strategic principles for this season
   - What's different this year vs last year

2. **Tiered Rankings by Position**
   - QB Tiers (with confidence indicators)
   - RB Tiers
   - WR Tiers
   - TE Tiers
   - DST Rankings
   - K Rankings
   - Use color coding: green = high confidence, yellow = medium, red = low

3. **Round-by-Round Draft Plan**
   - Rounds 1-3: Premium picks (targets by draft position)
   - Rounds 4-6: Value zone (positional need vs BPA)
   - Rounds 7-10: Upside plays (breakout candidates, handcuffs)
   - Rounds 11-16: Late-round targets (streaming options, lottery tickets)

4. **Sleepers & Breakout Candidates**
   - Players going later than they should
   - Second-year breakout candidates
   - Scheme-fit beneficiaries

5. **Players to Avoid**
   - Injury concerns
   - Decline candidates (age, efficiency drop)
   - Overvalued ADP (consensus too high based on data)

6. **Playoff Schedule Advantage**
   - Players with favorable Weeks 15-17 matchups
   - Stack opportunities for the playoff push

7. **Source Appendix**
   - All sources from all agents, deduplicated
   - Sorted by reliability

#### Formatting
- Calibri 11pt default font
- Heading 1/2/3 styles for section hierarchy
- Tables for tier rankings with header row shading
- Colored cell shading for confidence indicators (green/yellow/red)

Save to: `~/Documents/Fantasy Football/<YYYY> Draft Prep.docx`
Save script to: `~/Documents/Fantasy Football/scripts/generate_draft_prep.py`

Open the file:
```
open ~/Documents/Fantasy\ Football/<YYYY>\ Draft\ Prep.docx
```

### Step 4: Log to Obsidian

Create session log: `Sessions/YYYY-MM-DD - Fantasy Football Draft Prep.md`

Frontmatter:
```yaml
---
date: <YYYY-MM-DD>
type: session
summary: Generated fantasy football draft prep report for <YYYY> season
tags: [session, fantasy-football, draft-prep]
---
```

Include: agents spawned, total sources, key strategic recommendations, output path.

---

## Mode 2: Live Draft

Interactive real-time draft assistant. Speed is critical, keep responses short.

### Setup

1. Load config. Ask for draft position if `draft_position` is null.
2. Initialize tracking state:
   - `drafted_players`: list of all picks made (player, team, round, pick#)
   - `my_roster`: players on Jason's team by position
   - `current_round`: 1
   - `current_pick`: 1
   - `positional_needs`: based on league roster requirements

3. Print a brief header:
```
LIVE DRAFT - <teams>-team <scoring> | Pick <draft_position> | Snake Draft
Commands: "picked <Player Name>" | "my pick" | "need <position>" | "done"
```

### Interactive Loop

Use a SINGLE focused agent (not 4 parallel) for speed. Research only when "my pick" is called.

**On `picked <Player Name>`:**
- Add to `drafted_players` list
- If it was Jason's pick, add to `my_roster`
- Briefly note if a pre-draft target was taken
- Advance round/pick counter
- Print: `R<round>P<pick>: <Player> (<POS>) -- <team that drafted>`

**On `my pick`:**
- Calculate positional needs based on current roster vs requirements
- Use WebSearch to quickly check: current ADP, recent news/injury for top available players
- Recommend top 3 picks with one-line rationale each:
```
YOUR PICK (R<round>P<pick>):
1. <Player> (<POS>) -- <rationale>
2. <Player> (<POS>) -- <rationale>
3. <Player> (<POS>) -- <rationale>

Positional needs: <remaining needs>
```
- Keep it fast. No lengthy analysis. The clock is ticking.

**On `need <position>`:**
- Show top 5 available players at that position with ADP and one-line note

**On `done`:**
- Save final roster to config file (update `roster` field)
- Print draft recap: roster by position, grade assessment, strengths/weaknesses
- Note waiver wire priorities for any positional weaknesses
- Log to Obsidian: `Sessions/YYYY-MM-DD - Fantasy Football Live Draft.md`

---

## Mode 3: Weekly Matchup

In-season weekly analysis for start/sit decisions, waivers, and matchup breakdown.

### Step 1: Determine Week

If `week <N>` is specified, use that week number. Otherwise, calculate the current NFL week from today's date:
- NFL Week 1 typically starts first Thursday after Labor Day
- Each week runs Thursday-Wednesday
- If between seasons, ask the user which week to analyze

### Step 2: Validate Roster

Read `roster` from config. If empty, ask the user to provide their current roster before proceeding. Format expected:

```json
"roster": {
  "QB": ["Patrick Mahomes", "Jalen Hurts"],
  "RB": ["Saquon Barkley", "Travis Etienne", "Jaylen Warren"],
  "WR": ["Ja'Marr Chase", "Amon-Ra St. Brown", "DeVonta Smith", "Rashee Rice"],
  "TE": ["Sam LaPorta"],
  "DST": ["San Francisco 49ers"],
  "K": ["Harrison Butker"]
}
```

### Step 3: Launch 4 Research Agents in Parallel

Same parallel launch pattern as Draft Prep, but scoped to the current week.

**Agent 1 -- Weekly Projections** (`projections-agent`):
Search for Week <N> fantasy projections and rest-of-season rankings. Find:
- Point projections for all rostered players this week
- Rest-of-season positional rankings
- Trending players (hot streaks, increasing usage)
- Consensus start/sit recommendations from experts

**Agent 2 -- Injury & News** (`injury-agent`):
Search for current injury reports and news affecting Week <N>. Find:
- Official injury designations (Out, Doubtful, Questionable, Probable)
- Practice participation reports (DNP, Limited, Full)
- Game-time decisions and their backup options
- Suspensions, personal matters, or other absences
- Last-minute news that could affect starts

**Agent 3 -- Matchup Analysis** (`matchup-agent`):
Search for Week <N> matchup data. Find:
- Opponent defensive rankings by position (fantasy points allowed)
- Vegas lines and over/under totals (game script implications)
- Weather forecasts for outdoor games
- Home/away splits for relevant players
- Divisional rivalry factors

**Agent 4 -- Usage & Trends** (`trends-agent`):
Search for recent usage trends and advanced stats. Find:
- Target share trends over last 3 weeks
- Red zone opportunities and targets
- Snap count percentages week-over-week
- Air yards and expected fantasy points
- Efficiency metrics trending up or down

### Step 4: Generate Weekly Report (.docx)

Write a Python script using `python-docx` to generate:

1. **Matchup Overview**
   - Your projected starting lineup with point projections
   - Overall week outlook (high-scoring week? Bye week hell?)

2. **Start/Sit Recommendations**
   - For each position, recommend starters with rationale
   - Confidence rating on each start/sit decision
   - Format as a table: Player | Opponent | Projection | Recommendation | Confidence

3. **FLEX Decision Analysis**
   - Compare all FLEX-eligible players side by side
   - Matchup, usage trend, projection, ceiling/floor analysis
   - Clear recommendation with reasoning

4. **Waiver Wire Targets**
   - Top 5-8 available players to target (assume standard waiver pool)
   - Priority order with FAAB % suggestions (if applicable)
   - Why each player is worth adding and who to drop

5. **Looking Ahead**
   - Upcoming bye weeks for your roster
   - Tough matchups in the next 2-3 weeks
   - Stash candidates to pick up now for future value

6. **Source Appendix**

Save to: `~/Documents/Fantasy Football/<YYYY> Week <N> Report.docx`
Save script to: `~/Documents/Fantasy Football/scripts/generate_weekly_report.py`

Open the file:
```
open ~/Documents/Fantasy\ Football/<YYYY>\ Week\ <N>\ Report.docx
```

### Step 5: Log to Obsidian

Create session log: `Sessions/YYYY-MM-DD - Fantasy Football Week <N>.md`

Frontmatter:
```yaml
---
date: <YYYY-MM-DD>
type: session
summary: Week <N> fantasy football matchup analysis
tags: [session, fantasy-football, weekly-matchup]
---
```

Include: recommended starters, key sit decisions, top waiver target, output path.

---

## Mode 4: Trade Analyzer

Quick trade evaluation. Terminal output only, no .docx.

### Step 1: Parse Trade

Extract player names from arguments. Expected format: `trade <Player1>, <Player2> for <Player3>, <Player4>`

Confirm the parsed trade with the user:
```
TRADE EVALUATION
Giving: <Player1>, <Player2>
Getting: <Player3>, <Player4>
```

### Step 2: Launch 2 Agents in Parallel

**Agent 1 -- Value Assessment** (`value-agent`):
Search for rest-of-season projections and trade value for all players involved. Find:
- ROS point projections for each player
- Current positional ranking and tier
- Remaining schedule strength
- Trade value charts (CBS, FantasyPros, KTC rankings)
- Buy-low / sell-high status

**Agent 2 -- Context & News** (`context-agent`):
Search for recent news and situation for all players involved. Find:
- Injury status and history this season
- Recent usage trends (snap %, target share, touches)
- Team offensive changes (play-calling, QB situation, O-line health)
- Upcoming schedule (next 4-6 weeks)
- Any red flags (declining role, coaching change, bye weeks)

### Step 3: Evaluate and Recommend

Read current roster from config to assess positional impact. Analyze:

1. **Points Gained/Lost ROS**
   - Net projected points difference rest of season
   - Account for positional replacement value (what you'd start instead)

2. **Positional Depth Impact**
   - Does this trade create a hole at a position?
   - Does it consolidate strength where you're already deep?

3. **Schedule Comparison**
   - Remaining schedule favorability for players involved
   - Playoff schedule (Weeks 15-17) comparison

4. **Timing Assessment**
   - Buy-low / sell-high window analysis
   - Is the trade better now or should you wait?

### Step 4: Print Recommendation

Format the output for terminal:

```
TRADE VERDICT: ACCEPT / REJECT / COUNTER

Giving: <Player1> (RB12, ~180 ROS pts), <Player2> (WR25, ~120 ROS pts)
Getting: <Player3> (WR5, ~220 ROS pts), <Player4> (RB30, ~90 ROS pts)

Net ROS Points: +10 (slight edge to you)
Positional Impact: Upgrades WR1, weakens RB depth
Schedule Edge: <Player3> has favorable Weeks 15-17
Timing: <Player1> is at peak value (sell-high), <Player3> is undervalued (buy-low)

Bottom Line: <1-2 sentence summary>

Counter-offer idea: <if applicable, suggest a tweak that makes it better>
```

---

## General Notes

- All web research uses `WebSearch` and `WebFetch` for current data. Never rely on training data for fantasy projections, they are stale by definition.
- Confidence ratings: **High** = multiple sources agree, recent data. **Medium** = single reputable source or slightly dated. **Low** = projection-based, conflicting signals, or thin data.
- Output directory for all .docx files: `~/Documents/Fantasy Football/`
- Config file: `~/.claude/fantasy-football-config.json` (user manually updates roster)
- During live draft, prioritize speed over depth. Short responses, quick searches.
- For trade analysis, terminal output only (no .docx overhead for a quick decision).
