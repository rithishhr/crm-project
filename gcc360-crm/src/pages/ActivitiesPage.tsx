import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Phone, Mail, Calendar, FileText, Activity, Loader2, X, CheckCircle, Plus } from 'lucide-react'
import { activitiesApi } from '../lib/api'
import type { Toast } from '../components/ui/Toast'

interface Props {
  addToast: (t: Omit<Toast, 'id'>) => void
}

const typeConfig: Record<string, any> = {
  CALL: { icon: Phone, color: 'text-blue-400 bg-blue-500/10 border-blue-500/20', label: 'Call' },
  EMAIL: { icon: Mail, color: 'text-teal-400 bg-teal-500/10 border-teal-500/20', label: 'Email' },
  MEETING: { icon: Calendar, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Meeting' },
  NOTE: { icon: FileText, color: 'text-amber-400 bg-amber-500/10 border-amber-500/20', label: 'Note' },
  LEAD: { icon: Activity, color: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20', label: 'Lead' },
  DEAL: { icon: Activity, color: 'text-purple-400 bg-purple-500/10 border-purple-500/20', label: 'Deal' },
}

const EMPTY_FORM = {
  type: 'CALL',
  description: '',
  contact: '',
  company: '',
}

function ActivityFormDrawer({ onSave, onClose }: {
  onSave: (data: any) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.description) {
      setError('Description is required.')
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
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">Log Activity</h2>
              <p className="text-xs text-[var(--text-muted)]">Record a call, meeting, or note</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Activity Type</label>
              <select className="input-field" value={form.type} onChange={e => setForm({...form, type: e.target.value})}>
                <option value="CALL">Call</option>
                <option value="EMAIL">Email</option>
                <option value="MEETING">Meeting</option>
                <option value="NOTE">Note</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Contact Name</label>
              <input className="input-field" value={form.contact} onChange={e => setForm({...form, contact: e.target.value})} placeholder="e.g. John Doe" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Company</label>
              <input className="input-field" value={form.company} onChange={e => setForm({...form, company: e.target.value})} placeholder="e.g. Acme Corp" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Description / Summary *</label>
              <textarea className="input-field h-32 resize-none" value={form.description} onChange={e => setForm({...form, description: e.target.value})} placeholder="What happened during this activity?" />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Logging...' : 'Log Activity'}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function ActivitiesPage({ addToast }: Props) {
  const [activities, setActivities] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)

  const fetchActivities = async () => {
    try {
      const data = await activitiesApi.list()
      setActivities(data)
    } catch (err) {
      addToast({ message: 'Failed to load activities', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchActivities()
  }, [])

  const handleSave = async (data: any) => {
    try {
      const created = await activitiesApi.create(data)
      setActivities(prev => [created, ...prev])
      addToast({ message: 'Activity logged', type: 'success' })
    } catch (err: any) {
      throw err
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)]">Syncing timeline...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Activities</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{activities.length} total events</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          Log Activity
        </button>
      </div>

      <div className="space-y-3">
        {activities.length === 0 ? (
          <div className="panel p-20 text-center">
            <Activity className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-[var(--text-muted)]">No activity logs found.</p>
          </div>
        ) : (
          activities.map((activity, i) => {
            const config = typeConfig[activity.type] || { icon: Activity, color: 'text-slate-400 bg-slate-500/10 border-slate-500/20', label: activity.type }
            const Icon = config.icon
            return (
              <motion.div
                key={activity.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                className="panel p-4 flex items-start gap-4 hover:border-[var(--border)] transition-all duration-200"
              >
                <div className={`w-9 h-9 rounded-xl border flex items-center justify-center flex-shrink-0 ${config.color}`}>
                  <Icon className="w-4 h-4" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <span className={`badge border ${config.color} text-[10px] uppercase font-bold`}>{config.label}</span>
                    <span className="text-sm font-medium text-[var(--text-primary)]">{activity.contact || 'Internal'}</span>
                    {activity.company && (
                      <>
                        <span className="text-[var(--text-placeholder)]">·</span>
                        <span className="text-sm text-[var(--text-muted)]">{activity.company}</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm text-[var(--text-secondary)]">{activity.description}</p>
                  <div className="flex items-center gap-4 mt-2 text-[10px] text-[var(--text-placeholder)]">
                    <span>By {activity.createdBy?.name || 'System'}</span>
                    <span>{new Date(activity.createdAt).toLocaleString()}</span>
                  </div>
                </div>
              </motion.div>
            )
          })
        )}
      </div>

      {showForm && (
        <ActivityFormDrawer 
          onSave={handleSave} 
          onClose={() => setShowForm(false)} 
        />
      )}
    </div>
  )
}
