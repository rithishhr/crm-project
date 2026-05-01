import { useState, useEffect } from 'react'
import type { User } from './types'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import PasswordChangePage from './pages/PasswordChangePage'
import FaceIDModal from './components/ui/FaceIDModal'
import AppShell from './components/layout/AppShell'
import { setToken, clearToken, authApi, profileApi } from './lib/api'

type AppState = 'login' | 'signup' | 'face_id' | 'password_change' | 'app' | 'loading'

export default function App() {
  const [appState,    setAppState]    = useState<AppState>('loading')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

  // Initialization: check if we have a valid session via refresh token
  useEffect(() => {
    const init = async () => {
      try {
        // profileApi.get() will trigger auto-refresh logic in req() if needed
        const user = await profileApi.get()
        setCurrentUser(user)
        setAppState('app')
      } catch (err) {
        // If profile fetch fails, user needs to login
        setAppState('login')
      }
    }
    init()
  }, [])

  const handleLoginSuccess = (user: User, accessToken: string) => {
    setToken(accessToken)
    ;(window as any).__gcc360_token = accessToken
    setCurrentUser(user)
    
    // If the user needs a password change, prioritize that (except for Admins)
    if (user.isFirstLogin && user.role !== 'admin') {
      setAppState('password_change')
      return
    }

    // Only challenge with Face ID if the user has it enabled
    if (user.biometricEnabled) {
      setAppState('face_id')
    } else {
      setAppState('app')
    }
  }

  const handleFaceIDSuccess = async (descriptor?: Float32Array) => {
    if (!descriptor || !currentUser) {
      throw new Error('Missing biometric data')
    }

    // Perform server-side authenticate with biometric descriptor
    const res = await (await import('./lib/api')).biometricApi.authenticate(currentUser.id, descriptor)
    if (!res || !res.token) {
      throw new Error('Face authentication failed')
    }

    setToken(res.token)
    ;(window as any).__gcc360_token = res.token
    setAppState('app')
  }
  const handleFaceIDClose = () => {
    clearToken()
    setCurrentUser(null)
    setAppState('login')
  }

  const handleLogout = async () => {
    await authApi.logout().catch(() => {})
    clearToken()
    setCurrentUser(null)
    setAppState('login')
  }

  if (appState === 'loading') {
    return (
      <div className="min-h-screen bg-[#0a0a0b] flex items-center justify-center">
        <div className="relative w-16 h-16">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full"></div>
          <div className="absolute inset-0 border-4 border-t-emerald-500 rounded-full animate-spin"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      {appState === 'login'   && (
        <LoginPage
          onSuccess={handleLoginSuccess}
          onGoToSignup={() => setAppState('signup')}
        />
      )}
      {appState === 'signup'  && (
        <SignupPage
          onSuccess={handleLoginSuccess}
          onGoToLogin={() => setAppState('login')}
        />
      )}
      {appState === 'face_id' && currentUser && (
        <FaceIDModal
          user={currentUser}
          onSuccess={handleFaceIDSuccess}
          onClose={handleFaceIDClose}
        />
      )}
      {appState === 'password_change' && currentUser && (
        <PasswordChangePage 
          email={currentUser.email} 
          onSuccess={() => handleLogout()} // Force re-login after password change
          onLogout={handleLogout}
        />
      )}
      {appState === 'app'     && currentUser && (
        <AppShell user={currentUser} onLogout={handleLogout} />
      )}
    </>
  )
}
