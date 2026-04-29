import { useState } from 'react'
import { motion } from 'framer-motion'
import { Target, X, CheckCircle, Loader2 } from 'lucide-react'
import type { Opportunity, DealStage } from '../../types'

interface Props {
  opp?: Opportunity
  onSave: (data: any) => Promise<void>
  onClose: () => void
}

const EMPTY_FORM = {
  title: '',
  company: '',
  value: '',
  stage: 'QUALIFICATION',
  probability: '25',
  riskLevel: 'MEDIUM',
  closeDate: new Date().toISOString().split('T')[0],
  notes: '',
}

const stageLabels: Record<string, string> = {
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
}

export default function OpportunityFormDrawer({ opp, onSave, onClose }: Props) {
  const [form, setForm] = useState(opp ? {
    ...EMPTY_FORM,
    ...opp,
    value: opp.value.toString(),
    probability: opp.probability.toString(),
    closeDate: new Date(opp.closeDate).toISOString().split('T')[0]
  } : { ...EMPTY_FORM })
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title || !form.company || !form.closeDate) {
      setError('Title, company, and close date are required.')
      return
    }
    setSaving(true)
    try {
      await onSave(form)
      onClose()
    } catch (err: any) {
      setError(err.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <motion.div 
        initial={{ x: 600 }} animate={{ x: 0 }}
        className="ml-auto w-full max-w-xl h-full overflow-y-auto shadow-2xl bg-[var(--bg-card)] border-l border-[var(--border)]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 bg-[var(--bg-card)] border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center bg-teal-500/10 text-teal-400">
              <Target className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">{opp ? 'Edit Opportunity' : 'New Opportunity'}</h2>
              <p className="text-xs text-[var(--text-muted)]">{opp ? 'Update deal details' : 'Create a new business opportunity'}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
              <X className="w-4 h-4" /> {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Opportunity Title *</label>
              <input 
                className="input-field" placeholder="e.g. Q4 Cloud Infrastructure" 
                value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Company Name *</label>
              <input 
                className="input-field" placeholder="e.g. ADNOC" 
                value={form.company} onChange={e => setForm({...form, company: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Value (AED)</label>
                <input 
                  type="number" className="input-field" placeholder="0" 
                  value={form.value} onChange={e => setForm({...form, value: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Expected Close Date *</label>
                <input 
                  type="date" className="input-field" 
                  value={form.closeDate} onChange={e => setForm({...form, closeDate: e.target.value})}
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Stage</label>
                <select 
                  className="input-field" 
                  value={form.stage} onChange={e => setForm({...form, stage: e.target.value as any})}
                >
                  {Object.entries(stageLabels).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Win Probability (%)</label>
                <input 
                  type="number" className="input-field" 
                  value={form.probability} onChange={e => setForm({...form, probability: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Risk Level</label>
              <select 
                className="input-field" 
                value={form.riskLevel} onChange={e => setForm({...form, riskLevel: e.target.value as any})}
              >
                <option value="LOW">Low Risk</option>
                <option value="MEDIUM">Medium Risk</option>
                <option value="HIGH">High Risk</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Notes</label>
              <textarea 
                className="input-field h-24 resize-none" placeholder="Key deal requirements..." 
                value={form.notes} onChange={e => setForm({...form, notes: e.target.value})}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Saving...' : (opp ? 'Update Opportunity' : 'Create Opportunity')}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
