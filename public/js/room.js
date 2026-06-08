// room.js — WebRTC room with screen share + voice
// ============================================================

const socket = io();
socket.on('viewers:count', c => updateViewerCount(c));

const roomId = window.location.pathname.split('/room/')[1];
const user = getUser();
const token = getToken();
let myRole = null;
let currentRoom = null;
let peerConnections = {};      // key = socketId -> RTCPeerConnection
let socketIdMap = {};          // key = userId -> socketId
let localScreenStream = null;  // screen share
let localAudioStream = null;   // mic
let micEnabled = false;
let isSharing = false;
let roomVoiceEnabled = false;
let roomGuestMicAllowed = false;
let qualityTimer = null;
let joinTimeout = null;
const ICE_CFG = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };

// Build nav icons
document.getElementById('siteLogoLink').innerHTML = icon('trophy',22)+'<span>WC 2026</span>';
document.getElementById('hamburgerBtn').innerHTML = icon('menu',22);
document.getElementById('phIcon').innerHTML = icon('monitor',48);
document.getElementById('closedIcon').innerHTML = icon('tv',48);
document.getElementById('micIcon').innerHTML = icon('micOff',20);
document.getElementById('matchCardH').innerHTML = icon('trophy',16)+' Trận đang xem';
document.getElementById('usersH').innerHTML = icon('users',16)+' Người trong phòng';

// ==================== AUTH GATE ====================
if (!user || !token) {
  const redir = encodeURIComponent(window.location.pathname);
  window.location.href = '/login?redirect=' + redir;
} else {
  myRole = user.role;
  if (!['host', 'guest'].includes(myRole)) {
    removeToken();
    window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
  } else {
    // Build nav based on role
    if (myRole === 'host') {
      document.getElementById('nav').innerHTML = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/admin">${icon('layout',16)} Bảng điều khiển</a><a href="#" class="nav-danger" onclick="logout()">${icon('logOut',16)} Đăng xuất</a>`;
    } else {
      document.getElementById('nav').innerHTML = `<a href="/">${icon('home',16)} Trang chủ</a><a href="/schedule">${icon('calendar',16)} Lịch thi đấu</a><a href="#" class="nav-danger" onclick="logout()">${icon('logOut',16)} Đăng xuất</a>`;
    }
    document.getElementById('mobMenu').innerHTML = document.getElementById('nav').innerHTML;
    initRoom();
  }
}

// ==================== INIT ROOM (proper flow) ====================
async function initRoom() {
  setConnStatus('wait', 'Đang kiểm tra đăng nhập...');

  // Step 1: Verify auth
  try {
    const meRes = await fetch('/api/auth/me', { headers: authH() });
    if (!meRes.ok) {
      removeToken();
      window.location.href = '/login?redirect=' + encodeURIComponent(window.location.pathname);
      return;
    }
  } catch {
    showRoomError('Không thể kết nối máy chủ.');
    setConnStatus('err', 'Lỗi kết nối');
    return;
  }

  // Step 2: Get room info
  setConnStatus('wait', 'Đang tải thông tin phòng...');
  try {
    const roomRes = await fetch(`/api/rooms/${roomId}`, { headers: authH() });
    const roomData = await roomRes.json();
    
    if (!roomRes.ok || !roomData.success) {
      if (roomRes.status === 410) {
        document.getElementById('roomClosed').style.display = 'block';
      } else {
        showRoomError(roomData.message || 'Phòng không tồn tại.');
      }
      setConnStatus('err', roomData.message || 'Không thể vào phòng');
      return;
    }
    
    currentRoom = roomData.room;
    if (roomData.match) renderMatchCard(roomData.match);
  } catch {
    showRoomError('Không thể tải thông tin phòng.');
    setConnStatus('err', 'Lỗi kết nối');
    return;
  }

  // Step 3: Join room via API
  setConnStatus('wait', 'Đang tham gia phòng...');
  try {
    const joinRes = await fetch(`/api/rooms/${roomId}/join`, { 
      method: 'POST', 
      headers: authH() 
    });
    const joinData = await joinRes.json();
    
    if (!joinRes.ok || !joinData.success) {
      showRoomError(joinData.message || 'Không thể tham gia phòng.');
      setConnStatus('err', joinData.message || 'Không thể tham gia');
      return;
    }
  } catch {
    showRoomError('Không thể tham gia phòng.');
    setConnStatus('err', 'Lỗi kết nối');
    return;
  }

  // Step 4: Show room content & setup UI
  document.getElementById('roomContent').style.display = 'block';
  
  if (myRole === 'host') {
    document.getElementById('hostControls').style.display = 'block';
    document.getElementById('hctrlH').innerHTML = icon('shield',16)+' Điều khiển host';
    document.getElementById('startShareBtn').style.display = 'inline-flex';
    document.getElementById('phText').textContent = 'Bấm nút bên dưới để bắt đầu chia sẻ màn hình.';
  }

  // Step 5: Setup socket handlers BEFORE connecting
  setupSocketHandlers();

  // Step 6: Socket auth with callback, then join
  setConnStatus('wait', 'Đang kết nối phòng...');
  
  socket.emit('auth', { token }, (authResult) => {
    if (authResult && authResult.ok) {
      socket.emit('room:join', { roomId });
    } else {
      setConnStatus('err', 'Xác thực socket thất bại');
      toast('Không thể xác thực kết nối.', 'err');
    }
  });

  // Timeout: if room:joined not received in 10s
  joinTimeout = setTimeout(() => {
    setConnStatus('err', 'Không thể kết nối phòng');
    toast('Không thể kết nối phòng. Vui lòng tải lại trang.', 'err');
    // Show retry button
    const conn = document.getElementById('connStatus');
    if (conn) {
      conn.innerHTML += ` <button class="btn btn-s btn-xs" onclick="location.reload()" style="margin-left:8px">Thử lại</button>`;
    }
  }, 10000);
}

// ==================== SOCKET HANDLERS ====================
function setupSocketHandlers() {
  socket.on('room:joined', (data) => {
    // Clear timeout
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    
    roomVoiceEnabled = !!data.voiceEnabled;
    roomGuestMicAllowed = !!data.guestMicAllowed;
    updateMicPermissionUI();
    setConnStatus('ok', 'Đã kết nối');
    console.log('[Room] Joined successfully:', data.roomId);
  });

  socket.on('room:error', (data) => {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    setConnStatus('err', data.error || 'Lỗi phòng');
    toast(data.error || 'Lỗi kết nối phòng', 'err');
  });

  socket.on('room:userAlreadyActive', (data) => {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    const msg = data?.error || 'Tài khoản này đang được sử dụng trong phòng.';
    toast(msg, 'err');
    setConnStatus('err', msg);
    setTimeout(() => window.location.href = '/schedule', 2500);
  });

  socket.on('room:full', (data) => {
    if (joinTimeout) { clearTimeout(joinTimeout); joinTimeout = null; }
    const msg = data?.error || 'Phòng đã đủ người xem.';
    toast(msg, 'err');
    setConnStatus('err', msg);
  });

  socket.on('room:userList', (users) => {
    renderUserList(users);
  });

  // Host receives this when a new guest joins
  socket.on('room:guestJoined', (data) => {
    console.log('[Room] Guest joined:', data.username, 'socket:', data.socketId);
    // If host is currently sharing, create a PC for this new guest
    if (myRole === 'host' && isSharing && localScreenStream) {
      if (!peerConnections[data.socketId]) {
        setTimeout(() => {
          createPeerConnection(data.socketId, true);
        }, 300);
      }
    }
  });

  socket.on('room:closed', () => {
    toast('Phòng đã được host đóng.', 'err');
    fullCleanup();
    document.getElementById('roomContent').style.display = 'none';
    document.getElementById('roomClosed').style.display = 'block';
  });

  socket.on('room:kick', (data) => {
    if (data.userId === user.id) {
      toast('Bạn đã bị kick khỏi phòng.', 'err');
      fullCleanup();
      setTimeout(() => window.location.href = '/schedule', 2000);
    }
  });

  // ========== WebRTC signaling ==========
  // Guest: wait for host:startShare notification, then wait for webrtc:offer
  socket.on('host:startShare', (data) => {
    if (myRole === 'guest') {
      document.getElementById('phText').textContent = 'Host đang bắt đầu chia sẻ...';
      setConnStatus('wait', 'Đang kết nối video');
    }
  });

  socket.on('host:stopShare', () => {
    // Stop remote video
    const remoteVideo = document.getElementById('remoteVideo');
    if (remoteVideo) {
      remoteVideo.srcObject = null;
      remoteVideo.style.display = 'none';
    }
    document.getElementById('videoPH').style.display = 'flex';
    document.getElementById('phText').textContent = myRole === 'host'
      ? 'Bấm nút bên dưới để bắt đầu chia sẻ màn hình.'
      : 'Đang chờ host bắt đầu chia sẻ...';
    document.getElementById('qualityBadge').style.display = 'none';
    if (myRole === 'host') {
      document.getElementById('startShareBtn').style.display = 'inline-flex';
      document.getElementById('stopShareBtn').style.display = 'none';
    }
    cleanupPeerConnections();
  });

  // Host sends offer to specific guest; guest receives offer here
  socket.on('webrtc:offer', async (data) => {
    // data: { offer, fromSocketId, fromUserId }
    try {
      console.log('[WebRTC] Received offer from:', data.fromUserId, 'socket:', data.fromSocketId);
      // Guest creates PC for host using fromSocketId as key
      const pc = createPeerConnection(data.fromSocketId, false);
      await pc.setRemoteDescription(new RTCSessionDescription(data.offer));
      // Add mic track if enabled
      if (localAudioStream) {
        localAudioStream.getTracks().forEach(t => pc.addTrack(t, localAudioStream));
      }
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('webrtc:answer', { answer, targetSocketId: data.fromSocketId });
      console.log('[WebRTC] Sent answer to:', data.fromSocketId);
    } catch (e) {
      console.error('[WebRTC] Error handling offer:', e);
    }
  });

  // Host receives answer from guest
  socket.on('webrtc:answer', async (data) => {
    // data: { answer, fromSocketId, fromUserId }
    try {
      const pc = peerConnections[data.fromSocketId];
      if (pc) {
        await pc.setRemoteDescription(new RTCSessionDescription(data.answer));
        console.log('[WebRTC] Set answer from:', data.fromSocketId);
      }
    } catch (e) {
      console.error('[WebRTC] Error handling answer:', e);
    }
  });

  socket.on('webrtc:iceCandidate', async (data) => {
    // data: { candidate, fromSocketId, fromUserId }
    try {
      const pc = peerConnections[data.fromSocketId];
      if (pc && data.candidate) {
        await pc.addIceCandidate(new RTCIceCandidate(data.candidate));
      }
    } catch (e) {
      // ICE candidate errors are common and non-critical
    }
  });

  // ========== Voice ==========
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
    const el = document.querySelector(`[data-uid="${data.userId}"] .mic-indicator`);
    if (el) el.className = 'mic-indicator' + (data.enabled ? ' on' : '');
  });

  socket.on('mic:forceMute', () => {
    if (micEnabled) toggleMic(true);
    toast('Host đã tắt mic của bạn.', 'info');
  });

  socket.on('mic:forcemuteAll', () => {
    if (micEnabled && myRole !== 'host') { toggleMic(true); toast('Host đã mute tất cả.', 'info'); }
  });

  socket.on('room:matchChanged', () => {
    loadCurrentMatch();
  });

  // Handle socket reconnection
  socket.on('connect', () => {
    if (currentRoom) {
      // Re-auth and re-join on reconnect
      socket.emit('auth', { token }, (result) => {
        if (result && result.ok) {
          socket.emit('room:join', { roomId });
        }
      });
    }
  });
}

// ==================== PEER CONNECTION ====================
// targetSocketId: the socketId of the peer to connect to
function createPeerConnection(targetSocketId, isInitiator) {
  if (peerConnections[targetSocketId]) {
    try { peerConnections[targetSocketId].close(); } catch {}
  }

  const pc = new RTCPeerConnection(ICE_CFG);
  peerConnections[targetSocketId] = pc;
  console.log('[WebRTC] Created PC for:', targetSocketId, 'initiator:', isInitiator);

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit('webrtc:iceCandidate', { candidate: e.candidate, targetSocketId });
    }
  };

  pc.ontrack = (e) => {
    const remoteVideo = document.getElementById('remoteVideo');
    if (e.streams && e.streams[0] && remoteVideo) {
      remoteVideo.srcObject = e.streams[0];
      remoteVideo.style.display = 'block';
      document.getElementById('videoPH').style.display = 'none';
      document.getElementById('qualityBadge').style.display = 'block';
      setConnStatus('ok', 'Đã kết nối');
      monitorQuality(pc);
      e.streams[0].onaddtrack = () => {
        if (remoteVideo.srcObject !== e.streams[0]) {
          remoteVideo.srcObject = e.streams[0];
        }
      };
      console.log('[WebRTC] Receiving stream');
    }
  };

  pc.onconnectionstatechange = () => {
    const state = pc.connectionState;
    console.log('[WebRTC] Connection state:', state, 'with:', targetSocketId);
    if (state === 'connected') setConnStatus('ok', 'Đã kết nối');
    else if (state === 'disconnected') setConnStatus('wait', 'Mất kết nối tạm thời');
    else if (state === 'failed') setConnStatus('err', 'Mất kết nối WebRTC');
  };

  // If initiator (host), add screen + audio tracks then create offer
  if (isInitiator) {
    if (localScreenStream) {
      localScreenStream.getTracks().forEach(t => pc.addTrack(t, localScreenStream));
    }
    if (localAudioStream) {
      localAudioStream.getTracks().forEach(t => pc.addTrack(t, localAudioStream));
    }
    pc.createOffer().then(offer => {
      pc.setLocalDescription(offer);
      socket.emit('webrtc:offer', { offer, targetSocketId });
      console.log('[WebRTC] Sent offer to:', targetSocketId);
    }).catch(e => console.error('[WebRTC] Offer error:', e));
  }

  return pc;
}

// ==================== SCREEN SHARE (HOST) ====================
async function startShare() {
  try {
    localScreenStream = await navigator.mediaDevices.getDisplayMedia({
      video: { width: { ideal: 1920 }, height: { ideal: 1080 }, frameRate: { ideal: 60 } },
      audio: true
    });

    // Show locally
    const video = document.getElementById('remoteVideo');
    if (video) {
      video.srcObject = localScreenStream;
      video.muted = true;
      video.style.display = 'block';
    }
    document.getElementById('videoPH').style.display = 'none';
    document.getElementById('startShareBtn').style.display = 'none';
    document.getElementById('stopShareBtn').style.display = 'inline-flex';
    document.getElementById('qualityBadge').style.display = 'block';
    document.getElementById('phText').textContent = 'Đang chia sẻ màn hình...';
    isSharing = true;

    // Handle browser stop share (user clicks Chrome's built-in stop)
    localScreenStream.getVideoTracks()[0].onended = () => {
      console.log('[Share] Browser stopped share');
      stopShare();
    };

    // Notify all in room
    socket.emit('host:startShare');

    // Create peer connections to all guests with their socketIds
    setTimeout(() => {
      const userItems = document.querySelectorAll('[data-uid]');
      userItems.forEach(el => {
        const uid = el.dataset.uid;
        const sid = el.dataset.sid;
        // Skip self
        if (uid !== user.id && sid) {
          // Check if this peer already has a PC
          if (!peerConnections[sid]) {
            createPeerConnection(sid, true);
          }
        }
      });
    }, 500);

  } catch (err) {
    if (err.name !== 'NotAllowedError') {
      toast('Không thể chia sẻ màn hình. Nguồn phát có thể đang được bảo vệ bản quyền.', 'err');
    }
  }
}

function stopShare() {
  if (localScreenStream) {
    localScreenStream.getTracks().forEach(t => t.stop());
    localScreenStream = null;
  }
  isSharing = false;
  const video = document.getElementById('remoteVideo');
  if (video) { video.srcObject = null; video.style.display = 'none'; }
  document.getElementById('videoPH').style.display = 'flex';
  document.getElementById('startShareBtn').style.display = 'inline-flex';
  document.getElementById('stopShareBtn').style.display = 'none';
  document.getElementById('qualityBadge').style.display = 'none';
  document.getElementById('phText').textContent = 'Bấm nút bên dưới để bắt đầu chia sẻ màn hình.';
  socket.emit('host:stopShare');
  cleanupPeerConnections();
}

// ==================== MIC ====================
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
      localAudioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
      micEnabled = true;
      btn.classList.add('on');
      btn.classList.remove('muted');
      icEl.innerHTML = icon('mic', 20);
      socket.emit('mic:toggle', { enabled: true });

      // Add audio to existing peer connections
      for (const [sid, pc] of Object.entries(peerConnections)) {
        try {
          localAudioStream.getTracks().forEach(t => pc.addTrack(t, localAudioStream));
          // Renegotiate
          const offer = await pc.createOffer();
          await pc.setLocalDescription(offer);
          socket.emit('webrtc:offer', { offer, targetSocketId: sid });
        } catch (e) {
          console.error('[Mic] Error adding to PC:', e);
        }
      }
    } catch (err) {
      toast('Trình duyệt chưa cấp quyền microphone. Hãy bật quyền mic trong cài đặt trình duyệt.', 'err');
    }
  } else {
    if (localAudioStream) {
      localAudioStream.getTracks().forEach(t => t.stop());
      localAudioStream = null;
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
  toast('Đã mute tất cả khách.', 'ok');
}

function updateMicPermissionUI() {
  const btn = document.getElementById('micBtn');
  if (!btn) return;
  if (myRole === 'host') {
    btn.disabled = false;
    btn.title = 'Bật/tắt mic';
    return;
  }
  const allowed = roomVoiceEnabled && roomGuestMicAllowed;
  btn.disabled = !allowed && !micEnabled;
  btn.title = (!allowed && !micEnabled) ? 'Host chưa cho phép khách bật mic' : 'Bật/tắt mic';
}

// ==================== UI HELPERS ====================
function setConnStatus(type, text) {
  const el = document.getElementById('connStatus');
  if (el) el.innerHTML = `<span class="conn-dot ${type}"></span> ${text}`;
}

function showRoomError(msg) {
  document.getElementById('roomClosed').style.display = 'block';
  const h2 = document.querySelector('#roomClosed h2');
  if (h2) h2.textContent = msg;
}

function renderUserList(users) {
  const el = document.getElementById('userList');
  if (!users || users.length === 0) {
    el.innerHTML = '<p style="color:var(--text3);font-size:.85rem;padding:8px">Chưa có ai trong phòng.</p>';
    return;
  }

  // Update socketId map
  socketIdMap = {};
  users.forEach(u => {
    socketIdMap[u.userId] = u.socketId;
  });

  el.innerHTML = users.map(u => {
    const roleLabel = u.role === 'host' ? 'Host' : 'Khách';
    return `
    <div class="user-item" data-uid="${u.userId}" data-sid="${u.socketId || ''}">
      <div class="u-info">
        <span class="mic-indicator"></span>
        <span>${u.username}</span>
        <span class="u-role">${roleLabel}</span>
      </div>
      ${myRole === 'host' && u.role === 'guest' ? `<button class="btn-icon" style="color:var(--red)" onclick="kickUser('${u.userId}')" title="Kick">${icon('x',14)}</button>` : ''}
    </div>`;
  }).join('');

  // If host is sharing and new guest joined, create PC for them
  if (myRole === 'host' && isSharing) {
    users.forEach(u => {
      if (u.userId !== user.id && u.socketId && !peerConnections[u.socketId]) {
        console.log('[WebRTC] New guest joined while sharing, creating PC for:', u.userId, 'socket:', u.socketId);
        createPeerConnection(u.socketId, true);
      }
    });
  }
}

function renderMatchCard(m) {
  if (!m) return;
  document.getElementById('matchCard').style.display = 'block';
  document.getElementById('matchInfo').innerHTML = matchCard(m, { showFav: false, showAdmin: false });
}

function kickUser(userId) {
  if (!confirm('Kick người này khỏi phòng?')) return;
  fetch(`/api/rooms/${roomId}/kick`, { method: 'POST', headers: authH(), body: JSON.stringify({ userId }) })
    .catch(() => toast('Lỗi kick', 'err'));
}

async function loadCurrentMatch() {
  try {
    const res = await fetch(`/api/rooms/${roomId}`, { headers: authH() });
    const data = await res.json();
    if (data.success && data.match) {
      renderMatchCard(data.match);
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
          const h = s.frameHeight || 0, fps = s.framesPerSecond || 0;
          const badge = document.getElementById('qualityBadge');
          if (h >= 1080 && fps >= 50) badge.textContent = '1080p60';
          else if (h >= 1080) badge.textContent = '1080p30';
          else if (h >= 720 && fps >= 50) badge.textContent = '720p60';
          else if (h >= 720) badge.textContent = '720p30';
          else if (h > 0) badge.textContent = `${h}p`;
          else badge.textContent = 'Đang kết nối';
        }
      });
    } catch {}
  }, 3000);
}

// ==================== CLEANUP ====================
function cleanupPeerConnections() {
  for (const [sid, pc] of Object.entries(peerConnections)) {
    try { pc.close(); } catch {}
  }
  peerConnections = {};
  if (qualityTimer) { clearInterval(qualityTimer); qualityTimer = null; }
}

function fullCleanup() {
  cleanupPeerConnections();
  if (localScreenStream) { localScreenStream.getTracks().forEach(t => t.stop()); localScreenStream = null; }
  if (localAudioStream) { localAudioStream.getTracks().forEach(t => t.stop()); localAudioStream = null; }
  micEnabled = false;
  isSharing = false;
  const video = document.getElementById('remoteVideo');
  if (video) { video.srcObject = null; video.style.display = 'none'; }
}

window.addEventListener('beforeunload', () => {
  fullCleanup();
  socket.emit('room:leave', { roomId });
});
