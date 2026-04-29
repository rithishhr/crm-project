import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { UserCog, Shield, UserPlus, X, Check, Loader2, Trash2, Upload } from 'lucide-react'
import { usersApi, importsApi } from '../lib/api'
import type { User, UserRole, UserStatus } from '../types'
import type { Toast } from '../components/ui/Toast'

interface Props {
  addToast: (t: Omit<Toast, 'id'>) => void
  currentUser?: any
}

const roleLabels: Record<string, string> = {
  ADMIN: 'Administrator',
  MANAGER: 'Team Manager',
  SALES: 'Sales Representative',
  FINANCE: 'Finance & Accounts',
}

const roleColors: Record<string, string> = {
  ADMIN: '#f59e0b',
  MANAGER: '#14b8a6',
  SALES: '#3b82f6',
  FINANCE: '#10b981',
}

export default function UsersPage({ addToast, currentUser }: Props) {
  const [users, setUsers] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [editingRole, setEditingRole] = useState<string | null>(null)
  const [inviteForm, setInviteForm] = useState({ name: '', email: '', role: 'SALES', department: '' })
  const [inviting, setInviting] = useState(false)
  const [reseting, setReseting] = useState<string | null>(null)
  const [importEntity, setImportEntity] = useState<'leads' | 'clients' | 'contacts' | 'users'>('leads')
  const [importFile, setImportFile] = useState<File | null>(null)
  const [importing, setImporting] = useState(false)
  const [importSummary, setImportSummary] = useState<string>('')

  const fetchUsers = async () => {
    try {
      const data = await usersApi.list()
      setUsers(data)
    } catch (err) {
      addToast({ message: 'Failed to load users', type: 'error' })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const changeRole = async (userId: string, role: string) => {
    try {
      await usersApi.setRole(userId, role)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, role } : u))
      setEditingRole(null)
      addToast({ message: `Role updated to ${roleLabels[role] || role}`, type: 'success' })
    } catch (err) {
      addToast({ message: 'Failed to update role', type: 'error' })
    }
  }

  const toggleStatus = async (userId: string, currentStatus: string) => {
    const newStatus = currentStatus === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
    try {
      await usersApi.setStatus(userId, newStatus)
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u))
      addToast({ message: `User ${newStatus === 'ACTIVE' ? 'activated' : 'deactivated'}`, type: 'success' })
    } catch (err) {
      addToast({ message: 'Failed to update status', type: 'error' })
    }
  }

  const handleResetPassword = async (userId: string) => {
    if (!confirm('Are you sure you want to reset this user\'s password? They will be sent a new OTP and forced to change it on next login.')) return
    setReseting(userId)
    try {
      const { tempPassword } = await usersApi.resetPassword(userId)
      addToast({ message: `Password reset! New OTP: ${tempPassword}`, type: 'success' })
      fetchUsers()
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to reset password', type: 'error' })
    } finally {
      setReseting(null)
    }
  }

  const handleInvite = async () => {
    if (!inviteForm.name.trim() || !inviteForm.email.trim()) return
    setInviting(true)
    try {
      await usersApi.invite(inviteForm)
      setShowInvite(false)
      setInviteForm({ name: '', email: '', role: 'SALES', department: '' })
      addToast({ message: `Invitation sent to ${inviteForm.email}`, type: 'success' })
      fetchUsers()
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to send invitation', type: 'error' })
    } finally {
      setInviting(false)
    }
  }

  const handleDeleteUser = async (userId: string) => {
    if (!confirm('Are you sure you want to PERMANENTLY delete this user account? This cannot be undone.')) return
    try {
      await usersApi.delete(userId)
      setUsers(prev => prev.filter(u => u.id !== userId))
      addToast({ message: 'User account deleted permanently', type: 'info' })
    } catch (err: any) {
      addToast({ message: err.message || 'Failed to delete user', type: 'error' })
    }
  }

  const handleImport = async () => {
    if (!importFile) return
    setImporting(true)
    setImportSummary('')
    try {
      const result = await importsApi.importCsv(importEntity, importFile)
      setImportSummary(`Imported ${result.rows} rows: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped`)
      addToast({ message: `${importEntity} import complete`, type: 'success' })
      setImportFile(null)
      fetchUsers()
    } catch (err: any) {
      addToast({ message: err.message || 'Import failed', type: 'error' })
    } finally {
      setImporting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <Loader2 className="w-8 h-8 animate-spin text-teal-500" />
        <p className="text-[var(--text-muted)]">Loading team...</p>
      </div>
    )
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-[var(--text-primary)]">User Management</h2>
          <p className="text-[var(--text-muted)] text-sm mt-0.5">
            {users.filter(u => u.status === 'ACTIVE').length} active · {users.length} total
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button className="btn-secondary" onClick={() => setShowInvite(true)}>
            <UserPlus className="w-4 h-4" /> Invite User
          </button>
        </div>
      </div>

      <div className="panel p-4 space-y-4">
        <div className="flex items-center gap-2">
          <Upload className="w-4 h-4" style={{ color: 'var(--accent)' }} />
          <h3 className="font-semibold text-[var(--text-primary)]">CSV Import</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Entity</label>
            <select className="input-field" value={importEntity} onChange={e => setImportEntity(e.target.value as any)}>
              <option value="leads">Leads</option>
              <option value="clients">Clients</option>
              <option value="contacts">Contacts</option>
              <option value="users">Users</option>
            </select>
          </div>
          <div className="md:col-span-2">
            <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">CSV File</label>
            <input type="file" accept=".csv,text/csv" className="input-field" onChange={e => setImportFile(e.target.files?.[0] || null)} />
          </div>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button className="btn-primary" onClick={handleImport} disabled={!importFile || importing}>
            {importing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
            {importing ? 'Importing...' : 'Import CSV'}
          </button>
          <p className="text-xs text-[var(--text-muted)]">Use headers like name, email, company, firstName, lastName, role, status.</p>
        </div>
        {importSummary && <p className="text-sm text-[var(--text-secondary)]">{importSummary}</p>}
      </div>

      <div className="panel overflow-hidden">
        <table className="w-full data-table">
          <thead>
            <tr>
              <th>User</th>
              <th>Email</th>
              <th>Role</th>
              <th>Department</th>
              <th>Status</th>
              <th>Security</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((user, i) => {
              const role = user.role as string
              const color = roleColors[role] || '#64748b'
              return (
                <motion.tr key={user.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                  <td>
                    <div className="flex items-center gap-2.5">
                      {user.avatarUrl ? (
                        <img src={user.avatarUrl} className="w-8 h-8 rounded-full" alt="" />
                      ) : (
                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold text-white" style={{ backgroundColor: color }}>
                          {user.avatar || user.name?.charAt(0)}
                        </div>
                      )}
                      <div>
                        <p className="text-sm font-medium text-[var(--text-primary)]">{user.name}</p>
                        <p className="text-[10px] text-[var(--text-muted)]">Joined {new Date(user.createdAt).toLocaleDateString()}</p>
                      </div>
                    </div>
                  </td>
                  <td><p className="text-xs text-[var(--text-secondary)]">{user.email}</p></td>
                  <td>
                    <div className="relative">
                      {editingRole === user.id ? (
                        <select
                          value={user.role}
                          onChange={e => changeRole(user.id, e.target.value)}
                          className="text-[10px] px-2 py-0.5 rounded bg-[var(--bg-elevated)] border border-[var(--border)] text-[var(--text-primary)]"
                          autoFocus
                          onBlur={() => setEditingRole(null)}
                        >
                          {Object.entries(roleLabels).map(([val, label]) => (
                            <option key={val} value={val}>{label}</option>
                          ))}
                        </select>
                      ) : (
                        <span
                          className="badge border cursor-pointer hover:opacity-80 transition-opacity text-[10px] uppercase font-bold"
                          style={{ backgroundColor: `${color}15`, color: color, borderColor: `${color}30` }}
                          onClick={() => setEditingRole(user.id)}
                        >
                          {roleLabels[role] || role}
                        </span>
                      )}
                    </div>
                  </td>
                  <td><p className="text-xs text-[var(--text-secondary)]">{user.department || '—'}</p></td>
                  <td>
                    <span className={`badge border text-[10px] uppercase font-bold ${
                      user.status === 'ACTIVE' ? 'bg-teal-500/10 text-teal-400 border-teal-500/20' :
                      user.status === 'PENDING' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' :
                      'bg-slate-500/10 text-slate-400 border-slate-500/20'
                    }`}>
                      {user.status}
                    </span>
                  </td>
                  <td>
                    <div className="flex items-center gap-1 text-[10px] text-[var(--text-muted)]">
                      {user.faceDescriptor ? (
                        <span className="flex items-center gap-1 text-teal-400"><Shield className="w-3 h-3" /> Face ID On</span>
                      ) : (
                        <span className="opacity-40 flex items-center gap-1"><Shield className="w-3 h-3" /> No MFA</span>
                      )}
                    </div>
                  </td>
                  <td className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleResetPassword(user.id)}
                          disabled={reseting === user.id}
                          className="text-[10px] px-2 py-1 rounded transition-all font-bold text-amber-400 hover:bg-amber-500/10 border border-amber-500/10"
                        >
                          {reseting === user.id ? 'Resetting...' : 'Reset Pass'}
                        </button>
                      )}
                      <button
                        onClick={() => toggleStatus(user.id, user.status)}
                        className={`text-[10px] px-2 py-1 rounded transition-all font-bold ${
                          user.status === 'ACTIVE' 
                            ? 'text-red-400 hover:bg-red-500/10 border border-red-500/10' 
                            : 'text-teal-400 hover:bg-teal-500/10 border border-teal-500/10'
                        }`}
                      >
                        {user.status === 'ACTIVE' ? 'Deactivate' : 'Activate'}
                      </button>
                      {user.id !== currentUser?.id && (
                        <button
                          onClick={() => handleDeleteUser(user.id)}
                          className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-red-500/10 text-[var(--text-muted)] hover:text-red-400 transition-colors border border-[var(--border)]"
                          title="Delete User"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </td>
                </motion.tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <AnimatePresence>
        {showInvite && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40" onClick={() => setShowInvite(false)} />
            <motion.div
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none"
            >
              <div className="w-full max-w-md rounded-2xl p-6 bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl pointer-events-auto">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h3 className="font-bold text-[var(--text-primary)]">Invite New User</h3>
                    <p className="text-xs text-[var(--text-muted)] mt-0.5">Send a setup link to a team member</p>
                  </div>
                  <button onClick={() => setShowInvite(false)} className="text-[var(--text-muted)] hover:text-white"><X className="w-5 h-5" /></button>
                </div>

                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Full Name</label>
                    <input 
                      value={inviteForm.name} 
                      onChange={e => setInviteForm({...inviteForm, name: e.target.value})} 
                      className="input-field" placeholder="e.g. Mariam Al-Mansouri" 
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Email Address</label>
                    <input 
                      value={inviteForm.email} 
                      onChange={e => setInviteForm({...inviteForm, email: e.target.value})} 
                      className="input-field" placeholder="mariam@gcc360.com" type="email" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Assign Role</label>
                      <select
                        value={inviteForm.role}
                        onChange={e => setInviteForm({...inviteForm, role: e.target.value})}
                        className="input-field"
                      >
                        {Object.entries(roleLabels).map(([val, label]) => (
                          <option key={val} value={val}>{label}</option>
                        ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Department</label>
                      <input 
                        value={inviteForm.department} 
                        onChange={e => setInviteForm({...inviteForm, department: e.target.value})} 
                        className="input-field" placeholder="e.g. Sales" 
                      />
                    </div>
                  </div>
                  <div className="flex gap-3 pt-2">
                    <button onClick={() => setShowInvite(false)} className="btn-secondary flex-1 justify-center">Cancel</button>
                    <button onClick={handleInvite} className="btn-primary flex-1 justify-center" disabled={inviting}>
                      {inviting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                      {inviting ? 'Sending...' : 'Send Invitation'}
                    </button>
                  </div>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}