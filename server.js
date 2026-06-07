// ============================================================
// World Cup 2026 Watch Party — Server (v2)
// Node.js + Express + Socket.IO + WebRTC Signaling
// ============================================================
require('dotenv').config();
const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || 'default_wc2026_secret';
const DATA_DIR = path.join(__dirname, 'data');

// ==================== JSON File Helpers ====================
function ensureDir(dir) { if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true }); }
function readJSON(f) {
  try { const p = path.join(DATA_DIR, f); if (!fs.existsSync(p)) return null; return JSON.parse(fs.readFileSync(p, 'utf8')); }
  catch (e) { console.error(`Read ${f}:`, e.message); return null; }
}
function writeJSON(f, d) {
  try { ensureDir(DATA_DIR); fs.writeFileSync(path.join(DATA_DIR, f), JSON.stringify(d, null, 2), 'utf8'); return true; }
  catch (e) { console.error(`Write ${f}:`, e.message); return false; }
}
function sanitize(s) {
  if (typeof s !== 'string') return s;
  return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').trim();
}
function sanitizeObj(o) {
  if (typeof o === 'string') return sanitize(o);
  if (!o || typeof o !== 'object') return o;
  if (Array.isArray(o)) return o.map(sanitizeObj);
  const r = {}; for (const k of Object.keys(o)) r[k] = sanitizeObj(o[k]); return r;
}

// ==================== Middleware ====================
app.use(express.json({ limit: '1mb' }));
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

function authMW(req, res, next) {
  const t = req.headers.authorization?.split(' ')[1];
  if (!t) return res.status(401).json({ error: 'Chua dang nhap' });
  try { req.user = jwt.verify(t, JWT_SECRET); next(); }
  catch { return res.status(401).json({ error: 'Token khong hop le' }); }
}
function hostOnly(req, res, next) {
  if (req.user?.role !== 'host') return res.status(403).json({ error: 'Chi host moi co quyen' });
  next();
}
function hostOrGuest(req, res, next) {
  if (!['host','guest'].includes(req.user?.role)) return res.status(403).json({ error: 'Khong co quyen' });
  next();
}

// ==================== Init Users ====================
async function initUsers() {
  let users = readJSON('users.json');
  if (!users) {
    const h = await bcrypt.hash(process.env.HOST_PASSWORD || 'host123', 12);
    const g1 = await bcrypt.hash(process.env.GUEST1_PASSWORD || 'guest123', 12);
    const g2 = await bcrypt.hash(process.env.GUEST2_PASSWORD || 'guest123', 12);
    users = [
      { id: 'user-host', username: process.env.HOST_USERNAME || 'host', password: h, role: 'host', active: true, currentSessionId: null },
      { id: 'user-guest1', username: process.env.GUEST1_USERNAME || 'guest1', password: g1, role: 'guest', active: true, currentSessionId: null },
      { id: 'user-guest2', username: process.env.GUEST2_USERNAME || 'guest2', password: g2, role: 'guest', active: true, currentSessionId: null }
    ];
    writeJSON('users.json', users);
    console.log('[INIT] Users created: host, guest1, guest2');
  }
  if (!readJSON('worldcup-matches.json')) writeJSON('worldcup-matches.json', { source: 'api-football', lastSyncAt: null, data: [] });
  if (!readJSON('settings.json')) writeJSON('settings.json', { siteTitle: 'World Cup 2026 Watch Party', darkMode: true });
  if (!readJSON('room.json')) writeJSON('room.json', { id: null, roomId: null, hostId: null, isOpen: false, maxGuests: 2, currentGuestIds: [], voiceEnabled: false, guestMicAllowed: false, currentMatchId: null, createdAt: null });
}

// ==================== AUTH ====================
app.post('/api/auth/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Nhap day du thong tin' });
  const users = readJSON('users.json') || [];
  const user = users.find(u => u.username === username);
  if (!user) return res.status(401).json({ error: 'Sai thong tin dang nhap' });
  if (!user.active) return res.status(403).json({ error: 'Tai khoan da bi vo hieu hoa' });
  const ok = await bcrypt.compare(password, user.password);
  if (!ok) return res.status(401).json({ error: 'Sai thong tin dang nhap' });
  const token = jwt.sign({ id: user.id, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '24h' });
  res.json({ token, username: user.username, role: user.role, id: user.id });
});

app.post('/api/auth/logout', authMW, (req, res) => {
  // Clear session for guests
  if (req.user.role === 'guest') {
    const users = readJSON('users.json') || [];
    const u = users.find(x => x.id === req.user.id);
    if (u) { u.currentSessionId = null; writeJSON('users.json', users); }
  }
  res.json({ ok: true });
});

app.get('/api/auth/me', authMW, (req, res) => {
  res.json({ id: req.user.id, username: req.user.username, role: req.user.role });
});

// ==================== USERS (host only) ====================
app.get('/api/users/guests', authMW, hostOnly, (req, res) => {
  const users = readJSON('users.json') || [];
  const guests = users.filter(u => u.role === 'guest').map(u => ({
    id: u.id, username: u.username, active: u.active, currentSessionId: u.currentSessionId
  }));
  res.json(guests);
});

app.put('/api/users/guests/:id/password', authMW, hostOnly, async (req, res) => {
  const users = readJSON('users.json') || [];
  const u = users.find(x => x.id === req.params.id && x.role === 'guest');
  if (!u) return res.status(404).json({ error: 'Khong tim thay' });
  const pw = req.body.password;
  if (!pw || pw.length < 4) return res.status(400).json({ error: 'Mat khau toi thieu 4 ky tu' });
  u.password = await bcrypt.hash(pw, 12);
  writeJSON('users.json', users);
  res.json({ ok: true });
});

app.put('/api/users/guests/:id/status', authMW, hostOnly, (req, res) => {
  const users = readJSON('users.json') || [];
  const u = users.find(x => x.id === req.params.id && x.role === 'guest');
  if (!u) return res.status(404).json({ error: 'Khong tim thay' });
  u.active = !!req.body.active;
  if (!u.active) u.currentSessionId = null;
  writeJSON('users.json', users);
  res.json({ ok: true });
});

app.post('/api/users/guests/:id/reset-session', authMW, hostOnly, (req, res) => {
  const users = readJSON('users.json') || [];
  const u = users.find(x => x.id === req.params.id && x.role === 'guest');
  if (!u) return res.status(404).json({ error: 'Khong tim thay' });
  u.currentSessionId = null;
  writeJSON('users.json', users);
  io.emit('session:reset', { userId: u.id });
  res.json({ ok: true });
});

// ==================== MATCHES (API-FOOTBALL) ====================
app.get('/api/worldcup/matches', (req, res) => {
  if (!process.env.API_FOOTBALL_KEY) {
    return res.json({ success: false, message: 'Chưa cấu hình API_FOOTBALL_KEY trong file .env.', matches: [] });
  }

  const cache = readJSON('worldcup-matches.json');
  if (!cache || !cache.data || cache.data.length === 0) {
    return res.json({ success: false, message: 'API chưa trả về lịch thi đấu chính thức hoặc sai League ID.', matches: [] });
  }
  
  res.json({
    success: true,
    source: cache.source || 'cache',
    count: cache.data.length,
    matches: cache.data
  });
});

app.get('/api/worldcup/today', (req, res) => {
  const cache = readJSON('worldcup-matches.json');
  if (!cache || !cache.data || cache.data.length === 0) {
    return res.json({ success: false, message: 'Không có dữ liệu.', matches: [] });
  }
  const tzOpts = { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' };
  const todayStr = new Intl.DateTimeFormat('en-CA', tzOpts).format(new Date()); // YYYY-MM-DD in VN
  
  const todayMatches = cache.data.filter(m => {
    const mDateStr = new Intl.DateTimeFormat('en-CA', tzOpts).format(new Date(m.dateUtc));
    return mDateStr === todayStr;
  });
  res.json({
    success: true,
    source: cache.source,
    count: todayMatches.length,
    matches: todayMatches
  });
});

app.get('/api/worldcup/upcoming', (req, res) => {
  const cache = readJSON('worldcup-matches.json');
  if (!cache || !cache.data || cache.data.length === 0) {
    return res.json({ success: false, message: 'Không có dữ liệu.', matches: [] });
  }
  const tzOpts = { timeZone: 'Asia/Ho_Chi_Minh' };
  // Lấy thời gian hiện tại theo giờ VN
  const nowVN = new Date(new Date().toLocaleString("en-US", tzOpts)).getTime();

  // Upcoming = NS, TBD, hoặc trận chưa đá/vừa đá
  const upcoming = cache.data.filter(m => {
    const mTimeVN = new Date(new Date(m.dateUtc).toLocaleString("en-US", tzOpts)).getTime();
    return (m.statusShort === 'NS' || m.statusShort === 'TBD') || mTimeVN > nowVN - 2*3600*1000;
  });
  upcoming.sort((a, b) => new Date(a.dateUtc) - new Date(b.dateUtc));
  res.json({
    success: true,
    source: cache.source,
    count: upcoming.length,
    matches: upcoming
  });
});

app.get('/api/worldcup/groups', (req, res) => {
  const cache = readJSON('worldcup-matches.json');
  if (!cache || !cache.data || cache.data.length === 0) {
    return res.json({ success: false, message: 'Không có dữ liệu.', groups: {} });
  }
  const groups = {};
  cache.data.forEach(m => {
    if (m.group) {
      if (!groups[m.group]) groups[m.group] = new Set();
      if (m.home && m.home.name && m.home.name !== 'TBD') groups[m.group].add(JSON.stringify(m.home));
      if (m.away && m.away.name && m.away.name !== 'TBD') groups[m.group].add(JSON.stringify(m.away));
    }
  });
  
  const formattedGroups = {};
  for (const g in groups) {
    formattedGroups[g] = Array.from(groups[g]).map(t => JSON.parse(t));
  }
  
  res.json({ success: true, groups: formattedGroups });
});

app.get('/api/worldcup/teams', (req, res) => {
  const cache = readJSON('worldcup-matches.json');
  if (!cache || !cache.data || cache.data.length === 0) {
    return res.json({ success: false, message: 'Không có dữ liệu.', teams: [] });
  }
  const teamsMap = new Map();
  cache.data.forEach(m => {
    if (m.home && m.home.id) teamsMap.set(m.home.id, m.home);
    if (m.away && m.away.id) teamsMap.set(m.away.id, m.away);
  });
  
  res.json({ success: true, teams: Array.from(teamsMap.values()) });
});

app.get('/api/worldcup/league-search', authMW, hostOnly, async (req, res) => {
  try {
    const url = `${process.env.API_FOOTBALL_BASE_URL}/leagues?search=World Cup`;
    const response = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();
    res.json(data.response || []);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/worldcup/sync', authMW, hostOnly, async (req, res) => {
  try {
    const leagueId = process.env.WORLD_CUP_LEAGUE_ID;
    const season = process.env.WORLD_CUP_SEASON || '2026';
    if (!leagueId || leagueId === 'replace_after_search') {
      return res.status(400).json({ error: 'Chưa cấu hình WORLD_CUP_LEAGUE_ID' });
    }
    const url = `${process.env.API_FOOTBALL_BASE_URL}/fixtures?league=${leagueId}&season=${season}`;
    
    console.log(`[SYNC] Gọi API-FOOTBALL: ${url}`);
    
    const response = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();
    
    if (data.errors && Object.keys(data.errors).length > 0) {
      console.log(`[SYNC] Lỗi API-FOOTBALL:`, data.errors);
      return res.status(400).json({ error: 'API Error', details: data.errors });
    }
    
    const fixtures = data.response || [];
    console.log(`[SYNC] Tìm thấy ${fixtures.length} trận đấu (League ID: ${leagueId}, Season: ${season})`);
    
    const translateStatus = (short) => {
      const map = {
        'TBD': 'Chưa xác định', 'NS': 'Sắp diễn ra', '1H': 'Hiệp 1', 'HT': 'Nghỉ giữa hiệp',
        '2H': 'Hiệp 2', 'ET': 'Hiệp phụ', 'BT': 'Nghỉ hiệp phụ', 'P': 'Penalty',
        'SUSP': 'Tạm dừng', 'INT': 'Gián đoạn', 'FT': 'Kết thúc', 'AET': 'KT sau hiệp phụ',
        'PEN': 'KT sau Penalty', 'PST': 'Hoãn', 'CANC': 'Hủy', 'ABD': 'Bỏ cuộc',
        'AWD': 'Xử thua', 'WO': 'Walkover', 'LIVE': 'Đang diễn ra'
      };
      return map[short] || short;
    };
    
    const mapped = fixtures.map(f => {
      const dateObj = new Date(f.fixture.date);
      const formatterOptions = { timeZone: 'Asia/Ho_Chi_Minh' };
      const vnDateStr = new Intl.DateTimeFormat('vi-VN', { ...formatterOptions, day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateObj);
      const vnTimeStr = new Intl.DateTimeFormat('vi-VN', { ...formatterOptions, hour: '2-digit', minute: '2-digit' }).format(dateObj);
      const weekdayStr = new Intl.DateTimeFormat('vi-VN', { ...formatterOptions, weekday: 'long' }).format(dateObj);
      const wd = weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1);
      
      const fullDateVietnam = `${wd}, ${vnDateStr} - ${vnTimeStr}`;
      
      let round = f.league.round || '';
      let group = '';
      if (round.toLowerCase().includes('group')) {
        group = round; 
      }
      
      return {
        id: f.fixture.id.toString(),
        apiId: f.fixture.id,
        dateUtc: f.fixture.date,
        dateVietnam: vnDateStr,
        timeVietnam: vnTimeStr,
        fullDateVietnam: fullDateVietnam,
        timezoneLabel: "Giờ Việt Nam",
        venue: f.fixture.venue?.name || '',
        city: f.fixture.venue?.city || '',
        round: round,
        group: group,
        status: f.fixture.status.long,
        statusVi: translateStatus(f.fixture.status.short),
        statusShort: f.fixture.status.short,
        home: {
          id: f.teams.home.id,
          name: f.teams.home.name,
          logo: f.teams.home.logo
        },
        away: {
          id: f.teams.away.id,
          name: f.teams.away.name,
          logo: f.teams.away.logo
        }
      };
    });
    
    const cacheData = {
      lastSyncAt: new Date().toISOString(),
      source: 'api-football',
      data: mapped
    };
    
    writeJSON('worldcup-matches.json', cacheData);
    io.emit('matches:synced');
    res.json({ ok: true, count: mapped.length, lastSyncAt: cacheData.lastSyncAt });
  } catch (error) {
    console.error(`[SYNC] Lỗi hệ thống:`, error.message);
    res.status(500).json({ error: error.message });
  }
});

app.get('/api/worldcup/raw', authMW, hostOnly, async (req, res) => {
  try {
    const leagueId = process.env.WORLD_CUP_LEAGUE_ID;
    const season = process.env.WORLD_CUP_SEASON || '2026';
    if (!leagueId || leagueId === 'replace_after_search') {
      return res.status(400).json({ error: 'Chưa cấu hình WORLD_CUP_LEAGUE_ID' });
    }
    const url = `${process.env.API_FOOTBALL_BASE_URL}/fixtures?league=${leagueId}&season=${season}`;
    const response = await fetch(url, {
      headers: { 'x-apisports-key': process.env.API_FOOTBALL_KEY }
    });
    const data = await response.json();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/worldcup/demo-clear', authMW, hostOnly, (req, res) => {
  const cacheData = {
    lastSyncAt: null,
    source: 'api-football',
    data: []
  };
  writeJSON('worldcup-matches.json', cacheData);
  res.json({ ok: true });
});

app.post('/api/worldcup/import-official-json', authMW, hostOnly, (req, res) => {
  try {
    const data = req.body;
    if (!Array.isArray(data)) return res.status(400).json({ error: 'Dữ liệu không hợp lệ (phải là mảng).' });
    
    const mapped = data.map(f => {
      const dateObj = new Date(f.dateUtc);
      const formatterOptions = { timeZone: 'Asia/Ho_Chi_Minh' };
      const vnDateStr = new Intl.DateTimeFormat('vi-VN', { ...formatterOptions, day: '2-digit', month: '2-digit', year: 'numeric' }).format(dateObj);
      const vnTimeStr = new Intl.DateTimeFormat('vi-VN', { ...formatterOptions, hour: '2-digit', minute: '2-digit' }).format(dateObj);
      const weekdayStr = new Intl.DateTimeFormat('vi-VN', { ...formatterOptions, weekday: 'long' }).format(dateObj);
      const wd = weekdayStr.charAt(0).toUpperCase() + weekdayStr.slice(1);
      
      return {
        id: f.id || uuidv4(),
        apiId: f.apiId || null,
        dateUtc: f.dateUtc,
        dateVietnam: vnDateStr,
        timeVietnam: vnTimeStr,
        fullDateVietnam: `${wd}, ${vnDateStr} - ${vnTimeStr}`,
        timezoneLabel: "Giờ Việt Nam",
        venue: f.venue || '',
        city: f.city || '',
        round: f.round || '',
        group: f.group || '',
        status: f.status || 'Not Started',
        statusVi: f.statusVi || 'Chưa xác định',
        statusShort: f.statusShort || 'TBD',
        home: {
          id: f.home?.id || null,
          name: f.home?.name || 'TBD',
          logo: f.home?.logo || ''
        },
        away: {
          id: f.away?.id || null,
          name: f.away?.name || 'TBD',
          logo: f.away?.logo || ''
        }
      };
    });
    
    const cacheData = {
      lastSyncAt: new Date().toISOString(),
      source: 'official-import',
      data: mapped
    };
    
    writeJSON('worldcup-matches.json', cacheData);
    io.emit('matches:synced');
    res.json({ ok: true, count: mapped.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==================== ROOMS ====================
app.post('/api/rooms', authMW, hostOnly, (req, res) => {
  const currentMatchId = req.body.currentMatchId;
  if (!currentMatchId) return res.status(400).json({ error: 'Vui lòng chọn trận đấu.' });
  
  const matchesCache = readJSON('worldcup-matches.json');
  if (!matchesCache || !matchesCache.data || matchesCache.data.length === 0) {
    return res.status(400).json({ error: 'Chưa có lịch thi đấu chính thức để tạo phòng xem chung.' });
  }
  
  const match = matchesCache.data.find(m => m.id === currentMatchId);
  if (!match) return res.status(400).json({ error: 'Trận đấu không hợp lệ.' });

  const roomId = uuidv4().slice(0, 8);
  const room = { id: uuidv4(), roomId, hostId: req.user.id, isOpen: true, maxGuests: 2, currentGuestIds: [], voiceEnabled: false, guestMicAllowed: false, currentMatchId: currentMatchId, createdAt: new Date().toISOString(), closedAt: null };
  writeJSON('room.json', room);
  io.emit('room:created', { roomId });
  res.json(room);
});

app.get('/api/rooms/current', (req, res) => {
  const room = readJSON('room.json');
  if (!room || !room.isOpen) return res.json({ isOpen: false });
  res.json({ isOpen: true, roomId: room.roomId, voiceEnabled: room.voiceEnabled, guestMicAllowed: room.guestMicAllowed, currentMatchId: room.currentMatchId, guestCount: room.currentGuestIds.length });
});

app.get('/api/rooms/:roomId', authMW, hostOrGuest, (req, res) => {
  const room = readJSON('room.json');
  if (!room || room.roomId !== req.params.roomId) return res.status(404).json({ error: 'Phòng không tồn tại' });
  if (!room.isOpen) return res.status(410).json({ error: 'Phòng đã đóng' });
  res.json(room);
});

app.post('/api/rooms/:roomId/close', authMW, hostOnly, (req, res) => {
  const room = readJSON('room.json');
  if (!room || room.roomId !== req.params.roomId) return res.status(404).json({ error: 'Không tìm thấy' });
  room.isOpen = false;
  room.closedAt = new Date().toISOString();
  room.currentGuestIds = [];
  writeJSON('room.json', room);
  // Clear guest sessions
  const users = readJSON('users.json') || [];
  users.forEach(u => { if (u.role === 'guest') u.currentSessionId = null; });
  writeJSON('users.json', users);
  io.emit('room:close', { roomId: room.roomId });
  res.json({ ok: true });
});

app.post('/api/rooms/:roomId/kick', authMW, hostOnly, (req, res) => {
  const room = readJSON('room.json');
  if (!room) return res.status(404).json({ error: 'Không tìm thấy' });
  const userId = req.body.userId;
  room.currentGuestIds = room.currentGuestIds.filter(id => id !== userId);
  writeJSON('room.json', room);
  const users = readJSON('users.json') || [];
  const u = users.find(x => x.id === userId);
  if (u) { u.currentSessionId = null; writeJSON('users.json', users); }
  io.emit('room:kick', { userId, roomId: room.roomId });
  res.json({ ok: true });
});

app.patch('/api/rooms/:roomId/voice', authMW, hostOnly, (req, res) => {
  const room = readJSON('room.json');
  if (!room) return res.status(404).json({ error: 'Không tìm thấy' });
  if (req.body.voiceEnabled !== undefined) room.voiceEnabled = !!req.body.voiceEnabled;
  if (req.body.guestMicAllowed !== undefined) room.guestMicAllowed = !!req.body.guestMicAllowed;
  writeJSON('room.json', room);
  io.emit('room:voiceUpdate', { voiceEnabled: room.voiceEnabled, guestMicAllowed: room.guestMicAllowed });
  res.json(room);
});

app.patch('/api/rooms/:roomId/current-match', authMW, hostOnly, (req, res) => {
  const room = readJSON('room.json');
  if (!room) return res.status(404).json({ error: 'Không tìm thấy' });
  const newMatchId = req.body.matchId;
  const matchesCache = readJSON('worldcup-matches.json');
  if (!matchesCache || !matchesCache.data) return res.status(400).json({ error: 'Chưa có lịch thi đấu chính thức.' });
  const match = matchesCache.data.find(m => m.id === newMatchId);
  if (!match) return res.status(400).json({ error: 'Trận đấu không hợp lệ.' });
  
  room.currentMatchId = newMatchId;
  writeJSON('room.json', room);
  io.emit('room:matchChanged', { currentMatchId: room.currentMatchId });
  res.json(room);
});

// ==================== SETTINGS ====================
app.get('/api/settings', (req, res) => res.json(readJSON('settings.json') || {}));
app.put('/api/settings', authMW, hostOnly, async (req, res) => {
  const s = readJSON('settings.json') || {};
  const d = sanitizeObj(req.body);
  if (d.siteTitle !== undefined) s.siteTitle = d.siteTitle;
  if (d.darkMode !== undefined) s.darkMode = !!d.darkMode;
  // Change host password
  if (d.hostPassword && d.hostPassword.length >= 4) {
    const users = readJSON('users.json') || [];
    const host = users.find(u => u.role === 'host');
    if (host) { host.password = await bcrypt.hash(d.hostPassword, 12); writeJSON('users.json', users); }
  }
  writeJSON('settings.json', s);
  res.json(s);
});

// ==================== Page Routes ====================
['schedule','login','admin'].forEach(p => {
  app.get(`/${p}`, (req, res) => res.sendFile(path.join(__dirname, 'public', `${p}.html`)));
});
app.get('/room/:roomId', (req, res) => res.sendFile(path.join(__dirname, 'public', 'room.html')));
app.get('*', (req, res) => {
  if (req.path.startsWith('/api/')) return res.status(404).json({ error: 'Not found' });
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// ==================== Socket.IO ====================
const connectedUsers = new Map(); // socketId -> { userId, username, role }

io.on('connection', (socket) => {
  io.emit('viewers:count', io.engine.clientsCount);

  // Authenticate socket
  socket.on('auth', (data) => {
    try {
      const decoded = jwt.verify(data.token, JWT_SECRET);
      connectedUsers.set(socket.id, { userId: decoded.id, username: decoded.username, role: decoded.role, socketId: socket.id });
    } catch {}
  });

  // Room join
  socket.on('room:join', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user) return socket.emit('room:error', { error: 'Chua xac thuc' });
    const room = readJSON('room.json');
    if (!room || !room.isOpen) return socket.emit('room:error', { error: 'Phong khong ton tai hoac da dong' });
    if (room.roomId !== data.roomId) return socket.emit('room:error', { error: 'Room ID khong dung' });

    if (user.role === 'guest') {
      // Check if already in room with another session
      const users = readJSON('users.json') || [];
      const dbUser = users.find(u => u.id === user.userId);
      if (dbUser && dbUser.currentSessionId && dbUser.currentSessionId !== socket.id) {
        // Check if old session is still alive
        const oldSocket = io.sockets.sockets.get(dbUser.currentSessionId);
        if (oldSocket) {
          return socket.emit('room:userAlreadyActive', { error: 'Tài khoản này đang được sử dụng trong phòng.' });
        }
      }
      if (room.currentGuestIds.length >= room.maxGuests && !room.currentGuestIds.includes(user.userId)) {
        return socket.emit('room:full', { error: 'Phòng đã đủ người xem.' });
      }
      if (!room.currentGuestIds.includes(user.userId)) {
        room.currentGuestIds.push(user.userId);
        writeJSON('room.json', room);
      }
      // Set session
      if (dbUser) { dbUser.currentSessionId = socket.id; writeJSON('users.json', users); }
    }

    socket.join('room:' + data.roomId);
    socket.roomId = data.roomId;

    // Broadcast user list
    broadcastRoomUsers(data.roomId);
    socket.emit('room:joined', { roomId: data.roomId, voiceEnabled: room.voiceEnabled, guestMicAllowed: room.guestMicAllowed });
  });

  // WebRTC signaling
  socket.on('webrtc:offer', (data) => {
    const target = findSocketByUserId(data.targetUserId);
    if (target) target.emit('webrtc:offer', { offer: data.offer, fromUserId: connectedUsers.get(socket.id)?.userId });
  });

  socket.on('webrtc:answer', (data) => {
    const target = findSocketByUserId(data.targetUserId);
    if (target) target.emit('webrtc:answer', { answer: data.answer, fromUserId: connectedUsers.get(socket.id)?.userId });
  });

  socket.on('webrtc:iceCandidate', (data) => {
    const target = findSocketByUserId(data.targetUserId);
    if (target) target.emit('webrtc:iceCandidate', { candidate: data.candidate, fromUserId: connectedUsers.get(socket.id)?.userId });
  });

  // Screen share events
  socket.on('host:startShare', () => {
    const user = connectedUsers.get(socket.id);
    if (user?.role === 'host' && socket.roomId) {
      io.to('room:' + socket.roomId).emit('host:startShare', { hostId: user.userId });
    }
  });

  socket.on('host:stopShare', () => {
    const user = connectedUsers.get(socket.id);
    if (user?.role === 'host' && socket.roomId) {
      io.to('room:' + socket.roomId).emit('host:stopShare');
    }
  });

  // Mic events
  socket.on('mic:toggle', (data) => {
    const user = connectedUsers.get(socket.id);
    if (!user || !socket.roomId) return;

    const room = readJSON('room.json');
    if (!room || !room.isOpen || room.roomId !== socket.roomId) return;

    if (user.role === 'guest') {
      if (!room.voiceEnabled || !room.guestMicAllowed) {
        socket.emit('mic:allowed', {
          allowed: false,
          reason: 'Host chưa cho phép khách bật mic.'
        });
        return;
      }
    }

    socket.emit('mic:allowed', { allowed: true });
    io.to('room:' + socket.roomId).emit('mic:toggle', { userId: user.userId, username: user.username, enabled: !!data.enabled });
  });

  socket.on('host:muteViewer', (data) => {
    const user = connectedUsers.get(socket.id);
    if (user?.role !== 'host') return;
    const target = findSocketByUserId(data.userId);
    if (target) target.emit('mic:forceMute');
    io.to('room:' + socket.roomId).emit('mic:toggle', { userId: data.userId, enabled: false });
  });

  socket.on('host:muteAll', () => {
    const user = connectedUsers.get(socket.id);
    if (user?.role !== 'host' || !socket.roomId) return;
    io.to('room:' + socket.roomId).emit('mic:forcemuteAll');
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = connectedUsers.get(socket.id);
    if (user && user.role === 'guest') {
      const room = readJSON('room.json');
      if (room && room.isOpen) {
        room.currentGuestIds = room.currentGuestIds.filter(id => id !== user.userId);
        writeJSON('room.json', room);
      }
      const users = readJSON('users.json') || [];
      const dbUser = users.find(u => u.id === user.userId);
      if (dbUser && dbUser.currentSessionId === socket.id) {
        dbUser.currentSessionId = null;
        writeJSON('users.json', users);
      }
      if (socket.roomId) broadcastRoomUsers(socket.roomId);
    }
    connectedUsers.delete(socket.id);
    io.emit('viewers:count', io.engine.clientsCount);
  });
});

function findSocketByUserId(userId) {
  for (const [sid, u] of connectedUsers) {
    if (u.userId === userId) return io.sockets.sockets.get(sid);
  }
  return null;
}

function broadcastRoomUsers(roomId) {
  const roomUsers = [];
  for (const [sid, u] of connectedUsers) {
    const s = io.sockets.sockets.get(sid);
    if (s && s.rooms.has('room:' + roomId)) {
      roomUsers.push({ userId: u.userId, username: u.username, role: u.role });
    }
  }
  io.to('room:' + roomId).emit('room:userList', roomUsers);
}

// ==================== Start ====================
async function start() {
  ensureDir(DATA_DIR);
  await initUsers();
  server.listen(PORT, () => {
    console.log('');
    console.log('  ==========================================');
    console.log('  World Cup 2026 Watch Party v2');
    console.log(`  Server: http://localhost:${PORT}`);
    console.log('  Accounts: host / guest1 / guest2');
    console.log('  ==========================================');
    console.log('');
  });
}
start().catch(e => { console.error('FATAL:', e); process.exit(1); });
