# Dönüm noktaları

Geri dönmek isteyebileceğim aşamalar. Her satırdaki commit'e
`git checkout <sha>` ile bakılır, `git revert` ile sonrası geri alınır.

---

## RM28 — `c49448d` · 10 Ağustos 2026

Explore Presets bandı ve plugin deck'i bu aşamada oturdu.

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
