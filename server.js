'use strict';
/**
 * Zerda Koçkaya — Randevu & Tanıtım Sitesi
 * Sıfır bağımlılık: yalnızca Node.js 18+ gerekir. `node server.js`
 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// ---------- .env yükleyici (dotenv gerektirmez) ----------
(function loadEnv() {
  const f = path.join(__dirname, '.env');
  if (!fs.existsSync(f)) return;
  for (const line of fs.readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
})();

const notify = require('./lib/notify');

const os = require('os');
const isVercel = Boolean(process.env.VERCEL);
const PORT = Number(process.env.PORT || 3000);
const PUBLIC = path.join(__dirname, 'public');
const DATA = isVercel ? os.tmpdir() : path.join(__dirname, 'data');
const APPTS_FILE = path.join(DATA, 'appointments.json');

const readJson = (f, d) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return d; } };
const settings = readJson(path.join(__dirname, 'data', 'settings.json'), {});
const services = readJson(path.join(__dirname, 'data', 'services.json'), []);

// Vercel üzerinde başlangıç randevu verisini kopyala
if (isVercel && !fs.existsSync(APPTS_FILE)) {
  const seed = path.join(__dirname, 'data', 'appointments.json');
  try { fs.copyFileSync(seed, APPTS_FILE); } catch { try { fs.writeFileSync(APPTS_FILE, '[]'); } catch {} }
}

const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'zerda2026';
if (!process.env.ADMIN_PASSWORD) console.warn('⚠  ADMIN_PASSWORD ayarlanmadı, varsayılan şifre kullanılıyor. .env dosyasında değiştirin!');

// Oturum anahtarı: .env'den ya da data/.secret dosyasından
let SECRET = process.env.SESSION_SECRET;
if (!SECRET) {
  const sf = path.join(DATA, '.secret');
  if (fs.existsSync(sf)) {
    SECRET = fs.readFileSync(sf, 'utf8');
  } else {
    SECRET = crypto.randomBytes(32).toString('hex');
    try { fs.writeFileSync(sf, SECRET, { mode: 0o600 }); } catch {}
  }
}

// ---------- Depolama ----------
let appts = readJson(APPTS_FILE, []);
function save() {
  try {
    const tmp = APPTS_FILE + '.tmp';
    fs.writeFileSync(tmp, JSON.stringify(appts, null, 2));
    fs.renameSync(tmp, APPTS_FILE);
  } catch (err) {
    console.error('Kayıt hatası:', err.message);
  }
}

// ---------- Zaman yardımcıları (Europe/Istanbul = UTC+3 sabit) ----------
const istanbulNow = () => new Date(Date.now() + 3 * 3600 * 1000);
const pad = (n) => String(n).padStart(2, '0');
const todayStr = () => { const d = istanbulNow(); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };
const nowMin = () => { const d = istanbulNow(); return d.getUTCHours() * 60 + d.getUTCMinutes(); };
const toMin = (t) => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
const toHHMM = (m) => `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
const isDate = (s) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !isNaN(Date.parse(s + 'T00:00:00Z'));
const dow = (s) => new Date(s + 'T00:00:00Z').getUTCDay();
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };

function dayInfo(date) {
  const hours = settings.hours || {};
  const h = hours[String(dow(date))];
  if (!h || (settings.closedDates || []).includes(date)) return null;
  return { open: toMin(h[0]), close: toMin(h[1]) };
}

function pickServices(ids) {
  if (!Array.isArray(ids) || !ids.length || ids.length > 6) return null;
  const list = ids.map((id) => services.find((s) => s.id === id));
  return list.includes(undefined) ? null : list;
}

function slotsFor(date, duration) {
  const info = dayInfo(date);
  if (!info) return [];
  const step = settings.slotMinutes || 30;
  const cap = settings.capacity || 1;
  const t = todayStr();
  if (date < t || date > addDays(t, settings.maxAdvanceDays || 30)) return [];
  const active = appts.filter((a) => a.date === date && a.status !== 'cancelled');
  const lead = settings.minLeadMinutes ?? 60;
  const out = [];
  for (let s = info.open; s + duration <= info.close; s += step) {
    if (date === t && s < nowMin() + lead) continue;
    const busy = active.filter((a) => { const as = toMin(a.time); return s < as + a.duration && as < s + duration; }).length;
    if (busy < cap) out.push(toHHMM(s));
  }
  return out;
}

// ---------- Yardımcılar ----------
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.avif': 'image/avif', '.ico': 'image/x-icon', '.mp4': 'video/mp4', '.woff2': 'font/woff2', '.txt': 'text/plain; charset=utf-8', '.xml': 'application/xml' };
const SEC = { 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'strict-origin-when-cross-origin', 'X-Frame-Options': 'SAMEORIGIN' };

function send(res, code, body, headers = {}) {
  const isObj = typeof body === 'object' && !Buffer.isBuffer(body);
  res.writeHead(code, { ...SEC, ...(isObj ? { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } : {}), ...headers });
  res.end(isObj ? JSON.stringify(body) : body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on('data', (c) => { size += c.length; if (size > 20000) { reject(Object.assign(new Error('too large'), { code: 413 })); req.destroy(); } else chunks.push(c); });
    req.on('end', () => { try { resolve(chunks.length ? JSON.parse(Buffer.concat(chunks).toString()) : {}); } catch { reject(Object.assign(new Error('bad json'), { code: 400 })); } });
  });
}

const hits = new Map();
function limited(ip, key, max, windowMs) {
  const k = key + ip, now = Date.now();
  const arr = (hits.get(k) || []).filter((t) => now - t < windowMs);
  arr.push(now); hits.set(k, arr);
  return arr.length > max;
}
setInterval(() => { const now = Date.now(); for (const [k, v] of hits) if (!v.some((t) => now - t < 3600e3)) hits.delete(k); }, 600e3).unref();

const sign = (p) => crypto.createHmac('sha256', SECRET).update(p).digest('base64url');
function makeToken() { const p = String(Date.now() + 12 * 3600e3); return p + '.' + sign(p); }
function checkToken(t) {
  if (!t) return false;
  const [p, s] = t.split('.');
  if (!p || !s || Number(p) < Date.now()) return false;
  const a = Buffer.from(sign(p)), b = Buffer.from(s);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
const isAdmin = (req) => checkToken((req.headers.authorization || '').replace(/^Bearer /, ''));
const safeEq = (a, b) => { const x = crypto.createHash('sha256').update(a).digest(), y = crypto.createHash('sha256').update(b).digest(); return crypto.timingSafeEqual(x, y); };

const clean = (s, n) => String(s || '').replace(/[\u0000-\u001f<>]/g, ' ').trim().slice(0, n);

// ---------- API ----------
async function api(req, res, url) {
  const ip = req.socket.remoteAddress || '';
  const p = url.pathname;

  if (req.method === 'GET' && p === '/api/config') {
    return send(res, 200, { salon: settings.salon, services, slotMinutes: settings.slotMinutes || 30, maxAdvanceDays: settings.maxAdvanceDays || 30, hours: settings.hours, closedDates: settings.closedDates || [], today: todayStr() });
  }

  if (req.method === 'GET' && p === '/api/slots') {
    const date = url.searchParams.get('date') || '';
    const picked = pickServices((url.searchParams.get('services') || '').split(',').filter(Boolean));
    if (!isDate(date) || !picked) return send(res, 400, { error: 'Geçersiz tarih veya hizmet.' });
    const duration = picked.reduce((s, x) => s + x.duration, 0);
    return send(res, 200, { date, duration, slots: slotsFor(date, duration) });
  }

  if (req.method === 'POST' && p === '/api/appointments') {
    if (limited(ip, 'book', 8, 3600e3)) return send(res, 429, { error: 'Çok fazla deneme. Lütfen biraz sonra tekrar deneyin.' });
    const b = await readBody(req);
    if (b.website) return send(res, 200, { ok: true }); // honeypot
    const picked = pickServices(b.services);
    const name = clean(b.name, 60);
    const phone = notify.normalizePhone(b.phone);
    const note = clean(b.note, 300);
    if (!picked) return send(res, 400, { error: 'Lütfen en az bir hizmet seçin.' });
    if (name.length < 2) return send(res, 400, { error: 'Lütfen adınızı yazın.' });
    if (!phone) return send(res, 400, { error: 'Geçerli bir cep telefonu girin (5XX XXX XX XX).' });
    if (!isDate(b.date) || !/^\d{2}:\d{2}$/.test(b.time || '')) return send(res, 400, { error: 'Tarih ve saat seçin.' });
    const duration = picked.reduce((s, x) => s + x.duration, 0);
    // Yarış koşulu yok: Node tek iş parçacıklı, kontrol + kayıt aynı tick içinde
    if (!slotsFor(b.date, duration).includes(b.time)) return send(res, 409, { error: 'Bu saat az önce doldu. Lütfen başka bir saat seçin.' });
    const mine = appts.filter((a) => a.phone === phone && a.status !== 'cancelled' && a.date >= todayStr()).length;
    if (mine >= 3) return send(res, 429, { error: 'Aktif randevu limitine ulaştınız. Lütfen salonu arayın.' });
    const appt = { id: crypto.randomBytes(4).toString('hex'), services: picked.map((s) => s.id), serviceNames: picked.map((s) => s.name), date: b.date, time: b.time, duration, name, phone, note, status: 'pending', createdAt: new Date().toISOString() };
    appts.push(appt); save();
    notify.onNewAppointment(appt).catch((e) => console.error('notify', e.message));
    return send(res, 201, { ok: true, appointment: { id: appt.id, duration: appt.duration, date: appt.date, time: appt.time, serviceNames: appt.serviceNames, name: appt.name }, whatsappLink: notify.ownerWhatsAppLink(appt) });
  }

  // ----- Yönetim -----
  if (req.method === 'POST' && p === '/api/admin/login') {
    if (limited(ip, 'login', 10, 15 * 60e3)) return send(res, 429, { error: 'Çok fazla deneme. 15 dakika sonra tekrar deneyin.' });
    const b = await readBody(req);
    if (!safeEq(String(b.password || ''), ADMIN_PASSWORD)) return send(res, 401, { error: 'Şifre hatalı.' });
    return send(res, 200, { token: makeToken() });
  }
  if (p.startsWith('/api/admin/')) {
    if (!isAdmin(req)) return send(res, 401, { error: 'Oturum gerekli.' });
    if (req.method === 'GET' && p === '/api/admin/appointments') {
      const list = [...appts].sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time)).map((a) => ({ ...a, customerWhatsApp: notify.customerWhatsAppLink(a), phoneDisplay: notify.displayPhone(a.phone) }));
      return send(res, 200, { appointments: list, today: todayStr() });
    }
    const m = p.match(/^\/api\/admin\/appointments\/([a-f0-9]+)$/);
    if (m) {
      const a = appts.find((x) => x.id === m[1]);
      if (!a) return send(res, 404, { error: 'Bulunamadı.' });
      if (req.method === 'PATCH') {
        const b = await readBody(req);
        if (!['pending', 'confirmed', 'cancelled', 'done'].includes(b.status)) return send(res, 400, { error: 'Geçersiz durum.' });
        const changed = a.status !== b.status; a.status = b.status; save();
        if (changed && ['confirmed', 'cancelled'].includes(b.status)) notify.onStatusChange(a).catch((e) => console.error('notify', e.message));
        return send(res, 200, { ok: true });
      }
      if (req.method === 'DELETE') { appts = appts.filter((x) => x.id !== a.id); save(); return send(res, 200, { ok: true }); }
    }
    if (req.method === 'GET' && p === '/api/admin/outbox') return send(res, 200, { log: notify.readOutbox() });
  }
  return send(res, 404, { error: 'Bulunamadı.' });
}

// ---------- Statik dosyalar ----------
function serveStatic(req, res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/') p = '/index.html';
  if (p === '/admin') p = '/admin.html';
  const file = path.normalize(path.join(PUBLIC, p));
  if (!file.startsWith(PUBLIC + path.sep)) return send(res, 403, 'Forbidden');
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, fs.existsSync(path.join(PUBLIC, '404.html')) ? fs.readFileSync(path.join(PUBLIC, '404.html')) : 'Sayfa bulunamadı', { 'Content-Type': 'text/html; charset=utf-8' });
    const ext = path.extname(file).toLowerCase();
    const img = /\.(png|jpe?g|webp|avif|svg|woff2|mp4)$/.test(ext);
    res.writeHead(200, { ...SEC, 'Content-Type': MIME[ext] || 'application/octet-stream', 'Content-Length': st.size, 'Cache-Control': img ? 'public, max-age=86400' : 'no-cache' });
    fs.createReadStream(file).pipe(res);
  });
}

const server = http.createServer(async (req, res) => {
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host || 'localhost';
    const proto = req.headers['x-forwarded-proto'] || 'http';
    const url = new URL(req.url, `${proto}://${host}`);
    if (url.pathname.startsWith('/api/')) return await api(req, res, url);
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    serveStatic(req, res, url);
  } catch (e) {
    if (e.code === 413 || e.code === 400) return send(res, e.code, { error: 'Geçersiz istek.' });
    console.error(e); send(res, 500, { error: 'Sunucu hatası.' });
  }
});

if (require.main === module && !isVercel) {
  server.listen(PORT, () => console.log(`\n  ✿ Zerda Koçkaya çalışıyor → http://localhost:${PORT}\n    Yönetim paneli → http://localhost:${PORT}/admin\n`));
}

module.exports = server;
