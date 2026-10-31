/* Proof of payment upload (pop.html)
   Demo: the file is kept in this browser only (localStorage "kyleu-web-pop"),
   so it shows up on the booking in the admin demo. Nothing is sent anywhere.
   Live version: the file is uploaded to secure storage and attached to the booking. */
(function () {
  'use strict';
  var K = window.Kyleu || {}, $ = function (s, r) { return (r || document).querySelector(s); };
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var MAX = 10 * 1024 * 1024, picked = null;
  function kb(n) { return n >= 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB'; }
  function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  // demo lookup: bookings made on this website, plus the admin demo's bookings in this browser
  function findBooking(ref) {
    var k = key(ref), list = [];
    try { list = list.concat(JSON.parse(localStorage.getItem('kyleu-web-bookings') || '[]').map(function (b) { return { ref: b.ref, email: b.email, stand: b.stand, ci: b.ci, co: b.co }; })); } catch (e) {}
    try { var db = JSON.parse(localStorage.getItem('kyleu-admin-demo-v1') || 'null'); if (db && db.bookings) list = list.concat(db.bookings.map(function (b) { return { ref: b.ref, email: b.guest.email, stand: b.stand, ci: b.ci, co: b.co }; })); } catch (e) {}
    return k.length >= 6 ? list.filter(function (b) { return key(b.ref) === k; })[0] : null;
  }
  function nice(s) { var p = s.split('-'); return new Date(+p[0], p[1] - 1, +p[2]).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }); }
  function standName(id) { return String(id || '').replace(/-/g, ' ').replace(/\b\w/g, function (c) { return c.toUpperCase(); }); }

  document.addEventListener('DOMContentLoaded', function () {
    var f = $('form[data-pop]'); if (!f) return;
    var ref = f.elements.ref, email = f.elements.email, found = $('[data-found]', f), fileIn = $('[data-file]', f), drop = $('[data-drop]', f), out = $('[data-picked]', f);
    try { var q = new URLSearchParams(location.search); if (q.get('ref')) ref.value = q.get('ref').toUpperCase(); if (q.get('email')) email.value = q.get('email'); } catch (e) {}

    function check() {
      var b = findBooking(ref.value);
      if (!ref.value.trim() || key(ref.value).length < 6) { found.hidden = true; return; }
      found.hidden = false;
      found.className = 'pop-found ' + (b ? 'ok' : 'warn');
      found.innerHTML = b ? '<svg><use href="#i-check"/></svg><span>Booking <b>' + esc(b.ref) + '</b> found: ' + esc(standName(b.stand)) + ', ' + nice(b.ci) + ' to ' + nice(b.co) + '.</span>'
        : '<svg><use href="#i-info"/></svg><span>We can\'t find that reference yet. Check it on your invoice, or send it anyway and we\'ll match it by hand.</span>';
    }
    ref.addEventListener('input', check); check();

    function pick(file) {
      if (!file) return;
      if (!/^image\/|pdf$/.test(file.type)) { (K.toast || alert)('Please choose a PDF or a photo'); return; }
      if (file.size > MAX) { (K.toast || alert)('That file is bigger than 10 MB'); return; }
      picked = file; f.querySelector('[data-file-field]').classList.remove('err');
      out.hidden = false; drop.hidden = true;
      out.innerHTML = '<span class="df-ic"><svg><use href="#i-doc"/></svg></span><span class="df-t"><b>' + esc(file.name) + '</b><small>' + kb(file.size) + '</small></span><button type="button" class="df-x" aria-label="Choose a different file"><svg><use href="#i-x"/></svg></button>';
      if (/^image\//.test(file.type)) { var u = URL.createObjectURL(file); $('.df-ic', out).innerHTML = '<img src="' + u + '" alt="">'; }
      $('.df-x', out).addEventListener('click', function () { picked = null; fileIn.value = ''; out.hidden = true; drop.hidden = false; });
    }
    fileIn.addEventListener('change', function () { pick(fileIn.files[0]); });
    ['dragenter', 'dragover'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (ev) { drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove('over'); }); });
    drop.addEventListener('drop', function (e) { pick(e.dataTransfer.files[0]); });

    // keep a smaller copy for the demo (browser storage is small); the live version uploads the original
    function demoCopy(file, cb) {
      var rd = new FileReader();
      if (/^image\//.test(file.type)) {
        rd.onload = function () { var im = new Image(); im.onload = function () { var s = Math.min(1, 1400 / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * s); c.height = Math.round(im.height * s); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); cb(c.toDataURL('image/jpeg', .8), 'image/jpeg'); }; im.onerror = function () { cb('', file.type); }; im.src = rd.result; };
        rd.readAsDataURL(file);
      } else if (file.size <= 1.5 * 1024 * 1024) { rd.onload = function () { cb(rd.result, file.type); }; rd.readAsDataURL(file); }
      else cb('', file.type);
    }

    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var ok = true;
      [ref, email].forEach(function (inp) { var bad = !inp.value.trim() || (inp.type === 'email' && !/^\S+@\S+\.\S+$/.test(inp.value)); inp.closest('.field').classList.toggle('err', bad); if (bad) ok = false; });
      f.querySelector('[data-file-field]').classList.toggle('err', !picked); if (!picked) ok = false;
      if (!ok) { (K.toast || alert)('Please fill in the highlighted fields'); return; }
      var btn = f.querySelector('button[type=submit]'); btn.disabled = true; btn.textContent = 'Sending…';
      demoCopy(picked, function (data, type) {
        var now = new Date(), pad = function (n) { return String(n).padStart(2, '0'); };
        var at = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate()) + ' ' + pad(now.getHours()) + ':' + pad(now.getMinutes());
        var item = { id: 'p' + now.getTime().toString(36), ref: ref.value.trim().toUpperCase(), email: email.value.trim(), note: f.elements.note.value.trim(), at: at, file: { name: picked.name, size: picked.size, type: type, data: data } };
        var list = []; try { list = JSON.parse(localStorage.getItem('kyleu-web-pop') || '[]'); } catch (x) {}
        list.push(item);
        try { localStorage.setItem('kyleu-web-pop', JSON.stringify(list.slice(-10))); }
        catch (x) { item.file.data = ''; list[list.length - 1] = item; try { localStorage.setItem('kyleu-web-pop', JSON.stringify(list.slice(-10))); } catch (y) {} }
        f.innerHTML = '<div class="success"><div class="success-badge"><svg class="ring" viewBox="0 0 110 110" fill="none" stroke="#3f7d3a" stroke-width="6" stroke-linecap="round"><circle cx="55" cy="55" r="50"/><path d="M34 57l14 14 28-30"/></svg></div>' +
          '<h2>Thank you, we\'ve got it</h2><p class="muted">Your proof of payment is on booking <b>' + esc(item.ref) + '</b>. We\'ll check the bank and email <b>' + esc(item.email) + '</b> as soon as your booking is confirmed, usually within one working day.</p>' +
          '<div class="cta-actions" style="justify-content:center"><a class="btn" href="index.html">Back to the website</a><a class="btn btn-ghost" href="contact.html">Directions to camp</a></div>' +
          '<div class="demo-flag" style="margin:22px 0 0;text-align:left"><svg><use href="#i-info"/></svg><span>Demo mode: nothing was sent. Open the admin demo (Staff link in the footer) in this browser to see it on the booking.</span></div></div>';
        window.scrollTo({ top: f.getBoundingClientRect().top + scrollY - 120, behavior: 'smooth' });
      });
    });
  });
})();
