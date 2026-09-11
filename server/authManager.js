/**
 * ================================================================
 * RPJG BotCloud - 認證與授權管理中心 (Auth & License Manager)
 * 整合 Supabase 雲端資料庫 + Render 環境變數雙重永續保存
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });
import { mailerService } from './mailer.js';
import { auditLogger } from './auditLogger.js';

const DATA_DIR = path.join(__dirname, 'data');
const USERS_FILE = path.join(DATA_DIR, 'users.json');

const SECRET_KEY = 'RPJG_SECRET_KEY_' + (process.env.JWT_SECRET || 'rpjg_super_auth_token_secret_2026');

export const SUPER_ADMIN_EMAIL = 'ryanryan311311@gmail.com';

class AuthManager {
  constructor() {
    this.usersCache = [];
    this.supabase = null;
    this.isCloudActive = false;

    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }

    this.initSupabase();
    this.initUsers();
  }

  // 初始化 Supabase 雲端客戶端
  initSupabase() {
    const supabaseUrl = (process.env.SUPABASE_URL || '').trim();
    const supabaseKey = (process.env.SUPABASE_KEY || process.env.SUPABASE_SERVICE_KEY || '').trim();

    if (supabaseUrl && supabaseKey && supabaseUrl.startsWith('http')) {
      try {
        this.supabase = createClient(supabaseUrl, supabaseKey, {
          auth: { persistSession: false }
        });
        this.isCloudActive = true;
        console.log(`[CLOUD] 🟢 成功連接 Supabase 雲端永久資料庫: ${supabaseUrl}`);
      } catch (err) {
        console.error('[CLOUD] 🔴 Supabase 客戶端建立失敗:', err.message);
        this.supabase = null;
        this.isCloudActive = false;
      }
    } else {
      console.log('[STORAGE] 🟡 本機模式：未檢測到 SUPABASE_URL，使用本機與環境變數永續模式');
    }
  }

  // 初始化本機快取與 Render 環境變數備份
  initUsers() {
    let users = [];

    // 1. 嘗試從本機 users.json 載入
    if (fs.existsSync(USERS_FILE)) {
      try {
        const data = fs.readFileSync(USERS_FILE, 'utf8');
        users = JSON.parse(data);
      } catch (e) {
        console.error('讀取本機 users.json 失敗:', e.message);
        users = [];
      }
    }

    // 2. 檢查是否有 Render 環境變數 RPJG_USERS_BACKUP (第二重保護)
    const backupEnv = process.env.RPJG_USERS_BACKUP;
    if (backupEnv && backupEnv.trim()) {
      try {
        let parsed = null;
        try {
          // 先嘗試 Base64 解碼
          const decoded = Buffer.from(backupEnv.trim(), 'base64').toString('utf8');
          parsed = JSON.parse(decoded);
        } catch (_) {
          // 若非 Base64 則嘗試直接 JSON 解析
          parsed = JSON.parse(backupEnv.trim());
        }

        if (Array.isArray(parsed) && parsed.length > 0) {
          console.log(`[BACKUP-ENV] 📦 從 RPJG_USERS_BACKUP 環境變數還原了 ${parsed.length} 個帳號！`);
          for (const bUser of parsed) {
            if (!bUser || !bUser.email) continue;
            const idx = users.findIndex(u => u.email.toLowerCase() === bUser.email.toLowerCase());
            if (idx >= 0) {
              users[idx] = { ...users[idx], ...bUser };
            } else {
              users.push(bUser);
            }
          }
        }
      } catch (err) {
        console.warn('[BACKUP-ENV] 解析 RPJG_USERS_BACKUP 失敗:', err.message);
      }
    }

    // 3. 確保最高主管帳號必然存在
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
        expiresAt: null, // 永久授權
        maxBots: 50,
        maxStorageMB: 10240, // 10GB
        createdAt: new Date().toISOString(),
        note: '系統最高管理者 (R.P.J.G 總管)'
      });
    }

    // 確保所有使用者都有 maxStorageMB 欄位 (預設 100MB，總管 10240MB)
    for (const u of users) {
      if (!u.maxStorageMB) {
        u.maxStorageMB = u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 10240 : 100;
      }
    }

    this.usersCache = users;
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
      console.error('寫入 users.json 失敗:', e.message);
    }
  }

  // 伺服器啟動時從 Supabase 雲端資料庫非同步拉取 (第一重保護)
  async initCloud() {
    if (!this.supabase || !this.isCloudActive) return;

    try {
      console.log('[CLOUD] 正在同步 Supabase 雲端資料庫授權名冊...');
      const { data, error } = await this.supabase
        .from('rpjg_bot_users')
        .select('*');

      if (error) {
        console.warn(`[CLOUD] ⚠️ 讀取 Supabase 資料表失敗: ${error.message} (如為初次使用，請在 Supabase SQL Editor 執行 supabase_bot_schema.sql)`);
        return;
      }

      if (data && Array.isArray(data)) {
        if (data.length > 0) {
          console.log(`[CLOUD] 🟢 成功自 Supabase 雲端載入 ${data.length} 筆授權資料！`);
          
          // 將 Supabase 資料庫欄位對齊至本機記憶體
          for (const row of data) {
            const userObj = {
              id: row.id,
              email: (row.email || '').toLowerCase(),
              passwordHash: row.password_hash,
              plainPasswordHint: row.plain_password_hint,
              role: row.role || 'USER',
              displayName: row.display_name || row.email.split('@')[0],
              status: row.status || 'ACTIVE',
              expiresAt: row.expires_at || null,
              maxBots: row.max_bots || 5,
              maxStorageMB: row.max_storage_mb || (row.role === 'SUPER_ADMIN' ? 10240 : 100),
              note: row.note || '',
              createdAt: row.created_at || new Date().toISOString()
            };

            const idx = this.usersCache.findIndex(u => u.email.toLowerCase() === userObj.email);
            if (idx >= 0) {
              this.usersCache[idx] = { ...this.usersCache[idx], ...userObj };
            } else {
              this.usersCache.push(userObj);
            }
          }

          // 重新寫入本機檔案
          this.saveLocalUsers(this.usersCache);
        } else {
          // 雲端資料庫為空，將現有本機使用者自動同步至雲端
          console.log(`[CLOUD] Supabase 資料表目前為空，正在將現有本機 ${this.usersCache.length} 筆資料同步至雲端...`);
          for (const user of this.usersCache) {
            await this.syncUserToCloud(user);
          }
        }
      }
    } catch (e) {
      console.error('[CLOUD] 雲端資料庫初始化例外:', e.message);
    }
  }

  // 取得使用者快取清單
  getUsers() {
    if (!this.usersCache || this.usersCache.length === 0) {
      this.initUsers();
    }
    return this.usersCache;
  }

  // 本機寫入
  saveLocalUsers(users) {
    this.usersCache = users;
    try {
      fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), 'utf8');
    } catch (e) {
      console.error('寫入 users.json 失敗:', e.message);
    }
  }

  // 儲存所有使用者（同步本機 + 非同步同步雲端）
  saveUsers(users) {
    this.saveLocalUsers(users);
  }

  // 單一使用者同步至 Supabase (具備欄位自動降級防護)
  async syncUserToCloud(user) {
    if (!this.supabase || !this.isCloudActive) return;

    try {
      const payload = {
        id: user.id,
        email: user.email.toLowerCase(),
        password_hash: user.passwordHash,
        plain_password_hint: user.plainPasswordHint || '',
        role: user.role || 'USER',
        display_name: user.displayName || user.email.split('@')[0],
        status: user.status || 'ACTIVE',
        expires_at: user.expiresAt || null,
        max_bots: user.maxBots || 5,
        max_storage_mb: user.maxStorageMB || (user.role === 'SUPER_ADMIN' ? 10240 : 100),
        note: user.note || '',
        created_at: user.createdAt || new Date().toISOString(),
        updated_at: new Date().toISOString()
      };

      let { error } = await this.supabase
        .from('rpjg_bot_users')
        .upsert(payload, { onConflict: 'email' });

      // 若 Supabase 還沒新增 max_storage_mb 欄位，自動移除欄位降級寫入
      if (error && error.message && error.message.includes('max_storage_mb')) {
        delete payload.max_storage_mb;
        const retry = await this.supabase
          .from('rpjg_bot_users')
          .upsert(payload, { onConflict: 'email' });
        error = retry.error;
      }

      if (error) {
        console.error(`[CLOUD] ⚠️ 同步使用者 ${user.email} 至 Supabase 失敗:`, error.message);
      } else {
        console.log(`[CLOUD] ✅ 帳號 ${user.email} 已成功永久保存至 Supabase 雲端！`);
      }
    } catch (err) {
      console.error(`[CLOUD] 同步至雲端異常:`, err.message);
    }
  }

  // 從 Supabase 刪除使用者
  async deleteUserFromCloud(email) {
    if (!this.supabase || !this.isCloudActive) return;

    try {
      const { error } = await this.supabase
        .from('rpjg_bot_users')
        .delete()
        .eq('email', email.toLowerCase());

      if (error) {
        console.error(`[CLOUD] ⚠️ 從 Supabase 刪除 ${email} 失敗:`, error.message);
      } else {
        console.log(`[CLOUD] ✅ 已從 Supabase 雲端移除帳號 ${email}`);
      }
    } catch (err) {
      console.error(`[CLOUD] 從雲端刪除異常:`, err.message);
    }
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
    let cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail) {
      return { success: false, message: '請輸入 Email 帳號' };
    }

    const users = this.getUsers();
    let user = users.find(u => u.email.toLowerCase() === cleanEmail);

    // 如果使用者只輸入了帳號前綴沒打 @gmail.com，自動相容
    if (!user && !cleanEmail.includes('@')) {
      const withGmail = cleanEmail + '@gmail.com';
      user = users.find(u => u.email.toLowerCase() === withGmail);
      if (user) {
        cleanEmail = withGmail;
      }
    }

    if (!user) {
      return {
        success: false,
        message: `查無授權帳號「${email}」！請確認輸入的 Email 是否與管理員授權的一致。`
      };
    }

    // 密碼比對：支援原始密碼、前後去空格、明文提示比對
    const rawPwd = password || '';
    const trimmedPwd = rawPwd.trim();
    const isMatch = (user.passwordHash === this.hashPassword(rawPwd)) ||
                    (user.passwordHash === this.hashPassword(trimmedPwd)) ||
                    (user.plainPasswordHint && (user.plainPasswordHint === rawPwd || user.plainPasswordHint === trimmedPwd));

    if (!isMatch) {
      return {
        success: false,
        message: '密碼錯誤！請輸入管理員簽發給您的專屬授權密碼（注意大小寫與勿多按空格）。'
      };
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

  // 根據 Email 獲取單一使用者
  getUser(email) {
    if (!email) return null;
    const cleanEmail = email.trim().toLowerCase();
    const users = this.getUsers();
    return users.find(u => u.email.toLowerCase() === cleanEmail) || null;
  }

  // 管理員或代理商授權 Gmail 帳號 (包含派發空間、代理商配額與郵件發送)
  authorizeUser({
    email,
    password,
    durationType,
    customDays,
    maxBots,
    maxStorageMB,
    note,
    displayName,
    role = 'USER',
    resellerQuotaMB,
    resellerMaxBots,
    resellerMaxUsers,
    creatorUser = null
  }) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (!cleanEmail.includes('@')) {
      return { success: false, message: '請提供有效的 Gmail / Email 地址' };
    }

    const users = [...this.getUsers()];
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
    const storageQuotaMB = Math.max(10, parseInt(maxStorageMB) || 100);
    const requestedBots = Math.max(1, parseInt(maxBots) || 5);
    let targetUser = null;

    // 檢查操作者是否為經銷代理商 (RESELLER)
    const isActorReseller = creatorUser && creatorUser.role === 'RESELLER';
    let parentResellerEmail = null;

    if (isActorReseller) {
      // 代理商只能建立普通客戶 (USER)
      if (role === 'RESELLER') {
        return { success: false, message: '代理商無法再建立二級代理商，僅最高主管可指派代理商！' };
      }

      // 檢查代理商本身配額
      const subUsers = users.filter(u =>
        (u.parentResellerEmail || '').toLowerCase() === creatorUser.email.toLowerCase() &&
        u.email.toLowerCase() !== cleanEmail
      );
      const allocatedStorage = subUsers.reduce((s, u) => s + (u.maxStorageMB || 0), 0);
      const allocatedBots = subUsers.reduce((s, u) => s + (u.maxBots || 0), 0);
      const maxResellerQuota = creatorUser.resellerQuotaMB || 1000;
      const maxResellerBots = creatorUser.resellerMaxBots || 10;
      const maxResellerUsers = creatorUser.resellerMaxUsers || 10;

      if (subUsers.length + 1 > maxResellerUsers) {
        return {
          success: false,
          message: `已超出您的代理客戶數量上限 (上限 ${maxResellerUsers} 位)！請聯絡最高主管擴充。`
        };
      }
      if (allocatedStorage + storageQuotaMB > maxResellerQuota) {
        return {
          success: false,
          message: `代理空間配額不足！您總配額 ${maxResellerQuota} MB，目前已派發 ${allocatedStorage} MB，剩餘可用 ${Math.max(0, maxResellerQuota - allocatedStorage)} MB，欲派發 ${storageQuotaMB} MB 超出上限！`
        };
      }
      if (allocatedBots + requestedBots > maxResellerBots) {
        return {
          success: false,
          message: `代理機器人配額不足！您總配額 ${maxResellerBots} 台，已派發 ${allocatedBots} 台，剩餘可用 ${Math.max(0, maxResellerBots - allocatedBots)} 台！`
        };
      }

      parentResellerEmail = creatorUser.email.toLowerCase();
    }

    const assignedRole = (isActorReseller || role !== 'RESELLER') ? 'USER' : 'RESELLER';

    if (existingIndex >= 0) {
      users[existingIndex].passwordHash = this.hashPassword(pwd);
      users[existingIndex].plainPasswordHint = pwd;
      users[existingIndex].expiresAt = expiresAt;
      users[existingIndex].status = 'ACTIVE';
      users[existingIndex].maxBots = requestedBots;
      users[existingIndex].maxStorageMB = storageQuotaMB;
      users[existingIndex].note = note || users[existingIndex].note;
      if (displayName) users[existingIndex].displayName = displayName;
      if (parentResellerEmail) users[existingIndex].parentResellerEmail = parentResellerEmail;

      if (assignedRole === 'RESELLER') {
        users[existingIndex].role = 'RESELLER';
        users[existingIndex].resellerQuotaMB = Math.max(100, parseInt(resellerQuotaMB) || 5000);
        users[existingIndex].resellerMaxBots = Math.max(1, parseInt(resellerMaxBots) || 20);
        users[existingIndex].resellerMaxUsers = Math.max(1, parseInt(resellerMaxUsers) || 10);
      }

      targetUser = users[existingIndex];
    } else {
      targetUser = {
        id: 'usr-' + Date.now().toString(36),
        email: cleanEmail,
        passwordHash: this.hashPassword(pwd),
        plainPasswordHint: pwd,
        role: assignedRole,
        parentResellerEmail: parentResellerEmail || null,
        displayName: displayName || cleanEmail.split('@')[0],
        status: 'ACTIVE',
        expiresAt,
        maxBots: requestedBots,
        maxStorageMB: storageQuotaMB,
        createdAt: new Date().toISOString(),
        note: note || (isActorReseller ? `由代理商 ${creatorUser.email} 開通` : '經由最高主管手動授權'),
        resellerQuotaMB: assignedRole === 'RESELLER' ? Math.max(100, parseInt(resellerQuotaMB) || 5000) : 0,
        resellerMaxBots: assignedRole === 'RESELLER' ? Math.max(1, parseInt(resellerMaxBots) || 20) : 0,
        resellerMaxUsers: assignedRole === 'RESELLER' ? Math.max(1, parseInt(resellerMaxUsers) || 10) : 0
      };
      users.push(targetUser);
    }

    this.saveUsers(users);
    this.syncUserToCloud(targetUser);

    // 審計日誌記錄
    auditLogger.log(
      creatorUser?.email || SUPER_ADMIN_EMAIL,
      existingIndex >= 0 ? 'UPDATE_AUTHORIZE' : (assignedRole === 'RESELLER' ? 'CREATE_RESELLER' : 'CREATE_USER'),
      cleanEmail,
      {
        role: assignedRole,
        maxStorageMB: assignedRole === 'RESELLER' ? targetUser.resellerQuotaMB : targetUser.maxStorageMB,
        maxBots: assignedRole === 'RESELLER' ? targetUser.resellerMaxBots : targetUser.maxBots,
        parentResellerEmail,
        expiresAt
      }
    );

    // 自動非同步寄發 Gmail 帳密與驗證通知信件
    mailerService.sendAccountCredentialsEmail({
      toEmail: cleanEmail,
      displayName: targetUser.displayName,
      plainPassword: pwd,
      role: assignedRole,
      maxStorageMB: assignedRole === 'RESELLER' ? targetUser.resellerQuotaMB : targetUser.maxStorageMB,
      maxBots: assignedRole === 'RESELLER' ? targetUser.resellerMaxBots : targetUser.maxBots,
      expiresAt,
      creatorEmail: creatorUser?.displayName ? `${creatorUser.displayName} (${creatorUser.email})` : (creatorUser?.email || '最高主管 (R.P.J.G)')
    }).catch(err => {
      console.error('[MAIL-SEND-BG] 背景發信例外:', err.message);
    });

    const isMailLive = mailerService.isConfigured();
    const mailTip = isMailLive
      ? '（開通信件已自動發送至該 Gmail）'
      : '（系統目前為模擬寄信模式，請將密碼告知對方）';

    return {
      success: true,
      message: `已成功開通帳號 ${cleanEmail} (身分: ${assignedRole === 'RESELLER' ? '經銷代理商' : '買家客戶'})！${mailTip}`,
      generatedPassword: pwd,
      expiresAt,
      role: assignedRole,
      maxStorageMB: assignedRole === 'RESELLER' ? targetUser.resellerQuotaMB : targetUser.maxStorageMB,
      emailConfigured: isMailLive
    };
  }

  // 取得特定代理商之配額總覽與旗下客戶列表
  getResellerOverview(resellerEmail) {
    const cleanEmail = (resellerEmail || '').trim().toLowerCase();
    const users = this.getUsers();
    const reseller = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!reseller) return null;

    const subUsers = users.filter(u => (u.parentResellerEmail || '').toLowerCase() === cleanEmail);
    const allocatedStorageMB = subUsers.reduce((sum, u) => sum + (u.maxStorageMB || 0), 0);
    const allocatedBots = subUsers.reduce((sum, u) => sum + (u.maxBots || 0), 0);
    const maxQuotaMB = reseller.resellerQuotaMB || 1000;
    const maxBots = reseller.resellerMaxBots || 10;
    const maxUsers = reseller.resellerMaxUsers || 10;

    const pool = {
      totalQuotaMB: maxQuotaMB,
      allocatedQuotaMB: allocatedStorageMB,
      remainingQuotaMB: Math.max(0, maxQuotaMB - allocatedStorageMB),
      totalMaxBots: maxBots,
      allocatedBots,
      remainingBots: Math.max(0, maxBots - allocatedBots),
      totalMaxUsers: maxUsers,
      subUserCount: subUsers.length,
      remainingUsers: Math.max(0, maxUsers - subUsers.length)
    };

    return {
      reseller: {
        email: reseller.email,
        displayName: reseller.displayName,
        role: reseller.role,
        resellerQuotaMB: maxQuotaMB,
        resellerMaxBots: maxBots,
        resellerMaxUsers: maxUsers,
        allocatedStorageMB,
        remainingStorageMB: Math.max(0, maxQuotaMB - allocatedStorageMB),
        storageUsagePercent: maxQuotaMB > 0 ? +((allocatedStorageMB / maxQuotaMB) * 100).toFixed(1) : 0,
        allocatedBots,
        remainingBots: Math.max(0, maxBots - allocatedBots),
        subUserCount: subUsers.length,
        remainingUsers: Math.max(0, maxUsers - subUsers.length)
      },
      pool,
      subUsers: subUsers.map(u => ({
        id: u.id,
        email: u.email,
        displayName: u.displayName,
        status: u.status,
        expiresAt: u.expiresAt,
        maxBots: u.maxBots,
        maxStorageMB: u.maxStorageMB,
        note: u.note,
        createdAt: u.createdAt,
        plainPasswordHint: u.plainPasswordHint
      }))
    };
  }

  // 管理員或代理商調配空間配額與機器人限額
  updateUserQuota(email, { maxStorageMB, maxBots, resellerQuotaMB, resellerMaxBots, resellerMaxUsers }, actorUser = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = [...this.getUsers()];
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: '查無此帳號' };

    // 權限檢查：若為代理商調配，只能調配旗下客戶且不能超出代理商池
    const isSuperAdmin = actorUser && actorUser.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase();
    const isActorReseller = actorUser && actorUser.role === 'RESELLER';

    if (isActorReseller) {
      if ((user.parentResellerEmail || '').toLowerCase() !== actorUser.email.toLowerCase()) {
        return { success: false, message: '權限不足：您只能調配自己旗下的客戶配額！' };
      }

      const targetNewStorage = maxStorageMB !== undefined ? Math.max(10, parseInt(maxStorageMB) || 100) : user.maxStorageMB;
      const targetNewBots = maxBots !== undefined ? Math.max(1, parseInt(maxBots) || 5) : user.maxBots;

      const subUsers = users.filter(u =>
        (u.parentResellerEmail || '').toLowerCase() === actorUser.email.toLowerCase() &&
        u.email.toLowerCase() !== cleanEmail
      );
      const allocatedStorage = subUsers.reduce((s, u) => s + (u.maxStorageMB || 0), 0);
      const allocatedBots = subUsers.reduce((s, u) => s + (u.maxBots || 0), 0);
      const maxResellerQuota = actorUser.resellerQuotaMB || 1000;
      const maxResellerBots = actorUser.resellerMaxBots || 10;

      if (allocatedStorage + targetNewStorage > maxResellerQuota) {
        return { success: false, message: `調配超出代理配額上限！剩餘可用配額為 ${Math.max(0, maxResellerQuota - allocatedStorage)} MB` };
      }
      if (allocatedBots + targetNewBots > maxResellerBots) {
        return { success: false, message: `調配超出代理機器人上限！剩餘可用為 ${Math.max(0, maxResellerBots - allocatedBots)} 台` };
      }
    }

    if (maxStorageMB !== undefined) {
      user.maxStorageMB = Math.max(10, parseInt(maxStorageMB) || 100);
    }
    if (maxBots !== undefined) {
      user.maxBots = Math.max(1, parseInt(maxBots) || 5);
    }

    // 若為代理商自身配額調整 (僅最高主管可調整)
    if (isSuperAdmin && user.role === 'RESELLER') {
      if (resellerQuotaMB !== undefined) user.resellerQuotaMB = Math.max(100, parseInt(resellerQuotaMB) || 5000);
      if (resellerMaxBots !== undefined) user.resellerMaxBots = Math.max(1, parseInt(resellerMaxBots) || 20);
      if (resellerMaxUsers !== undefined) user.resellerMaxUsers = Math.max(1, parseInt(resellerMaxUsers) || 10);
    }

    this.saveUsers(users);
    this.syncUserToCloud(user);

    auditLogger.log(
      actorUser?.email || SUPER_ADMIN_EMAIL,
      'UPDATE_QUOTA',
      cleanEmail,
      { maxStorageMB: user.maxStorageMB, maxBots: user.maxBots, resellerQuotaMB: user.resellerQuotaMB }
    );

    return {
      success: true,
      message: `已成功調配 ${cleanEmail} 的空間配額為 ${user.maxStorageMB} MB，機器人上限為 ${user.maxBots} 台！`,
      user: {
        email: user.email,
        maxStorageMB: user.maxStorageMB,
        maxBots: user.maxBots,
        resellerQuotaMB: user.resellerQuotaMB
      }
    };
  }

  // 延長授權天數
  extendUser(email, days, actorUser = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    const users = [...this.getUsers()];
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: '查無此帳號' };

    // 代理商只能延長自己客戶
    if (actorUser && actorUser.role === 'RESELLER') {
      if ((user.parentResellerEmail || '').toLowerCase() !== actorUser.email.toLowerCase()) {
        return { success: false, message: '權限不足：您只能延長自己旗下客戶的授權期限！' };
      }
    }

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
    this.syncUserToCloud(user);

    auditLogger.log(
      actorUser?.email || SUPER_ADMIN_EMAIL,
      'EXTEND_USER',
      cleanEmail,
      { days, expiresAt: user.expiresAt }
    );

    return { success: true, message: `已更新授權期限`, expiresAt: user.expiresAt };
  }

  // 切換帳號啟用/凍結
  toggleUserStatus(email, actorUser = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { success: false, message: '無法凍結最高管理員帳號' };
    }
    const users = [...this.getUsers()];
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: '查無此帳號' };

    // 代理商權限檢查
    if (actorUser && actorUser.role === 'RESELLER') {
      if ((user.parentResellerEmail || '').toLowerCase() !== actorUser.email.toLowerCase()) {
        return { success: false, message: '權限不足：您只能凍結自己旗下客戶的帳號！' };
      }
    }

    user.status = user.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE';
    this.saveUsers(users);
    this.syncUserToCloud(user);

    auditLogger.log(
      actorUser?.email || SUPER_ADMIN_EMAIL,
      user.status === 'SUSPENDED' ? 'SUSPEND_USER' : 'ACTIVATE_USER',
      cleanEmail,
      { status: user.status }
    );

    return { success: true, status: user.status };
  }

  // 刪除使用者
  deleteUser(email, actorUser = null) {
    const cleanEmail = (email || '').trim().toLowerCase();
    if (cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase()) {
      return { success: false, message: '無法刪除最高管理員帳號' };
    }
    const users = this.getUsers();
    const user = users.find(u => u.email.toLowerCase() === cleanEmail);
    if (!user) return { success: false, message: '查無此帳號' };

    // 代理商權限檢查
    if (actorUser && actorUser.role === 'RESELLER') {
      if ((user.parentResellerEmail || '').toLowerCase() !== actorUser.email.toLowerCase()) {
        return { success: false, message: '權限不足：您只能刪除自己旗下客戶的帳號！' };
      }
    }

    let updatedUsers = users.filter(u => u.email.toLowerCase() !== cleanEmail);
    this.saveUsers(updatedUsers);
    this.deleteUserFromCloud(cleanEmail);

    auditLogger.log(
      actorUser?.email || SUPER_ADMIN_EMAIL,
      'DELETE_USER',
      cleanEmail,
      { role: user.role }
    );

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
        role: u.role || 'USER',
        parentResellerEmail: u.parentResellerEmail || null,
        resellerQuotaMB: u.resellerQuotaMB || 0,
        resellerMaxBots: u.resellerMaxBots || 0,
        resellerMaxUsers: u.resellerMaxUsers || 0,
        displayName: u.displayName,
        status: u.status,
        expiresAt: u.expiresAt,
        isExpired,
        remainingText,
        plainPasswordHint: u.plainPasswordHint,
        maxBots: u.maxBots || 5,
        maxStorageMB: u.maxStorageMB || (u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase() ? 10240 : 100),
        note: u.note || '',
        createdAt: u.createdAt,
        isSuperAdmin: u.email.toLowerCase() === SUPER_ADMIN_EMAIL.toLowerCase()
      };
    });
  }

  // 匯出完整備份資料 (JSON)
  exportUsers() {
    const users = this.getUsers();
    return {
      appName: 'RPJG BotCloud License Backup',
      author: 'R.P.J.G 開發部門',
      exportedAt: new Date().toISOString(),
      totalUsers: users.length,
      users
    };
  }

  // 匯入還原備份資料 (JSON)
  importUsers(importedUsers) {
    if (!Array.isArray(importedUsers)) {
      throw new Error('匯入格式錯誤，需為使用者陣列');
    }

    const currentUsers = [...this.getUsers()];
    let importedCount = 0;

    for (const item of importedUsers) {
      if (!item || !item.email || !item.email.includes('@')) continue;
      const cleanEmail = item.email.toLowerCase();

      const existingIndex = currentUsers.findIndex(u => u.email.toLowerCase() === cleanEmail);
      const userObj = {
        id: item.id || ('usr-' + Date.now().toString(36) + Math.random().toString(36).substring(2, 5)),
        email: cleanEmail,
        passwordHash: item.passwordHash || this.hashPassword(item.plainPasswordHint || '123456'),
        plainPasswordHint: item.plainPasswordHint || '',
        role: cleanEmail === SUPER_ADMIN_EMAIL.toLowerCase() ? 'SUPER_ADMIN' : (item.role || 'USER'),
        displayName: item.displayName || cleanEmail.split('@')[0],
        status: item.status || 'ACTIVE',
        expiresAt: item.expiresAt || null,
        maxBots: parseInt(item.maxBots) || 5,
        note: item.note || '',
        createdAt: item.createdAt || new Date().toISOString()
      };

      if (existingIndex >= 0) {
        currentUsers[existingIndex] = { ...currentUsers[existingIndex], ...userObj };
      } else {
        currentUsers.push(userObj);
      }
      importedCount++;

      // 同步至 Supabase
      this.syncUserToCloud(userObj);
    }

    this.saveUsers(currentUsers);
    return { success: true, importedCount, totalUsers: currentUsers.length };
  }

  // 取得可直接貼至 Render 環境變數的 Base64 備份字串
  getBackupString() {
    const users = this.getUsers();
    return Buffer.from(JSON.stringify(users)).toString('base64');
  }

  // 取得當前持久化存儲狀態
  getStorageStatus() {
    const supabaseUrl = process.env.SUPABASE_URL || '';
    let maskedUrl = null;
    if (supabaseUrl) {
      try {
        const u = new URL(supabaseUrl);
        maskedUrl = `${u.protocol}//${u.host}`;
      } catch (_) {
        maskedUrl = '已設定 (格式保護)';
      }
    }

    return {
      isCloudActive: this.isCloudActive,
      cloudProvider: this.isCloudActive ? 'Supabase 雲端資料庫 (PostgreSQL)' : '本機儲存 (Local Ephemeral)',
      cloudUrl: maskedUrl,
      hasBackupEnv: Boolean(process.env.RPJG_USERS_BACKUP && process.env.RPJG_USERS_BACKUP.trim()),
      totalUsers: this.usersCache.length,
      backupSnippet: this.getBackupString()
    };
  }
}

export const authManager = new AuthManager();
