import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { User, UserRole } from '../../types'
// ... rest of imports
import Sidebar from './Sidebar'
import Header from './Header'
import AIAssistantPanel from '../ui/AIAssistantPanel'
import AIChatbot from '../ui/AIChatbot'
import ToastContainer from '../ui/Toast'
import type { Toast } from '../ui/Toast'
import { clientsApi, contactsApi, leadsApi } from '../../lib/api'

import DashboardPage      from '../../pages/DashboardPage'
import LeadsPage          from '../../pages/LeadsPage'
import PipelinePage       from '../../pages/PipelinePage'
import ClientsPage        from '../../pages/ClientsPage'
import ContactsPage       from '../../pages/ContactsPage'
import OpportunitiesPage  from '../../pages/OpportunitiesPage'
import DealsPage          from '../../pages/DealsPage'
import TasksPage          from '../../pages/TasksPage'
import ActivitiesPage     from '../../pages/ActivitiesPage'
import AIQuotesPage       from '../../pages/AIQuotesPage'
import AnalyticsPage      from '../../pages/AnalyticsPage'
import UsersPage          from '../../pages/UsersPage'
import FinancePage        from '../../pages/FinancePage'
import AccessDenied       from '../../pages/AccessDenied'
import AccountSettingsPage from '../../pages/AccountSettingsPage'

export type PageKey =
  | 'dashboard' | 'pipeline' | 'leads' | 'clients' | 'contacts'
  | 'opportunities' | 'deals' | 'tasks' | 'activities' | 'ai_quotes'
  | 'analytics' | 'users' | 'finance' | 'settings'

export interface GlobalSearchResult {
  id: string
  page: PageKey
  title: string
  subtitle: string
  kind: string
}

// Who can SEE each page
const pageAccess: Record<string, UserRole[] | 'all'> = {
  dashboard:     'all',
  pipeline:      'all',
  leads:         ['admin', 'manager', 'sales'],
  clients:       'all',
  contacts:      'all',
  opportunities: ['admin', 'manager', 'sales'],
  deals:         ['admin', 'manager', 'sales', 'finance'],
  tasks:         ['admin', 'manager', 'sales'],
  activities:    'all',
  ai_quotes:     ['admin', 'manager', 'sales'],
  analytics:     ['admin', 'manager'],
  users:         ['admin'],
  finance:       ['admin', 'finance', 'manager'],
  settings:      'all',
}

// Who can EDIT/WRITE on each page
export const pageWriteAccess: Record<string, UserRole[] | 'all'> = {
  dashboard:     'all',
  pipeline:      ['admin', 'manager'],
  leads:         ['admin', 'manager', 'sales'],
  clients:       ['admin', 'manager'],
  contacts:      ['admin', 'manager', 'sales'],
  opportunities: ['admin', 'manager', 'sales'],
  deals:         ['admin', 'manager'],
  tasks:         ['admin', 'manager', 'sales'],
  activities:    ['admin', 'manager', 'sales'],
  ai_quotes:     ['admin', 'manager', 'sales'],
  analytics:     ['admin'],
  users:         ['admin'],
  finance:       ['admin', 'finance'],
  settings:      'all',
}

export function canRead(role: UserRole, page: string): boolean {
  const a = pageAccess[page]
  if (!a || a === 'all') return true
  return (a as UserRole[]).includes(role)
}

export function canWrite(role: UserRole, page: string): boolean {
  const a = pageWriteAccess[page]
  if (!a || a === 'all') return true
  return (a as UserRole[]).includes(role)
}

interface Props {
  user:     User
  onLogout: () => void
}

export default function AppShell({ user, onLogout }: Props) {
  const [currentPage,     setCurrentPage]     = useState<PageKey>('dashboard')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false)
  const [aiPanelOpen,     setAiPanelOpen]     = useState(false)
  const [toasts,          setToasts]          = useState<Toast[]>([])
  const [currentUser,     setCurrentUser]     = useState<User>(user)
  const [searchQuery,     setSearchQuery]     = useState('')
  const [searchResults,   setSearchResults]   = useState<GlobalSearchResult[]>([])
  const [searchLoading,   setSearchLoading]   = useState(false)

  const addToast = (toast: Omit<Toast, 'id'>) => {
    const id = Math.random().toString(36).slice(2)
    setToasts(prev => [...prev, { ...toast, id }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3500)
  }

  const canEdit = canWrite(currentUser.role, currentPage)

  const handleUserUpdate = (updated: Partial<User>) => {
    setCurrentUser(prev => ({ ...prev, ...updated }))
  }

  useEffect(() => {
    const q = searchQuery.trim().toLowerCase()

    if (q.length < 2) {
      setSearchResults([])
      setSearchLoading(false)
      return
    }

    let cancelled = false
    setSearchLoading(true)

    const timer = window.setTimeout(async () => {
      try {
        const [leads, clients, contacts] = await Promise.all([
          leadsApi.list(),
          clientsApi.list(),
          contactsApi.list(),
        ])

        if (cancelled) return

        const includes = (value: string, fields: Array<string | undefined>) =>
          fields.some(field => field?.toLowerCase().includes(value))

        const matches: GlobalSearchResult[] = []

        leads
          .filter((lead: any) => includes(q, [lead.company, lead.contactName, lead.email, lead.title, lead.phone]))
          .slice(0, 4)
          .forEach((lead: any) => {
            matches.push({
              id: lead.id,
              page: 'leads',
              title: lead.company || lead.contactName || 'Lead',
              subtitle: [lead.contactName, lead.email].filter(Boolean).join(' · ') || 'Lead record',
              kind: 'Lead',
            })
          })

        clients
          .filter((client: any) => includes(q, [client.name, client.contactPerson, client.industry, client.email, client.phone]))
          .slice(0, 4)
          .forEach((client: any) => {
            matches.push({
              id: client.id,
              page: 'clients',
              title: client.name || 'Client',
              subtitle: [client.contactPerson, client.industry].filter(Boolean).join(' · ') || 'Client record',
              kind: 'Client',
            })
          })

        contacts
          .filter((contact: any) => includes(q, [
            `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
            contact.email,
            contact.company,
            contact.jobTitle,
          ]))
          .slice(0, 4)
          .forEach((contact: any) => {
            matches.push({
              id: contact.id,
              page: 'contacts',
              title: `${contact.firstName || ''} ${contact.lastName || ''}`.trim() || contact.email || 'Contact',
              subtitle: [contact.company || contact.client?.name, contact.jobTitle].filter(Boolean).join(' · ') || 'Contact record',
              kind: 'Contact',
            })
          })

        setSearchResults(matches.slice(0, 8))
      } catch {
        if (!cancelled) setSearchResults([])
      } finally {
        if (!cancelled) setSearchLoading(false)
      }
    }, 220)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [searchQuery])

  const handleSearchSelect = (result: GlobalSearchResult) => {
    setCurrentPage(result.page)
    setSearchQuery(result.title)
  }

  function renderPage() {
    if (currentPage !== 'settings' && !canRead(currentUser.role, currentPage)) {
      return <AccessDenied pageName={currentPage} role={currentUser.role} />
    }
    switch (currentPage) {
      case 'dashboard':     return <DashboardPage user={currentUser} onNavigate={setCurrentPage} />
      case 'pipeline':      return <PipelinePage addToast={addToast} canEdit={canEdit} />
      case 'leads':         return <LeadsPage addToast={addToast} onNavigate={setCurrentPage} canEdit={canEdit} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      case 'clients':       return <ClientsPage canEdit={canEdit} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      case 'contacts':      return <ContactsPage canEdit={canEdit} searchQuery={searchQuery} onSearchChange={setSearchQuery} />
      case 'opportunities': return <OpportunitiesPage addToast={addToast} canEdit={canEdit} userRole={currentUser.role} />
      case 'deals':         return <DealsPage addToast={addToast} canEdit={canEdit} />
      case 'tasks':         return <TasksPage addToast={addToast} canEdit={canEdit} />
      case 'activities':    return <ActivitiesPage addToast={addToast} />
      case 'ai_quotes':     return <AIQuotesPage />
      case 'analytics':     return <AnalyticsPage />
      case 'users':         return <UsersPage addToast={addToast} currentUser={currentUser} />
      case 'finance':       return <FinancePage addToast={addToast} canEdit={canEdit} />
      case 'settings':      return <AccountSettingsPage user={currentUser} onUserUpdate={handleUserUpdate} />
      default:              return <DashboardPage user={currentUser} onNavigate={setCurrentPage} />
    }
  }

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--bg-base)' }}>
      <Sidebar
        currentPage={currentPage}
        onNavigate={setCurrentPage}
        collapsed={sidebarCollapsed}
        onToggleCollapse={() => setSidebarCollapsed(!sidebarCollapsed)}
        userRole={currentUser.role}
      />
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          user={currentUser}
          onOpenAI={() => setAiPanelOpen(true)}
          onLogout={onLogout}
          currentPage={currentPage}
          onNavigate={(page) => setCurrentPage(page as PageKey)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchResults={searchResults}
          searchLoading={searchLoading}
          onSearchSelect={handleSearchSelect}
        />
        <main className="flex-1 overflow-y-auto p-6 relative">
          {/* Background Noise & Glows */}
          <div className="fixed inset-0 pointer-events-none opacity-[0.03]" style={{ backgroundImage: 'url("https://grainy-gradients.vercel.app/noise.svg")' }} />
          
          <AnimatePresence mode="wait">
            <motion.div
              key={currentPage}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.3, ease: "easeInOut" }}
            >
              {renderPage()}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
      <AIAssistantPanel
        open={aiPanelOpen}
        onClose={() => setAiPanelOpen(false)}
        userRole={currentUser.role}
        userName={currentUser.name}
      />
      <ToastContainer toasts={toasts} />
      <AIChatbot />
    </div>
  )
}
