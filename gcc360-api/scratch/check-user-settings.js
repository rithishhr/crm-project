const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const email = 'rithish.ds22@sahyadri.edu.in';
  const user = await prisma.user.findUnique({ where: { email } });
  
  if (user) {
    console.log(`User: ${user.email}, Biometric Enabled: ${user.biometricEnabled}`);
  } else {
    console.log('User not found');
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
