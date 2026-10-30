/* =========================================================
   Kyleu booking engine (MOCK-UP)
   - Stands come from content/stands.md, prices from content/prices.md
   - Availability is SIMULATED (see fakeBooked) until the real booking
     system is connected, see docs/BOOKINGS-AND-PAYMENTS.md
   - Nothing is sent anywhere; the confirmation is a demo.
   ========================================================= */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var K = window.Kyleu;
  var DAY = 864e5;
  var STANDS = [], P = null, S = null;
  var state = { ci: null, co: null, adults: 2, pens: 0, kids: 0, area: '', view: 'grid' };
  var extras = {};

  /* ---------- dates ---------- */
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); }
  function parse(s) { if (!s) return null; var p = s.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function addDays(d, n) { var x = new Date(d); x.setDate(x.getDate() + n); return x; }
  function today() { var t = new Date(); t.setHours(0, 0, 0, 0); return t; }
  function nightsOf(ci, co) { var out = []; for (var d = new Date(ci); d < co; d = addDays(d, 1)) out.push(new Date(d)); return out; }
  function nice(d, opts) { return d.toLocaleDateString('en-ZA', opts || { weekday: 'short', day: 'numeric', month: 'short' }); }
  function isWeekendNight(d) { var dow = d.getDay(); return dow === 5 || dow === 6 || !!(P && P.holidays[iso(addDays(d, 1))]); }

  /* ---------- simulated availability (replace with real system) ---------- */
  function hash(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return ((h >>> 0) % 1000) / 1000; }
  function fakeBooked(stand, d) {
    if (d < today()) return false;
    var key = iso(d); var wk = d.getDay() === 5 || d.getDay() === 6;
    // weekends book as a block: use the Friday's key for Sat so pairs match
    if (d.getDay() === 6) key = iso(addDays(d, -1));
    var r = hash(stand.id + '|' + key);
    return r < (wk ? 0.3 : 0.07);
  }
  function isFree(stand, ci, co) { return nightsOf(ci, co).every(function (d) { return !fakeBooked(stand, d); }); }

  /* ---------- pricing ---------- */
  function rates(stand) {
    var sec = stand.area === 'self-sufficient' ? 'Self-sufficient' : 'Ablution stands';
    return {
      weekend: P.num(sec, 'Weekend per person per night', stand.area === 'self-sufficient' ? 180 : 245),
      weekday: P.num(sec, 'Weekday per person per night', stand.area === 'self-sufficient' ? 100 : 160),
      pens: P.num(sec, 'Pensioner weekday per person per night', stand.area === 'self-sufficient' ? 100 : 115),
      kid: P.num(sec, 'Children under 12', 0)
    };
  }
  function quote(stand, ci, co, g, ex) {
    g = g || state; ex = ex || {};
    var R = rates(stand), nights = nightsOf(ci, co), lines = [], acc = 0, wkN = 0, wdN = 0, pensWd = 0;
    nights.forEach(function (d) {
      var wk = isWeekendNight(d);
      if (wk) wkN++; else wdN++;
      var pensRate = (!wk && d.getDay() >= 1 && d.getDay() <= 4) ? R.pens : (wk ? R.weekend : R.weekday);
      if (!wk && d.getDay() >= 1 && d.getDay() <= 4) pensWd++;
      acc += g.adults * (wk ? R.weekend : R.weekday) + g.pens * pensRate + g.kids * R.kid;
    });
    var people = g.adults + g.pens;
    if (wkN) lines.push({ t: wkN + ' weekend night' + (wkN > 1 ? 's' : '') + ' × ' + people + ' × ' + K.money(R.weekend), v: wkN * people * R.weekend });
    if (wdN) {
      var wdTotal = wdN * g.adults * R.weekday + g.pens * (pensWd * R.pens + (wdN - pensWd) * R.weekday);
      lines.push({ t: wdN + ' weekday night' + (wdN > 1 ? 's' : '') + ' × ' + people + (g.pens && pensWd ? ' (pensioner rate Mon-Thu)' : ' × ' + K.money(R.weekday)), v: wdTotal });
    }
    if (g.kids) lines.push({ t: g.kids + ' child' + (g.kids > 1 ? 'ren' : '') + ' under 12', v: 0, free: true });
    var stay = acc;
    // extras
    var exLines = [];
    EXTRAS.forEach(function (x) {
      if (x.only && x.only !== stand.area) return;
      var q = ex[x.id] || 0; if (!q) return;
      var v = x.price(q, nights.length);
      exLines.push({ t: x.label(q, nights.length), v: v });
    });
    var exTotal = exLines.reduce(function (a, l) { return a + l.v; }, 0);
    var total = stay + exTotal;
    var depPct = P.num('Booking rules', 'Deposit percentage', 50);
    var daysToArrive = Math.round((ci - today()) / DAY);
    var balDays = P.num('Booking rules', 'Balance due days before arrival', 7);
    return { nights: nights.length, wkN: wkN, wdN: wdN, lines: lines, stay: stay, exLines: exLines, exTotal: exTotal, total: total, deposit: Math.round(total * depPct / 100), depPct: depPct, payFull: daysToArrive <= balDays, balanceDue: addDays(ci, -balDays), R: R };
  }
  function dinokengFees(ci, co, g, vehicles) {
    var n = nightsOf(ci, co).length, cap = P.num('Dinokeng', 'Conservation fee cap per person per stay', 300);
    var ad = Math.min(cap, n * P.num('Dinokeng', 'Conservation fee adult per night', 75)) * (g.adults + g.pens);
    var kd = Math.min(cap, n * P.num('Dinokeng', 'Conservation fee child 2-12 per night', 50)) * g.kids;
    var sd = (vehicles || 1) * P.num('Dinokeng', 'Self-drive permit per vehicle per stay', 250);
    return { conservation: ad + kd, selfDrive: sd, total: ad + kd + sd };
  }

  /* ---------- add-ons (prices from prices.md) ---------- */
  var EXTRAS = [];
  function buildExtras() {
    var wood = P.num('Camp shop', 'Sekelbos firewood 6kg bag', 25), lwood = P.num('Camp shop', 'Long-burning wood 20kg', 40), ice = P.num('Camp shop', 'Ice per bag', 15), fl = P.num('Camp shop', 'Firelighters pack of 10', 25), pp = P.num('Self-sufficient', 'Porta potty hire per night', 100);
    var gd3 = P.num('Game drives', 'Game drive 3 or more people per person', 400), gd2 = P.num('Game drives', 'Game drive 2 people per person', 450), gd1 = P.num('Game drives', 'Game drive 1 person', 900);
    EXTRAS = [
      { id: 'gd', img: 'assets/img/photos/game-drive-vehicle.jpg', name: 'Guided game drive', sub: K.money(gd3) + ' pp (3+), ' + K.money(gd2) + ' pp (2), ' + K.money(gd1) + ' (1) · kids over 5', unit: 'people', max: 10, price: function (q) { return q >= 3 ? q * gd3 : q === 2 ? 2 * gd2 : gd1; }, label: function (q) { return 'Game drive · ' + q + ' ' + (q > 1 ? 'people' : 'person'); } },
      { id: 'pp', only: 'self-sufficient', img: 'assets/img/photos/ablution-bathroom.jpg', name: 'Porta potty hire', sub: K.money(pp) + ' per night incl. cleaning', unit: 'toggle', max: 1, price: function (q, n) { return q * n * pp; }, label: function (q, n) { return 'Porta potty · ' + n + ' night' + (n > 1 ? 's' : ''); } },
      { id: 'wood', img: 'assets/img/shop/sekelbos-wood.jpg', name: 'Extra sekelbos wood (6 kg)', sub: K.money(wood) + ' a bag · 1 free bag per night on ablution stands', unit: 'bags', max: 20, price: function (q) { return q * wood; }, label: function (q) { return q + ' × extra wood'; } },
      { id: 'lwood', img: 'assets/img/shop/long-burning-wood.jpg', name: 'Long-burning wood (20 kg)', sub: K.money(lwood) + ' a bag', unit: 'bags', max: 10, price: function (q) { return q * lwood; }, label: function (q) { return q + ' × long-burning wood'; } },
      { id: 'ice', img: 'assets/img/shop/ice.jpg', name: 'Ice', sub: K.money(ice) + ' a bag · waiting on arrival', unit: 'bags', max: 20, price: function (q) { return q * ice; }, label: function (q) { return q + ' × ice'; } },
      { id: 'fl', img: 'assets/img/shop/firelighters.jpg', name: 'Firelighters (10)', sub: K.money(fl) + ' a pack', unit: 'packs', max: 10, price: function (q) { return q * fl; }, label: function (q) { return q + ' × firelighters'; } }
    ];
  }

  /* ---------- rendering: stand cards ---------- */
  var grid, mapBox, resultsTitle, resultsSub, ruleNote;
  function guestsTotal() { return state.adults + state.pens + state.kids; }
  function cover(st) { return st.photos[0] || ({ fenced: 'assets/img/photos/fenced-camp-lawn.jpg', unfenced: 'assets/img/photos/trailer-unfenced.jpg', 'self-sufficient': 'assets/img/wildlife/tree-sunset.jpg' })[st.area]; }
  function photosOf(st) { return st.photos.length ? st.photos : [cover(st)]; }
  function areaIcon(a) { return a === 'fenced' ? 'i-fence' : a === 'unfenced' ? 'i-paw' : 'i-tree'; }
  function facilityText(st) { return st.area === 'self-sufficient' ? 'No facilities' : 'Private ablution'; }

  function cardHTML(st) {
    var free = isFree(st, state.ci, state.co), fits = guestsTotal() <= st.guests;
    var q = quote(st, state.ci, state.co);
    var ph = photosOf(st);
    return '<article class="stand-card' + (free ? '' : ' booked') + '" data-id="' + st.id + '" data-reveal>' +
      '<div class="sc-media"><div class="sc-track">' + ph.map(function (p, i) { return '<img src="' + p + '" alt="' + K.esc(st.name) + ' campsite photo ' + (i + 1) + '" loading="lazy">'; }).join('') + '</div>' +
      (ph.length > 1 ? '<button class="sc-nav prev" type="button" aria-label="Previous photo"><svg><use href="#i-arrow-l"/></svg></button><button class="sc-nav next" type="button" aria-label="Next photo"><svg><use href="#i-arrow"/></svg></button><div class="sc-dots">' + ph.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div>' : '') +
      '<div class="sc-badges"><span class="badge area-' + st.area + '"><svg width="13" height="13"><use href="#' + areaIcon(st.area) + '"/></svg>' + st.areaInfo.short + '</span>' +
      (free ? '<span class="badge"><i></i>Available</span>' : '<span class="badge booked"><i></i>Booked</span>') + '</div>' +
      (st.status === 'new' ? '<span class="badge new" style="position:absolute;bottom:10px;left:10px">✨ New stand</span>' : '') +
      (st.photos.length ? '<span class="sc-photo-count"><svg><use href="#i-camera"/></svg>' + st.photos.length + '</span>' : '') +
      '</div><div class="sc-body"><div class="sc-title"><h3>' + K.esc(st.name) + '</h3></div><div class="sc-feel">' + K.esc(st.feel) + '</div>' +
      '<div class="sc-meta"><span><svg><use href="#i-users"/></svg>Up to ' + st.guests + '</span><span><svg><use href="#i-tent"/></svg>' + K.esc(st.setups) + '</span><span><svg><use href="#' + (st.area === 'self-sufficient' ? 'i-bolt-off' : 'i-shower') + '"/></svg>' + facilityText(st) + '</span></div>' +
      (!fits ? '<div class="rule-note" style="margin:0;padding:8px 12px;font-size:.8rem"><svg><use href="#i-info"/></svg>Fits up to ' + st.guests + ' guests. WhatsApp us for bigger groups</div>' : '') +
      '<div class="sc-foot"><div class="sc-price"><b>' + K.money(q.stay) + '</b><small>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + ' · ' + (state.adults + state.pens) + ' adult' + (state.adults + state.pens > 1 ? 's' : '') + (state.kids ? ' + ' + state.kids + ' kid' + (state.kids > 1 ? 's' : '') : '') + '</small></div>' +
      '<button class="btn btn-sm' + (free ? '' : ' btn-ghost') + '" type="button" data-open="' + st.id + '">' + (free ? 'View &amp; book' : 'Other dates') + '</button></div></div></article>';
  }

  function filtered() { return STANDS.filter(function (s) { return !state.area || s.area === state.area; }); }
  function render() {
    var list = filtered();
    var freeList = list.filter(function (s) { return isFree(s, state.ci, state.co); });
    // available first, then by area order
    list.sort(function (a, b) { return (isFree(b, state.ci, state.co) - isFree(a, state.ci, state.co)); });
    var n = nightsOf(state.ci, state.co).length;
    resultsTitle.textContent = freeList.length + ' of ' + list.length + ' stands available';
    resultsSub.textContent = nice(state.ci) + ' → ' + nice(state.co) + ' · ' + n + ' night' + (n > 1 ? 's' : '') + ' · ' + guestsTotal() + ' guest' + (guestsTotal() > 1 ? 's' : '');
    grid.innerHTML = list.length ? list.map(cardHTML).join('') : '<div class="empty">No stands in this area yet.</div>';
    wireCards(); K.reveal(grid);
    renderMap();
    checkWeekendRule();
    $$('.area-pick').forEach(function (b) { b.classList.toggle('on', b.dataset.area === state.area); });
    $$('.sb-pills .pill').forEach(function (b) { b.classList.toggle('on', b.dataset.area === state.area); });
    var u = new URL(location.href);
    u.searchParams.set('in', iso(state.ci)); u.searchParams.set('out', iso(state.co)); u.searchParams.set('adults', state.adults);
    if (state.kids) u.searchParams.set('kids', state.kids); else u.searchParams.delete('kids');
    if (state.pens) u.searchParams.set('pens', state.pens); else u.searchParams.delete('pens');
    if (state.area) u.searchParams.set('area', state.area); else u.searchParams.delete('area');
    history.replaceState(null, '', u);
  }

  function wireCards() {
    $$('.stand-card', grid).forEach(function (card) {
      var track = $('.sc-track', card), dots = $$('.sc-dots i', card);
      if (dots.length) {
        track.addEventListener('scroll', function () { var i = Math.round(track.scrollLeft / track.clientWidth); dots.forEach(function (d, j) { d.classList.toggle('on', i === j); }); }, { passive: true });
        $('.sc-nav.prev', card).addEventListener('click', function (e) { e.stopPropagation(); track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }); });
        $('.sc-nav.next', card).addEventListener('click', function (e) { e.stopPropagation(); track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }); });
      }
      card.addEventListener('click', function (e) { if (e.target.closest('.sc-nav')) return; openSheet(card.dataset.id); });
    });
  }

  /* ---------- generated camp map (assets/js/campmap.js) ---------- */
  var mapCtl = null;
  function renderMap() {
    var host = $('.sitemap', mapBox); if (!host || !K.campMap) return;
    if (!mapCtl) mapCtl = K.campMap(host, {
      stands: STANDS,
      area: function () { return state.area; },
      info: function (st) {
        var free = isFree(st, state.ci, state.co), q = quote(st, state.ci, state.co);
        return { free: free, price: K.money(q.stay), sub: q.nights + ' night' + (q.nights > 1 ? 's' : '') + ' · ' + (state.adults + state.pens) + ' adult' + (state.adults + state.pens > 1 ? 's' : '') };
      },
      onOpen: function (st) { openSheet(st.id); }
    });
    else mapCtl.update();
  }

  /* ---------- weekend rule ---------- */
  function checkWeekendRule() {
    var nights = nightsOf(state.ci, state.co), hasFri = false, hasSat = false;
    nights.forEach(function (d) { if (d.getDay() === 5) hasFri = true; if (d.getDay() === 6) hasSat = true; });
    var minN = P.num('Booking rules', 'Minimum nights over a weekend', 2);
    var bad = (hasFri && !hasSat) || (hasSat && !hasFri);
    ruleNote.classList.toggle('hidden', !bad || minN < 2);
    if (bad) $('span', ruleNote).innerHTML = '<b>Weekends are booked as a whole</b> (Friday + Saturday nights, minimum ' + minN + ' nights). We can adjust your dates for you.';
    return !bad;
  }
  function fixWeekend() {
    var nights = nightsOf(state.ci, state.co), hasFri = nights.some(function (d) { return d.getDay() === 5; });
    if (hasFri) state.co = addDays(state.co, 1);
    else { var ci = addDays(state.ci, -1); if (ci >= today()) state.ci = ci; else state.co = addDays(state.co, 1); }
    syncSearch(); render();
  }

  /* ---------- stand sheet ---------- */
  var sheet, backdrop, current = null, sel = { ci: null, co: null }, calMonth = null;
  function openSheet(id) {
    var st = STANDS.filter(function (s) { return s.id === id; })[0]; if (!st) return;
    current = st; sel.ci = state.ci; sel.co = state.co; calMonth = new Date(state.ci.getFullYear(), state.ci.getMonth(), 1);
    var ph = photosOf(st);
    var hl = st.highlights.map(function (h) { var no = /^no /i.test(h); return '<li class="' + (no ? 'no' : '') + '"><svg><use href="#' + (no ? 'i-x' : 'i-check') + '"/></svg>' + K.esc(h) + '</li>'; }).join('');
    var base = st.area === 'self-sufficient'
      ? ['No ablution, water or electricity', 'No braai facilities (loose boma for fires)', 'Unfenced: wild animals roam freely']
      : ['Shower, toilet, basin & scullery', 'Hot water (gas geyser) & solar LED lights', 'No electricity at the stand', '1 free bag of firewood per night'];
    base = base.map(function (h) { var no = /^no |unfenced/i.test(h); return '<li class="' + (no ? 'no' : '') + '"><svg><use href="#' + (no ? 'i-info' : 'i-check') + '"/></svg>' + h + '</li>'; }).join('');
    $('.sheet-scroll', sheet).innerHTML =
      '<div class="sg-main"><img src="' + ph[0] + '" alt="' + K.esc(st.name) + '"></div>' +
      (ph.length > 1 ? '<div class="sg-thumbs">' + ph.map(function (p, i) { return '<button type="button" class="' + (i ? '' : 'on') + '" data-i="' + i + '"><img src="' + p + '" alt=""></button>'; }).join('') + '</div>' : '') +
      '<div class="sheet-body">' +
      '<div><span class="badge area-' + st.area + '" style="margin-bottom:10px"><svg width="13" height="13"><use href="#' + areaIcon(st.area) + '"/></svg>' + st.areaInfo.name + '</span>' + (st.status === 'new' ? ' <span class="badge new">✨ New</span>' : '') +
      '<h2>' + K.esc(st.name) + '</h2><p class="muted" style="margin:0">' + K.esc(st.description) + '</p></div>' +
      '<div class="facts"><div class="fact"><svg><use href="#i-users"/></svg><b>Up to ' + st.guests + '</b><small>guests</small></div><div class="fact"><svg><use href="#i-tent"/></svg><b>' + K.esc(st.setups.replace(/ trailers?.*$| or tents?$/i, '')) + '</b><small>' + (/tent/i.test(st.setups) ? 'trailers / tents' : 'trailers') + '</small></div><div class="fact"><svg><use href="#' + (st.area === 'self-sufficient' ? 'i-bolt-off' : 'i-shower') + '"/></svg><b>' + facilityText(st) + '</b><small>' + (st.area === 'self-sufficient' ? 'be self-sufficient' : 'with hot water') + '</small></div></div>' +
      '<div class="sheet-section"><h3>Highlights</h3><ul class="hl-list">' + hl + '</ul></div>' +
      '<div class="sheet-section"><h3>What\'s at the stand</h3><ul class="hl-list">' + base + '</ul></div>' +
      (st.map ? '<div class="sheet-section"><h3>Where it is</h3><div class="mini-map">' + K.campMapMini(STANDS, st.id) + '</div><p class="muted" style="font-size:.82rem;margin:8px 0 0"><a href="#map" data-close-sheet>Open the full camp map</a></p></div>' : '') +
      '<div class="sheet-section"><h3>Pick your dates</h3><div class="cal"></div><div class="cal-note"><span><i style="background:#fff;border:1px solid #ddd"></i>Available</span><span><i style="background:#f3e4e1"></i>Booked</span><span><i style="background:var(--sun);border-radius:50%;width:6px;height:6px"></i>Weekend rate</span></div></div>' +
      '<div class="sheet-section"><h3>Price</h3><div class="breakdown" data-bd></div><p class="muted" style="font-size:.8rem;margin:8px 0 0">Dinokeng conservation &amp; self-drive fees are paid separately to the reserve. <a href="discover.html#dinokeng-fees">See fees</a></p></div>' +
      '</div>';
    $$('.sg-thumbs button', sheet).forEach(function (b) { b.onclick = function () { $('.sg-main img', sheet).src = ph[+b.dataset.i]; $$('.sg-thumbs button', sheet).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('.sg-main', sheet).onclick = function () { var i = $$('.sg-thumbs button', sheet).findIndex(function (b) { return b.classList.contains('on'); }); K.lightbox(ph.map(function (p) { return { src: p, cap: st.name }; }), Math.max(0, i)); };
    $$('[data-close-sheet]', sheet).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); closeSheet(); setView('map'); $('#results').scrollIntoView({ behavior: 'smooth' }); }; });
    renderCal(); updateSheetPrice();
    sheet.classList.add('open'); backdrop.classList.add('open'); document.body.classList.add('lock'); sheet.setAttribute('aria-hidden', 'false');
    $('.sheet-scroll', sheet).scrollTop = 0;
    history.replaceState(null, '', location.pathname + location.search + '#stand=' + st.id);
    setTimeout(function () { $('.sheet-close', sheet).focus(); }, 50);
  }
  function closeSheet() { sheet.classList.remove('open'); backdrop.classList.remove('open'); if (!$('.modal.open')) document.body.classList.remove('lock'); sheet.setAttribute('aria-hidden', 'true'); history.replaceState(null, '', location.pathname + location.search); }

  function renderCal() {
    var box = $('.cal', sheet); var m = calMonth, first = new Date(m.getFullYear(), m.getMonth(), 1), start = (first.getDay() + 6) % 7, dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate();
    var h = '<div class="cal-head"><button type="button" data-m="-1" aria-label="Previous month"><svg><use href="#i-arrow-l"/></svg></button><b>' + first.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) + '</b><button type="button" data-m="1" aria-label="Next month"><svg><use href="#i-arrow"/></svg></button></div><div class="cal-grid">';
    ['M', 'T', 'W', 'T', 'F', 'S', 'S'].forEach(function (d) { h += '<span class="dow">' + d + '</span>'; });
    for (var i = 0; i < start; i++) h += '<span></span>';
    for (var d = 1; d <= dim; d++) {
      var dt = new Date(m.getFullYear(), m.getMonth(), d), past = dt < today(), bk = fakeBooked(current, dt), cls = [];
      if (bk) cls.push('bk'); if (isWeekendNight(dt)) cls.push('we');
      if (sel.ci && +dt === +sel.ci) cls.push('sel'); if (sel.co && +dt === +sel.co) cls.push('sel');
      if (sel.ci && sel.co && dt > sel.ci && dt < sel.co) cls.push('mid');
      h += '<button type="button" data-d="' + iso(dt) + '" class="' + cls.join(' ') + '"' + (past ? ' disabled' : '') + ' aria-label="' + nice(dt, { weekday: 'long', day: 'numeric', month: 'long' }) + (bk ? ', booked' : '') + '">' + d + '</button>';
    }
    box.innerHTML = h + '</div>';
    $$('[data-m]', box).forEach(function (b) { b.onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + (+b.dataset.m), 1); renderCal(); }; });
    $$('[data-d]', box).forEach(function (b) {
      b.onclick = function () {
        var dt = parse(b.dataset.d);
        if (!sel.ci || (sel.ci && sel.co) || dt <= sel.ci) {
          if (fakeBooked(current, dt)) { K.toast('That night is already booked'); return; }
          sel.ci = dt; sel.co = null;
        } else {
          if (!isFree(current, sel.ci, dt)) { K.toast('Some nights in that range are booked. Try other dates'); return; }
          sel.co = dt;
        }
        renderCal(); updateSheetPrice();
      };
    });
  }

  function updateSheetPrice() {
    var bd = $('[data-bd]', sheet), bb = $('.book-box', sheet);
    if (!sel.co) {
      bd.innerHTML = '<div class="row sub"><span>Now pick your check-out date</span></div>';
      $('.tot', bb).innerHTML = '<b>-</b><small>Select check-out</small>';
      $('[data-reserve]', bb).disabled = true; return;
    }
    var free = isFree(current, sel.ci, sel.co), q = quote(current, sel.ci, sel.co);
    bd.innerHTML = '<div class="row sub"><span>' + nice(sel.ci) + ' → ' + nice(sel.co) + '</span><span>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + '</span></div>' +
      q.lines.map(function (l) { return '<div class="row"><span>' + l.t + '</span><span>' + (l.free ? 'FREE' : K.money(l.v)) + '</span></div>'; }).join('') +
      '<div class="row total"><span>Total</span><span>' + K.money(q.stay) + '</span></div>';
    $('.tot', bb).innerHTML = '<b>' + K.money(q.stay) + '</b><small>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + ' · ' + (q.payFull ? 'full payment due now' : K.money(q.deposit) + ' deposit secures it') + '</small>';
    var btn = $('[data-reserve]', bb); btn.disabled = !free;
    btn.innerHTML = free ? 'Reserve <svg><use href="#i-arrow"/></svg>' : 'Not available';
  }

  /* ---------- checkout ---------- */
  var modal, step = 1, booking = null;
  function openCheckout() {
    if (!sel.co) return;
    var nights = nightsOf(sel.ci, sel.co), hasFri = nights.some(function (d) { return d.getDay() === 5; }), hasSat = nights.some(function (d) { return d.getDay() === 6; });
    if (hasFri !== hasSat) { K.toast('Weekend stays need both Friday and Saturday night'); return; }
    if ((S && /q2b/i.test(S.get('Booking mode', 'demo')))) { window.open(S.get('Live availability (Q2B)'), '_blank', 'noopener'); return; }
    booking = { stand: current, ci: sel.ci, co: sel.co, g: { adults: state.adults, pens: state.pens, kids: state.kids } };
    extras = {};
    step = 1; renderSide(); renderExtras(); goStep(1);
    modal.classList.add('open'); document.body.classList.add('lock');
    var payFull = quote(booking.stand, booking.ci, booking.co).payFull;
    $$('.pay-opt', modal).forEach(function (o) { if (o.dataset.pay === 'deposit') o.hidden = payFull; });
    $('[name=pay][value=' + (payFull ? 'full' : 'deposit') + ']', modal).checked = true; payChanged();
  }
  function closeCheckout() { modal.classList.remove('open'); if (!sheet.classList.contains('open')) document.body.classList.remove('lock'); }
  function goStep(n) {
    step = n;
    $$('.mc-step', modal).forEach(function (s) { s.classList.toggle('on', +s.dataset.step === n); });
    $$('.steps li', modal).forEach(function (li, i) { li.classList.toggle('on', i + 1 === n); li.classList.toggle('done', i + 1 < n); });
    $('.mc-main', modal).scrollTop = 0;
    if (n === 4) $('.mc-side', modal).style.display = 'none'; else $('.mc-side', modal).style.display = '';
  }
  function renderSide() {
    var b = booking, q = quote(b.stand, b.ci, b.co, b.g, extras), side = $('.mc-side', modal);
    var dk = dinokengFees(b.ci, b.co, b.g, parseInt(($('[name=vehicles]', modal) || {}).value, 10) || 1);
    side.innerHTML = '<div class="ms-img"><img src="' + cover(b.stand) + '" alt=""></div><div class="ms-body">' +
      '<div><span class="badge area-' + b.stand.area + '">' + b.stand.areaInfo.short + '</span><h3 style="margin-top:8px">' + K.esc(b.stand.name) + '</h3></div>' +
      '<div class="ms-dates"><div><small>Check-in</small><b>' + nice(b.ci) + '</b></div><div><small>Check-out</small><b>' + nice(b.co) + '</b></div></div>' +
      '<div class="muted" style="font-size:.88rem;font-weight:700">' + (b.g.adults + b.g.pens) + ' adult' + (b.g.adults + b.g.pens > 1 ? 's' : '') + (b.g.pens ? ' (' + b.g.pens + ' pensioner' + (b.g.pens > 1 ? 's' : '') + ')' : '') + (b.g.kids ? ' · ' + b.g.kids + ' child' + (b.g.kids > 1 ? 'ren' : '') : '') + '</div>' +
      '<div class="breakdown">' + q.lines.map(function (l) { return '<div class="row"><span>' + l.t + '</span><span>' + (l.free ? 'FREE' : K.money(l.v)) + '</span></div>'; }).join('') +
      q.exLines.map(function (l) { return '<div class="row"><span>' + l.t + '</span><span>' + K.money(l.v) + '</span></div>'; }).join('') +
      '<div class="row total"><span>Total</span><span>' + K.money(q.total) + '</span></div>' +
      (q.payFull ? '<div class="row sub"><span>Arriving within 7 days: full payment due now</span></div>' : '<div class="row sub"><span>' + q.depPct + '% deposit to secure</span><span>' + K.money(q.deposit) + '</span></div><div class="row sub"><span>Balance due by ' + nice(q.balanceDue, { day: 'numeric', month: 'short' }) + '</span><span>' + K.money(q.total - q.deposit) + '</span></div>') +
      '</div><div class="note-card" style="padding:14px 16px;font-size:.84rem"><b>Paid to Dinokeng separately (estimate):</b><br>Conservation fees ' + K.money(dk.conservation) + ' + self-drive ' + K.money(dk.selfDrive) + ' = <b>' + K.money(dk.total) + '</b><br><a href="https://dinokeng.plnktn.io/south" target="_blank" rel="noopener">Pay online before you arrive</a></div></div>';
    // pay option amounts
    var amt = { deposit: q.deposit, full: q.total, eft: q.payFull ? q.total : q.deposit, invoice: q.payFull ? q.total : q.deposit };
    $$('.pay-opt', modal).forEach(function (o) { $('.amt', o).textContent = K.money(amt[o.dataset.pay]); });
    $('[data-pay-amount]', modal).textContent = K.money(amt[($('[name=pay]:checked', modal) || {}).value || 'deposit']);
    return q;
  }
  function renderExtras() {
    var box = $('[data-extras]', modal);
    box.innerHTML = EXTRAS.filter(function (x) { return !x.only || x.only === booking.stand.area; }).map(function (x) {
      var ctl = x.unit === 'toggle' ? '<label class="check" style="margin:0"><input type="checkbox" data-x="' + x.id + '"> Add</label>'
        : '<div class="sb-guests"><button type="button" data-xm="' + x.id + '" aria-label="Fewer">−</button><output data-xo="' + x.id + '">0</output><button type="button" data-xp="' + x.id + '" aria-label="More">+</button></div>';
      return '<div class="addon"><img src="' + x.img + '" alt=""><div class="ad-txt"><b>' + x.name + '</b><small>' + x.sub + '</small></div>' + ctl + '</div>';
    }).join('');
    $$('[data-xp],[data-xm]', box).forEach(function (b) {
      b.onclick = function () {
        var id = b.dataset.xp || b.dataset.xm, x = EXTRAS.filter(function (e) { return e.id === id; })[0];
        extras[id] = Math.max(0, Math.min(x.max, (extras[id] || 0) + (b.dataset.xp ? 1 : -1)));
        $('[data-xo="' + id + '"]', box).textContent = extras[id]; renderSide();
      };
    });
    $$('[data-x]', box).forEach(function (c) { c.onchange = function () { extras[c.dataset.x] = c.checked ? 1 : 0; renderSide(); }; });
  }
  function validate(stepEl) {
    var ok = true;
    $$('[required]', stepEl).forEach(function (inp) {
      var v = inp.type === 'checkbox' ? inp.checked : inp.value.trim(), bad = !v;
      if (!bad && inp.type === 'email') bad = !/^\S+@\S+\.\S+$/.test(inp.value);
      if (!bad && inp.name === 'phone') bad = inp.value.replace(/\D/g, '').length < 9;
      if (!bad && inp.name === 'cardnum') bad = !luhn(inp.value);
      if (!bad && inp.name === 'exp') bad = !validExp(inp.value);
      if (!bad && inp.name === 'cvc') bad = !/^\d{3,4}$/.test(inp.value);
      var f = inp.closest('.field') || inp.closest('.check'); if (f) f.classList.toggle('err', bad);
      if (bad && inp.type === 'checkbox') inp.closest('.check').style.color = 'var(--bad)'; else if (inp.type === 'checkbox') inp.closest('.check').style.color = '';
      if (bad) ok = false;
    });
    if (!ok) { var first = $('.err input, .err select', stepEl); if (first) first.focus(); K.toast('Please check the highlighted fields'); }
    return ok;
  }
  function luhn(n) { n = n.replace(/\D/g, ''); if (n.length < 13) return false; var s = 0, alt = false; for (var i = n.length - 1; i >= 0; i--) { var d = +n[i]; if (alt) { d *= 2; if (d > 9) d -= 9; } s += d; alt = !alt; } return s % 10 === 0; }
  function validExp(v) { var m = v.match(/^(\d{2})\s*\/\s*(\d{2})$/); if (!m) return false; var mo = +m[1], yr = 2000 + +m[2]; if (mo < 1 || mo > 12) return false; var now = new Date(); return yr > now.getFullYear() || (yr === now.getFullYear() && mo >= now.getMonth() + 1); }
  function payChanged() {
    var v = ($('[name=pay]:checked', modal) || {}).value;
    $$('.pay-opt', modal).forEach(function (o) { o.classList.toggle('on', o.dataset.pay === v); });
    var card = v === 'deposit' || v === 'full';
    $('[data-card]', modal).hidden = !card; $('[data-eft]', modal).hidden = card;
    $$('[data-card] input', modal).forEach(function (i) { i.required = card; });
    $('[data-pay-btn-label]', modal).textContent = card ? 'Pay ' : v === 'eft' ? 'Continue to bank & pay ' : 'Send booking request · ';
    renderSide();
  }
  function confirmBooking() {
    var f = function (n) { var el = $('[name=' + n + ']', modal); return el ? el.value.trim() : ''; };
    var q = renderSide(), pay = $('[name=pay]:checked', modal).value;
    var ref = 'KY' + String(booking.ci.getFullYear()).slice(2) + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    booking.ref = ref;
    var paid = pay === 'full' ? q.total : pay === 'deposit' ? q.deposit : 0;
    var box = $('[data-success]', modal);
    box.innerHTML = '<div class="success"><div class="success-badge"><svg class="ring" viewBox="0 0 110 110" fill="none" stroke="#3f7d3a" stroke-width="6" stroke-linecap="round"><circle cx="55" cy="55" r="50"/><path d="M34 57l14 14 28-30"/></svg></div>' +
      '<span class="hand">See you in the bush, ' + K.esc(f('first') || 'friend') + '!</span>' +
      '<h2 style="margin-top:6px">' + (paid ? 'Your reservation is confirmed' : 'Your reservation request is in') + '</h2>' +
      '<p class="muted">' + K.esc(booking.stand.name) + ' · ' + nice(booking.ci, { weekday: 'long', day: 'numeric', month: 'long' }) + ' to ' + nice(booking.co, { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
      '<div class="ref">' + ref + '</div>' +
      '<p class="muted" style="font-size:.9rem">' + (paid ? K.money(paid) + ' received. ' : '') + 'A confirmation has been sent to <b>' + K.esc(f('email')) + '</b>.</p>' +
      '<ol class="next-steps">' +
      (pay === 'invoice' ? '<li><b>1</b><span>We\'ll email your invoice. Pay the ' + (q.payFull ? 'full amount' : q.depPct + '% deposit (' + K.money(q.deposit) + ') within 5 days') + ' using reference <b>' + ref + '</b> and send proof of payment to info@kyleu.co.za.</span></li>' : '') +
      (!q.payFull && pay !== 'full' ? '<li><b>' + (pay === 'invoice' ? 2 : 1) + '</b><span>Balance of ' + K.money(q.total - q.deposit) + ' is due by ' + nice(q.balanceDue, { day: 'numeric', month: 'long' }) + '. We\'ll send a reminder.</span></li>' : '') +
      '<li><b>✓</b><span>Pay your Dinokeng conservation &amp; self-drive fees online or at Tau Gate. <a href="https://dinokeng.plnktn.io/south" target="_blank" rel="noopener">Pay Dinokeng fees</a></span></li>' +
      '<li><b>✓</b><span>Enter at Dinokeng <b>Tau Gate</b>, follow the main road 4.8 km, turn right onto Kaallaagte Road and continue 2 km. <a href="contact.html">Directions</a></span></li></ol>' +
      '<div class="cta-actions"><button class="btn" type="button" data-ics><svg><use href="#i-cal"/></svg>Add to calendar</button><a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/27604584478?text=' + encodeURIComponent('Hi Kyleu! My booking reference is ' + ref + ' (' + booking.stand.name + ', ' + iso(booking.ci) + ' to ' + iso(booking.co) + ').') + '"><svg><use href="#i-wa"/></svg>Share with Kyleu</a></div>' +
      '<div class="demo-flag" style="margin:22px 0 0;text-align:left"><svg><use href="#i-info"/></svg><span>Demo mode: this is a mock-up. No booking was made, nothing was charged and no details were sent anywhere.</span></div></div>';
    $('[data-ics]', box).onclick = downloadICS;
    goStep(4); confetti();
  }
  function downloadICS() {
    var b = booking, d = function (x) { return iso(x).replace(/-/g, ''); };
    var ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Kyleu Bush Camp//Booking//EN', 'BEGIN:VEVENT', 'UID:' + b.ref + '@kyleu.co.za', 'DTSTAMP:' + new Date().toISOString().replace(/[-:]/g, '').slice(0, 15) + 'Z', 'DTSTART;VALUE=DATE:' + d(b.ci), 'DTEND;VALUE=DATE:' + d(b.co), 'SUMMARY:Camping at Kyleu Bush Camp: ' + b.stand.name, 'LOCATION:Kyleu Bush Camp\\, Kaallaagte Road\\, Dinokeng Game Reserve', 'GEO:-25.371717;28.357836', 'DESCRIPTION:Booking ref ' + b.ref + '. Enter via Dinokeng Tau Gate. Questions: 060 458 4478 / info@kyleu.co.za', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' })); a.download = 'Kyleu-' + b.ref + '.ics'; a.click();
  }
  function confetti() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    var c = document.createElement('div'); c.className = 'confetti'; var cols = ['#e8731c', '#f4b740', '#5b6a35', '#b8461a', '#fff'];
    for (var i = 0; i < 60; i++) { var p = document.createElement('i'); p.style.left = Math.random() * 100 + '%'; p.style.background = cols[i % cols.length]; p.style.animationDuration = (2 + Math.random() * 2.5) + 's'; p.style.animationDelay = Math.random() * .6 + 's'; p.style.borderRadius = Math.random() > .5 ? '50%' : '2px'; c.appendChild(p); }
    $('.modal-card', modal).appendChild(c); setTimeout(function () { c.remove(); }, 5500);
  }

  /* ---------- search bar ---------- */
  function syncSearch() {
    $('#sb-in').value = iso(state.ci); $('#sb-out').value = iso(state.co);
    $('#sb-in').min = iso(today()); $('#sb-out').min = iso(addDays(state.ci, 1));
    $('[data-g=adults]').textContent = state.adults; $('[data-g=pens]').textContent = state.pens; $('[data-g=kids]').textContent = state.kids;
    $('#sb-guest-sum').textContent = (state.adults + state.pens) + ' adult' + (state.adults + state.pens > 1 ? 's' : '') + (state.kids ? ', ' + state.kids + ' kid' + (state.kids > 1 ? 's' : '') : '');
  }
  function setView(v) {
    state.view = v;
    $$('.sb-view button').forEach(function (b) { b.classList.toggle('on', b.dataset.view === v); });
    grid.hidden = v !== 'grid'; mapBox.hidden = v !== 'map';
  }

  /* ---------- init ---------- */
  document.addEventListener('DOMContentLoaded', function () {
    grid = $('.stands-grid'); if (!grid) return;
    mapBox = $('#map-view'); resultsTitle = $('[data-results-title]'); resultsSub = $('[data-results-sub]'); ruleNote = $('.rule-note[data-weekend]');
    sheet = $('.sheet'); backdrop = $('.sheet-backdrop'); modal = $('.modal');

    var qs = new URLSearchParams(location.search), t = today();
    var fri = addDays(t, ((5 - t.getDay() + 7) % 7) || 7);
    state.ci = parse(qs.get('in')) || fri; if (state.ci < t) state.ci = fri;
    state.co = parse(qs.get('out')) || addDays(state.ci, 2); if (state.co <= state.ci) state.co = addDays(state.ci, 2);
    state.adults = Math.max(0, parseInt(qs.get('adults'), 10) || 2); state.kids = parseInt(qs.get('kids'), 10) || 0; state.pens = parseInt(qs.get('pens'), 10) || 0;
    if (state.adults + state.pens < 1) state.adults = 1;
    state.area = qs.get('area') || '';

    Promise.all([K.stands(), K.prices(), K.settings().catch(function () { return null; })]).then(function (r) {
      STANDS = r[0]; P = r[1]; S = r[2]; buildExtras();
      syncSearch(); setView(location.hash === '#map' ? 'map' : 'grid'); render();
      if (location.hash === '#map') setTimeout(function () { $('#results').scrollIntoView({ behavior: 'smooth' }); }, 300);
      var m = location.hash.match(/stand=([\w-]+)/); if (m) openSheet(m[1]);
      var q2b = S && S.get('Live availability (Q2B)'); if (q2b) $$('[data-q2b]').forEach(function (a) { a.href = q2b; });
    }).catch(function (e) {
      console.error(e);
      grid.innerHTML = '<div class="empty"><h3>Stands couldn\'t load</h3><p class="muted">The site reads its stand list from <code>content/stands.md</code>. Open it through a web server (double-click <b>Preview website.bat</b>) rather than directly from the folder.</p></div>';
    });

    // search controls
    $('#sb-in').addEventListener('change', function () { var d = parse(this.value); if (!d) return; state.ci = d; if (state.co <= d) state.co = addDays(d, 1); syncSearch(); render(); });
    $('#sb-out').addEventListener('change', function () { var d = parse(this.value); if (!d || d <= state.ci) { syncSearch(); return; } state.co = d; syncSearch(); render(); });
    var gp = $('.guest-pop'), gb = $('#sb-guests');
    gb.addEventListener('click', function (e) { e.stopPropagation(); gp.hidden = !gp.hidden; gb.setAttribute('aria-expanded', !gp.hidden); });
    gp.addEventListener('click', function (e) { e.stopPropagation(); });
    document.addEventListener('click', function () { if (!gp.hidden) { gp.hidden = true; gb.setAttribute('aria-expanded', 'false'); } });
    $$('[data-gstep]', gp).forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.gstep, d = +b.dataset.d; state[k] = Math.max(0, Math.min(20, state[k] + d));
        if (state.adults + state.pens < 1) state[k] = 1;
        syncSearch(); render();
      });
    });
    $$('.sb-pills .pill, .area-pick').forEach(function (b) { b.addEventListener('click', function () { state.area = (state.area === b.dataset.area && b.classList.contains('area-pick')) ? '' : b.dataset.area; render(); if (b.classList.contains('area-pick')) $('#results').scrollIntoView({ behavior: 'smooth' }); }); });
    $$('.sb-view button').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
    $('[data-fix-weekend]').addEventListener('click', fixWeekend);
    window.addEventListener('hashchange', function () { if (location.hash === '#map') { setView('map'); $('#results').scrollIntoView({ behavior: 'smooth' }); } });

    // sheet
    $('.sheet-close').addEventListener('click', closeSheet); backdrop.addEventListener('click', closeSheet);
    $('[data-reserve]').addEventListener('click', openCheckout);
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (modal.classList.contains('open')) closeCheckout(); else if (sheet.classList.contains('open')) closeSheet(); });

    // checkout
    $('.mc-close', modal).addEventListener('click', function () { if (step === 4) { closeCheckout(); closeSheet(); render(); } else closeCheckout(); });
    $$('[data-next]', modal).forEach(function (b) { b.addEventListener('click', function () { var cur = $('.mc-step.on', modal); if (validate(cur)) { goStep(step + 1); if (step === 3) renderSide(); } }); });
    $$('[data-back]', modal).forEach(function (b) { b.addEventListener('click', function () { goStep(step - 1); }); });
    $$('[name=pay]', modal).forEach(function (r) { r.addEventListener('change', payChanged); });
    $('[name=vehicles]', modal).addEventListener('change', renderSide);
    $('[data-pay]', modal).addEventListener('click', function () {
      var cur = $('.mc-step.on', modal); if (!validate(cur)) return;
      var btn = this; btn.disabled = true; var old = btn.innerHTML; btn.innerHTML = '<span class="spin"></span> Processing…';
      setTimeout(function () { btn.disabled = false; btn.innerHTML = old; confirmBooking(); }, 1600);
    });
    // card input helpers
    var cn = $('[name=cardnum]', modal), ex = $('[name=exp]', modal), brand = $('.card-brand', modal);
    cn.addEventListener('input', function () { var v = cn.value.replace(/\D/g, '').slice(0, 19); cn.value = v.replace(/(.{4})/g, '$1 ').trim(); brand.textContent = /^4/.test(v) ? 'VISA' : /^(5[1-5]|2[2-7])/.test(v) ? 'Mastercard' : /^3[47]/.test(v) ? 'AMEX' : ''; });
    ex.addEventListener('input', function () { var v = ex.value.replace(/\D/g, '').slice(0, 4); ex.value = v.length > 2 ? v.slice(0, 2) + ' / ' + v.slice(2) : v; });
    $('[data-demo-card]', modal).addEventListener('click', function () { cn.value = '4242 4242 4242 4242'; ex.value = '12 / ' + String(new Date().getFullYear() + 2).slice(2); $('[name=cvc]', modal).value = '123'; $('[name=cardname]', modal).value = ($('[name=first]', modal).value + ' ' + $('[name=last]', modal).value).trim() || 'Demo Camper'; brand.textContent = 'VISA'; });
  });
})();
