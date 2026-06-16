import { useEffect, useState, useCallback, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { api } from '../context/AuthContext.jsx';
import { useT } from '../i18n/useT.js';
import QuestionCard from '../components/QuestionCard.jsx';
import FlashcardDeck from '../components/FlashcardDeck.jsx';

const TABS = ['overview', 'questions', 'study', 'flashcards'];

export default function ExamPage() {
  const { id } = useParams();
  const { t } = useT();
  const [tab, setTab] = useState('overview');
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [genCount, setGenCount] = useState(15);
  const [cardCount, setCardCount] = useState(20);
  const [pasteKind, setPasteKind] = useState('study');
  const [pasteText, setPasteText] = useState('');
  const fileInputs = useRef({ study: null, sample: null });

  const load = useCallback(async () => {
    try {
      const d = await api(`/api/exams/${id}`);
      setData(d);
    } catch (e) {
      setErr(e.message);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  const upload = async (kind, file) => {
    if (!file) return;
    setErr('');
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append('kind', kind);
      fd.append('file', file);
      await api(`/api/exams/${id}/materials`, { method: 'POST', body: fd, isForm: true });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const submitPaste = async () => {
    if (!pasteText.trim()) return;
    setErr('');
    setBusy(true);
    try {
      await api(`/api/exams/${id}/materials`, {
        method: 'POST',
        body: { kind: pasteKind, text: pasteText },
      });
      setPasteText('');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const analyze = async () => {
    setErr('');
    setBusy(true);
    try {
      await api(`/api/exams/${id}/analyze`, { method: 'POST' });
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const generate = async () => {
    setErr('');
    setBusy(true);
    try {
      await api(`/api/exams/${id}/generate`, { method: 'POST', body: { count: genCount } });
      setTab('questions');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  const makeFlashcards = async () => {
    setErr('');
    setBusy(true);
    try {
      await api(`/api/exams/${id}/flashcards`, { method: 'POST', body: { count: cardCount } });
      setTab('flashcards');
      await load();
    } catch (e) {
      setErr(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (err && !data) {
    return (
      <main className="container">
        <Link to="/">← {t('back')}</Link>
        <div className="error" style={{ marginTop: '1rem' }}>{err}</div>
      </main>
    );
  }
  if (!data) {
    return <main className="container"><div className="empty">{t('generating')}…</div></main>;
  }

  const { exam, materials = [], teacher_profile, questions = [], flashcards = [] } = data;
  const studyMats = materials.filter((m) => m.kind === 'study');
  const sampleMats = materials.filter((m) => m.kind === 'sample');

  return (
    <main className="container">
      <div className="row between" style={{ marginBottom: '0.5rem' }}>
        <div>
          <Link to="/" className="muted small">← {t('back')}</Link>
          <h1 style={{ margin: '0.3rem 0 0' }}>{exam.title}</h1>
          {exam.subject && <div className="muted">{exam.subject}</div>}
        </div>
        {exam.detected_language && (
          <span className="badge lang">🌐 {exam.detected_language}</span>
        )}
      </div>

      <div className="tabs" style={{ marginTop: '1rem' }}>
        {TABS.map((tt) => (
          <button key={tt} className={tab === tt ? 'active' : ''} onClick={() => setTab(tt)}>
            {tt === 'overview' && '📋 '}
            {tt === 'questions' && '🎯 '}
            {tt === 'study' && '📖 '}
            {tt === 'flashcards' && '🃏 '}
            {t(tt)}
          </button>
        ))}
      </div>

      {err && <div className="error">{err}</div>}

      {tab === 'overview' && (
        <Overview
          studyMats={studyMats}
          sampleMats={sampleMats}
          teacherProfile={teacher_profile}
          busy={busy}
          t={t}
          onUpload={upload}
          onPasteKindChange={setPasteKind}
          pasteKind={pasteKind}
          pasteText={pasteText}
          setPasteText={setPasteText}
          onSubmitPaste={submitPaste}
          onAnalyze={analyze}
          fileInputs={fileInputs}
          genCount={genCount}
          setGenCount={setGenCount}
          onGenerate={generate}
          cardCount={cardCount}
          setCardCount={setCardCount}
          onMakeFlashcards={makeFlashcards}
          questions={questions}
          flashcards={flashcards}
        />
      )}

      {tab === 'questions' && (
        <QuestionsView questions={questions} t={t} onGenerate={generate} busy={busy} genCount={genCount} setGenCount={setGenCount} />
      )}

      {tab === 'study' && <StudyView questions={questions} t={t} />}

      {tab === 'flashcards' && <FlashcardDeck cards={flashcards} t={t} />}
    </main>
  );
}

function Overview({
  studyMats, sampleMats, teacherProfile, busy, t, onUpload, onPasteKindChange,
  pasteKind, pasteText, setPasteText, onSubmitPaste, onAnalyze, fileInputs,
  genCount, setGenCount, onGenerate, cardCount, setCardCount, onMakeFlashcards,
  questions, flashcards,
}) {
  return (
    <div className="grid">
      <div className="grid cols-2">
        <UploadCard
          title={t('materials')}
          kind="study"
          items={studyMats}
          t={t}
          busy={busy}
          onUpload={onUpload}
          fileInputs={fileInputs}
          onPasteKindChange={onPasteKindChange}
          pasteKind={pasteKind}
          pasteText={pasteText}
          setPasteText={setPasteText}
          onSubmitPaste={onSubmitPaste}
          emptyLabel={t('noMaterials')}
        />
        <UploadCard
          title={t('samples')}
          kind="sample"
          items={sampleMats}
          t={t}
          busy={busy}
          onUpload={onUpload}
          fileInputs={fileInputs}
          onPasteKindChange={onPasteKindChange}
          pasteKind={pasteKind}
          pasteText={pasteText}
          setPasteText={setPasteText}
          onSubmitPaste={onSubmitPaste}
          emptyLabel={t('noSamples')}
        />
      </div>

      <div className="card">
        <div className="row between">
          <h3 style={{ margin: 0 }}>⚡ Pipeline</h3>
          <span className="muted small">
            {studyMats.length} {t('files')} · {sampleMats.length} samples
          </span>
        </div>
        <hr className="hr" />
        <div className="row">
          <button onClick={onAnalyze} disabled={busy || !studyMats.length} className="primary">
            {busy && <span className="spinner" />} {t('analyze')}
          </button>
          <div className="row" style={{ gap: '0.4rem' }}>
            <label style={{ margin: 0 }}>{t('count')}</label>
            <input
              type="number" min={5} max={50}
              value={genCount}
              onChange={(e) => setGenCount(Number(e.target.value))}
              style={{ width: '80px' }}
            />
            <button onClick={onGenerate} disabled={busy || !studyMats.length} className="primary">
              {t('generate')}
            </button>
          </div>
          <div className="row" style={{ gap: '0.4rem' }}>
            <label style={{ margin: 0 }}>🃏 {t('count')}</label>
            <input
              type="number" min={5} max={80}
              value={cardCount}
              onChange={(e) => setCardCount(Number(e.target.value))}
              style={{ width: '80px' }}
            />
            <button onClick={onMakeFlashcards} disabled={busy || !studyMats.length}>
              {t('generateFlashcards')}
            </button>
          </div>
        </div>
        <div className="row" style={{ marginTop: '0.75rem', gap: '1rem' }}>
          <span className="muted small">🎯 {questions.length} questions</span>
          <span className="muted small">🃏 {flashcards.length} flashcards</span>
        </div>
      </div>

      {teacherProfile && (
        <div className="card">
          <h3 style={{ marginTop: 0 }}>👨‍🏫 {t('teacherProfile')}</h3>
          <p style={{ lineHeight: 1.5 }}>{teacherProfile.style_summary}</p>
          <div className="row" style={{ gap: '0.5rem', flexWrap: 'wrap' }}>
            <span className="tag">📊 {t('confidence')}: {teacherProfile.difficulty}</span>
            <span className="tag">🗣️ {teacherProfile.formality}</span>
            {(() => {
              try {
                const types = JSON.parse(teacherProfile.question_types_json || '[]');
                return types.map((q, i) => (
                  <span key={i} className="tag">
                    {q.type} · {Math.round((q.share || 0) * 100)}%
                  </span>
                ));
              } catch { return null; }
            })()}
          </div>
          {(() => {
            try {
              const p = JSON.parse(teacherProfile.patterns_json || '{}');
              if (p.patterns?.length) {
                return (
                  <div style={{ marginTop: '0.75rem' }}>
                    <div className="muted small" style={{ marginBottom: '0.3rem' }}>{t('topics')}:</div>
                    <div className="row" style={{ gap: '0.4rem', flexWrap: 'wrap' }}>
                      {p.patterns.map((s, i) => <span key={i} className="tag">{s}</span>)}
                    </div>
                  </div>
                );
              }
            } catch { /* ignore */ }
            return null;
          })()}
        </div>
      )}
    </div>
  );
}

function UploadCard({ title, kind, items, t, busy, onUpload, fileInputs, onPasteKindChange, pasteKind, pasteText, setPasteText, onSubmitPaste, emptyLabel }) {
  return (
    <div className="card">
      <h3 style={{ marginTop: 0 }}>{title}</h3>
      <input
        ref={(el) => (fileInputs.current[kind] = el)}
        type="file"
        accept=".pdf,.docx,.txt,.md,.png,.jpg,.jpeg,.webp"
        style={{ display: 'none' }}
        onChange={(e) => onUpload(kind, e.target.files?.[0])}
      />
      <div className="row">
        <button onClick={() => fileInputs.current[kind]?.click()} disabled={busy}>
          📤 {t('uploadFile')}
        </button>
      </div>
      <hr className="hr" />
      <div className="muted small" style={{ marginBottom: '0.3rem' }}>{t('pasteText')}</div>
      <textarea
        value={pasteKind === kind ? pasteText : ''}
        onChange={(e) => {
          onPasteKindChange(kind);
          setPasteText(e.target.value);
        }}
        placeholder="…"
      />
      <div className="row" style={{ marginTop: '0.5rem' }}>
        <button onClick={onSubmitPaste} disabled={busy || !pasteText.trim() || pasteKind !== kind}>
          {t('paste')}
        </button>
      </div>
      <hr className="hr" />
      {items.length === 0 ? (
        <div className="muted small">{emptyLabel}</div>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: '0.3rem' }}>
          {items.map((m) => (
            <li key={m.id} className="row" style={{ justifyContent: 'space-between' }}>
              <span className="small">📄 {m.filename}</span>
              <span className="muted small">
                {m.detected_language && <span className="badge lang" style={{ marginRight: 6 }}>{m.detected_language}</span>}
                {m.raw_text?.length || 0} chars
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function QuestionsView({ questions, t, onGenerate, busy, genCount, setGenCount }) {
  if (!questions.length) {
    return (
      <div className="empty">
        <p>{t('noQuestions')}</p>
        <div className="row" style={{ justifyContent: 'center', marginTop: '0.75rem' }}>
          <input
            type="number" min={5} max={50}
            value={genCount}
            onChange={(e) => setGenCount(Number(e.target.value))}
            style={{ width: '80px' }}
          />
          <button className="primary" onClick={onGenerate} disabled={busy}>
            {busy && <span className="spinner" />} {t('generate')}
          </button>
        </div>
      </div>
    );
  }
  return (
    <div className="grid">
      {questions.map((q, i) => (
        <QuestionCard key={q.id} q={q} index={i + 1} t={t} showAnswer={false} />
      ))}
    </div>
  );
}

function StudyView({ questions, t }) {
  const [reveal, setReveal] = useState({});
  if (!questions.length) {
    return <div className="empty">{t('noQuestions')}</div>;
  }
  return (
    <div className="grid">
      {questions.map((q, i) => (
        <QuestionCard
          key={q.id}
          q={q}
          index={i + 1}
          t={t}
          showAnswer={!!reveal[q.id]}
          onToggle={() => setReveal((r) => ({ ...r, [q.id]: !r[q.id] }))}
        />
      ))}
    </div>
  );
}
