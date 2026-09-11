/**
 * ================================================================
 * RPJG BotCloud - 主伺服器 (Express API + WebSocket Server)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import dns from 'dns';
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}
import express from 'express';
import cors from 'cors';
import multer from 'multer';
import { WebSocketServer } from 'ws';
import http from 'http';
import path from 'path';
import os from 'os';
import net from 'net';
import { fileURLToPath } from 'url';
import { botManager } from './botManager.js';
import { authManager, SUPER_ADMIN_EMAIL } from './authManager.js';
import { auditLogger } from './auditLogger.js';
import { mailerService } from './mailer.js';

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

const requireResellerOrAdmin = (req, res, next) => {
  if (
    req.user &&
    (req.user.role === 'RESELLER' ||
     req.user.role === 'SUPER_ADMIN' ||
     req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase())
  ) {
    return next();
  }
  return res.status(403).json({ success: false, message: '權限不足：僅代理經銷商或最高管理員可操作' });
};

const checkBotAccess = (req, res, next) => {
  const botId = req.params.id;
  const bot = botManager.getBot(botId);
  if (!bot) {
    return res.status(404).json({ success: false, message: '找不到此機器人' });
  }
  const isSuperAdmin = req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const isOwner = bot.ownerEmail && bot.ownerEmail.toLowerCase() === req.user.email.toLowerCase();

  let isResellerParent = false;
  if (req.user.role === 'RESELLER' && bot.ownerEmail) {
    const owner = authManager.getUser(bot.ownerEmail);
    if (owner && (owner.parentResellerEmail || '').toLowerCase() === req.user.email.toLowerCase()) {
      isResellerParent = true;
    }
  }

  if (!isSuperAdmin && !isOwner && !isResellerParent) {
    return res.status(403).json({ success: false, message: '權限不足：您只能操作與檢視自己或旗下客戶託管的機器人' });
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

// 取得當前使用者身分 (包含空間配額與使用量)
app.get('/api/auth/me', requireAuth, (req, res) => {
  const usage = botManager.getUserStorageUsage(req.user.email);
  const maxStorageMB = req.user.maxStorageMB || (req.user.role === 'SUPER_ADMIN' ? 10240 : 100);

  res.json({
    success: true,
    user: {
      email: req.user.email,
      role: req.user.role || 'USER',
      displayName: req.user.displayName,
      expiresAt: req.user.expiresAt,
      maxBots: req.user.maxBots || 5,
      maxStorageMB,
      usedStorageMB: usage.totalMB,
      remainingStorageMB: Math.max(0, +(maxStorageMB - usage.totalMB).toFixed(2)),
      storageUsagePercent: maxStorageMB > 0 ? +((usage.totalMB / maxStorageMB) * 100).toFixed(1) : 0,
      isSuperAdmin: req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase(),
      plainPasswordHint: req.user.plainPasswordHint || '',
      resellerQuotaMB: req.user.resellerQuotaMB || 0,
      resellerMaxBots: req.user.resellerMaxBots || 0,
      resellerMaxUsers: req.user.resellerMaxUsers || 0,
      parentResellerEmail: req.user.parentResellerEmail || null
    }
  });
});

// 管理員：取得所有授權的使用者清單 (豐富空間用量指標)
app.get('/api/auth/users', requireAuth, requireSuperAdmin, (req, res) => {
  const users = authManager.listUsers();
  const enriched = users.map(u => {
    const usage = botManager.getUserStorageUsage(u.email);
    const maxStorageMB = u.maxStorageMB || (u.isSuperAdmin ? 10240 : 100);
    return {
      ...u,
      maxStorageMB,
      usedStorageBytes: usage.totalBytes,
      usedStorageMB: usage.totalMB,
      usedStorageFormatted: usage.formatted,
      remainingStorageMB: Math.max(0, +(maxStorageMB - usage.totalMB).toFixed(2)),
      storageUsagePercent: maxStorageMB > 0 ? +((usage.totalMB / maxStorageMB) * 100).toFixed(1) : 0,
      botCount: usage.botCount
    };
  });
  res.json({ success: true, users: enriched });
});

// 管理員：授權新 Gmail 與期限 (支援派發儲存空間與經銷代理商權限)
app.post('/api/auth/authorize', requireAuth, requireSuperAdmin, (req, res) => {
  const {
    email,
    password,
    durationType,
    customDays,
    maxBots,
    maxStorageMB,
    note,
    displayName,
    role,
    resellerQuotaMB,
    resellerMaxBots,
    resellerMaxUsers
  } = req.body;

  if (!email) return res.status(400).json({ success: false, message: '缺少 Email' });

  const result = authManager.authorizeUser({
    email,
    password,
    durationType,
    customDays,
    maxBots,
    maxStorageMB,
    note,
    displayName,
    role: role || 'USER',
    resellerQuotaMB,
    resellerMaxBots,
    resellerMaxUsers,
    creatorUser: req.user
  });
  res.json(result);
});

// 經銷代理商：獲取代理配額總盤與旗下客戶清單
app.get('/api/reseller/overview', requireAuth, requireResellerOrAdmin, (req, res) => {
  const isSuperAdmin = req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const targetEmail = isSuperAdmin && req.query.email ? req.query.email : req.user.email;
  const overview = authManager.getResellerOverview(targetEmail);
  res.json({ success: true, ...overview });
});

// 經銷代理商：派發建立/更新客戶帳號 (自動扣除代理商可用總配額)
app.post('/api/reseller/authorize', requireAuth, requireResellerOrAdmin, (req, res) => {
  const { email, password, durationType, customDays, maxBots, maxStorageMB, note, displayName } = req.body;
  if (!email) return res.status(400).json({ success: false, message: '缺少 Email' });

  const result = authManager.authorizeUser({
    email,
    password,
    durationType,
    customDays,
    maxBots,
    maxStorageMB,
    note,
    displayName,
    role: 'USER',
    creatorUser: req.user
  });
  res.json(result);
});

// 經銷代理商：移除自己旗下的客戶帳號
app.delete('/api/reseller/users/:email', requireAuth, requireResellerOrAdmin, (req, res) => {
  const result = authManager.deleteUser(req.params.email, req.user);
  res.json(result);
});

// 全域操作審計日誌 (最高主管可查全部，經銷代理商可查旗下)
app.get('/api/admin/audit-logs', requireAuth, (req, res) => {
  const isSuperAdmin = req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  if (isSuperAdmin) {
    const logs = auditLogger.query(req.query);
    return res.json({ success: true, logs });
  } else if (req.user.role === 'RESELLER') {
    const overview = authManager.getResellerOverview(req.user.email);
    const subEmails = new Set([req.user.email.toLowerCase(), ...(overview.subUsers || []).map(u => u.email.toLowerCase())]);
    let logs = auditLogger.query({ limit: 300 });
    logs = logs.filter(l => subEmails.has(l.actor) || subEmails.has((l.target || '').toLowerCase()));
    return res.json({ success: true, logs });
  }
  return res.status(403).json({ success: false, message: '權限不足' });
});

// 診斷端點：檢測雲端外網連線狀況 (測試 SMTP/HTTPS 埠口是否被阻擋)
app.get('/api/debug/net-test', async (req, res) => {
  const targets = [
    { host: 'smtp.gmail.com', port: 465, family: 4 },
    { host: 'smtp.gmail.com', port: 587, family: 4 },
    { host: 'smtp.gmail.com', port: 465 },
    { host: 'www.google.com', port: 443 }
  ];

  const results = {};
  for (const t of targets) {
    const key = `${t.host}:${t.port}${t.family ? ' (IPv' + t.family + ')' : ''}`;
    try {
      const outcome = await new Promise((resolve) => {
        const s = net.createConnection({ host: t.host, port: t.port, family: t.family, timeout: 5000 }, () => {
          s.destroy();
          resolve('CONNECTED_SUCCESS');
        });
        s.on('timeout', () => {
          s.destroy();
          resolve('TIMEOUT (可能被雲端防火牆阻擋)');
        });
        s.on('error', (err) => {
          resolve(`ERROR: ${err.message}`);
        });
      });
      results[key] = outcome;
    } catch (e) {
      results[key] = e.message;
    }
  }

  res.json({
    deployTime: new Date().toISOString(),
    version: '890685f-net-check',
    results
  });
});

// 管理員：測試 Gmail 發信連線 (支援 GAS HTTPS 轉發與 Direct SMTP)
app.post('/api/admin/test-email', requireAuth, requireSuperAdmin, async (req, res) => {
  try {
    const { targetEmail } = req.body;
    const result = await mailerService.testConnection(targetEmail || req.user.email);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: `發信異常: ${err.message}` });
  }
});

// 管理員：取得郵件發送設定與引擎狀態
app.get('/api/admin/mailer-settings', requireAuth, requireSuperAdmin, (req, res) => {
  res.json({
    success: true,
    ...mailerService.getEngineStatus()
  });
});

// 管理員：儲存 Google Apps Script HTTPS 轉發網址
app.post('/api/admin/mailer-settings', requireAuth, requireSuperAdmin, (req, res) => {
  const { relayUrl } = req.body;
  const saved = mailerService.setRelayUrl(relayUrl);
  res.json({
    success: true,
    message: saved ? '已成功儲存 Google Apps Script 轉發網址！' : '已重置為原生 SMTP 直連模式',
    relayUrl: saved
  });
});

// 管理員：調配特定使用者的空間配額與機器人數量
app.post('/api/auth/users/:email/quota', requireAuth, requireSuperAdmin, (req, res) => {
  const { maxStorageMB, maxBots } = req.body;
  const result = authManager.updateUserQuota(req.params.email, { maxStorageMB, maxBots });
  res.json(result);
});

// 管理員：取得主機空間剩餘量與全域派發總覽
app.get('/api/admin/storage-overview', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const overview = botManager.getSystemStorageOverview();
    res.json({ success: true, ...overview });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// 管理員：延長授權天數
app.post('/api/auth/users/:email/extend', requireAuth, requireSuperAdmin, (req, res) => {
  const { days } = req.body;
  const result = authManager.extendUser(req.params.email, days);
  res.json(result);
});

// 管理員：重新簽發或重設特定使用者的專屬密鑰
app.post('/api/auth/users/:email/reset-key', requireAuth, requireSuperAdmin, (req, res) => {
  const { newKey } = req.body || {};
  const result = authManager.resetUserKey(req.params.email, newKey);
  res.json(result);
});

// 管理員：凍結 / 解除凍結
app.post('/api/auth/users/:email/status', requireAuth, requireSuperAdmin, (req, res) => {
  const result = authManager.toggleUserStatus(req.params.email);
  res.json(result);
});

// 管理員：刪除授權帳號
app.delete('/api/auth/users/:email', requireAuth, requireSuperAdmin, (req, res) => {
  const result = authManager.deleteUser(req.params.email, req.user);
  res.json(result);
});

// 管理員：取得持久化存儲狀態 (Supabase / Render Env / Local)
app.get('/api/auth/storage-status', requireAuth, requireSuperAdmin, (req, res) => {
  res.json({ success: true, ...authManager.getStorageStatus() });
});

// 管理員：匯出所有授權備份 (JSON)
app.get('/api/auth/export', requireAuth, requireSuperAdmin, (req, res) => {
  const backup = authManager.exportUsers();
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Content-Disposition', 'attachment; filename="rpjg_users_backup.json"');
  res.json(backup);
});

// 管理員：匯入還原授權備份 (JSON)
app.post('/api/auth/import', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const rawList = req.body.users || (Array.isArray(req.body) ? req.body : null);
    if (!rawList) {
      return res.status(400).json({ success: false, message: '匯入格式不正確，需包含 users 陣列' });
    }
    const result = authManager.importUsers(rawList);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, message: err.message });
  }
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

// 取得機器人清單 (按身分隔離；管理員可透過 ?all=true 切換全域所有機器人視角；代理商可看自己與旗下客戶機器人)
app.get('/api/bots', requireAuth, (req, res) => {
  const isSuperAdmin = req.user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
  const showAll = isSuperAdmin && req.query.all === 'true';
  const bots = botManager.listBots(req.user.email, showAll, req.user);
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
  const ok = botManager.deleteBot(req.params.id, req.user.email);
  res.json({ success: ok });
});

app.post('/api/bots/:id/start', requireAuth, checkBotAccess, async (req, res) => {
  const result = await botManager.startBot(req.params.id, req.user.email);
  res.json(result);
});

app.post('/api/bots/:id/stop', requireAuth, checkBotAccess, (req, res) => {
  const result = botManager.stopBot(req.params.id, req.user.email);
  res.json(result);
});

app.post('/api/bots/:id/restart', requireAuth, checkBotAccess, async (req, res) => {
  const result = await botManager.restartBot(req.params.id, req.user.email);
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

// 機器人雲端永續備份與匯出 API (僅限最高管理員)
app.get('/api/admin/backup/bots', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const result = botManager.exportBotsData();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/admin/backup/bots/restore', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const { bots, base64 } = req.body;
    let targetList = bots;
    if (!targetList && base64) {
      const decoded = Buffer.from(base64, 'base64').toString('utf8');
      targetList = JSON.parse(decoded);
    }
    const result = botManager.restoreBotsData(targetList);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/admin/backup/bots/zip', requireAuth, requireSuperAdmin, (req, res) => {
  try {
    const zipBuffer = botManager.getBotsZip();
    res.setHeader('Content-Type', 'application/zip');
    res.setHeader('Content-Disposition', `attachment; filename=rpjg_bots_backup_${Date.now()}.zip`);
    res.send(zipBuffer);
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

async function startServer() {
  try {
    await authManager.initCloud();
  } catch (err) {
    console.error('雲端資料庫初始化例外:', err.message);
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n=============================================================`);
    console.log(`  🚀 RPJG BotCloud - Discord Bot 線上雲端託管平台已啟動 (v3.0)`);
    console.log(`  🏢 作者：R.P.J.G 開發部門`);
    console.log(`  👑 最高管理員: ${SUPER_ADMIN_EMAIL}`);
    console.log(`  🌐 伺服器位址: http://0.0.0.0:${PORT}`);
    console.log(`  📡 WebSocket 連線: ws://0.0.0.0:${PORT}/ws`);
    console.log(`=============================================================\n`);

    // 自動喚醒並拉起所有已託管機器人（排除 DISABLED 狀態）
    setTimeout(async () => {
      try {
        const allBots = botManager.listBots(null, true);
        for (const b of allBots) {
          if (b.status !== 'DISABLED') {
            console.log(`[RPJG 雲端守護] 正在為機器人 ${b.name} (${b.id}) 自動拉起在線常駐...`);
            await botManager.startBot(b.id);
          }
        }
      } catch (err) {
        console.error('[RPJG 雲端守護] 自動拉起機器人失敗:', err.message);
      }
    }, 3000);

    // 雲端保活機制 (Keep-Alive Self-Ping: 定期喚醒防止 Render 免費執行個體 15 分鐘無人訪問休眠)
    const RENDER_APP_URL = process.env.RENDER_EXTERNAL_URL || 'https://rpjgchat.onrender.com';
    setInterval(async () => {
      try {
        await fetch(`${RENDER_APP_URL}/api/system/stats`);
      } catch (_) {}
    }, 9 * 60 * 1000);
  });
}

startServer();
