import { useState } from 'react'
import { motion } from 'framer-motion'
import { Download, FileText, Loader2 } from 'lucide-react'
import { getToken } from '../../lib/api'

interface Props {
  dealId: string;
  dealTitle: string;
}

export default function DealFinanceExport({ dealId, dealTitle }: Props) {
  const [loading, setLoading] = useState(false)

  const handleExport = async () => {
    setLoading(true)
    try {
      const BASE = import.meta.env.VITE_API_URL || 'http://localhost:4000'
      const token = getToken()
      
      const res = await fetch(`${BASE}/api/documents/export/${dealId}`, {
        method: 'GET',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {}
      })

      if (!res.ok) throw new Error('Export failed')

      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `deal_${dealId}_finance.pdf`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)

    } catch (err) {
      console.error(err)
      alert('Failed to export PDF.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.button
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={handleExport}
      disabled={loading}
      className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all"
      style={{
        background: 'linear-gradient(135deg, rgba(59, 130, 246, 0.1) 0%, rgba(16, 185, 129, 0.1) 100%)',
        border: '1px solid rgba(59, 130, 246, 0.2)',
        color: '#3b82f6',
        backdropFilter: 'blur(8px)'
      }}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : (
        <FileText className="w-4 h-4" />
      )}
      <span>{loading ? 'Generating...' : `Export ${dealTitle} Finance`}</span>
      {!loading && <Download className="w-3 h-3 ml-1 opacity-70" />}
    </motion.button>
  )
}
