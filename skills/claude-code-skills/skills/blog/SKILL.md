---
name: blog
description: Write a short, punchy blog post for $AUTHOR_WEBSITE in the user's voice. Accepts a topic, rough notes, or a draft.
argument-hint: "<topic, rough notes, or draft text>"
---

Write a blog post for $AUTHOR_WEBSITE (Squarespace) in $AUTHOR_FULL's voice.

Input: $ARGUMENTS

## Steps

1. **Parse the input** to determine what was provided: a topic, rough notes, or a draft to polish
2. **Check Obsidian vault** for related prior work, sessions, or learnings using `search_notes` with topic keywords (try multiple keyword variations). Reference anything relevant to ground the post in real experience.
3. **Write the post** following the structure and voice rules below
4. **Slugify the title** (lowercase, hyphens, no special characters) for the filename
5. **Create the output directory** if it doesn't exist: `mkdir -p ~/Documents/Blog/`
6. **Save** as markdown to `~/Documents/Blog/<slugified-title>.md`
7. **Open the file**: `open ~/Documents/Blog/<slugified-title>.md`
8. **Print summary**: title, word count, file location

## Post Structure

- Strong hook/opening: a scene, question, or provocative statement. Never a dry lede. Never "In today's rapidly changing..." or similar throat-clearing.
- 3-5 short sections with clear H2 headers
- Specific examples and data over abstract claims. Name tools, districts, numbers, situations.
- Closing that lands: a callback to the opening, a challenge to the reader, or a sharp final thought. No generic "in conclusion" wrap-ups. No "What are your thoughts?" engagement bait.

## Voice and Style

- Simple, concise, no fluff
- Direct and practical, occasionally funny
- Grounded in real experience running a school district, not armchair commentary
- Write like someone who has actually done the thing, not someone who read about it
- Specific over general. "We cut our enrollment reconciliation from 3 hours to 20 minutes" beats "AI can save time."
- Opinions are welcome and expected. Don't hedge everything.

## Audience

School administrators, directors of schools, superintendents, and tech-savvy professionals. People who run things and don't have time for fluff. Both education leaders and techies.

## Markdown Format

Optimize for Squarespace paste:

```markdown
# Post Title

Opening paragraph...

## Section Header

Content...

## Section Header

Content...

## Final Section

Closing thought...
```

- Use `#` for the post title, `##` for section headers
- No YAML frontmatter in the output file (Squarespace doesn't need it)
- Use standard markdown: `*italic*` for emphasis where needed
- Links as `[text](url)` when referencing sources
- Code blocks with triple backticks if showing code/config

## Rules

- Never use emdashes. Use commas, semicolons, or rewrite.
- Never bold text in body paragraphs. Bold is for headers only.
- Never write generic thought-leadership fluff. No "As we navigate the ever-changing landscape..." sentences.
- Never include "What This Isn't" or other defensive framing sections.
- Always ground claims in specific experience, examples, or data.
- Target 600-1200 words unless the user specifies otherwise.
- Always save to `~/Documents/Blog/` and create the directory if it doesn't exist.
- Always open the output file when done.
- Always check Obsidian vault for related prior work before writing. Use topic keywords, try synonyms.
- If given rough notes, keep the writer's original points and examples but sharpen the structure and prose.
- If given a draft, preserve the core argument and tighten, don't rewrite from scratch.
- If given just a topic, research via Obsidian first, then write a post grounded in Jason's actual work and experience.
