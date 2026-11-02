/* =========================================================
   Kyleu invoices and quotes: one look everywhere
   - K.invoiceHTML(inv): the invoice on the website and in the admin
   - K.invoicePDF(inv): the same invoice as a PDF (jsPDF), for email and download
   - K.paidForm(box, inv, done): "I have paid" for guests
   inv = { kind: 'Invoice'|'Quote', no, date, ref, guest: {name, email, phone},
           stay: {stand, ci, co, nights, guests, vehicles}, lines: [{t, amt, q, u, tag, free}],
           total, paid, deposit, depPct, depositDue, balanceDue, payFull, cancelled, validTo, note }
   Holds everything Kyleu's old Q2B quote showed (registration number, postal address,
   bank details with SWIFT, check-in and check-out times, the camp rules), in the site's style.
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

  // business and bank details (from Kyleu's own quote); content/settings.md can change every one
  var BIZ = { name: 'Kyleu Bush Camp', tag: 'Dinokeng Big 5 Game Reserve', reg: '2017/102130/07',
    addr: 'Plot 77 Klipdrift 90-JR, Kaallaagte Road, Dinokeng Game Reserve', postal: 'PO Box 1186, Faerie Glen, Pretoria, 0043',
    phone: '060 458 4478', email: 'info@kyleu.co.za', web: 'www.kyleu.co.za',
    bank: 'FNB (First National Bank)', accName: 'Kyleu Bush Camp', accNo: '62699453868', branch: '250655', accType: 'Current', swift: 'FIRNZAJJ',
    checkIn: '13:00', checkOut: '11:00', signer: 'Sherri Symons' };
  K.BIZ = BIZ;
  if (K.settings) K.settings().then(function (S) {
    if (!S) return;
    [['bank', 'Bank'], ['accName', 'Account name'], ['accNo', 'Account number'], ['branch', 'Branch code'], ['accType', 'Account type'], ['swift', 'SWIFT code'],
     ['reg', 'Company registration'], ['postal', 'Postal address'], ['checkIn', 'Check-in time'], ['checkOut', 'Check-out time'], ['signer', 'Invoices signed by'], ['phone', 'Phone'], ['email', 'Email']]
      .forEach(function (x) { var v = S.get(x[1], ''); if (v) BIZ[x[0]] = v; });
  }).catch(function () {});
  function notes() {
    return ['Check-in from ' + BIZ.checkIn + ' · check-out by ' + BIZ.checkOut + '.',
      'Please note our Terms & Conditions, on our website (kyleu.co.za/policies.html).',
      'Camping at Kyleu Bush Camp is ENTIRELY AT YOUR OWN RISK: wild animals roam freely.',
      'There is no electricity anywhere in the bush camp (fenced and unfenced).',
      'Cancellations are not refunded; what you paid is kept as a credit for another stay.',
      'Dinokeng Game Reserve fees are paid to the reserve, not to Kyleu.'];
  }

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
  function stayRows(inv) {
    var s = inv.stay || {}, o = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
    return [['Booking', inv.ref], ['Stand', s.stand], ['Arrive', s.ci ? nice(s.ci, o) + ', from ' + BIZ.checkIn : ''], ['Depart', s.co ? nice(s.co, o) + ', by ' + BIZ.checkOut : ''], ['Nights', s.nights], ['Guests', s.guests], ['Vehicles', s.vehicles]]
      .filter(function (r) { return r[1] !== undefined && r[1] !== ''; });
  }
  function totals(inv, st) {
    var r = [['Total', money(inv.total), 'total']];
    if (st.k === 'quote' || (!inv.paid && !inv.payFull && st.k === 'due')) r.push(['Deposit ' + (inv.depPct || 50) + '%', money(inv.deposit), '']);
    if (st.k !== 'quote') r.push(['Total payment received', (inv.paid ? '-' : '') + money(inv.paid || 0), '']);
    if (st.k !== 'quote' && st.k !== 'cancel') r.push([st.bal ? 'Balance due' : 'Balance', money(st.bal), 'due']);
    return r;
  }
  function bankRows() { return [['Account name', BIZ.accName], ['Bank', BIZ.bank], ['Account number', BIZ.accNo], ['Branch code', BIZ.branch], ['Account type', BIZ.accType], ['SWIFT', BIZ.swift]].filter(function (r) { return r[1]; }); }
  var THANKS = 'Kyleu management thanks you in advance for respecting the rules and abiding by them. We hope you have an enjoyable stay!';
  K.invoiceState = state;
  K.invoiceName = function (inv) { return 'Kyleu ' + inv.kind.toLowerCase() + ' ' + inv.no + '.pdf'; };
  K.invoiceNo = function (ref, kind, n) { return (kind === 'Quote' ? 'Q-' : 'INV-') + String(ref).replace(/^KY/i, '') + '-' + (n || 1); };

  /* ---------- on screen ---------- */
  K.invoiceHTML = function (inv) {
    var st = state(inv), g = inv.guest || {}, rows = schedule(inv), hasQ = inv.lines.some(function (l) { return l.q; });
    return '<article class="inv inv-' + st.k + '">' +
      '<header class="inv-hero" style="background-image:url(\'' + BASE + 'assets/img/photos/camp-panorama.jpg\')"><div class="inv-brand"><img src="' + BASE + 'assets/img/logo-small.png" alt="Kyleu Bush Camp logo"><div><b>' + esc(BIZ.name) + '</b><small>' + esc(BIZ.tag) + '</small></div></div>' +
      '<div class="inv-title"><span class="inv-kind">' + esc(inv.kind) + '</span><b>' + esc(inv.no) + '</b><small>' + esc(nice(inv.date)) + '</small></div></header>' +
      '<div class="inv-biz"><span>' + esc(BIZ.addr) + '<br>' + esc(BIZ.postal) + '</span><span>Reg. ' + esc(BIZ.reg) + '<br>' + esc(BIZ.phone) + ' · ' + esc(BIZ.email) + ' · ' + esc(BIZ.web) + '</span></div>' +
      '<div class="inv-status">' + esc(st.t) + '</div>' +
      '<div class="inv-parties"><div><h4>' + (inv.kind === 'Quote' ? 'Prepared for' : 'Billed to') + '</h4><b>' + esc(g.name) + '</b>' + (g.email ? '<span>' + esc(g.email) + '</span>' : '') + (g.phone ? '<span>' + esc(g.phone) + '</span>' : '') + '</div>' +
      '<div><h4>Your stay</h4><dl>' + stayRows(inv).map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl></div></div>' +
      '<table class="inv-lines' + (hasQ ? ' with-q' : '') + '"><thead><tr>' + (hasQ ? '<th class="q">Qty</th>' : '') + '<th>Description</th>' + (hasQ ? '<th class="u">Unit price</th>' : '') + '<th>Total</th></tr></thead><tbody>' +
      inv.lines.map(function (l) { return '<tr>' + (hasQ ? '<td class="q">' + (l.q || '') + '</td>' : '') + '<td>' + esc(l.t) + '</td>' + (hasQ ? '<td class="u">' + (l.u != null && !l.free ? money(l.u) : '') + '</td>' : '') + '<td>' + (l.free ? 'Free' : (l.amt < 0 ? '&minus;' : '') + money(Math.abs(l.amt))) + '</td></tr>'; }).join('') + '</tbody>' +
      '<tfoot>' + totals(inv, st).map(function (r) { return '<tr class="inv-' + r[2] + '"><td colspan="' + (hasQ ? 3 : 1) + '">' + r[0] + '</td><td>' + r[1].replace(/^-/, '&minus;') + '</td></tr>'; }).join('') + '</tfoot></table>' +
      (st.k === 'due' || st.k === 'quote' ? '<div class="inv-pay"><div><h4>When to pay</h4>' + (rows.length ? '<ul>' + rows.map(function (r) { return '<li><span>' + esc(r[0]) + '<small>' + esc(r[2]) + '</small></span><b>' + esc(r[1]) + '</b></li>'; }).join('') + '</ul>' : '') +
        (st.k === 'due' ? '<p class="inv-paidtip">Paid? Press <b>I have paid</b> on the website (under Change my booking) or upload your proof of payment at kyleu.co.za/pop.html.</p>' : '') + '</div>' +
        '<div class="inv-bank"><h4>Our bank details</h4><dl>' + bankRows().map(function (r) { return '<dt>' + r[0] + '</dt><dd>' + esc(r[1]) + '</dd>'; }).join('') + '</dl><p class="inv-refbox">Use reference <b>' + esc(inv.ref) + '</b></p></div></div>' : '') +
      (inv.note ? '<p class="inv-note inv-own">' + esc(inv.note) + '</p>' : '') +
      '<div class="inv-notes"><h4>Please note</h4><ul>' + notes().map(function (n) { return '<li>' + esc(n).replace('ENTIRELY AT YOUR OWN RISK', '<b>ENTIRELY AT YOUR OWN RISK</b>') + '</li>'; }).join('') + '</ul></div>' +
      '<p class="inv-thanks">' + esc(THANKS) + '</p>' +
      '<p class="inv-sign">Kind regards,<br><b>' + esc(BIZ.signer) + '</b> · ' + esc(BIZ.phone) + ' · ' + esc(BIZ.email) + '</p>' +
      '<div class="inv-dgr"><img src="' + BASE + 'assets/img/dgr-certified-partner.png" alt="DGR Certified Partner logo"><p><b>Kyleu is a proud DGR CP member.</b> Guests staying at this DGR CP campsite qualify for Conservation Fee Discount Vouchers: R85 instead of R100 per adult per night. We send you one voucher code per vehicle before your stay.</p></div>' +
      '<footer class="inv-foot">' + esc(BIZ.name) + ' · Reg. ' + esc(BIZ.reg) + ' · ' + esc(BIZ.addr) + ' · ' + esc(BIZ.phone) + ' · ' + esc(BIZ.email) + ' · ' + esc(BIZ.web) + '</footer></article>';
  };

  /* ---------- PDF ---------- */
  var IMG = {};
  // pictures go into the PDF as small JPEGs, so an emailed invoice stays light; crop = width / height wanted
  function toData(src, w, crop) {
    return new Promise(function (ok, no) {
      var im = new Image(); im.onload = function () {
        var sw = im.width, sh = im.height, sx = 0, sy = 0;
        if (crop) { if (sw / sh > crop) { sx = (sw - sh * crop) / 2; sw = sh * crop; } else { sy = (sh - sw / crop) * .55; sh = sw / crop; } }
        var c = document.createElement('canvas'), sc = Math.min(1, w / sw); c.width = Math.round(sw * sc); c.height = Math.round(sh * sc);
        var x = c.getContext('2d'); x.fillStyle = '#fffdf8'; x.fillRect(0, 0, c.width, c.height); x.drawImage(im, sx, sy, sw, sh, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', crop ? .72 : .9));
      }; im.onerror = no; im.src = src;
    });
  }
  K.invoiceAssets = function () {
    if (IMG.p) return IMG.p;
    IMG.p = Promise.all([
      toData(BASE + 'assets/img/logo-small.png', 220).then(function (d) { IMG.kyleu = d; }),
      toData(BASE + 'assets/img/dgr-certified-partner.png', 400).then(function (d) { IMG.dgr = d; }),
      toData(BASE + 'assets/img/photos/camp-panorama.jpg', 900, 210 / 30).then(function (d) { IMG.photo = d; })
    ]).catch(function () {});
    return IMG.p;
  };
  K.invoiceAssets();
  function clean(s) { return String(s == null ? '' : s).replace(/[   ]/g, ' ').replace(/[‘’]/g, "'").replace(/[“”]/g, '"').replace(/−/g, '-').replace(/[^\x09\x0a\x0d\x20-\xff]/g, ''); }
  var C = { bark: [42, 27, 18], sun: [232, 115, 28], ember: [184, 70, 26], soft: [110, 95, 80], line: [230, 217, 195], sand: [248, 241, 229], ok: [63, 125, 58], okbg: [232, 243, 228], due: [253, 240, 217], bad: [178, 58, 42], white: [255, 255, 255] };
  K.invoiceDraw = function (doc, inv) {
    var L = 14, R = 196, W = R - L, y = 0, st = state(inv), g = inv.guest || {}, hasQ = inv.lines.some(function (l) { return l.q; });
    var font = function (size, bold, c) { doc.setFont('helvetica', bold ? 'bold' : 'normal'); doc.setFontSize(size); c = c || C.bark; doc.setTextColor(c[0], c[1], c[2]); };
    var text = function (t, x, yy, o) { doc.text(Array.isArray(t) ? t.map(clean) : clean(t), x, yy, o); };
    var fill = function (c) { doc.setFillColor(c[0], c[1], c[2]); };
    var need = function (h) { if (y + h > 280) { doc.addPage(); y = 16; } };
    // photo band with the logo, like the old quote
    var H = 30;
    if (IMG.photo) { try { doc.addImage(IMG.photo, 'JPEG', 0, 0, 210, H); } catch (e) {} } else { fill(C.bark); doc.rect(0, 0, 210, H, 'F'); }
    try { doc.setGState(new doc.GState({ opacity: .5 })); fill([20, 12, 6]); doc.rect(0, 0, 210, H, 'F'); doc.setGState(new doc.GState({ opacity: 1 })); } catch (e) {}
    fill(C.sun); doc.rect(0, H, 210, 1.6, 'F');
    if (IMG.kyleu) { fill(C.white); doc.circle(L + 12, 15, 11, 'F'); try { doc.addImage(IMG.kyleu, 'JPEG', L + 2.5, 7.3, 19, 15.3); } catch (e) {} }
    font(17, true, C.white); text(BIZ.name, L + 28, 13.5); font(9, false, C.white); text(BIZ.tag, L + 28, 19); font(8, false, C.white); text('Reg. ' + BIZ.reg, L + 28, 24);
    font(23, true, C.white); text(inv.kind.toUpperCase(), R, 13.5, { align: 'right' });
    font(10, true, C.white); text(inv.no, R, 20, { align: 'right' }); font(8.5, false, C.white); text(nice(inv.date), R, 25, { align: 'right' });
    y = H + 6.5;
    font(7.8, false, C.soft); text(BIZ.addr, L, y); text(BIZ.phone + ' · ' + BIZ.email + ' · ' + BIZ.web, R, y, { align: 'right' }); y += 3.8; text(BIZ.postal, L, y); y += 3.5;
    // status band
    fill(st.k === 'paid' ? C.okbg : st.k === 'due' ? C.due : C.sand); doc.roundedRect(L, y, W, 9.5, 2, 2, 'F');
    font(10.5, true, st.k === 'paid' ? C.ok : st.k === 'cancel' ? C.bad : C.ember); text(st.t, L + 4, y + 6.3); y += 14.5;
    // who and what
    var top = y;
    font(7.5, true, C.soft); text(inv.kind === 'Quote' ? 'PREPARED FOR' : 'BILLED TO', L, y); y += 5.5;
    font(11.5, true); text(g.name || '', L, y); y += 5.3;
    font(9.5, false, C.soft); if (g.email) { text(g.email, L, y); y += 4.8; } if (g.phone) { text(g.phone, L, y); y += 4.8; }
    var yy = top; font(7.5, true, C.soft); text('YOUR STAY', 108, yy); yy += 5.5;
    stayRows(inv).forEach(function (r) { font(8.5, false, C.soft); text(r[0], 108, yy); font(9.3, true); text(String(r[1]), 128, yy); yy += 4.5; });
    y = Math.max(y, yy) + 3.5;
    // lines: Qty | Description | Unit price | Total
    var xD = hasQ ? L + 16 : L + 4, xU = R - 34, dW = (hasQ ? xU - 6 : R - 30) - xD;
    fill(C.bark); doc.roundedRect(L, y, W, 7.5, 1.5, 1.5, 'F'); font(7.8, true, C.white);
    if (hasQ) text('QTY', L + 4, y + 5); text('DESCRIPTION', xD, y + 5); if (hasQ) text('UNIT PRICE', xU, y + 5, { align: 'right' }); text('TOTAL', R - 4, y + 5, { align: 'right' }); y += 7.5;
    inv.lines.forEach(function (l, i) {
      font(9.3); var ls = doc.splitTextToSize(clean(l.t), dW), h = ls.length * 4.4 + 3.6; need(h);
      if (i % 2) { fill(C.sand); doc.rect(L, y, W, h, 'F'); }
      if (hasQ && l.q) text(String(l.q), L + 4, y + 5); text(ls, xD, y + 5);
      if (hasQ && l.u != null && !l.free) text(money(l.u), xU, y + 5, { align: 'right' });
      text(l.free ? 'Free' : (l.amt < 0 ? '-' : '') + money(Math.abs(l.amt)), R - 4, y + 5, { align: 'right' }); y += h;
    });
    doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.setLineWidth(.3); doc.line(L, y, R, y); y += 6;
    totals(inv, st).forEach(function (r) { var strong = r[2] === 'total' || r[2] === 'due'; need(7); font(strong ? 10.8 : 9.3, strong, r[2] === 'due' ? (st.bal ? C.ember : C.ok) : C.bark); text(r[0], 150, y, { align: 'right' }); text(r[1], R - 4, y, { align: 'right' }); y += strong ? 6.5 : 5.4; });
    y += 3;
    // when to pay + bank details
    if (st.k === 'due' || st.k === 'quote') {
      var bh = 43; need(bh + 4); var bx = y;
      fill(C.sand); doc.roundedRect(L, bx, 88, bh, 2, 2, 'F'); doc.roundedRect(106, bx, 90, bh, 2, 2, 'F');
      font(7.5, true, C.soft); text('WHEN TO PAY', L + 4, bx + 6.5); text('OUR BANK DETAILS', 110, bx + 6.5);
      var ry = bx + 13; schedule(inv).forEach(function (r) { font(9.5, true); text(r[0], L + 4, ry); text(r[1], L + 84, ry, { align: 'right' }); font(8, false, C.soft); text(r[2], L + 4, ry + 4.2); ry += 10; });
      if (st.k === 'due') { font(7.6, false, C.soft); text(doc.splitTextToSize(clean('Paid? Press "I have paid" under Change my booking on kyleu.co.za, or upload your proof of payment at kyleu.co.za/pop.html.'), 80), L + 4, bx + 32.5); }
      ry = bx + 11.5; bankRows().forEach(function (r) { font(8.3, false, C.soft); text(r[0], 110, ry); font(8.8, true); text(r[1], 138, ry); ry += 4; });
      fill(C.sun); doc.roundedRect(110, bx + bh - 8.5, 82, 5.5, 1, 1, 'F'); font(8.5, true, C.white); text('Use reference ' + inv.ref, 151, bx + bh - 4.6, { align: 'center' });
      y = bx + bh + 5;
    }
    if (inv.note) { font(9.5, true); var nl = doc.splitTextToSize(clean(inv.note), W); need(nl.length * 4.4 + 3); text(nl, L, y); y += nl.length * 4.4 + 3; }
    // please note (the camp rules from the old quote)
    need(32); font(7.5, true, C.soft); text('PLEASE NOTE', L, y); y += 4.8;
    notes().forEach(function (n) { font(8.4, /OWN RISK/.test(n), /OWN RISK/.test(n) ? C.bark : C.soft); var ls = doc.splitTextToSize(clean(n), W - 5); need(ls.length * 3.7); fill(C.sun); doc.circle(L + 1.6, y - 1.1, .65, 'F'); text(ls, L + 5, y); y += ls.length * 3.7 + .2; });
    y += 2; font(8.6, true); var tl = doc.splitTextToSize(THANKS, W); need(tl.length * 4.2 + 12); text(tl, L, y); y += tl.length * 4.2 + 1;
    font(8.6, false, C.soft); text('Kind regards, ' + BIZ.signer + ' · ' + BIZ.phone + ' · ' + BIZ.email, L, y); y += 4.5;
    // DGR CP: approved logo on a light background with clear space around it
    need(14);
    if (IMG.dgr) try { doc.addImage(IMG.dgr, 'JPEG', L, y, 29, 10.9); } catch (e) {}
    font(8.6, true); text('Kyleu is a proud DGR CP member.', L + 40, y + 3.4);
    font(8, false, C.soft); text(doc.splitTextToSize('Guests staying at this DGR CP campsite qualify for Conservation Fee Discount Vouchers: R85 instead of R100 per adult per night. We send you one voucher code per vehicle before your stay.', W - 40).map(clean), L + 40, y + 7.4);
    // footer on every page
    var n = doc.getNumberOfPages();
    for (var i = 1; i <= n; i++) { doc.setPage(i); doc.setDrawColor(C.line[0], C.line[1], C.line[2]); doc.line(L, 285, R, 285); font(7, false, C.soft); text(BIZ.name + ' · Reg. ' + BIZ.reg + ' · ' + BIZ.phone + ' · ' + BIZ.email + ' · ' + BIZ.web + (n > 1 ? ' · page ' + i + ' of ' + n : ''), 105, 290, { align: 'center' }); }
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
