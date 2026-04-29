require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

const emails = [
  'ahmed@gcc360.com',
  'omar@gcc360.com',
  'fatima@gcc360.com',
  'khalid@gcc360.com',
  'sara@gcc360.com'
];

async function main() {
  try {
    const deleted = await prisma.user.deleteMany({ where: { email: { in: emails } } });
    console.log('DELETED_COUNT:' + deleted.count);
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
