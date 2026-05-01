import nodemailer from 'nodemailer'

export const transporter = nodemailer.createTransport({
  host:   process.env.MAIL_HOST  || 'smtp.gmail.com',
  port:   Number(process.env.MAIL_PORT) || 2525, // Port 2525 is a common alternative that bypasses most blocks
  secure: false,
  pool:   true,
  auth: {
    user: process.env.MAIL_USER || '',
    pass: process.env.MAIL_PASS || '',
  },
  tls: { rejectUnauthorized: false }
})

/**
 * Sends an email using either Resend API (if configured) or standard SMTP.
 */
export async function sendMail(options: { to: string; subject: string; html?: string; text?: string }) {
  const { to, subject, html, text } = options;

  // 1. Try Resend API first (Bypasses all Port Blocks)
  if (process.env.RESEND_API_KEY) {
    console.log(`[MAIL] Attempting API send to ${to} via Resend...`);
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    try {
      const response = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
        },
        signal: controller.signal,
        body: JSON.stringify({
          // Force onboarding@resend.dev if MAIL_FROM is a gmail address (Resend doesn't allow gmail)
          from: (process.env.MAIL_FROM && !process.env.MAIL_FROM.includes('gmail.com')) 
                ? process.env.MAIL_FROM 
                : 'GCC360 CRM <onboarding@resend.dev>',
          to,
          subject,
          html: html || text,
          text: text,
        }),
      });
      
      clearTimeout(timeout);
      const result = await response.json() as any;
      
      if (response.ok) {
        console.log(`[MAIL] API send successful to ${to}`);
        return result;
      }
      
      console.error('[RESEND API ERROR]:', result);
      throw new Error(`Resend API Error: ${result?.message || JSON.stringify(result)}`);
    } catch (e: any) {
      clearTimeout(timeout);
      console.error('[RESEND FAILED]:', e.message);
      throw e; // Don't fallback to SMTP if Resend was explicitly requested
    }
  }

  // 2. Only use SMTP if Resend is NOT configured
  console.log(`[MAIL] Using SMTP send to ${to}...`);
  return transporter.sendMail({
    from: process.env.MAIL_FROM || process.env.MAIL_USER,
    to,
    subject,
    html,
    text,
  });
}

export async function sendInviteEmail(
  to: string,
  name: string,
  role: string,
  tempPassword: string,
  companyName?: string
): Promise<void> {
  console.log(`[MAIL] Preparing invite email for ${to} (${name}) at ${companyName}...`);
  if (!process.env.MAIL_USER) {
    console.warn('[MAIL] Skipping invite: MAIL_USER not configured');
    return
  }

  const roleName = role.replace(/_/g, ' ');
  const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:5173';
  const orgName = companyName || 'GCC360 CRM';

  const html = `
    <div style="font-family: sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px rgba(0,0,0,0.05);">
        <div style="background: #0f172a; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GCC360 <span style="color: #14b8a6;">CRM</span></h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">Welcome to the Team!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            You have been invited to join <strong>${orgName}</strong> as a <strong>${roleName}</strong>. 
            Your enterprise workspace is ready for activation.
          </p>
          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <div style="margin-bottom: 12px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Access ID (Email)</div>
              <div style="font-size: 15px; font-weight: 600; color: #0f172a;">${to}</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">Temporary Passkey</div>
              <div style="font-size: 15px; font-weight: 600; color: #0f172a; font-family: monospace;">${tempPassword}</div>
            </div>
          </div>
          <p style="font-size: 14px; color: #64748b; margin-bottom: 24px;">
            * For security reasons, you will be required to change this password immediately upon your first login.
          </p>
          <div style="text-align: center;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #14b8a6; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px;">Enter Workspace</a>
          </div>
        </div>
        <div style="text-align: center; padding: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9;">
          <p>&copy; ${new Date().getFullYear()} GCC360 Enterprise. All rights reserved.</p>
        </div>
      </div>
    </div>
  `;

  const text = `Welcome to ${orgName}! You have been invited as a ${roleName}. Access ID: ${to}, Temporary Passkey: ${tempPassword}. Login at: ${dashboardUrl}`;

  await sendMail({ to, subject: `Official Invitation: Join ${orgName}`, html, text });
}

export async function sendResetPasswordEmail(
  to: string,
  name: string,
  tempPassword: string
): Promise<void> {
  if (!process.env.MAIL_USER) return
  const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    <div style="font-family: sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #0f172a; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GCC360 <span style="color: #f59e0b;">CRM</span></h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">Security Update</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            An administrator has reset your access credentials for GCC360 CRM. Your temporary password has been updated.
          </p>
          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <div style="margin-bottom: 12px;">
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">User Email</div>
              <div style="font-size: 15px; font-weight: 600; color: #0f172a;">${to}</div>
            </div>
            <div>
              <div style="font-size: 11px; font-weight: 800; text-transform: uppercase; color: #64748b; margin-bottom: 4px;">New Temporary Password</div>
              <div style="font-size: 15px; font-weight: 600; color: #0f172a; font-family: monospace;">${tempPassword}</div>
            </div>
          </div>
          <div style="text-align: center;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #f59e0b; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px;">Reset Access</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = `Security Update: Your password for GCC360 CRM has been reset. New Temporary Password: ${tempPassword}. Login at: ${dashboardUrl}`;

  await sendMail({ to, subject: 'Security Alert: Password Reset for GCC360 CRM', html, text });
}

export async function sendLeadNotification(
  to: string,
  leadCompany: string,
  leadEmail: string,
  aiScore: number
): Promise<void> {
  if (!process.env.MAIL_USER) return
  const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    <div style="font-family: sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #0f172a; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GCC360 <span style="color: #14b8a6;">CRM</span></h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">New Lead Detected</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">Our AI Intelligence agent has identified a high-potential lead.</p>
          <div style="background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0;">
            <p><strong>Company:</strong> ${leadCompany}</p>
            <p><strong>Email:</strong> ${leadEmail}</p>
            <p><strong>AI Score:</strong> ${aiScore}/100</p>
          </div>
          <div style="text-align: center;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #14b8a6; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px;">View Lead</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = `New Lead Detected: ${leadCompany} (${leadEmail}). AI Score: ${aiScore}/100. View in GCC360 CRM.`;

  await sendMail({ to, subject: `🔔 Lead Intelligence: ${leadCompany} detected`, html, text });
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  companyName: string
): Promise<void> {
  if (!process.env.MAIL_USER) return
  const dashboardUrl = process.env.FRONTEND_URL || 'http://localhost:5173';

  const html = `
    <div style="font-family: sans-serif; background-color: #f8fafc; padding: 40px 20px; color: #1e293b;">
      <div style="max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; border: 1px solid #e2e8f0;">
        <div style="background: #0f172a; padding: 32px; text-align: center;">
          <h1 style="color: #ffffff; margin: 0; font-size: 24px;">GCC360 <span style="color: #14b8a6;">CRM</span></h1>
        </div>
        <div style="padding: 40px;">
          <h2 style="font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px;">Welcome, ${name}!</h2>
          <p style="font-size: 16px; line-height: 1.6; color: #475569;">
            Your organization <strong>${companyName}</strong> is live on GCC360 CRM.
          </p>
          <div style="text-align: center; margin-top: 32px;">
            <a href="${dashboardUrl}" style="display: inline-block; background-color: #14b8a6; color: #ffffff; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px;">Go to Dashboard</a>
          </div>
        </div>
      </div>
    </div>
  `;

  const text = `Welcome to GCC360 CRM! Your organization ${companyName} has been successfully registered. Access your dashboard at ${dashboardUrl}`;

  await sendMail({ to, subject: `Welcome to GCC360 CRM: ${companyName} is live`, html, text });
}


