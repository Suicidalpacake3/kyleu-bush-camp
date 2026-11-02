/* =========================================================
   Change my booking (manage.html)
   Guests find their booking with the reference plus the email or mobile
   number they booked with, change what they need one section at a time,
   check the changes and save.
   Demo: bookings are read from this browser (website demo bookings and the
   admin demo) and changes are kept in localStorage "kyleu-web-amend", where
   the admin demo picks them up. Nothing is sent anywhere.
   Live version: the lookup and the save go to the booking system.
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu, $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return K.esc(s == null ? '' : String(s)); };
  var svg = function (id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; };
  var WEB = 'kyleu-web-bookings', ADMIN = 'kyleu-admin-demo-v1', AMEND = 'kyleu-web-amend';
  var STANDS = [], P = null, SHOP = [];
  var base = null, draft = null, openSec = '', carsEd = null, shopQty = null, step = 1;
  var ETAS = ['Before 12:00', '12:00-15:00', '15:00-18:00', 'After 18:00', 'Not sure yet'];

  function read(k, d) { try { var v = JSON.parse(localStorage.getItem(k) || 'null'); return v == null ? d : v; } catch (e) { return d; } }
  function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function digits(s) { var d = String(s || '').replace(/\D/g, ''); return d.length >= 9 ? d.slice(-9) : ''; }
  function D(s) { var p = String(s).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); }
  function today() { return iso(new Date()); }
  function nice(s, long) { return s ? D(s).toLocaleDateString('en-ZA', long ? { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' } : { weekday: 'short', day: 'numeric', month: 'short' }) : ''; }
  function nights(a, b) { return Math.round((D(b) - D(a)) / 864e5); }
  function stand(id) { return STANDS.filter(function (s) { return s.id === id; })[0] || { name: String(id || '').replace(/-/g, ' '), area: '' }; }
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function people(v) { return v.adults + v.pens + v.kids; }
  function peopleText(v) { var a = v.adults + v.pens; return a + ' adult' + (a === 1 ? '' : 's') + (v.pens ? ' (' + v.pens + ' pensioner' + (v.pens === 1 ? '' : 's') + ')' : '') + (v.kids ? ' and ' + v.kids + ' child' + (v.kids === 1 ? '' : 'ren') : ''); }
  function shopSum(q) { return K.shopTotal(SHOP, q || {}); }
  function shopList(q) { return SHOP.filter(function (it) { return q[it.label]; }).map(function (it) { return { label: it.label, qty: q[it.label], each: it.each }; }); }
  function price(v, n) { return v.method === 'card' ? K.toCard(n, P) : n; }

  /* ---------- finding bookings (demo: this browser) ---------- */
  function fromAdmin(b) {
    var pre = (b.charges || []).filter(function (c) { return c.pre; })[0], cs = b.cars || [];
    return { ref: b.ref, status: b.status, first: b.guest.first || '', last: b.guest.last || '', email: b.guest.email || '', phone: b.guest.phone || '', stand: b.stand, ci: b.ci, co: b.co, adults: b.adults || 0, pens: b.pens || 0, kids: b.kids || 0,
      vehicles: b.vehTbc ? 0 : (cs.length || b.vehicles || 1), cars: cs.map(function (c) { return { reg: c.reg || '', driver: c.driver || '', guests: (c.guests || []).slice() }; }),
      eta: b.eta || '', shop: pre && pre.items ? clone(pre.items) : {}, total: b.total || 0, paid: (b.payments || []).reduce(function (a, p) { return a + p.amt; }, 0), method: b.method || 'eft',
      request: b.changeReq && !b.changeReq.done ? b.changeReq : null };
  }
  function fromWeb(w) {
    var card = w.pay === 'deposit' || w.pay === 'full', shop = {};
    (w.shop || []).forEach(function (x) { shop[x.label] = x.qty; });
    return { ref: w.ref, status: w.paid ? 'confirmed' : 'pending', first: w.first || '', last: w.last || '', email: w.email || '', phone: w.phone || '', stand: w.stand, ci: w.ci, co: w.co, adults: w.adults || 0, pens: w.pens || 0, kids: w.kids || 0,
      vehicles: w.vehTbc ? 0 : Math.max(1, +w.vehicles || 1), cars: (w.cars || []).map(function (c) { return { reg: c.reg || '', driver: c.driver || '', guests: (c.guests || []).slice() }; }),
      eta: w.eta || '', shop: shop, total: card ? w.card : w.eft, paid: w.paid || 0, method: card ? 'card' : 'eft', request: null };
  }
  function applyAmend(v, a) {
    if (a.details) { v.first = a.details.first; v.last = a.details.last; v.email = a.details.email; v.phone = a.details.phone; }
    if (a.cars) { v.vehicles = a.vehicles; v.cars = clone(a.cars); }
    if (a.eta != null) v.eta = a.eta;
    if (a.shop) { v.total += a.shopDiff || 0; v.shop = clone(a.shop); }
    if (a.request) v.request = Object.assign({ at: a.at }, a.request);
    return v;
  }
  function allBookings() {
    var db = read(ADMIN, null), seen = (db && db.amendSeen) || {}, map = {};
    read(WEB, []).forEach(function (w) { if (w && w.ref) map[key(w.ref)] = fromWeb(w); });
    if (db && db.bookings) db.bookings.forEach(function (b) { map[key(b.ref)] = fromAdmin(b); });
    read(AMEND, []).forEach(function (a) { var v = map[key(a.ref)]; if (v && !seen[a.id]) applyAmend(v, a); });
    return map;
  }
  function findBooking(ref, who) {
    var v = allBookings()[key(ref)]; if (!v) return { err: 'ref' };
    var w = String(who || '').trim().toLowerCase(), ok = (w.indexOf('@') > 0 && w === v.email.toLowerCase()) || (digits(w) && digits(w) === digits(v.phone));
    return ok ? { v: v } : { err: 'who' };
  }

  /* ---------- steps ---------- */
  function go(n) {
    step = n;
    $$('[data-mg] .bw-pane').forEach(function (p) { p.hidden = +p.dataset.pane !== n; });
    $$('.mg-steps li').forEach(function (li) { var s = +li.dataset.s; li.classList.toggle('on', s === n); li.classList.toggle('done', s < n); });
    $('[data-mg-bar]').style.width = ((n - 1) / 3 * 100) + '%';
    var box = $('[data-mg]'), top = box.getBoundingClientRect().top + window.scrollY - 90;
    if (Math.abs(window.scrollY - top) > 40) window.scrollTo({ top: top, behavior: 'smooth' });
    var h = $('[data-pane="' + n + '"] h2'); if (h) { h.setAttribute('tabindex', '-1'); setTimeout(function () { try { h.focus({ preventScroll: true }); } catch (e) {} }, 300); }
  }

  /* ---------- step 2: the booking and its sections ---------- */
  var SECS = [
    { id: 'details', ic: 'i-users', t: 'Your contact details' },
    { id: 'cars', ic: 'i-car', t: 'Vehicles and who is in each one' },
    { id: 'eta', ic: 'i-clock', t: 'Arrival time' },
    { id: 'shop', ic: 'i-bag', t: 'Camp shop order' },
    { id: 'dates', ic: 'i-cal', t: 'Dates, number of guests or stand' },
    { id: 'note', ic: 'i-mail', t: 'A message for the Kyleu team' }
  ];
  function carsText(v) {
    if (!v.vehicles) return 'Not sure yet how many vehicles';
    var named = v.cars.slice(0, v.vehicles).reduce(function (a, c) { return a + (c.driver ? 1 : 0) + c.guests.length; }, 0), regs = v.cars.slice(0, v.vehicles).filter(function (c) { return c.reg; }).length;
    return v.vehicles + ' vehicle' + (v.vehicles === 1 ? '' : 's') + ' · ' + (regs === v.vehicles ? 'all registrations given' : regs ? regs + ' of ' + v.vehicles + ' registrations given' : 'no registrations yet') + ' · ' + named + ' of ' + people(v) + ' people named';
  }
  function summary(id, v) {
    if (id === 'details') return esc(v.first + ' ' + v.last) + ' · ' + esc(v.email || 'no email') + ' · ' + esc(v.phone || 'no mobile');
    if (id === 'cars') return esc(carsText(v));
    if (id === 'eta') return v.eta ? 'Arriving around ' + esc(v.eta) : 'Not given yet';
    if (id === 'shop') { var l = shopList(v.shop); return l.length ? esc(l.map(function (x) { return x.qty + ' × ' + x.label; }).join(', ')) + ' · ' + K.money(price(v, shopSum(v.shop))) : 'Nothing ordered yet'; }
    if (id === 'dates') return esc(nice(v.ci) + ' to ' + nice(v.co) + ' · ' + peopleText(v) + ' · ' + stand(v.stand).name) + (draft.request ? ' · <b class="mg-asked">You are asking for a change</b>' : base.request ? ' · <b class="mg-asked">Change asked for, waiting for Kyleu</b>' : '');
    if (id === 'note') return draft.note ? esc(draft.note.length > 80 ? draft.note.slice(0, 80) + '…' : draft.note) : 'Anything else you want to tell us';
    return '';
  }
  function changed(id) {
    if (id === 'details') return ['first', 'last', 'email', 'phone'].some(function (k) { return draft[k] !== base[k]; });
    if (id === 'cars') return draft.vehicles !== base.vehicles || JSON.stringify(draft.cars.slice(0, draft.vehicles)) !== JSON.stringify(base.cars.slice(0, base.vehicles));
    if (id === 'eta') return draft.eta !== base.eta;
    if (id === 'shop') return JSON.stringify(shopList(draft.shop)) !== JSON.stringify(shopList(base.shop));
    if (id === 'dates') return !!draft.request;
    if (id === 'note') return !!draft.note;
    return false;
  }
  function anyChange() { return SECS.some(function (s) { return changed(s.id); }); }

  function bookingCard(v) {
    var st = stand(v.stand), bal = Math.max(0, v.total - v.paid);
    return '<div class="mg-booking"><div class="mg-bk-top"><span class="mg-ref">' + esc(v.ref) + '</span><span class="mg-st ' + (v.status === 'pending' ? 'warn' : 'ok') + '">' + (v.status === 'pending' ? 'Waiting for your deposit' : v.status === 'in' ? 'In camp now' : 'Confirmed') + '</span></div>' +
      '<h3>' + esc(st.name) + '</h3><p>' + svg('i-cal') + '<span><b>' + esc(nice(v.ci, true)) + '</b> to <b>' + esc(nice(v.co, true)) + '</b> (' + nights(v.ci, v.co) + ' night' + (nights(v.ci, v.co) === 1 ? '' : 's') + ')</span></p>' +
      '<p>' + svg('i-users') + '<span>' + esc(peopleText(v)) + '</span></p>' +
      '<p class="mg-money">Total <b>' + K.money(v.total) + '</b> · Paid <b>' + K.money(v.paid) + '</b> · Still to pay <b>' + K.money(bal) + '</b></p></div>';
  }
  function editor(id) {
    var d = draft;
    if (id === 'details') return '<p class="mg-help-t">We use these to send your invoice, your Dinokeng codes and reminders before your stay.</p>' +
      '<div class="grid-2"><div class="field"><label for="e-first">First name</label><input id="e-first" name="first" value="' + esc(d.first) + '" autocomplete="given-name"></div><div class="field"><label for="e-last">Surname</label><input id="e-last" name="last" value="' + esc(d.last) + '" autocomplete="family-name"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="e-email">Email</label><input id="e-email" name="email" type="email" value="' + esc(d.email) + '" autocomplete="email"></div><div class="field"><label for="e-phone">Mobile number</label><input id="e-phone" name="phone" type="tel" value="' + esc(d.phone) + '" autocomplete="tel"></div></div>';
    if (id === 'cars') {
      var opts = ''; for (var i = 1; i <= 10; i++) opts += '<option value="' + i + '"' + (d.vehicles === i ? ' selected' : '') + '>' + i + ' vehicle' + (i === 1 ? '' : 's') + '</option>';
      return '<p class="mg-help-t">For each vehicle, give the <b>registration</b>, the <b>driver</b> and <b>everyone else in it</b>. Every person in a vehicle signs an indemnity form at the gate, and we make one Dinokeng partner code per vehicle, so this makes your arrival much quicker. Fill in what you know; you can come back and add the rest later.</p>' +
        '<div class="field"><label for="e-veh">How many vehicles are coming?</label><select id="e-veh" name="veh">' + opts + '<option value="0"' + (!d.vehicles ? ' selected' : '') + '>Not sure yet, I\'ll tell you later</option></select></div><div class="cars-list" data-cars></div>';
    }
    if (id === 'eta') return '<p class="mg-help-t">Check-in is from 12:00. Knowing roughly when you arrive helps us have your stand, firewood and ice ready.</p>' +
      '<div class="field"><label for="e-eta">Roughly when will you arrive?</label><select id="e-eta" name="eta">' + (d.eta ? '' : '<option value="">Choose a time</option>') + ETAS.map(function (t) { return '<option' + (t === d.eta ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>';
    if (id === 'shop') return '<p class="mg-help-t">Tap <b>+</b> to add and <b>&minus;</b> to remove. What you order is waiting for you when you arrive and goes on your invoice. Anything else you can buy at the camp shop.</p><div data-shop></div><div class="mg-shop-tot" data-shop-tot></div>';
    if (id === 'dates') {
      var r = d.request || {}, num = function (n, lab, sub, val) { return '<div class="bw-person"><span><b>' + lab + '</b><small>' + sub + '</small></span><span class="bw-stepper"><button type="button" data-st="' + n + '" data-d="-1" aria-label="One less">&minus;</button><output data-sto="' + n + '">' + val + '</output><button type="button" data-st="' + n + '" data-d="1" aria-label="One more">+</button></span></div>'; };
      return '<div class="mg-callout">' + svg('i-info') + '<p><b>We check these changes for you.</b> New dates or more guests can change the price, and the stand has to be free. So we look at it and confirm with you by email or WhatsApp. <b>Your booking stays as it is until we confirm.</b></p></div>' +
        (base.request ? '<p class="mg-help-t">' + svg('i-clock') + ' You already asked for a change' + (base.request.at ? ' on ' + esc(nice(base.request.at.slice(0, 10))) : '') + '. We will be in touch soon. Anything you ask here is added to it.</p>' : '') +
        '<div class="bw-dates"><div class="bw-date"><label for="e-ci"><span class="bw-dn">A</span><span><b>Arriving</b><small>Now: ' + esc(nice(base.ci)) + '</small></span></label><input id="e-ci" type="date" name="ci" min="' + today() + '" value="' + esc(r.ci || base.ci) + '"></div>' +
        '<div class="bw-date"><label for="e-co"><span class="bw-dn">B</span><span><b>Leaving</b><small>Now: ' + esc(nice(base.co)) + '</small></span></label><input id="e-co" type="date" name="co" min="' + today() + '" value="' + esc(r.co || base.co) + '"></div></div>' +
        '<div class="bw-people mg-people">' + num('adults', 'Adults', '12 years and older', r.adults != null ? r.adults : base.adults) + num('pens', 'Pensioners', 'South African pensioners', r.pens != null ? r.pens : base.pens) + num('kids', 'Children', 'Under 12 years old', r.kids != null ? r.kids : base.kids) + '</div>' +
        '<div class="field"><label for="e-msg">Anything else about the change? <span class="opt">(optional)</span></label><textarea id="e-msg" name="msg" rows="3" placeholder="e.g. We would like a stand closer to the pool">' + esc(r.msg || '') + '</textarea></div>';
    }
    if (id === 'note') return '<p class="mg-help-t">Anything else we should know? Celebrating something, a question, or a porta potty (only for the self-sufficient (R) stands)? Write it here and the team will see it on your booking.</p><div class="field"><label for="e-note">Your message</label><textarea id="e-note" name="note" rows="4">' + esc(d.note || '') + '</textarea></div>';
    return '';
  }
  function drawSecs() {
    var pane = $('[data-pane="2"]');
    pane.innerHTML = '<p class="bw-of">Step 2 of 4</p><h2>What would you like to change?</h2>' +
      '<p class="bw-lead">Press <b>Change</b> next to anything you want to update. You can change more than one thing. <b>Nothing is saved yet</b>: you check everything in the next step.</p>' + bookingCard(base) +
      '<div class="mg-secs">' + SECS.map(function (s) {
        var on = openSec === s.id, ch = changed(s.id);
        return '<section class="mg-sec' + (on ? ' open' : '') + (ch ? ' changed' : '') + '" data-sec="' + s.id + '"><div class="mg-sec-h"><span class="mg-ic">' + svg(s.ic) + '</span><div class="mg-sec-t"><b>' + s.t + '</b><small>' + summary(s.id, draft) + '</small></div>' +
          (ch && !on ? '<span class="mg-tag">' + svg('i-check') + 'Changed</span>' : '') + (on ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + s.id + '">' + svg('i-edit') + (ch ? 'Change again' : 'Change') + '</button>') + '</div>' +
          (on ? '<div class="mg-ed" data-ed>' + editor(s.id) + '<div class="mg-ed-acts">' + (ch ? '<button type="button" class="btn btn-ghost btn-sm" data-undo>Undo my changes here</button>' : '<button type="button" class="btn btn-ghost btn-sm" data-cancel>Close without changing</button>') + '<button type="button" class="btn" data-done>' + svg('i-check') + 'Done with this</button></div></div>' : '') + '</section>';
      }).join('') + '</div>' +
      '<p class="mg-nochange" data-nochange hidden role="status">' + svg('i-info') + 'You have not changed anything yet. Press <b>Change</b> next to what you want to update.</p>' +
      '<div class="bw-nav"><button class="btn btn-ghost" type="button" data-back1>' + svg('i-arrow-l') + 'Find another booking</button><button class="btn" type="button" data-next3>Next: check my changes ' + svg('i-arrow') + '</button></div>';
    wireEditor();
  }
  function wireEditor() {
    var ed = $('[data-ed]'); if (!ed) return;
    if (openSec === 'cars') {
      carsEd = K.carsEditor($('[data-cars]', ed), { count: draft.vehicles, cars: draft.cars, total: people(base), overText: 'To change the number of guests, use "Dates, number of guests or stand" further down.', later: '<b>No problem.</b> Come back here and add them when you know, any time before you arrive. We will remind you closer to the time.' });
      $('[name=veh]', ed).addEventListener('change', function () { carsEd.setCount(+this.value); });
    }
    if (openSec === 'shop') {
      shopQty = clone(draft.shop);
      var tot = function () { var was = shopSum(base.shop), now = shopSum(shopQty), d = price(base, now - was); $('[data-shop-tot]', ed).innerHTML = 'Your shop order: <b>' + K.money(price(base, now)) + '</b>' + (d ? ' <span class="' + (d > 0 ? 'up' : 'down') + '">(' + (d > 0 ? '+' : '&minus;') + K.money(Math.abs(d)) + ' on your invoice)</span>' : ''); };
      K.shopPicker($('[data-shop]', ed), SHOP, shopQty, tot); tot();
    }
    if (openSec === 'dates') $$('[data-st]', ed).forEach(function (b) {
      b.addEventListener('click', function () { var o = $('[data-sto="' + b.dataset.st + '"]', ed), v = Math.max(0, Math.min(20, +o.textContent + +b.dataset.d)); o.textContent = v; });
    });
    var first = $('input, select, textarea, button', ed); if (first && openSec !== 'shop') try { first.focus({ preventScroll: true }); } catch (e) {}
  }
  // copy what is in the open editor into the draft; false when something needs fixing
  function takeEditor() {
    var ed = $('[data-ed]'); if (!ed) return true;
    var val = function (n) { var el = $('[name=' + n + ']', ed); return el ? el.value.trim() : ''; };
    if (openSec === 'details') {
      var g = { first: val('first'), last: val('last'), email: val('email'), phone: val('phone') };
      if (!g.first || !g.last) return fail('Please fill in your first name and surname.');
      if (g.email && !/^\S+@\S+\.\S+$/.test(g.email)) return fail('That email address does not look right. Please check it.');
      if (!g.email && !digits(g.phone)) return fail('We need an email address or a mobile number to reach you.');
      Object.assign(draft, g);
    }
    if (openSec === 'cars') { var c = carsEd.get(); draft.vehicles = c.count; draft.cars = c.cars; }
    if (openSec === 'eta') draft.eta = val('eta');
    if (openSec === 'shop') draft.shop = clone(shopQty);
    if (openSec === 'dates') {
      var r = { ci: val('ci'), co: val('co'), msg: val('msg') };
      ['adults', 'pens', 'kids'].forEach(function (n) { r[n] = +$('[data-sto="' + n + '"]', ed).textContent; });
      if (!r.ci || !r.co || r.co <= r.ci) return fail('The day you leave must be after the day you arrive.');
      if (r.adults + r.pens < 1) return fail('At least one adult needs to be on the booking.');
      var same = r.ci === base.ci && r.co === base.co && r.adults === base.adults && r.pens === base.pens && r.kids === base.kids;
      draft.request = same && !r.msg ? null : r;
    }
    if (openSec === 'note') draft.note = val('note');
    return true;
  }
  function fail(msg) { K.toast(msg); var ed = $('[data-ed]'); if (ed) { var e = $('.mg-ed-err', ed); if (!e) { e = document.createElement('p'); e.className = 'mg-ed-err'; e.setAttribute('role', 'alert'); ed.insertBefore(e, $('.mg-ed-acts', ed)); } e.textContent = msg; } return false; }
  function undo(id) {
    if (id === 'details') ['first', 'last', 'email', 'phone'].forEach(function (k) { draft[k] = base[k]; });
    if (id === 'cars') { draft.vehicles = base.vehicles; draft.cars = clone(base.cars); }
    if (id === 'eta') draft.eta = base.eta;
    if (id === 'shop') draft.shop = clone(base.shop);
    if (id === 'dates') draft.request = null;
    if (id === 'note') draft.note = '';
  }
  function scrollToSec(id) { var el = $('[data-sec="' + id + '"]'); if (el) { var r = el.getBoundingClientRect(); if (r.top < 80 || r.top > window.innerHeight - 120) window.scrollTo({ top: r.top + window.scrollY - 100, behavior: 'smooth' }); } }

  /* ---------- step 3: check ---------- */
  function row(label, was, now) { return '<div class="mg-row"><span class="mg-rl">' + label + '</span><span class="mg-was">' + (was || '<i>empty</i>') + '</span>' + svg('i-arrow') + '<span class="mg-now">' + (now || '<i>empty</i>') + '</span></div>'; }
  function carsList(v) {
    if (!v.vehicles) return '<p>Not sure yet how many vehicles. You can add them later.</p>';
    return '<ol class="mg-cars">' + v.cars.slice(0, v.vehicles).map(function (c, i) { return '<li><b>Vehicle ' + (i + 1) + (c.reg ? ': ' + esc(c.reg) : '') + '</b><span>Driver: ' + esc(c.driver || 'not given yet') + '</span><span>Passengers: ' + (c.guests.length ? esc(c.guests.join(', ')) : 'none named yet') + '</span></li>'; }).join('') + '</ol>';
  }
  function drawCheck() {
    var d = draft, b = base, blocks = [], shopDiff = price(b, shopSum(d.shop) - shopSum(b.shop));
    if (changed('details')) blocks.push(['i-users', 'Your contact details', [['First name', 'first'], ['Surname', 'last'], ['Email', 'email'], ['Mobile', 'phone']].filter(function (f) { return d[f[1]] !== b[f[1]]; }).map(function (f) { return row(f[0], esc(b[f[1]]), esc(d[f[1]])); }).join('')]);
    if (changed('cars')) blocks.push(['i-car', 'Vehicles and who is in each one', carsList(d)]);
    if (changed('eta')) blocks.push(['i-clock', 'Arrival time', row('Arriving around', esc(b.eta), esc(d.eta))]);
    if (changed('shop')) { var l = shopList(d.shop); blocks.push(['i-bag', 'Camp shop order', (l.length ? '<ul class="mg-shop">' + l.map(function (x) { return '<li><span>' + x.qty + ' × ' + esc(x.label) + '</span><b>' + K.money(price(b, x.qty * x.each)) + '</b></li>'; }).join('') + '</ul>' : '<p>No shop items. Everything you had ordered is taken off.</p>')]); }
    if (changed('dates')) { var r = d.request; blocks.push(['i-cal', 'You are asking us to change', (r.ci !== b.ci || r.co !== b.co ? row('Dates', esc(nice(b.ci) + ' to ' + nice(b.co)), esc(nice(r.ci) + ' to ' + nice(r.co))) : '') + (r.adults !== b.adults || r.pens !== b.pens || r.kids !== b.kids ? row('Guests', esc(peopleText(b)), esc(peopleText(r))) : '') + (r.msg ? '<p class="mg-quote">"' + esc(r.msg) + '"</p>' : '') + '<p class="mg-small">' + svg('i-info') + 'We check this and confirm with you. Your booking stays as it is until then.</p>']); }
    if (changed('note')) blocks.push(['i-mail', 'Your message for the team', '<p class="mg-quote">"' + esc(d.note) + '"</p>']);
    var newTotal = b.total + shopDiff, bal = Math.max(0, newTotal - b.paid);
    $('[data-pane="3"]').innerHTML = '<p class="bw-of">Step 3 of 4</p><h2>Check your changes</h2><p class="bw-lead">Read through what will change on booking <b>' + esc(b.ref) + '</b>. If something is not right, go back and fix it.</p>' +
      blocks.map(function (x) { return '<div class="mg-chk"><h3>' + svg(x[0]) + x[1] + '</h3>' + x[2] + '</div>'; }).join('') +
      (shopDiff ? '<div class="mg-total"><div><span>Total before</span><b>' + K.money(b.total) + '</b></div><div><span>Camp shop change</span><b class="' + (shopDiff > 0 ? 'up' : 'down') + '">' + (shopDiff > 0 ? '+' : '&minus;') + K.money(Math.abs(shopDiff)) + '</b></div><div class="big"><span>New total</span><b>' + K.money(newTotal) + '</b></div><div><span>Paid so far</span><b>' + K.money(b.paid) + '</b></div><div class="big"><span>Still to pay</span><b>' + K.money(bal) + '</b></div></div>' : '') +
      '<p class="mg-nochange">' + svg('i-info') + '<span><b>Nothing is saved yet.</b> Press <b>Save my changes</b> to send them to Kyleu.</span></p>' +
      '<div class="bw-nav"><button class="btn btn-ghost" type="button" data-back2>' + svg('i-arrow-l') + 'Back: make more changes</button><button class="btn" type="button" data-save>' + svg('i-check') + 'Save my changes</button></div>';
  }

  /* ---------- save ---------- */
  function save() {
    var d = draft, b = base, a = { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: b.ref, at: today() + ' ' + new Date().toTimeString().slice(0, 5), summary: [] };
    if (changed('details')) { a.details = { first: d.first, last: d.last, email: d.email, phone: d.phone }; a.summary.push('contact details'); }
    if (changed('cars')) { a.vehicles = d.vehicles; a.cars = d.cars.slice(0, d.vehicles); a.summary.push('vehicles and passengers'); }
    if (changed('eta')) { a.eta = d.eta; a.summary.push('arrival time ' + (d.eta || 'cleared')); }
    if (changed('shop')) { a.shop = clone(d.shop); a.shopItems = shopList(d.shop); a.shopDiff = price(b, shopSum(d.shop) - shopSum(b.shop)); a.summary.push('camp shop order'); }
    if (changed('dates')) { a.request = clone(d.request); a.summary.push('asked to change the dates or guests'); }
    if (changed('note')) { a.note = d.note; a.summary.push('a message'); }
    var list = read(AMEND, []); list.push(a);
    try { localStorage.setItem(AMEND, JSON.stringify(list.slice(-80))); } catch (e) { K.toast('Your browser could not save the changes. Please WhatsApp us.'); return; }
    var was = clone(base); base = applyAmend(clone(base), a); draft = Object.assign(clone(base), { note: '', request: null });
    var bal = Math.max(0, base.total - base.paid), steps = [];
    steps.push('We have let the Kyleu team know' + (base.email ? ' and will email a copy to <b>' + esc(base.email) + '</b>' : '') + '.');
    if (a.shop) steps.push('Your shop order is on your invoice. Your new total is <b>' + K.money(base.total) + '</b>' + (bal ? ' and <b>' + K.money(bal) + '</b> is still to pay' : '') + '. Pay by EFT with reference <b>' + esc(base.ref) + '</b>.');
    if (a.request) steps.push('We check your new dates or guests and get back to you by email or WhatsApp, usually within one working day. <b>Your booking stays as it is until we confirm.</b>');
    if (base.vehicles === 0 || base.cars.some(function (c) { return !c.reg || !c.driver; })) steps.push('Still missing some vehicle details? Come back here any time before ' + esc(nice(base.ci)) + ' to add them.');
    $('[data-pane="4"]').innerHTML = '<div class="success mg-done"><div class="success-badge"><svg class="ring" viewBox="0 0 110 110" fill="none" stroke="#3f7d3a" stroke-width="6" stroke-linecap="round"><circle cx="55" cy="55" r="50"/><path d="M34 57l14 14 28-30"/></svg></div>' +
      '<p class="bw-of">Step 4 of 4</p><h2>Your changes are saved</h2><p class="muted">Booking <b>' + esc(base.ref) + '</b> · ' + esc(stand(base.stand).name) + ' · ' + esc(nice(base.ci)) + ' to ' + esc(nice(base.co)) + '</p>' +
      '<p class="mg-small">You changed: ' + esc(a.summary.join(', ')) + '.</p>' +
      '<ol class="next-steps">' + steps.map(function (t, i) { return '<li><b>' + (i + 1) + '</b><span>' + t + '</span></li>'; }).join('') + '</ol>' +
      '<div class="cta-actions"><button class="btn" type="button" data-again>' + svg('i-edit') + 'Change something else</button><a class="btn btn-ghost" href="index.html">Back to the home page</a></div>' +
      '<div class="demo-flag" style="margin:22px 0 0;text-align:left">' + svg('i-info') + '<span>Demo mode: nothing was sent anywhere. The change stays in this browser, so you can see it arrive on the booking in the admin demo.</span></div></div>';
    void was; go(4);
  }

  /* ---------- start ---------- */
  function demoChips() {
    var box = $('[data-demo]'), all = allBookings(), t = today();
    var list = Object.keys(all).map(function (k) { return all[k]; }).filter(function (v) { return v.co >= t && v.status !== 'cancelled' && v.status !== 'out'; });
    var web = read(WEB, []).map(function (w) { return key(w.ref); });
    list.sort(function (a, b) { return (web.indexOf(key(b.ref)) >= 0) - (web.indexOf(key(a.ref)) >= 0) || (a.ci < b.ci ? -1 : 1); });
    list = list.slice(0, 4); if (!list.length) return;
    box.hidden = false;
    box.innerHTML = svg('i-info') + '<span><b>Demo:</b> try a booking that is saved in this browser. Tap one to fill in the boxes. ' + list.map(function (v) { return '<button type="button" class="mg-chip" data-fill="' + esc(v.ref) + '|' + esc(v.email || v.phone) + '">' + esc(v.ref) + ' · ' + esc(v.first) + '</button>'; }).join(' ') + '</span>';
  }
  document.addEventListener('DOMContentLoaded', function () {
    var root = $('[data-mg]'); if (!root) return;
    var f = $('[data-find]'), err = $('[data-find-err]');
    try { var q = new URLSearchParams(location.search); if (q.get('ref')) f.elements.ref.value = q.get('ref').toUpperCase(); } catch (e) {}
    go(1); window.scrollTo(0, 0);
    Promise.all([K.stands().catch(function () { return []; }), K.prices()]).then(function (r) { STANDS = r[0]; P = r[1]; SHOP = K.shopItems(P); demoChips(); });

    f.addEventListener('submit', function (e) {
      e.preventDefault(); err.hidden = true;
      var ref = f.elements.ref.value.trim(), who = f.elements.who.value.trim();
      f.elements.ref.closest('.field').classList.toggle('err', !ref); f.elements.who.closest('.field').classList.toggle('err', !who);
      if (!ref) { f.elements.ref.focus(); return; } if (!who) { f.elements.who.focus(); return; }
      var r = findBooking(ref, who);
      if (r.err) { err.hidden = false; err.innerHTML = svg('i-info') + '<span>' + (r.err === 'ref' ? 'We can\'t find a booking with the reference <b>' + esc(ref.toUpperCase()) + '</b>. Please check it on your confirmation email or invoice. It starts with KY.' : 'We found booking <b>' + esc(ref.toUpperCase()) + '</b>, but that email address or mobile number is not the one on it. Please use the one you booked with.') + ' Still stuck? <a href="https://wa.me/27604584478" target="_blank" rel="noopener">WhatsApp us</a>.</span>'; return; }
      var v = r.v;
      if (v.status === 'cancelled') { err.hidden = false; err.innerHTML = svg('i-info') + '<span>Booking <b>' + esc(v.ref) + '</b> was cancelled, so it can\'t be changed here. Your payment is kept as a credit: <a href="https://wa.me/27604584478" target="_blank" rel="noopener">WhatsApp us</a> to book new dates.</span>'; return; }
      if (v.co < today() || v.status === 'out') { err.hidden = false; err.innerHTML = svg('i-info') + '<span>Your stay on booking <b>' + esc(v.ref) + '</b> is over, so it can\'t be changed any more. We hope you loved the bush!</span>'; return; }
      base = v; draft = Object.assign(clone(v), { note: '', request: null }); openSec = '';
      drawSecs(); go(2);
    });
    $('[data-demo]').addEventListener('click', function (e) { var c = e.target.closest('[data-fill]'); if (!c) return; var p = c.dataset.fill.split('|'); f.elements.ref.value = p[0]; f.elements.who.value = p[1]; f.querySelector('[type=submit]').focus(); });

    root.addEventListener('click', function (e) {
      var t = e.target;
      var ed = t.closest('[data-edit]');
      if (ed) { if (openSec && !takeEditor()) { scrollToSec(openSec); return; } openSec = ed.dataset.edit; drawSecs(); scrollToSec(openSec); return; }
      if (t.closest('[data-done]')) { var was = openSec; if (!takeEditor()) return; openSec = ''; drawSecs(); scrollToSec(was); if (changed(was)) K.toast('Got it. You can change something else, or press Next at the bottom.'); return; }
      if (t.closest('[data-cancel]')) { var c0 = openSec; openSec = ''; drawSecs(); scrollToSec(c0); return; }
      if (t.closest('[data-undo]')) { var u = openSec; undo(u); openSec = ''; drawSecs(); scrollToSec(u); K.toast('Put back the way it was'); return; }
      if (t.closest('[data-back1]')) { go(1); return; }
      if (t.closest('[data-next3]')) {
        if (openSec) { if (!takeEditor()) { scrollToSec(openSec); return; } openSec = ''; drawSecs(); }
        if (!anyChange()) { var n = $('[data-nochange]'); n.hidden = false; n.classList.remove('shake'); void n.offsetWidth; n.classList.add('shake'); return; }
        drawCheck(); go(3); return;
      }
      if (t.closest('[data-back2]')) { drawSecs(); go(2); return; }
      if (t.closest('[data-save]')) { var sb = t.closest('[data-save]'); sb.disabled = true; sb.innerHTML = '<span class="spin"></span> Saving…'; setTimeout(save, 700); return; }
      if (t.closest('[data-again]')) { openSec = ''; drawSecs(); go(2); return; }
    });
    // Enter in a box should not jump steps
    root.addEventListener('keydown', function (e) { if (e.key === 'Enter' && !e.defaultPrevented && e.target.matches('[data-ed] input')) { e.preventDefault(); var d = $('[data-done]'); if (d) d.click(); } });
  });
})();
