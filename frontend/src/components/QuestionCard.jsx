import { useState } from 'react';

export default function QuestionCard({ q, index, t, showAnswer = false, onToggle }) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(q.question_text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="question-card">
      <div className="qhead">
        <div className="qmeta">
          <span className="badge">Q{index}</span>
          {q.question_type && <span className="tag">{q.question_type}</span>}
          {q.topic && <span className="tag">📚 {q.topic}</span>}
          {q.confidence && (
            <span className={`badge ${q.confidence}`}>{t('confidence')}: {q.confidence}</span>
          )}
        </div>
        <button className="small" onClick={copy} style={{ padding: '0.3rem 0.6rem' }}>
          {copied ? t('copied') : `📋 ${t('copy')}`}
        </button>
      </div>
      <div className="qbody">{q.question_text}</div>
      {q.reasoning && <div className="qreason">💡 {t('why')}: {q.reasoning}</div>}
      {q.answer_text && (
        <>
          {onToggle && (
            <button onClick={onToggle} style={{ alignSelf: 'flex-start' }}>
              {showAnswer ? `🙈 ${t('hideAnswer')}` : `💡 ${t('showAnswer')}`}
            </button>
          )}
          {(showAnswer || !onToggle) && (
            <div className="answer">
              <div className="muted small" style={{ marginBottom: '0.3rem', fontWeight: 600 }}>
                ✅ {t('answer')}
              </div>
              {q.answer_text}
            </div>
          )}
        </>
      )}
    </div>
  );
}
