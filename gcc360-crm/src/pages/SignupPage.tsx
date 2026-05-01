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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Official Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-slate-200 shadow-sm mb-4">
            <Zap className="w-7 h-7 text-teal-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">GCC360 <span className="text-teal-600">CRM</span></h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">New Organization Enrollment</p>
        </div>

        {/* Signup Card */}
        <div className="official-card bg-white p-10">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900">Get Started</h2>
            <p className="text-sm text-slate-500 mt-1">
              {bootstrapMode ? 'Initialize the global administrator account.' : "Register your organization to access the platform."}
            </p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}

          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Full Name</label>
                <input type="text" className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all" placeholder="Ahmed Al-Rashidi" value={form.name} onChange={set('name')} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Work Email</label>
                <input type="email" className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all" placeholder="ahmed@yourcompany.com" value={form.email} onChange={set('email')} />
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Secure Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all pr-12" placeholder="Min. 6 characters" value={form.password} onChange={set('password')} />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Organization Name</label>
                <input type="text" className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all" placeholder="ADNOC, Aramco, Your Corp" value={form.companyName} onChange={set('companyName')} />
                <div className="mt-2 text-[10px] font-bold" style={{ color: companyHint ? '#f59e0b' : '#94a3b8' }}>
                  {checkingCompany ? 'Verifying availability...' : companyHint || 'Must be a registered legal entity name.'}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Region</label>
                  <select className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all" value={form.country} onChange={set('country')}>
                    {COUNTRIES.map(c => <option key={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Sector</label>
                  <select className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all" value={form.industry} onChange={set('industry')}>
                    {INDUSTRIES.map(i => <option key={i}>{i}</option>)}
                  </select>
                </div>
              </div>
            </div>

            <button className="btn-primary w-full h-12 justify-center mt-6 shadow-md shadow-teal-500/20" onClick={handleSignup} disabled={loading}>
              {loading ? <span className="flex items-center gap-2 font-bold"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" /></svg>Registering...</span>
                : <span className="flex items-center gap-2 font-bold uppercase tracking-wider text-sm">Create Organization Account</span>}
            </button>
          </div>
        </div>

        {/* Footer Link */}
        <div className="text-center mt-8">
          <button onClick={onGoToLogin} className="flex items-center gap-2 mx-auto text-sm font-bold text-teal-600 hover:underline decoration-2 underline-offset-4">
            <ArrowLeft className="w-4 h-4" /> Back to Secure Sign In
          </button>
        </div>
      </div>
    </div>
  )
}
