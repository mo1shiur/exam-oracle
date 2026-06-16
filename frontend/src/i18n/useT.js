import { useEffect, useState, useCallback } from 'react';
import { STRINGS } from './strings.js';

const STORAGE_KEY = 'eo.lang';
const SUPPORTED = ['en', 'bn', 'zh'];

function detectInitial() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored && SUPPORTED.includes(stored)) return stored;
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('bn')) return 'bn';
  if (nav.startsWith('zh')) return 'zh';
  return 'en';
}

let listeners = new Set();
let currentLang = typeof window !== 'undefined' ? detectInitial() : 'en';

export function getLang() {
  return currentLang;
}

export function setLang(lang) {
  if (!SUPPORTED.includes(lang)) return;
  currentLang = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* ignore */
  }
  listeners.forEach((fn) => fn(lang));
}

export function useT() {
  const [lang, setLangState] = useState(currentLang);
  useEffect(() => {
    const fn = (l) => setLangState(l);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);
  const t = useCallback(
    (key) => {
      const dict = STRINGS[lang] || STRINGS.en;
      return dict[key] || STRINGS.en[key] || key;
    },
    [lang]
  );
  return { t, lang, setLang, languages: SUPPORTED };
}
