/* =========================================================
   Pieces shared by the booking checkout (stay.html) and
   "Change my booking" (manage.html):
   - K.carsEditor: one card per vehicle with registration, driver and passengers
   - K.shopItems / K.shopPicker: camp shop items to have waiting on arrival
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
      el.className = 'cars-count' + (t && k === t ? ' ok' : t && k > t ? ' warn' : '');
      el.innerHTML = !k ? svg('i-users') + '<span>Names are optional for now. Your booking is for <b>' + t + ' ' + (t === 1 ? 'person' : 'people') + '</b>.</span>'
        : t && k === t ? svg('i-check') + '<span>Everyone is named: <b>' + k + ' of ' + t + ' people</b>. Thank you!</span>'
        : t && k > t ? svg('i-info') + '<span>You have named <b>' + k + ' people</b>, but the booking is for <b>' + t + '</b>. ' + (o.overText || 'Go back to step 2 to change the number of guests, or remove a name.') + '</span>'
        : svg('i-users') + '<span>You have named <b>' + k + ' of ' + t + ' people</b>. Add the rest now or later.</span>';
    }
    function draw(focus) {
      if (!n) {
        box.innerHTML = '<div class="cars-later">' + svg('i-clock') + '<p>' + (o.later || '<b>No problem.</b> Before you arrive, tell us how many vehicles are coming, with each registration, driver and the passengers in it. Use <a href="manage.html" target="_blank">Change my booking</a> any time, or WhatsApp us.') + '</p></div>';
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
      // fill vehicle 1's driver with the booker's name, until they type their own
      suggestDriver: function (name) { read(); if (!n || !cars[0]) return; if (!cars[0].driver.trim() || cars[0].driver === auto) { cars[0].driver = auto = name; var el = box.querySelector('.car-card[data-i="0"] [name=car-driver]'); if (el) el.value = name; count(); } },
      get: function () {
        read();
        return { count: n, cars: cars.slice(0, n).map(function (c) { return { reg: c.reg.trim(), driver: c.driver.trim(), guests: c.guests.map(function (g) { return g.trim(); }).filter(Boolean) }; }) };
      },
      named: function () { read(); return named(); }
    };
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
      q = Math.max(0, Math.min(30, q)); if (q) qty[it.label] = q; else delete qty[it.label];
      draw(); var again = box.querySelector('[data-' + (b.dataset.sp ? 'sp' : 'sm') + '="' + items.indexOf(it) + '"]'); if (again) again.focus();
      if (onChange) onChange();
    };
    draw();
    return { draw: draw };
  };
  K.shopTotal = function (items, qty) { return items.reduce(function (a, it) { return a + (qty[it.label] || 0) * it.each; }, 0); };
})();
