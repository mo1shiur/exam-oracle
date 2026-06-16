import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../context/AuthContext.jsx';
import { useT } from '../i18n/useT.js';

const langLabel = { en: 'EN', bn: 'BN', zh: 'ZH', mixed: '🌐' };

export default function DashboardPage() {
  const { t } = useT();
  const [exams, setExams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showNew, setShowNew] = useState(false);
  const [title, setTitle] = useState('');
  const [subject, setSubject] = useState('');
  const [description, setDescription] = useState('');
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const data = await api('/api/exams');
      setExams(data.exams || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const create = async (e) => {
    e.preventDefault();
    setErr('');
    setBusy(true);
    try {
      await api('/api/exams', { method: 'POST', body: { title, subject, description } });
      setTitle('');
      setSubject('');
      setDescription('');
      setShowNew(false);
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id) => {
    if (!confirm(t('confirmDelete'))) return;
    try {
      await api(`/api/exams/${id}`, { method: 'DELETE' });
      await load();
    } catch (e) {
      alert(e.message);
    }
  };

  return (
    <main className="container">
      <div className="row between" style={{ marginBottom: '1rem' }}>
        <h1 style={{ margin: 0 }}>{t('dashboard')}</h1>
        <button className="primary" onClick={() => setShowNew((s) => !s)}>
          + {t('newExam')}
        </button>
      </div>

      {showNew && (
        <div className="card" style={{ marginBottom: '1rem' }}>
          <form onSubmit={create} className="grid">
            <div>
              <label>{t('examTitle')}</label>
              <input value={title} onChange={(e) => setTitle(e.target.value)} required autoFocus />
            </div>
            <div className="grid cols-2">
              <div>
                <label>{t('subject')}</label>
                <input value={subject} onChange={(e) => setSubject(e.target.value)} />
              </div>
              <div>
                <label>{t('description')}</label>
                <input value={description} onChange={(e) => setDescription(e.target.value)} />
              </div>
            </div>
            {err && <div className="error">{err}</div>}
            <div className="row">
              <button type="submit" className="primary" disabled={busy}>
                {busy && <span className="spinner" />} {t('create')}
              </button>
              <button type="button" onClick={() => setShowNew(false)}>{t('cancel')}</button>
            </div>
          </form>
        </div>
      )}

      <div className="info" style={{ marginBottom: '1rem' }}>
        💡 {t('tipsBody')}
      </div>

      {loading ? (
        <div className="empty">{t('generating')}…</div>
      ) : exams.length === 0 ? (
        <div className="empty">{t('noExams')}</div>
      ) : (
        <div className="grid cols-2">
          {exams.map((exam) => (
            <div key={exam.id} className="card">
              <div className="row between">
                <div>
                  <h3 style={{ margin: 0 }}>{exam.title}</h3>
                  {exam.subject && <div className="muted small">{exam.subject}</div>}
                </div>
                {exam.detected_language && (
                  <span className="badge lang">{langLabel[exam.detected_language] || exam.detected_language}</span>
                )}
              </div>
              {exam.description && <p className="muted small" style={{ marginTop: '0.5rem' }}>{exam.description}</p>}
              <div className="row" style={{ marginTop: '1rem' }}>
                <Link to={`/exam/${exam.id}`}><button className="primary">{t('dashboard')} →</button></Link>
                <button className="danger" onClick={() => remove(exam.id)}>{t('delete')}</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
