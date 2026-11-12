#!/usr/bin/env python3
"""Keep cart.html's shared parts in step with index.html.

The basket page is the same site as the front page, so the things the two
have in common are not written twice — they are cut from index.html and set
into cart.html between marker comments:

    <!-- ▼ shared:style ... -->     the whole stylesheet, byte for byte
    <!-- ▼ shared:header ... -->    the top bar, its phone menu and search drawer
    <!-- ▼ shared:footer ... -->    the footer
    <!-- ▼ shared:edge ... -->      back-to-top and the signed-in rail

Each ends at the matching  <!-- ▲ shared:NAME -->.  Whatever is between the
two is replaced; everything else in cart.html is left exactly as it is.

The markup is changed in one way only on its way across: a link to a section
of the front page (#offer) becomes a link to that section from here
(index.html#offer), the brand goes home, and the basket icon says it is the
page you are on. The stylesheet is not changed at all.

    python3 tools/sync-cart.py            re-cut the shared parts into cart.html
    python3 tools/sync-cart.py --check    say whether cart.html is in step (exit 1 if not)

Run it after any change to index.html's styles, top bar or footer.
"""
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / 'index.html'
DST = ROOT / 'cart.html'


def cut(text, start, end):
    """From the first `start` to the first `end` after it, both included."""
    a = text.index(start)
    b = text.index(end, a) + len(end)
    return text[a:b]


def from_here(html):
    """The same links, as they have to be written from another page."""
    html = html.replace('<a class="brand" href="#"', '<a class="brand" href="index.html"')
    return re.sub(r'href="#([^"]+)"', r'href="index.html#\1"', html)


def header(src):
    html = from_here(cut(src, '<header class="nav" id="nav">', '</header>'))
    mark = ' href="cart.html" aria-label="Basket, empty" data-basket>'
    if html.count(mark) != 1:
        raise SystemExit('sync-cart: the basket link in index.html is not where it was — look before syncing')
    return html.replace(mark, ' href="cart.html" aria-label="Basket, empty" aria-current="page" data-basket>')


PARTS = [
    ('style', lambda src: cut(src, '<style>', '</style>')),
    ('header', header),
    ('footer', lambda src: from_here(cut(src, '<footer class="footer" data-lit>', '</footer>'))),
    ('edge', lambda src: from_here(cut(src, '<button class="totop" id="toTop"', '</nav>'))),
]


def region(name):
    return re.compile(
        r'(<!-- ▼ shared:' + name + r'\b[^>]*-->\n)(.*?)(\n<!-- ▲ shared:' + name + r' -->)',
        re.S)


def main():
    check = '--check' in sys.argv[1:]
    src = SRC.read_text(encoding='utf-8')
    dst = DST.read_text(encoding='utf-8')
    out, stale = dst, []
    for name, make in PARTS:
        want = make(src)
        rx = region(name)
        found = rx.findall(out)
        if len(found) != 1:
            raise SystemExit('sync-cart: cart.html must have exactly one "shared:%s" region (found %d)' % (name, len(found)))
        if found[0][1] != want:
            stale.append(name)
            out = rx.sub(lambda m: m.group(1) + want + m.group(3), out, count=1)
    if check:
        if stale:
            print('cart.html is OUT OF STEP with index.html in: ' + ', '.join(stale))
            print('run: python3 tools/sync-cart.py')
            return 1
        print('cart.html is in step with index.html (style, header, footer, edge)')
        return 0
    if stale:
        DST.write_text(out, encoding='utf-8')
        print('cart.html: re-cut ' + ', '.join(stale))
    else:
        print('cart.html: nothing to do, already in step')
    return 0


if __name__ == '__main__':
    sys.exit(main())
