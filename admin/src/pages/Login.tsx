import { useState } from 'react';
import { api } from '../api';

export function Login({
  configured,
  devLogin,
  onDevLogin,
  error,
}: {
  configured: boolean;
  devLogin: boolean;
  onDevLogin: () => Promise<void>;
  error: string;
}) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  return (
    <div className="login-wrap">
      <div className="login-card">
        <div className="logo">⌘</div>
        <h1>网站管理中心</h1>
        <p>请使用已授权的 GitHub 管理员账号登录</p>

        {configured ? (
          <a className="btn btn-primary btn-lg btn-block" href="/api/auth/login">
            使用 GitHub 登录
          </a>
        ) : (
          <div className="alert" style={{ textAlign: 'left' }}>
            尚未配置 GitHub 登录（GITHUB_CLIENT_ID / GITHUB_CLIENT_SECRET）。
            请先按教程在部署平台配置环境变量。
          </div>
        )}

        {devLogin && (
          <button
            className="btn btn-block"
            style={{ marginTop: 12 }}
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await onDevLogin();
              } catch (err: any) {
                setMessage(err.message || '登录失败');
              } finally {
                setBusy(false);
              }
            }}
          >
            {busy ? '登录中…' : '本地开发登录（仅本机可用）'}
          </button>
        )}

        {(error || message) && <div className="login-error">{error || message}</div>}
      </div>
    </div>
  );
}

export async function devLogin() {
  await api('auth/dev-login', { method: 'POST' });
}

export function LoginCallbackError() {
  const params = new URLSearchParams(window.location.search);
  const error = params.get('error');
  return <div style={{ padding: 20 }}>{error}</div>;
}
