import express from 'express';
import { getDb } from '../db';
import { authenticateToken, AuthRequest } from '../auth';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const tasks = db.prepare(`
    SELECT t.*, u.name as assigned_name
    FROM tasks t
    LEFT JOIN users u ON t.assigned_to = u.id
    ORDER BY t.due_date ASC, t.created_at DESC
  `).all();
  res.json(tasks);
});

router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { title, description, due_date, priority = 'medium', status = 'pending', assigned_to, related_to_type, related_to_id } = req.body;
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO tasks (title, description, due_date, priority, status, assigned_to, related_to_type, related_to_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description, due_date, priority, status, assigned_to || req.user?.id, related_to_type || null, related_to_id || null);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { title, description, due_date, priority, status, assigned_to, related_to_type, related_to_id } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE tasks SET title=?, description=?, due_date=?, priority=?, status=?, assigned_to=?, related_to_type=?, related_to_id=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(title, description, due_date, priority, status, assigned_to, related_to_type || null, related_to_id || null, req.params.id);
    const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(req.params.id);
    return res.json(task);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update task' });
  }
});

router.patch('/:id/status', authenticateToken, (req, res) => {
  try {
    const { status } = req.body;
    const db = getDb();
    db.prepare('UPDATE tasks SET status=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(status, req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update task status' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete task' });
  }
});

export default router;
