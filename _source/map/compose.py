"""Compose the final road network: auto trace + gap bridges + perimeter + manual fixes."""
import json, math
from PIL import Image, ImageDraw, ImageFont

auto = json.load(open('auto_roads.json'))
manual = json.load(open('manual.json')) if __import__('os').path.exists('manual.json') else {"add": [], "drop_near": []}

# fence = the black line on the picture (corners), perimeter road just inside it
FENCE = [[70, 44], [503, 89], [575, 583], [12, 598]]
def inset(poly, d):
    # move each corner toward the centroid by roughly d px
    cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
    out = []
    for x, y in poly:
        vx, vy = cx - x, cy - y; L = math.hypot(vx, vy)
        out.append([x + vx / L * d * 1.4, y + vy / L * d * 1.4])
    return out
LINE = FENCE   # the black line drawn on the picture
def offset_poly(poly, offs):
    """Shift each side inward by its own offset (negative = outward), re-intersect the corners."""
    cx = sum(p[0] for p in poly) / len(poly); cy = sum(p[1] for p in poly) / len(poly)
    sides = []
    for i in range(len(poly)):
        a, c = poly[i], poly[(i + 1) % len(poly)]; dx, dy = c[0] - a[0], c[1] - a[1]; L = math.hypot(dx, dy)
        nx, ny = -dy / L, dx / L
        if (cx - (a[0] + c[0]) / 2) * nx + (cy - (a[1] + c[1]) / 2) * ny < 0: nx, ny = -nx, -ny
        o = offs[i]; sides.append(((a[0] + nx * o, a[1] + ny * o), (c[0] + nx * o, c[1] + ny * o)))
    out = []
    for i in range(len(sides)):
        (p1, p2), (p3, p4) = sides[i - 1], sides[i]
        d = (p1[0] - p2[0]) * (p3[1] - p4[1]) - (p1[1] - p2[1]) * (p3[0] - p4[0])
        t = ((p1[0] - p3[0]) * (p3[1] - p4[1]) - (p1[1] - p3[1]) * (p3[0] - p4[0])) / d
        out.append([round(p1[0] + t * (p2[0] - p1[0]), 1), round(p1[1] + t * (p2[1] - p1[1]), 1)])
    return out
ROAD_OFF = [5, 5, 2, -2]                      # measured: top, right, bottom, left (+ = inside the drawn line)
PERIM = offset_poly(LINE, ROAD_OFF)
FENCE = offset_poly(LINE, [o - 6 for o in ROAD_OFF])   # fence sits just outside the perimeter road

def seg_dist(p, a, b):
    ax, ay = a; bx, by = b; px, py = p
    dx, dy = bx - ax, by - ay; L2 = dx * dx + dy * dy or 1
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / L2))
    return math.hypot(px - ax - t * dx, py - ay - t * dy)
def near_poly(p, poly, closed=True):
    n = len(poly); segs = [(poly[i], poly[(i + 1) % n]) for i in range(n if closed else n - 1)]
    return min(seg_dist(p, a, b) for a, b in segs)

# 1) drop auto pieces that run along the fence (replaced by the clean perimeter road)
lines = []
for L in auto:
    if all(near_poly(p, FENCE) < 13 for p in L): continue
    lines.append(L)
# manual drops: any auto line with a point within r of a given spot
for (x, y, r) in manual.get("drop_near", []):
    lines = [L for L in lines if not any(math.hypot(p[0] - x, p[1] - y) < r for p in L)]

# 2) bridge gaps between dead ends that line up
def ends(lines):
    out = []
    for i, L in enumerate(lines):
        if len(L) < 2: continue
        for k in (0, -1):
            p = L[k]; q = L[1] if k == 0 else L[-2]
            tx, ty = p[0] - q[0], p[1] - q[1]; tl = math.hypot(tx, ty) or 1
            out.append((i, k, p, (tx / tl, ty / tl)))
    return out
E = ends(lines)
def is_dead(p):
    # a point is a dead end if no other line passes near it
    cnt = 0
    for L in lines:
        for a, b in zip(L, L[1:]):
            if seg_dist(p, a, b) < 2.5: cnt += 1; break
    return cnt <= 1
dead = [e for e in E if is_dead(e[2])]
bridges, used = [], set()
for a in dead:
    best = None
    for b in dead:
        if b[0] == a[0] or (b[0], b[1]) in used or (a[0], a[1]) in used: continue
        dx, dy = b[2][0] - a[2][0], b[2][1] - a[2][1]; d = math.hypot(dx, dy)
        if d < 3 or d > 42: continue
        ca = (dx * a[3][0] + dy * a[3][1]) / d           # a's direction points toward b
        cb = (-dx * b[3][0] - dy * b[3][1]) / d          # b's direction points toward a
        if ca > .55 and cb > .55:
            score = d * (2.2 - ca - cb)
            if not best or score < best[0]: best = (score, b)
    if best:
        b = best[1]; used.add((a[0], a[1])); used.add((b[0], b[1]))
        bridges.append([a[2], b[2]])
lines += bridges
# 3) manual additions (roads hidden under trees, junction links, etc.)
lines += manual.get("add", [])
# 4) perimeter road
lines.append([[round(x, 1), round(y, 1)] for x, y in PERIM + [PERIM[0]]])

json.dump({"roads": lines, "fence": FENCE, "perimeter": PERIM}, open('roads_final.json', 'w'))
print('lines', len(lines), 'bridges', len(bridges))

# review overlays
base = Image.open('site-layout-original.png').convert('RGB')
d = ImageDraw.Draw(base)
for L in lines: d.line([tuple(p) for p in L], fill=(255, 0, 255), width=2)
for B in bridges: d.line([tuple(p) for p in B], fill=(0, 255, 0), width=3)
for A in manual.get("add", []): d.line([tuple(p) for p in A], fill=(255, 255, 0), width=2)
base.save('final_overlay.png')
f = ImageFont.truetype('arial.ttf', 18)
def grid(box, name, sc=2):
    x0, y0, x1, y1 = box; c = base.crop(box).resize(((x1 - x0) * sc, (y1 - y0) * sc), Image.LANCZOS); dd = ImageDraw.Draw(c)
    for x in range((x0 // 25 + 1) * 25, x1, 25):
        X = (x - x0) * sc; dd.line([(X, 0), (X, c.height)], fill=(0, 110, 130), width=1)
        if x % 50 == 0: dd.text((X + 2, 2), str(x), fill=(255, 255, 0), font=f)
    for y in range((y0 // 25 + 1) * 25, y1, 25):
        Y = (y - y0) * sc; dd.line([(0, Y), (c.width, Y)], fill=(0, 110, 130), width=1)
        if y % 50 == 0: dd.text((2, Y + 2), str(y), fill=(255, 255, 0), font=f)
    c.save(name)
grid((0, 0, 580, 627), 'f-A.png'); grid((500, 0, 1000, 627), 'f-B.png'); grid((900, 0, 1386, 627), 'f-C.png')
