import React, { useState, useEffect, useRef } from 'react';
import { Terminal as TerminalIcon, Play, Square, RefreshCw, Trash2, Download, Send, ArrowDownCircle, ShieldCheck } from 'lucide-react';
import { parseAnsi } from '../utils/ansi';

export default function Console({ bot, onStart, onStop, onRestart, onSuspend, onResume, isActionLoading }) {
  const [logs, setLogs] = useState([]);
  const [inputCommand, setInputCommand] = useState('');
  const [autoScroll, setAutoScroll] = useState(true);
  const consoleBottomRef = useRef(null);

  useEffect(() => {
    if (!bot) return;

    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/logs`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.logs) {
          setLogs(data.logs);
        }
      })
      .catch(err => console.error('無法取得日誌:', err));

    const handleBotLog = (e) => {
      if (e.detail.botId === bot.id) {
        setLogs(prev => [...prev.slice(-500), e.detail.line]);
      }
    };

    const handleClearLog = (e) => {
      if (e.detail.botId === bot.id) {
        setLogs(['\x1b[35m[RPJG-SYSTEM]\x1b[0m 日誌已清空。']);
      }
    };

    window.addEventListener('rpjg:bot_log', handleBotLog);
    window.addEventListener('rpjg:logs_cleared', handleClearLog);

    return () => {
      window.removeEventListener('rpjg:bot_log', handleBotLog);
      window.removeEventListener('rpjg:logs_cleared', handleClearLog);
    };
  }, [bot?.id]);

  useEffect(() => {
    if (autoScroll && consoleBottomRef.current) {
      consoleBottomRef.current.scrollTop = consoleBottomRef.current.scrollHeight;
    }
  }, [logs, autoScroll]);

  const handleSendCommand = (e) => {
    e.preventDefault();
    if (!inputCommand.trim() || !bot) return;

    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/stdin`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ text: inputCommand.trim() })
    });

    setInputCommand('');
  };

  const handleClearLogs = () => {
    if (!bot) return;
    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/logs`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${token}` }
    }).then(() => setLogs(['\x1b[35m[RPJG-SYSTEM]\x1b[0m 日誌已清空。']));
  };

  const handleDownloadLogs = () => {
    if (!bot || logs.length === 0) return;
    const blob = new Blob([logs.map(l => l.replace(/\x1b\[[0-9;]*m/g, '')).join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${bot.name}_${new Date().toISOString().slice(0, 10)}.log`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const isOnline = bot?.status === 'ONLINE';
  const isStarting = bot?.status === 'STARTING';
  const isDisabled = bot?.status === 'DISABLED';

  return (
    <div className="flex flex-col h-full bg-[#111215] rounded-xl border border-[#2b2d31] overflow-hidden shadow-2xl">
      <div className="flex items-center justify-between px-4 py-3 bg-[#1e1f22] border-b border-[#2b2d31]">
        <div className="flex items-center space-x-3">
          <div className="flex space-x-1.5">
            <div className="w-3 h-3 rounded-full bg-red-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-amber-500/80"></div>
            <div className="w-3 h-3 rounded-full bg-emerald-500/80"></div>
          </div>
          <div className="h-4 w-px bg-gray-700"></div>
          <div className="flex items-center space-x-2 text-xs font-mono text-gray-400">
            <TerminalIcon className="w-3.5 h-3.5 text-discord-blurple" />
            <span>bash: ~/{bot?.name || 'terminal'}</span>
          </div>
          {isDisabled ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold bg-amber-950/90 text-amber-300 border border-amber-800/80">
              ⏸️ 託管已停用
            </span>
          ) : (
            <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-purple-950/80 text-purple-300 border border-purple-800/60">
              RPJG 實時串流引擎
            </span>
          )}
        </div>

        <div className="flex items-center space-x-2">
          {isDisabled ? (
            <button
              onClick={() => onResume && onResume(bot.id)}
              disabled={isActionLoading}
              className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
            >
              <Play className="w-3 h-3 fill-current" />
              <span>恢復/啟用託管</span>
            </button>
          ) : (
            <>
              {isOnline ? (
                <button
                  onClick={() => onStop(bot.id)}
                  disabled={isActionLoading}
                  className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded bg-red-600/90 hover:bg-red-500 text-white transition disabled:opacity-50"
                >
                  <Square className="w-3 h-3" />
                  <span>停止運行</span>
                </button>
              ) : (
                <button
                  onClick={() => onStart(bot.id)}
                  disabled={isActionLoading || isStarting}
                  className="flex items-center space-x-1.5 px-3 py-1 text-xs font-semibold rounded bg-emerald-600 hover:bg-emerald-500 text-white transition disabled:opacity-50"
                >
                  <Play className="w-3 h-3 fill-current" />
                  <span>{isStarting ? '啟動中...' : '啟動進程'}</span>
                </button>
              )}

              {/* 重啟按鈕 */}
              <button
                onClick={() => onRestart(bot.id)}
                disabled={isActionLoading}
                title="重新啟動機器人"
                className="flex items-center space-x-1 px-2.5 py-1 text-xs font-medium rounded bg-indigo-950/80 hover:bg-indigo-900 text-indigo-300 border border-indigo-700/50 transition disabled:opacity-50"
              >
                <RefreshCw className={`w-3 h-3 ${isActionLoading ? 'animate-spin' : ''}`} />
                <span>重啟</span>
              </button>

              {/* 停用託管按鈕 */}
              <button
                onClick={() => onSuspend && onSuspend(bot.id)}
                disabled={isActionLoading}
                title="停用此機器人託管"
                className="px-2.5 py-1 text-xs font-medium rounded bg-amber-950/40 hover:bg-amber-900/60 text-amber-300 border border-amber-800/50 transition disabled:opacity-50"
              >
                <span>停用託管</span>
              </button>
            </>
          )}

          <div className="h-4 w-px bg-gray-700"></div>

          <button
            onClick={() => setAutoScroll(!autoScroll)}
            title={autoScroll ? '自動滾動：開啟' : '自動滾動：關閉'}
            className={`p-1.5 rounded transition ${autoScroll ? 'bg-indigo-950 text-indigo-400 border border-indigo-700/60' : 'bg-gray-800 text-gray-400'}`}
          >
            <ArrowDownCircle className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleDownloadLogs}
            title="下載日誌 (.log)"
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-white transition"
          >
            <Download className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={handleClearLogs}
            title="清除控制台"
            className="p-1.5 rounded bg-gray-800 hover:bg-gray-700 text-gray-400 hover:text-red-400 transition"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      <div
        ref={consoleBottomRef}
        className="flex-1 p-4 font-mono text-xs overflow-y-auto leading-relaxed select-text space-y-1 bg-[#0d0e11]"
        style={{ minHeight: '340px', maxHeight: '520px' }}
      >
        <div className="p-3 mb-3 rounded border border-indigo-900/60 bg-indigo-950/20 text-indigo-300 text-[11px] leading-normal font-sans">
          <div className="flex items-center space-x-2 mb-1 font-bold text-indigo-200">
            <ShieldCheck className="w-4 h-4 text-indigo-400" />
            <span>RPJG BotCloud 線上託管伺服器 | R.P.J.G 開發部門</span>
          </div>
          <div className="text-gray-400">
            節點環境：<span className="text-emerald-400 font-mono">RPJG-TW-Node-01</span> | 實例：<span className="text-white font-mono">{bot?.name}</span> | PID: <span className="text-amber-400 font-mono">{bot?.status === 'ONLINE' ? 'Active' : 'N/A'}</span>
          </div>
        </div>

        {logs.length === 0 ? (
          <div className="text-gray-500 italic py-6 text-center">
            暫無日誌輸出。點擊右上角「啟動進程」以開始運行機器人。
          </div>
        ) : (
          logs.map((line, idx) => (
            <div
              key={idx}
              className="break-all whitespace-pre-wrap hover:bg-white/[0.02] px-1 rounded transition-colors"
              dangerouslySetInnerHTML={{ __html: parseAnsi(line) }}
            />
          ))
        )}
      </div>

      <form onSubmit={handleSendCommand} className="flex items-center px-3 py-2 bg-[#1e1f22] border-t border-[#2b2d31]">
        <span className="text-discord-blurple font-mono text-xs font-bold mr-2 select-none">$</span>
        <input
          type="text"
          value={inputCommand}
          onChange={(e) => setInputCommand(e.target.value)}
          placeholder={isOnline ? "輸入指令發送至機器人 (例如: ping, stats, status, help)..." : "機器人未啟動，啟動後可在此直接下達終端命令"}
          disabled={!isOnline}
          className="flex-1 bg-transparent text-xs font-mono text-gray-200 placeholder-gray-500 focus:outline-none disabled:opacity-50"
        />
        <button
          type="submit"
          disabled={!isOnline || !inputCommand.trim()}
          className="p-1.5 rounded bg-discord-blurple hover:bg-discord-blurple-hover text-white disabled:opacity-40 transition"
        >
          <Send className="w-3 h-3" />
        </button>
      </form>
    </div>
  );
}
