import React, { useState, useEffect } from 'react';
import {
  Bot,
  Plus,
  Play,
  Square,
  RefreshCw,
  Terminal,
  FolderCode,
  KeyRound,
  Activity,
  Settings,
  Trash2,
  Info,
  Search,
  Shield,
  Cpu,
  HardDrive,
  AlertTriangle,
  Upload,
  Crown,
  LogOut,
  UserCheck,
  Clock,
  Layers,
  Globe,
  Eye,
  ShieldAlert,
  Radio
} from 'lucide-react';

import Login from './components/Login';
import Console from './components/Console';
import FileManager from './components/FileManager';
import EnvEditor from './components/EnvEditor';
import MetricsPanel from './components/MetricsPanel';
import UploadBotModal from './components/UploadBotModal';
import AuthManagement from './components/AuthManagement';
import ResellerPortal from './components/ResellerPortal';
import GlobalAuditLogsModal from './components/GlobalAuditLogsModal';
import AboutModal from './components/AboutModal';

export default function App() {
  const [currentUser, setCurrentUser] = useState(null);
  const [isAuthChecking, setIsAuthChecking] = useState(true);

  // 主頁面導航狀態：'dashboard' | 'auth_management' | 'reseller_portal'
  const [currentView, setCurrentView] = useState('dashboard');
  const [isGlobalAuditOpen, setIsGlobalAuditOpen] = useState(false);

  const [bots, setBots] = useState([]);
  const [selectedBotId, setSelectedBotId] = useState(null);
  const [showAllBots, setShowAllBots] = useState(false); // 管理員全站機器人檢視開關
  const [activeTab, setActiveTab] = useState('console');
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [isAboutModalOpen, setIsAboutModalOpen] = useState(false);
  const [isActionLoading, setIsActionLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [telemetry, setTelemetry] = useState({
    activeBots: 0,
    totalBots: 0,
    clusterLoad: 18.2,
    totalRamUsed: 140,
    ping: 16
  });
  const [wsConnected, setWsConnected] = useState(false);

  // 1. 初始化檢查使用者登入狀態
  useEffect(() => {
    const token = localStorage.getItem('rpjg_auth_token');
    if (!token) {
      setIsAuthChecking(false);
      return;
    }

    fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.user) {
          setCurrentUser(data.user);
        } else {
          localStorage.removeItem('rpjg_auth_token');
          localStorage.removeItem('rpjg_auth_user');
          setCurrentUser(null);
        }
      })
      .catch(() => {
        setCurrentUser(null);
      })
      .finally(() => {
        setIsAuthChecking(false);
      });
  }, []);

  // 2. 取得機器人清單 (每個人預設只看自己的機器人；管理員可帶 ?all=true 切換全站視角)
  const fetchBots = async (showAll = showAllBots) => {
    const token = localStorage.getItem('rpjg_auth_token');
    if (!token) return;

    try {
      const url = `/api/bots${showAll ? '?all=true' : ''}`;
      const res = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.bots) {
        setBots(data.bots);
        if (data.bots.length > 0) {
          if (!selectedBotId || !data.bots.some(b => b.id === selectedBotId)) {
            setSelectedBotId(data.bots[0].id);
          }
        } else {
          setSelectedBotId(null);
        }
      }
    } catch (e) {
      console.error('無法取得機器人列表:', e);
    }
  };

  useEffect(() => {
    if (currentUser) {
      fetchBots(showAllBots);
    }
  }, [currentUser, showAllBots]);

  // 3. WebSocket 串流監聽
  useEffect(() => {
    if (!currentUser) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/ws`;

    let ws = null;
    let reconnectTimeout = null;

    const connectWs = () => {
      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'log') {
            window.dispatchEvent(new CustomEvent('rpjg:bot_log', { detail: msg }));
          } else if (msg.type === 'logs_cleared') {
            window.dispatchEvent(new CustomEvent('rpjg:logs_cleared', { detail: msg }));
          } else if (msg.type === 'bot_status') {
            setBots(prev => prev.map(b => b.id === msg.botId ? { ...b, status: msg.status } : b));
          } else if (msg.type === 'telemetry') {
            setTelemetry(msg.data);
          } else if (msg.type === 'bot_deleted') {
            setBots(prev => prev.filter(b => b.id !== msg.botId));
          }
        } catch (err) {
          console.error('WS 解析錯誤:', err);
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        reconnectTimeout = setTimeout(connectWs, 3000);
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connectWs();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, [currentUser]);

  const handleLogout = () => {
    localStorage.removeItem('rpjg_auth_token');
    localStorage.removeItem('rpjg_auth_user');
    setCurrentUser(null);
    setBots([]);
    setSelectedBotId(null);
  };

  const handleStartBot = async (id) => {
    setIsActionLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${id}/start`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'ONLINE' } : b));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleStopBot = async (id) => {
    setIsActionLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${id}/stop`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'OFFLINE' } : b));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleRestartBot = async (id) => {
    setIsActionLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${id}/restart`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'ONLINE' } : b));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSuspendHosting = async (id) => {
    if (!confirm('確定要停用此機器人的託管服務嗎？進程將被終止，自動重啟守護機制將會解除。')) return;
    setIsActionLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${id}/suspend`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'DISABLED' } : b));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleResumeHosting = async (id) => {
    setIsActionLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${id}/resume`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setBots(prev => prev.map(b => b.id === id ? { ...b, status: 'OFFLINE' } : b));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDeleteBot = async (id) => {
    if (!confirm('確定要永久刪除此機器人嗎？該操作將移除其所有檔案與日誌。')) return;
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      await fetch(`/api/bots/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      setBots(prev => {
        const next = prev.filter(b => b.id !== id);
        if (selectedBotId === id) {
          setSelectedBotId(next.length > 0 ? next[0].id : null);
        }
        return next;
      });
    } catch (e) {
      console.error(e);
    }
  };

  const handleBotCreated = (newBot) => {
    setBots(prev => [newBot, ...prev]);
    setSelectedBotId(newBot.id);
    setCurrentView('dashboard');
  };

  if (isAuthChecking) {
    return (
      <div className="min-h-screen bg-[#0e0f11] flex items-center justify-center text-gray-400 font-mono text-xs">
        <RefreshCw className="w-5 h-5 animate-spin mr-2 text-discord-blurple" />
        <span>正在驗證 RPJG 授權金鑰...</span>
      </div>
    );
  }

  // 若未登入，強制顯示登入驗證頁面
  if (!currentUser) {
    return <Login onLoginSuccess={(user) => setCurrentUser(user)} />;
  }

  const isSuperAdmin = currentUser?.isSuperAdmin;
  const selectedBot = bots.find(b => b.id === selectedBotId) || bots[0];
  const filteredBots = bots.filter(b => b.name.toLowerCase().includes(searchTerm.toLowerCase()));
  const onlineCount = bots.filter(b => b.status === 'ONLINE').length;

  return (
    <div className="min-h-screen bg-discord-darkest flex flex-col">
      {/* 頂部導航欄 (Top Navigation Bar) */}
      <header className="sticky top-0 z-40 bg-[#1e1f22]/90 backdrop-blur-md border-b border-[#2b2d31] px-4 lg:px-8 py-3">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* 品牌標識區 */}
          <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setCurrentView('dashboard')}>
            <div className="p-2 rounded-xl bg-discord-blurple text-white shadow-lg shadow-discord-blurple/25">
              <Bot className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-extrabold text-white text-base lg:text-lg tracking-wide">
                  RPJG BotCloud
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  作者：R.P.J.G 開發部門
                </span>
              </div>
              <p className="text-[11px] text-gray-400 hidden sm:block">
                Discord Bot 雲端線上託管 • 自訂專案上傳
              </p>
            </div>
          </div>

          {/* 右側導航按鈕與使用者狀態 */}
          <div className="flex items-center space-x-3">
            {/* 節點狀態 Pill */}
            <div className="hidden md:flex items-center space-x-2 px-3 py-1.5 rounded-lg bg-[#141517] border border-[#2b2d31] text-xs">
              <div className={`w-2 h-2 rounded-full ${wsConnected ? 'bg-emerald-400' : 'bg-amber-400 animate-pulse'}`}></div>
              <span className="text-gray-300 font-mono">RPJG-TW-01</span>
              <span className="text-emerald-400 font-mono text-[11px]">{telemetry.ping}ms</span>
            </div>

            {/* 全域日誌與審計按鈕 (Super Admin 或 經銷代理商) */}
            {(isSuperAdmin || currentUser?.role === 'RESELLER') && (
              <button
                onClick={() => setIsGlobalAuditOpen(true)}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-600/20 text-indigo-300 border border-indigo-500/30 hover:bg-indigo-600/30 transition"
                title="查看全域操作審計紀錄與遠端機器人 Console"
              >
                <Activity className="w-3.5 h-3.5" />
                <span>日誌與審計</span>
              </button>
            )}

            {/* 經銷代理商專屬：代理後台切換按鈕 */}
            {currentUser?.role === 'RESELLER' && (
              <button
                onClick={() => setCurrentView(currentView === 'reseller_portal' ? 'dashboard' : 'reseller_portal')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentView === 'reseller_portal'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30 font-black'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>代理經銷後台</span>
              </button>
            )}

            {/* 管理員專屬：授權管理中心切換按鈕 */}
            {isSuperAdmin && (
              <button
                onClick={() => setCurrentView(currentView === 'auth_management' ? 'dashboard' : 'auth_management')}
                className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                  currentView === 'auth_management'
                    ? 'bg-amber-500 text-black shadow-lg shadow-amber-500/30'
                    : 'bg-amber-500/15 text-amber-300 border border-amber-500/30 hover:bg-amber-500/25'
                }`}
              >
                <Crown className="w-4 h-4" />
                <span>授權管理中心</span>
              </button>
            )}

            {/* 管理員專屬：顯示全站所有機器人 小按鈕 */}
            {isSuperAdmin && currentView === 'dashboard' && (
              <button
                onClick={() => setShowAllBots(!showAllBots)}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition border ${
                  showAllBots
                    ? 'bg-purple-600 hover:bg-purple-500 text-white border-purple-400 shadow-md shadow-purple-900/40'
                    : 'bg-[#2b2d31] hover:bg-gray-700 text-gray-300 border-gray-600'
                }`}
                title={showAllBots ? '切換為僅顯示我託管的機器人' : '顯示全站所有用戶託管的機器人並可進行遠端控制'}
              >
                <Globe className="w-3.5 h-3.5" />
                <span>{showAllBots ? '🌐 全站機器人 (開啟中)' : '🌐 顯示所有機器人'}</span>
              </button>
            )}

            {/* 建立/上傳新機器人按鈕 */}
            <button
              onClick={() => setIsUploadModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-discord-blurple hover:bg-discord-blurple-hover text-white transition shadow-lg shadow-discord-blurple/30"
            >
              <Upload className="w-4 h-4" />
              <span>上傳建立 Bot</span>
            </button>

            {/* 關於按鈕 */}
            <button
              onClick={() => setIsAboutModalOpen(true)}
              className="p-1.5 rounded-lg text-gray-300 hover:text-white bg-[#2b2d31] hover:bg-gray-700 transition"
              title="關於 R.P.J.G"
            >
              <Info className="w-4 h-4 text-indigo-400" />
            </button>

            {/* 使用者身分卡片與登出 */}
            <div className="flex items-center space-x-2 pl-2 border-l border-gray-700">
              <div className="flex flex-col text-right max-w-[140px] sm:max-w-none truncate">
                <span className="text-xs font-bold text-white font-mono truncate">
                  {currentUser.displayName || currentUser.email}
                </span>
                <span className="text-[10px] text-emerald-400 font-mono">
                  {currentUser.expiresAt ? `效期: ${new Date(currentUser.expiresAt).toLocaleDateString('zh-TW')}` : '永久授權'}
                </span>
              </div>
              <button
                onClick={handleLogout}
                title="登出帳號"
                className="p-1.5 rounded-lg bg-gray-800 hover:bg-red-950/60 hover:text-red-400 text-gray-400 transition shrink-0"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* 全域 Telemetry 數據橫幅 */}
      <div className="bg-[#141517] border-b border-[#2b2d31] px-4 lg:px-8 py-2 text-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between text-gray-400 overflow-x-auto gap-4">
          <div className="flex items-center space-x-6 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
              <span>活躍實例：<strong className="text-white font-mono">{onlineCount}</strong> / {bots.length}</span>
            </div>
            <div className="flex items-center space-x-2">
              <Cpu className="w-3.5 h-3.5 text-indigo-400" />
              <span>叢集負載：<strong className="text-white font-mono">{telemetry.clusterLoad}%</strong></span>
            </div>
            <div className="flex items-center space-x-2">
              <HardDrive className="w-3.5 h-3.5 text-cyan-400" />
              <span>已分配記憶體：<strong className="text-white font-mono">{telemetry.totalRamUsed} MB</strong></span>
            </div>

            {/* 雲端儲存空間與配額即時指標 */}
            {currentUser && (
              <div className="flex items-center space-x-2 border-l border-gray-700/80 pl-4 shrink-0">
                <HardDrive className="w-3.5 h-3.5 text-emerald-400" />
                {isSuperAdmin ? (
                  <span>
                    主機剩餘空間：<strong className="text-emerald-400 font-mono">{telemetry.diskFreeFormatted || '充足'}</strong>
                  </span>
                ) : (
                  <div className="flex items-center space-x-2">
                    <span>
                      我的雲端空間：
                      <strong className="text-white font-mono">{currentUser.usedStorageMB || 0} MB</strong>
                      <span className="text-gray-500 font-mono"> / {currentUser.maxStorageMB || 100} MB</span>
                      <span className="text-emerald-400 font-mono ml-1.5">(剩餘 {currentUser.remainingStorageMB ?? (currentUser.maxStorageMB || 100)} MB)</span>
                    </span>
                    <div className="w-14 bg-gray-800 h-1.5 rounded-full overflow-hidden border border-gray-700">
                      <div
                        className={`h-full rounded-full transition-all ${
                          (currentUser.storageUsagePercent || 0) > 90
                            ? 'bg-red-500'
                            : (currentUser.storageUsagePercent || 0) > 70
                            ? 'bg-amber-400'
                            : 'bg-cyan-400'
                        }`}
                        style={{ width: `${Math.min(100, Math.max(5, currentUser.storageUsagePercent || 0))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="hidden sm:flex items-center space-x-2 text-[11px] text-gray-500">
            <Shield className="w-3.5 h-3.5 text-emerald-400" />
            <span>沙盒環境由 <strong className="text-indigo-300">R.P.J.G 開發部門</strong> 專屬核心防護</span>
          </div>
        </div>
      </div>

      {/* 主內容區域 */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-6">
        {currentView === 'auth_management' && isSuperAdmin ? (
          /* 管理員專屬：授權中心畫面 */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="text-xs text-indigo-400 hover:underline flex items-center space-x-1 font-medium"
              >
                <span>← 返回機器人控制面板</span>
              </button>
            </div>
            <AuthManagement currentUser={currentUser} bots={bots} />
          </div>
        ) : currentView === 'reseller_portal' && (currentUser?.role === 'RESELLER' || isSuperAdmin) ? (
          /* 經銷代理商專屬：代理後台畫面 */
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <button
                onClick={() => setCurrentView('dashboard')}
                className="text-xs text-indigo-400 hover:underline flex items-center space-x-1 font-medium"
              >
                <span>← 返回機器人控制面板</span>
              </button>
            </div>
            <ResellerPortal currentUser={currentUser} bots={bots} />
          </div>
        ) : (
          /* 機器人託管儀表板主畫面 */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* 左側：機器人清單 (4 cols) */}
            <div className="lg:col-span-4 flex flex-col space-y-4">
              {/* 管理員全站機器人檢視切換欄 */}
              {isSuperAdmin && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-[#1e1f22] border border-[#2b2d31]">
                  <div className="flex items-center space-x-2">
                    <Radio className={`w-3.5 h-3.5 ${showAllBots ? 'text-amber-400 animate-pulse' : 'text-gray-500'}`} />
                    <span className="text-xs text-gray-300 font-medium">
                      視角：{showAllBots ? <span className="text-amber-300 font-bold">全站所有機器人 ({bots.length})</span> : <span className="text-gray-400">僅我的機器人 ({bots.length})</span>}
                    </span>
                  </div>
                  <button
                    onClick={() => setShowAllBots(!showAllBots)}
                    className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition flex items-center space-x-1 ${
                      showAllBots
                        ? 'bg-amber-500 hover:bg-amber-400 text-black shadow'
                        : 'bg-[#2b2d31] hover:bg-gray-700 text-gray-300 border border-gray-600'
                    }`}
                    title={showAllBots ? '切換為只看自己的機器人' : '顯示全站所有用戶託管的機器人'}
                  >
                    <Globe className="w-3 h-3" />
                    <span>{showAllBots ? '切換僅我的' : '顯示所有機器人'}</span>
                  </button>
                </div>
              )}

              <div className="flex items-center space-x-2">
                <div className="relative flex-1">
                  <Search className="w-4 h-4 text-gray-500 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="搜尋機器人名稱..."
                    className="w-full bg-[#1e1f22] text-xs text-white pl-9 pr-3 py-2 rounded-xl border border-[#2b2d31] focus:outline-none focus:border-discord-blurple"
                  />
                </div>
                <button
                  onClick={() => setIsUploadModalOpen(true)}
                  className="p-2 rounded-xl bg-[#1e1f22] hover:bg-[#2b2d31] text-discord-blurple border border-[#2b2d31] transition"
                  title="上傳建立機器人"
                >
                  <Plus className="w-4 h-4" />
                </button>
              </div>

              <div className="flex-1 space-y-2.5 overflow-y-auto max-h-[750px] pr-1">
                {filteredBots.length === 0 ? (
                  <div className="p-8 text-center bg-[#1e1f22] rounded-xl border border-[#2b2d31] text-gray-500 text-xs">
                    <Bot className="w-8 h-8 mx-auto mb-2 text-gray-600" />
                    <span>{showAllBots ? '全站尚無任何機器人' : '您目前尚無託管的機器人。點擊「上傳建立 Bot」開始！'}</span>
                  </div>
                ) : (
                  filteredBots.map((bot) => {
                    const isSelected = selectedBot?.id === bot.id;
                    const isOnline = bot.status === 'ONLINE';
                    const isRemote = isSuperAdmin && bot.ownerEmail && bot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase();

                    return (
                      <div
                        key={bot.id}
                        onClick={() => setSelectedBotId(bot.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition relative group ${
                          isSelected
                            ? 'bg-[#232428] border-discord-blurple shadow-lg ring-1 ring-discord-blurple/50'
                            : 'bg-[#1e1f22] border-[#2b2d31] hover:border-gray-600'
                        }`}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex items-center space-x-3">
                            <div className={`p-2 rounded-xl ${isOnline ? 'bg-emerald-950/60 text-emerald-400' : 'bg-gray-800 text-gray-400'}`}>
                              <Bot className="w-5 h-5" />
                            </div>
                            <div>
                              <div className="flex items-center space-x-2">
                                <h4 className="text-sm font-bold text-white truncate max-w-[170px]">{bot.name}</h4>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">
                                  {bot.type}
                                </span>
                              </div>
                              <p className="text-[11px] text-gray-400 mt-0.5 truncate max-w-[190px]">
                                {bot.description}
                              </p>
                              {isRemote && (
                                <div className="mt-1 flex items-center space-x-1.5 text-[10px]">
                                  <span className="px-1.5 py-0.5 rounded bg-amber-950/80 text-amber-300 border border-amber-800/60 font-mono truncate max-w-[160px]">
                                    👤 {bot.ownerEmail}
                                  </span>
                                  <span className="text-amber-400 font-bold">[遠端]</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex items-center space-x-1.5 mt-1">
                            <span className={`w-2 h-2 rounded-full ${
                              bot.status === 'DISABLED'
                                ? 'bg-amber-400'
                                : (isOnline ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.8)]' : 'bg-red-500')
                            }`} />
                            <span className={`text-[11px] font-semibold font-mono ${
                              bot.status === 'DISABLED'
                                ? 'text-amber-400'
                                : (isOnline ? 'text-emerald-400' : 'text-gray-500')
                            }`}>
                              {bot.status === 'DISABLED' ? '託管停用' : bot.status}
                            </span>
                          </div>
                        </div>

                        <div className="mt-3 pt-2.5 border-t border-[#2b2d31]/80 flex items-center justify-between text-[11px] text-gray-400">
                          <span className="font-mono">RAM: {isOnline ? `${bot.memory || 42}MB` : '0MB'}</span>
                          <span className="text-gray-500">主檔: {bot.mainFile}</span>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* 右側：機器人主控面板 (8 cols) */}
            <div className="lg:col-span-8 flex flex-col space-y-4">
              {selectedBot ? (
                <>
                  <div className="bg-[#1e1f22] p-5 rounded-2xl border border-[#2b2d31] shadow-xl">
                    {/* 管理員遠端控制模式警示橫幅 */}
                    {isSuperAdmin && selectedBot.ownerEmail && selectedBot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase() && (
                      <div className="mb-4 p-3 rounded-xl bg-amber-950/40 border border-amber-800/70 flex items-center justify-between text-xs text-amber-200">
                        <div className="flex items-center space-x-2">
                          <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0" />
                          <span>
                            <strong>【管理員遠端控制模式】</strong> 此實例為用戶 <span className="font-mono font-bold text-white bg-amber-900/60 px-1.5 py-0.5 rounded">{selectedBot.ownerEmail}</span> 託管。您正以最高主管權限執行遠端調度。
                          </span>
                        </div>
                        <span className="shrink-0 px-2 py-0.5 rounded text-[10px] bg-amber-500 text-black font-bold">遠端控制</span>
                      </div>
                    )}

                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center space-x-3.5">
                        <div className="p-3 rounded-2xl bg-gradient-to-tr from-discord-blurple/30 to-indigo-700/30 border border-discord-blurple/40 text-discord-blurple">
                          <Bot className="w-7 h-7 text-white" />
                        </div>
                        <div>
                          <div className="flex items-center space-x-2">
                            <h2 className="text-lg font-bold text-white">{selectedBot.name}</h2>
                            <span className={`px-2 py-0.5 text-[11px] font-bold rounded-full ${
                              selectedBot.status === 'DISABLED'
                                ? 'bg-amber-950 text-amber-300 border border-amber-800/80'
                                : (selectedBot.status === 'ONLINE'
                                    ? 'bg-emerald-950 text-emerald-300 border border-emerald-800/60'
                                    : 'bg-gray-800 text-gray-400 border border-gray-700')
                            }`}>
                              {selectedBot.status === 'DISABLED' ? '⏸️ 託管已停用' : selectedBot.status}
                            </span>
                          </div>
                          <p className="text-xs text-gray-400 mt-0.5">
                            實例 ID: <code className="text-gray-300 font-mono">{selectedBot.id}</code> | 擁有者：<span className="text-indigo-400 font-mono">{selectedBot.ownerEmail || currentUser.email}</span>
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2 shrink-0 flex-wrap sm:flex-nowrap gap-y-2">
                        {selectedBot.status === 'DISABLED' ? (
                          <button
                            onClick={() => handleResumeHosting(selectedBot.id)}
                            disabled={isActionLoading}
                            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 shadow-md shadow-emerald-950/40 whitespace-nowrap shrink-0"
                          >
                            <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                            <span>{isSuperAdmin && selectedBot.ownerEmail && selectedBot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase() ? '遠端恢復託管' : '恢復/啟用託管'}</span>
                          </button>
                        ) : (
                          <>
                            {selectedBot.status === 'ONLINE' ? (
                              <button
                                onClick={() => handleStopBot(selectedBot.id)}
                                disabled={isActionLoading}
                                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-red-600 hover:bg-red-500 text-white transition disabled:opacity-50 shadow-md shadow-red-950/40 whitespace-nowrap shrink-0"
                              >
                                <Square className="w-3.5 h-3.5 shrink-0" />
                                <span>{isSuperAdmin && selectedBot.ownerEmail && selectedBot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase() ? '遠端停止' : '停止'}</span>
                              </button>
                            ) : (
                              <button
                                onClick={() => handleStartBot(selectedBot.id)}
                                disabled={isActionLoading}
                                className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50 shadow-md shadow-emerald-950/40 whitespace-nowrap shrink-0"
                              >
                                <Play className="w-3.5 h-3.5 fill-current shrink-0" />
                                <span>{isSuperAdmin && selectedBot.ownerEmail && selectedBot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase() ? '遠端啟動' : '啟動'}</span>
                              </button>
                            )}

                            <button
                              onClick={() => handleRestartBot(selectedBot.id)}
                              disabled={isActionLoading}
                              title="重新啟動機器人"
                              className="flex items-center space-x-1.5 px-3 py-2 rounded-xl bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 text-xs font-semibold transition disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <RefreshCw className={`w-3.5 h-3.5 shrink-0 ${isActionLoading ? 'animate-spin' : ''}`} />
                              <span>{isSuperAdmin && selectedBot.ownerEmail && selectedBot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase() ? '遠端重啟' : '重啟'}</span>
                            </button>

                            <button
                              onClick={() => handleSuspendHosting(selectedBot.id)}
                              disabled={isActionLoading}
                              title="停用此機器人託管"
                              className="px-3 py-2 text-xs font-medium rounded-xl bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 transition disabled:opacity-50 whitespace-nowrap shrink-0"
                            >
                              <span>{isSuperAdmin && selectedBot.ownerEmail && selectedBot.ownerEmail.toLowerCase() !== currentUser?.email?.toLowerCase() ? '遠端停用託管' : '停用託管'}</span>
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex space-x-2 mt-5 border-t border-[#2b2d31] pt-3 overflow-x-auto no-scrollbar">
                      <button
                        onClick={() => setActiveTab('console')}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 whitespace-nowrap ${
                          activeTab === 'console'
                            ? 'bg-discord-blurple text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-[#2b2d31]'
                        }`}
                      >
                        <Terminal className="w-3.5 h-3.5 shrink-0" />
                        <span>即時控制台 (Console)</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('files')}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 whitespace-nowrap ${
                          activeTab === 'files'
                            ? 'bg-discord-blurple text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-[#2b2d31]'
                        }`}
                      >
                        <FolderCode className="w-3.5 h-3.5 shrink-0" />
                        <span>檔案與程式碼 (IDE)</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('env')}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 whitespace-nowrap ${
                          activeTab === 'env'
                            ? 'bg-discord-blurple text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-[#2b2d31]'
                        }`}
                      >
                        <KeyRound className="w-3.5 h-3.5 shrink-0" />
                        <span>環境變數 (.env)</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('metrics')}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 whitespace-nowrap ${
                          activeTab === 'metrics'
                            ? 'bg-discord-blurple text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-[#2b2d31]'
                        }`}
                      >
                        <Activity className="w-3.5 h-3.5 shrink-0" />
                        <span>效能指標與分片</span>
                      </button>

                      <button
                        onClick={() => setActiveTab('settings')}
                        className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-medium transition shrink-0 whitespace-nowrap ${
                          activeTab === 'settings'
                            ? 'bg-discord-blurple text-white shadow-md'
                            : 'text-gray-400 hover:text-white hover:bg-[#2b2d31]'
                        }`}
                      >
                        <Settings className="w-3.5 h-3.5 shrink-0" />
                        <span>實例設定</span>
                      </button>
                    </div>
                  </div>

                  <div className="flex-1">
                    {activeTab === 'console' && (
                      <Console
                        bot={selectedBot}
                        onStart={handleStartBot}
                        onStop={handleStopBot}
                        onRestart={handleRestartBot}
                        onSuspend={handleSuspendHosting}
                        onResume={handleResumeHosting}
                        isActionLoading={isActionLoading}
                      />
                    )}

                    {activeTab === 'files' && (
                      <FileManager bot={selectedBot} />
                    )}

                    {activeTab === 'env' && (
                      <EnvEditor
                        bot={selectedBot}
                        onRestart={() => handleRestartBot(selectedBot.id)}
                      />
                    )}

                    {activeTab === 'metrics' && (
                      <MetricsPanel
                        bot={selectedBot}
                        telemetry={telemetry}
                      />
                    )}

                    {activeTab === 'settings' && (
                      <div className="bg-[#1e1f22] p-6 rounded-xl border border-[#2b2d31] space-y-6 shadow-xl">
                        <h3 className="text-base font-bold text-white border-b border-[#2b2d31] pb-3">
                          機器人詳細配置與託管控制
                        </h3>

                        {/* 託管狀態開關與控制 */}
                        <div className="p-4 rounded-xl bg-[#141517] border border-[#35373c] space-y-3">
                          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                            <div>
                              <h4 className="text-sm font-bold text-white flex items-center space-x-2">
                                <span>託管運作狀態：</span>
                                {selectedBot.status === 'DISABLED' ? (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950 text-amber-300 border border-amber-800">
                                    ⏸️ 託管已停用
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-950 text-emerald-300 border border-emerald-800">
                                    🟢 正常託管中
                                  </span>
                                )}
                              </h4>
                              <p className="text-xs text-gray-400 mt-1">
                                使用者可隨時停用或重新啟用託管服務。停用後進程將強制安全停止，並關閉崩潰自動重啟機制。
                              </p>
                            </div>
                            <div className="flex items-center space-x-2 shrink-0">
                              <button
                                onClick={() => handleRestartBot(selectedBot.id)}
                                disabled={isActionLoading || selectedBot.status === 'DISABLED'}
                                className="flex items-center space-x-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-[#2b2d31] hover:bg-gray-700 text-gray-200 transition disabled:opacity-40"
                              >
                                <RefreshCw className={`w-3.5 h-3.5 ${isActionLoading ? 'animate-spin' : ''}`} />
                                <span>立即重啟</span>
                              </button>

                              {selectedBot.status === 'DISABLED' ? (
                                <button
                                  onClick={() => handleResumeHosting(selectedBot.id)}
                                  disabled={isActionLoading}
                                  className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white transition shadow"
                                >
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>恢復啟用託管</span>
                                </button>
                              ) : (
                                <button
                                  onClick={() => handleSuspendHosting(selectedBot.id)}
                                  disabled={isActionLoading}
                                  className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-amber-600/80 hover:bg-amber-600 text-white transition shadow"
                                >
                                  <span>停用託管服務</span>
                                </button>
                              )}
                            </div>
                          </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                          <div>
                            <label className="block text-gray-400 mb-1">主入口檔案</label>
                            <input
                              type="text"
                              disabled
                              value={selectedBot.mainFile}
                              className="w-full bg-[#141517] text-gray-300 p-2.5 rounded-lg border border-[#35373c] font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">沙盒記憶體限額</label>
                            <input
                              type="text"
                              disabled
                              value={`${selectedBot.maxMemory || 512} MB`}
                              className="w-full bg-[#141517] text-gray-300 p-2.5 rounded-lg border border-[#35373c] font-mono"
                            />
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">崩潰自動復原 (Auto Restart)</label>
                            <div className="p-2.5 bg-[#141517] rounded-lg border border-[#35373c] text-emerald-400 font-medium">
                              {selectedBot.status === 'DISABLED' ? '✕ 託管停用期間暫停自動復原' : '✓ 已啟用常駐守護機制'}
                            </div>
                          </div>
                          <div>
                            <label className="block text-gray-400 mb-1">節點位置</label>
                            <div className="p-2.5 bg-[#141517] rounded-lg border border-[#35373c] text-gray-300">
                              {selectedBot.nodeLocation}
                            </div>
                          </div>
                        </div>

                        <div className="mt-8 pt-5 border-t border-red-900/40">
                          <h4 className="text-sm font-bold text-red-400 flex items-center space-x-1.5 mb-2">
                            <AlertTriangle className="w-4 h-4" />
                            <span>危險區域 (Danger Zone)</span>
                          </h4>
                          <p className="text-xs text-gray-400 mb-4">
                            永久銷毀此機器人實例及其所有儲存的程式碼與組態資料。此操作無法復原。
                          </p>
                          <button
                            onClick={() => handleDeleteBot(selectedBot.id)}
                            className="flex items-center space-x-1.5 px-4 py-2 text-xs font-semibold rounded-lg bg-red-600 hover:bg-red-500 text-white transition shadow"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            <span>永久刪除此機器人實例</span>
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-[#1e1f22] rounded-2xl border border-[#2b2d31] text-center shadow-xl">
                  <Upload className="w-16 h-16 text-gray-600 mb-4" />
                  <h3 className="text-lg font-bold text-white">尚未建立任何機器人</h3>
                  <p className="text-xs text-gray-400 mt-1 max-w-sm">
                    立即點擊下方按鈕，上傳您的 Discord Bot 專案（支援 ZIP 壓縮檔或單一原始檔）！
                  </p>
                  <button
                    onClick={() => setIsUploadModalOpen(true)}
                    className="mt-5 flex items-center space-x-2 px-5 py-2.5 text-xs font-semibold rounded-xl bg-discord-blurple hover:bg-discord-blurple-hover text-white transition shadow-lg shadow-discord-blurple/30"
                  >
                    <Upload className="w-4 h-4" />
                    <span>上傳自訂 Bot 專案</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <footer className="mt-auto bg-[#141517] border-t border-[#2b2d31] py-4 px-6 text-center text-xs text-gray-500">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            <span>© 2026 RPJG BotCloud | 由 </span>
            <strong className="text-indigo-400 font-semibold">R.P.J.G 開發部門</strong>
            <span> 匠心研發製作</span>
          </div>
          <div className="flex items-center space-x-4 text-[11px] text-gray-500">
            <span>支援自訂上傳 Node.js & Python</span>
            <span>•</span>
            <span className="text-emerald-400">亞太光纖直連節點</span>
            <span>•</span>
            <span>管理員: {isSuperAdmin ? '已認證總管' : '授權使用者'}</span>
          </div>
        </div>
      </footer>

      {/* 模態彈窗組件 */}
      <UploadBotModal
        isOpen={isUploadModalOpen}
        onClose={() => setIsUploadModalOpen(false)}
        onCreated={handleBotCreated}
        currentUser={currentUser}
      />

      <AboutModal
        isOpen={isAboutModalOpen}
        onClose={() => setIsAboutModalOpen(false)}
      />

      <GlobalAuditLogsModal
        isOpen={isGlobalAuditOpen}
        onClose={() => setIsGlobalAuditOpen(false)}
        currentUser={currentUser}
        bots={bots}
      />
    </div>
  );
}
