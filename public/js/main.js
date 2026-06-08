// ============================================================
// main.js — Shared utilities (no emojis, Lucide SVG icons)
// ============================================================

// --- SVG Icon helpers (inline, no external deps) ---
const ICONS = {
  calendar: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01M16 18h.01"/></svg>',
  tv: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="15" x="2" y="7" rx="2"/><polyline points="17 2 12 7 7 2"/></svg>',
  trophy: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6M18 9h1.5a2.5 2.5 0 0 0 0-5H18"/><path d="M4 22h16"/><path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"/><path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"/><path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"/></svg>',
  lock: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="11" x="3" y="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  home: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>',
  logIn: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" x2="3" y1="12" y2="12"/></svg>',
  logOut: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  stadium: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 20h20"/><path d="M5 20V8l7-5 7 5v12"/><path d="M9 20v-4h6v4"/></svg>',
  mic: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  micOff: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  monitor: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="14" x="2" y="3" rx="2"/><line x1="8" x2="16" y1="21" y2="21"/><line x1="12" x2="12" y1="17" y2="21"/></svg>',
  users: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
  settings: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>',
  check: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18"/><path d="m6 6 12 12"/></svg>',
  info: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/></svg>',
  alertTri: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>',
  play: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="6 3 20 12 6 21 6 3"/></svg>',
  square: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/></svg>',
  copy: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  zap: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z"/></svg>',
  layout: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></svg>',
  edit: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497z"/></svg>',
  trash: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/></svg>',
  menu: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="4" x2="20" y1="12" y2="12"/><line x1="4" x2="20" y1="6" y2="6"/><line x1="4" x2="20" y1="18" y2="18"/></svg>',
  radio: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="2"/><path d="M4.93 19.07a10 10 0 0 1 0-14.14"/><path d="M7.76 16.24a6 6 0 0 1 0-8.49"/><path d="m16.24 7.76a6 6 0 0 1 0 8.49"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>',
  shield: '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/></svg>',
};

function icon(name, w, h) {
  let svg = ICONS[name] || '';
  if (w) svg = svg.replace(/width="24"/, `width="${w}"`).replace(/height="24"/, `height="${h || w}"`);
  return svg;
}

// Hamburger
document.addEventListener('DOMContentLoaded', () => {
  const hb = document.getElementById('hamburgerBtn');
  const mm = document.getElementById('mobMenu');
  if (hb && mm) {
    hb.addEventListener('click', () => mm.classList.toggle('open'));
    mm.querySelectorAll('a').forEach(a => a.addEventListener('click', () => mm.classList.remove('open')));
  }
});

// Viewer count
function updateViewerCount(c) { const el = document.getElementById('viewerCount'); if (el) el.textContent = c; }

// Date format
function fmtDate(d) { return new Date(d).toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit', year: 'numeric' }); }
function fmtTime(d) { return new Date(d).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }); }
function fmtDT(d) { return fmtDate(d) + ' - ' + fmtTime(d); }

// Status badge
function statusBadge(statusVi, statusShort) {
  const ss = statusShort || '';
  if (ss === 'LIVE' || ss === '1H' || ss === '2H' || ss === 'HT') return `<span class="badge badge-live">LIVE / ${statusVi}</span>`;
  if (ss === 'FT' || ss === 'AET' || ss === 'PEN') return `<span class="badge badge-fin">${statusVi}</span>`;
  return `<span class="badge badge-up">${statusVi || 'Sắp diễn ra'}</span>`;
}

// Match card
function matchCard(m, opts = { showFav: true, showAdmin: true }) {
  const ss = m.statusShort || '';
  const live = ss === 'LIVE' || ss === '1H' || ss === '2H' || ss === 'HT';
  
  const homeImg = m.home?.flag || m.home?.logo;
  const awayImg = m.away?.flag || m.away?.logo;
  const homeCode = m.home?.code || m.home?.name?.substring(0,3) || '?';
  const awayCode = m.away?.code || m.away?.name?.substring(0,3) || '?';
  
  let homeLogo = homeImg ? `<img src="${homeImg}" alt="${m.home?.name||'TBD'}" width="36" height="24" style="object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="width:36px;height:24px;border-radius:4px;background:rgba(255,255,255,0.1);display:none;align-items:center;justify-content:center;font-size:10px;font-weight:700">${homeCode.toUpperCase()}</div>` : `<div style="width:36px;height:24px;border-radius:4px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${homeCode.toUpperCase()}</div>`;
  let awayLogo = awayImg ? `<img src="${awayImg}" alt="${m.away?.name||'TBD'}" width="36" height="24" style="object-fit:contain;" onerror="this.style.display='none';this.nextElementSibling.style.display='flex'"><div style="width:36px;height:24px;border-radius:4px;background:rgba(255,255,255,0.1);display:none;align-items:center;justify-content:center;font-size:10px;font-weight:700">${awayCode.toUpperCase()}</div>` : `<div style="width:36px;height:24px;border-radius:4px;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:700">${awayCode.toUpperCase()}</div>`;

  const isFavMatch = getFavMatches().includes(m.id);
  const favBtn = opts.showFav ? `<button class="fav-btn ${isFavMatch ? 'active' : ''}" onclick="toggleFavMatch('${m.id}', this)" title="Yêu thích trận này"><svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="${isFavMatch ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg></button>` : '';

  let adminBtn = '';
  const u = getUser();
  if (opts.showAdmin && u && u.role === 'host') {
    adminBtn = `<button class="btn btn-s" style="padding:4px 8px; font-size:0.75rem;" onclick="adminSelectMatch('${m.id}')">Chọn làm phòng xem</button>`;
  }

  const matchNo = m.matchNo ? `<span style="font-size:.75rem;color:var(--gold);font-weight:700">Trận ${m.matchNo}</span> · ` : '';
  const countryLabel = m.country ? ` · ${m.country}` : '';
  const statusV = m.statusVi || 'Sắp diễn ra';

  return `<div class="m-card ${live ? 'live' : ''}" data-mid="${m.id}">
    <div class="m-card-hdr">
      <span>${matchNo}${m.round || ''}${m.group ? ' · ' + m.group : ''}</span>
      <div style="display:flex;gap:8px;align-items:center;">
        ${statusBadge(statusV, ss)}
        ${favBtn}
      </div>
    </div>
    <div class="m-teams">
      <div class="team"><div class="team-flag">${homeLogo}</div><div class="team-name">${m.home?.name || 'TBD'}</div><div style="font-size:.7rem;color:var(--text3)">${m.home?.code || ''}</div></div>
      <div class="m-score"><span style="font-size:1.1rem;color:var(--text);font-weight:bold;">${m.timeVietnam || ''}</span><span style="font-size:.65rem;color:var(--text3);display:block;margin-top:2px">${m.timezoneLabel || ''}</span></div>
      <div class="team"><div class="team-flag">${awayLogo}</div><div class="team-name">${m.away?.name || 'TBD'}</div><div style="font-size:.7rem;color:var(--text3)">${m.away?.code || ''}</div></div>
    </div>
    <div class="m-venue" style="margin-top:10px;">${icon('stadium',14)} ${m.venue || 'Chưa xác định'} · ${m.city || ''}${countryLabel}</div>
    <div class="m-time">${m.fullDateVietnam || m.dateVietnam || ''}</div>
    ${adminBtn ? `<div class="m-card-actions">${adminBtn}</div>` : ''}
  </div>`;
}

// Fav Helpers
function getFavMatches() {
  try { return JSON.parse(localStorage.getItem('fav_matches')) || []; } catch { return []; }
}
function toggleFavMatch(id, btnEl) {
  let favs = getFavMatches();
  if (favs.includes(id)) {
    favs = favs.filter(x => x !== id);
    if (btnEl) { btnEl.classList.remove('active'); btnEl.querySelector('svg').setAttribute('fill', 'none'); }
  } else {
    favs.push(id);
    if (btnEl) { btnEl.classList.add('active'); btnEl.querySelector('svg').setAttribute('fill', 'currentColor'); }
  }
  localStorage.setItem('fav_matches', JSON.stringify(favs));
  // if we are in schedule page, maybe refresh fav tab if active
  if (window.renderFavMatches) window.renderFavMatches();
}

function getFavTeams() {
  try { return JSON.parse(localStorage.getItem('fav_teams')) || []; } catch { return []; }
}
function toggleFavTeam(teamId, btnEl) {
  if (!teamId) return;
  let favs = getFavTeams();
  if (favs.includes(teamId)) {
    favs = favs.filter(x => x !== teamId);
    if (btnEl) { btnEl.classList.remove('active'); btnEl.querySelector('svg').setAttribute('fill', 'none'); }
  } else {
    favs.push(teamId);
    if (btnEl) { btnEl.classList.add('active'); btnEl.querySelector('svg').setAttribute('fill', 'currentColor'); }
  }
  localStorage.setItem('fav_teams', JSON.stringify(favs));
  if (window.renderFavTeams) window.renderFavTeams();
}

async function adminSelectMatch(mid) {
  try {
    const r = await fetch('/api/rooms', {
      method: 'POST',
      headers: authH(),
      body: JSON.stringify({ currentMatchId: mid })
    });
    const data = await r.json();
    if (r.ok) {
      toast('Đã tạo phòng thành công!', 'ok');
      setTimeout(() => window.location.href = '/admin', 1000);
    } else {
      toast(data.error || 'Lỗi tạo phòng', 'err');
    }
  } catch (e) {
    toast('Lỗi kết nối', 'err');
  }
}

// Toast
function toast(msg, type = 'info') {
  const c = document.getElementById('toastC');
  if (!c) return;
  const ic = type === 'ok' ? 'check' : type === 'err' ? 'x' : type === 'host' ? 'radio' : 'info';
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  t.innerHTML = `${icon(ic, 16)}${msg}`;
  c.appendChild(t);
  setTimeout(() => { t.style.opacity = '0'; t.style.transform = 'translateX(20px)'; t.style.transition = 'all .3s'; setTimeout(() => t.remove(), 300); }, 5000);
}

// Auth helpers
function getToken() { return localStorage.getItem('wc_token'); }
function setToken(t) { localStorage.setItem('wc_token', t); }
function removeToken() { localStorage.removeItem('wc_token'); localStorage.removeItem('wc_user'); }
function getUser() { try { return JSON.parse(localStorage.getItem('wc_user')); } catch { return null; } }
function setUser(u) { localStorage.setItem('wc_user', JSON.stringify(u)); }
function authH() { const t = getToken(); return t ? { 'Authorization': `Bearer ${t}`, 'Content-Type': 'application/json' } : { 'Content-Type': 'application/json' }; }
function logout() { removeToken(); window.location.href = '/login'; }
