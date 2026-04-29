import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Users, Search, Plus, X, Mail, Phone, Edit3, Trash2,
  AlertCircle, Loader2, CheckCircle, Send, Tag,
  User, Briefcase, Building2, MessageSquare, ChevronRight, Zap
} from 'lucide-react'
import { contactsApi, clientsApi, usersApi, aiApi, emailApi } from '../lib/api'
import type { Toast } from '../components/ui/Toast'

interface Props {
  canEdit: boolean
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

const STATUS_CFG = {
  ACTIVE:   { label: 'Active',   color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  INACTIVE: { label: 'Inactive', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
}

const EMPTY: Record<string, string> = {
  firstName: '', lastName: '', jobTitle: '', department: '',
  email: '', phone: '', mobile: '', ownerId: '', status: 'ACTIVE',
  clientId: '', company: '', notes: '', tags: '',
}

function IF({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

// ── Mail Modal ─────────────────────────────────────────────────────────────────
function MailModal({ contact, onClose, addToast }: { contact: any; onClose: () => void; addToast: (t: any) => void }) {
  const [subject, setSubject] = useState(`Hello ${contact.firstName}`)
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const name = `${contact.firstName} ${contact.lastName}`

  const draftWithAI = async () => {
    setAiLoading(true)
    try {
      const d = await aiApi.draftEmail(contact.id, 'contact')
      setSubject(d.subject || subject)
      setBody(d.body || '')
    } catch { 
      addToast({ message: 'AI unavailable — write manually', type: 'error' }) 
    } finally { 
      setAiLoading(false) 
    }
  }

  const send = async () => {
    if (!contact.email) { addToast({ message: 'No email on file for this contact.', type: 'error' }); return }
    if (!body.trim()) { addToast({ message: 'Please write a message.', type: 'error' }); return }
    setSending(true)
    try {
      await emailApi.send(contact.email, subject, body)
      addToast({ message: 'Email sent successfully!', type: 'success' })
      onClose()
    } catch (e: any) {
      addToast({ message: e.message || 'Failed to send email', type: 'error' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--accent-muted)' }}>
              <Mail className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Email {name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{contact.email}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input className="input-field" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea className="input-field resize-none" rows={6} placeholder="Write your message or use AI Draft..." value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <button className="btn-primary flex items-center gap-2" onClick={send} disabled={sending}>
            <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send'}
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={draftWithAI} disabled={aiLoading}>
            <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} /> {aiLoading ? 'Drafting...' : 'AI Draft'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Contact Detail Panel ───────────────────────────────────────────────────────
function ContactDetail({ contact, onClose, onEdit, onMail, canEdit }: { contact: any; onClose: () => void; onEdit: () => void; onMail: () => void; canEdit: boolean }) {
  const st = STATUS_CFG[contact.status as keyof typeof STATUS_CFG] || STATUS_CFG.ACTIVE
  const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase()

  return (
    <motion.div initial={{ x: 420, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 420, opacity: 0 }}
      className="fixed right-0 top-0 h-full w-full max-w-md z-40 overflow-y-auto shadow-2xl"
      style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
      <div className="sticky top-0 z-10 p-5" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #14b8a6, #3b82f6)' }}>
              {initials}
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{contact.firstName} {contact.lastName}</h3>
              <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{contact.jobTitle || '—'}</p>
              <span className="text-xs font-semibold" style={{ color: st.color }}>● {st.label}</span>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          <button onClick={onMail} className="btn-secondary flex-1 text-xs justify-center"><Mail className="w-3.5 h-3.5" /> Email</button>
          {contact.phone && (
            <a href={`tel:${contact.phone}`} className="btn-secondary flex-1 text-xs justify-center flex items-center gap-1.5">
              <Phone className="w-3.5 h-3.5" /> Call
            </a>
          )}
          {canEdit && <button onClick={onEdit} className="btn-secondary text-xs px-3"><Edit3 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      <div className="p-5 space-y-4">
        {/* Company */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div className="flex items-center gap-2 mb-1">
            <Building2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Company</p>
          </div>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{contact.client?.name || contact.company || '—'}</p>
          {contact.department && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{contact.department}</p>}
        </div>

        {/* Contact details */}
        {[
          { icon: Mail,     label: 'Email',     value: contact.email,  href: `mailto:${contact.email}`  },
          { icon: Phone,    label: 'Phone',     value: contact.phone,  href: `tel:${contact.phone}`     },
          { icon: Phone,    label: 'Mobile',    value: contact.mobile, href: `tel:${contact.mobile}`    },
          { icon: User,     label: 'Owner',     value: contact.ownerId || '—' },
          { icon: Briefcase,label: 'Opps',     value: contact.linkedOpportunities ? `${contact.linkedOpportunities} linked` : '0 linked' },
          { icon: Building2,label: 'Last Active', value: contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString('en-GB') : '—' },
        ].filter(r => r.value).map(row => (
          <div key={row.label} className="flex items-center gap-3">
            <row.icon className="w-4 h-4 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</p>
              {row.href ? (
                <a href={row.href} className="text-sm font-medium" style={{ color: 'var(--accent)' }}>{row.value}</a>
              ) : (
                <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.value}</p>
              )}
            </div>
          </div>
        ))}

        {contact.notes && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{contact.notes}</p>
          </div>
        )}
        {contact.tags && (
          <div className="flex flex-wrap gap-1.5">
            {contact.tags.split(',').map((tag: string) => (
              <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs"
                style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                <Tag className="w-3 h-3" />{tag.trim()}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── Contact Form ───────────────────────────────────────────────────────────────
function ContactForm({ contact, clients, users, onSave, onClose }: { contact?: any; clients: any[]; users: any[]; onSave: (d: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY, ...(contact ? { ...contact } : {}) })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set  = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))

  // When client changes, auto-fill company name
  const handleClientChange = (clientId: string) => {
    const client = clients.find(c => c.id === clientId)
    setForm(f => ({ ...f, clientId, company: client?.name || f.company }))
  }

  const handleSave = async () => {
    if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
      setError('First name, last name, and email are required.')
      return
    }
    setSaving(true); setError('')
    try { await onSave(form); onClose() }
    catch (e: any) { setError(e.message || 'Failed to save.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="ml-auto w-full max-w-xl h-full overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
        <div className="sticky top-0 z-10 flex items-center justify-between p-6" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-muted)' }}>
              <Users className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{contact ? 'Edit Contact' : 'Add New Contact'}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Person inside a client company</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-6">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Basic Info */}
          <FormSec title="Basic Information" icon={User}>
            <div className="grid grid-cols-2 gap-3">
              <IF label="First Name" required>
                <input className="input-field" placeholder="Mohammed" value={form.firstName} onChange={set('firstName')} />
              </IF>
              <IF label="Last Name" required>
                <input className="input-field" placeholder="Al-Hameli" value={form.lastName} onChange={set('lastName')} />
              </IF>
              <IF label="Company (Client)">
                <select className="input-field" value={form.clientId} onChange={e => handleClientChange(e.target.value)}>
                  <option value="">Select a client (or type below)</option>
                  {clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </IF>
              <IF label="Or Type Company Name">
                <input className="input-field" placeholder="If not in list" value={form.company} onChange={set('company')} />
              </IF>
              <IF label="Job Title">
                <input className="input-field" placeholder="VP Technology" value={form.jobTitle} onChange={set('jobTitle')} />
              </IF>
              <IF label="Department">
                <input className="input-field" placeholder="IT, Procurement..." value={form.department} onChange={set('department')} />
              </IF>
            </div>
          </FormSec>

          {/* Communication */}
          <FormSec title="Communication" icon={Mail}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <IF label="Work Email" required>
                  <input type="email" className="input-field" placeholder="contact@company.com" value={form.email} onChange={set('email')} />
                </IF>
              </div>
              <IF label="Phone Number">
                <input className="input-field" placeholder="+971 2 000 0000" value={form.phone} onChange={set('phone')} />
              </IF>
              <IF label="Mobile">
                <input className="input-field" placeholder="+971 50 000 0000" value={form.mobile} onChange={set('mobile')} />
              </IF>
            </div>
          </FormSec>

          {/* Status */}
          <FormSec title="Status & Ownership" icon={Briefcase}>
            <div className="grid grid-cols-2 gap-3">
              <IF label="Contact Owner">
                <select className="input-field" value={form.ownerId} onChange={set('ownerId')}>
                  <option value="">Not assigned</option>
                  {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </IF>
              <IF label="Status">
                <select className="input-field" value={form.status} onChange={set('status')}>
                  <option value="ACTIVE">Active</option>
                  <option value="INACTIVE">Inactive</option>
                </select>
              </IF>
            </div>
          </FormSec>

          {/* Notes & Tags */}
          <FormSec title="Notes & Tags" icon={MessageSquare}>
            <div className="space-y-3">
              <IF label="Notes">
                <textarea className="input-field resize-none" rows={3} placeholder="Relationship history, preferences, key info..." value={form.notes} onChange={set('notes')} />
              </IF>
              <IF label="Tags (comma-separated)">
                <input className="input-field" placeholder="decision-maker, technical, procurement" value={form.tags} onChange={set('tags')} />
              </IF>
            </div>
          </FormSec>

          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> {contact ? 'Save Changes' : 'Create Contact'}</>}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormSec({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-xs font-bold uppercase tracking-widest mb-3 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </h3>
      <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        {children}
      </div>
    </div>
  )
}

// ── Main ───────────────────────────────────────────────────────────────────────
export default function ContactsPage({ canEdit, searchQuery, onSearchChange }: Props) {
  const [contacts,  setContacts]  = useState<any[]>([])
  const [clients,   setClients]   = useState<any[]>([])
  const [users,     setUsers]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [internalSearch, setInternalSearch] = useState('')
  const [selected,  setSelected]  = useState<any | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<any | null>(null)
  const [mailItem,  setMailItem]  = useState<any | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [toasts,    setToasts]    = useState<any[]>([])

  const addToast = (t: any) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...t, id }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500)
  }

  useEffect(() => {
    Promise.all([
      contactsApi.list().then(setContacts),
      clientsApi.list().then(setClients),
      usersApi.list().then(setUsers),
    ]).finally(() => setLoading(false))
  }, [])

  const search = searchQuery ?? internalSearch
  const setSearch = onSearchChange ?? setInternalSearch

  const filtered = contacts.filter(c => {
    const q = search.toLowerCase()
    const name = `${c.firstName} ${c.lastName}`.toLowerCase()
    return !search || name.includes(q) || c.email?.toLowerCase().includes(q) || c.company?.toLowerCase().includes(q) || c.jobTitle?.toLowerCase().includes(q)
  })

  const handleCreate = async (data: any) => {
    const contact = await contactsApi.create(data)
    setContacts(prev => [contact, ...prev])
    addToast({ message: `Contact created: ${data.firstName} ${data.lastName}`, type: 'success' })
  }

  const handleEdit = async (data: any) => {
    const contact = await contactsApi.update(editItem.id, data)
    setContacts(prev => prev.map(c => c.id === contact.id ? contact : c))
    setSelected(contact)
    addToast({ message: 'Contact updated', type: 'success' })
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this contact?')) return
    await contactsApi.delete(id)
    setContacts(prev => prev.filter(c => c.id !== id))
    setSelected(null)
    setSelectedIds(prev => prev.filter(i => i !== id))
    addToast({ message: 'Contact deleted', type: 'info' })
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} contacts?`)) return
    try {
      await contactsApi.bulkDelete(selectedIds)
      setContacts(prev => prev.filter(c => !selectedIds.includes(c.id)))
      setSelectedIds([])
      addToast({ message: `${selectedIds.length} contacts deleted`, type: 'info' })
    } catch (e: any) {
      addToast({ message: e.message || 'Bulk delete failed', type: 'error' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([])
    else setSelectedIds(filtered.map(c => c.id))
  }

  const uniqueCompanies = new Set(contacts.map(c => c.client?.name || c.company)).size

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Toast */}
      {toasts.map(t => (
        <div key={t.id} className="fixed top-4 right-4 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm"
          style={{ backgroundColor: t.type === 'success' ? 'rgba(20,184,166,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${t.type === 'success' ? 'rgba(20,184,166,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: t.type === 'success' ? '#2dd4bf' : '#f87171' }}>
          {t.message}
        </div>
      ))}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Contacts</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{contacts.length} contacts across {uniqueCompanies} companies</p>
        </div>
        <div className="flex items-center gap-3">
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div initial={{ x: 20, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 20, opacity: 0 }}
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20 mr-2">
                <span className="text-xs font-bold text-red-400">{selectedIds.length} selected</span>
                <button onClick={handleBulkDelete} className="btn-secondary py-1.5 px-3 text-xs bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
          {canEdit && (
            <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
              <Plus className="w-4 h-4" /> Add Contact
            </button>
          )}
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Contacts', value: contacts.length,                                          color: '#14b8a6' },
          { label: 'Active',         value: contacts.filter(c => c.status === 'ACTIVE').length,        color: '#10b981' },
          { label: 'Companies',      value: uniqueCompanies,                                           color: '#3b82f6' },
          { label: 'Decision Makers',value: contacts.filter(c => c.linkedOpportunities > 0).length,   color: '#f59e0b' },
        ].map(k => (
          <div key={k.label} className="kpi-card text-center">
            <p className="text-xl font-bold" style={{ color: k.color }}>{k.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{k.label}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="panel p-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, company, email, title..." className="input-field pl-9 py-2 text-sm" />
        </div>
      </div>

      {/* Table */}
      <div className="panel overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th className="w-10 pl-5">
                <input type="checkbox" checked={selectedIds.length === filtered.length && filtered.length > 0} onChange={toggleSelectAll} className="rounded border-gray-700 bg-gray-800" />
              </th>
              <th>Contact</th>
              <th>Title / Department</th>
              <th>Company</th>
              <th>Email</th>
              <th>Phone</th>
              <th>Status</th>
              <th>Last Activity</th>
              <th style={{ width: 90 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((contact, i) => {
              const st      = STATUS_CFG[contact.status as keyof typeof STATUS_CFG] || STATUS_CFG.ACTIVE
              const initials = `${contact.firstName?.[0] || ''}${contact.lastName?.[0] || ''}`.toUpperCase()
              return (
                <tr key={contact.id} className={`group hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer ${selectedIds.includes(contact.id) ? 'bg-accent-muted/20' : ''}`} onClick={() => setSelected(contact)}>
                  <td className="pl-5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(contact.id)} onChange={() => toggleSelect(contact.id)} className="rounded border-gray-700 bg-gray-800" />
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ background: 'linear-gradient(135deg, #14b8a6, #3b82f6)' }}>
                        {initials}
                      </div>
                      <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                        {contact.firstName} {contact.lastName}
                      </p>
                    </div>
                  </td>
                  <td>
                    <p className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{contact.jobTitle || '—'}</p>
                    {contact.department && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{contact.department}</p>}
                  </td>
                  <td><p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{contact.client?.name || contact.company || '—'}</p></td>
                  <td>
                    <a href={`mailto:${contact.email}`} onClick={e => e.stopPropagation()}
                      className="text-xs flex items-center gap-1 hover:underline" style={{ color: 'var(--accent)' }}>
                      <Mail className="w-3 h-3" />{contact.email}
                    </a>
                  </td>
                  <td>
                    {contact.phone && (
                      <a href={`tel:${contact.phone}`} onClick={e => e.stopPropagation()} className="text-xs flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                        <Phone className="w-3 h-3" />{contact.phone}
                      </a>
                    )}
                  </td>
                  <td>
                    <span className="badge text-xs" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                  </td>
                  <td>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {contact.lastActivity ? new Date(contact.lastActivity).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) : '—'}
                    </p>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setMailItem(contact)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 transition-colors"
                        title="Email" style={{ color: 'var(--text-muted)' }}>
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => { setEditItem(contact); setShowForm(true) }} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--text-muted)' }} title="Edit">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(contact.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
                            style={{ color: 'var(--text-muted)' }} title="Delete">
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div className="text-center py-16">
            <Users className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No contacts found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {canEdit ? 'Click "Add Contact" to add your first contact.' : 'No contacts in the system yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {selected && !showForm && !mailItem && (
          <ContactDetail contact={selected} canEdit={canEdit}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditItem(selected); setShowForm(true) }}
            onMail={() => setMailItem(selected)} />
        )}
      </AnimatePresence>

      {showForm && (
        <ContactForm contact={editItem} clients={clients} users={users}
          onSave={editItem ? handleEdit : handleCreate}
          onClose={() => { setShowForm(false); setEditItem(null) }} />
      )}

      {mailItem && <MailModal contact={mailItem} onClose={() => setMailItem(null)} addToast={addToast} />}
    </div>
  )
}
