# claude-skill-pdf

A [Claude Code](https://docs.anthropic.com/en/docs/claude-code) skill that converts Markdown files to professionally styled PDFs.

Uses **pandoc** + **weasyprint** with customizable CSS templates. Supports CJK (Chinese/Japanese/Korean) characters, tables, code blocks, batch conversion, and multiple templates.

## Quick Start

### Install the skill

```bash
# Copy to your Claude Code skills directory
cp -r . ~/.claude/skills/pdf/
```

### Use in Claude Code

```
/pdf report.md
/pdf report.md --template minimal
/pdf *.md --template report
```

### Use standalone (without Claude Code)

```bash
bash scripts/md2pdf.sh report.md
bash scripts/md2pdf.sh --template minimal report.md
bash scripts/md2pdf.sh *.md
```

## Prerequisites

| Tool | Install |
|------|---------|
| [pandoc](https://pandoc.org/) | `brew install pandoc` |
| [weasyprint](https://weasyprint.org/) | `pip3 install --user weasyprint` |

## Templates

| Name | Description |
|------|-------------|
| `report` | Professional report — dark table headers, zebra striping, page numbers **(default)** |
| `minimal` | Clean, lightweight — GitHub-style tables, no decorative accents |
| `branded-example` | Shows how to add a branded footer (customize for your org) |

### Custom templates

Drop any `.css` file into `~/.claude/skills/pdf/templates/` and reference it by name:

```
/pdf report.md --template my-custom
```

Or pass a direct path:

```
/pdf report.md --template ./path/to/custom.css
```

### Project-level overrides

If your project has `comms/templates/<name>.css`, it takes priority over the bundled template. This lets different projects use different branding without modifying the skill.

## Options

| Flag | Description |
|------|-------------|
| `--template`, `-t` | Template name or `.css` file path (default: `report`) |
| `--output`, `-o` | Output PDF path (default: `~/Desktop/<filename>.pdf`; single file only) |
| `--title` | Document title for HTML metadata (default: filename) |

## Batch Mode

Convert multiple files at once:

```bash
# Via Claude Code
/pdf *.md

# Via shell script
bash scripts/md2pdf.sh --template report chapter1.md chapter2.md chapter3.md
```

Output includes a summary table:

```
=== Batch Conversion Summary ===
Status File                                               Size
------ -------------------------------------------------- ----
OK     ~/Desktop/chapter1.pdf                             245K
OK     ~/Desktop/chapter2.pdf                             180K
OK     ~/Desktop/chapter3.pdf                             312K

Total: 3 succeeded, 0 failed out of 3 files.
```

## Directory Structure

```
claude-skill-pdf/
├── SKILL.md              # Skill definition (Claude Code reads this)
├── README.md             # This file
├── scripts/
│   └── md2pdf.sh         # Standalone shell script
├── templates/
│   ├── report.css        # Professional report (default)
│   ├── minimal.css       # Clean, minimal
│   └── branded-example.css  # Branded footer example
└── examples/
    └── sample.md         # Demo input with tables, CJK, code blocks
```

## CJK Font Support

The templates include a font stack with CJK fallbacks:

- **macOS**: PingFang SC, Hiragino Sans GB
- **Windows**: Microsoft YaHei
- **Linux**: WenQuanYi Micro Hei

If Chinese/Japanese/Korean characters appear garbled, ensure at least one of these fonts is installed on your system.

## Comparison with Alternatives

| Feature | claude-skill-pdf | weasyprint-only approaches |
|---------|-----------------|---------------------------|
| Conversion engine | pandoc → HTML → weasyprint | weasyprint directly |
| CSS templates | Separate files, swappable | Usually hardcoded |
| Project-local override | Yes | No |
| Batch conversion | Yes, with summary | Varies |
| Standalone script | Yes (`md2pdf.sh`) | No |
| CJK support | Built-in font stack | Manual setup |
| Markdown extensions | Full pandoc support | Limited |

## License

MIT
