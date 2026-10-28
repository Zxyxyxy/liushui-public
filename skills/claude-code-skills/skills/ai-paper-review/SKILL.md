---
name: ai-paper-review
description: Review a student's "AI Leading and Learning" paper and insert Word comments with rubric-based feedback. For university Educational Leadership courses.
argument-hint: "[file-path]"
---

Review a student paper and insert Word comments with substantive feedback tied to the assignment rubric.

Target file: $ARGUMENTS

## Supported Assignments

### ai-leading-learning (default)
**AI: Leading and Learning** — 8-10 page APA 7th edition paper with five pillars.

#### Five Pillars to Evaluate

1. **Define & Contextualize**: Does the paper define AI in the K-12 landscape? Does it go beyond "what it is" to explain "why it matters" for school improvement and instructional leadership?

2. **Research & Policy Review**: Are there at least five scholarly or credible sources synthesized (not just summarized)? Does it address AI's impact on learning outcomes, teacher workload, and data privacy?

3. **Instructional Leadership Analysis**: Are AI implementation strategies explicitly connected to TILS Standards A-D? Are specific standard indicators cited, not just general references?

4. **Risks & Ethical Considerations**: Does the paper critically examine algorithmic bias, the digital divide in access, and student data protection under FERPA?

5. **Evidence-Based Recommendations**: Are there 3-5 actionable strategies? Are they aligned with a school mission? Do they promote equitable student success? Are they grounded in the research reviewed earlier in the paper?

#### Criteria for Success (comment on these)

- **APA Formatting**: Correct citations, headings (Level 1 and 2), running head, references page, 12pt Times New Roman or similar, double spacing, 1-inch margins
- **Critical Synthesis**: Is the student comparing and contrasting perspectives, or just summarizing sources one by one?
- **Standard Alignment**: Are connections between AI strategies and specific TILS/PSEL indicators clear and explicit?
- **Actionability**: Are recommendations realistic and grounded in the research reviewed, or generic/aspirational?
- **Page Length**: Is the paper within the 8-10 page requirement (not counting title page and references)?

## Comment Categories

When reviewing, organize feedback into these categories and prefix each comment accordingly:

- **[Strength]** — Something done well; reinforce good practice
- **[Content]** — Missing content, shallow treatment, or factual issues
- **[Synthesis]** — Where the student is summarizing instead of synthesizing; suggest how to compare/contrast
- **[TILS]** — Missing or weak connections to specific TILS Standards A-D; note which standard applies
- **[APA]** — Formatting, citation, or reference errors
- **[Evidence]** — Claims made without supporting citations, or recommendations not grounded in the reviewed research
- **[Ethics]** — Gaps in the risks/ethical analysis (bias, digital divide, FERPA)
- **[Clarity]** — Writing quality issues: awkward phrasing, vague language, unclear arguments
- **[Typo]** — Spelling or grammar errors

## TILS Standards Reference (for evaluating Pillar 3)

Use these when checking standard alignment:

- **Standard A: Instructional Leadership for Continuous Improvement** — Focus on high-quality instruction, data-driven decisions, curriculum alignment, and continuous improvement processes
- **Standard B: Culture for Teaching and Learning** — Establishing a culture of high expectations, equity, and professional growth for all stakeholders
- **Standard C: Professional Learning and Growth** — Leading professional development, fostering collaborative learning communities, and supporting teacher growth
- **Standard D: Resource Management** — Strategic allocation of fiscal, human, and technological resources to support the school's mission

## Agent Teams Strategy

For comprehensive reviews, use agent teams to parallelize pillar evaluation:

### Team Setup

1. **Create the team**: `TeamCreate` with `team_name: "paper-review"`.
2. **Read the document first** to extract all paragraph text and identify section boundaries.
3. **Create 3 tasks** via `TaskCreate`:
   - **Content reviewer**: Evaluate Pillars 1-3 (Define & Contextualize, Research & Policy Review, Instructional Leadership Analysis). Check for synthesis vs. summary and TILS standard connections.
   - **Ethics reviewer**: Evaluate Pillars 4-5 (Risks & Ethical Considerations, Evidence-Based Recommendations). Check recommendations are actionable and research-grounded.
   - **Format reviewer**: Check APA formatting, typos, grammar, page length, and source count (minimum 5 scholarly sources).
4. **Spawn 3 teammates** via `Agent` tool with `team_name: "paper-review"`, names: `content-reviewer`, `ethics-reviewer`, `format-reviewer`. Use `subagent_type: "general-purpose"`. Launch all in a single message.
5. **Pass document content and paragraph indices** to each teammate so they can return precise locations.
6. Each teammate reviews its assigned areas and returns comments: `{para_index, search_text, comment_text, category}`.
7. **Coordinator merges all comments**, inserts into the document using the technique below, and saves.
8. **Shut down teammates** and `TeamDelete`.

## Technical Implementation

Use the same Word comment insertion technique as the `doc-review` skill:

```python
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from lxml import etree
from docx.opc.part import Part
from docx.opc.packuri import PackURI

# Build comments XML container
comments_xml = '''<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:comments xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas"
            xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006"
            xmlns:o="urn:schemas-microsoft-com:office:office"
            xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"
            xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math"
            xmlns:v="urn:schemas-microsoft-com:vml"
            xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing"
            xmlns:w10="urn:schemas-microsoft-com:office:word"
            xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"
            xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml">
</w:comments>'''
comments_element = etree.fromstring(comments_xml.encode('utf-8'))

def add_comment_to_xml(comments_element, comment_id, author, date_str, text):
    comment = etree.SubElement(comments_element, qn('w:comment'))
    comment.set(qn('w:id'), str(comment_id))
    comment.set(qn('w:author'), author)
    comment.set(qn('w:date'), date_str)
    p = etree.SubElement(comment, qn('w:p'))
    r = etree.SubElement(p, qn('w:r'))
    t = etree.SubElement(r, qn('w:t'))
    t.text = text
    t.set(qn('xml:space'), 'preserve')

def add_comment_markers(paragraph, search_text, comment_id):
    found = False
    for run in paragraph.runs:
        if search_text.lower() in (run.text or "").lower():
            comment_start = OxmlElement('w:commentRangeStart')
            comment_start.set(qn('w:id'), str(comment_id))
            run.element.addprevious(comment_start)
            comment_end = OxmlElement('w:commentRangeEnd')
            comment_end.set(qn('w:id'), str(comment_id))
            run.element.addnext(comment_end)
            ref_run = OxmlElement('w:r')
            ref_rpr = OxmlElement('w:rPr')
            ref_style = OxmlElement('w:rStyle')
            ref_style.set(qn('w:val'), 'CommentReference')
            ref_rpr.append(ref_style)
            ref_run.append(ref_rpr)
            comment_ref = OxmlElement('w:commentReference')
            comment_ref.set(qn('w:id'), str(comment_id))
            ref_run.append(comment_ref)
            comment_end.addnext(ref_run)
            found = True
            break
    if not found:
        p_element = paragraph._element
        comment_start = OxmlElement('w:commentRangeStart')
        comment_start.set(qn('w:id'), str(comment_id))
        p_element.insert(0, comment_start)
        comment_end = OxmlElement('w:commentRangeEnd')
        comment_end.set(qn('w:id'), str(comment_id))
        p_element.append(comment_end)
        ref_run = OxmlElement('w:r')
        ref_rpr = OxmlElement('w:rPr')
        ref_style = OxmlElement('w:rStyle')
        ref_style.set(qn('w:val'), 'CommentReference')
        ref_rpr.append(ref_style)
        ref_run.append(ref_rpr)
        comment_ref = OxmlElement('w:commentReference')
        comment_ref.set(qn('w:id'), str(comment_id))
        ref_run.append(comment_ref)
        p_element.append(ref_run)

def attach_comments_part(doc, comments_element):
    comments_bytes = etree.tostring(comments_element, xml_declaration=True, encoding='UTF-8', standalone=True)
    doc_part = doc.part
    existing = None
    for rel in doc_part.rels.values():
        if 'comments' in rel.reltype:
            existing = rel
            break
    if existing:
        existing.target_part._blob = comments_bytes
    else:
        comments_part = Part(
            PackURI('/word/comments.xml'),
            'application/vnd.openxmlformats-officedocument.wordprocessingml.comments+xml',
            comments_bytes,
            doc_part.package
        )
        doc_part.relate_to(comments_part, 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/comments')
```

## Steps

1. **Locate and load the file** — resolve the path, verify it's a valid .docx
2. **Read the full document** — extract all paragraph text to understand structure and content
3. **Identify the paper's sections** — map which paragraphs correspond to each of the five pillars
4. **Evaluate each pillar** against the rubric criteria:
   - Note strengths to reinforce
   - Identify gaps, shallow treatment, or missing elements
   - Check for synthesis vs. summary
   - Verify TILS standard connections are explicit and specific
   - Confirm recommendations are actionable and research-grounded
5. **Check APA formatting** — headings, in-text citations, reference formatting
6. **Check for typos and grammar issues**
7. **Count sources** — verify at least 5 scholarly/credible sources are used
8. **Check page length** — estimate based on paragraph count (roughly 25-30 paragraphs per page of double-spaced text)
9. **Build and insert all comments** at specific locations in the document
10. **Save the file** (overwrite in place unless user requests a copy)
11. **Open in Word** using `open -a "Microsoft Word" "<path>"`
12. **Report summary** — total comment count broken down by category, overall assessment of which pillars are strong and which need work

## Rules

- Author name on all comments: "$AUTHOR_NAME"
- Date: use today's date in ISO format
- Be constructive and specific — every critique should include direction on how to improve
- Start with strengths before addressing weaknesses
- Do NOT rewrite the student's work in comments — point them toward what to fix and why
- Flag when a student is summarizing a source rather than synthesizing it with other sources
- When a TILS connection is weak, name the specific standard and indicator that applies
- Note if recommendations are generic ("schools should use AI") vs. actionable ("implement a monthly AI tool pilot program with teacher feedback surveys")
- Always check both paragraphs and tables for content
- If the paper has fewer than 5 sources, flag it explicitly
- If the paper is significantly under or over page length, note it
