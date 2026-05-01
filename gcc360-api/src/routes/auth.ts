import { Router, Response, Request } from 'express'
import bcrypt from 'bcryptjs'
import { prisma } from '../lib/prisma'
import { signAccessToken, signRefreshToken, verifyRefresh } from '../lib/jwt'
import { sendWelcomeEmail } from '../services/mailer'

export const authRouter = Router()

const COOKIE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: process.env.NODE_ENV === 'production' ? 'none' as const : 'lax' as const,
  maxAge:   7 * 24 * 60 * 60 * 1000, // 7 days
}

function truthy(value: string | undefined) {
  return !!value && ['1', 'true', 'yes', 'on'].includes(value.toLowerCase())
}

function normalizeCompanyName(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\b(ltd|limited|llc|inc|incorporated|corp|corporation|co|company|group|holdings?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function isSameOrSimilarCompanyName(a: string, b: string) {
  const left = normalizeCompanyName(a)
  const right = normalizeCompanyName(b)
  if (!left || !right) return false
  if (left === right) return true
  const compactLeft = left.replace(/\s+/g, '')
  const compactRight = right.replace(/\s+/g, '')
  if (compactLeft === compactRight) return true
  return compactLeft.length > 4 && compactRight.length > 4 && (compactLeft.includes(compactRight) || compactRight.includes(compactLeft))
}

// ── GET /api/auth/bootstrap-status ───────────────────────────────────────────
authRouter.get('/bootstrap-status', async (_req: Request, res: Response) => {
  const [users, companies] = await Promise.all([
    prisma.user.count(),
    prisma.company.count(),
  ])

  res.json({
    needsBootstrap: users === 0 || companies === 0,
    publicSignupEnabled: truthy(process.env.ALLOW_PUBLIC_SIGNUP),
  })
})

// ── GET /api/auth/company-check ──────────────────────────────────────────────
authRouter.get('/company-check', async (req: Request, res: Response) => {
  const companyName = String(req.query.companyName || '').trim()
  if (!companyName) {
    res.status(400).json({ error: 'Company name is required.' })
    return
  }

  const companies = await prisma.company.findMany({ select: { id: true, name: true } })
  const matching = companies.filter(company => isSameOrSimilarCompanyName(company.name, companyName))

  res.json({
    exists: matching.length > 0,
    matches: matching,
  })
})

// ── POST /api/auth/login ───────────────────────────────────────────────────────
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body
    if (!email || !password) {
      res.status(400).json({ error: 'Email and password are required.' })
      return
    }

    const user = await prisma.user.findUnique({
      where:   { email: email.toLowerCase().trim() },
      include: { company: true },
    })

    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      res.status(401).json({ error: 'Wrong email or password.' })
      return
    }

    if (user.status !== 'ACTIVE') {
      res.status(403).json({ error: 'Your account has been deactivated. Contact your admin.' })
      return
    }

    const payload      = { userId: user.id, role: user.role, companyId: user.companyId, isFirstLogin: user.isFirstLogin }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await prisma.refreshToken.upsert({
      where: { token: refreshToken },
      update: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      create: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    })
    await prisma.user.update({ where: { id: user.id }, data: { lastLogin: new Date() } })

    res.cookie('refreshToken', refreshToken, COOKIE)

    res.json({
      accessToken,
      user: {
        id:         user.id,
        name:       user.name,
        email:      user.email,
        biometricEnabled: user.biometricEnabled || false,
        role:       user.role.toLowerCase(),
        avatar:     user.avatar,
        avatarUrl:  user.avatarUrl,
        department: user.department,
        phone:      user.phone,
        bio:        user.bio,
        companyId:  user.companyId,
        status:     user.status,
        isFirstLogin: user.isFirstLogin,
        lastLogin:  user.lastLogin,
        createdAt:  user.createdAt,
        company: {
          id:   user.company.id,
          name: user.company.name,
          plan: user.company.plan,
        }
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Login failed.' })
  }
})

// ── POST /api/auth/refresh ─────────────────────────────────────────────────────
authRouter.post('/refresh', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (!token) { res.status(401).json({ error: 'No session found.' }); return }

  try {
    const stored = await prisma.refreshToken.findUnique({ where: { token } })
    if (!stored || stored.expiresAt < new Date()) {
      res.clearCookie('refreshToken')
      res.status(401).json({ error: 'Session expired. Please log in again.' })
      return
    }
    const payload     = verifyRefresh(token)
    const accessToken = signAccessToken({ userId: payload.userId, role: payload.role, companyId: payload.companyId, isFirstLogin: payload.isFirstLogin })
    res.json({ accessToken })
  } catch {
    res.status(401).json({ error: 'Invalid session.' })
  }
})

// ── POST /api/auth/logout ──────────────────────────────────────────────────────
authRouter.post('/logout', async (req: Request, res: Response) => {
  const token = req.cookies?.refreshToken
  if (token) await prisma.refreshToken.deleteMany({ where: { token } }).catch(() => {})
  res.clearCookie('refreshToken')
  res.json({ success: true })
})

// ── POST /api/auth/signup ──────────────────────────────────────────────────────
// Creates a brand new company + admin user (for new customers signing up)
authRouter.post('/signup', async (req: Request, res: Response) => {
  try {
    const { name, email, password, companyName, country, industry } = req.body
    if (!name || !email || !password || !companyName) {
      res.status(400).json({ error: 'Name, email, password, and company name are required.' })
      return
    }
    if (password.length < 6) {
      res.status(400).json({ error: 'Password must be at least 6 characters.' })
      return
    }

    const existingUserCount = await prisma.user.count()
    const publicSignupEnabled = truthy(process.env.ALLOW_PUBLIC_SIGNUP)
    if (existingUserCount > 0 && !publicSignupEnabled) {
      res.status(403).json({ error: 'Public signup is disabled. Ask an administrator to invite you.' })
      return
    }

    const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } })
    if (existing) {
      res.status(409).json({ error: 'An account with this email already exists.' })
      return
    }

    // Prevent multiple public signups for the same company name (case-insensitive)
    const existingCompanies = await prisma.company.findMany({ select: { id: true, name: true } })
    const dup = existingCompanies.find(c => isSameOrSimilarCompanyName(c.name, companyName))
    if (dup) {
      res.status(409).json({ error: 'A company with this name already exists. Contact the company admin to be invited.' })
      return
    }

    const company = await prisma.company.create({
      data: { name: companyName, industry: industry || 'General', country: country || 'UAE', plan: 'STARTER' }
    })

    const user = await prisma.user.create({
      data: {
        name,
        email:        email.toLowerCase(),
        passwordHash: await bcrypt.hash(password, 12),
        role:         'ADMIN',
        department:   'Executive',
        avatar:       name.split(' ').map((n: string) => n[0]).join('').slice(0, 2).toUpperCase(),
        status:       'ACTIVE',
        isFirstLogin: false,
        companyId:    company.id,
      }
    })

    // Send welcome email
    await sendWelcomeEmail(user.email, user.name, company.name).catch(console.error)

    const payload      = { userId: user.id, role: user.role, companyId: user.companyId, isFirstLogin: user.isFirstLogin }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)
    await prisma.refreshToken.upsert({
      where: { token: refreshToken },
      update: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      create: { token: refreshToken, userId: user.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    })

    res.cookie('refreshToken', refreshToken, COOKIE)
    res.status(201).json({
      accessToken,
      user: { id: user.id, name: user.name, email: user.email, role: 'admin', isFirstLogin: user.isFirstLogin, companyId: user.companyId, company: { id: company.id, name: company.name, plan: company.plan } }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Signup failed.' })
  }
})

// ── POST /api/auth/face-login ────────────────────────────────────────────────
authRouter.post('/face-login', async (req: Request, res: Response) => {
  try {
    const { descriptor } = req.body
    if (!descriptor || !Array.isArray(descriptor)) {
      res.status(400).json({ error: 'Invalid face descriptor.' })
      return
    }

    const records = await prisma.biometricRecord.findMany({
      where: {
        status: 'ACTIVE',
        user: {
          status: 'ACTIVE',
          biometricEnabled: true,
        },
      },
      include: {
        user: {
          include: { company: true },
        },
      },
    })

    let matchedUser: any = null
    let bestDistance = 0.6 // threshold

    console.log(`Checking face login against ${records.length} records...`)

    for (const record of records) {
      const stored = record.faceDescriptor as number[]
      if (Array.isArray(stored) && stored.length === descriptor.length) {
        let sum = 0
        for (let i = 0; i < stored.length; i++) {
          sum += Math.pow(stored[i] - descriptor[i], 2)
        }
        const distance = Math.sqrt(sum)
        console.log(`- Match distance for user ${record.user.email}: ${distance.toFixed(4)}`)
        
        if (distance < bestDistance) {
          bestDistance = distance
          matchedUser = record.user
        }
      } else {
        console.log(`- Record ${record.id} length mismatch or not an array. Stored length: ${Array.isArray(stored) ? stored.length : 'not array'}, descriptor length: ${descriptor.length}`)
      }
    }

    if (!matchedUser) {
      console.log('Face login: No match found below threshold 0.6')
      res.status(401).json({ error: 'Face not recognized.' })
      return
    }

    const payload      = { userId: matchedUser.id, role: matchedUser.role, companyId: matchedUser.companyId, isFirstLogin: matchedUser.isFirstLogin }
    const accessToken  = signAccessToken(payload)
    const refreshToken = signRefreshToken(payload)

    await prisma.refreshToken.upsert({
      where: { token: refreshToken },
      update: { expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
      create: { token: refreshToken, userId: matchedUser.id, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) }
    })
    await prisma.user.update({ where: { id: matchedUser.id }, data: { lastLogin: new Date() } })

    res.cookie('refreshToken', refreshToken, COOKIE)

    res.json({
      accessToken,
      user: {
        id:         matchedUser.id,
        name:       matchedUser.name,
        biometricEnabled: matchedUser.biometricEnabled || false,
        email:      matchedUser.email,
        role:       matchedUser.role.toLowerCase(),
        avatar:     matchedUser.avatar,
        avatarUrl:  matchedUser.avatarUrl,
        department: matchedUser.department,
        isFirstLogin: matchedUser.isFirstLogin,
        companyId:  matchedUser.companyId,
        company: {
          id:   matchedUser.company.id,
          name: matchedUser.company.name,
          plan: matchedUser.company.plan,
        }
      }
    })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Face login failed.' })
  }
})

// ── POST /api/auth/change-password-first-login ──────────────────────────────
authRouter.post('/change-password-first-login', async (req: Request, res: Response) => {
  try {
    const { email, tempPassword, newPassword } = req.body
    if (!email || !tempPassword || !newPassword) {
      res.status(400).json({ error: 'Email, temporary password, and new password are required.' })
      return
    }

    const user = await prisma.user.findUnique({ where: { email: email.toLowerCase().trim() } })
    if (!user || !(await bcrypt.compare(tempPassword, user.passwordHash))) {
      res.status(401).json({ error: 'Invalid temporary password.' })
      return
    }

    if (!user.isFirstLogin) {
      res.status(400).json({ error: 'Password has already been changed.' })
      return
    }

    const passwordHash = await bcrypt.hash(newPassword, 12)
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash, isFirstLogin: false, status: 'ACTIVE' }
    })

    res.json({ success: true, message: 'Password updated successfully. Please log in with your new password.' })
  } catch (err) {
    console.error(err)
    res.status(500).json({ error: 'Failed to change password.' })
  }
})
