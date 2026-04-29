import { ShieldOff } from 'lucide-react'
import type { UserRole } from '../types'

interface Props { pageName: string; role: UserRole }

const roleLabels: Record<string, string> = {
  admin: 'Administrator', sales_manager: 'Sales Manager', salesperson: 'Salesperson',
  finance: 'Finance', analyst: 'Analyst',
}

export default function AccessDenied({ pageName, role }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full min-h-96 text-center">
      <div className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4" style={{ backgroundColor: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
        <ShieldOff className="w-8 h-8" style={{ color: '#f87171' }} />
      </div>
      <h2 className="text-xl font-bold mb-2" style={{ color: 'var(--text-primary)' }}>Access Restricted</h2>
      <p className="text-sm max-w-xs" style={{ color: 'var(--text-secondary)' }}>
        Your role <span className="font-medium" style={{ color: 'var(--text-primary)' }}>({roleLabels[role]})</span> does not have permission to view{' '}
        <span className="font-medium capitalize" style={{ color: 'var(--text-primary)' }}>{pageName.replace('_', ' ')}</span>.
      </p>
      <p className="text-xs mt-3" style={{ color: 'var(--text-muted)' }}>Contact your Administrator to request access.</p>
    </div>
  )
}