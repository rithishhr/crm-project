import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const analyticsRouter = Router()
analyticsRouter.use(authenticate)

// ── GET /api/analytics/dashboard ──────────────────────────────────────────────
// Returns all KPIs needed for the dashboard
analyticsRouter.get('/dashboard', async (req: AuthRequest, res) => {
  const { companyId } = req.user!

  const [totalLeads, qualifiedLeads, opportunities, deals, clients, tasks, invoices] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.lead.count({ where: { companyId, status: 'QUALIFIED' } }),
    prisma.opportunity.findMany({ where: { companyId } }),
    prisma.deal.findMany({ where: { companyId } }),
    prisma.client.count({ where: { companyId } }),
    prisma.task.count({ where: { companyId, status: 'TODO' } }),
    prisma.invoice.findMany({ where: { companyId } }),
  ])

  const pipelineValue    = opportunities.reduce((s, o) => s + Number(o.value), 0)
  const totalRevenue     = deals.reduce((s, d) => s + Number(d.value), 0)
  const pendingInvoices  = invoices.filter(i => i.status !== 'PAID').reduce((s, i) => s + Number(i.amount), 0)
  const conversionRate   = totalLeads > 0 ? Math.round((qualifiedLeads / totalLeads) * 100) : 0
  const avgDealSize      = deals.length > 0 ? totalRevenue / deals.length : 0

  const stageBreakdown = ['QUALIFICATION', 'PROPOSAL', 'NEGOTIATION', 'CLOSED_WON', 'CLOSED_LOST'].map(stage => ({
    stage,
    count: opportunities.filter(o => o.stage === stage).length,
    value: opportunities.filter(o => o.stage === stage).reduce((s, o) => s + Number(o.value), 0),
  }))

  res.json({
    kpis: {
      totalLeads,
      qualifiedLeads,
      pipelineValue,
      totalRevenue,
      clients,
      pendingTasks: tasks,
      pendingInvoices,
      conversionRate,
      avgDealSize,
      totalDeals: deals.length,
    },
    stageBreakdown,
  })
})

// ── GET /api/analytics/pipeline ────────────────────────────────────────────────
analyticsRouter.get('/pipeline', async (req: AuthRequest, res) => {
  const opps = await prisma.opportunity.findMany({
    where: { companyId: req.user!.companyId },
    select: { stage: true, value: true, probability: true, company: true, title: true, closeDate: true },
    orderBy: { value: 'desc' },
  })
  res.json(opps)
})

// ── GET /api/analytics/revenue ─────────────────────────────────────────────────
analyticsRouter.get('/revenue', async (req: AuthRequest, res) => {
  const invoices = await prisma.invoice.findMany({
    where: { companyId: req.user!.companyId },
    orderBy: { createdAt: 'asc' },
  })

  // Group by month
  const byMonth: Record<string, number> = {}
  for (const inv of invoices) {
    const key = inv.createdAt.toISOString().slice(0, 7) // "2025-01"
    byMonth[key] = (byMonth[key] || 0) + Number(inv.amount)
  }

  const data = Object.entries(byMonth).map(([month, amount]) => ({
    month: new Date(month + '-01').toLocaleString('en', { month: 'short', year: '2-digit' }),
    amount,
  }))

  res.json(data)
})

// ── GET /api/analytics/leads ───────────────────────────────────────────────────
analyticsRouter.get('/leads', async (req: AuthRequest, res) => {
  const leads = await prisma.lead.findMany({
    where:  { companyId: req.user!.companyId },
    select: { status: true, source: true, aiCredibilityScore: true, createdAt: true, value: true },
  })

  const byStatus = ['NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED'].map(status => ({
    status,
    count: leads.filter(l => l.status === status).length,
  }))

  const bySource: Record<string, number> = {}
  for (const l of leads) {
    if (l.source) bySource[l.source] = (bySource[l.source] || 0) + 1
  }

  res.json({ byStatus, bySource: Object.entries(bySource).map(([source, count]) => ({ source, count })) })
})

// ── GET /api/analytics/team ────────────────────────────────────────────────────
analyticsRouter.get('/team', async (req: AuthRequest, res) => {
  const users = await prisma.user.findMany({
    where: { companyId: req.user!.companyId, role: { in: ['SALESPERSON', 'SALES_MANAGER'] } },
    select: { id: true, name: true },
  })

  const stats = await Promise.all(users.map(async (u) => {
    const [leads, opps, tasks] = await Promise.all([
      prisma.lead.count({ where: { assignedToId: u.id } }),
      prisma.opportunity.findMany({ where: { ownerId: u.id } }),
      prisma.task.count({ where: { assignedToId: u.id, status: 'DONE' } }),
    ])
    return {
      name:          u.name,
      leads,
      opportunities: opps.length,
      pipelineValue: opps.reduce((s, o) => s + Number(o.value), 0),
      tasksDone:     tasks,
    }
  }))

  res.json(stats)
})
