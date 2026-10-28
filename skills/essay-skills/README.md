# Essay Pipeline Skill for Claude Code

A professional essay writing pipeline packaged as a single Claude Code skill. One command — `/essay` — guides you through six steps from scattered notes to polished prose.

## What This Is

Most AI writing tools do one thing: generate text. This skill does something different. It treats essay writing as a **process** — the same process a professional editor would walk you through — and guides you step by step.

You invoke `/essay`, and it figures out where you are in the pipeline based on what artifacts already exist in your project. Starting fresh? It begins with the brief. Already have a draft? It offers revision, review, or polish. You can also jump to any step directly.

## The Pipeline

```
/essay
  │
  ├─ Step 1: Brief    → Capture the essay's DNA through a question flow
  ├─ Step 2: Outline  → Design the structural skeleton
  ├─ Step 3: Draft    → Write the full first draft
  ├─ Step 4: Revise   → Make surgical edits to specific sections
  ├─ Step 5: Review   → Tough editorial diagnostic
  └─ Step 6: Polish   → Final rhythm, word choice, and honest assessment
```

Each step builds on the last. Each step produces artifacts that keep the essay coherent across the entire process.

## Installation

### Via skills.sh (recommended)
```bash
npx skills add clyderankin/essay-skills
```

### Via bash script
```bash
curl -fsSL https://raw.githubusercontent.com/clyderankin/essay-skills/main/install.sh | bash
```

## Usage

### Start the Pipeline

```
/essay

[paste your notes, ideas, fragments]
```

The skill detects where you are and guides you forward. If you're starting fresh, it begins with the brief — a structured question flow that captures your essay's central argument, audience, tone, constraints, and voice.

### Jump to a Specific Step

Already have a draft? Want to skip the outline? Just tell it:

```
/essay

I have a draft already — let's go to review
```

The six steps are: `brief`, `outline`, `draft`, `revise`, `review`, `polish`.

### The Steps in Detail

**Brief** — The foundation. A structured question flow across six phases (core intent, audience, structure, details, formatting, visuals) that produces `essay-brief.md`. This file becomes the source of truth that every downstream step checks against.

**Outline** — The architecture. Proposes a structural skeleton with section purposes, word count targets, and transitions. Identifies the throughline — the single thread connecting everything. Flags structural risks before you've written a word.

**Draft** — The writing. Follows the brief and outline to produce a full first draft. Marks uncertain passages with `[??]` flags so the revision stage knows where to focus. Embeds visual callout markers (`[IMAGE: ...]`, `[PULL QUOTE: ...]`) where appropriate.

**Revise** — The scalpel. Surgical edits to specific sections. You paste a passage and your notes ("make it punchier", "this feels off", "bridge this to the next section"), and it revises while preserving the essay's voice. Identifies the edit type (tighten, expand, reframe, sharpen, restructure, tone shift, bridge, kill darlings) and explains what changed.

**Review** — The tough editor. Evaluates the full draft across five dimensions: argument integrity, structure & pacing, voice & consistency, reader experience, and constraint compliance. Scores each dimension, identifies priority fixes (must fix / should fix / could fix), and gives a clear verdict: ready for polish, needs revision, needs structural rework, or needs fundamental rethinking.

**Polish** — The final pass. Rhythm, word choice, consistency, and clarity. Then the most important part: an honest assessment of the finished work. Not flattery — a genuine professional opinion on whether the essay holds up for its intended publication.

## How It Works Internally

The skill is structured as a parent orchestrator (`SKILL.md`) that routes to step files:

```
skills/
  essay/
    SKILL.md              ← orchestrator (detects state, routes to steps)
    steps/
      brief.md            ← Step 1
      outline.md          ← Step 2
      draft.md            ← Step 3
      revise.md           ← Step 4
      review.md           ← Step 5
      polish.md           ← Step 6
```

The orchestrator checks for existing artifacts (`essay-brief.md`, `essay-outline.md`, `essay-draft.md`) to determine where you are in the pipeline, then loads the appropriate step file.

## Artifacts

The pipeline creates files that downstream steps reference:

| File | Created by | Used by |
|------|------------|---------|
| `essay-brief.md` | Brief | All downstream steps |
| `essay-outline.md` | Outline | Draft |
| `essay-draft.md` | Draft | Revise, Review, Polish |

**The brief is the source of truth.** Every step checks against it to maintain voice, tone, and constraint consistency throughout the process.

## Voice Principles

When no specific voice is provided, the pipeline defaults to these principles:

- **Philosophical yet Accessible** — Authority from perspective, not credentials
- **Intellectual Honesty** — Refuse easy positions; treat complexity as terrain
- **Strategic Sentence Architecture** — Length variation for impact
- **Grounding** — Abstract balanced with concrete specifics
- **No Mechanical Transitions** — Thematic flow over signposting
- **Productive Discomfort** — Preserve complexity; don't resolve too cleanly

These defaults are overridden by the voice sample captured in your brief.

## License

MIT
