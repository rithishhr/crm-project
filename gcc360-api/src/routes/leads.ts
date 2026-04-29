import { Router, Response } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { notifyManagers, createNotification } from '../lib/notifications'
import { generateAutoTask } from '../lib/autoTasks'
import { syncLeadToClientAndContact } from '../lib/leadSync'

export const leadsRouter = Router()
leadsRouter.use(authenticate)

leadsRouter.get('/', async (req: AuthRequest, res: Response) => {
  const leads = await prisma.lead.findMany({
    where:   { companyId: req.user!.companyId },
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(leads)
})

leadsRouter.get('/:id', async (req: AuthRequest, res: Response) => {
  const lead = await prisma.lead.findFirst({
    where:   { id: req.params.id, companyId: req.user!.companyId },
    include: { assignedTo: { select: { id: true, name: true } } },
  })
  if (!lead) { res.status(404).json({ error: 'Lead not found.' }); return }
  res.json(lead)
})

// ── POST /api/leads ────────────────────────────────────────────────────────────
leadsRouter.post('/', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res: Response) => {
  const {
    title, company, contactName, email, phone, country, source,
    industry, value, priority, expectedTimeline,
    requirements, internalNotes, notes, tags, assignedToId
  } = req.body

  if (!company || !contactName || !email) {
    res.status(400).json({ error: 'Company name, contact name, and email are required.' })
    return
  }

  const assignedId = assignedToId || req.user!.userId

  const { lead, sync } = await prisma.$transaction(async (tx) => {
    const lead = await tx.lead.create({
      data: {
        title:             title || `${company} — Lead`,
        company, contactName, email,
        phone:             phone || '',
        country:           country || 'UAE',
        source:            source || 'MANUAL',
        industry:          industry || '',
        value:             parseFloat(value) || 0,
        priority:          priority || 'MEDIUM',
        expectedTimeline:  expectedTimeline || '',
        requirements:      requirements || notes || '',
        internalNotes:     internalNotes || '',
        tags:              tags || '',
        status:            'NEW',
        aiCredibilityScore: 0,
        companyId:         req.user!.companyId,
        assignedToId:      assignedId,
      },
      include: { assignedTo: { select: { id: true, name: true, avatar: true } } }
    })

    const sync = await syncLeadToClientAndContact(tx, lead)
    return { lead, sync }
  })

  // Notify assigned user if different from creator
  if (assignedId !== req.user!.userId) {
    await createNotification({
      userId: assignedId, companyId: req.user!.companyId,
      type: 'LEAD', title: 'New Lead Assigned',
      message: `${company} has been assigned to you by ${req.user!.userId}`
    })
  }

  // Auto log activity
  await prisma.activity.create({
    data: { type: 'LEAD', description: `New lead created: ${company}`, company, createdById: req.user!.userId, companyId: req.user!.companyId }
  }).catch(() => {})

  res.status(201).json({ ...lead, sync })

  // Fire-and-forget auto task generation
  generateAutoTask('LEAD', lead, req.user!.companyId, assignedId).catch(console.error)
})

// ── PATCH /api/leads/:id ───────────────────────────────────────────────────────
leadsRouter.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  const allowed = ['title', 'company', 'contactName', 'email', 'phone', 'country', 'source',
    'industry', 'priority', 'expectedTimeline', 'requirements', 'internalNotes', 'tags',
    'status', 'assignedToId', 'aiCredibilityScore', 'notes']
  const data: Record<string, unknown> = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      if (key === 'notes') data.requirements = req.body[key]  // alias
      else data[key] = req.body[key]
    }
  }
  if (req.body.value !== undefined) data.value = parseFloat(req.body.value)
  const lead = await prisma.lead.update({ where: { id: req.params.id }, data,
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } }
  })
  res.json(lead)
})

// ── DELETE /api/leads/:id ──────────────────────────────────────────────────────
leadsRouter.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  await prisma.lead.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/leads/bulk ─────────────────────────────────────────────────────
leadsRouter.delete('/bulk', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.lead.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})

// ── POST /api/leads/:id/qualify ────────────────────────────────────────────────
leadsRouter.post('/:id/qualify', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  const lead = await prisma.lead.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } })
  if (!lead) { res.status(404).json({ error: 'Lead not found.' }); return }

  const closeDate = new Date()
  closeDate.setDate(closeDate.getDate() + 90)

  const [updatedLead, opportunity] = await prisma.$transaction(async (tx) => {
    const sync = await syncLeadToClientAndContact(tx, lead)

    const updatedLead = await tx.lead.update({ where: { id: lead.id }, data: { status: 'QUALIFIED' } })
    const opportunity = await tx.opportunity.create({
      data: {
        title:       lead.title || `${lead.company} — Opportunity`,
        company:     lead.company,
        value:       lead.value,
        stage:       'QUALIFICATION',
        probability: 25,
        riskLevel:   'LOW',
        closeDate,
        notes:       lead.requirements || '',
        companyId:   lead.companyId,
        ownerId:     lead.assignedToId || req.user!.userId,
        leadId:      lead.id,
      }
    })

    return [updatedLead, { ...opportunity, sync }] as const
  })

  // Notify managers
  await notifyManagers(lead.companyId, 'LEAD', 'Lead Qualified! 🎯',
    `${lead.company} has been qualified and moved to opportunities.`)

  const sync = (opportunity as any).sync
  res.json({ lead: updatedLead, opportunity, sync })

  generateAutoTask('OPPORTUNITY', opportunity, lead.companyId, lead.assignedToId || req.user!.userId).catch(console.error)
})

// ── POST /api/leads/:id/approve ────────────────────────────────────────────────
leadsRouter.post('/:id/approve', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const lead = await prisma.lead.findFirst({ where: { id: req.params.id, companyId: req.user!.companyId } })
  if (!lead) { res.status(404).json({ error: 'Lead not found.' }); return }

  const result = await prisma.$transaction(async (tx) => {
    const sync = await syncLeadToClientAndContact(tx, lead)
    const leadUpdate = await tx.lead.update({
      where: { id: lead.id },
      data:  { aiVerified: true, status: 'NEW' }
    })
    return { lead: leadUpdate, sync }
  })

  res.json(result)
})

// ── POST /api/leads/:id/reject ─────────────────────────────────────────────────
leadsRouter.post('/:id/reject', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const lead = await prisma.lead.update({
    where: { id: req.params.id },
    data:  { aiFraudFlag: true, status: 'DISQUALIFIED' }
  })
  res.json(lead)
})
