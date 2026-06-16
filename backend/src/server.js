import express from 'express';
import cors from 'cors';
import { config, isLlmConfigured } from './config.js';
import authRoutes from './routes/auth.js';
import examRoutes from './routes/exams.js';

const app = express();

app.use(cors({ origin: config.corsOrigin, credentials: true }));
app.use(express.json({ limit: '5mb' }));

app.get('/api/health', (req, res) => {
  res.json({
    ok: true,
    llm_configured: isLlmConfigured(),
    llm_provider: config.llm.provider,
    llm_model: config.llm.model,
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/exams', examRoutes);

// Error handler
app.use((err, req, res, _next) => {
  console.error('[error]', err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Internal error' });
});

app.listen(config.port, () => {
  console.log(`\n🧠 Exam Oracle backend listening on http://localhost:${config.port}`);
  console.log(`   LLM provider: ${config.llm.provider} (${isLlmConfigured() ? 'configured ✓' : 'NOT configured — set LLM_API_KEY'})`);
  console.log(`   CORS origin:  ${config.corsOrigin.join(', ')}`);
});
