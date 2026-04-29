import { useState } from 'react'
import type { User } from './types'
import LoginPage from './pages/LoginPage'
import SignupPage from './pages/SignupPage'
import PasswordChangePage from './pages/PasswordChangePage'
import FaceIDModal from './components/ui/FaceIDModal'
import AppShell from './components/layout/AppShell'
import { setToken, clearToken, authApi } from './lib/api'

type AppState = 'login' | 'signup' | 'face_id' | 'password_change' | 'app'

export default function App() {
  const [appState,    setAppState]    = useState<AppState>('login')
  const [currentUser, setCurrentUser] = useState<User | null>(null)

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
