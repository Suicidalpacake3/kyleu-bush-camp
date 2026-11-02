# Kyleu Bush Camp: website (mock-up)

A fast, static website (plain HTML, CSS and JavaScript) for Kyleu Bush Camp in the Dinokeng Big 5 Game Reserve. It needs no database or build step, and it runs on GitHub Pages, any normal web hosting, or next to WordPress.

**Booking is a demo.** Guests can search, pick a stand, enter details and "pay", but nothing is sent or charged, and availability is simulated. See [docs/BOOKINGS-AND-PAYMENTS.md](docs/BOOKINGS-AND-PAYMENTS.md) for how to make it live.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Home (kept calm on purpose): one slowly drifting photo, intro, DGR CP (Dinokeng Game Reserve Certified Partner) badge, family story, camp areas (each links to its stand photos), why campers come back, FAQ |
| `experience.html` | Experience Kyleu: scroll-animated "day at Kyleu" map, what campers love, guest stories (links in `content/settings.md` under "Guest stories"), camp news (only shows when there are posts) |
| `stands.html` | Our stands: photos and details of every stand, grouped by area, each with "Book this stand" |
| `stay.html` | Book now: dates, who is coming, camp area, stand, then only the contact details (name, email, mobile) and the terms. After booking the guest sees the invoice and the private link to their booking. Vehicles, passengers, arrival time and camp shop come later, when the guest finalises the booking after paying in full |
| `discover.html` | Everything from the old "Discover Kyleu" menu on one page, with sticky shortcuts: camp areas, site layout, rates, game drives, camp shop, plan & FAQ |
| `dinokeng.html` | Everything about the reserve, kept apart from Kyleu: what Dinokeng is, Big 5 wildlife, reserve fees, things to do |
| `contact.html` | Map (no API key needed), turn-by-turn directions, contact details, message form |
| `news.html` | Blog / camp news (list plus single post via `news.html?post=…`) |
| `policies.html` | Terms, payment & cancellation, privacy (POPIA), PAIA manual |
| `admin/` | Staff admin MOCK-UP (kyleu.co.za/admin), grouped like hotel software: Front desk (dashboard, bookings, calendar, inbox with full email threads, guests), Money (EFT payments with proof of payment, payments ledger and money still owed, reports), Shop & activities (till with sales history and refunds, game drive schedule, products with stock), Setup (stands with photos, rates & fees in tabs, settings). Uses made-up demo data saved only in the browser; bookings and proof of payment sent from the website demo show up here too. Hidden from search engines. |
| `manage.html` | The guest's own booking page, opened from their private link (`manage.html?b=REF&k=KEY`, emailed with the invoice and when the booking is paid). There is no menu button for it. **Not paid in full:** "Amend your booking": I have paid, number of guests, contact details. **Paid in full:** "Finalise your booking": vehicles and who is in each one, arrival time, camp shop (and porta potty on R stands), number of guests, contact details, a message. Adding people after paying in full puts the booking back to waiting for payment with a new invoice for the extra. From 7 days before arrival the number of guests can only be changed by WhatsApp or email. Staff see everything on the booking in the admin, can send or copy the link, open it as the guest, fill the details in themselves and mark the booking finalised. Without a link, guests can still type their reference plus email or mobile. |
| `pop.html` | "Send proof of payment" page: guests who paid by EFT upload their bank proof with their booking reference, and it lands on the booking in the admin (no emailing needed). Demo: kept in the browser only. |

**One price for everyone:** `content/prices.md` holds the price. "Card payment fee percentage" is kept at 0, so guests never pay the card company's fee. Guests pay by EFT for now; when a payment provider is connected, set "Online payments: on" in `content/settings.md` and the prices stay the same.

**Dinokeng:** the reserve's fees (effective 1 July 2026) are in `content/prices.md`. Kyleu is a DGR CP (Dinokeng Game Reserve Certified Partner) member, so guests qualify for Conservation Fee Discount Vouchers: staff make one voucher code per vehicle on the Dinokeng site, paste the codes on the booking in the admin and send them to the client by WhatsApp or email (Dinokeng does not send them). Guests then pay R85 instead of R100 per adult per night.

**Invoices and quotes:** every website booking gets an invoice straight away, in the site's colours (the same design on the website, in the admin and as a PDF; `assets/js/invoice.js`). The guest sees "Invoice sent by email" and the invoice on screen, can download or print it and press **I have paid** (there, or later under Change my booking). Staff then see "says they paid" on the booking and confirm it with one click. Changes that alter the price (camp shop, more guests) email an updated invoice. In the admin, each booking lists its invoices and quotes; staff can make a new invoice or quote and change amounts or add lines (a discount is a minus amount) until a payment is made, after which prices are locked. It follows Kyleu's old Q2B quote: registration number, postal address, Qty / Unit price / Total lines, deposit and payment received, bank details with SWIFT, check-in 13:00 and check-out 11:00, and the camp rules. Bank details, registration, times and the signature are in `content/settings.md`. Demo: nothing is really emailed.

**DGR CP:** Dinokeng asks partners to say "DGR CP" and to call the codes "Conservation Fee Discount Vouchers"; the site, invoices and admin now do. The logo is the approved dark green version, on a light background with clear space around it and no effects (Dinokeng logo guide).

**Cancellations:** no refunds; what the guest paid is kept as a credit (the admin records it and offers it on the guest's next booking).

## For the Kyleu team: updating the site

All the everyday content lives in the **`content`** folder as simple text files. Open them in Notepad, change the text and save. The website updates itself.

| To change… | Edit this file |
|---|---|
| **Any price or fee** (camping rates, Dinokeng fees, game drives, wood, ice…) | `content/prices.md` |
| **Stands**: add a new stand, change details, hide one, update photos | `content/stands.md` (photos go in `assets/img/stands/<stand folder>/`) |
| **Blog posts / camp news** | `content/blog.md` (newest at the top; a template is at the bottom) |
| **Phone, email, WhatsApp, links** | `content/settings.md` |

Each file has instructions at the top. Lines starting with `>` are notes and don't show on the site.

**The maps:** the camp map and the "A day at Kyleu" scroll map are edited in the admin under **Settings > Maps**. Staff can move campsites, text and buildings, draw roads and footpaths, add new campsites, and change the game drive route and the scroll map's story. In the demo, "Save to website" updates the maps in that browser. To publish for everyone, press "Download map file" and replace `assets/js/campmap-layout.js` with the downloaded file (the live version can save it on the server instead).

**Camp news from the admin:** posts can also be written under **Camp news** in the admin. In the demo they show on the website in the same browser; "Copy as blog.md text" gives the text to paste into `content/blog.md`.

**Adding stand photos:** use landscape photos (wider than tall) at least 1200px wide. Save them as `1.jpg`, `2.jpg` and so on in the stand's folder, and list them after `Photos:` in `stands.md`.

## Previewing on your computer

Double-click **`Preview website.bat`**. It starts a small local web server and opens the site at http://localhost:8090. Opening the `.html` files directly won't load prices or stands, because browsers block reading the `content` files from a plain folder.

## Putting it on GitHub Pages (for the client preview)

1. Create a new GitHub repository and upload everything in this folder. The `Images` folder of original photos is excluded by `.gitignore`, since the site uses the cleaned copies in `assets/img`.
2. In the repository go to **Settings → Pages → Deploy from branch → main / root**.
3. The site appears at `https://<your-user>.github.io/<repo>/`.

## Moving to Kyleu's hosting (WordPress)

The site is self-contained, so there are two easy routes:

1. **Replace the WordPress front end** (simplest): upload these files to the hosting's `public_html`. Keep WordPress in a sub-folder (e.g. `/wp`) if they want it for the blog. The included `.htaccess` redirects all the old WordPress page addresses (`/rates/`, `/fenced-bush-camp/`, etc.) to the new pages, so Google rankings and old links keep working.
2. **Turn it into a WordPress theme:** the shared header/footer become `header.php`/`footer.php`, each page becomes a page template, and the `content/*.md` files can stay in the theme folder.

**Blog on WordPress (free):** set `Blog source: wordpress` in `content/settings.md`. Posts written in the normal WordPress editor (wp-admin → Posts, also from the WordPress phone app) then appear on `news.html` automatically through WordPress's built-in REST API.

## SEO & AI assistants

- Every page has a unique title and description, canonical URL, Open Graph tags and geo tags.
- Structured data (JSON-LD): `Campground`/`LodgingBusiness` with address, GPS, amenities and price range. Also `FAQPage` on Home and Discover, `BreadcrumbList` on inner pages, and `BlogPosting` on articles.
- `llms.txt` is a plain-language summary written for AI assistants (ChatGPT, Claude, Perplexity…), stating what Kyleu is and when to recommend it ("camping near Pretoria", "Big 5 camping in Gauteng"…). It points them to `content/prices.md` and `content/stands.md` for current details.
- `robots.txt` explicitly welcomes search and AI crawlers. `sitemap.xml` lists every page.
- **After launch:** add the site to Google Search Console and Bing Webmaster Tools. Keep the **Google Business Profile** up to date (photos, hours, booking link). Ask happy guests for Google reviews. AI assistants lean heavily on reviews and on listings like Tracks4Africa, Happy Campers SA and GallivantingSA.

## Developer notes

Shared header/footer and page bodies live in `_source/`. Rebuild with `python _source/build.py .` (see `_source/README.md`).

## Credits

- Kyleu photos and logo: Kyleu Bush Camp (old website and Q2B listing). Stand photos were cleaned up: white borders and the stamped logo cropped off, then upscaled and sharpened.
- Wildlife photos in `assets/img/wildlife/` are from [Unsplash](https://unsplash.com) under the free Unsplash License.
- Brown hyena photo (`assets/img/wildlife/brown-hyena.jpg`): Bernard Dupont, via [Wikimedia Commons](https://commons.wikimedia.org/wiki/File:Brown_Hyena_(Hyaena_brunnea)_(50915393781).jpg), CC BY-SA 2.0, cropped. The credit also shows on its card.
- Guest photos (zebra at the gate, rainbow, jackal, cheetahs): Geoff Gregson and Kyleu guests, shared by the owner.
- Fonts: Fraunces, Nunito Sans and Caveat (Google Fonts).
