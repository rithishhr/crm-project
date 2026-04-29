import { Router } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { notifyManagers } from '../lib/notifications'
import { syncClientToContact } from '../lib/leadSync'

export const clientsRouter = Router()
clientsRouter.use(authenticate)

clientsRouter.get('/', async (req: AuthRequest, res) => {
  const clients = await prisma.client.findMany({
    where:   { companyId: req.user!.companyId },
    orderBy: { totalRevenue: 'desc' },
  })
  res.json(clients)
})

clientsRouter.post('/', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const { name, accountType, industry, country, city, website,
          contactPerson, contactTitle, email, phone,
          accountOwner, customerStatus, paymentTerms, currency,
          tier, address1, postalCode, notes, tags } = req.body

  if (!name) { res.status(400).json({ error: 'Client name is required.' }); return }

  const client = await prisma.client.create({
    data: {
      name, accountType: accountType || 'CUSTOMER',
      industry: industry || '', country: country || 'UAE', city: city || '',
      website: website || '', contactPerson: contactPerson || '',
      contactTitle: contactTitle || '', email: email || '', phone: phone || '',
      accountOwner: accountOwner || '', customerStatus: customerStatus || 'PROSPECT',
      paymentTerms: paymentTerms || '', currency: currency || 'AED',
      tier: tier || 'SILVER', address1: address1 || '', postalCode: postalCode || '',
      notes: notes || '', tags: tags || '',
      companyId: req.user!.companyId,
    }
  })

  const sync = await syncClientToContact(prisma, client)

  // Notify managers
  await notifyManagers(req.user!.companyId, 'DEAL', 'New Client Added 🏢',
    `${name} has been added as a client.`)

  res.status(201).json({ ...client, sync })
})

clientsRouter.patch('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const fields = ['name', 'accountType', 'industry', 'country', 'city', 'website',
    'contactPerson', 'contactTitle', 'email', 'phone', 'accountOwner',
    'customerStatus', 'paymentTerms', 'currency', 'tier', 'address1',
    'postalCode', 'notes', 'tags', 'totalRevenue', 'activeDeals']
  const data: Record<string, unknown> = {}
  for (const f of fields) {
    if (req.body[f] !== undefined) {
      if (f === 'totalRevenue') data[f] = parseFloat(req.body[f])
      else data[f] = req.body[f]
    }
  }
  const client = await prisma.client.update({ where: { id: req.params.id }, data })
  const sync = await syncClientToContact(prisma, client)
  res.json({ ...client, sync })
})

clientsRouter.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  await prisma.client.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/clients/bulk ─────────────────────────────────────────────
clientsRouter.delete('/bulk', requireRole('ADMIN'), async (req: AuthRequest, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.client.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})
