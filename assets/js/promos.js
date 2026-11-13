/* =========================================================
   Promotions and guided game drives: the rules shared by the website booking and the admin.
   Staff set both up in the admin (Promotions, and Game drives > When the guide is here).
   Demo: the admin hands them to the website through this browser ("kyleu-web-content").
   Live: the booking system holds them.

   A promotion:
     { id, name, blurb (one line guests see), on,
       bookFrom, bookTo   (yyyy-mm-dd, optional: the day the booking is made),
       stayFrom, stayTo   (optional: the arrival day),
       minNights, maxNights (optional),
       days: 'any' | 'weekend' (the stay has a weekend night) | 'weekday' (it has none),
       areas: ['fenced', 'unfenced', 'self-sufficient'] (optional, empty = all),
       needDrive: true (a game drive is booked with the stay),
       needItem: { label, qty } (a camp shop item bought with the booking),
       code: 'SUMMER' (optional: only with this code),
       reward: { kind: 'pctStay' | 'amtStay' | 'pctDrive' | 'freeItem' | 'freeNight', value, item, qty },
       combine: true (may be added on top of another promotion) }

   Game drives:
     { on (guests can add a drive when they book online), seats, minAge,
       times: [{ id: 'am', label: 'Morning drive', at: '06:00' }],
       days: { 'yyyy-mm-dd': { am: seats still open, pm: seats still open } } }
   ========================================================= */
(function () {
  'use strict';
  var K = window.Kyleu = window.Kyleu || {};
  function web() { try { return JSON.parse(localStorage.getItem('kyleu-web-content') || 'null') || {}; } catch (e) { return {}; } }
  function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function money(n) { return K.money ? K.money(Math.round(n)) : 'R' + Math.round(n); }

  /* ---------- promotions ---------- */
  K.promoList = function () { return (web().promos || []).filter(function (p) { return p && p.on !== false && p.reward; }); };
  // promotions a guest can be told about today (running now, no secret code)
  K.promoShown = function (list, today) { return (list || K.promoList()).filter(function (p) { return !p.code && (!p.bookFrom || p.bookFrom <= today) && (!p.bookTo || p.bookTo >= today); }); };
  // what the reward is worth for this booking, or null when the booking does not qualify
  // c: { today, ci, nights, wkN, area, stay, nightAmts: [what each night costs for the group], driveTotal, drives: n, shop: { label: qty }, prices: { label: each }, code }
  function worth(p, c) {
    if (p.on === false || !p.reward) return null;
    if ((p.bookFrom && c.today < p.bookFrom) || (p.bookTo && c.today > p.bookTo)) return null;
    if ((p.stayFrom && c.ci < p.stayFrom) || (p.stayTo && c.ci > p.stayTo)) return null;
    if ((p.minNights && c.nights < p.minNights) || (p.maxNights && c.nights > p.maxNights)) return null;
    if (p.days === 'weekend' && !c.wkN) return null;
    if (p.days === 'weekday' && c.wkN) return null;
    if (p.areas && p.areas.length && p.areas.indexOf(c.area) < 0) return null;
    if (p.needDrive && !c.drives) return null;
    if (p.needItem && p.needItem.label && ((c.shop || {})[p.needItem.label] || 0) < (p.needItem.qty || 1)) return null;
    if (p.code && key(p.code) !== key(c.code)) return null;
    var r = p.reward, v = +r.value || 0, out = { id: p.id, name: p.name || 'Promotion', amt: 0, free: [], worth: 0, combine: !!p.combine };
    if (r.kind === 'pctStay') out.amt = Math.round(c.stay * Math.min(100, v) / 100);
    else if (r.kind === 'amtStay') out.amt = Math.min(Math.round(v), c.stay);
    else if (r.kind === 'pctDrive') { if (!c.driveTotal) return null; out.amt = Math.round(c.driveTotal * Math.min(100, v) / 100); out.onDrive = true; }
    else if (r.kind === 'freeNight') { var n = Math.max(1, Math.round(v || 1)); if (c.nights <= n) return null; out.amt = Math.round((c.nightAmts || []).slice().sort(function (a, b) { return a - b; }).slice(0, n).reduce(function (a, x) { return a + x; }, 0)); out.nights = n; }
    else if (r.kind === 'freeItem') { if (!r.item) return null; var q = Math.max(1, +r.qty || 1); out.free = [{ label: r.item, qty: q }]; out.worth = q * (((c.prices || {})[r.item]) || 0); }
    else return null;
    if (out.amt) out.worth = out.amt;
    if (!out.amt && !out.free.length) return null;
    return out;
  }
  // the promotions this booking gets: the best one for the guest, plus any that may be combined
  K.promoEval = function (list, c) {
    var hits = (list || []).map(function (p) { return worth(p, c); }).filter(Boolean), solo = hits.filter(function (h) { return !h.combine; }).sort(function (a, b) { return b.worth - a.worth; });
    var got = (solo.length ? [solo[0]] : []).concat(hits.filter(function (h) { return h.combine; }));
    var cap = (c.stay || 0) + (c.driveTotal || 0), total = 0;
    got.forEach(function (h) { if (total + h.amt > cap) h.amt = Math.max(0, cap - total); total += h.amt; });
    return { list: got, total: total, free: got.reduce(function (a, h) { return a.concat(h.free.map(function (f) { return { label: f.label, qty: f.qty, promo: h.id, name: h.name }; })); }, []) };
  };
  // one short line about a promotion's reward, for lists and summaries
  K.promoRewardText = function (p) {
    var r = (p && p.reward) || {}, v = +r.value || 0;
    return r.kind === 'pctStay' ? v + '% off your stay' : r.kind === 'amtStay' ? money(v) + ' off your stay' : r.kind === 'pctDrive' ? v + '% off your game drive'
      : r.kind === 'freeNight' ? (v > 1 ? v + ' nights free' : '1 night free') : r.kind === 'freeItem' ? (Math.max(1, +r.qty || 1)) + ' × ' + r.item + ' free' : '';
  };

  /* ---------- guided game drives ---------- */
  K.driveInfo = function () { var d = web().drives; return d && d.on && d.times && d.times.length ? d : null; };
  // seats still open on a drive: what the admin says, less website bookings it has not taken in yet
  K.driveSeats = function (D, day, tid) {
    var left = ((D.days || {})[day] || {})[tid]; if (left == null) return 0;
    var db = null, list = []; try { db = JSON.parse(localStorage.getItem('kyleu-admin-demo-v1') || 'null'); list = JSON.parse(localStorage.getItem('kyleu-web-bookings') || '[]') || []; } catch (e) {}
    var have = {}; ((db && db.bookings) || []).forEach(function (b) { have[key(b.ref)] = 1; });
    list.forEach(function (w) { if (w && !have[key(w.ref)]) (w.drives || []).forEach(function (x) { if (x.day === day && x.tid === tid) left -= (+x.people || 0); }); });
    return Math.max(0, left);
  };
  // the drives a guest staying from ci to co can join (both days included), soonest first
  K.driveSlots = function (D, ci, co) {
    var out = []; if (!D) return out;
    Object.keys(D.days || {}).sort().forEach(function (day) {
      if (day < ci || day > co) return;
      D.times.forEach(function (t) { if (((D.days[day] || {})[t.id]) == null) return; out.push({ day: day, tid: t.id, label: t.label, at: t.at, left: K.driveSeats(D, day, t.id) }); });
    });
    return out;
  };
  K.driveNext = function (D, from) { return D ? Object.keys(D.days || {}).sort().filter(function (d) { return d >= from; })[0] || '' : ''; };
  // price for a number of people on one drive (content/prices.md, "Game drives"): 3 or more, 2, or 1
  K.drivePrice = function (P, n) {
    if (!P || n < 1) return 0;
    var g3 = P.num('Game drives', 'Game drive 3 or more people per person', 400), g2 = P.num('Game drives', 'Game drive 2 people per person', 450), g1 = P.num('Game drives', 'Game drive 1 person', 900);
    return n >= 3 ? n * g3 : n === 2 ? 2 * g2 : g1;
  };
})();
