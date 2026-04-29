require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  try {
    const companies = await prisma.company.findMany({ select: { id: true, name: true } });
    companies.forEach(c => console.log(`${c.id}\t${c.name}`));
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
