"""Export the traced camp geography as assets/js/campmap-data.js (picture pixel coordinates)."""
import json, math, heapq, sys
D = json.load(open('roads_final.json'))
roads, fence, perim = D['roads'], D['fence'], D['perimeter']

# ---- road graph for the game-drive route ----
pts, idx, adj = [], {}, {}
def node(p):
    k = (round(p[0], 1), round(p[1], 1))
    if k not in idx: idx[k] = len(pts); pts.append(k); adj[idx[k]] = []
    return idx[k]
def link(a, b):
    d = math.dist(pts[a], pts[b]); adj[a].append((b, d)); adj[b].append((a, d))
def dens(L, step=6):
    out = []
    for a, b in zip(L, L[1:]):
        n = max(1, int(math.dist(a, b) // step))
        for i in range(n): out.append([a[0] + (b[0] - a[0]) * i / n, a[1] + (b[1] - a[1]) * i / n])
    out.append(L[-1]); return out
for L in roads:
    ids = [node(p) for p in dens(L)]
    for a, b in zip(ids, ids[1:]): link(a, b)
# join lines that touch (junctions / bridges)
cell = {}
for i, p in enumerate(pts): cell.setdefault((int(p[0] // 8), int(p[1] // 8)), []).append(i)
for i, p in enumerate(pts):
    cx, cy = int(p[0] // 8), int(p[1] // 8)
    for dx in (-1, 0, 1):
        for dy in (-1, 0, 1):
            for j in cell.get((cx + dx, cy + dy), []):
                if j > i and math.dist(p, pts[j]) < 7: link(i, j)
def nearest(p): return min(range(len(pts)), key=lambda i: math.dist(p, pts[i]))
def path(a, b):
    s, t = nearest(a), nearest(b); dist = {s: 0}; prev = {}; q = [(0, s)]
    while q:
        d, u = heapq.heappop(q)
        if u == t: break
        if d > dist[u]: continue
        for v, w in adj[u]:
            nd = d + w
            if nd < dist.get(v, 1e18): dist[v] = nd; prev[v] = u; heapq.heappush(q, (nd, v))
    out = [t]
    while out[-1] != s: out.append(prev[out[-1]])
    return [list(pts[i]) for i in reversed(out)]
# game drive: reception -> north gate -> out along Kaallaagte Road (off the top of the map)
WAY = [(185, 150), (258, 75), (258, 2)]
drive = []
for a, b in zip(WAY, WAY[1:]):
    seg = path(a, b); drive += seg if not drive else seg[1:]
drive.append([258, -40])
def rdp(P, eps):
    if len(P) < 3: return P
    a, b = P[0], P[-1]; dx, dy = b[0] - a[0], b[1] - a[1]; L = math.hypot(dx, dy) or 1
    ds = [abs(dx * (a[1] - p[1]) - dy * (a[0] - p[0])) / L for p in P]; i = max(range(len(P)), key=lambda k: ds[k])
    return rdp(P[:i + 1], eps)[:-1] + rdp(P[i:], eps) if ds[i] > eps else [a, b]
drive = rdp(drive, 1.0)
print('drive points', len(drive), 'length', round(sum(math.dist(a, b) for a, b in zip(drive, drive[1:]))))

geo = {
    'w': 1386, 'h': 627,
    'roads': [[[round(x, 1), round(y, 1)] for x, y in L] for L in roads],
    'fence': fence, 'perimeter': perim,
    'drive': [[round(x, 1), round(y, 1)] for x, y in drive],
    # buildings as seen on the picture (x, y, w, h)
    'house': [[140, 172, 34, 26], [176, 168, 28, 24]], 'pool': [267, 201, 17, 21], 'lapa': [252, 185, 22, 16],
    'reception': [172, 160],
    'spruit': [[560, 640], [700, 628], [850, 622], [1000, 618], [1150, 606], [1270, 588], [1400, 566]]
}
js = '/* Kyleu camp geography, traced from the aerial site layout (picture pixels, 1386 x 627).\n   Generated: do not edit by hand. Stand positions live in content/stands.md. */\n' \
     'window.Kyleu = window.Kyleu || {};\nwindow.Kyleu.CAMP_GEO = ' + json.dumps(geo, separators=(',', ':')) + ';\n'
open(sys.argv[1], 'w', encoding='utf-8').write(js)
print('bytes', len(js))
