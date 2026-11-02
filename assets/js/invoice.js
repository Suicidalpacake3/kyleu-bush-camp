/* =========================================================
   Kyleu invoices and quotes: one look everywhere
   - K.invoiceHTML(inv): the invoice on the website and in the admin
   - K.invoicePDF(inv): the same invoice as a PDF (jsPDF), for email and download
   - K.paidForm(box, inv, done): "I have paid" for guests
   inv = { kind: 'Invoice'|'Quote', no, date, ref, guest: {name, email, phone},
           stay: {stand, ci, co, nights, guests, vehicles}, lines: [{t, amt, tag}],
           total, paid, deposit, depPct, depositDue, balanceDue, payFull, cancelled, validTo, note }
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  var BASE = (document.querySelector('meta[name="kyleu-base"]') || {}).content || '';
  var esc = function (s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); };
  var money = function (n) { return K.money ? K.money(Math.round(n || 0)) : 'R' + Math.round(n || 0); };
  var LONG = { day: 'numeric', month: 'long', year: 'numeric' };
  function D(s) { var p = String(s).slice(0, 10).split('-'); return new Date(+p[0], p[1] - 1, +p[2]); }
  function nice(s, o) { return s ? D(s).toLocaleDateString('en-ZA', o || LONG) : ''; }

  // business and bank details: content/settings.md can override every one of these
  var BIZ = { name: 'Kyleu Bush Camp', tag: 'Dinokeng Big 5 Game Reserve', addr: 'Plot 77 Klipdrift 90 JR, Kaallaagte Road, Dinokeng Game Reserve, Gauteng', phone: '060 458 4478', email: 'info@kyleu.co.za', web: 'www.kyleu.co.za',
    bank: 'FNB', accName: 'Kyleu Bush Camp', accNo: '62000000000', branch: '250655', accType: 'Cheque' };
  K.BIZ = BIZ;
  if (K.settings) K.settings().then(function (S) {
    if (!S) return;
    [['bank', 'Bank'], ['accName', 'Account name'], ['accNo', 'Account number'], ['branch', 'Branch code'], ['accType', 'Account type'], ['phone', 'Phone'], ['email', 'Email']].forEach(function (x) { var v = S.get(x[1], ''); if (v) BIZ[x[0]] = v; });
  }).catch(function () {});

  // where the invoice stands: what is due, by when
  function state(inv) {
    var bal = Math.max(0, Math.round(inv.total - (inv.paid || 0)));
    if (inv.cancelled) return { k: 'cancel', t: 'This booking is cancelled', bal: bal };
    if (inv.kind === 'Quote') return { k: 'quote', t: 'Quote' + (inv.validTo ? ', valid until ' + nice(inv.validTo) : '') + '. Your stand is only held once the deposit is paid.', bal: bal };
    if (bal <= 0) return { k: 'paid', t: 'Paid in full. Thank you!', bal: 0 };
    if (!inv.paid && !inv.payFull) return { k: 'due', t: 'Deposit of ' + money(inv.deposit) + ' due by ' + nice(inv.depositDue), bal: bal, now: inv.deposit };
    if (!inv.paid) return { k: 'due', t: 'Full amount of ' + money(bal) + ' due by ' + nice(inv.depositDue), bal: bal, now: bal };
    return { k: 'due', t: 'Balance of ' + money(bal) + ' due by ' + nice(inv.balanceDue), bal: bal, now: bal };
  }
  function schedule(inv) {
    var st = state(inv), rows = [];
    if (st.k === 'paid' || st.k === 'cancel') return rows;
    if (!inv.paid && !inv.payFull) { rows.push(['Deposit (' + (inv.depPct || 50) + '%)', money(inv.deposit), 'by ' + nice(inv.depositDue)]); rows.push(['Balance', money(inv.total - inv.deposit), 'by ' + nice(inv.balanceDue)]); }
    else rows.push([inv.paid ? 'Balance' : 'Full amount', money(st.bal), 'by ' + nice(inv.paid ? inv.balanceDue : inv.depositDue)]);
    return rows;
  }
  K.invoiceState = state;
  K.invoiceName = function (inv) { return 'Kyleu ' + inv.kind.toLowerCase() + ' ' + inv.no + '.pdf'; };
  K.invoiceNo = function (ref, kind, n) { return (kind === 'Quote' ? 'Q-' : 'INV-') + String(ref).replace(/^KY/i, '') + '-' + (n || 1); };

  /* ---------- on screen ---------- */
  K.invoiceHTML = function (inv) {
    var st = state(inv), s = inv.stay || {}, g = inv.guest || {}, rows = schedule(inv);
    return '<article class="inv inv-' + st.k + '">' +
      '<header class="inv-top"><div class="inv-brand"><img src="' + BASE + 'assets/img/logo-small.png" alt="Kyleu Bush Camp logo"><div><b>' + esc(BIZ.name) + '</b><small>' + esc(BIZ.tag) + '</small></div></div>' +
      '<div class="inv-title"><span class="inv-kind">' + esc(inv.kind) + '</span><b>' + esc(inv.no) + '</b><small>' + esc(nice(inv.date)) + '</small></div></header>' +
      '<div class="inv-status">' + esc(st.t) + '</div>' +
      '<div class="inv-parties"><div><h4>' + (inv.kind === 'Quote' ? 'Prepared for' : 'Billed to') + '</h4><b>' + esc(g.name) + '</b>' + (g.email ? '<span>' + esc(g.email) + '</span>' : '') + (g.phone ? '<span>' + esc(g.phone) + '</span>' : '') + '</div>' +
      '<div><h4>Your stay</h4><dl>' + [['Booking', inv.ref], ['Stand', s.stand], ['Arrive', nice(s.ci, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })], ['Depart', nice(s.co, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })], ['Nights', s.nights], ['Guests', s.guests], ['Vehicles', s.vehicles]].filter(function (r) { return r[1] !== undefined && r[1] !== ''; }).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl></div></div>' +
      '<table class="inv-lines"><thead><tr><th>Description</th><th>Amount</th></tr></thead><tbody>' +
      inv.lines.map(function (l) { return '<tr><td>' + esc(l.t) + '</td><td>' + (l.free ? 'Free' : (l.amt < 0 ? '&minus;' : '') + money(Math.abs(l.amt))) + '</td></tr>'; }).join('') + '</tbody>' +
      '<tfoot><tr class="inv-total"><td>Total</td><td>' + money(inv.total) + '</td></tr>' + (inv.paid ? '<tr><td>Paid so far</td><td>&minus;' + money(inv.paid) + '</td></tr>' : '') +
      (st.k !== 'quote' && st.k !== 'cancel' ? '<tr class="inv-due"><td>' + (st.bal ? 'Balance due' : 'Balance') + '</td><td>' + money(st.bal) + '</td></tr>' : '') + '</tfoot></table>' +
      (st.k === 'due' || st.k === 'quote' ? '<div class="inv-pay"><div><h4>When to pay</h4>' + (rows.length ? '<ul>' + rows.map(function (r) { return '<li><span>' + esc(r[0]) + '<small>' + esc(r[2]) + '</small></span><b>' + esc(r[1]) + '</b></li>'; }).join('') + '</ul>' : '') + '</div>' +
        '<div class="inv-bank"><h4>Pay by EFT</h4><dl><dt>Bank</dt><dd>' + esc(BIZ.bank) + '</dd><dt>Account name</dt><dd>' + esc(BIZ.accName) + '</dd><dt>Account number</dt><dd>' + esc(BIZ.accNo) + '</dd><dt>Branch code</dt><dd>' + esc(BIZ.branch) + '</dd><dt>Account type</dt><dd>' + esc(BIZ.accType) + '</dd></dl><p class="inv-refbox">Use reference <b>' + esc(inv.ref) + '</b></p></div></div>' : '') +
      (inv.note ? '<p class="inv-note">' + esc(inv.note) + '</p>' : '') +
      (st.k === 'due' ? '<p class="inv-note">Paid? Tell us with <b>I have paid</b> on the website (under Change my booking) or upload your proof of payment at kyleu.co.za/pop.html. We check the bank and confirm.</p>' : '') +
      '<p class="inv-note">Cancellations are not refunded; what you paid is kept as a credit for another stay. Dinokeng Game Reserve fees are paid to the reserve, not to Kyleu.</p>' +
      '<div class="inv-dgr"><img src="' + BASE + 'assets/img/dgr-certified-partner.png" alt="DGR Certified Partner logo"><p><b>Kyleu is a proud DGR CP member.</b> Guests staying at this DGR CP campsite qualify for Conservation Fee Discount Vouchers: R85 instead of R100 per adult per night. We send you one voucher code per vehicle before your stay.</p></div>' +
      '<footer class="inv-foot">' + esc(BIZ.name) + ' · ' + esc(BIZ.addr) + ' · ' + esc(BIZ.phone) + ' · ' + esc(BIZ.email) + ' · ' + esc(BIZ.web) + '</footer></article>';
  };

  /* ---------- PDF ---------- */
  var IMG = {};
  // logos go into the PDF as small JPEGs on white, so an emailed invoice stays light
  function toData(src, w) {
    return new Promise(function (ok, no) {
      var im = new Image(); im.onload = function () {
        var c = document.createElement('canvas'), sc = Math.min(1, w / im.width); c.width = Math.round(im.width * sc); c.height = Math.round(im.height * sc);
        var x = c.getContext('2d'); x.fillStyle = '#fffdf8'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .9));
      }; im.onerror = no; im.src = src;
    });
  }
  K.invoiceAssets = function () {
    if (IMG.p) return IMG.p;
    IMG.p = Promise.all([toData(BASE + 'assets/img/logo-small.png', 220).then(function (d) { IMG.kyleu = d; }), toData(BASE + 'assets/img/dgr-certified-partner.png', 400).then(function (d) { IMG.dgr = d; })]).catch(function () {});
    return IMG.p;
  };
  K.invoiceAssets();
  function clean(s) { return String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, '-').replace(/[^\x09\x0a\x0d\x20-\xff]/g, ''); }
  var C = { bark: [42, 27, 18], sun: [232, 115, 28], ember: [184, 70, 26], soft: [110, 95, 80], line: [230, 217, 195], sand: [248, 241, 229], ok: [63, 125, 58], okbg: [232, 243, 228], due: [253, 240, 217], bad: [178, 58, 42] };
  K.invoiceDraw = function (doc, inv) {
    var L = 16, R = 194, W = R - L, y = 0, st = state(inv), s = inv.stay || {}, g = inv.guest || {};
    var font = function (size, bold, c) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); c = c || C.bark; doc.setTextColor(c[0], c[1], c[2]); };
    var text = function (t, x, yy, o) { doc.text(Array.isArray(t) ? t.map(clean) : clean(t), x, yy, o); };
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); };
    var need = function (h) { if (y + h > 270) { doc.addPage(); y = 20; } };
    // header
    fill(C.sun); doc.rect(0, 0, 210, 3.5, 'F');
    if (IMG.kyleu) try { doc.addImage(IMG.kyleu, 'JPEG', L, 10, 23, 18.5); } catch (e) {}
    font(16, true); text(BIZ.name, L + 28, 18); font(9, false, C.soft); text(BIZ.tag, L + 28, 23.5);
    font(24, true, C.sun); text(inv.kind.toUpperCase(), R, 19, { align: 'right' });
    font(10, true); text(inv.no, R, 25.5, { align: 'right' }); font(8.5, false, C.soft); text(nice(inv.date), R, 30.5, { align: 'right' });
    y = 37;
    // status band
    fill(st.k === 'paid' ? C.okbg : st.k === 'due' ? C.due : C.sand); doc.roundedRect(L, y, W, 10, 2, 2, 'F');
    font(10.5, true, st.k === 'paid' ? C.ok : st.k === 'cancel' ? C.bad : C.ember); text(st.t, L + 4, y + 6.6); y += 18;
    // parties
    var top = y;
    font(7.5, true, C.soft); text(inv.kind === 'Quote' ? 'PREPARED FOR' : 'BILLED TO', L, y); y += 6;
    font(11.5, true); text(g.name || '', L, y); y += 5.5;
    font(9.5, false, C.soft); if (g.email) { text(g.email, L, y); y += 5; } if (g.phone) { text(g.phone, L, y); y += 5; }
    var yy = top; font(7.5, true, C.soft); text('YOUR STAY', 110, yy); yy += 6;
    [['Booking', inv.ref], ['Stand', s.stand], ['Arrive', nice(s.ci, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })], ['Depart', nice(s.co, { weekday: 'short', day: 'numeric', month: 'long', year: 'numeric' })], ['Nights', s.nights], ['Guests', s.guests], ['Vehicles', s.vehicles]].forEach(function (r) {
      if (r[1] === undefined || r[1] === '') return; font(8.5, false, C.soft); text(r[0], 110, yy); font(9.5, true); text(String(r[1]), 132, yy); yy += 5.2;
    });
    y = Math.max(y, yy) + 6;
    // lines
    fill(C.bark); doc.roundedRect(L, y, W, 8, 1.5, 1.5, 'F'); font(8, true, [255, 255, 255]); text('DESCRIPTION', L + 4, y + 5.3); text('AMOUNT', R - 4, y + 5.3, { align: 'right' }); y += 8;
    inv.lines.forEach(function (l, i) {
      font(9.5); var ls = doc.splitTextToSize(clean(l.t), W - 45), h = ls.length * 4.6 + 4; need(h);
      if (i % 2) { fill(C.sand); doc.rect(L, y, W, h, 'F'); }
      text(ls, L + 4, y + 5.2); text(l.free ? 'Free' : (l.amt < 0 ? '-' : '') + money(Math.abs(l.amt)), R - 4, y + 5.2, { align: 'right' }); y += h;
    });
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.setLineWidth(.3); doc.line(L, y, R, y); y += 7;
    var tot = function (a, b, strong, col) { need(7); font(strong ? 11 : 9.5, !!strong, col); text(a, 140, y, { align: 'right' }); text(b, R - 4, y, { align: 'right' }); y += strong ? 7 : 5.8; };
    tot('Total', money(inv.total), true);
    if (inv.paid) tot('Paid so far', '-' + money(inv.paid));
    if (st.k !== 'quote' && st.k !== 'cancel') tot(st.bal ? 'Balance due' : 'Balance', money(st.bal), true, st.bal ? C.ember : C.ok);
    y += 4;
    // how to pay
    if (st.k === 'due' || st.k === 'quote') {
      need(46); var bx = y;
      fill(C.sand); doc.roundedRect(L, bx, 86, 40, 2, 2, 'F'); doc.roundedRect(108, bx, 86, 40, 2, 2, 'F');
      font(7.5, true, C.soft); text('WHEN TO PAY', L + 4, bx + 7); text('PAY BY EFT', 112, bx + 7);
      var ry = bx + 14; schedule(inv).forEach(function (r) { font(9.5, true); text(r[0], L + 4, ry); text(r[1], L + 82, ry, { align: 'right' }); font(8, false, C.soft); text(r[2], L + 4, ry + 4.2); ry += 11; });
      ry = bx + 13; [['Bank', BIZ.bank], ['Account name', BIZ.accName], ['Account number', BIZ.accNo], ['Branch code', BIZ.branch], ['Account type', BIZ.accType]].forEach(function (r) { font(8.5, false, C.soft); text(r[0], 112, ry); font(9, true); text(r[1], 140, ry); ry += 4.6; });
      fill(C.sun); doc.roundedRect(112, bx + 33, 78, 5.5, 1, 1, 'F'); font(8.5, true, [255, 255, 255]); text('Use reference ' + inv.ref, 151, bx + 36.9, { align: 'center' });
      y = bx + 48;
    }
    var para = function (t, size, col) { font(size || 8.8, false, col || C.soft); var ls = doc.splitTextToSize(clean(t), W); need(ls.length * 4.2 + 2); text(ls, L, y); y += ls.length * 4.2 + 2.5; };
    if (inv.note) para(inv.note, 9.5, C.bark);
    if (st.k === 'due') para('Paid? Tell us with "I have paid" on the website (under Change my booking) or upload your proof of payment at kyleu.co.za/pop.html. We check the bank and confirm.');
    para('Cancellations are not refunded; what you paid is kept as a credit for another stay. Dinokeng Game Reserve fees are paid to the reserve, not to Kyleu.');
    // DGR CP: approved logo on a light background with clear space around it
    need(24); y += 3;
    if (IMG.dgr) try { doc.addImage(IMG.dgr, 'JPEG', L, y, 34, 12.8); } catch (e) {}
    font(8.8, true); text('Kyleu is a proud DGR CP member.', L + 46, y + 4);
    font(8.3, false, C.soft); text(doc.splitTextToSize('Guests staying at this DGR CP campsite qualify for Conservation Fee Discount Vouchers: R85 instead of R100 per adult per night. We send you one voucher code per vehicle before your stay.', W - 46).map(clean), L + 46, y + 8.5);
    // footer on every page
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.line(L, 283, R, 283); font(7.3, false, C.soft); text(BIZ.name + ' · ' + BIZ.addr + ' · ' + BIZ.phone + ' · ' + BIZ.email + ' · ' + BIZ.web + (n > 1 ? ' · page ' + i + ' of ' + n : ''), 105, 288, { align: 'center' }); }
  };
  K.invoicePDF = function (inv) {
    var J = window.jspdf && window.jspdf.jsPDF; if (!J) return null;
    var doc = new J({ unit: 'mm', format: 'a4', compress: true }); K.invoiceDraw(doc, inv);
    var blob = doc.output('blob'); return { blob: blob, url: URL.createObjectURL(blob), data: doc.output('datauristring'), name: K.invoiceName(inv) };
  };
  // the PDF maker is only loaded when it is needed
  K.needPdf = function () {
    if (window.jspdf) return Promise.resolve();
    if (K._pdfP) return K._pdfP;
    K._pdfP = new Promise(function (ok, no) { var s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js'; s.onload = ok; s.onerror = no; document.head.appendChild(s); });
    return K._pdfP;
  };
  K.downloadInvoice = function (inv) {
    return Promise.all([K.needPdf(), K.invoiceAssets()]).then(function () {
      var f = K.invoicePDF(inv); if (!f) throw new Error('no pdf');
      var a = document.createElement('a'); a.href = f.url; a.download = f.name; document.body.appendChild(a); a.click(); setTimeout(function () { a.remove(); }, 1500);
      return f;
    });
  };
  K.openInvoicePdf = function (inv) {
    var w = window.open('', '_blank');
    return Promise.all([K.needPdf(), K.invoiceAssets()]).then(function () { var f = K.invoicePDF(inv); if (w) w.location = f.url; else location.href = f.url; });
  };

  /* ---------- "I have paid" (website) ----------
     Demo: kept in this browser (localStorage "kyleu-web-paid") so the admin can confirm it. */
  var PAID = 'kyleu-web-paid';
  K.paidClaims = function () { try { return JSON.parse(localStorage.getItem(PAID) || '[]'); } catch (e) { return []; } };
  K.paidForm = function (box, inv, done) {
    var st = state(inv), opts = [];
    if (!inv.paid && !inv.payFull && inv.deposit < st.bal) opts.push(['dep', 'The deposit', inv.deposit]);
    opts.push(['all', inv.paid ? 'The balance' : 'The full amount', st.bal]);
    opts.push(['other', 'A different amount', null]);
    var today = new Date(), iso = new Date(today.getTime() - today.getTimezoneOffset() * 6e4).toISOString().slice(0, 10);
    box.innerHTML = '<form class="paid-form" novalidate><h3>Tell us you have paid</h3><p class="muted">We then check our bank account and confirm your payment, usually within one working day.</p>' +
      '<fieldset><legend>How much did you pay?</legend>' + opts.map(function (o, i) { return '<label class="paid-opt"><input type="radio" name="amt" value="' + o[0] + '"' + (i ? '' : ' checked') + '><span><b>' + o[1] + '</b>' + (o[2] != null ? '<small>' + money(o[2]) + '</small>' : '') + '</span></label>'; }).join('') +
      '<div class="field paid-other" hidden><label for="paid-amt">Amount you paid (R)</label><input id="paid-amt" name="other" inputmode="decimal" placeholder="e.g. 500"></div></fieldset>' +
      '<div class="grid-2"><div class="field"><label for="paid-date">Date you paid</label><input id="paid-date" type="date" name="date" value="' + iso + '" max="' + iso + '"></div>' +
      '<div class="field"><label for="paid-note">Anything we should know? <span class="opt">(optional)</span></label><input id="paid-note" name="note" placeholder="e.g. Paid from my husband\'s account"></div></div>' +
      '<p class="paid-ref">Did you use your booking reference <b>' + esc(inv.ref) + '</b> as the payment reference? That helps us find it quickly.</p>' +
      '<div class="paid-acts"><button type="button" class="btn btn-ghost" data-paid-cancel>Not yet</button><button type="submit" class="btn btn-green"><svg><use href="#i-check"/></svg>Yes, I have paid</button></div></form>';
    var f = box.querySelector('form');
    f.addEventListener('change', function () { f.querySelector('.paid-other').hidden = f.elements.amt.value !== 'other'; });
    f.querySelector('[data-paid-cancel]').onclick = function () { box.innerHTML = ''; if (done) done(null); };
    f.addEventListener('submit', function (e) {
      e.preventDefault();
      var k = f.elements.amt.value, o = opts.filter(function (x) { return x[0] === k; })[0], amt = k === 'other' ? parseFloat(String(f.elements.other.value).replace(/[^\d.]/g, '')) : o[2];
      if (!amt || amt <= 0) { (K.toast || alert)('Please type the amount you paid'); f.elements.other.focus(); return; }
      var c = { id: 'p' + Date.now().toString(36), ref: inv.ref, at: iso + ' ' + new Date().toTimeString().slice(0, 5), date: f.elements.date.value || iso, amt: Math.round(amt), what: k === 'dep' ? 'Deposit' : k === 'all' ? (inv.paid ? 'Balance' : 'Full payment') : 'Payment', note: f.elements.note.value.trim() };
      var list = K.paidClaims(); list.push(c); try { localStorage.setItem(PAID, JSON.stringify(list.slice(-80))); } catch (er) {}
      box.innerHTML = K.paidThanks(c, inv);
      if (done) done(c);
    });
  };
  K.paidThanks = function (c, inv) {
    return '<div class="paid-thanks"><svg><use href="#i-check"/></svg><div><b>Thank you! You told us you paid ' + money(c.amt) + ' on ' + esc(nice(c.date)) + '.</b><p>We check our bank account and confirm by email, usually within one working day. Want to speed it up? <a href="pop.html?ref=' + encodeURIComponent(inv.ref) + '&email=' + encodeURIComponent((inv.guest && inv.guest.email) || '') + '">Upload your proof of payment</a> (optional).</p></div></div>';
  };
})();
