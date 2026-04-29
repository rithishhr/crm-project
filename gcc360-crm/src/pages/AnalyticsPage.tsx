import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import {
  BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell, PieChart, Pie
} from 'recharts'
import { BarChart3, TrendingUp, Users, Target, Loader2, Zap } from 'lucide-react'
import { analyticsApi } from '../lib/api'

const COLORS = ['#14b8a6', '#3b82f6', '#8b5cf6', '#f59e0b', '#ef4444', '#10b981']

const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null
  return (
    <div className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-lg p-3 shadow-xl">
      <p className="text-xs mb-1" style={{ color: "var(--text-muted)" }}>{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.name} className="text-xs font-semibold" style={{ color: entry.color ?? entry.fill }}>
          {entry.name}: {typeof entry.value === 'number' && entry.value >= 1000
            ? `AED ${(entry.value / 1_000_000).toFixed(2)}M`
            : entry.value}
        </p>
      ))}
    </div>
  )
}

function fmt(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`
  if (v >= 1_000)     return `AED ${(v / 1_000).toFixed(0)}K`
  return `AED ${v}`
}

export default function AnalyticsPage() {
  const [loading, setLoading] = useState(true)
  const [dashboard, setDashboard] = useState<any>(null)
  const [revenue, setRevenue] = useState<any[]>([])
  const [leads, setLeads] = useState<any>(null)
  const [team, setTeam] = useState<any[]>([])

  const fetchData = async () => {
    try {
      const [dash, rev, lds, tm] = await Promise.all([
        analyticsApi.dashboard(),
        analyticsApi.revenue(),
        analyticsApi.leads(),
        analyticsApi.team()
      ])
      setDashboard(dash)
      setRevenue(rev)
      setLeads(lds)
      setTeam(tm)
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-96 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)]">Calculating insights...</p>
      </div>
    )
  }

  const kpis = dashboard?.kpis || {}

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">Analytics</h2>
        <p className="text-[var(--text-muted)] text-sm mt-0.5">Executive intelligence & performance metrics</p>
      </div>

      <div className="grid grid-cols-2 xl:grid-cols-4 gap-4">
        {[
          { label: 'Total Revenue', value: fmt(kpis.totalRevenue), sub: `${kpis.totalDeals} closed deals`, icon: TrendingUp, color: 'text-teal-400' },
          { label: 'Win Rate', value: `${kpis.conversionRate}%`, sub: 'Leads to Qualified', icon: Target, color: 'text-blue-400' },
          { label: 'Avg. Deal Size', value: fmt(kpis.avgDealSize), sub: 'From won deals', icon: BarChart3, color: 'text-purple-400' },
          { label: 'Active Leads', value: String(kpis.totalLeads), sub: `${kpis.qualifiedLeads} qualified`, icon: Users, color: 'text-amber-400' },
        ].map(({ label, value, sub, icon: Icon, color }, i) => (
          <motion.div key={label} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.07 }} className="kpi-card">
            <Icon className={`w-5 h-5 ${color} mb-3`} />
            <p className="text-2xl font-bold text-[var(--text-primary)]">{value}</p>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-medium">{label}</p>
            <p className="text-xs text-teal-400 mt-0.5">{sub}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Revenue Trend */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="panel p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Revenue Trend</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Monthly closed revenue (AED)</p>
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={revenue}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: '#64748b', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => `${(v / 1000000).toFixed(0)}M`} />
              <Tooltip content={<CustomTooltip />} />
              <Line type="monotone" dataKey="amount" stroke="#14b8a6" strokeWidth={2.5} dot={{ fill: '#14b8a6', r: 4 }} name="Revenue" />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>

        {/* Lead Distribution */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 }} className="panel p-5">
          <h3 className="text-sm font-semibold text-white mb-1">Leads by Status</h3>
          <p className="text-xs text-[var(--text-muted)] mb-4">Current distribution</p>
          <div className="flex flex-col md:flex-row items-center gap-6 h-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={leads?.byStatus || []} dataKey="count" nameKey="status" cx="50%" cy="50%" innerRadius={60} outerRadius={80} paddingAngle={5}>
                  {(leads?.byStatus || []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="w-full md:w-48 space-y-2">
              {(leads?.byStatus || []).map((s: any, i: number) => (
                <div key={s.status} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                    <span className="text-[var(--text-secondary)]">{s.status}</span>
                  </div>
                  <span className="font-bold text-[var(--text-primary)]">{s.count}</span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      </div>

      {/* Team Performance */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="panel p-5">
        <h3 className="text-sm font-semibold text-white mb-4">Team Performance</h3>
        <div className="panel overflow-hidden border-0">
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="pl-0">Member</th>
                <th>Leads</th>
                <th>Opps</th>
                <th>Pipeline</th>
                <th>Tasks Done</th>
              </tr>
            </thead>
            <tbody>
              {team.map((m, i) => (
                <tr key={i}>
                  <td className="pl-0">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-full bg-teal-500/10 text-teal-400 flex items-center justify-center text-[10px] font-bold">
                        {m.name.charAt(0)}
                      </div>
                      <p className="text-sm font-medium">{m.name}</p>
                    </div>
                  </td>
                  <td><p className="text-xs">{m.leads}</p></td>
                  <td><p className="text-xs">{m.opportunities}</p></td>
                  <td><p className="text-xs font-bold text-white">{fmt(m.pipelineValue)}</p></td>
                  <td><p className="text-xs">{m.tasksDone}</p></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </motion.div>
    </div>
  )
}
