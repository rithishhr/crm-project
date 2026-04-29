import { useState } from 'react'
import { motion } from 'framer-motion'
import { KeyRound, ShieldCheck, AlertCircle, Loader2, CheckCircle, ArrowRight } from 'lucide-react'
import { authApi } from '../lib/api'

interface Props {
  email: string
  onSuccess: () => void
  onLogout: () => void
}

export default function PasswordChangePage({ email, onSuccess, onLogout }: Props) {
  const [tempPassword, setTempPassword] = useState('')
  const [newPassword,  setNewPassword]  = useState('')
  const [confirmPass,  setConfirmPass]  = useState('')
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [success,      setSuccess]      = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!tempPassword || !newPassword || !confirmPass) {
      setError('All fields are required.')
      return
    }
    if (newPassword !== confirmPass) {
      setError('New passwords do not match.')
      return
    }
    if (newPassword.length < 8) {
      setError('Password must be at least 8 characters long.')
      return
    }

    setLoading(true)
    setError('')

    try {
      await authApi.changePasswordFirstLogin({
        email,
        tempPassword,
        newPassword
      })
      setSuccess(true)
      setTimeout(onSuccess, 2000)
    } catch (err: any) {
      setError(err.message || 'Failed to update password. Please check your temporary password.')
    } finally {
      setLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-base)]">
        <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="panel p-10 text-center max-w-md">
          <div className="w-16 h-16 rounded-full bg-teal-500/20 flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-8 h-8 text-teal-400" />
          </div>
          <h2 className="text-2xl font-bold mb-2">Password Updated</h2>
          <p className="text-[var(--text-muted)] mb-6">Your password has been changed successfully. You will be redirected to login shortly.</p>
          <div className="h-1 w-full bg-[var(--bg-elevated)] rounded-full overflow-hidden">
            <motion.div initial={{ width: 0 }} animate={{ width: '100%' }} transition={{ duration: 2 }} className="h-full bg-teal-400" />
          </div>
        </motion.div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-[var(--bg-base)]">
      <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="w-12 h-12 rounded-xl bg-amber-500/20 flex items-center justify-center mx-auto mb-4">
            <KeyRound className="w-6 h-6 text-amber-400" />
          </div>
          <h1 className="text-2xl font-bold text-[var(--text-primary)]">Security Update Required</h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">For your security, you must change your temporary password before continuing.</p>
        </div>

        <div className="panel p-8 shadow-2xl">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Temporary Password</label>
              <input 
                type="text" 
                className="input-field" 
                placeholder="Enter the OTP from your email"
                value={tempPassword}
                onChange={e => setTempPassword(e.target.value)}
              />
            </div>

            <hr className="border-[var(--border)] opacity-50" />

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">New Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Minimum 8 characters"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div>
              <label className="block text-xs font-semibold uppercase tracking-wider mb-1.5 text-[var(--text-muted)]">Confirm New Password</label>
              <input 
                type="password" 
                className="input-field" 
                placeholder="Repeat new password"
                value={confirmPass}
                onChange={e => setConfirmPass(e.target.value)}
              />
            </div>

            <button type="submit" className="btn-primary w-full justify-center py-3" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <ShieldCheck className="w-5 h-5" />}
              Update & Continue
            </button>
          </form>

          <button onClick={onLogout} className="w-full text-center mt-6 text-sm text-[var(--text-muted)] hover:text-white transition-colors">
            Back to login
          </button>
        </div>

        <div className="mt-8 p-4 rounded-xl bg-teal-500/5 border border-teal-500/10 flex gap-3">
          <ShieldCheck className="w-5 h-5 text-teal-400 flex-shrink-0" />
          <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
            <strong>Security Tip:</strong> Choose a strong password that you haven't used elsewhere. A mix of letters, numbers, and symbols is recommended.
          </p>
        </div>
      </motion.div>
    </div>
  )
}
