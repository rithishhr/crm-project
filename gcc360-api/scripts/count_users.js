require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const c = await prisma.user.count();
    console.log('USERS_COUNT:' + c);
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
