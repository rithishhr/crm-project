import express from 'express';
import nodemailer from 'nodemailer';
import { getDb } from '../db';
import { authenticateToken, AuthRequest } from '../auth';

const router = express.Router();

function createTransport() {
  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return null;
  }
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST || 'smtp.gmail.com',
    port: Number(process.env.SMTP_PORT) || 587,
    secure: false,
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASS,
    },
  });
}

router.post('/send', authenticateToken, async (req: AuthRequest, res) => {
  const { to_email, subject, body } = req.body;
  if (!to_email || !subject || !body) {
    return res.status(400).json({ error: 'to_email, subject and body are required' });
  }

  const db = getDb();
  const transport = createTransport();

  if (!transport) {
    // Mock mode - log and save
    console.log(`[EMAIL MOCK] To: ${to_email}, Subject: ${subject}`);
    db.prepare(
      'INSERT INTO email_logs (to_email, subject, body, status, user_id) VALUES (?, ?, ?, ?, ?)'
    ).run(to_email, subject, body, 'sent', req.user?.id);
    return res.json({ success: true, mock: true, message: 'Email logged (SMTP not configured)' });
  }

  try {
    await transport.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: to_email,
      subject,
      text: body,
    });
    db.prepare(
      'INSERT INTO email_logs (to_email, subject, body, status, user_id) VALUES (?, ?, ?, ?, ?)'
    ).run(to_email, subject, body, 'sent', req.user?.id);
    return res.json({ success: true });
  } catch (err) {
    db.prepare(
      'INSERT INTO email_logs (to_email, subject, body, status, user_id) VALUES (?, ?, ?, ?, ?)'
    ).run(to_email, subject, body, 'failed', req.user?.id);
    return res.status(500).json({ error: 'Failed to send email' });
  }
});

router.get('/logs', authenticateToken, (req, res) => {
  const db = getDb();
  const logs = db.prepare(`
    SELECT e.*, u.name as sent_by
    FROM email_logs e
    LEFT JOIN users u ON e.user_id = u.id
    ORDER BY e.created_at DESC LIMIT 50
  `).all();
  res.json(logs);
});

export default router;
