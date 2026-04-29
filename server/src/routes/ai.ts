import express from 'express';
import { getDb } from '../db';
import { authenticateToken } from '../auth';

const router = express.Router();

function getBusinessContext() {
  const db = getDb();

  const totalLeads = (db.prepare('SELECT COUNT(*) as count FROM leads').get() as any).count;
  const qualifiedLeads = (db.prepare("SELECT COUNT(*) as count FROM leads WHERE status='qualified'").get() as any).count;
  const totalClients = (db.prepare('SELECT COUNT(*) as count FROM clients').get() as any).count;
  const totalRevenue = (db.prepare("SELECT COALESCE(SUM(value),0) as total FROM deals WHERE stage='closed_won'").get() as any).total;
  const openDeals = (db.prepare("SELECT COUNT(*) as count FROM deals WHERE stage NOT IN ('closed_won','closed_lost')").get() as any).count;
  const openDealsValue = (db.prepare("SELECT COALESCE(SUM(value),0) as total FROM deals WHERE stage NOT IN ('closed_won','closed_lost')").get() as any).total;
  const pendingTasks = (db.prepare("SELECT COUNT(*) as count FROM tasks WHERE status='pending'").get() as any).count;

  const dealsByStage = db.prepare(
    "SELECT stage, COUNT(*) as count, COALESCE(SUM(value),0) as total FROM deals GROUP BY stage"
  ).all() as any[];

  return { totalLeads, qualifiedLeads, totalClients, totalRevenue, openDeals, openDealsValue, pendingTasks, dealsByStage };
}

function buildMockSummary(ctx: ReturnType<typeof getBusinessContext>): string {
  const convRate = ctx.totalLeads > 0 ? ((ctx.qualifiedLeads / ctx.totalLeads) * 100).toFixed(1) : '0';
  const stagesSummary = ctx.dealsByStage.map((s: any) => `${s.stage}: ${s.count} deals ($${s.total.toLocaleString()})`).join(', ');
  return `📊 **Business Performance Summary**

**Pipeline Overview:**
- Total Leads: ${ctx.totalLeads} (${ctx.qualifiedLeads} qualified, ${convRate}% conversion rate)
- Active Clients: ${ctx.totalClients}
- Open Deals: ${ctx.openDeals} worth $${ctx.openDealsValue.toLocaleString()}
- Closed Revenue: $${ctx.totalRevenue.toLocaleString()}
- Pending Tasks: ${ctx.pendingTasks}

**Deal Stages:** ${stagesSummary}

**Key Insights:**
${ctx.openDealsValue > 100000 ? '✅ Strong pipeline value - focus on closing open deals' : '⚠️ Pipeline needs more deals - increase prospecting'}
${ctx.qualifiedLeads > 3 ? '✅ Good lead qualification rate' : '📌 Work on qualifying more leads'}
${ctx.pendingTasks > 5 ? '⚠️ Multiple pending tasks - prioritize follow-ups' : '✅ Task load is manageable'}

I'm your AI assistant. Ask me anything about your CRM data!`;
}

router.post('/summary', authenticateToken, async (req, res) => {
  const ctx = getBusinessContext();

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
    return res.json({ summary: buildMockSummary(ctx), mock: true });
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const prompt = `You are a CRM business analyst. Analyze the following CRM data and provide a concise business performance summary with key insights and recommendations:

CRM Data:
- Total Leads: ${ctx.totalLeads} (${ctx.qualifiedLeads} qualified)
- Active Clients: ${ctx.totalClients}
- Total Closed Revenue: $${ctx.totalRevenue}
- Open Deals: ${ctx.openDeals} worth $${ctx.openDealsValue}
- Pending Tasks: ${ctx.pendingTasks}
- Deals by Stage: ${JSON.stringify(ctx.dealsByStage)}

Provide a 150-word summary with actionable insights.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: prompt }],
      max_tokens: 300,
    });

    return res.json({ summary: completion.choices[0].message.content, mock: false });
  } catch (err) {
    return res.json({ summary: buildMockSummary(ctx), mock: true });
  }
});

router.post('/chat', authenticateToken, async (req, res) => {
  const { message } = req.body;
  if (!message) return res.status(400).json({ error: 'Message required' });

  const ctx = getBusinessContext();

  if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY.startsWith('sk-your')) {
    const mockResponses: { [key: string]: string } = {
      lead: `You have ${ctx.totalLeads} total leads, with ${ctx.qualifiedLeads} qualified. Your conversion rate is ${ctx.totalLeads > 0 ? ((ctx.qualifiedLeads / ctx.totalLeads) * 100).toFixed(1) : 0}%.`,
      client: `You have ${ctx.totalClients} active clients. Focus on upselling to existing clients to maximize revenue.`,
      deal: `There are ${ctx.openDeals} open deals worth $${ctx.openDealsValue.toLocaleString()}. Your closed revenue is $${ctx.totalRevenue.toLocaleString()}.`,
      task: `You have ${ctx.pendingTasks} pending tasks. Prioritize high-priority items to move deals forward.`,
      revenue: `Total closed revenue is $${ctx.totalRevenue.toLocaleString()}. Your pipeline has $${ctx.openDealsValue.toLocaleString()} in potential value.`,
      performance: `Overall performance: ${ctx.totalLeads} leads, ${ctx.totalClients} clients, $${ctx.totalRevenue.toLocaleString()} revenue closed with ${ctx.openDeals} deals in progress.`,
    };

    const lowerMsg = message.toLowerCase();
    for (const [key, response] of Object.entries(mockResponses)) {
      if (lowerMsg.includes(key)) {
        return res.json({ response, mock: true });
      }
    }

    return res.json({
      response: `Based on your CRM data: You have ${ctx.totalLeads} leads, ${ctx.totalClients} clients, ${ctx.openDeals} open deals worth $${ctx.openDealsValue.toLocaleString()}, and $${ctx.totalRevenue.toLocaleString()} in closed revenue. How can I help you analyze this further?`,
      mock: true
    });
  }

  try {
    const { default: OpenAI } = await import('openai');
    const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

    const systemPrompt = `You are a helpful CRM assistant. You have access to this business data:
- Total Leads: ${ctx.totalLeads} (${ctx.qualifiedLeads} qualified)
- Active Clients: ${ctx.totalClients}
- Closed Revenue: $${ctx.totalRevenue}
- Open Deals: ${ctx.openDeals} worth $${ctx.openDealsValue}
- Pending Tasks: ${ctx.pendingTasks}
- Deals by Stage: ${JSON.stringify(ctx.dealsByStage)}

Answer questions about CRM performance concisely and helpfully.`;

    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: message }
      ],
      max_tokens: 200,
    });

    return res.json({ response: completion.choices[0].message.content, mock: false });
  } catch (err) {
    return res.json({
      response: `Based on your CRM data: ${ctx.totalLeads} leads, ${ctx.totalClients} clients, $${ctx.totalRevenue.toLocaleString()} revenue.`,
      mock: true
    });
  }
});

export default router;
