/**
 * ================================================================
 * RPJG BotCloud - 全域操作審計與遠端監控日誌 (Audit Logger)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const AUDIT_LOG_FILE = path.join(DATA_DIR, 'audit_logs.json');
const MAX_LOGS = 500;

class AuditLogger {
  constructor() {
    this.logs = [];
    this.initLogs();
  }

  initLogs() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (fs.existsSync(AUDIT_LOG_FILE)) {
      try {
        const raw = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
        this.logs = JSON.parse(raw);
        if (!Array.isArray(this.logs)) this.logs = [];
      } catch (e) {
        this.logs = [];
      }
    }
  }

  save() {
    try {
      if (this.logs.length > MAX_LOGS) {
        this.logs = this.logs.slice(-MAX_LOGS);
      }
      fs.writeFileSync(AUDIT_LOG_FILE, JSON.stringify(this.logs, null, 2), 'utf8');
    } catch (e) {
      console.error('[AUDIT] 儲存審計日誌失敗:', e.message);
    }
  }

  /**
   * 記錄一筆操作事件
   * @param {string} actor - 操作人 Email
   * @param {string} action - 動作 (例如: CREATE_RESELLER, CREATE_USER, UPDATE_QUOTA, BOT_START, BOT_STOP)
   * @param {string} target - 操作對象 (目標 Email 或 Bot ID)
   * @param {object|string} details - 詳細備註或異動數值
   */
  log(actor, action, target, details = {}) {
    const entry = {
      id: 'audit-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      timestamp: new Date().toISOString(),
      actor: (actor || 'SYSTEM').toLowerCase(),
      action,
      target: target || 'N/A',
      details: typeof details === 'string' ? { message: details } : details
    };

    this.logs.unshift(entry); // 最新放在最前
    this.save();
    console.log(`[RPJG-AUDIT] [${entry.action}] 由 ${entry.actor} 針對 ${entry.target} 執行`);
    return entry;
  }

  /**
   * 查詢審計日誌
   */
  query({ limit = 100, actor, action, target, search } = {}) {
    let result = [...this.logs];

    if (actor) {
      result = result.filter(l => l.actor.includes(actor.toLowerCase()));
    }
    if (action) {
      result = result.filter(l => l.action.toLowerCase() === action.toLowerCase());
    }
    if (target) {
      result = result.filter(l => l.target.toLowerCase().includes(target.toLowerCase()));
    }
    if (search) {
      const q = search.toLowerCase();
      result = result.filter(l =>
        l.actor.includes(q) ||
        l.action.toLowerCase().includes(q) ||
        l.target.toLowerCase().includes(q) ||
        JSON.stringify(l.details).toLowerCase().includes(q)
      );
    }

    return result.slice(0, Math.min(MAX_LOGS, parseInt(limit) || 100));
  }
}

export const auditLogger = new AuditLogger();
