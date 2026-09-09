import React, { useState, useEffect, useRef } from 'react';
import {
  Crown,
  UserPlus,
  Users,
  Shield,
  Clock,
  Key,
  Copy,
  Check,
  RefreshCw,
  Trash2,
  Lock,
  Unlock,
  AlertTriangle,
  Calendar,
  Sparkles,
  Database,
  Download,
  Upload,
  Server,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  CheckCircle,
  ExternalLink,
  HardDrive,
  Sliders,
  X
} from 'lucide-react';

export default function AuthManagement({ currentUser }) {
  const [users, setUsers] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedBackup, setCopiedBackup] = useState(false);
  const [copiedLinkIndex, setCopiedLinkIndex] = useState(null);
  const [copiedBannerLink, setCopiedBannerLink] = useState(false);
  const [showGuide, setShowGuide] = useState(false);
  const [storageStatus, setStorageStatus] = useState(null);
  const [botsBackupCount, setBotsBackupCount] = useState(0);
  const [copiedBackupEnv, setCopiedBackupEnv] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  // 主機容量與使用者配額狀態
  const [storageOverview, setStorageOverview] = useState(null);
  const [maxStorageMB, setMaxStorageMB] = useState(100);
  const [isQuotaModalOpen, setIsQuotaModalOpen] = useState(false);
  const [quotaTargetUser, setQuotaTargetUser] = useState(null);
  const [editStorageMB, setEditStorageMB] = useState(100);
  const [editMaxBots, setEditMaxBots] = useState(5);
  const [isSavingQuota, setIsSavingQuota] = useState(false);

  const fileInputRef = useRef(null);

  const copyDirectLoginLink = (userEmail, userPwd, idx) => {
    const origin = window.location.origin;
    const directUrl = `${origin}/?email=${encodeURIComponent(userEmail)}&pwd=${encodeURIComponent(userPwd || '')}`;
    navigator.clipboard.writeText(directUrl);
    setCopiedLinkIndex(idx);
    setTimeout(() => setCopiedLinkIndex(null), 2500);
  };

  const fetchBotsBackup = () => {
    const token = localStorage.getItem('rpjg_auth_token');
    fetch('/api/admin/backup/bots', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success) {
          setBotsBackupCount(data.count || 0);
        }
      })
      .catch(() => {});
  };

  const handleCopyBotsEnv = () => {
    const token = localStorage.getItem('rpjg_auth_token');
    setIsExporting(true);
    fetch('/api/admin/backup/bots', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(data => {
        if (data.success && data.base64) {
          navigator.clipboard.writeText(data.base64);
          setCopiedBackupEnv(true);
          setTimeout(() => setCopiedBackupEnv(false), 3000);
        }
      })
      .finally(() => setIsExporting(false));
  };

  const handleDownloadBotsZip = () => {
    const token = localStorage.getItem('rpjg_auth_token');
    fetch('/api/admin/backup/bots/zip', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.blob())
      .then(blob => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `RPJG_Bots_Backup_${new Date().toISOString().slice(0, 10)}.zip`;
        a.click();
        window.URL.revokeObjectURL(url);
      })
      .catch(err => console.error('下載備份失敗:', err));
  };

  // 表單資料
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [durationType, setDurationType] = useState('30d'); // 'permanent' | '30d' | '7d' | '1d' | 'custom'
  const [customDays, setCustomDays] = useState(14);
  const [maxBots, setMaxBots] = useState(5);
  const [note, setNote] = useState('');
  const [formStatus, setFormStatus] = useState(null);

  const fetchUsers = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/auth/users', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.users) {
        setUsers(data.users);
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchStorageOverview = async () => {
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/admin/storage-overview', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStorageOverview(data);
      }
    } catch (e) {
      console.error('讀取主機空間總覽失敗:', e);
    }
  };

  const fetchStorageStatus = async () => {
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/auth/storage-status', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setStorageStatus(data);
      }
    } catch (e) {
      console.error('讀取存儲狀態失敗:', e);
    }
  };

  useEffect(() => {
    fetchUsers();
    fetchStorageStatus();
    fetchBotsBackup();
    fetchStorageOverview();
  }, []);

  const handleGeneratePassword = () => {
    const randomPwd = 'rpjg_' + Math.random().toString(36).substring(2, 8);
    setPassword(randomPwd);
  };

  const handleAuthorize = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/auth/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim(),
          password: password.trim() || undefined,
          durationType,
          customDays,
          maxBots,
          maxStorageMB: parseInt(maxStorageMB) || 100,
          note: note.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        const directUrl = `${window.location.origin}/?email=${encodeURIComponent(email.trim())}&pwd=${encodeURIComponent(data.generatedPassword)}`;
        setFormStatus({
          type: 'success',
          message: `已成功授權 ${email}！密碼為：${data.generatedPassword} (派發空間: ${data.maxStorageMB || maxStorageMB} MB)`,
          directUrl
        });
        setEmail('');
        setDisplayName('');
        setPassword('');
        setNote('');
        fetchUsers();
        fetchStorageStatus();
        fetchStorageOverview();
        setTimeout(() => setFormStatus(null), 15000);
      } else {
        setFormStatus({ type: 'error', message: data.message });
      }
    } catch (e) {
      setFormStatus({ type: 'error', message: '操作失敗' });
    }
  };

  const handleOpenQuotaModal = (user) => {
    setQuotaTargetUser(user);
    setEditStorageMB(user.maxStorageMB || 100);
    setEditMaxBots(user.maxBots || 5);
    setIsQuotaModalOpen(true);
  };

  const handleSaveQuota = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (!quotaTargetUser) return;
    setIsSavingQuota(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(quotaTargetUser.email)}/quota`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          maxStorageMB: parseInt(editStorageMB) || 100,
          maxBots: parseInt(editMaxBots) || 5
        })
      });
      const data = await res.json();
      if (data.success) {
        setIsQuotaModalOpen(false);
        fetchUsers();
        fetchStorageOverview();
      } else {
        alert(data.message || '調配失敗');
      }
    } catch (err) {
      alert('調配空間異常: ' + err.message);
    } finally {
      setIsSavingQuota(false);
    }
  };

  const handleExtend = async (targetEmail, days) => {
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(targetEmail)}/extend`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ days })
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        fetchStorageStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleToggleStatus = async (targetEmail) => {
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(targetEmail)}/status`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        fetchStorageStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (targetEmail) => {
    if (!confirm(`確定要移除 ${targetEmail} 的授權資格嗎？此使用者將無法再登入。`)) return;
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/auth/users/${encodeURIComponent(targetEmail)}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchUsers();
        fetchStorageStatus();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // 匯出備份 JSON 檔案
  const handleExportBackup = async () => {
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/auth/export', {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `rpjg_users_backup_${new Date().toISOString().slice(0, 10)}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      alert('匯出備份失敗: ' + err.message);
    }
  };

  // 匯入備份 JSON 檔案
  const handleImportFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target.result);
        const usersList = json.users || (Array.isArray(json) ? json : null);
        if (!usersList || !Array.isArray(usersList)) {
          alert('匯入格式不正確，需為含有 users 陣列的 JSON 備份檔');
          return;
        }

        const token = localStorage.getItem('rpjg_auth_token');
        const res = await fetch('/api/auth/import', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ users: usersList })
        });
        const result = await res.json();
        if (result.success) {
          alert(`🎉 成功匯入還原 ${result.importedCount} 位使用者帳號！目前名冊共 ${result.totalUsers} 位。`);
          fetchUsers();
          fetchStorageStatus();
        } else {
          alert('匯入失敗: ' + result.message);
        }
      } catch (err) {
        alert('解析檔案失敗: ' + err.message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // 複製 Render 環境變數備份代碼
  const handleCopyBackupSnippet = () => {
    if (!storageStatus?.backupSnippet) return;
    navigator.clipboard.writeText(storageStatus.backupSnippet);
    setCopiedBackup(true);
    setTimeout(() => setCopiedBackup(false), 3000);
  };

  const copyToClipboard = (text, idx) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(idx);
    setTimeout(() => setCopiedIndex(null), 2000);
  };

  const activeCount = users.filter(u => u.status === 'ACTIVE' && !u.isExpired).length;
  const expiredCount = users.filter(u => u.isExpired).length;
  const isCloud = storageStatus?.isCloudActive;

  return (
    <div className="space-y-6">
      {/* 頂部管理員卡片 */}
      <div className="bg-gradient-to-r from-indigo-950/60 via-[#1e1f22] to-purple-950/60 p-6 rounded-2xl border border-indigo-500/30 shadow-xl relative overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 relative z-10">
          <div className="flex items-center space-x-3.5">
            <div className="p-3.5 rounded-2xl bg-gradient-to-tr from-amber-500 to-indigo-600 text-white shadow-lg shadow-indigo-500/20">
              <Crown className="w-7 h-7" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-xl font-extrabold text-white tracking-wide">
                  最高主管授權管理中心 (License Admin)
                </h2>
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                  SUPER_ADMIN
                </span>
              </div>
              <p className="text-xs text-gray-300 mt-0.5">
                登入者：<strong className="text-white font-mono">{currentUser?.email}</strong> | 單位：<span className="text-indigo-300">R.P.J.G 開發部門</span>
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-4">
            <div className="text-right">
              <div className="text-xs text-gray-400">有效授權中帳號</div>
              <div className="text-xl font-bold text-emerald-400 font-mono">{activeCount} 人</div>
            </div>
            <div className="h-8 w-px bg-gray-700"></div>
            <div className="text-right">
              <div className="text-xs text-gray-400">已過期帳號</div>
              <div className="text-xl font-bold text-red-400 font-mono">{expiredCount} 人</div>
            </div>
          </div>
        </div>
      </div>

      {/* 雲端主機空間與配額調配中心 (即時掌握剩餘容量與派發狀態) */}
      <div className="bg-[#1e1f22] p-6 rounded-2xl border border-[#2b2d31] shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-3">
            <div className="p-3 rounded-2xl bg-cyan-950/60 text-cyan-400 border border-cyan-800/50 shrink-0">
              <HardDrive className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-base font-extrabold text-white">雲端主機空間與配額調配中心</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-cyan-950 text-cyan-300 border border-cyan-800">
                  即時容量監控
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                實時掌握伺服器總磁碟容量、剩餘可用空間，並針對每位買家彈性派發與擴充空間。
              </p>
            </div>
          </div>

          <button
            onClick={() => { fetchStorageOverview(); fetchUsers(); }}
            className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs transition self-start sm:self-auto shrink-0 border border-gray-700"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>重新整理容量</span>
          </button>
        </div>

        {/* 4 個數據卡片 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-5">
          {/* 卡片 1: 主機實體總容量 */}
          <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31]">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>主機總容量</span>
              <Server className="w-4 h-4 text-gray-500" />
            </div>
            <div className="text-xl font-extrabold text-white font-mono">
              {storageOverview?.disk?.totalFormatted || '計算中...'}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              已使用 {storageOverview?.disk?.usedFormatted || '0 B'} ({storageOverview?.disk?.usedPercent || 0}%)
            </div>
          </div>

          {/* 卡片 2: 總共剩餘可用空間 (重點醒目) */}
          <div className="bg-gradient-to-br from-emerald-950/40 to-[#141517] p-4 rounded-xl border border-emerald-500/30">
            <div className="flex items-center justify-between text-emerald-300 text-xs mb-1 font-semibold">
              <span>總共剩餘空間</span>
              <CheckCircle className="w-4 h-4 text-emerald-400" />
            </div>
            <div className="text-2xl font-black text-emerald-400 font-mono tracking-tight">
              {storageOverview?.disk?.freeFormatted || '計算中...'}
            </div>
            <div className="text-[11px] text-emerald-300/80 mt-1">
              主機剩餘可用磁碟容量
            </div>
          </div>

          {/* 卡片 3: 買家機器人總佔用量 */}
          <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31]">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>機器人檔案耗用</span>
              <HardDrive className="w-4 h-4 text-indigo-400" />
            </div>
            <div className="text-xl font-extrabold text-indigo-300 font-mono">
              {storageOverview?.bots?.formatted || '0 B'}
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              共託管 {storageOverview?.bots?.totalBotCount || 0} 台買家機器人
            </div>
          </div>

          {/* 卡片 4: 已派發配額總量 */}
          <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31]">
            <div className="flex items-center justify-between text-gray-400 text-xs mb-1">
              <span>全站派發配額總量</span>
              <Users className="w-4 h-4 text-amber-400" />
            </div>
            <div className="text-xl font-extrabold text-amber-400 font-mono">
              {storageOverview?.quota?.totalAllocatedMB || 0} MB
            </div>
            <div className="text-[11px] text-gray-500 mt-1">
              配額使用率: {storageOverview?.quota?.usagePercent || 0}% (已用 {storageOverview?.quota?.totalUsedMB || 0} MB)
            </div>
          </div>
        </div>

        {/* 容量可視化進度條 */}
        <div className="mt-5 bg-[#141517] p-4 rounded-xl border border-[#2b2d31]">
          <div className="flex items-center justify-between text-xs mb-2">
            <span className="text-gray-300 font-medium flex items-center space-x-1.5">
              <span>全站配額消耗進度</span>
              <span className="text-[10px] text-gray-500 font-mono">({storageOverview?.quota?.totalUsedMB || 0} MB / {storageOverview?.quota?.totalAllocatedMB || 0} MB)</span>
            </span>
            <span className="text-emerald-400 font-mono font-bold">
              剩餘可用配額 {storageOverview?.quota?.remainingFreeQuotaMB || 0} MB
            </span>
          </div>
          <div className="w-full bg-[#1e1f22] h-2.5 rounded-full overflow-hidden border border-gray-700">
            <div
              className="bg-gradient-to-r from-emerald-500 via-indigo-500 to-purple-500 h-full rounded-full transition-all duration-700"
              style={{ width: `${Math.min(100, Math.max(2, storageOverview?.quota?.usagePercent || 0))}%` }}
            />
          </div>
        </div>
      </div>

      {/* 雲端永久保存與備份管理中心 (解決更新帳號遺失的核心模組) */}
      <div className={`p-5 rounded-2xl border transition-all ${
        isCloud
          ? 'bg-gradient-to-br from-emerald-950/30 via-[#1e1f22] to-[#1e1f22] border-emerald-500/30'
          : 'bg-gradient-to-br from-amber-950/30 via-[#1e1f22] to-[#1e1f22] border-amber-500/30'
      }`}>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-3">
            <div className={`p-2.5 rounded-xl shrink-0 ${
              isCloud ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'bg-amber-500/20 text-amber-400 border border-amber-500/40'
            }`}>
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                  isCloud ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-amber-950 text-amber-300 border border-amber-800'
                }`}>
                  {isCloud ? '🟢 Supabase 雲端資料庫已連線 (永久保存)' : '🟡 本機檔案模式 (更新將重置)'}
                </span>
                {storageStatus?.hasBackupEnv && (
                  <span className="px-2 py-0.5 rounded-md text-[11px] font-bold bg-indigo-950 text-indigo-300 border border-indigo-800">
                    📦 Render 環境變數快照已啟用
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-1.5 leading-relaxed max-w-2xl">
                {isCloud
                  ? '所有買家授權與到期資料已自動雙向同步至 Supabase PostgreSQL 雲端資料庫。即使 Render 每次推送更新、手動重新部署或容器重啟，買家帳號 100% 永久保留，絕不遺失！'
                  : 'Render 免費主機在每次 Git 更新推送時會清除本機容器檔案。強烈建議在 Render 後台加入 Supabase 環境變數，或點擊右側「複製 Render 備份字串 / 匯出備份」，即可零遺失！'}
              </p>
            </div>
          </div>

          {/* 動作工具列 */}
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="file"
              ref={fileInputRef}
              onChange={handleImportFile}
              accept=".json"
              className="hidden"
            />

            <button
              onClick={handleExportBackup}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold border border-gray-700 transition shadow-sm"
              title="下載所有授權買家的 JSON 備份檔案"
            >
              <Download className="w-3.5 h-3.5 text-indigo-400" />
              <span>匯出備份 (JSON)</span>
            </button>

            <button
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-[#2b2d31] hover:bg-[#35373c] text-white text-xs font-semibold border border-gray-700 transition shadow-sm"
              title="上傳備份檔案立即全數還原買家帳號"
            >
              <Upload className="w-3.5 h-3.5 text-emerald-400" />
              <span>匯入還原 (JSON)</span>
            </button>

            <button
              onClick={handleCopyBackupSnippet}
              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold shadow-md shadow-discord-blurple/20 transition"
              title="複製 Base64 代碼，貼到 Render -> Environment Variables -> RPJG_USERS_BACKUP 即可自動永久保存"
            >
              {copiedBackup ? <Check className="w-3.5 h-3.5 text-emerald-300" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedBackup ? '已複製 Render 變數！' : '複製 Render 備份字串'}</span>
            </button>

            <button
              onClick={() => setShowGuide(!showGuide)}
              className="flex items-center space-x-1 px-2.5 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs transition"
              title="如何設定 Supabase 永久雲端資料庫"
            >
              <HelpCircle className="w-3.5 h-3.5 text-amber-400" />
              <span>設定教學</span>
              {showGuide ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          </div>
        </div>

        {/* 展開之教學面板 */}
        {showGuide && (
          <div className="mt-4 pt-4 border-t border-gray-800 text-xs text-gray-300 space-y-3 bg-[#141517] p-4 rounded-xl">
            <h4 className="font-bold text-white flex items-center space-x-2">
              <Database className="w-4 h-4 text-emerald-400" />
              <span>如何設定 Supabase 實現更新完全不遺失帳號 (只需 3 步驟)：</span>
            </h4>
            <ol className="list-decimal list-inside space-y-2 text-gray-300 leading-relaxed pl-1">
              <li>
                <strong>前往 Supabase</strong>：在 <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-discord-blurple underline inline-flex items-center space-x-0.5"><span>Supabase 官網</span><ExternalLink className="w-3 h-3 ml-0.5" /></a> 建立一個免費資料庫專案。
              </li>
              <li>
                <strong>建立資料表</strong>：進入左側選單的 <code>SQL Editor</code>，點擊 <code>New Query</code>，將專案中的 <code>supabase_bot_schema.sql</code> 內容貼上並點擊 <code>Run</code> 執行。
              </li>
              <li>
                <strong>設定 Render 環境變數</strong>：進入 <a href="https://dashboard.render.com" target="_blank" rel="noreferrer" className="text-discord-blurple underline inline-flex items-center space-x-0.5"><span>Render 後台</span><ExternalLink className="w-3 h-3 ml-0.5" /></a> 您的專案 <code>Environment</code> 標籤頁，新增以下兩組變數：
                <div className="mt-2 bg-[#1e1f22] p-2.5 rounded-lg font-mono text-[11px] text-gray-200 border border-gray-700 space-y-1">
                  <div><strong className="text-emerald-400">SUPABASE_URL</strong> = 您的 Supabase 專案網址 (例: https://xyz.supabase.co)</div>
                  <div><strong className="text-emerald-400">SUPABASE_KEY</strong> = 您的 Supabase anon 或 service_role 金鑰</div>
                </div>
              </li>
            </ol>
            <div className="p-2.5 rounded-lg bg-indigo-950/40 border border-indigo-800/60 text-indigo-300 text-[11px]">
              💡 <strong>小撇步</strong>：若您目前尚未建立 Supabase，也可直接點擊上方「<strong>複製 Render 備份字串</strong>」，到 Render 後台新增變數 <code>RPJG_USERS_BACKUP</code> 並貼上，系統每次重啟就會自動還原所有買家！
            </div>
          </div>
        )}
      </div>

      {/* 授權新增表單 */}
      <div className="bg-[#1e1f22] p-6 rounded-2xl border border-[#2b2d31] shadow-xl">
        <div className="flex items-center justify-between pb-4 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-2">
            <UserPlus className="w-5 h-5 text-discord-blurple" />
            <h3 className="text-sm font-bold text-white">簽發授權給新的 GMAIL 使用者</h3>
          </div>
          <span className="text-xs text-gray-400">填寫後系統將立即開通該帳號登入權限</span>
        </div>

        {formStatus && (
          <div className={`mt-4 p-3.5 rounded-xl text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
            formStatus.type === 'success'
              ? 'bg-emerald-950/50 border border-emerald-800/60 text-emerald-300'
              : 'bg-red-950/50 border border-red-800/60 text-red-300'
          }`}>
            <div className="flex items-center space-x-2">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{formStatus.message}</span>
            </div>
            {formStatus.directUrl && (
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(formStatus.directUrl);
                  setCopiedBannerLink(true);
                  setTimeout(() => setCopiedBannerLink(false), 2500);
                }}
                className="shrink-0 flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold transition shadow"
              >
                {copiedBannerLink ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedBannerLink ? '已複製直登網址！' : '複製買家一鍵直登網址'}</span>
              </button>
            )}
          </div>
        )}

        <form onSubmit={handleAuthorize} className="mt-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                使用者 Gmail / Email <span className="text-red-400">*</span>
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="client@gmail.com"
                className="w-full bg-[#141517] text-xs text-white p-2.5 rounded-xl border border-[#35373c] focus:outline-none focus:border-discord-blurple font-mono"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                顯示名稱 / 暱稱
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="例如: 小明 / VIP 客戶"
                className="w-full bg-[#141517] text-xs text-white p-2.5 rounded-xl border border-[#35373c] focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-medium text-gray-300">
                  登入密碼 (留空自動生成)
                </label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-discord-blurple hover:underline"
                >
                  隨機生成
                </button>
              </div>
              <input
                type="text"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="自訂密碼或留空生成"
                className="w-full bg-[#141517] text-xs text-white p-2.5 rounded-xl border border-[#35373c] focus:outline-none focus:border-discord-blurple font-mono"
              />
            </div>
          </div>

          {/* 授權期限按鈕組 */}
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-2">
              選擇授權天數 / 期限 (Duration) <span className="text-red-400">*</span>
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
              {[
                { id: '1d', label: '1 天 (24小時體驗)', badge: '體驗' },
                { id: '7d', label: '7 天 (一週)', badge: '短期' },
                { id: '30d', label: '30 天 (一個月)', badge: '熱門' },
                { id: 'permanent', label: '🌟 永久授權', badge: 'VIP' },
                { id: 'custom', label: '自訂天數', badge: '彈性' }
              ].map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => setDurationType(item.id)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold flex flex-col items-center justify-center transition ${
                    durationType === item.id
                      ? 'bg-discord-blurple text-white border-discord-blurple shadow-md'
                      : 'bg-[#141517] text-gray-300 border-[#35373c] hover:border-gray-500'
                  }`}
                >
                  <span>{item.label}</span>
                  <span className={`text-[10px] mt-0.5 px-1.5 py-0.2 rounded ${
                    durationType === item.id ? 'bg-white/20 text-white' : 'bg-gray-800 text-gray-400'
                  }`}>
                    {item.badge}
                  </span>
                </button>
              ))}
            </div>

            {durationType === 'custom' && (
              <div className="mt-3 flex items-center space-x-2">
                <span className="text-xs text-gray-400">請輸入欲授權天數：</span>
                <input
                  type="number"
                  min="1"
                  max="3650"
                  value={customDays}
                  onChange={(e) => setCustomDays(e.target.value)}
                  className="w-24 bg-[#141517] text-xs text-white p-2 rounded-lg border border-[#35373c] font-mono text-center"
                />
                <span className="text-xs text-gray-400">天</span>
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-1">
            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                允許託管機器人數量
              </label>
              <input
                type="number"
                min="1"
                max="50"
                value={maxBots}
                onChange={(e) => setMaxBots(e.target.value)}
                className="w-full bg-[#141517] text-xs text-white p-2.5 rounded-xl border border-[#35373c] font-mono"
              />
              <div className="text-[10px] text-gray-500 mt-1">預設 5 台</div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1 flex items-center justify-between">
                <span>派發儲存空間配額</span>
                <span className="text-cyan-400 font-mono font-bold">{maxStorageMB} MB</span>
              </label>
              <div className="flex items-center space-x-1.5">
                <input
                  type="number"
                  min="10"
                  max="10240"
                  value={maxStorageMB}
                  onChange={(e) => setMaxStorageMB(e.target.value)}
                  className="w-full bg-[#141517] text-xs text-white p-2.5 rounded-xl border border-[#35373c] font-mono"
                />
                <span className="text-xs text-gray-400 shrink-0">MB</span>
              </div>
              <div className="flex items-center space-x-1 mt-1.5 overflow-x-auto">
                {[50, 100, 200, 500, 1024].map(sz => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setMaxStorageMB(sz)}
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono transition shrink-0 ${
                      parseInt(maxStorageMB) === sz
                        ? 'bg-cyan-500 text-black font-bold'
                        : 'bg-gray-800 text-gray-400 hover:text-white'
                    }`}
                  >
                    {sz >= 1024 ? `${sz / 1024}GB` : `${sz}MB`}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-300 mb-1">
                備註說明 (客戶姓名、社群名稱等)
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例如: Discord 伺服器技術長"
                className="w-full bg-[#141517] text-xs text-white p-2.5 rounded-xl border border-[#35373c]"
              />
              <div className="text-[10px] text-gray-500 mt-1">選填</div>
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              className="flex items-center space-x-2 px-6 py-2.5 rounded-xl bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-bold shadow-lg shadow-discord-blurple/30 transition"
            >
              <UserPlus className="w-4 h-4" />
              <span>確認簽發授權</span>
            </button>
          </div>
        </form>
      </div>

      {/* 授權列表 */}
      <div className="bg-[#1e1f22] rounded-2xl border border-[#2b2d31] overflow-hidden shadow-xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-indigo-400" />
            <h3 className="text-sm font-bold text-white">已授權使用者名冊</h3>
          </div>
          <button
            onClick={() => { fetchUsers(); fetchStorageStatus(); }}
            title="重新整理"
            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-gray-300">
            <thead className="bg-[#141517] text-gray-400 uppercase text-[11px] border-b border-[#2b2d31]">
              <tr>
                <th className="px-6 py-3">Gmail / 使用者</th>
                <th className="px-4 py-3">角色與備註</th>
                <th className="px-4 py-3">密碼提示</th>
                <th className="px-4 py-3">剩餘時間 / 期限</th>
                <th className="px-4 py-3">空間配額與用量</th>
                <th className="px-4 py-3">狀態</th>
                <th className="px-6 py-3 text-right">管理操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2b2d31]">
              {users.map((u, idx) => {
                const isSuper = u.isSuperAdmin;
                const isExp = u.isExpired;
                const isSuspended = u.status === 'SUSPENDED';

                return (
                  <tr key={u.id} className="hover:bg-[#232428] transition">
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2.5">
                        <div className={`p-2 rounded-xl ${isSuper ? 'bg-amber-500/20 text-amber-300' : 'bg-gray-800 text-gray-300'}`}>
                          {isSuper ? <Crown className="w-4 h-4" /> : <Shield className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="font-bold text-white font-mono flex items-center space-x-1.5">
                            <span>{u.email}</span>
                            {isSuper && (
                              <span className="text-[10px] px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40">
                                總管
                              </span>
                            )}
                          </div>
                          <div className="text-[11px] text-gray-400">{u.displayName}</div>
                        </div>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="text-xs text-gray-200">{u.note || '無備註'}</div>
                      <div className="text-[10px] text-gray-500">上限: {u.maxBots} 台機器人</div>
                    </td>

                    <td className="px-4 py-4">
                      <div className="flex items-center space-x-1.5 font-mono text-gray-200">
                        <code className="bg-[#141517] px-2 py-0.5 rounded border border-gray-700 text-[11px]">
                          {u.plainPasswordHint || '******'}
                        </code>
                        {u.plainPasswordHint && (
                          <button
                            onClick={() => copyToClipboard(u.plainPasswordHint, idx)}
                            className="p-1 text-gray-400 hover:text-white"
                            title="複製密碼"
                          >
                            {copiedIndex === idx ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      <div className={`font-semibold font-mono ${isExp ? 'text-red-400' : (u.expiresAt ? 'text-indigo-300' : 'text-emerald-400')}`}>
                        {u.remainingText}
                      </div>
                      {u.expiresAt && (
                        <div className="text-[10px] text-gray-500">
                          到期日: {new Date(u.expiresAt).toLocaleDateString('zh-TW')}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-4 min-w-[150px]">
                      <div className="flex items-center justify-between text-[11px] mb-1 font-mono">
                        <span className="text-gray-200 font-semibold">{u.usedStorageMB || 0} MB</span>
                        <span className="text-gray-400">/ {u.maxStorageMB || 100} MB</span>
                      </div>
                      <div className="w-full bg-[#141517] h-1.5 rounded-full overflow-hidden border border-gray-700/60">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            (u.storageUsagePercent || 0) > 90
                              ? 'bg-red-500'
                              : (u.storageUsagePercent || 0) > 70
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                          style={{ width: `${Math.min(100, Math.max(2, u.storageUsagePercent || 0))}%` }}
                        />
                      </div>
                      <div className="text-[10px] text-gray-400 mt-1 flex justify-between">
                        <span>已用 {u.storageUsagePercent || 0}%</span>
                        <span className="text-cyan-400">{u.botCount || 0} 台機器人</span>
                      </div>
                    </td>

                    <td className="px-4 py-4">
                      {isSuspended ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-400 border border-amber-800">
                          已凍結
                        </span>
                      ) : isExp ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-red-950 text-red-400 border border-red-800">
                          已過期
                        </span>
                      ) : (
                        <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-400 border border-emerald-800">
                          正常有效
                        </span>
                      )}
                    </td>

                    <td className="px-6 py-4 text-right">
                      {!isSuper ? (
                        <div className="flex items-center justify-end space-x-1.5">
                          {/* 調配空間 */}
                          <button
                            onClick={() => handleOpenQuotaModal(u)}
                            className="px-2 py-1 rounded-lg bg-cyan-950/80 text-cyan-300 border border-cyan-800/80 hover:bg-cyan-900 text-[11px] font-medium transition flex items-center space-x-1 shrink-0 whitespace-nowrap"
                            title="調配此買家的空間配額 (MB) 與機器人上限"
                          >
                            <HardDrive className="w-3 h-3 text-cyan-400 shrink-0" />
                            <span>調配空間</span>
                          </button>

                          {/* 一鍵直登連結 */}
                          <button
                            onClick={() => copyDirectLoginLink(u.email, u.plainPasswordHint, idx)}
                            className="px-2 py-1 rounded-lg bg-indigo-600/20 text-indigo-300 border border-indigo-500/40 hover:bg-indigo-600 hover:text-white text-[11px] font-medium transition flex items-center space-x-1 whitespace-nowrap shrink-0"
                            title="複製此買家專屬的一鍵直登連結，買家點開即自動登入！"
                          >
                            {copiedLinkIndex === idx ? <Check className="w-3 h-3 text-emerald-400 shrink-0" /> : <Sparkles className="w-3 h-3 text-indigo-400 shrink-0" />}
                            <span>{copiedLinkIndex === idx ? '已複製！' : '直登連結'}</span>
                          </button>

                          {/* 展延按鈕 */}
                          <div className="relative inline-block group">
                            <button
                              onClick={() => handleExtend(u.email, 30)}
                              className="px-2.5 py-1 rounded-lg bg-indigo-950 text-indigo-300 border border-indigo-800 hover:bg-indigo-900 text-[11px] font-medium transition whitespace-nowrap shrink-0"
                            >
                              +30天
                            </button>
                          </div>

                          <button
                            onClick={() => handleExtend(u.email, 'permanent')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900 text-[11px] font-medium transition whitespace-nowrap shrink-0"
                            title="設為永久"
                          >
                            設永久
                          </button>

                          {/* 凍結切換 */}
                          <button
                            onClick={() => handleToggleStatus(u.email)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white transition shrink-0"
                            title={isSuspended ? '解除凍結' : '暫時凍結'}
                          >
                            {isSuspended ? <Unlock className="w-3.5 h-3.5 text-emerald-400 shrink-0" /> : <Lock className="w-3.5 h-3.5 text-amber-400 shrink-0" />}
                          </button>

                          {/* 刪除 */}
                          <button
                            onClick={() => handleDelete(u.email)}
                            className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-900/50 text-gray-400 hover:text-red-400 transition shrink-0"
                            title="移除此授權"
                          >
                            <Trash2 className="w-3.5 h-3.5 shrink-0" />
                          </button>
                        </div>
                      ) : (
                        <span className="text-[11px] text-gray-500 italic">最高總管</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* 機器人雲端永續防失守護 (Bot Cloud Vault) */}
      <div className="bg-[#1e1f22] p-5 rounded-2xl border border-[#2b2d31] shadow-xl">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-purple-950/60 text-purple-400 border border-purple-800/50 shrink-0">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h3 className="text-sm font-bold text-white">全自動雲端永續儲存庫 (Bot Cloud Vault)</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800/80 shrink-0">
                  三重備份防護中
                </span>
              </div>
              <p className="text-xs text-gray-400 mt-0.5">
                徹底解決 Render 重新部署容器重置問題，保障所有買家與自訂機器人程式碼、Token、.env 永久留存。
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2 shrink-0 flex-wrap sm:flex-nowrap gap-y-2">
            <button
              onClick={handleCopyBotsEnv}
              disabled={isExporting}
              className="px-3.5 py-2 rounded-xl bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold transition flex items-center space-x-1.5 shadow-md shadow-discord-blurple/20 whitespace-nowrap shrink-0"
            >
              {copiedBackupEnv ? <Check className="w-3.5 h-3.5 text-emerald-300 shrink-0" /> : <Copy className="w-3.5 h-3.5 shrink-0" />}
              <span>{copiedBackupEnv ? '已複製 RPJG_BOTS_BACKUP' : '複製 RPJG_BOTS_BACKUP (Render環境變數)'}</span>
            </button>

            <button
              onClick={handleDownloadBotsZip}
              className="px-3 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white border border-[#35373c] text-xs font-medium transition flex items-center space-x-1.5 whitespace-nowrap shrink-0"
              title="下載所有機器人專案 ZIP 備份包"
            >
              <Download className="w-3.5 h-3.5 shrink-0" />
              <span>下載全站 Bot ZIP</span>
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 text-xs">
          <div className="p-3 rounded-xl bg-[#141517] border border-[#2b2d31]">
            <div className="text-gray-400 font-medium">第一重：Git 儲存庫追蹤</div>
            <div className="mt-1 font-mono text-emerald-400 flex items-center space-x-1">
              <CheckCircle className="w-3.5 h-3.5 shrink-0" />
              <span>server/bots/ 與 bots_backup.json</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">已納入版本庫，推送部署永不遺失</div>
          </div>

          <div className="p-3 rounded-xl bg-[#141517] border border-[#2b2d31]">
            <div className="text-gray-400 font-medium">第二重：環境變數永續注入</div>
            <div className="mt-1 font-mono text-indigo-400 flex items-center space-x-1">
              <Key className="w-3.5 h-3.5 shrink-0" />
              <span>RPJG_BOTS_BACKUP</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">複製後填入 Render 後台即可無條件保固</div>
          </div>

          <div className="p-3 rounded-xl bg-[#141517] border border-[#2b2d31]">
            <div className="text-gray-400 font-medium">第三重：當前已守護機器人</div>
            <div className="mt-1 font-bold text-white flex items-center space-x-1.5">
              <span className="text-base text-purple-400 font-mono">{botsBackupCount}</span>
              <span>個機器人已受保護</span>
            </div>
            <div className="text-[11px] text-gray-500 mt-0.5">系統重啟 3 秒內自動熱喚醒在線</div>
          </div>
        </div>
      </div>

      {/* 調配空間與配額彈出視窗 */}
      {isQuotaModalOpen && quotaTargetUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in">
          <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl w-full max-w-md overflow-hidden shadow-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2d31] bg-[#141517]">
              <div className="flex items-center space-x-2">
                <HardDrive className="w-5 h-5 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">調配買家空間與配額</h3>
              </div>
              <button
                onClick={() => setIsQuotaModalOpen(false)}
                className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveQuota} className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-xl bg-[#141517] border border-[#2b2d31]">
                <div className="text-gray-400">目標買家帳號</div>
                <div className="text-white font-mono font-bold text-sm mt-0.5">{quotaTargetUser.email}</div>
                <div className="text-gray-400 mt-1 flex items-center justify-between text-[11px]">
                  <span>目前已用空間: <strong className="text-emerald-400 font-mono">{quotaTargetUser.usedStorageMB || 0} MB</strong></span>
                  <span>託管機器人: <strong className="text-indigo-400 font-mono">{quotaTargetUser.botCount || 0} 台</strong></span>
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1 flex items-center justify-between">
                  <span>派發儲存空間限額 (MB)</span>
                  <span className="text-cyan-400 font-mono font-bold">{editStorageMB} MB</span>
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    type="number"
                    min="10"
                    max="10240"
                    value={editStorageMB}
                    onChange={(e) => setEditStorageMB(e.target.value)}
                    className="w-full bg-[#141517] text-white p-2.5 rounded-xl border border-[#35373c] font-mono text-sm"
                    required
                  />
                  <span className="text-gray-400 shrink-0">MB</span>
                </div>

                <div className="grid grid-cols-4 gap-1.5 mt-2">
                  {[50, 100, 200, 500].map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setEditStorageMB(sz)}
                      className={`py-1.5 rounded-lg text-center font-mono text-[11px] transition ${
                        parseInt(editStorageMB) === sz
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-[#141517] text-gray-300 border border-gray-700 hover:bg-gray-800'
                      }`}
                    >
                      {sz}MB
                    </button>
                  ))}
                  {[1024, 2048, 5120, 10240].map(sz => (
                    <button
                      key={sz}
                      type="button"
                      onClick={() => setEditStorageMB(sz)}
                      className={`py-1.5 rounded-lg text-center font-mono text-[11px] transition ${
                        parseInt(editStorageMB) === sz
                          ? 'bg-cyan-600 text-white font-bold'
                          : 'bg-[#141517] text-gray-300 border border-gray-700 hover:bg-gray-800'
                      }`}
                    >
                      {sz / 1024}GB
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-300 font-medium mb-1">
                  允許託管機器人數量上限 (台)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={editMaxBots}
                  onChange={(e) => setEditMaxBots(e.target.value)}
                  className="w-full bg-[#141517] text-white p-2.5 rounded-xl border border-[#35373c] font-mono text-sm"
                  required
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-[#2b2d31]">
                <button
                  type="button"
                  onClick={() => setIsQuotaModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-300 text-xs font-semibold transition"
                >
                  取消
                </button>
                <button
                  type="submit"
                  disabled={isSavingQuota}
                  className="px-5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition flex items-center space-x-1.5 shadow-lg shadow-cyan-600/30"
                >
                  {isSavingQuota ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                  <span>{isSavingQuota ? '儲存中...' : '確認保存調配'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
