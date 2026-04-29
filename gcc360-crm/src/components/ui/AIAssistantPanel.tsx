import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, BrainCircuit, Sparkles, Loader2, AlertCircle, Database, Search, TrendingUp } from 'lucide-react'
import { getToken } from '../../lib/api'
import type { UserRole } from '../../types'

interface Props {
  open:     boolean
  onClose:  () => void
  userRole: UserRole
  userName: string
}

interface DataSummary {
  generatedAt: string
  entityCounts: Record<string, number>
  breakdowns: {
    leadStatus: Array<{ key: string; count: number }>
    opportunityStages: Array<{ key: string; count: number }>
    invoiceStatus: Array<{ key: string; count: number }>
  }
}

interface QueryResponse {
  query: string
  shortSummary: string
  details: any
}

const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

export default function AIAssistantPanel({ open, onClose, userName }: Props) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<QueryResponse | null>(null)
  const [error, setError] = useState('')
  const [aiReady,   setAiReady]   = useState<boolean | null>(null)

  const authHeaders = () => {
    const headers: Record<string, string> = {}
    const token = getToken()

    if (token) {
      headers.Authorization = `Bearer ${token}`
    }

    return headers
  }

  const runQuery = async (text: string) => {
    const q = text.trim()
    if (!q || loading) return

    setError('')
    setLoading(true)
    try {
      const res = await fetch(`${BASE}/api/ai/data-query`, {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...authHeaders(),
        },
        body: JSON.stringify({ query: q }),
      })
      const data = await res.json()
      if (res.ok) {
        setResult(data)
        setQuery('')
      } else {
        setError(data.error || 'Unable to fetch data details right now.')
      }
    } catch {
      setError('Unable to fetch data details right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  // Check if AI is configured when panel opens
  useEffect(() => {
    if (!open) return

    fetch(`${BASE}/api/ai/status`, {
      credentials: 'include',
      headers: authHeaders(),
    })
      .then(r => r.json())
      .then(d => setAiReady(d.configured))
      .catch(() => setAiReady(false))
    setError('')
    setQuery('')
    setResult(null)
  }, [open])

  const suggestedQueries = [
    'How many total won deals?',
    'How many deals are cancelled?',
    'How many leads this month?',
    'Give whole CRM short summary',
  ]

  const dataSummary = (result?.details?.summary || null) as DataSummary | null
  const crmEntries = Object.entries(dataSummary?.entityCounts || {})
  const leadBreakdown = dataSummary?.breakdowns?.leadStatus || []

  return (
    <AnimatePresence>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={onClose} />
          <motion.div
            initial={{ x: '100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="fixed right-0 top-0 h-full w-full max-w-md z-50 flex flex-col shadow-2xl"
            style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}
          >
            {/* Header */}
            <div className="flex items-center gap-3 p-4 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-surface)' }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'linear-gradient(135deg, #0D9488, #2563EB)' }}>
                <BrainCircuit className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <p className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Data Intelligence Agent</p>
                <div className="flex items-center gap-1.5">
                  <div className={`w-1.5 h-1.5 rounded-full ${aiReady ? 'bg-green-400' : aiReady === false ? 'bg-red-400' : 'bg-yellow-400'}`} />
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {aiReady === null ? 'Checking...' : aiReady ? 'CRM insights ready' : 'AI not configured'}
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* AI not configured warning */}
            {aiReady === false && (
              <div className="mx-4 mt-4 p-3 rounded-xl flex gap-2" style={{ backgroundColor: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
                <AlertCircle className="w-4 h-4 text-yellow-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs font-semibold text-yellow-400">AI Not Configured</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    Add GROQ_API_KEY to your .env file.<br />
                    Get a free key at <b>console.groq.com</b>
                  </p>
                </div>
              </div>
            )}

            {/* Data Summary */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="text-center py-2">
                <div className="w-14 h-14 rounded-2xl mx-auto mb-3 flex items-center justify-center"
                  style={{ background: 'linear-gradient(135deg, #0D9488, #2563EB)' }}>
                  <Sparkles className="w-7 h-7 text-white" />
                </div>
                <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                  Hello {userName.split(' ')[0]}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Ask a query to get simple English CRM summaries with quick visual insights.
                </p>
              </div>

              <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                <div className="flex gap-2">
                  <input
                    className="input-field flex-1 text-sm"
                    placeholder="Ask: total won deals, cancelled deals, leads this month, whole CRM summary..."
                    value={query}
                    onChange={e => setQuery(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        runQuery(query)
                      }
                    }}
                    disabled={loading}
                  />
                  <button
                    onClick={() => runQuery(query)}
                    disabled={!query.trim() || loading}
                    className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-all disabled:opacity-40"
                    style={{ backgroundColor: 'var(--accent)', color: '#fff' }}
                  >
                    {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                  </button>
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestedQueries.map(sq => (
                    <button
                      key={sq}
                      onClick={() => runQuery(sq)}
                      className="text-[11px] px-2 py-1 rounded-full"
                      style={{ backgroundColor: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}
                      disabled={loading}
                    >
                      {sq}
                    </button>
                  ))}
                </div>
              </div>

              {error && (
                <div className="p-3 rounded-xl" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444' }}>
                  <p className="text-xs">{error}</p>
                </div>
              )}

              {result && (
                <>
                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-1" style={{ color: 'var(--text-secondary)' }}>Short Summary</p>
                    <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{result.shortSummary}</p>
                  </div>

                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <Database className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>CRM Metrics</p>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {crmEntries.map(([k, v]) => (
                        <div key={k} className="rounded-lg px-2.5 py-2" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                          <p className="text-[10px] uppercase" style={{ color: 'var(--text-muted)' }}>{k}</p>
                          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{v}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-2 mb-2">
                      <TrendingUp className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                      <p className="text-xs font-bold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>Lead Status Visualization</p>
                    </div>
                    <div className="space-y-2">
                      {leadBreakdown.map(item => {
                        const total = leadBreakdown.reduce((sum, row) => sum + row.count, 0) || 1
                        const width = `${Math.max(6, Math.round((item.count / total) * 100))}%`
                        return (
                          <div key={item.key}>
                            <div className="flex items-center justify-between text-[11px] mb-1" style={{ color: 'var(--text-secondary)' }}>
                              <span>{item.key}</span>
                              <span>{item.count}</span>
                            </div>
                            <div className="h-2 rounded-full" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                              <div className="h-full rounded-full" style={{ width, background: 'linear-gradient(90deg, #14b8a6, #3b82f6)' }} />
                            </div>
                          </div>
                        )
                      })}
                      {leadBreakdown.length === 0 && (
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No lead status data available yet.</p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text-secondary)' }}>English Insight</p>
                    <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      {`Based on your query, ${result.shortSummary.toLowerCase()} Keep focus on hot leads and overdue follow-ups to improve conversions.`}
                    </p>
                  </div>

                  {dataSummary && (
                    <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>
                      Updated: {new Date(dataSummary.generatedAt).toLocaleString()}
                    </p>
                  )}
                </>
              )}
            </div>

            {/* Footer */}
            <div className="p-4 flex-shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
              <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                Top panel: query-based data agent · Floating bot: CRM guidance chat
              </p>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
