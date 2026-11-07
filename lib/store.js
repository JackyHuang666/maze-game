'use strict';
/* 排行榜儲存：記憶體 + 一個 JSON 檔（DATA_DIR/records.json）。
   Render 免費方案的磁碟在重啟或重新部署後會清空；要長期保存請掛載 Persistent Disk（見 README）。 */
const fs = require('fs');
const path = require('path');

const KEEP_PER_BOARD = 100; // 每個「地圖＋難度」最多保留的紀錄數

class Store {
  constructor(dir) {
    this.dir = dir;
    this.file = path.join(dir, 'records.json');
    this.recs = [];
    this.timer = null;
    this.warned = false;
    this.listeners = new Set();
    this._load();
  }

  _load() {
    try {
      const data = JSON.parse(fs.readFileSync(this.file, 'utf8'));
      if (Array.isArray(data)) this.recs = data.filter(Store.valid);
    } catch (e) { /* 第一次執行沒有檔案是正常的 */ }
  }

  static valid(r) {
    return r && typeof r.ms === 'number' && r.ms > 0 && Number.isInteger(r.th) && Number.isInteger(r.li) &&
      typeof r.name === 'string';
  }

  add(rec) {
    if (!Store.valid(rec)) return;
    this.recs.push(rec);
    // 每個 地圖＋難度 只留最快的 KEEP_PER_BOARD 筆
    const groups = new Map();
    for (const r of this.recs) {
      const k = r.th + '/' + r.li;
      if (!groups.has(k)) groups.set(k, []);
      groups.get(k).push(r);
    }
    this.recs = [];
    for (const arr of groups.values()) {
      arr.sort((a, b) => a.ms - b.ms);
      this.recs.push(...arr.slice(0, KEEP_PER_BOARD));
    }
    this._schedule();
    for (const fn of this.listeners) fn();
  }

  all() { return this.recs; }

  _schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => { this.timer = null; this.flush(); }, 1000);
    this.timer.unref();
  }

  flush() {
    try {
      fs.mkdirSync(this.dir, { recursive: true });
      const tmp = this.file + '.tmp';
      fs.writeFileSync(tmp, JSON.stringify(this.recs));
      fs.renameSync(tmp, this.file);
    } catch (e) {
      if (!this.warned) { this.warned = true; console.warn('[store] 無法寫入排行榜檔案，改為只存在記憶體：', e.message); }
    }
  }
}

module.exports = { Store };
