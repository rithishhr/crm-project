import { useState, useRef, useEffect } from 'react'
import { Camera, Save, Lock, User, Phone, Briefcase, FileText, Trash2, CheckCircle, AlertCircle, Shield, ScanFace, ChevronRight } from 'lucide-react'
import { profileApi, biometricApi } from '../lib/api'
import type { User as UserType } from '../types'
import FaceIDModal from '../components/ui/FaceIDModal'

interface Props {
  user:        UserType
  onUserUpdate: (updated: Partial<UserType>) => void
}

const ROLE_COLORS: Record<string, string> = {
  admin:   '#f59e0b',
  manager: '#14b8a6',
  sales:   '#3b82f6',
  finance: '#10b981',
}

const ROLE_LABELS: Record<string, string> = {
  admin:   'Administrator',
  manager: 'Team Manager',
  sales:   'Sales Representative',
  finance: 'Finance & Accounts',
}

type ToastType = { message: string; type: 'success' | 'error' }

export default function AccountSettingsPage({ user, onUserUpdate }: Props) {
  const [activeTab, setActiveTab] = useState<'profile' | 'password' | 'security' | 'account'>('profile')
  const [toast, setToast]         = useState<ToastType | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  // Profile form
  const [name,       setName]       = useState(user.name       || '')
  const [department, setDepartment] = useState(user.department || '')
  const [phone,      setPhone]      = useState((user as any).phone || '')
  const [bio,        setBio]        = useState((user as any).bio   || '')
  const [saving,     setSaving]     = useState(false)

  // Password form
  const [currentPass, setCurrentPass] = useState('')
  const [newPass,     setNewPass]     = useState('')
  const [confirmPass, setConfirmPass] = useState('')
  const [pwSaving,    setPwSaving]    = useState(false)

  // Avatar
  const [avatarUrl,   setAvatarUrl]   = useState((user as any).avatarUrl || '')
  const [avatarSaving, setAvatarSaving] = useState(false)

  // Biometric
  const [biometricEnabled, setBiometricEnabled] = useState(user.biometricEnabled || false)
  const [showEnrollment,   setShowEnrollment]   = useState(false)
  const [biometricStats,   setBiometricStats]   = useState<any>(null)

  const showToast = (message: string, type: 'success' | 'error') => {
    setToast({ message, type })
    setTimeout(() => setToast(null), 3500)
  }

  // Reload latest profile from API
  useEffect(() => {
    profileApi.get().then(data => {
      setName(data.name || '')
      setDepartment(data.department || '')
      setPhone(data.phone || '')
      setBio(data.bio || '')
      setAvatarUrl(data.avatarUrl || '')
      setBiometricEnabled(data.biometricEnabled || false)
    }).catch(() => {})

    biometricApi.status(user.id).then(res => {
      if (res.success) setBiometricStats(res.data)
    }).catch(() => {})
  }, [user.id])

  const handleSaveProfile = async () => {
    if (!name.trim()) { showToast('Name cannot be empty.', 'error'); return }
    setSaving(true)
    try {
      await profileApi.update({ name, department, phone, bio })
      onUserUpdate({ name, department } as any)
      showToast('Profile updated successfully!', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to save profile.', 'error')
    } finally { setSaving(false) }
  }

  const handleChangePassword = async () => {
    if (!currentPass || !newPass || !confirmPass) { showToast('All password fields are required.', 'error'); return }
    if (newPass.length < 6) { showToast('New password must be at least 6 characters.', 'error'); return }
    if (newPass !== confirmPass) { showToast('New passwords do not match.', 'error'); return }
    setPwSaving(true)
    try {
      await profileApi.changePassword(currentPass, newPass)
      setCurrentPass(''); setNewPass(''); setConfirmPass('')
      showToast('Password changed! Other devices will be signed out.', 'success')
    } catch (err: any) {
      showToast(err.message || 'Failed to change password.', 'error')
    } finally { setPwSaving(false) }
  }

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setAvatarSaving(true)
    try {
      const result = await profileApi.uploadAvatar(file)
      if (result.avatarUrl) {
        setAvatarUrl(result.avatarUrl)
        showToast('Profile picture updated!', 'success')
      }
    } catch { showToast('Failed to upload image.', 'error') }
    finally { setAvatarSaving(false) }
  }

  const handleRemoveAvatar = async () => {
    setAvatarSaving(true)
    try {
      await profileApi.removeAvatar()
      setAvatarUrl('')
      showToast('Profile picture removed.', 'success')
    } catch { showToast('Failed to remove image.', 'error') }
    finally { setAvatarSaving(false) }
  }

  const handleEnrollFace = async (descriptor?: Float32Array) => {
    if (!descriptor) return
    try {
      const res = await biometricApi.enroll(user.id, descriptor, 0.95)
      if (res.success) {
        setBiometricEnabled(true)
        onUserUpdate({ biometricEnabled: true } as any)
        showToast('Face ID successfully enabled!', 'success')
        
        // Refresh stats
        const stats = await biometricApi.status(user.id)
        if (stats.success) setBiometricStats(stats.data)
      }
    } catch (err: any) {
      showToast(err.message || 'Enrollment failed.', 'error')
    } finally {
      setShowEnrollment(false)
    }
  }

  const handleDisableFace = async () => {
    if (!confirm('Are you sure you want to disable Face ID?')) return
    try {
      await biometricApi.disable()
      setBiometricEnabled(false)
      onUserUpdate({ biometricEnabled: false } as any)
      showToast('Face ID disabled.', 'success')
    } catch { showToast('Failed to disable Face ID.', 'error') }
  }

  const roleColor = ROLE_COLORS[user.role] || '#14b8a6'
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const tabs = [
    { key: 'profile',  label: 'Profile',         icon: User },
    { key: 'password', label: 'Password',        icon: Lock },
    { key: 'security', label: 'Security',        icon: Shield },
    { key: 'account',  label: 'Account Info',     icon: Briefcase },
  ] as const

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {showEnrollment && (
        <FaceIDModal
          user={user}
          mode="enroll"
          onSuccess={handleEnrollFace}
          onClose={() => setShowEnrollment(false)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div className="fixed top-4 right-4 z-[110] flex items-center gap-2 px-4 py-3 rounded-xl shadow-xl text-sm"
          style={{ backgroundColor: toast.type === 'success' ? 'rgba(20,184,166,0.15)' : 'rgba(239,68,68,0.15)',
            border: `1px solid ${toast.type === 'success' ? 'rgba(20,184,166,0.4)' : 'rgba(239,68,68,0.4)'}`,
            color: toast.type === 'success' ? '#2dd4bf' : '#f87171' }}>
          {toast.type === 'success' ? <CheckCircle className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
          {toast.message}
        </div>
      )}

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--text-primary)' }}>Account Settings</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>Manage your profile, security, and preferences</p>
      </div>

      {/* Avatar section */}
      <div className="panel p-6 flex items-center gap-6">
        <div className="relative">
          {avatarUrl ? (
            <img
              src={avatarUrl.startsWith('/uploads') ? `${backendUrl}${avatarUrl}` : avatarUrl}
              alt="avatar"
              className="w-20 h-20 rounded-2xl object-cover"
              style={{ border: `3px solid ${roleColor}` }}
            />
          ) : (
            <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-2xl font-bold text-white"
              style={{ backgroundColor: roleColor }}>
              {user.avatar || user.name?.charAt(0) || '?'}
            </div>
          )}
          <button
            onClick={() => fileRef.current?.click()}
            className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: 'var(--accent)', border: '2px solid var(--bg-card)' }}
            disabled={avatarSaving}
          >
            <Camera className="w-3.5 h-3.5 text-white" />
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>{user.name}</h2>
          <span className="inline-block text-xs font-bold px-2.5 py-1 rounded-full mt-1" style={{ backgroundColor: `${roleColor}20`, color: roleColor, border: `1px solid ${roleColor}40` }}>
            {ROLE_LABELS[user.role] || user.role}
          </span>
          <p className="text-xs mt-2" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
        </div>
        {avatarUrl && (
          <button onClick={handleRemoveAvatar} disabled={avatarSaving}
            className="btn-secondary text-xs flex items-center gap-1.5 text-red-400 border-red-400/20">
            <Trash2 className="w-3.5 h-3.5" /> Remove
          </button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
        {tabs.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium flex-1 justify-center transition-all"
            style={activeTab === tab.key
              ? { backgroundColor: 'var(--accent)', color: '#fff' }
              : { color: 'var(--text-muted)' }}
          >
            <tab.icon className="w-4 h-4" />
            <span className="hidden sm:block">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ── PROFILE TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'profile' && (
        <div className="panel p-6 space-y-5">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Personal Information</h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <User className="w-3.5 h-3.5" /> Full Name
              </label>
              <input className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder="Your full name" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Briefcase className="w-3.5 h-3.5" /> Department
              </label>
              <input className="input-field" value={department} onChange={e => setDepartment(e.target.value)} placeholder="Sales, Finance..." />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <Phone className="w-3.5 h-3.5" /> Phone Number
              </label>
              <input className="input-field" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+971 50 000 0000" />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium mb-1.5 flex items-center gap-1.5" style={{ color: 'var(--text-secondary)' }}>
                <FileText className="w-3.5 h-3.5" /> Bio
              </label>
              <textarea
                className="input-field resize-none"
                rows={3}
                value={bio}
                onChange={e => setBio(e.target.value)}
                placeholder="Tell your team a little about yourself..."
              />
            </div>
          </div>

          <button className="btn-primary flex items-center gap-2" onClick={handleSaveProfile} disabled={saving}>
            <Save className="w-4 h-4" />
            {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      )}

      {/* ── PASSWORD TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'password' && (
        <div className="panel p-6 space-y-5">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Change Password</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            After changing your password, you'll be signed out on all other devices.
          </p>

          <div className="space-y-4">
            {[
              { label: 'Current Password',  val: currentPass, set: setCurrentPass, ph: 'Your current password' },
              { label: 'New Password',       val: newPass,     set: setNewPass,     ph: 'Min. 6 characters' },
              { label: 'Confirm New Password', val: confirmPass, set: setConfirmPass, ph: 'Repeat new password' },
            ].map(field => (
              <div key={field.label}>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>{field.label}</label>
                <input type="password" className="input-field" placeholder={field.ph} value={field.val} onChange={e => field.set(e.target.value)} />
              </div>
            ))}
          </div>

          <button className="btn-primary flex items-center gap-2" onClick={handleChangePassword} disabled={pwSaving}>
            <Lock className="w-4 h-4" />
            {pwSaving ? 'Changing...' : 'Change Password'}
          </button>
        </div>
      )}

      {/* ── SECURITY TAB ────────────────────────────────────────────────────────── */}
      {activeTab === 'security' && (
        <div className="panel p-6 space-y-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl flex items-center justify-center" style={{ backgroundColor: 'rgba(20,184,166,0.1)' }}>
                <ScanFace className="w-6 h-6 text-teal-500" />
              </div>
              <div>
                <h3 className="font-bold" style={{ color: 'var(--text-primary)' }}>Biometric Authentication</h3>
                <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Use your face to sign in securely</p>
              </div>
            </div>
            
            <button 
              onClick={() => biometricEnabled ? handleDisableFace() : setShowEnrollment(true)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${biometricEnabled ? 'bg-teal-500' : 'bg-gray-700'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${biometricEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>

          {biometricEnabled && biometricStats && (
            <div className="p-4 rounded-2xl space-y-3" style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Status</span>
                <span className="font-bold text-teal-400">ACTIVE</span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Enrollment Date</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {new Date(biometricStats.enrollmentDate).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Last Used</span>
                <span style={{ color: 'var(--text-primary)' }}>
                  {biometricStats.lastUsed ? new Date(biometricStats.lastUsed).toLocaleString('en-GB') : 'Never'}
                </span>
              </div>
              <div className="flex justify-between items-center text-xs">
                <span style={{ color: 'var(--text-muted)' }}>Verification Success Rate</span>
                <span className="text-teal-500 font-bold">{biometricStats.successRate.toFixed(1)}%</span>
              </div>
            </div>
          )}

          <div className="space-y-4">
             <div className="flex items-center gap-3 p-4 rounded-2xl" style={{ backgroundColor: 'rgba(59,130,246,0.05)', border: '1px solid rgba(59,130,246,0.2)' }}>
                <Shield className="w-5 h-5 text-blue-400 flex-shrink-0" />
                <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                  Your biometric data is vectorized into a 128-bit mathematical descriptor. We never store your actual photo. Processing happens entirely in your browser.
                </p>
             </div>
          </div>
        </div>
      )}

      {/* ── ACCOUNT INFO TAB ─────────────────────────────────────────────────────── */}
      {activeTab === 'account' && (
        <div className="panel p-6 space-y-4">
          <h3 className="font-semibold" style={{ color: 'var(--text-primary)' }}>Account Information</h3>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>These details are managed by your admin.</p>

          {[
            { label: 'Email Address', value: user.email },
            { label: 'Role',          value: ROLE_LABELS[user.role] || user.role },
            { label: 'Status',        value: (user.status || 'active').charAt(0).toUpperCase() + (user.status || 'active').slice(1) },
            { label: 'Member Since',  value: user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : 'N/A' },
            { label: 'Last Login',    value: (user as any).lastLogin ? new Date((user as any).lastLogin).toLocaleString('en-GB') : 'N/A' },
          ].map(row => (
            <div key={row.label} className="flex justify-between items-center py-3" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
              <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{row.label}</span>
              <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{row.value}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
