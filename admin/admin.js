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
  var P, STANDS = [], DB, ME, app;

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
  function standById(id) { return STANDS.filter(function (s) { return s.id === id; })[0] || { id: id, name: id, area: 'fenced', guests: 8 }; }
  var AREA_SHORT = { fenced: 'Fenced', unfenced: 'Unfenced', 'self-sufficient': 'Self-sufficient' };
  function shopItems() {
    var sec = P.sections.filter(function (s) { return /shop/i.test(s.title); })[0];
    return (sec ? sec.items : []).map(function (it) { return { label: it.label, amount: num('Camp shop', it.label, it.amount) }; });
  }
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
    var db = { v: 1, seeded: TODAY, bookings: [], enquiries: [], blocks: [], sales: [], log: [], rates: {}, closed: {}, settings: { providerFee: 2.95 }, readEnq: {} };
    var guests = [];
    for (var i = 0; i < 46; i++) {
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
      var lead = Math.max(1, Math.floor(r() * 45) + 2), created = add(ci, -lead); if (created > TODAY) created = add(TODAY, -Math.floor(r() * 30));
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
      else if (ci < TODAY && b.status !== 'pending') b.status = 'in';
      if (b.status !== 'in' && b.status !== 'out' && ci > TODAY && r() < .05) { b.status = 'cancelled'; b.notes.push({ at: cday, by: 'Sherri', text: 'Guest cancelled by email more than 14 days before arrival. Deposit refunded.' }); if (paid(b)) b.payments.push({ d: add(cday, 2), amt: -paid(b), m: b.payments[0].m, type: 'Refund', ref: payRef }); }
      if (opts.overdue) { b.status = 'pending'; b.payments = []; b.pop = false; }
      if (r() < .12 && b.status !== 'cancelled') b.notes.push({ at: cday, by: pick(['Sherri', 'Devon', 'Kyran']), text: pick(['Celebrating a birthday on Saturday.', 'Asked for a stand close to the pool.', 'Arriving late, after 18:00. Gate code sent.', 'Bringing a 6 m off-road trailer.', 'First time in Dinokeng: sent gate directions.', 'Regulars, they love Stand 3.']) });
      db.bookings.push(b); return b;
    }
    // overlaps() reads DB, so point DB at the new data while seeding
    DB = db;
    STANDS.forEach(function (st) {
      for (var w = -6; w <= 10; w++) {
        var f = add(fri, w * 7), dec = D(f).getMonth() === 11;
        var p = (w < 0 ? .62 : w < 3 ? .55 : w < 6 ? .4 : .22) + (dec ? .25 : 0);
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
    // shop sales, last 14 days
    var items = shopItems();
    for (var dd = -14; dd <= 0; dd++) {
      var nSales = 2 + Math.floor(r() * 5);
      for (var s = 0; s < nSales; s++) {
        var it = items[Math.floor(r() * Math.min(items.length, 5))] || { label: 'Ice per bag', amount: 15 }, qty = 1 + Math.floor(r() * 3), m = r() < .55 ? 'card' : 'cash';
        db.sales.push({ d: add(TODAY, dd), item: it.label, qty: qty, m: m, amt: (m === 'card' ? toCard(it.amount) : it.amount) * qty, stand: pick(STANDS).name });
      }
    }
    db.enquiries = [
      { id: 'e1', d: TODAY + ' 08:14', name: 'Marike Venter', email: 'marike.venter@gmail.com', phone: '082 555 0192', subject: 'Group booking, 4 stands', msg: 'Hi! We are 4 families (8 adults, 9 kids) looking at the 16 December long weekend. Can we get 4 stands next to each other in the unfenced camp?', status: 'new' },
      { id: 'e2', d: add(TODAY, -1) + ' 19:40', name: 'Tshepo Molefe', email: 'tshepo.m@outlook.com', phone: '072 410 8821', subject: 'Game drive for 6', msg: 'Good evening, we are staying at Inside 4 in two weeks. Can we book a game drive for 6 people on the Saturday morning?', status: 'new' },
      { id: 'e3', d: add(TODAY, -1) + ' 11:05', name: 'Elmarie Nel', email: 'elmarie.nel@mweb.co.za', phone: '083 300 1177', subject: 'Pensioner rate', msg: 'Goeie dag, is the pensioner rate valid for a Sunday night as well, or only Monday to Thursday?', status: 'new' },
      { id: 'e4', d: add(TODAY, -2) + ' 15:22', name: 'Craig Jacobs', email: 'craig@jacobsbuild.co.za', phone: '061 220 4433', subject: 'Company year-end', msg: 'We would like to host a small year-end for 20 staff, day visit with a braai. Is that something you do?', status: 'replied' },
      { id: 'e5', d: add(TODAY, -3) + ' 07:51', name: 'Anika Botha', email: 'anika.botha@icloud.com', phone: '079 880 6612', subject: 'Lost item', msg: 'We left a blue camping chair at Stand 3 last weekend. Did anyone find it?', status: 'replied' },
      { id: 'e6', d: add(TODAY, -4) + ' 13:30', name: 'Ruan Kruger', email: 'ruan.kruger@gmail.com', phone: '076 145 2290', subject: 'Invoice for my company', msg: 'Please can you make the invoice out to Kruger Logistics (Pty) Ltd with our VAT number?', status: 'replied' }
    ];
    var recent = db.bookings.filter(function (b) { return b.created.slice(0, 10) >= add(TODAY, -3); }).slice(-6);
    recent.forEach(function (b) { db.log.push({ at: b.created, by: b.source === 'Website' ? 'Website' : 'Sherri', text: 'New booking ' + b.ref + ' for ' + guestName(b) + ' (' + standById(b.stand).name + ')', ref: b.ref }); });
    db.log.sort(function (a, b) { return a.at < b.at ? 1 : -1; });
    return db;
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(DB)); } catch (e) {} }
  function loadDB() {
    try { DB = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { DB = null; }
    if (!DB || DB.v !== 1) { DB = seed(); save(); }
    importWeb();
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
    Owner: ['dashboard', 'bookings', 'eft', 'calendar', 'guests', 'payments', 'shop', 'enquiries', 'stands', 'rates', 'reports', 'settings'],
    Manager: ['dashboard', 'bookings', 'eft', 'calendar', 'guests', 'payments', 'shop', 'enquiries', 'stands', 'reports'],
    'Front desk': ['dashboard', 'bookings', 'calendar', 'guests', 'shop', 'enquiries']
  };
  var NAV = [
    { id: 'dashboard', t: 'Dashboard', i: 'home' },
    { id: 'bookings', t: 'Bookings', i: 'list' },
    { id: 'eft', t: 'EFT payments', i: 'bank' },
    { id: 'calendar', t: 'Calendar', i: 'cal' },
    { id: 'guests', t: 'Guests', i: 'users' },
    { id: 'payments', t: 'Payments', i: 'card' },
    { id: 'shop', t: 'Shop & game drives', i: 'cart' },
    { id: 'enquiries', t: 'Enquiries', i: 'mail' },
    { id: 'stands', t: 'Stands & blocks', i: 'tent' },
    { id: 'rates', t: 'Rates & fees', i: 'tag' },
    { id: 'reports', t: 'Reports', i: 'chart' },
    { id: 'settings', t: 'Settings', i: 'cog' }
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
      '<section class="d-sec"><h4>Money</h4><div class="lines">' + q.lines.map(function (l) { return '<div class="ln"><span>' + esc(l.t) + '</span><span>' + (b.method === 'card' ? money(l.c) : money(l.e)) + '</span></div>'; }).join('') +
      '<div class="ln sub"><span>Card price</span><span>' + (b.method === 'card' ? money(b.card) : '<s>' + money(b.card) + '</s>') + '</span></div>' +
      '<div class="ln sub"><span>EFT price (no card fee)</span><span>' + (b.method === 'card' ? '<s>' + money(b.eft) + '</s>' : money(b.eft)) + '</span></div>' +
      '<div class="ln tot"><span>Total · paying by ' + methodLabel(b.method) + '</span><span>' + money(b.total) + '</span></div>' +
      '<div class="ln"><span>Paid</span><span class="ok-t">' + money(pd) + '</span></div>' +
      (b.status === 'cancelled' ? '' : '<div class="ln tot"><span>Balance</span><span class="' + (bal ? 'warn-t' : 'ok-t') + '">' + money(bal) + '</span></div>') + '</div>' +
      (b.status === 'pending' ? '<p class="note">' + ic('clock') + '<span>Deposit of <b>' + money(deposit(b)) + '</b> is due by <b>' + fd(depositDue(b)) + '</b> (' + rel(depositDue(b)) + '). Reference <b>' + esc(b.ref) + '</b>.</span></p>' : '') +
      (b.status === 'confirmed' && bal ? '<p class="note">' + ic('clock') + '<span>Balance of <b>' + money(bal) + '</b> is due by <b>' + fd(balanceDue(b)) + '</b> (' + rel(balanceDue(b)) + ').</span></p>' : '') +
      '<h5>Payments</h5>' + ((b.payments || []).length ? '<ul class="timeline">' + b.payments.map(function (p) { return '<li><span class="dot ' + (p.amt < 0 ? 'bad' : p.m) + '"></span><div><b>' + money(p.amt) + '</b> ' + esc(p.type) + ' · ' + methodLabel(p.m) + '<div class="muted small">' + fd(p.d, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + esc(p.ref || '') + '</div></div></li>'; }).join('') + '</ul>' : '<p class="muted small">No payments yet.</p>') + '</section>' +
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
    eft: { t: 'EFT deposit reminder', s: 'Your Kyleu booking: deposit reminder', b: function (b) { return 'Hi {first},\n\nThank you for booking {stand} from {ci} to {co}. To secure your stand please pay the deposit of {deposit} by {depdue} using reference {ref}.\n\nBank: FNB · Account: Kyleu Bush Camp · Acc no: 62000000000 · Branch: 250655\n\nPlease email proof of payment to info@kyleu.co.za.\n\nSee you in the bush!\nThe Kyleu team'; } },
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
        b.notes.push({ at: nowStamp(), by: ME.name, text: 'Sent "' + f.elements.s.value + '" by ' + (via === 'wa' ? 'WhatsApp' : 'email') + '.' });
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
    var newEnq = DB.enquiries.filter(function (e) { return e.status === 'new'; });
    if (newEnq.length) attention.push({ i: 'mail', tone: 'warn', t: newEnq.length + ' new enquir' + (newEnq.length > 1 ? 'ies' : 'y') + ' waiting for a reply', go: 'enquiries', o: 4 });
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
        '<div class="eft-due ' + (left < 0 ? 'bad-t' : left <= 1 ? 'warn-t' : '') + '">' + ic('clock') + (left < 0 ? 'Overdue by ' + -left + ' day' + (-left > 1 ? 's' : '') : 'Due ' + fd(due) + ' (' + rel(due) + ')') + (b.pop ? '<span class="info-t pop-line">' + ic('note') + 'Proof of payment received ' + fd(b.created.slice(0, 10)) + '</span>' : '') + '</div>' +
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

  var PAYF = { month: TODAY.slice(0, 7), m: '' };
  function allPayments() {
    var out = [];
    DB.bookings.forEach(function (b) { (b.payments || []).forEach(function (p) { out.push({ d: p.d, ref: b.ref, who: guestName(b), what: p.type + ' · ' + standById(b.stand).name, m: p.m, amt: p.amt, fee: p.m === 'card' && p.amt > 0 ? Math.round(p.amt - p.amt / (1 + cardFee() / 100)) : 0 }); }); });
    DB.sales.forEach(function (s) { out.push({ d: s.d, ref: '', who: s.stand ? 'Shop · ' + s.stand : 'Shop', what: s.qty + ' × ' + s.item, m: s.m, amt: s.amt, fee: s.m === 'card' ? Math.round(s.amt - s.amt / (1 + cardFee() / 100)) : 0 }); });
    return out.sort(function (a, b) { return a.d < b.d ? 1 : -1; });
  }
  function vPayments() {
    var months = []; for (var i = -5; i <= 1; i++) { var d = D(TODAY.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + i); months.push(iso(d).slice(0, 7)); }
    var list = allPayments().filter(function (p) { return p.d.slice(0, 7) === PAYF.month && (!PAYF.m || p.m === PAYF.m); });
    var sum = function (f) { return list.filter(f).reduce(function (a, p) { return a + p.amt; }, 0); };
    var cardIn = sum(function (p) { return p.m === 'card' && p.amt > 0; }), eftIn = sum(function (p) { return p.m === 'eft' && p.amt > 0; }), cashIn = sum(function (p) { return p.m === 'cash' && p.amt > 0; }), refunds = -sum(function (p) { return p.amt < 0; });
    var feeCollected = list.reduce(function (a, p) { return a + p.fee; }, 0), provider = Math.round(cardIn * (DB.settings.providerFee || 2.95) / 100);
    return '<div class="page-h"><div><h1>Payments</h1><p class="muted">Every rand in and out: bookings, shop sales and refunds.</p></div><div class="ph-act"><select data-pm aria-label="Month">' + months.map(function (m) { return '<option value="' + m + '"' + (m === PAYF.month ? ' selected' : '') + '>' + D(m + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) + '</option>'; }).join('') + '</select><button class="btn ghost" data-act="csv-pay">' + ic('download') + 'Export</button></div></div>' +
      '<div class="kpis">' + tile('Total received', money(cardIn + eftIn + cashIn - refunds), list.length + ' transactions', null, 'ok') + tile('Card', money(cardIn), 'card prices, incl. fee', null) + tile('EFT', money(eftIn), 'normal prices', null) + tile('Cash', money(cashIn), 'mostly shop', null) + tile('Refunds', money(refunds), 'cancellations', null) +
      tile('Card fee covered', money(feeCollected), 'guests paid extra · provider cost about ' + money(provider), null, feeCollected >= provider ? 'ok' : 'warn') + '</div>' +
      '<div class="chips"><button class="chip' + (!PAYF.m ? ' on' : '') + '" data-pmm="">All</button><button class="chip' + (PAYF.m === 'card' ? ' on' : '') + '" data-pmm="card">Card</button><button class="chip' + (PAYF.m === 'eft' ? ' on' : '') + '" data-pmm="eft">EFT</button><button class="chip' + (PAYF.m === 'cash' ? ' on' : '') + '" data-pmm="cash">Cash</button></div>' +
      '<div class="card flush"><table class="tbl"><thead><tr><th>Date</th><th>From</th><th>For</th><th>Method</th><th class="r">Amount</th><th class="r">Card fee part</th></tr></thead><tbody>' +
      (list.length ? list.map(function (p) { return '<tr' + (p.ref ? ' data-open="' + p.ref + '" tabindex="0"' : '') + '><td data-l="Date">' + fd(p.d) + '</td><td data-l="From"><b>' + esc(p.who) + '</b>' + (p.ref ? '<small>' + p.ref + '</small>' : '') + '</td><td data-l="For">' + esc(p.what) + '</td><td data-l="Method"><span class="mth ' + p.m + '"><i></i>' + methodLabel(p.m) + '</span></td><td data-l="Amount" class="r ' + (p.amt < 0 ? 'bad-t' : '') + '">' + money(p.amt) + '</td><td data-l="Card fee" class="r muted">' + (p.fee ? money(p.fee) : '') + '</td></tr>'; }).join('') : '<tr><td colspan="6" class="empty">No payments in this month.</td></tr>') + '</tbody></table></div>';
  }

  var CART = {};
  function vShop() {
    var items = shopItems(), lines = Object.keys(CART).filter(function (k) { return CART[k]; });
    var tot = function (card) { return lines.reduce(function (a, k) { var it = items.filter(function (i) { return i.label === k; })[0]; return a + (card ? toCard(it.amount) : it.amount) * CART[k]; }, 0); };
    var todays = DB.sales.filter(function (s) { return s.d === TODAY; });
    var drives = DB.bookings.filter(function (b) { return live(b) && b.extras && b.extras.gd && b.co >= TODAY; }).sort(function (a, b) { return a.ci < b.ci ? -1 : 1; }).slice(0, 12);
    return '<div class="page-h"><div><h1>Shop & game drives</h1><p class="muted">Ring up shop sales at reception and see who is booked on a game drive.</p></div></div>' +
      '<div class="cols"><section class="card"><header class="card-h"><h3>Quick sale</h3><span class="muted small">Tap to add</span></header><div class="pos">' + items.map(function (it) { return '<button class="pos-it' + (CART[it.label] ? ' on' : '') + '" data-add="' + esc(it.label) + '"><b>' + esc(it.label) + '</b><span>' + money(it.amount) + ' <small>card ' + money(toCard(it.amount)) + '</small></span>' + (CART[it.label] ? '<em>' + CART[it.label] + '</em>' : '') + '</button>'; }).join('') + '</div>' +
      '<div class="cart">' + (lines.length ? lines.map(function (k) { return '<div class="ln"><span>' + CART[k] + ' × ' + esc(k) + '</span><button class="icon-btn sm" data-rem="' + esc(k) + '" aria-label="Remove one">' + ic('minus') + '</button></div>'; }).join('') +
        '<div class="ln tot"><span>Cash or EFT</span><span>' + money(tot(false)) + '</span></div><div class="ln"><span>Card</span><span>' + money(tot(true)) + '</span></div>' +
        '<label class="fld"><span>Stand (optional)</span><select data-sale-stand><option value="">Walk-in / not on a stand</option>' + STANDS.map(function (s) { return '<option>' + esc(s.name) + '</option>'; }).join('') + '</select></label>' +
        '<div class="row-btns"><button class="btn" data-sell="cash">' + ic('cash') + 'Cash ' + money(tot(false)) + '</button><button class="btn blue" data-sell="card">' + ic('card') + 'Card ' + money(tot(true)) + '</button></div>' : '<p class="empty">Nothing added yet.</p>') + '</div></section>' +
      '<section class="card"><header class="card-h"><h3>Today\'s shop sales</h3><span class="count">' + money(todays.reduce(function (a, s) { return a + s.amt; }, 0)) + '</span></header><ul class="feed">' + (todays.length ? todays.slice().reverse().map(function (s) { return '<li><span>' + s.qty + ' × ' + esc(s.item) + (s.stand ? ' · ' + esc(s.stand) : '') + '</span><small>' + methodLabel(s.m) + ' · ' + money(s.amt) + '</small></li>'; }).join('') : '<li><span class="muted">No sales yet today.</span></li>') + '</ul>' +
      '<header class="card-h"><h3>Upcoming game drives</h3></header><ul class="feed">' + drives.map(function (b) { return '<li data-open="' + b.ref + '"><span><b>' + esc(guestName(b)) + '</b> · ' + b.extras.gd + ' people · ' + esc(standById(b.stand).name) + '</span><small>During stay ' + fd(b.ci) + ' to ' + fd(b.co) + ' · guide to confirm time</small></li>'; }).join('') + '</ul></section></div>';
  }

  var ENQ = null;
  function vEnquiries() {
    var list = DB.enquiries, e = ENQ ? list.filter(function (x) { return x.id === ENQ; })[0] : null;
    return '<div class="page-h"><div><h1>Enquiries</h1><p class="muted">Messages from the website contact form. ' + list.filter(function (x) { return x.status === 'new'; }).length + ' waiting for a reply.</p></div></div>' +
      '<div class="inbox' + (e ? ' reading' : '') + '"><ul class="card flush inbox-list">' + list.map(function (x) { return '<li><button class="' + (x.status === 'new' ? 'unread' : '') + (ENQ === x.id ? ' on' : '') + '" data-enq="' + x.id + '"><span class="who"><b>' + esc(x.name) + '</b><small>' + esc(x.d.slice(0, 10) === TODAY ? 'Today ' + x.d.slice(11) : fd(x.d.slice(0, 10))) + '</small></span><span class="subj">' + esc(x.subject) + '</span><span class="prev">' + esc(x.msg) + '</span></button></li>'; }).join('') + '</ul>' +
      '<section class="card inbox-read">' + (e ? '<button class="btn ghost sm back" data-enq="">' + ic('chev-l') + 'All enquiries</button><h3>' + esc(e.subject) + '</h3><p class="muted small">' + esc(e.name) + ' · ' + esc(e.email) + ' · ' + esc(e.phone) + ' · ' + esc(e.d) + '</p><p class="msg">' + esc(e.msg) + '</p>' +
        '<form data-reply="' + e.id + '"><label class="fld"><span>Reply</span><textarea name="r" rows="5">Hi ' + esc(e.name.split(' ')[0]) + ',\n\nThank you for getting in touch. </textarea></label><div class="row-btns"><button class="btn" type="submit">' + ic('send') + 'Send reply</button><button class="btn ghost" type="button" data-act="enq-book" data-ref="' + e.id + '">' + ic('plus') + 'Make a booking</button></div></form>' : '<p class="empty">Choose a message to read it.</p>') + '</section></div>';
  }

  function vStands() {
    var tonight = standsBookedOn(TODAY);
    return '<div class="page-h"><div><h1>Stands & blocks</h1><p class="muted">' + STANDS.length + ' stands. Names, photos and descriptions come from content/stands.md.</p></div><div class="ph-act"><button class="btn" data-act="block">' + ic('lock') + 'Block dates</button></div></div>' +
      '<section class="card"><header class="card-h"><h3>Blocked dates</h3><span class="muted small">Maintenance, owner holds, private events</span></header>' + (DB.blocks.length ? '<ul class="feed">' + DB.blocks.map(function (k) { return '<li><span><b>' + esc(standById(k.stand).name) + '</b> · ' + fd(k.from) + ' to ' + fd(k.to) + ' · ' + esc(k.reason) + '</span><button class="btn sm ghost" data-unblock="' + k.id + '">Remove</button></li>'; }).join('') + '</ul>' : '<p class="empty">No blocks.</p>') + '</section>' +
      ['fenced', 'unfenced', 'self-sufficient'].map(function (a) {
        return '<h3 class="grp">' + AREA_SHORT[a] + '</h3><div class="stand-grid">' + STANDS.filter(function (s) { return s.area === a; }).map(function (s) {
          var b = tonight[s.id], nxt = DB.bookings.filter(function (x) { return live(x) && x.stand === s.id && x.ci > TODAY; })[0], closed = DB.closed[s.id];
          return '<article class="stand' + (closed ? ' closed' : '') + '">' + (s.photos[0] ? '<img src="../' + esc(s.photos[0]) + '" alt="" loading="lazy">' : '<div class="ph"></div>') + '<div class="stand-b"><b>' + esc(s.name) + '</b><small>' + s.guests + ' guests · ' + esc(s.setups) + '</small>' +
            '<p class="small">' + (closed ? '<span class="pill muted"><i></i>Closed to bookings</span>' : b ? 'Tonight: <a href="#" data-open="' + b.ref + '">' + esc(guestName(b)) + '</a>' : '<span class="ok-t">Free tonight</span>') + (nxt ? '<br><span class="muted">Next: ' + fd(nxt.ci) + ', ' + esc(nxt.guest.last) + '</span>' : '') + '</p>' +
            '<label class="switch"><input type="checkbox" data-close-stand="' + s.id + '"' + (closed ? '' : ' checked') + '><span></span>Open for bookings</label></div></article>';
        }).join('') + '</div>';
      }).join('');
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

  function vRates() {
    var secs = P.sections.filter(function (s) { return s.items.length && !/holiday|dinokeng/i.test(s.title); });
    return '<div class="page-h"><div><h1>Rates & fees</h1><p class="muted">Enter the <b>normal (EFT) price</b>. Card prices are worked out by adding the card fee. Dinokeng\'s fees are not Kyleu\'s, so they are not managed here.</p></div><div class="ph-act"><button class="btn" data-act="save-rates">' + ic('check') + 'Save prices</button></div></div>' +
      '<div class="card fee-card"><div><h3>Card payment fee</h3><p class="muted small">Added to every price when a guest pays by card. EFT and cash pay the normal price. Your card provider charges about ' + (DB.settings.providerFee || 2.95) + '%.</p></div><label class="fld inline"><input data-rate="Booking rules|Card payment fee percentage" inputmode="decimal" value="' + cardFee() + '"><span>%</span></label></div>' +
      '<div class="rate-grid">' + secs.map(function (s) {
        return '<section class="card"><header class="card-h"><h3>' + esc(s.title) + '</h3></header><table class="tbl rates"><thead><tr><th>Item</th><th class="r">EFT price</th><th class="r">Card price</th></tr></thead><tbody>' + s.items.filter(function (it) { return !isNaN(it.amount); }).map(function (it) {
          var v = num(s.title, it.label, it.amount), rule = /booking rules/i.test(s.title);
          if (/card payment fee/i.test(it.label)) return '';
          return '<tr><td data-l="Item">' + esc(it.label) + (it.note ? '<small>' + esc(it.note) + '</small>' : '') + '</td><td data-l="' + (rule ? 'Value' : 'EFT price') + '" class="r"><label class="money-in">' + (rule ? '' : 'R') + '<input data-rate="' + esc(s.title + '|' + it.label) + '" inputmode="numeric" value="' + v + '" aria-label="' + esc(it.label) + '"></label></td><td data-l="Card price" class="r muted" data-cardof="' + esc(s.title + '|' + it.label) + '">' + (rule || !v ? '' : money(toCard(v))) + '</td></tr>';
        }).join('') + '</tbody></table></section>';
      }).join('') + '</div>' +
      '<section class="card"><header class="card-h"><h3>Long weekends and public holidays</h3><span class="muted small">Nights before these dates are charged at the weekend rate</span></header><div class="chips">' + Object.keys(P.holidays).filter(function (d) { return d >= TODAY; }).map(function (d) { return '<span class="chip">' + fd(d, { day: 'numeric', month: 'short', year: 'numeric' }) + ' · ' + esc(P.holidays[d]) + '</span>'; }).join('') + '</div></section>' +
      '<p class="demo-note">' + ic('info') + 'Demo: saved prices are used by this admin straight away. In the live version, saving here also updates the website, so content/prices.md is no longer needed.</p>';
  }

  var REP = { range: 'last6' };
  function vReports() {
    var months = []; for (var i = -2; i <= 3; i++) { var d = D(TODAY.slice(0, 7) + '-01'); d.setMonth(d.getMonth() + i); months.push(iso(d).slice(0, 7)); }
    var rev = months.map(function (m) {
      var card = 0, eft = 0; DB.bookings.forEach(function (b) { if (!live(b) || b.ci.slice(0, 7) !== m) return; if (b.method === 'card') card += b.total; else eft += b.total; });
      return { label: D(m + '-01').toLocaleDateString('en-ZA', { month: 'short' }), a: card, b: eft, hl: m === TODAY.slice(0, 7), tip: D(m + '-01').toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }) + ': card ' + money(card) + ' · EFT ' + money(eft) + ' · total ' + money(card + eft) };
    });
    var from = add(TODAY, -90), nightsAvail = {}, nightsSold = {};
    Object.keys(AREA_SHORT).forEach(function (a) { nightsAvail[a] = STANDS.filter(function (s) { return s.area === a; }).length * 90; nightsSold[a] = 0; });
    var src = {}, stays = 0, nights = 0, party = 0, lead = 0, canc = 0, tot = 0, card = 0;
    DB.bookings.forEach(function (b) {
      if (b.ci >= from && b.ci < TODAY) { tot++; if (!live(b)) { canc++; return; } var st = standById(b.stand); nightsSold[st.area] += diff(b.ci, b.co); }
      if (!live(b)) return;
      src[b.source] = (src[b.source] || 0) + 1; stays++; nights += diff(b.ci, b.co); party += people(b); lead += Math.max(0, diff(b.created.slice(0, 10), b.ci)); if (b.method === 'card') card++;
    });
    return '<div class="page-h"><div><h1>Reports</h1><p class="muted">How the camp is doing. Hover or tap a bar for the numbers.</p></div><div class="ph-act"><button class="btn ghost" data-act="csv-bookings">' + ic('download') + 'Export bookings</button></div></div>' +
      '<div class="kpis">' + tile('Average stay', (nights / stays).toFixed(1) + ' nights', stays + ' bookings') + tile('Average group', (party / stays).toFixed(1) + ' people', 'adults and kids') + tile('Booked ahead', Math.round(lead / stays) + ' days', 'on average') + tile('Paid by card', Math.round(card / stays * 100) + '%', 'the rest pay EFT or cash') + tile('Cancelled', (tot ? Math.round(canc / tot * 100) : 0) + '%', 'last 90 days') + '</div>' +
      '<section class="card"><header class="card-h"><h3>Booking value by arrival month</h3><div class="key"><span><i style="background:' + C_CARD + '"></i>Card</span><span><i style="background:' + C_EFT + '"></i>EFT / cash</span></div></header>' + colChart(rev, { fmt: kfmt, band: 70, bar: 24, label: 'Booking value by month, card and EFT' }) +
      '<details class="tbl-view"><summary>Show as a table</summary><table class="tbl"><thead><tr><th>Month</th><th class="r">Card</th><th class="r">EFT / cash</th><th class="r">Total</th></tr></thead><tbody>' + rev.map(function (r) { return '<tr><td>' + r.label + '</td><td class="r">' + money(r.a) + '</td><td class="r">' + money(r.b) + '</td><td class="r"><b>' + money(r.a + r.b) + '</b></td></tr>'; }).join('') + '</tbody></table></details></section>' +
      '<div class="cols"><section class="card"><header class="card-h"><h3>Occupancy by area, last 90 days</h3></header>' + hbars(Object.keys(AREA_SHORT).map(function (a) { var p = Math.round(nightsSold[a] / nightsAvail[a] * 100); return { l: AREA_SHORT[a], v: p, t: p + '%', tip: nightsSold[a] + ' of ' + nightsAvail[a] + ' stand nights' }; }), { max: 100 }) + '</section>' +
      '<section class="card"><header class="card-h"><h3>Where bookings come from</h3></header>' + hbars(Object.keys(src).sort(function (a, b) { return src[b] - src[a]; }).map(function (k) { return { l: k, v: src[k], t: src[k] + ' (' + Math.round(src[k] / stays * 100) + '%)' }; })) + '</section></div>';
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

  var VIEWS = { dashboard: vDashboard, bookings: vBookings, eft: vEft, calendar: vCalendar, guests: vGuests, payments: vPayments, shop: vShop, enquiries: vEnquiries, stands: vStands, rates: vRates, reports: vReports, settings: vSettings };
  function route() { var v = (location.hash.match(/^#\/(\w+)/) || [])[1] || 'dashboard'; return VIEWS[v] && can(v) ? v : 'dashboard'; }

  /* ---------- shell ---------- */
  function badges() {
    return { eft: DB.bookings.filter(function (b) { return b.status === 'pending'; }).length, enquiries: DB.enquiries.filter(function (e) { return e.status === 'new'; }).length, bookings: DB.bookings.filter(function (b) { return b.isNew; }).length };
  }
  function shell() {
    var bd = badges();
    app.innerHTML = '<aside class="side"><a class="brand" href="#/dashboard"><img src="../assets/img/logo-small.png" alt=""><span><b>Kyleu</b><small>Staff admin</small></span></a><nav>' +
      NAV.filter(function (n) { return can(n.id); }).map(function (n) { return '<a href="#/' + n.id + '" data-nav="' + n.id + '">' + ic(n.i) + '<span>' + n.t + '</span>' + (bd[n.id] ? '<em>' + bd[n.id] + '</em>' : '') + '</a>'; }).join('') +
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
    var pm = t.closest('[data-pmm]'); if (pm) { PAYF.m = pm.dataset.pmm; render(); return; }
    var en = t.closest('[data-enq]'); if (en) { ENQ = en.dataset.enq || null; render(); return; }
    var se = t.closest('[data-set]'); if (se) { SET = se.dataset.set; render(); return; }
    var ad = t.closest('[data-add]'); if (ad) { CART[ad.dataset.add] = (CART[ad.dataset.add] || 0) + 1; render(); return; }
    var rm = t.closest('[data-rem]'); if (rm) { CART[rm.dataset.rem]--; render(); return; }
    var sl = t.closest('[data-sell]'); if (sl) {
      var m = sl.dataset.sell, items = shopItems(), stand = ($('[data-sale-stand]') || {}).value || '', total = 0;
      Object.keys(CART).forEach(function (k) { if (!CART[k]) return; var it = items.filter(function (i) { return i.label === k; })[0], amt = (m === 'card' ? toCard(it.amount) : it.amount) * CART[k]; total += amt; DB.sales.push({ d: TODAY, item: k, qty: CART[k], m: m, amt: amt, stand: stand }); });
      CART = {}; log('Shop sale ' + money(total) + ' (' + methodLabel(m) + ')'); save(); render(); toast('Sale of ' + money(total) + ' recorded'); return;
    }
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
    if (act === 'checkin' || act === 'checkout') { var b = byRef(ref); if (act === 'checkin') { b.status = 'in'; if (balance(b) > 0) b.notes.push({ at: nowStamp(), by: ME.name, text: 'Checked in with ' + money(balance(b)) + ' still owing. Collect at reception.' }); } else b.status = 'out'; log(guestName(b) + (act === 'checkin' ? ' checked in at ' : ' checked out of ') + standById(b.stand).name, b.ref); save(); refresh(); toast(act === 'checkin' ? (balance(b) > 0 ? 'Checked in. ' + money(balance(b)) + ' still owing: collect at reception' : 'Checked in. Enjoy your stay, ' + esc(b.guest.first) + '!') : 'Checked out. The stand is ready for cleaning.'); return; }
    if (act === 'csv-bookings') { csv('kyleu-bookings.csv', [['Ref', 'Created', 'Source', 'Guest', 'Email', 'Phone', 'Stand', 'Area', 'Arrive', 'Depart', 'Nights', 'Adults', 'Pensioners', 'Kids', 'Pays by', 'EFT price', 'Card price', 'Total', 'Paid', 'Balance', 'Status']].concat(DB.bookings.map(function (b) { var st = standById(b.stand); return [b.ref, b.created, b.source, guestName(b), b.guest.email, b.guest.phone, st.name, AREA_SHORT[st.area], b.ci, b.co, diff(b.ci, b.co), b.adults, b.pens, b.kids, methodLabel(b.method), b.eft, b.card, b.total, paid(b), balance(b), stateOf(b).t]; }))); return; }
    if (act === 'csv-guests') { csv('kyleu-mailing-list.csv', [['Name', 'Email', 'Phone', 'Stays', 'Last visit']].concat(guestsList().filter(function (g) { return g.consent; }).map(function (g) { return [g.name, g.email, g.phone, g.stays, g.last]; }))); toast('Only guests who agreed to receive news are exported'); return; }
    if (act === 'csv-pay') { csv('kyleu-payments-' + PAYF.month + '.csv', [['Date', 'Ref', 'From', 'For', 'Method', 'Amount', 'Card fee part']].concat(allPayments().filter(function (p) { return p.d.slice(0, 7) === PAYF.month; }).map(function (p) { return [p.d, p.ref, p.who, p.what, methodLabel(p.m), p.amt, p.fee]; }))); return; }
    if (act === 'save-rates') {
      $$('[data-rate]').forEach(function (inp) { var v = parseFloat(inp.value.replace(/[^\d.]/g, '')); if (!isNaN(v)) { var k = inp.dataset.rate.split('|'); var orig = P.num(k[0], k[1], null); if (orig !== v) DB.rates[k[0] + '|' + k[1]] = v; else delete DB.rates[k[0] + '|' + k[1]]; } });
      log('Prices updated'); save(); render(); toast('Prices saved'); return;
    }
    if (act === 'enq-book') { var q = DB.enquiries.filter(function (x) { return x.id === ref; })[0], nm = q.name.split(' '); actNew({ first: nm[0], last: nm.slice(1).join(' '), email: q.email, phone: q.phone }); return; }
    if (act === 'invite') { modal('Invite a staff member', '<label class="fld"><span>Name</span><input name="n"></label><label class="fld"><span>Email</span><input name="e" type="email"></label><label class="fld"><span>Role</span><select name="r">' + Object.keys(ROLES).map(function (r) { return '<option>' + r + '</option>'; }).join('') + '</select></label>', 'Send invite', function () { toast('Invite sent (demo)'); }); return; }
    if (act === 'connect') { modal('Connect ' + esc(ref), '<p>In the live version you would sign in to your ' + esc(ref) + ' account here. Guests then pay on ' + esc(ref) + '\'s secure page and the booking is confirmed by itself the moment the payment goes through.</p><p class="muted small">Card numbers never touch the Kyleu website.</p>', null); return; }
    if (act === 'export-json') { var bl = document.createElement('a'); bl.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 1)], { type: 'application/json' })); bl.download = 'kyleu-admin-backup.json'; bl.click(); return; }
    if (act === 'reset') { modal('Reset demo data?', '<p>All demo bookings, payments and notes go back to the start. Bookings made on the website demo are removed too.</p>', 'Reset', function () { try { localStorage.removeItem(KEY); localStorage.removeItem(WEB); } catch (x) {} DB = seed(); save(); render(); toast('Demo data reset'); }, { danger: true }); return; }
  }
  function onInput(e) {
    var t = e.target;
    if (t.matches('[data-f=q]')) { F.q = t.value; var pos = t.selectionStart; render(); var i = $('[data-f=q]'); i.focus(); i.setSelectionRange(pos, pos); return; }
    if (t.matches('[data-gq]')) { GQ = t.value; var p2 = t.selectionStart; render(); var g = $('[data-gq]'); g.focus(); g.setSelectionRange(p2, p2); return; }
    if (t.matches('[data-rate]')) { var c = $('[data-cardof="' + t.dataset.rate.replace(/"/g, '\\"') + '"]'), v = parseFloat(t.value); if (/card payment fee/i.test(t.dataset.rate)) return; if (c) c.textContent = v ? money(Math.round(v * (1 + (parseFloat(($('[data-rate="Booking rules|Card payment fee percentage"]') || {}).value) || cardFee()) / 100))) : ''; return; }
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
    if (t.matches('[data-pm]')) { PAYF.month = t.value; render(); }
    if (t.matches('[data-close-stand]')) { var id = t.dataset.closeStand; if (t.checked) delete DB.closed[id]; else DB.closed[id] = true; log(standById(id).name + (t.checked ? ' opened' : ' closed') + ' for bookings'); save(); render(); toast(standById(id).name + (t.checked ? ' is open for bookings' : ' is closed to new bookings')); }
  }
  function onSubmit(e) {
    var f = e.target;
    if (f.matches('[data-note]')) { e.preventDefault(); var v = f.elements.t.value.trim(); if (!v) return; var b = byRef(f.dataset.note); b.notes.push({ at: nowStamp(), by: ME.name, text: v }); save(); refresh(); return; }
    if (f.matches('[data-reply]')) { e.preventDefault(); var q = DB.enquiries.filter(function (x) { return x.id === f.dataset.reply; })[0]; q.status = 'replied'; log('Replied to ' + q.name); save(); render(); toast('Reply sent to ' + esc(q.email) + ' (demo)'); }
  }
  // tooltips for charts
  function onOver(e) {
    var g = e.target.closest && e.target.closest('[data-tip]'), tip = $('.tip'); if (!tip) return;
    if (!g) { tip.hidden = true; return; }
    tip.textContent = g.dataset.tip; tip.hidden = false;
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
      if (e.key === 'Enter' && e.target.matches('tr[data-open],tr[data-guest]')) e.target.click();
    });
    document.addEventListener('focusout', function (e) { if (e.target.matches('[data-global]')) setTimeout(function () { var s = $('[data-sugg]'); if (s) s.hidden = true; }, 200); });
    window.addEventListener('hashchange', function () { document.body.classList.remove('nav-open'); if (ME) { render(); window.scrollTo(0, 0); } });
    // pick up website demo bookings made in another tab
    window.addEventListener('storage', function (e) { if (e.key === WEB && ME && importWeb()) { render(); toast('New booking from the website'); } });
    Promise.all([K.prices(), K.stands()]).then(function (r) {
      P = r[0]; STANDS = r[1]; loadDB();
      var id = null; try { id = sessionStorage.getItem(SESS); } catch (e) {}
      var s = STAFF.filter(function (x) { return x.id === id; })[0];
      if (s) start(s); else login();
    }).catch(function () { app.innerHTML = '<div class="login"><div class="login-card"><h1>Couldn\'t load</h1><p>The admin reads the content folder. Open it through the preview server (Preview website.bat).</p></div></div>'; });
  });
})();
