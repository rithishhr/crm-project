import { Router } from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'

export const notificationsRouter = Router()
notificationsRouter.use(authenticate)

// GET all notifications for current user
notificationsRouter.get('/', async (req: AuthRequest, res) => {
  const notifications = await prisma.notification.findMany({
    where: { userId: req.user!.userId },
    orderBy: { createdAt: 'desc' },
    take: 50,
  })
  res.json(notifications)
})

// GET unread count
notificationsRouter.get('/unread-count', async (req: AuthRequest, res) => {
  const count = await prisma.notification.count({ where: { userId: req.user!.userId, read: false } })
  res.json({ count })
})

// PATCH mark one as read
notificationsRouter.patch('/:id/read', async (req: AuthRequest, res) => {
  await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } })
  res.json({ success: true })
})

// PATCH mark all as read
notificationsRouter.patch('/read-all', async (req: AuthRequest, res) => {
  await prisma.notification.updateMany({ where: { userId: req.user!.userId, read: false }, data: { read: true } })
  res.json({ success: true })
})

// DELETE one notification
notificationsRouter.delete('/:id', async (req: AuthRequest, res) => {
  await prisma.notification.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// DELETE all notifications
notificationsRouter.delete('/', async (req: AuthRequest, res) => {
  await prisma.notification.deleteMany({ where: { userId: req.user!.userId } })
  res.json({ success: true })
})
