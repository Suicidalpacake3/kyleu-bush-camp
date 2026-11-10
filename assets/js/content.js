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

  // ---------- what staff change in the admin ----------
  // Website wording, contact details, rate names and descriptions, prices and the homepage photo.
  // Demo: the admin hands them to the website through this browser ("kyleu-web-content").
  // Live: the server saves them and fills them in before the page is sent.
  function webContent() { var x = null; try { x = JSON.parse(localStorage.getItem('kyleu-web-content') || 'null'); } catch (e) {} return x || {}; }
  // wording typed in the admin: **bold**, *highlighted*, [a link](https://...) and line breaks
  function editHtml(t) {
    return String(t == null ? '' : t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
      .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, function (_, a, u) { if (!/^(https?:|mailto:|tel:|#|[\w./-]+(\?|#|$))/i.test(u)) return a; var ext = /^https?:/i.test(u); return '<a href="' + u + '"' + (ext ? ' target="_blank" rel="noopener"' : '') + '>' + a + '</a>'; })
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>').replace(/\*([^*]+)\*/g, '<em>$1</em>').replace(/\n/g, '<br>');
  }
  function applyEdits(root) {
    var T = webContent().text; if (!T) return;
    var els = (root.querySelectorAll ? Array.prototype.slice.call(root.querySelectorAll('[data-edit]')) : []);
    if (root.matches && root.matches('[data-edit]')) els.unshift(root);
    els.forEach(function (el) { var v = T[el.getAttribute('data-edit')]; if (typeof v === 'string' && !el.hasAttribute('data-edited')) { el.setAttribute('data-edited', ''); var ico = el.hasAttribute('data-edit-icon') && el.firstElementChild && /^svg$/i.test(el.firstElementChild.tagName) ? el.firstElementChild.outerHTML : ''; el.innerHTML = ico + editHtml(v); } });
  }

  // ---------- settings ----------
  function parseSettings(md, plain) {
    var map = {}, secs = {};
    sections(md).forEach(function (sec) {
      var items = bullets(sec.lines); if (sec.title) secs[norm(sec.title)] = items;
      items.forEach(function (it) { map[norm(it.label)] = it.value; });
    });
    var so = socialLocal();
    if (so) { map.instagram = so.instagram || ''; map.facebook = so.facebook || ''; map.tiktok = so.tiktok || ''; if (so.hashtag) map.hashtag = so.hashtag; }
    var ws = plain ? {} : webContent().settings || {}; Object.keys(ws).forEach(function (k) { map[norm(k)] = ws[k]; });   // contact details changed in the admin
    return { raw: map, list: function (title) { return secs[norm(title)] || []; }, get: function (k, d) { var v = map[norm(k)]; return (v === undefined || v === '') ? d : v; } };
  }
  // social media set on the admin's Social media page (demo: this browser; live: from the server)
  function socialLocal() { try { return JSON.parse(localStorage.getItem('kyleu-web-social') || 'null'); } catch (e) { return null; } }

  // ---------- prices ----------
  function parsePrices(md, plain) {
    var secs = []; var year = '', W = plain ? {} : webContent(), over = W.prices || {};
    var ym = stripNotes(md).match(/Rates year:\s*(\d{4})/i); if (ym) year = ym[1];
    sections(md).forEach(function (sec) {
      if (!sec.title) return;
      var items = bullets(sec.lines).map(function (it) {
        var m = it.value.match(/^R?\s*([\d\s.,]+)\s*(?:[·|-]\s*)?(.*)$/i);
        var amount = m ? parseFloat(m[1].replace(/[\s,]/g, '')) : NaN;
        var row = { label: it.label, name: it.label, amount: amount, note: m ? m[2].trim() : it.value, raw: it.value };
        var o = over[sec.title + '|' + it.label];   // a price, name or description changed on the admin's Rates page
        if (o) { if (o.amount != null && !isNaN(o.amount)) row.amount = +o.amount; if (typeof o.note === 'string') row.note = o.note; if (o.name) row.name = o.name; }
        return row;
      });
      // the shop's products come from the admin's Products page once staff have changed them there
      if (/shop/i.test(sec.title) && W.shop) items = W.shop.map(function (p) { return { label: p.label, name: p.label, amount: +p.amount, note: p.note || '', raw: '' }; });
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
    // nights charged at the weekend rate (0 = Sunday night ... 6 = Saturday night): Friday, Saturday and Sunday unless staff change it in the admin
    var wkDays = W.rules && W.rules.wkDays && W.rules.wkDays.length ? W.rules.wkDays.map(Number) : [5, 6, 0];
    if (W.hol) { Object.keys(W.hol.del || {}).forEach(function (d) { delete holidays[d]; }); Object.keys(W.hol.add || {}).forEach(function (d) { holidays[d] = W.hol.add[d]; }); }
    return { year: year, sections: secs, find: find, num: num, holidays: holidays, wkDays: wkDays };
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

  // Demo: posts written in the admin portal are kept in this browser and shown with the blog.md posts.
  // Live: the admin saves posts on the server (or in WordPress) instead.
  function mergeLocal(posts) {
    var x = null; try { x = JSON.parse(localStorage.getItem('kyleu-web-news') || 'null'); } catch (e) {}
    if (!x) return posts;
    var hide = Object.assign({}, x.hidden || {}, x.deleted || {}), own = (x.posts || []).filter(function (p) { return !p.draft && p.title && !hide[p.slug]; }), mine = {};
    own.forEach(function (p) { mine[p.slug] = 1; });
    var out = posts.filter(function (p) { return !hide[p.slug] && !mine[p.slug]; }).concat(own.map(function (p) { return { title: p.title, slug: p.slug, date: p.date, image: p.image || '', summary: p.summary || '', tags: p.tags || [], body: p.body || '', html: !!p.html, front: !!p.front }; }));
    out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    return out;
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
  K.social = socialLocal;
  K.money = money; K.markdown = markdown; K.norm = norm; K.AREA = AREA; K.esc = esc;
  // Card vs EFT: prices.md holds the normal (EFT) price; card payments add the card fee.
  K.cardFee = function (P) { return P ? P.num('Booking rules', 'Card payment fee percentage', 3) : 3; };
  K.toCard = function (n, P) { return Math.round(n * (1 + K.cardFee(P) / 100)); };
  K.dualPair = function (cardAmt, eftAmt, tag) {
    if (!eftAmt) return 'Free';
    if (cardAmt === eftAmt) return money(eftAmt);   // no card fee: one price for everyone
    return '<span class="dual"><s class="dual-card" title="Card price">' + money(cardAmt) + '</s> <span class="dual-eft">' + money(eftAmt) + '</span>' + (tag === false ? '' : '<small class="dual-tag">EFT</small>') + '</span>';
  };
  K.dual = function (n, P, tag) { return K.dualPair(K.toCard(n, P), n, tag); };
  K.settings = function () { return load('settings').then(function (md) { return parseSettings(md); }); };
  K.prices = function () { return load('prices').then(function (md) { return parsePrices(md); }); };
  K.pricesFile = function () { return load('prices').then(function (md) { return parsePrices(md, true); }); };   // prices.md only (the admin starts from this)
  K.settingsFile = function () { return load('settings').then(function (md) { return parseSettings(md, true); }); };   // settings.md only
  K.webContent = webContent; K.editHtml = editHtml; K.applyEdits = applyEdits;
  K.blogFile = function () { return load('blog').then(parseBlog); };   // blog.md only (the admin uses this)

  /* ---------- Dinokeng updates (content/dinokeng-updates.md + what staff add in the admin) ---------- */
  function parseDgr(md) {
    var out = [];
    clean(md).replace(/<!--[\s\S]*?-->/g, '').split(/\n(?=##\s)/).forEach(function (p) {
      var m = p.match(/^##\s+(.+)\n([\s\S]*)$/); if (!m) return;
      var lines = m[2].replace(/^\n+/, '').split('\n'), meta = {}, i = 0;
      for (; i < lines.length; i++) { var mm = lines[i].match(/^([a-zA-Z ]+):\s*(.*)$/); if (!mm || !lines[i].trim()) break; meta[norm(mm[1])] = mm[2].trim(); }
      out.push({ title: m[1].trim(), slug: slug(m[1].trim()), type: meta.type || 'Dinokeng news', date: meta.date || '', image: meta.image || '', file: meta.file || '', size: meta.size || '', link: meta.link || '', button: meta.button || '',
        pinned: /^(yes|true)$/i.test(meta.pinned || ''), hidden: /^(yes|true)$/i.test(meta.hidden || ''), text: lines.slice(i).join('\n').trim(), src: 'file' });
    });
    return out;
  }
  K.dgrFile = function () { return load('dinokeng-updates').then(parseDgr); };
  // Demo: what staff add or change in the admin is kept in this browser ("kyleu-web-dgr"); uploaded files sit in the browser's file store.
  // Live: the admin saves them on the server.
  K.dgrUpdates = function () {
    return K.dgrFile().catch(function () { return []; }).then(function (list) {
      var x = null; try { x = JSON.parse(localStorage.getItem('kyleu-web-dgr') || 'null'); } catch (e) {}
      if (x) {
        var over = x.over || {};
        list = list.map(function (it) { return Object.assign({}, it, over[it.slug] || {}); }).filter(function (it) { return !it.deleted; }).concat((x.items || []).map(function (it) { return Object.assign({ src: 'admin' }, it); }));
      }
      return Promise.all(list.map(function (it) {
        var jobs = [];
        if (it.fileKey) jobs.push(K.files.get(it.fileKey).then(function (b) { if (b) it.file = URL.createObjectURL(b); }));
        if (it.coverKey) jobs.push(K.files.get(it.coverKey).then(function (b) { if (b) it.image = URL.createObjectURL(b); }));
        return Promise.all(jobs).then(function () { return it; });
      }));
    }).then(function (list) {
      return list.sort(function (a, b) { return (b.pinned - a.pinned) || (a.date < b.date ? 1 : -1); });
    });
  };
  // a small file store in the browser (IndexedDB) for PDFs and covers uploaded in the demo admin
  K.files = (function () {
    var dbp = null;
    function db() { if (!dbp) dbp = new Promise(function (ok, no) { if (!window.indexedDB) { no(); return; } var r = indexedDB.open('kyleu-files', 1); r.onupgradeneeded = function () { r.result.createObjectStore('f'); }; r.onsuccess = function () { ok(r.result); }; r.onerror = function () { no(r.error); }; }); return dbp; }
    function tx(mode, fn) { return db().then(function (d) { return new Promise(function (ok, no) { var t = d.transaction('f', mode), st = t.objectStore('f'), req = fn(st); t.oncomplete = function () { ok(req && req.result); }; t.onerror = function () { no(t.error); }; }); }); }
    return {
      put: function (k, blob) { return tx('readwrite', function (st) { return st.put(blob, k); }); },
      get: function (k) { return tx('readonly', function (st) { return st.get(k); }).catch(function () { return null; }); },
      del: function (k) { return tx('readwrite', function (st) { return st.delete(k); }).catch(function () {}); }
    };
  })();
  K.slug = slug;
  // Front page news: the camp news posts and Dinokeng news that staff marked "Show on the home page"
  K.frontNews = function () {
    return Promise.all([K.blog().catch(function () { return []; }), K.dgrUpdates().catch(function () { return []; })]).then(function (r) {
      var out = r[0].filter(function (p) { return p.front; }).map(function (p) { return { kind: 'Camp news', title: p.title, summary: p.summary, image: p.image, date: p.date, href: 'news.html?post=' + encodeURIComponent(p.slug) }; });
      r[1].filter(function (it) { return it.front && !it.hidden && it.title; }).forEach(function (it) {
        var own = !!it.article, href = own ? 'news.html?dgr=' + encodeURIComponent(it.slug || it.id) : (it.link || it.file || 'dinokeng.html#reserve-news');
        out.push({ kind: 'Dinokeng news', title: it.title, summary: (it.text || '').split(/\n\s*\n/)[0], image: it.image, date: it.date, href: href, ext: !own && /^(https?:|blob:)/.test(href) });
      });
      return out.sort(function (a, b) { return a.date < b.date ? 1 : -1; });
    });
  };
  // Map layout from the admin map editor: moved stands, stands taken off the map and new campsites.
  // Demo: saved in this browser. Live: assets/js/campmap-layout.js.
  var AREA_PHOTO = { fenced: 'assets/img/photos/fenced-camp-lawn.jpg', unfenced: 'assets/img/photos/trailer-unfenced.jpg', 'self-sufficient': 'assets/img/wildlife/tree-sunset.jpg' };
  function mapLayout() { var L = null; try { L = JSON.parse(localStorage.getItem('kyleu-web-map') || 'null'); } catch (e) {} return L || K.MAP_LAYOUT || null; }
  function withMap(list) {
    var L = mapLayout(); if (!L) return list;
    var pos = L.stands || {};
    list.forEach(function (s) { if (Object.prototype.hasOwnProperty.call(pos, s.id)) s.map = pos[s.id] ? { x: pos[s.id][0], y: pos[s.id][1] } : null; });
    (L.newStands || []).forEach(function (n) {
      if (!n || !n.name || list.some(function (s) { return s.id === n.id; })) return;
      var ak = AREA[n.area] ? n.area : 'unfenced';
      list.push({ id: n.id, name: n.name, area: ak, areaInfo: AREA[ak], status: 'new', photos: [AREA_PHOTO[ak]], guests: n.guests || 8, setups: '', feel: '', highlights: [], map: n.map ? { x: n.map.x, y: n.map.y } : null, description: '' });
    });
    return list;
  }
  K.stands = function () { return load('stands').then(parseStands).then(withMap); };
  K.standsFile = function () { return load('stands').then(parseStands); };   // stands.md only (the map editor uses this)
  // Blog: reads content/blog.md by default. Once the site lives on WordPress,
  // set "Blog source: wordpress" in content/settings.md and posts written in
  // the normal WordPress editor (wp-admin → Posts) appear here automatically.
  K.blog = function () {
    return K.settings().catch(function () { return null; }).then(function (S) {
      var src = S ? S.get('Blog source', 'markdown') : 'markdown';
      if (!/wordpress/i.test(src)) return load('blog').then(parseBlog).then(mergeLocal);
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

  // ---------- wording and homepage details changed in the admin ----------
  (function () {
    var W = webContent(), ws = W.settings || {};
    applyEdits(document);
    if (W.text && window.MutationObserver) new MutationObserver(function (ms) { ms.forEach(function (m) { Array.prototype.forEach.call(m.addedNodes, function (n) { if (n.nodeType === 1) applyEdits(n); }); }); }).observe(document.documentElement, { childList: true, subtree: true });
    // the home page's header photo picked in the admin (one of Kyleu's own, or an uploaded one)
    var hs = document.querySelector('.hero-slide[data-bg]'), hh = (W.home || {}).hero, HERO = { tree: ['assets/img/hero/kyleu-camp.jpg', 'assets/img/hero/kyleu-camp-m.jpg', 'center', 'center'] };
    if (hs && hh && HERO[hh]) { hs.setAttribute('data-bg', HERO[hh][0]); hs.setAttribute('data-bg-m', HERO[hh][1]); hs.style.setProperty('--pos', HERO[hh][2]); hs.style.setProperty('--pos-m', HERO[hh][3]); }
    if (hs && hh === 'own') { var hd = [hs.getAttribute('data-bg'), hs.getAttribute('data-bg-m')]; hs.removeAttribute('data-bg-m'); hs.setAttribute('data-bg', ''); K.files.get('home-hero').then(function (b) { if (!b) { hs.style.backgroundImage = "url('" + (window.matchMedia('(max-aspect-ratio: 1/1)').matches ? hd[1] : hd[0]) + "')"; return; } hs.style.setProperty('--pos', 'center'); hs.style.setProperty('--pos-m', 'center'); hs.style.backgroundImage = "url('" + URL.createObjectURL(b) + "')"; hs.setAttribute('data-own', ''); }); }
    // numbers in the "at a glance" strip that come from the contact details
    Array.prototype.forEach.call(document.querySelectorAll('[data-setting-count]'), function (el) { var v = ws[norm(el.getAttribute('data-setting-count'))]; if (v && !isNaN(parseFloat(v))) { el.setAttribute('data-count', parseFloat(v)); el.textContent = parseFloat(v); } });
    Array.prototype.forEach.call(document.querySelectorAll('[data-setting-now]'), function (el) { var v = ws[norm(el.getAttribute('data-setting-now'))]; if (v) el.textContent = v; });
  })();

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
        if (/dinokeng/i.test(parts[0]) || el.hasAttribute('data-plain')) el.textContent = v === 0 && el.hasAttribute('data-free') ? 'Free' : money(v);   // Dinokeng's fees are not Kyleu's
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
        if (h && !/^(tel|mail|wa)$/.test(h)) { var u = S.get(h); if (u) { el.href = u; if (el.hasAttribute('data-hide-empty')) el.hidden = false; } else if (el.hasAttribute('data-hide-empty')) el.hidden = true; }
      });
    }).catch(function () {});
  });
})();
