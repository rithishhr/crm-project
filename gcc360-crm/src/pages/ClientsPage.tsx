import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Building2, Crown, Search, Plus, X, Mail, Phone, Globe, MapPin,
  Edit3, Trash2, AlertCircle, Loader2, CheckCircle, Send, Tag,
  DollarSign, FileText, User, Briefcase, CreditCard, ChevronRight, Eye, Zap, PhoneCall
} from 'lucide-react'
import { clientsApi, usersApi, aiApi, leadsApi, voiceApi } from '../lib/api'
import type { Toast } from '../components/ui/Toast'

interface Props {
  canEdit: boolean
  searchQuery?: string
  onSearchChange?: (value: string) => void
}

const TIER_CFG = {
  PLATINUM: { label: 'Platinum', color: '#a78bfa', bg: 'rgba(167,139,250,0.1)', border: 'rgba(167,139,250,0.25)' },
  GOLD:     { label: 'Gold',     color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)'  },
  SILVER:   { label: 'Silver',   color: '#94a3b8', bg: 'rgba(148,163,184,0.1)', border: 'rgba(148,163,184,0.25)' },
}
const STATUS_CFG = {
  PROSPECT: { label: 'Prospect', color: '#3b82f6' },
  ACTIVE:   { label: 'Active',   color: '#10b981' },
  KEY:      { label: 'Key',      color: '#f59e0b' },
}
const ACCOUNT_TYPES  = ['CUSTOMER', 'PROSPECT', 'PARTNER', 'DISTRIBUTOR']
const INDUSTRIES     = ['Oil & Gas', 'Energy', 'Construction', 'Finance', 'Government', 'Healthcare', 'Technology', 'Manufacturing', 'Logistics', 'Other']
const COUNTRIES      = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Egypt', 'India', 'USA', 'UK', 'Other']
const PAYMENT_TERMS  = ['Net 30', 'Net 60', 'Net 90', 'LC (Letter of Credit)', 'Advance Payment', 'COD', 'Other']
const CURRENCIES     = ['AED', 'SAR', 'USD', 'EUR', 'GBP', 'QAR', 'KWD', 'BHD', 'OMR']
const TIERS          = ['PLATINUM', 'GOLD', 'SILVER']
const CUST_STATUSES  = ['PROSPECT', 'ACTIVE', 'KEY']

const EMPTY: Record<string, string> = {
  name: '', accountType: 'CUSTOMER', industry: '', country: 'UAE', city: '',
  website: '', contactPerson: '', contactTitle: '', email: '', phone: '',
  accountOwner: '', customerStatus: 'PROSPECT', paymentTerms: '', currency: 'AED',
  tier: 'SILVER', address1: '', postalCode: '', notes: '', tags: '',
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

function Sel({ value, onChange, options, placeholder }: { value: string; onChange: (v: string) => void; options: string[]; placeholder?: string }) {
  return (
    <select className="input-field" value={value} onChange={e => onChange(e.target.value)}>
      {placeholder && <option value="">{placeholder}</option>}
      {options.map(o => <option key={o} value={o}>{o.replace(/_/g,' ')}</option>)}
    </select>
  )
}

// ── Mail Modal ─────────────────────────────────────────────────────────────────
function MailModal({ client, onClose, addToast }: { client: any; onClose: () => void; addToast: (t: any) => void }) {
  const [subject, setSubject] = useState(`Re: ${client.name}`)
  const [body, setBody]       = useState('')
  const [sending, setSending] = useState(false)
  const [aiLoading, setAiLoading] = useState(false)

  const draftWithAI = async () => {
    setAiLoading(true)
    try {
      const d = await aiApi.draftEmail(client.id, 'client')
      setSubject(d.subject || subject)
      setBody(d.body || '')
    } catch { 
      addToast({ message: 'AI unavailable — write manually', type: 'error' }) 
    } finally { 
      setAiLoading(false) 
    }
  }

  const send = async () => {
    if (!client.email) { addToast({ message: 'No email on file for this client.', type: 'error' }); return }
    if (!body.trim()) { addToast({ message: 'Please write a message.', type: 'error' }); return }
    setSending(true)
    try {
      const { emailApi } = await import('../lib/api')
      await emailApi.send(client.email, subject, body)
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
              <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Email {client.name}</p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>To: {client.contactPerson} &lt;{client.email}&gt;</p>
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
            <Send className="w-4 h-4" /> {sending ? 'Sending...' : 'Send Email'}
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

function VoiceAgentModal({ client, onClose, onStart }: { client: any; onClose: () => void; onStart: (provider: 'VAPI' | 'TWILIO') => Promise<void> }) {
  const [provider, setProvider] = useState<'VAPI' | 'TWILIO'>('VAPI')
  const [loading, setLoading] = useState(false)

  const startCall = async () => {
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
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{client.name}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold mb-1.5 uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>Voice Provider</label>
            <select className="input-field" value={provider} onChange={e => setProvider(e.target.value as 'VAPI' | 'TWILIO')}>
              <option value="VAPI">VAPI AI Agent</option>
              <option value="TWILIO">Twilio Call Flow</option>
            </select>
          </div>
          <div className="rounded-xl p-3 text-xs" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
            The system will use the client phone number and start a voice agent call. If needed, it creates a lead first so the call is tracked.
          </div>
        </div>

        <div className="flex gap-2 mt-4">
          <button className="btn-primary flex-1 justify-center" onClick={startCall} disabled={loading || !client.phone}>
            {loading ? <><Loader2 className="w-4 h-4 animate-spin" /> Calling...</> : <><PhoneCall className="w-4 h-4" /> Start Voice Agent</>}
          </button>
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
        </div>
      </motion.div>
    </div>
  )
}

// ── Client Detail Panel ────────────────────────────────────────────────────────
function ClientDetail({ client, onClose, onEdit, onMail, onCall, canEdit }: { client: any; onClose: () => void; onEdit: () => void; onMail: () => void; onCall: () => void; canEdit: boolean }) {
  const tier   = TIER_CFG[client.tier as keyof typeof TIER_CFG]   || TIER_CFG.SILVER
  const status = STATUS_CFG[client.customerStatus as keyof typeof STATUS_CFG] || STATUS_CFG.PROSPECT

  return (
    <motion.div initial={{ x: 420, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 420, opacity: 0 }}
      className="fixed right-0 top-0 h-full w-full max-w-md z-40 overflow-y-auto shadow-2xl"
      style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
      {/* Sticky header */}
      <div className="sticky top-0 z-10 p-5" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-xl font-bold text-white"
              style={{ backgroundColor: tier.color }}>
              {client.name?.charAt(0)}
            </div>
            <div>
              <h3 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>{client.name}</h3>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="text-xs px-2 py-0.5 rounded-full font-bold" style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                  <Crown className="w-3 h-3 inline mr-1" />{tier.label}
                </span>
                <span className="text-xs font-semibold" style={{ color: status.color }}>● {status.label}</span>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-muted)' }}>
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="flex gap-2">
          {client.email && <button onClick={onMail} className="btn-secondary flex-1 text-xs justify-center"><Mail className="w-3.5 h-3.5" /> Email</button>}
          {client.phone && <button onClick={onCall} className="btn-secondary flex-1 text-xs justify-center flex items-center gap-1.5"><PhoneCall className="w-3.5 h-3.5" /> Voice Agent</button>}
          {canEdit && <button onClick={onEdit} className="btn-secondary text-xs px-3"><Edit3 className="w-3.5 h-3.5" /></button>}
        </div>
      </div>

      {/* Revenue strip */}
      <div className="mx-5 mt-4 grid grid-cols-2 gap-3">
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p className="text-lg font-bold" style={{ color: '#10b981' }}>AED {(Number(client.totalRevenue)/1e6).toFixed(1)}M</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Total Revenue</p>
        </div>
        <div className="rounded-xl p-3 text-center" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
          <p className="text-lg font-bold" style={{ color: '#3b82f6' }}>{client.activeDeals}</p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Active Deals</p>
        </div>
      </div>

      {/* Sections */}
      <div className="p-5 space-y-5">
        {/* Company Profile */}
        <Section title="Company Profile" icon={Building2}>
          {[
            { label: 'Account Type',  value: client.accountType?.replace(/_/g,' ') || '—' },
            { label: 'Industry',      value: client.industry || '—' },
            { label: 'Country',       value: client.country  || '—' },
            { label: 'City',          value: client.city     || '—' },
            { label: 'Website',       value: client.website  || '—', link: client.website },
          ]}
        </Section>

        {/* Primary Contact */}
        <Section title="Primary Contact" icon={User}>
          {[
            { label: 'Name',  value: client.contactPerson || '—' },
            { label: 'Title', value: client.contactTitle  || '—' },
            { label: 'Email', value: client.email         || '—', mailto: client.email },
            { label: 'Phone', value: client.phone         || '—', tel: client.phone },
          ]}
        </Section>

        {/* Commercial Info */}
        <Section title="Commercial" icon={DollarSign}>
          {[
            { label: 'Account Owner',   value: client.accountOwner  || '—' },
            { label: 'Payment Terms',   value: client.paymentTerms  || '—' },
            { label: 'Currency',        value: client.currency      || 'AED' },
            { label: 'Member Since',    value: client.since ? new Date(client.since).toLocaleDateString('en-GB', { month: 'short', year: 'numeric' }) : '—' },
          ]}
        </Section>

        {/* Address */}
        {(client.address1 || client.postalCode) && (
          <Section title="Address" icon={MapPin}>
            {[
              { label: 'Address', value: client.address1  || '—' },
              { label: 'Postal',  value: client.postalCode || '—' },
            ]}
          </Section>
        )}

        {/* Notes */}
        {client.notes && (
          <div>
            <p className="text-xs font-bold uppercase tracking-widest mb-2" style={{ color: 'var(--text-muted)' }}>Notes</p>
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{client.notes}</p>
          </div>
        )}

        {/* Tags */}
        {client.tags && (
          <div className="flex flex-wrap gap-1.5">
            {client.tags.split(',').map((tag: string) => (
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

function Section({ title, icon: Icon, children }: { title: string; icon: any; children: { label: string; value: string; link?: string; mailto?: string; tel?: string }[] }) {
  return (
    <div>
      <p className="text-xs font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5" style={{ color: 'var(--accent)' }}>
        <Icon className="w-3.5 h-3.5" /> {title}
      </p>
      <div className="rounded-xl overflow-hidden" style={{ border: '1px solid var(--border)' }}>
        {children.map((row, i) => (
          <div key={row.label} className="flex justify-between items-center px-3 py-2.5" style={{ borderBottom: i < children.length - 1 ? '1px solid var(--border-subtle)' : 'none', backgroundColor: i % 2 === 0 ? 'var(--bg-elevated)' : 'transparent' }}>
            <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
            {row.link ? (
              <a href={row.link} target="_blank" rel="noreferrer" className="text-xs font-medium flex items-center gap-1" style={{ color: 'var(--accent)' }}>
                {row.value} <Globe className="w-3 h-3" />
              </a>
            ) : row.mailto ? (
              <a href={`mailto:${row.mailto}`} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{row.value}</a>
            ) : row.tel ? (
              <a href={`tel:${row.tel}`} className="text-xs font-medium" style={{ color: 'var(--accent)' }}>{row.value}</a>
            ) : (
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ── Client Form Drawer ─────────────────────────────────────────────────────────
function ClientForm({ client, users, onSave, onClose }: { client?: any; users: any[]; onSave: (d: any) => Promise<void>; onClose: () => void }) {
  const [form, setForm] = useState<Record<string, string>>({ ...EMPTY, ...(client || {}) })
  const [saving, setSaving] = useState(false)
  const [error,  setError]  = useState('')

  const set = (k: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm(f => ({ ...f, [k]: e.target.value }))
  const setV = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }))

  const handleSave = async () => {
    if (!form.name.trim()) { setError('Client name is required.'); return }
    setSaving(true); setError('')
    try { await onSave(form); onClose() }
    catch (e: any) { setError(e.message || 'Failed to save.') }
    finally { setSaving(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex" style={{ backgroundColor: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(4px)' }}>
      <div className="ml-auto w-full max-w-2xl h-full overflow-y-auto shadow-2xl" style={{ backgroundColor: 'var(--bg-card)', borderLeft: '1px solid var(--border)' }}>
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6" style={{ backgroundColor: 'var(--bg-card)', borderBottom: '1px solid var(--border)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ backgroundColor: 'var(--accent-muted)' }}>
              <Building2 className="w-4 h-4" style={{ color: 'var(--accent)' }} />
            </div>
            <div>
              <h2 className="font-bold" style={{ color: 'var(--text-primary)' }}>{client ? 'Edit Client' : 'Add New Client'}</h2>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Complete client profile</p>
            </div>
          </div>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-7">
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Company Profile */}
          <FormSection title="Company Profile" icon={Building2}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <IF label="Company Name" required>
                  <input className="input-field" placeholder="ADNOC, Saudi Aramco..." value={form.name} onChange={set('name')} />
                </IF>
              </div>
              <IF label="Account Type"><Sel value={form.accountType} onChange={v => setV('accountType', v)} options={ACCOUNT_TYPES} /></IF>
              <IF label="Tier"><Sel value={form.tier} onChange={v => setV('tier', v)} options={TIERS} /></IF>
              <IF label="Industry"><Sel value={form.industry} onChange={v => setV('industry', v)} options={INDUSTRIES} placeholder="Select industry" /></IF>
              <IF label="Country"><Sel value={form.country} onChange={v => setV('country', v)} options={COUNTRIES} /></IF>
              <IF label="City"><input className="input-field" placeholder="Dubai, Riyadh..." value={form.city} onChange={set('city')} /></IF>
              <IF label="Website"><input className="input-field" placeholder="https://company.com" value={form.website} onChange={set('website')} /></IF>
            </div>
          </FormSection>

          {/* Primary Contact */}
          <FormSection title="Primary Contact" icon={User}>
            <div className="grid grid-cols-2 gap-3">
              <IF label="Contact Name"><input className="input-field" placeholder="Mohammed Al-Hameli" value={form.contactPerson} onChange={set('contactPerson')} /></IF>
              <IF label="Job Title"><input className="input-field" placeholder="VP Technology" value={form.contactTitle} onChange={set('contactTitle')} /></IF>
              <IF label="Work Email"><input type="email" className="input-field" placeholder="contact@company.com" value={form.email} onChange={set('email')} /></IF>
              <IF label="Phone Number"><input className="input-field" placeholder="+971 50 000 0000" value={form.phone} onChange={set('phone')} /></IF>
            </div>
          </FormSection>

          {/* Commercial Info */}
          <FormSection title="Commercial Info" icon={DollarSign}>
            <div className="grid grid-cols-2 gap-3">
              <IF label="Account Owner">
                <select className="input-field" value={form.accountOwner} onChange={set('accountOwner')}>
                  <option value="">Not assigned</option>
                  {users.map(u => <option key={u.id} value={u.name}>{u.name}</option>)}
                </select>
              </IF>
              <IF label="Customer Status"><Sel value={form.customerStatus} onChange={v => setV('customerStatus', v)} options={CUST_STATUSES} /></IF>
              <IF label="Payment Terms"><Sel value={form.paymentTerms} onChange={v => setV('paymentTerms', v)} options={PAYMENT_TERMS} placeholder="Select terms" /></IF>
              <IF label="Currency"><Sel value={form.currency} onChange={v => setV('currency', v)} options={CURRENCIES} /></IF>
            </div>
          </FormSection>

          {/* Address */}
          <FormSection title="Address" icon={MapPin}>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <IF label="Address Line 1"><input className="input-field" placeholder="Building, Street, Area" value={form.address1} onChange={set('address1')} /></IF>
              </div>
              <IF label="City"><input className="input-field" placeholder="Dubai" value={form.city} onChange={set('city')} /></IF>
              <IF label="Postal Code"><input className="input-field" placeholder="00000" value={form.postalCode} onChange={set('postalCode')} /></IF>
            </div>
          </FormSection>

          {/* Notes & Tags */}
          <FormSection title="Notes & Tags" icon={FileText}>
            <div className="space-y-3">
              <IF label="Account Notes">
                <textarea className="input-field resize-none" rows={3} placeholder="Key details, relationship history, preferences..." value={form.notes} onChange={set('notes')} />
              </IF>
              <IF label="Tags (comma-separated)">
                <input className="input-field" placeholder="key-account, oil-gas, strategic" value={form.tags} onChange={set('tags')} />
              </IF>
            </div>
          </FormSection>

          {/* Save */}
          <div className="flex gap-3 pt-2">
            <button className="btn-primary flex-1 justify-center" onClick={handleSave} disabled={saving}>
              {saving ? <><Loader2 className="w-4 h-4 animate-spin" /> Saving...</> : <><CheckCircle className="w-4 h-4" /> {client ? 'Save Changes' : 'Create Client'}</>}
            </button>
            <button className="btn-secondary" onClick={onClose}>Cancel</button>
          </div>
        </div>
      </div>
    </div>
  )
}

function FormSection({ title, icon: Icon, children }: { title: string; icon: any; children: React.ReactNode }) {
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

// ── Main Page ──────────────────────────────────────────────────────────────────
let _addToastRef: ((t: any) => void) | null = null
export function clientsAddToast(fn: (t: any) => void) { _addToastRef = fn }

export default function ClientsPage({ canEdit, searchQuery, onSearchChange }: Props) {
  const [clients,   setClients]   = useState<any[]>([])
  const [users,     setUsers]     = useState<any[]>([])
  const [loading,   setLoading]   = useState(true)
  const [internalSearch, setInternalSearch] = useState('')
  const [selected,  setSelected]  = useState<any | null>(null)
  const [showForm,  setShowForm]  = useState(false)
  const [editItem,  setEditItem]  = useState<any | null>(null)
  const [mailItem,  setMailItem]  = useState<any | null>(null)
  const [voiceItem, setVoiceItem] = useState<any | null>(null)
  const [toasts,    setToasts]    = useState<any[]>([])
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [isSelectionMode, setIsSelectionMode] = useState(false)

  const addToast = (t: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...t, id }])
    setTimeout(() => setToasts(prev => prev.filter(x => x.id !== id)), 3500)
  }

  useEffect(() => {
    Promise.all([
      clientsApi.list().then(setClients),
      usersApi.list().then(setUsers),
    ]).finally(() => setLoading(false))
  }, [])

  const search = searchQuery ?? internalSearch
  const setSearch = onSearchChange ?? setInternalSearch

  const filtered = clients.filter(c => {
    const q = search.toLowerCase()
    return !search || c.name?.toLowerCase().includes(q) || c.contactPerson?.toLowerCase().includes(q) || c.industry?.toLowerCase().includes(q)
  })

  const handleCreate = async (data: any) => {
    const client = await clientsApi.create(data)
    setClients(prev => [client, ...prev])
    addToast({
      message: client.sync?.createdContact
        ? `Client created: ${data.name}. Contact created automatically.`
        : `Client created: ${data.name}`,
      type: 'success'
    })
  }

  const handleEdit = async (data: any) => {
    const client = await clientsApi.update(editItem.id, data)
    setClients(prev => prev.map(c => c.id === client.id ? client : c))
    setSelected(client)
    if (client.sync && client.sync.createdContact) {
      const ct = client.sync.contact
      const name = ct ? `${ct.firstName || ''} ${ct.lastName || ''}`.trim() : ''
      addToast({ message: `Client updated. Contact created automatically${name ? `: ${name}` : ''}.`, type: 'success' })
    } else {
      addToast({ message: 'Client updated', type: 'success' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this client? This cannot be undone.')) return
    try {
      await clientsApi.delete(id)
      setClients(prev => prev.filter(c => c.id !== id))
      setSelectedIds(prev => prev.filter(i => i !== id))
      setSelected(null)
      addToast({ message: 'Client deleted', type: 'info' })
    } catch (e: any) {
      addToast({ message: e.message || 'Failed to delete client', type: 'error' })
    }
  }

  const handleBulkDelete = async () => {
    if (!confirm(`Are you sure you want to delete ${selectedIds.length} clients?`)) return
    try {
      await clientsApi.bulkDelete(selectedIds)
      setClients(prev => prev.filter(c => !selectedIds.includes(c.id)))
      addToast({ message: `${selectedIds.length} clients deleted`, type: 'info' })
      setSelectedIds([])
      setIsSelectionMode(false)
    } catch (e: any) {
      addToast({ message: 'Failed to delete selected items', type: 'error' })
    }
  }

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id])
  }

  const handleVoiceCall = async (client: any, provider: 'VAPI' | 'TWILIO' = 'VAPI') => {
    if (!client?.phone) {
      addToast({ message: 'Client has no phone number.', type: 'error' })
      return
    }

    try {
      const allLeads = await leadsApi.list()
      let lead = allLeads.find((l: any) =>
        (client.email && l.email && l.email.toLowerCase() === client.email.toLowerCase()) ||
        (client.phone && l.phone && l.phone === client.phone)
      )

      if (!lead) {
        lead = await leadsApi.create({
          title: `Voice Follow-up: ${client.name}`,
          company: client.name,
          contactName: client.contactPerson || client.name,
          email: client.email || `${(client.name || 'client').toLowerCase().replace(/\s+/g, '.')}@placeholder.local`,
          phone: client.phone,
          country: client.country || 'UAE',
          source: 'CLIENT_CALL',
          industry: client.industry || 'Other',
          value: client.totalRevenue || 0,
          priority: 'MEDIUM',
          expectedTimeline: '1–3 Months',
          requirements: `Voice outreach initiated from client profile: ${client.name}`,
          internalNotes: 'Auto-created lead to enable voice agent call from client module.',
          tags: 'client,voice-agent,auto-created',
        })
      }

      await voiceApi.initiateCall(lead.id, provider)
      addToast({ message: `Voice agent (${provider}) is calling ${client.name}...`, type: 'success' })
    } catch (e: any) {
      addToast({ message: e?.message || 'Failed to start voice call.', type: 'error' })
    }
  }

  const totalRevenue = clients.reduce((s, c) => s + Number(c.totalRevenue || 0), 0)

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
          style={{ backgroundColor: t.type === 'success' ? 'rgba(20,184,166,0.15)' : t.type === 'error' ? 'rgba(239,68,68,0.15)' : 'rgba(59,130,246,0.15)',
            border: `1px solid ${t.type === 'success' ? 'rgba(20,184,166,0.4)' : t.type === 'error' ? 'rgba(239,68,68,0.4)' : 'rgba(59,130,246,0.4)'}`,
            color: t.type === 'success' ? '#2dd4bf' : t.type === 'error' ? '#f87171' : '#60a5fa' }}>
          {t.message}
        </div>
      ))}

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Clients</h2>
          <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{clients.length} accounts · AED {(totalRevenue/1e6).toFixed(1)}M total revenue</p>
        </div>
        {canEdit && (
          <div className="flex items-center gap-2">
            <button 
              className={`btn-secondary ${isSelectionMode ? 'bg-amber-500/10 text-amber-400' : ''}`} 
              onClick={() => { setIsSelectionMode(!isSelectionMode); setSelectedIds([]) }}
            >
              <CheckCircle className="w-4 h-4" /> {isSelectionMode ? 'Cancel Selection' : 'Bulk Action'}
            </button>
            <button className="btn-primary" onClick={() => { setEditItem(null); setShowForm(true) }}>
              <Plus className="w-4 h-4" /> Add Client
            </button>
          </div>
        )}
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total Clients',  value: clients.length,   color: '#14b8a6' },
          { label: 'Platinum',       value: clients.filter(c => c.tier === 'PLATINUM').length, color: '#a78bfa' },
          { label: 'Active',         value: clients.filter(c => c.customerStatus === 'ACTIVE').length,  color: '#10b981' },
          { label: 'Total Revenue',  value: `AED ${(totalRevenue/1e6).toFixed(1)}M`,           color: '#f59e0b' },
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
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search clients by name, industry, contact..." className="input-field pl-9 py-2 text-sm" />
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((client, i) => {
          const tier   = TIER_CFG[client.tier as keyof typeof TIER_CFG]   || TIER_CFG.SILVER
          const status = STATUS_CFG[client.customerStatus as keyof typeof STATUS_CFG] || STATUS_CFG.PROSPECT
          return (
            <motion.div key={client.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}
              className={`panel p-5 cursor-pointer group transition-all hover:shadow-lg relative ${selectedIds.includes(client.id) ? 'border-teal-500 ring-1 ring-teal-500/50' : ''}`}
              onClick={() => isSelectionMode ? toggleSelect(client.id) : setSelected(client)}>
              
              {isSelectionMode && (
                <div className="absolute top-4 left-4 z-10">
                  <div className={`w-5 h-5 rounded border ${selectedIds.includes(client.id) ? 'bg-teal-500 border-teal-500' : 'bg-black/20 border-white/20'} flex items-center justify-center transition-all shadow-lg`}>
                    {selectedIds.includes(client.id) && <CheckCircle className="w-4 h-4 text-slate-900" />}
                  </div>
                </div>
              )}
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                    style={{ backgroundColor: tier.color }}>
                    {client.name?.charAt(0)}
                  </div>
                  <div>
                    <p className="font-semibold group-hover:text-teal-400 transition-colors" style={{ color: 'var(--text-primary)' }}>{client.name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{client.industry || '—'} · {client.country || '—'}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: tier.bg, color: tier.color, border: `1px solid ${tier.border}` }}>
                    {tier.label}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 mb-4">
                <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <p className="text-xs font-bold" style={{ color: '#10b981' }}>AED {(Number(client.totalRevenue)/1e6).toFixed(1)}M</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Revenue</p>
                </div>
                <div className="rounded-lg p-2.5 text-center" style={{ backgroundColor: 'var(--bg-elevated)' }}>
                  <p className="text-xs font-bold" style={{ color: '#3b82f6' }}>{client.activeDeals}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>Active Deals</p>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{client.contactPerson || 'No contact'}</p>
                  <span className="text-xs font-semibold" style={{ color: status.color }}>● {status.label}</span>
                </div>
                <div className="flex items-center gap-1" onClick={e => e.stopPropagation()}>
                  {client.phone && (
                    <button onClick={() => setVoiceItem(client)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-emerald-500/10 transition-colors"
                      style={{ color: 'var(--text-muted)' }} title="Call via voice agent">
                      <PhoneCall className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {client.email && (
                    <button onClick={() => setMailItem(client)} className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-blue-500/10 transition-colors"
                      style={{ color: 'var(--text-muted)' }} title="Send email">
                      <Mail className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={() => { setEditItem(client); setShowForm(true) }} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-slate-700"
                      style={{ color: 'var(--text-muted)' }} title="Edit">
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  {canEdit && (
                    <button onClick={(e) => { e.stopPropagation(); handleDelete(client.id) }} className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10 hover:text-red-400"
                      style={{ color: 'var(--text-muted)' }} title="Delete">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <ChevronRight className="w-4 h-4 opacity-40" style={{ color: 'var(--text-muted)' }} />
                </div>
              </div>
            </motion.div>
          )
        })}
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-16 panel">
          <Building2 className="w-10 h-10 mx-auto mb-3 opacity-20" style={{ color: 'var(--text-muted)' }} />
          <p className="font-medium" style={{ color: 'var(--text-secondary)' }}>No clients found</p>
          <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
            {canEdit ? 'Click "Add Client" to add your first client.' : 'No clients in the system yet.'}
          </p>
        </div>
      )}

      {/* Overlays */}
      <AnimatePresence>
        {selected && !showForm && !mailItem && (
          <ClientDetail client={selected} canEdit={canEdit}
            onClose={() => setSelected(null)}
            onEdit={() => { setEditItem(selected); setShowForm(true) }}
            onMail={() => setMailItem(selected)}
            onCall={() => setVoiceItem(selected)} />
        )}
      </AnimatePresence>

      {showForm && (
        <ClientForm client={editItem} users={users}
          onSave={editItem ? handleEdit : handleCreate}
          onClose={() => { setShowForm(false); setEditItem(null) }} />
      )}

      {mailItem && <MailModal client={mailItem} onClose={() => setMailItem(null)} addToast={addToast} />}

      {voiceItem && (
        <VoiceAgentModal
          client={voiceItem}
          onClose={() => setVoiceItem(null)}
          onStart={async (provider) => {
            await handleVoiceCall(voiceItem, provider)
            setVoiceItem(null)
          }}
        />
      )}

      <AnimatePresence>
        {selectedIds.length > 0 && (
          <motion.div
            initial={{ y: 100, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 100, opacity: 0 }}
            className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 bg-slate-900 border border-[var(--border)] rounded-2xl shadow-2xl px-6 py-4 flex items-center gap-6"
          >
            <span className="text-sm font-medium text-white">{selectedIds.length} clients selected</span>
            <div className="h-6 w-px bg-slate-700" />
            <button
              onClick={handleBulkDelete}
              className="flex items-center gap-2 text-sm font-semibold text-red-400 hover:text-red-300 transition-colors"
            >
              <Trash2 className="w-4 h-4" /> Delete Selected
            </button>
            <button
              onClick={() => { setSelectedIds([]); setIsSelectionMode(false) }}
              className="text-sm font-medium text-slate-400 hover:text-white transition-colors"
            >
              Cancel
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
