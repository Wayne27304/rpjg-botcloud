import React from 'react';
import { AlertTriangle, RefreshCw, LogOut } from 'lucide-react';

export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('RPJG BotCloud UI Runtime Crash:', error, errorInfo);
  }

  handleReset = () => {
    localStorage.removeItem('rpjg_auth_token');
    localStorage.removeItem('rpjg_auth_user');
    window.location.href = window.location.pathname;
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-[#0e0f11] text-gray-200 flex items-center justify-center p-4 font-sans">
          <div className="max-w-md w-full bg-[#1e1f22] p-6 sm:p-8 rounded-2xl border border-red-500/40 shadow-2xl space-y-5 text-center">
            <div className="w-14 h-14 bg-red-500/20 text-red-400 rounded-2xl border border-red-500/40 flex items-center justify-center mx-auto shadow-lg shadow-red-500/20">
              <AlertTriangle className="w-8 h-8" />
            </div>

            <div>
              <h2 className="text-lg font-bold text-white">介面載入遇到暫時性問題</h2>
              <p className="text-xs text-gray-400 mt-1 leading-relaxed">
                系統已攔截此異常，您的機器人與雲端後端仍正常運作中。
              </p>
            </div>

            {this.state.error && (
              <div className="p-3 bg-[#141517] rounded-xl border border-gray-800 text-left overflow-x-auto">
                <code className="text-[11px] font-mono text-rose-300 block">
                  {String(this.state.error?.message || this.state.error)}
                </code>
              </div>
            )}

            <div className="flex flex-col sm:flex-row gap-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-discord-blurple hover:bg-discord-blurple-hover text-white rounded-xl text-xs font-bold transition shadow-lg shadow-discord-blurple/25"
              >
                <RefreshCw className="w-4 h-4" />
                <span>重新載入頁面</span>
              </button>

              <button
                onClick={this.handleReset}
                className="flex-1 flex items-center justify-center space-x-2 px-4 py-2.5 bg-[#2b2d31] hover:bg-gray-700 text-gray-300 rounded-xl text-xs font-bold transition border border-gray-700"
              >
                <LogOut className="w-4 h-4" />
                <span>清除快取重新登入</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
