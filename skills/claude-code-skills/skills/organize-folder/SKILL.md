---
name: organize-folder
description: Create a folder organizer script and clickable .command file for any directory. Use when the user asks to organize, clean up, or sort files in a folder.
argument-hint: [folder-path]
disable-model-invocation: true
---

Create a folder organization system for the target directory: $ARGUMENTS

## What to build

1. **A zsh organizer script** saved to `~/Scripts/organize_<foldername>.sh`
2. **A clickable `.command` file** placed inside the target folder that calls the script

## Script requirements

Follow this proven pattern from the existing organizers:

- Use `#!/bin/zsh`
- Log actions to `~/Library/Logs/organize_<foldername>.log`
- Create category subfolders based on file extensions
- Only move **loose files** — never move existing subdirectories
- Skip hidden files (dotfiles)
- Skip the `Organize.command` file itself
- Skip files currently being downloaded (`.crdownload`, `.part`, `.download`)
- Handle duplicate filenames by appending `_1`, `_2`, etc.
- Keep log file trimmed to last 1000 lines
- Print a summary when done

## Category mappings

Use these defaults, but adjust based on the folder's actual contents:

| Category | Extensions |
|----------|-----------|
| Documents/PDFs | pdf |
| Documents/Word_Docs | docx, doc, rtf, odt, pages, txt |
| Spreadsheets | xlsx, xls, ods, numbers, csv |
| Presentations | pptx, ppt, keynote, odp |
| Images | png, jpg, jpeg, heic, webp, gif, bmp, tiff, svg, ico |
| Audio_Video | mp4, m4a, mp3, wav, mov, avi, mkv, m4v, flac, aac |
| Archives | zip, gz, tar, rar, 7z, dmg, pkg, iso |
| Code | py, ipynb, js, ts, sh, command, html, htm, css, swift, java, c, cpp, h, rb, php |
| Data | json, xml, sql, db, sqlite, csv |
| Other | everything else |

## Steps

1. **Read the target folder** contents first to understand what's there
2. **Tailor the categories** to what actually exists (e.g., a folder full of PDFs and spreadsheets doesn't need a Code category)
3. **Write the organizer script** to `~/Scripts/`
4. **Write the `.command` file** to the target folder
5. **Make both executable** with `chmod +x`
6. **Run the script** and show the user what was moved
7. **Verify** by listing the folder after organizing

## Reference: existing organizers

- `~/Scripts/organize_downloads.sh` — Downloads folder organizer
- `~/Scripts/organize_documents.sh` — Documents folder organizer

Match the style and structure of these scripts.
