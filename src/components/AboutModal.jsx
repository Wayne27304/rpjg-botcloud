import React from 'react';
import { X, ShieldCheck, Terminal, Cpu, Globe, Award, Sparkles, Layers } from 'lucide-react';

export default function AboutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#1e1f22] border border-[#35373c] rounded-2xl w-full max-w-lg overflow-hidden shadow-2xl relative">
        <div className="absolute -top-16 -right-16 w-48 h-48 bg-indigo-600/15 rounded-full blur-3xl pointer-events-none"></div>
        <div className="absolute -bottom-16 -left-16 w-48 h-48 bg-purple-600/15 rounded-full blur-3xl pointer-events-none"></div>

        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-400" />
            <h3 className="text-base font-bold text-white">關於平台與開發部門</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 space-y-5 text-gray-300 text-xs">
          <div className="text-center pb-2">
            <div className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-indigo-900/60 to-purple-900/60 border border-indigo-700/50 shadow-inner mb-2">
              <Sparkles className="w-8 h-8 text-indigo-400" />
            </div>
            <h2 className="text-lg font-extrabold text-white tracking-wide">
              RPJG BotCloud
            </h2>
            <div className="inline-block mt-1 px-3 py-1 rounded-full bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border border-indigo-500/40 text-indigo-300 font-semibold text-[11px]">
              作者：R.P.J.G 開發部門
            </div>
            <p className="text-[11px] text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
              專為 Discord Bot 開發者與社群管理員量身打造的專業線上託管雲平台，提供極致流暢的即時日誌串流、線上編輯與守護重啟機制。
            </p>
          </div>

          <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31] space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <Layers className="w-4 h-4 text-discord-blurple" />
                <span>軟體版本</span>
              </div>
              <span className="font-mono text-white font-semibold">v2.5.0 (RPJG-Enterprise)</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <Globe className="w-4 h-4 text-emerald-400" />
                <span>全球分佈節點</span>
              </div>
              <span className="font-mono text-emerald-300">台灣台北 (TW-01) / 北美奧勒岡 (US-02)</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <Terminal className="w-4 h-4 text-cyan-400" />
                <span>支援語言核心</span>
              </div>
              <span className="font-mono text-white">Node.js (discord.js) / Python (discord.py)</span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-gray-400">
                <Cpu className="w-4 h-4 text-amber-400" />
                <span>程序沙盒守護</span>
              </div>
              <span className="font-mono text-white">獨立 PID 隔離與記憶體超限防護</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-indigo-950/20 border border-indigo-800/30 flex items-start space-x-3 text-indigo-200 text-[11px]">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div>
              <div className="font-bold text-white mb-0.5">R.P.J.G 開發部門 核心宣言</div>
              <p className="text-gray-300 leading-relaxed">
                致力於打造最安全、高可用性、美觀簡約的現代化雲端運算與機器人整合方案。所有模組皆遵循嚴格的高標準自動化容錯與低延遲優化。
              </p>
            </div>
          </div>
        </div>

        <div className="px-6 py-3.5 bg-[#141517] border-t border-[#2b2d31] flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-1.5 text-xs font-semibold rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover text-white transition shadow"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
}
