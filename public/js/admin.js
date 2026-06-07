// admin.js — Dashboard controller
const socket = io();
socket.on('viewers:count', c => updateViewerCount(c));

let aMatches = [];

// Auth check
(async function() {
  const t = getToken(), u = getUser();
  if (!t || !u) { window.location.href = '/login'; return; }
  try {
    const r = await fetch('/api/auth/me', { headers: authH() });
    if (!r.ok) { removeToken(); window.location.href = '/login'; return; }
    const me = await r.json();
    if (me.role === 'guest') {
      // Guests go to room if open
      const rm = await fetch('/api/rooms/current').then(r => r.json());
      if (rm.isOpen) { window.location.href = '/room/' + rm.roomId; return; }
      else { window.location.href = '/schedule'; return; }
    }
    initAdmin();
  } catch { window.location.href = '/login'; }
})();

function initAdmin() {
  buildAdminNav();
  buildSidebar();
  loadAll();
}

function buildAdminNav() {
  document.getElementById('siteLogoLink').innerHTML = icon('trophy',22)+'<span>WC 2026</span>';
  document.getElementById('hamburgerBtn').innerHTML = icon('menu',22);
  document.getElementById('nav').innerHTML = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/schedule">${icon('calendar',16)} Lịch</a><a href="/admin" class="active">${icon('layout',16)} Dashboard</a><a href="#" class="nav-danger" onclick="logout()">${icon('logOut',16)}</a>`;
  document.getElementById('mobMenu').innerHTML = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/schedule">${icon('calendar',16)} Lịch</a><a href="/admin">${icon('layout',16)} Dashboard</a><a href="#" onclick="logout()">${icon('logOut',16)} Đăng xuất</a>`;
}

function buildSidebar() {
  const tabs = [
    ['overview','Tổng quan','layout'],
    ['api-football','Lịch WC API','calendar'],
    ['room','Phòng Xem','monitor'],
    ['guests','Tài khoản','users'],
    ['settings','Cài đặt','settings']
  ];
  document.getElementById('sidebar').innerHTML = tabs.map(([id,label,ic],i) =>
    `<a class="${i===0?'act':''}" data-tab="${id}">${icon(ic,16)} ${label}</a>`
  ).join('');

  document.getElementById('sidebar').addEventListener('click', e => {
    const a = e.target.closest('[data-tab]');
    if (!a) return;
    document.querySelectorAll('.admin-side a').forEach(x => x.classList.remove('act'));
    document.querySelectorAll('.tab-c').forEach(x => x.classList.remove('act'));
    a.classList.add('act');
    document.getElementById('t-'+a.dataset.tab)?.classList.add('act');
  });

  // Set tab header icons
  document.getElementById('rmStatusH').innerHTML = icon('tv',16)+' Trạng thái phòng';
  document.getElementById('rmVoiceH').innerHTML = icon('mic',16)+' Voice Chat';
  document.getElementById('rmUsersH').innerHTML = icon('users',16)+' Người trong phòng';
}

async function loadAll() {
  await loadMatches();
  loadOverview();
  loadRoom();
  loadGuests();
  loadSettings();
}

// === API Football Matches ===
async function loadMatches() {
  const r = await fetch('/api/worldcup/matches');
  const data = await r.json();
  if (data.success && data.matches) {
    aMatches = data.matches;
  } else {
    aMatches = [];
  }
  
  // Populate room select
  const rmSel = document.getElementById('rmMatch');
  if (rmSel) {
    const v = rmSel.value;
    rmSel.innerHTML = '<option value="">-- Chọn trận đấu --</option>' + aMatches.map(m => `<option value="${m.id}">${m.home?.name || 'TBD'} vs ${m.away?.name || 'TBD'} (${m.timeVietnam || ''} ${m.dateVietnam || ''})</option>`).join('');
    rmSel.value = v;
  }
}

async function syncApiFootball() {
  document.getElementById('syncStatus').textContent = 'Đang đồng bộ...';
  try {
    const r = await fetch('/api/worldcup/sync', { method: 'POST', headers: authH() });
    const res = await r.json();
    if (r.ok) {
      toast(`Đã đồng bộ ${res.count} trận`, 'ok');
      document.getElementById('syncStatus').textContent = `Đồng bộ lần cuối: ${new Date(res.lastSyncAt).toLocaleString('vi-VN')}`;
      await loadMatches();
      loadOverview();
    } else {
      toast(res.error || 'Lỗi đồng bộ', 'err');
      document.getElementById('syncStatus').textContent = 'Lỗi đồng bộ. Kiểm tra lại .env hoặc API Key.';
    }
  } catch (e) {
    toast('Lỗi kết nối', 'err');
    document.getElementById('syncStatus').textContent = 'Lỗi kết nối';
  }
}

async function clearDemoData() {
  if (!confirm('Xóa dữ liệu demo hiện tại?')) return;
  try {
    const r = await fetch('/api/worldcup/demo-clear', { method: 'POST', headers: authH() });
    if (r.ok) {
      toast('Đã xóa dữ liệu demo', 'ok');
      await loadMatches();
      loadOverview();
    }
  } catch (e) { toast('Lỗi', 'err'); }
}

async function searchLeagueId() {
  const el = document.getElementById('leagueSearchResults');
  el.innerHTML = 'Đang tìm kiếm...';
  try {
    const r = await fetch('/api/worldcup/league-search', { headers: authH() });
    const data = await r.json();
    if (!data || data.length === 0) {
      el.innerHTML = 'Không tìm thấy kết quả.';
      return;
    }
    el.innerHTML = '<table class="a-table"><thead><tr><th>ID</th><th>Tên</th><th>Quốc gia</th></tr></thead><tbody>' + 
      data.slice(0, 10).map(l => `<tr><td>${l.league.id}</td><td>${l.league.name}</td><td>${l.country.name}</td></tr>`).join('') +
      '</tbody></table>';
  } catch (e) { el.innerHTML = 'Lỗi tìm kiếm.'; }
}

async function testApi() {
  const el = document.getElementById('apiDebugResults');
  el.style.display = 'block';
  el.innerHTML = 'Đang kiểm tra API...';
  try {
    const r = await fetch('/api/worldcup/matches');
    const data = await r.json();
    el.innerHTML = JSON.stringify(data, null, 2);
  } catch (e) { el.innerHTML = 'Lỗi: ' + e.message; }
}

async function viewRawApi() {
  const el = document.getElementById('apiDebugResults');
  el.style.display = 'block';
  el.innerHTML = 'Đang lấy dữ liệu thô từ API-FOOTBALL...';
  try {
    const r = await fetch('/api/worldcup/raw', { headers: authH() });
    const data = await r.json();
    el.innerHTML = JSON.stringify(data, null, 2);
  } catch (e) { el.innerHTML = 'Lỗi: ' + e.message; }
}

async function importOfficialJson() {
  const fileInput = document.getElementById('importJsonFile');
  if (!fileInput.files || fileInput.files.length === 0) {
    toast('Vui lòng chọn file JSON.', 'err');
    return;
  }
  const file = fileInput.files[0];
  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const data = JSON.parse(e.target.result);
      const r = await fetch('/api/worldcup/import-official-json', {
        method: 'POST',
        headers: authH(),
        body: JSON.stringify(data)
      });
      const res = await r.json();
      if (r.ok) {
        toast(`Đã import thành công ${res.count} trận.`, 'ok');
        await loadMatches();
        loadOverview();
      } else {
        toast(res.error || 'Lỗi import.', 'err');
      }
    } catch (err) {
      toast('File JSON không hợp lệ.', 'err');
    }
  };
  reader.readAsText(file);
}

// === Overview ===
async function loadOverview() {
  const matches = aMatches || [];
  const tzOpts = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const todayStr = new Intl.DateTimeFormat('en-CA', tzOpts).format(new Date()); 
  
  const todayM = matches.filter(m => new Intl.DateTimeFormat('en-CA', tzOpts).format(new Date(m.dateUtc)) === todayStr);
  const liveM = matches.filter(m => m.statusShort === 'LIVE' || m.statusShort === '1H' || m.statusShort === '2H' || m.statusShort === 'HT');
  const room = await fetch('/api/rooms/current').then(r => r.json());

  document.getElementById('ovGrid').innerHTML = [
    ovCard('Trận hôm nay','calendar',todayM.length),
    ovCard('Đang LIVE','zap',liveM.length),
    ovCard('Tổng trận','trophy',matches.length),
    ovCard('Phòng xem','monitor',room.isOpen ? 'Mở' : 'Đóng'),
  ].join('');
}

function ovCard(label,ic,val) {
  return `<div class="ov-card"><div class="label">${icon(ic,14)} ${label}</div><div class="val">${val}</div></div>`;
}

// === Room ===
async function loadRoom() {
  const rm = await fetch('/api/rooms/current').then(r=>r.json());
  const sb = document.getElementById('rmStatusBody');
  if (rm.isOpen) {
    const link = window.location.origin+'/room/'+rm.roomId;
    sb.innerHTML = `<p style="color:var(--green);font-weight:600;margin-bottom:10px">Phòng đang mở</p>
      <div style="display:flex;gap:6px;align-items:center;margin-bottom:10px"><input class="fc" value="${link}" readonly id="rmLink" style="font-size:.8rem"><button class="btn btn-s btn-xs" onclick="navigator.clipboard.writeText('${link}');toast('Đã copy','ok')">${icon('copy',14)} Copy</button></div>
      <div style="display:flex;gap:8px"><button class="btn btn-d btn-sm" onclick="closeRoom('${rm.roomId}')">Đóng phòng</button>
      <a href="/room/${rm.roomId}" class="btn btn-p btn-sm">${icon('monitor',14)} Vào phòng</a></div>`;
      
      const rmSel = document.getElementById('rmMatch');
      if (rmSel) rmSel.value = rm.currentMatchId || '';
  } else {
    sb.innerHTML = `<p style="color:var(--text3);margin-bottom:10px">Chưa có phòng nào</p>
    <div style="margin-bottom:10px;"><select id="newRoomMatch" class="fc"><option value="">-- Chọn trận đấu trước khi tạo phòng --</option>${aMatches.map(m => `<option value="${m.id}">${m.home?.name || 'TBD'} vs ${m.away?.name || 'TBD'} (${m.timeVietnam || ''} ${m.dateVietnam || ''})</option>`).join('')}</select></div>
    <button class="btn btn-p btn-sm" onclick="createRoom()">Tạo phòng xem chung</button>`;
  }

  // Voice
  const vb = document.getElementById('rmVoiceBody');
  if (rm.isOpen) {
    vb.innerHTML = `<div style="display:flex;align-items:center;gap:10px;margin-bottom:8px"><label class="toggle"><input type="checkbox" ${rm.voiceEnabled?'checked':''} onchange="toggleVoice(this,'voice')"><span class="toggle-s"></span></label><span style="font-size:.85rem">Voice chat</span></div>
    <div style="display:flex;align-items:center;gap:10px"><label class="toggle"><input type="checkbox" ${rm.guestMicAllowed?'checked':''} onchange="toggleVoice(this,'mic')"><span class="toggle-s"></span></label><span style="font-size:.85rem">Cho phép khách bật mic</span></div>`;
  } else { vb.innerHTML = '<p style="color:var(--text3);font-size:.85rem">Tạo phòng trước</p>'; }

  // Users in room
  document.getElementById('rmUsersBody').innerHTML = rm.isOpen
    ? `<p style="font-size:.85rem;color:var(--text3)">${rm.guestCount||0}/2 khách trong phòng</p>`
    : '<p style="font-size:.85rem;color:var(--text3)">Phòng chưa mở</p>';
}

async function createRoom() {
  const matchId = document.getElementById('newRoomMatch')?.value;
  if (!matchId) {
    toast('Vui lòng chọn trận đấu.', 'err');
    return;
  }
  try {
    const r = await fetch('/api/rooms', { method: 'POST', headers: authH(), body: JSON.stringify({ currentMatchId: matchId }) });
    if (r.ok) { toast('Đã tạo phòng', 'ok'); loadRoom(); loadOverview(); }
    else { const data = await r.json(); toast(data.error || 'Lỗi', 'err'); }
  } catch { toast('Lỗi', 'err'); }
}

async function closeRoom(roomId) {
  if(!confirm('Đóng phòng?')) return;
  try {
    await fetch(`/api/rooms/${roomId}/close`,{method:'POST',headers:authH()});
    toast('Đã đóng phòng','ok'); loadRoom(); loadOverview();
  } catch { toast('Lỗi','err'); }
}

async function toggleVoice(el, type) {
  const rm = await fetch('/api/rooms/current').then(r=>r.json());
  if (!rm.isOpen) return;
  const body = type==='voice' ? {voiceEnabled:el.checked} : {guestMicAllowed:el.checked};
  await fetch(`/api/rooms/${rm.roomId}/voice`,{method:'PATCH',headers:authH(),body:JSON.stringify(body)});
  toast('Đã cập nhật','ok');
}

async function setRoomMatch() {
  const rm = await fetch('/api/rooms/current').then(r=>r.json());
  if (!rm.isOpen) return;
  const mid = document.getElementById('rmMatch').value;
  if (!mid) return;
  const r = await fetch(`/api/rooms/${rm.roomId}/current-match`,{method:'PATCH',headers:authH(),body:JSON.stringify({matchId:mid})});
  if (r.ok) toast('Đã cập nhật trận đang chiếu','ok');
  else { const data = await r.json(); toast(data.error || 'Lỗi', 'err'); }
}

// === Guests ===
async function loadGuests() {
  const r = await fetch('/api/users/guests',{headers:authH()});
  const guests = await r.json();
  document.getElementById('guestList').innerHTML = guests.map(g => `
    <div class="sc-card" style="margin-bottom:10px">
      <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:10px">
        <div><strong>${g.username}</strong> <span style="font-size:.78rem;color:var(--text3)">${g.active?'Hoạt động':'Vô hiệu hóa'}</span>
          ${g.currentSessionId?'<span class="badge badge-live" style="margin-left:6px">Đang online</span>':''}</div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          <label class="toggle"><input type="checkbox" ${g.active?'checked':''} onchange="toggleGuest('${g.id}',this.checked)"><span class="toggle-s"></span></label>
          <button class="btn btn-s btn-xs" onclick="resetGSession('${g.id}')">Reset phiên</button>
          <button class="btn btn-s btn-xs" onclick="changeGPw('${g.id}')">Đổi MK</button>
        </div>
      </div>
    </div>
  `).join('');
}

async function toggleGuest(id,active) {
  await fetch(`/api/users/guests/${id}/status`,{method:'PUT',headers:authH(),body:JSON.stringify({active})});
  toast('Đã cập nhật','ok'); loadGuests();
}
async function resetGSession(id) {
  await fetch(`/api/users/guests/${id}/reset-session`,{method:'POST',headers:authH()});
  toast('Đã reset phiên','ok'); loadGuests();
}
async function changeGPw(id) {
  const pw = prompt('Nhập mật khẩu mới (tối thiểu 4 ký tự):');
  if (!pw || pw.length < 4) return;
  await fetch(`/api/users/guests/${id}/password`,{method:'PUT',headers:authH(),body:JSON.stringify({password:pw})});
  toast('Đã đổi mật khẩu','ok');
}

// === Settings ===
async function loadSettings() {
  const s = await fetch('/api/settings').then(r=>r.json());
  document.getElementById('stTitle').value = s.siteTitle||'';
}
async function saveSt() {
  const body = { siteTitle: document.getElementById('stTitle').value };
  const pw = document.getElementById('stPw').value;
  if (pw) body.hostPassword = pw;
  const r = await fetch('/api/settings',{method:'PUT',headers:authH(),body:JSON.stringify(body)});
  if (r.ok) { toast('Đã lưu','ok'); document.getElementById('stPw').value=''; if(pw){toast('Đã đổi mật khẩu. Đăng nhập lại.','info');setTimeout(()=>{removeToken();window.location.href='/login';},2000);} }
  else toast('Lỗi','err');
}
