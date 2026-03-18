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

# ── Mission Data ─────────────────────────────────────────────────────────────
MISSIONS = [
    # Reflex Rush
    {"pack":"Reflex Rush","num":1,"title":"Flash Catch","age":"3+","players":"2","time":"45s",
     "steps":["Stand about 6 feet (2 big steps) apart.","Make quick, soft throws.","Catch fast and reset."],
     "win":"Catch as many times as you can in 45 seconds!",
     "safety":"Keep throws below face level.","tip":"Go slower for younger kids."},
    {"pack":"Reflex Rush","num":2,"title":"Go / Stop Catch","age":"4+","players":"2-3","time":"60s",
     "steps":['Throw only when someone says "GO".','Freeze when someone says "STOP".','Continue until timer ends.'],
     "win":"Try for no drops during STOP.","safety":"Freeze means no throwing.","tip":"Great for attention + control."},
    {"pack":"Reflex Rush","num":3,"title":"Clap-Then-Catch","age":"6+","players":"2","time":"60s",
     "steps":["Throw gently.","Catcher claps once, then catches.","Switch roles after 10 throws."],
     "win":"10 clean catches each wins.","safety":"If it feels hard, remove the clap.","tip":"Start with slow throws."},
    {"pack":"Reflex Rush","num":4,"title":"Switch Hands","age":"6+","players":"2","time":"90s",
     "steps":["Catch with right hand.","Next catch with left hand.","Alternate every throw."],
     "win":"First to 12 clean catches wins.","safety":"Keep distance steady.","tip":"Builds both-hand coordination."},
    {"pack":"Reflex Rush","num":5,"title":"Freeze & Catch","age":"4+","players":"2","time":"60s",
     "steps":["After each catch, freeze 2 seconds.","Then throw back softly.","Repeat."],
     "win":"No moving during freeze = win.","safety":"No running.","tip":"Simple indoor/outdoor game."},
    {"pack":"Reflex Rush","num":6,"title":"Echo Count","age":"3+","players":"2","time":"60s",
     "steps":["Throw and say the number aloud.","Catcher repeats the number.","Then throws back."],
     "win":"Try to reach 15 in a row.","safety":"Stay calm if mistakes happen.","tip":"Adds memory + focus."},
    # Aim Master
    {"pack":"Aim Master","num":7,"title":"Target Ladder","age":"4+","players":"2","time":"90s",
     "steps":["Mark the paddle center with any small household object -- a coin, hair clip, or piece of folded paper.",
              "Start close (about 5 feet) and aim for the mark.","After 5 hits, step back one big step."],
     "win":"Get 8 hits in 12 throws.","safety":"Keep throws below face level.","tip":"Big mark first, then smaller."},
    {"pack":"Aim Master","num":8,"title":"Ring Landing","age":"4+","players":"1-2","time":"90s",
     "steps":["Mark a circle on the floor using a shoelace, belt, or a few small objects.",
              "Throw so the ball lands inside the circle.","Catcher lets it bounce once, then catches."],
     "win":"Make 5 ring land-and-catches.","safety":"Use a soft ball only.","tip":"Keep the ring 3-6 feet away."},
    {"pack":"Aim Master","num":9,"title":"Distance Ladder","age":"5+","players":"2","time":"120s",
     "steps":["Start about 3 feet apart and make 3 clean catches.",
              "Step back half a big step and repeat.","Stop at about 10 feet max."],
     "win":"Reach 10 feet with 3 clean catches.","safety":"Stop if throws get wild.","tip":"Smooth, gentle arcs only."},
    {"pack":"Aim Master","num":10,"title":"Step-Throw-Back","age":"6+","players":"2","time":"90s",
     "steps":["Step forward once.","Throw softly.","Step back and repeat."],
     "win":"10 clean throws wins.","safety":"Keep below face level.","tip":"Adds body control."},
    {"pack":"Aim Master","num":11,"title":"Slow Arc","age":"3+","players":"2","time":"90s",
     "steps":["Throw high and slow.","Catcher waits calmly.","Catch with both hands if needed."],
     "win":"10 slow catches wins.","safety":"No rushing.","tip":"Perfect for younger kids."},
    {"pack":"Aim Master","num":12,"title":"Gate Pass","age":"6+","players":"2","time":"120s",
     "steps":["Place any two household objects (shoes, cups, or books) one paddle-width apart as a gate.",
              "Throw through the gate at chest-low height.","Catcher catches and throws back."],
     "win":"Complete 10 clean gate passes.","safety":"Keep throws soft and low.","tip":"Closer gate for younger kids."},
    # Focus Control
    {"pack":"Focus Control","num":13,"title":"Quiet Count","age":"4+","players":"2","time":"120s",
     "steps":["No talking challenge.","After each catch, show the number with fingers.",
              "Keep throws soft and steady."],
     "win":"Reach 12 clean catches in silence.","safety":"Take short breaks if needed.","tip":"Great for calm focus."},
    {"pack":"Focus Control","num":14,"title":"Slow-Fast Switch","age":"4+","players":"2","time":"90s",
     "steps":["Do 5 slow throws.","Do 5 medium throws.","Repeat once."],
     "win":"Finish 20 throws with no drops.","safety":"Keep feet planted.","tip":"Slow first, then steady."},
    {"pack":"Focus Control","num":15,"title":"Eyes on Ball","age":"3+","players":"2","time":"90s",
     "steps":['Catcher says "I SEE IT".','Throw gently.','Catcher catches and repeats.'],
     "win":"Reach 15 clean catches.","safety":"Keep distance stable.","tip":"Builds tracking skill."},
    {"pack":"Focus Control","num":16,"title":"Count-3 Catch","age":"4+","players":"2","time":"90s",
     "steps":["Thrower counts 1-2-3.","Throw on 3.","Catcher catches and counts back."],
     "win":"Complete 10 timed catches.","safety":"Keep the count steady.","tip":"Use a calm voice."},
    {"pack":"Focus Control","num":17,"title":"Mirror Moves","age":"6+","players":"2","time":"120s",
     "steps":["Player A chooses a simple, safe pose.",
              "Player B copies, then both return to ready.","Throw and catch."],
     "win":"Complete 8 pose-and-catch rounds.","safety":"Pick balance-safe poses.","tip":"Keep it simple."},
    {"pack":"Focus Control","num":18,"title":"Count to Ten","age":"3+","players":"2","time":"90s",
     "steps":["Count every clean catch.","If you drop, restart.","Try again."],
     "win":"Reach 10 clean catches.","safety":"No stress, just retry.","tip":"Classic confidence builder."},
    # Team Duo
    {"pack":"Team Duo","num":19,"title":"Circle Pass","age":"4+","players":"3-6","time":"3min",
     "steps":["Make a small circle.","Pass to anyone (not same person twice).","Keep it gentle."],
     "win":"Play for 2 full minutes with as few drops as possible.",
     "safety":"Keep space between kids.","tip":"Perfect party mode."},
    {"pack":"Team Duo","num":20,"title":"Relay Pass","age":"5+","players":"4+","time":"3min",
     "steps":["Make two lines (two teams).","Pass down the line.",
              "After your pass, crab-walk to the back."],
     "win":"Reach 20 passes together.","safety":"No running if indoors.","tip":"Keep throws low."},
    {"pack":"Team Duo","num":21,"title":"Call the Catcher","age":"6+","players":"3+","time":"150s",
     "steps":["Choose a captain for 3 throws.","Captain calls the next catcher by name.",
              "Switch captain every 3 throws."],
     "win":"Complete 12 clean called throws.","safety":"Keep voices friendly.","tip":"Everyone gets a turn."},
    {"pack":"Team Duo","num":22,"title":"Quick Return","age":"6+","players":"3-5","time":"180s",
     "steps":["If a ball drops, the nearest player picks it up.",
              "Make a short soft return pass.","Keep a team count."],
     "win":"10 quick returns wins.","safety":"No diving on hard floors.","tip":"Use short, soft passes."},
    {"pack":"Team Duo","num":23,"title":"Partner Swap","age":"6+","players":"4+","time":"3min",
     "steps":["Play 6 catches with a partner.","Then swap partners.","Repeat."],
     "win":"Try for the most clean swaps.","safety":"Swap calmly, no pushing.","tip":"Keeps everyone included."},
    {"pack":"Team Duo","num":24,"title":"2v2 Team Count","age":"6+","players":"4","time":"4min",
     "steps":["Two teams of two.","Each team does 5 clean catches, then switch.",
              "Add all catches to one total."],
     "win":"Reach 40 total team catches.","safety":"Keep it friendly.","tip":"Celebrate every clean catch."},
    # Indoor Compact
    {"pack":"Indoor Compact","num":25,"title":"Sitting Catch","age":"3+","players":"2","time":"120s",
     "steps":["Sit on the floor or a chair.","Short throws only.","Catch with both hands."],
     "win":"15 clean catches wins.","safety":"No standing jumps.","tip":"Perfect for small spaces."},
    {"pack":"Indoor Compact","num":26,"title":"Doorway Distance","age":"4+","players":"2","time":"90s",
     "steps":["Stand about 3 feet (1 big step) apart.","Throw softly.","No stepping forward."],
     "win":"12 clean catches wins.","safety":"Keep balls away from lamps.","tip":"Safe indoor rule."},
    {"pack":"Indoor Compact","num":27,"title":"Signal Catch","age":"4+","players":"2-3","time":"120s",
     "steps":["Use a simple hand signal before each throw.",
              "Throw only after the signal.","Catcher signals back before returning."],
     "win":"Complete 10 clean signal catches.","safety":"Signals should be easy.","tip":"Keep throws low."},
    {"pack":"Indoor Compact","num":28,"title":"Wall Rally","age":"5+","players":"1","time":"120s",
     "steps":["Stand about 2 feet from a clear wall.",
              "Toss the ball gently against the wall.",
              "Catch the rebound on your paddle and repeat."],
     "win":"10 clean wall catches in a row.",
     "safety":"Soft tosses only -- no hard throws at the wall.",
     "tip":"Move closer to make it easier; step back to challenge yourself."},
    {"pack":"Indoor Compact","num":29,"title":"No-Run Rule","age":"3+","players":"2","time":"120s",
     "steps":["Both players keep feet planted.","Soft toss only.","Catch and return."],
     "win":"20 clean catches wins.","safety":"If it gets wild, slow down.","tip":"Safe default mode."},
    {"pack":"Indoor Compact","num":30,"title":"Color Call Catch","age":"5+","players":"2","time":"90s",
     "steps":["Mark the left and right sides of the paddle with any small household object -- a coin or hair clip on each side.",
              "Caller says Left or Right before the throw.","Catcher aims for that side."],
     "win":"Score 8 correct side hits.","safety":"Use soft tosses only.","tip":"Switch caller every 5 throws."},
    # Beach/Park
    {"pack":"Beach/Park","num":31,"title":"Sky Toss","age":"4+","players":"2","time":"60s",
     "steps":["Stand about 6 feet (2 big steps) apart.",
              "Throw high up into the open sky.",
              "Catcher watches and catches on the way down."],
     "win":"10 sky catches wins.",
     "safety":"Throw up, never directly at each other.",
     "tip":"Open skies make ball tracking much easier -- great starter."},
    {"pack":"Beach/Park","num":32,"title":"Grass Glide","age":"4+","players":"2","time":"90s",
     "steps":["Find a flat patch of grass.",
              "Thrower rolls or skips the ball along the ground toward the catcher.",
              "Catcher stops it with the paddle face-down."],
     "win":"5 clean grass stops wins.",
     "safety":"Only on flat, clear ground -- no holes or rocks.",
     "tip":"Try different power levels to find the sweet spot."},
    {"pack":"Beach/Park","num":33,"title":"Wind Detective","age":"6+","players":"2","time":"120s",
     "steps":["Feel the wind direction together before you start.",
              "Thrower tilts the throw slightly into the wind.",
              "Catcher adjusts their position to match the drift."],
     "win":"8 wind-adjusted catches wins.",
     "safety":"Skip this one if wind is very strong.",
     "tip":"Teaches real-world ball physics -- why does it curve?"},
    {"pack":"Beach/Park","num":34,"title":"Run & Catch","age":"5+","players":"2","time":"120s",
     "steps":["Thrower tosses the ball ahead of the catcher.",
              "Catcher runs to meet it.","Catch before it hits the ground."],
     "win":"7 running catches wins.",
     "safety":"No throwing too far -- keep it catchable.",
     "tip":"Flat open ground only; agree on the run zone first."},
    {"pack":"Beach/Park","num":35,"title":"Around the World","age":"6+","players":"2","time":"150s",
     "steps":["Make a soft throw to your partner.",
              "Receiver passes it back around their back.",
              "Switch roles every 3 throws."],
     "win":"Complete 8 around-the-back returns.",
     "safety":"Use gentle throws only.",
     "tip":"Laugh it off when you miss -- that's the game!"},
    {"pack":"Beach/Park","num":36,"title":"Long Rally","age":"4+","players":"2","time":"3min",
     "steps":["Start close and keep a rally going together.",
              "After every 5 clean catches, each player steps one big step back.",
              "See how far apart you can get."],
     "win":"Reach 20 catches without a drop.",
     "safety":"Stop stepping back when throws start getting wild.",
     "tip":"Try to beat your distance record every session."},
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
    c.drawCentredString(pw / 2, 24, "jumvigames.com")


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
    c.drawCentredString(PAGE_W / 2, 0.3 * inch, f"jumvigames.com  |  Page {page_num}")


# ── Main PDF builder ──────────────────────────────────────────────────────────
def build_pdf():
    c = pdfcanvas.Canvas(OUTPUT_PATH, pagesize=LETTER)
    c.setTitle("JUMVI Mission Book")
    c.setAuthor("jumvigames.com")
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
