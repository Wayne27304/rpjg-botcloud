/**
 * ================================================================
 * RPJG BotCloud - 全域操作審計與遠端監控日誌模組 (Global Audit & Logs Modal)
 * 作者：R.P.J.G 開發部門
 * ================================================================
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  FileText,
  Terminal,
  Activity,
  Search,
  RefreshCw,
  X,
  Filter,
  Clock,
  Shield,
  Bot,
  User,
  AlertCircle,
  CheckCircle2,
  Copy,
  Trash2,
  ChevronRight,
  Award,
  Sliders,
  Play,
  Square,
  UserX,
  Plus
} from 'lucide-react';

export default function GlobalAuditLogsModal({ isOpen, onClose, currentUser, bots = [] }) {
  const [activeTab, setActiveTab] = useState('audit'); // 'audit' | 'bot_logs'
  const [logs, setLogs] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [actionFilter, setActionFilter] = useState('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  
  // 遠端機器人日誌監控
  const [selectedBotId, setSelectedBotId] = useState('');
  const [botLogs, setBotLogs] = useState([]);
  const [isBotLogsLoading, setIsBotLogsLoading] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const [copiedLogs, setCopiedLogs] = useState(false);
  const consoleBottomRef = useRef(null);

  // 1. 抓取審計日誌
  const fetchAuditLogs = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      let url = '/api/admin/audit-logs?limit=300';
      if (actionFilter !== 'ALL') {
        url += `&action=${actionFilter}`;
      }
      if (searchTerm.trim()) {
        url += `&search=${encodeURIComponent(searchTerm.trim())}`;
      }
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setLogs(data.logs);
      }
    } catch (err) {
      console.error('抓取審計日誌失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // 2. 抓取特定機器人的日誌
  const fetchBotLogs = async (botId) => {
    if (!botId) return;
    setIsBotLogsLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${botId}/logs`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success && data.logs) {
        setBotLogs(data.logs);
      }
    } catch (err) {
      console.error('抓取機器人日誌失敗:', err);
    } finally {
      setIsBotLogsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchAuditLogs();
      if (bots.length > 0 && !selectedBotId) {
        setSelectedBotId(bots[0].id);
      }
    }
  }, [isOpen, actionFilter]);

  useEffect(() => {
    if (isOpen && activeTab === 'bot_logs' && selectedBotId) {
      fetchBotLogs(selectedBotId);
      const interval = setInterval(() => {
        fetchBotLogs(selectedBotId);
      }, 3000);
      return () => clearInterval(interval);
    }
  }, [isOpen, activeTab, selectedBotId]);

  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [botLogs, autoScroll]);

  if (!isOpen) return null;

  // 動作徽章渲染
  const renderActionBadge = (action) => {
    switch (action) {
      case 'CREATE_RESELLER':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <Award className="w-3 h-3 text-amber-400 shrink-0" />
            <span>建立代理商</span>
          </span>
        );
      case 'CREATE_USER':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <User className="w-3 h-3 text-blue-400 shrink-0" />
            <span>授權客戶</span>
          </span>
        );
      case 'UPDATE_QUOTA':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-purple-500/20 text-purple-300 border border-purple-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <Sliders className="w-3 h-3 text-purple-400 shrink-0" />
            <span>配額調配</span>
          </span>
        );
      case 'BOT_START':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <Play className="w-3 h-3 text-emerald-400 fill-current shrink-0" />
            <span>啟動機器人</span>
          </span>
        );
      case 'BOT_STOP':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-rose-500/20 text-rose-300 border border-rose-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <Square className="w-3 h-3 text-rose-400 fill-current shrink-0" />
            <span>停止機器人</span>
          </span>
        );
      case 'BOT_DELETE':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-600/20 text-red-400 border border-red-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <Trash2 className="w-3 h-3 text-red-400 shrink-0" />
            <span>刪除機器人</span>
          </span>
        );
      case 'CREATE_BOT':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 inline-flex items-center space-x-1 whitespace-nowrap">
            <Plus className="w-3 h-3 text-cyan-400 shrink-0" />
            <span>建立專案</span>
          </span>
        );
      case 'DELETE_USER':
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-bold bg-red-900/30 text-red-300 border border-red-700/50 inline-flex items-center space-x-1 whitespace-nowrap">
            <UserX className="w-3 h-3 text-red-400 shrink-0" />
            <span>移除帳號</span>
          </span>
        );
      default:
        return (
          <span className="px-2 py-0.5 rounded text-[11px] font-mono bg-gray-800 text-gray-300 border border-gray-700 whitespace-nowrap">
            {action}
          </span>
        );
    }
  };

  const selectedBot = bots.find(b => b.id === selectedBotId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="bg-[#1e1f22] border border-[#2b2d31] rounded-2xl w-full max-w-5xl h-[85vh] flex flex-col shadow-2xl overflow-hidden">
        {/* 彈窗頂部 */}
        <div className="px-6 py-4 border-b border-[#2b2d31] flex items-center justify-between bg-[#141517]">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-extrabold text-white flex items-center space-x-2">
                <span>全域操作審計與遠端監控日誌</span>
                <span className="text-[11px] font-normal px-2 py-0.5 rounded bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                  R.P.J.G 開發部門
                </span>
              </h2>
              <p className="text-xs text-gray-400">
                即時監控全體經銷商、客戶操作紀錄與遠端機器人即時 Console 輸出
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* 分頁切換 */}
            <div className="flex items-center bg-[#2b2d31] p-1 rounded-xl">
              <button
                onClick={() => setActiveTab('audit')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'audit'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>審計事件紀錄</span>
              </button>
              <button
                onClick={() => setActiveTab('bot_logs')}
                className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                  activeTab === 'bot_logs'
                    ? 'bg-indigo-600 text-white shadow-md'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Terminal className="w-3.5 h-3.5" />
                <span>遠端機器人控制台</span>
              </button>
            </div>

            <button
              onClick={onClose}
              className="p-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* 標籤頁 1: 審計事件紀錄 */}
        {activeTab === 'audit' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* 篩選與工具列 */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-2 flex-1 max-w-md">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500" />
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && fetchAuditLogs()}
                    placeholder="搜尋操作人、目標對象或關鍵字..."
                    className="w-full bg-[#141517] border border-[#2b2d31] rounded-xl pl-9 pr-4 py-2 text-xs text-white placeholder-gray-500 focus:outline-none focus:border-indigo-500"
                  />
                </div>
                <button
                  onClick={fetchAuditLogs}
                  className="px-3 py-2 bg-[#2b2d31] hover:bg-gray-700 text-gray-300 rounded-xl text-xs flex items-center space-x-1 transition shrink-0"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                  <span>整理</span>
                </button>
              </div>

              {/* 動作篩選 */}
              <div className="flex items-center space-x-2">
                <Filter className="w-3.5 h-3.5 text-gray-400" />
                <select
                  value={actionFilter}
                  onChange={(e) => setActionFilter(e.target.value)}
                  className="bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-2 text-xs text-gray-200 focus:outline-none focus:border-indigo-500"
                >
                  <option value="ALL">全部操作事件</option>
                  <option value="CREATE_RESELLER">建立代理商 (CREATE_RESELLER)</option>
                  <option value="CREATE_USER">建立/授權客戶 (CREATE_USER)</option>
                  <option value="UPDATE_QUOTA">配額調配 (UPDATE_QUOTA)</option>
                  <option value="BOT_START">啟動機器人 (BOT_START)</option>
                  <option value="BOT_STOP">停止機器人 (BOT_STOP)</option>
                  <option value="BOT_DELETE">刪除機器人 (BOT_DELETE)</option>
                  <option value="DELETE_USER">刪除帳號 (DELETE_USER)</option>
                </select>
              </div>
            </div>

            {/* 日誌表格 */}
            <div className="flex-1 overflow-y-auto rounded-xl border border-[#2b2d31] bg-[#141517]/80">
              {logs.length === 0 ? (
                <div className="h-full flex flex-col items-center justify-center text-gray-500 py-12">
                  <Clock className="w-8 h-8 mb-2 opacity-40" />
                  <p className="text-xs">尚無任何審計事件紀錄</p>
                </div>
              ) : (
                <table className="w-full text-left text-xs border-collapse">
                  <thead className="bg-[#1e1f22] text-gray-400 sticky top-0 border-b border-[#2b2d31]">
                    <tr>
                      <th className="py-3 px-4 font-semibold">時間</th>
                      <th className="py-3 px-4 font-semibold">動作類型</th>
                      <th className="py-3 px-4 font-semibold">操作執行者</th>
                      <th className="py-3 px-4 font-semibold">目標對象</th>
                      <th className="py-3 px-4 font-semibold">詳細參數與備註</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#2b2d31]/50 text-gray-300 font-mono">
                    {logs.map((entry) => (
                      <tr key={entry.id} className="hover:bg-white/[0.02] transition">
                        <td className="py-3 px-4 text-gray-400 text-[11px] whitespace-nowrap">
                          {new Date(entry.timestamp).toLocaleString('zh-TW')}
                        </td>
                        <td className="py-3 px-4 whitespace-nowrap">
                          {renderActionBadge(entry.action)}
                        </td>
                        <td className="py-3 px-4 text-indigo-300 font-semibold">
                          {entry.actor}
                        </td>
                        <td className="py-3 px-4 text-emerald-300">
                          {entry.target}
                        </td>
                        <td className="py-3 px-4 text-gray-400 text-[11px] max-w-md truncate">
                          {typeof entry.details === 'object'
                            ? JSON.stringify(entry.details)
                            : String(entry.details || '')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}

        {/* 標籤頁 2: 遠端機器人日誌控制台 */}
        {activeTab === 'bot_logs' && (
          <div className="flex-1 flex flex-col p-6 overflow-hidden">
            {/* 選擇機器人頂部列 */}
            <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
              <div className="flex items-center space-x-3">
                <Bot className="w-4 h-4 text-indigo-400" />
                <span className="text-xs text-gray-400">監控對象：</span>
                <select
                  value={selectedBotId}
                  onChange={(e) => setSelectedBotId(e.target.value)}
                  className="bg-[#141517] border border-[#2b2d31] rounded-xl px-3 py-1.5 text-xs text-white focus:outline-none focus:border-indigo-500 font-mono"
                >
                  {bots.length === 0 && <option value="">目前無任何機器人</option>}
                  {bots.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.id}) - 擁有者: {b.ownerEmail || 'Admin'} [{b.status}]
                    </option>
                  ))}
                </select>

                {selectedBot && (
                  <span
                    className={`px-2 py-0.5 rounded text-[11px] font-bold ${
                      selectedBot.status === 'ONLINE'
                        ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                        : 'bg-gray-800 text-gray-400 border border-gray-700'
                    }`}
                  >
                    {selectedBot.status === 'ONLINE' ? '在線常駐' : '已離線'}
                  </span>
                )}
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={() => fetchBotLogs(selectedBotId)}
                  className="px-3 py-1.5 bg-[#2b2d31] hover:bg-gray-700 text-gray-300 rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <RefreshCw className={`w-3.5 h-3.5 ${isBotLogsLoading ? 'animate-spin' : ''}`} />
                  <span>刷新</span>
                </button>

                <button
                  onClick={() => {
                    const text = botLogs.join('\n');
                    navigator.clipboard.writeText(text);
                    setCopiedLogs(true);
                    setTimeout(() => setCopiedLogs(false), 2000);
                  }}
                  className="px-3 py-1.5 bg-[#2b2d31] hover:bg-gray-700 text-gray-300 rounded-xl text-xs flex items-center space-x-1.5 transition"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{copiedLogs ? '已複製！' : '複製日誌'}</span>
                </button>

                <label className="flex items-center space-x-1.5 text-xs text-gray-400 cursor-pointer pl-2">
                  <input
                    type="checkbox"
                    checked={autoScroll}
                    onChange={(e) => setAutoScroll(e.target.checked)}
                    className="rounded bg-[#141517] border-gray-700 text-indigo-500 focus:ring-0"
                  />
                  <span>自動滾動</span>
                </label>
              </div>
            </div>

            {/* Console 黑色終端機畫面 */}
            <div className="flex-1 bg-black/90 rounded-xl border border-gray-800 p-4 font-mono text-xs overflow-y-auto shadow-inner text-gray-300">
              {botLogs.length === 0 ? (
                <div className="h-full flex items-center justify-center text-gray-600">
                  <p>尚無終端機輸出日誌（若機器人剛啟動請稍候）</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {botLogs.map((line, idx) => (
                    <div key={idx} className="leading-relaxed whitespace-pre-wrap break-all">
                      {line}
                    </div>
                  ))}
                  <div ref={consoleBottomRef} />
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
