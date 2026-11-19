# Meclis-i Meşâyih Atlası — Defter 1762

**Meclis-i Meşâyih Defteri 1762**'nin 594 kaydından çıkarılan kişi, kurum, yer ve
olay ağının etkileşimli web atlası. Amaç, tekke merkezli Osmanlı dinî bürokrasisinin
sosyal coğrafyasını belge düzeyinde izlenebilir kılmaktır.

Site tamamen statiktir: sunucu tarafı kod yok, derleme adımı yok, tüm veri
`data/*.json` içinde.

## Görünümler

| Görünüm | İçerik |
|---|---|
| **Belgeler** | 594 kaydın tam metni; dokuz varlık tipine göre renkli vurgular, kanonik kişi/kurum/yer etiketleri, ilişki paneli; özet–dönem–tarikat filtreleri |
| **Ağ** | Prozopografik ağ: 1.488 düğüm / 1.649 bağ; kişi–kurum–tarikat, silsile ve aile zincirleri; düğüme tıklayınca iki derinlikli ego ağı |
| **Harita** | 340 koordinatlı yer; daire büyüklüğü anılış sayısı, kesik çizgi belge bağlamından çıkarılan konum |
| **Yöntem** | Kimlik çözümü ilkeleri, güven taksonomisi, bilinen sınırlar |

## Veri katmanı

Ham NER çıktısı (594/594 kayıt) kanonik kimliklere bağlanmıştır:

| Katman | Ham | Kanonik |
|---|---|---|
| Kişiler | 1.715 anılış | 1.407 kişi + 4 makam düğümü |
| Kurumlar | 601 anılış | 471 kurum (%98 yerli, %56 tarikat etiketli) |
| Yerler | 932 anılış | 340 koordinatlı yer (anılışların %99,8'i) |
| Tarihler | 240 anılış | 239 ISO milâdî (hicrî/rûmî dönüşümü) |
| Toplam | 9.309 varlık · 5.620 ilişki | zaman aralığı 1665–1909 |

Kimlik çözümü **muhafazakâr**dır: iki anılış ancak kanıtla (ortak kurum, ortak baba
adı, aynı görev + aynı yer, aynı tarikat + yer) birleştirilir; tek parçalı adlar
("Mehmed") hiçbir koşulda otomatik birleştirilmez. Her katman dört kademeli güven
etiketi taşır (*kesin / yüksek / çıkarım / düşük*) ve arayüz bu bayrakları görsel
olarak ayırt eder. Ayrıntı: sitedeki **Yöntem** sayfası.

## Yerelde çalıştırma

```bash
python -m http.server 8734
```

→ http://localhost:8734

JSON'lar `fetch` ile yüklendiğinden `index.html`'i çift tıklayarak `file://`
üzerinden açmak çalışmaz; küçük bir sunucu şarttır.

## Yayınlama

> ⚠ **Türkiye'den erişim uyarısı.** `*.netlify.app` ve `*.pages.dev` alan adları
> Türkiye'deki bağlantılardan engellidir (ERR_CONNECTION_RESET) — site sorunsuz
> yayına girer ama yurt içinden açılmaz. Türkiye'den erişilebilir doğrulanmış
> seçenekler: **GitHub Pages (`*.github.io`)**, **Vercel (`*.vercel.app`)**,
> **özel alan adı + Netlify**. Netlify'ın sunucuları engelli değildir; engel
> yalnızca `netlify.app` adınadır, özel alan adı bağlanınca aynı site açılır.

### GitHub Pages (önerilen)

**Settings → Pages → Source: Deploy from a branch → `main` / `(root)`**

Ücretsiz hesapta Pages yalnız **herkese açık (public)** depolarda çalışır; depo
gizliyse ya görünürlüğü değiştirmek ya da GitHub Pro gerekir. Yayına girdikten sonra
adres: `https://arifyasinkavdir.github.io/meclisi-mesayih/` — tüm yollar göreceli
olduğu için alt klasörde sorunsuz çalışır.

### Netlify

Klasörü (veya zip'ini) https://app.netlify.com/drop adresine sürükle-bırak; ya da
depoyu bağla — build komutu boş, publish directory kök. `netlify.toml` önbellek
başlıklarını taşır. Türkiye'den erişim için özel alan adı bağlanmalıdır:
apex A → `75.2.60.5`, `www` CNAME → `<site>.netlify.app`.

### Vercel

Statik klasörü doğrudan alır; `*.vercel.app` Türkiye'den erişilebilir.

## Veriyi güncelleme

Veri, ana projedeki Faz 0 tablolarından üretilir:

```bash
python atlas_prep/07_export_json.py
```

Bu, `atlas/data/*.json` dosyalarını yeniden yazar. Ardından `index.html` içindeki
`?v=` sürüm numaralarını artırın (tarayıcı önbelleği).

## Dosya düzeni

| Dosya | İçerik |
|---|---|
| `data/docs.json` | 594 belge: özet, tam metin, varlıklar, ilişkiler, ISO tarih |
| `data/persons.json` | 1.407 kanonik kişi + 4 makam düğümü |
| `data/insts.json` | 471 kanonik kurum (yer, tarikat, güven bayrakları) |
| `data/places.json` | 340 koordinatlı yer |
| `data/network.json` | prozopografik ağ (düğümler + kenarlar) |
| `js/network.js` | bağımlılıksız canvas kuvvet-yönelimli yerleşim |
| `js/map.js` | Leaflet harita katmanı |
| `js/app.js` | yönlendirici, belge gezgini, profiller, yöntem sayfası |

Dış bağımlılıklar: Leaflet 1.9.4, harita karoları (OpenStreetMap, API anahtarı gerekmez), Google Fonts — canlı
gösterimde internet gerekir.

## Künye

Varlık tanıma: gpt-5.6-luna + şema v3.1 (594/594 kayıt). Kimlik çözümü, tarih ve
toponim normalizasyonu, hakemlik: Claude. Faz 0, Ağustos 2026.

Harita altlığı: © OpenStreetMap katkıcıları.
