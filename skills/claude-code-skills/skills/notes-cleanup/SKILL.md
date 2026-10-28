---
name: notes-cleanup
description: Clean up rough notes into polished, structured text using the author's preferred writing style.
argument-hint: "[pasted notes | file-path]"
---

Clean up messy notes (meetings, brainstorming, voice memos, etc.) into polished, structured text.

Input: $ARGUMENTS

## Step 1: Get the notes

Determine the input source:

1. If `$ARGUMENTS` is a file path (ends in .txt, .md, .docx, or looks like a path), read the file.
   - For .docx files, extract text with Python:
     ```python
     from docx import Document
     import sys
     doc = Document(sys.argv[1])
     for p in doc.paragraphs:
         print(p.text)
     ```
   - For .txt or .md files, use the Read tool.
2. If `$ARGUMENTS` contains the actual note text (or is empty), use what was provided.
3. If no input at all, ask the user to paste their notes or provide a file path.

## Step 2: Clean up the notes

Transform the raw notes into clean, structured text following these rules:

### Structure
- Add a descriptive title as an H2 heading (infer from content)
- If a date is mentioned or can be inferred, include it in the title or as a subtitle
- Group related items under H3 subheadings
- Use bullet points for individual items, sub-bullets for details
- Keep a flat hierarchy, two levels max (bullets and sub-bullets)

### Writing style
- Simple, concise, no fluff
- Fix typos, spelling errors, and grammar issues
- Convert fragments and shorthand into clean, complete phrases (not necessarily full sentences, bullets can be concise)
- No bold text except headers/subheaders
- No emdashes. Use commas or rewrite the sentence.
- No emoji unless present in the original
- Active voice preferred
- Keep it direct and practical

### Content rules
- Preserve ALL factual content. Every name, number, date, and detail from the original must appear in the output.
- Do NOT add information that isn't in the original notes
- Do NOT speculate or interpret beyond what's written
- Keep proper nouns, acronyms, and jargon exactly as stated
- If something is ambiguous or unclear, keep the original wording and add "[unclear]" next to it
- Merge duplicate points that say the same thing differently
- Reorder for logical flow (group related topics together)

### Specific patterns to handle
- Voice memo artifacts ("um", "uh", "like", "you know") - remove them
- Run-on thoughts - break into separate bullets
- ALL CAPS emphasis - convert to normal case (headers get their own emphasis)
- Excessive punctuation (!!!, ???, ...) - normalize
- Abbreviations - expand on first use if the audience might not know them, keep as-is for common ones (FYI, ASAP, etc.)

## Step 3: Output the result

- Display the cleaned notes as markdown directly in the response
- If the input was from a file, also offer to save the cleaned version:
  - .md file: save to the same directory with `-clean` suffix
  - .docx file: mention that the user can copy the output or ask to save as .md
  - .txt file: save to the same directory with `-clean` suffix

## Rules

- Never lose information. If in doubt, keep it.
- Don't over-organize. If the notes are short (under 10 items), a single flat bullet list with a title is fine. Don't force subheadings on three bullets.
- Don't add meta-commentary like "Here are your cleaned notes:" - just output the clean notes directly.
- If the notes are already clean and well-structured, say so and make only minor tweaks.
- For meeting notes specifically: preserve who said what, any decisions made, and action items. Put action items in their own section at the end if there are any.
