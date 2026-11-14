"""Builds templates/faar-template.pptx, the FAAR TRACE fills in.

Run from the repository root:  python3 templates/build-faar-template.py
Needs python-pptx. Edit this script, not the .pptx, so the design stays in one
place. Fill-in markers (see js/reports.js):
  {{KEY}}            text, e.g. {{UNIT}}
  {{SEQ:list:role}}  a paragraph repeated once per item of a list, with {{.field}}
  Slides holding {{T_NAME}} are the topic pattern: TRACE repeats them, in
  order, once per discussion topic.
"""
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.dml import MSO_LINE_DASH_STYLE
from pptx.oxml.ns import qn
from lxml import etree

BG = RGBColor(0xFA, 0xF9, 0xF6)
CARD = RGBColor(0xEE, 0xEC, 0xE5)
WHITE = RGBColor(0xFF, 0xFF, 0xFF)
INK = RGBColor(0x1C, 0x24, 0x29)
MUTED = RGBColor(0x5A, 0x63, 0x6A)
GOLD = RGBColor(0xC7, 0x9A, 0x2E)       # rules and accents
GOLD_INK = RGBColor(0x7A, 0x5C, 0x12)   # gold text on the light background
CALLOUT = RGBColor(0xF2, 0xC1, 0x4E)    # question bars, dark text on top
NIGHT = RGBColor(0x14, 0x1A, 0x1F)      # footer band
HFONT = "Bahnschrift SemiBold Condensed"
BFONT = "Segoe UI"

W, H = Inches(13.333), Inches(7.5)
M = Inches(0.6)
CW = W - 2 * M
TOP = Inches(1.45)         # content starts under the header
BOTTOM = H - Inches(0.55)  # content ends above the footer band

prs = Presentation()
prs.slide_width, prs.slide_height = W, H
BLANK = prs.slide_layouts[6]


def rect(slide, x, y, w, h, color, line=None):
    s = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x, y, w, h)
    s.fill.solid()
    s.fill.fore_color.rgb = color
    if line:
        s.line.color.rgb = line
    else:
        s.line.fill.background()
    s.shadow.inherit = False
    return s


def bullet(para, color="C79A2E"):
    pPr = para._p.get_or_add_pPr()
    pPr.set("marL", str(Inches(0.3)))
    pPr.set("indent", str(-Inches(0.26)))
    bc = etree.SubElement(pPr, qn("a:buClr"))
    etree.SubElement(bc, qn("a:srgbClr")).set("val", color)
    etree.SubElement(pPr, qn("a:buFont")).set("typeface", "Arial")
    etree.SubElement(pPr, qn("a:buChar")).set("char", "•")


def text(slide, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP, cols=1):
    """paras: (text, size, color, font, bold, opts); opts: bullet, space_before, align, line."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.05)
    tf.margin_top = tf.margin_bottom = Inches(0.03)
    if cols > 1:
        tf._txBody.bodyPr.set("numCol", str(cols))
        tf._txBody.bodyPr.set("spcCol", str(Inches(0.4)))
    for i, p in enumerate(paras):
        t, size, color, font, bold = p[:5]
        opts = p[5] if len(p) > 5 else {}
        para = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        r = para.add_run()
        r.text = t
        r.font.size = Pt(size)
        r.font.color.rgb = color
        r.font.name = font
        r.font.bold = bold
        if opts.get("space_before") is not None:
            para.space_before = Pt(opts["space_before"])
        para.line_spacing = opts.get("line", 1.1)
        if opts.get("align"):
            para.alignment = opts["align"]
        if opts.get("bullet"):
            bullet(para)
    return tb


def base(title=None, kicker=None):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    s.shapes.add_picture("img/first-army.png", W - Inches(1.05), Inches(0.18), height=Inches(0.8))
    if kicker:
        text(s, M, Inches(0.2), Inches(10.5), Inches(0.35), [(kicker, 13, GOLD_INK, HFONT, True)])
    if title:
        text(s, M, Inches(0.42) if kicker else Inches(0.25), Inches(11.2), Inches(0.75),
             [(title, 32, INK, HFONT, True)], anchor=MSO_ANCHOR.MIDDLE)
    rect(s, 0, Inches(1.1), W, Inches(0.07), GOLD)
    rect(s, 0, Inches(1.17), W, Inches(0.025), NIGHT)
    rect(s, 0, H - Inches(0.4), W, Inches(0.4), NIGHT)
    text(s, M, H - Inches(0.37), Inches(8), Inches(0.32),
         [("{{UNIT}} · {{EVENT}} FAAR", 11, RGBColor(0xEE, 0xF0, 0xEA), BFONT, False)], anchor=MSO_ANCHOR.MIDDLE)
    text(s, W - M - Inches(4), H - Inches(0.37), Inches(4), Inches(0.32),
         [("Final After Action Review", 11, CALLOUT, BFONT, True, {"align": PP_ALIGN.RIGHT})],
         anchor=MSO_ANCHOR.MIDDLE)
    return s


def card(slide, x, y, w, h):
    rect(slide, x, y, w, h, CARD)
    rect(slide, x, y, w, Inches(0.06), GOLD)


def cards_row(slide, y, h, items, gap=Inches(0.25)):
    n = len(items)
    cw = int((CW - gap * (n - 1)) / n)
    for i, paras in enumerate(items):
        x = M + i * (cw + gap)
        card(slide, x, y, cw, h)
        text(slide, x + Inches(0.2), y + Inches(0.2), cw - Inches(0.4), h - Inches(0.3), paras)


def callout(slide, x, y, w, h, t, size=17):
    rect(slide, x, y, w, h, CALLOUT, line=NIGHT)
    text(slide, x + Inches(0.15), y, w - Inches(0.3), h,
         [(t, size, INK, BFONT, False, {"align": PP_ALIGN.CENTER})], anchor=MSO_ANCHOR.MIDDLE)


def line(slide, x1, y1, x2, y2):
    c = slide.shapes.add_connector(MSO_CONNECTOR.STRAIGHT, x1, y1, x2, y2)
    c.line.color.rgb = INK
    c.line.width = Pt(1.5)


def bullets(items, size=20, gap=10):
    return [(t, size, INK, BFONT, False, {"space_before": gap, "bullet": True}) for t in items]


def title_slide(kicker, title, sub=None):
    s = base()
    text(s, M, Inches(2.9), Inches(11), Inches(0.4), [(kicker, 18, GOLD_INK, HFONT, True)])
    text(s, M, Inches(3.3), Inches(11.5), Inches(1.2), [(title, 58, INK, HFONT, True)])
    rect(s, M, Inches(4.55), Inches(1.4), Inches(0.07), GOLD)
    if sub:
        text(s, M, Inches(4.8), Inches(11), Inches(0.5), [(sub, 22, INK, BFONT, False)])
    return s


# 1 Cover
s = base()
text(s, M, Inches(2.6), Inches(11), Inches(0.4), [("FINAL AFTER ACTION REVIEW", 18, GOLD_INK, HFONT, True)])
text(s, M, Inches(3.0), Inches(11.5), Inches(1.3), [("{{UNIT}}", 60, INK, HFONT, True)])
rect(s, M, Inches(4.35), Inches(1.4), Inches(0.07), GOLD)
text(s, M, Inches(4.6), Inches(11.5), Inches(0.5), [("{{EVENT}}{{LOCATION_LINE}}", 22, INK, BFONT, False)])
text(s, M, Inches(5.15), Inches(11.5), Inches(0.5),
     [("{{BRIEF_DATE}} · Presented by {{OBSERVING_UNIT}} OC/Ts", 16, MUTED, BFONT, False)])

# 2 Agenda
s = base("Agenda")
text(s, M + Inches(0.2), TOP + Inches(0.2), Inches(10), Inches(5), bullets([
    "Purpose and rules of the AAR", "Mission, METs, & CTOs", "MAAR and FAAR deliverables",
    "AAR discussion: three overarching topics", "Unit commitments", "Heroes of the battle",
    "Closing remarks and doctrinal references"], size=22, gap=14))

# 3 Purpose
s = base("What is an AAR?")
text(s, M, TOP + Inches(0.15), Inches(11.4), Inches(1.7), [(
    "A guided analysis of the unit's performance, with one objective: improving future performance. "
    "OC/Ts facilitate. The unit does the talking and decides what to sustain and what to change.",
    22, INK, BFONT, False, {"line": 1.25})])
cards_row(s, Inches(3.9), Inches(2.0), [
    [(str(i + 1), 30, GOLD_INK, HFONT, True), (q, 18, INK, HFONT, True, {"space_before": 6})]
    for i, q in enumerate(["What was supposed to happen?", "What actually happened?",
                           "Why did it happen?", "How do we improve?"])])

# 4 Rules
s = base("Rules of the AAR")
text(s, M + Inches(0.2), TOP + Inches(0.2), Inches(11), Inches(5), bullets([
    "This is your AAR: participation is key", "Be respectful",
    "Everyone has a voice and perspective; the team needs to hear it", "Remain open-minded",
    "Look for the lesson", "Open, candid, professional discussion", "Only one speaker at a time"],
    size=22, gap=12))

# 5 Mission, METs & CTOs
s = base("Mission, METs, & CTOs")
mid = M + Inches(5.4)
split_y = Inches(3.55)
text(s, M, TOP, Inches(5.2), Inches(2.0), [
    ("MISSION", 15, GOLD_INK, HFONT, True),
    ("{{MISSION}}", 15, INK, BFONT, False, {"space_before": 6, "line": 1.2})])
line(s, mid, TOP, mid, split_y - Inches(0.05))
text(s, mid + Inches(0.25), TOP, CW - Inches(5.65), Inches(2.0), [
    ("MISSION ESSENTIAL TASKS", 15, GOLD_INK, HFONT, True),
    ("{{SEQ:met:item}}{{.code}}: {{.title}}", 14, INK, BFONT, False, {"space_before": 5, "bullet": True})])
line(s, M, split_y, W - M, split_y)
text(s, M, split_y + Inches(0.15), CW, BOTTOM - split_y - Inches(0.25), [
    ("COMMANDER'S TRAINING OBJECTIVES", 15, GOLD_INK, HFONT, True),
    ("{{SEQ:cto:item}}{{.text}}", 14, INK, BFONT, False, {"space_before": 7, "bullet": True, "line": 1.15})])

# 6 MAAR deliverables
s = base("MAAR Deliverables")
text(s, M + Inches(0.2), TOP + Inches(0.2), Inches(11), Inches(5),
     [("{{SEQ:maar:item}}{{.label}}{{.text}}", 20, INK, BFONT, False, {"space_before": 12, "bullet": True})])

# 7 FAAR deliverables
s = base("FAAR Deliverables")
text(s, M + Inches(0.2), TOP + Inches(0.2), Inches(11), Inches(5),
     [("{{SEQ:faar:item}}{{.text}}", 20, INK, BFONT, False, {"space_before": 12, "bullet": True})])

# 8 Divider
title_slide("PART 2", "AAR DISCUSSION")

# 9 Three topics
s = base("Three Overarching Topics")
text(s, M, TOP + Inches(0.05), CW, Inches(0.6), [(
    "Processes that cut across every MET, not single events or steps, chosen from the trends in OC/T observations.",
    17, INK, BFONT, False)])
cards_row(s, Inches(2.35), Inches(4.0), [
    [(str(i + 1), 30, GOLD_INK, HFONT, True), (f"{{{{T{k}_NAME}}}}", 22, INK, HFONT, True, {"space_before": 6}),
     (f"{{{{T{k}_WHY}}}}", 14, INK, BFONT, False, {"space_before": 10, "line": 1.2})]
    for i, k in enumerate("ABC")])

# 10-11 Topic pattern (repeated per topic): doctrine, then discussion
s = base("{{T_NAME}}", "TOPIC {{T_NUM}} OF {{T_COUNT}} · DOCTRINE")
card(s, M, TOP + Inches(0.05), CW, Inches(2.85))
text(s, M + Inches(0.3), TOP + Inches(0.22), CW - Inches(0.6), Inches(2.6), [
    ("DEFINITION", 15, GOLD_INK, HFONT, True),
    ("{{T_DEF}}", 19, INK, BFONT, False, {"space_before": 6, "line": 1.2}),
    ("{{T_SRC}}", 12, MUTED, BFONT, False, {"space_before": 10})])
cards_row(s, Inches(4.55), Inches(2.0), [
    [("WHY WE'RE DISCUSSING IT", 15, GOLD_INK, HFONT, True),
     ("{{T_WHY}}", 15, INK, BFONT, False, {"space_before": 6, "line": 1.2})],
    [("WHERE OC/TS SAW IT", 15, GOLD_INK, HFONT, True),
     ("{{T_TASKS}}", 15, INK, BFONT, False, {"space_before": 6, "line": 1.2})],
])

s = base("{{T_NAME}}", "TOPIC {{T_NUM}} OF {{T_COUNT}} · DISCUSSION")
pw, ph = Inches(7.55), Inches(3.45)
box = rect(s, M, TOP, pw, ph, WHITE, line=MUTED)
box.line.dash_style = MSO_LINE_DASH_STYLE.DASH
box.line.width = Pt(1.25)
text(s, M + Inches(0.3), TOP, pw - Inches(0.6), ph, [
    ("[Insert the unit's {{T_PRODUCT}}]", 18, MUTED, BFONT, False, {"align": PP_ALIGN.CENTER}),
    ("Show the unit's own product and let them walk the room through it.", 12, MUTED, BFONT, False,
     {"align": PP_ALIGN.CENTER, "space_before": 6})], anchor=MSO_ANCHOR.MIDDLE)
ox = M + pw + Inches(0.3)
text(s, ox, TOP, W - M - ox, ph, [
    ("WHAT WE OBSERVED", 15, GOLD_INK, HFONT, True),
    ("{{SEQ:obs:item}}{{.text}}", 13, INK, BFONT, False, {"space_before": 7, "bullet": True, "line": 1.15})])
callout(s, M, Inches(5.08), CW, Inches(0.58), "{{T_QA}}")
callout(s, M, Inches(5.8), CW, Inches(0.58), "{{T_QB}}")
text(s, M, Inches(6.55), CW, Inches(0.35), [(
    "Owner (unit decides): ______________________     Action: ______________________     Suspense: __________",
    12, MUTED, BFONT, False)])

# 12 Commitments
s = base("Unit Commitments")
widths = [Inches(3.3), Inches(4.9), Inches(2.4), Inches(1.53)]
heads = ["TOPIC", "WHAT THE UNIT WILL DO", "OWNER (UNIT DECIDES)", "SUSPENSE"]
y = TOP + Inches(0.1)
for r in range(4):
    x = M
    rh = Inches(0.5) if r == 0 else Inches(0.8)
    for c, wv in enumerate(widths):
        rect(s, x, y, wv - Inches(0.04), rh - Inches(0.04), NIGHT if r == 0 else CARD)
        t = heads[c] if r == 0 else (f"{{{{T{'ABC'[r - 1]}_NAME}}}}" if c == 0 else "")
        if t:
            text(s, x + Inches(0.12), y, wv - Inches(0.3), rh - Inches(0.04),
                 [(t, 14 if r == 0 else 16, CALLOUT if r == 0 else INK, HFONT if r == 0 else BFONT, r == 0)],
                 anchor=MSO_ANCHOR.MIDDLE)
        x += wv
    y += rh
text(s, M, y + Inches(0.2), CW, Inches(0.4),
     [("Captured in the unit's words during the discussion.", 13, MUTED, BFONT, False)])

# 13 Heroes
s = base("Heroes of the Battle")
cards_row(s, TOP + Inches(0.3), Inches(3.6), [
    [("[Section]", 14, GOLD_INK, HFONT, True), ("[Rank Name]", 22, INK, HFONT, True, {"space_before": 4}),
     ("[What they did and the effect it had.]", 15, INK, BFONT, False, {"space_before": 10})] for _ in range(3)])

# 14 Closing
title_slide("{{OBSERVING_UNIT}}", "CLOSING REMARKS", "Questions?")

# 15 References
s = base("Doctrinal References")
text(s, M + Inches(0.2), TOP + Inches(0.2), CW - Inches(0.2), Inches(5),
     [("{{SEQ:ref:item}}{{.text}}", 16, INK, BFONT, False, {"space_before": 9, "bullet": True})], cols=2)

prs.save("templates/faar-template.pptx")
print("saved", len(prs.slides._sldIdLst), "slides")
