import { Request, Response, NextFunction } from 'express'
import { verifyAccess } from '../lib/jwt'

export interface AuthRequest extends Request {
  user?: { id: string; userId: string; role: string; companyId: string }
}

/** Checks JWT from cookie or Authorization header */
export const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const token =
    req.cookies?.accessToken ||
    req.headers.authorization?.replace('Bearer ', '')

  if (!token) {
    res.status(401).json({ error: 'Not authenticated. Please log in.' })
    return
  }

  try {
    const payload = verifyAccess(token)
    req.user = {
      id: payload.userId,
      userId: payload.userId,
      role: payload.role,
      companyId: payload.companyId,
    }

    // If user needs to change password, block all other requests
    // (The change-password route itself is unauthenticated in auth.ts)
    if (payload.isFirstLogin && payload.role !== 'ADMIN' && !req.path.includes('/api/auth/change-password-first-login')) {
      res.status(403).json({ error: 'Password change required.', needsPasswordChange: true })
      return
    }

    next()
  } catch {
    res.status(401).json({ error: 'Session expired. Please log in again.' })
  }
}

/** Only allows users with specified roles */
export const requireRole = (...roles: string[]) =>
  (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: 'You do not have permission to do this.' })
      return
    }
    next()
  }

export default authenticate
