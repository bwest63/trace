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
from pptx.util import Inches, Pt, Emu
from pptx.dml.color import RGBColor
from pptx.enum.text import PP_ALIGN, MSO_ANCHOR
from pptx.enum.shapes import MSO_SHAPE
from pptx.oxml.ns import qn
from lxml import etree

BG = RGBColor(0x13, 0x1A, 0x1F)
CARD = RGBColor(0x1F, 0x29, 0x30)
HEAD = RGBColor(0x26, 0x32, 0x3A)
LINE = RGBColor(0x33, 0x41, 0x4A)
GOLD = RGBColor(0xC7, 0xA4, 0x58)
INK = RGBColor(0xEE, 0xF0, 0xEA)
MUTED = RGBColor(0x9A, 0xA6, 0xAD)
SUSTAIN = RGBColor(0x5B, 0x9B, 0xD5)
IMPROVE = RGBColor(0xE0, 0x8A, 0x4F)
HFONT = "Bahnschrift SemiBold Condensed"
BFONT = "Segoe UI"

W, H = Inches(13.333), Inches(7.5)
M = Inches(0.67)  # side margin
CW = W - 2 * M

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


def text(slide, x, y, w, h, paras, anchor=MSO_ANCHOR.TOP, cols=1):
    """paras: list of (text, size, color, font, bold, opts) where opts may set
    bullet, space_before, align."""
    tb = slide.shapes.add_textbox(x, y, w, h)
    tf = tb.text_frame
    tf.word_wrap = True
    tf.vertical_anchor = anchor
    tf.margin_left = tf.margin_right = Inches(0.05)
    tf.margin_top = tf.margin_bottom = Inches(0.03)
    if cols > 1:
        tf._txBody.bodyPr.set("numCol", str(cols))
        tf._txBody.bodyPr.set("spcCol", str(Inches(0.3)))
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
            pPr = para._p.get_or_add_pPr()
            pPr.set("marL", str(Inches(0.28)))
            pPr.set("indent", str(-Inches(0.24)))
            bc = etree.SubElement(pPr, qn("a:buClr"))
            etree.SubElement(bc, qn("a:srgbClr")).set("val", opts.get("bullet_color", "C7A458"))
            etree.SubElement(pPr, qn("a:buFont")).set("typeface", "Arial")
            etree.SubElement(pPr, qn("a:buChar")).set("char", "•")
    return tb


def base(title=None, kicker=None, footer=True, logo=True):
    s = prs.slides.add_slide(BLANK)
    s.background.fill.solid()
    s.background.fill.fore_color.rgb = BG
    rect(s, 0, 0, W, Inches(0.06), GOLD)
    if logo:
        s.shapes.add_picture("img/first-army.png", W - Inches(0.98), Inches(0.24), height=Inches(0.66))
    if kicker:
        text(s, M, Inches(0.5), Inches(10.5), Inches(0.4), [(kicker, 15, GOLD, HFONT, True)])
    if title:
        text(s, M, Inches(0.85), Inches(11.2), Inches(0.8), [(title, 36, INK, HFONT, True)])
    if footer:
        text(s, M, H - Inches(0.55), Inches(8), Inches(0.3),
             [("{{UNIT}} · {{EVENT}} FAAR", 11, MUTED, BFONT, False)])
        text(s, W - M - Inches(4), H - Inches(0.55), Inches(4), Inches(0.3),
             [("Final After Action Review", 11, MUTED, BFONT, False, {"align": PP_ALIGN.RIGHT})])
    return s


def card(slide, x, y, w, h, accent=GOLD):
    rect(slide, x, y, w, h, CARD)
    rect(slide, x, y, w, Inches(0.07), accent)


def cards_row(slide, y, h, items, accent=GOLD, gap=Inches(0.25)):
    n = len(items)
    cw = int((CW - gap * (n - 1)) / n)
    for i, paras in enumerate(items):
        x = M + i * (cw + gap)
        card(slide, x, y, cw, h, accent if not isinstance(accent, list) else accent[i])
        text(slide, x + Inches(0.2), y + Inches(0.22), cw - Inches(0.4), h - Inches(0.35), paras)


def bigtitle_slide(kicker, title, lead):
    s = base(footer=True)
    rect(s, M, Inches(3.6), Inches(1.1), Inches(0.06), GOLD)
    text(s, M, Inches(3.8), Inches(11), Inches(0.4), [(kicker, 16, GOLD, HFONT, True)])
    text(s, M, Inches(4.2), Inches(11.5), Inches(1.6), [(title, 58, INK, HFONT, True)])
    text(s, M, Inches(5.35), Inches(11.5), Inches(1.0), [(lead, 20, INK, BFONT, False)])
    return s


# 1 Cover
s = base(footer=False)
rect(s, M, Inches(3.3), Inches(1.1), Inches(0.06), GOLD)
text(s, M, Inches(3.5), Inches(11), Inches(0.4), [("FINAL AFTER ACTION REVIEW", 16, GOLD, HFONT, True)])
text(s, M, Inches(3.9), Inches(11.5), Inches(1.2), [("{{UNIT}}", 60, INK, HFONT, True)])
text(s, M, Inches(5.0), Inches(11.5), Inches(0.5), [("{{EVENT}}{{LOCATION_LINE}}", 22, INK, BFONT, False)])
text(s, M, Inches(5.55), Inches(11.5), Inches(0.5), [("{{BRIEF_DATE}} · Presented by {{OBSERVING_UNIT}} OC/Ts", 16, MUTED, BFONT, False)])

# 2 Agenda
s = base("Agenda", "FAAR")
items = ["Purpose and rules of the AAR", "Mission", "Commander's training objectives", "Mission essential tasks",
         "Exercise overview", "MAAR and FAAR deliverables", "AAR discussion: three overarching topics",
         "Unit commitments", "Heroes of the battle", "Closing remarks and doctrinal references"]
text(s, M, Inches(1.9), CW, Inches(4.8),
     [(f"{i + 1:02d}   {t}", 18, INK, BFONT, False, {"space_before": 10}) for i, t in enumerate(items)], cols=2)

# 3 Purpose
s = base("What is an AAR?", "PURPOSE")
text(s, M, Inches(1.8), Inches(11.2), Inches(1.6), [(
    "A guided analysis of the unit's performance, with one objective: improving future performance. "
    "OC/Ts facilitate. The unit does the talking and decides what to sustain and what to change.",
    22, INK, BFONT, False, {"line": 1.25})])
cards_row(s, Inches(4.2), Inches(2.0), [
    [(str(i + 1), 30, GOLD, HFONT, True), (q, 18, INK, HFONT, True, {"space_before": 6})]
    for i, q in enumerate(["What was supposed to happen?", "What actually happened?", "Why did it happen?", "How do we improve?"])])

# 4 Rules
s = base("Rules of the AAR", "GROUND RULES")
rules = ["This is your AAR: participation is key", "Everyone has a voice, and the team needs to hear it",
         "Remain open-minded and respectful", "Look for the lesson, not the blame",
         "Open, candid, professional discussion", "One speaker at a time"]
text(s, M, Inches(1.9), CW, Inches(4.5),
     [(f"{i + 1:02d}   {t}", 19, INK, BFONT, False, {"space_before": 14}) for i, t in enumerate(rules)], cols=2)

# 5 Mission
s = base("Mission", "TRAINING CONTEXT")
rect(s, M, Inches(1.95), Inches(0.08), Inches(2.2), GOLD)
text(s, M + Inches(0.35), Inches(1.9), Inches(11), Inches(4.3), [("{{MISSION}}", 24, INK, BFONT, False, {"line": 1.25})])

# 6 CTOs
s = base("Commander's Training Objectives", "TRAINING CONTEXT")
text(s, M, Inches(1.9), CW, Inches(4.8),
     [("{{SEQ:cto:item}}{{.num}}.   {{.text}}", 18, INK, BFONT, False, {"space_before": 12})])

# 7 METs
s = base("Mission Essential Tasks", "TRAINING CONTEXT")
text(s, M, Inches(1.9), CW, Inches(4.6),
     [("{{SEQ:met:item}}{{.code}}   {{.title}}", 18, INK, BFONT, False, {"space_before": 12, "bullet": True})])

# 8 Exercise overview
s = base("Exercise Overview", "TRAINING CONTEXT")
text(s, M, Inches(1.85), CW, Inches(0.5), [("{{EVENT}} · {{DATES}}{{LOCATION_LINE}}", 18, INK, BFONT, False)])
cards_row(s, Inches(2.7), Inches(2.1), [
    [("{{N_TEOS}}", 54, GOLD, HFONT, True), ("T&EOs observed", 16, INK, BFONT, False)],
    [("{{N_EVALS}}", 54, GOLD, HFONT, True), ("OC/T evaluations", 16, INK, BFONT, False)],
    [("{{N_OCTS}}", 54, GOLD, HFONT, True), ("OC/Ts contributing", 16, INK, BFONT, False)],
])

# 9 MAAR deliverables
s = base("MAAR Deliverables", "DELIVERABLES")
text(s, M, Inches(1.9), CW, Inches(4.8),
     [("{{SEQ:maar:item}}{{.label}}{{.text}}", 18, INK, BFONT, False, {"space_before": 12, "bullet": True})])

# 10 FAAR deliverables
s = base("FAAR Deliverables", "DELIVERABLES")
text(s, M, Inches(1.9), CW, Inches(4.8),
     [("{{SEQ:faar:item}}{{.text}}", 18, INK, BFONT, False, {"space_before": 12, "bullet": True})])

# 11 Divider
bigtitle_slide("PART 2", "AAR DISCUSSION",
               "Three overarching topics. For each: the doctrine, what OC/Ts observed, and a question for the unit to work through.")

# 12 Three topics
s = base("Three Overarching Topics", "AAR DISCUSSION")
text(s, M, Inches(1.75), CW, Inches(0.6), [(
    "Processes that cut across every MET, not single events or steps, chosen from the trends in OC/T observations.",
    17, INK, BFONT, False)])
cards_row(s, Inches(2.65), Inches(3.9), [
    [(str(i + 1), 30, GOLD, HFONT, True), (f"{{{{T{k}_NAME}}}}", 22, INK, HFONT, True, {"space_before": 6}),
     (f"{{{{T{k}_WHY}}}}", 14, INK, BFONT, False, {"space_before": 10, "line": 1.2})]
    for i, k in enumerate("ABC")])

# 13-15 Topic pattern (repeated per topic)
s = base("{{T_NAME}}", "TOPIC {{T_NUM}} OF {{T_COUNT}} · DOCTRINE")
rect(s, M, Inches(1.95), Inches(0.08), Inches(2.0), GOLD)
text(s, M + Inches(0.35), Inches(1.9), Inches(11.2), Inches(2.4), [
    ("{{T_DEF}}", 22, INK, BFONT, False, {"line": 1.25}),
    ("{{T_SRC}}", 13, MUTED, BFONT, False, {"space_before": 12})])
cards_row(s, Inches(4.55), Inches(1.95), [
    [("WHY IT MATTERS HERE", 15, GOLD, HFONT, True), ("{{T_WHY}}", 15, INK, BFONT, False, {"space_before": 6, "line": 1.2})],
    [("WHERE OC/TS SAW IT", 15, GOLD, HFONT, True), ("{{T_TASKS}}", 15, INK, BFONT, False, {"space_before": 6, "line": 1.2})],
])

s = base("{{T_NAME}}", "TOPIC {{T_NUM}} OF {{T_COUNT}} · WHAT OC/TS OBSERVED")
gap = Inches(0.25)
cw = int((CW - gap) / 2)
for i, (title, accent, key, bc) in enumerate([("WHAT WORKED", SUSTAIN, "tw", "5B9BD5"), ("WHERE IT BROKE DOWN", IMPROVE, "tb", "E08A4F")]):
    x = M + i * (cw + gap)
    card(s, x, Inches(1.85), cw, Inches(4.45), accent)
    text(s, x + Inches(0.25), Inches(2.1), cw - Inches(0.5), Inches(4.0), [
        (title, 18, accent, HFONT, True),
        ("{{SEQ:" + key + ":item}}{{.text}}", 15, INK, BFONT, False,
         {"space_before": 10, "bullet": True, "bullet_color": bc, "line": 1.2})])
text(s, M, Inches(6.42), CW, Inches(0.35),
     [("Observations, not conclusions. The unit explains why.", 13, MUTED, BFONT, False)])

s = base("{{T_NAME}}", "TOPIC {{T_NUM}} OF {{T_COUNT}} · DISCUSSION")
text(s, M, Inches(1.7), Inches(11.4), Inches(1.6), [("{{T_QUESTION}}", 24, INK, BFONT, True, {"line": 1.2})])
half = int((CW - gap) / 2)
text(s, M, Inches(3.55), half, Inches(2.8), [
    ("FOLLOW-UP PROMPTS", 16, GOLD, HFONT, True),
    ("What was supposed to happen?", 16, INK, BFONT, False, {"space_before": 10, "bullet": True}),
    ("What actually happened, and why?", 16, INK, BFONT, False, {"space_before": 8, "bullet": True}),
    ("What will you sustain, and what will you change?", 16, INK, BFONT, False, {"space_before": 8, "bullet": True})])
bx = M + half + gap
card(s, bx, Inches(3.5), half, Inches(2.85))
text(s, bx + Inches(0.25), Inches(3.72), half - Inches(0.5), Inches(2.5), [
    ("THE UNIT DECIDES", 16, GOLD, HFONT, True)] + [
    (f"{k}:", 15, INK, BFONT, True, {"space_before": 12}) for k in ["Owner", "Action", "Suspense", "How we'll know"]])

# 16 Commitments
s = base("Unit Commitments", "AAR DISCUSSION")
widths = [Inches(3.3), Inches(4.7), Inches(2.4), Inches(1.6)]
heads = ["TOPIC", "WHAT THE UNIT WILL DO", "OWNER (UNIT DECIDES)", "SUSPENSE"]
y = Inches(1.9)
for r in range(4):
    x = M
    rh = Inches(0.5) if r == 0 else Inches(0.72)
    for c, wv in enumerate(widths):
        rect(s, x, y, wv - Inches(0.04), rh - Inches(0.04), HEAD if r == 0 else CARD)
        t = heads[c] if r == 0 else (f"{{{{T{'ABC'[r - 1]}_NAME}}}}" if c == 0 else "")
        if t:
            text(s, x + Inches(0.12), y, wv - Inches(0.3), rh - Inches(0.04),
                 [(t, 14 if r == 0 else 16, GOLD if r == 0 else INK, HFONT if r == 0 else BFONT, r == 0)],
                 anchor=MSO_ANCHOR.MIDDLE)
        x += wv
    y += rh
text(s, M, Inches(4.75), CW, Inches(0.4), [("Captured in the unit's words during the discussion.", 13, MUTED, BFONT, False)])

# 17 Heroes
s = base("Heroes of the Battle", "RECOGNITION")
cards_row(s, Inches(1.95), Inches(3.6), [
    [("[Section]", 14, GOLD, HFONT, True), ("[Rank Name]", 22, INK, HFONT, True, {"space_before": 4}),
     ("[What they did and the effect it had.]", 15, INK, BFONT, False, {"space_before": 10})] for _ in range(3)])

# 18 Closing
bigtitle_slide("{{OBSERVING_UNIT}}", "CLOSING REMARKS", "Questions?")

# 19 References
s = base("Doctrinal References", "DOCTRINE")
text(s, M, Inches(1.9), CW, Inches(4.8),
     [("{{SEQ:ref:item}}{{.text}}", 16, INK, BFONT, False, {"space_before": 10, "bullet": True})], cols=2)

prs.save("templates/faar-template.pptx")
print("saved", len(prs.slides._sldIdLst), "slides")
