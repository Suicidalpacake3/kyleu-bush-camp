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
    var cars = (o.cars || []).map(function (c) { return { reg: c.reg || '', driver: c.driver || '', guests: (c.guests || []).slice() }; });
    function blank() { return { reg: '', driver: '', guests: [] }; }
    function read() {
      $$('.car-card', box).forEach(function (el, i) {
        var c = cars[i]; if (!c) return;
        c.reg = el.querySelector('[name=car-reg]').value.toUpperCase();
        c.driver = el.querySelector('[name=car-driver]').value;
        c.guests = $$('[name=car-guest]', el).map(function (x) { return x.value; });
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
          c.guests.map(function (g, j) { return '<div class="cc-p"><span class="cc-pn">' + (j + 1) + '</span><input name="car-guest" value="' + esc(g) + '" placeholder="Passenger\'s full name" aria-label="' + lab + ' passenger ' + (j + 1) + '"><button type="button" class="cc-x" data-rm="' + j + '" aria-label="Remove passenger ' + (j + 1) + '">' + svg('i-x') + '</button></div>'; }).join('') +
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
        return { count: n, cars: cars.slice(0, n).map(function (c) { return { reg: c.reg.trim(), driver: c.driver.trim(), guests: c.guests.map(function (g) { return g.trim(); }).filter(Boolean) }; }) };
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
      var wk = (P.wkDays ? P.wkDays.indexOf(dow) >= 0 : dow === 5 || dow === 6) || !!P.holidays[iso(nx)], pens = (!wk && dow >= 1 && dow <= 4) ? R.pe : (wk ? R.wk : R.wd);
      acc += g.adults * (wk ? R.wk : R.wd) + g.pens * pens + g.kids * R.kid;
    }
    return acc;
  };

  // the same invoice lines as a new booking: weekend nights and weekday nights with their dates and rate, children free
  K.stayLines = function (P, area, name, ci, co, g) {
    var ss = area === 'self-sufficient', sec = ss ? 'Self-sufficient' : 'Ablution stands';
    var R = { wk: P.num(sec, 'Weekend per person per night', ss ? 180 : 245), wd: P.num(sec, 'Weekday per person per night', ss ? 100 : 160), pe: P.num(sec, 'Pensioner weekday per person per night', ss ? 100 : 115) };
    var p = function (s) { var a = s.split('-'); return new Date(+a[0], a[1] - 1, +a[2]); }, iso = function (d) { return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
    var grp = { wk: [], wd: [] }, amt = { wk: 0, wd: 0 }, pensUsed = false, paying = g.adults + g.pens;
    for (var d = p(ci), end = p(co); d < end; d.setDate(d.getDate() + 1)) {
      var dow = d.getDay(), nx = new Date(d); nx.setDate(nx.getDate() + 1);
      var wk = (P.wkDays ? P.wkDays.indexOf(dow) >= 0 : dow === 5 || dow === 6) || !!P.holidays[iso(nx)], k = wk ? 'wk' : 'wd';
      var pr = (!wk && dow >= 1 && dow <= 4) ? R.pe : (wk ? R.wk : R.wd); if (g.pens && pr !== (wk ? R.wk : R.wd)) pensUsed = true;
      grp[k].push(new Date(d)); amt[k] += g.adults * (wk ? R.wk : R.wd) + g.pens * pr;
    }
    var out = [];
    ['wk', 'wd'].forEach(function (k) {
      var ds = grp[k]; if (!ds.length || !paying) return;
      var dl = ds.map(function (d, i) { return d.toLocaleDateString('en-ZA', { weekday: 'short', day: 'numeric' }) + (i === ds.length - 1 || d.getMonth() !== ds[i + 1].getMonth() ? ' ' + d.toLocaleDateString('en-ZA', { month: 'short' }) : ''); });
      var dtxt = dl.length > 1 ? dl.slice(0, -1).join(', ') + ' & ' + dl[dl.length - 1] : dl[0], word = k === 'wk' ? 'weekend' : 'weekday';
      out.push({ t: name + ' · ' + word + ' night' + (ds.length > 1 ? 's' : '') + ': ' + dtxt + ' · ' + paying + ' adult' + (paying === 1 ? '' : 's') + (k === 'wd' && pensUsed ? ' (pensioner rate Mon-Thu)' : ' at ' + K.money(k === 'wk' ? R.wk : R.wd) + ' per person'), q: ds.length, u: Math.round(amt[k] / ds.length), amt: amt[k], tag: 'stay' });
    });
    if (g.kids) out.push({ t: 'Child' + (g.kids === 1 ? '' : 'ren') + ' under 12 (free)', q: g.kids, amt: 0, free: true, tag: 'stay' });
    return out;
  };

  /* ---------- camp shop ---------- */
  var IMG = [[/sekelbos|firewood/i, 'sekelbos-wood.jpg'], [/long.?burning/i, 'long-burning-wood.jpg'], [/^ice/i, 'ice.jpg'], [/firelighter/i, 'firelighters.jpg'], [/mug/i, 'mugs.jpg'], [/cap/i, 'caps.jpg'], [/starter|tokkie/i, 'fire-starter.jpg']];
  K.shopImg = function (label) { for (var i = 0; i < IMG.length; i++) if (IMG[i][0].test(label)) return 'assets/img/shop/' + IMG[i][1]; return 'assets/img/logo-small.png'; };
  K.shopItems = function (P) {
    var sec = P && P.sections.filter(function (s) { return /shop/i.test(s.title); })[0];
    return (sec ? sec.items : []).filter(function (it) { return !isNaN(it.amount); }).map(function (it) { return { label: it.label, each: it.amount, note: it.note || '', img: K.shopImg(it.label) }; });
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
