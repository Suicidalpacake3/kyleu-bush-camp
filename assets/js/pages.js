/* =========================================================
   Page-specific behaviour (home, discover, news, contact, policies)
   ========================================================= */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var K = window.Kyleu;
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function fmtDate(iso) { if (!iso) return ''; var d = new Date(iso + 'T12:00:00'); return d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }); }
  function postCard(p, feature) {
    return '<a class="post-card' + (feature ? ' post-feature' : '') + (p.image ? '' : ' no-img') + '" href="news.html?post=' + p.slug + '" data-reveal>' +
      (p.image ? '<div class="img"><img src="' + p.image + '" alt="" loading="lazy"></div>' : '') +   // no photo: no empty frame
      '<div class="body"><div class="post-meta"><span>' + fmtDate(p.date) + '</span>' + (p.tags.length ? '<span>· ' + K.esc(p.tags.slice(0, 2).join(', ')) + '</span>' : '') + '</div>' +
      '<h3>' + K.esc(p.title) + '</h3><p>' + K.esc(p.summary) + '</p><span class="link-arrow">Read more</span></div></a>';
  }

  document.addEventListener('DOMContentLoaded', function () {

    /* ---------- comparison table: on a phone, one card per camp area (built from the table, so there is one source) ---------- */
    $$('table.compare').forEach(function (t) {
      var heads = $$('thead th', t).slice(1), rows = $$('tbody tr', t);
      var box = document.createElement('div'); box.className = 'compare-cards';
      box.innerHTML = heads.map(function (h, i) {
        return '<article class="cc"><h3>' + h.innerHTML + '</h3><dl>' + rows.map(function (r) {
          var cell = r.children[i + 1]; return cell ? '<div><dt>' + r.children[0].innerHTML + '</dt><dd>' + cell.innerHTML + '</dd></div>' : '';
        }).join('') + '</dl></article>';
      }).join('');
      var wrap = t.closest('.table-scroll') || t; wrap.parentNode.insertBefore(box, wrap.nextSibling); wrap.classList.add('compare-wide');
    });

    /* ---------- home page: front page news (only there while staff have marked a story for it) ---------- */
    $$('[data-front-news]').forEach(function (sec) {
      if (!K.frontNews) return;
      K.frontNews().then(function (list) {
        if (!list.length) return;
        var esc = K.esc, f = list[0], rest = list.slice(1, 3), att = function (x) { return x.ext ? ' target="_blank" rel="noopener"' : ''; };
        // a round "hot off the press" stamp whose words slowly turn
        var stamp = '<span class="fp-stamp" aria-hidden="true"><svg viewBox="0 0 120 120"><defs><path id="fp-ring" d="M60 60m-42 0a42 42 0 1 1 84 0a42 42 0 1 1-84 0"/></defs><g class="fp-ring"><text><textPath href="#fp-ring" textLength="262">HOT OFF THE PRESS · KYLEU NEWS ·</textPath></text></g><circle cx="60" cy="60" r="27"/><use href="#i-news" x="46" y="46" width="28" height="28"/></svg></span>';
        $('[data-front-list]', sec).innerHTML =
          '<a class="fp-card' + (f.image ? '' : ' no-img') + '" href="' + esc(f.href) + '"' + att(f) + ' data-reveal>' +
            (f.image ? '<span class="fp-photo"><span class="fp-pol"><span class="tape" aria-hidden="true"></span><img src="' + esc(f.image) + '" alt=""><span class="fp-cap">' + esc(f.kind) + '</span></span>' + stamp + '</span>' : '') +
            '<span class="fp-body"><span class="eyebrow">Front page news</span><strong class="fp-title">' + esc(f.title) + '</strong><span class="fp-meta">' + esc(f.kind) + (f.date ? ' · ' + fmtDate(f.date) : '') + '</span>' + (f.summary ? '<span class="fp-sum">' + esc(f.summary) + '</span>' : '') + '<span class="btn">Read the full story <svg aria-hidden="true"><use href="#i-arrow"/></svg></span></span>' + (f.image ? '' : stamp) + '</a>' +
          (rest.length ? '<div class="fp-more">' + rest.map(function (x) { return '<a class="fp-mini" href="' + esc(x.href) + '"' + att(x) + ' data-reveal>' + (x.image ? '<img src="' + esc(x.image) + '" alt="" loading="lazy">' : '') + '<span><small>' + esc(x.kind) + (x.date ? ' · ' + fmtDate(x.date) : '') + '</small><b>' + esc(x.title) + '</b></span></a>'; }).join('') + '</div>' : '');
        sec.hidden = false; K.reveal(sec);
      }).catch(function () {});
    });

    /* ---------- latest posts (Experience Kyleu): the section only shows when there is news ---------- */
    $$('[data-latest-posts]').forEach(function (el) {
      K.blog().then(function (posts) {
        if (!posts.length) return;
        el.innerHTML = posts.slice(0, parseInt(el.dataset.latestPosts, 10) || 3).map(function (p) { return postCard(p); }).join('');
        var sec = el.closest('[data-news-section]'); if (sec) sec.hidden = false;
        $$('[data-news-link]').forEach(function (a) { a.hidden = false; });
        K.reveal(el);
      }).catch(function () {});
    });

    /* ---------- Dinokeng page: news from the reserve (content/dinokeng-updates.md + admin) ----------
       The newest item is featured, the rest in a grid with filter tabs, maps and guides in their own row. */
    $$('[data-dgr-updates]').forEach(function (el) {
      var esc = K.esc, isMap = function (it) { return /map|guide/i.test(it.type); };
      var fdate = function (d) { return d ? new Date(d + 'T12:00:00').toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' }) : ''; };
      var btns = function (it, big) {
        var b = [];
        if (it.article) b.push('<a class="btn' + (big ? '' : ' btn-sm') + '" href="news.html?dgr=' + encodeURIComponent(it.slug || it.id) + '">Read the story <svg><use href="#i-arrow"/></svg></a>');
        if (it.link) b.push('<a class="btn' + (it.article ? ' btn-ghost' : '') + (big ? '' : ' btn-sm') + '" href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.button || 'Open') + ' <svg><use href="#i-arrow"/></svg></a>');
        if (it.file) b.push('<a class="btn' + (it.link ? ' btn-ghost' : '') + (big ? '' : ' btn-sm') + '" href="' + esc(it.file) + '" target="_blank" rel="noopener"><svg><use href="#i-doc"/></svg>' + (it.link ? 'Poster (PDF)' : isMap(it) ? 'Open the map' : 'Read it') + (it.size ? ' <small>' + esc(it.size) + '</small>' : '') + '</a>');
        if (it.file && big) b.push('<a class="dgr-dl" href="' + esc(it.file) + '" download>Download</a>');
        return b.join('');
      };
      var openUrl = function (it) { return it.article ? 'news.html?dgr=' + encodeURIComponent(it.slug || it.id) : it.link || it.file || '#'; };
      var cover = function (it, cls) { return it.image ? '<a class="' + cls + '" href="' + esc(openUrl(it)) + '"' + (it.article ? '' : ' target="_blank" rel="noopener"') + ' tabindex="-1" aria-hidden="true"><img src="' + esc(it.image) + '" alt="" loading="lazy"></a>' : '<span class="' + cls + ' none"><svg><use href="#i-news"/></svg></span>'; };
      var label = function (it) { return '<span class="dgr-lab">' + esc(it.type) + (it.date && !isMap(it) ? ' · ' + fdate(it.date) : '') + '</span>'; };
      var para = function (t) { return esc(t || '').split(/\n\s*\n/).map(function (x) { return '<p>' + x.trim().replace(/\n/g, '<br>') + '</p>'; }).join(''); };
      K.dgrUpdates().then(function (all) {
        all = all.filter(function (it) { return !it.hidden && it.title; });
        var news = all.filter(function (it) { return !isMap(it); }), maps = all.filter(isMap), filter = '', more = false;
        if (!all.length) { el.innerHTML = '<p class="muted">News from the reserve will appear here.</p>'; return; }
        var types = []; news.forEach(function (it) { if (types.indexOf(it.type) < 0) types.push(it.type); });
        function draw() {
          var list = news.filter(function (it) { return !filter || it.type === filter; }), feat = list[0], rest = list.slice(1), shown = more ? rest : rest.slice(0, 6);
          el.innerHTML = (types.length > 1 ? '<div class="dgr-tabs" role="tablist" aria-label="Show">' + [''].concat(types).map(function (t) { return '<button type="button" role="tab" aria-selected="' + (t === filter) + '" class="' + (t === filter ? 'on' : '') + '" data-dgr-f="' + esc(t) + '">' + esc(t || 'All') + '</button>'; }).join('') + '</div>' : '') +
            (feat ? '<article class="dgr-feat">' + cover(feat, 'dgr-cover') + '<div class="dgr-body">' + label(feat) + '<h3>' + esc(feat.title) + '</h3>' + para(feat.text) + '<div class="dgr-acts">' + btns(feat, true) + '</div></div></article>' : '') +
            (shown.length ? '<div class="dgr-grid">' + shown.map(function (it) { return '<article class="dgr-card">' + cover(it, 'dgr-thumb') + '<div class="dgr-body">' + label(it) + '<h4>' + esc(it.title) + '</h4><p>' + esc((it.text || '').split(/\n\s*\n/)[0]) + '</p><div class="dgr-acts">' + btns(it) + '</div></div></article>'; }).join('') + '</div>' : '') +
            (rest.length > 6 && !more ? '<p class="center"><button type="button" class="btn btn-ghost" data-dgr-more>Show older (' + (rest.length - 6) + ')</button></p>' : '') +
            (maps.length ? '<h3 class="dgr-maps-h"><svg><use href="#i-map"/></svg>Maps &amp; guides</h3><div class="dgr-maps">' + maps.map(function (it) { return '<article class="dgr-card map">' + cover(it, 'dgr-thumb') + '<div class="dgr-body"><h4>' + esc(it.title) + '</h4><p>' + esc((it.text || '').split(/\n\s*\n/)[0]) + '</p><div class="dgr-acts">' + btns(it) + '</div></div></article>'; }).join('') + '</div>' : '') +
            '<p class="dgr-credit">Published by Dinokeng Game Reserve and shared by Kyleu, a proud DGR CP member. More on <a href="https://www.dinokengreserve.co.za" target="_blank" rel="noopener">dinokengreserve.co.za</a>.</p>';
        }
        el.addEventListener('click', function (e) {
          var f = e.target.closest('[data-dgr-f]'); if (f) { filter = f.dataset.dgrF; more = false; draw(); return; }
          if (e.target.closest('[data-dgr-more]')) { more = true; draw(); }
        });
        draw();
      }).catch(function () { el.innerHTML = '<p class="muted">News from the reserve could not load right now.</p>'; });
    });

    /* ---------- social media: live Instagram and Facebook, and hand-picked posts ----------
       Set on the admin's Social media page (falls back to content/settings.md). */
    $$('[data-guest-stories]').forEach(function (el) {
      K.settings().then(function (S) {
        var so = K.social() || {}, esc = K.esc;
        // Stories: the list in content/settings.md, plus what staff added, hid or removed in the admin.
        // Links that are new in settings.md always show, even in a browser that still holds an older admin list.
        var md = (S.list ? S.list('Guest stories') : []).filter(function (it) { return /^https?:/.test(it.value); }).map(function (it) {
          var pp = it.value.split(' · '), x = { url: pp[0].trim(), title: it.label, by: (pp[1] || '').trim() };
          pp.slice(2).forEach(function (f) { var im = f.match(/^\s*image\s+(\S+)/i); if (im) x.img = im[1]; else if (/youtube|opens/i.test(f)) x.out = true; });
          return x;
        });
        var posts = md;
        if (so.posts) { var known = {}; so.posts.forEach(function (x) { known[x.url] = 1; }); (so.gone || []).forEach(function (u) { known[u] = 1; }); posts = md.filter(function (x) { return !known[x.url]; }).concat(so.posts.filter(function (x) { return x.show; })); }
        var igFeed = so.posts ? so.igFeed : S.get('Instagram feed ID', ''), igN = +(so.igCount || S.get('Instagram photos', 6)) || 6;
        var fbUrl = S.get('Facebook', ''), fbOn = so.posts ? so.fbFeed !== false : !/^off|no/i.test(S.get('Facebook feed', 'on'));
        var ytId = function (u) { var m = String(u).match(/(?:youtu\.be\/|[?&]v=|\/(?:embed|shorts|live)\/)([\w-]{11})/); return /youtu/i.test(u) && m ? m[1] : ''; };
        var KIND = { yt: ['YouTube', '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M21.6 7.2a2.5 2.5 0 0 0-1.8-1.8C18.2 5 12 5 12 5s-6.2 0-7.8.4A2.5 2.5 0 0 0 2.4 7.2 26 26 0 0 0 2 12a26 26 0 0 0 .4 4.8 2.5 2.5 0 0 0 1.8 1.8C5.8 19 12 19 12 19s6.2 0 7.8-.4a2.5 2.5 0 0 0 1.8-1.8A26 26 0 0 0 22 12a26 26 0 0 0-.4-4.8zM10 15V9l5.2 3z"/></svg>'], fb: ['Facebook', '<svg aria-hidden="true"><use href="#i-fb"/></svg>'], ig: ['Instagram', '<svg aria-hidden="true"><use href="#i-ig"/></svg>'], tt: ['TikTok', '<svg aria-hidden="true"><use href="#i-tt"/></svg>'], web: ['Article', '<svg aria-hidden="true"><use href="#i-news"/></svg>'] };
        // every story is the same card: a picture, where it comes from, a title and who made it
        var card = function (x) {
          var u = x.url, yt = ytId(u), host = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
          var kind = yt ? 'yt' : /instagram\.com/i.test(u) ? 'ig' : /facebook\.com|fb\.watch/i.test(u) ? 'fb' : /tiktok\.com/i.test(u) ? 'tt' : 'web';
          var video = !!yt || /\/(videos?|reels?|watch|tv)\b|fb\.watch|tiktok\.com/i.test(u), here = yt && !x.out;
          var pic = x.imgKey ? '<img data-gs-file="' + esc(x.imgKey) + '" alt="" loading="lazy">' : x.img ? '<img src="' + esc(x.img) + '" alt="" loading="lazy">'
            : yt ? '<img src="https://i.ytimg.com/vi/' + yt + '/maxresdefault.jpg" alt="" loading="lazy" onerror="this.onerror=null;this.src=\'https://i.ytimg.com/vi/' + yt + '/hqdefault.jpg\'">' : '<span class="gs-blank">' + KIND[kind][1] + '</span>';
          var go = here ? 'Watch here' : yt ? 'Watch on YouTube' : video ? 'Watch on ' + KIND[kind][0] : kind === 'web' ? 'Read the story' : 'See it on ' + KIND[kind][0];
          var inner = '<span class="gs-media">' + pic + '<span class="gs-badge">' + KIND[kind][1] + KIND[kind][0] + '</span>' + (video ? '<span class="gs-play" aria-hidden="true"></span>' : '') + '</span>' +
            '<span class="gs-body"><b>' + esc(x.title) + '</b><small>' + esc(x.by || host) + '</small><span class="gs-go">' + go + (here ? '' : ' <svg aria-hidden="true"><use href="#i-arrow"/></svg>') + '</span></span>';
          return here ? '<button type="button" class="gs-card gs-' + kind + '" data-gs-yt="' + yt + '" data-gs-url="' + esc(u) + '" data-gs-title="' + esc(x.title) + '" data-reveal>' + inner + '</button>'
            : '<a class="gs-card gs-' + kind + '" href="' + esc(u) + '" target="_blank" rel="noopener" data-reveal>' + inner + '</a>';
        };
        var live = (igFeed ? '<div class="soc-live-ig"><h3><svg><use href="#i-ig"/></svg>Latest on Instagram</h3><div class="ig-grid" data-ig-grid><p class="muted">Loading photos…</p></div></div>' : '') +
          (fbOn && fbUrl ? '<div class="soc-live-fb"><h3><svg><use href="#i-fb"/></svg>On Facebook</h3><a class="fb-card" href="' + esc(fbUrl) + '" target="_blank" rel="noopener"><span class="fb-ic"><svg><use href="#i-fb"/></svg></span><span class="fb-txt"><b>Kyleu Bush Camp</b><small>Camp news, sightings and photos from our guests</small></span><span class="btn btn-sm">See our page</span></a></div>' : '');
        var FIRST = 6, more = posts.length > FIRST;
        el.innerHTML = (live ? '<div class="soc-live' + (igFeed && fbOn && fbUrl ? ' two' : '') + '">' + live + '</div>' : '') +
          (posts.length ? '<div class="gs-grid' + (more ? ' gs-folded' : '') + '">' + posts.map(card).join('') + '</div>' + (more ? '<p class="center gs-more"><button type="button" class="btn btn-ghost" data-gs-more>Show all ' + posts.length + ' stories</button></p>' : '') : '') ||
          '<p class="muted">Guest stories will appear here.</p>';
        el.classList.remove('stories');
        // pictures staff uploaded in the admin (demo: kept in this browser's file store)
        $$('[data-gs-file]', el).forEach(function (im) { if (K.files) K.files.get(im.getAttribute('data-gs-file')).then(function (bl) { if (bl) im.src = URL.createObjectURL(bl); else im.outerHTML = '<span class="gs-blank"><svg aria-hidden="true"><use href="#i-news"/></svg></span>'; }); });
        // a YouTube video plays in a viewer on top of the page, so every card can stay the same size
        var closeViewer = function () { var m = $('.gs-viewer'); if (!m) return; m.remove(); document.documentElement.classList.remove('gs-lock'); document.removeEventListener('keydown', onViewerKey, true); if (closeViewer.back) { try { closeViewer.back.focus(); } catch (e) {} } };
        var onViewerKey = function (e) { if (e.key === 'Escape') { e.preventDefault(); closeViewer(); } };
        el.addEventListener('click', function (e) {
          if (e.target.closest('[data-gs-more]')) { $('.gs-grid', el).classList.remove('gs-folded'); e.target.closest('.gs-more').remove(); K.reveal(el); return; }
          var b = e.target.closest('[data-gs-yt]'); if (!b) return;
          var m = document.createElement('div'); m.className = 'gs-viewer'; m.setAttribute('role', 'dialog'); m.setAttribute('aria-modal', 'true'); m.setAttribute('aria-label', b.dataset.gsTitle || 'Video');
          m.innerHTML = '<div class="gs-viewer-in"><button type="button" class="gs-x" aria-label="Close the video"><svg aria-hidden="true"><use href="#i-x"/></svg></button><div class="gs-frame"><iframe src="https://www.youtube-nocookie.com/embed/' + b.dataset.gsYt + '?autoplay=1&rel=0" title="' + esc(b.dataset.gsTitle || 'YouTube video') + '" allow="autoplay; encrypted-media; picture-in-picture; fullscreen" allowfullscreen></iframe></div>' +
            '<p class="gs-cap"><b>' + esc(b.dataset.gsTitle || '') + '</b><a href="' + esc(b.dataset.gsUrl) + '" target="_blank" rel="noopener">Open on YouTube</a></p></div>';
          m.addEventListener('click', function (ev) { if (ev.target === m || ev.target.closest('.gs-x')) closeViewer(); });
          closeViewer.back = b; document.body.appendChild(m); document.documentElement.classList.add('gs-lock'); document.addEventListener('keydown', onViewerKey, true);
          $('.gs-x', m).focus();
        });
        // the live Instagram photos come through the feed Kyleu connected (Behold); each opens the post on Instagram
        var grid = $('[data-ig-grid]', el);
        if (grid) fetch('https://feeds.behold.so/' + encodeURIComponent(igFeed)).then(function (r) { if (!r.ok) throw r; return r.json(); }).then(function (d) {
          var list = (Array.isArray(d) ? d : d.posts || []).slice(0, igN);
          grid.innerHTML = list.map(function (x) {
            var src = (x.sizes && x.sizes.medium && x.sizes.medium.mediaUrl) || (x.mediaType === 'VIDEO' ? x.thumbnailUrl : x.mediaUrl) || x.thumbnailUrl || '';
            return '<a class="ig-tile" href="' + esc(x.permalink || '#') + '" target="_blank" rel="noopener"><img src="' + esc(src) + '" alt="' + esc(String(x.caption || 'Instagram photo').slice(0, 100)) + '" loading="lazy">' + (x.mediaType === 'VIDEO' ? '<span class="ig-vid" aria-hidden="true">▶</span>' : '') + '</a>';
          }).join('') || '<p class="muted">No Instagram photos yet.</p>';
        }).catch(function () { grid.innerHTML = '<p class="muted">The Instagram photos could not load right now. <a data-setting-href="Instagram" href="' + esc(S.get('Instagram', '#')) + '" target="_blank" rel="noopener">See them on Instagram</a>.</p>'; });
        K.reveal(el);
      }).catch(function () {});
    });

    /* ---------- Our stands: photos and details of every stand, per area ---------- */
    var galleries = $$('[data-stand-gallery]');
    if (galleries.length) Promise.all([K.stands(), K.prices().catch(function () { return null; })]).then(function (res) {
      var stands = res[0], PR = res[1];
      var fromPrice = function (ss) { var v = PR ? PR.num(ss ? 'Self-sufficient' : 'Ablution stands', 'Weekday per person per night', ss ? 100 : 160) : (ss ? 100 : 160); return K.money(v); };
      galleries.forEach(function (box) {
        var area = box.dataset.standGallery;
        box.innerHTML = stands.filter(function (s) { return s.area === area; }).map(function (st) {
          var ph = st.photos.length ? st.photos : ['assets/img/photos/camp-panorama.jpg'];
          var ss = st.area === 'self-sufficient', label = (ss ? 'R' : '') + (st.name.replace(/[^0-9]/g, '') || '');
          return '<article class="stand-card gallery-card" data-reveal>' +
            '<div class="sc-media"><div class="sc-track">' + ph.map(function (p, i) { return '<img src="' + p + '" alt="' + K.esc(st.name) + ' photo ' + (i + 1) + '" loading="lazy">'; }).join('') + '</div>' +
            (ph.length > 1 ? '<button class="sc-nav prev" type="button" aria-label="Previous photo"><svg><use href="#i-arrow-l"/></svg></button><button class="sc-nav next" type="button" aria-label="Next photo"><svg><use href="#i-arrow"/></svg></button><div class="sc-dots">' + ph.map(function (_, i) { return '<i' + (i ? '' : ' class="on"') + '></i>'; }).join('') + '</div>' : '') +
            (ss ? '<span class="badge map-tag">' + label + ' on the map</span>' : '') + (st.status === 'new' ? '<span class="badge new" style="position:absolute;bottom:10px;left:10px">New stand</span>' : '') +
            (st.photos.length ? '<button class="sc-photo-count" type="button" data-all-photos aria-label="See all photos"><svg><use href="#i-camera"/></svg>' + st.photos.length + '</button>' : '') + '</div>' +
            '<div class="sc-body"><div class="sc-title"><h3>' + K.esc(st.name) + '</h3></div><div class="sc-feel">' + K.esc(st.feel) + '</div>' +
            '<div class="sc-meta"><span><svg><use href="#i-users"/></svg>Up to ' + st.guests + '</span><span><svg><use href="#i-tent"/></svg>' + K.esc(st.setups) + '</span><span><svg><use href="#' + (ss ? 'i-flame' : 'i-shower') + '"/></svg>' + (ss ? 'Fire boma &amp; grill' : 'Private ablution') + '</span></div>' +
            '<p class="gc-desc">' + K.esc(st.description) + '</p>' +
            (st.highlights.length ? '<ul class="gc-hl">' + st.highlights.slice(0, 4).map(function (h) { return '<li>' + K.esc(h) + '</li>'; }).join('') + '</ul>' : '') +
            '<div class="sc-foot"><span class="sc-price">from ' + fromPrice(ss) + '<small>per person per night</small></span><a class="btn btn-sm" href="stay.html#stand=' + st.id + '">Book this stand <svg><use href="#i-arrow"/></svg></a></div></div></article>';
        }).join('') || '<p class="muted">No stands in this area yet.</p>';
        $$('.gallery-card', box).forEach(function (card, idx) {
          var track = $('.sc-track', card), dots = $$('.sc-dots i', card), imgs = $$('.sc-track img', card);
          if (dots.length) {
            track.addEventListener('scroll', function () { var i = Math.round(track.scrollLeft / track.clientWidth); dots.forEach(function (d, j) { d.classList.toggle('on', i === j); }); }, { passive: true });
            $('.sc-nav.prev', card).addEventListener('click', function () { track.scrollBy({ left: -track.clientWidth, behavior: 'smooth' }); });
            $('.sc-nav.next', card).addEventListener('click', function () { track.scrollBy({ left: track.clientWidth, behavior: 'smooth' }); });
          }
          var open = function () { if (!K.lightbox) return; var i = Math.round(track.scrollLeft / Math.max(1, track.clientWidth)); K.lightbox(imgs.map(function (im) { return { src: im.getAttribute('src'), cap: $('h3', card).textContent }; }), i); };
          track.addEventListener('click', open);
          var all = $('[data-all-photos]', card); if (all) all.addEventListener('click', open);
        });
        K.reveal(box);
      });
      if (location.hash) { var t = document.getElementById(location.hash.slice(1)); if (t) setTimeout(function () { t.scrollIntoView({ behavior: 'smooth' }); }, 400); }
    }).catch(function () { galleries.forEach(function (b) { b.innerHTML = '<p class="muted">Stands load from content/stands.md. Open the site through a web server to see them.</p>'; }); });

    /* ---------- "A day at Kyleu" living camp map ---------- */
    $$('.daymap').forEach(function (wrap) {
      if (!K.campScene) return;
      K.stands().then(function (stands) { K.campScene(wrap, stands); }).catch(function () {});
    });

    /* ---------- Discover: sub-nav highlight ---------- */
    var subnav = $('.subnav');
    if (subnav) {
      var links = $$('a', subnav), secs = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); }).filter(Boolean);
      var so = new IntersectionObserver(function (es) {
        es.forEach(function (e) {
          if (!e.isIntersecting) return;
          links.forEach(function (a) {
            var on = a.getAttribute('href') === '#' + e.target.id; a.classList.toggle('on', on);
            if (on) { var inner = $('.subnav-inner'); inner.scrollTo({ left: a.offsetLeft - inner.clientWidth / 2 + a.clientWidth / 2, behavior: 'smooth' }); }
          });
        });
      }, { rootMargin: '-45% 0px -50% 0px' });
      secs.forEach(function (s) { so.observe(s); });
    }

    /* ---------- Discover: rates tables straight from prices.md ---------- */
    $$('[data-rates]').forEach(function (box) {
      K.prices().then(function (P) {
        var mode = box.getAttribute('data-rates');
        var html = P.sections.filter(function (s) {
          if (!s.items.length || /booking rules|holiday/i.test(s.title)) return false;
          if (mode === 'dinokeng') return /dinokeng/i.test(s.title);
          if (mode === 'camp') return !/dinokeng|shop|game drive/i.test(s.title);
          return true;
        }).map(function (s) {
          var dk = /dinokeng/i.test(s.title), wide = dk || /shop/i.test(s.title);
          return '<article class="rate-card ' + (dk ? 'dark' : (/self/i.test(s.title) ? 'green' : '')) + (wide ? ' rates-full' : '') + '" data-reveal>' +
            '<header><h3>' + K.esc(s.title) + '</h3>' + (dk ? '<p>Paid to Dinokeng Game Reserve at the gate or online, not part of your Kyleu booking.</p>' : '') + '</header>' +
            '<ul class="rate-list"' + (wide && mode !== 'dinokeng' ? ' style="columns:2;column-gap:40px"' : '') + '>' + s.items.map(function (it) {
              return '<li style="break-inside:avoid"><span class="lbl"><b>' + K.esc(it.name || it.label) + '</b>' + (it.note ? '<small>' + K.esc(it.note) + '</small>' : '') + '</span><span class="amt">' + (isNaN(it.amount) ? '' : (it.amount === 0 ? 'Free' : dk ? K.money(it.amount) : K.dual(it.amount, P))) + '</span></li>';
            }).join('') + '</ul></article>';
        }).join('');
        box.innerHTML = html; K.reveal(box);
      }).catch(function () {});
    });

    /* ---------- Discover: generated camp map ---------- */
    $$('[data-campmap]').forEach(function (host) {
      if (!K.campMap) return;
      Promise.all([K.stands(), K.prices()]).then(function (r) {
        var P = r[1];
        K.campMap(host, {
          stands: r[0],
          info: function (st) {
            var from = st.area === 'self-sufficient' ? P.num('Self-sufficient', 'Weekday per person per night', 100) : P.num('Ablution stands', 'Weekday per person per night', 160);
            return { free: null, price: 'from ' + K.dual(from, P, false), sub: 'per person / night' };
          },
          onOpen: function (st) { location.href = 'stay.html#stand=' + st.id; }
        });
      }).catch(function () { host.innerHTML = '<p class="muted" style="padding:20px">The camp map loads from content/stands.md. Open the site through a web server to see it.</p>'; });
    });

    /* ---------- News page ---------- */
    var newsList = $('[data-news]');
    if (newsList) {
      var art = $('[data-article]'), filt = $('.tag-filter'), listWrap = $('[data-news-wrap]');
      var dq = new URLSearchParams(location.search).get('dgr');
      (dq && K.dgrUpdates ? K.dgrUpdates().catch(function () { return []; }) : Promise.resolve([])).then(function (dgr) { return K.blog().then(function (posts) { return [posts, dgr]; }); }).then(function (rr) {
        var posts = rr[0], q = new URLSearchParams(location.search).get('post');
        var post = q && posts.filter(function (p) { return p.slug === q; })[0];
        // a story from the reserve, written in the admin: the same article page as camp news
        var dit = dq && rr[1].filter(function (it) { return (it.slug || it.id) === dq && it.article && !it.hidden; })[0];
        if (dit) { post = { title: dit.title, slug: dq, date: dit.date, image: dit.image, summary: (dit.text || '').split(/\n\s*\n/)[0], tags: [dit.type || 'Dinokeng news'], body: dit.article, html: true, dgr: dit }; }
        if (post) {
          listWrap.hidden = true; art.hidden = false;
          document.title = post.title + ' | Kyleu Bush Camp';
          $('[data-a-title]').textContent = post.title;
          $('[data-a-meta]').textContent = fmtDate(post.date) + (post.tags.length ? ' · ' + post.tags.join(', ') : '');
          if (post.dgr) { var cl = $('.crumbs a[href="news.html"]'); if (cl) { cl.textContent = 'Dinokeng'; cl.href = 'dinokeng.html#reserve-news'; } var back = art.querySelector('.link-arrow[href="news.html"]'); if (back) { back.textContent = 'All news from the reserve'; back.href = 'dinokeng.html#reserve-news'; } }
          var crumb = $('[data-a-crumb]'); if (crumb) { crumb.textContent = post.title; var sep = $('[data-a-crumb-sep]'); if (sep) sep.hidden = false; }
          $('[data-a-lead]').textContent = post.summary;
          var cov = art.querySelector('.cover'); cov.innerHTML = post.image ? '<img src="' + post.image + '" alt="">' : ''; cov.hidden = !post.image;   // no photo: no empty frame
          var prose = art.querySelector('.prose, .ky-article');
          // written with the admin's writing tool: cleaned first, then its photos are fetched
          if (post.html && K.articleClean) { prose.className = 'ky-article'; prose.innerHTML = K.articleClean(post.body); if (K.articleShow) K.articleShow(prose); }
          else prose.innerHTML = post.html ? post.body : K.markdown(post.body);
          if (post.dgr) { var acts = []; if (post.dgr.link) acts.push('<a class="btn btn-sm" href="' + K.esc(post.dgr.link) + '" target="_blank" rel="noopener">' + K.esc(post.dgr.button || 'Open the link') + '</a>'); if (post.dgr.file) acts.push('<a class="btn btn-sm btn-ghost" href="' + K.esc(post.dgr.file) + '" target="_blank" rel="noopener">Open the PDF' + (post.dgr.size ? ' (' + K.esc(post.dgr.size) + ')' : '') + '</a>'); if (acts.length) prose.insertAdjacentHTML('beforeend', '<p class="dgr-article-acts">' + acts.join(' ') + '</p>'); prose.insertAdjacentHTML('beforeend', '<p class="dgr-credit">News from Dinokeng Game Reserve, shared by Kyleu, a proud DGR CP member.</p>'); }
          var more = posts.filter(function (p) { return p !== post; }).slice(0, 3);
          $('[data-more]').innerHTML = more.map(function (p) { return postCard(p); }).join('');
          K.reveal(art);
          // structured data for this article
          var ld = document.createElement('script'); ld.type = 'application/ld+json';
          ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, datePublished: post.date, description: post.summary, image: post.image ? 'https://www.kyleu.co.za/' + post.image : undefined, author: { '@type': 'Organization', name: 'Kyleu Bush Camp' }, publisher: { '@id': 'https://www.kyleu.co.za/#camp' } });
          document.head.appendChild(ld);
          return;
        }
        // filter buttons: only each post's main tag, so a handful of posts never gets a wall of buttons
        var tags = []; posts.forEach(function (p) { var t = p.tags[0]; if (t && tags.indexOf(t) < 0) tags.push(t); });
        if (posts.length < 4) tags = [];
        filt.innerHTML = '<button class="pill on" data-tag="">All posts</button>' + tags.map(function (t) { return '<button class="pill" data-tag="' + K.esc(t) + '">' + K.esc(t) + '</button>'; }).join('');
        filt.hidden = !tags.length;
        var secs = $('[data-news-sections]');
        var ageDays = function (p) { var d = new Date(p.date + 'T12:00:00'); return isNaN(d) ? 999 : Math.floor((Date.now() - d.getTime()) / 864e5); };
        var render = function (tag) {
          if (tag) {   // one tag picked: a simple list of its posts
            var list = posts.filter(function (p) { return p.tags.indexOf(tag) >= 0; });
            secs.hidden = true; newsList.hidden = false;
            newsList.innerHTML = list.map(function (p) { return postCard(p); }).join('') || '<div class="empty">No posts with this tag yet.</div>';
            K.reveal(newsList); return;
          }
          secs.hidden = false; newsList.hidden = true;
          // this week, the past few weeks (up to six), then everything older folded away
          var fresh = posts.filter(function (p) { return ageDays(p) <= 7; }), recent = posts.filter(function (p) { var a = ageDays(p); return a > 7 && a <= 42; }), older = posts.filter(function (p) { return ageDays(p) > 42; });
          if (!fresh.length && !recent.length && older.length) { recent = older.slice(0, 3); older = older.slice(3); }   // a long quiet spell: still show the last few
          $('[data-news-new]').innerHTML = fresh.map(function (p, i) { return postCard(p, i === 0); }).join('');
          $('[data-news-new]').hidden = !fresh.length; $('[data-news-quiet]').hidden = !!fresh.length;
          // a quiet week: skip the "this week" box when there is other news to show
          var wk = $('[data-news-new]').closest('.news-block'); if (wk) wk.hidden = !fresh.length && !!(recent.length || older.length);
          $('[data-news-recent-wrap]').hidden = !recent.length; $('[data-news-recent]').innerHTML = recent.map(function (p) { return postCard(p); }).join('');
          var ow = $('[data-news-older-wrap]'); ow.hidden = !older.length; $('[data-news-older]').innerHTML = older.map(function (p) { return postCard(p); }).join('');
          $('[data-news-older-count]').textContent = older.length + ' post' + (older.length === 1 ? '' : 's');
          K.reveal(secs);
        };
        var ow0 = $('[data-news-older-wrap]'); if (ow0) ow0.addEventListener('toggle', function () { if (ow0.open) K.reveal(ow0); });
        $$('.pill', filt).forEach(function (b) { b.addEventListener('click', function () { $$('.pill', filt).forEach(function (x) { x.classList.toggle('on', x === b); }); render(b.dataset.tag); }); });
        render('');
      }).catch(function () { var s0 = $('[data-news-sections]'); if (s0) s0.hidden = true; newsList.hidden = false; newsList.innerHTML = '<div class="empty">Posts couldn\'t load. Open the site through a web server (see README).</div>'; });
    }

    /* ---------- Contact: map tabs + form ---------- */
    // "Our map" is the drawn route map; Google Maps and Satellite load Google's map only when picked
    $$('.map-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.map-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); x.setAttribute('aria-selected', x === b ? 'true' : 'false'); });
        var fr = $('.map-wrap iframe'), fm = $('[data-fmap]'), live = !!b.dataset.src;
        if (live && fr.getAttribute('src') !== b.dataset.src) fr.src = b.dataset.src;
        fr.hidden = !live; if (fm) fm.hidden = live;
        b.closest('.map-wrap').classList.toggle('is-live', live);
      });
    });
    // no moving car for people who prefer less motion
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) $$('.fm-car animateMotion').forEach(function (a) { a.parentNode.style.display = 'none'; a.remove(); });
    $$('form[data-demo-form]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var ok = true;
        $$('[required]', f).forEach(function (inp) { var bad = !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value)); inp.closest('.field').classList.toggle('err', bad); if (bad) ok = false; });
        if (!ok) { K.toast('Please fill in the highlighted fields'); return; }
        f.innerHTML = '<div class="success"><div class="success-badge"><svg class="ring" viewBox="0 0 110 110" fill="none" stroke="#3f7d3a" stroke-width="6" stroke-linecap="round"><circle cx="55" cy="55" r="50"/><path d="M34 57l14 14 28-30"/></svg></div><h3>Message sent. Thank you!</h3><p class="muted">We\'ll get back to you within a day. For anything urgent, WhatsApp us on 060 458 4478.</p><p class="muted" style="font-size:.8rem">(Demo: nothing was actually sent.)</p></div>';
      });
    });

    /* ---------- Policies nav highlight ---------- */
    var ln = $('.legal-nav');
    if (ln) {
      var la = $$('a', ln);
      var lo = new IntersectionObserver(function (es) { es.forEach(function (e) { if (e.isIntersecting) la.forEach(function (a) { a.classList.toggle('on', a.getAttribute('href') === '#' + e.target.id); }); }); }, { rootMargin: '-30% 0px -60% 0px' });
      la.forEach(function (a) { var s = document.getElementById(a.getAttribute('href').slice(1)); if (s) lo.observe(s); });
    }
  });
})();
