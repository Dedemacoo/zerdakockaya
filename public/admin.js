'use strict';
const app = document.getElementById('app');
const MONTHS = ['Ocak', 'Şubat', 'Mart', 'Nisan', 'Mayıs', 'Haziran', 'Temmuz', 'Ağustos', 'Eylül', 'Ekim', 'Kasım', 'Aralık'];
const DAYS = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
const LABEL = { pending: 'Bekliyor', confirmed: 'Onaylı', cancelled: 'İptal', done: 'Tamamlandı' };
const pretty = (s) => { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${DAYS[d.getUTCDay()]}`; };
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
let token = ''; try { token = localStorage.getItem('zerda_admin') || ''; } catch {}
let tab = 'upcoming', data = null;

async function api(path, opts = {}) {
  const r = await fetch(path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } });
  const j = await r.json().catch(() => ({}));
  if (r.status === 401 && path !== '/api/admin/login') { logout(); throw new Error('Oturum süresi doldu'); }
  if (!r.ok) throw new Error(j.error || 'Hata');
  return j;
}
function logout() { token = ''; try { localStorage.removeItem('zerda_admin'); } catch {} renderLogin(); }

function renderLogin(msg = '') {
  app.innerHTML = `<form class="login"><h1>Zerda <em>Yönetim</em></h1><input type="password" id="pw" placeholder="Şifre" autocomplete="current-password" autofocus><button class="primary">Giriş</button><p style="color:#b3123f;font-size:.9rem">${esc(msg)}</p></form>`;
  app.querySelector('form').onsubmit = async (e) => {
    e.preventDefault();
    try { const j = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ password: document.getElementById('pw').value }) }); token = j.token; try { localStorage.setItem('zerda_admin', token); } catch {} load(); }
    catch (err) { renderLogin(err.message); }
  };
}

async function load() {
  try { data = await api('/api/admin/appointments'); render(); } catch (e) { if (token) app.textContent = e.message; }
}

function render() {
  const t = data.today, list = data.appointments;
  const up = list.filter((a) => a.date >= t && a.status !== 'cancelled' && a.status !== 'done');
  const shown = { upcoming: up, pending: list.filter((a) => a.status === 'pending'), past: list.filter((a) => a.date < t || ['done', 'cancelled'].includes(a.status)).reverse(), all: [...list].reverse() }[tab];
  const stat = (n, l) => `<div class="stat"><b>${n}</b><span>${l}</span></div>`;
  let html = `<header><h1>Zerda <em>Randevular</em></h1><div><button id="ref">Yenile</button> <button id="out">Çıkış</button></div></header>
  <div class="stats">${stat(list.filter((a) => a.date === t && a.status !== 'cancelled').length, 'Bugün')}${stat(list.filter((a) => a.status === 'pending').length, 'Onay bekleyen')}${stat(up.length, 'Yaklaşan')}${stat(list.length, 'Toplam')}</div>
  <div class="tabs">${[['upcoming', 'Yaklaşan'], ['pending', 'Onay bekleyen'], ['past', 'Geçmiş / iptal'], ['all', 'Tümü'], ['log', 'Bildirim kaydı']].map(([k, l]) => `<button data-tab="${k}" aria-pressed="${tab === k}">${l}</button>`).join('')}</div><div id="body"></div>`;
  app.innerHTML = html;
  app.querySelectorAll('[data-tab]').forEach((b) => (b.onclick = () => { tab = b.dataset.tab; render(); }));
  document.getElementById('ref').onclick = load; document.getElementById('out').onclick = logout;
  const body = document.getElementById('body');
  if (tab === 'log') { api('/api/admin/outbox').then((j) => (body.innerHTML = `<pre>${esc(j.log.join('\n')) || 'Henüz kayıt yok.'}</pre>`)); return; }
  if (!shown.length) { body.innerHTML = '<p class="empty">Gösterilecek randevu yok.</p>'; return; }
  let cur = '';
  for (const a of shown) {
    if (a.date !== cur) { cur = a.date; body.insertAdjacentHTML('beforeend', `<h2 class="day">${pretty(a.date)}${a.date === t ? ' · bugün' : ''}</h2>`); }
    body.insertAdjacentHTML('beforeend', `<div class="item">
      <div class="time">${esc(a.time)}<small>${a.duration} dk</small></div>
      <div class="who"><b>${esc(a.name)}<span class="tag ${a.status}">${LABEL[a.status]}</span></b><span>${esc(a.serviceNames.join(', '))}</span><br><span><a href="tel:+${esc(a.phone)}">${esc(a.phoneDisplay)}</a>${a.note ? ' · “' + esc(a.note) + '”' : ''}</span></div>
      <div class="acts">
        ${a.status === 'pending' ? `<button class="primary" data-id="${a.id}" data-st="confirmed">Onayla</button>` : ''}
        ${a.status === 'confirmed' ? `<button data-id="${a.id}" data-st="done">Tamamlandı</button>` : ''}
        ${a.status !== 'cancelled' && a.status !== 'done' ? `<button class="danger" data-id="${a.id}" data-st="cancelled">İptal</button>` : ''}
        <a class="b" target="_blank" rel="noopener" href="${esc(a.customerWhatsApp)}">WhatsApp</a>
        <button class="danger" data-del="${a.id}" title="Kalıcı sil">Sil</button>
      </div></div>`);
  }
  body.querySelectorAll('[data-st]').forEach((b) => (b.onclick = async () => {
    if (b.dataset.st === 'cancelled' && !confirm('Randevu iptal edilsin ve müşteriye bildirilsin mi?')) return;
    b.disabled = true; try { await api('/api/admin/appointments/' + b.dataset.id, { method: 'PATCH', body: JSON.stringify({ status: b.dataset.st }) }); load(); } catch (e) { alert(e.message); b.disabled = false; }
  }));
  body.querySelectorAll('[data-del]').forEach((b) => (b.onclick = async () => { if (!confirm('Bu kayıt kalıcı olarak silinsin mi?')) return; try { await api('/api/admin/appointments/' + b.dataset.del, { method: 'DELETE' }); load(); } catch (e) { alert(e.message); } }));
}

token ? load() : renderLogin();
setInterval(() => { if (token && document.visibilityState === 'visible' && tab !== 'log') load(); }, 60000);
