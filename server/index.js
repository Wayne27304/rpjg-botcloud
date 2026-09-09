/**
 * ================================================================
 * RPJG BotCloud - 主伺服器 (Express API + WebSocket Server)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';
import { botManager } from './botManager.js';
import { authManager, SUPER_ADMIN_EMAIL } from './authManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// 設定 Multer 記憶體暫存用於檔案上傳
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 } // 最高 50MB
});

const distPath = path.join(__dirname, '..', 'dist');
app.use(express.static(distPath));

const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const wsClients = new Set();
botManager.setWsClients(wsClients);

wss.on('connection', (ws) => {
  wsClients.add(ws);

  ws.send(JSON.stringify({
    type: 'connected',
    message: '成功連接至 RPJG BotCloud 即時日誌通道',
    author: 'R.P.J.G 開發部門',
    clusterNode: 'RPJG-TW-Node-01'
  }));

  ws.on('message', (message) => {
    try {
      const data = JSON.parse(message.toString());
      if (data.action === 'input' && data.botId && data.text) {
        botManager.sendInput(data.botId, data.text);
      } else if (data.action === 'subscribe_bot' && data.botId) {
        const logs = botManager.getLogs(data.botId);
        ws.send(JSON.stringify({
          type: 'history_logs',
          botId: data.botId,
          logs
        }));
      }
    } catch (e) {
      console.error('WebSocket 訊息解析失敗:', e.message);
    }
  });

  ws.on('close', () => {
    wsClients.delete(ws);
  });
});

/* ================================================================
   認證中介層 (Auth Middleware)
   ================================================================ */
const requireAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: '未授權存取，請先登入' });
  }

  const token = authHeader.split(' ')[1];
  const user = authManager.verifyToken(token);
  if (!user) {
    return res.status(401).json({ success: false, message: '登入已過期或無效，請重新登入' });
  }

  req.user = user;
  next();
};

const requireSuperAdmin = (req, res, next) => {
  if (!req.user || req.user.email.toLowerCase() !== SUPER_ADMIN_EMAIL.toLowerCase()) {
    return res.status(403).json({ success: false, message: '此操作僅限最高管理員 ryanryan311311@gmail.com 執行' });
  }
  next();
};

const checkBotAccess = (req, res, next) => {
  const botId = req.params.id;
  const bot = botManager.getBot(botId);
  if (!bot) {
    return res.status(404).json({ success: false, message: '找不到此機器人' });
  }
  const isSuperAdmin = req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isOwner = bot.ownerEmail && bot.ownerEmail.toLowerCase() === req.user.email.toLowerCase();
  if (!isSuperAdmin && !isOwner) {
    return res.status(403).json({ success: false, message: '權限不足：您只能操作與檢視自己託管的機器人' });
  }
  req.targetBot = bot;
  next();
};

/* ================================================================
   認證與授權管理 API
   ================================================================ */

// 登入
app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, message: '請輸入 Email 與密碼' });
  }
  const result = authManager.login(email, password);
  res.json(result);
});

// 取得當前使用者身分
app.get('/api/auth/me', requireAuth, (req, res) => {
  res.json({
    success: true,
    user: {
      email: req.user.email,
      role: req.user.role,
      displayName: req.user.displayName,
      expiresAt: req.user.expiresAt,
      maxBots: req.user.maxBots || 5,
      isSuperAdmin: req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
    }
  });
});

// 管理員：取得所有授權的使用者清單
app.get('/api/auth/users', requireAuth, requireSuperAdmin, (req, res) => {
  const users = authManager.listUsers();
  res.json({ success: true, users });
});

// 管理員：授權新 Gmail 與期限
app.post('/api/auth/authorize', requireAuth, requireSuperAdmin, (req, res) => {
  const { email, password, durationType, customDays, maxBots, note, displayName } = req.body;
  if (!email) return res.status(400).json({ success: false, message: '缺少 Email' });

  const result = authManager.authorizeUser({
    email,
    password,
    durationType,
    customDays,
    maxBots,
    note,
    displayName
  });
  res.json(result);
});

// 管理員：延長授權天數
app.post('/api/auth/users/:email/extend', requireAuth, requireSuperAdmin, (req, res) => {
  const { days } = req.body;
  const result = authManager.extendUser(req.params.email, days);
  res.json(result);
});

// 管理員：凍結 / 解除凍結
app.post('/api/auth/users/:email/status', requireAuth, requireSuperAdmin, (req, res) => {
  const result = authManager.toggleUserStatus(req.params.email);
  res.json(result);
});

// 管理員：刪除授權帳號
app.delete('/api/auth/users/:email', requireAuth, requireSuperAdmin, (req, res) => {
  const result = authManager.deleteUser(req.params.email);
  res.json(result);
});

/* ================================================================
   系統資訊 API
   ================================================================ */

app.get('/api/system/stats', (req, res) => {
  const cpus = os.cpus();
  const totalMem = (os.totalmem() / 1024 / 1024 / 1024).toFixed(1);
  const freeMem = (os.freemem() / 1024 / 1024 / 1024).toFixed(1);

  res.json({
    platformName: 'RPJG BotCloud (Discord Bot 線上雲端託管平台)',
    author: 'R.P.J.G 開發部門',
    adminEmail: SUPER_ADMIN_EMAIL,
    department: '研發核心團隊 (R.P.J.G Core R&D)',
    version: '3.0.0-Enterprise',
    status: 'OPTIMAL',
    uptimeSeconds: Math.floor(process.uptime()),
    nodes: [
      { id: 'tw-01', name: 'RPJG-TW-Node-01 [台灣台北]', latency: 14, status: 'Online', load: '18%' },
      { id: 'us-02', name: 'RPJG-US-Node-02 [北美奧勒岡]', latency: 128, status: 'Online', load: '32%' },
      { id: 'jp-03', name: 'RPJG-JP-Node-03 [日本東京]', latency: 38, status: 'Standby', load: '9%' }
    ],
    system: {
      os: `${os.type()} ${os.release()} (${os.arch()})`,
      nodeVersion: process.version,
      cpuModel: cpus[0]?.model || 'Cloud Virtual CPU @ 3.4GHz',
      cpuCores: cpus.length,
      totalRamGB: totalMem,
      freeRamGB: freeMem
    }
  });
});

/* ================================================================
   機器人管理 API (需登入驗證)
   ================================================================ */

// 取得機器人清單 (按身分隔離；管理員可透過 ?all=true 切換全域所有機器人視角)
app.get('/api/bots', requireAuth, (req, res) => {
  const isSuperAdmin = req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const showAll = isSuperAdmin && req.query.all === 'true';
  const bots = botManager.listBots(req.user.email, showAll);
  res.json({ success: true, bots, isGlobalView: showAll });
});

// 自訂上傳檔案建立機器人 (支援 ZIP 檔與多檔案)
app.post('/api/bots/upload', requireAuth, upload.fields([
  { name: 'zip', maxCount: 1 },
  { name: 'files', maxCount: 20 }
]), (req, res) => {
  try {
    const { name, type, description, mainFile } = req.body;
    const zipFile = req.files?.zip ? req.files.zip[0] : null;
    const uploadedFiles = req.files?.files || [];

    const newBot = botManager.createBotFromUpload({
      name,
      type,
      description,
      mainFile,
      ownerEmail: req.user.email,
      zipFile,
      uploadedFiles
    });

    res.json({ success: true, bot: newBot });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 單一檔案上傳至已存在的機器人目錄
app.post('/api/bots/:id/files/upload', requireAuth, checkBotAccess, upload.single('file'), (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ success: false, message: '未選取檔案' });

    botManager.uploadSingleFile(req.params.id, req.file.originalname, req.file.buffer);
    res.json({ success: true, message: `檔案 ${req.file.originalname} 上傳成功` });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/bots/:id', requireAuth, checkBotAccess, (req, res) => {
  res.json({ success: true, bot: req.targetBot });
});

app.delete('/api/bots/:id', requireAuth, checkBotAccess, (req, res) => {
  const ok = botManager.deleteBot(req.params.id);
  res.json({ success: ok });
});

app.post('/api/bots/:id/start', requireAuth, checkBotAccess, (req, res) => {
  const result = botManager.startBot(req.params.id);
  res.json(result);
});

app.post('/api/bots/:id/stop', requireAuth, checkBotAccess, (req, res) => {
  const result = botManager.stopBot(req.params.id);
  res.json(result);
});

app.post('/api/bots/:id/restart', requireAuth, checkBotAccess, async (req, res) => {
  const result = await botManager.restartBot(req.params.id);
  res.json(result);
});

// 停用託管
app.post('/api/bots/:id/suspend', requireAuth, checkBotAccess, (req, res) => {
  const result = botManager.suspendHosting(req.params.id);
  res.json(result);
});

// 恢復/啟用託管
app.post('/api/bots/:id/resume', requireAuth, checkBotAccess, (req, res) => {
  const result = botManager.resumeHosting(req.params.id);
  res.json(result);
});

app.get('/api/bots/:id/logs', requireAuth, checkBotAccess, (req, res) => {
  const logs = botManager.getLogs(req.params.id);
  res.json({ success: true, logs });
});

app.delete('/api/bots/:id/logs', requireAuth, checkBotAccess, (req, res) => {
  botManager.clearLogs(req.params.id);
  res.json({ success: true });
});

app.post('/api/bots/:id/stdin', requireAuth, checkBotAccess, (req, res) => {
  const { text } = req.body;
  if (!text) return res.status(400).json({ success: false, message: '缺少指令內容' });
  const result = botManager.sendInput(req.params.id, text);
  res.json(result);
});

app.get('/api/bots/:id/files', requireAuth, checkBotAccess, (req, res) => {
  try {
    const files = botManager.listFiles(req.params.id);
    res.json({ success: true, files });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/bots/:id/files/content', requireAuth, checkBotAccess, (req, res) => {
  try {
    const { path: filePath } = req.query;
    if (!filePath) return res.status(400).json({ success: false, message: '缺少檔案路徑' });
    const content = botManager.readFile(req.params.id, filePath);
    res.json({ success: true, content });
  } catch (err) {
    res.status(404).json({ success: false, message: err.message });
  }
});

app.post('/api/bots/:id/files/content', requireAuth, checkBotAccess, (req, res) => {
  try {
    const { path: filePath, content } = req.body;
    if (!filePath || content === undefined) {
      return res.status(400).json({ success: false, message: '缺少路徑或內容' });
    }
    botManager.saveFile(req.params.id, filePath, content);
    res.json({ success: true, message: '檔案儲存成功' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('*', (req, res) => {
  const indexHtml = path.join(distPath, 'index.html');
  if (path.resolve(indexHtml)) {
    res.sendFile(indexHtml, (err) => {
      if (err) {
        res.send('RPJG BotCloud API Server is running.');
      }
    });
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`\n=============================================================`);
  console.log(`  🚀 RPJG BotCloud - Discord Bot 線上雲端託管平台已啟動 (v3.0)`);
  console.log(`  🏢 作者：R.P.J.G 開發部門`);
  console.log(`  👑 最高管理員: ${SUPER_ADMIN_EMAIL}`);
  console.log(`  🌐 伺服器位址: http://0.0.0.0:${PORT}`);
  console.log(`  📡 WebSocket 連線: ws://0.0.0.0:${PORT}/ws`);
  console.log(`=============================================================\n`);
});
