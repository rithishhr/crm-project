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
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50">
      <div className="w-full max-w-md">
        {/* Official Header */}
        <div className="flex flex-col items-center mb-10 text-center">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center bg-white border border-slate-200 shadow-sm mb-4">
            <Zap className="w-7 h-7 text-teal-500" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 tracking-tight">GCC360 <span className="text-teal-600">CRM</span></h1>
          <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mt-1">Enterprise Sales Operations</p>
        </div>

        {/* Login Card */}
        <div className="official-card bg-white p-10">
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900">Account Sign In</h2>
            <p className="text-sm text-slate-500 mt-1">Enter your credentials to access the secure portal</p>
          </div>

          {error && (
            <div className="flex items-center gap-3 p-4 rounded-xl bg-red-50 border border-red-100 mb-6">
              <AlertCircle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm font-medium text-red-700">{error}</p>
            </div>
          )}
          
          {isFaceLogin ? (
            <div className="space-y-6">
              <div className="p-1 rounded-2xl border-2 border-dashed border-slate-200 bg-slate-50">
                <FaceAuth onFaceDetected={handleFaceLogin} onCancel={() => setIsFaceLogin(false)} />
              </div>
              <button onClick={() => setIsFaceLogin(false)} className="w-full text-sm font-bold text-slate-400 hover:text-slate-600 transition-colors">
                Back to Password Login
              </button>
            </div>
          ) : (
            <div className="space-y-5">
              <div>
                <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider mb-2">Work Email</label>
                <input 
                  type="email" 
                  className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all" 
                  placeholder="name@gcc360.com" 
                  value={email} 
                  onChange={e => setEmail(e.target.value)} 
                  onKeyDown={e => e.key === 'Enter' && handleLogin()} 
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-[11px] font-black text-slate-400 uppercase tracking-wider">Access Key</label>
                  <button className="text-[10px] font-bold text-teal-600 hover:underline uppercase tracking-tight">Forgot Key?</button>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? 'text' : 'password'} 
                    className="input-field py-3 bg-slate-50 border-slate-200 focus:bg-white transition-all pr-12" 
                    placeholder="••••••••" 
                    value={password} 
                    onChange={e => setPassword(e.target.value)} 
                    onKeyDown={e => e.key === 'Enter' && handleLogin()} 
                  />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              
              <div className="pt-2 space-y-3">
                <button className="btn-primary w-full h-12 justify-center shadow-md shadow-teal-500/20" onClick={handleLogin} disabled={loading}>
                  {loading ? <span className="flex items-center gap-2 font-bold"><svg className="animate-spin w-4 h-4" viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" strokeDasharray="31.4" strokeDashoffset="10" /></svg>Authenticating...</span>
                    : <span className="flex items-center gap-2 font-bold uppercase tracking-wider">Secure Sign In</span>}
                </button>
                
                <div className="relative py-2">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-slate-100"></div></div>
                  <div className="relative flex justify-center text-[10px] font-black uppercase tracking-widest"><span className="bg-white px-4 text-slate-300">Identity Verification</span></div>
                </div>

                <button type="button" onClick={() => setIsFaceLogin(true)} className="w-full h-12 flex items-center justify-center gap-3 rounded-xl font-bold text-sm bg-slate-900 text-white hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/10">
                  <ScanFace className="w-5 h-5" /> Sign In with Face ID
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Link */}
        <div className="text-center mt-8">
          <p className="text-sm font-medium text-slate-500">
            {bootstrapMode ? 'System requires initialization.' : 'Authorized personnel only.'}{' '}
            <button onClick={onGoToSignup} className="text-teal-600 font-bold hover:underline decoration-2 underline-offset-4 ml-1">
              {bootstrapMode ? 'Create Global Admin' : 'Register New Organization'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
  )
}
