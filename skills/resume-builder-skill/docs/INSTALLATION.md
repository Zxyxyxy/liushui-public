# How to Install the `.skill` File

## What Is a `.skill` File?

A `.skill` file is a **packaged skill for Claude AI**. It's essentially a `.zip` archive that contains all the instructions and reference files Claude needs to perform a specific task with expert-level quality.

When you install a skill, Claude gains access to specialized knowledge and processes that it uses automatically when it detects a relevant request.

Think of it like installing a plugin: once installed, Claude will use it whenever you ask about resumes, CVs, or job applications.

## What's Inside `resume-builder.skill`?

If you rename `resume-builder.skill` to `resume-builder.zip` and extract it, you'll find:

```
resume-builder-skill/
├── SKILL.md                              # Main instructions Claude follows
└── references/
    ├── format-and-structure.md           # Page layout, fonts, spacing, PDF specs
    ├── bullet-writing-guide.md           # XYZ formula, action verbs, STAR method
    ├── ats-and-keywords.md               # ATS truths vs myths, keyword strategy
    └── common-mistakes.md               # What to avoid in resumes
```

## Installation Methods

### Method 1: Claude.ai (Recommended for Most Users)

1. Download `resume-builder.skill` from this repository
2. Open [claude.ai](https://claude.ai)
3. Click on your **profile icon** (bottom-left)
4. Go to **Settings**
5. Navigate to the **Skills** or **Custom Skills** section
6. Click **Add Skill** or **Upload**
7. Select the `resume-builder.skill` file
8. The skill is now active

After installation, simply ask Claude things like:
- "Help me create my resume"
- "Optimize my CV for this job description"
- "Review my resume and give me feedback"

Claude will automatically use the skill's knowledge to give you Harvard-standard, ATS-optimized advice.

### Method 2: Claude Code (For Developers)

If you're using Claude Code (the CLI tool), copy the skill folder directly:

```bash
# Clone the repo
git clone https://github.com/YOUR_USERNAME/resume-builder-skill.git

# Copy skill to your skills directory
cp -r resume-builder-skill/skill/ ~/.claude/skills/user/resume-builder/
```

### Method 3: Manual (Read the Files Yourself)

You don't need Claude to benefit from this skill. The reference files in `skill/references/` are standalone guides you can read and apply manually:

- **`format-and-structure.md`** — Use as a formatting checklist when building your resume in Word/Google Docs
- **`bullet-writing-guide.md`** — Reference the XYZ formula and action verb lists while writing
- **`ats-and-keywords.md`** — Understand how ATS actually works (spoiler: most "ATS tips" online are myths)
- **`common-mistakes.md`** — Review before sending your resume to catch common errors

## Updating the Skill

To update to a newer version, simply re-upload the new `.skill` file. It will replace the previous version.

## Troubleshooting

**"The .skill file won't open"**
→ It's not meant to be opened directly. It's a packaged archive for Claude. Install it using the methods above.

**"When I open it, it's empty"**
→ The file contains compressed data. If you want to inspect the contents, rename it to `.zip` and extract it.

**"Claude doesn't seem to use the skill"**
→ Make sure your request relates to resumes or job applications. Try specific phrases like "help me build my resume" or "optimize my CV."
