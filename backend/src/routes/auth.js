import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { findUserByEmail, createUser } from '../db/index.js';
import { signToken, requireAuth } from '../middleware/auth.js';

const router = Router();

const credsSchema = z.object({
  email: z.string().email().max(200),
  password: z.string().min(8).max(200),
  displayName: z.string().max(100).optional(),
});

router.post('/register', async (req, res) => {
  const parsed = credsSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input', issues: parsed.error.flatten() });
  }
  const { email, password, displayName } = parsed.data;

  if (findUserByEmail(email)) {
    return res.status(409).json({ error: 'Email already registered' });
  }
  const hash = await bcrypt.hash(password, 10);
  const info = createUser(email, hash, displayName);
  const user = { id: info.lastInsertRowid, email };
  const token = signToken(user);
  res.json({ token, user });
});

router.post('/login', async (req, res) => {
  const parsed = credsSchema.omit({ displayName: true }).safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: 'Invalid input' });
  }
  const { email, password } = parsed.data;
  const user = findUserByEmail(email);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return res.status(401).json({ error: 'Invalid credentials' });
  const token = signToken(user);
  res.json({
    token,
    user: {
      id: user.id,
      email: user.email,
      display_name: user.display_name,
      preferred_language: user.preferred_language,
    },
  });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: req.user });
});

export default router;
