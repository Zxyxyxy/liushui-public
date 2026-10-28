# Research Report: $ARGUMENTS

Conduct a focused research report on the topic above using parallel agents, compile into a single .docx with inline citations and a source appendix.

## Phase 0: Setup

Generate a short, descriptive folder name (lowercase, hyphens). Create the working directory.

```
mkdir -p "$HOME/Documents/Research/<topic-folder>"
```

## Phase 1: Launch 4-6 Parallel Research Agents

Spawn 4-6 agents ALL IN A SINGLE MESSAGE for parallel execution using the `Agent` tool. Each agent covers a different angle:

**Agent 1 — Legal & Policy**:
Search for laws, regulations, official guidance, legislative history, and policy frameworks related to the topic. Prioritize .gov sources, official policy documents, and regulatory filings. For state education topics, prioritize your state DOE, state legislature, and USED.

**Agent 2 — Best Practices**:
Search for established best practices, implementation guides, case studies, and expert recommendations. Include professional organizations, practitioner publications, and proven frameworks. Look for what has worked in comparable contexts.

**Agent 3 — Local Context**:
Search for state-specific data, regional comparisons, district-level examples, and state policy context. Include state assessment data, state DOE reports, and local news coverage. For district-specific topics, check enrollment data, accountability metrics, and peer district comparisons.

**Agent 4 — Data & Statistics**:
Search for quantitative evidence: research studies, survey data, national datasets, trend analyses, and statistical reports. Prioritize peer-reviewed sources, NCES, Census data, and meta-analyses. Report effect sizes and sample sizes where available.

**Optional Agent 5 — Academic Research** (for topics with substantial scholarly literature):
Search for peer-reviewed journal articles, systematic reviews, and university research. Use Google Scholar, ERIC, PubMed as appropriate.

**Optional Agent 6 — Industry & Practitioner Perspectives** (for topics with practitioner relevance):
Search for industry reports, white papers, conference proceedings, and nonprofit/NGO publications.

### Agent Output Format

Each agent must return:
```markdown
## Findings
### Finding 1: <title>
- Claim: <specific factual claim>
- Evidence: <supporting detail>
- Source: <Author/Org (Year). Title. URL>

## Source List
1. <full citation with URL>
```

Add to every agent's brief: "Always use official/primary sources first. Return findings in the structured format. Complete as much as possible regardless of any issues."

## Phase 2: Monitor & Collect

Monitor agents as they complete. Process results as they arrive, don't wait for all to finish. Proceed when at least 3 agents return valid results.

## Phase 3: Compile the Report

### Verify URLs
For the top 20 most-cited URLs, use `WebFetch` to verify they resolve. Replace dead links where possible. Don't let verification block report generation.

### Report Structure

1. **Executive Summary**: 1-page overview of key findings and bottom-line assessment
2. **Background & Context**: What the topic is, why it matters now
3. **Key Findings**: Organized by theme (not by agent), with inline citations. Weave perspectives from all agents together.
4. **Implications & Recommendations**: Practical takeaways for decision-makers, ordered by evidence strength
5. **Source Appendix**: Full citation list, deduplicated, sorted alphabetically. Format: Author/Org (Year). *Title*. URL

### For Education Topics
Add:
- Federal & State Policy Context (ESSA, IDEA, state DOE guidance)
- State Data section with state-specific statistics

## Phase 4: Generate Final .docx

1. Write a Python script using `python-docx` to generate the report:
   - Calibri 11pt default font
   - Heading 1/2/3 styles for section hierarchy
   - Inline citations formatted consistently
   - Source appendix as numbered list

2. Save to `$HOME/Documents/Research/<topic-folder>/YYYY-MM-DD <Topic> Research Report.docx`

3. Save the generation script to `$HOME/Documents/Research/scripts/`

4. Open the file:
   ```
   open "$HOME/Documents/Research/<topic-folder>/YYYY-MM-DD <Topic> Research Report.docx"
   ```

## Phase 5: Fact-Check (if /fact-check skill is available)

Run `/fact-check` on the final report. Fix ERROR-level issues. Note WARNING-level items.

## Confirm to User

Report the final file path and a brief summary:
- Total sources found
- Key themes identified
- Any coverage gaps
- Output location
