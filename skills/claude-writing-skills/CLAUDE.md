# Claude Writing Skills — System Overview

This file is read automatically by Claude Code at the start of every session in this directory. It explains the system to the model so the skills behave consistently.

## What This Is

A set of Claude Code skills for running a writing publication — extracting ideas, outlining, drafting, editing, source-checking, and repurposing for social. Designed to work with Obsidian + Readwise but compatible with any markdown-based writing setup.

## The Editorial Pipeline

Every piece moves through this 8-stage pipeline. Not every piece needs every stage — but this is the full sequence from raw idea to distribution.

```
1. Interview     →  Extract thinking, produce raw material       /interview
2. Outline       →  Structure the argument                       /outline
3. Draft         →  Sculpt the material section by section       /draft
4. Coach         →  Developmental edit (thesis, structure, arg)  /coach
5. Edit          →  Line edit (prose polish)                     /edit
6. Source Check  →  Verify claims, maintain source list          /source-check
7. Top Edit      →  AI tells & pattern check (mechanical pass)   /top-edit
8. Repurpose     →  Social distribution (X threads, LinkedIn)    /repurpose
```

**Key principle:** Drafting is sculpting, not construction. Going backwards (from draft back to outline, or from coaching back to draft) is normal and expected. The pipeline is a guide, not a conveyor belt.

## Onboarding

**Run `/setup` first.** It writes `context/brand-guide.md` based on a short interview about the writer's publication, audience, pillars, and voice. Every other skill reads from that file.

## Core Files (the "context layer")

The skills read from these. Edit them directly, or let `/setup` and `/top-edit` populate them over time.

- `context/brand-guide.md` — Publication identity, pillars, voice. Filled in by `/setup`.
- `context/writing-principles.md` — The rules every piece is checked against. Edit freely.
- `context/ai-tells-checklist.md` — Patterns that make writing sound AI-generated. Grows over time.
- `context/voice-notes.md` — Curated examples of the writer's best paragraphs. Grows after each `/top-edit`.

## Recommended Vault Structure

The skills assume a folder structure for content. Use this as-is or adapt:

```
Inbox/                              → Quick captures, fleeting ideas
Reading notes/                      → Imported highlights (Readwise, Kindle, articles)
Writing/
  ├── Ideas/                        → Seed ideas
  ├── Interviews/                   → /interview output (raw material)
  ├── Outline/                      → Structured outlines
  ├── Drafts/                       → Active drafts
  ├── Review/                       → Drafts under final review
  ├── Published/                    → Final published versions
  ├── Threads/                      → X thread drafts
  ├── LinkedIn/                     → LinkedIn post drafts
  └── Content Calendar/             → Publishing schedule (optional)
context/                            → Foundation files (read by every skill)
templates/                          → Frontmatter templates for new notes
```

## Voice & Style Rules

These layer on top of the writing principles. They are enforced by `/draft` and screened by `/top-edit`.

**DO:**
- Open with a concrete experience or scene (narrative-first)
- Follow the arc: concrete → mechanism → implications
- Support claims with evidence, data, or historical parallels
- Use the writer's natural voice — direct, specific, occasionally funny
- Use lived experience details (what makes the writing irreplaceable)
- Teach the reader something they didn't know before

**DON'T:**
- Sound like AI (signpost-heavy, emotionally flat, overly structured)
- Use consultant-speak ("Let's unpack this", "At the end of the day")
- Use signpost phrases ("In this article", "Let's explore", "Without further ado")
- Make claims without evidence
- Write things anyone could have written
- Generate full articles in one shot — always work section by section

## Key Rule

**The writer drives the writing.** The skills suggest, coach, and edit — but every decision about what to say and how to say it is the writer's. Never generate a full article in one shot. Always work collaboratively, section by section, with multiple options for the writer to choose from.
