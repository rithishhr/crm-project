require('dotenv').config({path:'.env'});
const {PrismaClient} = require('@prisma/client');
const prisma = new PrismaClient();

const COMPANY_IDENTIFIER = 'GCC360 Demo'; // company name to remove (case-insensitive)

async function main() {
  try {
    const company = await prisma.company.findFirst({ where: { name: COMPANY_IDENTIFIER } });
    if (!company) {
      console.log('NO_COMPANY_FOUND');
      return;
    }
    const companyId = company.id;
    console.log('DELETING COMPANY:', companyId, company.name);

    // Find users belonging to this company
    const users = await prisma.user.findMany({ where: { companyId }, select: { id: true } });
    const userIds = users.map(u => u.id);

    // Delete dependent records in safe order
    const results = {};
    results.refreshTokens = await prisma.refreshToken.deleteMany({ where: { userId: { in: userIds } } }).catch(() => ({ count: 0 }));
    results.documents = await prisma.document.deleteMany({ where: { userId: { in: userIds } } }).catch(() => ({ count: 0 }));
    results.emailImportLogs = await prisma.emailImportLog.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.callLogs = await prisma.callLog.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.notifications = await prisma.notification.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.activities = await prisma.activity.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.tasks = await prisma.task.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.aiQuotes = await prisma.aIQuote.deleteMany({ where: { } }).catch(() => ({ count: 0 }));
    results.opportunities = await prisma.opportunity.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.deals = await prisma.deal.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.invoices = await prisma.invoice.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.contacts = await prisma.contact.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.clients = await prisma.client.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));
    results.leads = await prisma.lead.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));

    // Delete users last
    results.users = await prisma.user.deleteMany({ where: { companyId } }).catch(() => ({ count: 0 }));

    // Finally delete the company
    results.company = await prisma.company.delete({ where: { id: companyId } }).catch(() => ({ count: 0 }));

    console.log('DELETE_RESULTS:');
    console.log(results);
  } catch (e) {
    console.error('ERR', e.message);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

main();
