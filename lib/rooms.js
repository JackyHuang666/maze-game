'use strict';
/* 房間：每個房間由伺服器負責所有遊戲規則（開局、移動、小怪獸、計時、紀錄）。
   大螢幕與手機都只送「想做什麼」，再接收伺服器廣播的狀態。 */
const G = require('./game');
const { D4, TH, LV, BREATH, gen, tryMove, allHome, spawnSpot } = G;

const MAX_PLAYERS = 6;
const MOVE_GAP_MS = 80;       // 同一位玩家兩次移動的最短間隔
const FREEZE_MS = 3000;       // 撞到小怪獸後暫停
const OFFLINE_GRACE_MS = 20000; // 玩家斷線後保留位置的時間
const BREATH_MS = Number(process.env.BREATH_MS) || BREATH;

const cleanName = (s, max) => String(s == null ? '' : s)
  .replace(/[\u0000-\u001f\u007f<>]/g, '').trim().slice(0, max);

class Room {
  constructor(code, store) {
    this.code = code;
    this.store = store;
    this.display = null;        // 大螢幕的連線
    this.pl = [];               // 玩家：{k,n,x,y,c,m,fz,ws,off}
    this.nextId = 1;
    this.sd = 0; this.li = 1; this.th = 0;
    this.ph = 'lobby';          // lobby → breathe → play → done
    this.b = []; this.mo = []; this.mk = [];
    this.mt = 0; this.hits = 0; this.el = 0; this.t0 = 0; this.bEnd = 0; this.tn = '';
    this.lv = null;
    this.lastMv = {};
    this.lastPub = 0;
    this.touched = Date.now();
  }

  /* ---------- 傳送 ---------- */
  state() {
    const now = Date.now();
    return {
      sd: this.sd, li: this.li, th: this.th, ph: this.ph,
      el: this.ph === 'play' ? now - this.t0 : this.el,
      bl: this.ph === 'breathe' ? Math.max(0, this.bEnd - now) : 0,
      tn: this.tn,
      pl: this.pl.map(p => [p.k, p.n, p.x, p.y, p.c, p.m | 0, Math.max(0, (p.fz || 0) - now)]),
      b: this.b, mo: this.mo, hc: this.hits,
    };
  }

  targets() {
    const out = [];
    if (this.display) out.push(this.display);
    for (const p of this.pl) if (p.ws) out.push(p.ws);
    return out;
  }

  publish() {
    this.lastPub = Date.now();
    const msg = JSON.stringify({ t: 'st', st: this.state() });
    for (const ws of this.targets()) ws.send(msg);
  }

  event(e) {
    const msg = JSON.stringify({ t: 'ev', e });
    for (const ws of this.targets()) ws.send(msg);
  }

  sendState(ws) { ws.send(JSON.stringify({ t: 'st', st: this.state() })); }

  /* ---------- 玩家 ---------- */
  findByWs(ws) { return this.pl.find(p => p.ws === ws); }

  addPlayer(k, name, ws) {
    if (this.pl.length >= MAX_PLAYERS) return null;
    let c = 0; while (this.pl.some(p => p.c === c)) c++;
    const p = { k, n: name || '玩家', x: 1, y: 1, c, m: 0, fz: 0, ws, off: 0 };
    if (this.lv && this.ph !== 'lobby') { const s = spawnSpot(this.lv, this.pl, this.b); p.x = s[0]; p.y = s[1]; }
    this.pl.push(p);
    return p;
  }

  removePlayer(k) {
    const i = this.pl.findIndex(p => p.k === k);
    if (i >= 0) { this.pl.splice(i, 1); return true; }
    return false;
  }

  newPlayerId() { return 'p' + (this.nextId++) + Math.random().toString(36).slice(2, 6); }

  /* ---------- 設定與流程 ---------- */
  setConfig(th, li) {
    if (this.ph !== 'lobby') return;
    if (Number.isInteger(th) && th >= 0 && th < TH.length) this.th = th;
    if (Number.isInteger(li) && li >= 0 && li < LV.length) this.li = li;
    this.publish();
  }

  setLocal(on) {
    if (this.ph !== 'lobby') return;
    const has = this.pl.some(p => p.k === 'local');
    if (on && !has) this.addPlayer('local', '本機', null);
    else if (!on && has) this.removePlayer('local');
    this.publish();
  }

  start(tn) {
    if (!this.pl.length || this.ph === 'breathe' || this.ph === 'play') return;
    this.sd = (Math.random() * 2147483647) | 0;
    this.lv = gen(this.sd, this.li);
    this.b = this.lv.balls.map(b => b.slice());
    this.hits = 0; this.mt = Date.now();
    this.mk = this.lv.mons.map((m, i) => ({ k: (i * 2) % m.length, d: 1 }));
    this.mo = this.mk.map((q, i) => this.lv.mons[i][q.k].slice());
    const placed = [];
    for (const p of this.pl) { const s = spawnSpot(this.lv, placed, this.b); p.x = s[0]; p.y = s[1]; p.fz = 0; placed.push(p); }
    this.tn = cleanName(tn, 12);
    this.ph = 'breathe'; this.bEnd = Date.now() + BREATH_MS;
    this.publish();
    this.event('start');
  }

  toLobby() {
    this.ph = 'lobby'; this.sd = 0; this.b = []; this.mo = []; this.mk = []; this.el = 0; this.lv = null;
    for (const p of this.pl) p.fz = 0;
    this.publish();
  }

  /* ---------- 玩家操作 ---------- */
  setMode(k, m) {
    const p = this.pl.find(q => q.k === k);
    if (!p) return;
    const nm = m ? 1 : 0;
    if (p.m !== nm) { p.m = nm; this.publish(); }
  }

  move(k, d, m) {
    if (this.ph !== 'play' || !this.lv) return;
    if (!Number.isInteger(d) || d < 0 || d > 3) return;
    const now = Date.now();
    if (now - (this.lastMv[k] || 0) < MOVE_GAP_MS) return;
    this.lastMv[k] = now;
    const p = this.pl.find(q => q.k === k);
    if (!p || p.fz > now) return;
    const dd = D4[d], tx = p.x + dd[0], ty = p.y + dd[1];
    if (!this.lv.g[ty * this.lv.W + tx] && this.mo.some(q => q[0] === tx && q[1] === ty)) {
      this.hit(p); this.publish(); return;
    }
    const modeChanged = m !== undefined && (m ? 1 : 0) !== (p.m | 0);
    if (m !== undefined) p.m = m ? 1 : 0;
    const before = this.homeCount();
    if (!tryMove(this.lv, this, k, d, p.m)) { if (modeChanged) this.publish(); return; }
    if (this.homeCount() > before) this.event('home');
    if (allHome(this.lv, this.b)) this.finish();
    this.publish();
  }

  homeCount() {
    const t = this.lv.targets;
    return this.b.filter((q, i) => q[0] === t[i][0] && q[1] === t[i][1]).length;
  }

  hit(p) {
    const others = this.pl.filter(q => q !== p), s = spawnSpot(this.lv, others, this.b);
    p.x = s[0]; p.y = s[1]; p.fz = Date.now() + FREEZE_MS; this.hits++;
    this.event('hit');
  }

  reset() {
    if (this.ph !== 'play' || !this.lv) return;
    // 全部寶石回到出發位置（出發局面保證有解）；站在寶石位置上的玩家移到旁邊空位
    this.b = this.lv.balls.map(b => b.slice());
    for (const p of this.pl) {
      if (this.b.some(b => b[0] === p.x && b[1] === p.y)) {
        const o = this.pl.filter(q => q !== p), sp = spawnSpot(this.lv, o, this.b); p.x = sp[0]; p.y = sp[1];
      }
    }
    this.publish();
  }

  finish() {
    this.ph = 'done'; this.el = Date.now() - this.t0;
    const name = this.tn || (this.pl.length === 1 ? this.pl[0].n : '無名小組');
    this.store.add({ name: cleanName(name, 12) || '無名小組', th: this.th, li: this.li, ms: this.el, np: this.pl.length, ts: Date.now() });
    this.event('done');
  }

  /* ---------- 定時更新（由伺服器每 100ms 呼叫一次） ---------- */
  tick(now) {
    // 斷線太久的玩家退出
    let changed = false;
    for (let i = this.pl.length - 1; i >= 0; i--) {
      const p = this.pl[i];
      if (p.k !== 'local' && !p.ws && p.off && now - p.off > OFFLINE_GRACE_MS) { this.pl.splice(i, 1); changed = true; }
    }
    if (this.ph === 'breathe' && now >= this.bEnd) {
      this.ph = 'play'; this.t0 = now; this.publish(); return;
    }
    if (this.lv && (this.ph === 'play' || this.ph === 'breathe') && now - this.mt >= LV[this.li].ms) {
      this.mt = now; this.monStep(now);
      return;
    }
    if (changed || (this.ph === 'play' && now - this.lastPub > 1500)) this.publish();
  }

  monStep(now) {
    let ch = false;
    this.lv.mons.forEach((m, i) => {
      const s = this.mk[i]; if (!s) return;
      let nk = s.k + s.d;
      if (nk < 0 || nk >= m.length) { s.d = -s.d; nk = s.k + s.d; }
      const t = m[nk];
      if (this.b.some(b => b[0] === t[0] && b[1] === t[1])) { s.d = -s.d; return; } // 寶石擋路就折返
      s.k = nk; this.mo[i] = [t[0], t[1]]; ch = true;
      if (this.ph === 'play') {
        const p = this.pl.find(q => q.x === t[0] && q.y === t[1] && !(q.fz > now));
        if (p) this.hit(p);
      }
    });
    if (ch) this.publish();
  }

  isIdle(now) {
    const anyone = this.display || this.pl.some(p => p.ws);
    return !anyone && now - this.touched > 10 * 60 * 1000;
  }
}

module.exports = { Room, MAX_PLAYERS, cleanName };
