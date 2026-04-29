import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Handshake, Trash2, Edit3, Plus, X, Loader2, CheckCircle } from 'lucide-react'
import { dealsApi } from '../lib/api'
import type { Deal } from '../types'
import type { Toast } from '../components/ui/Toast'
import DealFinanceExport from '../components/ui/DealFinanceExport'

interface Props {
  addToast: (t: Omit<Toast, 'id'>) => void
  canEdit?: boolean
}

const EMPTY_FORM = {
  title: '',
  company: '',
  value: '',
  stage: 'closed_won',
  closedDate: new Date().toISOString().split('T')[0],
  clientId: '',
}

function DealFormDrawer({ deal, onSave, onClose }: {
  deal?: Deal; onSave: (data: any) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState(deal ? {
    ...EMPTY_FORM,
    ...deal,
    value: deal.value.toString(),
    closedDate: new Date(deal.closedDate).toISOString().split('T')[0]
  } : { ...EMPTY_FORM })
  
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.title || !form.company || !form.value) {
      setError('Title, company, and value are required.')
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
              <Handshake className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">{deal ? 'Edit Deal' : 'Record Deal'}</h2>
              <p className="text-xs text-[var(--text-muted)]">{deal ? 'Update transaction details' : 'Log a new closed deal'}</p>
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
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Deal Title *</label>
              <input 
                className="input-field" placeholder="e.g. Annual Subscription 2025" 
                value={form.title} onChange={e => setForm({...form, title: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Company Name *</label>
              <input 
                className="input-field" placeholder="e.g. Saudi Aramco" 
                value={form.company} onChange={e => setForm({...form, company: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Value (AED) *</label>
                <input 
                  type="number" className="input-field" placeholder="0" 
                  value={form.value} onChange={e => setForm({...form, value: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Closing Date</label>
                <input 
                  type="date" className="input-field" 
                  value={form.closedDate} onChange={e => setForm({...form, closedDate: e.target.value})}
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Deal Status</label>
              <select 
                className="input-field" 
                value={form.stage} onChange={e => setForm({...form, stage: e.target.value})}
              >
                <option value="closed_won">Won</option>
                <option value="closed_lost">Lost</option>
              </select>
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Saving...' : (deal ? 'Update Deal' : 'Save Deal')}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function DealsPage({ addToast, canEdit = false }: Props) {
  const [deals, setDeals] = useState<Deal[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editDeal, setEditDeal] = useState<Deal | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchDeals = async () => {
    try {
      const data = await dealsApi.list()
      setDeals(data)
    } catch (err: any) {
      addToast({ message: 'Failed to load deals', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchDeals()
  }, [])

  const handleSave = async (data: any) => {
    try {
      if (editDeal) {
        const updated = await dealsApi.update(editDeal.id, data)
        setDeals(prev => prev.map(d => d.id === updated.id ? updated : d))
        addToast({ message: 'Deal updated', type: 'success' })
      } else {
        const created = await dealsApi.create(data)
        setDeals(prev => [created, ...prev])
        addToast({ message: 'Deal recorded', type: 'success' })
      }
    } catch (err: any) {
      throw err
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this deal?')) return
    try {
      await dealsApi.delete(id)
      setDeals(prev => prev.filter(d => d.id !== id))
      setSelectedIds(prev => prev.filter(i => i !== id))
      addToast({ message: 'Deal deleted', type: 'info' })
    } catch (err: any) {
      addToast({ message: 'Failed to delete deal', type: 'error' })
    }
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} deals?`)) return
    try {
      await dealsApi.bulkDelete(selectedIds)
      setDeals(prev => prev.filter(d => !selectedIds.includes(d.id)))
      setSelectedIds([])
      addToast({ message: `${selectedIds.length} deals deleted`, type: 'info' })
    } catch (err: any) {
      addToast({ message: err.message || 'Bulk delete failed', type: 'error' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === deals.length) setSelectedIds([])
    else setSelectedIds(deals.map(d => d.id))
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-amber-500" />
        <p className="text-[var(--text-muted)] animate-pulse">Syncing financials...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Deals</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {deals.length} deals · AED {(deals.reduce((s, d) => s + Number(d.value), 0) / 1_000_000).toFixed(1)}M total
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selectedIds.length > 0 && (
            <div className="flex items-center gap-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mr-2">
              <span className="text-xs font-bold text-red-400">{selectedIds.length} selected</span>
              <button onClick={handleBulkDelete} className="btn-secondary py-1.5 px-3 text-xs bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white">
                <Trash2 className="w-3.5 h-3.5" /> Delete
              </button>
            </div>
          )}
          <button className="btn-primary" onClick={() => { setEditDeal(null); setShowForm(true) }}>
            <Handshake className="w-4 h-4" />
            Record Deal
          </button>
        </div>
      </div>

      <div className="panel overflow-hidden">
        {deals.length === 0 ? (
          <div className="p-20 text-center">
            <Handshake className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-[var(--text-muted)]">No deals recorded yet.</p>
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="w-10 pl-5">
                  <input type="checkbox" checked={selectedIds.length === deals.length && deals.length > 0} onChange={toggleSelectAll} className="rounded border-gray-700 bg-gray-800" />
                </th>
                <th>Deal</th>
                <th>Company</th>
                <th>Value</th>
                <th>Status</th>
                <th>Close Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal, i) => (
                <tr key={deal.id} className={`group hover:bg-[var(--bg-elevated)] transition-colors ${selectedIds.includes(deal.id) ? 'bg-accent-muted/20' : ''}`}>
                  <td className="pl-5">
                    <input type="checkbox" checked={selectedIds.includes(deal.id)} onChange={() => toggleSelect(deal.id)} className="rounded border-gray-700 bg-gray-800" />
                  </td>
                  <td>
                    <p className="text-sm font-medium text-[var(--text-primary)]">{deal.title}</p>
                  </td>
                  <td><p className="text-sm text-[var(--text-secondary)]">{deal.company}</p></td>
                  <td><p className="text-sm font-bold text-[var(--text-primary)]">AED {(Number(deal.value) / 1_000_000).toFixed(1)}M</p></td>
                  <td>
                    <span className={`badge border text-[10px] uppercase font-bold ${
                      deal.stage === 'closed_won' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                      deal.stage === 'closed_lost' ? 'bg-red-500/10 text-red-400 border-red-500/20' :
                      'bg-amber-500/10 text-amber-400 border-amber-500/20'
                    }`}>
                      {deal.stage === 'closed_won' ? 'Won' : deal.stage === 'closed_lost' ? 'Lost' : 'In Progress'}
                    </span>
                  </td>
                  <td><p className="text-[10px] text-[var(--text-muted)]">{new Date(deal.closedDate).toLocaleDateString()}</p></td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {deal.stage === 'closed_won' && (
                        <DealFinanceExport dealId={deal.id} dealTitle={deal.title} />
                      )}
                      <button 
                        onClick={() => { setEditDeal(deal); setShowForm(true) }}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white transition-colors"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button 
                        onClick={() => handleDelete(deal.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <DealFormDrawer 
          deal={editDeal || undefined} 
          onSave={handleSave} 
          onClose={() => { setShowForm(false); setEditDeal(null) }} 
        />
      )}
    </div>
  )
}
