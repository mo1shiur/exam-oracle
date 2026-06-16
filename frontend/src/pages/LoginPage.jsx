import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext.jsx';
import { useT } from '../i18n/useT.js';

export default function LoginPage() {
  const { t } = useT();
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await api('/api/auth/login', { method: 'POST', body: { email, password } });
      login(data.token, data.user);
      nav('/');
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth-wrap">
      <div className="card auth-card">
        <h2 style={{ marginTop: 0 }}>🧠 {t('appName')}</h2>
        <p className="muted small" style={{ marginTop: 0 }}>{t('tagline')}</p>
        <form onSubmit={submit} className="grid">
          <div>
            <label>{t('email')}</label>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus />
          </div>
          <div>
            <label>{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {err && <div className="error">{err}</div>}
          <button className="primary" type="submit" disabled={busy}>
            {busy && <span className="spinner" />} {t('signIn')}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          {t('noAccount')} <Link to="/signup">{t('signUp')}</Link>
        </p>
      </div>
    </div>
  );
}
