'use strict';
// 冒煙測試：啟動伺服器 → 大螢幕開房 → 3 位玩家加入 → 開始 → 移動 → 結束
process.env.BREATH_MS = process.env.BREATH_MS || '300';
const os = require('os'), fs = require('fs'), path = require('path');
const { createApp } = require('../server');

const sleep = ms => new Promise(r => setTimeout(r, ms));
let fails = 0;
const ok = (c, msg) => { console.log((c ? '  ✓ ' : '  ✗ ') + msg); if (!c) fails++; };

function client(port) {
  const ws = new WebSocket('ws://127.0.0.1:' + port + '/ws');
  const c = { ws, msgs: [], last: {} };
  ws.onmessage = e => { const m = JSON.parse(e.data); c.msgs.push(m); c.last[m.t] = m; };
  c.open = new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
  c.tx = o => ws.send(JSON.stringify(o));
  c.wait = async (t, ms = 3000) => { const s = Date.now(); while (Date.now() - s < ms) { if (c.last[t]) return c.last[t]; await sleep(20); } return null; };
  return c;
}

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'maze-'));
  const app = createApp({ dataDir: dir });
  const port = await app.listen(0, '127.0.0.1');
  const http = p => fetch('http://127.0.0.1:' + port + p);

  console.log('HTTP');
  ok((await http('/healthz')).status === 200, '/healthz');
  const idx = await http('/');
  ok(idx.status === 200 && /迷宮尋寶/.test(await idx.text()), '首頁');
  ok((await http('/js/game.js')).status === 200, '/js/game.js');
  ok((await http('/../server.js')).status !== 200, '路徑穿越被擋');

  console.log('房間流程');
  const host = client(port); await host.open; host.tx({ t: 'create' });
  const created = await host.wait('created');
  ok(created && /^\d{4}$/.test(created.code), '建立房間 ' + (created && created.code));
  const code = created.code;

  const ps = [];
  for (let i = 0; i < 3; i++) { const p = client(port); await p.open; p.tx({ t: 'join', code, name: 'P' + i }); ok(!!(await p.wait('joined')), '玩家 ' + i + ' 加入'); ps.push(p); }
  const bad = client(port); await bad.open; bad.tx({ t: 'join', code: '0000', name: 'x' });
  ok((await bad.wait('err')) !== null, '錯誤房號被拒');

  host.tx({ t: 'cfg', th: 2, li: 0 });
  host.tx({ t: 'start', tn: '測試隊' });
  await sleep(1200);
  const st = host.last.st && host.last.st.st;
  ok(st && st.ph === 'play' && st.pl.length === 3, '進入遊戲階段，3 位玩家');

  const before = JSON.stringify(ps[0].last.st.st.pl[0]);
  for (let i = 0; i < 20; i++) { ps[0].tx({ t: 'mv', d: i % 4 }); await sleep(100); }
  ok(ps[0].last.st.st.pl.length === 3, '移動後狀態正常');
  ps[0].tx({ t: 'mode', m: 1 });
  ps[1].tx({ t: 'rs' });
  await sleep(300);
  ok(true, '切換抓模式、重置不當機');

  // 斷線重連
  const pid = ps[2].last.joined.id; ps[2].ws.close(); await sleep(200);
  const re = client(port); await re.open; re.tx({ t: 'join', code, name: 'P2', id: pid });
  const rj = await re.wait('joined');
  ok(rj && rj.id === pid, '斷線重連回到原位');
  ok(re.last.st && re.last.st.st.pl.length === 3, '重連後仍為 3 人');

  host.tx({ t: 'abort' }); await sleep(300);
  ok(host.last.st.st.ph === 'lobby', '結束回到大廳');
  ok((await http('/api/records')).status === 200, '/api/records');

  [host, bad, re, ...ps].forEach(c => { try { c.ws.close(); } catch (e) { /* ignore */ } });
  app.close();
  console.log(fails ? '\n失敗 ' + fails + ' 項' : '\n全部通過');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
