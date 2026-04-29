import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  UserPlus, Search, Filter, X, ChevronDown, CheckCircle, Mail, Phone,
  Building2, Globe, Tag, AlertCircle, Loader2, Trash2, Edit3, ExternalLink,
  TrendingUp, Clock, User, FileText, Zap, Send, FileUp, PhoneCall
} from 'lucide-react'
import { leadsApi, usersApi, aiApi, emailImportApi, voiceApi, emailApi } from '../lib/api'
import type { Toast } from '../components/ui/Toast'
import type { PageKey } from '../components/layout/AppShell'

interface Props {
  canEdit: boolean
  addToast: (t: Omit<Toast, 'id'>) => void
  onNavigate: (page: PageKey) => void
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

const STATUS_CFG = {
  NEW:           { label: 'New',          color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  CONTACTED:     { label: 'Contacted',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  QUALIFIED:     { label: 'Qualified',    color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  DISQUALIFIED:  { label: 'Disqualified', color: '#6b7280', bg: 'rgba(107,114,128,0.1)', border: 'rgba(107,114,128,0.25)' },
}

const PRIORITY_CFG = {
  LOW:    { label: 'Low',      color: '#6b7280' },
  MEDIUM: { label: 'Medium',   color: '#f59e0b' },
  HIGH:   { label: 'High',     color: '#ef4444' },
}

const SOURCES   = ['MANUAL', 'WEBSITE', 'EMAIL', 'REFERRAL', 'EVENT', 'LINKEDIN', 'TRADE_SHOW', 'COLD_CALL']
const INDUSTRIES = ['Oil & Gas', 'Energy', 'Construction', 'Finance', 'Government', 'Healthcare', 'Technology', 'Retail', 'Manufacturing', 'Logistics', 'Other']
const COUNTRIES  = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Egypt', 'India', 'Pakistan', 'USA', 'UK', 'Germany', 'Other']
const TIMELINES  = ['< 1 Month', '1–3 Months', '3–6 Months', '6–12 Months', '> 1 Year']

const EMPTY_FORM = {
  title: '', company: '', contactName: '', email: '', phone: '', country: 'UAE',
  source: 'MANUAL', industry: '', value: '', priority: 'MEDIUM',
  expectedTimeline: '', requirements: '', internalNotes: '', tags: '', assignedToId: '',
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444'
  const label = score >= 80 ? 'High' : score >= 60 ? 'Med' : 'Low'
  return (
    <div className="flex items-center gap-1.5">
      <div className="relative w-8 h-8">
        <svg className="w-8 h-8 -rotate-90" viewBox="0 0 32 32">
          <circle cx="16" cy="16" r="12" fill="none" stroke="var(--bg-elevated)" strokeWidth="3" />
          <circle cx="16" cy="16" r="12" fill="none" stroke={color} strokeWidth="3"
            strokeDasharray={`${(score / 100) * 75.4} 75.4`} strokeLinecap="round" />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-[9px] font-bold" style={{ color }}>{score}</span>
      </div>
      <span className="text-xs font-medium" style={{ color }}>{label}</span>
    </div>
  )
}

function InputField({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
        {label} {required && <span className="text-red-400">*</span>}
      </label>
      {children}
    </div>
  )
}

function Select({ value, onChange, options, placeholder }: {
  value: string; onChange: (v: string) => void
  options: string[]; placeholder?: string
}) {
  return (
    <select className="input-field" value={value} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o.replace(/_/g, ' ')}</option>)}
    </select>
  )
}

// ── Mail Compose Mini Modal ────────────────────────────────────────────────────
function MailModal({ lead, onClose, addToast }: { lead: any; onClose: () => void; addToast: any }) {
  const [toEmail, setToEmail] = useState(lead.email || '')
  const [subject, setSubject] = useState(`Re: ${lead.title || lead.company}`)
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)
  const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  // Auto-draft with AI on open
  const draftWithAI = async () => {
    setAiLoading(true)
    try {
      const d = await aiApi.draftEmail(lead.id, 'lead')
      setSubject(d.subject || subject)
      setBody(d.body || '')
    } catch { 
      addToast({ message: 'AI unavailable — write manually', type: 'error' }) 
    } finally { 
      setAiLoading(false) 
    }
  }

  const send = async () => {
    if (!toEmail.trim()) { addToast({ message: 'Please enter a recipient email ID.', type: 'error' }); return }
    if (!body.trim()) { addToast({ message: 'Please write a message.', type: 'error' }); return }
    setSending(true)
    try {
      await emailApi.send(toEmail.trim(), subject, body)
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
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Send Email</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>To: {lead.contactName}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          <input className="input-field" placeholder="Recipient Email ID" value={toEmail} onChange={e => setToEmail(e.target.value)} />
          <input className="input-field" placeholder="Subject" value={subject} onChange={e => setSubject(e.target.value)} />
          <textarea className="input-field resize-none" rows={6} placeholder="Write your message or use AI Draft..." value={body} onChange={e => setBody(e.target.value)} />
        </div>
        <div className="flex gap-2 mt-4 flex-wrap">
          <button className="btn-primary flex items-center gap-2" onClick={send} disabled={sending}>
            <Send className="w-4 h-4" />{sending ? 'Opening...' : 'Send Email'}
          </button>
          <button className="btn-secondary flex items-center gap-2" onClick={draftWithAI} disabled={aiLoading}>
            <Zap className="w-4 h-4" style={{ color: 'var(--accent)' }} />{aiLoading ? 'AI Drafting...' : 'AI Draft'}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Lead Detail Slide-over ─────────────────────────────────────────────────────
function LeadDetailPanel({ lead, onClose, onEdit, onDelete, onQualify, onReject, onMail, onCall, canEdit }: {
  lead: any; onClose: () => void; onEdit: () => void; onDelete: (id: string) => void
  onQualify: () => void; onReject: () => void; onMail: () => void; onCall: () => void; canEdit: boolean
}) {
  const st  = STATUS_CFG[lead.status as keyof typeof STATUS_CFG] || STATUS_CFG.NEW
  const pri = PRIORITY_CFG[lead.priority as keyof typeof PRIORITY_CFG] || PRIORITY_CFG.MEDIUM

  return (
    <motion.div initial={{ x: 400, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 400, opacity: 0 }}
      className="fixed right-0 top-0 h-full w-full max-w-md z-40 overflow-y-auto shadow-2xl"
      style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
      {/* Header */}
      <div className="sticky top-0 z-10 p-5" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white"
              style={{ backgroundColor: st.color }}>
              {lead.company?.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>{lead.company}</h3>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lead.contactName}</p>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Action buttons */}
        <div className="flex gap-2 mt-4 flex-wrap">
          <button onClick={onMail} className="btn-secondary flex-1 text-xs justify-center">
            <Mail className="w-3.5 h-3.5" /> Email
          </button>
          {canEdit && (
            <button onClick={() => { if(confirm('Delete this lead?')) { onDelete(lead.id); onClose(); } }} className="btn-secondary text-xs px-3 hover:bg-red-500/10 hover:text-red-400">
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}
          <button onClick={onCall} className="btn-secondary flex-1 text-xs justify-center flex items-center gap-1.5">
            <PhoneCall className="w-3.5 h-3.5" /> Voice Agent
          </button>
          {canEdit && lead.status !== 'QUALIFIED' && lead.status !== 'DISQUALIFIED' && (
            <div className="flex-1 flex gap-2">
              <button onClick={onQualify} className="btn-primary flex-1 text-xs justify-center">
                <CheckCircle className="w-3.5 h-3.5" /> Qualify
              </button>
              <button onClick={onReject} className="btn-secondary flex-1 text-xs justify-center hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/50">
                <X className="w-3.5 h-3.5" /> Disqualify
              </button>
            </div>
          )}
          {canEdit && (
            <button onClick={onEdit} className="btn-secondary text-xs px-3">
              <Edit3 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-5 space-y-5">
        {/* Status row */}
        <div className="flex flex-wrap gap-2">
          <span className="badge text-xs font-semibold" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
          <span className="badge text-xs font-semibold" style={{ backgroundColor: `${pri.color}15`, color: pri.color, border: `1px solid ${pri.color}30` }}>
            {pri.label} Priority
          </span>
          {lead.fromEmail && <span className="badge text-xs" style={{ backgroundColor: 'rgba(139,92,246,0.1)', color: '#8b5cf6', border: '1px solid rgba(139,92,246,0.25)' }}>📧 Auto-Scanned</span>}
        </div>

        {/* AI Score */}
        <div className="rounded-xl p-4" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>AI Credibility Score</p>
            <ScoreBadge score={lead.aiCredibilityScore} />
          </div>
          <div className="w-full rounded-full overflow-hidden h-1.5" style={{ backgroundColor: 'var(--border)' }}>
            <div className="h-full rounded-full transition-all" style={{ width: `${lead.aiCredibilityScore}%`,
              backgroundColor: lead.aiCredibilityScore >= 80 ? '#10b981' : lead.aiCredibilityScore >= 60 ? '#f59e0b' : '#ef4444' }} />
          </div>
          {lead.aiNotes && <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{lead.aiNotes}</p>}
        </div>

        {/* Key info */}
        {[
          { icon: Building2, label: 'Company',          value: lead.company },
          { icon: User,      label: 'Contact',           value: lead.contactName },
          { icon: Mail,      label: 'Email',             value: lead.email },
          { icon: Phone,     label: 'Phone',             value: lead.phone },
          { icon: Globe,     label: 'Country',           value: lead.country },
          { icon: TrendingUp,label: 'Est. Value',        value: lead.value ? `AED ${parseFloat(lead.value).toLocaleString()}` : '—' },
          { icon: Clock,     label: 'Timeline',          value: lead.expectedTimeline || '—' },
          { icon: Zap,       label: 'Source',            value: lead.source?.replace(/_/g, ' ') || '—' },
          { icon: Building2, label: 'Industry',          value: lead.industry || '—' },
          { icon: User,      label: 'Assigned To',       value: lead.assignedTo?.name || '—' },
        ].map(row => (
          <div key={row.label} className="flex items-start gap-3">
            <row.icon className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: 'var(--text-muted)' }} />
            <div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</p>
              <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.value}</p>
            </div>
          </div>
        ))}

        {lead.requirements && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Requirements</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{lead.requirements}</p>
          </div>
        )}
        {lead.internalNotes && (
          <div className="rounded-xl p-3" style={{ backgroundColor: 'rgba(245,158,11,0.06)', border: '1px solid rgba(245,158,11,0.15)' }}>
            <p className="text-xs font-semibold mb-1" style={{ color: '#f59e0b' }}>Internal Notes</p>
            <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{lead.internalNotes}</p>
          </div>
        )}
        {lead.tags && (
          <div className="flex flex-wrap gap-1.5">
            {lead.tags.split(',').map((tag: string) => (
              <span key={tag} className="flex items-center gap-1 px-2.5 py-1 rounded-full text-xs" style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
                <Tag className="w-3 h-3" />{tag.trim()}
              </span>
            ))}
          </div>
        )}
        <p className="text-xs" style={{ color: 'var(--text-placeholder)' }}>
          Created {new Date(lead.createdAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
        </p>
      </div>
    </motion.div>
  )
}

// ── Add / Edit Lead Drawer ─────────────────────────────────────────────────────
function LeadFormDrawer({ lead, users, onSave, onClose }: {
  lead?: any; users: any[]; onSave: (data: any) => Promise<void>; onClose: () => void
}) {
  const [form, setForm]       = useState(lead ? { ...EMPTY_FORM, ...lead, value: lead.value?.toString() || '' } : { ...EMPTY_FORM })
  const [saving, setSaving]   = useState(false)
  const [error,  setError]    = useState('')
  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((f: typeof EMPTY_FORM) => ({ ...f, [k]: e.target.value }))
  const setVal = (k: string, v: string) => setForm((f: typeof EMPTY_FORM) => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.company || !form.contactName || !form.email) {
      setError('Company, contact name, and email are required.'); return
    }
    setSaving(true); setError('')
    try { await onSave(form); onClose() }
    catch (e: any) { setError(e.message || 'Failed to save.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="ml-auto w-full max-w-xl h-full overflow-y-auto shadow-2xl"
        style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-muted)' }}>
              <UserPlus className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{lead ? 'Edit Lead' : 'Add New Lead'}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lead ? 'Update lead information' : 'Fill in the prospect details'}</p>
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

          {/* Section: Basic Info */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <User className="w-3.5 h-3.5" /> Basic Information
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <InputField label="Lead Title / Subject">
                  <input className="input-field" placeholder="e.g. ERP Software for Drilling Operations" value={form.title} onChange={set('title')} />
                </InputField>
              </div>
              <InputField label="Company Name" required>
                <input className="input-field" placeholder="ADNOC, Aramco..." value={form.company} onChange={set('company')} />
              </InputField>
              <InputField label="Contact Person Name" required>
                <input className="input-field" placeholder="Mohammed Al-Hameli" value={form.contactName} onChange={set('contactName')} />
              </InputField>
              <InputField label="Work Email" required>
                <input type="email" className="input-field" placeholder="contact@company.com" value={form.email} onChange={set('email')} />
              </InputField>
              <InputField label="Phone Number">
                <input className="input-field" placeholder="+971 50 000 0000" value={form.phone} onChange={set('phone')} />
              </InputField>
              <InputField label="Country">
                <Select value={form.country} onChange={v => setVal('country', v)} options={COUNTRIES} />
              </InputField>
              <InputField label="Lead Source">
                <Select value={form.source} onChange={v => setVal('source', v)} options={SOURCES} />
              </InputField>
            </div>
          </div>

          {/* Section: Qualification */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <TrendingUp className="w-3.5 h-3.5" /> Qualification Info
            </h3>
            <div className="grid grid-cols-2 gap-3">
              <InputField label="Industry">
                <Select value={form.industry} onChange={v => setVal('industry', v)} options={INDUSTRIES} placeholder="Select industry" />
              </InputField>
              <InputField label="Estimated Deal Value (AED)">
                <input type="number" className="input-field" placeholder="0" value={form.value} onChange={set('value')} />
              </InputField>
              <InputField label="Priority">
                <Select value={form.priority} onChange={v => setVal('priority', v)} options={['LOW', 'MEDIUM', 'HIGH']} />
              </InputField>
              <InputField label="Expected Timeline">
                <Select value={form.expectedTimeline} onChange={v => setVal('expectedTimeline', v)} options={TIMELINES} placeholder="Select timeline" />
              </InputField>
              <div className="col-span-2">
                <InputField label="Assign To">
                  <select className="input-field" value={form.assignedToId} onChange={set('assignedToId')}>
                    <option value="">Assign to yourself</option>
                    {users.map(u => <option key={u.id} value={u.id}>{u.name} ({u.role?.toLowerCase().replace('_', ' ')})</option>)}
                  </select>
                </InputField>
              </div>
            </div>
          </div>

          {/* Section: Notes */}
          <div>
            <h3 className="text-xs font-bold uppercase tracking-widest mb-4 flex items-center gap-2" style={{ color: 'var(--accent)' }}>
              <FileText className="w-3.5 h-3.5" /> Notes
            </h3>
            <div className="space-y-3">
              <InputField label="Requirements / Description">
                <textarea className="input-field resize-none" rows={3} placeholder="What does the prospect need? What problem are they solving?" value={form.requirements} onChange={set('requirements')} />
              </InputField>
              <InputField label="Internal Notes">
                <textarea className="input-field resize-none" rows={2} placeholder="Private notes for your team (not visible to client)" value={form.internalNotes} onChange={set('internalNotes')} />
              </InputField>
              <InputField label="Tags (comma-separated)">
                <input className="input-field" placeholder="oil-gas, rfp, q1-2025" value={form.tags} onChange={set('tags')} />
              </InputField>
            </div>
          </div>

          {/* Save */}
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> {lead ? 'Save Changes' : 'Create Lead'}</>}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── AI Import Modal ─────────────────────────────────────────────────────────────
function ImportModal({ onClose, onSuccess, addToast }: { onClose: () => void; onSuccess: (leads: any[]) => void; addToast: any }) {
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)

  const handleUpload = async () => {
    if (!file) return
    setUploading(true)
    try {
      const res = await aiApi.extractFile(file)
      if (res.success) {
        addToast({ message: `Successfully extracted ${res.count} leads from file!`, type: 'success' })
        onSuccess(res.leads)
        onClose()
      }
    } catch (e: any) {
      addToast({ message: e.message || 'Failed to extract leads', type: 'error' })
    } finally {
      setUploading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl p-6 text-center" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex justify-end mb-2"><button onClick={onClose}><X className="w-5 h-5 text-gray-400" /></button></div>
        
        <div className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
          <Zap className="w-8 h-8" style={{ color: '#8b5cf6' }} />
        </div>
        <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Import via AI</h2>
        <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Upload an RFP, tender document, or CSV. Groq AI will automatically extract the leads and requirements.</p>

        <div className="border-2 border-dashed rounded-xl p-8 mb-6" style={{ borderColor: 'var(--border)' }}>
          <input type="file" id="ai-file" className="hidden" accept=".pdf,.txt,.csv" onChange={e => setFile(e.target.files?.[0] || null)} />
          <label htmlFor="ai-file" className="cursor-pointer flex flex-col items-center">
            <FileUp className="w-8 h-8 mb-2" style={{ color: 'var(--text-muted)' }} />
            <span className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
              {file ? file.name : 'Click to upload PDF, TXT, or CSV'}
            </span>
          </label>
        </div>

        <button className="btn-primary w-full justify-center" onClick={handleUpload} disabled={!file || uploading}>
          {uploading ? <><Loader2 className="w-4 h-4 animate-spin" /> Scanning Document...</> : 'Extract Leads'}
        </button>
      </motion.div>
    </div>
  )
}

function EmailImportModal({ onClose, addToast }: { onClose: () => void; addToast: any }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [imapHost, setImapHost] = useState('imap.gmail.com')
  const [imapPort, setImapPort] = useState('993')
  const [autoCreate, setAutoCreate] = useState(true)
  const [loading, setLoading] = useState(false)

  const handleSetupAndSync = async () => {
    if (!email || !password || !imapHost) {
      addToast({ type: 'error', message: 'Email, app password, and IMAP host are required.' })
      return
    }

    setLoading(true)
    try {
      await emailImportApi.setup({
        email,
        password,
        imapHost,
        imapPort: Number(imapPort) || 993,
      })

      const result = await emailImportApi.sync(autoCreate)
      addToast({
        type: 'success',
        message: `Mail import complete: ${result?.data?.totalProcessed ?? 0} processed, ${result?.data?.leadsCreated ?? 0} leads created.`,
      })
      onClose()
    } catch (e: any) {
      addToast({ type: 'error', message: e?.message || 'Mail import setup/sync failed.' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-lg rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(20,184,166,0.12)' }}>
              <Mail className="w-4 h-4 text-teal-400" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Import Mail</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Configure IMAP and sync leads from inbox</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <input className="input-field" placeholder="Email address" value={email} onChange={e => setEmail(e.target.value)} />
          <input className="input-field" placeholder="App password" value={password} onChange={e => setPassword(e.target.value)} />
          <div className="grid grid-cols-3 gap-2">
            <input className="input-field col-span-2" placeholder="IMAP Host" value={imapHost} onChange={e => setImapHost(e.target.value)} />
            <input className="input-field" placeholder="Port" value={imapPort} onChange={e => setImapPort(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--text-secondary)' }}>
            <input type="checkbox" checked={autoCreate} onChange={e => setAutoCreate(e.target.checked)} />
            Auto-create leads from qualified emails
          </label>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex-1 justify-center" onClick={handleSetupAndSync} disabled={loading}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Working...</> : <><Mail className="w-4 h-4" /> Setup & Import</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </motion.div>
    </div>
  )
}

function VoiceAgentModal({ lead, onClose, onStart }: { lead: any; onClose: () => void; onStart: (provider: 'VAPI' | 'TWILIO') => Promise<void> }) {
  const [provider, setProvider] = useState<'VAPI' | 'TWILIO'>('VAPI')
  const [loading, setLoading] = useState(false)

  const handleStart = async () => {
    setLoading(true)
    try {
      await onStart(provider)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-md rounded-2xl p-6" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'rgba(16,185,129,0.12)' }}>
              <PhoneCall className="w-4 h-4 text-emerald-400" />
            </div>
            <div>
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Voice Agent Call</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lead.contactName} · {lead.company}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Provider</label>
            <select className="input-field" value={provider} onChange={e => setProvider(e.target.value as 'VAPI' | 'TWILIO')}>
              <option value="VAPI">VAPI AI Agent</option>
              <option value="TWILIO">Twilio Call Flow</option>
            </select>
          </div>
          <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            This launches the selected voice agent using the lead phone number and creates a tracked call log.
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex-1 justify-center" onClick={handleStart} disabled={loading || !lead.phone}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calling...</> : <><PhoneCall className="w-4 h-4" /> Start Voice Agent</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Call Script Modal ────────────────────────────────────────────────────────────
function CallScriptModal({ lead, onClose }: { lead: any; onClose: () => void }) {
  const [script, setScript] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    aiApi.generateCallScript(lead.id, 'lead')
      .then(setScript)
      .catch(e => setError(e.message || 'Failed to generate script'))
      .finally(() => setLoading(false))
  }, [lead.id])

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(4px)' }}>
      <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        className="w-full max-w-2xl rounded-2xl p-6 max-h-[80vh] overflow-y-auto" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'rgba(139,92,246,0.1)' }}>
              <Zap className="w-5 h-5" style={{ color: '#8b5cf6' }} />
            </div>
            <div>
              <p className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>AI Call Script</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Calling: {lead.contactName} ({lead.company})</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin mb-4" style={{ color: '#8b5cf6' }} />
            <p style={{ color: 'var(--text-secondary)' }}>Groq AI is analyzing lead data...</p>
          </div>
        ) : error ? (
          <div className="p-4 rounded-xl mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', color: '#ef4444' }}>
            {error}
          </div>
        ) : script && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Opening Pitch</h3>
              <div className="p-4 rounded-xl text-lg font-medium leading-relaxed" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
                "{script.openingPitch}"
              </div>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--accent)' }}>Key Selling Points</h3>
              <ul className="space-y-2">
                {script.keySellingPoints?.map((pt: string, i: number) => (
                  <li key={i} className="flex items-start gap-2 text-sm" style={{ color: 'var(--text-secondary)' }}>
                    <CheckCircle className="w-4 h-4 mt-0.5 flex-shrink-0" style={{ color: '#10b981' }} />
                    <span>{pt}</span>
                  </li>
                ))}
              </ul>
            </div>

            <div>
              <h3 className="text-sm font-bold uppercase tracking-wider mb-2 flex items-center gap-2" style={{ color: '#f59e0b' }}>
                <AlertCircle className="w-4 h-4" /> Anticipated Objections
              </h3>
              <div className="space-y-3">
                {script.anticipatedObjections?.map((obj: any, i: number) => (
                  <div key={i} className="p-3 rounded-lg" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <p className="text-xs font-bold mb-1" style={{ color: '#ef4444' }}>They might say: "{obj.objection}"</p>
                    <p className="text-sm" style={{ color: '#10b981' }}>Counter: {obj.counter}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────
export default function LeadsPage({ addToast, canEdit, onNavigate, searchQuery, onSearchChange }: Props) {
  const [leads,      setLeads]      = useState<any[]>([])
  const [users,      setUsers]      = useState<any[]>([])
  const [loading,    setLoading]    = useState(true)
  const [internalSearch, setInternalSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('ALL')
  const [selected,   setSelected]   = useState<any | null>(null)
  const [showForm,   setShowForm]   = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [showEmailImport, setShowEmailImport] = useState(false)
  const [editLead,   setEditLead]   = useState<any | null>(null)
  const [mailLead,   setMailLead]   = useState<any | null>(null)
  const [scriptLead, setScriptLead] = useState<any | null>(null)
  const [voiceLead,  setVoiceLead]  = useState<any | null>(null)
  const [selectedIds, setSelectedIds] = useState<string[]>([])

  useEffect(() => {
    Promise.all([
      leadsApi.list().then(setLeads),
      usersApi.list().then(setUsers),
    ]).finally(() => setLoading(false))
  }, [])

  const pendingLeads = leads.filter(l => l.fromEmail && !l.aiVerified && l.status !== 'DISQUALIFIED')
  const activeLeads  = leads.filter(l => !l.fromEmail || l.aiVerified || l.status === 'DISQUALIFIED')

  const search = searchQuery ?? internalSearch
  const setSearch = onSearchChange ?? setInternalSearch

  const filtered = activeLeads.filter(l => {
    const q = search.toLowerCase()
    const matchSearch = !search || l.company?.toLowerCase().includes(q) || l.contactName?.toLowerCase().includes(q) || l.email?.toLowerCase().includes(q)
    const matchStatus = statusFilter === 'ALL' || l.status === statusFilter
    return matchSearch && matchStatus
  })

  const handleApprove = async (id: string) => {
    try {
      const approved = await leadsApi.approve(id)
      const sync = approved.sync
      setLeads(prev => prev.map(l => l.id === id ? approved.lead : l))
      if (selected?.id === id) setSelected(approved.lead)
      addToast({
        message: sync?.createdClient || sync?.createdContact
          ? `Lead approved and synced. ${sync?.createdClient ? 'Client' : 'Client record'}${sync?.createdContact ? ' and contact' : ''} created from lead details.`
          : 'Lead approved and linked to existing client/contact records.',
        type: 'success'
      })
    } catch (err: any) {
      addToast({ message: err.message, type: 'error' })
    }
  }

  const handleReject = async (id: string) => {
    try {
      const rejected = await leadsApi.reject(id)
      setLeads(prev => prev.map(l => l.id === id ? rejected : l))
      addToast({ message: 'Lead disqualified', type: 'info' })
    } catch (err: any) {
      addToast({ message: err.message, type: 'error' })
    }
  }

  const handleCreate = async (data: any) => {
    const lead = await leadsApi.create(data)
    setLeads(prev => [lead, ...prev])
    addToast({ message: `Lead created: ${data.company}`, type: 'success' })
  }

  const handleEdit = async (data: any) => {
    const lead = await leadsApi.update(editLead.id, data)
    setLeads(prev => prev.map(l => l.id === lead.id ? lead : l))
    setSelected(lead)
    addToast({ message: 'Lead updated', type: 'success' })
  }

  const handleQualify = async (lead: any) => {
    try {
      const result = await leadsApi.qualify(lead.id)
      const sync = result.sync
      setLeads(prev => prev.map(l => l.id === result.lead.id ? result.lead : l))
      setSelected(result.lead)
      addToast({
        message: sync?.createdClient || sync?.createdContact
          ? `✅ ${lead.company} qualified. Client/contact created from lead details.`
          : `✅ ${lead.company} qualified. Existing client/contact updated and opportunity created.`,
        type: 'success'
      })
    } catch (e: any) { addToast({ message: e.message, type: 'error' }) }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this lead?')) return
    await leadsApi.delete(id)
    setLeads(prev => prev.filter(l => l.id !== id))
    setSelected(null)
    setSelectedIds(prev => prev.filter(i => i !== id))
    addToast({ message: 'Lead deleted', type: 'info' })
  }

  const handleBulkDelete = async () => {
    if (!selectedIds.length) return
    if (!confirm(`Delete ${selectedIds.length} leads?`)) return
    try {
      await leadsApi.bulkDelete(selectedIds)
      setLeads(prev => prev.filter(l => !selectedIds.includes(l.id)))
      setSelectedIds([])
      addToast({ message: `${selectedIds.length} leads deleted`, type: 'info' })
    } catch (e: any) {
      addToast({ message: e.message || 'Bulk delete failed', type: 'error' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filtered.length) setSelectedIds([])
    else setSelectedIds(filtered.map(l => l.id))
  }

  const handleInitiateCall = async (lead: any, provider: 'VAPI' | 'TWILIO' = 'VAPI') => {
    if (!lead?.phone) {
      addToast({ type: 'error', message: 'This lead has no phone number.' })
      return
    }

    try {
      await voiceApi.initiateCall(lead.id, provider)
      addToast({ type: 'success', message: `Voice agent (${provider}) is calling ${lead.contactName || lead.company}...` })
    } catch (e: any) {
      addToast({ type: 'error', message: e?.message || 'Failed to initiate call.' })
    }
  }

  const stats = {
    total:     activeLeads.length,
    new:       activeLeads.filter(l => l.status === 'NEW').length,
    qualified: activeLeads.filter(l => l.status === 'QUALIFIED').length,
    value:     activeLeads.reduce((s, l) => s + parseFloat(l.value || 0), 0),
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--accent)' }} />
    </div>
  )

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Leads</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {stats.total} total · {stats.new} new · {stats.qualified} qualified
          </p>
        </div>
        {canEdit && (
          <div className="flex gap-2">
            <button className="btn-secondary" onClick={() => setShowImport(true)}>
              <Zap className="w-4 h-4" style={{ color: '#8b5cf6' }} /> Import via AI
            </button>
            {/* Bulk Actions */}
          <AnimatePresence>
            {selectedIds.length > 0 && (
              <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 20, opacity: 0 }}
                className="flex items-center gap-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                <span className="text-xs font-bold text-red-400">{selectedIds.length} selected</span>
                <button onClick={handleBulkDelete} className="btn-secondary py-1.5 px-3 text-xs bg-red-500/10 text-red-400 border-red-500/20 hover:bg-red-500 hover:text-white">
                  <Trash2 className="w-3.5 h-3.5" /> Delete
                </button>
              </motion.div>
            )}
          </AnimatePresence>
            <button className="btn-primary" onClick={() => { setEditLead(null); setShowForm(true) }}>
              <UserPlus className="w-4 h-4" /> Add Lead
            </button>
          </div>
        )}
      </div>

      {/* Review Queue (Mini Board) */}
      {pendingLeads.length > 0 && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 px-1">
            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
            <h3 className="text-xs font-bold uppercase tracking-widest text-[var(--text-muted)]">Pending AI Verification ({pendingLeads.length})</h3>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {pendingLeads.map(lead => (
              <motion.div 
                key={lead.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                className="panel p-4 border border-amber-500/20 bg-amber-500/[0.02] hover:bg-amber-500/[0.05] transition-all group"
              >
                <div className="flex justify-between items-start mb-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500 font-bold">
                      {lead.company?.[0]}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-[var(--text-primary)] leading-tight">{lead.company}</p>
                      <p className="text-[10px] text-[var(--text-muted)] mt-0.5">{lead.contactName}</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-bold text-amber-500">{lead.aiCredibilityScore}% Match</p>
                    <p className="text-[9px] text-[var(--text-muted)]">from {lead.email}</p>
                  </div>
                </div>

                <div className="bg-[var(--bg-elevated)] rounded-lg p-2.5 mb-4 border border-[var(--border)]">
                  <p className="text-[10px] font-semibold text-[var(--text-muted)] uppercase mb-1">AI Insights</p>
                  <p className="text-[11px] text-[var(--text-secondary)] line-clamp-2 italic">
                    "{lead.aiNotes?.split(' | ')[0] || 'Email contains high-value requirements...'}"
                  </p>
                </div>

                <div className="flex gap-2">
                  <button 
                    onClick={() => handleQualify(lead)}
                    className="flex-1 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500 text-[11px] hover:text-white font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle className="w-3.5 h-3.5" /> Qualify
                  </button>
                  <button 
                    onClick={() => handleReject(lead.id)}
                    className="flex-1 h-8 rounded-lg bg-red-500/10 text-red-500 hover:bg-red-500 text-[11px] hover:text-white font-bold transition-all flex items-center justify-center gap-1.5"
                  >
                    <X className="w-3.5 h-3.5" /> Disqualify
                  </button>
                  <button 
                    onClick={() => setSelected(lead)}
                    className="w-8 h-8 rounded-lg bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-muted)] hover:text-white transition-colors"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        </div>
      )}

      {/* KPI strip */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Leads',   value: stats.total,                                  color: '#3b82f6' },
          { label: 'New',           value: stats.new,                                    color: '#6b7280' },
          { label: 'Qualified',     value: stats.qualified,                              color: '#10b981' },
          { label: 'Pipeline Value',value: `AED ${(stats.value/1e6).toFixed(1)}M`,      color: '#f59e0b' },
        ].map(kpi => (
          <div key={kpi.label} className="kpi-card text-center">
            <p className="text-xl font-bold" style={{ color: kpi.color }}>{kpi.value}</p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{kpi.label}</p>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="panel p-3 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search leads..." className="input-field pl-9 py-2 text-sm" />
        </div>
        <div className="flex items-center gap-1.5">
          {(['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'DISQUALIFIED'] as const).map(s => {
            const cfg = s === 'ALL' ? null : STATUS_CFG[s]
            return (
              <button key={s} onClick={() => setStatusFilter(s)}
                className="text-xs px-3 py-1.5 rounded-lg border transition-all"
                style={statusFilter === s
                  ? { backgroundColor: cfg?.bg || 'var(--accent-muted)', color: cfg?.color || 'var(--accent)', borderColor: cfg?.border || 'var(--accent-border)' }
                  : { backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)', borderColor: 'var(--border)' }}>
                {s === 'ALL' ? 'All' : (STATUS_CFG[s]?.label)}
              </button>
            )
          })}
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
              <th>Company / Contact</th>
              <th>Source</th>
              <th>Industry</th>
              <th>Est. Value</th>
              <th>AI Score</th>
              <th>Priority</th>
              <th>Status</th>
              <th>Assigned</th>
              <th style={{ width: 120 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((lead, i) => {
              const st  = STATUS_CFG[lead.status as keyof typeof STATUS_CFG]   || STATUS_CFG.NEW
              const pri = PRIORITY_CFG[lead.priority as keyof typeof PRIORITY_CFG] || PRIORITY_CFG.MEDIUM
              return (
                <tr key={lead.id} className={`group hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer ${selectedIds.includes(lead.id) ? 'bg-accent-muted/20' : ''}`} onClick={() => setSelected(lead)}>
                  <td className="pl-5" onClick={e => e.stopPropagation()}>
                    <input type="checkbox" checked={selectedIds.includes(lead.id)} onChange={() => toggleSelect(lead.id)} className="rounded border-gray-700 bg-gray-800" />
                  </td>
                  <td>
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                        style={{ backgroundColor: st.color }}>
                        {lead.company?.charAt(0)}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{lead.company}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{lead.contactName}</p>
                      </div>
                    </div>
                  </td>
                  <td><span className="text-xs px-2 py-0.5 rounded-md" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>{lead.source?.replace(/_/g, ' ') || '—'}</span></td>
                  <td><p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{lead.industry || '—'}</p></td>
                  <td><p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{lead.value > 0 ? `AED ${(parseFloat(lead.value)/1e6).toFixed(1)}M` : '—'}</p></td>
                  <td><ScoreBadge score={lead.aiCredibilityScore} /></td>
                  <td><span className="text-xs font-semibold" style={{ color: pri.color }}>● {pri.label}</span></td>
                  <td>
                    <span className="badge text-xs" style={{ backgroundColor: st.bg, color: st.color, border: `1px solid ${st.border}` }}>{st.label}</span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1.5">
                      <div className="w-5 h-5 rounded-full flex items-center justify-center text-[9px] font-bold text-white" style={{ backgroundColor: 'var(--text-muted)' }}>
                        {lead.assignedTo?.avatar || '?'}
                      </div>
                      <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{lead.assignedTo?.name?.split(' ')[0] || '—'}</span>
                    </div>
                  </td>
                  <td onClick={e => e.stopPropagation()}>
                    <div className="flex items-center gap-1">
                      <button onClick={() => setVoiceLead(lead)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-emerald-500/10"
                        title="Voice agent call" style={{ color: 'var(--text-muted)' }}>
                        <PhoneCall className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setScriptLead(lead)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-purple-500/10"
                        title="AI Call Script" style={{ color: 'var(--text-muted)' }}>
                        <Zap className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={() => setMailLead(lead)} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-blue-500/10"
                        title="Send email" style={{ color: 'var(--text-muted)' }}>
                        <Mail className="w-3.5 h-3.5" />
                      </button>
                      {canEdit && (
                        <>
                          <button onClick={() => { setEditLead(lead); setShowForm(true) }} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors"
                            style={{ color: 'var(--text-muted)' }} title="Edit">
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button onClick={() => handleDelete(lead.id)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 transition-colors"
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
            <UserPlus className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
            <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No leads found</p>
            <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
              {canEdit ? 'Click "Add Lead" to create your first lead.' : 'No leads assigned to you yet.'}
            </p>
          </div>
        )}
      </div>

      {/* Overlays */}
      <AnimatePresence>
        {selected && !showForm && !mailLead && (
          <LeadDetailPanel lead={selected} canEdit={canEdit}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditLead(selected); setShowForm(true) }}
            onDelete={() => handleDelete(selected.id)}
            onQualify={() => handleQualify(selected)}
            onReject={() => handleReject(selected.id)}
            onCall={() => setVoiceLead(selected)}
            onMail={() => setMailLead(selected)} />
        )}
      </AnimatePresence>

      {showForm && (
        <LeadFormDrawer lead={editLead} users={users}
          onSave={editLead ? handleEdit : handleCreate}
          onClose={() => { setShowForm(false); setEditLead(null) }} />
      )}

      {showImport && (
        <ImportModal onClose={() => setShowImport(false)} onSuccess={(newLeads) => setLeads(prev => [...newLeads, ...prev])} addToast={addToast} />
      )}

      {showEmailImport && (
        <EmailImportModal onClose={() => setShowEmailImport(false)} addToast={addToast} />
      )}

      {mailLead && (
        <MailModal lead={mailLead} onClose={() => setMailLead(null)} addToast={addToast} />
      )}

      {scriptLead && (
        <CallScriptModal lead={scriptLead} onClose={() => setScriptLead(null)} />
      )}

      {voiceLead && (
        <VoiceAgentModal
          lead={voiceLead}
          onClose={() => setVoiceLead(null)}
          onStart={async (provider) => {
            await handleInitiateCall(voiceLead, provider)
            setVoiceLead(null)
          }}
        />
      )}
    </div>
  )
}
