import { Router } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

// ── ACTIVITIES ─────────────────────────────────────────────────────────────────
export const activitiesRouter = Router()
activitiesRouter.use(authenticate)

activitiesRouter.get('/', async (req: AuthRequest, res) => {
  const activities = await prisma.activity.findMany({
    where:   { companyId: req.user!.companyId },
    include: { createdBy: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
    take:    100,
  })
  res.json(activities)
})

activitiesRouter.post('/', requireRole('ADMIN', 'SALES_MANAGER', 'SALESPERSON'), async (req: AuthRequest, res) => {
  const { type, description, contact, company } = req.body
  if (!type || !description) { res.status(400).json({ error: 'Type and description are required.' }); return }
  const activity = await prisma.activity.create({
    data: { type: type.toUpperCase(), description, contact, company, createdById: req.user!.userId, companyId: req.user!.companyId }
  })
  res.status(201).json(activity)
})
