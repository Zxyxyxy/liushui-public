# Claude Writing Skills

A set of [Claude Code](https://claude.com/claude-code) skills for running a writing publication. The system I use to write [The Long Game](https://substack.com/@nadiem99) — a Substack about how individuals and nations position for long-term success amid structural change.

These skills turn writing from a guessing game into a workflow. Each skill is a stage in the editorial pipeline: extracting your thinking through an interview, structuring it into an outline, drafting it section by section, coaching the argument, line editing the prose, source-checking the claims, screening for AI tells, and repurposing for social.

Built on top of an Obsidian vault with Readwise integration for reading highlights — but the skills work with any markdown-based setup.

Packaged as a [Claude Code plugin](https://docs.claude.com/en/docs/claude-code/plugins). Install the whole pipeline or lift a single skill.

## Install

Uses the [`skills`](https://github.com/vercel-labs/skills) CLI, which reads this repo's plugin manifest and copies the skills you pick into your project's `.claude/skills/`.

```bash
# the whole pipeline (pick interactively)
npx skills add nadiem99/claude-writing-skills

# just one skill
npx skills add nadiem99/claude-writing-skills --skill interview

# install globally for every project (~/.claude/skills)
npx skills add nadiem99/claude-writing-skills -g
```

Then run Claude Code from your writing vault and the commands (`/interview`, `/outline`, …) are available.

<details>
<summary>Manual install (no CLI)</summary>

```bash
git clone https://github.com/nadiem99/claude-writing-skills.git
cd claude-writing-skills

# copy the skills you want into your vault's .claude/skills/
mkdir -p /path/to/your/vault/.claude/skills
cp -r skills/pipeline/* /path/to/your/vault/.claude/skills/
cp -r skills/support/*  /path/to/your/vault/.claude/skills/

# copy the context + templates the skills read from
cp -r context templates CLAUDE.md /path/to/your/vault/
```

</details>

**Run [`setup`](./skills/support/setup) first.** It writes `context/brand-guide.md` based on a short interview about your publication, audience, pillars, and voice. Every other skill reads from that file. Skip this and the output sounds generic — the skills have nothing specific to calibrate against.

## What's in here

Eleven skills, all user-invoked slash commands. Grouped into the editorial **pipeline** and the **support** skills that feed it.

### Pipeline — the 8-stage editorial flow

- **[`interview`](./skills/pipeline/interview/SKILL.md)** — One-question-at-a-time Socratic interview to draw out what you actually think about a topic. Produces the raw material that becomes an essay.
- **[`outline`](./skills/pipeline/outline/SKILL.md)** — Turns an idea or interview into a structured outline. Follows the narrative-first arc: concrete → mechanism → implications.
- **[`draft`](./skills/pipeline/draft/SKILL.md)** — Section-by-section drafting partner. Reads your voice notes before writing and explicitly states which patterns it's calibrating against. Never generates a full article in one shot.
- **[`coach`](./skills/pipeline/coach/SKILL.md)** — Developmental edit. Triages thesis, structure, and argument before scoring style. Modeled on Eleanor Warnock's editorial approach: structure first, prose second.
- **[`edit`](./skills/pipeline/edit/SKILL.md)** — Line edit. Tightens prose, strengthens verbs, fixes rhythm. Runs a mechanical style sweep first, then goes paragraph by paragraph.
- **[`source-check`](./skills/pipeline/source-check/SKILL.md)** — Verifies every factual claim. Maintains a Sources section at the bottom of the draft. Flags vague attribution and overstatements.
- **[`top-edit`](./skills/pipeline/top-edit/SKILL.md)** — Final mechanical pass. Screens for 17 categories of AI tells, checks house style, recommends a paragraph for the voice notes, and runs a session retro to surface lessons that improve the system over time.
- **[`repurpose`](./skills/pipeline/repurpose/SKILL.md)** — Converts a published essay into X threads and LinkedIn posts. Extracts building blocks first, then generates options.

### Support — feed the pipeline

- **[`setup`](./skills/support/setup/SKILL.md)** — **Run this first.** Interactive onboarding. Captures publication identity, audience, pillars, and voice. Writes `context/brand-guide.md`.
- **[`research`](./skills/support/research/SKILL.md)** — Surfaces relevant reading highlights from your vault, finds connections across notes, and suggests external sources.
- **[`status`](./skills/support/status/SKILL.md)** — Shows pipeline state across ideas, outlines, drafts, review, and published. Recommends what to work on next.

## How they chain

```
setup           → (writes context/brand-guide.md, read by every skill below)

interview       → outline → draft → coach → edit → source-check → top-edit → repurpose
                                       ↑                                    ↓
                                       └──── (going backwards is normal) ───┘
research        → fuels interview, outline, draft, source-check
status          → run any time to see pipeline state
```

The pipeline is a guide, not a conveyor belt. Drafting is sculpting, not construction. Going from draft back to outline, or from coaching back to draft, is normal and expected.

### First steps after install

1. Run `/setup` and answer the questions. This fills in `context/brand-guide.md`.
2. Open `context/writing-principles.md` and `context/ai-tells-checklist.md`. Read them, edit anything you disagree with — these are your defaults, not gospel.
3. When you have your first article idea, run `/interview [topic]` to extract your thinking, then `/outline` to structure it.

## Working with Obsidian + Readwise

This is the setup I use. Not required, but recommended.

### Why Obsidian

- **Plain markdown.** Every file is a `.md` file with YAML frontmatter. Claude Code can read and edit them natively. No proprietary format, no lock-in.
- **Linking.** `[[Wikilinks]]` between notes turn your vault into a graph. Articles can reference reading highlights, ideas can reference earlier ideas. The skills follow these links when they need context.
- **Folder structure becomes pipeline state.** Moving a file from `Writing/Drafts/` to `Writing/Review/` is the entire act of "advancing" it. The `/status` skill reads these folders directly.

### Why Readwise

[Readwise](https://readwise.io) syncs highlights from Kindle, Twitter/X, articles you read on the web, podcasts, and more — into a central library. The Readwise → Obsidian plugin auto-imports those highlights as markdown files in your vault.

This matters because the `/research` and `/source-check` skills read from your highlights folder. Every book you've read, every article you've highlighted, every tweet you've saved becomes searchable raw material. When you write a piece on a topic, the skills surface what you've already thought about it — including your own annotations.

### Recommended vault structure

After install, the skills live in your vault's `.claude/skills/`. The rest is content:

```
YourVault/
├── .claude/skills/         ← installed by the skills CLI
├── .obsidian/              ← Obsidian's own config
├── context/                ← from this repo (filled in by /setup)
├── templates/              ← from this repo
├── CLAUDE.md               ← from this repo
├── Inbox/                  ← quick captures
├── Reading notes/          ← Readwise sync target
│   ├── Books/
│   ├── Articles/
│   └── X Posts/
└── Writing/
    ├── Ideas/
    ├── Interviews/         ← /interview output
    ├── Outline/
    ├── Drafts/
    ├── Review/
    ├── Published/
    ├── Threads/
    └── LinkedIn/
```

Add `.claude/` to your Obsidian "Files & Links → Excluded files" list so Obsidian doesn't index the skill files in your graph view.

## Philosophy

A few opinionated choices baked into these skills:

**Voice calibration is mandatory, not optional.** The `/draft` skill reads `context/voice-notes.md` before writing any prose and explicitly states which patterns it's calibrating against. If it doesn't, it's not following the skill.

**The writer drives. Always.** No skill generates a full article in one shot. Drafting is collaborative, section by section, with multiple options for the writer to choose from.

**The system improves itself.** After each `/top-edit`, the skill recommends a paragraph to add to your voice notes (so future drafts calibrate against your actual best work) and runs a retro on chat friction (so writing principles, AI tells, and skill instructions get sharper over time).

**AI tells are a checklist, not a vibe.** The `/top-edit` skill screens for 17 specific patterns mechanically. Any drafting skill that tries to write before consulting that checklist is shipping AI slop.

**Structural feedback before prose feedback.** `/coach` triages thesis, structure, and argument before scoring style. A beautifully written essay with a broken argument is still broken.

## Customization

You will want to edit:

- `context/brand-guide.md` — the most important file. `/setup` writes a draft. Refine it.
- `context/writing-principles.md` — these are my principles. Yours might be different.
- `context/ai-tells-checklist.md` — add patterns you catch in your own drafts.
- Each skill's `SKILL.md` — adjust voice rules, format preferences, output formats. The skills are markdown — edit them like any other note.

The whole system is just markdown plus a few conventions Claude Code follows. Nothing is sacred. Make it yours.

## Credits

Built by [Nadiem Mahmoud](https://substack.com/@nadiem99) for [The Long Game](https://substack.com/@nadiem99) on Substack.

Inspired by:
- Every's editorial team — particularly Kate Lee's top-edit skill, Katie Parrott's interview-first approach, Eleanor Warnock's developmental editing methodology, and Anthony Scarpulla's repurposing framework.
- [Matt Pocock's skills](https://github.com/mattpocock/skills) — the plugin layout and single-skill install model this repo now follows.
- Zevenue's [`gtm-skills`](https://github.com/Zevenue/gtm-skills) repo — an early structural model for sharing Claude Code skill systems.

Installed with the [`skills`](https://github.com/vercel-labs/skills) CLI by Vercel Labs.

If you use these skills and improve them, send me your changes — I'd love to see what you do.

📬 [The Long Game on Substack](https://substack.com/@nadiem99)
