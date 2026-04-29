import { useEffect, useState } from 'react'
import { motion } from 'framer-motion'
import { Eye, EyeOff, Zap, AlertCircle, ArrowRight, ScanFace } from 'lucide-react'
import { authApi } from '../lib/api'
import type { User } from '../types'
import FaceAuth from '../components/auth/FaceAuth'

interface Props {
  onSuccess:    (user: User, token: string) => void
  onGoToSignup: () => void
}

export default function LoginPage({ onSuccess, onGoToSignup }: Props) {
  const [email,        setEmail]        = useState('')
  const [password,     setPassword]     = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading,      setLoading]      = useState(false)
  const [error,        setError]        = useState('')
  const [isFaceLogin,  setIsFaceLogin]  = useState(false)
  const [bootstrapMode, setBootstrapMode] = useState(false)

  useEffect(() => {
    authApi.bootstrapStatus().then(r => setBootstrapMode(r.needsBootstrap)).catch(() => setBootstrapMode(false))
  }, [])

  const handleFaceLogin = async (descriptor: Float32Array) => {
    setLoading(true)
    try {
      const { accessToken, user } = await authApi.faceLogin(descriptor)
      onSuccess(user, accessToken)
    } catch (err: any) {
      setError(err.message || 'Face login failed.')
      setIsFaceLogin(false)
    } finally {
      setLoading(false)
    }
  }

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) { setError('Please enter your email and password.'); return }
    setError(''); setLoading(true)
    try {
      const { accessToken, user } = await authApi.login(email.trim(), password)
      onSuccess(user, accessToken)
    } catch (err: any) {
      setError(err.message || 'Login failed. Check your credentials.')
    } finally { setLoading(false) }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: 'var(--bg-base)' }}>
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: '#14b8a6' }}>
            <Zap className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>GCC360 CRM</h1>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Enterprise CRM Platform</p>
          </div>
        </div>
        <div className="panel p-8">
          <h2 className="text-2xl font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Welcome back</h2>
          <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>Sign in to continue</p>
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)' }}>
              <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
          
          {isFaceLogin ? (
            <div className="mb-6">
              <FaceAuth onFaceDetected={handleFaceLogin} onCancel={() => setIsFaceLogin(false)} />
            </div>
          ) : (
            <>
              <div className="mb-4">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Email</label>
            <input type="email" className="input-field" placeholder="you@company.com" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="email" />
          </div>
          <div className="mb-6">
            <label className="block text-sm font-medium mb-1.5" style={{ color: 'var(--text-secondary)' }}>Password</label>
            <div className="relative">
              <input type={showPassword ? 'text' : 'password'} className="input-field pr-10" placeholder="••••••••" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === 'Enter' && handleLogin()} autoComplete="current-password" />
              <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }}>
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <button className="btn-primary w-full justify-center mb-4" onClick={handleLogin} disabled={loading}>
            {loading ? <span className="flex items-center gap-2"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" /></svg>Signing in...</span>
              : <span className="flex items-center gap-2">Sign In <ArrowRight className="w-4 h-4" /></span>}
          </button>
          
          <button type="button" onClick={() => setIsFaceLogin(true)} className="w-full flex items-center justify-center gap-2 py-2.5 mb-4 rounded-lg font-medium transition-colors" style={{ backgroundColor: 'var(--bg-elevated)', color: 'var(--text-primary)', border: '1px solid var(--border)' }}>
            <ScanFace className="w-4 h-4" /> Sign In with Face ID
          </button>
          
          </>
          )}
        </div>
        <p className="text-center text-sm mt-4" style={{ color: 'var(--text-muted)' }}>
          {bootstrapMode ? 'Need a company account?' : 'New company?'}{' '}
          <button onClick={onGoToSignup} style={{ color: 'var(--accent)' }} className="font-semibold hover:underline">
            {bootstrapMode ? 'Create the first company admin' : 'Create a company account'}
          </button>
        </p>
      </motion.div>
    </div>
  )
}
