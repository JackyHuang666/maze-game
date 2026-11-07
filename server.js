'use strict';
/* 迷宮尋寶：HTTP 靜態網站 + WebSocket 多人連線，只用 Node 內建模組。
   啟動：npm start（預設連接埠 3000；Render 會用環境變數 PORT 指定）。 */
const http = require('http');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { attach } = require('./lib/ws');
const { Store } = require('./lib/store');
const { Room, cleanName } = require('./lib/rooms');

const MAX_ROOMS = Number(process.env.MAX_ROOMS) || 300;
const MSG_PER_SEC = 40; // 每條連線每秒最多處理的訊息數

const PUBLIC = path.join(__dirname, 'public');
const TYPES = {
  '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8', '.webmanifest': 'application/manifest+json',
};
const COMPRESSIBLE = new Set(['.html', '.css', '.js', '.json', '.svg', '.txt', '.webmanifest']);
const CSP = [
  "default-src 'self'", "script-src 'self'", "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src https://fonts.gstatic.com", "img-src 'self' data:", "connect-src 'self' ws: wss:",
  "base-uri 'none'", "form-action 'none'", "frame-ancestors 'none'",
].join('; ');

function createApp({ dataDir = process.env.DATA_DIR || path.join(__dirname, 'data') } = {}) {
  const store = new Store(dataDir);
  const rooms = new Map();
  const displays = new Set();
  const fileCache = new Map();

  /* ---------- 靜態檔案 ---------- */
  function resolveFile(urlPath) {
    let p;
    try { p = decodeURIComponent(urlPath); } catch (e) { return null; }
    if (p === '/') p = '/index.html';
    if (p === '/js/game.js') return path.join(__dirname, 'lib', 'game.js'); // 伺服器與瀏覽器共用同一份規則
    const full = path.normalize(path.join(PUBLIC, p));
    if (!full.startsWith(PUBLIC + path.sep)) return null;
    return full;
  }

  function serveStatic(req, res, urlPath) {
    const file = resolveFile(urlPath);
    if (!file) { res.writeHead(400); res.end('Bad request'); return; }
    let entry = fileCache.get(file);
    if (!entry) {
      let stat;
      try { stat = fs.statSync(file); } catch (e) { stat = null; }
      if (!stat || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }); res.end('找不到頁面'); return; }
      const ext = path.extname(file).toLowerCase();
      const raw = fs.readFileSync(file);
      entry = {
        type: TYPES[ext] || 'application/octet-stream',
        raw, gz: COMPRESSIBLE.has(ext) ? zlib.gzipSync(raw) : null,
        mtime: stat.mtime.toUTCString(), html: ext === '.html',
      };
      if (process.env.NODE_ENV === 'production') fileCache.set(file, entry);
    }
    const headers = {
      'Content-Type': entry.type,
      'Cache-Control': entry.html ? 'no-cache' : 'public, max-age=300',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin',
    };
    if (entry.html) headers['Content-Security-Policy'] = CSP;
    const wantsGzip = entry.gz && /\bgzip\b/.test(req.headers['accept-encoding'] || '');
    if (wantsGzip) { headers['Content-Encoding'] = 'gzip'; headers.Vary = 'Accept-Encoding'; }
    const body = wantsGzip ? entry.gz : entry.raw;
    headers['Content-Length'] = body.length;
    res.writeHead(200, headers);
    res.end(req.method === 'HEAD' ? undefined : body);
  }

  const server = http.createServer((req, res) => {
    const url = (req.url || '/').split('?')[0];
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405); res.end(); return; }
    if (url === '/healthz') { res.writeHead(200, { 'Content-Type': 'text/plain' }); res.end('ok'); return; }
    if (url === '/api/records') {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
      res.end(JSON.stringify(store.all())); return;
    }
    serveStatic(req, res, url);
  });

  /* ---------- 連線與訊息 ---------- */
  const out = (ws, obj) => ws.send(JSON.stringify(obj));
  const fail = (ws, code, msg, fatal) => out(ws, { t: 'err', code, msg, fatal: !!fatal });
  const sendRecords = (ws) => out(ws, { t: 'lb', recs: store.all() });
  store.listeners.add(() => { for (const ws of displays) sendRecords(ws); });

  function newCode() {
    for (let i = 0; i < 200; i++) {
      const c = String(1000 + Math.floor(Math.random() * 9000));
      if (!rooms.has(c)) return c;
    }
    return null;
  }

  function onMessage(ws, text) {
    const c = ws.ctx;
    const now = Date.now();
    if (now - c.winStart > 1000) { c.winStart = now; c.count = 0; }
    if (++c.count > MSG_PER_SEC) return;
    let m;
    try { m = JSON.parse(text); } catch (e) { return; }
    if (!m || typeof m.t !== 'string') return;
    const room = c.room;
    if (room) room.touched = now;

    switch (m.t) {
      case 'create': { // 大螢幕開房，或重新連回原本的房間
        if (c.role) return;
        const want = typeof m.code === 'string' && /^\d{4}$/.test(m.code) ? m.code : null;
        let r = want && rooms.get(want);
        if (r && r.display && r.display.open) r = null; // 已有別的大螢幕
        if (!r) {
          if (rooms.size >= MAX_ROOMS) return fail(ws, 'busy', '伺服器上的房間已滿，請稍後再試。', true);
          const code = newCode();
          if (!code) return fail(ws, 'busy', '無法建立房間，請稍後再試。', true);
          r = new Room(code, store); rooms.set(code, r);
        }
        r.display = ws; c.role = 'display'; c.room = r; displays.add(ws);
        out(ws, { t: 'created', code: r.code });
        r.sendState(ws); sendRecords(ws);
        return;
      }
      case 'join': { // 手機加入
        if (c.role) return;
        const code = typeof m.code === 'string' ? m.code : '';
        const r = rooms.get(code);
        if (!r) return fail(ws, 'no_room', '找不到這個房號。請確認大螢幕已開啟，並重新輸入。', true);
        const name = cleanName(m.name, 8) || '玩家';
        let p = typeof m.id === 'string' ? r.pl.find(q => q.k === m.id && q.k !== 'local') : null;
        if (p) { // 斷線重連：接回原本的位置
          if (p.ws && p.ws.open) p.ws.close(1000);
          p.ws = ws; p.off = 0;
        } else {
          p = r.addPlayer(r.newPlayerId(), name, ws);
          if (!p) return fail(ws, 'full', '這個房間已經滿六人了。', true);
        }
        c.role = 'player'; c.room = r; c.pid = p.k;
        r.touched = now;
        out(ws, { t: 'joined', id: p.k, code: r.code });
        r.publish();
        return;
      }
      default: break;
    }
    if (!room) return;

    if (c.role === 'display') {
      switch (m.t) {
        case 'cfg': room.setConfig(m.th, m.li); break;
        case 'start': room.start(m.tn); break;
        case 'abort': case 'again': room.toLobby(); break;
        case 'local': room.setLocal(!!m.on); break;
        case 'mv': if (room.pl.some(p => p.k === 'local')) room.move('local', m.d, m.m === undefined ? undefined : (m.m ? 1 : 0)); break;
        case 'mode': room.setMode('local', m.m); break;
        case 'rs': room.reset(); break;
        default: break;
      }
    } else if (c.role === 'player') {
      switch (m.t) {
        case 'mv': room.move(c.pid, m.d, m.m === undefined ? undefined : (m.m ? 1 : 0)); break;
        case 'mode': room.setMode(c.pid, m.m); break;
        case 'rs': room.reset(); break;
        default: break;
      }
    }
  }

  function onClose(ws) {
    const c = ws.ctx;
    displays.delete(ws);
    const r = c && c.room;
    if (!r) return;
    r.touched = Date.now();
    if (c.role === 'display') { if (r.display === ws) r.display = null; }
    else if (c.role === 'player') {
      const p = r.pl.find(q => q.k === c.pid);
      if (p && p.ws === ws) { p.ws = null; p.off = Date.now(); r.publish(); }
    }
  }

  const wss = attach(server, {
    path: '/ws', maxPayload: 2048,
    onConnection(ws) {
      ws.ctx = { role: null, room: null, pid: null, winStart: Date.now(), count: 0 };
      ws.on('message', (t) => onMessage(ws, t));
      ws.on('close', () => onClose(ws));
    },
  });

  // 伺服器時鐘：每 100ms 推進所有房間（小怪獸、呼吸倒數、斷線清理）
  const loop = setInterval(() => {
    const now = Date.now();
    for (const [code, r] of rooms) {
      if (r.isIdle(now)) { rooms.delete(code); continue; }
      try { r.tick(now); } catch (e) { console.error('[room ' + code + ']', e); }
    }
  }, 100);
  loop.unref();

  return {
    server, store, rooms,
    listen(port, host = '0.0.0.0') {
      return new Promise((resolve) => server.listen(port, host, () => resolve(server.address().port)));
    },
    close() { clearInterval(loop); store.flush(); wss.close(); server.close(); },
  };
}

module.exports = { createApp };

if (require.main === module) {
  const app = createApp();
  const port = Number(process.env.PORT) || 3000;
  app.listen(port).then((p) => console.log('迷宮尋寶已啟動：http://localhost:' + p));
  const stop = () => { app.close(); process.exit(0); };
  process.on('SIGTERM', stop);
  process.on('SIGINT', stop);
}
