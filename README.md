# 🚀 RPJG BotCloud - Discord Bot 線上雲端託管平台

> **作者：R.P.J.G 開發部門**  
> 專為 Discord 機器人開發者、管理員與社群打造的高可用性、現代化全功能線上託管平台。

---

## 🌟 核心特色

- 🖥️ **極致深色 Discord 風格 UI**：科技感 Glassmorphism 儀表板，支援即時 Telemetry 運算資源監控（CPU、RAM、Ping、分片狀態）。
- ⚡ **即時雙向終端機 (Live Console)**：
  - WebSocket 低延遲即時串流輸出，支援 ANSI 色彩代碼渲染。
  - 支援在網頁直接向機器人程序下達互動指令 (`ping`, `status`, `stats`, `help` 等)。
  - 支援日誌一鍵下載為 `.log` 檔與控制台清除。
- 📁 **網頁在線 IDE 與檔案管理器 (Web IDE)**：
  - 視覺化檔案目錄樹瀏覽。
  - 在線修改 `bot.py` / `index.js` 等源代碼，支援快捷鍵 `Ctrl + S` 快速儲存。
- 🔐 **環境變數安全保險箱 (.env Vault)**：
  - 安全隔離配置 `DISCORD_BOT_TOKEN`, `BOT_PREFIX`, `CLIENT_ID` 等。
  - 支援金鑰隱藏/顯現切換與一鍵重載套用。
- 📦 **1-Click 一鍵範本市場 (Templates Center)**：
  - 🎵 **RPJG 音樂與串流 DJ 機器人** (Lavalink / YouTube / 高傳真音訊)
  - 🛡️ **Anti-Raid 伺服器守護管家** (防洗頻、防惡意邀請、成員管理)
  - 🤖 **AI 智慧問答助理** (Google Gemini AI 整合)
  - ⚡ **Python discord.py 核心起步範本**
  - 🚀 **Node.js 經典起步範本**
- 🛡️ **守護進程自動復原 (Crash Recovery)**：
  - 機器人若異常退出，平台自動在 3 秒內冷啟動恢復，確保 24/7 永不斷線。
- 🌐 **沙盒模擬與正式雙模式**：
  - 未填寫 Token 時自動進入互動沙盒演示模式，開箱即可立刻測試體驗！
  - 填入真實 Discord Token 時無縫連接 Discord Gateway！

---

## 🛠️ 技術架構

- **前端 (Frontend)**: React 18, Vite 6, TailwindCSS, Lucide Icons, ANSI-to-HTML
- **後端 (Backend)**: Node.js, Express, WebSocket (`ws`), `child_process` 沙盒進程隔離
- **開發者署名**: **R.P.J.G 開發部門 (R.P.J.G Core R&D)**

---

## 🚀 快速啟動指南

### 1. 啟動平台

在專案目錄下執行：

```powershell
# 方式一：一鍵啟動整合生產伺服器 (推薦)
node server/index.js

# 方式二：開發模式 (含 Vite 熱重載)
npm.cmd run dev
```

### 2. 開啟瀏覽器訪問
開啟瀏覽器前往：
- **http://localhost:3001** (後端整合主機) 或 **http://localhost:5173** (Vite 開發環境)

即可立即看到完整的 **RPJG BotCloud** 儀表板，並能立刻在控制台點擊「啟動進程」體驗真實的 Discord Bot 託管流程！

---

## 🏢 版權與致謝

- **開發部門**：R.P.J.G 開發部門
- **版本號**：v2.5.0-Enterprise
- **授權條款**：MIT License
