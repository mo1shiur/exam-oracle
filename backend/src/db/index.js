import Database from 'better-sqlite3';
import fs from 'node:fs';
import path from 'node:path';
import { config } from '../config.js';

// Ensure data dir exists
fs.mkdirSync(config.paths.dataDir, { recursive: true });

const dbPath = path.join(config.paths.dataDir, 'exam-oracle.sqlite');
export const db = new Database(dbPath);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

const schema = `
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  display_name TEXT,
  preferred_language TEXT DEFAULT 'auto',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  detected_language TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS materials (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('study','sample')),
  filename TEXT NOT NULL,
  mime_type TEXT,
  raw_text TEXT,
  detected_language TEXT,
  topics_json TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS teacher_profiles (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER UNIQUE NOT NULL,
  style_summary TEXT,
  question_types_json TEXT,
  difficulty TEXT,
  formality TEXT,
  patterns_json TEXT,
  sample_count INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS generated_questions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  question_text TEXT NOT NULL,
  question_type TEXT,
  topic TEXT,
  confidence TEXT CHECK (confidence IN ('high','medium','low')),
  reasoning TEXT,
  answer_text TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS flashcards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL,
  front TEXT NOT NULL,
  back TEXT NOT NULL,
  topic TEXT,
  created_at TEXT DEFAULT (datetime('now')),
  FOREIGN KEY (exam_id) REFERENCES exams(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_exams_user ON exams(user_id);
CREATE INDEX IF NOT EXISTS idx_materials_exam ON materials(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam ON generated_questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_flashcards_exam ON flashcards(exam_id);
`;

db.exec(schema);

export const findUserByEmail = (email) =>
  db.prepare('SELECT * FROM users WHERE email = ?').get(email);

export const findUserById = (id) =>
  db.prepare('SELECT id, email, display_name, preferred_language, created_at FROM users WHERE id = ?').get(id);

export const createUser = (email, passwordHash, displayName) =>
  db
    .prepare('INSERT INTO users (email, password_hash, display_name) VALUES (?, ?, ?)')
    .run(email, passwordHash, displayName || null);

export const updateUserLanguage = (id, lang) =>
  db.prepare('UPDATE users SET preferred_language = ? WHERE id = ?').run(lang, id);

export const listExams = (userId) =>
  db
    .prepare('SELECT * FROM exams WHERE user_id = ? ORDER BY created_at DESC')
    .all(userId);

export const getExam = (id, userId) =>
  db
    .prepare('SELECT * FROM exams WHERE id = ? AND user_id = ?')
    .get(id, userId);

export const createExam = (userId, { title, subject, description }) =>
  db
    .prepare('INSERT INTO exams (user_id, title, subject, description) VALUES (?, ?, ?, ?)')
    .run(userId, title, subject || null, description || null);

export const updateExamLanguage = (id, lang) =>
  db.prepare('UPDATE exams SET detected_language = ? WHERE id = ?').run(lang, id);

export const deleteExam = (id, userId) =>
  db.prepare('DELETE FROM exams WHERE id = ? AND user_id = ?').run(id, userId);

export const insertMaterial = (record) =>
  db
    .prepare(`INSERT INTO materials
      (exam_id, kind, filename, mime_type, raw_text, detected_language, topics_json)
      VALUES (@exam_id, @kind, @filename, @mime_type, @raw_text, @detected_language, @topics_json)`)
    .run(record);

export const listMaterials = (examId) =>
  db
    .prepare('SELECT * FROM materials WHERE exam_id = ? ORDER BY created_at DESC')
    .all(examId);

export const getMaterial = (id) =>
  db.prepare('SELECT * FROM materials WHERE id = ?').get(id);

export const upsertTeacherProfile = (record) =>
  db
    .prepare(`INSERT INTO teacher_profiles
      (exam_id, style_summary, question_types_json, difficulty, formality, patterns_json, sample_count, updated_at)
      VALUES (@exam_id, @style_summary, @question_types_json, @difficulty, @formality, @patterns_json, @sample_count, datetime('now'))
      ON CONFLICT(exam_id) DO UPDATE SET
        style_summary = excluded.style_summary,
        question_types_json = excluded.question_types_json,
        difficulty = excluded.difficulty,
        formality = excluded.formality,
        patterns_json = excluded.patterns_json,
        sample_count = excluded.sample_count,
        updated_at = datetime('now')`)
    .run(record);

export const getTeacherProfile = (examId) =>
  db.prepare('SELECT * FROM teacher_profiles WHERE exam_id = ?').get(examId);

export const insertQuestions = (rows) => {
  const stmt = db.prepare(`INSERT INTO generated_questions
    (exam_id, question_text, question_type, topic, confidence, reasoning, answer_text)
    VALUES (@exam_id, @question_text, @question_type, @topic, @confidence, @reasoning, @answer_text)`);
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  tx(rows);
};

export const clearQuestions = (examId) =>
  db.prepare('DELETE FROM generated_questions WHERE exam_id = ?').run(examId);

export const listQuestions = (examId) =>
  db
    .prepare('SELECT * FROM generated_questions WHERE exam_id = ? ORDER BY id ASC')
    .all(examId);

export const getQuestion = (id) =>
  db.prepare('SELECT * FROM generated_questions WHERE id = ?').get(id);

export const insertFlashcards = (rows) => {
  const stmt = db.prepare(`INSERT INTO flashcards
    (exam_id, front, back, topic) VALUES (@exam_id, @front, @back, @topic)`);
  const tx = db.transaction((items) => {
    for (const item of items) stmt.run(item);
  });
  tx(rows);
};

export const clearFlashcards = (examId) =>
  db.prepare('DELETE FROM flashcards WHERE exam_id = ?').run(examId);

export const listFlashcards = (examId) =>
  db.prepare('SELECT * FROM flashcards WHERE exam_id = ? ORDER BY id ASC').all(examId);
