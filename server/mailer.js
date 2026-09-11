/**
 * ================================================================
 * RPJG BotCloud - Gmail 郵件自動發送服務 (Mailer Service)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '../.env') });

class MailerService {
  constructor() {
    this.transporter = null;
    this.initTransporter();
  }

  initTransporter() {
    const gmailUser = (process.env.GMAIL_USER || process.env.SMTP_USER || '').trim();
    const gmailPass = (process.env.GMAIL_APP_PASSWORD || process.env.SMTP_PASS || '').trim();

    if (gmailUser && gmailPass) {
      this.transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: gmailUser,
          pass: gmailPass
        }
      });
      console.log(`[RPJG-MAIL] 🟢 Gmail SMTP 郵件引擎已就緒，寄件者: ${gmailUser}`);
    } else {
      console.log(`[RPJG-MAIL] 🟡 未偵測到 GMAIL_APP_PASSWORD，系統已啟用「虛擬模擬寄信」模式 (開通帳號時將直接在後台顯示帳密)`);
      this.transporter = null;
    }
  }

  isConfigured() {
    return !!this.transporter;
  }

  // 測試連線
  async verifyConnection() {
    if (!this.transporter) {
      return { success: false, message: '尚未在 Render 環境變數設定 GMAIL_USER 與 GMAIL_APP_PASSWORD' };
    }
    try {
      await this.transporter.verify();
      return { success: true, message: 'Gmail SMTP 連線成功！' };
    } catch (err) {
      return { success: false, message: `Gmail 連線驗證失敗: ${err.message}` };
    }
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

    if (!this.transporter) {
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
      const sender = process.env.GMAIL_USER || 'RPJG BotCloud <noreply@rpjg.cloud>';
      const info = await this.transporter.sendMail({
        from: `"R.P.J.G 開發部門" <${sender}>`,
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
