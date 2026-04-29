import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { DollarSign, FileText, Loader2, X, Plus, CheckCircle, Trash2 } from 'lucide-react'
import { invoicesApi, clientsApi } from '../lib/api'
import type { Invoice, InvoiceStatus } from '../types'
import type { Toast } from '../components/ui/Toast'

interface Props {
  canEdit: boolean
  addToast: (t: Omit<Toast, 'id'>) => void
}

const statusConfig: Record<string, { label: string; class: string }> = {
  PENDING: { label: 'Pending', class: 'bg-amber-500/10 text-amber-400 border-amber-500/20' },
  PARTIALLY_PAID: { label: 'Partially Paid', class: 'bg-blue-500/10 text-blue-400 border-blue-500/20' },
  PAID: { label: 'Paid', class: 'bg-teal-500/10 text-teal-400 border-teal-500/20' },
}

const EMPTY_FORM = {
  invoiceNumber: 'INV-' + Math.floor(1000 + Math.random() * 9000),
  amount: '',
  dueDate: new Date(Date.now() + 30 * 24 * 3600 * 1000).toISOString().split('T')[0],
  status: 'pending' as InvoiceStatus,
  items: '',
  clientId: '',
}

function InvoiceFormDrawer({ clients, onSave, onClose }: {
  clients: any[]; onSave: (data: any) => Promise<void>; onClose: () => void
}) {
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const handleSave = async () => {
    if (!form.clientId || !form.amount) {
      setError('Client and amount are required.')
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
              <FileText className="w-4 h-4" />
            </div>
            <div>
              <h2 className="font-bold text-[var(--text-primary)]">New Invoice</h2>
              <p className="text-xs text-[var(--text-muted)]">Generate a billing request for a client</p>
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
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Invoice Number</label>
              <input className="input-field" value={form.invoiceNumber} onChange={e => setForm({...form, invoiceNumber: e.target.value})} />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Select Client *</label>
              <select className="input-field" value={form.clientId} onChange={e => setForm({...form, clientId: e.target.value})}>
                <option value="">Choose a client...</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Amount (AED) *</label>
                <input type="number" className="input-field" value={form.amount} onChange={e => setForm({...form, amount: e.target.value})} />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Due Date</label>
                <input type="date" className="input-field" value={form.dueDate} onChange={e => setForm({...form, dueDate: e.target.value})} />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider text-[var(--text-muted)]">Description / Items</label>
              <textarea className="input-field h-24 resize-none" value={form.items} onChange={e => setForm({...form, items: e.target.value})} placeholder="e.g. Software License Fee..." />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle className="w-4 h-4" />}
              {saving ? 'Creating...' : 'Create Invoice'}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </motion.div>
    </div>
  )
}

export default function FinancePage({ addToast, canEdit }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  const fetchData = async () => {
    try {
      const [invData, clientData] = await Promise.all([
        invoicesApi.list(),
        clientsApi.list()
      ])
      setInvoices(invData)
      setClients(clientData)
    } catch (err: any) {
      addToast({ message: 'Failed to load financial data', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [])

  const updateStatus = async (id: string, status: InvoiceStatus) => {
    try {
      await invoicesApi.updateStatus(id, status)
      setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status } : inv))
      addToast({ message: `Invoice updated to ${statusConfig[status].label}`, type: 'success' })
    } catch (err) {
      addToast({ message: 'Failed to update invoice status', type: 'error' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this invoice?')) return
    try {
      await invoicesApi.delete(id)
      setInvoices(prev => prev.filter(inv => inv.id !== id))
      setSelectedIds(prev => prev.filter(i => i !== id))
      addToast({ message: 'Invoice deleted', type: 'info' })
    } catch (err) {
      addToast({ message: 'Failed to delete invoice', type: 'error' })
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} invoices?`)) return
    try {
      await invoicesApi.bulkDelete(selectedIds)
      setInvoices(prev => prev.filter(inv => !selectedIds.includes(inv.id)))
      addToast({ message: `${selectedIds.length} invoices deleted`, type: 'info' })
      setSelectedIds([])
    } catch (err) {
      addToast({ message: 'Failed to delete selected items', type: 'error' })
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === invoices.length) setSelectedIds([])
    else setSelectedIds(invoices.map(inv => inv.id))
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleCreate = async (data: any) => {
    try {
      const created = await invoicesApi.create(data)
      setInvoices(prev => [created, ...prev])
      addToast({ message: 'Invoice generated successfully', type: 'success' })
    } catch (err: any) {
      throw err
    }
  }

  const totalPending = invoices.filter(i => i.status === 'PENDING').reduce((s, i) => s + Number(i.amount), 0)
  const totalPaid = invoices.filter(i => i.status === 'PAID').reduce((s, i) => s + Number(i.amount), 0)

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)] animate-pulse">Syncing ledger...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Finance</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">{invoices.length} invoices · AED {(totalPending / 1_000_000).toFixed(2)}M pending</p>
        </div>
        <button className="btn-primary" onClick={() => setShowForm(true)}>
          <Plus className="w-4 h-4" />
          New Invoice
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Outstanding', value: `AED ${(totalPending / 1_000_000).toFixed(2)}M`, color: 'text-amber-400', bg: 'bg-amber-500/10' },
          { label: 'Collected', value: `AED ${(totalPaid / 1_000_000).toFixed(2)}M`, color: 'text-teal-400', bg: 'bg-teal-500/10' },
          { label: 'Total Invoiced', value: `AED ${(invoices.reduce((s, i) => s + Number(i.amount), 0) / 1_000_000).toFixed(2)}M`, color: 'text-blue-400', bg: 'bg-blue-500/10' },
        ].map(({ label, value, color, bg }) => (
          <div key={label} className={`panel p-4 ${bg}`}>
            <p className="text-xs text-[var(--text-muted)] mb-1">{label}</p>
            <p className={`text-xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-[var(--border)] rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6"
          >
            <span className="text-sm font-medium text-white">{selectedIds.length} invoices selected</span>
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

      <div className="panel overflow-hidden">
        {invoices.length === 0 ? (
          <div className="p-20 text-center">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-10" />
            <p className="text-[var(--text-muted)]">No invoices found.</p>
          </div>
        ) : (
          <table className="w-full data-table">
            <thead>
              <tr>
                <th className="w-10">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-elevated)]"
                    checked={selectedIds.length === invoices.length && invoices.length > 0}
                    onChange={toggleSelectAll}
                  />
                </th>
                <th>Invoice #</th>
                <th>Client</th>
                <th>Amount</th>
                <th>Due Date</th>
                <th>Status</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv, i) => (
                <motion.tr 
                  key={inv.id} 
                  initial={{ opacity: 0 }} 
                  animate={{ opacity: 1 }} 
                  transition={{ delay: i * 0.06 }}
                  className={selectedIds.includes(inv.id) ? 'bg-teal-500/5' : ''}
                >
                  <td>
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-[var(--border)] bg-[var(--bg-elevated)]"
                      checked={selectedIds.includes(inv.id)}
                      onChange={() => toggleSelect(inv.id)}
                    />
                  </td>
                  <td><p className="text-xs font-mono text-teal-400">{inv.invoiceNumber}</p></td>
                  <td>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-md bg-[var(--bg-elevated)] flex items-center justify-center text-[10px] font-bold text-teal-400">
                        {(inv as any).client?.name?.charAt(0) || inv.client?.charAt(0)}
                      </div>
                      <p className="text-sm text-[var(--text-secondary)]">{(inv as any).client?.name || inv.client}</p>
                    </div>
                  </td>
                  <td><p className="text-sm font-bold text-[var(--text-primary)]">AED {(Number(inv.amount) / 1_000_000).toFixed(2)}M</p></td>
                  <td><p className="text-xs text-[var(--text-muted)]">{new Date(inv.dueDate).toLocaleDateString()}</p></td>
                  <td>
                    <span className={`badge border text-[10px] uppercase font-bold ${statusConfig[inv.status.toUpperCase()]?.class || ''}`}>
                      {statusConfig[inv.status.toUpperCase()]?.label || inv.status}
                    </span>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-3">
                      <select
                        value={inv.status.toUpperCase()}
                        onChange={e => updateStatus(inv.id, e.target.value as InvoiceStatus)}
                        className="bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-secondary)] text-[10px] rounded px-1.5 py-0.5 focus:outline-none focus:border-teal-500 cursor-pointer"
                      >
                        <option value="PENDING">Pending</option>
                        <option value="PARTIALLY_PAID">Partially Paid</option>
                        <option value="PAID">Paid</option>
                      </select>
                      {canEdit && (
                        <button 
                          onClick={() => handleDelete(inv.id)}
                          className="p-1 rounded-md hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {showForm && (
        <InvoiceFormDrawer 
          clients={clients} 
          onSave={handleCreate} 
          onClose={() => setShowForm(false)} 
        />
      )}
    </div>
  )
}
