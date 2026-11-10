"""Marks the wording on each page so staff can change it in the admin (Website > Website wording).

Run after adding new text to a page in _source/src:   python _source/tag_edits.py
It adds data-edit="page.some-words" to headings, paragraphs, captions and list items that hold plain
wording (bold, highlighted words, line breaks and simple links are fine). Wording that the website fills
in by itself (prices, the booking steps, news) is left alone. Keys already in a page are never changed,
so wording that staff have already edited stays attached to the right place.
Then rebuild:   python _source/build.py .
"""
import os, re, sys
from html.parser import HTMLParser

SRC = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'src')
PAGES = {'index': 'home', 'discover': 'discover', 'experience': 'experience', 'dinokeng': 'dinokeng', 'stay': 'stay',
         'stands': 'stands', 'news': 'news', 'contact': 'contact', 'policies': 'policies', '_foot': 'site'}
TARGETS = {'h1', 'h2', 'h3', 'h4', 'h5', 'p', 'figcaption', 'summary', 'li', 'dt', 'dd', 'blockquote'}
CLASS_TARGETS = {'span': {'eyebrow', 'hero-hand'}, 'div': {'lbl'}}
INLINE = {'strong', 'em', 'b', 'i', 'br', 'a'}
VOID = {'br', 'img', 'input', 'hr', 'meta', 'link', 'source', 'use', 'path', 'circle', 'rect', 'line', 'polyline', 'polygon', 'ellipse', 'stop', 'area', 'col', 'wbr'}
MASK = {'script', 'style', 'svg', 'template', 'form', 'select', 'button', 'nav', 'head', 'label', 'table'}
SELF_OK = {'data-reveal', 'data-stagger', 'data-d', 'data-parallax', 'data-edit'}
# containers the website draws or drives by itself
DENY_UP = {'data-rates', 'data-latest-posts', 'data-dgr-updates', 'data-campmap', 'data-guest-stories', 'data-stand-gallery', 'data-article',
           'data-bw', 'data-mg', 'data-pop', 'data-extras', 'data-shop', 'data-pane', 'data-step', 'data-gstep', 'data-demo', 'data-demo-card',
           'data-success', 'data-found', 'data-eft', 'data-card', 'data-bank', 'data-mini', 'data-reserve', 'data-picked', 'data-news',
           'data-news-new', 'data-news-recent', 'data-news-older', 'data-more', 'data-rail', 'data-find', 'data-demo-form'}


class P(HTMLParser):
    def __init__(self, text):
        super().__init__(convert_charrefs=False)
        self.text = text; self.lines = [0]
        for m in re.finditer('\n', text): self.lines.append(m.end())
        self.stack = []; self.found = []

    def off(self):
        l, c = self.getpos(); return self.lines[l - 1] + c

    def handle_starttag(self, tag, attrs):
        start = self.off(); raw = self.get_starttag_text(); node = {'tag': tag, 'attrs': dict(attrs), 'start': start, 'open_end': start + len(raw), 'kids': [], 'raw': raw}
        if self.stack: self.stack[-1]['kids'].append(node)
        if tag in VOID or raw.endswith('/>'): return
        self.stack.append(node)

    def handle_endtag(self, tag):
        for i in range(len(self.stack) - 1, -1, -1):
            if self.stack[i]['tag'] == tag:
                node = self.stack[i]; node['inner_end'] = self.off(); ups = self.stack[:i]; del self.stack[i:]
                self.check(node, ups); return

    def check(self, n, ups):
        cls = set((n['attrs'].get('class') or '').split())
        if not (n['tag'] in TARGETS or (n['tag'] in CLASS_TARGETS and cls & CLASS_TARGETS[n['tag']])): return
        if 'data-edit' in n['attrs'] or 'hidden' in n['attrs']: return
        if any(a.startswith('data-') and a not in SELF_OK for a in n['attrs']): return
        for u in ups:
            if u['tag'] in MASK or any(a in DENY_UP for a in u['attrs']): return
        inner = self.text[n['open_end']:n['inner_end']]
        # a list item that starts with an icon keeps its icon; only the words after it can be changed
        icon = bool(n['kids']) and n['kids'][0]['tag'] == 'svg' and inner.lstrip().startswith('<svg')
        def walk(k, skip=0):
            for c in k['kids'][skip:]:
                if c['tag'] not in INLINE: return False
                if c['tag'] == 'a' and (set(c['attrs']) - {'href', 'target', 'rel'} or 'href' not in c['attrs']): return False
                if c['tag'] != 'a' and c['attrs']: return False
                if not walk(c): return False
            return True
        if not walk(n, 1 if icon else 0): return
        if icon: inner = inner[inner.index('</svg>') + 6:]
        if '{{' in inner: return
        words = re.sub(r'&[a-z#0-9]+;', ' ', re.sub(r'<[^>]+>', ' ', inner))
        if len(re.sub(r'[^A-Za-z]', '', words)) < 2: return
        self.found.append((n, words, icon))


def slug(words):
    w = re.findall(r'[a-z0-9]+', words.lower())[:6]
    return '-'.join(w)[:44].strip('-') or 'text'


def run():
    total = 0
    for name, prefix in PAGES.items():
        path = os.path.join(SRC, name + '.html'); text = open(path, encoding='utf-8').read()
        used = set(re.findall(r'data-edit="([^"]+)"', text))
        p = P(text); p.feed(text); p.close()
        inserts = []
        for n, words, icon in p.found:
            key = prefix + '.' + slug(words); k = key; i = 2
            while k in used: k = key + '-' + str(i); i += 1
            used.add(k); pos = n['open_end'] - 1
            inserts.append((pos, ' data-edit="' + k + '"' + (' data-edit-icon' if icon else '')))
        for pos, s in sorted(inserts, reverse=True): text = text[:pos] + s + text[pos:]
        if inserts: open(path, 'w', encoding='utf-8', newline='\n').write(text)
        total += len(inserts); print(name + '.html', '+' + str(len(inserts)), 'now', len(re.findall(r'data-edit="', text)))
    print('tagged', total)


if __name__ == '__main__':
    run()
