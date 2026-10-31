/* =========================================================
   Kyleu content engine
   Reads the plain-text files in /content and turns them into data:
     content/prices.md   → rates, fees, booking rules, holidays
     content/stands.md   → every stand (name, area, photos, details)
     content/settings.md → phone, email, links
     content/blog.md     → blog posts
   The Kyleu team only ever edits those .md files.
   ========================================================= */
(function () {
  'use strict';
  var cache = {};
  var BASE = (document.querySelector('meta[name="kyleu-base"]') || {}).content || '';

  function load(name) {
    if (!cache[name]) {
      cache[name] = fetch(BASE + 'content/' + name + '.md', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw new Error(r.status); return r.text(); })
        .catch(function (e) {
          showPreviewHint();
          throw e;
        });
    }
    return cache[name];
  }

  // When the site is opened by double-clicking (file://) the browser blocks
  // reading the .md files. Show a friendly hint instead of a broken page.
  var hinted = false;
  function showPreviewHint() {
    if (hinted || location.protocol !== 'file:') return;
    hinted = true;
    var d = document.createElement('div');
    d.style.cssText = 'position:fixed;left:12px;right:12px;top:12px;z-index:2000;background:#2a1b12;color:#fff;padding:14px 18px;border-radius:12px;font:600 14px/1.5 system-ui;box-shadow:0 10px 30px rgba(0,0,0,.4)';
    d.innerHTML = 'Preview tip: prices, stands and blog posts load from the <b>content</b> folder. Double-click <b>Preview website.bat</b> in the project folder to view the live version. <button style="margin-left:8px;background:#e8731c;color:#fff;border:0;border-radius:8px;padding:4px 10px;cursor:pointer">OK</button>';
    d.querySelector('button').onclick = function () { d.remove(); };
    document.body.appendChild(d);
  }

  // ---------- helpers ----------
  function clean(s) { return (s || '').replace(/\r/g, ''); }
  function stripNotes(md) {
    return clean(md).replace(/<!--[\s\S]*?-->/g, '').split('\n').filter(function (l) { return !/^\s*>/.test(l); }).join('\n');
  }
  function norm(s) { return (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim(); }
  function sections(md) {
    var out = []; var cur = { title: '', lines: [] };
    stripNotes(md).split('\n').forEach(function (line) {
      var m = line.match(/^##\s+(.+)$/);
      if (m) { out.push(cur); cur = { title: m[1].trim(), lines: [] }; }
      else cur.lines.push(line);
    });
    out.push(cur);
    return out;
  }
  function bullets(lines) {
    var items = [];
    lines.forEach(function (l) {
      var m = l.match(/^\s*[-*]\s+(.+?):\s*(.*)$/);
      if (m) items.push({ label: m[1].trim(), value: m[2].trim() });
    });
    return items;
  }
  function money(n) {
    if (n == null || isNaN(n)) return '';
    var s = Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return 'R' + s;
  }

  // ---------- settings ----------
  function parseSettings(md) {
    var map = {};
    sections(md).forEach(function (sec) {
      bullets(sec.lines).forEach(function (it) { map[norm(it.label)] = it.value; });
    });
    return { raw: map, get: function (k, d) { var v = map[norm(k)]; return (v === undefined || v === '') ? d : v; } };
  }

  // ---------- prices ----------
  function parsePrices(md) {
    var secs = []; var year = '';
    var ym = stripNotes(md).match(/Rates year:\s*(\d{4})/i); if (ym) year = ym[1];
    sections(md).forEach(function (sec) {
      if (!sec.title) return;
      var items = bullets(sec.lines).map(function (it) {
        var m = it.value.match(/^R?\s*([\d\s.,]+)\s*(?:[·|-]\s*)?(.*)$/i);
        var amount = m ? parseFloat(m[1].replace(/[\s,]/g, '')) : NaN;
        return { label: it.label, amount: amount, note: m ? m[2].trim() : it.value, raw: it.value };
      });
      secs.push({ title: sec.title, items: items });
    });
    function find(secKey, labelKey) {
      var sk = norm(secKey), lk = norm(labelKey);
      for (var i = 0; i < secs.length; i++) {
        if (norm(secs[i].title).indexOf(sk) !== 0 && norm(secs[i].title).indexOf(sk) < 0) continue;
        for (var j = 0; j < secs[i].items.length; j++) {
          if (norm(secs[i].items[j].label) === lk || norm(secs[i].items[j].label).indexOf(lk) === 0) return secs[i].items[j];
        }
      }
      return null;
    }
    function num(secKey, labelKey, dflt) { var f = find(secKey, labelKey); return f && !isNaN(f.amount) ? f.amount : dflt; }
    var holSec = secs.filter(function (s) { return /holiday|long weekend/i.test(s.title); })[0];
    var holidays = {};
    if (holSec) holSec.items.forEach(function (it) { if (/^\d{4}-\d{2}-\d{2}$/.test(it.label)) holidays[it.label] = it.raw; });
    return { year: year, sections: secs, find: find, num: num, holidays: holidays };
  }

  // ---------- stands ----------
  var AREA = {
    fenced: { key: 'fenced', name: 'Fenced Bush Camp', short: 'Fenced', priceSec: 'Ablution stands' },
    unfenced: { key: 'unfenced', name: 'Open (Unfenced) Bush Camp', short: 'Unfenced', priceSec: 'Ablution stands' },
    'self-sufficient': { key: 'self-sufficient', name: 'Self-Sufficient Sites', short: 'Self-sufficient', priceSec: 'Self-sufficient' }
  };
  function areaKey(v) { v = norm(v); if (v.indexOf('self') === 0) return 'self-sufficient'; if (v.indexOf('unfenced') === 0 || v.indexOf('open') === 0) return 'unfenced'; return 'fenced'; }
  function slug(s) { return norm(s).replace(/ /g, '-'); }
  function parseStands(md) {
    var list = [];
    sections(md).forEach(function (sec) {
      if (!sec.title) return;
      var f = {}; bullets(sec.lines).forEach(function (it) { f[norm(it.label)] = it.value; });
      var status = norm(f.status || 'open');
      if (status === 'closed') return;
      var folder = f.folder || slug(sec.title);
      var photos = (f.photos || '').split(',').map(function (p) { return p.trim(); }).filter(Boolean).map(function (p) { return /\//.test(p) ? p : 'assets/img/stands/' + folder + '/' + p; });
      var pos = (f['map position'] || '').split(',').map(function (n) { return parseFloat(n); });
      var ak = areaKey(f.area || '');
      list.push({
        id: slug(sec.title), name: sec.title, area: ak, areaInfo: AREA[ak], status: status,
        photos: photos, guests: parseInt(f.guests, 10) || 8, setups: f.setups || '', feel: f.feel || '',
        highlights: (f.highlights || '').split(',').map(function (h) { return h.trim(); }).filter(Boolean),
        map: pos.length === 2 && !isNaN(pos[0]) ? { x: pos[0], y: pos[1] } : null,
        description: f.description || ''
      });
    });
    return list;
  }

  // ---------- blog ----------
  function parseBlog(md) {
    var posts = [];
    var body = clean(md).replace(/<!--[\s\S]*?-->/g, '');
    var parts = body.split(/\n(?=##\s)/);
    parts.forEach(function (p) {
      var m = p.match(/^##\s+(.+)\n([\s\S]*)$/); if (!m) return;
      var title = m[1].trim(); var rest = m[2].replace(/^\n+/, '');
      var meta = {}; var lines = rest.split('\n'); var i = 0;
      for (; i < lines.length; i++) {
        var mm = lines[i].match(/^([a-zA-Z ]+):\s*(.*)$/);
        if (!mm || lines[i].trim() === '') break;
        meta[norm(mm[1])] = mm[2].trim();
      }
      if (/^(yes|true)$/i.test(meta.draft || '')) return;
      posts.push({
        title: title, slug: slug(title), date: meta.date || '', image: meta.image || '', summary: meta.summary || '',
        tags: (meta.tags || '').split(',').map(function (t) { return t.trim(); }).filter(Boolean),
        body: lines.slice(i).join('\n').trim()
      });
    });
    posts.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return posts;
  }

  // ---------- tiny markdown → HTML ----------
  function esc(s) { return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
  function inline(s) {
    return esc(s)
      .replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" loading="lazy">')
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, function (_, t, u) { var ext = /^https?:/.test(u); return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + t + '</a>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/\*([^*]+)\*/g, '<em>$1</em>')
      .replace(/`([^`]+)`/g, '<code>$1</code>');
  }
  function markdown(md) {
    var html = []; var list = null; var para = [];
    function flush() { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } if (list) { html.push('<' + list.t + '>' + list.items.map(function (i) { return '<li>' + inline(i) + '</li>'; }).join('') + '</' + list.t + '>'); list = null; } }
    clean(md).split('\n').forEach(function (line) {
      var h = line.match(/^(#{2,4})\s+(.+)/), li = line.match(/^\s*[-*]\s+(.+)/), ol = line.match(/^\s*\d+\.\s+(.+)/);
      if (h) { flush(); var lv = Math.min(4, h[1].length + 1); html.push('<h' + lv + '>' + inline(h[2]) + '</h' + lv + '>'); }
      else if (li || ol) { if (para.length) { html.push('<p>' + inline(para.join(' ')) + '</p>'); para = []; } var t = li ? 'ul' : 'ol'; if (!list || list.t !== t) { if (list) flush(); list = { t: t, items: [] }; } list.items.push((li || ol)[1]); }
      else if (!line.trim()) flush();
      else { if (list) flush(); para.push(line.trim()); }
    });
    flush();
    return html.join('\n');
  }

  // ---------- public API ----------
  var K = window.Kyleu = window.Kyleu || {};
  K.money = money; K.markdown = markdown; K.norm = norm; K.AREA = AREA; K.esc = esc;
  // Card vs EFT: prices.md holds the normal (EFT) price; card payments add the card fee.
  K.cardFee = function (P) { return P ? P.num('Booking rules', 'Card payment fee percentage', 3) : 3; };
  K.toCard = function (n, P) { return Math.round(n * (1 + K.cardFee(P) / 100)); };
  K.dualPair = function (cardAmt, eftAmt, tag) {
    if (!eftAmt) return 'FREE';
    return '<span class="dual"><s class="dual-card" title="Card price">' + money(cardAmt) + '</s> <span class="dual-eft">' + money(eftAmt) + '</span>' + (tag === false ? '' : '<small class="dual-tag">EFT</small>') + '</span>';
  };
  K.dual = function (n, P, tag) { return K.dualPair(K.toCard(n, P), n, tag); };
  K.settings = function () { return load('settings').then(parseSettings); };
  K.prices = function () { return load('prices').then(parsePrices); };
  K.stands = function () { return load('stands').then(parseStands); };
  // Blog: reads content/blog.md by default. Once the site lives on WordPress,
  // set "Blog source: wordpress" in content/settings.md and posts written in
  // the normal WordPress editor (wp-admin → Posts) appear here automatically.
  K.blog = function () {
    return K.settings().catch(function () { return null; }).then(function (S) {
      var src = S ? S.get('Blog source', 'markdown') : 'markdown';
      if (!/wordpress/i.test(src)) return load('blog').then(parseBlog);
      var site = (S.get('WordPress site', location.origin) || '').replace(/\/$/, '');
      return fetch(site + '/wp-json/wp/v2/posts?_embed&per_page=30').then(function (r) { return r.json(); }).then(function (list) {
        return list.map(function (p) {
          var tmp = document.createElement('div'); tmp.innerHTML = p.excerpt.rendered;
          var media = p._embedded && p._embedded['wp:featuredmedia'] && p._embedded['wp:featuredmedia'][0];
          var terms = (p._embedded && p._embedded['wp:term'] && p._embedded['wp:term'][0]) || [];
          return { title: (function () { var t = document.createElement('div'); t.innerHTML = p.title.rendered; return t.textContent; })(), slug: p.slug, date: p.date.slice(0, 10), image: media ? media.source_url : '', summary: tmp.textContent.trim().replace(/\s*\[…\]$/, '…'), tags: terms.map(function (t) { return t.name; }), body: p.content.rendered, html: true };
        });
      });
    });
  };

  // ---------- auto-bind data-* attributes ----------
  // <span data-price="Ablution stands|Weekday per person per night">R160</span>
  // <a data-setting-href="tel">…</a>, <span data-setting="Phone">…</span>
  document.addEventListener('DOMContentLoaded', function () {
    var priceEls = document.querySelectorAll('[data-price]');
    if (priceEls.length) K.prices().then(function (P) {
      priceEls.forEach(function (el) {
        var parts = el.getAttribute('data-price').split('|');
        var v = P.num(parts[0], parts[1], null);
        if (v == null) return;
        if (/dinokeng/i.test(parts[0]) || el.hasAttribute('data-plain')) el.textContent = v === 0 && el.hasAttribute('data-free') ? 'FREE' : money(v);   // Dinokeng's fees are not Kyleu's
        else el.innerHTML = K.dual(v, P, !el.hasAttribute('data-notag'));
      });
      document.querySelectorAll('[data-rates-year]').forEach(function (el) { if (P.year) el.textContent = P.year; });
    }).catch(function () {});
    var setEls = document.querySelectorAll('[data-setting],[data-setting-href]');
    if (setEls.length) K.settings().then(function (S) {
      setEls.forEach(function (el) {
        var k = el.getAttribute('data-setting'); if (k) { var v = S.get(k); if (v) el.textContent = v; }
        var h = el.getAttribute('data-setting-href');
        if (h === 'tel') el.href = 'tel:' + S.get('Phone', '').replace(/[^\d+]/g, '').replace(/^0/, '+27');
        if (h === 'mail') el.href = 'mailto:' + S.get('Email', '');
        if (h === 'wa') el.href = 'https://wa.me/' + S.get('WhatsApp number', '') + (el.dataset.waText ? '?text=' + encodeURIComponent(el.dataset.waText) : '');
        if (h && !/^(tel|mail|wa)$/.test(h)) { var u = S.get(h); if (u) el.href = u; else if (el.hasAttribute('data-hide-empty')) el.hidden = true; }
      });
    }).catch(function () {});
  });
})();
