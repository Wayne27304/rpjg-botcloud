import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.join(__dirname, '..');
const BOTS_DIR = path.join(ROOT_DIR, 'server', 'bots');
const BACKUP_FILE = path.join(ROOT_DIR, 'server', 'data', 'bots_backup.json');

const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://rpjgchat.onrender.com';
const ADMIN_EMAIL = 'ryanryan311311@gmail.com';
const ADMIN_PWD = process.env.SUPER_ADMIN_PWD || 'Hh126702249';

async function syncCloudBots() {
  console.log(`\n[RPJG 同步工具] 正在連線至雲端正式站: ${RENDER_URL}...`);

  const loginRes = await fetch(`${RENDER_URL}/api/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PWD })
  });

  const loginData = await loginRes.json();
  if (!loginData.success || !loginData.token) {
    console.error(`[RPJG 同步工具] 🔴 登入失敗:`, loginData.message);
    return;
  }

  console.log(`[RPJG 同步工具] 🟢 管理員身份驗證成功！正在獲取雲端最新機器人專案...`);

  const backupRes = await fetch(`${RENDER_URL}/api/admin/backup/bots`, {
    headers: { 'Authorization': 'Bearer ' + loginData.token }
  });

  const backupData = await backupRes.json();
  if (!backupData.success || !Array.isArray(backupData.bots)) {
    console.log(`[RPJG 同步工具] 🟡 雲端查無備份或清單為空。`);
    return;
  }

  const bots = backupData.bots;
  console.log(`[RPJG 同步工具] 📦 成功從雲端獲取 ${bots.length} 個機器人！`);

  if (!fs.existsSync(BOTS_DIR)) fs.mkdirSync(BOTS_DIR, { recursive: true });

  for (const b of bots) {
    if (!b || !b.id) continue;
    const botDir = path.join(BOTS_DIR, b.id);
    if (!fs.existsSync(botDir)) fs.mkdirSync(botDir, { recursive: true });

    if (b.metadata) {
      fs.writeFileSync(path.join(botDir, 'metadata.json'), JSON.stringify(b.metadata, null, 2), 'utf8');
    }

    if (b.files) {
      for (const [relPath, content] of Object.entries(b.files)) {
        const fullPath = path.join(botDir, relPath);
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        if (typeof content === 'string' && content.startsWith('base64:')) {
          fs.writeFileSync(fullPath, Buffer.from(content.replace('base64:', ''), 'base64'));
        } else {
          fs.writeFileSync(fullPath, content, 'utf8');
        }
      }
    }
    console.log(`  - 已同步: ${b.metadata?.name || b.id} (擁有者: ${b.metadata?.ownerEmail || 'admin'})`);
  }

  fs.writeFileSync(BACKUP_FILE, JSON.stringify(bots, null, 2), 'utf8');
  console.log(`[RPJG 同步工具] ✅ 本地已全部同步完畢！可安全執行 git commit & push。\n`);
}

syncCloudBots().catch(err => {
  console.error('[RPJG 同步工具] 同步發生例外:', err.message);
});
