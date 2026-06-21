# 🧠 Exam Oracle

> Predict what your teacher will ask — by studying both your materials *and* their question style.

[![CI](https://github.com/YOUR_USERNAME/exam-oracle/actions/workflows/ci.yml/badge.svg)](https://github.com/YOUR_USERNAME/exam-oracle/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](./LICENSE)
![Node](https://img.shields.io/badge/node-%E2%89%A518.17-brightgreen)
![Languages](https://img.shields.io/badge/i18n-EN%20%7C%20BN%20%7C%20ZH-blue)

Upload your study notes (PDFs, images, Word, text) and any sample questions / suggestions from your teacher. Exam Oracle profiles the teacher's style, extracts the topics that actually matter, and generates realistic predicted questions in the same language — English, Bengali, or Chinese (auto-detected).

Includes a **Study Mode** (questions + answers) and auto-generated **Flashcards** so you can actually learn, not just guess.

---

## ✨ Features

- 📤 **Multi-format upload** — PDF, DOCX, images (OCR), plain text
- 🧠 **Teacher style profiling** — picks up the teacher's patterns, difficulty, formality, favorite phrasing
- 🎯 **Predicted questions** — typed (MCQ/short/long/true-false/fill/case), ranked by confidence, with reasoning
- 📖 **Study mode** — flip a question, reveal the answer
- 🃏 **Auto flashcards** — concise front/back cards, click to flip
- 🌐 **Multilingual** — English / বাংলা / 中文 with auto-detection per exam
- 🔐 **Per-user accounts** — JWT auth, history saved in SQLite
- 🚀 **Local-first** — runs entirely on your machine; ready to publish later

---

## 🏃 Run it locally (5 minutes)

> 🆘 **Stuck?** See [RUNBOOK.md](./RUNBOOK.md) for a step-by-step with troubleshooting.

### Prerequisites
- **Node.js 18.17+** (20 LTS recommended) — https://nodejs.org
- An LLM API key (see below)

### 1. Get an LLM API key (free options)

Pick whichever is easiest for you:

| Provider | Free tier | Get a key |
|---|---|---|
| **Groq** (recommended for free) | Yes, very fast | https://console.groq.com/keys |
| **OpenAI** | Trial credits | https://platform.openai.com/api-keys |
| **Anthropic Claude** | Trial credits | https://console.anthropic.com |

Then pick a model name — common ones:
- Groq: `llama-3.1-70b-versatile`, `llama-3.3-70b-versatile`
- OpenAI: `gpt-4o-mini`, `gpt-4o`
- Anthropic: `claude-3-5-sonnet-latest`

### 2. Start the backend

```bash
cd backend
cp .env.example .env
# open .env and paste your LLM_API_KEY (and tweak LLM_MODEL if you want)
npm install
npm run dev
```

You should see:
```
🧠 Exam Oracle backend listening on http://localhost:4000
   LLM provider: groq (configured ✓)
```

Test it: `curl http://localhost:4000/api/health` → `{"ok":true,"llm_configured":true,...}`

### 3. Start the frontend

In a new terminal:
```bash
cd frontend
cp .env.example .env   # optional, only if backend is on a different host
npm install
npm run dev
```

Open **http://localhost:5173** — sign up, create an exam, upload materials, hit *Generate*.

---

## 🐳 Or run with Docker (no Node needed)

```bash
# from the project root
export LLM_API_KEY=sk-...
export LLM_PROVIDER=groq
export LLM_MODEL=llama-3.1-70b-versatile
docker compose -f deploy/docker-compose.yml up --build
```

Then open **http://localhost:8080**.

---

## 🚀 Publishing later (when you're ready)

The project is structured so you can host it cheaply on free tiers:

### Option A — Two-service deploy (recommended)

- **Backend** → [Railway](https://railway.app) or [Render](https://render.com) (free tier)
  - Connect this repo, set root to `backend/`
  - Build command: `npm install`
  - Start command: `npm start`
  - Add env vars from `backend/.env.example` (especially `LLM_API_KEY`, `JWT_SECRET`, `CORS_ORIGIN` to your frontend URL)
  - Mount a persistent volume at `/app/data` (Railway: add a Volume, mount path `/app/data`)
- **Frontend** → [Vercel](https://vercel.com) or [Netlify](https://netlify.com)
  - Root: `frontend/`
  - Build: `npm run build` · Output dir: `dist`
  - Env var: `VITE_API_TARGET` = your backend's public URL
  - SPA rewrite to `index.html` is already in `deploy/vercel.json` (Vercel) and works out-of-the-box on Netlify

### Option B — Single-VPS with Docker

```bash
git clone <your-repo>
cd exam-oracle
cp backend/.env.example backend/.env   # add LLM_API_KEY
docker compose -f deploy/docker-compose.yml up -d --build
```

Put nginx/Caddy in front for HTTPS (Let's Encrypt).

### Option C — One container, single port

Build the frontend with `VITE_API_TARGET=/api` and serve both from the same origin via nginx proxying `/api` to the backend. See `deploy/` for the building blocks.

---

## 🧱 Architecture

```
┌──────────────┐    HTTP    ┌──────────────────┐    LLM API    ┌────────────┐
│ React (Vite) │ ─────────► │ Express + SQLite │ ────────────► │ OpenAI /   │
│  i18n EN/BN/ │   /api/*   │  - JWT auth      │               │ Groq /     │
│  ZH          │            │  - multer upload │               │ Anthropic  │
└──────────────┘            │  - PDF/DOCX/OCR  │               └────────────┘
                            │  - 3-stage LLM   │
                            │    pipeline      │
                            └──────────────────┘
```

### The 3-stage LLM pipeline

1. **Extract topics** from study materials → weighted list of topics
2. **Profile the teacher** from sample questions → style, type mix, difficulty, favorite phrasing
3. **Generate questions** that cross-reference (1) × (2) → realistic predicted questions with confidence + reasoning

For flashcards, a 4th pass runs on the study material alone.

### Project layout

```
.
├── backend/             # Express + SQLite + LLM
│   ├── src/
│   │   ├── server.js
│   │   ├── config.js
│   │   ├── db/          # SQLite schema + queries
│   │   ├── routes/      # /api/auth, /api/exams
│   │   ├── services/    # LLM pipeline
│   │   ├── middleware/  # auth
│   │   └── utils/       # file parsing + language detection
│   ├── .env.example
│   └── package.json
├── frontend/            # React + Vite
│   ├── src/
│   │   ├── pages/       # Login, Signup, Dashboard, Exam
│   │   ├── components/  # Topbar, QuestionCard, FlashcardDeck
│   │   ├── context/     # AuthContext
│   │   └── i18n/        # EN / BN / ZH strings + useT hook
│   └── package.json
├── deploy/
│   ├── Dockerfile.backend
│   ├── Dockerfile.frontend
│   ├── docker-compose.yml
│   ├── nginx.conf
│   └── vercel.json
└── README.md
```

---

## 🌐 Supported file types

| Type | How we read it |
|---|---|
| PDF | `pdf-parse` |
| DOCX | `mammoth` |
| PNG / JPG / WebP | `tesseract.js` (OCR; Bengali + Chinese supported) |
| TXT / MD | direct read |

Max upload size: 20 MB per file (configurable in `backend/.env` via `MAX_UPLOAD_MB`).

---

## 🔒 Security notes for production

- Change `JWT_SECRET` to a long random string (e.g. `openssl rand -hex 32`)
- Set `CORS_ORIGIN` to your actual frontend URL (no `*`)
- Use HTTPS (Let's Encrypt via Caddy is the easiest path)
- Mount `data/` and `uploads/` on persistent volumes; back them up
- Never commit `.env` — it's already in `.gitignore`
- For multi-user production, swap SQLite for Postgres (`backend/src/db/index.js` is one file to swap)

---

## 🛠 Development

```bash
# backend, with auto-reload:
cd backend && npm run dev

# frontend, with HMR:
cd frontend && npm run dev

# build for production:
cd frontend && npm run build      # → frontend/dist
cd backend && npm start
```

---

## 📝 License

MIT — do whatever, just don't blame us if your teacher throws a curveball. 😄
