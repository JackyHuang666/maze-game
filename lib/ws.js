'use strict';
/* 極簡 WebSocket 伺服器（RFC 6455），只依賴 Node 內建模組，不需要 npm install。
   只支援文字訊息；會處理分片、ping/pong、關閉握手與心跳。 */
const crypto = require('crypto');
const { EventEmitter } = require('events');

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';

class Conn extends EventEmitter {
  constructor(socket, maxPayload) {
    super();
    this.socket = socket;
    this.maxPayload = maxPayload;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.fragLen = 0;
    this.closed = false;
    this.alive = true;
    socket.on('data', (d) => this._onData(d));
    socket.on('close', () => this._finish());
    socket.on('error', () => this._finish());
    socket.on('end', () => this._finish());
  }

  get open() { return !this.closed && this.socket.writable; }

  _finish() {
    if (this.closed) return;
    this.closed = true;
    try { this.socket.destroy(); } catch (e) { /* ignore */ }
    this.emit('close');
  }

  _write(opcode, payload) {
    if (!this.open) return;
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) { head = Buffer.alloc(4); head[0] = 0x80 | opcode; head[1] = 126; head.writeUInt16BE(len, 2); }
    else { head = Buffer.alloc(10); head[0] = 0x80 | opcode; head[1] = 127; head.writeBigUInt64BE(BigInt(len), 2); }
    try { this.socket.write(Buffer.concat([head, payload])); } catch (e) { this._finish(); }
  }

  send(text) { this._write(0x1, Buffer.from(text, 'utf8')); }
  ping() { this._write(0x9, Buffer.alloc(0)); }

  close(code = 1000) {
    if (this.closed) return;
    const p = Buffer.alloc(2); p.writeUInt16BE(code, 0);
    this._write(0x8, p);
    setTimeout(() => this._finish(), 200).unref();
  }

  terminate() { this._finish(); }

  _fail(code) { this.close(code); }

  _onData(chunk) {
    this.alive = true;
    this.buf = this.buf.length ? Buffer.concat([this.buf, chunk]) : chunk;
    for (;;) {
      const b = this.buf;
      if (b.length < 2) return;
      const fin = (b[0] & 0x80) !== 0;
      const opcode = b[0] & 0x0f;
      const masked = (b[1] & 0x80) !== 0;
      let len = b[1] & 0x7f;
      let off = 2;
      if (len === 126) {
        if (b.length < 4) return;
        len = b.readUInt16BE(2); off = 4;
      } else if (len === 127) {
        if (b.length < 10) return;
        const big = b.readBigUInt64BE(2);
        if (big > BigInt(this.maxPayload)) return this._fail(1009);
        len = Number(big); off = 10;
      }
      if (!masked) return this._fail(1002); // 客戶端的訊框一定要有遮罩
      if (len > this.maxPayload) return this._fail(1009);
      if (b.length < off + 4 + len) return;
      const mask = b.subarray(off, off + 4);
      const payload = Buffer.from(b.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < payload.length; i++) payload[i] ^= mask[i & 3];
      this.buf = b.subarray(off + 4 + len);

      if (opcode >= 0x8) { // 控制訊框
        if (!fin || len > 125) return this._fail(1002);
        if (opcode === 0x8) { this.close(1000); return; }
        if (opcode === 0x9) this._write(0xA, payload);
        continue; // pong 只用來確認連線還活著
      }
      if (opcode === 0x2) return this._fail(1003); // 不收二進位
      if (opcode === 0x1 || opcode === 0x0) {
        if (opcode === 0x1 && this.frags.length) return this._fail(1002);
        if (opcode === 0x0 && !this.frags.length) return this._fail(1002);
        this.frags.push(payload);
        this.fragLen += payload.length;
        if (this.fragLen > this.maxPayload) return this._fail(1009);
        if (fin) {
          const text = Buffer.concat(this.frags).toString('utf8');
          this.frags = []; this.fragLen = 0;
          this.emit('message', text);
        }
      } else {
        return this._fail(1002);
      }
    }
  }
}

/** 把 WebSocket 掛到既有的 http.Server 上；path 以外的升級請求會被拒絕。 */
function attach(server, { path = '/ws', maxPayload = 4096, onConnection, verifyClient } = {}) {
  const conns = new Set();
  server.on('upgrade', (req, socket) => {
    const url = (req.url || '').split('?')[0];
    const key = req.headers['sec-websocket-key'];
    if (url !== path || (req.headers.upgrade || '').toLowerCase() !== 'websocket' || !key ||
        (verifyClient && !verifyClient(req))) {
      socket.write('HTTP/1.1 400 Bad Request\r\nConnection: close\r\n\r\n');
      socket.destroy();
      return;
    }
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write('HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
      'Sec-WebSocket-Accept: ' + accept + '\r\n\r\n');
    socket.setNoDelay(true);
    socket.setTimeout(0);
    const ws = new Conn(socket, maxPayload);
    conns.add(ws);
    ws.on('close', () => conns.delete(ws));
    onConnection(ws, req);
  });
  // 心跳：Render 等代理會切斷閒置連線，所以定期 ping；兩輪沒回應就斷線
  const timer = setInterval(() => {
    for (const ws of conns) {
      if (!ws.alive) { ws.terminate(); continue; }
      ws.alive = false;
      ws.ping();
    }
  }, 25000);
  timer.unref();
  return { conns, close() { clearInterval(timer); for (const ws of conns) ws.terminate(); } };
}

module.exports = { attach };
