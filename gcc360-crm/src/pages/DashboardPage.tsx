import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts'
import {
  TrendingUp, DollarSign, Target, Users2, BarChart2,
  ArrowRight, CheckCircle, Clock, AlertCircle, Zap, Bot, Volume2, Download, Loader2
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
      <div className="official-card p-6 mb-6">
        <div className="flex items-center justify-between gap-4 mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-inner" style={{ background: 'linear-gradient(135deg, #14b8a6, #0ea5e9)' }}>
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Intelligent CRM Summary</h2>
              <p className="text-xs text-[var(--text-muted)] font-medium tracking-tight">Automated business intelligence for your daily briefing</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={speakSummary} className="btn-secondary px-4 py-1.5 text-xs" disabled={!aiSummary?.summaryText}>
              <Volume2 className="w-3.5 h-3.5" /> {speaking ? 'Stop' : 'Play Audio'}
            </button>
            <button onClick={exportSummaryPdf} className="btn-secondary px-4 py-1.5 text-xs" disabled={!aiSummary}>
              <Download className="w-3.5 h-3.5" /> PDF
            </button>
          </div>
        </div>

        {aiLoading ? (
          <div className="flex items-center gap-3 text-sm py-4" style={{ color: 'var(--text-muted)' }}>
            <Loader2 className="w-4 h-4 animate-spin" style={{ color: 'var(--accent)' }} />
            Synthesizing intelligence report...
          </div>
        ) : aiSummary ? (
          <div className="space-y-4">
            <div className="p-4 rounded-xl border border-teal-500/20 bg-teal-500/5">
              <p className="text-sm font-bold text-teal-500 mb-1">{aiSummary.greeting}</p>
              <p className="text-sm leading-relaxed text-[var(--text-secondary)]">{aiSummary.summaryText}</p>
            </div>
            
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: 'High Priority Leads', value: aiSummary.metrics?.hotLeads || 0 },
                { label: 'Monthly Wins', value: aiSummary.metrics?.leadsWon || 0 },
                { label: 'Retention Risk', value: aiSummary.metrics?.leadsLost || 0 },
                { label: 'Follow-ups', value: aiSummary.metrics?.pendingFollowUps || 0 },
                { label: 'System Overdue', value: aiSummary.metrics?.tasksOverdue || 0 },
                { label: 'Closures (MTD)', value: aiSummary.metrics?.dealsClosedThisMonth || 0 },
                { label: 'Revenue Intake', value: fmt(aiSummary.metrics?.revenueGenerated || 0) },
                { label: 'Comm. Volume', value: aiSummary.metrics?.emailsSent || 0 },
              ].map((item) => (
                <div key={item.label} className="bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl p-3 shadow-sm">
                  <p className="text-[10px] font-black text-[var(--text-muted)] uppercase tracking-widest mb-1">{item.label}</p>
                  <p className="text-sm font-black text-[var(--text-primary)]">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm text-[var(--text-muted)] italic">No intelligence briefing available for the current cycle.</p>
        )}
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        {[
          { label: 'Pipeline Value',  value: fmt(kpis.pipelineValue || 0), icon: DollarSign, color: '#0ea5e9' },
          { label: 'Total Revenue',   value: fmt(kpis.totalRevenue  || 0), icon: TrendingUp, color: '#10b981' },
          { label: 'Active Leads',     value: String(kpis.totalLeads || 0), icon: Target,     color: '#6366f1' },
          { label: 'Client Base',  value: String(kpis.clients    || 0), icon: Users2,     color: '#f59e0b' },
        ].map((kpi) => (
          <div key={kpi.label} className="official-card p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-[var(--bg-elevated)] border border-[var(--border)]">
                <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
              </div>
              <span className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-widest">Live</span>
            </div>
            <p className="text-2xl font-bold text-[var(--text-primary)] tracking-tight">{kpi.value}</p>
            <p className="text-xs font-semibold text-[var(--text-muted)] uppercase mt-1">{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="official-card p-6 lg:col-span-2">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-bold text-[var(--text-primary)]">Revenue Performance</h2>
              <p className="text-xs text-[var(--text-muted)]">Monthly breakdown of gross revenue across all sectors</p>
            </div>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-teal-500/10 border border-teal-500/20">
                <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />
                <span className="text-[10px] font-bold text-teal-500 uppercase">Growth</span>
              </div>
            </div>
          </div>
          {revenue.length > 0 ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={revenue}>
                <XAxis dataKey="month" tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 10, fill: 'var(--text-muted)', fontWeight: 600 }} axisLine={false} tickLine={false}
                  tickFormatter={v => v >= 1000000 ? `${(v/1000000).toFixed(0)}M` : `${(v/1000).toFixed(0)}K`} />
                <Tooltip 
                  contentStyle={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 12, boxShadow: 'var(--shadow-lg)' }}
                  itemStyle={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)' }}
                />
                <Line type="monotone" dataKey="amount" stroke="var(--accent)" strokeWidth={3} dot={{ r: 4, fill: 'var(--accent)', strokeWidth: 2, stroke: 'var(--bg-card)' }} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-56 flex flex-col items-center justify-center" style={{ color: 'var(--text-muted)' }}>
              <BarChart2 className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium">Insufficient data for revenue modeling</p>
            </div>
          )}
        </div>

        <div className="official-card p-6">
          <h2 className="text-lg font-bold text-[var(--text-primary)] mb-1">Pipeline Health</h2>
          <p className="text-xs text-[var(--text-muted)] mb-6">Distribution by deal stage</p>
          {stages.filter((s: any) => s.count > 0).length > 0 ? (
            <div className="space-y-4">
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={stages.filter((s: any) => s.count > 0)} dataKey="value" nameKey="stage" innerRadius={45} outerRadius={65} paddingAngle={5}>
                    {stages.filter((s: any) => s.count > 0).map((s: any) => (
                      <Cell key={s.stage} fill={STAGE_COLORS[s.stage] || '#94a3b8'} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="grid grid-cols-1 gap-2 pt-2">
                {stages.filter((s: any) => s.count > 0).map((s: any) => (
                  <div key={s.stage} className="flex items-center justify-between p-2 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border)]">
                    <div className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full" style={{ backgroundColor: STAGE_COLORS[s.stage] || '#94a3b8' }} />
                      <span className="text-[11px] font-bold text-[var(--text-secondary)] uppercase tracking-tight">{s.stage.replace('_', ' ')}</span>
                    </div>
                    <span className="text-xs font-black text-[var(--text-primary)]">{s.count}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="h-48 flex flex-col items-center justify-center text-center" style={{ color: 'var(--text-muted)' }}>
              <Target className="w-8 h-8 mb-2 opacity-20" />
              <p className="text-sm font-medium px-4">No active opportunities in the pipeline</p>
            </div>
          )}
        </div>
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
