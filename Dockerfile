# ================================================================
# RPJG BotCloud - 雲端 24/7 獨立運行 Dockerfile
# 作者：R.P.J.G 開發部門
# ================================================================

FROM node:20-bookworm-slim

# 安裝 Python 3 與相關執行庫，確保可同時託管 Node.js 與 Python Discord Bot
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    python-is-python3 \
    procps \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 複製相依性定義檔並安裝
COPY package*.json ./
RUN npm install

# 複製專案原始碼
COPY . .

# 打包編譯前端 Vite 資產
RUN npm run build

# 建立持久化儲存目錄
RUN mkdir -p /app/server/bots /app/server/data

# 暴露通訊埠
EXPOSE 3001

# 環境變數
ENV PORT=3001
ENV NODE_ENV=production

# 啟動平台主程序
CMD ["node", "server/index.js"]
