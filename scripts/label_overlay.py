"""Composite an SVG-derived label PNG onto the bottle area of a generated render.
Refined version: trims white margins from label, fits only the bottle body,
applies a subtle barrel curvature, and blends edges so it looks like a printed label."""
from PIL import Image, ImageDraw, ImageOps, ImageFilter
import math

RENDER = "/Users/macbookpro2017/greenpanda/assets/renders/dishes.png"
LABEL  = "/tmp/посудавектор.svg.png"
OUT    = "/Users/macbookpro2017/greenpanda/assets/renders/dishes_labeled.png"

render = Image.open(RENDER).convert("RGBA")
label  = Image.open(LABEL).convert("RGBA")

# --- Trim white margins from the label ------------------------------------
# The SVG has a slightly off-white #FBFDFC background. Convert near-white to transparent
# only at the OUTER margins; keep interior whites intact.
lw, lh = label.size
gray = label.convert("L")
# bbox of non-near-white pixels
nearwhite_cutoff = 245
bbox = gray.point(lambda p: 0 if p > nearwhite_cutoff else 255).getbbox()
if bbox:
    pad = 6  # small padding inside the design
    bbox = (bbox[0]+pad, bbox[1]+pad, bbox[2]-pad, bbox[3]-pad)
    label = label.crop(bbox)
print(f"label trimmed: {label.size}")

# --- Place onto bottle body (cap + base excluded) -------------------------
# render is 896x1200; bottle body region estimated visually:
bx0, by0, bx1, by1 = 568, 600, 778, 1000
bw, bh = bx1 - bx0, by1 - by0

# Resize the label to fit the bottle body width, preserving its aspect within the body height
target_ratio = bh / bw
src_ratio = label.size[1] / label.size[0]
if src_ratio > target_ratio:
    # label is taller than body; fit by height
    new_h = bh
    new_w = int(new_h / src_ratio)
else:
    new_w = bw
    new_h = int(new_w * src_ratio)
label_fit = label.resize((new_w, new_h), Image.LANCZOS)

# --- Apply a subtle barrel curve (horizontal sinusoidal shading + edge fade) ---
# Build a soft horizontal shading mask to simulate cylinder light
shading = Image.new("L", (new_w, new_h), 0)
sd = shading.load()
for x in range(new_w):
    # bell-shaped curve, brightest in middle, darker at sides
    t = (x - new_w/2) / (new_w/2)        # -1 .. 1
    val = int(255 * (1 - 0.35 * (t*t)))   # 65%..100%
    for y in range(new_h):
        sd[x, y] = val

# Apply shading to label color channels
r, g, b, a = label_fit.split()
def mul(ch, m):
    return Image.eval(Image.blend(Image.new("L", ch.size, 0), ch, 1.0), lambda p: p)  # placeholder
def multiply(channel, mask):
    return Image.composite(channel, Image.new("L", channel.size, 0), mask).point(lambda p: p)
# Simpler: use ImageChops.multiply
from PIL import ImageChops
r = ImageChops.multiply(r, shading)
g = ImageChops.multiply(g, shading)
b = ImageChops.multiply(b, shading)
label_curved = Image.merge("RGBA", (r, g, b, a))

# Slight rounded corners on the label for clean edges
mask = Image.new("L", label_curved.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0,0,new_w-1,new_h-1), radius=18, fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(radius=2))

# Composite onto render, centered in bottle body
ox = bx0 + (bw - new_w)//2
oy = by0 + (bh - new_h)//2

out = render.copy()
out.paste(label_curved, (ox, oy), mask)
out.save(OUT)
print(f"wrote {OUT}: bottle body {bw}x{bh}, label fit {new_w}x{new_h}")
