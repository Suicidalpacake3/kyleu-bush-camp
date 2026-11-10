# Page sources (developers only)

The six HTML pages share one header and footer. Edit them here, not in the built pages:

- `src/_head.html`: `<head>`, SEO tags, icon set, header and mobile menu
- `src/_foot.html`: footer and floating buttons
- `src/<page>.html`: the body of each page (with a small META block at the top)

Then rebuild from the project folder:

```
python _source/build.py .
```

This rewrites `index.html`, `stay.html`, `discover.html`, `news.html`, `contact.html` and `policies.html`, adds the FAQ/breadcrumb structured data and bumps the `?v=` cache-busting tags.
The Kyleu team never needs this. Prices, stands, settings and blog live in `/content`.

## Wording that staff can change in the admin

Headings, paragraphs, captions and list items carry a `data-edit="page.some-words"` key. The admin page
**Website wording** lists them per page and staff change the words there (demo: kept in the browser as
`kyleu-web-content`; live: saved on the server and filled in before the page is sent).

After adding new text to a page, give it keys and rebuild:

```
python _source/tag_edits.py
python _source/build.py .
```

`tag_edits.py` only adds keys to text that has none. It never renames a key, so wording staff have already
changed stays attached to the right place. Text the website fills in by itself (prices, booking steps, news)
is left alone. Prices and rate descriptions are changed on the admin's Rates & fees page instead.
