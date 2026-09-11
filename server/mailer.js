/**
 * ================================================================
 * RPJG BotCloud - Gmail 郵件自動發送服務 (Mailer Service)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import dns from 'dns';
import { fileURLToPath } from 'url';

// 在雲端容器環境下強制 IPv4 優先，避免 Render/AWS 無 IPv6 外網路由導致的 ENETUNREACH
if (dns.setDefaultResultOrder) {
  dns.setDefaultResultOrder('ipv4first');
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

class MailerService {
  constructor() {
    this.fallbackUser = 'ryanryan311311@gmail.com';
    this.fallbackPass = 'eztq xvot cdwk ehnp';
  }

  getCredentials() {
    const rawUser = process.env.GMAIL_USER || process.env.SMTP_USER || this.fallbackUser;
    const rawPass = process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || this.fallbackPass;

    const user = (rawUser || '').trim();
    const pass = (rawPass || '').replace(/\s+/g, '').trim();
    return { user, pass };
  }

  isConfigured() {
    const { user, pass } = this.getCredentials();
    return !!(user && pass);
  }

  // 取得獨立且全新的 SMTP 連線實例 (強制 IPv4，避免 Socket 閒置斷線逾時與 ENETUNREACH)
  getTransporter() {
    const { user, pass } = this.getCredentials();
    if (!user || !pass) return null;

    return nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      family: 4, // 強制 IPv4 連線，徹底解決 Render 容器無 IPv6 路由錯誤
      auth: { user, pass },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
      tls: {
        rejectUnauthorized: false
      }
    });
  }

  // 測試連線與發送測試信 (提供給管理介面一鍵測試)
  async testConnection(targetEmail) {
    const { user } = this.getCredentials();
    const transporter = this.getTransporter();

    if (!transporter) {
      return { success: false, message: '尚未配置 Gmail 寄件帳號與應用程式密碼' };
    }

    const cleanTarget = (targetEmail || user || 'ryanryan311311@gmail.com').trim().toLowerCase();
    try {
      await transporter.verify();
      const info = await transporter.sendMail({
        from: `"R.P.J.G 開發部門" <${user}>`,
        to: cleanTarget,
        subject: '【RPJG BotCloud】Gmail SMTP 發信測試成功',
        text: '這是一封來自 RPJG BotCloud 的自動發信測試，代表您的 Gmail 寄件設定完全正常！',
        html: `
          <div style="font-family: sans-serif; padding: 24px; background: #1e1f22; color: #f2f3f5; border-radius: 12px; border: 1px solid #35373c;">
            <h2 style="color: #5865F2; margin-top: 0;">🎉 RPJG BotCloud - Gmail 連線測試成功</h2>
            <p>主管您好！您的 Gmail SMTP 自動發信功能運作一切正常。</p>
            <p>系統日後在您授權經銷代理商或開通客戶帳號時，會自動以此信箱（${user}）寄送認證信件！</p>
            <hr style="border: 0; border-top: 1px solid #35373c; margin: 20px 0;" />
            <p style="font-size: 11px; color: #949ba4;">測試時間：${new Date().toLocaleString('zh-TW')} • R.P.J.G 開發部門</p>
          </div>
        `
      });
      console.log(`[RPJG-MAIL-TEST] ✅ 測試信已寄出至 ${cleanTarget} (MessageID: ${info.messageId})`);
      return { success: true, message: `測試信已成功寄送至 ${cleanTarget}！`, messageId: info.messageId };
    } catch (err) {
      console.error('[RPJG-MAIL-TEST] ❌ 測試發信失敗:', err.message);
      return { success: false, message: `發信失敗: ${err.message}` };
    }
  }

  async verifyConnection() {
    return this.testConnection();
  }

  /**
   * 發送開通帳密與授權憑證至買家或代理商 Gmail
   */
  async sendAccountCredentialsEmail({
    toEmail,
    displayName,
    plainPassword,
    role = 'USER',
    maxStorageMB = 100,
    maxBots = 5,
    expiresAt = null,
    creatorEmail = '系統最高主管 (R.P.J.G)'
  }) {
    const cleanEmail = (toEmail || '').trim().toLowerCase();
    const isReseller = role === 'RESELLER';
    const roleLabel = isReseller ? '經銷代理商 (Agent / Reseller)' : '一般買家託管 (User Client)';
    const expireLabel = expiresAt ? new Date(expiresAt).toLocaleDateString('zh-TW') : '永久授權 (Lifetime VIP)';
    const platformUrl = process.env.RENDER_EXTERNAL_URL || 'https://rpjg-dc.onrender.com';

    console.log(`[RPJG-MAIL] 📨 正在處理 [${roleLabel}] 開通信件 ➜ ${cleanEmail}`);

    const { user } = this.getCredentials();
    const transporter = this.getTransporter();

    if (!transporter) {
      console.log(`[RPJG-MAIL 模擬記錄] 目標: ${cleanEmail} | 密碼: ${plainPassword} | 角色: ${roleLabel} | 配額: ${maxStorageMB}MB`);
      return {
        success: false,
        unconfigured: true,
        message: '尚未配置 Gmail 寄件金鑰，帳號已開通成功，請手動將帳密告知對方。'
      };
    }

    const htmlContent = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>RPJG BotCloud 官方授權與開通通知</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; background-color: #0e0f11; margin: 0; padding: 20px; color: #e0e0e0; }
        .container { max-width: 560px; margin: 0 auto; background: #1e1f22; border: 1px solid #2b2d31; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 30px rgba(0,0,0,0.5); }
        .header { background: linear-gradient(135deg, #5865F2 0%, #3b42a0 100%); padding: 30px 20px; text-align: center; }
        .header h1 { margin: 0; color: #ffffff; font-size: 24px; letter-spacing: 1px; font-weight: 800; }
        .header p { margin: 6px 0 0 0; color: #d0d3ff; font-size: 13px; }
        .content { padding: 30px 24px; }
        .badge { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: bold; background: ${isReseller ? '#f59e0b' : '#10b981'}; color: #000000; margin-bottom: 12px; }
        .greeting { font-size: 15px; color: #ffffff; margin-bottom: 15px; }
        .card { background: #141517; border: 1px solid #35373c; border-radius: 12px; padding: 18px; margin: 20px 0; }
        .info-row { display: flex; justify-content: space-between; padding: 8px 0; border-bottom: 1px solid #232428; font-size: 13px; }
        .info-row:last-child { border-bottom: none; }
        .info-label { color: #8a8e95; }
        .info-value { color: #ffffff; font-family: monospace; font-weight: bold; }
        .cred-box { background: #232428; border-left: 4px solid #5865F2; padding: 14px; border-radius: 8px; margin: 20px 0; }
        .cred-title { font-size: 12px; color: #9ca3af; margin-bottom: 4px; }
        .cred-text { font-size: 18px; font-family: monospace; color: #38bdf8; font-weight: bold; letter-spacing: 1px; }
        .btn-box { text-align: center; margin: 28px 0; }
        .btn { display: inline-block; background: #5865F2; color: #ffffff !important; text-decoration: none; padding: 12px 32px; border-radius: 10px; font-weight: bold; font-size: 14px; box-shadow: 0 4px 14px rgba(88,101,242,0.4); }
        .footer { background: #141517; padding: 18px; text-align: center; font-size: 11px; color: #6b7280; border-top: 1px solid #2b2d31; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>RPJG BotCloud</h1>
          <p>Discord Bot 雲端線上託管平台 • 官方授權認證</p>
        </div>
        <div class="content">
          <div class="badge">${isReseller ? '👑 經銷代理商憑證' : '⚡ 買家客戶憑證'}</div>
          <div class="greeting">您好，<strong>${displayName || cleanEmail}</strong>：</div>
          <p style="font-size: 13px; line-height: 1.6; color: #9ca3af;">
            歡迎使用 RPJG BotCloud！您的雲端帳號已由 <strong>${creatorEmail}</strong> 成功簽發開通。您現在可以登入控制台，自由上傳與管理您的專屬 Discord 機器人。
          </p>

          <div class="cred-box">
            <div class="cred-title">您的登入密碼：</div>
            <div class="cred-text">${plainPassword}</div>
          </div>

          <div class="card">
            <div class="info-row">
              <span class="info-label">登入帳號 (Email)</span>
              <span class="info-value">${cleanEmail}</span>
            </div>
            <div class="info-row">
              <span class="info-label">身分權限</span>
              <span class="info-value">${roleLabel}</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isReseller ? '可派發總配額池' : '獲派儲存空間'}</span>
              <span class="info-value" style="color: #38bdf8;">${maxStorageMB} MB</span>
            </div>
            <div class="info-row">
              <span class="info-label">${isReseller ? '代理機器人總配額' : '可託管機器人數'}</span>
              <span class="info-value">${maxBots} 台</span>
            </div>
            <div class="info-row">
              <span class="info-label">授權有效期</span>
              <span class="info-value" style="color: #34d399;">${expireLabel}</span>
            </div>
          </div>

          <div class="btn-box">
            <a href="${platformUrl}" class="btn" target="_blank">立即前往控制台登入 ➜</a>
          </div>

          <p style="font-size: 11px; color: #6b7280; line-height: 1.5; margin-top: 25px;">
            ⚠️ 安全提示：此密碼為系統自動簽發之專屬憑證，請妥善保管，切勿轉發給他人。如非本人申請，請忽略此信件。
          </p>
        </div>
        <div class="footer">
          © 2026 RPJG BotCloud | 由 R.P.J.G 開發部門 核心打造 • 全自動雲端常駐守護
        </div>
      </div>
    </body>
    </html>
    `;

    try {
      const info = await transporter.sendMail({
        from: `"R.P.J.G 開發部門" <${user}>`,
        to: cleanEmail,
        subject: `【RPJG BotCloud】您的 ${isReseller ? '代理商' : '機器人託管'} 帳號已開通成功 (內附登入密碼)`,
        html: htmlContent
      });

      console.log(`[RPJG-MAIL] ✅ 信件已成功送達 ${cleanEmail} (MessageID: ${info.messageId})`);
      return { success: true, messageId: info.messageId };
    } catch (err) {
      console.error(`[RPJG-MAIL] 🔴 寄信失敗 (${cleanEmail}):`, err.message);
      return { success: false, error: err.message };
    }
  }
}

export const mailerService = new MailerService();
