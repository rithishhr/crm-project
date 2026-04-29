const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const count = await prisma.biometricRecord.count();
  console.log('Biometric records count:', count);
  
  const records = await prisma.biometricRecord.findMany({
    include: { user: true }
  });
  
  records.forEach(r => {
    console.log(`- User: ${r.user.email}, Status: ${r.status}`);
  });
}

main().catch(console.error).finally(() => prisma.$disconnect());
