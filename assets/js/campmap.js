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
  var W = 1000, H = 560;
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

  /* ---------- the camp's fixed geography ---------- */
  var FENCE = [[40, 48], [372, 80], [425, 446], [12, 455]];
  var SPRUIT = [[300, 572], [420, 548], [520, 540], [660, 542], [760, 520], [860, 506], [940, 490], [1010, 482]];
  var ROADS = [
    [[200, -10], [205, 64]],                                                    // from Kaallaagte Road
    [[205, 64], [150, 120], [95, 200], [80, 270], [87, 330]],
    [[87, 330], [91, 395], [150, 425], [204, 400], [204, 363]],
    [[150, 425], [250, 420], [308, 376]],
    [[205, 64], [240, 150], [199, 264]],
    [[240, 150], [264, 220], [264, 273]],
    [[264, 220], [330, 240], [372, 280]],
    [[240, 150], [320, 120], [390, 110], [424, 70]],
    [[390, 110], [460, 135], [514, 139], [570, 110], [608, 85]],
    [[570, 110], [620, 150], [663, 194], [710, 170], [755, 130]],
    [[710, 170], [780, 185], [847, 152]],
    [[780, 185], [800, 220], [794, 257]],
    [[847, 152], [890, 200], [925, 263]],
    [[460, 135], [490, 210], [530, 260], [580, 290], [631, 276], [700, 265], [794, 257]],
    [[580, 290], [570, 380], [560, 460], [560, 505]],
    [[560, 460], [510, 480], [465, 500]],
    [[560, 460], [610, 480], [650, 505]],
    [[700, 265], [740, 360], [770, 470]],
    [[740, 360], [800, 400], [840, 430], [915, 440]]
  ];
  var ROAM = { x0: 440, x1: 975, y0: 40, y1: 450 };   // where wildlife may wander (unfenced)
  var BUILDINGS = { house: [92, 86, 58, 34], cottage: [104, 132, 30, 20], pool: [212, 104, 46, 24], lapa: [266, 98, 34, 32] };

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
    // ground
    o.push('<rect width="' + W + '" height="' + H + '" fill="#cdb880"/>');
    // grass patches
    for (var i = 0; i < 46; i++) o.push('<ellipse cx="' + r1(R() * W) + '" cy="' + r1(R() * H) + '" rx="' + r1(30 + R() * 70) + '" ry="' + r1(18 + R() * 40) + '" fill="' + (R() > .5 ? '#c4b177' : '#d4c08c') + '" opacity=".7"/>');
    // fenced camp ground (a little greener, it's watered)
    var fp = FENCE.map(function (p) { return p.join(','); }).join(' ');
    o.push('<polygon points="' + fp + '" fill="#c3bd84" opacity=".85"/>');
    o.push('<ellipse cx="165" cy="118" rx="98" ry="62" fill="#9fb466" opacity=".9"/>');                  // lawn
    o.push('<rect width="' + W + '" height="' + H + '" fill="#cdb880" filter="url(#cm-grain)" opacity=".9"/>');
    // spruit (stream) with green banks
    var sp = smooth(SPRUIT);
    o.push('<path d="' + sp + '" fill="none" stroke="#8fa25a" stroke-width="46" stroke-linecap="round" opacity=".55"/>');
    o.push('<path d="' + sp + '" fill="none" stroke="#7d9a52" stroke-width="26" stroke-linecap="round" opacity=".7"/>');
    o.push('<path id="cm-spruit" d="' + sp + '" fill="none" stroke="url(#cm-water)" stroke-width="10" stroke-linecap="round"/>');
    o.push('<path d="' + sp + '" fill="none" stroke="#bfe0e6" stroke-width="2" stroke-dasharray="8 14" stroke-linecap="round" opacity=".8"><animate attributeName="stroke-dashoffset" from="0" to="-44" dur="3s" repeatCount="indefinite"/></path>');
    // roads (edge + surface + centre wear)
    var roadPts = [];
    ROADS.forEach(function (p) { roadPts = roadPts.concat(densify(p, 7)); });
    var rd = ROADS.map(smooth).join(' ');
    o.push('<path d="' + rd + '" fill="none" stroke="#a9875a" stroke-width="13" stroke-linecap="round" stroke-linejoin="round" opacity=".55"/>');
    o.push('<path d="' + rd + '" fill="none" stroke="#e3c793" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/>');
    o.push('<path d="' + rd + '" fill="none" stroke="#efd9ad" stroke-width="2" stroke-dasharray="3 7" stroke-linecap="round"/>');
    // stand clearings
    var spots = [];
    stands.forEach(function (st) {
      var p = standXY(st); if (!p) return; spots.push(p);
      o.push('<ellipse cx="' + r1(p[0]) + '" cy="' + r1(p[1] + 4) + '" rx="30" ry="21" fill="#e6cc9a" stroke="#c9a66e" stroke-width="1.5"/>');
      if (st.area === 'self-sufficient') {
        o.push('<circle cx="' + r1(p[0] + 17) + '" cy="' + r1(p[1] + 10) + '" r="4.5" fill="#5a3a22" stroke="#8a6a4a" stroke-width="1.5"/><circle cx="' + r1(p[0] + 17) + '" cy="' + r1(p[1] + 10) + '" r="1.8" fill="#f59a2f"/>');
      } else {
        // little private ablution block
        o.push('<g transform="translate(' + r1(p[0] + 17) + ' ' + r1(p[1] - 15) + ')"><rect x="-1" y="2" width="15" height="11" fill="rgba(0,0,0,.18)"/><rect x="-3" y="0" width="15" height="11" rx="1" fill="#efe4cf" stroke="#9c7b55" stroke-width="1"/><rect x="-4" y="-2" width="17" height="4" rx="1" fill="#7a5a3c"/></g>');
      }
    });
    // buildings around the lawn
    var b = BUILDINGS;
    o.push('<g><rect x="' + (b.house[0] + 3) + '" y="' + (b.house[1] + 4) + '" width="' + b.house[2] + '" height="' + b.house[3] + '" fill="rgba(0,0,0,.2)"/><rect x="' + b.house[0] + '" y="' + b.house[1] + '" width="' + b.house[2] + '" height="' + b.house[3] + '" rx="2" fill="#9a7a5a"/><path d="M' + b.house[0] + ' ' + (b.house[1] + b.house[3] / 2) + 'h' + b.house[2] + '" stroke="#7e6046" stroke-width="2"/>' +
      '<rect x="' + b.cottage[0] + '" y="' + b.cottage[1] + '" width="' + b.cottage[2] + '" height="' + b.cottage[3] + '" rx="2" fill="#a88a68"/>' +
      '<rect x="' + (b.pool[0] - 4) + '" y="' + (b.pool[1] - 4) + '" width="' + (b.pool[2] + 8) + '" height="' + (b.pool[3] + 8) + '" rx="3" fill="#e9e1cf"/><rect x="' + b.pool[0] + '" y="' + b.pool[1] + '" width="' + b.pool[2] + '" height="' + b.pool[3] + '" rx="2" fill="#4fb3cf"/><path d="M' + (b.pool[0] + 6) + ' ' + (b.pool[1] + 9) + 'q6 -4 12 0t12 0" stroke="#bdeaf3" stroke-width="1.6" fill="none"/>' +
      '<rect x="' + (b.lapa[0] + 3) + '" y="' + (b.lapa[1] + 3) + '" width="' + b.lapa[2] + '" height="' + b.lapa[3] + '" fill="rgba(0,0,0,.2)"/><rect x="' + b.lapa[0] + '" y="' + b.lapa[1] + '" width="' + b.lapa[2] + '" height="' + b.lapa[3] + '" rx="3" fill="#b88d55"/><path d="M' + b.lapa[0] + ' ' + b.lapa[1] + 'l' + b.lapa[2] + ' ' + b.lapa[3] + 'M' + (b.lapa[0] + b.lapa[2]) + ' ' + b.lapa[1] + 'l-' + b.lapa[2] + ' ' + b.lapa[3] + '" stroke="#9a7344" stroke-width="1.2"/></g>');
    // trees (kept off roads, clearings, buildings and water)
    var palette = ['#4f6b2c', '#5d7a34', '#3f5a26', '#6b8a3a', '#56722f'];
    function spruitY(x) { for (var i = 0; i < SPRUIT.length - 1; i++) { var a = SPRUIT[i], c = SPRUIT[i + 1]; if (x >= a[0] && x <= c[0]) return a[1] + (c[1] - a[1]) * (x - a[0]) / (c[0] - a[0]); } return 9999; }
    var trees = [], tries = 0;
    while (trees.length < 330 && tries < 6000) {
      tries++;
      var x = R() * W, y = R() * H, rr = 4 + R() * 8;
      var inFence = inPoly(x, y, FENCE);
      if (inFence && R() < .45) continue;
      if (x > 50 && x < 310 && y > 60 && y < 175) continue;                          // lawn & buildings
      if (Math.abs(y - spruitY(x)) < 22) continue;
      var near = false, k;
      for (k = 0; k < roadPts.length; k += 1) { if (Math.abs(roadPts[k][0] - x) < 15 + rr && Math.abs(roadPts[k][1] - y) < 15 + rr && Math.hypot(roadPts[k][0] - x, roadPts[k][1] - y) < 11 + rr) { near = true; break; } }
      if (near) continue;
      for (k = 0; k < spots.length; k++) if (Math.hypot(spots[k][0] - x, spots[k][1] - y) < 40 + rr) { near = true; break; }
      if (near) continue;
      for (k = 0; k < trees.length; k++) if (Math.hypot(trees[k][0] - x, trees[k][1] - y) < (trees[k][2] + rr) * .8) { near = true; break; }
      if (near) continue;
      trees.push([x, y, rr]);
    }
    trees.sort(function (a, b) { return a[1] - b[1]; });
    trees.forEach(function (t) {
      var c = palette[Math.floor(R() * palette.length)], acacia = R() < .25;
      if (acacia) o.push('<ellipse cx="' + r1(t[0] + 3) + '" cy="' + r1(t[1] + 4) + '" rx="' + r1(t[2] * 1.6) + '" ry="' + r1(t[2] * .8) + '" fill="rgba(40,25,10,.22)"/><ellipse cx="' + r1(t[0]) + '" cy="' + r1(t[1]) + '" rx="' + r1(t[2] * 1.6) + '" ry="' + r1(t[2] * .75) + '" fill="' + c + '"/><ellipse cx="' + r1(t[0] - t[2] * .4) + '" cy="' + r1(t[1] - t[2] * .2) + '" rx="' + r1(t[2] * .8) + '" ry="' + r1(t[2] * .3) + '" fill="#8aa555" opacity=".55"/>');
      else o.push('<circle cx="' + r1(t[0] + 3) + '" cy="' + r1(t[1] + 4) + '" r="' + r1(t[2]) + '" fill="rgba(40,25,10,.22)"/><circle cx="' + r1(t[0]) + '" cy="' + r1(t[1]) + '" r="' + r1(t[2]) + '" fill="' + c + '"/><circle cx="' + r1(t[0] - t[2] * .3) + '" cy="' + r1(t[1] - t[2] * .3) + '" r="' + r1(t[2] * .45) + '" fill="#8aa555" opacity=".5"/>');
    });
    // fence with posts
    var fpath = 'M' + FENCE.map(function (p) { return p.join(' '); }).join(' L') + ' Z';
    o.push('<path d="' + fpath + '" fill="none" stroke="#5a3d26" stroke-width="2.4" stroke-dasharray="10 5" stroke-linejoin="round"/>');
    densify(FENCE.concat([FENCE[0]]), 26).forEach(function (p) { o.push('<circle cx="' + r1(p[0]) + '" cy="' + r1(p[1]) + '" r="2" fill="#4a3220"/>'); });
    // labels
    o.push('<g class="cm-labels">' +
      '<text x="212" y="22" class="cm-small" text-anchor="start">↑ Kaallaagte Rd · Tau Gate</text>' +
      '<g transform="translate(205 64)"><rect x="-17" y="-7" width="34" height="14" rx="7" fill="#2a1b12"/><text y="4" class="cm-tag" text-anchor="middle">GATE</text></g>' +
      '<text x="122" y="80" class="cm-small" text-anchor="middle">Reception</text>' +
      '<text x="235" y="146" class="cm-small" text-anchor="middle">Pool &amp; lapa</text>' +
      '<text x="210" y="485" class="cm-area" text-anchor="middle">FENCED CAMP</text>' +
      '<text x="690" y="26" class="cm-area" text-anchor="middle">OPEN BUSH CAMP · UNFENCED</text>' +
      '<text class="cm-water"><textPath href="#cm-spruit" xlink:href="#cm-spruit" startOffset="58%">Kaallaagte Spruit</textPath></text>' +
      '<text x="985" y="400" class="cm-area cm-ss" text-anchor="end">SELF-SUFFICIENT</text>' +
      '</g>');
    // compass
    o.push('<g transform="translate(958 46)"><circle r="20" fill="rgba(255,252,246,.85)" stroke="#5a3d26" stroke-width="1.2"/><path d="M0 -15 L5 2 L0 -1 L-5 2Z" fill="#b8461a"/><path d="M0 15 L5 -2 L0 1 L-5 -2Z" fill="#5a3d26" opacity=".5"/><text y="-21" text-anchor="middle" class="cm-tag" style="fill:#2a1b12">N</text></g>');
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

  /* ---------- small zoomed map for a single stand ---------- */
  K.campMapMini = function (stands, id) {
    var st = stands.filter(function (s) { return s.id === id; })[0]; if (!st || !st.map) return '';
    var p = standXY(st), w = 340, h = 190, x = Math.min(Math.max(p[0] - w / 2, 0), W - w), y = Math.min(Math.max(p[1] - h / 2, 0), H - h);
    return '<svg viewBox="' + r1(x) + ' ' + r1(y) + ' ' + w + ' ' + h + '" role="img" aria-label="Where ' + K.esc(st.name) + ' is in the camp">' + terrain(stands) +
      '<g transform="translate(' + r1(p[0]) + ' ' + r1(p[1]) + ')"><circle r="14" fill="none" stroke="#e8731c" stroke-width="3"><animate attributeName="r" values="12;26;12" dur="2s" repeatCount="indefinite"/><animate attributeName="opacity" values="1;0;1" dur="2s" repeatCount="indefinite"/></circle><circle r="11" fill="#e8731c" stroke="#fff" stroke-width="3"/><text y="4" text-anchor="middle" class="cm-pinlabel">' + ((st.area === 'self-sufficient' ? 'S' : '') + st.name.replace(/[^0-9]/g, '')) + '</text></g></svg>';
  };
})();
