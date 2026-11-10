/* =========================================================
   Kyleu writing tool: the guided tour ("Show me how").
     KyEditor.tour(ed, { photo: 'path/to/a/sample/photo.jpg' })
   A pretend mouse moves over the real writing tool, presses the real buttons and
   types a short sample story, while a card explains each tool. The writer's own
   story is put away first and put back when the tour ends, so nothing is lost.
   Keys while it runs: Space pauses, the right arrow skips a step, Escape ends it.
   (Admin only, modern browsers: this file uses async functions.)
   ========================================================= */
(function () {
  'use strict';
  if (!window.KyEditor) return;
  var STOP = { stop: true }, running = null;

  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }

  function tour(ed, opt) {
    if (running) return running;
    opt = opt || {};
    var root = ed.el, surface = ed.surface, bar = root.querySelector('.kyed-bar');
    var saved = ed.getHTML(), calm = !!opt.instant || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
    var speed = opt.speed || 1, stopped = false, paused = false, skipping = false, keepR = null, ownKey = false, cx = window.innerWidth / 2, cy = window.innerHeight * .55, hot = null;
    var photo = opt.photo || '../assets/img/photos/campfire-stand.jpg';

    // ---------- what is on screen during the tour ----------
    var shield = h('div', 'kyt-shield'), cur = h('div', 'kyt-cur', '<svg viewBox="0 0 28 28" aria-hidden="true"><path d="M5 3l16 9.6-7.3 1.7 4.5 8.4-3.3 1.7-4.4-8.5L5 21z"/></svg><i class="kyt-ring"></i>'), keyEl = h('b', 'kyt-keycap');
    var panel = h('div', 'kyt-panel', '<div class="kyt-top"><span class="kyt-n"></span><div class="kyt-dots"></div><button type="button" class="kyt-x" data-t="stop" aria-label="End the tour">End tour</button></div>' +
      '<h4 class="kyt-h"></h4><p class="kyt-p"></p><div class="kyt-tips" hidden></div>' +
      '<div class="kyt-acts"><button type="button" class="kyt-b" data-t="pause">Pause</button><button type="button" class="kyt-b" data-t="skip">Skip this step</button><button type="button" class="kyt-b" data-t="speed">Speed: normal</button></div>' +
      '<div class="kyt-acts kyt-end" hidden><button type="button" class="kyt-b kyt-go" data-t="done">Back to my story</button><button type="button" class="kyt-b" data-t="again">Watch again</button></div>');
    panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Tour of the writing tool');
    var ring = cur.querySelector('.kyt-ring'); keyEl.hidden = true;
    var elN = panel.querySelector('.kyt-n'), elH = panel.querySelector('.kyt-h'), elP = panel.querySelector('.kyt-p'), elDots = panel.querySelector('.kyt-dots'), elTips = panel.querySelector('.kyt-tips');
    elP.setAttribute('aria-live', 'polite');
    document.body.appendChild(shield); document.body.appendChild(panel); document.body.appendChild(keyEl); document.body.appendChild(cur);
    root.classList.add('kyt-on');

    // ---------- timing ----------
    function quick() { return calm || skipping; }
    function wait(ms) {
      return new Promise(function (ok, no) {
        if (stopped) { no(STOP); return; }
        var left = quick() ? 0 : ms / speed, last = Date.now();
        (function tick() {
          if (stopped) { no(STOP); return; }
          var now = Date.now();
          if (!paused) left -= now - last;
          last = now;
          if (skipping && !paused) left = 0;
          if (left <= 0 && !paused) ok(); else setTimeout(tick, Math.min(60, Math.max(8, left)));
        })();
      });
    }
    function frame(fn) { var hit = false, go = function () { if (!hit) { hit = true; fn(); } }; (window.requestAnimationFrame || setTimeout)(go); setTimeout(go, 60); }

    // ---------- the pretend mouse ----------
    function place(x, y) { cx = x; cy = y; cur.style.transform = 'translate(' + Math.round(x - 5) + 'px,' + Math.round(y - 3) + 'px)'; }
    function glide(x, y) {
      x = Math.max(6, Math.min(window.innerWidth - 10, x)); y = Math.max(6, Math.min(window.innerHeight - 10, y));
      return new Promise(function (ok, no) {
        if (stopped) { no(STOP); return; }
        if (quick()) { place(x, y); ok(); return; }
        var x0 = cx, y0 = cy, dist = Math.sqrt((x - x0) * (x - x0) + (y - y0) * (y - y0)), dur = Math.min(950, Math.max(240, dist * 1.6)) / speed, t = 0, last = Date.now();
        var mx = (x0 + x) / 2 - (y - y0) * .14, my = (y0 + y) / 2 + (x - x0) * .14;   // a gentle curve, the way a hand moves
        (function step() {
          if (stopped) { no(STOP); return; }
          var now = Date.now(); if (!paused) t += (now - last) / dur; last = now;
          if (skipping || t >= 1) { place(x, y); ok(); return; }
          var e = t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2, a = (1 - e) * (1 - e), b = 2 * (1 - e) * e, c = e * e;
          place(a * x0 + b * mx + c * x, a * y0 + b * my + c * y);
          frame(step);
        })();
      });
    }
    function spot(el, fx, fy) { var r = el.getBoundingClientRect(); return [r.left + r.width * (fx == null ? .5 : fx), r.top + r.height * (fy == null ? .55 : fy)]; }
    function glow(el) { if (hot) hot.classList.remove('kyt-hot'); hot = el || null; if (el) el.classList.add('kyt-hot'); }
    function pulse() { ring.classList.remove('go'); void ring.offsetWidth; ring.classList.add('go'); }
    // move to something and press it. real: false only shows the press (used where a real press would open the computer's file chooser)
    async function press(el, o) {
      o = o || {};
      if (!el) return;
      if (surface.contains(el)) show(el);
      var p = spot(el, o.fx, o.fy);
      await glide(p[0], p[1]);
      glow(el);
      await wait(o.hover == null ? 420 : o.hover);
      cur.classList.add('down'); pulse();
      await wait(150);
      cur.classList.remove('down');
      if (o.real !== false) { if (o.mouse) el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); else el.click(); }
      await wait(o.after == null ? 380 : o.after);
      glow(null);
    }
    function tool(key) { return bar.querySelector('[data-k="' + key + '"]'); }
    // open one of the drop-down lists in the toolbar and pick a line from it
    async function pick(key, label) {
      await press(tool(key), { after: 420 });
      var items = bar.querySelectorAll('.kyed-menu .kyed-mi'), it = null, i;
      for (i = 0; i < items.length; i++) if (items[i].textContent.replace(/\s+/g, ' ').trim() === label) it = items[i];
      if (!it) { var open = tool(key); if (open && open.classList.contains('open')) open.click(); return; }
      await press(it, { hover: 520 });
    }
    function keycap(text, at) {
      keyEl.textContent = text;
      if (at) { keyEl.style.left = Math.round(Math.min(window.innerWidth - 90, at.right + 14)) + 'px'; keyEl.style.top = Math.round(at.top - 4) + 'px'; }
      keyEl.hidden = false; keyEl.classList.remove('go'); void keyEl.offsetWidth; keyEl.classList.add('go');
      return wait(620).then(function () { keyEl.hidden = true; }, function (e) { keyEl.hidden = true; throw e; });
    }

    // ---------- keeping the right part of the story in view ----------
    function scroller() {
      var n = root.parentNode, s;
      while (n && n !== document.body && n.nodeType === 1) { s = window.getComputedStyle(n).overflowY; if ((s === 'auto' || s === 'scroll') && n.scrollHeight > n.clientHeight + 4) return n; n = n.parentNode; }
      return null;
    }
    function show(target) {
      var r = target.getBoundingClientRect ? target.getBoundingClientRect() : target, sc = scroller(), top = bar.getBoundingClientRect().bottom + 14, bot = panel.getBoundingClientRect().top - 22, d = 0;
      if (bot - top < 80) bot = window.innerHeight - 20;
      if (r.bottom > bot) d = r.bottom - bot; else if (r.top < top) d = r.top - top;
      if (r.height > bot - top) d = r.top - top;            // taller than the gap: show its top
      if (!d) return;
      if (sc) sc.scrollTop += d; else window.scrollBy(0, d);
    }
    function caretRect() {
      var s = window.getSelection(), r, b; if (!s.rangeCount) return null;
      r = s.getRangeAt(0); b = r.getBoundingClientRect();
      if (!b.height) { var n = r.startContainer; if (n.nodeType !== 1) n = n.parentNode; b = n.getBoundingClientRect(); }
      return b;
    }

    // ---------- typing and selecting, through the writing tool itself ----------
    function keep() { var s = window.getSelection(); if (s.rangeCount && surface.contains(s.getRangeAt(0).startContainer)) keepR = s.getRangeAt(0).cloneRange(); }
    function setSel(r) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); keepR = r.cloneRange(); }
    function ensure() {
      var s = window.getSelection(), inside = s.rangeCount && surface.contains(s.getRangeAt(0).startContainer), r = inside ? s.getRangeAt(0).cloneRange() : keepR;
      if (!surface.contains(document.activeElement) && document.activeElement !== surface) { try { surface.focus({ preventScroll: true }); } catch (e) { surface.focus(); } }
      if (r) { try { s.removeAllRanges(); s.addRange(r); } catch (e2) {} }
    }
    function caretAt(node, atEnd) { var r = document.createRange(); r.selectNodeContents(node); r.collapse(!atEnd); ensure(); setSel(r); }
    async function type(text) {
      var i, ch, b;
      for (i = 0; i < text.length; i++) {
        ensure();
        ch = quick() ? text.slice(i) : text.charAt(i);
        document.execCommand('insertText', false, ch);
        keep();
        if (quick()) break;
        if (i % 6 === 0) { b = caretRect(); if (b) show(b); }
        await wait(ch === ' ' ? 34 : /[.,!?:]/.test(ch) ? 190 : 22 + Math.random() * 46);
      }
      b = caretRect(); if (b) show(b);
    }
    // the Enter key: the writing tool gets the key press first (it has its own rules after a heading, in a box and so on)
    async function enter() {
      ensure();
      var b = caretRect(), k = keycap('Enter', b), ev;
      await wait(240);
      ensure();
      ev = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
      ownKey = true; try { if (surface.dispatchEvent(ev)) document.execCommand('insertParagraph'); } finally { ownKey = false; }
      keep();
      await k;
      b = caretRect(); if (b) show(b);
    }
    function findText(str) {
      var w = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, null), n, i;
      while ((n = w.nextNode())) { i = n.nodeValue.indexOf(str); if (i >= 0) return [n, i]; }
      return null;
    }
    // drag the mouse over some words, the way you would select them
    async function selectWords(str) {
      var f = findText(str), r = document.createRange(), i, b, step = Math.max(1, Math.round(str.length / 22));
      if (!f) return false;
      r.setStart(f[0], f[1]); r.setEnd(f[0], f[1]);
      b = r.getBoundingClientRect(); show(b); b = r.getBoundingClientRect();
      await glide(b.left, b.top + b.height * .6);
      cur.classList.add('down'); pulse(); ensure();
      await wait(160);
      for (i = step; ; i += step) {
        if (i > str.length) i = str.length;
        r.setEnd(f[0], f[1] + i); setSel(r);
        var rs = r.getClientRects(), last = rs[rs.length - 1];
        if (last && !quick()) place(last.right, last.top + last.height * .6);
        if (i >= str.length) break;
        await wait(26 * step);
      }
      await wait(200);
      cur.classList.remove('down');
      await wait(260);
      return true;
    }
    async function typeInto(inp, text) {
      await press(inp, { real: false, hover: 200, after: 120 });
      try { inp.focus({ preventScroll: true }); } catch (e) { inp.focus(); }
      for (var i = 0; i < text.length; i++) {
        inp.value += quick() ? text.slice(i) : text.charAt(i);
        inp.dispatchEvent(new Event('input', { bubbles: true }));
        if (quick()) break;
        await wait(30 + Math.random() * 40);
      }
      await wait(240);
    }
    function lastBlock() { var n = surface.lastElementChild; while (n && n.tagName !== 'P' && n.previousElementSibling && /^(FIGURE|HR|DIV)$/.test(n.tagName)) n = n.previousElementSibling; return n; }

    // ---------- the card ----------
    function card(i, total, title, text) {
      elN.textContent = 'Step ' + (i + 1) + ' of ' + total;
      elH.textContent = title; elP.textContent = text;
      var d = ''; for (var k = 0; k < total; k++) d += '<i class="' + (k < i ? 'done' : k === i ? 'on' : '') + '"></i>';
      elDots.innerHTML = d;
    }
    function readTime(text) { return Math.min(4200, 1100 + text.split(/\s+/).length * 150); }

    // ---------- the steps: a short story about the camp's tenth birthday ----------
    var STEPS = [
      { t: 'Start with a heading', d: 'A heading tells readers what the story is about. Choose Heading in the Text style list, then type.',
        run: async function () {
          await pick('style', 'Heading');
          await type('Kyleu turns 10!');
        } },
      { t: 'Open with a short intro', d: 'The Intro paragraph style makes the first lines bigger. One or two sentences that make people want to read on.',
        run: async function () {
          await enter();
          await pick('style', 'Intro paragraph');
          await type('Ten years of campfires, starry skies and friends who keep coming back.');
        } },
      { t: 'Then tell the story', d: 'Press Enter for a new paragraph and just write. Short paragraphs with one idea each are the easiest to read.',
        run: async function () {
          await enter();
          await type('On 1 December 2016 we opened the gate for the very first time. Join us for a birthday weekend around the fire, with a free bag of wood for every stand.');
        } },
      { t: 'Make the important words stand out', d: 'Drag over a few words to select them, then press Bold or pick a Highlight marker. Use them only for the one or two things nobody should miss.',
        run: async function () {
          if (await selectWords('birthday weekend')) await press(tool('bold'));
          await wait(500);
          if (await selectWords('a free bag of wood')) await pick('mark', 'Gold marker');
          var b = lastBlock(); if (b) caretAt(b, true);
        } },
      { t: 'Add a photo, and put it where you want it', d: 'Photo opens the pictures on your computer or phone. Click a photo for its own tools: make it smaller, move it up or down, and put it left or right so the words wrap around it.',
        run: async function () {
          await press(tool('photo'), { real: false, hover: 700 });
          ensure();
          ed._.insertHtml('<figure class="ky-fig ky-w-full"><img src="' + photo + '" alt="A campfire at a Kyleu stand"></figure>');
          var fig = surface.querySelector('figure'), img = fig && fig.querySelector('img');
          if (!fig) return;
          if (img && !img.complete) await Promise.race([new Promise(function (ok) { img.addEventListener('load', ok); img.addEventListener('error', ok); }), wait(2500)]);
          show(fig);
          await wait(700);
          await press(img, { mouse: true, fy: .45 });
          var ib = root.querySelector('.kyed-imgbar');
          await press(ib.querySelector('[data-v="md"]'), { after: 600 });
          await press(ib.querySelector('[data-k="up"]'), { after: 700 });
          await press(ib.querySelector('[data-v="r"]'), { after: 800 });
          show(fig);
          // a caption under the photo
          var cap = fig.querySelector('figcaption');
          if (cap) {
            var p = spot(cap); await glide(p[0], p[1]); cur.classList.add('down'); pulse(); await wait(150); cur.classList.remove('down');
            try { cap.focus({ preventScroll: true }); } catch (e) {}
            var r = document.createRange(); r.selectNodeContents(cap); r.collapse(false); setSel(r);
            var before = cap.textContent;
            await type('The first fire of the birthday weekend');
            if (cap.textContent === before) { cap.textContent = 'The first fire of the birthday weekend'; if (ed._.tidy) ed._.tidy(); }
          }
          await wait(500);
          var b = lastBlock();
          if (b) { b.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })); try { surface.focus({ preventScroll: true }); } catch (e3) {} caretAt(b, true); }
        } },
      { t: 'Put key facts in a box', d: 'A highlight box makes dates, prices or what to bring jump out. Choose Box, type the facts, then press Enter twice to carry on below it.',
        run: async function () {
          await enter();
          await pick('box', 'Gold box');
          await type('Birthday weekend: 28 to 30 November. Stands fill up fast!');
          await enter(); await enter();
        } },
      { t: 'Finish with a button', d: 'End the story with a button that takes readers straight to the booking page. Press Link, type the words and the address, and tick Show as a button.',
        run: async function () {
          ensure();
          await press(tool('link'), { after: 500 });
          var pop = bar.querySelector('.kyed-linkpop'); if (!pop) return;
          var words = pop.querySelector('[data-f="text"]'), url = pop.querySelector('[data-f="url"]'), btn = pop.querySelector('[data-f="btn"]');
          if (words) await typeInto(words, 'Book your stand');
          await typeInto(url, 'stay.html');
          await press(btn);
          await press(pop.querySelector('[data-a="save"]'), { after: 600 });
          keep();
        } },
      { t: 'Sign off in your own style', d: 'Fonts and colours add personality. Select a line, then try the Font and Text colour lists. One or two fonts in a story is plenty.',
        run: async function () {
          await enter();
          await type('See you in the bush!');
          if (await selectWords('See you in the bush!')) { await pick('font', 'Handwritten'); await pick('size', 'Extra large'); await pick('colour', 'Sun orange'); await press(tool('centre')); }
        } },
      { t: 'Changed your mind?', d: 'Undo takes back your last step and Redo brings it back. Nothing goes on the website until you press Publish or Save.',
        run: async function () {
          await press(tool('undo'), { after: 900 });
          await press(tool('redo'), { after: 700 });
          var b = surface.lastElementChild; if (b) caretAt(b, true);
        } }
    ];

    // ---------- running, pausing, ending ----------
    function onKey(e) {
      if (ownKey) return;                                    // a key the tour itself is pressing
      if (panel.contains(e.target) && (e.key === 'Enter' || e.key === ' ' || e.key === 'Tab')) return;   // the card's own buttons work normally
      e.preventDefault(); e.stopPropagation();
      if (e.key === 'Escape') finish();
      else if (e.key === ' ') togglePause();
      else if (e.key === 'ArrowRight') skipping = true;
    }
    function togglePause() { paused = !paused; panel.querySelector('[data-t="pause"]').textContent = paused ? 'Carry on' : 'Pause'; panel.classList.toggle('paused', paused); }
    function onPanel(e) {
      var b = e.target.closest ? e.target.closest('[data-t]') : null, t = b && b.getAttribute('data-t'); if (!t) return;
      if (t === 'stop' || t === 'done') finish();
      else if (t === 'pause') togglePause();
      else if (t === 'skip') { if (paused) togglePause(); skipping = true; }
      else if (t === 'speed') { speed = speed === 1 ? 1.6 : speed === 1.6 ? 2.4 : 1; b.textContent = 'Speed: ' + (speed === 1 ? 'normal' : speed === 1.6 ? 'fast' : 'very fast'); }
      else if (t === 'again') { panel.querySelector('.kyt-end').hidden = true; panel.querySelector('.kyt-acts').hidden = false; elTips.hidden = true; play(); }
    }
    function hold(e) { if (!(e.target.closest && e.target.closest('input'))) e.preventDefault(); }   // pressing the card or the shade never takes the caret out of the story
    var resolveDone, donePromise = new Promise(function (ok) { resolveDone = ok; });
    function finish() {
      if (stopped && !running) return;
      stopped = true;
      setTimeout(function () {
        document.removeEventListener('keydown', onKey, true);
        glow(null); root.classList.remove('kyt-on');
        [shield, panel, cur, keyEl].forEach(function (x) { if (x.parentNode) x.parentNode.removeChild(x); });
        try { ed.setHTML(saved); } catch (e) {}
        running = null;
        if (opt.onEnd) { try { opt.onEnd(); } catch (e2) {} }
        resolveDone();
      }, 0);
    }
    async function play() {
      try {
        skipping = false; keepR = null;
        ed.setHTML('');
        try { root.scrollIntoView({ block: 'start' }); } catch (e) {}
        var sc = scroller(); if (sc) sc.scrollTop = Math.max(0, sc.scrollTop - 8);
        place(window.innerWidth * .5, window.innerHeight * .5);
        panel.classList.add('in');
        elN.textContent = 'Tour of the writing tool'; elDots.innerHTML = '';
        elH.textContent = 'Sit back and watch';
        elP.textContent = 'I will write a short story so you can see what each tool does. The mouse moves by itself. Your own story is put away safely and comes back when the tour ends.';
        ed.focus();
        if (surface.firstElementChild) caretAt(surface.firstElementChild, false);   // the caret must sit inside the first line, not just somewhere in the story box
        await wait(4200);
        if (surface.firstElementChild && !surface.textContent) caretAt(surface.firstElementChild, false);
        for (var i = 0; i < STEPS.length; i++) {
          skipping = false;
          card(i, STEPS.length, STEPS[i].t, STEPS[i].d);
          await wait(readTime(STEPS[i].d));
          await STEPS[i].run();
          skipping = false;
          await wait(1100);
        }
        // the finished story, from the top, with a few tips
        glow(null); cur.classList.add('rest');
        var sc2 = scroller(), top = surface.getBoundingClientRect().top - bar.getBoundingClientRect().bottom - 10;
        if (sc2) sc2.scrollTop += top; else window.scrollBy(0, top);
        elN.textContent = 'That is the whole tool'; elDots.innerHTML = '';
        elH.textContent = 'What makes a story look good';
        elP.textContent = 'This one took nine small steps. Keep these in mind and yours will look just as good:';
        elTips.innerHTML = '<ul><li><b>Heading, then a short intro.</b> Readers decide in the first two lines.</li><li><b>Short paragraphs.</b> One idea each.</li><li><b>A photo every few paragraphs.</b> Your own photos beat any wording.</li><li><b>Bold and highlight sparingly.</b> If everything stands out, nothing does.</li><li><b>End with a button.</b> Tell readers what to do next.</li></ul>';
        elTips.hidden = false;
        panel.querySelector('.kyt-acts').hidden = true; panel.querySelector('.kyt-end').hidden = false;
        cur.classList.remove('rest');
      } catch (e) {
        if (e !== STOP) { try { console.error('Writing tool tour:', e); } catch (e2) {} finish(); }
      }
    }

    document.addEventListener('keydown', onKey, true);
    panel.addEventListener('click', onPanel);
    panel.addEventListener('mousedown', hold);
    shield.addEventListener('mousedown', hold);
    // the shade stops stray clicks, but the story can still be scrolled with the wheel or a finger
    function scrollBy(d) { var sc = scroller(); if (sc) sc.scrollTop += d; else window.scrollBy(0, d); }
    var touchY = null;
    shield.addEventListener('wheel', function (e) { scrollBy(e.deltaY); }, { passive: true });
    shield.addEventListener('touchstart', function (e) { touchY = e.touches[0] ? e.touches[0].clientY : null; }, { passive: true });
    shield.addEventListener('touchmove', function (e) { var y = e.touches[0] ? e.touches[0].clientY : null; if (y != null && touchY != null) scrollBy(touchY - y); touchY = y; }, { passive: true });
    shield.addEventListener('click', function () { panel.classList.remove('nudge'); void panel.offsetWidth; panel.classList.add('nudge'); });
    running = donePromise;
    play();
    return donePromise;
  }

  window.KyEditor.tour = tour;
})();
