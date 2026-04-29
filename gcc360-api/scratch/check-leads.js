const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.lead.count();
  console.log('Total Leads count:', count);
  
  const leads = await prisma.lead.findMany({
    include: { companyRef: true },
    take: 5
  });
  
  leads.forEach(l => {
    console.log(`- Lead: ${l.name}, Status: ${l.status}, Company: ${l.company.name}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
