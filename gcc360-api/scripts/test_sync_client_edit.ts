import 'dotenv/config'
import { prisma } from '../src/lib/prisma'
import { syncClientToContact } from '../src/lib/leadSync'

async function main() {
  const client = await prisma.client.findFirst()
  if (!client) {
    console.error('No client found in DB')
    process.exit(1)
  }

  const timestamp = Date.now()
  const update = await prisma.client.update({ where: { id: client.id }, data: {
    contactPerson: `Auto Test ${timestamp}`,
    email: `autotest+${timestamp}@example.invalid`,
    phone: `+971500000${String(timestamp).slice(-3)}`
  }})

  console.log('Updated client:', { id: update.id, name: update.name, contactPerson: update.contactPerson, email: update.email, phone: update.phone })

  const res = await syncClientToContact(prisma as any, update as any)
  console.log('Sync result:', res)

  const contact = await prisma.contact.findFirst({ where: { clientId: update.id } })
  console.log('Contact in DB:', contact)
}

main().catch(e => { console.error(e); process.exit(1) })
