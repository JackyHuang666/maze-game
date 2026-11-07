'use strict';
/* ===== 狀態與共用 ===== */
const $ = id => document.getElementById(id);
const fmt = ms => { ms = Math.max(0, ms | 0); const m = ms / 60000 | 0, s = (ms % 60000) / 1000; return m + ':' + (s < 10 ? '0' : '') + s.toFixed(1); };
let seenVer = 0, padMode = 0, role = null, myPeer = null, myName = '', S = null, lv = null, lvKey = '', seen = null, cur = null,
  recs = [], scope = 'this', phKey = '', camX = 1, camY = 1, hostCode = '';
const show = id => document.querySelectorAll('.view').forEach(v => v.hidden = v.id !== id);
const store = {
  get(k) { try { return sessionStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { sessionStorage.setItem(k, v); } catch (e) { /* 無痕模式 */ } },
  del(k) { try { sessionStorage.removeItem(k); } catch (e) { /* ignore */ } },
};
const lstore = {
  get(k) { try { return localStorage.getItem(k) || ''; } catch (e) { return ''; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch (e) { /* ignore */ } },
};

let AC;
function chime(fs) {
  try {
    AC = AC || new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume();
    const t = AC.currentTime;
    fs.forEach((f, i) => {
      const o = AC.createOscillator(), g = AC.createGain(), s = t + i * .2;
      o.type = 'sine'; o.frequency.value = f; g.gain.setValueAtTime(0, s);
      g.gain.linearRampToValueAtTime(.1, s + .03); g.gain.exponentialRampToValueAtTime(.001, s + 1.8);
      o.connect(g); g.connect(AC.destination); o.start(s); o.stop(s + 1.9);
    });
  } catch (e) { /* 沒有音效也能玩 */ }
}

function ensureLevel(sd, li) {
  const k = sd + '/' + li;
  if (k !== lvKey) { lvKey = k; lv = gen(sd, li); lv.key = k; seen = new Uint8Array(lv.W * lv.H); }
}
function setS(st) {
  S = {
    sd: st.sd, li: st.li, th: st.th, ph: st.ph, el: st.el, bl: st.bl, tn: st.tn, b: st.b, at: performance.now(),
    pl: st.pl.map(a => ({ k: a[0], n: a[1], x: a[2], y: a[3], c: a[4], m: a[5] | 0, fz: a[6] | 0, v: visOf(st.li, a[4]) })),
    mo: st.mo || [], hc: st.hc | 0,
  };
  if (st.ph === 'lobby') { lv = null; lvKey = ''; seen = null; cur = null; }
  else {
    ensureLevel(st.sd, st.li); cur = new Uint8Array(lv.W * lv.H);
    for (const p of S.pl) mark(seen, lv, p.x, p.y, p.v, (role === 'host' || p.k === myPeer) ? cur : null);
    seenVer++;
    if (st.ph === 'done') { cur.fill(1); seen.fill(1); }
  }
  const pk = st.ph + st.sd; if (pk !== phKey) { phKey = pk; renderOv(); }
  if (role === 'host') updateSide();
}
const rankOf = ms => recs.filter(r => r && r.th === S.th && r.li === S.li && typeof r.ms === 'number' && r.ms < ms - 1).length + 1;

/* ===== 連線（WebSocket，斷線自動重連） ===== */
let ws = null, retryTimer = null, retryN = 0, wantConn = false, fatal = false;
function tx(o) { if (ws && ws.readyState === 1) ws.send(JSON.stringify(o)); }
function connect() {
  wantConn = true; fatal = false;
  clearTimeout(retryTimer);
  if (ws && (ws.readyState === 0 || ws.readyState === 1)) return;
  setNet('連線中…');
  ws = new WebSocket((location.protocol === 'https:' ? 'wss://' : 'ws://') + location.host + '/ws');
  const mine = ws;
  ws.onopen = () => {
    retryN = 0;
    if (role === 'host') tx({ t: 'create', code: hostCode || store.get('mz_host') || undefined });
    else if (role === 'pad') tx({ t: 'join', code: store.get('mz_code'), name: myName, id: store.get('mz_id') || undefined });
  };
  ws.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (_) { return; } onMsg(m); };
  ws.onclose = () => {
    if (ws !== mine) return;
    ws = null;
    if (!wantConn || fatal) return;
    setNet('連線中斷，重新連線中…', 'bad');
    if (role === 'pad') $('hint').textContent = '連線中斷，重新連線中…';
    const wait = Math.min(8000, 800 * Math.pow(1.6, retryN++));
    retryTimer = setTimeout(connect, wait);
    if (role === 'host') $('retryBtn').hidden = false;
  };
  ws.onerror = () => { /* onclose 會接著處理 */ };
}
function setNet(t, cls) { const n = $('netNote'); if (!n) return; n.textContent = t || ''; n.className = cls || ''; }

function onMsg(m) {
  switch (m.t) {
    case 'created':
      hostCode = m.code; store.set('mz_host', m.code);
      $('hcode').textContent = m.code; $('linkBox').value = joinUrl();
      if (drawQR($('qrSmall'), joinUrl(), 6)) $('joinRow').hidden = false;
      $('retryBtn').hidden = true; setNet('已連線，等待玩家加入', 'ok');
      phKey = ''; if (S) renderOv();
      break;
    case 'joined':
      myPeer = m.id; store.set('mz_id', m.id); store.set('mz_code', m.code);
      $('jerr').textContent = ''; $('jgo').disabled = false;
      $('pname').textContent = myName; show('v-pad'); $('hint').textContent = '';
      if (!S) renderOv();
      break;
    case 'st': setS(m.st); break;
    case 'lb': recs = Array.isArray(m.recs) ? m.recs : []; renderBoard(); if (S && S.ph === 'done') renderOv(); break;
    case 'ev':
      if (role === 'host') {
        if (m.e === 'start') chime([523, 784]);
        else if (m.e === 'home') chime([660, 990]);
        else if (m.e === 'hit') chime([196, 165]);
        else if (m.e === 'done') chime([523, 659, 784, 1047]);
      } else if (navigator.vibrate) {
        try { navigator.vibrate(m.e === 'hit' ? [120, 60, 120] : m.e === 'home' ? 40 : m.e === 'done' ? [60, 40, 60, 40, 120] : 0); } catch (_) { /* ignore */ }
      }
      break;
    case 'err':
      if (m.fatal) { fatal = true; wantConn = false; if (ws) ws.close(); }
      if (role === 'pad') {
        store.del('mz_id'); role = null; show('v-join');
        $('jerr').textContent = m.msg || '無法加入，請稍後再試。'; $('jgo').disabled = false;
      } else if (role === 'host') { setNet(m.msg || '無法建立房間。', 'bad'); $('retryBtn').hidden = false; store.del('mz_host'); hostCode = ''; }
      break;
    default: break;
  }
}

/* ===== 覆蓋層文字 ===== */
const breathHtml = '<div class="breath"></div><div class="bt"><span>吸氣…</span><span>吐氣…</span></div>';
function joinUrl() {
  const u = new URL(location.href); u.search = '?room=' + hostCode; u.hash = ''; return u.toString();
}
function renderOv() {
  const el = role === 'host' ? $('hov') : $('pov'); if (!el) return;
  const ph = S ? S.ph : 'none', host = role === 'host'; let h = '';
  if (ph === 'lobby') h = host ? (hostCode ? '<div class="card"><h2>先停下來，看一看</h2><canvas id="qrBig" class="qrbig" aria-label="加入房間的 QR Code"></canvas><div class="codebig">' + hostCode + '</div><p>用手機相機掃描 QR Code，或把邀請連結傳給朋友。</p><button class="mini" id="copyBig">複製邀請連結</button></div>' : '<div class="card"><h2>先停下來，看一看</h2><p>正在建立房間…</p></div>')
    : '<div class="card"><h2>已加入</h2><p>等大螢幕開始。先看看四周，不用急。</p></div>';
  else if (ph === 'breathe') h = '<div class="card">' + breathHtml + '<p>' + (host ? '觀察整體氣氛，再看手機上的小範圍。' : '看看自己周圍的路。') + '時間在這口氣之後才開始計算。</p></div>';
  else if (ph === 'done') {
    const rk = rankOf(S.el);
    h = '<div class="card"><h2>全員完成</h2><div class="tbig">' + fmt(S.el) + '</div><p>' + (rk === 1 ? '這是目前此條件的最短紀錄' : '此地圖與難度第 ' + rk + ' 名') + '</p>' + (S.hc ? '<p>被小怪獸撞到 ' + S.hc + ' 次</p>' : '') + (host ? '<button class="big go" id="againBtn">再玩一局</button>' : '<p>等大螢幕開下一局</p>') + '</div>';
  } else if (ph === 'none') h = '<div class="card"><h2>連線中…</h2><p>請稍候。</p></div>';
  el.innerHTML = h;
  if (host && hostCode && ph === 'lobby') { drawQR($('qrBig'), joinUrl(), 8); const cb = $('copyBig'); if (cb) cb.onclick = () => copyLink(cb); }
  const ag = $('againBtn'); if (ag) ag.onclick = () => tx({ t: 'again' });
}

/* ===== 大螢幕 ===== */
function updateSide() {
  const lob = S.ph === 'lobby';
  $('lobbyCtl').hidden = !lob;
  const ab = $('abortBtn'); if (ab) ab.hidden = !(S.ph === 'play' || S.ph === 'breathe');
  [...$('themeGrid').children].forEach((b, i) => b.classList.toggle('on', i === S.th));
  [...$('lvGrid').children].forEach((b, i) => b.classList.toggle('on', i === S.li));
  $('locChk').checked = S.pl.some(p => p.k === 'local');
  const n = S.pl.length, sb = $('startBtn'); sb.disabled = !n; sb.textContent = n ? '開始（' + n + ' 人）' : '等待玩家加入';
  const pl = $('plist'); pl.textContent = '';
  if (!n) { const e = document.createElement('span'); e.className = 'note'; e.textContent = '還沒有人加入。'; pl.appendChild(e); }
  S.pl.forEach(p => {
    const c = document.createElement('div'); c.className = 'chip'; const b = document.createElement('b'); b.style.background = PC[p.c]; b.textContent = [...p.n][0] || '?';
    const s = document.createElement('span'); s.textContent = p.n + ' · 視野 ' + visOf(S.li, p.c) + (p.m ? ' · 抓' : ''); c.append(b, s); pl.appendChild(c);
  });
  renderBoard();
}
function renderBoard() {
  const ol = $('bList'); if (!ol) return; ol.textContent = '';
  let rows = recs.filter(r => r && typeof r.ms === 'number' && TH[r.th] && LV[r.li]);
  if (scope === 'this' && S) rows = rows.filter(r => r.th === S.th && r.li === S.li);
  rows.sort((a, b) => a.ms - b.ms); rows = rows.slice(0, 8);
  if (!rows.length) { const li = document.createElement('li'); li.className = 'empty'; li.textContent = '還沒有紀錄，成為第一個完成的人。'; ol.appendChild(li); return; }
  rows.forEach((r, i) => {
    const li = document.createElement('li'), a = document.createElement('span'), b = document.createElement('span'), c = document.createElement('span'), sm = document.createElement('small');
    a.className = 'rk'; a.textContent = i + 1; b.className = 'nm'; b.textContent = String(r.name || '').slice(0, 12) + ' ';
    sm.textContent = (r.np === 1 ? '個人' : (r.np | 0) + ' 人') + (scope === 'all' ? ' · ' + TH[r.th].n + ' ' + LV[r.li].n : ''); b.appendChild(sm);
    c.className = 'tm'; c.textContent = fmt(r.ms); li.append(a, b, c); ol.appendChild(li);
  });
}
function initHostUI() {
  const tg = $('themeGrid'); tg.textContent = '';
  TH.forEach((t, i) => {
    const b = document.createElement('button'); const sw = document.createElement('i');
    sw.style.background = 'linear-gradient(90deg,' + t.f1 + ' 55%,' + t.w + ' 55%,' + t.w + ' 78%,' + t.hi + ' 78%)'; b.append(sw, document.createTextNode(t.n));
    b.onclick = () => tx({ t: 'cfg', th: i }); tg.appendChild(b);
  });
  const lg = $('lvGrid'); lg.textContent = '';
  LV.forEach((l, i) => {
    const b = document.createElement('button'); b.textContent = l.n; const s = document.createElement('small'); s.textContent = (2 * l.c + 1) + '×' + (2 * l.c + 1) + ' · ' + l.b + ' 顆寶石 · ' + l.m + ' 隻小怪獸'; b.appendChild(s);
    b.onclick = () => tx({ t: 'cfg', li: i }); lg.appendChild(b);
  });
  $('startBtn').onclick = () => { chime([523]); tx({ t: 'start', tn: $('teamName').value.trim().slice(0, 12) }); };
  $('locChk').onchange = e => tx({ t: 'local', on: e.target.checked });
  $('bScope').onclick = e => { const s = e.target.dataset && e.target.dataset.s; if (!s) return; scope = s; [...$('bScope').children].forEach(b => b.classList.toggle('on', b.dataset.s === s)); renderBoard(); };
  $('plist').parentElement.insertAdjacentHTML('afterend', '<button id="abortBtn" class="link" hidden>結束本局，回到選單</button>');
  $('abortBtn').onclick = () => tx({ t: 'abort' });
  $('copyBtn').onclick = e => copyLink(e.currentTarget);
  $('retryBtn').onclick = () => { $('retryBtn').hidden = true; retryN = 0; connect(); };
}
async function copyLink(btn) {
  const url = joinUrl(), old = btn.textContent;
  const done = () => { btn.textContent = '已複製'; setTimeout(() => { btn.textContent = old; }, 1500); };
  try { await navigator.clipboard.writeText(url); done(); }
  catch (e) { const b = $('linkBox'); if (b) { b.focus(); b.select(); btn.textContent = '請按 Ctrl/⌘+C 複製'; setTimeout(() => { btn.textContent = old; }, 2500); } }
}
function startHost() {
  role = 'host'; show('v-host'); initHostUI(); $('joinRow').hidden = false; $('linkBox').value = '';
  setS({ sd: 0, li: 1, th: 0, ph: 'lobby', el: 0, bl: 0, tn: '', pl: [], b: [], mo: [], hc: 0 });
  connect();
}

/* ===== 手機（玩家端）===== */
function sendMove(d) { tx({ t: 'mv', d, m: padMode }); }
function startPad(code, name) {
  role = 'pad'; myName = name; store.set('mz_code', code); store.del('mz_id');
  $('jerr').textContent = '連線中…'; $('jgo').disabled = true;
  connect();
}
function setMode(m) {
  padMode = m; [...$('modeSeg').children].forEach(b => b.classList.toggle('on', +b.dataset.m === m));
  $('modeNote').textContent = m ? '抓：站在寶石旁，往遠離寶石的方向走，寶石會跟著你。' : '推：往寶石的方向走，把寶石推開。';
  if (navigator.vibrate) try { navigator.vibrate(12); } catch (e) { /* ignore */ }
  tx({ t: 'mode', m });
}
function bindPad() {
  const pad = $('dpad'); let timer = null, btn = null, pid = null;
  const clear = () => { clearInterval(timer); timer = null; if (btn) btn.classList.remove('dn'); btn = null; pid = null; };
  const press = (b, first) => {
    if (b === btn) return;
    clearInterval(timer); if (btn) btn.classList.remove('dn');
    btn = b; b.classList.add('dn'); const d = +b.dataset.d;
    if (first && navigator.vibrate) try { navigator.vibrate(8); } catch (e) { /* ignore */ }
    sendMove(d); timer = setInterval(() => sendMove(d), 140);
  };
  const under = e => { const el = document.elementFromPoint(e.clientX, e.clientY); return el && el.closest ? el.closest('#dpad button') : null; };
  pad.addEventListener('pointerdown', e => {
    const b = e.target.closest('button'); if (!b) return;
    e.preventDefault(); pid = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
    press(b, true);
  });
  // 手指按著滑到別的方向鍵，就直接換方向；滑出方向鍵範圍就停
  pad.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    const b = under(e); if (b) press(b, false); else clear();
  });
  const end = e => { if (e.pointerId === pid) clear(); };
  ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(t => pad.addEventListener(t, end));
  // 保險：放開、取消、切換分頁、失去焦點、旋轉螢幕都停止移動，避免方向鍵「黏住」
  ['touchend', 'touchcancel'].forEach(t => window.addEventListener(t, e => { if (!e.touches || !e.touches.length) clear(); }, { passive: true }));
  ['blur', 'pagehide', 'orientationchange', 'resize'].forEach(t => window.addEventListener(t, clear));
  document.addEventListener('visibilitychange', clear);
  pad.addEventListener('contextmenu', e => e.preventDefault());
  $('modeSeg').onclick = e => { const b = e.target.closest('button'); if (!b) return; setMode(+b.dataset.m); };
  $('resetBtn').onclick = () => tx({ t: 'rs' });
}

/* ===== 鍵盤 ===== */
const KEYS = { ArrowUp: 0, w: 0, W: 0, ArrowDown: 1, s: 1, S: 1, ArrowLeft: 2, a: 2, A: 2, ArrowRight: 3, d: 3, D: 3 };
window.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT') return;
  const hostLocal = role === 'host' && $('locChk').checked;
  if (e.key === ' ' || e.key === 'e' || e.key === 'E') {
    if (hostLocal) { e.preventDefault(); const p = S && S.pl.find(q => q.k === 'local'); if (p) tx({ t: 'mode', m: p.m ? 0 : 1 }); }
    else if (role === 'pad') { e.preventDefault(); setMode(padMode ? 0 : 1); }
    return;
  }
  if (!(e.key in KEYS)) return;
  const d = KEYS[e.key];
  if (hostLocal) { e.preventDefault(); tx({ t: 'mv', d }); }
  else if (role === 'pad') { e.preventDefault(); sendMove(d); }
});

/* ===== 畫面迴圈 ===== */
let monR = [], monKey = '', lastHint = '';
function lerpMon() {
  if (!S || !lv) return monR;
  if (monKey !== lvKey || monR.length !== S.mo.length) { monKey = lvKey; monR = S.mo.map(m => ({ x: m[0], y: m[1] })); }
  S.mo.forEach((m, i) => { const r = monR[i]; r.x += (m[0] - r.x) * .2; r.y += (m[1] - r.y) * .2; });
  return monR;
}
const clockMs = () => !S ? 0 : S.ph === 'play' ? S.el + (performance.now() - S.at) : S.el;
function frame(t) {
  requestAnimationFrame(frame);
  if (role === 'host') {
    const cv = $('hc'), [w, h] = fitCanvas(cv), ctx = cv.getContext('2d');
    if (S && lv && S.ph !== 'lobby') drawMaze(ctx, w, h, { lv, S, seen, cur, ver: seenVer, mr: lerpMon(), x0: 0, y0: 0, cols: lv.W, rows: lv.H, all: true, meK: null, t });
    else { const T = TH[S ? S.th : 0]; ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h); particles(ctx, w, h, T, t); }
    $('hclock').textContent = fmt(clockMs());
  } else if (role === 'pad') {
    const cv = $('pc'), [w, h] = fitCanvas(cv), ctx = cv.getContext('2d');
    if (S && lv && S.ph !== 'lobby') {
      const me = S.pl.find(p => p.k === myPeer), R = 6;
      if (me) { camX += (me.x - camX) * .28; camY += (me.y - camY) * .28; }
      drawMaze(ctx, w, h, { lv, S, seen, cur, ver: seenVer, mr: lerpMon(), x0: camX - R, y0: camY - R, cols: 2 * R + 1, rows: 2 * R + 1, all: false, meK: myPeer, t });
      if (me) {
        const left = me.fz - (t - S.at), hs = left > 0 ? '撞到小怪獸，回到起點了。' + Math.ceil(left / 1000) + ' 秒後可以繼續。' : '';
        if (hs !== lastHint) { lastHint = hs; $('hint').textContent = hs; }
        if (left > 0) { ctx.fillStyle = 'rgba(255,255,255,' + (.12 + .06 * Math.sin(t / 180)) + ')'; ctx.fillRect(0, 0, w, h); }
        const nm = myName + ' · 視野 ' + me.v + ' 格'; if ($('pname').textContent !== nm) $('pname').textContent = nm;
      } else if (S.ph === 'play') $('hint').textContent = '你正在加入這一局，請稍候。';
    } else { const T = TH[S ? S.th : 0]; ctx.fillStyle = T.bg; ctx.fillRect(0, 0, w, h); particles(ctx, w, h, T, t); }
    $('pclock').textContent = fmt(clockMs());
  }
}

/* ===== 入口 ===== */
(function init() {
  show('v-home'); bindPad();
  if (!('WebSocket' in window)) $('homeNote').textContent = '這個瀏覽器不支援即時連線，請改用較新的瀏覽器。';
  $('b-host').onclick = startHost;
  const openJoin = code => {
    show('v-join'); if (code) $('jcode').value = code;
    $('jname').value = lstore.get('mz_name'); ($('jcode').value ? $('jname') : $('jcode')).focus();
  };
  $('b-join').onclick = () => openJoin('');
  $('jback').onclick = () => show('v-home');
  $('jgo').onclick = () => {
    const code = $('jcode').value.trim(), name = $('jname').value.trim();
    if (!/^\d{4}$/.test(code)) { $('jerr').textContent = '請輸入大螢幕上的四位數房號。'; return; }
    if (!name) { $('jerr').textContent = '請輸入你的名字。'; return; }
    lstore.set('mz_name', name); startPad(code, name);
  };
  // 掃描 QR Code 會帶 ?room=1234；舊格式 #room-1234 也接受
  const m = /[?&]room=(\d{4})\b/.exec(location.search) || /^#room-(\d{4})$/.exec(location.hash);
  if (m) openJoin(m[1]);
  requestAnimationFrame(frame);
})();
