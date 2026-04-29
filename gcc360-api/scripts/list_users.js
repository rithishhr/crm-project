require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const users = await prisma.user.findMany({ select: { id: true, name: true, email: true } });
    users.forEach(u => console.log(`${u.id}\t${u.name}\t${u.email}`));
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
