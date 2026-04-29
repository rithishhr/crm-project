import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import Groq from 'groq-sdk'
import { MODELS } from '../lib/aiUtils'
import { prisma } from '../lib/prisma'
import PDFDocument from 'pdfkit'

export const aiRouter = Router()
aiRouter.use(authenticate)

let _groq: Groq | null = null
function getGroq() {
  if (_groq) return _groq
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  _groq = new Groq({ apiKey: key })
  return _groq
}

aiRouter.get('/status', async (req: AuthRequest, res) => {
  res.json({ configured: !!process.env.GROQ_API_KEY })
})

function daysBetween(a: Date, b: Date) {
  const diff = Math.abs(a.getTime() - b.getTime())
  return Math.max(1, Math.floor(diff / (1000 * 60 * 60 * 24)))
}

function monthRange(offset = 0) {
  const now = new Date()
  const start = new Date(now.getFullYear(), now.getMonth() + offset, 1)
  const end = new Date(now.getFullYear(), now.getMonth() + offset + 1, 1)
  return { start, end }
}

function safeNum(value: any) {
  const num = Number(value || 0)
  return Number.isFinite(num) ? num : 0
}

function percentageChange(current: number, previous: number) {
  if (!previous) return current > 0 ? 100 : 0
  return ((current - previous) / previous) * 100
}

aiRouter.get('/agent/dashboard-summary', async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.userId
    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Company context missing' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { name: true, lastLogin: true, role: true } })
    const now = new Date()
    const lastLogin = user?.lastLogin || new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const awayDays = daysBetween(now, lastLogin)

    const { start: monthStart, end: nextMonthStart } = monthRange(0)
    const { start: prevMonthStart, end: prevMonthEnd } = monthRange(-1)

    const [
      totalClients,
      activeClients,
      newClientsSinceLastLogin,
      totalLeads,
      hotLeads,
      warmLeads,
      coldLeads,
      leadsWon,
      leadsLost,
      pendingFollowUps,
      upcomingMeetings,
      tasksCompleted,
      tasksOverdue,
      emailsSent,
      recentActivities,
      dealsClosedThisMonth,
      dealsClosedPrevMonth,
      leadsThisMonth,
      leadsPrevMonth,
      highestValueClient,
      teamStats,
      inactiveClients,
      monthDeals,
      prevMonthDeals,
    ] = await Promise.all([
      prisma.client.count({ where: { companyId } }),
      prisma.client.count({ where: { companyId, customerStatus: { not: 'INACTIVE' } } }),
      prisma.client.count({ where: { companyId, createdAt: { gt: lastLogin } } }),
      prisma.lead.count({ where: { companyId } }),
      prisma.lead.count({ where: { companyId, priority: { in: ['HIGH', 'CRITICAL'] } } }),
      prisma.lead.count({ where: { companyId, priority: 'MEDIUM' } }),
      prisma.lead.count({ where: { companyId, priority: 'LOW' } }),
      prisma.opportunity.count({ where: { companyId, stage: 'CLOSED_WON' } }),
      prisma.opportunity.count({ where: { companyId, stage: 'CLOSED_LOST' } }),
      prisma.task.count({ where: { companyId, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
      prisma.task.count({
        where: {
          companyId,
          dueDate: { gte: now, lt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) },
          OR: [
            { title: { contains: 'meeting' } },
            { relatedTo: { contains: 'meeting' } },
            { title: { contains: 'call' } },
          ],
        },
      }),
      prisma.task.count({ where: { companyId, status: 'DONE' } }),
      prisma.task.count({ where: { companyId, dueDate: { lt: now }, status: { not: 'DONE' } } }),
      prisma.activity.count({ where: { companyId, type: { equals: 'EMAIL', mode: 'insensitive' as any } } as any }),
      prisma.activity.findMany({
        where: { companyId },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: { id: true, type: true, description: true, createdAt: true, contact: true, company: true },
      }),
      prisma.deal.count({ where: { companyId, closedDate: { gte: monthStart, lt: nextMonthStart } } }),
      prisma.deal.count({ where: { companyId, closedDate: { gte: prevMonthStart, lt: prevMonthEnd } } }),
      prisma.lead.count({ where: { companyId, createdAt: { gte: monthStart, lt: nextMonthStart } } }),
      prisma.lead.count({ where: { companyId, createdAt: { gte: prevMonthStart, lt: prevMonthEnd } } }),
      prisma.client.findFirst({ where: { companyId }, orderBy: { totalRevenue: 'desc' }, select: { id: true, name: true, totalRevenue: true } }),
      prisma.user.findMany({
        where: { companyId, status: 'ACTIVE' },
        select: {
          id: true,
          name: true,
          role: true,
          opportunities: {
            where: { stage: 'CLOSED_WON' },
            select: { id: true, value: true },
          },
          tasks: {
            select: { id: true, status: true, dueDate: true },
          },
        },
      }),
      prisma.client.findMany({ where: { companyId, activeDeals: 0 }, orderBy: { updatedAt: 'asc' }, take: 3, select: { id: true, name: true, updatedAt: true } }),
      prisma.deal.findMany({ where: { companyId, closedDate: { gte: monthStart, lt: nextMonthStart } }, select: { value: true } }),
      prisma.deal.findMany({ where: { companyId, closedDate: { gte: prevMonthStart, lt: prevMonthEnd } }, select: { value: true } }),
    ])

    const revenueGenerated = monthDeals.reduce((sum, d) => sum + safeNum(d.value), 0)
    const prevRevenue = prevMonthDeals.reduce((sum, d) => sum + safeNum(d.value), 0)

    const bestEmployee = teamStats
      .map((u: any) => {
        const wonCount = u.opportunities.length
        const wonValue = u.opportunities.reduce((sum: number, opp: any) => sum + safeNum(opp.value), 0)
        const completedTasks = u.tasks.filter((t: any) => t.status === 'DONE').length
        const overdueTasks = u.tasks.filter((t: any) => t.status !== 'DONE' && new Date(t.dueDate) < now).length
        const productivityScore = wonCount * 20 + Math.floor(wonValue / 10000) + completedTasks * 2 - overdueTasks * 3
        return {
          id: u.id,
          name: u.name,
          role: u.role,
          wonCount,
          wonValue,
          completedTasks,
          overdueTasks,
          productivityScore,
        }
      })
      .sort((a: any, b: any) => b.productivityScore - a.productivityScore)[0] || null

    const leadsGrowthPct = percentageChange(leadsThisMonth, leadsPrevMonth)
    const revenueGrowthPct = percentageChange(revenueGenerated, prevRevenue)
    const lostDealRatio = leadsWon + leadsLost > 0 ? (leadsLost / (leadsWon + leadsLost)) * 100 : 0

    const trends: string[] = []
    trends.push(`Leads ${leadsGrowthPct >= 0 ? 'increased' : 'decreased'} by ${Math.abs(leadsGrowthPct).toFixed(1)}% compared with last month.`)
    trends.push(`Revenue ${revenueGrowthPct >= 0 ? 'improved' : 'declined'} by ${Math.abs(revenueGrowthPct).toFixed(1)}% month over month.`)
    if (lostDealRatio >= 40) trends.push('Lost deals are high this period and need immediate attention.')
    if (tasksOverdue >= 5) trends.push('Follow-up delays may be reducing conversion rates.')
    if (inactiveClients.length > 0) trends.push(`${inactiveClients.length} inactive clients need re-engagement.`)

    const recommendations: string[] = []
    if (hotLeads > 0) recommendations.push(`Contact ${Math.min(hotLeads, 5)} hot leads immediately.`)
    if (tasksOverdue > 0) recommendations.push('Reassign or close overdue tasks within 24 hours.')
    if (leadsLost > 0) recommendations.push('Run follow-up campaign for recently lost prospects.')
    recommendations.push('Focus effort on top converting source channels and highest value prospects.')

    const greeting = `Welcome back ${user?.name?.split(' ')[0] || 'there'}, here is what happened while you were away.`
    const baseSummaryText = `${greeting}\n\nIn the last ${awayDays} day(s), you now have ${totalClients} clients and ${totalLeads} total leads. This month closed deals: ${dealsClosedThisMonth}. Revenue generated: AED ${revenueGenerated.toLocaleString()}. Leads won: ${leadsWon}, leads lost: ${leadsLost}. Pending follow-ups: ${pendingFollowUps}.`

    let aiNarrative = ''

    // Local fallback narrative generator in case GROQ key is not configured
    const generateLocalNarrative = () => {
      const overview = [`In the last ${awayDays} day(s), there are ${totalClients} clients and ${totalLeads} leads.`]
      overview.push(`This month closed deals: ${dealsClosedThisMonth}, revenue: AED ${revenueGenerated.toLocaleString()}.`)

      const trendLines = trends.length ? trends.slice(0, 3) : ['No clear trends detected.']

      const risks: string[] = []
      if ((tasksOverdue || 0) >= 5) risks.push('Multiple overdue tasks may be impacting conversions.')
      if ((leadsLost || 0) > (leadsWon || 0)) risks.push('Lost deals exceed won deals; investigate pipeline leaks.')
      if (inactiveClients.length > 0) risks.push(`${inactiveClients.length} inactive clients may need re-engagement.`)
      if (!risks.length) risks.push('No immediate high risks detected.')

      const recs = []
      if (hotLeads > 0) recs.push(`Contact top ${Math.min(hotLeads, 5)} hot leads.`)
      if (tasksOverdue > 0) recs.push('Clear or reassign overdue tasks within 24 hours.')
      if (recs.length === 0) recs.push('Maintain current focus on high-value prospects.')

      return `Overview:\n${overview.join(' ')}\n\nTrend Signals:\n- ${trendLines.join('\n- ')}\n\nRisks:\n- ${risks.join('\n- ')}\n\nRecommended Actions:\n- ${recs.join('\n- ')}`
    }

    if (process.env.GROQ_API_KEY) {
      try {
        const groq = getGroq()
        const completion = await groq.chat.completions.create({
          model: MODELS.SMALL,
          messages: [
            {
              role: 'system',
              content: 'You are GCC360 Smart CRM Analytics AI. Produce concise executive summary in 4 short sections: Overview, Trend Signals, Risks, Recommended Actions. Keep it professional and practical.',
            },
            {
              role: 'user',
              content: JSON.stringify({
                greeting,
                awayDays,
                metrics: {
                  totalClients,
                  activeClients,
                  newClientsSinceLastLogin,
                  totalLeads,
                  hotLeads,
                  warmLeads,
                  coldLeads,
                  leadsWon,
                  leadsLost,
                  pendingFollowUps,
                  upcomingMeetings,
                  dealsClosedThisMonth,
                  revenueGenerated,
                  tasksCompleted,
                  tasksOverdue,
                  emailsSent,
                },
                trends,
                recommendations,
              }),
            },
          ],
          temperature: 0.3,
          max_tokens: 380,
        })
        aiNarrative = completion.choices[0]?.message?.content || ''
      } catch (err: any) {
        console.error('[AI GROQ COMPLETION ERROR]:', err?.message || err)
        aiNarrative = generateLocalNarrative()
      }
    } else {
      // GROQ key missing — fall back to local summarizer so dashboard remains useful
      aiNarrative = generateLocalNarrative()
    }

    return res.json({
      greeting,
      awayDays,
      generatedAt: now.toISOString(),
      summaryText: baseSummaryText,
      aiNarrative,
      metrics: {
        totalClients,
        activeClients,
        newClientsSinceLastLogin,
        totalLeads,
        hotLeads,
        warmLeads,
        coldLeads,
        leadsWon,
        leadsLost,
        pendingFollowUps,
        upcomingMeetings,
        dealsClosedThisMonth,
        revenueGenerated,
        highestValueClient: highestValueClient ? { ...highestValueClient, totalRevenue: safeNum(highestValueClient.totalRevenue) } : null,
        bestEmployee,
        tasksCompleted,
        tasksOverdue,
        emailsSent,
      },
      trends,
      recommendations,
      recentActivities: recentActivities.map(activity => ({
        id: activity.id,
        type: activity.type,
        description: activity.description,
        createdAt: activity.createdAt,
        contact: activity.contact,
        company: activity.company,
      })),
      charts: {
        leadTemperature: [
          { label: 'Hot', count: hotLeads },
          { label: 'Warm', count: warmLeads },
          { label: 'Cold', count: coldLeads },
        ],
        taskHealth: [
          { label: 'Completed', count: tasksCompleted },
          { label: 'Overdue', count: tasksOverdue },
          { label: 'Pending', count: pendingFollowUps },
        ],
      },
    })
  } catch (err: any) {
    console.error('[AI DASHBOARD SUMMARY ERROR]:', err.message)
    return res.status(500).json({ error: 'Failed to build dashboard summary' })
  }
})

aiRouter.get('/agent/dashboard-summary/pdf', async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId
    const userId = req.user?.userId
    if (!companyId || !userId) {
      return res.status(401).json({ error: 'Company context missing' })
    }

    const [totalClients, totalLeads, monthDeals, leadsWon, leadsLost, pendingFollowUps] = await Promise.all([
      prisma.client.count({ where: { companyId } }),
      prisma.lead.count({ where: { companyId } }),
      prisma.deal.findMany({ where: { companyId, closedDate: { gte: monthRange(0).start, lt: monthRange(0).end } }, select: { value: true } }),
      prisma.opportunity.count({ where: { companyId, stage: 'CLOSED_WON' } }),
      prisma.opportunity.count({ where: { companyId, stage: 'CLOSED_LOST' } }),
      prisma.task.count({ where: { companyId, status: { in: ['TODO', 'IN_PROGRESS'] } } }),
    ])

    const revenueGenerated = monthDeals.reduce((sum, d) => sum + safeNum(d.value), 0)
    const summaryRes: any = {
      generatedAt: new Date().toISOString(),
      greeting: 'GCC360 Smart CRM Analytics Summary',
      summaryText: `Current snapshot: ${totalClients} clients, ${totalLeads} leads, ${leadsWon} won opportunities, ${leadsLost} lost opportunities, ${pendingFollowUps} pending follow-ups, and AED ${revenueGenerated.toLocaleString()} generated this month.`,
      metrics: {
        totalClients,
        totalLeads,
        leadsWon,
        leadsLost,
        pendingFollowUps,
        revenueGenerated,
      },
      trends: [],
      recommendations: [
        'Prioritize hot leads and overdue tasks.',
        'Run re-engagement for inactive/lost prospects.',
      ],
      aiNarrative: '',
    }

    res.setHeader('Content-Type', 'application/pdf')
    res.setHeader('Content-Disposition', `attachment; filename="crm-ai-summary-${new Date().toISOString().slice(0, 10)}.pdf"`)

    const doc = new PDFDocument({ margin: 40 })
    doc.pipe(res)

    doc.fontSize(18).text('GCC360 Smart CRM Analytics Summary', { underline: true })
    doc.moveDown(0.5)
    doc.fontSize(10).fillColor('#6b7280').text(`Generated: ${new Date(summaryRes.generatedAt).toLocaleString()}`)
    doc.moveDown(1)

    doc.fillColor('#111827').fontSize(12).text(summaryRes.greeting)
    doc.moveDown(0.8)

    doc.fontSize(11).text('Executive Summary')
    doc.fontSize(10).fillColor('#111827').text(summaryRes.summaryText)
    if (summaryRes.aiNarrative) {
      doc.moveDown(0.5)
      doc.fontSize(10).text(summaryRes.aiNarrative)
    }

    doc.moveDown(0.8)
    doc.fontSize(11).text('Key Metrics')
    Object.entries(summaryRes.metrics || {}).forEach(([key, value]) => {
      if (typeof value === 'object') return
      doc.fontSize(10).text(`- ${key}: ${value}`)
    })

    doc.moveDown(0.8)
    doc.fontSize(11).text('Trend Signals')
    ;(summaryRes.trends || []).forEach((line: string) => doc.fontSize(10).text(`- ${line}`))

    doc.moveDown(0.8)
    doc.fontSize(11).text('Recommendations')
    ;(summaryRes.recommendations || []).forEach((line: string) => doc.fontSize(10).text(`- ${line}`))

    doc.end()
  } catch (err: any) {
    console.error('[AI DASHBOARD PDF ERROR]:', err.message)
    return res.status(500).json({ error: 'Failed to export dashboard summary' })
  }
})

aiRouter.get('/agent/admin-insights', async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId
    const role = String(req.user?.role || '').toUpperCase()
    if (!companyId) return res.status(401).json({ error: 'Company context missing' })
    if (!['ADMIN', 'MANAGER', 'SALES_MANAGER'].includes(role)) {
      return res.status(403).json({ error: 'Admin insights are restricted to admin/manager roles' })
    }

    const users = await prisma.user.findMany({
      where: { companyId, status: 'ACTIVE' },
      select: {
        id: true,
        name: true,
        role: true,
        opportunities: {
          select: { stage: true, value: true, createdAt: true },
        },
        tasks: {
          select: { status: true, dueDate: true },
        },
      },
    })

    const now = new Date()
    const employeeProductivity = users.map((u: any) => {
      const won = u.opportunities.filter((o: any) => o.stage === 'CLOSED_WON')
      const lost = u.opportunities.filter((o: any) => o.stage === 'CLOSED_LOST')
      const overdue = u.tasks.filter((t: any) => t.status !== 'DONE' && new Date(t.dueDate) < now)
      const done = u.tasks.filter((t: any) => t.status === 'DONE')
      const wonValue = won.reduce((sum: number, item: any) => sum + safeNum(item.value), 0)
      return {
        id: u.id,
        name: u.name,
        role: u.role,
        wonDeals: won.length,
        lostDeals: lost.length,
        wonValue,
        tasksDone: done.length,
        overdueTasks: overdue.length,
        score: won.length * 20 + Math.floor(wonValue / 10000) + done.length * 2 - overdue.length * 3,
      }
    }).sort((a, b) => b.score - a.score)

    const topPerformer = employeeProductivity[0] || null
    const missedFollowUps = employeeProductivity
      .filter(e => e.overdueTasks > 0)
      .map(e => ({ name: e.name, overdueTasks: e.overdueTasks }))

    res.json({
      topPerformer,
      weakPipelineAreas: {
        lostVsWonGap: employeeProductivity.reduce((sum, e) => sum + e.lostDeals - e.wonDeals, 0),
        totalOverdueTasks: employeeProductivity.reduce((sum, e) => sum + e.overdueTasks, 0),
      },
      productivityReport: employeeProductivity,
      missedFollowUps,
      recommendations: [
        'Coach employees with high overdue follow-ups.',
        'Prioritize high-value opportunities for top performers.',
        'Review lead source attribution for conversion quality.',
      ],
    })
  } catch (err: any) {
    console.error('[AI ADMIN INSIGHTS ERROR]:', err.message)
    return res.status(500).json({ error: 'Failed to build admin insights' })
  }
})

async function buildCompanyDataSummary(companyId: string) {
  const [
    leads,
    opportunities,
    deals,
    clients,
    contacts,
    tasks,
    activities,
    invoices,
    users,
    notifications,
    leadStatus,
    opportunityStages,
    invoiceStatus,
  ] = await Promise.all([
    prisma.lead.count({ where: { companyId } }),
    prisma.opportunity.count({ where: { companyId } }),
    prisma.deal.count({ where: { companyId } }),
    prisma.client.count({ where: { companyId } }),
    prisma.contact.count({ where: { companyId } }),
    prisma.task.count({ where: { companyId } }),
    prisma.activity.count({ where: { companyId } }),
    prisma.invoice.count({ where: { companyId } }),
    prisma.user.count({ where: { companyId } }),
    prisma.notification.count({ where: { companyId } }),
    prisma.lead.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
    prisma.opportunity.groupBy({ by: ['stage'], where: { companyId }, _count: { _all: true } }),
    prisma.invoice.groupBy({ by: ['status'], where: { companyId }, _count: { _all: true } }),
  ])

  return {
    generatedAt: new Date().toISOString(),
    entityCounts: {
      leads,
      opportunities,
      deals,
      clients,
      contacts,
      tasks,
      activities,
      invoices,
      users,
      notifications,
    },
    breakdowns: {
      leadStatus: leadStatus.map(row => ({ key: row.status, count: row._count._all })),
      opportunityStages: opportunityStages.map(row => ({ key: row.stage, count: row._count._all })),
      invoiceStatus: invoiceStatus.map(row => ({ key: row.status, count: row._count._all })),
    },
  }
}

aiRouter.get('/data-summary', async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(401).json({ error: 'Company context missing' })
    }

    const summary = await buildCompanyDataSummary(companyId)
    res.json(summary)
  } catch (err: any) {
    console.error('[AI DATA SUMMARY ERROR]:', err.message)
    res.status(500).json({ error: 'Failed to generate data summary' })
  }
})

aiRouter.get('/data-insights', async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(401).json({ error: 'Company context missing' })
    }

    const scope = String(req.query.scope || 'full').toLowerCase()
    const summary = await buildCompanyDataSummary(companyId)

    if (!process.env.GROQ_API_KEY) {
      return res.json({
        scope,
        mode: 'fallback',
        insight: 'AI key is not configured. Showing deterministic CRM summary only.',
        summary,
      })
    }

    const groq = getGroq()
    const completion = await groq.chat.completions.create({
      model: MODELS.SMALL,
      messages: [
        {
          role: 'system',
          content: 'You are GCC360 CRM Summary Assistant. Analyze CRM metrics and provide concise executive English summary with: 1) key highlights, 2) risk signals, 3) actionable recommendations. Keep it simple and professional.',
        },
        {
          role: 'user',
          content: `Scope: ${scope}\n\nData:\n${JSON.stringify(summary)}`,
        },
      ],
      temperature: 0.3,
      max_tokens: 420,
    })

    const insight = completion.choices[0]?.message?.content || 'No insight generated.'
    res.json({ scope, mode: 'ai', insight, summary })
  } catch (err: any) {
    console.error('[AI DATA INSIGHTS ERROR]:', err.message)
    res.status(500).json({ error: 'Failed to generate data insights' })
  }
})

aiRouter.post('/data-query', async (req: AuthRequest, res) => {
  try {
    const companyId = req.user?.companyId
    if (!companyId) {
      return res.status(401).json({ error: 'Company context missing' })
    }

    const query = String(req.body?.query || '').trim()
    if (!query) {
      return res.status(400).json({ error: 'Query is required' })
    }

    const q = query.toLowerCase()
    const summary = await buildCompanyDataSummary(companyId)

    const dealStages = await prisma.deal.groupBy({
      by: ['stage'],
      where: { companyId },
      _count: { _all: true },
    })

    const wonDeals = dealStages
      .filter(row => row.stage.toLowerCase().includes('won') || row.stage.toLowerCase().includes('closed_won'))
      .reduce((acc, row) => acc + row._count._all, 0)

    const cancelledDeals = dealStages
      .filter(row => row.stage.toLowerCase().includes('cancel') || row.stage.toLowerCase().includes('lost') || row.stage.toLowerCase().includes('closed_lost'))
      .reduce((acc, row) => acc + row._count._all, 0)

    const startOfMonth = new Date()
    startOfMonth.setDate(1)
    startOfMonth.setHours(0, 0, 0, 0)

    const thisMonthLeads = await prisma.lead.count({
      where: {
        companyId,
        createdAt: { gte: startOfMonth },
      },
    })

    let shortSummary = 'Here is your CRM data summary.'
    let details: any = {
      query,
      metrics: {
        wonDeals,
        cancelledDeals,
        thisMonthLeads,
      },
      summary,
    }

    if (q.includes('cancel')) {
      shortSummary = `Cancelled/Lost deals: ${cancelledDeals}`
      details = {
        query,
        focus: 'deals-cancelled',
        cancelledDeals,
        dealStageBreakdown: dealStages.map(row => ({ stage: row.stage, count: row._count._all })),
      }
    } else if (q.includes('won') || q.includes('closed won') || q.includes('total won')) {
      shortSummary = `Total won deals: ${wonDeals}`
      details = {
        query,
        focus: 'deals-won',
        wonDeals,
        dealStageBreakdown: dealStages.map(row => ({ stage: row.stage, count: row._count._all })),
      }
    } else if (q.includes('month') && q.includes('lead')) {
      shortSummary = `Leads this month: ${thisMonthLeads}`
      details = {
        query,
        focus: 'leads-this-month',
        thisMonthLeads,
        fromDate: startOfMonth.toISOString(),
      }
    } else if (q.includes('whole crm') || q.includes('overall') || q.includes('summary')) {
      shortSummary = `CRM Snapshot: ${summary.entityCounts.leads} leads, ${summary.entityCounts.opportunities} opportunities, ${summary.entityCounts.deals} deals, ${summary.entityCounts.clients} clients.`
      details = {
        query,
        focus: 'whole-crm',
        metrics: {
          wonDeals,
          cancelledDeals,
          thisMonthLeads,
        },
        summary,
      }
    }

    res.json({
      query,
      shortSummary,
      details,
    })
  } catch (err: any) {
    console.error('[AI DATA QUERY ERROR]:', err.message)
    res.status(500).json({ error: 'Failed to process data query' })
  }
})

function cleanDraftLine(value: string) {
  return value.trim().replace(/^subject\s*:\s*/i, '').replace(/^body\s*:\s*/i, '')
}

function parseDraftResponse(content: string) {
  const subjectMatch = content.match(/subject\s*:\s*(.+)/i)
  const bodyMatch = content.match(/body\s*:\s*([\s\S]+)/i)

  const subject = subjectMatch ? cleanDraftLine(subjectMatch[1].split(/\n/)[0]) : ''
  const body = bodyMatch ? bodyMatch[1].trim() : ''

  if (subject && body) return { subject, body }

  const parts = content.split(/\n\s*\n/)
  return {
    subject: subject || cleanDraftLine(parts[0] || 'Draft email'),
    body: body || parts.slice(1).join('\n\n').trim() || content.trim(),
  }
}

function buildDraftPrompt(recordType: string, record: any, purpose?: string) {
  const goal = purpose?.trim() || 'a helpful sales follow-up'

  if (recordType === 'lead') {
    return `Write ${goal} email for this lead. Keep it professional, concise, and tailored to the details below. Return exactly two sections labeled SUBJECT and BODY.

Lead details:
- Company: ${record.company}
- Contact name: ${record.contactName}
- Email: ${record.email}
- Phone: ${record.phone || 'N/A'}
- Industry: ${record.industry || 'N/A'}
- Source: ${record.source || 'N/A'}
- Value: ${record.value || 'N/A'}
- Timeline: ${record.expectedTimeline || 'N/A'}
- Requirements: ${record.requirements || 'N/A'}
- Notes: ${record.internalNotes || record.aiNotes || 'N/A'}`
  }

  if (recordType === 'client') {
    return `Write ${goal} email for this client. Keep it professional, concise, and tailored to the details below. Return exactly two sections labeled SUBJECT and BODY.

Client details:
- Company: ${record.name}
- Primary contact: ${record.contactPerson || 'N/A'}
- Contact title: ${record.contactTitle || 'N/A'}
- Email: ${record.email || 'N/A'}
- Phone: ${record.phone || 'N/A'}
- Industry: ${record.industry || 'N/A'}
- Country: ${record.country || 'N/A'}
- Status: ${record.customerStatus || 'N/A'}
- Notes: ${record.notes || 'N/A'}`
  }

  if (recordType === 'contact') {
    return `Write ${goal} email for this contact. Keep it professional, concise, and tailored to the details below. Return exactly two sections labeled SUBJECT and BODY.

Contact details:
- Name: ${record.firstName} ${record.lastName}
- Company: ${record.company || record.clientRef?.name || 'N/A'}
- Job title: ${record.jobTitle || 'N/A'}
- Department: ${record.department || 'N/A'}
- Email: ${record.email}
- Phone: ${record.phone || record.mobile || 'N/A'}
- Status: ${record.status || 'N/A'}
- Notes: ${record.notes || 'N/A'}`
  }

  throw new Error('Unsupported record type')
}

aiRouter.post('/draft-email', async (req: AuthRequest, res) => {
  try {
    const { recordId, recordType, purpose } = req.body || {}

    if (!recordId || !recordType) {
      return res.status(400).json({ error: 'recordId and recordType are required' })
    }

    const groq = getGroq()
    let record: any = null

    if (recordType === 'lead') {
      record = await prisma.lead.findUnique({ where: { id: recordId } })
    } else if (recordType === 'client') {
      record = await prisma.client.findUnique({ where: { id: recordId } })
    } else if (recordType === 'contact') {
      record = await prisma.contact.findUnique({ where: { id: recordId }, include: { clientRef: true } })
    } else {
      return res.status(400).json({ error: 'Invalid recordType' })
    }

    if (!record) {
      return res.status(404).json({ error: 'Record not found' })
    }

    const prompt = buildDraftPrompt(recordType, record, purpose)

    const completion = await groq.chat.completions.create({
      model: MODELS.SMALL,
      messages: [
        {
          role: 'system',
          content: 'You write concise business emails. Always return a SUBJECT line and a BODY section. Do not add markdown bullets or extra commentary.',
        },
        { role: 'user', content: prompt },
      ],
      temperature: 0.5,
      max_tokens: 350,
    })

    const content = completion.choices[0]?.message?.content || ''
    const parsed = parseDraftResponse(content)

    res.json({
      subject: parsed.subject || `Re: ${record.company || record.name || record.contactName || 'Your inquiry'}`,
      body: parsed.body || 'Hello,\n\nThank you for reaching out. I wanted to follow up and see how I can help.',
    })
  } catch (err: any) {
    console.error('[AI DRAFT ERROR]:', err.message)
    res.status(500).json({ error: 'AI draft failed' })
  }
})

aiRouter.post('/chat', async (req: AuthRequest, res) => {
  try {
    const { message, history, language } = req.body
    const groq = getGroq()

    const systemPrompt = `You are the GCC360 CRM Guide Bot, a professional and helpful support agent for using the GCC360 CRM interface.
    Your goal is to guide users on navigation, workflows, and feature usage.
    
    KEY FEATURES OF GCC360 CRM:
    - DASHBOARD: Real-time overview of KPIs, revenue, and recent activities.
    - LEADS: Automates lead extraction from emails. Leads can be Qualified (moves to Opportunity) or Approved (creates Client & Contact).
    - OPPORTUNITIES: Manage your sales pipeline. Features an "AI Quote Generator" that uses Groq to analyze deals and suggest pricing.
    - DEALS: Track finalized transactions. Offers an "AI Deal Summary" PDF export.
    - FINANCE: Manage invoices and revenue tracking.
    - CLIENTS/CONTACTS: Centralized relationship management.
    - ANALYTICS: Deep dive into team performance and revenue trends.
    - BIOMETRIC LOGIN: Support for FaceID secure authentication.
    
    GUIDELINES:
    - Keep responses concise, professional, and friendly.
    - Reply in this language code when possible: ${String(language || 'en')}.
    - Use GCC/Middle East business context where relevant.
    - If a user asks how to do something, give step-by-step instructions.
    - Focus on product guidance, not database analytics.
    - DO NOT reveal technical secrets or internal code.
    - Always refer to yourself as the GCC360 CRM Guide Bot.`

    const chatMessages = [
      { role: 'system', content: systemPrompt },
      ...(history || []).slice(-10).map((h: any) => ({ role: h.role, content: h.content })),
      { role: 'user', content: message }
    ]

    const completion = await groq.chat.completions.create({
      model: MODELS.LARGE,
      messages: chatMessages,
      temperature: 0.7,
      max_tokens: 500,
    })

    const reply = completion.choices[0]?.message?.content || 'I apologize, but I am unable to process that right now.'
    res.json({ reply })
  } catch (err: any) {
    console.error('[AI CHAT ERROR]:', err.message)
    res.status(500).json({ error: 'AI processing failed' })
  }
})

export async function runDealRiskAnalysis(companyId: string) {
  try {
    const opps = await prisma.opportunity.findMany({ where: { companyId, stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] } } })
    if (opps.length === 0) return

    const groq = getGroq()
    for (const opp of opps) {
      const prompt = `Analyse the risk of this deal:
      Title: ${opp.title}
      Value: ${opp.value}
      Notes: ${opp.notes}
      Current Probability: ${opp.probability}%
      
      Predict the risk level (LOW, MEDIUM, HIGH) and give a brief reason.`
      
      const completion = await groq.chat.completions.create({
        model: MODELS.SMALL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 100
      })
      
      const analysis = completion.choices[0]?.message?.content || ''
      const riskLevel = analysis.toUpperCase().includes('HIGH') ? 'HIGH' : analysis.toUpperCase().includes('MEDIUM') ? 'MEDIUM' : 'LOW'
      
      await prisma.opportunity.update({
        where: { id: opp.id },
        data: { riskLevel, notes: `${opp.notes || ''}\n\n[AI Risk Check]: ${analysis}` }
      })
    }
  } catch (err) {
    console.error('Risk analysis failed:', err)
  }
}
