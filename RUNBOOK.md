# 🚀 Runbook — get Exam Oracle running in 10 minutes

Follow these steps **in order**. Open two terminal windows (one for backend, one for frontend).

---

## ✅ Prerequisites (1 min)

You need **Node.js 18.17 or newer** (Node 20 LTS is best).

Check:
```bash
node --version   # should print v18.17.0 or higher
npm --version    # should print 9.x or 10.x
```

If you don't have it: https://nodejs.org → download **LTS** → install → restart your terminal.

You also need an **LLM API key**. The fastest free option is Groq (free tier, no credit card):

1. Go to https://console.groq.com/keys
2. Sign up (GitHub login works)
3. Click **"Create API Key"**
4. **Copy the key immediately** — Groq only shows it once. Looks like `gsk_abc123...`
5. Keep it in your clipboard for step 3 below

> If you'd rather use OpenAI or Claude, the key looks like `sk-...`. The `.env` file uses the same `LLM_API_KEY=` field either way.

---

## 📥 Step 1 — Get the code (30 sec)

```bash
git clone https://github.com/mo1shiur/exam-oracle.git
cd exam-oracle
```

If you don't have git or don't want to clone, you can also download the ZIP from GitHub:
→ Click the green **"Code"** button on https://github.com/mo1shiur/exam-oracle → **Download ZIP** → unzip it → `cd` into the folder.

---

## 🧠 Step 2 — Start the BACKEND (3 min)

```bash
cd backend
cp .env.example .env
```

Now **open `backend/.env`** in any text editor (Notepad, VS Code, nano, vim — anything).

You need to change **one line**:

```
LLM_API_KEY=
```

becomes:

```
LLM_API_KEY=gsk_your_actual_key_here
```

(`gsk_...` if Groq, `sk-...` if OpenAI)

Optional but recommended: also change `JWT_SECRET` to any long random string. Doesn't matter what.

Save the file. Then:

```bash
npm install
npm run dev
```

✅ **You're good if you see this:**
```
🧠 Exam Oracle backend listening on http://localhost:4000
   LLM provider: groq (configured ✓)
```

⚠️ If you see `(NOT configured — set LLM_API_KEY)` instead of `(configured ✓)`, your `.env` didn't save properly or `LLM_API_KEY=` is still empty. Fix the file, then `Ctrl+C` and re-run `npm run dev`.

**Quick sanity check** (open a third terminal, or new tab):
```bash
curl http://localhost:4000/api/health
```

Should return: `{"ok":true,"llm_configured":true,...}` — the `llm_configured:true` part confirms your key works.

**Keep this terminal running.** Open a new one for the frontend.

---

## 🎨 Step 3 — Start the FRONTEND (1 min)

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

✅ **You're good if you see this:**
```
  VITE v5.4.x  ready in xxx ms
  ➜  Local:   http://localhost:5173/
```

Open **http://localhost:5173** in your browser.

---

## 🎉 Step 4 — Use it (2 min)

1. Click **"Sign up"** (bottom of the login card)
2. Enter email + password (min 8 chars) → **Sign up**
3. You'll land on the dashboard. Click **"+ New exam"**
4. Title: `My first exam` · Subject: whatever you want → **Create**
5. Click on the exam card → opens the exam page
6. **Upload study material** (left card, "📤 Upload file" or paste text)
7. *(Optional)* **Upload teacher samples** (right card)
8. Click **"⚡ Analyze"** (saves teacher profile + topics)
9. Click **"🎯 Generate predictions"** — wait ~20 sec, you'll see predicted questions
10. Switch tabs: **Questions** / **Study mode** / **Flashcards**

---

## 🛑 Common mistakes (and fixes)

| Problem | Cause | Fix |
|---|---|---|
| Backend: `EADDRINUSE` on port 4000 | Something else is using the port | `lsof -i :4000` to find it, or change `PORT=4001` in `.env` |
| Backend: `NOT configured` after adding key | `.env` not saved, or wrong line | Open `.env`, make sure the line says exactly `LLM_API_KEY=gsk_...` (no spaces, no quotes) |
| Frontend: `Failed to fetch` when logging in | Backend isn't running, or wrong URL | Make sure backend terminal is still open, then check `http://localhost:4000/api/health` in browser |
| Frontend: `CORS error` in console | `CORS_ORIGIN` in backend `.env` doesn't match frontend URL | If you're using a different frontend port, add it to `CORS_ORIGIN=http://localhost:5173,http://localhost:3000` |
| `npm install` fails on `better-sqlite3` | Missing build tools | Mac: `xcode-select --install`. Ubuntu: `sudo apt install build-essential python3`. Windows: `npm install -g windows-build-tools` |
| Login works but "Generate" returns error | LLM call failed | Check backend terminal for the actual error. Most common: invalid key, rate limit, or model name typo. |

---

## 🐳 One-command alternative: Docker

If you have Docker installed and don't want to mess with two terminals:

```bash
cd exam-oracle
export LLM_API_KEY=gsk_your_key_here
docker compose -f deploy/docker-compose.yml up --build
```

Then open **http://localhost:8080** (frontend) — the backend runs internally on `:4000`.

To stop: `Ctrl+C`. To clean up: `docker compose -f deploy/docker-compose.yml down`.

---

## 🛑 How to stop everything

- Backend: in its terminal → `Ctrl+C`
- Frontend: in its terminal → `Ctrl+C`
- Docker: `Ctrl+C` then `docker compose -f deploy/docker-compose.yml down`

---

## 🆘 Still stuck?

Open an issue: https://github.com/mo1shiur/exam-oracle/issues/new?template=bug_report.md

Include:
1. The error message (copy-paste from terminal)
2. Your OS (Windows / Mac / Linux)
3. Output of `node --version` and `npm --version`
4. Output of `curl http://localhost:4000/api/health`