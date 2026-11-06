'use strict';
/**
 * Bildirimler: SMS (Netgsm / İleti Merkezi) + WhatsApp (Meta Cloud API).
 * Hiçbir şey ayarlanmamışsa güvenli şekilde sadece data/outbox.log'a yazar;
 * ayrıca sitede "WhatsApp ile bildir" bağlantıları (wa.me) her zaman çalışır.
 */
const fs = require('fs');
const path = require('path');

const env = (k, d = '') => process.env[k] ?? d;
const OUTBOX = path.join(__dirname, '..', 'data', 'outbox.log');

function normalizePhone(raw) {
  let d = String(raw || '').replace(/\D/g, '');
  if (d.startsWith('00')) d = d.slice(2);
  if (d.startsWith('90') && d.length === 12) d = d.slice(2);
  if (d.startsWith('0') && d.length === 11) d = d.slice(1);
  return /^5\d{9}$/.test(d) ? '90' + d : null; // 905XXXXXXXXX
}
const displayPhone = (p) => (p ? `0${p.slice(2, 5)} ${p.slice(5, 8)} ${p.slice(8, 10)} ${p.slice(10)}` : '');

const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
function prettyDate(s) {
  const d = new Date(s + 'T00:00:00Z');
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${DAYS[d.getUTCDay()]}`;
}

const SALON = () => env('SALON_NAME', 'Zerda Koçkaya');
const OWNER = () => normalizePhone(env('OWNER_PHONE', '05445990630'));

function log(line) {
  try { fs.appendFileSync(OUTBOX, `${new Date().toISOString()} ${line}\n`); } catch {}
  console.log('[bildirim]', line);
}
function readOutbox() {
  try { return fs.readFileSync(OUTBOX, 'utf8').trim().split('\n').slice(-100).reverse(); } catch { return []; }
}

// ---------- SMS (Devre Dışı) ----------
async function sendSms() {
  // Kullanıcı talebiyle SMS devre dışı bırakıldı
  return;
}

// ---------- WhatsApp (Meta Cloud API) ----------
async function sendWhatsApp(to, text, templateParams) {
  if (!to) return;
  const token = env('WHATSAPP_TOKEN'), id = env('WHATSAPP_PHONE_ID');
  if (!token || !id) return log(`WhatsApp(deneme modu) → ${to}: ${text}`);
  const tpl = env('WHATSAPP_TEMPLATE');
  const body = tpl && templateParams
    ? { messaging_product: 'whatsapp', to, type: 'template', template: { name: tpl, language: { code: env('WHATSAPP_TEMPLATE_LANG', 'tr') }, components: [{ type: 'body', parameters: templateParams.map((t) => ({ type: 'text', text: String(t) })) }] } }
    : { messaging_product: 'whatsapp', to, type: 'text', text: { body: text } };
  try {
    const r = await fetch(`https://graph.facebook.com/v20.0/${id}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(10000) });
    log(`WhatsApp → ${to}: ${r.ok ? 'OK' : 'HATA ' + (await r.text()).slice(0, 200)}`);
  } catch (e) { log(`WhatsApp HATA → ${to}: ${e.message}`); }
}

// ---------- Mesaj metinleri ----------
const svc = (a) => a.serviceNames.join(', ');
const ownerText = (a) => `Yeni randevu 🌸\n${a.name} (${displayPhone(a.phone)})\n${svc(a)}\n${prettyDate(a.date)} ${a.time}${a.note ? '\nNot: ' + a.note : ''}`;
const customerReceived = (a) => `${SALON()}: Merhaba ${a.name}, ${prettyDate(a.date)} ${a.time} randevu talebiniz alındı (${svc(a)}). Onaylandığında size bildireceğiz.`;
const customerConfirmed = (a) => `${SALON()}: ${a.name}, ${prettyDate(a.date)} ${a.time} randevunuz ONAYLANDI ✨ Sizi bekliyoruz. Adres: ${env('SALON_ADDRESS_SHORT', 'İpek Yolu, Hafize Mah. Uzun Sk. No:67A, Van')}`;
const customerCancelled = (a) => `${SALON()}: ${a.name}, ${prettyDate(a.date)} ${a.time} randevunuz iptal edildi. Yeni randevu için bizi arayabilir veya siteden tekrar alabilirsiniz.`;

async function onNewAppointment(a) {
  await Promise.all([
    sendSms(OWNER(), ownerText(a)),
    sendWhatsApp(OWNER(), ownerText(a), [a.name, svc(a), prettyDate(a.date), a.time]),
    sendSms(a.phone, customerReceived(a)),
  ]);
}
async function onStatusChange(a) {
  const text = a.status === 'confirmed' ? customerConfirmed(a) : customerCancelled(a);
  await Promise.all([sendSms(a.phone, text), sendWhatsApp(a.phone, text, [a.name, svc(a), prettyDate(a.date), a.time])]);
}

// wa.me bağlantıları (API gerektirmez)
const wa = (num, text) => `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
const ownerWhatsAppLink = (a) => wa(OWNER(), `Merhaba, siteden randevu aldım 🌸\nAd: ${a.name}\nHizmet: ${svc(a)}\nTarih: ${prettyDate(a.date)} ${a.time}${a.note ? '\nNot: ' + a.note : ''}`);
const customerWhatsAppLink = (a) => wa(a.phone, a.status === 'cancelled' ? customerCancelled(a) : a.status === 'confirmed' ? customerConfirmed(a) : `${SALON()}: Merhaba ${a.name}, ${prettyDate(a.date)} ${a.time} randevunuzu (${svc(a)}) onaylıyor musunuz?`);

module.exports = { normalizePhone, displayPhone, onNewAppointment, onStatusChange, ownerWhatsAppLink, customerWhatsAppLink, readOutbox };
