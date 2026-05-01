import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  TrendingUp, DollarSign, Target, Users2, BarChart2,
  ArrowRight, CheckCircle, Clock, AlertCircle, Zap, Bot, Volume2, Download
} from 'lucide-react'
import { FadeIn, ScaleIn, StaggerContainer } from '../components/Motion'
import { aiApi, analyticsApi } from '../lib/api'
import { useLanguage } from '../context/LanguageContext'
import type { User } from '../types'
import type { PageKey } from '../components/layout/AppShell'

interface Props {
  user:       User
  onNavigate: (page: PageKey) => void
}

function fmt(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}K`
  return `AED ${v}`
}

const STAGE_COLORS: Record<string, string> = {
  QUALIFICATION: '#3b82f6',
  PROPOSAL:      '#f59e0b',
  NEGOTIATION:   '#ef4444',
  CLOSED_WON:    '#10b981',
  CLOSED_LOST:   '#6b7280',
}

export default function DashboardPage({ user, onNavigate }: Props) {
  const [data,    setData]    = useState<any>(null)
  const [revenue, setRevenue] = useState<any[]>([])
  const [aiSummary, setAiSummary] = useState<any>(null)
  const [aiLoading, setAiLoading] = useState(true)
  const [speaking, setSpeaking] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    Promise.all([
      analyticsApi.dashboard().then(setData),
      analyticsApi.revenue().then(setRevenue),
    ]).finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    setAiLoading(true)
    const fetchSummary = async () => {
      try {
        const res = await aiApi.dashboardSummary()
        setAiSummary(res)
      } catch (err: any) {
        console.error('[AI DASHBOARD FETCH ERROR]:', err)
        // Provide a minimal fallback using already-fetched analytics if available
        if (data) {
          const kpis = data.kpis || {}
          setAiSummary({
            greeting: `Welcome back ${user.name.split(' ')[0]}!`,
            summaryText: `Quick snapshot: ${kpis.totalLeads || 0} leads, ${kpis.totalRevenue || 0} revenue. Detailed AI insights unavailable right now.`,
            metrics: {
              totalLeads: kpis.totalLeads || 0,
              totalRevenue: kpis.totalRevenue || 0,
            },
          })
        } else {
          setAiSummary(null)
        }
      } finally {
        setAiLoading(false)
      }
    }

    fetchSummary()
  }, [data])

  const speakSummary = () => {
    if (!aiSummary?.summaryText || !window.speechSynthesis) return
    if (speaking) {
      window.speechSynthesis.cancel()
      setSpeaking(false)
      return
    }
    const utterance = new SpeechSynthesisUtterance(`${aiSummary.greeting}. ${aiSummary.summaryText}`)
    utterance.rate = 1
    utterance.pitch = 1
    utterance.onend = () => setSpeaking(false)
    setSpeaking(true)
    window.speechSynthesis.speak(utterance)
  }

  const exportSummaryPdf = async () => {
    try {
      const blob = await aiApi.exportDashboardSummaryPdf()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `crm-ai-summary-${new Date().toISOString().slice(0, 10)}.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch {
      // keep dashboard resilient even if export fails
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="flex items-center gap-3" style={{ color: 'var(--text-muted)' }}>
        <Zap className="w-5 h-5 animate-pulse" style={{ color: 'var(--accent)' }} />
        Loading dashboard...
      </div>
    </div>
  )

  const kpis = data?.kpis || {}
  const stages = data?.stageBreakdown || []

  return (
    <div className="space-y-6">
      {/* Welcome */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>
            Good {new Date().getHours() < 12 ? 'morning' : new Date().getHours() < 17 ? 'afternoon' : 'evening'}, {user.name.split(' ')[0]} 👋
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {new Date().toLocaleDateString('en-US', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Smart CRM Analytics AI */}
      <FadeIn delay={0.1}>
        <div className="panel p-5 glass-panel">
          {/* ... existing content ... */}
          <div className="flex items-center justify-between gap-4 mb-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg, #0ea5e9, #14b8a6)' }}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div>
                <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Smart CRM Analytics AI</h2>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Auto summary of what happened while you were away</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={speakSummary} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5" disabled={!aiSummary?.summaryText}>
                <Volume2 className="w-3.5 h-3.5" /> {speaking ? 'Stop' : 'Read My CRM Summary'}
              </button>
              <button onClick={exportSummaryPdf} className="btn-secondary text-xs px-3 py-1.5 flex items-center gap-1.5" disabled={!aiSummary}>
                <Download className="w-3.5 h-3.5" /> Export PDF
              </button>
            </div>
          </div>

          {aiLoading ? (
            <div className="text-sm" style={{ color: 'var(--text-muted)' }}>Analyzing CRM data...</div>
          ) : aiSummary ? (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{aiSummary.greeting}</p>
              <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{aiSummary.summaryText}</p>
              {aiSummary.aiNarrative && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                  <p className="text-xs whitespace-pre-wrap" style={{ color: 'var(--text-secondary)' }}>{aiSummary.aiNarrative}</p>
                </div>
              )}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                {[
                  { label: 'Hot Leads', value: aiSummary.metrics?.hotLeads || 0 },
                  { label: 'Leads Won', value: aiSummary.metrics?.leadsWon || 0 },
                  { label: 'Leads Lost', value: aiSummary.metrics?.leadsLost || 0 },
                  { label: 'Pending Follow-ups', value: aiSummary.metrics?.pendingFollowUps || 0 },
                  { label: 'Tasks Overdue', value: aiSummary.metrics?.tasksOverdue || 0 },
                  { label: 'Deals Closed (Month)', value: aiSummary.metrics?.dealsClosedThisMonth || 0 },
                  { label: 'Revenue (Month)', value: fmt(aiSummary.metrics?.revenueGenerated || 0) },
                  { label: 'Emails Sent', value: aiSummary.metrics?.emailsSent || 0 },
                ].map((item, idx) => (
                  <motion.div 
                    key={item.label} 
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: 0.2 + idx * 0.05 }}
                    className="rounded-lg p-2.5" 
                    style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}
                  >
                    <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{item.label}</p>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{item.value}</p>
                  </motion.div>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: 'var(--text-muted)' }}>AI summary unavailable right now.</p>
          )}
        </div>
      </FadeIn>

      {/* KPI Cards */}
      <motion.div 
        variants={{
          show: { transition: { staggerChildren: 0.1 } }
        }}
        initial="hidden"
        animate="show"
        className="grid grid-cols-2 lg:grid-cols-4 gap-4"
      >
        {[
          { label: 'Pipeline Value',  value: fmt(kpis.pipelineValue || 0), icon: DollarSign, color: '#14b8a6', change: '+18%', up: true },
          { label: 'Total Revenue',   value: fmt(kpis.totalRevenue  || 0), icon: TrendingUp, color: '#10b981', change: '+12%', up: true },
          { label: 'Total Leads',     value: String(kpis.totalLeads || 0), icon: Target,     color: '#3b82f6', change: `${kpis.conversionRate || 0}% converted`, up: true },
          { label: 'Active Clients',  value: String(kpis.clients    || 0), icon: Users2,     color: '#f59e0b', change: `${kpis.totalDeals || 0} deals`, up: true },
        ].map((kpi) => (
          <motion.div 
            key={kpi.label} 
            variants={{
              hidden: { opacity: 0, y: 20 },
              show: { opacity: 1, y: 0 }
            }}
            whileHover={{ scale: 1.02, translateY: -5 }}
            className="kpi-card"
          >
            <div className="flex items-start justify-between mb-3">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
              <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
              </div>
            </div>
            <p className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>{kpi.value}</p>
            <p className="text-xs font-medium" style={{ color: kpi.up ? '#10b981' : '#ef4444' }}>{kpi.change}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Revenue chart */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 }} className="panel p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Revenue Trend</h2>
            <BarChart2 className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
          </div>
          {revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <LineChart data={revenue}>
                <XAxis dataKey="month" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : `${(v/1000).toFixed(0)}K`} />
                <Tooltip formatter={(v: number) => [fmt(v), 'Revenue']}
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                <Line type="monotone" dataKey="amount" stroke="#14b8a6" strokeWidth={2.5} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-44 flex items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              <p className="text-sm">No revenue data yet. Create invoices to see your trend.</p>
            </div>
          )}
        </motion.div>

        {/* Pipeline stages */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="panel p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Pipeline Stages</h2>
          </div>
          {stages.filter((s: any) => s.count > 0).length > 0 ? (
            <>
              <ResponsiveContainer width="100%" height={120}>
                <PieChart>
                  <Pie data={stages.filter((s: any) => s.count > 0)} dataKey="value" nameKey="stage"
                    cx="50%" cy="50%" innerRadius={35} outerRadius={55}>
                    {stages.filter((s: any) => s.count > 0).map((s: any) => (
                      <Cell key={s.stage} fill={STAGE_COLORS[s.stage] || '#6b7280'} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [fmt(v), 'Value']}
                    contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 8 }} />
                </PieChart>
              </ResponsiveContainer>
              <div className="space-y-1.5 mt-2">
                {stages.filter((s: any) => s.count > 0).map((s: any) => (
                  <div key={s.stage} className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage] || '#6b7280' }} />
                      <span style={{ color: 'var(--text-secondary)' }}>{s.stage.replace('_', ' ')}</span>
                    </div>
                    <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>{s.count}</span>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="h-40 flex items-center justify-center">
              <div className="text-center">
                <p className="text-sm mb-2" style={{ color: 'var(--text-muted)' }}>No opportunities yet.</p>
                <button onClick={() => onNavigate('opportunities')} className="btn-primary text-xs px-3 py-1.5">
                  Add First Opportunity
                </button>
              </div>
            </div>
          )}
        </motion.div>
      </div>

      {/* Quick actions */}
      <div className="panel p-5">
        <h2 className="font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Quick Actions</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Add Lead',        page: 'leads',         color: '#3b82f6', icon: Target },
            { label: 'Add Client',      page: 'clients',       color: '#14b8a6', icon: Users2 },
            { label: 'Add Task',        page: 'tasks',         color: '#f59e0b', icon: CheckCircle },
            { label: 'View Pipeline',   page: 'pipeline',      color: '#8b5cf6', icon: BarChart2 },
          ].map(qa => (
            <button key={qa.label} onClick={() => onNavigate(qa.page as PageKey)}
              className="flex flex-col items-center gap-2 p-4 rounded-xl text-sm font-medium transition-all hover:scale-105"
              style={{ backgroundColor: `${qa.color}10`, border: `1px solid ${qa.color}25`, color: qa.color }}>
              <qa.icon className="w-5 h-5" />
              {qa.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Pending Tasks',   value: kpis.pendingTasks || 0,    icon: Clock,       color: '#f59e0b', page: 'tasks' },
          { label: 'Pending Invoices', value: fmt(kpis.pendingInvoices || 0), icon: DollarSign, color: '#ef4444', page: 'finance' },
          { label: 'Avg Deal Size',   value: fmt(kpis.avgDealSize || 0), icon: TrendingUp,  color: '#10b981', page: 'deals' },
        ].map(s => (
          <button key={s.label} onClick={() => onNavigate(s.page as PageKey)}
            className="panel p-4 text-left transition-all hover:scale-[1.02] group">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{s.label}</p>
              <s.icon className="w-4 h-4" style={{ color: s.color }} />
            </div>
            <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{s.value}</p>
            <ArrowRight className="w-3.5 h-3.5 mt-1 opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: s.color }} />
          </button>
        ))}
      </div>
    </div>
  )
}
