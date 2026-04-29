import express from 'express';
import { getDb } from '../db';
import { authenticateToken, AuthRequest } from '../auth';

const router = express.Router();

router.get('/', authenticateToken, (req: AuthRequest, res) => {
  const db = getDb();
  const leads = db.prepare(`
    SELECT l.*, u.name as assigned_name 
    FROM leads l 
    LEFT JOIN users u ON l.assigned_to = u.id 
    ORDER BY l.created_at DESC
  `).all();
  res.json(leads);
});

router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const lead = db.prepare(`
    SELECT l.*, u.name as assigned_name 
    FROM leads l 
    LEFT JOIN users u ON l.assigned_to = u.id 
    WHERE l.id = ?
  `).get(req.params.id);
  if (!lead) return res.status(404).json({ error: 'Lead not found' });
  return res.json(lead);
});

router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { name, email, phone, company, status = 'new', priority = 'medium', source, assigned_to, notes } = req.body;
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO leads (name, email, phone, company, status, priority, source, assigned_to, notes)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, phone, company, status, priority, source, assigned_to || req.user?.id, notes);

    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(lead);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create lead' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, email, phone, company, status, priority, source, assigned_to, notes } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE leads SET name=?, email=?, phone=?, company=?, status=?, priority=?, source=?, assigned_to=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, email, phone, company, status, priority, source, assigned_to, notes, req.params.id);
    const lead = db.prepare('SELECT * FROM leads WHERE id = ?').get(req.params.id);
    return res.json(lead);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update lead' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM leads WHERE id = ?').run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete lead' });
  }
});

export default router;
