import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle, AlertCircle, Info } from 'lucide-react'

export interface Toast {
  id: string
  message: string
  type: 'success' | 'error' | 'info'
}

interface Props { toasts: Toast[] }

export default function ToastContainer({ toasts }: Props) {
  return (
    <div className="fixed bottom-5 right-5 z-[100] space-y-2">
      <AnimatePresence>
        {toasts.map(toast => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 60, scale: 0.9 }}
            animate={{ opacity: 1, x: 0, scale: 1 }}
            exit={{ opacity: 0, x: 60, scale: 0.9 }}
            transition={{ type: 'spring', stiffness: 400, damping: 30 }}
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl min-w-72 max-w-sm backdrop-blur-sm"
            style={{
              backgroundColor: toast.type === 'success' ? 'rgba(20,184,166,0.12)' : toast.type === 'error' ? 'rgba(239,68,68,0.12)' : 'var(--bg-card)',
              border: `1px solid ${toast.type === 'success' ? 'rgba(20,184,166,0.3)' : toast.type === 'error' ? 'rgba(239,68,68,0.3)' : 'var(--border)'}`,
              color: toast.type === 'success' ? '#2dd4bf' : toast.type === 'error' ? '#f87171' : 'var(--text-secondary)',
            }}
          >
            {toast.type === 'success' && <CheckCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.type === 'error' && <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            {toast.type === 'info' && <Info className="w-4 h-4 flex-shrink-0" />}
            <p className="text-sm font-medium flex-1">{toast.message}</p>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  )
}