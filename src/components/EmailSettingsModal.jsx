import React, { useState, useEffect } from 'react';
import {
  X,
  Mail,
  Check,
  Copy,
  Send,
  RefreshCw,
  ExternalLink,
  ShieldCheck,
  AlertTriangle,
  Zap,
  HelpCircle
} from 'lucide-react';

const GAS_CODE = `/**
 * RPJG BotCloud - Gmail HTTPS 郵件轉發引擎 (Google Apps Script)
 * 解決 Render / 雲端伺服器免費版封鎖 SMTP 465/587 埠口之問題
 * 官方維護：R.P.J.G 開發部門
 */

// 1. 處理瀏覽器直接打開網址 (GET 請求) - 解決「找不到以下指示函式：doGet」
function doGet(e) {
  var testParam = (e && e.parameter && e.parameter.test) ? e.parameter.test : '';
  
  // 若網址後方帶有 ?test=1 或 ?test=your_email@gmail.com 即可在瀏覽器直接觸發測試信
  if (testParam) {
    try {
      var target = (testParam === '1' || testParam === 'true') ? Session.getActiveUser().getEmail() : testParam;
      GmailApp.sendEmail(target, '【RPJG BotCloud】Google 轉發連線測試成功', '主管您好！恭喜您的 Google Apps Script 轉發引擎已成功上線，可正常由 Gmail 發送郵件。');
      return ContentService.createTextOutput(JSON.stringify({
        success: true,
        message: '測試成功！已成功寄出一封測試信至 ' + target,
        timestamp: new Date().toISOString()
      })).setMimeType(ContentService.MimeType.JSON);
    } catch (err) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: '測試寄信失敗: ' + err.toString()
      })).setMimeType(ContentService.MimeType.JSON);
    }
  }

  // 瀏覽器直接點開網址時顯示連線成功狀態
  return ContentService.createTextOutput(JSON.stringify({
    success: true,
    status: 'ONLINE',
    engine: 'RPJG BotCloud Gmail Relay Engine',
    message: '🎉 服務連線正常！轉發引擎已在線就緒。請將此網址複製並貼回 RPJG BotCloud 後台【Gmail 郵件設定】即可自動發信！',
    tip: '若要直接在瀏覽器測試發信，可在網址後方加上 ?test=1'
  })).setMimeType(ContentService.MimeType.JSON);
}

// 2. 處理伺服器端發信指令 (POST 請求)
function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: '未接收到 POST 資料內容'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var data = JSON.parse(e.postData.contents);
    
    // 安全驗證金鑰
    if (data.token !== 'RPJG_GMAIL_RELAY_TOKEN_2026') {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: '安全金鑰不符，請求已被拒絕'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var recipient = data.to;
    if (!recipient) {
      return ContentService.createTextOutput(JSON.stringify({
        success: false,
        message: '未指定收件者 Email'
      })).setMimeType(ContentService.MimeType.JSON);
    }

    var subject = data.subject || '【RPJG BotCloud】系統通知';
    var body = data.text || '';
    var htmlBody = data.html || '';

    GmailApp.sendEmail(recipient, subject, body, {
      htmlBody: htmlBody,
      name: data.senderName || 'R.P.J.G 開發部門'
    });

    return ContentService.createTextOutput(JSON.stringify({
      success: true,
      message: '郵件已由 Gmail 成功送達！',
      timestamp: new Date().toISOString()
    })).setMimeType(ContentService.MimeType.JSON);

  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      success: false,
      message: '發信失敗: ' + err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}`;

export default function EmailSettingsModal({ isOpen, onClose, currentUser }) {
  const [settings, setSettings] = useState(null);
  const [relayUrl, setRelayUrl] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

  useEffect(() => {
    if (isOpen) {
      fetchSettings();
      setTestResult(null);
      setSaveStatus(null);
    }
  }, [isOpen]);

  const fetchSettings = async () => {
    setIsLoading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/admin/mailer-settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      const data = await res.json();
      if (data.success) {
        setSettings(data);
        setRelayUrl(data.relayUrl || '');
      }
    } catch (err) {
      console.error('取得郵件設定失敗:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveRelay = async (e) => {
    if (e) e.preventDefault();
    setIsSaving(true);
    setSaveStatus(null);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/admin/mailer-settings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ relayUrl })
      });
      const data = await res.json();
      if (data.success) {
        setSaveStatus({ type: 'success', message: data.message });
        fetchSettings();
      } else {
        setSaveStatus({ type: 'error', message: data.message });
      }
    } catch (err) {
      setSaveStatus({ type: 'error', message: '儲存失敗: ' + err.message });
    } finally {
      setIsSaving(false);
    }
  };

  const handleTestEmail = async () => {
    setIsTesting(true);
    setTestResult(null);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch('/api/admin/test-email', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ targetEmail: currentUser?.email })
      });
      const data = await res.json();
      setTestResult(data);
    } catch (err) {
      setTestResult({ success: false, message: '測試異常: ' + err.message });
    } finally {
      setIsTesting(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(GAS_CODE);
    setCopiedCode(true);
    setTimeout(() => setCopiedCode(false), 3000);
  };

  if (!isOpen) return null;

  const isRelayActive = settings?.activeEngine === 'GAS_HTTPS_RELAY';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fade-in">
      <div className="bg-[#1e1f22] border border-[#2b2d31] w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-[#2b2d31] flex items-center justify-between bg-[#18191c]">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30">
              <Mail className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white flex items-center space-x-2">
                <span>Gmail 郵件發送管理與雲端轉發</span>
                <span className="px-2 py-0.5 rounded text-[10px] bg-indigo-500/20 text-indigo-300 font-mono">
                  雙引擎架構
                </span>
              </h3>
              <p className="text-xs text-gray-400 mt-0.5">
                開通新用戶或經銷商時自動以 Gmail 寄出登入憑證
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-2 rounded-xl hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto space-y-6">
          {/* 狀態卡片 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31]">
              <span className="text-xs text-gray-400 block mb-1">當前運作發信引擎</span>
              <div className="flex items-center space-x-2">
                <span className={`w-2.5 h-2.5 rounded-full ${isRelayActive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'}`} />
                <span className="text-sm font-bold text-white">
                  {isRelayActive ? 'Google Apps Script HTTPS 轉發' : '原生 Gmail SMTP 直連'}
                </span>
              </div>
              <span className="text-[11px] text-gray-500 mt-1 block font-mono">
                {isRelayActive ? '埠口 443 • 免費永不斷線' : '埠口 465 (Render 免費版阻擋)'}
              </span>
            </div>

            <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31]">
              <span className="text-xs text-gray-400 block mb-1">寄件發信者信箱</span>
              <span className="text-sm font-bold text-amber-300 font-mono truncate block">
                {settings?.smtpUser || 'ryanryan311311@gmail.com'}
              </span>
              <span className="text-[11px] text-emerald-400 mt-1 inline-flex items-center space-x-1">
                <Check className="w-3 h-3 shrink-0" />
                <span>認證信件皆由此 Gmail 簽發</span>
              </span>
            </div>
          </div>

          {/* 重要提示：Render 封鎖 SMTP */}
          <div className="p-4 rounded-xl bg-amber-950/30 border border-amber-600/40 text-xs text-amber-200 space-y-2">
            <div className="flex items-center space-x-2 font-bold text-amber-300">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>為什麼需要 Google Apps Script HTTPS 轉發？</span>
            </div>
            <p className="leading-relaxed text-gray-300">
              Render.com 雲端主機對<strong>所有免費專案封鎖了 SMTP 465 與 587 埠口</strong>以防濫用。
              使用 Google 官方免費的 Apps Script 網頁應用程式，可透過標準 <strong>HTTPS 443 埠口</strong>（完全不被防火牆封鎖）由您的 Gmail 正常送出郵件！
            </p>
          </div>

          {/* Google Apps Script 網址設定 */}
          <form onSubmit={handleSaveRelay} className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31] space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-white flex items-center space-x-1.5">
                <Zap className="w-4 h-4 text-emerald-400" />
                <span>Google Apps Script 網頁應用程式網址 (Web App URL)</span>
              </label>
              <button
                type="button"
                onClick={() => setShowTutorial(!showTutorial)}
                className="text-[11px] text-discord-blurple hover:underline flex items-center space-x-1"
              >
                <HelpCircle className="w-3 h-3" />
                <span>{showTutorial ? '收起步驟教學' : '查看 30 秒設定教學'}</span>
              </button>
            </div>

            <div className="flex flex-col sm:flex-row gap-2">
              <input
                type="url"
                placeholder="https://script.google.com/macros/s/.../exec"
                value={relayUrl}
                onChange={(e) => setRelayUrl(e.target.value)}
                className="flex-1 bg-[#1e1f22] text-white px-3 py-2 rounded-xl border border-[#35373c] text-xs font-mono focus:border-discord-blurple focus:outline-none"
              />
              <button
                type="submit"
                disabled={isSaving}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold transition flex items-center justify-center space-x-1 shrink-0 shadow-md shadow-emerald-600/20"
              >
                {isSaving ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Check className="w-3.5 h-3.5" />}
                <span>{isSaving ? '儲存中...' : '儲存轉發網址'}</span>
              </button>
            </div>

            {saveStatus && (
              <div className={`p-2.5 rounded-lg text-xs flex items-center space-x-2 ${
                saveStatus.type === 'success' ? 'bg-emerald-950/60 text-emerald-300 border border-emerald-800' : 'bg-red-950/60 text-red-300 border border-red-800'
              }`}>
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{saveStatus.message}</span>
              </div>
            )}
          </form>

          {/* 教學面板 */}
          {showTutorial && (
            <div className="bg-[#141517] p-4 rounded-xl border border-indigo-500/30 text-xs text-gray-300 space-y-3 animate-fade-in">
              <div className="flex items-center justify-between border-b border-[#2b2d31] pb-2">
                <h4 className="font-bold text-white flex items-center space-x-1.5">
                  <Zap className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  <span>30 秒免費設定 Google Apps Script 教學：</span>
                </h4>
                <button
                  type="button"
                  onClick={handleCopyCode}
                  className="flex items-center space-x-1 px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-semibold transition text-[11px]"
                >
                  {copiedCode ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                  <span>{copiedCode ? '已複製代碼！' : '一鍵複製腳本代碼'}</span>
                </button>
              </div>

              <ol className="list-decimal list-inside space-y-2 text-gray-300 leading-relaxed pl-1">
                <li>
                  前往 <a href="https://script.google.com" target="_blank" rel="noreferrer" className="text-discord-blurple underline inline-flex items-center space-x-0.5"><span>Google Apps Script 官網</span><ExternalLink className="w-3 h-3 ml-0.5" /></a>，點擊左上角「<strong>新專案</strong>」。
                </li>
                <li>
                  將編輯器預設內容清空，貼上剛才複製的腳本代碼，點擊磁碟圖示儲存。
                </li>
                <li>
                  點擊右上角「<strong>部署</strong>」&rarr;「<strong>新增部署</strong>」。
                </li>
                <li>
                  左側齒輪選「<strong>網頁應用程式 (Web App)</strong>」：
                  <ul className="list-disc list-inside pl-4 mt-1 space-y-0.5 text-gray-400">
                    <li>執行身分：<strong>我 (您的 Gmail)</strong></li>
                    <li>誰可以存取：<strong>所有人 (Anyone)</strong></li>
                  </ul>
                </li>
                <li>
                  點擊「部署」並授予 Gmail 發信用權限，將生成的「<strong>網頁應用程式網址</strong>」複製貼回上方輸入框並儲存！
                  <div className="text-[11px] text-amber-300/90 mt-1 pl-1">
                    💡 提示：若您直接在瀏覽器分頁開啟該網址，會顯示 <code>ONLINE</code> 正常就緒狀態（亦可在網址後加上 <code>?test=1</code> 直接測試寄信）。
                  </div>
                </li>
              </ol>
            </div>
          )}

          {/* 發信測試專區 */}
          <div className="bg-[#141517] p-4 rounded-xl border border-[#2b2d31] space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-white block">即時測試發送連線</span>
                <span className="text-[11px] text-gray-400">將發送一封測試信件至管理員信箱 ({currentUser?.email})</span>
              </div>
              <button
                type="button"
                onClick={handleTestEmail}
                disabled={isTesting}
                className="px-4 py-2 rounded-xl bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 border border-amber-500/40 text-xs font-bold transition flex items-center space-x-1.5"
              >
                {isTesting ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                <span>{isTesting ? '正在連線發送中...' : '發送測試郵件'}</span>
              </button>
            </div>

            {testResult && (
              <div className={`p-3.5 rounded-xl text-xs flex flex-col space-y-1.5 ${
                testResult.success
                  ? 'bg-emerald-950/50 border border-emerald-500/50 text-emerald-200'
                  : 'bg-red-950/50 border border-red-500/50 text-red-200'
              }`}>
                <div className="flex items-center space-x-2 font-bold">
                  {testResult.success ? <Check className="w-4 h-4 text-emerald-400 shrink-0" /> : <AlertTriangle className="w-4 h-4 text-red-400 shrink-0" />}
                  <span>{testResult.success ? '發信成功！' : '發信失敗'}</span>
                </div>
                <div className="pl-6 text-[11px] leading-relaxed text-gray-300 font-mono">
                  {testResult.message}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-[#2b2d31] bg-[#18191c] flex items-center justify-between">
          <span className="text-[11px] text-gray-500">
            由 R.P.J.G 開發部門 核心保障 • 雲端郵件通道
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-gray-800 hover:bg-gray-700 text-gray-200 text-xs font-semibold transition"
          >
            關閉視窗
          </button>
        </div>
      </div>
    </div>
  );
}
