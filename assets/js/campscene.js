/* =========================================================
   "A day at Kyleu": a living camp map driven by scrolling
   - Scroll moves the clock from 05:30 to 22:30
   - Light changes, campers arrive and set up, people walk around,
     the game drive leaves reception, swimmers fill the pool,
     braai fires get lit at night
   - Plains game (wildebeest, zebra, impala) is busy morning and
     late afternoon, rests at midday and disappears after dark.
     Jackals and hyenas come out after 17:00 with glowing eyes.
   Uses the shared map drawing from campmap.js (Kyleu.campMapParts).
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var W = 1000, H = 452.4, H0 = 5.5, H1 = 22.5, AS = .62;   // AS = animal size on this map

  function hash01(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 10000) / 10000; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function ramp(h, a, b) { return clamp((h - a) / (b - a), 0, 1); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function hex(c) { return [parseInt(c.substr(1, 2), 16), parseInt(c.substr(3, 2), 16), parseInt(c.substr(5, 2), 16)]; }
  function keyframes(list, h) {
    if (h <= list[0][0]) return list[0];
    for (var i = 0; i < list.length - 1; i++) {
      var a = list[i], b = list[i + 1];
      if (h >= a[0] && h <= b[0]) {
        var t = (h - a[0]) / (b[0] - a[0]), ca = hex(a[1]), cb = hex(b[1]);
        return [h, 'rgb(' + ca.map(function (v, j) { return Math.round(v + (cb[j] - v) * t); }).join(',') + ')', a[2] + (b[2] - a[2]) * t];
      }
    }
    return list[list.length - 1];
  }
  function fmt(h) { var hh = Math.floor(h), mm = Math.floor((h - hh) * 60 / 5) * 5; return (hh < 10 ? '0' : '') + hh + ':' + (mm < 10 ? '0' : '') + mm; }

  /* ---------- light over the map, and the sky around it ---------- */
  var LIGHT = [[5.5, '#2b3566', .62], [6.3, '#ff9a5a', .4], [7.5, '#ffd9a8', .12], [8.6, '#ffffff', 0], [15.6, '#ffffff', 0], [17, '#ffcf87', .16], [17.9, '#ff8a3d', .36], [18.7, '#8a4a7a', .52], [19.6, '#15204a', .68], [22.5, '#0b1233', .74]];
  var SKY = [[5.5, '#161c38', 1], [6.4, '#4a2e2c', 1], [8, '#1f2a1c', 1], [16, '#1f2a1c', 1], [17.9, '#4a2616', 1], [19.4, '#10162c', 1], [22.5, '#080c1c', 1]];

  /* ---------- side-view animals (facing right) ---------- */
  var BEASTS = {
    wildebeest: { w: 34, h: 22, fill: '#47423b', d: 'M3 12C4 9 9 8 14 8L22 5C25 3.6 28 4 30 6L33 9L34 13L31.5 14L29.5 12.6L28.6 13.4L28 21H26L25.5 14.6L13.4 14.6L12.8 21H10.8L10.3 14.2C7.6 13.8 5.4 13.2 4.2 12.6L2.2 16.4L1.2 15.8Z', extra: '<path d="M27.4 5.6c1.1-2.6 3.6-3.3 5.3-2.3" stroke="#221d18" stroke-width="1.2" fill="none"/><path d="M19 6.2L23.6 4.4" stroke="#221d18" stroke-width="2.2"/>' },
    zebra: { w: 34, h: 22, fill: '#f3efe4', d: 'M5 10C7 8 20 8 23 9L27 4L30 3L33 6L32 8.5L28.5 9.5L26.5 13L25.5 21H23.6L23.2 14.5L11.5 14.5L11 21H9L8.4 14C6.6 13.4 5.5 12.5 5 11.5L2.5 15L1.8 14.5Z', extra: '<path d="M9 9.6v4.6M12 9.1v5M15 8.9v5.3M18 9v5.2M21 9.3v4.8M24.6 7.6l1.7 3.4M27.1 5.3l1.9 2.7" stroke="#1d1814" stroke-width="1.3"/><path d="M23.4 8.6L27.3 3.7" stroke="#1d1814" stroke-width="1.7"/>' },
    impala: { w: 30, h: 22, fill: '#bb7a41', d: 'M5 10C7 8.5 17 8.5 20 9.5L23 5L24.5 2.4L25.5 5L27.6 6.8L27 8.5L24.6 9L22.6 12L22 21H20.6L20.2 14L10.5 14L10 21H8.6L8.3 13.5C6.8 13 5.6 12 5 11L3 12.5L2.6 11.8Z', extra: '<path d="M10.5 13.3H20.2" stroke="#f3e6d0" stroke-width="1.5"/>', horns: '<path d="M24.2 2.8c.6-1.8.1-3-.7-3.6M25.4 3c.9-1.6.8-2.8 0-3.5" stroke="#2a1b12" stroke-width=".8" fill="none"/>' },
    hyena: { w: 40, h: 24, fill: '#6f5236', d: 'M3 12C4 9 8 8 12 8L23 4.5C26 3.6 29 3.5 31 5L33.5 4.5L35 6.5L38 8C39 9.5 38 11 36 11L33 11.5L31 13.5L30.5 23H28.3L27.8 15L26 15L25.4 23H23.2L22.6 14.5L14 14.5L13.2 23H11L10.8 15.5L9.2 15.5L8.6 23H6.4L6 15C5 14.6 4.4 14 4 13.2L1.4 17L.4 16.4Z', extra: '<circle cx="16" cy="10" r="1.4" fill="#3e2c1c"/><circle cx="20" cy="8" r="1.2" fill="#3e2c1c"/><circle cx="13" cy="12" r="1.1" fill="#3e2c1c"/><circle cx="24" cy="9.5" r="1.3" fill="#3e2c1c"/>', eye: [34.5, 7.4] },
    jackal: { w: 36, h: 22, fill: '#b9773a', d: 'M8 10C10 8 22 8 26 9L28.5 6L29.6 1.5L31 5L32.4 1.5L33.2 6L36 8.2L35 10L31.5 11L29.4 13L28.6 21H27L26.2 14.5L13.4 14.5L12.5 21H10.9L10.3 14.2C8.6 13.6 7.4 12.6 6.6 11.4L1.2 14.2L.4 12.8L5.6 9.6Z', extra: '<path d="M9.5 9.6C12 8.2 21 7.8 25.5 8.8L24.5 11C20 10.4 13 10.6 9.5 11.4Z" fill="#2f241b"/>', eye: [32.6, 7.2] }
  };
  function beast(kind, horns) {
    var b = BEASTS[kind];
    return '<g class="cs-beast"><g class="cs-flip"><g class="cs-bob" transform="translate(' + (-b.w / 2) + ' ' + (-b.h) + ')">' +
      '<ellipse cx="' + b.w / 2 + '" cy="' + (b.h - .5) + '" rx="' + r1(b.w * .42) + '" ry="2.3" fill="rgba(30,18,8,.28)"/>' +
      '<path d="' + b.d + '" fill="' + b.fill + '" stroke="#2a1b12" stroke-width=".7" stroke-linejoin="round"/>' + (b.extra || '') + (horns && b.horns ? b.horns : '') +
      '</g></g></g>';
  }

  /* ---------- top-down camp setups ---------- */
  var CARS = ['#e9e6df', '#3c4a5a', '#7a2f25', '#c9c3b5', '#2f3a2a', '#9a8a6a'];
  function setupSVG(type, seed) {
    var car = CARS[Math.floor(seed * CARS.length)], s = '';
    var sh = function (x, y, w, h) { return '<rect x="' + (x + 1.6) + '" y="' + (y + 2) + '" width="' + w + '" height="' + h + '" rx="2" fill="rgba(0,0,0,.22)"/>'; };
    var vehicle = function (x, y) { return sh(x, y, 15, 8) + '<rect x="' + x + '" y="' + y + '" width="15" height="8" rx="2.4" fill="' + car + '" stroke="rgba(0,0,0,.4)" stroke-width=".6"/><rect x="' + (x + 10.5) + '" y="' + (y + 1) + '" width="2.6" height="6" rx="1" fill="#9ec3cf"/>'; };
    if (type === 'tent') {
      var c = ['#c8873a', '#5f7d3a', '#3f6f8f', '#b5452e'][Math.floor(seed * 4)];
      s = '<ellipse cx="1.5" cy="2" rx="10" ry="8.5" fill="rgba(0,0,0,.22)"/><ellipse rx="10" ry="8.5" fill="' + c + '" stroke="rgba(0,0,0,.35)" stroke-width=".7"/><path d="M-10 0h20M0 -8.5v17M-7 -6l14 12M7 -6l-14 12" stroke="rgba(255,255,255,.3)" stroke-width=".7"/>' + vehicle(13, -4);
    } else if (type === 'caravan') {
      s = sh(-12, -6, 25, 12) + '<rect x="-12" y="-6" width="25" height="12" rx="4" fill="#f4f1ea" stroke="#9a948a" stroke-width=".7"/><rect x="-12" y="-1" width="25" height="2" fill="#c0602a"/><rect x="-11" y="6" width="22" height="7" fill="#e9dcb8" opacity=".75"/><path d="M13 0h4" stroke="#555" stroke-width="1.2"/>' + vehicle(17, -4);
    } else if (type === 'rooftop') {
      s = vehicle(-8, -4) + '<rect x="-7" y="-9" width="11" height="17" rx="1.2" fill="#4c5a2c" stroke="rgba(0,0,0,.35)" stroke-width=".6"/><rect x="7" y="-6" width="13" height="13" fill="#e7d7b0" opacity=".7"/>';
    } else {
      s = sh(-9, -6, 15, 12) + '<rect x="-9" y="-6" width="15" height="12" rx="2" fill="#8a7a55" stroke="rgba(0,0,0,.35)" stroke-width=".6"/><rect x="6" y="-9" width="14" height="18" fill="#e9dcb8" opacity=".75"/>' + vehicle(-27, -4);
    }
    return s;
  }

  var SHIRTS = ['#c0392b', '#2e86c1', '#f4d03f', '#27ae60', '#8e44ad', '#e67e22', '#ecf0f1', '#16a085'];
  var SKIN = ['#8d5524', '#c68642', '#e0ac69', '#f1c27d'];
  function personSVG(seed) {
    return '<g class="cs-person"><ellipse cx=".8" cy="1.8" rx="3.2" ry="1.4" fill="rgba(0,0,0,.25)"/><circle r="2.9" fill="' + SHIRTS[Math.floor(seed * SHIRTS.length)] + '" stroke="rgba(0,0,0,.35)" stroke-width=".5"/><circle r="1.6" cy="-.3" fill="' + SKIN[Math.floor((seed * 7) % 1 * SKIN.length)] + '"/></g>';
  }

  /* ---------- the scheduled moments of the day ---------- */
  var EV_STANDS = { coffee: 'stand-9', arrive: 'inside-6', braai: 'inside-3', night: 'stand-7' };
  var POOL = [0, 0];

  K.campScene = function (wrap, stands) {
    var P = K.campMapParts; W = P.W; H = P.H;
    var PR = P.POOL; POOL = [PR[0] + PR[2] / 2, PR[1] + PR[3] / 2];
    var mapbox = wrap.querySelector('.dm-mapbox'), panEl = wrap.querySelector('.dm-pan'), card = wrap.querySelector('.dm-card');
    var sticky = wrap.querySelector('.dm-sticky'), clock = wrap.querySelector('[data-dm-clock]'), bar = wrap.querySelector('.dm-progress'), ticks = wrap.querySelector('.dm-ticks');
    var pos = {}; stands.forEach(function (s) { var p = P.standXY(s); if (p) pos[s.id] = p; });
    var at = function (id, dx, dy) { var p = pos[id] || [500, 280]; return [p[0] + (dx || 0), p[1] + (dy || 0)]; };

    var EVENTS = [
      { h: 5.95, end: 8.45, time: '06:00', title: 'Coffee with the wildebeest', text: 'Plunger on, chairs out, and the morning visitors arrive for breakfast too.', img: 'assets/img/photos/wildebeest-at-camp.jpg', at: function () { return at(EV_STANDS.coffee); } },
      { h: 8.5, end: 11.75, time: '08:30', title: 'Out on a game drive', text: 'The Kyleu game drive vehicle leaves reception and heads out the gate onto Kaallaagte Road into the reserve. Back in about two hours.', img: 'assets/img/photos/game-drive-vehicle.jpg', live: 'Game drive in progress', below: true, at: function () { return [P.RECEPTION[0], P.RECEPTION[1] + 14]; } },
      { h: 12.5, end: 14.9, time: '13:00', title: 'Pool time', text: 'When the bushveld heats up, campers head for the pool and the shady lapa. The animals rest in the shade.', img: 'assets/img/photos/pool-kids.jpg', below: true, at: function () { return POOL; } },
      { h: 15, end: 17.6, time: '15:00', title: 'New campers arrive', text: 'Afternoon check-ins: tents go up, awnings come out and the kettle goes on.', img: 'assets/img/photos/tent-and-trailer.jpg', at: function () { return at(EV_STANDS.arrive); } },
      { h: 17.75, end: 20.7, time: '17:45', title: 'Golden hour braai', text: 'Fires get lit across camp with your free bag of wood as the sky turns orange.', img: 'assets/img/photos/campfire-stand.jpg', at: function () { return at(EV_STANDS.braai); } },
      { h: 20.8, end: 23, time: '21:00', title: 'Glowing eyes in the dark', text: 'Jackals and hyenas come out after dark. Stay by your fire and listen to the bush.', img: 'assets/img/wildlife/bonfire.jpg', at: function () { return at(EV_STANDS.night); } }
    ];

    /* --- occupied stands --- */
    var camps = [];
    stands.forEach(function (s) {
      var p = pos[s.id]; if (!p) return;
      var forced = [EV_STANDS.coffee, EV_STANDS.arrive, EV_STANDS.braai, EV_STANDS.night].indexOf(s.id) >= 0;
      if (!forced && hash01(s.id + 'occ') > .66) return;
      var types = s.area === 'fenced' ? ['tent', 'caravan', 'tent', 'trailer'] : s.area === 'unfenced' ? ['rooftop', 'trailer', 'caravan', 'tent'] : ['rooftop', 'trailer'];
      var arrive = s.id === EV_STANDS.arrive ? 15 : (forced || hash01(s.id + 'arr') < .55) ? 0 : 13.6 + hash01(s.id + 'h') * 3.4;
      var fire = s.area === 'self-sufficient' ? [p[0] + 9, p[1] + 5] : [p[0] + 11, p[1] + 8];
      camps.push({ st: s, p: p, type: types[Math.floor(hash01(s.id + 'type') * types.length)], arrive: arrive, fire: fire, n: 2 + Math.floor(hash01(s.id + 'n') * 3) });
    });

    /* --- herds and predators --- */
    var HERDS = [{ kind: 'wildebeest', n: 7, c: [620, 330] }, { kind: 'zebra', n: 5, c: [800, 330] }, { kind: 'impala', n: 9, c: [700, 110] }, { kind: 'zebra', n: 3, c: [520, 390] }, { kind: 'impala', n: 5, c: [890, 380] }];
    var PREDS = ['jackal', 'jackal', 'jackal', 'hyena', 'hyena', 'hyena', 'hyena'];

    /* --- build the SVG --- */
    var o = ['<svg viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="Illustrated map of Kyleu Bush Camp showing a day in camp">'];
    o.push(P.terrain(stands));
    o.push('<defs><radialGradient id="cs-fireglow"><stop offset="0" stop-color="#ffd27a" stop-opacity=".95"/><stop offset=".35" stop-color="#ff8a2a" stop-opacity=".55"/><stop offset="1" stop-color="#ff6a00" stop-opacity="0"/></radialGradient><filter id="cs-eyeglow" x="-2" y="-2" width="5" height="5"><feGaussianBlur stdDeviation="2.2" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>');
    o.push('<path class="cs-route" d="' + P.smooth(P.DRIVE) + '" fill="none" stroke="none"/>');
    o.push('<g class="cs-setups">' + camps.map(function (c, i) {
      return '<g class="cs-setup" data-i="' + i + '" transform="translate(' + r1(c.p[0] - 5) + ' ' + r1(c.p[1] + 1) + ') scale(.72)"><g class="cs-pop">' + setupSVG(c.type, hash01(c.st.id + 'col')) + '</g></g>';
    }).join('') + '</g>');
    o.push('<g class="cs-swim">' + [0, 1, 2, 3].map(function (i) { return '<g class="cs-swimmer" data-i="' + i + '"><circle r="2.3" fill="none" stroke="#e8fbff" stroke-width=".6" opacity=".7"/><circle r="1.3" fill="' + SKIN[i % 4] + '"/></g>'; }).join('') + '</g>');
    var people = [];
    camps.forEach(function (c, ci) { for (var k = 0; k < c.n; k++) people.push({ camp: ci, seed: hash01(c.st.id + 'p' + k), k: k }); });
    o.push('<g class="cs-people">' + people.map(function (p, i) { return '<g data-p="' + i + '">' + personSVG(p.seed) + '</g>'; }).join('') + '</g>');
    var plains = [];
    HERDS.forEach(function (hd, hi) { for (var k = 0; k < hd.n; k++) plains.push({ herd: hi, kind: hd.kind, k: k, horns: hd.kind === 'impala' && k % 3 === 0 }); });
    o.push('<g class="cs-plains">' + plains.map(function (a, i) { return '<g data-a="' + i + '">' + beast(a.kind, a.horns) + '</g>'; }).join('') + '</g>');
    o.push('<g class="cs-preds">' + PREDS.map(function (k, i) { return '<g data-r="' + i + '">' + beast(k) + '</g>'; }).join('') + '</g>');
    o.push('<g class="cs-bakkie"><g class="cs-dust"><circle cx="-16" r="4" fill="#e8d3a6"/><circle cx="-23" r="5.5" fill="#e8d3a6"/><circle cx="-31" r="7" fill="#e8d3a6"/></g><rect x="-10" y="-5.5" width="20" height="11" rx="2.5" fill="rgba(0,0,0,.25)" transform="translate(1.5 2)"/><rect x="-10" y="-5.5" width="20" height="11" rx="2.5" fill="#3f5a2a" stroke="#22301a" stroke-width=".8"/><rect x="-7.5" y="-5" width="11" height="10" rx="1" fill="#d8c79a"/><rect x="5" y="-4.5" width="3" height="9" rx="1" fill="#9ec3cf"/></g>');
    o.push('<rect class="cs-light" width="' + W + '" height="' + H + '" pointer-events="none"/>');
    o.push('<g class="cs-fires">' + camps.map(function (c, i) { return '<g class="cs-fire" data-f="' + i + '" transform="translate(' + r1(c.fire[0]) + ' ' + r1(c.fire[1]) + ')"><circle class="cs-glow" r="22" fill="url(#cs-fireglow)"/><circle r="2.8" fill="#ff9a2e"/><circle r="1.4" fill="#fff1bf"/></g>'; }).join('') + '</g>');
    o.push('<g class="cs-eyes">' + PREDS.map(function (k, i) { return '<g data-e="' + i + '" filter="url(#cs-eyeglow)"><circle r="2.1" fill="#f2ff7a"/><circle r="2.1" cx="-3.2" cy=".3" fill="#f2ff7a" opacity=".85"/></g>'; }).join('') + '</g>');
    o.push('<g class="cs-marker"><circle r="14" fill="none" stroke="#f4b740" stroke-width="2.5"/><circle r="5" fill="#f4b740"/></g>');
    o.push('</svg>');
    panEl.innerHTML = o.join('');
    var svg = panEl.querySelector('svg'), light = svg.querySelector('.cs-light'), route = svg.querySelector('.cs-route'), routeLen = route.getTotalLength();
    var bakkie = svg.querySelector('.cs-bakkie'), dust = svg.querySelector('.cs-dust'), marker = svg.querySelector('.cs-marker');
    var setupEls = [].slice.call(svg.querySelectorAll('.cs-setup'));
    var fireEls = [].slice.call(svg.querySelectorAll('.cs-fire'));
    var swimEls = [].slice.call(svg.querySelectorAll('.cs-swimmer'));
    var R = Math.random;

    // live state for everything that moves
    people.forEach(function (p, i) {
      var c = camps[p.camp]; p.el = svg.querySelector('[data-p="' + i + '"]');
      p.x = c.p[0] - 8 + R() * 16; p.y = c.p[1] - 2 + R() * 8; p.tx = p.x; p.ty = p.y; p.pause = R() * 3;
      p.sitA = (p.k / c.n) * Math.PI * 2 + hash01(c.st.id) * 3;
    });
    var herds = HERDS.map(function (hd) { return { kind: hd.kind, x: hd.c[0], y: hd.c[1], tx: hd.c[0], ty: hd.c[1], pause: 0, vx: 1 }; });
    plains.forEach(function (a, i) {
      var g = svg.querySelector('[data-a="' + i + '"]');
      a.el = g; a.flip = g.querySelector('.cs-flip'); a.bob = g.querySelector('.cs-bob'); a.b = BEASTS[a.kind];
      a.ox = (R() - .5) * 70; a.oy = (R() - .5) * 38; a.dir = R() < .5 ? -1 : 1; a.phase = R() * 6; a.x = herds[a.herd].x + a.ox; a.y = herds[a.herd].y + a.oy;
    });
    var preds = PREDS.map(function (k, i) {
      var g = svg.querySelector('[data-r="' + i + '"]');
      var a = { kind: k, el: g, flip: g.querySelector('.cs-flip'), bob: g.querySelector('.cs-bob'), b: BEASTS[k], eye: svg.querySelector('[data-e="' + i + '"]'), x: 470 + R() * 480, y: 40 + R() * 380, dir: 1, phase: R() * 6, pause: 0, speed: (k === 'jackal' ? 26 : 18) * (.85 + R() * .3) };
      a.tx = a.x; a.ty = a.y; return a;
    });
    var swimmers = swimEls.map(function (el, i) { return { el: el, x: PR[0] + 2 + R() * (PR[2] - 4), y: PR[1] + 2 + R() * (PR[3] - 4), ph: R() * 6 }; });

    function roamTarget(a, cx, cy, d) {
      var ang = R() * Math.PI * 2; d = d || 80 + R() * 150;
      a.tx = clamp((cx === undefined ? a.x : cx) + Math.cos(ang) * d, P.ROAM.x0, P.ROAM.x1);
      a.ty = clamp((cy === undefined ? a.y : cy) + Math.sin(ang) * d * .7, P.ROAM.y0, P.ROAM.y1);
    }

    /* --- timeline ticks --- */
    ticks.innerHTML = EVENTS.map(function (e, i) { return '<button type="button" data-t="' + i + '" style="left:' + ((e.h - H0) / (H1 - H0) * 100) + '%"><span>' + e.time + '</span></button>'; }).join('');
    [].forEach.call(ticks.querySelectorAll('button'), function (b) {
      b.addEventListener('click', function () {
        var e = EVENTS[+b.dataset.t], total = wrap.offsetHeight - innerHeight;
        window.scrollTo({ top: wrap.getBoundingClientRect().top + scrollY + ((e.h + .15 - H0) / (H1 - H0)) * total, behavior: 'smooth' });
      });
    });

    /* --- scroll → time --- */
    var target = H0, hour = H0, visible = false, last = 0, raf = 0, curEvent = -1;
    function readScroll() {
      var r = wrap.getBoundingClientRect(), total = r.height - innerHeight;
      target = H0 + clamp(-r.top / total, 0, 1) * (H1 - H0);
      if (reduce) hour = target;
    }
    window.addEventListener('scroll', function () { readScroll(); if (visible && !raf) raf = requestAnimationFrame(frame); }, { passive: true });
    window.addEventListener('resize', function () { readScroll(); placeCard(); });

    var mobile = function () { return window.matchMedia('(max-width: 700px)').matches; };
    function placeCard() {
      var e = EVENTS[curEvent]; if (!e) return;
      var pt = e.at(), mw = mapbox.clientWidth, mh = mapbox.clientHeight;
      if (mobile()) {
        var pw = panEl.clientWidth, px = pt[0] / W * pw, tx = clamp(mw / 2 - px, mw - pw, 0);
        panEl.style.transform = 'translateX(' + r1(tx) + 'px)';
        card.style.left = ''; card.style.top = '';
        return;
      }
      panEl.style.transform = '';
      var ax = pt[0] / W * mw, ay = pt[1] / H * mh, cw = card.offsetWidth, ch = card.offsetHeight, left, top;
      card.classList.remove('below', 'side-r', 'side-l');
      if (e.below) {                                   // game drive & pool: card sits right under the spot
        left = clamp(ax - 46, 10, mw - cw - 10); top = clamp(ay + 30, 6, mh - ch - 6);
        card.classList.add('below'); card.style.setProperty('--arrow', clamp(ax - left, 18, cw - 18) + 'px');
      } else {                                         // everything else: beside the spot, on the side with room
        var right = ax < mw * .55;
        left = right ? ax + 30 : ax - cw - 30; left = clamp(left, 10, mw - cw - 10);
        top = clamp(ay - ch / 2, 6, mh - ch - 6);
        card.classList.add(right ? 'side-r' : 'side-l'); card.style.setProperty('--arrow-y', clamp(ay - top, 18, ch - 18) + 'px');
      }
      card.style.left = left + 'px'; card.style.top = top + 'px';
    }
    function showEvent(i) {
      curEvent = i; var e = EVENTS[i];
      if (!e) { card.hidden = true; marker.style.opacity = 0; return; }
      card.innerHTML = '<img src="' + e.img + '" alt=""><div class="dm-card-body"><span class="dm-live"><i></i>' + (e.live || 'Happening now') + ' · ' + e.time + '</span><b>' + e.title + '</b><p>' + e.text + '</p></div>';
      card.hidden = false; card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
      var im = card.querySelector('img'); if (im && !im.complete) im.onload = placeCard;
      marker.style.opacity = 1;
      placeCard();
    }

    /* --- the animation loop --- */
    function frame(ts) {
      raf = 0;
      var t = ts / 1000, dt = last ? clamp(t - last, 0, .1) : 0; last = t;
      if (!reduce) hour += (target - hour) * Math.min(1, dt * 5);
      var h = hour;
      // light + sky
      var L = keyframes(LIGHT, h), S = keyframes(SKY, h);
      light.setAttribute('fill', L[1]); light.setAttribute('opacity', r1(L[2] * 100) / 100);
      sticky.style.setProperty('--dm-sky', S[1]);
      clock.textContent = fmt(h);
      bar.style.width = ((h - H0) / (H1 - H0) * 100) + '%';
      var night = Math.max(ramp(h, 18.3, 19.6), 1 - ramp(h, 5.6, 6.4));
      // event card
      var ev = -1; EVENTS.forEach(function (e, i) { if (h >= e.h && h < e.end) ev = i; });
      if (ev !== curEvent) showEvent(ev);
      // setups appear as campers arrive
      setupEls.forEach(function (el, i) { el.classList.toggle('on', h >= camps[i].arrive); });
      // people
      var sitting = h >= 19.2;
      people.forEach(function (p) {
        var c = camps[p.camp], here = h >= Math.max(c.arrive, c.st.id === EV_STANDS.coffee ? 5.6 : 6.1) && h < 22.3;
        p.el.style.opacity = here ? 1 : 0;
        if (!here) return;
        if (sitting) { p.tx = c.fire[0] + Math.cos(p.sitA) * 6; p.ty = c.fire[1] + Math.sin(p.sitA) * 4.5; }
        else if (p.pause > 0) p.pause -= dt;
        else if (Math.hypot(p.tx - p.x, p.ty - p.y) < 1) { p.tx = c.p[0] - 14 + R() * 28; p.ty = c.p[1] - 6 + R() * 14; p.pause = R() * 4; }
        if (!reduce) { var dx = p.tx - p.x, dy = p.ty - p.y, d = Math.hypot(dx, dy), st = Math.min(d, (sitting ? 20 : 8) * dt); if (d > .01) { p.x += dx / d * st; p.y += dy / d * st; } }
        else { p.x = p.tx; p.y = p.ty; }
        p.el.setAttribute('transform', 'translate(' + r1(p.x) + ' ' + r1(p.y) + ')');
      });
      // swimmers
      var swim = ramp(h, 12.3, 12.7) * (1 - ramp(h, 15, 15.4));
      swimmers.forEach(function (s, i) {
        s.el.style.opacity = swim;
        if (swim > 0) { s.x = clamp(s.x + Math.sin(t * .8 + s.ph) * .08, PR[0] + 2, PR[0] + PR[2] - 2); s.y = clamp(s.y + Math.cos(t * .6 + s.ph) * .06, PR[1] + 2, PR[1] + PR[3] - 2); s.el.setAttribute('transform', 'translate(' + r1(s.x) + ' ' + r1(s.y + Math.sin(t * 3 + s.ph) * .6) + ')'); }
      });
      // game drive bakkie: out the gate onto Kaallaagte Road at 08:30, gone two hours, back about 11:30
      var outP = ramp(h, 8.5, 9.0), backP = ramp(h, 11.0, 11.5), dprog = outP * (1 - backP);
      var moving = (h > 8.5 && h < 9.0) || (h > 11.0 && h < 11.5), returning = h >= 11.0;
      var L1 = dprog * routeLen, pA = route.getPointAtLength(L1), pB = route.getPointAtLength(Math.min(routeLen, L1 + 2));
      var ang = Math.atan2(pB.y - pA.y, pB.x - pA.x) * 180 / Math.PI + (returning ? 180 : 0);
      if (!moving && dprog === 0) ang = 200;
      bakkie.setAttribute('transform', 'translate(' + r1(pA.x) + ' ' + r1(pA.y) + ') rotate(' + r1(ang) + ') scale(.8)');
      bakkie.style.opacity = dprog > .97 ? 0 : 1;
      dust.style.opacity = moving ? .5 : 0;
      // plains game: busy in the morning, resting at midday, gone after dark
      var act = h < 10 ? 1 : h < 11 ? 1 - ramp(h, 10, 11) * .9 : h < 15 ? .1 : h < 16 ? .1 + ramp(h, 15, 16) * .8 : .9;
      var plainVis = 1 - ramp(h, 18, 19.3);
      herds.forEach(function (hd, hi) {
        if (hi === 0 && h < 8.6) {                    // the wildebeest come to the coffee camp
          var cp = at(EV_STANDS.coffee, 40, 12); hd.x += (cp[0] - hd.x) * Math.min(1, dt * 1.5); hd.y += (cp[1] - hd.y) * Math.min(1, dt * 1.5); hd.tx = hd.x; hd.ty = hd.y; return;
        }
        if (reduce) return;
        if (hd.pause > 0) { hd.pause -= dt * act; return; }
        var dx = hd.tx - hd.x, dy = hd.ty - hd.y, d = Math.hypot(dx, dy);
        if (d < 2) { roamTarget(hd, hd.x, hd.y, 60 + R() * 120); hd.pause = 2 + R() * 6; return; }
        var st = Math.min(d, 7 * act * dt); hd.x = clamp(hd.x + dx / d * st, P.ROAM.x0 + 45, P.ROAM.x1 - 25); hd.y = clamp(hd.y + dy / d * st, P.ROAM.y0 + 10, P.ROAM.y1 - 10); if (Math.abs(dx) > .3) hd.vx = dx > 0 ? 1 : -1;
      });
      plains.forEach(function (a, i) {
        var hd = herds[a.herd], moving2 = act > .3 && hd.pause <= 0;
        if (!reduce && R() < .004 * act) { a.ox = clamp(a.ox + (R() - .5) * 16, -40, 40); a.oy = clamp(a.oy + (R() - .5) * 10, -22, 22); }
        var tx = hd.x + a.ox, ty = hd.y + a.oy;
        a.x += (tx - a.x) * Math.min(1, dt * 1.2); a.y += (ty - a.y) * Math.min(1, dt * 1.2);
        if (moving2) a.dir = hd.vx; else if (R() < .002) a.dir *= -1;
        var resting = a.k >= 2 ? 1 - act : 0;
        a.el.style.opacity = r1(plainVis * (1 - resting * .85) * 100) / 100;
        var bob = moving2 ? Math.abs(Math.sin(t * 9 + a.phase)) * -1.1 : Math.sin(t * 1.3 + a.phase) > .6 ? .9 : 0;   // walking or grazing
        a.el.setAttribute('transform', 'translate(' + r1(a.x) + ' ' + r1(a.y) + ') scale(' + AS + ')');
        a.flip.setAttribute('transform', 'scale(' + a.dir + ' 1)');
        a.bob.setAttribute('transform', 'translate(' + (-a.b.w / 2) + ' ' + r1(-a.b.h + bob) + ')');
      });
      // predators: out after 17:00, glowing eyes after dark
      var predVis = Math.max(ramp(h, 16.8, 17.8), 1 - ramp(h, 6, 6.6));
      preds.forEach(function (a, i) {
        a.el.style.opacity = predVis; a.eye.style.opacity = predVis * night;
        if (predVis <= 0) return;
        if (!reduce) {
          if (a.pause > 0) a.pause -= dt;
          else {
            var dx = a.tx - a.x, dy = a.ty - a.y, d = Math.hypot(dx, dy);
            if (d < 2) {
              if (i === 4) { a.tx = preds[3].tx + 26; a.ty = preds[3].ty + 10; }                      // hyenas travel in pairs
              else if (i === 3 && h > 20.4) { var np = at(EV_STANDS.night, -50 + R() * 80, 20 + R() * 25); a.tx = np[0]; a.ty = np[1]; }   // one pair checks out the night camp
              else roamTarget(a);
              a.pause = R() < .4 ? R() * 2.5 : 0;
            } else { var st = Math.min(d, a.speed * dt); a.x = clamp(a.x + dx / d * st, P.ROAM.x0, P.ROAM.x1); a.y = clamp(a.y + dy / d * st, P.ROAM.y0, P.ROAM.y1); if (Math.abs(dx) > .3) a.dir = dx > 0 ? 1 : -1; }
          }
        }
        var walking = a.pause <= 0, bob = walking ? Math.abs(Math.sin(t * (a.kind === 'jackal' ? 14 : 10) + a.phase)) * -1.3 : 0;
        a.el.setAttribute('transform', 'translate(' + r1(a.x) + ' ' + r1(a.y) + ') scale(' + AS + ')');
        a.flip.setAttribute('transform', 'scale(' + a.dir + ' 1)');
        a.bob.setAttribute('transform', 'translate(' + (-a.b.w / 2) + ' ' + r1(-a.b.h + bob) + ')');
        a.eye.setAttribute('transform', 'translate(' + r1(a.x + a.dir * (a.b.eye[0] - a.b.w / 2) * AS) + ' ' + r1(a.y + (a.b.eye[1] - a.b.h + bob) * AS) + ') scale(' + (a.dir * AS) + ' ' + AS + ')');
      });
      // braai fires (and one early coffee fire)
      fireEls.forEach(function (el, i) {
        var c = camps[i], lit = h >= Math.max(17.6, c.arrive) && h < 22.6 ? ramp(h, Math.max(17.6, c.arrive), Math.max(17.6, c.arrive) + .5) : 0;
        if (c.st.id === EV_STANDS.coffee && h < 7.4) lit = Math.max(lit, 1 - ramp(h, 6.8, 7.4));
        var fl = .85 + Math.sin(t * 11 + i) * .08 + Math.sin(t * 17 + i * 2) * .07;
        el.style.opacity = lit;
        if (lit > 0) el.querySelector('.cs-glow').setAttribute('r', r1((16 + night * 14) * fl));
      });
      // marker on the current moment (follows the bakkie on the game drive)
      if (curEvent >= 0) {
        var mp = curEvent === 1 ? (dprog > .97 ? P.GATE : [pA.x, pA.y]) : EVENTS[curEvent].at();
        var pulse = 1 + (t * 1.2 % 1) * .8;
        marker.setAttribute('transform', 'translate(' + r1(mp[0]) + ' ' + r1(mp[1]) + ')');
        marker.firstChild.setAttribute('r', r1(10 * pulse)); marker.firstChild.setAttribute('opacity', r1((1 - (pulse - 1) / .8) * 100) / 100);
        if (mobile() && curEvent === 1 && moving && dprog < .97) { var pw = panEl.clientWidth, mw2 = mapbox.clientWidth, tx2 = clamp(mw2 / 2 - pA.x / W * pw, mw2 - pw, 0); panEl.style.transform = 'translateX(' + r1(tx2) + 'px)'; }
      }
      if (visible && (!reduce || Math.abs(target - hour) > .001)) raf = requestAnimationFrame(frame);
    }
    new IntersectionObserver(function (es) {
      visible = es[0].isIntersecting;
      if (visible && !raf) { last = 0; readScroll(); raf = requestAnimationFrame(frame); }
    }).observe(wrap);
    readScroll(); hour = target;
    frame(performance.now());                          // draw the right state straight away
    // test hook: wrap.kyleuScene.at(17.8) jumps to a time and lets things settle
    wrap.kyleuScene = { at: function (h, secs) { var t0 = performance.now(); target = hour = h; for (var i = 0; i <= (secs || 4) * 20; i++) { last = (t0 + (i - 1) * 50) / 1000; frame(t0 + i * 50); } last = 0; } };
  };
})();
