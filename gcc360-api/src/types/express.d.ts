import 'express'

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string
        userId: string
        role: string
        companyId: string
      }
    }
  }
}

export {}
