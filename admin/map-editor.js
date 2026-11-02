/* =========================================================
   Kyleu map editor (admin > Settings > Maps)
   Edits the layout both website maps are drawn from:
   - Camp map: campsites, text, roads, footpaths, fence, spruit, buildings, gate
   - A day at Kyleu: the game drive route and the story moments
   Save: kept in this browser (demo). Download map file: for the live site.
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu, CL = K.campLayout, SC = CL.SC, W = CL.W, H = CL.H, KEY = 'kyleu-web-map';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var D = null, BASE = [], past = [], future = [], savedJSON = '', view = 'camp', tool = 'select', sel = null, draw = null, drag = null, placeId = '';
  var show = { stands: true, labels: true, roads: true, nature: true, buildings: true };
  var svg = $('[data-svg]'), gBase = $('[data-base]'), gOver = $('[data-over]'), side = $('[data-side]'), help = $('[data-help]');
  svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);

  var LINE = { roads: 'Road', paths: 'Footpath', perimeter: 'Perimeter road', fence: 'Fence', spruit: 'Spruit', drive: 'Game drive route' };
  var MANY = { roads: 1, paths: 1 }, CLOSED = { fence: 1, perimeter: 1 };
  var AREAS = { fenced: 'Fenced', unfenced: 'Open (unfenced)', 'self-sufficient': 'Self-sufficient' };
  var STYLES = { area: 'Area name (capitals)', ss: 'Area name (green)', small: 'Handwritten note', water: 'Water name' };
  var STORY = [
    { k: 'coffee', time: '06:00', title: 'Coffee with the wildebeest', text: 'Plunger on, chairs out, and the morning visitors arrive for breakfast too.', stand: 'stand-9' },
    { k: 'drive', time: '08:30', title: 'Out on a game drive', text: 'The Kyleu game drive vehicle leaves reception and heads out the gate onto Kaallaagte Road into the reserve. Back in about two hours.' },
    { k: 'pool', time: '13:00', title: 'Pool time', text: 'When the bushveld heats up, campers head for the pool area. The animals rest in the shade.' },
    { k: 'arrive', time: '15:00', title: 'New campers arrive', text: 'Afternoon check-ins: tents go up, awnings come out and the kettle goes on.', stand: 'inside-6' },
    { k: 'braai', time: '17:45', title: 'Golden hour braai', text: 'Fires get lit across camp with your free bag of wood as the sky turns orange.', stand: 'inside-3' },
    { k: 'night', time: '21:00', title: 'Glowing eyes in the dark', text: 'Jackals and hyenas come out after dark. Stay by your fire and listen to the bush.', stand: 'stand-7' }
  ];
  var TOOLS = {
    camp: [['select', 'Select and move'], ['road', 'Draw a road'], ['path', 'Draw a footpath'], ['text', 'Add text'], ['stand', 'Add a campsite'], ['house', 'Add a building']],
    story: [['select', 'Select and move'], ['drive', 'Redraw the game drive route']]
  };
  var HELP = {
    select: 'Drag anything to move it. Click a road or line to edit its points: drag a point, click a small dot to add a point, double-click a point to remove it. Press Delete to remove what is selected.',
    road: 'Click along the map to draw a road. Double-click or press Enter to finish, Esc to cancel.',
    path: 'Click along the map to draw a footpath. Double-click or press Enter to finish, Esc to cancel.',
    drive: 'Click from reception, through the gate and out, to draw the route the game drive vehicle follows. Double-click or press Enter to finish.',
    text: 'Click where the text should go.',
    stand: 'Click where the new campsite should go.',
    house: 'Click where the building should go.',
    place: 'Click where this campsite should go.'
  };

  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function r1(n) { return Math.round(n * 10) / 10; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
  function g2w(p) { return [r1(p[0] * SC), r1(p[1] * SC)]; }
  function w2g(p) { return [Math.round(p[0] / SC), Math.round(p[1] / SC)]; }
  function esc(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
  function toast(t) { var el = $('[data-toast]'); el.textContent = t; el.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(function () { el.hidden = true; }, 3200); }
  function fill(L) { var d = CL.defaults(); if (L) Object.keys(d).forEach(function (k) { if (L[k] !== undefined && L[k] !== null) d[k] = clone(L[k]); }); return d; }

  /* ---------- campsites: stands.md positions, changed by the layout, plus new ones ---------- */
  function stands() {
    return BASE.map(function (s) {
      var has = Object.prototype.hasOwnProperty.call(D.stands, s.id), p = has ? D.stands[s.id] : (s.map ? [s.map.x, s.map.y] : null);
      return { id: s.id, name: s.name, area: s.area, map: p ? { x: p[0], y: p[1] } : null };
    }).concat(D.newStands.map(function (n) { return { id: n.id, name: n.name, area: n.area, map: n.map, isNew: true, guests: n.guests }; }));
  }
  function standById(id) { return stands().filter(function (s) { return s.id === id; })[0]; }
  function setStand(id, xy) { var n = D.newStands.filter(function (x) { return x.id === id; })[0]; if (n) n.map = xy ? { x: xy[0], y: xy[1] } : null; else D.stands[id] = xy; }
  function pinLabel(s) { var n = s.name.replace(/[^0-9]/g, ''); return (s.area === 'self-sufficient' ? 'R' : '') + (n || '+'); }

  /* ---------- lines ---------- */
  function lineList(kind) { return MANY[kind] ? D[kind] : [D[kind]]; }
  function lineAt(kind, i) { return MANY[kind] ? D[kind][i] : D[kind]; }
  function dPath(L, closed) { return L.length ? 'M' + L.map(function (p) { var q = g2w(p); return q[0] + ' ' + q[1]; }).join('L') + (closed ? 'Z' : '') : ''; }
  function rectOf(id) { var a = id.split('|'); return a[0] === 'house' ? D.house[+a[1]] : D[a[0]]; }
  function rectName(id) { return id.indexOf('house') === 0 ? 'Building' : id === 'pool' ? 'Pool' : 'Lapa'; }

  /* ---------- history ---------- */
  function remember(json) { past.push(json || JSON.stringify(D)); if (past.length > 80) past.shift(); future = []; }
  function undo() { if (!past.length) return; future.push(JSON.stringify(D)); D = JSON.parse(past.pop()); sel = null; render(); }
  function redo() { if (!future.length) return; past.push(JSON.stringify(D)); D = JSON.parse(future.pop()); sel = null; render(); }

  /* ---------- drawing ---------- */
  function render(o) {
    o = o || {};
    if (o.base !== false) { CL.set(D); gBase.innerHTML = K.campMapParts.terrain(stands()); }
    gOver.innerHTML = overlay();
    if (o.panel !== false) panel();
    bar();
  }
  var soon = 0;
  function renderSoon() { cancelAnimationFrame(soon); soon = requestAnimationFrame(function () { render({ panel: false }); }); }

  function isSel(type, a, b) { return sel && sel.type === type && sel.a === a && (b === undefined || sel.b === b); }
  function overlay() {
    var o = [], S = stands();
    if (view === 'camp') {
      var kinds = [].concat(show.roads ? ['roads', 'paths', 'perimeter'] : [], show.nature ? ['fence', 'spruit'] : []);
      kinds.forEach(function (k) { lineList(k).forEach(function (L, i) { if (L && L.length > 1) o.push('<path class="me-hit' + (isSel('line', k, i) ? ' on' : '') + (k === 'paths' ? ' fp' : '') + '" data-line="' + k + '|' + i + '" d="' + dPath(L, CLOSED[k]) + '"/>'); }); });
      if (show.buildings) {
        D.house.forEach(function (r, i) { o.push(rectHandle('house|' + i, r)); });
        o.push(rectHandle('pool', D.pool), rectHandle('lapa', D.lapa));
        var gp = g2w(D.gate); o.push('<rect class="me-box' + (sel && sel.type === 'gate' ? ' on' : '') + '" data-gate x="' + (gp[0] - 17) + '" y="' + (gp[1] - 8) + '" width="34" height="16" rx="7"><title>Gate</title></rect>');
      }
      if (show.labels) D.labels.forEach(function (l, i) {
        var t = gBase.querySelector('[data-lab="' + i + '"]'), b = t ? t.getBBox() : null; if (!b) return;
        o.push('<rect class="me-box' + (isSel('label', i) ? ' on' : '') + '" data-lab="' + i + '" x="' + r1(b.x - 4) + '" y="' + r1(b.y - 3) + '" width="' + r1(b.width + 8) + '" height="' + r1(b.height + 6) + '" rx="4"/>');
      });
    } else {
      if (D.drive.length > 1) o.push('<path class="me-drive' + (isSel('line', 'drive', 0) ? ' on' : '') + '" data-line="drive|0" d="' + K.campMapParts.smooth(D.drive.map(g2w)) + '"/>');
    }
    if (view === 'camp' && show.stands || view === 'story') S.forEach(function (s) {
      if (!s.map) return; var x = r1(s.map.x / 100 * W), y = r1(s.map.y / 100 * H);
      o.push('<g class="me-pin a-' + s.area + (s.isNew ? ' new' : '') + (isSel('stand', s.id) ? ' on' : '') + (view === 'story' ? ' dim' : '') + '"' + (view === 'camp' ? ' data-stand="' + s.id + '"' : '') + ' transform="translate(' + x + ' ' + y + ')"><circle r="9"/><text y="3.4" text-anchor="middle">' + esc(pinLabel(s)) + '</text><title>' + esc(s.name) + '</title></g>');
    });
    if (view === 'story') STORY.forEach(function (m, i) {
      var p = storyAt(m.k); if (!p) return;
      o.push('<g class="me-story' + (m.stand ? ' movable' : '') + (sel && sel.type === 'story' && sel.a === m.k ? ' on' : '') + '" data-story="' + m.k + '" transform="translate(' + r1(p[0]) + ' ' + r1(p[1]) + ')"><circle r="12"/><text y="4" text-anchor="middle">' + (i + 1) + '</text><title>' + esc(storyGet(m.k, 'title')) + '</title></g>');
    });
    // the selected line: its points, and dots between them to add more
    if (sel && sel.type === 'line') {
      var L = lineAt(sel.a, sel.b) || [], cl = CLOSED[sel.a];
      o.push('<path class="me-sel" d="' + dPath(L, cl) + '"/>');
      for (var j = 0; j < L.length; j++) {
        var nx = L[j + 1] || (cl ? L[0] : null);
        if (nx) { var m1 = g2w([(L[j][0] + nx[0]) / 2, (L[j][1] + nx[1]) / 2]); o.push('<circle class="me-mid" data-mid="' + sel.a + '|' + sel.b + '|' + j + '" cx="' + m1[0] + '" cy="' + m1[1] + '" r="3.6"><title>Click to add a point</title></circle>'); }
      }
      L.forEach(function (p, j2) { var q = g2w(p); o.push('<circle class="me-v" data-v="' + sel.a + '|' + sel.b + '|' + j2 + '" cx="' + q[0] + '" cy="' + q[1] + '" r="5"><title>Drag to move, double-click to remove</title></circle>'); });
    }
    if (draw) o.push(drawHTML());
    if (drag && drag.type === 'story' && drag.p) o.push('<g class="me-story on" transform="translate(' + r1(drag.p[0]) + ' ' + r1(drag.p[1]) + ')"><circle r="12"/></g>');
    return o.join('');
  }
  function rectHandle(id, r) { var p = g2w([r[0], r[1]]); return '<rect class="me-box' + (isSel('rect', id) ? ' on' : '') + '" data-rect="' + id + '" x="' + (p[0] - 3) + '" y="' + (p[1] - 3) + '" width="' + r1(r[2] * SC + 6) + '" height="' + r1(r[3] * SC + 6) + '" rx="3"><title>' + rectName(id) + '</title></rect>'; }
  function drawHTML() {
    var pts = draw.pts.map(g2w).concat(draw.cur ? [draw.cur] : []);
    return '<path class="me-draw" d="' + (pts.length ? 'M' + pts.map(function (p) { return r1(p[0]) + ' ' + r1(p[1]); }).join('L') : '') + '"/>' + draw.pts.map(function (p) { var q = g2w(p); return '<circle class="me-dpt" cx="' + q[0] + '" cy="' + q[1] + '" r="3.5"/>'; }).join('');
  }

  /* ---------- story moments (scroll map) ---------- */
  function storyDef(k) { return STORY.filter(function (m) { return m.k === k; })[0]; }
  function storyGet(k, f) { var m = D.story[k] || {}; return m[f] || storyDef(k)[f] || ''; }
  function storyAt(k) {
    var def = storyDef(k);
    if (def.stand) { var s = standById(storyGet(k, 'stand')); return s && s.map ? [s.map.x / 100 * W, s.map.y / 100 * H] : null; }
    if (k === 'pool') { var r = D.pool; return g2w([r[0] + r[2] / 2, r[1] + r[3] / 2]); }
    if (k === 'drive' && D.drive.length) return g2w(D.drive[Math.min(D.drive.length - 1, Math.floor(D.drive.length * .35))]);
    return null;
  }
  function storySet(k, f, v) { D.story[k] = D.story[k] || {}; if (v && v !== storyDef(k)[f]) D.story[k][f] = v; else delete D.story[k][f]; if (!Object.keys(D.story[k]).length) delete D.story[k]; }

  /* ---------- side panel ---------- */
  function panel() {
    var h = '<div class="me-sec"><h3>Tools</h3><div class="me-tools">' + TOOLS[view].map(function (t) { return '<button type="button" class="me-tool' + (tool === t[0] ? ' on' : '') + '" data-tool="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' +
      (draw ? '<div class="me-row"><button type="button" class="me-btn primary sm" data-finish>Finish line</button><button type="button" class="me-btn sm" data-cancel>Cancel</button></div>' : '') + '</div>';
    h += '<div class="me-sec me-props">' + props() + '</div>';
    if (view === 'camp') {
      var off = stands().filter(function (s) { return !s.map; });
      h += '<div class="me-sec"><h3>Show on the editor</h3>' + [['stands', 'Campsites'], ['labels', 'Text'], ['roads', 'Roads and footpaths'], ['nature', 'Fence and spruit'], ['buildings', 'Buildings and gate']].map(function (x) { return '<label class="me-check"><input type="checkbox" data-show="' + x[0] + '"' + (show[x[0]] ? ' checked' : '') + '>' + x[1] + '</label>'; }).join('') + '</div>';
      if (off.length) h += '<div class="me-sec"><h3>Not on the map</h3>' + off.map(function (s) { return '<div class="me-row between"><span>' + esc(s.name) + '</span><button type="button" class="me-btn sm" data-place="' + s.id + '">Place it</button></div>'; }).join('') + '</div>';
    } else {
      h += '<div class="me-sec"><h3>Story moments</h3><p class="me-muted">The six moments people scroll through. Leave a box empty to keep the standard words.</p>' + STORY.map(function (m, i) {
        var opts = m.stand ? '<label class="me-f"><span>Where</span><select data-sf="' + m.k + '|stand">' + stands().filter(function (s) { return s.map; }).map(function (s) { return '<option value="' + s.id + '"' + (storyGet(m.k, 'stand') === s.id ? ' selected' : '') + '>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' : '<p class="me-muted small">' + (m.k === 'pool' ? 'Shown at the pool.' : 'Follows the game drive route.') + '</p>';
        return '<div class="me-moment' + (sel && sel.type === 'story' && sel.a === m.k ? ' on' : '') + '" data-moment="' + m.k + '"><b><span>' + (i + 1) + '</span>' + m.time + '</b>' +
          '<label class="me-f"><span>Title</span><input data-sf="' + m.k + '|title" value="' + esc((D.story[m.k] || {}).title || '') + '" placeholder="' + esc(m.title) + '"></label>' +
          '<label class="me-f"><span>Words</span><textarea rows="3" data-sf="' + m.k + '|text" placeholder="' + esc(m.text) + '">' + esc((D.story[m.k] || {}).text || '') + '</textarea></label>' + opts + '</div>';
      }).join('') + '</div>';
    }
    h += '<div class="me-sec"><a class="me-link" href="../' + (view === 'camp' ? 'discover.html#sitemap' : 'experience.html') + '" target="_blank" rel="noopener">See it on the website</a><p class="me-muted small">Press Save first, then refresh the website.</p></div>';
    side.innerHTML = h;
    help.textContent = HELP[tool] || '';
  }
  function props() {
    if (!sel) return '<h3>Selected</h3><p class="me-muted">Nothing selected. Click something on the map.</p>';
    if (sel.type === 'stand') {
      var s = standById(sel.a); if (!s) return '';
      var pos = s.map ? s.map.x + ', ' + s.map.y : 'not on the map';
      if (s.isNew) {
        var n = D.newStands.filter(function (x) { return x.id === s.id; })[0];
        return '<h3>New campsite</h3><label class="me-f"><span>Name</span><input data-nf="name" value="' + esc(n.name) + '"></label><label class="me-f"><span>Area</span><select data-nf="area">' + Object.keys(AREAS).map(function (a) { return '<option value="' + a + '"' + (n.area === a ? ' selected' : '') + '>' + AREAS[a] + '</option>'; }).join('') + '</select></label><label class="me-f"><span>Guests</span><input type="number" min="1" max="20" data-nf="guests" value="' + (n.guests || 8) + '"></label>' +
          '<p class="me-muted small">Shows on the website map and booking page as a new stand, with the area\'s standard photo and price. Map position ' + pos + '.</p><button type="button" class="me-btn danger" data-del>Delete this campsite</button>';
      }
      return '<h3>' + esc(s.name) + '</h3><p class="me-muted small">' + AREAS[s.area] + ' · map position ' + pos + '</p><p class="me-muted small">Drag the pin to move it. Photos and details are on the Stands page.</p><button type="button" class="me-btn" data-del>Take it off the map</button>';
    }
    if (sel.type === 'label') {
      var l = D.labels[sel.a]; if (!l) return '';
      return '<h3>Text</h3><label class="me-f"><span>Words</span><input data-lf="t" value="' + esc(l.t) + '"></label><label class="me-f"><span>Style</span><select data-lf="k">' + Object.keys(STYLES).map(function (k) { return '<option value="' + k + '"' + (l.k === k ? ' selected' : '') + '>' + STYLES[k] + '</option>'; }).join('') + '</select></label>' +
        '<label class="me-f"><span>Line up from</span><select data-lf="a">' + [['start', 'The left'], ['middle', 'The middle'], ['end', 'The right']].map(function (x) { return '<option value="' + x[0] + '"' + ((l.a || 'middle') === x[0] ? ' selected' : '') + '>' + x[1] + '</option>'; }).join('') + '</select></label><button type="button" class="me-btn danger" data-del>Delete this text</button>';
    }
    if (sel.type === 'line') {
      var L = lineAt(sel.a, sel.b) || [];
      return '<h3>' + LINE[sel.a] + '</h3><p class="me-muted small">' + L.length + ' points. Drag a point to move it, click a small dot to add one, double-click a point to remove it.</p>' +
        (MANY[sel.a] ? '<label class="me-f"><span>Kind</span><select data-kind><option value="roads"' + (sel.a === 'roads' ? ' selected' : '') + '>Road</option><option value="paths"' + (sel.a === 'paths' ? ' selected' : '') + '>Footpath</option></select></label><button type="button" class="me-btn danger" data-del>Delete this ' + (sel.a === 'roads' ? 'road' : 'footpath') + '</button>' : '');
    }
    if (sel.type === 'rect') {
      var r = rectOf(sel.a); if (!r) return '';
      return '<h3>' + rectName(sel.a) + '</h3><div class="me-row"><label class="me-f"><span>Width</span><input type="number" min="4" max="200" data-rf="2" value="' + r[2] + '"></label><label class="me-f"><span>Height</span><input type="number" min="4" max="200" data-rf="3" value="' + r[3] + '"></label></div><p class="me-muted small">Drag it to move it.</p>' + (sel.a.indexOf('house') === 0 ? '<button type="button" class="me-btn danger" data-del>Delete this building</button>' : '');
    }
    if (sel.type === 'gate') return '<h3>Gate</h3><p class="me-muted small">Drag it to move it. The game drive leaves camp here.</p>';
    if (sel.type === 'story') return '<h3>' + esc(storyGet(sel.a, 'title')) + '</h3><p class="me-muted small">' + (storyDef(sel.a).stand ? 'Drag the marker onto another campsite, or change it below.' : 'This moment is fixed to ' + (sel.a === 'pool' ? 'the pool.' : 'the game drive route.')) + '</p>';
    return '';
  }

  /* ---------- top bar ---------- */
  function dirty() { return JSON.stringify(D) !== savedJSON; }
  function bar() {
    var d = dirty();
    $('[data-save]').disabled = !d; $('[data-undo]').disabled = !past.length; $('[data-redo]').disabled = !future.length;
    var st = $('[data-state]'); st.textContent = d ? 'Unsaved changes' : 'Saved'; st.classList.toggle('dirty', d);
  }
  function setTool(t, id) { tool = t; placeId = id || ''; draw = null; svg.classList.toggle('drawing', t !== 'select'); panel(); gOver.innerHTML = overlay(); }

  /* ---------- pointer ---------- */
  function pt(e) { var p = svg.createSVGPoint(); p.x = e.clientX; p.y = e.clientY; var q = p.matrixTransform(svg.getScreenCTM().inverse()); return [clamp(q.x, 0, W), clamp(q.y, 0, H)]; }
  function nearestStand(P) { var best = null, bd = 1e9; stands().forEach(function (s) { if (!s.map) return; var d = Math.hypot(s.map.x / 100 * W - P[0], s.map.y / 100 * H - P[1]); if (d < bd) { bd = d; best = s; } }); return best; }
  svg.addEventListener('pointerdown', function (e) {
    if (e.button) return;
    var P = pt(e), t = e.target, h, pre = JSON.stringify(D);
    if (tool !== 'select') { e.preventDefault(); return toolClick(P); }
    if ((h = t.closest('[data-v]'))) { var a = h.dataset.v.split('|'); drag = { type: 'v', k: a[0], i: +a[1], j: +a[2], pre: pre }; }
    else if ((h = t.closest('[data-mid]'))) { var m = h.dataset.mid.split('|'); remember(pre); lineAt(m[0], +m[1]).splice(+m[2] + 1, 0, w2g(P)); drag = { type: 'v', k: m[0], i: +m[1], j: +m[2] + 1, moved: true }; }
    else if ((h = t.closest('[data-stand]'))) { sel = { type: 'stand', a: h.dataset.stand }; drag = { type: 'stand', id: h.dataset.stand, pre: pre }; }
    else if ((h = t.closest('[data-lab]'))) { var li = +h.dataset.lab, l = D.labels[li], g = g2w([l.x, l.y]); sel = { type: 'label', a: li }; drag = { type: 'label', i: li, off: [P[0] - g[0], P[1] - g[1]], pre: pre }; }
    else if ((h = t.closest('[data-gate]'))) { sel = { type: 'gate' }; drag = { type: 'gate', pre: pre }; }
    else if ((h = t.closest('[data-rect]'))) { var r = rectOf(h.dataset.rect), g2 = g2w([r[0], r[1]]); sel = { type: 'rect', a: h.dataset.rect }; drag = { type: 'rect', id: h.dataset.rect, off: [P[0] - g2[0], P[1] - g2[1]], pre: pre }; }
    else if ((h = t.closest('[data-story]'))) { sel = { type: 'story', a: h.dataset.story }; if (storyDef(h.dataset.story).stand) drag = { type: 'story', k: h.dataset.story, pre: pre }; }
    else if ((h = t.closest('[data-line]'))) { var b = h.dataset.line.split('|'); sel = { type: 'line', a: b[0], b: +b[1] }; }
    else sel = null;
    e.preventDefault();
    if (drag) { try { svg.setPointerCapture(e.pointerId); } catch (x) {} }
    render({ base: false });
  });
  svg.addEventListener('pointermove', function (e) {
    if (draw) { draw.cur = pt(e); gOver.innerHTML = overlay(); return; }
    if (!drag) return;
    var P = pt(e);
    if (!drag.moved) { drag.moved = true; if (drag.pre) remember(drag.pre); }
    if (drag.type === 'v') lineAt(drag.k, drag.i)[drag.j] = w2g(P);
    else if (drag.type === 'stand') setStand(drag.id, [r1(P[0] / W * 100), r1(P[1] / H * 100)]);
    else if (drag.type === 'label') { var g = w2g([P[0] - drag.off[0], P[1] - drag.off[1]]), l = D.labels[drag.i]; l.x = g[0]; l.y = g[1]; var te = gBase.querySelector('[data-lab="' + drag.i + '"]'); if (te) { var q = g2w(g); te.setAttribute('x', q[0]); te.setAttribute('y', q[1]); } }
    else if (drag.type === 'gate') { D.gate = w2g(P); var ge = gBase.querySelector('[data-gate]'), gq = g2w(D.gate); if (ge) ge.setAttribute('transform', 'translate(' + gq[0] + ' ' + gq[1] + ')'); }
    else if (drag.type === 'rect') { var r = rectOf(drag.id), rg = w2g([P[0] - drag.off[0], P[1] - drag.off[1]]); r[0] = rg[0]; r[1] = rg[1]; }
    else if (drag.type === 'story') drag.p = P;
    gOver.innerHTML = overlay(); bar();
  });
  function endDrag() {
    if (!drag) return; var d = drag; drag = null;
    if (d.type === 'story' && d.moved && d.p) { var s = nearestStand(d.p); if (s) storySet(d.k, 'stand', s.id); }
    render(d.moved ? {} : { base: false });
  }
  svg.addEventListener('pointerup', endDrag);
  svg.addEventListener('pointercancel', endDrag);
  svg.addEventListener('dblclick', function (e) {
    if (draw) { finishDraw(); return; }
    var h = e.target.closest('[data-v]'); if (!h) return;
    var a = h.dataset.v.split('|'), L = lineAt(a[0], +a[1]), min = CLOSED[a[0]] ? 3 : 2;
    if (L.length <= min) { toast('A ' + LINE[a[0]].toLowerCase() + ' needs at least ' + min + ' points'); return; }
    remember(); L.splice(+a[2], 1); render();
  });

  function toolClick(P) {
    var g = w2g(P);
    if (tool === 'road' || tool === 'path' || tool === 'drive') {
      if (!draw) { draw = { kind: tool, pts: [] }; panel(); }
      var last = draw.pts[draw.pts.length - 1];
      if (!last || Math.hypot(last[0] - g[0], last[1] - g[1]) > 3) draw.pts.push(g);
      gOver.innerHTML = overlay(); return;
    }
    remember();
    if (tool === 'text') { D.labels.push({ t: 'New text', k: 'small', a: 'middle', x: g[0], y: g[1] }); sel = { type: 'label', a: D.labels.length - 1 }; }
    else if (tool === 'stand') {
      var n = 1, id; do { id = 'new-stand-' + n++; } while (standById(id));
      var fence = D.fence.map(g2w), inside = fence.length > 2 && CL.inPoly(P[0], P[1], fence);
      D.newStands.push({ id: id, name: 'New stand ' + (n - 1), area: inside ? 'fenced' : 'unfenced', guests: 8, map: { x: r1(P[0] / W * 100), y: r1(P[1] / H * 100) } });
      sel = { type: 'stand', a: id };
    } else if (tool === 'house') { D.house.push([g[0] - 11, g[1] - 7, 22, 14]); sel = { type: 'rect', a: 'house|' + (D.house.length - 1) }; }
    else if (tool === 'place' && placeId) { setStand(placeId, [r1(P[0] / W * 100), r1(P[1] / H * 100)]); sel = { type: 'stand', a: placeId }; }
    tool = 'select'; placeId = ''; svg.classList.remove('drawing'); render();
    var f = $('[data-lf="t"],[data-nf="name"]', side); if (f) { f.focus(); f.select(); }
  }
  function finishDraw() {
    if (!draw) return;
    var pts = draw.pts, kind = draw.kind; draw = null;
    if (pts.length < 2) { toast('Click at least two points to draw a line'); setTool('select'); return; }
    remember();
    if (kind === 'drive') { D.drive = pts; sel = { type: 'line', a: 'drive', b: 0 }; }
    else { var k = kind === 'road' ? 'roads' : 'paths'; D[k].push(pts); sel = { type: 'line', a: k, b: D[k].length - 1 }; }
    tool = 'select'; svg.classList.remove('drawing'); render();
    toast(kind === 'drive' ? 'Game drive route redrawn' : kind === 'road' ? 'Road added' : 'Footpath added');
  }
  function deleteSel() {
    if (!sel) return;
    if (sel.type === 'line' && !MANY[sel.a]) { toast('The ' + LINE[sel.a].toLowerCase() + ' cannot be deleted. Drag its points instead.'); return; }
    if (sel.type === 'rect' && sel.a.indexOf('house') !== 0) return;
    if (sel.type === 'gate' || sel.type === 'story') return;
    remember();
    if (sel.type === 'label') D.labels.splice(sel.a, 1);
    else if (sel.type === 'line') D[sel.a].splice(sel.b, 1);
    else if (sel.type === 'rect') D.house.splice(+sel.a.split('|')[1], 1);
    else if (sel.type === 'stand') { var n = D.newStands.filter(function (x) { return x.id === sel.a; })[0]; if (n) D.newStands.splice(D.newStands.indexOf(n), 1); else D.stands[sel.a] = null; }
    sel = null; render();
  }

  /* ---------- panel events ---------- */
  side.addEventListener('click', function (e) {
    var t = e.target, b;
    if ((b = t.closest('[data-tool]'))) { setTool(b.dataset.tool); if (b.dataset.tool === 'drive') sel = null; return; }
    if (t.closest('[data-finish]')) return finishDraw();
    if (t.closest('[data-cancel]')) return setTool('select');
    if (t.closest('[data-del]')) return deleteSel();
    if ((b = t.closest('[data-place]'))) return setTool('place', b.dataset.place);
    if ((b = t.closest('[data-moment]')) && !t.closest('input,textarea,select')) { sel = { type: 'story', a: b.dataset.moment }; render({ base: false }); }
  });
  var typing = null;
  side.addEventListener('focusin', function (e) { if (e.target.matches('input:not([type=checkbox]),textarea') && !typing) typing = JSON.stringify(D); });
  side.addEventListener('focusout', function (e) { if (typing && typing !== JSON.stringify(D)) remember(typing); typing = null; bar(); });
  side.addEventListener('input', function (e) {
    var t = e.target, f;
    if ((f = t.dataset.lf) && sel && sel.type === 'label') { D.labels[sel.a][f] = t.value; renderSoon(); }
    else if ((f = t.dataset.nf) && sel && sel.type === 'stand') { var n = D.newStands.filter(function (x) { return x.id === sel.a; })[0]; if (n) { n[f] = f === 'guests' ? (parseInt(t.value, 10) || 8) : t.value; renderSoon(); } }
    else if ((f = t.dataset.rf) && sel && sel.type === 'rect') { rectOf(sel.a)[+f] = clamp(parseInt(t.value, 10) || 4, 4, 200); renderSoon(); }
    else if (t.dataset.sf) { var p = t.dataset.sf.split('|'); storySet(p[0], p[1], t.value.trim()); if (p[1] === 'stand') render({ base: false, panel: false }); else bar(); }
  });
  side.addEventListener('change', function (e) {
    var t = e.target;
    if (t.dataset.show) { show[t.dataset.show] = t.checked; if (sel && ((sel.type === 'stand' && !show.stands) || (sel.type === 'label' && !show.labels))) sel = null; gOver.innerHTML = overlay(); return; }
    if (t.matches('select[data-lf], select[data-nf]')) { if (typing !== null) { remember(typing); typing = JSON.stringify(D); } render({ panel: false }); }
    if (t.matches('[data-kind]') && sel && sel.type === 'line' && t.value !== sel.a) { remember(); var L = D[sel.a].splice(sel.b, 1)[0]; D[t.value].push(L); sel = { type: 'line', a: t.value, b: D[t.value].length - 1 }; render(); }
    if (t.matches('select[data-sf]')) { if (typing !== null) { remember(typing); typing = null; } }
  });

  /* ---------- top bar events ---------- */
  $$('[data-view]').forEach(function (b) { b.addEventListener('click', function () { view = b.dataset.view; $$('[data-view]').forEach(function (x) { x.classList.toggle('on', x === b); }); sel = view === 'story' ? { type: 'line', a: 'drive', b: 0 } : null; tool = 'select'; draw = null; svg.classList.remove('drawing'); render({ base: false }); }); });
  $('[data-undo]').addEventListener('click', undo);
  $('[data-redo]').addEventListener('click', redo);
  $('[data-save]').addEventListener('click', function () {
    try { localStorage.setItem(KEY, JSON.stringify(D)); } catch (x) { toast('Could not save: this browser is out of space'); return; }
    savedJSON = JSON.stringify(D); bar(); toast('Saved. Refresh the website to see the new map.');
    try { window.parent.postMessage({ kyleu: 'map-saved' }, location.origin); } catch (x) {}
  });
  $('[data-reset]').addEventListener('click', function () {
    if (!window.confirm('Put the maps back to the original layout? Your moved campsites, text, roads and new campsites will be removed. You can undo this until you save.')) return;
    remember(); D = CL.defaults(); sel = null; render(); toast('Back to the original layout. Press Save to use it on the website.');
  });
  $('[data-download]').addEventListener('click', function () {
    var js = '/* Kyleu map layout, made in the admin map editor on ' + new Date().toISOString().slice(0, 10) + '.\n   Replace assets/js/campmap-layout.js with this file to publish it. */\nwindow.Kyleu = window.Kyleu || {};\nwindow.Kyleu.MAP_LAYOUT = ' + JSON.stringify(D) + ';\n';
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([js], { type: 'text/javascript' })); a.download = 'campmap-layout.js'; document.body.appendChild(a); a.click(); a.remove();
    toast('Downloaded campmap-layout.js');
  });
  document.addEventListener('keydown', function (e) {
    var inField = e.target.matches && e.target.matches('input,textarea,select');
    if ((e.ctrlKey || e.metaKey) && !inField && e.key.toLowerCase() === 'z') { e.preventDefault(); return e.shiftKey ? redo() : undo(); }
    if ((e.ctrlKey || e.metaKey) && !inField && e.key.toLowerCase() === 'y') { e.preventDefault(); return redo(); }
    if (inField) return;
    if (e.key === 'Enter' && draw) { e.preventDefault(); finishDraw(); }
    else if (e.key === 'Escape') { if (draw || tool !== 'select') setTool('select'); else { sel = null; render({ base: false }); } }
    else if ((e.key === 'Delete' || e.key === 'Backspace') && sel) { e.preventDefault(); deleteSel(); }
  });
  window.addEventListener('beforeunload', function (e) { if (D && dirty()) { e.preventDefault(); e.returnValue = ''; } });

  /* ---------- start ---------- */
  K.standsFile().then(function (list) {
    BASE = list; D = fill(CL.saved()); savedJSON = JSON.stringify(D); render();
  }).catch(function () { side.innerHTML = '<p class="me-muted">The map could not load. Open the admin through the web server.</p>'; });
})();
