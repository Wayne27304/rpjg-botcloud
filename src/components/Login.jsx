import React, { useState } from 'react';
import { Bot, Lock, Mail, ArrowRight, AlertCircle } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;

    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim(), password })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('rpjg_auth_token', data.token);
        localStorage.setItem('rpjg_auth_user', JSON.stringify(data.user));
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(data.message || '登入失敗，請確認帳號與密碼');
      }
    } catch (err) {
      setErrorMessage('網路連線異常或伺服器未啟動');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#0e0f11] flex flex-col items-center justify-center p-4 relative overflow-hidden select-none">
      {/* 科技感背景裝飾光暈 */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-discord-blurple/10 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-600/10 rounded-full blur-3xl pointer-events-none"></div>

      <div className="w-full max-w-md bg-[#1e1f22] border border-[#2b2d31] rounded-2xl shadow-2xl p-8 relative z-10">
        {/* 平台品牌 Logo */}
        <div className="text-center mb-6">
          <div className="inline-flex p-3.5 rounded-2xl bg-discord-blurple text-white shadow-xl shadow-discord-blurple/25 mb-3">
            <Bot className="w-8 h-8" />
          </div>
          <h1 className="text-2xl font-extrabold text-white tracking-wide">
            RPJG BotCloud
          </h1>
          <div className="inline-block mt-1 px-3 py-0.5 rounded-full bg-indigo-500/15 border border-indigo-500/30 text-indigo-300 text-xs font-semibold">
            作者：R.P.J.G 開發部門
          </div>
          <p className="text-xs text-gray-400 mt-2">
            請輸入管理員簽發之授權帳密以存取 Discord Bot 託管雲
          </p>
        </div>

        {/* 錯誤警示訊息 */}
        {errorMessage && (
          <div className="mb-5 p-3.5 rounded-xl bg-red-950/40 border border-red-800/60 flex items-start space-x-2.5 text-xs text-red-300 animate-shake">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0 mt-0.5" />
            <span className="leading-relaxed">{errorMessage}</span>
          </div>
        )}

        {/* 登入表單 */}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              Gmail / 帳號 Email
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@gmail.com"
                className="w-full bg-[#141517] text-xs text-white pl-10 pr-3.5 py-2.5 rounded-xl border border-[#35373c] focus:outline-none focus:border-discord-blurple transition"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-300 mb-1.5">
              登入密碼
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-gray-400 absolute left-3.5 top-3" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                placeholder="請輸入密碼"
                className="w-full bg-[#141517] text-xs text-white pl-10 pr-3.5 py-2.5 rounded-xl border border-[#35373c] focus:outline-none focus:border-discord-blurple transition"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading}
            className="w-full mt-2 flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-discord-blurple hover:bg-discord-blurple-hover text-white text-xs font-semibold shadow-lg shadow-discord-blurple/30 transition disabled:opacity-50"
          >
            {isLoading ? (
              <span>驗證授權中...</span>
            ) : (
              <>
                <span>登入平台</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      {/* 底部備註 */}
      <div className="mt-6 text-center text-[11px] text-gray-500">
        © 2026 RPJG BotCloud | 授權管理系統 • 由 R.P.J.G 開發部門 核心打造
      </div>
    </div>
  );
}
