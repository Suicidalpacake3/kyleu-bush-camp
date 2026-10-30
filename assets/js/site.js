/* =========================================================
   Kyleu Bush Camp, site interactions
   ========================================================= */
(function () {
  'use strict';
  var $ = function (s, r) { return (r || document).querySelector(s); };
  var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var K = window.Kyleu = window.Kyleu || {};

  /* ---------- loader (shows once per visit) ---------- */
  var loader = $('.loader');
  function hideLoader() { if (loader) loader.classList.add('done'); document.documentElement.classList.add('ready'); }
  if (loader) {
    var seen = false; try { seen = sessionStorage.getItem('ky-loaded') === '1'; } catch (e) {}
    if (seen) { loader.remove(); loader = null; document.documentElement.classList.add('ready'); }
    else {
      var minTime = new Promise(function (r) { setTimeout(r, 1300); });
      var loaded = new Promise(function (r) { if (document.readyState === 'complete') r(); else window.addEventListener('load', r); });
      Promise.race([Promise.all([minTime, loaded]), new Promise(function (r) { setTimeout(r, 4000); })]).then(function () {
        hideLoader(); try { sessionStorage.setItem('ky-loaded', '1'); } catch (e) {}
        setTimeout(function () { if (loader) loader.remove(); }, 900);
      });
    }
  } else document.documentElement.classList.add('ready');

  document.addEventListener('DOMContentLoaded', function () {
    /* ---------- header ---------- */
    // Swipe-away header: hides after you scroll DOWN a clear distance, comes back after
    // you scroll UP a clear distance (or near the top). Small or slow scroll movements
    // never flip it, so it can't flicker. Sticky bars (dates, Discover tabs) follow it
    // via the body class, using transforms so the page never jumps.
    var header = $('.site-header');
    var lastY = window.scrollY, travel = 0, hidden = false, ticking = false;
    var HIDE_AFTER = 48, SHOW_AFTER = 36;
    function setHidden(h) {
      if (h === hidden) return;
      hidden = h;
      if (header) header.classList.toggle('hide', h);
      document.body.classList.toggle('header-hidden', h);
    }
    function onScroll() {
      ticking = false;
      var y = Math.max(0, window.scrollY), dy = y - lastY; lastY = y;
      if (header) header.classList.toggle('solid', y > 40);
      var mc = $('.mobile-cta'); if (mc) mc.classList.toggle('show', y > 520);
      if (document.body.classList.contains('lock')) { travel = 0; return; }     // menu / popup open: leave it alone
      if (y < 120) { travel = 0; setHidden(false); return; }
      if (dy === 0) return;
      if ((dy > 0) !== (travel > 0)) travel = 0;                                 // direction changed: start counting again
      travel += dy;
      if (travel > HIDE_AFTER) setHidden(true);
      else if (travel < -SHOW_AFTER) setHidden(false);
    }
    window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(onScroll); } }, { passive: true });
    onScroll();

    /* desktop dropdown */
    $$('.nav-drop').forEach(function (d) {
      var btn = $('button', d); var t;
      btn.addEventListener('click', function (e) { e.stopPropagation(); d.classList.toggle('open'); btn.setAttribute('aria-expanded', d.classList.contains('open')); });
      d.addEventListener('mouseenter', function () { clearTimeout(t); d.classList.add('open'); });
      d.addEventListener('mouseleave', function () { t = setTimeout(function () { d.classList.remove('open'); }, 180); });
    });
    document.addEventListener('click', function () { $$('.nav-drop.open').forEach(function (d) { d.classList.remove('open'); }); });

    /* mobile menu */
    var mm = $('.mobile-menu');
    function openMM(o) { if (!mm) return; mm.classList.toggle('open', o); document.body.classList.toggle('lock', o); mm.setAttribute('aria-hidden', !o); }
    $$('.burger').forEach(function (b) { b.addEventListener('click', function () { openMM(true); }); });
    $$('.mm-close').forEach(function (b) { b.addEventListener('click', function () { openMM(false); }); });
    if (mm) $$('a', mm).forEach(function (a) { a.addEventListener('click', function () { openMM(false); }); });
    $$('.mm-acc > button').forEach(function (b) { b.addEventListener('click', function () { var p = b.parentElement; p.classList.toggle('open'); b.setAttribute('aria-expanded', p.classList.contains('open')); }); });
    document.addEventListener('keydown', function (e) { if (e.key === 'Escape') { openMM(false); } });

    /* ---------- split headline words ---------- */
    $$('.split-words').forEach(function (el) {
      var i = 0;
      (function walk(node) {
        Array.prototype.slice.call(node.childNodes).forEach(function (n) {
          if (n.nodeType === 3) {
            var frag = document.createDocumentFragment();
            n.textContent.split(/(\s+)/).forEach(function (w) {
              if (!w) return;
              if (/^\s+$/.test(w)) { frag.appendChild(document.createTextNode(w)); return; }
              var o = document.createElement('span'); o.className = 'w';
              var s = document.createElement('span'); s.textContent = w; s.style.setProperty('--i', i++);
              o.appendChild(s); frag.appendChild(o);
            });
            n.parentNode.replaceChild(frag, n);
          } else if (n.nodeType === 1) walk(n);
        });
      })(el);
    });

    /* ---------- reveal on scroll ---------- */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } });
    }, { threshold: 0.14, rootMargin: '0px 0px -40px 0px' });
    K.reveal = function (root) { $$('[data-reveal]:not(.in), .split-words:not(.in), .draw-line:not(.in)', root).forEach(function (el) { io.observe(el); }); };
    K.reveal();
    $$('[data-stagger]').forEach(function (p) { $$('[data-reveal]', p).forEach(function (c, i) { c.style.setProperty('--d', (i * 0.09) + 's'); }); });
    // fail-safe
    setTimeout(function () { $$('[data-reveal]:not(.in)').forEach(function (el) { var r = el.getBoundingClientRect(); if (r.top < innerHeight) el.classList.add('in'); }); }, 2600);

    /* ---------- counters ---------- */
    var co = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return; co.unobserve(e.target);
        var el = e.target, to = parseFloat(el.dataset.count), dec = (el.dataset.count.split('.')[1] || '').length, t0 = performance.now(), dur = 1600;
        (function tick(t) {
          var p = Math.min(1, (t - t0) / dur), v = to * (1 - Math.pow(1 - p, 3));
          el.textContent = dec ? v.toFixed(dec) : Math.round(v).toLocaleString('en-ZA').replace(/,/g, ' ');
          if (p < 1) requestAnimationFrame(tick);
        })(t0);
      });
    }, { threshold: 0.5 });
    $$('[data-count]').forEach(function (el) { co.observe(el); });

    /* ---------- parallax ---------- */
    var px = $$('[data-parallax]');
    if (px.length && !reduce) {
      var ticking = false;
      var run = function () {
        px.forEach(function (el) {
          var r = el.parentElement.getBoundingClientRect();
          if (r.bottom < -200 || r.top > innerHeight + 200) return;
          var speed = parseFloat(el.dataset.parallax) || 0.2;
          el.style.transform = 'translate3d(0,' + ((r.top + r.height / 2 - innerHeight / 2) * -speed).toFixed(1) + 'px,0)';
        });
        ticking = false;
      };
      window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(run); } }, { passive: true });
      run();
    }

    /* ---------- hero slideshow ---------- */
    var slides = $$('.hero-slide');
    if (slides.length) {
      // pick the phone or desktop version of each header photo
      var small = window.matchMedia('(max-width: 700px)').matches;
      slides.forEach(function (sl) { var u = (small && sl.dataset.bgM) || sl.dataset.bg; if (u) sl.style.backgroundImage = "url('" + u + "')"; });
      var dots = $('.hero-dots'), cap = $('.hero-caption'), cur = 0, timer;
      slides.forEach(function (s, i) {
        if (!dots) return;
        var b = document.createElement('button'); b.setAttribute('aria-label', 'Show photo ' + (i + 1));
        b.addEventListener('click', function () { go(i); });
        dots.appendChild(b);
      });
      var go = function (i) {
        slides[cur].classList.remove('on'); cur = (i + slides.length) % slides.length;
        void slides[cur].offsetWidth; slides[cur].classList.add('on');
        if (dots) $$('button', dots).forEach(function (b, j) { b.classList.toggle('on', j === cur); });
        if (cap) { cap.style.opacity = 0; setTimeout(function () { cap.textContent = slides[cur].dataset.caption || ''; cap.style.opacity = 1; }, 400); }
        clearTimeout(timer); timer = setTimeout(function () { go(cur + 1); }, 7000);
      };
      go(0);
    }

    /* ---------- quick-book form → stay page ---------- */
    $$('form.quickbook').forEach(function (f) {
      var ci = $('[name=in]', f), co2 = $('[name=out]', f);
      var today = new Date(); var iso = function (d) { return d.toISOString().slice(0, 10); };
      if (ci && !ci.value) { var fri = new Date(today); fri.setDate(today.getDate() + ((5 - today.getDay() + 7) % 7 || 7)); ci.value = iso(fri); var sun = new Date(fri); sun.setDate(fri.getDate() + 2); co2.value = iso(sun); }
      if (ci) { ci.min = iso(today); ci.addEventListener('change', function () { var d = new Date(ci.value); d.setDate(d.getDate() + 1); co2.min = iso(d); if (co2.value <= ci.value) co2.value = iso(d); }); }
    });

    /* ---------- rails (wildlife) ---------- */
    $$('[data-rail]').forEach(function (wrap) {
      var rail = $('.rail', wrap);
      $$('[data-rail-dir]', wrap).forEach(function (b) {
        b.addEventListener('click', function () { rail.scrollBy({ left: (rail.clientWidth * 0.8) * parseInt(b.dataset.railDir, 10), behavior: 'smooth' }); });
      });
    });
    // "I've spotted it" Big-5 checklist (remembered in this browser only)
    var spotted = {}; try { spotted = JSON.parse(localStorage.getItem('ky-spotted') || '{}'); } catch (e) {}
    function spotCount() { var n = Object.keys(spotted).filter(function (k) { return spotted[k]; }).length; $$('[data-spot-count]').forEach(function (el) { el.textContent = n; }); }
    $$('.spotted').forEach(function (b) {
      var k = b.dataset.animal; b.classList.toggle('on', !!spotted[k]); b.setAttribute('aria-pressed', !!spotted[k]);
      b.addEventListener('click', function () {
        spotted[k] = !spotted[k]; b.classList.toggle('on', spotted[k]); b.setAttribute('aria-pressed', spotted[k]);
        try { localStorage.setItem('ky-spotted', JSON.stringify(spotted)); } catch (e) {}
        spotCount(); if (spotted[k]) K.toast('Nice! ' + b.dataset.label + ' added to your sightings list 🐾');
      });
    });
    spotCount();

    /* ---------- lightbox ---------- */
    K.lightbox = (function () {
      var lb = document.createElement('div'); lb.className = 'lightbox'; lb.setAttribute('role', 'dialog'); lb.setAttribute('aria-modal', 'true');
      lb.innerHTML = '<button class="lb-close" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M6 6l12 12M18 6L6 18"/></svg></button><button class="lb-prev" aria-label="Previous"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M15 6l-6 6 6 6"/></svg></button><img alt=""><button class="lb-next" aria-label="Next"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M9 6l6 6-6 6"/></svg></button><div class="lb-cap"></div>';
      document.body.appendChild(lb);
      var items = [], i = 0, img = $('img', lb), cap = $('.lb-cap', lb);
      function show() { img.src = items[i].src; img.alt = items[i].cap || ''; cap.textContent = items[i].cap ? items[i].cap + '  ·  ' + (i + 1) + ' / ' + items.length : (i + 1) + ' / ' + items.length; }
      function open(list, start) { items = list; i = start || 0; show(); lb.classList.add('open'); document.body.classList.add('lock'); }
      function close() { lb.classList.remove('open'); if (!$('.sheet.open, .modal.open, .mobile-menu.open')) document.body.classList.remove('lock'); }
      $('.lb-close', lb).onclick = close;
      $('.lb-prev', lb).onclick = function () { i = (i - 1 + items.length) % items.length; show(); };
      $('.lb-next', lb).onclick = function () { i = (i + 1) % items.length; show(); };
      lb.addEventListener('click', function (e) { if (e.target === lb) close(); });
      document.addEventListener('keydown', function (e) { if (!lb.classList.contains('open')) return; if (e.key === 'Escape') close(); if (e.key === 'ArrowLeft') $('.lb-prev', lb).click(); if (e.key === 'ArrowRight') $('.lb-next', lb).click(); });
      var sx = 0; lb.addEventListener('touchstart', function (e) { sx = e.touches[0].clientX; }, { passive: true });
      lb.addEventListener('touchend', function (e) { var dx = e.changedTouches[0].clientX - sx; if (Math.abs(dx) > 50) (dx > 0 ? $('.lb-prev', lb) : $('.lb-next', lb)).click(); });
      return open;
    })();
    $$('[data-gallery]').forEach(function (g) {
      var links = $$('a[href]', g);
      links.forEach(function (a, idx) {
        a.addEventListener('click', function (e) { e.preventDefault(); K.lightbox(links.map(function (l) { return { src: l.getAttribute('href'), cap: l.dataset.cap || '' }; }), idx); });
      });
    });

    /* ---------- live sunrise / sunset at Kyleu ---------- */
    var sunEls = $$('[data-sun]');
    if (sunEls.length) {
      var s = sunTimes(new Date(), -25.3717, 28.3578);
      var fmt = function (d) { return d.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' }); };
      var now = new Date();
      var nowSA = now.toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Africa/Johannesburg' });
      sunEls.forEach(function (el) {
        var k = el.dataset.sun;
        if (k === 'rise') el.textContent = fmt(s.rise);
        if (k === 'set') el.textContent = fmt(s.set);
        if (k === 'now') el.textContent = nowSA;
        if (k === 'phase') el.textContent = now < s.rise ? 'Before sunrise: listen for the dawn chorus' : now < new Date(s.set.getTime() - 3600e3) ? 'Daytime in the bush' : now < s.set ? 'Golden hour: light the braai!' : 'Night time: stars and lion calls';
      });
    }

    /* ---------- campfire embers ---------- */
    $$('canvas[data-embers]').forEach(function (c) {
      if (reduce) return;
      var ctx = c.getContext('2d'), parts = [], w, h, dpr = Math.min(2, window.devicePixelRatio || 1), running = false;
      function size() { w = c.clientWidth; h = c.clientHeight; c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0); }
      size(); window.addEventListener('resize', size);
      function spawn() { return { x: w / 2 + (Math.random() - .5) * Math.min(420, w * .5), y: h + 10, vx: (Math.random() - .5) * .5, vy: -(0.6 + Math.random() * 1.6), r: .8 + Math.random() * 2.2, life: 0, max: 200 + Math.random() * 260, hue: 22 + Math.random() * 22 }; }
      for (var n = 0; n < 70; n++) { var p = spawn(); p.y = Math.random() * h; p.life = Math.random() * p.max; parts.push(p); }
      function frame() {
        if (!running) return;
        ctx.clearRect(0, 0, w, h);
        parts.forEach(function (p, i) {
          p.life++; p.x += p.vx + Math.sin((p.life + i) / 30) * .35; p.y += p.vy;
          var a = Math.max(0, 1 - p.life / p.max);
          ctx.beginPath(); ctx.fillStyle = 'hsla(' + p.hue + ',95%,60%,' + a + ')'; ctx.shadowBlur = 12; ctx.shadowColor = 'hsla(' + p.hue + ',100%,55%,' + a + ')';
          ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2); ctx.fill();
          if (p.life > p.max || p.y < -20) parts[i] = spawn();
        });
        requestAnimationFrame(frame);
      }
      new IntersectionObserver(function (es) { es.forEach(function (e) { var was = running; running = e.isIntersecting; if (running && !was) requestAnimationFrame(frame); }); }).observe(c);
    });

    /* ---------- year ---------- */
    $$('[data-year]').forEach(function (el) { el.textContent = new Date().getFullYear(); });
  });

  /* ---------- toast ---------- */
  K.toast = function (msg) {
    var t = document.querySelector('.toast'); if (!t) { t = document.createElement('div'); t.className = 'toast'; t.setAttribute('role', 'status'); document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show'); clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('show'); }, 3200);
  };

  /* ---------- NOAA sunrise/sunset ---------- */
  function sunTimes(date, lat, lng) {
    var rad = Math.PI / 180, J1970 = 2440588, J2000 = 2451545, day = 86400000;
    var toJ = function (d) { return d.valueOf() / day - 0.5 + J1970; }, fromJ = function (j) { return new Date((j + 0.5 - J1970) * day); };
    var d = toJ(date) - J2000, e = rad * 23.4397, lw = rad * -lng, phi = rad * lat;
    var n = Math.round(d - 0.0009 - lw / (2 * Math.PI));
    var ds = 0.0009 + lw / (2 * Math.PI) + n;
    var M = rad * (357.5291 + 0.98560028 * ds);
    var C = rad * (1.9148 * Math.sin(M) + 0.02 * Math.sin(2 * M) + 0.0003 * Math.sin(3 * M));
    var L = M + C + rad * 102.9372 + Math.PI;
    var dec = Math.asin(Math.sin(e) * Math.sin(L));
    var Jnoon = J2000 + ds + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    var w = Math.acos((Math.sin(-0.833 * rad) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec)));
    var a = 0.0009 + (w + lw) / (2 * Math.PI) + n;
    var Jset = J2000 + a + 0.0053 * Math.sin(M) - 0.0069 * Math.sin(2 * L);
    var Jrise = Jnoon - (Jset - Jnoon);
    return { rise: fromJ(Jrise), set: fromJ(Jset) };
  }
  K.sunTimes = sunTimes;
})();
