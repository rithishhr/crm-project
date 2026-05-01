import { Router, Response } from 'express'
import bcrypt from 'bcryptjs'
import { authenticate, requireRole, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { sendInviteEmail } from '../services/mailer'

export const usersRouter = Router()
usersRouter.use(authenticate)

// ── GET /api/users ─────────────────────────────────────────────────────────────
usersRouter.get('/', async (req: AuthRequest, res: Response) => {
  const users = await prisma.user.findMany({
    where:   { companyId: req.user!.companyId },
    select:  { id: true, name: true, email: true, role: true, department: true, avatar: true, avatarUrl: true, phone: true, status: true, lastLogin: true, createdAt: true },
    orderBy: { createdAt: 'asc' },
  })
  res.json(users)
})

// ── POST /api/users/invite ─────────────────────────────────────────────────────
usersRouter.post('/invite', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { name, email, role, department } = req.body
  const allowedRoles = ['ADMIN', 'MANAGER', 'SALES', 'FINANCE']
  if (!name || !email || !role) {
    res.status(400).json({ error: 'Name, email, and role are required.' })
    return
  }

  const roleUpperCase = role.toUpperCase().replace(' ', '_')
  if (!allowedRoles.includes(roleUpperCase)) {
    res.status(400).json({ error: `Invalid role. Must be one of: ${allowedRoles.join(', ')}` })
    return
  }

  const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
  if (existing) {
    res.status(409).json({ error: 'A user with this email already exists.' })
    return
  }

  // Generate temporary password (OTP)
  const tempPassword   = Math.random().toString(36).slice(-8).toUpperCase()
  const passwordHash   = await bcrypt.hash(tempPassword, 12)

  const company = await prisma.company.findUnique({ where: { id: req.user!.companyId } })
  const companyName = company?.name || 'GCC360 CRM'

  const user = await prisma.user.create({
    data: {
      name,
      email:      email.toLowerCase(),
      passwordHash,
      role:       roleUpperCase,
      department: department || '',
      avatar:     name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
      status:     'PENDING',
      companyId:  req.user!.companyId,
    }
  })

  // Send invite email (won't crash if email not configured)
  await sendInviteEmail(email, name, role, tempPassword, companyName).catch(console.error)

  res.status(201).json({
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status },
    tempPassword, // Return it so admin can share manually if email isn't configured
  })
})

// ── PATCH /api/users/:id/role ──────────────────────────────────────────────────
usersRouter.patch('/:id/role', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { role } = req.body
  if (!role) { res.status(400).json({ error: 'Role is required.' }); return }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data:  { role: role.toUpperCase().replace(' ', '_') },
  })
  res.json({ success: true, role: user.role })
})

// ── PATCH /api/users/:id/status ────────────────────────────────────────────────
usersRouter.patch('/:id/status', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const { status } = req.body
  if (!['ACTIVE', 'INACTIVE'].includes(status)) {
    res.status(400).json({ error: 'Status must be ACTIVE or INACTIVE.' })
    return
  }
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data:  { status }
  })
  res.json({ success: true, status: user.status })
})

// ── DELETE /api/users/:id ──────────────────────────────────────────────────────
usersRouter.delete('/:id', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  // Prevent deleting yourself
  if (req.params.id === req.user!.userId) {
    res.status(400).json({ error: 'You cannot delete your own account.' })
    return
  }
  await prisma.user.delete({ where: { id: req.params.id } })
  res.json({ success: true })
})

// ── POST /api/users/:id/reset-password ─────────────────────────────────────────
usersRouter.post('/:id/reset-password', requireRole('ADMIN'), async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({ where: { id: req.params.id } })
  if (!user) { res.status(404).json({ error: 'User not found.' }); return }

  const company = await prisma.company.findUnique({ where: { id: req.user!.companyId } })
  const companyName = company?.name || 'GCC360 CRM'

  const tempPassword = Math.random().toString(36).slice(-8).toUpperCase()
  const passwordHash = await bcrypt.hash(tempPassword, 12)

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash, isFirstLogin: true }
  })

  // Send email (optional implementation in mailer.ts)
  await sendInviteEmail(user.email, user.name, user.role, tempPassword, companyName).catch(console.error)

  res.json({ success: true, tempPassword })
})
