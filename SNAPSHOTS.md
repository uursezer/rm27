# Dönüm noktaları

Geri dönmek isteyebileceğim aşamalar. Her satırdaki commit'e
`git checkout <sha>` ile bakılır, `git revert` ile sonrası geri alınır.

---

## Tasarım 16 Ağustos — `ee07491` · 16 Ağustos 2026

**Şu an geçerli kayıt.** "Son neyi kaydetmiştin?" diye sorulduğunda cevap bu.
Dönmek için: `git checkout ee07491`, ya da sonrasını geri almak için
`git revert`.

### Üst bant ve hero

- Koyu zemin (`#080C18`), üç katmanlı ışık: iki köşede ortam yükselmesi,
  imleci takip eden havuz, arkada yaslanan blob. Üst bant sürüklenmiyor.
- Eyebrow'da uygulama işaretleri (Ps · LrC · ekran ikonu), `--accent-border`
  konturlu, `--accent-fg` mürekkepli. Çizilmiş ikonun alt uzantısı yok, o
  yüzden dolgusu sıfırlanmış.
- Hero filmi `videos/hero-film.mp4` (13.8 MB) — sayfadaki tek gerçek video.

### Plugin bölümü

- Üç sekme, her biri yedi videoluk bir deck.
- **Otomatik geçiş yok.** Play düğmesi, geri sayım, onu tutan dinleyiciler,
  ekrana giriş gözlemcisi — hepsi kaldırıldı. Deck yalnızca gönderildiği
  yere gider. Kalan tek davranış: bıraktığın video durur ve başa sarar.
- Nokta pill'i ızgaranın orta sütunu; her genişlikte barın tam ortasında
  (1440/1152/900/620/390'da sapma 0.00px). Son ok içeriğin sağ kenarında.
- Açıklamalar 2 satırdan uzunsa "Read more" çıkar, değilse çıkmaz. Ölçüm
  satır sayarak yapılır; gizli sekmede ve lightbox açıkken ölçüm alınmaz.

### Presets & LUTs rafı

- 12 kart, 10'unda rozet: 🏆 Bestseller · 🔥 Popular · 💎 Editor's Choice ·
  🎉 New. Beyaz pil, koyu mürekkep, kenarlık + gölge ile ayrışır.
- Rozetin etrafında **dönen çizgi yok** (denendi, kaldırıldı — belli
  olmuyordu).
- İmleç bir kartın üzerine geldiğinde **yalnızca o kartın** ikonu oynar:
  yukarı kalkar, 1.32 kat büyür, hafif yatar, 0.66 sn'de yerine döner.
  Komşu karta geçince yenisi baştan oynar.
- Ücretsiz paket (Demo Presets) rozetsiz; onun yerine kartın kendi
  travelling stroke'u var (`freeRing`, 2.4 sn).

### Karşılaştırmalar bandı (`.baband`)

- İçerik: `EXPLORE PRESETS` eyebrow + `Compare every look, side by side`
  (nokta yok). Açıklama satırı yok.
- Zemin beyaz — akordiyon açıkken de kapalıyken de. Üstte ve altta 1px
  `#E3E9F0`. `.section.section--fold` kendi kenarlığını çizmiyor, yoksa
  çizgi iki kere basılıyordu.
- Düğmenin işareti **göz**: kapalıyken açık göz, açıkken üstünden çapraz
  çizgi kendini çizer. Tek ikon, iki hâl — şifre alanlarındaki gibi.
- Dikey ritim tam sayılarla: eyebrow satır kutusu 18 + boşluk 8 + başlık
  satır kutusu 24 = 50, dolgu 32/32, 48px düğme tam **33/33**'e oturur.
  Küsurat bırakılırsa tarayıcı düğmeyi bir piksel yukarı yuvarlar.
- Dikdörtgenin her yeri akordiyonu açıp kapatır; yazı seçiliyken açmaz.

### Before/after rozetleri

11px · .12em · 4×9 dolgu · `rgba(8,20,36,.44)` zemin. Sayfadaki galeri ile
lightbox'taki kopya **birebir aynı** — biri değişirse öteki de değişmeli.

### Kapanış paneli (10.000+ / Kendi paketini oluştur)

Fotoğraf duvarı oda; yerinde durur. İçindeki **altı satır sırayla gelir**,
90ms arayla, 20px aşağıdan: ⭐ değerlendirme → yüzler → eyebrow → cümle →
buton → küçük not. Son satır ilkinden ~0.9 sn sonra oturur.

### Testimonials

- Alıntı kutusu 4 satır sabit yükseklikte ve **kırpar** (kaydırmaz).
  Eskiden `overflow-y:auto` + `overscroll-behavior:contain` idi; metin
  taştığında tekerlek o kutuya kilitleniyor ve sayfa kaymıyordu.
- Karta tıklayınca `is-2up` — üç sütuna açılır, alıntı 3 satıra iner.

### Footer

- Zemin `#06080F`, üstte 1px kenarlık.
- Işık **canlı**: iki köşede ortam yükselmesi (34 sn sürüklenme), imleci
  takip eden havuz, arkada blob. Sabit elips denendi, kaldırıldı.
- Hareket kapalıyken sürüklenme ve blob gider, havuz kalır.

### Sağ ray (`.urail`)

5 düğme: 🔔 Bildirim · $ Collaboration · ⬇ İndir · ✉ Destek · ↑ Yukarı.
Çanın rozeti sepetinkiyle aynı; sayı yokken görünmez.

### Scroll animasyonları

- `[data-reveal]` → opaklık 0→1, 14px yükselme. `data-reveal="late"` 110ms
  geriden gelir.
- Emniyet ağı **ölçer**: gözlemcinin kullandığı çizgiyi kullanıp yalnızca
  ekranın ulaştığını açar, kaydırdıkça bakmaya devam eder. Eskiden 2.5
  saniyede her şeyi açan bir battaniyeydi — sayfanın altındaki bölümler
  hiç animasyon oynatmıyordu.

### Lightbox (rm-pdp)

- Kendi token'ları: zemin `#05060C`, kutular `#0B0D17`, kenarlık `#282B40`.
- Serbest kaydırma + niyet tabanlı oturma; tek tekerlek tıkı bir kare
  ilerletir.
- Sahne çipleri ve before/after etiketleri yalnızca imleç içerik alanında
  iken görünür.
- Instagram karelerinde alttaki "Instagram'da aç" düğmesi **yok**; karenin
  kendisi baştan sona bağlantı.

### Teknik durum

- **Yazı tipi kendi sunucumuzda**: Inter, `fonts/` altında iki değişken
  dosya (latin + latin-ext, 131 KB). Sayfa Google'a hiç istek atmaz.
- **Arama motorlarına kapalı**: `<head>`de `noindex, nofollow, noarchive`
  (robots + googlebot). robots.txt bilerek yok — proje sayfası alt
  klasörde olduğu için okunmaz.
- Yayındaki kopya `uursezer/rm27` bu depoyu otomatik yansıtır; push'tan
  dakikalar sonra canlıya geçer.
- 80 dosya. Eksikler için aşağıdaki "Sitenin dışarıya bağımlılıkları".

---

## RM28 — `c49448d` · 10 Ağustos 2026

*Bir önceki kayıt.* Explore Presets bandı ve plugin deck'i bu aşamada oturdu.

**Karşılaştırmalar bandı (`.baband`)**

- İçerik: `EXPLORE PRESETS` eyebrow + `Compare every look, side by side`
  (nokta yok). Altında açıklama satırı yok.
- Zemin beyaz — akordiyon açıkken de kapalıyken de. Üstte ve altta 1px
  `#E3E9F0` çizgi (`.section.section--fold` kendi kenarlığını çizmiyor,
  yoksa çizgi iki kere basılıyordu).
- Düğmenin işareti göz: kapalıyken açık göz, açıkken üstünden çapraz çizgi
  kendini çiziyor. Tek ikon, iki hâl — şifre alanlarındaki gibi.
- Dikey ritim **tam sayılarla**: eyebrow satır kutusu 18 + boşluk 8 +
  başlık satır kutusu 24 = 50, dolgu 32/32, 48px düğme tam 33/33'e oturuyor.
  Küsuratlı bırakılırsa tarayıcı düğmeyi bir piksel yukarı yuvarlıyor.
- Dikdörtgenin her yeri akordiyonu açıp kapatıyor; yazı seçiliyken açmıyor.

**Plugin deck'i (`.deck__bar`)**

- Otomatik geçiş yok: play düğmesi de, geri sayımı da, onu tutan
  dinleyiciler de kaldırıldı. Deck sadece gönderildiği yere gidiyor.
- Nokta pill'i ızgaranın orta sütunu; her genişlikte barın tam ortasında.

**Before/after rozetleri**

- 11px / .12em / 4×9 dolgu / `rgba(8,20,36,.44)` zemin.
- Sayfadaki galeri ile lightbox'taki kopya birebir aynı — biri değişirse
  öteki de değişmeli.

**Sağ ray (`.urail`)**

- 5 düğme: Bildirim çanı · Collaboration · İndir · Destek · Yukarı.
- Çanın rozeti sepetinkiyle aynı; sayı yokken görünmüyor.

**Lightbox**

- Instagram karelerinin altındaki "Instagram'da aç" düğmesi ve gradyanı yok;
  karenin kendisi zaten baştan sona bağlantı.

---

### Hâlâ açık olanlar

- `videos/` altında 21 mp4 eksik.
- Rakamlar yer tutucu: 10.000+, 4,8, 15.000+, `presets: 24`.
- On iki paket açıklaması ÖNİZLEME METNİ.
- Lightbox'ın Türkçe arayüz metinleri kaynakta sabit — dil sözlüğü gerek.

---

## Sitenin dışarıya bağımlılıkları

Yayındaki kopya (`uursezer/rm27` → uursezer.github.io/rm27/) bu depoyla
birebir aynı. Sitenin kendi kendine yetmesi için kalan iki eksik:

**1 · 21 eğitim videosu — depoda yok**

```
videos/retouchx-01.mp4 … -07.mp4
videos/lightroom-ai-color-01.mp4 … -07.mp4
videos/us-photoshop-plugin-01.mp4 … -07.mp4
```

Bunlar hiç yüklenmedi. Yokken kartlar kapak görselini gösteriyor, sayfa
kırılmıyor. Hero'daki film (`videos/hero-film.mp4`) var ve çalışıyor.

**2 · 15 fotoğraf hâlâ retouchmarket.com'dan çekiliyor**

Sayfada 128 yerde kullanılıyorlar. Depoya indirmek için:

```
python3 tools/localise-images.py
```

Betik dosyaları `images/site/` altına indirir ve index.html'i yerel yollara
çevirir; hepsi inmeden index.html'e dokunmaz. Bu betiği yazan makinenin ağı
retouchmarket.com'a çıkamıyor, o yüzden senin makinenden çalıştırılması
gerekiyor.

Yazı tipi artık dışarıdan gelmiyor: Inter `fonts/` altında, iki değişken
dosya (latin + latin-ext). Sayfa Google'a hiç istek atmıyor.
