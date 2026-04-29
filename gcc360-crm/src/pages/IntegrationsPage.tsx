import { useState } from 'react'
import { motion } from 'framer-motion'
import { Bot, Fingerprint, Mail, PhoneCall, Share2, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { integrationApi } from '../lib/api'
import type { Toast } from '../components/ui/Toast'

interface Props {
  userId: string
  addToast: (t: Omit<Toast, 'id'>) => void
}

interface CheckState {
  loading: boolean
  ok: boolean
  error: string
  payload: any
}

const initialState: CheckState = {
  loading: false,
  ok: false,
  error: '',
  payload: null,
}

function ResultBlock({ state }: { state: CheckState }) {
  if (state.loading) {
    return (
      <div className="text-xs text-[var(--text-muted)] flex items-center gap-2">
        <Loader2 className="w-3.5 h-3.5 animate-spin" /> Checking module...
      </div>
    )
  }

  if (state.error) {
    return (
      <div className="text-xs text-red-400 flex items-center gap-2">
        <AlertCircle className="w-3.5 h-3.5" /> {state.error}
      </div>
    )
  }

  if (state.ok) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-emerald-400 flex items-center gap-2">
          <CheckCircle2 className="w-3.5 h-3.5" /> Module reachable
        </div>
        <pre className="text-[11px] rounded-lg p-3 overflow-auto max-h-36 bg-[var(--bg-base)] border border-[var(--border)] text-[var(--text-secondary)]">
{JSON.stringify(state.payload, null, 2)}
        </pre>
      </div>
    )
  }

  return <div className="text-xs text-[var(--text-muted)]">Not checked yet.</div>
}

export default function IntegrationsPage({ userId, addToast }: Props) {
  const [bioState, setBioState] = useState<CheckState>(initialState)
  const [aiState, setAiState] = useState<CheckState>(initialState)
  const [emailState, setEmailState] = useState<CheckState>(initialState)
  const [voiceState, setVoiceState] = useState<CheckState>(initialState)
  const [reportState, setReportState] = useState<CheckState>(initialState)
  const [socialState, setSocialState] = useState<CheckState>(initialState)

  const probe = async (
    run: () => Promise<any>,
    setter: (s: CheckState) => void,
    moduleName: string
  ) => {
    setter({ ...initialState, loading: true })
    try {
      const payload = await run()
      setter({ loading: false, ok: true, error: '', payload })
      addToast({ type: 'success', message: `${moduleName} OK: endpoint responded successfully.` })
    } catch (e: any) {
      setter({ loading: false, ok: false, error: e?.message || 'Request failed', payload: null })
      addToast({ type: 'error', message: `${moduleName} failed: ${e?.message || 'Request failed'}` })
    }
  }

  const cards = [
    {
      title: 'Biometric Login',
      icon: Fingerprint,
      desc: 'Face enrollment status and biometric auth checks.',
      action: () => probe(() => integrationApi.biometricEnrollmentCheck(userId), setBioState, 'Biometric'),
      state: bioState,
    },
    {
      title: 'AI Lead Ingestion',
      icon: Bot,
      desc: 'AI extraction from raw text into lead fields.',
      action: () =>
        probe(
          () => integrationApi.aiLeadExtract('John Doe from Acme asks for 200k AED proposal. Email john@acme.com, phone +971501234567', 'GCC Oil & Gas'),
          setAiState,
          'AI Ingestion'
        ),
      state: aiState,
    },
    {
      title: 'Email Import',
      icon: Mail,
      desc: 'IMAP extraction logs and import processing status.',
      action: () => probe(() => integrationApi.emailImportLogs(), setEmailState, 'Email Import'),
      state: emailState,
    },
    {
      title: 'Voice Calls',
      icon: PhoneCall,
      desc: 'Vapi/Twilio call logs and transcript analysis records.',
      action: () => probe(() => integrationApi.voiceCallLogs(), setVoiceState, 'Voice'),
      state: voiceState,
    },
    {
      title: 'Automated Reporting',
      icon: FileText,
      desc: 'Generated PDF report records and history.',
      action: () => probe(() => integrationApi.generatedReports(), setReportState, 'Reporting'),
      state: reportState,
    },
    {
      title: 'Social Lead Sync',
      icon: Share2,
      desc: 'Facebook/Instagram lead pipeline and conversion stats.',
      action: () => probe(() => integrationApi.socialStats(), setSocialState, 'Social'),
      state: socialState,
    },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Integrations</h1>
        <p className="text-sm text-[var(--text-muted)] mt-1">
          This is where Email Import, AI Ingestion, Voice, Social Sync, Biometric, and Reporting are exposed in UI.
        </p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        {cards.map((card, i) => (
          <motion.div
            key={card.title}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            className="rounded-2xl p-5 border bg-[var(--bg-card)] border-[var(--border)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <card.icon className="w-4 h-4 text-teal-400" />
                  <h2 className="font-semibold text-[var(--text-primary)]">{card.title}</h2>
                </div>
                <p className="text-xs mt-1 text-[var(--text-muted)]">{card.desc}</p>
              </div>
              <button className="btn-secondary text-xs" onClick={card.action}>
                Check
              </button>
            </div>

            <div className="mt-4">
              <ResultBlock state={card.state} />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  )
}
