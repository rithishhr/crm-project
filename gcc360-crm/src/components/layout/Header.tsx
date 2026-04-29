import { useState, useEffect, useRef } from 'react'
import { Search, Bell, BrainCircuit, ChevronDown, LogOut, Settings, Sun, Moon,
  Building2, ShieldCheck, Check, Trash2, X, CheckCheck } from 'lucide-react'
import type { User, UserRole } from '../../types'
import type { GlobalSearchResult, PageKey } from './AppShell'
import { useTheme } from '../../context/ThemeContext'
import { useLanguage } from '../../context/LanguageContext'
import { notificationsApi } from '../../lib/api'
import { Language } from '../../locales/translations'

const pageTitles: Record<string, string> = {
  dashboard: 'Dashboard', pipeline: 'Pipeline', leads: 'Leads', clients: 'Clients',
  contacts: 'Contacts', opportunities: 'Opportunities', deals: 'Deals',
  tasks: 'Tasks', activities: 'Activities', ai_quotes: 'AI Quote Generator',
  analytics: 'Analytics', users: 'User Management', finance: 'Finance',
  settings: 'Account Settings',
}

const ROLE_META: Record<string, { label: string; color: string; bg: string; border: string; avatarBg: string }> = {
  admin:         { label: 'Administrator', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  avatarBg: '#d97706' },
  ADMIN:         { label: 'Administrator', color: '#f59e0b', bg: 'rgba(245,158,11,0.12)',  border: 'rgba(245,158,11,0.3)',  avatarBg: '#d97706' },
  manager:       { label: 'Manager',       color: '#14b8a6', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  avatarBg: '#0d9488' },
  MANAGER:       { label: 'Manager',       color: '#14b8a6', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  avatarBg: '#0d9488' },
  SALES_MANAGER: { label: 'Sales Manager', color: '#14b8a6', bg: 'rgba(20,184,166,0.12)',  border: 'rgba(20,184,166,0.3)',  avatarBg: '#0d9488' },
  sales:         { label: 'Sales',         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  avatarBg: '#2563eb' },
  SALES:         { label: 'Sales',         color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  avatarBg: '#2563eb' },
  SALESPERSON:   { label: 'Salesperson',   color: '#3b82f6', bg: 'rgba(59,130,246,0.12)',  border: 'rgba(59,130,246,0.3)',  avatarBg: '#2563eb' },
  finance:       { label: 'Finance',       color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  avatarBg: '#059669' },
  FINANCE:       { label: 'Finance',       color: '#10b981', bg: 'rgba(16,185,129,0.12)',  border: 'rgba(16,185,129,0.3)',  avatarBg: '#059669' },
  analyst:       { label: 'Analyst',       color: '#a78bfa', bg: 'rgba(167,139,250,0.12)', border: 'rgba(167,139,250,0.3)', avatarBg: '#7c3aed' },
}

const NOTIF_ICONS: Record<string, string> = {
  LEAD:     '🎯',
  DEAL:     '💰',
  TASK:     '✅',
  EMAIL:    '📧',
  SYSTEM:   '🔔',
  INVOICE:  '🧾',
  FRAUD:    '⚠️',
}

interface Props {
  user:        User
  onOpenAI:    () => void
  onLogout:    () => void
  currentPage: PageKey
  onNavigate:  (page: PageKey | 'settings') => void
  searchQuery: string
  onSearchChange: (value: string) => void
  searchResults: GlobalSearchResult[]
  searchLoading: boolean
  onSearchSelect: (result: GlobalSearchResult) => void
}

export default function Header({
  user,
  onOpenAI,
  onLogout,
  currentPage,
  onNavigate,
  searchQuery,
  onSearchChange,
  searchResults,
  searchLoading,
  onSearchSelect,
}: Props) {
  const [userMenuOpen,  setUserMenuOpen]  = useState(false)
  const [notifOpen,     setNotifOpen]     = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount,   setUnreadCount]   = useState(0)
  const { theme, toggleTheme } = useTheme()
  const { language, setLanguage, t } = useLanguage()
  const role = ROLE_META[user.role] || ROLE_META.analyst
  const notifRef = useRef<HTMLDivElement>(null)
  const backendUrl = import.meta.env.VITE_API_URL || 'http://localhost:4000'

  const translatedTitle = t(currentPage as any) || pageTitles[currentPage] || 'GCC360'

  // Load notifications
  useEffect(() => {
    const load = () => {
      notificationsApi.list().then(setNotifications).catch(() => {})
      notificationsApi.unreadCount().then(r => setUnreadCount(r.count)).catch(() => {})
    }
    load()
    const interval = setInterval(load, 30000) // Refresh every 30s
    return () => clearInterval(interval)
  }, [])

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {})
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setNotifications(prev => prev.map(n => ({ ...n, read: true })))
    setUnreadCount(0)
  }

  const deleteNotif = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation()
    await notificationsApi.delete(id).catch(() => {})
    const was = notifications.find(n => n.id === id)
    setNotifications(prev => prev.filter(n => n.id !== id))
    if (was && !was.read) setUnreadCount(prev => Math.max(0, prev - 1))
  }

  const clearAll = async () => {
    await notificationsApi.deleteAll().catch(() => {})
    setNotifications([])
    setUnreadCount(0)
  }

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime()
    const mins = Math.floor(diff / 60000)
    if (mins < 1)  return 'just now'
    if (mins < 60) return `${mins}m ago`
    const hours = Math.floor(mins / 60)
    if (hours < 24) return `${hours}h ago`
    return `${Math.floor(hours / 24)}d ago`
  }

  return (
    <header className="h-14 flex items-center px-5 gap-4 flex-shrink-0 z-10"
      style={{ backgroundColor: 'var(--bg-surface)', borderBottom: '1px solid var(--border)' }}>
      {/* Page title */}
      <div className="hidden sm:block flex-shrink-0">
        <h1 className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
          {translatedTitle}
        </h1>
      </div>

      {/* Search */}
      <div className="relative flex-1 max-w-sm">
        <div className="relative">
          <Search className={`${language === 'ar' ? 'right-3' : 'left-3'} absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5`} style={{ color: 'var(--text-placeholder)' }} />
          <input
            type="text"
            value={searchQuery}
            placeholder={t('search')}
            className={`w-full rounded-lg ${language === 'ar' ? 'pr-9 pl-4' : 'pl-9 pr-4'} py-1.5 text-xs outline-none`}
            style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}
            autoComplete="off"
            onChange={e => onSearchChange(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                onSearchChange('')
              }
              if (e.key === 'Enter' && searchResults.length > 0) {
                e.preventDefault()
                onSearchSelect(searchResults[0])
              }
            }}
            onFocus={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.boxShadow = '0 0 0 3px var(--accent-muted)' }}
            onBlur={e  => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.boxShadow = 'none' }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => onSearchChange('')}
              className={`${language === 'ar' ? 'left-2' : 'right-2'} absolute top-1/2 -translate-y-1/2 w-5 h-5 rounded-full flex items-center justify-center transition-colors`}
              style={{ color: 'var(--text-muted)' }}
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
        {searchQuery.trim().length >= 2 && (
          <div className="absolute top-full mt-2 w-full rounded-2xl shadow-2xl z-50 overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <div className="px-4 py-2 flex items-center justify-between text-xs" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text-muted)' }}>
              <span>{searchLoading ? 'Searching...' : `${searchResults.length} result${searchResults.length === 1 ? '' : 's'}`}</span>
              <span>Press Enter to open the first match</span>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {searchResults.length === 0 ? (
                <div className="px-4 py-6 text-sm text-center" style={{ color: 'var(--text-muted)' }}>
                  No matches for “{searchQuery}”
                </div>
              ) : searchResults.map(result => (
                <button
                  key={`${result.page}-${result.id}`}
                  type="button"
                  onMouseDown={e => e.preventDefault()}
                  onClick={() => onSearchSelect(result)}
                  className="w-full text-left px-4 py-3 flex items-start gap-3 transition-colors hover:bg-[var(--bg-elevated)]"
                >
                  <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: 'var(--accent-muted)', color: 'var(--accent)' }}>
                    <Search className="w-3.5 h-3.5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>{result.title}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--text-muted)' }}>{result.kind} · {result.subtitle}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className={`flex items-center gap-2 ${language === 'ar' ? 'mr-auto' : 'ml-auto'}`}>
        {/* Language Toggle */}
        <button 
          onClick={() => setLanguage(language === 'en' ? 'ar' : 'en')}
          className="px-2.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          <span className="opacity-60">{language === 'en' ? 'AR' : 'EN'}</span>
          <span>{language === 'en' ? 'العربية' : 'English'}</span>
        </button>

        {/* AI Assistant */}
        <button onClick={onOpenAI}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
          style={{ backgroundColor: 'var(--accent-muted)', border: '1px solid var(--accent-border)', color: 'var(--accent)' }}>
          <BrainCircuit className="w-3.5 h-3.5" />
          <span className="hidden sm:block">AI Assistant</span>
        </button>

        {/* Theme */}
        <button onClick={toggleTheme} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
          className="w-8 h-8 flex items-center justify-center rounded-lg transition-all"
          style={{ backgroundColor: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>
          {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
        </button>

        {/* ── Notifications Bell ────────────────────────────────────────────── */}
        <div className="relative" ref={notifRef}>
          <button onClick={() => setNotifOpen(!notifOpen)}
            className="relative w-8 h-8 flex items-center justify-center rounded-lg transition-all"
            style={{ backgroundColor: notifOpen ? 'var(--accent-muted)' : 'var(--bg-elevated)', border: `1px solid ${notifOpen ? 'var(--accent-border)' : 'var(--border)'}`, color: notifOpen ? 'var(--accent)' : 'var(--text-secondary)' }}>
            <Bell className="w-4 h-4" />
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 text-xs font-bold rounded-full flex items-center justify-center text-white"
                style={{ backgroundColor: '#ef4444' }}>
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </button>

          {notifOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setNotifOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-80 rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                  <div className="flex items-center gap-2">
                    <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Notifications</p>
                    {unreadCount > 0 && (
                      <span className="text-xs px-1.5 py-0.5 rounded-full font-bold" style={{ backgroundColor: '#ef444420', color: '#ef4444' }}>
                        {unreadCount} new
                      </span>
                    )}
                  </div>
                  <div className="flex gap-1">
                    {unreadCount > 0 && (
                      <button onClick={markAllRead} title="Mark all read"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-green-500/10"
                        style={{ color: 'var(--text-muted)' }}>
                        <CheckCheck className="w-3.5 h-3.5" />
                      </button>
                    )}
                    {notifications.length > 0 && (
                      <button onClick={clearAll} title="Clear all"
                        className="w-7 h-7 rounded-lg flex items-center justify-center transition-colors hover:bg-red-500/10"
                        style={{ color: 'var(--text-muted)' }}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>

                {/* List */}
                <div className="max-h-80 overflow-y-auto">
                  {notifications.length === 0 ? (
                    <div className="py-10 text-center">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-20" style={{ color: 'var(--text-muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No notifications</p>
                    </div>
                  ) : notifications.map(n => (
                    <div key={n.id} onClick={() => markRead(n.id)}
                      className="relative flex items-start gap-3 px-4 py-3 cursor-pointer transition-colors"
                      style={{ backgroundColor: n.read ? 'transparent' : 'var(--accent-muted)', borderBottom: '1px solid var(--border-subtle)' }}>
                      <span className="text-lg flex-shrink-0 mt-0.5">{NOTIF_ICONS[n.type] || '🔔'}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>{n.title}</p>
                        <p className="text-xs mt-0.5 line-clamp-2" style={{ color: 'var(--text-muted)' }}>{n.message}</p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-placeholder)' }}>{timeAgo(n.createdAt)}</p>
                      </div>
                      {!n.read && (
                        <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5" style={{ backgroundColor: 'var(--accent)' }} />
                      )}
                      <button onClick={e => deleteNotif(n.id, e)}
                        className="absolute top-2 right-2 w-6 h-6 rounded flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-500/10 transition-all"
                        style={{ color: 'var(--text-muted)' }}>
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {/* ── User Pill ─────────────────────────────────────────────────────── */}
        <div className="relative">
          <button onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-2 pl-1 pr-2.5 py-1 rounded-xl transition-all"
            style={{ border: `1px solid ${role.border}`, backgroundColor: role.bg }}>
            {/* Avatar */}
            {(user as any).avatarUrl ? (
              <img src={`${(user as any).avatarUrl}`.startsWith('/uploads') ? `${backendUrl}${(user as any).avatarUrl}` : (user as any).avatarUrl}
                alt="avatar" className="w-7 h-7 rounded-lg object-cover" />
            ) : (
              <div className="w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ backgroundColor: role.avatarBg }}>
                {user.avatar || user.name?.charAt(0)}
              </div>
            )}
            <div className="hidden sm:block text-left">
              <p className="text-xs font-bold leading-tight" style={{ color: role.color }}>{user.name.split(' ')[0]}</p>
              <p className="text-xs leading-tight font-semibold" style={{ color: role.color, opacity: 0.75 }}>{role.label}</p>
            </div>
            <ChevronDown className="w-3 h-3 hidden sm:block" style={{ color: role.color, opacity: 0.6 }} />
          </button>

          {userMenuOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setUserMenuOpen(false)} />
              <div className="absolute right-0 top-full mt-2 w-64 rounded-2xl shadow-2xl z-50 overflow-hidden"
                style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${role.border}` }}>
                {/* Profile header */}
                <div className="p-4" style={{ borderBottom: '1px solid var(--border)', background: role.bg }}>
                  <div className="flex items-center gap-3 mb-3">
                    {(user as any).avatarUrl ? (
                      <img src={`${(user as any).avatarUrl}`.startsWith('/uploads') ? `${backendUrl}${(user as any).avatarUrl}` : (user as any).avatarUrl}
                        alt="avatar" className="w-10 h-10 rounded-xl object-cover" />
                    ) : (
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                        style={{ backgroundColor: role.avatarBg }}>
                        {user.avatar || user.name?.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{user.name}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2 rounded-xl" style={{ backgroundColor: 'var(--bg-card)', border: `1px solid ${role.border}` }}>
                    <ShieldCheck className="w-3.5 h-3.5 flex-shrink-0" style={{ color: role.color }} />
                    <p className="text-xs font-bold" style={{ color: role.color }}>{role.label}</p>
                    <span className="ml-auto text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ backgroundColor: role.bg, color: role.color, border: `1px solid ${role.border}` }}>
                      {user.role.toLowerCase().includes('admin') ? 'Full Access' : user.role.toLowerCase().includes('analyst') ? 'Read-Only' : 'Standard'}
                    </span>
                  </div>
                </div>

                {/* Menu */}
                <div className="p-1.5">
                  <button onClick={() => { setUserMenuOpen(false); onNavigate('settings' as any) }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors"
                    style={{ color: 'var(--text-secondary)' }}
                    onMouseEnter={e => { e.currentTarget.style.backgroundColor = 'var(--bg-hover)' }}
                    onMouseLeave={e => { e.currentTarget.style.backgroundColor = 'transparent' }}>
                    <Settings className="w-4 h-4" style={{ color: 'var(--text-muted)' }} />
                    Account Settings
                  </button>
                  <button onClick={() => { setUserMenuOpen(false); onLogout() }}
                    className="w-full flex items-center gap-2.5 px-3 py-2.5 text-sm rounded-xl transition-colors"
                    style={{ color: '#ef4444' }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = 'rgba(239,68,68,0.08)'}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = 'transparent'}>
                    <LogOut className="w-4 h-4" />
                    Sign Out
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </header>
  )
}
