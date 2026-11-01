# Kyleu Bush Camp: website (mock-up)

A fast, static website (plain HTML, CSS and JavaScript) for Kyleu Bush Camp in the Dinokeng Big 5 Game Reserve. It needs no database or build step, and it runs on GitHub Pages, any normal web hosting, or next to WordPress.

**Booking is a demo.** Guests can search, pick a stand, enter details and "pay", but nothing is sent or charged, and availability is simulated. See [docs/BOOKINGS-AND-PAYMENTS.md](docs/BOOKINGS-AND-PAYMENTS.md) for how to make it live.

## Pages

| Page | What's on it |
|---|---|
| `index.html` | Home (kept calm on purpose): one slowly drifting photo, intro, DGR certified partner badge, family story, camp areas (each links to its stand photos), why campers come back, FAQ |
| `experience.html` | Experience Kyleu: scroll-animated "day at Kyleu" map, what campers love, guest stories (links in `content/settings.md` under "Guest stories"), camp news (only shows when there are posts) |
| `stands.html` | Our stands: photos and details of every stand, grouped by area, each with "Book this stand" |
| `stay.html` | Book now: guests choose dates first, then only the free stands show; site map, stand details, checkout with an optional voucher code (EFT invoice while "Online payments" is off in settings) |
| `discover.html` | Everything from the old "Discover Kyleu" menu on one page, with sticky shortcuts: camp areas, site layout, rates, game drives, camp shop, plan & FAQ |
| `dinokeng.html` | Everything about the reserve, kept apart from Kyleu: what Dinokeng is, Big 5 wildlife, reserve fees, things to do |
| `contact.html` | Map (no API key needed), turn-by-turn directions, contact details, message form |
| `news.html` | Blog / camp news (list plus single post via `news.html?post=…`) |
| `policies.html` | Terms, payment & cancellation, privacy (POPIA), PAIA manual |
| `admin/` | Staff admin MOCK-UP (kyleu.co.za/admin), grouped like hotel software: Front desk (dashboard, bookings, calendar, inbox with full email threads, guests), Money (EFT payments with proof of payment, payments ledger and money still owed, reports), Shop & activities (till with sales history and refunds, game drive schedule, products with stock), Setup (stands with photos, rates & fees in tabs, settings). Uses made-up demo data saved only in the browser; bookings and proof of payment sent from the website demo show up here too. Hidden from search engines. |
| `pop.html` | "Send proof of payment" page: guests who paid by EFT upload their bank proof with their booking reference, and it lands on the booking in the admin (no emailing needed). Demo: kept in the browser only. |

**One price for everyone:** `content/prices.md` holds the price. "Card payment fee percentage" is kept at 0, so guests never pay the card company's fee. Guests pay by EFT for now; when a payment provider is connected, set "Online payments: on" in `content/settings.md` and the prices stay the same.

**Dinokeng:** the reserve's fees (effective 1 July 2026) are in `content/prices.md`. Kyleu is a Dinokeng Certified Partner: create the partner code under Vouchers in the admin and it is emailed to each guest in the week of their stay.

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
