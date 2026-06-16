import { useState, useEffect } from 'react';

export default function FlashcardDeck({ cards, t }) {
  const [i, setI] = useState(0);
  const [flipped, setFlipped] = useState(false);

  useEffect(() => {
    setFlipped(false);
  }, [i]);

  if (!cards.length) {
    return <div className="empty">{t('noFlashcards')}</div>;
  }

  const card = cards[i];

  return (
    <div className="card">
      <div className="row between" style={{ marginBottom: '0.75rem' }}>
        <span className="muted small">
          {i + 1} / {cards.length}
        </span>
        {card.topic && <span className="tag">📚 {card.topic}</span>}
      </div>
      <div
        className={`flashcard ${flipped ? 'flipped' : ''}`}
        onClick={() => setFlipped((f) => !f)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === ' ' || e.key === 'Enter') setFlipped((f) => !f);
        }}
      >
        <div className="flashcard-inner">
          <div className="flashcard-face front">
            <div>
              <div className="muted small" style={{ marginBottom: '0.5rem' }}>Front</div>
              {card.front}
            </div>
          </div>
          <div className="flashcard-face back">
            <div>
              <div className="muted small" style={{ marginBottom: '0.5rem' }}>Back</div>
              {card.back}
            </div>
          </div>
        </div>
      </div>
      <div className="row" style={{ marginTop: '1rem', justifyContent: 'space-between' }}>
        <button
          onClick={() => setI((v) => Math.max(0, v - 1))}
          disabled={i === 0}
        >
          ← {t('prev')}
        </button>
        <button onClick={() => setFlipped((f) => !f)}>
          🔄 {t('flip')}
        </button>
        <button
          onClick={() => setI((v) => Math.min(cards.length - 1, v + 1))}
          disabled={i === cards.length - 1}
        >
          {t('next')} →
        </button>
      </div>
      <div className="muted small" style={{ textAlign: 'center', marginTop: '0.5rem' }}>
        Click card to flip · Space to toggle
      </div>
    </div>
  );
}
