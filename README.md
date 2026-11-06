# Zerda Koçkaya — Tanıtım & Randevu Sitesi

Pembe/krem temalı, randevu usulü çalışan güzellik salonu sitesi. **Sıfır bağımlılık** — sadece Node.js 18+ gerekir (`npm install` yok).

## Çalıştırma
```bash
cp .env.example .env     # ADMIN_PASSWORD'u mutlaka doldurun
node server.js           # http://localhost:3000
```
- Site: `/`  ·  Yönetim paneli (randevuları onayla/iptal et): `/admin`
- Randevular `data/appointments.json` dosyasında tutulur (yedeğini alın).

## Fotoğraflar & logo (Instagram'dan otomatik çekilemedi)
Dosyaları şu adlarla koyun, site otomatik kullanır; yoksa şık yer tutucular görünür:
- `public/img/logo.png` (veya `.svg`/`.webp`) → menüdeki logo
- `public/img/hero.jpg` → ana sayfadaki kemer çerçeveli büyük fotoğraf (dikey 3:4 ideal)
- `public/img/gallery/1.jpg … 8.jpg` → galeri (sırasıyla Makyaj, Saç, Kalıcı Oje, Kirpik, Protez Tırnak, Kaş, Manikür, Kirpik Lifting)

## Hizmet, saat ve süre ayarları
- `data/services.json` → hizmet adı, açıklama, **süre (dk)**. Süreler tahminidir, kendi sürelerinize göre düzenleyin.
- `data/settings.json` → çalışma saatleri (şu an Pzt–Cmt 10:00–19:00, Pazar kapalı), tatil günleri (`closedDates`), aynı anda kaç müşteri (`capacity`), kaç gün sonrasına randevu (`maxAdvanceDays`).

## Bildirimler (SMS & WhatsApp)
Yeni randevuda salon sahibine SMS + WhatsApp, müşteriye SMS gider; onay/iptalde müşteriye haber verilir.
1. **Hiçbir ayar yapmadan:** müşteri randevudan sonra "WhatsApp ile salona bildir" düğmesini görür; panelde her randevunun yanında müşteriye hazır mesajlı **WhatsApp** düğmesi vardır. Giden mesajlar `data/outbox.log` ve panelde "Bildirim kaydı"nda görünür (deneme modu).
2. **Otomatik SMS:** `.env` içinde `SMS_PROVIDER=netgsm` (veya `iletimerkezi`) ve hesap bilgilerini girin.
3. **Otomatik WhatsApp:** Meta WhatsApp Business Cloud API için `WHATSAPP_TOKEN` ve `WHATSAPP_PHONE_ID` girin. İşletmenin başlattığı mesajlar için Meta onaylı bir şablon gerekir (`WHATSAPP_TEMPLATE`, 4 parametre: ad, hizmet, tarih, saat).

## Yayına alma
Node çalıştırabilen herhangi bir sunucuda (VPS, Render, Railway…) `node server.js`. Önünde Nginx/Caddy ile HTTPS kullanın. `ADMIN_PASSWORD`'u güçlü seçin.
