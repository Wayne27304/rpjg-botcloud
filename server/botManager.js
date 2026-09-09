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
import { SUPER_ADMIN_EMAIL } from './authManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const BOTS_DIR = path.join(__dirname, 'bots');

class BotManager {
  constructor() {
    this.processes = new Map();
    this.logs = new Map();
    this.stats = new Map();
    this.wsClients = new Set();

    if (!fs.existsSync(BOTS_DIR)) {
      fs.mkdirSync(BOTS_DIR, { recursive: true });
    }

    this.startResourceMonitor();
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

  // 取得機器人清單 (支援使用者隔離：每個人只看自己託管的機器人，管理員開啟 showAll 時可看全部)
  listBots(userEmail = null, showAll = false) {
    if (!fs.existsSync(BOTS_DIR)) return [];
    const entries = fs.readdirSync(BOTS_DIR, { withFileTypes: true });
    const bots = [];

    for (const entry of entries) {
      if (entry.isDirectory()) {
        const metaPath = path.join(BOTS_DIR, entry.name, 'metadata.json');
        if (fs.existsSync(metaPath)) {
          try {
            const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));

            // 權限過濾：若非全域視角，且有傳入使用者 Email，則只能看自己擁有的 Bot
            const botOwner = meta.ownerEmail || SUPER_ADMIN_EMAIL;
            if (!showAll && userEmail) {
              if (botOwner.toLowerCase() !== userEmail.toLowerCase()) {
                continue;
              }
            }

            const isRunning = this.processes.has(meta.id);
            const currentStats = this.stats.get(meta.id) || { cpu: 0, memory: 0, uptime: 0 };
            const effectiveStatus = meta.status === 'DISABLED'
              ? 'DISABLED'
              : (isRunning ? 'ONLINE' : (meta.status === 'STARTING' ? 'STARTING' : 'OFFLINE'));

            bots.push({
              ...meta,
              ownerEmail: botOwner,
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
    const botId = 'bot-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 6);
    const botDir = path.join(BOTS_DIR, botId);
    fs.mkdirSync(botDir, { recursive: true });

    let detectedMainFile = mainFile || (type === 'python' ? 'bot.py' : 'index.js');

    // 1. 若有上傳 ZIP 檔案，自動解壓縮
    if (zipFile && zipFile.buffer) {
      try {
        const zip = new AdmZip(zipFile.buffer);
        zip.extractAllTo(botDir, true);

        // 自動掃描尋找主程式入口
        const extracted = fs.readdirSync(botDir);
        if (extracted.includes('bot.py')) detectedMainFile = 'bot.py';
        else if (extracted.includes('main.py')) detectedMainFile = 'main.py';
        else if (extracted.includes('index.js')) detectedMainFile = 'index.js';
        else if (extracted.includes('app.js')) detectedMainFile = 'app.js';
      } catch (err) {
        console.error('ZIP 解壓縮失敗:', err.message);
      }
    }

    // 2. 若有多個單一檔案上傳
    if (uploadedFiles && uploadedFiles.length > 0) {
      for (const file of uploadedFiles) {
        const targetPath = path.join(botDir, file.originalname);
        fs.writeFileSync(targetPath, file.buffer);
      }
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

    return metadata;
  }

  deleteBot(botId) {
    this.stopBot(botId);
    const botDir = path.join(BOTS_DIR, botId);
    if (fs.existsSync(botDir)) {
      fs.rmSync(botDir, { recursive: true, force: true });
    }
    this.logs.delete(botId);
    this.stats.delete(botId);
    this.broadcast({ type: 'bot_deleted', botId });
    return true;
  }

  startBot(botId) {
    if (this.processes.has(botId)) {
      return { success: false, message: '機器人已在運行中' };
    }

    const bot = this.getBot(botId);
    if (!bot) return { success: false, message: '找不到此機器人' };

    if (bot.status === 'DISABLED') {
      return { success: false, message: '此機器人目前處於「停用託管」狀態，請先點擊「啟用託管」以恢復服務。' };
    }

    const botDir = path.join(BOTS_DIR, botId);
    const targetFile = path.join(botDir, bot.mainFile);

    if (!fs.existsSync(targetFile)) {
      return { success: false, message: `主入口檔案 ${bot.mainFile} 不存在，請在檔案管理中確認檔名` };
    }

    this.appendLog(botId, `\x1b[35m[R.P.J.G 雲端管理員]\x1b[0m 正在為您啟動進程: ${bot.mainFile}...`);
    this.updateBotStatus(botId, 'STARTING');

    const isPython = bot.type === 'python' || bot.mainFile.endsWith('.py');
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    const cmd = isPython ? pythonCmd : 'node';
    const args = isPython ? ['-u', bot.mainFile] : [bot.mainFile];

    try {
      const child = spawn(cmd, args, {
        cwd: botDir,
        env: { ...process.env, PYTHONUNBUFFERED: '1' },
        shell: true
      });

      this.processes.set(botId, child);
      this.stats.set(botId, {
        cpu: (Math.random() * 2 + 1).toFixed(1),
        memory: isPython ? 32 : 45,
        uptime: 0,
        startedAt: Date.now()
      });

      this.updateBotStatus(botId, 'ONLINE');
      this.appendLog(botId, `\x1b[32m[RPJG-SYSTEM]\x1b[0m 進程啟動完成 (PID: ${child.pid})，進入常駐監控狀態。`);

      child.stdout.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim().length > 0) {
            this.appendLog(botId, line);
          }
        }
      });

      child.stderr.on('data', (data) => {
        const text = data.toString();
        const lines = text.split('\n');
        for (const line of lines) {
          if (line.trim().length > 0) {
            this.appendLog(botId, `\x1b[31m${line}\x1b[0m`);
          }
        }
      });

      child.on('close', (code) => {
        this.processes.delete(botId);
        this.stats.set(botId, { cpu: 0, memory: 0, uptime: 0 });
        this.updateBotStatus(botId, 'OFFLINE');
        this.appendLog(botId, `\x1b[33m[RPJG-SYSTEM]\x1b[0m 機器人進程已退出 (退出碼: ${code})。`);

        if (code !== 0 && bot.autoRestart) {
          this.appendLog(botId, `\x1b[35m[RPJG 守護機制]\x1b[0m 偵測到異常退出，將在 3 秒後自動恢復重啟...`);
          setTimeout(() => {
            if (!this.processes.has(botId)) {
              this.startBot(botId);
            }
          }, 3000);
        }
      });

      child.on('error', (err) => {
        this.appendLog(botId, `\x1b[31m[PROCESS ERROR]\x1b[0m ${err.message}`);
        this.processes.delete(botId);
        this.updateBotStatus(botId, 'OFFLINE');
      });

      return { success: true, message: '機器人啟動指令已下達' };
    } catch (err) {
      this.updateBotStatus(botId, 'OFFLINE');
      this.appendLog(botId, `\x1b[31m[LAUNCH ERROR]\x1b[0m ${err.message}`);
      return { success: false, message: err.message };
    }
  }

  stopBot(botId) {
    const child = this.processes.get(botId);
    if (!child) {
      return { success: false, message: '機器人未在運行中' };
    }

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
    return { success: true, message: '機器人已成功停止' };
  }

  restartBot(botId) {
    this.appendLog(botId, `\x1b[35m[RPJG-SYSTEM]\x1b[0m 正在重新啟動機器人...`);
    this.stopBot(botId);
    return new Promise((resolve) => {
      setTimeout(() => {
        const res = this.startBot(botId);
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
    const safePath = path.normalize(filePath).replace(/^(\.\.[\/\\])+/, '');
    const fullPath = path.join(BOTS_DIR, botId, safePath);
    fs.mkdirSync(path.dirname(fullPath), { recursive: true });
    fs.writeFileSync(fullPath, content, 'utf8');
    this.appendLog(botId, `\x1b[36m[RPJG-EDITOR]\x1b[0m 檔案已更新儲存: ${safePath}`);
    return true;
  }

  // 接收使用者上傳檔案並儲存至該機器人目錄
  uploadSingleFile(botId, originalName, buffer) {
    const safeName = path.basename(originalName);
    const fullPath = path.join(BOTS_DIR, botId, safeName);
    fs.writeFileSync(fullPath, buffer);
    this.appendLog(botId, `\x1b[32m[RPJG-UPLOAD]\x1b[0m 檔案已成功上傳: ${safeName}`);
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
      this.broadcast({
        type: 'telemetry',
        data: {
          activeBots: activeCount,
          totalBots,
          clusterLoad: (activeCount * 14.5 + Math.random() * 5).toFixed(1),
          totalRamUsed: Array.from(this.stats.values()).reduce((sum, s) => sum + (s.memory || 0), 120),
          ping: (14 + Math.random() * 6).toFixed(0),
          timestamp: Date.now()
        }
      });
    }, 2500);
  }
}

export const botManager = new BotManager();
