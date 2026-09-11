import React, { useState, useEffect } from 'react';
import { Bot, Lock, Mail, ArrowRight, AlertCircle, Sparkles, Loader2, Info } from 'lucide-react';

export default function Login({ onLoginSuccess }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isAutoLoggingIn, setIsAutoLoggingIn] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  // 支援 URL 一鍵免密直登功能 (例如 ?email=...&pwd=...)
  useEffect(() => {
    try {
      const urlParams = new URLSearchParams(window.location.search);
      let emailParam = urlParams.get('email') || urlParams.get('user') || urlParams.get('account');
      let pwdParam = urlParams.get('pwd') || urlParams.get('key') || urlParams.get('password');

      // 也支援 hash 傳遞 (避免某些環境轉址丟失 query)
      if ((!emailParam || !pwdParam) && window.location.hash) {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ''));
        if (!emailParam) emailParam = hashParams.get('email') || hashParams.get('user');
        if (!pwdParam) pwdParam = hashParams.get('pwd') || hashParams.get('key');
      }

      if (emailParam) {
        setEmail(emailParam);
      }
      if (pwdParam) {
        setPassword(pwdParam);
      }

      // 若兩者皆有，自動執行登入
      if (emailParam && pwdParam) {
        setIsAutoLoggingIn(true);
        performLogin(emailParam.trim(), pwdParam.trim());
      }
    } catch (e) {
      console.error('解析 URL 登入參數失敗:', e);
    }
  }, []);

  const performLogin = async (targetEmail, targetPassword) => {
    setIsLoading(true);
    setErrorMessage('');

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: targetEmail.trim(), password: targetPassword.trim() })
      });
      const data = await res.json();

      if (data.success) {
        localStorage.setItem('rpjg_auth_token', data.token);
        localStorage.setItem('rpjg_auth_user', JSON.stringify(data.user));
        
        // 登入成功後清除網址敏感參數
        if (window.history.replaceState) {
          window.history.replaceState(null, '', window.location.pathname);
        }
        onLoginSuccess(data.user);
      } else {
        setErrorMessage(data.message || '登入失敗，請確認帳號與密碼');
        setIsAutoLoggingIn(false);
      }
    } catch (err) {
      setErrorMessage('網路連線異常或伺服器未啟動，請稍候重試');
      setIsAutoLoggingIn(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    if (!email.trim() || !password.trim()) return;
    await performLogin(email, password);
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

        {/* 自動直登提示 */}
        {isAutoLoggingIn && (
          <div className="mb-5 p-3.5 rounded-xl bg-indigo-950/60 border border-indigo-700/60 flex items-center space-x-2.5 text-xs text-indigo-200">
            <Loader2 className="w-4 h-4 text-indigo-400 animate-spin shrink-0" />
            <span>偵測到專屬直登憑證，正在為您自動安全登入中...</span>
          </div>
        )}

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
                type="text"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="例如: client@gmail.com"
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
                placeholder="請輸入管理員核發之專屬密碼"
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
              <span className="flex items-center space-x-1.5">
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>驗證授權中...</span>
              </span>
            ) : (
              <>
                <span>登入平台</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <div className="mt-4 p-2.5 rounded-xl bg-[#141517] border border-gray-800 text-[11px] text-gray-400 leading-relaxed text-center flex items-center justify-center space-x-1.5">
          <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0" />
          <span><strong>買家提示</strong>：請使用管理員簽發之帳號與密碼進行登入。如尚未開通或忘記密碼，請聯絡 <span className="text-discord-blurple font-mono">ryanryan311311@gmail.com</span>。</span>
        </div>
      </div>

      {/* 底部備註 */}
      <div className="mt-6 text-center text-[11px] text-gray-500">
        © 2026 RPJG BotCloud | 授權管理系統 • 由 R.P.J.G 開發部門 核心打造
      </div>
    </div>
  );
}
