import { config, isLlmConfigured } from '../config.js';

/**
 * Universal chat-completion adapter. We normalize calls across OpenAI,
 * Groq, Anthropic, and any OpenAI-compatible endpoint so users can plug
 * in whatever they have without changing the pipeline.
 */
async function callLlm({ system, user, json = false, temperature = 0.4, maxTokens = 2000 }) {
  if (!isLlmConfigured()) {
    throw new Error(
      'LLM_API_KEY is not set. Copy backend/.env.example to backend/.env and add your key, then restart.'
    );
  }

  const { provider, apiKey, model, baseUrl } = config.llm;
  const headers = { 'Content-Type': 'application/json' };

  let url;
  let body;

  if (provider === 'anthropic') {
    url = 'https://api.anthropic.com/v1/messages';
    headers['x-api-key'] = apiKey;
    headers['anthropic-version'] = '2023-06-01';
    body = {
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    };
    const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Anthropic error ${res.status}: ${t}`);
    }
    const data = await res.json();
    const text = data.content?.[0]?.text || '';
    return parseMaybeJson(text, json);
  }

  // OpenAI / Groq / OpenAI-compatible
  if (!baseUrl) {
    if (provider === 'groq') url = 'https://api.groq.com/openai/v1/chat/completions';
    else if (provider === 'openai') url = 'https://api.openai.com/v1/chat/completions';
    else url = 'https://api.openai.com/v1/chat/completions';
  } else {
    url = `${baseUrl.replace(/\/$/, '')}/chat/completions`;
  }
  headers['Authorization'] = `Bearer ${apiKey}`;

  body = {
    model,
    temperature,
    max_tokens: maxTokens,
    messages: [
      ...(system ? [{ role: 'system', content: system }] : []),
      { role: 'user', content: user },
    ],
  };
  if (json) body.response_format = { type: 'json_object' };

  const res = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
  if (!res.ok) {
    const t = await res.text();
    throw new Error(`LLM error ${res.status}: ${t}`);
  }
  const data = await res.json();
  const text = data.choices?.[0]?.message?.content || '';
  return parseMaybeJson(text, json);
}

function parseMaybeJson(text, wantJson) {
  if (!wantJson) return text;
  try {
    return JSON.parse(text);
  } catch {
    // try to extract JSON from fences
    const match = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
    if (match) {
      try {
        return JSON.parse(match[0]);
      } catch {
        /* fall through */
      }
    }
    throw new Error('LLM returned non-JSON despite JSON request');
  }
}

// ---------------------------------------------------------------------------
// STAGE 1 — extract topics & weight from study materials
// ---------------------------------------------------------------------------
export async function extractTopics({ text, language, subjectHint }) {
  const system = `You are an expert study coach. You extract structured information from study material in any language (English, Bengali, Chinese, or mixed). Always respond with strict JSON.`;

  const user = `Analyze the following study material${subjectHint ? ` for the subject "${subjectHint}"` : ''}.
Detected language: ${language}.

Return JSON with this exact shape:
{
  "subject": "<best guess of subject>",
  "language": "<en|bn|zh|mixed>",
  "topics": [
    { "name": "<topic name in source language>", "weight": <1-10>, "subtopics": ["..."] }
  ],
  "summary": "<2-3 sentence overview>"
}

Weight 1-10 represents how much exam-worthy content is in that topic. Use the source language for topic names.

---STUDY MATERIAL---
${text.slice(0, 18000)}
---END---`;

  const out = await callLlm({ system, user, json: true, maxTokens: 1500 });
  if (!out || !Array.isArray(out.topics)) {
    throw new Error('LLM did not return a valid topics payload');
  }
  return out;
}

// ---------------------------------------------------------------------------
// STAGE 2 — profile the teacher's question style
// ---------------------------------------------------------------------------
export async function profileTeacher({ samplesText, subjectHint, language }) {
  const system = `You analyze how a teacher writes exam questions. You output strict JSON.`;
  const user = `Below are sample questions / suggestions from a teacher${subjectHint ? ` for "${subjectHint}"` : ''}.
Language: ${language}.

Identify:
- The teacher's typical style (formal/casual, trick questions, application vs recall, etc.)
- Common question types (mcq, short answer, long answer, true/false, fill-in, case study, etc.) and their rough proportions
- Difficulty level (easy / medium / hard / mixed)
- Recurring patterns (e.g. "compare X and Y", "critically evaluate", "give examples of...")
- Vocabulary or phrasing the teacher seems to favor

Return JSON:
{
  "style_summary": "<paragraph>",
  "question_types": [{ "type": "<string>", "share": <0-1> }],
  "difficulty": "<easy|medium|hard|mixed>",
  "formality": "<formal|casual|mixed>",
  "patterns": ["<pattern 1>", "<pattern 2>", "..."],
  "favorite_phrases": ["<phrase 1>", "..."]
}

---SAMPLE QUESTIONS---
${samplesText.slice(0, 12000)}
---END---`;

  return await callLlm({ system, user, json: true, maxTokens: 1200 });
}

// ---------------------------------------------------------------------------
// STAGE 3 — generate predicted questions
// ---------------------------------------------------------------------------
export async function generatePredictedQuestions({
  topics,
  teacherProfile,
  language,
  count = 15,
  subjectHint,
}) {
  const system = `You are an expert exam predictor. You write realistic exam questions in the same language and style as the teacher's samples, covering the topics in the study material. Always respond with strict JSON.`;

  const user = `Generate ${count} likely exam questions.

CONTEXT
- Subject: ${subjectHint || topics.subject || 'unknown'}
- Language: ${language} (write questions in this language)
- Teacher style: ${teacherProfile.style_summary}
- Difficulty: ${teacherProfile.difficulty}
- Formality: ${teacherProfile.formality}
- Question type mix: ${JSON.stringify(teacherProfile.question_types || [])}
- Recurring patterns to mimic: ${(teacherProfile.patterns || []).join(' | ')}
- Favorite phrases to reuse: ${(teacherProfile.favorite_phrases || []).join(' | ')}

TOPICS (sorted by weight, highest first)
${topics.topics
  .slice(0, 30)
  .map((t) => `- ${t.name} (weight ${t.weight})`)
  .join('\n')}

Return JSON:
{
  "questions": [
    {
      "question_text": "<the question, in source language>",
      "question_type": "<mcq|short|long|truefalse|fill|case|other>",
      "topic": "<matching topic name>",
      "confidence": "<high|medium|low>",
      "reasoning": "<one sentence: why this is likely>",
      "answer_text": "<concise correct answer, in source language>"
    }
  ]
}

Make sure:
- Higher-weighted topics get more questions
- Mix of question types matches the teacher's profile
- At least 5 should be "high" confidence
- Confidence reflects how directly the topic appears in samples + how often the pattern is reused`;

  return await callLlm({ system, user, json: true, maxTokens: 3500, temperature: 0.6 });
}

// ---------------------------------------------------------------------------
// STAGE 4 — generate flashcards from study material
// ---------------------------------------------------------------------------
export async function generateFlashcards({ text, language, count = 20, subjectHint }) {
  const system = `You create concise study flashcards. Output strict JSON.`;
  const user = `From the following study material${subjectHint ? ` for "${subjectHint}"` : ''}, generate ${count} flashcards.

Language: ${language}. Write front/back in this language.

A good flashcard has:
- A clear, specific front (term, concept, date, formula, definition cue)
- A short, accurate back (1-3 sentences max)

Return JSON:
{
  "flashcards": [
    { "front": "<prompt>", "back": "<answer>", "topic": "<topic>" }
  ]
}

---STUDY MATERIAL---
${text.slice(0, 18000)}
---END---`;

  return await callLlm({ system, user, json: true, maxTokens: 2500 });
}
