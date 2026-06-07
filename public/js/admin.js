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
    ['matches','Quản lý trận đấu','calendar'],
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

// === Match Management ===
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

  renderMatchesTable();
}

function renderMatchesTable() {
  const tb = document.getElementById('matchesTableBody');
  if (!tb) return;
  if (!aMatches || aMatches.length === 0) {
    tb.innerHTML = '<tr><td colspan="7" style="text-align:center">Chưa có dữ liệu.</td></tr>';
    return;
  }
  
  tb.innerHTML = aMatches.map((m, i) => {
    const homeScore = m.home?.score !== undefined ? m.home.score : '-';
    const awayScore = m.away?.score !== undefined ? m.away.score : '-';
    const status = m.statusShort || 'NS';
    
    return `
      <tr>
        <td><strong>${m.matchNo || ''}</strong><br><span style="font-size:0.8em;color:var(--text3)">${m.round || ''}</span></td>
        <td>${m.dateVietnam || ''}<br><strong style="color:var(--green)">${m.timeVietnam || ''}</strong></td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            ${m.home?.logo ? `<img src="${m.home.logo}" width="20" height="15" style="border-radius:2px;object-fit:cover">` : ''}
            <span>${m.home?.name || 'TBD'}</span>
          </div>
        </td>
        <td style="text-align:center;font-weight:bold;font-size:1.1em">${homeScore} - ${awayScore}</td>
        <td>
          <div style="display:flex;align-items:center;gap:6px">
            ${m.away?.logo ? `<img src="${m.away.logo}" width="20" height="15" style="border-radius:2px;object-fit:cover">` : ''}
            <span>${m.away?.name || 'TBD'}</span>
          </div>
        </td>
        <td><span class="badge ${status==='LIVE'?'badge-live':status==='FT'?'badge-fin':''}">${status}</span></td>
        <td>
          <button class="btn btn-s btn-xs" onclick="editMatch('${m.id}')">Sửa</button>
          <button class="btn btn-d btn-xs" onclick="deleteMatch('${m.id}')">Xóa</button>
        </td>
      </tr>
    `;
  }).join('');
}

function openMatchModal(id = null) {
  document.getElementById('matchModal').classList.add('open');
  if (id) {
    document.getElementById('mmTitle').textContent = 'Sửa trận đấu';
    const m = aMatches.find(x => x.id === id);
    if (!m) return;
    document.getElementById('mmId').value = m.id;
    document.getElementById('mmMatchNo').value = m.matchNo || '';
    document.getElementById('mmRound').value = m.round || '';
    document.getElementById('mmGroup').value = m.group || '';
    document.getElementById('mmVenue').value = m.venue || '';
    document.getElementById('mmDateVietnam').value = m.dateVietnam || '';
    document.getElementById('mmTimeVietnam').value = m.timeVietnam || '';
    
    document.getElementById('mmHomeName').value = m.home?.name || '';
    document.getElementById('mmHomeCode').value = m.home?.code || '';
    document.getElementById('mmHomeLogo').value = m.home?.logo || '';
    document.getElementById('mmHomeScore').value = m.home?.score !== undefined ? m.home.score : '';
    
    document.getElementById('mmAwayName').value = m.away?.name || '';
    document.getElementById('mmAwayCode').value = m.away?.code || '';
    document.getElementById('mmAwayLogo').value = m.away?.logo || '';
    document.getElementById('mmAwayScore').value = m.away?.score !== undefined ? m.away.score : '';
    
    document.getElementById('mmStatus').value = m.statusShort || 'NS';
  } else {
    document.getElementById('mmTitle').textContent = 'Thêm trận đấu';
    document.getElementById('mmId').value = '';
    ['mmMatchNo','mmRound','mmGroup','mmVenue','mmDateVietnam','mmTimeVietnam','mmHomeName','mmHomeCode','mmHomeLogo','mmHomeScore','mmAwayName','mmAwayCode','mmAwayLogo','mmAwayScore'].forEach(id => {
      document.getElementById(id).value = '';
    });
    document.getElementById('mmStatus').value = 'NS';
  }
}

function closeMatchModal() {
  document.getElementById('matchModal').classList.remove('open');
}

async function saveMatch() {
  const id = document.getElementById('mmId').value;
  const matchData = {
    matchNo: parseInt(document.getElementById('mmMatchNo').value) || null,
    round: document.getElementById('mmRound').value.trim(),
    group: document.getElementById('mmGroup').value.trim(),
    venue: document.getElementById('mmVenue').value.trim(),
    dateVietnam: document.getElementById('mmDateVietnam').value.trim(),
    timeVietnam: document.getElementById('mmTimeVietnam').value.trim(),
    statusShort: document.getElementById('mmStatus').value,
    home: {
      name: document.getElementById('mmHomeName').value.trim(),
      code: document.getElementById('mmHomeCode').value.trim(),
      logo: document.getElementById('mmHomeLogo').value.trim()
    },
    away: {
      name: document.getElementById('mmAwayName').value.trim(),
      code: document.getElementById('mmAwayCode').value.trim(),
      logo: document.getElementById('mmAwayLogo').value.trim()
    }
  };
  
  const hS = document.getElementById('mmHomeScore').value;
  if (hS !== '') matchData.home.score = parseInt(hS);
  const aS = document.getElementById('mmAwayScore').value;
  if (aS !== '') matchData.away.score = parseInt(aS);
  
  // calculate dateUtc for filtering
  if (matchData.dateVietnam && matchData.timeVietnam) {
    try {
      const parts = matchData.dateVietnam.split('/');
      if (parts.length === 3) {
        const isoStr = `${parts[2]}-${parts[1]}-${parts[0]}T${matchData.timeVietnam}:00+07:00`;
        matchData.dateUtc = new Date(isoStr).toISOString();
      }
    } catch (e) {}
  }

  const method = id ? 'PUT' : 'POST';
  const url = id ? `/api/worldcup/matches/${id}` : '/api/worldcup/matches';
  
  try {
    const r = await fetch(url, {
      method,
      headers: { ...authH(), 'Content-Type': 'application/json' },
      body: JSON.stringify(matchData)
    });
    
    if (r.ok) {
      toast('Đã lưu trận đấu', 'ok');
      closeMatchModal();
      await loadMatches();
      loadOverview();
    } else {
      const err = await r.json();
      toast(err.error || 'Lỗi lưu', 'err');
    }
  } catch (e) {
    toast('Lỗi kết nối', 'err');
  }
}

async function deleteMatch(id) {
  if (!confirm('Bạn có chắc chắn muốn xóa trận đấu này?')) return;
  try {
    const r = await fetch(`/api/worldcup/matches/${id}`, { method: 'DELETE', headers: authH() });
    if (r.ok) {
      toast('Đã xóa trận đấu', 'ok');
      await loadMatches();
      loadOverview();
    } else {
      toast('Lỗi xóa trận', 'err');
    }
  } catch (e) {
    toast('Lỗi kết nối', 'err');
  }
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
