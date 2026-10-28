<p align="center">
  <h1 align="center">Resume Best Practices (2025/2026)</h1>
</p>

<p align="center">
  <strong>The complete, no-BS guide to writing resumes that get interviews.</strong><br>
  <em>Plus a Claude Code skill that optimizes your resume with AI.</em>
</p>

<p align="center">
  <a href="LICENSE"><img src="https://img.shields.io/badge/license-MIT-blue.svg" alt="MIT License"></a>
  <a href="https://github.com/StephanieKoehl/resume-best-practices/stargazers"><img src="https://img.shields.io/github/stars/StephanieKoehl/resume-best-practices?style=social" alt="GitHub Stars"></a>
  <a href=".claude/skills/optimize-resume/SKILL.md"><img src="https://img.shields.io/badge/Claude%20Code-Skill-blueviolet" alt="Claude Code Skill"></a>
  <a href="CONTRIBUTING.md"><img src="https://img.shields.io/badge/PRs-welcome-brightgreen.svg" alt="PRs Welcome"></a>
  <a href="https://github.com/StephanieKoehl/resume-best-practices/commits/main"><img src="https://img.shields.io/github/last-commit/StephanieKoehl/resume-best-practices" alt="Last Commit"></a>
</p>

---

## Who Is This For?

- Software engineers updating their resume for a job search
- Career changers breaking into tech
- PMs, TPMs, and startup generalists targeting $150K+ roles
- New grads writing their first professional resume
- Anyone who wants AI-assisted resume optimization via [Claude Code](https://claude.ai/code)

## What's Inside

**The Guide** -- Everything below covers structure, formatting, ATS optimization, bullet writing (Google's XYZ formula), quantification tricks, print-to-PDF CSS specs, role-specific keyword lists, and before/after examples. Sourced from recruiter advice, eye-tracking research, Cracking the PM Interview, and ATS vendor documentation.

**The Skill** -- A [Claude Code slash command](#claude-code-skill-optimize-resume) that reads your resume, scores it, rewrites weak bullets, and matches keywords against a job posting. [Jump to setup](#setup).

---

## Claude Code Skill: `/optimize-resume`

This repo includes a [Claude Code](https://claude.ai/code) skill that automatically analyzes and optimizes your resume. It scores ATS compatibility, rewrites weak bullets using the XYZ formula, checks quantification, and matches keywords against a job posting.

### Setup

Clone this repo and the skill is automatically available in Claude Code:

```bash
git clone https://github.com/StephanieKoehl/resume-best-practices.git
cd resume-best-practices
```

Or copy just the skill into any existing project:

```bash
cp -r resume-best-practices/.claude/skills/optimize-resume your-project/.claude/skills/
```

### Usage

Inside Claude Code, run:

```
/optimize-resume path/to/resume.md
```

Or with a job posting to tailor against:

```
/optimize-resume path/to/resume.md path/to/job-posting.txt
```

Claude will return:
- **Scorecard** (ATS compatibility, bullet impact, quantification, keyword match)
- **Top 3 priority fixes** with before/after examples
- **Line-by-line rewrite suggestions** using the XYZ formula
- **Missing keywords** from the job description

---

## Table of Contents

1. [The 7-Second Rule](#the-7-second-rule)
2. [Resume Structure](#resume-structure)
3. [ATS Optimization](#ats-optimization)
4. [Writing Bullets That Hit](#writing-bullets-that-hit)
5. [Quantifying Impact](#quantifying-impact)
6. [Before / After Examples](#before--after-examples)
7. [Print-to-PDF Specs](#print-to-pdf-specs)
8. [Handling Tricky Situations](#handling-tricky-situations)
9. [Role-Specific Advice](#role-specific-advice)
10. [What's In and What's Out in 2025/2026](#whats-in-and-whats-out)
11. [Resources](#resources)
12. [Contributing](#contributing)

---

## The 7-Second Rule

Eye-tracking research (Ladders study) shows recruiters spend **7.4 seconds** on an initial resume scan. In that scan, they look at:

1. Name
2. Current title and company
3. Current role dates
4. Previous title and company
5. Previous role dates
6. Education

That's it. They are **not reading your bullets** on the first pass. Your resume's visual hierarchy needs to make these six things instantly scannable.

### What gets you into the "yes" pile (second pass)

- Most recent role bullets (read most carefully)
- Summary/headline (if concise)
- Skills section (quick keyword scan)
- Career trajectory (moving up, lateral, or down?)

### What gets you instantly rejected

1. Typos and grammatical errors (#1 reason)
2. Irrelevant experience dominating the page
3. No quantified achievements -- bullets that read like job descriptions
4. Unexplained gaps
5. Wall of text -- no white space
6. Generic/unfocused resume (not tailored to the role)
7. More than 2 pages for a PM role
8. Objective statements (use a summary or nothing)
9. "References available upon request" (wastes space)
10. Personal pronouns ("I managed..." should be "Managed...")

---

## Resume Structure

### Length

**One page is the gold standard.** Cracking the PM Interview and Google's own recruiters agree: one page per ten years of experience. Even senior candidates benefit from the constraint -- it forces prioritization, which is itself a PM skill.

### Layout

**Single column is strongly recommended.** Two-column layouts cause problems with:
- ATS parsing (many systems read left-to-right across rows and scramble content)
- Screen readers and accessibility
- Printing fidelity

### Section Order

For PM/TPM/startup roles with 5+ years of experience:

1. **Header** -- Name, location, LinkedIn, website, email (phone in print only)
2. **Summary** -- 2-3 lines, tailored per application
3. **Experience** -- reverse chronological, most recent first
4. **Skills** -- compact, grouped by category
5. **Education** -- degree, institution, GPA (if > 3.5 and recent)
6. **Highlights / Leadership** -- notable achievements, fellowships, publications

### Bullets Per Role

| Role recency | Bullets |
|---|---|
| Most recent / most relevant | 3-4 |
| Mid-tier roles | 2-3 |
| Older or less relevant | 1-2 |

Never more than 5-6 bullets on any single role. If you need more detail, save it for the interview.

### Formatting Specs

| Element | Spec |
|---|---|
| **Name** | 20-28pt, semi-bold or bold |
| **Section headings** | 11-13pt, bold, uppercase, letter-spacing 1-2px |
| **Job titles** | 10-11pt, bold |
| **Company / dates** | 10-11pt, regular weight, dates right-aligned |
| **Bullet text** | 9.5-10.5pt (never below 9pt), line-height 1.3-1.5 |
| **Margins** | 0.5in to 0.75in on all sides |
| **Section spacing** | 16-24px between sections |
| **Item spacing** | 8-12px between job entries |
| **Bullet spacing** | 2-4px between bullets |

### Font Choices (ATS-safe and print-friendly)

**Best:** Inter, Calibri, Source Sans Pro, Garamond, Cambria

**Safe serif:** Georgia, Palatino, Charter

**Safe sans-serif:** Helvetica Neue, Arial (fallback)

Inter has emerged as the go-to modern sans-serif for resumes -- designed for screens but prints beautifully.

### Color

- Monochrome is safest. Use `#1a1a1a` for text (not pure black `#000`)
- **One accent color maximum** -- for name or section headings only
- Never use color to convey meaning (ATS can't see it, B&W prints lose it)

---

## ATS Optimization

### How ATS Works

Major platforms (Greenhouse, Lever, Workday, iCIMS, Ashby) parse resumes by:
1. Extracting text from the document
2. Identifying sections (experience, education, skills)
3. Matching keywords against the job description
4. Scoring and ranking candidates

### File Format

**PDF is widely accepted** and safest for preserving formatting. The old "DOCX only" advice is largely outdated. Just ensure the text is selectable (not a scanned image).

### What Breaks ATS Parsing

| Don't | Why |
|---|---|
| Tables | Content read out of order or dropped |
| Multi-column layouts | Text from columns gets interleaved |
| Headers and footers | Often ignored entirely |
| Text boxes | Floating boxes frequently missed |
| Images, logos, icons | Invisible to ATS |
| Skill bars / progress circles | Convey zero information to parsers |
| Fancy characters (em-dashes, smart quotes) | Can render as garbage |
| Non-standard section names | ATS looks for "Experience," "Education," "Skills" |

### Keyword Strategy

This is the single highest-leverage ATS optimization:

1. **Mirror the job description language exactly.** If the JD says "cross-functional collaboration," use that exact phrase.
2. **Include both acronyms and spelled-out versions:** "Technical Program Manager (TPM)"
3. **Place keywords in context,** not in a keyword dump. ATS increasingly penalizes stuffing.
4. **Hard skills matter more than soft skills** for ATS scoring.
5. **Match the seniority language.** If the JD says "led" and "managed," use those verbs.

### The Variant Resume Strategy

The highest-impact ATS strategy: maintain a master resume with all your experience and bullets, then create tailored variants for each application that:
- Select the most relevant summary
- Choose bullets tagged with matching skills
- Reorder skills to front-load JD keywords

---

## Writing Bullets That Hit

### Google's XYZ Formula (Gold Standard)

> **"Accomplished [X] as measured by [Y], by doing [Z]"**

This mirrors how PMs are evaluated: by outcomes, not activities. It forces you to lead with impact.

### The Principle

**Lead with the result, not the activity.**

- Bad: "Managed the product roadmap and worked with engineers"
- Good: "Shipped [outcome] by [action], resulting in [metric]"

### Power Verbs (Ranked by Impact for PM/TPM Roles)

**Highest (leadership + results):**
Led, Directed, Built, Designed, Launched, Drove, Scaled, Delivered, Established, Shipped

**High (execution + initiative):**
Architected, Developed, Implemented, Automated, Deployed, Created, Orchestrated

**Medium (analysis + influence):**
Identified, Analyzed, Synthesized, Discovered, Reframed, Facilitated

**Kill these words:**
Helped, Assisted, Participated in, Was responsible for, Worked on, Supported

### Common Mistakes

1. **Leading with responsibilities, not results** -- "Responsible for product roadmap" vs "Defined product roadmap that delivered 4 key features, increasing retention by 15%"
2. **Vague impact** -- "Improved processes" (which processes? by how much?)
3. **Activity without outcome** -- "Conducted user research" (and then what?)
4. **Listing tools instead of outcomes** -- "Used Jira, Confluence, Figma" vs "Built analytics dashboard that replaced manual weekly reporting"
5. **Too long** -- Each bullet should be 1-2 lines max. If it takes 3 lines, split or cut it.
6. **Not tailoring to the role** -- Your PM resume should emphasize different bullets than your TPM resume.
7. **Using first person** -- No "I" statements. Start with strong action verbs.

---

## Quantifying Impact

Almost everything is quantifiable if you reframe it. This is critical for ops, support, research, and early-stage roles.

### Time-Based Metrics
- "Reduced [process] from X hours to Y hours"
- "Accelerated [timeline] by X weeks"
- "Saved team ~X hours/week by automating [process]"

### Efficiency / Process Metrics
- "Cut [error rate / rework] by X%"
- "Reduced [ticket volume / escalations] by X%"
- "Improved [response time] from X to Y"

### Scale / Scope Metrics
- Use ranges: "Managed program across 3-5 teams"
- Use relative terms: "Largest client engagement in company history"
- Use "X+" format: "Conducted 30+ user interviews"
- Use frequency: "Shipped bi-weekly releases for 8 months straight"

### Adoption / Satisfaction
- "Achieved X% adoption rate within [timeframe]"
- "Maintained X+ NPS / CSAT score"
- "Reduced churn by X% in [segment]"

### Research / Discovery
- "Synthesized insights from X interviews into Y actionable recommendations"
- "Identified X critical usability issues, all resolved before launch"

### The Estimation Hack

**Estimate conservatively and use "~" or "approximately."** Recruiters know early-stage companies don't have perfect analytics.

- "~30% reduction" is credible
- "Grew from a handful of users to 500+" is fine
- "Saved approximately 20 hours/week" works

A reasonable estimate is far better than no number at all.

---

## Before / After Examples

### Weak vs. Strong Bullets

**Support / Ops:**
```
BEFORE: Managed customer support inbox and resolved tickets
AFTER:  Reduced support response time from 10-30 days to same-day by triaging 
        a 112-conversation backlog, maintaining inbox zero across 22 sessions
```

**Product:**
```
BEFORE: Conducted user research and shared findings with the team  
AFTER:  Surfaced a critical launch blocker through 13 user research calls — 0/3 
        external users could complete the core workflow — shifting product 
        priorities before public launch
```

**Engineering / Automation:**
```
BEFORE: Built an automation tool for the support team  
AFTER:  Eliminated manual support triage by building an AI-powered system 
        (TypeScript + Intercom API + Claude) that classifies and drafts 
        responses autonomously 3x daily
```

**Leadership / Scaling:**
```
BEFORE: Helped grow the company from a small team to a larger one
AFTER:  Scaled operational infrastructure from 15 to 80+ staff, building hiring 
        processes from scratch and resolving supply chain disruptions that 
        threatened production timelines
```

**Founder:**
```
BEFORE: Started a company and raised funding  
AFTER:  Raised $1M+ as a solo founder at 23, recruited a cross-functional team 
        of engineers, pilots, and designers, and negotiated partnerships with 
        Tesla, Siemens, and Rolls Royce before exiting in 2021
```

### Weak vs. Strong Summary

```
BEFORE: Experienced professional with a background in technology and leadership. 
        Passionate about building products and working with teams.

AFTER:  Technical founder turned product leader who ships in complex, ambiguous 
        environments. Raised $1M+ solo, scaled teams from 1 to 80+, and built 
        partnerships with Tesla, Siemens, and Rolls Royce. MSc in Computer 
        Science with a track record across AI, biotech, aerospace, and neurotech.
```

---

## Print-to-PDF Specs

If you're building a web-based resume (HTML/CSS) that prints to PDF:

### Page Setup

```css
@page {
  size: letter; /* or A4 for international */
  margin: 0.5in 0.6in;
}

@media print {
  body {
    font-size: 10pt;
    line-height: 1.35;
    color: #1a1a1a;
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
}
```

### Page Break Control

```css
/* Never break inside a job entry */
article {
  break-inside: avoid;
  page-break-inside: avoid;
}

/* Prevent orphaned headings */
h2, h3 {
  break-after: avoid;
  page-break-after: avoid;
}
```

### What Prints Well vs. What Doesn't

**Prints well:** Solid borders, background colors (with `print-color-adjust`), SVG icons, system fonts, `pt` units, high-contrast text

**Avoid for print:** Box shadows, gradients, very thin fonts (< 300 weight), transparency, complex CSS Grid (use Flexbox), `rem`/`em` units, background images, web fonts without embedding

### Semantic HTML for ATS + Accessibility

```html
<main aria-label="Resume of Your Name">
  <header>
    <h1>Your Name</h1>
    <address aria-label="Contact information">
      email | phone | location | linkedin
    </address>
  </header>
  <section aria-label="Professional Experience">
    <h2>Experience</h2>
    <article aria-label="Role at Company">
      <h3>Role Title</h3>
      <time datetime="2023-01">Jan 2023</time>
      <ul>
        <li>Achievement bullet</li>
      </ul>
    </article>
  </section>
</main>
```

---

## Handling Tricky Situations

### Short-Tenure Roles (< 6 months)

**Label it as a contract or engagement.** The word "contract" immediately signals it was time-bounded by design, not a quit/fire.

- Use "Contract" or "Engagement" in the title
- Use month format ("Feb 2026 -- Mar 2026"), not "5 weeks"
- Make the bullet so impressive the short duration becomes a feature
- Don't omit it -- it fills gaps and the work may be relevant

### Career Gaps

- Brief parenthetical if helpful: "(Career break for [reason])"
- Or just let the dates speak -- most recruiters understand gaps now
- Never over-explain on the resume. Save it for the interview if asked.

### Diverse / Non-Linear Background

This is a strength, not a weakness. But it needs explicit framing.

**In the summary:** State the throughline. Don't make the reader connect the dots. Example: "Product leader who has shipped across enterprise HR, biotech, AI developer tools, and neurotech -- specializing in translating complex technical domains into products users love."

**In each role:** Use consistent language that reinforces the thread.

**Find your throughline:**
- "Taking complex, technical products to market"
- "Building 0-to-1 in ambiguous environments"
- "Bridging technical and business stakeholders"

---

## Role-Specific Advice

### Technical Product Manager (TPM)

**Emphasize:** Technical depth + product judgment + cross-functional leadership

**Keywords:** Technical requirements, system design, API design, engineering trade-offs, technical roadmap, architecture decisions, developer experience

**Differentiator:** Show you can build AND lead. Most TPMs can't code -- if you can, that's a major signal.

### Product Manager (PM)

**Emphasize:** User empathy + business impact + stakeholder management

**Keywords:** User research, product-market fit, OKRs, roadmap prioritization, go-to-market, customer discovery, A/B testing

**Bullet pattern:** "Defined and launched [feature] that drove [X]% increase in [metric], collaborating with engineering, design, and data teams"

### AI Product Roles

**Emphasize:** Understanding of AI-specific challenges (data quality, model evaluation, user trust, iteration cycles)

**Keywords:** LLM, AI agents, prompt engineering, RAG, model evaluation, human-in-the-loop, responsible AI, generative AI

**Bullet pattern:** "Shipped AI [feature] to [X] users, designing human-in-the-loop workflows that maintained 95%+ accuracy while reducing manual review by 70%"

### Startup Generalist

**Emphasize:** Breadth, speed, ownership of ambiguous problems

**Keywords:** 0-to-1, founded, scaled, full-stack, end-to-end ownership, wore multiple hats

**Bullet pattern:** "Wore 5 hats (product, ops, hiring, support, QA) as employee #3, scaling from 0 to [X] customers in [Y] months"

### Critical Keywords for 2025/2026

**AI/ML:** LLM, Large Language Models, AI agents, prompt engineering, RAG, generative AI, model evaluation, AI safety, human-in-the-loop

**Technical PM:** System design, API, microservices, data modeling, developer experience (DX), CI/CD, observability

**Product:** Product-led growth (PLG), activation, retention, product analytics, discovery, dual-track agile, Jobs-to-be-Done (JTBD)

---

## What's In and What's Out

### In (2025/2026)

- Minimalist single-column layout
- Subtle typographic hierarchy (weight and size, not color)
- Tailored resumes per role (master + variants)
- Brief 2-3 line summary as value proposition
- Links to portfolio, GitHub, LinkedIn (as plain text URLs)
- AI-optimized keyword density
- "Key Achievements" highlight section

### Out

- Skill bars / proficiency charts (universally mocked by recruiters)
- Two-column layouts (ATS problems)
- Infographic resumes (fine for portfolios, not applications)
- Photos (US/Canada/UK -- still standard in parts of Europe/Asia)
- QR codes (gimmicky for digital submissions)
- "Creative" formatting for non-design roles
- Objective statements
- "References available upon request"

---

## Resources

### Books
- **Cracking the PM Interview** -- Gayle Laakmann McDowell & Jackie Bavaro
- **Cracking the Coding Interview** -- Gayle Laakmann McDowell (resume chapter)
- **Decode and Conquer** -- Lewis Lin (PM interview prep)

### Open-Source Resume Templates
- [jsonresume/resume-schema](https://github.com/jsonresume/resume-schema) -- JSON-based resume standard with dozens of themes
- [posquit0/Awesome-CV](https://github.com/posquit0/Awesome-CV) -- LaTeX-based, beautiful spacing and typography (44k+ stars)
- [WebPraktikos/universal-resume](https://github.com/WebPraktikos/universal-resume) -- HTML/CSS with Tailwind, print-optimized
- [sneas/cv-template](https://github.com/sneas/cv-template) -- Minimalist HTML/CSS designed for Chrome print-to-PDF

### Key Principles

1. One page. No exceptions for < 10 years.
2. Lead every bullet with a quantified result.
3. Mirror the job description's exact language.
4. Single column, clean formatting, ATS-safe.
5. Your resume should be scannable in 7 seconds.
6. Tailor for every application. A master + variant system is the way.

---

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. PRs welcome for:
- New resume advice or corrections
- Before/after examples
- Role-specific keyword lists
- Improvements to the Claude Code skill
- Translations

---

*Compiled April 2026. Sources include Google recruiter guidance, FAANG hiring manager surveys, Ladders eye-tracking research, ATS vendor documentation, and career coaching literature.*
