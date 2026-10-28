#!/usr/bin/env python3
"""
Image Toolkit for comms (newsletters, board decks, website)
-----------------------------------------------------------
Batch-prep photos without ever touching the originals. Every command writes
new files into a separate output folder.

Commands:
  web        resize for web + compress + strip metadata (newsletters, site)
  strip      remove EXIF/GPS metadata only, keep full resolution (publish-safe)
  watermark  overlay your organization's logo in a corner
  contact    build a contact-sheet montage of a folder of photos

Examples:
  imgprep.py web ~/Desktop/event-photos
  imgprep.py web photo1.jpg photo2.heic --max 1200
  imgprep.py strip ~/Desktop/board-photos          # kill geotags before publishing
  imgprep.py watermark ~/Desktop/photos --pos br
  imgprep.py contact ~/Desktop/event-photos --cols 4

Originals are never modified. Output defaults to ~/Desktop/Image Prep/<command>/.
HEIC (iPhone) files are converted via macOS `sips` automatically.
"""

import argparse
import datetime as dt
import os
import subprocess
import sys
import tempfile

from PIL import Image, ImageDraw, ImageFont, ImageOps

IMG_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".tiff", ".tif", ".bmp", ".gif"}
HEIC_EXTS = {".heic", ".heif"}
# Set the WATERMARK_LOGO env var to your logo PNG, or pass --logo on the command line.
DEFAULT_LOGO = os.environ.get(
    "WATERMARK_LOGO", os.path.expanduser("~/logo.png")
)


def default_out(command):
    base = os.path.expanduser(f"~/Desktop/Image Prep/{command}")
    os.makedirs(base, exist_ok=True)
    return base


def gather_inputs(paths):
    """Expand files and directories into a flat list of image paths."""
    out = []
    for p in paths:
        p = os.path.expanduser(p)
        if os.path.isdir(p):
            for name in sorted(os.listdir(p)):
                fp = os.path.join(p, name)
                if os.path.isfile(fp) and os.path.splitext(name)[1].lower() in (IMG_EXTS | HEIC_EXTS):
                    out.append(fp)
        elif os.path.isfile(p):
            out.append(p)
        else:
            print(f"  skip (not found): {p}")
    return out


def load_image(path):
    """Open an image, converting HEIC via sips first. Returns (PIL.Image, ok)."""
    ext = os.path.splitext(path)[1].lower()
    if ext in HEIC_EXTS:
        tmp = tempfile.NamedTemporaryFile(suffix=".jpg", delete=False)
        tmp.close()
        r = subprocess.run(
            ["sips", "-s", "format", "jpeg", path, "--out", tmp.name],
            capture_output=True, text=True,
        )
        if r.returncode != 0:
            print(f"  skip (HEIC convert failed): {os.path.basename(path)}")
            return None, tmp.name
        try:
            img = Image.open(tmp.name)
            img.load()
            return img, tmp.name
        except Exception as e:
            print(f"  skip ({e}): {os.path.basename(path)}")
            return None, tmp.name
    try:
        img = Image.open(path)
        img.load()
        return img, None
    except Exception as e:
        print(f"  skip ({e}): {os.path.basename(path)}")
        return None, None


def save_clean(img, dest, quality):
    """Save WITHOUT carrying any EXIF/metadata. Re-encoding drops geotags."""
    img = ImageOps.exif_transpose(img)  # honor orientation, then forget it
    ext = os.path.splitext(dest)[1].lower()
    if ext in (".jpg", ".jpeg"):
        if img.mode in ("RGBA", "P", "LA"):
            img = img.convert("RGB")
        img.save(dest, "JPEG", quality=quality, optimize=True)  # no exif= -> stripped
    elif ext == ".png":
        img.save(dest, "PNG", optimize=True)  # no pnginfo= -> stripped
    elif ext == ".webp":
        img.save(dest, "WEBP", quality=quality)
    else:
        img.save(dest)


def out_name(src, out_dir, force_ext=None):
    base = os.path.basename(src)
    stem, ext = os.path.splitext(base)
    if force_ext:
        ext = force_ext
    # HEIC outputs become .jpg
    if ext.lower() in HEIC_EXTS:
        ext = ".jpg"
    return os.path.join(out_dir, stem + ext)


def cmd_web(args):
    out_dir = args.out or default_out("web")
    files = gather_inputs(args.inputs)
    if not files:
        print("No images found.")
        return
    print(f"Web-prep: {len(files)} image(s) -> {out_dir}")
    n = 0
    for src in files:
        img, tmp = load_image(src)
        if img is None:
            if tmp:
                _rm(tmp)
            continue
        img = ImageOps.exif_transpose(img)
        img.thumbnail((args.max, args.max), Image.LANCZOS)
        dest = out_name(src, out_dir)
        save_clean(img, dest, args.quality)
        print(f"  ok {os.path.basename(dest)}  {img.size[0]}x{img.size[1]}")
        n += 1
        if tmp:
            _rm(tmp)
    print(f"Done: {n} image(s). Metadata stripped, max {args.max}px, q{args.quality}.")


def cmd_strip(args):
    out_dir = args.out or default_out("strip")
    files = gather_inputs(args.inputs)
    if not files:
        print("No images found.")
        return
    print(f"Strip metadata (full res): {len(files)} image(s) -> {out_dir}")
    n = 0
    for src in files:
        img, tmp = load_image(src)
        if img is None:
            if tmp:
                _rm(tmp)
            continue
        dest = out_name(src, out_dir)
        save_clean(img, dest, 95)
        print(f"  ok {os.path.basename(dest)}")
        n += 1
        if tmp:
            _rm(tmp)
    print(f"Done: {n} image(s). EXIF/GPS removed, resolution unchanged.")


def cmd_watermark(args):
    out_dir = args.out or default_out("watermark")
    logo_path = os.path.expanduser(args.logo)
    if not os.path.exists(logo_path):
        print(f"Logo not found: {logo_path}")
        return
    logo_master = Image.open(logo_path).convert("RGBA")
    # If the logo is effectively opaque (white-box branding asset), knock out
    # near-white pixels so it sits cleanly on a photo. --keep-bg disables this.
    alpha_min = min(logo_master.getchannel("A").getextrema())
    if not args.keep_bg and alpha_min > 250:
        px = logo_master.load()
        w0, h0 = logo_master.size
        for yy in range(h0):
            for xx in range(w0):
                r, g, b, a = px[xx, yy]
                if r > 240 and g > 240 and b > 240:
                    px[xx, yy] = (r, g, b, 0)
    files = gather_inputs(args.inputs)
    if not files:
        print("No images found.")
        return
    print(f"Watermark ({os.path.basename(logo_path)}, {args.pos}): "
          f"{len(files)} image(s) -> {out_dir}")
    n = 0
    for src in files:
        img, tmp = load_image(src)
        if img is None:
            if tmp:
                _rm(tmp)
            continue
        img = ImageOps.exif_transpose(img).convert("RGBA")
        w, h = img.size
        target_w = max(1, int(w * args.scale))
        ratio = target_w / logo_master.width
        logo = logo_master.resize((target_w, int(logo_master.height * ratio)), Image.LANCZOS)
        # apply opacity
        if args.opacity < 1.0:
            alpha = logo.split()[3].point(lambda a: int(a * args.opacity))
            logo.putalpha(alpha)
        pad = int(min(w, h) * 0.03)
        lw, lh = logo.size
        positions = {
            "br": (w - lw - pad, h - lh - pad),
            "bl": (pad, h - lh - pad),
            "tr": (w - lw - pad, pad),
            "tl": (pad, pad),
        }
        pos = positions.get(args.pos, positions["br"])
        img.alpha_composite(logo, pos)
        dest = out_name(src, out_dir, force_ext=".png" if os.path.splitext(src)[1].lower() == ".png" else ".jpg")
        save_clean(img, dest, 90)
        print(f"  ok {os.path.basename(dest)}")
        n += 1
        if tmp:
            _rm(tmp)
    print(f"Done: {n} watermarked image(s).")


def cmd_contact(args):
    files = gather_inputs(args.inputs)
    if not files:
        print("No images found.")
        return
    out_dir = args.out or default_out("contact")
    cols = args.cols
    thumb = args.thumb
    pad = 12
    label_h = 22
    rows = (len(files) + cols - 1) // cols
    cell_w = thumb + pad
    cell_h = thumb + pad + label_h
    sheet_w = cols * cell_w + pad
    sheet_h = rows * cell_h + pad
    sheet = Image.new("RGB", (sheet_w, sheet_h), "white")
    draw = ImageDraw.Draw(sheet)
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial.ttf", 12)
    except OSError:
        font = ImageFont.load_default()
    print(f"Contact sheet: {len(files)} image(s), {cols} cols -> {out_dir}")
    for i, src in enumerate(files):
        img, tmp = load_image(src)
        if img is None:
            if tmp:
                _rm(tmp)
            continue
        img = ImageOps.exif_transpose(img).convert("RGB")
        img.thumbnail((thumb, thumb), Image.LANCZOS)
        r, c = divmod(i, cols)
        x = pad + c * cell_w + (thumb - img.size[0]) // 2
        y = pad + r * cell_h + (thumb - img.size[1]) // 2
        sheet.paste(img, (x, y))
        name = os.path.basename(src)
        if len(name) > 26:
            name = name[:23] + "..."
        draw.text((pad + c * cell_w, pad + r * cell_h + thumb + 4), name, fill="black", font=font)
        if tmp:
            _rm(tmp)
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M%S")
    dest = os.path.join(out_dir, f"contact-sheet-{stamp}.png")
    sheet.save(dest, "PNG", optimize=True)
    print(f"Done: {dest}")


def _rm(path):
    try:
        os.remove(path)
    except OSError:
        pass


def main():
    ap = argparse.ArgumentParser(description="Image Toolkit for comms")
    sub = ap.add_subparsers(dest="cmd", required=True)

    w = sub.add_parser("web", help="resize + compress + strip metadata")
    w.add_argument("inputs", nargs="+")
    w.add_argument("--max", type=int, default=1600, help="max long edge px (default 1600)")
    w.add_argument("--quality", type=int, default=85, help="JPEG/WEBP quality (default 85)")
    w.add_argument("--out", help="output folder")
    w.set_defaults(func=cmd_web)

    s = sub.add_parser("strip", help="remove EXIF/GPS only, keep full resolution")
    s.add_argument("inputs", nargs="+")
    s.add_argument("--out", help="output folder")
    s.set_defaults(func=cmd_strip)

    m = sub.add_parser("watermark", help="overlay your logo")
    m.add_argument("inputs", nargs="+")
    m.add_argument("--logo", default=DEFAULT_LOGO, help="logo PNG (or set WATERMARK_LOGO env var)")
    m.add_argument("--scale", type=float, default=0.16, help="logo width as fraction of image (default 0.16)")
    m.add_argument("--opacity", type=float, default=0.85, help="0-1 (default 0.85)")
    m.add_argument("--pos", default="br", choices=["br", "bl", "tr", "tl"], help="corner (default br)")
    m.add_argument("--keep-bg", action="store_true", help="keep logo's white background (skip knockout)")
    m.add_argument("--out", help="output folder")
    m.set_defaults(func=cmd_watermark)

    c = sub.add_parser("contact", help="build a contact-sheet montage")
    c.add_argument("inputs", nargs="+")
    c.add_argument("--cols", type=int, default=4, help="columns (default 4)")
    c.add_argument("--thumb", type=int, default=320, help="thumbnail px (default 320)")
    c.add_argument("--out", help="output folder")
    c.set_defaults(func=cmd_contact)

    args = ap.parse_args()
    args.func(args)


if __name__ == "__main__":
    main()
