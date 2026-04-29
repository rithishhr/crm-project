import express from 'express';
import { getDb } from '../db';
import { authenticateToken, AuthRequest } from '../auth';

const router = express.Router();

router.get('/', authenticateToken, (req, res) => {
  const db = getDb();
  const clients = db.prepare(`
    SELECT c.*, u.name as assigned_name
    FROM clients c
    LEFT JOIN users u ON c.assigned_to = u.id
    ORDER BY c.created_at DESC
  `).all();
  res.json(clients);
});

router.get('/:id', authenticateToken, (req, res) => {
  const db = getDb();
  const client = db.prepare(`
    SELECT c.*, u.name as assigned_name
    FROM clients c
    LEFT JOIN users u ON c.assigned_to = u.id
    WHERE c.id = ?
  `).get(req.params.id);
  if (!client) return res.status(404).json({ error: 'Client not found' });
  return res.json(client);
});

router.post('/', authenticateToken, (req: AuthRequest, res) => {
  try {
    const { name, email, phone, company, industry, website, address, assigned_to, notes, total_value = 0 } = req.body;
    const db = getDb();
    const result = db.prepare(`
      INSERT INTO clients (name, email, phone, company, industry, website, address, assigned_to, notes, total_value)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(name, email, phone, company, industry, website, address, assigned_to || req.user?.id, notes, total_value);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(result.lastInsertRowid);
    return res.status(201).json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to create client' });
  }
});

router.put('/:id', authenticateToken, (req, res) => {
  try {
    const { name, email, phone, company, industry, website, address, assigned_to, notes, total_value } = req.body;
    const db = getDb();
    db.prepare(`
      UPDATE clients SET name=?, email=?, phone=?, company=?, industry=?, website=?, address=?, assigned_to=?, notes=?, total_value=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=?
    `).run(name, email, phone, company, industry, website, address, assigned_to, notes, total_value, req.params.id);
    const client = db.prepare('SELECT * FROM clients WHERE id = ?').get(req.params.id);
    return res.json(client);
  } catch (err) {
    return res.status(500).json({ error: 'Failed to update client' });
  }
});

router.delete('/:id', authenticateToken, (req, res) => {
  try {
    const db = getDb();
    db.prepare('DELETE FROM clients WHERE id = ?').run(req.params.id);
    return res.json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: 'Failed to delete client' });
  }
});

export default router;
