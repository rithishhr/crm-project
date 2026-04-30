import { Router } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { triggerScan } from '../services/emailScanner'
import { transporter } from '../services/mailer'

export const emailRouter = Router()
emailRouter.use(authenticate)

// ── POST /api/email/scan ───────────────────────────────────────────────────────
// Manually trigger inbox scan
emailRouter.post('/scan', requireRole('ADMIN'), async (_req, res) => {
  try {
    const result = await triggerScan()
    res.json(result)
  } catch (err: unknown) {
    res.status(500).json({ error: (err as Error).message })
  }
})

// ── GET /api/email/logs ────────────────────────────────────────────────────────
// Get history of scanned emails
emailRouter.get('/logs', requireRole('ADMIN', 'SALES_MANAGER'), async (req: AuthRequest, res) => {
  const logs = await prisma.emailScanLog.findMany({
    where:   { companyId: req.user!.companyId },
    orderBy: { scannedAt: 'desc' },
    take:    50,
  })
  res.json(logs)
})

// ── GET /api/email/pending-leads ───────────────────────────────────────────────
// Leads that came from email and need human review
emailRouter.get('/pending-leads', requireRole('ADMIN', 'SALES_MANAGER'), async (req: AuthRequest, res) => {
  const leads = await prisma.lead.findMany({
    where: {
      companyId:   req.user!.companyId,
      fromEmail:   true,
      aiVerified:  false,
      aiFraudFlag: false,
    },
    orderBy: { createdAt: 'desc' },
  })
  res.json(leads)
})

// ── POST /api/email/send ───────────────────────────────────────────────────────
emailRouter.post('/send', async (req: AuthRequest, res) => {
  const { to, subject, body } = req.body
  if (!to || !subject || !body) {
    res.status(400).json({ error: 'Missing to, subject, or body fields' })
    return
  }

  try {
    if (!process.env.MAIL_USER) {
      throw new Error('SMTP credentials not configured in .env')
    }

    // Add a 15-second timeout for the sendMail call
    const sendPromise = transporter.sendMail({
      from: `"GCC360 CRM" <${process.env.MAIL_USER}>`,
      to,
      subject,
      text: body,
    })

    const timeoutPromise = new Promise((_, reject) => 
      setTimeout(() => reject(new Error('Email sending timed out after 15s')), 15000)
    )

    await Promise.race([sendPromise, timeoutPromise])

    // Log the activity
    await prisma.activity.create({
      data: {
        type: 'EMAIL',
        description: `Sent email to ${to}: ${subject}`,
        createdById: req.user!.userId,
        companyId: req.user!.companyId,
      }
    }).catch(() => {})

    res.json({ success: true, message: 'Email sent successfully' })
  } catch (err: any) {
    console.error('Email sending failed:', err)
    res.status(500).json({ error: `Failed to send email: ${err.message}` })
  }
})
