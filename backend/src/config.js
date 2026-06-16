import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, '..');

export const config = {
  port: Number(process.env.PORT || 4000),
  nodeEnv: process.env.NODE_ENV || 'development',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  corsOrigin: (process.env.CORS_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim()),
  llm: {
    provider: process.env.LLM_PROVIDER || 'groq',
    apiKey: process.env.LLM_API_KEY || '',
    model: process.env.LLM_MODEL || 'llama-3.1-70b-versatile',
    baseUrl: process.env.LLM_BASE_URL || '',
  },
  paths: {
    dataDir: path.resolve(backendRoot, process.env.DATA_DIR || './data'),
    uploadDir: path.resolve(backendRoot, process.env.UPLOAD_DIR || './uploads'),
  },
  maxUploadMb: Number(process.env.MAX_UPLOAD_MB || 20),
};

export const isLlmConfigured = () => Boolean(config.llm.apiKey);
