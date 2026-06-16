import fs from 'node:fs/promises';
import path from 'node:path';
import mammoth from 'mammoth';

// pdf-parse is CJS; we import lazily to avoid the test-files self-execution bug
async function extractPdf(buffer) {
  const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
  const result = await pdfParse(buffer);
  return result.text || '';
}

async function extractDocx(buffer) {
  const { value } = await mammoth.extractRawText({ buffer });
  return value || '';
}

async function extractImage(filePath) {
  // Lazy-load tesseract worker so we only pay the cost when needed
  const { createWorker } = await import('tesseract.js');
  // Supports English by default; Bengali + Chinese need language packs.
  // We attempt multilingual, but gracefully fall back to English-only.
  const tryLangs = ['eng+ben+chi_sim', 'eng+chi_sim', 'eng+ben', 'eng'];
  let lastError = null;
  for (const lang of tryLangs) {
    try {
      const worker = await createWorker(lang);
      const { data } = await worker.recognize(filePath);
      await worker.terminate();
      return data.text || '';
    } catch (err) {
      lastError = err;
    }
  }
  throw new Error(`OCR failed: ${lastError?.message || 'unknown error'}`);
}

/**
 * Lightweight language detector. We do *not* pull a heavy model — instead
 * we count script characters + common stopwords to pick a best guess among
 * English / Bengali / Chinese. Good enough to route LLM prompts and tag
 * exams; the LLM itself handles the heavy lifting.
 */
export function detectLanguage(text) {
  if (!text || !text.trim()) return 'en';
  const sample = text.slice(0, 8000);

  const cjkRegex = /[\u4e00-\u9fff]/g;
  const bengaliRegex = /[\u0980-\u09ff]/g;
  const latinRegex = /[A-Za-z]/g;

  const cjk = (sample.match(cjkRegex) || []).length;
  const bengali = (sample.match(bengaliRegex) || []).length;
  const latin = (sample.match(latinRegex) || []).length;

  const langScore = [
    { code: 'zh', count: cjk },
    { code: 'bn', count: bengali },
    { code: 'en', count: latin },
  ].sort((a, b) => b.count - a.count);

  // If Latin wins but we also have a meaningful Bengali/CJK count, tag as mixed.
  if (langScore[0].code === 'en' && langScore[1].count > 0.3 * langScore[0].count) {
    return 'mixed';
  }
  return langScore[0].code;
}

export const languageName = (code) => {
  switch (code) {
    case 'zh':
      return 'Chinese';
    case 'bn':
      return 'Bengali';
    case 'mixed':
      return 'Mixed';
    default:
      return 'English';
  }
};

/**
 * Extract raw text from an uploaded file. Returns { text, mimeType, language }.
 */
export async function extractText(filePath, mimeType, originalName) {
  const ext = path.extname(originalName || '').toLowerCase();

  let text = '';
  if (mimeType === 'application/pdf' || ext === '.pdf') {
    const buffer = await fs.readFile(filePath);
    text = await extractPdf(buffer);
  } else if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    ext === '.docx'
  ) {
    const buffer = await fs.readFile(filePath);
    text = await extractDocx(buffer);
  } else if (mimeType === 'text/plain' || ext === '.txt' || ext === '.md') {
    text = await fs.readFile(filePath, 'utf8');
  } else if (mimeType.startsWith('image/') || ['.png', '.jpg', '.jpeg', '.webp'].includes(ext)) {
    text = await extractImage(filePath);
  } else {
    throw new Error(`Unsupported file type: ${mimeType || ext || 'unknown'}`);
  }

  const cleaned = text.replace(/\u0000/g, '').trim();
  const language = detectLanguage(cleaned);
  return { text: cleaned, mimeType, language };
}
