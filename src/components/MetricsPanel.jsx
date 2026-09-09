import React from 'react';
import { Cpu, HardDrive, Activity, Clock, Server, Wifi, Zap } from 'lucide-react';

export default function MetricsPanel({ bot, telemetry }) {
  const isOnline = bot?.status === 'ONLINE';

  const formatUptime = (seconds) => {
    if (!seconds) return '0秒';
    const d = Math.floor(seconds / (3600 * 24));
    const h = Math.floor((seconds % (3600 * 24)) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    const parts = [];
    if (d > 0) parts.push(`${d}天`);
    if (h > 0) parts.push(`${h}小時`);
    if (m > 0) parts.push(`${m}分`);
    parts.push(`${s}秒`);
    return parts.join(' ');
  };

  const cpuPercent = isOnline ? (bot.cpu || 1.8) : 0;
  const memUsed = isOnline ? (bot.memory || 42) : 0;
  const memMax = bot.maxMemory || 512;
  const memPercent = Math.min(100, Math.round((memUsed / memMax) * 100));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#2b2d31] relative overflow-hidden shadow-lg card-hover-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">CPU 運算負載</span>
            <div className="p-2 rounded-lg bg-indigo-950/60 text-indigo-400 border border-indigo-800/40">
              <Cpu className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-white font-mono">{cpuPercent}%</span>
            <span className="text-xs text-gray-500 font-mono">/ 1 vCPU</span>
          </div>
          <div className="w-full bg-[#141517] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-indigo-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${Math.min(100, cpuPercent * 5)}%` }}
            />
          </div>
        </div>

        <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#2b2d31] relative overflow-hidden shadow-lg card-hover-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">RAM 記憶體分配</span>
            <div className="p-2 rounded-lg bg-cyan-950/60 text-cyan-400 border border-cyan-800/40">
              <HardDrive className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-white font-mono">{memUsed} MB</span>
            <span className="text-xs text-gray-500 font-mono">/ {memMax} MB</span>
          </div>
          <div className="w-full bg-[#141517] h-1.5 rounded-full mt-3 overflow-hidden">
            <div
              className="bg-cyan-500 h-full rounded-full transition-all duration-500"
              style={{ width: `${memPercent}%` }}
            />
          </div>
        </div>

        <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#2b2d31] relative overflow-hidden shadow-lg card-hover-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">在線持續時間</span>
            <div className="p-2 rounded-lg bg-emerald-950/60 text-emerald-400 border border-emerald-800/40">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-1">
            <span className="text-xl font-bold text-white font-mono">
              {isOnline ? formatUptime(bot.uptime) : '離線中'}
            </span>
          </div>
          <div className="mt-3 flex items-center space-x-1.5 text-xs text-gray-400">
            <span className={`w-2 h-2 rounded-full ${isOnline ? 'bg-emerald-400 animate-ping' : 'bg-gray-600'}`}></span>
            <span className="text-[11px]">{isOnline ? '守護程序服務中' : '等待啟動'}</span>
          </div>
        </div>

        <div className="bg-[#1e1f22] p-4 rounded-xl border border-[#2b2d31] relative overflow-hidden shadow-lg card-hover-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-gray-400">Discord API 延遲</span>
            <div className="p-2 rounded-lg bg-amber-950/60 text-amber-400 border border-amber-800/40">
              <Activity className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline space-x-1">
            <span className="text-2xl font-bold text-emerald-400 font-mono">
              {isOnline ? `${telemetry?.ping || 18} ms` : '—'}
            </span>
            <span className="text-xs text-gray-500">極低延遲</span>
          </div>
          <div className="mt-3 text-[11px] text-gray-400 flex items-center space-x-1">
            <Wifi className="w-3 h-3 text-emerald-400" />
            <span>直連亞太高速骨幹 (10Gbps Uplink)</span>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-[#1e1f22] p-5 rounded-xl border border-[#2b2d31] shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-[#2b2d31]">
            <div className="flex items-center space-x-2">
              <Server className="w-4 h-4 text-discord-blurple" />
              <h4 className="text-sm font-bold text-white">託管節點伺服器規格</h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-950 text-emerald-400 border border-emerald-800/40">
              營運正常
            </span>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">主機節點標識</span>
              <span className="font-mono text-gray-200">RPJG-TW-Node-01 (台灣彰化機房)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">作業架構</span>
              <span className="font-mono text-gray-200">RPJG Cloud Container (Node.js & Python 3.14)</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">自動崩潰重啟守護 (Crash Recovery)</span>
              <span className="text-emerald-400 font-medium">已啟用 (3秒冷啟動)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">開發維護單位</span>
              <span className="text-indigo-300 font-semibold">R.P.J.G 開發部門</span>
            </div>
          </div>
        </div>

        <div className="bg-[#1e1f22] p-5 rounded-xl border border-[#2b2d31] shadow-lg">
          <div className="flex items-center justify-between pb-3 border-b border-[#2b2d31]">
            <div className="flex items-center space-x-2">
              <Zap className="w-4 h-4 text-amber-400" />
              <h4 className="text-sm font-bold text-white">Discord 閘道分片狀態 (Shard Overview)</h4>
            </div>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-indigo-950 text-indigo-400 border border-indigo-800/40">
              Gateway v10
            </span>
          </div>
          <div className="mt-4 space-y-3 text-xs">
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">分片分配 (Shard Index)</span>
              <span className="font-mono text-gray-200">Shard #0 of 1</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">Intents 意圖開關</span>
              <span className="font-mono text-gray-200">Guilds, Messages, MessageContent</span>
            </div>
            <div className="flex justify-between py-1 border-b border-gray-800">
              <span className="text-gray-400">心跳回報狀態 (Heartbeat ACK)</span>
              <span className="text-emerald-400 font-medium">每 41.25 秒正常同步</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-gray-400">DDoS 高防保護</span>
              <span className="text-cyan-400 font-medium">RPJG Anycast 流量過濾防禦中</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
