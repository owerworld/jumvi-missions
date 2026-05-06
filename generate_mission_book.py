#!/usr/bin/env python3
"""
JUMVI Mission Book PDF Generator
Generates a polished 36-mission book for the JUMVI Toss & Catch Paddle Set.
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
import os

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

OUTPUT_PATH = "/Users/ramo/Desktop/jumvi-missions/mission-book.pdf"

PAGE_W, PAGE_H = LETTER
MARGIN = 0.5 * inch
USABLE_W = PAGE_W - 2 * MARGIN
USABLE_H = PAGE_H - 2 * MARGIN

# ── Mission Data (data.js v3 ile uyumlu — US-friendly mission isimleri) ─────
MISSIONS = [
    # Lightning Hands (Reflex Rush) — 6
    {"pack":"Reflex Rush","num":1,"title":"Speed Demon","age":"3+","players":"2","time":"45s",
     "steps":["Stand 2 big-kid steps apart.","Throw fast — but soft.","Catch and reset — go again!"],
     "win":"Catch as many as you can in 45 seconds — beat your best!",
     "safety":"Throw under chin level — never aim at faces.",
     "tip":"Tiny humans? Slow it down — fun first, speed later!"},
    {"pack":"Reflex Rush","num":2,"title":"Red Light, Green Light","age":"4+","players":"2-3","time":"60s",
     "steps":["GREEN LIGHT — throw and catch normally.","RED LIGHT — FREEZE! No throwing, no moving.","Keep going until the timer ends."],
     "win":"Make it through 60 seconds with zero RED LIGHT throws.",
     "safety":"Freeze means freeze — no sneaky moves.",
     "tip":"Best part? Trying not to laugh during the freeze."},
    {"pack":"Reflex Rush","num":3,"title":"Quick Slap","age":"6+","players":"2","time":"60s",
     "steps":["Partner throws gently.","Quick slap your free hand on the paddle once.","Then turn and catch! Switch every 10 throws."],
     "win":"10 clean slap-catches each side wins.",
     "safety":"Hold the handle tight — only the free hand slaps.",
     "tip":"Find a rhythm: throw → SLAP → catch — repeat!"},
    {"pack":"Reflex Rush","num":4,"title":"Switcharoo","age":"6+","players":"2","time":"90s",
     "steps":["Start with your strong hand on the paddle.","After each catch, pass to your other hand.","Catch with the new hand. Alternate every throw!"],
     "win":"First to 12 alternating catches wins.",
     "safety":"Take the handoff slow — no fumbling.",
     "tip":"Strong hand = the one you write with. Start there!"},
    {"pack":"Reflex Rush","num":5,"title":"Statue Mode","age":"4+","players":"2","time":"60s",
     "steps":["Catch the ball — then FREEZE for 2 seconds.","No moving — paddle, body, feet — all stone.","Then throw it back."],
     "win":"10 catches with a full freeze between each.",
     "safety":"Truly no moving during the freeze.",
     "tip":"Try a silly statue pose — funnier every time!"},
    {"pack":"Reflex Rush","num":6,"title":"Number Echo","age":"3+","players":"2","time":"60s",
     "steps":["Throw and shout the number out loud.","Catcher repeats the number, then throws back.","Drop it? Restart from 1."],
     "win":"Reach 15 in a row — count loud!",
     "safety":"Stay relaxed if you miss — just restart.",
     "tip":"Sneaky math practice — don't tell the kids!"},

    # Bullseye! (Aim Master) — 6
    {"pack":"Aim Master","num":7,"title":"Rainbow Throws","age":"4+","players":"2","time":"90s",
     "steps":["Stand 5 big-kid steps apart.","Every throw must arc HIGH — over both heads.","Flat throws don't count. After 5 clean arcs, step back!"],
     "win":"Beat 3 distance levels with 5 rainbows each.",
     "safety":"Soft height, not power — let gravity do the work.",
     "tip":"Picture a real rainbow — up, over, down to the paddle."},
    {"pack":"Aim Master","num":8,"title":"The Landing Pad","age":"4+","players":"2","time":"90s",
     "steps":["Thrower sends a soft, high arc.","Catcher holds the paddle FLAT and STILL — like a runway.","The ball must STICK on its own — no swinging!"],
     "win":"8 perfect landings wins.",
     "safety":"Don't swat — let the velcro do the work.",
     "tip":"The only mission where you do NOTHING and win!"},
    {"pack":"Aim Master","num":9,"title":"Step-Back Challenge","age":"5+","players":"2","time":"120s",
     "steps":["Start 1 big step apart, get 3 clean catches.","Step back half a step — repeat.","Climb the ladder up to 3 big steps apart!"],
     "win":"Reach the top with 3 clean catches at max distance.",
     "safety":"Stop if throws start going wild.",
     "tip":"Soft arcs only — power isn't the win here."},
    {"pack":"Aim Master","num":10,"title":"Power Step","age":"5+","players":"2","time":"90s",
     "steps":["Start 6 big-kid steps apart.","Step FORWARD as you throw — like a real athlete!","Catch, then step back to start. Partner's turn!"],
     "win":"10 clean step-throws each.",
     "safety":"Throw soft — the step adds power on its own.",
     "tip":"This is how pro pitchers and quarterbacks throw!"},
    {"pack":"Aim Master","num":11,"title":"Sky Floater","age":"3+","players":"2","time":"90s",
     "steps":["Throw it as high and SLOW as you can.","Catcher waits patiently — no rushing!","Let the ball drift down to the paddle."],
     "win":"10 patient sky catches.",
     "safety":"Slow and patient wins — no swinging.",
     "tip":"Calm-down time after a wild day? This one's perfect."},
    {"pack":"Aim Master","num":12,"title":"Heart-High","age":"6+","players":"2","time":"120s",
     "steps":["Stand 6 big-kid steps apart.","Every throw must hit the catcher's CHEST.","Catcher holds paddle at chest as a target. Too high or low = miss!"],
     "win":"10 chest-height catches in a row.",
     "safety":"Aim for the paddle, not the person.",
     "tip":"Picture a bullseye where the paddle is — aim there!"},

    # Zen Mode (Focus Control) — 6
    {"pack":"Focus Control","num":13,"title":"Silent Mode","age":"4+","players":"2","time":"120s",
     "steps":["Total silence — no talking AT ALL.","Show the count with your fingers after each catch.","Anyone speaks? Restart from 1!"],
     "win":"Reach 12 catches in pure silence.",
     "safety":"Take a breath before each throw.",
     "tip":"Surprisingly hard — and weirdly fun!"},
    {"pack":"Focus Control","num":14,"title":"Tempo Master","age":"4+","players":"2","time":"90s",
     "steps":["5 super-slow throws.","5 medium-speed throws.","Repeat one cycle. Feet stay PLANTED!"],
     "win":"Finish all 20 throws — no drops.",
     "safety":"Feet planted — only arms move.",
     "tip":"Like switching gears in a song — slow first, then build!"},
    {"pack":"Focus Control","num":15,"title":"Spotlight Eyes","age":"3+","players":"2","time":"90s",
     "steps":["Before catching, shout: I SEE IT!","Partner throws after they hear you.","Catch, say I SEE IT again, throw back."],
     "win":"Reach 15 spotlight catches.",
     "safety":"Keep the same distance — no surprises.",
     "tip":"Saying it out loud helps the eyes lock on first!"},
    {"pack":"Focus Control","num":16,"title":"1 — 2 — 3 — GO!","age":"4+","players":"2","time":"90s",
     "steps":["Thrower counts 1 — 2 — 3 out loud.","Ball flies on 3, exactly!","Catcher counts 1 — 2 — 3 back, then throws."],
     "win":"10 perfectly-timed catches.",
     "safety":"Calm count, steady rhythm.",
     "tip":"Real athletes call this 'tempo' — pro skill unlocked!"},
    {"pack":"Focus Control","num":17,"title":"Mirror Mode","age":"6+","players":"2","time":"120s",
     "steps":["Thrower holds the paddle in a position (high, low, tilted).","Catcher copies the EXACT same position.","Throw happens after the mirror! Switch every 5."],
     "win":"8 mirror-and-catch rounds.",
     "safety":"Keep poses comfortable — no awkward stretches.",
     "tip":"Try silly positions — surprise your partner!"},
    {"pack":"Focus Control","num":18,"title":"Count to 10","age":"3+","players":"2","time":"90s",
     "steps":["Count every clean catch out loud TOGETHER.","Drop = restart from 1.","No pressure — just try again!"],
     "win":"Reach 10 catches with no drops.",
     "safety":"Stress-free zone — restarting is part of the game.",
     "tip":"Best first mission for tiny humans — confidence builder!"},

    # Team Up (Team Duo) — 6
    {"pack":"Team Duo","num":19,"title":"Round Robin","age":"4+","players":"3-6","time":"3min",
     "steps":["Stand in a circle, each holding a paddle.","Throw to ANYONE — but never twice in a row to the same person!","Keep all throws gentle."],
     "win":"2 full minutes — count drops, beat your record!",
     "safety":"Stay spaced out — no crowding.",
     "tip":"4 paddles + 4 players = ultimate party mode!"},
    {"pack":"Team Duo","num":20,"title":"Crab Walk Relay","age":"5+","players":"4+","time":"3min",
     "steps":["Two lines facing each other.","Pass the ball down your line — catch & pass.","After your turn, crab-walk to the back!"],
     "win":"Both lines hit 20 passes together.",
     "safety":"Walk or crab-walk only — no running.",
     "tip":"Slow and silly — short throws keep it safe!"},
    {"pack":"Team Duo","num":21,"title":"Captain Says","age":"6+","players":"3+","time":"150s",
     "steps":["Pick a captain for 3 throws.","Captain calls out a teammate's name, then throws to them.","That person catches! Switch captain every 3."],
     "win":"12 clean called catches.",
     "safety":"Friendly voices — no fake-outs!",
     "tip":"Make sure everyone gets a turn as captain!"},
    {"pack":"Team Duo","num":22,"title":"Spin Squad","age":"6+","players":"4","time":"3min",
     "steps":["4 players in a square, each with a paddle.","One player throws to anyone.","EVERYONE steps clockwise after each catch — then throw again!"],
     "win":"20 catches with full team rotations.",
     "safety":"Rotate calm — no bumping!",
     "tip":"Shout SPIN! after each catch to keep the squad moving!"},
    {"pack":"Team Duo","num":23,"title":"Mix It Up","age":"6+","players":"4+","time":"3min",
     "steps":["Start in pairs — 6 catches together.","After 6, swap to a new partner!","Repeat until everyone's played with everyone."],
     "win":"Most clean swap cycles wins.",
     "safety":"Swap calmly — no pushing.",
     "tip":"4 paddles + 4 players makes this perfect!"},
    {"pack":"Team Duo","num":24,"title":"2v2 Squad Count","age":"6+","players":"4","time":"4min",
     "steps":["Split into 2 teams of 2.","Each team gets 5 clean catches, then the other team goes.","Add it all to ONE shared total!"],
     "win":"Reach 40 total team catches.",
     "safety":"Celebrate every clean catch — this is OUR score.",
     "tip":"Uses ALL 4 paddles at once!"},

    # Indoor Fun (Indoor Compact) — 6
    {"pack":"Indoor Compact","num":25,"title":"Chill Catch","age":"3+","players":"2","time":"120s",
     "steps":["Both players sit — floor or chair.","Short, soft throws only.","Catch from your seat — no jumping up!"],
     "win":"15 clean seated catches.",
     "safety":"No standing — calm, controlled play.",
     "tip":"Rainy day winner — also great for tired humans!"},
    {"pack":"Indoor Compact","num":26,"title":"Tiny Space","age":"4+","players":"2","time":"90s",
     "steps":["Stand just 1 big step apart.","Throw soft — no stepping forward!","Feet PLANTED the whole time."],
     "win":"12 clean catches in tiny range.",
     "safety":"Watch out for lamps and shelves.",
     "tip":"No-step rule = every catch is a real win."},
    {"pack":"Indoor Compact","num":27,"title":"Secret Signal","age":"4+","players":"2-3","time":"120s",
     "steps":["Pick a secret hand signal together.","Thrower flashes the signal, then throws.","Catcher signals back, then returns. No signal = no throw!"],
     "win":"10 secret signal catches.",
     "safety":"Keep signals simple — easy to spot.",
     "tip":"Make up your own family secret signal!"},
    {"pack":"Indoor Compact","num":28,"title":"Mind Reader","age":"5+","players":"2","time":"120s",
     "steps":["Thrower secretly picks: LEFT, RIGHT, or CENTER.","3-second pause — no hints!","Catcher predicts and positions paddle BEFORE the throw!"],
     "win":"Predict 8 out of 12 correctly.",
     "safety":"Soft, predictable distance — surprise only the direction.",
     "tip":"Pro tip: Watch the thrower's shoulders — they always tell!"},
    {"pack":"Indoor Compact","num":29,"title":"Stuck-Foot Catch","age":"3+","players":"2","time":"120s",
     "steps":["Both players: feet stuck to the floor.","Soft tosses only.","Catch and return — no chasing!"],
     "win":"20 clean catches.",
     "safety":"If throws get wild, slow down together.",
     "tip":"The safest indoor mission — works in ANY space."},
    {"pack":"Indoor Compact","num":30,"title":"Left or Right!","age":"5+","players":"2","time":"90s",
     "steps":["Caller shouts LEFT or RIGHT before throwing.","Catcher turns paddle to that side and catches!","Wrong side = miss. Switch caller every 5."],
     "win":"Score 8 correct side catches.",
     "safety":"Throws straight and gentle — direction is the puzzle.",
     "tip":"Just paddle + ears + reflexes!"},

    # Outdoor (Beach/Park) — 6
    {"pack":"Beach/Park","num":31,"title":"Cloud Chaser","age":"4+","players":"2","time":"60s",
     "steps":["Stand 6 big-kid steps apart.","Throw the ball as HIGH as you can into the sky!","Watch it the whole way down — catch with the paddle!"],
     "win":"10 sky catches.",
     "safety":"Always throw UP — never AT each other.",
     "tip":"Open sky = easier to track — perfect outdoor starter!"},
    {"pack":"Beach/Park","num":32,"title":"Home Base","age":"4+","players":"2","time":"90s",
     "steps":["Each player picks a home base (shadow, sidewalk square, grass patch).","Throw and catch from your base — no moving feet!","Step off your base = miss."],
     "win":"10 base-only catches.",
     "safety":"Pick safe, flat ground for your base.",
     "tip":"Set bases 8-10 big steps apart for a real challenge!"},
    {"pack":"Beach/Park","num":33,"title":"How Far Can You Throw?","age":"5+","players":"2","time":"120s",
     "steps":["Start 6 big-kid steps apart.","Get 3 clean catches, then BOTH step back 2 big steps.","Keep going! Note your best distance!"],
     "win":"Beat your previous distance record.",
     "safety":"Use big arcs at long distance — flat throws fall short.",
     "tip":"Outdoor only — needs space to grow!"},
    {"pack":"Beach/Park","num":34,"title":"Chase the Ball!","age":"5+","players":"2","time":"120s",
     "steps":["Thrower tosses the ball ahead of you — not too far!","Catcher runs to meet it.","Catch with the paddle BEFORE it lands!"],
     "win":"7 running catches wins.",
     "safety":"Pick a clear run zone — no obstacles!",
     "tip":"Soft grass works best — flat ground only."},
    {"pack":"Beach/Park","num":35,"title":"Sky High Jump","age":"6+","players":"2","time":"150s",
     "steps":["Thrower aims JUST above your normal reach — not too high!","Wait for the throw — don't pre-jump!","Then JUMP and catch in the air! Switch every 5."],
     "win":"8 jump catches.",
     "safety":"Jump on flat soft ground — grass is best.",
     "tip":"The sweet spot is JUST above normal reach — not too high!"},
    {"pack":"Beach/Park","num":36,"title":"Marathon Rally","age":"4+","players":"2","time":"3min",
     "steps":["Start close together — build a rally!","After every 5 clean catches, BOTH step back one big step.","See how far you can stretch the rally!"],
     "win":"Reach 20 catches without a drop.",
     "safety":"Stop stepping back when throws get wild.",
     "tip":"Try to beat your distance every time you play!"},
]


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
def draw_cover(c, pw, ph):
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
    c.drawCentredString(pw / 2, ph / 2 + 58, "36 Fun Tossing & Catching Games for Ages 3-8")

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
    c.drawCentredString(pw / 2, by + 28, "36 MISSIONS")
    c.setFillColor(colors.HexColor("#94A3B8"))
    c.setFont("Helvetica", 9)
    c.drawCentredString(pw / 2, by + 13, "across 6 skill packs  |  Ages 3-8  |  Indoors & Outdoors")

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
PACK_INFO = {
    "Reflex Rush":    ("Missions 1-6",   "Speed, reaction time & hand-eye coordination"),
    "Aim Master":     ("Missions 7-12",  "Accuracy, distance & precision throwing"),
    "Focus Control":  ("Missions 13-18", "Concentration, breath control & steady play"),
    "Team Duo":       ("Missions 19-24", "Teamwork, communication & group fun"),
    "Indoor Compact": ("Missions 25-30", "Safe, space-friendly indoor play"),
    "Beach/Park":     ("Missions 31-36", "Outdoor adventures, nature & open-air play"),
}

def draw_pack_header(c, x, y, w, pack_name):
    pc = PACK_COLORS[pack_name]
    h  = 44
    r  = 6
    mr, tl = PACK_INFO[pack_name]

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
def build_pdf():
    c = pdfcanvas.Canvas(OUTPUT_PATH, pagesize=LETTER)
    c.setTitle("JUMVI Mission Book")
    c.setAuthor("qr.jumvi.co")
    c.setSubject("36 Fun Tossing & Catching Games for Ages 3-8")

    # ── Page 1: Cover ────────────────────────────────────────────────────────
    draw_cover(c, PAGE_W, PAGE_H)
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
    for m in MISSIONS:
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
        missions = pack["missions"]
        # Each pack: header on top, then pairs of cards
        # Pairs per page
        pairs = [(missions[i], missions[i+1] if i+1 < len(missions) else None)
                 for i in range(0, len(missions), 2)]

        # We fit: header + 1 pair per page (header only on first page of pack)
        first_page = True

        for pair_idx, (left_m, right_m) in enumerate(pairs):
            # White background
            c.setFillColor(colors.white)
            c.rect(0, 0, PAGE_W, PAGE_H, fill=1, stroke=0)

            cursor = PAGE_H - MARGIN  # top of content area

            if first_page:
                draw_pack_header(c, MARGIN, cursor, USABLE_W, pack["name"])
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
    print(f"PDF written to: {OUTPUT_PATH}")
    print(f"Total pages: {page_num - 1}")


if __name__ == "__main__":
    build_pdf()
