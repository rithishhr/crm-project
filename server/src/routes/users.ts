import express from 'express';
import bcrypt from 'bcryptjs';
import { getDb } from '../db';
import { authenticateToken, requireRole, AuthRequest } from '../auth';

const router = express.Router();

router.get('/', authenticateToken, requireRole('admin', 'manager'), (req, res) => {
  const db = getDb();
  const users = db.prepare('SELECT id, email, name, role, created_at FROM users ORDER BY created_at DESC').all();
  res.json(users);
});

router.post('/', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    const { email, password, name, role = 'sales_rep' } = req.body;
    const db = getDb();
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = bcrypt.hashSync(password, 10);
    const result = db.prepare(
      'INSERT INTO users (email, password_hash, name, role) VALUES (?, ?, ?, ?)'
    ).run(email, password_hash, name, role);
    return res.status(201).json({ id: result.lastInsertRowid, email, name, role });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create user' });
  }
});

router.put('/:id', authenticateToken, requireRole('admin'), (req, res) => {
  try {
    const { name, role, email } = req.body;
    const db = getDb();
    db.prepare('UPDATE users SET name = ?, role = ?, email = ? WHERE id = ?')
      .run(name, role, email, req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update user' });
  }
});

router.delete('/:id', authenticateToken, requireRole('admin'), (req: AuthRequest, res) => {
  try {
    if (Number(req.params.id) === req.user?.id) {
      return res.status(400).json({ error: 'Cannot delete yourself' });
    }
    const db = getDb();
    db.prepare('DELETE FROM users WHERE id = ?').run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete user' });
  }
});

export default router;
