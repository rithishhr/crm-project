import fetch from 'node-fetch'
import { prisma } from '../src/lib/prisma'

async function main() {
  const user = await prisma.user.findFirst({ where: { biometricEnabled: true } })
  if (!user) {
    console.error('No enrolled user')
    process.exit(1)
  }
  const record = await prisma.biometricRecord.findFirst({ where: { userId: user.id, status: 'ACTIVE' }, orderBy: { createdAt: 'desc' } })
  if (!record) {
    console.error('No biometric record')
    process.exit(1)
  }
  const descriptor = record.faceDescriptor as number[]
  const res = await fetch('http://localhost:4000/api/biometric/authenticate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId: user.id, faceDescriptor: descriptor })
  })
  const json = await res.json()
  console.log('Status', res.status)
  console.log('Response', json)
}

main().catch(e => { console.error(e); process.exit(1) })
