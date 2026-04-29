import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

function truthy(value: string | undefined) {
  return !!value && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function env(name: string, fallback = '') {
  return (process.env[name] || fallback).trim()
}

async function seedBootstrapCompany() {
  const companyName = env('INITIAL_COMPANY_NAME')
  const adminEmail = env('INITIAL_ADMIN_EMAIL')
  const adminPassword = env('INITIAL_ADMIN_PASSWORD')
  const adminName = env('INITIAL_ADMIN_NAME')

  if (!companyName && !adminEmail) {
    console.log('No bootstrap seed configured. Set INITIAL_COMPANY_NAME and INITIAL_ADMIN_EMAIL to create an initial tenant.')
    return null
  }

  if (!companyName || !adminEmail || !adminPassword || !adminName) {
    throw new Error('Bootstrap seed requires INITIAL_COMPANY_NAME, INITIAL_ADMIN_NAME, INITIAL_ADMIN_EMAIL, and INITIAL_ADMIN_PASSWORD')
  }

  const company = await prisma.company.upsert({
    where: { id: env('INITIAL_COMPANY_ID', 'bootstrap-company') },
    update: {
      name: companyName,
      industry: env('INITIAL_COMPANY_INDUSTRY', 'Other'),
      country: env('INITIAL_COMPANY_COUNTRY', 'UAE'),
      plan: env('INITIAL_COMPANY_PLAN', 'ENTERPRISE'),
    },
    create: {
      id: env('INITIAL_COMPANY_ID', 'bootstrap-company'),
      name: companyName,
      industry: env('INITIAL_COMPANY_INDUSTRY', 'Other'),
      country: env('INITIAL_COMPANY_COUNTRY', 'UAE'),
      plan: env('INITIAL_COMPANY_PLAN', 'ENTERPRISE'),
    },
  })

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: {
      name: adminName,
      role: 'ADMIN',
      department: env('INITIAL_ADMIN_DEPARTMENT', 'Executive'),
      status: 'ACTIVE',
      companyId: company.id,
    },
    create: {
      name: adminName,
      email: adminEmail,
      passwordHash: await bcrypt.hash(adminPassword, 12),
      role: 'ADMIN',
      department: env('INITIAL_ADMIN_DEPARTMENT', 'Executive'),
      avatar: adminName.split(' ').map(part => part[0]).join('').slice(0, 2).toUpperCase(),
      status: 'ACTIVE',
      companyId: company.id,
    },
  })

  console.log(`Bootstrap tenant ready: ${company.name} / ${adminEmail}`)
  return company
}

async function main() {
  console.log('Seeding GCC360 database...')

  await seedBootstrapCompany()

  console.log('Seed complete.')
}

main()
  .catch(err => {
    console.error(err)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
