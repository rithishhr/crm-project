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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-[var(--bg-base)]">
      <div className="w-full max-w-lg">
        {/* Official Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-[var(--bg-card)] border border-[var(--border)] shadow-sm mb-4">
            <Zap className="w-7 h-7 text-teal-500" />
          </div>
          <h1 className="text-2xl font-black text-[var(--text-primary)] tracking-tight">GCC360 <span className="text-teal-600">CRM</span></h1>
          <p className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-widest mt-1">New Organization Enrollment</p>
        </div>

        <div className="official-card bg-[var(--bg-card)] p-10">
          <div className="mb-8 text-center">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">Get Started</h2>
            <p className="text-sm text-[var(--text-muted)] mt-1">
              Create your enterprise workspace and admin account
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-500/10 border border-red-500/20 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-500">{error}</p>
            </div>
          )}

          <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">Full Name</label>
                <input type="text" className="input-field py-3" placeholder="Ahmed Al-Rashidi" value={form.name} onChange={set('name')} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">Work Email</label>
                <input type="email" className="input-field py-3" placeholder="ahmed@yourcompany.com" value={form.email} onChange={set('email')} />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">Secure Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="input-field py-3 pr-12" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--text-muted)] hover:text-[var(--text-secondary)]">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div className="md:col-span-2">
                <label className="block text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">Organization Name</label>
                <input type="text" className="input-field py-3" placeholder="ADNOC, Aramco, Your Corp" value={form.companyName} onChange={set('companyName')} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">Region</label>
                <select className="input-field py-3" value={form.country} onChange={set('country')}>
                  {COUNTRIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-black text-[var(--text-muted)] uppercase tracking-wider mb-2">Sector</label>
                <select className="input-field py-3" value={form.industry} onChange={set('industry')}>
                  {INDUSTRIES.map(i => <option key={i} value={i}>{i}</option>)}
                </select>
              </div>
            </div>

            <div className="pt-2">
              <button className="btn-primary w-full h-12 justify-center shadow-md shadow-teal-500/20" onClick={handleSignup} disabled={loading}>
                {loading ? <span className="flex items-center gap-2 font-bold"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" /></svg>Provisioning...</span>
                  : <span className="flex items-center gap-2 font-bold uppercase tracking-wider">Initialize Workspace</span>}
              </button>
            </div>
          </div>
        </div>

        <div className="text-center mt-8">
          <p className="text-sm font-medium text-[var(--text-muted)]">
            Already have an account?{' '}
            <button onClick={onGoToLogin} className="text-teal-600 font-bold hover:underline decoration-2 underline-offset-4 ml-1">
              Sign In to Portal
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
