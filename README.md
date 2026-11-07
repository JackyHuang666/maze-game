# 迷宮尋寶

1–6 人手機連線的冥想益智迷宮遊戲。大螢幕顯示整張地圖與排行榜，玩家用手機方向鍵移動，把彩色寶石推（或抓）進同色寶箱，並避開巡邏的小怪獸。

- 純 Node.js，**零外部依賴**（不需要 `npm install` 下載任何套件），需要 Node 18 以上
- 伺服器端判定遊戲規則（防作弊）、WebSocket 即時連線、斷線自動重連
- 大螢幕顯示 QR Code，手機掃描即可加入

## 本機執行

```bash
npm start
# 開啟 http://localhost:3000 ，按「開房間（大螢幕）」
# 手機請連同一個 Wi-Fi，用 QR Code 或 http://你的電腦IP:3000 加入
npm test   # 冒煙測試
```

## 上傳到 GitHub

```bash
cd maze-game
git init
git add .
git commit -m "迷宮尋寶"
git branch -M main
git remote add origin https://github.com/你的帳號/maze-treasure.git
git push -u origin main
```

（先在 GitHub 網站建立一個空的 repository，不要勾選 README。）

## 部署到 Render

1. 登入 [render.com](https://render.com)，連結你的 GitHub 帳號。
2. **New → Blueprint**，選擇這個 repository，Render 會讀取 `render.yaml` 自動設定。
   （或選 **New → Web Service**：Runtime 選 Node，Build Command 填 `npm install`，Start Command 填 `npm start`，Health Check Path 填 `/healthz`。）
3. 等待部署完成，取得 `https://xxx.onrender.com`。用電腦或平板開啟並按「開房間」，手機掃 QR Code 加入。
4. Render 提供 HTTPS，前端會自動使用 `wss://`，不需要額外設定。

## 注意事項

- **免費方案閒置約 15 分鐘會休眠**，第一次連線需等候約 30–60 秒喚醒；活動前先開一次網址。
- **免費方案的磁碟是暫時的**，服務重啟或重新部署後排行榜會清空。要永久保存請改付費方案、加掛 Persistent Disk，並設定環境變數 `DATA_DIR` 指向掛載路徑（見 `render.yaml` 註解）。
- 遊戲房間存在記憶體中，**只能跑單一實例**（不要開啟多個 instance 水平擴充）。
- 服務重啟時進行中的房間會消失，玩家需重新開房。

## 環境變數

| 名稱 | 預設 | 說明 |
| --- | --- | --- |
| `PORT` | 3000 | Render 會自動指定 |
| `DATA_DIR` | `./data` | 排行榜 `records.json` 存放位置 |
| `MAX_ROOMS` | 300 | 同時房間上限 |
| `BREATH_MS` | 8000 | 開局前的呼吸倒數毫秒（測試用） |

## 專案結構

```
server.js        HTTP 靜態網站 + WebSocket 房間管理
lib/game.js      遊戲規則（迷宮產生、推／抓、怪獸），伺服器與瀏覽器共用
lib/rooms.js     房間狀態與遊戲迴圈
lib/ws.js        內建 WebSocket 實作
lib/store.js     排行榜（JSON 檔）
public/          前端（index.html、css、js）
test/smoke.js    冒煙測試
render.yaml      Render 設定
```
