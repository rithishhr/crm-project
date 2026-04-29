import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { generateToken } from '../auth';

const router = express.Router();

router.post('/login', (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const db = getDb();
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email) as any;

    if (!user || !bcrypt.compareSync(password, user.password_hash)) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = generateToken({ id: user.id, email: user.email, name: user.name, role: user.role });
    return res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
  } catch (err) {
    return res.status(500).json({ error: 'Login failed' });
  }
});

router.post('/register', (req, res) => {
  try {
    const { email, password, name, role = 'sales_rep' } = req.body;
    if (!email || !password || !name) {
      return res.status(400).json({ error: 'Email, password and name required' });
    }

    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) {
      return res.status(409).json({ error: 'Email already registered' });
    }

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
    ).run(email, password_hash, name, role);

    const user = { id: result.lastInsertRowid, email, name, role };
    const token = generateToken(user as any);
    return res.status(201).json({ token, user });
  } catch (err) {
    return res.status(500).json({ error: 'Registration failed' });
  }
});

export default router;
