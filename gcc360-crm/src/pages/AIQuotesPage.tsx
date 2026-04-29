import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { BrainCircuit, Sparkles, X, Loader2, AlertCircle } from 'lucide-react'
import { oppsApi } from '../lib/api'
import type { Opportunity, AIQuote } from '../types'

function QuotePanel({ opp, onClose }: { opp: Opportunity; onClose: () => void }) {
  const [phase, setPhase] = useState<'loading' | 'thinking' | 'done'>('loading')
  const [quotes, setQuotes] = useState<any[]>([])
  const [error, setError] = useState('')

  const generate = async () => {
    setPhase('loading')
    setError('')
    try {
      // Simulate "thinking" steps for aesthetic
      await new Promise(r => setTimeout(r, 800))
      setPhase('thinking')
      await new Promise(r => setTimeout(r, 1500))
      
      const res = await oppsApi.generateQuote(opp.id)
      setQuotes(res)
      setPhase('done')
    } catch (err: any) {
      setError(err.message || 'AI engine is currently busy. Please try again.')
      setPhase('done')
    }
  }

  useEffect(() => {
    generate()
  }, [opp.id])

  const fmt = (v: number) => `AED ${(Number(v) / 1_000_000).toFixed(2)}M`

  return (
    <div className="rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border)', backgroundColor: 'var(--bg-card)' }}>
      <div className="flex items-center justify-between px-5 py-4" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl flex items-center justify-center bg-teal-500/10 border border-teal-500/20">
            <BrainCircuit className="w-4 h-4 text-teal-400" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[var(--text-primary)]">AI Quote Generator</p>
            <p className="text-xs text-[var(--text-muted)]">{opp.title}</p>
          </div>
        </div>
        <button onClick={onClose} className="text-[var(--text-muted)] hover:text-white"><X className="w-4 h-4" /></button>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {phase === 'loading' && (
            <motion.div key="loading" exit={{ opacity: 0 }} className="flex flex-col items-center py-10">
              <Loader2 className="w-12 h-12 animate-spin mb-4 text-teal-500" />
              <p className="text-sm font-semibold text-[var(--text-primary)]">Analyzing deal parameters...</p>
              <p className="text-xs mt-1 text-[var(--text-muted)]">Fetching market data for {opp.company}</p>
            </motion.div>
          )}

          {phase === 'thinking' && (
            <motion.div key="thinking" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-3 py-3">
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Sparkles className="w-4 h-4 animate-pulse text-teal-400" />
                Running GCC pricing models...
              </div>
              {['Analyzing comparable GCC deals', 'Evaluating competitor positioning', 'Computing margin scenarios', 'Generating confidence scores'].map((step, i) => (
                <motion.div key={step} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.3 }} className="flex items-center gap-2 text-xs pl-6 text-[var(--text-muted)]">
                  <div className="w-1.5 h-1.5 rounded-full animate-pulse bg-teal-400" />
                  {step}
                </motion.div>
              ))}
            </motion.div>
          )}

          {phase === 'done' && error && (
            <motion.div key="error" className="flex flex-col items-center py-10 text-center">
              <AlertCircle className="w-12 h-12 text-red-400 mb-4" />
              <p className="text-sm font-semibold text-red-400">{error}</p>
              <button onClick={generate} className="btn-secondary mt-4">Retry Generation</button>
            </motion.div>
          )}

          {phase === 'done' && !error && (
            <motion.div key="done" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {quotes.map((quote, i) => (
                  <motion.div
                    key={quote.id || i}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`rounded-xl p-4 relative border ${
                      quote.type === 'PRIMARY' ? 'bg-teal-500/5 border-teal-500/30' : 'bg-[var(--bg-elevated)] border-[var(--border)]'
                    }`}
                  >
                    {quote.type === 'PRIMARY' && (
                      <div className="absolute -top-2.5 left-4">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full text-white bg-teal-500">AI PICK</span>
                      </div>
                    )}

                    <p className={`text-[10px] font-bold uppercase tracking-wider mb-3 mt-1 ${
                      quote.type === 'PRIMARY' ? 'text-teal-400' : 'text-[var(--text-muted)]'
                    }`}>
                      {quote.type} SCENARIO
                    </p>

                    <p className="text-2xl font-bold mb-3 text-[var(--text-primary)]">{fmt(quote.total)}</p>

                    <div className="space-y-1.5 text-xs mb-4">
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Base Price</span>
                        <span className="text-[var(--text-secondary)]">{fmt(quote.basePrice)}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">Margin</span>
                        <span className="text-emerald-400 font-bold">{quote.margin}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-[var(--text-muted)]">VAT (5%)</span>
                        <span className="text-[var(--text-secondary)]">{fmt(quote.vat)}</span>
                      </div>
                    </div>

                    <div className="mb-3">
                      <div className="flex justify-between text-[10px] mb-1">
                        <span className="text-[var(--text-muted)]">WIN CONFIDENCE</span>
                        <span className="font-bold text-teal-400">{quote.confidence}%</span>
                      </div>
                      <div className="h-1 bg-[var(--border)] rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${quote.confidence}%` }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="h-full bg-teal-500"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] leading-relaxed mb-4 text-[var(--text-muted)] italic">"{quote.justification}"</p>

                    <button className="btn-primary w-full justify-center text-[10px] h-8">
                      Apply Quote
                    </button>
                  </motion.div>
                ))}
              </div>

              <div className="flex items-start gap-2 px-4 py-3 rounded-xl bg-teal-500/5 border border-teal-500/10">
                <Sparkles className="w-3.5 h-3.5 mt-0.5 text-teal-400" />
                <p className="text-[10px] text-[var(--text-muted)]">
                  GCC360 Intelligence Engine v4.0 — Market data synced {new Date().toLocaleDateString()}.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

export default function AIQuotesPage() {
  const [opps, setOpps] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [showPanel, setShowPanel] = useState(false)

  useEffect(() => {
    oppsApi.list().then(data => {
      setOpps(data)
      if (data.length > 0) setSelectedId(data[0].id)
    }).finally(() => setLoading(false))
  }, [])

  const selectedOpp = opps.find(o => o.id === selectedId)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)]">Loading opportunities...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h2 className="text-xl font-bold text-[var(--text-primary)]">AI Quote Generator</h2>
        <p className="text-sm text-[var(--text-muted)]">Automated pricing intelligence based on historical data</p>
      </div>

      {opps.length === 0 ? (
        <div className="panel p-20 text-center">
          <BrainCircuit className="w-12 h-12 mx-auto mb-4 opacity-10" />
          <p className="text-[var(--text-muted)]">No opportunities found. Create one to generate quotes.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          <div className="space-y-2">
            {opps.map(o => (
              <button
                key={o.id}
                onClick={() => { setSelectedId(o.id); setShowPanel(false) }}
                className={`w-full text-left p-4 rounded-xl transition-all border ${
                  selectedId === o.id ? 'bg-teal-500/10 border-teal-500/30' : 'bg-[var(--bg-card)] border-[var(--border)] hover:border-teal-500/20'
                }`}
              >
                <p className={`text-sm font-bold ${selectedId === o.id ? 'text-teal-400' : 'text-[var(--text-primary)]'}`}>{o.company}</p>
                <p className="text-[10px] text-[var(--text-muted)] mt-1">AED {(Number(o.value) / 1_000_000).toFixed(1)}M · {o.stage}</p>
              </button>
            ))}
          </div>

          <div className="lg:col-span-3">
            {selectedOpp && !showPanel && (
              <div className="panel p-12 text-center border-dashed flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-teal-500/10 flex items-center justify-center mb-4">
                  <BrainCircuit className="w-8 h-8 text-teal-400" />
                </div>
                <h3 className="text-lg font-bold text-[var(--text-primary)]">Analyze {selectedOpp.company}</h3>
                <p className="text-sm text-[var(--text-muted)] max-w-sm mx-auto mt-2 mb-6">
                  Ready to compute optimal pricing for <span className="text-[var(--text-primary)] font-semibold">{selectedOpp.title}</span>? 
                  Our engine will evaluate margin, win probability, and competitive risk.
                </p>
                <button onClick={() => setShowPanel(true)} className="btn-primary px-8 h-10">
                  <Sparkles className="w-4 h-4" />
                  Generate AI Quote
                </button>
              </div>
            )}

            {selectedOpp && showPanel && (
              <QuotePanel opp={selectedOpp} onClose={() => setShowPanel(false)} />
            )}
          </div>
        </div>
      )}
    </div>
  )
}