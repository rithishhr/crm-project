import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Bell, BellOff, Check, CheckCheck, Trash2, UserPlus, TrendingUp, Mail, AlertCircle, Star, X } from 'lucide-react'
import { notificationsApi } from '../../lib/api'

const TYPE_CONFIG: Record<string, { icon: any; color: string; bg: string }> = {
  LEAD_ASSIGNED:   { icon: UserPlus,     color: '#3b82f6', bg: 'rgba(59,130,246,0.12)'  },
  LEAD_CREATED:    { icon: TrendingUp,   color: '#14b8a6', bg: 'rgba(20,184,166,0.12)'  },
  EMAIL_LEAD:      { icon: Mail,         color: '#f59e0b', bg: 'rgba(245,158,11,0.12)'  },
  FRAUD_DETECTED:  { icon: AlertCircle,  color: '#ef4444', bg: 'rgba(239,68,68,0.12)'   },
  DEAL_WON:        { icon: Star,         color: '#10b981', bg: 'rgba(16,185,129,0.12)'  },
  DEFAULT:         { icon: Bell,         color: '#a78bfa', bg: 'rgba(167,139,250,0.12)' },
}

function timeAgo(date: string) {
  const diff = Date.now() - new Date(date).getTime()
  const mins  = Math.floor(diff / 60000)
  const hours = Math.floor(diff / 3600000)
  const days  = Math.floor(diff / 86400000)
  if (mins < 1)   return 'Just now'
  if (mins < 60)  return `${mins}m ago`
  if (hours < 24) return `${hours}h ago`
  return `${days}d ago`
}

interface Props {
  onNavigate: (page: string) => void
}

export default function NotificationsPanel({ onNavigate }: Props) {
  const [open,     setOpen]     = useState(false)
  const [notifs,   setNotifs]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(false)
  const [count,    setCount]    = useState(0)
  const panelRef = useRef<HTMLDivElement>(null)

  // Poll unread count every 30 seconds
  useEffect(() => {
    const fetchCount = () => {
      notificationsApi.unreadCount()
        .then(r => setCount(r.count))
        .catch(() => {})
    }
    fetchCount()
    const interval = setInterval(fetchCount, 30000)
    return () => clearInterval(interval)
  }, [])

  // Load full list when opened
  useEffect(() => {
    if (!open) return
    setLoading(true)
    notificationsApi.list()
      .then(setNotifs)
      .finally(() => setLoading(false))
  }, [open])

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    if (open) document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  const markRead = async (id: string) => {
    await notificationsApi.markRead(id).catch(() => {})
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, read: true } : n))
    setCount(prev => Math.max(0, prev - 1))
  }

  const markAllRead = async () => {
    await notificationsApi.markAllRead().catch(() => {})
    setNotifs(prev => prev.map(n => ({ ...n, read: true })))
    setCount(0)
  }

  const deleteNotif = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation()
    await notificationsApi.delete(id).catch(() => {})
    const was = notifs.find(n => n.id === id)
    setNotifs(prev => prev.filter(n => n.id !== id))
    if (was && !was.read) setCount(prev => Math.max(0, prev - 1))
  }

  const clearAll = async () => {
    await notificationsApi.deleteAll().catch(() => {})
    setNotifs([])
    setCount(0)
  }

  const handleClick = (notif: any) => {
    if (!notif.read) markRead(notif.id)
    if (notif.link) onNavigate(notif.link)
    setOpen(false)
  }

  return (
    <div className="relative" ref={panelRef}>
      {/* Bell button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-xl flex items-center justify-center transition-all"
        style={{
          background: open ? 'var(--accent-muted)' : 'var(--bg-elevated)',
          border: `1px solid ${open ? 'var(--accent-border)' : 'var(--border)'}`,
          color: open ? 'var(--accent)' : 'var(--text-muted)',
        }}
        title="Notifications"
      >
        <Bell className="w-4 h-4" />
        {count > 0 && (
          <motion.span
            initial={{ scale: 0 }} animate={{ scale: 1 }}
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full flex items-center justify-center text-white font-bold"
            style={{ backgroundColor: '#ef4444', fontSize: '9px' }}
          >
            {count > 9 ? '9+' : count}
          </motion.span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0,  scale: 1    }}
            exit={  { opacity: 0, y: -8, scale: 0.96 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-12 w-96 max-h-[520px] flex flex-col rounded-2xl z-50 overflow-hidden"
            style={{
              backgroundColor: 'var(--bg-card)',
              border: '1px solid var(--border)',
              boxShadow: '0 20px 60px rgba(0,0,0,0.4)',
            }}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
              <div className="flex items-center gap-2">
                <Bell className="w-4 h-4" style={{ color: 'var(--accent)' }} />
                <span className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>Notifications</span>
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-full font-bold"
                    style={{ background: 'rgba(239,68,68,0.15)', color: '#ef4444' }}>
                    {count} new
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1">
                {count > 0 && (
                  <button onClick={markAllRead}
                    className="text-xs flex items-center gap-1 px-2 py-1 rounded-lg"
                    style={{ color: 'var(--accent)', background: 'var(--accent-muted)' }}
                    title="Mark all read">
                    <CheckCheck className="w-3 h-3" />All read
                  </button>
                )}
                {notifs.length > 0 && (
                  <button onClick={clearAll}
                    className="w-7 h-7 flex items-center justify-center rounded-lg"
                    style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}
                    title="Clear all">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
                <button onClick={() => setOpen(false)}
                  className="w-7 h-7 flex items-center justify-center rounded-lg"
                  style={{ color: 'var(--text-muted)', background: 'var(--bg-hover)' }}>
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* List */}
            <div className="flex-1 overflow-y-auto">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--accent)' }} />
                </div>
              ) : notifs.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 gap-3">
                  <div className="w-12 h-12 rounded-2xl flex items-center justify-center"
                    style={{ background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
                    <BellOff className="w-5 h-5" style={{ color: 'var(--text-placeholder)' }} />
                  </div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>All caught up!</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No notifications yet</p>
                </div>
              ) : (
                notifs.map(notif => {
                  const cfg = TYPE_CONFIG[notif.type] || TYPE_CONFIG.DEFAULT
                  const Icon = cfg.icon
                  return (
                    <motion.div
                      key={notif.id}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      onClick={() => handleClick(notif)}
                      className="flex items-start gap-3 px-4 py-3 cursor-pointer group transition-colors"
                      style={{
                        borderBottom: '1px solid var(--border-subtle)',
                        background: notif.read ? 'transparent' : 'rgba(59,130,246,0.04)',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-hover)')}
                      onMouseLeave={e => (e.currentTarget.style.background = notif.read ? 'transparent' : 'rgba(59,130,246,0.04)')}
                    >
                      {/* Icon */}
                      <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{ background: cfg.bg }}>
                        <Icon className="w-3.5 h-3.5" style={{ color: cfg.color }} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className="text-xs font-bold leading-snug" style={{ color: 'var(--text-primary)' }}>
                            {notif.title}
                            {!notif.read && (
                              <span className="inline-block w-1.5 h-1.5 rounded-full ml-1.5 mb-0.5 align-middle"
                                style={{ background: '#3b82f6' }} />
                            )}
                          </p>
                          <button
                            onClick={e => deleteNotif(e, notif.id)}
                            className="w-5 h-5 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 flex-shrink-0 transition-opacity"
                            style={{ color: 'var(--text-muted)', background: 'var(--bg-elevated)' }}>
                            <X className="w-3 h-3" />
                          </button>
                        </div>
                        <p className="text-xs mt-0.5 leading-snug" style={{ color: 'var(--text-muted)' }}>
                          {notif.message}
                        </p>
                        <p className="text-xs mt-1" style={{ color: 'var(--text-placeholder)' }}>
                          {timeAgo(notif.createdAt)}
                        </p>
                      </div>

                      {/* Unread mark */}
                      {!notif.read && (
                        <button
                          onClick={e => { e.stopPropagation(); markRead(notif.id) }}
                          className="w-5 h-5 flex items-center justify-center rounded-full flex-shrink-0 mt-0.5"
                          style={{ background: 'rgba(59,130,246,0.15)', color: '#3b82f6' }}
                          title="Mark as read">
                          <Check className="w-3 h-3" />
                        </button>
                      )}
                    </motion.div>
                  )
                })
              )}
            </div>

            {/* Footer */}
            {notifs.length > 0 && (
              <div className="px-4 py-2.5 flex-shrink-0"
                style={{ borderTop: '1px solid var(--border)', background: 'var(--bg-elevated)' }}>
                <p className="text-xs text-center" style={{ color: 'var(--text-placeholder)' }}>
                  {notifs.length} notification{notifs.length !== 1 ? 's' : ''} · Notifications clear after 30 days
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
