const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    select: { id: true, email: true, companyId: true }
  });
  
  console.log('Users in DB:');
  users.forEach(u => {
    console.log(`- User: ${u.email}, CompanyId: ${u.companyId}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
