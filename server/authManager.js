/**
 * ================================================================
 * RPJG BotCloud - 認證與授權管理中心 (Auth & License Manager)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const SECRET_KEY = 'RPJG_SECRET_KEY_' + (process.env.JWT_SECRET || 'rpjg_super_auth_token_secret_2026');

export const SUPER_ADMIN_EMAIL = 'ryanryan311311@gmail.com';

class AuthManager {
  constructor() {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    this.initUsers();
  }

  initUsers() {
    if (!fs.existsSync(USERS_FILE)) {
      const initialUsers = [
        {
          id: 'admin-01',
          email: SUPER_ADMIN_EMAIL,
          passwordHash: this.hashPassword('Hh126702249'),
          plainPasswordHint: 'Hh126702249', // 便於初始管理與展示
          role: 'SUPER_ADMIN',
          displayName: 'Ryan (最高主管)',
          status: 'ACTIVE',
          expiresAt: null, // 永久授權
          maxBots: 50,
          createdAt: new Date().toISOString(),
          note: '系統最高管理者 (R.P.J.G 總管)'
        }
      ];
      this.saveUsers(initialUsers);
    } else {
      // 確保最高主管帳號必然存在
      const users = this.getUsers();
      const adminExists = users.some(u => u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase());
      if (!adminExists) {
        users.unshift({
          id: 'admin-01',
          email: SUPER_ADMIN_EMAIL,
          passwordHash: this.hashPassword('Hh126702249'),
          plainPasswordHint: 'Hh126702249',
          role: 'SUPER_ADMIN',
          displayName: 'Ryan (最高主管)',
          status: 'ACTIVE',
          expiresAt: null,
          maxBots: 50,
          createdAt: new Date().toISOString(),
          note: '系統最高管理者 (R.P.J.G 總管)'
        });
        this.saveUsers(users);
      }
    }
  }

  getUsers() {
    try {
      if (!fs.existsSync(USERS_FILE)) return [];
      const data = fs.readFileSync(USERS_FILE, 'utf8');
      return JSON.parse(data);
    } catch (e) {
      console.error('讀取使用者檔案失敗:', e.message);
      return [];
    }
  }

  saveUsers(users) {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
  }

  hashPassword(password) {
    return crypto.createHash('sha256').update(password + '_RPJG_SALT_2026').digest('hex');
  }

  // 簽發安全 Token
  generateToken(user) {
    const payload = {
      email: user.email,
      role: user.role,
      issuedAt: Date.now()
    };
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signature = crypto.createHmac('sha256', SECRET_KEY).update(payloadBase64).digest('base64url');
    return `${payloadBase64}.${signature}`;
  }

  // 驗證 Token
  verifyToken(token) {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadBase64, signature] = parts;
    const expectedSig = crypto.createHmac('sha256', SECRET_KEY).update(payloadBase64).digest('base64url');
    if (signature !== expectedSig) return null;

    try {
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64url').toString('utf8'));
      // 驗證使用者當前狀態與效期
      const users = this.getUsers();
      const user = users.find(u => u.email.toLowerCase() === payload.email.toLowerCase());
      if (!user) return null;

      if (user.status !== 'ACTIVE') return null;

      // 檢查是否過期
      if (user.expiresAt && Date.now() > new Date(user.expiresAt).getTime()) {
        return null;
      }

      return user;
    } catch (e) {
      return null;
    }
  }

  // 登入驗證
  login(email, password) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);

    if (!user) {
      return { success: false, message: '查無此帳號，請確認 Email 是否已被管理員授權' };
    }

    if (user.passwordHash !== this.hashPassword(password)) {
      return { success: false, message: '密碼錯誤，請重新輸入' };
    }

    if (user.status === 'SUSPENDED') {
      return { success: false, message: '您的帳號已被管理員暫時凍結，請聯絡 ryanryan311311@gmail.com' };
    }

    // 檢查授權期限
    if (user.expiresAt) {
      const expireTime = new Date(user.expiresAt).getTime();
      if (Date.now() > expireTime) {
        const formattedDate = new Date(user.expiresAt).toLocaleString('zh-TW');
        return {
          success: false,
          message: `您的帳號授權已於 ${formattedDate} 到期！請聯絡管理員 (ryanryan311311@gmail.com) 續期。`
        };
      }
    }

    const token = this.generateToken(user);

    return {
      success: true,
      token,
      user: {
        email: user.email,
        role: user.role,
        displayName: user.displayName || user.email.split('@')[0],
        expiresAt: user.expiresAt,
        maxBots: user.maxBots || 5,
        isSuperAdmin: user.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      }
    };
  }

  // 管理員授權新 Gmail 帳號
  authorizeUser({ email, password, durationType, customDays, maxBots, note, displayName }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, message: '請提供有效的 Gmail / Email 地址' };
    }

    const users = this.getUsers();
    let expiresAt = null;
    const now = Date.now();

    if (durationType === '1d') {
      expiresAt = new Date(now + 24 * 60 * 60 * 1000).toISOString();
    } else if (durationType === '7d') {
      expiresAt = new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString();
    } else if (durationType === '30d') {
      expiresAt = new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString();
    } else if (durationType === 'custom') {
      const days = parseInt(customDays) || 1;
      expiresAt = new Date(now + days * 24 * 60 * 60 * 1000).toISOString();
    } else {
      expiresAt = null; // 永久授權
    }

    const existingIndex = users.findIndex(u => u.email.toLowerCase() === cleanEmail);
    const pwd = password || ('rpjg_' + Math.random().toString(36).substring(2, 8));

    if (existingIndex >= 0) {
      // 更新現有帳號
      users[existingIndex].passwordHash = this.hashPassword(pwd);
      users[existingIndex].plainPasswordHint = pwd;
      users[existingIndex].expiresAt = expiresAt;
      users[existingIndex].status = 'ACTIVE';
      users[existingIndex].maxBots = parseInt(maxBots) || 5;
      users[existingIndex].note = note || users[existingIndex].note;
      if (displayName) users[existingIndex].displayName = displayName;
    } else {
      // 建立新授權
      users.push({
        id: 'usr-' + Date.now().toString(36),
        email: cleanEmail,
        passwordHash: this.hashPassword(pwd),
        plainPasswordHint: pwd,
        role: 'USER',
        displayName: displayName || cleanEmail.split('@')[0],
        status: 'ACTIVE',
        expiresAt,
        maxBots: parseInt(maxBots) || 5,
        createdAt: new Date().toISOString(),
        note: note || '經由管理員手動授權'
      });
    }

    this.saveUsers(users);
    return {
      success: true,
      message: `已成功授權帳號 ${cleanEmail}`,
      generatedPassword: pwd,
      expiresAt
    };
  }

  // 延長授權天數
  extendUser(email, days) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: '查無此帳號' };

    if (days === 'permanent') {
      user.expiresAt = null;
    } else {
      const numDays = parseInt(days) || 30;
      const baseTime = user.expiresAt && new Date(user.expiresAt).getTime() > Date.now()
        ? new Date(user.expiresAt).getTime()
        : Date.now();
      user.expiresAt = new Date(baseTime + numDays * 24 * 60 * 60 * 1000).toISOString();
    }

    user.status = 'ACTIVE';
    this.saveUsers(users);
    return { success: true, message: `已更新授權期限`, expiresAt: user.expiresAt };
  }

  // 切換帳號啟用/凍結
  toggleUserStatus(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { success: false, message: '無法凍結最高管理員帳號' };
    }
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: '查無此帳號' };

    user.status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.saveUsers(users);
    return { success: true, status: user.status };
  }

  // 刪除使用者
  deleteUser(email) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { success: false, message: '無法刪除最高管理員帳號' };
    }
    let users = this.getUsers();
    users = users.filter(u => u.email.toLowerCase() !== cleanEmail);
    this.saveUsers(users);
    return { success: true, message: `已移除帳號 ${cleanEmail}` };
  }

  // 取得所有使用者列表 (提供給授權中心)
  listUsers() {
    const users = this.getUsers();
    return users.map(u => {
      let isExpired = false;
      let remainingDays = null;
      let remainingText = '永久有效';

      if (u.expiresAt) {
        const diffMs = new Date(u.expiresAt).getTime() - Date.now();
        if (diffMs <= 0) {
          isExpired = true;
          remainingText = '已到期';
        } else {
          const days = Math.floor(diffMs / (24 * 3600 * 1000));
          const hours = Math.floor((diffMs % (24 * 3600 * 1000)) / (3600 * 1000));
          remainingDays = days;
          remainingText = days > 0 ? `${days}天 ${hours}小時` : `${hours}小時`;
        }
      }

      return {
        id: u.id,
        email: u.email,
        role: u.role,
        displayName: u.displayName,
        status: u.status,
        expiresAt: u.expiresAt,
        isExpired,
        remainingText,
        plainPasswordHint: u.plainPasswordHint,
        maxBots: u.maxBots || 5,
        note: u.note || '',
        createdAt: u.createdAt,
        isSuperAdmin: u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      };
    });
  }
}

export const authManager = new AuthManager();
