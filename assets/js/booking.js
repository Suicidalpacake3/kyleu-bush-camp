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
  var extras = {}, shopQty = {}, SHOP = [], carsEd = null;

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
  // Demo: when the admin demo has been opened in this browser, its bookings and blocked dates are the calendar,
  // so the website never offers a stand that the admin shows as taken. Website bookings made here count too.
  // Live: both read the same booking database.
  var TAKEN = null;
  function takenList() {
    if (TAKEN) return TAKEN;
    TAKEN = []; var db = null;
    try { db = JSON.parse(localStorage.getItem('kyleu-admin-demo-v1') || 'null'); } catch (e) {}
    // an unpaid quotation holds the stand for 5 days (one more day if the guest said they paid); after that the stand is free again
    var claimed = {}; try { (K.paidClaims ? K.paidClaims() : []).forEach(function (c) { claimed[c.ref] = 1; }); JSON.parse(localStorage.getItem('kyleu-web-pop') || '[]').forEach(function (x) { if (x.ref) claimed[x.ref] = 1; }); } catch (e) {}
    var t0 = iso(today()), dueOf = function (created, ci) { var c = parse(String(created || t0).slice(0, 10)), d = addDays(c, depDays()), bd = addDays(parse(ci), -P.num('Booking rules', 'Balance due days before arrival', 7)), soon = addDays(c, 1); if (soon > parse(ci)) soon = parse(ci); return iso(bd < d ? (bd < soon ? soon : bd) : d); };
    var released = function (due, paidAmt, claim) { return K.quoteHold && P && K.quoteHold({ due: due, paid: paidAmt, claimed: claim, today: t0 }).state === 'released'; };
    if (db && db.bookings) {
      db.bookings.forEach(function (b) {
        if (b.status === 'cancelled') return;
        if (b.status === 'pending' && released(dueOf(b.created, b.ci), (b.payments || []).reduce(function (a, p) { return a + (p.amt || 0); }, 0), !!(b.paidClaim || b.pop || claimed[b.ref]))) return;
        TAKEN.push({ stand: b.stand, from: b.ci, to: b.co });
      });
      (db.blocks || []).forEach(function (k) { TAKEN.push({ stand: k.stand, from: k.from, to: k.to }); });
      TAKEN.admin = true;
    }
    try { JSON.parse(localStorage.getItem('kyleu-web-bookings') || '[]').forEach(function (b) {
      if (!b.stand || !b.ci || !b.co || b.cancelled) return;
      if (!b.paid && released((b.invoice && b.invoice.depositDue) || dueOf(b.created, b.ci), 0, !!claimed[b.ref])) return;
      TAKEN.push({ stand: b.standId || b.stand, from: b.ci, to: b.co });
    }); } catch (e) {}
    return TAKEN;
  }
  function bookedOn(stand, d) {
    var t = takenList(), k = iso(d);
    if (t.some(function (x) { return (x.stand === stand.id || x.stand === stand.name) && x.from <= k && k < x.to; })) return true;
    return t.admin ? false : fakeBooked(stand, d);
  }
  function isFree(stand, ci, co) { return nightsOf(ci, co).every(function (d) { return !bookedOn(stand, d); }); }

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
    if (wkN) lines.push({ t: wkN + ' weekend night' + (wkN > 1 ? 's' : '') + ' × ' + people + ' × ' + K.money(K.toCard(R.weekend, P)), v: wkN * people * R.weekend, c: wkN * people * K.toCard(R.weekend, P) });
    if (wdN) {
      var wdTotal = wdN * g.adults * R.weekday + g.pens * (pensWd * R.pens + (wdN - pensWd) * R.weekday);
      lines.push({ t: wdN + ' weekday night' + (wdN > 1 ? 's' : '') + ' × ' + people + (g.pens && pensWd ? ' (pensioner rate Mon-Thu)' : ' × ' + K.money(K.toCard(R.weekday, P))), v: wdTotal, c: wdN * g.adults * K.toCard(R.weekday, P) + g.pens * (pensWd * K.toCard(R.pens, P) + (wdN - pensWd) * K.toCard(R.weekday, P)) });
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
    // camp shop items ordered with the booking
    if (ex.__shop) SHOP.forEach(function (it) { var q = ex.__shop[it.label] || 0; if (q) exLines.push({ t: q + ' × ' + it.label, v: q * it.each, shop: true }); });
    var exTotal = exLines.reduce(function (a, l) { return a + l.v; }, 0);
    // card price = normal (EFT) price + the card company's fee; EFT takes it off again
    lines.concat(exLines).forEach(function (l) { if (l.c === undefined) l.c = K.toCard(l.v, P); });
    var cardStay = lines.reduce(function (a, l) { return a + l.c; }, 0), cardTotal = cardStay + exLines.reduce(function (a, l) { return a + l.c; }, 0);
    var total = stay + exTotal;
    var depPct = P.num('Booking rules', 'Deposit percentage', 50);
    var daysToArrive = Math.round((ci - today()) / DAY);
    var balDays = P.num('Booking rules', 'Balance due days before arrival', 7);
    return { nights: nights.length, wkN: wkN, wdN: wdN, lines: lines, stay: stay, exLines: exLines, exTotal: exTotal, total: total, deposit: Math.round(total * depPct / 100), depPct: depPct, cardStay: cardStay, cardTotal: cardTotal, cardDeposit: Math.round(cardTotal * depPct / 100), fee: K.cardFee(P), payFull: daysToArrive <= balDays + depDays(), balanceDue: addDays(ci, -balDays), fullDue: daysToArrive <= balDays ? (daysToArrive >= 1 ? addDays(today(), 1) : today()) : addDays(ci, -balDays), R: R };
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
      { id: 'pp', only: 'self-sufficient', img: 'assets/img/photos/ablution-bathroom.jpg', name: 'Porta potty hire', sub: K.money(pp) + ' per night incl. cleaning', unit: 'toggle', max: 1, price: function (q, n) { return q * n * pp; }, label: function (q, n) { return 'Porta potty · ' + n + ' night' + (n > 1 ? 's' : ''); } }
    ];
    var OLD_EXTRAS = [
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
  function facilityText(st) { return st.area === 'self-sufficient' ? 'Fire boma & grill' : 'Private ablution'; }
  function onlinePay() { return !!(S && /^(on|yes|true)/i.test(S.get('Online payments', 'off'))); }
  function noFee(q) { return !q.fee; }

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
      '<div class="sc-foot"><div class="sc-price">' + K.dualPair(q.cardStay, q.stay) + '<small>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + ' · ' + (state.adults + state.pens) + ' adult' + (state.adults + state.pens > 1 ? 's' : '') + (state.kids ? ' + ' + state.kids + ' kid' + (state.kids > 1 ? 's' : '') : '') + '</small></div>' +
      '<button class="btn btn-sm' + (free ? '' : ' btn-ghost') + '" type="button" data-open="' + st.id + '">' + (free ? 'View &amp; book' : 'Other dates') + '</button></div></div></article>';
  }

  function filtered() { return STANDS.filter(function (s) { return !state.area || s.area === state.area; }); }
  function render() {
    var list = filtered();
    wizSummary();
    if (!state.ci || !state.co) {
      // no dates yet: ask for them first, then show only the stands that are free
      resultsTitle.textContent = 'Choose your dates';
      resultsSub.textContent = 'Pick your arrival and departure dates above. We\'ll then show the stands that are free.';
      grid.innerHTML = '<div class="empty date-first"><svg><use href="#i-cal"/></svg><h3>When would you like to camp?</h3><p class="muted">Choose your arrival and departure dates in the bar above to see which stands are free and what your stay costs.</p><button class="btn" type="button" data-pick-dates>Choose dates <svg><use href="#i-arrow"/></svg></button></div>';
      var pd = $('[data-pick-dates]', grid); if (pd) pd.onclick = function () { wGo(1, true); };
      ruleNote.classList.add('hidden');
      renderMap();
      return;
    }
    var freeList = list.filter(function (s) { return isFree(s, state.ci, state.co); });
    var n = nightsOf(state.ci, state.co).length;
    resultsTitle.textContent = freeList.length ? freeList.length + ' stand' + (freeList.length > 1 ? 's' : '') + ' free for your dates' : 'No stands free for these dates';
    resultsSub.textContent = nice(state.ci) + ' → ' + nice(state.co) + ' · ' + n + ' night' + (n > 1 ? 's' : '') + ' · ' + guestsTotal() + ' guest' + (guestsTotal() > 1 ? 's' : '');
    grid.innerHTML = freeList.length ? freeList.map(cardHTML).join('') : '<div class="empty date-first"><svg><use href="#i-cal"/></svg><h3>Everything is booked for these dates</h3><p class="muted">Try other dates' + (state.area ? ' or another camp area' : '') + ', or WhatsApp us and we\'ll help you find a gap.</p><a class="btn btn-green" href="https://wa.me/27604584478" target="_blank" rel="noopener"><svg><use href="#i-wa"/></svg>WhatsApp us</a></div>';
    wireCards(); K.reveal(grid);
    renderMap();
    checkWeekendRule();
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
        if (!state.ci || !state.co) { var R = rates(st); return { free: null, price: 'from ' + K.money(R.weekday), sub: 'per person / night · pick dates to check availability' }; }
        var free = isFree(st, state.ci, state.co), q = quote(st, state.ci, state.co);
        return { free: free, price: K.dualPair(q.cardStay, q.stay), sub: q.nights + ' night' + (q.nights > 1 ? 's' : '') + ' · ' + (state.adults + state.pens) + ' adult' + (state.adults + state.pens > 1 ? 's' : '') };
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
    current = st; sel.ci = state.ci; sel.co = state.co; var cm = state.ci || today(); calMonth = new Date(cm.getFullYear(), cm.getMonth(), 1);
    var ph = photosOf(st);
    var hl = st.highlights.map(function (h) { var no = /^no /i.test(h); return '<li class="' + (no ? 'no' : '') + '"><svg><use href="#' + (no ? 'i-x' : 'i-check') + '"/></svg>' + K.esc(h) + '</li>'; }).join('');
    var base = st.area === 'self-sufficient'
      ? ['Small fire boma with a grill', 'Pool area access in the fenced camp', 'No ablution, water or electricity', 'Unfenced: wild animals roam freely']
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
      '<div class="sheet-section"><h3>Pick your dates</h3><div class="cal dp-inline"></div><div class="cal-note"><span><i class="k-free"></i>Available</span><span><i class="k-bk"></i>Booked</span><span><i class="k-we"></i>Weekend rate</span></div></div>' +
      '<div class="sheet-section"><h3>Price</h3><div class="breakdown" data-bd></div><p class="muted" style="font-size:.8rem;margin:8px 0 0">Dinokeng conservation &amp; self-drive fees are paid separately to the reserve. <a href="dinokeng.html#fees">See the Dinokeng page</a></p></div>' +
      '</div>';
    $$('.sg-thumbs button', sheet).forEach(function (b) { b.onclick = function () { $('.sg-main img', sheet).src = ph[+b.dataset.i]; $$('.sg-thumbs button', sheet).forEach(function (x) { x.classList.toggle('on', x === b); }); }; });
    $('.sg-main', sheet).onclick = function () { var i = $$('.sg-thumbs button', sheet).findIndex(function (b) { return b.classList.contains('on'); }); K.lightbox(ph.map(function (p) { return { src: p, cap: st.name }; }), Math.max(0, i)); };
    $$('[data-close-sheet]', sheet).forEach(function (a) { a.onclick = function (e) { e.preventDefault(); closeSheet(); setView('map'); $('#results').scrollIntoView({ behavior: 'smooth' }); }; });
    calHover = null; calBusy = false; renderCal(); calWire(); updateSheetPrice();
    sheet.classList.add('open'); backdrop.classList.add('open'); document.body.classList.add('lock'); sheet.setAttribute('aria-hidden', 'false');
    $('.sheet-scroll', sheet).scrollTop = 0;
    history.replaceState(null, '', location.pathname + location.search + '#stand=' + st.id);
    setTimeout(function () { $('.sheet-close', sheet).focus(); }, 50);
  }
  function closeSheet() { sheet.classList.remove('open'); backdrop.classList.remove('open'); if (!$('.modal.open')) document.body.classList.remove('lock'); sheet.setAttribute('aria-hidden', 'true'); history.replaceState(null, '', location.pathname + location.search); }

  // the stand's own calendar: the same look and taps as the booking calendar (assets/js/datepicker.js),
  // plus this stand's booked nights and weekend-rate nights
  var calHover = null, calBusy = false;
  function renderCal() {
    var box = $('.cal', sheet); var m = calMonth, first = new Date(m.getFullYear(), m.getMonth(), 1), lead = (first.getDay() + 6) % 7, dim = new Date(m.getFullYear(), m.getMonth() + 1, 0).getDate(), t0 = today();
    var end = sel.co || (sel.ci && calHover && calHover > sel.ci ? calHover : null), preview = !sel.co && !!end, bad = preview && !isFree(current, sel.ci, end), idx = 0;
    var hint = !sel.ci ? 'Tap the day you arrive.' : !sel.co ? 'Now tap the day you go home. Tap ' + nice(sel.ci, { day: 'numeric', month: 'short' }) + ' again to start over.' : (function () { var n = nightsOf(sel.ci, sel.co).length; return n + ' night' + (n > 1 ? 's' : '') + ': ' + nice(sel.ci) + ' to ' + nice(sel.co) + '.'; })();
    var h = '<p class="dp-hint" aria-live="polite">' + hint + '</p>' +
      '<div class="dp-nav"><button type="button" class="dp-prev" data-m="-1" aria-label="Previous month"' + (m.getFullYear() === t0.getFullYear() && m.getMonth() === t0.getMonth() ? ' disabled' : '') + '><svg><use href="#i-arrow-l"/></svg></button><b class="dp-month">' + first.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) + '</b><button type="button" class="dp-next" data-m="1" aria-label="Next month"><svg><use href="#i-arrow"/></svg></button></div>' +
      '<div class="dp-wk" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div><div class="dp-grid' + (preview ? ' previewing' : '') + (bad ? ' dp-bad' : '') + '">';
    for (var i = 0; i < lead; i++) h += '<span class="dp-c dp-blank"></span>';
    for (var d = 1; d <= dim; d++) {
      var dt = new Date(m.getFullYear(), m.getMonth(), d), past = dt < t0, bk = !past && bookedOn(current, dt), cls = ['dp-c'];
      var isStart = sel.ci && +dt === +sel.ci, isEnd = end && +dt === +end, inR = sel.ci && end && dt > sel.ci && dt < end;
      if (past) cls.push('past'); if (bk) cls.push('bk'); if (!past && isWeekendNight(dt)) cls.push('we');
      if (isStart) cls.push('start'); if (isStart && end) cls.push('has-band');
      if (isEnd) cls.push(preview ? 'hend' : 'end');
      if (inR) { cls.push(preview ? 'hin' : 'in'); idx++; }
      var n = isEnd ? nightsOf(sel.ci, end).length : 0;
      h += '<span class="' + cls.join(' ') + '"' + (inR ? ' style="--i:' + idx + '"' : '') + '><button type="button" class="dp-d" data-d="' + iso(dt) + '"' + (past ? ' disabled' : '') +
        ' aria-label="' + nice(dt, { weekday: 'long', day: 'numeric', month: 'long' }) + (bk ? ', booked' : '') + (isStart ? ', arrival' : '') + (isEnd && !preview ? ', departure' : '') + '"' + (isStart || (isEnd && !preview) ? ' aria-pressed="true"' : '') + '>' + d + '</button>' +
        (n ? '<small class="dp-nn">' + (bad ? 'Booked in between' : n + ' night' + (n > 1 ? 's' : '')) + '</small>' : '') + '</span>';
    }
    box.innerHTML = h + '</div><div class="dp-foot"><button type="button" class="dp-clear" data-cal-clear' + (sel.ci ? '' : ' disabled') + '>Clear dates</button></div>';
    $$('[data-m]', box).forEach(function (b) { b.onclick = function () { calMonth = new Date(calMonth.getFullYear(), calMonth.getMonth() + (+b.dataset.m), 1); renderCal(); }; });
    $('[data-cal-clear]', box).onclick = function () { sel.ci = null; sel.co = null; calHover = null; renderCal(); updateSheetPrice(); };
  }
  function calPick(dt) {
    if (calBusy) return;
    var startHere = function () { if (bookedOn(current, dt)) { K.toast('That night is already booked'); return false; } return true; };
    if (sel.ci && +dt === +sel.ci) { sel.ci = null; sel.co = null; }                       // tap the arrival again: start over
    else if (!sel.ci || dt < sel.ci) { if (!startHere()) return; var keep = sel.co && isFree(current, dt, sel.co); sel.ci = dt; if (!keep) sel.co = null; }   // an earlier day moves the arrival
    else {
      if (!isFree(current, sel.ci, dt)) { K.toast('Some nights in between are booked. Try other dates'); return; }
      sel.co = dt; calHover = null; renderCal(); updateSheetPrice();
      var box = $('.cal', sheet); calBusy = true; box.classList.add('dp-lock');                // lock in: the band sweeps, the circles pop
      var n = nightsOf(sel.ci, sel.co).length, hn = $('.dp-hint', box); if (hn) hn.textContent = 'Locked in: ' + n + ' night' + (n > 1 ? 's' : '') + ', ' + nice(sel.ci) + ' to ' + nice(sel.co) + '.';
      setTimeout(function () { box.classList.remove('dp-lock'); calBusy = false; var bb = $('.book-box', sheet); if (bb) { bb.classList.remove('pop'); void bb.offsetWidth; bb.classList.add('pop'); } }, 950);
      return;
    }
    calHover = null; renderCal(); updateSheetPrice();
    var f = $('.cal [data-d="' + iso(dt) + '"]', sheet); if (f && !f.disabled) f.focus();
  }
  function calWire() {
    var box = $('.cal', sheet); if (!box || box._wired) return; box._wired = true;
    box.addEventListener('click', function (e) { var b = e.target.closest('.dp-d'); if (b && !b.disabled) calPick(parse(b.dataset.d)); });
    box.addEventListener('mouseover', function (e) {
      if (!sel.ci || sel.co || calBusy) return;
      var c = e.target.closest('.dp-c'); if (!c || c.classList.contains('dp-blank')) return;
      var b = c.querySelector('.dp-d'), d = b && !b.disabled ? parse(b.dataset.d) : null;
      if ((d && +d) !== (calHover && +calHover)) { calHover = d; renderCal(); }
    });
    box.addEventListener('mouseleave', function () { if (calHover) { calHover = null; renderCal(); } });
    box.addEventListener('mouseout', function (e) { if (calHover && !box.contains(e.relatedTarget)) { calHover = null; renderCal(); } });
  }

  function updateSheetPrice() {
    var bd = $('[data-bd]', sheet), bb = $('.book-box', sheet);
    if (!sel.co) {
      bd.innerHTML = '<div class="row sub"><span>' + (sel.ci ? 'Now pick your departure date' : 'Pick your arrival date on the calendar above') + '</span></div>';
      $('.tot', bb).innerHTML = '<b>-</b><small>Pick your departure date</small>';
      $('[data-reserve]', bb).disabled = true; return;
    }
    var free = isFree(current, sel.ci, sel.co), q = quote(current, sel.ci, sel.co);
    bd.innerHTML = '<div class="row sub"><span>' + nice(sel.ci) + ' → ' + nice(sel.co) + '</span><span>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + '</span></div>' +
      q.lines.map(function (l) { return '<div class="row"><span>' + l.t + '</span><span>' + (l.free ? 'Free' : K.money(l.c)) + '</span></div>'; }).join('') +
      (noFee(q) ? '<div class="row total"><span>Total</span><span>' + K.money(q.stay) + '</span></div>' :
      '<div class="row"><span><b>Total</b> (card price, incl. ' + q.fee + '% card fee)</span><span><b>' + K.money(q.cardStay) + '</b></span></div>' +
      '<div class="row eft-row"><span>EFT discount</span><span>-' + K.money(q.cardStay - q.stay) + '</span></div>' +
      '<div class="row total"><span>Total with EFT</span><span>' + K.money(q.stay) + '</span></div>');
    $('.tot', bb).innerHTML = '<b>' + K.dualPair(q.cardStay, q.stay) + '</b><small>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + (noFee(q) ? '' : ' · ' + K.money(q.cardStay) + ' by card') + ' · ' + (q.payFull ? 'full payment due now' : 'deposit secures it') + '</small>';
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
    extras = {}; shopQty = {}; extras.__shop = shopQty;
    step = 1; renderSide(); renderExtras(); goStep(1);
    modal.classList.add('open'); document.body.classList.add('lock');
    var payFull = quote(booking.stand, booking.ci, booking.co).payFull, online = onlinePay();
    $$('.pay-opt', modal).forEach(function (o) { o.hidden = online ? (o.dataset.pay === 'deposit' && payFull) : o.dataset.pay !== 'invoice'; });
    $('[name=pay][value=' + (!online ? 'invoice' : payFull ? 'full' : 'deposit') + ']', modal).checked = true;
    var s3 = $('.mc-step[data-step="3"]', modal);
    $('h2', s3).textContent = online ? 'Secure your stand' : 'How to pay';
    $('h2 + p', s3).textContent = online ? 'Choose how you\'d like to pay.' : 'We\'ll email you a quotation with our bank details. Pay by EFT to secure your stand.';
    var df = $('.demo-flag span', s3); if (df) df.textContent = online ? 'Demo mode: this is a mock-up. No card is charged and nothing is sent. Use the "fill test card" link to try it.' : 'Demo mode: this is a mock-up. No booking is made and nothing is sent anywhere.';

    payChanged();
  }
  function closeCheckout() { bwMark(wstep); modal.classList.remove('open'); if (!sheet.classList.contains('open')) document.body.classList.remove('lock'); }
  function goStep(n) {
    step = n; bwMark(Math.min(7, n + PICK)); if (K.toastHide) K.toastHide();
    var mini = $('[data-mini]', modal); if (mini) mini.hidden = n === 4 || n === 2;
    $$('.mc-step', modal).forEach(function (s) { s.classList.toggle('on', +s.dataset.step === n); });
    $$('.steps li', modal).forEach(function (li, i) { li.classList.toggle('on', i + 1 === n); li.classList.toggle('done', i + 1 < n); });
    $('.mc-main', modal).scrollTop = 0;
    if (n === 4) $('.mc-side', modal).style.display = 'none'; else $('.mc-side', modal).style.display = '';
  }
  function renderSide() {
    var b = booking, q = quote(b.stand, b.ci, b.co, b.g, extras), side = $('.mc-side', modal);
    var pay = ($('[name=pay]:checked', modal) || {}).value || 'deposit', card = pay === 'deposit' || pay === 'full';
    var tot = card ? q.cardTotal : q.total, dep = card ? q.cardDeposit : q.deposit;
    side.innerHTML = '<div class="ms-img"><img src="' + cover(b.stand) + '" alt=""></div><div class="ms-body">' +
      '<div><span class="badge area-' + b.stand.area + '">' + b.stand.areaInfo.short + '</span><h3 style="margin-top:8px">' + K.esc(b.stand.name) + '</h3></div>' +
      '<div class="ms-dates"><div><small>Arrive</small><b>' + nice(b.ci) + '</b></div><div><small>Depart</small><b>' + nice(b.co) + '</b></div></div>' +
      '<div class="muted" style="font-size:.88rem;font-weight:700">' + (b.g.adults + b.g.pens) + ' adult' + (b.g.adults + b.g.pens > 1 ? 's' : '') + (b.g.pens ? ' (' + b.g.pens + ' pensioner' + (b.g.pens > 1 ? 's' : '') + ')' : '') + (b.g.kids ? ' · ' + b.g.kids + ' child' + (b.g.kids > 1 ? 'ren' : '') : '') + '</div>' +
      '<div class="breakdown">' + q.lines.map(function (l) { return '<div class="row"><span>' + l.t + '</span><span>' + (l.free ? 'Free' : K.money(l.c)) + '</span></div>'; }).join('') +
      q.exLines.map(function (l) { return '<div class="row"><span>' + K.esc(l.t) + '</span><span>' + K.money(l.c) + '</span></div>'; }).join('') +
      (noFee(q) ? '<div class="row total"><span>Total</span><span>' + K.money(q.total) + '</span></div>' : card
        ? '<div class="row total"><span>Total (card)</span><span>' + K.money(q.cardTotal) + '</span></div><div class="row sub"><span>Includes the ' + q.fee + '% card fee. Choose EFT to save ' + K.money(q.cardTotal - q.total) + '.</span></div>'
        : '<div class="row"><span>Card price</span><span><s class="dual-card">' + K.money(q.cardTotal) + '</s></span></div><div class="row eft-row"><span>EFT discount</span><span>-' + K.money(q.cardTotal - q.total) + '</span></div><div class="row total"><span>Total with EFT</span><span>' + K.money(q.total) + '</span></div>') +
      (q.payFull ? '<div class="row sub"><span>You arrive soon, so the full amount is due ' + (q.fullDue <= today() ? 'now' : 'by ' + nice(q.fullDue, { day: 'numeric', month: 'short' })) + '</span></div>' : '<div class="row sub"><span>' + q.depPct + '% deposit to secure</span><span>' + K.money(dep) + '</span></div><div class="row sub"><span>Balance due by ' + nice(q.balanceDue, { day: 'numeric', month: 'short' }) + '</span><span>' + K.money(tot - dep) + '</span></div>') +
      '</div><p class="muted" style="font-size:.8rem;margin:0">Dinokeng Game Reserve charges its own entry fees, paid to the reserve. <a href="dinokeng.html#fees" target="_blank">Dinokeng fees</a></p></div>';
    // the same summary for phones (where the side panel is hidden) and on the "Check your booking" step
    var gTxt = (b.g.adults + b.g.pens) + ' adult' + (b.g.adults + b.g.pens > 1 ? 's' : '') + (b.g.pens ? ' (' + b.g.pens + ' pensioner' + (b.g.pens > 1 ? 's' : '') + ')' : '') + (b.g.kids ? ' and ' + b.g.kids + ' child' + (b.g.kids > 1 ? 'ren' : '') : '');
    var dueTxt = q.payFull ? 'You arrive soon, so please pay the full ' + K.money(tot) + (q.fullDue <= today() ? ' as soon as you can' : ' by ' + nice(q.fullDue, { day: 'numeric', month: 'long' })) + '.'
      : 'Pay the ' + q.depPct + '% deposit of ' + K.money(dep) + ' within ' + depDays() + ' days to secure your stand. The balance of ' + K.money(tot - dep) + ' is due by ' + nice(q.balanceDue, { day: 'numeric', month: 'long' }) + '.';
    var mini = $('[data-mini]', modal);
    if (mini) mini.innerHTML = '<b>' + K.esc(b.stand.name) + '</b><span>' + nice(b.ci) + ' to ' + nice(b.co) + ' · ' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + '</span><span>' + gTxt + ' · <b>Total ' + K.money(tot) + '</b></span>';
    var cs = $('[data-check-sum]', modal);
    if (cs) cs.innerHTML = '<dl><div><dt>Stand</dt><dd>' + K.esc(b.stand.name) + ' <small>' + b.stand.areaInfo.short + '</small></dd></div><div><dt>Arrive</dt><dd>' + nice(b.ci, { weekday: 'long', day: 'numeric', month: 'long' }) + '</dd></div><div><dt>Depart</dt><dd>' + nice(b.co, { weekday: 'long', day: 'numeric', month: 'long' }) + ' <small>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + '</small></dd></div><div><dt>Guests</dt><dd>' + gTxt + '</dd></div>' + (q.exLines.length ? '<div><dt>Extras</dt><dd>' + q.exLines.map(function (l) { return '<small>' + K.esc(l.t) + ' · ' + K.money(card ? l.c : l.v) + '</small>'; }).join('') + '</dd></div>' : '') + '<div class="tot"><dt>Total</dt><dd>' + K.money(tot) + '</dd></div></dl><p>' + dueTxt + '</p><button type="button" class="link-btn" data-edit-stay>Change something</button>';
    var eb = cs && $('[data-edit-stay]', cs); if (eb) eb.onclick = function () { closeCheckout(); };
    var invSmall = $('.pay-opt[data-pay="invoice"] small', modal); if (invSmall && !onlinePay()) invSmall.textContent = dueTxt;
    // pay option amounts
    var eftNow = q.payFull ? q.total : q.deposit, cardEq = q.payFull ? q.cardTotal : q.cardDeposit;
    var amt = { deposit: q.cardDeposit, full: q.cardTotal, eft: eftNow, invoice: eftNow };
    $$('.pay-opt', modal).forEach(function (o) {
      var k = o.dataset.pay; $('.amt', o).innerHTML = (k === 'eft' || k === 'invoice') ? K.dualPair(cardEq, eftNow) : K.money(amt[k]);
    });
    $('[data-pay-amount]', modal).textContent = K.money(amt[pay]);
    return q;
  }
  function renderExtras() {
    var box = $('[data-extras]', modal); if (!box) return;   // camp shop and porta potty, on the "Check your booking" step, so it is all on one invoice
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
    K.shopPicker($('[data-shop]', modal), SHOP, shopQty, renderSide);
  }
  function validate(stepEl) {
    var ok = true;
    $$('[required]', stepEl).forEach(function (inp) {
      var v = inp.type === 'checkbox' ? inp.checked : inp.value.trim(), bad = !v;
      if (!bad && inp.type === 'email') bad = !/^\S+@\S+\.\S+$/.test(inp.value);
      if (!bad && inp.name === 'phone') bad = inp.value.replace(/\D/g, '').length < 9;
      if (inp.name === 'phone') { var pm = $('.msg', inp.closest('.field')); if (pm && pm.dataset.msgBad) pm.textContent = inp.value.trim() ? pm.dataset.msgBad : pm.dataset.msgEmpty; }
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
    var s3t = $('.mc-step[data-step="3"] .eft-box', modal); if (s3t && !onlinePay()) s3t.hidden = false;
    renderSide();
  }
  function confirmBooking() {
    var f = function (n) { var el = $('[name=' + n + ']', modal); return el ? el.value.trim() : ''; };
    var q = renderSide(), pay = $('[name=pay]:checked', modal).value, cv = { count: 0, cars: [] };
    // the guest's private link to their booking (in the demo a random key; live, the server makes it)
    var bkey = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6);
    var ref = K.takeNo ? K.takeNo('Ref') : 'KY' + String(booking.ci.getFullYear()).slice(2) + '-' + Math.random().toString(36).slice(2, 7).toUpperCase();
    booking.ref = ref;
    var blink = 'manage.html?b=' + encodeURIComponent(ref) + '&k=' + bkey;
    var isCard = pay === 'full' || pay === 'deposit';
    var paid = pay === 'full' ? q.cardTotal : pay === 'deposit' ? q.cardDeposit : pay === 'eft' ? (q.payFull ? q.total : q.deposit) : 0;
    var inv = makeInvoice(ref, q, isCard, paid, cv);
    // Demo only: keep a copy in THIS browser so it shows up in the admin mock-up (/admin). Never any card details.
    try {
      var saved = JSON.parse(localStorage.getItem('kyleu-web-bookings') || '[]'), now = new Date();
      saved.push({ ref: ref, created: iso(now) + ' ' + String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'), stand: booking.stand.id, ci: iso(booking.ci), co: iso(booking.co),
        adults: booking.g.adults, pens: booking.g.pens, kids: booking.g.kids, extras: {}, first: f('first'), last: f('last'), email: f('email'), phone: f('phone'), eta: '', notes: f('notes'), key: bkey,
        vehicles: cv.count, vehTbc: !cv.count, cars: cv.cars,
        shop: SHOP.filter(function (it) { return shopQty[it.label]; }).map(function (it) { return { label: it.label, qty: shopQty[it.label], each: it.each }; })
          .concat(extras.pp && booking.stand.area === 'self-sufficient' ? [(function () { var n = nightsOf(booking.ci, booking.co).length; return { label: 'Porta potty hire, cleaning included (' + n + ' night' + (n === 1 ? '' : 's') + ')', qty: 1, each: n * P.num('Self-sufficient', 'Porta potty hire per night', 100) }; })()] : []),
        pay: pay, paid: paid, eft: q.total, card: q.cardTotal, invoice: inv });
      localStorage.setItem('kyleu-web-bookings', JSON.stringify(saved.slice(-50))); TAKEN = null;
    } catch (e) {}
    var box = $('[data-success]', modal);
    box.innerHTML = '<div class="success"><div class="success-badge"><svg class="ring" viewBox="0 0 110 110" fill="none" stroke="#3f7d3a" stroke-width="6" stroke-linecap="round"><circle cx="55" cy="55" r="50"/><path d="M34 57l14 14 28-30"/></svg></div>' +
      '<span class="hand">See you in the bush, ' + K.esc(f('first') || 'friend') + '!</span>' +
      '<h2 style="margin-top:6px">' + (paid ? 'Your reservation is confirmed' : 'Your reservation request is in') + '</h2>' +
      '<p class="muted">' + K.esc(booking.stand.name) + ' · ' + nice(booking.ci, { weekday: 'long', day: 'numeric', month: 'long' }) + ' to ' + nice(booking.co, { weekday: 'long', day: 'numeric', month: 'long' }) + '</p>' +
      '<div class="ref">' + ref + '</div>' +
      (paid ? '<p class="muted" style="font-size:.9rem">' + K.money(paid) + ' received' + (isCard ? '' : ' by instant EFT') + '.</p>' : '') +
      // the invoice is emailed straight away, then shown here too
      '<div class="inv-sent" data-inv-sent role="status"><span class="spin"></span>Emailing your ' + (paid ? 'invoice' : 'quotation') + ' to ' + K.esc(f('email')) + '…</div>' +
      // what to do now comes first: how much, by when, where to pay, then "I have paid"
      (paid < inv.total ? (function () {
        var st = K.invoiceState(inv);
        return '<div class="pay-now"><h3>Pay ' + K.money(st.now) + ' by EFT</h3><p>' + (q.payFull ? 'The full amount, ' + (q.fullDue <= today() ? 'as soon as you can' : 'by ' + nice(q.fullDue, { weekday: 'long', day: 'numeric', month: 'long' })) + ', because you arrive soon.' : 'This is the ' + q.depPct + '% deposit. Your quotation is valid for 5 days, until ' + nice(parse(inv.depositDue), { weekday: 'long', day: 'numeric', month: 'long' }) + ', and your stand is held until then. The balance of ' + K.money(inv.total - inv.deposit) + ' is due by ' + nice(q.balanceDue, { day: 'numeric', month: 'long' }) + '.') + '</p>' +
          '<dl>' + K.bankRows().map(function (r) { return '<div><dt>' + r[0] + '</dt><dd>' + K.esc(r[1]) + '</dd></div>'; }).join('') + '<div class="ref-row"><dt>Payment reference</dt><dd>' + ref + '</dd></div></dl>' +
          '<button class="btn btn-green" type="button" data-inv-paid><svg><use href="#i-check"/></svg>I have paid</button><div class="paid-box" data-paid-box></div></div>';
      })() : '') +
      '<div class="bk-link"><svg><use href="#i-doc"/></svg><div><b>The link to your booking</b><p>We have emailed it to you too. Use it to tell us you have paid or to amend your booking, and once it is paid in full, to finalise it.</p><a href="' + blink + '">Open my booking</a></div></div>' +
      '<h3 style="margin:26px 0 6px">What happens next</h3><ol class="next-steps">' +
      (pay === 'invoice' ? '<li><b>1</b><span>Pay the ' + (q.payFull ? 'full amount of ' + K.money(q.total) : q.depPct + '% deposit of ' + K.money(q.deposit)) + ' by EFT ' + (q.payFull ? (q.fullDue <= today() ? 'as soon as you can' : 'by ' + nice(q.fullDue, { day: 'numeric', month: 'long' })) : 'within ' + depDays() + ' days') + ', using reference <b>' + ref + '</b>. Then press <b>I have paid</b>, here or later with <a href="' + blink + '">the link to your booking</a>. We check the bank and confirm.</span></li>' : '') +
      (!q.payFull && pay !== 'full' ? '<li><b>' + (pay === 'invoice' ? 2 : 1) + '</b><span>Balance of ' + K.money(isCard ? q.cardTotal - q.cardDeposit : q.total - q.deposit) + ' is due by ' + nice(q.balanceDue, { day: 'numeric', month: 'long' }) + '. We\'ll send a reminder.</span></li>' : '') +
      '<li><b>✓</b><span>Pay your Dinokeng conservation &amp; self-drive fees online or at the gate. Kyleu is a proud DGR CP member, so before your stay we send you a <b>Conservation Fee Discount Voucher</b> code for each vehicle (R85 instead of R100 per adult per night). <a href="dinokeng.html#fees">Dinokeng fees</a></span></li>' +
      '<li><b>✓</b><span>Once your booking is <b>paid in full</b>, we email you a link to <b>finalise</b> it: your vehicles and who is in each one, and roughly when you arrive. Want more from the camp shop later? Add it with the link to your booking.</span></li>' +
      '<li><b>✓</b><span>Enter at Dinokeng <b>Tau Gate</b>, follow the main road 4.8 km, turn right onto Kaallaagte Road and continue 2 km. <a href="contact.html">Directions</a></span></li></ol>' +
      '<div class="cta-actions"><button class="btn" type="button" data-ics><svg><use href="#i-cal"/></svg>Add to calendar</button><a class="btn btn-green" target="_blank" rel="noopener" href="https://wa.me/27604584478?text=' + encodeURIComponent('Hi Kyleu! My booking reference is ' + ref + ' (' + booking.stand.name + ', ' + iso(booking.ci) + ' to ' + iso(booking.co) + ').') + '"><svg><use href="#i-wa"/></svg>WhatsApp us your reference</a></div>' +
      '<details class="inv-fold"><summary>' + (paid ? 'See your invoice' : 'See your quotation') + '</summary><div class="inv-wrap">' + K.invoiceHTML(inv) + '</div></details>' +
      '<div class="inv-acts"><button class="btn btn-ghost" type="button" data-inv-pdf><svg><use href="#i-doc"/></svg>Download ' + (paid ? 'invoice' : 'quotation') + ' (PDF)</button><button class="btn btn-ghost" type="button" data-inv-print><svg><use href="#i-doc"/></svg>Print</button></div>' +
      '<div class="demo-flag" style="margin:22px 0 0;text-align:left"><svg><use href="#i-info"/></svg><span>Demo mode: this is a mock-up. No booking was made, nothing was charged and no details were sent anywhere. A copy stays in this browser only, so you can see it in the admin demo.</span></div></div>';
    $('[data-ics]', box).onclick = downloadICS;
    setTimeout(function () { var s = $('[data-inv-sent]', box); if (s) { s.className = 'inv-sent ok'; s.innerHTML = '<svg><use href="#i-check"/></svg>' + (paid ? 'Invoice' : 'Quotation') + ' sent to ' + K.esc(f('email')) + ' by email'; } }, 1400);
    $('[data-inv-pdf]', box).onclick = function () { K.downloadInvoice(inv).catch(function () { K.toast('The PDF could not be made. Check your internet connection.'); }); };
    $('[data-inv-print]', box).onclick = function () { K.printInvoice(inv).catch(function () { K.toast('The invoice could not be printed. Try Download PDF instead.'); }); };
    var pb = $('[data-inv-paid]', box); if (pb) pb.onclick = function () { var pbx = $('[data-paid-box]', box); K.paidForm(pbx, inv, function (c) { if (c) pb.remove(); }); pbx.scrollIntoView({ behavior: 'smooth', block: 'center' }); };
    goStep(4); confetti();
  }
  function depDays() { return P.num('Booking rules', 'Deposit due within days of invoice', 5); }
  // the booking's invoice: same look on the website, in the email and in the admin
  function makeInvoice(ref, q, isCard, paid, cv) {
    var g = booking.g, a = g.adults + g.pens, t = today(), due = addDays(t, depDays()), fv = function (n) { var el = $('[name=' + n + ']', modal); return el ? el.value.trim() : ''; };
    var ppl = g.adults + g.pens + g.kids;
    var lines = q.lines.map(function (l) {
      var amt = isCard ? l.c : l.v, m = l.t.match(/^(\d+) (weekend|weekday) night/);
      if (m) {   // say which nights and the rate, so weekend and weekday lines are not mistaken for the same thing twice
        var wk = m[2] === 'weekend', ds = nightsOf(booking.ci, booking.co).filter(function (d) { return isWeekendNight(d) === wk; }), R0 = rates(booking.stand), paying = g.adults + g.pens;
        var dl = ds.map(function (d, i) { return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }) + (i === ds.length - 1 || d.getMonth() !== ds[i + 1].getMonth() ? ' ' + d.toLocaleDateString('en-ZA', { month: 'short' }) : ''); });
        var dtxt = dl.length > 1 ? dl.slice(0, -1).join(', ') + ' & ' + dl[dl.length - 1] : dl[0];
        return { t: booking.stand.name + ' · ' + m[2] + ' night' + (+m[1] > 1 ? 's' : '') + ': ' + dtxt + ' · ' + paying + ' adult' + (paying === 1 ? '' : 's') + (/pensioner/.test(l.t) ? ' (pensioner rate Mon-Thu)' : ' at ' + K.money(isCard ? K.toCard(wk ? R0.weekend : R0.weekday, P) : (wk ? R0.weekend : R0.weekday)) + ' per person'), q: +m[1], u: Math.round(amt / +m[1]), amt: amt, tag: 'stay' };
      }
      return { t: l.free ? 'Child' + (g.kids === 1 ? '' : 'ren') + ' under 12 (free)' : l.t, q: l.free ? g.kids : undefined, amt: amt, free: !!l.free, tag: 'stay' };
    }).concat(q.exLines.map(function (l) {
      var amt = isCard ? l.c : l.v, m = l.t.match(/^(\d+) × (.+)$/), pp = l.t.match(/^Porta potty · (\d+) night/);
      if (m) return { t: m[2], q: +m[1], u: Math.round(amt / +m[1]), amt: amt, tag: 'shop' };
      if (pp) return { t: 'Porta potty hire, cleaning included (per night)', q: +pp[1], u: Math.round(amt / +pp[1]), amt: amt, tag: 'extra' };
      return { t: l.t, amt: amt, tag: l.shop ? 'shop' : 'extra' };
    }));
    var isQuote = !paid;
    return { kind: isQuote ? 'Quote' : 'Invoice', no: K.takeNo ? K.takeNo(isQuote ? 'Quote' : 'Invoice') : K.invoiceNo(ref, 'Invoice', 1), date: iso(t), ref: ref, validTo: isQuote ? iso(q.payFull ? q.fullDue : due) : '',
      guest: { name: (fv('first') + ' ' + fv('last')).trim(), email: fv('email'), phone: fv('phone') },
      stay: { stand: booking.stand.name, ci: iso(booking.ci), co: iso(booking.co), nights: q.nights, guests: a + ' adult' + (a === 1 ? '' : 's') + (g.pens ? ' (' + g.pens + ' pensioner' + (g.pens === 1 ? '' : 's') + ')' : '') + (g.kids ? ', ' + g.kids + ' child' + (g.kids === 1 ? '' : 'ren') : ''), vehicles: cv.count || '' },
      lines: lines, total: isCard ? q.cardTotal : q.total, paid: paid, deposit: isCard ? q.cardDeposit : q.deposit, depPct: q.depPct, depositDue: iso(q.payFull ? q.fullDue : due), balanceDue: iso(q.balanceDue), payFull: q.payFull };
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
    $('#sb-in').value = state.ci ? iso(state.ci) : ''; $('#sb-out').value = state.co ? iso(state.co) : '';
    var dfmt = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    $$('[data-dp-text]').forEach(function (el) { var d = el.dataset.dpText === 'in' ? state.ci : state.co; el.textContent = d ? nice(d, dfmt) : 'Choose a date'; el.parentNode.classList.toggle('set', !!d); });
    $('#sb-in').min = iso(today()); $('#sb-out').min = iso(addDays(state.ci || today(), 1));
    $('[data-g=adults]').textContent = state.adults; $('[data-g=pens]').textContent = state.pens; $('[data-g=kids]').textContent = state.kids;
    wizSummary();
  }
  /* ---------- guided booking: one easy step at a time ---------- */
  var wstep = 1, reached = 1, LONG = { weekday: 'long', day: 'numeric', month: 'long' };
  var STEP_NAMES = ['', 'Dates', 'Who\'s coming', 'Your stand', 'Your details', 'Check & agree', 'Pay'];
  var PICK = 3;   // the stand step (the camp area is a filter on it)
  function nextFriday(plus) { var t = today(), d = addDays(t, (5 - t.getDay() + 7) % 7); if (t.getDay() === 6) d = addDays(t, 6); return addDays(d, plus || 0); }
  function peopleText() { var a = state.adults + state.pens, k = state.kids; return a + ' adult' + (a === 1 ? '' : 's') + (state.pens ? ' (' + state.pens + ' pensioner' + (state.pens === 1 ? '' : 's') + ')' : '') + (k ? ' and ' + k + ' child' + (k === 1 ? '' : 'ren') : ''); }
  var picker = null;
  function openLeave() { if (picker) picker.open('out'); }
  // the dates just went in: the two date boxes give a small pop
  function popDates() { $$('.bw-date').forEach(function (f, i) { f.classList.remove('pop'); void f.offsetWidth; f.style.setProperty('--pd', (i * 0.09) + 's'); f.classList.add('pop'); }); }
  function datesOk() {
    if (!state.ci || !state.co) { var f = $(state.ci ? '[data-bw-field="out"]' : '[data-bw-field="in"]'); f.classList.remove('attn'); void f.offsetWidth; f.classList.add('attn'); if (picker) picker.open(state.ci ? 'out' : 'in'); return false; }
    if (P && !checkWeekendRule()) { ruleNote.classList.remove('shake'); void ruleNote.offsetWidth; ruleNote.classList.add('shake'); return false; }
    return true;
  }
  function wizSummary() {
    var ds = $('[data-dates-sum]'), n;
    if (ds) {
      if (state.ci && state.co) { n = nightsOf(state.ci, state.co).length; ds.innerHTML = '<svg><use href="#i-check"/></svg><span>Arrival <b>' + nice(state.ci, LONG) + '</b>, departure <b>' + nice(state.co, LONG) + '</b>. That is <b>' + n + ' night' + (n > 1 ? 's' : '') + '</b>.</span>'; ds.className = 'bw-sum ok'; }
      else { ds.innerHTML = '<svg><use href="#i-cal"/></svg><span>' + (state.ci ? 'Now choose your <b>departure</b> date.' : 'No dates chosen yet.') + '</span>'; ds.className = 'bw-sum'; }
    }
    var ps = $('[data-people-sum]'); if (ps) ps.innerHTML = '<svg><use href="#i-users"/></svg><span><b>' + peopleText() + '</b>' + (state.kids ? '. Children under 12 stay free.' : '.') + '</span>';
    var cd = $('[data-chip="dates"]'); if (cd) cd.textContent = state.ci && state.co ? nice(state.ci) + ' to ' + nice(state.co) : 'Choose dates';
    var cp = $('[data-chip="people"]'); if (cp) cp.textContent = peopleText();
    if (STANDS.length) $$('.area-filter [data-area-f]').forEach(function (b) {
      var a = b.dataset.areaF, list = STANDS.filter(function (s) { return !a || s.area === a; }), free = state.ci && state.co ? list.filter(function (s) { return isFree(s, state.ci, state.co); }).length : null, el = $('[data-free]', b);
      b.classList.toggle('full', free === 0); b.classList.toggle('on', state.area === a); b.setAttribute('aria-pressed', state.area === a);
      if (el) el.textContent = free === null ? '' : free ? free + ' free' : 'Fully booked';
    });
  }
  function bwMark(n) {
    $$('.bw-steps li').forEach(function (li) { var s = +li.dataset.s; li.classList.toggle('on', s === n); li.classList.toggle('done', s < n); li.classList.toggle('can', s <= reached && s <= PICK && s !== n); });
    var bar = $('[data-bw-bar]'); if (bar) bar.style.width = ((n - 1) / 5 * 100) + '%';
  }
  function wGo(n, scroll) {
    if (n > 1 && !(state.ci && state.co)) n = 1;
    wstep = n; reached = Math.max(reached, n);
    $$('.bw-pane').forEach(function (p) { p.hidden = +p.dataset.pane !== n; });
    $('#results').hidden = n !== PICK;
    bwMark(n); wizSummary();
    if (n === PICK) render();
    if (scroll) { var bw = $('.bw'); if (bw) bw.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    var h = $('[data-pane="' + n + '"] h2'); if (h && scroll) { h.setAttribute('tabindex', '-1'); setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 350); }
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
    state.ci = parse(qs.get('in')); if (state.ci && state.ci < t) state.ci = null;
    state.co = state.ci ? (parse(qs.get('out')) || addDays(state.ci, 2)) : null; if (state.co && state.co <= state.ci) state.co = addDays(state.ci, 2);
    state.adults = Math.max(0, parseInt(qs.get('adults'), 10) || 2); state.kids = parseInt(qs.get('kids'), 10) || 0; state.pens = parseInt(qs.get('pens'), 10) || 0;
    if (state.adults + state.pens < 1) state.adults = 1;
    state.area = qs.get('area') || '';

    Promise.all([K.stands(), K.prices(), K.settings().catch(function () { return null; })]).then(function (r) {
      STANDS = r[0]; P = r[1]; S = r[2]; buildExtras(); SHOP = K.shopItems(P);
      syncSearch(); setView(location.hash === '#map' ? 'map' : 'grid');
      var deep = /^#(map|stand=)/.test(location.hash);
      if (state.ci && state.co && (qs.get('in') || deep)) { reached = PICK; wGo(PICK); } else wGo(1);
      render();
      if (location.hash === '#map') setTimeout(function () { $('#results').scrollIntoView({ behavior: 'smooth' }); }, 300);
      var m = location.hash.match(/stand=([\w-]+)/); if (m) openSheet(m[1]);
      var q2b = S && S.get('Live availability (Q2B)'); if (q2b) $$('[data-q2b]').forEach(function (a) { a.href = q2b; });
    }).catch(function (e) {
      console.error(e);
      grid.innerHTML = '<div class="empty"><h3>Stands couldn\'t load</h3><p class="muted">The site reads its stand list from <code>content/stands.md</code>. Open it through a web server (double-click <b>Preview website.bat</b>) rather than directly from the folder.</p></div>';
    });

    // search controls
    // the calendar (assets/js/datepicker.js): arrival, then departure, on one calendar
    if (K.datePicker) {
      picker = K.datePicker({ min: today(),
        get: function () { return { ci: state.ci, co: state.co }; },
        onChange: function (ci, co) { state.ci = ci; state.co = co; syncSearch(); render(); },
        onDone: function (ci, co, locked) { if (locked) popDates(); } });
      $$('[data-dp-open]').forEach(function (b) { b.addEventListener('click', function () { picker.open(b.dataset.dpOpen); }); });
    }
    $$('[data-pane="2"] [data-gstep]').forEach(function (b) {
      b.addEventListener('click', function () {
        var k = b.dataset.gstep, d = +b.dataset.d; state[k] = Math.max(0, Math.min(20, state[k] + d));
        if (state.adults + state.pens < 1) state[k] = 1;
        syncSearch(); render();
      });
    });
    $$('.area-filter [data-area-f]').forEach(function (b) { b.addEventListener('click', function () { state.area = b.dataset.areaF; syncSearch(); render(); wizSummary(); }); });
    $$('[data-quick]').forEach(function (b) {
      var f = nextFriday(+b.dataset.quick); b.textContent = nice(f, { weekday: 'short', day: 'numeric', month: 'short' }) + ' to ' + nice(addDays(f, 2), { weekday: 'short', day: 'numeric', month: 'short' });
      b.addEventListener('click', function () { state.ci = f; state.co = addDays(f, 2); syncSearch(); render(); popDates(); });
    });
    $$('[data-bw-go]').forEach(function (b) { b.addEventListener('click', function () { var n = +b.dataset.bwGo; if (n <= reached) wGo(n, true); }); });
    $$('[data-bw-next]').forEach(function (b) { b.addEventListener('click', function () { var n = +b.dataset.bwNext; if (n === 2 && !datesOk()) return; wGo(n, true); }); });
    $$('.sb-view button').forEach(function (b) { b.addEventListener('click', function () { setView(b.dataset.view); }); });
    $('[data-fix-weekend]').addEventListener('click', fixWeekend);
    window.addEventListener('hashchange', function () { if (location.hash === '#map') { if (state.ci && state.co) wGo(PICK); setView('map'); $('#results').hidden = false; $('#results').scrollIntoView({ behavior: 'smooth' }); } });

    // sheet
    $('.sheet-close').addEventListener('click', closeSheet); backdrop.addEventListener('click', closeSheet);
    $('[data-reserve]').addEventListener('click', openCheckout);
    document.addEventListener('keydown', function (e) { if (e.key !== 'Escape') return; if (modal.classList.contains('open')) closeCheckout(); else if (sheet.classList.contains('open')) closeSheet(); });

    // checkout
    $('.mc-close', modal).addEventListener('click', function () { if (step === 4) { closeCheckout(); closeSheet(); render(); } else closeCheckout(); });
    $$('[data-next]', modal).forEach(function (b) { b.addEventListener('click', function () { var cur = $('.mc-step.on', modal);
      if (validate(cur)) { goStep(step + 1); if (step === 3) renderSide(); } }); });
    $$('[data-back]', modal).forEach(function (b) { b.addEventListener('click', function () { goStep(step - 1); }); });
    $$('[name=pay]', modal).forEach(function (r) { r.addEventListener('change', payChanged); });

    $('[data-pay-now]', modal).addEventListener('click', function () {
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
