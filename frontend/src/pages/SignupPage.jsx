import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api, useAuth } from '../context/AuthContext.jsx';
import { useT } from '../i18n/useT.js';

export default function SignupPage() {
  const { t } = useT();
  const { login } = useAuth();
  const nav = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      const data = await api('/api/auth/register', {
        method: 'POST',
        body: { email, password, displayName },
      });
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
            <label>{t('displayName')}</label>
            <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} />
          </div>
          <div>
            <label>{t('password')}</label>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} />
          </div>
          {err && <div className="error">{err}</div>}
          <button className="primary" type="submit" disabled={busy}>
            {busy && <span className="spinner" />} {t('signUp')}
          </button>
        </form>
        <p className="small muted" style={{ marginTop: '1rem' }}>
          {t('haveAccount')} <Link to="/login">{t('signIn')}</Link>
        </p>
      </div>
    </div>
  );
}
