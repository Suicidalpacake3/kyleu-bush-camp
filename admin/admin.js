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
  function cardFee() { return num('Booking rules', 'Card payment fee percentage', 3); }
  function toCard(n) { return Math.round(n * (1 + cardFee() / 100)); }
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
  function isWeekendNight(s) { var dow = D(s).getDay(); return dow === 5 || dow === 6 || !!P.holidays[add(s, 1)]; }
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
  function deposit(b) { return Math.round(b.total * depPct() / 100); }
  function depositDue(b) { return add(b.created.slice(0, 10), num('Booking rules', 'Deposit due within days of invoice', 5)); }
  function balanceDue(b) { return add(b.ci, -num('Booking rules', 'Balance due days before arrival', 7)); }
  function guestName(b) { return b.guest.first + ' ' + b.guest.last; }
  function people(b) { return b.adults + b.pens + b.kids; }
  function methodLabel(m) { return m === 'card' ? 'Card' : m === 'cash' ? 'Cash' : 'EFT'; }
  function stateOf(b) {
    if (b.status === 'cancelled') return { k: 'cancelled', t: 'Cancelled', tone: 'muted' };
    if (b.status === 'out') return { k: 'out', t: 'Departed', tone: 'muted' };
    if (b.status === 'in') return { k: 'in', t: 'In camp', tone: 'ok' };
    if (b.status === 'pending') {
      if (b.pop) return { k: 'pop', t: 'Proof of payment in', tone: 'info' };
      if (TODAY > depositDue(b)) return { k: 'overdue', t: 'EFT overdue', tone: 'bad' };
      return { k: 'pending', t: 'Awaiting EFT', tone: 'warn' };
    }
    if (balance(b) <= 0) return { k: 'paid', t: 'Paid in full', tone: 'ok' };
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

  /* ---------- demo data ---------- */
  function rng(seed) { return function () { seed |= 0; seed = seed + 0x6D2B79F5 | 0; var t = Math.imul(seed ^ seed >>> 15, 1 | seed); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  var FIRST = ['Thandi', 'Johan', 'Lerato', 'Pieter', 'Ayesha', 'Sipho', 'Megan', 'Riaan', 'Naledi', 'Werner', 'Zanele', 'Craig', 'Anika', 'Bongani', 'Chantel', 'Dewald', 'Precious', 'Kobus', 'Fatima', 'Ruan', 'Nomsa', 'Gareth', 'Lindiwe', 'Hendrik', 'Kayla', 'Musa', 'Elmarie', 'Tshepo', 'Jessica', 'Andile', 'Marike', 'Kyle', 'Palesa', 'Jacques', 'Refilwe', 'Ettienne'];
  var LAST = ['Nkosi', 'van der Merwe', 'Mokoena', 'Botha', 'Patel', 'Dlamini', 'Smith', 'Pretorius', 'Khumalo', 'du Plessis', 'Mahlangu', 'Jacobs', 'Venter', 'Ndlovu', 'Steyn', 'Coetzee', 'Molefe', 'Nel', 'Naidoo', 'Kruger', 'Sithole', 'Fourie', 'Mthembu', 'Swanepoel'];
  var SETUPS = ['Rooftop tent', 'Off-road trailer', 'Caravan', 'Ground tent', 'Rooftop tent', 'Off-road trailer'];
  var SOURCES = ['Website', 'Website', 'Website', 'Website', 'WhatsApp', 'WhatsApp', 'Phone', 'Q2B', 'Website', 'Phone'];
  function seed() {
    var r = rng(2611), pick = function (a) { return a[Math.floor(r() * a.length)]; };
    var db = { v: 3, seeded: TODAY, gone: {}, threads: [], hol: { add: {}, del: {} }, popSeen: {}, bookings: [], blocks: [], sales: [], log: [], rates: {}, closed: {}, settings: { providerFee: 2.95 }, readEnq: {} };
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
      var b = { ref: 'KY' + ci.slice(2, 4) + '-' + Math.floor(r() * 1679616).toString(36).toUpperCase().padStart(4, '0'), created: created + ' ' + String(7 + Math.floor(r() * 13)).padStart(2, '0') + ':' + String(Math.floor(r() * 60)).padStart(2, '0'),
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
      if (r() < .12 && b.status !== 'cancelled') b.notes.push({ at: cday, by: pick(['Sherri', 'Devon', 'Kyran']), text: pick(['Celebrating a birthday on Saturday.', 'Asked for a stand close to the pool.', 'Arriving late, after 18:00. Gate code sent.', 'Bringing a 6 m off-road trailer.', 'First time in Dinokeng: sent gate directions.', 'Regulars, they love Stand 3.']) });
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
      b.pops = [{ name: bank + '-payment-' + b.ref + (i % 2 ? '.pdf' : '.jpg'), size: 90000 + Math.floor(r() * 180000), type: i % 2 ? 'application/pdf' : 'image/jpeg', data: '', at: add(TODAY, -1 - (i % 2)) + ' ' + (17 + i % 5) + ':' + String(10 + i * 7 % 50), via: 'Website upload' }];
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
    if (mailB) db.threads.push(T('t3', 'Proof of payment ' + mailB.ref, guestName(mailB), mailB.guest.email, mailB.guest.phone, 'open', true, [G(TODAY + ' 06:58', 'Good morning,\n\nPlease find attached proof of payment for booking ' + mailB.ref + '.\n\nRegards,\n' + mailB.guest.first, [{ name: 'FNB-proof-of-payment-' + mailB.ref + '.pdf', size: 86214, type: 'application/pdf' }])], mailB.ref));
    var recent = db.bookings.filter(function (b) { return b.created.slice(0, 10) >= add(TODAY, -3); }).slice(-6);
    recent.forEach(function (b) { db.log.push({ at: b.created, by: b.source === 'Website' ? 'Website' : 'Sherri', text: 'New booking ' + b.ref + ' for ' + guestName(b) + ' (' + standById(b.stand).name + ')', ref: b.ref }); });
    db.log.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); return true; } catch (e) { return false; } }
  function loadDB() {
    try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
    if (!DB || DB.v !== 3) { DB = seed(); save(); }
    DB.gone = DB.gone || {};
    if (DB.stands) STANDS = DB.stands;   // stands added or changed in this admin
    if (!DB.products) DB.products = defaultProducts();
    DB.threads = DB.threads || []; DB.popSeen = DB.popSeen || {}; applyHol();
    importWeb(); importPop();
  }
  // proof of payment uploaded on the website (pop.html), same browser in the demo
  var POPK = 'kyleu-web-pop';
  function importPop() {
    var list = []; try { list = JSON.parse(localStorage.getItem(POPK) || '[]'); } catch (e) {}
    var n = 0;
    list.forEach(function (p) {
      if (!p || !p.id || DB.popSeen[p.id]) return; DB.popSeen[p.id] = 1; n++;
      var f = p.file || {}, b = byRefLoose(p.ref), att = { name: f.name || 'proof-of-payment', size: f.size || 0, type: f.type || '', data: f.data || '', at: p.at, via: 'Website upload' };
      if (b) {
        b.pops = b.pops || []; b.pops.push(att); if (b.status === 'pending') b.pop = true;
        b.notes.push({ at: p.at, by: 'Guest', text: 'Uploaded proof of payment on the website' + (p.note ? ': ' + p.note : '.') });
        DB.log.unshift({ at: p.at, by: 'Website', text: 'Proof of payment uploaded for ' + b.ref, ref: b.ref });
      } else {
        DB.threads.push({ id: uid('t'), subject: 'Proof of payment: ' + (p.ref || 'no reference'), name: p.email, email: p.email, phone: '', status: 'open', unread: true, ref: '', msgs: [{ from: 'guest', at: p.at, body: 'Uploaded on the website with booking reference "' + (p.ref || '') + '", which does not match a booking. Please match it by hand.' + (p.note ? '\n\n' + p.note : ''), att: [att] }] });
      }
    });
    if (n) save();
    return n;
  }
  // bookings made in the website's demo checkout (same browser)
  function importWeb() {
    var list = []; try { list = JSON.parse(localStorage.getItem(WEB) || '[]'); } catch (e) {}
    var added = 0;
    list.forEach(function (w) {
      if (byRef(w.ref)) return;
      var card = w.pay === 'deposit' || w.pay === 'full', nowPaid = w.paid || 0;
      var b = { ref: w.ref, created: w.created, source: 'Website', guest: { first: w.first, last: w.last, email: w.email, phone: w.phone, consent: !!w.consent }, stand: w.stand, ci: w.ci, co: w.co, adults: w.adults, pens: w.pens, kids: w.kids, vehicles: 1, setup: w.setup || '', extras: w.extras || {},
        method: card ? 'card' : 'eft', eft: w.eft, card: w.card, total: card ? w.card : w.eft, payments: [], status: nowPaid ? 'confirmed' : 'pending', notes: w.notes ? [{ at: w.created, by: 'Guest', text: w.notes }] : [], pop: false, isNew: true };
      if (nowPaid) b.payments.push({ d: w.created.slice(0, 10), amt: nowPaid, m: card ? 'card' : 'eft', type: w.pay === 'full' ? 'Full payment' : 'Deposit', ref: card ? 'Card (website)' : 'Instant EFT' });
      DB.bookings.push(b); added++;
      DB.log.unshift({ at: w.created, by: 'Website', text: 'New website booking ' + b.ref + ' for ' + guestName(b), ref: b.ref });
    });
    if (added) { DB.bookings.sort(function (a, b) { return a.ci < b.ci ? -1 : 1; }); save(); }
    return added;
  }

  /* ---------- staff ---------- */
  var STAFF = [
    { id: 'sherri', name: 'Sherri', role: 'Owner', email: 'sherri@kyleu.co.za' },
    { id: 'devon', name: 'Devon', role: 'Owner', email: 'devon@kyleu.co.za' },
    { id: 'kyran', name: 'Kyran', role: 'Manager', email: 'kyran@kyleu.co.za' },
    { id: 'leuan', name: 'Leuan', role: 'Front desk', email: 'leuan@kyleu.co.za' }
  ];
  var ROLES = {
    Owner: ['dashboard', 'bookings', 'calendar', 'enquiries', 'guests', 'eft', 'payments', 'reports', 'shop', 'drives', 'products', 'stands', 'rates', 'settings'],
    Manager: ['dashboard', 'bookings', 'calendar', 'enquiries', 'guests', 'eft', 'payments', 'reports', 'shop', 'drives', 'products', 'stands'],
    'Front desk': ['dashboard', 'bookings', 'calendar', 'enquiries', 'guests', 'shop', 'drives']
  };
  var NAV = [
    { id: 'dashboard', t: 'Dashboard', i: 'home', g: '' },
    { id: 'bookings', t: 'Bookings', i: 'list', g: 'Front desk' },
    { id: 'calendar', t: 'Calendar', i: 'cal', g: 'Front desk' },
    { id: 'enquiries', t: 'Inbox', i: 'mail', g: 'Front desk' },
    { id: 'guests', t: 'Guests', i: 'users', g: 'Front desk' },
    { id: 'eft', t: 'EFT payments', i: 'bank', g: 'Money' },
    { id: 'payments', t: 'Payments', i: 'card', g: 'Money' },
    { id: 'reports', t: 'Reports', i: 'chart', g: 'Money' },
    { id: 'shop', t: 'Shop', i: 'cart', g: 'Shop & activities' },
    { id: 'drives', t: 'Game drives', i: 'car', g: 'Shop & activities' },
    { id: 'products', t: 'Products', i: 'box', g: 'Shop & activities' },
    { id: 'stands', t: 'Stands & blocks', i: 'tent', g: 'Setup' },
    { id: 'rates', t: 'Rates & fees', i: 'tag', g: 'Setup' },
    { id: 'settings', t: 'Settings', i: 'cog', g: 'Setup' }
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
    var m = $('#modal');
    m.innerHTML = '<div class="m-back" data-close></div><form class="m-card' + (opts.wide ? ' wide' : '') + '" novalidate><header><h3>' + title + '</h3><button type="button" class="icon-btn" data-close aria-label="Close">' + ic('x') + '</button></header><div class="m-body">' + body + '</div>' +
      (ok ? '<footer><button type="button" class="btn ghost" data-close>Cancel</button><button class="btn ' + (opts.danger ? 'danger' : '') + '" type="submit">' + ok + '</button></footer>' : '') + '</form>';
    m.hidden = false; document.body.classList.add('lock');
    var f = $('form', m);
    f.addEventListener('submit', function (e) { e.preventDefault(); if (onOk && onOk(f) === false) return; closeModal(); });
    $$('[data-close]', m).forEach(function (x) { x.addEventListener('click', closeModal); });
    if (opts.onOpen) opts.onOpen(f);
    var first = $('input:not([type=hidden]),select,textarea', f); if (first && !opts.noFocus) setTimeout(function () { first.focus(); }, 30);
    return f;
  }
  function closeModal() { var m = $('#modal'); m.hidden = true; m.innerHTML = ''; if ($('#drawer').hidden) document.body.classList.remove('lock'); }
  function fval(f, n) { var el = f.elements[n]; return el ? (el.type === 'checkbox' ? el.checked : el.value.trim()) : ''; }

  var drawerRef = null;
  function openBooking(ref) {
    var b = byRef(ref); if (!b) { toast('Booking ' + esc(ref) + ' not found'); return; }
    drawerRef = ref; if (b.isNew) { b.isNew = false; save(); }
    var d = $('#drawer'); d.hidden = false; document.body.classList.add('lock');
    d.innerHTML = '<div class="d-back" data-dclose></div><aside class="d-panel" role="dialog" aria-label="Booking ' + esc(ref) + '">' + bookingHTML(b) + '</aside>';
    requestAnimationFrame(function () { d.classList.add('on'); });
    $$('[data-dclose]', d).forEach(function (x) { x.addEventListener('click', closeDrawer); });
  }
  function closeDrawer() { var d = $('#drawer'); d.classList.remove('on'); drawerRef = null; setTimeout(function () { d.hidden = true; d.innerHTML = ''; if ($('#modal').hidden) document.body.classList.remove('lock'); }, 220); }
  function refresh() { render(); if (drawerRef) { var p = $('#drawer .d-panel'); if (p) { var sc = p.scrollTop; p.innerHTML = bookingHTML(byRef(drawerRef)); p.scrollTop = sc; $$('[data-dclose]', p).forEach(function (x) { x.addEventListener('click', closeDrawer); }); } } }

  function bookingHTML(b) {
    var st = standById(b.stand), s = stateOf(b), pd = paid(b), bal = balance(b), wa = '27' + b.guest.phone.replace(/\D/g, '').replace(/^0/, '');
    var q = quote(b.stand, b.ci, b.co, b, b.extras);
    var acts = [];
    if (b.status === 'pending') acts.push('<button class="btn" data-act="pay" data-ref="' + b.ref + '">' + ic('check') + 'EFT received</button>');
    else if (bal > 0 && b.status !== 'cancelled') acts.push('<button class="btn" data-act="pay" data-ref="' + b.ref + '">' + ic('card') + 'Record payment</button>');
    if (b.status === 'confirmed' && b.ci <= TODAY) acts.push('<button class="btn green" data-act="checkin" data-ref="' + b.ref + '">' + ic('in') + 'Check in</button>');
    if (b.status === 'in') acts.push('<button class="btn green" data-act="checkout" data-ref="' + b.ref + '">' + ic('out') + 'Check out</button>');
    if (b.status !== 'cancelled' && b.status !== 'out') acts.push('<button class="btn ghost" data-act="remind" data-ref="' + b.ref + '">' + ic('send') + 'Send message</button>');
    if (b.status !== 'cancelled' && b.status !== 'out' && b.status !== 'in') acts.push('<button class="btn ghost" data-act="move" data-ref="' + b.ref + '">' + ic('cal') + 'Change dates or stand</button>');
    if (b.status !== 'cancelled' && b.status !== 'out') acts.push('<button class="btn ghost danger-t" data-act="cancel" data-ref="' + b.ref + '">' + ic('x') + 'Cancel booking</button>');
    return '<header class="d-head"><div><span class="muted small">Booking</span><h2>' + esc(b.ref) + '</h2>' + pill(s) + (b.pop && b.status === 'pending' ? ' <span class="pill info">' + ic('note') + 'Check bank</span>' : '') + '</div><button class="icon-btn" data-dclose aria-label="Close">' + ic('x') + '</button></header>' +
      '<div class="d-body">' +
      '<div class="d-actions">' + acts.join('') + '</div>' +
      '<section class="d-sec"><h4>Guest</h4><div class="guest-line"><span class="avatar">' + esc(b.guest.first[0] + b.guest.last.split(' ').pop()[0]) + '</span><div><b>' + esc(guestName(b)) + '</b><div class="muted small">' + esc(b.guest.email) + '</div></div></div>' +
      '<div class="chips"><a class="chip" href="tel:' + esc(b.guest.phone.replace(/\s/g, '')) + '">' + ic('phone') + esc(b.guest.phone) + '</a><a class="chip" target="_blank" rel="noopener" href="https://wa.me/' + wa + '">' + ic('wa') + 'WhatsApp</a><a class="chip" href="mailto:' + esc(b.guest.email) + '">' + ic('mail') + 'Email</a></div></section>' +
      '<section class="d-sec"><h4>Stay</h4><dl class="kv">' +
      '<dt>Stand</dt><dd><b>' + esc(st.name) + '</b> · ' + AREA_SHORT[st.area] + '</dd>' +
      '<dt>Arrive</dt><dd>' + fd(b.ci, { weekday: 'long', day: 'numeric', month: 'long' }) + ' <span class="muted">(' + rel(b.ci) + ')</span></dd>' +
      '<dt>Depart</dt><dd>' + fd(b.co, { weekday: 'long', day: 'numeric', month: 'long' }) + '</dd>' +
      '<dt>Nights</dt><dd>' + diff(b.ci, b.co) + '</dd>' +
      '<dt>Guests</dt><dd>' + (b.adults ? b.adults + ' adult' + (b.adults > 1 ? 's' : '') : '') + (b.pens ? (b.adults ? ', ' : '') + b.pens + ' pensioner' + (b.pens > 1 ? 's' : '') : '') + (b.kids ? ', ' + b.kids + ' child' + (b.kids > 1 ? 'ren' : '') + ' under 12' : '') + '</dd>' +
      '<dt>Setup</dt><dd>' + esc(b.setup || 'Not given') + ' · ' + b.vehicles + ' vehicle' + (b.vehicles > 1 ? 's' : '') + '</dd>' +
      '<dt>Booked</dt><dd>' + fd(b.created.slice(0, 10), { day: 'numeric', month: 'short', year: 'numeric' }) + ' via ' + esc(b.source) + '</dd></dl></section>' +
      '<section class="d-sec"><h4>Money</h4><div class="lines">' + q.lines.concat((b.charges || []).map(function (c) { return { t: c.desc, e: c.e, c: c.c }; })).map(function (l) { return '<div class="ln"><span>' + esc(l.t) + '</span><span>' + (b.method === 'card' ? money(l.c) : money(l.e)) + '</span></div>'; }).join('') +
      '<div class="ln sub"><span>Card price</span><span>' + (b.method === 'card' ? money(b.card) : '<s>' + money(b.card) + '</s>') + '</span></div>' +
      '<div class="ln sub"><span>EFT price (no card fee)</span><span>' + (b.method === 'card' ? '<s>' + money(b.eft) + '</s>' : money(b.eft)) + '</span></div>' +
      '<div class="ln tot"><span>Total · paying by ' + methodLabel(b.method) + '</span><span>' + money(b.total) + '</span></div>' +
      '<div class="ln"><span>Paid</span><span class="ok-t">' + money(pd) + '</span></div>' +
      (b.status === 'cancelled' ? '' : '<div class="ln tot"><span>Balance</span><span class="' + (bal ? 'warn-t' : 'ok-t') + '">' + money(bal) + '</span></div>') + '</div>' +
      (b.status === 'pending' ? '<p class="note">' + ic('clock') + '<span>Deposit of <b>' + money(deposit(b)) + '</b> is due by <b>' + fd(depositDue(b)) + '</b> (' + rel(depositDue(b)) + '). Reference <b>' + esc(b.ref) + '</b>.</span></p>' : '') +
      (b.status === 'confirmed' && bal ? '<p class="note">' + ic('clock') + '<span>Balance of <b>' + money(bal) + '</b> is due by <b>' + fd(balanceDue(b)) + '</b> (' + rel(balanceDue(b)) + ').</span></p>' : '') +
      ((b.pops || []).length ? '<h5>Proof of payment</h5>' + popChips(b) : '') +
      '<h5>Payments</h5>' + ((b.payments || []).length ? '<ul class="timeline">' + b.payments.map(function (p) { return '<li><span class="dot ' + (p.amt < 0 ? 'bad' : 'pm-' + p.m) + '"></span><div><b>' + money(p.amt) + '</b> ' + esc(p.type) + ' · ' + methodLabel(p.m) + '<div class="muted small">' + fd(p.d, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + esc(p.ref || '') + '</div></div></li>'; }).join('') + '</ul>' : '<p class="muted small">No payments yet.</p>') + '</section>' +
      (function () { var ts = DB.threads.filter(function (t) { return t.ref === b.ref || t.email === b.guest.email; }); return '<section class="d-sec"><h4>Emails</h4>' + (ts.length ? '<div class="list">' + ts.map(function (t) { return '<button type="button" class="brow" data-thread-go="' + t.id + '"><span class="brow-g"><b>' + esc(t.subject) + '</b><small>' + t.msgs.length + ' email' + (t.msgs.length > 1 ? 's' : '') + ' · last ' + when(lastMsg(t).at) + '</small></span>' + ic('chev-r') + '</button>'; }).join('') + '</div>' : '<p class="muted small">No emails yet.</p>') + '</section>'; })() +
      '<section class="d-sec"><h4>Notes</h4>' + (b.notes.length ? '<ul class="notes">' + b.notes.map(function (n) { return '<li><p>' + esc(n.text) + '</p><span class="muted small">' + esc(n.by) + ' · ' + esc(n.at) + '</span></li>'; }).join('') + '</ul>' : '<p class="muted small">No notes yet.</p>') +
      '<form class="note-form" data-note="' + b.ref + '"><input name="t" placeholder="Add a note for the team" aria-label="Add a note"><button class="btn ghost" type="submit">Add</button></form></section>' +
      '</div>';
  }

  /* ---------- actions ---------- */
  function actPay(ref) {
    var b = byRef(ref), bal = balance(b), isPend = b.status === 'pending';
    var dueNow = isPend ? deposit(b) : bal;
    var cardBal = isPend ? Math.round(b.card * depPct() / 100) : Math.max(0, b.card - paid(b));
    modal(isPend ? 'EFT payment received' : 'Record a payment',
      '<p class="muted small">' + esc(guestName(b)) + ' · ' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + '</p>' +
      '<div class="seg" role="radiogroup">' + ['eft', 'card', 'cash'].map(function (m) { return '<label><input type="radio" name="m" value="' + m + '"' + ((isPend ? 'eft' : (b.method === 'card' ? 'card' : 'eft')) === m ? ' checked' : '') + '><span>' + methodLabel(m) + '</span></label>'; }).join('') + '</div>' +
      '<p class="hint" data-hint></p>' +
      '<div class="grid2"><label class="fld"><span>Amount (R)</span><input name="amt" inputmode="numeric" value="' + dueNow + '"></label><label class="fld"><span>Date</span><input type="date" name="d" value="' + TODAY + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Type</span><select name="type"><option' + (isPend ? ' selected' : '') + '>Deposit</option><option' + (!isPend ? ' selected' : '') + '>Balance</option><option>Full payment</option></select></label><label class="fld"><span>Bank / card reference</span><input name="ref" value="' + esc(b.ref) + '"></label></div>',
      'Save payment', function (f) {
        var m = fval(f, 'm') || $('[name=m]:checked', f).value, amt = parseFloat(fval(f, 'amt').replace(/[^\d.]/g, ''));
        if (!amt) { toast('Enter the amount received'); return false; }
        if (m === 'card' && b.method !== 'card') { b.method = 'card'; b.total = b.card; b.notes.push({ at: nowStamp(), by: ME.name, text: 'Paid by card, so the card price (' + money(b.card) + ') now applies.' }); }
        if (m !== 'card' && b.method === 'card' && !paid(b)) { b.method = m; b.total = b.eft; }
        b.payments.push({ d: fval(f, 'd'), amt: amt, m: m, type: fval(f, 'type'), ref: fval(f, 'ref') });
        if (b.status === 'pending') { b.status = 'confirmed'; b.pop = false; }
        log(money(amt) + ' ' + methodLabel(m) + ' payment recorded on ' + b.ref, b.ref); save(); refresh(); toast(money(amt) + ' recorded. Receipt emailed to ' + esc(b.guest.first) + ' (demo)');
      }, { onOpen: function (f) {
        var upd = function () {
          var m = $('[name=m]:checked', f).value, h = $('[data-hint]', f), a = f.elements.amt;
          if (m === 'card' && b.method !== 'card') { a.value = cardBal; h.innerHTML = 'Card payments use the card price: <b>' + money(b.card) + '</b> instead of ' + money(b.eft) + ' (+' + cardFee() + '% card fee).'; }
          else if (m !== 'card' && b.method === 'card' && !paid(b)) { a.value = isPend ? deposit(Object.assign({}, b, { total: b.eft })) : b.eft; h.innerHTML = 'EFT and cash use the normal price: <b>' + money(b.eft) + '</b>.'; }
          else { a.value = dueNow; h.textContent = m === 'eft' ? 'Check the money is in the bank before saving.' : ''; }
        };
        $$('[name=m]', f).forEach(function (x) { x.addEventListener('change', upd); }); upd();
      } });
  }
  var TEMPLATES = {
    eft: { t: 'EFT deposit reminder', s: 'Your Kyleu booking: deposit reminder', b: function (b) { return 'Hi {first},\n\nThank you for booking {stand} from {ci} to {co}. To secure your stand please pay the deposit of {deposit} by {depdue} using reference {ref}.\n\nBank: FNB · Account: Kyleu Bush Camp · Acc no: 62000000000 · Branch: 250655\n\nUpload your proof of payment at www.kyleu.co.za/pop.html, or reply to this email with it attached.\n\nSee you in the bush!\nThe Kyleu team'; } },
    balance: { t: 'Balance reminder', s: 'Your Kyleu stay is coming up', b: function (b) { return 'Hi {first},\n\nYour stay at {stand} starts on {ci}. The balance of {balance} is due by {baldue}. Pay by EFT with reference {ref}, or reply and we will send a card payment link.\n\nThe Kyleu team'; } },
    arrival: { t: 'Pre-arrival information', s: 'Getting to Kyleu Bush Camp', b: function (b) { return 'Hi {first},\n\nWe look forward to welcoming you on {ci}.\n\nDirections: enter Dinokeng at Tau Gate, follow the main road 4.8 km, turn right onto Kaallaagte Road and continue 2 km.\n\nDinokeng conservation and self-drive fees are paid to the reserve (not to Kyleu): https://dinokeng.plnktn.io/south\n\nCheck-in from 12:00. Gate questions: 060 458 4478.\n\nThe Kyleu team'; } },
    thanks: { t: 'Thank you & review', s: 'Thanks for staying at Kyleu', b: function (b) { return 'Hi {first},\n\nThank you for camping with us at {stand}. We hope you loved the bush! If you have a minute, a Google review helps our small family camp a lot.\n\nThe Kyleu team'; } },
    confirm: { t: 'Booking confirmation', s: 'Booking confirmed: {ref}', b: function (b) { return 'Hi {first},\n\nYour booking {ref} is confirmed: {stand}, {ci} to {co}.\nTotal {total}, paid {paid}, balance {balance} due by {baldue}.\n\nThe Kyleu team'; } }
  };
  function fill(t, b) {
    var map = { first: b.guest.first, stand: standById(b.stand).name, ci: fd(b.ci, { weekday: 'long', day: 'numeric', month: 'long' }), co: fd(b.co, { weekday: 'long', day: 'numeric', month: 'long' }), deposit: money(deposit(b)), depdue: fd(depositDue(b), { day: 'numeric', month: 'long' }), ref: b.ref, balance: money(balance(b)), baldue: fd(balanceDue(b), { day: 'numeric', month: 'long' }), total: money(b.total), paid: money(paid(b)) };
    return t.replace(/\{(\w+)\}/g, function (_, k) { return map[k] != null ? map[k] : _; });
  }
  function actRemind(ref) {
    var b = byRef(ref), def = b.status === 'pending' ? 'eft' : balance(b) && b.ci > TODAY ? 'balance' : diff(TODAY, b.ci) <= 10 ? 'arrival' : 'confirm';
    modal('Send a message', '<p class="muted small">To ' + esc(guestName(b)) + ' · ' + esc(b.guest.email) + '</p>' +
      '<label class="fld"><span>Template</span><select name="tpl">' + Object.keys(TEMPLATES).map(function (k) { return '<option value="' + k + '"' + (k === def ? ' selected' : '') + '>' + TEMPLATES[k].t + '</option>'; }).join('') + '</select></label>' +
      '<label class="fld"><span>Subject</span><input name="s"></label><label class="fld"><span>Message</span><textarea name="b" rows="10"></textarea></label>' +
      '<div class="seg"><label><input type="radio" name="via" value="email" checked><span>' + ic('mail') + 'Email</span></label><label><input type="radio" name="via" value="wa"><span>' + ic('wa') + 'WhatsApp</span></label></div>',
      'Send', function (f) {
        var via = $('[name=via]:checked', f).value;
        if (via === 'wa') window.open('https://wa.me/27' + b.guest.phone.replace(/\D/g, '').replace(/^0/, '') + '?text=' + encodeURIComponent(f.elements.b.value), '_blank', 'noopener');
        if (via === 'wa') b.notes.push({ at: nowStamp(), by: ME.name, text: 'Sent "' + f.elements.s.value + '" by WhatsApp.' });
        else logEmail(b, f.elements.s.value, f.elements.b.value);
        log('Message sent to ' + guestName(b), b.ref); save(); refresh(); toast(via === 'wa' ? 'WhatsApp opened with the message' : 'Email sent (demo: nothing was actually sent)');
      }, { wide: true, onOpen: function (f) { var set = function () { var t = TEMPLATES[f.elements.tpl.value]; f.elements.s.value = fill(t.s, b); f.elements.b.value = fill(t.b(b), b); }; f.elements.tpl.addEventListener('change', set); set(); }, noFocus: true });
  }
  function actCancel(ref) {
    var b = byRef(ref), days = diff(TODAY, b.ci), pd = paid(b);
    var charge = days <= 2 ? b.total : days <= 14 ? Math.min(deposit(b), b.total) : 0, refund = Math.max(0, pd - charge);
    modal('Cancel ' + esc(b.ref) + '?', '<p>' + esc(guestName(b)) + ' · ' + esc(standById(b.stand).name) + ' · arriving ' + fdw(b.ci) + ' (' + rel(b.ci) + ').</p>' +
      '<div class="callout ' + (charge ? 'warn' : '') + '"><b>Cancellation policy</b><br>' + (days <= 2 ? 'Within 48 hours of arrival: 100% is charged.' : days <= 14 ? 'Within 14 days of arrival: 50% (the deposit) is charged.' : 'More than 14 days before arrival: no cancellation charge.') + ' Offer to move the booking to another date first.</div>' +
      '<div class="lines"><div class="ln"><span>Paid so far</span><span>' + money(pd) + '</span></div><div class="ln"><span>Kept by Kyleu</span><span>' + money(Math.min(pd, charge)) + '</span></div><div class="ln tot"><span>Refund to guest</span><span>' + money(refund) + '</span></div></div>' +
      '<label class="fld"><span>Reason</span><input name="why" placeholder="e.g. Guest emailed, family emergency"></label>',
      'Cancel booking', function (f) {
        b.status = 'cancelled'; b.pop = false;
        if (refund) b.payments.push({ d: TODAY, amt: -refund, m: b.payments.length ? b.payments[0].m : 'eft', type: 'Refund', ref: 'Refund ' + b.ref });
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Cancelled. ' + (fval(f, 'why') || '') + (refund ? ' Refund ' + money(refund) + '.' : '') });
        log('Booking ' + b.ref + ' cancelled', b.ref); save(); refresh(); toast('Booking cancelled. The stand is free again.');
      }, { danger: true });
  }
  function actMove(ref) {
    var b = byRef(ref);
    modal('Change dates or stand', '<div class="grid2"><label class="fld"><span>Arrive</span><input type="date" name="ci" value="' + b.ci + '"></label><label class="fld"><span>Depart</span><input type="date" name="co" value="' + b.co + '"></label></div>' +
      '<label class="fld"><span>Stand</span><select name="stand">' + standOptions(b.stand) + '</select></label><p class="hint" data-hint></p>',
      'Save changes', function (f) {
        var ci = fval(f, 'ci'), co = fval(f, 'co'), stid = fval(f, 'stand');
        if (co <= ci) { toast('Departure must be after arrival'); return false; }
        if (overlaps(stid, ci, co, b.ref)) { toast('That stand is not free for those nights'); return false; }
        var q = quote(stid, ci, co, b, b.extras); b.ci = ci; b.co = co; b.stand = stid; b.eft = q.eft; b.card = q.card; b.total = b.method === 'card' ? q.card : q.eft;
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Moved to ' + standById(stid).name + ', ' + fd(ci) + ' to ' + fd(co) + '.' });
        log('Booking ' + b.ref + ' moved', b.ref); save(); refresh(); toast('Booking updated. New total ' + money(b.total));
      }, { onOpen: function (f) { var u = function () { var ci = fval(f, 'ci'), co = fval(f, 'co'), s = fval(f, 'stand'), h = $('[data-hint]', f); if (co <= ci) { h.textContent = ''; return; } var q = quote(s, ci, co, b, b.extras); h.innerHTML = (overlaps(s, ci, co, b.ref) ? '<span class="bad-t">Not free for those nights.</span> ' : '<span class="ok-t">Free.</span> ') + 'New total: <b>' + money(b.method === 'card' ? q.card : q.eft) + '</b> (' + methodLabel(b.method) + ')'; }; $$('input,select', f).forEach(function (x) { x.addEventListener('change', u); }); u(); } });
  }
  function standOptions(sel, onlyFree) {
    return ['fenced', 'unfenced', 'self-sufficient'].map(function (a) {
      return '<optgroup label="' + AREA_SHORT[a] + '">' + STANDS.filter(function (s) { return s.area === a; }).map(function (s) { return '<option value="' + s.id + '"' + (s.id === sel ? ' selected' : '') + '>' + esc(s.name) + ' (' + s.guests + ' guests)</option>'; }).join('') + '</optgroup>';
    }).join('');
  }
  function actNew(pre) {
    pre = pre || {};
    var ci = pre.ci || TODAY, co = pre.co || add(ci, 2);
    modal('New booking', '<p class="muted small">For phone, WhatsApp, email and walk-in bookings. Website bookings arrive here by themselves.</p>' +
      '<div class="grid2"><label class="fld"><span>First name</span><input name="first" value="' + esc(pre.first || '') + '" required></label><label class="fld"><span>Surname</span><input name="last" value="' + esc(pre.last || '') + '" required></label></div>' +
      '<div class="grid2"><label class="fld"><span>Mobile</span><input name="phone" inputmode="tel" value="' + esc(pre.phone || '') + '"></label><label class="fld"><span>Email</span><input name="email" type="email" value="' + esc(pre.email || '') + '"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Arrive</span><input type="date" name="ci" value="' + ci + '"></label><label class="fld"><span>Depart</span><input type="date" name="co" value="' + co + '"></label></div>' +
      '<label class="fld"><span>Stand</span><select name="stand">' + standOptions(pre.stand || '') + '</select></label>' +
      '<div class="grid3"><label class="fld"><span>Adults</span><input type="number" min="0" max="12" name="adults" value="2"></label><label class="fld"><span>Pensioners</span><input type="number" min="0" max="12" name="pens" value="0"></label><label class="fld"><span>Kids under 12</span><input type="number" min="0" max="12" name="kids" value="0"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Booked via</span><select name="source"><option>Phone</option><option>WhatsApp</option><option>Email</option><option>Walk-in</option></select></label><label class="fld"><span>Game drive (people)</span><input type="number" min="0" max="10" name="gd" value="0"></label></div>' +
      '<span class="fld-l">How will they pay?</span><div class="seg"><label><input type="radio" name="m" value="eft" checked><span>EFT</span></label><label><input type="radio" name="m" value="card"><span>Card</span></label><label><input type="radio" name="m" value="cash"><span>Cash</span></label></div>' +
      '<div class="quote-box" data-q></div>',
      'Create booking', function (f) {
        var g = { adults: +fval(f, 'adults') || 0, pens: +fval(f, 'pens') || 0, kids: +fval(f, 'kids') || 0 }, sid = fval(f, 'stand'), a = fval(f, 'ci'), z = fval(f, 'co'), m = $('[name=m]:checked', f).value;
        if (!fval(f, 'first') || !fval(f, 'last')) { toast('Add the guest\'s name'); return false; }
        if (z <= a) { toast('Departure must be after arrival'); return false; }
        if (overlaps(sid, a, z)) { toast('That stand is not free for those nights'); return false; }
        if (!g.adults && !g.pens) { toast('Add at least one adult'); return false; }
        var ex = { gd: +fval(f, 'gd') || 0 }, q = quote(sid, a, z, g, ex);
        var b = { ref: 'KY' + a.slice(2, 4) + '-' + Math.random().toString(36).slice(2, 6).toUpperCase(), created: nowStamp(), source: fval(f, 'source'), guest: { first: fval(f, 'first'), last: fval(f, 'last'), email: fval(f, 'email'), phone: fval(f, 'phone'), consent: false }, stand: sid, ci: a, co: z, adults: g.adults, pens: g.pens, kids: g.kids, vehicles: 1, setup: '', extras: ex, method: m, eft: q.eft, card: q.card, total: m === 'card' ? q.card : q.eft, payments: [], status: 'pending', notes: [], pop: false };
        if (m !== 'eft') b.status = 'confirmed';
        DB.bookings.push(b); DB.bookings.sort(function (x, y) { return x.ci < y.ci ? -1 : 1; });
        log('New ' + b.source.toLowerCase() + ' booking ' + b.ref + ' for ' + guestName(b), b.ref); save(); render(); openBooking(b.ref);
        toast('Booking ' + b.ref + ' created' + (m === 'eft' ? '. Invoice emailed (demo)' : ''));
      }, { wide: true, onOpen: function (f) {
        var u = function () {
          var g = { adults: +fval(f, 'adults') || 0, pens: +fval(f, 'pens') || 0, kids: +fval(f, 'kids') || 0 }, sid = fval(f, 'stand'), a = fval(f, 'ci'), z = fval(f, 'co'), m = $('[name=m]:checked', f).value, box = $('[data-q]', f);
          if (z <= a) { box.innerHTML = '<span class="bad-t">Departure must be after arrival.</span>'; return; }
          var q = quote(sid, a, z, g, { gd: +fval(f, 'gd') || 0 }), free = !overlaps(sid, a, z), st = standById(sid);
          box.innerHTML = (free ? '<span class="pill ok"><i></i>Stand free</span>' : '<span class="pill bad"><i></i>Stand not free</span>') + (g.adults + g.pens + g.kids > st.guests ? ' <span class="pill warn"><i></i>Over ' + st.guests + ' guests</span>' : '') +
            '<div class="qb-row"><span>' + q.nights + ' night' + (q.nights > 1 ? 's' : '') + '</span><span class="price-pair">' + (m === 'card' ? '<b>' + money(q.card) + '</b> <small>card price</small>' : '<s>' + money(q.card) + '</s> <b>' + money(q.eft) + '</b> <small>' + methodLabel(m) + '</small>') + '</span></div>' +
            '<div class="muted small">Deposit ' + depPct() + '%: ' + money(Math.round((m === 'card' ? q.card : q.eft) * depPct() / 100)) + '</div>';
        };
        $$('input,select', f).forEach(function (x) { x.addEventListener('input', u); x.addEventListener('change', u); }); u();
      } });
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
  function rowB(b, extra) {
    var st = standById(b.stand), s = stateOf(b);
    return '<button class="brow" data-open="' + b.ref + '"><span class="brow-st">' + esc(st.name) + '</span><span class="brow-g"><b>' + esc(guestName(b)) + '</b><small>' + people(b) + (people(b) === 1 ? ' guest · ' : ' guests · ') + diff(b.ci, b.co) + (diff(b.ci, b.co) === 1 ? ' night ' : ' nights ') + '· ' + esc(b.setup || '') + '</small></span>' + (extra || pill(s)) + '</button>';
  }
  function vDashboard() {
    var arr = DB.bookings.filter(function (b) { return live(b) && b.ci === TODAY && b.status !== 'pending'; }), dep = DB.bookings.filter(function (b) { return b.co === TODAY && (b.status === 'in' || b.status === 'out'); });
    var tonight = standsBookedOn(TODAY), nT = Object.keys(tonight).length;
    var pend = DB.bookings.filter(function (b) { return b.status === 'pending'; }), pendAmt = pend.reduce(function (a, b) { return a + deposit(b); }, 0);
    var balSoon = DB.bookings.filter(function (b) { return b.status === 'confirmed' && balance(b) > 0 && diff(TODAY, balanceDue(b)) <= 7; }), balAmt = balSoon.reduce(function (a, b) { return a + balance(b); }, 0);
    var month = TODAY.slice(0, 7), recv = 0; DB.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { if (p.d.slice(0, 7) === month) recv += p.amt; }); }); DB.sales.forEach(function (s) { if (s.d.slice(0, 7) === month) recv += s.amt; });
    var h = new Date().getHours();
    var attention = [];
    DB.bookings.forEach(function (b) {
      var s = stateOf(b);
      if (b.isNew) attention.push({ i: 'bell', tone: 'info', t: 'New website booking: <b>' + esc(guestName(b)) + '</b>, ' + esc(standById(b.stand).name) + ', ' + fd(b.ci), ref: b.ref, o: 0 });
      if (s.k === 'pop') attention.push({ i: 'note', tone: 'info', t: 'Proof of payment from <b>' + esc(guestName(b)) + '</b>: check the bank for ' + money(deposit(b)), ref: b.ref, o: 1 });
      if (s.k === 'overdue') attention.push({ i: 'alert', tone: 'bad', t: '<b>' + esc(guestName(b)) + '</b> has not paid the EFT deposit (due ' + fd(depositDue(b)) + '). Remind or release the stand.', ref: b.ref, o: 2 });
      if (s.k === 'baldue' && s.tone === 'bad') attention.push({ i: 'alert', tone: 'bad', t: 'Balance overdue: <b>' + esc(guestName(b)) + '</b> owes ' + money(balance(b)) + ', arriving ' + fdw(b.ci), ref: b.ref, o: 3 });
    });
    var newEnq = DB.threads.filter(function (t) { return t.status === 'open'; });
    if (newEnq.length) attention.push({ i: 'mail', tone: 'warn', t: newEnq.length + ' email' + (newEnq.length > 1 ? 's' : '') + ' waiting for a reply', go: 'enquiries', o: 4 });
    var lowP = shopItems().filter(lowStock); if (lowP.length && can('products')) attention.push({ i: 'box', tone: 'warn', t: 'Running low in the shop: ' + lowP.map(function (p) { return esc(p.label) + ' (' + p.stock + ')'; }).join(', '), go: 'products', o: 6 });
    var noTime = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && !b.drive && b.co >= TODAY && diff(TODAY, b.ci) <= 7; }); if (noTime.length) attention.push({ i: 'car', tone: 'warn', t: noTime.length + ' game drive' + (noTime.length > 1 ? 's' : '') + ' this week still need a time', go: 'drives', o: 5 });
    DB.blocks.forEach(function (k) { if (k.to > TODAY && diff(TODAY, k.from) <= 7) attention.push({ i: 'tent', tone: 'muted', t: '<b>' + esc(standById(k.stand).name) + '</b> blocked ' + fd(k.from) + ' to ' + fd(k.to) + ': ' + esc(k.reason), go: 'stands', o: 5 }); });
    attention.sort(function (a, b) { return a.o - b.o; });
    // occupancy next 30 nights
    var occ = []; for (var i = 0; i < 30; i++) { var d = add(TODAY, i), n = Object.keys(standsBookedOn(d)).length, wk = isWeekendNight(d); occ.push({ label: D(d).getDate(), a: n, tip: fdw(d) + ': ' + n + ' of ' + STANDS.length + ' stands booked (' + Math.round(n / STANDS.length * 100) + '%)', hl: wk }); }
    var woodBags = Object.keys(tonight).filter(function (id) { return standById(id).area !== 'self-sufficient'; }).length;
    var drives = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && b.ci <= TODAY && TODAY < b.co; });
    var ice = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.ice && b.ci === TODAY; }).reduce(function (a, b) { return a + b.extras.ice; }, 0);
    return '<div class="hello"><div><h1>' + (h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening') + ', ' + esc(ME.name) + '</h1><p class="muted">' + fd(TODAY, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }) + ' · ' + nT + ' of ' + STANDS.length + ' stands occupied tonight</p></div><button class="btn" data-act="new">' + ic('plus') + 'New booking</button></div>' +
      '<div class="kpis">' + tile('Arriving today', arr.length, arr.filter(function (b) { return b.status === 'in'; }).length + ' checked in', 'today') + tile('Departing today', dep.length, dep.filter(function (b) { return b.status === 'out'; }).length + ' checked out', 'today') +
      tile('In camp tonight', nT + '<small>/' + STANDS.length + '</small>', Math.round(nT / STANDS.length * 100) + '% occupied', 'calendar') + tile('Awaiting EFT', pend.length, money(pendAmt) + ' in deposits', 'eft', pend.length ? 'warn' : '') +
      tile('Balances due in 7 days', money(balAmt), balSoon.length + ' booking' + (balSoon.length === 1 ? '' : 's'), 'eft') + (can('payments') ? tile('Received this month', money(recv), 'bookings and shop', 'payments', 'ok') : '') + '</div>' +
      '<div class="cols"><section class="card" id="today"><header class="card-h"><h3>Today at camp</h3><div class="tabs" role="tablist"><button class="on" data-tab="arr">Arriving <span>' + arr.length + '</span></button><button data-tab="dep">Departing <span>' + dep.length + '</span></button><button data-tab="in">In camp <span>' + nT + '</span></button></div></header>' +
      '<div data-pane="arr">' + (arr.length ? arr.map(function (b) { return rowB(b, b.status === 'in' ? '<span class="pill ok"><i></i>Checked in</span>' : '<span class="row-act" data-act="checkin" data-ref="' + b.ref + '">' + ic('in') + 'Check in</span>'); }).join('') : '<p class="empty">No arrivals today.</p>') + '</div>' +
      '<div data-pane="dep" hidden>' + (dep.length ? dep.map(function (b) { return rowB(b, b.status === 'out' ? '<span class="pill muted"><i></i>Checked out</span>' : '<span class="row-act" data-act="checkout" data-ref="' + b.ref + '">' + ic('out') + 'Check out</span>'); }).join('') : '<p class="empty">No departures today.</p>') + '</div>' +
      '<div data-pane="in" hidden>' + Object.keys(tonight).map(function (id) { return rowB(tonight[id]); }).join('') + '</div>' +
      '<footer class="card-f"><span>' + ic('fire') + '<b>' + woodBags + '</b> free firewood bags tonight</span><span>' + ic('car') + '<b>' + drives.length + '</b> game drive' + (drives.length === 1 ? '' : 's') + ' booked</span><span>' + ic('ice') + '<b>' + ice + '</b> bags of ice to hand out</span></footer></section>' +
      '<section class="card"><header class="card-h"><h3>Needs attention</h3><span class="count">' + attention.length + '</span></header>' + (attention.length ? '<ul class="attn">' + attention.slice(0, 9).map(function (a) { return '<li><button ' + (a.ref ? 'data-open="' + a.ref + '"' : 'data-go="' + a.go + '"') + '><span class="attn-i ' + a.tone + '">' + ic(a.i) + '</span><span>' + a.t + '</span>' + ic('chev-r', 'chev') + '</button></li>'; }).join('') + '</ul>' : '<p class="empty">All clear. Enjoy the bush!</p>') + '</section></div>' +
      '<div class="cols"><section class="card"><header class="card-h"><h3>Stands booked, next 30 nights</h3><span class="muted small">Weekend nights in bold</span></header>' + colChart(occ, { max: STANDS.length, label: 'Stands booked per night', colA: C_CARD, band: 24 }) + '</section>' +
      '<section class="card"><header class="card-h"><h3>Recent activity</h3></header><ul class="feed">' + DB.log.slice(0, 7).map(function (l) { return '<li' + (l.ref ? ' data-open="' + l.ref + '"' : '') + '><span>' + esc(l.text) + '</span><small>' + esc(l.by) + ' · ' + esc(l.at) + '</small></li>'; }).join('') + '</ul></section></div>';
  }

  var F = { q: '', st: 'upcoming', area: '' };
  function bucket(b) {
    var s = stateOf(b);
    return { pending: s.k === 'pending' || s.k === 'pop' || s.k === 'overdue', baldue: s.k === 'baldue', in: s.k === 'in', cancelled: s.k === 'cancelled', upcoming: live(b) && b.co >= TODAY && b.status !== 'out', past: b.status === 'out' || (b.co < TODAY && live(b)), all: true };
  }
  function vBookings() {
    var groups = [['upcoming', 'Upcoming'], ['pending', 'Awaiting EFT'], ['baldue', 'Balance due'], ['in', 'In camp'], ['past', 'Past'], ['cancelled', 'Cancelled'], ['all', 'All']];
    var counts = {}; groups.forEach(function (g) { counts[g[0]] = 0; }); DB.bookings.forEach(function (b) { var k = bucket(b); groups.forEach(function (g) { if (k[g[0]]) counts[g[0]]++; }); });
    var q = F.q.toLowerCase();
    var list = DB.bookings.filter(function (b) { var st = standById(b.stand); return bucket(b)[F.st] && (!F.area || st.area === F.area) && (!q || (b.ref + ' ' + guestName(b) + ' ' + b.guest.email + ' ' + b.guest.phone + ' ' + st.name).toLowerCase().indexOf(q) >= 0); });
    if (F.st === 'past' || F.st === 'cancelled' || F.st === 'all') list = list.slice().reverse();
    return '<div class="page-h"><div><h1>Bookings</h1><p class="muted">' + list.length + ' shown · card prices include the ' + cardFee() + '% card fee, EFT prices do not</p></div><div class="ph-act"><button class="btn ghost" data-act="csv-bookings">' + ic('download') + 'Export</button><button class="btn" data-act="new">' + ic('plus') + 'New booking</button></div></div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" placeholder="Search name, ref, phone or stand" value="' + esc(F.q) + '" data-f="q" aria-label="Search bookings"></label>' +
      '<select data-f="area" aria-label="Camp area"><option value="">All areas</option>' + Object.keys(AREA_SHORT).map(function (a) { return '<option value="' + a + '"' + (F.area === a ? ' selected' : '') + '>' + AREA_SHORT[a] + '</option>'; }).join('') + '</select></div>' +
      '<div class="chips scroll">' + groups.map(function (g) { return '<button class="chip' + (F.st === g[0] ? ' on' : '') + '" data-fst="' + g[0] + '">' + g[1] + ' <span>' + counts[g[0]] + '</span></button>'; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl"><thead><tr><th>Guest</th><th>Stand</th><th>Dates</th><th>Guests</th><th class="r">Total</th><th class="r">Balance</th><th>Status</th></tr></thead><tbody>' +
      (list.length ? list.map(function (b) {
        var st = standById(b.stand);
        return '<tr data-open="' + b.ref + '" tabindex="0"><td data-l="Guest"><b>' + esc(guestName(b)) + '</b>' + (b.isNew ? ' <span class="new">New</span>' : '') + '<small>' + esc(b.ref) + ' · ' + esc(b.source) + '</small></td><td data-l="Stand">' + esc(st.name) + '<small>' + AREA_SHORT[st.area] + '</small></td>' +
          '<td data-l="Dates">' + fd(b.ci) + ' to ' + fd(b.co) + '<small>' + diff(b.ci, b.co) + ' nights · ' + rel(b.ci) + '</small></td><td data-l="Guests">' + people(b) + '</td>' +
          '<td data-l="Total" class="r">' + money(b.total) + '<small>' + methodLabel(b.method) + (b.method !== 'card' ? ' · card ' + money(b.card) : '') + '</small></td><td data-l="Balance" class="r">' + (balance(b) ? money(balance(b)) : '<span class="muted">0</span>') + '</td><td data-l="Status">' + pill(stateOf(b)) + '</td></tr>';
      }).join('') : '<tr><td colspan="7" class="empty">No bookings match.</td></tr>') + '</tbody></table></div>';
  }

  function vEft() {
    var pend = DB.bookings.filter(function (b) { return b.status === 'pending'; });
    var pop = pend.filter(function (b) { return b.pop; }), over = pend.filter(function (b) { return !b.pop && TODAY > depositDue(b); }), wait = pend.filter(function (b) { return !b.pop && TODAY <= depositDue(b); });
    var bal = DB.bookings.filter(function (b) { return b.status === 'confirmed' && b.method !== 'card' && balance(b) > 0 && diff(TODAY, balanceDue(b)) <= 14; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    function card(b, kind) {
      var amt = kind === 'bal' ? balance(b) : deposit(b), due = kind === 'bal' ? balanceDue(b) : depositDue(b), left = diff(TODAY, due);
      return '<article class="eft-card ' + kind + '"><div class="eft-top" data-open="' + b.ref + '"><div><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + ' · ' + fd(b.ci) + ' to ' + fd(b.co) + '</small></div><div class="eft-amt"><b>' + money(amt) + '</b><small>' + (kind === 'bal' ? 'balance' : depPct() + '% deposit') + ' · card ' + money(kind === 'bal' ? b.card - paid(b) : Math.round(b.card * depPct() / 100)) + '</small></div></div>' +
        '<div class="eft-due ' + (left < 0 ? 'bad-t' : left <= 1 ? 'warn-t' : '') + '">' + ic('clock') + (left < 0 ? 'Overdue by ' + -left + ' day' + (-left > 1 ? 's' : '') : 'Due ' + fd(due) + ' (' + rel(due) + ')') + (b.pop ? '<span class="info-t pop-line">' + ic('note') + 'Proof of payment received' + ((b.pops || []).length ? ' ' + whenSaid(b.pops[b.pops.length - 1].at) + ', check the bank:' : ': check the bank') + '</span>' + popChips(b) : '') + '</div>' +
        '<div class="eft-act"><button class="btn sm" data-act="pay" data-ref="' + b.ref + '">' + ic('check') + 'Money is in</button><button class="btn sm ghost" data-act="remind" data-ref="' + b.ref + '">' + ic('send') + 'Remind</button>' + (kind === 'over' ? '<button class="btn sm ghost danger-t" data-act="release" data-ref="' + b.ref + '">' + ic('x') + 'Release stand</button>' : '') + '</div></article>';
    }
    var sec = function (title, sub, list, kind) { return '<section class="eft-sec"><h3>' + title + ' <span class="count">' + list.length + '</span></h3><p class="muted small">' + sub + '</p>' + (list.length ? '<div class="eft-grid">' + list.map(function (b) { return card(b, kind); }).join('') + '</div>' : '<p class="empty">Nothing here.</p>') + '</section>'; };
    return '<div class="page-h"><div><h1>EFT payments</h1><p class="muted">Guests who chose EFT pay the normal price (no ' + cardFee() + '% card fee). Match their payments here.</p></div></div>' +
      '<div class="card match"><label class="search big">' + ic('search') + '<input data-match placeholder="Paste the reference from the bank statement, e.g. KY26-4F2K" aria-label="Bank reference"></label><div data-match-out class="muted small">Tip: guests use their booking reference when they pay, so you can paste it straight from the bank app.</div></div>' +
      sec('Proof of payment received', 'The guest says they paid. Check the bank, then confirm.', pop, 'pop') +
      sec('Waiting for the deposit', 'Invoice sent. The deposit secures the booking within ' + num('Booking rules', 'Deposit due within days of invoice', 5) + ' days.', wait, 'wait') +
      sec('Overdue', 'Past the deadline. Send a last reminder or release the stand for other guests.', over, 'over') +
      sec('EFT balances due soon', 'Balances are due ' + num('Booking rules', 'Balance due days before arrival', 7) + ' days before arrival.', bal, 'bal');
  }

  var CAL = { start: null, days: 21 };
  function vCalendar() {
    if (!CAL.start) CAL.start = add(TODAY, -2);
    var days = window.innerWidth < 700 ? 10 : CAL.days, s = CAL.start, e = add(s, days), cols = [];
    for (var i = 0; i < days; i++) cols.push(add(s, i));
    var head = '<div class="cal-row cal-head"><div class="cal-name">Stand</div>' + cols.map(function (d) { var dd = D(d); return '<div class="cal-day' + (d === TODAY ? ' today' : '') + (isWeekendNight(d) ? ' wk' : '') + '"><small>' + dd.toLocaleDateString('en-ZA', { weekday: 'short' }) + '</small><b>' + dd.getDate() + '</b></div>'; }).join('') + '</div>';
    var rows = ['fenced', 'unfenced', 'self-sufficient'].map(function (a) {
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
        return '<div class="cal-row"><div class="cal-name"><b>' + esc(st.name) + '</b><small>' + st.guests + ' guests</small></div>' + cells + bars + blocks + '</div>';
      }).join('');
    }).join('');
    return '<div class="page-h"><div><h1>Calendar</h1><p class="muted">' + fd(s, { day: 'numeric', month: 'long' }) + ' to ' + fd(add(e, -1), { day: 'numeric', month: 'long', year: 'numeric' }) + ' · tap an empty night to book it</p></div><div class="ph-act"><button class="icon-btn" data-cal="-7" aria-label="Previous week">' + ic('chev-l') + '</button><button class="btn ghost sm" data-cal="0">Today</button><button class="icon-btn" data-cal="7" aria-label="Next week">' + ic('chev-r') + '</button></div></div>' +
      '<div class="legend"><span><i class="lg info"></i>Deposit paid</span><span><i class="lg ok"></i>Paid in full / in camp</span><span><i class="lg warn"></i>Awaiting EFT or balance due</span><span><i class="lg bad"></i>Overdue</span><span><i class="lg block"></i>Blocked</span></div>' +
      '<div class="card flush cal-wrap"><div class="cal" style="--days:' + days + '">' + head + rows + '</div></div>';
  }

  function guestsList() {
    var map = {};
    DB.bookings.forEach(function (b) {
      var k = b.guest.email || guestName(b);
      var g = map[k] = map[k] || { name: guestName(b), email: b.guest.email, phone: b.guest.phone, consent: b.guest.consent, stays: 0, nights: 0, spent: 0, last: '', next: '', refs: [], pens: false, gd: false };
      g.refs.push(b.ref);
      if (!live(b)) return;
      g.stays++; g.nights += diff(b.ci, b.co); g.spent += paid(b); if (b.pens) g.pens = true; if (b.extras && b.extras.gd) g.gd = true;
      if (b.co <= TODAY && b.ci > g.last) g.last = b.ci; if (b.ci >= TODAY && (!g.next || b.ci < g.next)) g.next = b.ci;
    });
    return Object.keys(map).map(function (k) { return map[k]; }).sort(function (a, b) { return b.spent - a.spent; });
  }
  var GQ = '';
  function vGuests() {
    var all = guestsList(), q = GQ.toLowerCase(), list = all.filter(function (g) { return !q || (g.name + ' ' + g.email + ' ' + g.phone).toLowerCase().indexOf(q) >= 0; });
    return '<div class="page-h"><div><h1>Guests</h1><p class="muted">' + all.length + ' guests · ' + all.filter(function (g) { return g.stays > 1; }).length + ' returning · ' + all.filter(function (g) { return g.consent; }).length + ' agreed to news and specials</p></div><div class="ph-act"><button class="btn ghost" data-act="csv-guests">' + ic('download') + 'Export mailing list</button></div></div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-gq placeholder="Search guests" value="' + esc(GQ) + '" aria-label="Search guests"></label></div>' +
      '<div class="card flush"><table class="tbl"><thead><tr><th>Guest</th><th>Contact</th><th class="r">Stays</th><th class="r">Nights</th><th class="r">Spent</th><th>Last / next visit</th><th>Tags</th></tr></thead><tbody>' +
      list.map(function (g) {
        var tags = (g.stays > 1 ? '<span class="tag">Returning</span>' : '') + (g.pens ? '<span class="tag">Pensioner</span>' : '') + (g.gd ? '<span class="tag">Game drives</span>' : '') + (g.consent ? '<span class="tag ok">Mailing list</span>' : '');
        return '<tr data-guest="' + esc(g.email) + '" tabindex="0"><td data-l="Guest"><b>' + esc(g.name) + '</b></td><td data-l="Contact">' + esc(g.phone) + '<small>' + esc(g.email) + '</small></td><td data-l="Stays" class="r">' + g.stays + '</td><td data-l="Nights" class="r">' + g.nights + '</td><td data-l="Spent" class="r">' + money(g.spent) + '</td><td data-l="Visits">' + (g.last ? fd(g.last, { day: 'numeric', month: 'short', year: 'numeric' }) : '<span class="muted">None yet</span>') + (g.next ? '<small>Next: ' + fd(g.next) + '</small>' : '') + '</td><td data-l="Tags">' + (tags || '<span class="muted">None</span>') + '</td></tr>';
      }).join('') + '</tbody></table></div>';
  }
  function openGuest(email) {
    var g = guestsList().filter(function (x) { return x.email === email; })[0]; if (!g) return;
    var bs = DB.bookings.filter(function (b) { return b.guest.email === email; });
    modal(esc(g.name), '<div class="chips"><a class="chip" href="tel:' + esc(g.phone.replace(/\s/g, '')) + '">' + ic('phone') + esc(g.phone) + '</a><a class="chip" href="mailto:' + esc(g.email) + '">' + ic('mail') + esc(g.email) + '</a></div>' +
      '<div class="mini-kpis"><div><b>' + g.stays + '</b><span>stays</span></div><div><b>' + g.nights + '</b><span>nights</span></div><div><b>' + money(g.spent) + '</b><span>spent</span></div></div>' +
      '<label class="check"><input type="checkbox" name="consent"' + (g.consent ? ' checked' : '') + '><span>Agreed to receive news and specials (POPIA consent)</span></label>' +
      '<h5>Bookings</h5><div class="list">' + bs.map(function (b) { return '<button type="button" class="brow" data-open="' + b.ref + '"><span class="brow-st">' + esc(standById(b.stand).name) + '</span><span class="brow-g"><b>' + fd(b.ci, { day: 'numeric', month: 'short', year: 'numeric' }) + '</b><small>' + diff(b.ci, b.co) + ' nights · ' + money(b.total) + '</small></span>' + pill(stateOf(b)) + '</button>'; }).join('') + '</div>',
      'Save', function (f) { var c = fval(f, 'consent'); DB.bookings.forEach(function (b) { if (b.guest.email === email) b.guest.consent = c; }); save(); render(); toast('Guest updated'); }, { noFocus: true });
  }

  function vStands() {
    var tonight = standsBookedOn(TODAY);
    return '<div class="page-h"><div><h1>Stands & blocks</h1><p class="muted">' + STANDS.length + ' stands. Add, copy or remove stands and change their photos and details.</p></div><div class="ph-act"><button class="btn ghost" data-act="block">' + ic('lock') + 'Block dates</button><button class="btn" data-act="stand-add">' + ic('plus') + 'Add a stand</button></div></div>' +
      '<section class="card"><header class="card-h"><h3>Blocked dates</h3><span class="muted small">Maintenance, owner holds, private events</span></header>' + (DB.blocks.length ? '<ul class="feed">' + DB.blocks.map(function (k) { return '<li><span><b>' + esc(standById(k.stand).name) + '</b> · ' + fd(k.from) + ' to ' + fd(k.to) + ' · ' + esc(k.reason) + '</span><button class="btn sm ghost" data-unblock="' + k.id + '">Remove</button></li>'; }).join('') + '</ul>' : '<p class="empty">No blocks.</p>') + '</section>' +
      ['fenced', 'unfenced', 'self-sufficient'].map(function (a) {
        var list = STANDS.filter(function (s) { return s.area === a; });
        return '<h3 class="grp">' + AREA_SHORT[a] + ' <small>' + list.length + '</small></h3><div class="stand-grid">' + list.map(function (s) {
          var b = tonight[s.id], nxt = DB.bookings.filter(function (x) { return live(x) && x.stand === s.id && x.ci > TODAY; })[0], closed = DB.closed[s.id], n = (s.photos || []).length;
          return '<article class="stand' + (closed ? ' closed' : '') + '"><button type="button" class="stand-ph" data-act="stand-edit" data-ref="' + esc(s.id) + '" aria-label="Edit ' + esc(s.name) + '">' + (n ? '<img src="' + esc(imgSrc(s.photos[0])) + '" alt="" loading="lazy">' : '<span class="ph">No photo yet</span>') + '<span class="ph-n">' + n + ' photo' + (n === 1 ? '' : 's') + '</span>' + (s.status === 'new' ? '<span class="ph-new">New</span>' : '') + '</button>' +
            '<div class="stand-b"><b>' + esc(s.name) + '</b><small>' + s.guests + ' guests' + (s.setups ? ' · ' + esc(s.setups) : '') + '</small>' +
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
      '<div class="grid2"><label class="fld"><span>Most guests</span><input name="guests" inputmode="numeric" value="' + (src ? src.guests : 8) + '"></label><label class="fld"><span>Setups</span><input name="setups" value="' + val('setups') + '" placeholder="1-2 trailers or tents"></label></div>' +
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
      var data = { name: nm, area: ar, areaInfo: like ? like.areaInfo : null, guests: parseInt(fval(f, 'guests'), 10) || 8, setups: fval(f, 'setups'), feel: fval(f, 'feel'), highlights: fval(f, 'hl').split(',').map(function (h) { return h.trim(); }).filter(Boolean), description: fval(f, 'desc'), photos: EDIT.photos.slice(), status: fval(f, 'isnew') ? 'new' : 'open' };
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
    }, { wide: true, noFocus: !isNew });
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
        if (overlaps(sid, a, z)) { toast('There is a booking in those dates. Move it first.'); return false; }
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
    DB.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { out.push({ d: p.d, t: '', kind: p.amt < 0 ? 'refund' : 'booking', type: p.amt < 0 ? 'Refund' : p.type, who: guestName(b), what: standById(b.stand).name + ' · ' + b.ref, m: p.m, amt: p.amt, ref: b.ref, fee: p.m === 'card' && p.amt > 0 ? fee(p.amt) : 0, note: p.ref || '' }); }); });
    receipts().forEach(function (r) { if (r.m === 'bill') return; out.push({ d: r.d, t: r.t, kind: r.amt < 0 ? 'refund' : 'shop', type: r.amt < 0 ? 'Shop refund' : 'Shop sale', who: r.stand ? r.stand + (r.guest ? ' · ' + r.guest : '') : 'Walk-in', what: r.summary, m: r.m, amt: r.amt, sid: r.sid, fee: r.m === 'card' && r.amt > 0 ? fee(r.amt) : 0 }); });
    return out.sort(function (a, b) { return (a.d + (a.t || '99')) < (b.d + (b.t || '99')) ? 1 : -1; });
  }
  // money still to come in, soonest due first
  function receivables() {
    return DB.bookings.filter(function (b) { return live(b) && b.status !== 'out' && balance(b) > 0; }).map(function (b) {
      var pend = b.status === 'pending', due = pend ? depositDue(b) : balanceDue(b);
      return { b: b, what: pend ? 'Deposit' : 'Balance', due: due, amt: pend ? deposit(b) : balance(b), late: due < TODAY };
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
    if (src && /pdf/.test(a.type || '')) { try { var bin = atob(src.split(',')[1]), arr = new Uint8Array(bin.length); for (var i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i); src = URL.createObjectURL(new Blob([arr], { type: 'application/pdf' })); } catch (e) {} }
    var body = src ? (/^image/.test(a.type || '') ? '<img class="att-img" src="' + src + '" alt="' + esc(a.name) + '">' : '<iframe class="att-pdf" src="' + src + '" title="' + esc(a.name) + '"></iframe>') :
      '<div class="att-demo">' + ic('note') + '<div><b>' + esc(a.name) + '</b><p class="muted small">Made-up demo file, so there is nothing to open. In the live version the real document opens here.</p></div></div>';
    modal(esc(a.name), body + '<p class="muted small">' + [a.size ? kb(a.size) : '', a.via || '', a.at || ''].filter(Boolean).map(esc).join(' · ') + '</p>', null, null, { wide: true, noFocus: true });
  }
  function popChips(b) { return (b.pops || []).length ? '<div class="att-row">' + b.pops.map(function (a, i) { return attChip(a, 'b:' + b.ref + ':' + i); }).join('') + '</div>' : ''; }

  /* =========================================================
     Inbox: every email with a guest, kept as one conversation
     ========================================================= */
  var IN = { box: 'open', id: null, q: '' };
  var BOXES = [['open', 'Needs reply'], ['waiting', 'Waiting on guest'], ['closed', 'Closed'], ['all', 'All']];
  var QUICK = [
    ['We will check and come back to you', function () { return 'Thank you for your message. Let me check and come back to you today.'; }],
    ['Banking details for EFT', function () { return 'You can pay by EFT to:\nFNB · Kyleu Bush Camp · Account 62000000000 · Branch 250655\n\nPlease use your booking reference so we can match the payment, then upload your proof of payment at www.kyleu.co.za/pop.html (or simply reply to this email with it attached).'; }],
    ['Directions', function () { return 'Enter Dinokeng at Tau Gate, follow the main road for 4.8 km, turn right onto Kaallaagte Road and continue 2 km to camp. Check-in is from 12:00.'; }],
    ['Game drives', function () { return 'Our guided game drives leave at 06:00 and 15:30 and take about 2 hours. It is ' + money(num('Game drives', 'Game drive 3 or more people per person', 400)) + ' per person for 3 or more people, ' + money(num('Game drives', 'Game drive 2 people per person', 450)) + ' per person for 2, or ' + money(num('Game drives', 'Game drive 1 person', 900)) + ' for a private drive.'; }],
    ['Pensioner rate', function () { return 'The pensioner rate of ' + money(num('Ablution stands', 'Pensioner weekday per person per night', 115)) + ' per person per night applies to Monday to Thursday nights. Sunday nights and weekends are charged at the normal rate.'; }],
    ['Proof of payment received', function () { return 'Thank you, we have received your proof of payment. We will confirm your booking as soon as the money reflects in our account (usually within 1 working day).'; }]
  ];
  function thrById(id) { return DB.threads.filter(function (t) { return t.id === id; })[0]; }
  function lastMsg(t) { return t.msgs[t.msgs.length - 1]; }
  // emails sent from a booking go into that booking's conversation
  function logEmail(b, subject, body) {
    var t = DB.threads.filter(function (x) { return x.ref === b.ref && x.status !== 'closed'; })[0];
    if (!t) { t = { id: uid('t'), subject: subject, name: guestName(b), email: b.guest.email, phone: b.guest.phone, status: 'waiting', unread: false, ref: b.ref, msgs: [] }; DB.threads.push(t); }
    t.msgs.push({ from: 'staff', by: ME.name, at: nowStamp(), body: body, att: [] }); t.status = 'waiting';
    return t;
  }
  function vEnquiries() {
    var all = DB.threads.slice().sort(function (a, b) { return lastMsg(a).at < lastMsg(b).at ? 1 : -1; });
    var cnt = {}; BOXES.forEach(function (x) { cnt[x[0]] = all.filter(function (t) { return x[0] === 'all' || t.status === x[0]; }).length; });
    var q = IN.q.toLowerCase();
    var list = all.filter(function (t) { return (IN.box === 'all' || t.status === IN.box || t.id === IN.id) && (!q || (t.name + ' ' + t.email + ' ' + t.subject + ' ' + t.ref + ' ' + t.msgs.map(function (m) { return m.body; }).join(' ')).toLowerCase().indexOf(q) >= 0); });
    var t = IN.id ? thrById(IN.id) : null;
    return '<div class="page-h"><div><h1>Inbox</h1><p class="muted">Every email with a guest, kept together as one conversation. Replies go from info@kyleu.co.za.</p></div><div class="ph-act"><button class="btn" data-act="mail-new">' + ic('plus') + 'New email</button></div></div>' +
      '<div class="mail' + (t ? ' reading' : '') + '"><section class="card flush mail-list"><div class="mail-tools"><label class="search">' + ic('search') + '<input type="search" data-inq placeholder="Search name, subject or booking" value="' + esc(IN.q) + '" aria-label="Search emails"></label>' +
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
        DB.threads.push(t); IN.id = t.id; IN.box = 'waiting'; log('Emailed ' + t.name + ': ' + s, t.ref); save(); render(); toast('Email sent to ' + esc(to) + ' (demo)');
      }, { wide: true });
  }

  /* =========================================================
     Payments: a ledger of every transaction, plus money still owed
     ========================================================= */
  var PAYF = { tab: 'tx', range: 'this_month', type: '', m: '', q: '', lim: 120 };
  function vPayments() {
    var rg = simpleRange(PAYF.range), q = PAYF.q.toLowerCase(), owed = receivables();
    var inRange = allTx().filter(function (x) { return x.d >= rg[0] && x.d <= rg[1]; });
    var sum = function (f) { return inRange.filter(f).reduce(function (a, x) { return a + x.amt; }, 0); };
    var gross = sum(function (x) { return x.amt > 0; }), refunds = -sum(function (x) { return x.amt < 0; });
    var byM = { card: sum(function (x) { return x.m === 'card' && x.amt > 0; }), eft: sum(function (x) { return x.m === 'eft' && x.amt > 0; }), cash: sum(function (x) { return x.m === 'cash' && x.amt > 0; }) };
    var feeIn = inRange.reduce(function (a, x) { return a + x.fee; }, 0), prov = Math.round(byM.card * (DB.settings.providerFee || 2.95) / 100);
    var owedTot = owed.reduce(function (a, o) { return a + o.amt; }, 0);
    var head = '<div class="page-h"><div><h1>Payments</h1><p class="muted">Every rand that came in or went out. Click a line to open the booking or the shop receipt.</p></div><div class="ph-act">' + (PAYF.tab === 'tx' ? rangeSelect('data-payr', PAYF.range) + '<button class="btn ghost" data-act="csv-pay">' + ic('download') + 'Export</button>' : '') + '</div></div>' +
      '<div class="rp-tabs page-tabs"><button class="' + (PAYF.tab === 'tx' ? 'on' : '') + '" data-paytab="tx">Transactions</button><button class="' + (PAYF.tab === 'owed' ? 'on' : '') + '" data-paytab="owed">Still to come in <span class="tab-n">' + money(owedTot) + '</span></button></div>';
    if (PAYF.tab === 'owed') return head + owedHTML(owed);
    var list = inRange.filter(function (x) { return (!PAYF.type || x.kind === PAYF.type) && (!PAYF.m || x.m === PAYF.m) && (!q || (x.who + ' ' + x.what + ' ' + (x.ref || '') + ' ' + x.amt).toLowerCase().indexOf(q) >= 0); });
    var pct = function (v) { return gross ? Math.max(0, v / gross * 100) : 0; };
    var days = [], byDay = {};
    list.slice(0, PAYF.lim).forEach(function (x) { if (!byDay[x.d]) { byDay[x.d] = []; days.push(x.d); } byDay[x.d].push(x); });
    var dayTot = {}; list.forEach(function (x) { dayTot[x.d] = (dayTot[x.d] || 0) + x.amt; });
    return head +
      '<section class="card sum-card"><div class="sum-grid"><div><span>Money in</span><b>' + money(gross) + '</b><small>' + inRange.filter(function (x) { return x.amt > 0; }).length + ' payments and sales</small></div><div><span>Refunds</span><b class="' + (refunds ? 'bad-t' : '') + '">' + money(-refunds) + '</b><small>' + inRange.filter(function (x) { return x.amt < 0; }).length + ' refunds</small></div><div><span>Net</span><b>' + money(gross - refunds) + '</b><small>' + PAY_RANGES.filter(function (o) { return o[0] === PAYF.range; })[0][1].toLowerCase() + '</small></div>' +
      '<div><span>Card fee covered</span><b class="' + (feeIn >= prov ? 'ok-t' : 'warn-t') + '">' + money(feeIn) + '</b><small>The card company charges about ' + money(prov) + '</small></div></div>' +
      '<div class="split" role="img" aria-label="Card ' + money(byM.card) + ', EFT ' + money(byM.eft) + ', cash ' + money(byM.cash) + '"><span class="card-s" style="width:' + pct(byM.card) + '%"></span><span class="eft-s" style="width:' + pct(byM.eft) + '%"></span><span class="cash-s" style="width:' + pct(byM.cash) + '%"></span></div>' +
      '<div class="split-key"><span><i class="mth-i pm-card"></i>Card <b>' + money(byM.card) + '</b> ' + Math.round(pct(byM.card)) + '%</span><span><i class="mth-i pm-eft"></i>EFT <b>' + money(byM.eft) + '</b> ' + Math.round(pct(byM.eft)) + '%</span><span><i class="mth-i pm-cash"></i>Cash <b>' + money(byM.cash) + '</b> ' + Math.round(pct(byM.cash)) + '%</span></div></section>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-payq placeholder="Search name, booking ref or amount" value="' + esc(PAYF.q) + '" aria-label="Search payments"></label>' +
      '<select data-paym aria-label="Payment method"><option value="">All methods</option><option value="card"' + (PAYF.m === 'card' ? ' selected' : '') + '>Card</option><option value="eft"' + (PAYF.m === 'eft' ? ' selected' : '') + '>EFT</option><option value="cash"' + (PAYF.m === 'cash' ? ' selected' : '') + '>Cash</option></select></div>' +
      '<div class="chips">' + [['', 'Everything'], ['booking', 'Booking payments'], ['shop', 'Shop sales'], ['refund', 'Refunds']].map(function (o) { return '<button class="chip' + (PAYF.type === o[0] ? ' on' : '') + '" data-payt="' + o[0] + '">' + o[1] + ' <span>' + inRange.filter(function (x) { return !o[0] || x.kind === o[0]; }).length + '</span></button>'; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl ledger"><thead><tr><th>Time</th><th>Description</th><th>Type</th><th>Method</th><th class="r">Amount</th></tr></thead><tbody>' +
      (days.length ? days.map(function (d) {
        return '<tr class="day"><td colspan="4">' + dayLabel(d) + '</td><td class="r">' + money(dayTot[d]) + '</td></tr>' + byDay[d].map(function (x) {
          return '<tr ' + (x.ref ? 'data-open="' + x.ref + '"' : 'data-sale="' + x.sid + '"') + ' tabindex="0"><td data-l="Time" class="muted">' + (x.t || '') + '</td><td data-l="Description"><b>' + esc(x.who) + '</b><small>' + esc(x.what) + '</small></td><td data-l="Type"><span class="tag' + (x.amt < 0 ? ' bad' : x.kind === 'shop' ? ' shop' : '') + '">' + esc(x.type) + '</span></td><td data-l="Method"><span class="mth pm-' + x.m + '"><i></i>' + methodLabel(x.m) + '</span></td><td data-l="Amount" class="r amt' + (x.amt < 0 ? ' bad-t' : '') + '">' + money(x.amt) + '</td></tr>';
        }).join('');
      }).join('') : '<tr><td colspan="5" class="empty">No payments match.</td></tr>') + '</tbody></table>' +
      (list.length > PAYF.lim ? '<div class="more"><button class="btn ghost" data-act="pay-more">Show more (' + (list.length - PAYF.lim) + ' left)</button></div>' : '') + '</div>';
  }
  function owedHTML(owed) {
    var late = owed.filter(function (o) { return o.late; }), soon = owed.filter(function (o) { return !o.late && diff(TODAY, o.due) <= 7; }), later = owed.filter(function (o) { return !o.late && diff(TODAY, o.due) > 7; });
    var tot = function (l) { return money(l.reduce(function (a, o) { return a + o.amt; }, 0)); };
    var rows = function (l) { return l.map(function (o) { var b = o.b, st = standById(b.stand); return '<tr data-open="' + b.ref + '" tabindex="0"><td data-l="Guest"><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + '</small></td><td data-l="Stay">' + esc(st.name) + '<small>' + fd(b.ci) + ' to ' + fd(b.co) + '</small></td><td data-l="For">' + o.what + '<small>Pays by ' + methodLabel(b.method) + '</small></td><td data-l="Due" class="' + (o.late ? 'bad-t' : '') + '">' + fd(o.due) + '<small>' + (o.late ? 'Overdue ' + -diff(TODAY, o.due) + ' days' : rel(o.due)) + '</small></td><td data-l="Amount" class="r amt">' + money(o.amt) + '</td><td class="r row-btn"><button class="btn sm ghost" data-act="remind" data-ref="' + b.ref + '">' + ic('send') + 'Remind</button><button class="btn sm" data-act="pay" data-ref="' + b.ref + '">Record payment</button></td></tr>'; }).join(''); };
    var sec = function (title, l) { return l.length ? '<tr class="day"><td colspan="4">' + title + ' · ' + l.length + '</td><td class="r">' + tot(l) + '</td><td></td></tr>' + rows(l) : ''; };
    return '<div class="kpis">' + tile('Overdue', tot(late), late.length + ' booking' + (late.length === 1 ? '' : 's'), null, late.length ? 'warn' : 'ok') + tile('Due in the next 7 days', tot(soon), soon.length + ' booking' + (soon.length === 1 ? '' : 's')) + tile('Due later', tot(later), later.length + ' booking' + (later.length === 1 ? '' : 's')) + '</div>' +
      '<div class="card flush"><table class="tbl ledger owed"><thead><tr><th>Guest</th><th>Stay</th><th>For</th><th>Due</th><th class="r">Amount</th><th></th></tr></thead><tbody>' +
      (owed.length ? sec('Overdue', late) + sec('Due in the next 7 days', soon) + sec('Due later', later) : '<tr><td colspan="6" class="empty">Nothing owed. Everyone has paid.</td></tr>') + '</tbody></table></div>' +
      '<p class="demo-note">' + ic('info') + 'Deposits are due ' + num('Booking rules', 'Deposit due within days of invoice', 5) + ' days after the invoice, balances ' + num('Booking rules', 'Balance due days before arrival', 7) + ' days before arrival.</p>';
  }

  /* =========================================================
     Shop: a till like Square or Yoco, and the sales history
     ========================================================= */
  var SHOP = { tab: 'till', cat: '', q: '', who: '', range: 'today' };
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
    var here = bookingsHere(), who = SHOP.who ? byRef(SHOP.who) : null, dis = lines.length ? '' : ' disabled';
    var todays = receipts().filter(function (r) { return r.d === TODAY && r.amt > 0; });
    return '<div class="pos-wrap"><section class="card pos-cat"><div class="pos-tools"><label class="search">' + ic('search') + '<input type="search" data-shopq placeholder="Search products" value="' + esc(SHOP.q) + '" aria-label="Search products"></label></div>' +
      '<div class="chips scroll"><button class="chip' + (!SHOP.cat ? ' on' : '') + '" data-pcat="">All</button>' + cats.map(function (c) { return '<button class="chip' + (SHOP.cat === c ? ' on' : '') + '" data-pcat="' + esc(c) + '">' + esc(c) + '</button>'; }).join('') + '</div>' +
      '<div class="pos">' + shown.map(function (p) {
        var left = p.stock == null ? null : p.stock - (CART[p.id] || 0), out = left !== null && left <= 0;
        return '<button class="pos-it' + (CART[p.id] ? ' on' : '') + '" data-add="' + p.id + '"' + (out ? ' disabled' : '') + '><b>' + esc(p.label) + '</b><span class="pos-p">' + money(p.amount) + '<small>Card ' + money(toCard(p.amount)) + '</small></span>' + (left !== null ? '<span class="pos-stock' + (left <= (p.lowAt || 5) ? ' low' : '') + '">' + (out ? 'Sold out' : left + ' left') + '</span>' : '') + (CART[p.id] ? '<em>' + CART[p.id] + '</em>' : '') + '</button>';
      }).join('') + (shown.length ? '' : '<p class="empty">No products match.</p>') + '</div></section>' +
      '<aside class="card pos-sale"><header class="card-h"><h3>Current sale</h3>' + (lines.length ? '<button class="btn ghost sm" data-act="cart-clear">Clear</button>' : '') + '</header>' +
      (lines.length ? '<div class="sale-lines">' + lines.map(function (id) { var p = prodBy(id); return '<div class="sl"><div class="sl-n"><b>' + esc(p.label) + '</b><small>' + money(p.amount) + ' each</small></div><div class="qty"><button class="icon-btn sm" data-rem="' + id + '" aria-label="One less">' + ic('minus') + '</button><span>' + CART[id] + '</span><button class="icon-btn sm" data-add="' + id + '" aria-label="One more">' + ic('plus') + '</button></div><b class="sl-t">' + money(p.amount * CART[id]) + '</b></div>'; }).join('') + '</div>' : '<div class="sale-empty">' + ic('cart') + '<p>Tap a product to add it to the sale.</p></div>') +
      '<label class="fld"><span>Who is it for?</span><select data-who><option value="">Walk-in customer (pays now)</option>' + here.map(function (b) { return '<option value="' + b.ref + '"' + (SHOP.who === b.ref ? ' selected' : '') + '>' + esc(standById(b.stand).name + ' · ' + guestName(b)) + '</option>'; }).join('') + '</select></label>' +
      '<div class="sale-tot"><div><span>Cash or EFT</span><b>' + money(tot(false)) + '</b></div><div class="muted"><span>Card (+' + cardFee() + '%)</span><b>' + money(tot(true)) + '</b></div></div>' +
      '<div class="pay-btns"><button class="btn" data-sell="cash"' + dis + '>' + ic('cash') + 'Cash ' + money(tot(false)) + '</button><button class="btn blue" data-sell="card"' + dis + '>' + ic('card') + 'Card ' + money(tot(true)) + '</button>' + (who ? '<button class="btn ghost full" data-sell="bill"' + dis + '>' + ic('list') + 'Add to ' + esc(standById(who.stand).name) + '\'s bill</button>' : '') + '</div>' +
      (who ? '<p class="muted small">"Add to bill" puts it on ' + esc(guestName(who)) + '\'s booking. They pay it with their balance.</p>' : '') + '</aside></div>' +
      (lines.length ? '<button class="cart-bar" data-act="to-sale">' + ic('cart') + '<span>' + lines.reduce(function (a, id) { return a + CART[id]; }, 0) + ' item' + (lines.reduce(function (a, id) { return a + CART[id]; }, 0) === 1 ? '' : 's') + ' · <b>' + money(tot(false)) + '</b></span><span>View sale</span></button>' : '') +
      '<div class="today-strip">' + ic('clock') + '<span>Today so far: <b>' + todays.length + ' sale' + (todays.length === 1 ? '' : 's') + '</b>, <b>' + money(todays.reduce(function (a, r) { return a + r.amt; }, 0)) + '</b></span><button class="btn ghost sm" data-shoptab="sales">See all sales</button></div>';
  }
  function sell(m) {
    var lines = Object.keys(CART).filter(function (id) { return CART[id] > 0 && prodBy(id); }); if (!lines.length) return;
    var b = SHOP.who ? byRef(SHOP.who) : null; if (m === 'bill' && !b) return;
    var sid = uid('S'), t = hhmm(), total = 0, eftT = 0, cardT = 0;
    lines.forEach(function (id) {
      var p = prodBy(id), q = CART[id], e = p.amount * q, c = toCard(p.amount) * q, amt = m === 'card' ? c : m === 'bill' ? (b.method === 'card' ? c : e) : e;
      total += amt; eftT += e; cardT += c;
      DB.sales.push({ sid: sid, d: TODAY, t: t, item: p.label, pid: p.id, qty: q, m: m, amt: amt, stand: b ? standById(b.stand).name : '', ref: b ? b.ref : '', by: ME.name });
      if (p.stock != null) p.stock = Math.max(0, p.stock - q);
    });
    if (m === 'bill') { b.charges = b.charges || []; b.charges.push({ d: TODAY, desc: 'Shop: ' + lines.map(function (id) { return CART[id] + ' × ' + prodBy(id).label; }).join(', '), e: eftT, c: cardT, sid: sid }); b.eft += eftT; b.card += cardT; b.total = b.method === 'card' ? b.card : b.eft; }
    CART = {}; SHOP.who = ''; log('Shop sale ' + money(total) + ' (' + saleMethod(m) + ')' + (b ? ' for ' + guestName(b) : ''), b ? b.ref : ''); save(); render();
    toast(m === 'bill' ? money(total) + ' added to ' + esc(guestName(b)) + '\'s bill' : 'Sale of ' + money(total) + ' recorded (' + saleMethod(m) + ')');
  }
  function salesHTML() {
    var rg = simpleRange(SHOP.range), rs = receipts().filter(function (r) { return r.d >= rg[0] && r.d <= rg[1]; });
    var sales = rs.filter(function (r) { return r.amt > 0; }), refunds = rs.filter(function (r) { return r.amt < 0; });
    var total = rs.reduce(function (a, r) { return a + r.amt; }, 0), items = sales.reduce(function (a, r) { return a + r.qty; }, 0), onBill = sales.filter(function (r) { return r.m === 'bill'; }).reduce(function (a, r) { return a + r.amt; }, 0);
    var best = {}; sales.forEach(function (r) { r.lines.forEach(function (l) { best[l.item] = (best[l.item] || 0) + l.amt; }); });
    var top = Object.keys(best).sort(function (a, b) { return best[b] - best[a]; }).slice(0, 6);
    var days = [], byDay = {}; rs.forEach(function (r) { if (!byDay[r.d]) { byDay[r.d] = []; days.push(r.d); } byDay[r.d].push(r); });
    return '<div class="filters">' + rangeSelect('data-shopr', SHOP.range) + '<button class="btn ghost" data-act="csv-sales">' + ic('download') + 'Export</button></div>' +
      '<div class="kpis">' + tile('Shop sales', money(total), sales.length + ' sale' + (sales.length === 1 ? '' : 's') + (refunds.length ? ' · ' + refunds.length + ' refunded' : '')) + tile('Items sold', items, top[0] ? 'Most sold: ' + esc(top[0]) : '') + tile('Average sale', money(sales.length ? total / sales.length : 0), 'per customer') + tile('Put on guests\' bills', money(onBill), 'paid with their booking') + '</div>' +
      '<div class="cols"><section class="card flush"><table class="tbl ledger"><thead><tr><th>Time</th><th>Items</th><th>For</th><th>Paid by</th><th class="r">Amount</th></tr></thead><tbody>' +
      (days.length ? days.map(function (d) {
        return '<tr class="day"><td colspan="4">' + dayLabel(d) + '</td><td class="r">' + money(byDay[d].reduce(function (a, r) { return a + r.amt; }, 0)) + '</td></tr>' + byDay[d].map(function (r) {
          return '<tr data-sale="' + r.sid + '" tabindex="0"><td data-l="Time" class="muted">' + r.t + '</td><td data-l="Items"><b>' + esc(r.summary) + '</b>' + (r.refunded ? ' <span class="tag bad">Refunded</span>' : '') + (r.amt < 0 ? ' <span class="tag bad">Refund</span>' : '') + '<small>by ' + esc(r.by || 'staff') + '</small></td><td data-l="For">' + (r.stand ? esc(r.stand) + (r.guest ? '<small>' + esc(r.guest) + '</small>' : '') : '<span class="muted">Walk-in</span>') + '</td><td data-l="Paid by"><span class="mth pm-' + r.m + '"><i></i>' + saleMethod(r.m) + '</span></td><td data-l="Amount" class="r amt' + (r.amt < 0 ? ' bad-t' : '') + '">' + money(r.amt) + '</td></tr>';
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
  var PROD = { q: '', cat: '' };
  function soldSince(days) { var from = add(TODAY, -days + 1), m = {}; DB.sales.forEach(function (s) { if (s.d >= from && s.pid && s.m) { m[s.pid] = m[s.pid] || { q: 0, v: 0 }; m[s.pid].q += s.qty; m[s.pid].v += s.amt; } }); return m; }
  function vProducts() {
    var items = shopItems(), sold = soldSince(30), q = PROD.q.toLowerCase(), cats = prodCats();
    var list = items.filter(function (p) { return (!PROD.cat || p.cat === PROD.cat) && (!q || (p.label + ' ' + (p.note || '')).toLowerCase().indexOf(q) >= 0); });
    var low = items.filter(lowStock), sq = 0, sv = 0; Object.keys(sold).forEach(function (k) { sq += sold[k].q; sv += sold[k].v; });
    return '<div class="page-h"><div><h1>Products</h1><p class="muted">Everything the camp shop sells. Enter the cash and EFT price; card payments add ' + cardFee() + '%.</p></div><div class="ph-act"><button class="btn" data-act="prod-add">' + ic('plus') + 'Add product</button></div></div>' +
      '<div class="kpis">' + tile('Products', items.length, items.filter(function (p) { return p.active !== false; }).length + ' showing on the till') + tile('Low on stock', low.length, low.length ? low.map(function (p) { return esc(p.label); }).slice(0, 2).join(', ') : 'All stocked up', null, low.length ? 'warn' : 'ok') + tile('Sold in the last 30 days', sq + ' items', money(sv)) + '</div>' +
      '<div class="filters"><label class="search">' + ic('search') + '<input type="search" data-prodq placeholder="Search products" value="' + esc(PROD.q) + '" aria-label="Search products"></label></div>' +
      '<div class="chips scroll"><button class="chip' + (!PROD.cat ? ' on' : '') + '" data-prodcat="">All <span>' + items.length + '</span></button>' + cats.map(function (c) { var n = items.filter(function (p) { return p.cat === c; }).length; return n ? '<button class="chip' + (PROD.cat === c ? ' on' : '') + '" data-prodcat="' + esc(c) + '">' + esc(c) + ' <span>' + n + '</span></button>' : ''; }).join('') + '</div>' +
      '<div class="card flush"><table class="tbl prods"><thead><tr><th>Product</th><th>Category</th><th class="r">Price</th><th class="r">In stock</th><th class="r">Sold, 30 days</th><th>Status</th></tr></thead><tbody>' +
      (list.length ? list.map(function (p) {
        var s = sold[p.id] || { q: 0, v: 0 };
        return '<tr data-prod="' + p.id + '" tabindex="0"><td data-l="Product"><b>' + esc(p.label) + '</b>' + (p.note ? '<small>' + esc(p.note) + '</small>' : '') + '</td><td data-l="Category">' + esc(p.cat || '') + '</td><td data-l="Price" class="r">' + money(p.amount) + '<small>Card ' + money(toCard(p.amount)) + '</small></td>' +
          '<td data-l="In stock" class="r">' + (p.stock == null ? '<span class="muted">Not counted</span>' : lowStock(p) ? '<span class="pill warn"><i></i>' + p.stock + ' left</span>' : p.stock) + '</td><td data-l="Sold" class="r">' + s.q + '<small>' + money(s.v) + '</small></td>' +
          '<td data-l="Status">' + (p.active === false ? '<span class="pill muted"><i></i>Hidden</span>' : '<span class="pill ok"><i></i>On the till</span>') + '</td></tr>';
      }).join('') : '<tr><td colspan="6" class="empty">No products match.</td></tr>') + '</tbody></table></div>' +
      '<p class="demo-note">' + ic('info') + 'Click a product to change its price, stock or category. In the live version these prices also show on the website\'s Rates page.</p>';
  }
  function actProduct(id, copyId) {
    var items = shopItems(), it = id ? prodBy(id) : null, src = it || (copyId ? prodBy(copyId) : null), cats = prodCats(), cat = src ? src.cat : SHOP.cat || PROD.cat || CATS[0];
    var track = src ? src.stock != null : true;
    modal(it ? 'Edit product' : src ? 'Duplicate product' : 'Add product',
      '<label class="fld"><span>Product name</span><input name="n" value="' + (src ? esc(it ? src.label : 'Copy of ' + src.label) : '') + '" placeholder="e.g. Braai tongs" autocomplete="off"></label>' +
      '<div class="grid2"><label class="fld"><span>Category</span><select name="c" data-catsel>' + cats.map(function (c) { return '<option' + (c === cat ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '<option value="__new">New category…</option></select></label><label class="fld" data-newcat hidden><span>New category name</span><input name="nc"></label></div>' +
      '<div class="grid2"><label class="fld"><span>Price for cash and EFT</span><input name="a" inputmode="decimal" value="' + (src ? src.amount : '') + '" placeholder="R" data-prod-price></label><label class="fld"><span>Card price (+' + cardFee() + '%)</span><input data-prod-card value="' + (src ? money(toCard(src.amount)) : '') + '" disabled></label></div>' +
      '<label class="fld"><span>Short description (optional)</span><input name="t" value="' + (src ? esc(src.note || '') : '') + '" placeholder="e.g. Enamel, two designs"></label>' +
      '<h5>Stock</h5><label class="check"><input type="checkbox" name="track" data-track' + (track ? ' checked' : '') + '><span>Count stock for this product</span></label>' +
      '<div class="grid2" data-stockf' + (track ? '' : ' hidden') + '><label class="fld"><span>In stock now</span><input name="s" inputmode="numeric" value="' + (src && src.stock != null ? src.stock : '') + '"></label><label class="fld"><span>Warn me when it gets to</span><input name="l" inputmode="numeric" value="' + (src ? src.lowAt || 5 : 5) + '"></label></div>' +
      '<label class="check"><input type="checkbox" name="on"' + (!src || src.active !== false ? ' checked' : '') + '><span>Show this product on the till</span></label>' +
      (it ? '<div class="m-extra"><button type="button" class="btn ghost sm" data-act="prod-dup" data-ref="' + it.id + '">Duplicate</button><button type="button" class="btn ghost sm danger-t" data-act="prod-del" data-ref="' + it.id + '">Delete product</button></div>' : ''),
      it ? 'Save' : 'Add product', function (f) {
        var nm = fval(f, 'n'), amt = parseFloat(fval(f, 'a').replace(/[^\d.]/g, '')), c = fval(f, 'c') === '__new' ? fval(f, 'nc') : fval(f, 'c');
        if (!nm) { toast('Give the product a name'); return false; }
        if (isNaN(amt)) { toast('Enter a price'); return false; }
        if (!c) { toast('Name the new category'); return false; }
        if (items.some(function (x) { return x !== it && K.norm(x.label) === K.norm(nm); })) { toast('There is already a product called ' + esc(nm)); return false; }
        var tr = fval(f, 'track'), s = parseInt(fval(f, 's'), 10);
        var row = { label: nm, amount: amt, note: fval(f, 't'), cat: c, active: fval(f, 'on'), stock: tr ? (isNaN(s) ? 0 : s) : null, lowAt: parseInt(fval(f, 'l'), 10) || 5 };
        if (it) Object.keys(row).forEach(function (k) { it[k] = row[k]; });
        else { var base = slugify(nm), pid = base, n = 2; while (prodBy(pid)) pid = base + '-' + n++; row.id = pid; DB.products.push(row); }
        log((it ? 'Updated product ' : 'Added product ') + nm); save(); render(); toast(esc(nm) + (it ? ' saved' : ' added to the shop'));
      }, { wide: true, noFocus: !!it });
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
  var SLOTS = { am: 'Morning · 06:00', pm: 'Afternoon · 15:30' }, SEATS = 10, GUIDES = ['Devon', 'Kyran'];
  function drivePrice(n) { return n >= 3 ? n * num('Game drives', 'Game drive 3 or more people per person', 400) : n === 2 ? 2 * num('Game drives', 'Game drive 2 people per person', 450) : n === 1 ? num('Game drives', 'Game drive 1 person', 900) : 0; }
  function vDrives() {
    var all = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd; });
    var need = all.filter(function (b) { return !b.drive && b.co >= TODAY; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    var sched = all.filter(function (b) { return b.drive && b.drive.d >= TODAY; });
    var wk = sched.filter(function (b) { return b.drive.d <= add(TODAY, 6); }), slotsWk = {}; wk.forEach(function (b) { slotsWk[b.drive.d + b.drive.slot] = 1; });
    var month = TODAY.slice(0, 7), inc = all.filter(function (b) { return (b.drive ? b.drive.d : b.ci).slice(0, 7) === month; }).reduce(function (a, b) { return a + drivePrice(b.extras.gd); }, 0);
    var days = []; for (var i = 0; i < 14; i++) days.push(add(TODAY, i));
    return '<div class="page-h"><div><h1>Game drives</h1><p class="muted">Guided drives with a Kyleu guide. ' + money(num('Game drives', 'Game drive 3 or more people per person', 400)) + ' per person for 3 or more, ' + money(num('Game drives', 'Game drive 2 people per person', 450)) + ' each for 2, ' + money(num('Game drives', 'Game drive 1 person', 900)) + ' for one person.</p></div><div class="ph-act"><button class="btn" data-act="drive-add">' + ic('plus') + 'Add a game drive</button></div></div>' +
      '<div class="kpis">' + tile('Drives in the next 7 days', Object.keys(slotsWk).length, wk.reduce(function (a, b) { return a + b.extras.gd; }, 0) + ' guests going') + tile('Waiting for a time', need.length, need.length ? 'Pick a time and a guide' : 'Everything is scheduled', null, need.length ? 'warn' : 'ok') + tile('Drive income this month', money(inc), 'at EFT prices') + '</div>' +
      (need.length ? '<section class="card"><header class="card-h"><h3>Waiting for a time</h3><span class="muted small">Booked with the stay, time not set yet</span></header>' + need.map(function (b) { return '<div class="brow"><span class="brow-st">' + b.extras.gd + ' ' + (b.extras.gd === 1 ? 'person' : 'people') + '</span><span class="brow-g" data-open="' + b.ref + '"><b>' + esc(guestName(b)) + '</b><small>' + esc(standById(b.stand).name) + ' · staying ' + fd(b.ci) + ' to ' + fd(b.co) + '</small></span><button class="btn sm" data-act="drive-set" data-ref="' + b.ref + '">' + ic('clock') + 'Set a time</button></div>'; }).join('') + '</section>' : '') +
      '<section class="card"><header class="card-h"><h3>The next two weeks</h3><span class="muted small">' + SEATS + ' seats per vehicle</span></header>' + days.map(function (d) {
        var any = sched.some(function (b) { return b.drive.d === d; });
        return '<div class="gd-day' + (any ? '' : ' quiet') + '"><div class="gd-date"><b>' + fd(d, { weekday: 'short', day: 'numeric', month: 'short' }) + '</b><small>' + (d === TODAY ? 'Today' : rel(d)) + '</small></div><div class="gd-slots">' + ['am', 'pm'].map(function (s) {
          var ps = sched.filter(function (b) { return b.drive.d === d && b.drive.slot === s; }), n = ps.reduce(function (a, b) { return a + b.extras.gd; }, 0);
          if (!n) return '<div class="gd-slot empty"><b>' + SLOTS[s] + '</b><span class="muted small">No one booked</span></div>';
          return '<div class="gd-slot"><div class="gd-top"><b>' + SLOTS[s] + '</b><span class="small">Guide: <b>' + esc(ps[0].drive.guide || 'not set') + '</b></span></div><div class="seats' + (n > SEATS ? ' over' : '') + '"><span style="width:' + Math.min(100, n / SEATS * 100) + '%"></span></div><small class="' + (n > SEATS ? 'bad-t' : 'muted') + '">' + n + ' of ' + SEATS + ' seats' + (n > SEATS ? ': needs a second vehicle' : '') + '</small>' +
            '<ul>' + ps.map(function (b) { return '<li><button data-act="drive-set" data-ref="' + b.ref + '"><b>' + esc(guestName(b)) + '</b> · ' + b.extras.gd + (b.extras.gd === 1 ? ' person' : ' people') + ' · ' + esc(standById(b.stand).name) + '</button></li>'; }).join('') + '</ul></div>';
        }).join('') + '</div></div>';
      }).join('') + '</section>';
  }
  // set (or change) the time, the guide and how many people; the price on the booking follows
  function actDrive(ref) {
    var pre = ref ? byRef(ref) : null, here = DB.bookings.filter(function (b) { return live(b) && b.status !== 'pending' && b.co >= TODAY; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; });
    var dr = pre && pre.drive ? pre.drive : { d: pre ? (pre.ci < TODAY ? TODAY : pre.ci) : TODAY, slot: 'pm', guide: GUIDES[0] };
    modal(pre && pre.extras && pre.extras.gd ? 'Game drive for ' + esc(guestName(pre)) : 'Add a game drive',
      (pre ? '<p class="muted small">' + esc(standById(pre.stand).name) + ' · staying ' + fd(pre.ci) + ' to ' + fd(pre.co) + '</p><input type="hidden" name="b" value="' + pre.ref + '">' : '<label class="fld"><span>Booking</span><select name="b">' + here.map(function (b) { return '<option value="' + b.ref + '">' + esc(standById(b.stand).name + ' · ' + guestName(b) + ' · ' + fd(b.ci) + ' to ' + fd(b.co)) + '</option>'; }).join('') + '</select></label>') +
      '<div class="grid2"><label class="fld"><span>People</span><input name="n" inputmode="numeric" value="' + (pre && pre.extras && pre.extras.gd || 2) + '" data-gd-n></label><label class="fld"><span>Price (EFT)</span><input data-gd-p value="' + money(drivePrice(pre && pre.extras && pre.extras.gd || 2)) + '" disabled></label></div>' +
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
    return '<label class="money-in' + (o.unit ? ' unit' : '') + '">' + (o.unit ? '' : 'R') + '<input data-rate="' + esc(key) + '" inputmode="decimal" value="' + v + '" aria-label="' + esc(o.aria || label) + '">' + (o.unit ? '<span>' + o.unit + '</span>' : '') + '</label>' + (o.unit ? '' : '<small class="card-of" data-cardof="' + esc(key) + '">Card ' + money(toCard(v)) + '</small>');
  }
  function rateVal(sec, label, d) { if (!sec) return d; var i = $('[data-rate="' + (sec.title + '|' + label).replace(/"/g, '\\"') + '"]'); var v = i ? parseFloat(i.value) : NaN; return isNaN(v) ? num(sec.title, label, d) : v; }
  function exampleText() {
    var ab = secByRe(/^ablution/i), ss = secByRe(/^self-sufficient/i), feeI = $('[data-rate$="|Card payment fee percentage"]'), fee = feeI ? parseFloat(feeI.value) || 0 : cardFee();
    var c = function (n) { return Math.round(n * (1 + fee / 100)); };
    var wk = rateVal(ab, 'Weekend per person per night', 245), wd = rateVal(ab, 'Weekday per person per night', 160), swk = rateVal(ss, 'Weekend per person per night', 180);
    return '<b>2 adults, Friday and Saturday night on a fenced stand:</b> ' + money(4 * wk) + ' EFT, or ' + money(4 * c(wk)) + ' by card.<br><b>2 adults, Sunday to Tuesday (2 nights):</b> ' + money(4 * wd) + ' EFT, or ' + money(4 * c(wd)) + ' by card.<br><b>2 adults, a weekend on a self-sufficient stand:</b> ' + money(4 * swk) + ' EFT, or ' + money(4 * c(swk)) + ' by card.';
  }
  function vRates() {
    var tabs = [['stay', 'Stay rates'], ['extras', 'Extras & activities'], ['rules', 'Payment & booking rules'], ['holidays', 'Holidays']];
    var ab = secByRe(/^ablution/i), ss = secByRe(/^self-sufficient/i), gd = secByRe(/game drive/i), br = secByRe(/booking rules/i), body = '';
    if (RT.tab === 'stay') {
      var rows = [['Weekend per person per night', 'Weekend night', 'Friday and Saturday nights, and nights before a public holiday'], ['Weekday per person per night', 'Weekday night', 'Sunday to Thursday nights'], ['Pensioner weekday per person per night', 'Pensioner, weekday', 'Monday to Thursday nights, per pensioner'], ['Children under 12', 'Children under ' + num('Booking rules', 'Children free under age', 12), 'Per child, per night']];
      body = '<section class="card flush"><table class="tbl rate-matrix"><thead><tr><th>Per person, per night</th><th class="r">Ablution stands<small>Fenced and unfenced</small></th><th class="r">Self-sufficient stands<small>On the spruit</small></th></tr></thead><tbody>' +
        rows.map(function (r) { return '<tr><td data-l="Rate"><b>' + r[1] + '</b><small>' + r[2] + '</small></td><td data-l="Ablution stands" class="r">' + rateIn(ab, r[0], { aria: r[1] + ', ablution stands' }) + '</td><td data-l="Self-sufficient stands" class="r">' + rateIn(ss, r[0], { aria: r[1] + ', self-sufficient stands' }) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
        '<section class="card example"><header class="card-h"><h3>' + ic('info') + 'What guests will pay</h3><span class="muted small">Updates as you type</span></header><p data-example>' + exampleText() + '</p></section>';
    }
    if (RT.tab === 'extras') {
      body = '<section class="card flush"><table class="tbl rate-matrix"><thead><tr><th>Extra</th><th class="r">Price</th></tr></thead><tbody>' +
        [[gd, 'Game drive 3 or more people per person', 'Game drive, 3 or more people', 'Per person'], [gd, 'Game drive 2 people per person', 'Game drive, 2 people', 'Per person'], [gd, 'Game drive 1 person', 'Game drive, 1 person', 'A private drive'], [ss, 'Porta potty hire per night', 'Porta potty hire', 'Self-sufficient stands, per night, cleaning included']].map(function (r) { return '<tr><td data-l="Extra"><b>' + r[2] + '</b><small>' + r[3] + '</small></td><td data-l="Price" class="r">' + rateIn(r[0], r[1], { aria: r[2] }) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
        '<section class="card link-card"><div>' + ic('box') + '<div><b>Shop products</b><p class="muted small">Firewood, ice and merchandise have their own page with stock and categories.</p></div></div><a class="btn ghost" href="#/products">Go to Products</a></section>';
    }
    if (RT.tab === 'rules') {
      var R = [['Card payment fee percentage', '%', 'Card fee', 'Added to every price when a guest pays by card. EFT and cash pay the normal price. Your card provider charges about ' + (DB.settings.providerFee || 2.95) + '%.'],
        ['Deposit percentage', '%', 'Deposit', 'How much of the total secures a booking.'],
        ['Deposit due within days of invoice', 'days', 'Deposit deadline', 'EFT guests must pay the deposit within this many days, or the stand can be released.'],
        ['Balance due days before arrival', 'days', 'Balance deadline', 'The rest is due this many days before arrival.'],
        ['Minimum nights over a weekend', 'nights', 'Weekend minimum', 'Shortest stay allowed over a Friday or Saturday night.'],
        ['Children free under age', 'years', 'Children stay free under', 'Children younger than this pay nothing.']];
      body = '<section class="card rules">' + R.map(function (r) { return '<div class="rule"><div><b>' + r[2] + '</b><p class="muted small">' + r[3] + '</p></div>' + rateIn(br, r[0], { unit: r[1], aria: r[2] }) + '</div>'; }).join('') + '</section>';
    }
    if (RT.tab === 'holidays') {
      var hol = Object.keys(P.holidays).filter(function (d) { return d >= TODAY; }).sort();
      body = '<section class="card"><header class="card-h"><h3>Public holidays and long weekends</h3><span class="muted small">The night before each date is charged at the weekend rate</span></header>' +
        '<form class="hol-add" data-hol-add><input type="date" name="d" aria-label="Date" required><input name="n" placeholder="Name, e.g. Heritage Day" aria-label="Name"><button class="btn" type="submit">' + ic('plus') + 'Add date</button></form>' +
        '<ul class="feed hol">' + hol.map(function (d) { return '<li><span><b>' + fd(d, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' }) + '</b> · ' + esc(P.holidays[d]) + '</span><button class="btn sm ghost" data-hol-del="' + d + '">Remove</button></li>'; }).join('') + '</ul></section>';
    }
    return '<div class="page-h"><div><h1>Rates & fees</h1><p class="muted">Enter the <b>normal price</b> that EFT and cash guests pay. Card prices add the card fee by themselves. Dinokeng\'s fees belong to the reserve, so they are not here.</p></div></div>' +
      '<div class="rp-tabs page-tabs">' + tabs.map(function (t) { return '<button class="' + (RT.tab === t[0] ? 'on' : '') + '" data-ratetab="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body +
      '<div class="savebar" data-savebar hidden><span>' + ic('info') + 'You have unsaved changes</span><button class="btn ghost" data-act="rates-discard">Discard</button><button class="btn" data-act="save-rates">Save changes</button></div>';
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
        if (!inR(p.d)) return;
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
    if (kind === 'pct') return { t: ar + Math.abs(Math.round(df)) + ' pts', c: good ? 'up' : 'down' };
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
      item('Waiting for EFT', pend.length, money(pend.reduce(function (a, b) { return a + deposit(b); }, 0)) + ' in deposits', 'warn', 'eft') +
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
      body.innerHTML = rpBody();
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
      h += '<div class="rp-grid2">' + rpCard('How it was paid', rpDonut(payRows(c), 'money', 'received'), { sub: 'Card prices include the ' + cardFee() + '% card fee' }) +
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

  var SET = 'staff';
  function vSettings() {
    var tabs = [['staff', 'Staff & access'], ['payments', 'Payments'], ['emails', 'Email templates'], ['data', 'Data & privacy']];
    var body = '';
    if (SET === 'staff') body = '<section class="card flush"><table class="tbl"><thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Last seen</th></tr></thead><tbody>' + STAFF.map(function (s, i) { return '<tr><td data-l="Name"><b>' + s.name + '</b>' + (ME.id === s.id ? ' <span class="tag ok">You</span>' : '') + '</td><td data-l="Email">' + s.email + '</td><td data-l="Role"><select aria-label="Role for ' + s.name + '"' + (ME.role !== 'Owner' ? ' disabled' : '') + '>' + Object.keys(ROLES).map(function (r) { return '<option' + (r === s.role ? ' selected' : '') + '>' + r + '</option>'; }).join('') + '</select></td><td data-l="Last seen">' + (ME.id === s.id ? 'Now' : ['Today 07:12', 'Yesterday', '3 days ago', 'Today 09:40'][i]) + '</td></tr>'; }).join('') + '</tbody></table></section>' +
      '<section class="card"><header class="card-h"><h3>What each role can see</h3></header><table class="tbl perm"><thead><tr><th>Section</th>' + Object.keys(ROLES).map(function (r) { return '<th>' + r + '</th>'; }).join('') + '</tr></thead><tbody>' + NAV.map(function (n) { return '<tr><td>' + n.t + '</td>' + Object.keys(ROLES).map(function (r) { return '<td>' + (ROLES[r].indexOf(n.id) >= 0 ? ic('check', 'ok-t') : '<span class="muted">No</span>') + '</td>'; }).join('') + '</tr>'; }).join('') + '</tbody></table><button class="btn ghost" data-act="invite">' + ic('plus') + 'Invite a staff member</button></section>';
    if (SET === 'payments') body = '<div class="cols"><section class="card"><header class="card-h"><h3>Card payments</h3><span class="pill warn"><i></i>Not connected</span></header><p class="muted small">Guests pay on a secure page from the card company, so card numbers never touch the Kyleu website. Choose a South African provider:</p><div class="prov">' + ['Yoco', 'PayFast', 'Peach Payments', 'Paystack'].map(function (p) { return '<button class="prov-b" data-act="connect" data-ref="' + p + '"><b>' + p + '</b><small>Connect</small></button>'; }).join('') + '</div>' +
      '<div class="grid2"><label class="fld"><span>Card fee added to card prices</span><input value="' + cardFee() + '%" disabled></label><label class="fld"><span>Provider charges (for reports)</span><input data-provfee value="' + (DB.settings.providerFee || 2.95) + '" inputmode="decimal"></label></div><p class="muted small">Change the card fee on the Rates & fees page.</p></section>' +
      '<section class="card"><header class="card-h"><h3>EFT bank details</h3><span class="muted small">Printed on invoices</span></header><div class="grid2"><label class="fld"><span>Bank</span><input value="FNB"></label><label class="fld"><span>Account name</span><input value="Kyleu Bush Camp"></label></div><div class="grid2"><label class="fld"><span>Account number</span><input value="62000000000"></label><label class="fld"><span>Branch code</span><input value="250655"></label></div><p class="muted small">Demo details. Guests use their booking reference (e.g. KY26-4F2K) so payments are easy to match.</p></section></div>';
    if (SET === 'emails') body = '<div class="tpl-grid">' + Object.keys(TEMPLATES).map(function (k) { var t = TEMPLATES[k]; return '<section class="card"><header class="card-h"><h3>' + t.t + '</h3><span class="muted small">' + ({ confirm: 'Sent when a booking is made', eft: 'Sent 3 days after an unpaid EFT invoice', balance: 'Sent 10 days before arrival', arrival: 'Sent 3 days before arrival', thanks: 'Sent the day after departure' })[k] + '</span></header><p class="small"><b>' + esc(t.s) + '</b></p><pre class="tpl">' + esc(t.b({})) + '</pre></section>'; }).join('') + '</div><p class="demo-note">' + ic('info') + 'Words in {curly brackets} are filled in for each guest. In the live version these send automatically.</p>';
    if (SET === 'data') body = '<div class="cols"><section class="card"><header class="card-h"><h3>Privacy (POPIA)</h3></header><p class="small">Guest details are only used to manage bookings. Guests can ask for their details to be removed; deleting a guest keeps the booking for tax records but removes their contact details.</p><p class="small">Only staff with an account can open this admin, and every change is logged.</p></section>' +
      '<section class="card"><header class="card-h"><h3>Demo data</h3></header><p class="small">Everything in this admin is made-up demo data kept only in this browser. Bookings you make on the website demo show up here too.</p><div class="row-btns"><button class="btn ghost" data-act="export-json">' + ic('download') + 'Download a backup</button><button class="btn ghost danger-t" data-act="reset">Reset demo data</button></div></section></div>' +
      '<section class="card"><header class="card-h"><h3>Activity log</h3></header><ul class="feed">' + DB.log.slice(0, 25).map(function (l) { return '<li' + (l.ref ? ' data-open="' + l.ref + '"' : '') + '><span>' + esc(l.text) + '</span><small>' + esc(l.by) + ' · ' + esc(l.at) + '</small></li>'; }).join('') + '</ul></section>';
    return '<div class="page-h"><div><h1>Settings</h1></div></div><div class="chips">' + tabs.map(function (t) { return '<button class="chip' + (SET === t[0] ? ' on' : '') + '" data-set="' + t[0] + '">' + t[1] + '</button>'; }).join('') + '</div>' + body;
  }

  var VIEWS = { dashboard: vDashboard, bookings: vBookings, eft: vEft, calendar: vCalendar, guests: vGuests, payments: vPayments, shop: vShop, drives: vDrives, products: vProducts, enquiries: vEnquiries, stands: vStands, rates: vRates, reports: vReports, settings: vSettings };
  function route() { var v = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard'; return VIEWS[v] && can(v) ? v : 'dashboard'; }

  /* ---------- shell ---------- */
  function badges() {
    return { eft: DB.bookings.filter(function (b) { return b.status === 'pending'; }).length, enquiries: DB.threads.filter(function (t) { return t.status === 'open'; }).length, products: shopItems().filter(lowStock).length, drives: DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && !b.drive && b.co >= TODAY && diff(TODAY, b.ci) <= 14; }).length, bookings: DB.bookings.filter(function (b) { return b.isNew; }).length };
  }
  function shell() {
    var bd = badges();
    app.innerHTML = '<aside class="side"><a class="brand" href="#/dashboard"><img src="../assets/img/logo-small.png" alt=""><span><b>Kyleu</b><small>Staff admin</small></span></a><nav>' +
      NAV.filter(function (n) { return can(n.id); }).map(function (n, i, arr) { return (n.g && (!i || arr[i - 1].g !== n.g) ? '<span class="nav-h">' + n.g + '</span>' : '') + '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.i) + '<span>' + n.t + '</span>' + (bd[n.id] ? '<em>' + bd[n.id] + '</em>' : '') + '</a>'; }).join('') +
      '</nav><div class="side-f"><a href="../index.html" target="_blank" rel="noopener">' + ic('ext') + 'View website</a><button data-act="logout">' + ic('out') + 'Sign out</button></div></aside><div class="scrim" data-act="menu"></div>' +
      '<div class="main"><header class="top"><button class="icon-btn menu-btn" data-act="menu" aria-label="Menu">' + ic('menu') + '</button><label class="search top-search">' + ic('search') + '<input data-global placeholder="Find a booking: name, ref or phone" aria-label="Find a booking"><div class="sugg" data-sugg hidden></div></label>' +
      '<span class="demo-badge">Demo data</span><div class="me"><span class="avatar">' + ME.name[0] + '</span><span class="me-t"><b>' + ME.name + '</b><small>' + ME.role + '</small></span></div></header><main id="view" tabindex="-1"></main></div>' +
      '<nav class="bottom">' + ['dashboard', 'bookings', 'eft', 'calendar'].filter(can).map(function (id) { var n = NAV.filter(function (x) { return x.id === id; })[0]; return '<a href="#/' + id + '" data-nav="' + id + '">' + ic(n.i) + '<span>' + (id === 'eft' ? 'EFT' : n.t) + '</span>' + (bd[id] ? '<em>' + bd[id] + '</em>' : '') + '</a>'; }).join('') + '<button data-act="menu">' + ic('menu') + '<span>More</span></button></nav>' +
      '<div id="drawer" hidden></div><div id="modal" hidden></div><div class="toasts" aria-live="polite"></div><div class="tip" hidden></div>';
  }
  function render() {
    var v = route(), el = $('#view'); if (!el) return;
    var bd = badges();
    $$('[data-nav]').forEach(function (a) { a.classList.toggle('on', a.dataset.nav === v); var em = $('em', a), n = bd[a.dataset.nav]; if (n) { if (!em) { em = document.createElement('em'); a.appendChild(em); } em.textContent = n; } else if (em) em.remove(); });
    el.innerHTML = VIEWS[v]();
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
    var go = t.closest('[data-go]'); if (go) { location.hash = '#/' + go.dataset.go; return; }
    var op = t.closest('[data-open]'); if (op && !t.closest('[data-act]')) { e.preventDefault(); if (!$('#modal').hidden) closeModal(); openBooking(op.dataset.open); return; }
    var nav = t.closest('[data-nav]'); if (nav) { document.body.classList.remove('nav-open'); }
    var tab = t.closest('[data-tab]'); if (tab) { var card = tab.closest('.card'); $$('[data-tab]', card).forEach(function (x) { x.classList.toggle('on', x === tab); }); $$('[data-pane]', card).forEach(function (p) { p.hidden = p.dataset.pane !== tab.dataset.tab; }); return; }
    var fst = t.closest('[data-fst]'); if (fst) { F.st = fst.dataset.fst; render(); return; }
    var cal = t.closest('[data-cal]'); if (cal) { var n = +cal.dataset.cal; CAL.start = n ? add(CAL.start, n) : add(TODAY, -2); render(); return; }
    var na = t.closest('[data-newat]'); if (na) { var p = na.dataset.newat.split('|'); actNew({ stand: p[0], ci: p[1], co: add(p[1], 2) }); return; }
    var gr = t.closest('[data-guest]'); if (gr) { openGuest(gr.dataset.guest); return; }
    var th = t.closest('[data-thread]'); if (th) { IN.id = th.dataset.thread || null; CMP_ATT = []; var tt = IN.id && thrById(IN.id); if (tt && tt.unread) { tt.unread = false; save(); } render(); window.scrollTo(0, 0); return; }
    var tg = t.closest('[data-thread-go]'); if (tg) { IN.id = tg.dataset.threadGo; IN.box = 'all'; closeDrawer(); location.hash = '#/enquiries'; render(); return; }
    var bx = t.closest('[data-box]'); if (bx) { IN.box = bx.dataset.box; IN.id = null; render(); return; }
    var at_ = t.closest('[data-att]'); if (at_) { viewAtt(at_.dataset.att); return; }
    var cd = t.closest('[data-cmp-del]'); if (cd) { CMP_ATT.splice(+cd.dataset.cmpDel, 1); cmpRefresh(); return; }
    var sa = t.closest('[data-sale]'); if (sa) { openSale(sa.dataset.sale); return; }
    var pr = t.closest('[data-prod]'); if (pr) { actProduct(pr.dataset.prod); return; }
    var pt = t.closest('[data-paytab]'); if (pt) { PAYF.tab = pt.dataset.paytab; render(); return; }
    var py = t.closest('[data-payt]'); if (py) { PAYF.type = py.dataset.payt; PAYF.lim = 120; render(); return; }
    var stb = t.closest('[data-shoptab]'); if (stb) { SHOP.tab = stb.dataset.shoptab; render(); window.scrollTo(0, 0); return; }
    var pcat = t.closest('[data-pcat]'); if (pcat) { SHOP.cat = pcat.dataset.pcat; render(); return; }
    var prc = t.closest('[data-prodcat]'); if (prc) { PROD.cat = prc.dataset.prodcat; render(); return; }
    var rtb = t.closest('[data-ratetab]'); if (rtb) { var sb = $('[data-savebar]'); if (sb && !sb.hidden) { toast('Save or discard your changes first'); return; } RT.tab = rtb.dataset.ratetab; render(); return; }
    var hd = t.closest('[data-hol-del]'); if (hd) { var hdd = hd.dataset.holDel; if (DB.hol.add[hdd]) delete DB.hol.add[hdd]; else DB.hol.del[hdd] = 1; delete P.holidays[hdd]; log('Removed holiday ' + hdd); save(); render(); toast('Date removed'); return; }
    var se = t.closest('[data-set]'); if (se) { SET = se.dataset.set; render(); return; }
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
    if (act === 'logout') { try { sessionStorage.removeItem(SESS); } catch (x) {} ME = null; location.hash = ''; login(); return; }
    if (act === 'new') return actNew();
    if (act === 'pay') return actPay(ref);
    if (act === 'remind') return actRemind(ref);
    if (act === 'cancel') return actCancel(ref);
    if (act === 'release') return actCancel(ref);
    if (act === 'move') return actMove(ref);
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
    if (act === 'checkin' || act === 'checkout') { var b = byRef(ref); if (act === 'checkin') { b.status = 'in'; if (balance(b) > 0) b.notes.push({ at: nowStamp(), by: ME.name, text: 'Checked in with ' + money(balance(b)) + ' still owing. Collect at reception.' }); } else b.status = 'out'; log(guestName(b) + (act === 'checkin' ? ' checked in at ' : ' checked out of ') + standById(b.stand).name, b.ref); save(); refresh(); toast(act === 'checkin' ? (balance(b) > 0 ? 'Checked in. ' + money(balance(b)) + ' still owing: collect at reception' : 'Checked in. Enjoy your stay, ' + esc(b.guest.first) + '!') : 'Checked out. The stand is ready for cleaning.'); return; }
    if (act === 'csv-bookings') { csv('kyleu-bookings.csv', [['Ref', 'Created', 'Source', 'Guest', 'Email', 'Phone', 'Stand', 'Area', 'Arrive', 'Depart', 'Nights', 'Adults', 'Pensioners', 'Kids', 'Pays by', 'EFT price', 'Card price', 'Total', 'Paid', 'Balance', 'Status']].concat(DB.bookings.map(function (b) { var st = standById(b.stand); return [b.ref, b.created, b.source, guestName(b), b.guest.email, b.guest.phone, st.name, AREA_SHORT[st.area], b.ci, b.co, diff(b.ci, b.co), b.adults, b.pens, b.kids, methodLabel(b.method), b.eft, b.card, b.total, paid(b), balance(b), stateOf(b).t]; }))); return; }
    if (act === 'csv-guests') { csv('kyleu-mailing-list.csv', [['Name', 'Email', 'Phone', 'Stays', 'Last visit']].concat(guestsList().filter(function (g) { return g.consent; }).map(function (g) { return [g.name, g.email, g.phone, g.stays, g.last]; }))); toast('Only guests who agreed to receive news are exported'); return; }
    if (act === 'csv-pay') { var rgp = simpleRange(PAYF.range); csv('kyleu-payments-' + rgp[0] + '-to-' + rgp[1] + '.csv', [['Date', 'Time', 'Type', 'From', 'For', 'Method', 'Amount', 'Card fee part']].concat(allTx().filter(function (p) { return p.d >= rgp[0] && p.d <= rgp[1]; }).map(function (p) { return [p.d, p.t, p.type, p.who, p.what, methodLabel(p.m), p.amt, p.fee]; }))); return; }
    if (act === 'save-rates') {
      $$('[data-rate]').forEach(function (inp) { var v = parseFloat(inp.value.replace(/[^\d.]/g, '')); if (!isNaN(v)) { var k = inp.dataset.rate.split('|'); var orig = P.num(k[0], k[1], null); if (orig !== v) DB.rates[k[0] + '|' + k[1]] = v; else delete DB.rates[k[0] + '|' + k[1]]; } });
      log('Prices updated'); save(); render(); toast('Prices saved'); return;
    }
    if (act === 'enq-book') { var q = thrById(ref), nm = q.name.split(' '); actNew({ first: nm[0], last: nm.slice(1).join(' '), email: q.email, phone: q.phone }); return; }
    if (act === 'invite') { modal('Invite a staff member', '<label class="fld"><span>Name</span><input name="n"></label><label class="fld"><span>Email</span><input name="e" type="email"></label><label class="fld"><span>Role</span><select name="r">' + Object.keys(ROLES).map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>', 'Send invite', function () { toast('Invite sent (demo)'); }); return; }
    if (act === 'connect') { modal('Connect ' + esc(ref), '<p>In the live version you would sign in to your ' + esc(ref) + ' account here. Guests then pay on ' + esc(ref) + '\'s secure page and the booking is confirmed by itself the moment the payment goes through.</p><p class="muted small">Card numbers never touch the Kyleu website.</p>', null); return; }
    if (act === 'export-json') { var bl = document.createElement('a'); bl.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' })); bl.download = 'kyleu-admin-backup.json'; bl.click(); return; }
    if (act === 'reset') { modal('Reset demo data?', '<p>All demo bookings, payments and notes go back to the start. Bookings made on the website demo are removed too.</p>', 'Reset', function () { try { localStorage.removeItem(KEY); localStorage.removeItem(WEB); localStorage.removeItem(POPK); } catch (x) {} STANDS = CONTENT_STANDS.slice(); P.holidays = JSON.parse(ORIG_HOL); CART = {}; IN.id = null; DB = null; DB = seed(); save(); render(); toast('Demo data reset'); }, { danger: true }); return; }
  }
  function onInput(e) {
    var t = e.target;
    if (t.matches('[data-f=q]')) { F.q = t.value; var pos = t.selectionStart; render(); var i = $('[data-f=q]'); i.focus(); i.setSelectionRange(pos, pos); return; }
    if (t.matches('[data-gq]')) { GQ = t.value; var p2 = t.selectionStart; render(); var g = $('[data-gq]'); g.focus(); g.setSelectionRange(p2, p2); return; }
    if (t.matches('[data-rate]')) { var sbar = $('[data-savebar]'); if (sbar) sbar.hidden = false; var ex = $('[data-example]'); if (ex) ex.innerHTML = exampleText(); var c = $('[data-cardof="' + t.dataset.rate.replace(/"/g, '\\"') + '"]'), v = parseFloat(t.value); if (c) c.textContent = v ? 'Card ' + money(toCard(v)) : ''; return; }
    if (t.matches('[data-inq],[data-payq],[data-shopq],[data-prodq]')) { var key = t.matches('[data-inq]') ? 'inq' : t.matches('[data-payq]') ? 'payq' : t.matches('[data-shopq]') ? 'shopq' : 'prodq'; if (key === 'inq') IN.q = t.value; if (key === 'payq') PAYF.q = t.value; if (key === 'shopq') SHOP.q = t.value; if (key === 'prodq') PROD.q = t.value; var ps = t.selectionStart; render(); var ni = $('[data-' + key + ']'); if (ni) { ni.focus(); ni.setSelectionRange(ps, ps); } return; }
    if (t.matches('[data-prod-price]')) { var pv = parseFloat(t.value.replace(/[^\d.]/g, '')), pcard = $('[data-prod-card]'); if (pcard) pcard.value = isNaN(pv) ? '' : money(toCard(pv)); return; }
    if (t.matches('[data-provfee]')) { DB.settings.providerFee = parseFloat(t.value) || 0; save(); return; }
    if (t.matches('[data-match]')) {
      var q = t.value.trim().toUpperCase().replace(/\s/g, ''), out = $('[data-match-out]');
      if (q.length < 3) { out.innerHTML = 'Tip: guests use their booking reference when they pay, so you can paste it straight from the bank app.'; return; }
      var hits = DB.bookings.filter(function (b) { return b.ref.replace('-', '').indexOf(q.replace('-', '')) >= 0 || guestName(b).toUpperCase().indexOf(q) >= 0; }).slice(0, 4);
      out.innerHTML = hits.length ? hits.map(function (b) { return '<button class="brow" data-open="' + b.ref + '"><span class="brow-st">' + esc(b.ref) + '</span><span class="brow-g"><b>' + esc(guestName(b)) + '</b><small>' + (b.status === 'pending' ? 'Expecting ' + money(deposit(b)) + ' deposit' : 'Balance ' + money(balance(b))) + '</small></span>' + pill(stateOf(b)) + '</button>'; }).join('') : 'No booking with that reference.';
      return;
    }
    if (t.matches('[data-global]')) {
      var s = t.value.trim().toLowerCase(), box = $('[data-sugg]');
      if (s.length < 2) { box.hidden = true; return; }
      var r = DB.bookings.filter(function (b) { return (b.ref + ' ' + guestName(b) + ' ' + b.guest.phone + ' ' + b.guest.email).toLowerCase().indexOf(s) >= 0; }).slice(-6).reverse();
      box.innerHTML = r.length ? r.map(function (b) { return '<button data-open="' + b.ref + '"><b>' + esc(guestName(b)) + '</b><small>' + esc(b.ref) + ' · ' + esc(standById(b.stand).name) + ' · ' + fd(b.ci) + '</small></button>'; }).join('') : '<p class="muted small">No bookings found</p>';
      box.hidden = false;
    }
  }
  function onChange(e) {
    var t = e.target;
    if (t.matches('[data-f=area]')) { F.area = t.value; render(); }
    if (t.matches('[data-payr]')) { PAYF.range = t.value; PAYF.lim = 120; render(); }
    if (t.matches('[data-paym]')) { PAYF.m = t.value; render(); }
    if (t.matches('[data-shopr]')) { SHOP.range = t.value; render(); }
    if (t.matches('[data-who]')) { SHOP.who = t.value; render(); }
    if (t.matches('[data-quick]')) { var qi = QUICK[+t.value], ta = t.form && t.form.elements.r; if (qi && ta) { var txt = qi[1](); ta.value = ta.value.replace(/\s*$/, '') + (ta.value.trim() ? '\n\n' : '') + txt; ta.focus(); } t.value = ''; }
    if (t.matches('[data-cmp-file]')) { Array.prototype.slice.call(t.files || []).forEach(function (fl) { CMP_ATT.push({ name: fl.name, size: fl.size, type: fl.type }); }); t.value = ''; cmpRefresh(); }
    if (t.matches('[data-catsel]')) { var nc = $('[data-newcat]'); if (nc) nc.hidden = t.value !== '__new'; }
    if (t.matches('[data-track]')) { var sf = $('[data-stockf]'); if (sf) sf.hidden = !t.checked; }
    if (t.matches('[data-rp-range]')) { RP.range = t.value; rpSave(); render(); }
    if (t.matches('[data-rp-cmp]')) { RP.compare = t.checked; rpSave(); rpInstant = true; render(); }
    if (t.matches('[data-copy-from]')) { actStand(null, t.value || null); }
    if (t.matches('[data-ph-file]')) { Array.prototype.slice.call(t.files || []).slice(0, 10).forEach(function (file) { shrink(file, function (url) { if (EDIT) { EDIT.photos.push(url); phRefresh(); } }); }); t.value = ''; }
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
      if (e.key === 'Escape') { if (!$('#modal') || $('#modal').hidden) { if ($('#drawer') && !$('#drawer').hidden) closeDrawer(); } else closeModal(); }
      if (e.key === 'Enter' && e.target.matches('tr[data-open],tr[data-guest],tr[data-sale],tr[data-prod]')) e.target.click();
    });
    document.addEventListener('focusout', function (e) { if (e.target.matches('[data-global]')) setTimeout(function () { var s = $('[data-sugg]'); if (s) s.hidden = true; }, 200); });
    var rsz; window.addEventListener('resize', function () { clearTimeout(rsz); rsz = setTimeout(function () { if ($('[data-rpc]')) rpDrawCharts(true); }, 120); });
    window.addEventListener('hashchange', function () { document.body.classList.remove('nav-open'); if (ME) { render(); window.scrollTo(0, 0); } });
    // pick up website demo bookings made in another tab
    window.addEventListener('storage', function (e) { if (e.key === WEB && ME && importWeb()) { render(); toast('New booking from the website'); } if (e.key === POPK && ME && importPop()) { render(); toast('Proof of payment uploaded on the website'); } });
    Promise.all([K.prices(), K.stands()]).then(function (r) {
      P = r[0]; ORIG_HOL = JSON.stringify(P.holidays); CONTENT_STANDS = r[1]; STANDS = r[1].slice(); loadDB();
      var id = null; try { id = sessionStorage.getItem(SESS); } catch (e) {}
      var s = STAFF.filter(function (x) { return x.id === id; })[0];
      if (s) start(s); else login();
    }).catch(function () { app.innerHTML = '<div class="login"><div class="login-card"><h1>Couldn\'t load</h1><p>The admin reads the content folder. Open it through the preview server (Preview website.bat).</p></div></div>'; });
  });
})();
