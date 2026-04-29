import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import cookieParser from 'cookie-parser'
import path from 'path'
import cron from 'node-cron'
import dotenv from 'dotenv'
dotenv.config()

import { authRouter }          from './routes/auth'
import { usersRouter }         from './routes/users'
import { leadsRouter }         from './routes/leads'
import { opportunitiesRouter } from './routes/opportunities'
import { clientsRouter }       from './routes/clients'
import { contactsRouter }      from './routes/contacts'
import { dealsRouter }         from './routes/deals'
import { tasksRouter }         from './routes/tasks'
import { activitiesRouter }    from './routes/activities'
import { invoicesRouter }      from './routes/invoices'
import { analyticsRouter }     from './routes/analytics'
import { profileRouter }       from './routes/profile'
import { emailRouter }         from './routes/email'
import { notificationsRouter } from './routes/notifications'
import { aiRouter }            from './routes/ai'
import { aiExtractorRouter }   from './routes/ai-extractor'
import { importsRouter }       from './routes/imports'
import { documentsRouter }     from './routes/documents'
import biometricRouter         from './routes/biometric'
import aiLeadIngestionRouter   from './routes/aiLeadIngestion'
import emailImportRouter       from './routes/emailImport'
import voiceRouter             from './routes/voice'
import reportingRouter         from './routes/reporting'
import socialRouter            from './routes/social'
import { errorHandler }        from './middleware/errorHandler'
import { startEmailScanner }   from './services/emailScanner'
import { runDealRiskAnalysis } from './routes/ai'
import { prisma }              from './lib/prisma'

const app = express()

// ── Security ───────────────────────────────────────────────────────────────────
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }))
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true,
}))
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true }))
app.use(cookieParser())
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')))

// ── Routes ─────────────────────────────────────────────────────────────────────
app.use('/api/auth',          authRouter)
app.use('/api/users',         usersRouter)
app.use('/api/profile',       profileRouter)
app.use('/api/leads',         leadsRouter)
app.use('/api/opportunities', opportunitiesRouter)
app.use('/api/clients',       clientsRouter)
app.use('/api/contacts',      contactsRouter)
app.use('/api/deals',         dealsRouter)
app.use('/api/tasks',         tasksRouter)
app.use('/api/activities',    activitiesRouter)
app.use('/api/invoices',      invoicesRouter)
app.use('/api/analytics',     analyticsRouter)
app.use('/api/email',         emailRouter)
app.use('/api/notifications', notificationsRouter)
app.use('/api/ai',            aiRouter)
app.use('/api/ai',            aiExtractorRouter)
app.use('/api/imports',       importsRouter)
app.use('/api/documents',     documentsRouter)
app.use('/api/biometric',     biometricRouter)
app.use('/api/ai-lead-ingestion', aiLeadIngestionRouter)
app.use('/api/email-import',  emailImportRouter)
app.use('/api/voice',         voiceRouter)
app.use('/api/reporting',     reportingRouter)
app.use('/api/social',        socialRouter)

// ── Root & Health check ──────────────────────────────────────────────────────
app.get('/', (_req, res) => {
  res.send('<h1>GCC360 Backend API is Running</h1><p>Visit <a href="/api/health">/api/health</a> for server status.</p>')
})

app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    time: new Date().toISOString(),
    version: '1.0.0',
    aiConfigured: !!process.env.GROQ_API_KEY,
  })
})

app.use(errorHandler)

// ── Start server ───────────────────────────────────────────────────────────────
const PORT = Number(process.env.PORT) || 4000
app.listen(PORT, () => {
  console.log(`\n🚀 GCC360 API running on http://localhost:${PORT}`)
  console.log(`📊 Health: http://localhost:${PORT}/api/health`)

  if (process.env.GROQ_API_KEY) {
    console.log('🤖 AI agents ready (Groq — free tier)')
  } else {
    console.log('⚠️  AI agents disabled — add GROQ_API_KEY to .env (free at console.groq.com)')
  }

  if (process.env.IMAP_USER && process.env.IMAP_PASS) {
    startEmailScanner()
    console.log('📧 Email scanner started (every 5 minutes)')
  } else {
    console.log('📧 Email scanner disabled — add IMAP_USER/IMAP_PASS to .env to enable')
  }

  // Nightly deal risk analysis — runs at midnight every day
  if (process.env.GROQ_API_KEY) {
    cron.schedule('0 0 * * *', async () => {
      console.log('🔍 Running nightly deal risk analysis...')
      const companies = await prisma.company.findMany({ select: { id: true } })
      for (const company of companies) {
        await runDealRiskAnalysis(company.id).catch(console.error)
      }
      console.log('✅ Deal risk analysis complete')
    })
    console.log('🔍 Deal risk analyser scheduled (runs nightly at midnight)')
  }

  console.log('')
})
