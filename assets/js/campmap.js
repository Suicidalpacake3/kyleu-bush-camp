/* =========================================================
   Kyleu camp map, a generated, interactive map of the camp
   - Draws terrain, roads, fence, spruit, trees and buildings as SVG
   - Stands come from content/stands.md ("Map position: left %, top %")
   - Hover a stand → preview bubble; click → booking
   - Jackals and hyenas wander around the unfenced area
   Tip for the Kyleu team: open any page with the map and add
   ?mapedit to the address, then click the map to get a "Map position".
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var W = 1000, H = 452.4;   // the site layout picture's proportions (1386 x 627)
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function rng(seed) { return function () { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }
  function r1(n) { return Math.round(n * 10) / 10; }
  // smooth line through points (Catmull-Rom → Bézier)
  function smooth(p) {
    var d = 'M' + p[0][0] + ' ' + p[0][1];
    for (var i = 0; i < p.length - 1; i++) {
      var p0 = p[i - 1] || p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] || p2;
      d += ' C' + r1(p1[0] + (p2[0] - p0[0]) / 6) + ' ' + r1(p1[1] + (p2[1] - p0[1]) / 6) + ' ' + r1(p2[0] - (p3[0] - p1[0]) / 6) + ' ' + r1(p2[1] - (p3[1] - p1[1]) / 6) + ' ' + p2[0] + ' ' + p2[1];
    }
    return d;
  }
  function densify(p, step) {
    var out = [];
    for (var i = 0; i < p.length - 1; i++) {
      var dx = p[i + 1][0] - p[i][0], dy = p[i + 1][1] - p[i][1], n = Math.max(1, Math.ceil(Math.hypot(dx, dy) / step));
      for (var j = 0; j < n; j++) out.push([p[i][0] + dx * j / n, p[i][1] + dy * j / n]);
    }
    out.push(p[p.length - 1]); return out;
  }
  function inPoly(x, y, poly) {
    var c = false;
    for (var i = 0, j = poly.length - 1; i < poly.length; j = i++) {
      if (((poly[i][1] > y) !== (poly[j][1] > y)) && (x < (poly[j][0] - poly[i][0]) * (y - poly[i][1]) / (poly[j][1] - poly[i][1]) + poly[i][0])) c = !c;
    }
    return c;
  }

  /* ---------- the camp's geography, traced from the aerial site layout ----------
     All shapes come from assets/js/campmap-data.js (picture pixels, 1386 x 627).
     The map keeps the picture's proportions, so stand positions in stands.md
     (left %, top %) line up exactly with the site layout picture. */
  var G = K.CAMP_GEO || { w: 1386, h: 627, roads: [], fence: [], perimeter: [], drive: [[185, 147], [258, -40]], house: [], pool: [267, 201, 17, 21], lapa: [252, 185, 22, 16], reception: [172, 160], spruit: [] };
  var SC = W / G.w; H = Math.round(G.h * SC * 10) / 10;
  function sc(p) { return [r1(p[0] * SC), r1(p[1] * SC)]; }
  function scR(r) { return [r1(r[0] * SC), r1(r[1] * SC), r1(r[2] * SC), r1(r[3] * SC)]; }
  var FENCE = G.fence.map(sc);
  var ROADS = G.roads.map(function (L) { return L.map(sc); });
  var DRIVE = G.drive.map(sc);
  var SPRUIT = G.spruit.map(sc);
  var HOUSES = G.house.map(scR), POOLR = scR(G.pool), LAPA = scR(G.lapa), RECEPTION = sc(G.reception);
  var ROAM = { x0: 445, x1: 985, y0: 28, y1: 440 };      // unfenced area where wildlife may wander
  function poly(L) { return 'M' + L.map(function (p) { return p[0] + ' ' + p[1]; }).join('L'); }

  function standXY(st) { return st.map ? [st.map.x / 100 * W, st.map.y / 100 * H] : null; }

  /* ---------- terrain (static SVG string, cached per stand list) ---------- */
  var baseCache = {};
  function terrain(stands) {
    var key = stands.map(function (s) { return s.id + (s.map ? s.map.x + ',' + s.map.y : ''); }).join('|');
    if (baseCache[key]) return baseCache[key];
    var R = rng(7), o = [];
    o.push('<defs>' +
      '<filter id="cm-grain" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .35  0 0 0 0 .28  0 0 0 0 .12  0 0 0 .22 0"/><feComposite in2="SourceGraphic" operator="in"/></filter>' +
      '<radialGradient id="cm-vig" cx="50%" cy="45%" r="75%"><stop offset="60%" stop-color="#000" stop-opacity="0"/><stop offset="100%" stop-color="#2a1b12" stop-opacity=".28"/></radialGradient>' +
      '<linearGradient id="cm-water" x1="0" x2="1"><stop offset="0" stop-color="#6fa7b5"/><stop offset="1" stop-color="#4f8c9e"/></linearGradient>' +
      '</defs>');
    // bushveld ground
    o.push('<rect width="' + W + '" height="' + H + '" fill="#a8a26a"/>');
    for (var i = 0; i < 46; i++) o.push('<ellipse cx="' + r1(R() * W) + '" cy="' + r1(R() * H) + '" rx="' + r1(30 + R() * 70) + '" ry="' + r1(18 + R() * 40) + '" fill="' + (R() > .5 ? '#9c9860' : '#b4ac74') + '" opacity=".7"/>');
    // lawn around the house and pool
    var lx = POOLR[0] - 40, ly = POOLR[1] - 8;
    o.push('<ellipse cx="' + r1(lx) + '" cy="' + r1(ly + 6) + '" rx="' + r1(52) + '" ry="' + r1(30) + '" fill="#8fae5e" opacity=".95"/>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="#a8a26a" filter="url(#cm-grain)" opacity=".9"/>');
    // spruit (stream) along the bottom with green banks
    if (SPRUIT.length) {
      var sp = smooth(SPRUIT);
      o.push('<path d="' + sp + '" fill="none" stroke="#7e9a52" stroke-width="40" stroke-linecap="round" opacity=".55"/>');
      o.push('<path id="cm-spruit" d="' + sp + '" fill="none" stroke="url(#cm-water)" stroke-width="9" stroke-linecap="round"/>');
      o.push('<path d="' + sp + '" fill="none" stroke="#bfe0e6" stroke-width="2" stroke-dasharray="8 14" stroke-linecap="round" opacity=".8"><animate attributeName="stroke-dashoffset" from="0" to="-44" dur="3s" repeatCount="indefinite"/></path>');
    }
    // stand clearings (worn red-earth patches at each campsite)
    var spots = [];
    stands.forEach(function (st) {
      var p = standXY(st); if (!p) return; spots.push(p);
      o.push('<ellipse cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" rx="17" ry="12" fill="#d39a6c" opacity=".85"/>');
    });
    // red dirt roads: the only roads on the map (traced from the picture, incl. the perimeter road)
    var rd = ROADS.map(poly).join(' ') + ' ' + poly(G.perimeter.map(sc).concat([sc(G.perimeter[0])]));
    o.push('<path d="' + rd + '" fill="none" stroke="#7a3c22" stroke-width="8.5" stroke-linecap="round" stroke-linejoin="round" opacity=".45"/>');
    o.push('<path class="cm-road" d="' + rd + '" fill="none" stroke="#c4744a" stroke-width="5.6" stroke-linecap="round" stroke-linejoin="round"/>');
    o.push('<path d="' + rd + '" fill="none" stroke="#dc9a6e" stroke-width="1.4" stroke-dasharray="2 5" stroke-linecap="round" opacity=".8"/>');
    // ablution blocks / fire rings at each stand
    stands.forEach(function (st) {
      var p = standXY(st); if (!p) return;
      if (st.area === 'self-sufficient') o.push('<circle cx="' + r1(p[0] + 9) + '" cy="' + r1(p[1] + 5) + '" r="3.2" fill="#5a3a22" stroke="#8a6a4a" stroke-width="1.2"/><circle cx="' + r1(p[0] + 9) + '" cy="' + r1(p[1] + 5) + '" r="1.3" fill="#f59a2f"/>');
      else o.push('<g transform="translate(' + r1(p[0] + 8) + ' ' + r1(p[1] - 11) + ')"><rect x="-.5" y="1.5" width="11" height="8" fill="rgba(0,0,0,.2)"/><rect x="-2" y="0" width="11" height="8" rx="1" fill="#efe4cf" stroke="#9c7b55" stroke-width=".8"/><rect x="-3" y="-1.5" width="13" height="3" rx="1" fill="#7a5a3c"/></g>');
    });
    // buildings (as on the picture)
    HOUSES.forEach(function (b) { o.push('<rect x="' + r1(b[0] + 2) + '" y="' + r1(b[1] + 3) + '" width="' + b[2] + '" height="' + b[3] + '" fill="rgba(0,0,0,.22)"/><rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="1.5" fill="#8f8f8a" stroke="#6d6d66" stroke-width=".8"/><path d="M' + b[0] + ' ' + r1(b[1] + b[3] / 2) + 'h' + b[2] + '" stroke="#6d6d66" stroke-width="1"/>'); });
    var b = POOLR, l = LAPA;
    o.push('<rect x="' + r1(l[0] + 2) + '" y="' + r1(l[1] + 2) + '" width="' + l[2] + '" height="' + l[3] + '" fill="rgba(0,0,0,.2)"/><rect x="' + l[0] + '" y="' + l[1] + '" width="' + l[2] + '" height="' + l[3] + '" rx="2" fill="#9a9a94" stroke="#77776f" stroke-width=".8"/>');
    o.push('<rect x="' + r1(b[0] - 2.5) + '" y="' + r1(b[1] - 2.5) + '" width="' + r1(b[2] + 5) + '" height="' + r1(b[3] + 5) + '" rx="2" fill="#ece4d2"/><rect x="' + b[0] + '" y="' + b[1] + '" width="' + b[2] + '" height="' + b[3] + '" rx="1.5" fill="#4fb3cf"/><path d="M' + r1(b[0] + 2) + ' ' + r1(b[1] + 5) + 'q3 -2 6 0t6 0" stroke="#bdeaf3" stroke-width="1.1" fill="none"/>');
    // trees: kept off the roads, clearings, buildings and water (fast grid lookup)
    var CELL = 3, gw = Math.ceil(W / CELL) + 1, gh = Math.ceil(H / CELL) + 1, busy = new Uint8Array(gw * gh);
    function mark(x, y, rad) { var r = Math.ceil(rad / CELL); var cx = Math.round(x / CELL), cy = Math.round(y / CELL); for (var dy = -r; dy <= r; dy++) for (var dx = -r; dx <= r; dx++) { var X = cx + dx, Y = cy + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh && dx * dx + dy * dy <= r * r) busy[Y * gw + X] = 1; } }
    ROADS.concat([G.perimeter.map(sc).concat([sc(G.perimeter[0])])]).forEach(function (L) { densify(L, 2.5).forEach(function (p) { mark(p[0], p[1], 7); }); });
    densify(SPRUIT.length ? SPRUIT : [[0, 0], [0, 0]], 4).forEach(function (p) { mark(p[0], p[1], 16); });
    spots.forEach(function (p) { mark(p[0], p[1], 22); });
    HOUSES.concat([POOLR, LAPA]).forEach(function (r) { mark(r[0] + r[2] / 2, r[1] + r[3] / 2, Math.max(r[2], r[3]) * .75 + 4); });
    var palette = ['#4f6b2c', '#5d7a34', '#3f5a26', '#6b8a3a', '#56722f'];
    var trees = [], tries = 0;
    while (trees.length < 520 && tries < 9000) {
      tries++;
      var x = R() * W, y = R() * H, rr = 3 + R() * 6.5;
      var cxg = Math.round(x / CELL), cyg = Math.round(y / CELL), rg = Math.ceil(rr / CELL), hit = false;
      for (var dy = -rg; dy <= rg && !hit; dy++) for (var dx = -rg; dx <= rg; dx++) { var X = cxg + dx, Y = cyg + dy; if (X >= 0 && Y >= 0 && X < gw && Y < gh && busy[Y * gw + X]) { hit = true; break; } }
      if (hit) continue;
      var near = false;
      for (var k = Math.max(0, trees.length - 400); k < trees.length; k++) if (Math.abs(trees[k][0] - x) < 14 && Math.hypot(trees[k][0] - x, trees[k][1] - y) < (trees[k][2] + rr) * .85) { near = true; break; }
      if (near) continue;
      trees.push([x, y, rr]);
    }
    trees.sort(function (a, b2) { return a[1] - b2[1]; });
    trees.forEach(function (t) {
      var c = palette[Math.floor(R() * palette.length)], acacia = R() < .25;
      if (acacia) o.push('<ellipse cx="' + r1(t[0] + 2) + '" cy="' + r1(t[1] + 3) + '" rx="' + r1(t[2] * 1.6) + '" ry="' + r1(t[2] * .8) + '" fill="rgba(40,25,10,.22)"/><ellipse cx="' + r1(t[0]) + '" cy="' + r1(t[1]) + '" rx="' + r1(t[2] * 1.6) + '" ry="' + r1(t[2] * .75) + '" fill="' + c + '"/><ellipse cx="' + r1(t[0] - t[2] * .4) + '" cy="' + r1(t[1] - t[2] * .2) + '" rx="' + r1(t[2] * .8) + '" ry="' + r1(t[2] * .3) + '" fill="#8aa555" opacity=".55"/>');
      else o.push('<circle cx="' + r1(t[0] + 2) + '" cy="' + r1(t[1] + 3) + '" r="' + r1(t[2]) + '" fill="rgba(40,25,10,.22)"/><circle cx="' + r1(t[0]) + '" cy="' + r1(t[1]) + '" r="' + r1(t[2]) + '" fill="' + c + '"/><circle cx="' + r1(t[0] - t[2] * .3) + '" cy="' + r1(t[1] - t[2] * .3) + '" r="' + r1(t[2] * .45) + '" fill="#8aa555" opacity=".5"/>');
    });
    // fence: just outside the perimeter road, with posts
    o.push('<path d="' + poly(FENCE) + 'Z" fill="none" stroke="#3b2a1a" stroke-width="1.8" stroke-dasharray="7 4" stroke-linejoin="round"/>');
    densify(FENCE.concat([FENCE[0]]), 18).forEach(function (p) { o.push('<circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="1.5" fill="#3b2a1a"/>'); });
    // labels
    var gate = sc([258, 62]);
    o.push('<g class="cm-labels">' +
      '<text x="' + r1(gate[0] + 8) + '" y="13" class="cm-small" text-anchor="start">↑ Kaallaagte Rd · Tau Gate</text>' +
      '<g transform="translate(' + gate[0] + ' ' + gate[1] + ')"><rect x="-15" y="-6" width="30" height="12" rx="6" fill="#2a1b12"/><text y="3.5" class="cm-tag" text-anchor="middle">GATE</text></g>' +
      '<text x="' + sc([136, 0])[0] + '" y="' + sc([0, 190])[1] + '" class="cm-small" text-anchor="end">Reception</text>' +
      '<text x="' + sc([262, 0])[0] + '" y="' + sc([0, 216])[1] + '" class="cm-small" text-anchor="end">Pool &amp; lapa</text>' +
      '<text x="' + r1(sc([135, 262])[0]) + '" y="' + r1(sc([135, 262])[1]) + '" class="cm-area" text-anchor="middle">FENCED</text>' +
      '<text x="' + r1(sc([1035, 75])[0]) + '" y="' + r1(sc([1035, 75])[1]) + '" class="cm-area" text-anchor="middle">OPEN BUSH CAMP · UNFENCED</text>' +
      (SPRUIT.length ? '<text class="cm-water"><textPath href="#cm-spruit" xlink:href="#cm-spruit" startOffset="60%">Kaallaagte Spruit</textPath></text>' : '') +
      '<text x="' + r1(sc([1230, 520])[0]) + '" y="' + r1(sc([1230, 520])[1]) + '" class="cm-area cm-ss" text-anchor="middle">SELF-SUFFICIENT</text>' +
      '</g>');
    // compass
    o.push('<g transform="translate(962 34)"><circle r="17" fill="rgba(255,252,246,.85)" stroke="#5a3d26" stroke-width="1.2"/><path d="M0 -13 L4.5 2 L0 -1 L-4.5 2Z" fill="#b8461a"/><path d="M0 13 L4.5 -2 L0 1 L-4.5 -2Z" fill="#5a3d26" opacity=".5"/></g>');
    o.push('<rect width="' + W + '" height="' + H + '" fill="url(#cm-vig)" pointer-events="none"/>');
    return (baseCache[key] = o.join(''));
  }

  /* ---------- wildlife ---------- */
  var SHAPES = {
    hyena: { w: 40, h: 24, name: 'Spotted hyena', speed: 15, fill: '#6f5236',
      d: 'M3 12C4 9 8 8 12 8L23 4.5C26 3.6 29 3.5 31 5L33.5 4.5L35 6.5L38 8C39 9.5 38 11 36 11L33 11.5L31 13.5L30.5 23H28.3L27.8 15L26 15L25.4 23H23.2L22.6 14.5L14 14.5L13.2 23H11L10.8 15.5L9.2 15.5L8.6 23H6.4L6 15C5 14.6 4.4 14 4 13.2L1.4 17L.4 16.4Z',
      spots: [[16, 10, 1.4], [20, 8, 1.2], [13, 12, 1.1], [24, 9.5, 1.3], [18, 12.5, 1]], spotFill: '#3e2c1c' },
    jackal: { w: 36, h: 22, name: 'Black-backed jackal', speed: 24, fill: '#b9773a',
      d: 'M8 10C10 8 22 8 26 9L28.5 6L29.6 1.5L31 5L32.4 1.5L33.2 6L36 8.2L35 10L31.5 11L29.4 13L28.6 21H27L26.2 14.5L13.4 14.5L12.5 21H10.9L10.3 14.2C8.6 13.6 7.4 12.6 6.6 11.4L1.2 14.2L.4 12.8L5.6 9.6Z',
      saddle: 'M9.5 9.6C12 8.2 21 7.8 25.5 8.8L24.5 11C20 10.4 13 10.6 9.5 11.4Z', saddleFill: '#2f241b' }
  };
  function animalSVG(kind, id) {
    var s = SHAPES[kind], g = '<g class="cm-animal cm-' + kind + '" data-a="' + id + '"><title>' + s.name + ' (wild animals roam the unfenced camp)</title><g class="cm-flip"><g class="cm-bob" transform="translate(' + (-s.w / 2) + ' ' + (-s.h) + ')">';
    g += '<ellipse cx="' + s.w / 2 + '" cy="' + (s.h - .5) + '" rx="' + s.w * .42 + '" ry="2.4" fill="rgba(30,18,8,.28)"/>';
    g += '<path d="' + s.d + '" fill="' + s.fill + '" stroke="#2a1b12" stroke-width=".7" stroke-linejoin="round"/>';
    if (s.spots) s.spots.forEach(function (p) { g += '<circle cx="' + p[0] + '" cy="' + p[1] + '" r="' + p[2] + '" fill="' + s.spotFill + '"/>'; });
    if (s.saddle) g += '<path d="' + s.saddle + '" fill="' + s.saddleFill + '"/>';
    g += '<circle cx="' + (kind === 'hyena' ? 34.5 : 32.6) + '" cy="' + (kind === 'hyena' ? 7.4 : 7.2) + '" r=".9" fill="#120a04"/>';
    return g + '</g></g></g>';
  }
  function startWildlife(svg, host) {
    var R = Math.random, herd = [], last = 0, raf = 0, visible = true;
    var kinds = ['jackal', 'jackal', 'hyena', 'hyena'];
    kinds.forEach(function (k, i) {
      var el = svg.querySelector('[data-a="' + i + '"]');
      var a = { kind: k, el: el, flip: el.querySelector('.cm-flip'), bob: el.querySelector('.cm-bob'), x: ROAM.x0 + R() * (ROAM.x1 - ROAM.x0), y: ROAM.y0 + R() * (ROAM.y1 - ROAM.y0), tx: 0, ty: 0, pause: R() * 2, dir: 1, phase: R() * 6, speed: SHAPES[k].speed * (.85 + R() * .3) };
      pick(a); herd.push(a);
    });
    // hyenas like to travel together
    herd[3].x = herd[2].x + 30; herd[3].y = herd[2].y + 12;
    function pick(a, near) {
      var cx = near ? near.tx : a.x, cy = near ? near.ty : a.y, d = near ? 40 : 90 + R() * 160, ang = R() * Math.PI * 2;
      a.tx = Math.min(ROAM.x1, Math.max(ROAM.x0, cx + Math.cos(ang) * d));
      a.ty = Math.min(ROAM.y1, Math.max(ROAM.y0, cy + Math.sin(ang) * d * .7));
    }
    function draw(a, moving, t) {
      var bob = moving ? Math.abs(Math.sin(t * (a.kind === 'jackal' ? 14 : 10) + a.phase)) * -1.4 : 0;
      a.el.setAttribute('transform', 'translate(' + r1(a.x) + ' ' + r1(a.y) + ')');
      a.flip.setAttribute('transform', 'scale(' + a.dir + ' 1)');
      a.bob.setAttribute('transform', 'translate(' + (-SHAPES[a.kind].w / 2) + ' ' + r1(-SHAPES[a.kind].h + bob) + ')');
    }
    function tick(ts) {
      raf = 0; if (!visible || document.hidden) return;
      var t = ts / 1000, dt = last ? Math.min(.1, t - last) : 0; last = t;
      herd.forEach(function (a, i) {
        if (a.pause > 0) { a.pause -= dt; draw(a, false, t); return; }
        var dx = a.tx - a.x, dy = a.ty - a.y, dist = Math.hypot(dx, dy);
        if (dist < 2) { a.pause = R() < .55 ? 1 + R() * 3.5 : 0; pick(a, a.kind === 'hyena' && i === 3 ? herd[2] : null); draw(a, false, t); return; }
        var step = Math.min(dist, a.speed * dt);
        a.x += dx / dist * step; a.y += dy / dist * step;
        if (Math.abs(dx) > .5) a.dir = dx > 0 ? 1 : -1;
        draw(a, true, t);
      });
      raf = requestAnimationFrame(tick);
    }
    herd.forEach(function (a) { draw(a, false, 0); });
    if (reduce) return;
    new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible && !raf) { last = 0; raf = requestAnimationFrame(tick); } }).observe(host);
    document.addEventListener('visibilitychange', function () { if (!document.hidden && visible && !raf) { last = 0; raf = requestAnimationFrame(tick); } });
  }

  /* ---------- interactive map ---------- */
  // opts: { stands, info(st) → {free, price, sub}, onOpen(st), area() → '' | areaKey }
  K.campMap = function (host, opts) {
    host.classList.add('campmap');
    host.innerHTML = '<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Illustrated map of Kyleu Bush Camp: the fenced camp with Inside 1-7 on the left, open unfenced stands 1-10 on the right and self-sufficient stands S1-S6 along the Kaallaagte spruit">' + terrain(opts.stands) +
      '<g class="cm-wildlife">' + animalSVG('jackal', 0) + animalSVG('jackal', 1) + animalSVG('hyena', 2) + animalSVG('hyena', 3) + '</g></svg><div class="map-bubble" hidden></div>';
    var svg = host.querySelector('svg'), bubble = host.querySelector('.map-bubble'), pins = [], current = null, hideT, lastPointer = 'mouse';
    startWildlife(svg, host);

    function label(st) { var n = st.name.replace(/[^0-9]/g, ''); return (st.area === 'self-sufficient' ? 'S' : '') + (n || '•'); }
    function showBubble(st, pin) {
      clearTimeout(hideT); current = st;
      pins.forEach(function (p) { p.el.classList.toggle('on', p.st === st); });
      var inf = opts.info(st), touch = lastPointer !== 'mouse';
      var img = st.photos[0] || ({ fenced: 'assets/img/photos/fenced-camp-lawn.jpg', unfenced: 'assets/img/photos/trailer-unfenced.jpg', 'self-sufficient': 'assets/img/wildlife/tree-sunset.jpg' })[st.area];
      bubble.innerHTML = '<img src="' + img + '" alt=""><div class="mb-body"><span class="badge area-' + st.area + '">' + st.areaInfo.short + (st.status === 'new' ? ' · New' : '') + '</span><b>' + K.esc(st.name) + '</b><small>Up to ' + st.guests + ' guests · ' + K.esc(st.setups) + '</small>' +
        '<div class="mb-row">' + (inf.free === null || inf.free === undefined ? '' : inf.free ? '<span class="mb-status ok">● Available</span>' : '<span class="mb-status bad">● Booked</span>') + '<span class="mb-price">' + inf.price + (inf.sub ? '<small>' + inf.sub + '</small>' : '') + '</span></div>' +
        (touch ? '<button type="button" class="btn btn-sm btn-block mb-go">' + (inf.free === false ? 'See other dates' : 'Book this stand') + '</button>' : '<span class="mb-cta">' + (inf.free === false ? 'Click to see other dates' : 'Click to book') + ' →</span>') + '</div>';
      bubble.classList.toggle('touch', touch);
      bubble.hidden = false;
      var below = st.map.y < 42;
      bubble.classList.toggle('below', below);
      var hw = host.clientWidth, bw = bubble.offsetWidth, px = st.map.x / 100 * hw;
      var left = Math.min(Math.max(px, bw / 2 + 8), hw - bw / 2 - 8);
      bubble.style.left = left + 'px'; bubble.style.top = st.map.y + '%';
      bubble.style.setProperty('--arrow', (px - left) + 'px');
      var go = bubble.querySelector('.mb-go'); if (go) go.onclick = function (e) { e.stopPropagation(); hideBubble(true); opts.onOpen(st); };
    }
    function hideBubble(now) {
      clearTimeout(hideT);
      var f = function () { bubble.hidden = true; current = null; pins.forEach(function (p) { p.el.classList.remove('on'); }); };
      if (now) f(); else hideT = setTimeout(f, 160);
    }
    opts.stands.forEach(function (st) {
      if (!st.map) return;
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pin area-' + st.area;
      b.style.left = st.map.x + '%'; b.style.top = st.map.y + '%'; b.textContent = label(st);
      b.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; });
      b.addEventListener('mouseenter', function () { if (lastPointer === 'mouse') showBubble(st, b); });
      b.addEventListener('mouseleave', function () { if (lastPointer === 'mouse') hideBubble(); });
      b.addEventListener('focus', function () { showBubble(st, b); });
      b.addEventListener('blur', function () { hideBubble(); });
      b.addEventListener('click', function (e) {
        e.stopPropagation();
        if (lastPointer !== 'mouse' && current !== st) { showBubble(st, b); return; }   // first tap on phones = preview
        hideBubble(true); opts.onOpen(st);
      });
      host.appendChild(b); pins.push({ st: st, el: b });
    });
    host.addEventListener('pointerdown', function (e) { lastPointer = e.pointerType || 'mouse'; if (!e.target.closest('.pin') && !e.target.closest('.map-bubble')) hideBubble(true); });
    bubble.addEventListener('mouseenter', function () { clearTimeout(hideT); });
    bubble.addEventListener('mouseleave', function () { hideBubble(); });

    // map-position helper for the Kyleu team: add ?mapedit to the address
    if (/[?&]mapedit/.test(location.search)) {
      host.style.cursor = 'crosshair';
      svg.addEventListener('click', function (e) {
        var r = svg.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width * 100).toFixed(1), y = ((e.clientY - r.top) / r.height * 100).toFixed(1);
        var txt = 'Map position: ' + x + ', ' + y;
        try { navigator.clipboard.writeText(txt); } catch (err) {}
        if (K.toast) K.toast(txt + '  (copied, paste it into stands.md)');
      });
    }

    function update() {
      var area = opts.area ? opts.area() : '';
      pins.forEach(function (p) {
        var inf = opts.info(p.st);
        p.el.classList.toggle('avail', inf.free === true); p.el.classList.toggle('booked', inf.free === false);
        p.el.classList.toggle('dim', !!area && p.st.area !== area);
        p.el.setAttribute('aria-label', p.st.name + (inf.free === true ? ', available' : inf.free === false ? ', booked' : '') + '. ' + inf.price);
      });
      if (current) { var pin = pins.filter(function (p) { return p.st === current; })[0]; if (pin) showBubble(current, pin.el); }
    }
    update();
    return { update: update };
  };

  // shared pieces for the "day at Kyleu" scene (campscene.js)
  K.campMapParts = { terrain: terrain, smooth: smooth, standXY: standXY, DRIVE: DRIVE, W: W, H: H, POOL: POOLR, RECEPTION: RECEPTION, ROAM: ROAM, FENCE: FENCE, GATE: sc([258, 62]) };

  /* ---------- small zoomed map for a single stand ---------- */
  K.campMapMini = function (stands, id) {
    var st = stands.filter(function (s) { return s.id === id; })[0]; if (!st || !st.map) return '';
    var p = standXY(st), w = 340, h = 190, x = Math.min(Math.max(p[0] - w / 2, 0), W - w), y = Math.min(Math.max(p[1] - h / 2, 0), H - h);
    return '<svg viewBox="' + r1(x) + ' ' + r1(y) + ' ' + w + ' ' + h + '" role="img" aria-label="Where ' + K.esc(st.name) + ' is in the camp">' + terrain(stands) +
      '<g transform="translate(' + r1(p[0]) + ' ' + r1(p[1]) + ')"><circle r="14" fill="none" stroke="#e8731c" stroke-width="3"><animate attributeName="r" values="12;26;12" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/></circle><circle r="11" fill="#e8731c" stroke="#fff" stroke-width="3"/><text y="4" text-anchor="middle" class="cm-pinlabel">' + ((st.area === 'self-sufficient' ? 'S' : '') + st.name.replace(/[^0-9]/g, '')) + '</text></g></svg>';
  };
})();
