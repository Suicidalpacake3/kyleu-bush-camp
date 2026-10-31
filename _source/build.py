import json, os, re, sys, html, time
VER=time.strftime('%Y%m%d%H%M')
SRC = os.path.join(os.path.dirname(__file__), 'src')
OUT = sys.argv[1]
head = open(os.path.join(SRC, '_head.html'), encoding='utf-8').read()
foot = open(os.path.join(SRC, '_foot.html'), encoding='utf-8').read()

LOADER = '''<div class="loader" role="status" aria-label="Loading Kyleu Bush Camp">
  <div class="loader-inner">
    <div class="loader-ring">
      <svg viewBox="0 0 168 168" aria-hidden="true">
        <circle cx="84" cy="84" r="76" fill="none" stroke="#f4b740" stroke-width="12" opacity=".95"/>
        <g class="spots"><circle cx="84" cy="84" r="76" fill="none" stroke="#2a1b12" stroke-width="7" stroke-linecap="round" stroke-dasharray="1 15 5 11 0.5 19 7 13 1 17 3 22 0.5 12 6 16"/></g>
        <g class="spots2"><circle cx="84" cy="84" r="62" fill="none" stroke="#e8731c" stroke-width="4" stroke-linecap="round" stroke-dasharray="1 20 4 16 0.5 24 6 18"/></g>
      </svg>
      <img src="assets/img/logo-small.png" alt="">
    </div>
    <div class="loader-paws" aria-hidden="true"><span></span><span></span><span></span><span></span><span></span></div>
    <div class="loader-text">Tracking down your campsite…</div>
  </div>
</div>'''

def strip(s):
    return re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', '', s))).strip()

for name in ['index', 'stay', 'discover', 'dinokeng', 'news', 'contact', 'policies']:
    body = open(os.path.join(SRC, name + '.html'), encoding='utf-8').read()
    m = re.match(r'<!--META\s*(\{.*?\})\s*-->\s*', body, re.S)
    meta = json.loads(m.group(1)); body = body[m.end():]
    page = head + body + foot
    jsonld = []
    # FAQ structured data from <details>
    faqs = re.findall(r'<details[^>]*><summary>(.*?)</summary><div class="ans">(.*?)</div></details>', body, re.S)
    if faqs:
        jsonld.append({"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
            {"@type": "Question", "name": strip(q), "acceptedAnswer": {"@type": "Answer", "text": strip(a)}} for q, a in faqs]})
    if name != 'index':
        crumb_name = re.sub(r'\s*[|—].*$', '', meta['title']).strip()
        jsonld.append({"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
            {"@type": "ListItem", "position": 1, "name": "Home", "item": "https://www.kyleu.co.za/"},
            {"@type": "ListItem", "position": 2, "name": crumb_name, "item": "https://www.kyleu.co.za/" + meta['path']}]})
    rep = {
        'title': html.escape(meta['title'], quote=True), 'desc': html.escape(meta['desc'], quote=True), 'path': meta['path'], 'ogimg': meta['ogimg'],
        'extra_css': '<link rel="stylesheet" href="assets/css/pages.css">',
        'extra_js': '<script src="assets/js/pages.js" defer></script>' + meta.get('extra_js', ''),
        'jsonld': ''.join('<script type="application/ld+json">' + json.dumps(j, ensure_ascii=False) + '</script>\n' for j in jsonld),
        'bodyclass': 'page-' + name, 'loader': LOADER if meta.get('loader') else '',
        'headerclass': meta.get('headerclass', ''), 'footbg': meta.get('footbg', ''), 'tail': '',
    }
    for n in ['home', 'stay', 'discover', 'dinokeng', 'news', 'contact']:
        rep['nav_' + n] = 'class="active" aria-current="page"' if meta.get('nav') == n else ''
    for k, v in rep.items():
        page = page.replace('{{' + k + '}}', v)
    page = re.sub(r'(assets/(?:css|js)/[\w-]+\.(?:css|js))"', lambda m: m.group(1)+'?v='+VER+'"', page)
    left = re.findall(r'\{\{\w+\}\}', page)
    if left: print('UNREPLACED', name, left)
    open(os.path.join(OUT, name + '.html'), 'w', encoding='utf-8', newline='\n').write(page)
    print('built', name + '.html', len(page) // 1024, 'KB', len(faqs), 'faqs')
