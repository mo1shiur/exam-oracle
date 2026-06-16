import { Router } from 'express';
import multer from 'multer';
import path from 'node:path';
import fs from 'node:fs/promises';
import { z } from 'zod';
import { config } from '../config.js';
import { requireAuth } from '../middleware/auth.js';
import {
  listExams,
  getExam,
  createExam,
  updateExamLanguage,
  deleteExam,
  insertMaterial,
  listMaterials,
  getMaterial,
  upsertTeacherProfile,
  getTeacherProfile,
  insertQuestions,
  clearQuestions,
  listQuestions,
  insertFlashcards,
  clearFlashcards,
  listFlashcards,
  updateUserLanguage,
} from '../db/index.js';
import { extractText, detectLanguage } from '../utils/parseFile.js';
import {
  extractTopics,
  profileTeacher,
  generatePredictedQuestions,
  generateFlashcards,
} from '../services/llm.js';

const router = Router();
router.use(requireAuth);

// Multer config — store on disk under uploads/<userId>/<examId>/
const storage = multer.diskStorage({
  destination: async (req, file, cb) => {
    const dir = path.join(config.paths.uploadDir, String(req.user.id), String(req.body.exam_id || 'tmp'));
    await fs.mkdir(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const safe = file.originalname.replace(/[^A-Za-z0-9._-]/g, '_');
    cb(null, `${Date.now()}-${safe}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: config.maxUploadMb * 1024 * 1024 },
});

// ---------- Exams CRUD ----------
const examSchema = z.object({
  title: z.string().min(1).max(200),
  subject: z.string().max(200).optional(),
  description: z.string().max(2000).optional(),
});

router.get('/', (req, res) => {
  res.json({ exams: listExams(req.user.id) });
});

router.post('/', (req, res) => {
  const parsed = examSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid input' });
  const info = createExam(req.user.id, parsed.data);
  const exam = getExam(info.lastInsertRowid, req.user.id);
  res.json({ exam });
});

router.get('/:id', (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  res.json({
    exam,
    materials: listMaterials(exam.id),
    teacher_profile: getTeacherProfile(exam.id) || null,
    questions: listQuestions(exam.id),
    flashcards: listFlashcards(exam.id),
  });
});

router.delete('/:id', (req, res) => {
  const ok = deleteExam(Number(req.params.id), req.user.id);
  if (!ok.changes) return res.status(404).json({ error: 'Not found' });
  res.json({ ok: true });
});

// ---------- Upload material or sample ----------
router.post('/:id/materials', upload.single('file'), async (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Exam not found' });

  const kind = req.body.kind === 'sample' ? 'sample' : 'study';
  let rawText = '';
  let detected = null;
  let filename = req.body.filename || 'pasted-text.txt';
  let mimeType = 'text/plain';

  if (req.file) {
    filename = req.file.originalname;
    mimeType = req.file.mimetype;
    const extracted = await extractText(req.file.path, mimeType, filename);
    rawText = extracted.text;
    detected = extracted.language;
  } else if (req.body.text) {
    rawText = String(req.body.text);
    detected = detectLanguage(rawText);
  } else {
    return res.status(400).json({ error: 'Provide a file or a `text` field' });
  }

  if (!rawText.trim()) {
    return res.status(400).json({ error: 'No text could be extracted from the input' });
  }

  const materialId = insertMaterial({
    exam_id: exam.id,
    kind,
    filename,
    mime_type: mimeType,
    raw_text: rawText,
    detected_language: detected,
    topics_json: null,
  }).lastInsertRowid;

  // If this is study material, run a quick topic extract and persist on the material.
  // We do it eagerly so the user sees progress per-upload.
  if (kind === 'study' && rawText.length > 200) {
    try {
      const topics = await extractTopics({
        text: rawText,
        language: detected,
        subjectHint: exam.subject,
      });
      // Re-update the material with topics
      const db = (await import('../db/index.js')).db;
      db.prepare('UPDATE materials SET topics_json = ? WHERE id = ?').run(
        JSON.stringify(topics),
        materialId
      );
    } catch (err) {
      console.warn('Topic extract failed (non-fatal):', err.message);
    }
  }

  res.json({ material: getMaterial(materialId) });
});

// ---------- List materials ----------
router.get('/:id/materials', (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  res.json({ materials: listMaterials(exam.id) });
});

// ---------- Analyze & generate ----------
router.post('/:id/analyze', async (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  const materials = listMaterials(exam.id);
  const studyMats = materials.filter((m) => m.kind === 'study');
  const sampleMats = materials.filter((m) => m.kind === 'sample');

  if (!studyMats.length) {
    return res.status(400).json({ error: 'Upload at least one study material first.' });
  }

  // Aggregate text, cap total to keep prompts reasonable
  const aggregate = (items, cap = 24000) =>
    items
      .map((m) => m.raw_text)
      .join('\n\n---\n\n')
      .slice(0, cap);

  const studyText = aggregate(studyMats);
  const sampleText = aggregate(sampleMats, 12000);
  const language =
    exam.detected_language ||
    detectLanguage(studyText + '\n' + sampleText);

  if (language !== exam.detected_language) {
    updateExamLanguage(exam.id, language);
  }

  // Stage 1 — topics from study material
  const topics = await extractTopics({
    text: studyText,
    language,
    subjectHint: exam.subject,
  });

  // Stage 2 — teacher style (only if samples exist)
  let profile = {
    style_summary: 'No teacher samples provided; questions will use a neutral academic style.',
    question_types: [{ type: 'short', share: 0.4 }, { type: 'long', share: 0.4 }, { type: 'mcq', share: 0.2 }],
    difficulty: 'medium',
    formality: 'formal',
    patterns: [],
    favorite_phrases: [],
  };
  if (sampleMats.length) {
    profile = await profileTeacher({
      samplesText: sampleText,
      subjectHint: exam.subject,
      language,
    });
  }

  upsertTeacherProfile({
    exam_id: exam.id,
    style_summary: profile.style_summary,
    question_types_json: JSON.stringify(profile.question_types || []),
    difficulty: profile.difficulty,
    formality: profile.formality,
    patterns_json: JSON.stringify({
      patterns: profile.patterns || [],
      favorite_phrases: profile.favorite_phrases || [],
    }),
    sample_count: sampleMats.length,
  });

  res.json({
    exam: getExam(exam.id, req.user.id),
    topics,
    teacher_profile: profile,
  });
});

router.post('/:id/generate', async (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  const count = Math.min(Math.max(Number(req.body.count) || 15, 5), 50);
  const materials = listMaterials(exam.id);
  const studyMats = materials.filter((m) => m.kind === 'study');
  const sampleMats = materials.filter((m) => m.kind === 'sample');
  if (!studyMats.length) {
    return res.status(400).json({ error: 'Upload at least one study material first.' });
  }

  const studyText = studyMats.map((m) => m.raw_text).join('\n\n---\n\n').slice(0, 24000);
  const sampleText = sampleMats.map((m) => m.raw_text).join('\n\n---\n\n').slice(0, 12000);
  const language = exam.detected_language || detectLanguage(studyText + '\n' + sampleText);

  const topics = await extractTopics({ text: studyText, language, subjectHint: exam.subject });

  let profileRecord = getTeacherProfile(exam.id);
  let profile;
  if (profileRecord) {
    profile = {
      style_summary: profileRecord.style_summary,
      question_types: JSON.parse(profileRecord.question_types_json || '[]'),
      difficulty: profileRecord.difficulty,
      formality: profileRecord.formality,
      patterns: JSON.parse(profileRecord.patterns_json || '{}').patterns || [],
      favorite_phrases: JSON.parse(profileRecord.patterns_json || '{}').favorite_phrases || [],
    };
  } else if (sampleMats.length) {
    profile = await profileTeacher({ samplesText: sampleText, subjectHint: exam.subject, language });
  } else {
    profile = {
      style_summary: 'Neutral academic style.',
      question_types: [{ type: 'short', share: 1 }],
      difficulty: 'medium',
      formality: 'formal',
      patterns: [],
      favorite_phrases: [],
    };
  }

  const generated = await generatePredictedQuestions({
    topics,
    teacherProfile: profile,
    language,
    count,
    subjectHint: exam.subject,
  });
  const qs = generated.questions || [];
  if (!qs.length) return res.status(502).json({ error: 'LLM returned no questions' });

  clearQuestions(exam.id);
  insertQuestions(
    qs.map((q) => ({
      exam_id: exam.id,
      question_text: q.question_text,
      question_type: q.question_type || 'other',
      topic: q.topic || null,
      confidence: ['high', 'medium', 'low'].includes(q.confidence) ? q.confidence : 'medium',
      reasoning: q.reasoning || null,
      answer_text: q.answer_text || null,
    }))
  );

  res.json({ questions: listQuestions(exam.id) });
});

router.post('/:id/flashcards', async (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  const count = Math.min(Math.max(Number(req.body.count) || 20, 5), 80);
  const studyMats = listMaterials(exam.id).filter((m) => m.kind === 'study');
  if (!studyMats.length) {
    return res.status(400).json({ error: 'Upload at least one study material first.' });
  }
  const text = studyMats.map((m) => m.raw_text).join('\n\n---\n\n').slice(0, 24000);
  const language = exam.detected_language || detectLanguage(text);

  const result = await generateFlashcards({ text, language, count, subjectHint: exam.subject });
  const cards = result.flashcards || [];
  if (!cards.length) return res.status(502).json({ error: 'LLM returned no flashcards' });

  clearFlashcards(exam.id);
  insertFlashcards(
    cards.map((c) => ({
      exam_id: exam.id,
      front: c.front,
      back: c.back,
      topic: c.topic || null,
    }))
  );

  res.json({ flashcards: listFlashcards(exam.id) });
});

router.get('/:id/questions', (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  res.json({ questions: listQuestions(exam.id) });
});

router.get('/:id/flashcards', (req, res) => {
  const exam = getExam(Number(req.params.id), req.user.id);
  if (!exam) return res.status(404).json({ error: 'Not found' });
  res.json({ flashcards: listFlashcards(exam.id) });
});

// ---------- User preferences ----------
router.put('/prefs/language', (req, res) => {
  const lang = String(req.body.language || 'auto');
  if (!['auto', 'en', 'bn', 'zh'].includes(lang)) {
    return res.status(400).json({ error: 'Invalid language' });
  }
  updateUserLanguage(req.user.id, lang);
  res.json({ ok: true });
});

export default router;
