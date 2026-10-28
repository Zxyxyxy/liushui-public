---
name: fact-check
description: Fact-check a .docx file for internal consistency, unsourced claims, citation integrity, logical coherence, plausibility issues, and stale references. Produces an annotated copy with Word comments and a markdown summary report.
argument-hint: "[file-path] [optional: --tier2 --summary-only]"
---

Fact-check a Word document and produce an annotated copy with findings as Word comments plus a markdown summary report.

Target file: $ARGUMENTS

## Parse Arguments

Extract from `$ARGUMENTS`:
- `file_path`: the .docx file to check (required)
- `--tier2`: enable web-based checks (link verification, claim cross-referencing) [Phase 2, not yet implemented]
- `--summary-only`: skip Word comments, only produce the markdown report

If `--tier2` is passed, inform the user that Tier 2 checks are planned for a future update and proceed with Tier 1 only.

## Tier 1 Checks (Always Run)

Analyze every paragraph and table cell in the document for:

### 1. Internal Consistency
- Contradictory statistics between sections (e.g., "73% of districts" in one place, "nearly 80%" in another referring to the same metric)
- Conflicting dates, names, or figures
- Inconsistent terminology for the same concept

### 2. Unsourced Claims
- Statistics, percentages, dollar amounts, or specific numbers with no inline citation
- Attributed quotes without a source
- Specific dates or timelines presented as fact without attribution
- Exception: widely known facts and general statements do not need citations

### 3. Citation Integrity
- Every inline citation (Author, Year) or numbered reference must have a matching entry in the References/Bibliography/Works Cited section
- Every reference entry should be cited at least once in the body
- Flag orphaned citations (in-text but not in references) and orphaned references (in references but never cited)
- Check for malformed citations (missing year, missing author, etc.)

### 4. Logical Coherence
- Conclusions that don't follow from the evidence presented in that section
- Non sequiturs or logical leaps
- Claims that contradict the document's own data or tables

### 5. Plausibility Flags
- Percentages over 100% or negative percentages
- Negative counts where only positive values make sense
- Absolute claims ("all", "none", "every", "never") that are likely overstated
- Numbers that seem implausible for the context (e.g., "500% increase")

### 6. Stale References
- Sources, legislation, or policies dated more than 5 years before today's date
- Flag as INFO, not ERROR (old sources may still be valid, but worth noting)
- Exception: foundational/seminal works and historical references are expected to be older

## Analysis Approach

1. Read the entire document first to understand its structure, topic, and citation style
2. Build a list of all inline citations and all reference entries
3. Go section by section, checking each paragraph against all 6 categories
4. For each finding, record:
   - `paragraph_text`: a snippet of the paragraph (first 80 chars or the relevant sentence)
   - `search_text`: the specific text to anchor the Word comment on (the problematic phrase)
   - `category`: one of `CONSISTENCY`, `UNSOURCED`, `CITATION`, `LOGIC`, `PLAUSIBILITY`, `STALE`
   - `severity`: `ERROR`, `WARNING`, or `INFO`
   - `comment_text`: clear, actionable description of the issue

### Severity Guidelines
- ERROR: Factual contradiction, orphaned citation, percentage > 100%, conclusion contradicts own data
- WARNING: Unsourced statistic, absolute claim, logical leap, malformed citation
- INFO: Stale reference, minor inconsistency in terminology, uncited reference entry

## How to Insert Word Comments

Use this Python approach with `python-docx` and `lxml`:

```python
from docx import Document
from docx.oxml.ns import qn
from docx.oxml import OxmlElement
from lxml import etree
from docx.opc.part import Part
from docx.opc.packuri import PackURI
import os
from datetime import datetime

# 1. Build the comments XML container
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

# 2. For each comment, add to the XML and mark the paragraph
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
    """Add commentRangeStart, commentRangeEnd, and commentReference to a paragraph."""
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
        # Fallback: mark the whole paragraph
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

# 3. After all comments are built, attach the comments part to the document
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

## Output Files

### Annotated .docx (unless `--summary-only`)
- Save as `<original_name>_fact-checked.docx` in the same directory as the original
- NEVER overwrite the original file
- All comments authored by "Fact-Check Agent"
- Comment text format: `[SEVERITY] [CATEGORY] - Description of the issue`
  - Example: `[WARNING] UNSOURCED - This statistic (73% of districts) has no inline citation.`
  - Example: `[ERROR] CONSISTENCY - This says "nearly 80%" but an earlier section states "73%" for the same metric.`
  - Example: `[INFO] STALE - This source is from 2018, which is more than 5 years old.`

### Markdown summary report (always produced)
- Save as `fact_check_report.md` in the same directory as the original
- Format:

```markdown
# Fact-Check Report

**Document:** <filename>
**Date:** <today>
**Checks performed:** Tier 1 (internal analysis)

## Summary

| Severity | Count |
|----------|-------|
| ERROR    | X     |
| WARNING  | X     |
| INFO     | X     |
| **Total**| **X** |

## Findings by Category

### Internal Consistency
- [SEVERITY] <description> (Section: <heading or page context>)

### Unsourced Claims
- [SEVERITY] <description> (Section: <heading or page context>)

### Citation Integrity
- [SEVERITY] <description>

### Logical Coherence
- [SEVERITY] <description> (Section: <heading or page context>)

### Plausibility Flags
- [SEVERITY] <description> (Section: <heading or page context>)

### Stale References
- [INFO] <source> dated <year> (Section: <heading or page context>)

## Notes
<Any context about the document type, citation style used, or caveats about the analysis>
```

## Steps

1. **Resolve the file path** - verify it exists and is a valid .docx
2. **Read the document** - load with python-docx, extract all paragraphs and table cells
3. **Map document structure** - identify headings, sections, references section
4. **Build citation index** - extract all inline citations and all reference entries
5. **Run Tier 1 checks** - analyze each section against all 6 check categories
6. **Collect findings** - build the list of `{paragraph_text, search_text, category, severity, comment_text}`
7. **Generate markdown report** - write `fact_check_report.md`
8. **Insert Word comments** (unless `--summary-only`) - build comments XML, add markers, attach to document
9. **Save annotated copy** as `<name>_fact-checked.docx`
10. **Open in Word** using `open -a "Microsoft Word" "<path>"` (the annotated copy, not the original)
11. **Report to user** - summary of findings by category and severity

## Rules

- Author name on all comments: "Fact-Check Agent"
- Date on comments: use today's date in ISO format (e.g., 2026-03-11T00:00:00Z)
- Search both paragraphs AND table cells for issues
- If no issues found in a category, note "No issues found" in the markdown report for that category
- Be conservative: only flag clear issues. When in doubt, use INFO severity rather than WARNING/ERROR
- Do not flag stylistic preferences, only factual/logical issues
- Do not rewrite or edit the document text, only insert comments
- Ensure python-docx and lxml are installed before running
- For very long documents (100+ paragraphs), consider using agent teams similar to doc-review (split by check category)
