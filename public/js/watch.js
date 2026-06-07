// ============================================================
// watch.js — Watch Party viewer page
// ============================================================
const socket = io();
socket.emit('join:watchparty');
socket.on('viewers:count', c => updateViewerCount(c));

const hostMessages = [];

// Load initial state
async function loadWatchParty() {
  try {
    const [wpRes, todayRes] = await Promise.all([
      fetch('/api/watchparty'),
      fetch('/api/matches/today')
    ]);
    const wp = await wpRes.json();
    const todayMatches = await todayRes.json();

    if (wp.enabled) {
      document.getElementById('watchDisabled').style.display = 'none';
      document.getElementById('watchContent').style.display = 'block';
      updateVideo(wp.videoUrl, wp.videoType);
      if (wp.hostMessage) {
        addHostMessage(wp.hostMessage);
      }
      if (wp.currentMatchId) {
        loadCurrentMatch(wp.currentMatchId);
      }
    } else {
      document.getElementById('watchDisabled').style.display = 'flex';
      document.getElementById('watchContent').style.display = 'none';
    }

    renderTodayMatches(todayMatches);
  } catch (err) {
    console.error('Error loading watch party:', err);
  }
}

function updateVideo(url, type) {
  const container = document.getElementById('videoContainer');
  if (!url) {
    container.innerHTML = `<div class="video-placeholder"><div class="icon">📺</div><p>Đang chờ host phát video...</p></div>`;
    return;
  }

  if (type === 'youtube') {
    // Extract YouTube ID from various URL formats
    let videoId = url;
    const ytMatch = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    if (ytMatch) videoId = ytMatch[1];
    container.innerHTML = `<iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>`;
  } else if (type === 'mp4') {
    container.innerHTML = `<video src="${url}" controls autoplay style="width:100%;height:100%;object-fit:contain;"></video>`;
  } else if (type === 'iframe') {
    container.innerHTML = `<iframe src="${url}" allowfullscreen style="width:100%;height:100%;border:none;"></iframe>`;
  }
}

function addHostMessage(msg) {
  hostMessages.unshift({ text: msg, time: new Date() });
  if (hostMessages.length > 20) hostMessages.pop();
  renderHostMessages();
}

function renderHostMessages() {
  const container = document.getElementById('hostMessages');
  if (hostMessages.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">Chưa có thông báo</p>';
    return;
  }
  container.innerHTML = hostMessages.map(m =>
    `<div class="host-msg"><strong>Host:</strong> ${m.text}</div>`
  ).join('');
}

async function loadCurrentMatch(matchId) {
  try {
    const res = await fetch('/api/matches');
    const matches = await res.json();
    const match = matches.find(m => m.id === matchId);
    if (match) {
      const card = document.getElementById('currentMatchCard');
      card.style.display = 'block';
      document.getElementById('currentMatchInfo').innerHTML = `
        <div style="text-align:center;">
          <div style="display:flex;align-items:center;justify-content:center;gap:16px;margin-bottom:8px;">
            <span style="font-size:1.5rem;">${match.teamA.flag}</span>
            <span style="font-weight:600;">${match.teamA.name}</span>
            <span class="score-num score-a" style="font-size:1.5rem;font-weight:800;" data-match-id="${match.id}">${match.scoreA}</span>
            <span style="color:var(--text-muted);">-</span>
            <span class="score-num score-b" style="font-size:1.5rem;font-weight:800;" data-match-id="${match.id}">${match.scoreB}</span>
            <span style="font-weight:600;">${match.teamB.name}</span>
            <span style="font-size:1.5rem;">${match.teamB.flag}</span>
          </div>
          ${getStatusBadge(match.status, match.statusDetail)}
          <div style="font-size:.8rem;color:var(--text-muted);margin-top:6px;">🏟️ ${match.stadium}</div>
        </div>
      `;
    }
  } catch (err) {
    console.error('Error loading current match:', err);
  }
}

function renderTodayMatches(matches) {
  const container = document.getElementById('todayMatchesList');
  if (matches.length === 0) {
    container.innerHTML = '<p style="color:var(--text-muted);font-size:.85rem;">Không có trận hôm nay</p>';
    return;
  }
  container.innerHTML = matches.map(m => `
    <div style="display:flex;align-items:center;justify-content:space-between;padding:8px 0;border-bottom:1px solid var(--border);font-size:.85rem;">
      <span>${m.teamA.flag} ${m.teamA.name}</span>
      <span style="font-weight:700;">${m.status === 'upcoming' ? formatTime(m.date) : m.scoreA + ' - ' + m.scoreB}</span>
      <span>${m.teamB.name} ${m.teamB.flag}</span>
    </div>
  `).join('');
}

// Socket events
socket.on('video:update', data => {
  updateVideo(data.videoUrl, data.videoType);
  showToast('Host đã cập nhật video', 'info');
});

socket.on('video:play', () => {
  const video = document.querySelector('video');
  if (video) video.play();
});

socket.on('video:pause', () => {
  const video = document.querySelector('video');
  if (video) video.pause();
});

socket.on('host:message', data => {
  addHostMessage(data.message);
  showToast(data.message, 'host');
});

socket.on('watchparty:toggle', data => {
  if (data.enabled) {
    document.getElementById('watchDisabled').style.display = 'none';
    document.getElementById('watchContent').style.display = 'block';
  } else {
    document.getElementById('watchDisabled').style.display = 'flex';
    document.getElementById('watchContent').style.display = 'none';
  }
});

socket.on('watchparty:matchUpdate', data => {
  if (data.currentMatchId) loadCurrentMatch(data.currentMatchId);
});

socket.on('score:update', data => {
  document.querySelectorAll(`[data-match-id="${data.matchId}"]`).forEach(el => {
    const sa = el.querySelector('.score-a');
    const sb = el.querySelector('.score-b');
    if (sa) { sa.textContent = data.scoreA; sa.classList.add('updated'); setTimeout(() => sa.classList.remove('updated'), 600); }
    if (sb) { sb.textContent = data.scoreB; sb.classList.add('updated'); setTimeout(() => sb.classList.remove('updated'), 600); }
  });
});

// Init
loadWatchParty();
