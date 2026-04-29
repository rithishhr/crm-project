import 'dotenv/config'
import bcrypt from 'bcryptjs'
import fetch from 'node-fetch'
import { prisma } from '../src/lib/prisma'

async function main() {
  const user = await prisma.user.findFirst()
  if (!user) { console.error('No users'); process.exit(1) }

  const password = 'TestPass123'
  const hash = await bcrypt.hash(password, 12)
  await prisma.user.update({ where: { id: user.id }, data: { passwordHash: hash, biometricEnabled: true } })
  console.log('Updated user', user.email)

  const res = await fetch('http://localhost:4000/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: user.email, password })
  })
  const json = await res.json()
  console.log('Status', res.status)
  console.log('Response', json)
}

main().catch(e => { console.error(e); process.exit(1) })
