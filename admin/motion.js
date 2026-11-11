/* =========================================================
   Kyleu admin: motion and feel.
   - Number fields get - and + buttons. The number rolls up or down
     when it changes. Hold a button to keep counting.
   - Numbers on a page (tiles, badges, counts, the till) roll when
     they change, and count up when you open a page.
   - Pages slide in, tab highlights glide to the new tab, pop-ups
     fade out instead of vanishing.
   Works on its own: it watches the page, so admin.js only needs
   data-roll on numbers it wants to roll. Calm when the computer
   asks for reduced motion.
   ========================================================= */
(function () {
  'use strict';
  var RM = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  function calm() { return !!(RM && RM.matches); }
  function $$(s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); }
  function restart(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function digits(s) { var m = String(s).replace(/[\s ]/g, '').match(/-?\d+(?:[.,]\d+)?/); return m ? parseFloat(m[0].replace(',', '.')) : null; }

  /* ---------- number steppers ---------- */
  function lim(inp, k) { var a = inp.getAttribute(k); return a === null || a === '' ? null : +a; }
  function val(inp) { var v = String(inp.value).trim(); return v === '' || isNaN(+v) ? null : +v; }
  function sync(w) {
    var inp = w.querySelector('input'); if (!inp) return;
    var v = val(inp), mn = lim(inp, 'min'), mx = lim(inp, 'max'), off = inp.disabled || inp.readOnly;
    w.querySelector('.stp-dn').disabled = off || (v !== null && mn !== null && v <= mn);
    w.querySelector('.stp-up').disabled = off || (v !== null && mx !== null && v >= mx);
    w.classList.toggle('off', off);
  }
  function step(w, dir) {
    var inp = w.querySelector('input'); if (!inp || inp.disabled || inp.readOnly) return false;
    var s = +inp.getAttribute('step') || 1, mn = lim(inp, 'min'), mx = lim(inp, 'max'), v = val(inp);
    var n = v === null ? (mn !== null ? mn : 0) : Math.round((v + dir * s) * 100) / 100;
    if (mn !== null && n < mn) n = mn;
    if (mx !== null && n > mx) n = mx;
    if (v !== null && n === v) { if (!calm()) restart(w, 'nudge'); return false; }   // at the limit: a small shake
    inp.value = n;
    if (!calm()) restart(inp, dir > 0 ? 'roll-up' : 'roll-dn');
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
    sync(w); return true;
  }
  function stepper(inp) {
    if (inp.closest('.stp') || inp.hasAttribute('data-nostp')) return;
    var w = document.createElement('span'); w.className = 'stp';
    inp.parentNode.insertBefore(w, inp);
    w.innerHTML = '<button type="button" class="stp-b stp-dn" tabindex="-1" aria-label="One less"><svg class="ic" aria-hidden="true"><use href="#i-minus"/></svg></button>';
    w.appendChild(inp);
    w.insertAdjacentHTML('beforeend', '<button type="button" class="stp-b stp-up" tabindex="-1" aria-label="One more"><svg class="ic" aria-hidden="true"><use href="#i-plus"/></svg></button>');
    if (!inp.getAttribute('inputmode')) inp.setAttribute('inputmode', 'numeric');
    sync(w);
  }
  function scanSteppers(root) { $$('input[type=number], input[data-stp]', root).forEach(stepper); }

  // press to step once, hold to keep counting (faster the longer you hold)
  var hold = null;
  function stopHold() { if (hold) { clearTimeout(hold.t); hold = null; } }
  document.addEventListener('pointerdown', function (e) {
    var b = e.target.closest && e.target.closest('.stp-b'); if (!b || b.disabled || e.button > 0) return;
    e.preventDefault();   // keep the focus where it is
    var w = b.parentNode, dir = b.classList.contains('stp-up') ? 1 : -1;
    restart(b, 'tap');
    if (!step(w, dir)) return;
    var n = 0;
    hold = { t: setTimeout(function again() { if (!hold) return; if (!step(w, dir)) { stopHold(); return; } n++; hold.t = setTimeout(again, n > 10 ? 45 : 90); }, 420) };
  });
  ['pointerup', 'pointercancel', 'blur'].forEach(function (ev) { window.addEventListener(ev, stopHold, true); });
  window.addEventListener('pointerleave', function (e) { if (e.target.classList && e.target.classList.contains('stp-b')) stopHold(); }, true);
  document.addEventListener('click', function (e) {
    var b = e.target.closest && e.target.closest('.stp-b'); if (!b) return;
    e.preventDefault();
    if (e.detail === 0 && !b.disabled) step(b.parentNode, b.classList.contains('stp-up') ? 1 : -1);   // keyboard or screen reader
  }, true);
  document.addEventListener('input', function (e) { var w = e.target.closest && e.target.closest('.stp'); if (w) sync(w); }, true);
  document.addEventListener('focusin', function (e) { var w = e.target.closest && e.target.closest('.stp'); if (w) sync(w); });
  // arrow keys on the field roll the number too
  document.addEventListener('keydown', function (e) {
    var w = e.target.closest && e.target.closest('.stp'); if (!w || (e.key !== 'ArrowUp' && e.key !== 'ArrowDown')) return;
    e.preventDefault(); step(w, e.key === 'ArrowUp' ? 1 : -1);
  });

  /* ---------- numbers that roll when they change ---------- */
  var seen = {};
  function rollKey(el) {
    if (el.dataset.roll) return el.dataset.roll;
    var k = el.closest('.kpi'); if (k) { var l = k.querySelector('.kpi-l'); return 'kpi:' + (l ? l.textContent : ''); }
    var n = el.closest('[data-nav]'); if (n) return 'nav:' + n.dataset.nav;
    return null;
  }
  function rollAll(enter) {
    var now = {};
    $$('[data-roll], .kpi-v, [data-nav] em').forEach(function (el) {
      var key = rollKey(el); if (!key) return;
      var txt = el.textContent, old = seen[key]; now[key] = txt;
      if (enter || old === txt || calm()) return;
      if (old === undefined) { if (el.hasAttribute('data-roll') || el.tagName === 'EM') restart(el, 'pop-in'); return; }   // a new badge pops in
      var a = digits(old), b = digits(txt);
      restart(el, a !== null && b !== null && b < a ? 'roll-dn' : 'roll-up');
    });
    seen = now;
  }
  // count up from zero when a page opens (tiles only)
  function countUp(el) {
    var tn = null; for (var i = 0; i < el.childNodes.length; i++) { if (el.childNodes[i].nodeType === 3 && /\d/.test(el.childNodes[i].nodeValue)) { tn = el.childNodes[i]; break; } }
    if (!tn) return;
    var m = tn.nodeValue.match(/^(\D*?)(\d[\d\s ]*)(.*)$/); if (!m) return;
    var sep = (m[2].match(/[\s ]/) || [''])[0], end = +m[2].replace(/[\s ]/g, ''), pre = m[1], post = m[3];
    if (!end || end < 3) return;
    var t0 = null, dur = Math.min(900, 420 + end / 40);
    function fmt(n) { var s = String(n); return sep ? s.replace(/\B(?=(\d{3})+(?!\d))/g, sep) : s; }
    function frame(t) {
      if (!tn.parentNode) return;
      if (t0 === null) t0 = t;
      var p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3);
      tn.nodeValue = pre + fmt(Math.round(end * e)) + post;
      if (p < 1) requestAnimationFrame(frame);
    }
    tn.nodeValue = pre + fmt(0) + post;
    requestAnimationFrame(frame);
  }

  /* ---------- tab highlights that glide ---------- */
  var GROUPS = '.tabs, .rp-tabs, .d-tabs, .seg, .mail-boxes, .side nav';
  var spots = {};
  function activeIn(g) {
    if (g.classList.contains('seg')) { var r = g.querySelector('input:checked'); return r ? r.nextElementSibling : null; }
    var kids = $$(':scope > .on, :scope > [aria-selected="true"]', g);
    return kids[0] || null;
  }
  function groupKey(g, i) { return (location.hash.match(/^#\/(\w+)/) || ['', 'dashboard'])[1] + '|' + g.className + '|' + i; }
  function boxOf(el, g) { var a = el.getBoundingClientRect(), b = g.getBoundingClientRect(); return { x: a.left - b.left + g.scrollLeft, y: a.top - b.top + g.scrollTop, w: a.width, h: a.height }; }
  function glide(g, from, to) {
    if (calm() || !from || !to) return;
    if (Math.abs(from.x - to.x) < 2 && Math.abs(from.y - to.y) < 2) return;
    var old = g.querySelector(':scope > .glider'); if (old) old.remove();
    var d = document.createElement('i'); d.className = 'glider'; d.setAttribute('aria-hidden', 'true');
    d.style.cssText = 'left:' + from.x + 'px;top:' + from.y + 'px;width:' + from.w + 'px;height:' + from.h + 'px';
    g.insertBefore(d, g.firstChild); g.classList.add('gliding');
    void d.offsetWidth;
    d.style.cssText = 'left:' + to.x + 'px;top:' + to.y + 'px;width:' + to.w + 'px;height:' + to.h + 'px';
    var done = function () { if (d.parentNode) d.remove(); if (!g.querySelector(':scope > .glider')) g.classList.remove('gliding'); };
    d.addEventListener('transitionend', done); setTimeout(done, 450);
  }
  // filter chips and till buttons: the newly picked one gives a small bounce
  var picked = {};
  function scanPicks() {
    var now = {};
    $$('.chips, .pos').forEach(function (g, i) {
      var key = i + '|' + g.className;
      var on = $$(':scope > .on', g).map(function (x) { return x.textContent; });
      now[key] = on;
      var was = picked[key]; if (!was || calm()) return;
      $$(':scope > .on', g).forEach(function (x) { if (was.indexOf(x.textContent) < 0) restart(x, 'pop'); });
    });
    picked = now;
  }
  function scanTabs() {
    var count = {};
    $$(GROUPS).forEach(function (g) {
      var c = g.className.replace(/\s*gliding/, ''); count[c] = (count[c] || 0) + 1;
      var key = g.closest('.side') ? 'side' : groupKey(g, count[c]), a = activeIn(g); if (!a) return;
      var now = boxOf(a, g), was = spots[key];
      spots[key] = { box: now, txt: a.textContent };
      if (was && was.txt !== a.textContent) glide(g, was.box, now);
    });
  }
  // the radio-style tabs (.seg) change without a redraw
  document.addEventListener('change', function (e) {
    var g = e.target.closest && e.target.closest('.seg'); if (!g || e.target.type !== 'radio') return;
    var old = g.__spot, a = activeIn(g); if (!a) return;
    var now = boxOf(a, g); g.__spot = now; glide(g, old, now);
  });
  document.addEventListener('pointerdown', function (e) { var g = e.target.closest && e.target.closest('.seg'); if (g) { var a = activeIn(g); if (a) g.__spot = boxOf(a, g); } }, true);

  /* ---------- watch the page ---------- */
  var lastRoute = null, queued = false;
  function settle() {
    queued = false;
    var view = document.getElementById('view');
    scanSteppers(document);
    var r = (location.hash.match(/^#\/(\w+)/) || ['', 'dashboard'])[1], enter = view && r !== lastRoute && view.firstElementChild;
    if (enter) {
      lastRoute = r;
      if (!calm()) {
        restart(view, 'enter'); view.__first = view.firstElementChild;
        $$('.kpi-v', view).forEach(countUp);
        clearTimeout(view.__t); view.__t = setTimeout(function () { view.classList.remove('enter'); }, 900);
      }
    } else if (view && view.classList.contains('enter') && view.firstElementChild !== view.__first) {
      view.classList.remove('enter');   // redrawn straight after opening (a click, a filter): no second entrance
    }
    rollAll(enter);
    scanTabs();
    if (enter) picked = {};
    scanPicks();
  }
  function queue() { if (!queued) { queued = true; Promise.resolve().then(settle); } }
  new MutationObserver(function (list) {
    for (var i = 0; i < list.length; i++) { if (list[i].addedNodes.length) { queue(); return; } }
  }).observe(document.documentElement, { childList: true, subtree: true });
  // the side menu's highlight moves without new nodes
  window.addEventListener('hashchange', function () { setTimeout(queue, 0); });
  queue();

  /* ---------- pop-ups fade out ---------- */
  var ghost = null;
  window.KyleuMotion = {
    // called just before the pop-up is emptied: a copy fades and sinks while the real one is already gone
    modalOut: function (m) {
      if (calm() || !m || m.hidden || !m.firstElementChild) return;
      if (ghost) ghost.remove();
      var g = ghost = document.createElement('div'); g.className = 'modal-ghost'; g.setAttribute('aria-hidden', 'true'); g.inert = true;
      $$(':scope > *', m).forEach(function (c) { g.appendChild(c.cloneNode(true)); });
      $$('[id]', g).forEach(function (x) { x.removeAttribute('id'); });
      $$('[name]', g).forEach(function (x) { x.removeAttribute('name'); });
      document.body.appendChild(g);
      setTimeout(function () { g.remove(); if (ghost === g) ghost = null; }, 220);
    }
  };
  // a new pop-up opening straight away: drop the old dark backdrop so it does not double up
  new MutationObserver(function () {
    var m = document.getElementById('modal');
    if (ghost && m && !m.hidden) { var b = ghost.querySelector('.m-back'); if (b) b.remove(); m.classList.add('swap'); }
  }).observe(document.body, { attributes: true, subtree: true, attributeFilter: ['hidden'] });
})();
