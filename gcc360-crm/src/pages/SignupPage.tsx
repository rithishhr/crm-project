import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, AlertCircle, ArrowLeft } from 'lucide-react'
import { authApi } from '../lib/api'
import type { User } from '../types'

interface Props {
  onSuccess:   (user: User, token: string) => void
  onGoToLogin: () => void
}

export default function SignupPage({ onSuccess, onGoToLogin }: Props) {
  const [form, setForm] = useState({ name: '', email: '', password: '', companyName: '', country: 'UAE', industry: 'Oil & Gas' })
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error,   setError]   = useState('')
  const [companyHint, setCompanyHint] = useState('')
  const [bootstrapMode, setBootstrapMode] = useState(false)
  const [checkingCompany, setCheckingCompany] = useState(false)

  useEffect(() => {
    authApi.bootstrapStatus().then(r => setBootstrapMode(r.needsBootstrap)).catch(() => setBootstrapMode(false))
  }, [])

  useEffect(() => {
    const companyName = form.companyName.trim()
    if (!companyName) {
      setCompanyHint('')
      return
    }

    const timer = window.setTimeout(async () => {
      setCheckingCompany(true)
      try {
        const result = await authApi.companyCheck(companyName)
        if (result.exists) {
          setCompanyHint('This company already exists. An admin must invite you instead of creating a new company.')
        } else {
          setCompanyHint('')
        }
      } catch {
        setCompanyHint('')
      } finally {
        setCheckingCompany(false)
      }
    }, 350)

    return () => window.clearTimeout(timer)
  }, [form.companyName])

  const set = (key: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) =>
    setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password || !form.companyName) {
      setError('All fields are required.')
      return
    }
    if (form.password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (companyHint) { setError(companyHint); return }
    setError(''); setLoading(true)
    try {
      const { accessToken, user } = await authApi.signup(form)
      onSuccess(user, accessToken)
    } catch (err: any) {
      setError(err.message || 'Signup failed.')
    } finally { setLoading(false) }
  }

  const COUNTRIES  = ['UAE', 'Saudi Arabia', 'Qatar', 'Kuwait', 'Bahrain', 'Oman', 'Jordan', 'Egypt', 'Other']
  const INDUSTRIES = ['Oil & Gas', 'Energy', 'Construction', 'Finance', 'Healthcare', 'Government', 'Retail', 'Technology', 'Other']

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#14b8a6' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>GCC360 CRM</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Create your company account</p>
          </div>
        </div>

        <div className="panel p-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Get started</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
            {bootstrapMode ? 'Set up the first administrator for your company.' : "Create your account and manage your company in GCC360."}
          </p>

          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Your Full Name</label>
              <input type="text" className="input-field" placeholder="Ahmed Al-Rashidi" value={form.name} onChange={set('name')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Work Email</label>
              <input type="email" className="input-field" placeholder="ahmed@yourcompany.com" value={form.email} onChange={set('email')} />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
              <div className="relative">
                <input type={showPassword ? 'text' : 'password'} className="input-field pr-10" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Company Name</label>
              <input type="text" className="input-field" placeholder="ADNOC, Aramco, Your Company..." value={form.companyName} onChange={set('companyName')} />
              <div className="mt-1 text-xs" style={{ color: companyHint ? '#f59e0b' : 'var(--text-muted)' }}>
                {checkingCompany ? 'Checking company name...' : companyHint || 'If your company already exists, please ask an administrator for an invite.'}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Country</label>
                <select className="input-field" value={form.country} onChange={set('country')}>
                  {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Industry</label>
                <select className="input-field" value={form.industry} onChange={set('industry')}>
                  {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                </select>
              </div>
            </div>
          </div>

          <button className="btn-primary w-full justify-center mt-6" onClick={handleSignup} disabled={loading}>
            {loading ? 'Creating account...' : 'Create Company Account →'}
          </button>
        </div>

        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
          <button onClick={onGoToLogin} className="flex items-center gap-1 mx-auto hover:underline" style={{ color: 'var(--accent)' }}>
            <ArrowLeft className="w-3.5 h-3.5" /> Back to login
          </button>
        </p>
      </motion.div>
    </div>
  )
}
