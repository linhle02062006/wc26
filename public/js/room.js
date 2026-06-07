// room.js — WebRTC room with screen share + voice
const socket = io();
socket.on('viewers:count', c => updateViewerCount(c));

const roomId = window.location.pathname.split('/room/')[1];
const user = getUser();
const token = getToken();
let myRole = null;
let peerConnections = {}; // userId -> RTCPeerConnection
let localStream = null; // screen share
let localAudio = null; // mic
let micEnabled = false;
let isSharing = false;
let roomVoiceEnabled = false;
let roomGuestMicAllowed = false;
let qualityTimer = null;
const ICE_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Build nav
document.getElementById('siteLogoLink').innerHTML = icon('trophy',22)+'<span>WC 2026</span>';
document.getElementById('hamburgerBtn').innerHTML = icon('menu',22);
document.getElementById('phIcon').innerHTML = icon('monitor',48);
document.getElementById('closedIcon').innerHTML = icon('tv',48);
document.getElementById('micIcon').innerHTML = icon('micOff',20);
document.getElementById('matchCardH').innerHTML = icon('trophy',16)+' Trận đang xem';
document.getElementById('usersH').innerHTML = icon('users',16)+' Người trong phòng';

// Auth gate
if (!user || !token) {
  const redir = encodeURIComponent(window.location.pathname);
  window.location.href = '/login?redirect=' + redir;
} else {
  myRole = user.role;
  if (!['host', 'guest'].includes(myRole)) {
    removeToken();
    const redir = encodeURIComponent(window.location.pathname);
    window.location.href = '/login?redirect=' + redir;
  } else {
    if (myRole === 'host') {
      document.getElementById('nav').innerHTML = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/admin">${icon('layout',16)} Bảng điều khiển</a><a href="#" class="nav-danger" onclick="logout()">${icon('logOut',16)}</a>`;
    } else {
      document.getElementById('nav').innerHTML = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/schedule">${icon('calendar',16)} Lịch</a><a href="#" class="nav-danger" onclick="logout()">${icon('logOut',16)}</a>`;
    }
    document.getElementById('mobMenu').innerHTML = document.getElementById('nav').innerHTML;
    initRoom();
  }
}

function updateMicPermissionUI() {
  const btn = document.getElementById('micBtn');
  if (!btn) return;
  if (myRole === 'host') {
    btn.disabled = false;
    btn.title = 'Bat/tat mic';
    return;
  }
  const allowed = roomVoiceEnabled && roomGuestMicAllowed;
  btn.disabled = !allowed && !micEnabled;
  if (!allowed && !micEnabled) btn.title = 'Host chưa cho phép khách bật mic';
  else btn.title = 'Bat/tat mic';
}

async function initRoom() {
  // Verify room exists
  try {
    const r = await fetch(`/api/rooms/${roomId}`, { headers: authH() });
    if (!r.ok) {
      const err = await r.json();
      if (r.status === 410) { document.getElementById('roomClosed').style.display='block'; return; }
      document.getElementById('roomClosed').style.display='block';
      document.querySelector('#roomClosed h2').textContent = err.error || 'Loi';
      return;
    }
  } catch { document.getElementById('roomClosed').style.display='block'; return; }

  document.getElementById('roomContent').style.display = 'block';

  // Show host controls
  if (myRole === 'host') {
    document.getElementById('hostControls').style.display = 'block';
    document.getElementById('hctrlH').innerHTML = icon('shield',16)+' Điều khiển host';
    document.getElementById('startShareBtn').style.display = 'inline-flex';
    document.getElementById('phText').textContent = 'Bấm nút bên dưới để bắt đầu chia sẻ màn hình.';
  }

  // Socket auth
  socket.emit('auth', { token });
  setTimeout(() => {
    socket.emit('room:join', { roomId });
  }, 500);

  setupSocketHandlers();
  loadCurrentMatch();
}

function setupSocketHandlers() {
  socket.on('room:joined', (data) => {
    roomVoiceEnabled = !!data.voiceEnabled;
    roomGuestMicAllowed = !!data.guestMicAllowed;
    updateMicPermissionUI();
    setConnStatus('ok', 'Đã kết nối');
  });

  socket.on('room:error', (data) => {
    setConnStatus('err', data.error);
    toast(data.error, 'err');
  });

  socket.on('room:userAlreadyActive', (data) => {
    const msg = data?.error || 'Tài khoản này đang được sử dụng trong phòng.';
    toast(msg, 'err');
    setConnStatus('err', msg);
    setTimeout(() => window.location.href = '/schedule', 2500);
  });

  socket.on('room:full', (data) => {
    const msg = data?.error || 'Phòng đã đủ người xem.';
    toast(msg, 'err');
    setConnStatus('err', msg);
  });

  socket.on('room:userList', (users) => {
    renderUserList(users);
  });

  socket.on('room:close', () => {
    toast('Host da dong phong', 'err');
    cleanupConnections();
    setTimeout(() => window.location.href = '/schedule', 2000);
  });

  socket.on('room:kick', (data) => {
    if (data.userId === user.id) {
      toast('Bạn đã bị kick khỏi phòng', 'err');
      cleanupConnections();
      setTimeout(() => window.location.href = '/schedule', 2000);
    }
  });

  // WebRTC signaling
  socket.on('host:startShare', async (data) => {
    if (myRole === 'guest') {
      document.getElementById('phText').textContent = 'Đang kết nối video...';
      setConnStatus('wait', 'Đang kết nối video');
      // Guest creates peer connection for host
      createPeerConnection(data.hostId, false);
    }
  });

  socket.on('host:stopShare', () => {
    document.getElementById('remoteVideo').style.display = 'none';
    document.getElementById('videoPH').style.display = 'flex';
    document.getElementById('phText').textContent = myRole === 'host' ? 'Bấm nút bên dưới để bắt đầu chia sẻ màn hình.' : 'Đang chờ host bắt đầu chia sẻ...';
    document.getElementById('qualityBadge').style.display = 'none';
    if (myRole === 'host') document.getElementById('startShareBtn').style.display = 'inline-flex';
    cleanupConnections();
  });

  socket.on('webrtc:offer', async (data) => {
    const pc = createPeerConnection(data.fromUserId, false);
    await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
    // Add local audio if available
    if (localAudio) {
      localAudio.getTracks().forEach(t => pc.addTrack(t, localAudio));
    }
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    socket.emit('webrtc:answer', { answer, targetUserId: data.fromUserId });
  });

  socket.on('webrtc:answer', async (data) => {
    const pc = peerConnections[data.fromUserId];
    if (pc) await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
  });

  socket.on('webrtc:iceCandidate', async (data) => {
    const pc = peerConnections[data.fromUserId];
    if (pc && data.candidate) {
      try { await pc.addIceCandidate(new RTCIceCandidate(data.candidate)); } catch {}
    }
  });

  // Voice
  socket.on('room:voiceUpdate', (data) => {
    roomVoiceEnabled = !!data.voiceEnabled;
    roomGuestMicAllowed = !!data.guestMicAllowed;
    if (!roomVoiceEnabled && micEnabled && myRole === 'guest') toggleMic(true);
    updateMicPermissionUI();
    toast(data.voiceEnabled ? 'Voice chat đã bật' : 'Voice chat đã tắt', 'info');
  });

  socket.on('mic:allowed', (data) => {
    if (!data?.allowed) toast(data.reason || 'Host chưa cho phép khách bật mic.', 'err');
  });

  socket.on('mic:toggle', (data) => {
    // Update UI indicator
    const el = document.querySelector(`[data-uid="${data.userId}"] .mic-indicator`);
    if (el) el.className = 'mic-indicator' + (data.enabled ? ' on' : '');
  });

  socket.on('mic:forceMute', () => {
    if (micEnabled) toggleMic();
    toast('Host đã tắt mic của bạn', 'info');
  });

  socket.on('mic:forcemuteAll', () => {
    if (micEnabled && myRole !== 'host') { toggleMic(); toast('Host đã mute tất cả', 'info'); }
  });

  // match changed
  socket.on('room:matchChanged', (data) => {
    loadCurrentMatch();
  });
}

function createPeerConnection(targetUserId, isInitiator) {
  if (peerConnections[targetUserId]) {
    peerConnections[targetUserId].close();
  }

  const pc = new RTCPeerConnection(ICE_CFG);
  peerConnections[targetUserId] = pc;

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('webrtc:iceCandidate', { candidate: e.candidate, targetUserId });
    }
  };

  pc.ontrack = (e) => {
    const video = document.getElementById('remoteVideo');
    if (e.streams[0]) {
      video.srcObject = e.streams[0];
      video.style.display = 'block';
      document.getElementById('videoPH').style.display = 'none';
      document.getElementById('qualityBadge').style.display = 'block';
      setConnStatus('ok', 'Đã kết nối');
      monitorQuality(pc);
    }
  };

  pc.onconnectionstatechange = () => {
    switch (pc.connectionState) {
      case 'connected': setConnStatus('ok', 'Đã kết nối'); break;
      case 'disconnected': setConnStatus('wait', 'Mất kết nối'); break;
      case 'failed': setConnStatus('err', 'Mất kết nối'); break;
      case 'connecting': setConnStatus('wait', 'Đang thử kết nối lại'); break;
    }
  };

  // If host and has stream, add tracks
  if (isInitiator && localStream) {
    localStream.getTracks().forEach(t => pc.addTrack(t, localStream));
  }
  if (localAudio) {
    localAudio.getTracks().forEach(t => pc.addTrack(t, localAudio));
  }

  if (isInitiator) {
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { offer, targetUserId });
    });
  }

  return pc;
}

// Screen share (host)
async function startShare() {
  try {
    localStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
      audio: true
    });

    // Show locally
    const video = document.getElementById('remoteVideo');
    video.srcObject = localStream;
    video.muted = true;
    video.style.display = 'block';
    document.getElementById('videoPH').style.display = 'none';
    document.getElementById('startShareBtn').style.display = 'none';
    document.getElementById('stopShareBtn').style.display = 'inline-flex';
    document.getElementById('qualityBadge').style.display = 'block';
    isSharing = true;

    // Handle stream end
    localStream.getVideoTracks()[0].onended = () => stopShare();

    // Notify guests
    socket.emit('host:startShare');

    // Create peer connections to all guests in room
    setTimeout(() => {
      const userItems = document.querySelectorAll('[data-uid]');
      userItems.forEach(el => {
        const uid = el.dataset.uid;
        if (uid !== user.id) {
          createPeerConnection(uid, true);
        }
      });
    }, 1000);

  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      toast('Nguồn phát có thể đang được bảo vệ bản quyền nên không thể chia sẻ qua trình duyệt.', 'err');
    }
  }
}

function stopShare() {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }
  isSharing = false;
  document.getElementById('remoteVideo').style.display = 'none';
  document.getElementById('videoPH').style.display = 'flex';
  document.getElementById('startShareBtn').style.display = 'inline-flex';
  document.getElementById('stopShareBtn').style.display = 'none';
  document.getElementById('qualityBadge').style.display = 'none';
  socket.emit('host:stopShare');
  cleanupConnections();
}

// Mic
async function toggleMic(forceOff = false) {
  const btn = document.getElementById('micBtn');
  const icEl = document.getElementById('micIcon');

  if (!micEnabled && !forceOff) {
    if (myRole === 'guest' && (!roomVoiceEnabled || !roomGuestMicAllowed)) {
      toast('Host chưa cho phép khách bật mic.', 'err');
      updateMicPermissionUI();
      return;
    }
    try {
      localAudio = await navigator.mediaDevices.getUserMedia({ audio: true });
      micEnabled = true;
      btn.classList.add('on');
      btn.classList.remove('muted');
      icEl.innerHTML = icon('mic', 20);
      socket.emit('mic:toggle', { enabled: true });

      // Add audio to existing connections
      for (const [uid, pc] of Object.entries(peerConnections)) {
        localAudio.getTracks().forEach(t => pc.addTrack(t, localAudio));
        // Renegotiate
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('webrtc:offer', { offer, targetUserId: uid });
      }
    } catch (err) {
      toast('Không thể truy cập microphone. Kiểm tra quyền mic trong trình duyệt.', 'err');
    }
  } else {
    if (localAudio) {
      localAudio.getTracks().forEach(t => t.stop());
      localAudio = null;
    }
    micEnabled = false;
    btn.classList.remove('on');
    btn.classList.add('muted');
    icEl.innerHTML = icon('micOff', 20);
    socket.emit('mic:toggle', { enabled: false });
  }
}

function muteAllGuests() {
  socket.emit('host:muteAll');
  toast('Đã mute tất cả khách', 'ok');
}

// UI helpers
function setConnStatus(type, text) {
  document.getElementById('connStatus').innerHTML = `<span class="conn-dot ${type}"></span> ${text}`;
}

function renderUserList(users) {
  const el = document.getElementById('userList');
  el.innerHTML = users.map(u => `
    <div class="user-item" data-uid="${u.userId}">
      <div class="u-info">
        <span class="mic-indicator"></span>
        <span>${u.username}</span>
        <span class="u-role">${u.role}</span>
      </div>
      ${myRole === 'host' && u.role === 'guest' ? `<button class="btn-icon" style="color:var(--red)" onclick="kickUser('${u.userId}')" title="Kick">${icon('x',14)}</button>` : ''}
    </div>
  `).join('');

  // If host is sharing and new guest joined, create connection
  if (myRole === 'host' && isSharing) {
    users.forEach(u => {
      if (u.userId !== user.id && !peerConnections[u.userId]) {
        createPeerConnection(u.userId, true);
      }
    });
  }
}

function kickUser(userId) {
  if (!confirm('Kick người này?')) return;
  fetch(`/api/rooms/${roomId}/kick`, { method: 'POST', headers: authH(), body: JSON.stringify({ userId }) });
}

async function loadCurrentMatch() {
  try {
    const rm = await fetch(`/api/rooms/${roomId}`, { headers: authH() }).then(r => r.json());
    if (rm.currentMatchId) {
      const data = await fetch('/api/worldcup/matches').then(r => r.json());
      if (data.success && data.matches) {
        const m = data.matches.find(x => x.id === rm.currentMatchId);
        if (m) {
          document.getElementById('matchCard').style.display = 'block';
          document.getElementById('matchInfo').innerHTML = matchCard(m);
        }
      }
    }
  } catch {}
}

function monitorQuality(pc) {
  if (qualityTimer) clearInterval(qualityTimer);
  qualityTimer = setInterval(async () => {
    if (!pc || pc.connectionState !== 'connected') return;
    try {
      const stats = await pc.getStats();
      stats.forEach(s => {
        if (s.type === 'inbound-rtp' && s.kind === 'video') {
          const w = s.frameWidth || 0, h = s.frameHeight || 0, fps = s.framesPerSecond || 0;
          const badge = document.getElementById('qualityBadge');
          if (h >= 1080 && fps >= 50) badge.textContent = '1080p60';
          else if (h >= 1080) badge.textContent = '1080p30';
          else if (h >= 720 && fps >= 50) badge.textContent = '720p60';
          else if (h >= 720) badge.textContent = '720p30';
          else if (h > 0) badge.textContent = 'Network weak';
          else badge.textContent = 'Đang kết nối';
        }
      });
    } catch {}
  }, 3000);
}

function cleanupConnections() {
  for (const [uid, pc] of Object.entries(peerConnections)) {
    pc.close();
  }
  peerConnections = {};
  if (qualityTimer) {
    clearInterval(qualityTimer);
    qualityTimer = null;
  }
}

// Cleanup on unload
window.addEventListener('beforeunload', () => {
  cleanupConnections();
  if (localStream) localStream.getTracks().forEach(t => t.stop());
  if (localAudio) localAudio.getTracks().forEach(t => t.stop());
});
