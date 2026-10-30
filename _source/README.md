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
