# Scoring Rubric

Each posting scored 0-100 across 6 dimensions. Final score = weighted sum. Letter grade from final.

| Dimension | Weight | What 100 looks like | What 0 looks like |
|---|---|---|---|
| Skills match | 25 | Posting calls out 5+ of the candidate's top skills by name | Posting requires skills the resume never demonstrates |
| Experience-level match | 20 | Years of experience and seniority sit inside the candidate's range | Posting wants 15 yrs and candidate has 4, or vice versa (overqualified) |
| Location fit | 15 | Remote-OK, or onsite within 30 mi of candidate's city | Onsite, 1500+ mi away, no relocation help, candidate not flagged willing-to-relocate |
| Salary fit | 15 | Posted range meets or exceeds candidate's signal (or market p50 if no signal) | Posted range is below candidate's floor or below market p25 |
| Mission/sector alignment | 15 | Employer is in a sector the candidate has worked in or written about | Employer is in a sector the candidate has explicitly avoided (e.g., defense for a community-development candidate) |
| Posting freshness | 10 | Posted ≤7 days ago | Posted >60 days ago, or no date and source is a known re-poster |

## Computing the score

```
final = (0.25 * skills + 0.20 * experience + 0.15 * location +
         0.15 * salary  + 0.15 * sector     + 0.10 * freshness)
```

Each component is scored 0-100. Salary and freshness can be `null` if unknown — when unknown, assign 60 (neutral, slight discount) and note "unverified" in the brief.

## Letter grades

- **A**: ≥85 — strong fit, lead with these in the top 10.
- **B**: 70-84 — solid fit, include in top 10 if there's room.
- **C**: 55-69 — spread bets table only, no narrative.
- **D**: 40-54 — include only if pool is thin (<25 results above 55).
- **F**: <40 — drop.

## Tie-breakers (when scores cluster)

1. Higher freshness score wins.
2. Direct ATS link (Greenhouse/Lever/Ashby) beats aggregator link.
3. Posting with disclosed salary beats one without.
4. Smaller, mission-aligned employer beats larger generic one (matches the "find them a real fit" framing).

## Things that should never push a score up

- Logo recognition. A famous company is not automatically a fit.
- Job-board ranking. Aggregators boost paid postings; we don't.
- Title match alone. Same title, wrong scope or seniority, is still wrong.

## Things that should override the score down

- Suspicious posting (no company website, vague compensation, asks for fees) → grade F regardless of math.
- "Urgently hiring" + recruiter-only contact + no employer name → grade D max, flag in notes.
- Posting requires a specific clearance or license the candidate doesn't have → grade D max, flag in notes.
