#!/usr/bin/env python3
"""
JUMVI Mission Book PDF Generator
Generates a polished mission book for the JUMVI Toss & Catch Paddle Set.
Missions, packs and every printed total are read from data.js at build time.
"""

from reportlab.lib.pagesizes import LETTER
from reportlab.lib import colors
from reportlab.lib.units import inch
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.enums import TA_CENTER, TA_LEFT, TA_RIGHT
from reportlab.platypus import (
    SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle,
    PageBreak, HRFlowable, KeepTogether, Frame, PageTemplate
)
from reportlab.platypus.flowables import Flowable
from reportlab.pdfgen import canvas as pdfcanvas
from reportlab.pdfbase.pdfmetrics import stringWidth
import argparse
import json
import re
import subprocess
import sys
from pathlib import Path

# ── Colors ───────────────────────────────────────────────────────────────────
BRAND_BLUE = colors.HexColor("#4FB3FF")
DARK_BG    = colors.HexColor("#0a1628")
WHITE      = colors.white
LIGHT_GRAY = colors.HexColor("#F3F4F6")
MID_GRAY   = colors.HexColor("#9CA3AF")
DARK_GRAY  = colors.HexColor("#374151")
TEXT_BLACK = colors.HexColor("#111827")

PACK_COLORS = {
    "Reflex Rush":    colors.HexColor("#F97316"),
    "Aim Master":     colors.HexColor("#3B82F6"),
    "Focus Control":  colors.HexColor("#10B981"),
    "Team Duo":       colors.HexColor("#8B5CF6"),
    "Indoor Compact": colors.HexColor("#06B6D4"),
    "Beach/Park":     colors.HexColor("#F59E0B"),
}

REPO_ROOT = Path(__file__).resolve().parent
DEFAULT_OUTPUT = REPO_ROOT / "mission-book.pdf"

# The set ships four paddles, so no printed page may promise a fifth player.
MAX_PLAYERS = 4

PAGE_W, PAGE_H = LETTER
MARGIN = 0.5 * inch
USABLE_W = PAGE_W - 2 * MARGIN
USABLE_H = PAGE_H - 2 * MARGIN

# ── Mission data ─────────────────────────────────────────────────────────────
# Read straight out of data.js — the same file the app ships — instead of
# keeping a second copy here.
#
# The second copy is exactly how this book went stale: it was last touched in
# May 2026, so the printed page 12 still taught "Captain Says" long after the
# app had replaced mission 21 with "Middle Defender", 26 mission timers had
# been retuned, and "3+" / "4+" / "3-6" player labels had been banned for
# implying more players than the four-paddle kit holds. A parent printing this
# got a game their child could not find in the app.
#
# data.js is a plain script (no module system), so node evaluates it in a bare
# VM context and hands back JSON. That is the same trick tools/check-*.mjs use,
# and it means this book cannot drift from the app again without the checks
# below failing loudly.
def load_missions():
    reader = (
        "const fs=require('fs'),vm=require('vm');"
        "const ctx=vm.createContext({});"
        "vm.runInContext(fs.readFileSync(process.argv[1],'utf8')+'\\n;__out={missions};',ctx);"
        "process.stdout.write(JSON.stringify(ctx.__out.missions));"
    )
    data_js = REPO_ROOT / "data.js"
    try:
        raw = subprocess.run(
            ["node", "-e", reader, str(data_js)],
            capture_output=True, text=True, check=True,
        ).stdout
    except FileNotFoundError:
        sys.exit("node is required to read data.js — install Node and re-run.")
    except subprocess.CalledProcessError as err:
        sys.exit(f"could not evaluate {data_js}:\n{err.stderr.strip()}")

    missions = [
        {
            "num":     m["id"],
            "pack":    m["pack"],
            "title":   m["title"],
            "age":     m["age"],
            "players":  m["players"],
            "time":    m["time"],
            "steps":   m["steps"],
            "win":     m["win"],
            "safety":  m["safety"],
            "tip":     m["tip"],
        }
        for m in json.loads(raw)
    ]

    # Fail loudly rather than printing a book that quietly disagrees with the
    # app. Every one of these was a real defect in the shipped PDF.
    problems = []
    for m in missions:
        if m["pack"] not in PACK_COLORS:
            problems.append(f"#{m['num']} has unknown pack {m['pack']!r}")
        if "+" in str(m["players"]):
            problems.append(f"#{m['num']} player label {m['players']!r} uses '+'")
        counts = [int(n) for n in re.findall(r"\d+", str(m["players"]))]
        if counts and max(counts) > MAX_PLAYERS:
            problems.append(f"#{m['num']} player label {m['players']!r} exceeds the kit")
        for field in ("title", "win", "safety", "tip"):
            if not str(m[field]).strip():
                problems.append(f"#{m['num']} has an empty {field}")
        if not m["steps"]:
            problems.append(f"#{m['num']} has no steps")
    # Packs are drawn as contiguous chapters, so a pack must not be interleaved.
    seen = []
    for m in missions:
        if not seen or seen[-1] != m["pack"]:
            if m["pack"] in seen:
                problems.append(f"pack {m['pack']!r} is split across the list")
            seen.append(m["pack"])
    if problems:
        sys.exit("data.js failed the mission book's checks:\n  " + "\n  ".join(problems))

    return missions


# ── Text wrapping helper ──────────────────────────────────────────────────────
def wrap_text(text, font_name, font_size, max_width):
    words = text.split()
    lines, current = [], ""
    for word in words:
        test = (current + " " + word).strip()
        if stringWidth(test, font_name, font_size) <= max_width:
            current = test
        else:
            if current:
                lines.append(current)
            current = word
    if current:
        lines.append(current)
    return lines or [""]


# ── Draw helpers ──────────────────────────────────────────────────────────────
def draw_labeled_block(c, label, text, x, y, block_w, text_col, bg_col, accent_col, block_h=22):
    c.setFillColor(bg_col)
    c.roundRect(x, y - block_h + 6, block_w, block_h, 3, fill=1, stroke=0)
    c.setFillColor(accent_col)
    c.setFont("Helvetica-Bold", 6.5)
    label_str = label + ": "
    c.drawString(x + 5, y - 2, label_str)
    lw = stringWidth(label_str, "Helvetica-Bold", 6.5)
    c.setFillColor(text_col)
    c.setFont("Helvetica", 7)
    max_w = block_w - lw - 10
    wrapped = wrap_text(text, "Helvetica", 7, max_w)
    c.drawString(x + 5 + lw, y - 2, wrapped[0])
    for i, line in enumerate(wrapped[1:], 1):
        c.drawString(x + 5, y - 2 - i * 9, line)


# ── Cover page drawing ────────────────────────────────────────────────────────
def draw_cover(c, pw, ph, mission_count, pack_count):
    c.setFillColor(DARK_BG)
    c.rect(0, 0, pw, ph, fill=1, stroke=0)

    # accent bars
    c.setFillColor(BRAND_BLUE)
    c.rect(0, ph - 8, pw, 8, fill=1, stroke=0)
    c.rect(0, 0, pw, 5, fill=1, stroke=0)

    # decorative circles
    c.setFillColor(colors.HexColor("#1a2a48"))
    c.circle(pw - 60, ph - 90, 110, fill=1, stroke=0)
    c.circle(35, 70, 65, fill=1, stroke=0)

    # brand mark
    c.setFillColor(BRAND_BLUE)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(36, ph - 52, "JUMVI")

    # main title
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 40)
    c.drawCentredString(pw / 2, ph / 2 + 100, "JUMVI Mission Book")

    # underline
    lw = 220
    c.setStrokeColor(BRAND_BLUE)
    c.setLineWidth(3)
    c.line(pw/2 - lw/2, ph/2 + 88, pw/2 + lw/2, ph/2 + 88)

    # subtitle
    c.setFillColor(colors.HexColor("#CBD5E1"))
    c.setFont("Helvetica", 15)
    c.drawCentredString(pw / 2, ph / 2 + 58,
                        f"{mission_count} Fun Tossing & Catching Games for Ages 3-8")

    # pack color dots
    dot_r = 12
    pnames = list(PACK_COLORS.keys())
    total_row_w = len(pnames) * (dot_r * 2 + 14) - 14
    sx = pw / 2 - total_row_w / 2 + dot_r
    dot_y = ph / 2 + 18
    short = ["Reflex", "Aim", "Focus", "Team", "Indoor", "Beach"]
    for i, pname in enumerate(pnames):
        dx = sx + i * (dot_r * 2 + 14)
        c.setFillColor(PACK_COLORS[pname])
        c.circle(dx, dot_y, dot_r, fill=1, stroke=0)
        c.setFont("Helvetica", 6)
        c.setFillColor(colors.HexColor("#94A3B8"))
        c.drawCentredString(dx, dot_y - dot_r - 8, short[i])

    # tagline
    c.setFillColor(colors.HexColor("#94A3B8"))
    c.setFont("Helvetica", 11)
    c.drawCentredString(pw / 2, ph / 2 - 30,
                        "Boost reflexes, focus & teamwork -- one mission at a time!")

    # stat box
    bw, bh = 340, 52
    bx = pw / 2 - bw / 2
    by = ph / 2 - 108
    c.setFillColor(colors.HexColor("#1a2a48"))
    c.roundRect(bx, by, bw, bh, 8, fill=1, stroke=0)
    c.setFillColor(BRAND_BLUE)
    c.setFont("Helvetica-Bold", 22)
    c.drawCentredString(pw / 2, by + 28, f"{mission_count} MISSIONS")
    c.setFillColor(colors.HexColor("#94A3B8"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(pw / 2, by + 13,
                        f"across {pack_count} skill packs  |  Ages 3-8  |  Indoors & Outdoors")

    # website
    c.setFillColor(BRAND_BLUE)
    c.setFont("Helvetica-Bold", 12)
    c.drawCentredString(pw / 2, 24, "qr.jumvi.co")


# ── Safety page drawing ───────────────────────────────────────────────────────
def draw_safety_page(c, pw, ph, margin):
    uw = pw - 2 * margin
    top = ph - margin

    # Page title
    c.setFillColor(DARK_BG)
    c.setFont("Helvetica-Bold", 20)
    c.drawCentredString(pw / 2, top - 24, "Safety & How to Play")

    # underline
    c.setStrokeColor(BRAND_BLUE)
    c.setLineWidth(2)
    c.line(margin, top - 32, pw - margin, top - 32)

    col_w = (uw - 12) / 2
    left_x  = margin
    right_x = margin + col_w + 12
    content_top = top - 48

    # Left column — safety
    _draw_info_column(
        c, left_x, content_top, col_w,
        "SAFETY FIRST",
        colors.HexColor("#FFF7ED"),
        colors.HexColor("#F97316"),
        [
            "Always toss below face level",
            "Start 3-6 feet (1-2 meters) apart",
            "No running indoors -- keep movements controlled",
            "Adult supervision recommended for ages 3-4",
        ],
        bullet=True,
    )

    # Right column — how to play
    _draw_info_column(
        c, right_x, content_top, col_w,
        "HOW TO PLAY",
        colors.HexColor("#EFF6FF"),
        colors.HexColor("#3B82F6"),
        [
            'Pick any mission card',
            'Follow the steps together',
            'Mark it "Complete" in the JUMVI app',
            'Mix packs for balanced skill building',
        ],
        bullet=False,
        note='Scan the QR code on your paddle packaging to open the free JUMVI Missions app!',
    )

    # Footer
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#6B7280"))
    c.drawCentredString(pw / 2, margin - 10,
        "6 Skill Packs: Reflex Rush  |  Aim Master  |  Focus Control  |  Team Duo  |  Indoor Compact  |  Beach/Park")


def _draw_info_column(c, x, top, col_w, title, bg_col, accent_col, items,
                      bullet=True, note=None):
    pad = 10
    # Background box
    box_h = 220
    c.setFillColor(bg_col)
    c.roundRect(x, top - box_h, col_w, box_h, 6, fill=1, stroke=0)
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(0.5)
    c.roundRect(x, top - box_h, col_w, box_h, 6, fill=0, stroke=1)

    # Title bar
    c.setFillColor(accent_col)
    c.roundRect(x, top - 30, col_w, 30, 6, fill=1, stroke=0)
    c.rect(x, top - 30, col_w, 16, fill=1, stroke=0)
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 12)
    c.drawString(x + pad, top - 20, title)

    # Items
    y = top - 48
    for i, item in enumerate(items):
        if bullet:
            marker = "•"
            c.setFillColor(accent_col)
            c.setFont("Helvetica-Bold", 10)
            c.drawString(x + pad, y, marker)
            c.setFillColor(DARK_GRAY)
            c.setFont("Helvetica", 9)
            wrapped = wrap_text(item, "Helvetica", 9, col_w - pad * 2 - 12)
            for j, line in enumerate(wrapped):
                c.drawString(x + pad + 12, y - j * 12, line)
            y -= len(wrapped) * 12 + 6
        else:
            c.setFillColor(accent_col)
            c.setFont("Helvetica-Bold", 9)
            c.drawString(x + pad, y, str(i + 1) + ".")
            c.setFillColor(DARK_GRAY)
            c.setFont("Helvetica", 9)
            wrapped = wrap_text(item, "Helvetica", 9, col_w - pad * 2 - 14)
            for j, line in enumerate(wrapped):
                c.drawString(x + pad + 14, y - j * 12, line)
            y -= len(wrapped) * 12 + 6

    if note:
        y -= 6
        c.setFillColor(colors.HexColor("#1E40AF"))
        c.setFont("Helvetica-Oblique", 8)
        wrapped = wrap_text(note, "Helvetica-Oblique", 8, col_w - pad * 2)
        for j, line in enumerate(wrapped):
            c.drawString(x + pad, y - j * 11, line)


# ── Pack header drawing ───────────────────────────────────────────────────────
# Editorial copy only. The "Missions 7-12" half used to live here too and went
# stale the moment the catalogue moved, so it is now counted from the data.
PACK_TAGLINES = {
    "Reflex Rush":    "Speed, reaction time & hand-eye coordination",
    "Aim Master":     "Accuracy, distance & precision throwing",
    "Focus Control":  "Concentration, breath control & steady play",
    "Team Duo":       "Teamwork, communication & group fun",
    "Indoor Compact": "Safe, space-friendly indoor play",
    "Beach/Park":     "Outdoor adventures, nature & open-air play",
}

def pack_range_label(missions):
    """"Missions 7-12", counted from the pack itself rather than remembered."""
    nums = [m["num"] for m in missions]
    lo, hi = min(nums), max(nums)
    return f"Mission {lo}" if lo == hi else f"Missions {lo}-{hi}"


def draw_pack_header(c, x, y, w, pack_name, mission_range):
    pc = PACK_COLORS[pack_name]
    h  = 44
    r  = 6
    mr, tl = mission_range, PACK_TAGLINES[pack_name]

    c.setFillColor(pc)
    c.roundRect(x, y - h, w, h, r, fill=1, stroke=0)

    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 15)
    c.drawString(x + 12, y - 22, pack_name.upper())
    c.setFont("Helvetica-Bold", 8)
    c.drawString(x + 12, y - 36, mr)
    c.setFont("Helvetica-Oblique", 8)
    c.drawRightString(x + w - 12, y - 36, tl)
    return h


# ── Mission card drawing ──────────────────────────────────────────────────────
CARD_H = 3.55 * inch

def draw_mission_card(c, x, y, w, mission):
    """Draw a single mission card. y is the TOP of the card."""
    h   = CARD_H
    pc  = PACK_COLORS[mission["pack"]]
    pad = 10
    r   = 8

    # Card background + border
    c.setFillColor(colors.white)
    c.setStrokeColor(colors.HexColor("#D1D5DB"))
    c.setLineWidth(0.8)
    c.roundRect(x, y - h, w, h, r, fill=1, stroke=1)

    # Colored top bar
    bar_h = 34
    c.setFillColor(pc)
    c.setStrokeColor(pc)
    c.roundRect(x, y - bar_h, w, bar_h, r, fill=1, stroke=0)
    # Fill bottom half of rounded corners of bar
    c.rect(x, y - bar_h, w, bar_h // 2, fill=1, stroke=0)

    # Mission number badge
    badge_r = 11
    bx = x + pad + badge_r
    by = y - bar_h / 2
    c.setFillColor(colors.white)
    c.circle(bx, by, badge_r, fill=1, stroke=0)
    c.setFillColor(pc)
    c.setFont("Helvetica-Bold", 10)
    c.drawCentredString(bx, by - 3.5, str(mission["num"]))

    # Mission title
    c.setFillColor(colors.white)
    c.setFont("Helvetica-Bold", 11)
    title_x = bx + badge_r + 6
    c.drawString(title_x, by - 4, mission["title"])

    # Pack name (right side of bar, tiny)
    c.setFont("Helvetica", 6.5)
    c.drawRightString(x + w - pad, by - 3, mission["pack"].upper())

    # Info row (age / players / time)
    info_y = y - bar_h - 13
    col_w3 = (w - 2 * pad) / 3
    for i, (label, val) in enumerate([("AGE", mission["age"]),
                                        ("PLAYERS", mission["players"]),
                                        ("TIME", mission["time"])]):
        lx = x + pad + i * col_w3 + col_w3 / 2
        c.setFont("Helvetica", 6)
        c.setFillColor(colors.HexColor("#9CA3AF"))
        c.drawCentredString(lx, info_y, label)
        c.setFont("Helvetica-Bold", 8)
        c.setFillColor(TEXT_BLACK)
        c.drawCentredString(lx, info_y - 10, val)

    # Separator
    sep1_y = info_y - 19
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(0.5)
    c.line(x + pad, sep1_y, x + w - pad, sep1_y)

    # Steps section
    step_y = sep1_y - 11
    c.setFont("Helvetica-Bold", 7)
    c.setFillColor(pc)
    c.drawString(x + pad, step_y, "HOW TO PLAY")
    step_y -= 10

    for i, step in enumerate(mission["steps"], 1):
        # Numbered circle
        c.setFillColor(pc)
        c.circle(x + pad + 5, step_y + 3, 5, fill=1, stroke=0)
        c.setFillColor(colors.white)
        c.setFont("Helvetica-Bold", 5.5)
        c.drawCentredString(x + pad + 5, step_y + 1, str(i))

        c.setFillColor(TEXT_BLACK)
        c.setFont("Helvetica", 7.5)
        tx = x + pad + 14
        max_w = w - (tx - x) - pad
        wrapped = wrap_text(step, "Helvetica", 7.5, max_w)
        for j, line in enumerate(wrapped):
            c.drawString(tx, step_y - j * 9, line)
        step_y -= len(wrapped) * 9 + 3

    # Separator
    sep2_y = step_y - 3
    c.setStrokeColor(colors.HexColor("#E5E7EB"))
    c.setLineWidth(0.5)
    c.line(x + pad, sep2_y, x + w - pad, sep2_y)

    # Win / Safety / Tip blocks
    block_y = sep2_y - 11
    draw_labeled_block(c, "WIN", mission["win"],
                       x + pad, block_y, w - 2 * pad,
                       colors.HexColor("#065F46"), colors.HexColor("#D1FAE5"), pc)

    block_y -= 25
    draw_labeled_block(c, "SAFETY", mission["safety"],
                       x + pad, block_y, w - 2 * pad,
                       colors.HexColor("#92400E"), colors.HexColor("#FEF3C7"),
                       colors.HexColor("#F59E0B"))

    block_y -= 25
    draw_labeled_block(c, "TIP", mission["tip"],
                       x + pad, block_y, w - 2 * pad,
                       colors.HexColor("#1E40AF"), colors.HexColor("#DBEAFE"), BRAND_BLUE)


# ── Page number footer ────────────────────────────────────────────────────────
def draw_page_number(c, page_num):
    c.setFont("Helvetica", 8)
    c.setFillColor(colors.HexColor("#9CA3AF"))
    c.drawCentredString(PAGE_W / 2, 0.3 * inch, f"qr.jumvi.co  |  Page {page_num}")


# ── Main PDF builder ──────────────────────────────────────────────────────────
def build_pdf(missions, output_path):
    c = pdfcanvas.Canvas(str(output_path), pagesize=LETTER)
    c.setTitle("JUMVI Mission Book")
    c.setAuthor("qr.jumvi.co")
    c.setSubject(f"{len(missions)} Fun Tossing & Catching Games for Ages 3-8")

    # ── Page 1: Cover ────────────────────────────────────────────────────────
    draw_cover(c, PAGE_W, PAGE_H, len(missions), len({m["pack"] for m in missions}))
    c.showPage()

    # ── Page 2: Safety & How to Use ─────────────────────────────────────────
    c.setFillColor(colors.white)
    c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)
    draw_safety_page(c, PAGE_W, PAGE_H, MARGIN)
    draw_page_number(c, 2)
    c.showPage()

    # ── Pages 3+: Mission cards ──────────────────────────────────────────────
    page_num = 3

    # Group by pack
    packs = []
    current_pack = None
    for m in missions:
        if m["pack"] != current_pack:
            current_pack = m["pack"]
            packs.append({"name": current_pack, "missions": []})
        packs[-1]["missions"].append(m)

    CARD_GAP  = 0.18 * inch
    CARD_W    = (USABLE_W - CARD_GAP) / 2
    HDR_H     = 44
    HDR_GAP   = 8
    CARD_TOP_GAP = 6

    for pack in packs:
        pack_missions = pack["missions"]
        # Each pack: header on top, then pairs of cards
        # Pairs per page
        pairs = [(pack_missions[i], pack_missions[i+1] if i+1 < len(pack_missions) else None)
                 for i in range(0, len(pack_missions), 2)]

        # We fit: header + 1 pair per page (header only on first page of pack)
        first_page = True

        for pair_idx, (left_m, right_m) in enumerate(pairs):
            # White background
            c.setFillColor(colors.white)
            c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

            cursor = PAGE_H - MARGIN  # top of content area

            if first_page:
                draw_pack_header(c, MARGIN, cursor, USABLE_W, pack["name"],
                                 pack_range_label(pack_missions))
                cursor -= HDR_H + HDR_GAP
                first_page = False

            # Card row
            card_top = cursor - CARD_TOP_GAP
            left_x  = MARGIN
            right_x = MARGIN + CARD_W + CARD_GAP

            draw_mission_card(c, left_x, card_top, CARD_W, left_m)
            if right_m:
                draw_mission_card(c, right_x, card_top, CARD_W, right_m)

            draw_page_number(c, page_num)
            c.showPage()
            page_num += 1

    c.save()
    print(f"PDF written to: {output_path}")
    print(f"Missions: {len(missions)}  ·  Total pages: {page_num - 1}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--out", default=DEFAULT_OUTPUT, type=Path,
                        help="where to write the PDF (default: mission-book.pdf next to this script)")
    args = parser.parse_args()
    build_pdf(load_missions(), args.out)
