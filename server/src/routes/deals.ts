import express from 'express';
import { getDb } from '../db';
import { authenticateToken, AuthRequest } from '../auth';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const deals = db.prepare(`
    SELECT d.*, c.name as client_name, u.name as assigned_name
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    ORDER BY d.created_at DESC
  `).all();
  res.json(deals);
});

router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const deal = db.prepare(`
    SELECT d.*, c.name as client_name, u.name as assigned_name
    FROM deals d
    LEFT JOIN clients c ON d.client_id = c.id
    LEFT JOIN users u ON d.assigned_to = u.id
    WHERE d.id = ?
  `).get(req.params.id);
  if (!deal) return res.status(404).json({ error: 'Deal not found' });
  return res.json(deal);
});

router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { title, client_id, value = 0, stage = 'prospecting', probability = 10, expected_close, assigned_to, notes } = req.body;
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO deals (title, client_id, value, stage, probability, expected_close, assigned_to, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, client_id, value, stage, probability, expected_close, assigned_to || req.user?.id, notes);
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(deal);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create deal' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { title, client_id, value, stage, probability, expected_close, assigned_to, notes } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE deals SET title=?, client_id=?, value=?, stage=?, probability=?, expected_close=?, assigned_to=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(title, client_id, value, stage, probability, expected_close, assigned_to, notes, req.params.id);
    const deal = db.prepare('SELECT * FROM deals WHERE id = ?').get(req.params.id);
    return res.json(deal);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update deal' });
  }
});

router.patch('/:id/stage', authenticateToken, (req, res) => {
  try {
    const { stage } = req.body;
    const db = getDb();
    db.prepare('UPDATE deals SET stage=?, updated_at=CURRENT_TIMESTAMP WHERE id=?').run(stage, req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update deal stage' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM deals WHERE id = ?').run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete deal' });
  }
});

export default router;
