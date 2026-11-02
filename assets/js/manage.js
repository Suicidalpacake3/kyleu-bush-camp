/* =========================================================
   Your booking (manage.html), opened from the guest's private link
   (manage.html?b=REF&k=KEY), or with the reference plus email or mobile.
   - Not paid in full yet: "Amend your booking": I have paid, number of guests, contact details.
   - Paid in full: "Finalise your booking": vehicles and passengers, arrival time, camp shop,
     number of guests (more people = money owing again), contact details, a message.
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
  var ETAS = ['Before 13:00', '13:00-15:00', '15:00-18:00', 'After 18:00', 'Not sure yet'];

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
  function balDays() { return P ? P.num('Booking rules', 'Balance due days before arrival', 7) : 7; }
  // from the "everything paid" date (a week before arrival) guests and dates can only be changed by phoning or WhatsApping Kyleu
  function locked(v) { return nights(today(), v.ci) <= balDays(); }
  function lockDate(v) { var d = D(v.ci); d.setDate(d.getDate() - balDays()); return iso(d); }
  function paidFull(v) { return v.paid > 0 && v.paid >= v.total; }
  function draftG() { return draft.guests || { adults: base.adults, pens: base.pens, kids: base.kids }; }
  // what happens when the guest changes the number of people:
  //  not paid in full yet       -> changed straight away, new price and invoice
  //  paid in full and more cost -> changed straight away; the booking is waiting for payment again
  //  the new total is less than what was already paid -> Kyleu talks to the client first
  function plan(g) {
    var v = base, diff = price(v, K.stayPrice(P, stand(v.stand).area, v.ci, v.co, g) - K.stayPrice(P, stand(v.stand).area, v.ci, v.co, v));
    if (v.total + diff < v.paid) return { mode: 'request', diff: diff };
    return { mode: 'direct', diff: diff, extra: paidFull(v) && diff > 0 };
  }
  function finalMode(v) { return paidFull(v); }
  function waLink(v, what) { return 'https://wa.me/27604584478?text=' + encodeURIComponent('Hi Kyleu, my booking reference is ' + v.ref + '. I would like to change ' + what + '.'); }
  function callUs(v, what) { return '<div class="row-btns mg-callus"><a class="btn btn-green btn-sm" href="' + waLink(v, what) + '" target="_blank" rel="noopener">' + svg('i-wa') + 'WhatsApp us</a><a class="btn btn-ghost btn-sm" href="tel:+27604584478">' + svg('i-phone') + 'Call 060 458 4478</a></div>'; }

  /* ---------- finding bookings (demo: this browser) ---------- */
  function fromAdmin(b) {
    var pre = (b.charges || []).filter(function (c) { return c.pre; })[0], cs = b.cars || [];
    return { ref: b.ref, status: b.status, first: b.guest.first || '', last: b.guest.last || '', email: b.guest.email || '', phone: b.guest.phone || '', stand: b.stand, ci: b.ci, co: b.co, adults: b.adults || 0, pens: b.pens || 0, kids: b.kids || 0,
      vehicles: b.vehTbc ? 0 : (cs.length || b.vehicles || 1), cars: cs.map(function (c) { return { reg: c.reg || '', driver: c.driver || '', guests: (c.guests || []).slice() }; }),
      eta: b.eta || '', shop: pre && pre.items ? clone(pre.items) : {}, total: b.total || 0, paid: (b.payments || []).reduce(function (a, p) { return a + p.amt; }, 0), method: b.method || 'eft',
      request: b.changeReq && !b.changeReq.done ? b.changeReq : null, invoice: (b.invoices || []).filter(function (x) { return x.kind === 'Invoice'; }).slice(-1)[0] || null,
      claim: b.paidClaim && !b.paidClaim.done ? b.paidClaim : null, created: (b.created || '').slice(0, 10), key: b.key || '', finalised: b.finalised || null };
  }
  function fromWeb(w) {
    var card = w.pay === 'deposit' || w.pay === 'full', shop = {};
    (w.shop || []).forEach(function (x) { shop[x.label] = x.qty; });
    return { ref: w.ref, status: w.paid ? 'confirmed' : 'pending', first: w.first || '', last: w.last || '', email: w.email || '', phone: w.phone || '', stand: w.stand, ci: w.ci, co: w.co, adults: w.adults || 0, pens: w.pens || 0, kids: w.kids || 0,
      vehicles: w.vehTbc ? 0 : Math.max(1, +w.vehicles || 1), cars: (w.cars || []).map(function (c) { return { reg: c.reg || '', driver: c.driver || '', guests: (c.guests || []).slice() }; }),
      eta: w.eta || '', shop: shop, total: card ? w.card : w.eft, paid: w.paid || 0, method: card ? 'card' : 'eft', request: null, invoice: w.invoice || null, claim: null, created: (w.created || '').slice(0, 10), key: w.key || '', finalised: null };
  }
  function applyAmend(v, a) {
    if (a.guests && a.guests.mode === 'direct') { v.adults = a.guests.adults; v.pens = a.guests.pens; v.kids = a.guests.kids; v.total += a.guests.diff || 0; }
    if (a.details) { v.first = a.details.first; v.last = a.details.last; v.email = a.details.email; v.phone = a.details.phone; }
    if (a.cars) { v.vehicles = a.vehicles; v.cars = clone(a.cars); }
    if (a.eta != null) v.eta = a.eta;
    if (a.shop) { v.total += a.shopDiff || 0; v.shop = clone(a.shop); }
    if (a.request) v.request = Object.assign({ at: a.at }, a.request);
    if (a.invoice) v.invoice = clone(a.invoice);
    if (a.finalise) v.finalised = { at: a.at, by: 'Guest' };
    return v;
  }
  function allBookings() {
    var db = read(ADMIN, null), seen = (db && db.amendSeen) || {}, map = {};
    read(WEB, []).forEach(function (w) { if (w && w.ref) map[key(w.ref)] = fromWeb(w); });
    if (db && db.bookings) db.bookings.forEach(function (b) { map[key(b.ref)] = fromAdmin(b); });
    read(AMEND, []).forEach(function (a) { var v = map[key(a.ref)]; if (v && !seen[a.id]) applyAmend(v, a); });
    var pseen = (db && db.paidSeen) || {};
    K.paidClaims().forEach(function (c) { var v = map[key(c.ref)]; if (v && !pseen[c.id]) v.claim = c; });
    return map;
  }
  function findBooking(ref, who) {
    var v = allBookings()[key(ref)]; if (!v) return { err: 'ref' };
    var w = String(who || '').trim().toLowerCase(), ok = (w.indexOf('@') > 0 && w === v.email.toLowerCase()) || (digits(w) && digits(w) === digits(v.phone));
    return ok ? { v: v } : { err: 'who' };
  }

  /* ---------- invoice ---------- */
  function depDays() { return P ? P.num('Booking rules', 'Deposit due within days of invoice', 5) : 5; }
  function addD(s, n) { var d = D(s); d.setDate(d.getDate() + n); return iso(d); }
  function invoiceFor(v) {
    var depPct = P ? P.num('Booking rules', 'Deposit percentage', 50) : 50, base0 = v.invoice ? clone(v.invoice) : null;
    var stayInfo = { stand: stand(v.stand).name, ci: v.ci, co: v.co, nights: nights(v.ci, v.co), guests: peopleText(v), vehicles: v.vehicles || 'Not sure yet' };
    if (base0) {
      base0.guest = { name: (v.first + ' ' + v.last).trim(), email: v.email, phone: v.phone }; base0.stay = stayInfo; base0.paid = v.paid;
      var sum = base0.lines.reduce(function (a, l) { return a + (l.amt || 0); }, 0);
      if (Math.round(sum) !== Math.round(v.total)) base0.lines.push({ t: 'Changes made by Kyleu since this invoice', amt: v.total - sum, tag: 'adj' });
      base0.total = v.total; return base0;
    }
    // no invoice kept yet: build one from the booking
    var sl = shopList(v.shop), shopAmt = price(v, shopSum(v.shop));
    return { kind: 'Invoice', no: K.invoiceNo(v.ref, 'Invoice', 1), date: v.created || today(), ref: v.ref, guest: { name: (v.first + ' ' + v.last).trim(), email: v.email, phone: v.phone }, stay: stayInfo,
      lines: [stayLine(v, v, v.total - shopAmt)].concat(sl.map(function (x) { return shopLine(v, x); })),
      total: v.total, paid: v.paid, deposit: Math.round(v.total * depPct / 100), depPct: depPct, depositDue: addD(v.created || today(), depDays()), balanceDue: addD(v.ci, -balDays()), payFull: nights(v.created || today(), v.ci) <= balDays() };
  }
  function stayLine(v, g, amt) { var n = nights(v.ci, v.co); return { t: stand(v.stand).name + ' (Guests: ' + people(g) + ') · ' + peopleText(g), q: n, u: Math.round(amt / n), amt: amt, tag: 'stay' }; }
  function shopLine(v, x) { return { t: x.label, q: x.qty, u: price(v, x.each), amt: price(v, x.qty * x.each), tag: 'shop' }; }
  // a new invoice after a change that alters the price
  function nextInvoice(v, a) {
    var cur = invoiceFor(v), n = (parseInt(String(cur.no).split('-').pop(), 10) || 1) + 1, lines = cur.lines.filter(function (l) { return l.tag !== 'adj'; });
    if (a.guests && a.guests.mode === 'direct') {
      var stayAmt = lines.filter(function (l) { return l.tag === 'stay'; }).reduce(function (x, l) { return x + (l.amt || 0); }, 0) + (a.guests.diff || 0);
      lines = [stayLine(v, a.guests, stayAmt)].concat(lines.filter(function (l) { return l.tag !== 'stay'; }));
    }
    if (a.shopItems) lines = lines.filter(function (l) { return l.tag !== 'shop'; }).concat(a.shopItems.map(function (x) { return shopLine(v, x); }));
    var total = lines.reduce(function (x, l) { return x + (l.amt || 0); }, 0);
    return Object.assign(cur, { no: K.invoiceNo(v.ref, 'Invoice', n), date: today(), lines: lines, total: total, deposit: cur.paid ? cur.deposit : Math.round(total * (cur.depPct || 50) / 100), note: 'Updated invoice: replaces ' + cur.no + '.' });
  }
  function invModal(v) {
    var inv = invoiceFor(v), st = K.invoiceState(inv), m = document.createElement('div');
    m.className = 'inv-modal'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', 'Your invoice');
    m.innerHTML = '<div class="inv-modal-card"><div class="inv-modal-h"><h2>Your invoice</h2><button type="button" class="inv-x" data-inv-close aria-label="Close">' + svg('i-x') + '</button></div>' + K.invoiceHTML(inv) +
      '<div class="inv-acts"><button class="btn btn-ghost" type="button" data-inv-pdf>' + svg('i-doc') + 'Download PDF</button><button class="btn btn-ghost" type="button" data-inv-print>' + svg('i-doc') + 'Print</button>' +
      (st.bal > 0 && !v.claim ? '<button class="btn btn-green" type="button" data-inv-paid>' + svg('i-check') + 'I have paid</button>' : '') + '</div><div class="paid-box" data-paid-box>' + (v.claim ? K.paidThanks(v.claim, inv) : '') + '</div></div>';
    document.body.appendChild(m); document.body.classList.add('lock');
    var close = function () { m.remove(); document.body.classList.remove('lock'); drawSecs(); };
    m.addEventListener('click', function (e) {
      if (e.target === m || e.target.closest('[data-inv-close]')) { close(); return; }
      if (e.target.closest('[data-inv-pdf]')) { K.downloadInvoice(inv).catch(function () { K.toast('The PDF could not be made. Check your internet connection.'); }); return; }
      if (e.target.closest('[data-inv-print]')) { K.printInvoice(inv).catch(function () { K.toast('The invoice could not be printed. Try Download PDF instead.'); }); return; }
      var pb = e.target.closest('[data-inv-paid]');
      if (pb) K.paidForm($('[data-paid-box]', m), inv, function (c) { if (c) { pb.remove(); base.claim = c; } });
    });
    document.addEventListener('keydown', function esc0(e) { if (e.key === 'Escape' && document.body.contains(m)) { close(); document.removeEventListener('keydown', esc0); } });
    $('[data-inv-close]', m).focus();
    if (v._paid) { var b0 = $('[data-inv-paid]', m); if (b0) b0.click(); }
  }

  function shopFor(v) {
    var list = K.shopItems(P), n = nights(v.ci, v.co);
    if (stand(v.stand).area === 'self-sufficient') { var pp = P.num('Self-sufficient', 'Porta potty hire per night', 100); list.unshift({ label: 'Porta potty hire, cleaning included (' + n + ' night' + (n === 1 ? '' : 's') + ')', each: pp * n, note: K.money(pp) + ' per night', img: 'assets/img/photos/ablution-bathroom.jpg', max: 1 }); }
    return list;
  }
  function openBooking(v, viaLink) {
    base = v; SHOP = shopFor(v); draft = Object.assign(clone(v), { note: '', request: null, guests: null }); openSec = ''; fromLink = !!viaLink;
    drawSecs(); go(2);
  }
  var fromLink = false;

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
  var ALL = {
    details: { id: 'details', ic: 'i-phone', t: 'Your contact details' },
    cars: { id: 'cars', ic: 'i-car', t: 'Vehicles and who is in each one' },
    eta: { id: 'eta', ic: 'i-clock', t: 'Arrival time' },
    shop: { id: 'shop', ic: 'i-bag', t: 'Camp shop order' },
    guests: { id: 'guests', ic: 'i-users', t: 'Number of guests' },
    note: { id: 'note', ic: 'i-mail', t: 'A message for the Kyleu team' }
  };
  var SECS = [];
  function secsFor(v) { return (finalMode(v) ? ['cars', 'eta', 'shop', 'guests', 'details', 'note'] : ['guests', 'details']).map(function (k) { return ALL[k]; }); }
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
    if (id === 'guests') return esc(peopleText(draftG())) + (draft.guests ? ' · <b class="mg-asked">' + (plan(draft.guests).mode === 'direct' ? 'Changed' : 'You are asking for a change') + '</b>' : '') + (locked(base) ? ' · <b class="mg-asked">Call or WhatsApp us to change</b>' : '');
    if (id === 'dates') return esc(nice(v.ci) + ' to ' + nice(v.co) + ' · ' + stand(v.stand).name) + (draft.request ? ' · <b class="mg-asked">You are asking for a change</b>' : base.request ? ' · <b class="mg-asked">Change asked for, waiting for Kyleu</b>' : '') + (locked(base) ? ' · <b class="mg-asked">Call or WhatsApp us to change</b>' : '');
    if (id === 'note') return draft.note ? esc(draft.note.length > 80 ? draft.note.slice(0, 80) + '…' : draft.note) : 'Anything else you want to tell us';
    return '';
  }
  function changed(id) {
    if (id === 'details') return ['first', 'last', 'email', 'phone'].some(function (k) { return draft[k] !== base[k]; });
    if (id === 'cars') return draft.vehicles !== base.vehicles || JSON.stringify(draft.cars.slice(0, draft.vehicles)) !== JSON.stringify(base.cars.slice(0, base.vehicles));
    if (id === 'eta') return draft.eta !== base.eta;
    if (id === 'shop') return JSON.stringify(shopList(draft.shop)) !== JSON.stringify(shopList(base.shop));
    if (id === 'guests') return !!draft.guests;
    if (id === 'dates') return !!draft.request;
    if (id === 'note') return !!draft.note;
    return false;
  }
  function anyChange() { return ['details', 'cars', 'eta', 'shop', 'guests', 'note'].some(changed); }

  function bookingCard(v) {
    var st = stand(v.stand), bal = Math.max(0, v.total - v.paid);
    var stt = v.status === 'in' ? ['ok', 'In camp now'] : paidFull(v) ? ['ok', v.finalised ? 'Paid in full · finalised' : 'Paid in full'] : v.paid ? ['warn', 'Waiting for payment · ' + K.money(Math.max(0, v.total - v.paid)) + ' owing'] : ['warn', 'Waiting for payment'];
    return '<div class="mg-booking"><div class="mg-bk-top"><span class="mg-ref">' + esc(v.ref) + '</span><span class="mg-st ' + stt[0] + '">' + stt[1] + '</span></div>' +
      '<h3>' + esc(st.name) + '</h3><p>' + svg('i-cal') + '<span><b>' + esc(nice(v.ci, true)) + '</b> to <b>' + esc(nice(v.co, true)) + '</b> (' + nights(v.ci, v.co) + ' night' + (nights(v.ci, v.co) === 1 ? '' : 's') + ')</span></p>' +
      '<p>' + svg('i-users') + '<span>' + esc(peopleText(v)) + '</span></p>' +
      '<p class="mg-money">Total <b>' + K.money(v.total) + '</b> · Paid <b>' + K.money(v.paid) + '</b> · Still to pay <b>' + K.money(bal) + '</b></p>' +
      (v.claim ? '<p class="mg-claim">' + svg('i-clock') + '<span>You told us you paid <b>' + K.money(v.claim.amt) + '</b> on ' + esc(nice(v.claim.date)) + '. We are checking the bank.</span></p>' : '') +
      '<div class="mg-bk-acts"><button type="button" class="btn btn-light btn-sm" data-inv-open>' + svg('i-doc') + 'View my invoice</button>' + (bal > 0 && !v.claim ? '<button type="button" class="btn btn-green btn-sm" data-inv-open="paid">' + svg('i-check') + 'I have paid</button>' : '') + '</div></div>' +
      (locked(v) ? '<div class="mg-callout">' + svg('i-info') + '<p><b>Your stay starts within ' + balDays() + ' days.</b> To add or remove people now, please WhatsApp or email us.' + (finalMode(v) ? ' You can still finalise everything else here.' : '') + '</p></div>' : '');
  }
  function editor(id) {
    var d = draft;
    if (id === 'details') return '<p class="mg-help-t">We use these to send your invoice, your Dinokeng codes and reminders before your stay.</p>' +
      '<div class="grid-2"><div class="field"><label for="e-first">First name</label><input id="e-first" name="first" value="' + esc(d.first) + '" autocomplete="given-name"></div><div class="field"><label for="e-last">Surname</label><input id="e-last" name="last" value="' + esc(d.last) + '" autocomplete="family-name"></div></div>' +
      '<div class="grid-2"><div class="field"><label for="e-email">Email</label><input id="e-email" name="email" type="email" value="' + esc(d.email) + '" autocomplete="email"></div><div class="field"><label for="e-phone">Mobile number</label><input id="e-phone" name="phone" type="tel" value="' + esc(d.phone) + '" autocomplete="tel"></div></div>';
    if (id === 'cars') {
      var opts = ''; for (var i = 1; i <= 10; i++) opts += '<option value="' + i + '"' + (d.vehicles === i ? ' selected' : '') + '>' + i + ' vehicle' + (i === 1 ? '' : 's') + '</option>';
      return '<p class="mg-help-t">For each vehicle, give the <b>registration</b>, the <b>driver</b> and <b>everyone else in it</b>. Every person in a vehicle signs an indemnity form at the gate, and we send one Dinokeng Conservation Fee Discount Voucher per vehicle, so this makes your arrival much quicker. Fill in what you know; you can come back and add the rest later.</p>' +
        '<div class="field"><label for="e-veh">How many vehicles are coming?</label><select id="e-veh" name="veh">' + opts + '<option value="0"' + (!d.vehicles ? ' selected' : '') + '>Not sure yet, I\'ll tell you later</option></select></div><div class="cars-list" data-cars></div>';
    }
    if (id === 'eta') return '<p class="mg-help-t">Check-in is from 13:00 and check-out is by 11:00. Knowing roughly when you arrive helps us have your stand, firewood and ice ready.</p>' +
      '<div class="field"><label for="e-eta">Roughly when will you arrive?</label><select id="e-eta" name="eta">' + (d.eta ? '' : '<option value="">Choose a time</option>') + ETAS.map(function (t) { return '<option' + (t === d.eta ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></div>';
    if (id === 'shop') return '<p class="mg-help-t">Tap <b>+</b> to add and <b>&minus;</b> to remove. What you order is waiting for you when you arrive and goes on your invoice. Anything else you can buy at the camp shop.</p><div data-shop></div><div class="mg-shop-tot" data-shop-tot></div>';
    if (id === 'guests') {
      if (locked(base)) return '<div class="mg-callout">' + svg('i-info') + '<p><b>Your stay starts on ' + esc(nice(base.ci, true)) + ', so the number of guests can\'t be changed online any more</b> (that closed on ' + esc(nice(lockDate(base))) + ', when everything has to be paid). Please call or WhatsApp us and we will help you.</p></div>' + callUs(base, 'the number of guests');
      var g = draftG(), num = function (n, lab, sub, val) { return '<div class="bw-person"><span><b>' + lab + '</b><small>' + sub + '</small></span><span class="bw-stepper"><button type="button" data-st="' + n + '" data-d="-1" aria-label="One less ' + lab.toLowerCase() + '">&minus;</button><output data-sto="' + n + '">' + val + '</output><button type="button" data-st="' + n + '" data-d="1" aria-label="One more ' + lab.toLowerCase() + '">+</button></span></div>'; };
      return '<p class="mg-help-t">Use <b>+</b> and <b>&minus;</b> to set how many people are coming in total. Now on your booking: <b>' + esc(peopleText(base)) + '</b>.</p>' +
        '<div class="bw-people mg-people">' + num('adults', 'Adults', '12 years and older', g.adults) + num('pens', 'Pensioners', 'South African pensioners', g.pens) + num('kids', 'Children', 'Under 12 years old: free', g.kids) + '</div>' +
        '<div class="mg-plan" data-gplan role="status"></div>';
    }
    if (id === 'dates') {
      if (locked(base)) return '<div class="mg-callout">' + svg('i-info') + '<p><b>Your stay starts on ' + esc(nice(base.ci, true)) + ', so your dates can\'t be changed online any more.</b> Please call or WhatsApp us and we will help you.</p></div>' + callUs(base, 'my dates');
      var r = d.request || {};
      return '<div class="mg-callout">' + svg('i-info') + '<p><b>We check new dates for you.</b> The stand has to be free and the price can change, so we look at it and confirm with you by email or WhatsApp. <b>Your booking stays as it is until we confirm.</b></p></div>' +
        (base.request ? '<p class="mg-help-t">' + svg('i-clock') + ' You already asked for a change' + (base.request.at ? ' on ' + esc(nice(base.request.at.slice(0, 10))) : '') + '. We will be in touch soon. Anything you ask here is added to it.</p>' : '') +
        '<div class="bw-dates"><div class="bw-date"><label for="e-ci"><span class="bw-dn">A</span><span><b>Arriving</b><small>Now: ' + esc(nice(base.ci)) + '</small></span></label><input id="e-ci" type="date" name="ci" min="' + today() + '" value="' + esc(r.ci || base.ci) + '"></div>' +
        '<div class="bw-date"><label for="e-co"><span class="bw-dn">B</span><span><b>Leaving</b><small>Now: ' + esc(nice(base.co)) + '</small></span></label><input id="e-co" type="date" name="co" min="' + today() + '" value="' + esc(r.co || base.co) + '"></div></div>' +
        '<div class="field"><label for="e-msg">Anything else about the change? <span class="opt">(optional)</span></label><textarea id="e-msg" name="msg" rows="3" placeholder="e.g. We would like a stand closer to the pool">' + esc(r.msg || '') + '</textarea></div>';
    }
    if (id === 'note') return '<p class="mg-help-t">Anything else we should know? Celebrating something, a question, or a porta potty (only for the self-sufficient (R) stands)? Write it here and the team will see it on your booking.</p><div class="field"><label for="e-note">Your message</label><textarea id="e-note" name="note" rows="4">' + esc(d.note || '') + '</textarea></div>';
    return '';
  }
  function drawSecs() {
    var pane = $('[data-pane="2"]'), fin = finalMode(base); SECS = secsFor(base);
    pane.innerHTML = '<p class="bw-of">Step 2 of 4</p><h2>' + (fin ? 'Finalise your booking' : 'Amend your booking') + '</h2>' +
      (fin ? '<p class="bw-lead">Your booking is <b>paid in full</b>. Thank you! Now tell us your <b>vehicles and who is in each one</b>, roughly <b>when you arrive</b>, and anything you want waiting from the <b>camp shop</b>. Press <b>Change</b> next to each part; nothing is saved until the last step.' + (base.finalised ? ' <b>You finalised it on ' + esc(nice(base.finalised.at.slice(0, 10))) + '</b>; you can still change anything.' : '') + '</p>'
        : '<p class="bw-lead">Your booking is <b>not paid in full yet</b>. Here you can tell us you have paid (<b>I have paid</b>), change the <b>number of guests</b> or your <b>contact details</b>. Once it is paid in full, this same page lets you <b>finalise</b> it: vehicles, passengers, arrival time and camp shop.</p>') +
      bookingCard(base) +
      '<div class="mg-secs">' + SECS.map(function (s) {
        var on = openSec === s.id, ch = changed(s.id);
        return '<section class="mg-sec' + (on ? ' open' : '') + (ch ? ' changed' : '') + '" data-sec="' + s.id + '"><div class="mg-sec-h"><span class="mg-ic">' + svg(s.ic) + '</span><div class="mg-sec-t"><b>' + s.t + '</b><small>' + summary(s.id, draft) + '</small></div>' +
          (ch && !on ? '<span class="mg-tag">' + svg('i-check') + 'Changed</span>' : '') + (on ? '' : '<button type="button" class="btn btn-ghost btn-sm" data-edit="' + s.id + '">' + svg('i-edit') + (ch ? 'Change again' : 'Change') + '</button>') + '</div>' +
          (on ? '<div class="mg-ed" data-ed>' + editor(s.id) + '<div class="mg-ed-acts">' + ((s.id === 'guests' || s.id === 'dates') && locked(base) ? '<button type="button" class="btn" data-cancel>Close</button>'
            : (ch ? '<button type="button" class="btn btn-ghost btn-sm" data-undo>Undo my changes here</button>' : '<button type="button" class="btn btn-ghost btn-sm" data-cancel>Close without changing</button>') + '<button type="button" class="btn" data-done>' + svg('i-check') + 'Done with this</button>') + '</div></div>' : '') + '</section>';
      }).join('') + '</div>' +
      '<p class="mg-nochange" data-nochange hidden role="status">' + svg('i-info') + 'You have not changed anything yet. Press <b>Change</b> next to what you want to update.</p>' +
      '<p class="mg-small">' + svg('i-cal') + 'Need other dates? <a href="https://wa.me/27604584478?text=' + encodeURIComponent('Hi Kyleu, my booking reference is ' + base.ref + '. I would like to change my dates.') + '" target="_blank" rel="noopener">WhatsApp</a> or <a href="mailto:info@kyleu.co.za?subject=' + encodeURIComponent('Booking ' + base.ref) + '">email</a> us.</p>' +
      '<div class="bw-nav">' + (fromLink ? '<span></span>' : '<button class="btn btn-ghost" type="button" data-back1>' + svg('i-arrow-l') + 'Find another booking</button>') + '<button class="btn" type="button" data-next3>Next: check my changes ' + svg('i-arrow') + '</button></div>';
    wireEditor();
  }
  function wireEditor() {
    var ed = $('[data-ed]'); if (!ed) return;
    if (openSec === 'cars') {
      // finalising: start with one vehicle, the person who booked as its driver
      var startN = draft.vehicles || (finalMode(base) ? 1 : 0), startCars = draft.vehicles || !finalMode(base) ? draft.cars : [{ reg: '', driver: (base.first + ' ' + base.last).trim(), guests: [] }];
      if (!draft.vehicles && startN) $('[name=veh]', ed).value = '1';
      carsEd = K.carsEditor($('[data-cars]', ed), { count: startN, cars: startCars, total: people(draftG()), overText: 'Remove a name, or change the number of guests under "Number of guests" further down.', later: '<b>No problem.</b> Come back here and add them when you know, any time before you arrive. We will remind you closer to the time.' });
      $('[name=veh]', ed).addEventListener('change', function () { carsEd.setCount(+this.value); });
    }
    if (openSec === 'shop') {
      shopQty = clone(draft.shop);
      var tot = function () { var was = shopSum(base.shop), now = shopSum(shopQty), d = price(base, now - was); $('[data-shop-tot]', ed).innerHTML = 'Your shop order: <b>' + K.money(price(base, now)) + '</b>' + (d ? ' <span class="' + (d > 0 ? 'up' : 'down') + '">(' + (d > 0 ? '+' : '&minus;') + K.money(Math.abs(d)) + ' on your invoice)</span>' : ''); };
      K.shopPicker($('[data-shop]', ed), SHOP, shopQty, tot); tot();
    }
    if (openSec === 'guests' && !locked(base)) {
      var gp = function () {
        var g = readG(ed), box = $('[data-gplan]', ed), cap = stand(base.stand).guests || 99, pl = plan(g), same = people(g) === people(base) && g.adults === base.adults && g.pens === base.pens;
        var named = draft.cars.slice(0, draft.vehicles).reduce(function (a, c) { return a + (c.driver ? 1 : 0) + c.guests.length; }, 0);
        box.className = 'mg-plan';
        if (same) { box.innerHTML = svg('i-info') + '<span>No change yet.</span>'; return; }
        if (people(g) > cap) { box.className = 'mg-plan bad'; box.innerHTML = svg('i-info') + '<span><b>' + esc(stand(base.stand).name) + ' fits up to ' + cap + ' people.</b> For a bigger group, please WhatsApp us and we will find you a stand that fits.</span>'; return; }
        box.innerHTML = svg(pl.mode === 'direct' ? 'i-check' : 'i-clock') + '<span>' + (pl.mode === 'direct'
          ? (pl.extra ? '<b>Your booking goes back to "waiting for payment".</b> You have paid in full, so adding people means <b>' + K.money(pl.diff) + ' is owing again</b>. We email you a new invoice for just that amount; pay it by EFT with your reference before you arrive.'
            : pl.diff ? 'Your total changes from <b>' + K.money(base.total) + '</b> to <b>' + K.money(base.total + pl.diff) + '</b>. Your invoice is updated as soon as you save.' : 'The price stays the same (children under 12 are free). We update your booking as soon as you save.')
          : '<b>You have already paid ' + K.money(base.paid) + '</b>, which is more than the new total, so we will contact you about the difference before anything changes. <b>Your booking stays as it is until we confirm.</b>') +
          (named > people(g) ? '<br><b class="mg-bad-t">You named ' + named + ' people in your vehicles. Please remove ' + (named - people(g)) + ' under "Vehicles and who is in each one".</b>' : '') + '</span>';
      };
      $$('[data-st]', ed).forEach(function (b) {
        b.addEventListener('click', function () { var o = $('[data-sto="' + b.dataset.st + '"]', ed), v = Math.max(0, Math.min(20, +o.textContent + +b.dataset.d)); o.textContent = v; gp(); });
      });
      gp();
    }
    var first = $('input, select, textarea, button', ed); if (first && openSec !== 'shop') try { first.focus({ preventScroll: true }); } catch (e) {}
  }
  // copy what is in the open editor into the draft; false when something needs fixing
  function readG(ed) { var g = {}; ['adults', 'pens', 'kids'].forEach(function (n) { g[n] = +$('[data-sto="' + n + '"]', ed).textContent; }); return g; }
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
    if (openSec === 'guests' && !locked(base)) {
      var g = readG(ed);
      if (g.adults + g.pens < 1) return fail('At least one adult needs to be on the booking.');
      if (people(g) > (stand(base.stand).guests || 99)) return fail(stand(base.stand).name + ' fits up to ' + stand(base.stand).guests + ' people. Please WhatsApp us for a bigger stand.');
      draft.guests = g.adults === base.adults && g.pens === base.pens && g.kids === base.kids ? null : g;
    }
    if (openSec === 'dates' && !locked(base)) {
      var r = { ci: val('ci'), co: val('co'), msg: val('msg') };
      if (!r.ci || !r.co || r.co <= r.ci) return fail('The day you leave must be after the day you arrive.');
      draft.request = r.ci === base.ci && r.co === base.co && !r.msg ? null : r;
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
    if (id === 'guests') draft.guests = null;
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
    var gp = d.guests ? plan(d.guests) : null, gDiff = gp && gp.mode === 'direct' ? gp.diff : 0;
    if (gp) blocks.push(['i-users', gp.mode === 'direct' ? 'Number of guests' : 'You are asking us to change the number of guests', row('Guests', esc(peopleText(b)), esc(peopleText(d.guests))) +
      (gp.mode === 'direct' && gp.extra ? '<p class="mg-warn bad">' + svg('i-info') + '<span><b>Your booking goes back to "waiting for payment".</b> Adding people means ' + K.money(gp.diff) + ' is owing again. We email you a new invoice for just that amount.</span></p>' : '<p class="mg-small">' + svg('i-info') + (gp.mode === 'direct' ? 'Your booking and invoice are updated as soon as you save.' : 'You have already paid ' + K.money(b.paid) + ', so we contact you about the difference first. Your booking stays as it is until we confirm.') + '</p>')]);
    if (changed('dates')) { var r = d.request; blocks.push(['i-cal', 'You are asking us to change your dates', (r.ci !== b.ci || r.co !== b.co ? row('Dates', esc(nice(b.ci) + ' to ' + nice(b.co)), esc(nice(r.ci) + ' to ' + nice(r.co))) : '') + (r.msg ? '<p class="mg-quote">"' + esc(r.msg) + '"</p>' : '') + '<p class="mg-small">' + svg('i-info') + 'We check this and confirm with you. Your booking stays as it is until then.</p>']); }
    if (changed('note')) blocks.push(['i-mail', 'Your message for the team', '<p class="mg-quote">"' + esc(d.note) + '"</p>']);
    // the people named in the vehicles must not be more than the guests on the booking
    var tot = people(gp && gp.mode === 'direct' ? d.guests : b), named = d.vehicles ? d.cars.slice(0, d.vehicles).reduce(function (a, c) { return a + (c.driver ? 1 : 0) + c.guests.length; }, 0) : 0;
    var nameWarn = named > tot ? '<p class="mg-warn bad">' + svg('i-info') + '<span><b>The numbers do not match.</b> You named ' + named + ' people in your vehicles, but the booking is for ' + tot + '. Go back and remove ' + (named - tot) + (named - tot === 1 ? ' name' : ' names') + ', or change the number of guests.</span></p>'
      : named && named < tot ? '<p class="mg-warn">' + svg('i-info') + '<span>' + (tot - named) + ' of the ' + tot + ' people on the booking ' + (tot - named === 1 ? 'is' : 'are') + ' not named in a vehicle yet. You can add them later, before you arrive.</span></p>' : '';
    var newTotal = b.total + shopDiff + gDiff, bal = Math.max(0, newTotal - b.paid);
    $('[data-pane="3"]').innerHTML = '<p class="bw-of">Step 3 of 4</p><h2>Check your changes</h2><p class="bw-lead">Read through what will change on booking <b>' + esc(b.ref) + '</b>. If something is not right, go back and fix it.</p>' +
      blocks.map(function (x) { return '<div class="mg-chk"><h3>' + svg(x[0]) + x[1] + '</h3>' + x[2] + '</div>'; }).join('') +
      nameWarn + (shopDiff || gDiff ? '<div class="mg-total"><div><span>Total before</span><b>' + K.money(b.total) + '</b></div>' + (gDiff ? '<div><span>Guests change</span><b class="' + (gDiff > 0 ? 'up' : 'down') + '">' + (gDiff > 0 ? '+' : '&minus;') + K.money(Math.abs(gDiff)) + '</b></div>' : '') + (shopDiff ? '<div><span>Camp shop change</span><b class="' + (shopDiff > 0 ? 'up' : 'down') + '">' + (shopDiff > 0 ? '+' : '&minus;') + K.money(Math.abs(shopDiff)) + '</b></div>' : '') + '<div class="big"><span>New total</span><b>' + K.money(newTotal) + '</b></div><div><span>Paid so far</span><b>' + K.money(b.paid) + '</b></div><div class="big"><span>Still to pay</span><b>' + K.money(bal) + '</b></div></div>' : '') +
      '<p class="mg-nochange">' + svg('i-info') + '<span><b>Nothing is saved yet.</b> Press <b>Save my changes</b> to send them to Kyleu.</span></p>' +
      '<div class="bw-nav"><button class="btn btn-ghost" type="button" data-back2>' + svg('i-arrow-l') + 'Back: make more changes</button><button class="btn" type="button" data-save' + (named > tot ? ' disabled title="Fix the number of people first"' : '') + '>' + svg('i-check') + 'Save my changes</button></div>';
  }

  /* ---------- save ---------- */
  function save() {
    var d = draft, b = base, a = { id: 'a' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), ref: b.ref, at: today() + ' ' + new Date().toTimeString().slice(0, 5), summary: [] };
    if (changed('details')) { a.details = { first: d.first, last: d.last, email: d.email, phone: d.phone }; a.summary.push('contact details'); }
    if (changed('cars')) { a.vehicles = d.vehicles; a.cars = d.cars.slice(0, d.vehicles); a.summary.push('vehicles and passengers'); }
    if (changed('eta')) { a.eta = d.eta; a.summary.push('arrival time ' + (d.eta || 'cleared')); }
    if (changed('shop')) { a.shop = clone(d.shop); a.shopItems = shopList(d.shop); a.shopDiff = price(b, shopSum(d.shop) - shopSum(b.shop)); a.summary.push('camp shop order'); }
    if (changed('guests')) {
      var gp = plan(d.guests);
      a.guests = { adults: d.guests.adults, pens: d.guests.pens, kids: d.guests.kids, mode: gp.mode, diff: gp.mode === 'direct' ? gp.diff : 0, extra: !!gp.extra, paidBefore: b.paid };
      if (gp.mode === 'request') { a.request = { ci: b.ci, co: b.co, msg: '' }; a.summary.push('asked to change the number of guests'); } else a.summary.push('number of guests');
    }
    if (changed('dates')) { a.request = Object.assign(a.request || {}, clone(d.request)); a.summary.push('asked to change the dates'); }
    if (a.request) { var gg = a.guests && a.guests.mode === 'request' ? a.guests : b; a.request.adults = gg.adults; a.request.pens = gg.pens; a.request.kids = gg.kids; a.request.paid = b.paid; }
    if (changed('note')) { a.note = d.note; a.summary.push('a message'); }
    if (finalMode(b) && (a.cars || a.eta != null || a.shop)) { a.finalise = true; a.summary.push('finalised the booking'); }
    var money0 = (a.shopItems ? 1 : 0) + (a.guests && a.guests.mode === 'direct' && a.guests.diff ? 1 : 0);
    if (money0) a.invoice = nextInvoice(b, a);
    var list = read(AMEND, []); list.push(a);
    try { localStorage.setItem(AMEND, JSON.stringify(list.slice(-80))); } catch (e) { K.toast('Your browser could not save the changes. Please WhatsApp us.'); return; }
    var was = clone(base); base = applyAmend(clone(base), a); draft = Object.assign(clone(base), { note: '', request: null, guests: null });
    var bal = Math.max(0, base.total - base.paid), steps = [];
    steps.push('We have let the Kyleu team know' + (base.email ? ' and will email a copy to <b>' + esc(base.email) + '</b>' : '') + '.');
    if (a.shop) steps.push('Your shop order is on your invoice. Your new total is <b>' + K.money(base.total) + '</b>' + (bal ? ' and <b>' + K.money(bal) + '</b> is still to pay' : '') + '. Pay by EFT with reference <b>' + esc(base.ref) + '</b>.');
    if (a.guests && a.guests.mode === 'direct' && !a.guests.extra) steps.push('Your booking is now for <b>' + esc(peopleText(base)) + '</b>' + (a.guests.diff ? ' and your new total is <b>' + K.money(base.total) + '</b>' : '') + '.');
    if (a.request) steps.push('We look at your ' + (a.guests && a.guests.mode === 'request' && changed0(was, a, 'dates') ? 'new dates and number of guests' : a.guests && a.guests.mode === 'request' ? 'new number of guests' : 'new dates') + ' and get back to you by email or WhatsApp, usually within one working day. <b>Your booking stays as it is until we confirm.</b>');
    if (finalMode(base) && (base.vehicles === 0 || base.cars.some(function (c) { return !c.reg || !c.driver; }))) steps.push('Still missing some vehicle details? Come back with the link to your booking any time before ' + esc(nice(base.ci)) + ' to add them.');
    if (a.guests && a.guests.extra) steps.unshift('<b>Your booking is waiting for payment again:</b> ' + K.money(base.total - base.paid) + ' is owing for the added guests. Once it is paid, you can finalise the rest of your booking here.');
    if (a.invoice) steps.unshift('We have emailed your <b>updated invoice</b> to <b>' + esc(base.email) + '</b>. <button type="button" class="link-btn" data-inv-open>View it here</button>.');
    $('[data-pane="4"]').innerHTML = '<div class="success mg-done"><div class="success-badge"><svg class="ring" viewBox="0 0 110 110" fill="none" stroke="#3f7d3a" stroke-width="6" stroke-linecap="round"><circle cx="55" cy="55" r="50"/><path d="M34 57l14 14 28-30"/></svg></div>' +
      '<p class="bw-of">Step 4 of 4</p><h2>' + (a.finalise ? 'Your booking is finalised' : 'Your changes are saved') + '</h2><p class="muted">Booking <b>' + esc(base.ref) + '</b> · ' + esc(stand(base.stand).name) + ' · ' + esc(nice(base.ci)) + ' to ' + esc(nice(base.co)) + '</p>' +
      '<p class="mg-small">You changed: ' + esc(a.summary.join(', ')) + '.</p>' +
      '<ol class="next-steps">' + steps.map(function (t, i) { return '<li><b>' + (i + 1) + '</b><span>' + t + '</span></li>'; }).join('') + '</ol>' +
      '<div class="cta-actions"><button class="btn" type="button" data-again>' + svg('i-edit') + 'Back to my booking</button><a class="btn btn-ghost" href="index.html">Back to the home page</a></div>' +
      '<div class="demo-flag" style="margin:22px 0 0;text-align:left">' + svg('i-info') + '<span>Demo mode: nothing was sent anywhere. The change stays in this browser, so you can see it arrive on the booking in the admin demo.</span></div></div>';
    void was; go(4);
  }

  function changed0(was, a, what) { return what === 'dates' && a.request && (a.request.ci !== was.ci || a.request.co !== was.co || !!a.request.msg); }

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
    Promise.all([K.stands().catch(function () { return []; }), K.prices()]).then(function (r) {
      STANDS = r[0]; P = r[1]; SHOP = K.shopItems(P); demoChips();
      var q = new URLSearchParams(location.search), b = q.get('b'), k = q.get('k');
      if (!b) return;
      var v = allBookings()[key(b)], le = $('[data-link-err]');
      if (!v || !v.key || v.key !== k) { le.hidden = false; le.innerHTML = svg('i-info') + '<span>That link to your booking does not work. Type your reference and email or mobile below, or <a href="https://wa.me/27604584478" target="_blank" rel="noopener">WhatsApp us</a>.</span>'; f.elements.ref.value = String(b).toUpperCase(); return; }
      if (v.status === 'cancelled' || v.co < today() || v.status === 'out') { le.hidden = false; le.innerHTML = svg('i-info') + '<span>' + (v.status === 'cancelled' ? 'Booking <b>' + esc(v.ref) + '</b> was cancelled. Your payment is kept as a credit: WhatsApp us to book new dates.' : 'Your stay on booking <b>' + esc(v.ref) + '</b> is over. We hope you loved the bush!') + '</span>'; return; }
      openBooking(v, true);
    });

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
      openBooking(v, false);
    });
    $('[data-demo]').addEventListener('click', function (e) { var c = e.target.closest('[data-fill]'); if (!c) return; var p = c.dataset.fill.split('|'); f.elements.ref.value = p[0]; f.elements.who.value = p[1]; f.querySelector('[type=submit]').focus(); });

    root.addEventListener('click', function (e) {
      var t = e.target;
      var ed = t.closest('[data-edit]');
      if (ed) { if (openSec && !takeEditor()) { scrollToSec(openSec); return; } openSec = ed.dataset.edit; drawSecs(); scrollToSec(openSec); return; }
      if (t.closest('[data-done]')) { var was = openSec; if (!takeEditor()) return; openSec = ''; drawSecs(); scrollToSec(was); if (changed(was)) K.toast('Got it. You can change something else, or press Next at the bottom.'); return; }
      if (t.closest('[data-cancel]')) { var c0 = openSec; openSec = ''; drawSecs(); scrollToSec(c0); return; }
      if (t.closest('[data-undo]')) { var u = openSec; undo(u); openSec = ''; drawSecs(); scrollToSec(u); K.toast('Put back the way it was'); return; }
      var io_ = t.closest('[data-inv-open]'); if (io_) { var vv = clone(base); vv._paid = io_.dataset.invOpen === 'paid'; vv.claim = base.claim; invModal(vv); return; }
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
