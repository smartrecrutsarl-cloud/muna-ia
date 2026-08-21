import math, random, sys

COL = "#2D1B69"
rnd = random.Random(int(sys.argv[2]) if len(sys.argv) > 2 else 7)

# ---------- 1. Trunk (filled, bottle-shaped) ----------
TRUNK = ("M79 185C80 162 84 143 88 127 89.5 121 90.5 116 91 111"
         "L112 111C112.5 116 113.5 121 115 127C119 143 123 162 124 185Z")

FORK_Y = 112.0
branches = []   # (path, width)
tips = []       # (x, y, depth)

def grow(x, y, ang, length, width, depth):
    # slight curve: mid control offset perpendicular to travel
    curve = rnd.uniform(-0.22, 0.22)
    ex = x + math.cos(ang) * length
    ey = y + math.sin(ang) * length
    px, py = -math.sin(ang) * length * curve, math.cos(ang) * length * curve
    c1 = (x + math.cos(ang) * length * 0.4 + px * 0.6, y + math.sin(ang) * length * 0.4 + py * 0.6)
    c2 = (x + math.cos(ang) * length * 0.75 + px * 0.4, y + math.sin(ang) * length * 0.75 + py * 0.4)
    branches.append((
        f"M{x:.1f} {y:.1f}C{c1[0]:.1f} {c1[1]:.1f} {c2[0]:.1f} {c2[1]:.1f} {ex:.1f} {ey:.1f}",
        round(width, 2), depth))
    if depth >= 3 or width < 2.2:
        tips.append((ex, ey, depth))
        return
    n = 2
    spread = [0.86, 0.60, 0.46, 0.38][min(depth, 3)]
    offs = [(-1, 1), (-1, 0, 1)][n - 2]
    for o in offs:
        a = ang + o * spread * rnd.uniform(0.75, 1.25) + rnd.uniform(-0.09, 0.09)
        a = max(-math.pi * 0.97, min(-math.pi * 0.03, a))   # never point downward
        grow(ex, ey, a, length * rnd.uniform(0.66, 0.80), width * rnd.uniform(0.52, 0.64), depth + 1)

UP = -math.pi / 2
for a, ln, w in [(UP - 1.06, 24, 12.5), (UP - 0.36, 21, 11.0),
                 (UP + 0.32, 21, 11.0), (UP + 1.04, 24, 12.5)]:
    grow(101 + math.cos(a) * 3, FORK_Y + 2, a + rnd.uniform(-.06, .06), ln, w, 0)
grow(101, FORK_Y + 1, UP + rnd.uniform(-.1, .1), 20, 9.0, 1)

# ---------- 2. Canopy node field ----------
CX, CY, RX, RY = 101.0, 88.0, 90.0, 62.0

def in_dome(x, y):
    return y <= 112 and ((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2 <= 1.0

def on_wood(x, y):
    if y > 104 and 72 < x < 130: return True
    return any(math.dist((x, y), (tx, ty)) < 4 for tx, ty, d in tips if d < 3)

nodes = [(x, y, round(max(1.4, 4.4 - d * 0.75), 2)) for x, y, d in tips]
placed = 0
while placed < 44:
    x, y = rnd.uniform(10, 192), rnd.uniform(24, 112)
    if not in_dome(x, y) or on_wood(x, y): continue
    if any(math.dist((x, y), (px, py)) < 12.2 for px, py, _ in nodes): continue
    e = math.sqrt(((x - CX) / RX) ** 2 + ((y - CY) / RY) ** 2)
    nodes.append((x, y, round(max(1.1, rnd.uniform(1.6, 4.4) * (1 - 0.34 * e)), 2)))
    placed += 1

sat = []
for _ in range(22):
    a = rnd.uniform(0.06, math.pi - 0.06)
    e = rnd.uniform(0.94, 1.07)
    x, y = CX - math.cos(a) * RX * e, CY - math.sin(a) * RY * e
    if 8 < x < 194 and 20 < y < 110:
        sat.append((x, y, round(rnd.uniform(0.85, 1.5), 2)))

# ---------- 3. Mesh ----------
edges = set()
for i, (x1, y1, _) in enumerate(nodes):
    near = sorted((math.dist((x1, y1), (x2, y2)), j)
                  for j, (x2, y2, _) in enumerate(nodes) if j != i)
    for dist, j in near[:2]:
        if dist < 23: edges.add((min(i, j), max(i, j)))
for i, (x1, y1, _) in enumerate(nodes):
    for j in range(i + 1, len(nodes)):
        x2, y2, _ = nodes[j]
        if math.dist((x1, y1), (x2, y2)) < 18 and rnd.random() < 0.3:
            edges.add((i, j))
# a few whiskers out to the satellites
for sx, sy, _ in sat:
    d, k = min((math.dist((sx, sy), (nx, ny)), k) for k, (nx, ny, _) in enumerate(nodes))
    if d < 15 and rnd.random() < 0.5:
        edges.add(("s", round(sx, 1), round(sy, 1), k))

def n(v): return f"{v:.1f}".rstrip("0").rstrip(".")

mesh = "".join(
    (f"M{n(nodes[e[0]][0])} {n(nodes[e[0]][1])} {n(nodes[e[1]][0])} {n(nodes[e[1]][1])}"
     if e[0] != "s" else
     f"M{n(e[1])} {n(e[2])} {n(nodes[e[3]][0])} {n(nodes[e[3]][1])}")
    for e in sorted(edges, key=str))
circles = "".join(f'<circle cx="{n(x)}" cy="{n(y)}" r="{n(r)}"/>' for x, y, r in nodes + sat)

bygroup = {}
for p, w, d in branches: bygroup.setdefault(w, []).append(p)
wood = "".join(f'<g stroke-width="{w}">' + "".join(f'<path d="{p}"/>' for p in ps) + "</g>"
               for w, ps in sorted(bygroup.items(), reverse=True))

svg = (f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" role="img" '
       f'aria-labelledby="bbTitle"><title id="bbTitle">Baobab Labs</title>'
       f'<g color="{COL}"><g fill="none" stroke="currentColor" stroke-linecap="round" '
       f'stroke-linejoin="round">{wood}'
       f'<g stroke-width="1" opacity=".92"><path d="{mesh}"/></g></g>'
       f'<path fill="currentColor" d="{TRUNK}"/>'
       f'<g fill="currentColor">{circles}</g></g></svg>')
open(sys.argv[1], "w").write(svg)
print("branches", len(branches), "nodes", len(nodes) + len(sat), "edges", len(edges), "bytes", len(svg))
