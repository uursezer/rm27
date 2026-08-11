#!/usr/bin/env python3
"""Bring the last remote images into the repository.

Fifteen photographs on this page are still fetched from retouchmarket.com at
run time, which means the page is not whole on its own: if that host is slow,
moved, or blocking other sites from linking to its images, those frames come
up empty for whoever is reading. This script downloads each one into
images/site/ and rewrites index.html to point at the local copy.

It could not be run from the machine that wrote it — that network refuses
retouchmarket.com — so it is here to be run from yours:

    python3 tools/localise-images.py

Run it again any time; it re-downloads nothing it already has, and it will not
touch index.html unless every file it needs is on disk. Nothing is written
until all of it has arrived, so a half-finished download cannot leave the page
pointing at files that are not there.
"""

import os
import re
import sys
import urllib.request

KOK = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SAYFA = os.path.join(KOK, 'index.html')
HEDEF = os.path.join(KOK, 'images', 'site')

# the page asks for three sizes of the same photograph; one file each is
# enough here — the largest — and every use points at it
DESEN = re.compile(
    r'https://retouchmarket\.com/_next/image\?url=([^&"\s]+)'
    r'&(?:amp;)?w=(\d+)&(?:amp;)?q=(\d+)')

AJAN = ('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) '
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36')


def indir(url, yol):
    istek = urllib.request.Request(url, headers={'User-Agent': AJAN})
    with urllib.request.urlopen(istek, timeout=60) as cevap:
        veri = cevap.read()
    if len(veri) < 1024:
        raise RuntimeError('geldi ama boş görünüyor (%d bayt)' % len(veri))
    with open(yol, 'wb') as f:
        f.write(veri)
    return len(veri)


def main():
    metin = open(SAYFA, encoding='utf-8').read()
    bulunan = DESEN.findall(metin)
    if not bulunan:
        print('index.html içinde uzaktan çekilen görsel kalmamış — yapacak bir şey yok.')
        return 0

    # kimlik -> (en büyük genişlik, o genişliğin tam adresi)
    en_iyi = {}
    for kaynak, w, q in bulunan:
        kimlik = re.search(r'images%2F([0-9a-f][0-9a-f-]+)', kaynak)
        if not kimlik:
            print('bu adresten bir kimlik çıkaramadım:', kaynak[:70])
            return 1
        kimlik = kimlik.group(1)
        w = int(w)
        if kimlik not in en_iyi or w > en_iyi[kimlik][0]:
            en_iyi[kimlik] = (w, kaynak, q)

    os.makedirs(HEDEF, exist_ok=True)
    print('%d benzersiz görsel, %d kullanım.\n' % (len(en_iyi), len(bulunan)))

    yerel = {}
    hata = 0
    for kimlik, (w, kaynak, q) in sorted(en_iyi.items()):
        ad = kimlik[:12] + '.webp'
        yol = os.path.join(HEDEF, ad)
        yerel[kimlik] = 'images/site/' + ad
        if os.path.exists(yol) and os.path.getsize(yol) > 1024:
            print('  var    %s' % ad)
            continue
        url = ('https://retouchmarket.com/_next/image?url=%s&w=%d&q=%s'
               % (kaynak, w, q))
        try:
            n = indir(url, yol)
            print('  indi   %s  (%d bayt, w=%d)' % (ad, n, w))
        except Exception as e:                       # noqa: BLE001
            print('  HATA   %s  → %s' % (ad, e))
            hata += 1

    if hata:
        print('\n%d görsel inmedi. index.html’e dokunmuyorum — '
              'hepsi gelmeden değiştirmek sayfayı bozar.' % hata)
        return 1

    def degistir(m):
        kimlik = re.search(r'images%2F([0-9a-f][0-9a-f-]+)', m.group(1)).group(1)
        return yerel[kimlik]

    yeni = DESEN.sub(degistir, metin)
    if yeni == metin:
        print('\nindex.html değişmedi.')
        return 0
    open(SAYFA, 'w', encoding='utf-8').write(yeni)
    print('\nindex.html güncellendi: %d adres artık yerel dosyayı gösteriyor.'
          % len(bulunan))
    print('Şimdi commit’leyip pushlayabilirsin:')
    print('    git add -A && git commit -m "The last remote images come home"'
          ' && git push')
    return 0


if __name__ == '__main__':
    sys.exit(main())
