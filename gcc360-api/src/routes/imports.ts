import { Router } from 'express'
import bcrypt from 'bcryptjs'
import multer from 'multer'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { syncLeadToClientAndContact } from '../lib/leadSync'
import { syncClientToContact } from '../lib/leadSync'
import { sendInviteEmail } from '../services/mailer'

export const importsRouter = Router()
importsRouter.use(authenticate)

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 2 * 1024 * 1024 },
})

function parseCsv(text: string) {
  const lines = text.replace(/\r\n/g, '\n').split('\n').filter(line => line.trim().length > 0)
  if (lines.length === 0) return []

  const parseLine = (line: string) => {
    const cells: string[] = []
    let current = ''
    let inQuotes = false

    for (let i = 0; i < line.length; i++) {
      const char = line[i]
      const next = line[i + 1]

      if (char === '"' && inQuotes && next === '"') {
        current += '"'
        i++
        continue
      }

      if (char === '"') {
        inQuotes = !inQuotes
        continue
      }

      if (char === ',' && !inQuotes) {
        cells.push(current.trim())
        current = ''
        continue
      }

      current += char
    }

    cells.push(current.trim())
    return cells
  }

  const headers = parseLine(lines[0]).map(h => h.trim())
  return lines.slice(1).map(line => {
    const values = parseLine(line)
    return headers.reduce<Record<string, string>>((row, header, index) => {
      row[header] = values[index] ?? ''
      return row
    }, {})
  })
}

function requiredField(row: Record<string, string>, names: string[]) {
  for (const name of names) {
    if (row[name]?.trim()) return row[name].trim()
  }
  return ''
}

function toNumber(value: string | undefined) {
  if (!value) return 0
  const parsed = Number(String(value).replace(/[^\d.-]/g, ''))
  return Number.isFinite(parsed) ? parsed : 0
}

importsRouter.post('/:entity', requireRole('ADMIN'), upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const entity = req.params.entity
    if (!['leads', 'clients', 'contacts', 'users'].includes(entity)) {
      return res.status(400).json({ error: 'Entity must be leads, clients, contacts, or users.' })
    }

    if (!req.file) {
      return res.status(400).json({ error: 'CSV file is required.' })
    }

    const csv = req.file.buffer.toString('utf8')
    const rows = parseCsv(csv)
    if (rows.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty.' })
    }

    const summary = { created: 0, updated: 0, skipped: 0 }
    const createdUsers: Array<{ email: string; tempPassword: string }> = []

    for (const row of rows) {
      if (entity === 'leads') {
        const company = requiredField(row, ['company', 'Company'])
        const contactName = requiredField(row, ['contactName', 'contact', 'Contact Name'])
        const email = requiredField(row, ['email', 'Email'])
        if (!company || !contactName || !email) { summary.skipped++; continue }

        const existing = await prisma.lead.findFirst({ where: { companyId: req.user!.companyId, email } })
        const payload = {
          title: row.title || `${company} - Lead`,
          company,
          contactName,
          email,
          phone: row.phone || '',
          country: row.country || 'UAE',
          source: row.source || 'IMPORT',
          industry: row.industry || '',
          value: toNumber(row.value),
          priority: row.priority || 'MEDIUM',
          expectedTimeline: row.expectedTimeline || '',
          requirements: row.requirements || row.notes || '',
          internalNotes: row.internalNotes || '',
          tags: row.tags || '',
          status: row.status || 'NEW',
          companyId: req.user!.companyId,
          assignedToId: row.assignedToId || req.user!.userId,
        }

        if (existing) {
          await prisma.lead.update({ where: { id: existing.id }, data: payload })
          summary.updated++
        } else {
          const createdLead = await prisma.lead.create({ data: payload })
          await syncLeadToClientAndContact(prisma, createdLead)
          summary.created++
        }
      }

      if (entity === 'clients') {
        const name = requiredField(row, ['name', 'Name'])
        if (!name) { summary.skipped++; continue }

        const existing = await prisma.client.findFirst({ where: { companyId: req.user!.companyId, name } })
        const payload = {
          name,
          accountType: row.accountType || 'CUSTOMER',
          industry: row.industry || '',
          country: row.country || 'UAE',
          city: row.city || '',
          website: row.website || '',
          contactPerson: row.contactPerson || '',
          contactTitle: row.contactTitle || '',
          email: row.email || '',
          phone: row.phone || '',
          accountOwner: row.accountOwner || '',
          customerStatus: row.customerStatus || 'PROSPECT',
          paymentTerms: row.paymentTerms || '',
          currency: row.currency || 'AED',
          tier: row.tier || 'SILVER',
          address1: row.address1 || '',
          postalCode: row.postalCode || '',
          notes: row.notes || '',
          tags: row.tags || '',
          totalRevenue: toNumber(row.totalRevenue),
          activeDeals: Number(row.activeDeals || 0),
          companyId: req.user!.companyId,
        }

        if (existing) {
          const updatedClient = await prisma.client.update({ where: { id: existing.id }, data: payload })
          await syncClientToContact(prisma, updatedClient)
          summary.updated++
        } else {
          const createdClient = await prisma.client.create({ data: payload })
          await syncClientToContact(prisma, createdClient)
          summary.created++
        }
      }

      if (entity === 'contacts') {
        const firstName = requiredField(row, ['firstName', 'first_name', 'First Name'])
        const lastName = requiredField(row, ['lastName', 'last_name', 'Last Name'])
        const email = requiredField(row, ['email', 'Email'])
        if (!firstName || !lastName || !email) { summary.skipped++; continue }

        let clientId: string | null = row.clientId || null
        if (!clientId && row.company) {
          const client = await prisma.client.findFirst({ where: { companyId: req.user!.companyId, name: row.company } })
          clientId = client?.id || null
        }

        const existing = await prisma.contact.findFirst({ where: { companyId: req.user!.companyId, email } })
        const payload = {
          firstName,
          lastName,
          clientId,
          jobTitle: row.jobTitle || '',
          department: row.department || '',
          email,
          phone: row.phone || '',
          mobile: row.mobile || '',
          ownerId: row.ownerId || '',
          status: row.status || 'ACTIVE',
          company: row.company || '',
          notes: row.notes || '',
          tags: row.tags || '',
          companyId: req.user!.companyId,
          lastActivity: new Date(),
        }

        if (existing) {
          await prisma.contact.update({ where: { id: existing.id }, data: payload })
          summary.updated++
        } else {
          await prisma.contact.create({ data: payload })
          summary.created++
        }
      }

      if (entity === 'users') {
        const name = requiredField(row, ['name', 'Name'])
        const email = requiredField(row, ['email', 'Email'])
        if (!name || !email) { summary.skipped++; continue }

        const role = (row.role || 'SALES').toUpperCase().replace(/\s+/g, '_')
        const tempPassword = row.password?.trim() || Math.random().toString(36).slice(-10).toUpperCase()
        const existing = await prisma.user.findUnique({ where: { email } })

        const userData = {
          name,
          email,
          passwordHash: existing ? existing.passwordHash : await bcrypt.hash(tempPassword, 12),
          role,
          department: row.department || '',
          avatar: name.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
          status: row.status || (existing ? existing.status : 'PENDING'),
          companyId: req.user!.companyId,
        }

        if (existing) {
          await prisma.user.update({ where: { id: existing.id }, data: userData })
          summary.updated++
        } else {
          const user = await prisma.user.create({ data: userData })
          summary.created++
          createdUsers.push({ email: user.email, tempPassword })
          await sendInviteEmail(user.email, user.name, user.role, tempPassword).catch(() => {})
        }
      }
    }

    res.json({ entity, rows: rows.length, ...summary, createdUsers })
  } catch (err: any) {
    console.error('[IMPORT ERROR]:', err.message)
    res.status(500).json({ error: 'Import failed.' })
  }
})