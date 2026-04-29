import { Router } from 'express'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { createNotification } from '../lib/notifications'

export const tasksRouter = Router()
tasksRouter.use(authenticate)

tasksRouter.get('/', async (req: AuthRequest, res) => {
  const { companyId, role, userId } = req.user!
  const tasks = await prisma.task.findMany({
    where: {
      companyId,
      ...(role === 'SALESPERSON' ? { assignedToId: userId } : {}),
    },
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } },
    orderBy: [{ priority: 'desc' }, { dueDate: 'asc' }],
  })
  res.json(tasks)
})

tasksRouter.post('/', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  const { title, dueDate, priority, relatedTo, notes, assignedToId } = req.body
  if (!title || !dueDate) { res.status(400).json({ error: 'Title and due date are required.' }); return }

  const assignedId = assignedToId || req.user!.userId

  const task = await prisma.task.create({
    data: {
      title, relatedTo: relatedTo || '',
      dueDate:      new Date(dueDate),
      priority:     priority || 'MEDIUM',
      status:       'TODO',
      companyId:    req.user!.companyId,
      assignedToId: assignedId,
    },
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } }
  })

  // Notify assignee if task assigned to someone else
  if (assignedId !== req.user!.userId) {
    await createNotification({
      userId:    assignedId,
      companyId: req.user!.companyId,
      type:      'TASK',
      title:     '✅ New Task Assigned',
      message:   `"${title}" is due ${new Date(dueDate).toLocaleDateString('en-GB')}. ${relatedTo ? `Related: ${relatedTo}` : ''}`.trim()
    })
  }

  res.status(201).json(task)
})

tasksRouter.patch('/:id', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  const fields = ['title', 'status', 'priority', 'relatedTo', 'assignedToId', 'notes']
  const data: Record<string, unknown> = {}
  for (const f of fields) { if (req.body[f] !== undefined) data[f] = req.body[f] }
  if (req.body.dueDate !== undefined) data.dueDate = new Date(req.body.dueDate)
  const task = await prisma.task.update({
    where: { id: req.params.id }, data,
    include: { assignedTo: { select: { id: true, name: true, avatar: true } } }
  })
  res.json(task)
})

tasksRouter.delete('/:id', requireRole('ADMIN', 'MANAGER', 'SALES'), async (req: AuthRequest, res) => {
  await prisma.task.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── DELETE /api/tasks/bulk ───────────────────────────────────────────────
tasksRouter.delete('/bulk', requireRole('ADMIN', 'MANAGER'), async (req: AuthRequest, res) => {
  const { ids } = req.body
  if (!ids || !Array.isArray(ids)) {
    res.status(400).json({ error: 'IDs array is required.' })
    return
  }
  await prisma.task.deleteMany({
    where: { id: { in: ids }, companyId: req.user!.companyId }
  })
  res.json({ success: true })
})
