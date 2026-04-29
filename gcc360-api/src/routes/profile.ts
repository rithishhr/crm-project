import { Router } from 'express'
import bcrypt from 'bcryptjs'
import { authenticate, AuthRequest } from '../middleware/auth'
import { upload } from '../lib/upload'
import { prisma } from '../lib/prisma'

export const profileRouter = Router()
profileRouter.use(authenticate)

// ── GET /api/profile ───────────────────────────────────────────────────────────
profileRouter.get('/', async (req: AuthRequest, res) => {
  const user = await prisma.user.findUnique({
    where:   { id: req.user!.userId },
    include: { company: true },
    })
  if (!user) { res.status(404).json({ error: 'User not found.' }); return }

  res.json({
    id:         user.id,
    name:       user.name,
    email:      user.email,
    biometricEnabled: user.biometricEnabled,
    role:       user.role.toLowerCase(),
    department: user.department,
    phone:      user.phone,
    bio:        user.bio,
    avatar:     user.avatar,
    avatarUrl:  user.avatarUrl,
    status:     user.status,
    lastLogin:  user.lastLogin,
    createdAt:  user.createdAt,
    company: {
      id:       user.company.id,
      name:     user.company.name,
      industry: user.company.industry,
      country:  user.company.country,
      plan:     user.company.plan,
    }
  })
})

// ── PATCH /api/profile ─────────────────────────────────────────────────────────
// Update name, department, phone, bio
profileRouter.patch('/', async (req: AuthRequest, res) => {
  const { name, department, phone, bio } = req.body

  const updated = await prisma.user.update({
    where: { id: req.user!.userId },
    data: {
      ...(name       !== undefined && { name }),
      ...(department !== undefined && { department }),
      ...(phone      !== undefined && { phone }),
      ...(bio        !== undefined && { bio }),
      // Auto-update avatar initials if name changed
      ...(name       !== undefined && {
        avatar: name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase()
      }),
    }
  })

  res.json({ success: true, user: { name: updated.name, department: updated.department, phone: updated.phone, bio: updated.bio, avatar: updated.avatar } })
})

// ── POST /api/profile/change-password ─────────────────────────────────────────
profileRouter.post('/change-password', async (req: AuthRequest, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword || !newPassword) {
    res.status(400).json({ error: 'Current and new password are required.' })
    return
  }
  if (newPassword.length < 6) {
    res.status(400).json({ error: 'New password must be at least 6 characters.' })
    return
  }

  const user = await prisma.user.findUnique({ where: { id: req.user!.userId } })
  if (!user) { res.status(404).json({ error: 'User not found.' }); return }

  const valid = await bcrypt.compare(currentPassword, user.passwordHash)
  if (!valid) {
    res.status(400).json({ error: 'Current password is incorrect.' })
    return
  }

  await prisma.user.update({
    where: { id: user.id },
    data:  { passwordHash: await bcrypt.hash(newPassword, 12) }
  })

  // Revoke all refresh tokens so other devices get logged out
  await prisma.refreshToken.deleteMany({ where: { userId: user.id } })

  res.json({ success: true, message: 'Password changed. Please log in again on other devices.' })
})

// ── POST /api/profile/avatar ───────────────────────────────────────────────────
// Upload a profile picture
profileRouter.post('/avatar', upload.single('avatar'), async (req: AuthRequest, res) => {
  if (!req.file) {
    res.status(400).json({ error: 'No file uploaded.' })
    return
  }

  const avatarUrl = `/uploads/${req.file.filename}`

  await prisma.user.update({
    where: { id: req.user!.userId },
    data:  { avatarUrl }
  })

  res.json({ success: true, avatarUrl })
})

// ── DELETE /api/profile/avatar ─────────────────────────────────────────────────
profileRouter.delete('/avatar', async (req: AuthRequest, res) => {
  await prisma.user.update({
    where: { id: req.user!.userId },
    data:  { avatarUrl: null }
  })
  res.json({ success: true })
})
