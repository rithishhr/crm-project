import Imap from 'node-imap'
import { simpleParser } from 'mailparser'
import cron from 'node-cron'
import { prisma } from '../lib/prisma'
import { verifyEmailWithAI } from './aiVerifier'
import { sendLeadNotification } from './mailer'
import { syncLeadToClientAndContact } from '../lib/leadSync'

// Gets the first company in the database to assign leads to
async function getDefaultCompany(): Promise<string | null> {
  const company = await prisma.company.findFirst()
  return company?.id ?? null
}

// Gets the first admin user to assign email leads to
async function getDefaultAdmin(companyId: string): Promise<string | null> {
  const admin = await prisma.user.findFirst({
    where: { companyId, role: 'ADMIN' }
  })
  return admin?.id ?? null
}

function scanInbox(): Promise<void> {
  return new Promise((resolve) => {
    if (!process.env.IMAP_USER || !process.env.IMAP_PASS) {
      resolve()
      return
    }

    const imap = new Imap({
      user:     process.env.IMAP_USER,
      password: process.env.IMAP_PASS,
      host:     process.env.IMAP_HOST || 'imap.gmail.com',
      port:     Number(process.env.IMAP_PORT) || 993,
      tls:      true,
      tlsOptions: { rejectUnauthorized: false },
    })

    imap.once('ready', () => {
      imap.openBox('INBOX', false, (_err: Error | null, box: any) => {
        if (_err || box.messages.total === 0) {
          imap.end()
          resolve()
          return
        }

        // Search for unseen emails from the last 7 days
        const since = new Date()
        since.setDate(since.getDate() - 7)

        imap.search(['UNSEEN', ['SINCE', since]], async (searchErr: Error | null, uids: number[]) => {
          if (searchErr || !uids || uids.length === 0) {
            imap.end()
            resolve()
            return
          }

          console.log(`📧 Found ${uids.length} unread email(s) to scan`)

          const fetch = imap.fetch(uids, { bodies: '', markSeen: true })
          const promises: Promise<void>[] = []

          fetch.on('message', (msg: any) => {
            const p = new Promise<void>((msgResolve) => {
              let buffer = ''
              msg.on('body', (stream: any) => {
                stream.on('data', (chunk: Buffer | string) => { buffer += chunk.toString('utf8') })
                stream.on('end', async () => {
                  try {
                    const parsed = await simpleParser(buffer)
                    const fromAddr = parsed.from?.value?.[0]?.address || ''
                    const fromName = parsed.from?.value?.[0]?.name || ''
                    const subject  = parsed.subject || ''
                    const body     = parsed.text || (typeof parsed.html === 'string' ? parsed.html.replace(/<[^>]*>/g, '') : '') || ''
                    const msgId    = parsed.messageId || `${Date.now()}`

                    if (!fromAddr) { msgResolve(); return }

                    // Check if already processed
                    const existing = await prisma.emailScanLog.findUnique({
                      where: { messageId: msgId }
                    })
                    if (existing) { msgResolve(); return }

                    // AI verification
                    const result = verifyEmailWithAI(fromAddr, fromName, subject, body)

                    const companyId = await getDefaultCompany()
                    if (!companyId) { msgResolve(); return }

                    let leadId: string | undefined

                    // Only create lead if not fraud and score > 35
                    if (!result.isFraud && result.aiScore > 35) {
                      const lead = await prisma.lead.create({
                        data: {
                          company:            result.company,
                          contactName:        result.contactName,
                          email:              result.email,
                          phone:              result.phone,
                          source:             'Email (Auto-Scanned)',
                          aiCredibilityScore: result.aiScore,
                          aiVerified:         false,
                          aiFraudFlag:        false,
                          aiNotes:            result.aiNotes,
                          status:             'NEW',
                          value:              result.value,
                          industry:           result.industry,
                          country:            result.country,
                          internalNotes:      result.notes,
                          emailSubject:       subject,
                          emailBody:          body.slice(0, 2000),
                          fromEmail:          true,
                          companyId,
                          assignedToId:       await getDefaultAdmin(companyId),
                        }
                      })
                      await syncLeadToClientAndContact(prisma, lead)
                      leadId = lead.id
                      console.log(`   ✅ Lead created: ${result.company} (score: ${result.aiScore})`)

                      // Notify all managers by email + in-app notification
                      const managers = await prisma.user.findMany({ where: { companyId, role: { in: ['ADMIN', 'SALES_MANAGER'] } } })
                      for (const mgr of managers) {
                        await sendLeadNotification(mgr.email, result.company, result.email, result.aiScore).catch(() => {})
                        await prisma.notification.create({ data: {
                          userId: mgr.id, companyId, type: 'EMAIL',
                          title: '📧 New Email Lead: ' + result.company,
                          message: 'AI score ' + result.aiScore + '/100 — ' + (result.aiNotes?.split(' | ')[0] || 'Review required'),
                        }}).catch(() => {})
                      }
                    } else {
                      console.log(`   ⚠️ Skipped (fraud: ${result.isFraud}, score: ${result.aiScore}): ${fromAddr}`)
                    }

                    // Log the scan regardless
                    await prisma.emailScanLog.create({
                      data: {
                        messageId:   msgId,
                        fromAddress: fromAddr,
                        subject:     subject.slice(0, 490),
                        result:      result.isFraud ? 'FRAUD' : result.aiScore > 35 ? 'LEAD_CREATED' : 'LOW_SCORE',
                        leadId,
                        companyId,
                      }
                    })
                  } catch (e) {
                    console.error('   Error processing email:', e)
                  }
                  msgResolve()
                })
              })
            })
            promises.push(p)
          })

          fetch.once('end', async () => {
            await Promise.all(promises)
            imap.end()
            resolve()
          })
        })
      })
    })

    imap.once('error', (err: Error) => {
      console.error('IMAP error:', err.message)
      resolve()
    })

    imap.once('end', () => resolve())
    imap.connect()
  })
}

/** Starts the email scanner cron job — runs every 5 minutes */
export function startEmailScanner(): void {
  // Run immediately on startup
  scanInbox().catch(console.error)

  // Then every 5 minutes
  cron.schedule('*/5 * * * *', () => {
    console.log('📧 Scanning inbox for new leads...')
    scanInbox().catch(console.error)
  })
}

/** Manually trigger a scan (used by the API route) */
export async function triggerScan(): Promise<{ message: string }> {
  await scanInbox()
  return { message: 'Inbox scan complete' }
}
