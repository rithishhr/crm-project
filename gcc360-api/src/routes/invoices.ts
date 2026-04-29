import { Router } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const invoicesRouter = Router()
invoicesRouter.use(authenticate)

invoicesRouter.get('/', async (req: AuthRequest, res) => {
  const invoices = await prisma.invoice.findMany({
    where:   { companyId: req.user!.companyId },
    include: { client: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(invoices)
})

invoicesRouter.post('/', requireRole('ADMIN', 'FINANCE'), async (req: AuthRequest, res) => {
  const { invoiceNumber, amount, dueDate, clientId, items } = req.body
  if (!invoiceNumber || !amount || !dueDate || !clientId) {
    res.status(400).json({ error: 'Invoice number, amount, due date, and client are required.' })
    return
  }
  const invoice = await prisma.invoice.create({
    data: { invoiceNumber, amount: parseFloat(amount), dueDate: new Date(dueDate), status: 'PENDING', items, clientId, companyId: req.user!.companyId }
  })
  res.status(201).json(invoice)
})

invoicesRouter.patch('/:id/status', requireRole('ADMIN', 'FINANCE'), async (req: AuthRequest, res) => {
  const { status } = req.body
  const upperStatus = (status || '').toUpperCase()
  
  if (!['PENDING', 'PARTIALLY_PAID', 'PAID'].includes(upperStatus)) {
    res.status(400).json({ error: 'Status must be PENDING, PARTIALLY_PAID, or PAID.' })
    return
  }
  const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { status: upperStatus } })
  res.json(invoice)
})

invoicesRouter.delete('/:id', requireRole('ADMIN', 'FINANCE'), async (req: AuthRequest, res) => {
  await prisma.invoice.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/invoices/bulk ─────────────────────────────────────────────
invoicesRouter.delete('/bulk', requireRole('ADMIN', 'FINANCE'), async (req: AuthRequest, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.invoice.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})
