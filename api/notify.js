'use strict';
/**
 * Vercel Serverless Function — Randevu E-Posta Bildirimi
 * Hedef: arjin.c508@gmail.com
 */
module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const a = req.body || {};
  const recipient = 'arjin.c508@gmail.com';
  const subject = `🌸 Yeni Randevu: ${a.name || 'Müşteri'} — ${(a.serviceNames || []).join(', ')}`;
  const text = `Yeni Randevu Bildirimi 🌸\n\n` +
    `Müşteri: ${a.name || '-'}\n` +
    `Telefon: ${a.phone || '-'}\n` +
    `Hizmet(ler): ${(a.serviceNames || []).join(', ')}\n` +
    `Tarih: ${a.date || '-'} Saat: ${a.time || '-'}\n` +
    `Süre: ${a.duration || 60} dakika\n` +
    (a.note ? `Not: ${a.note}\n` : '') +
    `\nYönetim Paneli: /admin`;

  console.log(`[Mail Bildirimi] -> ${recipient}: ${subject}`);

  // Resend API (Varsa ortam değişkeninden)
  if (process.env.RESEND_API_KEY) {
    try {
      const resp = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: 'Zerda Randevu <onboarding@resend.dev>',
          to: recipient,
          subject,
          text
        })
      });
      const data = await resp.json();
      return res.status(200).json({ ok: true, provider: 'resend', data });
    } catch (e) {
      console.error('Resend error:', e.message);
    }
  }

  return res.status(200).json({ ok: true, recipient, message: 'Bildirim kaydedildi' });
};
