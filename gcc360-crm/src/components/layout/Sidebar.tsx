import { motion, AnimatePresence } from 'framer-motion'
import {
  Settings, LayoutDashboard, TrendingUp, UserPlus, Building2, Users, Target,
  Handshake, CheckSquare, Activity, BrainCircuit, BarChart3,
  UserCog, ChevronLeft, ChevronRight, DollarSign, Zap
} from 'lucide-react'
import { useLanguage } from '../../context/LanguageContext'
import type { PageKey } from './AppShell'
import type { UserRole } from '../../types'

interface Props {
  currentPage: PageKey
  onNavigate: (page: PageKey) => void
  collapsed: boolean
  onToggleCollapse: () => void
  userRole: UserRole
}

interface NavItem {
  key: PageKey
  label: string
  icon: React.ComponentType<{ className?: string }>
  roles: UserRole[] | 'all'
}

const navItems: NavItem[] = [
  { key: 'dashboard',     label: 'Dashboard',     icon: LayoutDashboard, roles: 'all' },
  { key: 'pipeline',      label: 'Pipeline',       icon: TrendingUp,      roles: 'all' },
  { key: 'leads',         label: 'Leads',          icon: UserPlus,        roles: ['admin', 'manager', 'sales'] },
  { key: 'clients',       label: 'Clients',        icon: Building2,       roles: 'all' },
  { key: 'contacts',      label: 'Contacts',       icon: Users,           roles: 'all' },
  { key: 'opportunities', label: 'Opportunities',  icon: Target,          roles: ['admin', 'manager', 'sales'] },
  { key: 'deals',         label: 'Deals',          icon: Handshake,       roles: ['admin', 'manager', 'sales', 'finance'] },
  { key: 'tasks',         label: 'Tasks',          icon: CheckSquare,     roles: ['admin', 'manager', 'sales'] },
  { key: 'activities',    label: 'Activities',     icon: Activity,        roles: 'all' },
  { key: 'analytics',     label: 'Analytics',      icon: BarChart3,       roles: ['admin', 'manager'] },
  { key: 'finance',       label: 'Finance',        icon: DollarSign,      roles: ['admin', 'finance', 'manager'] },
  { key: 'users',         label: 'Users',          icon: UserCog,         roles: ['admin'] },
  { key: 'settings',      label: 'Settings',       icon: Settings,        roles: 'all' },
]

const ROLE_ACCENT: Record<string, { color: string; bg: string; border: string }> = {
  admin:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  ADMIN:         { color: '#f59e0b', bg: 'rgba(245,158,11,0.1)',  border: 'rgba(245,158,11,0.25)' },
  manager:       { color: '#14b8a6', bg: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.25)' },
  MANAGER:       { color: '#14b8a6', bg: 'rgba(20,184,166,0.1)',  border: 'rgba(20,184,166,0.25)' },
  sales:         { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  SALES:         { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  SALESPERSON:   { color: '#3b82f6', bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.25)' },
  finance:       { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
  FINANCE:       { color: '#10b981', bg: 'rgba(16,185,129,0.1)',  border: 'rgba(16,185,129,0.25)' },
}

export default function Sidebar({ currentPage, onNavigate, collapsed, onToggleCollapse, userRole }: Props) {
  const { t, language } = useLanguage()
  const visible = navItems.filter(item =>
    item.roles === 'all' || (item.roles as string[]).includes(userRole)
  )
  const accent = ROLE_ACCENT[userRole] || ROLE_ACCENT.sales

  return (
    <motion.aside
      animate={{ width: collapsed ? 56 : 216 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="flex-shrink-0 flex flex-col overflow-hidden"
      style={{ 
        backgroundColor: 'var(--bg-surface)', 
        borderRight: language === 'ar' ? 'none' : '1px solid var(--border)',
        borderLeft: language === 'ar' ? '1px solid var(--border)' : 'none'
      }}
    >
      {/* Logo */}
      <div className="h-14 flex items-center px-3.5 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0" style={{ backgroundColor: accent.color }}>
          <Zap className="w-3.5 h-3.5 text-white" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -8 }}
              transition={{ duration: 0.15 }}
              className="ml-2.5 overflow-hidden"
            >
              <p className="text-sm font-bold whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>GCC360 CRM</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-3 px-2 space-y-0.5 overflow-y-auto overflow-x-hidden">
        {visible.map(({ key, label, icon: Icon }) => {
          const isActive = currentPage === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              title={collapsed ? t(key as any) : undefined}
              className={`sidebar-item ${collapsed ? 'justify-center' : ''}`}
              style={isActive ? {
                color: accent.color,
                backgroundColor: accent.bg,
                borderColor: accent.border,
                fontWeight: 600,
              } : {}}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              <AnimatePresence>
                {!collapsed && (
                  <motion.span
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.1 }}
                    className="text-sm whitespace-nowrap overflow-hidden"
                  >
                    {t(key as any)}
                  </motion.span>
                )}
              </AnimatePresence>
            </button>
          )
        })}
      </nav>

      {/* Collapse */}
      <div className="p-2" style={{ borderTop: '1px solid var(--border)' }}>
        <button
          onClick={onToggleCollapse}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className={`sidebar-item ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed
            ? <ChevronRight className="w-4 h-4 flex-shrink-0" />
            : (
              <>
                <ChevronLeft className="w-4 h-4 flex-shrink-0" />
                <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="text-sm">Collapse</motion.span>
              </>
            )
          }
        </button>
      </div>
    </motion.aside>
  )
}