/* =========================================================
   Kyleu's indemnity, signed online. Shared by the website and the admin.
   - K.ind.text(): the wording (Admin > Settings > Camp & check-in can change it)
   - K.ind.risks(area): the main risks in plain words, for the guest's stand
   - K.ind.form(box, ctx, done): the signing form (one person at a time)
   - K.ind.forRef(ref) / K.ind.status(ref, people): who has signed for a booking
   - K.ind.pdf(recs, o): one signed form per person, or many with a register page (for the insurer)
   Every signed form keeps its own copy of the exact wording that was signed.
   Who signs: every adult signs for themselves. A parent or guardian signs for anyone under 18
   by ticking them under "Under 18s in my care".
   Demo: signed forms are kept in this browser ("kyleu-indemnities"), where the admin demo reads them.
   Live version: they are saved on the server with the time and IP address.
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var STORE = 'kyleu-indemnities';
  var BASE = (document.querySelector('meta[name="kyleu-base"]') || {}).content || '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var key = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  var nkey = function (s) { return String(s || '').toLowerCase().replace(/\s+/g, ' ').trim(); };
  function D(s) { var p = String(s).slice(0, 10).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function nice(s, o) { return s ? D(s).toLocaleDateString('en-ZA', o || { day: 'numeric', month: 'long', year: 'numeric' }) : ''; }
  function pad2(n) { return (n < 10 ? '0' : '') + n; }
  function stamp(d) { d = d || new Date(); return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()); }
  function hash(s) { var h = 5381; s = String(s); for (var i = 0; i < s.length; i++) h = ((h << 5) + h + s.charCodeAt(i)) >>> 0; return h.toString(36); }

  /* ---------- the wording ----------
     Kyleu's own indemnity and camp rules. Payment, cancellation and price rules are left out on purpose:
     they are booking terms (on the policies page), not part of what a guest signs for the insurer.
     Markup: "## " starts a heading, "- " a bullet, **bold**. */
  var DEFAULT = [
    'KYLEU Bush Camp is situated in the Dinokeng Big 5 Game Reserve. Dangerous animals walk around freely. Please take the time to read through the terms and conditions of KYLEU Bush Camp. It is your responsibility to familiarise yourself with the rules and regulations of the camp in order to ensure a pleasant stay.',
    '## Visitor\'s responsibility\n- Insurance of personal items\n- Supervise children and minors staying with you\n- Respect the privacy of other guests\n- Report any irregular deeds by fellow guests to KYLEU management\n- Use the available facilities with responsibility and accountability',
    '## Check-in times\n- Arrival 13:00, departure 11:00',
    '## Open (unfenced) bush camp\nEach stand is spacious and surrounded by bushveld where the Big 5 and other animals are free to roam. This area of KYLEU Bush Camp is **not fenced**. Each stand has a private ablution, but no electricity.\n**Camping at the KYLEU open bush camp is ENTIRELY AT YOUR OWN RISK.**',
    '## Fenced bush camp\nEach stand is spacious, positioned near the fence for animal viewing, and surrounded by bushveld. You are welcome to stroll through the camp at your leisure. Each stand has a private ablution, but no electricity.',
    '## Self-sufficient sites on the spruit\nThese campsites are **UNFENCED** and have **NO FACILITIES**: no ablution, which means no water and no electricity, and no braai stand (only a small fire boma with a grill). You need to be completely self-sufficient.',
    '## Please note\n- Each stand allows for 4 to 8 guests per night.\n- Stands are 40 to 80 m from each other.\n- Each ablution has a shower, toilet, hand basin, a wash-up for dishes and hot water.\n- The ablutions have solar-powered LED lights. We cannot ensure that there is sunshine every day, so please bring additional lighting.\n- There is **NO ELECTRICITY** at the campsites.\n- Each stand has braai facilities, and 1 complimentary bag of wood is provided for each day of your stay. Extra wood is available for purchase at KYLEU.\n- Only make a fire in the designated area. **NO OPEN FIRES ALLOWED.** Make sure fires are completely put out before you leave the area or go to bed.\n- No firewood or kindling may be collected from the surrounding bushveld.\n- Do not attempt to touch or play with any snakes. Stay calm and stay still until the snake moves away. In most cases, snakes do not attack people. Please report any sightings to management.\n- All animals are wild and must be treated with respect.',
    '## General rules\n- No pets are allowed on the property.\n- Smokers must always take care when putting out a cigarette.\n- Day visitors (as your guests) are allowed only by prior arrangement with management, at an additional charge, and must leave the camp by 18:00.\n- **NO MUSIC** allowed. Zero noise after 22:00.\n- Lock your tents, caravans and trailers when you leave the camp.\n- Please use water sparingly.\n- Unless otherwise indicated, the speed limit in the camp and the reserve is 30 km/h.\n- Only drive on the main thoroughfare or servitude roads in the reserve, unless you have an **OFFICIAL SELF-DRIVE ROUTE PERMIT** (online, at the reserve gates or at the start of the Wilderness Way route).\n- KYLEU has a no-littering policy. Please use the rubbish bins provided.',
    '## Indemnity\n**Camping is ENTIRELY AT YOUR OWN RISK.** KYLEU Bush Camp and its owners will not be responsible for any injury, loss or damage to persons or personal property while on the premises or on excursions in the greater Dinokeng.',
    'Should any of the rules not be adhered to, we reserve the right of admission. Misbehaviour will not be tolerated, and guests who do not follow the rules will be asked to leave the premises immediately, with no refund.',
    'In case of an emergency, please call management on 060 458 4478.',
    'KYLEU management thanks you in advance for respecting the rules, and we hope you have an enjoyable stay!'
  ].join('\n\n');

  // the admin points this at its own setting; the website uses what the admin published
  function text() {
    if (I.override) { var o = I.override(); if (o) return o; }
    var w = K.webContent ? K.webContent() : null;
    return (w && w.indemnity) || DEFAULT;
  }
  function inline(s) { return esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>'); }
  function html(t) {
    return String(t || '').split(/\n\s*\n/).map(function (blk) {
      var out = '', ul = [];
      var flush = function () { if (ul.length) { out += '<ul>' + ul.map(function (x) { return '<li>' + inline(x) + '</li>'; }).join('') + '</ul>'; ul = []; } };
      blk.split('\n').forEach(function (ln) {
        ln = ln.trim(); if (!ln) return;
        if (/^##\s+/.test(ln)) { flush(); out += '<h5>' + inline(ln.replace(/^##\s+/, '')) + '</h5>'; }
        else if (/^[-•]\s+/.test(ln)) ul.push(ln.replace(/^[-•]\s+/, ''));
        else { flush(); out += '<p>' + inline(ln) + '</p>'; }
      });
      flush(); return out;
    }).join('');
  }
  // the same wording as plain text (paper form, older PDFs)
  function plain(t) { return String(t || '').replace(/^##\s+(.+)$/gm, function (_, h) { return h.toUpperCase(); }).replace(/\*\*/g, ''); }
  // the wording in blocks, for drawing in a PDF: [{k:'h'|'p'|'li', t, b(bold)}]
  function blocks(t) {
    var out = [];
    String(t || '').split(/\n\s*\n/).forEach(function (blk, bi) {
      blk.split('\n').forEach(function (ln) {
        ln = ln.trim(); if (!ln) return;
        var bold = /^\*\*[^*]+\*\*[.!]?$/.test(ln.replace(/^[-•]\s+/, ''));
        if (/^##\s+/.test(ln)) out.push({ k: 'h', t: ln.replace(/^##\s+/, '').replace(/\*\*/g, '') });
        else if (/^[-•]\s+/.test(ln)) out.push({ k: 'li', t: ln.replace(/^[-•]\s+/, '').replace(/\*\*/g, ''), b: bold });
        else out.push({ k: 'p', t: ln.replace(/\*\*/g, ''), b: bold || /OWN RISK/.test(ln) });
      });
      out.push({ k: 'gap' }); void bi;
    });
    return out;
  }

  /* ---------- the main risks, in plain words, for the guest's own stand ---------- */
  var AREA_NAME = { fenced: 'Fenced bush camp', unfenced: 'Open bush camp (not fenced)', 'self-sufficient': 'Self-sufficient site on the spruit (not fenced, no facilities)' };
  function risks(area) {
    var r = [];
    r.push(['paw', area === 'fenced' ? '<b>Wild animals, including the Big 5, roam freely</b> in the reserve around the camp. Your stand is in the fenced camp, but the reserve is not fenced.'
      : '<b>Your stand is not fenced.</b> Wild animals, including the Big 5, roam freely and can walk through the camp, day and night.']);
    r.push(['shield', '<b>You stay at your own risk.</b> Kyleu and its owners are not responsible for injury, loss or damage to people or belongings, in camp or anywhere in Dinokeng.']);
    r.push(['kid', '<b>You look after the children</b> and anyone under 18 with you, at all times.']);
    r.push(['flame', '<b>Fires only in the fire pit provided.</b> No open fires, no collecting wood, and put fires out completely before bed.']);
    r.push(['alert', '<b>Leave snakes and animals alone.</b> Stay still until a snake moves away, and tell us about it.']);
    r.push(['bolt', area === 'self-sufficient' ? '<b>No water, toilet or electricity at your stand.</b> You need to be completely self-sufficient.' : '<b>No electricity at the stands.</b> The solar lights may not last, so bring your own light.']);
    r.push(['car', '<b>30 km/h</b>, and only the main roads unless you have a self-drive route permit.']);
    r.push(['moon', '<b>No music, and quiet after 22:00.</b> Breaking the rules means leaving at once, with no refund.']);
    return r;
  }

  /* ---------- small icon set (the website and the admin have different sprites) ---------- */
  var ICONS = {
    paw: '<circle cx="11" cy="4" r="2"/><circle cx="18" cy="8" r="2"/><circle cx="20" cy="16" r="2"/><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.05Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z"/>',
    shield: '<path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><path d="m9 12 2 2 4-4"/>',
    kid: '<circle cx="12" cy="5" r="2.5"/><path d="M8 21v-5l-2-4 4-2h4l4 2-2 4v5"/><path d="M10 21v-4h4v4"/>',
    flame: '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.07-2.14-.22-4.05 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.15.43-2.29 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
    alert: '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
    bolt: '<path d="M10.5 4.9 13.1 2.2a.5.5 0 0 1 .86.46L12.6 7"/><path d="M15.7 10H20a1 1 0 0 1 .78 1.63l-1.72 1.77"/><path d="M16.3 16.3 10.9 21.8a.5.5 0 0 1-.86-.46l1.92-6A1 1 0 0 0 11 14H4a1 1 0 0 1-.78-1.63L7.7 7.7"/><path d="m2 2 20 20"/>',
    car: '<path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/>',
    moon: '<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>',
    check: '<path d="M20 6 9 17l-5-5"/>',
    pen: '<path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
    down: '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>',
    link: '<path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>',
    chat: '<path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/>',
    user: '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>',
    undo: '<path d="M3 7v6h6"/><path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>',
    type: '<path d="M4 7V4h16v3"/><path d="M9 20h6"/><path d="M12 4v16"/>',
    clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>'
  };
  function ensureSprite() {
    if (document.getElementById('ind-sprite')) return;
    var d = document.createElement('div');
    d.innerHTML = '<svg id="ind-sprite" width="0" height="0" style="position:absolute" aria-hidden="true">' + Object.keys(ICONS).map(function (k) { return '<symbol id="ind-' + k + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' + ICONS[k] + '</symbol>'; }).join('') + '</svg>';
    document.body.appendChild(d.firstChild);
  }
  function ic(n) { return '<svg class="ind-ic" aria-hidden="true"><use href="#ind-' + n + '"/></svg>'; }

  /* ---------- the signed forms ---------- */
  function all() { try { return JSON.parse(localStorage.getItem(STORE) || '[]') || []; } catch (e) { return []; } }
  function add(rec) { var l = all(); l.push(rec); localStorage.setItem(STORE, JSON.stringify(l)); }
  function forRef(ref) { var k = key(ref); return all().filter(function (r) { return key(r.ref) === k && !r.voided; }).sort(function (a, b) { return a.at < b.at ? -1 : 1; }); }
  // who is covered: everyone who signed, plus the under 18s they signed for
  function covered(recs) { var m = {}; recs.forEach(function (r) { m[nkey(r.name)] = 1; (r.minors || []).forEach(function (n) { m[nkey(n)] = 1; }); }); return m; }
  function status(ref, total) {
    var recs = forRef(ref), cov = covered(recs), n = Object.keys(cov).length;
    return { recs: recs, signed: recs.length, covered: n, total: total || 0, done: total > 0 && n >= total, cov: cov };
  }
  // a link that only opens the signing page (it does not give access to change the booking)
  function token(ref, k) { return hash(key(ref) + '|' + (k || '') + '|indemnity').slice(0, 8); }
  function signUrl(ref, k, base) { return (base || '') + 'manage.html?sign=' + encodeURIComponent(ref) + '&t=' + token(ref, k); }

  // South African ID: 13 digits, a valid check digit, and the date of birth in the first 6
  function saId(s) {
    var d = String(s || '').replace(/\s/g, ''); if (!/^\d{13}$/.test(d)) return null;
    var sum = 0; for (var i = 0; i < 13; i++) { var n = +d.charAt(12 - i); if (i % 2) { n *= 2; if (n > 9) n -= 9; } sum += n; }
    var yy = +d.slice(0, 2), mm = +d.slice(2, 4), dd = +d.slice(4, 6), now = new Date().getFullYear() % 100, y = yy > now ? 1900 + yy : 2000 + yy, dt = new Date(y, mm - 1, dd);
    if (sum % 10 || dt.getMonth() !== mm - 1 || dt.getDate() !== dd) return { bad: true };
    return { dob: y + '-' + pad2(mm) + '-' + pad2(dd) };
  }
  function ageOn(dob, on) { var a = D(dob), b = D(on || stamp().slice(0, 10)), y = b.getFullYear() - a.getFullYear(); if (b.getMonth() < a.getMonth() || (b.getMonth() === a.getMonth() && b.getDate() < a.getDate())) y--; return y; }
  function maskId(s) { s = String(s || ''); return s.length > 4 ? s.slice(0, 2) + new Array(s.length - 3).join('•') + s.slice(-2) : s; }

  /* ---------- the signature pad (draw with a finger or mouse, or type the name) ---------- */
  function sigPad(cv) {
    var g = null, ink = 0, down = false, last = null, typeMode = false, typed = '';
    function setup() {
      var r = cv.getBoundingClientRect(); if (!r.width) return false;
      var dpr = Math.max(1, window.devicePixelRatio || 1); cv.width = Math.round(r.width * dpr); cv.height = Math.round(r.height * dpr);
      g = cv.getContext('2d'); g.setTransform(dpr, 0, 0, dpr, 0, 0); g.lineWidth = 2.6; g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = '#1d1410'; g.fillStyle = '#1d1410';
      return true;
    }
    function pos(e) { var r = cv.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
    cv.addEventListener('pointerdown', function (e) {
      if (typeMode) return; if (!g && !setup()) return;
      e.preventDefault(); try { cv.setPointerCapture(e.pointerId); } catch (er) {}
      down = true; last = pos(e); g.beginPath(); g.arc(last.x, last.y, 1.2, 0, 7); g.fill(); ink++; cv.classList.add('inked');
    });
    cv.addEventListener('pointermove', function (e) {
      if (!down) return; e.preventDefault(); var p = pos(e), mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
      g.beginPath(); g.moveTo(last.prev ? last.prev.x : last.x, last.prev ? last.prev.y : last.y); g.quadraticCurveTo(last.x, last.y, mid.x, mid.y); g.stroke();
      p.prev = mid; last = p; ink++;
    });
    var up = function () { down = false; last = null; };
    cv.addEventListener('pointerup', up); cv.addEventListener('pointercancel', up); cv.addEventListener('pointerleave', function () { if (down) up(); });
    var api = {
      clear: function () { if (g || setup()) g.clearRect(0, 0, cv.width, cv.height); ink = 0; typed = ''; cv.classList.remove('inked'); },
      type: function (name, font) {
        if (!typeMode || (!g && !setup())) return; g.clearRect(0, 0, cv.width, cv.height); typed = String(name || '').trim();
        cv.classList.toggle('inked', !!typed); if (!typed) return;
        var r = cv.getBoundingClientRect(), size = Math.min(44, r.height * .45);
        g.font = '500 ' + size + 'px ' + font; while (g.measureText(typed).width > r.width - 30 && size > 14) { size -= 2; g.font = '500 ' + size + 'px ' + font; }
        g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(typed, r.width / 2, r.height * .55);
      },
      typing: function (on) { api.clear(); typeMode = !!on; cv.classList.toggle('typing', typeMode); },
      empty: function () { return typeMode ? typed.length < 3 : ink < 12; },
      wasTyped: function () { return typeMode; },
      // the signature, cropped to the ink, as a small PNG
      data: function () {
        var w = cv.width, h = cv.height, px = g.getImageData(0, 0, w, h).data, x0 = w, y0 = h, x1 = 0, y1 = 0;
        for (var y = 0; y < h; y += 2) for (var x = 0; x < w; x += 2) if (px[(y * w + x) * 4 + 3] > 20) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
        if (x1 <= x0) return null;
        var m = 6; x0 = Math.max(0, x0 - m); y0 = Math.max(0, y0 - m); x1 = Math.min(w, x1 + m); y1 = Math.min(h, y1 + m);
        var sc = Math.min(1, 520 / (x1 - x0)), o = document.createElement('canvas'); o.width = Math.round((x1 - x0) * sc); o.height = Math.round((y1 - y0) * sc);
        o.getContext('2d').drawImage(cv, x0, y0, x1 - x0, y1 - y0, 0, 0, o.width, o.height);
        return { url: o.toDataURL('image/png'), w: o.width, h: o.height };
      }
    };
    requestAnimationFrame(setup);
    return api;
  }

  /* ---------- the signing form ----------
     ctx = { ref, key, stand, standName, area, ci, co, eta, booker: { name, phone, email },
             people: [{ name, reg, car, role }], cars: [{ label, reg }], total, via, by, staff } */
  function form(box, ctx, done) {
    ensureSprite();
    var st = status(ctx.ref, ctx.total), people = (ctx.people || []).filter(function (p) { return p.name && !st.cov[nkey(p.name)]; });
    var hand = getComputedStyle(document.documentElement).getPropertyValue('--font-hand').trim() || "'Caveat', 'Segoe Print', 'Bradley Hand', cursive";
    var opts = people.map(function (p) { return '<option value="' + esc(p.name) + '">' + esc(p.name) + (p.role === 'Driver' ? ' (driver)' : '') + '</option>'; }).join('');
    box.innerHTML = '<div class="ind-form" role="form" aria-label="Sign the indemnity">' +
      '<div class="ind-f"><label for="ind-who">' + (ctx.staff ? 'Who is signing?' : 'Who is signing now?') + '</label>' +
      (people.length ? '<select id="ind-who" name="who">' + opts + '<option value="__other">Someone else (type the name)</option></select>' : '') +
      '<input id="ind-name" name="name" autocomplete="name" placeholder="Full name, as on their ID or passport"' + (people.length ? ' hidden' : '') + '></div>' +
      '<div class="ind-grid"><div class="ind-f"><label for="ind-id">SA ID or passport number</label><input id="ind-id" name="idno" autocomplete="off" inputmode="text" spellcheck="false"><small class="ind-hint" data-idhint>We use it to show who signed. It stays private.</small></div>' +
      '<div class="ind-f" data-dobf hidden><label for="ind-dob">Date of birth</label><input id="ind-dob" name="dob" type="date" max="' + stamp().slice(0, 10) + '"></div></div>' +
      '<div class="ind-f"><label for="ind-phone">Mobile number <span class="ind-opt">(optional)</span></label><input id="ind-phone" name="phone" type="tel" autocomplete="tel"></div>' +
      '<div class="ind-f" data-carf></div>' +
      '<fieldset class="ind-f ind-minors"><legend>Under 18s in my care <span class="ind-opt">(a parent or guardian signs for them)</span></legend><div class="ind-chips" data-minors></div>' +
      '<input name="more" placeholder="Other under 18s with you: names, separated by commas" aria-label="Other under 18s in your care"></fieldset>' +
      '<div class="ind-f"><span class="ind-lab">Signature</span><div class="ind-sig"><canvas data-sig aria-label="Sign here with your finger or mouse" role="img"></canvas><span class="ind-sig-ph">' + ic('pen') + 'Sign here</span><span class="ind-sig-line"></span></div>' +
      '<div class="ind-sig-acts"><button type="button" class="ind-link" data-sig-clear>' + ic('undo') + 'Clear</button><button type="button" class="ind-link" data-sig-type>' + ic('type') + 'Type my name instead</button></div></div>' +
      '<label class="ind-agree"><input type="checkbox" name="agree"><span data-agree></span></label>' +
      '<p class="ind-err" role="alert" hidden></p>' +
      '<div class="ind-acts"><button type="button" class="ind-btn" data-ind-submit>' + ic('pen') + 'Sign the indemnity</button></div>' +
      '<p class="ind-fine">Your signature, the date and time and the wording above are saved together as your signed indemnity. Kyleu keeps it safely and may share it with its insurer.' + (ctx.staff ? '' : ' You can download your copy straight after signing.') + '</p></div>';
    // a div, not a form: the admin shows it inside its own modal form, and forms cannot be nested
    var f = box.querySelector('.ind-form'), el = function (n) { return f.querySelector('[name="' + n + '"]'); }, pad = sigPad(f.querySelector('[data-sig]')), typing = false;
    var who = function () { var s = el('who'); return s && s.value !== '__other' ? s.value : el('name').value.trim(); };
    var person = function () { var n = nkey(who()); return (ctx.people || []).filter(function (p) { return nkey(p.name) === n; })[0] || null; };
    var isBooker = function () { return ctx.booker && nkey(who()) === nkey(ctx.booker.name); };
    function minorsHTML() {
      var me = nkey(who()), list = people.filter(function (p) { return nkey(p.name) !== me; });
      f.querySelector('[data-minors]').innerHTML = list.length ? list.map(function (p) { return '<label class="ind-chip"><input type="checkbox" name="minor" value="' + esc(p.name) + '"><span>' + esc(p.name) + '</span></label>'; }).join('') : '';
    }
    function agreeText() {
      var ms = minors();
      f.querySelector('[data-agree]').innerHTML = 'I, <b>' + esc(who() || '...') + '</b>, have read the indemnity and camp rules, I understand the risks and I accept them' + (ms.length ? ' for myself and for <b>' + esc(ms.join(', ')) + '</b>, who ' + (ms.length === 1 ? 'is' : 'are') + ' under 18 and in my care' : '') + '. I agree that staying at Kyleu is entirely at my own risk.';
    }
    function minors() {
      var a = [].slice.call(f.querySelectorAll('[name=minor]:checked')).map(function (x) { return x.value; });
      String(el('more').value || '').split(',').forEach(function (n) { n = n.trim(); if (n && a.map(nkey).indexOf(nkey(n)) < 0) a.push(n); });
      return a;
    }
    function carHTML() {
      var p = person(), box2 = f.querySelector('[data-carf]');
      if (p && p.reg) { box2.innerHTML = '<span class="ind-lab">Vehicle</span><p class="ind-fixed">' + ic('car') + '<span><b>' + esc(p.reg) + '</b> · ' + esc(p.role === 'Driver' ? 'driver' : 'passenger') + '</span></p>'; return; }
      var cs = (ctx.cars || []).filter(function (c) { return c.reg; });
      box2.innerHTML = cs.length ? '<label for="ind-car">Which vehicle are they in?</label><select id="ind-car" name="car"><option value="">Not sure yet</option>' + cs.map(function (c) { return '<option' + (p && p.car === c.label ? ' selected' : '') + '>' + esc(c.reg) + '</option>'; }).join('') + '</select>' : '';
    }
    function idHint() {
      var v = el('idno').value.trim(), h = f.querySelector('[data-idhint]'), sa = saId(v), dobF = f.querySelector('[data-dobf]');
      h.classList.remove('bad', 'ok');
      if (!v) { h.textContent = 'We use it to show who signed. It stays private.'; dobF.hidden = true; return; }
      if (sa && sa.bad) { h.textContent = 'That SA ID number does not look right. Please check it.'; h.classList.add('bad'); dobF.hidden = true; return; }
      if (sa) { h.textContent = 'South African ID · born ' + nice(sa.dob); h.classList.add('ok'); dobF.hidden = true; return; }
      if (/^\d{10,14}$/.test(v.replace(/\s/g, ''))) { h.textContent = 'An SA ID number has 13 digits. A passport? Add the date of birth.'; dobF.hidden = false; return; }
      h.textContent = 'Passport number · please add the date of birth'; dobF.hidden = false;
    }
    function personChanged() {
      var s = el('who'); el('name').hidden = !!(s && s.value !== '__other'); if (!el('name').hidden && s) el('name').focus();
      el('phone').value = isBooker() ? (ctx.booker.phone || '') : '';
      minorsHTML(); carHTML(); agreeText(); if (typing) pad.type(who(), hand);
    }
    if (el('who')) el('who').addEventListener('change', personChanged);
    el('name').addEventListener('input', function () { agreeText(); carHTML(); if (typing) pad.type(who(), hand); });
    el('idno').addEventListener('input', idHint);
    f.addEventListener('change', function (e) { if (e.target.name === 'minor') agreeText(); });
    el('more').addEventListener('input', agreeText);
    f.querySelector('[data-sig-clear]').onclick = function () { pad.clear(); if (typing) { typing = false; pad.typing(false); f.querySelector('[data-sig-type]').innerHTML = ic('type') + 'Type my name instead'; } };
    f.querySelector('[data-sig-type]').onclick = function () {
      typing = !typing; pad.typing(typing); this.innerHTML = typing ? ic('pen') + 'Draw it instead' : ic('type') + 'Type my name instead';
      if (typing) pad.type(who(), hand);
    };
    personChanged();
    var err = function (m, focus) { var e = f.querySelector('.ind-err'); e.hidden = false; e.textContent = m; if (focus) try { focus.focus(); } catch (x) {} return false; };
    f.querySelector('[data-ind-submit]').addEventListener('click', submit);
    f.addEventListener('keydown', function (e) { if (e.key === 'Enter' && e.target.matches('input:not([type=checkbox])')) { e.preventDefault(); e.stopPropagation(); submit(); } });
    function submit() {
      f.querySelector('.ind-err').hidden = true;
      var name = who(), idno = el('idno').value.trim().toUpperCase(), sa = saId(idno), dob = sa && !sa.bad ? sa.dob : el('dob').value;
      if (name.length < 3 || name.indexOf(' ') < 0) return err('Please give the full name: first name and surname.', el('who') && el('who').value !== '__other' ? el('who') : el('name'));
      if (st.cov[nkey(name)] || status(ctx.ref, ctx.total).cov[nkey(name)]) return err(name + ' has already signed (or is signed for). Choose someone else.', el('who') || el('name'));
      if (!idno || idno.replace(/\s/g, '').length < 5) return err('Please add the SA ID or passport number.', el('idno'));
      if (sa && sa.bad) return err('That SA ID number does not look right. Please check it.', el('idno'));
      if (!dob) return err('Please add the date of birth.', el('dob'));
      if (ageOn(dob, ctx.ci) < 18) return err('People under 18 cannot sign for themselves. A parent or guardian signs and ticks them under "Under 18s in my care".', el('idno'));
      if (pad.empty()) return err(typing ? 'Please type your full name above to sign.' : 'Please sign in the box with your finger or mouse.', f.querySelector('[data-sig]'));
      if (!el('agree').checked) return err('Please tick the box to say you have read and accept the indemnity.', el('agree'));
      var p = person(), sig = pad.data(), t = text(), n = forRef(ctx.ref).length + all().filter(function (r) { return key(r.ref) === key(ctx.ref) && r.voided; }).length + 1;
      var rec = { id: 'ind' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), no: 'IND-' + key(ctx.ref) + '-' + n, ref: ctx.ref,
        stand: ctx.stand || '', standName: ctx.standName || '', area: ctx.area || '', ci: ctx.ci, co: ctx.co, eta: ctx.eta || '',
        name: name, idNo: idno, idKind: sa ? 'SA ID' : 'Passport', dob: dob, phone: el('phone').value.trim(), email: isBooker() ? (ctx.booker.email || '') : '',
        reg: p && p.reg ? p.reg : (el('car') ? el('car').value : ''), role: p ? p.role || '' : '', minors: minors(),
        bookedBy: ctx.booker ? ctx.booker.name : '', sig: sig.url, sigW: sig.w, sigH: sig.h, typed: pad.wasTyped(),
        at: stamp(), via: ctx.via || 'Online', by: ctx.by || '', textV: hash(t), text: t, device: (navigator.userAgent || '').slice(0, 160) };
      try { add(rec); } catch (x) { return err('This browser could not save the signature. Please try again, or sign at reception when you arrive.'); }
      if (done) done(rec);
    }
    return f;
  }

  // the risks, with the full wording to open
  function risksHTML(area, o) {
    ensureSprite(); o = o || {};
    return '<div class="ind-risks"><h4>' + ic('shield') + (o.title || 'What you are agreeing to') + '</h4>' +
      (area && AREA_NAME[area] ? '<p class="ind-area">Your stand: <b>' + esc(o.standName || '') + '</b>' + (o.standName ? ' · ' : '') + esc(AREA_NAME[area]) + '</p>' : '') +
      '<ul class="ind-rl">' + risks(area).map(function (r) { return '<li>' + ic(r[0]) + '<span>' + r[1] + '</span></li>'; }).join('') + '</ul>' +
      '<details class="ind-full"><summary>Read the full indemnity and camp rules</summary><div class="ind-text">' + html(text()) + '</div></details></div>';
  }
  // who has signed so far (names only: ID numbers are never shown to other guests)
  function statusHTML(ref, total, people) {
    ensureSprite();
    var s = status(ref, total), left = (people || []).filter(function (p) { return p.name && !s.cov[nkey(p.name)]; });
    var unnamed = Math.max(0, total - s.covered - left.length);
    return '<div class="ind-status' + (s.done ? ' done' : '') + '"><div class="ind-count"><b>' + Math.min(s.covered, total) + ' of ' + total + '</b><span>' + (s.done ? 'everyone is signed for' : 'people signed for') + '</span><i style="--p:' + (total ? Math.min(1, s.covered / total) : 0) + '"></i></div>' +
      '<ul class="ind-people">' + s.recs.map(function (r) { return '<li class="ok">' + ic('check') + '<span><b>' + esc(r.name) + '</b> signed ' + esc(nice(r.at.slice(0, 10), { day: 'numeric', month: 'short' })) + (r.minors && r.minors.length ? ', also for ' + esc(r.minors.join(', ')) : '') + '</span></li>'; }).join('') +
      left.map(function (p) { return '<li>' + ic('user') + '<span><b>' + esc(p.name) + '</b> not signed yet</span></li>'; }).join('') +
      (unnamed > 0 ? '<li>' + ic('user') + '<span>' + unnamed + ' more ' + (unnamed === 1 ? 'person' : 'people') + ' not named or signed yet</span></li>' : '') + '</ul></div>';
  }

  /* ---------- the PDF: one signed form per person; many with a register page first ---------- */
  var LOGO = null;
  function logo() {
    if (LOGO) return LOGO;
    LOGO = new Promise(function (ok) {
      var im = new Image(); im.onload = function () { var c = document.createElement('canvas'), sc = Math.min(1, 240 / im.width); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc); c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); ok({ d: c.toDataURL('image/png'), r: c.height / c.width }); };
      im.onerror = function () { ok(null); }; im.src = BASE + 'assets/img/logo-small.png';
    });
    return LOGO;
  }
  function clean(s) { return String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/[–—−]/g, '-').replace(/•/g, '*').replace(/[^\x09\x0a\x0d\x20-\xff]/g, ''); }
  var C = { bark: [42, 27, 18], sun: [232, 115, 28], soft: [110, 95, 80], line: [230, 217, 195], sand: [248, 241, 229], ok: [63, 125, 58], white: [255, 255, 255] };
  function when(r) { return nice(r.at.slice(0, 10)) + ' at ' + r.at.slice(11, 16); }
  function viaText(r) { return /reception/i.test(r.via) ? 'At Kyleu reception' + (r.by ? ', with ' + r.by : '') : /link/i.test(r.via) ? 'Online, with the signing link sent to the guest' : 'Online, while finalising the booking (kyleu.co.za)'; }
  function draw(doc, r, L0) {
    var L = 14, R = 196, W = R - L, y = 0, BIZ = K.BIZ || { name: 'Kyleu Bush Camp', web: 'www.kyleu.co.za', reg: '', addr: '' };
    var font = function (size, bold, c) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); c = c || C.bark; doc.setTextColor(c[0], c[1], c[2]); };
    var tx = function (t, x, yy, o) { doc.text(Array.isArray(t) ? t.map(clean) : clean(t), x, yy, o); };
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); };
    var need = function (h) { if (y + h > 278) { doc.addPage(); y = 18; } };
    var H = 27; fill(C.bark); doc.rect(0, 0, 210, H, 'F'); fill(C.sun); doc.rect(0, H, 210, 1.4, 'F');
    if (L0) try { doc.addImage(L0.d, 'PNG', L, 4, 23, 23 * L0.r); } catch (e) {}
    font(15, true, C.white); tx(BIZ.name, L + 27, 12); font(8.5, false, C.white); tx('Dinokeng Big 5 Game Reserve', L + 27, 17.5);
    font(19, true, C.white); tx('INDEMNITY', R, 11.5, { align: 'right' }); font(8.5, false, C.white); tx(r.no, R, 17.5, { align: 'right' }); tx('Signed ' + when(r), R, 22, { align: 'right' });
    y = H + 10; font(13.5, true); tx('Indemnity and acknowledgement of risk', L, y); y += 8;
    var col = function (x, title, rows) {
      var yy = y; font(7.3, true, C.soft); tx(title, x, yy); yy += 5;
      rows.forEach(function (rw) { if (!rw[1]) return; font(8.2, false, C.soft); tx(rw[0], x, yy); font(9.2, true); var ls = doc.splitTextToSize(clean(rw[1]), 60); tx(ls, x + 28, yy); yy += ls.length * 4.3 + .4; });
      return yy;
    };
    var a = col(L, 'SIGNED BY', [['Full name', r.name], [r.idKind === 'SA ID' ? 'SA ID number' : 'Passport no.', r.idNo], ['Date of birth', nice(r.dob)], ['Mobile', r.phone], ['Email', r.email], ['Under 18s', (r.minors || []).join(', ')]]);
    var b = col(108, 'THE STAY', [['Booking', r.ref], ['Stand', r.standName], ['Area', AREA_NAME[r.area] || ''], ['Arrive', nice(r.ci)], ['Depart', nice(r.co)], ['Vehicle', r.reg ? r.reg + (r.role ? ' (' + r.role.toLowerCase() + ')' : '') : 'Not given'], ['Booked by', r.bookedBy]]);
    y = Math.max(a, b) + 4;
    // the main risks
    var rs = risks(r.area).map(function (x) { return x[1].replace(/<[^>]+>/g, ''); }), rh = 8 + rs.reduce(function (s, t) { font(8.4); return s + doc.splitTextToSize(clean(t), W - 12).length * 3.8 + 1; }, 0);
    need(rh + 4); fill(C.sand); doc.roundedRect(L, y, W, rh, 2, 2, 'F'); font(7.3, true, C.soft); tx('THE MAIN RISKS, IN SHORT', L + 4, y + 5.5);
    var ry = y + 10.5; rs.forEach(function (t) { font(8.4); var ls = doc.splitTextToSize(clean(t), W - 12); fill(C.sun); doc.circle(L + 5.2, ry - 1.1, .7, 'F'); tx(ls, L + 8, ry); ry += ls.length * 3.8 + 1; });
    y += rh + 7;
    // the full wording, exactly as signed
    font(7.3, true, C.soft); need(10); tx('THE INDEMNITY AND CAMP RULES, AS SIGNED', L, y); y += 5.5;
    blocks(r.text || text()).forEach(function (bk) {
      if (bk.k === 'gap') { y += 1.6; return; }
      if (bk.k === 'h') { need(9); y += 1; font(9.2, true); tx(bk.t, L, y); y += 4.6; return; }
      font(8.3, bk.b); var ind = bk.k === 'li' ? 4 : 0, ls = doc.splitTextToSize(clean(bk.t), W - ind); need(ls.length * 3.7 + 1);
      if (ind) { fill(C.soft); doc.circle(L + 1.3, y - 1.05, .55, 'F'); }
      tx(ls, L + ind, y); y += ls.length * 3.7 + .5;
    });
    // the declaration and the signature
    var dec = 'I, ' + r.name + ', have read the indemnity and camp rules above, I understand the risks and I accept them' + ((r.minors || []).length ? ' for myself and for ' + r.minors.join(', ') + ', who ' + (r.minors.length === 1 ? 'is' : 'are') + ' under 18 and in my care' : '') + '. I agree that staying at Kyleu Bush Camp is entirely at my own risk.';
    font(9, true); var dl = doc.splitTextToSize(clean(dec), W - 8), sh = Math.min(26, r.sigW && r.sigH ? 60 * r.sigH / r.sigW : 20), bh = dl.length * 4.3 + sh + 30;
    y += 5; need(bh); doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.setLineWidth(.4); doc.roundedRect(L, y, W, bh, 2, 2, 'S');
    font(7.3, true, C.soft); tx('DECLARATION', L + 4, y + 6); font(9, true); tx(dl, L + 4, y + 11.5);
    var sy = y + 13 + dl.length * 4.3;
    if (r.sig) try { doc.addImage(r.sig, 'PNG', L + 4, sy, Math.min(80, sh * (r.sigW / r.sigH)), sh); } catch (e) {}
    doc.setDrawColor(C.soft[0], C.soft[1], C.soft[2]); doc.setLineWidth(.3); doc.line(L + 4, sy + sh + 1.5, L + 80, sy + sh + 1.5);
    font(7.8, false, C.soft); tx('Signature of ' + r.name + (r.typed ? ' (typed)' : ''), L + 4, sy + sh + 5.5);
    var info = [['Signed', when(r)], ['How', viaText(r)], ['Form number', r.no], ['Wording reference', r.textV || '']];
    var iy = sy + 2; info.forEach(function (x) { font(7.8, false, C.soft); tx(x[0], 104, iy); font(8.4, true); var ls = doc.splitTextToSize(clean(x[1]), 62); tx(ls, 130, iy); iy += ls.length * 3.9 + .8; });
    y += bh + 4;
    font(7.4, false, C.soft); var el = doc.splitTextToSize('Signed electronically. The signature, the date and time, and the wording above were saved together when ' + r.name + ' signed. Kyleu Bush Camp keeps this form for its records and its insurer.', W); need(el.length * 3.4); tx(el, L, y);
  }
  function foot(doc, from, label) {
    var n = doc.getNumberOfPages(), BIZ = K.BIZ || { name: 'Kyleu Bush Camp', web: 'www.kyleu.co.za', reg: '' };
    for (var i = from; i <= n; i++) {
      doc.setPage(i); doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.setLineWidth(.3); doc.line(14, 285, 196, 285);
      doc.setFont('helvetica', 'normal'); doc.setFontSize(7); doc.setTextColor(C.soft[0], C.soft[1], C.soft[2]);
      doc.text(clean(BIZ.name + (BIZ.reg ? ' · Reg. ' + BIZ.reg : '') + ' · ' + BIZ.web + ' · ' + label), 105, 289.5, { align: 'center' });
    }
  }
  function register(doc, recs, o) {
    var L = 14, R = 196, y = 20;
    var font = function (size, bold, c) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); c = c || C.bark; doc.setTextColor(c[0], c[1], c[2]); };
    font(17, true); doc.text('Kyleu Bush Camp: indemnity register', L, y); y += 7;
    font(9.5, false, C.soft); doc.text(clean(recs.length + ' signed form' + (recs.length === 1 ? '' : 's') + (o.filters ? ' · ' + o.filters : '') + ' · made ' + nice(stamp().slice(0, 10))), L, y); y += 9;
    var cols = [['Signed', 18], ['Name', 38], ['ID or passport', 28], ['Booking', 22], ['Stand', 22], ['Stay', 26], ['Vehicle', 28]], x;
    var head = function () { doc.setFillColor(C.bark[0], C.bark[1], C.bark[2]); doc.rect(L, y - 4.6, R - L, 7, 'F'); font(7.6, true, C.white); x = L + 2; cols.forEach(function (c) { doc.text(c[0], x, y); x += c[1]; }); y += 6; };
    head();
    recs.forEach(function (r, i) {
      if (y > 276) { doc.addPage(); y = 20; head(); }
      if (i % 2) { doc.setFillColor(C.sand[0], C.sand[1], C.sand[2]); doc.rect(L, y - 4.2, R - L, 6.2, 'F'); }
      var vals = [nice(r.at.slice(0, 10), { day: 'numeric', month: 'short', year: '2-digit' }), r.name + ((r.minors || []).length ? ' +' + r.minors.length : ''), r.idNo, r.ref, r.standName, nice(r.ci, { day: 'numeric', month: 'short' }) + ' to ' + nice(r.co, { day: 'numeric', month: 'short' }), r.reg || '-'];
      font(7.8); x = L + 2; vals.forEach(function (v, j) { var t = doc.splitTextToSize(clean(v), cols[j][1] - 2)[0] || ''; doc.text(t, x, y); x += cols[j][1]; }); y += 6.2;
    });
    font(7.5, false, C.soft); doc.text('"+2" after a name: that person also signed for 2 under 18s in their care. Each signed form follows on its own page.', L, Math.min(282, y + 4));
  }
  function pdf(recs, o) {
    o = o || {};
    return Promise.all([K.needPdf(), logo()]).then(function (res) {
      var J = window.jspdf && window.jspdf.jsPDF; if (!J) throw new Error('no pdf');
      var doc = new J({ unit: 'mm', format: 'a4', compress: true }), L0 = res[1], many = recs.length > 1 || o.register;
      if (many) { register(doc, recs, o); foot(doc, 1, 'Indemnity register'); }
      recs.forEach(function (r, i) { if (many || i) doc.addPage(); var p0 = doc.getNumberOfPages(); draw(doc, r, L0); foot(doc, p0, 'Indemnity ' + r.no); });
      var name = o.name || (recs.length === 1 ? 'Kyleu indemnity ' + recs[0].name + ' ' + recs[0].ref + '.pdf' : 'Kyleu indemnities ' + stamp().slice(0, 10) + '.pdf');
      var blob = doc.output('blob'), url = URL.createObjectURL(blob);
      if (o.keep) return { url: url, name: name, blob: blob, data: doc.output('datauristring') };   // for attaching to an email
      if (o.open) { window.open(url, '_blank'); return { url: url, name: name }; }
      var a = document.createElement('a'); a.href = url; a.download = name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500);
      return { url: url, name: name, blob: blob };
    });
  }
  // a spreadsheet of the forms (no signatures), for the insurer or the bookkeeper
  function csv(recs, name) {
    var q = function (v) { v = String(v == null ? '' : v); return /[",\n]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; };
    var rows = [['Form number', 'Signed', 'How', 'Name', 'ID or passport', 'Kind', 'Date of birth', 'Mobile', 'Email', 'Under 18s signed for', 'Booking', 'Stand', 'Area', 'Arrive', 'Depart', 'Vehicle', 'Booked by', 'Wording reference']]
      .concat(recs.map(function (r) { return [r.no, r.at, viaText(r), r.name, r.idNo, r.idKind, r.dob, r.phone, r.email, (r.minors || []).join('; '), r.ref, r.standName, AREA_NAME[r.area] || r.area, r.ci, r.co, r.reg, r.bookedBy, r.textV]; }));
    var blob = new Blob(['﻿' + rows.map(function (r) { return r.map(q).join(','); }).join('\r\n')], { type: 'text/csv;charset=utf-8' }), a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = name || 'Kyleu indemnities ' + stamp().slice(0, 10) + '.csv'; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500);
  }

  var I = K.ind = {
    DEFAULT: DEFAULT, AREA_NAME: AREA_NAME, override: null,
    text: text, html: html, plain: plain, version: function (t) { return hash(t || text()); }, risks: risks,
    all: all, forRef: forRef, status: status, covered: covered, token: token, signUrl: signUrl, saId: saId, maskId: maskId, nkey: nkey,
    form: form, risksHTML: risksHTML, statusHTML: statusHTML, ic: function (n) { ensureSprite(); return ic(n); },
    pdf: pdf, csv: csv, when: when, viaText: viaText
  };
})();
