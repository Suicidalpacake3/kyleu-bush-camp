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
    return '<a class="post-card' + (feature ? ' post-feature' : '') + '" href="news.html?post=' + p.slug + '" data-reveal>' +
      '<div class="img">' + (p.image ? '<img src="' + p.image + '" alt="" loading="lazy">' : '') + '</div>' +
      '<div class="body"><div class="post-meta"><span>' + fmtDate(p.date) + '</span>' + (p.tags[0] ? '<span>· ' + K.esc(p.tags[0]) + '</span>' : '') + '</div>' +
      '<h3>' + K.esc(p.title) + '</h3><p>' + K.esc(p.summary) + '</p><span class="link-arrow">Read more</span></div></a>';
  }

  document.addEventListener('DOMContentLoaded', function () {

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
        if (it.link) b.push('<a class="btn' + (big ? '' : ' btn-sm') + '" href="' + esc(it.link) + '" target="_blank" rel="noopener">' + esc(it.button || 'Open') + ' <svg><use href="#i-arrow"/></svg></a>');
        if (it.file) b.push('<a class="btn' + (it.link ? ' btn-ghost' : '') + (big ? '' : ' btn-sm') + '" href="' + esc(it.file) + '" target="_blank" rel="noopener"><svg><use href="#i-doc"/></svg>' + (it.link ? 'Poster (PDF)' : isMap(it) ? 'Open the map' : 'Read it') + (it.size ? ' <small>' + esc(it.size) + '</small>' : '') + '</a>');
        if (it.file && big) b.push('<a class="dgr-dl" href="' + esc(it.file) + '" download>Download</a>');
        return b.join('');
      };
      var openUrl = function (it) { return it.link || it.file || '#'; };
      var cover = function (it, cls) { return it.image ? '<a class="' + cls + '" href="' + esc(openUrl(it)) + '" target="_blank" rel="noopener" tabindex="-1" aria-hidden="true"><img src="' + esc(it.image) + '" alt="" loading="lazy"></a>' : '<span class="' + cls + ' none"><svg><use href="#i-news"/></svg></span>'; };
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
        var posts = so.posts ? so.posts.filter(function (x) { return x.show; }) : (S.list ? S.list('Guest stories') : []).filter(function (it) { return /^https?:/.test(it.value); }).map(function (it) { var pp = it.value.split(' · '); return { url: pp[0].trim(), title: it.label, by: (pp[1] || '').trim() }; });
        var igFeed = so.posts ? so.igFeed : S.get('Instagram feed ID', ''), igN = +(so.igCount || S.get('Instagram photos', 6)) || 6;
        var fbUrl = S.get('Facebook', ''), fbOn = so.posts ? so.fbFeed !== false : !/^off|no/i.test(S.get('Facebook feed', 'on'));
        var post = function (x) {
          var u = x.url, ig = u.match(/instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/([\w-]+)/i), host = u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
          if (ig) return '<figure class="soc-embed ig" data-reveal><iframe src="https://www.instagram.com/' + ig[1] + '/' + ig[2] + '/embed/captioned/" title="' + esc(x.title || 'Instagram post') + '" loading="lazy" allowtransparency="true" scrolling="no"></iframe><figcaption>' + esc(x.title) + (x.by ? ' · ' + esc(x.by) : '') + '</figcaption></figure>';
          if (/facebook\.com\/.+\/(posts|videos|photos)|facebook\.com\/(permalink|photo|watch)|fb\.watch/i.test(u)) return '<figure class="soc-embed fb" data-reveal><iframe src="https://www.facebook.com/plugins/post.php?href=' + encodeURIComponent(u) + '&show_text=true&width=500" title="' + esc(x.title || 'Facebook post') + '" loading="lazy" scrolling="no" allow="encrypted-media"></iframe><figcaption>' + esc(x.title) + (x.by ? ' · ' + esc(x.by) : '') + '</figcaption></figure>';
          var kind = /instagram/i.test(host) ? 'ig' : /facebook|fb\./i.test(host) ? 'fb' : /youtu/i.test(host) ? 'yt' : 'blog';
          return '<a class="gstory" href="' + esc(u) + '" target="_blank" rel="noopener" data-reveal><span class="story-ic ' + kind + '"><svg><use href="#' + (kind === 'ig' ? 'i-ig' : kind === 'fb' ? 'i-fb' : 'i-news') + '"/></svg></span><span><b>' + esc(x.title) + '</b><small>' + esc(x.by || host) + '</small></span><span class="link-arrow">Read</span></a>';
        };
        var live = (igFeed ? '<div class="soc-live-ig"><h3><svg><use href="#i-ig"/></svg>Latest on Instagram</h3><div class="ig-grid" data-ig-grid><p class="muted">Loading photos…</p></div></div>' : '') +
          (fbOn && fbUrl ? '<div class="soc-live-fb"><h3><svg><use href="#i-fb"/></svg>Latest on Facebook</h3><div class="fb-feed"><iframe src="https://www.facebook.com/plugins/page.php?href=' + encodeURIComponent(fbUrl) + '&tabs=timeline&width=500&height=620&small_header=true&adapt_container_width=true&hide_cover=false&show_facepile=false" title="Kyleu Bush Camp on Facebook" loading="lazy" scrolling="no" allow="encrypted-media"></iframe></div></div>' : '');
        var embeds = posts.filter(function (x) { return /instagram\.com\/(?:[\w.]+\/)?(p|reel|tv)\/|facebook\.com\/.+\/(posts|videos|photos)|facebook\.com\/(permalink|photo|watch)|fb\.watch/i.test(x.url); }), links = posts.filter(function (x) { return embeds.indexOf(x) < 0; });
        el.innerHTML = (live ? '<div class="soc-live' + (igFeed && fbOn && fbUrl ? ' two' : '') + '">' + live + '</div>' : '') +
          (embeds.length ? '<div class="soc-embeds">' + embeds.map(post).join('') + '</div>' : '') +
          (links.length ? '<div class="stories">' + links.map(post).join('') + '</div>' : '') ||
          '<p class="muted">Guest stories will appear here.</p>';
        el.classList.remove('stories');
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
    if (galleries.length) K.stands().then(function (stands) {
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
            '<div class="sc-meta"><span><svg><use href="#i-users"/></svg>Up to ' + st.guests + '</span><span><svg><use href="#i-tent"/></svg>' + K.esc(st.setups) + '</span><span><svg><use href="#' + (ss ? 'i-flame' : 'i-shower') + '"/></svg>' + (ss ? 'Braai &amp; boma' : 'Private ablution') + '</span></div>' +
            '<p class="gc-desc">' + K.esc(st.description) + '</p>' +
            (st.highlights.length ? '<ul class="gc-hl">' + st.highlights.slice(0, 4).map(function (h) { return '<li>' + K.esc(h) + '</li>'; }).join('') + '</ul>' : '') +
            '<div class="sc-foot"><a class="btn btn-sm" href="stay.html#stand=' + st.id + '">Book this stand <svg><use href="#i-arrow"/></svg></a></div></div></article>';
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
              return '<li style="break-inside:avoid"><span class="lbl"><b>' + K.esc(it.label) + '</b>' + (it.note ? '<small>' + K.esc(it.note) + '</small>' : '') + '</span><span class="amt">' + (isNaN(it.amount) ? '' : (it.amount === 0 ? 'FREE' : dk ? K.money(it.amount) : K.dual(it.amount, P))) + '</span></li>';
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
      K.blog().then(function (posts) {
        var q = new URLSearchParams(location.search).get('post');
        var post = q && posts.filter(function (p) { return p.slug === q; })[0];
        if (post) {
          listWrap.hidden = true; art.hidden = false;
          document.title = post.title + ' | Kyleu Bush Camp';
          $('[data-a-title]').textContent = post.title;
          $('[data-a-meta]').textContent = fmtDate(post.date) + (post.tags.length ? ' · ' + post.tags.join(', ') : '');
          var crumb = $('[data-a-crumb]'); if (crumb) { crumb.textContent = post.title; var sep = $('[data-a-crumb-sep]'); if (sep) sep.hidden = false; }
          $('[data-a-lead]').textContent = post.summary;
          art.querySelector('.cover').innerHTML = post.image ? '<img src="' + post.image + '" alt="">' : '';
          art.querySelector('.prose').innerHTML = post.html ? post.body : K.markdown(post.body);
          var more = posts.filter(function (p) { return p !== post; }).slice(0, 3);
          $('[data-more]').innerHTML = more.map(function (p) { return postCard(p); }).join('');
          K.reveal(art);
          // structured data for this article
          var ld = document.createElement('script'); ld.type = 'application/ld+json';
          ld.textContent = JSON.stringify({ '@context': 'https://schema.org', '@type': 'BlogPosting', headline: post.title, datePublished: post.date, description: post.summary, image: post.image ? 'https://www.kyleu.co.za/' + post.image : undefined, author: { '@type': 'Organization', name: 'Kyleu Bush Camp' }, publisher: { '@id': 'https://www.kyleu.co.za/#camp' } });
          document.head.appendChild(ld);
          return;
        }
        var tags = []; posts.forEach(function (p) { p.tags.forEach(function (t) { if (tags.indexOf(t) < 0) tags.push(t); }); });
        filt.innerHTML = '<button class="pill on" data-tag="">All posts</button>' + tags.map(function (t) { return '<button class="pill" data-tag="' + K.esc(t) + '">' + K.esc(t) + '</button>'; }).join('');
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
    $$('.map-tabs button').forEach(function (b) {
      b.addEventListener('click', function () {
        $$('.map-tabs button').forEach(function (x) { x.classList.toggle('on', x === b); });
        $('.map-wrap iframe').src = b.dataset.src;
      });
    });
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
