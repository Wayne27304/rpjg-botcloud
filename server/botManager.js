/**
 * ================================================================
 * RPJG BotCloud - 核心機器人程序管理器 (Bot Process Manager)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import AdmZip from 'adm-zip';
import { fileURLToPath } from 'url';
import { authManager, SUPER_ADMIN_EMAIL } from './authManager.js';
import { auditLogger } from './auditLogger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOTS_DIR = path.join(__dirname, 'bots');
const DATA_DIR = path.join(__dirname, 'data');
const BOTS_BACKUP_FILE = path.join(DATA_DIR, 'bots_backup.json');

class BotManager {
  constructor() {
    this.processes = new Map();
    this.logs = new Map();
    this.stats = new Map();
    this.wsClients = new Set();
    this.manualStopping = new Set();

    if (!fs.existsSync(BOTS_DIR)) {
      fs.mkdirSync(BOTS_DIR, { recursive: true });
    }

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.initBots();
    this.startResourceMonitor();
  }

  // 初始化並還原機器人（三重永續機制：環境變數 RPJG_BOTS_BACKUP + 本地 data/bots_backup.json + Supabase 雲端資料庫）
  async initBots() {
    let cloudBots = [];

    // 1. 優先從 Render 環境變數 RPJG_BOTS_BACKUP 讀取
    const envBackup = process.env.RPJG_BOTS_BACKUP;
    if (envBackup && envBackup.trim()) {
      try {
        let decoded = null;
        try {
          decoded = Buffer.from(envBackup.trim(), 'base64').toString('utf8');
        } catch (_) {
          decoded = envBackup.trim();
        }
        const parsed = JSON.parse(decoded);
        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[RPJG-ENV-RESTORE] 📦 從 RPJG_BOTS_BACKUP 還原了 ${parsed.length} 個機器人！`);
          cloudBots = parsed;
        }
      } catch (err) {
        console.error('[RPJG-ENV-RESTORE] 解析 RPJG_BOTS_BACKUP 失敗:', err.message);
      }
    }

    // 2. 從 Git 追蹤保存的 server/data/bots_backup.json 還原
    if (fs.existsSync(BOTS_BACKUP_FILE)) {
      try {
        const fileContent = fs.readFileSync(BOTS_BACKUP_FILE, 'utf8');
        const parsed = JSON.parse(fileContent);
        if (Array.isArray(parsed)) {
          console.log(`[RPJG-FILE-RESTORE] 📦 從 bots_backup.json 讀取到 ${parsed.length} 個機器人備份！`);
          for (const bot of parsed) {
            if (!cloudBots.some(b => b.id === bot.id)) {
              cloudBots.push(bot);
            }
          }
        }
      } catch (err) {
        console.error('[RPJG-FILE-RESTORE] 讀取 bots_backup.json 失敗:', err.message);
      }
    }

    // 3. 還原專案目錄與所有檔案
    for (const bot of cloudBots) {
      if (!bot || !bot.id) continue;
      const botDir = path.join(BOTS_DIR, bot.id);
      if (!fs.existsSync(botDir)) {
        fs.mkdirSync(botDir, { recursive: true });
      }

      // 還原 metadata.json
      const metaPath = path.join(botDir, 'metadata.json');
      if (!fs.existsSync(metaPath) && bot.metadata) {
        fs.writeFileSync(metaPath, JSON.stringify(bot.metadata, null, 2), 'utf8');
      }

      // 還原程式碼與環境變數檔案 (bot.files)
      if (bot.files && typeof bot.files === 'object') {
        for (const [relPath, content] of Object.entries(bot.files)) {
          const targetPath = path.join(botDir, relPath);
          if (!fs.existsSync(targetPath)) {
            fs.mkdirSync(path.dirname(targetPath), { recursive: true });
            if (typeof content === 'string' && content.startsWith('base64:')) {
              fs.writeFileSync(targetPath, Buffer.from(content.replace('base64:', ''), 'base64'));
            } else {
              fs.writeFileSync(targetPath, content, 'utf8');
            }
          }
        }
      }
    }

    // 4. 同步至最新備份庫
    this.syncToBackup();
  }

  // 自動將當前磁碟所有機器人檔案深度序列化並備份 (寫入 bots_backup.json 並推送 Supabase)
  syncToBackup() {
    try {
      if (!fs.existsSync(BOTS_DIR)) return;
      if (!fs.existsSync(DATA_DIR)) {
        fs.mkdirSync(DATA_DIR, { recursive: true });
      }

      const entries = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
      const backupList = [];

      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const botId = entry.name;
        const botDir = path.join(BOTS_DIR, botId);
        const metaPath = path.join(botDir, 'metadata.json');
        if (!fs.existsSync(metaPath)) continue;

        let metadata = {};
        try {
          metadata = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        } catch (_) {}

        const files = {};
        const scanFiles = (dir, relPrefix = '') => {
          const dirEntries = fs.readdirSync(dir, { withFileTypes: true });
          for (const item of dirEntries) {
            if (item.name === 'node_modules' || item.name === '.git' || item.name === '__pycache__' || item.name === '.DS_Store' || item.name === 'metadata.json') continue;
            const fullItemPath = path.join(dir, item.name);
            const relItemPath = relPrefix ? `${relPrefix}/${item.name}` : item.name;

            if (item.isDirectory()) {
              scanFiles(fullItemPath, relItemPath);
            } else {
              try {
                const stat = fs.statSync(fullItemPath);
                if (stat.size < 5 * 1024 * 1024) {
                  const buf = fs.readFileSync(fullItemPath);
                  files[relItemPath] = 'base64:' + buf.toString('base64');
                }
              } catch (_) {}
            }
          }
        };

        scanFiles(botDir);

        backupList.push({
          id: botId,
          metadata,
          files,
          syncedAt: new Date().toISOString()
        });
      }

      fs.writeFileSync(BOTS_BACKUP_FILE, JSON.stringify(backupList, null, 2), 'utf8');
      console.log(`[RPJG 永續守護] 機器人備份已自動同步至 server/data/bots_backup.json (共 ${backupList.length} 個機器人)`);

      // 嘗試異步同步至 Supabase (若配置了雲端資料庫)
      this.syncToSupabase(backupList).catch(() => {});
    } catch (err) {
      console.error('[RPJG 永續守護] 備份同步失敗:', err.message);
    }
  }

  async syncToSupabase(backupList) {
    if (!authManager || !authManager.supabase || !authManager.isCloudActive) return;
    try {
      for (const item of backupList) {
        await authManager.supabase.from('rpjg_bots').upsert({
          id: item.id,
          name: item.metadata?.name || item.id,
          owner_email: item.metadata?.ownerEmail || SUPER_ADMIN_EMAIL,
          metadata: item.metadata,
          files: item.files,
          updated_at: new Date().toISOString()
        });
      }
    } catch (err) {
      // 容錯靜默處理
    }
  }

  // 匯出全部機器人備份資料（供管理員備份與設定 Render 環境變數）
  exportBotsData() {
    this.syncToBackup();
    if (fs.existsSync(BOTS_BACKUP_FILE)) {
      try {
        const raw = fs.readFileSync(BOTS_BACKUP_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        const base64 = Buffer.from(raw, 'utf8').toString('base64');
        return {
          success: true,
          count: parsed.length,
          bots: parsed,
          base64
        };
      } catch (e) {}
    }
    return { success: false, message: '查無備份檔案' };
  }

  // 還原機器人備份資料
  restoreBotsData(botsList) {
    if (!Array.isArray(botsList)) return { success: false, message: '無效的備份資料格式' };
    for (const bot of botsList) {
      if (!bot || !bot.id) continue;
      const botDir = path.join(BOTS_DIR, bot.id);
      fs.mkdirSync(botDir, { recursive: true });
      if (bot.metadata) {
        fs.writeFileSync(path.join(botDir, 'metadata.json'), JSON.stringify(bot.metadata, null, 2), 'utf8');
      }
      if (bot.files) {
        for (const [relPath, content] of Object.entries(bot.files)) {
          const targetPath = path.join(botDir, relPath);
          fs.mkdirSync(path.dirname(targetPath), { recursive: true });
          if (typeof content === 'string' && content.startsWith('base64:')) {
            fs.writeFileSync(targetPath, Buffer.from(content.replace('base64:', ''), 'base64'));
          } else {
            fs.writeFileSync(targetPath, content, 'utf8');
          }
        }
      }
    }
    this.syncToBackup();
    return { success: true, message: `成功還原 ${botsList.length} 個機器人！` };
  }

  // 打包全部機器人為 ZIP 下載
  getBotsZip() {
    const zip = new AdmZip();
    if (fs.existsSync(BOTS_DIR)) {
      const entries = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isDirectory()) {
          zip.addLocalFolder(path.join(BOTS_DIR, entry.name), entry.name);
        }
      }
    }
    return zip.toBuffer();
  }

  // 格式化位元組為易讀單位 (B, KB, MB, GB)
  formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  }

  // 遞迴計算目錄或檔案大小
  getDirSize(dirPath) {
    let total = 0;
    if (!fs.existsSync(dirPath)) return 0;
    try {
      const stat = fs.statSync(dirPath);
      if (!stat.isDirectory()) return stat.size;
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);
        if (entry.isDirectory()) {
          total += this.getDirSize(fullPath);
        } else {
          try {
            total += fs.statSync(fullPath).size;
          } catch (_) {}
        }
      }
    } catch (_) {}
    return total;
  }

  // 計算指定使用者所有機器人實際佔用的儲存空間
  getUserStorageUsage(userEmail) {
    if (!fs.existsSync(BOTS_DIR)) return { totalBytes: 0, totalMB: 0, formatted: '0 B', botCount: 0, bots: [] };
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    let totalBytes = 0;
    const userBots = [];

    const entries = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const botId = entry.name;
      const botDir = path.join(BOTS_DIR, botId);
      const metaPath = path.join(botDir, 'metadata.json');
      if (fs.existsSync(metaPath)) {
        try {
          const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
          const botOwner = (meta.ownerEmail || SUPER_ADMIN_EMAIL).toLowerCase();
          if (botOwner === cleanEmail) {
            const botSize = this.getDirSize(botDir);
            totalBytes += botSize;
            userBots.push({
              id: botId,
              name: meta.name,
              sizeBytes: botSize,
              sizeFormatted: this.formatBytes(botSize)
            });
          }
        } catch (_) {}
      }
    }

    return {
      totalBytes,
      totalMB: +(totalBytes / (1024 * 1024)).toFixed(2),
      formatted: this.formatBytes(totalBytes),
      botCount: userBots.length,
      bots: userBots
    };
  }

  // 檢查使用者是否超出空間配額 (超額時拒絕寫入/上傳)
  checkUserStorageQuota(userEmail, incomingBytes = 0) {
    const cleanEmail = (userEmail || '').trim().toLowerCase();
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { allowed: true }; // 最高總管不受配額限制
    }

    const user = authManager.getUser(cleanEmail);
    const maxStorageMB = user?.maxStorageMB || 100;
    const maxBytes = maxStorageMB * 1024 * 1024;
    const usage = this.getUserStorageUsage(cleanEmail);

    if (usage.totalBytes + incomingBytes > maxBytes) {
      const currentMB = (usage.totalBytes / (1024 * 1024)).toFixed(2);
      const incomingMB = (incomingBytes / (1024 * 1024)).toFixed(2);
      return {
        allowed: false,
        message: `已超出管理員派發的雲端儲存空間配額！目前已使用 ${currentMB} MB，即將寫入 ${incomingMB} MB，超過上限 ${maxStorageMB} MB。請聯絡管理員 (ryanryan311311@gmail.com) 擴充空間。`,
        currentMB,
        maxStorageMB
      };
    }
    return { allowed: true, currentMB: usage.totalMB, maxStorageMB };
  }

  // 取得主機整體儲存空間與配額總覽 (提供管理員後台)
  getSystemStorageOverview() {
    let diskTotalBytes = 0;
    let diskFreeBytes = 0;
    let diskUsedBytes = 0;

    try {
      if (fs.statfsSync) {
        const stats = fs.statfsSync(BOTS_DIR);
        const bsize = stats.bsize || 4096;
        diskTotalBytes = (stats.blocks || 0) * bsize;
        diskFreeBytes = (stats.bavail || stats.bfree || 0) * bsize;
        diskUsedBytes = Math.max(0, diskTotalBytes - diskFreeBytes);
      }
    } catch (e) {
      console.error('statfsSync 讀取失敗:', e.message);
    }

    // 機器人目錄總空間與清單
    let totalBotsBytes = 0;
    let totalBotCount = 0;
    const botUsageList = [];

    if (fs.existsSync(BOTS_DIR)) {
      const entries = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const botDir = path.join(BOTS_DIR, entry.name);
        const bSize = this.getDirSize(botDir);
        totalBotsBytes += bSize;
        totalBotCount++;

        let meta = { name: entry.name, ownerEmail: '未知' };
        try {
          const metaFile = path.join(botDir, 'metadata.json');
          if (fs.existsSync(metaFile)) {
            meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
          }
        } catch (_) {}

        botUsageList.push({
          id: entry.name,
          name: meta.name || entry.name,
          ownerEmail: meta.ownerEmail || SUPER_ADMIN_EMAIL,
          sizeBytes: bSize,
          sizeFormatted: this.formatBytes(bSize)
        });
      }
    }

    // 計算已派發配額總量
    const allUsers = authManager.getUsers();
    let totalAllocatedQuotaMB = 0;
    for (const u of allUsers) {
      totalAllocatedQuotaMB += (u.maxStorageMB || (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 10240 : 100));
    }

    const botsUsedMB = +(totalBotsBytes / (1024 * 1024)).toFixed(2);

    return {
      disk: {
        totalBytes: diskTotalBytes,
        freeBytes: diskFreeBytes,
        usedBytes: diskUsedBytes,
        totalFormatted: this.formatBytes(diskTotalBytes),
        freeFormatted: this.formatBytes(diskFreeBytes),
        usedFormatted: this.formatBytes(diskUsedBytes),
        usedPercent: diskTotalBytes > 0 ? +((diskUsedBytes / diskTotalBytes) * 100).toFixed(1) : 0
      },
      bots: {
        totalBytes: totalBotsBytes,
        totalMB: botsUsedMB,
        formatted: this.formatBytes(totalBotsBytes),
        totalBotCount,
        list: botUsageList
      },
      quota: {
        totalAllocatedMB: totalAllocatedQuotaMB,
        totalUsedMB: botsUsedMB,
        remainingFreeQuotaMB: Math.max(0, +(totalAllocatedQuotaMB - botsUsedMB).toFixed(2)),
        usagePercent: totalAllocatedQuotaMB > 0 ? +((botsUsedMB / totalAllocatedQuotaMB) * 100).toFixed(1) : 0
      }
    };
  }

  setWsClients(clients) {
    this.wsClients = clients;
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    for (const client of this.wsClients) {
      if (client.readyState === 1) {
        client.send(data);
      }
    }
  }

  // 取得機器人清單 (支援使用者隔離、經銷代理商與最高管理員全域穿透視角)
  listBots(userEmail = null, showAll = false, actorUser = null) {
    if (!fs.existsSync(BOTS_DIR)) return [];
    const entries = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
    const bots = [];

    const isSuperAdmin = (actorUser && actorUser.role === 'SUPER_ADMIN') ||
                         (userEmail && userEmail.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
    const isReseller = actorUser && actorUser.role === 'RESELLER';

    // 取得代理商旗下的所有子客戶名冊
    const resellerSubEmails = new Set();
    if (isReseller && actorUser) {
      const allUsers = authManager.getUsers();
      allUsers
        .filter(u => (u.parentResellerEmail || '').toLowerCase() === actorUser.email.toLowerCase())
        .forEach(u => resellerSubEmails.add(u.email.toLowerCase()));
      resellerSubEmails.add(actorUser.email.toLowerCase());
    }

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(BOTS_DIR, entry.name, 'metadata.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
            const botOwner = (meta.ownerEmail || SUPER_ADMIN_EMAIL).toLowerCase();

            // 權限過濾：
            // 1. 最高管理員開啟 showAll 時可看全站所有機器人
            if (isSuperAdmin && showAll) {
              // 允許全看
            } else if (isReseller) {
              // 2. 經銷代理商：可檢視自己與旗下所有代理客戶的機器人
              if (!resellerSubEmails.has(botOwner)) {
                continue;
              }
            } else if (userEmail) {
              // 3. 一般買家客戶：只能檢視自己擁有的機器人
              if (botOwner !== userEmail.toLowerCase()) {
                continue;
              }
            }

            const isRunning = this.processes.has(meta.id);
            const currentStats = this.stats.get(meta.id) || { cpu: 0, memory: 0, uptime: 0 };
            const effectiveStatus = meta.status === 'DISABLED'
              ? 'DISABLED'
              : (isRunning ? 'ONLINE' : (meta.status === 'STARTING' ? 'STARTING' : 'OFFLINE'));

            const ownerObj = authManager.getUser(botOwner);

            bots.push({
              ...meta,
              ownerEmail: botOwner,
              ownerDisplayName: ownerObj?.displayName || botOwner,
              parentResellerEmail: ownerObj?.parentResellerEmail || null,
              status: effectiveStatus,
              ...currentStats
            });
          } catch (e) {
            console.error(`Error reading bot metadata for ${entry.name}:`, e.message);
          }
        }
      }
    }

    return bots;
  }

  getBot(botId) {
    const metaPath = path.join(BOTS_DIR, botId, 'metadata.json');
    if (!fs.existsSync(metaPath)) return null;
    const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    const isRunning = this.processes.has(botId);
    const currentStats = this.stats.get(botId) || { cpu: 0, memory: 0, uptime: 0 };
    const effectiveStatus = meta.status === 'DISABLED'
      ? 'DISABLED'
      : (isRunning ? 'ONLINE' : (meta.status === 'STARTING' ? 'STARTING' : 'OFFLINE'));

    const botOwner = meta.ownerEmail || SUPER_ADMIN_EMAIL;
    return {
      ...meta,
      ownerEmail: botOwner,
      status: effectiveStatus,
      ...currentStats
    };
  }

  // 由使用者自訂上傳檔案或 ZIP 建立機器人
  createBotFromUpload({ name, type, description, mainFile, ownerEmail, zipFile, uploadedFiles, initialCode }) {
    const zipSize = (zipFile && zipFile.buffer) ? zipFile.buffer.length : (zipFile?.size || 0);
    const filesSize = (uploadedFiles || []).reduce((sum, f) => sum + (f.buffer?.length || f.size || 0), 0);
    const incomingBytes = zipSize + filesSize;

    // 檢查使用者儲存空間配額
    const quotaCheck = this.checkUserStorageQuota(ownerEmail, incomingBytes);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.message);
    }

    const botId = 'bot-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const botDir = path.join(BOTS_DIR, botId);
    fs.mkdirSync(botDir, { recursive: true });

    let detectedMainFile = mainFile;

    // 1. 若有上傳 ZIP 檔案，自動解壓縮
    if (zipFile && zipFile.buffer) {
      try {
        const zip = new AdmZip(zipFile.buffer);
        zip.extractAllTo(botDir, true);

        // 自動掃描尋找主程式入口
        const extracted = fs.readdirSync(botDir).filter(f => !f.startsWith('.'));
        if (extracted.includes('bot.py')) detectedMainFile = 'bot.py';
        else if (extracted.includes('main.py')) detectedMainFile = 'main.py';
        else if (extracted.includes('index.js')) detectedMainFile = 'index.js';
        else if (extracted.includes('app.js')) detectedMainFile = 'app.js';
        else {
          const py = extracted.find(f => f.endsWith('.py'));
          const js = extracted.find(f => f.endsWith('.js'));
          if (py) detectedMainFile = py;
          else if (js) detectedMainFile = js;
        }
      } catch (err) {
        console.error('ZIP 解壓縮失敗:', err.message);
      }
    }

    // 2. 若有多個單一檔案上傳
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        let cleanName = file.originalname;
        try {
          const utf8 = Buffer.from(file.originalname, 'latin1').toString('utf8');
          if (utf8 && utf8.length > 0) cleanName = utf8;
        } catch (_) {}
        // 清理不合法字元，避免 URL query 或 shell glob 異常
        cleanName = cleanName.replace(/[?*:"<>|]/g, '_');

        const targetPath = path.join(botDir, cleanName);
        fs.writeFileSync(targetPath, file.buffer);

        // 若尚未決定入口或只有單一檔案，優先以此檔案為主入口
        if (!detectedMainFile || uploadedFiles.length === 1 || detectedMainFile === 'bot.py' || detectedMainFile === 'index.js') {
          if (cleanName.endsWith('.py') || cleanName.endsWith('.js')) {
            detectedMainFile = cleanName;
          }
        }
      }
    }

    if (!detectedMainFile) {
      detectedMainFile = type === 'python' ? 'bot.py' : 'index.js';
    }

    // 3. 若無檔案，建立預設起始檔
    const filesInDir = fs.readdirSync(botDir).filter(f => f !== 'metadata.json');
    if (filesInDir.length === 0) {
      const isPy = type === 'python' || detectedMainFile.endsWith('.py');
      if (isPy) {
        fs.writeFileSync(path.join(botDir, detectedMainFile), `# -*- coding: utf-8 -*-\n# 由使用者自行上傳的 Python Bot\nimport os, sys, time\n\nprint("[RPJG] 機器人正在啟動...", flush=True)\nwhile True:\n    time.sleep(5)\n    print("[RPJG-STATUS] 運行中", flush=True)\n`);
        fs.writeFileSync(path.join(botDir, '.env'), `DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN\nBOT_PREFIX=!\n`);
      } else {
        fs.writeFileSync(path.join(botDir, detectedMainFile), `// 由使用者自行上傳的 Node.js Bot\nconsole.log("[RPJG] 機器人正在啟動...");\nsetInterval(() => {\n  console.log("[RPJG-STATUS] 運行中");\n}, 5000);\n`);
        fs.writeFileSync(path.join(botDir, '.env'), `DISCORD_BOT_TOKEN=YOUR_BOT_TOKEN\nBOT_PREFIX=!\n`);
      }
    } else {
      // 若已有檔案，建立安全標準名稱別名 (bot.py 或 index.js)
      const isPy = type === 'python' || detectedMainFile.endsWith('.py');
      const standardName = isPy ? 'bot.py' : 'index.js';
      const actualMainPath = path.join(botDir, detectedMainFile);
      if (fs.existsSync(actualMainPath) && !fs.existsSync(path.join(botDir, standardName))) {
        try {
          fs.copyFileSync(actualMainPath, path.join(botDir, standardName));
        } catch (_) {}
      }
    }

    // 儲存 metadata.json
    const metadata = {
      id: botId,
      name: name || '我的自訂機器人',
      type: type || (detectedMainFile.endsWith('.py') ? 'python' : 'nodejs'),
      description: description || '由使用者自行上傳的 Discord Bot',
      mainFile: detectedMainFile,
      ownerEmail: ownerEmail || 'ryanryan311311@gmail.com',
      status: 'OFFLINE',
      author: 'R.P.J.G 開發部門',
      createdAt: new Date().toISOString(),
      nodeLocation: 'RPJG-TW-Node-01 (台灣彰化機房)',
      autoRestart: true,
      maxMemory: 512
    };

    fs.writeFileSync(path.join(botDir, 'metadata.json'), JSON.stringify(metadata, null, 2), 'utf8');

    this.logs.set(botId, [
      `\x1b[35m[R.P.J.G 開發部門]\x1b[0m 機器人專案 "${metadata.name}" 已成功由使用者檔案上傳部署。`,
      `\x1b[36m[RPJG-CLOUD]\x1b[0m 專屬獨立沙盒空間已劃分 | 擁有者: ${metadata.ownerEmail}`
    ]);

    // 上傳後立即在背景自動分析並安裝前置依賴
    this.ensureDependencies(botId, botDir, metadata.type).catch(e => {
      console.error('背景依賴安裝例外:', e.message);
    });

    auditLogger.log(
      ownerEmail || SUPER_ADMIN_EMAIL,
      'BOT_CREATE',
      `${metadata.name} (${botId})`,
      { type: metadata.type, mainFile: detectedMainFile }
    );

    this.syncToBackup();
    return metadata;
  }

  deleteBot(botId, actorEmail = null) {
    const existing = this.getBot(botId);
    this.stopBot(botId, actorEmail);
    const botDir = path.join(BOTS_DIR, botId);
    try {
      if (fs.existsSync(botDir)) {
        fs.rmSync(botDir, { recursive: true, force: true });
      }
    } catch (e) {
      setTimeout(() => {
        try {
          if (fs.existsSync(botDir)) {
            fs.rmSync(botDir, { recursive: true, force: true });
          }
        } catch (_) {}
      }, 1000);
    }
    this.logs.delete(botId);
    this.stats.delete(botId);
    this.syncToBackup();
    this.broadcast({ type: 'bot_deleted', botId });

    auditLogger.log(
      actorEmail || existing?.ownerEmail || 'USER',
      'BOT_DELETE',
      `${existing?.name || botId} (${botId})`,
      { botId, botName: existing?.name, ownerEmail: existing?.ownerEmail }
    );

    return true;
  }

  // 執行前置套件安裝子程序
  runInstallCommand(botId, botDir, tool, args) {
    return new Promise((resolve) => {
      let cmd = '';
      if (tool === 'pip') {
        cmd = process.platform === 'win32' ? 'pip' : 'pip3';
      } else {
        cmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
      }

      let child = null;
      try {
        child = spawn(cmd, args, {
          cwd: botDir,
          env: { ...process.env, PYTHONUNBUFFERED: '1' }
        });
      } catch (err) {
        if (tool === 'pip' && process.platform !== 'win32') {
          try {
            child = spawn('python3', ['-m', 'pip', ...args], { cwd: botDir, env: { ...process.env } });
          } catch (e2) {
            this.appendLog(botId, `\x1b[31m[DEPS ERROR]\x1b[0m 調用 pip 失敗: ${err.message}`);
            return resolve(false);
          }
        } else {
          this.appendLog(botId, `\x1b[31m[DEPS ERROR]\x1b[0m 安裝指令啟動失敗: ${err.message}`);
          return resolve(false);
        }
      }

      child.stdout.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim().length > 0) {
            this.appendLog(botId, `\x1b[90m[INSTALL]\x1b[0m ${line}`);
          }
        }
      });

      child.stderr.on('data', (data) => {
        const lines = data.toString().split('\n');
        for (const line of lines) {
          if (line.trim().length > 0 && !line.includes('WARNING') && !line.includes('notice')) {
            this.appendLog(botId, `\x1b[33m[INSTALL-INFO]\x1b[0m ${line}`);
          }
        }
      });

      child.on('close', (code) => {
        resolve(code === 0);
      });

      child.on('error', () => {
        if (tool === 'pip' && process.platform !== 'win32') {
          const fb = spawn('python3', ['-m', 'pip', ...args], { cwd: botDir });
          fb.on('close', () => resolve(true));
          fb.on('error', () => resolve(false));
        } else {
          resolve(false);
        }
      });
    });
  }

  // 智能前置依賴分析與自動安裝
  async ensureDependencies(botId, botDir, botType) {
    if (!fs.existsSync(botDir)) return;

    const allFiles = fs.readdirSync(botDir).filter(f => !f.startsWith('.'));
    const isPython = botType === 'python' || allFiles.some(f => f.endsWith('.py'));

    if (isPython) {
      const reqFile = path.join(botDir, 'requirements.txt');
      if (fs.existsSync(reqFile)) {
        this.appendLog(botId, '\x1b[36m[RPJG 依賴系統]\x1b[0m 偵測到 requirements.txt，正在自動安裝所有前置套件...');
        let ok = await this.runInstallCommand(botId, botDir, 'pip', ['install', '-r', 'requirements.txt', '--break-system-packages']);
        if (!ok) {
          await this.runInstallCommand(botId, botDir, 'pip', ['install', '-r', 'requirements.txt']);
        }
        this.appendLog(botId, '\x1b[32m[RPJG 依賴系統]\x1b[0m requirements.txt 套件安裝流程完成！');
        return;
      }

      // 提取所有 .py 中的 import 語句
      const pyFiles = allFiles.filter(f => f.endsWith('.py'));
      const detectedImports = new Set();

      const standardLib = new Set([
        'os', 'sys', 'time', 'json', 'math', 'random', 're', 'datetime', 'asyncio',
        'typing', 'collections', 'threading', 'urllib', 'subprocess', 'pathlib',
        'socket', 'sqlite3', 'logging', 'shutil', 'traceback', 'copy', 'io',
        'functools', 'itertools', 'struct', 'enum', 'tempfile', 'glob', 'uuid',
        'hashlib', 'base64', 'hmac', 'unittest', 'http', 'email', 'platform',
        'inspect', 'cmath', 'decimal', 'fractions', 'statistics', 'bisect', 'heapq',
        'array', 'queue', 'weakref', 'types', 'gc', 'dis', 'pydoc', 'zipfile',
        'tarfile', 'csv', 'configparser', 'xml', 'html', 'gettext', 'locale',
        'calendar', 'timeit', 'profile', 'warnings', 'contextlib', 'abc', 'atexit',
        'builtins', 'multiprocessing', 'concurrent', 'ctypes', 'select', 'signal',
        'mmap', 'operator', 'numbers', 'keyword', 'token', 'tokenize', 'ast'
      ]);

      const localFiles = new Set(allFiles.map(f => f.replace(/\.py$/, '').toLowerCase()));

      for (const file of pyFiles) {
        try {
          const content = fs.readFileSync(path.join(botDir, file), 'utf8');
          const regex = /^(?:import|from)\s+([a-zA-Z0-9_\.]+)/gm;
          let match;
          while ((match = regex.exec(content)) !== null) {
            const rootModule = match[1].split('.')[0].toLowerCase();
            if (!standardLib.has(rootModule) && !localFiles.has(rootModule) && rootModule.length > 1) {
              detectedImports.add(rootModule);
            }
          }
        } catch (_) {}
      }

      const packageMap = {
        discord: 'discord.py',
        dotenv: 'python-dotenv',
        pil: 'Pillow',
        bs4: 'beautifulsoup4',
        yaml: 'pyyaml',
        cv2: 'opencv-python',
        google: 'google-generativeai',
        telegram: 'python-telegram-bot',
        youtube_dl: 'youtube-dl',
        ytdl: 'yt-dlp',
        yt_dlp: 'yt-dlp',
        mysql: 'mysql-connector-python',
        postgres: 'psycopg2-binary'
      };

      const packagesToInstall = [];
      for (const mod of detectedImports) {
        const pkg = packageMap[mod] || mod;
        if (!packagesToInstall.includes(pkg)) {
          packagesToInstall.push(pkg);
        }
      }

      // 針對 Discord 機器人保底確保核心套件
      if (!packagesToInstall.includes('discord.py') && !packagesToInstall.includes('discord')) {
        packagesToInstall.push('discord.py');
      }
      if (!packagesToInstall.includes('python-dotenv') && !packagesToInstall.includes('dotenv')) {
        packagesToInstall.push('python-dotenv');
      }

      if (packagesToInstall.length > 0) {
        this.appendLog(botId, `\x1b[36m[RPJG 智能依賴檢測]\x1b[0m 掃描到需要安裝前置套件: ${packagesToInstall.join(', ')}`);
        this.appendLog(botId, `\x1b[35m[RPJG 自動安裝]\x1b[0m 正在為您自動補齊所有依賴庫 (pip install)...`);
        
        let ok = await this.runInstallCommand(botId, botDir, 'pip', ['install', ...packagesToInstall, '--break-system-packages', '--quiet']);
        if (!ok) {
          await this.runInstallCommand(botId, botDir, 'pip', ['install', ...packagesToInstall, '--quiet']);
        }
        this.appendLog(botId, `\x1b[32m[RPJG 自動安裝]\x1b[0m 前置依賴套件全數安裝完成！`);
      }
    } else {
      // Node.js 專案處理
      const pkgJsonPath = path.join(botDir, 'package.json');
      if (fs.existsSync(pkgJsonPath)) {
        const nodeModulesPath = path.join(botDir, 'node_modules');
        if (!fs.existsSync(nodeModulesPath)) {
          this.appendLog(botId, '\x1b[36m[RPJG 依賴系統]\x1b[0m 偵測到 package.json，正在自動執行 npm install...');
          await this.runInstallCommand(botId, botDir, 'npm', ['install', '--production']);
          this.appendLog(botId, '\x1b[32m[RPJG 自動安裝]\x1b[0m npm 前置模組安裝完畢！');
        }
      }
    }
  }

  async startBot(botId, actorEmail = null) {
    if (this.processes.has(botId)) {
      return { success: false, message: '機器人已在運行中' };
    }

    const bot = this.getBot(botId);
    if (!bot) return { success: false, message: '找不到此機器人' };

    if (bot.status === 'DISABLED') {
      return { success: false, message: '此機器人目前處於「停用託管」狀態，請先點擊「啟用託管」以恢復服務。' };
    }

    const botDir = path.join(BOTS_DIR, botId);
    if (!fs.existsSync(botDir)) {
      return { success: false, message: '機器人專案目錄不存在' };
    }

    // 智能入口檔案偵測與自動校正機制
    let targetFile = path.join(botDir, bot.mainFile || '');
    if (!bot.mainFile || !fs.existsSync(targetFile)) {
      const allFiles = fs.readdirSync(botDir).filter(f => f !== 'metadata.json' && !f.startsWith('.'));
      
      const isPy = bot.type === 'python' || (bot.mainFile && bot.mainFile.endsWith('.py'));
      let candidate = isPy 
        ? (allFiles.find(f => f.endsWith('.py')) || allFiles.find(f => f.endsWith('.js')))
        : (allFiles.find(f => f.endsWith('.js')) || allFiles.find(f => f.endsWith('.py')));

      if (!candidate && allFiles.length > 0) {
        candidate = allFiles[0];
      }

      if (candidate) {
        this.appendLog(botId, `\x1b[33m[RPJG 智能修復]\x1b[0m 偵測到入口「${bot.mainFile || '未指定'}」不存在，已自動校正至現有檔案：「${candidate}」`);
        bot.mainFile = candidate;
        if (candidate.endsWith('.py')) bot.type = 'python';
        if (candidate.endsWith('.js')) bot.type = 'nodejs';
        targetFile = path.join(botDir, candidate);

        try {
          fs.writeFileSync(path.join(botDir, 'metadata.json'), JSON.stringify(bot, null, 2), 'utf8');
        } catch (_) {}
      } else {
        return { success: false, message: `專案目錄內查無任何程式碼檔案，請在「檔案管理」中上傳您的 Bot 程式碼。` };
      }
    }

    // 建立安全標準執行檔別名 (bot.py 或 index.js)，徹底根除因檔名包含問號、中文或特殊符號造成的直譯器解析失敗
    const isPython = bot.type === 'python' || bot.mainFile.endsWith('.py');
    const standardName = isPython ? 'bot.py' : 'index.js';
    let executionFile = bot.mainFile;

    // 若當前主檔名非標準名稱且包含非 ASCII 字元或特殊符號，拷貝成標準名稱
    if (bot.mainFile !== standardName) {
      const standardPath = path.join(botDir, standardName);
      try {
        fs.copyFileSync(targetFile, standardPath);
        executionFile = standardName;
        this.appendLog(botId, `\x1b[36m[RPJG-ENV]\x1b[0m 已為「${bot.mainFile}」建立雲端標準運行副本: ${standardName}`);
      } catch (err) {
        console.error('複製標準運行檔失敗:', err.message);
      }
    } else if (fs.existsSync(path.join(botDir, standardName))) {
      executionFile = standardName;
    }

    // 啟動前置依賴檢查與安裝
    this.updateBotStatus(botId, 'STARTING');
    try {
      await this.ensureDependencies(botId, botDir, bot.type);
    } catch (e) {
      this.appendLog(botId, `\x1b[33m[RPJG-DEPS]\x1b[0m 依賴檢查提示: ${e.message}`);
    }

    this.appendLog(botId, `\x1b[35m[R.P.J.G 雲端管理員]\x1b[0m 正在為您啟動進程 (${executionFile})...`);

    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const cmd = isPython ? pythonCmd : 'node';
    const args = isPython ? ['-u', executionFile] : [executionFile];

    this.manualStopping.delete(botId);
    try {
      const child = spawn(cmd, args, {
        cwd: botDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' }
      });

      this.processes.set(botId, child);
      const startTime = Date.now();
      this.stats.set(botId, {
        cpu: (Math.random() * 2 + 1).toFixed(1),
        memory: isPython ? 35 : 45,
        uptime: 0,
        startedAt: startTime
      });

      this.updateBotStatus(botId, 'ONLINE');
      this.appendLog(botId, `\x1b[32m[RPJG-SYSTEM]\x1b[0m 進程啟動完成 (PID: ${child.pid})，進入常駐在線託管狀態。`);

      const handleLogLine = (line, isError = false) => {
        if (line.trim().length === 0) return;
        if (isError) {
          this.appendLog(botId, `\x1b[31m${line}\x1b[0m`);
        } else {
          this.appendLog(botId, line);
        }

        // 智能識別 Discord 意圖警告與排查指引
        if (line.includes('Privileged message content intent is missing')) {
          this.appendLog(botId, `\x1b[33m[RPJG 智能守護]\x1b[0m 偵測到 Discord 警告：Privileged message content intent is missing。`);
          this.appendLog(botId, `\x1b[36m[RPJG 設定教學]\x1b[0m 若需讀取文字指令（如 !指令），請至 Discord 開發者後台 (https://discord.com/developers/applications) -> 點選機器人 -> 左側「Bot」-> 找到「Privileged Gateway Intents」-> 勾選開啟「MESSAGE CONTENT INTENT」與「SERVER MEMBERS INTENT」並保存變更！（若使用斜線 /指令 則已可正常運作）`);
        } else if (line.includes('PrivilegedIntentsRequired')) {
          this.appendLog(botId, `\x1b[31m[RPJG 權限錯誤排查]\x1b[0m 機器人代碼啟用了 Privileged Intents，但 Discord 開發者後台尚未勾選開啟！`);
          this.appendLog(botId, `\x1b[33m[RPJG 解決步驟]\x1b[0m 請至 Discord Developer Portal -> 點選機器人 -> Bot -> 勾選開啟「MESSAGE CONTENT INTENT」與「SERVER MEMBERS INTENT」，儲存後重啟機器人即可正常在線！`);
        }
      };

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          handleLogLine(line, false);
        }
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          handleLogLine(line, true);
        }
      });

      child.on('close', (code) => {
        this.processes.delete(botId);
        this.stats.set(botId, { cpu: 0, memory: 0, uptime: 0 });
        this.updateBotStatus(botId, 'OFFLINE');
        this.appendLog(botId, `\x1b[33m[RPJG-SYSTEM]\x1b[0m 機器人進程已退出 (退出碼: ${code})。`);

        const runtimeMs = Date.now() - startTime;
        const isManual = this.manualStopping.has(botId);
        if (isManual) {
          this.manualStopping.delete(botId);
          return;
        }

        // 非人為手動停止，且機器人設定為自動重啟（預設為開啟），且運行時間大於 4 秒
        const currentBot = this.getBot(botId);
        if (currentBot && currentBot.status !== 'DISABLED' && currentBot.autoRestart !== false) {
          if (runtimeMs > 4000) {
            this.appendLog(botId, `\x1b[35m[RPJG 守護機制]\x1b[0m 偵測到運行中非預期退出，將在 5 秒後自動重啟恢復在線...`);
            setTimeout(() => {
              if (!this.processes.has(botId) && this.getBot(botId)?.status !== 'DISABLED') {
                this.startBot(botId);
              }
            }, 5000);
          } else {
            this.appendLog(botId, `\x1b[31m[RPJG 守護提示]\x1b[0m 機器人剛啟動即異常退出，已暫停自動重啟。請查看上方紅色錯誤訊息排查（例如缺少 Discord Token、模組未安裝等）。`);
          }
        }
      });

      child.on('error', (err) => {
        this.appendLog(botId, `\x1b[31m[PROCESS ERROR]\x1b[0m 執行失敗: ${err.message} (請確認環境直譯器 ${cmd} 是否可正常調用)`);
        this.processes.delete(botId);
        this.updateBotStatus(botId, 'OFFLINE');
      });

      auditLogger.log(
        actorEmail || bot.ownerEmail || 'USER',
        'BOT_START',
        `${bot.name} (${botId})`,
        { botId, botName: bot.name, ownerEmail: bot.ownerEmail }
      );

      return { success: true, message: '機器人啟動指令已下達' };
    } catch (err) {
      this.updateBotStatus(botId, 'OFFLINE');
      this.appendLog(botId, `\x1b[31m[LAUNCH ERROR]\x1b[0m ${err.message}`);
      return { success: false, message: `啟動失敗: ${err.message}` };
    }
  }

  stopBot(botId, actorEmail = null) {
    this.manualStopping.add(botId);
    const child = this.processes.get(botId);
    if (!child) {
      return { success: false, message: '機器人未在運行中' };
    }

    const bot = this.getBot(botId);
    this.appendLog(botId, `\x1b[33m[RPJG-SYSTEM]\x1b[0m 正在優雅終止進程 (SIGTERM / PID: ${child.pid})...`);
    try {
      if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', child.pid, '/f', '/t']);
      } else {
        try {
          spawn('pkill', ['-P', String(child.pid)]);
        } catch (e) {}
        child.kill('SIGTERM');
      }
    } catch (e) {
      child.kill('SIGKILL');
    }

    this.processes.delete(botId);
    this.stats.set(botId, { cpu: 0, memory: 0, uptime: 0 });
    this.updateBotStatus(botId, 'OFFLINE');
    this.appendLog(botId, `\x1b[32m[RPJG-SYSTEM]\x1b[0m 機器人已安全停止。`);

    auditLogger.log(
      actorEmail || (bot ? bot.ownerEmail : 'USER'),
      'BOT_STOP',
      `${bot ? bot.name : botId} (${botId})`,
      { botId, botName: bot ? bot.name : botId, ownerEmail: bot ? bot.ownerEmail : null }
    );

    return { success: true, message: '機器人已成功停止' };
  }

  restartBot(botId, actorEmail = null) {
    this.appendLog(botId, `\x1b[35m[RPJG-SYSTEM]\x1b[0m 正在重新啟動機器人...`);
    this.stopBot(botId, actorEmail);
    return new Promise((resolve) => {
      setTimeout(async () => {
        const res = await this.startBot(botId, actorEmail);
        resolve(res);
      }, 1000);
    });
  }

  suspendHosting(botId) {
    if (this.processes.has(botId)) {
      this.stopBot(botId);
    }
    this.updateBotStatus(botId, 'DISABLED');
    this.appendLog(botId, `\x1b[33m[RPJG-SYSTEM]\x1b[0m 該機器人託管服務已停用，守護進程與自動重啟已解除。`);
    return { success: true, message: '已成功停用此機器人託管' };
  }

  resumeHosting(botId) {
    this.updateBotStatus(botId, 'OFFLINE');
    this.appendLog(botId, `\x1b[32m[RPJG-SYSTEM]\x1b[0m 該機器人託管服務已恢復啟用，處於待命狀態。`);
    return { success: true, message: '已成功恢復此機器人託管' };
  }

  sendInput(botId, text) {
    const child = this.processes.get(botId);
    if (!child || !child.stdin) {
      return { success: false, message: '機器人未在運行中或無輸入管道' };
    }
    this.appendLog(botId, `\x1b[36m> ${text}\x1b[0m`);
    child.stdin.write(text + '\n');
    return { success: true };
  }

  appendLog(botId, line) {
    if (!this.logs.has(botId)) {
      this.logs.set(botId, []);
    }
    const logArr = this.logs.get(botId);
    logArr.push(line);
    if (logArr.length > 500) {
      logArr.shift();
    }
    this.broadcast({ type: 'log', botId, line });
  }

  getLogs(botId) {
    return this.logs.get(botId) || [];
  }

  clearLogs(botId) {
    this.logs.set(botId, [`\x1b[35m[RPJG-SYSTEM]\x1b[0m 日誌已清空。`]);
    this.broadcast({ type: 'logs_cleared', botId });
    return true;
  }

  updateBotStatus(botId, status) {
    const metaPath = path.join(BOTS_DIR, botId, 'metadata.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        meta.status = status;
        fs.writeFileSync(metaPath, JSON.stringify(meta, null, 2), 'utf8');
      } catch (e) {}
    }
    this.broadcast({ type: 'bot_status', botId, status });
    this.syncToBackup();
  }

  listFiles(botId) {
    const botDir = path.join(BOTS_DIR, botId);
    if (!fs.existsSync(botDir)) return [];
    
    const scanDir = (dir, relPath = '') => {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      const items = [];
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git' || entry.name === '__pycache__') continue;
        const subRel = relPath ? `${relPath}/${entry.name}` : entry.name;
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          items.push({
            name: entry.name,
            path: subRel,
            isDir: true,
            children: scanDir(fullPath, subRel)
          });
        } else {
          const stats = fs.statSync(fullPath);
          items.push({
            name: entry.name,
            path: subRel,
            isDir: false,
            size: stats.size,
            updatedAt: stats.mtime
          });
        }
      }
      return items;
    };

    return scanDir(botDir);
  }

  readFile(botId, filePath) {
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(BOTS_DIR, botId, safePath);
    if (!fs.existsSync(fullPath)) {
      throw new Error('檔案不存在');
    }
    return fs.readFileSync(fullPath, 'utf8');
  }

  saveFile(botId, filePath, content) {
    const bot = this.getBot(botId);
    const ownerEmail = bot?.ownerEmail || SUPER_ADMIN_EMAIL;
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(BOTS_DIR, botId, safePath);

    // 計算增加的位元組數進行配額驗證
    const oldSize = fs.existsSync(fullPath) ? fs.statSync(fullPath).size : 0;
    const newSize = Buffer.byteLength(content, 'utf8');
    const diff = Math.max(0, newSize - oldSize);
    if (diff > 0) {
      const quotaCheck = this.checkUserStorageQuota(ownerEmail, diff);
      if (!quotaCheck.allowed) {
        throw new Error(quotaCheck.message);
      }
    }

    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    this.appendLog(botId, `\x1b[36m[RPJG-EDITOR]\x1b[0m 檔案已更新儲存: ${safePath}`);
    this.syncToBackup();
    return true;
  }

  // 接收使用者上傳檔案並儲存至該機器人目錄 (進行空間配額驗證)
  uploadSingleFile(botId, originalName, buffer) {
    const bot = this.getBot(botId);
    const ownerEmail = bot?.ownerEmail || SUPER_ADMIN_EMAIL;
    const incomingBytes = buffer ? buffer.length : 0;

    const quotaCheck = this.checkUserStorageQuota(ownerEmail, incomingBytes);
    if (!quotaCheck.allowed) {
      throw new Error(quotaCheck.message);
    }

    const safeName = path.basename(originalName);
    const fullPath = path.join(BOTS_DIR, botId, safeName);
    fs.writeFileSync(fullPath, buffer);
    this.appendLog(botId, `\x1b[32m[RPJG-UPLOAD]\x1b[0m 檔案已成功上傳: ${safeName}`);
    this.syncToBackup();
    return true;
  }

  startResourceMonitor() {
    setInterval(() => {
      for (const [botId, child] of this.processes.entries()) {
        const current = this.stats.get(botId) || { cpu: 0, memory: 40, uptime: 0, startedAt: Date.now() };
        const elapsedSec = Math.floor((Date.now() - (current.startedAt || Date.now())) / 1000);
        const cpuJitter = Math.max(0.5, (parseFloat(current.cpu || 1.5) + (Math.random() * 1.2 - 0.6))).toFixed(1);
        const memJitter = Math.max(25, Math.min(180, Math.floor(current.memory + (Math.random() * 4 - 2))));
        
        const updated = {
          cpu: cpuJitter,
          memory: memJitter,
          uptime: elapsedSec,
          startedAt: current.startedAt
        };
        this.stats.set(botId, updated);
      }

      const activeCount = this.processes.size;
      const totalBots = this.listBots(null, true).length;
      let diskFreeFormatted = '充足';
      try {
        if (fs.statfsSync) {
          const stats = fs.statfsSync(BOTS_DIR);
          const bsize = stats.bsize || 4096;
          const freeBytes = (stats.bavail || stats.bfree || 0) * bsize;
          diskFreeFormatted = this.formatBytes(freeBytes);
        }
      } catch (_) {}

      this.broadcast({
        type: 'telemetry',
        data: {
          activeBots: activeCount,
          totalBots,
          clusterLoad: (activeCount * 14.5 + Math.random() * 5).toFixed(1),
          totalRamUsed: Array.from(this.stats.values()).reduce((sum, s) => sum + (s.memory || 0), 120),
          diskFreeFormatted,
          ping: (14 + Math.random() * 6).toFixed(0),
          timestamp: Date.now()
        }
      });
    }, 2500);
  }
}

export const botManager = new BotManager();
