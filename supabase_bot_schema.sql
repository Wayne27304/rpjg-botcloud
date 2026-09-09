-- =========================================================================
-- RPJG BotCloud - Discord 機器人雲端託管系統
-- Supabase 雲端資料庫結構建立腳本 (PostgreSQL)
-- 作者：R.P.J.G 開發部門
-- 
-- 執行方式：
-- 1. 前往 https://supabase.com 登入並進入專案
-- 2. 點擊左側導覽列的「SQL Editor」
-- 3. 點擊「New Query」，貼上本腳本全部內容
-- 4. 點擊右下角的「Run」執行即可！
-- =========================================================================

-- 1. 建立授權使用者資料表 (rpjg_bot_users)
CREATE TABLE IF NOT EXISTS public.rpjg_bot_users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    plain_password_hint TEXT,
    role TEXT DEFAULT 'USER',
    display_name TEXT,
    status TEXT DEFAULT 'ACTIVE',
    expires_at TIMESTAMPTZ,
    max_bots INTEGER DEFAULT 5,
    note TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 為 Email 建立查詢索引
CREATE INDEX IF NOT EXISTS idx_rpjg_bot_users_email 
ON public.rpjg_bot_users(email);

-- 2. 預設插入最高主管帳號 (Ryan)
INSERT INTO public.rpjg_bot_users (
    id,
    email,
    password_hash,
    plain_password_hint,
    role,
    display_name,
    status,
    expires_at,
    max_bots,
    note,
    created_at,
    updated_at
) VALUES (
    'admin-01',
    'ryanryan311311@gmail.com',
    '490f79d426ca9c6d660b9e2ea06495a34f560d7147ca9cecc185aedc558bcbdc',
    'Hh126702249',
    'SUPER_ADMIN',
    'Ryan (最高主管)',
    'ACTIVE',
    NULL,
    50,
    '系統最高管理者 (R.P.J.G 總管)',
    NOW(),
    NOW()
)
ON CONFLICT (email) DO UPDATE SET
    role = 'SUPER_ADMIN',
    status = 'ACTIVE',
    max_bots = 50;

-- 3. 啟用 Row Level Security (RLS) 並允許後端 API 自由讀寫
ALTER TABLE public.rpjg_bot_users ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all operations on rpjg_bot_users" ON public.rpjg_bot_users;
CREATE POLICY "Allow all operations on rpjg_bot_users" 
ON public.rpjg_bot_users FOR ALL 
USING (true) WITH CHECK (true);

-- 4. 啟用即時推播功能 (Realtime)
ALTER PUBLICATION supabase_realtime ADD TABLE public.rpjg_bot_users;
