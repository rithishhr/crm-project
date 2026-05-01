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
      <div className="h-16 flex items-center px-4 flex-shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
        <motion.div 
          whileHover={{ scale: 1.15, rotate: 12 }}
          className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-teal-500/30" 
          style={{ background: 'linear-gradient(135deg, var(--accent), var(--accent-hover))' }}
        >
          <Zap className="w-4 h-4 text-white" />
        </motion.div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -10 }}
              className="ml-3 overflow-hidden"
            >
              <p className="text-sm font-black tracking-tight whitespace-nowrap" style={{ color: 'var(--text-primary)' }}>GCC360 CRM</p>
              <div className="h-1 w-8 bg-teal-500/50 rounded-full mt-0.5" />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Nav */}
      <nav className="flex-1 py-4 px-3 flex flex-col gap-1 overflow-y-auto overflow-x-hidden">
        {visible.map(({ key, label, icon: Icon }) => {
          const isActive = currentPage === key
          return (
            <button
              key={key}
              onClick={() => onNavigate(key)}
              title={collapsed ? t(key as any) : undefined}
              className={`
                flex items-center gap-3 w-full px-3 py-2.5 rounded-xl transition-all duration-200
                ${isActive 
                  ? 'bg-teal-500 text-white font-bold shadow-lg shadow-teal-500/20' 
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}
                ${collapsed ? 'justify-center' : ''}
              `}
            >
              <Icon className={`w-5 h-5 flex-shrink-0 ${isActive ? 'text-white' : ''}`} />
              {!collapsed && (
                <span className="text-sm font-medium truncate">
                  {t(key as any)}
                </span>
              )}
            </button>
          )
        })}
      </nav>

      {/* Collapse */}
      <div className="p-3 border-t border-slate-100">
        <button
          onClick={onToggleCollapse}
          className={`flex items-center gap-3 w-full px-3 py-2.5 rounded-xl text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-all ${collapsed ? 'justify-center' : ''}`}
        >
          {collapsed
            ? <ChevronRight className="w-5 h-5 flex-shrink-0" />
            : (
              <>
                <ChevronLeft className="w-5 h-5 flex-shrink-0" />
                <span className="text-sm font-medium">Collapse Menu</span>
              </>
            )
          }
        </button>
      </div>
    </motion.aside>
  )
}