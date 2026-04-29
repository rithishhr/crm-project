import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, TrendingUp, Loader2, Plus, X, CheckCircle, Edit3, Trash2 } from 'lucide-react'
import { oppsApi } from '../lib/api'
import type { DealStage, Opportunity } from '../types'
import type { Toast } from '../components/ui/Toast'
import OpportunityFormDrawer from '../components/forms/OpportunityFormDrawer'

interface Props {
  canEdit: boolean
  addToast: (t: Omit<Toast, 'id'>) => void
}

const STAGES: Array<{ key: string; label: string; color: string; headerColor: string }> = [
  { key: 'QUALIFICATION', label: 'Qualification', color: 'border-blue-500/20', headerColor: 'text-blue-400' },
  { key: 'PROPOSAL', label: 'Proposal', color: 'border-amber-500/20', headerColor: 'text-amber-400' },
  { key: 'NEGOTIATION', label: 'Negotiation', color: 'border-purple-500/20', headerColor: 'text-purple-400' },
  { key: 'CLOSED_WON', label: 'Closed Won', color: 'border-teal-500/20', headerColor: 'text-teal-400' },
]

const riskColors: Record<string, string> = {
  LOW: 'text-teal-400',
  MEDIUM: 'text-amber-400',
  HIGH: 'text-red-400',
}

function formatAED(v: number) {
  if (v >= 1_000_000) return `AED ${(v / 1_000_000).toFixed(1)}M`
  return `AED ${(v / 1_000).toFixed(0)}K`
}

export default function PipelinePage({ addToast, canEdit }: Props) {
  const [opps, setOpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchData = async () => {
    try {
      const data = await oppsApi.list()
      setOpps(data)
    } catch (err) {
      addToast({ message: 'Failed to load pipeline', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const handleSave = async (data: any) => {
    try {
      const created = await oppsApi.create(data)
      setOpps(prev => [created, ...prev])
      addToast({ message: 'Opportunity created', type: 'success' })
    } catch (err: any) {
      throw err
    }
  }

  const oppsByStage = (stage: string) => opps.filter(o => o.stage?.toUpperCase() === stage.toUpperCase())
  const totalPipeline = opps.reduce((sum, o) => sum + Number(o.value), 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)]">Visualizing pipeline...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Pipeline</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">Total: {formatAED(totalPipeline)} across {opps.length} active opportunities</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <TrendingUp className="w-4 h-4" />
          New Opportunity
        </button>
      </div>

      <div className="grid grid-cols-4 gap-3">
        {STAGES.map(stage => {
          const filtered = oppsByStage(stage.key)
          const total = filtered.reduce((s, o) => s + Number(o.value), 0)
          return (
            <div key={stage.key} className={`panel p-3 border ${stage.color}`}>
              <p className={`text-[10px] font-bold uppercase tracking-wider ${stage.headerColor} mb-1`}>{stage.label}</p>
              <p className="text-lg font-bold text-[var(--text-primary)]">{formatAED(total)}</p>
              <p className="text-[10px] text-[var(--text-muted)]">{filtered.length} deals</p>
            </div>
          )
        })}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {STAGES.map(stage => {
          const filtered = oppsByStage(stage.key)
          return (
            <div key={stage.key} className="bg-[var(--bg-surface)]/50 border border-[var(--border)] rounded-xl p-3">
              <div className="flex items-center gap-2 mb-3 px-1">
                <div className={`w-2 h-2 rounded-full ${
                  stage.key === 'QUALIFICATION' ? 'bg-blue-400' :
                  stage.key === 'PROPOSAL' ? 'bg-amber-400' :
                  stage.key === 'NEGOTIATION' ? 'bg-purple-400' : 'bg-teal-400'
                }`} />
                <span className={`text-[10px] font-bold uppercase tracking-wider ${stage.headerColor}`}>{stage.label}</span>
                <span className="ml-auto text-[10px] text-[var(--text-muted)] bg-[var(--bg-elevated)] px-2 py-0.5 rounded-full">{filtered.length}</span>
              </div>

              <div className="space-y-2.5">
                {filtered.map((opp, i) => (
                  <motion.div
                    key={opp.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="bg-[var(--bg-card)] border border-[var(--border)] hover:border-[var(--accent-muted)] rounded-xl p-3.5 cursor-pointer group transition-all duration-200"
                  >
                    <div className="flex items-start justify-between mb-1.5">
                      <p className="text-xs font-bold text-[var(--text-primary)] leading-tight group-hover:text-[var(--accent)] transition-colors">{opp.title}</p>
                      {opp.riskLevel === 'HIGH' && (
                        <AlertTriangle className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />
                      )}
                    </div>

                    <p className="text-[10px] text-[var(--text-muted)] mb-3">{opp.company}</p>

                    <div className="flex items-center justify-between">
                      <p className="text-sm font-bold text-[var(--text-primary)]">{formatAED(Number(opp.value))}</p>
                      <div className="flex items-center gap-1.5">
                        <div className="w-10 bg-[var(--bg-elevated)] rounded-full h-1 relative overflow-hidden">
                          <div
                            className="h-full bg-teal-500 rounded-full"
                            style={{ width: `${opp.probability}%` }}
                          />
                        </div>
                        <span className="text-[9px] text-[var(--text-muted)] font-bold">{opp.probability}%</span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-2 pt-2 border-t border-[var(--border)]">
                      <span className="text-[9px] text-[var(--text-muted)] uppercase font-bold">{opp.owner?.name?.split(' ')[0] || 'Unassigned'}</span>
                      <span className={`text-[9px] font-bold uppercase ${riskColors[opp.riskLevel?.toUpperCase()] || 'text-teal-400'}`}>
                        {opp.riskLevel} Risk
                      </span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {filtered.length === 0 && (
                <div className="text-center py-10 opacity-20">
                  <Plus className="w-8 h-8 mx-auto mb-2" />
                  <p className="text-[10px] uppercase font-bold">Empty Stage</p>
                </div>
              )}
            </div>
          )
        })}
      </div>

      {showForm && (
        <OpportunityFormDrawer 
          onSave={handleSave} 
          onClose={() => setShowForm(false)} 
        />
      )}
    </div>
  )
}
