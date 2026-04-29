import { Router } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const contactsRouter = Router()
contactsRouter.use(authenticate)

contactsRouter.get('/', async (req: AuthRequest, res) => {
  const contacts = await prisma.contact.findMany({
    where:   { companyId: req.user!.companyId },
    include: { clientRef: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(contacts)
})

contactsRouter.post('/', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  const { firstName, lastName, clientId, jobTitle, department,
          email, phone, mobile, ownerId, status, company, notes, tags } = req.body

  if (!firstName || !lastName || !email) {
    res.status(400).json({ error: 'First name, last name, and email are required.' })
    return
  }

  // Get company name from clientId if not provided
  let companyName = company || ''
  if (clientId && !companyName) {
    const client = await prisma.client.findUnique({ where: { id: clientId }, select: { name: true } })
    companyName = client?.name || ''
  }

  const contact = await prisma.contact.create({
    data: {
      firstName, lastName,
      clientId:    clientId  || null,
      jobTitle:    jobTitle   || '',
      department:  department || '',
      email,
      phone:       phone  || '',
      mobile:      mobile || '',
      ownerId:     ownerId || '',
      status:      status || 'ACTIVE',
      company:     companyName,
      notes:       notes || '',
      tags:        tags  || '',
      lastActivity: new Date(),
      companyId:   req.user!.companyId,
    }
  })
  res.status(201).json(contact)
})

contactsRouter.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  const fields = ['firstName', 'lastName', 'clientId', 'jobTitle', 'department',
    'email', 'phone', 'mobile', 'ownerId', 'status', 'company', 'notes', 'tags']
  const data: Record<string, unknown> = {}
  for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f] }
  data.lastActivity = new Date()
  const contact = await prisma.contact.update({ where: { id: req.params.id }, data })
  res.json(contact)
})

contactsRouter.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  await prisma.contact.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/contacts/bulk ──────────────────────────────────────────────────
contactsRouter.delete('/bulk', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.contact.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})
