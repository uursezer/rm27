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

## Kayıttan sonra eklenenler

Bunlar "Tasarım 16 Ağustos" kaydının **üstüne** geldi; o kayda dönülürse
bunlar gider.

### Sepet & ödeme sayfası — `cart.html` · 12 Kasım 2026

- Ana sayfadaki sepet ikonu artık buraya gider. Sepet sayfalar arasında
  hatırlanır: iki sayfa da `rm-cart.js`'i okur, sepet tarayıcıda `rm-cart`
  anahtarında durur. Sayfayı yenileyince, başka sekmede değiştirince ya da
  geri tuşuyla dönünce iki taraf da aynı sepeti gösterir.
- Tek dosyada üç adım: **Sepet → Ödeme → Tamam** (adres çubuğunda `#pay`,
  `#done`). Sayfanın üstünde ayrıca bir "adım şeridi" yok: sayfada adım
  sayan tek şey kampanyadır, ikincisi onunla karışırdı.
- **Kampanya paneli** ana sayfadaki teklifin diliyle: koyu, ışıklı zemin,
  aynı kutular, aynı "Free!" rozeti ve dönen çizgi, aynı altın "Best deal".
  İki adım yan yana durur: önce **3 Al 2 Öde** (3 yer), sonra **5 Al 3 Öde**
  (2 yer daha). Altın rozet ilk adım bitince gelir. Her durum için tek
  cümle ve altında parasal karşılığı var:

  | sepette | başlık | altındaki satır |
  |---|---|---|
  | 0 | 3 ürün seç, 1'i bizden. | $59'lık üç ürün, $177 yerine $118. |
  | 1 | 2 ürün daha ekle, 3 üründen 1'i bizden. | $59'lık iki ürün birlikte toplamına yalnızca $59 ekler. |
  | 2 | **1 ürün daha ekle, 1 ürün bedava kazan.** | $59'lık bir ürün toplamını değiştirmez: yine $118. 3 Al 2 Öde tam da bu. |
  | 3 | 2 ürün daha ekle, 5 üründen 2'si bizden. | 3 Al 2 Öde fırsatını yakaladın — … bedava. $59'lık iki ürün daha toplamına yalnızca $59 ekler. |
  | 4 | 1 ürün daha ekle, 1 ürün daha bedava kazan. | $59'lık bir ürün toplamını değiştirmez: yine $177. 5 Al 3 Öde tam da bu. |
  | 5+ | 5 Al 3 Öde fırsatını yakaladın. | 5 ürününün 2'si bizden — kazancın $118. |

  (İngilizcesi ana sayfanın sesiyle: "One more and it's on us." vb. Parayla
  ilgili her cümle hangi fiyat için doğru olduğunu söyler: plugin paketi
  eklenirse rakamlar başka olur, onun satırı da bunu ayrıca yazar.)
- **Ürün eklemek sayfadan çıkmadan, panelin içinde**: sıradaki yer için tek
  öneri ve tek düğme ("Önerimiz" / "Bedava ürünün"), altında rafın geri
  kalanı. Her ürünün yanında sepete **gerçekte** ekleyeceği tutar yazar:
  `$59`, `Bedava`, ya da plugin paketi için `$90` ("$59'lık 1 ürün bedava"
  notuyla: paket indirimde değil, sepete $149'dan girer ve bir ürünü bedava
  yapar). En ucuz adım en üstte. Beş üründen sonra liste "Bir ürün daha
  ekle" düğmesinin arkasına katlanır. "Kampanyalar nasıl işliyor?" satırı
  dört kuralı açar. Ürün adları hiçbir genişlikte üç noktayla kesilmez.
  Önerinin düğmesi İngilizcede ana sayfadaki raf düğmesiyle aynı sözü
  taşır: "Add to cart" (Türkçesi iki sayfada da "Sepete ekle").
- Bir adım tamamlanınca ana sayfadaki yeşil kutlama panelin üst yarısında
  oynar ("Kazancın $59"); sıradaki ürünün düğmesini hiç örtmez. Panelin
  üstü o an ekranda değilse (telefonda rafın aşağısından eklendiyse) sayfa
  önce paneli ekrana getirir, sonra kutlar. Sayfa açılırken, dil değişince,
  geri alınca ya da başka sekme sepeti değiştirince hiçbir şey kutlanmaz.
- Bir ürün eklenince ya da çıkarılınca, basılan düğmenin yerine gelen şey
  (sıradaki ürün, "Geri al") tam parmağın olduğu yerde kalır: üstte ne
  açılıp kapanırsa kapansın sayfa ona göre kayar.
- **Bir basış bir basıştır.** Yukarıdaki kural yüzünden çift tıklamanın
  ikinci yarısı kimsenin nişan almadığı bir şeye denk gelirdi ("Çıkar"a çift
  basınca satır hemen geri geliyor, öneriye çift basınca iki ürün giriyordu).
  Bir şey ekleyen, çıkaran, geri alan ya da adım değiştiren bir basıştan
  sonra yarım saniye boyunca aynı yere gelen ikinci basış yanıtlanmaz; başka
  bir yere basış hemen yanıtlanır. Klavyede "aynı yer", arada başka tuşa
  basılmamış olmasıdır: Enter-Enter tek basış, basılı tutulan Enter tek
  basış, Enter-Tab-Enter iki basış. Tarayıcının Geri tuşu basış sayılmaz.
  Ekran okuyucu gibi yardımcı yazılımların *başka* bir düğmeye basması da
  yeni bir basıştır.
- **Boş yerdeki "+" görünür biçimde bir yere götürür.** Basınca sayfa
  öneriyi ("Önerimiz") gerekirse alttaki çubuğun üstüne kadar kaydırır,
  önerinin çevresinde bir halka açılıp kapanır ve düğmesi klavye halkasını
  takar. (Eskiden öneri zaten ekrandaysa hiçbir şey olmuyor gibi görünüyordu.)
- Kurallar (hepsi `rm-cart.js`'te, `node tools/test-cart.js` ile kanıtlı):
  sepette tek kampanya geçer — ulaşılan en büyüğü; bedava olan her zaman en
  ucuz olandır, eşitlerde en son eklenen; 6. üründen sonrası kendi fiyatıyla;
  ücretsiz Demo Presets kampanyaya sayılmaz. Ana sayfada kurulan paket
  burada ürün ürün listelenir, biri çıkarılırsa paket çözülür ama kalanlar
  hak ettikleri kampanyayı korur. Sayfa hiçbir fiyatı kendi hesaplamaz,
  hangi yerin bedava olduğunu da kendi varsaymaz: hepsini `rm-cart.js`'e
  sorar.
- Altında fiş: satırlar kampanyanın uygulandığı sırayla ve paneldeki yer
  numarasıyla (01, 02 …) durur; bedava olan satır rozetini taşır. Çıkar /
  geri al var; çıkarınca kaybedilen kampanya aynı satırda söylenir.
- Yanında sipariş özeti: ara toplam, kampanya, toplam, "Kazancın …" ve tek
  cümlelik "…eklersen toplamın şu olur" kutusu (basınca öneriye götürür).
- **Ödeme adımı bir önizlemedir** ve bunu hiçbir şey sormadan önce söyler:
  e-posta, ad soyad ve onay kutusu gerçek; kart alanları çizili ama canlı
  değil (oraya ödeme sağlayıcısının kendi formu gelecek). Hiçbir yere bir
  şey gönderilmez, yazılanlar saklanmaz (form tamamlanınca boşaltılır),
  sepet de boşaltılmaz. Onay kutusundaki iki belge (Mesafeli Satış
  Sözleşmesi, Teslimat ve İade Koşulları) henüz yayımlanmadığı için bağlantı
  değil düz yazıdır ve altındaki satır bunu söyler; belgeler yayımlanınca
  bağlantıya çevrilecek ve o satır kaldırılacak.
- "İçeriğe geç" bağlantısı ve footer'daki henüz yazılmamış sayfa
  bağlantıları (`#`) adımı değiştirmez. Geri tuşu sepete, bırakıldığı
  yerden — ve klavye, ayrılırken basılan düğmenin üstünde — döner. "Sepetin
  bıraktığın gibi duruyor" cümlesi Tamam adımında yalnızca sepet gerçekten
  öyle durduğu sürece görünür. Ctrl / Cmd / Shift ile tıklanan "Ödemeye geç"
  ve sepet ikonu tarayıcıya bırakılır (yeni sekme).
- **Klavye ve ekran okuyucu:** ödeme adımında özet, dar ekranda formun
  üstünde *ve* sayfa sırasında da formdan önce; geniş ekranda formun yanında
  ve sonra (iki yer var, yalnızca biri çizilir — hiçbir şey CSS ile yer
  değiştirmez). Hatalı ve odaklı alan kırmızı kenarın dışında ayrıca halka
  takar. Onay kutusu dokunulmadan "geçersiz" diye okunmaz. Koyu panelde
  klavye halkası koyu zemin için olan açık renktir. Bir düğmenin sesli adı
  üstünde yazanı içerir ("Add to cart: Solis Presets — $59"). Alttaki
  çubuk iki fiyatını "$118, eski fiyatı $177" diye okur. Bir adımdan
  çıkılınca o adımın son duyurusu sayfanın sonunda kalmaz.
- **`rm-cart.js` gelmezse** (ya da tarayıcı eski bir kopyasını tutuyorsa)
  sepet sayfası boş bir çerçeve yerine "Sepetin yüklenemedi. Eklediklerin
  duruyor." der ve "Sayfayı yenile" düğmesi verir; ana sayfa da betiğinin
  ortasında durmak yerine sepeti hatırlamadan çalışır.
- İki dil: footer'daki dil seçici Türkçe'ye alınırsa sayfanın tamamı Türkçe
  olur (üst bar ve footer ana sayfadaki gibi İngilizce kalır); belge de
  `lang="tr"` olur, İngilizce kalan bölümler `lang="en"` taşır. Türkçede
  sayfanın adı "Sepetim", tek ürün "paket", birlikte alınanlar "set"tir.
- Telefonda sepet görünümünde, ödeme düğmesi ekranda değilken altta sabit
  bir çubuk kampanyanın durumunu, toplamı ve düğmeyi taşır; footer'a
  gelince çekilir. Ödeme adımında çubuk yoktur.

**Ana sayfada bu işle birlikte düzelenler** (sepet artık gerçek olduğu için
önem kazananlar):

- Ürün penceresindeki (lightbox) "Sepete ekle" düğmesi artık sayfanın gerçek
  sepetini kullanır (`window.RMBasket`); eskiden kendi gizli listesini
  tutuyordu, orada eklenen ürün sepete hiç ulaşmıyordu. Sepetteki setin
  içinde olan bir ürünün penceresinde düğme "Setinde — önce seti çıkar" der
  (eskiden "Sepetten çıkar" yazıp hiçbir şey yapmıyordu). Pencere açıkken
  sepet başka bir yerden (raf, paket kurucu, başka sekme) değişirse düğme
  kendiliğinden güncellenir.
- Telefon yan tutulunca açılan menü pencereden uzun kalıyordu ve dil
  seçiciye ulaşılamıyordu; kısa pencerede menü kendi içinde kayar, dil
  listesi yukarı açılır. Dil ve sıralama listeleri seçili olanı ekran
  okuyucuya da söyler; Esc, klavyeyi listeyi açan düğmeye geri verir.
- Sepet sayacı ilk karede doğru sayıyı gösterir (eskiden sayfanın en altındaki
  betik çalışana kadar 0 yazıyordu).
- "… added" notu barın durduğu yere göre konumlanır; sepet ikonunun üstüne
  binip ilk tıklamayı yutmaz. Geri tuşuyla dönülen sayfa eski bir notu
  sonradan göstermez.
- Paket sepetteyken zaten seçili olan kademeye (ya da altın rozete) basmak
  paketi sepetten çıkarmaz.
- Telefonda, koyu bandın üstündeyken menü düğmesi artık görünür (koyu zeminde
  koyu çizgilerdi). 320 piksel genişlikte sayfa 10 piksel taşmaz.
- `rm-cart.js` iki sayfada da ilk bayt ile birlikte istenir (preload).

**Ortak parçalar tek yerden gelir.** `cart.html`'in stili, üst barı ve
footer'ı `index.html`'den kesilir — elle yazılmaz. `index.html`'de stil,
üst bar ya da footer değişince:

```
python3 tools/sync-cart.py          # ortak parçaları yeniden keser
python3 tools/sync-cart.py --check  # iki sayfa uyumlu mu, onu söyler
```

Tek istisna o parçaları çalıştıran betiktir (bar, menü, arama, dil seçici,
ipucu, "reveal"): `cart.html` her bloğun kendi kopyasını taşır ve araç
bunları **kesmez, karşılaştırır** — bir blok `index.html`'dekiyle kelimesi
kelimesine aynı değilse `--check` hangi blok olduğunu söyleyip hata verir;
o blok elle taşınır. (Stil yeniden kesilip betik eski kalınca sepet sayfası
bomboş görünebiliyordu ve hiçbir araç bunu yakalamıyordu.)

**Testler**

```
node tools/test-cart.js     # hesap: kampanya kuralları + ana sayfayla aynı ürün/fiyat mı (109 kontrol)
node tools/check-cart.js    # sayfa: gerçek tarayıcıda, her genişlikte, iki dilde (510+ kontrol)
```

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
