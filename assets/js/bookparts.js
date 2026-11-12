/* =========================================================
   Pieces shared by the booking checkout (stay.html) and
   "Change my booking" (manage.html):
   - K.carsEditor: one card per vehicle with registration, driver and passengers
   - K.shopItems / K.shopPicker: camp shop items to have waiting on arrival
   - K.intlNote: the note for guests booking from outside South Africa
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var svg = function (id) { return '<svg aria-hidden="true"><use href="#' + id + '"/></svg>'; };

  /* ---------- vehicles: registration, driver, then everyone else in the car ----------
     o: { count: number of vehicles (0 = not sure yet), cars: [{reg, driver, guests: []}], total: people on the booking,
          later: text shown when the count is "not sure yet", onChange: function () } */
  K.carsEditor = function (box, o) {
    o = o || {};
    var n = o.count == null ? 1 : o.count, total = o.total || 0, auto = '';
    var cars = (o.cars || []).map(function (c) { return { reg: c.reg || '', driver: c.driver || '', guests: (c.guests || []).slice(), minors: (c.minors || []).slice() }; });
    var isMinor = function (c, name) { var k = String(name || '').trim().toLowerCase(); return !!k && (c.minors || []).some(function (m) { return String(m).trim().toLowerCase() === k; }); };
    function blank() { return { reg: '', driver: '', guests: [], minors: [] }; }
    function read() {
      $$('.car-card', box).forEach(function (el, i) {
        var c = cars[i]; if (!c) return;
        c.reg = el.querySelector('[name=car-reg]').value.toUpperCase();
        c.driver = el.querySelector('[name=car-driver]').value;
        c.guests = $$('[name=car-guest]', el).map(function (x) { return x.value; });
        c.minors = $$('.cc-p', el).filter(function (r) { var t = r.querySelector('[name=car-minor]'); return t && t.checked && r.querySelector('[name=car-guest]').value.trim(); }).map(function (r) { return r.querySelector('[name=car-guest]').value.trim(); });
      });
    }
    function named() { var k = 0; cars.slice(0, n).forEach(function (c) { if (c.driver.trim()) k++; c.guests.forEach(function (g) { if (g.trim()) k++; }); }); return k; }
    function count() {
      var el = box.querySelector('[data-cars-count]'); if (!el) return;
      var k = named(), t = total;
      // the drivers and passengers should add up to the number of guests on the booking
      el.className = 'cars-count' + (!k ? '' : k === t ? ' ok' : k > t ? ' bad' : ' warn');
      el.innerHTML = !k ? svg('i-users') + '<span>Names are optional for now. Your booking is for <b>' + t + ' ' + (t === 1 ? 'person' : 'people') + '</b>, so you will name ' + t + ' people in total (drivers and passengers).</span>'
        : k === t ? svg('i-check') + '<span>Everyone is named: <b>' + k + ' of ' + t + ' people</b>. Thank you!</span>'
        : k > t ? svg('i-info') + '<span><b>The numbers do not match.</b> You have named <b>' + k + ' people</b> in the vehicles, but the booking is for <b>' + t + '</b>. ' + (o.overText || 'Remove a name, or go back to step 2 to change the number of guests.') + '</span>'
        : svg('i-info') + '<span><b>' + (t - k) + ' ' + (t - k === 1 ? 'person is' : 'people are') + ' not named yet.</b> You have named ' + k + ' of the ' + t + ' people on the booking. Add the rest now, or later before you arrive.</span>';
    }
    function draw(focus) {
      if (!n) {
        box.innerHTML = '<div class="cars-later">' + svg('i-clock') + '<p>' + (o.later || '<b>No problem.</b> Before you arrive, tell us how many vehicles are coming, with each registration, driver and the passengers in it. Use the link to your booking any time, or WhatsApp us.') + '</p></div>';
        return;
      }
      while (cars.length < n) cars.push(blank());
      box.innerHTML = cars.slice(0, n).map(function (c, i) {
        var lab = 'Vehicle ' + (i + 1);
        return '<div class="car-card" data-i="' + i + '"><div class="cc-h"><span class="cc-ic">' + svg('i-car') + '</span><b>' + lab + '</b><small>Fill in what you know now</small></div>' +
          '<div class="cc-grid"><label class="cc-f"><span>Registration</span><input name="car-reg" value="' + esc(c.reg) + '" placeholder="e.g. CA 123-456" autocomplete="off" aria-label="' + lab + ' registration"></label>' +
          '<label class="cc-f"><span>Driver\'s full name</span><input name="car-driver" value="' + esc(c.driver) + '" placeholder="Who is driving?" aria-label="' + lab + ' driver"></label></div>' +
          '<div class="cc-pass"><span class="cc-pl">Passengers in this vehicle <small>(everyone else in it, children too)</small></span>' +
          c.guests.map(function (g, j) { return '<div class="cc-p"><span class="cc-pn">' + (j + 1) + '</span><input name="car-guest" value="' + esc(g) + '" placeholder="Passenger\'s full name" aria-label="' + lab + ' passenger ' + (j + 1) + '"><label class="cc-u18" title="Tick this for anyone under 18"><input type="checkbox" name="car-minor"' + (isMinor(c, g) ? ' checked' : '') + '> Under 18</label><button type="button" class="cc-x" data-rm="' + j + '" aria-label="Remove passenger ' + (j + 1) + '">' + svg('i-x') + '</button></div>'; }).join('') +
          '<button type="button" class="cc-add" data-add>' + svg('i-plus') + (c.guests.length ? 'Add another passenger' : 'Add a passenger') + '</button></div></div>';
      }).join('') + '<p class="cars-count" data-cars-count role="status"></p>';
      count();
      if (focus) { var card = box.querySelector('.car-card[data-i="' + focus[0] + '"]'), ins = card ? $$('[name=car-guest]', card) : []; if (ins.length) ins[Math.min(focus[1], ins.length - 1)].focus(); }
    }
    if (!box.dataset.wired) {
      box.dataset.wired = '1';
      box.addEventListener('click', function (e) {
        var card = e.target.closest('.car-card'); if (!card) return; var i = +card.dataset.i;
        if (e.target.closest('[data-add]')) { read(); cars[i].guests.push(''); draw([i, cars[i].guests.length - 1]); if (o.onChange) o.onChange(); }
        var rm = e.target.closest('[data-rm]'); if (rm) { read(); cars[i].guests.splice(+rm.dataset.rm, 1); draw(); if (o.onChange) o.onChange(); }
      });
      box.addEventListener('input', function (e) {
        if (e.target.name === 'car-driver' && e.target.closest('.car-card[data-i="0"]')) auto = '';
        if (e.target.name === 'car-minor') { read(); if (o.onChange) o.onChange(); return; }
        read(); count(); if (o.onChange) o.onChange();
      });
      box.addEventListener('keydown', function (e) {   // Enter in a passenger box adds the next passenger instead of sending the form
        if (e.key !== 'Enter' || e.target.name !== 'car-guest') return; e.preventDefault();
        var card = e.target.closest('.car-card'); if (card) card.querySelector('[data-add]').click();
      });
    }
    draw();
    return {
      setCount: function (k) { read(); n = Math.max(0, k | 0); draw(); },
      setTotal: function (t) { total = t; count(); },
      over: function () { read(); return n > 0 && named() > total; },
      total: function () { return total; },
      showCount: function () { var el = box.querySelector('[data-cars-count]'); if (el) { el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake'); el.scrollIntoView({ block: 'center', behavior: 'smooth' }); } },
      // fill vehicle 1's driver with the booker's name, until they type their own
      suggestDriver: function (name) { read(); if (!n || !cars[0]) return; if (!cars[0].driver.trim() || cars[0].driver === auto) { cars[0].driver = auto = name; var el = box.querySelector('.car-card[data-i="0"] [name=car-driver]'); if (el) el.value = name; count(); } },
      get: function () {
        read();
        return { count: n, cars: cars.slice(0, n).map(function (c) { var gs = c.guests.map(function (g) { return g.trim(); }).filter(Boolean); return { reg: c.reg.trim(), driver: c.driver.trim(), guests: gs, minors: gs.filter(function (g) { return isMinor(c, g); }) }; }) };
      },
      named: function () { read(); return named(); }
    };
  };

  /* ---------- stay price for a number of guests (same rules as the booking page) ---------- */
  K.stayPrice = function (P, area, ci, co, g) {
    var ss = area === 'self-sufficient', sec = ss ? 'Self-sufficient' : 'Ablution stands';
    var R = { wk: P.num(sec, 'Weekend per person per night', ss ? 180 : 245), wd: P.num(sec, 'Weekday per person per night', ss ? 100 : 160), pe: P.num(sec, 'Pensioner weekday per person per night', ss ? 100 : 115), kid: P.num(sec, 'Children under 12', 0) };
    var p = function (s) { var a = s.split('-'); return new Date(+a[0], a[1] - 1, +a[2]); }, iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
    var acc = 0;
    for (var d = p(ci), end = p(co); d < end; d.setDate(d.getDate() + 1)) {
      var dow = d.getDay(), nx = new Date(d); nx.setDate(nx.getDate() + 1);
      var wk = (P.wkDays ? P.wkDays.indexOf(dow) >= 0 : dow === 5 || dow === 6 || dow === 0) || !!P.holidays[iso(nx)], pens = (!wk && dow >= 1 && dow <= 4) ? R.pe : (wk ? R.wk : R.wd);
      acc += g.adults * (wk ? R.wk : R.wd) + g.pens * pens + g.kids * R.kid;
    }
    return acc;
  };

  // the same invoice lines as a new booking: weekend nights and weekday nights with their dates and rate, children free
  K.stayLines = function (P, area, name, ci, co, g) {
    var ss = area === 'self-sufficient', sec = ss ? 'Self-sufficient' : 'Ablution stands';
    var R = { wk: P.num(sec, 'Weekend per person per night', ss ? 180 : 245), wd: P.num(sec, 'Weekday per person per night', ss ? 100 : 160), pe: P.num(sec, 'Pensioner weekday per person per night', ss ? 100 : 115), kid: P.num(sec, 'Children under 12', 0) };
    var p = function (s) { var a = s.split('-'); return new Date(+a[0], a[1] - 1, +a[2]); }, iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
    var grp = { wk: [], wd: [], pe: [], rest: [] }, all = 0;
    for (var d = p(ci), end = p(co); d < end; d.setDate(d.getDate() + 1)) {
      var dow = d.getDay(), nx = new Date(d); nx.setDate(nx.getDate() + 1);
      var wkDay = P.wkDays ? P.wkDays.indexOf(dow) >= 0 : dow === 5 || dow === 6 || dow === 0, wk = wkDay || !!P.holidays[iso(nx)];
      var x = { d: new Date(d), eve: wk && !wkDay };   // eve: a weekday night charged at the weekend rate because the next day is a public holiday
      all++; grp[wk ? 'wk' : 'wd'].push(x);
      if (!wk) grp[dow >= 1 && dow <= 4 ? 'pe' : 'rest'].push(x);
    }
    var dates = function (ds) {
      var dl = ds.map(function (x, i) { return x.d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }) + (i === ds.length - 1 || x.d.getMonth() !== ds[i + 1].d.getMonth() ? ' ' + x.d.toLocaleDateString('en-ZA', { month: 'short' }) : '') + (x.eve ? ' (night before a public holiday)' : ''); });
      return dl.length > 1 ? dl.slice(0, -1).join(', ') + ' & ' + dl[dl.length - 1] : dl[0];
    };
    var out = [], add = function (word, ds, a, pn, rate, note) {
      var n = a + pn; if (!ds.length || !n) return;
      out.push({ t: name + ' · ' + word + ' night' + (ds.length > 1 ? 's' : '') + ': ' + dates(ds) + ' · ' + K.peopleText({ adults: a, pens: pn }) + ' at ' + K.money(rate) + ' per person' + (note || ''), q: ds.length, u: n * rate, amt: ds.length * n * rate, tag: 'stay' });
    };
    add('weekend', grp.wk, g.adults, g.pens, R.wk);
    if (g.pens && grp.pe.length && R.pe !== R.wd) {   // pensioners pay less on Monday to Thursday nights: a line of their own
      add('weekday', grp.wd, g.adults, 0, R.wd);
      add('weekday', grp.pe, 0, g.pens, R.pe, ' (pensioner rate, Mon to Thu)');
      add('weekday', grp.rest, 0, g.pens, R.wd);
    } else add('weekday', grp.wd, g.adults, g.pens, R.wd);
    if (g.kids && R.kid) out.push({ t: 'Child' + (g.kids === 1 ? '' : 'ren') + ' under 12 at ' + K.money(R.kid) + ' per night', q: all, u: g.kids * R.kid, amt: all * g.kids * R.kid, tag: 'stay' });
    else if (g.kids) out.push({ t: 'Child' + (g.kids === 1 ? '' : 'ren') + ' under 12 (free)', q: g.kids, amt: 0, free: true, tag: 'stay' });
    return out;
  };

  /* ---------- credit from a cancelled booking ----------
     Kyleu gives no refunds. When a cancellation is approved in the admin, what the guest paid can be kept as a credit
     with a code (KC-XXXXXX). The guest types the code when booking again, with the same email address, and it comes off the price.
     Demo: credits are read from the admin demo in this browser. Live: the booking system checks the code. */
  K.creditKey = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  K.creditFind = function (code) {
    var k = K.creditKey(code); if (k.length < 6) return null;
    var db = null, web = []; try { db = JSON.parse(localStorage.getItem('kyleu-admin-demo-v1') || 'null'); } catch (e) {}
    try { web = JSON.parse(localStorage.getItem('kyleu-web-bookings') || '[]') || []; } catch (e) {}
    var c = ((db && db.credits) || []).filter(function (x) { return x && x.code && K.creditKey(x.code) === k; })[0]; if (!c) return null;
    var t = new Date(), today = new Date(t.getTime() - t.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    // credit already used on website bookings that the admin has not taken in yet
    var have = {}; ((db && db.bookings) || []).forEach(function (b) { have[K.creditKey(b.ref)] = 1; });
    var pending = web.reduce(function (a, w) { return a + (w && w.credit && w.credit.id === c.id && !have[K.creditKey(w.ref)] ? (+w.credit.amt || 0) : 0); }, 0);
    var left = Math.max(0, (+c.amt || 0) - (+c.used || 0) - pending);
    return { id: c.id, code: c.code, email: String(c.email || '').toLowerCase(), name: c.name || '', from: c.from || '', until: c.until || '', amt: +c.amt || 0, left: left,
      state: c.void ? 'void' : c.until && c.until < today ? 'expired' : left <= 0 ? 'used' : 'open' };
  };

  /* ---------- camp shop ---------- */
  // K.shopImg (content.js): the photo chosen in the admin, else Kyleu's own photo for that kind of product
  K.shopItems = function (P) {
    var sec = P && P.sections.filter(function (s) { return /shop/i.test(s.title); })[0];
    return (sec ? sec.items : []).filter(function (it) { return !isNaN(it.amount); }).map(function (it) { return { label: it.label, each: it.amount, note: it.note || '', img: K.shopImg(it.label, it.img) }; });
  };
  // qty: { label: number } is changed in place; onChange is called after every tap
  K.shopPicker = function (box, items, qty, onChange) {
    function row(it, i) {
      var q = qty[it.label] || 0;
      return '<div class="addon shop-row' + (q ? ' on' : '') + '"><img src="' + it.img + '" alt="" loading="lazy"><div class="ad-txt"><b>' + esc(it.label) + '</b><small>' + K.money(it.each) + ' each' + (it.note ? ' · ' + esc(it.note) : '') + '</small>' + (q ? '<small class="shop-sum">' + q + ' × ' + K.money(it.each) + ' = <b>' + K.money(q * it.each) + '</b></small>' : '') + '</div>' +
        '<div class="sb-guests"><button type="button" data-sm="' + i + '" aria-label="One less ' + esc(it.label) + '">&minus;</button><output>' + q + '</output><button type="button" data-sp="' + i + '" aria-label="One more ' + esc(it.label) + '">+</button></div></div>';
    }
    function draw() { box.innerHTML = items.length ? items.map(row).join('') : '<p class="muted">The camp shop list is not available right now.</p>'; }
    box.onclick = function (e) {
      var b = e.target.closest('[data-sp],[data-sm]'); if (!b) return;
      var it = items[+(b.dataset.sp || b.dataset.sm)], q = (qty[it.label] || 0) + (b.dataset.sp ? 1 : -1);
      q = Math.max(0, Math.min(it.max || 30, q)); if (q) qty[it.label] = q; else delete qty[it.label];
      draw(); var again = box.querySelector('[data-' + (b.dataset.sp ? 'sp' : 'sm') + '="' + items.indexOf(it) + '"]'); if (again) again.focus();
      if (onChange) onChange();
    };
    draw();
    return { draw: draw };
  };
  K.shopTotal = function (items, qty) { return items.reduce(function (a, it) { return a + (qty[it.label] || 0) * it.each; }, 0); };

  /* ---------- guests booking from outside South Africa ----------
     A bank transfer from another country costs them a lot, so they WhatsApp Kyleu and pay by cash or card on arrival.
     Shown where a guest is asked to pay by EFT (never as a "pay on arrival" choice for everyone).
     Staff can change the heading and the text (data-edit); the WhatsApp number comes from the settings.
     o: { ref: the booking reference once there is one, what: the stand and dates before there is one } */
  var WA = '27604584478';
  function waHref(msg) { return 'https://wa.me/' + WA + '?text=' + encodeURIComponent(msg); }
  if (K.settings) K.settings().then(function (S) {
    var n = S ? String(S.get('WhatsApp number', '') || '').replace(/\D/g, '') : ''; if (!n || n === WA) return;
    WA = n; $$('a[data-intl-wa]').forEach(function (a) { a.href = waHref(a.getAttribute('data-intl-wa')); });
  }).catch(function () {});
  K.intlNote = function (o) {
    o = o || {};
    var msg = 'Hi Kyleu, I am booking from outside South Africa' + (o.ref ? ' (booking ' + o.ref + ')' : o.what ? ' (' + o.what + ')' : '') + ' and would like to pay on arrival.';
    return '<div class="intl-note">' + svg('i-info') + '<div class="intl-body"><h3 data-edit="booking.intl.title">Booking from outside South Africa?</h3>' +
      '<p data-edit="booking.intl.text">Bank transfers from other countries can be expensive. WhatsApp us and we will arrange for you to pay by cash or card when you arrive.</p>' +
      '<a class="btn btn-green btn-sm" href="' + esc(waHref(msg)) + '" data-intl-wa="' + esc(msg) + '" target="_blank" rel="noopener">' + svg('i-wa') + 'WhatsApp Kyleu</a></div></div>';
  };
})();
