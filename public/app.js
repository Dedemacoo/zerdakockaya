'use strict';
const $ = (s, r = document) => r.querySelector(s);
const el = (tag, attrs = {}, ...kids) => {
  const e = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v === null || v === undefined || v === false && k === 'disabled') continue;
    if (k === 'class') e.className = v;
    else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
    else e.setAttribute(k, v === true && k === 'disabled' ? '' : v);
  }
  kids.flat().forEach((c) => e.append(c));
  return e;
};
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const DAYS_S = ['Paz', 'Pzt', 'Sal', 'Çar', 'Per', 'Cum', 'Cmt'];
const pretty = (s) => { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${DAYS[d.getUTCDay()]}`; };
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00Z'); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const mins = (m) => (m >= 60 ? `${Math.floor(m / 60)} sa${m % 60 ? ' ' + (m % 60) + ' dk' : ''}` : `${m} dk`);

const ICONS = {
  lip: '<path d="M3 13c3-4 6-5 9-2 3-3 6-2 9 2-3 5-6 7-9 7s-6-2-9-7z"/><path d="M3 13c6 2 12 2 18 0"/>',
  hair: '<path d="M7 4c-3 4-3 9 0 13M17 4c3 4 3 9 0 13M12 3c-2 5-2 11 0 16"/><path d="M5 21h14"/>',
  nail: '<path d="M8 21V10a4 4 0 0 1 8 0v11"/><path d="M8 14h8"/>',
  hand: '<path d="M8 13V5a1.5 1.5 0 0 1 3 0v6M11 11V4a1.5 1.5 0 0 1 3 0v7M14 11V6a1.5 1.5 0 0 1 3 0v8c0 4-2 7-6 7-3 0-4-2-6-5l-1-3a1.5 1.5 0 0 1 3-1l1 2"/>',
  drop: '<path d="M12 3c4 5 6 8 6 11a6 6 0 0 1-12 0c0-3 2-6 6-11z"/><path d="M9 15a3 3 0 0 0 3 3"/>',
  lash: '<path d="M3 14c4 4 14 4 18 0"/><path d="M5 12l-2-3M9 14l-1-4M12 15v-4M15 14l1-4M19 12l2-3"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  brow: '<path d="M3 13c3-5 9-7 18-3"/><path d="M6 17h12" opacity=".5"/>',
};
const icon = (k) => { const s = el('span', { class: 'ico' }); s.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${ICONS[k] || ICONS.lip}</svg>`; return s; };
const get = async (u) => { const r = await fetch(u); const j = await r.json().catch(() => ({})); if (!r.ok) throw new Error(j.error || 'Hata'); return j; };

let cfg;
const state = { services: new Set(), date: null, time: null, step: 1 };

// ---------- optik: ayrık görsel yükleyici ----------
function probe(src) { return new Promise((res) => { const i = new Image(); i.onload = () => res(src); i.onerror = () => res(null); i.src = src; }); }

async function initImages() {
  const logo = await probe('img/logo.png') || await probe('img/logo.svg') || await probe('img/logo.webp');
  if (logo) { $('#logoImg').src = logo; $('#logoImg').hidden = false; $('.brand-text').hidden = true; }
  const hero = await probe('img/hero.jpg') || await probe('img/hero.webp') || await probe('img/hero.png');
  if (hero) { $('#heroImg').src = hero; $('#heroImg').hidden = false; $('#heroFallback').hidden = true; }
  const g = $('#gallery');
  const names = ['Makyaj', 'Saç Tasarımı', 'Kalıcı Oje', 'Kirpik', 'Protez Tırnak', 'Kaş Laminasyonu', 'Manikür', 'Kirpik Lifting'];
  const heights = [300, 240, 340, 260, 320, 230, 280, 310];
  const tiles = await Promise.all(names.map(async (n, i) => {
    const src = await probe(`img/gallery/${i + 1}.jpg`) || await probe(`img/gallery/${i + 1}.webp`) || await probe(`img/gallery/${i + 1}.png`);
    if (src) return el('figure', { class: 'g-item reveal' }, el('img', { src, alt: `Zerda Koçkaya — ${n}`, loading: 'lazy' }));
    const f = el('figure', { class: 'g-item g-ph reveal', style: `height:${heights[i]}px` }, n);
    return f;
  }));
  tiles.forEach((t) => g.append(t));
  observe();
}

// ---------- içerik ----------
function renderStatic() {
  const names = cfg.services.map((s) => s.name);
  const m = $('#marquee');
  for (let i = 0; i < 2; i++) names.forEach((n) => m.append(el('span', {}, n)));
  const cards = $('#cards');
  cfg.services.forEach((s) => {
    cards.append(el('article', { class: 'card reveal', onclick: () => { preselect(s.id); } },
      icon(s.icon), el('h3', {}, s.name), el('p', {}, s.desc),
      el('div', { class: 'meta' }, el('span', {}, '≈ ' + mins(s.duration)), el('a', { href: '#randevu', onclick: (e) => { e.stopPropagation(); preselect(s.id); } }, 'Randevu al →'))));
  });
  const ig = cfg.salon.instagramUrl; $('#igLink').href = ig; $('#igHandle').href = ig; $('#igHandle').textContent = '@' + cfg.salon.instagram;
  // çalışma saatleri
  const h = cfg.hours, open = Object.keys(h).map(Number).sort();
  if (open.length) {
    const first = h[open[0]]; const same = open.every((d) => h[d][0] === first[0] && h[d][1] === first[1]);
    const order = [1, 2, 3, 4, 5, 6, 0]; const od = order.filter((d) => h[d]);
    $('#hoursText').textContent = same ? `${DAYS[od[0]]}–${DAYS[od[od.length - 1]]} ${first[0]}–${first[1]}` : od.map((d) => `${DAYS_S[d]} ${h[d][0]}–${h[d][1]}`).join(' · ');
  }
  $('#yr').textContent = new Date().getFullYear();
}

function preselect(id) {
  state.services = new Set([id]); state.date = state.time = null; goStep(1); renderChips(); update();
  document.getElementById('randevu').scrollIntoView({ behavior: 'smooth' });
}

// ---------- randevu sihirbazı ----------
const duration = () => [...state.services].reduce((s, id) => s + cfg.services.find((x) => x.id === id).duration, 0);

function renderChips() {
  const box = $('#svcChips'); box.innerHTML = '';
  cfg.services.forEach((s) => box.append(el('button', { type: 'button', class: 'sv', 'aria-pressed': state.services.has(s.id), onclick: () => {
    state.services.has(s.id) ? state.services.delete(s.id) : state.services.add(s.id);
    state.date = state.time = null; renderChips(); update();
  } }, s.name)));
  $('#durHint').textContent = state.services.size ? `Tahmini süre: ${mins(duration())}` : 'Birden fazla seçebilirsiniz.';
}

function renderDates() {
  const box = $('#dates'); box.innerHTML = '';
  for (let i = 0; i <= cfg.maxAdvanceDays; i++) {
    const d = addDays(cfg.today, i); const dw = new Date(d + 'T00:00:00Z').getUTCDay();
    const closed = !cfg.hours[dw] || cfg.closedDates.includes(d);
    box.append(el('button', { type: 'button', class: 'd', role: 'option', 'aria-selected': state.date === d, disabled: closed, 'data-d': d, onclick: () => selectDate(d) },
      el('small', {}, i === 0 ? 'Bugün' : DAYS_S[dw]), el('b', {}, String(+d.slice(8))), el('small', {}, MONTHS[+d.slice(5, 7) - 1].slice(0, 3))));
  }
}

async function selectDate(d) {
  state.date = d; state.time = null; renderDates(); update();
  const t = $('#times'); t.innerHTML = '<p class="hint">Saatler yükleniyor…</p>';
  try {
    const r = await get(`/api/slots?date=${d}&services=${[...state.services].join(',')}`);
    t.innerHTML = '';
    if (!r.slots.length) t.append(el('p', { class: 'hint' }, 'Bu gün için uygun saat kalmadı. Lütfen başka bir gün seçin.'));
    r.slots.forEach((s) => t.append(el('button', { type: 'button', class: 't', 'aria-pressed': 'false', onclick: (e) => { state.time = s; t.querySelectorAll('.t').forEach((b) => b.setAttribute('aria-pressed', 'false')); e.currentTarget.setAttribute('aria-pressed', 'true'); update(); } }, s)));
  } catch (e) { t.innerHTML = ''; t.append(el('p', { class: 'hint' }, e.message)); }
}

function goStep(n) {
  state.step = n;
  document.querySelectorAll('.step').forEach((s) => (s.hidden = +s.dataset.step !== n));
  document.querySelectorAll('#progress i').forEach((i, k) => i.classList.toggle('on', k < n));
  $('#backBtn').hidden = n === 1 || n === 4;
  $('#wizNav').hidden = n === 4;
  $('#nextBtn').textContent = n === 3 ? 'Randevuyu Gönder' : 'Devam';
  if (n === 2) renderDates();
  if (n === 3) $('#summary').innerHTML = `<b>${[...state.services].map((id) => cfg.services.find((s) => s.id === id).name).join(' + ')}</b><br>${pretty(state.date)} · ${state.time} (≈ ${mins(duration())})`;
  update();
}

function update() {
  const n = $('#nextBtn');
  n.disabled = (state.step === 1 && !state.services.size) || (state.step === 2 && !(state.date && state.time));
  $('#durHint').textContent = state.services.size ? `Tahmini süre: ${mins(duration())}` : 'Birden fazla seçebilirsiniz.';
}

async function submit() {
  const f = $('#form'); const err = $('#err'); err.textContent = '';
  const body = { services: [...state.services], date: state.date, time: state.time, name: f.name.value, phone: f.phone.value, note: f.note.value, website: f.website.value };
  if (body.name.trim().length < 2) return (err.textContent = 'Lütfen adınızı yazın.');
  if (!/^(\+?90|0)?\s?5\d{2}[\s-]?\d{3}[\s-]?\d{2}[\s-]?\d{2}$/.test(body.phone.trim())) return (err.textContent = 'Geçerli bir cep telefonu girin (5XX XXX XX XX).');
  const b = $('#nextBtn'); b.disabled = true; b.textContent = 'Gönderiliyor…';
  try {
    const r = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const j = await r.json();
    if (!r.ok) { err.textContent = j.error || 'Bir hata oluştu.'; if (r.status === 409) { goStep(2); selectDate(state.date); } b.disabled = false; b.textContent = 'Randevuyu Gönder'; return; }
    const a = j.appointment;
    $('#doneText').textContent = `${a.name}, ${pretty(a.date)} saat ${a.time} için ${a.serviceNames.join(', ')} randevu talebiniz bize ulaştı.`;
    $('#waBtn').href = j.whatsappLink;
    $('#icsBtn').onclick = () => downloadIcs(a);
    goStep(4);
  } catch { err.textContent = 'Bağlantı hatası. Lütfen tekrar deneyin.'; b.disabled = false; b.textContent = 'Randevuyu Gönder'; }
}

function downloadIcs(a) {
  const [y, m, d] = a.date.split('-'); const [hh, mm] = a.time.split(':');
  const start = `${y}${m}${d}T${hh}${mm}00`;
  const ics = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Zerda//TR', 'BEGIN:VEVENT', `UID:${a.id}@zerda`, `DTSTAMP:${start}`, `DTSTART;TZID=Europe/Istanbul:${start}`, `DURATION:PT${a.duration || 60}M`, `SUMMARY:Zerda Koçkaya — ${a.serviceNames.join(', ')}`, 'LOCATION:İpek Yolu Hafize Mah. Uzun Sk. No 67A Van', 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
  const url = URL.createObjectURL(new Blob([ics], { type: 'text/calendar' }));
  const link = el('a', { href: url, download: 'zerda-randevu.ics' }); document.body.append(link); link.click(); link.remove();
}

// ---------- etkileşim ----------
function observe() {
  const io = new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); } }), { threshold: .12 });
  document.querySelectorAll('.reveal:not(.in)').forEach((n, i) => { n.style.transitionDelay = (i % 4) * 70 + 'ms'; io.observe(n); });
}

(async function init() {
  window.addEventListener('scroll', () => $('#nav').classList.toggle('scrolled', scrollY > 20), { passive: true });
  if (matchMedia('(pointer:fine)').matches) window.addEventListener('pointermove', (e) => { const g = $('.glow'); g.style.left = e.clientX + 'px'; g.style.top = e.clientY + 'px'; });
  try { cfg = await get('/api/config'); } catch { $('#cards').textContent = 'Sunucuya ulaşılamadı.'; return; }
  renderStatic(); renderChips(); update(); initImages(); observe();
  $('#nextBtn').addEventListener('click', () => (state.step === 3 ? submit() : goStep(state.step + 1)));
  $('#backBtn').addEventListener('click', () => goStep(state.step - 1));
})();
