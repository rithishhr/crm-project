require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const bcrypt = require('bcryptjs');
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
    const users = await prisma.user.findMany({ where: { email: { in: emails } } });
    for (const u of users) {
      const anonymized = `deleted+${u.id}@example.invalid`;
      const randomHash = await bcrypt.hash(Math.random().toString(36), 12);
      await prisma.refreshToken.deleteMany({ where: { userId: u.id } }).catch(() => {});
      await prisma.user.update({ where: { id: u.id }, data: { status: 'DEACTIVATED', email: anonymized, passwordHash: randomHash, faceDescriptor: null, avatarUrl: null, phone: null } });
      console.log('DEACTIVATED:' + u.email + ' -> ' + anonymized);
    }
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
