import React, { useState, useEffect } from 'react';
import { Key, Eye, EyeOff, Plus, Trash2, Save, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function EnvEditor({ bot, onRestart }) {
  const [envVars, setEnvVars] = useState([]);
  const [showTokens, setShowTokens] = useState({});
  const [isSaving, setIsSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  useEffect(() => {
    if (!bot) return;
    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/files/content?path=.env`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.content) {
          const lines = data.content.split('\n');
          const parsed = [];
          for (const line of lines) {
            const trimmed = line.trim();
            if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
              const firstEqual = trimmed.indexOf('=');
              const key = trimmed.substring(0, firstEqual).trim();
              const value = trimmed.substring(firstEqual + 1).trim();
              parsed.push({ key, value });
            }
          }
          if (parsed.length === 0) {
            parsed.push({ key: 'DISCORD_BOT_TOKEN', value: 'YOUR_BOT_TOKEN_HERE' });
            parsed.push({ key: 'BOT_PREFIX', value: '!' });
          }
          setEnvVars(parsed);
        }
      })
      .catch(() => {
        setEnvVars([
          { key: 'DISCORD_BOT_TOKEN', value: 'YOUR_BOT_TOKEN_HERE' },
          { key: 'BOT_PREFIX', value: '!' }
        ]);
      });
  }, [bot?.id]);

  const toggleShow = (index) => {
    setShowTokens(prev => ({ ...prev, [index]: !prev[index] }));
  };

  const handleUpdate = (index, field, val) => {
    const updated = [...envVars];
    updated[index][field] = val;
    setEnvVars(updated);
  };

  const handleAdd = () => {
    setEnvVars([...envVars, { key: '', value: '' }]);
  };

  const handleRemove = (index) => {
    setEnvVars(envVars.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    if (!bot) return;
    setIsSaving(true);
    setSavedSuccess(false);

    const fileContent = `# RPJG BotCloud 環境變數設定\n# 作者：R.P.J.G 開發部門\n\n` +
      envVars.filter(v => v.key.trim().length > 0)
        .map(v => `${v.key.trim()}=${v.value}`)
        .join('\n') + '\n';

    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/files/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        path: '.env',
        content: fileContent
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSavedSuccess(true);
          setTimeout(() => setSavedSuccess(false), 4000);
        }
      })
      .finally(() => setIsSaving(false));
  };

  return (
    <div className="bg-[#1e1f22] rounded-xl border border-[#2b2d31] p-6 shadow-2xl">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-[#2b2d31] gap-4">
        <div>
          <div className="flex items-center space-x-2 text-lg font-bold text-white">
            <Key className="w-5 h-5 text-discord-blurple" />
            <span>環境變數安全金鑰保險箱 (.env Vault)</span>
          </div>
          <p className="text-xs text-gray-400 mt-1">
            設定 Discord Bot Token、API 金鑰與應用程式環境參數。機密憑證將受到 RPJG 沙盒加密隔離。
          </p>
        </div>

        <div className="flex items-center space-x-3">
          {savedSuccess && (
            <div className="flex items-center space-x-1.5 text-xs text-emerald-400 bg-emerald-950/40 px-3 py-1.5 rounded-lg border border-emerald-800/40">
              <CheckCircle2 className="w-4 h-4" />
              <span>變更已保存！</span>
            </div>
          )}
          <button
            onClick={handleAdd}
            className="flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-gray-800 hover:bg-gray-700 text-gray-200 transition"
          >
            <Plus className="w-4 h-4" />
            <span>新增變數</span>
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="flex items-center space-x-1.5 px-4 py-1.5 text-xs font-semibold rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover text-white transition disabled:opacity-50 shadow-md"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? '儲存中...' : '儲存並套用'}</span>
          </button>
        </div>
      </div>

      <div className="mt-4 p-3 rounded-lg bg-amber-950/30 border border-amber-800/40 flex items-start space-x-3 text-xs text-amber-200">
        <ShieldAlert className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
        <div>
          <span className="font-semibold">安全提示：</span>
          <span> 請切勿將您的 Discord Bot Token 洩露給無關第三方。變更變數後，請在右上角或控制台點擊「重啟機器人」以加載最新配置。</span>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        {envVars.map((item, index) => {
          const isSecret = item.key.toLowerCase().includes('token') || item.key.toLowerCase().includes('secret') || item.key.toLowerCase().includes('key');
          const isShown = showTokens[index];

          return (
            <div key={index} className="flex items-center space-x-2 bg-[#141517] p-2.5 rounded-lg border border-[#2b2d31]">
              <div className="w-1/3">
                <input
                  type="text"
                  value={item.key}
                  onChange={(e) => handleUpdate(index, 'key', e.target.value)}
                  placeholder="VARIABLE_NAME"
                  className="w-full bg-[#1e1f22] text-xs font-mono font-medium text-gray-200 px-3 py-2 rounded border border-[#35373c] focus:outline-none focus:border-discord-blurple"
                />
              </div>
              <span className="text-gray-500 font-mono text-sm">=</span>
              <div className="flex-1 relative">
                <input
                  type={isSecret && !isShown ? 'password' : 'text'}
                  value={item.value}
                  onChange={(e) => handleUpdate(index, 'value', e.target.value)}
                  placeholder="variable_value"
                  className="w-full bg-[#1e1f22] text-xs font-mono text-gray-200 px-3 py-2 pr-9 rounded border border-[#35373c] focus:outline-none focus:border-discord-blurple"
                />
                {isSecret && (
                  <button
                    type="button"
                    onClick={() => toggleShow(index)}
                    className="absolute right-2.5 top-2.5 text-gray-400 hover:text-gray-200"
                  >
                    {isShown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                )}
              </div>
              <button
                onClick={() => handleRemove(index)}
                className="p-2 text-gray-500 hover:text-red-400 rounded hover:bg-gray-800 transition"
                title="刪除"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
