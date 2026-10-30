"""Trace dirt-road centrelines from the Kyleu aerial site layout."""
import json, math, sys
import numpy as np
from PIL import Image, ImageDraw

SRC = 'site-layout-original.png'
im = np.asarray(Image.open(SRC).convert('RGB')).astype(int)
H, W = im.shape[:2]
r, g, b = im[..., 0], im[..., 1], im[..., 2]
mask = (r - b > 42) & (r > 135) & (r - g > 10)
mask[:135, 1200:] = False          # logo
mask[:, :2] = mask[:, -2:] = False

def shift(a, dy, dx):
    out = np.zeros_like(a)
    ys = slice(max(dy, 0), H + min(dy, 0)); yd = slice(max(-dy, 0), H + min(-dy, 0))
    xs = slice(max(dx, 0), W + min(dx, 0)); xd = slice(max(-dx, 0), W + min(-dx, 0))
    out[ys, xs] = a[yd, xd]
    return out
def dilate(a, n=1):
    for _ in range(n):
        o = a.copy()
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1): o |= shift(a, dy, dx)
        a = o
    return a
def erode(a, n=1): return ~dilate(~a, n)

m = erode(dilate(mask, 2), 2)          # close small holes
# drop small components
lab = np.zeros(m.shape, int); cur = 0; sizes = {}
ys, xs = np.nonzero(m)
for y0, x0 in zip(ys, xs):
    if lab[y0, x0]: continue
    cur += 1; st = [(y0, x0)]; lab[y0, x0] = cur; n = 0
    while st:
        y, x = st.pop(); n += 1
        for dy in (-1, 0, 1):
            for dx in (-1, 0, 1):
                yy, xx = y + dy, x + dx
                if 0 <= yy < H and 0 <= xx < W and m[yy, xx] and not lab[yy, xx]:
                    lab[yy, xx] = cur; st.append((yy, xx))
    sizes[cur] = n
keep = np.array([0] + [1 if sizes[i] >= 120 else 0 for i in range(1, cur + 1)], bool)
m = keep[lab]

def thin(img):
    img = img.astype(np.uint8).copy(); changed = True
    while changed:
        changed = False
        for step in (0, 1):
            P = np.pad(img, 1)
            p2, p3, p4, p5 = P[:-2, 1:-1], P[:-2, 2:], P[1:-1, 2:], P[2:, 2:]
            p6, p7, p8, p9 = P[2:, 1:-1], P[2:, :-2], P[1:-1, :-2], P[:-2, :-2]
            B = p2 + p3 + p4 + p5 + p6 + p7 + p8 + p9
            seq = [p2, p3, p4, p5, p6, p7, p8, p9, p2]
            A = sum(((seq[i] == 0) & (seq[i + 1] == 1)).astype(int) for i in range(8))
            c = ((p2 * p4 * p6 == 0) & (p4 * p6 * p8 == 0)) if step == 0 else ((p2 * p4 * p8 == 0) & (p2 * p6 * p8 == 0))
            kill = (img == 1) & (B >= 2) & (B <= 6) & (A == 1) & c
            if kill.any(): img[kill] = 0; changed = True
    return img.astype(bool)
sk = thin(m)

# --- skeleton graph ---
pts = set(zip(*np.nonzero(sk)))
def nb(p):
    y, x = p
    return [(y + dy, x + dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if (dy or dx) and (y + dy, x + dx) in pts]
def edges():
    deg = {p: len(nb(p)) for p in pts}
    nodes = {p for p, d in deg.items() if d != 2}
    seen = set(); out = []
    for n in nodes:
        for q in nb(n):
            if (n, q) in seen: continue
            path = [n, q]; prev, cur_ = n, q
            while cur_ not in nodes:
                nxt = [z for z in nb(cur_) if z != prev and z not in path[-3:]]
                if not nxt: break
                prev, cur_ = cur_, nxt[0]; path.append(cur_)
            seen.add((path[-1], path[-2])); seen.add((n, q))
            out.append(path)
    return out, deg
# prune short spurs a few times
for _ in range(4):
    E, deg = edges()
    for p in E:
        ends = [deg[p[0]], deg[p[-1]]]
        if len(p) < 16 and 1 in ends:
            for z in p:
                if deg.get(z, 0) <= 2 or z in (p[0], p[-1]) and deg[z] == 1: pts.discard(z)
E, deg = edges()

def rdp(P, eps):
    if len(P) < 3: return P
    a, b_ = np.array(P[0], float), np.array(P[-1], float)
    d = b_ - a; L = np.hypot(*d) or 1
    dist = [abs(d[0] * (a[1] - p[1]) - d[1] * (a[0] - p[0])) / L for p in P]
    i = int(np.argmax(dist))
    if dist[i] > eps: return rdp(P[:i + 1], eps)[:-1] + rdp(P[i:], eps)
    return [P[0], P[-1]]
lines = []
for p in E:
    if len(p) < 6: continue
    s = rdp([(x, y) for (y, x) in p], 1.4)
    lines.append([[int(x), int(y)] for x, y in s])
json.dump(lines, open('auto_roads.json', 'w'))
print('edges', len(lines), 'skeleton px', len(pts))

# overlay for review
base = Image.open(SRC).convert('RGB')
d = ImageDraw.Draw(base)
for L in lines: d.line([tuple(p) for p in L], fill=(255, 0, 255), width=2)
for p, dg in deg.items():
    if dg == 1: d.ellipse([p[1] - 3, p[0] - 3, p[1] + 3, p[0] + 3], outline=(0, 255, 255), width=2)
base.save('auto_overlay.png')
