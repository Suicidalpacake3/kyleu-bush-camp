/* =========================================================
   Kyleu date picker: one calendar, arrival then departure.
   - Tap the arrival day, then the departure day. While choosing,
     a band follows the pointer from the arrival circle.
   - A day before the arrival moves the arrival there.
   - Tapping the arrival again (or "Clear dates") starts over.
   - Once both days are in, they lock in with a short animation
     and the calendar closes.
   Use: var dp = Kyleu.datePicker({ min, get, onChange, onDone }); dp.open('in' | 'out');
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var DAY = 864e5;
  var LONG = { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' };
  var SHORT = { weekday: 'short', day: 'numeric', month: 'short' };
  function d0(d) { var x = new Date(d); x.setHours(0, 0, 0, 0); return x; }
  function iso(d) { var z = new Date(d.getTime() - d.getTimezoneOffset() * 6e4); return z.toISOString().slice(0, 10); }
  function same(a, b) { return !!a && !!b && a.getTime() === b.getTime(); }
  function nightsBetween(a, b) { return Math.round((b - a) / DAY); }
  function fmt(d, o) { return d.toLocaleDateString('en-ZA', o); }
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  K.datePicker = function (opts) {
    var min = d0(opts.min || new Date()), max = new Date(min); max.setMonth(max.getMonth() + 18);
    var ci = null, co = null, hover = null, view = null, lastFocus = null, busy = false;

    var back = document.createElement('div'); back.className = 'dp-back'; back.hidden = true;
    var box = document.createElement('div'); box.className = 'dp'; box.hidden = true;
    box.setAttribute('role', 'dialog'); box.setAttribute('aria-modal', 'true'); box.setAttribute('aria-label', 'Choose your dates');
    box.innerHTML =
      '<div class="dp-head"><div><b class="dp-title">Choose your dates</b><span class="dp-hint" aria-live="polite"></span></div>' +
      '<button type="button" class="dp-x" aria-label="Close the calendar"><svg><use href="#i-x"/></svg></button></div>' +
      '<div class="dp-sel"><button type="button" class="dp-pill" data-k="in"><small>Arrival</small><b></b></button><svg class="dp-arr" aria-hidden="true"><use href="#i-arrow"/></svg><button type="button" class="dp-pill" data-k="out"><small>Departure</small><b></b></button></div>' +
      '<div class="dp-nav"><button type="button" class="dp-prev" aria-label="Previous month"><svg><use href="#i-arrow-l"/></svg></button><b class="dp-month" aria-live="polite"></b><button type="button" class="dp-next" aria-label="Next month"><svg><use href="#i-arrow"/></svg></button></div>' +
      '<div class="dp-wk" aria-hidden="true"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div>' +
      '<div class="dp-grid" role="group"></div>' +
      '<div class="dp-foot"><button type="button" class="dp-clear">Clear dates</button><button type="button" class="btn btn-sm dp-done">Done</button></div>';
    document.body.appendChild(back); document.body.appendChild(box);
    var grid = box.querySelector('.dp-grid'), hint = box.querySelector('.dp-hint'), monthEl = box.querySelector('.dp-month');

    function tell() { if (opts.onChange) opts.onChange(ci, co); }
    function setHint() {
      if (!ci) hint.textContent = 'Tap the day you arrive.';
      else if (!co) hint.textContent = 'Now tap the day you go home. Tap ' + fmt(ci, { day: 'numeric', month: 'short' }) + ' again to start over.';
      else { var n = nightsBetween(ci, co); hint.textContent = n + ' night' + (n > 1 ? 's' : '') + ': ' + fmt(ci, SHORT) + ' to ' + fmt(co, SHORT) + '.'; }
      var pi = box.querySelector('.dp-pill[data-k="in"]'), po = box.querySelector('.dp-pill[data-k="out"]');
      pi.querySelector('b').textContent = ci ? fmt(ci, SHORT) : 'Choose';
      po.querySelector('b').textContent = co ? fmt(co, SHORT) : (ci ? 'Choose' : '');
      pi.classList.toggle('on', !ci); po.classList.toggle('on', !!ci && !co);
      pi.classList.toggle('set', !!ci); po.classList.toggle('set', !!co);
      box.querySelector('.dp-clear').disabled = !ci;
      box.querySelector('.dp-done').textContent = ci && co ? 'Done' : 'Close';
    }

    function draw() {
      var y = view.getFullYear(), m = view.getMonth(), first = new Date(y, m, 1), lead = (first.getDay() + 6) % 7, days = new Date(y, m + 1, 0).getDate();
      monthEl.textContent = fmt(first, { month: 'long', year: 'numeric' });
      box.querySelector('.dp-prev').disabled = y === min.getFullYear() && m === min.getMonth();
      box.querySelector('.dp-next').disabled = y === max.getFullYear() && m === max.getMonth();
      var end = co || (ci && hover && hover > ci ? hover : null), preview = !co && !!end, html = '', idx = 0;
      for (var i = 0; i < lead; i++) html += '<span class="dp-c dp-blank"></span>';
      for (var dd = 1; dd <= days; dd++) {
        var d = new Date(y, m, dd), cls = ['dp-c'], past = d < min, inRange = ci && end && d > ci && d < end, isEnd = same(d, end), isStart = same(d, ci);
        if (past) cls.push('past');
        if (same(d, min)) cls.push('today');
        if (isStart) cls.push('start');
        if (isEnd) cls.push(preview ? 'hend' : 'end');
        if (isStart && end) cls.push('has-band');
        if (inRange) { cls.push(preview ? 'hin' : 'in'); idx++; }
        if (d.getDay() === 5 || d.getDay() === 6) cls.push('wknd');
        var n = isEnd && ci ? nightsBetween(ci, end) : 0;
        html += '<span class="' + cls.join(' ') + '"' + (inRange ? ' style="--i:' + idx + '"' : '') + '><button type="button" class="dp-d" data-d="' + iso(d) + '"' + (past ? ' disabled' : '') +
          ' aria-label="' + fmt(d, LONG) + (isStart ? ', arrival' : '') + (isEnd && !preview ? ', departure' : '') + '"' + (isStart || (isEnd && !preview) ? ' aria-pressed="true"' : '') + '>' + dd + '</button>' +
          (n ? '<small class="dp-nn">' + n + ' night' + (n > 1 ? 's' : '') + '</small>' : '') + '</span>';
      }
      grid.innerHTML = html; grid.classList.toggle('previewing', preview);
      setHint();
    }
    function parseIso(s) { var p = s.split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
    function focusDay(d) { var b = grid.querySelector('[data-d="' + iso(d) + '"]'); if (b && !b.disabled) b.focus(); }

    function pick(d) {
      if (busy) return;
      if (!ci) { ci = d; co = null; }
      else if (same(d, ci)) { ci = null; co = null; }          // tap the arrival again: start over
      else if (d < ci) { ci = d; }                              // an earlier day moves the arrival
      else { co = d; tell(); hover = null; draw(); lockIn(); return; }
      hover = null; tell(); draw(); focusDay(d);
    }
    // both dates are in: the band sweeps across, the circles pop, then the calendar closes
    function lockIn() {
      busy = true; box.classList.add('dp-lock');
      var n = nightsBetween(ci, co); hint.textContent = 'Locked in: ' + n + ' night' + (n > 1 ? 's' : '') + ', ' + fmt(ci, SHORT) + ' to ' + fmt(co, SHORT) + '.';
      setTimeout(function () { close(true); }, reduce ? 150 : 900);
    }

    function open(which) {
      var cur = opts.get ? opts.get() : {};
      ci = cur.ci ? d0(cur.ci) : null; co = cur.co ? d0(cur.co) : null;
      if (which === 'in' && ci && co) { /* keep both, the guest can tap a new day */ }
      if (which === 'out' && ci) co = co || null;
      view = new Date((ci || min).getFullYear(), (ci || min).getMonth(), 1);
      if (which === 'out' && co) view = new Date(co.getFullYear(), co.getMonth(), 1);
      lastFocus = document.activeElement; busy = false; hover = null;
      box.classList.remove('dp-lock', 'dp-out');
      back.hidden = false; box.hidden = false; document.body.classList.add('lock');
      requestAnimationFrame(function () { back.classList.add('in'); box.classList.add('in'); });
      draw();
      setTimeout(function () { var t = grid.querySelector('.start .dp-d') || grid.querySelector('.today .dp-d') || grid.querySelector('.dp-d:not([disabled])'); if (t) t.focus({ preventScroll: true }); }, 60);
    }
    function close(done) {
      box.classList.add('dp-out'); back.classList.remove('in'); box.classList.remove('in');
      setTimeout(function () {
        box.hidden = true; back.hidden = true; box.classList.remove('dp-out', 'dp-lock'); busy = false;
        document.body.classList.remove('lock');
        if (lastFocus && lastFocus.focus) try { lastFocus.focus({ preventScroll: true }); } catch (e) {}
        if (opts.onDone) opts.onDone(ci, co, !!done);
      }, reduce ? 0 : 260);
    }

    grid.addEventListener('click', function (e) { var b = e.target.closest('.dp-d'); if (b && !b.disabled) pick(parseIso(b.dataset.d)); });
    grid.addEventListener('mouseover', function (e) {
      if (!ci || co || busy) return;
      var b = e.target.closest('.dp-d'), d = b && !b.disabled ? parseIso(b.dataset.d) : null;
      if (!same(d, hover)) { hover = d; draw(); }
    });
    grid.addEventListener('mouseleave', function () { if (hover) { hover = null; draw(); } });
    grid.addEventListener('keydown', function (e) {
      var b = e.target.closest('.dp-d'); if (!b) return;
      var step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key]; if (!step) return;
      e.preventDefault();
      var d = parseIso(b.dataset.d); d.setDate(d.getDate() + step); if (d < min || d > max) return;
      if (d.getMonth() !== view.getMonth()) { view = new Date(d.getFullYear(), d.getMonth(), 1); }
      if (ci && !co) hover = d > ci ? d : null;
      draw(); focusDay(d);
    });
    box.querySelector('.dp-prev').onclick = function () { view.setMonth(view.getMonth() - 1); draw(); };
    box.querySelector('.dp-next').onclick = function () { view.setMonth(view.getMonth() + 1); draw(); };
    box.querySelector('.dp-clear').onclick = function () { ci = null; co = null; hover = null; tell(); draw(); var t = grid.querySelector('.today .dp-d'); if (t) t.focus(); };
    box.querySelector('.dp-done').onclick = function () { close(!!(ci && co)); };
    box.querySelector('.dp-x').onclick = function () { close(false); };
    box.querySelector('.dp-pill[data-k="in"]').onclick = function () { if (ci) { ci = null; co = null; tell(); draw(); } };
    box.querySelector('.dp-pill[data-k="out"]').onclick = function () { if (co) { co = null; tell(); draw(); } };
    back.addEventListener('click', function () { close(false); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && !box.hidden) close(false); });

    return { open: open, close: close };
  };
})();
