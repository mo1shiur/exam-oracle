import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useT } from '../i18n/useT.js';

export default function Topbar() {
  const { user, logout } = useAuth();
  const { t, lang, setLang, languages } = useT();
  const nav = useNavigate();

  const langLabel = { en: 'English', bn: 'বাংলা', zh: '中文' };

  return (
    <header className="topbar">
      <Link to="/" className="brand">🧠 {t('appName')}</Link>
      <nav>
        <select
          value={lang}
          onChange={(e) => setLang(e.target.value)}
          aria-label="Language"
          style={{ width: 'auto', padding: '0.4rem 0.6rem' }}
        >
          {languages.map((l) => (
            <option key={l} value={l}>
              {langLabel[l]}
            </option>
          ))}
        </select>
        {user && (
          <>
            <span className="muted small" style={{ margin: '0 0.5rem' }}>
              {user.display_name || user.email}
            </span>
            <button
              onClick={() => {
                logout();
                nav('/login');
              }}
            >
              {t('signOut')}
            </button>
          </>
        )}
      </nav>
    </header>
  );
}
