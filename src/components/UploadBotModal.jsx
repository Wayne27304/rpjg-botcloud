import React, { useState, useRef } from 'react';
import { X, Upload, FolderArchive, FileCode, Check, AlertCircle, FilePlus, Sparkles } from 'lucide-react';

export default function UploadBotModal({ isOpen, onClose, onCreated }) {
  const [botName, setBotName] = useState('');
  const [botType, setBotType] = useState('nodejs'); // 'nodejs' | 'python'
  const [mainFile, setMainFile] = useState('index.js');
  const [description, setDescription] = useState('');
  const [uploadMode, setUploadMode] = useState('zip'); // 'zip' | 'files' | 'blank'

  const [zipFile, setZipFile] = useState(null);
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const zipInputRef = useRef(null);
  const filesInputRef = useRef(null);

  if (!isOpen) return null;

  const handleTypeChange = (type) => {
    setBotType(type);
    if (type === 'python') {
      setMainFile('bot.py');
    } else {
      setMainFile('index.js');
    }
  };

  const handleZipChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setZipFile(file);
      if (!botName) {
        setBotName(file.name.replace(/\.zip$/i, ''));
      }
    }
  };

  const handleFilesChange = (e) => {
    if (e.target.files) {
      const fileList = Array.from(e.target.files);
      setSelectedFiles(fileList);
      if (!botName && fileList.length > 0) {
        setBotName(fileList[0].name.replace(/\.[^/.]+$/, ''));
      }
      // 自動偵測入口：支援任何 .py 或 .js 檔案
      const py = fileList.find(f => f.name.endsWith('.py'));
      const js = fileList.find(f => f.name.endsWith('.js'));
      if (py) {
        setBotType('python');
        setMainFile(py.name);
      } else if (js) {
        setBotType('nodejs');
        setMainFile(js.name);
      } else if (fileList.length === 1) {
        setMainFile(fileList[0].name);
      }
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!botName.trim() || isUploading) return;

    setIsUploading(true);
    setErrorMessage('');

    const token = localStorage.getItem('rpjg_auth_token');
    const formData = new FormData();
    formData.append('name', botName.trim());
    formData.append('type', botType);
    formData.append('mainFile', mainFile.trim());
    formData.append('description', description.trim() || '使用者自訂上傳專案');

    if (uploadMode === 'zip' && zipFile) {
      formData.append('zip', zipFile);
    } else if (uploadMode === 'files' && selectedFiles.length > 0) {
      for (const f of selectedFiles) {
        formData.append('files', f);
      }
    }

    try {
      const res = await fetch('/api/bots/upload', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`
        },
        body: formData
      });
      const data = await res.json();

      if (data.success) {
        onCreated(data.bot);
        onClose();
      } else {
        setErrorMessage(data.message || '上傳建立失敗');
      }
    } catch (err) {
      setErrorMessage('網路請求失敗');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fadeIn">
      <div className="bg-[#1e1f22] border border-[#35373c] rounded-2xl w-full max-w-xl overflow-hidden shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-2">
            <Upload className="w-5 h-5 text-discord-blurple" />
            <h3 className="text-base font-bold text-white">上傳自訂專案建立機器人</h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMessage && (
          <div className="mx-6 mt-4 p-3 rounded-xl bg-red-950/40 border border-red-800/60 flex items-center space-x-2 text-xs text-red-300">
            <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs">
          {/* 模式切換 */}
          <div>
            <label className="block font-semibold text-gray-300 mb-1.5 uppercase tracking-wider text-[11px]">
              專案上傳方式
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setUploadMode('zip')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                  uploadMode === 'zip'
                    ? 'bg-discord-blurple/20 border-discord-blurple text-white ring-1 ring-discord-blurple'
                    : 'bg-[#141517] border-[#35373c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <FolderArchive className="w-5 h-5 text-amber-400" />
                <span className="font-semibold">上傳 ZIP 壓縮檔</span>
                <span className="text-[10px] text-gray-500">自動解壓縮</span>
              </button>

              <button
                type="button"
                onClick={() => setUploadMode('files')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                  uploadMode === 'files'
                    ? 'bg-discord-blurple/20 border-discord-blurple text-white ring-1 ring-discord-blurple'
                    : 'bg-[#141517] border-[#35373c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <FileCode className="w-5 h-5 text-cyan-400" />
                <span className="font-semibold">選擇程式碼檔案</span>
                <span className="text-[10px] text-gray-500">批次多檔案上傳</span>
              </button>

              <button
                type="button"
                onClick={() => setUploadMode('blank')}
                className={`p-3 rounded-xl border flex flex-col items-center justify-center space-y-1 transition ${
                  uploadMode === 'blank'
                    ? 'bg-discord-blurple/20 border-discord-blurple text-white ring-1 ring-discord-blurple'
                    : 'bg-[#141517] border-[#35373c] text-gray-400 hover:text-gray-200'
                }`}
              >
                <FilePlus className="w-5 h-5 text-emerald-400" />
                <span className="font-semibold">空白沙盒專案</span>
                <span className="text-[10px] text-gray-500">稍後在 IDE 編輯</span>
              </button>
            </div>
          </div>

          {/* 上傳區域 */}
          {uploadMode === 'zip' && (
            <div
              onClick={() => zipInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-[#35373c] hover:border-discord-blurple rounded-xl bg-[#141517] text-center cursor-pointer transition"
            >
              <input
                ref={zipInputRef}
                type="file"
                accept=".zip"
                onChange={handleZipChange}
                className="hidden"
              />
              <FolderArchive className="w-8 h-8 text-amber-400 mx-auto mb-2" />
              {zipFile ? (
                <div className="text-white font-medium">
                  已選取 ZIP: <span className="text-emerald-400 font-mono">{zipFile.name}</span> ({(zipFile.size / 1024).toFixed(1)} KB)
                </div>
              ) : (
                <>
                  <div className="text-gray-300 font-medium">點擊或將專案 .zip 拖曳至此</div>
                  <div className="text-[11px] text-gray-500 mt-1">系統將自動解壓縮專案代碼並建立沙盒環境</div>
                </>
              )}
            </div>
          )}

          {uploadMode === 'files' && (
            <div
              onClick={() => filesInputRef.current?.click()}
              className="p-6 border-2 border-dashed border-[#35373c] hover:border-discord-blurple rounded-xl bg-[#141517] text-center cursor-pointer transition"
            >
              <input
                ref={filesInputRef}
                type="file"
                multiple
                onChange={handleFilesChange}
                className="hidden"
              />
              <FileCode className="w-8 h-8 text-cyan-400 mx-auto mb-2" />
              {selectedFiles.length > 0 ? (
                <div className="text-white font-medium">
                  已選取 <span className="text-emerald-400">{selectedFiles.length}</span> 個檔案:
                  <div className="text-[11px] text-gray-400 mt-1 truncate max-w-sm mx-auto">
                    {selectedFiles.map(f => f.name).join(', ')}
                  </div>
                </div>
              ) : (
                <>
                  <div className="text-gray-300 font-medium">點擊選擇程式碼檔案 (可多選)</div>
                  <div className="text-[11px] text-gray-500 mt-1">例如 bot.py, index.js, package.json, .env</div>
                </>
              )}
            </div>
          )}

          {/* 機器人基本設定 */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-[#2b2d31]">
            <div>
              <label className="block text-gray-300 mb-1 font-medium">機器人名稱 *</label>
              <input
                type="text"
                value={botName}
                onChange={(e) => setBotName(e.target.value)}
                required
                placeholder="例如: 我的自訂 Discord 機器人"
                className="w-full bg-[#141517] p-2.5 rounded-xl border border-[#35373c] text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>

            <div>
              <label className="block text-gray-300 mb-1 font-medium">運行語言核心 *</label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleTypeChange('nodejs')}
                  className={`p-2 rounded-xl border font-mono font-medium transition ${
                    botType === 'nodejs'
                      ? 'bg-discord-blurple text-white border-discord-blurple'
                      : 'bg-[#141517] text-gray-400 border-[#35373c]'
                  }`}
                >
                  Node.js
                </button>
                <button
                  type="button"
                  onClick={() => handleTypeChange('python')}
                  className={`p-2 rounded-xl border font-mono font-medium transition ${
                    botType === 'python'
                      ? 'bg-discord-blurple text-white border-discord-blurple'
                      : 'bg-[#141517] text-gray-400 border-[#35373c]'
                  }`}
                >
                  Python
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-gray-300 mb-1 font-medium">主入口檔案檔名 *</label>
              <input
                type="text"
                value={mainFile}
                onChange={(e) => setMainFile(e.target.value)}
                required
                placeholder={botType === 'python' ? 'bot.py' : 'index.js'}
                className="w-full bg-[#141517] p-2.5 rounded-xl border border-[#35373c] text-white font-mono focus:outline-none focus:border-discord-blurple"
              />
            </div>
            <div>
              <label className="block text-gray-300 mb-1 font-medium">專案說明 / 備註</label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="簡短描述機器人用途"
                className="w-full bg-[#141517] p-2.5 rounded-xl border border-[#35373c] text-white focus:outline-none focus:border-discord-blurple"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#2b2d31]">
            <div className="text-[11px] text-gray-500">
              R.P.J.G 開發部門 • 獨立沙盒 512MB RAM 配額
            </div>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl text-gray-400 hover:text-white hover:bg-gray-800 transition"
              >
                取消
              </button>
              <button
                type="submit"
                disabled={isUploading || !botName.trim()}
                className="flex items-center space-x-1.5 px-5 py-2 rounded-xl bg-discord-blurple hover:bg-discord-blurple-hover text-white font-bold transition disabled:opacity-50 shadow-md"
              >
                {isUploading ? (
                  <span>正在部署專案...</span>
                ) : (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>確認上傳並建立</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
