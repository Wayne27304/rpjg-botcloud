/**
 * ================================================================
 * RPJG BotCloud - 經銷代理商管理後台 (Reseller Agent Portal)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import React, { useState, useEffect } from 'react';
import {
  Award,
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
  Calendar,
  Sparkles,
  HardDrive,
  Bot,
  Activity,
  AlertTriangle,
  Mail,
  Send,
  Sliders,
  CheckCircle2,
  ExternalLink,
  Eye,
  EyeOff
} from 'lucide-react';
import GlobalAuditLogsModal from './GlobalAuditLogsModal';

export default function ResellerPortal({ currentUser, bots = [] }) {
  const [overview, setOverview] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);
  const [showResellerKey, setShowResellerKey] = useState(false);
  const [copiedResellerKey, setCopiedResellerKey] = useState(false);

  // 派發新客戶表單
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [maxStorageMB, setMaxStorageMB] = useState(100);
  const [maxBots, setMaxBots] = useState(5);
  const [durationType, setDurationType] = useState('30d');
  const [customDays, setCustomDays] = useState(14);
  const [note, setNote] = useState('');
  const [formStatus, setFormStatus] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [copiedKeyIndex, setCopiedKeyIndex] = useState(null);

  const handleCopyResellerKey = () => {
    if (currentUser?.plainPasswordHint) {
      navigator.clipboard.writeText(currentUser.plainPasswordHint);
      setCopiedResellerKey(true);
      setTimeout(() => setCopiedResellerKey(false), 2500);
    }
  };

  const fetchOverview = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/reseller/overview', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setOverview(data);
      }
    } catch (e) {
      console.error('抓取代理商配額大盤失敗:', e);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOverview();
  }, []);

  const handleGeneratePassword = () => {
    const randomPwd = 'rpjg_' + Math.random().toString(36).substring(2, 8);
    setPassword(randomPwd);
  };

  const handleAuthorizeClient = async (e) => {
    e.preventDefault();
    if (!email.trim()) return;

    if (currentUser?.isResellerDisabled) {
      setFormStatus({ type: 'error', message: '您的經銷代理商權限已被最高主管停用，無法派發客戶。如有疑問請聯絡主管。' });
      return;
    }

    setIsSubmitting(true);
    setFormStatus(null);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/reseller/authorize', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          email: email.trim(),
          displayName: displayName.trim() || undefined,
          password: password.trim() || undefined,
          maxStorageMB: parseInt(maxStorageMB) || 100,
          maxBots: parseInt(maxBots) || 5,
          durationType,
          customDays,
          note: note.trim()
        })
      });
      const data = await res.json();
      if (data.success) {
        setFormStatus({
          type: 'success',
          message: `客戶 ${email} 開通成功！授權密碼：${data.generatedPassword} (已同步寄出 Gmail 認證通知與登入資訊)`
        });
        setEmail('');
        setDisplayName('');
        setPassword('');
        setNote('');
        fetchOverview();
      } else {
        setFormStatus({
          type: 'error',
          message: `開通失敗：${data.message}`
        });
      }
    } catch (err) {
      setFormStatus({ type: 'error', message: `伺服器通訊錯誤: ${err.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteClient = async (clientEmail) => {
    if (!confirm(`確定要收回並刪除客戶 ${clientEmail} 的授權嗎？其所佔用的額度將會全額返還給您的代理池。`)) return;
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/reseller/users/${encodeURIComponent(clientEmail)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        fetchOverview();
      } else {
        alert(data.message || '刪除失敗');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const pool = overview?.pool || {
    totalQuotaMB: currentUser?.resellerQuotaMB || 5000,
    allocatedQuotaMB: 0,
    remainingQuotaMB: currentUser?.resellerQuotaMB || 5000,
    totalMaxBots: currentUser?.resellerMaxBots || 20,
    allocatedBots: 0,
    remainingBots: currentUser?.resellerMaxBots || 20,
    totalMaxUsers: currentUser?.resellerMaxUsers || 10,
    subUserCount: 0,
    remainingUsers: currentUser?.resellerMaxUsers || 10
  };

  const subUsers = overview?.subUsers || [];
  const storagePercent = pool.totalQuotaMB > 0 ? Math.min(100, +((pool.allocatedQuotaMB / pool.totalQuotaMB) * 100).toFixed(1)) : 0;
  const botPercent = pool.totalMaxBots > 0 ? Math.min(100, +((pool.allocatedBots / pool.totalMaxBots) * 100).toFixed(1)) : 0;
  const userPercent = pool.totalMaxUsers > 0 ? Math.min(100, +((pool.subUserCount / pool.totalMaxUsers) * 100).toFixed(1)) : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 lg:px-8 py-8 space-y-8 animate-in fade-in duration-300">
      {/* 經銷商權限停用警示 */}
      {currentUser?.isResellerDisabled && (
        <div className="p-4 rounded-2xl bg-red-950/80 border border-red-800 text-red-200 text-xs flex items-center space-x-3 shadow-lg">
          <AlertTriangle className="w-6 h-6 text-red-400 shrink-0" />
          <div>
            <div className="font-bold text-sm text-red-300">經銷代理商權限已被最高主管停用</div>
            <div className="text-[11px] text-gray-300 mt-0.5">
              您目前的代理派發權限已被管理員暫時凍結，無法派發新客戶或調配額度。現有客戶與機器人運行不受影響。如有疑問請聯絡最高主管。
            </div>
          </div>
        </div>
      )}

      {/* 標題與操作區 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-amber-500/10 via-purple-500/10 to-indigo-500/10 p-6 rounded-2xl border border-amber-500/30">
        <div className="flex items-center space-x-4">
          <div className="p-3 bg-amber-500/20 text-amber-300 rounded-2xl border border-amber-500/40 shadow-lg shadow-amber-500/20">
            <Award className="w-8 h-8" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h1 className="text-xl lg:text-2xl font-black text-white tracking-wide">
                經銷代理商管理後台
              </h1>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40">
                Reseller Agent
              </span>
            </div>
            <p className="text-xs text-gray-400 mt-1">
              由最高主管授權之經銷代理商 • 配額自主調配與客戶開通中心 (R.P.J.G 開發部門)
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button
            onClick={() => setIsAuditModalOpen(true)}
            className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-[#2b2d31] hover:bg-gray-700 text-gray-200 text-xs font-semibold transition border border-gray-700"
          >
            <Activity className="w-4 h-4 text-indigo-400" />
            <span>日誌與審計紀錄</span>
          </button>
          <button
            onClick={fetchOverview}
            className="p-2.5 bg-[#2b2d31] hover:bg-gray-700 text-gray-300 rounded-xl transition"
            title="重新整理數據"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 經銷商專屬授權憑證與密鑰存儲專區 (密鑰存處清晰透明) */}
      <div className="bg-[#1e1f22] border border-amber-500/30 rounded-2xl p-6 shadow-xl relative overflow-hidden">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start space-x-4">
            <div className="p-3 rounded-2xl bg-amber-500/20 text-amber-400 border border-amber-500/40 shrink-0">
              <Key className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                  官方核發 • 經銷商專屬授權憑證
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                  安全加密保存於雲端資料庫
                </span>
              </div>
              <h2 className="text-base font-bold text-white mt-1">
                經銷代理專屬密鑰 (Reseller License Key)
              </h2>
              <p className="text-xs text-gray-400 mt-0.5 leading-relaxed">
                此密鑰為您登入本後台與轉派客戶額度的專屬憑證，已由系統安全中心永久保存。
              </p>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 bg-[#141517] p-3 rounded-xl border border-[#2b2d31]">
            <div className="space-y-1">
              <span className="text-[11px] text-gray-400 block">您的授權金鑰</span>
              <div className="flex items-center space-x-2">
                <code className="bg-[#1e1f22] px-3 py-1.5 rounded-lg border border-gray-700 text-sm font-mono font-bold text-cyan-300">
                  {showResellerKey ? (currentUser?.plainPasswordHint || '******') : '••••••••••••'}
                </code>
                <button
                  type="button"
                  onClick={() => setShowResellerKey(!showResellerKey)}
                  className="p-1.5 text-gray-400 hover:text-white rounded-lg hover:bg-gray-800 transition"
                  title={showResellerKey ? '隱藏密鑰' : '顯示密鑰'}
                >
                  {showResellerKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={handleCopyResellerKey}
              className="px-4 py-2 rounded-xl bg-amber-500 hover:bg-amber-400 text-black font-bold text-xs transition flex items-center justify-center space-x-1.5 shadow-md shadow-amber-500/20 shrink-0"
            >
              {copiedResellerKey ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedResellerKey ? '已複製密鑰！' : '一鍵複製經銷密鑰'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* 代理商配額總盤卡片 (3 大指標) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 儲存空間池 */}
        <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <HardDrive className="w-5 h-5 text-indigo-400" />
              <span className="text-xs font-bold text-gray-300">代理儲存空間池</span>
            </div>
            <span className="text-xs font-mono text-indigo-300 font-semibold">{storagePercent}%</span>
          </div>

          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-2xl font-black text-white font-mono">{pool.remainingQuotaMB}</span>
            <span className="text-xs text-gray-400">MB 可用剩餘 / 總 {pool.totalQuotaMB} MB</span>
          </div>

          <div className="w-full bg-[#141517] h-2 rounded-full overflow-hidden border border-gray-800 mb-3">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${storagePercent}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-gray-400">
            已派發給客戶：<strong className="text-white font-mono">{pool.allocatedQuotaMB} MB</strong>
          </p>
        </div>

        {/* 機器人名額池 */}
        <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <Bot className="w-5 h-5 text-emerald-400" />
              <span className="text-xs font-bold text-gray-300">機器人總名額池</span>
            </div>
            <span className="text-xs font-mono text-emerald-300 font-semibold">{botPercent}%</span>
          </div>

          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-2xl font-black text-white font-mono">{pool.remainingBots}</span>
            <span className="text-xs text-gray-400">台 可派發剩餘 / 總 {pool.totalMaxBots} 台</span>
          </div>

          <div className="w-full bg-[#141517] h-2 rounded-full overflow-hidden border border-gray-800 mb-3">
            <div
              className="bg-gradient-to-r from-emerald-500 to-teal-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${botPercent}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-gray-400">
            已分配給客戶：<strong className="text-white font-mono">{pool.allocatedBots} 台</strong>
          </p>
        </div>

        {/* 客戶帳號名額 */}
        <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 shadow-xl relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2.5">
              <Users className="w-5 h-5 text-amber-400" />
              <span className="text-xs font-bold text-gray-300">旗下客戶帳號額度</span>
            </div>
            <span className="text-xs font-mono text-amber-300 font-semibold">{userPercent}%</span>
          </div>

          <div className="flex items-baseline space-x-2 mb-2">
            <span className="text-2xl font-black text-white font-mono">{pool.remainingUsers}</span>
            <span className="text-xs text-gray-400">名 剩餘可建 / 總上限 {pool.totalMaxUsers} 人</span>
          </div>

          <div className="w-full bg-[#141517] h-2 rounded-full overflow-hidden border border-gray-800 mb-3">
            <div
              className="bg-gradient-to-r from-amber-500 to-orange-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${userPercent}%` }}
            ></div>
          </div>
          <p className="text-[11px] text-gray-400">
            目前旗下活躍客戶：<strong className="text-white font-mono">{pool.subUserCount} 人</strong>
          </p>
        </div>
      </div>

      {/* 派發客戶帳號表單區 */}
      <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center space-x-3 mb-6 pb-4 border-b border-[#2b2d31]">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-xl">
            <UserPlus className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white">派發新客戶帳號 (Authorize Buyer)</h2>
            <p className="text-xs text-gray-400">
              自主指派買家之儲存空間與機器人台數（將自動從您的代理配額池扣除）並自動寄發 Gmail 認證信
            </p>
          </div>
        </div>

        {formStatus && (
          <div
            className={`p-4 rounded-xl text-xs flex items-center space-x-3 mb-6 border ${
              formStatus.type === 'success'
                ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                : 'bg-rose-500/10 text-rose-300 border-rose-500/30'
            }`}
          >
            {formStatus.type === 'success' ? (
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-400" />
            ) : (
              <AlertTriangle className="w-5 h-5 shrink-0 text-rose-400" />
            )}
            <span className="leading-relaxed font-mono">{formStatus.message}</span>
          </div>
        )}

        <form onSubmit={handleAuthorizeClient} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* 客戶 Email */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center space-x-1">
                <span>客戶 Gmail / 帳號 Email</span>
                <span className="text-rose-400">*</span>
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="買家帳號 (如: buyer@gmail.com)"
                  className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 客戶稱呼 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">客戶稱呼 / 暱稱</label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="選填 (例如: 蝦皮買家 - 阿華)"
                className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* 密碼設定 */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-300">登入授權密碼</label>
                <button
                  type="button"
                  onClick={handleGeneratePassword}
                  className="text-[11px] text-amber-400 hover:text-amber-300 font-semibold flex items-center space-x-1"
                >
                  <Sparkles className="w-3 h-3" />
                  <span>隨機產生</span>
                </button>
              </div>
              <div className="relative">
                <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
                <input
                  type="text"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="留空則自動生成隨機密碼"
                  className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl pl-9 pr-3 py-2.5 text-xs text-white placeholder-gray-500 font-mono focus:outline-none focus:border-indigo-500"
                />
              </div>
            </div>

            {/* 派發儲存空間 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>派發儲存容量 (MB)</span>
                <span className="text-[11px] text-gray-400 font-mono">
                  剩餘可配: {pool.remainingQuotaMB} MB
                </span>
              </label>
              <input
                type="number"
                min="10"
                max={pool.remainingQuotaMB}
                value={maxStorageMB}
                onChange={(e) => setMaxStorageMB(e.target.value)}
                className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* 派發機器人數量 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300 flex items-center justify-between">
                <span>機器人上限 (台)</span>
                <span className="text-[11px] text-gray-400 font-mono">
                  剩餘可配: {pool.remainingBots} 台
                </span>
              </label>
              <input
                type="number"
                min="1"
                max={pool.remainingBots}
                value={maxBots}
                onChange={(e) => setMaxBots(e.target.value)}
                className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
              />
            </div>

            {/* 授權有效期限 */}
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-gray-300">授權使用天數</label>
              <div className="flex items-center space-x-2">
                <select
                  value={durationType}
                  onChange={(e) => setDurationType(e.target.value)}
                  className="bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:border-indigo-500 flex-1"
                >
                  <option value="30d">30 天 (月租)</option>
                  <option value="7d">7 天 (週租體驗)</option>
                  <option value="1d">1 天 (單日測試)</option>
                  <option value="custom">自訂天數</option>
                  <option value="permanent">永久買斷授權</option>
                </select>

                {durationType === 'custom' && (
                  <input
                    type="number"
                    min="1"
                    value={customDays}
                    onChange={(e) => setCustomDays(e.target.value)}
                    className="w-20 bg-[#141517] border border-[#2b2d31] rounded-xl px-2 py-2.5 text-xs text-white font-mono focus:outline-none focus:border-indigo-500"
                    placeholder="天數"
                  />
                )}
              </div>
            </div>
          </div>

          {/* 備註 */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-gray-300">訂單備註 / 客戶備註</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="例：蝦皮訂單編號 #20260911001"
              className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-2.5 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
            />
          </div>

          {/* 提醒與提交按鈕 */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="text-xs text-gray-400 flex items-center space-x-2">
              <Mail className="w-4 h-4 text-emerald-400 shrink-0" />
              <span>
                開通成功後，系統將<strong>自動以 Gmail 寄發帳密、登入連結與使用教學</strong>至客戶信箱。
              </span>
            </div>

            <button
              type="submit"
              disabled={isSubmitting || pool.remainingQuotaMB <= 0 || pool.remainingUsers <= 0}
              className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-indigo-600 hover:from-amber-600 hover:to-indigo-700 text-white font-bold text-xs shadow-lg shadow-indigo-500/25 transition flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed shrink-0"
            >
              {isSubmitting ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              <span>立即扣除配額並派發開通</span>
            </button>
          </div>
        </form>
      </div>

      {/* 旗下客戶清單列表 */}
      <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl p-6 lg:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-amber-500/20 text-amber-300 rounded-xl">
              <Users className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold text-white">旗下客戶名冊與用量監控</h2>
              <p className="text-xs text-gray-400">
                目前共管理 <strong className="text-white font-mono">{subUsers.length}</strong> 位客戶
              </p>
            </div>
          </div>
        </div>

        {subUsers.length === 0 ? (
          <div className="py-16 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="text-sm font-semibold">目前尚未派發任何客戶帳號</p>
            <p className="text-xs text-gray-600 mt-1">
              請在上方的「派發新客戶帳號」中填寫買家 Gmail 即可立即為其開通雲端託管權限！
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[750px] text-left text-xs border-collapse">
              <thead className="bg-[#141517] text-gray-400 border-b border-[#2b2d31]">
                <tr>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">客戶 Email / 稱呼</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">授權密碼提示</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">配發空間 (MB)</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">機器人台數</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">效期狀態</th>
                  <th className="py-3 px-4 font-semibold whitespace-nowrap">備註</th>
                  <th className="py-3 px-4 font-semibold text-right whitespace-nowrap">管理操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#2b2d31]/50 text-gray-300 font-mono">
                {subUsers.map((client, idx) => (
                  <tr key={client.email} className="hover:bg-white/[0.02] transition">
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="font-bold text-white text-xs">{client.email}</div>
                      <div className="text-[11px] text-gray-400">{client.displayName}</div>
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      <div className="flex items-center space-x-1.5">
                        <span className="text-gray-300 text-[11px]">
                          {client.plainPasswordHint || '******'}
                        </span>
                        {client.plainPasswordHint && (
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(client.plainPasswordHint);
                              setCopiedKeyIndex(idx);
                              setTimeout(() => setCopiedKeyIndex(null), 2000);
                            }}
                            className="p-1 text-gray-400 hover:text-white transition"
                            title="複製密碼"
                          >
                            {copiedKeyIndex === idx ? (
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-indigo-300 font-semibold whitespace-nowrap">
                      {client.maxStorageMB || 100} MB
                    </td>
                    <td className="py-3 px-4 text-emerald-300 font-semibold whitespace-nowrap">
                      {client.maxBots || 5} 台
                    </td>
                    <td className="py-3 px-4 whitespace-nowrap">
                      {client.expiresAt ? (
                        <span className="text-amber-400 text-[11px] whitespace-nowrap inline-block">
                          {new Date(client.expiresAt).toLocaleDateString('zh-TW')} 到期
                        </span>
                      ) : (
                        <span className="text-emerald-400 text-[11px] whitespace-nowrap inline-block">永久有效</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-gray-400 text-[11px] max-w-xs truncate">
                      {client.note || '-'}
                    </td>
                    <td className="py-3 px-4 text-right whitespace-nowrap">
                      <button
                        onClick={() => handleDeleteClient(client.email)}
                        className="p-1.5 bg-red-900/20 hover:bg-red-900/50 text-red-400 rounded-lg transition"
                        title="收回並刪除此客戶（額度返還）"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 審計與遠端監控彈窗 */}
      <GlobalAuditLogsModal
        isOpen={isAuditModalOpen}
        onClose={() => setIsAuditModalOpen(false)}
        currentUser={currentUser}
        bots={bots}
      />
    </div>
  );
}
