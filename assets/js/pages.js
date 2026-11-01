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

    /* ---------- guest stories (content/settings.md, "Guest stories") ---------- */
    $$('[data-guest-stories]').forEach(function (el) {
      K.settings().then(function (S) {
        var items = (S.list ? S.list('Guest stories') : []).filter(function (it) { return /^https?:/.test(it.value); });
        el.innerHTML = items.map(function (it) {
          var parts = it.value.split(' · '), url = parts[0].trim(), who = (parts[1] || '').trim(), host = url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];
          var kind = /instagram/i.test(host) ? 'ig' : /facebook|fb\./i.test(host) ? 'fb' : /youtu/i.test(host) ? 'yt' : 'blog';
          return '<a class="story" href="' + K.esc(url) + '" target="_blank" rel="noopener" data-reveal><span class="story-ic ' + kind + '"><svg><use href="#' + (kind === 'ig' ? 'i-ig' : kind === 'fb' ? 'i-fb' : 'i-news') + '"/></svg></span><span><b>' + K.esc(it.label) + '</b><small>' + K.esc(who || host) + '</small></span><span class="link-arrow">Read</span></a>';
        }).join('') || '<p class="muted">Guest stories will appear here.</p>';
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
        var render = function (tag) {
          var list = posts.filter(function (p) { return !tag || p.tags.indexOf(tag) >= 0; });
          newsList.innerHTML = list.map(function (p, i) { return postCard(p, i === 0 && !tag); }).join('') || '<div class="empty">No posts yet.</div>';
          K.reveal(newsList);
        };
        $$('.pill', filt).forEach(function (b) { b.addEventListener('click', function () { $$('.pill', filt).forEach(function (x) { x.classList.toggle('on', x === b); }); render(b.dataset.tag); }); });
        render('');
      }).catch(function () { newsList.innerHTML = '<div class="empty">Posts couldn\'t load. Open the site through a web server (see README).</div>'; });
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
