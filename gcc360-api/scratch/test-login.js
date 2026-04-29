const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');
const prisma = new PrismaClient();

async function main() {
  const email = 'rithish.ds22@sahyadri.edu.in';
  const password = 'Volvitech@2026';

  console.log('Checking user:', email);
  const user = await prisma.user.findUnique({ where: { email } });

  if (!user) {
    console.log('User not found!');
    return;
  }

  console.log('User found. Comparing passwords...');
  const match = await bcrypt.compare(password, user.passwordHash);
  console.log('Password match:', match);
}

main().catch(console.error).finally(() => prisma.$disconnect());
