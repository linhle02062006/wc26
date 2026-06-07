// schedule.js
let allM = [], groupsData = {}, teamsData = [], curFilter = 'all', curTab = 'matches';
const socket = io();
socket.on('viewers:count', c => updateViewerCount(c));
socket.on('matches:synced', () => load());

// Build nav
(function buildNav() {
  const u = getUser();
  document.getElementById('siteLogoLink').innerHTML = icon('trophy',22) + '<span>WC 2026</span>';
  document.getElementById('hamburgerBtn').innerHTML = icon('menu',22);
  const nav = document.getElementById('nav');
  const mob = document.getElementById('mobMenu');
  let l = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/schedule" class="active">${icon('calendar',16)} Lịch thi đấu</a>`;
  if (u) { l += `<a href="/admin">${icon('layout',16)} ${u.role==='host'?'Bảng điều khiển':'Phòng xem'}</a><a href="#" class="nav-danger" onclick="logout()">${icon('logOut',16)}</a>`; }
  else l += `<a href="/login">${icon('logIn',16)} Đăng nhập</a>`;
  nav.innerHTML = l;
  mob.innerHTML = l.replace('class="active"','');
})();

async function load() {
  document.getElementById('loadingState').style.display = 'block';
  document.getElementById('viewMatches').style.display = 'none';
  document.getElementById('viewGroups').style.display = 'none';
  document.getElementById('viewFavMatches').style.display = 'none';
  document.getElementById('viewFavTeams').style.display = 'none';
  document.getElementById('hotSection').style.display = 'none';
  
  try {
    const [rm, rg, rt] = await Promise.all([
      fetch('/api/worldcup/matches').then(r => r.json()),
      fetch('/api/worldcup/groups').then(r => r.json()),
      fetch('/api/worldcup/teams').then(r => r.json())
    ]);
    
    if (!rm.success) {
      document.getElementById('loadingState').innerHTML = `<div class="empty">${icon('x',40)}<p>${rm.message || 'Lỗi tải dữ liệu'}</p></div>`;
      return;
    }
    
    if (!rm.matches || rm.matches.length === 0) {
      document.getElementById('loadingState').innerHTML = `<div class="empty">${icon('calendar',40)}<p>Lịch thi đấu chính thức chưa được cập nhật.</p></div>`;
      return;
    }
    
    allM = rm.matches;
    groupsData = rg.success ? rg.groups : {};
    teamsData = rt.success ? rt.teams : [];
    
    populateFilters();
    renderHotMatches();
    switchTab(curTab);
    
    document.getElementById('loadingState').style.display = 'none';
  } catch (e) {
    document.getElementById('loadingState').innerHTML = `<div class="empty">${icon('x',40)}<p>Không thể tải lịch từ API. Vui lòng thử lại sau.</p><button onclick="load()" class="btn btn-p" style="margin-top:10px">Tải lại lịch</button></div>`;
  }
}

function populateFilters() {
  const ts = new Set(), gs = new Set(), vs = new Set();
  allM.forEach(m => { 
    if (m.home?.name && m.home.name !== 'TBD') ts.add(m.home.name); 
    if (m.away?.name && m.away.name !== 'TBD') ts.add(m.away.name); 
    if (m.group) gs.add(m.group);
    if (m.venue) vs.add(m.venue);
  });
  
  const tf = document.getElementById('teamF');
  if (tf) tf.innerHTML = '<option value="">Tất cả đội</option>' + [...ts].sort().map(t => `<option value="${t}">${t}</option>`).join('');
  
  const gf = document.getElementById('groupF');
  if (gf) gf.innerHTML = '<option value="">Tất cả bảng</option>' + [...gs].sort().map(g => `<option value="${g}">${g}</option>`).join('');

  const vf = document.getElementById('venueF');
  if (vf) vf.innerHTML = '<option value="">Tất cả sân</option>' + [...vs].sort().map(v => `<option value="${v}">${v}</option>`).join('');
}

function renderHotMatches() {
  const c = document.getElementById('hotGrid');
  const sec = document.getElementById('hotSection');
  
  // Find top matches (e.g. final, semi, or just upcoming)
  const tzOptsTime = { timeZone: 'Asia/Ho_Chi_Minh' };
  const nowVN = new Date(new Date().toLocaleString("en-US", tzOptsTime)).getTime();
  
  let hot = allM.filter(m => m.round && (m.round.toLowerCase().includes('chung kết') || m.round.toLowerCase().includes('bán kết')));
  if (hot.length === 0) {
    hot = allM.filter(m => {
      const mTimeVN = new Date(new Date(m.dateUtc).toLocaleString("en-US", tzOptsTime)).getTime();
      return (m.statusShort === 'NS' || m.statusShort === 'TBD') || mTimeVN > nowVN - 2*3600*1000;
    }).slice(0, 3);
  }
  
  if (hot.length > 0) {
    c.innerHTML = hot.map(m => matchCard(m)).join('');
    sec.style.display = 'block';
  } else {
    sec.style.display = 'none';
  }
}

function renderMatches() {
  const c = document.getElementById('matchesGrid');
  const gf = document.getElementById('groupF')?.value || '';
  const tf = document.getElementById('teamF')?.value || '';
  const vf = document.getElementById('venueF')?.value || '';
  const searchQ = (document.getElementById('searchF')?.value || '').toLowerCase();
  
  let f = [...allM];
  
  const tzOpts = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const todayStr = new Intl.DateTimeFormat('en-CA', tzOpts).format(new Date()); 
  const tzOptsTime = { timeZone: 'Asia/Ho_Chi_Minh' };
  const nowVN = new Date(new Date().toLocaleString("en-US", tzOptsTime)).getTime();
  
  if (curFilter === 'today') {
    f = f.filter(m => {
      const mDateStr = new Intl.DateTimeFormat('en-CA', tzOpts).format(new Date(m.dateUtc));
      return mDateStr === todayStr;
    });
  } else if (curFilter === 'upcoming') {
    f = f.filter(m => {
      const mTimeVN = new Date(new Date(m.dateUtc).toLocaleString("en-US", tzOptsTime)).getTime();
      return (m.statusShort === 'NS' || m.statusShort === 'TBD') || mTimeVN > nowVN - 2*3600*1000;
    });
  } else if (curFilter === 'hot') {
    f = f.filter(m => m.round && (m.round.toLowerCase().includes('final') || m.round.toLowerCase().includes('semi')));
  } else if (curFilter === 'group') {
    f = f.filter(m => m.group && m.group !== '');
  } else if (curFilter === 'round32') {
    f = f.filter(m => m.round && m.round.toLowerCase().includes('32'));
  } else if (curFilter === 'round16') {
    f = f.filter(m => m.round && m.round.toLowerCase().includes('16'));
  } else if (curFilter === 'quarter') {
    f = f.filter(m => m.round && m.round.toLowerCase().includes('tứ kết'));
  } else if (curFilter === 'semi') {
    f = f.filter(m => m.round && m.round.toLowerCase().includes('bán kết'));
  } else if (curFilter === 'final') {
    f = f.filter(m => m.round && (m.round.toLowerCase().includes('chung kết') || m.round.toLowerCase().includes('tranh hạng ba')));
  }
  
  if (gf) f = f.filter(m => m.group === gf);
  if (tf) f = f.filter(m => m.home?.name === tf || m.away?.name === tf);
  if (vf) f = f.filter(m => m.venue === vf);
  if (searchQ) {
    f = f.filter(m => 
      (m.home?.name || '').toLowerCase().includes(searchQ) ||
      (m.away?.name || '').toLowerCase().includes(searchQ) ||
      (m.venue || '').toLowerCase().includes(searchQ) ||
      (m.city || '').toLowerCase().includes(searchQ)
    );
  }
  
  f.sort((a,b) => new Date(a.dateUtc) - new Date(b.dateUtc));
  c.innerHTML = f.length ? f.map(m => matchCard(m)).join('') : `<div class="empty">${icon('calendar',40)}<p>Không có trận nào phù hợp với bộ lọc hiện tại.</p></div>`;
}

function renderGroups() {
  const c = document.getElementById('groupsGrid');
  if (Object.keys(groupsData).length === 0) {
    c.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('info',40)}<p>Bảng đấu chính thức chưa được cập nhật.</p></div>`;
    return;
  }
  
  let html = '';
  for (const g in groupsData) {
    const teams = groupsData[g];
    let thtml = '';
    teams.forEach(t => {
      let logo = t.logo ? `<img src="${t.logo}" alt="${t.name}">` : `<div style="width:24px;height:24px;border-radius:50%;background:rgba(255,255,255,0.1);display:flex;align-items:center;justify-content:center;font-size:10px;">${t.name.substring(0,2).toUpperCase()}</div>`;
      thtml += `<div class="group-team">${logo} <span>${t.name}</span></div>`;
    });
    html += `<div class="group-card"><div class="group-title">${g}</div>${thtml}</div>`;
  }
  c.innerHTML = html;
}

window.renderFavMatches = function() {
  const c = document.getElementById('favMatchesGrid');
  if (curTab !== 'fav-matches') return;
  const favs = getFavMatches();
  const f = allM.filter(m => favs.includes(m.id));
  c.innerHTML = f.length ? f.map(m => matchCard(m)).join('') : `<div class="empty">${icon('heart',40)}<p>Chưa có trận đấu yêu thích.</p></div>`;
}

window.renderFavTeams = function() {
  const c = document.getElementById('favTeamsGrid');
  if (curTab !== 'fav-teams') return;
  const favs = getFavTeams();
  const f = teamsData.filter(t => favs.includes(t.id));
  
  if (f.length === 0) {
    c.innerHTML = `<div class="empty" style="grid-column:1/-1">${icon('heart',40)}<p>Chưa có đội yêu thích.</p></div>`;
    return;
  }
  
  c.innerHTML = f.map(t => {
    let logo = t.logo ? `<img src="${t.logo}" alt="${t.name}" style="width:50px;height:50px;object-fit:contain;margin-bottom:10px;border-radius:50%;">` : '';
    return `<div class="team-item" style="flex-direction:column; justify-content:center; padding:20px; text-align:center;">
      ${logo}
      <div style="font-size:1.1rem; font-weight:bold;">${t.name}</div>
      <button class="fav-btn active" onclick="toggleFavTeam(${t.id}, this)" style="margin-top:10px;">
        <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg> Bỏ yêu thích
      </button>
    </div>`;
  }).join('');
}

function switchTab(tabId) {
  curTab = tabId;
  document.querySelectorAll('.sch-tab').forEach(t => t.classList.remove('act'));
  document.querySelector(`.sch-tab[data-tab="${tabId}"]`).classList.add('act');
  
  document.getElementById('viewMatches').style.display = 'none';
  document.getElementById('viewGroups').style.display = 'none';
  document.getElementById('viewFavMatches').style.display = 'none';
  document.getElementById('viewFavTeams').style.display = 'none';
  
  if (tabId === 'matches') {
    document.getElementById('viewMatches').style.display = 'block';
    renderMatches();
  } else if (tabId === 'groups') {
    document.getElementById('viewGroups').style.display = 'block';
    renderGroups();
  } else if (tabId === 'fav-matches') {
    document.getElementById('viewFavMatches').style.display = 'block';
    window.renderFavMatches();
  } else if (tabId === 'fav-teams') {
    document.getElementById('viewFavTeams').style.display = 'block';
    window.renderFavTeams();
  }
}

// Event Listeners
document.getElementById('schTabs')?.addEventListener('click', e => {
  if (e.target.classList.contains('sch-tab')) switchTab(e.target.dataset.tab);
});

document.getElementById('filters')?.addEventListener('click', e => {
  if (e.target.classList.contains('f-btn')) {
    document.querySelectorAll('.f-btn').forEach(b => b.classList.remove('act'));
    e.target.classList.add('act'); curFilter = e.target.dataset.filter; renderMatches();
  }
});
document.getElementById('groupF')?.addEventListener('change', renderMatches);
document.getElementById('teamF')?.addEventListener('change', renderMatches);
document.getElementById('venueF')?.addEventListener('change', renderMatches);
document.getElementById('searchF')?.addEventListener('input', renderMatches);

load();
