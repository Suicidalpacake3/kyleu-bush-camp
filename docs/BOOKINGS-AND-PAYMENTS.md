# Making bookings and payments real

The mock-up's booking flow is fully built on the front end: search, live pricing from `content/prices.md`, stand details, guest details, rules, add-ons, payment choice and a confirmation screen. Three things are simulated and need wiring up:

| Simulated now | Where in the code | What replaces it |
|---|---|---|
| **Availability** (which nights are booked) | `fakeBooked()` in `assets/js/booking.js` | Real availability from the booking system |
| **Saving the booking** (guest details) | `confirmBooking()` in `assets/js/booking.js` | Send the booking to the booking system / Kyleu's inbox |
| **Card payment** | The card form in `stay.html` (step 3) | A payment gateway's own secure checkout |

> **Never collect card numbers on our own form in production.** The demo card fields exist only to show the experience. Live payments must go through a gateway's hosted checkout (PayFast, Yoco, Ozow, etc.) so card data never touches Kyleu's site. That keeps Kyleu out of PCI-compliance scope.

---

## Option A — Keep Q2B (fastest, nothing new to pay for)

Kyleu already uses Q2B (`https://www.q2b.co.za/OnlineBooking/OnlineRooms/1504`). Its stand names match ours (Inside 1–7, Stand 1–10, Self-Sufficient 1–6).

1. **Quickest switch:** in `content/settings.md` set `Booking mode: q2b`. The **Reserve** button then opens Q2B in a new tab. Guests still browse and choose a stand on the new site.
2. **Better:** ask Q2B support three questions:
   - Can the online booking page be opened with dates and a stand already selected (URL parameters)?
   - Is there an availability feed (API or iCal per room)? If yes, `fakeBooked()` can read it, and the new site shows real availability.
   - Can the online booking form ask for guest details and take payment (PayFast or similar)? This fixes the "just says reserved" problem.
3. If Q2B can't do these, use Option B or C.

## Option B — WordPress booking plugin (recommended long-term)

Kyleu's hosting already runs WordPress, so a booking plugin gives them an admin calendar, guest details, email confirmations and payments in one place. They can manage it from a phone.

- Set up each stand as a "room" or "accommodation" in the plugin, with Fenced, Unfenced and Self-sufficient as categories.
- Keep the new site's front end. The plugin's REST API (or a small custom endpoint) answers "which stands are free between X and Y". `booking.js` calls it instead of `fakeBooked()` and posts the booking on confirm.
- Plugins worth evaluating: **VikBooking**, **WP Booking Calendar**, **MotoPress Hotel Booking**. Check the current feature list and pricing. Free tiers often lack payments or some features.

## Option C — Simple request + invoice flow (zero cost, works tomorrow)

This matches Kyleu's current policy: invoice, then 50% deposit within 5 days.

- On confirm, send the booking details to Kyleu's inbox with a free form service. **Web3Forms** or **Formspree** need only an access key and no server. On WordPress, use **Contact Form 7 + Flamingo** (both free) to also keep a copy in wp-admin.
- Kyleu checks the calendar, confirms and sends the invoice as they do now.
- Add a **PayFast / Yoco payment link** to the invoice email so guests can pay the deposit by card or Instant EFT.
- The "Send me an invoice" payment option on the site is exactly this flow.

## Payments (South Africa)

There is no truly free card processing. Every gateway charges a fee per transaction, but the options below have **no monthly fee**. Check current rates before choosing.

- **PayFast:** cards, Instant EFT, SnapScan, Zapper and more. Hosted checkout. Widely used by SA accommodation and WordPress sites.
- **Yoco:** online payment links and checkout. Good if Kyleu also wants a card machine at reception for wood and ice sales.
- **Ozow:** Instant EFT only, bank-to-bank, usually cheaper than cards.

The pay buttons in `confirmBooking()` would redirect to the gateway with the amount and booking reference. The gateway's notify/return URL confirms payment back to the booking system.

## Suggested path

1. **Now (free):** Option C plus a PayFast or Yoco payment link. Guests get a polished booking experience, Kyleu gets every guest's details by email, and deposits can be paid online.
2. **Next:** ask Q2B about the availability feed (Option A, step 2). If it exists, wire it in for real-time availability.
3. **If Q2B can't:** move to a WordPress booking plugin (Option B) and retire the fake availability.
