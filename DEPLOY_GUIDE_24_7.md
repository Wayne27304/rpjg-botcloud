# RPJG BotCloud - 24/7 全年無休「關機在線」雲端部署指南

> **作者：R.P.J.G 開發部門**  
> 專案名稱：RPJG BotCloud (Discord Bot 線上託管平台)

---

## 💡 核心原理說明：為什麼電腦關機後需要雲端伺服器？

當您關閉家用電腦或筆電時，硬體斷電，本地的 Node.js 與 Python 程序必然會停止運作。  
若要實現**「個人電腦關機後，託管網站與所有 Discord Bot 依然 24 小時在線上正常運作」**，就必須將本專案部署至**雲端伺服器 (Cloud Host / VPS / 容器託管平台)**。

我們已為您預先配置好了標準化 **`Dockerfile`**、**`docker-compose.yml`** 與 **`render.yaml`**，支援以下 3 種部署方案：

---

## 🚀 方案一：使用免費/免維護雲端平台（最推薦、新手友善）

適合不想購買伺服器、希望免費或低成本 1-Click 快速上線的使用者。

### 推薦平台：[Render.com](https://render.com) 或 [Railway.app](https://railway.app)

1. **將專案推送到 GitHub**：
   - 建立一個 GitHub 儲存庫（私有 Private 亦可）。
   - 將本資料夾內的檔案推送至 GitHub。
2. **登入 Render 或 Railway**：
   - 註冊並點擊 **「New Web Service」**。
   - 授權並選擇您剛才建立的 GitHub 專案。
3. **自動建置與上線**：
   - 平台會自動偵測專案中的 `Dockerfile`。
   - 自動完成 Node.js 20、Python 3 環境安裝與前端編譯。
   - 啟動成功後，平台會配發一組免費專屬 HTTPS 網址（例如 `https://rpjg-botcloud.onrender.com`）。
4. **效果**：
   - **隨時可以關閉您的個人電腦！**
   - 雲端伺服器全年無休 24/7 運行，世界各地皆可存取您的網站並穩定託管 Discord Bot。

---

## 🐧 方案二：自建雲端 Linux VPS 伺服器（效能最高、專業首選）

適合希望完全掌控伺服器資源，或有大量 Discord Bot 託管需求。

推薦雲端服務商：DigitalOcean / Linode / Vultr / AWS Lightsail / 阿里雲 / 騰訊雲（每月約 $3 ~ $5 美元）。

### 部署步驟（僅需 2 步驟）：

1. **在 VPS 上安裝 Docker 與 Docker Compose**：
   ```bash
   curl -fsSL https://get.docker.com | sh
   ```
2. **複製本專案至 VPS 並一鍵背景啟動**：
   ```bash
   cd rpjg-dcbot-cloud
   docker compose up -d
   ```
3. **完成！**
   - 容器設有 `restart: always`，即便 VPS 系統重啟也會自動恢復運行。
   - 透過瀏覽器輸入 `http://您的VPS_IP:3001` 即可直接進入 RPJG BotCloud！

---

## 🏠 方案三：家中閒置迷你電腦 / 樹莓派（零雲端月租）

若您身邊有不常關機的舊筆電、Mini PC 或樹莓派：
1. 在該台裝置上啟動本專案（`node server/index.js` 或 Docker）。
2. 安裝免費的 **Cloudflare Tunnel**（雲端通道）：
   ```bash
   cloudflared tunnel --url http://localhost:3001
   ```
3. Cloudflare 會立即給予一組公網專屬 HTTPS 網址，免去繁瑣的路由器 Port Forwarding 設定，即可對外提供公網服務。
