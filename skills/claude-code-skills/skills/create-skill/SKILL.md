---
name: create-skill
description: Autonomously build, test, and validate a new Claude Code skill from a natural language description.
argument-hint: "<description of the skill you want>"
---

Build a new Claude Code skill from the user's description. Handles the full lifecycle: scaffold, test, fix, validate, report.

Skill description: $ARGUMENTS

## Overview

You are a meta-skill that autonomously creates new Claude Code skills. You will:
1. Parse the user's description to determine skill type and requirements
2. Create the skill file with proper structure
3. Generate a pytest test suite
4. Run tests, fix failures (up to 3 iterations)
5. Validate the skill is loadable
6. Generate a validation report
7. Present the finished skill only after all checks pass

## Step 1: Parse the Description

Analyze `$ARGUMENTS` to determine:

- **Skill name**: derive a short kebab-case slug (e.g., "budget-report", "meeting-notes")
- **Skill type**: determine if this should be a full skill (`~/.claude/skills/<name>/SKILL.md`) or a simple command (`~/.claude/commands/<name>.md`). Use a skill for anything with embedded Python, agent teams, or complex logic. Use a command for simple prompt-based workflows (like research templates).
- **Output format**: what does the skill produce? (.docx, .xlsx, .pptx, .md, .pdf, .csv, or text output)
- **Key behaviors**: what specific actions, transformations, or analyses does it perform?
- **Input requirements**: what arguments does it need?
- **Edge cases**: empty input, missing directories, missing files, invalid arguments

If the description is too vague to build a working skill, use AskUserQuestion to clarify before proceeding. Otherwise, make reasonable assumptions and note them.

## Step 2: Create the Team

```
TeamCreate with team_name: "create-skill-<name>"
```

Create 4 tasks:
1. **Build the skill file** (builder agent)
2. **Write the test suite** (tester agent)
3. **Run tests and iterate** (coordinator — you)
4. **Generate validation report** (coordinator — you)

Set task 3 as blocked by tasks 1 and 2. Set task 4 as blocked by task 3.

## Step 3: Spawn the Builder Agent

Spawn a `general-purpose` agent named `builder` with `team_name` set. Give it these instructions:

### Builder Agent Instructions

Create a Claude Code skill at the determined path. Follow these patterns exactly:

**For skills (`~/.claude/skills/<name>/SKILL.md`):**

```yaml
---
name: <slug>
description: <one-line description>
argument-hint: "<usage hint>"
---
```

Followed by the full implementation. Reference these conventions from existing skills:

- Use `$ARGUMENTS` for the full argument string
- For Python-based skills: embed the complete Python code in the SKILL.md as fenced code blocks, with instructions to write to `/tmp/` and execute via Bash
- For document-producing skills: include the full python-docx/openpyxl/python-pptx code inline
- Steps should be numbered and explicit
- Include a "Rules" section at the end with constraints
- Author metadata: "$AUTHOR_NAME" where applicable
- Output paths: `~/Documents/` or `~/Downloads/` depending on type
- Always clean up temp files after execution
- Always open the output file with `open` command at the end
- Always print a summary report of what was created

**For commands (`~/.claude/commands/<name>.md`):**

```markdown
# Title: $ARGUMENTS

Instructions here...
```

No YAML frontmatter. Plain markdown with instructions.

**Critical rules for the builder:**
- Study the existing skills at `~/.claude/skills/` to match the style and conventions
- If the skill produces .docx files, use the python-docx + lxml comment insertion pattern from doc-review, NOT raw zipfile manipulation (unless inserting comments into existing docs, which needs the 3-file XML approach for Word 2016+ compatibility)
- If the skill produces .xlsx files, use openpyxl with proper styling (reference time-savings skill)
- If the skill produces .pptx files, use the full helper function set from the pptx skill
- Make the skill fully self-contained — no imports from custom modules
- Test the embedded Python by running it mentally for syntax correctness
- Include error handling for: file not found, missing directories (create them), invalid input

After creating the file, send the file path and a brief summary back to the coordinator.

## Step 4: Spawn the Tester Agent

Spawn a `general-purpose` agent named `tester` with `team_name` set. Give it these instructions:

### Tester Agent Instructions

Create a pytest test suite at `/tmp/test_skill_<name>.py` that validates the skill. The test suite must cover:

**1. File creation test:**
```python
def test_skill_file_exists():
    """Verify the skill file was created at the correct path."""
    assert os.path.exists(SKILL_PATH)
```

**2. Syntax validation test:**
```python
def test_skill_syntax():
    """Verify YAML frontmatter parses correctly (for skills) or markdown is valid (for commands)."""
```
- For skills: parse the YAML frontmatter, verify `name` and `description` fields exist
- For commands: verify the file starts with `# ` and contains `$ARGUMENTS`

**3. Output format tests (based on what the skill produces):**

For .docx output:
```python
def test_docx_valid():
    """Run the skill's Python code and verify the .docx is well-formed."""
    # Execute the embedded Python
    # Open with python-docx and verify it loads
    # Check paragraphs exist

def test_docx_xml_structure():
    """Verify the .docx XML is well-formed (Content_Types check)."""
    import zipfile
    with zipfile.ZipFile(output_path) as z:
        # Verify [Content_Types].xml exists and parses
        ct = z.read('[Content_Types].xml')
        from lxml import etree
        root = etree.fromstring(ct)
        assert root.tag.endswith('Types')
        # Verify word/document.xml exists and parses
        doc_xml = z.read('word/document.xml')
        doc_root = etree.fromstring(doc_xml)
        assert doc_root is not None
```

For .xlsx output:
```python
def test_xlsx_valid():
    """Verify the .xlsx opens with openpyxl."""
    from openpyxl import load_workbook
    wb = load_workbook(output_path)
    assert len(wb.sheetnames) > 0

def test_xlsx_content():
    """Verify expected sheets and headers exist."""
```

For .pptx output:
```python
def test_pptx_valid():
    """Verify the .pptx opens with python-pptx."""
    from pptx import Presentation
    prs = Presentation(output_path)
    assert len(prs.slides) > 0
```

For markdown/text output:
```python
def test_output_content():
    """Verify expected sections and structure."""
```

**4. Expected sections/content test:**
```python
def test_expected_sections():
    """Verify the skill file contains required sections."""
    # Check for Steps, Rules, or other expected headings
```

**5. Edge case tests:**
```python
def test_empty_input():
    """Verify skill handles empty/missing arguments gracefully."""

def test_missing_directory():
    """Verify skill creates output directories if they don't exist."""
```

**6. For .docx-producing skills specifically (REQUIRED):**
```python
def test_docx_content_types_xml():
    """Validate [Content_Types].xml to prevent the Content_Types bug."""
    import zipfile
    from lxml import etree
    with zipfile.ZipFile(output_path) as z:
        ct_bytes = z.read('[Content_Types].xml')
        root = etree.fromstring(ct_bytes)
        # Must have Override entries for document.xml
        overrides = root.findall('.//{http://schemas.openxmlformats.org/package/2006/content-types}Override')
        doc_override = [o for o in overrides if 'document.xml' in o.get('PartName', '')]
        assert len(doc_override) > 0, "Missing document.xml in [Content_Types].xml"

def test_docx_no_corrupt_relationships():
    """Verify word/_rels/document.xml.rels is well-formed."""
    import zipfile
    from lxml import etree
    with zipfile.ZipFile(output_path) as z:
        rels_bytes = z.read('word/_rels/document.xml.rels')
        root = etree.fromstring(rels_bytes)
        assert root is not None
```

**Test suite rules:**
- Use pytest fixtures for setup/teardown (create temp dirs, clean up output files)
- Each test function must have a clear docstring
- Use `/tmp/test_skill_output_<name>/` as the output directory for test runs
- Import the skill's Python code by extracting it from the SKILL.md and running via subprocess
- Tests must be runnable independently (`pytest /tmp/test_skill_<name>.py -v`)
- Do NOT test Claude's AI behavior, only test the deterministic parts (file creation, output format, Python code execution)

After creating the test file, send the file path back to the coordinator.

## Step 5: Run Tests and Iterate (Coordinator)

Once both agents report back:

1. Run the test suite:
```bash
python3 -m pytest /tmp/test_skill_<name>.py -v --tb=short 2>&1
```

2. If all tests pass, proceed to Step 6.

3. If any tests fail (iteration 1 of 3):
   - Parse the failure output
   - Send the failure details to the `builder` agent with specific fix instructions
   - Wait for the builder to fix and report back
   - Re-run the tests
   - Repeat up to 3 total iterations

4. If tests still fail after 3 iterations:
   - Generate the validation report noting the failures
   - Present what was built with warnings about known issues
   - Do NOT silently pass broken skills

## Step 6: Final Validation (Coordinator)

After tests pass:

1. **Verify file exists** at the expected path
2. **Verify YAML syntax** (for skills):
```bash
python3 -c "
import yaml
with open('SKILL_PATH') as f:
    content = f.read()
    front = content.split('---')[1]
    data = yaml.safe_load(front)
    assert 'name' in data
    assert 'description' in data
    print('YAML valid:', data['name'])
"
```
3. **Verify the skill appears** in the commands directory listing:
```bash
ls -la ~/.claude/skills/<name>/SKILL.md
```
   or
```bash
ls -la ~/.claude/commands/<name>.md
```

## Step 7: Generate Validation Report

Write `/tmp/skill_validation_report.md` with this structure:

```markdown
# Skill Validation Report

## Skill Details
- Name: <name>
- Type: skill | command
- Path: <full path>
- Output format: <format>
- Created: <timestamp>

## Test Results
| Test | Status | Notes |
|------|--------|-------|
| File exists | PASS/FAIL | |
| YAML/syntax valid | PASS/FAIL | |
| Output format correct | PASS/FAIL | |
| Expected content present | PASS/FAIL | |
| Edge cases handled | PASS/FAIL | |
| .docx XML structure | PASS/FAIL/N/A | |

## Iterations
- Iteration 1: <pass/fail summary>
- Iteration 2: <if needed>
- Iteration 3: <if needed>

## Final Status: PASSED / FAILED

## Skill Summary
<Brief description of what the skill does and how to invoke it>
```

Print the report contents to the user.

## Step 8: Cleanup and Presentation

1. Shut down teammates via `SendMessage shutdown_request`
2. `TeamDelete`
3. Clean up temp test files: `rm /tmp/test_skill_<name>.py` and test output dirs
4. Keep the validation report at `/tmp/skill_validation_report.md`
5. Tell the user:
   - The skill name and how to invoke it (e.g., `/skill-name <args>`)
   - A brief summary of what it does
   - Test results summary
   - Any assumptions made

## Rules

- Do NOT present the skill to the user until ALL validations pass (or 3 iterations exhausted with clear failure report)
- Prefer creating skills (SKILL.md with frontmatter) over commands unless the task is purely a prompt template
- Match the existing skill conventions exactly (study pptx, doc-review, time-savings as references)
- For .docx output: ALWAYS include the Content_Types.xml validation test
- For Python code in skills: use `python3` awareness but invoke as `python3`
- Output files default to `~/Documents/` (persistent) or `~/Downloads/` (ephemeral) unless the user specifies otherwise
- Author metadata: "$AUTHOR_NAME"
- Keep the skill concise but complete. Don't over-engineer.
- If the builder creates Python code, it must be fully self-contained (no custom module imports)
- The tester must create tests that can actually execute the Python portions of the skill in isolation
- Test iteration loop: max 3 attempts, then report honestly about remaining failures
