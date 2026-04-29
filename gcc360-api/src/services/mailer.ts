import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST  || 'smtp.gmail.com',
  port:   Number(process.env.MAIL_PORT) || 465,
  secure: true,
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
})

export async function sendInviteEmail(
  to: string,
  name: string,
  role: string,
  tempPassword: string
): Promise<void> {
  if (!process.env.MAIL_USER) return // Email not configured, skip silently

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject: 'You have been invited to GCC360 CRM',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f1729; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #14b8a6; margin-bottom: 8px;">Welcome to GCC360 CRM</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>You have been added to GCC360 CRM as <strong>${role}</strong>.</p>
        <p>Your login credentials:</p>
        <div style="background: #1a2235; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
          <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background:#0d1117;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">Please log in and change your password immediately.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;background:#14b8a6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Login to GCC360</a>
      </div>
    `,
  })
}

export async function sendResetPasswordEmail(
  to: string,
  name: string,
  tempPassword: string
): Promise<void> {
  if (!process.env.MAIL_USER) return

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject: 'Password Reset: GCC360 CRM',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f1729; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #f59e0b; margin-bottom: 8px;">Password Reset</h2>
        <p>Hello <strong>${name}</strong>,</p>
        <p>Your password for GCC360 CRM has been reset by an administrator.</p>
        <p>Your new temporary login credentials:</p>
        <div style="background: #1a2235; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p style="margin: 4px 0;"><strong>Email:</strong> ${to}</p>
          <p style="margin: 4px 0;"><strong>Temporary Password:</strong> <code style="background:#0d1117;padding:2px 6px;border-radius:4px;">${tempPassword}</code></p>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">You will be required to change this password on your next login.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;background:#f59e0b;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;margin-top:8px;">Login to GCC360</a>
      </div>
    `,
  })
}

export async function sendLeadNotification(
  to: string,
  leadCompany: string,
  leadEmail: string,
  aiScore: number
): Promise<void> {
  if (!process.env.MAIL_USER) return

  await transporter.sendMail({
    from:    process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject: `🔔 New Lead Detected: ${leadCompany}`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 24px; background: #0f1729; color: #f1f5f9; border-radius: 12px;">
        <h2 style="color: #14b8a6;">New Lead from Email Scanner</h2>
        <p>A new lead has been detected and verified by AI:</p>
        <div style="background: #1a2235; border-radius: 8px; padding: 16px; margin: 16px 0;">
          <p><strong>Company:</strong> ${leadCompany}</p>
          <p><strong>Email:</strong> ${leadEmail}</p>
          <p><strong>AI Score:</strong> ${aiScore}/100</p>
        </div>
        <p style="color: #94a3b8; font-size: 14px;">Please review and approve this lead in the CRM.</p>
        <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" style="display:inline-block;background:#14b8a6;color:#fff;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">View in GCC360</a>
      </div>
    `,
  })
}
