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

/**
 * Layout helper for premium enterprise emails
 */
function getEmailLayout(title: string, contentHtml: string, accentColor: string = '#14b8a6') {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <style>
        .email-body { font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f8fafc; margin: 0; padding: 40px 20px; color: #1e293b; }
        .card { max-width: 560px; margin: 0 auto; background: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 15px -3px rgba(0,0,0,0.05), 0 4px 6px -4px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; }
        .header { background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); padding: 32px; text-align: center; }
        .header h1 { color: #ffffff; margin: 0; font-size: 24px; font-weight: 800; letter-spacing: -0.025em; }
        .header h1 span { color: ${accentColor}; }
        .content { padding: 40px; }
        .welcome { font-size: 20px; font-weight: 700; color: #0f172a; margin-bottom: 16px; }
        .text { font-size: 16px; line-height: 1.6; color: #475569; margin-bottom: 24px; }
        .credentials-box { background: #f1f5f9; border-radius: 12px; padding: 24px; margin: 24px 0; border: 1px solid #e2e8f0; }
        .credential-row { margin-bottom: 12px; }
        .credential-row:last-child { margin-bottom: 0; }
        .label { font-size: 11px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em; color: #64748b; margin-bottom: 4px; }
        .value { font-size: 15px; font-weight: 600; color: #0f172a; font-family: 'JetBrains Mono', 'Courier New', monospace; }
        .btn { display: inline-block; background-color: ${accentColor}; color: #ffffff !important; font-weight: 700; font-size: 15px; text-decoration: none; padding: 14px 32px; border-radius: 10px; text-align: center; margin-top: 8px; transition: all 0.2s; }
        .footer { text-align: center; padding: 32px; font-size: 12px; color: #94a3b8; border-top: 1px solid #f1f5f9; }
        .footer p { margin: 4px 0; }
      </style>
    </head>
    <body class="email-body">
      <div class="card">
        <div class="header">
          <h1>GCC360 <span>CRM</span></h1>
        </div>
        <div class="content">
          ${contentHtml}
        </div>
        <div class="footer">
          <p>&copy; ${new Date().getFullYear()} GCC360 Enterprise. All rights reserved.</p>
          <p>Confidential Business Intelligence Platform</p>
        </div>
      </div>
    </body>
    </html>
  `;
}

export async function sendInviteEmail(
  to: string,
  name: string,
  role: string,
  tempPassword: string,
  companyName?: string
): Promise<void> {
  if (!process.env.MAIL_USER) return

  const content = `
    <h2 class="welcome">Welcome to the Team, ${name.split(' ')[0]}!</h2>
    <p class="text">
      You have been invited to join <strong>${companyName || 'the GCC360 CRM platform'}</strong> as a <strong>${role.replace('_', ' ')}</strong>. 
      Your enterprise workspace is ready for activation.
    </p>
    
    <div class="credentials-box">
      <div class="credential-row">
        <div class="label">Access ID (Email)</div>
        <div class="value">${to}</div>
      </div>
      <div class="credential-row">
        <div class="label">Temporary Passkey</div>
        <div class="value">${tempPassword}</div>
      </div>
    </div>

    <p class="text" style="font-size: 14px; color: #64748b;">
      * For security reasons, you will be required to change this password immediately upon your first login.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">Enter Workspace</a>
    </div>
  `;

  await sendMail({
    to,
    subject: `Official Invitation: Join ${companyName || 'GCC360 CRM'}`,
    html: getEmailLayout('Welcome to GCC360 CRM', content, '#14b8a6'),
  })
}

export async function sendResetPasswordEmail(
  to: string,
  name: string,
  tempPassword: string
): Promise<void> {
  if (!process.env.MAIL_USER) return

  const content = `
    <h2 class="welcome">Security Update</h2>
    <p class="text">
      An administrator has reset your access credentials for GCC360 CRM. 
      Your temporary password has been updated.
    </p>
    
    <div class="credentials-box">
      <div class="credential-row">
        <div class="label">User Email</div>
        <div class="value">${to}</div>
      </div>
      <div class="credential-row">
        <div class="label">New Temporary Password</div>
        <div class="value">${tempPassword}</div>
      </div>
    </div>

    <p class="text" style="font-size: 14px; color: #64748b;">
      Please use these new credentials to sign in. You will be prompted to set a permanent password.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn" style="background-color: #f59e0b;">Reset Access</a>
    </div>
  `;

  await sendMail({
    to,
    subject: 'Security Alert: Password Reset for GCC360 CRM',
    html: getEmailLayout('Security Update', content, '#f59e0b'),
  })
}

export async function sendLeadNotification(
  to: string,
  leadCompany: string,
  leadEmail: string,
  aiScore: number
): Promise<void> {
  if (!process.env.MAIL_USER) return

  const content = `
    <h2 class="welcome">New Lead Detected</h2>
    <p class="text">
      Our AI Intelligence agent has scanned and identified a high-potential lead in your inbox.
    </p>
    
    <div class="credentials-box">
      <div class="credential-row">
        <div class="label">Company / Prospect</div>
        <div class="value">${leadCompany}</div>
      </div>
      <div class="credential-row">
        <div class="label">Contact Email</div>
        <div class="value">${leadEmail}</div>
      </div>
      <div class="credential-row">
        <div class="label">AI Credibility Score</div>
        <div class="value" style="color: ${aiScore >= 80 ? '#10b981' : '#f59e0b'};">${aiScore}/100</div>
      </div>
    </div>

    <p class="text">
      Please review the requirements and approve this prospect to initiate the sales workflow.
    </p>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">View Lead Details</a>
    </div>
  `;

  await sendMail({
    to,
    subject: `🔔 Lead Intelligence: ${leadCompany} detected`,
    html: getEmailLayout('Lead Intelligence', content, '#14b8a6'),
  })
}

export async function sendWelcomeEmail(
  to: string,
  name: string,
  companyName: string
): Promise<void> {
  if (!process.env.MAIL_USER) return

  const content = `
    <h2 class="welcome">Welcome to GCC360 CRM!</h2>
    <p class="text">
      Congratulations! Your organization <strong>${companyName}</strong> has been successfully registered on the GCC360 Enterprise platform. 
      You are now ready to transform your sales operations with AI-native intelligence.
    </p>
    
    <div class="credentials-box">
      <p class="text" style="margin: 0; font-weight: 600; color: #0f172a;">Next Steps for Success:</p>
      <ul style="padding-left: 20px; margin-top: 12px; color: #475569; font-size: 14px;">
        <li>Invite your team members from the User Management panel</li>
        <li>Set up your Email Scanner to automatically detect leads</li>
        <li>Configure your Pipeline stages to match your workflow</li>
      </ul>
    </div>

    <div style="text-align: center;">
      <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}" class="btn">Access Dashboard</a>
    </div>
  `;

  await sendMail({
    to,
    subject: `Welcome to GCC360 CRM: ${companyName} is live`,
    html: getEmailLayout('Welcome to the Platform', content, '#14b8a6'),
  })
}

