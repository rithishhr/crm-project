import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Target, BrainCircuit, X, Sparkles, CheckCircle, Loader2, Trash2, Edit3, AlertCircle } from 'lucide-react'
import { oppsApi } from '../lib/api'
import type { Opportunity, AIQuote, DealStage } from '../types'
import type { Toast } from '../components/ui/Toast'

interface Props {
  addToast: (t: Omit<Toast, 'id'>) => void
  canEdit: boolean
  userRole?: string
}

const stageColors: Record<string, string> = {
  QUALIFICATION: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
  PROPOSAL: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  NEGOTIATION: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  CLOSED_WON: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
  CLOSED_LOST: 'bg-red-500/10 text-red-400 border-red-500/20',
}

const stageLabels: Record<string, string> = {
  QUALIFICATION: 'Qualification',
  PROPOSAL: 'Proposal',
  NEGOTIATION: 'Negotiation',
  CLOSED_WON: 'Closed Won',
  CLOSED_LOST: 'Closed Lost',
}

const EMPTY_FORM = {
  title: '',
  company: '',
  value: '',
  stage: 'QUALIFICATION' as any,
  probability: '25',
  riskLevel: 'medium' as 'low' | 'medium' | 'high',
  closeDate: new Date().toISOString().split('T')[0],
  notes: '',
}

function AIQuoteModal({ opp, onClose, onApply }: { opp: Opportunity; onClose: () => void; onApply: (q: AIQuote) => void }) {
  const [phase, setPhase] = useState<'loading' | 'thinking' | 'done'>('loading')
  const [quotes, setQuotes] = useState<AIQuote[]>([])
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchQuotes = async () => {
      try {
        const data = await oppsApi.generateQuote(opp.id)
        const mapped = data.map((q: any) => ({
          type: q.type.toLowerCase() as any,
          label: q.type === 'PRIMARY' ? 'Primary (Recommended)' : q.type === 'CONSERVATIVE' ? 'Conservative' : 'Aggressive',
          basePrice: Number(q.basePrice),
          margin: Number(q.margin),
          vat: Number(q.vat),
          total: Number(q.total),
          confidence: q.confidence,
          justification: q.justification
        }))
        setQuotes(mapped)
        setPhase('done')
      } catch (err: any) {
        console.error('Failed to generate quotes', err)
        setError(err.message || 'AI pricing analysis failed')
        setPhase('done')
      }
    }

    const t1 = setTimeout(() => setPhase('thinking'), 800)
    fetchQuotes()
    return () => { clearTimeout(t1) }
  }, [opp.id])

  const formatAED = (v: number) => `AED ${(v / 1_000_000).toFixed(2)}M`

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-[var(--border)]">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-teal-500/10 border border-teal-500/20 flex items-center justify-center">
              <BrainCircuit className="w-5 h-5 text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-[var(--text-primary)]">AI Quote Generator</p>
              <p className="text-xs text-[var(--text-muted)]">{opp.title}</p>
            </div>
          </div>
          <button onClick={onClose} className="text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6">
          <AnimatePresence mode="wait">
            {phase === 'loading' && (
              <motion.div key="loading" exit={{ opacity: 0 }} className="flex flex-col items-center py-12">
                <div className="w-16 h-16 rounded-full border-2 border-teal-500/20 border-t-teal-500 animate-spin mb-4" />
                <p className="text-[var(--text-primary)] font-semibold">Analyzing deal parameters...</p>
                <p className="text-[var(--text-muted)] text-sm mt-1">Fetching market data for {opp.company}</p>
              </motion.div>
            )}

            {phase === 'thinking' && (
              <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 py-4">
                <div className="flex items-center gap-2 text-sm text-[var(--text-muted)]">
                  <Sparkles className="w-4 h-4 text-teal-400 animate-pulse" />
                  <span>Running pricing models...</span>
                </div>
                {['Analyzing comparable GCC deals', 'Evaluating competitor positioning', 'Computing margin scenarios', 'Generating confidence scores'].map((step, i) => (
                  <motion.div
                    key={step}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.3 }}
                    className="flex items-center gap-2 text-xs text-[var(--text-muted)] pl-6"
                  >
                    <div className="w-1.5 h-1.5 rounded-full bg-teal-400 animate-pulse" />
                    {step}
                  </motion.div>
                ))}
              </motion.div>
            )}

            {phase === 'done' && (
              <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                {error ? (
                  <div className="py-10 text-center">
                    <div className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
                      <AlertCircle className="w-6 h-6 text-red-400" />
                    </div>
                    <p className="text-[var(--text-primary)] font-semibold">Generation Failed</p>
                    <p className="text-[var(--text-muted)] text-sm mt-1">{error}</p>
                    <button onClick={onClose} className="mt-6 text-teal-400 hover:underline text-sm font-medium">
                      Go back and try again
                    </button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {quotes.map((quote, i) => (
                      <motion.div
                        key={quote.type}
                        initial={{ opacity: 0, y: 16 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: i * 0.1 }}
                        className={`rounded-xl border p-4 relative ${
                          quote.type === 'primary'
                            ? 'bg-teal-500/5 border-teal-500/30'
                            : quote.type === 'conservative'
                            ? 'bg-blue-500/5 border-blue-500/20'
                            : 'bg-amber-500/5 border-amber-500/20'
                        }`}
                      >
                        {quote.type === 'primary' && (
                          <div className="absolute -top-2 left-4">
                            <span className="bg-teal-500 text-slate-900 text-xs font-bold px-2 py-0.5 rounded-full">AI Pick</span>
                          </div>
                        )}
  
                        <p className={`text-xs font-semibold uppercase tracking-wider mb-3 mt-1 ${
                          quote.type === 'primary' ? 'text-teal-400' : quote.type === 'conservative' ? 'text-blue-400' : 'text-amber-400'
                        }`}>{quote.label}</p>
  
                        <p className="text-2xl font-bold text-[var(--text-primary)] mb-3">{formatAED(quote.total)}</p>
  
                        <div className="space-y-1.5 text-xs mb-4">
                          <div className="flex justify-between text-[var(--text-muted)]">
                            <span>Base Price</span>
                            <span className="text-[var(--text-secondary)]">{formatAED(quote.basePrice)}</span>
                          </div>
                          <div className="flex justify-between text-[var(--text-muted)]">
                            <span>Margin</span>
                            <span className="text-emerald-400">{quote.margin}%</span>
                          </div>
                          <div className="flex justify-between text-[var(--text-muted)]">
                            <span>VAT (5%)</span>
                            <span className="text-[var(--text-secondary)]">{formatAED(quote.vat)}</span>
                          </div>
                        </div>
  
                        <div className="mb-3">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-[var(--text-muted)]">Win Confidence</span>
                            <span className={`font-semibold ${quote.confidence >= 85 ? 'text-teal-400' : quote.confidence >= 70 ? 'text-amber-400' : 'text-red-400'}`}>
                              {quote.confidence}%
                            </span>
                          </div>
                          <div className="bg-[var(--bg-elevated)] rounded-full h-1.5 overflow-hidden">
                            <motion.div
                              initial={{ width: 0 }}
                              animate={{ width: `${quote.confidence}%` }}
                              transition={{ duration: 0.8, delay: 0.3 + i * 0.1 }}
                              className={`h-full rounded-full ${
                                quote.confidence >= 85 ? 'bg-teal-500' : quote.confidence >= 70 ? 'bg-amber-500' : 'bg-red-500'
                              }`}
                            />
                          </div>
                        </div>
  
                        <p className="text-xs text-[var(--text-muted)] leading-relaxed">{quote.justification}</p>
  
                        <button 
                          onClick={() => onApply(quote)}
                          className={`w-full mt-4 py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
                            quote.type === 'primary'
                              ? 'bg-teal-500 hover:bg-teal-400 text-slate-900'
                              : 'bg-[var(--bg-elevated)] hover:bg-slate-700 text-[var(--text-secondary)] border border-[var(--border)]'
                          }`}
                        >
                          Use This Quote
                        </button>
                      </motion.div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  )
}

import OpportunityFormDrawer from '../components/forms/OpportunityFormDrawer'

export default function OpportunitiesPage({ addToast, canEdit }: Props) {
  const [opps, setOpps] = useState<Opportunity[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOpp, setSelectedOpp] = useState<Opportunity | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [editOpp, setEditOpp] = useState<Opportunity | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchOpps = async () => {
    try {
      const data = await oppsApi.list()
      setOpps(data)
    } catch (err: any) {
      addToast({ message: 'Failed to load opportunities', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchOpps()
  }, [])

  const handleSave = async (data: any) => {
    try {
      if (editOpp) {
        const updated = await oppsApi.update(editOpp.id, data)
        setOpps(prev => prev.map(o => o.id === updated.id ? updated : o))
        addToast({ message: 'Opportunity updated', type: 'success' })
      } else {
        const created = await oppsApi.create(data)
        setOpps(prev => [created, ...prev])
        addToast({ message: 'Opportunity created', type: 'success' })
      }
    } catch (err: any) {
      throw err
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this opportunity?')) return
    try {
      await oppsApi.delete(id)
      setOpps(prev => prev.filter(o => o.id !== id))
      setSelectedIds(prev => prev.filter(i => i !== id))
      addToast({ message: 'Opportunity deleted', type: 'info' })
    } catch (err) {
      addToast({ message: 'Failed to delete', type: 'error' })
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} opportunities?`)) return
    try {
      await oppsApi.bulkDelete(selectedIds)
      setOpps(prev => prev.filter(o => !selectedIds.includes(o.id)))
      addToast({ message: `${selectedIds.length} opportunities deleted`, type: 'info' })
      setSelectedIds([])
    } catch (err) {
      addToast({ message: 'Failed to delete selected items', type: 'error' })
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === opps.length) setSelectedIds([])
    else setSelectedIds(opps.map(o => o.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleApplyQuote = async (quote: AIQuote) => {
    if (!selectedOpp) return
    try {
      const updated = await oppsApi.update(selectedOpp.id, {
        value: quote.total,
        notes: `${selectedOpp.notes || ''}\n\n[AI Applied Quote]: ${quote.label} - ${quote.justification} (Confidence: ${quote.confidence}%)`
      })
      setOpps(prev => prev.map(o => o.id === updated.id ? updated : o))
      setSelectedOpp(null)
      addToast({ message: `Applied ${quote.label} pricing to deal`, type: 'success' })
    } catch (err) {
      addToast({ message: 'Failed to apply quote', type: 'error' })
    }
  }

  const handleMarkWon = async (id: string) => {
    try {
      await oppsApi.markWon(id)
      setOpps(prev => prev.filter(o => o.id !== id))
      addToast({ message: 'Opportunity marked as WON! Moved to Deals.', type: 'success' })
    } catch (err) {
      addToast({ message: 'Failed to update status', type: 'error' })
    }
  }

  const handleMarkLost = async (id: string) => {
    try {
      await oppsApi.markLost(id)
      setOpps(prev => prev.filter(o => o.id !== id))
      addToast({ message: 'Opportunity marked as LOST. Moved to Deals archiving.', type: 'info' })
    } catch (err) {
      addToast({ message: 'Failed to update status', type: 'error' })
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)] animate-pulse">Syncing pipeline...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Opportunities</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {opps.length} opportunities · AED {(opps.reduce((s, o) => s + Number(o.value), 0) / 1_000_000).toFixed(1)}M total
          </p>
        </div>
        <button className="btn-primary" onClick={() => { setEditOpp(null); setShowForm(true) }}>
          <Target className="w-4 h-4" />
          New Opportunity
        </button>
      </div>

      <div className="panel overflow-hidden">
        {opps.length === 0 ? (
          <div className="p-20 text-center">
            <Target className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-[var(--text-muted)]">No active opportunities found.</p>
            <button className="mt-4 text-teal-400 hover:underline text-sm" onClick={() => setShowForm(true)}>Create your first deal</button>
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-elevated)]"
                    checked={selectedIds.length === opps.length && opps.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Opportunity</th>
                <th>Company</th>
                <th>Value</th>
                <th>Stage</th>
                <th>Prob.</th>
                <th>Close Date</th>
                <th>AI Quote</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {opps.map((opp, i) => (
                <motion.tr 
                  key={opp.id} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: i * 0.05 }}
                  className={selectedIds.includes(opp.id) ? 'bg-teal-500/5' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-elevated)]"
                      checked={selectedIds.includes(opp.id)}
                      onChange={() => toggleSelect(opp.id)}
                    />
                  </td>
                  <td>
                    <div>
                      <p className="text-sm font-medium text-[var(--text-primary)]">{opp.title}</p>
                      <p className="text-[10px] text-[var(--text-placeholder)] line-clamp-1">{opp.notes}</p>
                    </div>
                  </td>
                  <td><p className="text-sm text-[var(--text-secondary)]">{opp.company}</p></td>
                  <td><p className="text-sm font-semibold text-[var(--text-primary)]">AED {(Number(opp.value) / 1_000_000).toFixed(1)}M</p></td>
                  <td>
                    <span className={`badge border text-[10px] uppercase font-bold ${stageColors[opp.stage as string] || 'bg-slate-500/10'}`}>
                      {stageLabels[opp.stage as string] || opp.stage}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-10 bg-[var(--bg-elevated)] rounded-full h-1 overflow-hidden">
                        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${opp.probability}%` }} />
                      </div>
                      <span className="text-[10px] text-[var(--text-muted)]">{opp.probability}%</span>
                    </div>
                  </td>
                  <td><p className="text-[10px] text-[var(--text-muted)]">{new Date(opp.closeDate).toLocaleDateString()}</p></td>
                  <td>
                    <button
                      onClick={() => setSelectedOpp(opp)}
                      className="flex items-center gap-1.5 text-xs text-teal-400 hover:text-teal-300 bg-teal-500/10 hover:bg-teal-500/20 border border-teal-500/20 px-2.5 py-1 rounded-lg transition-all duration-200"
                    >
                      <BrainCircuit className="w-3.5 h-3.5" />
                      Generate
                    </button>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-1">
                      <button 
                        onClick={() => { setEditOpp(opp); setShowForm(true) }}
                        className="p-1.5 rounded-lg hover:bg-[var(--bg-elevated)] text-[var(--text-muted)] hover:text-white transition-colors"
                        title="Edit Opportunity"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>

                      {opp.stage !== 'CLOSED_WON' && opp.stage !== 'CLOSED_LOST' && (
                        <>
                          <button 
                            onClick={() => handleMarkWon(opp.id)}
                            className="p-1.5 rounded-lg hover:bg-teal-500/10 text-teal-500/60 hover:text-teal-400 transition-colors"
                            title="Mark as Won"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                          </button>
                          <button 
                            onClick={() => handleMarkLost(opp.id)}
                            className="p-1.5 rounded-lg hover:bg-red-500/10 text-red-500/60 hover:text-red-400 transition-colors"
                            title="Mark as Lost"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}

                      <button 
                        onClick={() => handleDelete(opp.id)}
                        className="p-1.5 rounded-lg hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-[var(--border)] rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6"
          >
            <span className="text-sm font-medium text-white">{selectedIds.length} items selected</span>
            <div className="h-6 w-px bg-slate-700" />
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
            <button
              onClick={() => setSelectedIds([])}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>

      {selectedOpp && (
        <AIQuoteModal opp={selectedOpp} onClose={() => setSelectedOpp(null)} onApply={handleApplyQuote} />
      )}

      {showForm && (
        <OpportunityFormDrawer 
          opp={editOpp || undefined} 
          onSave={handleSave} 
          onClose={() => { setShowForm(false); setEditOpp(null) }} 
        />
      )}
    </div>
  )
}
