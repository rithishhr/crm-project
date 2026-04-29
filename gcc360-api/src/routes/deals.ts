import { Router, Response } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const dealsRouter = Router()
dealsRouter.use(authenticate)

dealsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const deals = await prisma.deal.findMany({
    where: { companyId: req.user!.companyId },
    orderBy: { createdAt: 'desc' },
  })
  res.json(deals)
})

dealsRouter.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { title, company, value, stage, closedDate, clientId } = req.body
  if (!title || !company || !value) { res.status(400).json({ error: 'Title, company, and value are required.' }); return }
  const deal = await prisma.deal.create({
    data: {
      title, company,
      value:     parseFloat(value),
      stage:     stage || 'CLOSED_WON',
      closedDate: closedDate ? new Date(closedDate) : new Date(),
      clientId,
      companyId: req.user!.companyId,
      ownerId:   req.user!.userId,
    }
  })
  res.status(201).json(deal)
})

dealsRouter.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const fields = ['title', 'company', 'stage', 'clientId']
  const data: Record<string, unknown> = {}
  for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f] }
  if (req.body.value !== undefined) data.value = parseFloat(req.body.value)
  if (req.body.closedDate !== undefined) data.closedDate = new Date(req.body.closedDate)
  const deal = await prisma.deal.update({ where: { id: req.params.id }, data })
  res.json(deal)
})

// ── DELETE /api/deals/:id ──────────────────────────────────────────────────────
dealsRouter.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  await prisma.deal.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/deals/bulk ─────────────────────────────────────────────────────
dealsRouter.delete('/bulk', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.deal.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})
