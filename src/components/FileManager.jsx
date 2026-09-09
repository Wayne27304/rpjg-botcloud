import React, { useState, useEffect, useRef } from 'react';
import { FileCode, FileText, Folder, Save, RefreshCw, CheckCircle2, AlertCircle, Upload } from 'lucide-react';

export default function FileManager({ bot }) {
  const [files, setFiles] = useState([]);
  const [selectedFile, setSelectedFile] = useState(null);
  const [fileContent, setFileContent] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [saveStatus, setSaveStatus] = useState(null);
  const [isLoadingFile, setIsLoadingFile] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const fileInputRef = useRef(null);

  const fetchFiles = () => {
    if (!bot) return;
    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/files`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.files) {
          setFiles(data.files);
          if (!selectedFile && data.files.length > 0) {
            const target = data.files.find(f => f.name === bot.mainFile) || data.files[0];
            loadFile(target.name);
          }
        }
      })
      .catch(err => console.error('無法讀取檔案清單:', err));
  };

  useEffect(() => {
    fetchFiles();
  }, [bot?.id]);

  const loadFile = (fileName) => {
    setSelectedFile(fileName);
    setIsLoadingFile(true);
    setSaveStatus(null);
    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/files/content?path=${encodeURIComponent(fileName)}`, {
      headers: { 'Authorization': `Bearer ${token}` }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setFileContent(data.content);
        }
      })
      .catch(err => console.error('無法讀取檔案內容:', err))
      .finally(() => setIsLoadingFile(false));
  };

  const handleSave = () => {
    if (!selectedFile || isSaving) return;
    setIsSaving(true);
    setSaveStatus(null);

    const token = localStorage.getItem('rpjg_auth_token');
    fetch(`/api/bots/${bot.id}/files/content`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        path: selectedFile,
        content: fileContent
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.success) {
          setSaveStatus('success');
          setTimeout(() => setSaveStatus(null), 3000);
        } else {
          setSaveStatus('error');
        }
      })
      .catch(() => setSaveStatus('error'))
      .finally(() => setIsSaving(false));
  };

  const handleUploadFile = async (e) => {
    if (!e.target.files || !e.target.files[0] || !bot) return;
    const file = e.target.files[0];
    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    const token = localStorage.getItem('rpjg_auth_token');
    try {
      const res = await fetch(`/api/bots/${bot.id}/files/upload`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData
      });
      const data = await res.json();
      if (data.success) {
        fetchFiles();
        loadFile(file.name);
      }
    } catch (err) {
      console.error('上傳失敗:', err);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        handleSave();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedFile, fileContent]);

  const getFileIcon = (name) => {
    if (name.endsWith('.js') || name.endsWith('.ts')) return <FileCode className="w-4 h-4 text-amber-400" />;
    if (name.endsWith('.py')) return <FileCode className="w-4 h-4 text-cyan-400" />;
    if (name.endsWith('.json')) return <FileText className="w-4 h-4 text-emerald-400" />;
    if (name.includes('.env')) return <FileText className="w-4 h-4 text-purple-400" />;
    return <FileText className="w-4 h-4 text-gray-400" />;
  };

  const lines = fileContent.split('\n');

  return (
    <div className="flex flex-col lg:flex-row h-[560px] bg-[#111215] rounded-xl border border-[#2b2d31] overflow-hidden shadow-2xl">
      {/* 側邊檔案清單 */}
      <div className="w-full lg:w-64 bg-[#1e1f22] border-b lg:border-b-0 lg:border-r border-[#2b2d31] flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-[#2b2d31]">
          <div className="flex items-center space-x-2 text-xs font-semibold text-gray-300 uppercase tracking-wider">
            <Folder className="w-3.5 h-3.5 text-discord-blurple" />
            <span>檔案目錄樹</span>
          </div>
          <div className="flex items-center space-x-1">
            <input
              ref={fileInputRef}
              type="file"
              onChange={handleUploadFile}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              title="上傳檔案至機器人目錄"
              className="p-1 rounded hover:bg-discord-blurple/30 text-discord-blurple transition disabled:opacity-50"
            >
              <Upload className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={fetchFiles}
              title="重新整理"
              className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition"
            >
              <RefreshCw className="w-3 h-3" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 space-y-1">
          {files.map((file) => (
            <button
              key={file.path}
              onClick={() => loadFile(file.path)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs transition ${
                selectedFile === file.path
                  ? 'bg-discord-blurple/20 text-discord-blurple font-medium border border-discord-blurple/40'
                  : 'text-gray-300 hover:bg-[#2b2d31]/60 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2.5 truncate">
                {getFileIcon(file.name)}
                <span className="truncate">{file.name}</span>
              </div>
              {file.name === bot.mainFile && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-discord-blurple/30 text-indigo-300 font-mono">
                  main
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-3 border-t border-[#2b2d31] text-[11px] text-gray-500 bg-[#141517] flex justify-between items-center">
          <span>支援 <kbd className="px-1 py-0.5 rounded bg-gray-800 text-gray-300 font-mono">Ctrl+S</kbd> 存檔</span>
          <button
            onClick={() => fileInputRef.current?.click()}
            className="text-discord-blurple hover:underline flex items-center space-x-1"
          >
            <Upload className="w-3 h-3" />
            <span>上傳新檔</span>
          </button>
        </div>
      </div>

      {/* 右側編輯器 */}
      <div className="flex-1 flex flex-col bg-[#141517]">
        <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1b1e] border-b border-[#2b2d31]">
          <div className="flex items-center space-x-2">
            {selectedFile && getFileIcon(selectedFile)}
            <span className="text-xs font-mono font-medium text-gray-200">
              {selectedFile || '請選擇檔案'}
            </span>
            {saveStatus === 'success' && (
              <span className="flex items-center space-x-1 text-[11px] text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border border-emerald-800/50">
                <CheckCircle2 className="w-3 h-3" />
                <span>儲存成功</span>
              </span>
            )}
            {saveStatus === 'error' && (
              <span className="flex items-center space-x-1 text-[11px] text-red-400 bg-red-950/40 px-2 py-0.5 rounded border border-red-800/50">
                <AlertCircle className="w-3 h-3" />
                <span>儲存失敗</span>
              </span>
            )}
          </div>

          <button
            onClick={handleSave}
            disabled={isSaving || !selectedFile}
            className="flex items-center space-x-1.5 px-3 py-1 text-xs font-medium rounded-lg bg-discord-blurple hover:bg-discord-blurple-hover text-white transition disabled:opacity-50 shadow-sm"
          >
            <Save className="w-3.5 h-3.5" />
            <span>{isSaving ? '儲存中...' : '儲存變更'}</span>
          </button>
        </div>

        {isLoadingFile ? (
          <div className="flex-1 flex items-center justify-center text-gray-500 text-xs font-mono">
            載入檔案中...
          </div>
        ) : (
          <div className="flex-1 flex overflow-hidden font-mono text-xs">
            <div className="w-12 py-3 bg-[#111215] text-gray-600 text-right pr-3 select-none overflow-hidden font-mono text-[11px] border-r border-[#232428]">
              {lines.map((_, i) => (
                <div key={i} className="leading-6">{i + 1}</div>
              ))}
            </div>
            <textarea
              value={fileContent}
              onChange={(e) => setFileContent(e.target.value)}
              spellCheck="false"
              className="flex-1 p-3 bg-transparent text-gray-200 resize-none outline-none leading-6 font-mono selection:bg-discord-blurple/30 overflow-auto"
              placeholder="在此輸入或貼上程式碼..."
            />
          </div>
        )}
      </div>
    </div>
  );
}
