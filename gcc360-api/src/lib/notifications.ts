import { prisma } from '../lib/prisma'

export async function createNotification({
  userId,
  companyId,
  type,
  title,
  message,
  link,
}: {
  userId:    string
  companyId: string
  type:      'LEAD' | 'DEAL' | 'TASK' | 'EMAIL' | 'SYSTEM' | 'INVOICE' | 'FRAUD'
  title:     string
  message:   string
  link?:     string
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: { userId, companyId, type, title, message, link: link || null }
    })
  } catch {
    // Don't crash if notification fails — it's not critical
  }
}

/** Notify all admins and sales managers in a company */
export async function notifyManagers(
  companyId: string,
  type: 'LEAD' | 'DEAL' | 'TASK' | 'EMAIL' | 'SYSTEM' | 'INVOICE' | 'FRAUD',
  title: string,
  message: string,
  link?: string
): Promise<void> {
  const managers = await prisma.user.findMany({
    where: { companyId, role: { in: ['ADMIN', 'SALES_MANAGER'] }, status: 'ACTIVE' },
    select: { id: true }
  })
  await Promise.all(managers.map(m =>
    createNotification({ userId: m.id, companyId, type, title, message, link })
  ))
}
