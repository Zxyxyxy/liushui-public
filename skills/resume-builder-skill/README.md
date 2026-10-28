<p align="center">
  <h1 align="center">Resume Builder Skill for Claude AI</h1>
  <p align="center">
    <a href="https://buymeacoffee.com/daby"><img src="https://img.shields.io/badge/Buy%20Me%20a%20Coffee-support-yellow?style=for-the-badge&logo=buy-me-a-coffee&logoColor=white" alt="Buy Me a Coffee"></a>
    <img src="https://img.shields.io/badge/Claude_AI-Skill-blueviolet?style=for-the-badge&logo=anthropic&logoColor=white" alt="Claude AI Skill">
    <img src="https://img.shields.io/badge/License-MIT-green?style=for-the-badge" alt="MIT License">
  </p>
</p>

A comprehensive Claude AI skill for creating professional, ATS-optimized resumes following **Harvard Career Services** standards and **r/EngineeringResumes** best practices.

Built with real-world hiring knowledge from recruiters at Google, Amazon, Meta, and other top tech companies.

---

## What This Skill Does

This skill transforms Claude into an expert resume consultant that:

- **Creates resumes from scratch** with proper formatting, structure, and content
- **Optimizes existing resumes** for ATS compatibility and recruiter readability
- **Writes impact-driven bullet points** using the Google XYZ formula and STAR method
- **Produces both .docx and .pdf** formats with verified text extractability
- **Supports English and Spanish** with natural language adaptation (not literal translations)
- **Adds real clickable hyperlinks** for email, GitHub, and LinkedIn
- **Follows the 5-second scan test** — recruiters see what they need immediately

---

## Quick Start

### Option 1: Install the Skill in Claude.ai

1. Download [`resume-builder.skill`](./resume-builder.skill) from this repository
2. Go to **Claude.ai → Settings → Skills**
3. Upload the `.skill` file
4. Ask Claude: _"Help me create my resume"_

> **What is a `.skill` file?** It's a packaged set of instructions for Claude AI — like a plugin. Once installed, Claude uses it automatically when you ask about resumes. [Read the full installation guide →](./docs/INSTALLATION.md)

### Option 2: Use with Claude Code

```bash
git clone https://github.com/dabydat/resume-builder-skill.git
cp -r resume-builder-skill/skill/ ~/.claude/skills/user/resume-builder/
```

### Option 3: Read the Guides Manually

The reference files in [`skill/references/`](./skill/references/) are standalone guides you can use without Claude:

| File                                                                    | What You'll Learn                                        |
| ----------------------------------------------------------------------- | -------------------------------------------------------- |
| [`format-and-structure.md`](./skill/references/format-and-structure.md) | Page layout, fonts, spacing, PDF conversion process      |
| [`bullet-writing-guide.md`](./skill/references/bullet-writing-guide.md) | XYZ formula, STAR method, 50+ action verbs (EN/ES)       |
| [`ats-and-keywords.md`](./skill/references/ats-and-keywords.md)         | ATS truths vs myths, keyword strategy, tailoring process |
| [`common-mistakes.md`](./skill/references/common-mistakes.md)           | Harvard's top 5 errors, formatting/content anti-patterns |

---

## Knowledge Sources

This skill was built by researching and synthesizing best practices from:

| Source                                                                                              | What It Covers                                                 |
| --------------------------------------------------------------------------------------------------- | -------------------------------------------------------------- |
| [Harvard Career Services](https://careerservices.fas.harvard.edu/resources/create-a-strong-resume/) | Resume structure, action verbs, formatting standards           |
| [r/EngineeringResumes](https://www.reddit.com/r/EngineeringResumes/)                                | Tech-specific resume advice, community-tested patterns         |
| [The Tech Resume Inside Out](https://thetechresume.com/samples/the-hiring-pipeline)                 | The hiring pipeline, ATS myths debunked, recruiter perspective |
| [Tech Interview Handbook](https://www.techinterviewhandbook.org/resume/)                            | FAANG resume optimization, ATS-friendly formatting             |
| Columbia University STAR Method                                                                     | Bullet point writing framework                                 |
| Google XYZ Formula                                                                                  | Achievement-based resume bullets                               |

> **Full source traceability:** Every URL scraped, every key point extracted, and where each insight is applied is documented in [`docs/SOURCES.md`](./docs/SOURCES.md).

---

## Repository Structure

```
resume-builder-skill/
├── README.md                          ← You are here
├── LICENSE                            ← MIT License
├── .gitignore
├── resume-builder.skill               ← Installable skill file for Claude.ai
├── docs/
│   ├── INSTALLATION.md                ← Detailed installation & usage guide
│   └── SOURCES.md                     ← Full source traceability (every URL, what was extracted)
├── skill/                             ← The skill source files
│   ├── SKILL.md                       ← Main skill instructions
│   └── references/
│       ├── format-and-structure.md    ← Layout specs, PDF conversion
│       ├── bullet-writing-guide.md    ← XYZ/STAR formulas, action verbs
│       ├── ats-and-keywords.md        ← ATS truths, keyword strategy
│       └── common-mistakes.md         ← Anti-patterns to avoid
└── examples/
    ├── Example_Resume_EN.docx         ← Sample resume (Word, editable)
    └── Example_Resume_EN.pdf          ← Sample resume (PDF, print-ready)
```

---

## Key Principles

### 1. Domain Context Is the Secret Weapon

The single most impactful improvement for any resume. Instead of:

> ❌ "Developed web applications using React and NestJS"

Write:

> ✅ "Developed fintech web applications for credit risk assessment and transaction processing using React and NestJS, handling 500K+ loan applications annually with PCI-DSS compliance"

### 2. XYZ Formula for Every Bullet

Google's recommended format: **"Accomplished [X] as measured by [Y] by doing [Z]"**

```
Action Verb + What You Did + Technical Context + Business Impact
```

### 3. ATS Is Not Your Enemy

The biggest myth in job searching is that "robots reject 75% of resumes." In reality, ATS is just a database. Humans do the screening. Optimize for human readability first.

### 4. Always Deliver PDF

`.docx` renders differently across operating systems and Word versions. PDF preserves your exact formatting. The skill always produces both formats with verification that the PDF is text-based (ATS-parseable).

---

## Example Output

The [`examples/`](./examples/) folder contains a sample resume generated with this skill, featuring:

- A fictional senior software engineer profile ("Alex Morgan Rivera")
- Proper Harvard-format structure with skills at the top
- XYZ-formula bullet points with real domain context (healthcare, fintech, logistics)
- Clickable hyperlinks for email, GitHub, and LinkedIn
- Technology lines per role
- 2-page layout demonstrating proper spacing and readability

---

## Formatting Specs (Quick Reference)

| Property         | Value             |
| ---------------- | ----------------- |
| Font             | Calibri           |
| Body text        | 10.5pt            |
| Name             | 16pt Bold         |
| Section headings | 11.5pt Bold       |
| Tech lines       | 9.5pt Italic Gray |
| Margins          | 0.75 inches       |
| Line spacing     | 13pt              |
| Layout           | Single column     |
| Delivery format  | .docx + .pdf      |

---

## Trigger Phrases

Once installed, the skill activates when Claude detects any of these contexts:

- "Create my resume" / "Build my CV"
- "Optimize my resume" / "Improve my CV"
- "Make it ATS-friendly"
- "Review my resume" / "Resume review"
- "Tailor my resume to this job description"
- "Help me get hired"
- "Hoja de vida" / "Curriculum vitae"
- Any mention of job applications + resume/CV

---

## Contributing

Contributions are welcome! If you have suggestions for:

- Additional action verbs (especially in other languages)
- Industry-specific domain descriptors
- Regional resume conventions (Asia, Europe, Middle East)
- Additional ATS research or recruiter feedback
- More example resumes for different industries/experience levels

Please open an issue or submit a pull request.

---

## License

MIT License — see [LICENSE](./LICENSE) for details.

---

## Credits

It was built based on the collective wisdom of Harvard Career Services, the r/EngineeringResumes community, The Tech Resume Inside Out by Gergely Orosz, and insights from recruiters at top tech companies.

---

> _"A resume is not an autobiography. It's a marketing document. Include only what makes a recruiter MORE likely to call you."_

---

## 💛 Support This Project

If this skill helped you land interviews or improve your resume, consider supporting the project:

<p align="center">
    <a href="https://buymeacoffee.com/daby">
    <img src="https://img.shields.io/badge/☕_Buy_Me_a_Coffee-Support_This_Project-FFDD00?style=for-the-badge&logo=buy-me-a-coffee&logoColor=black" alt="Buy Me a Coffee" width="300">
    </a>
</p>

Your support helps maintain and improve this skill with new research, more languages, and better examples.

<p align="center">
  <a href="https://buymeacoffee.com/daby"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-yellow.png" alt="Buy Me a Coffee" width="200"></a>
</p>
