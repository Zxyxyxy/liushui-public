---
name: image-prep
description: Batch-prep photos for communications (newsletters, decks, websites). Resize and compress for web, strip EXIF/GPS metadata before publishing, watermark with your logo, or build a contact sheet. Activate when the user says "/image-prep", "optimize these photos", "prep photos for the newsletter", "resize images for web", "strip geotags", "remove metadata from these photos", "watermark these photos", or "make a contact sheet".
---

# Image Prep

Batch image toolkit for communications work. Wraps `~/.claude/skills/image-prep/imgprep.py`
(Pillow + macOS `sips` for HEIC). Originals are NEVER modified; every command writes
new files to `~/Desktop/Image Prep/<command>/`.

Requirements: Python 3 with Pillow (`pip install Pillow`). HEIC support uses macOS `sips`
(built in); on other platforms install `pillow-heif` or convert HEIC first.

Script: `~/.claude/skills/image-prep/imgprep.py`.

## Pick the command from intent

1. "optimize / resize / prep for newsletter or website / make smaller" -> `web`
   - Resizes to a max long edge, compresses, and strips metadata.
   - `python3 imgprep.py web <files-or-folder> [--max 1600] [--quality 85]`
   - 1600px is a good web default. For email-heavy use try `--max 1200`.

2. "strip geotags / remove metadata / make publish-safe / scrub location" -> `strip`
   - Removes EXIF + GPS but keeps full resolution. Use before posting photos publicly.
   - `python3 imgprep.py strip <files-or-folder>`
   - This matters for privacy: phone photos carry GPS coordinates.

3. "watermark / add the logo / brand these photos" -> `watermark`
   - Overlays a logo in a corner; auto knocks out the logo's white background.
   - `python3 imgprep.py watermark <files-or-folder> [--pos br|bl|tr|tl] [--scale 0.16] [--opacity 0.85]`
   - Set the `WATERMARK_LOGO` env var to your logo PNG, or pass `--logo PATH`.
     Example: `export WATERMARK_LOGO="$ONEDRIVE_WORK/Branding/logo.png"`.

4. "contact sheet / montage / overview of a folder of photos" -> `contact`
   - Builds a labeled thumbnail grid PNG.
   - `python3 imgprep.py contact <folder> [--cols 4] [--thumb 320]`

## Steps

1. Find the photos. If the user did not give a path, check `~/Desktop`, `~/Downloads`,
   and the relevant project folder.
2. Run the matching command with `python3 ~/.claude/skills/image-prep/imgprep.py <cmd> ...`.
3. Report the output folder (`~/Desktop/Image Prep/<cmd>/`) and the count processed.
4. For anything headed to a public website, newsletter, or social, ALWAYS run `strip`
   (or `web`, which also strips) first. Never publish raw phone photos with GPS intact.

## Notes

- HEIC (iPhone) inputs are auto-converted to JPEG via `sips`. No extra dependencies on macOS.
- Inputs can be individual files or a whole folder (one level, image types only).
- Supported: jpg, jpeg, png, webp, tiff, bmp, gif, heic, heif.
- Add a recurring preset by editing argparse defaults in the script.
- Privacy: this tool only formats images, it does not judge content. Apply your own
  photo-release rules before publishing images of identifiable people.
