import jwt from 'jsonwebtoken'

export interface JWTPayload {
  userId:    string
  role:      string
  companyId: string
  isFirstLogin: boolean
}

const ACCESS_SECRET  = process.env.JWT_ACCESS_SECRET  || 'dev-access-secret-change-in-production'
const REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'dev-refresh-secret-change-in-production'

export const signAccessToken  = (p: JWTPayload) => jwt.sign(p, ACCESS_SECRET,  { expiresIn: '15m' })
export const signRefreshToken = (p: JWTPayload) => jwt.sign(p, REFRESH_SECRET, { expiresIn: '7d'  })
export const verifyAccess     = (t: string)     => jwt.verify(t, ACCESS_SECRET)  as JWTPayload
export const verifyRefresh    = (t: string)     => jwt.verify(t, REFRESH_SECRET) as JWTPayload
