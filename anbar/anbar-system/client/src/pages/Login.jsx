import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthContext';
import { setApiBaseUrl } from '../api/client';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showServerCfg, setShowServerCfg] = useState(false);
  const [serverUrl, setServerUrl] = useState(localStorage.getItem('anbar_api_base') || 'http://localhost:4500/api');

  async function submit(e) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/');
    } catch (err) {
      setError(err.response?.data?.error || 'اتصال به سرور برقرار نشد. آدرس سرور را بررسی کنید.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-screen">
      <form className="login-card" onSubmit={submit}>
        <div className="login-logo">ا</div>
        <h2 style={{ textAlign: 'center', margin: '0 0 4px', fontSize: 18 }}>ورود به سامانه</h2>
        <p style={{ textAlign: 'center', color: 'var(--text-muted)', fontSize: 12.5, marginTop: 0, marginBottom: 24 }}>
          مدیریت انبار و کنترل پروژه سازمانی
        </p>

        <div className="field">
          <label>نام کاربری</label>
          <input className="input" value={username} onChange={(e) => setUsername(e.target.value)} autoFocus />
        </div>
        <div className="field">
          <label>رمز عبور</label>
          <input className="input" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>

        {error && (
          <div className="pill pill-danger" style={{ display: 'block', marginBottom: 14, padding: '8px 12px' }}>
            {error}
          </div>
        )}

        <button className="btn btn-primary" style={{ width: '100%', justifyContent: 'center' }} disabled={loading}>
          {loading ? 'در حال ورود...' : 'ورود'}
        </button>

        <div
          style={{ textAlign: 'center', marginTop: 16, fontSize: 12, color: 'var(--text-soft)', cursor: 'pointer' }}
          onClick={() => setShowServerCfg((v) => !v)}
        >
          تنظیم آدرس سرور شبکه محلی
        </div>

        {showServerCfg && (
          <div className="field" style={{ marginTop: 10 }}>
            <label>آدرس سرور (مثال: http://192.168.1.10:4500/api)</label>
            <input className="input" value={serverUrl} onChange={(e) => setServerUrl(e.target.value)} />
            <button
              type="button"
              className="btn btn-outline btn-sm"
              style={{ marginTop: 8 }}
              onClick={() => setApiBaseUrl(serverUrl)}
            >
              ذخیره آدرس سرور
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
