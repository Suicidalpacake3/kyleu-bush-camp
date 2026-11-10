/* =========================================================
   Kyleu article writing tool (staff admin)
     var ed = KyEditor.mount(hostElement, { html, placeholder, onChange, saveImage });
     ed.getHTML() setHTML(html) getText() isEmpty() imageKeys() focus() destroy()
   Needs assets/js/article.js (Kyleu.articleClean / articleShow / articleText)
   and assets/css/article.css. All formatting is a tag or a ky- class, never an inline style.
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var MAX_EDGE = 1800, JPEG_Q = 0.86;
  var GROUPS = { f: 'ky-f-', s: 'ky-s-', c: 'ky-c-', hl: 'ky-hl-' };
  var INLINE_FMT = /^(SPAN|MARK|STRONG|B|EM|I|U|S|FONT)$/;
  var TEXT_BLOCK = /^(P|H2|H3|H4|BLOCKQUOTE|LI|FIGCAPTION)$/;
  var MAC = /Mac|iPhone|iPad/.test(navigator.platform || '');
  var MOD = MAC ? 'Cmd' : 'Ctrl';

  var STYLES = [['p', 'Normal text'], ['h2', 'Heading'], ['h3', 'Sub-heading'], ['intro', 'Intro paragraph'], ['quote', 'Quote']];
  var FONTS = [['', 'Standard'], ['ky-f-display', 'Display'], ['ky-f-serif', 'Classic serif'], ['ky-f-hand', 'Handwritten']];
  var SIZES = [['ky-s-sm', 'Small'], ['', 'Normal'], ['ky-s-lg', 'Large'], ['ky-s-xl', 'Extra large']];
  var MARKS = [['ky-hl-gold', 'Gold marker'], ['ky-hl-orange', 'Orange marker'], ['ky-hl-green', 'Green marker'], ['', 'No highlight']];
  var COLOURS = [['', 'Default'], ['ky-c-sun', 'Sun orange'], ['ky-c-ember', 'Ember'], ['ky-c-green', 'Green'], ['ky-c-brown', 'Soft brown']];
  var ALIGNS = [['', 'Left', 'left'], ['ky-al-c', 'Centre', 'centre'], ['ky-al-r', 'Right', 'right']];
  var BOXES = [['', 'Gold box'], ['ky-box-green', 'Green box'], ['ky-box-sun', 'Orange box']];

  var ICON = {
    undo: '<path d="M9 14L4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 0 12h-3"/>',
    redo: '<path d="M15 14l5-5-5-5"/><path d="M20 9H10a6 6 0 0 0 0 12h3"/>',
    bold: '<path d="M7 5h6a3.5 3.5 0 0 1 0 7H7zM7 12h7a3.5 3.5 0 0 1 0 7H7z" stroke-width="2.4"/>',
    italic: '<path d="M10 5h7M7 19h7M14 5l-4 14"/>',
    underline: '<path d="M7 4v7a5 5 0 0 0 10 0V4M5 20h14"/>',
    marker: '<path d="M14.5 3.5l6 6L11 19H5v-6z"/><path d="M11.5 6.5l6 6"/><path class="kyed-ink" d="M13 21.5h8" stroke-width="2.6"/>',
    colour: '<path d="M6.5 15L12 4l5.5 11M8.6 11h6.8"/><path class="kyed-ink" d="M5 20.5h14" stroke-width="2.6"/>',
    clear: '<path d="M4 5h11M9.5 5v10M7 15h5"/><path d="M15.5 14.5l5 5M20.5 14.5l-5 5"/>',
    left: '<path d="M4 6h16M4 10h10M4 14h16M4 18h10"/>',
    centre: '<path d="M4 6h16M7 10h10M4 14h16M7 18h10"/>',
    right: '<path d="M4 6h16M10 10h10M4 14h16M10 18h10"/>',
    ul: '<path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4.5" cy="6" r="1"/><circle cx="4.5" cy="12" r="1"/><circle cx="4.5" cy="18" r="1"/>',
    ol: '<path d="M10 6h10M10 12h10M10 18h10"/><path d="M4 4.6l1.3-.6v4.2M3.8 10.7c.4-.7 2.2-.8 2.2.4 0 .9-1.6 1.5-2.2 2.7h2.4M3.9 16.3c.5-.5 2.1-.5 2.1.5 0 .7-.8.9-1.2.9.5 0 1.3.3 1.3 1 0 1.1-1.8 1.1-2.3.5" stroke-width="1.3"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    button: '<rect x="2.5" y="7" width="19" height="10" rx="5"/><path d="M8 12h8"/>',
    photo: '<rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 3.5 3 3-2.5 4.5 4"/>',
    pair: '<rect x="2.5" y="6" width="8.5" height="12" rx="1.5"/><rect x="13" y="6" width="8.5" height="12" rx="1.5"/>',
    box: '<rect x="3" y="5" width="18" height="14" rx="3"/><path d="M7 10h10M7 14h6"/>',
    rule: '<path d="M3 12h18"/><path d="M8 6.5h8M8 17.5h8" opacity=".45"/>',
    chev: '<path d="M6 9l6 6 6-6"/>',
    up: '<path d="M12 19V5M6 11l6-6 6 6"/>',
    down: '<path d="M12 5v14M6 13l6 6 6-6"/>',
    bin: '<path d="M5 7h14M10 7V4h4v3M7 7l1 13h8l1-13"/>',
    swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>'
  };
  function ic(name) { return '<svg class="kyed-ic" viewBox="0 0 24 24" aria-hidden="true">' + ICON[name] + '</svg>'; }

  // ---------- small helpers ----------
  function h(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function each(list, fn) { Array.prototype.forEach.call(list, fn); }
  function rid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 8); }
  function len(n) { return n.nodeType === 3 ? n.nodeValue.length : n.childNodes.length; }
  function isBox(n) { return !!n && n.nodeType === 1 && n.tagName === 'DIV' && n.classList.contains('ky-box'); }
  function isPair(n) { return !!n && n.nodeType === 1 && n.tagName === 'DIV' && n.classList.contains('ky-pair'); }
  function isIsland(n) { return !!n && n.nodeType === 1 && (n.tagName === 'FIGURE' || n.tagName === 'HR' || isPair(n) || isBox(n)); }
  function blank(el) { return !el.textContent.replace(/[\s ​﻿]/g, '') && !el.querySelector('img,hr'); }
  function hasContent(frag) { return frag.textContent !== '' || !!frag.querySelector('img,br'); }
  function unwrap(el) { var p = el.parentNode; while (el.firstChild) p.insertBefore(el.firstChild, el); p.removeChild(el); }
  function wrapNode(n, el) { n.parentNode.insertBefore(el, n); el.appendChild(n); return el; }
  function groupTok(el, prefix) {
    var c = el.classList, i;
    for (i = 0; i < c.length; i++) if (c[i].indexOf(prefix) === 0) return c[i];
    return '';
  }
  function stripGroup(el, prefix) {
    var t;
    while ((t = groupTok(el, prefix))) el.classList.remove(t);
    if (!el.className) el.removeAttribute('class');
  }
  function hasKy(el) { return /(^|\s)ky-/.test(el.className || ''); }
  function emptyP() { return h('p', '', '<br>'); }

  // ---------- photos: shrink before saving ----------
  function loadImage(file) {
    return new Promise(function (ok, no) {
      var url = URL.createObjectURL(file), img = new Image();
      img.onload = function () { ok({ img: img, done: function () { URL.revokeObjectURL(url); } }); };
      img.onerror = function () { URL.revokeObjectURL(url); no(new Error('not-a-photo')); };
      img.src = url;
    });
  }
  function hasAlpha(img) {
    try {
      var c = document.createElement('canvas'), g, d, i;
      c.width = c.height = 96;
      g = c.getContext('2d'); g.drawImage(img, 0, 0, 96, 96);
      d = g.getImageData(0, 0, 96, 96).data;
      for (i = 3; i < d.length; i += 4) if (d[i] < 250) return true;
    } catch (e) {}
    return false;
  }
  // -> Promise<{ blob, name }>: at most 1800px on the long edge, JPEG unless the picture is see-through
  function prepImage(file) {
    return loadImage(file).then(function (o) {
      var img = o.img, w = img.naturalWidth || img.width, hh = img.naturalHeight || img.height;
      if (!w || !hh) { o.done(); throw new Error('not-a-photo'); }
      var k = Math.min(1, MAX_EDGE / Math.max(w, hh)), c = document.createElement('canvas'), g, png, type;
      c.width = Math.max(1, Math.round(w * k)); c.height = Math.max(1, Math.round(hh * k));
      png = /png|webp|gif/i.test(file.type || '') && hasAlpha(img);
      type = png ? 'image/png' : 'image/jpeg';
      g = c.getContext('2d');
      if (!png) { g.fillStyle = '#fff'; g.fillRect(0, 0, c.width, c.height); }
      g.drawImage(img, 0, 0, c.width, c.height);
      o.done();
      return new Promise(function (ok, no) {
        c.toBlob(function (b) {
          if (!b) { no(new Error('not-a-photo')); return; }
          ok({ blob: b, name: String(file.name || 'photo').replace(/\.[a-z0-9]+$/i, '') + (png ? '.png' : '.jpg') });
        }, type, JPEG_Q);
      });
    });
  }
  function defaultSave(blob) {
    var key = 'art-img-' + rid(), p = K.files && K.files.put ? K.files.put(key, blob) : null;
    return Promise.resolve(p).then(function () { return { key: key, url: URL.createObjectURL(blob) }; });
  }
  function photoFiles(list) {
    var out = [];
    each(list || [], function (f) { if (f && (/^image\//i.test(f.type || '') || /\.(jpe?g|png|webp|gif|heic|heif|bmp|avif)$/i.test(f.name || ''))) out.push(f); });
    return out;
  }

  // what she types in the link box -> a real address
  function normUrl(v) {
    v = String(v || '').trim();
    if (!v) return '';
    if (/^[a-z][a-z0-9+.\-]*:/i.test(v)) return /^(https?|mailto|tel):/i.test(v) ? v : '';
    if (/^[#\/.?]/.test(v)) return v;
    if (/^[^\s@\/]+@[^\s@\/]+\.[^\s@\/]+$/.test(v)) return 'mailto:' + v;
    if (/^\+?[\d\s()\-]{7,}$/.test(v)) return 'tel:' + v.replace(/[^\d+]/g, '');
    if (/^[\w\-\/]+\.(html?|pdf)([?#].*)?$/i.test(v) || /^(assets|content)\//i.test(v)) return v;   // a page or file on this site
    return 'https://' + v;
  }

  function mount(host, opt) {
    opt = opt || {};
    var root = h('div', 'kyed'), bar = h('div', 'kyed-bar'), wrap = h('div', 'kyed-wrap'),
      surface = h('div', 'kyed-surface ky-article'), ph = h('div', 'kyed-ph'), foot = h('div', 'kyed-foot'),
      countEl = h('span', 'kyed-count'), msgEl = h('span', 'kyed-msg'), imgbar = h('div', 'kyed-imgbar');
    var btns = {}, lastRange = null, selFig = null, pop = null, popAnchor = null, remap = [],
      hist = [], hi = -1, histT = null, changeT = null, wiped = false, msgT = null, rafT = 0, composing = false, dead = false,
      save = typeof opt.saveImage === 'function' ? opt.saveImage : defaultSave;

    // ---------- where am I ----------
    // the text selection inside the story. A selected photo counts as "no text selection".
    function getRange() {
      var s = window.getSelection(), r;
      if (!s || !s.rangeCount) return null;
      r = s.getRangeAt(0);
      if (!surface.contains(r.commonAncestorContainer) || isFigSel(r)) return null;
      return r;
    }
    function isFigSel(r) {
      return !!selFig && r.startContainer === selFig.parentNode && r.endContainer === r.startContainer &&
        r.startContainer.childNodes[r.startOffset] === selFig && r.endOffset === r.startOffset + 1;
    }
    function setRange(r) { var s = window.getSelection(); s.removeAllRanges(); s.addRange(r); }
    function caret(node, off) { var r = document.createRange(); r.setStart(node, off); r.collapse(true); setRange(r); }
    function firstText(el) { while (el && (el.tagName === 'UL' || el.tagName === 'OL' || isBox(el)) && el.firstElementChild) el = el.firstElementChild; return el; }
    function lastTextEl(el) { while (el && (el.tagName === 'UL' || el.tagName === 'OL' || isBox(el)) && el.lastElementChild) el = el.lastElementChild; return el; }
    function caretStart(el) { el = firstText(el); if (el) caret(el, 0); }
    function caretEnd(el) {
      el = lastTextEl(el); if (!el) return;
      var r = document.createRange(), l = el.lastChild;
      r.selectNodeContents(el);
      if (l && l.nodeName === 'BR') r.setEndBefore(l);
      r.collapse(false); setRange(r);
    }
    // the paragraph, heading, quote, list item or caption a node sits in
    function blockOf(n) {
      while (n && n !== surface) { if (n.nodeType === 1 && TEXT_BLOCK.test(n.tagName)) return n; n = n.parentNode; }
      return null;
    }
    function topOf(n) {
      while (n && n !== surface && n.parentNode !== surface) n = n.parentNode;
      return n && n !== surface ? n : null;
    }
    function up(n, re) {
      while (n && n !== surface) { if (n.nodeType === 1 && re.test(n.tagName)) return n; n = n.parentNode; }
      return null;
    }
    function boxAt(n) { while (n && n !== surface) { if (isBox(n)) return n; n = n.parentNode; } return null; }
    function atStart(r, b) { var t = document.createRange(); t.selectNodeContents(b); t.setEnd(r.startContainer, r.startOffset); return !t.toString().replace(/[​﻿]/g, '') && !t.cloneContents().querySelector('img,br'); }
    function atEnd(r, b) { var t = document.createRange(); t.selectNodeContents(b); t.setStart(r.endContainer, r.endOffset); return !t.toString().replace(/[​﻿]/g, '') && !t.cloneContents().querySelector('img'); }

    // keep the selection across DOM surgery: remember the raw nodes, put them back afterwards
    function raw(r) { return r && { sc: r.startContainer, so: r.startOffset, ec: r.endContainer, eo: r.endOffset }; }
    function fix(n) { for (var i = 0; i < remap.length; i++) if (remap[i][0] === n) n = remap[i][1]; return n; }
    function putSel(s) {
      if (!s) return false;
      var sc = fix(s.sc), ec = fix(s.ec), r;
      if (!surface.contains(sc) || !surface.contains(ec)) return false;
      try { r = document.createRange(); r.setStart(sc, Math.min(s.so, len(sc))); r.setEnd(ec, Math.min(s.eo, len(ec))); setRange(r); return true; } catch (e) { return false; }
    }
    function keepSel(fn) { var s = raw(getRange()), out; remap = []; out = fn(); putSel(s); return out; }
    // swap an element for another tag, keeping its content and ky- classes
    function rep(el, tag) {
      if (el.tagName === tag.toUpperCase()) return el;
      var n = h(tag);
      if (el.className) n.className = el.className;
      while (el.firstChild) n.appendChild(el.firstChild);
      el.parentNode.replaceChild(n, el);
      remap.push([el, n]);
      return n;
    }

    // ---------- keeping the page tidy (runs after every change) ----------
    function decorate() {
      each(surface.querySelectorAll('figure'), function (f) {
        var img = f.querySelector('img'), cap = f.querySelector('figcaption');
        if (!f.classList.contains('ky-fig')) f.classList.add('ky-fig');
        if (!groupTok(f, 'ky-w-')) f.classList.add('ky-w-full');
        if (f.getAttribute('contenteditable') !== 'false') f.setAttribute('contenteditable', 'false');
        if (img && img.getAttribute('draggable') !== 'false') img.setAttribute('draggable', 'false');
        if (!cap) { cap = h('figcaption'); f.appendChild(cap); }
        if (cap.getAttribute('contenteditable') !== 'true') cap.setAttribute('contenteditable', 'true');
        if (cap.firstChild && blank(cap) && !cap.querySelector('br + br')) cap.textContent = '';
      });
      each(surface.querySelectorAll('.ky-pair'), function (p) { if (p.getAttribute('contenteditable') !== 'false') p.setAttribute('contenteditable', 'false'); });
    }
    function level(parent, box, s) {
      var n = parent.firstChild, next, run = null, ch = false, tag;
      while (n) {
        next = n.nextSibling;
        if (n.nodeType === 3) {
          if (!/\S/.test(n.nodeValue) && !run && !(s && (s.sc === n || s.ec === n))) parent.removeChild(n);
          else { if (!run) { run = h('p'); parent.insertBefore(run, n); } run.appendChild(n); ch = true; }
        } else if (n.nodeType !== 1) parent.removeChild(n);
        else {
          tag = n.tagName;
          if (!box && (isBox(n) || isPair(n))) run = null;
          else if (/^(DIV|SECTION|ARTICLE|HEADER|FOOTER|MAIN|ASIDE|NAV|PRE|ADDRESS|CENTER|TABLE|TBODY|THEAD|TR|TD|TH|DL|DD|DT)$/.test(tag)) {
            if (n.querySelector('p,h1,h2,h3,h4,h5,h6,ul,ol,blockquote,figure,div,hr,table')) { next = n.firstChild || next; unwrap(n); }
            else rep(n, 'p');
            run = null; ch = true;
          }
          else if (/^H[156]$/.test(tag)) { rep(n, tag === 'H1' ? 'h2' : 'h4'); run = null; ch = true; }
          else if (tag === 'LI') { rep(n, 'p'); run = null; ch = true; }
          else if (/^(P|H2|H3|H4|UL|OL)$/.test(tag)) run = null;
          else if (tag === 'BLOCKQUOTE') { if (box) { rep(n, 'p'); ch = true; } run = null; }
          else if (tag === 'FIGURE' || tag === 'HR') { if (box) { surface.insertBefore(n, box.nextSibling); ch = true; } run = null; }
          else { if (!run) { run = h('p'); parent.insertBefore(run, n); } run.appendChild(n); ch = true; }
        }
        n = next;
      }
      return ch;
    }
    function tidy() {
      var s = raw(getRange()), ch = false, f, l;
      remap = [];
      each(surface.querySelectorAll('[style]'), function (el) { el.removeAttribute('style'); });
      each(surface.querySelectorAll('font, span, meta, style, script, link, title, colgroup'), function (el) {
        if (!/^(FONT|SPAN)$/.test(el.tagName)) { el.parentNode.removeChild(el); ch = true; }
        else if (el.tagName === 'FONT' || !hasKy(el)) { unwrap(el); ch = true; }
      });
      // photos always live in a figure, between blocks
      each(surface.querySelectorAll('img'), function (img) {
        if (!img.closest('figure')) { wrapNode(img, h('figure', 'ky-fig ky-w-full')); ch = true; }
      });
      each(surface.querySelectorAll('.ky-pair'), function (p) {
        if (p.parentNode !== surface) { unwrap(p); ch = true; return; }
        each(Array.prototype.slice.call(p.childNodes), function (k) { if (k.nodeName !== 'FIGURE') p.removeChild(k); });
        if (!p.firstChild) { surface.removeChild(p); ch = true; }
        else if (p.childNodes.length === 1) { unwrap(p); ch = true; }
      });
      each(surface.querySelectorAll('figure'), function (fig) {
        var p = fig.parentNode, top;
        if (!fig.querySelector('img')) { p.removeChild(fig); ch = true; return; }
        if (p === surface || (isPair(p) && p.parentNode === surface)) return;
        top = topOf(fig);
        surface.insertBefore(fig, top.nextSibling);
        if (p !== top && p.tagName === 'P' && !p.firstChild) p.parentNode.removeChild(p);
        ch = true;
      });
      each(surface.querySelectorAll('.ky-box'), function (b) { if (b.parentNode !== surface) { unwrap(b); ch = true; } });
      if (level(surface, null, s)) ch = true;
      each(surface.querySelectorAll('.ky-box'), function (b) {
        if (level(b, b, s)) ch = true;
        if (!b.firstElementChild) { b.appendChild(emptyP()); ch = true; }
      });
      // blocks never sit inside paragraphs, list items or quotes
      each(surface.querySelectorAll('li > p, li > div, li > h2, li > h3, li > h4, li > blockquote, blockquote > p, blockquote > div, blockquote > h2, blockquote > h3, blockquote > h4, p > p, p > div'), function (el) {
        var nx = el.nextSibling;
        if (el.previousSibling && el.previousSibling.nodeName !== 'BR') el.parentNode.insertBefore(h('br'), el);
        if (nx && !(nx.nodeType === 1 && /^(P|DIV|H2|H3|H4|BLOCKQUOTE|UL|OL)$/.test(nx.tagName)) && el.firstChild) el.parentNode.insertBefore(h('br'), nx);
        unwrap(el); ch = true;
      });
      each(surface.querySelectorAll('ul, ol'), function (list) { if (!list.querySelector('li')) { list.parentNode.removeChild(list); ch = true; } });
      each(surface.querySelectorAll('p, h2, h3, h4, blockquote, li'), function (el) { if (!el.firstChild) el.appendChild(h('br')); });
      // there is always somewhere to type: before a leading photo or box, and after a trailing one
      f = surface.firstElementChild; l = surface.lastElementChild;
      if (!l) { surface.innerHTML = '<p><br></p>'; ch = true; }
      else {
        if (isIsland(l)) { surface.appendChild(emptyP()); ch = true; }
        if (isIsland(f)) { surface.insertBefore(emptyP(), f); ch = true; }
      }
      decorate();
      if (ch && s && !putSel(s) && document.activeElement === surface) caretStart(surface.firstElementChild);
      return ch;
    }

    // ---------- undo and redo (our own, so every tool can be undone) ----------
    function path(n) {
      var p = [], par;
      while (n && n !== surface) { par = n.parentNode; if (!par) return null; p.unshift(Array.prototype.indexOf.call(par.childNodes, n)); n = par; }
      return n ? p : null;
    }
    function fromPath(p) { var n = surface, i; for (i = 0; n && i < p.length; i++) n = n.childNodes[p[i]]; return n || null; }
    function selPath() {
      var r = getRange(), a, b;
      if (!r) return null;
      a = path(r.startContainer); b = path(r.endContainer);
      return a && b ? [a, r.startOffset, b, r.endOffset] : null;
    }
    function snap() {
      var f = selFig, html;
      if (f) f.classList.remove('kyed-sel');
      html = surface.innerHTML;
      if (f) f.classList.add('kyed-sel');
      return { h: html, s: selPath() };
    }
    function record() {
      clearTimeout(histT); histT = null;
      var s = snap();
      if (hi >= 0 && hist[hi].h === s.h) { if (s.s) hist[hi].s = s.s; return; }
      hist.length = hi + 1; hist.push(s);
      if (hist.length > 120) hist.shift();
      hi = hist.length - 1;
    }
    function restore(st) {
      var a, b, r;
      deselect(); closePop();
      surface.innerHTML = st.h;
      decorate();
      if (st.s) {
        a = fromPath(st.s[0]); b = fromPath(st.s[2]);
        if (a && b) { try { r = document.createRange(); r.setStart(a, Math.min(st.s[1], len(a))); r.setEnd(b, Math.min(st.s[3], len(b))); surface.focus({ preventScroll: true }); setRange(r); } catch (e) {} }
      }
      changed(true);
    }
    function undo() { if (histT) record(); if (hi > 0) { hi--; restore(hist[hi]); } }
    function redo() { if (histT) record(); if (hi < hist.length - 1) { hi++; restore(hist[hi]); } }

    // ---------- change bookkeeping ----------
    function count() {
      var t = (surface.innerText || surface.textContent || '').replace(/ /g, ' ').trim(), n = t ? t.split(/\s+/).length : 0, f = surface.firstElementChild;
      countEl.textContent = n ? n + (n === 1 ? ' word' : ' words') + ' · about ' + Math.max(1, Math.round(n / 200)) + ' min read' : 'No words yet';
      root.classList.toggle('kyed-empty', surface.children.length === 1 && f.tagName === 'P' && blank(f) && !f.className);
    }
    // tool = true: a tool did it and the undo step is already recorded. Typing is recorded after a short pause.
    function changed(tool) {
      if (!tool) { clearTimeout(histT); histT = setTimeout(record, 500); }
      count(); refreshSoon();
      clearTimeout(changeT);
      changeT = setTimeout(function () { if (!dead && typeof opt.onChange === 'function') opt.onChange(); }, 300);
      if (selFig) placeBar();
    }
    // every tool runs through here: one undo step, tidy up, tell the page
    function run(fn) {
      record();
      var out = fn();
      tidy();
      record();
      changed(true);
      return out;
    }
    function say(text, kind) {
      clearTimeout(msgT);
      msgEl.textContent = text || '';
      msgEl.className = 'kyed-msg' + (kind ? ' ' + kind : '');
      if (text && kind !== 'busy') msgT = setTimeout(function () { msgEl.textContent = ''; }, 6000);
    }

    // a usable selection for a tool, even after a toolbar popover took the focus
    function need() {
      var r = getRange();
      if (r) return r;
      if (selFig) return null;
      if (lastRange && surface.contains(lastRange.startContainer) && surface.contains(lastRange.endContainer)) {
        surface.focus({ preventScroll: true }); setRange(lastRange); return getRange();
      }
      surface.focus({ preventScroll: true });
      caretEnd(surface.lastElementChild);
      return getRange();
    }

    // ---------- inline formatting with Range code ----------
    // the text nodes fully inside a range (the two end nodes are split so whole nodes can be wrapped)
    function textsIn(r) {
      var sc = r.startContainer, ec = r.endContainer, rootN, out = [], w, n, t = document.createRange();
      if (ec.nodeType === 3 && r.endOffset > 0 && r.endOffset < ec.nodeValue.length) ec.splitText(r.endOffset);
      if (sc.nodeType === 3 && r.startOffset > 0 && r.startOffset < sc.nodeValue.length) sc.splitText(r.startOffset);
      rootN = r.commonAncestorContainer;
      if (rootN.nodeType === 3) rootN = rootN.parentNode;
      w = document.createTreeWalker(rootN, NodeFilter.SHOW_TEXT, null);
      while ((n = w.nextNode())) {
        if (!n.nodeValue.length || !blockOf(n)) continue;
        t.selectNodeContents(n);
        if (r.compareBoundaryPoints(Range.START_TO_START, t) <= 0 && r.compareBoundaryPoints(Range.END_TO_END, t) >= 0) out.push(n);
      }
      return out;
    }
    // cut an ancestor in up to three pieces so that `node` is alone in the middle one
    function isolate(node, anc) {
      var r = document.createRange(), frag, c;
      r.setStartAfter(node); r.setEnd(anc, anc.childNodes.length);
      frag = r.extractContents();
      if (hasContent(frag)) { c = anc.cloneNode(false); c.appendChild(frag); anc.parentNode.insertBefore(c, anc.nextSibling); }
      r.setStart(anc, 0); r.setEndBefore(node);
      frag = r.extractContents();
      if (hasContent(frag)) { c = anc.cloneNode(false); c.appendChild(frag); anc.parentNode.insertBefore(c, anc); }
    }
    // free one text node from every wrapper that matches
    function strip(t, pred, undo1) {
      var b = blockOf(t) || surface, a, guard = 0;
      while (guard++ < 40) {
        a = t.parentNode;
        while (a && a !== b && !pred(a)) a = a.parentNode;
        if (!a || a === b) break;
        isolate(t, a);
        if (undo1) undo1(a); else unwrap(a);
      }
    }
    function sameInline(a, b) {
      return b && b.nodeType === 1 && a.tagName === b.tagName && a.className === b.className && /^(SPAN|MARK|STRONG|B|EM|I|U|S)$/.test(a.tagName);
    }
    function mergeInline(el) {
      var n = el.firstChild, nx;
      while (n) {
        if (n.nodeType === 3 && n.nodeValue === '') { nx = n.nextSibling; el.removeChild(n); n = nx; continue; }
        if (n.nodeType === 1 && n.getAttribute('contenteditable') !== 'false') {
          while ((nx = n.nextSibling)) {
            if (nx.nodeType === 3 && nx.nodeValue === '') { el.removeChild(nx); continue; }
            if (!sameInline(n, nx)) break;
            while (nx.firstChild) n.appendChild(nx.firstChild);
            el.removeChild(nx);
          }
          if (!n.firstChild && INLINE_FMT.test(n.tagName)) { nx = n.nextSibling; el.removeChild(n); n = nx; continue; }
          mergeInline(n);
        }
        n = n.nextSibling;
      }
    }
    // after wrapping: join neighbours that look the same, then select what was formatted
    function finish(texts, caretRaw) {
      var seen = [], first = texts[0], last = texts[texts.length - 1], r;
      texts.forEach(function (t) { var b = blockOf(t); if (b && seen.indexOf(b) < 0) { seen.push(b); mergeInline(b); } });
      if (caretRaw) putSel(caretRaw);
      else if (first) { r = document.createRange(); r.setStart(first, 0); r.setEnd(last, last.nodeValue.length); setRange(r); }
      seen.forEach(function (b) { b.normalize(); });
    }
    function pushDown(b, prefix) {
      var tok = groupTok(b, prefix), span;
      if (!tok) return;
      span = h('span', tok);
      while (b.firstChild) span.appendChild(b.firstChild);
      b.appendChild(span);
      stripGroup(b, prefix);
    }
    function wholeBlock(b) { var r = document.createRange(); r.selectNodeContents(b); return r; }

    function fmtInline(tag) {            // strong, em, u
      var r = need(), re = { strong: /^(STRONG|B)$/, em: /^(EM|I)$/, u: /^U$/ }[tag], texts, all;
      if (!r) return;
      if (r.collapsed) {                 // nothing selected: the browser remembers it for the next typed words
        try { document.execCommand('styleWithCSS', false, false); document.execCommand({ strong: 'bold', em: 'italic', u: 'underline' }[tag], false, null); } catch (e) {}
        refreshSoon();
        return;
      }
      run(function () {
        texts = textsIn(r);
        if (!texts.length) return;
        all = texts.every(function (t) { return !!up(t, re); });
        texts.forEach(function (t) {
          strip(t, function (el) { return re.test(el.tagName); });
          if (!all) wrapNode(t, h(tag));
        });
        finish(texts);
      });
    }
    function fmtClass(g, cls) {          // font, size, colour, highlight
      var r = need(), prefix = GROUPS[g], tag = g === 'hl' ? 'mark' : 'span', b, keep = null;
      if (!r) return;
      run(function () {
        if (r.collapsed) {               // nothing selected: the whole paragraph
          b = blockOf(r.startContainer);
          if (!b) return;
          if (g !== 'hl' && (g !== 's' || ((b.tagName === 'P' && !b.classList.contains('ky-intro')) || b.tagName === 'LI'))) {
            keepSel(function () {
              each(b.querySelectorAll('span'), function (el) { if (groupTok(el, prefix)) { stripGroup(el, prefix); if (!hasKy(el)) unwrap(el); } });
              stripGroup(b, prefix);
              if (cls) b.classList.add(cls);
            });
            b.normalize();
            return;
          }
          keep = raw(r);
          r = wholeBlock(b);
        }
        var texts = textsIn(r);
        if (!texts.length) return;
        texts.forEach(function (t) {
          var bl = blockOf(t);
          if (bl && g !== 'hl') pushDown(bl, prefix);
          strip(t, function (el) { return (el.tagName === 'SPAN' || el.tagName === 'MARK') && (g === 'hl' ? el.tagName === 'MARK' : !!groupTok(el, prefix)); }, function (el) {
            if (g === 'hl') { unwrap(el); return; }
            stripGroup(el, prefix);
            if (!hasKy(el)) unwrap(el);
          });
          if (cls) wrapNode(t, h(tag, cls));
        });
        finish(texts, keep);
      });
    }
    function clearFmt() {
      var r = need(), keep = null, b;
      if (!r) return;
      run(function () {
        if (r.collapsed) {
          b = blockOf(r.startContainer);
          if (!b) return;
          keep = raw(r); r = wholeBlock(b);
        }
        var texts = textsIn(r);
        texts.forEach(function (t) {
          var bl = blockOf(t);
          if (bl) ['f', 's', 'c'].forEach(function (g) { pushDown(bl, GROUPS[g]); });
          strip(t, function (el) { return INLINE_FMT.test(el.tagName); });
        });
        if (texts.length) finish(texts, keep);
        else if (b) ['f', 's', 'c'].forEach(function (g) { stripGroup(b, GROUPS[g]); });
      });
    }

    // ---------- blocks ----------
    function selBlocks(r) {
      var out = [], t = document.createRange(), b;
      if (!r) return out;
      if (!r.collapsed) {
        each(surface.querySelectorAll('p,h2,h3,h4,blockquote,li'), function (el) {
          t.selectNodeContents(el);
          // the selection starts before this block ends, and ends after it starts
          if (r.compareBoundaryPoints(Range.END_TO_START, t) < 0 && r.compareBoundaryPoints(Range.START_TO_END, t) > 0) out.push(el);
        });
      }
      if (!out.length) { b = blockOf(r.startContainer); if (b && b.tagName !== 'FIGCAPTION') out.push(b); }
      return out;
    }
    // take one item out of its list: it becomes a paragraph where it stood
    function liftLi(li) {
      var list = li.parentNode, p = h('p'), tail, n;
      if (!list || !/^(UL|OL)$/.test(list.tagName)) return li;
      if (li.className) p.className = li.className;
      while (li.firstChild) p.appendChild(li.firstChild);
      if (!p.firstChild) p.appendChild(h('br'));
      if (li.nextElementSibling) {
        tail = list.cloneNode(false);
        while ((n = li.nextSibling)) tail.appendChild(n);
        list.parentNode.insertBefore(tail, list.nextSibling);
      }
      list.parentNode.insertBefore(p, list.nextSibling);
      list.removeChild(li);
      if (!list.querySelector('li')) list.parentNode.removeChild(list);
      remap.push([li, p]);
      return p;
    }
    function setStyle(kind) {
      var r = need();
      if (!r) return;
      run(function () {
        keepSel(function () {
          selBlocks(r).forEach(function (b) {
            if (b.tagName === 'LI') b = liftLi(b);
            var inBox = isBox(b.parentNode), tag = { p: 'p', h2: 'h2', h3: 'h3', intro: 'p', quote: inBox ? 'p' : 'blockquote' }[kind];
            b = rep(b, tag);
            b.classList.remove('ky-intro');
            if (kind !== 'p') stripGroup(b, GROUPS.s);
            if (kind === 'intro') b.classList.add('ky-intro');
            if (!b.className) b.removeAttribute('class');
          });
        });
      });
    }
    function setAlign(cls) {
      var r = need();
      if (!r) return;
      run(function () {
        selBlocks(r).forEach(function (b) {
          b.classList.remove('ky-al-c'); b.classList.remove('ky-al-r');
          if (cls) b.classList.add(cls);
          if (!b.className) b.removeAttribute('class');
        });
      });
    }
    function mergeLists(parent) {
      var n = parent.firstElementChild, nx;
      while (n) {
        nx = n.nextElementSibling;
        if (nx && /^(UL|OL)$/.test(n.tagName) && nx.tagName === n.tagName && n.nextSibling === nx) { while (nx.firstChild) n.appendChild(nx.firstChild); parent.removeChild(nx); continue; }
        n = nx;
      }
    }
    function toggleList(tag) {
      var r = need(), T = tag.toUpperCase();
      if (!r) return;
      run(function () {
        keepSel(function () {
          var blocks = selBlocks(r), parents = [];
          if (!blocks.length) return;
          if (blocks.every(function (b) { return b.tagName === 'LI' && b.parentNode.tagName === T; })) { blocks.forEach(liftLi); return; }
          blocks.forEach(function (b) {
            var par = b.parentNode, li, list;
            if (b.tagName === 'LI') { if (par.tagName !== T) rep(par, tag); return; }
            li = h('li');
            if (groupTok(b, 'ky-al-')) li.classList.add(groupTok(b, 'ky-al-'));
            if (groupTok(b, GROUPS.f)) li.classList.add(groupTok(b, GROUPS.f));
            if (groupTok(b, GROUPS.c)) li.classList.add(groupTok(b, GROUPS.c));
            while (b.firstChild) li.appendChild(b.firstChild);
            list = h(tag); list.appendChild(li);
            par.replaceChild(list, b);
            remap.push([b, li]);
            if (parents.indexOf(par) < 0) parents.push(par);
          });
          parents.forEach(mergeLists);
        });
      });
    }
    // where a new photo, line or box goes: between blocks, never inside a paragraph's text
    function insertPoint() {
      var r, top, b, l = surface.lastElementChild;
      if (selFig && surface.contains(selFig)) return { ref: topOf(selFig), before: false };
      r = getRange() || (lastRange && surface.contains(lastRange.startContainer) ? lastRange : null);
      top = r && topOf(r.startContainer);
      if (!top) return { ref: l, before: !!l && l.tagName === 'P' && blank(l) };
      if (top.tagName === 'P' && blank(top)) return { ref: top, before: true };
      b = blockOf(r.startContainer);
      if (r.collapsed && b === top && atStart(r, b)) return { ref: top, before: true };
      return { ref: top, before: false };
    }
    function place(blocks, pt) {
      var ref = pt && pt.ref && pt.ref.parentNode === surface ? pt.ref : null, before = pt && pt.before, at;
      if (!ref) { ref = surface.lastElementChild; before = !!ref && ref.tagName === 'P' && blank(ref); }
      at = before ? ref : (ref ? ref.nextSibling : null);
      blocks.forEach(function (b) { surface.insertBefore(b, at); });
    }
    function addRule() {
      var pt = insertPoint();
      run(function () {
        var hr = h('hr'), nx;
        place([hr], pt);
        nx = hr.nextElementSibling;
        if (!nx || isIsland(nx)) { nx = emptyP(); surface.insertBefore(nx, hr.nextSibling); }
        deselect();
        surface.focus({ preventScroll: true });
        caretStart(nx);
      });
    }
    function setBox(variant) {
      var r = need(), pt = insertPoint();
      run(function () {
        var box = r && boxAt(r.startContainer), cls = 'ky-box' + (variant ? ' ' + variant : ''), tops = [], all;
        if (box) { box.className = cls; return; }
        if (r) {
          selBlocks(r).forEach(function (b) { var t = topOf(b); if (t && tops.indexOf(t) < 0) tops.push(t); });
          all = tops.every(function (t) { return /^(P|H2|H3|H4|UL|OL|BLOCKQUOTE)$/.test(t.tagName); });
        }
        if (!r || !tops.length || !all) {            // on a photo, or a mixed selection: a new empty box
          box = h('div', cls, '<p><br></p>');
          place([box], pt);
          deselect(); surface.focus({ preventScroll: true }); caretStart(box);
          return;
        }
        keepSel(function () {
          box = h('div', cls);
          surface.insertBefore(box, tops[0]);
          tops.forEach(function (t) { if (t.tagName === 'BLOCKQUOTE') t = rep(t, 'p'); box.appendChild(t); });
        });
      });
    }
    function unbox() {
      var r = need(), box = r && boxAt(r.startContainer);
      if (!box) return;
      run(function () { keepSel(function () { unwrap(box); }); });
    }

    // ---------- links ----------
    function linkAt(r) {
      var a = up(r.startContainer, /^A$/) || up(r.endContainer, /^A$/), n;
      if (!a && !r.collapsed) { n = textsProbe(r); a = n && up(n, /^A$/); }
      return a;
    }
    // the first text actually inside a selection (its start may sit at the end of the node before)
    function textsProbe(r) {
      var n = r.startContainer, w;
      if (r.collapsed) return n;
      if (n.nodeType === 3 && r.startOffset < n.nodeValue.length) return n;
      if (n.nodeType === 1 && n.childNodes[r.startOffset]) n = n.childNodes[r.startOffset];
      w = document.createTreeWalker(surface, NodeFilter.SHOW_TEXT, null);
      w.currentNode = n;
      if (n.nodeType === 3 && r.startOffset >= n.nodeValue.length) n = w.nextNode();
      else if (n.nodeType !== 3) n = n.firstChild && n.firstChild.nodeType === 3 ? n.firstChild : w.nextNode();
      return n && surface.contains(n) ? n : r.startContainer;
    }
    function setLink(a, url, tab, btn) {
      a.setAttribute('href', url);
      if (tab) { a.setAttribute('target', '_blank'); a.setAttribute('rel', 'noopener'); } else { a.removeAttribute('target'); a.removeAttribute('rel'); }
      a.classList.toggle('ky-btn', !!btn);
      if (!a.className) a.removeAttribute('class');
    }
    function openLink(asBtn) {
      var r = need(), a, saved, box, f = {}, touched = false;
      if (!r) return;
      a = linkAt(r); saved = r.cloneRange();
      box = h('div', 'kyed-pop kyed-linkpop');
      box.innerHTML =
        (a || !r.collapsed ? '' : '<label class="kyed-fld"><span>Words to show</span><input type="text" data-f="text" placeholder="Book your stay" autocomplete="off"></label>') +
        '<label class="kyed-fld"><span>Link address</span><input type="text" inputmode="url" data-f="url" placeholder="www.example.com or stay.html" autocomplete="off" autocapitalize="off" spellcheck="false"></label>' +
        '<label class="kyed-chk"><input type="checkbox" data-f="tab"><span>Open in a new tab</span></label>' +
        '<label class="kyed-chk"><input type="checkbox" data-f="btn"><span>Show as a button</span></label>' +
        '<p class="kyed-err" hidden></p>' +
        '<div class="kyed-row"><button type="button" class="kyed-btn" data-a="save">' + (a ? 'Update link' : 'Add link') + '</button>' +
        (a ? '<button type="button" class="kyed-btn ghost" data-a="del">Remove link</button>' : '') +
        '<button type="button" class="kyed-btn ghost" data-a="x">Cancel</button></div>';
      each(box.querySelectorAll('[data-f]'), function (el) { f[el.getAttribute('data-f')] = el; });
      if (a) { f.url.value = (a.getAttribute('href') || '').replace(/^mailto:|^tel:/, ''); f.tab.checked = a.getAttribute('target') === '_blank'; }
      f.btn.checked = asBtn === true || (!!a && a.classList.contains('ky-btn'));
      f.tab.addEventListener('change', function () { touched = true; });
      f.url.addEventListener('input', function () { if (!touched && !a) f.tab.checked = /^(https?:\/\/|www\.)/i.test(f.url.value.trim()); });
      function done() {
        var url = normUrl(f.url.value), tab = f.tab.checked, btn = f.btn.checked, words = f.text ? f.text.value.trim() : '', err = box.querySelector('.kyed-err');
        if (!url) { err.textContent = f.url.value.trim() ? 'That address will not work. Try one that starts with www or https.' : 'Type or paste the link address first.'; err.hidden = false; f.url.focus(); return; }
        closePop();
        surface.focus({ preventScroll: true });
        try { setRange(saved); } catch (e) {}
        run(function () {
          var r2 = getRange(), tmp = 'https://kyed.invalid/' + rid(), list, x, sp;
          if (a && surface.contains(a)) { setLink(a, url, tab, btn); return; }
          if (!r2) return;
          if (r2.collapsed) {
            x = h('a'); x.textContent = words || f.url.value.trim().replace(/^https?:\/\//i, '');
            setLink(x, url, tab, btn);
            r2.insertNode(x);
            sp = document.createTextNode(' ');
            x.parentNode.insertBefore(sp, x.nextSibling);
            caret(sp, 1);
            return;
          }
          try { document.execCommand('createLink', false, tmp); } catch (e) {}
          list = surface.querySelectorAll('a[href="' + tmp + '"]');
          if (!list.length) {              // the browser would not: wrap the words ourselves
            var texts = textsIn(r2);
            texts.forEach(function (t) { strip(t, function (el) { return el.tagName === 'A'; }); var w = h('a'); w.setAttribute('href', tmp); wrapNode(t, w); });
            if (texts.length) finish(texts);
            list = surface.querySelectorAll('a[href="' + tmp + '"]');
          }
          each(list, function (el) { setLink(el, url, tab, btn); });
        });
      }
      box.addEventListener('click', function (e) {
        var act = e.target.closest ? e.target.closest('[data-a]') : null;
        if (!act) return;
        act = act.getAttribute('data-a');
        if (act === 'save') done();
        else if (act === 'del') { closePop(); surface.focus({ preventScroll: true }); try { setRange(saved); } catch (e2) {} run(function () { keepSel(function () { if (surface.contains(a)) unwrap(a); }); }); }
        else { closePop(); surface.focus({ preventScroll: true }); try { setRange(saved); } catch (e3) {} }
      });
      box.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && e.target.tagName === 'INPUT' && e.target.type === 'text') { e.preventDefault(); done(); }
      });
      if (openPop(btns.link, box)) (f.text || f.url).focus();
    }
    function toggleButton() {
      var r = need(), a = r && linkAt(r);
      if (!r) return;
      if (a) run(function () { a.classList.toggle('ky-btn'); if (!a.className) a.removeAttribute('class'); });
      else openLink(true);
    }

    // ---------- photos ----------
    function makeFig(res) {
      var f = h('figure', 'ky-fig ky-w-full'), img = h('img');
      if (res.key) img.setAttribute('data-ky-file', res.key);
      img.setAttribute('src', res.url);
      img.setAttribute('alt', '');
      img.addEventListener('load', function () { if (selFig) placeBar(); });
      f.appendChild(img); f.appendChild(h('figcaption'));
      return f;
    }
    function upload(file) {
      return prepImage(file).then(function (o) {
        return Promise.resolve(save(o.blob, o.name)).then(function (res) {
          if (!res || (!res.key && !res.url)) throw new Error('save');
          if (!res.url) res = { key: res.key, url: URL.createObjectURL(o.blob) };
          return res;
        });
      });
    }
    function uploadAll(files) {
      var out = [], bad = 0;
      say(files.length > 1 ? 'Adding ' + files.length + ' photos…' : 'Adding the photo…', 'busy');
      root.classList.add('kyed-busy');
      return files.reduce(function (p, f) {
        return p.then(function () { return upload(f).then(function (res) { out.push(res); }, function () { bad++; }); });
      }, Promise.resolve()).then(function () {
        root.classList.remove('kyed-busy');
        if (bad) say(bad === 1 && !out.length ? 'That photo could not be opened. Try a JPG or PNG.' : bad + (bad === 1 ? ' photo' : ' photos') + ' could not be opened. Try JPG or PNG.', 'bad');
        else say('');
        return out;
      });
    }
    // files -> figures at the caret (or where they were dropped). pair = two side by side.
    function addPhotos(files, pair, pt) {
      files = photoFiles(files);
      if (!files.length) { say('That is not a photo. Choose a JPG or PNG.', 'bad'); return Promise.resolve([]); }
      pt = pt || insertPoint();
      return uploadAll(files).then(function (list) {
        if (dead || !list.length) return [];
        var figs = list.map(makeFig), blocks = [], i, d;
        run(function () {
          if (pair) {
            for (i = 0; i + 1 < figs.length; i += 2) { d = h('div', 'ky-pair'); d.appendChild(figs[i]); d.appendChild(figs[i + 1]); blocks.push(d); }
            if (figs.length % 2) blocks.push(figs[figs.length - 1]);
          } else blocks = figs;
          place(blocks, pt);
        });
        selectFig(figs[0]); stay();
        figs[0].scrollIntoView({ block: 'nearest' });
        if (pair && figs.length === 1) say('Only one photo was chosen. Click it and use "Add beside" for the second.');
        return figs;
      });
    }
    function pick(multiple, cb) {
      var inp = h('input');
      inp.type = 'file'; inp.accept = 'image/*'; inp.multiple = !!multiple; inp.className = 'kyed-file';
      inp.addEventListener('change', function () { var fs = Array.prototype.slice.call(inp.files || []); if (inp.parentNode) inp.parentNode.removeChild(inp); if (fs.length) cb(fs); });
      root.appendChild(inp);
      inp.click();
    }
    function selectFig(fig) {
      if (!fig || !surface.contains(fig)) return;
      if (selFig && selFig !== fig) selFig.classList.remove('kyed-sel');
      selFig = fig;
      fig.classList.add('kyed-sel');
      showBar();
    }
    // after a photo tool: the photo is still the thing selected
    function stay() {
      var a = document.activeElement;
      showBar();
      if (selFig && (a === surface || a === document.body || !a)) figKeepsFocus();
    }
    function deselect() {
      if (selFig) selFig.classList.remove('kyed-sel');
      selFig = null;
      imgbar.hidden = true;
    }
    // a selected photo is the selection: the caret leaves the text, and keys act on the photo
    function figKeepsFocus() {
      var r, here = document.activeElement === surface;
      // on a phone, do not pop the keyboard up just because a photo was tapped
      if (!here && window.matchMedia && window.matchMedia('(pointer: coarse)').matches) return;
      if (!here) surface.focus({ preventScroll: true });
      if (!selFig) return;
      try { r = document.createRange(); r.selectNode(selFig); setRange(r); } catch (e) {}
    }
    function figWidth(w) {
      if (!selFig) return;
      run(function () {
        stripGroup(selFig, 'ky-w-'); selFig.classList.add('ky-w-' + w);
        if (w === 'full' && (selFig.classList.contains('ky-p-l') || selFig.classList.contains('ky-p-r'))) { stripGroup(selFig, 'ky-p-'); selFig.classList.add('ky-p-c'); }
      });
      stay();
    }
    function figPos(p) {
      if (!selFig) return;
      run(function () {
        stripGroup(selFig, 'ky-p-'); selFig.classList.add('ky-p-' + p);
        if (p !== 'c' && selFig.classList.contains('ky-w-full')) { selFig.classList.remove('ky-w-full'); selFig.classList.add('ky-w-md'); }
      });
      stay();
    }
    function figMove(dir) {
      if (!selFig) return;
      var top = topOf(selFig), sib = dir < 0 ? top.previousElementSibling : top.nextElementSibling;
      if (!sib) return;
      // the blank line kept at the very top or bottom is not a place to move past
      if (sib.tagName === 'P' && blank(sib) && !(dir < 0 ? sib.previousElementSibling : sib.nextElementSibling)) return;
      run(function () { surface.insertBefore(top, dir < 0 ? sib : sib.nextSibling); });
      stay();
      selFig.scrollIntoView({ block: 'nearest' });
    }
    function figRemove() {
      if (!selFig) return;
      var fig = selFig, top = topOf(fig), nx = top.nextElementSibling;
      deselect();
      run(function () {
        var pair = isPair(fig.parentNode) ? fig.parentNode : null, other;
        fig.parentNode.removeChild(fig);
        if (pair) { other = pair.querySelector('figure'); if (other) { stripGroup(other, 'ky-w-'); other.classList.add('ky-w-full'); } }
        surface.focus({ preventScroll: true });
        if (nx && surface.contains(nx) && !isIsland(nx)) caretStart(nx);
      });
    }
    function figReplace() {
      var fig = selFig;
      if (!fig) return;
      pick(false, function (fs) {
        uploadAll(photoFiles(fs).slice(0, 1)).then(function (list) {
          var img = fig.querySelector('img');
          if (dead || !list.length || !img || !surface.contains(fig)) return;
          run(function () {
            if (list[0].key) img.setAttribute('data-ky-file', list[0].key); else img.removeAttribute('data-ky-file');
            img.setAttribute('src', list[0].url);
          });
          selectFig(fig); stay();
        });
      });
    }
    function figBeside() {
      var fig = selFig;
      if (!fig || isPair(fig.parentNode)) return;
      pick(false, function (fs) {
        uploadAll(photoFiles(fs).slice(0, 1)).then(function (list) {
          if (dead || !list.length || !surface.contains(fig)) return;
          var nf = makeFig(list[0]);
          run(function () {
            var d = h('div', 'ky-pair');
            fig.parentNode.insertBefore(d, fig);
            stripGroup(fig, 'ky-w-'); stripGroup(fig, 'ky-p-'); fig.classList.add('ky-w-full');
            d.appendChild(fig); d.appendChild(nf);
          });
          selectFig(nf); stay();
        });
      });
    }
    function figSwap() {
      var fig = selFig, pair = fig && fig.parentNode;
      if (!isPair(pair) || pair.children.length < 2) return;
      run(function () { pair.appendChild(pair.firstElementChild); });
      stay();
    }
    function textAfter(top) {
      var p;
      deselect();
      run(function () {
        p = top.nextElementSibling;
        if (!p || p.tagName !== 'P' || !blank(p)) { p = emptyP(); surface.insertBefore(p, top.nextSibling); }
        surface.focus({ preventScroll: true });
        caretStart(p);
      });
      p.scrollIntoView({ block: 'nearest' });
    }
    function seg(label, items, fn) {
      var w = h('div', 'kyed-seg'), l = h('span', 'kyed-seg-l'); l.textContent = label; w.appendChild(l);
      items.forEach(function (it) {
        var b = h('button', 'kyed-sb'); b.type = 'button'; b.textContent = it[1]; b.title = it[2] || it[1]; b.setAttribute('data-v', it[0]);
        b.addEventListener('click', function () { fn(it[0]); });
        w.appendChild(b);
      });
      return w;
    }
    function ibtn(key, html, title, fn) {
      var b = h('button', 'kyed-sb'); b.type = 'button'; b.innerHTML = html; b.title = title; b.setAttribute('aria-label', title); b.setAttribute('data-k', key);
      b.addEventListener('click', fn);
      return b;
    }
    var segW = seg('Size', [['sm', 'Small'], ['md', 'Medium'], ['full', 'Full width']], figWidth),
      segP = seg('Position', [['l', 'Left', 'Left, with the story wrapping around it'], ['c', 'Centre'], ['r', 'Right', 'Right, with the story wrapping around it']], figPos),
      segM = h('div', 'kyed-seg'), altIn = h('input', 'kyed-alt');
    function buildImgbar() {
      var l = h('span', 'kyed-seg-l'), row = h('div', 'kyed-ib-row'), row2 = h('div', 'kyed-ib-row'), lab = h('label', 'kyed-altw');
      l.textContent = 'Photo';
      segM.appendChild(l);
      segM.appendChild(ibtn('up', ic('up'), 'Move the photo up', function () { figMove(-1); }));
      segM.appendChild(ibtn('down', ic('down'), 'Move the photo down', function () { figMove(1); }));
      segM.appendChild(ibtn('swap', ic('swap') + '<span>Swap sides</span>', 'Swap the two photos', figSwap));
      segM.appendChild(ibtn('replace', 'Replace', 'Choose a different photo', figReplace));
      segM.appendChild(ibtn('beside', 'Add beside', 'Put a second photo next to this one', figBeside));
      segM.appendChild(ibtn('below', 'Write below', 'Start a new paragraph under the photo', function () { if (selFig) textAfter(topOf(selFig)); }));
      segM.appendChild(ibtn('del', ic('bin') + '<span>Remove</span>', 'Remove the photo', figRemove));
      row.appendChild(segW); row.appendChild(segP);
      row2.appendChild(segM);
      altIn.type = 'text'; altIn.placeholder = 'For example: Elephants at the waterhole at sunset'; altIn.setAttribute('autocomplete', 'off');
      lab.innerHTML = '<span>Describe the photo</span>';
      lab.appendChild(altIn);
      altIn.addEventListener('input', function () { var img = selFig && selFig.querySelector('img'); if (img) { img.setAttribute('alt', altIn.value); changed(false); } });
      altIn.addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); altIn.blur(); } });
      imgbar.appendChild(row); imgbar.appendChild(row2); imgbar.appendChild(lab);
      imgbar.addEventListener('mousedown', function (e) { if (e.target !== altIn) e.preventDefault(); });
      imgbar.hidden = true;
      imgbar.setAttribute('role', 'toolbar'); imgbar.setAttribute('aria-label', 'Photo options');
    }
    function showBar() {
      if (!selFig || !surface.contains(selFig)) { deselect(); return; }
      var inPair = isPair(selFig.parentNode), img = selFig.querySelector('img'), w = groupTok(selFig, 'ky-w-').slice(5) || 'full', p = groupTok(selFig, 'ky-p-').slice(5) || 'c';
      segW.hidden = segP.hidden = inPair;
      each(segW.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === w); });
      each(segP.querySelectorAll('button'), function (b) { b.classList.toggle('on', b.getAttribute('data-v') === p); });
      segM.querySelector('[data-k="swap"]').hidden = !inPair;
      segM.querySelector('[data-k="beside"]').hidden = inPair;
      segM.firstChild.textContent = inPair ? 'Photo pair' : 'Photo';
      if (document.activeElement !== altIn) altIn.value = img ? img.getAttribute('alt') || '' : '';
      imgbar.hidden = false;
      placeBar();
    }
    function placeBar() {
      if (!selFig || imgbar.hidden) return;
      if (!surface.contains(selFig)) { deselect(); return; }
      var fr = selFig.getBoundingClientRect(), wr = wrap.getBoundingClientRect(), br = bar.getBoundingClientRect(), bh, bw, top, left, minTop;
      imgbar.style.maxWidth = Math.max(200, wrap.clientWidth - 16) + 'px';
      bh = imgbar.offsetHeight; bw = imgbar.offsetWidth;
      top = fr.top - wr.top - bh - 8;
      minTop = Math.max(4, br.bottom - wr.top + 6);              // never under the sticky toolbar
      if (top < minTop) top = Math.min(Math.max(fr.top - wr.top + 8, minTop), Math.max(fr.bottom - wr.top - bh - 8, fr.top - wr.top + 8));
      left = fr.left - wr.left + fr.width / 2 - bw / 2;
      left = Math.max(8, Math.min(left, wrap.clientWidth - bw - 8));
      imgbar.style.top = Math.round(top) + 'px';
      imgbar.style.left = Math.round(left) + 'px';
    }

    // ---------- paste and drop ----------
    function textToHtml(text) {
      return String(text).replace(/\r\n?/g, '\n').split('\n').map(function (l) { return l.replace(/\s+$/, ''); }).filter(function (l) { return /\S/.test(l); })
        .map(function (l) { return '<p>' + esc(l) + '</p>'; }).join('');
    }
    // pasted HTML: through the sanitizer, then no outside pictures and no empty paragraphs
    function pasteClean(html) {
      var d = document.implementation.createHTMLDocument('').createElement('div');
      d.innerHTML = K.articleClean(html);
      each(d.querySelectorAll('img:not([data-ky-file])'), function (img) { img.parentNode.removeChild(img); });
      each(d.querySelectorAll('figure'), function (f) { if (!f.querySelector('img')) f.parentNode.removeChild(f); });
      each(d.querySelectorAll('.ky-pair'), function (p) { if (!p.querySelector('figure')) p.parentNode.removeChild(p); });
      each(d.querySelectorAll('p, h2, h3, h4, blockquote, li'), function (el) { if (blank(el)) el.parentNode.removeChild(el); });
      each(d.querySelectorAll('ul, ol, .ky-box'), function (el) { if (!el.firstElementChild) el.parentNode.removeChild(el); });
      return d.innerHTML;
    }
    function splitAt(block, r) {
      var t = document.createRange(), tail = block.cloneNode(false);
      t.selectNodeContents(block); t.setStart(r.startContainer, r.startOffset);
      tail.appendChild(t.extractContents());
      block.parentNode.insertBefore(tail, block.nextSibling);
      return tail;
    }
    function insertHtml(html) {
      var tmp = h('div'), r = need(), cur, kids, one, last, frag, tail, items, par, after;
      if (!r || !html) return;
      tmp.innerHTML = html;
      if (!tmp.firstChild) return;
      if (!r.collapsed) {
        try { document.execCommand('delete', false, null); } catch (e) {}
        r = getRange();
        if (r && !r.collapsed) { r.deleteContents(); }
        tidy(); r = getRange();
        if (!r) return;
      }
      cur = blockOf(r.startContainer);
      kids = Array.prototype.slice.call(tmp.children);
      one = kids.length === 1 && /^(P|H2|H3|H4|BLOCKQUOTE)$/.test(kids[0].tagName) ? kids[0] : null;
      if (cur && cur.tagName === 'FIGCAPTION') {            // captions are one line of plain words
        r.insertNode(document.createTextNode(tmp.textContent.replace(/\s+/g, ' ')));
        r.collapse(false); setRange(r);
        return;
      }
      if (cur && one && (one.tagName === 'P' || !blank(cur))) {   // a few words: they join the sentence
        frag = document.createDocumentFragment(); last = one.lastChild;
        while (one.firstChild) frag.appendChild(one.firstChild);
        if (!last) return;
        r.insertNode(frag);
        if (cur.lastChild && cur.lastChild.nodeName === 'BR' && cur.lastChild !== last && cur.childNodes.length > 1 && cur.lastChild.previousSibling === last) cur.removeChild(cur.lastChild);
        r = document.createRange(); r.setStartAfter(last); r.collapse(true); setRange(r);
        cur.normalize();
        return;
      }
      if (!cur) { place(kids, insertPoint()); caretEnd(kids[kids.length - 1]); return; }
      if (cur.tagName === 'LI') {                           // into a list: every pasted block is an item
        items = [];
        kids.forEach(function (k) {
          var src = /^(UL|OL)$/.test(k.tagName) ? Array.prototype.slice.call(k.children) : isBox(k) ? Array.prototype.slice.call(k.children) : /^(P|H2|H3|H4|BLOCKQUOTE)$/.test(k.tagName) ? [k] : [];
          src.forEach(function (s) { var li = h('li'); while (s.firstChild) li.appendChild(s.firstChild); if (!blank(li)) items.push(li); });
        });
        if (!items.length) return;
        tail = splitAt(cur, r); after = cur;
        items.forEach(function (it) { cur.parentNode.insertBefore(it, after.nextSibling); after = it; });
        if (blank(cur)) cur.parentNode.removeChild(cur);
        if (blank(tail)) tail.parentNode.removeChild(tail);
        caretEnd(after);
        return;
      }
      par = cur.parentNode;
      if (isBox(par)) {                                     // inside a highlight box: words only
        items = [];
        kids.forEach(function (k) { if (isBox(k)) each(Array.prototype.slice.call(k.children), function (c) { items.push(c); }); else if (/^(P|H2|H3|H4|UL|OL|BLOCKQUOTE)$/.test(k.tagName)) items.push(k); });
        kids = items;
        if (!kids.length) return;
      }
      tail = splitAt(cur, r); after = cur;
      kids.forEach(function (k) { par.insertBefore(k, after.nextSibling); after = k; });
      if (blank(cur)) par.removeChild(cur); else if (!cur.firstChild) cur.appendChild(h('br'));
      if (blank(tail)) { if (tail.nextElementSibling || !isIsland(after)) par.removeChild(tail); else tail.innerHTML = '<br>'; }
      if (isIsland(after) && !isBox(after)) { if (after.nextElementSibling) caretStart(after.nextElementSibling); }
      else caretEnd(after);
    }
    function onPaste(e) {
      var cd = e.clipboardData, html, text, files, clean, cur, r;
      if (!cd) return;
      e.preventDefault();
      html = cd.getData('text/html'); text = cd.getData('text/plain'); files = photoFiles(cd.files);
      r = getRange(); cur = r && blockOf(r.startContainer);
      if (cur && cur.tagName === 'FIGCAPTION') { if (text) run(function () { insertHtml(textToHtml(text.replace(/\s+/g, ' '))); }); return; }
      if (html) {
        clean = pasteClean(html);
        if (clean) { run(function () { insertHtml(clean); }); K.articleShow(surface); return; }
      }
      if (files.length) { addPhotos(files); return; }
      if (text) run(function () { insertHtml(textToHtml(text)); });
    }
    function hasFiles(e) { var t = e.dataTransfer && e.dataTransfer.types, i; if (!t) return false; for (i = 0; i < t.length; i++) if (t[i] === 'Files') return true; return false; }
    function onDrop(e) {
      var files, el, top, rect, pt = null;
      wrap.classList.remove('kyed-drop');
      if (!hasFiles(e)) return;
      e.preventDefault();
      files = photoFiles(e.dataTransfer.files);
      if (!files.length) { say('Only photos can be dropped here.', 'bad'); return; }
      el = document.elementFromPoint(e.clientX, e.clientY);
      top = el && surface.contains(el) ? topOf(el) : null;
      if (top) { rect = top.getBoundingClientRect(); pt = { ref: top, before: e.clientY < rect.top + rect.height / 2 }; }
      else pt = { ref: null, before: false };
      addPhotos(files, false, pt);
    }

    // ---------- keys ----------
    function newParaAfter(b) {
      run(function () { var p = emptyP(); b.parentNode.insertBefore(p, b.nextSibling); caret(p, 0); });
    }
    function onEnter(e) {
      var r = getRange(), b, box, fig, top;
      if (!r) return;
      b = blockOf(r.startContainer);
      if (!b) return;
      if (b.tagName === 'FIGCAPTION') {                      // captions are one line: Enter carries on below the photo
        e.preventDefault();
        fig = b.closest('figure'); top = fig && topOf(fig);
        if (top) textAfter(top);
        return;
      }
      if (!r.collapsed) return;
      if (b.tagName === 'LI') {
        if (blank(b) && !b.querySelector('ul,ol')) { e.preventDefault(); run(function () { var p = liftLi(b); caret(p, 0); }); }
        return;
      }
      box = isBox(b.parentNode) ? b.parentNode : null;
      if (box && b.tagName === 'P' && blank(b) && !b.nextElementSibling) {   // an empty last line in a box: step out of it
        e.preventDefault();
        run(function () {
          if (box.children.length > 1) { box.removeChild(b); b = emptyP(); surface.insertBefore(b, box.nextSibling); }
          else { b = emptyP(); surface.replaceChild(b, box); }
          caret(b, 0);
        });
        return;
      }
      if (b.tagName === 'BLOCKQUOTE') {
        e.preventDefault();
        if (atEnd(r, b)) newParaAfter(b);
        else run(function () { try { document.execCommand('insertLineBreak', false, null); } catch (e2) {} });
        return;
      }
      if (/^H[234]$/.test(b.tagName) || b.classList.contains('ky-intro')) {
        if (atEnd(r, b)) { e.preventDefault(); newParaAfter(b); }
        else if (atStart(r, b)) { e.preventDefault(); run(function () { keepSel(function () { b.parentNode.insertBefore(emptyP(), b); }); }); }
      }
    }
    function onBackspace(e) {
      var r = getRange(), b, top, prev, box;
      if (!r || !r.collapsed) return;
      b = blockOf(r.startContainer);
      if (!b || !atStart(r, b)) return;
      if (b.tagName === 'FIGCAPTION') { e.preventDefault(); return; }
      if (b.tagName === 'LI') { e.preventDefault(); run(function () { keepSel(function () { liftLi(b); }); }); return; }
      if (/^(H2|H3|H4|BLOCKQUOTE)$/.test(b.tagName) || b.classList.contains('ky-intro')) {   // first press: back to normal text
        e.preventDefault();
        run(function () { keepSel(function () { b = rep(b, 'p'); b.classList.remove('ky-intro'); stripGroup(b, GROUPS.s); if (!b.className) b.removeAttribute('class'); }); });
        return;
      }
      box = isBox(b.parentNode) ? b.parentNode : null;
      if (box && !b.previousElementSibling) {                // start of a box: the first line steps out of it
        e.preventDefault();
        run(function () { keepSel(function () { surface.insertBefore(b, box); if (!box.firstElementChild) surface.removeChild(box); }); });
        return;
      }
      if (box) return;
      top = topOf(b);
      prev = top && top.previousElementSibling;
      if (top !== b || !prev) return;
      if (prev.tagName === 'HR') { e.preventDefault(); run(function () { keepSel(function () { surface.removeChild(prev); }); }); return; }
      if (prev.tagName === 'FIGURE' || isPair(prev)) {       // first press selects the photo, the next one removes it
        e.preventDefault();
        if (blank(b) && b.nextElementSibling) run(function () { surface.removeChild(b); });
        selectFig(prev.tagName === 'FIGURE' ? prev : prev.querySelector('figure'));
        figKeepsFocus();
      }
    }
    function onDelete(e) {
      var r = getRange(), b, top, nx;
      if (!r || !r.collapsed) return;
      b = blockOf(r.startContainer);
      if (!b || b.tagName === 'FIGCAPTION' || !atEnd(r, b)) { if (b && b.tagName === 'FIGCAPTION' && atEnd(r, b)) e.preventDefault(); return; }
      top = topOf(b);
      nx = top && top.nextElementSibling;
      if (!nx || (top !== b && b !== lastTextEl(top))) return;
      if (nx.tagName === 'HR') { e.preventDefault(); run(function () { keepSel(function () { surface.removeChild(nx); }); }); return; }
      if (nx.tagName === 'FIGURE' || isPair(nx)) { e.preventDefault(); selectFig(nx.tagName === 'FIGURE' ? nx : nx.querySelector('figure')); figKeepsFocus(); }
    }
    function onKey(e) {
      var mod = (e.ctrlKey || e.metaKey) && !e.altKey, k = String(e.key || '').toLowerCase(), top, sib;
      if (mod) {
        if (k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
        if (k === 'y') { e.preventDefault(); redo(); return; }
        if (k === 'b') { e.preventDefault(); fmtInline('strong'); return; }
        if (k === 'i') { e.preventDefault(); fmtInline('em'); return; }
        if (k === 'u') { e.preventDefault(); fmtInline('u'); return; }
        if (k === 'k') { e.preventDefault(); openLink(); return; }
        return;
      }
      if (selFig && !getRange()) {                            // a photo is selected and there is no caret
        top = topOf(selFig);
        if (k === 'backspace' || k === 'delete') { e.preventDefault(); figRemove(); }
        else if (k === 'enter') { e.preventDefault(); textAfter(top); }
        else if (k === 'escape' || k === 'arrowdown' || k === 'arrowright') { e.preventDefault(); if (k === 'escape') e.stopPropagation(); sib = top.nextElementSibling; deselect(); if (sib) caretStart(sib); }
        else if (k === 'arrowup' || k === 'arrowleft') { e.preventDefault(); sib = top.previousElementSibling; deselect(); if (sib && !isIsland(sib)) caretEnd(sib); else if (sib) caretStart(top.nextElementSibling); }
        else if (k.length === 1) e.preventDefault();
        return;
      }
      if (e.isComposing || e.keyCode === 229) return;
      if (k === 'escape') { if (pop || selFig) { e.preventDefault(); e.stopPropagation(); } closePop(); deselect(); }
      else if (k === 'enter' && !e.shiftKey) onEnter(e);
      else if (k === 'enter' && e.shiftKey) { var r = getRange(), b = r && blockOf(r.startContainer); if (b && b.tagName === 'FIGCAPTION') e.preventDefault(); }
      else if (k === 'backspace') onBackspace(e);
      else if (k === 'delete') onDelete(e);
    }
    function onBeforeInput(e) {
      var t = e.inputType, r, b;
      if (/^delete/.test(t || '')) { r = getRange(); wiped = !!r && !r.collapsed && surface.children.length > 1; }
      if (t === 'historyUndo') { e.preventDefault(); undo(); }
      else if (t === 'historyRedo') { e.preventDefault(); redo(); }
      else if (t === 'formatBold') { e.preventDefault(); fmtInline('strong'); }
      else if (t === 'formatItalic') { e.preventDefault(); fmtInline('em'); }
      else if (t === 'formatUnderline') { e.preventDefault(); fmtInline('u'); }
      else if (selFig && !getRange() && document.activeElement === surface) {   // a photo is selected: typing must not replace it
        e.preventDefault();
        if (/^delete/.test(t || '')) figRemove();
        else if (t === 'insertParagraph') textAfter(topOf(selFig));
      }
      else if (t === 'insertParagraph') onEnter(e);
      else if (t === 'insertLineBreak') { r = getRange(); b = r && blockOf(r.startContainer); if (b && b.tagName === 'FIGCAPTION') e.preventDefault(); }
    }
    function onInput(e) {
      var f = surface.firstElementChild;
      if (composing) return;
      // everything deleted: start again as normal text, not as whatever the last block was
      if (e && /^delete/.test(e.inputType || '') && wiped && surface.children.length === 1 && blank(f) && (f.tagName !== 'P' || f.className)) {
        surface.innerHTML = '<p><br></p>';
        caret(surface.firstChild, 0);
      }
      tidy();
      changed(false);
    }
    function onMouseDown(e) {
      var fig = e.target.closest ? e.target.closest('figure') : null;
      if (fig && surface.contains(fig)) {
        selectFig(fig);
        if (!(e.target.closest && e.target.closest('figcaption'))) { e.preventDefault(); figKeepsFocus(); }
      } else deselect();
    }
    function onSel() {
      var r = getRange();
      if (r) {
        lastRange = r.cloneRange();
        if (selFig && !selFig.contains(r.startContainer)) deselect();
      }
      refreshSoon();
    }
    function onDocDown(e) { if (selFig && !root.contains(e.target)) deselect(); }
    function onWin() { if (selFig) placeBar(); if (pop) placePop(); }

    // ---------- toolbar ----------
    function hold(e) { e.preventDefault(); }
    function button(key, icon, label, text, fn) {
      var b = h('button', 'kyed-b' + (text ? ' kyed-b-t' : ''));
      b.type = 'button'; b.title = label; b.setAttribute('aria-label', label); b.setAttribute('data-k', key);
      b.innerHTML = (icon ? ic(icon) : '') + (text ? '<span>' + esc(text) + '</span>' : '');
      b.addEventListener('mousedown', hold);
      b.addEventListener('click', function (e) { e.preventDefault(); fn(e, b); });
      btns[key] = b;
      return b;
    }
    function dropdown(key, label, text, icon, fn) {
      var b = button(key, icon, label, text || ' ', fn);
      b.classList.add('kyed-dd');
      if (!text) b.classList.add('kyed-dd-i');
      b.insertAdjacentHTML('beforeend', '<svg class="kyed-ic kyed-chev" viewBox="0 0 24 24" aria-hidden="true">' + ICON.chev + '</svg>');
      b.setAttribute('aria-haspopup', 'true'); b.setAttribute('aria-expanded', 'false');
      return b;
    }
    function group() { var g = h('div', 'kyed-g kyed-g' + (bar.children.length + 1)), i; for (i = 0; i < arguments.length; i++) g.appendChild(arguments[i]); bar.appendChild(g); return g; }
    function closePop() {
      if (!pop) return;
      if (pop.parentNode) pop.parentNode.removeChild(pop);
      if (popAnchor) { popAnchor.classList.remove('open'); popAnchor.setAttribute('aria-expanded', 'false'); }
      pop = popAnchor = null;
      document.removeEventListener('mousedown', popOut, true);
    }
    function popOut(e) { if (pop && !pop.contains(e.target) && !(popAnchor && popAnchor.contains(e.target))) closePop(); }
    function placePop() {
      if (!pop || !popAnchor) return;
      var left = popAnchor.offsetLeft, max = bar.clientWidth - pop.offsetWidth - 6;
      pop.style.left = Math.max(6, Math.min(left, max)) + 'px';
      pop.style.top = (popAnchor.offsetTop + popAnchor.offsetHeight + 6) + 'px';
    }
    // returns false when the same button was pressed again (the popover just closes)
    function openPop(anchor, el) {
      var same = popAnchor === anchor;
      closePop();
      if (same) return false;
      pop = el; popAnchor = anchor;
      anchor.classList.add('open'); anchor.setAttribute('aria-expanded', 'true');
      bar.appendChild(pop);
      placePop();
      document.addEventListener('mousedown', popOut, true);
      pop.addEventListener('keydown', function (e) {
        if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closePop(); surface.focus({ preventScroll: true }); if (lastRange) { try { setRange(lastRange); } catch (e2) {} } }
      });
      return true;
    }
    // items: [{ html, on, fn }]
    function menu(anchor, items, e, cls) {
      var m = h('div', 'kyed-pop kyed-menu' + (cls ? ' ' + cls : ''));
      m.setAttribute('role', 'menu');
      items.forEach(function (it) {
        var b = h('button', 'kyed-mi' + (it.on ? ' on' : ''), it.html);
        b.type = 'button'; b.setAttribute('role', 'menuitemradio'); b.setAttribute('aria-checked', it.on ? 'true' : 'false');
        b.addEventListener('mousedown', hold);
        b.addEventListener('click', function () { closePop(); it.fn(); });
        m.appendChild(b);
      });
      m.addEventListener('keydown', function (ev) {
        var list = Array.prototype.slice.call(m.querySelectorAll('button')), i = list.indexOf(document.activeElement);
        if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') { ev.preventDefault(); list[(i + (ev.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus(); }
      });
      if (openPop(anchor, m) && e && e.detail === 0) m.querySelector('button').focus();   // opened from the keyboard
    }
    // what the caret sits in right now
    function state() {
      var r = getRange() || (lastRange && surface.contains(lastRange.startContainer) ? lastRange : null), n, b, st = { style: 'p', f: '', s: '', c: '', hl: '', al: '' }, a, m, el;
      if (!r) return st;
      n = textsProbe(r); b = blockOf(n);
      st.has = true; st.collapsed = r.collapsed;
      if (b) {
        st.style = b.tagName === 'H2' ? 'h2' : b.tagName === 'H3' || b.tagName === 'H4' ? 'h3' : b.tagName === 'BLOCKQUOTE' ? 'quote' : b.classList.contains('ky-intro') ? 'intro' : 'p';
        st.al = groupTok(b, 'ky-al-');
        st.ul = !!up(b, /^UL$/); st.ol = !st.ul && !!up(b, /^OL$/);
      }
      for (el = n; el && el !== surface; el = el.parentNode) {
        if (el.nodeType !== 1) continue;
        if (!st.f) st.f = groupTok(el, GROUPS.f);
        if (!st.s) st.s = groupTok(el, GROUPS.s);
        if (!st.c) st.c = groupTok(el, GROUPS.c);
        if (!m && el.tagName === 'MARK') { m = el; st.hl = groupTok(el, GROUPS.hl) || 'ky-hl-gold'; }
      }
      if (r.collapsed && getRange()) {
        try { st.bold = document.queryCommandState('bold'); st.italic = document.queryCommandState('italic'); st.underline = document.queryCommandState('underline'); } catch (e) {}
      } else { st.bold = !!up(n, /^(STRONG|B)$/); st.italic = !!up(n, /^(EM|I)$/); st.underline = !!up(n, /^U$/); }
      a = linkAt(r);
      st.link = !!a; st.btn = !!a && a.classList.contains('ky-btn');
      st.box = boxAt(n);
      return st;
    }
    function labelOf(list, v) { for (var i = 0; i < list.length; i++) if (list[i][0] === v) return list[i][1]; return list[0][1]; }
    function on(key, v) { var b = btns[key]; if (!b) return; b.classList.toggle('on', !!v); b.setAttribute('aria-pressed', v ? 'true' : 'false'); }
    function refresh() {
      rafT = 0;
      if (dead) return;
      var st = state();
      btns.style.querySelector('span').textContent = labelOf(STYLES, st.style);
      btns.font.querySelector('span').textContent = labelOf(FONTS, st.f);
      btns.font.querySelector('span').className = st.f ? 'kyed-' + st.f.slice(3) : '';
      btns.size.querySelector('span').textContent = labelOf(SIZES, st.s);
      on('bold', st.bold); on('italic', st.italic); on('underline', st.underline);
      on('left', st.has && !st.al); on('centre', st.al === 'ky-al-c'); on('right', st.al === 'ky-al-r');
      btns.align.querySelector('svg').innerHTML = ICON[st.al === 'ky-al-c' ? 'centre' : st.al === 'ky-al-r' ? 'right' : 'left'];
      on('ul', st.ul); on('ol', st.ol); on('link', st.link); on('button', st.btn); on('box', !!st.box);
      btns.mark.className = btns.mark.className.replace(/\s*kyed-ink-\S+/g, '') + (st.hl ? ' kyed-ink-' + st.hl.slice(3) : '');
      btns.colour.className = btns.colour.className.replace(/\s*kyed-ink-\S+/g, '') + (st.c ? ' kyed-ink-' + st.c.slice(3) : '');
      btns.undo.disabled = !(hi > 0 || histT); btns.redo.disabled = !(hi < hist.length - 1);
    }
    function refreshSoon() { if (!rafT) rafT = (window.requestAnimationFrame || setTimeout)(refresh, 16); }
    function buildBar() {
      bar.setAttribute('role', 'toolbar'); bar.setAttribute('aria-label', 'Writing tools');
      group(
        button('undo', 'undo', 'Undo (' + MOD + '+Z)', '', undo),
        button('redo', 'redo', 'Redo (' + MOD + '+Shift+Z)', '', redo)
      );
      group(
        dropdown('style', 'Text style', 'Normal text', '', function (e, b) {
          var st = state();
          menu(b, STYLES.map(function (s) { return { html: '<span class="kyed-st-' + s[0] + '">' + s[1] + '</span>', on: st.style === s[0], fn: function () { setStyle(s[0]); } }; }), e);
        }),
        dropdown('font', 'Font', 'Standard', '', function (e, b) {
          var st = state();
          menu(b, FONTS.map(function (s) { return { html: '<span class="' + (s[0] ? 'kyed-' + s[0].slice(3) : '') + '">' + s[1] + '</span>', on: st.f === s[0], fn: function () { fmtClass('f', s[0]); } }; }), e);
        }),
        dropdown('size', 'Text size', 'Normal', '', function (e, b) {
          var st = state();
          menu(b, SIZES.map(function (s) { return { html: '<span class="' + (s[0] ? 'kyed-' + s[0].slice(3) : '') + '">' + s[1] + '</span>', on: st.s === s[0], fn: function () { fmtClass('s', s[0]); } }; }), e);
        })
      );
      group(
        button('bold', 'bold', 'Bold (' + MOD + '+B)', '', function () { fmtInline('strong'); }),
        button('italic', 'italic', 'Italic (' + MOD + '+I)', '', function () { fmtInline('em'); }),
        button('underline', 'underline', 'Underline (' + MOD + '+U)', '', function () { fmtInline('u'); }),
        dropdown('mark', 'Highlight', '', 'marker', function (e, b) {
          var st = state();
          menu(b, MARKS.map(function (s) { return { html: '<span class="kyed-sw ' + (s[0] ? 'kyed-' + s[0].slice(3) : 'kyed-none') + '"></span>' + s[1], on: !!s[0] && st.hl === s[0], fn: function () { fmtClass('hl', s[0]); } }; }), e);
        }),
        dropdown('colour', 'Text colour', '', 'colour', function (e, b) {
          var st = state();
          menu(b, COLOURS.map(function (s) { return { html: '<span class="kyed-sw kyed-dot ' + (s[0] ? 'kyed-' + s[0].slice(3) : 'kyed-c-def') + '"></span>' + s[1], on: st.c === s[0], fn: function () { fmtClass('c', s[0]); } }; }), e);
        }),
        button('clear', 'clear', 'Clear formatting', '', clearFmt)
      );
      group(
        button('left', 'left', 'Align left', '', function () { setAlign(''); }),
        button('centre', 'centre', 'Centre', '', function () { setAlign('ky-al-c'); }),
        button('right', 'right', 'Align right', '', function () { setAlign('ky-al-r'); }),
        dropdown('align', 'Alignment', '', 'left', function (e, b) {
          var st = state();
          menu(b, ALIGNS.map(function (s) { return { html: ic(s[2]) + s[1], on: st.al === s[0], fn: function () { setAlign(s[0]); } }; }), e);
        }),
        button('ul', 'ul', 'Bulleted list', '', function () { toggleList('ul'); }),
        button('ol', 'ol', 'Numbered list', '', function () { toggleList('ol'); })
      );
      group(
        button('link', 'link', 'Link (' + MOD + '+K)', 'Link', function () { openLink(); }),
        button('button', 'button', 'Button: show a link as a button', 'Button', toggleButton)
      );
      group(
        button('photo', 'photo', 'Add a photo', 'Photo', function () { var pt = insertPoint(); pick(true, function (fs) { addPhotos(fs, false, pt); }); }),
        button('pair', 'pair', 'Two photos side by side', 'Two photos', function () { var pt = insertPoint(); pick(true, function (fs) { addPhotos(fs, true, pt); }); }),
        dropdown('box', 'Highlight box', 'Box', 'box', function (e, b) {
          var st = state(), items = BOXES.map(function (s) { return { html: '<span class="kyed-sw kyed-bx ' + (s[0] ? 'kyed-' + s[0].slice(3) : 'kyed-box-gold') + '"></span>' + s[1], on: !!st.box && (st.box.classList.contains(s[0]) || (!s[0] && !groupTok(st.box, 'ky-box-'))), fn: function () { setBox(s[0]); } }; });
          if (st.box) items.push({ html: '<span class="kyed-sw kyed-none"></span>Remove the box', fn: unbox });
          menu(b, items, e);
        }),
        button('rule', 'rule', 'Divider line', 'Line', addRule)
      ).classList.add('kyed-g-last');
    }

    // ---------- public API ----------
    function isEmpty() { return blank(surface); }
    function getHTML() {
      if (isEmpty()) return '';
      var d = document.implementation.createHTMLDocument('').createElement('div'), n;
      d.innerHTML = K.articleClean(surface.innerHTML);    // drops editor attributes, blob: addresses and anything unsafe
      each(d.querySelectorAll('.ky-pair'), function (p) { if (p.children.length < 2) unwrap(p); });
      each(d.querySelectorAll('p, h2, h3, h4, blockquote, li, figcaption'), function (el) {
        var l = el.lastChild;
        if (l && l.nodeName === 'BR' && l.previousSibling) el.removeChild(l);   // a line break at the very end shows nothing
      });
      each(d.querySelectorAll('.ky-box'), function (b) {
        while ((n = b.firstElementChild) && n.tagName === 'P' && blank(n)) b.removeChild(n);
        while ((n = b.lastElementChild) && n.tagName === 'P' && blank(n)) b.removeChild(n);
        if (!b.firstElementChild) b.parentNode.removeChild(b);
      });
      // blank lines at the ends, or right next to a photo, box or line, are only there to type in
      each(Array.prototype.slice.call(d.children), function (el) {
        if (el.tagName === 'P' && blank(el) && (!el.previousElementSibling || !el.nextElementSibling || isIsland(el.previousElementSibling) || isIsland(el.nextElementSibling))) d.removeChild(el);
      });
      while ((n = d.firstElementChild) && n.tagName === 'P' && blank(n)) d.removeChild(n);
      while ((n = d.lastElementChild) && n.tagName === 'P' && blank(n)) d.removeChild(n);
      return d.innerHTML;
    }
    function setHTML(html) {
      deselect(); closePop();
      surface.innerHTML = K.articleClean(html == null ? '' : html);
      tidy();
      hist = []; hi = -1; clearTimeout(histT); histT = null; lastRange = null;
      record(); count(); refresh();
      if (K.articleShow) K.articleShow(surface).then(function () { if (selFig) placeBar(); });
    }
    function destroy() {
      if (dead) return;
      dead = true;
      clearTimeout(histT); clearTimeout(changeT); clearTimeout(msgT);
      closePop();
      document.removeEventListener('selectionchange', onSel);
      document.removeEventListener('mousedown', onDocDown, true);
      window.removeEventListener('resize', onWin);
      window.removeEventListener('scroll', onWin, true);
      if (root.parentNode) root.parentNode.removeChild(root);
    }

    // ---------- build ----------
    buildBar(); buildImgbar();
    surface.setAttribute('contenteditable', 'true');
    surface.setAttribute('role', 'textbox'); surface.setAttribute('aria-multiline', 'true');
    surface.setAttribute('aria-label', opt.label || 'Your story'); surface.setAttribute('spellcheck', 'true');
    ph.textContent = opt.placeholder || 'Write your story…';
    ph.setAttribute('aria-hidden', 'true');
    msgEl.setAttribute('role', 'status'); msgEl.setAttribute('aria-live', 'polite');
    wrap.appendChild(surface); wrap.appendChild(ph); wrap.appendChild(imgbar);
    foot.appendChild(countEl); foot.appendChild(msgEl);
    root.appendChild(bar); root.appendChild(wrap); root.appendChild(foot);
    host.appendChild(root);

    surface.addEventListener('keydown', onKey);
    surface.addEventListener('beforeinput', onBeforeInput);
    surface.addEventListener('input', onInput);
    surface.addEventListener('compositionstart', function () { composing = true; });
    surface.addEventListener('compositionend', function () { composing = false; onInput(); });
    surface.addEventListener('mousedown', onMouseDown);
    surface.addEventListener('paste', onPaste);
    surface.addEventListener('dragstart', function (e) { if (e.target.closest && e.target.closest('figure, img')) e.preventDefault(); });
    surface.addEventListener('dragover', function (e) { if (hasFiles(e)) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; wrap.classList.add('kyed-drop'); } });
    surface.addEventListener('dragleave', function (e) { if (!surface.contains(e.relatedTarget)) wrap.classList.remove('kyed-drop'); });
    surface.addEventListener('drop', onDrop);
    surface.addEventListener('focus', function () { try { document.execCommand('defaultParagraphSeparator', false, 'p'); } catch (e) {} });
    document.addEventListener('selectionchange', onSel);
    document.addEventListener('mousedown', onDocDown, true);
    window.addEventListener('resize', onWin);
    window.addEventListener('scroll', onWin, true);

    setHTML(opt.html || '');

    return {
      getHTML: getHTML,
      setHTML: setHTML,
      getText: function () { return K.articleText(getHTML()); },
      isEmpty: isEmpty,
      imageKeys: function () {
        var out = [];
        each(surface.querySelectorAll('img[data-ky-file]'), function (img) { var k = img.getAttribute('data-ky-file'); if (k && out.indexOf(k) < 0) out.push(k); });
        return out;
      },
      focus: function () { surface.focus(); if (!getRange()) caretStart(surface.firstElementChild); },
      destroy: destroy,
      // for the demo page and tests
      el: root, surface: surface,
      _: { addPhotos: addPhotos, insertHtml: function (html) { run(function () { insertHtml(html); }); }, pasteClean: pasteClean, undo: undo, redo: redo, tidy: tidy,
        cmd: { bold: function () { fmtInline('strong'); }, italic: function () { fmtInline('em'); }, underline: function () { fmtInline('u'); }, cls: fmtClass, clear: clearFmt, style: setStyle, align: setAlign, list: toggleList, box: setBox, unbox: unbox, rule: addRule, link: openLink, button: toggleButton },
        fig: { select: selectFig, width: figWidth, pos: figPos, move: figMove, remove: figRemove, swap: figSwap, current: function () { return selFig; } } }
    };
  }

  window.KyEditor = { mount: mount, prepImage: prepImage, normUrl: normUrl };
})();
