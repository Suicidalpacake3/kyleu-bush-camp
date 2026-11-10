/* =========================================================
   Kyleu articles: shared helpers for the public site and the admin writing tool
     Kyleu.articleClean(html)  safe HTML (whitelist only, nothing executes)
     Kyleu.articleShow(el)     fills in uploaded photos (<img data-ky-file="KEY">)
     Kyleu.articleText(html)   plain text, one line per paragraph
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};

  function set(s) { var o = {}; s.split(' ').forEach(function (k) { o[k] = 1; }); return o; }
  // removed together with everything inside them
  var DROP = set('script style iframe frame frameset object embed applet noscript template head title meta link base svg math select option optgroup textarea button input video audio source track canvas map area dialog datalist col colgroup noembed noframes xmp plaintext');
  var BLOCK = { p: 'p', h1: 'h2', h2: 'h2', h3: 'h3', h4: 'h4', h5: 'h4', h6: 'h4', blockquote: 'blockquote' };
  // other block-level tags: become a paragraph, or are unwrapped when they only hold more blocks
  var PLAIN = set('div section article header footer main aside nav address pre center dd dt tr li caption figcaption');
  var INLINE = { strong: 'strong', b: 'strong', em: 'em', i: 'em', u: 'u', s: 's', strike: 's', del: 's', mark: 'mark', span: 'span', font: 'span' };
  var BLOCKISH = 'p,h1,h2,h3,h4,h5,h6,blockquote,div,ul,ol,table,figure,hr,section,article,pre,li';
  var KEY_OK = /^[A-Za-z0-9_-]+$/;

  function classes(n) {
    return (n.getAttribute('class') || '').split(/\s+/).filter(function (t) { return /^ky-[a-z0-9-]+$/i.test(t); }).join(' ');
  }
  function hasTok(c, t) { return (' ' + c + ' ').indexOf(' ' + t + ' ') >= 0; }
  function isList(el) { return el.tagName === 'UL' || el.tagName === 'OL'; }
  function mk(out, tag, src) {
    var el = out.ownerDocument.createElement(tag), c = src ? classes(src) : '';
    if (c) el.setAttribute('class', c);
    return el;
  }
  // links: http, https, mailto, tel or a relative path. Photos: http, https or a relative path.
  function safeUrl(v, img) {
    v = String(v == null ? '' : v).replace(/[\u0000-\u001f\u007f]/g, '').trim();
    if (!v) return '';
    var m = /^([a-z][a-z0-9+.\-]*):/i.exec(v);
    if (m && !(img ? /^https?$/i : /^(https?|mailto|tel)$/i).test(m[1])) return '';
    return v;
  }

  function brk(out) {
    var l = out.lastChild;
    if (l && !(l.nodeType === 1 && l.tagName === 'BR')) out.appendChild(out.ownerDocument.createElement('br'));
  }
  // append, with a line break first when a block was just unwrapped into this parent
  function add(out, c) {
    if (out._kyBrk) { out._kyBrk = 0; brk(out); }
    out.appendChild(c);
  }
  function empty(el) { return !el.textContent.replace(/\s/g, '') && !el.querySelector('img'); }

  function walk(src, out, cx) {
    var kids = src.childNodes, i;
    for (i = 0; i < kids.length; i++) node(kids[i], out, cx);
  }

  function node(n, out, cx) {
    var doc = out.ownerDocument, tag, el, c, st, bt, it, href, i;
    if (n.nodeType === 3) {
      if (isList(out) || cx.pair) return;
      var t = n.nodeValue.replace(/[​﻿]/g, '').replace(/ /g, ' ');
      if (!t) return;
      if (/\S/.test(t)) add(out, doc.createTextNode(t)); else out.appendChild(doc.createTextNode(t));
      return;
    }
    if (n.nodeType !== 1) return;
    tag = n.nodeName.toLowerCase();
    if (DROP[tag]) return;

    // inside a list only list items are allowed
    if (isList(out)) {
      if (tag === 'ul' || tag === 'ol') { walk(n, out, cx); return; }
      el = mk(out, 'li', tag === 'li' ? n : null);
      if (tag === 'li') walk(n, el, { inline: 1, li: 1 }); else node(n, el, { inline: 1, li: 1 });
      if (el.childNodes.length && !empty(el)) out.appendChild(el);
      return;
    }
    // a photo pair only holds photos
    if (cx.pair && tag !== 'figure') { walk(n, out, cx); return; }

    if (tag === 'br') { if (cx.inline) add(out, doc.createElement('br')); return; }
    if (tag === 'hr') { if (!cx.inline) add(out, mk(out, 'hr', n)); return; }

    if (tag === 'img') {
      var src = safeUrl(n.getAttribute('src'), true), key = n.getAttribute('data-ky-file') || '';
      if (!KEY_OK.test(key)) key = '';
      if (!src && !key) return;
      el = mk(out, 'img', n);
      if (src) el.setAttribute('src', src);
      el.setAttribute('alt', n.getAttribute('alt') || '');
      if (key) el.setAttribute('data-ky-file', key);
      add(out, el);
      return;
    }

    if (tag === 'figure') {
      if (cx.inline) { walk(n, out, cx); return; }
      var tmp = mk(out, 'figure', n), pic, cap;
      walk(n, tmp, { inline: 1 });
      pic = tmp.querySelector('img');
      if (!pic) return;
      for (i = 0; i < tmp.childNodes.length; i++) if (tmp.childNodes[i].nodeName === 'FIGCAPTION') { cap = tmp.childNodes[i]; break; }
      el = mk(out, 'figure', n);
      el.appendChild(pic);
      if (cap && !empty(cap)) el.appendChild(cap);
      add(out, el);
      return;
    }
    if (tag === 'figcaption' && out.tagName === 'FIGURE') {
      el = mk(out, 'figcaption', n);
      walk(n, el, { inline: 1 });
      out.appendChild(el);
      return;
    }

    if (tag === 'ul' || tag === 'ol') {
      if (cx.inline && !cx.li) { walk(n, out, cx); return; }
      el = mk(out, tag, n);
      walk(n, el, {});
      if (el.childNodes.length) add(out, el);
      return;
    }

    if (tag === 'div' && !cx.inline && !cx.box && !cx.pair) {
      c = classes(n);
      if (hasTok(c, 'ky-box')) {
        el = mk(out, 'div', n);
        walk(n, el, { box: 1 });
        wrapLoose(el);
        if (el.childNodes.length) add(out, el);
        return;
      }
      if (hasTok(c, 'ky-pair')) {
        el = mk(out, 'div', n);
        walk(n, el, { pair: 1 });
        if (el.childNodes.length) add(out, el);
        return;
      }
    }

    bt = BLOCK[tag] || (PLAIN[tag] ? 'p' : '');
    if (bt) {
      if (cx.inline) {                       // a block inside a paragraph: keep the words, on their own line
        if (out.childNodes.length) out._kyBrk = 1;
        walk(n, out, cx);
        if (out.childNodes.length) out._kyBrk = 1;
        return;
      }
      if (PLAIN[tag] && n.querySelector(BLOCKISH)) { walk(n, out, cx); return; }
      el = mk(out, bt, n);
      walk(n, el, { inline: 1 });
      if (empty(el)) {
        if (!el.querySelector('br')) return;                 // nothing in it at all
        el = doc.createElement('p'); el.appendChild(doc.createElement('br'));   // a blank line stays a blank line
      }
      add(out, el);
      return;
    }

    if (tag === 'a') {
      href = safeUrl(n.getAttribute('href'));
      if (!href || cx.a) { walk(n, out, cx); return; }
      el = mk(out, 'a', n);
      el.setAttribute('href', href);
      if ((n.getAttribute('target') || '').toLowerCase() === '_blank') { el.setAttribute('target', '_blank'); el.setAttribute('rel', 'noopener'); }
      walk(n, el, { inline: 1, a: 1 });
      if (el.childNodes.length) add(out, el);
      return;
    }

    it = INLINE[tag];
    if (it) {
      st = n.getAttribute('style') || '';
      var icx = { inline: 1, a: cx.a };
      if (it === 'strong' && /font-weight\s*:\s*(normal|[1-4]00)/i.test(st)) { walk(n, out, cx); return; }   // Google Docs wraps everything in a "not bold" <b>
      if (it === 'span') {
        // Word and Google Docs say bold and italic with inline styles: keep the meaning, drop the style
        var chain = [];
        c = tag === 'span' ? classes(n) : '';
        if (c) chain.push(mk(out, 'span', n));
        if (/font-weight\s*:\s*(bold|[6-9]00)/i.test(st)) chain.push(doc.createElement('strong'));
        if (/font-style\s*:\s*italic/i.test(st)) chain.push(doc.createElement('em'));
        if (/text-decoration[^;]*underline/i.test(st) && !cx.a) chain.push(doc.createElement('u'));
        if (!chain.length) { walk(n, out, cx); return; }
        for (i = 1; i < chain.length; i++) chain[i - 1].appendChild(chain[i]);
        walk(n, chain[chain.length - 1], icx);
        if (chain[chain.length - 1].childNodes.length) add(out, chain[0]);
        return;
      }
      el = mk(out, it, n);
      walk(n, el, icx);
      if (el.childNodes.length) add(out, el);
      return;
    }

    if (tag === 'td' || tag === 'th') {      // tables become text: one line per row
      walk(n, out, cx);
      if (out.lastChild) out.appendChild(doc.createTextNode(' '));
      return;
    }
    walk(n, out, cx);                        // anything else: keep the words, lose the tag
  }

  // loose text at the top level gets its own paragraph
  function wrapLoose(root) {
    var doc = root.ownerDocument, n = root.firstChild, p = null, next;
    while (n) {
      next = n.nextSibling;
      if (n.nodeType === 1 && /^(P|H2|H3|H4|BLOCKQUOTE|UL|OL|FIGURE|DIV|HR)$/.test(n.tagName)) p = null;
      else if (n.nodeType === 3 && !/\S/.test(n.nodeValue) && !p) root.removeChild(n);
      else { if (!p) { p = doc.createElement('p'); root.insertBefore(p, n); } p.appendChild(n); }
      n = next;
    }
  }

  // Word pastes lists as paragraphs with a typed bullet: turn them back into real lists
  function wordLists(body) {
    var ps = body.querySelectorAll('p[style*="mso-list"], p[class^="MsoListParagraph"]'), i, p, ig, marker, tag, prev, li, list, doc = body.ownerDocument;
    for (i = 0; i < ps.length; i++) {
      p = ps[i];
      ig = p.querySelector('[style*="mso-list:Ignore"], [style*="mso-list: Ignore"]');
      marker = ig ? ig.textContent.replace(/\s/g, '') : '';
      if (ig) ig.parentNode.removeChild(ig);
      tag = /^(\d+|[a-z]{1,3})[.)]/i.test(marker) ? 'ol' : 'ul';
      prev = p.previousElementSibling;
      li = doc.createElement('li');
      while (p.firstChild) li.appendChild(p.firstChild);
      if (prev && prev.nodeName.toLowerCase() === tag && prev._kyWord) list = prev;
      else { list = doc.createElement(tag); list._kyWord = 1; p.parentNode.insertBefore(list, p); }
      list.appendChild(li);
      p.parentNode.removeChild(p);
    }
  }

  function cleanTo(html) {
    var src = new DOMParser().parseFromString('<!doctype html><body>' + String(html), 'text/html');
    var root = document.implementation.createHTMLDocument('').createElement('div');
    wordLists(src.body);
    walk(src.body, root, {});
    wrapLoose(root);
    return root;
  }

  K.articleClean = function (html) {
    if (html == null || html === '') return '';
    try { return cleanTo(html).innerHTML; } catch (e) { return ''; }
  };

  K.articleText = function (html) {
    if (html == null || html === '') return '';
    var out = [];
    function go(n) {
      var i, k;
      for (i = 0; i < n.childNodes.length; i++) {
        k = n.childNodes[i];
        if (k.nodeType === 3) out.push(k.nodeValue);
        else if (k.nodeType === 1) {
          var block = /^(P|H2|H3|H4|BLOCKQUOTE|LI|FIGCAPTION|FIGURE|DIV|BR|HR|UL|OL)$/.test(k.tagName);
          if (block) out.push('\n');
          go(k);
          if (block) out.push('\n');
        }
      }
    }
    try { go(cleanTo(html)); } catch (e) { return ''; }
    return out.join('').split('\n').map(function (l) { return l.replace(/\s+/g, ' ').trim(); }).filter(Boolean).join('\n');
  };

  // uploaded photos are stored by key: look each one up and show it
  var urls = {};
  K.articleShow = function (el) {
    var jobs = [];
    if (!el || !el.querySelectorAll || !K.files || !K.files.get) return Promise.resolve();
    Array.prototype.forEach.call(el.querySelectorAll('img[data-ky-file]'), function (img) {
      var key = img.getAttribute('data-ky-file'), p;
      if (img.getAttribute('src') || !KEY_OK.test(key)) return;
      if (urls[key]) { img.src = urls[key]; return; }
      try { p = Promise.resolve(K.files.get(key)); } catch (e) { return; }
      jobs.push(p.then(function (b) {
        if (!b) return;
        if (!urls[key]) urls[key] = URL.createObjectURL(b);
        img.src = urls[key];
      }).catch(function () {}));
    });
    return Promise.all(jobs).then(function () {});
  };
})();
