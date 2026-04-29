import { Router, Response } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import Groq from 'groq-sdk'
import { extractJSON, MODELS } from '../lib/aiUtils'
import { generateAutoTask } from '../lib/autoTasks'

export const opportunitiesRouter = Router()
opportunitiesRouter.use(authenticate)

let _groq: Groq | null = null
function getGroq() {
  if (_groq) return _groq
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  _groq = new Groq({ apiKey: key })
  return _groq
}

opportunitiesRouter.get('/', async (req: AuthRequest, res: Response) => {
  const opps = await prisma.opportunity.findMany({
    where: { 
      companyId: req.user!.companyId,
      stage: { notIn: ['CLOSED_WON', 'CLOSED_LOST'] }
    },
    include: { owner: { select: { id: true, name: true } } },
    orderBy: { createdAt: 'desc' },
  })
  res.json(opps)
})

opportunitiesRouter.post('/', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res: Response) => {
  const { title, company, value, stage, probability, riskLevel, closeDate, notes } = req.body
  if (!title || !company || !closeDate) {
    res.status(400).json({ error: 'Title, company, and close date are required.' })
    return
  }
  const opp = await prisma.opportunity.create({
    data: {
      title, company,
      value:       parseFloat(value) || 0,
      stage:       stage || 'QUALIFICATION',
      probability: parseInt(probability) || 0,
      riskLevel:   riskLevel || 'LOW',
      closeDate:   new Date(closeDate),
      notes,
      companyId:   req.user!.companyId,
      ownerId:     req.user!.userId,
    }
  })
  res.status(201).json(opp)

  generateAutoTask('OPPORTUNITY', opp, req.user!.companyId, req.user!.userId).catch(console.error)
})

opportunitiesRouter.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res: Response) => {
  const data: Record<string, unknown> = {}
  const fields = ['title', 'company', 'stage', 'probability', 'riskLevel', 'notes', 'ownerId']
  for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f] }
  if (req.body.value       !== undefined) data.value       = parseFloat(req.body.value)
  if (req.body.probability !== undefined) data.probability = parseInt(req.body.probability)
  if (req.body.closeDate   !== undefined) data.closeDate   = new Date(req.body.closeDate)

  const opp = await prisma.opportunity.update({ where: { id: req.params.id }, data })
  res.json(opp)
})

opportunitiesRouter.delete('/:id', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  await prisma.opportunity.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/opportunities/bulk ─────────────────────────────────────────────
opportunitiesRouter.delete('/bulk', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res: Response) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.opportunity.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})

// Generate AI quote for an opportunity
opportunitiesRouter.post('/:id/generate-quote', async (req: AuthRequest, res: Response) => {
  try {
    const opp = await prisma.opportunity.findFirst({ 
      where: { id: req.params.id, companyId: req.user!.companyId } 
    })
    if (!opp) { res.status(404).json({ error: 'Opportunity not found.' }); return }

    console.log(`[AI QUOTE] Generating for ${opp.company} - ${opp.title}`)

    const baseValue = Number(opp.value)
    const groq = getGroq()

    const prompt = `You are a strategic pricing analyst for a GCC-based B2B enterprise CRM.
Generate 3 pricing options for this deal:
Deal: ${opp.title}
Company: ${opp.company}
Target Value: AED ${baseValue.toLocaleString()}
Notes: ${opp.notes || 'No extra notes'}

Options:
1. PRIMARY (Balanced): Competitive but profitable.
2. CONSERVATIVE (Low Risk): Higher chance of winning, lower margin.
3. AGGRESSIVE (High Premium): Maximum value, highlights premium features.

Return ONLY valid JSON in this exact format:
[
  {
    "type": "PRIMARY" | "CONSERVATIVE" | "AGGRESSIVE",
    "multiplier": <float, e.g. 1.0 for primary, 0.9 for conservative>,
    "margin": <integer percentage 10-35>,
    "confidence": <integer percentage 50-95>,
    "justification": "<one concise sentence for the GCC market context>"
  }
]
`

    const completion = await groq.chat.completions.create({
      model: MODELS.LARGE,
      messages: [
        { role: 'system', content: 'You are a pricing API. Return ONLY raw JSON array.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.2,
      max_tokens: 800
    })

    const raw = completion.choices[0]?.message?.content || ''
    const suggestions = extractJSON(raw)

    if (!suggestions || !Array.isArray(suggestions)) {
      throw new Error('AI failed to generate valid pricing structure.')
    }

    // Clear old quotes
    await prisma.aIQuote.deleteMany({ where: { opportunityId: opp.id } })

    const created = await Promise.all(suggestions.map(s => {
      const price = baseValue * (s.multiplier || 1)
      const vat   = price * 0.05
      return prisma.aIQuote.create({
        data: {
          type:          s.type,
          basePrice:     price,
          margin:        s.margin,
          vat:           vat,
          total:         price + vat,
          confidence:    s.confidence,
          justification: s.justification,
          opportunityId: opp.id,
        }
      })
    }))

    res.json(created)
  } catch (err: any) {
    console.error('[AI QUOTE ERROR]:', err.message)
    res.status(500).json({ error: 'AI pricing analysis failed. Please try again.' })
  }
})

// Mark Opportunity as WON (Creates a Deal)
opportunitiesRouter.post('/:id/won', async (req: AuthRequest, res: Response) => {
  try {
    const opp = await prisma.opportunity.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId }
    })
    if (!opp) { res.status(404).json({ error: 'Opportunity not found.' }); return }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Opportunity Stage
      await tx.opportunity.update({
        where: { id: opp.id },
        data: { stage: 'CLOSED_WON', probability: 100 }
      })

      // 2. Find or Create Client
      let client = await tx.client.findFirst({
        where: { name: opp.company, companyId: opp.companyId }
      })

      if (!client) {
        client = await tx.client.create({
          data: {
            name: opp.company,
            companyId: opp.companyId,
            customerStatus: 'CUSTOMER',
            tier: 'SILVER',
            notes: 'Created automatically via Opportunity Win conversion'
          }
        })
      }

      // 3. Create Deal
      const deal = await tx.deal.create({
        data: {
          title: opp.title,
          company: opp.company,
          value: opp.value,
          stage: 'closed_won',
          closedDate: new Date(),
          opportunityId: opp.id,
          clientId: client.id,
          companyId: opp.companyId,
          ownerId: opp.ownerId,
        }
      })

      // 4. Create Activity
      await tx.activity.create({
        data: {
          type: 'DEAL',
          description: `Deal WON: ${opp.title} for ${opp.company}`,
          company: opp.company,
          createdById: req.user!.userId,
          companyId: opp.companyId
        }
      })

      return deal
    })

    res.json(result)

    generateAutoTask('DEAL_WON', opp, opp.companyId, opp.ownerId).catch(console.error)
  } catch (err: any) {
    console.error('[OPP WON ERROR]:', err.message)
    res.status(500).json({ error: 'Failed to mark opportunity as won.' })
  }
})

// Mark Opportunity as LOST
opportunitiesRouter.post('/:id/lost', async (req: AuthRequest, res: Response) => {
  try {
    const opp = await prisma.opportunity.findFirst({
      where: { id: req.params.id, companyId: req.user!.companyId }
    })
    if (!opp) { res.status(404).json({ error: 'Opportunity not found.' }); return }

    const result = await prisma.$transaction(async (tx) => {
      // 1. Update Opportunity Stage
      const updated = await tx.opportunity.update({
        where: { id: opp.id },
        data: { stage: 'CLOSED_LOST', probability: 0 }
      })

      // 2. Create Deal record (even if lost, for historical tracking in Deals page)
      await tx.deal.create({
        data: {
          title: opp.title,
          company: opp.company,
          value: opp.value,
          stage: 'closed_lost',
          closedDate: new Date(),
          opportunityId: opp.id,
          companyId: opp.companyId,
          ownerId: opp.ownerId,
        }
      })

      // 3. Create Activity
      await tx.activity.create({
        data: {
          type: 'DEAL',
          description: `Opportunity LOST: ${opp.title} (${opp.company})`,
          company: opp.company,
          createdById: req.user!.userId,
          companyId: opp.companyId
        }
      })

      return updated
    })

    res.json(result)

    generateAutoTask('DEAL_LOST', opp, opp.companyId, opp.ownerId).catch(console.error)
  } catch (err: any) {
    console.error('[OPP LOST ERROR]:', err.message)
    res.status(500).json({ error: 'Failed to mark opportunity as lost.' })
  }
})
