/* =========================================================
   Kyleu staff admin (MOCK-UP)
   - Stands and prices come from /content (same files as the website)
   - Bookings, guests, payments etc. are DEMO data kept only in this
     browser (localStorage). Nothing is sent anywhere.
   - Bookings made on the website demo (stay.html) show up here too.
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu, DAY = 864e5;
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var money = function (n) { return (n < 0 ? '-' : '') + K.money(Math.abs(n || 0)); };
  var KEY = 'kyleu-admin-demo-v1', WEB = 'kyleu-web-bookings', SESS = 'kyleu-admin-user';
  var DB_V = 8;   // version of the demo data: change it when the seed changes, and every browser starts again with new demo data
  var P, STANDS = [], CONTENT_STANDS = [], ORIG_HOL = '{}', DB, ME, app;

  /* ---------- dates (all as YYYY-MM-DD strings) ---------- */
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); }
  function D(s) { var p = s.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function add(s, n) { var d = D(s); d.setDate(d.getDate() + n); return iso(d); }
  function diff(a, b) { return Math.round((D(b) - D(a)) / DAY); }
  var TODAY = iso(new Date());
  function fd(s, o) { return s ? D(s).toLocaleDateString('en-ZA', o || { day: 'numeric', month: 'short' }) : ''; }
  function fdw(s) { return fd(s, { weekday: 'short', day: 'numeric', month: 'short' }); }
  function rel(s) { var n = diff(TODAY, s); return n === 0 ? 'today' : n === 1 ? 'tomorrow' : n === -1 ? 'yesterday' : n > 0 ? 'in ' + n + ' days' : -n + ' days ago'; }
  function nowStamp() { var d = new Date(); return TODAY + ' ' + String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }

  /* ---------- prices (prices.md, with any changes made on the Rates page) ---------- */
  function num(sec, label, d) {
    // saved changes are keyed by the full section title + item label, as shown on the Rates page
    if (DB && DB.rates) { var sk = K.norm(sec), lk = K.norm(label);
      for (var i = 0; i < P.sections.length; i++) { var t = P.sections[i]; if (K.norm(t.title).indexOf(sk) < 0) continue;
        for (var j = 0; j < t.items.length; j++) { var it = t.items[j]; if (K.norm(it.label).indexOf(lk) === 0) { var k = t.title + '|' + it.label; if (DB.rates[k] != null) return DB.rates[k]; } } } }
    return P.num(sec, label, d);
  }
  // "5 days": how long a quotation is valid, counted from the day it was made
  // "5 days, until Friday 14 November": the date makes a resent email still right
  // "quotation" or "invoice INV 1001" for email subjects (no repeat when the document has the booking's own number)
  function docTag(inv, ref) { var k = inv.kind === 'Quote' ? 'quotation' : 'invoice'; return inv.no && inv.no !== ref ? k + ' ' + inv.no : k; }
  function validDays(from, to) { var n = Math.max(1, diff(String(from).slice(0, 10), to)); return n + ' day' + (n === 1 ? '' : 's') + ', until ' + fd(to, { weekday: 'long', day: 'numeric', month: 'long' }); }
  function cardFee() { return num('Booking rules', 'Card payment fee percentage', 3); }
  function toCard(n) { return Math.round(n * (1 + cardFee() / 100)); }
  function hasFee() { return cardFee() > 0; }
  function depPct() { return num('Booking rules', 'Deposit percentage', 50); }
  function standById(id) { return STANDS.filter(function (s) { return s.id === id; })[0] || (DB && DB.gone && DB.gone[id]) || { id: id, name: id, area: 'fenced', guests: 8, photos: [] }; }
  var AREA_SHORT = { fenced: 'Fenced', unfenced: 'Unfenced', 'self-sufficient': 'Self-sufficient' };
  // shop products: from prices.md until staff add, change or remove one here
  function shopSec() { return P.sections.filter(function (s) { return /shop/i.test(s.title); })[0]; }
  function shopItems() {
    if (DB && DB.products) return DB.products;
    var sec = shopSec();
    return (sec ? sec.items : []).map(function (it) { return { label: it.label, amount: num('Camp shop', it.label, it.amount), note: it.note || '' }; });
  }
  function ensureProducts() { if (!DB.products) DB.products = JSON.parse(JSON.stringify(shopItems())); }
  // stands: from stands.md until staff add, change or remove one here
  function ensureStands() { if (!DB.stands) { DB.stands = JSON.parse(JSON.stringify(STANDS)); STANDS = DB.stands; } }
  function imgSrc(p) { return /^(data:|https?:)/.test(p) ? p : '../' + p; }
  function slugify(s) { return K.norm(s).replace(/[^a-z0-9 ]/g, '').trim().replace(/ +/g, '-') || 'stand'; }
  function isWeekendNight(s) { var dow = D(s).getDay(); return (P.wkDays ? P.wkDays.indexOf(dow) >= 0 : dow === 5 || dow === 6 || dow === 0) || !!P.holidays[add(s, 1)]; }
  function quote(standId, ci, co, g, ex) {
    ex = ex || {};
    var st = standById(standId), ss = st.area === 'self-sufficient', sec = ss ? 'Self-sufficient' : 'Ablution stands';
    var R = { wk: num(sec, 'Weekend per person per night', ss ? 180 : 245), wd: num(sec, 'Weekday per person per night', ss ? 100 : 160), pe: num(sec, 'Pensioner weekday per person per night', ss ? 100 : 115) };
    var e = 0, c = 0, n = 0, wkN = 0, lines = [];
    for (var d = ci; d < co; d = add(d, 1)) {
      n++; var dow = D(d).getDay(), wk = isWeekendNight(d); if (wk) wkN++;
      var ad = wk ? R.wk : R.wd, pr = wk ? R.wk : (dow >= 1 && dow <= 4 ? R.pe : R.wd);
      e += g.adults * ad + g.pens * pr; c += g.adults * toCard(ad) + g.pens * toCard(pr);
    }
    lines.push({ t: n + ' night' + (n > 1 ? 's' : '') + ' · ' + (g.adults + g.pens) + ' adult' + (g.adults + g.pens > 1 ? 's' : '') + (g.kids ? ' + ' + g.kids + ' free kid' + (g.kids > 1 ? 's' : '') : '') + (wkN ? ' (' + wkN + ' weekend)' : ''), e: e, c: c });
    var gd3 = num('Game drives', 'Game drive 3 or more people per person', 400), gd2 = num('Game drives', 'Game drive 2 people per person', 450), gd1 = num('Game drives', 'Game drive 1 person', 900);
    if (ex.gd) { var v = ex.gd >= 3 ? ex.gd * gd3 : ex.gd === 2 ? 2 * gd2 : gd1; lines.push({ t: 'Game drive · ' + ex.gd + ' ' + (ex.gd > 1 ? 'people' : 'person'), e: v, c: toCard(v) }); }
    if (ex.pp && ss) { var pv = n * num('Self-sufficient', 'Porta potty hire per night', 100); lines.push({ t: 'Porta potty · ' + n + ' nights', e: pv, c: toCard(pv) }); }
    if (ex.wood) { var wv = ex.wood * num('Camp shop', 'Sekelbos firewood 6kg bag', 25); lines.push({ t: ex.wood + ' × extra firewood', e: wv, c: toCard(wv) }); }
    if (ex.ice) { var iv = ex.ice * num('Camp shop', 'Ice per bag', 15); lines.push({ t: ex.ice + ' × ice', e: iv, c: toCard(iv) }); }
    var eft = lines.reduce(function (a, l) { return a + l.e; }, 0), card = lines.reduce(function (a, l) { return a + l.c; }, 0);
    return { nights: n, wkN: wkN, lines: lines, eft: eft, card: card };
  }

  /* ---------- booking helpers ---------- */
  function paid(b) { return (b.payments || []).reduce(function (a, p) { return a + p.amt; }, 0); }
  function balance(b) { return b.status === 'cancelled' ? 0 : Math.max(0, b.total - paid(b)); }
  function deposit(b) { return payFullOf(b) ? b.total : Math.round(b.total * depPct() / 100); }   // a late booking pays the full amount to secure it
  function depositDue(b) {   // never later than the balance date: a late booking pays in full by then (or straight away)
    var c = b.created.slice(0, 10), d = add(c, num('Booking rules', 'Deposit due within days of invoice', 5)), bd = balanceDue(b), soon = add(c, 1);
    if (soon > b.ci) soon = b.ci;
    return bd < d ? (bd < soon ? soon : bd) : d;   // arriving within a week: the next day (or the arrival day)
  }
  // how long an unpaid booking keeps its stand (Rates & fees > Payment & booking rules)
  function holdRules() { return Object.assign({ skip: 'weekends', popDays: 10 }, (DB && DB.web && DB.web.hold) || {}); }
  function popAt(b) { var a = (b.pops || []).map(function (p) { return p.at || ''; }).filter(Boolean).sort()[0]; return a ? a.slice(0, 10) : ''; }
  function holdOf(b) { return K.quoteHold({ due: depositDue(b), paid: paid(b), claimed: !!(b.paidClaim || b.pop), popAt: popAt(b), today: TODAY, hol: P.holidays, rules: holdRules() }); }
  function keptEnd(d) { return d === TODAY ? 'tonight (midnight)' : 'the end of ' + fdw(d); }
  // b.noRelease = true: Kyleu keeps the stand for this guest even when the quotation is not paid in time (an old friend, a phone booking).
  // Such a booking is never released by itself, here or on the website. Staff can switch it on and off on the booking while it is unpaid.
  var KEPT_TXT = 'Kept for the guest: not released automatically';
  function isKept(b) { return !!b.noRelease && b.status === 'pending'; }
  function payFullOf(b) { return diff(b.created.slice(0, 10), b.ci) <= num('Booking rules', 'Balance due days before arrival', 7) + num('Booking rules', 'Deposit due within days of invoice', 5); }
  function balanceDue(b) { return add(b.ci, -num('Booking rules', 'Balance due days before arrival', 7)); }
  function guestName(b) { return b.guest.first + ' ' + b.guest.last; }
  function bHit(b, q, extra) {
    if (!q) return true;
    var h = (b.ref + ' ' + guestName(b) + ' ' + (b.guest.email || '') + ' ' + (b.guest.phone || '') + ' ' + (extra || '')).toLowerCase();
    if (h.indexOf(q) >= 0) return true;
    var qs = q.replace(/[\s\-()]/g, '').replace(/^\+?27(?=\d{9}$)/, '0'); if (!qs) return false;
    return h.replace(/[\s\-()]/g, '').indexOf(qs) >= 0;
  }
  function people(b) { return b.adults + b.pens + b.kids; }
  // stand sizes: "guests" is the usual number, "max" the most it can ever take. Between the two is Kyleu's call;
  // above the most, the website stops the guest (staff are never blocked here, only warned).
  function standMax(s) { var g = s.guests || 8; return Math.max(g, s.max || Math.ceil(g * 1.25)); }
  function sizeTxt(s) { return 'usually ' + (s.guests || 8) + ', at most ' + standMax(s); }
  function sizePill(s, n) { var g = s.guests || 8, m = standMax(s); return n > m ? ' <span class="pill bad"><i></i>Over the most this stand can take (' + m + ')</span>' : n > g ? ' <span class="pill warn"><i></i>Over the usual ' + g + ' guests</span>' : ''; }
  function openSize(b) { return !!(b.sizeCheck && !b.sizeCheck.done && live(b)); }
  function openCancelReq(b) { return !!(b.cancelReq && !b.cancelReq.done && live(b)); }
  function methodLabel(m) { return m === 'card' ? 'Card' : m === 'cash' ? 'Cash' : m === 'credit' ? 'Credit' : 'EFT'; }
  function stateOf(b) {
    if (b.status === 'cancelled') return { k: 'cancelled', t: 'Cancelled', tone: 'muted' };
    if (b.status === 'out') return { k: 'out', t: 'Departed', tone: 'muted' };
    if (b.status === 'in') return { k: 'in', t: 'In camp', tone: 'ok' };
    if (b.status === 'pending') {
      if (b.softHold && !b.noRelease) return { k: 'soft', t: (b.holdWhy === 'pop' ? 'Proof of payment in' : b.holdWhy === 'claim' ? 'Checking payment' : 'Quotation ran out') + ', kept until ' + fdw(b.softHold), tone: b.holdWhy === 'pop' && diff(TODAY, b.softHold) > 2 ? 'info' : 'bad' };
      if (b.pop) return { k: 'pop', t: 'Proof of payment in', tone: 'info' };
      if (b.noRelease) return { k: 'kept', t: 'Stand kept, not paid yet', tone: 'info' };   // Kyleu keeps the stand for this guest: never released automatically
      if (TODAY > depositDue(b)) return { k: 'overdue', t: 'EFT overdue', tone: 'bad' };
      return { k: 'pending', t: 'Awaiting EFT', tone: 'warn' };
    }
    if (balance(b) <= 0) return { k: 'paid', t: 'Paid in full', tone: 'ok' };
    if (b.onArrival) return { k: 'arrival', t: 'Pays on arrival (' + b.onArrival.how.toLowerCase() + ')', tone: 'info' };   // arranged with Kyleu: no deposit, never released
    if (TODAY > balanceDue(b)) return { k: 'baldue', t: 'Balance overdue', tone: 'bad' };
    if (diff(TODAY, balanceDue(b)) <= 7) return { k: 'baldue', t: 'Balance due ' + fd(balanceDue(b)), tone: 'warn' };
    return { k: 'deposit', t: 'Deposit paid', tone: 'info' };
  }
  function pill(st) { return '<span class="pill ' + st.tone + '"><i></i>' + esc(st.t) + '</span>'; }
  function live(b) { return b.status !== 'cancelled'; }
  function overlaps(standId, ci, co, skipRef) {
    return DB.bookings.some(function (b) { return live(b) && b.ref !== skipRef && b.stand === standId && b.ci < co && ci < b.co; }) ||
      DB.blocks.some(function (k) { return k.stand === standId && k.from < co && ci < k.to; });
  }
  function byRef(ref) { return DB.bookings.filter(function (b) { return b.ref === ref; })[0]; }
  function log(text, ref) { DB.log.unshift({ at: nowStamp(), by: ME ? ME.name : 'System', text: text, ref: ref || '' }); DB.log = DB.log.slice(0, 200); }

  /* ---------- clients: one card per person, linked to all their bookings ---------- */
  function normPhone(p) { var d = String(p || '').replace(/\D/g, ''); if (d.indexOf('27') === 0 && d.length === 11) d = '0' + d.slice(2); return d; }
  function normEmail(e) { return String(e || '').trim().toLowerCase(); }
  function clientName(c) { return (c.first + ' ' + c.last).trim(); }
  function clientById(id) { return (DB.clients || []).filter(function (c) { return c.id === id; })[0]; }
  function findClient(email, phone, skipId) {
    var e = normEmail(email), p = normPhone(phone);
    return DB.clients.filter(function (c) { return c.id !== skipId && ((e && normEmail(c.email) === e) || (p.length >= 9 && (normPhone(c.phone) === p || normPhone(c.phone2) === p))); })[0];
  }
  function newClient(g, at) { var c = { id: uid('cl'), first: g.first || '', last: g.last || '', email: g.email || '', phone: g.phone || '', phone2: g.phone2 || '', town: g.town || '', notes: g.notes || '', consent: !!g.consent, created: at || nowStamp() }; DB.clients.push(c); return c; }
  function clientFor(g, at) { var c = findClient(g.email, g.phone); if (c) { if (g.consent) c.consent = true; return c; } return newClient(g, at); }
  function syncBooking(b) { var c = clientById(b.cid); if (!c) return; b.guest.first = c.first; b.guest.last = c.last; b.guest.email = c.email; b.guest.phone = c.phone; b.guest.consent = c.consent; }
  function linkBooking(b) { if (!b.cid || !clientById(b.cid)) b.cid = clientFor(b.guest, b.created).id; syncBooking(b); }
  function ensureClients() { DB.clients = DB.clients || []; DB.bookings.slice().sort(function (a, b) { return a.created < b.created ? -1 : 1; }).forEach(linkBooking); }
  function clientBookings(c) { return DB.bookings.filter(function (b) { return b.cid === c.id; }).sort(function (a, b) { return a.ci < b.ci ? 1 : -1; }); }
  function clientStats(c) {
    var s = { stays: 0, nights: 0, spent: 0, last: '', next: '', now: false, pens: false, gd: false, refs: [] };
    clientBookings(c).forEach(function (b) {
      s.refs.push(b.ref); if (!live(b)) return;
      s.stays++; s.nights += diff(b.ci, b.co); s.spent += paid(b); if (b.status === 'in') s.now = true; if (b.pens) s.pens = true; if (b.extras && b.extras.gd) s.gd = true;
      if (b.co <= TODAY && b.ci > s.last) s.last = b.ci; if (b.ci >= TODAY && (!s.next || b.ci < s.next)) s.next = b.ci;
    });
    return s;
  }
  // earlier stays by the same client, for the "returning" badge on a booking
  function staysBefore(b) { return DB.bookings.filter(function (x) { return x.cid === b.cid && x !== b && live(x) && x.ci < b.ci; }).length; }
  function nth(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  function retPill(stays, short) { return stays > 1 ? '<span class="pill ok ret">' + ic('return') + (short ? 'Returning' : 'Returning · ' + stays + ' stays') + '</span>' : stays === 1 ? '<span class="pill muted">1 stay</span>' : '<span class="pill info">New client</span>'; }
  function clientChanges(c, v) {
    var L = { first: 'First name', last: 'Surname', email: 'Email', phone: 'Mobile', phone2: 'Other number', town: 'Town', notes: 'Notes', consent: 'Mailing list' }, out = [];
    Object.keys(L).forEach(function (k) {
      if (v[k] === undefined || String(c[k] || '') === String(v[k] || '')) return;
      out.push(k === 'notes' ? 'client notes changed' : k === 'consent' ? (v.consent ? 'joined the mailing list' : 'left the mailing list') : L[k] + ' ' + (c[k] || 'blank') + ' to ' + (v[k] || 'blank'));
    });
    return out;
  }
  function applyClient(c, v) {
    var oldE = normEmail(c.email), newE = normEmail(v.email !== undefined ? v.email : c.email);
    Object.keys(v).forEach(function (k) { c[k] = v[k]; });
    if (oldE && newE && oldE !== newE) {   // credits, vouchers and emails follow the new address
      DB.credits.forEach(function (x) { if (x.email === oldE) x.email = newE; });
      DB.threads.forEach(function (t) { if (normEmail(t.email) === oldE) t.email = c.email; });
    }
    clientBookings(c).forEach(syncBooking);
  }

  /* ---------- demo data ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var FIRST = ['Thandi', 'Johan', 'Lerato', 'Pieter', 'Ayesha', 'Sipho', 'Megan', 'Riaan', 'Naledi', 'Werner', 'Zanele', 'Craig', 'Anika', 'Bongani', 'Chantel', 'Dewald', 'Precious', 'Kobus', 'Fatima', 'Ruan', 'Nomsa', 'Gareth', 'Lindiwe', 'Hendrik', 'Kayla', 'Musa', 'Elmarie', 'Tshepo', 'Jessica', 'Andile', 'Marike', 'Kyle', 'Palesa', 'Jacques', 'Refilwe', 'Ettienne'];
  var LAST = ['Nkosi', 'van der Merwe', 'Mokoena', 'Botha', 'Patel', 'Dlamini', 'Smith', 'Pretorius', 'Khumalo', 'du Plessis', 'Mahlangu', 'Jacobs', 'Venter', 'Ndlovu', 'Steyn', 'Coetzee', 'Molefe', 'Nel', 'Naidoo', 'Kruger', 'Sithole', 'Fourie', 'Mthembu', 'Swanepoel'];
  var SETUPS = ['Rooftop tent', 'Off-road trailer', 'Caravan', 'Ground tent', 'Rooftop tent', 'Off-road trailer'];
  var SOURCES = ['Website', 'Website', 'Website', 'Website', 'WhatsApp', 'WhatsApp', 'Phone', 'Q2B', 'Website', 'Phone'];
  // demo references look like real ones ("KY26 5903": prefix, space, running number, see K.takeNo in invoice.js),
  // but count up from 4101 so they stay well below the real counter (5901 and up) and never meet it.
  // r() is still called once, so the rest of the demo data comes out the same as before.
  var SEED_REF0 = 4101, SEED_REF = SEED_REF0;
  function seedRef(r) { if (r) r(); return 'KY26 ' + (SEED_REF++); }
  // Demo bookings that show a stand kept for the guest (b.noRelease): a phone and a WhatsApp booking by old friends, not paid yet.
  // One has a quotation that ran out days ago and is still there; the other arrives in two days, so the dashboard asks for the
  // indemnity and the Dinokeng codes. Used by the seed and, once, for demo data made before this existed (DB.keepV in migrate()).
  function keptDemo(db, newRef) {
    var d = function (n) { return add(TODAY, n); };
    [{ first: 'Piet', last: 'Venter', phone: '082 771 4420', email: 'piet.venter@mweb.co.za', town: 'Cullinan', ci: d(13), co: d(15), adults: 0, pens: 2, source: 'Phone', created: d(-9), area: 'fenced', setup: 'Caravan', sent: true,
      why: 'Old friend of the camp, booked by phone. Keep his stand: he pays by EFT at the end of the month.', clientNote: 'Old friend of Kyleu. Books by phone and always pays, sometimes a little late.' },
    { first: 'Bets', last: 'Lourens', phone: '083 208 6615', email: '', town: 'Pretoria', ci: d(2), co: d(4), adults: 2, pens: 0, source: 'WhatsApp', created: d(-1), area: 'unfenced', setup: 'Ground tent',
      why: 'Booked on WhatsApp for this week. Keep the stand: she pays by EFT before she comes, or at reception.', clientNote: 'No email address. Everything goes by WhatsApp.' }].forEach(function (o) {
      var st = STANDS.filter(function (x) { return x.area === o.area && !overlaps(x.id, o.ci, o.co); })[0] || STANDS.filter(function (x) { return !overlaps(x.id, o.ci, o.co); })[0]; if (!st) return;
      var g = { adults: o.adults, pens: o.pens, kids: 0 }, q = quote(st.id, o.ci, o.co, g, {}), at = o.created + ' 10:40', sent = { at: at, by: 'Sherri', via: 'WhatsApp' };
      db.bookings.push({ ref: newRef(), created: at, source: o.source, madeBy: 'Sherri', guest: { first: o.first, last: o.last, email: o.email, phone: o.phone, consent: false, notes: o.clientNote, town: o.town }, stand: st.id, ci: o.ci, co: o.co, adults: g.adults, pens: g.pens, kids: 0, vehicles: 1, vehTbc: true, setup: o.setup, extras: {},
        method: 'eft', eft: q.eft, card: q.card, total: q.eft, payments: [], charges: [], status: 'pending', noRelease: true, sends: o.sent ? { doc: sent, link: sent } : {}, toSend: o.sent ? { ind: 1 } : { doc: 1, link: 1, ind: 1 }, pop: false, eta: '',
        notes: [{ at: at, by: 'Sherri', text: o.why }, { at: at, by: 'Sherri', text: 'The stand is kept for the guest: it is not released if the quotation is not paid in time.' }] });
    });
  }
  /* ---------- hand-made demo bookings: every stage of a booking, and the odd ones staff will meet ----------
     Added on top of the random ones, so each screen has something to show (dates move with today). */
  function seedStories(db, r) {
    var d = function (n) { return add(TODAY, n); }, at = function (day, t) { return day + ' ' + (t || '09:00'); };
    var nextDow = function (w, from) { return add(from, (w - D(from).getDay() + 7) % 7); };   // that weekday, on or after "from"
    var sat = nextDow(6, d(1));
    var refOf = function () { return seedRef(r); };
    var prod = function (re) { return db.products.filter(function (p) { return re.test(p.label); })[0]; };
    var free = function (ci, co, area, ppl) { var c = STANDS.filter(function (s) { return (!area || s.area === area) && (s.guests || 8) >= ppl && !overlaps(s.id, ci, co); }); return c[0] || (area ? free(ci, co, null, ppl) : null); };
    var code = function () { return 'DGR' + Math.floor(r() * 2176782336).toString(36).toUpperCase().padStart(6, '0').slice(0, 6); };
    function bk(o) {
      var g = { adults: o.adults == null ? 2 : o.adults, pens: o.pens || 0, kids: o.kids || 0 }, ppl = g.adults + g.pens + g.kids;
      var st = o.stand ? standById(o.stand) : free(o.ci, o.co, o.area, ppl); if (!st || overlaps(st.id, o.ci, o.co)) return null;
      var ex = o.ex || {}, q = quote(st.id, o.ci, o.co, o.priced || g, ex), method = o.method || 'eft';
      var b = { ref: refOf(o.ci), created: o.created || at(add(o.ci, -40), '10:12'), source: o.source || 'Website',
        guest: { first: o.first, last: o.last, email: o.email != null ? o.email : (o.first + '.' + o.last.split(' ').pop()).toLowerCase().replace(/[^a-z.]/g, '') + '@gmail.com', phone: o.phone || '0' + ['82', '83', '72', '79'][Math.floor(r() * 4)] + ' ' + (300 + Math.floor(r() * 600)) + ' ' + (1000 + Math.floor(r() * 8999)), consent: o.consent !== false, notes: o.clientNote || '', town: o.town || '' },
        stand: st.id, ci: o.ci, co: o.co, adults: g.adults, pens: g.pens, kids: g.kids, vehicles: (o.cars || [0]).length, setup: o.setup || 'Rooftop tent', extras: ex,
        method: method, eft: q.eft, card: q.card, total: method === 'card' ? q.card : q.eft, payments: [], charges: [], status: o.status || 'confirmed', notes: [], pop: false, eta: o.eta || '' };
      if (o.created && o.created.length === 10) b.created = at(o.created, '10:12');
      var cday = b.created.slice(0, 10), m = method === 'card' ? 'card' : 'eft', pref = method === 'card' ? 'Card ••' + (1000 + Math.floor(r() * 8999)) : b.ref;
      // a camp shop order made with the booking (part of the total)
      if (o.shop) { var items = {}, e = 0, lbl = []; o.shop.forEach(function (x) { var p = prod(x[0]); if (!p) return; items[p.label] = x[1]; e += p.amount * x[1]; lbl.push(x[1] + ' × ' + p.label); });
        if (e) { b.charges.push({ d: cday, desc: 'Shop order for arrival: ' + lbl.join(', '), e: e, c: toCard(e), pre: true, items: items }); b.eft += e; b.card += toCard(e); b.total = method === 'card' ? b.card : b.eft; } }
      if (o.pay === 'deposit' || o.pay === 'full') {
        var dep = deposit(b), pd = o.payDay || add(cday, method === 'card' ? 0 : 1); if (pd > TODAY) pd = TODAY;
        if (method === 'card' && o.pay === 'full') b.payments.push({ d: pd, amt: b.total, m: 'card', type: 'Full payment', ref: pref });
        else { b.payments.push({ d: pd, amt: dep, m: m, type: dep >= b.total ? 'Full payment' : 'Deposit', ref: pref });
          if (o.pay === 'full' && dep < b.total) { var bd = add(o.ci, -8); if (bd > TODAY) bd = TODAY; if (bd < pd) bd = pd; b.payments.push({ d: bd, amt: b.total - dep, m: m, type: 'Balance', ref: method === 'card' ? 'Card' : pref }); } }
      }
      (o.payments || []).forEach(function (p) { b.payments.push(Object.assign({ m: m, ref: pref }, p)); });
      // vehicles: who is in which car, Dinokeng codes sent, checked in or out
      if (o.cars) b.cars = o.cars.map(function (c, i) {
        var cst = c.st || (b.status === 'in' ? 'in' : b.status === 'out' ? 'out' : 'due'), inAt = cst === 'due' ? '' : c.inAt || o.ci + ' 13:' + (20 + i * 7);
        var x = newCar({ reg: c.reg || '', driver: c.driver || '', phone: i ? '' : b.guest.phone, guests: (c.guests || []).slice(), minors: minorsOf(o.kidNames, c.guests), st: cst, inAt: inAt, outAt: cst === 'out' ? o.co + ' 10:' + (15 + i * 9) : '', ind: cst === 'due' ? null : { at: inAt, by: c.paper ? 'Leuan' : 'Online' } });
        x.people = c.people || (x.driver ? 1 : 0) + x.guests.length;
        if (c.code) { x.dgr = code(); var sent = add(o.ci, -5); if (sent > TODAY) sent = TODAY; if (sent < cday) sent = cday; x.dgrSent = { at: sent + ' 09:10', by: 'Sherri', code: x.dgr }; }
        return x;
      });
      if (b.cars) { b.vehicles = b.cars.length; b.vehSaid = { at: b.created, by: 'Guest' }; }
      else if (b.status !== 'in' && b.status !== 'out') b.vehTbc = true;   // no vehicles in this story: not given yet
      // bought at the camp shop on the vehicle's tab, to settle before leaving
      (o.tab || []).forEach(function (t) { var p = prod(t[1]); if (!p || !b.cars) return; var c = b.cars[t[3] || 0], sid = uid('S');
        b.charges.push({ d: t[0], desc: 'Shop: ' + t[2] + ' × ' + p.label, e: p.amount * t[2], c: toCard(p.amount) * t[2], sid: sid, car: c.id }); b.eft += p.amount * t[2]; b.card += toCard(p.amount) * t[2]; b.total = method === 'card' ? b.card : b.eft;
        db.sales.push({ sid: sid, d: t[0], t: t[4] || '17:40', item: p.label, pid: p.id, qty: t[2], m: 'bill', amt: (method === 'card' ? toCard(p.amount) : p.amount) * t[2], stand: st.name, ref: b.ref, car: c.reg || 'Vehicle 1', by: 'Leuan' }); });
      (o.notes || []).forEach(function (n) { b.notes.push({ at: n[0].length === 10 ? at(n[0], '10:30') : n[0], by: n[1], text: n[2] }); });
      if ((b.status === 'in' || b.status === 'out') && b.cars) { b.finalised = { at: at(add(o.ci, -3), '19:48'), by: 'Guest' }; if (!b.eta) b.eta = '14:00'; }
      if (b.status === 'out' && b.co < add(TODAY, -2)) b.thanks = { at: b.co + ' 11:40', by: 'Sherri', via: 'WhatsApp' };
      if (o.ind) b.demoInd = { mode: o.ind, kids: o.kidNames || [] };
      if (o.then) o.then(b, st);
      db.bookings.push(b); return b;
    }
    var T = function (id, subject, b, msgs) { db.threads.push({ id: id, subject: subject, name: guestName(b), email: b.guest.email, phone: b.guest.phone, status: 'open', unread: true, ref: b.ref, msgs: msgs }); };

    // 1. everything done: paid in full, finalised, everyone signed, codes sent, shop order and a game drive
    bk({ first: 'Hennie', last: 'Botha', ci: d(2), co: d(4), adults: 4, kids: 1, method: 'card', pay: 'full', area: 'fenced', setup: 'Off-road trailer', eta: '16:00', ex: { gd: 5 }, shop: [[/sekelbos/i, 2], [/^ice/i, 2]],
      cars: [{ reg: 'CA 123-456', driver: 'Hennie Botha', guests: ['Marlene Botha', 'Liam Botha'], code: true }, { reg: 'HZ 44 BX GP', driver: 'Pieter Botha', guests: ['Sanet Botha'], code: true }], ind: 'all', kidNames: ['Liam Botha'],
      notes: [[d(-20), 'Sherri', 'Celebrating their 30th wedding anniversary on Saturday. Asked for a quiet stand.']],
      then: function (b) { b.finalised = { at: at(d(-3), '20:14'), by: 'Guest' }; b.drive = { d: d(3), slot: 'am', guide: 'Devon' }; } });
    // 2. paid in full, not finalised yet, not sure how many vehicles
    bk({ first: 'Thabo', last: 'Nkosi', ci: d(4), co: d(7), adults: 3, method: 'eft', pay: 'full', area: 'unfenced', setup: 'Ground tent',
      then: function (b) { b.vehTbc = true; b.vehicles = 1; } });
    // 3. paid in full and finalised, Dinokeng code still to make; her husband has not signed yet
    bk({ first: 'Annelie', last: 'de Villiers', ci: d(6), co: d(8), method: 'eft', pay: 'full', area: 'fenced', eta: '14:00',
      cars: [{ reg: 'CL 77 PP GP', driver: 'Annelie de Villiers', guests: ['Francois de Villiers'] }], ind: 'some',
      then: function (b) { b.finalised = { at: at(d(-1), '18:02'), by: 'Guest' }; } });
    // 4. three vehicles: codes sent for two, the third was added on WhatsApp later
    bk({ first: 'Kagiso', last: 'Molefe', ci: d(5), co: d(7), adults: 6, method: 'card', pay: 'full', area: 'unfenced', source: 'WhatsApp', eta: '16:00',
      cars: [{ reg: 'JHB 552 GP', driver: 'Kagiso Molefe', guests: ['Palesa Molefe'], code: true }, { reg: 'KK 19 LM GP', driver: 'Tumi Sithole', guests: ['Karabo Sithole'], code: true }, { reg: 'ND 456-789', driver: 'Neo Mabaso', guests: ['Lesego Mabaso'] }], ind: 'some',
      notes: [[d(-2), 'Sherri', 'Third vehicle (Neo Mabaso) added on WhatsApp. Dinokeng code still to make for it.']],
      then: function (b) { b.finalised = { at: at(d(-6), '12:40'), by: 'Guest' }; } });
    // 5. arriving today: one car is in, the other comes after work; the balance was never paid
    bk({ first: 'Ruan', last: 'Steyn', ci: TODAY, co: d(3), method: 'eft', pay: 'deposit', area: 'fenced', status: 'in', eta: 'After 18:00', setup: 'Caravan',
      cars: [{ reg: 'BG 31 RS GP', driver: 'Ruan Steyn', st: 'in', inAt: TODAY + ' 11:40', code: true }, { reg: 'FX 08 ES GP', driver: 'Elize Steyn', st: 'due', code: true }], ind: 'some',
      notes: [[TODAY + ' 11:42', 'Leuan', 'Ruan checked in. Elize follows after work, after 18:00: gate code sent to her phone. Balance still to pay: Ruan says he will settle by card before they leave.']] });
    // 6. in camp with firewood and ice on the tab, a game drive still to book
    bk({ first: 'Werner', last: 'Pretorius', ci: d(-1), co: d(2), adults: 2, kids: 2, method: 'card', pay: 'full', area: 'unfenced', status: 'in', ex: { gd: 4 },
      cars: [{ reg: 'WP 99 KR GP', driver: 'Werner Pretorius', guests: ['Leandri Pretorius', 'Ruben Pretorius', 'Mia Pretorius'], code: true }], ind: 'all', kidNames: ['Ruben Pretorius', 'Mia Pretorius'],
      tab: [[d(-1), /sekelbos/i, 2, 0, '17:05'], [TODAY, /^ice/i, 3, 0, '10:20'], [TODAY, /mug/i, 1, 0, '10:21']],
      notes: [[d(-1), 'Leuan', 'Asked about a game drive for the family. Book a time with them.']] });
    // 7. leaving today: a first-time visitor from the UK, everything paid
    bk({ first: 'Sarah', last: 'Mitchell', email: 'sarah.mitchell@btinternet.com', phone: '+44 7700 900123', town: 'Bristol, UK', ci: d(-3), co: TODAY, adults: 2, method: 'card', pay: 'full', area: 'fenced', status: 'in', setup: 'Rooftop tent',
      cars: [{ reg: 'KX 55 TP GP', driver: 'Sarah Mitchell', guests: ['James Mitchell'], code: true }], ind: 'all',
      notes: [[d(-30), 'Sherri', 'First time in Africa. Sent the Dinokeng gate directions and a packing list. Hired a 4x4 with a rooftop tent from Avis.']] });
    // 8. a regular who pays cash on arrival, with two earlier stays
    var koos = { first: 'Koos', last: 'van Zyl', email: 'koosvz@mweb.co.za', phone: '083 412 7781', town: 'Bronkhorstspruit', clientNote: 'Regular since 2019. Pays cash on arrival (arranged with Sherri). Likes the stands on the spruit and brings his own firewood.' };
    bk(Object.assign({}, koos, { ci: d(-150), co: d(-146), adults: 0, pens: 2, area: 'self-sufficient', setup: 'Caravan', method: 'eft', pay: 'full', status: 'out', cars: [{ reg: 'KVZ 1 GP', driver: 'Koos van Zyl', guests: ['Anna van Zyl'] }] }));
    bk(Object.assign({}, koos, { ci: d(-48), co: d(-45), adults: 0, pens: 2, area: 'self-sufficient', setup: 'Caravan', method: 'eft', pay: 'full', status: 'out', cars: [{ reg: 'KVZ 1 GP', driver: 'Koos van Zyl', guests: ['Anna van Zyl'] }], notes: [[d(-45), 'Leuan', 'Left the stand spotless again. Asked to be told when the new spruit stands open.']] }));
    var mon = nextDow(1, d(5));
    bk(Object.assign({}, koos, { ci: mon, co: add(mon, 4), adults: 0, pens: 2, area: 'self-sufficient', setup: 'Caravan', method: 'eft', source: 'Phone', created: d(-9), eta: '13:00', cars: [{ reg: 'KVZ 1 GP', driver: 'Koos van Zyl', guests: ['Anna van Zyl'] }],
      then: function (b) { b.madeBy = 'Sherri'; b.onArrival = { how: 'Cash', at: at(d(-9), '11:05'), by: 'Sherri' }; b.notes.push({ at: at(d(-9), '11:05'), by: 'Sherri', text: 'Booked by phone. Pays cash on arrival as always.' }); } }));
    // 9. a long stay: 12 nights on the spruit, balance in two parts
    bk({ first: 'Gerrit', last: 'Fourie', ci: d(10), co: d(22), adults: 0, pens: 2, area: 'self-sufficient', setup: 'Caravan', method: 'eft', pay: 'deposit', ex: { pp: 1 }, town: 'Polokwane',
      notes: [[d(-25), 'Sherri', 'Long stay: 12 nights. Agreed they pay the balance in two parts, half now and half on arrival.']],
      payments: [{ d: d(-6), amt: 1500, type: 'Part of the balance' }] });
    // 10. a big family on the biggest stand, deposit paid by card
    bk({ first: 'Sibusiso', last: 'Khumalo', ci: d(12), co: d(14), adults: 2, kids: 4, method: 'card', pay: 'deposit', area: 'unfenced', setup: 'Ground tent',
      notes: [[d(-14), 'Guest', 'Our kids are 3, 7, 10 and 14. Is there space for two big tents?'], [d(-14), 'Kyran', 'Replied: yes, the stand fits two large tents. Children under 12 stay free.']] });
    // 11. a family reunion over three stands, one organiser
    var reu = nextDow(5, d(19)), reuIds = [];
    ['A', 'B', 'C'].forEach(function (x, i) {
      var b = bk({ first: 'Marisa', last: 'Bekker', email: 'marisa.bekker@outlook.com', phone: '082 640 1188', ci: reu, co: add(reu, 2), adults: i ? 2 : 3, kids: i === 1 ? 2 : 0, area: 'unfenced', method: 'eft', pay: 'deposit', source: 'Phone', created: d(-16), setup: i === 2 ? 'Caravan' : 'Rooftop tent' });
      if (b) reuIds.push(b);
    });
    reuIds.forEach(function (b, i) { b.notes.push({ at: at(d(-16), '14:20'), by: 'Sherri', text: 'Bekker family reunion, stand ' + (i + 1) + ' of ' + reuIds.length + ' (' + reuIds.map(function (x) { return x.ref; }).join(', ') + '). Marisa pays for all of them. Put them next to each other.' }); });
    // 12. Saturday night only: an exception to the 2-night weekend rule
    bk({ first: 'Lindiwe', last: 'Zulu', ci: sat, co: add(sat, 1), method: 'card', pay: 'full', area: 'fenced', source: 'Phone', created: d(-3),
      cars: [{ reg: 'LZ 12 WED GP', driver: 'Lindiwe Zulu', guests: ['Sizwe Zulu'] }],
      notes: [[d(-3), 'Sherri', 'Saturday night only. The website asks for 2 nights over a weekend; I allowed 1 night as an exception (they are at a wedding nearby on Saturday).']] });
    // 13. booked this morning for tonight
    bk({ first: 'Jaco', last: 'Lombard', ci: TODAY, co: d(1), adults: 1, method: 'card', pay: 'full', area: 'unfenced', created: at(TODAY, '07:05'), eta: 'After 18:00', setup: 'Rooftop tent',
      cars: [{ reg: 'JL 07 OFF GP', driver: 'Jaco Lombard' }], ind: 'none',
      notes: [[TODAY + ' 07:06', 'Guest', 'Spontaneous trip! I will arrive around 19:00, is that ok?']] });
    // 14. no email: booked by phone, everything goes by WhatsApp
    bk({ first: 'Sannie', last: 'Erasmus', email: '', phone: '083 555 0101', consent: false, ci: d(9), co: d(11), adults: 0, pens: 2, method: 'eft', pay: 'deposit', area: 'fenced', source: 'Phone', setup: 'Caravan',
      clientNote: 'No email address. Send quotations, codes and reminders by WhatsApp.', notes: [[d(-20), 'Sherri', 'No email address: sent the quotation and bank details by WhatsApp.']] });
    // 15. booked for someone else, invoice to a company
    bk({ first: 'Ruan', last: 'Kruger', email: 'ruan.kruger@gmail.com', phone: '076 145 2290', ci: d(15), co: d(17), method: 'eft', pay: 'deposit', area: 'fenced', created: d(-3),
      cars: [{ reg: 'DP 88 KL GP', driver: 'Devan Pillay', guests: ['Nisha Pillay'] }],
      notes: [[d(-2), 'Sherri', 'Invoice made out to Kruger Logistics (Pty) Ltd, VAT 4123456789. Ruan booked it for his manager, Devan Pillay, who is the one coming.']] });
    // 16. quotation runs out on a Saturday: kept until the end of Monday
    var nDue = sat, nCre = add(nDue, -5); if (nCre > TODAY) nCre = TODAY;
    bk({ first: 'Nadia', last: 'Fourie', ci: add(sat, 21), co: add(sat, 23), method: 'eft', status: 'pending', area: 'unfenced', created: nCre });
    // 17. proof of payment uploaded after the quotation ran out: kept while Kyleu checks
    bk({ first: 'Bongani', last: 'Dlamini', ci: d(18), co: d(20), method: 'eft', status: 'pending', area: 'fenced', created: d(-7),
      notes: [[d(-3) + ' 20:44', 'Guest', 'Paid from my wife\'s account, the reference might say N Dlamini.']],
      then: function (b) { b.pop = true; b.pops = [{ name: 'FNB-payment-' + b.ref.replace(/\s/g, '') + '.jpg', size: 184220, type: 'image/jpeg', data: '', at: d(-3) + ' 20:41', via: 'Website upload' }]; } });
    // 18. "I have paid" this morning, the quotation runs out today
    bk({ first: 'Chantel', last: 'Jacobs', ci: d(25), co: d(27), method: 'eft', status: 'pending', area: 'unfenced', created: d(-5),
      then: function (b) { b.pop = true; b.paidClaim = { id: 'pdemo1', ref: b.ref, at: TODAY + ' 07:30', date: d(-1), amt: deposit(b), what: 'Deposit', note: '' }; b.notes.push({ at: TODAY + ' 07:30', by: 'Guest', text: 'Says they paid ' + money(deposit(b)) + ' (deposit) on ' + fd(d(-1)) + '.' }); } });
    // 19. released by itself: the quotation was never paid
    bk({ first: 'Craig', last: 'Daniels', ci: d(14), co: d(16), method: 'eft', status: 'cancelled', area: 'unfenced', created: d(-12),
      then: function (b) { b.released = { at: d(-6) + ' 00:05', due: d(-7) }; b.notes.push({ at: d(-6) + ' 00:05', by: 'System', text: 'Stand released automatically: the quotation was valid until ' + fd(d(-7)) + ' and no payment came in.' }); } });
    // 20. cancelled late: the deposit kept as credit for another stay
    bk({ first: 'Megan', last: 'Smit', ci: d(7), co: d(9), method: 'eft', pay: 'deposit', area: 'fenced', status: 'cancelled', created: d(-35),
      notes: [[d(-10), 'Sherri', 'Cancelled 17 days before arrival because of a family emergency. Kept the deposit as credit for another stay.']],
      then: function (b) { db.credits.push(creditFix({ id: 'c-smit', email: b.guest.email, name: guestName(b), amt: paid(b), used: 0, from: b.ref, d: d(-10) }, db.credits)); } });
    // 21. two more adults added after paying in full: money outstanding again
    bk({ first: 'Pieter', last: 'Swart', ci: d(9), co: d(11), adults: 4, priced: { adults: 2, pens: 0, kids: 0 }, method: 'eft', pay: 'full', area: 'unfenced',
      then: function (b) { var q = quote(b.stand, b.ci, b.co, b, b.extras), add2 = q.eft - b.eft; b.eft = q.eft; b.card = q.card; b.total = b.eft;
        b.extraDue = { at: d(-1) + ' 19:22', amt: add2, why: 'Guests added after paying in full' };
        b.notes.push({ at: d(-1) + ' 19:22', by: 'Guest', text: 'Added my sister and her husband. They share our stand.' }); } });
    // 22. asked to move the dates a week later
    bk({ first: 'Riaan', last: 'du Toit', ci: d(16), co: d(18), method: 'eft', pay: 'deposit', area: 'fenced',
      then: function (b) { b.changeReq = { at: d(-1) + ' 21:10', ci: d(23), co: d(25), adults: 2, pens: 0, kids: 0, msg: 'My work trip moved. Can we shift a week later?' };
        T('tdemo-chg', 'Change request: ' + b.ref, b, [{ from: 'guest', at: d(-1) + ' 21:10', body: 'Please change my booking ' + b.ref + ':\n\nDates: ' + fd(b.ci) + ' to ' + fd(b.co) + ', please change to ' + fd(d(23)) + ' to ' + fd(d(25)) + '\nGuests: 2 adults (no change)\n\nMy work trip moved. Can we shift a week later?\n\nRiaan', att: [] }]); } });
    // 23. paid from Germany: the deposit arrived short because of bank charges
    bk({ first: 'Hans', last: 'Müller', email: 'hans.mueller@web.de', phone: '+49 151 2345 6789', town: 'Munich, Germany', ci: d(30), co: d(35), method: 'eft', area: 'unfenced', setup: 'Rooftop tent', created: d(-20),
      then: function (b) { var dep = deposit(b); b.payments.push({ d: d(-14), amt: dep - 285, m: 'eft', type: 'Deposit', ref: b.ref });
        b.notes.push({ at: d(-14) + ' 10:05', by: 'Sherri', text: 'International transfer arrived R285 short because of bank charges. Told Hans to add it to the balance.' });
        T('tdemo-intl', 'Deposit from Germany', b, [{ from: 'guest', at: d(-15) + ' 16:20', body: 'Hello,\n\nI have sent the deposit by SWIFT today. Please let me know when it arrives.\n\nBest regards,\nHans', att: [{ name: 'SWIFT-confirmation.pdf', size: 48210, type: 'application/pdf' }] }, { from: 'staff', by: 'Sherri', at: d(-14) + ' 10:08', body: 'Hi Hans,\n\nIt arrived, thank you! Your bank took R285 in charges, so please add that to the balance.\n\nSherri\nKyleu Bush Camp', att: [] }]); } });
    // 24. the vehicles list more people than were booked
    bk({ first: 'Lerato', last: 'Mahlangu', ci: d(3), co: d(5), adults: 3, method: 'card', pay: 'full', area: 'fenced', eta: '14:00',
      cars: [{ reg: 'LM 21 AB GP', driver: 'Lerato Mahlangu', guests: ['Thandeka Mahlangu', 'Zinhle Mahlangu', 'Ayanda Mahlangu'], code: true }], ind: 'some',
      then: function (b) { b.finalised = { at: at(d(-2), '09:40'), by: 'Guest' }; } });
    // 25. paid twice by mistake: the second payment refunded
    bk({ first: 'Johan', last: 'Botes', ci: d(11), co: d(13), method: 'card', pay: 'full', area: 'unfenced',
      then: function (b) { b.payments.push({ d: d(-4), amt: b.total, m: 'eft', type: 'Payment', ref: b.ref }); b.payments.push({ d: d(-2), amt: -b.total, m: 'eft', type: 'Refund', ref: b.ref });
        b.notes.push({ at: d(-2) + ' 11:15', by: 'Sherri', text: 'Paid by card and again by EFT by mistake. Refunded the EFT payment.' }); } });
    // 26. finalised and arriving tomorrow, but nobody has signed the indemnity
    bk({ first: 'Sipho', last: 'Ndlovu', ci: d(1), co: d(3), adults: 2, kids: 1, method: 'card', pay: 'full', area: 'unfenced', eta: '14:00',
      cars: [{ reg: 'SN 64 ZZ GP', driver: 'Sipho Ndlovu', guests: ['Nomsa Ndlovu', 'Lwazi Ndlovu'], code: true }], ind: 'none',
      then: function (b) { b.finalised = { at: at(d(-4), '21:30'), by: 'Guest' }; } });
    // 27. left two days ago: forgot a chair, left a review
    bk({ first: 'Ayesha', last: 'Patel', ci: d(-4), co: d(-2), method: 'card', pay: 'full', area: 'fenced', status: 'out',
      cars: [{ reg: 'AP 10 XY GP', driver: 'Ayesha Patel', guests: ['Imran Patel'] }], ind: 'all',
      notes: [[d(-2), 'Leuan', 'Forgot a blue camping chair at the stand: kept at reception. Collecting it on Saturday.'], [d(-1), 'Sherri', 'Left a 5-star Google review.']] });
    // 28. a stand moved because of the geyser repair
    bk({ first: 'Elsabé', last: 'Coetzee', ci: d(4), co: d(6), method: 'eft', pay: 'full', area: 'fenced',
      notes: [[d(-5), 'Kyran', 'Moved from another stand because its geyser is being replaced. Told Elsabé by WhatsApp; she is happy.']] });
    // 29 and 30. old friends booked by phone and WhatsApp: not paid yet, the stand is kept for them (never released automatically)
    keptDemo(db, refOf);
  }
  function seed() {
    var r = rng(2611), pick = function (a) { return a[Math.floor(r() * a.length)]; };
    SEED_REF = SEED_REF0;
    var db = { v: DB_V, seeded: TODAY, vouchers: [], credits: [], gone: {}, threads: [], hol: { add: {}, del: {} }, popSeen: {}, bookings: [], blocks: [], sales: [], log: [], rates: {}, closed: {}, settings: { providerFee: 2.95 }, readEnq: {} };
    var guests = [];
    for (var i = 0; i < 420; i++) {
      var f = pick(FIRST), l = pick(LAST);
      guests.push({ first: f, last: l, email: (f + '.' + l.split(' ').pop()).toLowerCase() + '@' + pick(['gmail.com', 'outlook.com', 'icloud.com', 'mweb.co.za', 'yahoo.com']), phone: '0' + pick(['82', '83', '72', '76', '79', '61', '84']) + ' ' + Math.floor(100 + r() * 899) + ' ' + Math.floor(1000 + r() * 8999), consent: r() > .3 });
    }
    db.blocks.push({ id: 'b1', stand: STANDS[10] ? STANDS[10].id : 'stand-4', from: add(TODAY, 3), to: add(TODAY, 6), reason: 'Geyser being replaced' });
    var last = STANDS[STANDS.length - 1];
    if (last) db.blocks.push({ id: 'b2', stand: last.id, from: add(TODAY, 12), to: add(TODAY, 15), reason: 'Owner hold: family visiting' });
    var fri = add(TODAY, -((D(TODAY).getDay() + 2) % 7));   // Friday on or before today
    function make(st, ci, co, opts) {
      opts = opts || {};
      if (co <= ci || overlaps(st.id, ci, co) ) return null;
      var g = r() < .12 ? guests[Math.floor(r() * 8)] : pick(guests);   // a few returning guests
      var adults = r() < .62 ? 2 : r() < .7 ? (r() < .5 ? 3 : 4) : 1, pens = 0, kids = r() < .5 ? Math.floor(r() * 3) + 1 : 0;
      if (r() < .1) { pens = adults; adults = 0; }
      while (adults + pens + kids > st.guests) kids--;
      var ex = {}; if (r() < .25) ex.gd = 2 + Math.floor(r() * 3); if (r() < .3) ex.wood = 1 + Math.floor(r() * 4); if (r() < .15) ex.ice = 1 + Math.floor(r() * 3); if (st.area === 'self-sufficient' && r() < .3) ex.pp = 1;
      var q = quote(st.id, ci, co, { adults: adults, pens: pens, kids: kids }, ex);
      var lead = 2 + Math.floor(r() * r() * 110), created = add(ci, -lead); if (created > TODAY) created = add(TODAY, -Math.floor(r() * Math.min(60, 4 + diff(TODAY, ci))));
      if (opts.created) created = opts.created;
      var method = r() < .55 ? 'card' : 'eft';
      var b = { ref: seedRef(r), created: created + ' ' + String(7 + Math.floor(r() * 13)).padStart(2, '0') + ':' + String(Math.floor(r() * 60)).padStart(2, '0'),
        source: pick(SOURCES), guest: { first: g.first, last: g.last, email: g.email, phone: g.phone, consent: g.consent }, stand: st.id, ci: ci, co: co, adults: adults, pens: pens, kids: kids, vehicles: r() < .8 ? 1 : 2, setup: pick(SETUPS), extras: ex,
        method: method, eft: q.eft, card: q.card, total: method === 'card' ? q.card : q.eft, payments: [], status: 'confirmed', notes: [], pop: false };
      var dep = Math.round(b.total * depPct() / 100), payRef = b.ref;
      var cday = created.slice(0, 10), daysAgo = diff(cday, TODAY);
      if (method === 'card') {
        if (r() < .3) b.payments.push({ d: cday, amt: b.total, m: 'card', type: 'Full payment', ref: 'Card ••' + Math.floor(1000 + r() * 8999) });
        else b.payments.push({ d: cday, amt: dep, m: 'card', type: 'Deposit', ref: 'Card ••' + Math.floor(1000 + r() * 8999) });
      } else {
        var waitEft = opts.pending || (daysAgo <= 4 && ci > TODAY && r() < .4);
        if (waitEft) { b.status = 'pending'; b.pop = !opts.overdue && r() < .3; }
        else b.payments.push({ d: add(cday, Math.min(daysAgo, 1 + Math.floor(r() * 3))), amt: dep, m: 'eft', type: 'Deposit', ref: payRef });
      }
      // balances
      if (b.status !== 'pending' && paid(b) < b.total) {
        var bd = add(ci, -7);
        if (co <= TODAY || ci <= TODAY || (bd <= TODAY && r() < .65)) b.payments.push({ d: bd < cday ? cday : (bd > TODAY ? TODAY : bd), amt: b.total - paid(b), m: method === 'card' ? 'card' : 'eft', type: 'Balance', ref: method === 'card' ? 'Card' : payRef });
      }
      if (co < TODAY || (co === TODAY && r() < .4)) b.status = b.status === 'pending' ? 'cancelled' : 'out';
      if (b.status === 'out' && r() < .05) { b.status = 'cancelled'; b.notes.push({ at: cday, by: 'Kyran', text: 'Cancelled more than 14 days before arrival. Deposit refunded.' }); b.payments = b.payments.slice(0, 1); b.payments.push({ d: add(cday, 3), amt: -b.payments[0].amt, m: b.payments[0].m, type: 'Refund', ref: payRef }); }
      else if (ci < TODAY && b.status !== 'pending' && b.status !== 'out') b.status = 'in';
      if (b.status !== 'in' && b.status !== 'out' && ci > TODAY && r() < .05) { b.status = 'cancelled'; b.notes.push({ at: cday, by: 'Sherri', text: 'Guest cancelled by email more than 14 days before arrival. Deposit refunded.' }); if (paid(b)) b.payments.push({ d: add(cday, 2), amt: -paid(b), m: b.payments[0].m, type: 'Refund', ref: payRef }); }
      if (opts.overdue) { b.status = 'pending'; b.payments = []; b.pop = false; }
      if (r() < .2 && b.status !== 'cancelled') b.notes.push({ at: cday, by: pick(['Sherri', 'Devon', 'Kyran']), text: pick(['Celebrating a birthday on Saturday.', 'Asked for a stand close to the pool.', 'Arriving late, after 18:00. Gate code sent.', 'Bringing a 6 m off-road trailer.', 'First time in Dinokeng: sent gate directions.', 'Regulars, they love Stand 3.', 'Asked for a late check-out on Sunday: approved until 13:00.', 'Low-slung sedan: told them which roads to avoid after rain.', 'Photographer: asked about the best time for the waterhole.', 'Booked through Q2B before the new website.', 'Gluten-free: asked where to buy food on the way in.', 'Bringing a gas fridge. Reminded them there is no electricity.']) });
      db.bookings.push(b); return b;
    }
    // overlaps() reads DB, so point DB at the new data while seeding
    DB = db;
    STANDS.forEach(function (st) {
      for (var w = -26; w <= 10; w++) {
        var f = add(fri, w * 7), mo = D(f).getMonth(), dec = mo === 11, winter = mo >= 5 && mo <= 7;
        var p = (w < 0 ? .62 : w < 3 ? .55 : w < 6 ? .4 : .22) + (dec ? .25 : 0) - (winter ? .2 : 0);
        if (r() < p) { var ci = r() < .15 ? add(f, -1) : f, co = r() < .2 ? add(f, 3) : add(f, 2); make(st, ci, co); }
        if (r() < (w < 2 ? .16 : .08)) { var m = add(f, 3 + Math.floor(r() * 2)); make(st, m, add(m, 1 + Math.floor(r() * 2))); }
      }
    });
    // make sure "today" has some arrivals and departures to show
    var free = STANDS.filter(function (s) { return !overlaps(s.id, TODAY, add(TODAY, 1)); });
    free.slice(0, 3).forEach(function (s) { var b = make(s, TODAY, add(TODAY, 2)); if (b && b.status === 'pending') { b.status = 'confirmed'; b.payments.push({ d: add(TODAY, -3), amt: deposit(b), m: b.method, type: 'Deposit', ref: b.ref }); } });
    STANDS.filter(function (s) { return !overlaps(s.id, add(TODAY, -2), TODAY); }).slice(0, 3).forEach(function (s) { var b = make(s, add(TODAY, -2), TODAY); if (b) { b.status = 'in'; if (paid(b) < b.total) b.payments.push({ d: add(TODAY, -2), amt: b.total - paid(b), m: b.method === 'card' ? 'card' : 'eft', type: 'Balance', ref: b.ref }); } });
    // a couple of EFT bookings that never paid (past the 5 days)
    STANDS.slice(4).filter(function (s) { return !overlaps(s.id, add(fri, 21), add(fri, 23)); }).slice(0, 2).forEach(function (s) { var b = make(s, add(fri, 21), add(fri, 23), { created: add(TODAY, -8), overdue: true }); if (b) { b.method = 'eft'; b.total = b.eft; } });
    // and a few fresh EFT requests waiting for payment
    STANDS.slice(8).filter(function (s) { return !overlaps(s.id, add(fri, 14), add(fri, 16)); }).slice(0, 3).forEach(function (s, i) { var b = make(s, add(fri, 14), add(fri, 16), { created: add(TODAY, -i), pending: true }); if (b) { b.method = 'eft'; b.total = b.eft; b.status = 'pending'; b.payments = []; b.pop = i === 0; } });
    db.bookings.sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    // game drive times: most are already scheduled, a few still need one
    db.bookings.forEach(function (b) {
      if (!b.extras || !b.extras.gd || b.status === 'cancelled') return;
      if (b.co <= TODAY || r() < .88) { var nn = Math.max(1, diff(b.ci, b.co)); b.drive = { d: add(b.ci, Math.floor(r() * nn) + (r() < .5 ? 1 : 0)), slot: r() < .55 ? 'am' : 'pm', guide: pick(['Devon', 'Kyran']) }; if (b.drive.d > b.co) b.drive.d = b.co; }
    });
    // the shop: products with stock, and six months of sales (each sale can hold a few items)
    db.products = defaultProducts();
    var prods = db.products, wts = prods.map(function (p) { return /sekelbos/i.test(p.label) ? 6 : /ice/i.test(p.label) ? 5 : /long-burning/i.test(p.label) ? 2 : /firelighter/i.test(p.label) ? 3 : /mug|sticker/i.test(p.label) ? 1 : .6; });
    var wsum = wts.reduce(function (a, w) { return a + w; }, 0);
    var pickProd = function () { var x = r() * wsum; for (var i = 0; i < prods.length; i++) { x -= wts[i]; if (x <= 0) return prods[i]; } return prods[0]; };
    var sn = 0, nowH = new Date().getHours();
    for (var dd = -182; dd <= 0; dd++) {
      var day = add(TODAY, dd), dow = D(day).getDay(), here = standsBookedOn(day), ids = Object.keys(here);
      var nSales = 1 + Math.floor(r() * 3) + (dow === 5 || dow === 6 || dow === 0 ? 2 : 0);
      if (dd === 0) nSales = nowH < 9 ? 0 : Math.min(nSales, 1 + Math.floor((nowH - 8) / 4));
      for (var s = 0; s < nSales; s++) {
        var bk = ids.length && r() < .75 ? here[ids[Math.floor(r() * ids.length)]] : null, m = r() < .5 ? 'card' : 'cash';
        var hr = dd === 0 ? 8 + Math.floor(r() * Math.max(1, nowH - 8)) : 8 + Math.floor(r() * 11), t = String(hr).padStart(2, '0') + ':' + String(Math.floor(r() * 60)).padStart(2, '0');
        var sid = 'S' + (++sn), nl = r() < .7 ? 1 : 2, used = {}, by = pick(['Leuan', 'Leuan', 'Kyran', 'Sherri']);
        for (var li = 0; li < nl; li++) {
          var it = pickProd(); if (used[it.id]) continue; used[it.id] = 1;
          var qty = 1 + Math.floor(r() * (it.amount <= 40 ? 3 : 1));
          db.sales.push({ sid: sid, d: day, t: t, item: it.label, pid: it.id, qty: qty, m: m, amt: (m === 'card' ? toCard(it.amount) : it.amount) * qty, stand: bk ? standById(bk.stand).name : '', ref: bk ? bk.ref : '', by: by });
        }
      }
    }
    db.sales.sort(function (a, b) { return (a.d + a.t) < (b.d + b.t) ? -1 : 1; });
    // one guest uploaded proof of payment on the website, another emailed it
    db.bookings.filter(function (b) { return b.status === 'pending' && b.pop; }).forEach(function (b, i) {
      var bank = ['Capitec', 'FNB', 'Standard-Bank', 'Absa', 'Nedbank'][i % 5];
      b.pops = [{ name: bank + '-payment-' + b.ref.replace(/\s/g, '') + (i % 2 ? '.pdf' : '.jpg'), size: 90000 + Math.floor(r() * 180000), type: i % 2 ? 'application/pdf' : 'image/jpeg', data: '', at: add(TODAY, -1 - (i % 2)) + ' ' + (17 + i % 5) + ':' + String(10 + i * 7 % 50), via: 'Website upload' }];
    });
    var mailB = db.bookings.filter(function (b) { return b.status === 'pending' && !b.pop; })[0];
    // email conversations: guest messages and staff replies kept together
    var y1 = add(TODAY, -1), y2 = add(TODAY, -2), y3 = add(TODAY, -3), y4 = add(TODAY, -4), y6 = add(TODAY, -6);
    var G = function (at, body, att) { return { from: 'guest', at: at, body: body, att: att || [] }; }, St = function (by, at, body, att) { return { from: 'staff', by: by, at: at, body: body + '\n\n' + by + '\nKyleu Bush Camp', att: att || [] }; };
    var T = function (id, subject, name, email, phone, status, unread, msgs, ref) { return { id: id, subject: subject, name: name, email: email, phone: phone, status: status, unread: unread, ref: ref || '', msgs: msgs }; };
    db.threads = [
      T('t1', 'Group booking, 4 stands', 'Marike Venter', 'marike.venter@gmail.com', '082 555 0192', 'open', true, [G(TODAY + ' 07:14', 'Hi!\n\nWe are 4 families (8 adults, 9 kids) looking at the 16 December long weekend. Can we get 4 stands next to each other in the unfenced camp?\n\nThanks,\nMarike')]),
      T('t2', 'Game drive for 6', 'Tshepo Molefe', 'tshepo.m@outlook.com', '072 410 8821', 'open', true, [G(y1 + ' 19:40', 'Good evening,\n\nWe are staying at Inside 4 in two weeks. Can we book a game drive for 6 people on the Saturday morning?\n\nTshepo'), St('Kyran', TODAY + ' 06:31', 'Hi Tshepo,\n\nSaturday morning works well. The drive leaves reception at 06:00 and takes about 2 hours. For 6 people it is R400 per person, R2 400 in total.\n\nShall I add it to your booking?'), G(TODAY + ' 07:52', 'Perfect, please add it. Can we pay for it with the balance?\n\nThanks!')]),
      T('t4', 'Pensioner rate', 'Elmarie Nel', 'elmarie.nel@mweb.co.za', '083 300 1177', 'waiting', false, [G(y1 + ' 11:05', 'Goeie dag,\n\nIs the pensioner rate valid for a Sunday night as well, or only Monday to Thursday?\n\nElmarie'), St('Sherri', y1 + ' 12:20', 'Goeie dag Elmarie,\n\nThe pensioner rate is for Monday to Thursday nights. Sunday nights are charged at the normal weekday rate.\n\nKind regards')]),
      T('t5', 'Invoice for my company', 'Ruan Kruger', 'ruan.kruger@gmail.com', '076 145 2290', 'waiting', false, [G(y2 + ' 13:30', 'Hi,\n\nPlease can you make the invoice out to Kruger Logistics (Pty) Ltd, VAT number 4123456789?\n\nRuan'), St('Sherri', y2 + ' 15:48', 'Hi Ruan,\n\nHere is the updated invoice made out to Kruger Logistics (Pty) Ltd.', [{ name: 'Invoice-Kruger-Logistics.pdf', size: 61230, type: 'application/pdf' }])]),
      T('t6', 'Company year-end', 'Craig Jacobs', 'craig@jacobsbuild.co.za', '061 220 4433', 'closed', false, [G(y4 + ' 15:22', 'Hi there,\n\nWe would like to host a small year-end for 20 staff: a day visit with a braai. Is that something you do?\n\nCraig'), St('Devon', y4 + ' 17:05', 'Hi Craig,\n\nYes, we can host a day visit with braai facilities for 20 people on a weekday. Which date did you have in mind?'), G(y3 + ' 08:40', 'Thanks Devon. Thursday 10 December would be ideal, from about 10:00.'), St('Devon', y3 + ' 09:15', 'Lovely, 10 December from 10:00 is booked for you. The quote is attached. See you then!', [{ name: 'Quote-Jacobs-Build-day-visit.pdf', size: 54012, type: 'application/pdf' }])]),
      T('t7', 'Lost item', 'Anika Botha', 'anika.botha@icloud.com', '079 880 6612', 'closed', false, [G(y6 + ' 07:51', 'Hi,\n\nWe left a blue camping chair at Stand 3 last weekend. Did anyone find it?\n\nAnika'), St('Leuan', y6 + ' 09:02', 'Hi Anika,\n\nYes! Our team found a blue chair at Stand 3. It is safe at reception, so you can collect it any day between 08:00 and 17:00.'), G(y6 + ' 10:15', 'Thank you so much! We will fetch it on Saturday.')])
    ];
    if (mailB) db.threads.push(T('t3', 'Proof of payment ' + mailB.ref, guestName(mailB), mailB.guest.email, mailB.guest.phone, 'open', true, [G(TODAY + ' 06:58', 'Good morning,\n\nPlease find attached proof of payment for booking ' + mailB.ref + '.\n\nRegards,\n' + mailB.guest.first, [{ name: 'FNB-proof-of-payment-' + mailB.ref.replace(/\s/g, '') + '.pdf', size: 86214, type: 'application/pdf' }])], mailB.ref));
    var cx = db.bookings.filter(function (b) { return b.status === 'cancelled'; })[0];
    if (cx) db.credits.push(creditFix({ id: 'c1', email: (cx.guest.email || '').toLowerCase(), name: guestName(cx), amt: 650, used: 0, from: cx.ref, d: add(TODAY, -12) }, db.credits));
    // most guests who paid in full finalised online: number plates, who is in which car, arrival time.
    // Dinokeng codes: sent for everyone arriving in the next 3 days, and for most finalised bookings after that.
    var LT = 'BCDFGHJKLMNPRSTVWXYZ', regOf = function () { var l = function () { return LT[Math.floor(r() * LT.length)]; }; return l() + l() + ' ' + (10 + Math.floor(r() * 89)) + ' ' + l() + l() + ' GP'; };
    db.bookings.forEach(function (b) {
      // only guests who finalised gave their vehicles; everyone else has "not given yet" and one empty car waiting
      var fin = live(b) && (b.status === 'in' || b.status === 'out' || (paid(b) > 0 && balance(b) <= 0 && r() < .7));
      if (fin) b.vehSaid = { at: b.created, by: 'Guest' }; else { b.vehTbc = true; b.vehicles = 1; }
      var cs = ensureCars(b);
      if (fin) {
        var fa = add(b.ci, -2 - Math.floor(r() * 6)); if (fa > TODAY) fa = TODAY; if (fa < b.created.slice(0, 10)) fa = b.created.slice(0, 10);
        b.finalised = { at: fa + ' ' + (8 + Math.floor(r() * 13)) + ':' + String(Math.floor(r() * 60)).padStart(2, '0'), by: r() < .85 ? 'Guest' : 'Sherri' };
        if (!b.eta) b.eta = pick(['13:00', '14:00', '14:00', '15:00', '16:00', 'After 18:00']);
        var used = {}; used[guestName(b)] = 1;
        var nm = function (last) { for (var k = 0; k < 9; k++) { var x = pick(FIRST) + ' ' + last; if (!used[x]) { used[x] = 1; return x; } } return ''; };
        cs.forEach(function (c, i) { delete c.auto; c.reg = regOf(); if (i && !c.driver) c.driver = nm(r() < .5 ? b.guest.last : pick(LAST)); var want = Math.max(0, (c.people || 1) - 1); c.guests = []; for (var k = 0; k < want; k++) { var x = nm(i ? c.driver.split(' ').slice(1).join(' ') : b.guest.last); if (x) c.guests.push(x); } c.people = (c.driver ? 1 : 0) + c.guests.length; });
      }
      if (b.status === 'out' && b.co < add(TODAY, -2)) b.thanks = { at: b.co + ' 11:40', by: 'Sherri', via: b.guest.phone ? 'WhatsApp' : 'Email' };
      if (!live(b) || b.status === 'out' && b.co < add(TODAY, -20)) return;
      if (b.ci < add(TODAY, 3) || (b.finalised && b.ci < add(TODAY, 12) && r() < .6)) cs.forEach(function (c) { c.dgr = 'DGR' + Math.floor(r() * 2176782336).toString(36).toUpperCase().padStart(6, '0').slice(0, 6); var sa = add(b.ci, -6); if (sa > TODAY) sa = TODAY; c.dgrSent = { at: sa + ' 09:10', by: 'Sherri', code: c.dgr }; });
    });
    db.dgrV = 2; db.vehV = 1; db.thanksV = 1; db.keepV = 1;
    seedStories(db, r);
    db.bookings.sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    var recent = db.bookings.filter(function (b) { return b.created.slice(0, 10) >= add(TODAY, -3); }).slice(-6);
    recent.forEach(function (b) { db.log.push({ at: b.created, by: b.source === 'Website' ? 'Website' : 'Sherri', text: 'New booking ' + b.ref + ' for ' + guestName(b) + ' (' + standById(b.stand).name + ')', ref: b.ref }); });
    db.log.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); publishWeb(); return true; } catch (e) { return false; } }
  function loadDB() {
    try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
    if (!DB || DB.v !== DB_V) {
      // An older version of the demo data: start again, with the website's demo records and the signed forms.
      // No admin data at all (the admin is opened for the first time in this browser): keep what guests already did on
      // the website, so their bookings, proof of payment and signed forms are imported below instead of lost.
      try { (DB ? ['kyleu-web-bookings', 'kyleu-web-pop', 'kyleu-indemnities', 'kyleu-ind-demo'] : ['kyleu-ind-demo']).forEach(function (k) { localStorage.removeItem(k); }); } catch (e) {}
      DB = seed(); save();
    }
    DB.vouchers = DB.vouchers || []; DB.credits = DB.credits || [];
    DB.gone = DB.gone || {};
    if (DB.stands) { CONTENT_STANDS.forEach(function (s) { if (!DB.stands.some(function (x) { return x.id === s.id; }) && !DB.gone[s.id]) DB.stands.push(JSON.parse(JSON.stringify(s))); }); STANDS = DB.stands; }   // campsites added in the map editor join the list   // stands added or changed in this admin
    if (!DB.products) DB.products = defaultProducts();
    DB.threads = DB.threads || []; DB.popSeen = DB.popSeen || {}; applyHol(); applyWk();
    migrate(); importWeb(); importAmend(); importPop(); importPaid(); sweepHolds();
  }
  /* ---------- an unpaid quotation holds the stand for 5 days ----------
     After that the stand is released by itself, but never over a weekend: a hold that runs out on a
     Friday, Saturday or Sunday lasts until the end of Monday. If the guest said they paid, the stand is
     kept one more day while Kyleu checks the bank; if they uploaded proof of payment, 10 days from the upload.
     Both are set on Rates & fees > Payment & booking rules. Live version: the server does this every night. */
  function sweepHolds() {
    var n = 0;
    DB.bookings.forEach(function (b) {
      if (b.status !== 'pending' || paid(b) > 0 || b.noRelease) { if (b.softHold) { b.softHold = null; b.holdWhy = null; } return; }   // paid, or kept for the guest (b.noRelease): never released
      var h = holdOf(b);
      if (h.state === 'released') {
        b.status = 'cancelled'; b.softHold = null; b.released = { at: nowStamp(), due: depositDue(b) };
        b.notes = b.notes || []; b.notes.push({ at: nowStamp(), by: 'System', text: 'Stand released automatically: the quotation was valid until ' + fd(depositDue(b)) + ' and no payment came in.' + (h.until > h.due ? ' It was kept until ' + fd(h.until) + (h.why === 'pop' ? ' because proof of payment was uploaded on ' + fd(popAt(b)) : h.why === 'claim' ? ' because the guest said they paid' : ' because it ran out over a weekend') + ', but the payment was not confirmed.' : '') });
        log('Stand released automatically: ' + guestName(b) + ', ' + standById(b.stand).name + ', ' + fd(b.ci) + ' (quotation not paid)', b.ref); n++;
      } else { b.softHold = h.state === 'soft' || h.state === 'grace' ? h.until : null; b.holdWhy = b.softHold ? h.why : null; }
    });
    if (n) save();
  }
  // proof of payment uploaded on the website (pop.html), same browser in the demo
  var POPK = 'kyleu-web-pop';
  function importPop() {
    var list = []; try { list = JSON.parse(localStorage.getItem(POPK) || '[]'); } catch (e) {}
    var n = 0;
    list.forEach(function (p) {
      if (!p || !p.id || DB.popSeen[p.id]) return; DB.popSeen[p.id] = 1; n++;
      // byRefLoose: "KY265901" or "ky26-5901" still finds booking "KY26 5901"
      var f = p.file || {}, b = byRefLoose(p.ref), att = { name: f.name || 'proof-of-payment', size: f.size || 0, type: f.type || '', data: f.data || '', at: p.at, via: 'Website upload' };
      if (b) {
        // another email address than the one on the booking (someone else paid, or a work address): keep it, and say so
        if (p.emailMatch === false || (p.email && b.guest.email && normEmail(p.email) !== normEmail(b.guest.email))) { att.emailMatch = false; att.email = String(p.email || '').trim(); }
        b.pops = b.pops || []; b.pops.push(att); if (b.status === 'pending') b.pop = true;
        b.notes.push({ at: p.at, by: 'Guest', text: 'Uploaded proof of payment on the website' + (popOther(att) ? ' (' + popOther(att) + ')' : '') + (p.note ? ': ' + p.note : '.') });
        DB.log.unshift({ at: p.at, by: 'Website', text: 'Proof of payment uploaded for ' + b.ref, ref: b.ref });
      } else {
        DB.threads.push({ id: uid('t'), subject: 'Proof of payment: ' + (p.ref || 'no reference'), name: p.email, email: p.email, phone: '', status: 'open', unread: true, ref: '', msgs: [{ from: 'guest', at: p.at, body: 'Uploaded on the website with booking reference "' + (p.ref || '') + '", which does not match a booking. Please match it by hand.' + (p.note ? '\n\n' + p.note : ''), att: [att] }] });
      }
    });
    if (n) save();
    return n;
  }
  /* ---------- each booking's private link (manage.html?b=REF&k=KEY): amend before paying in full, finalise after ---------- */
  function newKey() { return Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 6); }
  function bookingLink(b) { if (!b.key) { b.key = newKey(); save(); } return new URL('../manage.html?b=' + encodeURIComponent(b.ref) + '&k=' + b.key, location.href).href; }
  function paidUp(b) { return paid(b) > 0 && balance(b) <= 0; }
  function linkSec(b) {
    if (b.status === 'cancelled' || b.status === 'out') return '';
    var full = paidUp(b), fin = b.finalised;
    return '<section class="d-sec"><h4 class="h4-row">Booking page · ' + (full ? 'Finalise' : 'Amend') + '<span class="pill ' + (full ? (fin ? 'ok' : 'warn') : 'muted') + '">' + (full ? (fin ? ic('check') + 'Finalised ' + fd(fin.at.slice(0, 10)) + (fin.by ? ' by ' + esc(fin.by) : '') : 'Paid, not finalised yet') : 'Not paid in full yet') + '</span></h4>' +
      '<p class="muted small">' + (full ? 'Paid in full, so ' + esc(b.guest.first) + '\'s link opens <b>Finalise your booking</b>: vehicles and passengers, arrival time, camp shop. You can also fill these in here (vehicles below, arrival time under Edit booking, shop items in the Shop) and mark it finalised.'
        : esc(b.guest.first) + '\'s link opens <b>Amend your booking</b>: I have paid, number of guests and contact details. Once the booking is paid in full, the same link lets them finalise it.') + '</p>' +
      '<div class="row-btns"><button type="button" class="btn ghost sm" data-act="send-doc" data-ref="' + b.ref + '|' + (full ? 'finalise' : 'link') + '">' + ic('send') + (full ? 'Send the finalise link' : 'Send the booking link') + '</button><button type="button" class="btn ghost sm" data-act="link-copy" data-ref="' + b.ref + '">' + ic('note') + 'Copy link</button><a class="btn ghost sm" href="' + esc(bookingLink(b)) + '" target="_blank" rel="noopener">' + ic('ext') + 'Open as the guest</a>' +
      (full && !fin ? '<button type="button" class="btn sm" data-act="fin-mark" data-ref="' + b.ref + '">' + ic('check') + 'Mark as finalised</button>' : '') + '</div></section>';
  }
  /* ---------- camp shop items ordered with the booking: one charge, replaced when the guest changes it ---------- */
  function preShop(b) { return (b.charges || []).filter(function (c) { return c.pre; })[0]; }
  function setPreShop(b, items, at, inTotal) {
    b.charges = b.charges || [];
    var old = preShop(b), e = items.reduce(function (a, x) { return a + x.qty * x.each; }, 0), map = {};
    items.forEach(function (x) { map[x.label] = x.qty; });
    if (old) { b.charges.splice(b.charges.indexOf(old), 1); if (!inTotal) { b.eft -= old.e; b.card -= old.c; } }
    if (items.length) b.charges.push({ d: String(at).slice(0, 10), desc: 'Shop order for arrival: ' + items.map(function (x) { return x.qty + ' × ' + x.label; }).join(', '), e: e, c: toCard(e), pre: true, items: map });
    if (!inTotal) { b.eft += e; b.card += toCard(e); b.total = b.method === 'card' ? b.card : b.eft; }
  }
  /* ---------- changes guests make on the website (manage.html), same browser in the demo ---------- */
  var AMK = 'kyleu-web-amend';
  function applyCars(b, n, cars) {
    var cs = ensureCars(b);
    if (!n) { b.vehTbc = true; return; }
    b.vehTbc = false; b.vehSaid = b.vehSaid || { at: nowStamp(), by: 'Guest' };
    cars.forEach(function (c, i) { var x = cs[i] || (cs[i] = newCar()); delete x.auto; x.reg = String(c.reg || '').toUpperCase(); x.driver = c.driver || ''; x.guests = (c.guests || []).slice(); x.minors = minorsOf(c.minors, x.guests); x.people = (x.driver ? 1 : 0) + x.guests.length; });
    for (var i = cs.length - 1; i >= n; i--) if (cs[i].st === 'due' && !carTab(b, cs[i]).items.length) cs.splice(i, 1);
    b.vehicles = cs.length;
  }
  function namedIn(b) { return (b.cars || []).reduce(function (a, c) { return a + (c.driver ? 1 : 0) + (c.guests || []).length; }, 0); }
  function namesWarn(b) {   // the drivers and passengers should add up to the guests on the booking
    if (!vehKnown(b)) return ''; var n = namedIn(b), t = people(b);
    if (n > t) return '<p class="callout bad cflex">' + ic('alert') + '<span><b>The numbers do not match:</b> ' + n + ' people are named in the vehicles, but the booking is for ' + t + '. Check with ' + esc(b.guest.first) + ' and fix the vehicles or the number of guests.</span></p>';
    if (n && n < t) return '<p class="callout warn cflex">' + ic('info') + '<span>' + (t - n) + ' of the ' + t + ' guests ' + (t - n === 1 ? 'is' : 'are') + ' not named in a vehicle yet.</span></p>';
    return '';
  }
  function extraDue(b) { return b.extraDue && !b.extraDue.done && b.status !== 'cancelled' && balance(b) > 0; }
  // "14 adults, 2 pensioners and 1 child": each group on its own, none left out, nothing counted twice
  function peopleTxt(x) {
    var p = [[x.adults, 'adult', 'adults'], [x.pens, 'pensioner', 'pensioners'], [x.kids, 'child', 'children']].filter(function (g) { return g[0] > 0; }).map(function (g) { return g[0] + ' ' + (+g[0] === 1 ? g[1] : g[2]); });
    return p.length > 1 ? p.slice(0, -1).join(', ') + ' and ' + p[p.length - 1] : p[0] || '0 adults';
  }
  // one line for the size check: "12 people on Inside 2, which usually takes 8."
  function sizeLine(b) { var z = b.sizeCheck; return z.people + ' people on ' + standById(b.stand).name + ', which usually takes ' + z.usual + '.'; }
  function setSizeCheck(b, over, at) { if (over && over.people) b.sizeCheck = { at: at, people: over.people, usual: over.usual || standById(b.stand).guests || 8 }; else delete b.sizeCheck; }
  function importAmend() {
    var list = []; try { list = JSON.parse(localStorage.getItem(AMK) || '[]'); } catch (e) {}
    DB.amendSeen = DB.amendSeen || {}; var n = 0;
    list.forEach(function (a) {
      if (!a || !a.id || DB.amendSeen[a.id]) return; DB.amendSeen[a.id] = 1; n++;
      var b = byRefLoose(a.ref); if (!b) return;
      var done = [];
      if (a.details) { var cl = clientById(b.cid), cc = cl ? clientChanges(cl, a.details) : []; if (cl && cc.length) { applyClient(cl, a.details); done = done.concat(cc); } else if (!cl) { Object.assign(b.guest, a.details); done.push('contact details'); } }
      if (a.guests && a.guests.mode === 'direct') {
        var g = a.guests, wasFull = paid(b) > 0 && paid(b) >= b.total, q0 = quote(b.stand, b.ci, b.co, b, b.extras), q1 = quote(b.stand, b.ci, b.co, g, b.extras), before = b.total, ppl0 = peopleTxt(b);
        b.adults = g.adults; b.pens = g.pens; b.kids = g.kids; b.eft += q1.eft - q0.eft; b.card += q1.card - q0.card; b.total = b.method === 'card' ? b.card : b.eft;
        done.push('guests ' + ppl0 + ' to ' + peopleTxt(b) + (b.total !== before ? ' (total ' + money(before) + ' to ' + money(b.total) + ')' : ''));
        if (wasFull && balance(b) > 0) { b.extraDue = { at: a.at, amt: balance(b), why: 'Guests added after paying in full' }; done.push(money(balance(b)) + ' now outstanding'); }
        // more people than the stand usually takes: the website let it through and told the guest Kyleu will check
        setSizeCheck(b, g.over, a.at); if (b.sizeCheck) done.push(b.sizeCheck.people + ' people on a stand that usually takes ' + b.sizeCheck.usual + ', for you to check');
      }
      if (a.cars) { applyCars(b, a.vehicles, a.cars); done.push(a.vehicles ? a.vehicles + ' vehicle' + (a.vehicles === 1 ? '' : 's') + ' with drivers and passengers' : 'not sure yet how many vehicles'); }
      if (a.eta != null) { b.eta = a.eta; done.push('arrival time ' + (a.eta || 'cleared')); }
      if (a.shopItems) { var before = b.total; setPreShop(b, a.shopItems, a.at); done.push('camp shop order (total ' + money(before) + ' to ' + money(b.total) + ')'); }
      if (a.request) {
        var r = a.request; b.changeReq = Object.assign({ at: a.at }, r);
        var body = 'Please change my booking ' + b.ref + ' (' + standById(b.stand).name + '):\n\nDates: ' + fd(b.ci) + ' to ' + fd(b.co) + (r.ci !== b.ci || r.co !== b.co ? ', please change to ' + fd(r.ci) + ' to ' + fd(r.co) : ' (no change)') + '\nGuests: ' + peopleTxt(b) + (r.adults !== b.adults || r.pens !== b.pens || r.kids !== b.kids ? ', please change to ' + peopleTxt(r) : ' (no change)') + (r.msg ? '\n\n' + r.msg : '') + '\n\n' + b.guest.first;
        DB.threads.push({ id: uid('t'), subject: 'Change request: ' + b.ref, name: guestName(b), email: b.guest.email, phone: b.guest.phone, status: 'open', unread: true, ref: b.ref, msgs: [{ from: 'guest', at: a.at, body: body }] });
        done.push(r.ci !== b.ci || r.co !== b.co ? (r.adults !== b.adults || r.pens !== b.pens || r.kids !== b.kids ? 'asked to change the dates and the number of guests' : 'asked to change the dates') : 'asked to change the number of guests');
      }
      if (a.cancel) {   // the guest asked to cancel: nothing is cancelled until staff decide
        var why = String(a.cancel.reason || '').trim(), cpd = +a.cancel.paid || 0;
        b.cancelReq = { at: a.at, reason: why };
        DB.threads.push({ id: uid('t'), subject: 'Cancellation request: ' + b.ref, name: guestName(b), email: b.guest.email, phone: b.guest.phone, status: 'open', unread: true, ref: b.ref, msgs: [{ from: 'guest', at: a.at, body: 'Please cancel my booking ' + b.ref + ' (' + standById(b.stand).name + ', ' + fd(b.ci) + ' to ' + fd(b.co) + ').' + (why ? '\n\nReason: ' + why : '') + (cpd > 0 ? '\n\nI have paid ' + money(cpd) + ' so far.' : '') + '\n\n' + b.guest.first }] });
        done.push('asked to cancel the booking');
      }
      if (a.note) { b.notes.push({ at: a.at, by: 'Guest', text: a.note }); done.push('left a message'); }
      if (a.finalise) { b.finalised = { at: a.at, by: 'Guest' }; done.push('finalised the booking'); }
      if (a.invoice) { b.invoices = b.invoices || []; b.invoices.push(Object.assign(JSON.parse(JSON.stringify(a.invoice)), { by: 'Website', sent: { at: a.at, via: 'Email (automatic)', to: b.guest.email } })); autoMail(b, a.invoice, a.at, 'Your updated Kyleu reservation ' + b.ref + ' (' + docTag(a.invoice, b.ref) + ')', invMailBody(b, a.invoice, true)); done.push('updated invoice ' + a.invoice.no + ' emailed'); }
      if (!done.length) return;
      b.notes.push({ at: a.at, by: 'Guest', text: 'Changed on the website: ' + done.join('; ') + '.' });
      b.guestEdit = { at: a.at, what: done, seen: false };
      DB.log.unshift({ at: a.at, by: 'Website', text: guestName(b) + ' changed booking ' + b.ref + ' on the website', ref: b.ref });
    });
    if (n) save();
    return n;
  }
  // "I have paid" from the website (after booking or under Change my booking), same browser in the demo
  var PDK = 'kyleu-web-paid';
  function importPaid() {
    var list = []; try { list = JSON.parse(localStorage.getItem(PDK) || '[]'); } catch (e) {}
    DB.paidSeen = DB.paidSeen || {}; var n = 0;
    list.forEach(function (c) {
      if (!c || !c.id || DB.paidSeen[c.id]) return; DB.paidSeen[c.id] = 1; n++;
      var b = byRefLoose(c.ref); if (!b) return;
      // a second "I have paid" before the first one is confirmed: both count, so the amounts are added together
      var nc = JSON.parse(JSON.stringify(c)), oc = b.paidClaim && !b.paidClaim.done ? b.paidClaim : null;
      if (oc) { nc.parts = (oc.parts || [JSON.parse(JSON.stringify(oc))]).concat([JSON.parse(JSON.stringify(c))]); nc.amt = nc.parts.reduce(function (t, x) { return t + (+x.amt || 0); }, 0); }
      b.paidClaim = nc; b.pop = true;
      b.notes.push({ at: c.at, by: 'Guest', text: 'Says they paid ' + money(c.amt) + ' (' + String(c.what || 'payment').toLowerCase() + ') on ' + fd(c.date) + (c.note ? ': ' + c.note : '.') });
      DB.log.unshift({ at: c.at, by: 'Website', text: guestName(b) + ' says they paid ' + money(c.amt) + ' on ' + b.ref, ref: b.ref });
    });
    if (n) save();
    return n;
  }
  // bookings made in the website's demo checkout (same browser)
  function importWeb() {
    var list = []; try { list = JSON.parse(localStorage.getItem(WEB) || '[]'); } catch (e) {}
    var added = 0;
    list.forEach(function (w) {
      if (!w || !w.ref || !w.stand || !w.ci || !w.co || byRef(w.ref)) return;
      if (!w.created) w.created = nowStamp();
      var card = w.pay === 'deposit' || w.pay === 'full', nowPaid = +w.paid || 0, day = w.created.slice(0, 10);
      // a credit from a cancelled booking, typed on the website: "paid" includes it
      var wc = w.credit && +w.credit.amt > 0 ? w.credit : null, want = wc ? Math.min(+wc.amt, nowPaid) : 0, took = 0, cr = wc ? creditById(wc.id) || creditByCode(wc.code) : null;
      var b = { ref: w.ref, created: w.created, source: 'Website', guest: { first: w.first, last: w.last, email: w.email, phone: w.phone, consent: !!w.consent }, stand: w.stand, ci: w.ci, co: w.co, adults: w.adults, pens: w.pens, kids: w.kids, vehicles: Math.max(1, +w.vehicles || 1), vehTbc: !!w.vehTbc || !(+w.vehicles > 0), eta: w.eta || '', key: w.key || newKey(), setup: w.setup || '', extras: w.extras || {},
        method: card ? 'card' : 'eft', eft: w.eft, card: w.card, total: card ? w.card : w.eft, payments: [], status: 'pending', notes: w.notes ? [{ at: w.created, by: 'Guest', text: w.notes }] : [], pop: false, isNew: true };
      if (wc) {
        // the credit part is its own payment line (never new income: that money came in on the cancelled booking)
        var crWhy = !cr ? 'that credit was not found' : cr.void ? 'that credit was cancelled' : cr.until && cr.until < day ? 'it could only be used until ' + fdy(cr.until) : '';
        if (cr && !crWhy) took = creditPay(b, cr, want, day);
        if (took) b.notes.push({ at: w.created, by: 'System', text: 'Paid ' + money(took) + ' with credit ' + cr.code + (cr.from ? ' from booking ' + cr.from : '') + '.' });
        if (took < want) b.notes.push({ at: w.created, by: 'System', text: 'The guest used credit ' + (cr ? cr.code : String(wc.code || '')) + ' for ' + money(want) + ' on the website, but ' + (crWhy ? crWhy + ', so nothing was taken' : 'only ' + money(took) + ' was left') + '. ' + money(want - took) + ' is still owing.' });
      }
      if (nowPaid - want > 0) b.payments.push({ d: day, amt: nowPaid - want, m: card ? 'card' : 'eft', type: w.pay === 'full' ? 'Full payment' : 'Deposit', ref: card ? 'Card (website)' : 'Instant EFT' });
      // confirmed only when what is paid covers the first payment that was due (a credit can be smaller than the deposit)
      var due1 = w.invoice && w.invoice.payFull ? b.total : w.invoice && +w.invoice.deposit > 0 ? +w.invoice.deposit : Math.round(b.total * .5);
      if (paid(b) > 0 && paid(b) >= due1) b.status = 'confirmed';
      linkBooking(b);
      if (!b.vehTbc) b.vehSaid = { at: w.created, by: 'Guest' };   // the guest gave a number of vehicles on the website
      if (w.cars && w.cars.length && !b.vehTbc) b.cars = w.cars.map(function (c, i) { var dr = c.driver || (i ? '' : w.first + ' ' + w.last), gs = (c.guests || []).slice(); return newCar({ reg: String(c.reg || '').toUpperCase(), driver: dr, phone: i ? '' : w.phone, guests: gs, minors: minorsOf(c.minors, gs), people: (dr ? 1 : 0) + gs.length }); });
      if (w.overCap) setSizeCheck(b, w.overCap, w.created);   // more people than the stand usually takes: Kyleu's call
      // made on the website before this admin had its demo data, on nights a demo booking also has: keep it, and say so
      if (overlaps(b.stand, b.ci, b.co)) b.notes.push({ at: w.created, by: 'System', text: 'Another booking or a block is on ' + standById(b.stand).name + ' for some of these nights. Check the calendar and move one of them.' });
      if (w.shop && w.shop.length) { b.charges = []; setPreShop(b, w.shop, w.created, true); }
      ensureCars(b); DB.bookings.push(b); added++;
      if (w.invoice) { b.invoices = [Object.assign(JSON.parse(JSON.stringify(w.invoice)), { by: 'Website', sent: { at: w.created, via: 'Email (automatic)', to: w.email } })]; autoMail(b, w.invoice, w.created, 'Your Kyleu reservation ' + b.ref + ' (' + docTag(w.invoice, b.ref) + ')', invMailBody(b, w.invoice)); }
      DB.log.unshift({ at: w.created, by: 'Website', text: 'New website booking ' + b.ref + ' for ' + guestName(b), ref: b.ref });
      if (took) DB.log.unshift({ at: w.created, by: 'Website', text: money(took) + ' of credit ' + cr.code + ' used on ' + b.ref, ref: b.ref });
    });
    if (added) { DB.bookings.sort(function (a, b) { return a.ci < b.ci ? -1 : 1; }); save(); }
    return added;
  }

  /* ---------- staff ---------- */
  var STAFF = [
    { id: 'sherri', name: 'Sherri', role: 'Owner', email: 'sherri@kyleu.co.za' },
    { id: 'devon', name: 'Devon', role: 'Owner', email: 'devon@kyleu.co.za' },
    { id: 'kyran', name: 'Kyran', role: 'Manager', email: 'kyran@kyleu.co.za' },
    { id: 'leuan', name: 'Leuan', role: 'Front desk', email: 'leuan@kyleu.co.za' },
    { id: 'gate', name: 'Gate', role: 'Gate', email: 'gate@kyleu.co.za' },   // the person doing check-ins: sees the check-in sheet and the shop only
    { id: 'thabo', name: 'Thabo', role: 'Worker', email: 'thabo@kyleu.co.za' },   // site workers: the site jobs only, never guest names or money
    { id: 'sipho', name: 'Sipho', role: 'Worker', email: 'sipho@kyleu.co.za' }
  ];
  // What each role may open. "cap:guests" = may see guest names, contact details, bookings and money.
  var ROLES = {
    Owner: ['dashboard', 'gate', 'bookings', 'calendar', 'enquiries', 'clients', 'vouchers', 'indemnities', 'eft', 'payments', 'reports', 'shop', 'drives', 'products', 'stands', 'rates', 'settings', 'news', 'dgrnews', 'social', 'webtext', 'cap:guests', 'cap:money', 'cap:setup'],
    Manager: ['dashboard', 'gate', 'bookings', 'calendar', 'enquiries', 'clients', 'vouchers', 'indemnities', 'eft', 'payments', 'reports', 'shop', 'drives', 'products', 'stands', 'news', 'dgrnews', 'social', 'webtext', 'cap:guests', 'cap:money'],
    'Front desk': ['dashboard', 'gate', 'bookings', 'calendar', 'enquiries', 'clients', 'vouchers', 'indemnities', 'shop', 'drives', 'news', 'dgrnews', 'social', 'cap:guests'],
    Gate: ['gate', 'shop', 'cap:guests'],
    Worker: ['site']
  };
  var ROLE_INFO = {
    Owner: 'Everything, including prices, settings and who has which role.',
    Manager: 'Everything except prices and settings.',
    'Front desk': 'Bookings, check-ins, the inbox, the shop and the website news. No money reports and no setup.',
    Gate: 'The check-in sheet and the shop till. For the person at the gate.',
    Worker: 'Site jobs only: cleaning, wood, deliveries, repairs and stand notes. Never guest names, phone numbers or money.'
  };
  var NAV = [
    { id: 'site', t: 'Site jobs', i: 'check', g: '' },
    { id: 'dashboard', t: 'Dashboard', i: 'home', g: '' },
    { id: 'gate', t: 'Check-in sheet', i: 'clip', g: 'Front desk' },
    { id: 'bookings', t: 'Bookings', i: 'list', g: 'Front desk' },
    { id: 'calendar', t: 'Calendar', i: 'cal', g: 'Front desk' },
    { id: 'enquiries', t: 'Inbox', i: 'mail', g: 'Front desk' },
    { id: 'clients', t: 'Clients', i: 'users', g: 'Front desk' },
    { id: 'vouchers', t: 'Dinokeng vouchers', i: 'gift', g: 'Front desk' },
    { id: 'indemnities', t: 'Indemnities', i: 'shield', g: 'Front desk' },
    { id: 'eft', t: 'EFT payments', i: 'bank', g: 'Money' },
    { id: 'payments', t: 'Payments', i: 'card', g: 'Money' },
    { id: 'reports', t: 'Reports', i: 'chart', g: 'Money' },
    { id: 'shop', t: 'Shop', i: 'cart', g: 'Shop & activities' },
    { id: 'drives', t: 'Game drives', i: 'car', g: 'Shop & activities' },
    { id: 'products', t: 'Products', i: 'box', g: 'Shop & activities' },
    { id: 'stands', t: 'Stands & blocks', i: 'tent', g: 'Setup' },
    { id: 'rates', t: 'Rates & fees', i: 'tag', g: 'Setup' },
    { id: 'settings', t: 'Settings', i: 'cog', g: 'Setup' },
    { id: 'news', t: 'Camp news', i: 'note', g: 'Website' },
    { id: 'dgrnews', t: 'Dinokeng news', i: 'news', g: 'Website' },
    { id: 'social', t: 'Social media', i: 'image', g: 'Website' },
    { id: 'webtext', t: 'Website wording', i: 'edit', g: 'Website' }
  ];
  function can(view) { return ME && ROLES[ME.role].indexOf(view) >= 0; }
  function ic(n, cls) { return '<svg class="ic' + (cls ? ' ' + cls : '') + '" aria-hidden="true"><use href="#i-' + n + '"/></svg>'; }

  /* ---------- toast, modal, drawer ---------- */
  function toast(msg) {
    var t = document.createElement('div'); t.className = 'toast'; t.innerHTML = ic('check') + '<span>' + msg + '</span>';
    $('.toasts').appendChild(t); setTimeout(function () { t.classList.add('out'); }, 2800); setTimeout(function () { t.remove(); }, 3300);
  }
  function modal(title, body, ok, onOk, opts) {
    opts = opts || {};
    var m = $('#modal'); if (m.hidden) pushLayer();
    m.classList.toggle('swap', !m.hidden);
    m.innerHTML = '<div class="m-back" data-close></div><form class="m-card' + (opts.wide ? ' wide' : '') + (opts.xl ? ' xl' : '') + '" novalidate><header><h3>' + title + '</h3><button type="button" class="icon-btn" data-close aria-label="Close">' + ic('x') + '</button></header><div class="m-body">' + body + '</div>' +
      (ok ? '<footer><button type="button" class="btn ghost" data-close>' + (opts.cancelLabel || 'Cancel') + '</button><button class="btn ' + (opts.danger ? 'danger' : '') + '" type="submit">' + ok + '</button></footer>' : '') + '</form>';
    m.hidden = false; document.body.classList.add('lock');
    var f = $('form', m);
    f.addEventListener('submit', function (e) { e.preventDefault(); if (onOk && onOk(f) === false) return; closeModal(); });
    $$('[data-close]', m).forEach(function (x) { x.addEventListener('click', closeModal); });
    if (opts.onOpen) opts.onOpen(f);
    var first = $('input:not([type=hidden]),select,textarea', f); if (first && !opts.noFocus) setTimeout(function () { first.focus(); }, 30);
    return f;
  }
  function closeModal(fromBack) { var m = $('#modal'); if (!m.hidden && fromBack !== true) popLayer(); if (window.KyleuMotion) window.KyleuMotion.modalOut(m); m.hidden = true; m.innerHTML = ''; if ($('#drawer').hidden) document.body.classList.remove('lock'); }
  function fval(f, n) { var el = f.elements[n]; return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; }

  var drawerRef = null;
  function openBooking(ref) {
    if (!can('cap:guests')) return;   // site workers never see a booking
    var b = byRef(ref); if (!b) { toast('Booking ' + esc(ref) + ' not found'); return; }
    if (!drawerRef) pushLayer();
    if (drawerRef !== ref) PTAB = 'overview';
    drawerRef = ref; if (b.isNew || (b.guestEdit && !b.guestEdit.seen)) { b.isNew = false; if (b.guestEdit) b.guestEdit.seen = true; save(); }
    var d = $('#drawer'); d.hidden = false; document.body.classList.add('lock');
    d.innerHTML = '<div class="d-back" data-dclose></div><aside class="d-panel" role="dialog" aria-label="Booking ' + esc(ref) + '">' + bookingHTML(b) + '</aside>';
    requestAnimationFrame(function () { d.classList.add('on'); });
    $$('[data-dclose]', d).forEach(function (x) { x.addEventListener('click', closeDrawer); });
  }
  // Back (phone or browser) closes the open pop-up or booking instead of changing the page behind it
  var skipPop = false;
  function pushLayer() { try { history.pushState({ layer: ((history.state && history.state.layer) || 0) + 1 }, ''); } catch (e) {} }
  function popLayer() { if (history.state && history.state.layer) { skipPop = true; history.back(); } }
  window.addEventListener('popstate', function () {
    if (skipPop) { skipPop = false; return; }
    if (!$('#modal').hidden) { closeModal(true); return; }
    if (drawerRef) closeDrawer(true);
  });
  function closeDrawer(fromBack) { if (fromBack !== true) popLayer(); var d = $('#drawer'); d.classList.remove('on'); drawerRef = null; if (/^#?\/?(dashboard)?$/.test(location.hash.replace('#/', '#'))) setTimeout(render, 230); setTimeout(function () { d.hidden = true; d.innerHTML = ''; if ($('#modal').hidden) document.body.classList.remove('lock'); }, 220); }
  function refresh() { render(); if (drawerRef) { var p = $('#drawer .d-panel'); if (p) { var sc = p.scrollTop; p.innerHTML = bookingHTML(byRef(drawerRef)); p.scrollTop = sc; $$('[data-dclose]', p).forEach(function (x) { x.addEventListener('click', closeDrawer); }); } } }

  // nice date and time for notes and logs: "Today, 07:21", "Yesterday, 18:02", "4 Nov, 07:21"
  function atNice(s) { if (!s) return ''; var d = String(s).slice(0, 10), t = String(s).slice(11, 16); return (d === TODAY ? 'Today' : d === add(TODAY, -1) ? 'Yesterday' : fd(d)) + (t ? ', ' + t : ''); }
  /* ---------- the booking screen ----------
     Top: who, what, money at a glance and the one thing to do next. Below: tabs, so nothing is a long scroll. */
  var PTAB = 'overview';
  function bookingHTML(b) {
    var st = standById(b.stand), s = stateOf(b), pd = paid(b), bal = balance(b), wa = '27' + String(b.guest.phone || '').replace(/\D/g, '').replace(/^0/, '');
    var q = quote(b.stand, b.ci, b.co, b, b.extras), cancelled = b.status === 'cancelled';
    var cs0 = cancelled ? [] : ensureCars(b), dueN = cs0.filter(function (c) { return c.st === 'due'; }).length, inN = cs0.filter(function (c) { return c.st === 'in'; }).length;
    // the main thing to do next, as big buttons
    var main = [];
    if (b.status === 'pending') main.push('<button class="btn" data-act="pay" data-ref="' + b.ref + '">' + ic('check') + 'EFT received</button>');
    else if (bal > 0 && !cancelled) main.push('<button class="btn" data-act="pay" data-ref="' + b.ref + '">' + ic('card') + 'Record payment</button>');
    if ((b.status === 'confirmed' || b.status === 'in') && b.ci <= TODAY && b.co >= TODAY && dueN) main.push('<button class="btn green" data-act="checkin" data-ref="' + b.ref + '">' + ic('in') + 'Check in' + (cs0.length > 1 ? ' a vehicle' : '') + '</button>');
    if (inN) main.push('<button class="btn green" data-act="checkout" data-ref="' + b.ref + '">' + ic('out') + 'Check out' + (cs0.length > 1 ? ' a vehicle' : '') + '</button>');
    main.push('<button class="btn ghost" data-act="remind" data-ref="' + b.ref + '">' + ic('send') + 'Send a message</button>');
    var more = [];
    if (b.status === 'pending') more.push('<button type="button" data-act="on-arrival" data-ref="' + b.ref + '">' + ic('cash') + 'Guest will pay on arrival</button>');
    if (b.onArrival && bal > 0 && !cancelled) more.push('<button type="button" data-act="on-arrival-off" data-ref="' + b.ref + '">' + ic('return') + 'Undo "pays on arrival"</button>');
    if (!cancelled) more.push('<button type="button" data-act="send-doc" data-ref="' + b.ref + '|invoice">' + ic('note') + (pd > 0 || b.onArrival ? 'Send the invoice' : 'Send the quotation') + '</button>');
    if (!cancelled) more.push('<button type="button" data-act="edit" data-ref="' + b.ref + '">' + ic('edit') + 'Edit booking</button>');
    more.push('<button type="button" data-act="link-copy" data-ref="' + b.ref + '">' + ic('note') + 'Copy the guest\'s booking link</button>');
    if (!cancelled && b.status !== 'out') more.push('<button type="button" class="danger-t" data-act="cancel" data-ref="' + b.ref + '">' + ic('x') + 'Cancel booking</button>');
    var people = peopleTxt(b);
    var pct = b.total > 0 ? Math.min(100, Math.round(pd / b.total * 100)) : 0, sb = staysBefore(b);
    // what is holding the stand (unpaid quotations)
    var balLate = b.status === 'confirmed' && bal > 0 && !b.onArrival && balanceDue(b) < TODAY;
    var holdTxt = b.status === 'confirmed' && bal > 0 && b.onArrival ? '<b>' + money(bal) + ' to pay on arrival</b> (' + esc(String(b.onArrival.how).toLowerCase()) + '), as arranged with ' + esc(b.guest.first) + '. The stand is not released.'
      : b.status === 'confirmed' && bal > 0 ? (balLate ? '<b>Balance of ' + money(bal) + ' was due ' + fd(balanceDue(b)) + '</b> (' + rel(balanceDue(b)) + '). Remind ' + esc(b.guest.first) + ' or record the payment.' : 'Balance of <b>' + money(bal) + '</b> due by <b>' + fd(balanceDue(b), { weekday: 'short', day: 'numeric', month: 'short' }) + '</b> (' + rel(balanceDue(b)) + ').')
      : b.status !== 'pending' ? '' : holdTxtOf(b);
    var nCars = cs0.length, nNotes = (b.notes || []).length + DB.threads.filter(function (t) { return t.ref === b.ref || t.email === b.guest.email; }).length;
    var TABS = [['overview', 'Overview'], ['vehicles', 'Vehicles & indemnity'], ['money', 'Money'], ['notes', 'Messages & notes' + (nNotes ? ' (' + nNotes + ')' : '')]];
    if (cancelled && PTAB === 'vehicles') PTAB = 'overview';
    var head = '<div class="dh-bar"><span class="dh-ref"><span class="muted">Booking</span> <b>' + esc(b.ref) + '</b><button type="button" class="icon-btn sm" data-copy="' + esc(b.ref) + '" aria-label="Copy the booking reference" title="Copy reference">' + ic('note') + '</button></span>' +
        '<span class="dh-pills">' + pill(s) + (b.pop && b.status === 'pending' ? ' <span class="pill info">' + ic('note') + 'Proof in</span>' : '') + '</span><button class="icon-btn" data-dclose aria-label="Close">' + ic('x') + '</button></div>' +
      '<header class="d-head"><h2 class="dh-name">' + esc(guestName(b)) + (sb ? ' <span class="pill ok ret">' + ic('return') + nth(sb + 1) + ' stay</span>' : ' <span class="pill info">First stay</span>') + '</h2>' +
      '<p class="dh-sum"><span>' + ic('tent') + '<b>' + esc(st.name) + '</b> · ' + AREA_SHORT[st.area] + '</span><span>' + ic('cal') + fd(b.ci, { weekday: 'short', day: 'numeric', month: 'short' }) + ' to ' + fd(b.co, { weekday: 'short', day: 'numeric', month: 'short' }) + ' · ' + diff(b.ci, b.co) + ' night' + (diff(b.ci, b.co) === 1 ? '' : 's') + ' <span class="muted">(' + rel(b.ci) + ')</span></span><span>' + ic('users') + people + '</span></p>' +
      (cancelled ? '' : '<div class="dh-money"><div><small>Total</small><b>' + money(b.total) + '</b></div><div><small>Paid</small><b class="ok-t">' + money(pd) + '</b></div><div><small>Still to pay</small><b class="' + (bal ? 'warn-t' : 'ok-t') + '">' + money(bal) + '</b></div><div class="dh-bar-p" role="img" aria-label="' + pct + '% paid"><i style="width:' + pct + '%"></i></div></div>') +
      (holdTxt ? '<p class="dh-hold' + (isKept(b) ? ' calm' : b.softHold || balLate ? ' bad' : b.status === 'confirmed' ? ' calm' : '') + '">' + ic(isKept(b) ? 'lock' : 'clock') + '<span>' + holdTxt + '</span></p>' : '') +
      // an unpaid booking: staff choose whether the stand may be released (b.noRelease), also long after booking
      (b.status === 'pending' ? '<div class="keep-row"><label class="switch"><input type="checkbox" data-keep="' + b.ref + '"' + (b.noRelease ? ' checked' : '') + '><span></span>Keep the stand: do not release it</label><small class="muted">' + (b.noRelease ? 'On: the stand stays theirs until it is paid, you switch this off, or you cancel the booking.' : 'Off: the stand is released automatically when the quotation runs out.') + '</small></div>' : '') +
      '<div class="d-actions">' + main.join('') + '<details class="d-more"><summary class="btn ghost">' + ic('more') + 'More</summary><div class="d-menu">' + more.join('') + '</div></details></div></header>' +
      '<nav class="d-tabs" role="tablist" aria-label="Booking details">' + TABS.filter(function (t) { return !(cancelled && t[0] === 'vehicles'); }).map(function (t) { return '<button type="button" role="tab" aria-selected="' + (PTAB === t[0]) + '" class="' + (PTAB === t[0] ? 'on' : '') + '" data-ptab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</nav>';
    // things that need doing now, on every tab
    var alerts =
      (b.changeReq && !b.changeReq.done ? (function (r) { return '<div class="callout warn cflex req">' + ic('cal') + '<div><b>' + esc(b.guest.first) + ' asked to change this booking</b> on the website (' + esc(atNice(r.at)) + ').' +
        (r.ci !== b.ci || r.co !== b.co ? '<br>Dates: ' + fd(b.ci) + ' to ' + fd(b.co) + ' <b>→ ' + fd(r.ci) + ' to ' + fd(r.co) + '</b>' : '') +
        (r.adults !== b.adults || r.pens !== b.pens || r.kids !== b.kids ? '<br>Guests: ' + peopleTxt(b) + ' <b>→ ' + peopleTxt(r) + '</b>' : '') + (r.msg ? '<br>"' + esc(r.msg) + '"' : '') +
        (pd > 0 ? '<br><b>' + esc(b.guest.first) + ' has already paid ' + money(pd) + '.</b> Talk to them about the difference, then make the change with Edit booking.' : '') +
        '<div class="row-btns"><button type="button" class="btn sm" data-act="edit" data-ref="' + b.ref + '">' + ic('edit') + 'Edit booking</button><button type="button" class="btn ghost sm" data-act="req-done" data-ref="' + b.ref + '">' + ic('check') + 'Dealt with</button></div></div></div>'; })(b.changeReq) : '') +
      // the guest asked on the website to cancel: staff decide (no refunds, what was paid becomes a credit)
      (b.cancelReq && !b.cancelReq.done && !cancelled ? '<div class="callout warn cflex req">' + ic('alert') + '<div><b>' + esc(b.guest.first) + ' asked to cancel this booking</b> on the website (' + esc(atNice(b.cancelReq.at)) + ').' +
        (b.cancelReq.reason ? '<br>"' + esc(b.cancelReq.reason) + '"' : '') + '<br>No refunds: what was paid is kept as a credit. Offer to move the booking first.' +
        '<div class="row-btns">' + (b.status !== 'out' ? '<button type="button" class="btn sm danger" data-act="cancel" data-ref="' + b.ref + '">' + ic('x') + 'Cancel the booking</button>' : '') + '<button type="button" class="btn ghost sm" data-act="cancel-keep" data-ref="' + b.ref + '">' + ic('check') + 'Keep the booking</button></div></div></div>' : '') +
      // more people than the stand usually takes (booked or changed on the website): Kyleu's call
      (b.sizeCheck && !b.sizeCheck.done && !cancelled ? '<div class="callout warn cflex req">' + ic('users') + '<div><b>' + esc(sizeLine(b)) + '</b> The guest was told you will check this. Agree to it, or contact them to move to a bigger stand or bring fewer people.' +
        '<div class="row-btns"><button type="button" class="btn sm" data-act="size-ok" data-ref="' + b.ref + '">' + ic('check') + 'It is fine</button></div></div></div>' : '') +
      (b.paidClaim ? '<div class="callout info cflex claim">' + ic('bank') + '<div><b>' + esc(b.guest.first) + ' says they paid ' + money(b.paidClaim.amt) + '</b> (' + esc(String(b.paidClaim.what || 'payment').toLowerCase()) + ') on ' + fd(b.paidClaim.date) + (b.paidClaim.note ? ': "' + esc(b.paidClaim.note) + '"' : '') + '.' + ((b.paidClaim.parts || []).length > 1 ? ' That is ' + b.paidClaim.parts.length + ' payments added together: ' + b.paidClaim.parts.map(function (x) { return money(x.amt) + ' on ' + fd(x.date); }).join(', ') + '.' : '') + ' Check the bank, then confirm it.<div class="row-btns"><button type="button" class="btn sm" data-act="pay" data-ref="' + b.ref + '">' + ic('check') + 'Confirm payment</button><button type="button" class="btn ghost sm" data-act="claim-no" data-ref="' + b.ref + '">Not in the bank yet</button></div></div></div>' : '') +
      (extraDue(b) ? '<div class="callout bad cflex">' + ic('alert') + '<div><b>' + money(bal) + ' outstanding.</b> ' + esc(b.extraDue.why || 'The total went up after paying in full') + ' (' + esc(atNice(b.extraDue.at)) + '). Send ' + esc(b.guest.first) + ' the new invoice for just this amount.<div class="row-btns"><button type="button" class="btn sm" data-act="send-doc" data-ref="' + b.ref + '|extra">' + ic('send') + 'Send new invoice</button></div></div></div>' : '') +
      (b.guestEdit && b.guestEdit.at >= add(TODAY, -14) ? '<p class="callout info cflex">' + ic('edit') + '<span><b>Changed by ' + esc(b.guest.first) + ' on the website</b> ' + esc(atNice(b.guestEdit.at)) + ': ' + esc(b.guestEdit.what.join('; ')) + '.</span></p>' : '') +
      (b.status === 'out' ? (b.thanks ? '<p class="callout cflex cbtn">' + ic('check') + '<span>' + esc(thanksLine(b)) + '.</span><button type="button" class="link-btn" data-act="thanks" data-ref="' + b.ref + '">Send again</button></p>'
        : '<div class="callout ' + (thanksDue(b) ? 'warn ' : '') + 'cflex cbtn">' + ic('send') + '<span><b>Thank-you not sent yet.</b> Thank ' + esc(b.guest.first) + ' for staying and ask for a Google review.</span><button type="button" class="btn sm" data-act="thanks" data-ref="' + b.ref + '">' + ic('send') + 'Send the thank-you</button></div>') : '') +
      (b.released ? '<p class="callout cflex">' + ic('info') + '<span><b>Released automatically</b> on ' + esc(atNice(b.released.at)) + ': the quotation (valid until ' + fd(b.released.due) + ') was not paid.</span></p>' : '') +
      creditFromHTML(b);
    var body = '';
    if (PTAB === 'overview') {
      var cl = clientById(b.cid);
      body = whereHTML(b) + '<section class="d-sec"><h4 class="h4-row">Guest' + (cl ? '<button type="button" class="link-btn" data-client="' + cl.id + '">Client card' + ic('chev-r') + '</button>' : '') + '</h4>' +
        '<div class="d-contact"><a class="chip" href="tel:' + esc(String(b.guest.phone || '').replace(/\s/g, '')) + '">' + ic('phone') + esc(b.guest.phone || 'No mobile') + '</a><a class="chip" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + ic('wa') + 'WhatsApp</a><a class="chip" href="mailto:' + esc(b.guest.email) + '" title="' + esc(b.guest.email) + '">' + ic('mail') + '<span class="ell">' + esc(b.guest.email || 'No email') + '</span></a></div>' +
        (cl && cl.notes ? '<p class="cl-note">' + ic('note') + '<span>' + esc(cl.notes) + '</span></p>' : '') + '</section>' +
        '<section class="d-sec"><h4>Stay</h4><dl class="kv kv2">' +
        '<dt>Stand</dt><dd><b>' + esc(st.name) + '</b> · ' + AREA_SHORT[st.area] + '</dd>' +
        '<dt>Arrive</dt><dd>' + fd(b.ci, { weekday: 'long', day: 'numeric', month: 'long' }) + ' <span class="muted">· check-in from ' + checkInTime() + '</span></dd>' +
        '<dt>Depart</dt><dd>' + fd(b.co, { weekday: 'long', day: 'numeric', month: 'long' }) + ' <span class="muted">· check-out by ' + checkOutTime() + '</span></dd>' +
        '<dt>Guests</dt><dd>' + people + (b.kids ? ' <span class="muted">(children under 12)</span>' : '') + '</dd>' +
        '<dt>Vehicles</dt><dd>' + (cancelled ? '<span class="muted">' + (vehKnown(b) ? vehTxt(b) : 'Not given') + '</span>' : !vehKnown(b) ? '<span class="warn-t">Not given yet</span> <button type="button" class="link-btn" data-act="veh-add" data-ref="' + b.ref + '">' + ic('plus') + 'Add vehicles</button>' : vehTxt(b)) + (b.setup ? ' · ' + esc(b.setup) : '') + '</dd>' +
        '<dt>Arrival time</dt><dd>' + (b.eta ? esc(etaTxt(b).charAt(0).toUpperCase() + etaTxt(b).slice(1)) : '<span class="muted">Not given yet</span>') + '</dd>' +
        (live(b) ? '<dt>Indemnity</dt><dd>' + indPill(b) + ' <button type="button" class="link-btn" data-ptab="vehicles">See' + ic('chev-r') + '</button></dd>' : '') +
        '<dt>Booked</dt><dd>' + fd(b.created.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }) + ' via ' + esc(b.source) + '</dd></dl></section>' +
        linkSec(b) +
        ((b.notes || []).length ? '<section class="d-sec"><h4 class="h4-row">Latest note<button type="button" class="link-btn" data-ptab="notes">All notes' + ic('chev-r') + '</button></h4>' + '<ul class="notes">' + noteItem(b, b.notes.length - 1, b.notes[b.notes.length - 1]) + '</ul></section>' : '');
    } else if (PTAB === 'vehicles') {
      body = carsHTML(b) + indHTML(b) + dgrHTML(b);
    } else if (PTAB === 'money') {
      var sd0 = b.method === 'card' ? null : stayDetail(b), qs = q.lines.slice();
      if (sd0 && Math.round(sd0.reduce(function (a, x) { return a + x.amt; }, 0)) === Math.round(q.lines[0].e)) qs = sd0.map(function (x) { return { t: x.t, e: x.amt, c: x.amt, free: x.free }; }).concat(q.lines.slice(1));
      var lines = qs.concat((b.charges || []).map(function (c) { return { t: c.desc, e: c.e, c: c.c }; })), sameCard = Math.round(b.card) === Math.round(b.eft);
      body = '<section class="d-sec"><h4>Price</h4><div class="lines">' + lines.map(function (l) { return '<div class="ln"><span>' + esc(l.t) + '</span><span>' + (l.free ? 'Free' : b.method === 'card' ? money(l.c) : money(l.e)) + '</span></div>'; }).join('') +
        (sameCard ? '' : '<div class="ln sub"><span>Card price</span><span>' + (b.method === 'card' ? money(b.card) : '<s>' + money(b.card) + '</s>') + '</span></div><div class="ln sub"><span>EFT price (no card fee)</span><span>' + (b.method === 'card' ? '<s>' + money(b.eft) + '</s>' : money(b.eft)) + '</span></div>') +
        '<div class="ln tot"><span>Total' + (sameCard ? '' : ' · paying by ' + methodLabel(b.method)) + '</span><span>' + money(b.total) + '</span></div>' +
        '<div class="ln"><span>Paid</span><span class="ok-t">' + money(pd) + '</span></div>' +
        (cancelled ? '' : '<div class="ln tot"><span>Still to pay</span><span class="' + (bal ? 'warn-t' : 'ok-t') + '">' + money(bal) + '</span></div>') + '</div>' +
        (pd > b.total && b.total > 0 ? '<p class="note bad-t">' + ic('alert') + '<span><b>' + money(pd - b.total) + ' more was paid than the total.</b> Keep it as credit or refund it, or remove a payment that was entered by mistake.</span></p>' : '') +
        (!cancelled && creditLeft(b.guest.email) ? '<p class="note cr">' + ic('gift') + '<span>' + esc(b.guest.first) + ' has credit to use: ' + creditList(b.guest.email) + '.</span></p>' : '') + '</section>' +
        '<section class="d-sec"><h4>Payments</h4>' + ((b.pops || []).length ? '<h5>Proof of payment</h5>' + popChips(b) : '') +
        ((b.payments || []).length ? '<ul class="timeline">' + b.payments.map(function (p, i) { return '<li><span class="dot ' + (p.amt < 0 ? 'bad' : 'pm-' + p.m) + '"></span><div><b>' + money(p.amt) + '</b> ' + esc(p.type) + ' · ' + methodLabel(p.m) + '<div class="muted small">' + fd(p.d, { day: 'numeric', month: 'short', year: 'numeric' }) + (p.ref ? ' · ' + esc(p.ref) : '') + '</div></div>' + (can('payments') && b.status !== 'cancelled' ? '<button type="button" class="icon-btn sm" data-act="pay-del" data-ref="' + b.ref + '|' + i + '" aria-label="Remove this payment" title="Remove this payment (entered by mistake)">' + ic('x') + '</button>' : '') + '</li>'; }).join('') + '</ul>' : '<p class="muted small">No payments yet.</p>') + '</section>' +
        invSec(b);
    } else {
      var ts = DB.threads.filter(function (t) { return t.ref === b.ref || t.email === b.guest.email; });
      body = '<section class="d-sec"><h4>Notes</h4><form class="note-form" data-note="' + b.ref + '"><input name="t" placeholder="Add a note for the team" aria-label="Add a note"><button class="btn ghost" type="submit">Add</button></form>' +
        ((b.notes || []).length ? '<ul class="notes">' + b.notes.map(function (n, i) { return [i, n]; }).sort(function (x, y) { return String(y[1].at) < String(x[1].at) ? -1 : 1; }).map(function (x) { return noteItem(b, x[0], x[1]); }).join('') + '</ul>' : '<p class="muted small">No notes yet.</p>') + '</section>' +
        '<section class="d-sec"><h4>Emails</h4>' + (ts.length ? '<div class="list">' + ts.map(function (t) { return '<button type="button" class="brow" data-thread-go="' + t.id + '"><span class="brow-g"><b>' + esc(t.subject) + '</b><small>' + t.msgs.length + ' email' + (t.msgs.length > 1 ? 's' : '') + ' · last ' + when(lastMsg(t).at) + '</small></span>' + ic('chev-r') + '</button>'; }).join('') + '</div>' : '<p class="muted small">No emails yet.</p>') + '</section>';
    }
    return head + '<div class="d-body">' + alerts + body + '</div>';
  }
  /* ---------- "Where this booking is": the steps of a booking, at the top of its Overview ----------
     Each step has a state: done, part (partly done), todo or na (not needed). The indemnity and the Dinokeng codes are needed for
     every booking (also phone bookings for old friends, and pay on arrival), so they stay todo until they are done. A step that
     cannot be done yet (check-in before the day) is todo with "later". Pressing a step shows its detail line and its one action. */
  var WSEL = {};   // the step staff pressed, per booking (only on this screen, not saved)
  function whereSteps(b) {
    var pd = paid(b), bal = balance(b), cs = ensureCars(b), nC = cs.length, inN = cs.filter(function (c) { return c.st === 'in'; }).length, outN = cs.filter(function (c) { return c.st === 'out'; }).length, dueN = cs.filter(function (c) { return c.st === 'due' && !c.noShow; }).length;
    var here = b.status === 'in' || b.status === 'out', first = esc(b.guest.first), S = [];
    var btn = function (a, ref, icn, label, cls) { return '<button type="button" class="btn sm' + (cls ? ' ' + cls : '') + '" data-act="' + a + '" data-ref="' + ref + '">' + ic(icn) + label + '</button>'; };
    var add1 = function (k, l, s, t, a, later) { S.push({ k: k, l: l, s: s, t: t, a: a || '', later: !!later }); };
    // 1. booked: who made it and how, and what was not sent with it
    var via = b.source === 'Website' ? 'on the website' : b.source === 'Walk-in' ? 'as a walk-in' : { Phone: 'by phone', WhatsApp: 'by WhatsApp', Email: 'by email' }[b.source] || 'through ' + esc(b.source);
    var docW = pd > 0 || b.onArrival ? 'invoice' : 'quotation', un = [toSend(b, 'doc') ? 'the ' + docW : '', toSend(b, 'link') ? 'the link to their booking' : ''].filter(Boolean);
    add1('booked', 'Booked', un.length ? 'part' : 'done', 'Booked ' + via + ' on ' + fd(b.created.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }) + (b.madeBy ? ', taken by ' + esc(b.madeBy) : '') + '.' +
      (un.length ? ' <b>Not sent yet:</b> ' + un.join(' and ') + '.' : b.sends && b.sends.doc ? ' The ' + docW + ' was ' + esc(sentTxt(b.sends.doc)) + '.' : ''),
      (toSend(b, 'doc') ? btn('send-doc', b.ref + '|invoice', 'send', 'Send the ' + docW) : '') + (toSend(b, 'link') ? btn('send-doc', b.ref + '|' + (paidUp(b) ? 'finalise' : 'link'), 'send', 'Send the booking link', 'ghost') : ''));
    // 2. payment
    var payBtn = bal > 0 ? btn('pay', b.ref, b.status === 'pending' ? 'check' : 'card', 'Record a payment') : '', h = b.status === 'pending' ? holdOf(b) : null, bLate = balanceDue(b) < TODAY;
    if (bal <= 0) add1('pay', 'Payment', 'done', 'Paid in full' + (pd > 0 ? ' (' + money(pd) + ').' : '.'));
    else if (b.status === 'pending') add1('pay', 'Payment', 'todo', b.noRelease ? '<b>Waiting for payment, stand kept.</b> ' + money(Math.max(0, deposit(b) - pd)) + ' is still to pay. ' + KEPT_TXT + '.'
      : '<b>Waiting for the deposit' + (h.until ? ', stand released after ' + fdw(h.until) : '') + '.</b> ' + money(Math.max(0, deposit(b) - pd)) + ' secures the stand.' + (b.pop || b.paidClaim ? ' ' + first + ' says it is paid: check the bank.' : ''), payBtn);
    else if (b.onArrival) add1('pay', 'Payment', 'part', '<b>Pays on arrival (' + esc(String(b.onArrival.how).toLowerCase()) + ').</b> ' + money(bal) + ' to pay at reception, as arranged with ' + first + '. The stand is not released.', payBtn);
    else if (pd > 0) add1('pay', 'Payment', bLate && !here ? 'todo' : 'part', '<b>Deposit paid, balance ' + money(bal) + (bLate ? ' was due ' : ' by ') + fd(balanceDue(b)) + '.</b> ' + money(pd) + ' is paid so far.', payBtn);
    else add1('pay', 'Payment', 'todo', '<b>Nothing paid yet.</b> ' + money(bal) + ' to pay' + (bLate ? '' : ' by ' + fd(balanceDue(b))) + '.', payBtn);
    // 3. indemnity: needed for every booking
    var is = indStat(b), gateAll = here && !dueN && nC > 0 && cs.every(function (c) { return c.ind; }), indDone = is.done || gateAll;
    add1('ind', 'Indemnity', indDone ? 'done' : is.covered ? 'part' : 'todo', (is.done ? 'Everyone is signed for (' + is.total + ' of ' + is.total + ').' : gateAll ? 'Signed at check-in for every vehicle.' : '<b>' + Math.min(is.covered, is.total) + ' of ' + is.total + ' signed for.</b> Everyone signs before they arrive, or at reception.') +
      (indDone ? '' : toSend(b, 'ind') ? ' The signing link has not been sent yet.' : b.sends && b.sends.ind && !nudgeOf(b, 'ind') ? ' The signing link was ' + esc(sentTxt(b.sends.ind)) + '.' : ''),   // with b.nudges the line under the text says when it went out
      indDone ? '' : btn('send-doc', b.ref + '|indemnity', 'send', 'Send the signing link') + btn('ind-sign', b.ref, 'edit', 'Sign at reception', 'ghost'));
    // 4. Dinokeng voucher codes: one for each vehicle, needed for every booking
    var sentN = cs.filter(function (c) { return c.dgrSent; }).length, ready = cs.filter(function (c) { return c.dgr && !c.dgrSent; }).length, known = vehKnown(b), vN = nC + ' vehicle' + (nC === 1 ? '' : 's'), assumed = known ? '' : ' (' + VEH_ASSUMED + ')', toGo = nC - sentN;
    add1('dgr', 'Dinokeng codes', sentN >= nC ? 'done' : b.status === 'out' ? 'na' : sentN ? 'part' : 'todo',
      sentN >= nC ? 'Sent for ' + (nC === 1 ? 'the vehicle' : 'all ' + nC + ' vehicles') + assumed + '.' : b.status === 'out' ? 'Not sent for ' + (sentN ? toGo + ' of ' + vN : 'this stay') + '. The stay is over.'
        : '<b>' + (sentN ? 'Sent for ' + sentN + ' of ' + vN : 'Not sent yet, ' + vN) + assumed + '.</b> ' + (ready ? 'The code' + (ready === 1 ? ' is' : 's are') + ' typed in and ready to send.' : 'Make the code' + (toGo === 1 ? '' : 's') + ' on the Dinokeng site, paste ' + (toGo === 1 ? 'it' : 'them') + ' under Vehicles, then send.'),
      sentN >= nC || b.status === 'out' ? '' : ready ? btn('dgr-send-all', b.ref, 'send', 'Send the codes') : '<button type="button" class="btn sm" data-ptab="vehicles">' + ic('gift') + 'Make and send the codes</button>');
    // 5. vehicles and arrival time
    var etaOk = !!b.eta || here;
    add1('veh', 'Vehicles', known && etaOk ? 'done' : known || b.eta ? 'part' : 'todo', (known ? vN + ' given' : '<b>Vehicles not given yet</b>') + (here ? '' : b.eta ? ', arriving ' + esc(etaTxt(b)) : ', <b>arrival time not given yet</b>') + '.',
      (known || b.status === 'out' ? '' : btn('veh-add', b.ref, 'plus', 'Add vehicles')) + (etaOk ? '' : btn('edit', b.ref, 'clock', 'Add the arrival time', 'ghost')));
    // 6. checked in, 7. checked out
    var canIn = (b.status === 'confirmed' || b.status === 'in') && b.ci <= TODAY && b.co >= TODAY && dueN, inAt = cs.map(function (c) { return c.inAt || ''; }).filter(Boolean).sort()[0], allIn = b.status === 'out' || (here && !dueN);
    add1('in', 'Checked in', allIn ? 'done' : inN + outN ? 'part' : 'todo',
      allIn ? 'Checked in' + (inAt ? ' ' + (inAt.slice(0, 10) === TODAY ? 'today at ' + inAt.slice(11, 16) : 'on ' + fd(inAt.slice(0, 10))) : '') + '.' : inN + outN ? '<b>' + (inN + outN) + ' of ' + nC + ' vehicles checked in.</b>'
        : b.ci > TODAY ? 'Arrives ' + fdw(b.ci) + ' (' + rel(b.ci) + '), check-in from ' + checkInTime() + '.' : b.status === 'pending' ? '<b>Arriving ' + (b.ci === TODAY ? 'today' : rel(b.ci)) + ', not paid yet.</b> Record the payment, or choose Guest will pay on arrival under More, then check in.' : '<b>' + (b.ci === TODAY ? 'Arrives today' : 'Was due ' + fdw(b.ci)) + ', not checked in yet.</b>',
      canIn ? btn('checkin', b.ref, 'in', 'Check in' + (nC > 1 ? ' a vehicle' : ''), 'green') : '', b.ci > TODAY);
    add1('out', 'Checked out', b.status === 'out' ? 'done' : outN ? 'part' : 'todo',
      b.status === 'out' ? 'Checked out ' + (outDay(b) === TODAY ? 'today' : 'on ' + fd(outDay(b))) + '.' : outN ? '<b>' + outN + ' of ' + nC + ' vehicles checked out.</b>' : 'Leaves ' + fdw(b.co) + ', check-out by ' + checkOutTime() + '.',
      inN ? btn('checkout', b.ref, 'out', 'Check out' + (nC > 1 ? ' a vehicle' : ''), 'green') : '', !inN && !outN);
    // 8. the thank-you after the stay
    add1('thanks', 'Thank-you', b.thanks ? 'done' : 'todo', b.thanks ? esc(thanksLine(b)) + '.' : b.status === 'out' ? '<b>Not sent yet.</b> Thank ' + first + ' for staying and ask for a Google review.' : 'Sent after check-out, with the Google review link.',
      b.status === 'out' ? btn('thanks', b.ref, 'send', b.thanks ? 'Send again' : 'Send the thank-you', b.thanks ? 'ghost' : '') : '', b.status !== 'out');
    // when the guest was last reminded about a step that is still open (the same words as in the lists): x.nk is the kind in b.nudges, x.n the line
    var NK = { pay: 'pay', ind: 'ind', dgr: 'dgr', veh: 'fin' };
    S.forEach(function (x) { x.nk = NK[x.k] || ''; x.n = x.nk && (x.s === 'todo' || x.s === 'part') && !(x.k === 'pay' && b.onArrival) && !(x.k === 'veh' && here) && b.status !== 'out' ? nudgeNote(b, x.nk) : ''; });
    return S;
  }
  /* ---------- what is still to do on a booking, for the lists (the bookings list and its "Still to do" filters) ----------
     Built from whereSteps, so the lists and the booking always agree. Only for bookings that are still coming or in camp.
     STG keeps the answers for one draw of the screen (set and cleared in render()), so each booking is worked out once per draw. */
  var STG = null;
  function indStat(b) { if (!STG) return K.ind.status(b.ref, people(b)); var k = 'i|' + b.ref; return STG[k] || (STG[k] = K.ind.status(b.ref, people(b))); }
  function stageOf(b) {
    var ck = 's|' + b.ref; if (STG && STG[ck]) return STG[ck];
    var r = { on: live(b) && b.status !== 'out' && b.co >= TODAY, S: {}, left: [], open: [], fin: false, ready: false };
    if (r.on) {
      whereSteps(b).forEach(function (x) { r.S[x.k] = x; });
      r.fin = !!b.finalised || r.S.veh.s === 'done';   // finalised: the guest (or staff) finalised it, or the vehicles and the arrival time are given
      ['pay', 'ind', 'dgr'].forEach(function (k) { if (r.S[k].s === 'todo' || r.S[k].s === 'part') r.left.push(k); });
      if (!r.fin) r.left.push('fin');
      r.open = r.left.filter(function (k) { return !(k === 'pay' && b.onArrival); });   // what a reminder can still help with (pay on arrival is arranged)
      r.ready = !r.left.length;
    }
    if (STG) STG[ck] = r; return r;
  }
  // the newest reminder about the things in "kinds" (null when there is none)
  function lastNudge(b, kinds) { var best = null; kinds.forEach(function (k) { var x = nudgeOf(b, k); if (x && (!best || String(x.at) > String(best.x.at))) best = { k: k, x: x }; }); return best; }
  // the "Still to do" filters of the bookings list: [key, label, the kinds of reminder that go with it]
  var TODO_F = [['unpaid', 'Not paid', ['pay']], ['deposit', 'Deposit paid (balance owing)', ['pay']], ['ind', 'Indemnity not signed', ['ind']], ['dgr', 'Dinokeng codes not sent', ['dgr']], ['notfin', 'Not finalised', ['fin']], ['ready', 'Finalised and ready', []]];
  function todoHit(b, key) {
    var sg = stageOf(b); if (!sg.on) return false;
    return key === 'unpaid' ? sg.left.indexOf('pay') >= 0 && paid(b) <= 0 : key === 'deposit' ? sg.left.indexOf('pay') >= 0 && paid(b) > 0 : key === 'ind' ? sg.left.indexOf('ind') >= 0 : key === 'dgr' ? sg.left.indexOf('dgr') >= 0 : key === 'notfin' ? !sg.fin : key === 'ready' ? sg.ready : true;
  }
  // which reminders count for a row: the chosen filter's own kind, or everything that is still open
  function todoKinds(b, key) { var sg = stageOf(b), f = TODO_F.filter(function (x) { return x[0] === key; })[0]; return f ? f[2].filter(function (k) { return sg.open.indexOf(k) >= 0; }) : sg.open; }
  // "Not reminded in the last 3 days": something is still open, and the newest reminder about it is 3 days old or more (or there is none)
  function todoStale(b, key) { var ks = todoKinds(b, key); if (!ks.length) return false; var ln = lastNudge(b, ks); return !ln || nudgeStale(b, ln.k); }
  var TODO_LBL = { pay: 'Payment', ind: 'Indemnity', dgr: 'Dinokeng codes' };
  function plainTxt(h) { return String(h || '').replace(/<[^>]+>/g, '').replace(/"/g, '&quot;').replace(/\s+/g, ' ').trim(); }   // step text is already escaped: only the tags go
  function todoCell(b) {
    var sg = stageOf(b);
    if (!sg.on) return thanksDue(b) ? '<span class="todo-c todo" data-todo="thanks" title="Checked out ' + esc(outDay(b) === TODAY ? 'today' : 'on ' + fd(outDay(b))) + '. The thank-you with the Google review link is not sent yet.">Thank-you</span>' : '';
    if (sg.ready) return '<span class="fin-tag ok" data-fin="ready" title="Paid, everyone signed for, Dinokeng codes sent, vehicles and arrival time given.">' + ic('check') + 'Finalised and ready</span>';
    var is = indStat(b), veh = sg.S.veh, fw = b.finalised ? 'Finalised ' + (String(b.finalised.at).slice(0, 10) === TODAY ? 'today' : 'on ' + fd(String(b.finalised.at).slice(0, 10))) + (b.finalised.by ? ' by ' + esc(b.finalised.by) : '') + '. ' : '';
    return (sg.fin ? '<span class="fin-tag ok" data-fin="1" title="' + fw + plainTxt(veh.t) + '">' + ic('check') + 'Finalised</span>'
      : '<span class="fin-tag warn" data-fin="0" data-todo="fin" title="' + plainTxt(veh.t) + ' ' + (paidUp(b) || b.onArrival ? '' : 'Finalising opens once the booking is paid in full. ') + esc(nudgeTxt(b, 'fin')) + '.">Not finalised</span>') +
      ['pay', 'ind', 'dgr'].filter(function (k) { return sg.left.indexOf(k) >= 0; }).map(function (k) {
        var x = sg.S[k], lbl = k === 'pay' ? (b.onArrival ? 'Pays on arrival' : 'Payment') : k === 'ind' ? 'Indemnity <b>' + Math.min(is.covered, is.total) + ' of ' + is.total + '</b>' : TODO_LBL[k] + (x.s === 'part' ? ' <b>' + (b.cars || []).filter(function (c) { return c.dgrSent; }).length + ' of ' + (b.cars || []).length + '</b>' : '');
        return '<span class="todo-c ' + x.s + '" data-todo="' + k + '" title="' + plainTxt(x.t) + (k === 'pay' && b.onArrival ? '' : ' ' + esc(nudgeTxt(b, k)) + '.') + '">' + lbl + '</span>';
      }).join('');
  }
  // the "Last reminded" cell: follows the "Still to do" filter (its own kind), or shows the newest reminder about anything still open
  function nudgeCell(b, key) {
    var ks = todoKinds(b, key); if (!ks.length) return { s: '9999-12-31', h: '' };
    var ln = lastNudge(b, ks), k = ln ? ln.k : ks[0], stale = !ln || nudgeStale(b, k);
    return { s: ln ? String(ln.x.at) : '0000-00-00', h: '<span class="nudge-t' + (stale ? ' stale' : '') + '" data-nudge="' + k + '" title="' + esc(ks.map(function (x) { return NUDGE_WHAT[x] + ': ' + nudgeTxt(b, x, true); }).join(' · ')) + '">' + esc(ln ? nudgeTxt(b, k) : 'Not reminded yet') + '</span>' + (ln || ks.length === 1 ? '<small>' + NUDGE_WHAT[k] + '</small>' : '') };
  }
  // what staff can do from a row of the bookings list, without opening the booking: only what fits what is still to do
  function rowActs(b) {
    var sg = stageOf(b), A = [], put = function (act, ref, icn, label, kind) { A.push({ act: act, ref: ref, i: icn, l: label, k: kind || '' }); };
    if (!sg.on) return A;
    put('row-copy', b.ref, 'clip', sg.fin ? 'Copy booking link' : 'Copy finalise link');
    if (!sg.fin) put('send-doc', b.ref + '|' + nudgeTpl(b, 'fin'), 'send', paidUp(b) ? 'Send finalise link' : 'Send booking link (to finalise once paid)', 'fin');
    if (sg.left.indexOf('ind') >= 0) put('send-doc', b.ref + '|indemnity', 'shield', 'Send indemnity link', 'ind');
    if (sg.open.indexOf('pay') >= 0) put('send-doc', b.ref + '|' + nudgeTpl(b, 'pay'), 'bank', 'Send payment reminder', 'pay');
    if (sg.left.indexOf('dgr') >= 0) put('row-dgr', b.ref, 'gift', ensureCars(b).some(function (c) { return c.dgr && !c.dgrSent; }) ? 'Send Dinokeng codes' : 'Add Dinokeng codes, then send', 'dgr');
    put('remind', b.ref, 'mail', 'Send another message');
    return A;
  }
  function closeRowMenu() { var m = $('.row-menu'); if (m) m.remove(); $$('[data-act="row-menu"][aria-expanded="true"]').forEach(function (x) { x.setAttribute('aria-expanded', 'false'); }); }
  function rowMenu(btn, ref) {
    var was = $('.row-menu'), same = was && was.dataset.ref === ref; closeRowMenu(); if (same) return;
    var b = byRef(ref); if (!b) return;
    var m = document.createElement('div'); m.className = 'd-menu row-menu'; m.dataset.ref = ref; m.setAttribute('role', 'menu'); m.setAttribute('aria-label', 'Send or copy for ' + guestName(b));
    m.innerHTML = '<p class="rm-h">' + esc(guestName(b)) + ' · ' + esc(b.ref) + '</p>' + rowActs(b).map(function (a) { return '<button type="button" role="menuitem" data-act="' + a.act + '" data-ref="' + esc(a.ref) + '"' + (a.k ? ' data-kind="' + a.k + '"' : '') + '>' + ic(a.i) + '<span>' + a.l + (a.k ? '<small>' + esc(nudgeTxt(b, a.k)) + '</small>' : '') + '</span></button>'; }).join('');
    document.body.appendChild(m);
    var r = btn.getBoundingClientRect(), w = m.offsetWidth, h = m.offsetHeight;
    m.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.right - w)) + 'px';
    m.style.top = Math.max(8, r.bottom + h + 8 > window.innerHeight && r.top - h - 6 > 8 ? r.top - h - 6 : r.bottom + 6) + 'px';
    btn.setAttribute('aria-expanded', 'true');
  }
  var STATE_WORD = { done: 'done', part: 'partly done', todo: 'to do', na: 'not needed' }, STEP_LONG = { dgr: 'Dinokeng voucher codes', veh: 'Vehicles and arrival time' };
  function whereHTML(b) {
    if (b.status === 'cancelled') return '';
    var S = whereSteps(b), pick = function (fn) { return S.filter(fn)[0]; };
    var cur = pick(function (x) { return x.k === WSEL[b.ref]; }) || pick(function (x) { return x.s === 'todo' && !x.later; }) || pick(function (x) { return x.s === 'part'; }) || pick(function (x) { return x.s === 'todo'; }) || S[S.length - 1];
    var left = S.filter(function (x) { return (x.s === 'todo' && !x.later) || x.s === 'part'; }).length;
    return '<section class="d-sec bk-where" data-where="' + b.ref + '"><h4 class="h4-row">Where this booking is<span class="pill ' + (left ? 'warn' : 'ok') + '">' + (left ? left + ' to do' : ic('check') + 'Nothing to do now') + '</span></h4>' +
      '<ol class="bk-prog">' + S.map(function (x, i) { return '<li><button type="button" class="bp-s ' + x.s + (x.later ? ' later' : '') + (x === cur ? ' on' : '') + '" data-wstep="' + b.ref + '|' + x.k + '" data-state="' + x.s + '" aria-pressed="' + (x === cur) + '" title="' + x.l + ': ' + (x.later ? 'later' : STATE_WORD[x.s]) + '"><i>' + (x.s === 'done' ? ic('check') : i + 1) + '</i><span>' + x.l + '</span></button></li>'; }).join('') + '</ol>' +
      '<div class="bp-d ' + cur.s + (cur.later ? ' later' : '') + '" data-wdetail="' + cur.k + '"><p><span class="bp-dl">' + (STEP_LONG[cur.k] || cur.l) + ' · ' + (cur.later ? 'later' : STATE_WORD[cur.s]) + '</span>' + cur.t + '</p>' + (cur.n ? '<p class="bp-n">' + cur.n + '</p>' : '') + (cur.a ? '<div class="row-btns">' + cur.a + '</div>' : '') + '</div></section>';
  }
  // "Keep the stand: do not release it" on an unpaid booking (b.noRelease). Staff can change it at any time until the booking is paid.
  function actKeep(ref, on) {
    var b = byRef(ref); if (!b || b.status !== 'pending') { refresh(); return; }
    var setIt = function (v) {
      if (v) { b.noRelease = true; b.softHold = null; b.holdWhy = null; } else delete b.noRelease;
      b.notes.push({ at: nowStamp(), by: ME.name, text: v ? 'Keep the stand switched on: it is not released if the quotation is not paid in time.' : 'Keep the stand switched off: the stand is released again if the quotation is not paid in time.' });
      log('Keep the stand switched ' + (v ? 'on' : 'off') + ' for ' + guestName(b) + ' (' + standById(b.stand).name + ', ' + fd(b.ci) + ')', b.ref);
      sweepHolds(); save(); refresh();
    };
    if (on) { setIt(true); toast('The stand is kept for ' + esc(b.guest.first) + '. It is not released automatically.'); return; }
    var h = holdOf(b);
    if (h.state === 'released') {   // the quotation already ran out: switching off releases the stand now, so ask first
      refresh();
      modal('Stop keeping the stand?', '<p>The quotation for <b>' + esc(guestName(b)) + '</b> ran out on ' + fdw(depositDue(b)) + ' and nothing is paid. If you switch this off, the stand is released straight away and the booking is cancelled.</p>', 'Release the stand', function () { setIt(false); toast('Stand released. The booking is cancelled.'); }, { danger: true, cancelLabel: 'Keep the stand' });
      return;
    }
    setIt(false); toast('Back to the normal rules: the stand is released if it is not paid by ' + keptEnd(h.until || depositDue(b)));
  }
  function noteItem(b, i, n) {
    return '<li class="note-li"><p>' + esc(n.text) + '</p><span class="muted small">' + esc(n.by) + ' · ' + esc(atNice(n.at)) + (n.edited ? ' · edited by ' + esc(n.edited.by) + ' ' + esc(atNice(n.edited.at)) : '') + '</span><span class="note-acts"><button type="button" class="icon-btn sm" data-note-edit="' + b.ref + '|' + i + '" aria-label="Edit note" title="Edit note">' + ic('edit') + '</button><button type="button" class="icon-btn sm" data-note-del="' + b.ref + '|' + i + '" aria-label="Delete note" title="Delete note">' + ic('x') + '</button></span></li>';
  }

  /* ---------- actions ---------- */
  // A regular who arranged with Kyleu to pay when they arrive: the booking is confirmed without a deposit,
  // the quotation becomes an invoice marked "pay on arrival", and the stand is never released automatically.
  function actOnArrival(ref) {
    var b = byRef(ref); if (!b) return;
    modal('Guest will pay on arrival',
      '<p>Use this only for guests you have arranged it with. <b>' + esc(guestName(b)) + '</b>\'s booking is confirmed without a deposit, the stand stays theirs (it is not released after ' + num('Booking rules', 'Deposit due within days of invoice', 5) + ' days), and the quotation becomes an invoice that says ' + money(b.total) + ' is to be paid on arrival.</p>' +
      '<span class="fld-l">How will they pay?</span><div class="seg"><label><input type="radio" name="how" value="Cash" checked><span>' + ic('cash') + 'Cash</span></label><label><input type="radio" name="how" value="Card"><span>' + ic('card') + 'Card</span></label></div>' +
      '<label class="fld"><span>Note for the team (optional)</span><input name="why" placeholder="e.g. Regular guest, arranged by WhatsApp with Sherri"></label>' +
      '<p class="hint">' + ic('info') + ' This is not offered on the website. When they pay at the gate, press Record payment as usual.</p>',
      'Confirm the booking', function (f) {
        var how = ($('[name=how]:checked', f) || {}).value || 'Cash', why = fval(f, 'why');
        b.onArrival = { how: how, at: nowStamp(), by: ME.name }; b.status = 'confirmed'; b.pop = false; b.softHold = null; b.paidClaim = null;
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Confirmed without a deposit: the guest pays ' + money(b.total) + ' on arrival (' + how.toLowerCase() + ').' + (why ? ' ' + why : '') });
        var docs0 = b.invoices || [], lastQ = docs0.filter(function (x) { return x.kind === 'Quote'; }).pop();
        var inv = invFor(b, 'Invoice', null, { by: ME.name, note: 'Payment on arrival (' + how.toLowerCase() + '), as arranged with Kyleu.' });
        b.invoices = docs0; b.invoices.push(inv); K.commitNo('Invoice', inv.no);
        log((lastQ ? 'Quotation is now ' : 'Made ') + K.kindName(inv).toLowerCase() + ' ' + inv.no + ' for ' + guestName(b) + ': pays on arrival (' + how.toLowerCase() + ')', b.ref); save(); refresh(); toast('Booking confirmed. They pay on arrival.');
        setTimeout(function () { invView(b, inv, true); }, 60);
      });
  }
  function actPay(ref) {
    var b = byRef(ref), bal = balance(b), isPend = b.status === 'pending';
    var cl = b.paidClaim, dueNow = cl ? cl.amt : isPend ? Math.max(0, deposit(b) - paid(b)) || bal : bal;   // part of the deposit can already be paid with a credit
    var cardBal = isPend ? Math.round(b.card * depPct() / 100) : Math.max(0, b.card - paid(b));
    modal(isPend ? 'EFT payment received' : 'Record a payment',
      '<p class="muted small">' + esc(guestName(b)) + ' · ' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + '</p>' +
      '<div class="seg" role="radiogroup">' + ['eft', 'card', 'cash'].map(function (m) { return '<label><input type="radio" name="m" value="' + m + '"' + ((isPend ? 'eft' : (b.method === 'card' ? 'card' : 'eft')) === m ? ' checked' : '') + '><span>' + methodLabel(m) + '</span></label>'; }).join('') + '</div>' +
      '<p class="hint" data-hint></p>' +
      '<div class="grid2"><label class="fld"><span>Amount (R)</span><input name="amt" inputmode="numeric" value="' + dueNow + '"></label><label class="fld"><span>Date</span><input type="date" name="d" value="' + (cl ? cl.date : TODAY) + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Type</span><select name="type"><option' + (isPend ? ' selected' : '') + '>Deposit</option><option' + (!isPend ? ' selected' : '') + '>Balance</option><option>Full payment</option></select></label><label class="fld"><span>Bank / card reference</span><input name="ref" value="' + esc(b.ref) + '"></label></div>',
      'Save payment', function (f) {
        var m = fval(f, 'm') || $('[name=m]:checked', f).value, amt = parseFloat(fval(f, 'amt').replace(/[^\d.]/g, ''));
        if (!amt) { toast('Enter the amount received'); return false; }
        if (m === 'card' && b.method !== 'card') { b.method = 'card'; b.total = b.card; b.notes.push({ at: nowStamp(), by: ME.name, text: 'Paid by card, so the card price (' + money(b.card) + ') now applies.' }); }
        if (m !== 'card' && b.method === 'card' && !paid(b)) { b.method = m; b.total = b.eft; }
        b.payments.push({ d: fval(f, 'd'), amt: amt, m: m, type: fval(f, 'type'), ref: fval(f, 'ref') });
        if (b.status === 'pending') { b.status = 'confirmed'; b.pop = false; }
        b.softHold = null;
        // the first payment turns the quotation into an invoice
        var newInv = null, docs0 = b.invoices || [];
        if (!docs0.some(function (x) { return x.kind === 'Invoice'; })) {
          var lastQ = docs0.filter(function (x) { return x.kind === 'Quote'; }).pop();
          newInv = invFor(b, 'Invoice', null, { by: ME.name, note: lastQ && lastQ.no !== nextInvNo(b, 'Invoice') ? 'Replaces quotation ' + lastQ.no + '.' : '' });
          b.invoices = docs0; b.invoices.push(newInv); K.commitNo('Invoice', newInv.no);
          log((lastQ ? 'Quotation ' + (lastQ.no === newInv.no ? '' : lastQ.no + ' ') + 'is now ' : 'Made ') + K.kindName(newInv).toLowerCase() + ' ' + newInv.no + ' for ' + guestName(b), b.ref);
        }
        if (b.paidClaim) { b.notes.push({ at: nowStamp(), by: ME.name, text: 'Payment the guest told us about is confirmed: ' + money(amt) + ' is in the bank.' }); b.paidClaim = null; if (b.status !== 'pending') b.pop = false; }
        log(money(amt) + ' ' + methodLabel(m) + ' payment recorded on ' + b.ref, b.ref); save(); refresh(); toast(money(amt) + ' recorded');
        var pp = b.payments[b.payments.length - 1];
        setTimeout(function () { sendBox({ b: b, title: 'Send the receipt', value: 'receipt', load: function () { return { subject: 'Payment received: ' + b.ref, text: 'Hi ' + b.guest.first + ',\n\nThank you! We received ' + money(pp.amt) + ' for your booking ' + b.ref + ' (' + standById(b.stand).name + ', ' + fd(b.ci, { day: 'numeric', month: 'long' }) + ').\n\n' + (balance(b) > 0 ? 'Still to pay: ' + money(balance(b)) + ', due by ' + fd(balanceDue(b), { day: 'numeric', month: 'long' }) + '.' : 'Your stay is now paid in full.') + (newInv ? ' Your ' + K.kindName(newInv).toLowerCase() + ' ' + newInv.no + ' is attached.' : ' Your receipt is attached.') + (balance(b) <= 0 && !b.finalised ? '\n\nPlease finalise your booking here: tell us your vehicles and who is in each one, roughly when you arrive, and anything you want waiting from the camp shop.\n' + bookingLink(b) + '\n\nRather not use the website? Just reply with the details and we will add them for you.' : '') + '\n\nThe Kyleu team', docs: [newInv ? invDoc(newInv) : docReceipt(b, pp)] }; } }); }, 0);
      }, { onOpen: function (f) {
        var upd = function () {
          var m = $('[name=m]:checked', f).value, h = $('[data-hint]', f), a = f.elements.amt;
          if (m === 'card' && b.method !== 'card') { a.value = cardBal; h.innerHTML = 'Card payments use the card price: <b>' + money(b.card) + '</b> instead of ' + money(b.eft) + ' (+' + cardFee() + '% card fee).'; }
          else if (m !== 'card' && b.method === 'card' && !paid(b)) { a.value = isPend ? deposit(Object.assign({}, b, { total: b.eft })) : b.eft; h.innerHTML = 'EFT and cash use the normal price: <b>' + money(b.eft) + '</b>.'; }
          else { a.value = dueNow; h.textContent = m === 'eft' ? 'Check the money is in the bank before saving.' : ''; }
        };
        $$('[name=m]', f).forEach(function (x) { x.addEventListener('change', upd); }); upd();
        // the type follows the amount: the whole amount still owing is a full payment (or the balance)
        var setType = function () { var a = parseFloat(String(f.elements.amt.value).replace(/[^\d.]/g, '')) || 0, owe = Math.max(0, b.total - paid(b)); f.elements.type.value = a >= owe ? (paid(b) ? 'Balance' : 'Full payment') : paid(b) ? 'Balance' : 'Deposit'; };
        f.elements.amt.addEventListener('input', setType); setType();
      } });
  }
  var TEMPLATES = {
    eft: { t: 'EFT deposit reminder', s: 'Your Kyleu booking: deposit reminder', b: function (b) { return 'Hi {first},\n\nThank you for booking {stand} from {ci} to {co}. ' + (b && b.noRelease ? 'We are keeping the stand for you. Please pay the deposit of {deposit} using reference {ref}.' : 'To secure your stand please pay the deposit of {deposit} using reference {ref}. Your quotation is valid for {qdays}; after that the stand is released.') + '\n\nBank: {bank}\n\nUpload your proof of payment at www.kyleu.co.za/pop.html, or reply to this email with it attached.\n\nSee you in the bush!\nThe Kyleu team'; } },
    balance: { t: 'Balance reminder', s: 'Your Kyleu stay is coming up', b: function (b) { return 'Hi {first},\n\nYour stay at {stand} starts on {ci}. The balance of {balance} is due by {baldue}. Pay by EFT with reference {ref}, or reply and we will send a card payment link.\n\nThe Kyleu team'; } },
    arrival: { t: 'Pre-arrival information', s: 'Getting to Kyleu Bush Camp', b: function (b) { return 'Hi {first},\n\nWe look forward to welcoming you on {ci}.\n\nDirections: enter Dinokeng at Tau Gate, follow the main road 4.8 km, turn right onto Kaallaagte Road and continue 2 km.\n\nKyleu is a proud DGR CP member, so we send you a Conservation Fee Discount Voucher code for each vehicle. Enter it when you buy your conservation fees at https://dinokeng.plnktn.io to pay R85 instead of R100 per adult per night. To use the self-drive route, each vehicle also needs a Self Drive Permit (R250 once off).\n\nEveryone in your group signs our indemnity online before arriving (each adult for themselves, a parent or guardian for anyone under 18). If not everyone has signed yet, here is the link: {signlink}\n\nYou can check in from {checkin}, and check-out on your last day is by {checkout}. Let us know roughly when you will arrive and we will have your stand ready. Gate questions: 060 458 4478.\n\nThe Kyleu team'; } },
    thanks: { t: 'Thank you & review', s: 'Thank you for staying at Kyleu', b: function (b) { return b && b.guest ? thanksMsg(b) : thanksTpl(); } },   // the words and the Google review link: Settings > Check-in & Dinokeng
    invoice: { t: 'Quotation or invoice', s: 'Your Kyleu reservation {ref} ({doc})', b: function (b) { return b && b.payments && paid(b) > 0 ? 'Hi {first},\n\nPlease find your invoice for {stand}, {ci} to {co}, attached.\n\nTotal {total}, paid so far {paid}, balance {balance}. Pay by EFT using reference {ref}.\n\nThe Kyleu team'
      : 'Hi {first},\n\nThank you for booking {stand}, {ci} to {co}. Please find your quotation attached, with our bank details and your booking reference {ref}.\n\n' + (b && b.noRelease ? 'We are keeping the stand for you. Please pay {deposit} using reference {ref}.' : 'This quotation is valid for {qdays}. After that the stand is released. To secure your stand, please pay {deposit} using reference {ref}.') + '\n\nOnce payment has been made, upload your proof of payment directly to your booking:\n{link}\n\nThe Kyleu team'; } },
    indemnity: { t: 'Sign the indemnity (link)', s: 'Please sign the Kyleu indemnity for {ref}', b: function (b) { return 'Hi {first},\n\nKyleu is inside the Dinokeng Big 5 Game Reserve, so everyone in your group signs our indemnity before arriving: each adult for themselves, and a parent or guardian for anyone under 18. It takes about a minute per person:\n{signlink}\n\nYou can sign for everyone who is with you on one phone, or forward the link so each person signs on their own phone. Everyone gets a copy of what they signed.\n\nSee you on {ci}!\nThe Kyleu team'; } },
    update: { t: 'Booking updated', s: 'Your Kyleu booking {ref} has been updated', b: function (b) { return 'Hi {first},\n\nWe have updated your booking {ref}: {stand}, {ci} to {co}.\nTotal {total}, paid {paid}, balance {balance}.\n\nIf anything looks wrong, just reply to this email.\n\nThe Kyleu team'; } },
    extra: { t: 'Extra amount to pay', s: 'Your updated Kyleu invoice {ref}', b: function (b) { return 'Hi {first},\n\nThank you for letting us know about the change to your booking {ref}. Your new total is {total}. You have already paid {paid}, so {balance} is still to pay.\n\nThe updated invoice is attached. Please pay the {balance} by EFT using reference {ref} before you arrive on {ci}.\n\nThe Kyleu team'; } },
    finalise: { t: 'Finalise your booking (link)', s: 'Finalise your Kyleu booking {ref}', b: function (b) { return 'Hi {first},\n\nThank you, your booking {ref} for {stand}, {ci} to {co}, is paid in full.\n\nPlease finalise it here: tell us your vehicles and who is in each one, sign the indemnity, roughly when you arrive, and anything you want waiting from the camp shop.\n{link}\n\nRather not use the website? Just reply with the details and we will add them for you.\n\nThe Kyleu team'; } },
    link: { t: 'Link to the booking', s: 'Your Kyleu booking {ref}', b: function (b) { return 'Hi {first},\n\nHere is the link to your booking {ref} ({stand}, {ci} to {co}):\n{link}\n\nUse it to tell us when you have paid, or to change the number of guests or your contact details. Once your booking is paid in full, the same link lets you finalise it: vehicles, passengers and arrival time.\n\nThe Kyleu team'; } },
    details: { t: 'Ask for vehicle details', s: 'Your Kyleu stay: vehicle details please', b: function (b) { return 'Hi {first},\n\nWe look forward to welcoming you on {ci}. Before you arrive, please send us each vehicle\'s registration, the driver and everyone travelling in it. Everyone also signs our indemnity online, and we send one Dinokeng Conservation Fee Discount Voucher per vehicle, so this makes your arrival much quicker.\n\nYou can add them yourself here: {link}\nOr simply reply to this message.\n\nThe Kyleu team'; } },
    confirm: { t: 'Booking confirmation', s: 'Booking confirmed: {ref}', b: function (b) { return 'Hi {first},\n\nYour booking {ref} is confirmed: {stand}, {ci} to {co}.\n' + (b && b.onArrival && balance(b) > 0 ? 'Total {total}. As arranged with Kyleu, you pay {balance} when you arrive (' + (/card/i.test(b.onArrival.how) ? 'by card' : 'in cash') + ').' : 'Total {total}, paid {paid}, balance {balance} due by {baldue}.') + '\n\nThe Kyleu team'; } }
  };
  function fill(t, b) {
    var dcodes = (b.cars || []).map(function (c) { return c.dgr; }).filter(Boolean);
    var map = { checkin: checkInTime(), checkout: checkOutTime(), qdays: validDays(String(b.created || TODAY).slice(0, 10), depositDue(b)), doc: b && b.payments && paid(b) > 0 ? 'invoice' : 'quotation', bank: bankLine(), qvalid: fd(depositDue(b), { weekday: 'long', day: 'numeric', month: 'long' }), link: bookingLink(b), signlink: signLink(b), voucher: dcodes.length ? dcodes.join(', ') : 'the codes we send you', first: b.guest.first, stand: standById(b.stand).name, ci: fd(b.ci, { weekday: 'long', day: 'numeric', month: 'long' }), co: fd(b.co, { weekday: 'long', day: 'numeric', month: 'long' }), deposit: money(deposit(b)), depdue: fd(depositDue(b), { day: 'numeric', month: 'long' }), ref: b.ref, balance: money(balance(b)), baldue: fd(balanceDue(b), { day: 'numeric', month: 'long' }), total: money(b.total), paid: money(paid(b)) };
    return t.replace(/\{(\w+)\}/g, function (_, k) { return map[k] != null ? map[k] : _; });
  }
  function actRemind(ref) { var b = byRef(ref); sendTemplate(b, defaultTemplate(b)); }
  function actCancel(ref) {
    var b = byRef(ref), pd = paid(b), mayRefund = pd > 0 && can('payments'), first = b.guest.first;
    modal('Cancel ' + esc(b.ref) + '?', '<p>' + esc(guestName(b)) + ' · ' + esc(standById(b.stand).name) + ' · arriving ' + fdw(b.ci) + ' (' + rel(b.ci) + ').</p>' +
      '<div class="callout"><b>Cancellation policy</b><br>No refunds. What the guest has paid is kept as a credit to use on another date that suits Kyleu and the guest. Offer to move the booking first.</div>' +
      (pd > 0 ? '<div class="lines"><div class="ln tot"><span>Paid so far</span><span>' + money(pd) + '</span></div></div>' +
        '<span class="fld-l">What happens to the money?</span><div class="cr-opts">' +
        '<label class="cr-opt"><input type="radio" name="what" value="credit" checked><span><b>Keep it as a credit for another stay</b><small>' + esc(first) + ' gets a credit code to use on the website, or to give you when booking by WhatsApp or phone.</small></span></label>' +
        '<div class="cr-sub" data-credit-flds><div class="grid2"><label class="fld"><span>Credit amount (R)</span><input name="camt" inputmode="decimal" value="' + pd + '"></label><label class="fld"><span>Use by (empty = no end date)</span><input type="date" name="until" min="' + TODAY + '"></label></div>' +
        '<p class="hint" data-credit-hint></p>' + (b.guest.email ? '' : '<p class="muted small">' + ic('info') + ' There is no email address on this booking, so the code cannot be emailed. Give it to ' + esc(first) + ' by WhatsApp or phone.</p>') + '</div>' +
        (mayRefund ? '<label class="cr-opt"><input type="radio" name="what" value="refund"><span><b>Refund the money instead (a management decision)</b><small>No credit is given. A refund of ' + money(pd) + ' is recorded on the booking.</small></span></label>' : '') + '</div>' +
        (mayRefund ? '' : '<p class="muted small">' + ic('info') + ' A refund instead of credit is a management decision: ask an owner or manager.</p>') : '') +
      '<label class="fld"><span>Reason</span><input name="why" placeholder="e.g. Guest emailed, family emergency"></label>',
      'Cancel booking', function (f) {
        var pick = $('[name=what]:checked', f), refund = mayRefund && !!pick && pick.value === 'refund', camt = 0, until = '', cr = null;
        if (pd > 0 && !refund) {
          camt = randOf(fval(f, 'camt')); until = fval(f, 'until');
          if (isNaN(camt)) { toast('Enter the credit amount (0 for no credit)'); return false; }
          if (camt > pd) { toast('The credit cannot be more than the ' + money(pd) + ' that was paid'); return false; }
          if (until && until < TODAY) { toast('The use by date cannot be in the past'); return false; }
        }
        b.status = 'cancelled'; b.pop = false;
        if (b.cancelReq && !b.cancelReq.done) b.cancelReq.done = { at: nowStamp(), by: ME.name };   // the guest's cancellation request is dealt with
        if (refund) b.payments.push({ d: TODAY, amt: -pd, m: (b.payments.filter(function (p) { return p.m !== 'credit'; })[0] || { m: 'eft' }).m, type: 'Refund', ref: 'Refund ' + b.ref });
        else if (camt > 0) { cr = creditFix({ id: uid('c'), code: creditCode(), email: b.guest.email, name: guestName(b), amt: camt, used: 0, from: b.ref, d: TODAY, until: until, note: '' }); DB.credits.push(cr); }
        var mailed = cr ? creditMail(cr) : false;
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Cancelled. ' + (fval(f, 'why') || '') + (pd > 0 ? (refund ? ' Refunded ' + money(pd) + '.'
          : cr ? ' ' + money(camt) + ' kept as credit' + (camt < pd ? ', ' + money(pd - camt) + ' not credited' : '') + ' for another stay. Credit code ' + cr.code + ', ' + (until ? 'use by ' + fdy(until) : 'no end date') + '.' + (mailed ? ' The code was emailed to ' + cr.email + '.' : ' No email address, so the code was not emailed.')
          : ' ' + money(pd) + ' not credited.') : '') });
        log('Booking ' + b.ref + ' cancelled' + (cr ? ': ' + money(camt) + ' kept as credit ' + cr.code + (camt < pd ? ', ' + money(pd - camt) + ' not credited' : '') : refund ? ': ' + money(pd) + ' refunded' : pd > 0 ? ': ' + money(pd) + ' not credited' : ''), b.ref); save(); refresh();
        toast('Booking cancelled. ' + (cr ? money(camt) + ' kept as credit for ' + esc(first) + ', code <b>' + esc(cr.code) + '</b>' + (until ? ', use by ' + fdy(until) : '') + '.' + (mailed ? ' The code was emailed.' : '') : refund ? money(pd) + ' refunded. The stand is free again.' : 'The stand is free again.'));
      }, { danger: true, cancelLabel: 'Keep the booking', onOpen: function (f) {
        if (pd <= 0) return;
        var upd = function () {
          var pick = $('[name=what]:checked', f), refund = !!pick && pick.value === 'refund', a = randOf(fval(f, 'camt'));
          $('[data-credit-flds]', f).hidden = refund;
          $('[data-credit-hint]', f).innerHTML = refund || isNaN(a) ? '' : a > pd ? '<span class="bad-t">The credit cannot be more than the ' + money(pd) + ' that was paid.</span>'
            : a < pd ? '<b>' + money(pd - a) + '</b> is not credited: ' + esc(first) + ' gets ' + (a > 0 ? 'a credit of <b>' + money(a) + '</b>.' : 'no credit.') : esc(first) + ' gets the full <b>' + money(pd) + '</b> as a credit.';
        };
        $$('input', f).forEach(function (x) { x.addEventListener('input', upd); x.addEventListener('change', upd); }); upd();
      } });
  }

  /* ---------- credits: money kept from a cancelled booking (no refunds), used on the guest's next stay ----------
     DB.credits[i] = { id, code, email, name, amt, used, from, d, until, note, void }. The website reads the same list:
     the guest types the code under "Have a credit?" (or opens stay.html?credit=CODE), with the email it was given to. */
  function randOf(v) { var n = parseFloat(String(v).replace(/[^\d.]/g, '')); return isNaN(n) ? NaN : Math.round(n * 100) / 100; }
  function fdy(s) { return fd(s, { day: 'numeric', month: 'short', year: 'numeric' }); }
  // the code a guest types: "KC-" and 6 characters (no 0, O, 1, I or L: they look alike). With a seed it is the same every time (demo data).
  function creditCode(seed, list) {
    var abc = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789', s = String(seed || ''), h = 7, i, r, code;
    list = list || (DB && DB.credits) || [];
    for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
    r = s ? rng(h) : Math.random;
    do { code = 'KC-'; for (i = 0; i < 6; i++) code += abc.charAt(Math.floor(r() * abc.length)); } while (list.some(function (c) { return c.code === code; }));
    return code;
  }
  // every credit has all its fields (older ones had no code, end date or note)
  function creditFix(c, list) { c.email = normEmail(c.email); if (!c.code) c.code = creditCode(c.id, list); c.amt = +c.amt || 0; c.used = +c.used || 0; c.from = c.from || ''; c.until = c.until || ''; c.note = c.note || ''; return c; }
  function creditById(id) { return id ? DB.credits.filter(function (c) { return c.id === id; })[0] : null; }
  function creditByCode(code) { var k = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return k ? DB.credits.filter(function (c) { return String(c.code || '').replace(/[^A-Z0-9]/g, '') === k; })[0] : null; }
  function creditRest(c) { return Math.max(0, (c.amt || 0) - (c.used || 0)); }
  // usable: not cancelled by staff, something left, and not past its last day
  function creditOk(c) { return !c.void && c.amt - c.used > 0 && (!c.until || c.until >= TODAY); }
  function creditState(c) { return c.void ? { k: 'void', t: 'Cancelled', tone: 'muted' } : c.amt - c.used <= 0 ? { k: 'used', t: 'Used up', tone: 'muted' } : c.until && c.until < TODAY ? { k: 'expired', t: 'Expired', tone: 'bad' } : { k: 'open', t: 'Open', tone: 'ok' }; }
  // a guest's usable credits, the one that runs out first on top (it is used first)
  function creditsFor(email) { email = normEmail(email); return email ? DB.credits.filter(function (c) { return c.email === email && creditOk(c); }).sort(function (a, b) { return (a.until || '9') < (b.until || '9') ? -1 : (a.until || '9') > (b.until || '9') ? 1 : 0; }) : []; }
  function creditLeft(email) { return creditsFor(email).reduce(function (a, c) { return a + c.amt - c.used; }, 0); }
  // pay (part of) a booking with a credit: its own payment line, never new income in the reports (that money came in on the cancelled booking)
  function creditPay(b, c, amt, day) {
    var take = Math.min(amt, creditRest(c)); if (!(take > 0)) return 0;
    c.used += take;
    b.payments.push({ d: day || TODAY, amt: take, m: 'credit', type: 'Credit', ref: 'Credit ' + c.code + (c.from ? ' from ' + c.from : ''), credit: c.id });
    return take;
  }
  // the bookings a credit was used on
  function creditUses(c) { var out = []; DB.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (p.m === 'credit' && (p.credit === c.id || String(p.ref || '').indexOf('Credit ' + c.code) === 0)) out.push({ ref: b.ref, amt: p.amt }); }); }); return out; }
  // "R650 (code KC-AB12CD, use by 12 Nov 2027)" for every credit the guest can still use
  function creditList(email, sep) { return creditsFor(email).map(function (c) { return '<b>' + money(creditRest(c)) + '</b> (code <span class="code">' + esc(c.code) + '</span>, ' + (c.until ? 'use by ' + fdy(c.until) : 'no end date') + ')'; }).join(sep || ' and '); }
  function creditCopy(c) { return '<span class="code">' + esc(c.code) + '</span> <button type="button" class="link-btn" data-copy="' + esc(c.code) + '">Copy code</button>'; }
  // on the booking a credit came from: what was kept, the code, what is left
  function creditFromHTML(b) {
    return DB.credits.filter(function (c) { return c.from === b.ref; }).map(function (c) {
      var s = creditState(c), uses = creditUses(c);
      return '<div class="callout cflex cr-box' + (s.k === 'open' ? ' ok' : '') + '">' + ic('gift') + '<div><b>' + money(c.amt) + ' kept as a credit for another stay</b> ' + pill(s) +
        '<br>Code ' + creditCopy(c) + '<br>' +
        (c.void ? 'This credit was cancelled' + (c.voided ? ' by ' + esc(c.voided.by) + ' (' + esc(atNice(c.voided.at)) + ')' + (c.voided.why ? ': ' + esc(c.voided.why) : '') : '') + '.'
          : '<b>' + money(creditRest(c)) + ' left</b>' + (c.used ? ', ' + money(c.used) + ' used' + (uses.length ? ' on ' + uses.map(function (u) { return '<button type="button" class="link-btn" data-open="' + esc(u.ref) + '">' + esc(u.ref) + '</button>'; }).join(', ') : '') : '') + ' · ' + (c.until ? 'use by ' + fdy(c.until) : 'no end date')) +
        (s.k === 'open' && c.email || (can('payments') && !c.void) ? '<div class="row-btns">' + (s.k === 'open' && c.email ? '<button type="button" class="btn ghost sm" data-act="credit-mail" data-ref="' + esc(c.id) + '">' + ic('send') + 'Email the code again</button>' : '') + (can('payments') && !c.void ? '<button type="button" class="btn ghost sm" data-act="credit-edit" data-ref="' + esc(c.id) + '">' + ic('edit') + 'Change</button>' : '') + '</div>' : '') + '</div></div>';
    }).join('');
  }
  function creditLink(c) { return new URL('../stay.html?credit=' + encodeURIComponent(c.code), location.href).href; }
  // the email that tells the guest about their credit and how to use it
  function creditMsg(c) {
    var b = c.from ? byRef(c.from) : null, first = b ? b.guest.first : String(c.name || '').split(' ')[0], WD = { weekday: 'long', day: 'numeric', month: 'long' };
    return { subject: c.from ? 'Booking ' + c.from + ' cancelled: your Kyleu credit ' + c.code : 'Your Kyleu credit ' + c.code,
      body: 'Hi ' + (first || 'there') + ',\n\n' +
        (c.from ? 'Your booking ' + c.from + (b ? ' (' + standById(b.stand).name + ', ' + fd(b.ci, WD) + ' to ' + fd(b.co, WD) + ')' : '') + ' is cancelled.\n\nWe do not give refunds, so ' + money(c.amt) + ' is kept as a credit for your next stay at Kyleu.'
          : 'We have given you a credit of ' + money(c.amt) + ' for your next stay at Kyleu.') + '\n\n' +
        'Your credit code: ' + c.code + '\n' +
        'Credit: ' + money(c.amt) + (c.used ? ' (' + money(creditRest(c)) + ' still to use)' : '') + '\n' +
        (c.until ? 'Use by: ' + fd(c.until, { day: 'numeric', month: 'long', year: 'numeric' }) : 'Your credit does not run out: use it whenever it suits you.') + '\n\n' +
        'Book your next stay on our website and type this code under \'Have a credit?\' when you check your booking, or open this link:\n' + creditLink(c) + '\n\n' +
        'You can also tell us the code when you book by WhatsApp or phone.\n\n' +
        'The credit must be used with the same email address as ' + (c.from ? 'the cancelled booking' : 'this email') + ': ' + c.email + '\n\n' +
        'The Kyleu team' };
  }
  // sent like any other staff email: it shows in the Inbox and under the booking's messages
  function creditMail(c) {
    if (!c.email) return false;
    var m = creditMsg(c), b = c.from ? byRef(c.from) : null, body = m.body + (mySig() ? '\n\n--\n' + sigText(mySig()) : ''), cl;
    if (b) logEmail(b, m.subject, body, [], c.email);
    else { cl = findClient(c.email, ''); DB.threads.push({ id: uid('t'), subject: m.subject, name: c.name || c.email, email: c.email, phone: cl ? cl.phone : '', status: 'waiting', unread: false, ref: '', msgs: [{ from: 'staff', by: ME.name, at: nowStamp(), body: body, att: [] }] }); }
    c.sent = { at: nowStamp(), by: ME.name };
    return true;
  }
  function actCreditMail(id) {
    var c = creditById(id); if (!c) return;
    var k = creditState(c).k;
    if (k !== 'open') { toast(k === 'expired' ? 'This credit has run out. Change the use by date first.' : k === 'void' ? 'This credit was cancelled' : 'This credit is used up'); return; }
    if (!c.email) { toast('There is no email address for this credit'); return; }
    modal('Email the code again?', '<p>To <b>' + esc(c.email) + '</b></p><div class="callout cr-msg">' + esc(creditMsg(c).body) + '</div>', 'Send email', function () {
      creditMail(c); log('Credit code ' + c.code + ' emailed again to ' + c.email, c.from); save(); refresh();
      toast('Code emailed to ' + esc(c.email) + ' (demo: nothing really leaves this browser)');
    }, { noFocus: true });
  }
  function actCreditEdit(id) {
    var c = creditById(id); if (!c || !can('payments')) return;
    modal('Change credit ' + esc(c.code), '<p class="muted small">' + esc(c.name || c.email) + ' · ' + (c.from ? 'from booking ' + esc(c.from) : 'given by hand') + ' · ' + money(c.used) + ' used so far</p>' +
      '<div class="grid2"><label class="fld"><span>Amount (R)</span><input name="amt" inputmode="decimal" value="' + c.amt + '"></label><label class="fld"><span>Use by (empty = no end date)</span><input type="date" name="until" value="' + esc(c.until) + '"></label></div>' +
      '<label class="fld"><span>Note (only staff see it)</span><input name="note" value="' + esc(c.note) + '" placeholder="e.g. Agreed with Sherri"></label>',
      'Save', function (f) {
        var amt = randOf(fval(f, 'amt')), until = fval(f, 'until'), note = fval(f, 'note'), ch = [];
        if (isNaN(amt) || amt <= 0) { toast('Enter the credit amount'); return false; }
        if (amt < c.used) { toast(money(c.used) + ' of this credit is already used, so it cannot be less than that'); return false; }
        if (amt !== c.amt) ch.push('amount ' + money(c.amt) + ' to ' + money(amt));
        if (until !== c.until) ch.push('use by ' + (c.until ? fdy(c.until) : 'no end date') + ' to ' + (until ? fdy(until) : 'no end date'));
        if (note !== c.note) ch.push('note ' + (note ? '"' + note + '"' : 'removed'));
        if (!ch.length) return;
        c.amt = amt; c.until = until; c.note = note;
        log('Credit ' + c.code + ' for ' + (c.name || c.email) + ' changed: ' + ch.join(', '), c.from); save(); refresh(); toast('Credit ' + esc(c.code) + ' changed');
      });
  }
  function actCreditVoid(id) {
    var c = creditById(id); if (!c || c.void || !can('payments')) return;
    var rest = creditRest(c), who = c.name || c.email;
    modal('Cancel credit ' + esc(c.code) + '?', '<p><b>' + money(rest) + '</b> of ' + esc(who) + '\'s credit can then no longer be used, and the code stops working on the website.' + (c.used ? ' The ' + money(c.used) + ' already used stays as it is.' : '') + '</p>' +
      '<label class="fld"><span>Reason</span><input name="why" placeholder="e.g. Refunded instead, given by mistake"></label>',
      'Cancel credit', function (f) {
        var why = fval(f, 'why'), fb = c.from ? byRef(c.from) : null; if (!why) { toast('Say why the credit is cancelled'); return false; }
        c.void = true; c.voided = { at: nowStamp(), by: ME.name, why: why };
        if (fb) fb.notes.push({ at: nowStamp(), by: ME.name, text: 'Credit ' + c.code + ' cancelled (' + money(rest) + ' was left): ' + why });
        log('Credit ' + c.code + ' for ' + who + ' cancelled (' + money(rest) + ' was left): ' + why, c.from); save(); refresh(); toast('Credit ' + esc(c.code) + ' cancelled');
      }, { danger: true, cancelLabel: 'Keep the credit' });
  }
  // a goodwill credit that does not come from a cancelled booking
  function actCreditNew() {
    if (!can('payments')) return;
    var gs = guestsList().filter(function (g) { return g.email; });
    modal('Give a credit', '<p class="muted small">For a goodwill credit that does not come from a cancelled booking. The guest gets a code to use on their next booking.</p>' +
      '<label class="fld"><span>Guest\'s email</span><input name="email" type="email" list="credit-emails" autocomplete="off" placeholder="Pick a client or type an email address"><datalist id="credit-emails">' + gs.map(function (g) { return '<option value="' + esc(g.email) + '">' + esc(g.name) + '</option>'; }).join('') + '</datalist></label>' +
      '<label class="fld"><span>Guest\'s name</span><input name="name" autocomplete="off"></label>' +
      '<div class="grid2"><label class="fld"><span>Amount (R)</span><input name="amt" inputmode="decimal"></label><label class="fld"><span>Use by (empty = no end date)</span><input type="date" name="until" min="' + TODAY + '"></label></div>' +
      '<label class="fld"><span>Note (only staff see it)</span><input name="note" placeholder="e.g. Sorry for the water problem at Stand 4"></label>' +
      '<label class="check"><input type="checkbox" name="mail" checked><span>Email the code to the guest</span></label>',
      'Give credit', function (f) {
        var email = normEmail(fval(f, 'email')), name = fval(f, 'name'), amt = randOf(fval(f, 'amt')), until = fval(f, 'until');
        if (!/.+@.+\..+/.test(email)) { toast('Enter the guest\'s email address'); return false; }
        if (!name) { toast('Enter the guest\'s name'); return false; }
        if (isNaN(amt) || amt <= 0) { toast('Enter the credit amount'); return false; }
        if (until && until < TODAY) { toast('The use by date cannot be in the past'); return false; }
        var c = creditFix({ id: uid('c'), code: creditCode(), email: email, name: name, amt: amt, used: 0, from: '', d: TODAY, until: until, note: fval(f, 'note'), by: ME.name });
        DB.credits.push(c);
        var mailed = fval(f, 'mail') && creditMail(c);
        log('Credit ' + c.code + ' of ' + money(amt) + ' given to ' + name + (until ? ', use by ' + fdy(until) : '') + (c.note ? ': ' + c.note : '')); save(); refresh();
        toast('Credit of ' + money(amt) + ' given to ' + esc(name) + ', code <b>' + esc(c.code) + '</b>.' + (mailed ? ' The code was emailed.' : ''));
      }, { onOpen: function (f) {
        // picking a known client fills in their name
        var em = f.elements.email, nm = f.elements.name, fillName = function () { var g = gs.filter(function (x) { return normEmail(x.email) === normEmail(em.value); })[0]; if (g && (!nm.value || nm.dataset.auto === '1')) { nm.value = g.name; nm.dataset.auto = '1'; } };
        em.addEventListener('input', fillName); em.addEventListener('change', fillName); nm.addEventListener('input', function () { nm.dataset.auto = ''; });
      } });
  }
  // Payments > Credits: every credit, what is left of it, and what staff can do with it
  function creditsHTML() {
    var all = DB.credits.slice().sort(function (a, b) { return a.d < b.d ? 1 : a.d > b.d ? -1 : 0; }), q = PAYF.q.toLowerCase(), qk = q.replace(/[\s\-]/g, '');
    var tot = function (l, f) { return money(l.reduce(function (a, c) { return a + f(c); }, 0)); }, n = function (l) { return l.length + ' credit' + (l.length === 1 ? '' : 's'); };
    var open = all.filter(creditOk), soon = open.filter(function (c) { return c.until && diff(TODAY, c.until) <= 30; }), usedL = all.filter(function (c) { return c.used > 0; });
    var list = all.filter(function (c) { var h = (c.name + ' ' + c.email + ' ' + c.code + ' ' + c.from + ' ' + c.note).toLowerCase(); return (!PAYF.cst || creditState(c).k === PAYF.cst) && (!q || h.indexOf(q) >= 0 || (qk && h.replace(/[\s\-]/g, '').indexOf(qk) >= 0)); });
    return '<div class="kpis">' + tile('Open credits', tot(open, creditRest), n(open) + ' still to use') + tile('Used so far', tot(usedL, function (c) { return c.used; }), 'paid for other stays') + tile('Run out in the next 30 days', tot(soon, creditRest), n(soon), null, soon.length ? 'warn' : '') + '</div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-payq placeholder="Search name, email, code or booking" value="' + esc(PAYF.q) + '" aria-label="Search credits"></label></div>' +
      '<div class="chips">' + [['', 'All'], ['open', 'Open'], ['used', 'Used up'], ['expired', 'Expired'], ['void', 'Cancelled']].map(function (o) { return '<button class="chip' + (PAYF.cst === o[0] ? ' on' : '') + '" data-crst="' + o[0] + '">' + o[1] + ' <span>' + all.filter(function (c) { return !o[0] || creditState(c).k === o[0]; }).length + '</span></button>'; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl ledger credits" data-sort-key="credits"><thead><tr><th>Guest</th><th>Code</th><th>Given</th><th class="r">Amount</th><th class="r">Used</th><th class="r">Left</th><th>Use by</th><th>State</th><th></th></tr></thead><tbody>' +
      (list.length ? list.map(function (c) {
        var s = creditState(c), fb = c.from ? byRef(c.from) : null, uses = creditUses(c), id = esc(c.id);
        return '<tr' + (c.void ? ' class="off"' : '') + '><td data-l="Guest"><b>' + esc(c.name || 'No name') + '</b><small>' + esc(c.email || 'No email address') + '</small>' + (c.note ? '<small class="cr-note">' + esc(c.note) + '</small>' : '') + '</td>' +
          '<td data-l="Code"><span class="code">' + esc(c.code) + '</span><button type="button" class="icon-btn sm" data-copy="' + esc(c.code) + '" aria-label="Copy the code ' + esc(c.code) + '" title="Copy code">' + ic('note') + '</button>' +
          '<small>' + (c.from ? 'From ' + (fb ? '<button type="button" class="link-btn" data-open="' + esc(c.from) + '">' + esc(c.from) + '</button>' : esc(c.from)) : 'Given by hand' + (c.by ? ' by ' + esc(c.by) : '')) + '</small></td>' +
          '<td data-l="Given" data-s="' + esc(c.d) + '">' + fdy(c.d) + '</td>' +
          '<td data-l="Amount" class="r amt">' + money(c.amt) + '</td>' +
          '<td data-l="Used" class="r">' + money(c.used) + (uses.length ? '<small>' + uses.map(function (u) { return '<button type="button" class="link-btn" data-open="' + esc(u.ref) + '">' + esc(u.ref) + '</button>'; }).join(' ') + '</small>' : '') + '</td>' +
          '<td data-l="Left" class="r amt">' + (c.void ? '<s>' + money(creditRest(c)) + '</s>' : money(creditRest(c))) + '</td>' +
          '<td data-l="Use by" data-s="' + esc(c.until || '9999-12-31') + '">' + (c.until ? fdy(c.until) + (s.k === 'open' && diff(TODAY, c.until) <= 30 ? '<small class="warn-t">' + rel(c.until) + '</small>' : '') : '<span class="muted">No end date</span>') + '</td>' +
          '<td data-l="State">' + pill(s) + (c.void && c.voided && c.voided.why ? '<small>' + esc(c.voided.why) + '</small>' : '') + '</td>' +
          '<td class="r row-btn">' + (s.k === 'open' && c.email ? '<button type="button" class="btn sm ghost" data-act="credit-mail" data-ref="' + id + '" title="Email the code again">' + ic('send') + 'Email the code again</button>' : '') +
          (c.void ? '' : '<button type="button" class="btn sm ghost" data-act="credit-edit" data-ref="' + id + '">' + ic('edit') + 'Change</button>') +
          (c.void || s.k === 'used' ? '' : '<button type="button" class="btn sm ghost" data-act="credit-void" data-ref="' + id + '">' + ic('x') + 'Cancel credit</button>') + '</td></tr>';
      }).join('') : '<tr><td colspan="9" class="empty">' + (all.length ? 'No credits match.' : 'No credits yet. A credit is made when a paid booking is cancelled, or with Give a credit.') + '</td></tr>') + '</tbody></table></div>' +
      '<p class="demo-note">' + ic('info') + 'No refunds: when a paid booking is cancelled, the money is kept as a credit. The guest uses the code on the website under "Have a credit?", or gives it to you when booking by WhatsApp or phone. Money paid with a credit is not counted as income again.</p>';
  }
  function actEdit(ref) {
    var b = byRef(ref), cl = clientById(b.cid), closed = b.status === 'out' || b.status === 'cancelled', inCamp = b.status === 'in';
    var lockAll = closed ? ' disabled' : '', lockCi = closed || inCamp ? ' disabled' : '', n = cl ? clientBookings(cl).length : 1, ex = b.extras || {};
    var srcs = ['Website', 'Phone', 'WhatsApp', 'Email', 'Walk-in']; if (srcs.indexOf(b.source) < 0) srcs.push(b.source);
    var tellTouched = false;
    var read = function (f) { return { ci: fval(f, 'ci'), co: fval(f, 'co'), stand: fval(f, 'stand'), adults: +fval(f, 'adults') || 0, pens: +fval(f, 'pens') || 0, kids: +fval(f, 'kids') || 0, vehicles: Math.max(0, Math.min(20, +fval(f, 'veh') || 0)), eta: fval(f, 'eta'), gd: +fval(f, 'gd') || 0 }; };
    var veh0 = vehKnown(b) ? ensureCars(b).length : 0;   // 0: not given yet (the box stays empty)
    var priceOf = function (s) { var q0 = quote(b.stand, b.ci, b.co, b, ex), q1 = quote(s.stand, s.ci, s.co, s, Object.assign({}, ex, { gd: s.gd })); return { de: q1.eft - q0.eft, dc: q1.card - q0.card, nights: q1.nights }; };
    modal('Edit booking ' + esc(b.ref),
      '<h5 class="m-h">Guest</h5>' +
      '<div class="grid2"><label class="fld"><span>First name</span><input name="first" value="' + esc(b.guest.first) + '"></label><label class="fld"><span>Surname</span><input name="last" value="' + esc(b.guest.last) + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Mobile</span><input name="phone" inputmode="tel" value="' + esc(b.guest.phone) + '"></label><label class="fld"><span>Email</span><input name="email" type="email" value="' + esc(b.guest.email) + '"></label></div>' +
      (n > 1 ? '<p class="hint">' + ic('info') + ' These are ' + esc(b.guest.first) + '\'s client details, so ' + (n === 2 ? 'their other booking updates' : 'their other ' + (n - 1) + ' bookings update') + ' too.</p>' : '') +
      '<h5 class="m-h">Stay</h5>' + (closed ? '<p class="hint">' + (b.status === 'out' ? 'This stay is over' : 'This booking is cancelled') + ', so the dates, stand and guests are locked.</p>' : inCamp ? '<p class="hint">' + esc(b.guest.first) + ' is in camp, so the arrival date and stand stay as they are. You can still extend or shorten the stay.</p>' : '') +
      '<div class="grid2"><label class="fld"><span>Arrive</span><input type="date" name="ci" value="' + b.ci + '"' + lockCi + '></label><label class="fld"><span>Depart</span><input type="date" name="co" value="' + b.co + '"' + lockAll + '></label></div>' +
      '<label class="fld"><span>Stand</span><select name="stand"' + lockCi + '>' + standOptions(b.stand) + '</select></label>' +
      '<div class="grid3"><label class="fld"><span>Adults</span><input type="number" min="0" max="40" name="adults" value="' + b.adults + '"' + lockAll + '></label><label class="fld"><span>Pensioners</span><input type="number" min="0" max="40" name="pens" value="' + b.pens + '"' + lockAll + '></label><label class="fld"><span>Kids under 12</span><input type="number" min="0" max="40" name="kids" value="' + b.kids + '"' + lockAll + '></label></div>' +
      '<div class="grid3"><label class="fld"><span>Vehicles</span><input type="number" min="1" max="20" name="veh" value="' + (veh0 || '') + '" placeholder="Not given yet"' + lockAll + '></label><label class="fld"><span>Arrival time</span><select name="eta"' + lockAll + '>' + [''].concat(b.eta && etaChoices().indexOf(b.eta) < 0 ? [b.eta] : [], etaChoices()).map(function (t) { return '<option value="' + esc(t) + '"' + ((b.eta || '') === t ? ' selected' : '') + '>' + esc(t ? (/^\d{1,2}:\d{2}$/.test(t) ? 'Around ' + t : etaNice(t)) : 'Not given') + '</option>'; }).join('') + '</select></label><label class="fld"><span>Game drive (people)</span><input type="number" min="0" max="10" name="gd" value="' + (ex.gd || 0) + '"' + lockAll + '></label></div>' +
      '<label class="fld"><span>Booked via</span><select name="source">' + srcs.map(function (x) { return '<option' + (x === b.source ? ' selected' : '') + '>' + esc(x) + '</option>'; }).join('') + '</select></label>' +
      '<div class="quote-box" data-q></div>' +
      '<label class="fld"><span>Reason for the change (optional, saved in the notes)</span><input name="why" placeholder="e.g. Guest phoned to add a night"></label>' +
      '<label class="check"><input type="checkbox" name="tell"><span>Let ' + esc(b.guest.first) + ' know about the change (opens the send box)</span></label>',
      'Save changes', function (f) {
        var g = { first: fval(f, 'first'), last: fval(f, 'last'), email: fval(f, 'email'), phone: fval(f, 'phone') }, s = read(f), why = fval(f, 'why'), src = fval(f, 'source'), changes = [];
        if (!g.first || !g.last) { toast('Add the guest\'s name'); return false; }
        if (!g.phone && !g.email) { toast('Add a mobile number or an email address'); return false; }
        if (g.email && !/.+@.+\..+/.test(g.email)) { toast('That email address does not look right'); return false; }
        var moved = s.ci !== b.ci || s.co !== b.co || s.stand !== b.stand;
        if (!closed) {
          if (s.co <= s.ci) { toast('Departure must be after arrival'); return false; }
          if (!s.adults && !s.pens) { toast('Add at least one adult'); return false; }
          if (moved && overlaps(s.stand, s.ci, s.co, b.ref)) { toast('That stand is not free for those nights'); return false; }
        }
        var dup = findClient(g.email, g.phone, b.cid);
        if (dup && cl && clientBookings(cl).length > 1) { toast('That ' + (g.email && normEmail(dup.email) === normEmail(g.email) ? 'email address' : 'number') + ' belongs to ' + esc(clientName(dup)) + '. Open their client card instead.'); return false; }
        if (dup) {   // the booking was made under the wrong details: move it to the client who already has them
          var lone = cl; b.cid = dup.id; syncBooking(b); changes.push('linked to existing client ' + clientName(dup));
          if (lone && !clientBookings(lone).length) DB.clients.splice(DB.clients.indexOf(lone), 1);
        } else if (cl) { var cc = clientChanges(cl, g); if (cc.length) { applyClient(cl, g); changes = changes.concat(cc); } }
        if (!closed) {
          var p = priceOf(s), st0 = standById(b.stand), ppl = peopleTxt;
          if (s.ci !== b.ci) changes.push('arrive ' + fd(b.ci) + ' to ' + fd(s.ci));
          if (s.co !== b.co) changes.push('depart ' + fd(b.co) + ' to ' + fd(s.co));
          if (s.stand !== b.stand) changes.push('stand ' + st0.name + ' to ' + standById(s.stand).name);
          if (s.adults !== b.adults || s.pens !== b.pens || s.kids !== b.kids) changes.push('guests ' + ppl(b) + ' to ' + ppl(s));
          if (!s.vehicles) s.vehicles = veh0;   // left empty: nothing changes
          if (s.vehicles !== veh0) changes.push('vehicles ' + (veh0 || 'not given') + ' to ' + s.vehicles);
          if (s.eta !== (b.eta || '')) changes.push('arrival time ' + (b.eta || 'blank') + ' to ' + (s.eta || 'blank'));
          if (s.gd !== (ex.gd || 0)) changes.push('game drive ' + (ex.gd || 0) + ' to ' + s.gd + ' people');
          var oldTotal = b.total, wasFull = paid(b) > 0 && paid(b) >= b.total;
          b.ci = s.ci; b.co = s.co; b.stand = s.stand; b.adults = s.adults; b.pens = s.pens; b.kids = s.kids; if (s.vehicles !== veh0) { vehSaid(b); b.vehicles = s.vehicles; fitCars(b); } b.eta = s.eta; b.extras = Object.assign({}, ex, { gd: s.gd });
          // an open size check follows the edit: gone when the group now fits the usual size, otherwise it shows the new numbers
          if (b.sizeCheck && !b.sizeCheck.done) { var ug = standById(b.stand).guests || 8; if (people(b) <= ug) delete b.sizeCheck; else { b.sizeCheck.people = people(b); b.sizeCheck.usual = ug; } }
          // shift the price by the difference, so discounts and shop charges already on the booking stay
          b.eft += p.de; b.card += p.dc; b.total += b.method === 'card' ? p.dc : p.de;
          if (b.total !== oldTotal) changes.push('total ' + money(oldTotal) + ' to ' + money(b.total));
          if (wasFull && b.total > oldTotal && balance(b) > 0) b.extraDue = { at: nowStamp(), amt: balance(b), why: 'The total went up after paying in full' };
        }
        if (src !== b.source) { changes.push('booked via ' + b.source + ' to ' + src); b.source = src; }
        if (!changes.length) { toast('Nothing was changed'); return; }
        if (b.status === 'pending' && paid(b) > 0 && paid(b) >= deposit(b)) b.status = 'confirmed';
        var txt = changes.join('; '); txt = txt.charAt(0).toUpperCase() + txt.slice(1);
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Booking edited: ' + txt + '.' + (why ? ' Reason: ' + why : '') });
        if (fval(f, 'tell')) setTimeout(function () { sendTemplate(b, extraDue(b) ? 'extra' : 'update'); }, 0);
        log('Booking ' + b.ref + ' edited', b.ref); save(); refresh();
        toast(vehKnown(b) && namedIn(b) > people(b) ? 'Booking updated. The vehicles still list ' + namedIn(b) + ' people: check them.' : 'Booking updated');
      }, { wide: true, noFocus: true, onOpen: function (f) {
        var box = $('[data-q]', f), tell = f.elements.tell;
        tell.addEventListener('change', function () { tellTouched = true; });
        var u = function () {
          if (closed) { box.hidden = true; return; }
          var s = read(f);
          if (s.co <= s.ci) { box.innerHTML = '<span class="bad-t">Departure must be after arrival.</span>'; return; }
          var p = priceOf(s), nt = b.total + (b.method === 'card' ? p.dc : p.de), pd = paid(b), moved = s.ci !== b.ci || s.co !== b.co || s.stand !== b.stand, st = standById(s.stand);
          box.innerHTML = (moved ? (overlaps(s.stand, s.ci, s.co, b.ref) ? '<span class="pill bad"><i></i>Stand not free for those nights</span>' : '<span class="pill ok"><i></i>Stand free</span>') : '') + sizePill(st, s.adults + s.pens + s.kids) + (vehKnown(b) && namedIn(b) > s.adults + s.pens + s.kids ? ' <span class="pill bad"><i></i>' + namedIn(b) + ' people named in the vehicles</span>' : '') +
            '<div class="qb-row"><span>' + p.nights + ' night' + (p.nights > 1 ? 's' : '') + ' · ' + methodLabel(b.method) + '</span><span class="price-pair">' + (nt !== b.total ? '<s>' + money(b.total) + '</s> ' : '') + '<b>' + money(nt) + '</b></span></div>' +
            '<div class="muted small">Paid ' + money(pd) + ' · ' + (nt >= pd ? 'balance ' + money(nt - pd) : '<span class="warn-t">' + money(pd - nt) + ' more than the new total. Keep it as credit or refund it.</span>') + '</div>';
          if (!tellTouched) tell.checked = moved || nt !== b.total;
        };
        $$('input,select', f).forEach(function (x) { if (x.name === 'tell') return; x.addEventListener('input', u); x.addEventListener('change', u); }); u();
      } });
  }
  function actNote(ref, i) {
    var b = byRef(ref), n = b.notes[i]; if (!n) return;
    modal('Edit note', '<p class="muted small">' + esc(n.by) + ' · ' + esc(n.at) + '</p><label class="fld"><span>Note</span><textarea name="t" rows="4">' + esc(n.text) + '</textarea></label>', 'Save note', function (f) {
      var v = fval(f, 't'); if (!v) { toast('A note cannot be empty. Delete it instead.'); return false; }
      if (v === n.text) return; n.text = v; n.edited = { by: ME.name, at: nowStamp() }; save(); refresh(); toast('Note saved');
    });
  }
  function standOptions(sel, onlyFree) {
    return ['fenced', 'unfenced', 'self-sufficient'].map(function (a) {
      return '<optgroup label="' + AREA_SHORT[a] + '">' + STANDS.filter(function (s) { return s.area === a; }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + ' (' + sizeTxt(s) + ')</option>'; }).join('') + '</optgroup>';
    }).join('');
  }
  /* ---------- New booking, step by step ----------
     Five steps in one pop-up, and nothing is saved until "Book it":
     1 who it is for, 2 the stay, 3 how they pay, 4 what goes to the guest now, 5 check and book.
     How they pay: 'quote' (quotation, deposit by EFT; with "keep the stand" b.noRelease = true), 'arrival' (b.onArrival, no deposit,
     never released) or 'paid' (a payment is recorded straight away).
     To drive it in a test: the form carries data-nb-at="1" to "5"; [data-nb-next] is Next (data-nb-next="book" on the last step, "Book it"),
     [data-nb-back] is Back, [data-nb-go="n"] the step bar, input[name=pay] the pay choice, input[name=keep] "keep the stand". */
  var NB_STEPS = [['Guest', 'Who is it for?'], ['Stay', 'The stay'], ['Payment', 'How will they pay?'], ['Send', 'What do we send now?'], ['Check', 'Check and book']];
  function actNew(pre) {
    pre = pre || {};
    var ci = pre.ci || TODAY, co = pre.co || add(ci, 2), step = 1, f = null, go = null, wayTouched = false, amtTouched = false;
    var sec = function (n, html) { return '<section class="nb-step" data-nb-step="' + n + '"' + (n > 1 ? ' hidden' : '') + '><h4 class="nb-h"><span>Step ' + n + ' of ' + NB_STEPS.length + '</span>' + NB_STEPS[n - 1][1] + '</h4>' + html + '</section>'; };
    var radio = function (name) { return ($('[name=' + name + ']:checked', f) || {}).value || ''; };
    var canWa = function (p) { return waDigits(p).length >= 10; }, canMail = function (e) { return /.+@.+\..+/.test(e || ''); };
    // everything typed so far, as one object
    var read = function () {
      var g = { adults: +fval(f, 'adults') || 0, pens: +fval(f, 'pens') || 0, kids: +fval(f, 'kids') || 0 }, pay = radio('pay') || 'quote', how = radio('how') || 'Cash', pm = radio('pm') || 'eft';
      var m = pay === 'arrival' ? (how === 'Card' ? 'card' : 'cash') : pay === 'paid' ? pm : 'eft';
      var sid = fval(f, 'stand'), a = fval(f, 'ci'), z = fval(f, 'co'), ex = { gd: +fval(f, 'gd') || 0 }, q = a && z > a ? quote(sid, a, z, g, ex) : null;
      var cl = clientById(fval(f, 'cid')), ng = { first: fval(f, 'first'), last: fval(f, 'last'), email: fval(f, 'email'), phone: fval(f, 'phone') }, who = cl || ng, total = q ? (m === 'card' ? q.card : q.eft) : 0;
      var crLeft = creditLeft(who.email), cr = fval(f, 'usecredit') ? Math.min(crLeft, total) : 0;
      // a stand-in booking, so the deposit and the dates follow the same rules as a real one
      var d = { created: nowStamp(), ci: a || TODAY, co: z || TODAY, total: total, payments: [], status: 'pending' }, dep = q ? deposit(d) : 0;
      return { g: g, ppl: g.adults + g.pens + g.kids, pay: pay, how: how, pm: pm, m: m, sid: sid, a: a, z: z, ex: ex, q: q, cl: cl, ng: ng, who: who, total: total, cr: cr, crLeft: crLeft, need: Math.max(0, total - cr), d: d, dep: dep, depLeft: Math.max(0, dep - cr), byCredit: cr > 0 && cr >= dep,
        veh: Math.max(0, Math.min(20, +fval(f, 'veh') || 0)), keep: !!fval(f, 'keep'), pamt: randOf(fval(f, 'pamt')), pd: fval(f, 'pd'), way: radio('way'),
        sDoc: !!fval(f, 's_doc'), sLink: !!fval(f, 's_link'), sInd: !!fval(f, 's_ind'), sDgr: !!fval(f, 's_dgr'), codes: $$('[data-nb-code]', f).map(function (x) { return x.value.trim().toUpperCase(); }) };
    };
    // will the booking be confirmed straight away (no quotation waiting to be paid)?
    var sure = function (s) { return s.pay !== 'quote' || s.byCredit; };
    var codesIn = function (s) { return s.sDgr && s.codes.some(Boolean); };
    // what is wrong on step n ('' when it is fine)
    var bad = function (n, s) {
      if (n === 1) {
        if (!s.cl && (!s.ng.first || !s.ng.last)) return 'Choose a client, or add a new one with their name';
        if (!s.cl && !s.ng.phone && !s.ng.email) return 'Add a mobile number or email for the new client';
        if (!s.cl && s.ng.email && !canMail(s.ng.email)) return 'That email address does not look right';
      }
      if (n === 2) {
        if (!s.q) return 'Departure must be after arrival';
        if (overlaps(s.sid, s.a, s.z)) return 'That stand is not free for those nights';
        if (!s.g.adults && !s.g.pens) return 'Add at least one adult';
      }
      if (n === 3 && s.pay === 'paid' && s.need > 0) {
        if (!(s.pamt > 0)) return 'Enter the amount that was paid';
        if (!s.pd) return 'Choose the date it was paid';
        if (s.pd > TODAY) return 'The date paid cannot be in the future';
      }
      if (n === 4 && (s.sDoc || s.sLink || s.sInd || codesIn(s)) && !s.way) return 'There is no mobile number or email address to send to. Untick everything, or go back and add one';
      return '';
    };
    var book = function (s) {
      var now = nowStamp(), q = s.q, cl = s.cl, linked = false, st1 = standById(s.sid), overUsual = s.ppl > (st1.guests || 8);
      if (!cl) { cl = findClient(s.ng.email, s.ng.phone); linked = !!cl; if (!cl) cl = newClient(s.ng); }
      var b = { ref: K.takeNo('Ref'), created: now, source: fval(f, 'source'), madeBy: ME.name, cid: cl.id, guest: { first: cl.first, last: cl.last, email: cl.email, phone: cl.phone, consent: cl.consent }, stand: s.sid, ci: s.a, co: s.z, adults: s.g.adults, pens: s.g.pens, kids: s.g.kids, vehicles: Math.max(1, s.veh || 1), setup: '', extras: s.ex, method: s.m, eft: q.eft, card: q.card, total: s.total, payments: [], status: 'pending', notes: [], pop: false };
      if (fval(f, 'usecredit')) {   // the credit that runs out first is used first; what is not needed stays on the credit
        var need = b.total, usedC = [];
        creditsFor(b.guest.email).forEach(function (c) { var take = creditPay(b, c, need); if (!take) return; need -= take; usedC.push(money(take) + ' with credit ' + c.code + (c.from ? ' from booking ' + c.from : '')); log(money(take) + ' of credit ' + c.code + ' used on ' + b.ref, b.ref); });
        if (usedC.length) b.notes.push({ at: now, by: ME.name, text: 'Paid ' + usedC.join(' and ') + '.' });
        if (paid(b) > 0 && paid(b) >= deposit(b)) b.status = 'confirmed';
      }
      if (fval(f, 'note')) b.notes.push({ at: now, by: ME.name, text: fval(f, 'note') });
      // more people than the stand usually takes (or even than the most it can take) is staff's call: warned in the price box, never blocked
      if (overUsual) b.notes.push({ at: now, by: ME.name, text: 'Booked for ' + s.ppl + ' people on a stand that usually takes ' + (st1.guests || 8) + (s.ppl > standMax(st1) ? ' (the most it can take is ' + standMax(st1) + ')' : '') + '.' });
      var owe = b.total - paid(b), inv = null;
      if (s.pay === 'arrival' && owe > 0) {
        // pays on arrival (arranged with Kyleu): confirmed without a deposit, an invoice that says so, never released
        b.onArrival = { how: s.how, at: now, by: ME.name }; b.status = 'confirmed';
        b.notes.push({ at: now, by: ME.name, text: 'Confirmed without a deposit: the guest pays ' + money(owe) + ' on arrival (' + s.how.toLowerCase() + ').' });
        inv = invFor(b, 'Invoice', null, { by: ME.name, note: 'Payment on arrival (' + s.how.toLowerCase() + '), as arranged with Kyleu.' });
      } else if (s.pay === 'paid' && owe > 0) {
        // already paid: recorded as a payment, the booking is confirmed and has an invoice; what is left follows the normal rules
        b.payments.push({ d: s.pd, amt: s.pamt, m: s.pm, type: s.pamt >= owe ? (paid(b) ? 'Balance' : 'Full payment') : paid(b) ? 'Balance' : 'Deposit', ref: b.ref }); b.status = 'confirmed';
        b.notes.push({ at: now, by: ME.name, text: 'Booked with ' + money(s.pamt) + ' already paid (' + methodLabel(s.pm) + ', ' + fd(s.pd) + ').' + (balance(b) > 0 ? ' Still to pay: ' + money(balance(b)) + '.' : ' Paid in full.') });
        log(money(s.pamt) + ' ' + methodLabel(s.pm) + ' payment recorded on ' + b.ref, b.ref);
        inv = invFor(b, 'Invoice', null, { by: ME.name });
      } else if (s.pay === 'quote' && s.keep && b.status === 'pending') {
        b.noRelease = true;
        b.notes.push({ at: now, by: ME.name, text: 'The stand is kept for the guest: it is not released if the quotation is not paid in time.' });
      }
      if (inv) { b.invoices = [inv]; K.commitNo('Invoice', inv.no); }
      if (s.veh > 0) vehSaid(b); else b.vehTbc = true;   // no number typed: vehicles not given yet, never a guess
      ensureCars(b);
      s.codes.forEach(function (c, i) { if (c && b.cars[i]) b.cars[i].dgr = c; });   // Dinokeng codes typed in step 4 stay on the vehicles, sent or not
      b.toSend = { doc: 1, link: 1, ind: 1 };   // each one is taken off when it is really sent
      DB.bookings.push(b); DB.bookings.sort(function (x, y) { return x.ci < y.ci ? -1 : 1; });
      log('New ' + b.source.toLowerCase() + ' booking ' + b.ref + ' for ' + guestName(b) + (b.onArrival ? ' (pays on arrival)' : b.noRelease ? ' (stand kept)' : ''), b.ref); save(); render(); openBooking(b.ref);
      toast('Booking ' + b.ref + ' created' + (linked ? ' for returning client ' + esc(clientName(cl)) : ''));
      var pick = { doc: s.sDoc, link: s.sLink, ind: s.sInd, dgr: s.sDgr && b.cars.some(function (c) { return c.dgr; }) };
      if (pick.doc || pick.link || pick.ind || pick.dgr) setTimeout(function () { firstSend(b, pick, s.way); }, 0);
    };
    modal('New booking', '<ol class="nb-bar" data-nb-bar>' + NB_STEPS.map(function (x, i) { return '<li><button type="button" data-nb-go="' + (i + 1) + '"' + (i ? '' : ' class="on" aria-current="step"') + '><i>' + (i + 1) + '</i><span>' + x[0] + '</span></button></li>'; }).join('') + '</ol>' +
      sec(1, '<p class="muted small">For phone, WhatsApp, email and walk-in bookings. Website bookings arrive here by themselves.</p>' +
      '<div class="cl-pick"><input type="hidden" name="cid" value="">' +
      '<div data-clfind><span class="fld-l">Client</span><label class="search">' + ic('search') + '<input name="clq" autocomplete="off" placeholder="Search returning clients by name, mobile or email" aria-label="Find a client"></label><div class="cl-results" data-clres hidden></div>' +
      '<button type="button" class="btn ghost sm cl-newbtn" data-clnew>' + ic('plus') + 'New client</button></div>' +
      '<div class="cl-chosen" data-clchosen hidden></div>' +
      '<div class="cl-new" data-clform hidden><div class="cl-new-h"><b>New client</b><button type="button" class="link-btn" data-clback>Search clients instead</button></div>' +
      '<div class="grid2"><label class="fld"><span>First name</span><input name="first" value="' + esc(pre.first || '') + '"></label><label class="fld"><span>Surname</span><input name="last" value="' + esc(pre.last || '') + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Mobile</span><input name="phone" inputmode="tel" value="' + esc(pre.phone || '') + '"></label><label class="fld"><span>Email</span><input name="email" type="email" value="' + esc(pre.email || '') + '"></label></div><div data-clmatch></div></div></div>' +
      '<label class="fld"><span>Booked via</span><select name="source"><option>Phone</option><option>WhatsApp</option><option>Email</option><option>Walk-in</option></select></label>') +
      sec(2, '<div class="grid2"><label class="fld"><span>Arrive</span><input type="date" name="ci" value="' + ci + '"></label><label class="fld"><span>Depart</span><input type="date" name="co" value="' + co + '"></label></div>' +
      '<label class="fld"><span>Stand</span><select name="stand">' + standOptions(pre.stand || '') + '</select></label>' +
      '<div class="grid3"><label class="fld"><span>Adults</span><input type="number" min="0" max="40" name="adults" value="2"></label><label class="fld"><span>Pensioners</span><input type="number" min="0" max="40" name="pens" value="0"></label><label class="fld"><span>Kids under 12</span><input type="number" min="0" max="40" name="kids" value="0"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Game drive (people)</span><input type="number" min="0" max="10" name="gd" value="0"></label><label class="fld"><span>Vehicles (empty if not said yet)</span><input type="number" min="1" max="20" name="veh" value="" placeholder="Not given yet"></label></div>' +
      '<label class="fld"><span>Note for the team (optional)</span><input name="note" placeholder="e.g. Celebrating a birthday, arriving late on Friday"></label>' +
      '<div class="quote-box" data-q></div>') +
      sec(3, '<div class="cr-opts nb-pay">' +
      '<label class="cr-opt"><input type="radio" name="pay" value="quote" checked><span><b>Send a quotation, deposit by EFT</b><small>The normal way. The stand is held while the quotation is valid.</small></span></label>' +
      '<div class="cr-sub nb-sub" data-nb-sub="quote"><p class="hint" data-nb-qinfo></p><label class="check" data-nb-keeprow><input type="checkbox" name="keep"><span>Keep the stand even if it is not paid by then</span></label><p class="muted small" data-nb-keepnote></p></div>' +
      '<label class="cr-opt"><input type="radio" name="pay" value="arrival"><span><b>Reserved, they pay when they arrive</b><small>Cash or card at reception. The stand is theirs: nothing is released and no deposit is asked.</small></span></label>' +
      '<div class="cr-sub nb-sub" data-nb-sub="arrival" hidden><div class="seg"><label><input type="radio" name="how" value="Cash" checked><span>' + ic('cash') + 'Cash</span></label><label><input type="radio" name="how" value="Card"><span>' + ic('card') + 'Card</span></label></div><p class="hint" data-nb-ainfo></p></div>' +
      '<label class="cr-opt"><input type="radio" name="pay" value="paid"><span><b>Already paid</b><small>The money is in. It is recorded as a payment on the booking.</small></span></label>' +
      '<div class="cr-sub nb-sub" data-nb-sub="paid" hidden><div class="grid2"><label class="fld"><span>Amount paid (R)</span><input name="pamt" inputmode="decimal" autocomplete="off"></label><label class="fld"><span>Date paid</span><input type="date" name="pd" value="' + TODAY + '" max="' + TODAY + '"></label></div>' +
      '<span class="fld-l">Paid by</span><div class="seg">' + ['eft', 'card', 'cash'].map(function (m, i) { return '<label><input type="radio" name="pm" value="' + m + '"' + (i ? '' : ' checked') + '><span>' + methodLabel(m) + '</span></label>'; }).join('') + '</div><p class="hint" data-nb-pinfo></p></div>' +
      '</div><div data-credit-box></div>') +
      sec(4, '<p class="muted small">Tick what goes to the guest now, all in one message. What you leave out is not lost: it shows on the booking as still to do.</p>' +
      '<span class="fld-l">Send it by</span><div class="seg"><label><input type="radio" name="way" value="wa"><span>' + ic('wa') + 'WhatsApp</span></label><label><input type="radio" name="way" value="mail"><span>' + ic('mail') + 'Email</span></label></div>' +
      '<p class="hint" data-nb-wayinfo></p>' +
      '<div class="nb-ticks"><label class="check"><input type="checkbox" name="s_doc" checked><span data-nb-doclbl>The quotation</span></label>' +
      '<label class="check"><input type="checkbox" name="s_link" checked><span>The link to their booking <small class="muted">to see it, say they have paid, and finalise it</small></span></label>' +
      '<label class="check"><input type="checkbox" name="s_ind" checked><span>The indemnity signing link <small class="muted">everyone signs before they arrive</small></span></label>' +
      '<label class="check"><input type="checkbox" name="s_dgr" checked><span>The Dinokeng voucher codes <small class="muted">one for each vehicle</small></span></label></div>' +
      '<div class="nb-codes" data-nb-codes></div>') +
      sec(5, '<div data-nb-sum></div>'),
      'Next', function () {
        var s = read(), i;
        if (step < NB_STEPS.length) { var why = bad(step, s); if (why) toast(why); else go(step + 1); return false; }
        for (i = 1; i < NB_STEPS.length; i++) { var w2 = bad(i, s); if (w2) { toast(w2); go(i); return false; } }
        book(s);
      }, { wide: true, noFocus: true, onOpen: function (form) {
        f = form; f.classList.add('nb');
        var foot = $('footer', f), next = $('button[type=submit]', foot), back = document.createElement('button'), lastCid = '';
        back.type = 'button'; back.className = 'btn ghost'; back.hidden = true; back.setAttribute('data-nb-back', ''); back.innerHTML = ic('chev-l') + 'Back'; foot.classList.add('nb-foot'); foot.insertBefore(back, next);
        // step 3: what each way of paying means for this booking
        var payInfo = function (s) {
          $$('[data-nb-sub]', f).forEach(function (x) { x.hidden = x.dataset.nbSub !== s.pay; });
          if (!s.q) return;
          var due = depositDue(s.d), h = holdOf(s.d), first = esc(s.who.first || 'The guest');
          $('[data-nb-qinfo]', f).innerHTML = s.byCredit ? 'The credit covers the ' + (payFullOf(s.d) ? 'full amount' : 'deposit') + ', so the booking is confirmed straight away.' + (s.need > 0 ? ' Still to pay: <b>' + money(s.need) + '</b>.' : '')
            : (payFullOf(s.d) ? 'Arrives soon, so the full amount of <b>' + money(s.depLeft) + '</b> secures the stand' : 'Deposit of <b>' + money(s.depLeft) + '</b> (' + depPct() + '%)') + ', by EFT.' + (s.cr ? ' ' + money(s.cr) + ' is paid with the credit.' : '') + ' The quotation runs out on <b>' + fdw(due) + '</b>.';
          $('[data-nb-keeprow]', f).hidden = s.byCredit;
          $('[data-nb-keepnote]', f).innerHTML = s.byCredit ? '' : s.keep ? ic('lock') + ' ' + KEPT_TXT + '. You can switch this off on the booking later.' : 'Not paid by then? The stand is released automatically after ' + fdw(h.until || due) + (h.until > due ? ' (never over a weekend)' : '') + '.';
          $('[data-nb-ainfo]', f).innerHTML = first + ' pays <b>' + money(s.need) + '</b> at reception' + (s.how === 'Card' && hasFee() ? ' (the card price, with the ' + cardFee() + '% card fee)' : '') + '. The booking is confirmed now.';
          var rest = s.need - (s.pamt || 0);
          $('[data-nb-pinfo]', f).innerHTML = !(s.pamt > 0) ? 'Type what was paid. The total is <b>' + money(s.need) + '</b>' + (s.pm === 'card' && hasFee() ? ' (the card price)' : '') + '.' : rest > 0 ? 'The rest, <b>' + money(rest) + '</b>, is due ' + (balanceDue(s.d) >= TODAY ? 'by ' + fdw(balanceDue(s.d)) : 'before they arrive') + ', as usual.' : rest < 0 ? '<span class="warn-t">That is ' + money(-rest) + ' more than the total of ' + money(s.need) + '.</span>' : 'Paid in full.';
        };
        // step 4: which way it can go, what the first tick is called, and a box for each Dinokeng code
        var sendInfo = function (s) {
          var wa = canWa(s.who.phone), mail = canMail(s.who.email), rw = $('[name=way][value=wa]', f), rm = $('[name=way][value=mail]', f), cur = radio('way');
          rw.disabled = !wa; rm.disabled = !mail;
          if (!wayTouched || (cur === 'wa' && !wa) || (cur === 'mail' && !mail) || !cur) { rw.checked = wa; rm.checked = !wa && mail; }
          cur = radio('way');
          $('[data-nb-wayinfo]', f).innerHTML = cur === 'wa' ? 'To ' + esc(s.who.phone) + ' on WhatsApp.' + (mail ? '' : ' There is no email address.') : cur === 'mail' ? 'To ' + esc(s.who.email) + '.' + (wa ? '' : ' There is no mobile number for WhatsApp.') : '<span class="warn-t">There is no mobile number or email address to send to.</span>';
          $('[data-nb-doclbl]', f).innerHTML = sure(s) ? 'The confirmation, with the invoice' : 'The quotation <small class="muted">with the bank details and the deposit</small>';
          var box = $('[data-nb-codes]', f), n = Math.max(1, s.veh || 1);
          box.hidden = !s.sDgr;
          if (+box.dataset.n !== n) {
            var old = s.codes; box.dataset.n = n;
            box.innerHTML = '<p class="muted small">' + (s.veh ? n + ' vehicle' + (n === 1 ? '' : 's') : VEH_ASSUMED) + '. Make the code' + (n === 1 ? '' : 's') + ' on the Dinokeng site and paste ' + (n === 1 ? 'it' : 'them') + ' here. No code yet? Leave it empty: the codes stay on the booking as still to do.</p>' +
              '<div class="nb-code-row">' + new Array(n + 1).join('x').split('').map(function (_, i) { return '<input class="dgr-code" data-nb-code="' + i + '" value="' + esc(old[i] || '') + '" placeholder="Code for vehicle ' + (i + 1) + '" autocomplete="off" aria-label="Dinokeng code for vehicle ' + (i + 1) + '">'; }).join('') +
              '<a class="btn ghost sm" href="' + esc(dgrLink()) + '" target="_blank" rel="noopener">' + ic('ext') + 'Open Dinokeng site to make codes</a></div>';
          }
        };
        // step 5: all of it in plain words
        var summary = function (s) {
          var box = $('[data-nb-sum]', f); if (!s.q) { box.innerHTML = ''; return; }
          var st = standById(s.sid), w = s.who, due = depositDue(s.d), h = holdOf(s.d), nN = s.q.nights, first = esc(w.first || 'The guest');
          var payT = s.cr > 0 && s.need <= 0 ? '<b>Paid in full with credit.</b> Nothing more to pay.' : s.pay === 'arrival' ? '<b>Reserved, pays on arrival.</b> ' + first + ' pays ' + money(s.need) + ' at reception (' + s.how.toLowerCase() + '). No deposit is asked.'
            : s.pay === 'paid' ? '<b>Already paid:</b> ' + money(s.pamt || 0) + ' by ' + methodLabel(s.pm) + ' on ' + fd(s.pd) + '. ' + (s.need - (s.pamt || 0) > 0 ? 'The rest, ' + money(s.need - s.pamt) + ', is due ' + (balanceDue(s.d) >= TODAY ? 'by ' + fdw(balanceDue(s.d)) : 'before they arrive') + '.' : 'Paid in full.')
            : s.byCredit ? '<b>Paid with credit.</b> The credit covers the ' + (payFullOf(s.d) ? 'full amount' : 'deposit') + '.' + (s.need > 0 ? ' Still to pay: ' + money(s.need) + '.' : '')
            : '<b>Quotation, ' + (payFullOf(s.d) ? 'full amount' : 'deposit') + ' by EFT.</b> ' + money(s.depLeft) + ' to pay by ' + fdw(due) + '.';
          var standT = !sure(s) && s.keep ? ic('lock') + ' <b>' + KEPT_TXT + '.</b>' : !sure(s) ? '<b>Can be released.</b> If the quotation is not paid, the stand is released automatically after ' + fdw(h.until || due) + '.' : s.pay === 'arrival' ? ic('lock') + ' <b>Theirs.</b> It is not released.' : ic('check') + ' <b>Theirs.</b> The booking is confirmed.';
          var docN = sure(s) ? 'the confirmation with the invoice' : 'the quotation', now = [], later = [];
          (s.sDoc ? now : later).push(docN); (s.sLink ? now : later).push('the link to their booking'); (s.sInd ? now : later).push('the indemnity signing link');
          if (codesIn(s)) now.push('the Dinokeng voucher code' + (s.codes.filter(Boolean).length > 1 ? 's' : '')); else later.push('the Dinokeng voucher codes' + (s.sDgr ? ' (no code typed in yet)' : ''));
          var list = function (a) { return a.length > 1 ? a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1] : a[0]; }, cap = function (t) { return t.charAt(0).toUpperCase() + t.slice(1); };
          var rows = [['Guest', '<b>' + esc(clientName(w)) + '</b>' + (s.cl ? '' : ' <span class="pill info">New client</span>') + '<br><span class="muted">' + esc([w.phone, w.email].filter(Boolean).join(' · ')) + ' · booked via ' + esc(fval(f, 'source')) + '</span>'],
            ['Stay', '<b>' + esc(st.name) + '</b> · ' + AREA_SHORT[st.area] + sizePill(st, s.ppl) + '<br>' + fdw(s.a) + ' to ' + fdw(s.z) + ' · ' + nN + ' night' + (nN === 1 ? '' : 's') + ' <span class="muted">(arrives ' + rel(s.a) + ')</span><br>' + peopleTxt(s.g) + ' · ' + (s.veh ? s.veh + ' vehicle' + (s.veh === 1 ? '' : 's') : 'vehicles not given yet') + (s.ex.gd ? ' · game drive for ' + s.ex.gd : '')],
            ['Price', '<b>' + money(s.total) + '</b>' + (hasFee() ? ' <span class="muted">' + (s.m === 'card' ? 'card price' : 'EFT and cash price') + '</span>' : '') + (s.cr ? '<br>' + money(s.cr) + ' paid with credit, ' + money(s.need) + ' still to pay' : '')],
            ['Payment', payT], ['The stand', standT],
            ['Sent now', now.length && s.way ? cap(list(now)) + ', by ' + (s.way === 'wa' ? 'WhatsApp to ' + esc(w.phone) : 'email to ' + esc(w.email)) + '.<br><span class="muted">After Book it the message opens so you can read it. Then press ' + (s.way === 'wa' ? 'Send on WhatsApp' : 'Send email') + '.</span>' : 'Nothing is sent now.'],
            ['Still to do', later.length ? cap(list(later)) + '. ' + (later.length === 1 ? 'It stays' : 'They stay') + ' on the booking as still to do.' : '']];
          box.innerHTML = '<dl class="kv kv2 nb-sum">' + rows.filter(function (r) { return r[1]; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + r[1] + '</dd>'; }).join('') + '</dl>' +
            (fval(f, 'note') ? '<p class="cl-note">' + ic('note') + '<span>' + esc(fval(f, 'note')) + '</span></p>' : '') + '<p class="muted small">Nothing is saved yet. Press Book it to make the booking, or Back to change something.</p>';
        };
        var u = function () {
          // the credit tick first (it only needs the email address), so the amounts below already count it
          var who = clientById(fval(f, 'cid')) || { email: fval(f, 'email') }, cl0 = creditLeft(who.email), cb = $('[data-credit-box]', f), ck = cl0 + '|' + normEmail(who.email);
          if (cb.dataset.k !== ck) { cb.dataset.k = ck; cb.innerHTML = cl0 ? '<label class="check credit-use"><input type="checkbox" name="usecredit" checked><span>Use <b>' + money(cl0) + '</b> credit <small class="muted">' + creditsFor(who.email).map(function (c) { return 'code ' + esc(c.code) + (c.until ? ', use by ' + fdy(c.until) : ', no end date'); }).join(' and ') + '</small></span></label>' : ''; }
          var s = read(), box = $('[data-q]', f), sel = f.elements.stand;
          if (!amtTouched && s.q && f.elements.pamt.value !== String(s.need)) { f.elements.pamt.value = String(s.need); s = read(); }
          if (!s.q) box.innerHTML = '<span class="bad-t">Departure must be after arrival.</span>';
          else {
            // mark every stand free or booked for these dates; start on a free one
            var nFree = 0;
            $$('option', sel).forEach(function (o) { var s0 = standById(o.value), fr = !overlaps(o.value, s.a, s.z); if (fr) nFree++; o.textContent = s0.name + ' (' + sizeTxt(s0) + ') · ' + (fr ? 'free' : 'booked'); });
            if (!f._picked && overlaps(sel.value, s.a, s.z)) { var fo = $$('option', sel).filter(function (o) { return !overlaps(o.value, s.a, s.z); })[0]; if (fo) { sel.value = fo.value; s = read(); } }
            var q = s.q, m = s.m, free = !overlaps(s.sid, s.a, s.z), st = standById(s.sid);
            var nts = []; for (var dd = s.a; dd < s.z; dd = add(dd, 1)) nts.push(D(dd).getDay());
            var halfWeekend = (nts.indexOf(5) >= 0 || nts.indexOf(6) >= 0) && nts.length < num('Booking rules', 'Minimum nights over a weekend', 2), full = payFullOf(s.d);
            box.innerHTML = (free ? '<span class="pill ok"><i></i>Stand free</span>' : '<span class="pill bad"><i></i>Stand not free</span>') + sizePill(st, s.ppl) +
              '<div class="qb-row"><span>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + '</span><span class="price-pair">' + (!hasFee() ? '<b>' + money(q.eft) + '</b>' : m === 'card' ? '<b>' + money(q.card) + '</b> <small>card price</small>' : '<s>' + money(q.card) + '</s> <b>' + money(q.eft) + '</b> <small>' + methodLabel(m) + '</small>') + '</span></div>' +
              '<div class="muted small">' + (full ? 'Arrives within 12 days, so the full amount secures the stand' : 'Deposit ' + depPct() + '%: ' + money(s.dep)) + ' · ' + nFree + ' of ' + STANDS.length + ' stands free for these dates</div>' +
              (halfWeekend ? '<div class="small warn-t">' + ic('info') + ' Only one weekend night: weekend stays are normally at least 2 nights (Friday and Saturday, or Saturday and Sunday). Fine if you agreed it with the guest.</div>' : '');
          }
          payInfo(s); sendInfo(s); if (step === NB_STEPS.length) summary(read());
        };
        go = function (n) {
          step = n; f.dataset.nbAt = n;
          $$('[data-nb-step]', f).forEach(function (x) { x.hidden = +x.dataset.nbStep !== n; });
          $$('[data-nb-go]', f).forEach(function (x) { var k = +x.dataset.nbGo; x.className = k === n ? 'on' : k < n ? 'done' : ''; if (k === n) x.setAttribute('aria-current', 'step'); else x.removeAttribute('aria-current'); $('i', x).innerHTML = k < n ? ic('check') : k; });
          back.hidden = n === 1;
          var last = n === NB_STEPS.length; next.innerHTML = last ? ic('check') + 'Book it' : 'Next' + ic('chev-r'); next.setAttribute('data-nb-next', last ? 'book' : 'next');
          u(); $('.m-body', f).scrollTop = 0;
          // Enter moves on from wherever the cursor lands: the first field of the step, the chosen way of paying or sending, or Book it
          var to = n === 2 ? f.elements.ci : n === 3 ? $('[name=pay]:checked', f) : n === 4 ? ($('[name=way]:checked', f) || f.elements.s_doc) : n === 5 ? next : null;
          if (to) setTimeout(function () { try { to.focus(); } catch (e) {} }, 30);
        };
        f._picked = !!pre.stand; f.elements.stand.addEventListener('change', function () { f._picked = true; });
        var onEv = function (e) { var t = e.target, nm = t && t.name; if (nm === 'clq') return; if (nm === 'pamt') amtTouched = true; if (nm === 'way') wayTouched = true; u(); };
        f.addEventListener('input', onEv); f.addEventListener('change', onEv);
        f.addEventListener('keydown', function (e) { var t = e.target; if (e.key !== 'Enter' || e.isComposing || !t || t.tagName !== 'INPUT' || t.name === 'clq') return; e.preventDefault(); next.click(); });
        f.addEventListener('click', function (e) {
          var t = e.target, g = t.closest('[data-nb-go]');
          if (t.closest('[data-nb-back]')) { if (step > 1) go(step - 1); return; }
          if (!g) return;
          var n = +g.dataset.nbGo, s = read(), i;
          for (i = step; i < n; i++) { var why = bad(i, s); if (why) { toast(why); if (i !== step) go(i); return; } }
          if (n !== step) go(n);
        });
        // a client was picked: put the cursor on Next, so Enter moves on
        clientPicker(f, pre, function () { u(); var id = f.elements.cid.value; if (id && id !== lastCid && step === 1) setTimeout(function () { next.focus(); }, 40); lastCid = id; });
        next.setAttribute('data-nb-next', 'next'); next.innerHTML = 'Next' + ic('chev-r'); f.dataset.nbAt = 1; u();
      } });
  }
  // the first message after a new booking: everything that was ticked goes in one message, through the usual send box
  function firstMsg(b, pick, codes) {
    var st = standById(b.stand).name, LD = { weekday: 'long', day: 'numeric', month: 'long' }, bal = balance(b), pd = paid(b), full = paidUp(b), P = [], many = codes.length > 1;
    var balBy = balanceDue(b) >= TODAY ? 'due by ' + fd(balanceDue(b), { day: 'numeric', month: 'long' }) : 'to be paid before you arrive';
    P.push('Hi ' + b.guest.first + ',');
    if (b.status === 'pending') {
      P.push('Thank you for booking ' + st + ', ' + fd(b.ci, LD) + ' to ' + fd(b.co, LD) + '. Your booking reference is ' + b.ref + '.' + (pick.doc ? ' Your quotation is attached, with our bank details.' : ''));
      P.push(b.noRelease ? 'We are keeping the stand for you. Please pay ' + money(Math.max(0, deposit(b) - pd)) + ' by EFT using reference ' + b.ref + '.'
        : 'To secure your stand, please pay ' + money(Math.max(0, deposit(b) - pd)) + ' by EFT using reference ' + b.ref + '. The quotation is valid for ' + validDays(b.created, depositDue(b)) + '. After that the stand is released.');
    } else {
      P.push('Your booking ' + b.ref + ' is confirmed: ' + st + ', ' + fd(b.ci, LD) + ' to ' + fd(b.co, LD) + '.' + (pick.doc ? ' Your invoice is attached.' : ''));
      P.push(b.onArrival && bal > 0 ? 'As arranged with Kyleu, you pay ' + money(bal) + ' when you arrive (' + (/card/i.test(b.onArrival.how) ? 'by card' : 'in cash') + ').' : full ? 'Thank you, your stay is paid in full.' : 'Thank you, we received ' + money(pd) + '. Still to pay: ' + money(bal) + ', ' + balBy + '.');
    }
    if (pick.link) P.push(b.status === 'pending' ? 'When you have paid, tell us and upload your proof of payment on your booking page:\n' + bookingLink(b)
      : full || b.onArrival ? 'Please finalise your booking here: tell us your vehicles and who is in each one, and roughly when you arrive:\n' + bookingLink(b)
      : 'Here is your booking page. Use it to tell us when you have paid the rest. Once it is paid in full, the same link lets you finalise your booking (vehicles, passengers and arrival time):\n' + bookingLink(b));
    if (pick.ind) P.push('Kyleu is inside the Dinokeng Big 5 Game Reserve, so everyone in your group signs our indemnity before arriving: each adult for themselves, and a parent or guardian for anyone under 18. It takes about a minute per person:\n' + signLink(b));
    if (codes.length) P.push('Kyleu is a proud DGR CP member, so you qualify for Dinokeng Conservation Fee Discount Vouchers: R85 per adult per night instead of R100. Your voucher code' + (many ? 's, one for each vehicle' : '') + ':\n' +
      codes.map(function (c) { return '- ' + carLabel(c, b.cars.indexOf(c)) + ': ' + c.dgr; }).join('\n') + '\nUse ' + (many ? 'each code' : 'the code') + ' when you buy your conservation fees online at https://dinokeng.plnktn.io before you arrive.');
    P.push('See you in the bush!\nThe Kyleu team');
    return P.join('\n\n');
  }
  function firstSend(b, pick, way) {
    var codes = pick.dgr ? ensureCars(b).filter(function (c) { return c.dgr; }) : [];
    sendBox({ b: b, title: 'Send to ' + guestName(b), value: 'first', way: way, load: function () {
      var docs = []; if (pick.doc) docs.push(docBooking(b, 'Invoice')); if (codes.length) docs.push(docCodes(b, codes));
      return { subject: (b.status === 'pending' ? 'Your Kyleu reservation ' : 'Booking confirmed: ') + b.ref, text: firstMsg(b, pick, codes), docs: docs };
    }, onSent: function (via) { if (codes.length) codesSent(b, codes, via); } });
  }
  // "find a client" box on New booking: search, pick, or add a new one (with a check for clients we already know)
  function clientPicker(f, pre, onChange) {
    var find = $('[data-clfind]', f), res = $('[data-clres]', f), chosen = $('[data-clchosen]', f), form = $('[data-clform]', f), match = $('[data-clmatch]', f), q = f.elements.clq, cid = f.elements.cid;
    var line = function (c) { var s = clientStats(c); return '<span class="avatar">' + esc((c.first[0] || '?') + (c.last[0] || '')) + '</span><span class="cl-r-g"><b>' + esc(clientName(c)) + '</b><small>' + esc([c.phone, c.email].filter(Boolean).join(' · ')) + '</small></span>' + retPill(s.stays); };
    var show = function (mode) { find.hidden = mode !== 'find'; chosen.hidden = mode !== 'chosen'; form.hidden = mode !== 'new'; res.hidden = true; };
    var choose = function (id) {
      var c = clientById(id); if (!c) return; var s = clientStats(c), cr = creditLeft(c.email); cid.value = c.id;
      chosen.innerHTML = '<div class="cl-card"><div class="cl-r">' + line(c) + '<button type="button" class="btn ghost sm" data-clchange>Change</button></div>' +
        (s.stays ? '<p class="small cl-hist">' + ic('return') + '<span>' + (s.stays > 1 ? 'Returning client: ' : '') + s.stays + ' stay' + (s.stays === 1 ? '' : 's') + ', ' + s.nights + ' nights' + (s.last ? ', last here ' + fd(s.last, { day: 'numeric', month: 'short', year: 'numeric' }) : '') + (s.next ? '. Already booked for ' + fd(s.next) : '') + '.</span></p>' : '<p class="small muted">No stays yet.</p>') +
        (c.notes ? '<p class="cl-note">' + ic('note') + '<span>' + esc(c.notes) + '</span></p>' : '') + (cr ? '<p class="small">Credit to use: ' + creditList(c.email) + '.</p>' : '') + '</div>';
      show('chosen'); onChange();
    };
    var search = function () {
      var t = q.value.trim().toLowerCase(), td = normPhone(t);
      if (t.length < 2) { res.hidden = true; return; }
      var hits = DB.clients.filter(function (c) { return (clientName(c) + ' ' + c.email + ' ' + (c.town || '')).toLowerCase().indexOf(t) >= 0 || (td.length >= 3 && (normPhone(c.phone).indexOf(td) >= 0 || normPhone(c.phone2).indexOf(td) >= 0)); })
        .sort(function (a, b) { return clientStats(b).stays - clientStats(a).stays; }).slice(0, 6);
      res.innerHTML = hits.map(function (c) { return '<button type="button" class="cl-r" data-clpick="' + c.id + '">' + line(c) + '</button>'; }).join('') +
        '<button type="button" class="cl-r cl-add" data-cladd>' + ic('plus') + '<span>Add <b>' + esc(q.value.trim()) + '</b> as a new client</span></button>';
      res.hidden = false;
    };
    var checkNew = function () {
      var c = findClient(fval(f, 'email'), fval(f, 'phone'));
      match.innerHTML = c ? '<div class="cl-match">' + ic('return') + '<span><b>' + esc(clientName(c)) + '</b> already has this ' + (fval(f, 'email') && normEmail(c.email) === normEmail(fval(f, 'email')) ? 'email address' : 'number') + ' (' + clientStats(c).stays + ' stays).</span><button type="button" class="btn sm" data-cluse="' + c.id + '">Use this client</button></div>' : '';
      onChange();
    };
    q.addEventListener('input', search); q.addEventListener('focus', search);
    q.addEventListener('keydown', function (e) { if (e.key !== 'Enter') return; e.preventDefault(); var h = $('[data-clpick]', res); if (h && !res.hidden) choose(h.dataset.clpick); });
    ['email', 'phone'].forEach(function (k) { f.elements[k].addEventListener('input', checkNew); });
    f.addEventListener('click', function (e) {
      var t = e.target, p = t.closest('[data-clpick],[data-cluse]');
      if (p) { choose(p.dataset.clpick || p.dataset.cluse); return; }
      if (t.closest('[data-clchange]')) { cid.value = ''; q.value = ''; show('find'); onChange(); setTimeout(function () { q.focus(); }, 30); return; }
      if (t.closest('[data-cladd]') || t.closest('[data-clnew]')) {
        var w = q.value.trim(); if (w && !/[@\d]/.test(w) && !fval(f, 'first')) { var parts = w.split(/\s+/); f.elements.first.value = parts[0]; f.elements.last.value = parts.slice(1).join(' '); }
        else if (/@/.test(w) && !fval(f, 'email')) f.elements.email.value = w; else if (/\d{3}/.test(w) && !fval(f, 'phone')) f.elements.phone.value = w;
        cid.value = ''; show('new'); checkNew(); setTimeout(function () { (f.elements.first.value ? f.elements.phone : f.elements.first).focus(); }, 30); return;
      }
      if (t.closest('[data-clback]')) { show('find'); onChange(); setTimeout(function () { q.focus(); }, 30); return; }
      if (!t.closest('[data-clfind]')) res.hidden = true;
    });
    var known = pre.cid ? clientById(pre.cid) : findClient(pre.email, pre.phone);
    if (known) choose(known.id); else if (pre.first || pre.email || pre.phone) { show('new'); checkNew(); } else { show('find'); setTimeout(function () { q.focus(); }, 40); }
  }

  /* ---------- vehicles: each car checks in and out on its own, signs the indemnity and runs a tab ---------- */
  // "minors": the passengers in this vehicle who are under 18 (names that are also in "guests"); a parent or guardian signs for them
  function newCar(o) { return Object.assign({ id: uid('v'), reg: '', driver: '', phone: '', guests: [], minors: [], people: 0, ind: null, st: 'due', inAt: '', outAt: '' }, o || {}); }
  function minorsOf(m, guests) { return (m || []).filter(function (n, i, a) { return (guests || []).indexOf(n) >= 0 && a.indexOf(n) === i; }); }
  function isMinor(c, n) { return (c.minors || []).indexOf(n) >= 0; }
  function passTxt(c) { return (c.guests || []).map(function (n) { return n + (isMinor(c, n) ? ' (under 18)' : ''); }).join(', '); }
  /* Vehicles are only "given" once the guest or staff really said so: until then a booking keeps ONE empty car
     (so it can still be checked in, and a Dinokeng code can wait on it) and every screen says "not given yet".
     Never one car per person. b.vehSaid = { at, by }: staff typed the number of vehicles. */
  function carGiven(b, c) { return !!(c.reg || c.make || (c.guests || []).length || c.st !== 'due' || c.noShow || (c.driver && !c.auto && c.driver !== guestName(b))); }   // c.auto: the driver was filled in by the system, not typed
  function vehKnown(b) { var cs = b.cars || []; return cs.some(function (c) { return c.st !== 'due'; }) || (!b.vehTbc && (!!b.vehSaid || cs.some(function (c) { return carGiven(b, c); }))); }
  function vehSaid(b) { b.vehTbc = false; if (!b.vehSaid) b.vehSaid = { at: nowStamp(), by: ME ? ME.name : 'System' }; }
  function vehN(b) { return vehKnown(b) ? ensureCars(b).length : 1; }   // how many vehicles to count where a number is needed: 1 until we are told
  function vehTxt(b) { var n = vehN(b); return vehKnown(b) ? n + ' vehicle' + (n === 1 ? '' : 's') : 'Vehicles not given yet'; }
  var VEH_ASSUMED = '1 vehicle assumed until the guest tells us';
  // not given yet: keep one empty car only (extra made-up ones go, unless something already hangs on them), and say so to the website too
  function vehTidy(b) {
    if (vehKnown(b) || !b.cars || !b.cars.length) return false;
    var was = b.cars.length + '|' + !!b.vehTbc + '|' + b.cars[0].people;
    for (var i = b.cars.length - 1; i > 0; i--) if (!carGiven(b, b.cars[i]) && !b.cars[i].dgrSent && !b.cars[i].dgr && !b.cars[i].ind && !carTab(b, b.cars[i]).items.length) b.cars.splice(i, 1);
    if (b.cars.length === 1 && !carGiven(b, b.cars[0])) b.cars[0].people = people(b);
    b.vehicles = b.cars.length; b.vehTbc = true;
    return was !== b.cars.length + '|true|' + b.cars[0].people;
  }
  function ensureCars(b) {
    if (b.cars && b.cars.length) return b.cars;
    var n = !b.vehTbc && b.vehSaid ? Math.max(1, b.vehicles || 1) : 1, st =b.status === 'in' ? 'in' : b.status === 'out' ? 'out' : 'due', ppl = people(b), per = Math.floor(ppl / n);
    b.cars = [];
    for (var i = 0; i < n; i++) b.cars.push(newCar({ auto: 1, driver: i ? '' : guestName(b), phone: i ? '' : b.guest.phone, people: per + (i ? 0 : ppl - per * n), st: st, ind: st === 'due' ? null : { at: b.ci + ' 12:00', by: 'Front desk' }, inAt: st === 'due' ? '' : b.ci + ' 12:00', outAt: st === 'out' ? b.co + ' 10:00' : '' }));
    b.vehicles = n; return b.cars;
  }
  function carLabel(c, i) { return c.reg || 'Vehicle ' + (i + 1); }
  function carOf(key) { var p = String(key || '').split('|'), b = byRef(p[0]), c = b ? ensureCars(b).filter(function (x) { return x.id === p[1]; })[0] : null; return { b: b, c: c, i: c ? b.cars.indexOf(c) : -1 }; }
  function carTab(b, c) {
    var items = (b.charges || []).filter(function (x) { return x.car === c.id; }), total = items.reduce(function (a, x) { return a + (b.method === 'card' ? x.c : x.e); }, 0);
    var pd = (b.payments || []).filter(function (p) { return p.car === c.id; }).reduce(function (a, p) { return a + p.amt; }, 0);
    return { items: items, total: total, paid: pd, owing: Math.max(0, total - pd) };
  }
  function fitCars(b) { var cs = ensureCars(b), want = Math.max(1, b.vehicles || 1); while (cs.length < want) cs.push(newCar()); for (var i = cs.length - 1; i >= 0 && cs.length > want; i--) if (cs[i].st === 'due' && !carTab(b, cs[i]).items.length) cs.splice(i, 1); b.vehicles = cs.length; }
  function carsInCamp() { return DB.bookings.reduce(function (a, b) { return a + (b.status === 'in' ? (b.cars || []).filter(function (c) { return c.st === 'in'; }).length : 0); }, 0); }
  function whenShort(s) { return s ? (s.slice(0, 10) === TODAY ? s.slice(11, 16) : fd(s.slice(0, 10))) : ''; }
  function carsHTML(b) {
    if (b.status === 'cancelled') return '';
    var cs = ensureCars(b), nIn = cs.filter(function (c) { return c.st === 'in'; }).length, canIn = (b.status === 'confirmed' || b.status === 'in') && b.ci <= TODAY && TODAY <= b.co;
    // not given yet: say so and offer "Add vehicles"; the one empty car that waits for check-in is not drawn as if it were real
    var known = vehKnown(b), shown = known ? cs : cs.filter(function (c) { return carGiven(b, c); });
    var missing = !known || cs.some(function (c) { return !c.reg || !c.driver; });
    return '<section class="d-sec"><h4 class="h4-row">Vehicles · ' + (!known ? 'not given yet' : b.status === 'out' ? 'all left' : nIn + ' of ' + cs.length + ' in camp') + (b.status !== 'out' ? '<button type="button" class="link-btn" data-act="' + (known ? 'car-add' : 'veh-add') + '" data-ref="' + b.ref + '">' + ic('plus') + (known ? 'Add vehicle' : 'Add vehicles') + '</button>' : '') + '</h4>' +
      namesWarn(b) + (!known ? '<div class="callout warn cflex veh-tbc">' + ic('alert') + '<span><b>Vehicles: not given yet.</b> The booking is for ' + peopleTxt(b) + '. ' + esc(b.guest.first) + ' adds the vehicles when finalising the booking after paying in full, or you can add them here.' + (canIn && cs.some(function (c) { return c.st === 'due'; }) ? ' Arriving now? Press Check in and type the vehicle in at the gate.' : '') + '</span>' + (b.status !== 'out' ? '<button type="button" class="btn sm" data-act="veh-add" data-ref="' + b.ref + '">' + ic('plus') + 'Add vehicles</button>' : '') + '</div>' : '') +
      shown.map(function (c) {
        var i = cs.indexOf(c), k = b.ref + '|' + c.id, t = carTab(b, c), acts = [];
        if (c.st === 'due' && canIn) acts.push('<button type="button" class="btn green sm" data-act="car-in" data-ref="' + k + '">' + ic('in') + 'Check in</button>');
        if (c.st === 'in') acts.push('<button type="button" class="btn ghost sm" data-act="car-tab" data-ref="' + k + '">' + ic('cart') + 'Add to tab</button><button type="button" class="btn green sm" data-act="car-out" data-ref="' + k + '">' + ic('out') + 'Check out</button>');
        acts.push('<button type="button" class="icon-btn sm" data-act="car-edit" data-ref="' + k + '" aria-label="Edit vehicle" title="Edit vehicle">' + ic('edit') + '</button>');
        if (c.st === 'due' && cs.length > 1 && !t.items.length) acts.push('<button type="button" class="icon-btn sm danger-t" data-act="car-del" data-ref="' + k + '" aria-label="Remove vehicle" title="Remove vehicle">' + ic('x') + '</button>');
        var sub = [c.driver ? 'Driver ' + c.driver : '', c.people ? c.people + (c.people === 1 ? ' person' : ' people') : ''].filter(Boolean).join(' · ');
        return '<div class="car"><span class="car-i">' + ic('car') + '</span><div class="car-b"><b>' + esc(carLabel(c, i)) + '</b><small>' + esc(sub || 'Details are added at check-in') + '</small>' + ((c.guests || []).length ? '<small class="car-pass">Passengers: ' + esc(passTxt(c)) + '</small>' : '') + '<div class="car-p">' +
          (c.st === 'in' ? '<span class="pill ok"><i></i>In since ' + whenShort(c.inAt) + '</span>' : c.st === 'out' ? '<span class="pill muted"><i></i>Left ' + whenShort(c.outAt) + '</span>' : '<span class="pill muted"><i></i>Expected</span>') +
          (c.ind && carPaper(b, c).length ? (carPaper(b, c).every(function (r) { return r.scan; }) ? '<span class="pill ok">' + ic('check') + 'Signed on paper, scan on file</span>' : '<span class="pill warn">' + ic('clip') + 'Signed on paper, scan to upload</span>') : c.ind ? '<span class="pill ok">' + ic('check') + 'Indemnity signed</span>' : carSigned(b, c) ? '<span class="pill ok">' + ic('check') + 'Signed online</span>' : c.st === 'due' ? '<span class="pill muted">Indemnity not signed yet</span>' : '<span class="pill bad">' + ic('alert') + 'Indemnity not signed</span>') +
          (c.dgrSent ? '<span class="pill ok">' + ic('gift') + 'Dinokeng code sent</span>' : '') +
          (t.total ? '<span class="pill ' + (t.owing ? 'warn' : 'ok') + '">Tab ' + money(t.total) + (t.owing ? ', ' + money(t.owing) + ' owing' : ', paid') + '</span>' : '') +
          '</div></div><div class="car-a">' + acts.join('') + '</div></div>';
      }).join('') + (b.status === 'pending' ? '<p class="muted small">Vehicles can check in once the deposit is paid.</p>' : '') +
      '<div class="row-btns car-docs">' + (missing && paidUp(b) && b.status !== 'out' && b.status !== 'in' ? '<button type="button" class="btn ghost sm" data-act="send-doc" data-ref="' + b.ref + '|finalise">' + ic('send') + 'Send the finalise link</button>' : '') + '</div></section>';
  }
  function carForm(c) {
    return '<div class="grid2"><label class="fld"><span>Registration</span><input name="reg" value="' + esc(c.reg) + '" placeholder="e.g. CA 123-456" autocomplete="off" style="text-transform:uppercase"></label><label class="fld"><span>People in this vehicle</span><input type="number" min="1" max="12" name="people" value="' + (c.people || 1) + '"></label></div>' +
      '<label class="fld"><span>Vehicle (make or colour, so it is easy to spot at the gate)</span><input name="make" value="' + esc(c.make || '') + '" placeholder="e.g. white Hilux with a trailer" autocomplete="off"></label>' +
      '<div class="grid2"><label class="fld"><span>Driver</span><input name="driver" value="' + esc(c.driver) + '"></label><label class="fld"><span>Driver\'s mobile</span><input name="phone" inputmode="tel" value="' + esc(c.phone) + '"></label></div>' +
      '<label class="fld"><span>Passengers, one name per line (everyone else in the vehicle)</span><textarea name="guests" rows="3">' + esc((c.guests || []).join('\n')) + '</textarea></label>';
  }
  function readCar(f, c) { delete c.auto; if (f.elements.make) c.make = fval(f, 'make'); c.reg = fval(f, 'reg').toUpperCase(); c.driver = fval(f, 'driver'); c.phone = fval(f, 'phone'); c.guests = fval(f, 'guests').split(/\n/).map(function (x) { return x.trim(); }).filter(Boolean); c.minors = minorsOf(c.minors, c.guests); c.people =Math.max(1, +fval(f, 'people') || 1, (c.driver ? 1 : 0) + c.guests.length); }
  // the indemnity at check-in: who in this vehicle has signed, who has not, and a way to sign now
  function carInd(b, c) {
    var names = [c.driver].concat(c.guests || []).filter(Boolean), s = K.ind.status(b.ref, people(b));
    var done = names.filter(function (n) { return s.cov[K.ind.nkey(n)]; }), left = names.filter(function (n) { return !s.cov[K.ind.nkey(n)]; });
    var unnamed = Math.max(0, (c.people || names.length) - names.length);
    return { names: names, done: done, left: left, unnamed: unnamed, all: names.length > 0 && !left.length && !unnamed, s: s };
  }
  function paperLine(b, c) { var pp = carPaper(b, c), n = pp.filter(function (r) { return r.scan; }).length; return pp.length ? '<small>Signed on paper: ' + esc(pp.map(function (r) { return r.name; }).join(', ')) + '. ' + (n === pp.length ? 'The scan is on file.' : n ? n + ' of ' + pp.length + ' scans are on file.' : 'The scan is not uploaded yet.') + '</small>' : ''; }
  function indBox(k, on) {
    var o = carOf(k), b = o.b, c = o.c; if (!c) return '';
    var x = carInd(b, c), list = function (a) { return esc(a.join(', ')); };
    if (x.all) return '<div class="ind-box ok"><input type="hidden" name="ind" value="online"><span class="ind-box-i">' + ic('check') + '</span><div><b>Indemnity complete: everyone in this vehicle has signed</b><small>' + list(x.done) + '</small>' + paperLine(b, c) + '</div></div>';
    if (on && c.ind && c.ind.by !== 'Online') return '<div class="ind-box ok"><span class="ind-box-i">' + ic('check') + '</span><div><b>Indemnity marked as signed</b><small>Ticked by ' + esc(c.ind.by) + ' ' + whenShort(c.ind.at) + (x.left.length ? '. Signed on paper: ' + list(x.left) : '') + '</small>' + paperLine(b, c) + '</div><label class="check"><input type="checkbox" name="ind" checked><span>Signed</span></label></div>';
    return '<div class="ind-box bad" role="alert"><span class="ind-box-i">' + ic('alert') + '</span><div class="ind-box-b"><b>Indemnity NOT complete for this vehicle</b>' +
      (x.left.length ? '<small><b>Not signed yet:</b> ' + list(x.left) + '</small>' : '') +
      (x.unnamed ? '<small><b>' + x.unnamed + ' ' + (x.unnamed === 1 ? 'person is' : 'people are') + ' not named</b> in this vehicle, so they cannot have signed. Add their names above, then sign.</small>' : '') +
      (x.done.length ? '<small>Already signed: ' + list(x.done) + '</small>' : '') +
      '<small>Whole booking: ' + Math.min(x.s.covered, x.s.total) + ' of ' + x.s.total + ' signed for</small>' +
      '<div class="row-btns"><button type="button" class="btn sm" data-act="ind-sign-car" data-ref="' + k + '">' + ic('edit') + 'Sign now at reception</button><button type="button" class="btn ghost sm" data-act="ind-print" data-ref="' + k + '">' + ic('note') + 'Print the paper form</button></div>' +
      '<label class="check"><input type="checkbox" name="ind"><span>Everyone still to sign <b>signed the paper form</b> instead</span></label></div></div>';
  }
  function actCarIn(key) {
    var o = carOf(key), b = o.b, c = o.c, i = o.i; if (!c) return; var cs = b.cars, bal = balance(b);
    modal('Check in ' + esc(carLabel(c, i)), '<p class="muted small">' + esc(guestName(b)) + ' · ' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + (cs.length > 1 ? ' · vehicle ' + (i + 1) + ' of ' + cs.length : '') + '</p>' + indBox(key, !!c.ind) + carForm(c) +
      (bal > 0 ? '<p class="callout warn">' + ic('alert') + ' <b>' + money(bal) + '</b> is still owing on this booking. Collect it at reception.</p>' : '') + handHTML(b) + issueField(),
      'Check in', function (f) {
        if (f.elements.reg && !String(fval(f, 'reg')).trim()) { toast('Add the registration number first: it goes on the gate list'); f.elements.reg.focus(); return false; }
        if (!fval(f, 'ind')) { toast('The indemnity is not complete. Sign now at reception, or tick that they signed the paper form.'); var ib = $('.ind-box', f); if (ib) { ib.scrollIntoView({ block: 'center', behavior: 'smooth' }); ib.classList.remove('shake'); void ib.offsetWidth; ib.classList.add('shake'); } return false; }
        var onl = fval(f, 'ind') === 'online';
        readCar(f, c); vehSaid(b); c.ind = c.ind || { at: nowStamp(), by: onl ? 'Online' : ME.name };
        if (!onl) { var cx = carInd(b, c), who = cx.left.concat(cx.unnamed ? [cx.unnamed + ' unnamed ' + (cx.unnamed === 1 ? 'person' : 'people')] : []); if (who.length) b.notes.push({ at: nowStamp(), by: ME.name, text: carLabel(c, i) + ': paper indemnity signed at check-in by ' + who.join(', ') + '. The scan still has to be uploaded.' }); paperRecs(b, c, nowStamp(), ME.name); } c.st = 'in'; c.inAt = nowStamp(); c.inBy = ME.name; delete c.noShow;
        var hn = handRead(f, b); if (hn) b.notes.push({ at: nowStamp(), by: ME.name, text: 'Camp shop order ' + hn + '.' });
        issueRead(f, b);
        if (b.status !== 'in' && bal > 0) b.notes.push({ at: nowStamp(), by: ME.name, text: 'Checked in with ' + money(bal) + ' still owing. Collect at reception.' });
        b.status = 'in';
        var left = cs.filter(function (x) { return x.st === 'due'; }).length;
        log(carLabel(c, i) + ' checked in for ' + guestName(b) + ' (' + standById(b.stand).name + ')', b.ref); save(); refresh();
        toast(esc(carLabel(c, i)) + ' checked in' + (left ? '. ' + left + ' more vehicle' + (left > 1 ? 's' : '') + ' to come' : '. Enjoy your stay, ' + esc(b.guest.first) + '!'));
      }, { onOpen: handWire });
  }
  function actCarOut(key) {
    var o = carOf(key), b = o.b, c = o.c, i = o.i; if (!c) return;
    var os = orderState(b), undel = os ? [os.left ? itemsTxt(os.left) : ''].concat(os.todo.map(function (d) { return itemsTxt(d.items); })).filter(Boolean).join(', ') : '';
    var cs = b.cars, t = carTab(b, c), last = !cs.some(function (x) { return x !== c && x.st === 'in'; }), due = cs.filter(function (x) { return x !== c && x.st === 'due'; }), after = balance(b) - t.owing;
    modal('Check out ' + esc(carLabel(c, i)), '<p class="muted small">' + esc(guestName(b)) + ' · ' + esc(standById(b.stand).name) + (c.driver ? ' · driver ' + esc(c.driver) : '') + '</p>' +
      '<h5>Tab</h5>' + (t.items.length ? '<div class="lines">' + t.items.map(function (x) { return '<div class="ln"><span>' + esc(x.desc.replace(/^Shop: /, '')) + ' <small class="muted">' + fd(x.d) + '</small></span><span>' + money(b.method === 'card' ? x.c : x.e) + '</span></div>'; }).join('') + (t.paid ? '<div class="ln"><span>Already paid</span><span class="ok-t">' + money(t.paid) + '</span></div>' : '') + '<div class="ln tot"><span>Owing on this tab</span><span>' + money(t.owing) + '</span></div></div>' : '<p class="muted small">Nothing on this vehicle\'s tab.</p>') +
      (t.owing ? '<span class="fld-l" style="margin-top:12px">Settle the tab</span><div class="seg">' + [['cash', 'Cash'], ['card', 'Card'], ['eft', 'EFT'], ['later', 'Add to the booking']].map(function (m, j) { return '<label><input type="radio" name="pay" value="' + m[0] + '"' + (j ? '' : ' checked') + '><span>' + m[1] + '</span></label>'; }).join('') + '</div>' : '') +
      (last && due.length ? '<label class="check"><input type="checkbox" name="nocome"' + (b.co <= TODAY ? ' checked' : '') + '><span>The other ' + (due.length === 1 ? 'vehicle' : due.length + ' vehicles') + ' did not come</span></label>' : '') +
      (last && after > 0 ? '<p class="callout warn">' + ic('alert') + ' The booking still has <b>' + money(after) + '</b> owing' + (t.owing ? ' besides this tab' : '') + '. Record the payment before they leave.</p>' : '') +
      (last && undel ? '<p class="callout warn">' + ic('cart') + ' Ordered but never handed over: <b>' + esc(undel) + '</b>. Give it to them now, or take it off the bill.</p>' : '') + issueField(),
      'Check out', function (f) {
        var pay = t.owing ? ($('[name=pay]:checked', f) || {}).value : '';
        if (pay && pay !== 'later') b.payments.push({ d: TODAY, amt: t.owing, m: pay, type: 'Tab', ref: 'Tab ' + carLabel(c, i), car: c.id });
        if (pay === 'later') b.notes.push({ at: nowStamp(), by: ME.name, text: carLabel(c, i) + '\'s tab of ' + money(t.owing) + ' moved to the booking balance.' });
        c.st = 'out'; c.outAt = nowStamp(); c.outBy = ME.name; issueRead(f, b);
        if (last && fval(f, 'nocome')) b.cars = cs.filter(function (x) { return x.st !== 'due'; });
        var stillIn = b.cars.filter(function (x) { return x.st === 'in'; }).length;
        if (!stillIn && !b.cars.some(function (x) { return x.st === 'due'; })) b.status = 'out';
        b.vehicles = b.cars.length;
        log(carLabel(c, i) + ' checked out (' + guestName(b) + ', ' + standById(b.stand).name + ')', b.ref); save(); refresh();
        toast(b.status === 'out' ? 'Checked out. The stand is ready for cleaning.' : esc(carLabel(c, i)) + ' checked out. ' + stillIn + ' vehicle' + (stillIn === 1 ? '' : 's') + ' still in camp');
        if (b.status === 'out' && can('cap:guests')) setTimeout(function () { thanksStep(b.ref); }, 0);   // the next small step: thank the guest and ask for a Google review
      }, { noFocus: true });
  }
  // staff add the vehicles for a guest who has not given them yet: how many are coming, and the first one's details
  function actVehAdd(ref) {
    var b = byRef(ref); if (!b) return; var cs = ensureCars(b), c = cs[0];
    modal('Add vehicles for ' + esc(guestName(b)), '<p class="muted small">The booking is for ' + peopleTxt(b) + '. Type in what ' + esc(b.guest.first) + ' told you. A registration can also be added later, or at check-in.</p>' +
      '<label class="fld"><span>How many vehicles are coming?</span><input type="number" min="1" max="20" name="vn" value="1"></label><h5 class="m-h">Vehicle 1</h5>' + carForm(c),
      'Save vehicles', function (f) {
        var n = Math.max(1, Math.min(20, +fval(f, 'vn') || 1));
        readCar(f, c); vehSaid(b); b.vehicles = n; fitCars(b);
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Vehicles added by ' + ME.name + ': ' + b.cars.length + ' vehicle' + (b.cars.length === 1 ? '' : 's') + (c.reg ? ', the first is ' + c.reg : '') + '.' });
        log('Vehicles added to ' + b.ref, b.ref); save(); refresh();
        toast(b.cars.length > 1 ? b.cars.length + ' vehicles saved. Add the details of the others under Vehicles' : 'Vehicle saved');
      }, { noFocus: true });
  }
  function actCarEdit(key) {
    var o = carOf(key), b = o.b, c = o.c, i = o.i; if (!c) return;
    modal('Edit ' + esc(carLabel(c, i)), carForm(c) + (c.st !== 'due' ? indBox(key, !!c.ind) : ''), 'Save', function (f) {
      readCar(f, c); vehSaid(b); if (c.st !== 'due') { c.ind = fval(f, 'ind') ? (c.ind || { at: nowStamp(), by: ME.name }) : null; if (fval(f, 'ind') === true) paperRecs(b, c, c.ind.at, ME.name); else if (!c.ind) paperDrop(b, c); }
      log('Vehicle details updated on ' + b.ref, b.ref); save(); refresh(); toast(namedIn(b) > people(b) ? 'Saved, but ' + namedIn(b) + ' people are now named and the booking is for ' + people(b) : 'Vehicle saved');
    });
  }
  var IND_OLD = 'Kyleu Bush Camp is inside the Dinokeng Big 5 Game Reserve. Dangerous wild animals, including lion, leopard, elephant, rhino and buffalo, roam freely through the reserve and the unfenced parts of the camp.\n\nI enter the reserve, camp and drive at my own risk. I accept responsibility for myself, the people in my vehicle and any children in my care, and for keeping children supervised at all times, including at the pool.\n\nI release Kyleu Bush Camp, its owners and staff from any claim for injury, illness, death, loss or damage to property, however it is caused, except where the law does not allow it.\n\nI will follow the camp rules and the Dinokeng reserve rules: stay in my vehicle outside the camp, keep to the speed limits, never feed or approach animals, and only make fires in the boma or braai provided.';
  // the old example wording is replaced by Kyleu's own indemnity (K.ind.DEFAULT) unless someone changed it
  function indText() { var t = DB.settings && DB.settings.indemnity; return t && t !== IND_OLD ? t : K.ind.DEFAULT; }
  if (K.ind) K.ind.override = function () { return DB ? indText() : ''; };
  K.holdOverride = function () { return DB ? holdRules() : null; };
  function printIndemnity(ref, cid) {
    var b = ref ? byRef(ref) : null, c = b && cid ? (b.cars || []).filter(function (x) { return x.id === cid; })[0] : null, rows = Math.max(4, c && c.people ? c.people : b ? people(b) : 6);
    var w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print the form'); return; }
    var line = function (l, v) { return '<div class="f"><span>' + l + '</span><b>' + (v ? esc(v) : '&nbsp;') + '</b></div>'; }, dt = { day: 'numeric', month: 'long', year: 'numeric' };
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>Indemnity form' + (b ? ' ' + esc(b.ref) : '') + '</title><style>body{font:14px/1.5 Arial,sans-serif;color:#222;max-width:760px;margin:30px auto;padding:0 20px}h1{font-size:22px;margin:0 0 4px}.sub{color:#666;margin:0 0 18px}.grid{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:0 0 18px}.f{display:flex;gap:8px;border-bottom:1px solid #999;padding:4px 0}.f span{color:#666;white-space:nowrap}.txt p{margin:0 0 10px}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #999;padding:10px 8px;text-align:left}th{background:#f2f2f2;font-size:12px}td{height:26px}.note{font-size:12px;color:#666;margin-top:12px}</style></head><body>' +
      '<h1>Kyleu Bush Camp: indemnity</h1><p class="sub">Dinokeng Big 5 Game Reserve · every adult signs before entering the camp</p>' +
      '<div class="grid">' + line('Booking', b ? b.ref : '') + line('Stand', b ? standById(b.stand).name : '') + line('Arrive', b ? fd(b.ci, dt) : '') + line('Depart', b ? fd(b.co, dt) : '') + line('Vehicle registration', c ? c.reg : '') + line('Driver', c ? c.driver : '') + '</div>' +
      '<div class="txt">' + K.ind.html(indText()) + '</div>' +
      '<table><thead><tr><th style="width:30%">Full name</th><th style="width:22%">ID or passport number</th><th>Signature</th><th style="width:14%">Date</th></tr></thead><tbody>' + (c ? [c.driver].concat(c.guests || []).filter(Boolean) : []).map(function (nm) { return '<tr><td>' + esc(nm) + (nm !== c.driver && isMinor(c, nm) ? ' (under 18)' : '') + '</td><td></td><td></td><td></td></tr>'; }).join('') + new Array(Math.max(1, rows - (c ? [c.driver].concat(c.guests || []).filter(Boolean).length : 0)) + 1).join('<tr><td></td><td></td><td></td><td></td></tr>') + '</tbody></table>' +
      '<p class="note">A parent or guardian signs for children under 18.</p><script>window.onload=function(){window.print()}<\/script></body></html>');
    w.document.close();
  }

  /* ---------- Dinokeng partner codes: one per vehicle ----------
     Staff make the codes by hand on Dinokeng's partner site (guest email + one code per car),
     paste each code onto its car here and send them to the guest. */
  function dgrLink() { return (DB.settings && DB.settings.dgrLink) || 'https://dinokeng.plnktn.io/'; }
  function codesTodo(b) { return ensureCars(b).filter(function (c) { return !c.dgrSent; }).length; }
  function dgrHTML(b) {
    if (b.status === 'cancelled') return '';
    var cs = ensureCars(b), n = cs.length, sent = cs.filter(function (c) { return c.dgrSent; }).length;
    return '<section class="d-sec dgr"><h4 class="h4-row">Dinokeng discount vouchers (DGR CP)<span class="pill ' + (sent === n ? 'ok' : sent ? 'warn' : 'muted') + '">' + sent + ' of ' + n + ' sent</span></h4>' +
      (!vehKnown(b) ? '<p class="callout warn cflex">' + ic('info') + '<span><b>Vehicles not given yet: ' + VEH_ASSUMED + '.</b> Make one code now if you like, and the others once ' + esc(b.guest.first) + ' says how many vehicles are coming.</span></p>' : '') +
      '<details class="dgr-how"><summary>How the vouchers work</summary><ol class="dgr-steps"><li><b>Make the codes</b> on the Dinokeng site: one code per vehicle (copy the client\'s email and the number of vehicles below).</li><li><b>Paste</b> each vehicle\'s code in its box.</li><li><b>Send the codes to the client yourself</b>, by WhatsApp or email. Dinokeng does not send them.</li></ol></details>' +
      '<div class="dgr-copy"><button type="button" class="chip" data-copy="' + esc(b.guest.email) + '">' + ic('mail') + esc(b.guest.email || 'No email yet') + '<small>Copy</small></button><button type="button" class="chip" data-copy="' + n + '">' + ic('car') + n + ' vehicle' + (n === 1 ? '' : 's') + (vehKnown(b) ? '' : ' (assumed)') + '<small>Copy</small></button><a class="btn ghost sm" href="' + esc(dgrLink()) + '" target="_blank" rel="noopener">' + ic('ext') + 'Open Dinokeng site to make codes</a></div>' +
      '<div class="dgr-cars">' + cs.map(function (c, i) {
        var k = b.ref + '|' + c.id;
        return '<div class="dgr-car"><label class="dgr-tick"><input type="checkbox" data-dgr-tick="' + k + '"' + (c.dgr && !c.dgrSent ? ' checked' : '') + ' aria-label="Choose ' + esc(carLabel(c, i)) + '"></label>' +
          '<span class="dgr-who"><b>' + esc(carLabel(c, i)) + '</b><small>' + esc(!vehKnown(b) && !carGiven(b, c) ? 'Assumed until the guest tells us' : [c.driver, c.people ? c.people + (c.people === 1 ? ' person' : ' people') : ''].filter(Boolean).join(' · ') || 'Registration not given yet') + '</small></span>' +
          '<input class="dgr-code" data-dgr-code="' + k + '" value="' + esc(c.dgr || '') + '" placeholder="Paste code" autocomplete="off" aria-label="Dinokeng code for ' + esc(carLabel(c, i)) + '">' +
          '<span class="dgr-st">' + (c.dgrSent ? '<span class="pill ok">' + ic(c.dgrSent.via === 'WhatsApp' ? 'wa' : 'check') + 'Sent by ' + (c.dgrSent.via || 'email') + ' ' + whenShort(c.dgrSent.at) + '</span>' : '<span class="pill muted">Not sent to client</span>') + '</span>' +
          '<button type="button" class="btn ghost sm" data-act="dgr-send" data-ref="' + k + '">' + ic('send') + (c.dgrSent ? 'Send again' : 'Send to client') + '</button></div>';
      }).join('') + '</div>' +
      '<div class="row-btns dgr-acts"><span class="muted small">Opens a preview, then send by WhatsApp or email</span><button type="button" class="btn ghost sm" data-act="dgr-send-sel" data-ref="' + b.ref + '">' + ic('send') + 'Send ticked cars to client</button><button type="button" class="btn sm" data-act="dgr-send-all" data-ref="' + b.ref + '">' + ic('send') + 'Send all codes to client</button></div>' +
      (creditLeft(b.guest.email) ? '<p class="small" style="margin-top:10px">' + ic('info') + ' This guest has credit to use: ' + creditList(b.guest.email) + '.</p>' : '') + '</section>';
  }
  // save a pasted code without redrawing the panel (so a click on Send still lands)
  function saveCode(key, val) {
    var o = carOf(key); if (!o.c) return; val = val.trim().toUpperCase();
    if (val === (o.c.dgr || '')) return;
    o.c.dgr = val; if (o.c.dgrSent && o.c.dgrSent.code !== val) delete o.c.dgrSent;
    var t = $('[data-dgr-tick="' + key + '"]'); if (t && val) t.checked = true;
    save();
  }
  function sendCodes(b, cars) {
    $$('[data-dgr-code]').forEach(function (inp) { if (inp.dataset.dgrCode.indexOf(b.ref + '|') === 0) saveCode(inp.dataset.dgrCode, inp.value); });
    var withCode = cars.filter(function (c) { return c.dgr; }), missing = cars.length - withCode.length;
    if (!cars.length) { toast('Tick the cars to send, or use Send all codes'); return; }
    if (!withCode.length) { toast('Paste the Dinokeng code' + (cars.length > 1 ? 's' : '') + ' first'); return; }
    var lines = withCode.map(function (c) { var i = b.cars.indexOf(c); return '- ' + carLabel(c, i) + (c.driver ? ' (driver ' + c.driver + ')' : '') + ': ' + c.dgr; }).join('\n'), many = withCode.length > 1;
    if (missing) toast(missing + ' car' + (missing > 1 ? 's have' : ' has') + ' no code yet, so ' + (missing > 1 ? 'they are' : 'it is') + ' left out');
    sendBox({ b: b, title: 'Send Dinokeng code' + (many ? 's' : '') + ' to ' + guestName(b), value: 'codes', load: function () {
      return { subject: 'Your Dinokeng discount voucher' + (many ? 's' : '') + ' for ' + fd(b.ci, { day: 'numeric', month: 'long' }),
        text: 'Hi ' + b.guest.first + ',\n\nKyleu is a proud DGR CP member, so you qualify for Dinokeng Conservation Fee Discount Vouchers: R85 per adult per night instead of R100.\n\nYour voucher code' + (many ? 's, one for each vehicle' : '') + ':\n' + lines +
          '\n\nUse ' + (many ? 'each code' : 'the code') + ' when you buy your conservation fees online at https://dinokeng.plnktn.io before you arrive. Each vehicle that uses the self-drive route also needs a Self Drive Permit (R250 once off).' + (many ? '\n\nPlease pass each driver their own code.' : '') + '\n\nSee you in the bush!\n' + ME.name + '\nKyleu Bush Camp',
        docs: [docCodes(b, withCode)] };
    }, onSent: function (via) { codesSent(b, withCode, via); } });
  }
  // the codes went to the guest: each vehicle remembers it, and the booking gets a note
  function codesSent(b, cars, via) {
    cars.forEach(function (c) { c.dgrSent = { at: nowStamp(), by: ME.name, code: c.dgr, via: via === 'wa' ? 'WhatsApp' : 'email' }; });
    b.notes.push({ at: nowStamp(), by: ME.name, text: 'Dinokeng code' + (cars.length > 1 ? 's' : '') + ' sent by ' + (via === 'wa' ? 'WhatsApp' : 'email') + ': ' + cars.map(function (c) { return carLabel(c, b.cars.indexOf(c)) + ' ' + c.dgr; }).join(', ') + '.' });
  }
  function copyText(s, msg) { var done = function () { toast(msg || 'Copied'); }; if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(String(s)).then(done, function () { fallbackCopy(s); done(); }); else { fallbackCopy(s); done(); } }
  function fallbackCopy(s) { var ta = document.createElement('textarea'); ta.value = s; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); } catch (e) {} ta.remove(); }

  /* =========================================================
     Website wording, contact details and rate wording.
     What staff change here is handed to the website.
     Demo: through this browser ("kyleu-web-content"). Live: saved on the server.
     ========================================================= */
  var WEBK = 'kyleu-web-content';
  function webDB() { DB.web = DB.web || {}; var w = DB.web; w.text = w.text || {}; w.settings = w.settings || {}; w.rateText = w.rateText || {}; w.home = w.home || {}; return w; }
  // which nights cost the weekend rate (set on Rates & fees > Payment & booking rules)
  function applyWk() { var d = DB && DB.web && DB.web.wkDays; P.wkDays = d && d.length ? d.slice() : [5, 6, 0]; }
  function publishWeb() {
    if (!DB || !P) return;
    var w = webDB(), prices = {};
    Object.keys(DB.rates || {}).forEach(function (k) { prices[k] = { amount: DB.rates[k] }; });
    Object.keys(w.rateText).forEach(function (k) { prices[k] = Object.assign(prices[k] || {}, w.rateText[k]); });
    var out = { prices: prices, text: w.text, settings: w.settings, hol: DB.hol || null, home: w.home, rules: { wkDays: w.wkDays && w.wkDays.length ? w.wkDays : null, hold: w.hold || null }, indemnity: indText() };
    // stand sizes: the usual number of guests and the most each stand can ever take (the website asks Kyleu in between, and stops above the most)
    out.stands = {}; STANDS.forEach(function (s) { out.stands[s.id] = { guests: s.guests || 8, max: standMax(s) }; });
    if (DB.products) out.shop = DB.products.filter(function (p) { return p.active !== false; }).map(function (p) { return { label: p.label, amount: p.amount, note: p.note || '', img: p.img || '', cat: p.cat || '' }; });
    try { localStorage.setItem(WEBK, JSON.stringify(out)); } catch (e) {}
  }
  // the name and description of a rate as the website shows them
  function rateWord(sec, label, f) { var it = sec && sec.items.filter(function (i) { return i.label === label; })[0]; if (!it) return ''; var o = webDB().rateText[sec.title + '|' + label] || {}; return f === 'name' ? (o.name || it.label) : (o.note != null ? o.note : it.note || ''); }

  // the Website wording page (not WEB: that name is the website bookings key)
  var WTX = { tab: 'details', q: '', pages: null, loading: false, S0: null };
  var WEB_PAGES = [['home', 'Home', 'index.html'], ['discover', 'Discover', 'discover.html'], ['experience', 'Experience', 'experience.html'], ['dinokeng', 'Dinokeng', 'dinokeng.html'], ['stay', 'Stay and book', 'stay.html'], ['stands', 'Stands', 'stands.html'], ['news', 'Camp news', 'news.html'], ['contact', 'Contact', 'contact.html'], ['policies', 'Policies', 'policies.html'], ['site', 'Footer', 'index.html']];
  var WEB_KIND = { h1: 'Main heading', h2: 'Heading', h3: 'Sub-heading', h4: 'Sub-heading', h5: 'Sub-heading', p: 'Text', figcaption: 'Photo caption', summary: 'Question', li: 'List item', dt: 'Label', dd: 'Text', blockquote: 'Quote', span: 'Small label', div: 'Label' };
  // wording from a page, shown the way staff type it: **bold**, *highlighted*, [words](link)
  function htmlToEdit(node) {
    var out = '';
    (function walk(n) { Array.prototype.forEach.call(n.childNodes, function (c) {
      if (c.nodeType === 3) out += c.nodeValue.replace(/[ \t\r\n]+/g, ' ');
      else if (c.nodeType === 1) { var t = c.tagName.toLowerCase(); if (t === 'br') out += '\n'; else if (t === 'strong' || t === 'b') { out += '**'; walk(c); out += '**'; } else if (t === 'em' || t === 'i') { out += '*'; walk(c); out += '*'; } else if (t === 'a') { out += '['; walk(c); out += '](' + (c.getAttribute('href') || '') + ')'; } else if (t !== 'svg') walk(c); }
    }); })(node);
    return out.replace(/ ?\n ?/g, '\n').trim();
  }
  function webLoad() {
    if (WTX.loading || WTX.pages) return; WTX.loading = true;
    var files = []; WEB_PAGES.forEach(function (p) { if (files.indexOf(p[2]) < 0) files.push(p[2]); });
    var pages = {}; WEB_PAGES.forEach(function (p) { pages[p[0]] = []; });
    Promise.all(files.map(function (f) {
      return fetch('../' + f, { cache: 'no-cache' }).then(function (r) { return r.text(); }).then(function (html) {
        var doc = new DOMParser().parseFromString(html, 'text/html'), group = '';
        $$('[data-edit]', doc).forEach(function (el) {
          var key = el.getAttribute('data-edit'), pg = key.split('.')[0], tag = el.tagName.toLowerCase(); if (!pages[pg] || pages[pg].some(function (x) { return x.key === key; })) return;
          if (pg === 'site' && f !== 'index.html') return;
          var def = htmlToEdit(el); if (!def) return;
          if (tag === 'h1' || tag === 'h2') { group = def.replace(/\*/g, ''); for (var bi = pages[pg].length - 1; bi >= 0 && pages[pg][bi].tag === 'span'; bi--) pages[pg][bi].group = group; }   // the small label above a heading belongs with it
          pages[pg].push({ key: key, tag: tag, def: def, group: pg === 'site' ? 'Footer' : group, faq: tag === 'p' && !!el.closest('.ans') });
        });
      }).catch(function () {});
    })).then(function () { return K.settingsFile ? K.settingsFile() : null; }).catch(function () { return null; }).then(function (S) {
      WTX.S0 = S;
      // wording the booking steps draw by themselves
      pages.stay.push({ key: 'booking.intl.title', tag: 'h3', def: 'Booking from outside South Africa?', group: 'Paying for a booking' });
      pages.stay.push({ key: 'booking.intl.text', tag: 'p', def: 'Bank transfers from other countries can be expensive. WhatsApp us and we will arrange for you to pay by cash or card when you arrive.', group: 'Paying for a booking' });
      WTX.pages = pages; WTX.loading = false; if (route() === 'webtext') render();
    });
  }
  var WEB_SET = [['Phone', 'Phone number', 'Shown in the header, footer and contact page', 'tel'], ['WhatsApp number', 'WhatsApp number', 'Country code first, no spaces or plus sign, e.g. 27604584478', 'tel'], ['Email', 'Email address', 'Where guests email you', 'email'], ['Guest rating', 'Guest rating (stars)', 'Shown on the home page and the Experience page, e.g. 4.9', 'text'], ['Google reviews', 'Link to your Google reviews', 'The "Read our reviews" button opens this', 'url'], ['Pay Dinokeng fees', 'Link to pay Dinokeng fees', 'Dinokeng\'s own payment page', 'url']];
  function vWeb() {
    webLoad();
    var w = webDB(), tabs = [['details', 'Contact details']].concat(WEB_PAGES.map(function (p) { return [p[0], p[1]]; })), body = '', nChanged = Object.keys(w.text).length;
    var tabN = function (id) { if (!WTX.pages || id === 'details') return 0; return WTX.pages[id].filter(function (x) { return w.text[x.key] != null; }).length; };
    if (!WTX.pages) body = '<p class="empty">Loading the website\'s wording…</p>';
    else if (WTX.tab === 'details') {
      body = '<section class="card"><header class="card-h"><h3>Contact details and links</h3><span class="muted small">Used all over the website</span></header><div class="wt-set">' +
        WEB_SET.map(function (r) { var def = WTX.S0 ? WTX.S0.get(r[0], '') : '', cur = w.settings[r[0]] != null ? w.settings[r[0]] : def;
          return '<label class="fld"><span>' + r[1] + (w.settings[r[0]] != null ? ' <em class="wt-ch">Changed</em>' : '') + '</span><input data-ws="' + esc(r[0]) + '" data-def="' + esc(def) + '" value="' + esc(cur) + '" type="' + (r[3] === 'email' ? 'email' : 'text') + '"' + (r[3] === 'tel' ? ' inputmode="tel"' : r[3] === 'url' ? ' inputmode="url"' : '') + '><small class="muted">' + r[2] + '</small></label>'; }).join('') + '</div>' +
        '<p class="hint">' + ic('info') + ' Each box saves by itself when you click outside it. Social media links are on the <a href="#/social">Social media</a> page, bank details under <a href="#/settings">Settings</a>, and prices on the <a href="#/rates">Rates &amp; fees</a> page.</p></section>';
    } else {
      var list = WTX.pages[WTX.tab] || [], q = WTX.q.trim().toLowerCase(), file = WEB_PAGES.filter(function (p) { return p[0] === WTX.tab; })[0][2], heroCard = '';
      if (WTX.tab === 'home') {
        var hv = w.home.hero || '', hopt = function (v, img, t, sub, extra) { return '<label class="hero-opt' + (hv === v ? ' on' : '') + '"><input type="radio" name="hero" data-hero value="' + v + '"' + (hv === v ? ' checked' : '') + '>' + img + '<span><b>' + t + '</b><small>' + sub + '</small>' + (extra || '') + '</span></label>'; };
        heroCard = '<section class="card"><header class="card-h"><h3>Header photo</h3><span class="muted small">The big photo at the top of the home page</span></header><div class="hero-pick">' +
          hopt('', '<img src="../assets/img/hero/kyleu-sunset.jpg" alt="">', 'Sunset at camp', 'Sharp on phones and on big screens') +
          hopt('tree', '<img src="../assets/img/hero/kyleu-camp.jpg" alt="">', 'Camp under the tree', 'A small photo, so it looks soft on big screens') +
          hopt('own', '<img data-own-hero alt="" src="data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==">', 'Your own photo', 'A wide photo, at least 2000 pixels across', '<span class="btn ghost sm hero-up">' + ic('image') + (w.home.heroName ? 'Choose another' : 'Choose a photo') + '<input type="file" accept="image/*" data-hero-file hidden></span>') +
          '</div></section>';
        setTimeout(function () { var im = $('[data-own-hero]'); if (im && K.files) K.files.get('home-hero').then(function (b) { if (b) im.src = URL.createObjectURL(b); }); }, 0);
      }
      if (q) list = list.filter(function (x) { return (x.def + ' ' + (w.text[x.key] || '')).toLowerCase().indexOf(q) >= 0; });
      var groups = [], cur = null; list.forEach(function (x) { if (!cur || cur.t !== x.group) { cur = { t: x.group, items: [] }; groups.push(cur); } cur.items.push(x); });
      body = heroCard + '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-wtq placeholder="Find wording on this page" value="' + esc(WTX.q) + '" aria-label="Find wording"></label><a class="btn ghost" href="../' + file + '" target="_blank" rel="noopener">' + ic('ext') + 'View this page</a></div>' +
        (groups.length ? groups.map(function (g) {
          return '<section class="card wt-card"><header class="card-h"><h3>' + esc(g.t || 'Top of the page') + '</h3></header>' + g.items.map(function (x) {
            var has = w.text[x.key] != null, val = has ? w.text[x.key] : x.def, long = val.length > 70 || /\n/.test(val) || x.def.length > 70, kind = x.faq ? 'Answer' : WEB_KIND[x.tag] || 'Text';
            return '<div class="wt-row' + (has ? ' changed' : '') + '"><label class="fld"><span>' + kind + (has ? ' <em class="wt-ch">Changed</em>' : '') + '</span>' +
              (long ? '<textarea data-wt="' + esc(x.key) + '" rows="' + Math.min(9, Math.max(2, Math.ceil(val.length / 85))) + '">' + esc(val) + '</textarea>' : '<input data-wt="' + esc(x.key) + '" value="' + esc(val) + '">') + '</label>' +
              (has ? '<button type="button" class="link-btn" data-wt-reset="' + esc(x.key) + '">' + ic('return') + 'Use the original wording</button>' : '') + '</div>';
          }).join('') + '</section>';
        }).join('') : '<p class="empty">' + (q ? 'No wording on this page matches your search.' : 'This page has no wording to change here: the website fills it in by itself.') + '</p>');
    }
    return '<div class="page-h"><div><h1>Website wording</h1><p class="muted">Change the words on the website yourself. Pick a page, change a box and click outside it: it saves by itself and the website updates.</p></div>' + (nChanged ? '<div class="ph-act"><span class="pill info"><i></i>' + nChanged + ' wording change' + (nChanged === 1 ? '' : 's') + ' live</span></div>' : '') + '</div>' +
      '<div class="rp-tabs page-tabs">' + tabs.map(function (t) { var n = tabN(t[0]); return '<button class="' + (WTX.tab === t[0] ? 'on' : '') + '" data-webtab="' + t[0] + '">' + t[1] + (n ? ' <span class="tab-n">' + n + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      (WTX.tab !== 'details' && WTX.pages ? '<p class="hint wt-tips">' + ic('info') + ' <span>Put <b>**two stars**</b> around words to make them bold and <b>*one star*</b> to highlight them. A link is written as <b>[the words](https://the-link)</b>. Prices and anything the booking system fills in are not here: change prices on the <a href="#/rates">Rates &amp; fees</a> page.</span></p>' : '') + body +
      '<p class="demo-note">' + ic('info') + 'Demo: your changes show on the website in this browser. In the live version they are saved on the server, so every visitor sees them.</p>';
  }
  // make a photo smaller before it is kept (longest side at most `max` pixels)
  function resizeImg(file, max, cb) {
    var url = URL.createObjectURL(file), im = new Image();
    im.onload = function () { var k = Math.min(1, max / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); URL.revokeObjectURL(url); c.toBlob(function (b) { cb(b, im.width, im.height); }, 'image/jpeg', .86); };
    im.onerror = function () { URL.revokeObjectURL(url); cb(null); };
    im.src = url;
  }
  function webFind(key) { var f = null; Object.keys(WTX.pages || {}).forEach(function (p) { WTX.pages[p].forEach(function (x) { if (x.key === key) f = x; }); }); return f; }

  /* =========================================================
     Check-in sheet: the gate's own page (Sherri's paper sheet, live).
     Tabs: Check in, Check out, Site jobs (repairs, deliveries, cleaning) and Reports.
     Paper days: print the sheets in black and white, mark them "on paper" and type them in later.
     ========================================================= */
  var GATE = { tab: 'in', day: TODAY, area: '', stand: '', show: 'todo', q: '', rfrom: add(TODAY, -6), rto: TODAY, rarea: '', rstand: '', rtime: '', jshow: 'open' };
  var AREA_ORDER = { fenced: 0, unfenced: 1, 'self-sufficient': 2 };
  function standSort(a, b) { var x = standById(a), y = standById(b); return (AREA_ORDER[x.area] - AREA_ORDER[y.area]) || String(x.name).localeCompare(String(y.name), undefined, { numeric: true }); }

  // A number plate in two parts, the way it is read off a car coming down the road: "LM" + "64 TG GP"
  function regParts(reg) {
    var r = String(reg || '').toUpperCase().replace(/\s+/g, ' ').trim(), m; if (!r) return ['', ''];
    m = r.match(/^(\S+)\s+(.+)$/); if (m) return [m[1], m[2]];
    m = r.match(/^([A-Z]+)(\d.*)$/) || r.match(/^(\d+)([A-Z].*)$/); return m ? [m[1], m[2]] : [r, ''];
  }
  function plate(reg, cls) { var p = regParts(reg); return p[0] ? '<span class="plate ' + (cls || '') + '"><b>' + esc(p[0]) + '</b>' + (p[1] ? '<i>' + esc(p[1]) + '</i>' : '') + '</span>' : '<span class="plate none ' + (cls || '') + '">No reg yet</span>'; }
  function regKey(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function nightsTxt(b) { var n = diff(b.ci, b.co); return n + (n === 1 ? ' night' : ' nights'); }
  /* ---------- earliest check-in, latest check-out, and the arrival time a guest picks ----------
     Staff set the two times under Settings > Check-in & Dinokeng. They are kept as website settings
     ("Check-in time" and "Check-out time", 24 hour HH:MM), so the website and the documents use them too. */
  function hm24(v) { var m = String(v == null ? '' : v).match(/^\s*(\d{1,2})\s*[:h.]\s*(\d{2})/); return m && +m[1] < 24 && +m[2] < 60 ? ('0' + m[1]).slice(-2) + ':' + m[2] : ''; }
  function campTime(label, biz, def) { var s = (DB && DB.web && DB.web.settings) || {}; return hm24(s[label]) || hm24(K.BIZ && K.BIZ[biz]) || def; }
  function checkInTime() { return campTime('Check-in time', 'checkIn', '13:00'); }
  function checkOutTime() { return campTime('Check-out time', 'checkOut', '11:30'); }
  // the arrival times to choose from: each hour from the earliest check-in to 18:00, then "After 18:00" and "Not sure yet" (the website offers the same)
  function etaChoices() { var t = checkInTime(), h = +t.slice(0, 2) + (t.slice(3) > '00' ? 1 : 0), out = []; for (; h <= 18; h++) out.push(('0' + h).slice(-2) + ':00'); return out.concat(['After 18:00', 'Not sure yet']); }
  // any arrival time, new ("14:00") or old ("Before 13:00", "13:00-15:00", "15:00-18:00"), as minutes after midnight so lists can be put in order; not given or not sure comes last
  function etaNum(v) { var s = String(v || ''), m = s.match(/(\d{1,2}):(\d{2})/); if (!m) return 9999; var n = +m[1] * 60 + +m[2]; return /^\s*before/i.test(s) ? n - 1 : /^\s*after/i.test(s) ? n + 1 : n; }
  function etaNice(v) { v = String(v || ''); return /^\d{1,2}:\d{2}$/.test(v) ? 'around ' + v : v.replace(/^(\d{1,2}:\d{2})\s*-\s*(\d{1,2}:\d{2})$/, '$1 to $2'); }
  function etaTxt(b) { return b.eta ? etaNice(b.eta) : ''; }

  /* ----- wood, ice and other shop items ordered with the booking: handed over at the gate, or delivered to the stand ----- */
  function orderOf(b) { var p = preShop(b); return p && p.items ? p.items : null; }
  function itemsTxt(items) { return Object.keys(items || {}).filter(function (k) { return items[k] > 0; }).map(function (k) { return items[k] + ' × ' + k; }).join(', '); }
  function drops(b) { b.drops = b.drops || []; return b.drops; }
  function orderLeft(b) {   // ordered, but not handed over and not planned for a day yet
    var it = orderOf(b), left = {}; if (!it) return null;
    Object.keys(it).forEach(function (k) { left[k] = it[k]; });
    drops(b).forEach(function (d) { Object.keys(d.items).forEach(function (k) { left[k] = (left[k] || 0) - d.items[k]; }); });
    Object.keys(left).forEach(function (k) { if (!(left[k] > 0)) delete left[k]; });
    return Object.keys(left).length ? left : null;
  }
  function stayDays(b) { var out = [], d = b.ci < TODAY ? TODAY : b.ci; for (; d < b.co; d = add(d, 1)) out.push(d); return out.length ? out : [b.ci]; }
  function orderState(b) {
    var it = orderOf(b); if (!it) return null;
    var left = orderLeft(b), todo = drops(b).filter(function (d) { return !d.done; }), paidFor = balance(b) <= 0;
    return { items: it, left: left, todo: todo, paid: paidFor, txt: itemsTxt(it),
      note: left ? 'still to hand over or plan' : todo.length ? 'to deliver: ' + todo.map(function (d) { return itemsTxt(d.items) + ' on ' + fdw(d.d); }).join('; ') : 'all handed over' };
  }
  function handHTML(b) {
    var left = orderLeft(b); if (!left) return '';
    var days = stayDays(b);
    return '<div class="hand-box" data-hand><b>' + ic('cart') + 'Ordered with the booking</b><p>' + esc(itemsTxt(left)) + ' <small>(' + (balance(b) <= 0 ? 'already paid' : 'on the bill, paid with the booking') + ')</small></p>' +
      '<span class="fld-l">Ask: do you want it now or later?</span><div class="seg wrap">' + [['now', 'Hand over now'], ['stand', 'Deliver to the stand'], ['spread', 'Some every day'], ['later', 'Decide later']].map(function (m, j) { return '<label><input type="radio" name="hand" value="' + m[0] + '"' + (j ? '' : ' checked') + '><span>' + m[1] + '</span></label>'; }).join('') + '</div>' +
      '<label class="fld" data-hand-day hidden><span>Deliver on</span><select name="handday">' + days.map(function (d) { return '<option value="' + d + '">' + (d === TODAY ? 'Today, ' : d === add(TODAY, 1) ? 'Tomorrow, ' : '') + fd(d, { weekday: 'long', day: 'numeric', month: 'short' }) + '</option>'; }).join('') + '</select></label>' +
      '<p class="muted small" data-hand-spread hidden>The order is split over the nights of the stay: today\'s part is handed over now, the rest goes on the site jobs list for each morning.</p></div>';
  }
  function handWire(f) {
    var box = $('[data-hand]', f); if (!box) return;
    var upd = function () { var v = ($('[name=hand]:checked', f) || {}).value; $('[data-hand-day]', f).hidden = v !== 'stand'; $('[data-hand-spread]', f).hidden = v !== 'spread'; };
    box.addEventListener('change', upd); upd();
  }
  function handRead(f, b) {
    var left = orderLeft(b), v = ($('[name=hand]:checked', f) || {}).value; if (!left || !v || v === 'later') return '';
    var now = { at: nowStamp(), by: ME.name };
    if (v === 'now') { drops(b).push({ id: uid('dr'), d: TODAY, items: left, how: 'gate', done: now }); return 'handed over at check-in: ' + itemsTxt(left); }
    if (v === 'stand') { var day = fval(f, 'handday') || TODAY; drops(b).push({ id: uid('dr'), d: day, items: left, how: 'stand', done: null }); return 'to be delivered to the stand on ' + fdw(day) + ': ' + itemsTxt(left); }
    // some every day: split each item over the nights that are left
    var days = stayDays(b), per = days.map(function () { return {}; });
    Object.keys(left).forEach(function (k) { for (var i = 0; i < left[k]; i++) { var slot = per[i % days.length]; slot[k] = (slot[k] || 0) + 1; } });
    per.forEach(function (it, i) { if (!Object.keys(it).length) return; drops(b).push({ id: uid('dr'), d: days[i], items: it, how: i ? 'stand' : 'gate', done: i ? null : now }); });
    return 'spread over the stay, a part each day: ' + itemsTxt(left);
  }

  /* ----- site jobs: repairs and other things reported at a stand ----- */
  function jobsDB() { DB.jobs = DB.jobs || []; return DB.jobs; }
  var JOB_KINDS = [['repair', 'Something is broken'], ['clean', 'Needs cleaning'], ['other', 'Something else']];
  function addJob(standId, text, o) { o = o || {}; var j = { id: uid('job'), stand: standId, kind: o.kind || 'repair', text: String(text).trim(), urgent: !!o.urgent, at: nowStamp(), by: ME.name, ref: o.ref || '', done: null }; jobsDB().unshift(j); siteLog(standId, 'Reported' + (j.urgent ? ' (urgent)' : '') + ': ' + j.text.slice(0, 120)); return j; }
  function issueField() { return '<label class="fld"><span>Anything wrong at the stand? (optional: it goes on the site jobs list)</span><input name="issue" placeholder="e.g. the toilet keeps flushing" autocomplete="off"></label>'; }
  function issueRead(f, b) { var t = fval(f, 'issue'); if (!t) return; addJob(b.stand, t, { ref: b.ref }); b.notes.push({ at: nowStamp(), by: ME.name, text: 'Reported at the stand: ' + t + ' (on the site jobs list).' }); }
  function actJob(standId, ref, id) {
    var j = id ? jobsDB().filter(function (x) { return x.id === id; })[0] : null, d = j || { stand: standId || '', kind: 'repair', text: '', urgent: false };
    modal(j ? 'Edit the job' : 'Report a problem at a stand',
      '<label class="fld"><span>Stand</span><select name="stand"><option value="">Choose the stand</option>' + STANDS.slice().sort(function (a, b) { return standSort(a.id, b.id); }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === d.stand ? ' selected' : '') + '>' + esc(s.name) + ' (' + AREA_SHORT[s.area] + ')</option>'; }).join('') + '<option value="camp"' + (d.stand === 'camp' ? ' selected' : '') + '>Somewhere else in camp (pool, lapa, road)</option></select></label>' +
      '<span class="fld-l">What is it?</span><div class="seg wrap">' + JOB_KINDS.map(function (k) { return '<label><input type="radio" name="kind" value="' + k[0] + '"' + (k[0] === d.kind ? ' checked' : '') + '><span>' + k[1] + '</span></label>'; }).join('') + '</div>' +
      '<label class="fld"><span>What needs to be done? Write it so a worker can fix it without asking</span><textarea name="text" rows="3" placeholder="e.g. The toilet keeps flushing. The water does not stop after the handle is pressed.">' + esc(d.text) + '</textarea></label>' +
      '<label class="check"><input type="checkbox" name="urgent"' + (d.urgent ? ' checked' : '') + '><span><b>Urgent:</b> do it today (no water, a leak, something unsafe)</span></label>' +
      '<p class="hint">' + ic('info') + ' The workers\' sheet shows only the stand and what to do. It never shows the guest\'s name or any money.</p>',
      j ? 'Save' : 'Add to the site jobs', function (f) {
        var st = fval(f, 'stand'), tx = fval(f, 'text'), kind = ($('[name=kind]:checked', f) || {}).value || 'repair';
        if (!st) { toast('Choose the stand'); return false; }
        if (!tx) { toast('Write what needs to be done'); return false; }
        if (j) { j.stand = st; j.kind = kind; j.text = tx; j.urgent = !!fval(f, 'urgent'); }
        else addJob(st, tx, { kind: kind, urgent: !!fval(f, 'urgent'), ref: ref || '' });
        if (j) siteLog(st, 'Job changed: ' + tx.slice(0, 120)); save(); render(); toast(j ? 'Saved' : 'Added to the site jobs list');
      });
  }
  // Notes left at a stand for the next person, and a log of every tick, note and report (who, when, which stand)
  function notesDB() { DB.standNotes = DB.standNotes || []; return DB.standNotes; }
  function standNotes(id) { return notesDB().filter(function (n) { return n.stand === id; }); }
  function siteLog(standId, text) {
    DB.siteLog = DB.siteLog || [];
    DB.siteLog.unshift({ at: nowStamp(), by: ME ? ME.name : 'System', role: ME ? ME.role : '', stand: standId, text: text });
    DB.siteLog = DB.siteLog.slice(0, 3000);
    log((standId === 'camp' ? 'Camp' : standById(standId).name) + ': ' + text);
  }
  // (not standOptions: that name is the stand list on the booking forms, with sizes and no "somewhere else in camp")
  function siteStandOptions(cur) { return '<option value="">Choose the stand</option>' + STANDS.slice().sort(function (a, b) { return standSort(a.id, b.id); }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === cur ? ' selected' : '') + '>' + esc(s.name) + ' (' + AREA_SHORT[s.area] + ')</option>'; }).join('') + '<option value="camp"' + (cur === 'camp' ? ' selected' : '') + '>Somewhere else in camp (pool, lapa, road)</option>'; }
  function actStandNote(standId) {
    modal('Add a note to a stand', '<label class="fld"><span>Stand</span><select name="stand">' + siteStandOptions(standId) + '</select></label>' +
      '<label class="fld"><span>Note for whoever works at this stand next</span><textarea name="text" rows="3" placeholder="e.g. Replaced the tap washer. The gate latch is stiff, it needs oil."></textarea></label>' +
      '<p class="hint">' + ic('info') + ' Everyone on the team can read stand notes. Your name and the time are saved with it. For something that must be fixed, use Report a problem instead, so it goes on the job list.</p>',
      'Save the note', function (f) {
        var st = fval(f, 'stand'), tx = fval(f, 'text');
        if (!st) { toast('Choose the stand'); return false; }
        if (!tx) { toast('Write the note first'); return false; }
        notesDB().unshift({ id: uid('sn'), stand: st, text: tx, at: nowStamp(), by: ME.name });
        siteLog(st, 'Note added: ' + tx.slice(0, 120)); save(); render(); toast('Note saved');
      }, { noFocus: !!standId });
  }
  function jobStand(j) { return j.stand === 'camp' ? { id: 'camp', name: 'Camp', area: 'camp' } : standById(j.stand); }
  // Everything the workers do on one day, per stand: cleaning, the free bag of wood, deliveries and repairs
  function siteDone(day, standId, what) { DB.siteDone = DB.siteDone || {}; return DB.siteDone[day + '|' + standId + '|' + what]; }
  function siteDay(day) {
    var rows = {}, row = function (id) { return rows[id] || (rows[id] = { id: id, stand: id === 'camp' ? { id: 'camp', name: 'Camp (pool, lapa, roads)', area: 'camp' } : standById(id), leave: false, arrive: false, stay: false, wood: 0, deliver: [], fix: [] }); };
    DB.bookings.forEach(function (b) {
      if (!live(b) || b.status === 'pending') return;
      if (b.co === day) row(b.stand).leave = true;
      if (b.ci <= day && day < b.co) { var r = row(b.stand); if (b.ci === day) r.arrive = true; else r.stay = true; if (standById(b.stand).area !== 'self-sufficient') r.wood = 1; }
      drops(b).forEach(function (d) { if (d.d === day && d.how === 'stand') row(b.stand).deliver.push({ b: b, d: d }); });
    });
    jobsDB().forEach(function (j) { if (j.at.slice(0, 10) > day) return; if (!j.done || j.done.at.slice(0, 10) === day) row(j.stand).fix.push(j); });
    return Object.keys(rows).map(function (id) {
      var r = rows[id];
      r.clean = r.leave ? (r.arrive ? 'Full clean first: new guests arrive today. Empty the braai and bins, sweep, check the ablution.' : 'Full clean after the guests leave: empty the braai and bins, sweep, check the ablution.') : r.arrive ? 'Check the stand is ready: guests arrive today.' : r.stay ? 'General clean: empty the braai and the bins.' : '';
      return r;
    }).sort(function (a, b) { return a.id === 'camp' ? 1 : b.id === 'camp' ? -1 : standSort(a.id, b.id); });
  }

  /* ----- who is on the sheet for a day ----- */
  function gateList(kind, day) {
    return DB.bookings.filter(function (b) {
      if (!live(b)) return false;
      if (kind === 'in') return b.ci === day || (day === TODAY && b.ci < day && b.co > day && b.status !== 'pending' && b.status !== 'out' && ensureCars(b).some(function (c) { return c.st === 'due' && !c.noShow; }));
      return (b.co === day && (b.status === 'in' || b.status === 'out')) || (day === TODAY && b.co < day && b.status === 'in');
    }).sort(function (a, b) { return standSort(a.stand, b.stand); });
  }
  function gateHit(b) {
    var st = standById(b.stand), q = GATE.q.trim().toLowerCase(), rq = regKey(GATE.q);
    if (GATE.area && st.area !== GATE.area) return false;
    if (GATE.stand && b.stand !== GATE.stand) return false;
    if (!q) return true;
    return (guestName(b) + ' ' + st.name + ' ' + b.ref).toLowerCase().indexOf(q) >= 0 || ensureCars(b).some(function (c) { return (rq && regKey(c.reg).indexOf(rq) >= 0) || (c.driver || '').toLowerCase().indexOf(q) >= 0 || (c.make || '').toLowerCase().indexOf(q) >= 0; });
  }
  function onPaper(b, kind) { return !!(b.paper && b.paper[kind] && !b.paper[kind].done); }
  function gateDone(b, kind) { var cs = ensureCars(b); return kind === 'in' ? !cs.some(function (c) { return c.st === 'due' && !c.noShow; }) : b.status === 'out'; }
  function payBadge(b) {
    var bal = balance(b);
    if (b.status === 'pending') return '<span class="gate-pay owes">NOT PAID<small>' + (b.noRelease ? 'stand kept for the guest, ' : 'quotation only, ') + money(b.total) + '</small></span>';
    if (bal <= 0) return '<span class="gate-pay ok">PAID</span>';
    return '<span class="gate-pay owes">OWES ' + money(bal) + (b.onArrival ? '<small>pays on arrival, ' + esc(b.onArrival.how.toLowerCase()) + '</small>' : '') + '</span>';
  }
  function gateCard(b, kind) {
    var st = standById(b.stand), cs = ensureCars(b), day = GATE.day, canIn = (b.status === 'confirmed' || b.status === 'in') && b.ci <= TODAY && TODAY <= b.co, done = gateDone(b, kind), paper = onPaper(b, kind);
    var os = orderState(b), late = kind === 'in' ? b.ci < day : b.co < day;
    var cars = cs.map(function (c, i) {
      var k = b.ref + '|' + c.id, t = carTab(b, c), ind = c.ind || carSigned(b, c), act = '';
      if (kind === 'in') {
        if (c.st === 'due' && c.noShow && !canIn) act = '<span class="pill muted">Did not come</span>';
        else if (c.st === 'due') act = (c.noShow ? '<span class="pill muted">Did not come</span> ' : '') + (paper && !c.noShow ? '<span class="pill info">' + ic('clip') + 'On paper</span>' : b.status === 'pending' ? '<span class="pill bad">Not paid yet</span>' : canIn ? '<button type="button" class="btn green" data-act="car-in" data-ref="' + k + '">' + ic('in') + 'Check in</button>' : '<span class="pill muted">Arrives ' + fdw(b.ci) + '</span>');
        else act = '<span class="pill ok">' + ic('check') + (c.st === 'in' ? 'In since ' : 'Came ') + whenShort(c.inAt) + '</span>';
      } else {
        if (c.st === 'in') act = paper ? '<span class="pill info">' + ic('clip') + 'On paper</span>' : '<button type="button" class="btn green" data-act="car-out" data-ref="' + k + '">' + ic('out') + 'Check out</button>';
        else if (c.st === 'out') act = '<span class="pill muted">' + ic('check') + 'Left ' + whenShort(c.outAt) + '</span>';
        else act = '<span class="pill muted">Never arrived</span>';
      }
      var tbc = !vehKnown(b) && !carGiven(b, c);   // vehicles not given yet: this is the one empty car that waits for check-in
      return '<div class="gate-car">' + plate(c.reg, 'big') + '<div class="gate-veh"><b>' + esc(tbc ? 'Vehicles: not given yet' : c.make || (c.reg ? 'Vehicle ' + (i + 1) : 'Vehicle ' + (i + 1) + ': ask for the registration')) + '</b><small>' + esc(tbc ? 'Ask how many vehicles came, and add each one at check-in' : [c.driver ? 'Driver ' + c.driver : '', c.people ? c.people + (c.people === 1 ? ' person' : ' people') : ''].filter(Boolean).join(' · ') || 'Driver and passengers are added at check-in') + '</small><span class="gate-pills">' +
        (kind === 'in' ? (ind ? '<span class="pill ok">' + ic('check') + 'Indemnity signed</span>' : '<span class="pill warn">' + ic('alert') + 'Indemnity to sign</span>') : '') +
        (t.total ? '<span class="pill ' + (t.owing ? 'warn' : 'ok') + '">Shop tab ' + money(t.total) + (t.owing ? ', ' + money(t.owing) + ' to pay' : ', paid') + '</span>' : '') + '</span></div><div class="gate-act">' + act + '</div></div>';
    }).join('');
    var tabOw = cs.reduce(function (a, c) { return a + carTab(b, c).owing; }, 0);
    var foot = [];
    if (os) foot.push('<span class="gate-order' + (os.left || os.todo.length ? ' todo' : '') + '">' + ic('cart') + '<span><b>Ordered: ' + esc(os.txt) + '</b><small>' + (os.paid ? 'Paid' : 'On the bill') + ' · ' + esc(os.note) + '</small></span></span>');
    if (kind === 'out' && (balance(b) > 0)) foot.push('<span class="gate-order todo">' + ic('alert') + '<span><b>Still to pay before they leave: ' + money(balance(b)) + '</b><small>' + (tabOw ? 'includes ' + money(tabOw) + ' on the shop tab' : 'booking balance') + '</small></span></span>');
    if (b.gateNote) foot.unshift('<span class="gate-order note">' + ic('note') + '<span><b>' + esc(b.gateNote) + '</b><small>Note for the gate</small></span></span>');
    var jobsOpen = jobsDB().filter(function (j) { return j.stand === b.stand && !j.done; });
    if (jobsOpen.length) foot.push('<span class="gate-order">' + ic('alert') + '<span><b>' + jobsOpen.length + ' open job' + (jobsOpen.length === 1 ? '' : 's') + ' at this stand</b><small>' + esc(jobsOpen.map(function (j) { return j.text; }).join('; ').slice(0, 120)) + '</small></span></span>');
    return '<article class="gate-card' + (done ? ' done' : '') + (late && !done ? ' late' : '') + '"><header><span class="gate-st"><b>' + esc(st.name) + '</b><small>' + AREA_SHORT[st.area] + '</small></span>' +
      '<div class="gate-who"><b>' + esc(guestName(b)) + '</b><small>' + peopleTxt(b) + ' · ' + fdw(b.ci) + ' to ' + fdw(b.co) + ' (' + nightsTxt(b) + ')' + (kind === 'in' && b.eta ? ' · ' + esc(etaTxt(b)) : '') + (late && !done ? ' · <b class="bad-t">' + (kind === 'in' ? 'was due ' + fdw(b.ci) : 'should have left ' + fdw(b.co)) + '</b>' : '') + '</small></div>' +
      payBadge(b) + '<button type="button" class="icon-btn" data-open="' + b.ref + '" aria-label="Open the booking" title="Open the booking">' + ic('chev-r') + '</button></header>' +
      '<div class="gate-cars">' + cars + '</div>' +
      '<footer>' + foot.join('') + '<span class="gate-foot-acts">' + (kind === 'out' && balance(b) > 0 && b.status !== 'pending' ? '<button type="button" class="btn ghost sm" data-act="pay" data-ref="' + b.ref + '">' + ic('card') + 'Take payment</button>' : '') +
      '<button type="button" class="btn ghost sm" data-act="gate-note" data-ref="' + b.ref + '">' + ic('note') + (b.gateNote ? 'Change the note' : 'Add a note') + '</button>' +
      '<button type="button" class="btn ghost sm" data-act="gate-job" data-ref="' + b.stand + '|' + b.ref + '">' + ic('alert') + 'Report a problem</button></span></footer></article>';
  }
  function paperSheets() {   // paper sheets that still have to be typed in
    var map = {};
    DB.bookings.forEach(function (b) {
      ['in', 'out'].forEach(function (kind) {
        if (!onPaper(b, kind) || !live(b)) return;
        var n = ensureCars(b).filter(function (c) { return kind === 'in' ? c.st === 'due' && !c.noShow : c.st === 'in'; }).length;
        if (!n) { b.paper[kind].done = true; return; }
        var k = kind + '|' + b.paper[kind].d; map[k] = map[k] || { kind: kind, d: b.paper[kind].d, n: 0, list: [] }; map[k].n += n; map[k].list.push(b);
      });
    });
    return Object.keys(map).sort().map(function (k) { return map[k]; });
  }
  function gateBadge() { return gateList('in', TODAY).reduce(function (a, b) { return a + (b.status === 'pending' ? 0 : ensureCars(b).filter(function (c) { return c.st === 'due' && !c.noShow; }).length); }, 0); }

  function vSite() { return vGate(true); }   // the workers' page: the site jobs and nothing else
  function vGate(siteOnly) {
    if (!GATE.day) GATE.day = TODAY;
    var tab = siteOnly ? 'jobs' : GATE.tab;
    var tabs = [['in', 'Check in'], ['out', 'Check out'], ['jobs', 'Site jobs'], ['reports', 'Reports']], body = '', day = GATE.day;
    var dayBar = function () {
      return '<div class="gate-days"><button type="button" class="icon-btn" data-gateday="-1" aria-label="The day before">' + ic('chev-l') + '</button>' +
        [[TODAY, 'Today'], [add(TODAY, 1), 'Tomorrow']].map(function (d) { return '<button type="button" class="chip' + (day === d[0] ? ' on' : '') + '" data-gateday="' + d[0] + '">' + d[1] + '</button>'; }).join('') +
        '<label class="fdate gate-date"><span class="sr">Day</span><input type="date" data-fk="GATE:day" value="' + day + '"' + (day !== TODAY && day !== add(TODAY, 1) ? ' class="on"' : '') + '></label>' +
        '<button type="button" class="icon-btn" data-gateday="1" aria-label="The day after">' + ic('chev-r') + '</button><b class="gate-dayname">' + fd(day, { weekday: 'long', day: 'numeric', month: 'long' }) + '</b></div>';
    };
    var areaBar = function (count) {
      return '<div class="chips gate-areas">' + [['', 'All areas']].concat(Object.keys(AREA_SHORT).map(function (a) { return [a, AREA_SHORT[a]]; })).map(function (a) { var n = count(a[0]); return '<button type="button" class="chip' + (GATE.area === a[0] ? ' on' : '') + '" data-gatearea="' + a[0] + '">' + a[1] + ' <span>' + n + '</span></button>'; }).join('') +
        fsel('GATE:stand', GATE.stand, [['', 'All stands']].concat(STANDS.filter(function (x) { return !GATE.area || x.area === GATE.area; }).sort(function (a, b) { return standSort(a.id, b.id); }).map(function (x) { return [x.id, x.name]; }))) + '</div>';
    };
    if (tab === 'in' || tab === 'out') {
      var kind = tab, all = gateList(kind, day), list = all.filter(gateHit), shown = list.filter(function (b) { return GATE.show === 'all' || (GATE.show === 'done') === gateDone(b, kind); });
      var cars = function (l, st) { return l.reduce(function (a, b) { return a + ensureCars(b).filter(function (c) { return !st || c.st === st; }).length; }, 0); };
      var todo = all.filter(function (b) { return !gateDone(b, kind); }), owe = all.filter(function (b) { return balance(b) > 0 && b.status !== 'out'; });
      var unk = all.filter(function (b) { return !vehKnown(b); }).length, unkTxt = unk ? ' (' + unk + ' not given yet, counted as 1)' : '';
      var sheets = paperSheets();
      body = (sheets.length ? sheets.map(function (s) { return '<div class="callout info cflex gate-paper">' + ic('clip') + '<span><b>Paper ' + (s.kind === 'in' ? 'check-in' : 'check-out') + ' sheet for ' + fd(s.d, { weekday: 'long', day: 'numeric', month: 'long' }) + '</b>: ' + s.n + ' vehicle' + (s.n === 1 ? '' : 's') + ' still to type in. No reminders are shown for them until you do.</span><button type="button" class="btn sm" data-act="gate-paper" data-ref="' + s.kind + '|' + s.d + '">' + ic('edit') + 'Type it in</button></div>'; }).join('') : '') +
        '<div class="kpis gate-kpis">' + (kind === 'in'
          ? tile('Arriving', all.length + '<small> ' + (all.length === 1 ? 'party' : 'parties') + '</small>', cars(all) + ' vehicle' + (cars(all) === 1 ? '' : 's') + unkTxt + ', ' + all.reduce(function (a, b) { return a + people(b); }, 0) + ' people') + tile('Checked in', cars(all, 'in') + cars(all, 'out'), 'vehicles through the gate', null, 'ok') + tile('Still to come', cars(all, 'due'), todo.length + (todo.length === 1 ? ' party' : ' parties'), null, cars(all, 'due') ? 'warn' : '') + tile('Money to collect', money(owe.reduce(function (a, b) { return a + balance(b); }, 0)), owe.length + ' booking' + (owe.length === 1 ? '' : 's') + ' owing', null, owe.length ? 'warn' : '')
          : tile('Leaving', all.length + '<small> ' + (all.length === 1 ? 'party' : 'parties') + '</small>', cars(all) + ' vehicle' + (cars(all) === 1 ? '' : 's')) + tile('Checked out', all.filter(function (b) { return b.status === 'out'; }).length, 'parties gone', null, 'ok') + tile('Still in camp', todo.length, 'to check out', null, todo.length ? 'warn' : '') + tile('Tabs to settle', money(owe.reduce(function (a, b) { return a + balance(b); }, 0)), owe.length + ' booking' + (owe.length === 1 ? '' : 's') + ' still owing', null, owe.length ? 'bad' : '')) + '</div>' +
        '<div class="filters gate-filters">' + fsearch('GATE:q', GATE.q, 'Type the plate you see, a name or a stand') +
        '<div class="rp-tabs gate-show">' + [['todo', kind === 'in' ? 'Still to come' : 'Still to leave'], ['done', kind === 'in' ? 'Checked in' : 'Checked out'], ['all', 'Everyone']].map(function (x) { return '<button type="button" class="' + (GATE.show === x[0] ? 'on' : '') + '" data-gateshow="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div></div>' +
        areaBar(function (a) { return all.filter(function (b) { return !a || standById(b.stand).area === a; }).length; }) +
        (shown.length ? '<div class="gate-list">' + shown.map(function (b) { return gateCard(b, kind); }).join('') + '</div>'
          : '<p class="empty gate-empty">' + (!all.length ? 'Nobody ' + (kind === 'in' ? 'arrives' : 'leaves') + ' on ' + fd(day, { weekday: 'long', day: 'numeric', month: 'long' }) + '.' : !list.length ? 'Nobody matches. Clear the search or pick All areas.' : GATE.show === 'todo' ? (kind === 'in' ? 'Everyone has checked in. Well done!' : 'Everyone has checked out.') : 'Nothing here yet.') + '</p>');
    }
    if (tab === 'jobs') {
      var rows = siteDay(day).filter(function (r) { return (!GATE.area || r.stand.area === GATE.area) && (!GATE.stand || r.id === GATE.stand); });
      // one job: a big tick box, what to do, and a button. Ticking it is written to the work log.
      var line = function (done, label, act, ref, word, more) {
        return '<div class="site-line' + (done ? ' done' : '') + '"><button type="button" class="site-tick" data-act="' + act + '" data-ref="' + esc(ref) + '" aria-label="' + (done ? 'Untick: not done yet' : 'Tick: done') + '">' + (done ? ic('check') : '') + '</button><div>' + label +
          (done ? '<small>Done ' + whenShort(done.at) + ' by ' + esc(done.by) + (done.note ? ': ' + esc(done.note) : '') + '</small>' : '') + '</div>' + (more || '') +
          '<button type="button" class="btn ' + (done ? 'ghost' : 'green') + ' sm" data-act="' + act + '" data-ref="' + esc(ref) + '">' + (done ? 'Undo' : word) + '</button></div>';
      };
      var noteLine = function (n, withStand) {
        return '<p class="site-note">' + (withStand ? '<b class="site-note-st">' + esc(n.stand === 'camp' ? 'Camp' : standById(n.stand).name) + '</b>' : '') + '<span>' + esc(n.text) + '</span><small>' + esc(n.by) + ' · ' + esc(atNice(n.at)) + '</small>' +
          (n.by === ME.name || ME.role === 'Owner' || ME.role === 'Manager' ? '<button type="button" class="icon-btn sm" data-act="stand-note-del" data-ref="' + n.id + '" aria-label="Remove this note" title="Remove this note">' + ic('x') + '</button>' : '') + '</p>';
      };
      var nOpen = 0, shownIds = {};
      var cardsHtml = rows.map(function (r) {
        var lines = [], open = 0;
        if (r.clean) { var dc = siteDone(day, r.id, 'clean'); if (!dc) open++; lines.push(line(dc, '<b>Clean</b> ' + esc(r.clean), 'site-done', day + '|' + r.id + '|clean', 'Done')); }
        if (r.wood) { var dw = siteDone(day, r.id, 'wood'); if (!dw) open++; lines.push(line(dw, '<b>Free wood</b> 1 bag of firewood for tonight', 'site-done', day + '|' + r.id + '|wood', 'Done')); }
        r.deliver.forEach(function (x) { if (!x.d.done) open++; lines.push(line(x.d.done, '<b>Deliver</b> ' + esc(itemsTxt(x.d.items)), 'drop-done', x.b.ref + '|' + x.d.id, 'Delivered')); });
        r.fix.forEach(function (j) {
          if (!j.done) open++;
          lines.push(line(j.done, '<b>' + (j.kind === 'clean' ? 'Clean' : j.kind === 'other' ? 'Do' : 'Fix') + (j.urgent && !j.done ? ' <span class="pill bad">Urgent</span>' : '') + '</b> ' + esc(j.text) + '<small>Reported ' + atNice(j.at) + ' by ' + esc(j.by) + '</small>', 'job-done', j.id, j.kind === 'repair' ? 'Fixed' : 'Done',
            siteOnly ? '' : '<button type="button" class="icon-btn sm" data-act="job-edit" data-ref="' + j.id + '" aria-label="Edit" title="Edit">' + ic('edit') + '</button>'));
        });
        nOpen += open; shownIds[r.id] = 1;
        var notes = standNotes(r.id);
        return { open: open > 0, html: '<article class="site-card"><header><span class="gate-st"><b>' + esc(r.stand.name) + '</b><small>' + (AREA_SHORT[r.stand.area] || '') + '</small></span><span class="muted small">' + [r.leave ? 'guests leave today' : '', r.arrive ? 'guests arrive today' : '', r.stay ? 'guests staying' : ''].filter(Boolean).join(' · ') + '</span></header>' + lines.join('') +
          (notes.length ? '<div class="site-notes"><b>' + ic('note') + 'Notes for this stand</b>' + notes.slice(0, 3).map(function (n) { return noteLine(n); }).join('') + (notes.length > 3 ? '<details><summary>' + (notes.length - 3) + ' older note' + (notes.length - 3 === 1 ? '' : 's') + '</summary>' + notes.slice(3).map(function (n) { return noteLine(n); }).join('') + '</details>' : '') + '</div>' : '') +
          '<div class="site-acts"><button type="button" class="btn ghost sm" data-act="stand-note" data-ref="' + r.id + '">' + ic('note') + 'Add a note</button><button type="button" class="btn ghost sm" data-act="gate-job" data-ref="' + r.id + '|">' + ic('alert') + 'Report a problem</button></div></article>' };
      }).filter(function (c) { return GATE.jshow === 'all' || c.open; });
      var openJobs = jobsDB().filter(function (j) { return !j.done; });
      var otherNotes = notesDB().filter(function (n) { return !shownIds[n.stand] || GATE.jshow !== 'all'; }).slice(0, 8);
      var wl = (DB.siteLog || []).filter(function (l) { return l.at.slice(0, 10) === day; });
      body = '<div class="kpis gate-kpis">' + tile('Stands to look after', rows.length, 'on ' + fd(day, { weekday: 'long', day: 'numeric', month: 'short' })) + tile('Still to do', nOpen, 'cleaning, wood, deliveries, repairs', null, nOpen ? 'warn' : 'ok') + tile('Open repairs', openJobs.filter(function (j) { return j.kind === 'repair'; }).length, openJobs.filter(function (j) { return j.urgent; }).length + ' urgent', null, openJobs.some(function (j) { return j.urgent; }) ? 'bad' : '') + '</div>' +
        '<div class="filters gate-filters"><div class="rp-tabs gate-show">' + [['open', 'Still to do'], ['all', 'Everything']].map(function (x) { return '<button type="button" class="' + (GATE.jshow === x[0] ? 'on' : '') + '" data-gatejshow="' + x[0] + '">' + x[1] + '</button>'; }).join('') + '</div><button type="button" class="btn ghost" data-act="stand-note" data-ref="">' + ic('note') + 'Add a note to a stand</button><button type="button" class="btn" data-act="gate-job" data-ref="|">' + ic('plus') + 'Report a problem</button></div>' +
        areaBar(function (a) { return siteDay(day).filter(function (r) { return !a || r.stand.area === a; }).length; }) +
        (cardsHtml.length ? '<div class="gate-list">' + cardsHtml.map(function (c) { return c.html; }).join('') + '</div>' : '<p class="empty gate-empty">' + (rows.length ? 'Everything is done for this day. Well done!' : 'No stands to look after on this day.') + '</p>') +
        '<div class="cols site-extra"><section class="card"><header class="card-h"><h3>Latest notes from the stands</h3><span class="count">' + notesDB().length + '</span></header>' + (otherNotes.length ? otherNotes.map(function (n) { return noteLine(n, true); }).join('') : '<p class="empty">No notes yet. Use "Add a note" on a stand to leave one for the next person.</p>') + '</section>' +
        '<section class="card"><header class="card-h"><h3>Work log for ' + fd(day, { weekday: 'long', day: 'numeric', month: 'short' }) + '</h3>' + (siteOnly ? '<span class="count">' + wl.length + '</span>' : '<button type="button" class="btn ghost sm" data-act="site-log-csv">' + ic('download') + 'Export</button>') + '</header>' +
        (wl.length ? '<ul class="feed site-log">' + wl.slice(0, 40).map(function (l) { return '<li><span><b>' + esc(l.stand === 'camp' ? 'Camp' : standById(l.stand).name) + '</b> ' + esc(l.text) + '</span><small>' + esc(l.by) + ' · ' + esc(l.at.slice(11, 16)) + '</small></li>'; }).join('') + '</ul>' : '<p class="empty">Nothing ticked off yet on this day. Every tick, note and report is written here with the name and the time.</p>') + '</section></div>' +
        (siteOnly ? '' : '<p class="hint">' + ic('info') + ' This list makes itself: a full clean where guests leave, a general clean where they stay, one free bag of wood for every ablution stand, the wood and ice guests asked to have delivered, and every problem that was reported. Workers sign in with the Worker role and see only this list: never names, phone numbers or money.</p>');
    }
    if (tab === 'reports') body = gateReport();
    var printBtn = tab === 'reports' ? '<button type="button" class="btn ghost" data-act="gate-csv">' + ic('download') + 'Export</button><button type="button" class="btn" data-act="gate-print" data-ref="report">' + ic('note') + 'Print the report</button>'
      : '<button type="button" class="btn" data-act="gate-print" data-ref="' + tab + '">' + ic('note') + (tab === 'jobs' ? 'Print the workers\' sheet' : tab === 'in' ? 'Print the check-in sheet' : 'Print the check-out sheet') + '</button>';
    if (siteOnly) return '<div class="page-h"><div><h1>Site jobs</h1><p class="muted">The jobs at each stand for the day. Tick each one when it is done.</p></div></div>' + dayBar() + body;
    return '<div class="page-h"><div><h1>Check-in sheet</h1><p class="muted">Everyone arriving and leaving, the wood and ice to hand out, and the jobs around camp, for one day at a time.</p></div><div class="ph-act">' + printBtn + '</div></div>' +
      '<div class="rp-tabs page-tabs gate-tabs">' + tabs.map(function (t) { var n = t[0] === 'in' ? gateList('in', day).filter(function (b) { return !gateDone(b, 'in'); }).length : t[0] === 'out' ? gateList('out', day).filter(function (b) { return !gateDone(b, 'out'); }).length : 0; return '<button class="' + (tab === t[0] ? 'on' : '') + '" data-gatetab="' + t[0] + '">' + t[1] + (n ? ' <span class="tab-n">' + n + '</span>' : '') + '</button>'; }).join('') + '</div>' +
      (tab === 'reports' ? '' : dayBar()) + body;
  }

  /* ----- reports: who came and went, by day, time, area and stand ----- */
  var RTIMES = [['', 'Any time of day'], ['am', 'Before 12:00'], ['mid', '12:00 to 15:00'], ['pm', '15:00 to 18:00'], ['eve', 'After 18:00']];
  function timeBand(t) { var h = +String(t || '').slice(0, 2); return !t ? '' : h < 12 ? 'am' : h < 15 ? 'mid' : h < 18 ? 'pm' : 'eve'; }
  function gateMoves() {
    var out = [];
    DB.bookings.forEach(function (b) {
      if (!live(b) || !b.cars) return; var st = standById(b.stand);
      if ((GATE.rarea && st.area !== GATE.rarea) || (GATE.rstand && b.stand !== GATE.rstand)) return;
      b.cars.forEach(function (c, i) {
        if (!c.inAt) return; var d = c.inAt.slice(0, 10), t = c.inAt.slice(11, 16);
        if (d < GATE.rfrom || d > GATE.rto) return;
        if (GATE.rtime && timeBand(t) !== GATE.rtime) return;
        out.push({ b: b, c: c, i: i, st: st, d: d, t: t, outD: c.outAt ? c.outAt.slice(0, 10) : '', outT: c.outAt ? c.outAt.slice(11, 16) : '' });
      });
    });
    return out.sort(function (a, b) { return (a.d + a.t) < (b.d + b.t) ? 1 : -1; });
  }
  function gateReport() {
    if (!GATE.rfrom) GATE.rfrom = add(TODAY, -6); if (!GATE.rto) GATE.rto = TODAY;
    var mv = gateMoves(), ppl = mv.reduce(function (a, m) { return a + (m.c.people || 0); }, 0), parties = {}, bands = {}, byArea = {};
    mv.forEach(function (m) { parties[m.b.ref] = 1; bands[timeBand(m.t)] = (bands[timeBand(m.t)] || 0) + 1; byArea[m.st.area] = (byArea[m.st.area] || 0) + 1; });
    var busiest = RTIMES.slice(1).sort(function (a, b) { return (bands[b[0]] || 0) - (bands[a[0]] || 0); })[0];
    return '<div class="filters gate-filters"><span class="frange"><label class="fdate"><span>Checked in from</span><input type="date" data-fk="GATE:rfrom" value="' + GATE.rfrom + '" class="on"></label><label class="fdate"><span>to</span><input type="date" data-fk="GATE:rto" value="' + GATE.rto + '" class="on"></label></span>' +
      fsel('GATE:rtime', GATE.rtime, RTIMES) + fsel('GATE:rarea', GATE.rarea, [['', 'All areas']].concat(Object.keys(AREA_SHORT).map(function (a) { return [a, AREA_SHORT[a]]; }))) +
      fsel('GATE:rstand', GATE.rstand, [['', 'All stands']].concat(STANDS.filter(function (x) { return !GATE.rarea || x.area === GATE.rarea; }).sort(function (a, b) { return standSort(a.id, b.id); }).map(function (x) { return [x.id, x.name]; }))) +
      '<span class="gate-quick">' + [['Today', TODAY, TODAY], ['Last 7 days', add(TODAY, -6), TODAY], ['Last 30 days', add(TODAY, -29), TODAY], ['This month', TODAY.slice(0, 8) + '01', TODAY]].map(function (q) { return '<button type="button" class="chip' + (GATE.rfrom === q[1] && GATE.rto === q[2] ? ' on' : '') + '" data-gaterange="' + q[1] + '|' + q[2] + '">' + q[0] + '</button>'; }).join('') + '</span></div>' +
      '<div class="kpis gate-kpis">' + tile('Vehicles checked in', mv.length, Object.keys(parties).length + ' bookings') + tile('People', ppl, 'through the gate') + tile('Busiest time', mv.length ? busiest[1] : 'None', mv.length ? (bands[busiest[0]] || 0) + ' of ' + mv.length + ' arrivals' : 'no arrivals in this period') + tile('By area', Object.keys(AREA_SHORT).map(function (a) { return byArea[a] || 0; }).join(' / '), Object.keys(AREA_SHORT).map(function (a) { return AREA_SHORT[a]; }).join(' / ')) + '</div>' +
      '<div class="card flush"><table class="tbl" data-sort-key="rep"><thead><tr><th>Checked in</th><th>Stand</th><th>Guest</th><th>Vehicle</th><th class="r">People</th><th>Checked out</th><th>By</th></tr></thead><tbody>' +
      (mv.length ? mv.map(function (m) { return '<tr data-open="' + m.b.ref + '" tabindex="0"><td data-l="Checked in" data-s="' + m.d + m.t + '"><b>' + fdw(m.d) + '</b> ' + m.t + '</td><td data-l="Stand">' + esc(m.st.name) + '<small>' + AREA_SHORT[m.st.area] + '</small></td><td data-l="Guest">' + esc(guestName(m.b)) + '<small>' + esc(m.c.driver && m.c.driver !== guestName(m.b) ? 'Driver ' + m.c.driver : m.b.ref) + '</small></td><td data-l="Vehicle">' + plate(m.c.reg) + (m.c.make ? '<small>' + esc(m.c.make) + '</small>' : '') + '</td><td data-l="People" class="r">' + (m.c.people || '') + '</td><td data-l="Checked out">' + (m.outD ? fdw(m.outD) + ' ' + m.outT : '<span class="pill ok"><i></i>In camp</span>') + '</td><td data-l="By">' + esc(m.c.inBy || 'Front desk') + '</td></tr>'; }).join('') : '<tr><td colspan="7" class="empty">No check-ins in this period.</td></tr>') + '</tbody></table></div>';
  }

  /* ----- black and white printouts: columns, big boxes to write in ----- */
  var PRINT_CSS = '@page{size:A4 landscape;margin:9mm}*{box-sizing:border-box}body{font:11.5px/1.3 Arial,Helvetica,sans-serif;color:#000;margin:0}h1{font-size:19px;margin:0}.top{display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2.5px solid #000;padding-bottom:5px;margin-bottom:7px}.top small{font-size:11px}' +
    'table{width:100%;border-collapse:collapse;table-layout:fixed}th,td{border:1px solid #000;padding:3px 5px;vertical-align:top;text-align:left;word-wrap:break-word}th{font-size:10px;text-transform:uppercase;letter-spacing:.04em;border-bottom:2.5px solid #000;background:#fff}tbody tr{page-break-inside:avoid}td{height:15mm}' +
    'tr.area td{height:auto;font-weight:bold;font-size:12.5px;border:0;border-bottom:2.5px solid #000;padding:9px 0 3px;text-transform:uppercase;letter-spacing:.05em}td.st{font-weight:bold;font-size:13px;word-wrap:normal;overflow-wrap:normal;hyphens:none}td.big{font-size:17px;font-weight:bold;letter-spacing:.03em;text-align:center;vertical-align:middle}td.reg2{font-size:14px;text-align:center;vertical-align:middle}' +
    '.b{font-weight:bold}.s{font-size:10px}.box{display:inline-block;width:11px;height:11px;border:1.5px solid #000;vertical-align:-2px;margin-right:3px}.w{display:inline-block;border-bottom:1px solid #000;min-width:22mm;height:11px}.owes{font-weight:bold;font-size:13px;border:2px solid #000;padding:1px 4px;display:inline-block}.foot{margin-top:7px;font-size:10px;display:flex;justify-content:space-between}thead{display:table-header-group}.newparty td{border-top:2.5px solid #000}';
  function printDoc(title, sub, tableHtml, foot) {
    var w = window.open('', '_blank'); if (!w) { toast('Allow pop-ups to print the sheet'); return false; }
    w.document.write('<!doctype html><html><head><meta charset="utf-8"><title>' + esc(title) + '</title><style>' + PRINT_CSS + '</style></head><body><div class="top"><h1>Kyleu Bush Camp: ' + esc(title) + '</h1><small>' + sub + ' · printed ' + nowStamp().slice(11) + ' by ' + esc(ME.name) + '</small></div>' + tableHtml +
      '<div class="foot"><span>' + (foot || '') + '</span><span>Kyleu Bush Camp</span></div><script>window.onload=function(){setTimeout(function(){window.print()},200)}<\/script></body></html>');
    w.document.close(); return true;
  }
  var BOX = '<span class="box"></span>';
  function gatePrint(what) {
    var day = GATE.day, dayTxt = fd(day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }), areaOf = function (b) { return standById(b.stand).area; }, lastArea = null, html = '';
    var areaRow = function (a, cols) { if (a === lastArea) return ''; lastArea = a; return '<tr class="area"><td colspan="' + cols + '">' + esc(a === 'camp' ? 'Around camp' : (K.AREA[a] || {}).name || AREA_SHORT[a] || a) + '</td></tr>'; };
    if (what === 'in' || what === 'out') {
      var kind = what, list = gateList(kind, day).filter(gateHit), n = 0;
      if (kind === 'in') {
        html = '<table><colgroup><col style="width:9%"><col style="width:14%"><col style="width:6%"><col style="width:9%"><col style="width:9%"><col style="width:6%"><col style="width:9%"><col style="width:8%"><col style="width:13%"><col style="width:6%"><col style="width:11%"></colgroup><thead><tr><th>Stand</th><th>Name</th><th>People</th><th>Paid?</th><th>Vehicle</th><th colspan="2">Registration</th><th>Indemnity</th><th>Wood, ice, shop</th><th>Time in</th><th>Notes and problems</th></tr></thead><tbody>';
        list.forEach(function (b) {
          var cs = ensureCars(b), os = orderState(b), bal = balance(b), st = standById(b.stand);
          html += areaRow(areaOf(b), 11);
          cs.forEach(function (c, i) {
            var p = regParts(c.reg), ind = c.ind || carSigned(b, c); n++;
            html += '<tr' + (i ? '' : ' class="newparty"') + '>' + (i ? '' : '<td class="st" rowspan="' + cs.length + '">' + esc(st.name) + '</td><td rowspan="' + cs.length + '"><span class="b">' + esc(guestName(b)) + '</span><br><span class="s">' + fdw(b.ci) + ' to ' + fdw(b.co) + (b.eta ? '<br>' + esc(etaTxt(b)) : '') + '<br>' + esc(b.guest.phone || '') + '</span></td>' +
              '<td rowspan="' + cs.length + '"><span class="b">' + people(b) + '</span> booked<br><span class="s">came:</span> <span class="w" style="min-width:8mm"></span></td>' +
              '<td rowspan="' + cs.length + '">' + (b.status === 'pending' ? '<span class="owes">NOT PAID</span><br><span class="s">' + money(b.total) + '</span>' : bal > 0 ? '<span class="owes">OWES ' + money(bal) + '</span><br><span class="s">' + BOX + 'paid: cash / card</span>' : '<span class="b">PAID</span>') + '</td>') +
              '<td>' + (!vehKnown(b) && !carGiven(b, c) ? '<span class="s">Not given yet. Write in each vehicle that comes.</span>' : esc(c.make || '') + (c.driver && c.driver !== guestName(b) ? '<br><span class="s">' + esc(c.driver) + '</span>' : '')) + '</td><td class="big">' + esc(p[0]) + '</td><td class="reg2">' + esc(p[1]) + '</td>' +
              '<td class="s">' + (ind ? '<span class="b">Signed</span>' : BOX + 'signed on paper') + '</td>' +
              (i ? '' : '<td class="s" rowspan="' + cs.length + '">' + (os && (os.left || os.todo.length) ? '<span class="b">' + esc(itemsTxt(os.left || os.items)) + '</span><br>' + BOX + 'given now<br>' + BOX + 'deliver on: <span class="w" style="min-width:12mm"></span>' : os ? esc(os.txt) + '<br>handed over' : 'ICE: <span class="w" style="min-width:10mm"></span><br>WOOD: <span class="w" style="min-width:10mm"></span>') + '</td>') +
              '<td class="b">' + (c.st !== 'due' && c.inAt ? esc(c.inAt.slice(11, 16)) : '') + '</td><td class="s">' + (i ? '' : esc(b.gateNote || '')) + '</td></tr>';
          });
        });
        for (var x = 0; x < 4; x++) html += '<tr class="newparty"><td></td><td></td><td></td><td></td><td></td><td></td><td></td><td class="s">' + BOX + 'signed on paper</td><td class="s">ICE:<br>WOOD:</td><td></td><td></td></tr>';
        html += '</tbody></table>';
        if (!printDoc('check-in sheet', dayTxt + ' · check-in from ' + checkInTime() + (GATE.area ? ' · ' + AREA_SHORT[GATE.area] + ' only' : '') + ' · ' + list.length + ' parties, ' + n + ' vehicles' + (list.some(function (b) { return !vehKnown(b); }) ? ' (' + list.filter(function (b) { return !vehKnown(b); }).length + ' not given yet, counted as 1 each)' : ''), html, 'Check: name and number of people, registration, indemnity signed, money owing, and ask if they want their wood and ice now or later. The empty rows are for people who are not on the list.')) return;
      } else {
        html = '<table><colgroup><col style="width:9%"><col style="width:16%"><col style="width:7%"><col style="width:10%"><col style="width:6%"><col style="width:22%"><col style="width:7%"><col style="width:7%"><col style="width:16%"></colgroup><thead><tr><th>Stand</th><th>Name</th><th colspan="2">Registration</th><th>People</th><th>Still to pay before leaving</th><th>Time out</th><th>Stand checked</th><th>Notes and problems at the stand</th></tr></thead><tbody>';
        list.forEach(function (b) {
          var cs = ensureCars(b).filter(function (c) { return c.st !== 'due'; }), st = standById(b.stand), bal = balance(b); if (!cs.length) cs = ensureCars(b);
          html += areaRow(areaOf(b), 9);
          cs.forEach(function (c, i) {
            var p = regParts(c.reg), t = carTab(b, c); n++;
            html += '<tr' + (i ? '' : ' class="newparty"') + '>' + (i ? '' : '<td class="st" rowspan="' + cs.length + '">' + esc(st.name) + '</td><td rowspan="' + cs.length + '"><span class="b">' + esc(guestName(b)) + '</span><br><span class="s">' + fdw(b.ci) + ' to ' + fdw(b.co) + '</span></td>') +
              '<td class="big">' + esc(p[0]) + '</td><td class="reg2">' + esc(p[1]) + '</td><td>' + (c.people || '') + '</td>' +
              (i ? '' : '<td rowspan="' + cs.length + '">' + (bal > 0 ? '<span class="owes">' + money(bal) + '</span> <span class="s">' + esc((b.charges || []).filter(function (x) { return x.car; }).map(function (x) { return x.desc.replace(/^Shop: /, ''); }).join('; ').slice(0, 90)) + '</span><br><span class="s">' + BOX + 'paid: cash / card / EFT &nbsp; R <span class="w" style="min-width:14mm"></span></span>' : '<span class="b">Nothing to pay</span>') + '</td>') +
              '<td></td>' + (i ? '' : '<td class="s" rowspan="' + cs.length + '">' + BOX + 'all OK</td><td rowspan="' + cs.length + '"></td>') + '</tr>';
          });
        });
        html += '</tbody></table>';
        if (!printDoc('check-out sheet', dayTxt + ' · check-out by ' + checkOutTime() + (GATE.area ? ' · ' + AREA_SHORT[GATE.area] + ' only' : '') + ' · ' + list.length + ' parties, ' + n + ' vehicles', html, 'Nobody leaves with money still owing: take the payment and tick how it was paid. Write down anything broken or left dirty so it goes on the site jobs list.')) return;
      }
      var todo = list.filter(function (b) { return !gateDone(b, kind) && b.status !== 'pending' && !onPaper(b, kind); });
      if (todo.length) setTimeout(function () {
        modal('Working from the printed sheet?', '<p>If the ' + (kind === 'in' ? 'check-ins' : 'check-outs') + ' for <b>' + dayTxt + '</b> are done on paper, mark these <b>' + todo.length + ' ' + (todo.length === 1 ? 'booking' : 'bookings') + '</b> as "on paper".</p><p class="muted small">They then show an "On paper" tag here and no reminders, and a "Type it in" button stays at the top of this page until you have copied the sheet into the system.</p>',
          'Yes, mark them as on paper', function () {
            todo.forEach(function (b) { b.paper = b.paper || {}; b.paper[kind] = { d: day, at: nowStamp(), by: ME.name }; });
            log('Printed the ' + (kind === 'in' ? 'check-in' : 'check-out') + ' sheet for ' + fdw(day) + ': ' + todo.length + ' bookings marked as on paper'); save(); render(); toast('Marked as on paper. Type the sheet in when you are back at the computer.');
          }, { cancelLabel: 'No, I only wanted a copy' });
      }, 400);
      return;
    }
    if (what === 'jobs') {
      var rows = siteDay(day).filter(function (r) { return (!GATE.area || r.stand.area === GATE.area) && (!GATE.stand || r.id === GATE.stand); });
      html = '<table><colgroup><col style="width:9%"><col style="width:21%"><col style="width:8%"><col style="width:16%"><col style="width:24%"><col style="width:6%"><col style="width:16%"></colgroup><thead><tr><th>Stand</th><th>Clean</th><th>Free wood</th><th>Deliver to the stand</th><th>Fix or look at</th><th>Done</th><th>Worker\'s notes</th></tr></thead><tbody>';
      rows.forEach(function (r) {
        html += areaRow(r.stand.area, 7) + '<tr><td class="st">' + esc(r.stand.name) + '</td><td>' + (r.clean ? BOX + esc(r.clean) : '') + r.fix.filter(function (j) { return j.kind === 'clean' && !j.done; }).map(function (j) { return '<br>' + BOX + '<span class="b">' + esc(j.text) + '</span>'; }).join('') + '</td>' +
          '<td>' + (r.wood ? BOX + '1 bag' : '') + '</td><td>' + r.deliver.filter(function (x) { return !x.d.done; }).map(function (x) { return BOX + '<span class="b">' + esc(itemsTxt(x.d.items)) + '</span>'; }).join('<br>') + '</td>' +
          '<td>' + r.fix.filter(function (j) { return j.kind !== 'clean' && !j.done; }).map(function (j) { return BOX + (j.urgent ? '<span class="owes">URGENT</span> ' : '') + '<span class="b">' + esc(j.text) + '</span>'; }).join('<br>') + '</td><td></td><td></td></tr>';
      });
      for (var y = 0; y < 3; y++) html += '<tr><td></td><td></td><td></td><td></td><td></td><td></td><td></td></tr>';
      html += '</tbody></table>';
      printDoc('site jobs for the workers', dayTxt + ' · ' + rows.length + ' stands', html, 'Tick each box when it is done. Write down anything else you find that is broken, so it can be added to the list.');
      return;
    }
    if (what === 'report') {
      var mv = gateMoves();
      html = '<table><thead><tr><th>Checked in</th><th>Time</th><th>Stand</th><th>Area</th><th>Guest</th><th>Registration</th><th>People</th><th>Checked out</th></tr></thead><tbody>' + mv.map(function (m) { return '<tr><td style="height:auto">' + fdw(m.d) + '</td><td style="height:auto">' + m.t + '</td><td style="height:auto" class="b">' + esc(m.st.name) + '</td><td style="height:auto">' + AREA_SHORT[m.st.area] + '</td><td style="height:auto">' + esc(guestName(m.b)) + '</td><td style="height:auto">' + esc(m.c.reg || '') + '</td><td style="height:auto">' + (m.c.people || '') + '</td><td style="height:auto">' + (m.outD ? fdw(m.outD) + ' ' + m.outT : 'In camp') + '</td></tr>'; }).join('') + '</tbody></table>';
      printDoc('check-in report', fd(GATE.rfrom, LONGD) + ' to ' + fd(GATE.rto, LONGD) + ' · ' + mv.length + ' vehicles', html, '');
    }
  }
  function gateCsv() {
    csv('kyleu-check-ins-' + GATE.rfrom + '-to-' + GATE.rto + '.csv', [['Checked in', 'Time in', 'Stand', 'Area', 'Guest', 'Booking', 'Registration', 'Vehicle', 'Driver', 'People', 'Checked out', 'Time out', 'Checked in by']].concat(gateMoves().map(function (m) { return [m.d, m.t, m.st.name, AREA_SHORT[m.st.area], guestName(m.b), m.b.ref, m.c.reg, m.c.make || '', m.c.driver, m.c.people, m.outD, m.outT, m.c.inBy || '']; })));
  }

  /* ----- typing a paper sheet into the system afterwards ----- */
  function actPaper(kind, day) {
    var list = DB.bookings.filter(function (b) { return live(b) && onPaper(b, kind) && b.paper[kind].d === day; }).sort(function (a, b) { return standSort(a.stand, b.stand); }), rows = [];
    list.forEach(function (b) { ensureCars(b).forEach(function (c, i) { if (kind === 'in' ? c.st === 'due' && !c.noShow : c.st === 'in') rows.push({ b: b, c: c, i: i }); }); });
    if (!rows.length) { toast('Nothing left to type in for this sheet'); return; }
    var defT = function (b) { var m = String(b.eta || '').match(/(\d{1,2}):(\d{2})/); return kind === 'in' ? (m ? ('0' + m[1]).slice(-2) + ':' + m[2] : '14:00') : '10:00'; };
    var body = '<p class="muted small">Copy the printed sheet for <b>' + fd(day, { weekday: 'long', day: 'numeric', month: 'long' }) + '</b>, one vehicle per block. Leave a vehicle on "Not yet" if it is not on the sheet, and it stays on the list.</p><div class="paper-rows">' +
      rows.map(function (r, n) {
        var b = r.b, c = r.c, st = standById(b.stand), first = !rows.slice(0, n).some(function (x) { return x.b === b; }), bal = balance(b), t = carTab(b, c), ind = c.ind || carSigned(b, c), left = orderLeft(b);
        return '<fieldset class="paper-row" data-prow="' + n + '"><legend><b>' + esc(st.name) + '</b> ' + esc(guestName(b)) + (rows.filter(function (x) { return x.b === b; }).length > 1 ? ' · vehicle ' + (r.i + 1) : '') + '</legend>' +
          '<div class="seg wrap">' + (kind === 'in' ? [['yes', 'Arrived'], ['no', 'Did not come'], ['', 'Not yet']] : [['yes', 'Left'], ['', 'Still here']]).map(function (o) { return '<label><input type="radio" name="st' + n + '" value="' + o[0] + '"' + (o[0] === 'yes' ? ' checked' : '') + '><span>' + o[1] + '</span></label>'; }).join('') + '</div>' +
          '<div class="paper-grid"><label class="fld"><span>Time ' + (kind === 'in' ? 'in' : 'out') + '</span><input type="time" name="t' + n + '" value="' + defT(b) + '"></label>' +
          (kind === 'in' ? '<label class="fld"><span>Registration</span><input name="reg' + n + '" value="' + esc(c.reg) + '" style="text-transform:uppercase" autocomplete="off"></label><label class="fld"><span>Vehicle</span><input name="make' + n + '" value="' + esc(c.make || '') + '" placeholder="e.g. white Hilux" autocomplete="off"></label><label class="fld"><span>People in it</span><input type="number" min="1" max="12" name="ppl' + n + '" value="' + (c.people || 1) + '"></label>' : '') +
          ((kind === 'in' ? first && bal > 0 : (first ? bal : t.owing) > 0) ? '<label class="fld"><span>Paid at the gate (owes ' + money(kind === 'in' || first ? bal : t.owing) + ')</span><input name="amt' + n + '" inputmode="decimal" placeholder="0"></label><label class="fld"><span>Paid by</span><select name="m' + n + '"><option value="cash">Cash</option><option value="card">Card</option><option value="eft">EFT</option></select></label>' : '') +
          '<label class="fld paper-wide"><span>Problem written on the sheet (goes to the site jobs)</span><input name="iss' + n + '" autocomplete="off"></label></div>' +
          (kind === 'in' ? '<div class="paper-checks">' + (ind ? '<span class="pill ok">' + ic('check') + 'Indemnity already signed</span>' : '<label class="check"><input type="checkbox" name="ind' + n + '" checked><span>Indemnity signed on paper</span></label>') + (first && left ? '<label class="check"><input type="checkbox" name="hand' + n + '" checked><span>Handed over: ' + esc(itemsTxt(left)) + '</span></label>' : '') + '</div>' : '') + '</fieldset>';
      }).join('') + '</div>';
    modal('Type in the paper ' + (kind === 'in' ? 'check-in' : 'check-out') + ' sheet', body, 'Save the sheet', function (f) {
      var nDone = 0, nSkip = 0, noInd = [];
      rows.forEach(function (r, n) {
        var b = r.b, c = r.c, v = ($('[name=st' + n + ']:checked', f) || {}).value, time = fval(f, 't' + n) || (kind === 'in' ? '14:00' : '10:00'), stamp = day + ' ' + time, amt = parseFloat(String(fval(f, 'amt' + n)).replace(/[^\d.]/g, '')) || 0, iss = fval(f, 'iss' + n);
        if (iss) { addJob(b.stand, iss, { ref: b.ref }); }
        if (!v) { nSkip++; return; }
        if (kind === 'in') {
          if (v === 'no') { c.noShow = { d: day, by: ME.name }; b.notes.push({ at: nowStamp(), by: ME.name, text: carLabel(c, r.i) + ' did not arrive (paper sheet for ' + fdw(day) + ').' }); nDone++; return; }
          c.reg = String(fval(f, 'reg' + n) || c.reg || '').toUpperCase(); c.make = fval(f, 'make' + n); c.people = Math.max(1, +fval(f, 'ppl' + n) || c.people || 1);
          if (!c.ind && !carSigned(b, c)) { if (fval(f, 'ind' + n)) { c.ind = { at: stamp, by: ME.name + ' (paper)' }; paperRecs(b, c, stamp, ME.name); } else noInd.push(carLabel(c, r.i)); }
          c.st = 'in'; c.inAt = stamp; c.inBy = ME.name + ' (paper sheet)'; b.status = 'in'; delete c.auto; vehSaid(b);
          if (fval(f, 'hand' + n)) { var left = orderLeft(b); if (left) drops(b).push({ id: uid('dr'), d: day, items: left, how: 'gate', done: { at: stamp, by: ME.name } }); }
          if (amt > 0) b.payments.push({ d: day, amt: amt, m: fval(f, 'm' + n) || 'cash', type: 'Balance', ref: 'Paid at the gate' });
        } else {
          var t = carTab(b, c), m = fval(f, 'm' + n) || 'cash';
          if (amt > 0) { var tabPart = Math.min(amt, t.owing); if (tabPart > 0) b.payments.push({ d: day, amt: tabPart, m: m, type: 'Tab', ref: 'Tab ' + carLabel(c, r.i), car: c.id }); if (amt > tabPart) b.payments.push({ d: day, amt: amt - tabPart, m: m, type: 'Balance', ref: 'Paid at check-out' }); }
          c.st = 'out'; c.outAt = stamp; c.outBy = ME.name + ' (paper sheet)';
          if (!b.cars.some(function (x) { return x.st === 'in'; })) { b.cars = b.cars.filter(function (x) { return x.st !== 'due'; }); b.vehicles = b.cars.length; b.status = 'out'; }
        }
        nDone++;
      });
      list.forEach(function (b) { var open = ensureCars(b).some(function (c) { return (kind === 'in' ? c.st === 'due' && !c.noShow : c.st === 'in'); }); if (!open) b.paper[kind].done = true; });
      log('Paper ' + (kind === 'in' ? 'check-in' : 'check-out') + ' sheet for ' + fdw(day) + ' typed in: ' + nDone + ' vehicle' + (nDone === 1 ? '' : 's')); save(); render();
      toast(nDone + ' vehicle' + (nDone === 1 ? '' : 's') + ' saved' + (nSkip ? ', ' + nSkip + ' left on the list' : '') + (noInd.length ? '. Indemnity still missing for ' + noInd.length : ''));
    }, { xl: true, noFocus: true });
  }

  // two example jobs so the site jobs list is not empty in the demo
  function gateSeed() {
    if (DB.jobs) return; DB.jobs = [];
    var inCamp = DB.bookings.filter(function (b) { return b.status === 'in'; });
    if (inCamp[0]) DB.jobs.push({ id: 'jobdemo1', stand: inCamp[0].stand, kind: 'repair', text: 'The toilet keeps running after it is flushed. The water does not stop.', urgent: true, at: TODAY + ' 08:10', by: 'Sherri', ref: inCamp[0].ref, done: null });
    // and one arrival today who ordered ice and wood with the booking, to show the hand-over at check-in
    var arr = DB.bookings.filter(function (b) { return b.status === 'confirmed' && b.ci === TODAY && !preShop(b); })[0], its = shopItems();
    var ice = its.filter(function (x) { return /ice/i.test(x.label); })[0], wood = its.filter(function (x) { return /wood/i.test(x.label) && !/sekelbos/i.test(x.label); })[0] || its.filter(function (x) { return /wood/i.test(x.label); })[0];
    if (arr && ice && wood) setPreShop(arr, [{ label: ice.label, qty: 3, each: ice.amount }, { label: wood.label, qty: 2, each: wood.amount }], TODAY, false);
    if (inCamp[1]) DB.jobs.push({ id: 'jobdemo2', stand: inCamp[1].stand, kind: 'repair', text: 'The scullery tap drips. It needs a new washer.', urgent: false, at: add(TODAY, -1) + ' 16:40', by: 'Sherri', ref: inCamp[1].ref, done: null });
  }

  /* ---------- camp news: posts for the website's news page ---------- */
  var MDPOSTS = null, MDLOAD = false, NEWSK = 'kyleu-web-news';
  function loadMd() { if (MDLOAD) return; MDLOAD = true; if (!K.blogFile) { MDPOSTS = []; return; } K.blogFile().then(function (p) { MDPOSTS = p; }).catch(function () { MDPOSTS = []; }).then(function () { var v = route(); if (v === 'news' || v === 'dashboard') render(); }); }
  function newsDB() { DB.news = DB.news || { posts: [], hidden: {} }; DB.news.hidden = DB.news.hidden || {}; DB.news.deleted = DB.news.deleted || {}; return DB.news; }
  // Delete at the bottom of an edit pop-up: asks first, right there, so the pop-up stays open if you change your mind
  function delBox(what) {
    return '<div class="del-box" data-delbox><p class="muted small">' + ic('info') + '<span><b>Hide</b> takes it off the website but keeps it here, so you can show it again later. <b>Delete</b> removes it for good.</span></p>' +
      '<button type="button" class="btn ghost sm danger-t" data-del-ask>' + ic('x') + 'Delete this ' + what + '</button>' +
      '<div class="del-confirm" data-del-confirm hidden><p><b>Delete this ' + what + '?</b> It disappears from the website. This cannot be undone.</p><div class="row-btns"><button type="button" class="btn ghost sm" data-del-keep>Keep it</button><button type="button" class="btn sm danger" data-del-yes>' + ic('x') + 'Yes, delete it</button></div></div></div>';
  }
  function wireDel(f, onYes) {
    var ask = $('[data-del-ask]', f), box = $('[data-del-confirm]', f); if (!ask) return;
    ask.addEventListener('click', function () { ask.hidden = true; box.hidden = false; $('[data-del-keep]', box).focus(); });
    $('[data-del-keep]', box).addEventListener('click', function () { box.hidden = true; ask.hidden = false; ask.focus(); });
    $('[data-del-yes]', box).addEventListener('click', onYes);
  }

  function pushNews() { try { localStorage.setItem(NEWSK, JSON.stringify(newsDB())); } catch (e) { toast('This browser is out of space. Try a smaller photo.'); } }
  function allPosts() {
    var N = newsDB(), mine = {}; N.posts.forEach(function (p) { mine[p.slug] = 1; });
    var out = (MDPOSTS || []).filter(function (p) { return !mine[p.slug] && !N.deleted[p.slug]; }).map(function (p) { return { key: 'f:' + p.slug, src: 'file', slug: p.slug, title: p.title, date: p.date, image: p.image, summary: p.summary, tags: p.tags, body: p.body, hidden: !!N.hidden[p.slug] }; });
    N.posts.forEach(function (p) { out.push(Object.assign({}, p, { key: 'a:' + p.id, src: p.of ? 'edited' : 'admin', hidden: !!N.hidden[p.slug] })); });
    return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
  }
  function newsAge() { if (MDPOSTS === null) { loadMd(); return null; } var l = allPosts().filter(function (p) { return !p.draft && !p.hidden; })[0]; return l ? diff(l.date, TODAY) : 999; }
  function postState(p) { return p.draft ? { t: 'Draft', tone: 'muted' } : p.hidden ? { t: 'Hidden', tone: 'muted' } : diff(p.date, TODAY) <= 7 ? { t: 'New this week', tone: 'ok' } : { t: 'Published', tone: 'info' }; }
  function vNews() {
    if (MDPOSTS === null) loadMd();
    var ps = allPosts(), shown = ps.filter(function (p) { return !p.draft && !p.hidden; }), ago = shown.length ? diff(shown[0].date, TODAY) : null, fresh = ago !== null && ago <= 7;
    return '<div class="page-h"><div><h1>Camp news</h1><p class="muted">Posts for the Camp news page on the website, newest first. Tick <b>Front page news</b> on a post to feature it in the big block on the home page.</p></div><div class="ph-act"><a class="btn ghost" href="../news.html" target="_blank" rel="noopener">' + ic('ext') + 'View news page</a><button class="btn" data-act="news-new">' + ic('plus') + 'New post</button></div></div>' +
      '<div class="news-status ' + (fresh ? 'fresh' : 'quiet') + '">' + ic(fresh ? 'check' : 'clock') + '<div>' + (MDPOSTS === null ? 'Loading posts…' : ago === null ? '<b>No posts yet.</b> The news page shows a "nothing new this week" note until the first one.' : fresh ? '<b>Fresh news is on the website.</b> The latest post went up ' + (ago === 0 ? 'today' : ago === 1 ? 'yesterday' : ago + ' days ago') + '.' : '<b>Last post ' + ago + ' days ago.</b> The news page still shows your recent posts, but a fresh one keeps it alive. A short note about sightings, the weather or camp news is plenty.') + '</div></div>' +
      '<div class="card flush"><table class="tbl"><thead><tr><th>Post</th><th>Date</th><th>Tags</th><th>Status</th></tr></thead><tbody>' +
      (ps.length ? ps.map(function (p) { return '<tr data-post="' + esc(p.key) + '" tabindex="0"><td data-l="Post"><span class="post-row">' + (p.image ? '<img src="' + esc(imgSrc(p.image)) + '" alt="">' : '<span class="post-noimg">' + ic('image') + '</span>') + '<span><b>' + esc(p.title) + '</b><small>' + esc(p.summary || '') + '</small></span></span></td><td data-l="Date" data-s="' + esc(p.date) + '">' + fd(p.date, { day: 'numeric', month: 'short', year: 'numeric' }) + '</td><td data-l="Tags">' + ((p.tags || []).map(function (t) { return '<span class="tag">' + esc(t) + '</span>'; }).join('') || '<span class="muted">None</span>') + '</td><td data-l="Status">' + pill(postState(p)) + (p.front && !p.draft && !p.hidden ? ' <span class="pill front"><i></i>Front page</span>' : '') + '</td></tr>'; }).join('') : '<tr><td colspan="4" class="empty">No posts yet.</td></tr>') + '</tbody></table></div>' +
      '<p class="demo-note">' + ic('info') + 'Demo: posts you publish or delete here change the website\'s news page in this browser. In the live version they are saved on (or deleted from) the server, so every visitor sees the change.</p>';
  }
  /* =========================================================
     Dinokeng updates: the Bush Telegraph, the magazine, Dinokeng news
     and maps, shown on the Dinokeng page under "News from the reserve".
     The ones in content/dinokeng-updates.md can be changed or hidden here;
     new ones are added here. Demo: kept in this browser ("kyleu-web-dgr"),
     uploaded PDFs and covers in the browser's file store. Live: the server.
     ========================================================= */
  var DGRK = 'kyleu-web-dgr', DGRMD = null, DGRLOAD = false, DGR_TYPES = ['Bush Telegraph', 'Magazine', 'Dinokeng news', 'Map or guide'];
  function dgrDB() { DB.dgr = DB.dgr || { items: [], over: {} }; DB.dgr.over = DB.dgr.over || {}; DB.dgr.items = DB.dgr.items || []; return DB.dgr; }
  function dgrPush() { save(); try { localStorage.setItem(DGRK, JSON.stringify(dgrDB())); } catch (e) { toast('This browser is out of space.'); } }
  function dgrLoad() { if (DGRLOAD) return; DGRLOAD = true; K.dgrFile().then(function (l) { DGRMD = l; }).catch(function () { DGRMD = []; }).then(function () { if (route() === 'dgrnews') render(); }); }
  function dgrAll() {
    var X = dgrDB();
    return (DGRMD || []).filter(function (it) { return !(X.over[it.slug] || {}).deleted; }).map(function (it) { return Object.assign({}, it, X.over[it.slug] || {}, { key: 'f:' + it.slug }); })
      .concat(X.items.map(function (it) { return Object.assign({ src: 'admin' }, it, { key: 'a:' + it.id }); }))
      .sort(function (a, b) { return (!!b.pinned - !!a.pinned) || (a.date < b.date ? 1 : -1); });
  }
  function dgrGet(key) { return dgrAll().filter(function (x) { return x.key === key; })[0]; }
  function mbSize(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  // the cover of a PDF: its first page, drawn with pdf.js
  var PDFJS = null;
  function pdfCover(file) {
    if (!PDFJS) PDFJS = new Promise(function (ok, no) { var sc = document.createElement('script'); sc.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js'; sc.onload = function () { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; ok(window.pdfjsLib); }; sc.onerror = no; document.head.appendChild(sc); });
    return PDFJS.then(function (lib) { return file.arrayBuffer().then(function (buf) { return lib.getDocument({ data: buf }).promise; }); }).then(function (pdf) { return pdf.getPage(1); }).then(function (pg) {
      var v1 = pg.getViewport({ scale: 1 }), vp = pg.getViewport({ scale: 720 / Math.max(v1.width, v1.height) }), c = document.createElement('canvas'); c.width = Math.round(vp.width); c.height = Math.round(vp.height);
      var x = c.getContext('2d'); x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
      return pg.render({ canvasContext: x, viewport: vp, intent: 'print' }).promise.then(function () { return new Promise(function (ok) { c.toBlob(ok, 'image/jpeg', .82); }); });
    });
  }
  function dgrThumbs() {   // covers kept in the browser's file store
    $$('[data-dgr-cover]').forEach(function (im) { K.files.get(im.dataset.dgrCover).then(function (b) { if (b) im.src = URL.createObjectURL(b); }); });
  }
  function vDgr() {
    dgrLoad(); setTimeout(dgrThumbs, 0);
    var all = dgrAll(), shown = all.filter(function (x) { return !x.hidden; });
    return '<div class="page-h"><div><h1>Dinokeng news</h1><p class="muted">The Bush Telegraph, the Dinokeng magazine, Dinokeng news and maps, shown on the Dinokeng page under "News from the reserve". Add a PDF or a link, or write a full story with photos. Tick <b>Front page news</b> to feature one on the home page.</p></div><div class="ph-act"><a class="btn ghost" href="../dinokeng.html#reserve-news" target="_blank" rel="noopener">' + ic('ext') + 'View on the website</a><button class="btn" data-act="dgr-new">' + ic('plus') + 'Add an update</button></div></div>' +
      '<section class="card"><header class="card-h"><h3>On the website</h3><span class="count">' + shown.length + ' shown</span></header>' +
      (DGRMD === null ? '<p class="empty">Loading…</p>' : all.length ? '<div class="list">' + all.map(function (x) {
        var th = x.coverKey ? '<img data-dgr-cover="' + esc(x.coverKey) + '" alt="">' : x.image ? '<img src="' + esc(imgSrc(x.image)) + '" alt="">' : ic('news');
        return '<button type="button" class="brow dgr-row' + (x.hidden ? ' off' : '') + '" data-act="dgr-edit" data-ref="' + esc(x.key) + '"><span class="dgr-th">' + th + '</span><span class="brow-g"><b>' + esc(x.title) + '</b><small>' + esc(x.type) + (x.date ? ' · ' + fd(x.date) : '') + (x.file || x.fileKey ? ' · PDF' + (x.size ? ' ' + esc(x.size) : '') : '') + (x.link ? ' · link' : '') + '</small></span>' +
          (x.front && !x.hidden ? '<span class="pill front"><i></i>Front page</span>' : '') + (x.article ? '<span class="pill muted">Full story</span>' : '') + (x.pinned ? '<span class="pill info">Shown first</span>' : '') + (x.hidden ? '<span class="pill muted">Hidden</span>' : '<span class="pill ok">Shown</span>') + ic('chev-r') + '</button>';
      }).join('') + '</div>' : '<p class="empty">Nothing yet. Press Add an update.</p>') + '</section>' +
      '<p class="demo-note">' + ic('info') + 'How it looks on the website: a cover (made from the PDF\'s first page if you do not add one), the kind and date, your heading and a few sentences, and buttons to read or download it. Demo: changes, uploads and deletes stay in this browser. In the live version they are saved on (or deleted from) the server, so every visitor sees them. Ask Dinokeng before posting newsletters that were only meant for partners.</p>';
  }
  function actDgr(key) {
    var X = dgrDB(), it = key ? dgrGet(key) : null, isFile = it && it.src === 'file', d = it || { type: 'Bush Telegraph', title: '', date: TODAY, text: '', link: '', button: '', pinned: false, hidden: false };
    modal(it ? 'Edit update' : 'Add an update',
      (isFile ? '<p class="hint">' + ic('info') + ' This one comes from the website\'s dinokeng-updates.md file. Your changes are saved on top of it.</p>' : '') +
      '<div class="grid2"><label class="fld"><span>Kind</span><select name="type">' + DGR_TYPES.map(function (t) { return '<option' + (t === d.type ? ' selected' : '') + '>' + t + '</option>'; }).join('') + '</select></label><label class="fld"><span>Date</span><input type="date" name="date" value="' + esc(d.date || TODAY) + '"></label></div>' +
      '<label class="fld"><span>Heading</span><input name="title" value="' + esc(d.title) + '" placeholder="e.g. A fresh start for the bush: block burns in the south"></label>' +
      '<label class="fld"><span>Announcement (two or three sentences in your own words)</span><textarea name="text" rows="4" placeholder="What is it about, and why should a guest read it?">' + esc(d.text || '') + '</textarea></label>' +
      '<details class="story-more"' + (d.article ? ' open' : '') + '><summary>' + ic('edit') + '<span><b>Write a full story</b><small>Optional: your own article with photos, shown like a camp news story. Leave it empty for just the PDF or link.</small></span></summary>' + storyField(d.article || '', 'The full story') + '</details>' +
      '<h5>The file or link</h5><label class="fld"><span>PDF ' + ((d.file || d.fileKey) ? '(now: ' + esc(d.fileName || String(d.file).split('/').pop()) + (d.size ? ', ' + esc(d.size) : '') + '; choose another to replace it)' : '') + '</span><input type="file" name="pdf" accept="application/pdf"></label>' +
      '<div class="grid2"><label class="fld"><span>Or a link (e.g. the magazine on Dinokeng\'s website)</span><input name="link" value="' + esc(d.link || '') + '" placeholder="https://"></label><label class="fld"><span>Button text for the link</span><input name="button" value="' + esc(d.button || '') + '" placeholder="e.g. Read the magazines"></label></div>' +
      '<label class="fld"><span>Cover picture (optional: without one, the cover is made from the PDF\'s first page)</span><input type="file" name="cover" accept="image/*"></label>' +
      '<label class="check front-check"><input type="checkbox" name="front"' + (d.front ? ' checked' : '') + '><span><b>Front page news:</b> show this in the big block on the home page. Untick it any time; it stays on the Dinokeng page.</span></label>' +
      '<label class="check"><input type="checkbox" name="pinned"' + (d.pinned ? ' checked' : '') + '><span>Show it first on the Dinokeng page (featured at the top)</span></label>' +
      '<label class="check"><input type="checkbox" name="shown"' + (d.hidden ? '' : ' checked') + '><span>Show it on the website</span></label>' +
      (it ? delBox('update') : ''),
      it ? 'Save' : 'Add update', function (f) {
        var st = storyRead(f), v = { type: fval(f, 'type'), title: fval(f, 'title'), date: fval(f, 'date'), text: f.elements.text.value.trim(), link: fval(f, 'link'), button: fval(f, 'button'), pinned: !!fval(f, 'pinned'), hidden: !fval(f, 'shown'), front: !!fval(f, 'front'), article: st.empty ? '' : st.html, imgs: st.imgs };
        if (!v.text && !st.empty) v.text = st.text.replace(/\s+/g, ' ').trim().slice(0, 220);
        var pdf = f.elements.pdf.files[0], cov = f.elements.cover.files[0];
        if (!v.title) { toast('Give it a heading'); return false; }
        if (v.link && !/^https?:\/\//.test(v.link)) { toast('The link must start with https://'); return false; }
        if (pdf && !/pdf$/i.test(pdf.type || pdf.name)) { toast('Choose a PDF file'); return false; }
        if (!it && !pdf && !v.link && !v.article) { toast('Add a PDF or a link, or write a full story'); return false; }
        var id = it ? (isFile ? 'f-' + it.slug : it.id) : uid('dg'), jobs = [];
        if (pdf) { v.fileKey = 'dgr-file-' + id; v.fileName = pdf.name; v.size = mbSize(pdf.size); jobs.push(K.files.put(v.fileKey, pdf)); }
        if (cov) { v.coverKey = 'dgr-cover-' + id; jobs.push(K.files.put(v.coverKey, cov)); }
        else if (pdf && !(it && (it.image || it.coverKey))) { v.coverKey = 'dgr-cover-' + id; toast('Making the cover from the PDF…'); jobs.push(Promise.race([pdfCover(pdf), new Promise(function (ok, no) { setTimeout(no, 20000); })]).then(function (b) { return K.files.put(v.coverKey, b); }).catch(function () { delete v.coverKey; })); }
        Promise.all(jobs).then(function () {
          if (isFile) X.over[it.slug] = Object.assign(X.over[it.slug] || {}, v);
          else if (it) Object.assign(X.items.filter(function (x) { return x.id === it.id; })[0], v);
          else X.items.unshift(Object.assign({ id: id }, v));
          log((it ? 'Updated' : 'Added') + ' Dinokeng update: ' + v.title); dgrPush(); render(); toast(it ? 'Saved' : 'Added. It shows on the Dinokeng page now.');
        }).catch(function () { toast('The file could not be saved in this browser.'); });
      }, { xl: true, noFocus: true, onOpen: function (f) {
        storyMount(f);
        if (it) wireDel(f, function () {
          // one added here is removed with its uploaded PDF and cover; one from dinokeng-updates.md is marked deleted so it never shows again
          var up = isFile ? (X.over[it.slug] || {}) : X.items.filter(function (y) { return y.id === it.id; })[0] || {};
          if (up.fileKey) K.files.del(up.fileKey); if (up.coverKey) K.files.del(up.coverKey); (up.imgs || []).forEach(function (k) { K.files.del(k); });
          if (isFile) X.over[it.slug] = { deleted: true }; else X.items.splice(X.items.indexOf(up), 1);
          log('Deleted Dinokeng update: ' + it.title); dgrPush(); closeModal(); render(); toast('Deleted. It is gone from the Dinokeng page.');
        });
      } });
  }
  /* =========================================================
     Social media: the accounts, the live feeds and the hand-picked posts
     shown on the Experience Kyleu page and in the website footer.
     Demo: saved in this browser and handed to the website through
     localStorage "kyleu-web-social". Live: saved on the server.
     ========================================================= */
  var SOCK = 'kyleu-web-social';
  function socDB() {
    if (!DB.social) {
      DB.social = { instagram: '', facebook: '', tiktok: '', hashtag: '#KyleuBushCamp', igFeed: '', igCount: 6, fbFeed: true, posts: [] };
      if (K.settings) K.settings().then(function (S) {   // start from content/settings.md
        var so = DB.social; so.instagram = S.get('Instagram', ''); so.facebook = S.get('Facebook', ''); so.tiktok = S.get('TikTok', ''); so.hashtag = S.get('Hashtag', so.hashtag);
        so.posts = socFromMd(S); SOC_SYNCED = true;
        socSave(); if (route() === 'social') render();
      }).catch(function () {});
    }
    socSync();
    return DB.social;
  }
  function socFromMd(S) {
    return (S.list('Guest stories') || []).filter(function (it) { return /^https?:/.test(it.value); }).map(function (it) {
      var pp = it.value.split(' · '), x = { id: uid('sp'), url: pp[0].trim(), title: it.label, by: (pp[1] || '').trim(), show: true };
      pp.slice(2).forEach(function (f) { var im = f.match(/^\s*image\s+(\S+)/i); if (im) x.img = im[1]; else if (/youtube|opens/i.test(f)) x.out = true; });
      return x;
    });
  }
  // stories added to settings.md since this list was made are added to it once (never ones that were removed here)
  var SOC_SYNCED = false;
  function socSync() {
    if (SOC_SYNCED || !DB.social || !K.settingsFile) return; SOC_SYNCED = true;
    K.settingsFile().then(function (S) {
      var so = DB.social, known = {}; so.gone = so.gone || [];
      so.posts.forEach(function (x) { known[x.url] = 1; }); so.gone.forEach(function (u) { known[u] = 1; });
      var add = socFromMd(S).filter(function (x) { return !known[x.url]; });
      if (!add.length) return;
      so.posts = add.concat(so.posts); socSave(); if (route() === 'social') render();
    }).catch(function () {});
  }
  function socThumbs() { $$('[data-soc-img]').forEach(function (im) { K.files.get(im.dataset.socImg).then(function (b) { if (b) im.src = URL.createObjectURL(b); }); }); }
  function socYt(u) { var m = String(u).match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})/); return /youtu/i.test(u) && m ? m[1] : ''; }
  function socPic(x) { var y = socYt(x.url); return x.imgKey ? '<img data-soc-img="' + esc(x.imgKey) + '" alt="">' : x.img ? '<img src="' + esc(imgSrc(x.img)) + '" alt="">' : y ? '<img src="https://i.ytimg.com/vi/' + y + '/mqdefault.jpg" alt="">' : ''; }
  function socSave() { save(); try { localStorage.setItem(SOCK, JSON.stringify(DB.social)); } catch (e) {} }
  function socKind(u) { return /instagram\.com/i.test(u) ? 'ig' : /facebook\.com|fb\.watch/i.test(u) ? 'fb' : /tiktok\.com/i.test(u) ? 'tt' : /youtu/i.test(u) ? 'yt' : 'web'; }
  var SOC_KIND = { ig: 'Instagram post', fb: 'Facebook post', tt: 'TikTok', yt: 'YouTube', web: 'Article or blog' };
  function vSocial() {
    var so = socDB(), shown = so.posts.filter(function (x) { return x.show; }).length;
    setTimeout(socThumbs, 0);
    var fld = function (k, label, ph, hint) { return '<label class="fld"><span>' + label + '</span><input data-soc="' + k + '" value="' + esc(so[k] || '') + '" placeholder="' + esc(ph) + '" autocomplete="off"></label>' + (hint ? '<p class="hint">' + hint + '</p>' : ''); };
    return '<div class="page-h"><div><h1>Social media</h1><p class="muted">Kyleu\'s accounts, the live feeds and the posts shown on the website (Experience Kyleu page, "Stories from our campers", and the footer of every page).</p></div><div class="ph-act"><a class="btn ghost" href="../experience.html#stories" target="_blank" rel="noopener">' + ic('ext') + 'See it on the website</a></div></div>' +
      '<div class="cols"><section class="card"><header class="card-h"><h3>Your accounts</h3></header>' +
      fld('instagram', 'Instagram', 'https://www.instagram.com/kyleubushcamp') + fld('facebook', 'Facebook page', 'https://www.facebook.com/kyleubushcamp') + fld('tiktok', 'TikTok (optional)', 'https://www.tiktok.com/@kyleubushcamp') + fld('hashtag', 'Hashtag for guests', '#KyleuBushCamp') +
      '<p class="hint">' + ic('info') + ' Empty links are hidden on the website. Changes save as you type.</p></section>' +
      '<section class="card"><header class="card-h"><h3>Live feeds</h3></header>' +
      '<h5>Facebook</h5><label class="check"><input type="checkbox" data-soc-chk="fbFeed"' + (so.fbFeed ? ' checked' : '') + '><span>Show a "See our Facebook page" box on the website</span></label>' +
      '<p class="hint">' + (so.facebook ? '<span class="pill ok">' + ic('check') + 'On</span> ' : '<span class="pill muted">Waiting</span> Add the Facebook page link under Your accounts first. ') + 'Facebook\'s own live-feed box needs Facebook cookies, which most browsers now block on other websites, so it stays empty. To show Facebook posts on the website, add them one by one under Featured posts below.</p>' +
      '<h5>YouTube videos</h5><p class="hint">' + ic('info') + ' Paste a YouTube link under Featured posts below and the video plays right on the Experience Kyleu page.</p>' +
      '<h5>Instagram</h5>' + fld('igFeed', 'Instagram feed ID', 'e.g. a1B2c3D4e5F6g7', '') +
      '<label class="fld"><span>How many photos</span><select data-soc-sel="igCount">' + [6, 9, 12].map(function (n) { return '<option' + (+so.igCount === n ? ' selected' : '') + '>' + n + '</option>'; }).join('') + '</select></label>' +
      '<p class="hint">' + (so.igFeed ? '<span class="pill ok">' + ic('check') + 'Connected</span> The newest Instagram photos show on the website by themselves.' : '<span class="pill muted">Not connected</span> Instagram only allows a live feed through an account connection. Free and once only:') + '</p>' +
      (so.igFeed ? '' : '<ol class="soc-steps"><li>Make a free account at <a href="https://behold.so" target="_blank" rel="noopener">behold.so</a>.</li><li>Connect Kyleu\'s Instagram (it must be a Business or Creator account; switching is free in the Instagram app).</li><li>Create a <b>JSON feed</b>, copy its <b>feed ID</b> and paste it above.</li></ol>') +
      '</section></div>' +
      '<section class="card"><header class="card-h"><h3>Featured posts</h3><span class="count">' + shown + ' shown</span><div class="ph-act"><button class="btn sm" data-act="soc-add">' + ic('plus') + 'Add a post</button></div></header>' +
      '<p class="muted small">Hand-picked videos, posts and articles under "Stories from our campers". Each one shows as the same neat card: a picture, where it is from, your title and who made it. YouTube videos play right on the page; anything else opens where it lives. Add a picture to a Facebook, Instagram or article card so it does not show a plain colour.</p>' +
      (so.posts.length ? '<div class="list soc-list">' + so.posts.map(function (x, i) {
        var k = socKind(x.url);
        var pic = socPic(x);
        return '<div class="brow soc-row' + (x.show ? '' : ' off') + '">' + (pic ? '<span class="soc-th">' + pic + '</span>' : '<span class="soc-ic ' + k + '">' + ic(k === 'ig' || k === 'fb' ? 'image' : 'ext') + '</span>') + '<span class="brow-g"><b>' + esc(x.title || 'Untitled') + '</b><small>' + SOC_KIND[k] + (x.by ? ' · ' + esc(x.by) : '') + ' · ' + esc(x.url.replace(/^https?:\/\/(www\.)?/, '').slice(0, 48)) + '</small></span>' +
          '<span class="soc-acts"><button type="button" class="btn ghost sm" data-act="soc-show" data-ref="' + x.id + '">' + (x.show ? 'Shown' : 'Hidden') + '</button>' +
          '<button type="button" class="icon-btn sm" data-act="soc-up" data-ref="' + x.id + '" aria-label="Move up"' + (i ? '' : ' disabled') + '>' + ic('chev-l', 'up') + '</button><button type="button" class="icon-btn sm" data-act="soc-down" data-ref="' + x.id + '" aria-label="Move down"' + (i < so.posts.length - 1 ? '' : ' disabled') + '>' + ic('chev-r', 'down') + '</button>' +
          '<button type="button" class="icon-btn sm" data-act="soc-edit" data-ref="' + x.id + '" aria-label="Edit">' + ic('edit') + '</button><button type="button" class="icon-btn sm danger-t" data-act="soc-del" data-ref="' + x.id + '" aria-label="Remove">' + ic('x') + '</button></span></div>';
      }).join('') + '</div>' : '<p class="empty">No posts yet. Press Add a post.</p>') + '</section>' +
      '<p class="demo-note">' + ic('info') + 'Demo: changes show on the website in this browser straight away. In the live version they are saved on the server, so every visitor sees them. <button type="button" class="link-btn" data-act="soc-md">Copy as settings.md text</button></p>';
  }
  function actSocPost(id) {
    var so = socDB(), x = id ? so.posts.filter(function (p) { return p.id === id; })[0] : null, d = x || { url: '', title: '', by: '' }, newPic = null, dropPic = false;
    var picBox = function () { var cur = dropPic ? '' : newPic ? '<img src="' + newPic.url + '" alt="">' : socPic(d); return (cur || '<span class="soc-nopic">' + ic('image') + '</span>') + '<span class="soc-pic-acts"><label class="btn ghost sm">' + ic('image') + (cur ? 'Change the picture' : 'Add a picture') + '<input type="file" accept="image/*" data-soc-file hidden></label>' + ((newPic || d.imgKey || d.img) && !dropPic ? '<button type="button" class="btn ghost sm" data-soc-nopic>' + ic('x') + 'Remove it</button>' : '') + '</span>'; };
    modal(x ? 'Edit post' : 'Add a post', '<label class="fld"><span>Link to the video, post or article</span><input name="url" value="' + esc(d.url) + '" placeholder="https://www.instagram.com/p/..." autocomplete="off"></label>' +
      '<div class="grid2"><label class="fld"><span>Title</span><input name="title" value="' + esc(d.title) + '" placeholder="e.g. Sunrise from Stand 4"></label><label class="fld"><span>By (optional)</span><input name="by" value="' + esc(d.by) + '" placeholder="e.g. @campwiththeventers"></label></div>' +
      '<span class="fld-l">Picture on the card</span><div class="soc-pic" data-soc-pic>' + picBox() + '</div>' +
      '<p class="hint">' + ic('info') + ' YouTube videos bring their own picture. For a Facebook or Instagram post or an article, add a photo or a screenshot of the post so the card looks its best.</p>' +
      '<label class="check"><input type="checkbox" name="out"' + (d.out ? ' checked' : '') + '><span>YouTube only: this video will not play on other websites, so open it on YouTube instead</span></label>' +
      '<p class="hint">' + ic('info') + ' If a YouTube video shows "Video unavailable" on the website, its owner has switched off playing on other websites: tick the box above. The post must be public, and it is polite to ask the guest first.</p>',
      x ? 'Save' : 'Add post', function (f) {
        var url = fval(f, 'url');
        if (!/^https?:\/\/\S+\.\S+/.test(url)) { toast('Paste the full link, starting with https://'); return false; }
        var row = { url: url, title: fval(f, 'title') || SOC_KIND[socKind(url)], by: fval(f, 'by'), out: !!fval(f, 'out') && socKind(url) === 'yt' };
        var t = x; if (x) Object.assign(x, row); else { t = Object.assign({ id: uid('sp'), show: true }, row); so.posts.unshift(t); }
        var fin = function () { log((x ? 'Updated' : 'Added') + ' social post: ' + row.title); socSave(); render(); toast(x ? 'Post saved' : 'Post added. It shows on the website now.'); };
        if (dropPic && !newPic) { if (t.imgKey) K.files.del(t.imgKey); delete t.imgKey; delete t.img; }
        if (newPic) { var key = 'soc-img-' + t.id; K.files.put(key, newPic.blob).then(function () { t.imgKey = key; delete t.img; fin(); }, function () { toast('The picture could not be saved in this browser.'); fin(); }); }
        else fin();
      }, { onOpen: function (f) {
        var box = $('[data-soc-pic]', f);
        f.addEventListener('change', function (e) { if (!e.target.matches('[data-soc-file]')) return; var file = e.target.files && e.target.files[0]; if (!file) return; resizeImg(file, 1400, function (blob) { if (!blob) { toast('That photo could not be opened'); return; } newPic = { blob: blob, url: URL.createObjectURL(blob) }; dropPic = false; box.innerHTML = picBox(); }); });
        f.addEventListener('click', function (e) { if (e.target.closest('[data-soc-nopic]')) { newPic = null; dropPic = true; box.innerHTML = picBox(); } });
        setTimeout(socThumbs, 0);
      } });
  }
  /* The writing tool (admin/editor.js) for a news story: used the same way for camp news and Dinokeng news.
     Without it (the file did not load) a plain text box is shown instead, so nothing is ever lost. */
  var STORY = null;
  function storyField(html, label) {
    return '<div class="story-fld"><div class="story-top"><span class="fld-l">' + label + '</span><button type="button" class="story-help" data-story-tour title="Watch a short tour of the writing tool"><b aria-hidden="true">?</b><span>Show me how</span></button></div><div class="story-host" data-story></div><textarea data-story-src hidden>' + esc(html || '') + '</textarea>' +
      '<p class="hint">' + ic('info') + ' Write and lay out the story here exactly as guests will see it. Select words to make them bold, highlight them or change the font, and use <b>Photo</b> to put a picture wherever you like.</p></div>';
  }
  function storyMount(f) {
    var host = $('[data-story]', f), src = $('[data-story-src]', f); STORY = null; if (!host) return;
    var tb = $('[data-story-tour]', f);
    if (window.KyEditor && KyEditor.mount) {
      try {
        STORY = KyEditor.mount(host, { html: src.value, placeholder: 'Write your story…' });
        // the question mark: a tour where a pretend mouse writes a sample story (the writer's own story comes back afterwards)
        var edNow = STORY;
        if (tb && KyEditor.tour) tb.addEventListener('click', function () { var dt = tb.closest('details'); if (dt) dt.open = true; KyEditor.tour(edNow, { photo: '../assets/img/photos/campfire-stand.jpg', onEnd: function () { try { tb.focus({ preventScroll: true }); } catch (e2) {} } }); });
        else if (tb) tb.hidden = true;
        return;
      } catch (e) { STORY = null; }
    }
    if (tb) tb.hidden = true;
    // fallback: a plain box (paragraphs are kept)
    var d0 = document.createElement('div'); d0.innerHTML = src.value; var plain = $$('p,h2,h3,li,blockquote', d0).map(function (x) { return x.textContent.trim(); }).filter(Boolean).join('\n\n') || d0.textContent.trim();
    host.innerHTML = '<textarea rows="12" data-story-plain placeholder="Write it like a short message to your guests.">' + esc(plain) + '</textarea>';
  }
  function storyRead(f) {
    if (STORY) { var h = STORY.getHTML(), t = STORY.getText(); return { html: STORY.isEmpty() ? '' : h, text: t, empty: STORY.isEmpty(), imgs: STORY.imageKeys ? STORY.imageKeys() : [] }; }
    var ta = $('[data-story-plain]', f), tx = ta ? ta.value.trim() : '';
    return { html: tx.split(/\n\s*\n/).filter(Boolean).map(function (x) { return '<p>' + esc(x).replace(/\n/g, '<br>') + '</p>'; }).join(''), text: tx, empty: !tx, imgs: [] };
  }
  function postImgHTML(img) { return (img ? '<img src="' + esc(imgSrc(img)) + '" alt=""><button type="button" class="btn ghost sm" data-post-noimg>' + ic('x') + 'Remove photo</button>' : '') + '<label class="btn ghost sm">' + ic('image') + (img ? 'Change photo' : 'Add a photo') + '<input type="file" accept="image/*" data-post-file hidden></label>'; }
  function uniqueSlug(s) { var all = allPosts().map(function (p) { return p.slug; }), x = s || 'post', n = 2; while (all.indexOf(x) >= 0) x = s + '-' + n++; return x; }
  function postMd(p) { return '## ' + p.title + '\ndate: ' + p.date + '\n' + (p.image ? 'image: ' + (/^data:/.test(p.image) ? 'assets/img/blog/your-photo.jpg' : p.image) + '\n' : '') + 'summary: ' + p.summary + '\ntags: ' + p.tags + '\n\n' + p.body + '\n'; }
  function actPost(key) {
    var N = newsDB(), isNew = !key, a = key && key.indexOf('a:') === 0 ? N.posts.filter(function (p) { return 'a:' + p.id === key; })[0] : null, f0 = key && key.indexOf('f:') === 0 ? (MDPOSTS || []).filter(function (p) { return 'f:' + p.slug === key; })[0] : null;
    var d = a || f0 || { title: '', date: TODAY, image: '', summary: '', tags: [], body: '', draft: false }, img = d.image || '', hideSlug = f0 ? f0.slug : a ? a.slug : '';
    modal(isNew ? 'New post' : 'Edit post',
      (f0 ? '<p class="hint">' + ic('info') + ' This post comes from the website\'s blog.md file. Your changes are saved as an edited copy.</p>' : '') +
      '<label class="fld"><span>Title</span><input name="title" value="' + esc(d.title) + '" placeholder="e.g. Lions at the waterhole this weekend"></label>' +
      '<div class="grid2"><label class="fld"><span>Date</span><input type="date" name="date" value="' + esc(d.date || TODAY) + '"></label><label class="fld"><span>Tags (separate with commas)</span><input name="tags" value="' + esc((d.tags || []).join(', ')) + '" placeholder="Camp news, Wildlife"></label></div>' +
      '<span class="fld-l">Photo</span><div class="post-img" data-post-img>' + postImgHTML(img) + '</div>' +
      '<label class="fld"><span>Short summary (shows on the news cards)</span><textarea name="summary" rows="2" maxlength="220">' + esc(d.summary || '') + '</textarea></label>' +
      storyField(d.html ? d.body : (d.body ? K.markdown(d.body) : ''), 'The story') +
      '<label class="check front-check"><input type="checkbox" name="front"' + (d.front ? ' checked' : '') + '><span><b>Front page news:</b> show this story in the big block on the home page. Untick it any time to take it off the home page; the story stays in Camp news.</span></label>' +
      '<label class="check"><input type="checkbox" name="draft"' + (d.draft ? ' checked' : '') + '><span>Save as a draft (not on the website yet)</span></label>' +
      '<div class="m-acts left">' + (hideSlug ? '<button type="button" class="btn ghost sm" data-post-hide>' + (N.hidden[hideSlug] ? 'Show on the website again' : 'Hide from the website') + '</button>' : '') + '</div>' + (isNew ? '' : delBox('post')),
      isNew ? 'Publish' : 'Save', function (f) {
        var st = storyRead(f), v = { title: fval(f, 'title'), date: fval(f, 'date') || TODAY, tags: fval(f, 'tags').split(',').map(function (t) { return t.trim(); }).filter(Boolean), summary: fval(f, 'summary'), body: st.html, html: true, imgs: st.imgs, image: img, draft: fval(f, 'draft'), front: !!fval(f, 'front') };
        if (!v.title) { toast('Give the post a title'); return false; }
        if (st.empty && !v.summary) { toast('Write a few words for the post'); return false; }
        if (!v.summary) v.summary = st.text.replace(/\s+/g, ' ').trim().slice(0, 160);
        var p = a;
        if (!p) { p = { id: uid('p'), slug: f0 ? f0.slug : uniqueSlug(K.slug ? K.slug(v.title) : slugify(v.title)), of: f0 ? f0.slug : '' }; N.posts.push(p); }
        Object.assign(p, v);
        pushNews(); log((isNew ? 'Published' : 'Updated') + ' news post "' + v.title + '"' + (v.draft ? ' (draft)' : '')); save(); render();
        toast(v.draft ? 'Draft saved' : v.front ? 'Saved. It is on the home page as front page news.' : isNew ? 'Post published on the news page' : 'Post saved');
      }, { xl: true, onOpen: function (f) {
        storyMount(f);
        wireDel(f, function () {
          ((a && a.imgs) || []).forEach(function (k) { K.files.del(k); });
          // a post made here is removed; a post from blog.md (or an edited copy of one) is marked deleted so it never shows again
          if (a) N.posts.splice(N.posts.indexOf(a), 1);
          if (f0 || (a && a.of)) N.deleted[f0 ? f0.slug : a.of] = 1;
          if (hideSlug) delete N.hidden[hideSlug];
          pushNews(); log('Deleted news post "' + d.title + '"'); save(); closeModal(); render(); toast('Post deleted. It is gone from the news page.');
        });
        var box = $('[data-post-img]', f);
        f.addEventListener('change', function (e) { if (!e.target.matches('[data-post-file]')) return; var file = e.target.files && e.target.files[0]; if (file) shrink(file, function (url) { img = url; box.innerHTML = postImgHTML(img); }); });
        f.addEventListener('click', function (e) {
          var t = e.target;
          if (t.closest('[data-post-noimg]')) { img = ''; box.innerHTML = postImgHTML(''); return; }
          if (t.closest('[data-post-hide]')) { if (N.hidden[hideSlug]) delete N.hidden[hideSlug]; else N.hidden[hideSlug] = 1; pushNews(); log((N.hidden[hideSlug] ? 'Hid' : 'Showed') + ' news post "' + d.title + '"'); save(); closeModal(); render(); toast(N.hidden[hideSlug] ? 'Hidden from the website' : 'Back on the website'); return; }
        });
      } });
  }
  function migrate() {
    // demo data from before a stand could be kept for a guest: add the two demo bookings that show it, once
    if ((DB.keepV || 0) < 1) { DB.keepV = 1; if (DB.seeded && !DB.bookings.some(function (b) { return b.noRelease; })) { keptDemo(DB, function () { var r; do { r = K.takeNo('Ref'); } while (byRef(r)); return r; }); DB.bookings.sort(function (a, b) { return a.ci < b.ci ? -1 : 1; }); } }
    ensureClients(); DB.settings = DB.settings || {}; gateSeed();
    Object.keys(DB.staffRoles || {}).forEach(function (id) { var su = STAFF.filter(function (x) { return x.id === id; })[0]; if (su && ROLES[DB.staffRoles[id]]) su.role = DB.staffRoles[id]; });   // roles the Owner changed
    DB.vouchers = [];   // Kyleu discount vouchers were removed; only Dinokeng partner codes are used
    DB.bookings.forEach(ensureCars);
    // vehicles nobody gave: one empty car and "not given yet", instead of made-up cars (older demo data had some)
    if ((DB.vehV || 0) < 1) { DB.vehV = 1; DB.bookings.forEach(vehTidy); }
    // demo data from before the thank-you step: older stays count as thanked, so the dashboard only lists the last few days
    if ((DB.thanksV || 0) < 1) { DB.thanksV = 1; DB.bookings.forEach(function (b) { if (b.status === 'out' && !b.thanks && b.co < add(TODAY, -2)) b.thanks = { at: b.co + ' 11:40', by: 'Sherri', via: b.guest.phone ? 'WhatsApp' : 'Email' }; }); }
    DB.bookings.forEach(function (b) { if (!b.key) b.key = newKey(); });
    // credits made before they had a code: give each one a code now, so the guest can use it on the website
    DB.credits = DB.credits || []; var noCode = DB.credits.filter(function (c) { return !c.code; }).length;
    DB.credits.forEach(function (c) { creditFix(c); }); if (noCode) save();
    if ((DB.dgrV || 0) < 2) { DB.dgrV = 2; DB.bookings.forEach(function (b) { var was = b.dgr; delete b.dgr; if (!live(b) || !(was || b.ci < add(TODAY, 3))) return; b.cars.forEach(function (c) { if (c.dgr) return; c.dgr = 'DGR' + Math.random().toString(36).slice(2, 8).toUpperCase(); c.dgrSent = { at: add(b.ci, -6) + ' 09:10', by: 'Sherri', code: c.dgr }; }); }); }
    // data from before "last reminded" was kept (b.nudges): fill it in once from what is stored, so the lists are not empty
    if ((DB.nudgeV || 0) < 1) { DB.nudgeV = 1; DB.bookings.forEach(nudgeFill); save(); }
    newsDB();
  }

  /* ---------- charts (single colour; two-series uses card orange + EFT blue) ---------- */
  var C_CARD = '#d2601a', C_EFT = '#1f78b8';
  function colChart(data, o) {
    o = o || {}; var H = o.h || 180, W = Math.max(data.length * (o.band || 22), 280), pad = 28, max = o.max || Math.max.apply(null, data.map(function (d) { return (d.a || 0) + (d.b || 0); }).concat([1]));
    var nice = niceMax(max), bw = Math.min(o.bar || 14, (W / data.length) - 4), y = function (v) { return H - pad - (v / nice) * (H - pad - 10); };
    var ticks = [0, nice / 2, nice].map(function (t) { return '<g class="tick"><line x1="40" x2="' + (W + 40) + '" y1="' + y(t) + '" y2="' + y(t) + '"/><text x="34" y="' + (y(t) + 4) + '" text-anchor="end">' + (o.fmt ? o.fmt(t) : t) + '</text></g>'; }).join('');
    var step = W / data.length;
    var bars = data.map(function (d, i) {
      var x = 40 + i * step + (step - bw) / 2, a = d.a || 0, b = d.b || 0, out = '';
      if (a) out += rbar(x, y(a), bw, y(0) - y(a), o.colA || C_CARD, !b);
      if (b) out += rbar(x, y(a + b), bw, y(a) - y(a + b) - (a ? 2 : 0), C_EFT, true);
      var lbl = (o.every ? i % o.every === 0 : true) ? '<text class="xl' + (d.hl ? ' hl' : '') + '" x="' + (x + bw / 2) + '" y="' + (H - 10) + '" text-anchor="middle">' + esc(d.label) + '</text>' : '';
      return '<g class="col" data-tip="' + esc(d.tip) + '"><rect class="hit" x="' + (40 + i * step) + '" y="0" width="' + step + '" height="' + (H - pad) + '"/>' + out + lbl + '</g>';
    }).join('');
    return '<div class="chart" style="--w:' + (W + 50) + 'px"><svg viewBox="0 0 ' + (W + 50) + ' ' + H + '" role="img" aria-label="' + esc(o.label || '') + '">' + ticks + bars + '</svg></div>';
  }
  function rbar(x, y, w, h, c, round) { if (h <= 0) return ''; var r = round ? Math.min(4, h) : 0; return '<path fill="' + c + '" d="M' + x + ' ' + (y + h) + 'V' + (y + r) + 'q0 -' + r + ' ' + r + ' -' + r + 'H' + (x + w - r) + 'q' + r + ' 0 ' + r + ' ' + r + 'V' + (y + h) + 'Z"/>'; }
  function niceMax(v) { var p = Math.pow(10, Math.floor(Math.log10(v))), n = v / p; return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p; }
  function hbars(rows, o) {
    var max = Math.max.apply(null, rows.map(function (r) { return r.v; }).concat([1]));
    return '<div class="hbars">' + rows.map(function (r) { return '<div class="hb" title="' + esc(r.tip || '') + '"><span class="hb-l">' + esc(r.l) + '</span><span class="hb-track"><span class="hb-bar" style="width:' + (r.v / (o && o.max || max) * 100) + '%"></span></span><span class="hb-v">' + esc(r.t) + '</span></div>'; }).join('') + '</div>';
  }
  var kfmt = function (v) { return v >= 1000 ? 'R' + Math.round(v / 1000) + 'k' : 'R' + v; };

  /* ---------- views ---------- */
  function standsBookedOn(day) { var ids = {}; DB.bookings.forEach(function (b) { if (live(b) && b.ci <= day && day < b.co) ids[b.stand] = b; }); return ids; }
  function tile(label, value, sub, act, tone) { var tag = act ? 'button' : 'div'; return '<' + tag + ' class="kpi ' + (tone || '') + '"' + (act ? ' data-go="' + act + '"' : '') + '><span class="kpi-l">' + label + '</span><b class="kpi-v">' + value + '</b><span class="kpi-s">' + sub + '</span></' + tag + '>'; }
  function rowB(b, extra, more) {
    var st = standById(b.stand), s = stateOf(b);
    return '<button class="brow" data-open="' + b.ref + '"><span class="brow-st">' + esc(st.name) + '</span><span class="brow-g"><b>' + esc(guestName(b)) + '</b><small>' + people(b) + (people(b) === 1 ? ' guest · ' : ' guests · ') + diff(b.ci, b.co) + (diff(b.ci, b.co) === 1 ? ' night' : ' nights') + (b.setup ? ' · ' + esc(b.setup) : '') + (more ? ' · ' + esc(more) : '') + '</small></span>' + (extra || pill(s)) + '</button>';
  }
  function vDashboard() {
    // today's arrivals in the order they are expected (old and new arrival times both work; no time given comes last)
    var arr = DB.bookings.filter(function (b) { return live(b) && b.ci === TODAY && (b.status !== 'pending' || b.noRelease); }).sort(function (a, b) { return etaNum(a.eta) - etaNum(b.eta) || standSort(a.stand, b.stand); }), dep = DB.bookings.filter(function (b) { return b.co === TODAY && (b.status === 'in' || b.status === 'out'); });
    var tonight = standsBookedOn(TODAY), nT = Object.keys(tonight).length;
    var pend = DB.bookings.filter(function (b) { return b.status === 'pending'; }), pendAmt = pend.reduce(function (a, b) { return a + Math.max(0, deposit(b) - paid(b)); }, 0);
    var balSoon = DB.bookings.filter(function (b) { return b.status === 'confirmed' && balance(b) > 0 && diff(TODAY, balanceDue(b)) <= 7; }), balAmt = balSoon.reduce(function (a, b) { return a + balance(b); }, 0);
    var month = TODAY.slice(0, 7), recv = 0; DB.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (p.d.slice(0, 7) === month && p.m !== 'credit') recv += p.amt; }); });   // paid with a credit: that money came in on the cancelled booking DB.sales.forEach(function (s) { if (s.d.slice(0, 7) === month) recv += s.amt; });
    var h = new Date().getHours();
    var attention = [];
    DB.bookings.forEach(function (b) {
      var s = stateOf(b);
      if (b.isNew) attention.push({ i: 'bell', tone: 'info', t: 'New website booking: <b>' + esc(guestName(b)) + '</b>, ' + esc(standById(b.stand).name) + ', ' + fd(b.ci), ref: b.ref, o: 0 });
      if (b.guestEdit && !b.guestEdit.seen) attention.push({ i: 'edit', tone: 'info', t: '<b>' + esc(guestName(b)) + '</b> changed their booking on the website: ' + esc(b.guestEdit.what.join('; ')), ref: b.ref, o: 0 });
      if (b.paidClaim) attention.push({ i: 'bank', tone: 'info', t: '<b>' + esc(guestName(b)) + '</b> says they paid ' + money(b.paidClaim.amt) + ' on ' + fd(b.paidClaim.date) + ': check the bank and confirm', ref: b.ref, o: 1 });
      if (extraDue(b)) attention.push({ i: 'alert', tone: 'bad', t: '<b>' + esc(guestName(b)) + '</b> owes ' + money(balance(b)) + ' more: ' + esc(b.extraDue.why || 'the total went up after paying in full').toLowerCase() + '. Send the new invoice.', ref: b.ref, o: 1 });
      if (live(b) && vehKnown(b) && b.status !== 'out' && b.co >= TODAY && namedIn(b) > people(b)) attention.push({ i: 'users', tone: 'warn', t: 'Vehicles list more people than the booking for <b>' + esc(guestName(b)) + '</b> (' + namedIn(b) + ' named, ' + people(b) + ' booked)', ref: b.ref, o: 5 });
      if (b.changeReq && !b.changeReq.done && live(b)) attention.push({ i: 'cal', tone: 'warn', t: '<b>' + esc(guestName(b)) + '</b> asked to change the dates or guests (' + fd(b.ci) + ')', ref: b.ref, o: 1 });
      if (openCancelReq(b)) attention.push({ i: 'alert', tone: 'warn', t: '<b>' + esc(guestName(b)) + '</b> asked to cancel the booking (' + fd(b.ci) + '): cancel it, or keep it and let them know', ref: b.ref, o: 1 });
      if (openSize(b)) attention.push({ i: 'users', tone: 'warn', t: '<b>' + esc(guestName(b)) + '</b>: ' + esc(sizeLine(b)) + ' Agree to it or contact them.', ref: b.ref, o: 1 });
      if (live(b) && b.status !== 'in' && b.status !== 'out' && b.ci >= TODAY && diff(TODAY, b.ci) <= 10 && paidUp(b) && !b.finalised) attention.push({ i: 'car', tone: 'warn', t: '<b>' + esc(guestName(b)) + '</b> has paid but not finalised the booking (' + fdw(b.ci) + '): ' + (diff(TODAY, b.ci) <= 7 ? 'their link is locked now, so add the vehicles and arrival time yourself (WhatsApp them) or at check-in' : 'send the finalise link or fill it in'), ref: b.ref, o: 5 });
      var ps = preShop(b); if (ps && live(b) && b.status !== 'out' && (b.ci === TODAY || b.ci === add(TODAY, 1))) attention.push({ i: 'cart', tone: 'info', t: 'Have ready for <b>' + esc(guestName(b)) + '</b> (' + (b.ci === TODAY ? 'today' : 'tomorrow') + '): ' + esc(ps.desc.replace(/^Shop order for arrival: /, '')), ref: b.ref, o: 3 });
      if (s.k === 'pop' || (s.k === 'soft' && b.holdWhy === 'pop' && diff(TODAY, b.softHold) > 2)) attention.push({ i: 'note', tone: 'info', t: 'Proof of payment from <b>' + esc(guestName(b)) + '</b>: check the bank for ' + money(deposit(b)), ref: b.ref, o: 1 });
      if (s.k === 'overdue') attention.push({ i: 'alert', tone: 'bad', t: '<b>' + esc(guestName(b)) + '</b> has not paid the EFT deposit (due ' + fd(depositDue(b)) + '). Remind or release the stand.', ref: b.ref, o: 2 });
      if (s.k === 'baldue' && s.tone === 'bad') attention.push({ i: 'alert', tone: 'bad', t: 'Balance overdue: <b>' + esc(guestName(b)) + '</b> owes ' + money(balance(b)) + ', arriving ' + fdw(b.ci), ref: b.ref, o: 3 });
    });
    if (can('gate')) {
      paperSheets().forEach(function (ps2) { attention.push({ i: 'clip', tone: 'info', t: 'Paper ' + (ps2.kind === 'in' ? 'check-in' : 'check-out') + ' sheet for <b>' + fdw(ps2.d) + '</b> still to type in (' + ps2.n + ' vehicle' + (ps2.n === 1 ? '' : 's') + ')', go: 'gate', o: 2 }); });
      var urg = jobsDB().filter(function (j) { return !j.done && j.urgent; }); if (urg.length) attention.push({ i: 'alert', tone: 'bad', t: urg.length + ' urgent site job' + (urg.length === 1 ? '' : 's') + ': <b>' + esc(urg.map(function (j) { return jobStand(j).name; }).join(', ')) + '</b>. See Check-in sheet, Site jobs.', go: 'gate', o: 1 });
    }
    var newEnq = DB.threads.filter(function (t) { return t.status === 'open'; });
    if (newEnq.length) attention.push({ i: 'mail', tone: 'warn', t: newEnq.length + ' email' + (newEnq.length > 1 ? 's' : '') + ' waiting for a reply', go: 'enquiries', o: 4 });
    var lowP = shopItems().filter(lowStock); if (lowP.length && can('products')) attention.push({ i: 'box', tone: 'warn', t: 'Running low in the shop: ' + lowP.map(function (p) { return esc(p.label) + ' (' + p.stock + ')'; }).join(', '), go: 'products', o: 6 });
    var noTime = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && !b.drive && b.co >= TODAY && diff(TODAY, b.ci) <= 7; }); if (noTime.length) attention.push({ i: 'car', tone: 'warn', t: noTime.length + ' game drive' + (noTime.length > 1 ? 's' : '') + ' this week still need a time', go: 'drives', o: 5 });
    DB.bookings.forEach(function (b) {
      if (live(b) && b.status !== 'out' && b.ci >= TODAY && diff(TODAY, b.ci) <= 7 && codesTodo(b)) { var nc = ensureCars(b).length, nt = codesTodo(b); var soonC = diff(TODAY, b.ci) <= 3, vTxt = !vehKnown(b) ? VEH_ASSUMED : nt === nc ? nc + ' vehicle' + (nc === 1 ? '' : 's') : nt + ' of ' + nc + ' vehicles still to send';
        attention.push({ i: 'gift', tone: 'warn', t: soonC ? 'Dinokeng codes not sent: <b>' + esc(guestName(b)) + '</b> arrives ' + (b.ci === TODAY ? 'today' : fdw(b.ci)) + ' (' + vTxt + ')' : 'Send Dinokeng codes to <b>' + esc(guestName(b)) + '</b> (' + fdw(b.ci) + ', ' + vTxt + ')', ref: b.ref, o: soonC ? 3 : 4, n: nudgeOf(b, 'dgr') ? 'codes ' + nudgeTxt(b, 'dgr', true) : '' }); }
      // every booking needs the indemnity, also a stand that is kept without a payment (b.noRelease) and pay on arrival
      if (live(b) && b.status !== 'in' && b.status !== 'out' && (b.status !== 'pending' || b.noRelease) && !onPaper(b, 'in') && b.ci >= TODAY && diff(TODAY, b.ci) <= 3) { var is = indStat(b); if (!is.done) attention.push({ i: 'shield', tone: 'warn', t: 'Indemnity not signed: <b>' + esc(guestName(b)) + '</b> arrives ' + (b.ci === TODAY ? 'today' : fdw(b.ci)) + ', ' + Math.min(is.covered, is.total) + ' of ' + is.total + ' signed for', ref: b.ref, o: 3, n: nudgeTxt(b, 'ind', true) }); }
      if (thanksDue(b)) attention.push({ i: 'send', tone: 'info', t: 'Thank-you not sent: <b>' + esc(guestName(b)) + '</b> checked out ' + (outDay(b) === TODAY ? 'today' : outDay(b) === add(TODAY, -1) ? 'yesterday' : 'on ' + fdw(outDay(b))), ref: b.ref, o: 6 });
      if (b.status === 'in') (b.cars || []).forEach(function (c, i) { if (c.st === 'in' && !c.ind) attention.push({ i: 'alert', tone: 'bad', t: 'Indemnity not signed: <b>' + esc(carLabel(c, i)) + '</b> at ' + esc(standById(b.stand).name), ref: b.ref, o: 2 }); });
    });
    var nScan = can('indemnities') ? paperTodo().length : 0; if (nScan) attention.push({ i: 'clip', tone: 'warn', t: '<b>' + nScan + ' paper indemnity form' + (nScan === 1 ? '' : 's') + ' to upload</b>: scan the signed page' + (nScan === 1 ? '' : 's') + ' and add ' + (nScan === 1 ? 'it' : 'them'), go: 'indemnities:paper', o: 5 });
    var nAge = can('news') ? newsAge() : null; if (nAge !== null && nAge > 14) attention.push({ i: 'note', tone: 'muted', t: nAge === 999 ? 'No camp news posted yet. A short post makes the news page feel alive.' : 'No camp news for ' + nAge + ' days. A short post keeps the news page fresh.', go: 'news', o: 7 });
    DB.dismissed = DB.dismissed || {};
    attention.forEach(function (a) { a.key = (a.ref || a.go) + '|' + a.i + '|' + a.t.replace(/<[^>]+>/g, '').slice(0, 60); });
    attention = attention.filter(function (a) { return !DB.dismissed[a.key]; });
    attention.sort(function (a, b) { return a.o - b.o; });
    // soft holds go right at the top: the stand is released at midnight unless the payment is confirmed
    var softs = DB.bookings.filter(function (b) { return b.status === 'pending' && b.softHold && (b.holdWhy !== 'pop' || diff(TODAY, b.softHold) <= 2); }).sort(function (a, b) { return a.softHold < b.softHold ? -1 : 1; });
    var softHtml = softs.map(function (b) {
      var c = b.paidClaim, when = b.softHold === TODAY ? 'tonight at midnight' : 'after ' + fdw(b.softHold);
      return '<button type="button" class="soft-alert" data-open="' + b.ref + '">' + ic('alert') + '<span><b>Stand released ' + when + ': ' + esc(guestName(b)) + ', ' + esc(standById(b.stand).name) + ', ' + fd(b.ci) + '.</b> ' +
        (c ? esc(b.guest.first) + ' says they paid ' + money(c.amt) + ' on ' + fd(c.date) + ', but it is not confirmed yet' : b.holdWhy === 'pop' ? 'Proof of payment was uploaded on ' + fd(popAt(b)) + ', but it is not confirmed yet' : 'The quotation ran out on ' + fdw(depositDue(b)) + ' (over a weekend) and no payment is recorded') + '. Check the bank and press <b>Money is in</b>, or the stand is released automatically.</span>' + ic('chev-r', 'chev') + '</button>';
    }).join('');
    // occupancy next 30 nights
    var occ = []; for (var i = 0; i < 30; i++) { var d = add(TODAY, i), n = Object.keys(standsBookedOn(d)).length, wk = isWeekendNight(d); occ.push({ label: D(d).getDate(), a: n, tip: fdw(d) + ': ' + n + ' of ' + STANDS.length + ' stands booked (' + Math.round(n / STANDS.length * 100) + '%)', hl: wk }); }
    var woodBags = Object.keys(tonight).filter(function (id) { return standById(id).area !== 'self-sufficient'; }).length;
    var drives = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && b.ci <= TODAY && TODAY < b.co; });
    var ice = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.ice && b.ci === TODAY; }).reduce(function (a, b) { return a + b.extras.ice; }, 0);
    return '<div class="hello"><div><h1>' + (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + esc(ME.name) + '</h1><p class="muted">' + fd(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + nT + ' of ' + STANDS.length + ' stands occupied tonight</p></div><div class="hello-acts">' + (can('gate') ? '<a class="btn ghost" href="#/gate">' + ic('clip') + 'Check-in sheet</a>' : '') + '<button class="btn" data-act="new">' + ic('plus') + 'New booking</button></div></div>' +
      '<div class="kpis">' + tile('Arriving today', arr.length, arr.filter(function (b) { return b.status === 'in'; }).length + ' checked in', 'today:arr') + tile('Departing today', dep.length, dep.filter(function (b) { return b.status === 'out'; }).length + ' checked out', 'today:dep') +
      tile('In camp tonight', nT + '<small>/' + STANDS.length + '</small>', Math.round(nT / STANDS.length * 100) + '% occupied', 'calendar') + tile('Awaiting EFT', pend.length, money(pendAmt) + ' to come in', can('eft') ? 'eft' : 'bookings', pend.length ? 'warn' : '') +
      tile('Balances due in 7 days', money(balAmt), balSoon.length + ' booking' + (balSoon.length === 1 ? '' : 's'), can('eft') ? 'eft' : 'bookings') + (can('payments') ? tile('Received this month', money(recv), 'bookings and shop', 'payments', 'ok') : '') + '</div>' +
      (function () {
        var inList = Object.keys(tonight).map(function (id) { return tonight[id]; });
        var lists = { arr: arr, dep: dep, in: inList }, pg = pageOf(lists[DP.tab], DP.tab, 6), at = pageOf(attention, 'attn', 6), ac = pageOf(DB.log.slice().sort(function (a, b) { return String(b.at) > String(a.at) ? 1 : String(b.at) < String(a.at) ? -1 : 0; }), 'act', 7);
        var row = function (b) { var cs = ensureCars(b), n = cs.length, din = cs.filter(function (c) { return c.st === 'in'; }).length, ddue = cs.filter(function (c) { return c.st === 'due'; }).length, cnt = n > 1 ? ' <small>' + (DP.tab === 'arr' ? din : n - din) + '/' + n + '</small>' : '';
          return DP.tab === 'arr' ? rowB(b, b.status === 'pending' ? '<span class="pill info"><i></i>Stand kept, not paid yet</span>' : !ddue ? '<span class="pill ok"><i></i>Checked in</span>' : '<span class="row-act" data-act="checkin" data-ref="' + b.ref + '">' + ic('in') + 'Check in' + cnt + '</span>', etaTxt(b)) : DP.tab === 'dep' ? rowB(b, !din ? '<span class="pill muted"><i></i>Checked out</span>' : '<span class="row-act" data-act="checkout" data-ref="' + b.ref + '">' + ic('out') + 'Check out' + cnt + '</span>') : rowB(b); };
        return '<div class="cols"><section class="card" id="today"><header class="card-h"><h3>Today at camp</h3><div class="tabs" role="tablist">' + [['arr', 'Arriving', arr.length], ['dep', 'Departing', dep.length], ['in', 'In camp', nT]].map(function (x) { return '<button class="' + (DP.tab === x[0] ? 'on' : '') + '" data-dtab="' + x[0] + '">' + x[1] + ' <span>' + x[2] + '</span></button>'; }).join('') + '</div></header>' +
          (pg.items.length ? pg.items.map(row).join('') : '<p class="empty">' + ({ arr: 'No arrivals today.', dep: 'No departures today.', in: 'Nobody in camp tonight.' })[DP.tab] + '</p>') + pg.bar +
          '<footer class="card-f"><span>' + ic('car') + '<b>' + carsInCamp() + '</b> vehicles in camp</span><span>' + ic('fire') + '<b>' + woodBags + '</b> free firewood bags tonight</span><span>' + ic('car') + '<b>' + drives.length + '</b> game drive' + (drives.length === 1 ? '' : 's') + ' booked</span><span>' + ic('ice') + '<b>' + ice + '</b> bags of ice to hand out</span></footer></section>' +
          '<section class="card"><header class="card-h"><h3>Needs attention</h3><span class="count">' + (attention.length + softs.length) + '</span></header>' + softHtml + (attention.length ? '<ul class="attn">' + at.items.map(function (a) { return '<li><button ' + (a.ref ? 'data-open="' + a.ref + '"' : 'data-go="' + a.go + '"') + '><span class="attn-i ' + a.tone + '">' + ic(a.i) + '</span><span>' + a.t + (a.n ? ' <small class="attn-n">' + ic('bell') + esc(a.n) + '</small>' : '') + '</span>' + ic('chev-r', 'chev') + '</button><button type="button" class="attn-x" data-dismiss="' + esc(a.key) + '" aria-label="Done: hide this" title="Done: hide this">' + ic('check') + '</button></li>'; }).join('') + '</ul>' + at.bar : '<p class="empty">All clear. Enjoy the bush!</p>') + '</section></div>' +
          '<div class="cols"><section class="card"><header class="card-h"><h3>Stands booked, next 30 nights</h3><span class="muted small">Weekend nights in bold</span></header>' + colChart(occ, { max: STANDS.length, label: 'Stands booked per night', colA: C_CARD, band: 24 }) + '</section>' +
          '<section class="card"><header class="card-h"><h3>Recent activity</h3><span class="count">' + DB.log.length + '</span></header><ul class="feed">' + ac.items.map(function (l) { return '<li' + (l.ref ? ' data-open="' + l.ref + '"' : '') + '><span>' + esc(l.text) + '</span><small>' + esc(l.by) + ' · ' + esc(atNice(l.at)) + '</small></li>'; }).join('') + '</ul>' + ac.bar + '</section></div>';
      })();
  }

  var F = { q: '', st: 'upcoming', area: '', stand: '', src: '', m: '', from: '', to: '', todo: '', stale: '' };   // todo: one "Still to do" filter (TODO_F); stale '1': not reminded in the last 3 days
  function bucket(b) {
    var s = stateOf(b);
    return { pending: s.k === 'pending' || s.k === 'pop' || s.k === 'overdue' || s.k === 'kept', kept: isKept(b), arrival: s.k === 'arrival', baldue: s.k === 'baldue', in: s.k === 'in', cancelled: s.k === 'cancelled', upcoming: live(b) && b.co >= TODAY && b.status !== 'out', past: b.status === 'out' || (b.co < TODAY && live(b)), all: true };
  }
  function vBookings() {
    var groups = [['upcoming', 'Upcoming'], ['pending', 'Awaiting EFT'], ['kept', 'Stand kept'], ['arrival', 'Pays on arrival'], ['baldue', 'Balance due'], ['in', 'In camp'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['all', 'All']];
    var q = F.q.toLowerCase();
    var base = DB.bookings.filter(function (b) { var st = standById(b.stand); return (!F.area || st.area === F.area) && (!F.stand || b.stand === F.stand) && (!F.src || b.source === F.src) && (!F.m || b.method === F.m) && (!F.from || b.ci >= F.from) && (!F.to || b.ci <= F.to) && bHit(b, q, st.name + (isKept(b) ? ' stand kept' : '') + (b.onArrival && live(b) && balance(b) > 0 ? ' pays on arrival' : '')); });   // typing "kept" or "arrival" finds those bookings
    // "Still to do": one stage at a time (F.todo), and "not reminded in the last 3 days" on top of it (F.stale). Both work together with
    // the status chips and the other filters: each chip counts what it would show with everything else as it is now.
    var hitTodo = function (b) { return (!F.todo || todoHit(b, F.todo)) && (!F.stale || todoStale(b, F.todo)); };
    var base2 = F.todo || F.stale ? base.filter(hitTodo) : base, inSt = base.filter(function (b) { return bucket(b)[F.st]; });
    var counts = {}; groups.forEach(function (g) { counts[g[0]] = 0; }); base2.forEach(function (b) { var k = bucket(b); groups.forEach(function (g) { if (k[g[0]]) counts[g[0]]++; }); });
    var tc = {}; TODO_F.forEach(function (x) { tc[x[0]] = inSt.filter(function (b) { return todoHit(b, x[0]) && (!F.stale || todoStale(b, x[0])); }).length; });
    var nStale = inSt.filter(function (b) { return (!F.todo || todoHit(b, F.todo)) && todoStale(b, F.todo); }).length;
    var list = inSt.filter(hitTodo);
    var srcs = []; DB.bookings.forEach(function (b) { if (srcs.indexOf(b.source) < 0) srcs.push(b.source); }); srcs.sort();
    if (F.st === 'past' || F.st === 'cancelled' || F.st === 'all') list = list.slice().reverse();
    return '<div class="page-h"><div><h1>Bookings</h1><p class="muted">' + list.length + ' shown' + (hasFee() ? ' · card prices include the ' + cardFee() + '% card fee, EFT prices do not' : '') + '</p></div><div class="ph-act"><button class="btn ghost" data-act="csv-bookings">' + ic('download') + 'Export</button><button class="btn" data-act="new">' + ic('plus') + 'New booking</button></div></div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" placeholder="Search name, ref, phone or stand" value="' + esc(F.q) + '" data-f="q" aria-label="Search bookings"></label>' +
      '</div>' + (function () { var nAct = ['area', 'stand', 'src', 'm', 'from', 'to', 'todo', 'stale'].filter(function (k) { return F[k]; }).length; return '<details class="more-filters"' + (window.innerWidth > 760 || nAct ? ' open' : '') + '><summary>' + ic('list') + 'Filters' + (nAct ? ' (' + nAct + ')' : '') + '</summary>'; })() + '<div class="filter-row">' + fsel('F:area', F.area, [['', 'All areas']].concat(Object.keys(AREA_SHORT).map(function (a) { return [a, AREA_SHORT[a]]; }))) +
      fsel('F:stand', F.stand, [['', 'All stands']].concat(STANDS.filter(function (x) { return !F.area || x.area === F.area; }).map(function (x) { return [x.id, x.name]; }))) +
      fsel('F:src', F.src, [['', 'Booked via: any']].concat(srcs.map(function (x) { return [x, 'Booked via ' + x]; }))) + fsel('F:m', F.m, [['', 'Pays by: any'], ['card', 'Pays by card'], ['eft', 'Pays by EFT']]) +
      '<span class="frange"><label class="fdate"><span>Arriving from</span><input type="date" data-fk="F:from" value="' + F.from + '"' + (F.from ? ' class="on"' : '') + '></label><label class="fdate"><span>to</span><input type="date" data-fk="F:to" value="' + F.to + '"' + (F.to ? ' class="on"' : '') + '></label></span>' + fclear('F', ['area', 'stand', 'src', 'm', 'from', 'to', 'todo', 'stale']) + '</div></details>' +
      '<div class="chips scroll">' + groups.filter(function (g) { return (g[0] !== 'kept' && g[0] !== 'arrival') || counts[g[0]] || F.st === g[0]; }).map(function (g) { return '<button class="chip' + (F.st === g[0] ? ' on' : '') + '" data-fst="' + g[0] + '">' + g[1] + ' <span>' + counts[g[0]] + '</span></button>'; }).join('') + '</div>' +
      '<div class="chips todo-f" role="group" aria-label="Still to do"><span class="chips-l">Still to do</span>' + TODO_F.map(function (x) { return '<button class="chip' + (F.todo === x[0] ? ' on' : '') + '" data-ftodo="' + x[0] + '" aria-pressed="' + (F.todo === x[0]) + '">' + x[1] + ' <span>' + tc[x[0]] + '</span></button>'; }).join('') +
      '<button class="chip' + (F.stale ? ' on' : '') + '" data-fstale="1" aria-pressed="' + !!F.stale + '" title="Something is still to do, and the guest was not reminded about it in the last ' + NUDGE_DAYS + ' days">' + ic('bell') + 'Not reminded in the last ' + NUDGE_DAYS + ' days <span>' + nStale + '</span></button></div>' +
      '<div class="card flush bk-card"><table class="tbl bk"><thead><tr><th>Guest</th><th>Stand</th><th>Dates</th><th>Guests</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th><th>Still to do</th><th>Last reminded</th><th class="r"></th></tr></thead><tbody>' +
      (list.length ? list.map(function (b) {
        var st = standById(b.stand), sg = stageOf(b), nc = nudgeCell(b, F.todo);
        return '<tr data-open="' + b.ref + '" tabindex="0"><td data-l="Guest"><b>' + esc(guestName(b)) + '</b>' + (b.isNew ? ' <span class="new">New</span>' : '') + (isKept(b) ? ' <span class="tag-kept" title="' + KEPT_TXT + '">' + ic('lock') + 'Kept</span>' : '') + (staysBefore(b) ? ' <span class="ret-dot" title="Returning client">' + ic('return') + '</span>' : '') + '<small>' + esc(b.ref) + ' · ' + esc(b.source) + '</small></td><td data-l="Stand">' + esc(st.name) + '<small>' + AREA_SHORT[st.area] + '</small></td>' +
          '<td data-l="Dates" data-s="' + b.ci + '">' + fd(b.ci) + ' to ' + fd(b.co) + '<small>' + diff(b.ci, b.co) + ' night' + (diff(b.ci, b.co) === 1 ? '' : 's') + ' · ' + (b.ci > TODAY ? 'arrives ' + rel(b.ci) : b.ci === TODAY ? 'arrives today' : b.co > TODAY ? 'in camp' : 'left ' + rel(b.co)) + '</small></td><td data-l="Guests">' + people(b) + '</td>' +
          '<td data-l="Total" class="r">' + money(b.total) + '<small>' + methodLabel(b.method) + (b.method !== 'card' && hasFee() ? ' · card ' + money(b.card) : '') + '</small></td><td data-l="Balance" class="r">' + (balance(b) ? money(balance(b)) : '<span class="muted">0</span>') + '</td><td data-l="Status">' + pill(stateOf(b)) + '</td>' +
          '<td data-l="Still to do" class="td-todo" data-s="' + (sg.on ? sg.left.length : -1) + '">' + todoCell(b) + '</td><td data-l="Last reminded" class="td-nudge" data-s="' + nc.s + '">' + nc.h + '</td>' +
          '<td data-l="Actions" class="r td-acts">' + (sg.on ? '<button type="button" class="icon-btn sm" data-act="row-copy" data-ref="' + b.ref + '" title="' + (sg.fin ? 'Copy booking link' : 'Copy finalise link') + '" aria-label="' + (sg.fin ? 'Copy booking link' : 'Copy finalise link') + ' for ' + esc(guestName(b)) + '">' + ic('clip') + '</button><button type="button" class="icon-btn sm" data-act="row-menu" data-ref="' + b.ref + '" aria-haspopup="menu" aria-expanded="false" title="Send or copy" aria-label="Send or copy for ' + esc(guestName(b)) + '">' + ic('more') + '</button>' : '') + '</td></tr>';
      }).join('') : '<tr><td colspan="10" class="empty">No bookings match.</td></tr>') + '</tbody></table></div>';
  }

  function holdTxtOf(b) {
    if (b.noRelease) return '<b>' + KEPT_TXT + '.</b> ' + (payFullOf(b) ? 'The full amount of' : 'A deposit of') + ' <b>' + money(Math.max(0, deposit(b) - paid(b))) + '</b> is still to pay. The quotation ' + (TODAY > depositDue(b) ? 'ran out on ' : 'is valid until ') + '<b>' + fdw(depositDue(b)) + '</b>, but the stand stays theirs until you switch this off or cancel the booking.' + (b.pop || b.paidClaim ? ' ' + esc(b.guest.first) + ' says it is paid: check the bank.' : '');
    var h = holdOf(b); if (h.state === 'paid') h = { state: 'held', due: depositDue(b), until: depositDue(b), why: 'quote' };
    var end = '<b>' + keptEnd(h.until) + '</b>', pa = popAt(b);
    if (h.why === 'pop') return '<b>Proof of payment uploaded ' + fd(pa) + '.</b> The stand is kept until ' + end + ' (' + holdRules().popDays + ' days after the upload) while you check the bank. The guest is only told we are checking and keeping their stand. Press Money is in once it shows, or the stand is released after that.';
    if (h.state === 'soft') return '<b>' + esc(b.guest.first) + ' says they paid.</b> The stand is kept until ' + end + ' while you check the bank. Confirm the payment, or the stand is released automatically.';
    if (h.state === 'grace') return '<b>The quotation ran out on ' + fdw(h.due) + '.</b> That was over a weekend, so the stand is kept until ' + end + '. Record the payment if it came in, or the stand is released automatically.';
    return 'Quotation valid until <b>' + fdw(h.due) + '</b> (' + rel(h.due) + '). ' + (payFullOf(b) ? 'The full amount' : 'A deposit of') + ' <b>' + money(deposit(b)) + '</b> secures the stand.' + (paid(b) > 0 ? ' ' + money(paid(b)) + ' is already paid, so <b>' + money(Math.max(0, deposit(b) - paid(b))) + '</b> is still needed.' : '') + (h.why === 'weekend' ? ' It runs out over a weekend, so the stand is kept until ' + end + '.' : '');
  }
  var EF = { sort: '' };   // EFT payments: '' = by date due, 'nudge' = by last reminded
  function vEft() {
    var pend =DB.bookings.filter(function (b) { return b.status === 'pending'; });
    var pop = pend.filter(function (b) { return b.pop; }), over = pend.filter(function (b) { return !b.pop && !b.noRelease && TODAY > depositDue(b); }), wait = pend.filter(function (b) { return !b.pop && (b.noRelease || TODAY <= depositDue(b)); });   // kept for the guest (b.noRelease): waits, is never overdue for release
    var bal = DB.bookings.filter(function (b) { return b.status === 'confirmed' && b.method !== 'card' && balance(b) > 0 && (diff(TODAY, balanceDue(b)) <= 14 || b.paidClaim); }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    // EF.sort 'nudge': in every section, the guest who was reminded longest ago (or never) comes first
    if (EF.sort === 'nudge') [pop, over, wait, bal].forEach(function (l) { l.sort(function (a, b) { var x = nudgeOf(a, 'pay'), y = nudgeOf(b, 'pay'), xs = x ? String(x.at) : '', ys = y ? String(y.at) : ''; return xs < ys ? -1 : xs > ys ? 1 : 0; }); });
    function card(b, kind) {
      var amt = kind === 'bal' ? balance(b) : deposit(b), due = kind === 'bal' ? balanceDue(b) : depositDue(b), left = diff(TODAY, due);
      var stale = kind !== 'pop' && !b.paidClaim && left < 0 && nudgeStale(b, 'pay');   // overdue, and not reminded in the last 3 days: a soft highlight
      return '<article class="eft-card ' + kind + (stale ? ' stale' : '') + '" data-eft="' + b.ref + '"><div class="eft-top" data-open="' + b.ref + '"><div><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + ' · ' + fd(b.ci) + ' to ' + fd(b.co) + '</small></div><div class="eft-amt"><b>' + money(amt) + '</b><small>' + (kind === 'bal' ? 'balance' : payFullOf(b) ? 'full amount (arrives soon)' : depPct() + '% deposit') + (hasFee() ? ' · card ' + money(kind === 'bal' ? b.card - paid(b) : Math.round(b.card * depPct() / 100)) : '') + '</small></div></div>' +
        '<div class="eft-due ' + (kind !== 'bal' && b.noRelease ? 'info-t' : left < 0 ? 'bad-t' : left <= 1 ? 'warn-t' : '') + '">' + ic('clock') + (kind !== 'bal' && b.noRelease ? '<b>' + KEPT_TXT + '.</b> The quotation ' + (left < 0 ? 'ran out on ' : 'is valid until ') + fd(due) + ' (' + rel(due) + ')' : b.softHold && kind !== 'bal' ? '<b>Kept until ' + keptEnd(b.softHold) + '.</b> Confirm the payment, or the stand is released' : kind !== 'bal' && holdOf(b).until > due ? 'Due ' + fd(due) + ' (' + rel(due) + '). Stand kept until ' + keptEnd(holdOf(b).until) + (holdOf(b).why === 'pop' ? ' (proof of payment)' : ' (not over a weekend)') : left < 0 ? 'Overdue by ' + -left + ' day' + (-left > 1 ? 's' : '') : 'Due ' + fd(due) + ' (' + rel(due) + ')') + (b.paidClaim ? '<span class="info-t pop-line">' + ic('bank') + esc(b.guest.first) + ' says they paid ' + money(b.paidClaim.amt) + ' on ' + fd(b.paidClaim.date) + ': check the bank</span>' : '') + (b.pop && (b.pops || []).length ? '<span class="info-t pop-line">' + ic('note') + 'Proof of payment received' + ((b.pops || []).length ? ' ' + whenSaid(b.pops[b.pops.length - 1].at) + ', check the bank:' : ': check the bank') + '</span>' + popChips(b) : '') + '</div>' +
        '<div class="eft-nudge' + (stale ? ' stale' : '') + '"><span class="eft-nl">Last reminded</span>' + nudgeNote(b, 'pay') + (stale ? '<span class="eft-late">Overdue: time to remind</span>' : '') + '</div>' +
        '<div class="eft-act"><button class="btn sm" data-act="pay" data-ref="' + b.ref + '">' + ic('check') + 'Money is in</button><button class="btn sm ghost" data-act="remind" data-kind="pay" data-ref="' + b.ref + '">' + ic('send') + 'Remind</button>' + (kind === 'over' || (kind === 'pop' && TODAY > depositDue(b)) ? '<button class="btn sm ghost danger-t" data-act="release" data-ref="' + b.ref + '">' + ic('x') + 'Release stand</button>' : '') + '</div></article>';
    }
    var sec = function (title, sub, list, kind) { return '<section class="eft-sec"><h3>' + title + ' <span class="count">' + list.length + '</span></h3><p class="muted small">' + sub + '</p>' + (list.length ? '<div class="eft-grid">' + list.map(function (b) { return card(b, kind); }).join('') + '</div>' : '<p class="empty">Nothing here.</p>') + '</section>'; };
    return '<div class="page-h"><div><h1>EFT payments</h1><p class="muted">' + (hasFee() ? 'Guests who chose EFT pay the normal price (no ' + cardFee() + '% card fee). ' : 'Guests pay by EFT. Proof of payment from the website lands here. ') + 'Match their payments here.</p></div><div class="ph-act">' + fsel('EF:sort', EF.sort, [['', 'Sort by date due'], ['nudge', 'Sort by last reminded: longest ago first']], 'Sort the payments') + '</div></div>' +
      '<div class="card match"><label class="search big">' + ic('search') + '<input data-match placeholder="Paste the reference from the bank statement, e.g. KY26 5903" aria-label="Bank reference"></label><div data-match-out class="muted small">Tip: guests use their booking reference when they pay, so you can paste it straight from the bank app.</div></div>' +
      sec('Proof of payment received', 'The guest says they paid. Check the bank, then confirm.', pop, 'pop') +
      sec('Waiting for payment', 'Quotation sent. It holds the stand for ' + num('Booking rules', 'Deposit due within days of invoice', 5) + ' days; after that the stand is released automatically' + (holdRules().skip !== 'off' ? ', never over a weekend.' : '.'), wait, 'wait') +
      sec('Overdue', 'Past the deadline. Send a last reminder or release the stand for other guests.', over, 'over') +
      sec('EFT balances due soon', 'Balances are due ' + num('Booking rules', 'Balance due days before arrival', 7) + ' days before arrival.', bal, 'bal');
  }

  var CAL = { start: null, days: 21, area: '' };
  function vCalendar() {
    if (!CAL.start) CAL.start = add(TODAY, -2);
    var days = window.innerWidth < 700 ? 21 : CAL.days, s = CAL.start, e = add(s, days), cols = [];
    for (var i = 0; i < days; i++) cols.push(add(s, i));
    var head = '<div class="cal-row cal-head"><div class="cal-name">Stand</div>' + cols.map(function (d) { var dd = D(d); return '<div class="cal-day' + (d === TODAY ? ' today' : '') + (isWeekendNight(d) ? ' wk' : '') + '"><small>' + dd.toLocaleDateString('en-ZA', { weekday: 'short' }) + '</small><b>' + dd.getDate() + '</b></div>'; }).join('') + '</div>';
    var rows = ['fenced', 'unfenced', 'self-sufficient'].filter(function (a) { return !CAL.area || a === CAL.area; }).map(function (a) {
      return '<div class="cal-group">' + AREA_SHORT[a] + '</div>' + STANDS.filter(function (st) { return st.area === a; }).map(function (st) {
        var cells = cols.map(function (d, i) { return '<button class="cal-cell' + (d === TODAY ? ' today' : '') + (isWeekendNight(d) ? ' wk' : '') + '" style="grid-column:' + (i + 2) + '" data-newat="' + st.id + '|' + d + '" aria-label="New booking ' + esc(st.name) + ' ' + d + '"></button>'; }).join('');
        var bars = DB.bookings.filter(function (b) { return live(b) && b.stand === st.id && b.ci < e && s < b.co; }).map(function (b) {
          var a0 = b.ci < s ? s : b.ci, z = b.co > e ? e : b.co, c0 = diff(s, a0) + 2, span = diff(a0, z) + (b.co >= e ? 0 : 1), stt = stateOf(b);
          return '<button class="cal-bar ' + stt.tone + (b.ci < s ? ' cut-l' : '') + (b.co >= e ? ' cut-r' : '') + '" style="grid-column:' + c0 + ' / span ' + span + '" data-open="' + b.ref + '" title="' + esc(guestName(b) + ' · ' + fd(b.ci) + ' to ' + fd(b.co) + ' · ' + stt.t) + '"><span>' + esc(b.guest.last) + '</span></button>';
        }).join('');
        var blocks = DB.blocks.filter(function (k) { return k.stand === st.id && k.from < e && s < k.to; }).map(function (k) {
          var a0 = k.from < s ? s : k.from, z = k.to > e ? e : k.to, c0 = diff(s, a0) + 2, span = diff(a0, z) + (k.to >= e ? 0 : 1);
          return '<div class="cal-bar block' + (k.from < s ? ' cut-l' : '') + (k.to >= e ? ' cut-r' : '') + '" style="grid-column:' + c0 + ' / span ' + span + '" title="' + esc(k.reason) + '"><span>' + esc(k.reason) + '</span></div>';
        }).join('');
        return '<div class="cal-row"><div class="cal-name"><b>' + esc(st.name) + '</b><small title="' + sizeTxt(st) + '">' + st.guests + ' guests</small></div>' + cells + bars + blocks + '</div>';
      }).join('');
    }).join('');
    return '<div class="page-h"><div><h1>Calendar</h1><p class="muted">' + fd(s, { day: 'numeric', month: 'long' }) + ' to ' + fd(add(e, -1), { day: 'numeric', month: 'long', year: 'numeric' }) + ' · tap an empty night to book it</p></div><div class="ph-act">' + fsel('CAL:area', CAL.area, [['', 'All areas']].concat(Object.keys(AREA_SHORT).map(function (a) { return [a, AREA_SHORT[a]]; }))) + '<button class="icon-btn" data-cal="-7" aria-label="Previous week">' + ic('chev-l') + '</button><button class="btn ghost sm" data-cal="0">Today</button><button class="icon-btn" data-cal="7" aria-label="Next week">' + ic('chev-r') + '</button></div></div>' +
      '<div class="legend"><span><i class="lg info"></i>Deposit paid</span><span><i class="lg ok"></i>Paid in full / in camp</span><span><i class="lg warn"></i>Awaiting EFT or balance due</span><span><i class="lg bad"></i>Overdue</span><span><i class="lg block"></i>Blocked</span><span><i class="lg out"></i>Checked out</span></div><p class="cal-swipe muted small">' + ic('info') + ' Swipe sideways to see more days.</p>' +
      '<div class="card flush cal-wrap"><div class="cal" style="--days:' + days + '">' + head + rows + '</div></div>';
  }

  function guestsList() {
    return DB.clients.map(function (c) { var s = clientStats(c); return Object.assign(s, { id: c.id, name: clientName(c), email: c.email, phone: c.phone, consent: c.consent, town: c.town, notes: c.notes, created: c.created }); }).sort(function (a, b) { return b.spent - a.spent; });
  }
  var GQ = '', GF = { tag: '', area: '' };
  var GTAGS = [['', 'All clients', function () { return true; }], ['ret', 'Returning', function (g) { return g.stays > 1; }], ['first', 'First-timers', function (g) { return g.stays === 1; }], ['now', 'In camp now', function (g) { return g.now; }], ['next', 'Coming up', function (g) { return g.next; }], ['mail', 'On the mailing list', function (g) { return g.consent; }], ['pens', 'Pensioners', function (g) { return g.pens; }], ['gd', 'Game drives', function (g) { return g.gd; }], ['none', 'No stay yet', function (g) { return !g.stays; }]];
  function vClients() {
    var all = guestsList(), q = GQ.toLowerCase(), qd = normPhone(GQ), tagF = GTAGS.filter(function (t) { return t[0] === GF.tag; })[0] || GTAGS[0];
    var list = all.filter(function (g) { return tagF[2](g) && (!q || (g.name + ' ' + g.email + ' ' + g.phone + ' ' + (g.town || '')).toLowerCase().indexOf(q) >= 0 || (qd.length >= 3 && normPhone(g.phone).indexOf(qd) >= 0)); });
    var booked = all.filter(function (g) { return g.stays; }).length, ret = all.filter(function (g) { return g.stays > 1; }).length;
    return '<div class="page-h"><div><h1>Clients</h1><p class="muted">Everyone who has booked with Kyleu. Tap a client to see their stays or change their details.</p></div><div class="ph-act"><button class="btn ghost" data-act="csv-guests">' + ic('download') + 'Export mailing list</button><button class="btn" data-act="client-add">' + ic('plus') + 'Add client</button></div></div>' +
      '<div class="kpis">' + tile('Clients', all.length, all.filter(function (g) { return g.stays === 1; }).length + ' first-timers') + tile('Returning clients', ret, (booked ? Math.round(ret / booked * 100) : 0) + '% came back for another stay', null, 'ok') +
      tile('Returning soon', all.filter(function (g) { return g.next && g.stays > 1; }).length, 'returning clients with a stay booked') + tile('On the mailing list', all.filter(function (g) { return g.consent; }).length, 'agreed to news and specials') + '</div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-gq placeholder="Search name, mobile, email or town" value="' + esc(GQ) + '" aria-label="Search clients"></label></div>' +
      '<div class="chips scroll">' + GTAGS.map(function (t) { return '<button class="chip' + (GF.tag === t[0] ? ' on' : '') + '" data-gtag="' + t[0] + '">' + t[1] + ' <span>' + all.filter(t[2]).length + '</span></button>'; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl"><thead><tr><th>Client</th><th>Contact</th><th class="r">Stays</th><th class="r">Nights</th><th class="r">Spent</th><th>Last / next visit</th><th>Tags</th></tr></thead><tbody>' +
      (list.length ? list.map(function (g) {
        var tags = (g.pens ? '<span class="tag">Pensioner</span>' : '') + (g.gd ? '<span class="tag">Game drives</span>' : '') + (g.consent ? '<span class="tag ok">Mailing list</span>' : '') + (creditLeft(g.email) ? '<span class="tag">Credit ' + money(creditLeft(g.email)) + '</span>' : '') + (g.notes ? '<span class="tag" title="' + esc(g.notes) + '">' + ic('note') + 'Notes</span>' : '');
        return '<tr data-client="' + g.id + '" tabindex="0"><td data-l="Client"><b>' + esc(g.name) + '</b>' + (g.stays > 1 ? ' <span class="pill ok ret">' + ic('return') + 'Returning</span>' : '') + (g.town ? '<small>' + esc(g.town) + '</small>' : '') + '</td><td data-l="Contact">' + esc(g.phone || '') + '<small>' + esc(g.email || '') + '</small></td><td data-l="Stays" class="r">' + g.stays + '</td><td data-l="Nights" class="r">' + g.nights + '</td><td data-l="Spent" class="r">' + money(g.spent) + '</td><td data-l="Visits" data-s="' + (g.next || g.last || '') + '">' + (g.last ? fd(g.last, { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="muted">None yet</span>') + (g.next ? '<small>Next: ' + fd(g.next) + '</small>' : '') + '</td><td data-l="Tags">' + (tags || '<span class="muted">None</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">No clients match.</td></tr>') + '</tbody></table></div>';
  }
  function openGuest(key) { var c = clientById(key) || findClient(key, key); if (c) openClient(c.id); }
  function openClient(id) {
    var c = clientById(id); if (!c) return; var s = clientStats(c), bs = clientBookings(c), cr = creditLeft(c.email);
    var ts = c.email ? DB.threads.filter(function (t) { return normEmail(t.email) === normEmail(c.email); }) : [];
    var wa = c.phone ? '27' + normPhone(c.phone).replace(/^0/, '') : '';
    modal(esc(clientName(c)),
      '<div class="cl-top">' + retPill(s.stays) + (s.now ? '<span class="pill ok"><i></i>In camp now</span>' : '') + (s.next ? '<span class="pill info"><i></i>Next stay ' + fd(s.next) + '</span>' : '') + '</div>' +
      '<div class="mini-kpis"><div><b>' + s.stays + '</b><span>stay' + (s.stays === 1 ? '' : 's') + '</span></div><div><b>' + s.nights + '</b><span>nights</span></div><div><b>' + money(s.spent) + '</b><span>paid</span></div></div>' +
      '<dl class="kv cl-kv"><dt>Mobile</dt><dd>' + (c.phone ? esc(c.phone) : '<span class="muted">Not given</span>') + (c.phone2 ? '<br>' + esc(c.phone2) + ' <span class="muted small">(other)</span>' : '') + '</dd>' +
      '<dt>Email</dt><dd>' + (c.email ? esc(c.email) : '<span class="muted">Not given</span>') + '</dd>' +
      '<dt>Town</dt><dd>' + (c.town ? esc(c.town) : '<span class="muted">Not given</span>') + '</dd>' +
      '<dt>Client since</dt><dd>' + fd(c.created.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }) + '</dd>' +
      '<dt>Mailing list</dt><dd>' + (c.consent ? 'Yes, agreed to news and specials' : 'No') + '</dd></dl>' +
      (c.notes ? '<p class="cl-note">' + ic('note') + '<span>' + esc(c.notes) + '</span></p>' : '') +
      (cr ? '<p class="callout"><b>' + money(cr) + ' credit</b> to use on another stay. It is offered on their next booking.<br>' + creditList(c.email, '<br>') + '</p>' : '') +
      '<div class="chips">' + (c.phone ? '<a class="chip" href="tel:' + esc(c.phone.replace(/\s/g, '')) + '">' + ic('phone') + 'Call</a><a class="chip" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + ic('wa') + 'WhatsApp</a>' : '') + (c.email ? '<button type="button" class="chip" data-act="client-mail" data-ref="' + c.id + '">' + ic('mail') + 'Email</button>' : '') + '</div>' +
      '<h5>Stays</h5>' + (bs.length ? '<div class="list">' + bs.map(function (b) { return '<button type="button" class="brow" data-open="' + b.ref + '"><span class="brow-st">' + esc(standById(b.stand).name) + '</span><span class="brow-g"><b>' + fd(b.ci, { day: 'numeric', month: 'short', year: 'numeric' }) + '</b><small>' + esc(b.ref) + ' · ' + diff(b.ci, b.co) + ' night' + (diff(b.ci, b.co) === 1 ? '' : 's') + ' · ' + people(b) + ' guests · ' + money(b.total) + '</small></span>' + pill(stateOf(b)) + '</button>'; }).join('') + '</div>' : '<p class="muted small">No bookings yet.</p>') +
      '<h5>Emails</h5>' + (ts.length ? '<div class="list">' + ts.map(function (t) { return '<button type="button" class="brow" data-thread-go="' + t.id + '"><span class="brow-g"><b>' + esc(t.subject) + '</b><small>' + t.msgs.length + ' email' + (t.msgs.length > 1 ? 's' : '') + ' · last ' + when(lastMsg(t).at) + '</small></span>' + ic('chev-r') + '</button>'; }).join('') + '</div>' : '<p class="muted small">No emails yet.</p>') +
      '<div class="m-acts"><button type="button" class="btn ghost" data-act="client-edit" data-ref="' + c.id + '">' + ic('edit') + 'Edit details</button><button type="button" class="btn" data-act="client-book" data-ref="' + c.id + '">' + ic('plus') + 'New booking</button></div>',
      null, null, { wide: true, noFocus: true });
  }
  function actClient(id, reopen) {
    var c = id ? clientById(id) : null, d = c || { first: '', last: '', email: '', phone: '', phone2: '', town: '', notes: '', consent: false }, n = c ? clientBookings(c).length : 0;
    modal(c ? 'Edit ' + esc(clientName(c)) : 'Add a client',
      (n ? '<p class="hint">' + ic('info') + ' Changes show on ' + (n === 1 ? 'their booking' : 'all ' + n + ' of their bookings') + ' too.</p>' : '') +
      '<div class="grid2"><label class="fld"><span>First name</span><input name="first" value="' + esc(d.first) + '"></label><label class="fld"><span>Surname</span><input name="last" value="' + esc(d.last) + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Mobile</span><input name="phone" inputmode="tel" value="' + esc(d.phone) + '"></label><label class="fld"><span>Other number</span><input name="phone2" inputmode="tel" value="' + esc(d.phone2 || '') + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Email</span><input name="email" type="email" value="' + esc(d.email) + '"></label><label class="fld"><span>Town</span><input name="town" value="' + esc(d.town || '') + '" placeholder="e.g. Pretoria"></label></div>' +
      '<label class="fld"><span>Client notes (staff only, shown on every booking)</span><textarea name="notes" rows="3" placeholder="e.g. Likes Stand 6, brings two dogs on a lead, prefers WhatsApp">' + esc(d.notes || '') + '</textarea></label>' +
      '<label class="check"><input type="checkbox" name="consent"' + (d.consent ? ' checked' : '') + '><span>Agreed to receive news and specials (POPIA consent)</span></label><p class="hint" data-dup></p>',
      c ? 'Save changes' : 'Add client', function (f) {
        var v = { first: fval(f, 'first'), last: fval(f, 'last'), email: fval(f, 'email'), phone: fval(f, 'phone'), phone2: fval(f, 'phone2'), town: fval(f, 'town'), notes: fval(f, 'notes'), consent: fval(f, 'consent') };
        if (!v.first || !v.last) { toast('Add a first name and surname'); return false; }
        if (!v.phone && !v.email) { toast('Add a mobile number or an email address'); return false; }
        if (v.email && !/.+@.+\..+/.test(v.email)) { toast('That email address does not look right'); return false; }
        var dup = findClient(v.email, v.phone, c && c.id); if (dup) { toast(esc(clientName(dup)) + ' already has that ' + (v.email && normEmail(dup.email) === normEmail(v.email) ? 'email address' : 'number')); return false; }
        if (c) { var cc = clientChanges(c, v); if (!cc.length) { toast('Nothing was changed'); return; } applyClient(c, v); log('Client ' + clientName(c) + ' updated: ' + cc.join('; ')); }
        else { c = newClient(v); log('Added client ' + clientName(c)); }
        save(); refresh(); toast(id ? 'Client details saved' : 'Client added');
        if (reopen !== false) { var cid = c.id; setTimeout(function () { openClient(cid); }, 0); }
      }, { wide: true, onOpen: function (f) {
        var u = function () { var dp = findClient(fval(f, 'email'), fval(f, 'phone'), c && c.id); $('[data-dup]', f).innerHTML = dp ? '<span class="warn-t">' + ic('alert') + ' ' + esc(clientName(dp)) + ' already has this ' + (fval(f, 'email') && normEmail(dp.email) === normEmail(fval(f, 'email')) ? 'email address' : 'number') + '.</span> <button type="button" class="link-btn" data-client="' + dp.id + '">Open their card</button>' : ''; };
        ['email', 'phone'].forEach(function (k) { f.elements[k].addEventListener('input', u); }); u();
      } });
  }

  var STF = { q: '', area: '', state: '' };
  function vStands() {
    var tonight = standsBookedOn(TODAY), sq = STF.q.toLowerCase();
    var keep = function (s) { var cl = DB.closed[s.id], busy = !!tonight[s.id]; return (!sq || (s.name + ' ' + (s.feel || '') + ' ' + (s.highlights || []).join(' ')).toLowerCase().indexOf(sq) >= 0) && (!STF.state || (STF.state === 'open' ? !cl : STF.state === 'closed' ? cl : STF.state === 'free' ? !cl && !busy : STF.state === 'busy' ? busy : (s.photos || []).length === 0)); };
    return '<div class="page-h"><div><h1>Stands & blocks</h1><p class="muted">' + STANDS.length + ' stands. Add, copy or remove stands and change their photos and details.</p></div><div class="ph-act"><button class="btn ghost" data-act="block">' + ic('lock') + 'Block dates</button><button class="btn" data-act="stand-add">' + ic('plus') + 'Add a stand</button></div></div>' +
      '<section class="card"><header class="card-h"><h3>Blocked dates</h3><span class="muted small">Maintenance, owner holds, private events</span></header>' + (DB.blocks.length ? '<ul class="feed">' + DB.blocks.map(function (k) { return '<li><span><b>' + esc(standById(k.stand).name) + '</b> · ' + fd(k.from) + ' to ' + fd(k.to) + ' · ' + esc(k.reason) + '</span><button class="btn sm ghost" data-unblock="' + k.id + '">Remove</button></li>'; }).join('') + '</ul>' : '<p class="empty">No blocks.</p>') + '</section>' +
      '<div class="filters">' + fsearch('STF:q', STF.q, 'Search stands') + fsel('STF:area', STF.area, [['', 'All areas']].concat(Object.keys(AREA_SHORT).map(function (a) { return [a, AREA_SHORT[a]]; }))) + fsel('STF:state', STF.state, [['', 'Any status'], ['free', 'Free tonight'], ['busy', 'Occupied tonight'], ['open', 'Open for bookings'], ['closed', 'Closed to bookings'], ['nophoto', 'Without photos']]) + fclear('STF', ['q', 'area', 'state']) + '</div>' +
      ['fenced', 'unfenced', 'self-sufficient'].filter(function (a) { return !STF.area || a === STF.area; }).map(function (a) {
        var list = STANDS.filter(function (s) { return s.area === a && keep(s); });
        if (!list.length && (STF.q || STF.state)) return '';
        return '<h3 class="grp">' + AREA_SHORT[a] + ' <small>' + list.length + '</small></h3><div class="stand-grid">' + list.map(function (s) {
          var b = tonight[s.id], nxt = DB.bookings.filter(function (x) { return live(x) && x.stand === s.id && x.ci > TODAY; })[0], closed = DB.closed[s.id], n = (s.photos || []).length;
          return '<article class="stand' + (closed ? ' closed' : '') + '"><button type="button" class="stand-ph" data-act="stand-edit" data-ref="' + esc(s.id) + '" aria-label="Edit ' + esc(s.name) + '">' + (n ? '<img src="' + esc(imgSrc(s.photos[0])) + '" alt="" loading="lazy">' : '<span class="ph">No photo yet</span>') + '<span class="ph-n">' + n + ' photo' + (n === 1 ? '' : 's') + '</span>' + (s.status === 'new' ? '<span class="ph-new">New</span>' : '') + '</button>' +
            '<div class="stand-b"><b>' + esc(s.name) + '</b><small>' + sizeTxt(s) + ' guests' + (s.setups ? ' · ' + esc(s.setups) : '') + '</small>' +
            '<p class="small">' + (closed ? '<span class="pill muted"><i></i>Closed to bookings</span>' : b ? 'Tonight: <a href="#" data-open="' + b.ref + '">' + esc(guestName(b)) + '</a>' : '<span class="ok-t">Free tonight</span>') + (nxt ? '<br><span class="muted">Next: ' + fd(nxt.ci) + ', ' + esc(nxt.guest.last) + '</span>' : '') + '</p>' +
            '<label class="switch"><input type="checkbox" data-close-stand="' + s.id + '"' + (closed ? '' : ' checked') + '><span></span>Open for bookings</label>' +
            '<div class="stand-act"><button class="btn sm ghost" data-act="stand-edit" data-ref="' + esc(s.id) + '">Edit</button><button class="btn sm ghost" data-act="stand-copy" data-ref="' + esc(s.id) + '">Copy</button><button class="icon-btn sm" data-act="stand-del" data-ref="' + esc(s.id) + '" aria-label="Remove ' + esc(s.name) + '" title="Remove stand">' + ic('x') + '</button></div></div></article>';
        }).join('') + (list.length ? '' : '<p class="empty">No stands in this area.</p>') + '</div>';
      }).join('') +
      '<p class="demo-note">' + ic('info') + 'Demo: changes are kept in this browser only. In the live version, saving a stand here updates the website straight away, so content/stands.md is no longer needed.</p>';
  }

  /* add / edit / copy a stand. EDIT holds the photos while the form is open. */
  var EDIT = null;
  function allPhotos() { var seen = {}, out = []; STANDS.forEach(function (s) { (s.photos || []).forEach(function (p) { if (!seen[p] && !/^data:/.test(p)) { seen[p] = 1; out.push(p); } }); }); return out; }
  function phGrid() {
    return EDIT.photos.length ? EDIT.photos.map(function (p, i) {
      return '<figure class="ph-it"><img src="' + esc(imgSrc(p)) + '" alt="">' + (i ? '<button type="button" class="ph-b cov" data-ph-cover="' + i + '">Make cover</button>' : '<span class="ph-tag">Cover</span>') + '<button type="button" class="ph-b del" data-ph-del="' + i + '" aria-label="Remove this photo">' + ic('x') + '</button></figure>';
    }).join('') : '<p class="muted small ph-none">No photos yet. Upload some or pick from the website\'s photos below.</p>';
  }
  function phRefresh() { var g = $('[data-ph-grid]'); if (g) g.innerHTML = phGrid(); $$('[data-ph-pick]').forEach(function (b) { b.classList.toggle('on', EDIT.photos.indexOf(b.dataset.phPick) >= 0); }); }
  // shrink a photo before keeping it (phones take huge photos)
  function shrink(file, cb) {
    if (!/^image\//.test(file.type)) { toast('That file is not a photo'); return; }
    var rd = new FileReader();
    rd.onload = function () { var im = new Image(); im.onload = function () { var s = Math.min(1, 1100 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .78)); }; im.onerror = function () { toast('That photo could not be opened'); }; im.src = rd.result; };
    rd.readAsDataURL(file);
  }
  function actStand(id, copyFrom) {
    var isNew = !id, src = id ? standById(id) : copyFrom ? standById(copyFrom) : null;
    EDIT = { id: id, photos: src ? (src.photos || []).slice() : [] };
    var val = function (k) { return src && src[k] != null ? esc(src[k]) : ''; };
    var area = src ? src.area : 'fenced';
    var body = (isNew ? '<label class="fld"><span>Copy details from</span><select data-copy-from><option value="">Nothing, start blank</option>' + STANDS.map(function (s) { return '<option value="' + esc(s.id) + '"' + (s.id === copyFrom ? ' selected' : '') + '>' + esc(s.name) + ' (' + AREA_SHORT[s.area] + ')</option>'; }).join('') + '</select></label>' : '') +
      '<div class="grid2"><label class="fld"><span>Name</span><input name="name" value="' + (isNew ? (src ? esc(nextName(src.name)) : '') : val('name')) + '" placeholder="e.g. Inside 5" autocomplete="off"></label><label class="fld"><span>Area (sets the price)</span><select name="area">' + Object.keys(AREA_SHORT).map(function (a) { return '<option value="' + a + '"' + (a === area ? ' selected' : '') + '>' + AREA_SHORT[a] + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="grid2"><label class="fld"><span>Usual number of guests</span><input name="guests" inputmode="numeric" data-stp min="1" max="99" value="' + (src ? src.guests || 8 : 8) + '"></label><label class="fld"><span>The most people it can ever take</span><input name="max" inputmode="numeric" data-stp min="1" max="99" value="' + (src ? standMax(src) : 10) + '"></label></div>' +
      '<p class="hint">' + ic('info') + ' Guests can ask for a few more than the usual number and you decide. Above the most, the website stops them.</p>' +
      '<label class="fld"><span>Setups</span><input name="setups" value="' + val('setups') + '" placeholder="1-2 trailers or tents"></label>' +
      '<label class="fld"><span>Short line</span><input name="feel" value="' + val('feel') + '" placeholder="e.g. Intimate yet spacious"></label>' +
      '<label class="fld"><span>Highlights, separated by commas</span><input name="hl" value="' + (src ? esc((src.highlights || []).join(', ')) : '') + '" placeholder="Braai area, Near the fence"></label>' +
      '<label class="fld"><span>Description</span><textarea name="desc" rows="4">' + val('description') + '</textarea></label>' +
      '<label class="check"><input type="checkbox" name="isnew"' + (isNew || src.status === 'new' ? ' checked' : '') + '><span>Show a "New stand" badge on the website</span></label>' +
      '<h5>Photos <span class="muted">· the first one is the cover</span></h5><div class="ph-grid" data-ph-grid>' + phGrid() + '</div>' +
      '<div class="row-btns"><label class="btn ghost file-btn">' + ic('plus') + 'Upload photos<input type="file" accept="image/*" multiple data-ph-file></label></div>' +
      '<details class="ph-lib"><summary>Pick from photos already on the website</summary><div class="ph-pick">' + allPhotos().map(function (p) { return '<button type="button" data-ph-pick="' + esc(p) + '"' + (EDIT.photos.indexOf(p) >= 0 ? ' class="on"' : '') + '><img src="' + esc(imgSrc(p)) + '" alt="" loading="lazy"></button>'; }).join('') + '</div></details>' +
      (isNew ? '<p class="muted small">New stands are not on the camp map yet. In the live version you drop a pin for them on the map.</p>' : '');
    modal(isNew ? (src ? 'Copy ' + esc(src.name) : 'Add a stand') : 'Edit ' + esc(src.name), body, isNew ? 'Add stand' : 'Save stand', function (f) {
      var nm = fval(f, 'name'), ar = fval(f, 'area');
      if (!nm) { toast('Give the stand a name'); f.elements.name.focus(); return false; }
      if (STANDS.some(function (s) { return s.id !== id && K.norm(s.name) === K.norm(nm); })) { toast('There is already a stand called ' + esc(nm)); return false; }
      ensureStands();
      var like = STANDS.filter(function (s) { return s.area === ar && s.areaInfo; })[0];
      var gN = parseInt(fval(f, 'guests'), 10) || 8, mN = parseInt(fval(f, 'max'), 10) || Math.ceil(gN * 1.25); if (mN < gN) mN = gN;   // the most is never below the usual number
      var data = { name: nm, area: ar, areaInfo: like ? like.areaInfo : null, guests: gN, max: mN, setups: fval(f, 'setups'), feel: fval(f, 'feel'), highlights: fval(f, 'hl').split(',').map(function (h) { return h.trim(); }).filter(Boolean), description: fval(f, 'desc'), photos: EDIT.photos.slice(), status: fval(f, 'isnew') ? 'new' : 'open' };
      var st;
      if (isNew) {
        var base = slugify(nm), sid = base, n = 2; while (STANDS.some(function (s) { return s.id === sid; }) || DB.gone[sid]) sid = base + '-' + n++;
        data.id = sid; data.map = null; st = data;
        var at = -1; STANDS.forEach(function (s, i) { if (s.area === ar) at = i; });
        STANDS.splice(at < 0 ? STANDS.length : at + 1, 0, data);
      } else { st = standById(id); Object.keys(data).forEach(function (k) { st[k] = data[k]; }); }
      log((isNew ? (src ? 'Copied ' + src.name + ' to ' : 'Added ') : 'Updated ') + st.name);
      if (!save()) toast('This browser is out of space for photos. Try fewer photos (the live version keeps them on the server).');
      EDIT = null; render(); toast(isNew ? esc(st.name) + ' added. It can be booked straight away.' : esc(st.name) + ' saved');
    }, { wide: true, noFocus: !isNew, onOpen: function (f) {
      // the most follows the usual number (a quarter more) until someone types their own
      var gi = f.elements.guests, mi = f.elements.max, own = !!(src && src.max);
      mi.addEventListener('input', function () { own = true; });
      gi.addEventListener('input', function () { var g = parseInt(gi.value, 10) || 0; if (g && !own) mi.value = Math.ceil(g * 1.25); });
    } });
  }
  // "Inside 4" becomes "Inside 5" (the first free number), otherwise "Copy of ..."
  function nextName(n) {
    var m = n.match(/^(.*?)(\d+)$/); if (!m) return 'Copy of ' + n;
    for (var i = +m[2] + 1; i < 200; i++) { var c = m[1] + i; if (!STANDS.some(function (s) { return K.norm(s.name) === K.norm(c); })) return c; }
    return 'Copy of ' + n;
  }
  function actRemoveStand(id) {
    var s = standById(id), up = DB.bookings.filter(function (b) { return live(b) && b.stand === id && b.co > TODAY; });
    if (up.length) {
      modal('Move ' + up.length + ' booking' + (up.length > 1 ? 's' : '') + ' first', '<p>' + esc(s.name) + ' still has upcoming bookings. Open each one and use <b>Change dates or stand</b>, then remove the stand. Or switch off <b>Open for bookings</b> so nobody new can book it.</p><div class="list">' + up.map(function (b) { return '<button type="button" class="brow" data-open="' + b.ref + '"><span class="brow-st">' + fd(b.ci) + '</span><span class="brow-g"><b>' + esc(guestName(b)) + '</b><small>' + b.ref + ' · ' + diff(b.ci, b.co) + ' nights</small></span>' + pill(stateOf(b)) + '</button>'; }).join('') + '</div>', null);
      return;
    }
    modal('Remove ' + esc(s.name) + '?', '<p>It comes off the website, the calendar and the booking form. Past bookings keep their history.</p>', 'Remove stand', function () {
      ensureStands(); var st = standById(id);
      DB.gone[id] = { id: id, name: st.name, area: st.area, guests: st.guests, photos: [] };
      STANDS.splice(STANDS.indexOf(st), 1); DB.blocks = DB.blocks.filter(function (k) { return k.stand !== id; }); delete DB.closed[id];
      log('Removed ' + st.name); save(); render(); toast(esc(st.name) + ' removed');
    }, { danger: true });
  }

  function actBlock() {
    modal('Block dates', '<label class="fld"><span>Stand</span><select name="stand">' + standOptions('') + '</select></label><div class="grid2"><label class="fld"><span>From</span><input type="date" name="from" value="' + TODAY + '"></label><label class="fld"><span>Until</span><input type="date" name="to" value="' + add(TODAY, 2) + '"></label></div><label class="fld"><span>Reason (staff only)</span><input name="why" placeholder="e.g. Fixing the braai"></label>',
      'Block', function (f) {
        var sid = fval(f, 'stand'), a = fval(f, 'from'), z = fval(f, 'to');
        if (z <= a) { toast('"Until" must be after "From"'); return false; }
        if (overlaps(sid, a, z)) {
          var hit = DB.bookings.filter(function (x) { return live(x) && x.stand === sid && x.ci < z && a < x.co; })[0];
          toast(hit ? guestName(hit) + ' (' + hit.ref + ') is booked on ' + standById(sid).name + ', ' + fd(hit.ci) + ' to ' + fd(hit.co) + '. Move that booking first with Edit booking.' : 'Those dates are already blocked.'); return false;
        }
        DB.blocks.push({ id: 'b' + Date.now(), stand: sid, from: a, to: z, reason: fval(f, 'why') || 'Blocked' }); log(standById(sid).name + ' blocked ' + fd(a) + ' to ' + fd(z)); save(); render(); toast('Dates blocked. Guests can\'t book them on the website.');
      });
  }

  /* =========================================================
     Shared helpers: products, receipts, attachments, emails
     ========================================================= */
  var CATS = ['Firewood & fire', 'Ice & drinks', 'Camp supplies', 'Merchandise'];
  function guessCat(n) { n = n.toLowerCase(); return /wood|fire|tokkie|braai/.test(n) ? 'Firewood & fire' : /ice|drink|water|cold/.test(n) ? 'Ice & drinks' : /mug|cap|sticker|shirt|hat/.test(n) ? 'Merchandise' : 'Camp supplies'; }
  function defaultProducts() {
    var stock = { sekelbos: 60, 'long-burning': 24, ice: 40, firelighters: 30, 'coffee mug': 14, 'peak cap': 4, tokkie: 6, 'vehicle sticker': 45 };
    var sec = shopSec();
    return (sec ? sec.items : []).filter(function (it) { return !isNaN(it.amount); }).map(function (it) {
      var k = Object.keys(stock).filter(function (s) { return it.label.toLowerCase().indexOf(s) >= 0; })[0];
      return { id: slugify(it.label), label: it.label, amount: num('Camp shop', it.label, it.amount), note: it.note || '', cat: guessCat(it.label), active: true, stock: k ? stock[k] : null, lowAt: 5 };
    });
  }
  function prodCats() { var out = CATS.slice(); shopItems().forEach(function (p) { if (p.cat && out.indexOf(p.cat) < 0) out.push(p.cat); }); return out; }
  function prodBy(id) { return shopItems().filter(function (p) { return p.id === id; })[0]; }
  function prodPic(p) { var s = K.shopImg ? K.shopImg(p.label || '', p.img) : p.img; return !s || (/logo/.test(s) && !p.img) ? '' : imgSrc(s); }
  function prodPicHTML(p, cls) { var s = prodPic(p); return '<span class="' + cls + (s ? '' : ' none') + '">' + (s ? '<img src="' + esc(s) + '" alt="" loading="lazy">' : ic('image')) + '</span>'; }
  function lowStock(p) { return p.stock != null && p.stock <= (p.lowAt || 5); }
  function hhmm() { var d = new Date(); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); }
  function uid(p) { return p + Date.now().toString(36) + Math.floor(Math.random() * 1e4).toString(36); }
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function initials(n) { var p = String(n || '?').trim().split(/\s+/); return (p[0][0] + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase(); }
  function when(at) { var d = at.slice(0, 10); return d === TODAY ? at.slice(11, 16) : d === add(TODAY, -1) ? 'Yesterday' : fd(d); }
  function whenSaid(at) { var w = when(at); return w === 'Yesterday' ? 'yesterday' : /:/.test(w) ? 'today at ' + w : 'on ' + w; }
  function saleMethod(m) { return m === 'bill' ? 'On bill' : methodLabel(m); }
  function byRefLoose(s) { var k = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return k ? DB.bookings.filter(function (b) { return b.ref.replace(/[^A-Z0-9]/g, '') === k; })[0] : null; }
  var PAY_RANGES = [['today', 'Today'], ['yesterday', 'Yesterday'], ['last_7', 'Last 7 days'], ['this_month', 'This month'], ['last_month', 'Last month'], ['last_90', 'Last 90 days']];
  function simpleRange(k) {
    var t = TODAY, ms = t.slice(0, 8) + '01';
    if (k === 'today') return [t, t];
    if (k === 'yesterday') return [add(t, -1), add(t, -1)];
    if (k === 'last_7') return [add(t, -6), t];
    if (k === 'last_month') { var lm = monthAdd(ms, -1); return [lm, add(ms, -1)]; }
    if (k === 'last_90') return [add(t, -89), t];
    return [ms, t];
  }
  function rangeSelect(attr, cur) { return '<select ' + attr + ' aria-label="Period">' + PAY_RANGES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === cur ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>'; }
  function dayLabel(d) { return (d === TODAY ? 'Today · ' : d === add(TODAY, -1) ? 'Yesterday · ' : '') + fd(d, { weekday: 'long', day: 'numeric', month: 'long' }); }

  // shop sales are stored line by line; a receipt groups the lines of one sale
  function receipts() {
    var map = {}, out = [];
    DB.sales.forEach(function (s) {
      var r = map[s.sid];
      if (!r) { r = map[s.sid] = { sid: s.sid, d: s.d, t: s.t || '', m: s.m, stand: s.stand || '', ref: s.ref || '', by: s.by || '', lines: [], amt: 0, qty: 0, refundOf: s.refundOf || '', refunded: false }; out.push(r); }
      r.lines.push(s); r.amt += s.amt; r.qty += s.qty;
    });
    out.forEach(function (r) { r.summary = r.lines.map(function (l) { return Math.abs(l.qty) + ' × ' + l.item; }).join(', '); var b = r.ref ? byRef(r.ref) : null; r.guest = b ? guestName(b) : ''; if (r.refundOf && map[r.refundOf]) map[r.refundOf].refunded = true; });
    return out.sort(function (a, b) { return (a.d + a.t) < (b.d + b.t) ? 1 : -1; });
  }
  // every rand in or out: booking payments, refunds and shop sales (sales put on a guest's bill are paid with the booking)
  function allTx() {
    var out = [], fee = function (a) { return Math.round(a - a / (1 + cardFee() / 100)); };
    DB.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (p.m === 'credit') return; out.push({ d: p.d, t: '', kind: p.amt < 0 ? 'refund' : 'booking', type: p.amt < 0 ? 'Refund' : p.type, who: guestName(b), what: standById(b.stand).name + ' · ' + b.ref, m: p.m, amt: p.amt, ref: b.ref, fee: p.m === 'card' && p.amt > 0 ? fee(p.amt) : 0, note: p.ref || '' }); }); });
    receipts().forEach(function (r) { if (r.m === 'bill') return; out.push({ d: r.d, t: r.t, kind: r.amt < 0 ? 'refund' : 'shop', type: r.amt < 0 ? 'Shop refund' : 'Shop sale', who: r.stand ? r.stand + (r.guest ? ' · ' + r.guest : '') : 'Walk-in', what: r.summary, m: r.m, amt: r.amt, sid: r.sid, fee: r.m === 'card' && r.amt > 0 ? fee(r.amt) : 0 }); });
    return out.sort(function (a, b) { return (a.d + (a.t || '99')) < (b.d + (b.t || '99')) ? 1 : -1; });
  }
  // money still to come in, soonest due first
  function receivables() {
    return DB.bookings.filter(function (b) { return live(b) && b.status !== 'out' && balance(b) > 0; }).map(function (b) {
      var pend = b.status === 'pending', due = pend ? depositDue(b) : balanceDue(b);
      return { b: b, what: pend ? 'Deposit' : 'Balance', due: due, amt: pend ? Math.max(0, deposit(b) - paid(b)) || balance(b) : balance(b), late: due < TODAY };
    }).sort(function (a, b) { return a.due < b.due ? -1 : 1; });
  }

  /* attachments: on emails ("t:thread:msg:att"), on bookings ("b:ref:i") or waiting in the reply box ("c:i") */
  var CMP_ATT = [];
  function attFrom(key) {
    var p = key.split(':');
    if (p[0] === 't') { var t = thrById(p[1]), m = t && t.msgs[+p[2]]; return m && m.att && m.att[+p[3]]; }
    if (p[0] === 'b') { var b = byRef(p[1]); return b && (b.pops || [])[+p[2]]; }
    if (p[0] === 'c') return CMP_ATT[+p[1]];
    return null;
  }
  function attChip(a, key) { return '<button type="button" class="att" data-att="' + esc(key) + '">' + ic(/^image/.test(a.type || '') ? 'image' : 'clip') + '<span><b>' + esc(a.name) + '</b><small>' + (a.size ? kb(a.size) : '') + (a.via ? ' · ' + esc(a.via) : '') + '</small></span></button>'; }
  function viewAtt(key) {
    var a = attFrom(key); if (!a) return;
    var src = a.data || '';
    if (!src && a.inv) { var ib = byRef(a.invRef), iv = ib && invByNo(ib, a.inv), mk = iv && window.jspdf ? K.invoicePDF(iv) : null; if (mk) { modal(esc(a.name), '<iframe class="att-pdf" src="' + mk.url + '" title="' + esc(a.name) + '"></iframe><p class="muted small">' + esc(a.via || '') + ' · ' + esc(a.at || '') + '</p>', null, null, { wide: true, noFocus: true }); return; } }
    if (src && /pdf/.test(a.type || '')) { try { var bin = atob(src.split(',')[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); src = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); } catch (e) {} }
    var body = src ? (/^image/.test(a.type || '') ? '<img class="att-img" src="' + src + '" alt="' + esc(a.name) + '">' : '<iframe class="att-pdf" src="' + src + '" title="' + esc(a.name) + '"></iframe>') :
      '<div class="att-demo">' + ic('note') + '<div><b>' + esc(a.name) + '</b><p class="muted small">Made-up demo file, so there is nothing to open. In the live version the real document opens here.</p></div></div>';
    modal(esc(a.name), body + '<p class="muted small">' + [a.size ? kb(a.size) : '', a.via || '', a.at || ''].filter(Boolean).map(esc).join(' · ') + '</p>', null, null, { wide: true, noFocus: true });
  }
  // proof of payment sent with an email address that is not the one on the booking is still kept, with a small note
  function popOther(a) { return a.emailMatch === false ? 'sent from another email address' + (a.email ? ': ' + a.email : '') : ''; }
  function popChips(b) { return (b.pops || []).length ? '<div class="att-row">' + b.pops.map(function (a, i) { return attChip(a, 'b:' + b.ref + ':' + i); }).join('') + b.pops.filter(popOther).map(function (a) { return '<span class="muted small pop-other">' + esc(a.name) + ': ' + esc(popOther(a)) + '</span>'; }).join('') + '</div>' : ''; }

  /* =========================================================
     Inbox: every email with a guest, kept as one conversation
     ========================================================= */
  var IN = { box: 'open', id: null, q: '', f: '', age: '' };
  var BOXES = [['open', 'Needs reply'], ['waiting', 'Waiting on guest'], ['closed', 'Closed'], ['all', 'All']];
  var QUICK = [
    ['We will check and come back to you', function () { return 'Thank you for your message. Let me check and come back to you today.'; }],
    ['Banking details for EFT', function () { return 'You can pay by EFT to:\n' + bankLine() + '\n\nPlease use your booking reference so we can match the payment, then upload your proof of payment at www.kyleu.co.za/pop.html (or simply reply to this email with it attached).'; }],
    ['Directions', function () { return 'Enter Dinokeng at Tau Gate, follow the main road for 4.8 km, turn right onto Kaallaagte Road and continue 2 km to camp. Let us know roughly when you will arrive.'; }],
    ['Game drives', function () { return 'Our guided game drives leave at 06:00 and 15:30 and take about 2 hours. It is ' + money(num('Game drives', 'Game drive 3 or more people per person', 400)) + ' per person for 3 or more people, ' + money(num('Game drives', 'Game drive 2 people per person', 450)) + ' per person for 2, or ' + money(num('Game drives', 'Game drive 1 person', 900)) + ' for a private drive.'; }],
    ['Pensioner rate', function () { return 'The pensioner rate of ' + money(num('Ablution stands', 'Pensioner weekday per person per night', 115)) + ' per person per night applies to Monday to Thursday nights. Sunday nights and weekends are charged at the normal rate.'; }],
    ['Proof of payment received', function () { return 'Thank you, we have received your proof of payment. We will confirm your booking as soon as the money reflects in our account (usually within 1 working day).'; }]
  ];
  function thrById(id) { return DB.threads.filter(function (t) { return t.id === id; })[0]; }
  function lastMsg(t) { return t.msgs[t.msgs.length - 1]; }
  // emails sent from a booking go into that booking's conversation
  /* =========================================================
     Sending: nothing goes out by itself. Every message opens this box first:
     preview and edit the words, look at the documents, then send by email
     (sent for you, documents attached) or WhatsApp (documents download, WhatsApp
     opens with the message typed in, you attach the files). The box stays open
     so you can send both ways.
     ========================================================= */
  var BIZ = { name: 'Kyleu Bush Camp', addr: 'Plot 77 Klipdrift 90 JR, Kaallaagte Road, Dinokeng Game Reserve, Gauteng', phone: '060 458 4478', email: 'info@kyleu.co.za', get bank() { return bankLine(); } };
  // the bank details from Settings > Quotes & invoices (the same ones printed on quotations and invoices)
  function bankLine() { var B = K.BIZ || {}; return (B.bank || 'FNB') + ' · Account name: ' + (B.accName || '') + ' · Account number: ' + (B.accNo || '') + ' · Branch code: ' + (B.branch || ''); }
  var LONGD = { day: 'numeric', month: 'long', year: 'numeric' };
  function waDigits(p) { var d = String(p || '').replace(/[^\d+]/g, ''); if (!d) return ''; if (d[0] === '+') return d.slice(1); if (d.indexOf('00') === 0) return d.slice(2); if (d[0] === '0') return '27' + d.slice(1); return d; }
  // must run straight from a click, so the browser does not block the new tab
  function openWhatsApp(phone, text) {
    var n = waDigits(phone), t = encodeURIComponent(text || '');
    try { var fr = document.createElement('iframe'); fr.style.display = 'none'; fr.src = 'whatsapp://send?phone=' + n + '&text=' + t; document.body.appendChild(fr); setTimeout(function () { fr.remove(); }, 2000); } catch (e) {}
    try { window.open('https://wa.me/' + n + '?text=' + t, '_blank'); } catch (e) {}
  }
  function downloadFile(blob, name) { var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500); }

  /* ---------- PDF documents (made in the browser with jsPDF) ---------- */
  function pdfClean(s) { return String(s == null ? '' : s).replace(/[\u00a0\u2009\u202f]/g, ' ').replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/[^\x09\x0a\x0d\x20-\xff]/g, ''); }
  function pdfKit(doc) {
    var y = 18, L = 18, R = 192, text = doc.text.bind(doc);
    doc.text = function (s, x, yy, o) { return text(Array.isArray(s) ? s.map(pdfClean) : pdfClean(s), x, yy, o); };
    var k = {
      y: function (v) { if (v != null) y = v; return y; },
      font: function (size, bold, c) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); c = c || [42, 27, 18]; doc.setTextColor(c[0], c[1], c[2]); },
      need: function (h) { if (y + h > 278) { doc.addPage(); y = 20; } },
      head: function (title, sub) {
        k.font(17, true); doc.text(BIZ.name, L, y); k.font(16, true, [184, 70, 26]); doc.text(title, R, y, { align: 'right' }); y += 6;
        k.font(8.5, false, [110, 95, 80]); doc.text(BIZ.addr, L, y); if (sub) doc.text(sub, R, y, { align: 'right' }); y += 4.5;
        doc.text(BIZ.phone + ' · ' + BIZ.email + ' · www.kyleu.co.za', L, y); y += 4;
        doc.setDrawColor(232, 115, 28); doc.setLineWidth(.6); doc.line(L, y, R, y); y += 9;
      },
      pairs: function (rows) {
        var half = Math.ceil(rows.length / 2);
        rows.forEach(function (r, i) { var x = i < half ? L : 108, yy = y + (i < half ? i : i - half) * 6; k.font(8.5, false, [120, 105, 90]); doc.text(r[0], x, yy); k.font(9.5, true); doc.text(String(r[1]), x + 30, yy); });
        y += half * 6 + 5;
      },
      h: function (t) { k.need(12); k.font(11.5, true); doc.text(t, L, y); y += 6.5; },
      line: function (a, b, strong) {
        k.font(strong ? 10.5 : 9.5, !!strong); var ls = doc.splitTextToSize(pdfClean(a), 132); k.need(ls.length * 4.6 + 3);
        doc.text(ls, L, y); doc.text(b, R, y, { align: 'right' }); y += ls.length * 4.6 + 1.6;
        doc.setDrawColor(228, 218, 202); doc.setLineWidth(.2); doc.line(L, y - 3, R, y - 3); y += 1;
      },
      para: function (t, size) { k.font(size || 9.5); String(t).split(/\n\s*\n/).forEach(function (p) { var ls = doc.splitTextToSize(pdfClean(p.trim()), R - L); k.need(ls.length * 4.5 + 3); doc.text(ls, L, y); y += ls.length * 4.5 + 3; }); },
      box: function (t) { k.font(9.5); var ls = doc.splitTextToSize(pdfClean(t), R - L - 8), h = ls.length * 4.6 + 5; k.need(h + 4); doc.setFillColor(250, 242, 228); doc.roundedRect(L, y - 4, R - L, h, 2, 2, 'F'); doc.text(ls, L + 4, y + .5); y += h + 3; },
      table: function (cols, w, rows, n) {
        rows = rows || []; n = Math.max(rows.length, n || 0); k.need(12 + n * 10);
        var x = L; doc.setFillColor(242, 235, 224); doc.rect(L, y - 5, R - L, 8, 'F'); k.font(8.5, true); cols.forEach(function (c, i) { doc.text(c, x + 2, y); x += w[i]; }); y += 3;
        doc.setDrawColor(160, 150, 138); doc.setLineWidth(.25);
        for (var r = 0; r < n; r++) { x = L; w.forEach(function (ww, i) { doc.rect(x, y, ww, 10); if (rows[r] && rows[r][i] != null) { k.font(10, i === w.length - 1 && rows[r].strongLast); doc.text(String(rows[r][i]), x + 2, y + 6.5); } x += ww; }); y += 10; }
        y += 6;
      },
      foot: function () { var n = doc.getNumberOfPages(); for (var i = 1; i <= n; i++) { doc.setPage(i); k.font(7.5, false, [140, 125, 110]); doc.text(BIZ.name + ' · ' + BIZ.email + ' · ' + BIZ.phone + ' · page ' + i + ' of ' + n, 105, 289, { align: 'center' }); } }
    };
    return k;
  }
  function makePdf(d) {
    var J = window.jspdf && window.jspdf.jsPDF;
    if (!J) { var t = new Blob(['This document could not be made because the PDF maker did not load. Check the internet connection and try again.'], { type: 'text/plain' }); return { blob: t, url: URL.createObjectURL(t), data: '' }; }
    var doc = new J({ unit: 'mm', format: 'a4' }); d.build(doc, pdfKit(doc));
    var blob = doc.output('blob'); return { blob: blob, url: URL.createObjectURL(blob), data: doc.output('datauristring') };
  }
  function guestsLine(b) { var a = b.adults + b.pens; return a + ' adult' + (a === 1 ? '' : 's') + (b.pens ? ' (' + b.pens + ' pensioner' + (b.pens === 1 ? '' : 's') + ')' : '') + (b.kids ? ', ' + b.kids + ' child' + (b.kids === 1 ? '' : 'ren') : ''); }
  function stayRows(b) { var st = standById(b.stand); return [['Booking', b.ref], ['Guest', guestName(b)], ['Mobile', b.guest.phone || '-'], ['Email', b.guest.email || '-'], ['Stand', st.name + ' (' + AREA_SHORT[st.area] + ')'], ['Arrive', fd(b.ci, LONGD) + ', check-in from ' + checkInTime()], ['Depart', fd(b.co, LONGD) + ', check-out by ' + checkOutTime()], ['Nights', diff(b.ci, b.co)], ['Guests', guestsLine(b)], ['Vehicles', vehKnown(b) ? ensureCars(b).length : 'Not given yet']]; }
  function moneyLines(b, k) {
    var q = quote(b.stand, b.ci, b.co, b, b.extras), card = b.method === 'card', sum = 0;
    q.lines.forEach(function (l) { var v = card ? l.c : l.e; sum += v; k.line(l.t, money(v)); });
    (b.charges || []).forEach(function (c) { var v = card ? c.c : c.e; sum += v; k.line(c.desc, money(v)); });
    if (Math.round(sum) !== Math.round(b.total)) k.line('Discount or adjustment', money(b.total - sum));
    k.line('Total', money(b.total), true); k.line('Paid so far', money(paid(b)), true); k.line('Balance', money(balance(b)), true);
  }
  /* ---------- invoices and quotes: same look as on the website (assets/js/invoice.js) ---------- */
  // the stay as the website shows it: weekend nights and weekday nights with their dates and rate, children free
  function stayDetail(b) {
    var st = standById(b.stand), ss = st.area === 'self-sufficient', sec = ss ? 'Self-sufficient' : 'Ablution stands';
    var R = { wk: num(sec, 'Weekend per person per night', ss ? 180 : 245), wd: num(sec, 'Weekday per person per night', ss ? 100 : 160), pe: num(sec, 'Pensioner weekday per person per night', ss ? 100 : 115) };
    var grp = { wk: [], wd: [] }, amt = { wk: 0, wd: 0 }, pens = false, paying = b.adults + b.pens, out = [];
    for (var d = b.ci; d < b.co; d = add(d, 1)) {
      var dow = D(d).getDay(), wk = isWeekendNight(d), k = wk ? 'wk' : 'wd', pr = wk ? R.wk : (dow >= 1 && dow <= 4 ? R.pe : R.wd);
      if (b.pens && pr !== (wk ? R.wk : R.wd)) pens = true;
      grp[k].push(d); amt[k] += b.adults * (wk ? R.wk : R.wd) + b.pens * pr;
    }
    ['wk', 'wd'].forEach(function (k) {
      var ds = grp[k]; if (!ds.length || !paying) return;
      var dl = ds.map(function (d, i) { return D(d).toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }) + (i === ds.length - 1 || D(d).getMonth() !== D(ds[i + 1]).getMonth() ? ' ' + D(d).toLocaleDateString('en-ZA', { month: 'short' }) : ''); });
      out.push({ t: st.name + ' · ' + (k === 'wk' ? 'weekend' : 'weekday') + ' night' + (ds.length > 1 ? 's' : '') + ': ' + (dl.length > 1 ? dl.slice(0, -1).join(', ') + ' & ' + dl[dl.length - 1] : dl[0]) + ' · ' + paying + ' adult' + (paying === 1 ? '' : 's') + (k === 'wd' && pens ? ' (pensioner rate Mon-Thu)' : ' at ' + money(k === 'wk' ? R.wk : R.wd) + ' per person'), q: ds.length, u: Math.round(amt[k] / ds.length), amt: amt[k], tag: 'stay' });
    });
    if (b.kids) out.push({ t: 'Child' + (b.kids === 1 ? '' : 'ren') + ' under 12 (free)', q: b.kids, amt: 0, free: true, tag: 'stay' });
    return out;
  }
  function invLines(b) {
    var q = quote(b.stand, b.ci, b.co, b, b.extras), card = b.method === 'card', st = standById(b.stand);
    var L = q.lines.map(function (l, i) {
      var amt = card ? l.c : l.e, n = q.nights;
      if (i === 0) { var sd = card ? null : stayDetail(b); if (sd && Math.round(sd.reduce(function (a, x) { return a + x.amt; }, 0)) === Math.round(amt)) return sd; return { t: st.name + ' · ' + l.t, q: n, u: amt % n === 0 ? amt / n : undefined, amt: amt, tag: 'stay' }; }
      return { t: l.t, amt: amt, tag: 'extra' };
    });
    L = [].concat.apply([], L);   // the stay can be several lines
    (b.charges || []).forEach(function (c) {
      var amt = card ? c.c : c.e;
      if (c.pre && c.items) {   // the shop order, one line per item when the prices add up
        var parts = Object.keys(c.items).map(function (lab) { var p = shopItems().filter(function (x) { return x.label === lab; })[0]; return { t: lab, q: c.items[lab], u: p ? (card ? toCard(p.amount) : p.amount) : null }; });
        if (parts.every(function (x) { return x.u != null; }) && parts.reduce(function (a, x) { return a + x.q * x.u; }, 0) === amt) { parts.forEach(function (x) { L.push({ t: x.t, q: x.q, u: x.u, amt: x.q * x.u, tag: 'shop' }); }); return; }
      }
      L.push({ t: c.desc, amt: amt, tag: c.pre ? 'shop' : c.adj ? 'adj' : 'extra' });
    });
    var sum = L.reduce(function (a, l) { return a + l.amt; }, 0);
    if (Math.round(sum) !== Math.round(b.total)) L.push({ t: 'Discount or adjustment', amt: b.total - sum, tag: 'adj' });
    return L;
  }
  function nextInvNo(b, kind) { return K.peekNo(kind, b.ref); }
  // the document to send now: a quotation until a payment is in, then an invoice; the last one again if nothing changed
  function curDoc(b) {
    var list = b.invoices || [], last = list[list.length - 1], kind = paid(b) > 0 || b.onArrival ? 'Invoice' : 'Quote';
    if (last && last.kind === kind && Math.round(last.total) === Math.round(b.total) && Math.round(last.paid || 0) === Math.round(paid(b)) && !(kind === 'Quote' && b.noRelease && last.validTo)) return last;
    return invFor(b, kind, null, kind === 'Quote' && !b.noRelease ? { validTo: depositDue(b) } : {});   // a stand that is kept for the guest: the quotation has no "valid until" date
  }
  function invFor(b, kind, lines, extra) {
    kind = kind || 'Invoice'; lines = lines || invLines(b);
    return Object.assign({ id: K.docId(), kind: kind, no: nextInvNo(b, kind), date: TODAY, ref: b.ref, guest: { name: guestName(b), email: b.guest.email, phone: b.guest.phone },
      stay: { stand: standById(b.stand).name, ci: b.ci, co: b.co, nights: diff(b.ci, b.co), guests: guestsLine(b), vehicles: vehKnown(b) ? ensureCars(b).length : 'Not given yet' },
      lines: lines, total: lines.reduce(function (a, l) { return a + l.amt; }, 0), paid: paid(b), deposit: deposit(b), depPct: depPct(), depositDue: depositDue(b), balanceDue: balanceDue(b),
      payFull: payFullOf(b), cancelled: b.status === 'cancelled', onArrival: b.onArrival && kind !== 'Quote' ? b.onArrival.how : '' }, extra || {});
  }
  function invDoc(inv) { return { name: K.invoiceName(inv), inv: inv, build: function (doc) { K.invoiceDraw(doc, inv); } }; }
  // documents are found by their own id (several can share the booking number); older ones by number
  function invByNo(b, key) { var l = b.invoices || []; return l.filter(function (x) { return x.id === key; })[0] || l.filter(function (x) { return x.no === key; }).pop(); }
  function recordInv(b, inv, via, to) {
    b.invoices = b.invoices || [];
    var x = b.invoices.indexOf(inv) >= 0 ? inv : invByNo(b, K.docKey(inv)); if (!x || (inv.id && x.id !== inv.id)) { x = JSON.parse(JSON.stringify(inv)); x.by = x.by || (ME ? ME.name : 'Staff'); b.invoices.push(x); K.commitNo(inv.kind, inv.no); }
    x.sent = { at: nowStamp(), via: via, to: to || '', by: ME ? ME.name : '' };
  }
  // the website emails the invoice by itself; it shows in the inbox like any email
  function autoMail(b, inv, at, subject, body) {
    var t = DB.threads.filter(function (x) { return x.ref === b.ref && x.auto; })[0];   // all automatic invoice emails in one conversation
    var att = [{ name: K.invoiceName(inv), type: 'application/pdf', size: 0, inv: K.docKey(inv), invRef: b.ref, at: at, via: 'Sent automatically' }];
    if (!t) { t = { id: uid('t'), subject: subject, name: guestName(b), email: b.guest.email, phone: b.guest.phone, status: 'closed', unread: false, ref: b.ref, auto: true, msgs: [] }; DB.threads.push(t); }
    var sh = sigShared();
    t.msgs.push({ from: 'staff', by: 'Website (automatic)', at: at, body: (t.subject !== subject ? 'Subject: ' + subject + '\n\n' : '') + body + '\n\n--\nKyleu Bush Camp\n' + sh.phone + ' · info@kyleu.co.za · ' + sh.web + '\nProud DGR CP Member', att: att });
    nudgeMark(b, nudgeKinds(b, 'inv', body, [{ inv: inv }]), 'Email (automatic)', null, at, 'Website');
  }
  function invMailBody(b, inv, updated) {
    var st = K.invoiceState(inv);
    if (inv.kind === 'Quote') return 'Hi ' + b.guest.first + ',\n\n' + (updated ? 'Your booking ' + b.ref + ' was changed, so here is your updated quotation ' + inv.no + '.' : 'Thank you for booking ' + standById(b.stand).name + ' from ' + fd(b.ci, LONGD) + ' to ' + fd(b.co, LONGD) + '. Your quotation ' + inv.no + ' is attached, with our bank details and your booking reference ' + b.ref + '.') +
      '\n\n' + (b.noRelease ? 'We are keeping the stand for you. Please pay ' : 'This quotation is valid for ' + validDays(inv.date || TODAY, inv.validTo || depositDue(b)) + '. After that the stand is released. To secure your stand, pay ') + money(st.now || deposit(b)) + ' using reference ' + b.ref + '.\n\nOnce payment has been made, upload your proof of payment directly to your booking (press "I have paid"):\n' + bookingLink(b) + '\n\nSee you in the bush!\nThe Kyleu team';
    return 'Hi ' + b.guest.first + ',\n\n' + (updated === 'staff' ? 'Please find your invoice ' + inv.no + ' for ' + standById(b.stand).name + ', ' + fd(b.ci, LONGD) + ' to ' + fd(b.co, LONGD) + ', attached.' : updated ? 'Your booking ' + b.ref + ' was changed, so here is your updated invoice ' + inv.no + '.' : 'Thank you for booking ' + standById(b.stand).name + ' from ' + fd(b.ci, LONGD) + ' to ' + fd(b.co, LONGD) + '. Your invoice ' + inv.no + ' is attached.') + '\n\n' +
      (st.k === 'due' ? st.t + '. Pay by EFT using reference ' + b.ref + '; our banking details are on the invoice. When you have paid, press "I have paid" on your booking page:\n' + bookingLink(b) + '\n\nOnce your booking is paid in full, the same link lets you finalise it (vehicles, passengers and arrival time).' : st.t) + '\n\nSee you in the bush!\nThe Kyleu team';
  }
  function invSec(b) {
    var list = (b.invoices || []).slice().reverse();
    return '<section class="d-sec"><h4 class="h4-row">Invoices &amp; quotes<button type="button" class="link-btn" data-act="inv-new" data-ref="' + b.ref + '">' + ic('plus') + 'New invoice or quote</button></h4>' +
      (list.length ? '<div class="list">' + list.map(function (x) { return '<button type="button" class="brow" data-act="inv-view" data-ref="' + b.ref + '|' + esc(K.docKey(x)) + '"><span class="brow-st">' + esc(x.no) + '</span><span class="brow-g"><b>' + esc(K.kindName(x)) + ' · ' + money(x.total) + '</b><small>' + fd(x.date) + ' · made by ' + esc(x.by || 'staff') + (x.sent ? ' · sent by ' + esc(x.sent.via) + ' ' + esc(x.sent.at) : ' · not sent yet') + '</small></span>' + ic('chev-r') + '</button>'; }).join('') + '</div>'
        : '<p class="muted small">Nothing sent yet. Use <b>More</b>, <b>Send the ' + (paid(b) > 0 ? 'invoice' : 'quotation') + '</b> to send one, or make one here.</p>') +
      '<div class="row-btns"><button type="button" class="btn ghost sm" data-act="inv-cur" data-ref="' + b.ref + '">' + ic('note') + (paid(b) > 0 ? 'Preview the current invoice' : 'Preview the current quotation') + '</button></div></section>';
  }
  function invView(b, inv, fresh) {
    modal(esc(inv.kind) + ' ' + esc(inv.no), '<div class="inv-admin">' + K.invoiceHTML(inv) + '</div>' +
      '<div class="row-btns inv-admin-acts"><button type="button" class="btn ghost" data-act="inv-dl" data-ref="' + b.ref + '|' + esc(K.docKey(inv)) + '">' + ic('download') + 'Download PDF</button><button type="button" class="btn" data-act="inv-send" data-ref="' + b.ref + '|' + esc(K.docKey(inv)) + '">' + ic('send') + (inv.sent ? 'Send again' : 'Send to ' + esc(b.guest.first)) + '</button></div>' +
      (inv.sent ? '<p class="muted small">Sent by ' + esc(inv.sent.via) + ' on ' + esc(inv.sent.at) + (inv.sent.to ? ' to ' + esc(inv.sent.to) : '') + '.</p>' : fresh ? '<p class="muted small">Saved, not sent yet. Press Send to choose WhatsApp or email.</p>' : ''),
      null, null, { xl: true, noFocus: true });
  }
  // current invoice: not kept until it is sent
  var CUR_INV = {};
  function invGet(b, key) { return invByNo(b, key) || CUR_INV[b.ref + '|' + key]; }
  function sendInvoice(b, inv) {
    sendBox({ b: b, title: 'Send ' + inv.kind.toLowerCase() + ' ' + inv.no, value: 'inv', choices: [['inv', inv.kind]], load: function () {
      return { subject: 'Your Kyleu reservation ' + b.ref + ' (' + docTag(inv, b.ref) + ')', text: inv.kind === 'Quote' ? 'Hi ' + b.guest.first + ',\n\nHere is your quotation ' + inv.no + ' for ' + standById(b.stand).name + ', ' + fd(b.ci, LONGD) + ' to ' + fd(b.co, LONGD) + '. The total is ' + money(inv.total) + (inv.validTo && !b.noRelease ? ', and the quotation is valid for ' + validDays(inv.date || TODAY, inv.validTo) : '') + '.\n\n' + (b.noRelease ? 'We are keeping the stand for you.' : 'Your stand is held once the deposit is paid.') + ' Our banking details are on the quotation.\n\nThe Kyleu team' : invMailBody(b, inv, 'staff'), docs: [invDoc(inv)] };
    } });
  }
  function actInvNew(ref) {
    var b = byRef(ref), locked = paid(b) > 0, lines = invLines(b);
    var row = function (l) { return '<div class="inv-ed-row"><input name="t" value="' + esc(l.t) + '" aria-label="Description"><input name="a" inputmode="decimal" value="' + Math.round(l.amt) + '" aria-label="Amount in rand"' + (locked ? ' readonly' : '') + '>' + (locked ? '' : '<button type="button" class="icon-btn sm" data-inv-rm aria-label="Remove line">' + ic('x') + '</button>') + '</div>'; };
    modal('New invoice or quote · ' + esc(guestName(b)),
      '<div class="grid2"><label class="fld"><span>What is it?</span><select name="kind"><option value="Invoice">Invoice</option><option value="Quote">Quotation</option></select></label><label class="fld" data-valid hidden><span>Quotation valid until</span><input type="date" name="valid" value="' + add(TODAY, num('Booking rules', 'Deposit due within days of invoice', 5)) + '"></label></div>' +
      (locked ? '<p class="callout warn cflex">' + ic('lock') + '<span><b>Prices are locked</b> because ' + esc(b.guest.first) + ' has already paid ' + money(paid(b)) + '. You can still make and send a new invoice with the current amounts. To change the stay itself, use Edit booking.</span></p>'
        : '<p class="hint">' + ic('info') + ' Change any amount, or add a line (a discount is a minus amount, e.g. -200). The booking total changes to match when you save.</p>') +
      '<div class="inv-ed-head"><span>Description</span><span>Amount (R)</span></div><div class="inv-ed" data-inv-lines>' + lines.map(row).join('') + '</div>' +
      (locked ? '' : '<button type="button" class="btn ghost sm" data-inv-add>' + ic('plus') + 'Add a line</button>') +
      '<div class="inv-ed-tot" data-inv-tot></div>' +
      '<label class="fld"><span>Note on the invoice (optional)</span><input name="note" placeholder="e.g. Includes the 10% discount we agreed on"></label>' +
      (locked ? '' : '<label class="fld"><span>Reason for a price change (saved in the booking notes)</span><input name="why" placeholder="e.g. Loyal guest discount"></label>'),
      'Save and preview', function (f) {
        var ls = $$('.inv-ed-row', f).map(function (r) { return { t: $('[name=t]', r).value.trim(), amt: Math.round(parseFloat(String($('[name=a]', r).value).replace(/[^\d.-]/g, '')) || 0), tag: 'line' }; }).filter(function (l) { return l.t || l.amt; });
        if (!ls.length) { toast('Add at least one line'); return false; }
        var total = ls.reduce(function (a, l) { return a + l.amt; }, 0), kind = fval(f, 'kind'), why = fval(f, 'why');
        if (total < 0) { toast('The total cannot be below R0'); return false; }
        if (!locked && Math.round(total) !== Math.round(b.total)) {
          var d = total - b.total; b.charges = b.charges || [];
          b.charges.push({ d: TODAY, desc: 'Price adjustment' + (why ? ': ' + why : ''), e: d, c: d, adj: true }); b.eft += d; b.card += d; b.total += d;
          b.notes.push({ at: nowStamp(), by: ME.name, text: 'Price adjusted by ' + (d > 0 ? '+' : '-') + money(Math.abs(d)) + ' on a new ' + kind.toLowerCase() + '. Total is now ' + money(b.total) + '.' + (why ? ' Reason: ' + why : '') });
        }
        var inv = invFor(b, kind, ls, { note: fval(f, 'note'), validTo: kind === 'Quote' ? fval(f, 'valid') : '', by: ME.name });
        b.invoices = b.invoices || []; b.invoices.push(inv); K.commitNo(kind, inv.no);
        log(K.kindName(inv) + ' ' + inv.no + ' made for ' + guestName(b), b.ref); save(); refresh();
        setTimeout(function () { invView(b, inv, true); }, 50);
      }, { wide: true, noFocus: true, onOpen: function (f) {
        var box = $('[data-inv-lines]', f);
        var upd = function () { var t = $$('[name=a]', f).reduce(function (a, i) { return a + (parseFloat(String(i.value).replace(/[^\d.-]/g, '')) || 0); }, 0); $('[data-inv-tot]', f).innerHTML = 'Total <b>' + money(t) + '</b>' + (!locked && Math.round(t) !== Math.round(b.total) ? ' <span class="pill warn">was ' + money(b.total) + ', changes by ' + (t > b.total ? '+' : '-') + money(Math.abs(t - b.total)) + '</span>' : ''); };
        f.addEventListener('input', upd);
        f.elements.kind.addEventListener('change', function () { $('[data-valid]', f).hidden = f.elements.kind.value !== 'Quote'; });
        f.addEventListener('click', function (e) {
          if (e.target.closest('[data-inv-rm]')) { e.target.closest('.inv-ed-row').remove(); upd(); }
          if (e.target.closest('[data-inv-add]')) { box.insertAdjacentHTML('beforeend', row({ t: '', amt: 0 })); $$('.inv-ed-row', box).pop().querySelector('input').focus(); upd(); }
        });
        upd();
      } });
  }
  function docBooking(b, title) {
    if (title === 'Invoice') { var cur = curDoc(b); CUR_INV[b.ref + '|' + K.docKey(cur)] = cur; return invDoc(cur); }
    return { name: 'Kyleu ' + title.toLowerCase() + ' ' + b.ref + '.pdf', build: function (doc, k) {
      k.head(title, (title === 'Invoice' ? 'Invoice ' : 'Reference ') + b.ref + ' · ' + fd(TODAY, LONGD));
      k.pairs(stayRows(b)); k.h('Your stay'); moneyLines(b, k); k.y(k.y() + 3);
      if (b.status === 'cancelled') k.box('This booking is cancelled.');
      else if (b.onArrival && balance(b) > 0) k.box('As arranged with Kyleu, you pay ' + money(balance(b)) + ' when you arrive (' + (/card/i.test(b.onArrival.how) ? 'by card' : 'in cash') + ').');
      else if (b.status === 'pending' && b.noRelease) k.box('We are keeping the stand for you. ' + (payFullOf(b) ? 'The full amount of ' : 'A deposit of ') + money(deposit(b)) + ' is to be paid by EFT to ' + BIZ.bank + ', using reference ' + b.ref + '. Then upload your proof of payment at www.kyleu.co.za/pop.html.');
      else if (b.status === 'pending') k.box((payFullOf(b) ? 'The full amount of ' : 'A deposit of ') + money(deposit(b)) + ' secures your stand and is due by ' + fd(depositDue(b), LONGD) + '. Pay by EFT to ' + BIZ.bank + ', using reference ' + b.ref + '. Then upload your proof of payment at www.kyleu.co.za/pop.html.');
      else if (balance(b) > 0) k.box('The balance of ' + money(balance(b)) + ' is due by ' + fd(balanceDue(b), LONGD) + '. Pay by EFT to ' + BIZ.bank + ', using reference ' + b.ref + '.');
      else k.box('Paid in full. Thank you!');
      k.para('Dinokeng Game Reserve conservation and self-drive fees are paid to the reserve, not to Kyleu. Kyleu is a proud DGR CP member: we send you a Conservation Fee Discount Voucher code for each vehicle, for R85 instead of R100 per adult per night.', 8.5);
      k.foot();
    } };
  }
  function docReceipt(b, p) {
    return { name: 'Kyleu receipt ' + b.ref + '.pdf', build: function (doc, k) {
      k.head('Receipt', 'Booking ' + b.ref + ' · ' + fd(p.d, LONGD));
      k.box('Received with thanks: ' + money(p.amt) + ' by ' + methodLabel(p.m) + ' on ' + fd(p.d, LONGD) + (p.ref ? ' (reference ' + p.ref + ')' : '') + '.');
      k.pairs(stayRows(b)); k.h('Your booking'); moneyLines(b, k); k.y(k.y() + 3);
      k.box(balance(b) > 0 ? 'Still to pay: ' + money(balance(b)) + ', due by ' + fd(balanceDue(b), LONGD) + '. Bank: ' + BIZ.bank + ', reference ' + b.ref + '.' : 'Your stay is paid in full. See you in the bush!');
      k.foot();
    } };
  }
  function docIndemnity(b) {
    return { name: 'Kyleu indemnity form ' + b.ref + '.pdf', build: function (doc, k) {
      var cs = ensureCars(b);
      cs.forEach(function (c, i) {
        if (i) { doc.addPage(); k.y(18); }
        k.head('Indemnity', 'Vehicle ' + (i + 1) + ' of ' + cs.length);
        k.pairs([['Booking', b.ref], ['Stand', standById(b.stand).name], ['Arrive', fd(b.ci, LONGD)], ['Depart', fd(b.co, LONGD)], ['Vehicle', c.reg || '________________'], ['Driver', c.driver || '________________']]);
        k.para(K.ind.plain(indText()), 9.2);
        var names = [c.driver].concat(c.guests || []).filter(Boolean);
        k.table(['Full name', 'ID or passport number', 'Signature', 'Date'], [56, 44, 52, 22], names.map(function (nm) { return [nm + (nm !== c.driver && isMinor(c, nm) ? ' (under 18)' : ''), '', '', '']; }), Math.min(12, Math.max(4, names.length + 1, c.people || 0)));
        k.para('Every adult in the vehicle signs. A parent or guardian signs for children under 18.', 8.5);
      });
      k.foot();
    } };
  }
  function docCodes(b, cars) {
    return { name: 'Dinokeng discount vouchers ' + b.ref + '.pdf', build: function (doc, k) {
      k.head('Dinokeng codes', 'Booking ' + b.ref);
      k.pairs([['Guest', guestName(b)], ['Stand', standById(b.stand).name], ['Arrive', fd(b.ci, LONGD)], ['Depart', fd(b.co, LONGD)]]);
      k.box('Kyleu is a proud DGR CP member, so you qualify for Dinokeng Conservation Fee Discount Vouchers: R85 per adult per night instead of R100. Each vehicle has its own code below.');
      k.table(['Vehicle', 'Driver', 'Discount voucher code'], [56, 56, 62], cars.map(function (c) { var r = [carLabel(c, b.cars.indexOf(c)), c.driver || '', c.dgr]; r.strongLast = true; return r; }));
      k.para('Use the code when you buy your conservation fees online at https://dinokeng.plnktn.io before you arrive. Each vehicle that uses the self-drive route also needs a Self Drive Permit (R250 once off). Please give each driver their own code.');
      k.foot();
    } };
  }

  /* ---------- what the guest has been sent, and what is still to send ----------
     b.sends = { doc, link, ind }, each { at, by, via }: the quotation, invoice or confirmation ('doc'), the link to their booking ('link')
     and the indemnity signing link ('ind') went to the guest. Worked out from what really left the send box: its documents and the links in the message.
     b.toSend = { doc: 1, link: 1, ind: 1 }: things the New booking steps left for later (unticked, or the send box was closed without sending).
     They show as still to do on the booking until they are sent. Dinokeng codes are kept per vehicle (car.dgrSent), as before. */
  function noteSent(b, via, text, docs) {
    var t = String(text || ''), keys = [], how = via === 'wa' ? 'WhatsApp' : 'Email';
    if ((docs || []).some(function (d) { return d.inv || /confirmation/i.test(d.name || ''); })) keys.push('doc');
    if (b.key && t.indexOf('k=' + b.key) >= 0) keys.push('link');
    if (b.key && K.ind && t.indexOf('t=' + K.ind.token(b.ref, b.key)) >= 0) keys.push('ind');
    if (!keys.length) return;
    b.sends = b.sends || {};
    keys.forEach(function (k) { b.sends[k] = { at: nowStamp(), by: ME ? ME.name : '', via: how }; if (b.toSend) delete b.toSend[k]; });
    if (b.toSend && !Object.keys(b.toSend).length) delete b.toSend;
  }
  function toSend(b, k) { return !!(b.toSend && b.toSend[k]) && live(b); }
  function sentTxt(x) { return x ? 'sent by ' + x.via + ' ' + (String(x.at).slice(0, 10) === TODAY ? 'today' : 'on ' + fd(String(x.at).slice(0, 10))) + (x.by ? ' by ' + x.by : '') : ''; }

  /* ---------- when the guest was last contacted about each thing, for every list ----------
     b.nudges = { pay, ind, dgr, fin }, each { at, by, via, n }:
       pay = a payment reminder, or the quotation or invoice sent (again)      ind = the indemnity signing link, or a reminder to sign
       dgr = the Dinokeng voucher codes, or a reminder about them               fin = the link to their booking (finalise), or a reminder to finalise
     via is 'WhatsApp', 'Email' or 'Email (automatic)'; n counts how many times. The first time reads "Sent", after that "Reminded".
     Set in one place: when a message really leaves the send box (nudgeKinds works out which kinds the message carries, from the
     template or action that opened the box and from the links, codes and documents in it). The website's own invoice emails and
     replies from the Inbox are counted the same way. Older data is filled in once from what is stored (DB.nudgeV in migrate()). */
  var NUDGE_KINDS = ['pay', 'ind', 'dgr', 'fin'], NUDGE_DAYS = 3;   // "not reminded in the last 3 days"
  var NUDGE_WHAT = { pay: 'Payment', ind: 'Indemnity link', dgr: 'Dinokeng codes', fin: 'Finalise link' };
  var NUDGE_TPL = { eft: ['pay'], balance: ['pay'], invoice: ['pay'], extra: ['pay'], inv: ['pay'], indemnity: ['ind'], codes: ['dgr'], finalise: ['fin'], link: ['fin'], details: ['fin'] };
  function nudgeKinds(b, key, text, docs) {
    var t = String(text || ''), ks = (NUDGE_TPL[key] || []).slice(), put = function (k) { if (ks.indexOf(k) < 0) ks.push(k); };
    if ((docs || []).some(function (d) { return d.inv; }) && (key !== 'receipt' || balance(b) > 0)) put('pay');   // a receipt only counts while money is still owing
    if (b.key && t.indexOf('k=' + b.key) >= 0) put('fin');
    if (b.key && K.ind && t.indexOf('t=' + K.ind.token(b.ref, b.key)) >= 0) put('ind');
    if ((docs || []).some(function (d) { return /^Dinokeng/i.test(d.name || ''); }) || (b.cars || []).some(function (c) { return c.dgr && t.indexOf(c.dgr) >= 0; })) put('dgr');
    return ks;
  }
  // once: the kinds already counted in this send box, so WhatsApp and then email of the same message count as one time
  function nudgeMark(b, kinds, via, once, at, by) {
    if (!b || !kinds || !kinds.length) return;
    b.nudges = b.nudges || {};
    kinds.forEach(function (k) {
      var x = b.nudges[k], n = (x ? x.n || 1 : 0) + (once && once[k] && x ? 0 : 1), nx = { at: at || nowStamp(), by: by != null ? by : (ME ? ME.name : ''), via: via || 'Email', n: n };
      if (x && String(x.at) > String(nx.at)) { x.n = n; nx = x; }   // an older message counted late never hides a newer one
      b.nudges[k] = nx; if (once) once[k] = 1;
    });
  }
  function nudgeOf(b, kind) { return (b && b.nudges && b.nudges[kind]) || null; }
  function nudgeAgo(b, kind) { var x = nudgeOf(b, kind); return x ? Math.max(0, diff(String(x.at).slice(0, 10), TODAY)) : null; }   // days since, null when never
  function nudgeStale(b, kind) { var d = nudgeAgo(b, kind); return d === null || d >= NUDGE_DAYS; }
  // "Sent today", "Reminded yesterday by WhatsApp", "Reminded 5 days ago by email (3 times)", "Not reminded yet". short: "reminded 5 days ago"
  function nudgeTxt(b, kind, short) {
    var x = nudgeOf(b, kind); if (!x) return short ? 'not reminded yet' : 'Not reminded yet';
    var n = x.n || 1, d = nudgeAgo(b, kind), w = (n > 1 ? 'Reminded ' : 'Sent ') + (d === 0 ? 'today' : d === 1 ? 'yesterday' : d + ' days ago');
    if (short) return w.toLowerCase();
    return w + (x.via ? ' by ' + (/whats/i.test(x.via) ? 'WhatsApp' : /auto/i.test(x.via) ? 'automatic email' : 'email') : '') + (n > 2 ? ' (' + n + ' times)' : '');
  }
  function nudgeTip(b, kind) { var x = nudgeOf(b, kind); return x ? NUDGE_WHAT[kind] + ': ' + atNice(x.at) + (x.by ? ', by ' + x.by : '') : NUDGE_WHAT[kind] + ': nothing sent yet'; }
  // the same words as a small line with a bell, for the booking and the cards
  function nudgeNote(b, kind, calm) { return '<span class="nudge-n' + (!calm && nudgeStale(b, kind) ? ' stale' : '') + '" data-nudge="' + kind + '" title="' + esc(nudgeTip(b, kind)) + '">' + ic('bell') + esc(nudgeTxt(b, kind)) + '</span>'; }
  // the template that reminds this guest about one thing
  function nudgeTpl(b, kind) { return kind === 'pay' ? (extraDue(b) ? 'extra' : b.status === 'pending' ? 'eft' : 'balance') : kind === 'ind' ? 'indemnity' : kind === 'fin' ? (paidUp(b) ? 'finalise' : 'link') : defaultTemplate(b); }
  // once, for data from before b.nudges: worked out from what is stored (what was sent, invoices, codes, WhatsApp notes, emails).
  // The made-up demo bookings also get a believable spread: some reminded yesterday, some 5 days ago, some never.
  function nudgeSubject(s) { s = String(s || ''); var ks = []; if (/deposit reminder|stay is coming up|\((quotation|invoice)[^)]*\)|updated Kyleu invoice|^Send (quote|invoice)/i.test(s)) ks.push('pay'); if (/indemnity/i.test(s)) ks.push('ind'); if (/Dinokeng (discount voucher|code)/i.test(s)) ks.push('dgr'); if (/^Finalise your Kyleu booking|^Your Kyleu booking KY|vehicle details please/i.test(s)) ks.push('fin'); return ks; }
  function nudgeFill(b) {
    var ev = {}, put = function (k, at, by, via) { if (!at) return; var id = String(at).slice(0, 16); ev[k] = ev[k] || {}; if (!ev[k][id]) ev[k][id] = { at: String(at), by: by || '', via: /whats/i.test(via || '') ? 'WhatsApp' : /auto/i.test(via || '') ? 'Email (automatic)' : 'Email' }; };
    var s = b.sends || {};
    if (s.doc) put('pay', s.doc.at, s.doc.by, s.doc.via); if (s.link) put('fin', s.link.at, s.link.by, s.link.via); if (s.ind) put('ind', s.ind.at, s.ind.by, s.ind.via);
    (b.invoices || []).forEach(function (x) { if (x.sent) put('pay', x.sent.at, x.sent.by || (/auto/i.test(x.sent.via || '') ? 'Website' : x.by), x.sent.via); });
    (b.cars || []).forEach(function (c) { if (c.dgrSent) put('dgr', c.dgrSent.at, c.dgrSent.by, c.dgrSent.via); });
    (b.notes || []).forEach(function (n) { var m = /^Sent "([^"]*)" on WhatsApp/.exec(n.text || ''); if (m) nudgeSubject(m[1]).forEach(function (k) { put(k, n.at, n.by, 'WhatsApp'); }); });
    (DB.threads || []).forEach(function (t) { if (t.ref !== b.ref) return; (t.msgs || []).forEach(function (m) {
      if (m.from !== 'staff') return; var sj = /^Subject: (.*)/.exec(m.body || ''), ks = nudgeSubject(sj ? sj[1] : m === t.msgs[0] || t.auto ? t.subject : '');
      nudgeKinds(b, '', m.body, (m.att || []).map(function (a) { return { inv: a.inv || /quotation|invoice/i.test(a.name || ''), name: a.name }; })).forEach(function (k) { if (ks.indexOf(k) < 0) ks.push(k); });
      ks.forEach(function (k) { put(k, m.at, t.auto ? 'Website' : m.by, t.auto ? 'Email (automatic)' : 'Email'); });
    }); });
    b.nudges = b.nudges || {};
    NUDGE_KINDS.forEach(function (k) { var ids = Object.keys(ev[k] || {}).sort(); if (!ids.length || b.nudges[k]) return; var last = ev[k][ids[ids.length - 1]]; b.nudges[k] = { at: last.at < b.created ? b.created : last.at, by: last.by, via: last.via, n: ids.length }; });   // some made-up demo codes are dated before the booking: never earlier than the day it was made
    // the demo spread: only bookings the demo made up itself (their references stay below the real counter), and only what is still coming
    var sm = /^KY\d\d (\d+)$/.exec(b.ref);
    if (!DB.seeded || !sm || +sm[1] >= 5901 || !live(b) || b.status === 'out' || b.co < TODAY) return;
    var h = +sm[1], cday = b.created.slice(0, 10), age = diff(cday, TODAY), wa = !b.guest.email || h % 2 === 0 ? 'WhatsApp' : 'Email', ts = b.toSend || {};
    var mk = function (k, ago, time, via, n, from) { var d = add(TODAY, -ago); if (from && d < from) d = from; if (d < cday) d = cday; b.nudges[k] = { at: d + ' ' + time, by: 'Sherri', via: via, n: n }; };
    // the quotation went out when the booking was made: by the website itself, or by Sherri for a phone or WhatsApp booking
    var first = b.source === 'Website' ? { at: b.created, by: 'Website', via: 'Email (automatic)', n: 1 } : { at: b.created, by: b.madeBy || 'Sherri', via: wa, n: 1 };
    if (!b.nudges.pay && !ts.doc) b.nudges.pay = JSON.parse(JSON.stringify(first));
    if (!b.nudges.fin && !ts.link && b.source === 'Website') b.nudges.fin = JSON.parse(JSON.stringify(first));   // the quotation email carries the link to the booking
    var chase = b.status === 'pending' ? age >= 2 : diff(TODAY, balanceDue(b)) <= 10;
    if (balance(b) > 0 && !b.onArrival && !ts.doc && chase && (!b.nudges.pay || b.nudges.pay.n < 2)) { if (h % 3 === 0 && age > 1) mk('pay', 1, '09:20', 'WhatsApp', 2); else if (h % 3 === 1 && age > 5) mk('pay', 5, '16:45', 'Email', 3); }
    if (!ts.ind && (!b.nudges.ind) && b.status !== 'in' && (b.status !== 'pending' || b.noRelease) && diff(TODAY, b.ci) <= 21) { var q = Math.floor(h / 2) % 3; if (q === 0 && age > 1) mk('ind', 1, '10:05', 'WhatsApp', h % 4 < 2 ? 1 : 2); else if (q === 1 && age > 5) mk('ind', 5, '08:40', 'Email', 3); }
    if (paidUp(b) && !b.finalised && b.ci > TODAY && !ts.link && (!b.nudges.fin || b.nudges.fin.n < 2)) { var f = Math.floor(h / 5) % 3, lastPay = (b.payments || []).map(function (p) { return p.d; }).sort().pop() || cday, had = b.nudges.fin ? 1 : 0; if (f === 0 && age > 1) mk('fin', 1, '11:30', wa, 1 + had, lastPay); else if (f === 1 && age > 5) mk('fin', 5, '14:10', 'Email', 2 + had, lastPay); }
  }

  /* ---------- the send box ---------- */
  // o: { b, title, choices: [[key, label]], value, load(key) -> { subject, text, docs }, onSent(via, current) }
  function sendBox(o) {
    var b = o.b, cur = null, nudged = {};
    modal(esc(o.title), '<div class="sx">' +
      '<div class="grid2"><label class="fld"><span>Email to</span><input name="to" type="email" value="' + esc(b.guest.email) + '"></label><label class="fld"><span>WhatsApp to</span><input name="wa" inputmode="tel" value="' + esc(b.guest.phone) + '"></label></div>' +
      (o.choices && o.choices.length > 1 ? '<label class="fld"><span>What are you sending?</span><select name="tpl">' + o.choices.map(function (c) { return '<option value="' + c[0] + '"' + (c[0] === o.value ? ' selected' : '') + '>' + esc(c[1]) + '</option>'; }).join('') + '</select></label>' : '') +
      '<div class="sx-tabs" data-sx-tabs></div>' +
      '<div data-sx-msg><label class="fld"><span>Email subject</span><input name="s"></label><label class="fld"><span>Message (the same words go by email or WhatsApp; change anything you like)</span><textarea name="b" rows="11"></textarea></label>' +
      (mySig() ? '<div class="sx-sig"><span class="muted small">Your email signature goes under the message (not on WhatsApp). Change it under Settings, Email signature.</span><div class="sig-prev sm">' + sigHTML(mySig()) + '</div></div>' : '') + '</div>' +
      '<div class="sx-doc" data-sx-doc hidden><iframe class="sx-frame" title="Document preview"></iframe><div class="row-btns"><button type="button" class="btn ghost sm" data-sx-dl>' + ic('download') + 'Download this document</button></div></div>' +
      '<div class="sx-log" data-sx-log hidden></div>' +
      '<div class="sx-acts"><button type="button" class="btn ghost" data-sx-done>Done</button><span class="sx-sp"></span><button type="button" class="btn wa" data-sx-wa>' + ic('wa') + 'Send on WhatsApp</button><button type="button" class="btn" data-sx-mail>' + ic('mail') + 'Send email</button></div></div>',
      null, null, { xl: true, noFocus: true, onOpen: function (f) {
        var tabs = $('[data-sx-tabs]', f), msgBox = $('[data-sx-msg]', f), docBox = $('[data-sx-doc]', f), frame = $('.sx-frame', f), made = {};
        f.addEventListener('submit', function (e) { e.preventDefault(); e.stopImmediatePropagation(); }, true);   // Enter never closes the box
        var docs = function () { return (cur && cur.docs) || []; };
        var file = function (i) { if (!made[i]) made[i] = makePdf(docs()[i]); return made[i]; };
        function show(tab) {
          tabs.innerHTML = '<button type="button" data-sx-tab="msg" class="' + (tab === 'msg' ? 'on' : '') + '">' + ic('note') + 'Message</button>' + docs().map(function (d, i) { return '<button type="button" data-sx-tab="' + i + '" class="' + (tab === String(i) ? 'on' : '') + '">' + ic('clip') + esc(d.name) + '</button>'; }).join('') + (docs().length ? '' : '<span class="muted small">No documents with this message</span>');
          msgBox.hidden = tab !== 'msg'; docBox.hidden = tab === 'msg';
          if (tab !== 'msg') { docBox.dataset.i = tab; frame.src = file(+tab).url; }
        }
        function load(key) { cur = o.load(key); cur.key = key; made = {}; f.elements.s.value = cur.subject; f.elements.b.value = cur.text; show('msg'); }
        function sent(via, text) {
          var lg = $('[data-sx-log]', f); lg.hidden = false;
          lg.insertAdjacentHTML('beforeend', '<div class="sx-l ' + via + '">' + ic(via === 'wa' ? 'wa' : 'check') + '<span>' + esc(text) + '</span><small>' + nowStamp().slice(11) + '</small></div>');
          $(via === 'wa' ? '[data-sx-wa]' : '[data-sx-mail]', f).innerHTML = ic(via === 'wa' ? 'wa' : 'mail') + (via === 'wa' ? 'WhatsApp again' : 'Email again');
          if (o.onSent) o.onSent(via, cur);
          noteSent(b, via, f.elements.b.value, docs());
          nudgeMark(b, nudgeKinds(b, cur && cur.key, f.elements.b.value, docs()), via === 'wa' ? 'WhatsApp' : 'Email', nudged);   // the one place every list reads "last reminded" from
          docs().forEach(function (d) { if (d.inv) recordInv(b, d.inv, via === 'wa' ? 'WhatsApp' : 'Email', via === 'wa' ? fval(f, 'wa') : fval(f, 'to')); });
          log((via === 'wa' ? 'WhatsApp' : 'Email') + ' sent to ' + guestName(b) + ': ' + fval(f, 's'), b.ref); save(); refresh();
        }
        if (f.elements.tpl) f.elements.tpl.addEventListener('change', function () { load(f.elements.tpl.value); });
        load(o.value);
        // o.way ('wa' or 'mail'): the way staff already chose, so that button is the main one and Enter presses it
        if (o.way) { var wMain = $(o.way === 'wa' ? '[data-sx-wa]' : '[data-sx-mail]', f), wOther = $(o.way === 'wa' ? '[data-sx-mail]' : '[data-sx-wa]', f); wOther.classList.remove('wa'); wOther.classList.add('ghost'); setTimeout(function () { wMain.focus(); }, 60); }
        f.addEventListener('click', function (e) {
          var t = e.target, x;
          if ((x = t.closest('[data-sx-tab]'))) { show(x.dataset.sxTab); return; }
          if (t.closest('[data-sx-dl]')) { var di = +docBox.dataset.i; downloadFile(file(di).blob, docs()[di].name); return; }
          if (t.closest('[data-sx-done]')) { closeModal(); return; }
          if (t.closest('[data-sx-mail]')) {
            var to = fval(f, 'to'); if (!/.+@.+\..+/.test(to)) { toast('Add the email address to send to'); return; }
            var att = docs().map(function (d, i) { var fl = file(i); return { name: d.name, size: fl.blob.size, type: 'application/pdf', data: fl.data, at: nowStamp(), via: 'Sent by email' }; });
            logEmail(b, fval(f, 's') || o.title, f.elements.b.value + (mySig() ? '\n\n--\n' + sigText(mySig()) : ''), att, to);
            sent('mail', 'Emailed to ' + to + (att.length ? ' with ' + att.map(function (a) { return a.name; }).join(', ') : ''));
            toast('Email sent to ' + esc(to) + ' (demo: nothing really leaves this browser)'); return;
          }
          if (t.closest('[data-sx-wa]')) {
            var ph = fval(f, 'wa'); if (waDigits(ph).length < 10) { toast('Add a valid mobile number for WhatsApp'); return; }
            var names = docs().map(function (d) { return d.name; });
            docs().forEach(function (d, i) { downloadFile(file(i).blob, d.name); });
            openWhatsApp(ph, f.elements.b.value);
            b.notes.push({ at: nowStamp(), by: ME.name, text: 'Sent "' + (fval(f, 's') || o.title) + '" on WhatsApp to ' + ph + (names.length ? ' (attach: ' + names.join(', ') + ')' : '') + '.' });
            sent('wa', 'WhatsApp opened for ' + ph + (names.length ? '. Downloaded to attach: ' + names.join(', ') : ''));
            toast(names.length ? 'WhatsApp is opening. Attach the downloaded ' + (names.length > 1 ? 'documents' : 'document') + ' to the chat' : 'WhatsApp is opening with the message'); return;
          }
        });
      } });
  }
  // messages from the template list, each with the documents that belong to it
  var SEND_DOCS = { extra: ['Invoice'], eft: ['Invoice'], balance: ['Invoice'], invoice: ['Invoice'], confirm: ['Booking confirmation'], update: ['Booking confirmation'], arrival: ['codes'] };
  function sendTemplate(b, key) {
    sendBox({ b: b, title: 'Send to ' + guestName(b), value: key, choices: Object.keys(TEMPLATES).map(function (k) { return [k, TEMPLATES[k].t]; }),
      load: function (k) {
        var T = TEMPLATES[k], codes = ensureCars(b).filter(function (c) { return c.dgr; });
        var docs = (SEND_DOCS[k] || []).map(function (d) { return d === 'indemnity' ? docIndemnity(b) : d === 'codes' ? (codes.length ? docCodes(b, codes) : null) : docBooking(b, d); }).filter(Boolean);
        return { subject: fill(T.s, b), text: fill(T.b(b), b), docs: docs };
      }, onSent: function (via, cur) { if (cur && cur.key === 'thanks' && b.status === 'out') thanksMark(b, via === 'wa' ? 'WhatsApp' : 'Email'); } });
  }
  function defaultTemplate(b) { return paidUp(b) && !b.finalised && b.ci >= TODAY ? 'finalise' : b.status === 'pending' ? 'eft' : balance(b) && b.ci > TODAY ? 'balance' : diff(TODAY, b.ci) <= 10 && b.ci >= TODAY ? 'arrival' : b.status === 'out' ? 'thanks' : 'confirm'; }

  /* ---------- the thank-you after a stay, with a link to review Kyleu on Google ----------
     Not a form on the website: only a link to Kyleu's Google reviews. The link and the words are set under
     Settings > Check-in & Dinokeng (DB.settings.thanksLink, DB.settings.thanksText). Staff send it right after
     check-out, by WhatsApp or email. b.thanks = { at, by, via: 'WhatsApp' | 'Email' } once it is sent. */
  var THANKS_DEF = 'Hi {first}, thank you for staying with us at Kyleu Bush Camp. We appreciate you choosing Kyleu and hope you loved the bush.\n\nDid you enjoy your stay? We would love to hear what was good and what we can do better. It takes a minute to leave us a Google review:\n{link}\n\nWe hope to see you again soon.\nThe Kyleu team';
  var THANKS_DAYS = 14;   // the dashboard reminds about check-outs this many days back, not older ones
  var SITE_REVIEW = '';   // the "Google reviews" link in the website's own settings, used until staff type another one
  if (K.settingsFile) K.settingsFile().then(function (S) { if (S) SITE_REVIEW = S.get('Google reviews', '') || ''; if (SITE_REVIEW && ME && route() === 'settings' && SET === 'camp' && !/^(INPUT|TEXTAREA|SELECT)$/.test((document.activeElement || {}).tagName || '')) render(); }).catch(function () {});
  function reviewLink() { var s = DB.settings || {}; return String(s.thanksLink != null ? s.thanksLink : (webDB().settings['Google reviews'] || SITE_REVIEW || '')).trim(); }
  function thanksTpl() { return (DB.settings && DB.settings.thanksText) || THANKS_DEF; }
  function thanksMsg(b) { return thanksTpl().replace(/\{first\}/g, (b.guest && b.guest.first) || 'there').replace(/\{link\}/g, reviewLink()); }
  function outDay(b) { var d = ''; (b.cars || []).forEach(function (c) { if (c.outAt && c.outAt.slice(0, 10) > d) d = c.outAt.slice(0, 10); }); return d || b.co; }
  function thanksDue(b) { return b.status === 'out' && !b.thanks && outDay(b) >= add(TODAY, -THANKS_DAYS); }
  function thanksLine(b) { var t = b.thanks, d = String(t.at).slice(0, 10), tm = String(t.at).slice(11, 16); return 'Thank-you sent by ' + t.via + ' ' + (d === TODAY ? 'today' : 'on ' + fd(d)) + (tm ? ' at ' + tm : '') + (t.by ? ' by ' + t.by : ''); }
  function thanksMark(b, via, to) {
    b.thanks = { at: nowStamp(), by: ME.name, via: via };
    b.notes.push({ at: nowStamp(), by: ME.name, text: 'Thank-you with the Google review link sent by ' + via + (to ? ' to ' + to : '') + '.' });
  }
  // the small step right after check-out (and from the booking, or the dashboard list): the message, then WhatsApp or email
  function thanksStep(ref) {
    var b = byRef(ref); if (!b) return;
    var link = reviewLink(), ph = b.guest.phone || '', em = b.guest.email || '', hasWa = waDigits(ph).length >= 10, hasMail = /.+@.+\..+/.test(em);
    modal('Send the thank-you',
      (b.thanks ? '<p class="callout info cflex">' + ic('check') + '<span>' + esc(thanksLine(b)) + '. You can send it again.</span></p>'
        : '<p class="muted small">' + esc(guestName(b)) + ' has checked out of ' + esc(standById(b.stand).name) + '. Thank ' + esc(b.guest.first) + ' for staying and ask for a Google review.</p>') +
      (link ? '' : '<div class="callout warn cflex cbtn">' + ic('alert') + '<span><b>There is no Google review link yet.</b> ' + (can('settings') ? 'Add it first under Settings, Check-in &amp; Dinokeng, so the message has a link to press.' : 'Ask Sherri to add it under Settings first, so the message has a link to press.') + '</span>' + (can('settings') ? '<button type="button" class="btn ghost sm" data-th-set>Open Settings</button>' : '') + '</div>') +
      '<label class="fld"><span>Message (you can still change it here)</span><textarea name="msg" rows="11">' + esc(thanksMsg(b)) + '</textarea></label>' +
      (hasWa || hasMail ? '<p class="muted small">' + [hasWa ? 'WhatsApp: ' + esc(ph) : '', hasMail ? 'Email: ' + esc(em) : ''].filter(Boolean).join(' · ') + '</p>' : '<p class="callout warn cflex">' + ic('alert') + '<span>There is no mobile number or email address on this booking. Add one under Edit booking first.</span></p>') +
      '<div class="row-btns th-acts"><button type="button" class="btn ghost" data-close>Not now</button><span class="sx-sp"></span>' + (hasWa ? '<button type="button" class="btn wa" data-th-wa>' + ic('wa') + 'Send by WhatsApp</button>' : '') + (hasMail ? '<button type="button" class="btn" data-th-mail>' + ic('mail') + 'Send by email</button>' : '') + '</div>',
      null, null, { noFocus: true, onOpen: function (f) {
        f.addEventListener('submit', function (e) { e.preventDefault(); e.stopImmediatePropagation(); }, true);   // Enter never closes the box
        f.addEventListener('click', function (e) {
          var t = e.target, txt = f.elements.msg.value.replace(/\r/g, '').trim(), via = t.closest('[data-th-wa]') ? 'WhatsApp' : t.closest('[data-th-mail]') ? 'Email' : '';
          if (t.closest('[data-th-set]')) { closeModal(); if (drawerRef) closeDrawer(); SET = 'camp'; if (route() === 'settings') render(); else location.hash = '#/settings'; return; }
          if (!via) return;
          if (!txt) { toast('The message is empty'); return; }
          if (via === 'WhatsApp') openWhatsApp(ph, txt);   // straight from the click, so the browser lets WhatsApp open
          else logEmail(b, 'Thank you for staying at Kyleu', txt + (mySig() ? '\n\n--\n' + sigText(mySig()) : ''), [], em);
          thanksMark(b, via, via === 'WhatsApp' ? ph : em);
          log('Thank-you sent to ' + guestName(b) + ' by ' + via, b.ref); save(); closeModal(); refresh();
          toast(via === 'WhatsApp' ? 'WhatsApp is opening with the thank-you' : 'Thank-you emailed to ' + esc(em) + ' (demo: nothing really leaves this browser)');
        });
      } });
  }
  function logEmail(b, subject, body, att, to) {
    var t = DB.threads.filter(function (x) { return x.ref === b.ref && x.status !== 'closed'; })[0];
    if (!t) { t = { id: uid('t'), subject: subject, name: guestName(b), email: to || b.guest.email, phone: b.guest.phone, status: 'waiting', unread: false, ref: b.ref, msgs: [] }; DB.threads.push(t); }
    t.msgs.push({ from: 'staff', by: ME.name, at: nowStamp(), body: (t.subject !== subject ? 'Subject: ' + subject + '\n\n' : '') + body, att: att || [] }); t.status = 'waiting';
    return t;
  }
  function vEnquiries() {
    var all = DB.threads.slice().sort(function (a, b) { return lastMsg(a).at < lastMsg(b).at ? 1 : -1; });
    var cnt = {}; BOXES.forEach(function (x) { cnt[x[0]] = all.filter(function (t) { return x[0] === 'all' || t.status === x[0]; }).length; });
    var q = IN.q.toLowerCase();
    var hasAtt = function (t) { return t.msgs.some(function (m) { return m.att && m.att.length; }); };
    var list = all.filter(function (t) { return (IN.box === 'all' || t.status === IN.box || t.id === IN.id) && (!IN.f || (IN.f === 'unread' ? t.unread : IN.f === 'att' ? hasAtt(t) : IN.f === 'linked' ? t.ref : !t.ref)) && (!IN.age || lastMsg(t).at.slice(0, 10) >= add(TODAY, 1 - IN.age)) && (!q || (t.name + ' ' + t.email + ' ' + t.subject + ' ' + t.ref + ' ' + t.msgs.map(function (m) { return m.body; }).join(' ')).toLowerCase().indexOf(q) >= 0); });
    var t = IN.id ? thrById(IN.id) : null;
    return '<div class="page-h"><div><h1>Inbox</h1><p class="muted">Every email with a guest, kept together as one conversation. Replies go from info@kyleu.co.za.</p></div><div class="ph-act"><button class="btn" data-act="mail-new">' + ic('plus') + 'New email</button></div></div>' +
      '<div class="mail' + (t ? ' reading' : '') + '"><section class="card flush mail-list"><div class="mail-tools"><label class="search">' + ic('search') + '<input type="search" data-inq placeholder="Search name, subject or booking" value="' + esc(IN.q) + '" aria-label="Search emails"></label>' +
      '<div class="mail-filt">' + fsel('IN:f', IN.f, [['', 'All conversations'], ['unread', 'Unread'], ['att', 'With attachments'], ['linked', 'Linked to a booking'], ['unlinked', 'Not linked to a booking']]) + fsel('IN:age', IN.age, [['', 'Any time'], ['1', 'Today'], ['7', 'Last 7 days'], ['30', 'Last 30 days']]) + '</div>' +
      '<div class="mail-boxes">' + BOXES.map(function (x) { return '<button class="' + (IN.box === x[0] ? 'on' : '') + '" data-box="' + x[0] + '">' + x[1] + ' <span>' + cnt[x[0]] + '</span></button>'; }).join('') + '</div></div>' +
      '<ul>' + (list.length ? list.map(function (x) {
        var l = lastMsg(x), hasAtt = x.msgs.some(function (m) { return m.att && m.att.length; });
        return '<li><button class="' + (x.unread ? 'unread' : '') + (IN.id === x.id ? ' on' : '') + '" data-thread="' + x.id + '"><span class="av">' + esc(initials(x.name)) + '</span><span class="mi"><span class="mi-top"><b>' + esc(x.name) + '</b>' + (x.msgs.length > 1 ? '<em>' + x.msgs.length + '</em>' : '') + '<small>' + when(l.at) + '</small></span>' +
          '<span class="mi-subj">' + (hasAtt ? ic('clip') : '') + esc(x.subject) + '</span><span class="mi-prev">' + (l.from === 'staff' ? '<i>' + esc(l.by) + ':</i> ' : '') + esc(l.body.replace(/\s+/g, ' ').slice(0, 120)) + '</span>' + (x.ref ? '<span class="mi-ref">' + esc(x.ref) + '</span>' : '') + '</span></button></li>';
      }).join('') : '<li class="empty">Nothing here.</li>') + '</ul></section>' +
      '<section class="card flush mail-read">' + (t ? threadHTML(t) : '<div class="mail-empty">' + ic('mail') + '<p>Choose a conversation to read it.</p></div>') + '</section></div>';
  }
  function threadHTML(t) {
    var b = t.ref ? byRef(t.ref) : null, others = DB.bookings.filter(function (x) { return x.guest.email === t.email && (!b || x.ref !== b.ref); }).slice(-2);
    var st = { open: ['warn', 'Needs reply'], waiting: ['info', 'Waiting on guest'], closed: ['muted', 'Closed'] }[t.status];
    return '<header class="th-head"><button class="icon-btn back" data-thread="" aria-label="Back to the inbox">' + ic('chev-l') + '</button><div class="th-t"><h2>' + esc(t.subject) + '</h2><span class="pill ' + st[0] + '"><i></i>' + st[1] + '</span> <span class="muted small">' + t.msgs.length + ' email' + (t.msgs.length > 1 ? 's' : '') + '</span></div>' +
      (t.status === 'closed' ? '<button class="btn ghost sm" data-act="th-open" data-ref="' + t.id + '">Reopen</button>' : '<button class="btn ghost sm" data-act="th-close" data-ref="' + t.id + '">' + ic('check') + 'Mark as done</button>') + '</header>' +
      '<div class="th-who"><span class="av">' + esc(initials(t.name)) + '</span><div class="th-c"><b>' + esc(t.name) + '</b><small>' + esc(t.email) + (t.phone ? ' · ' + esc(t.phone) : '') + '</small></div><div class="th-links">' +
      (b ? '<button class="chip" data-open="' + b.ref + '">' + ic('list') + 'Booking ' + esc(b.ref) + '</button>' : '') + others.map(function (x) { return '<button class="chip" data-open="' + x.ref + '">' + esc(x.ref) + '</button>'; }).join('') +
      (b ? '' : '<button class="chip" data-act="enq-book" data-ref="' + t.id + '">' + ic('plus') + 'Make a booking</button>') + '</div></div>' +
      '<div class="th-msgs">' + t.msgs.map(function (m, i) {
        var mine = m.from === 'staff';
        return '<article class="msg ' + (mine ? 'out' : 'in') + '"><header><span class="av sm' + (mine ? ' us' : '') + '">' + esc(mine ? (m.by || 'K')[0] : initials(t.name)) + '</span><b>' + esc(mine ? m.by + ' (Kyleu)' : t.name) + '</b><small>' + fdw(m.at.slice(0, 10)) + ' at ' + m.at.slice(11, 16) + '</small></header><div class="msg-b">' + esc(m.body) + '</div>' +
          (m.att && m.att.length ? '<div class="att-row">' + m.att.map(function (a, j) {
            var key = 't:' + t.id + ':' + i + ':' + j, pop = !mine && b && b.status === 'pending' && /pdf|image/.test(a.type || '');
            return attChip(a, key) + (pop ? (a.linked ? '<span class="pill ok"><i></i>Added to ' + esc(b.ref) + '</span>' : '<button class="btn sm" data-act="att-pop" data-ref="' + key + '">' + ic('check') + 'Add to ' + esc(b.ref) + ' as proof of payment</button>') : '');
          }).join('') + '</div>' : '') + '</article>';
      }).join('') + '</div>' +
      '<form class="composer" data-reply="' + t.id + '"><div class="cmp-top"><span>' + ic('reply') + 'Reply to <b>' + esc(t.email) + '</b></span><select data-quick aria-label="Insert a saved reply"><option value="">Insert a saved reply</option>' + QUICK.map(function (q, i) { return '<option value="' + i + '">' + esc(q[0]) + '</option>'; }).join('') + '</select></div>' +
      '<textarea name="r" rows="5" aria-label="Your reply">Hi ' + esc(t.name.split(' ')[0]) + ',\n\n</textarea><div class="att-row" data-cmp-att></div>' +
      '<div class="cmp-bar"><label class="btn ghost sm file-btn">' + ic('clip') + 'Attach a file<input type="file" multiple data-cmp-file></label><span class="grow"></span><button class="btn ghost" type="submit" name="close" value="1">Send and mark as done</button><button class="btn" type="submit">' + ic('send') + 'Send</button></div>' +
      '<p class="demo-note">' + ic('info') + 'Demo: nothing is really sent. In the live version the guest gets this email and their answer appears here.</p></form>';
  }
  function cmpRefresh() { var el = $('[data-cmp-att]'); if (el) el.innerHTML = CMP_ATT.map(function (a, i) { return attChip(a, 'c:' + i) + '<button type="button" class="icon-btn sm" data-cmp-del="' + i + '" aria-label="Remove attachment">' + ic('x') + '</button>'; }).join(''); }
  function sendReply(f, close) {
    var t = thrById(f.dataset.reply), body = f.elements.r.value.trim();
    if (!body || body === 'Hi ' + t.name.split(' ')[0] + ',') { toast('Write a reply first'); return; }
    t.msgs.push({ from: 'staff', by: ME.name, at: nowStamp(), body: body + '\n\n' + ME.name + '\nKyleu Bush Camp', att: CMP_ATT.slice() });
    t.status = close ? 'closed' : 'waiting'; t.unread = false; CMP_ATT = [];
    var rb = t.ref ? byRef(t.ref) : null; if (rb) nudgeMark(rb, nudgeKinds(rb, '', body, []), 'Email');   // a reply that carries the booking link, the signing link or the codes counts too
    log('Emailed ' + t.name + ': ' + t.subject, t.ref); save(); render();
    toast('Reply sent to ' + esc(t.email) + (close ? ' and marked as done' : '') + ' (demo)');
  }
  function actNewMail() {
    var gs = guestsList();
    modal('New email', '<label class="fld"><span>To</span><input name="to" type="email" list="guest-emails" placeholder="Guest email address"><datalist id="guest-emails">' + gs.map(function (g) { return '<option value="' + esc(g.email) + '">' + esc(g.name) + '</option>'; }).join('') + '</datalist></label>' +
      '<label class="fld"><span>Subject</span><input name="s"></label><label class="fld"><span>Message</span><textarea name="b" rows="8"></textarea></label>', 'Send', function (f) {
        var to = fval(f, 'to'), s = fval(f, 's'), body = fval(f, 'b');
        if (!/.+@.+\..+/.test(to)) { toast('Enter the guest\'s email address'); return false; }
        if (!s || !body) { toast('Add a subject and a message'); return false; }
        var g = gs.filter(function (x) { return x.email === to; })[0], bk = DB.bookings.filter(function (x) { return x.guest.email === to && live(x) && x.co >= TODAY; })[0];
        var t = { id: uid('t'), subject: s, name: g ? g.name : to, email: to, phone: g ? g.phone : '', status: 'waiting', unread: false, ref: bk ? bk.ref : '', msgs: [{ from: 'staff', by: ME.name, at: nowStamp(), body: body + '\n\n' + ME.name + '\nKyleu Bush Camp', att: [] }] };
        if (bk) nudgeMark(bk, nudgeKinds(bk, '', body, []), 'Email');
        DB.threads.push(t); IN.id = t.id; IN.box = 'waiting'; log('Emailed ' + t.name + ': ' + s, t.ref); save(); render(); toast('Email sent to ' + esc(to) + ' (demo)');
      }, { wide: true });
  }

  /* =========================================================
     Payments: a ledger of every transaction, plus money still owed
     ========================================================= */
  var PAYF = { tab: 'tx', range: 'this_month', type: '', m: '', q: '', lim: 1e9, cst: '' };
  function vPayments() {
    var rg = simpleRange(PAYF.range), q = PAYF.q.toLowerCase(), owed = receivables();
    var inRange = allTx().filter(function (x) { return x.d >= rg[0] && x.d <= rg[1]; });
    var sum = function (f) { return inRange.filter(f).reduce(function (a, x) { return a + x.amt; }, 0); };
    var gross = sum(function (x) { return x.amt > 0; }), refunds = -sum(function (x) { return x.amt < 0; });
    var byM = { card: sum(function (x) { return x.m === 'card' && x.amt > 0; }), eft: sum(function (x) { return x.m === 'eft' && x.amt > 0; }), cash: sum(function (x) { return x.m === 'cash' && x.amt > 0; }) };
    var feeIn = inRange.reduce(function (a, x) { return a + x.fee; }, 0), prov = Math.round(byM.card * (DB.settings.providerFee || 2.95) / 100);
    var owedTot = owed.reduce(function (a, o) { return a + o.amt; }, 0);
    var head = '<div class="page-h"><div><h1>Payments</h1><p class="muted">Every rand that came in or went out. Click a line to open the booking or the shop receipt.</p></div><div class="ph-act">' + (PAYF.tab === 'tx' ? rangeSelect('data-payr', PAYF.range) + '<button class="btn ghost" data-act="csv-pay">' + ic('download') + 'Export</button>' : PAYF.tab === 'credits' ? '<button class="btn" data-act="credit-new">' + ic('plus') + 'Give a credit</button>' : '') + '</div></div>' +
      '<div class="rp-tabs page-tabs"><button class="' + (PAYF.tab === 'tx' ? 'on' : '') + '" data-paytab="tx">Transactions</button><button class="' + (PAYF.tab === 'owed' ? 'on' : '') + '" data-paytab="owed">Still to come in <span class="tab-n">' + money(owedTot) + '</span></button>' +
      '<button class="' + (PAYF.tab === 'credits' ? 'on' : '') + '" data-paytab="credits">Credits <span class="tab-n">' + money(DB.credits.filter(creditOk).reduce(function (a, c) { return a + creditRest(c); }, 0)) + '</span></button></div>';
    if (PAYF.tab === 'owed') return head + owedHTML(owed);
    if (PAYF.tab === 'credits') return head + creditsHTML();
    var list = inRange.filter(function (x) { return (!PAYF.type || x.kind === PAYF.type) && (!PAYF.m || x.m === PAYF.m) && (!q || (x.who + ' ' + x.what + ' ' + (x.ref || '') + ' ' + x.amt).toLowerCase().indexOf(q) >= 0); });
    var pct = function (v) { return gross ? Math.max(0, v / gross * 100) : 0; };
    var days = [], byDay = {};
    list.slice(0, PAYF.lim).forEach(function (x) { if (!byDay[x.d]) { byDay[x.d] = []; days.push(x.d); } byDay[x.d].push(x); });
    var dayTot = {}; list.forEach(function (x) { dayTot[x.d] = (dayTot[x.d] || 0) + x.amt; });
    return head +
      '<section class="card sum-card"><div class="sum-grid"><div><span>Money in</span><b>' + money(gross) + '</b><small>' + inRange.filter(function (x) { return x.amt > 0; }).length + ' payments and sales</small></div><div><span>Refunds</span><b class="' + (refunds ? 'bad-t' : '') + '">' + money(-refunds) + '</b><small>' + inRange.filter(function (x) { return x.amt < 0; }).length + ' refunds</small></div><div><span>Net</span><b>' + money(gross - refunds) + '</b><small>' + PAY_RANGES.filter(function (o) { return o[0] === PAYF.range; })[0][1].toLowerCase() + '</small></div>' +
      (hasFee() ? '<div><span>Card fee covered</span><b class="' + (feeIn >= prov ? 'ok-t' : 'warn-t') + '">' + money(feeIn) + '</b><small>The card company charges about ' + money(prov) + '</small></div>' : '<div><span>Still to come in</span><b>' + money(owedTot) + '</b><small>' + owed.length + ' bookings owe a deposit or balance</small></div>') + '</div>' +
      '<div class="split" role="img" aria-label="Card ' + money(byM.card) + ', EFT ' + money(byM.eft) + ', cash ' + money(byM.cash) + '"><span class="card-s" style="width:' + pct(byM.card) + '%"></span><span class="eft-s" style="width:' + pct(byM.eft) + '%"></span><span class="cash-s" style="width:' + pct(byM.cash) + '%"></span></div>' +
      '<div class="split-key"><span><i class="mth-i pm-card"></i>Card <b>' + money(byM.card) + '</b> ' + Math.round(pct(byM.card)) + '%</span><span><i class="mth-i pm-eft"></i>EFT <b>' + money(byM.eft) + '</b> ' + Math.round(pct(byM.eft)) + '%</span><span><i class="mth-i pm-cash"></i>Cash <b>' + money(byM.cash) + '</b> ' + Math.round(pct(byM.cash)) + '%</span></div></section>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-payq placeholder="Search name, booking ref or amount" value="' + esc(PAYF.q) + '" aria-label="Search payments"></label>' +
      '<select data-paym aria-label="Payment method"><option value="">All methods</option><option value="card"' + (PAYF.m === 'card' ? ' selected' : '') + '>Card</option><option value="eft"' + (PAYF.m === 'eft' ? ' selected' : '') + '>EFT</option><option value="cash"' + (PAYF.m === 'cash' ? ' selected' : '') + '>Cash</option></select></div>' +
      '<div class="chips">' + [['', 'Everything'], ['booking', 'Booking payments'], ['shop', 'Shop sales'], ['refund', 'Refunds']].map(function (o) { return '<button class="chip' + (PAYF.type === o[0] ? ' on' : '') + '" data-payt="' + o[0] + '">' + o[1] + ' <span>' + inRange.filter(function (x) { return !o[0] || x.kind === o[0]; }).length + '</span></button>'; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl ledger" data-sort-key="tx"><thead><tr><th>Time</th><th>Description</th><th>Type</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>' +
      (days.length ? days.map(function (d) {
        return '<tr class="day"><td colspan="4">' + dayLabel(d) + '</td><td class="r">' + money(dayTot[d]) + '</td></tr>' + byDay[d].map(function (x) {
          return '<tr ' + (x.ref ? 'data-open="' + x.ref + '"' : 'data-sale="' + x.sid + '"') + ' tabindex="0"><td data-l="Time" class="muted" data-s="' + x.d + ' ' + (x.t || '') + '">' + (x.t || fd(x.d)) + '</td><td data-l="Description"><b>' + esc(x.who) + '</b><small>' + esc(x.what) + '</small></td><td data-l="Type"><span class="tag' + (x.amt < 0 ? ' bad' : x.kind === 'shop' ? ' shop' : '') + '">' + esc(x.type) + '</span></td><td data-l="Method"><span class="mth pm-' + x.m + '"><i></i>' + methodLabel(x.m) + '</span></td><td data-l="Amount" class="r amt' + (x.amt < 0 ? ' bad-t' : '') + '">' + money(x.amt) + '</td></tr>';
        }).join('');
      }).join('') : '<tr><td colspan="5" class="empty">No payments match.</td></tr>') + '</tbody></table>' +
      (list.length > PAYF.lim ? '<div class="more"><button class="btn ghost" data-act="pay-more">Show more (' + (list.length - PAYF.lim) + ' left)</button></div>' : '') + '</div>';
  }
  function owedHTML(owed) {
    var late = owed.filter(function (o) { return o.late; }), soon = owed.filter(function (o) { return !o.late && diff(TODAY, o.due) <= 7; }), later = owed.filter(function (o) { return !o.late && diff(TODAY, o.due) > 7; });
    var tot = function (l) { return money(l.reduce(function (a, o) { return a + o.amt; }, 0)); };
    var rows = function (l) { return l.map(function (o) { var b = o.b, st = standById(b.stand), nx = nudgeOf(b, 'pay'), stale = o.late && nudgeStale(b, 'pay'); return '<tr data-open="' + b.ref + '" tabindex="0"' + (stale ? ' class="stale"' : '') + '><td data-l="Guest"><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + '</small></td><td data-l="Stay" data-s="' + b.ci + '">' + esc(st.name) + '<small>' + fd(b.ci) + ' to ' + fd(b.co) + '</small></td><td data-l="For">' + o.what + '<small>Pays by ' + methodLabel(b.method) + '</small></td><td data-l="Due" data-s="' + o.due + '" class="' + (o.late ? 'bad-t' : '') + '">' + fd(o.due) + '<small>' + (o.late ? 'Overdue ' + -diff(TODAY, o.due) + ' days' : rel(o.due)) + '</small></td><td data-l="Last reminded" class="td-nudge" data-s="' + (nx ? esc(String(nx.at)) : '0000-00-00') + '"><span class="nudge-t' + (stale ? ' stale' : '') + '" data-nudge="pay" title="' + esc(nudgeTip(b, 'pay')) + '">' + esc(nudgeTxt(b, 'pay')) + '</span></td><td data-l="Amount" class="r amt">' + money(o.amt) + '</td><td class="r row-btn"><button class="btn sm ghost" data-act="remind" data-kind="pay" data-ref="' + b.ref + '">' + ic('send') + 'Remind</button><button class="btn sm" data-act="pay" data-ref="' + b.ref + '">Record payment</button></td></tr>'; }).join(''); };
    var sec = function (title, l) { return l.length ? '<tr class="day"><td colspan="5">' + title + ' · ' + l.length + '</td><td class="r">' + tot(l) + '</td><td></td></tr>' + rows(l) : ''; };
    return '<div class="kpis">' + tile('Overdue', tot(late), late.length + ' booking' + (late.length === 1 ? '' : 's'), null, late.length ? 'warn' : 'ok') + tile('Due in the next 7 days', tot(soon), soon.length + ' booking' + (soon.length === 1 ? '' : 's')) + tile('Due later', tot(later), later.length + ' booking' + (later.length === 1 ? '' : 's')) + '</div>' +
      '<div class="card flush"><table class="tbl ledger owed" data-sort-key="owed"><thead><tr><th>Guest</th><th>Stay</th><th>For</th><th>Due</th><th>Last reminded</th><th class="r">Amount</th><th></th></tr></thead><tbody>' +
      (owed.length ? sec('Overdue', late) + sec('Due in the next 7 days', soon) + sec('Due later', later) : '<tr><td colspan="7" class="empty">Nothing owed. Everyone has paid.</td></tr>') + '</tbody></table></div>' +
      '<p class="demo-note">' + ic('info') + 'Deposits are due ' + num('Booking rules', 'Deposit due within days of invoice', 5) + ' days after the invoice, balances ' + num('Booking rules', 'Balance due days before arrival', 7) + ' days before arrival.</p>';
  }

  /* =========================================================
     Shop: a till like Square or Yoco, and the sales history
     ========================================================= */
  var SHOP = { tab: 'till', cat: '', q: '', who: '', range: 'today', sm: '', sq: '' };
  var CART = {};   // product id → how many
  function bookingsHere() { return DB.bookings.filter(function (b) { return live(b) && b.status !== 'pending' && b.status !== 'out' && b.ci <= TODAY && TODAY <= b.co && (b.status === 'in' || TODAY < b.co); }).sort(function (a, b) { return standById(a.stand).name < standById(b.stand).name ? -1 : 1; }); }
  function vShop() {
    return '<div class="page-h"><div><h1>Shop</h1><p class="muted">Ring up sales at reception and see everything the shop has sold.</p></div><div class="ph-act">' + (can('products') ? '<a class="btn ghost" href="#/products">' + ic('box') + 'Products and stock</a>' : '') + '</div></div>' +
      '<div class="rp-tabs page-tabs"><button class="' + (SHOP.tab === 'till' ? 'on' : '') + '" data-shoptab="till">Till</button><button class="' + (SHOP.tab === 'sales' ? 'on' : '') + '" data-shoptab="sales">Sales history</button></div>' +
      (SHOP.tab === 'till' ? tillHTML() : salesHTML());
  }
  function tillHTML() {
    var items = shopItems().filter(function (p) { return p.active !== false; }), q = SHOP.q.toLowerCase();
    var shown = items.filter(function (p) { return (!SHOP.cat || p.cat === SHOP.cat) && (!q || p.label.toLowerCase().indexOf(q) >= 0); });
    var cats = prodCats().filter(function (c) { return items.some(function (p) { return p.cat === c; }); });
    var lines = Object.keys(CART).filter(function (id) { return CART[id] > 0 && prodBy(id); });
    var tot = function (card) { return lines.reduce(function (a, id) { var p = prodBy(id); return a + (card ? toCard(p.amount) : p.amount) * CART[id]; }, 0); };
    var here = bookingsHere(), wb = whoOf(), who = wb.b, dis = lines.length ? '' : ' disabled';
    var todays = receipts().filter(function (r) { return r.d === TODAY && r.amt > 0; });
    return '<div class="pos-wrap"><section class="card pos-cat"><div class="pos-tools"><label class="search">' + ic('search') + '<input type="search" data-shopq placeholder="Search products" value="' + esc(SHOP.q) + '" aria-label="Search products"></label></div>' +
      '<div class="chips scroll"><button class="chip' + (!SHOP.cat ? ' on' : '') + '" data-pcat="">All</button>' + cats.map(function (c) { return '<button class="chip' + (SHOP.cat === c ? ' on' : '') + '" data-pcat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="pos">' + shown.map(function (p) {
        var left = p.stock == null ? null : p.stock - (CART[p.id] || 0), out = left !== null && left <= 0;
        return '<button class="pos-it' + (CART[p.id] ? ' on' : '') + '" data-add="' + p.id + '"' + (out ? ' disabled' : '') + '>' + prodPicHTML(p, 'pos-img') + '<b>' + esc(p.label) + '</b><span class="pos-p">' + money(p.amount) + (hasFee() ? '<small>Card ' + money(toCard(p.amount)) + '</small>' : '') + '</span>' + (left !== null ? '<span class="pos-stock' + (left <= (p.lowAt || 5) ? ' low' : '') + '">' + (out ? 'Sold out' : left + ' left') + '</span>' : '') + (CART[p.id] ? '<em data-roll="b:' + p.id + '">' + CART[p.id] + '</em>' : '') + '</button>';
      }).join('') + (shown.length ? '' : '<p class="empty">No products match.</p>') + '</div></section>' +
      '<aside class="card pos-sale"><header class="card-h"><h3>Current sale</h3>' + (lines.length ? '<button class="btn ghost sm" data-act="cart-clear">Clear</button>' : '') + '</header>' +
      (lines.length ? '<div class="sale-lines">' + lines.map(function (id) { var p = prodBy(id); return '<div class="sl"><div class="sl-n"><b>' + esc(p.label) + '</b><small>' + money(p.amount) + ' each</small></div><div class="qty"><button class="icon-btn sm" data-rem="' + id + '" aria-label="One less">' + ic('minus') + '</button><span data-roll="q:' + id + '">' + CART[id] + '</span><button class="icon-btn sm" data-add="' + id + '" aria-label="One more">' + ic('plus') + '</button></div><b class="sl-t" data-roll="t:' + id + '">' + money(p.amount * CART[id]) + '</b></div>'; }).join('') + '</div>' : '<div class="sale-empty">' + ic('cart') + '<p>Tap a product to add it to the sale.</p></div>') +
      '<label class="fld"><span>Who is it for?</span><select data-who><option value="">Walk-in customer (pays now)</option>' + here.map(function (b) { var cs = ensureCars(b).filter(function (c) { return c.st === 'in'; }), nm = standById(b.stand).name + ' · ' + guestName(b); if (!cs.length) return '<option value="' + b.ref + '"' + (SHOP.who === b.ref ? ' selected' : '') + '>' + esc(nm) + '</option>'; return '<optgroup label="' + esc(nm) + '">' + cs.map(function (c) { var k = b.ref + '|' + c.id; return '<option value="' + k + '"' + (SHOP.who === k ? ' selected' : '') + '>' + esc(carLabel(c, b.cars.indexOf(c)) + (c.driver ? ' · ' + c.driver : '')) + '</option>'; }).join('') + '</optgroup>'; }).join('') + '</select></label>' +
      '<div class="sale-tot"><div><span>Cash or EFT</span><b data-roll="tot:cash">' + money(tot(false)) + '</b></div>' + (hasFee() ? '<div class="muted"><span>Card (+' + cardFee() + '%)</span><b data-roll="tot:card">' + money(tot(true)) + '</b></div>' : '') + '</div>' +
      '<div class="pay-btns"><button class="btn" data-sell="cash"' + dis + '>' + ic('cash') + 'Cash ' + money(tot(false)) + '</button><button class="btn blue" data-sell="card"' + dis + '>' + ic('card') + 'Card ' + money(tot(true)) + '</button>' + (who ? '<button class="btn ghost full" data-sell="bill"' + dis + '>' + ic('list') + (wb.car ? 'Add to ' + esc(guestName(who)) + '\'s tab (' + esc(wb.label) + ')' : 'Add to ' + esc(guestName(who)) + '\'s bill') + '</button>' : '') + '</div>' +
      (who && wb.car ? '<p class="muted small">Goes on this vehicle\'s tab. They settle it when the vehicle checks out.</p>' : who ? '<p class="muted small">"Add to bill" puts it on ' + esc(guestName(who)) + '\'s booking. They pay it with their balance.</p>' : '') + '</aside></div>' +
      (lines.length ? '<button class="cart-bar" data-act="to-sale">' + ic('cart') + '<span>' + lines.reduce(function (a, id) { return a + CART[id]; }, 0) + ' item' + (lines.reduce(function (a, id) { return a + CART[id]; }, 0) === 1 ? '' : 's') + ' · <b>' + money(tot(false)) + '</b></span><span>View sale</span></button>' : '') +
      '<div class="today-strip">' + ic('clock') + '<span>Today so far: <b>' + todays.length + ' sale' + (todays.length === 1 ? '' : 's') + '</b>, <b>' + money(todays.reduce(function (a, r) { return a + r.amt; }, 0)) + '</b></span><button class="btn ghost sm" data-shoptab="sales">See all sales</button></div>';
  }
  function whoOf() { var p = (SHOP.who || '').split('|'), b = p[0] ? byRef(p[0]) : null, car = b && p[1] ? (b.cars || []).filter(function (c) { return c.id === p[1]; })[0] : null; return { b: b, car: car, label: car ? carLabel(car, b.cars.indexOf(car)) : '' }; }
  function sell(m) {
    var lines = Object.keys(CART).filter(function (id) { return CART[id] > 0 && prodBy(id); }); if (!lines.length) return;
    var wb = whoOf(), b = wb.b; if (m === 'bill' && !b) return;
    var sid = uid('S'), t = hhmm(), total = 0, eftT = 0, cardT = 0;
    lines.forEach(function (id) {
      var p = prodBy(id), q = CART[id], e = p.amount * q, c = toCard(p.amount) * q, amt = m === 'card' ? c : m === 'bill' ? (b.method === 'card' ? c : e) : e;
      total += amt; eftT += e; cardT += c;
      DB.sales.push({ sid: sid, d: TODAY, t: t, item: p.label, pid: p.id, qty: q, m: m, amt: amt, stand: b ? standById(b.stand).name : '', ref: b ? b.ref : '', car: wb.car ? wb.label : '', by: ME.name });
      if (p.stock != null) p.stock = Math.max(0, p.stock - q);
    });
    if (m === 'bill') { b.charges = b.charges || []; b.charges.push({ d: TODAY, desc: 'Shop: ' + lines.map(function (id) { return CART[id] + ' × ' + prodBy(id).label; }).join(', '), e: eftT, c: cardT, sid: sid, car: wb.car ? wb.car.id : '' }); b.eft += eftT; b.card += cardT; b.total = b.method === 'card' ? b.card : b.eft; }
    CART = {}; SHOP.who = ''; log('Shop sale ' + money(total) + ' (' + saleMethod(m) + ')' + (b ? ' for ' + guestName(b) : ''), b ? b.ref : ''); save(); render();
    toast(m === 'bill' ? money(total) + ' added to ' + esc(guestName(b)) + (wb.car ? '\'s tab (' + esc(wb.label) + ', ' + esc(standById(b.stand).name) + ')' : '\'s bill') : 'Sale of ' + money(total) + ' recorded (' + saleMethod(m) + ')');
  }
  function salesHTML() {
    var rg = simpleRange(SHOP.range), sq = SHOP.sq.toLowerCase(), rs = receipts().filter(function (r) { return r.d >= rg[0] && r.d <= rg[1] && (!SHOP.sm || r.m === SHOP.sm) && (!sq || (r.summary + ' ' + r.stand + ' ' + r.guest + ' ' + r.by).toLowerCase().indexOf(sq) >= 0); });
    var sales = rs.filter(function (r) { return r.amt > 0; }), refunds = rs.filter(function (r) { return r.amt < 0; });
    var total = rs.reduce(function (a, r) { return a + r.amt; }, 0), items = sales.reduce(function (a, r) { return a + r.qty; }, 0), onBill = sales.filter(function (r) { return r.m === 'bill'; }).reduce(function (a, r) { return a + r.amt; }, 0);
    var best = {}; sales.forEach(function (r) { r.lines.forEach(function (l) { best[l.item] = (best[l.item] || 0) + l.amt; }); });
    var top = Object.keys(best).sort(function (a, b) { return best[b] - best[a]; }).slice(0, 6);
    var days = [], byDay = {}; rs.forEach(function (r) { if (!byDay[r.d]) { byDay[r.d] = []; days.push(r.d); } byDay[r.d].push(r); });
    return '<div class="filters">' + fsearch('SHOP:sq', SHOP.sq, 'Search item, stand, guest or staff') + rangeSelect('data-shopr', SHOP.range) + fsel('SHOP:sm', SHOP.sm, [['', 'Paid by: any'], ['cash', 'Cash'], ['card', 'Card'], ['bill', 'On a guest\'s bill']]) + '<button class="btn ghost" data-act="csv-sales">' + ic('download') + 'Export</button></div>' +
      '<div class="kpis">' + tile('Shop sales', money(total), sales.length + ' sale' + (sales.length === 1 ? '' : 's') + (refunds.length ? ' · ' + refunds.length + ' refunded' : '')) + tile('Items sold', items, top[0] ? 'Most sold: ' + esc(top[0]) : '') + tile('Average sale', money(sales.length ? total / sales.length : 0), 'per customer') + tile('Put on guests\' bills', money(onBill), 'paid with their booking') + '</div>' +
      '<div class="cols"><section class="card flush"><table class="tbl ledger" data-sort-key="sales"><thead><tr><th>Time</th><th>Items</th><th>For</th><th>Paid by</th><th class="r">Amount</th></tr></thead><tbody>' +
      (days.length ? days.map(function (d) {
        return '<tr class="day"><td colspan="4">' + dayLabel(d) + '</td><td class="r">' + money(byDay[d].reduce(function (a, r) { return a + r.amt; }, 0)) + '</td></tr>' + byDay[d].map(function (r) {
          return '<tr data-sale="' + r.sid + '" tabindex="0"><td data-l="Time" class="muted" data-s="' + r.d + ' ' + r.t + '">' + r.t + '</td><td data-l="Items"><b>' + esc(r.summary) + '</b>' + (r.refunded ? ' <span class="tag bad">Refunded</span>' : '') + (r.amt < 0 ? ' <span class="tag bad">Refund</span>' : '') + '<small>by ' + esc(r.by || 'staff') + '</small></td><td data-l="For">' + (r.stand ? esc(r.stand) + (r.guest ? '<small>' + esc(r.guest) + '</small>' : '') : '<span class="muted">Walk-in</span>') + '</td><td data-l="Paid by"><span class="mth pm-' + r.m + '"><i></i>' + saleMethod(r.m) + '</span></td><td data-l="Amount" class="r amt' + (r.amt < 0 ? ' bad-t' : '') + '">' + money(r.amt) + '</td></tr>';
        }).join('');
      }).join('') : '<tr><td colspan="5" class="empty">No sales in this period.</td></tr>') + '</tbody></table></section>' +
      '<section class="card"><header class="card-h"><h3>Best sellers</h3><span class="muted small">By money taken</span></header>' + (top.length ? hbars(top.map(function (k) { return { l: k, v: best[k], t: money(best[k]) }; })) : '<p class="empty">No sales yet.</p>') + '</section></div>';
  }
  function openSale(sid) {
    var r = receipts().filter(function (x) { return x.sid === sid; })[0]; if (!r) return;
    var canRefund = r.amt > 0 && !r.refunded && r.m !== 'bill';
    modal(r.amt < 0 ? 'Refund' : 'Receipt', '<div class="receipt"><div class="rc-head"><img src="../assets/img/logo-small.png" alt="" width="40"><div><b>Kyleu Bush Camp shop</b><small>' + fdw(r.d) + ' at ' + r.t + ' · served by ' + esc(r.by || 'staff') + '</small></div></div>' +
      r.lines.map(function (l) { return '<div class="ln"><span>' + Math.abs(l.qty) + ' × ' + esc(l.item) + '</span><span>' + money(l.amt) + '</span></div>'; }).join('') +
      '<div class="ln tot"><span>Total · ' + saleMethod(r.m) + '</span><span>' + money(r.amt) + '</span></div>' +
      (r.stand ? '<p class="muted small">For ' + esc(r.stand) + (r.guest ? ', ' + esc(r.guest) : '') + '</p>' : '<p class="muted small">Walk-in customer</p>') +
      (r.refunded ? '<p><span class="pill bad"><i></i>This sale was refunded</span></p>' : '') + (r.m === 'bill' ? '<p class="muted small">Put on the guest\'s bill. Change it from the booking.</p>' : '') + '</div>' +
      (r.ref ? '<button type="button" class="btn ghost sm" data-open="' + r.ref + '">' + ic('list') + 'Open booking ' + r.ref + '</button>' : ''),
      canRefund ? 'Refund ' + money(r.amt) : null, canRefund ? function () { refundSale(r); } : null, { danger: true, noFocus: true });
  }
  function refundSale(r) {
    var sid = uid('S');
    r.lines.forEach(function (l) { DB.sales.push({ sid: sid, d: TODAY, t: hhmm(), item: l.item, pid: l.pid, qty: -l.qty, m: r.m, amt: -l.amt, stand: l.stand, ref: l.ref, by: ME.name, refundOf: r.sid }); var p = prodBy(l.pid); if (p && p.stock != null) p.stock += l.qty; });
    log('Refunded shop sale of ' + money(r.amt) + ' (' + methodLabel(r.m) + ')'); save(); render(); toast(money(r.amt) + ' refunded (' + methodLabel(r.m) + '). Stock put back.');
  }

  /* =========================================================
     Products: the shop's catalogue, like Shopify's product list
     ========================================================= */
  var PROD = { q: '', cat: '', stock: '' };
  function soldSince(days) { var from = add(TODAY, -days + 1), m = {}; DB.sales.forEach(function (s) { if (s.d >= from && s.pid && s.m) { m[s.pid] = m[s.pid] || { q: 0, v: 0 }; m[s.pid].q += s.qty; m[s.pid].v += s.amt; } }); return m; }
  function vProducts() {
    var items = shopItems(), sold = soldSince(30), q = PROD.q.toLowerCase(), cats = prodCats();
    var list = items.filter(function (p) { return (!PROD.cat || p.cat === PROD.cat) && (!PROD.stock || (PROD.stock === 'low' ? lowStock(p) : PROD.stock === 'counted' ? p.stock != null : PROD.stock === 'uncounted' ? p.stock == null : PROD.stock === 'hidden' ? p.active === false : p.active !== false)) && (!q || (p.label + ' ' + (p.note || '')).toLowerCase().indexOf(q) >= 0); });
    var low = items.filter(lowStock), sq = 0, sv = 0; Object.keys(sold).forEach(function (k) { sq += sold[k].q; sv += sold[k].v; });
    return '<div class="page-h"><div><h1>Products</h1><p class="muted">Everything the camp shop sells. ' + (hasFee() ? 'Enter the cash and EFT price; card payments add ' + cardFee() + '%.' : 'One price, however the guest pays.') + '</p></div><div class="ph-act"><button class="btn" data-act="prod-add">' + ic('plus') + 'Add product</button></div></div>' +
      '<div class="kpis">' + tile('Products', items.length, items.filter(function (p) { return p.active !== false; }).length + ' showing on the till') + tile('Low on stock', low.length, low.length ? low.map(function (p) { return esc(p.label); }).slice(0, 2).join(', ') : 'All stocked up', null, low.length ? 'warn' : 'ok') + tile('Sold in the last 30 days', sq + ' items', money(sv)) + '</div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-prodq placeholder="Search products" value="' + esc(PROD.q) + '" aria-label="Search products"></label>' + fsel('PROD:stock', PROD.stock, [['', 'Any stock level'], ['low', 'Low on stock'], ['counted', 'Stock counted'], ['uncounted', 'Stock not counted'], ['on', 'On the till'], ['hidden', 'Hidden from the till']]) + '</div>' +
      '<div class="chips scroll"><button class="chip' + (!PROD.cat ? ' on' : '') + '" data-prodcat="">All <span>' + items.length + '</span></button>' + cats.map(function (c) { var n = items.filter(function (p) { return p.cat === c; }).length; return n ? '<button class="chip' + (PROD.cat === c ? ' on' : '') + '" data-prodcat="' + esc(c) + '">' + esc(c) + ' <span>' + n + '</span></button>' : ''; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl prods"><thead><tr><th>Product</th><th>Category</th><th class="r">Price</th><th class="r">In stock</th><th class="r">Sold, 30 days</th><th>Status</th></tr></thead><tbody>' +
      (list.length ? list.map(function (p) {
        var s = sold[p.id] || { q: 0, v: 0 };
        return '<tr data-prod="' + p.id + '" tabindex="0"><td data-l="Product"><div class="prod-cell">' + prodPicHTML(p, 'prod-thumb') + '<div><b>' + esc(p.label) + '</b>' + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</div></div></td><td data-l="Category">' + esc(p.cat || '') + '</td><td data-l="Price" class="r">' + money(p.amount) + (hasFee() ? '<small>Card ' + money(toCard(p.amount)) + '</small>' : '') + '</td>' +
          '<td data-l="In stock" class="r" data-s="' + (p.stock == null ? -1 : p.stock) + '">' + (p.stock == null ? '<span class="muted">Not counted</span>' : lowStock(p) ? '<span class="pill warn"><i></i>' + p.stock + ' left</span>' : p.stock) + '</td><td data-l="Sold" class="r" data-s="' + s.q + '">' + s.q + '<small>' + money(s.v) + '</small></td>' +
          '<td data-l="Status">' + (p.active === false ? '<span class="pill muted"><i></i>Hidden</span>' : '<span class="pill ok"><i></i>On the till</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">No products match.</td></tr>') + '</tbody></table></div>' +
      '<p class="demo-note">' + ic('info') + 'Click a product to change its price, stock or category. In the live version these prices also show on the website\'s Rates page.</p>';
  }
  function actProduct(id, copyId) {
    var items = shopItems(), it = id ? prodBy(id) : null, src = it || (copyId ? prodBy(copyId) : null), cats = prodCats(), cat = src ? src.cat : SHOP.cat || PROD.cat || CATS[0];
    var track = src ? src.stock != null : true, pic = src && src.img ? src.img : '';
    var phHTML = function (name) {
      var cur = pic ? imgSrc(pic) : prodPic({ label: name || '' });
      return '<div class="pp-cur' + (cur ? '' : ' none') + '">' + (cur ? '<img src="' + esc(cur) + '" alt="">' : ic('image')) + '</div>' +
        '<div class="pp-side"><b>Photo</b><small>' + (pic ? 'Shows on the till, on the booking page and in the website\'s Camp shop.' : cur ? 'Kyleu\'s standard photo for this product. Upload your own to change it.' : 'No photo yet. Until you add one, the website shows the Kyleu logo.') + '</small>' +
        '<div class="row-btns"><label class="btn ghost sm">' + ic('image') + (pic ? 'Change photo' : 'Upload a photo') + '<input type="file" accept="image/*" data-pp-file hidden></label>' + (pic ? '<button type="button" class="btn ghost sm danger-t" data-pp-del>' + ic('x') + 'Remove photo</button>' : '') + '</div>' +
        '<div class="pp-picks"><small>Or use one of Kyleu\'s shop photos</small><div>' + (K.SHOP_PHOTOS || []).map(function (p) { return '<button type="button" class="pp-pick' + (pic === p ? ' on' : '') + '" data-pp-pick="' + p + '" aria-label="Use this photo" aria-pressed="' + (pic === p) + '"><img src="' + imgSrc(p) + '" alt=""></button>'; }).join('') + '</div></div></div>';
    };
    modal(it ? 'Edit product' : src ? 'Duplicate product' : 'Add product',
      '<label class="fld"><span>Product name</span><input name="n" value="' + (src ? esc(it ? src.label : 'Copy of ' + src.label) : '') + '" placeholder="e.g. Braai tongs" autocomplete="off"></label>' +
      '<div class="grid2"><label class="fld"><span>Category</span><select name="c" data-catsel>' + cats.map(function (c) { return '<option' + (c === cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value="__new">New category…</option></select></label><label class="fld" data-newcat hidden><span>New category name</span><input name="nc"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Price for cash and EFT</span><input name="a" inputmode="decimal" value="' + (src ? src.amount : '') + '" placeholder="R" data-prod-price></label><label class="fld"><span>Card price (+' + cardFee() + '%)</span><input data-prod-card value="' + (src ? money(toCard(src.amount)) : '') + '" disabled></label></div>' +
      '<label class="fld"><span>Short description (optional)</span><input name="t" value="' + (src ? esc(src.note || '') : '') + '" placeholder="e.g. Enamel, two designs"></label>' +
      '<div class="prod-ph" data-prod-ph>' + phHTML(src ? src.label : '') + '</div>' +
      '<h5>Stock</h5><label class="check"><input type="checkbox" name="track" data-track' + (track ? ' checked' : '') + '><span>Count stock for this product</span></label>' +
      '<div class="grid2" data-stockf' + (track ? '' : ' hidden') + '><label class="fld"><span>In stock now</span><input name="s" inputmode="numeric" data-stp min="0" max="9999" value="' + (src && src.stock != null ? src.stock : '') + '"></label><label class="fld"><span>Warn me when it gets to</span><input name="l" inputmode="numeric" data-stp min="0" max="999" value="' + (src ? src.lowAt || 5 : 5) + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="on"' + (!src || src.active !== false ? ' checked' : '') + '><span>Show this product on the till</span></label>' +
      (it ? '<div class="m-extra"><button type="button" class="btn ghost sm" data-act="prod-dup" data-ref="' + it.id + '">Duplicate</button><button type="button" class="btn ghost sm danger-t" data-act="prod-del" data-ref="' + it.id + '">Delete product</button></div>' : ''),
      it ? 'Save' : 'Add product', function (f) {
        var nm = fval(f, 'n'), amt = parseFloat(fval(f, 'a').replace(/[^\d.]/g, '')), c = fval(f, 'c') === '__new' ? fval(f, 'nc') : fval(f, 'c');
        if (!nm) { toast('Give the product a name'); return false; }
        if (isNaN(amt)) { toast('Enter a price'); return false; }
        if (!c) { toast('Name the new category'); return false; }
        if (items.some(function (x) { return x !== it && K.norm(x.label) === K.norm(nm); })) { toast('There is already a product called ' + esc(nm)); return false; }
        var tr = fval(f, 'track'), s = parseInt(fval(f, 's'), 10);
        var row = { label: nm, amount: amt, note: fval(f, 't'), cat: c, active: fval(f, 'on'), stock: tr ? (isNaN(s) ? 0 : s) : null, lowAt: parseInt(fval(f, 'l'), 10) || 5, img: pic };
        var tgt = it;
        if (it) Object.keys(row).forEach(function (k) { it[k] = row[k]; });
        else { var base = slugify(nm), pid = base, n = 2; while (prodBy(pid)) pid = base + '-' + n++; row.id = pid; DB.products.push(row); tgt = row; }
        log((it ? 'Updated product ' : 'Added product ') + nm);
        if (!save()) { tgt.img = src && src.img && src.img !== pic ? src.img : ''; save(); render(); toast('Saved, but the photo is too big for this browser. Try a smaller photo.'); return; }
        render(); toast(esc(nm) + (it ? ' saved' : ' added to the shop'));
      }, { wide: true, noFocus: !!it, onOpen: function (f) {
        var box = $('[data-prod-ph]', f), draw = function () { box.innerHTML = phHTML(fval(f, 'n')); };
        f.addEventListener('change', function (e) {
          if (!e.target.matches('[data-pp-file]')) return;
          var file = e.target.files && e.target.files[0]; if (!file) return;
          resizeImg(file, 640, function (blob) {
            if (!blob) { toast('That file is not a photo that can be used. Try a JPG or PNG.'); return; }
            var rd = new FileReader(); rd.onload = function () { pic = rd.result; draw(); }; rd.readAsDataURL(blob);
          });
        });
        box.addEventListener('click', function (e) {
          var pk = e.target.closest('[data-pp-pick]'); if (pk) { pic = pk.dataset.ppPick; draw(); return; }
          if (e.target.closest('[data-pp-del]')) { pic = ''; draw(); }
        });
        f.elements.n.addEventListener('input', function () { if (!pic) draw(); });   // the standard photo follows the name
      } });
  }
  function actRemoveProduct(id) {
    var it = prodBy(id);
    modal('Delete ' + esc(it.label) + '?', '<p>It comes off the till and the price list. Past sales keep their history.</p><p class="muted small">Only selling it for a while? Untick "Show this product on the till" instead.</p>', 'Delete product', function () {
      DB.products.splice(DB.products.indexOf(it), 1); delete CART[id]; log('Deleted product ' + it.label); save(); render(); toast(esc(it.label) + ' deleted');
    }, { danger: true });
  }

  /* =========================================================
     Game drives: a schedule, like an activity booking system
     ========================================================= */
  var SLOTS = { am: 'Morning · 06:00', pm: 'Afternoon · 15:30' }, SEATS = 10, GUIDES = ['Devon', 'Kyran'], GD = { guide: '', slot: '' };
  function drivePrice(n) { return n >= 3 ? n * num('Game drives', 'Game drive 3 or more people per person', 400) : n === 2 ? 2 * num('Game drives', 'Game drive 2 people per person', 450) : n === 1 ? num('Game drives', 'Game drive 1 person', 900) : 0; }
  function vDrives() {
    var all = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd; });
    var need = all.filter(function (b) { return !b.drive && b.co >= TODAY; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    var sched = all.filter(function (b) { return b.drive && b.drive.d >= TODAY && (!GD.guide || b.drive.guide === GD.guide) && (!GD.slot || b.drive.slot === GD.slot); });
    var wk = sched.filter(function (b) { return b.drive.d <= add(TODAY, 6); }), slotsWk = {}; wk.forEach(function (b) { slotsWk[b.drive.d + b.drive.slot] = 1; });
    var month = TODAY.slice(0, 7), inc = all.filter(function (b) { return (b.drive ? b.drive.d : b.ci).slice(0, 7) === month; }).reduce(function (a, b) { return a + drivePrice(b.extras.gd); }, 0);
    var days = []; for (var i = 0; i < 14; i++) days.push(add(TODAY, i));
    return '<div class="page-h"><div><h1>Game drives</h1><p class="muted">Guided drives with a Kyleu guide. ' + money(num('Game drives', 'Game drive 3 or more people per person', 400)) + ' per person for 3 or more, ' + money(num('Game drives', 'Game drive 2 people per person', 450)) + ' each for 2, ' + money(num('Game drives', 'Game drive 1 person', 900)) + ' for one person.</p></div><div class="ph-act"><button class="btn" data-act="drive-add">' + ic('plus') + 'Add a game drive</button></div></div>' +
      '<div class="kpis">' + tile('Drives in the next 7 days', Object.keys(slotsWk).length, wk.reduce(function (a, b) { return a + b.extras.gd; }, 0) + ' guests going') + tile('Waiting for a time', need.length, need.length ? 'Pick a time and a guide' : 'Everything is scheduled', null, need.length ? 'warn' : 'ok') + tile('Drive income this month', money(inc), 'at EFT prices') + '</div>' +
      (need.length ? '<section class="card"><header class="card-h"><h3>Waiting for a time</h3><span class="muted small">No time set yet</span></header>' + need.map(function (b) { return '<div class="brow"><span class="brow-st">' + b.extras.gd + ' ' + (b.extras.gd === 1 ? 'person' : 'people') + '</span><span class="brow-g" data-open="' + b.ref + '"><b>' + esc(guestName(b)) + '</b><small>' + esc(standById(b.stand).name) + ' · staying ' + fd(b.ci) + ' to ' + fd(b.co) + '</small></span><button class="btn sm" data-act="drive-set" data-ref="' + b.ref + '">' + ic('clock') + 'Set a time</button></div>'; }).join('') + '</section>' : '') +
      '<section class="card"><header class="card-h"><h3>The next two weeks</h3><div class="ph-act">' + fsel('GD:guide', GD.guide, [['', 'All guides']].concat(GUIDES.map(function (g) { return [g, 'Guide: ' + g]; }))) + fsel('GD:slot', GD.slot, [['', 'Morning and afternoon'], ['am', 'Mornings only'], ['pm', 'Afternoons only']]) + '</div></header>' + days.map(function (d) {
        var any = sched.some(function (b) { return b.drive.d === d; });
        if (!any && (GD.guide || GD.slot)) return '';
        return '<div class="gd-day' + (any ? '' : ' quiet') + '"><div class="gd-date"><b>' + fd(d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</b><small>' + (d === TODAY ? 'Today' : rel(d)) + '</small></div><div class="gd-slots">' + ['am', 'pm'].map(function (s) {
          var ps = sched.filter(function (b) { return b.drive.d === d && b.drive.slot === s; }), n = ps.reduce(function (a, b) { return a + b.extras.gd; }, 0);
          if (!n) return '<div class="gd-slot empty"><b>' + SLOTS[s] + '</b><span class="muted small">No one booked</span></div>';
          return '<div class="gd-slot"><div class="gd-top"><b>' + SLOTS[s] + '</b><span class="small">Guide: <b>' + esc(ps[0].drive.guide || 'not set') + '</b></span></div><div class="seats' + (n > SEATS ? ' over' : '') + '"><span style="width:' + Math.min(100, n / SEATS * 100) + '%"></span></div><small class="' + (n > SEATS ? 'bad-t' : 'muted') + '">' + n + ' of ' + SEATS + ' seats' + (n > SEATS ? ': needs a second vehicle' : '') + '</small>' +
            '<ul>' + ps.map(function (b) { return '<li><button data-act="drive-set" data-ref="' + b.ref + '"><b>' + esc(guestName(b)) + '</b> · ' + b.extras.gd + (b.extras.gd === 1 ? ' person' : ' people') + ' · ' + esc(standById(b.stand).name) + '</button></li>'; }).join('') + '</ul></div>';
        }).filter(function (h, si) { return !GD.slot || ['am', 'pm'][si] === GD.slot; }).join('') + '</div></div>';
      }).join('') + '</section>';
  }
  // set (or change) the time, the guide and how many people; the price on the booking follows
  function actDrive(ref) {
    var pre = ref ? byRef(ref) : null, here = DB.bookings.filter(function (b) { return live(b) && b.status !== 'pending' && b.co >= TODAY; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    var dr = pre && pre.drive ? pre.drive : { d: pre ? (pre.ci < TODAY ? TODAY : pre.ci) : TODAY, slot: 'pm', guide: GUIDES[0] };
    modal(pre && pre.extras && pre.extras.gd ? 'Game drive for ' + esc(guestName(pre)) : 'Add a game drive',
      (pre ? '<p class="muted small">' + esc(standById(pre.stand).name) + ' · staying ' + fd(pre.ci) + ' to ' + fd(pre.co) + '</p><input type="hidden" name="b" value="' + pre.ref + '">' : '<label class="fld"><span>Booking</span><select name="b">' + here.map(function (b) { return '<option value="' + b.ref + '">' + esc(standById(b.stand).name + ' · ' + guestName(b) + ' · ' + fd(b.ci) + ' to ' + fd(b.co)) + '</option>'; }).join('') + '</select></label>') +
      '<div class="grid2"><label class="fld"><span>People</span><input name="n" inputmode="numeric" data-stp min="1" max="20" value="' + (pre && pre.extras && pre.extras.gd || 2) + '" data-gd-n></label><label class="fld"><span>Price (EFT)</span><input data-gd-p value="' + money(drivePrice(pre && pre.extras && pre.extras.gd || 2)) + '" disabled></label></div>' +
      '<div class="grid2"><label class="fld"><span>Date</span><input type="date" name="d" value="' + dr.d + '"></label><label class="fld"><span>Guide</span><select name="g">' + GUIDES.map(function (g) { return '<option' + (g === dr.guide ? ' selected' : '') + '>' + g + '</option>'; }).join('') + '</select></label></div>' +
      '<div class="seg">' + ['am', 'pm'].map(function (s) { return '<label><input type="radio" name="s" value="' + s + '"' + (dr.slot === s ? ' checked' : '') + '><span>' + SLOTS[s] + '</span></label>'; }).join('') + '</div>' +
      (pre && pre.drive ? '<div class="m-extra"><button type="button" class="btn ghost sm danger-t" data-act="drive-del" data-ref="' + pre.ref + '">Cancel this game drive</button></div>' : ''),
      'Save', function (f) {
        var b = byRef(fval(f, 'b')), n = parseInt(fval(f, 'n'), 10), d = fval(f, 'd');
        if (!(n > 0)) { toast('How many people?'); return false; }
        if (d < b.ci || d > b.co) { toast('Pick a day during the stay (' + fd(b.ci) + ' to ' + fd(b.co) + ')'); return false; }
        var before = drivePrice((b.extras && b.extras.gd) || 0), delta = drivePrice(n) - before;
        b.extras = b.extras || {}; b.extras.gd = n; b.drive = { d: d, slot: $('[name=s]:checked', f).value, guide: fval(f, 'g') };
        if (delta) { b.eft += delta; b.card += toCard(delta); b.total = b.method === 'card' ? b.card : b.eft; }
        log('Game drive for ' + guestName(b) + ': ' + fd(d) + ' ' + SLOTS[b.drive.slot], b.ref); save(); refresh();
        toast('Game drive set for ' + fdw(d) + ', ' + SLOTS[b.drive.slot].split(' · ')[1] + (delta ? '. ' + (delta > 0 ? money(delta) + ' added to' : money(-delta) + ' taken off') + ' the booking' : ''));
      }, { onOpen: function (f) { var n = $('[data-gd-n]', f), p = $('[data-gd-p]', f); n.addEventListener('input', function () { p.value = money(drivePrice(parseInt(n.value, 10) || 0)); }); }, noFocus: true });
  }

  /* =========================================================
     Rates & fees: tabs, one clear form each, a save bar when changed
     ========================================================= */
  var RT = { tab: 'stay' };
  function secByRe(re) { return P.sections.filter(function (s) { return re.test(s.title); })[0]; }
  function rateIn(sec, label, o) {
    o = o || {}; if (!sec) return '';
    var it = sec.items.filter(function (i) { return i.label === label; })[0]; if (!it) return '<span class="muted">Not set</span>';
    var v = num(sec.title, it.label, it.amount), key = sec.title + '|' + it.label;
    return '<label class="money-in' + (o.unit ? ' unit' : '') + '">' + (o.unit ? '' : 'R') + '<input data-rate="' + esc(key) + '" inputmode="decimal" value="' + v + '" aria-label="' + esc(o.aria || label) + '">' + (o.unit ? '<span>' + o.unit + '</span>' : '') + '</label>' + (o.unit ? '' : '<small class="card-of" data-cardof="' + esc(key) + '">' + (hasFee() ? 'Card ' + money(toCard(v)) : '') + '</small>');
  }
  function rateVal(sec, label, d) { if (!sec) return d; var i = $('[data-rate="' + (sec.title + '|' + label).replace(/"/g, '\\"') + '"]'); var v = i ? parseFloat(i.value) : NaN; return isNaN(v) ? num(sec.title, label, d) : v; }
  function exampleText() {
    var ab = secByRe(/^ablution/i), ss = secByRe(/^self-sufficient/i), feeI = $('[data-rate$="|Card payment fee percentage"]'), fee = feeI ? parseFloat(feeI.value) || 0 : cardFee();
    var c = function (n) { return Math.round(n * (1 + fee / 100)); };
    var wk = rateVal(ab, 'Weekend per person per night', 245), wd = rateVal(ab, 'Weekday per person per night', 160), swk = rateVal(ss, 'Weekend per person per night', 180);
    return '<b>2 adults, Friday and Saturday night on a fenced stand:</b> ' + money(4 * wk) + ' EFT, or ' + money(4 * c(wk)) + ' by card.<br><b>2 adults, Monday to Wednesday (2 nights):</b> ' + money(4 * wd) + ' EFT, or ' + money(4 * c(wd)) + ' by card.<br><b>2 adults, a weekend on a self-sufficient stand:</b> ' + money(4 * swk) + ' EFT, or ' + money(4 * c(swk)) + ' by card.';
  }
  function vRates() {
    var tabs = [['stay', 'Stay rates'], ['words', 'Wording and Dinokeng fees'], ['extras', 'Extras & activities'], ['rules', 'Payment & booking rules'], ['holidays', 'Holidays']];
    var ab = secByRe(/^ablution/i), ss = secByRe(/^self-sufficient/i), gd = secByRe(/game drive/i), br = secByRe(/booking rules/i), body = '';
    if (RT.tab === 'stay') {
      var rows = [['Weekend per person per night', 'Weekend night', 'Friday, Saturday and Sunday nights, and nights before a public holiday'], ['Weekday per person per night', 'Weekday night', 'Monday to Thursday nights'], ['Pensioner weekday per person per night', 'Pensioner, weekday', 'Monday to Thursday nights, per pensioner'], ['Children under 12', 'Children under ' + num('Booking rules', 'Children free under age', 12), 'Per child, per night']];
      rows.forEach(function (r) { var d = rateWord(ab, r[0], 'note'); if (d) r[2] = 'On the website: "' + esc(d) + '"'; });
      body = '<section class="card flush"><table class="tbl rate-matrix"><thead><tr><th>Per person, per night</th><th class="r">Ablution stands<small>Fenced and unfenced</small></th><th class="r">Self-sufficient stands<small>On the spruit</small></th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td data-l="Rate"><b>' + r[1] + '</b><small>' + r[2] + '</small></td><td data-l="Ablution stands" class="r">' + rateIn(ab, r[0], { aria: r[1] + ', ablution stands' }) + '</td><td data-l="Self-sufficient stands" class="r">' + rateIn(ss, r[0], { aria: r[1] + ', self-sufficient stands' }) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
        '<section class="card example"><header class="card-h"><h3>' + ic('info') + 'What guests will pay</h3><span class="muted small">Updates as you type</span></header><p data-example>' + exampleText() + '</p></section>';
    }
    if (RT.tab === 'words') {
      body = '<p class="hint wt-tips">' + ic('info') + ' <span>This is how each rate is named and described on the website\'s rates tables. Change the wording and press Save changes. The prices themselves are on the Stay rates tab, except Dinokeng\'s own fees, which you update here when the reserve changes them.</span></p>' +
        P.sections.filter(function (s) { return s.items.length && !/booking rules|holiday|shop|game drive/i.test(s.title); }).map(function (s) {
          var dk = /dinokeng/i.test(s.title);
          return '<section class="card"><header class="card-h"><h3>' + esc(s.title) + '</h3><span class="muted small">' + (dk ? 'Paid to the reserve, not to Kyleu' : 'Shown on the Discover page') + '</span></header><div class="rw-list">' + s.items.map(function (it) {
            var k = s.title + '|' + it.label;
            return '<div class="rw-row"><label class="fld"><span>Name on the website</span><input data-rw="' + esc(k) + '" data-rwf="name" data-def="' + esc(it.label) + '" value="' + esc(rateWord(s, it.label, 'name')) + '"></label><label class="fld"><span>Description</span><input data-rw="' + esc(k) + '" data-rwf="note" data-def="' + esc(it.note || '') + '" value="' + esc(rateWord(s, it.label, 'note')) + '"></label>' +
              '<div class="rw-amt">' + (dk ? rateIn(s, it.label, { aria: it.label }) : '<span>' + (num(s.title, it.label, it.amount) === 0 ? 'Free' : money(num(s.title, it.label, it.amount))) + '</span>') + '</div></div>';
          }).join('') + '</div></section>';
        }).join('') + '<p><a class="btn ghost" href="../discover.html#rates" target="_blank" rel="noopener">' + ic('ext') + 'View the rates on the website</a></p>';
    }
    if (RT.tab === 'extras') {
      body = '<section class="card flush"><table class="tbl rate-matrix"><thead><tr><th>Extra</th><th class="r">Price</th></tr></thead><tbody>' +
        [[gd, 'Game drive 3 or more people per person', 'Game drive, 3 or more people', 'Per person'], [gd, 'Game drive 2 people per person', 'Game drive, 2 people', 'Per person'], [gd, 'Game drive 1 person', 'Game drive, 1 person', 'A private drive'], [ss, 'Porta potty hire per night', 'Porta potty hire', 'Self-sufficient stands, per night, cleaning included']].map(function (r) { return '<tr><td data-l="Extra"><b>' + r[2] + '</b><small>' + r[3] + '</small></td><td data-l="Price" class="r">' + rateIn(r[0], r[1], { aria: r[2] }) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
        '<section class="card link-card"><div>' + ic('box') + '<div><b>Shop products</b><p class="muted small">Firewood, ice and merchandise have their own page with stock and categories.</p></div></div><a class="btn ghost" href="#/products">Go to Products</a></section>';
    }
    if (RT.tab === 'rules') {
      var R = [['Card payment fee percentage', '%', 'Card fee', 'Keep at 0: there is one price for everyone and Kyleu covers the card company\'s fee (about ' + (DB.settings.providerFee || 2.95) + '%). Only change this if Kyleu decides to pass that fee on.'],
        ['Deposit percentage', '%', 'Deposit', 'How much of the total secures a booking.'],
        ['Deposit due within days of invoice', 'days', 'Deposit deadline', 'EFT guests must pay the deposit within this many days, or the stand can be released.'],
        ['Balance due days before arrival', 'days', 'Balance deadline', 'The rest is due this many days before arrival.'],
        ['Minimum nights over a weekend', 'nights', 'Weekend minimum', 'Shortest stay when it includes a Friday or Saturday night. With 2, Friday + Saturday and Saturday + Sunday are both fine.'],
        ['Children free under age', 'years', 'Children stay free under', 'Children younger than this pay nothing.']];
      var DN = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'], wkd = P.wkDays || [5, 6, 0], wdNames = [1, 2, 3, 4, 5, 6, 0].filter(function (d) { return wkd.indexOf(d) < 0; }).map(function (d) { return DN[d]; });
      body = '<section class="card"><header class="card-h"><h3>Weekend-rate nights</h3><span class="muted small">Saves as you tick</span></header><p class="muted small">Tick the nights that cost the weekend rate. All other nights cost the weekday rate. The night before a public holiday always costs the weekend rate.</p>' +
        '<div class="wk-days">' + [1, 2, 3, 4, 5, 6, 0].map(function (d) { return '<label class="check wk-day' + (wkd.indexOf(d) >= 0 ? ' on' : '') + '"><input type="checkbox" data-wkday="' + d + '"' + (wkd.indexOf(d) >= 0 ? ' checked' : '') + '><span>' + DN[d] + ' night</span></label>'; }).join('') + '</div>' +
        '<p class="hint">' + ic('info') + ' Now: weekday rate on ' + (wdNames.length ? esc(wdNames.join(', ')) : 'no') + ' nights. If you change this, also update the rate descriptions on the <b>Wording and Dinokeng fees</b> tab so the website says the same. Bookings already made keep their price.</p></section>' +
        holdCard() + '<section class="card rules">' + R.map(function (r) { return '<div class="rule"><div><b>' + r[2] + '</b><p class="muted small">' + r[3] + '</p></div>' + rateIn(br, r[0], { unit: r[1], aria: r[2] }) + '</div>'; }).join('') + '</section>';
    }
    if (RT.tab === 'holidays') {
      var hol = Object.keys(P.holidays).filter(function (d) { return d >= TODAY; }).sort();
      body = '<section class="card"><header class="card-h"><h3>Public holidays and long weekends</h3><span class="muted small">The night before each date is charged at the weekend rate</span></header>' +
        '<form class="hol-add" data-hol-add><input type="date" name="d" aria-label="Date" required><input name="n" placeholder="Name, e.g. Heritage Day" aria-label="Name"><button class="btn" type="submit">' + ic('plus') + 'Add date</button></form>' +
        '<ul class="feed hol">' + hol.map(function (d) { return '<li><span><b>' + fd(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) + '</b> · ' + esc(P.holidays[d]) + '</span><button class="btn sm ghost" data-hol-del="' + d + '">Remove</button></li>'; }).join('') + '</ul></section>';
    }
    return '<div class="page-h"><div><h1>Rates & fees</h1><p class="muted">Enter the price guests pay. There is one price for everyone, however they pay. Dinokeng\'s fees belong to the reserve, so they are not here.</p></div></div>' +
      '<div class="rp-tabs page-tabs">' + tabs.map(function (t) { return '<button class="' + (RT.tab === t[0] ? 'on' : '') + '" data-ratetab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body +
      '<div class="savebar" data-savebar hidden><span>' + ic('info') + 'You have unsaved changes</span><button class="btn ghost" data-act="rates-discard">Discard</button><button class="btn" data-act="save-rates">Save changes</button></div>';
  }
  // when an unpaid stand is released: never over a weekend, and kept longer once proof of payment is uploaded
  function holdCard() {
    var h = holdRules();
    return '<section class="card rules"><header class="card-h"><h3>When an unpaid stand is released</h3><span class="muted small">Saves as you change it</span></header>' +
      '<div class="rule"><div><b>Not over a weekend</b><p class="muted small">If a quotation, or the extra time below, runs out on a Friday, Saturday or Sunday, the stand is kept until the end of Monday. That gives a working day to check the bank and press Money is in before anything is released.</p></div>' +
      '<select data-hold="skip" aria-label="Not over a weekend">' + [['weekends', 'Weekends'], ['holidays', 'Weekends and public holidays'], ['off', 'Off: release on the day']].map(function (o) { return '<option value="' + o[0] + '"' + (h.skip === o[0] ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select></div>' +
      '<div class="rule"><div><b>After proof of payment is uploaded</b><p class="muted small">The stand is kept this many days from the upload, so you have time to see the money in the bank. The guest is not told the number of days: they see that the payment is being checked and their stand is kept. 0 turns this off.</p></div>' +
      '<label class="money-in unit"><input data-hold="popDays" inputmode="numeric" value="' + (+h.popDays || 0) + '" aria-label="Days after proof of payment"><span>days</span></label></div></section>';
  }
  function applyHol() { DB.hol = DB.hol || { add: {}, del: {} }; Object.keys(DB.hol.del).forEach(function (d) { delete P.holidays[d]; }); Object.keys(DB.hol.add).forEach(function (d) { P.holidays[d] = DB.hol.add[d]; }); }

  /* =========================================================
     Reports, in the MegaVolt style: pick a period, compare it with
     the period before; tiles count up, bars grow, rows slide out.
     ========================================================= */
  var RP_KEY = 'kyleu-admin-reports', RP = { range: 'last_30', compare: true, tab: 'overview' };
  try { var rps = JSON.parse(localStorage.getItem(RP_KEY) || 'null'); if (rps) { RP.range = rps.range || RP.range; RP.compare = rps.compare !== false; RP.tab = rps.tab || RP.tab; } } catch (e) {}
  function rpSave() { try { localStorage.setItem(RP_KEY, JSON.stringify({ range: RP.range, compare: RP.compare, tab: RP.tab })); } catch (e) {} }
  var RP_RANGES = [['this_week', 'This week'], ['last_week', 'Last week'], ['this_month', 'This month'], ['last_month', 'Last month'], ['last_30', 'Last 30 days'], ['last_90', 'Last 90 days']];
  var RP_TABS = [['overview', 'Overview'], ['money', 'Money'], ['stays', 'Stays'], ['guests', 'Guests'], ['shop', 'Shop']];
  var RP_COLORS = ['#1f78b8', '#d2601a', '#3a8f55', '#8a5cb8', '#b8901f'];   // validated: light surface, CVD with labels
  var C_CASH = '#3a8f55', MS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var RP_CH = [], RP_FIG = [], rpDelay = 0, rpGid = 0, rpTimer = null, rpInstant = false;
  function rpD() { return (rpDelay += 45); }
  function monthAdd(s, n) { var d = D(s.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + n); return iso(d); }
  function rpRange(k) {
    var t = TODAY, mon = add(t, -((D(t).getDay() + 6) % 7)), ms = t.slice(0, 8) + '01';
    var r = function (a, b, pa, pb) { return { from: a, to: b, pf: pa, pt: pb }; };
    if (k === 'this_week') return r(mon, t, add(mon, -7), add(t, -7));
    if (k === 'last_week') return r(add(mon, -7), add(mon, -1), add(mon, -14), add(mon, -8));
    if (k === 'this_month') { var pm = monthAdd(ms, -1); return r(ms, t, pm, add(pm, Math.min(diff(ms, t), diff(pm, ms) - 1))); }
    if (k === 'last_month') { var lm = monthAdd(ms, -1); return r(lm, add(ms, -1), monthAdd(ms, -2), add(lm, -1)); }
    if (k === 'last_90') return r(add(t, -89), t, add(t, -179), add(t, -90));
    return r(add(t, -29), t, add(t, -59), add(t, -30));
  }
  function rpRangeText(a, b) { return a === b ? fd(a, { day: 'numeric', month: 'short', year: 'numeric' }) : fd(a) + ' to ' + fd(b, { day: 'numeric', month: 'short', year: 'numeric' }); }
  // days for a month or less, weeks up to about 3 months
  function rpBuckets(from, to) {
    var n = diff(from, to) + 1, kind = n <= 31 ? 'day' : n <= 100 ? 'week' : 'month', keys = [], s = from;
    if (kind === 'week') s = add(from, -((D(from).getDay() + 6) % 7));
    while (s <= to) { keys.push(s); s = kind === 'day' ? add(s, 1) : kind === 'week' ? add(s, 7) : monthAdd(s, 1); }
    return { kind: kind, keys: keys, idx: function (d) { if (d < from || d > to) return -1; for (var i = keys.length - 1; i >= 0; i--) if (d >= keys[i]) return i; return -1; },
      label: function (k, long) { if (kind === 'week') return long ? 'Week of ' + fd(k, { day: 'numeric', month: 'long' }) : fd(k); return long ? fdw(k) : fd(k); } };
  }

  /* ---------- figures for one period ---------- */
  function rpStats(from, to, bk, shift) {
    var n = bk.keys.length, z = function () { var a = []; for (var i = 0; i < n; i++) a.push(0); return a; };
    var at = function (d) { return bk.idx(shift ? add(d, shift) : d); }, inR = function (d) { return d >= from && d <= to; };
    var fee = function (amt) { return amt - amt / (1 + cardFee() / 100); };
    var S = { received: 0, card: 0, eft: 0, cash: 0, refunds: 0, fee: 0, nPay: 0, shop: 0, shopN: 0, shopQ: 0, shopCard: 0, items: {}, itemsQ: {}, byArea: {}, made: 0, madeValue: 0, cancelled: 0, src: {}, lead: 0,
      nights: 0, arrivals: 0, stayN: 0, guests: 0, kids: 0, newG: 0, retG: 0, consent: 0, groups: {}, lens: [0, 0, 0, 0], dow: [0, 0, 0, 0, 0, 0, 0], standN: {}, areaN: {}, top: {},
      s: { received: z(), card: z(), eft: z(), cash: z(), made: z(), nights: z(), guests: z(), shop: z() } };
    var first = {};
    DB.bookings.forEach(function (b) { if (live(b)) { var e = b.guest.email; if (!first[e] || b.ci < first[e]) first[e] = b.ci; } });
    DB.bookings.forEach(function (b) {
      var st = standById(b.stand);
      (b.payments || []).forEach(function (p) {
        if (!inR(p.d) || p.m === 'credit') return;
        if (p.amt < 0) { S.refunds -= p.amt; return; }
        var i = at(p.d); S.received += p.amt; S.nPay++; S[p.m] += p.amt; if (p.m === 'card') S.fee += fee(p.amt);
        S.byArea[st.area] = (S.byArea[st.area] || 0) + p.amt;
        if (i >= 0) { S.s.received[i] += p.amt; S.s[p.m][i] += p.amt; }
      });
      var cd = b.created.slice(0, 10);
      if (inR(cd)) { S.made++; if (!live(b)) S.cancelled++; else { S.madeValue += b.total; S.src[b.source] = (S.src[b.source] || 0) + 1; S.lead += Math.max(0, diff(cd, b.ci)); var i2 = at(cd); if (i2 >= 0) S.s.made[i2]++; } }
      if (!live(b)) return;
      for (var d = b.ci < from ? from : b.ci; d < b.co && d <= to; d = add(d, 1)) { S.nights++; S.standN[b.stand] = (S.standN[b.stand] || 0) + 1; S.areaN[st.area] = (S.areaN[st.area] || 0) + 1; var i3 = at(d); if (i3 >= 0) S.s.nights[i3]++; }
      if (!inR(b.ci)) return;
      var ppl = people(b), len = diff(b.ci, b.co);
      S.arrivals++; S.stayN += len; S.guests += ppl; S.kids += b.kids; if (b.guest.consent) S.consent++;
      var i4 = at(b.ci); if (i4 >= 0) S.s.guests[i4] += ppl;
      if (first[b.guest.email] === b.ci) S.newG++; else S.retG++;
      var g = b.pens ? 'Pensioners' : b.kids ? 'Families' : b.adults === 2 ? 'Couples' : b.adults === 1 ? 'On their own' : 'Groups of friends';
      S.groups[g] = (S.groups[g] || 0) + 1; S.lens[Math.min(3, len - 1)]++; S.dow[(D(b.ci).getDay() + 6) % 7]++;
      var e = b.guest.email; S.top[e] = S.top[e] || { name: guestName(b), email: e, stays: 0, nights: 0, spent: 0 }; S.top[e].stays++; S.top[e].nights += len; S.top[e].spent += b.total;
    });
    DB.sales.forEach(function (x) {
      if (!inR(x.d)) return;
      if (x.amt < 0) { S.refunds -= x.amt; return; }
      if (x.m === 'bill') { S.shop += x.amt; S.shopQ += x.qty; S.items[x.item] = (S.items[x.item] || 0) + x.amt; S.itemsQ[x.item] = (S.itemsQ[x.item] || 0) + x.qty; var ib = at(x.d); if (ib >= 0) S.s.shop[ib] += x.amt; return; }
      var i = at(x.d); S.shop += x.amt; S.shopN++; S.shopQ += x.qty; S.received += x.amt; S.nPay++; S[x.m] += x.amt;
      if (x.m === 'card') { S.shopCard += x.amt; S.fee += fee(x.amt); }
      S.items[x.item] = (S.items[x.item] || 0) + x.amt; S.itemsQ[x.item] = (S.itemsQ[x.item] || 0) + x.qty;
      if (i >= 0) { S.s.received[i] += x.amt; S.s[x.m][i] += x.amt; S.s.shop[i] += x.amt; }
    });
    S.days = diff(from, to) + 1; S.standNights = STANDS.length * S.days;
    S.occ = S.standNights ? S.nights / S.standNights * 100 : 0;
    S.booked = S.made - S.cancelled;
    return S;
  }
  var avg = function (a, b) { return b ? a / b : 0; };

  /* ---------- formatting ---------- */
  function rpFmt(k, v, u) {
    v = v || 0;
    if (k === 'money') return money(Math.round(v));
    if (k === 'pct') return Math.round(v) + '%';
    if (k === 'dec') return (Math.round(v * 10) / 10).toFixed(1) + (u || '');
    return Math.round(v).toLocaleString('en-ZA') + (u || '');
  }
  function rpShort(k, v) {
    if (k === 'money') return v >= 1e6 ? 'R' + (v / 1e6).toFixed(1) + 'M' : v >= 1e3 ? 'R' + (v / 1e3).toFixed(v >= 1e4 || v % 1000 === 0 ? 0 : 1) + 'k' : 'R' + Math.round(v);
    if (k === 'pct') return Math.round(v) + '%';
    return String(Math.round(v * 10) / 10);
  }
  // change against the period before (green = better)
  function rpDelta(cur, prev, lower, kind) {
    if (prev == null) return null;
    if (!prev && !cur) return { t: 'No change', c: 'flat' };
    if (!prev) return { t: 'New', c: lower ? 'down' : 'up' };
    var df = cur - prev, pc = df / Math.abs(prev) * 100;
    if (Math.abs(pc) < .5) return { t: 'No change', c: 'flat' };
    var good = lower ? df < 0 : df > 0, ar = df > 0 ? '▲ ' : '▼ ';
    if (kind === 'pct') return Math.round(df) === 0 ? { t: 'No change', c: 'flat' } : { t: ar + Math.abs(Math.round(df)) + ' pts', c: good ? 'up' : 'down' };
    var a = Math.abs(pc); return { t: ar + (a >= 100 ? Math.round(a) : a.toFixed(a < 10 ? 1 : 0)) + '%', c: good ? 'up' : 'down' };
  }

  /* ---------- pieces ---------- */
  function rpKpi(o) {
    var d = RP.compare ? rpDelta(o.v, o.p, o.lower, o.kind) : null;
    RP_FIG.push([o.label, rpFmt(o.kind, o.v, o.u), o.p == null ? '' : rpFmt(o.kind, o.p, o.u)]);
    return '<div class="rp-kpi rp-in" style="--d:' + rpD() + 'ms"' + (o.help ? ' title="' + esc(o.help) + '"' : '') + '>' +
      '<div class="rp-kpi-top"><span class="rp-kpi-lab">' + esc(o.label) + '</span>' + (d ? '<span class="rp-delta ' + d.c + '" title="' + esc('Period before: ' + rpFmt(o.kind, o.p, o.u)) + '">' + d.t + '</span>' : '') + '</div>' +
      '<div class="rp-kpi-val" data-count="' + (o.v || 0) + '" data-kind="' + (o.kind || 'count') + '" data-u="' + esc(o.u || '') + '">' + rpFmt(o.kind, 0, o.u) + '</div>' +
      '<div class="rp-kpi-foot"><span class="rp-kpi-note">' + esc(o.note != null ? o.note : RP.compare && o.p != null ? 'Before: ' + rpFmt(o.kind, o.p, o.u) : '') + '</span>' + (o.spark ? '<span class="rp-kpi-spark">' + rpSpark(o.spark) + '</span>' : '') + '</div></div>';
  }
  function rpSpark(data) {
    if (data.length < 2) return '';
    var W = 120, H = 34, max = Math.max.apply(null, data.concat([1])), id = 'rps' + (++rpGid);
    var pts = data.map(function (v, i) { return (i / (data.length - 1) * W).toFixed(1) + ',' + (H - 2 - v / max * (H - 6)).toFixed(1); }).join(' ');
    return '<svg viewBox="0 0 ' + W + ' ' + H + '" preserveAspectRatio="none" class="rp-spark" aria-hidden="true"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8731c" stop-opacity=".32"/><stop offset="1" stop-color="#e8731c" stop-opacity="0"/></linearGradient></defs>' +
      '<polygon points="0,' + H + ' ' + pts + ' ' + W + ',' + H + '" fill="url(#' + id + ')" class="rp-spark-area"/><polyline points="' + pts + '" class="rp-spark-line" pathLength="100"/></svg>';
  }
  function rpCard(title, body, o) {
    o = o || {};
    return '<section class="rp-card rp-in' + (o.wide ? ' wide' : '') + '" style="--d:' + rpD() + 'ms"><div class="rp-card-head"><div><h3>' + esc(title) + '</h3>' + (o.sub ? '<div class="rp-card-sub">' + esc(o.sub) + '</div>' : '') + '</div>' + (o.side || '') + '</div>' + body + '</section>';
  }
  function rpLegend(items) {
    return '<div class="rp-legend-inline">' + items.map(function (it) { return '<span><i class="rp-dot' + (it.ghost ? ' ghost' : '') + '"' + (it.c ? ' style="background:' + it.c + '"' : '') + '></i>' + esc(it.n) + '</span>'; }).join('') + '</div>';
  }
  // column chart: drawn after the page is on screen, at the width it really has
  function rpCols(o) { RP_CH.push(o); return '<div class="rp-chart" data-rpc="' + (RP_CH.length - 1) + '" style="height:' + (o.h || 250) + 'px"></div>'; }
  function rpTicks(v, kind) {
    if (!(v > 0)) return { top: kind === 'money' ? 100 : 4, step: kind === 'money' ? 25 : 1 };
    var raw = v / 4, p = Math.pow(10, Math.floor(Math.log10(raw))), n = raw / p;
    var step = (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 && kind === 'money' ? 2.5 : n <= 5 ? 5 : 10) * p;
    if (kind !== 'money') step = Math.max(1, Math.round(step));
    return { top: Math.ceil(v / step) * step, step: step };
  }
  function rpColsSVG(o, W, H) {
    var padL = 46, padR = 6, padT = 12, padB = 28, pw = W - padL - padR, ph = H - padT - padB, n = o.labels.length;
    var main = o.series.filter(function (s) { return !s.ghost; }), ghosts = o.series.filter(function (s) { return s.ghost; });
    var vals = []; o.series.forEach(function (s) { vals = vals.concat(s.data); });
    var tk = o.max ? { top: o.max, step: o.max / 4 } : rpTicks(Math.max.apply(null, vals.concat([0])), o.kind), max = tk.top;
    var y = function (v) { return padT + ph - v / max * ph; }, base = padT + ph, gid = 'rpg' + (++rpGid);
    var out = '<defs><linearGradient id="' + gid + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8731c"/><stop offset="1" stop-color="#e8731c" stop-opacity=".62"/></linearGradient></defs>';
    for (var g = 0; g * tk.step <= max + tk.step / 2; g++) { var v = g * tk.step, yy = y(v).toFixed(1); out += '<line x1="' + padL + '" x2="' + (W - padR) + '" y1="' + yy + '" y2="' + yy + '" class="rp-grid' + (g ? '' : ' base') + '"/><text x="' + (padL - 8) + '" y="' + (+yy + 4) + '" text-anchor="end" class="rp-axis">' + rpShort(o.kind, v) + '</text>'; }
    var slot = pw / Math.max(1, n), gw = Math.min(slot * .72, 46), gap = main.length > 1 ? 2 : 0, bw = Math.max(2, (gw - (main.length - 1) * gap) / main.length), r = Math.min(4, bw / 2);
    for (var i = 0; i < n; i++) {
      var cx = padL + slot * i + slot / 2, tip = '<b>' + esc(o.tips[i]) + '</b>';
      o.series.forEach(function (s) { tip += '<div><i class="rp-dot' + (s.ghost ? ' ghost' : '') + '"' + (s.ghost ? '' : ' style="background:' + (s.color || '#e8731c') + '"') + '></i>' + esc(s.name) + ': <b>' + esc(rpFmt(o.kind, s.data[i], o.u)) + '</b></div>'; });
      ghosts.forEach(function (s) { var gv = s.data[i]; if (!gv) return; var gy = Math.max(padT, y(gv)); out += '<rect x="' + (cx - gw / 2 - 3).toFixed(1) + '" y="' + gy.toFixed(1) + '" width="' + (gw + 6).toFixed(1) + '" height="' + (base - gy).toFixed(1) + '" rx="' + r + '" class="rp-ghost"/>'; });
      main.forEach(function (s, si) {
        var bv = s.data[i] || 0, by = y(bv), h = base - by, x = cx - gw / 2 + si * (bw + gap); if (h < .5) return;
        var rr = Math.min(r, h);
        out += '<path d="M' + x.toFixed(1) + ',' + base + 'V' + (by + rr).toFixed(1) + 'q0,-' + rr + ' ' + rr + ',-' + rr + 'h' + (bw - 2 * rr).toFixed(1) + 'q' + rr + ',0 ' + rr + ',' + rr + 'V' + base + 'Z" fill="' + (s.color || 'url(#' + gid + ')') + '" class="rp-bar" style="animation-delay:' + Math.min(i * 22, 480) + 'ms"/>';
      });
      out += '<rect x="' + (padL + slot * i).toFixed(1) + '" y="' + padT + '" width="' + slot.toFixed(1) + '" height="' + ph + '" class="rp-hit" data-rtip="' + esc(tip) + '"/>';
    }
    var every = n <= 8 ? 1 : Math.max(1, Math.ceil(n / Math.max(2, Math.floor(pw / 52))));
    for (var j = 0; j < n; j += every) out += '<text x="' + (padL + slot * j + slot / 2).toFixed(1) + '" y="' + (H - 8) + '" text-anchor="middle" class="rp-axis">' + esc(o.labels[j]) + '</text>';
    return '<svg width="' + W + '" height="' + H + '" viewBox="0 0 ' + W + ' ' + H + '" role="img" aria-label="' + esc(o.label || '') + '">' + out + '</svg>';
  }
  function rpDrawCharts(again) {
    $$('[data-rpc]').forEach(function (host) {
      var o = RP_CH[+host.dataset.rpc], W = Math.round(host.clientWidth); if (!o || !W || host._w === W) return;
      host._w = W; host.classList.toggle('rp-noanim', !!again); host.innerHTML = rpColsSVG(o, W, o.h || 250);
    });
  }
  // a table under a chart, for anyone who would rather read numbers
  function rpTableView(o) {
    return '<details class="tbl-view"><summary>Show as a table</summary><table class="tbl"><thead><tr><th>' + esc(o.head || 'Period') + '</th>' + o.series.map(function (s) { return '<th class="r">' + esc(s.name) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      o.labels.map(function (l, i) { return '<tr><td>' + esc(o.tips[i]) + '</td>' + o.series.map(function (s) { return '<td class="r">' + esc(rpFmt(o.kind, s.data[i], o.u)) + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table></details>';
  }
  // ranked bars that slide out
  function rpHBars(rows, kind, o) {
    o = o || {};
    var list = rows.filter(function (r) { return r.v > 0; }); if (!o.keep) list.sort(function (a, b) { return b.v - a.v; }); list = list.slice(0, o.limit || 8);
    if (!list.length) return '<p class="rp-empty">Nothing in this period.</p>';
    var max = o.max || Math.max.apply(null, list.map(function (r) { return r.v; })), total = rows.reduce(function (a, r) { return a + r.v; }, 0), d0 = rpDelay + 120;
    return '<div class="rp-hbars">' + list.map(function (r, i) {
      var txt = r.t || rpFmt(kind, r.v, o.u);
      return '<div class="rp-hrow" title="' + esc(r.l + ': ' + txt + (total && !o.max ? ' (' + Math.round(r.v / total * 100) + '%)' : '')) + '"><div class="rp-hlab"><span class="rp-hname">' + esc(r.l) + '</span><span class="rp-hval">' + esc(txt) + '</span></div>' +
        '<div class="rp-htrack"><span class="rp-hfill" style="width:' + Math.max(1.5, Math.min(100, r.v / max * 100)).toFixed(1) + '%;animation-delay:' + (d0 + i * 50) + 'ms' + (o.color ? ';background:' + o.color : '') + '"></span></div></div>';
    }).join('') + '</div>';
  }
  function rpDonut(rows, kind, centre) {
    var list = rows.filter(function (r) { return r.v > 0; }); if (!list.length) return '<p class="rp-empty">Nothing in this period.</p>';
    var total = list.reduce(function (a, r) { return a + r.v; }, 0), R = 52, C = 2 * Math.PI * R, acc = 0, rings = '';
    list.forEach(function (r, i) {
      var len = r.v / total * C, col = r.c || RP_COLORS[i % RP_COLORS.length], gap = list.length > 1 ? 2 : 0;
      rings += '<circle r="' + R + '" cx="70" cy="70" fill="none" stroke="' + col + '" stroke-width="18" stroke-dasharray="' + Math.max(.5, len - gap).toFixed(2) + ' ' + (C - len + gap).toFixed(2) + '" stroke-dashoffset="' + (-acc).toFixed(2) + '" class="rp-arc" style="animation-delay:' + (rpDelay + 80 + i * 90) + 'ms"><title>' + esc(r.l + ': ' + rpFmt(kind, r.v) + ' (' + Math.round(r.v / total * 100) + '%)') + '</title></circle>';
      acc += len;
    });
    return '<div class="rp-donut-wrap"><svg viewBox="0 0 140 140" class="rp-donut" role="img" aria-label="' + esc(centre) + '"><g transform="rotate(-90 70 70)">' + rings + '</g><text x="70" y="68" text-anchor="middle" class="rp-donut-val">' + esc(rpShort(kind, total)) + '</text><text x="70" y="86" text-anchor="middle" class="rp-donut-lab">' + esc(centre) + '</text></svg>' +
      '<div class="rp-legend">' + list.map(function (r, i) { return '<div class="rp-leg"><i style="background:' + (r.c || RP_COLORS[i % RP_COLORS.length]) + '"></i><span class="rp-leg-name">' + esc(r.l) + '</span><span class="rp-leg-val">' + esc(rpFmt(kind, r.v)) + ' · ' + Math.round(r.v / total * 100) + '%</span></div>'; }).join('') + '</div></div>';
  }
  // figures that don't depend on the period
  function rpNow() {
    var tn = Object.keys(standsBookedOn(TODAY)).length, wk = add(TODAY, 7);
    var arr = DB.bookings.filter(function (b) { return live(b) && b.ci > TODAY && b.ci <= wk; });
    var pend = DB.bookings.filter(function (b) { return b.status === 'pending'; });
    var owe = DB.bookings.filter(function (b) { return live(b) && b.status !== 'pending' && balance(b) > 0; });
    var item = function (lab, val, sub, cls, go) { return (can(go) ? '<button type="button" data-go="' + go + '"' : '<div') + ' class="rp-now-item ' + (cls || '') + '"><span class="rp-now-val">' + val + '</span><span class="rp-now-lab">' + lab + '</span>' + (sub ? '<span class="rp-now-sub">' + sub + '</span>' : '') + (can(go) ? '</button>' : '</div>'); };
    return '<div class="rp-now rp-in" style="--d:' + rpD() + 'ms"><div class="rp-now-title">Right now</div>' +
      item('Stands in use tonight', tn + ' <small>of ' + STANDS.length + '</small>', Math.round(tn / Math.max(1, STANDS.length) * 100) + '% full', 'ok', 'calendar') +
      item('Arriving in the next 7 days', arr.length, arr.reduce(function (a, b) { return a + people(b); }, 0) + ' guests', '', 'bookings') +
      item('Waiting for EFT', pend.length, money(pend.reduce(function (a, b) { return a + deposit(b); }, 0)) + ' to come in', 'warn', 'eft') +
      item('Balances still owing', money(owe.reduce(function (a, b) { return a + balance(b); }, 0)), owe.length + ' bookings', 'bad', 'payments') + '</div>';
  }
  function rpHow() {
    return '<details class="rp-how"><summary>How these figures are worked out</summary><ul>' + [
      'Money received is every deposit, balance and shop sale paid in the period, on the day it was paid. Refunds are shown on their own.',
      'Bookings made counts bookings created in the period that were not cancelled. Cancelled is the share of bookings made in the period that were later cancelled.',
      'Occupancy is the stand nights booked in the period out of every night on every stand (' + STANDS.length + ' stands).',
      'Guests, stay length and group size count bookings arriving in the period. A new guest is someone staying with Kyleu for the first time.',
      '"The period before" is the same length of time just before, for example this month so far against the same days last month.'
    ].map(function (t) { return '<li>' + esc(t) + '</li>'; }).join('') + '</ul></details>';
  }

  /* ---------- the page ---------- */
  function vReports() {
    var r = rpRange(RP.range);
    return '<div class="page-h"><div><h1>Reports</h1><p class="muted">Money, stays and guests for any period, compared with the period before.</p></div><div class="ph-act"><button class="btn ghost" data-act="csv-report">' + ic('download') + 'Export</button></div></div>' +
      '<div class="card rp-filters"><div class="rp-filters-row"><div class="rp-filters-left"><select data-rp-range aria-label="Period">' + RP_RANGES.map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === RP.range ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
      '<label class="rp-cmp"><input type="checkbox" data-rp-cmp' + (RP.compare ? ' checked' : '') + '><span>Compare with the period before</span></label></div>' +
      '<div class="rp-range-text"><b>' + rpRangeText(r.from, r.to) + '</b>' + (RP.compare ? '<span>vs ' + rpRangeText(r.pf, r.pt) + '</span>' : '') + '</div></div>' +
      '<div class="rp-tabs" role="tablist">' + RP_TABS.map(function (t) { return '<button type="button" role="tab" aria-selected="' + (RP.tab === t[0]) + '" class="' + (RP.tab === t[0] ? 'on' : '') + '" data-rp-tab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div></div>' +
      '<div class="rp-body" data-rp-body>' + (rpInstant ? '' : '<div class="rp-skel">' + [1, 2, 3, 4, 5, 6].map(function () { return '<div class="rp-skel-tile"></div>'; }).join('') + '</div><div class="rp-skel-chart"></div>') + '</div>';
  }
  function rpFill() {
    clearTimeout(rpTimer);
    var instant = rpInstant; rpInstant = false;
    rpTimer = setTimeout(function () {
      var body = $('[data-rp-body]'); if (!body) return;
      RP_CH = []; RP_FIG = []; rpDelay = 0;
      body.innerHTML = rpBody(); applyTables();
      rpDrawCharts(false); rpCountUp(body);
    }, instant ? 0 : 450);
  }
  // numbers count up from 0 as their tile arrives, then give a little bounce
  function rpCountUp(root) {
    var still = false; try { still = window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}
    $$('[data-count]', root).forEach(function (n) {
      var v = +n.dataset.count, k = n.dataset.kind, u = n.dataset.u, tile = n.closest('.rp-in'), wait = tile ? parseInt(tile.style.getPropertyValue('--d'), 10) || 0 : 0;
      if (still) { n.textContent = rpFmt(k, v, u); return; }
      // if the page is in the background the animation pauses, so make sure the real number lands
      setTimeout(function () { if (!n.classList.contains('pop')) n.textContent = rpFmt(k, v, u); }, wait + 1400);
      setTimeout(function () {
        var t0 = null;
        requestAnimationFrame(function step(now) {
          if (t0 === null) t0 = now;
          var p = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - p, 3);
          n.textContent = rpFmt(k, v * e, u);
          if (p < 1) requestAnimationFrame(step); else n.classList.add('pop');
        });
      }, wait);
    });
  }
  function rpBody() {
    var r = rpRange(RP.range), bk = rpBuckets(r.from, r.to), c = rpStats(r.from, r.to, bk, 0), p = rpStats(r.pf, r.pt, bk, diff(r.pf, r.from));
    var labels = bk.keys.map(function (k) { return bk.label(k); }), tips = bk.keys.map(function (k) { return bk.label(k, true); });
    var per = bk.kind === 'day' ? 'day' : 'week';
    var ghost = function (arr) { return RP.compare ? [{ name: 'Period before', data: arr, ghost: true }] : []; };
    var gLeg = function (n) { return rpLegend([{ n: n || 'This period', c: '#e8731c' }].concat(RP.compare ? [{ n: 'Period before', ghost: true }] : [])); };
    var k = function (o) { return rpKpi(o); }, h = '', tab = RP.tab;
    var series = function (name, cur, prev) { return [{ name: name, data: cur }].concat(ghost(prev)); };
    var main = function (title, o, sub) { var html = rpCols(o) + rpTableView(o); return rpCard(title, html, { wide: true, sub: sub, side: o.legend || gLeg() }); };
    var payRows = function (S) { return [{ l: 'Card', v: S.card, c: C_CARD }, { l: 'EFT', v: S.eft, c: C_EFT }, { l: 'Cash', v: S.cash, c: C_CASH }]; };

    if (tab === 'overview') {
      h += '<div class="rp-kpis">' +
        k({ label: 'Money received', v: c.received, p: p.received, kind: 'money', spark: c.s.received, note: c.nPay + ' payments and sales', help: 'Every deposit, balance and shop sale paid in this period' }) +
        k({ label: 'Bookings made', v: c.booked, p: p.booked, spark: c.s.made, note: money(c.madeValue) + ' booked' }) +
        k({ label: 'Occupancy', v: c.occ, p: p.occ, kind: 'pct', note: c.nights + ' of ' + c.standNights + ' stand nights' }) +
        k({ label: 'Guests hosted', v: c.guests, p: p.guests, spark: c.s.guests, note: c.arrivals + ' arrivals' }) +
        k({ label: 'Average booking', v: avg(c.madeValue, c.booked), p: avg(p.madeValue, p.booked), kind: 'money' }) +
        k({ label: 'Shop sales', v: c.shop, p: p.shop, kind: 'money', spark: c.s.shop, note: c.shopQ + ' items sold' }) + '</div>';
      h += rpNow();
      h += main('Money received', { labels: labels, tips: tips, kind: 'money', label: 'Money received per ' + per, series: series('This period', c.s.received, p.s.received) }, RP.compare ? 'Bars: this period · outline: the period before' : 'Paid in, per ' + per);
      h += '<div class="rp-grid2">' + rpCard('How it was paid', rpDonut(payRows(c), 'money', 'received'), { sub: hasFee() ? 'Card prices include the ' + cardFee() + '% card fee' : 'Same price however guests pay' }) +
        rpCard('Where bookings come from', rpHBars(Object.keys(c.src).map(function (s) { return { l: s, v: c.src[s] }; }), 'count', { u: ' bookings' }), { sub: 'Bookings made in this period' }) + '</div>';
    }

    if (tab === 'money') {
      var prov = Math.round(c.card * (DB.settings.providerFee || 2.95) / 100);
      h += '<div class="rp-kpis">' +
        k({ label: 'Money received', v: c.received, p: p.received, kind: 'money', spark: c.s.received, note: c.nPay + ' payments and sales' }) +
        k({ label: 'Paid by card', v: c.card, p: p.card, kind: 'money', spark: c.s.card }) +
        k({ label: 'Paid by EFT', v: c.eft, p: p.eft, kind: 'money', spark: c.s.eft }) +
        k({ label: 'Cash', v: c.cash, p: p.cash, kind: 'money', note: 'Mostly the shop' }) +
        k({ label: 'Refunds', v: c.refunds, p: p.refunds, kind: 'money', lower: true, note: 'Cancellations' }) +
        k({ label: 'Card fee covered', v: c.fee, p: p.fee, kind: 'money', note: 'Provider cost about ' + money(prov), help: 'The extra ' + cardFee() + '% card guests paid. It should cover what the card company charges.' }) + '</div>';
      h += rpNow();
      h += main('Card and EFT', { labels: labels, tips: tips, kind: 'money', label: 'Card and EFT payments per ' + per, legend: rpLegend([{ n: 'Card', c: C_CARD }, { n: 'EFT', c: C_EFT }]), series: [{ name: 'Card', data: c.s.card, color: C_CARD }, { name: 'EFT', data: c.s.eft, color: C_EFT }] }, 'Money in, per ' + per);
      h += '<div class="rp-grid2">' + rpCard('How it was paid', rpDonut(payRows(c), 'money', 'received')) +
        rpCard('By area', rpHBars(Object.keys(AREA_SHORT).map(function (a) { return { l: AREA_SHORT[a], v: c.byArea[a] || 0 }; }), 'money'), { sub: 'Booking payments, by where the stand is' }) + '</div>';
    }

    if (tab === 'stays') {
      var fw = add(TODAY, -((D(TODAY).getDay() + 6) % 7)), ahead = [], aheadL = [], aheadT = [];
      for (var w = 0; w < 12; w++) { var ws = add(fw, w * 7), nn = 0; for (var dd = 0; dd < 7; dd++) nn += Object.keys(standsBookedOn(add(ws, dd))).length; ahead.push(nn / Math.max(1, STANDS.length * 7) * 100); aheadL.push(fd(ws)); aheadT.push('Week of ' + fd(ws, { day: 'numeric', month: 'long' })); }
      h += '<div class="rp-kpis">' +
        k({ label: 'Occupancy', v: c.occ, p: p.occ, kind: 'pct', note: c.nights + ' of ' + c.standNights + ' stand nights' }) +
        k({ label: 'Stand nights sold', v: c.nights, p: p.nights, spark: c.s.nights }) +
        k({ label: 'Average stay', v: avg(c.stayN, c.arrivals), p: avg(p.stayN, p.arrivals), kind: 'dec', u: ' nights' }) +
        k({ label: 'Average group', v: avg(c.guests, c.arrivals), p: avg(p.guests, p.arrivals), kind: 'dec', u: ' people' }) +
        k({ label: 'Booked ahead', v: avg(c.lead, c.booked), p: avg(p.lead, p.booked), u: ' days', note: 'Between booking and arriving' }) +
        k({ label: 'Cancelled', v: avg(c.cancelled, c.made) * 100, p: avg(p.cancelled, p.made) * 100, kind: 'pct', lower: true, note: c.cancelled + ' of ' + c.made + ' bookings' }) + '</div>';
      h += main('Stand nights sold', { labels: labels, tips: tips, kind: 'count', u: ' nights', label: 'Stand nights sold per ' + per, series: series('Stand nights', c.s.nights, p.s.nights) }, 'Every stand booked for a night counts once');
      h += '<div class="rp-grid2">' +
        rpCard('Occupancy by area', rpHBars(Object.keys(AREA_SHORT).map(function (a) { var cap = STANDS.filter(function (s) { return s.area === a; }).length * c.days, v = cap ? (c.areaN[a] || 0) / cap * 100 : 0; return { l: AREA_SHORT[a], v: v, t: Math.round(v) + '%' }; }), 'pct', { max: 100, keep: true })) +
        rpCard('Busiest stands', rpHBars(STANDS.map(function (s) { return { l: s.name, v: c.standN[s.id] || 0 }; }), 'count', { u: ' nights' }), { sub: 'Nights booked in this period' }) +
        rpCard('Arrival days', rpCols({ labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'], tips: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'], kind: 'count', u: ' arrivals', h: 210, label: 'Arrivals by weekday', series: [{ name: 'Arrivals', data: c.dow }] }), { sub: 'Which day guests arrive' }) +
        rpCard('Length of stay', rpCols({ labels: ['1 night', '2 nights', '3 nights', '4+'], tips: ['1 night', '2 nights', '3 nights', '4 nights or more'], kind: 'count', u: ' bookings', h: 210, label: 'Bookings by length of stay', series: [{ name: 'Bookings', data: c.lens }] }), { sub: 'Bookings arriving in this period' }) + '</div>';
      h += rpCard('On the books: the next 12 weeks', rpCols({ labels: aheadL, tips: aheadT, kind: 'pct', max: 100, h: 220, label: 'Occupancy already booked for the next 12 weeks', series: [{ name: 'Booked', data: ahead }] }), { wide: true, sub: 'How full each week already is. Not affected by the period above.' });
    }

    if (tab === 'guests') {
      var tops = Object.keys(c.top).map(function (e) { return c.top[e]; }).sort(function (a, b) { return b.spent - a.spent; }).slice(0, 8);
      h += '<div class="rp-kpis">' +
        k({ label: 'Guests hosted', v: c.guests, p: p.guests, spark: c.s.guests, note: c.kids + ' of them children' }) +
        k({ label: 'New guests', v: c.newG, p: p.newG, note: 'First stay at Kyleu' }) +
        k({ label: 'Returning guests', v: c.retG, p: p.retG, note: 'Stayed before' }) +
        k({ label: 'Returning share', v: avg(c.retG, c.arrivals) * 100, p: avg(p.retG, p.arrivals) * 100, kind: 'pct' }) +
        k({ label: 'Mailing list', v: avg(c.consent, c.arrivals) * 100, p: avg(p.consent, p.arrivals) * 100, kind: 'pct', note: 'Agreed to news (POPIA)' }) + '</div>';
      h += main('Guests arriving', { labels: labels, tips: tips, kind: 'count', u: ' guests', label: 'Guests arriving per ' + per, series: series('Guests', c.s.guests, p.s.guests) }, 'Adults, pensioners and children, by arrival day');
      h += '<div class="rp-grid2">' + rpCard('Who comes', rpDonut(Object.keys(c.groups).sort(function (a, b) { return c.groups[b] - c.groups[a]; }).map(function (g) { return { l: g, v: c.groups[g] }; }), 'count', 'bookings'), { sub: 'Bookings arriving in this period' }) +
        rpCard('Top guests', tops.length ? '<table class="tbl rp-tbl"><thead><tr><th>Guest</th><th class="r">Stays</th><th class="r">Nights</th><th class="r">Spent</th></tr></thead><tbody>' + tops.map(function (t) { return '<tr data-guest="' + esc(t.email) + '" tabindex="0"><td data-l="Guest"><b>' + esc(t.name) + '</b></td><td data-l="Stays" class="r">' + t.stays + '</td><td data-l="Nights" class="r">' + t.nights + '</td><td data-l="Spent" class="r">' + money(t.spent) + '</td></tr>'; }).join('') + '</tbody></table>' : '<p class="rp-empty">Nothing in this period.</p>', { sub: 'By booking value, arriving in this period. Tap a guest to open them.' }) + '</div>';
    }

    if (tab === 'shop') {
      h += '<div class="rp-kpis">' +
        k({ label: 'Shop sales', v: c.shop, p: p.shop, kind: 'money', spark: c.s.shop }) +
        k({ label: 'Items sold', v: c.shopQ, p: p.shopQ }) +
        k({ label: 'Average sale', v: avg(c.shop, c.shopN), p: avg(p.shop, p.shopN), kind: 'money', note: c.shopN + ' sales' }) +
        k({ label: 'Paid by card', v: avg(c.shopCard, c.shop) * 100, p: avg(p.shopCard, p.shop) * 100, kind: 'pct', note: 'The rest is cash' }) + '</div>';
      h += main('Shop sales', { labels: labels, tips: tips, kind: 'money', label: 'Shop sales per ' + per, series: series('Sales', c.s.shop, p.s.shop) }, 'Sales rung up at reception, per ' + per);
      h += '<div class="rp-grid2">' + rpCard('Best sellers', rpHBars(Object.keys(c.items).map(function (i) { return { l: i, v: c.items[i] }; }), 'money'), { sub: 'By money taken' }) +
        rpCard('Most sold', rpHBars(Object.keys(c.itemsQ).map(function (i) { return { l: i, v: c.itemsQ[i] }; }), 'count', { u: ' sold', color: C_EFT }), { sub: 'By how many' }) + '</div>';
    }
    return h + rpHow();
  }

  var SET = 'staff', LOGF = { q: '', by: '' };
  /* =========================================================
     Email signatures: one per staff member, in the website's style.
     Copy it into Gmail or Outlook now; emails sent from this admin
     carry the same signature (text version in the demo).
     ========================================================= */
  var SIG_NAMES = { sherri: 'Sherri Symons', devon: 'Devon Symons' };
  var SIG_WHO = null;
  function sigShared() { DB.settings.sigShared = DB.settings.sigShared || { phone: '060 458 4478', web: 'www.kyleu.co.za', place: 'Dinokeng Big 5 Game Reserve, 50 km from Pretoria' }; return DB.settings.sigShared; }
  function sigData(id) {
    DB.settings.sigs = DB.settings.sigs || {};
    var st = STAFF.filter(function (x) { return x.id === id; })[0] || STAFF[0];
    if (!DB.settings.sigs[st.id]) DB.settings.sigs[st.id] = { name: SIG_NAMES[st.id] || st.name, title: st.role, mobile: '', email: 'info@kyleu.co.za', photo: true, dgr: true, social: true };
    return DB.settings.sigs[st.id];
  }
  // the DGR Certified Partner logo as Dinokeng publishes it on its own website (approved dark green version)
  var DGR_CP_IMG = 'https://www.dinokengreserve.co.za/wp-content/uploads/2025/07/DGR-PARTNER@100x-300x113.png';
  function siteBase() { return new URL('../', location.href).href; }
  function telLink(n) { var d = String(n || '').replace(/[^\d+]/g, ''); return d[0] === '0' ? '+27' + d.slice(1) : d; }
  // the signature as email-safe HTML: tables and inline styles, pictures from the website
  function sigHTML(d) {
    var sh = sigShared(), base = siteBase(), so = (DB.social || {}), soc = d.social ? [['Facebook', so.facebook], ['Instagram', so.instagram], ['TikTok', so.tiktok]].filter(function (x) { return x[1]; }) : [];
    var f = 'font-family:Arial,Helvetica,sans-serif;', a = 'color:#2a1b12;text-decoration:none;', lab = 'color:#8a7a68;padding:0 10px 0 0;font-size:12px;';
    var row = function (l, v, href) { return '<tr><td style="' + f + lab + '">' + l + '</td><td style="' + f + 'font-size:13px;color:#2a1b12;padding:1px 0;">' + (href ? '<a href="' + esc(href) + '" style="' + a + '">' + esc(v) + '</a>' : esc(v)) + '</td></tr>'; };
    return '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;' + f + 'color:#2a1b12;max-width:520px;"><tr>' +
      (d.photo ? '<td valign="middle" style="padding:0 18px 0 0;"><a href="https://' + esc(sh.web.replace(/^https?:\/\//, '')) + '" style="text-decoration:none;"><img src="' + base + 'assets/img/email/kyleu-logo.png" width="150" height="120" alt="Kyleu Bush Camp" style="display:block;border:0;"></a></td>' : '') +
      '<td valign="top" style="border-left:3px solid #e8731c;padding:0 0 0 16px;">' +
      '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:21px;font-weight:bold;color:#2a1b12;line-height:1.2;">' + esc(d.name) + '</div>' +
      '<div style="' + f + 'font-size:11px;font-weight:bold;letter-spacing:1.4px;text-transform:uppercase;color:#b8461a;padding:3px 0 9px;">' + esc(d.title ? d.title + ' · ' : '') + 'Kyleu Bush Camp</div>' +
      '<table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;">' +
      row('Phone', sh.phone, 'tel:' + telLink(sh.phone)) + (d.mobile ? row('Mobile', d.mobile, 'tel:' + telLink(d.mobile)) : '') +
      row('Email', d.email, 'mailto:' + d.email) + row('Web', sh.web, 'https://' + sh.web.replace(/^https?:\/\//, '')) + '</table>' +
      '<div style="' + f + 'font-size:12px;color:#8a7a68;padding:7px 0 0;">' + esc(sh.place) + '</div>' +
      (soc.length ? '<div style="' + f + 'font-size:12px;padding:6px 0 0;">' + soc.map(function (x) { return '<a href="' + esc(x[1]) + '" style="color:#b8461a;font-weight:bold;text-decoration:none;">' + x[0] + '</a>'; }).join(' &nbsp;·&nbsp; ') + '</div>' : '') +
      '</td></tr>' +
      (d.dgr ? '<tr><td colspan="' + (d.photo ? 2 : 1) + '" style="padding:12px 0 0;"><table cellpadding="0" cellspacing="0" border="0" style="border-collapse:collapse;"><tr><td style="padding:6px 14px 6px 0;background:#ffffff;"><img src="' + DGR_CP_IMG + '" width="96" height="36" alt="DGR Certified Partner" style="display:block;border:0;"></td><td style="' + f + 'font-size:12px;color:#5c4d3e;padding:0 0 0 14px;"><b style="color:#2a1b12;">Proud DGR CP Member</b><br>Guests qualify for Dinokeng Conservation Fee Discount Vouchers</td></tr></table></td></tr>' : '') +
      '</table>';
  }
  // the same signature as plain text (WhatsApp, plain emails, and the demo's email log)
  function sigText(d) { var sh = sigShared(); return d.name + '\n' + (d.title ? d.title + ', ' : '') + 'Kyleu Bush Camp\n' + sh.phone + (d.mobile ? ' · ' + d.mobile : '') + ' · ' + d.email + ' · ' + sh.web + (d.dgr ? '\nProud DGR CP Member' : ''); }
  function mySig() { return ME ? sigData(ME.id) : null; }
  function sigPage() {
    var who = SIG_WHO || (ME ? ME.id : STAFF[0].id), d = sigData(who), sh = sigShared(), local = /localhost|127\.0\.0\.1/.test(location.hostname);
    var fld = function (k, l, v, ph, shared) { return '<label class="fld"><span>' + l + '</span><input data-sig="' + (shared ? 'shared:' : '') + k + '" value="' + esc(v || '') + '" placeholder="' + esc(ph || '') + '"></label>'; };
    var chk = function (k, l) { return '<label class="check"><input type="checkbox" data-sig-chk="' + k + '"' + (d[k] ? ' checked' : '') + '><span>' + l + '</span></label>'; };
    return '<div class="cols"><section class="card"><header class="card-h"><h3>Email signature</h3></header>' +
      '<label class="fld"><span>Whose signature?</span><select data-sig-who>' + STAFF.map(function (x) { return '<option value="' + x.id + '"' + (x.id === who ? ' selected' : '') + '>' + esc(sigData(x.id).name) + ' (' + esc(x.role) + ')</option>'; }).join('') + '</select></label>' +
      '<div class="grid2">' + fld('name', 'Full name', d.name) + fld('title', 'Job title', d.title, 'e.g. Owner') + '</div>' +
      '<div class="grid2">' + fld('email', 'Email', d.email) + fld('mobile', 'Own mobile (optional)', d.mobile, 'e.g. 082 123 4567') + '</div>' +
      chk('photo', 'Show the Kyleu logo') + chk('dgr', 'Show "Proud DGR CP Member" (Dinokeng asks partners to use it in email signatures)') + chk('social', 'Show the Facebook and Instagram links (set under Social media)') +
      '<h5>For everyone</h5><div class="grid2">' + fld('phone', 'Camp phone', sh.phone, '', true) + fld('web', 'Website', sh.web, '', true) + '</div>' + fld('place', 'Line under the details', sh.place, '', true) +
      '</section><section class="card"><header class="card-h"><h3>Preview</h3></header><div class="sig-prev" data-sig-prev>' + sigHTML(d) + '</div>' +
      '<div class="row-btns"><button type="button" class="btn" data-act="sig-copy">' + ic('note') + 'Copy signature</button><button type="button" class="btn ghost" data-act="sig-code">' + ic('download') + 'Download for Outlook</button><button type="button" class="btn ghost" data-act="sig-html">Copy HTML code</button></div>' +
      (local ? '<p class="callout warn cflex">' + ic('alert') + '<span>This admin is opened from your own computer, so the pictures point there and would not show for other people. Copy the signature from the online admin instead.</span></p>' : '<p class="hint">' + ic('info') + ' The pictures come from ' + esc(siteBase()) + '. When the new website moves to kyleu.co.za, copy the signature again.</p>') +
      '<h5>How to add it</h5><details class="sig-how"><summary>Gmail (computer)</summary><ol><li>Press <b>Copy signature</b> above.</li><li>In Gmail: the gear, <b>See all settings</b>, <b>General</b>, scroll to <b>Signature</b>, <b>Create new</b>.</li><li>Click in the box and paste (Ctrl+V). Scroll down and press <b>Save changes</b>.</li></ol></details>' +
      '<details class="sig-how"><summary>Outlook (computer or outlook.com)</summary><ol><li>Press <b>Copy signature</b> above.</li><li>New Outlook or outlook.com: the gear, <b>Accounts</b> (or <b>Mail</b>), <b>Signatures</b>. Classic Outlook: <b>File</b>, <b>Options</b>, <b>Mail</b>, <b>Signatures</b>.</li><li>Make a new signature, paste (Ctrl+V), choose it for new emails and replies, and save.</li><li>If Outlook changes the layout, use <b>Download for Outlook</b> and open that file; then copy from there.</li></ol></details>' +
      '<details class="sig-how"><summary>iPhone, Android and Apple Mail</summary><ol><li>Phone mail apps only keep plain text signatures well. Use: ' + esc(d.name) + ', Kyleu Bush Camp, ' + esc(sh.phone) + '.</li><li>Apple Mail on a Mac: <b>Mail</b>, <b>Settings</b>, <b>Signatures</b>, add one, paste, and untick "Always match my default message font".</li></ol></details>' +
      '</section></div>';
  }
  // Settings > Quotes & invoices: how numbers start and the next number, VAT, and the bank details on every document
  function docsPage() {
    var c = K.docCfg(), B = K.BIZ || {};
    var numRow = function (kind, title, sub, pk, nk) {
      return '<div class="doc-num"><div><b>' + title + '</b><small>' + sub + '</small></div><label class="fld"><span>Starts with</span><input data-doc="' + pk + '" value="' + esc(c[pk]) + '" maxlength="12" autocapitalize="characters"></label><label class="fld"><span>Next number</span><input data-doc="' + nk + '" value="' + esc(c[nk]) + '" inputmode="numeric"></label><p class="doc-next">Next one: <b data-doc-prev="' + kind + '">' + esc(K.peekNo(kind)) + '</b></p></div>';
    };
    var sepRow = function (k, title, sub) {
      return '<div class="doc-sep"><div><b>' + title + ' number</b><small>' + sub + '. ' + (c[k] ? 'Has its own running number.' : 'Uses the booking reference, so it never changes.') + '</small></div><label class="switch"><input type="checkbox" data-doc="' + k + '"' + (c[k] ? ' checked' : '') + '><span></span>Separate numbers</label></div>';
    };
    var bankF = function (k, label) { return '<label class="fld"><span>' + label + '</span><input data-doc="' + k + '" value="' + esc(c[k] || B[k] || '') + '"></label>'; };
    return '<div class="cols"><section class="card"><header class="card-h"><h3>Numbers</h3></header>' +
      '<p class="muted small">Every booking gets the next number. Change the start each year if you like (KY26 to KY27).</p>' +
      numRow('Ref', 'Booking reference', 'Guests use it as the payment reference', 'refPrefix', 'refNext') +
      sepRow('sepQuote', 'Quotation', 'Sent when a booking is made') + (c.sepQuote ? numRow('Quote', 'Quotation numbers', 'Each new or updated quotation gets the next one', 'quotePrefix', 'quoteNext') : '') +
      sepRow('sepInv', 'Invoice', 'Made once a payment is confirmed') + (c.sepInv ? numRow('Invoice', 'Invoice numbers', 'Each new or updated invoice gets the next one', 'invPrefix', 'invNext') : '') +
      '<p class="hint">' + ic('info') + ' Only lower a next number if you are sure it has not been used yet, or two documents could share a number.</p></section>' +
      '<section class="card"><header class="card-h"><h3>VAT</h3><label class="switch"><input type="checkbox" data-doc="vatOn"' + (c.vatOn ? ' checked' : '') + '><span></span>' + (c.vatOn ? 'VAT registered' : 'Not VAT registered') + '</label></header>' +
      (c.vatOn ? '<div class="grid2"><label class="fld"><span>VAT number</span><input data-doc="vatNo" value="' + esc(c.vatNo) + '" inputmode="numeric" placeholder="e.g. 4123456789"></label><label class="fld"><span>VAT rate (%)</span><input data-doc="vatRate" value="' + esc(c.vatRate) + '" inputmode="decimal"></label></div>' +
        '<p class="muted small">Invoices are called <b>Tax invoice</b> and show the VAT number, and the total shows the VAT included. Prices stay the same (they include VAT).</p>'
        : '<p class="muted small">Off: no VAT number or VAT line appears anywhere. Switch it on when Kyleu registers for VAT and enter the VAT number.</p>') + '</section></div>' +
      '<section class="card"><header class="card-h"><h3>EFT bank details</h3><span class="muted small">Printed on every quotation and invoice, and used in emails</span></header>' +
      '<div class="grid2">' + bankF('bank', 'Bank') + bankF('accName', 'Account name') + '</div><div class="grid2">' + bankF('accNo', 'Account number') + bankF('branch', 'Branch code') + '</div><div class="grid2">' + bankF('accType', 'Account type') + bankF('swift', 'SWIFT code (for payments from abroad)') + '</div>' +
      '<p class="demo-note">' + ic('info') + 'Demo: kept in this browser and used by the website demo too. In the live version these are saved on the server.</p></section>';
  }
  function vSettings() {
    var tabs = [['staff', 'Staff & access'], ['docs', 'Quotes & invoices'], ['payments', 'Payments'], ['camp', 'Check-in & Dinokeng'], ['maps', 'Maps'], ['emails', 'Email templates'], ['sig', 'Email signature'], ['data', 'Data & privacy']];
    var body = '';
    if (SET === 'staff') body = '<section class="card flush"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last seen</th></tr></thead><tbody>' + STAFF.map(function (s, i) { return '<tr><td data-l="Name"><b>' + s.name + '</b>' + (ME.id === s.id ? ' <span class="tag ok">You</span>' : '') + '</td><td data-l="Email">' + s.email + '</td><td data-l="Role"><select data-staff-role="' + s.id + '" aria-label="Role for ' + s.name + '"' + (ME.role !== 'Owner' || ME.id === s.id ? ' disabled' : '') + '>' + Object.keys(ROLES).map(function (r) { return '<option' + (r === s.role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></td><td data-l="Last seen">' + (ME.id === s.id ? 'Now' : ['Today 07:12', 'Yesterday', '3 days ago', 'Today 09:40', 'Today 06:55', 'Today 07:30', 'Yesterday'][i] || 'Yesterday') + '</td></tr>'; }).join('') + '</tbody></table></section>' +
      '<section class="card"><header class="card-h"><h3>What each role is for</h3></header><dl class="role-info">' + Object.keys(ROLES).map(function (r) { return '<div><dt>' + r + '</dt><dd>' + ROLE_INFO[r] + '</dd></div>'; }).join('') + '</dl></section>' +
      '<section class="card"><header class="card-h"><h3>What each role can see</h3></header><table class="tbl perm"><thead><tr><th>Section</th>' + Object.keys(ROLES).map(function (r) { return '<th>' + r + '</th>'; }).join('') + '</tr></thead><tbody>' + [{ t: 'Guest names, phone numbers and bookings', has: function (r) { return ROLES[r].indexOf('cap:guests') >= 0; } }, { t: 'Money: payments, reports and what was received', has: function (r) { return ROLES[r].indexOf('cap:money') >= 0; } }, { t: 'Site jobs: cleaning, deliveries, repairs, stand notes', has: function (r) { return ROLES[r].indexOf('gate') >= 0 || ROLES[r].indexOf('site') >= 0; } }]
        .concat(NAV.filter(function (n) { return n.id !== 'site'; }).map(function (n) { return { t: n.t, has: function (r) { return ROLES[r].indexOf(n.id) >= 0; } }; }))
        .map(function (row, ri) { return '<tr' + (ri < 3 ? ' class="perm-key"' : '') + '><td>' + row.t + '</td>' + Object.keys(ROLES).map(function (r) { return '<td>' + (row.has(r) ? ic('check', 'ok-t') : '<span class="muted">No</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><button class="btn ghost" data-act="invite">' + ic('plus') + 'Invite a staff member</button></section>';
    if (SET === 'payments') body = '<div class="cols"><section class="card"><header class="card-h"><h3>Card payments</h3><span class="pill warn"><i></i>Not connected</span></header><p class="muted small">Guests pay on a secure page from the card company, so card numbers never touch the Kyleu website. Choose a South African provider:</p><div class="prov">' + ['Yoco', 'PayFast', 'Peach Payments', 'Paystack'].map(function (p) { return '<button class="prov-b" data-act="connect" data-ref="' + p + '"><b>' + p + '</b><small>Connect</small></button>'; }).join('') + '</div>' +
      '<div class="grid2"><label class="fld"><span>Card fee added to card prices</span><input value="' + cardFee() + '%" disabled></label><label class="fld"><span>Provider charges (for reports)</span><input data-provfee value="' + (DB.settings.providerFee || 2.95) + '" inputmode="decimal"></label></div><p class="muted small">Change the card fee on the Rates & fees page.</p></section>' +
      '<section class="card"><header class="card-h"><h3>EFT bank details</h3></header><p class="small">The bank details printed on quotations and invoices are under <button type="button" class="link-btn" data-set="docs">Quotes &amp; invoices</button>.</p></section></div>';
    if (SET === 'docs') body = docsPage();
    if (SET === 'emails') body = '<div class="tpl-grid">' + Object.keys(TEMPLATES).map(function (k) { var t = TEMPLATES[k]; return '<section class="card"><header class="card-h"><h3>' + t.t + '</h3><span class="muted small">' + ({ confirm: 'Sent when a booking is made', eft: 'Sent 3 days after an unpaid quotation', balance: 'Sent 10 days before arrival', arrival: 'Sent 3 days before arrival', thanks: 'Sent by you right after check-out' })[k] + '</span></header><p class="small"><b>' + esc(t.s) + '</b></p><pre class="tpl">' + esc(t.b({})) + '</pre></section>'; }).join('') + '</div><p class="demo-note">' + ic('info') + 'Words in {curly brackets} are filled in for each guest. In the live version these send automatically.</p>';
    if (SET === 'maps') body = '<p class="muted small me-intro">Move campsites, text and buildings, draw roads and footpaths, add new campsites, and change the game drive route and story of the "A day at Kyleu" scroll map. Press Save in the editor when you are done.</p><div class="me-wrap"><iframe class="me-frame" src="map-editor.html" title="Map editor"></iframe></div><div class="row-btns"><a class="btn ghost sm" href="map-editor.html" target="_blank" rel="noopener">' + ic('ext') + 'Open the editor full screen</a></div><p class="demo-note">' + ic('info') + 'Demo: Save updates the website maps in this browser. For the live site, press "Download map file" in the editor and replace assets/js/campmap-layout.js with it (or the live version saves it on the server).</p>';
    if (SET === 'sig') body = sigPage();
    if (SET === 'camp') body = '<section class="card"><header class="card-h"><h3>Check-in and check-out times</h3><span class="muted small">Used on the website, in emails and on the printed sheets</span></header>' +
      '<div class="grid2"><label class="fld"><span>Earliest check-in</span><input type="time" step="300" data-camptime="in" value="' + checkInTime() + '"></label><label class="fld"><span>Latest check-out</span><input type="time" step="300" data-camptime="out" value="' + checkOutTime() + '"></label></div>' +
      '<p class="hint">' + ic('info') + ' Guests choose an arrival time from the earliest check-in onwards. Between check-out and check-in the team cleans the stands.</p></section>' +
      '<section class="card"><header class="card-h"><h3>Thank-you after the stay</h3><span class="muted small">You send it right after check-out, by WhatsApp or email</span></header>' +
      '<label class="fld"><span>Google review link</span><input data-thanks="link" inputmode="url" autocomplete="off" value="' + esc(reviewLink()) + '" placeholder="https://"><small class="muted">Paste the \'Ask for reviews\' link from your Google Business Profile.' + (DB.settings.thanksLink == null && reviewLink() ? ' For now this is the Google reviews link from the website.' : '') + '</small></label>' +
      '<label class="fld"><span>Message</span><textarea data-thanks="text" rows="9">' + esc(thanksTpl()) + '</textarea></label>' +
      '<p class="hint">' + ic('info') + ' <b>{first}</b> becomes the guest\'s first name and <b>{link}</b> becomes the review link. This is only a link to Kyleu\'s reviews on Google, not a form on the website. Both boxes save by themselves. Empty the message to get the first wording back.</p></section>' +
      '<div class="cols"><section class="card"><header class="card-h"><h3>Indemnity</h3><button class="btn ghost sm" data-act="ind-print" data-ref="">' + ic('note') + 'Print a blank paper form</button></header><p class="muted small">Guests sign this online when they finalise their booking, or with the signing link, or here at reception. Every signed form keeps its own copy of the exact wording that was signed, so changing it here only affects new signatures. See them all under <a href="#/indemnities">Indemnities</a>.</p><label class="fld"><span>Wording</span><textarea data-indemnity rows="14">' + esc(indText()) + '</textarea></label><p class="hint">' + ic('info') + ' Start a line with <b>##</b> for a heading and <b>-</b> for a bullet; put <b>**</b> around words to make them bold. Have Kyleu\'s lawyer or insurer check the wording.</p></section>' +
      '<section class="card"><header class="card-h"><h3>Dinokeng discount vouchers (DGR CP)</h3></header><p class="small">Kyleu is a proud DGR CP member, allowed to issue Conservation Fee Discount Vouchers. For each booking, staff make one code per vehicle on the Dinokeng partner site, paste the codes on the booking and send them to the client from here, by WhatsApp or email. Dinokeng does not send the codes.</p><p class="small">The guest enters the code when they buy conservation fees on Dinokeng\'s permit site (dinokeng.plnktn.io) and pays the partner rate: R85 instead of R100 per adult per night. Children, pensioners and international guests pay the same either way. Each vehicle that uses the self-drive route also needs a Self Drive Permit, R250 once off.</p><label class="fld"><span>Link to Dinokeng\'s partner site</span><input data-dgrlink value="' + esc(dgrLink()) + '" placeholder="https://"></label><p class="hint">Paste the link you use to request codes. The booking panel opens it for you.</p></section></div>';
    if (SET === 'data') body = '<div class="cols"><section class="card"><header class="card-h"><h3>Privacy (POPIA)</h3></header><p class="small">Guest details are only used to manage bookings. Guests can ask for their details to be removed; deleting a guest keeps the booking for tax records but removes their contact details.</p><p class="small">Only staff with an account can open this admin, and every change is logged.</p></section>' +
      '<section class="card"><header class="card-h"><h3>Demo data</h3></header><p class="small">Everything in this admin is made-up demo data kept only in this browser. Bookings you make on the website demo show up here too.</p><div class="row-btns"><button class="btn ghost" data-act="export-json">' + ic('download') + 'Download a backup</button><button class="btn ghost danger-t" data-act="reset">Reset demo data</button></div></section></div>' +
      '<section class="card"><header class="card-h"><h3>Activity log</h3><div class="ph-act">' + fsearch('LOGF:q', LOGF.q, 'Search the log') + fsel('LOGF:by', LOGF.by, [['', 'Everyone']].concat(STAFF.map(function (x) { return [x.name, x.name]; })).concat([['Website', 'Website']])) + '</div></header><ul class="feed">' + DB.log.filter(function (l) { return (!LOGF.by || l.by === LOGF.by) && (!LOGF.q || (l.text + ' ' + l.by + ' ' + l.at).toLowerCase().indexOf(LOGF.q.toLowerCase()) >= 0); }).slice(0, 60).map(function (l) { return '<li' + (l.ref ? ' data-open="' + l.ref + '"' : '') + '><span>' + esc(l.text) + '</span><small>' + esc(l.by) + ' · ' + esc(l.at) + '</small></li>'; }).join('') + '</ul></section>';
    return '<div class="page-h"><div><h1>Settings</h1></div></div><div class="chips">' + tabs.map(function (t) { return '<button class="chip' + (SET === t[0] ? ' on' : '') + '" data-set="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body;
  }



  /* ---------- the indemnity: signed online by every guest (see assets/js/indemnity.js) ----------
     Guests sign while finalising their booking, with the signing link, or here at reception.
     Signed forms are read from this browser in the demo ("kyleu-indemnities"). */
  // demo only: signed forms for guests who are in camp, have left or arrive soon, so the Indemnities page has something to filter.
  // Passport numbers start with DEMO and the signatures are typed names. Reset demo data makes them again.
  function seedInd(force) {
    var FLAG = 'kyleu-ind-demo';
    try { if (!force && localStorage.getItem(FLAG)) return; } catch (e) { return; }
    var out = force ? [] : K.ind.all().filter(function (x) { return !x.demo; }), seedN = 7, rnd = function () { seedN = (seedN * 16807) % 2147483647; return seedN / 2147483647; };
    var cv = document.createElement('canvas'); cv.width = 300; cv.height = 64; var g = cv.getContext('2d'), n = 0, ver = K.ind.version(indText());
    var sigOf = function (name) { g.clearRect(0, 0, 300, 64); g.fillStyle = '#1d1410'; g.font = '30px "Segoe Print", "Bradley Hand", cursive'; g.textBaseline = 'middle'; g.fillText(name, 8, 34); return cv.toDataURL('image/png'); };
    var pick = DB.bookings.filter(function (b) { return !b.demoInd && live(b) && (b.status === 'in' || b.status === 'out' || (b.status === 'confirmed' && paidUp(b) && b.ci >= TODAY && diff(TODAY, b.ci) <= 6)); }).slice(-45);
    pick.forEach(function (b) {
      if (b.status === 'confirmed' && rnd() < .45) return;
      var st = standById(b.stand), names = indNames(b), adults = Math.max(1, b.adults + b.pens), signers = names.slice(0, adults), kids = names.slice(adults), via = rnd(), r0 = via < .6 ? 'Online' : via < .85 ? 'Signing link' : 'At reception';
      if (b.status === 'confirmed') signers = signers.slice(0, Math.max(1, Math.round(signers.length * rnd())));
      signers.forEach(function (p, i) {
        var at = r0 === 'At reception' ? b.ci + ' 13:' + String(10 + Math.floor(rnd() * 49)) : add(b.ci, -1 - Math.floor(rnd() * 6)) + ' ' + String(8 + Math.floor(rnd() * 12)).padStart(2, '0') + ':' + String(Math.floor(rnd() * 60)).padStart(2, '0');
        if (at.slice(0, 10) > TODAY) at = TODAY + ' 08:15';
        n++; out.push({ id: 'inddemo' + n, no: 'IND-' + String(b.ref).replace(/[^A-Z0-9]/gi, '').toUpperCase() + '-' + (i + 1), ref: b.ref, stand: b.stand, standName: st.name, area: st.area, ci: b.ci, co: b.co, eta: b.eta || '',
          name: p.name, idNo: 'DEMO' + (10000 + n * 37), idKind: 'Passport', dob: (1958 + Math.floor(rnd() * 40)) + '-0' + (1 + Math.floor(rnd() * 9)) + '-1' + Math.floor(rnd() * 9), phone: i ? '' : b.guest.phone, email: i ? '' : b.guest.email,
          reg: p.reg || '', role: p.role || '', minors: i ? [] : kids.map(function (k) { return k.name; }), bookedBy: guestName(b), sig: sigOf(p.name), sigW: 300, sigH: 64, typed: true,
          at: at, via: r0, by: r0 === 'At reception' ? 'Front desk' : '', textV: ver, text: '', demo: true });
      });
    });
    DB.bookings.forEach(function (b) {
      var di = b.demoInd; if (!di) return; delete b.demoInd; if (di.mode === 'none' || !live(b)) return;
      var st = standById(b.stand), kk = di.kids.map(K.ind.nkey), names = indNames(b), signers = names.filter(function (p) { return kk.indexOf(K.ind.nkey(p.name)) < 0; });
      var kids = names.filter(function (p) { return kk.indexOf(K.ind.nkey(p.name)) >= 0; }).map(function (p) { return p.name; });
      if (di.mode === 'some') signers = signers.slice(0, 1);
      signers.forEach(function (p, i) {
        var via = i ? 'Signing link' : 'Online', at = add(b.ci, -2 - i) + ' ' + (19 + i) + ':' + String(5 + i * 11).padStart(2, '0');
        if (at.slice(0, 10) >= TODAY) at = TODAY + ' 07:' + String(10 + i * 6).padStart(2, '0');
        n++; out.push({ id: 'inddemo' + n, no: 'IND-' + String(b.ref).replace(/[^A-Z0-9]/gi, '').toUpperCase() + '-' + (i + 1), ref: b.ref, stand: b.stand, standName: st.name, area: st.area, ci: b.ci, co: b.co, eta: b.eta || '',
          name: p.name, idNo: 'DEMO' + (10000 + n * 37), idKind: 'Passport', dob: (1960 + (n * 7) % 40) + '-0' + (1 + n % 9) + '-1' + (n % 9), phone: i ? '' : b.guest.phone, email: i ? '' : b.guest.email,
          reg: p.reg || '', role: p.role || '', minors: i ? [] : kids, bookedBy: guestName(b), sig: sigOf(p.name), sigW: 300, sigH: 64, typed: true, at: at, via: via, by: '', textV: ver, text: '', demo: true });
      });
    });
    try { localStorage.setItem('kyleu-indemnities', JSON.stringify(out)); localStorage.setItem(FLAG, '1'); } catch (e) {}
    save();
  }
  function signLink(b) { if (!b.key) { b.key = newKey(); save(); } return new URL(K.ind.signUrl(b.ref, b.key, '../'), location.href).href; }
  function indRec(id) { return K.ind.all().filter(function (r) { return r.id === id; })[0] || null; }
  /* ---------- paper indemnity forms and their scans ----------
     A guest who signs the printed form at the gate gets a form on record like the online ones (the same
     "kyleu-indemnities" list), marked paper: true, via "Paper form at reception", with no signature picture.
     Staff then upload the scan of the signed page (a photo or a PDF): rec.scan = { name, type, size, at, by, key }.
     The file itself is kept in the browser's file store (K.files, key "ind-scan-..."), so the list of forms stays
     small. One scan can cover several people: their forms then share the same key. Live version: on the server. */
  var IND_STORE = 'kyleu-indemnities', PAPER_VIA = 'Paper form at reception', SCAN_PDF_MAX = 1.5 * 1048576, SCAN_PHOTO_MAX = 15 * 1048576;
  function isPaper(r) { return !!(r && (r.paper || /paper/i.test(r.via || ''))); }
  function indWrite(list) { try { localStorage.setItem(IND_STORE, JSON.stringify(list)); return true; } catch (e) { return false; } }
  function indRefKey(ref) { return String(ref || '').replace(/[^A-Z0-9]/gi, '').toUpperCase(); }
  function paperFor(ref) { return K.ind.forRef(ref).filter(isPaper); }
  function carPaper(b, c) { return paperFor(b.ref).filter(function (r) { return r.car === c.id; }); }
  function paperTodo() { return K.ind.all().filter(function (r) { return !r.voided && isPaper(r) && !r.scan; }); }
  function scanTxt(r) { return r.scan ? 'scan on file' : 'scan not uploaded yet'; }
  // the button that takes a file straight away: ids = the form (or forms) the scan is for
  function scanBtn(ids, label, cls) { return '<label class="btn ' + (cls || 'sm') + ' file-btn">' + ic('clip') + label + '<input type="file" accept="image/*,application/pdf,.pdf" data-scan-file="' + esc(ids) + '"></label>'; }
  // everyone in this vehicle who has not signed online gets a paper form on record (people who are not named: one form for the group)
  function paperRecs(b, c, at, by) {
    var st = standById(b.stand), cov = K.ind.status(b.ref, people(b)).cov, l = K.ind.all(), rk = indRefKey(b.ref), i = (b.cars || []).indexOf(c), made = [];
    var named = [c.driver].concat(c.guests || []).filter(Boolean), names = named.filter(function (n) { return !cov[K.ind.nkey(n)]; }), unnamed = Math.max(0, (c.people || named.length) - named.length);
    var mine = l.filter(function (r) { return !r.voided && isPaper(r) && indRefKey(r.ref) === rk && r.car === c.id; }), grp = mine.filter(function (r) { return r.group; })[0];
    var n0 = l.filter(function (r) { return indRefKey(r.ref) === rk; }).length;
    var mk = function (name, o) { n0++; var rec = Object.assign({ id: uid('indp'), no: 'IND-' + rk + '-' + n0, ref: b.ref, stand: b.stand, standName: st.name, area: st.area, ci: b.ci, co: b.co, eta: b.eta || '', name: name, idNo: '', idKind: '', dob: '', phone: '', email: '',
      reg: c.reg || '', role: name === c.driver ? 'Driver' : 'Passenger', minors: [], bookedBy: guestName(b), sig: '', typed: false, at: at || nowStamp(), via: PAPER_VIA, by: by || (ME ? ME.name : 'Front desk'), textV: K.ind.version(indText()), text: '', paper: true, car: c.id }, o || {}); l.push(rec); made.push(rec); return rec; };
    names.forEach(function (n) { var rec = mk(n, isMinor(c, n) ? { minor: true } : null); if (grp && grp.scan && !unnamed) rec.scan = Object.assign({}, grp.scan); });   // named later: the group's scan goes with them
    if (unnamed && !grp) mk(unnamed + (unnamed === 1 ? ' person' : ' people') + ' not named, ' + carLabel(c, i), { group: unnamed, role: '' });
    if (grp && !unnamed) l.splice(l.indexOf(grp), 1);   // everyone is named now, so the group's own form goes
    if (made.length || (grp && !unnamed)) indWrite(l);
    return made;
  }
  // the paper tick was taken off this vehicle: its paper forms go, unless a scan is already on file
  function paperDrop(b, c) { var l = K.ind.all(), rk = indRefKey(b.ref), keep = l.filter(function (r) { return !(isPaper(r) && !r.scan && r.car === c.id && indRefKey(r.ref) === rk); }); if (keep.length !== l.length) indWrite(keep); }
  // a photo is made smaller first, the way proof of payment is; a PDF is kept as it is, up to 1.5 MB
  function scanBlob(file, cb) {
    var isImg = /^image\//.test(file.type || ''), isPdf = /pdf/i.test(file.type || '') || /\.pdf$/i.test(file.name || '');
    if (!isImg && !isPdf) { cb(null, 'Choose a photo or a PDF of the signed form. That file is something else.'); return; }
    if (isPdf) { if (file.size > SCAN_PDF_MAX) cb(null, 'That PDF is ' + kb(file.size) + '. The most is 1.5 MB: scan it in black and white, or take a photo of the page instead.'); else cb(file, 'application/pdf'); return; }
    if (file.size > SCAN_PHOTO_MAX) { cb(null, 'That photo is ' + kb(file.size) + ', which is too big. The most is 15 MB: take the photo again at a lower quality.'); return; }
    var rd = new FileReader();
    rd.onload = function () { var im = new Image(); im.onload = function () {
      var s = Math.min(1, 1400 / Math.max(im.width, im.height)), cv = document.createElement('canvas'); cv.width = Math.round(im.width * s); cv.height = Math.round(im.height * s); cv.getContext('2d').drawImage(im, 0, 0, cv.width, cv.height);
      try { var bin = atob(cv.toDataURL('image/jpeg', .8).split(',')[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); cb(new Blob([arr], { type: 'image/jpeg' }), 'image/jpeg'); } catch (e) { cb(null, 'That photo could not be made smaller. Try another photo, or a PDF.'); }
    }; im.onerror = function () { cb(null, 'That photo could not be opened. Try another photo, or a PDF.'); }; im.src = rd.result; };
    rd.onerror = function () { cb(null, 'That file could not be read. Try again.'); };
    rd.readAsDataURL(file);
  }
  // keep the file and put it on each form it is for; done(true, names) or done(false)
  function scanSave(file, ids, done) {
    scanBlob(file, function (blob, type) {
      if (!blob) { toast(type); done(false); return; }
      if (!K.files) { toast('This browser cannot keep files, so the scan was not saved.'); done(false); return; }
      var key = 'ind-scan-' + uid('s');
      K.files.put(key, blob).then(function () {
        var l = K.ind.all(), old = [], names = [], ref = '', scan = { name: file.name || 'Scan', type: type, size: blob.size, at: nowStamp(), by: ME.name, key: key };
        l.forEach(function (r) { if (ids.indexOf(r.id) < 0 || !isPaper(r)) return; if (r.scan && r.scan.key) old.push(r.scan.key); r.scan = Object.assign({}, scan); names.push(r.name); ref = r.ref; });
        if (!names.length) { K.files.del(key); toast('That paper form was not found. Open the page again.'); done(false); return; }
        if (!indWrite(l)) { K.files.del(key); toast('The scan could not be saved: this browser is out of space.'); done(false); return; }
        old.forEach(function (k) { if (!l.some(function (r) { return r.scan && r.scan.key === k; })) K.files.del(k); });   // a replaced file goes, unless another person's form still uses it
        var b = byRef(ref); if (b) b.notes.push({ at: nowStamp(), by: ME.name, text: 'Scan of the signed paper indemnity uploaded for ' + names.join(', ') + ' (' + scan.name + ').' });
        log('Paper indemnity scan uploaded for ' + names.join(', '), ref); save(); done(true, names);
      }, function () { toast('The scan could not be saved in this browser. Check that it has space, and try again.'); done(false); });
    });
  }
  function scanDone(ok, names) { if (!ok) return; if (!$('#modal').hidden) closeModal(); refresh(); var left = paperTodo().length; toast('Scan saved for ' + esc(names.length > 2 ? names.length + ' people' : names.join(' and ')) + (left ? '. ' + left + ' paper form' + (left === 1 ? '' : 's') + ' still to upload' : '. All paper forms have their scan')); }
  // one scan for several people on the same booking: choose the file, then tick who is on it
  function actScanMany(ref) {
    var list = paperFor(ref), b = byRef(ref), busy = false; if (!list.length) return;
    modal('One scan for several people', '<p class="muted small">' + esc(ref) + (b ? ' · ' + esc(guestName(b)) + ' · ' + esc(standById(b.stand).name) : '') + '. Use this when one scanned page or one PDF holds the signatures of the whole group.</p>' +
      '<label class="fld"><span>The scan (a photo or a PDF)</span><input type="file" name="file" accept="image/*,application/pdf,.pdf"></label>' +
      '<span class="fld-l">This scan is for: tick the people</span><div class="scan-who">' + list.map(function (r) { return '<label class="check"><input type="checkbox" name="who" value="' + esc(r.id) + '"' + (r.scan ? '' : ' checked') + '><span>' + esc(r.name) + (r.scan ? ' <small class="muted">(has a scan already: ticking replaces it)</small>' : '') + '</span></label>'; }).join('') + '</div>' +
      '<p class="hint">' + ic('info') + ' A photo is made smaller before it is kept. A PDF can be up to 1.5 MB.</p>',
      'Save the scan', function (f) {
        if (busy) return false;
        var file = f.elements.file.files && f.elements.file.files[0], ids = $$('[name=who]:checked', f).map(function (x) { return x.value; });
        if (!file) { toast('Choose the photo or PDF of the signed form'); return false; }
        if (!ids.length) { toast('Tick at least one person this scan is for'); return false; }
        busy = true; scanSave(file, ids, function (ok, names) { busy = false; scanDone(ok, names); });
        return false;
      }, { noFocus: true });
  }
  // a paper form: who, when, and the scan itself if it is on file
  function actPaperView(id) {
    var r = indRec(id); if (!r) return;
    var row = function (a, v) { return v ? '<dt>' + a + '</dt><dd>' + v + '</dd>' : ''; }, sc = r.scan;
    modal('Paper indemnity form', '<div class="ind-view"><dl class="kv">' + row('Name', '<b>' + esc(r.name) + '</b>') + row('Booking', '<button type="button" class="link-btn" data-open="' + esc(r.ref) + '">' + esc(r.ref) + '</button>') + row('Stand', esc(r.standName)) + row('Stay', fd(r.ci) + ' to ' + fd(r.co)) + row('Vehicle', esc(r.reg || '')) +
      row('Signed', esc(K.ind.when(r)) + ', on the printed form') + row('Marked by', esc(r.by || '')) + row('Scan', sc ? '<span class="ok-t">On file</span>: ' + esc(sc.name) + (sc.size ? ', ' + kb(sc.size) : '') + ' · uploaded ' + esc(atNice(sc.at)) + (sc.by ? ' by ' + esc(sc.by) : '') : '<span class="warn-t">Not uploaded yet</span>') + '</dl>' +
      (sc ? '<div class="scan-view" data-scan-view><p class="muted small">Opening the scan…</p></div>' : '<p class="callout warn cflex">' + ic('clip') + '<span>The signed paper form is not on file yet. Scan it or take a photo, then upload it here.</span></p>') +
      '<div class="row-btns">' + scanBtn(r.id, sc ? 'Replace the scan' : 'Upload the scan', sc ? 'ghost' : '') + (sc && sc.key ? '<button type="button" class="btn ghost" data-scan-dl>' + ic('download') + 'Download</button>' : '') + '</div></div>', null, null, { wide: true, noFocus: true, onOpen: function (f) {
        var box = $('[data-scan-view]', f); if (!box) return;
        if (!sc.key || !K.files) { box.innerHTML = '<div class="att-demo">' + ic('note') + '<div><b>' + esc(sc.name) + '</b><p class="muted small">Made-up demo file, so there is nothing to open. In the live version the scan opens here.</p></div></div>'; return; }
        K.files.get(sc.key).then(function (blob) {
          if (!blob) { box.innerHTML = '<p class="callout warn cflex">' + ic('alert') + '<span>The file is not in this browser any more (it was uploaded on another computer, or the browser was cleared). Upload it again.</span></p>'; return; }
          var url = URL.createObjectURL(blob);
          box.innerHTML = /^image/.test(sc.type || blob.type || '') ? '<img class="att-img" src="' + url + '" alt="Scan of the signed form">' : '<iframe class="att-pdf" src="' + url + '" title="Scan of the signed form"></iframe>';
          var dl = $('[data-scan-dl]', f); if (dl) dl.addEventListener('click', function () { downloadFile(blob, sc.name || 'scan'); });
        });
      } });
  }
  // the printed list of paper forms, with and without their scan
  function paperPrint() {
    var list = K.ind.all().filter(function (r) { return !r.voided && isPaper(r); }).sort(function (a, b) { return a.ci < b.ci ? 1 : a.ci > b.ci ? -1 : a.ref < b.ref ? -1 : 1; }), n = list.filter(function (r) { return r.scan; }).length;
    if (!list.length) { toast('No paper forms on record'); return; }
    printDoc('paper indemnity forms', list.length + ' paper form' + (list.length === 1 ? '' : 's') + ' · ' + n + ' with the scan on file, ' + (list.length - n) + ' still to upload',
      '<table><thead><tr><th>Stay</th><th>Booking</th><th>Stand</th><th>Booked by</th><th>Name on the form</th><th>Signed</th><th>Scan</th></tr></thead><tbody>' + list.map(function (r) {
        return '<tr><td>' + fd(r.ci) + ' to ' + fd(r.co) + '</td><td>' + esc(r.ref) + '</td><td>' + esc(r.standName) + '</td><td>' + esc(r.bookedBy || '') + '</td><td class="b">' + esc(r.name) + '</td><td>' + fd(r.at.slice(0, 10)) + (r.by ? '<br><span class="s">with ' + esc(r.by) + '</span>' : '') + '</td><td>' + (r.scan ? '<span class="b">On file</span><br><span class="s">' + esc(r.scan.name) + '</span>' : BOX + 'to upload') + '</td></tr>';
      }).join('') + '</tbody></table>', 'Keep the signed paper forms until their scan is on file.');
  }
  // once in each browser: paper ticks from typed-in sheets get their forms, and the demo gets a few paper forms to show (one with its scan)
  function paperInit() {
    if (!DB || DB.paperV) return; DB.paperV = 1;
    DB.bookings.forEach(function (b) { if (!live(b)) return; (b.cars || []).forEach(function (c, i) { if (c.ind && c.ind.by !== 'Online' && (/\(paper\)/.test(c.ind.by || '') || (b.notes || []).some(function (n) { return String(n.text).indexOf(carLabel(c, i) + ': paper indemnity signed at check-in') === 0; }))) paperRecs(b, c, c.ind.at, String(c.ind.by).replace(/\s*\(paper\)/, '')); }); });
    var l = K.ind.all(), cand = l.filter(function (r) { return r.demo && !r.voided && !isPaper(r) && /reception/i.test(r.via || '') && r.ci <= TODAY; }), refs = [];
    cand.sort(function (a, b) { return a.ci < b.ci ? 1 : -1; }).forEach(function (r) { if (refs.indexOf(r.ref) < 0 && refs.length < 3) refs.push(r.ref); });
    cand.forEach(function (r) {
      var k = refs.indexOf(r.ref); if (k < 0) return;
      r.paper = true; r.via = PAPER_VIA; r.by = 'Leuan'; r.sig = ''; r.typed = false; r.idNo = ''; r.idKind = ''; r.dob = '';
      var pb = byRef(r.ref); if (pb) (pb.cars || []).forEach(function (c) { if ([c.driver].concat(c.guests || []).filter(Boolean).some(function (n) { return K.ind.nkey(n) === K.ind.nkey(r.name); })) r.car = c.id; });
      if (k === refs.length - 1 && refs.length > 1) r.scan = { name: 'Indemnity ' + r.ref + ' signed.jpg', type: 'image/jpeg', size: 284100, at: r.at, by: 'Leuan', demo: true };
    });
    if (refs.length) indWrite(l);
    save();
  }
  function indNames(b) { var out = []; ensureCars(b).forEach(function (c, i) { if (c.driver) out.push({ name: c.driver, reg: c.reg, car: 'Vehicle ' + (i + 1), role: 'Driver' }); (c.guests || []).filter(Boolean).forEach(function (n) { var p = { name: n, reg: c.reg, car: 'Vehicle ' + (i + 1), role: 'Passenger' }; if (isMinor(c, n)) p.minor = true; out.push(p); }); }); if (!out.some(function (p) { return K.ind.nkey(p.name) === K.ind.nkey(guestName(b)); })) out.unshift({ name: guestName(b), reg: '', car: '', role: '' }); return out; }
  function carSigned(b, c) { var ns = [c.driver].concat(c.guests || []).filter(Boolean), cov = K.ind.status(b.ref, people(b)).cov; return ns.length > 0 && ns.every(function (n) { return cov[K.ind.nkey(n)]; }); }
  function indPill(b) { var s = indStat(b); return '<span class="pill ' + (s.done ? 'ok' : s.covered ? 'warn' : 'muted') + '">' + (s.done ? ic('check') + 'Everyone signed for' : Math.min(s.covered, s.total) + ' of ' + s.total + ' signed for') + '</span>'; }
  function indHTML(b) {
    if (b.status === 'cancelled') return '';
    var s = K.ind.status(b.ref, people(b)), left = indNames(b).filter(function (p) { return !s.cov[K.ind.nkey(p.name)]; }), unnamed = Math.max(0, s.total - s.covered - left.length);
    var nPap = s.recs.filter(isPaper).length, nEl = s.recs.length - nPap;
    return '<section class="d-sec ind-sec"><h4 class="h4-row">Indemnity' + indPill(b) + '</h4>' +
      (s.recs.length ? '<div class="ind-recs">' + s.recs.map(function (r) {
        if (isPaper(r)) return '<div class="ind-rec paper' + (r.scan ? ' has' : '') + '"><span class="ind-rec-i">' + ic('clip') + '</span><span class="ind-rec-b"><b>' + esc(r.name) + '</b><small>Signed on paper ' + whenShort(r.at) + (r.by ? ', with ' + esc(r.by) : '') + ' · ' + (r.scan ? 'scan on file since ' + whenShort(r.scan.at) : '<span class="warn-t">scan not uploaded yet</span>') + '</small></span>' +
          (r.scan ? '<button type="button" class="btn ghost sm" data-act="ind-view" data-ref="' + r.id + '">View scan</button>' + scanBtn(r.id, 'Replace', 'ghost sm') : scanBtn(r.id, 'Upload the scan')) + '</div>';
        return '<div class="ind-rec"><span class="ind-rec-i">' + ic('shield') + '</span><span class="ind-rec-b"><b>' + esc(r.name) + '</b><small>' + esc(r.idKind) + ' ' + esc(K.ind.maskId(r.idNo)) + ' · signed ' + whenShort(r.at) + (/reception/i.test(r.via) ? ' at reception' : /link/i.test(r.via) ? ' with the link' : ' online') + ((r.minors || []).length ? ' · also for ' + esc(r.minors.join(', ')) : '') + '</small></span>' +
          '<button type="button" class="btn ghost sm" data-act="ind-view" data-ref="' + r.id + '">View</button><button type="button" class="icon-btn sm" data-act="ind-pdf" data-ref="' + r.id + '" aria-label="Download the signed form" title="Download PDF">' + ic('download') + '</button></div>';
      }).join('') + '</div>' : '<p class="muted small">Nobody has signed yet. Guests sign online when they finalise the booking, or you can send them the signing link.</p>') +
      (left.length || unnamed ? '<p class="small ind-left">' + ic('info') + ' Still to sign: ' + esc(left.map(function (p) { return p.name; }).join(', ')) + (unnamed ? (left.length ? ' and ' : '') + unnamed + ' ' + (unnamed === 1 ? 'person' : 'people') + ' not named yet' : '') + '</p>' : '') +
      '<div class="row-btns ind-acts-a">' + (s.done ? '' : '<button type="button" class="btn sm" data-act="ind-sign" data-ref="' + b.ref + '">' + ic('edit') + 'Sign here at reception</button><button type="button" class="btn ghost sm" data-act="send-doc" data-ref="' + b.ref + '|indemnity">' + ic('send') + 'Send the signing link</button><button type="button" class="btn ghost sm" data-act="ind-link" data-ref="' + b.ref + '">' + ic('clip') + 'Copy link</button>') +
      (nPap > 1 ? '<button type="button" class="btn ghost sm" data-act="scan-many" data-ref="' + b.ref + '">' + ic('clip') + 'One scan for several people</button>' : '') +
      (nEl > 1 ? '<button type="button" class="btn ghost sm" data-act="ind-pdf-ref" data-ref="' + b.ref + '">' + ic('download') + 'All ' + nEl + ' online forms (PDF)</button>' : '') + '<button type="button" class="btn ghost sm" data-act="ind-print" data-ref="' + b.ref + '|">' + ic('note') + 'Paper form</button></div></section>';
  }
  // a guest signs on this device, at reception
  function actIndSign(ref, after) {
    var b = byRef(ref); if (!b) return; var st = standById(b.stand);
    modal('Indemnity for ' + esc(guestName(b)), '<p class="muted small">' + esc(b.ref) + ' · ' + esc(st.name) + ' · ' + fd(b.ci) + ' to ' + fd(b.co) + '. Hand the device to the guest: they read the risks, then sign.</p>' + K.ind.statusHTML(b.ref, people(b), indNames(b)) + K.ind.risksHTML(st.area, { standName: st.name, title: 'What the guest agrees to' }) + '<div data-ind-form></div>', null, null, { wide: true, noFocus: true,
      onOpen: function (f) {
        // the signing form is its own form: move it out of the modal's form so Enter does not submit the modal
        var box = $('[data-ind-form]', f);
        K.ind.form(box, { ref: b.ref, key: b.key, stand: b.stand, standName: st.name, area: st.area, ci: b.ci, co: b.co, eta: b.eta, booker: { name: guestName(b), phone: b.guest.phone, email: b.guest.email }, people: indNames(b), cars: ensureCars(b).map(function (c, i) { return { label: 'Vehicle ' + (i + 1), reg: c.reg }; }), total: people(b), via: 'At reception', by: ME.name, staff: true }, function (rec) {
          log('Indemnity signed at reception by ' + rec.name + (rec.minors.length ? ' (also for ' + rec.minors.join(', ') + ')' : ''), b.ref); save(); refresh(); if (after) after(); else closeModal();
          toast('Signed and saved: ' + esc(rec.name) + (K.ind.status(b.ref, people(b)).done ? '. Everyone is signed for.' : ''));
        });
      } });
  }
  function actIndView(id) {
    var r = indRec(id); if (!r) return; if (isPaper(r)) return actPaperView(id);
    var row = function (a, v) { return v ? '<dt>' + a + '</dt><dd>' + v + '</dd>' : ''; };
    modal('Signed indemnity', '<div class="ind-view"><dl class="kv">' + row('Name', '<b>' + esc(r.name) + '</b>') + row(esc(r.idKind === 'SA ID' ? 'SA ID number' : 'Passport number'), esc(r.idNo)) + row('Date of birth', fd(r.dob, { day: 'numeric', month: 'long', year: 'numeric' })) + row('Mobile', esc(r.phone)) + row('Email', esc(r.email)) +
      row('Signs for (under 18)', esc((r.minors || []).join(', '))) + row('Booking', '<button type="button" class="link-btn" data-open="' + esc(r.ref) + '">' + esc(r.ref) + '</button>') + row('Stand', esc(r.standName) + ' · ' + esc(K.ind.AREA_NAME[r.area] || '')) + row('Stay', fd(r.ci) + ' to ' + fd(r.co)) + row('Vehicle', esc(r.reg ? r.reg + (r.role ? ' (' + r.role.toLowerCase() + ')' : '') : 'Not given')) +
      row('Signed', esc(K.ind.when(r))) + row('How', esc(K.ind.viaText(r))) + row('Form number', esc(r.no)) + '</dl>' +
      '<div class="ind-sigv"><img src="' + r.sig + '" alt="Signature of ' + esc(r.name) + '"><small>Signature of ' + esc(r.name) + (r.typed ? ' (typed)' : '') + '</small></div>' +
      '<details class="ind-full"><summary>The wording ' + esc(r.name.split(' ')[0]) + ' signed</summary><div class="ind-text">' + K.ind.html(r.text || indText()) + '</div></details>' +
      '<div class="row-btns"><button type="button" class="btn" data-act="ind-pdf" data-ref="' + r.id + '">' + ic('download') + 'Download PDF</button></div></div>', null, null, { wide: true, noFocus: true });
  }

  /* ---------- Indemnities page: every signed form, filtered for the insurer ---------- */
  var INDF = { tab: 'signed', q: '', stand: '', area: '', from: '', to: '', via: '' };
  function indFiltered() {
    var q = INDF.q.toLowerCase().trim();
    return K.ind.all().filter(function (r) {
      if (r.voided) return false;
      if (INDF.stand && r.stand !== INDF.stand) return false;
      if (INDF.area && r.area !== INDF.area) return false;
      if (INDF.from && r.co < INDF.from) return false;
      if (INDF.to && r.ci > INDF.to) return false;
      if (INDF.via && (INDF.via === 'paper' ? !isPaper(r) : INDF.via === 'reception' ? !/reception/i.test(r.via) || isPaper(r) : INDF.via === 'link' ? !/link/i.test(r.via) : /reception|link/i.test(r.via))) return false;
      if (q && [r.name, r.idNo, r.ref, r.reg, r.phone, r.email, r.standName, (r.minors || []).join(' ')].join(' ').toLowerCase().indexOf(q) < 0) return false;
      return true;
    }).sort(function (a, b) { return a.at < b.at ? 1 : -1; });
  }
  function indFilterText() {
    var t = [];
    if (INDF.from || INDF.to) t.push('stays ' + (INDF.from ? 'from ' + fd(INDF.from, { day: 'numeric', month: 'short', year: 'numeric' }) : '') + (INDF.to ? ' to ' + fd(INDF.to, { day: 'numeric', month: 'short', year: 'numeric' }) : ''));
    if (INDF.stand) t.push(standById(INDF.stand).name); else if (INDF.area) t.push(K.ind.AREA_NAME[INDF.area]);
    if (INDF.via) t.push({ online: 'signed online', link: 'signed with the link', reception: 'signed at reception', paper: 'signed on paper' }[INDF.via]);
    if (INDF.q) t.push('search "' + INDF.q + '"');
    return t.join(', ');
  }
  function vIndemnities() {
    var all = K.ind.all().filter(function (r) { return !r.voided; }), month = TODAY.slice(0, 7);
    var soon = DB.bookings.filter(function (b) { return live(b) && b.status !== 'out' && (b.status !== 'pending' || b.noRelease) && b.co >= TODAY && diff(TODAY, b.ci) <= 30; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });   // a stand kept without a payment needs the indemnity too
    var todo = soon.filter(function (b) { return !indStat(b).done; }), week = todo.filter(function (b) { return diff(TODAY, b.ci) <= 7; });
    var online = all.filter(function (r) { return !/reception/i.test(r.via); }).length, pTodo = all.filter(function (r) { return isPaper(r) && !r.scan; });
    var head = '<div class="page-h"><div><h1>Indemnities</h1><p class="muted">Every guest signs Kyleu\'s indemnity before arriving: online when they finalise the booking, with the signing link, or here at reception. Each signed form keeps the exact wording, the signature, and the date and time. Filter below and download the forms for the insurer.</p></div>' +
      '<div class="ph-act"><button class="btn ghost" data-act="ind-csv">' + ic('download') + 'Spreadsheet</button><button class="btn" data-act="ind-pdf-all">' + ic('download') + 'Download PDF</button></div></div>' +
      '<div class="kpis">' + tile('Arriving this week, not all signed', week.length, week.length ? 'Send them the signing link' : 'Everyone arriving is signed for', null, week.length ? 'warn' : 'ok') + tile('Signed this month', all.filter(function (r) { return r.at.slice(0, 7) === month; }).length, 'forms') + tile('Signed before arriving', all.length ? Math.round(online / all.length * 100) + '%' : '-', online + ' of ' + all.length + ' online') + tile('Forms on record', all.length, 'kept for the insurer') + '</div>' +
      '<div class="chips">' + [['signed', 'Signed forms', all.length], ['todo', 'Still to sign', todo.length], ['paper', 'Paper forms to upload', pTodo.length]].map(function (x) { return '<button class="chip' + (INDF.tab === x[0] ? ' on' : '') + '" data-indtab="' + x[0] + '">' + x[1] + ' <span>' + x[2] + '</span></button>'; }).join('') + '</div>';
    if (INDF.tab === 'todo') {
      var row = function (b) {
        return '<div class="brow vrow" data-ind-todo="' + b.ref + '"><span class="brow-st">' + fd(b.ci) + '</span><span class="brow-g" data-open="' + b.ref + '"><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + ' · ' + fd(b.ci) + ' to ' + fd(b.co) + ' · ' + (paidUp(b) || b.onArrival ? 'finalising is open' : 'not paid in full yet') + '</small>' + nudgeNote(b, 'ind') + '</span>' + indPill(b) +
          '<span class="row-btns"><button class="btn sm ghost" data-act="send-doc" data-ref="' + b.ref + '|indemnity">' + ic('send') + 'Send the signing link</button><button class="btn sm ghost" data-act="ind-sign" data-ref="' + b.ref + '">' + ic('edit') + 'Sign here</button></span></div>';
      };
      return head + '<section class="card"><header class="card-h"><h3>Arriving in the next 30 days, not everyone signed</h3><span class="count">' + todo.length + '</span></header>' + (todo.length ? todo.map(row).join('') : '<p class="empty">Everyone arriving in the next 30 days is signed for.</p>') + '</section>';
    }
    if (INDF.tab === 'paper') {
      // everyone who signed on paper and has no scan yet, by booking, newest stays first
      var grp = {}, order = [], nPaper = all.filter(isPaper).length;
      pTodo.forEach(function (r) { if (!grp[r.ref]) { grp[r.ref] = []; order.push(r.ref); } grp[r.ref].push(r); });
      order.sort(function (x, y) { var a = grp[x][0], b = grp[y][0]; return a.ci < b.ci ? 1 : a.ci > b.ci ? -1 : x < y ? -1 : 1; });
      return head + '<section class="card"><header class="card-h"><h3>Paper forms to upload</h3><span class="count">' + pTodo.length + '</span>' + (nPaper ? '<button type="button" class="btn ghost sm" data-act="paper-print">' + ic('note') + 'Print the list of paper forms</button>' : '') + '</header>' +
        (pTodo.length ? '<p class="muted small">These people signed the printed form at the gate. Scan each signed page, or take a photo of it, and add it here. To do many quickly, go down the list: press <b>Upload the scan</b>, choose the file, and that row is done. Photos are made smaller by themselves; a PDF can be up to 1.5 MB.</p>' +
          order.map(function (ref) {
            var rs = grp[ref], r0 = rs[0], pb = byRef(ref);
            return '<div class="paper-grp"><div class="paper-grp-h"><span class="brow-g"' + (pb ? ' data-open="' + esc(ref) + '"' : '') + '><b>' + esc(r0.bookedBy || (pb ? guestName(pb) : '')) + '</b><small>' + esc(ref) + ' · ' + esc(r0.standName) + ' · ' + fd(r0.ci) + ' to ' + fd(r0.co) + '</small></span>' +
              (rs.length > 1 ? scanBtn(rs.map(function (r) { return r.id; }).join(','), 'One scan for all ' + rs.length, 'ghost sm') + '<button type="button" class="link-btn" data-act="scan-many" data-ref="' + esc(ref) + '">Choose the people</button>' : '') + '</div>' +
              rs.map(function (r) { return '<div class="paper-row-i">' + ic('clip') + '<span class="brow-g"><b>' + esc(r.name) + '</b><small>Signed on paper ' + whenShort(r.at) + (r.by ? ', with ' + esc(r.by) : '') + (r.reg ? ' · ' + esc(r.reg) : '') + '</small></span>' + scanBtn(r.id, 'Upload the scan') + '</div>'; }).join('') + '</div>';
          }).join('')
          : '<p class="empty">' + (nPaper ? 'Nothing to upload. Every paper form has its scan on file.' : 'Nothing to upload. Nobody has signed on paper yet.') + '</p>') + '</section>';
    }
    var list = indFiltered(), areas = [['', 'All areas']].concat(Object.keys(K.ind.AREA_NAME).map(function (k) { return [k, { fenced: 'Fenced camp', unfenced: 'Open camp', 'self-sufficient': 'Self-sufficient' }[k]]; }));
    return head + '<div class="filters">' + fsearch('INDF:q', INDF.q, 'Search name, ID, booking or vehicle') +
      fsel('INDF:area', INDF.area, areas, 'Area') + fsel('INDF:stand', INDF.stand, [['', 'All stands']].concat(STANDS.filter(function (x) { return !INDF.area || x.area === INDF.area; }).map(function (x) { return [x.id, x.name]; })), 'Stand') +
      '<label class="fld-inline">Stays from <input type="date" data-fk="INDF:from" value="' + esc(INDF.from) + '"' + (INDF.from ? ' class="on"' : '') + '></label><label class="fld-inline">to <input type="date" data-fk="INDF:to" value="' + esc(INDF.to) + '"' + (INDF.to ? ' class="on"' : '') + '></label>' +
      fsel('INDF:via', INDF.via, [['', 'Signed anywhere'], ['online', 'Online, finalising'], ['link', 'With the link'], ['reception', 'At reception'], ['paper', 'On paper']], 'How signed') + fclear('INDF', ['q', 'area', 'stand', 'from', 'to', 'via']) + '</div>' +
      '<div class="card flush">' + (list.length ? '<table class="tbl" data-sort-key="ind"><thead><tr><th>Signed</th><th>Name</th><th>ID or passport</th><th>Booking</th><th>Stand</th><th>Stay</th><th>Vehicle</th><th>How</th><th class="r"></th></tr></thead><tbody>' +
        list.map(function (r) {
          return '<tr><td data-s="' + esc(r.at) + '">' + whenShort(r.at) + '<small class="muted"> ' + (r.at.slice(0, 10) === TODAY ? '' : r.at.slice(0, 4)) + '</small></td><td><button type="button" class="link-btn" data-act="ind-view" data-ref="' + r.id + '"><b>' + esc(r.name) + '</b></button>' + ((r.minors || []).length ? '<small class="muted"> +' + r.minors.length + ' under 18</small>' : '') + '</td>' +
            '<td>' + (isPaper(r) ? '<span class="muted">On the paper form</span>' : esc(K.ind.maskId(r.idNo))) + '</td><td><button type="button" class="link-btn" data-open="' + esc(r.ref) + '">' + esc(r.ref) + '</button></td><td>' + esc(r.standName) + '</td><td data-s="' + esc(r.ci) + '">' + fd(r.ci) + ' to ' + fd(r.co) + '</td><td>' + esc(r.reg || '') + '</td>' +
            '<td>' + (isPaper(r) ? 'Paper<br>' + (r.scan ? '<small class="ok-t">Scan on file</small>' : '<small class="warn-t">Scan to upload</small>') : /reception/i.test(r.via) ? 'Reception' : /link/i.test(r.via) ? 'Link' : 'Online') + '</td><td class="r">' + (isPaper(r) ? (r.scan ? '<button type="button" class="btn ghost sm" data-act="ind-view" data-ref="' + r.id + '">View scan</button>' : scanBtn(r.id, 'Upload the scan')) : '<button type="button" class="icon-btn sm" data-act="ind-pdf" data-ref="' + r.id + '" aria-label="Download PDF" title="Download PDF">' + ic('download') + '</button>') + '</td></tr>';
        }).join('') + '</tbody></table>' : '<p class="empty">' + (all.length ? 'No signed forms with these filters.' : 'No signed forms yet. They appear here as soon as a guest signs.') + '</p>') + '</div>' +
      '<p class="muted small" style="margin-top:12px">' + ic('info') + ' ID numbers are partly hidden here; the full number is on the signed form. Download PDF makes one file with a register page and every online form that matches the filters. Paper forms are kept as scans: the register says how many there are and how many scans are on file.</p>';
  }

  /* ---------- Dinokeng codes page: arrivals and which codes are still to send ---------- */
  // who has paid: codes usually go to guests who have paid in full
  var VF = { pay: '' };
  function vPay(b) {
    if (paidUp(b)) return { k: 'full', html: '<span class="pill ok vp">' + ic('check') + 'Paid in full</span>' };
    if (b.status === 'pending' || !paid(b)) return { k: 'none', html: '<span class="pill bad vp"><i></i>Nothing paid yet</span>' };
    if (b.onArrival) return { k: 'part', html: '<span class="pill info vp"><i></i>' + money(balance(b)) + ' on arrival</span>' };
    return { k: 'part', html: '<span class="pill warn vp"><i></i>' + money(balance(b)) + ' still to pay</span>' };
  }
  function vVouchers() {
    var all = DB.bookings.filter(function (b) { return live(b) && b.status !== 'out' && b.ci >= TODAY && diff(TODAY, b.ci) <= 30; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    var nFull = all.filter(function (b) { return vPay(b).k === 'full'; }).length, readyToSend = all.filter(function (b) { return vPay(b).k === 'full' && codesTodo(b) > 0; });
    var up = all.filter(function (b) { var k = vPay(b).k; return !VF.pay || (VF.pay === 'full' ? k === 'full' : k !== 'full'); });
    var week = up.filter(function (b) { return diff(TODAY, b.ci) <= 7; }), later = up.filter(function (b) { return diff(TODAY, b.ci) > 7; });
    var todo = all.filter(function (b) { return diff(TODAY, b.ci) <= 7 && codesTodo(b) > 0; }), month = TODAY.slice(0, 7);
    var sentMonth = DB.bookings.reduce(function (a, b) { return a + (b.cars || []).filter(function (c) { return c.dgrSent && String(c.dgrSent.at).slice(0, 7) === month; }).length; }, 0);
    var row = function (b) {
      var n = ensureCars(b).length, t = codesTodo(b);
      return '<div class="brow vrow"><span class="brow-st">' + fd(b.ci) + '</span><span class="brow-g" data-open="' + b.ref + '"><b>' + esc(guestName(b)) + '</b><small>' + esc(b.guest.email || 'No email') + ' · ' +
        (!vehKnown(b) ? (t ? VEH_ASSUMED + ', not sent' : 'vehicles not given yet, 1 code sent') : !t ? 'all ' + n + ' sent' : t === n ? n + ' vehicle' + (n === 1 ? '' : 's') + ', none sent' : t + ' of ' + n + ' vehicles still to send') + '</small>' + (nudgeOf(b, 'dgr') || t ? nudgeNote(b, 'dgr', !t) : '') + '</span>' +
        vPay(b).html + (t ? '<button class="btn sm ghost" data-act="dgr" data-ref="' + b.ref + '">' + ic('gift') + 'Add codes</button>' : '<span class="pill ok vsent">' + ic('check') + 'Codes sent</span>') + '</div>';
    };
    return '<div class="page-h"><div><h1>Dinokeng vouchers</h1><p class="muted">Kyleu is a proud DGR CP member, so overnight guests qualify for Conservation Fee Discount Vouchers and pay R85 instead of R100 per adult per night. Make one code per vehicle on the Dinokeng site, paste it on the booking and send it to the client yourself by WhatsApp or email. Dinokeng does not send them.</p></div><div class="ph-act"><a class="btn ghost" href="' + esc(dgrLink()) + '" target="_blank" rel="noopener">' + ic('ext') + 'Open Dinokeng site</a></div></div>' +
      '<div class="kpis">' + tile('Still to send this week', todo.length, todo.length ? 'Bookings arriving in the next 7 days' : 'All sent for this week', null, todo.length ? 'warn' : 'ok') + tile('Paid in full, codes to send', readyToSend.length, readyToSend.length ? 'Ready for their codes now' : 'Nobody waiting', null, readyToSend.length ? 'warn' : 'ok') + tile('Codes sent this month', sentMonth, 'one per vehicle') + tile('Arriving in the next 30 days', all.length, all.reduce(function (a, b) { return a + ensureCars(b).length; }, 0) + ' vehicles') + '</div>' +
      '<div class="chips">' + [['', 'All', all.length], ['full', 'Paid in full', nFull], ['due', 'Not paid in full', all.length - nFull]].map(function (x) { return '<button class="chip' + (VF.pay === x[0] ? ' on' : '') + '" data-vpay="' + x[0] + '">' + x[1] + ' <span>' + x[2] + '</span></button>'; }).join('') + '</div>' +
      '<section class="card"><header class="card-h"><h3>Arriving in the next 7 days</h3><span class="count">' + week.length + '</span></header>' + (week.length ? week.map(row).join('') : '<p class="empty">' + (VF.pay ? 'Nobody here with this filter.' : 'Nobody arriving in the next 7 days.') + '</p>') + '</section>' +
      '<section class="card"><header class="card-h"><h3>Later this month</h3><span class="count">' + later.length + '</span></header>' + (later.length ? later.map(row).join('') : '<p class="empty">' + (VF.pay ? 'Nobody here with this filter.' : 'No other arrivals in the next 30 days.') + '</p>') + '</section>';
  }
  /* =========================================================
     Every table: click a heading to sort (a picker on phones),
     25 rows a page. Filters: <select data-fk="OBJ:key">, <input data-q="OBJ:key">
     ========================================================= */
  var SORT = {}, TPG = {}, PG_SIZE = 25;
  function FO(n) { return { GATE: GATE, INDF: INDF, F: F, EF: EF, IN: IN, GF: GF, SHOP: SHOP, PROD: PROD, CAL: CAL, STF: STF, GD: GD, LOGF: LOGF, PAYF: PAYF }[n]; }
  function fsel(fk, cur, opts, label) { return '<select data-fk="' + fk + '" aria-label="' + esc(label || opts[0][1]) + '"' + (cur ? ' class="on"' : '') + '>' + opts.map(function (o) { return '<option value="' + esc(o[0]) + '"' + (String(o[0]) === String(cur) ? ' selected' : '') + '>' + esc(o[1]) + '</option>'; }).join('') + '</select>'; }
  function fsearch(fk, cur, ph) { return '<label class="search">' + ic('search') + '<input type="search" data-q="' + fk + '" placeholder="' + esc(ph) + '" value="' + esc(cur) + '" aria-label="' + esc(ph) + '"></label>'; }
  function fclear(obj, keys) { var n = keys.filter(function (k) { return FO(obj)[k]; }).length; return n ? '<button class="btn ghost sm" data-fclear="' + obj + ':' + keys.join(',') + '">' + ic('x') + 'Clear ' + n + ' filter' + (n > 1 ? 's' : '') + '</button>' : ''; }
  function resetPages() { var v = route() + '|'; Object.keys(TPG).forEach(function (k) { if (k.indexOf(v) === 0) delete TPG[k]; }); }
  function dataRow(r) { return !r.classList.contains('day') && r.cells.length > 1; }
  function cellVal(td) {
    if (!td) return '';
    if (td.dataset.s != null) { var ds = td.dataset.s; return /^-?\d+(\.\d+)?$/.test(ds) ? +ds : ds.toLowerCase(); }
    var t = (td.querySelector('b') || td).textContent.trim();
    var m = t.match(/^(-)?R ?(\d[\d ]*)/); if (m) return (m[1] ? -1 : 1) * parseFloat(m[2].replace(/ /g, ''));
    if (/^-?\d+(\.\d+)?%?$/.test(t)) return parseFloat(t);
    return t.toLowerCase();
  }
  function cmpV(a, b) { if (typeof a === 'number' && typeof b === 'number') return a - b; if (typeof a === 'number') return -1; if (typeof b === 'number') return 1; return String(a).localeCompare(String(b), 'en', { numeric: true }); }
  function sortKind(rows, ci) { var td = rows[0] && rows[0].cells[ci]; if (!td) return 'text'; if (td.dataset.s && /^\d{4}-\d{2}-\d{2}/.test(td.dataset.s)) return 'date'; return typeof cellVal(td) === 'number' ? 'num' : 'text'; }
  function sortLabel(name, kind, dir) { return name + ': ' + (kind === 'date' ? (dir > 0 ? 'earliest first' : 'latest first') : kind === 'num' ? (dir > 0 ? 'lowest first' : 'highest first') : (dir > 0 ? 'A to Z' : 'Z to A')); }
  function applyTables() {
    var v = route();
    $$('#view table.tbl').forEach(function (tb, ti) {
      if (tb.matches('.perm, .rate-matrix, .rates') || tb.closest('details')) return;
      var ths = $$('thead th', tb), body = tb.tBodies[0]; if (!ths.length || !body) return;
      var key = v + '|' + (tb.dataset.sortKey || ti), st = SORT[key], rows = $$(':scope > tr', body), data = rows.filter(dataRow), cols = [];
      tb.dataset.sortKey = key;
      ths.forEach(function (th, ci) {
        var name = th.firstChild ? th.firstChild.textContent.trim() : ''; if (!name) return;
        var kind = sortKind(data, ci); cols.push({ ci: ci, name: name, kind: kind });
        th.classList.add('sortable'); th.tabIndex = 0; th.dataset.sortCol = ci; th.title = 'Sort by ' + name.toLowerCase();
        th.setAttribute('aria-sort', st && st.col === ci ? (st.dir > 0 ? 'ascending' : 'descending') : 'none');
      });
      if (st) { data.sort(function (a, b) { return cmpV(cellVal(a.cells[st.col]), cellVal(b.cells[st.col])) * st.dir || 0; }); data.forEach(function (r) { body.appendChild(r); }); tb.classList.add('is-sorted'); }
      var pages = Math.ceil(data.length / PG_SIZE), pg = Math.min(TPG[key] || 0, Math.max(0, pages - 1)); TPG[key] = pg;
      if (pages > 1) {
        data.forEach(function (r, i) { r.hidden = i < pg * PG_SIZE || i >= (pg + 1) * PG_SIZE; });
        if (!st) { var cur = null, vis = false; $$(':scope > tr', body).forEach(function (r) { if (r.classList.contains('day')) { if (cur) cur.hidden = !vis; cur = r; vis = false; } else if (!r.hidden) vis = true; }); if (cur) cur.hidden = !vis; }
      }
      var host = tb.closest('.card') || tb;
      if (pages > 1) host.insertAdjacentHTML('afterend', '<div class="tpager"><span>' + (pg * PG_SIZE + 1) + ' to ' + Math.min(data.length, (pg + 1) * PG_SIZE) + ' of ' + data.length + '</span><button class="btn ghost sm" data-tpg="' + key + '|-1"' + (pg ? '' : ' disabled') + '>' + ic('chev-l') + 'Previous</button><button class="btn ghost sm" data-tpg="' + key + '|1"' + (pg < pages - 1 ? '' : ' disabled') + '>Next' + ic('chev-r') + '</button></div>');
      if (cols.length && data.length > 1) host.insertAdjacentHTML('beforebegin', '<label class="sort-m">' + ic('list') + '<span>Sort by</span><select data-sortm="' + key + '"><option value="">Default order</option>' + cols.map(function (c) { return [1, -1].map(function (d) { return '<option value="' + c.ci + '|' + d + '"' + (st && st.col === c.ci && st.dir === d ? ' selected' : '') + '>' + esc(sortLabel(c.name, c.kind, d)) + '</option>'; }).join(''); }).join('') + '</select></label>');
    });
  }
  // dashboard widgets: a page at a time
  var DP = { tab: 'arr', arr: 0, dep: 0, in: 0, attn: 0, act: 0 };
  function pageOf(list, key, size) {
    var pages = Math.max(1, Math.ceil(list.length / size)); if (DP[key] >= pages) DP[key] = pages - 1;
    var p = DP[key];
    return { items: list.slice(p * size, p * size + size), bar: pages > 1 ? '<div class="pager"><span>' + (p * size + 1) + ' to ' + Math.min(list.length, p * size + size) + ' of ' + list.length + '</span><button class="icon-btn sm" data-pg="' + key + '|-1"' + (p ? '' : ' disabled') + ' aria-label="Previous page">' + ic('chev-l') + '</button><button class="icon-btn sm" data-pg="' + key + '|1"' + (p < pages - 1 ? '' : ' disabled') + ' aria-label="Next page">' + ic('chev-r') + '</button></div>' : '' };
  }

  var VIEWS = { site: vSite, gate: vGate, webtext: vWeb, dgrnews: vDgr, social: vSocial, dashboard: vDashboard, bookings: vBookings, eft: vEft, calendar: vCalendar, clients: vClients, payments: vPayments, shop: vShop, drives: vDrives, products: vProducts, vouchers: vVouchers, indemnities: vIndemnities, enquiries: vEnquiries, stands: vStands, rates: vRates, reports: vReports, news: vNews, settings: vSettings };
  function route() { var v = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard'; if (v === 'guests') v = 'clients'; return VIEWS[v] && can(v) ? v : can('dashboard') ? 'dashboard' : ROLES[ME.role][0]; }

  /* ---------- shell ---------- */
  function badges() {
    return { gate: gateBadge(), eft: DB.bookings.filter(function (b) { return b.status === 'pending'; }).length, enquiries: DB.threads.filter(function (t) { return t.status === 'open'; }).length, products: shopItems().filter(lowStock).length, drives: DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && !b.drive && b.co >= TODAY && diff(TODAY, b.ci) <= 14; }).length, bookings: DB.bookings.filter(function (b) { return b.isNew; }).length };
  }
  function shell() {
    var bd = badges();
    app.innerHTML = '<aside class="side"><a class="brand" href="#/dashboard"><img src="../assets/img/logo-small.png" alt=""><span><b>Kyleu</b><small>Staff admin</small></span></a><nav>' +
      NAV.filter(function (n) { return can(n.id); }).map(function (n, i, arr) { return (n.g && (!i || arr[i - 1].g !== n.g) ? '<span class="nav-h">' + n.g + '</span>' : '') + '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.i) + '<span>' + n.t + '</span>' + (bd[n.id] ? '<em>' + bd[n.id] + '</em>' : '') + '</a>'; }).join('') +
      '</nav><div class="side-f"><a href="../index.html" target="_blank" rel="noopener">' + ic('ext') + 'View website</a><button data-act="logout">' + ic('out') + 'Sign out</button></div></aside><div class="scrim" data-act="menu"></div>' +
      '<div class="main"><header class="top"><button class="icon-btn menu-btn" data-act="menu" aria-label="Menu">' + ic('menu') + '</button>' + (can('cap:guests') ? '<label class="search top-search">' + ic('search') + '<input data-global placeholder="Find a booking: name, ref or phone" aria-label="Find a booking" aria-keyshortcuts="/ Control+K"><kbd class="kbd" title="Press / to search">/</kbd><div class="sugg" data-sugg hidden></div></label>' : '<span class="top-fill"></span>') +
      '<span class="demo-badge">Demo data</span><div class="me"><span class="avatar">' + ME.name[0] + '</span><span class="me-t"><b>' + ME.name + '</b><small>' + ME.role + '</small></span></div></header><main id="view" tabindex="-1"></main></div>' +
      '<nav class="bottom">' + (ME.role === 'Gate' ? ['gate', 'shop'] : ME.role === 'Worker' ? ['site'] : ['dashboard', 'bookings', 'eft', 'calendar']).filter(can).map(function (id) { var n = NAV.filter(function (x) { return x.id === id; })[0]; return '<a href="#/' + id + '" data-nav="' + id + '">' + ic(n.i) + '<span>' + (id === 'eft' ? 'EFT' : n.t) + '</span>' + (bd[id] ? '<em>' + bd[id] + '</em>' : '') + '</a>'; }).join('') + '<button data-act="menu">' + ic('menu') + '<span>More</span></button></nav>' +
      '<div id="drawer" hidden></div><div id="modal" hidden></div><div class="toasts" aria-live="polite"></div><div class="tip" hidden></div>';
  }
  function render() {
    var v = route(), el = $('#view'); if (!el) return;
    var bd = badges();
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === v); var em = $('em', a), n = bd[a.dataset.nav]; if (n) { if (!em) { em = document.createElement('em'); a.appendChild(em); } em.textContent = n; } else if (em) em.remove(); });
    closeRowMenu(); STG = {};   // each booking's steps are worked out once per draw (stageOf, indStat)
    try { el.innerHTML = VIEWS[v](); } finally { STG = null; }
    applyTables();
    if (v === 'reports') rpFill();
    document.title = NAV.filter(function (n) { return n.id === v; })[0].t + ' · Kyleu admin';
  }

  /* ---------- login ---------- */
  function login() {
    app.innerHTML = '<div class="login"><form class="login-card" novalidate><img src="../assets/img/logo.png" alt="Kyleu Bush Camp" width="120"><h1>Staff sign in</h1><p class="muted">For the Kyleu team only.</p>' +
      '<label class="fld"><span>Email</span><input name="email" type="email" autocomplete="username" placeholder="you@kyleu.co.za"></label><label class="fld"><span>Password</span><input name="pw" type="password" autocomplete="current-password"></label>' +
      '<button class="btn wide" type="submit">Sign in</button><div class="or"><span>Demo: sign in as</span></div><div class="quick">' + STAFF.map(function (s) { return '<button type="button" class="chip" data-as="' + s.id + '"><b>' + s.name + '</b> ' + s.role + '</button>'; }).join('') + '</div>' +
      '<p class="muted small">This is a mock-up with made-up bookings. The live version uses proper staff accounts with a second sign-in step (a code on your phone).</p><a class="small" href="../index.html">Back to the website</a></form></div>';
    var f = $('.login-card');
    f.addEventListener('submit', function (e) { e.preventDefault(); var em = fval(f, 'email').toLowerCase(), s = STAFF.filter(function (x) { return x.email === em; })[0]; if (!s) { toast('Use a kyleu.co.za staff email, or tap a name below'); return; } start(s); });
    $$('[data-as]', f).forEach(function (b) { b.addEventListener('click', function () { start(STAFF.filter(function (x) { return x.id === b.dataset.as; })[0]); }); });
  }
  function start(s) { ME = s; try { sessionStorage.setItem(SESS, s.id); } catch (e) {} shell(); render(); }

  /* ---------- events (one listener for everything) ---------- */
  function csv(name, rows) {
    var txt = rows.map(function (r) { return r.map(function (c) { c = String(c == null ? '' : c); return /[",\n]/.test(c) ? '"' + c.replace(/"/g, '""') + '"' : c; }).join(','); }).join('\r\n');
    var a = document.createElement('a'); a.href = URL.createObjectURL(new Blob(['﻿' + txt], { type: 'text/csv' })); a.download = name; a.click();
  }
  function onClick(e) {
    var t = e.target;
    if (!ME) return;
    if (!t.closest('[data-act="row-menu"]')) closeRowMenu();   // the small menu on a bookings row closes on any other click
    var go = t.closest('[data-go]'); if (go) {
      var itab = /^indemnities:(\w+)$/.exec(go.dataset.go); if (itab) { INDF.tab = itab[1]; if (route() === 'indemnities') render(); else location.hash = '#/indemnities'; return; }
      var tday = /^today:(\w+)$/.exec(go.dataset.go);
      if (tday) { DP.tab = tday[1]; DP[tday[1]] = 0; render(); var tc = $('#today'); if (tc) { tc.scrollIntoView({ behavior: 'smooth', block: 'center' }); tc.classList.remove('flash'); void tc.offsetWidth; tc.classList.add('flash'); } return; }
      location.hash = '#/' + go.dataset.go; return;
    }
    var op = t.closest('[data-open]'); if (op && !t.closest('[data-act]')) { e.preventDefault(); if (!$('#modal').hidden) closeModal(); openBooking(op.dataset.open); return; }
    var nav = t.closest('[data-nav]'); if (nav) { document.body.classList.remove('nav-open'); }
    var tab = t.closest('[data-tab]'); if (tab) { var card = tab.closest('.card'); $$('[data-tab]', card).forEach(function (x) { x.classList.toggle('on', x === tab); }); $$('[data-pane]', card).forEach(function (p) { p.hidden = p.dataset.pane !== tab.dataset.tab; }); return; }
    var fst = t.closest('[data-fst]'); if (fst) { F.st = fst.dataset.fst; render(); return; }
    var ftd = t.closest('[data-ftodo]'); if (ftd) { F.todo = F.todo === ftd.dataset.ftodo ? '' : ftd.dataset.ftodo; resetPages(); render(); return; }   // press the chosen one again to switch it off
    var fsl = t.closest('[data-fstale]'); if (fsl) { F.stale = F.stale ? '' : '1'; resetPages(); render(); return; }
    var cal = t.closest('[data-cal]'); if (cal) { var n = +cal.dataset.cal; CAL.start = n ? add(CAL.start, n) : add(TODAY, -2); render(); return; }
    var na = t.closest('[data-newat]'); if (na) { var p = na.dataset.newat.split('|'); actNew({ stand: p[0], ci: p[1], co: add(p[1], 2) }); return; }
    var gr = t.closest('[data-guest]'); if (gr) { openGuest(gr.dataset.guest); return; }
    var cpy = t.closest('[data-copy]'); if (cpy) { copyText(cpy.dataset.copy); return; }
    var po = t.closest('tr[data-post]'); if (po) { actPost(po.dataset.post); return; }
    var cr = t.closest('[data-client]'); if (cr && !t.closest('[data-clfind],[data-clform]')) { e.preventDefault(); openClient(cr.dataset.client); return; }
    var ne = t.closest('[data-note-edit]'); if (ne) { var np = ne.dataset.noteEdit.split('|'); actNote(np[0], +np[1]); return; }
    var nd = t.closest('[data-note-del]'); if (nd) { var nq = nd.dataset.noteDel.split('|'), nb = byRef(nq[0]), ni = +nq[1], nn = nb.notes[ni]; if (!nn) return; modal('Delete this note?', '<p class="callout">' + esc(nn.text) + '</p><p class="muted small">Written by ' + esc(nn.by) + ' · ' + esc(nn.at) + '</p>', 'Delete note', function () { nb.notes.splice(ni, 1); log('Note deleted on ' + nb.ref, nb.ref); save(); refresh(); toast('Note deleted'); }, { danger: true, noFocus: true }); return; }
    if (t.closest('[data-fst],[data-payt],[data-crst],[data-prodcat],[data-gtag],[data-box],[data-paytab],[data-shoptab],[data-pcat]')) resetPages();
    var sth = t.closest('th.sortable'); if (sth) { var stb = sth.closest('table'), sk = stb.dataset.sortKey, sci = +sth.dataset.sortCol, cur = SORT[sk]; SORT[sk] = !cur || cur.col !== sci ? { col: sci, dir: 1 } : cur.dir === 1 ? { col: sci, dir: -1 } : null; delete TPG[sk]; render(); var nth = $('table[data-sort-key="' + sk + '"] th[data-sort-col="' + sci + '"]'); if (nth) nth.focus({ preventScroll: true }); return; }
    var tpg = t.closest('[data-tpg]'); if (tpg) { var tp = tpg.dataset.tpg.split('|'), tk = tp[0] + '|' + tp[1]; TPG[tk] = (TPG[tk] || 0) + (+tp[2]); render(); var ttb = $('table[data-sort-key="' + tk + '"]'); if (ttb) { var top = (ttb.closest('.card') || ttb).getBoundingClientRect().top + window.scrollY - 80; if (top < window.scrollY) window.scrollTo({ top: top }); } return; }
    var dpg = t.closest('[data-pg]'); if (dpg) { var dp = dpg.dataset.pg.split('|'); DP[dp[0]] = Math.max(0, (DP[dp[0]] || 0) + (+dp[1])); render(); return; }
    var dtab = t.closest('[data-dtab]'); if (dtab) { DP.tab = dtab.dataset.dtab; render(); return; }
    var gtag = t.closest('[data-gtag]'); if (gtag) { GF.tag = gtag.dataset.gtag; render(); return; }
    var vpy = t.closest('[data-vpay]'); if (vpy) { VF.pay = vpy.dataset.vpay; render(); return; }
    var itb = t.closest('[data-indtab]'); if (itb) { INDF.tab = itb.dataset.indtab; render(); return; }
    var fcl = t.closest('[data-fclear]'); if (fcl) { var fc = fcl.dataset.fclear.split(':'); fc[1].split(',').forEach(function (k) { FO(fc[0])[k] = ''; }); resetPages(); render(); return; }
    var th = t.closest('[data-thread]'); if (th) { IN.id = th.dataset.thread || null; CMP_ATT = []; var tt = IN.id && thrById(IN.id); if (tt && tt.unread) { tt.unread = false; save(); } render(); window.scrollTo(0, 0); return; }
    var tg = t.closest('[data-thread-go]'); if (tg) { IN.id = tg.dataset.threadGo; IN.box = 'all'; closeDrawer(); if (!$('#modal').hidden) closeModal(); location.hash = '#/enquiries'; render(); return; }
    var bx = t.closest('[data-box]'); if (bx) { IN.box = bx.dataset.box; IN.id = null; render(); return; }
    var at_ = t.closest('[data-att]'); if (at_) { viewAtt(at_.dataset.att); return; }
    var cd = t.closest('[data-cmp-del]'); if (cd) { CMP_ATT.splice(+cd.dataset.cmpDel, 1); cmpRefresh(); return; }
    var sa = t.closest('[data-sale]'); if (sa) { openSale(sa.dataset.sale); return; }
    var pr = t.closest('[data-prod]'); if (pr) { actProduct(pr.dataset.prod); return; }
    var pt = t.closest('[data-paytab]'); if (pt) { if (PAYF.tab !== pt.dataset.paytab) PAYF.q = ''; PAYF.tab = pt.dataset.paytab; render(); return; }
    var crs = t.closest('[data-crst]'); if (crs) { PAYF.cst = crs.dataset.crst; render(); return; }
    var py = t.closest('[data-payt]'); if (py) { PAYF.type = py.dataset.payt; PAYF.lim = 1e9; render(); return; }
    var stb = t.closest('[data-shoptab]'); if (stb) { SHOP.tab = stb.dataset.shoptab; render(); window.scrollTo(0, 0); return; }
    var pcat = t.closest('[data-pcat]'); if (pcat) { SHOP.cat = pcat.dataset.pcat; render(); return; }
    var prc = t.closest('[data-prodcat]'); if (prc) { PROD.cat = prc.dataset.prodcat; render(); return; }
    var wtb = t.closest('[data-webtab]'); if (wtb) { WTX.tab = wtb.dataset.webtab; WTX.q = ''; render(); window.scrollTo(0, 0); return; }
    var wrs = t.closest('[data-wt-reset]'); if (wrs) { var wrx = webFind(wrs.dataset.wtReset); delete webDB().text[wrs.dataset.wtReset]; log('Website wording put back to the original' + (wrx ? ': "' + wrx.def.slice(0, 60) + '"' : '')); save(); var wry = window.scrollY; render(); window.scrollTo(0, wry); toast('Back to the original wording'); return; }
    var gtb = t.closest('[data-gatetab]'); if (gtb) { GATE.tab = gtb.dataset.gatetab; GATE.show = 'todo'; resetPages(); render(); window.scrollTo(0, 0); return; }
    var gdy = t.closest('[data-gateday]'); if (gdy) { var gv = gdy.dataset.gateday; GATE.day = /^-?\d$/.test(gv) ? add(GATE.day || TODAY, +gv) : gv; render(); return; }
    var gar = t.closest('[data-gatearea]'); if (gar) { GATE.area = gar.dataset.gatearea; GATE.stand = ''; render(); return; }
    var gsh = t.closest('[data-gateshow]'); if (gsh) { GATE.show = gsh.dataset.gateshow; render(); return; }
    var gjs = t.closest('[data-gatejshow]'); if (gjs) { GATE.jshow = gjs.dataset.gatejshow; render(); return; }
    var grg = t.closest('[data-gaterange]'); if (grg) { var gp = grg.dataset.gaterange.split('|'); GATE.rfrom = gp[0]; GATE.rto = gp[1]; resetPages(); render(); return; }
    var rtb = t.closest('[data-ratetab]'); if (rtb) { var sb = $('[data-savebar]'); if (sb && !sb.hidden) { toast('Save or discard your changes first'); return; } RT.tab = rtb.dataset.ratetab; render(); return; }
    var hd = t.closest('[data-hol-del]'); if (hd) { var hdd = hd.dataset.holDel; if (DB.hol.add[hdd]) delete DB.hol.add[hdd]; else DB.hol.del[hdd] = 1; delete P.holidays[hdd]; log('Removed holiday ' + hdd); save(); render(); toast('Date removed'); return; }
    var se = t.closest('[data-set]'); if (se) { SET = se.dataset.set; render(); return; }
    var dis = t.closest('[data-dismiss]'); if (dis) { DB.dismissed = DB.dismissed || {}; DB.dismissed[dis.dataset.dismiss] = TODAY; save(); render(); toast('Hidden. It comes back if anything changes.'); return; }
    var wsb = t.closest('[data-wstep]'); if (wsb && drawerRef) { var wsp = wsb.dataset.wstep.split('|'); WSEL[wsp[0]] = wsp[1]; refresh(); return; }
    var ptb = t.closest('[data-ptab]'); if (ptb && drawerRef) {
      PTAB = ptb.dataset.ptab; var pp = $('#drawer .d-panel'); refresh();
      var tb = pp && $('.d-tabs', pp); if (pp && tb && pp.scrollTop > tb.offsetTop - 56) pp.scrollTop = tb.offsetTop - 56; return;
    }
    if (!t.closest('.d-more')) $$('.d-more[open]').forEach(function (d) { d.open = false; });
    if (t.closest('.d-menu button')) { var dm = t.closest('.d-more'); if (dm) dm.open = false; }
    var ad = t.closest('[data-add]'); if (ad) { var ap = prodBy(ad.dataset.add); if (ap && ap.stock != null && (CART[ap.id] || 0) >= ap.stock) { toast('Only ' + ap.stock + ' in stock'); return; } CART[ad.dataset.add] = (CART[ad.dataset.add] || 0) + 1; render(); return; }
    var rm = t.closest('[data-rem]'); if (rm) { CART[rm.dataset.rem]--; if (CART[rm.dataset.rem] <= 0) delete CART[rm.dataset.rem]; render(); return; }
    var sl = t.closest('[data-sell]'); if (sl) { sell(sl.dataset.sell); return; }
    var rt = t.closest('[data-rp-tab]'); if (rt) { RP.tab = rt.dataset.rpTab; rpSave(); rpInstant = true; render(); return; }
    var pd = t.closest('[data-ph-del]'); if (pd) { EDIT.photos.splice(+pd.dataset.phDel, 1); phRefresh(); return; }
    var pc = t.closest('[data-ph-cover]'); if (pc) { var ph = EDIT.photos.splice(+pc.dataset.phCover, 1)[0]; EDIT.photos.unshift(ph); phRefresh(); return; }
    var pk = t.closest('[data-ph-pick]'); if (pk) { var pi = EDIT.photos.indexOf(pk.dataset.phPick); if (pi >= 0) EDIT.photos.splice(pi, 1); else EDIT.photos.push(pk.dataset.phPick); phRefresh(); return; }
    var ub = t.closest('[data-unblock]'); if (ub) { DB.blocks = DB.blocks.filter(function (k) { return k.id !== ub.dataset.unblock; }); save(); render(); toast('Block removed'); return; }
    var a = t.closest('[data-act]'); if (!a) return;
    var act = a.dataset.act, ref = a.dataset.ref;
    if (act === 'menu') { document.body.classList.toggle('nav-open'); return; }
    if (act === 'logout') { try { sessionStorage.removeItem(SESS); } catch (x) {} ME = null; F.q = ''; F.area = ''; F.stand = ''; F.src = ''; F.m = ''; F.from = ''; F.to = ''; F.todo = ''; F.stale = ''; location.hash = ''; login(); return; }
    if (act === 'new') return actNew();
    if (act === 'client-add') return actClient(null);
    if (act === 'news-new') return actPost(null);
    if (act === 'dgr') return openBooking(ref);
    if (act === 'inv-new') return actInvNew(ref);
    if (act === 'dgr-new') return actDgr(null);
    if (act === 'dgr-edit') return actDgr(ref);
    if (act === 'soc-add') return actSocPost(null);
    if (act === 'sig-copy' || act === 'sig-html' || act === 'sig-code') {
      var sgd = sigData(SIG_WHO || ME.id), html = sigHTML(sgd);
      if (act === 'sig-code') { downloadFile(new Blob(['<!doctype html><html><head><meta charset="utf-8"><title>Email signature ' + esc(sgd.name) + '</title></head><body>' + html + '</body></html>'], { type: 'text/html' }), 'Kyleu signature ' + sgd.name + '.htm'); toast('Downloaded. Open it, select everything (Ctrl+A), copy, and paste into Outlook.'); return; }
      var plain = sigText(sgd);
      var done_ = function (ok) { toast(ok ? (act === 'sig-copy' ? 'Signature copied. Paste it into Gmail or Outlook.' : 'HTML code copied') : 'Could not copy. Select the preview and copy it by hand.'); };
      // older way, works in more browsers: select the preview (or the code) and copy it
      var bySelect = function () {
        try {
          var sel = getSelection(), r = document.createRange(), tmp = null;
          if (act === 'sig-copy') r.selectNode($('[data-sig-prev]'));
          else { tmp = document.createElement('textarea'); tmp.value = html; tmp.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(tmp); tmp.select(); }
          if (!tmp) { sel.removeAllRanges(); sel.addRange(r); }
          var ok = document.execCommand('copy'); sel.removeAllRanges(); if (tmp) tmp.remove(); done_(ok);
        } catch (e) { done_(false); }
      };
      try {
        var settled = false, ok_ = function () { settled = true; done_(true); }, no_ = function () { if (!settled) { settled = true; bySelect(); } };
        setTimeout(no_, 1500);   // some browsers never answer: fall back to the older way
        if (act === 'sig-copy' && window.ClipboardItem && navigator.clipboard) navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([html], { type: 'text/html' }), 'text/plain': new Blob([plain], { type: 'text/plain' }) })]).then(ok_, no_);
        else if (act === 'sig-html' && navigator.clipboard) navigator.clipboard.writeText(html).then(ok_, no_);
        else no_();
      } catch (e) { bySelect(); }
      return;
    }
    if (act === 'soc-edit') return actSocPost(ref);
    if (/^soc-(show|up|down|del)$/.test(act)) {
      var so = socDB(), sx = so.posts.filter(function (x) { return x.id === ref; })[0], si = so.posts.indexOf(sx); if (!sx) return;
      if (act === 'soc-show') { sx.show = !sx.show; toast(sx.show ? 'Shown on the website' : 'Hidden from the website'); }
      if (act === 'soc-up' && si > 0) { so.posts.splice(si, 1); so.posts.splice(si - 1, 0, sx); }
      if (act === 'soc-down' && si < so.posts.length - 1) { so.posts.splice(si, 1); so.posts.splice(si + 1, 0, sx); }
      if (act === 'soc-del') { closeModal(); modal('Remove this post?', '<p>' + esc(sx.title) + ' is taken off the website. The post itself stays on ' + SOC_KIND[socKind(sx.url)].split(' ')[0] + '.</p>', 'Remove', function () { so.gone = so.gone || []; so.gone.push(sx.url); if (sx.imgKey) K.files.del(sx.imgKey); so.posts.splice(so.posts.indexOf(sx), 1); log('Removed social post: ' + sx.title); socSave(); render(); toast('Post removed'); }, { danger: true }); return; }
      socSave(); render(); return;
    }
    if (act === 'soc-md') {
      var sm = socDB(), md = '## Links\n- Facebook: ' + sm.facebook + '\n- Instagram: ' + sm.instagram + '\n- TikTok: ' + sm.tiktok + '\n- Hashtag: ' + sm.hashtag + '\n- Instagram feed ID: ' + sm.igFeed + '\n- Instagram photos: ' + sm.igCount + '\n- Facebook feed: ' + (sm.fbFeed ? 'on' : 'off') + '\n\n## Guest stories\n' + sm.posts.filter(function (x) { return x.show; }).map(function (x) { return '- ' + String(x.title).replace(/:/g, ',') + ': ' + x.url + (x.by || x.out ? ' · ' + (x.by || 'YouTube') : '') + (x.out ? ' · opens on YouTube' : '') + (x.img ? ' · image ' + x.img : ''); }).join('\n');
      modal('Text for content/settings.md', '<p class="muted small">Replace these two parts of content/settings.md with this text to publish the social media settings for every visitor.</p><textarea rows="14" readonly style="width:100%;font-family:monospace;font-size:.82rem">' + esc(md) + '</textarea>', null, null, { wide: true });
      return;
    }
    if (act === 'link-copy') { var lb = byRef(ref), lk = bookingLink(lb); try { navigator.clipboard.writeText(lk).then(function () { toast('Link copied'); }, function () { prompt('Copy the link', lk); }); } catch (e) { prompt('Copy the link', lk); } return; }
    if (act === 'fin-mark') { var fb = byRef(ref); fb.finalised = { at: nowStamp(), by: ME.name }; fb.notes.push({ at: nowStamp(), by: ME.name, text: 'Booking finalised by staff.' }); log('Booking ' + fb.ref + ' finalised', fb.ref); save(); refresh(); toast('Marked as finalised'); return; }
    if (act === 'inv-cur') { var cb = byRef(ref), ci_ = curDoc(cb); CUR_INV[cb.ref + '|' + K.docKey(ci_)] = ci_; return invView(cb, ci_); }
    if (act === 'inv-view' || act === 'inv-dl' || act === 'inv-send') {
      var ip = ref.split('|'), ib = byRef(ip[0]), iv = invGet(ib, ip[1]); if (!iv) { toast('Invoice not found'); return; }
      if (act === 'inv-view') return invView(ib, iv);
      if (act === 'inv-send') { closeModal(); return sendInvoice(ib, iv); }
      var mk = K.invoicePDF(iv); if (mk) downloadFile(mk.blob, mk.name); else toast('The PDF maker did not load. Check the internet connection.'); return;
    }
    if (act === 'claim-no') { var nb = byRef(ref); nb.notes.push({ at: nowStamp(), by: ME.name, text: 'Checked the bank: the ' + money(nb.paidClaim.amt) + ' the guest told us about is not in yet.' }); nb.paidClaim = null; if (nb.status !== 'pending' || !(nb.pops || []).length) nb.pop = false; log('Payment not in the bank yet for ' + nb.ref, nb.ref); save(); refresh(); toast('Noted. Use Send a message to let ' + esc(nb.guest.first) + ' know.'); return; }
    if (act === 'veh-add') return actVehAdd(ref);
    if (act === 'thanks') return thanksStep(ref);
    if (act === 'veh-ok') { var vb = byRef(ref); vehSaid(vb); log('Number of vehicles confirmed on ' + vb.ref, vb.ref); save(); refresh(); toast('Marked as confirmed'); return; }
    if (act === 'size-ok') { var szb = byRef(ref), szc = szb && szb.sizeCheck; if (!szc) return; szc.done = { at: nowStamp(), by: ME.name }; szb.notes.push({ at: nowStamp(), by: ME.name, text: 'Agreed to ' + szc.people + ' people on a stand that usually takes ' + szc.usual + '.' }); log('Agreed to ' + szc.people + ' people on ' + standById(szb.stand).name + ' (usually ' + szc.usual + ')', szb.ref); save(); refresh(); toast('Noted: ' + szc.people + ' people on ' + esc(standById(szb.stand).name) + ' is fine'); return; }
    if (act === 'cancel-keep') { var ckb = byRef(ref); if (!ckb || !ckb.cancelReq) return; ckb.cancelReq.done = { at: nowStamp(), by: ME.name, kept: true }; ckb.notes.push({ at: nowStamp(), by: ME.name, text: 'Cancellation request from the website: the booking is kept.' }); log('Cancellation request on ' + ckb.ref + ': the booking is kept', ckb.ref); save(); refresh(); toast('Booking kept. Use Send a message to let ' + esc(ckb.guest.first) + ' know.'); return; }
    if (act === 'req-done') { var rb = byRef(ref); rb.changeReq.done = { at: nowStamp(), by: ME.name }; rb.notes.push({ at: nowStamp(), by: ME.name, text: 'Change request from the website dealt with.' }); log('Change request on ' + rb.ref + ' dealt with', rb.ref); save(); refresh(); toast('Change request marked as dealt with'); return; }
    if (act === 'send-doc') { var sd = ref.split('|'); return sendTemplate(byRef(sd[0]), sd[1]); }
    if (act === 'dgr-send') { var so = carOf(ref); if (so.c) sendCodes(so.b, [so.c]); return; }
    if (act === 'dgr-send-all') { var sa = byRef(ref); sendCodes(sa, ensureCars(sa)); return; }
    if (act === 'dgr-send-sel') { var ss = byRef(ref); sendCodes(ss, $$('[data-dgr-tick]').filter(function (x) { return x.checked && x.dataset.dgrTick.indexOf(ref + '|') === 0; }).map(function (x) { return carOf(x.dataset.dgrTick).c; }).filter(Boolean)); return; }
    if (act === 'car-in') return actCarIn(ref);
    if (act === 'car-out') return actCarOut(ref);
    if (act === 'car-edit') return actCarEdit(ref);
    if (act === 'car-add') { var ab = byRef(ref); if (!vehKnown(ab)) return actVehAdd(ref); ensureCars(ab).push(newCar()); ab.vehicles = ab.cars.length; vehSaid(ab); log('Vehicle added to ' + ab.ref, ab.ref); save(); refresh(); toast('Vehicle added. Check it in when it arrives'); return; }
    if (act === 'car-del') { var dc = carOf(ref); if (!dc.c) return; dc.b.cars.splice(dc.i, 1); dc.b.vehicles = dc.b.cars.length; save(); refresh(); toast('Vehicle removed'); return; }
    if (act === 'car-tab') { SHOP.who = ref; SHOP.tab = 'till'; closeDrawer(); location.hash = '#/shop'; render(); return; }
    if (act === 'ind-print') { var ip = (ref || '').split('|'); printIndemnity(ip[0], ip[1]); return; }
    if (act === 'ind-sign') { actIndSign(ref); return; }
    if (act === 'ind-sign-car') { var oc = carOf(ref); if (oc.c) { var mf = $('#modal form'); if (mf && oc.c.st === 'due') readCar(mf, oc.c); actIndSign(oc.b.ref, function () { if (oc.c.st === 'due') actCarIn(ref); else actCarEdit(ref); }); } return; }
    if (act === 'ind-view') { actIndView(ref); return; }
    if (act === 'scan-many') { actScanMany(ref); return; }
    if (act === 'paper-print') { paperPrint(); return; }
    if (act === 'ind-pdf') { var r1 = indRec(ref); if (r1 && isPaper(r1)) { actPaperView(ref); return; } if (r1) K.ind.pdf([r1]).catch(function () { toast('The PDF could not be made. Check the internet connection.'); }); return; }
    if (act === 'ind-pdf-ref') { var rr = K.ind.forRef(ref).filter(function (r) { return !isPaper(r); }); if (rr.length) K.ind.pdf(rr, { name: 'Kyleu indemnities ' + ref + '.pdf' }).catch(function () { toast('The PDF could not be made. Check the internet connection.'); }); return; }
    if (act === 'ind-pdf-all') { var raAll = indFiltered(), ra = raAll.filter(function (r) { return !isPaper(r); }), rp = raAll.filter(isPaper), rpS = rp.filter(function (r) { return r.scan; }).length; if (!ra.length) { toast(rp.length ? 'Only paper forms match these filters. Their scans are opened one by one, or print the list under Paper forms to upload' : 'No signed forms with these filters'); return; } toast('Making the PDF of ' + ra.length + ' form' + (ra.length === 1 ? '' : 's') + '…'); K.ind.pdf(ra, { register: true, filters: [indFilterText(), rp.length ? 'not in this file: ' + rp.length + ' paper form' + (rp.length === 1 ? '' : 's') + ' (' + rpS + ' with the scan on file, ' + (rp.length - rpS) + ' still to upload)' : ''].filter(Boolean).join(', ') }).catch(function () { toast('The PDF could not be made. Check the internet connection.'); }); return; }
    if (act === 'ind-csv') { var rc = indFiltered(); if (!rc.length) { toast('No signed forms with these filters'); return; } K.ind.csv(rc.map(function (r) { return isPaper(r) ? Object.assign({}, r, { by: (r.by || 'staff') + ', on the paper form, ' + scanTxt(r) }) : r; })); return; }
    if (act === 'ind-link') { var lb = byRef(ref), lu = signLink(lb); (navigator.clipboard ? navigator.clipboard.writeText(lu) : Promise.reject()).then(function () { toast('Signing link copied'); }).catch(function () { window.prompt('Copy the signing link', lu); }); return; }
    if (act === 'client-edit') return actClient(ref);
    if (act === 'client-book') { closeModal(); return actNew({ cid: ref }); }
    if (act === 'client-mail') { var mc = clientById(ref); closeModal(); actNewMail(); var mf = $('#modal form'); if (mf && mc) mf.elements.to.value = mc.email; return; }
    if (act === 'pay') return actPay(ref);
    if (act === 'gate-job') { var gj = String(ref || '').split('|'); return actJob(gj[0], gj[1]); }
    if (act === 'job-edit') return actJob('', '', ref);
    if (act === 'gate-note') { var gnb = byRef(ref); if (!gnb) return; modal('Note for the gate', '<p class="muted small">' + esc(guestName(gnb)) + ' · ' + esc(standById(gnb.stand).name) + '. Shown on the check-in sheet and printed in the Notes column.</p><label class="fld"><span>Note</span><textarea name="note" rows="3" placeholder="e.g. Extra guests coming on Saturday. 4 wood and 1 sticker already paid.">' + esc(gnb.gateNote || '') + '</textarea></label>', 'Save', function (f) { gnb.gateNote = fval(f, 'note'); log('Gate note ' + (gnb.gateNote ? 'saved' : 'cleared') + ' for ' + guestName(gnb), gnb.ref); save(); render(); toast('Saved'); }); return; }
    if (act === 'job-done') {
      var jd = jobsDB().filter(function (x) { return x.id === ref; })[0]; if (!jd) return;
      if (jd.done) { jd.done = null; siteLog(jd.stand, 'Reopened: ' + jd.text.slice(0, 120)); save(); render(); toast('Back on the list'); return; }
      modal(jd.kind === 'repair' ? 'Mark as fixed' : 'Mark as done', '<p><b>' + esc(jobStand(jd).name) + ':</b> ' + esc(jd.text) + '</p><label class="fld"><span>What did you do? (optional, but it helps the next person)</span><textarea name="note" rows="2" placeholder="e.g. Replaced the float valve in the cistern."></textarea></label>',
        jd.kind === 'repair' ? 'Yes, it is fixed' : 'Yes, it is done', function (f) {
          var nt = fval(f, 'note'); jd.done = { at: nowStamp(), by: ME.name, note: nt };
          siteLog(jd.stand, (jd.kind === 'repair' ? 'Fixed: ' : 'Done: ') + jd.text.slice(0, 100) + (nt ? ' (' + nt.slice(0, 100) + ')' : '')); save(); render(); toast('Marked as done');
        }, { noFocus: true });
      return;
    }
    if (act === 'site-done') {
      DB.siteDone = DB.siteDone || {}; var sdp = String(ref).split('|'), sdw = sdp[2] === 'wood' ? 'Free bag of wood delivered' : 'Stand cleaned', sdd = sdp[0] === TODAY ? '' : ' (for ' + fdw(sdp[0]) + ')';
      if (DB.siteDone[ref]) { delete DB.siteDone[ref]; siteLog(sdp[1], 'Unticked: ' + sdw.toLowerCase() + sdd); } else { DB.siteDone[ref] = { at: nowStamp(), by: ME.name }; siteLog(sdp[1], sdw + sdd); }
      save(); render(); return;
    }
    if (act === 'drop-done') {
      var dp = String(ref).split('|'), db2 = byRef(dp[0]), dd = db2 && drops(db2).filter(function (x) { return x.id === dp[1]; })[0]; if (!dd) return;
      dd.done = dd.done ? null : { at: nowStamp(), by: ME.name };
      siteLog(db2.stand, (dd.done ? 'Delivered: ' : 'Unticked delivery: ') + itemsTxt(dd.items)); save(); render(); toast(dd.done ? 'Marked as delivered' : 'Back on the list'); return;
    }
    if (act === 'stand-note') return actStandNote(ref || '');
    if (act === 'stand-note-del') {
      var sn = notesDB().filter(function (x) { return x.id === ref; })[0]; if (!sn) return;
      if (sn.by !== ME.name && ME.role !== 'Owner' && ME.role !== 'Manager') { toast('Only the person who wrote it, or a manager, can remove a note'); return; }
      notesDB().splice(notesDB().indexOf(sn), 1); siteLog(sn.stand, 'Note removed: ' + sn.text.slice(0, 80)); save(); render(); toast('Note removed'); return;
    }
    if (act === 'site-log-csv') { csv('kyleu-site-work-log.csv', [['Date', 'Time', 'Who', 'Role', 'Stand', 'What']].concat((DB.siteLog || []).map(function (l) { return [l.at.slice(0, 10), l.at.slice(11, 16), l.by, l.role || '', l.stand === 'camp' ? 'Camp' : standById(l.stand).name, l.text]; }))); return; }
    if (act === 'gate-print') return gatePrint(ref);
    if (act === 'gate-csv') return gateCsv();
    if (act === 'gate-paper') { var gpp = String(ref).split('|'); return actPaper(gpp[0], gpp[1]); }
    if (act === 'on-arrival') return actOnArrival(ref);
    if (act === 'on-arrival-off') { var ob = byRef(ref); if (!ob || !ob.onArrival) return; ob.onArrival = null; var oKeep = false; if (!paid(ob)) { ob.status = 'pending'; if (!ob.noRelease && holdOf(ob).state === 'released') { ob.noRelease = true; oKeep = true; } }
      ob.notes.push({ at: nowStamp(), by: ME.name, text: '"Pays on arrival" was undone. ' + (oKeep ? 'The quotation date has already passed, so the stand is kept for now: switch Keep the stand off to release it.' : ob.noRelease && ob.status === 'pending' ? 'The stand is still kept for the guest.' : 'The normal deposit rules apply again.') }); log('Undid pay on arrival for ' + guestName(ob), ob.ref); save(); refresh(); toast(oKeep ? 'Undone. The stand is kept for now, because the quotation date has passed' : 'Back to the normal deposit rules'); return; }
    if (act === 'pay-del') { var pdp = ref.split('|'), pb = byRef(pdp[0]), pi = +pdp[1], pp0 = pb && pb.payments[pi]; if (!pp0) return;
      return modal('Remove this payment?', '<p><b>' + money(pp0.amt) + ' ' + esc(pp0.type) + '</b> (' + methodLabel(pp0.m) + ', ' + fd(pp0.d) + ') comes off ' + esc(guestName(pb)) + '\'s booking. Only do this for a payment entered by mistake. It is noted on the booking.</p><label class="fld"><span>Why (optional)</span><input name="why" placeholder="e.g. Typed R5 000 instead of R500"></label>', 'Remove payment', function (f) {
        pb.payments.splice(pi, 1); var why = fval(f, 'why');
        var pcr = pp0.m === 'credit' ? creditById(pp0.credit) : null; if (pcr) pcr.used = Math.max(0, pcr.used - pp0.amt);   // paid with a credit: the credit gets it back
        pb.notes.push({ at: nowStamp(), by: ME.name, text: 'Removed a payment of ' + money(pp0.amt) + ' (' + pp0.type + ', ' + fd(pp0.d) + ')' + (why ? ': ' + why : '') + '.' + (pcr ? ' Credit ' + pcr.code + ' has the ' + money(pp0.amt) + ' back.' : '') });
        if (pb.status === 'confirmed' && paid(pb) === 0 && !pb.onArrival) pb.status = 'pending';   // pays on arrival stays confirmed without a payment
        log('Payment of ' + money(pp0.amt) + ' removed from ' + pb.ref, pb.ref); save(); refresh(); toast('Payment removed');
      }, { danger: true });
    }
    if (act === 'remind') return a.dataset.kind ? sendTemplate(byRef(ref), nudgeTpl(byRef(ref), a.dataset.kind)) : actRemind(ref);   // data-kind="pay": straight to the payment reminder
    if (act === 'row-menu') return rowMenu(a, ref);
    if (act === 'row-copy') { var rcb = byRef(ref); if (rcb) copyText(bookingLink(rcb), (stageOf(rcb).fin ? 'Booking link' : 'Finalise link') + ' for ' + esc(rcb.guest.first) + ' copied. Paste it in a message.'); return; }
    if (act === 'row-dgr') {   // codes typed in and not sent yet: the send box. No codes yet: the booking's Vehicles tab, where they are pasted
      var rdb = byRef(ref), rdc = rdb ? ensureCars(rdb).filter(function (c) { return c.dgr && !c.dgrSent; }) : []; if (!rdb) return;
      if (rdc.length) return sendCodes(rdb, rdc);
      openBooking(ref); PTAB = 'vehicles'; refresh(); toast('Make the codes on the Dinokeng site and paste them here, then send'); return;
    }
    if (act === 'cancel') return actCancel(ref);
    if (act === 'release') return actCancel(ref);
    if (act === 'credit-new') return actCreditNew();
    if (act === 'credit-edit') return actCreditEdit(ref);
    if (act === 'credit-void') return actCreditVoid(ref);
    if (act === 'credit-mail') return actCreditMail(ref);
    if (act === 'move' || act === 'edit') return actEdit(ref);
    if (act === 'block') return actBlock();
    if (act === 'stand-add') return actStand(null, null);
    if (act === 'stand-edit') return actStand(ref);
    if (act === 'stand-copy') return actStand(null, ref);
    if (act === 'stand-del') return actRemoveStand(ref);
    if (act === 'prod-add') return actProduct(null);
    if (act === 'prod-dup') { closeModal(); return actProduct(null, ref); }
    if (act === 'prod-del') { closeModal(); return actRemoveProduct(ref); }
    if (act === 'cart-clear') { CART = {}; render(); return; }
    if (act === 'to-sale') { var ps = $('.pos-sale'); if (ps) window.scrollTo({ top: ps.getBoundingClientRect().top + window.scrollY - 70, behavior: 'smooth' }); return; }
    if (act === 'mail-new') return actNewMail();
    if (act === 'th-close' || act === 'th-open') { var tc = thrById(ref); tc.status = act === 'th-close' ? 'closed' : 'open'; tc.unread = false; save(); render(); toast(act === 'th-close' ? 'Marked as done' : 'Reopened'); return; }
    if (act === 'att-pop') { var ka = ref.split(':'), ta = thrById(ka[1]), aa = attFrom(ref), ba = byRef(ta.ref); ba.pops = ba.pops || []; ba.pops.push({ name: aa.name, size: aa.size, type: aa.type, data: aa.data || '', at: ta.msgs[+ka[2]].at, via: 'Email' }); if (ba.status === 'pending') ba.pop = true; aa.linked = true; log('Proof of payment from email added to ' + ba.ref, ba.ref); save(); render(); toast('Added to ' + ba.ref + '. Check the bank, then confirm it under EFT payments.'); return; }
    if (act === 'pay-more') { PAYF.lim += 200; render(); return; }
    if (act === 'drive-add') return actDrive(null);
    if (act === 'drive-set') return actDrive(ref);
    if (act === 'drive-del') { var bd2 = byRef(ref), was = drivePrice(bd2.extras.gd); bd2.extras.gd = 0; bd2.drive = null; bd2.eft -= was; bd2.card -= toCard(was); bd2.total = bd2.method === 'card' ? bd2.card : bd2.eft; log('Cancelled the game drive for ' + guestName(bd2), bd2.ref); save(); closeModal(); refresh(); toast('Game drive cancelled. ' + money(was) + ' taken off the booking.'); return; }
    if (act === 'rates-discard') { render(); return; }
    if (act === 'csv-sales') { var rgs = simpleRange(SHOP.range); csv('kyleu-shop-sales-' + rgs[0] + '-to-' + rgs[1] + '.csv', [['Date', 'Time', 'Item', 'Qty', 'Paid by', 'Amount', 'Stand', 'Booking', 'Staff']].concat(DB.sales.filter(function (x) { return x.d >= rgs[0] && x.d <= rgs[1]; }).map(function (x) { return [x.d, x.t, x.item, x.qty, saleMethod(x.m), x.amt, x.stand, x.ref, x.by]; }))); return; }
    if (act === 'csv-report') { var rr = rpRange(RP.range); csv('kyleu-report-' + RP.tab + '-' + rr.from + '-to-' + rr.to + '.csv', [['Figure', rpRangeText(rr.from, rr.to), 'Period before: ' + rpRangeText(rr.pf, rr.pt)]].concat(RP_FIG)); return; }
    if (act === 'checkin' || act === 'checkout') { var cb = byRef(ref), ccs = ensureCars(cb), nx = ccs.filter(function (c) { return c.st === (act === 'checkin' ? 'due' : 'in'); })[0]; if (!nx) return; return act === 'checkin' ? actCarIn(cb.ref + '|' + nx.id) : actCarOut(cb.ref + '|' + nx.id); }
    if (act === 'csv-bookings') { csv('kyleu-bookings.csv', [['Ref', 'Created', 'Source', 'Guest', 'Email', 'Phone', 'Stand', 'Area', 'Arrive', 'Depart', 'Nights', 'Adults', 'Pensioners', 'Kids', 'Pays by', 'EFT price', 'Card price', 'Total', 'Paid', 'Balance', 'Status']].concat(DB.bookings.map(function (b) { var st = standById(b.stand); return [b.ref, b.created, b.source, guestName(b), b.guest.email, b.guest.phone, st.name, AREA_SHORT[st.area], b.ci, b.co, diff(b.ci, b.co), b.adults, b.pens, b.kids, methodLabel(b.method), b.eft, b.card, b.total, paid(b), balance(b), stateOf(b).t]; }))); return; }
    if (act === 'csv-guests') { csv('kyleu-mailing-list.csv', [['Name', 'Email', 'Phone', 'Stays', 'Last visit']].concat(guestsList().filter(function (g) { return g.consent; }).map(function (g) { return [g.name, g.email, g.phone, g.stays, g.last]; }))); toast('Only guests who agreed to receive news are exported'); return; }
    if (act === 'csv-pay') { var rgp = simpleRange(PAYF.range); csv('kyleu-payments-' + rgp[0] + '-to-' + rgp[1] + '.csv', [['Date', 'Time', 'Type', 'From', 'For', 'Method', 'Amount', 'Card fee part']].concat(allTx().filter(function (p) { return p.d >= rgp[0] && p.d <= rgp[1]; }).map(function (p) { return [p.d, p.t, p.type, p.who, p.what, methodLabel(p.m), p.amt, p.fee]; }))); return; }
    if (act === 'save-rates') {
      $$('[data-rate]').forEach(function (inp) { var v = parseFloat(inp.value.replace(/[^\d.]/g, '')); if (!isNaN(v)) { var k = inp.dataset.rate.split('|'); var orig = P.num(k[0], k[1], null); if (orig !== v) DB.rates[k[0] + '|' + k[1]] = v; else delete DB.rates[k[0] + '|' + k[1]]; } });
      var wr = webDB().rateText;
      $$('[data-rw]').forEach(function (inp) { var k2 = inp.dataset.rw, f2 = inp.dataset.rwf, v2 = inp.value.trim(), o2 = wr[k2] || {}; if (v2 === inp.dataset.def || (f2 === 'name' && !v2)) delete o2[f2]; else o2[f2] = v2; if (Object.keys(o2).length) wr[k2] = o2; else delete wr[k2]; });
      log('Prices updated'); save(); render(); toast('Saved. The website shows it now.'); return;
    }
    if (act === 'enq-book') { var q = thrById(ref), nm = q.name.split(' '); actNew({ first: nm[0], last: nm.slice(1).join(' '), email: q.email, phone: q.phone }); return; }
    if (act === 'invite') { modal('Invite a staff member', '<label class="fld"><span>Name</span><input name="n"></label><label class="fld"><span>Email</span><input name="e" type="email"></label><label class="fld"><span>Role</span><select name="r">' + Object.keys(ROLES).map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>', 'Send invite', function () { toast('Invite sent (demo)'); }); return; }
    if (act === 'connect') { modal('Connect ' + esc(ref), '<p>In the live version you would sign in to your ' + esc(ref) + ' account here. Guests then pay on ' + esc(ref) + '\'s secure page and the booking is confirmed by itself the moment the payment goes through.</p><p class="muted small">Card numbers never touch the Kyleu website.</p>', null); return; }
    if (act === 'export-json') { var bl = document.createElement('a'); bl.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' })); bl.download = 'kyleu-admin-backup.json'; bl.click(); return; }
    if (act === 'reset') { modal('Reset demo data?', '<p>All demo bookings, payments and notes go back to the start. Bookings made on the website demo are removed too.</p>', 'Reset', function () { try { localStorage.removeItem(KEY); localStorage.removeItem(WEB); localStorage.removeItem('kyleu-web-news'); localStorage.removeItem(WEBK); localStorage.removeItem(POPK); localStorage.removeItem('kyleu-indemnities'); } catch (x) {} STANDS = CONTENT_STANDS.slice(); P.holidays = JSON.parse(ORIG_HOL); CART = {}; IN.id = null; DB = null; P.wkDays = [5, 6, 0]; DB = seed(); migrate(); save(); seedInd(true); paperInit(); render(); toast('Demo data reset'); }, { danger: true }); return; }
  }
  function onInput(e) {
    var t = e.target;
    if (t.matches('[data-f=q]')) { F.q = t.value; var pos = t.selectionStart; render(); var i = $('[data-f=q]'); i.focus(); i.setSelectionRange(pos, pos); return; }
    if (t.matches('[data-gq]')) { GQ = t.value; var p2 = t.selectionStart; render(); var g = $('[data-gq]'); g.focus(); g.setSelectionRange(p2, p2); return; }
    if (t.matches('[data-rw]')) { var sb2 = $('[data-savebar]'); if (sb2) sb2.hidden = false; return; }
    if (t.matches('[data-wtq]')) { WTX.q = t.value; var wp = t.selectionStart; render(); var wi = $('[data-wtq]'); wi.focus(); wi.setSelectionRange(wp, wp); return; }
    if (t.matches('[data-rate]')) { var sbar = $('[data-savebar]'); if (sbar) sbar.hidden = false; var ex = $('[data-example]'); if (ex) ex.innerHTML = exampleText(); var c = $('[data-cardof="' + t.dataset.rate.replace(/"/g, '\\"') + '"]'), v = parseFloat(t.value); if (c) c.textContent = v && hasFee() ? 'Card ' + money(toCard(v)) : ''; return; }
    if (t.matches('[data-q]')) { var qk = t.dataset.q, qp = qk.split(':'); FO(qp[0])[qp[1]] = t.value; resetPages(); var qpos = t.selectionStart; render(); var nq = $('[data-q="' + qk + '"]'); if (nq) { nq.focus(); nq.setSelectionRange(qpos, qpos); } return; }
    if (t.matches('[data-f=q],[data-gq],[data-inq],[data-payq],[data-shopq],[data-prodq]')) resetPages();
    if (t.matches('[data-inq],[data-payq],[data-shopq],[data-prodq]')) { var key = t.matches('[data-inq]') ? 'inq' : t.matches('[data-payq]') ? 'payq' : t.matches('[data-shopq]') ? 'shopq' : 'prodq'; if (key === 'inq') IN.q = t.value; if (key === 'payq') PAYF.q = t.value; if (key === 'shopq') SHOP.q = t.value; if (key === 'prodq') PROD.q = t.value; var ps = t.selectionStart; render(); var ni = $('[data-' + key + ']'); if (ni) { ni.focus(); ni.setSelectionRange(ps, ps); } return; }
    if (t.matches('[data-prod-price]')) { var pv = parseFloat(t.value.replace(/[^\d.]/g, '')), pcard = $('[data-prod-card]'); if (pcard) pcard.value = isNaN(pv) ? '' : money(toCard(pv)); return; }
    if (t.matches('[data-dgr-code]')) { var cc = carOf(t.dataset.dgrCode); if (cc.c && t.value.trim().toUpperCase() !== (cc.c.dgr || '')) { var tk = $('[data-dgr-tick="' + t.dataset.dgrCode + '"]'); if (tk && t.value.trim()) tk.checked = true; } return; }
    if (t.matches('[data-sig]')) { var sk = t.dataset.sig, sd = sk.indexOf('shared:') === 0 ? sigShared() : sigData(SIG_WHO || ME.id); sd[sk.replace('shared:', '')] = t.value.trim(); save(); var pv = $('[data-sig-prev]'); if (pv) pv.innerHTML = sigHTML(sigData(SIG_WHO || ME.id)); return; }
    if (t.matches('[data-soc]')) { socDB()[t.dataset.soc] = t.value.trim(); socSave(); return; }
    if (t.matches('[data-indemnity]')) { DB.settings.indemnity = t.value; save(); return; }
    if (t.matches('[data-dgrlink]')) { DB.settings.dgrLink = t.value.trim(); save(); return; }
    if (t.matches('[data-thanks]')) { if (t.dataset.thanks === 'link') DB.settings.thanksLink = t.value.trim(); else DB.settings.thanksText = t.value.replace(/\r/g, '').trim(); save(); return; }
    if (t.matches('[data-provfee]')) { DB.settings.providerFee = parseFloat(t.value) || 0; save(); return; }
    if (t.matches('[data-doc]') && t.type !== 'checkbox') {
      var dc = K.docCfg(), dk = t.dataset.doc; dc[dk] = /Next$/.test(dk) ? (parseInt(String(t.value).replace(/\D/g, ''), 10) || 1) : dk === 'vatRate' ? (parseFloat(t.value) || 0) : t.value.trim();
      K.docSave(dc); $$('[data-doc-prev]').forEach(function (p) { p.textContent = K.peekNo(p.dataset.docPrev); }); return;
    }
    if (t.matches('[data-match]')) {
      var q = t.value.trim().toUpperCase().replace(/\s/g, ''), out = $('[data-match-out]');
      if (q.length < 3) { out.innerHTML = 'Tip: guests use their booking reference when they pay, so you can paste it straight from the bank app.'; return; }
      var refKey = q.replace(/[^A-Z0-9]/g, '');   // "KY265903", "KY26 5903" and "KY26-5903" all find booking "KY26 5903"
      var hits = DB.bookings.filter(function (b) { return (refKey && b.ref.toUpperCase().replace(/[^A-Z0-9]/g, '').indexOf(refKey) >= 0) || guestName(b).toUpperCase().indexOf(q) >= 0; }).slice(0, 4);
      out.innerHTML = hits.length ? hits.map(function (b) { return '<button class="brow" data-open="' + b.ref + '"><span class="brow-st">' + esc(b.ref) + '</span><span class="brow-g"><b>' + esc(guestName(b)) + '</b><small>' + (b.status === 'pending' ? 'Expecting ' + money(deposit(b)) + ' deposit' : 'Balance ' + money(balance(b))) + '</small></span>' + pill(stateOf(b)) + '</button>'; }).join('') : 'No booking with that reference.';
      return;
    }
    if (t.matches('[data-global]')) {
      var s = t.value.trim().toLowerCase(), box = $('[data-sugg]');
      if (s.length < 2) { box.hidden = true; return; }
      var r = DB.bookings.filter(function (b) { return bHit(b, s); }).slice(-6).reverse();
      box.innerHTML = r.length ? r.map(function (b) { return '<button data-open="' + b.ref + '"><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + ' · ' + fd(b.ci) + '</small></button>'; }).join('') : '<p class="muted small">No bookings found</p>';
      box.hidden = false;
    }
  }
  function onChange(e) {
    var wt = e.target;
    // the Owner changes what someone may see by changing their role
    if (wt.matches && wt.matches('[data-staff-role]')) {
      var su = STAFF.filter(function (x) { return x.id === wt.dataset.staffRole; })[0];
      if (!su || ME.role !== 'Owner' || su.id === ME.id || !ROLES[wt.value]) { render(); return; }
      var was = su.role; su.role = wt.value; DB.staffRoles = DB.staffRoles || {}; DB.staffRoles[su.id] = wt.value;
      log('Role of ' + su.name + ' changed from ' + was + ' to ' + wt.value); save(); render(); toast(esc(su.name) + ' is now ' + esc(wt.value) + '. It applies the next time they sign in.'); return;
    }
    if (wt.matches && wt.matches('[data-wt]')) {
      var wx = webFind(wt.dataset.wt), ww = webDB(), wv = wt.value.replace(/\r/g, '').trim(); if (!wx) return;
      if (!wv || wv === wx.def) { if (ww.text[wx.key] == null) { wt.value = wx.def; return; } delete ww.text[wx.key]; log('Website wording put back to the original: "' + wx.def.slice(0, 60) + '"'); }
      else { if (ww.text[wx.key] === wv) return; ww.text[wx.key] = wv; log('Website wording changed: "' + wv.slice(0, 60) + '"'); }
      save(); var wy = window.scrollY; render(); window.scrollTo(0, wy); toast('Saved. The website shows it now.'); return;
    }
    if (wt.matches && wt.matches('[data-hold]')) {
      var hw = webDB(), hh = holdRules(), hk = wt.dataset.hold;
      if (hk === 'popDays') { var hn = parseInt(String(wt.value).replace(/[^\d]/g, ''), 10); if (isNaN(hn) || hn > 60) { toast('Type a number of days from 0 to 60'); wt.value = hh.popDays; return; } hh.popDays = hn; }
      else hh.skip = wt.value;
      hw.hold = hh.skip === 'weekends' && +hh.popDays === 10 ? null : { skip: hh.skip, popDays: +hh.popDays };
      log('Release rules changed: ' + (hh.skip === 'off' ? 'stands can be released over a weekend' : 'not over ' + (hh.skip === 'holidays' ? 'weekends and public holidays' : 'weekends')) + ', kept ' + hh.popDays + ' days after proof of payment');
      sweepHolds(); save(); var hy = window.scrollY; render(); window.scrollTo(0, hy); toast('Saved. Unpaid bookings use it straight away.'); return;
    }
    if (wt.matches && wt.matches('[data-wkday]')) {
      var wds = $$('[data-wkday]').filter(function (x) { return x.checked; }).map(function (x) { return +x.dataset.wkday; });
      if (!wds.length) { toast('At least one night must cost the weekend rate'); render(); return; }
      webDB().wkDays = wds.sort().join() === '0,5,6' ? null : wds; applyWk(); log('Weekend-rate nights changed'); save(); render(); toast('Saved. New bookings use it from now on.'); return;
    }
    if (wt.matches && wt.matches('[data-hero-file]')) {
      var hf = wt.files && wt.files[0]; if (!hf) return;
      resizeImg(hf, 2400, function (blob, iw) {
        if (!blob) { toast('That photo could not be read. Try a JPG or PNG.'); return; }
        K.files.put('home-hero', blob).then(function () { var hw = webDB(); hw.home.hero = 'own'; hw.home.heroName = hf.name; log('Home page header photo changed to ' + hf.name); save(); render(); toast(iw < 1600 ? 'Saved, but this photo is only ' + iw + ' pixels wide, so it may look soft on big screens.' : 'Saved. The home page shows your photo now.'); }).catch(function () { toast('The photo could not be saved in this browser.'); });
      });
      return;
    }
    if (wt.matches && wt.matches('[data-hero]')) {
      var hw2 = webDB();
      if (wt.value === 'own' && !hw2.home.heroName) { var fi = $('[data-hero-file]'); if (fi) fi.click(); render(); return; }
      if (wt.value) hw2.home.hero = wt.value; else delete hw2.home.hero;
      log('Home page header photo changed'); save(); render(); toast('Saved. The home page shows it now.'); return;
    }
    if (wt.matches && wt.matches('[data-scan-file]')) {
      var sfile = wt.files && wt.files[0], sids = String(wt.dataset.scanFile || '').split(',').filter(Boolean); wt.value = '';
      if (sfile && sids.length) { var slab = wt.closest('label'); if (slab) slab.classList.add('busy'); scanSave(sfile, sids, function (ok, names) { if (slab) slab.classList.remove('busy'); scanDone(ok, names); }); }
      return;
    }
    if (wt.matches && wt.matches('[data-camptime]')) {
      // kept as website settings, keyed by the setting's label, so the website and the documents pick them up
      var isIn = wt.dataset.camptime === 'in', ctv = hm24(wt.value), ctw = webDB();
      if (!ctv) { toast('Choose a time, for example ' + (isIn ? '13:00' : '11:30')); wt.value = isIn ? checkInTime() : checkOutTime(); return; }
      if (isIn ? ctv <= checkOutTime() : ctv >= checkInTime()) { toast('The latest check-out must be before the earliest check-in, so the team has time to clean the stands'); wt.value = isIn ? checkInTime() : checkOutTime(); return; }
      ctw.settings['Check-in time'] = isIn ? ctv : checkInTime(); ctw.settings['Check-out time'] = isIn ? checkOutTime() : ctv;
      if (K.BIZ) { K.BIZ.checkIn = ctw.settings['Check-in time']; K.BIZ.checkOut = ctw.settings['Check-out time']; }
      log((isIn ? 'Earliest check-in' : 'Latest check-out') + ' changed to ' + ctv); save(); render(); toast('Saved. The website shows it now.'); return;
    }
    if (wt.matches && wt.matches('[data-ws]')) {
      var sk = wt.dataset.ws, sv = wt.value.trim(), sw = webDB();
      if (!sv || sv === wt.dataset.def) delete sw.settings[sk]; else sw.settings[sk] = sv;
      log('Website contact details changed: ' + sk); save(); render(); toast('Saved. The website shows it now.'); return;
    }
    var t = e.target;
    if (t.matches('[data-sig-who]')) { SIG_WHO = t.value; render(); return; }
    if (t.matches('[data-sig-chk]')) { sigData(SIG_WHO || ME.id)[t.dataset.sigChk] = t.checked; save(); render(); return; }
    if (t.matches('[data-soc-chk]')) { socDB()[t.dataset.socChk] = t.checked; socSave(); render(); return; }
    if (t.matches('[data-soc-sel]')) { socDB()[t.dataset.socSel] = +t.value; socSave(); return; }
    if (t.matches('[data-soc="igFeed"],[data-soc="facebook"]')) { render(); return; }
    if (t.matches('[data-fk]')) { var fk = t.dataset.fk.split(':'); FO(fk[0])[fk[1]] = t.value; if (t.dataset.fk === 'F:area') F.stand = ''; resetPages(); render(); return; }
    if (t.matches('[data-sortm]')) { var sm = t.value.split('|'); SORT[t.dataset.sortm] = t.value ? { col: +sm[0], dir: +sm[1] } : null; delete TPG[t.dataset.sortm]; render(); return; }
    if (t.matches('[data-payr],[data-paym],[data-shopr]')) resetPages();
    if (t.matches('[data-payr]')) { PAYF.range = t.value; PAYF.lim = 1e9; render(); }
    if (t.matches('[data-paym]')) { PAYF.m = t.value; render(); }
    if (t.matches('[data-shopr]')) { SHOP.range = t.value; render(); }
    if (t.matches('[data-who]')) { SHOP.who = t.value; render(); }
    if (t.matches('[data-quick]')) { var qi = QUICK[+t.value], ta = t.form && t.form.elements.r; if (qi && ta) { var txt = qi[1](); ta.value = ta.value.replace(/\s*$/, '') + (ta.value.trim() ? '\n\n' : '') + txt; ta.focus(); } t.value = ''; }
    if (t.matches('[data-cmp-file]')) { Array.prototype.slice.call(t.files || []).forEach(function (fl) { CMP_ATT.push({ name: fl.name, size: fl.size, type: fl.type }); }); t.value = ''; cmpRefresh(); }
    if (t.matches('[data-catsel]')) { var nc = $('[data-newcat]'); if (nc) nc.hidden = t.value !== '__new'; }
    if (t.matches('[data-vkind]')) { $$('[data-vk]').forEach(function (x) { x.hidden = x.dataset.vk !== t.value; }); }
    if (t.matches('[data-vwho]')) { $$('[data-vw]').forEach(function (x) { x.hidden = x.dataset.vw !== t.value; }); }
    if (t.matches('[data-track]')) { var sf = $('[data-stockf]'); if (sf) sf.hidden = !t.checked; }
    if (t.matches('[data-rp-range]')) { RP.range = t.value; rpSave(); render(); }
    if (t.matches('[data-rp-cmp]')) { RP.compare = t.checked; rpSave(); rpInstant = true; render(); }
    if (t.matches('[data-copy-from]')) { actStand(null, t.value || null); }
    if (t.matches('[data-ph-file]')) { Array.prototype.slice.call(t.files || []).slice(0, 10).forEach(function (file) { shrink(file, function (url) { if (EDIT) { EDIT.photos.push(url); phRefresh(); } }); }); t.value = ''; }
    if (t.matches('[data-doc][type=checkbox]')) { var dv = K.docCfg(); dv[t.dataset.doc] = t.checked; K.docSave(dv); var dk_ = t.dataset.doc, dw_ = dk_ === 'sepQuote' ? 'Quotations' : 'Invoices';
      log(dk_ === 'vatOn' ? 'VAT switched ' + (t.checked ? 'on' : 'off') + ' for quotations and invoices' : dw_ + (t.checked ? ' now get their own numbers' : ' now use the booking reference')); render(); return; }
    if (t.matches('[data-keep]')) { actKeep(t.dataset.keep, t.checked); return; }
    if (t.matches('[data-close-stand]')) { var id = t.dataset.closeStand; if (t.checked) delete DB.closed[id]; else DB.closed[id] = true; log(standById(id).name + (t.checked ? ' opened' : ' closed') + ' for bookings'); save(); render(); toast(standById(id).name + (t.checked ? ' is open for bookings' : ' is closed to new bookings')); }
  }
  function onSubmit(e) {
    var f = e.target;
    if (f.matches('[data-note]')) { e.preventDefault(); var v = f.elements.t.value.trim(); if (!v) return; var b = byRef(f.dataset.note); b.notes.push({ at: nowStamp(), by: ME.name, text: v }); save(); refresh(); return; }
    if (f.matches('[data-reply]')) { e.preventDefault(); sendReply(f, e.submitter && e.submitter.name === 'close'); }
    if (f.matches('[data-hol-add]')) { e.preventDefault(); var hd = f.elements.d.value, hn = f.elements.n.value.trim() || 'Public holiday'; if (!hd) return; DB.hol.add[hd] = hn; delete DB.hol.del[hd]; P.holidays[hd] = hn; log('Added holiday ' + hd + ' (' + hn + ')'); save(); render(); toast(fd(hd) + ' added. The night before is now a weekend rate.'); }
  }
  // tooltips for charts
  function onOver(e) {
    var g = e.target.closest && e.target.closest('[data-tip],[data-rtip]'), tip = $('.tip'); if (!tip) return;
    if (!g) { tip.hidden = true; return; }
    if (g.dataset.rtip) { tip.innerHTML = g.dataset.rtip; tip.classList.add('rich'); } else { tip.textContent = g.dataset.tip; tip.classList.remove('rich'); }
    tip.hidden = false;
    var r = g.getBoundingClientRect(); tip.style.left = Math.min(window.innerWidth - tip.offsetWidth - 8, Math.max(8, r.left + r.width / 2 - tip.offsetWidth / 2)) + 'px'; tip.style.top = (r.top - tip.offsetHeight - 6) + 'px';
  }

  document.addEventListener('DOMContentLoaded', function () {
    app = $('#app');
    document.addEventListener('click', onClick);
    document.addEventListener('input', onInput);
    document.addEventListener('change', onChange);
    document.addEventListener('submit', onSubmit);
    document.addEventListener('mouseover', onOver);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && $('.row-menu')) { var rmb = $('[data-act="row-menu"][aria-expanded="true"]'); closeRowMenu(); if (rmb) rmb.focus(); return; }
      if (e.key === 'Escape') { if (!$('#modal') || $('#modal').hidden) { if ($('#drawer') && !$('#drawer').hidden) closeDrawer(); } else closeModal(); }
      // "/" or Ctrl+K (Cmd+K on a Mac) jumps to the booking search, like most modern tools
      var typing = /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName) || e.target.isContentEditable;
      if (ME && ((e.key === '/' && !typing && !e.ctrlKey && !e.metaKey && !e.altKey) || ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')))) {
        var gs = $('[data-global]'); if (gs && $('#modal').hidden) { e.preventDefault(); if (drawerRef) closeDrawer(); gs.focus(); gs.select(); }
      }
      if (e.key === 'Enter' && e.target.matches('tr[data-open],tr[data-guest],tr[data-client],tr[data-post],tr[data-sale],tr[data-prod],tr[data-voucher],th.sortable')) e.target.click();
    });
    document.addEventListener('focusout', function (e) { if (e.target.matches('[data-global]')) setTimeout(function () { var s = $('[data-sugg]'); if (s) s.hidden = true; }, 200); });
    window.addEventListener('scroll', function (e) { if (!(e.target && e.target.closest && e.target.closest('.row-menu'))) closeRowMenu(); }, true);   // the row menu is placed by hand, so it closes when the page moves
    var rsz; window.addEventListener('resize', function () { closeRowMenu(); clearTimeout(rsz); rsz = setTimeout(function () { if ($('[data-rpc]')) rpDrawCharts(true); }, 120); });
    window.addEventListener('hashchange', function () { document.body.classList.remove('nav-open'); if (!$('#modal').hidden) closeModal(true); if (drawerRef) closeDrawer(true); if (ME) { render(); window.scrollTo(0, 0); } });
    // pick up website demo bookings made in another tab
    window.addEventListener('storage', function (e) { if (e.key === WEB && ME && importWeb()) { render(); toast('New booking from the website'); } if (e.key === POPK && ME && importPop()) { render(); toast('Proof of payment uploaded on the website'); } });
    Promise.all([K.pricesFile ? K.pricesFile() : K.prices(), K.stands()]).then(function (r) {
      P = r[0]; ORIG_HOL = JSON.stringify(P.holidays); CONTENT_STANDS = r[1]; STANDS = r[1].slice(); loadDB(); seedInd(); paperInit();
      var id = null; try { id = sessionStorage.getItem(SESS); } catch (e) {}
      var s = STAFF.filter(function (x) { return x.id === id; })[0];
      if (s) start(s); else login();
    }).catch(function () { app.innerHTML = '<div class="login"><div class="login-card"><h1>Couldn\'t load</h1><p>The admin reads the content folder. Open it through the preview server (Preview website.bat).</p></div></div>'; });
  });
})();
