const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const leads = await prisma.lead.findMany({
    select: { id: true, contactName: true, companyId: true }
  });
  
  console.log('Leads in DB:');
  leads.forEach(l => {
    console.log(`- ID: ${l.id}, Name: ${l.contactName}, CompanyId: ${l.companyId}`);
  });

  const companies = await prisma.company.findMany({
    select: { id: true, name: true }
  });
  console.log('\nCompanies in DB:');
  companies.forEach(c => {
    console.log(`- ID: ${c.id}, Name: ${c.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
