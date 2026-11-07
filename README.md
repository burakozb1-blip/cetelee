# Çetele

Her gün yapmak istediğin alışkanlıkları takip eden kişisel web sitesi. Derleme adımı yoktur; GitHub Pages'e dosyaları yüklemen yeterlidir.

Kurulumu sırayla yap. Toplam 20-30 dakika sürer. Firebase ve GitHub ekranlarının adları zamanla değişebilir. Bir menüyü bulamazsan aynı anlama gelen en yakın seçeneği ara.

## Dosyalar

| Dosya | Görevi |
|---|---|
| `index.html`, `styles.css`, `favicon.svg` | Sayfa ve görünüm |
| `firebase-config.js` | Firebase ayarların. **Değerleri sen gireceksin.** |
| `firestore.rules` | Süresiz güvenlik kuralları |
| `js/app.js`, `js/ui.js` | Ekranlar ve etkileşimler |
| `js/store.js` | Giriş, Firestore okuma ve yazma |
| `js/dates.js`, `js/stats.js` | Yerel tarih ve istatistik hesapları |
| `js/measure.js` | Günlük sayı hesapları |
| `js/backup.js`, `js/colors.js` | Yedekleme ve renkler |
| `tests/`, `package.json` | Yalnızca testler için. Site bunlar olmadan da çalışır. |

## 1. Firebase projesini oluştur

1. [Firebase konsolunu](https://console.firebase.google.com/) aç ve Google hesabınla giriş yap.
2. **Add project** (Proje ekle) düğmesine bas.
3. Projeye bir ad ver, örneğin `cetele`.
4. Google Analytics sorulursa kapalı bırakabilirsin, bu site için gerekmez.
5. Proje oluşunca açılır. Yeni projeler ücretsiz **Spark** planındadır. Plan yükseltme veya kart ekleme adımı **yapma**.

## 2. Web uygulamasını kaydet ve ayarları al

1. Proje ana sayfasında web simgesine (`</>`) bas. Görmüyorsan sol üstteki dişli simgesinden **Project settings** bölümüne gir, **Your apps** altında web simgesini seç.
2. Uygulamaya bir takma ad ver, örneğin `cetele-web`.
3. **Firebase Hosting** kutusunu işaretleme. Site GitHub Pages'te duracak.
4. **Register app** düğmesine bas.
5. Ekranda `firebaseConfig` adlı bir kod bloğu görünür. Bu değerleri bilgisayarındaki `firebase-config.js` dosyasına yaz:

```js
export const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "proje-adin.firebaseapp.com",
  projectId: "proje-adin",
  storageBucket: "proje-adin.firebasestorage.app",
  messagingSenderId: "1234567890",
  appId: "1:1234567890:web:abc123",
};
```

Bu değerler parola değildir, sitede herkese açık olmaları normaldir. Verilerini koruyan şey 5. adımdaki güvenlik kurallarıdır.

Bu bloğu sonradan yine **Project settings > Your apps** altında bulabilirsin.

## 3. Google girişini etkinleştir

1. Sol menüden **Security > Authentication** bölümüne gir. **Get started** görürsen bas.
2. **Sign-in method** sekmesini aç.
3. **Google** seçeneğine bas ve **Enable** anahtarını aç.
4. Destek e-postası (**support email**) sorulursa kendi adresini seç.
5. **Save** düğmesine bas.

## 4. Firestore'u production modunda aç

1. Sol menüden **Databases & Storage > Firestore** bölümüne gir.
2. **Create database** düğmesine bas.
3. Sürüm (edition) sorulursa **Standard** seç.
4. Bir konum seç. Türkiye'den kullanım için Avrupa'daki bir konum uygundur, örneğin `eur3 (Europe)` veya `europe-west1`. Konum sonradan değiştirilemez.
5. Güvenlik modu sorusunda **Start in production mode** seç. **Test modunu seçme.** Firebase'in kendi rehberi web için test modunu önerebilir, ama test modu verilerini herkese açar ve süresi dolar.
6. **Create** düğmesine bas.

Production modu başlangıçta tüm erişimi kapatır. Kuralları yayınlayana kadar site "Firestore bu işleme izin vermedi" der; bu beklenen bir durumdur.

## 5. Güvenlik kurallarını yayınla

1. Firestore sayfasında **Rules** sekmesini aç.
2. Editördeki her şeyi sil.
3. Bu projedeki `firestore.rules` dosyasının tamamını kopyalayıp yapıştır.
4. **Publish** düğmesine bas.

Kurallarda tarih koşulu olmadığı için süreleri dolmaz. Her kullanıcı yalnızca `users/{kendi-uid}` altını okuyup yazabilir, diğer tüm yollar kapalıdır.

### Kuralları konsolda sına

Aynı sayfada **Rules Playground** düğmesine bas. Aşağıdaki denemeleri sırayla yap. Her birinde **Run** düğmesine bas ve üstte çıkan sonucu kontrol et. **Authentication** açıkken **Provider** olarak Google seç ve kullanıcı kimliğine (UID) tablodaki değeri yaz.

| Tür | Konum | Authentication | UID | Beklenen sonuç |
|---|---|---|---|---|
| get | `/users/ali/habits/h1` | Kapalı | | Reddedilir |
| get | `/users/ali/habits/h1` | Açık | `ali` | İzin verilir |
| create | `/users/ali/logs/h1_2026` | Açık | `ali` | İzin verilir |
| get | `/users/ali/habits/h1` | Açık | `veli` | Reddedilir |
| get | `/baska/belge` | Açık | `ali` | Reddedilir |

Sonuçlar tablodan farklıysa kuralları yanlış yapıştırmış olabilirsin. 5. adımı yinele.

## 6. Dosyaları GitHub'a yükle

Önce `firebase-config.js` dosyasını doldurduğundan emin ol.

1. [github.com](https://github.com/) adresinde hesabına gir. Hesabın yoksa ücretsiz bir hesap aç.
2. Sağ üstteki **+** menüsünden **New repository** seç.
3. **Repository name** alanına `cetele` yaz.
4. Görünürlük olarak **Public** seç. Ücretsiz hesapta GitHub Pages için depo herkese açık olmalıdır. Herkes kodu görebilir, ama alışkanlık verilerin kodda değil Firestore'dadır.
5. **Add README** seçeneğini aç ve **Create repository** düğmesine bas.
6. Depo sayfasında **Add file > Upload files** seç.
7. Proje klasörünü aç, içindeki **tüm dosya ve klasörleri** seçip sayfaya sürükle. Klasörün kendisini değil içindekileri sürükle: `index.html` deponun en üst düzeyinde olmalı ve `js` klasörü korunmalı.
8. Yükleme bitince **Commit changes** düğmesine bas.
9. Depo sayfasında `index.html`, `styles.css`, `firebase-config.js` ve `js` klasörünü en üst düzeyde gördüğünü kontrol et.

## 7. GitHub Pages'te yayınla

1. Depo sayfasında **Settings** sekmesini aç.
2. Soldan **Pages** bölümüne gir.
3. **Build and deployment** altında **Source** olarak **Deploy from a branch** seç.
4. **Branch** olarak `main`, klasör olarak `/ (root)` seç ve **Save** düğmesine bas.
5. Yayınlanması 10 dakikayı bulabilir. Sayfayı yenilediğinde üstte site adresin görünür:

```
https://KULLANICI-ADIN.github.io/cetele/
```

## 8. GitHub Pages adresini yetkili alan adlarına ekle

Bu adımı atlarsan Google girişi "Bu site adresi Firebase Authentication'da yetkili değil" hatası verir.

1. Firebase konsolunda **Security > Authentication** bölümüne gir.
2. **Settings** sekmesini aç.
3. **Authorized domains** bölümünde **Add domain** düğmesine bas.
4. Yalnızca alan adını yaz:

```
KULLANICI-ADIN.github.io
```

`https://` ve `/cetele/` kısımlarını **yazma**. Doğru örnek `burak.github.io`, yanlış örnek `https://burak.github.io/cetele/`.

5. **Add** düğmesine bas.

## 9. Son kontrol

1. Site adresini aç ve **Google ile giriş yap** düğmesine bas.
2. Bir alışkanlık ekle ve işaretle.
3. Sayfayı yenile. İşaret duruyorsa kayıt çalışıyor demektir.
4. Firebase konsolunda **Firestore > Data** bölümünde `users` altında kaydını gör.
5. Aynı adresi telefonundan aç ve aynı hesapla gir. Aynı veriler görünmelidir.

## Sorun giderme

| Görünen durum | Çözüm |
|---|---|
| "Firebase ayarları eksik" | `firebase-config.js` içinde hâlâ `BURAYA` yazıyor. Değerleri girip dosyayı yeniden yükle. |
| "Firebase yüklenemedi" | İnternet bağlantını kontrol et. Sürüyorsa `firebase-config.js` değerlerini ve `js/store.js` başındaki `SDK_VERSION` değerini kontrol et. |
| "Bu site adresi ... yetkili değil" | 8. adımı yap. Alan adını `https://` olmadan yazdığını kontrol et. |
| "Giriş penceresi engellendi" | Tarayıcıda bu site için açılır pencerelere izin ver. |
| "Google girişi kapalı" | 3. adımı yap. |
| "Firestore bu işleme izin vermedi" | 5. adımı yap. |
| "Sunucuya ulaşılamıyor" | Bağlantını kontrol et ve 4. adımda veritabanını oluşturduğundan emin ol. |
| Sayfa 404 veriyor | `index.html` deponun en üst düzeyinde olmalı. Yayınlanması için 10 dakika bekle. |
| Bilgisayarda (localhost) giriş olmuyor | `localhost` yetkili alan adları listesinde yoksa ekle. |

## Hesaplar nasıl yapılıyor?

- **Sayılan günler:** başlangıç tarihi ve bugün dahil, ikisinin arasındaki günler. Başlangıçtan önceki işaretler silinmez, ama hesaba girmez.
- **Son 7, 30, 365 gün:** bugün dahil pencere. Alışkanlık daha yeniyse payda yalnızca başlangıçtan sonraki günlerdir. Örneğin 3 gün önce başladıysa son 7 günün paydası 3'tür.
- **Mevcut seri:** bugün işaretlenmediyse seri düne kadar sayılır, gün bitmeden kırılmış sayılmaz. Dün de boşsa seri 0'dır.
- **Haftalar:** Pazartesi başlar, aylar takvim ayıdır.
- **Önceki döneme göre değişim:** iki dönem oranının göreli farkıdır. Oran %50'den %56'ya çıktıysa değişim %12'dir ve ekranda ikisi de görünür. Önceki oran %0 ise yüzde hesaplanamayacağı için fark puan olarak gösterilir.
- **Bugünün etkisi:** karşılaştırma ve grafiklerde bugün yapılmamış işler aleyhine sayılmaz, yapılanlar sayılır. Böylece Pazartesi sabahı "%100 düşüş" görünmez. Alışkanlık başına verilen genel, 7, 30 ve 365 günlük yüzdeler ise bugünü de sayar.
- **En istikrarlı ve geliştirilmesi gereken:** son 30 günün oranına göre belirlenir. Bir alışkanlığın değerlendirilmesi için en az 3 gün veri gerekir.
- **Arşiv:** arşivde geçen günler yapılmamış sayılmaz ve seriyi kırmaz. Arşivden çıkarınca takip kaldığı yerden sürer.
- **Gün değişimi:** cihazın yerel saatiyle gece yarısında olur. Saat dilimi değişirse yeni yerel gün geçerli olur.

## Sayı kutusu

Her alışkanlığın satırında isteğe bağlı bir sayı kutusu vardır. Sayfa, dakika gibi bir birim yazarsan kutuda o görünür. Sayı yazarsan gün de işaretlenir. Alışkanlık sayfasında ay ay ortalaman görünür.

## Ücretsiz plan kullanımı

Firestore'un ücretsiz kotası günde 50.000 okuma, 20.000 yazma, 20.000 silme ve toplam 1 GiB depolamadır. Kota Pasifik saatiyle gece yarısı yenilenir.

Veri modeli bu kotaya göre kuruldu:

```
users/{uid}/habits/{habitId}       alışkanlık bilgisi
users/{uid}/logs/{habitId}_{yıl}   { habitId, year, days: ["2026-11-04", ...], values: { "2026-11-04": 23 } }
```

- Bir alışkanlığın bir yılı tek belgededir. 5 alışkanlık ve 2 yıllık veriyle bir açılış en fazla 15 belge okur.
- Bir işaret 1 belge yazar. Hızlı aç-kapa yaparsan hiç yazma olmaz.
- Veriler tarayıcıda da önbelleğe alınır. İnternet kesilse de işaretleyebilirsin, değişiklikler bağlantı gelince gönderilir.

## Verilerin güvenliği

Kod, kayıtları kendiliğinden silmez. Veri yalnızca sen bir alışkanlığı onaylayarak sildiğinde veya bir yedeği "Mevcut verileri yedekle değiştir" seçeneğiyle yüklediğinde silinir. İkinci durumda önce mevcut verilerin bir dosya olarak indirilir.

Ücretsiz planda otomatik yedek olmadığı için **Ayarlar > Yedeği indir** ile ara sıra yedek almanı öneririm.

Siteyi bulan başka biri de kendi Google hesabıyla giriş yapabilir. Yalnızca kendi boş alanını görür, senin verilerine erişemez.

## Geliştirme

Yerelde denemek için bir statik sunucu gerekir, örneğin `npx serve` veya `python3 -m http.server`.

Hesap testlerini çalıştırmak için Node.js 22 yeterlidir, ek paket gerekmez:

```
npm test
```
