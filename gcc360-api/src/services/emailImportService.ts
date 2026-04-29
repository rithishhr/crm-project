import { PrismaClient } from "@prisma/client";
import Imap from "node-imap";
import { simpleParser } from "mailparser";
import * as Groq from "groq-sdk";
import * as nodemailer from "nodemailer";
import { syncLeadToClientAndContact } from "../lib/leadSync";

const prisma = new PrismaClient();
const groq = new Groq.default({
  apiKey: process.env.GROQ_API_KEY,
});

function addressToText(address: unknown): string {
  if (!address) return "";
  if (typeof address === "object" && address !== null && "text" in (address as Record<string, unknown>)) {
    const text = (address as { text?: string }).text;
    return text || "";
  }
  if (Array.isArray(address)) {
    return address
      .map((a) => (a && typeof a === "object" && "text" in (a as Record<string, unknown>) ? ((a as { text?: string }).text || "") : ""))
      .filter(Boolean)
      .join(", ");
  }
  return "";
}

interface EmailData {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  messageId: string;
}

interface ExtractedEmailLead {
  senderName?: string;
  senderEmail: string;
  senderCompany?: string;
  subject: string;
  inquiryType?: string;
  message: string;
  confidence: number;
}

/**
 * Email Import Service
 * Handles IMAP email scanning, parsing, and AI-powered lead extraction
 */
export class EmailImportService {
  /**
   * Connect to IMAP server and retrieve unread emails
   */
  static async connectAndFetchEmails(
    user: string,
    password: string,
    imapHost: string,
    imapPort: number = 993,
    maxEmails: number = 10
  ): Promise<EmailData[]> {
    return new Promise((resolve, reject) => {
      const imap = new Imap({
        user,
        password,
        host: imapHost,
        port: imapPort,
        tls: true,
        tlsOptions: { rejectUnauthorized: false },
      });

      const emails: EmailData[] = [];
      let count = 0;

      imap.openBox("INBOX", false, (err: Error | null, _mailbox: unknown) => {
        if (err) {
          imap.end();
          reject(err);
          return;
        }

        // Search for unread emails from last 24 hours
        const oneDayAgo = new Date();
        oneDayAgo.setDate(oneDayAgo.getDate() - 1);

        imap.search(
          ["UNSEEN", ["SINCE", oneDayAgo]],
          (err: Error | null, results: number[]) => {
            if (err) {
              imap.end();
              reject(err);
              return;
            }

            if (!results || results.length === 0) {
              imap.end();
              resolve([]);
              return;
            }

            const f = imap.fetch(results, { bodies: "" });

            f.on("message", (msg: any) => {
              simpleParser(msg as any, async (err, parsed) => {
                if (err) {
                  console.error("Parse error:", err);
                  return;
                }

                const from = addressToText(parsed.from) || "unknown";
                const to = addressToText(parsed.to);
                const subject = parsed.subject || "[No Subject]";
                const text = parsed.text || "";
                const html = parsed.html || undefined;

                // Extract message ID from headers
                const messageId = (parsed.messageId || `${Date.now()}@email`).replace(
                  /[<>]/g,
                  ""
                );

                emails.push({
                  from,
                  to,
                  subject,
                  text: text.substring(0, 5000), // Limit text length
                  html,
                  messageId,
                });

                count++;
                if (count >= maxEmails) {
                  imap.end();
                }
              });
            });

            f.on("error", (err: Error) => {
              imap.end();
              reject(err);
            });

            f.on("end", () => {
              if (count < maxEmails) {
                imap.end();
              }
            });
          }
        );
      });

      imap.on("error", (err: Error) => {
        reject(err);
      });

      imap.on("end", () => {
        resolve(emails);
      });

      imap.openBox("INBOX", false, (err: Error | null) => {
        if (err) {
          reject(err);
        }
      });
    });
  }

  /**
   * Extract lead information from email using AI
   */
  static async extractLeadFromEmail(
    emailData: EmailData
  ): Promise<ExtractedEmailLead | null> {
    try {
      const systemPrompt = `You are an email lead extraction specialist. Analyze the email and extract lead information.

Return ONLY valid JSON (no markdown, no explanation) with:
{
  "senderName": "Name of person (optional)",
  "senderEmail": "Email address (required)",
  "senderCompany": "Company name (optional)",
  "subject": "Email subject",
  "inquiryType": "Type of inquiry (e.g., PROPOSAL_REQUEST, SUPPORT, SALES_INQUIRY, PARTNERSHIP, OTHER)",
  "message": "Summary of email content and key points",
  "confidence": "Confidence score 0-1 that this is a qualified lead"
}

Consider the email content for lead quality. High confidence (0.8+) if:
- Clear business inquiry or proposal request
- Valid company/contact information
- Specific requirements or needs mentioned

Low confidence (0.3-0.5) if:
- Generic inquiry
- Limited information
- Possible spam indicators`;

      const userPrompt = `Email from: ${emailData.from}
Subject: ${emailData.subject}
Content: ${emailData.text}`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content || "";
      const leadData = JSON.parse(content) as ExtractedEmailLead;

      // Ensure email is valid
      if (!leadData.senderEmail) {
        return null;
      }

      return leadData;
    } catch (error) {
      console.error("Email lead extraction error:", error);
      return null;
    }
  }

  /**
   * Check if email already exists in database
   */
  static async emailExists(messageId: string): Promise<boolean> {
    const log = await prisma.emailImportLog.findFirst({
      where: { messageId },
    });
    return !!log;
  }

  /**
   * Process email and create lead if qualified
   */
  static async processEmailForLead(
    companyId: string,
    userId: string,
    emailData: EmailData,
    autoCreate: boolean = false
  ): Promise<{
    success: boolean;
    message: string;
    leadId?: string;
    extractedData?: ExtractedEmailLead;
  }> {
    try {
      // Check if already processed
      if (await this.emailExists(emailData.messageId)) {
        return {
          success: false,
          message: "Email already processed",
        };
      }

      // Extract lead from email
      const extractedLead = await this.extractLeadFromEmail(emailData);

      if (!extractedLead) {
        // Log failed extraction
        await prisma.emailImportLog.create({
          data: {
            companyId,
            messageId: emailData.messageId,
            fromEmail: emailData.from,
            toEmail: emailData.to,
            subject: emailData.subject,
            bodyPreview: emailData.text.substring(0, 500),
            status: "FAILED",
            errorMessage: "Could not extract lead data from email",
          },
        });

        return {
          success: false,
          message: "Could not extract lead information from email",
        };
      }

      // Auto-create lead if confidence is high enough
      let leadId: string | undefined;

      if (
        autoCreate &&
        extractedLead.confidence >= 0.7 &&
        extractedLead.senderEmail
      ) {
        try {
          // Check if lead with same email already exists
          const existingLead = await prisma.lead.findFirst({
            where: {
              email: extractedLead.senderEmail,
              companyId,
            },
          });

          if (!existingLead) {
            const newLead = await prisma.lead.create({
              data: {
                contactName: extractedLead.senderName || "Via Email",
                company: extractedLead.senderCompany || "Unknown",
                email: extractedLead.senderEmail,
                companyId,
                assignedToId: userId,
                source: "email_import",
                fromEmail: true,
                emailSubject: emailData.subject,
                emailBody: emailData.text,
                requirements: extractedLead.message,
                aiCredibilityScore: Math.round(extractedLead.confidence * 100),
                aiVerified: extractedLead.confidence > 0.8,
                tags: [extractedLead.inquiryType || "email"].join(","),
              },
            });
            await syncLeadToClientAndContact(prisma, newLead);
            leadId = newLead.id;
          }
        } catch (error) {
          console.error("Lead creation error:", error);
        }
      }

      // Log email import
      await prisma.emailImportLog.create({
        data: {
          companyId,
          messageId: emailData.messageId,
          fromEmail: emailData.from,
          toEmail: emailData.to,
          subject: emailData.subject,
          bodyPreview: emailData.text.substring(0, 500),
          fullBody: emailData.text,
          status: "PROCESSED",
          leadCreated: !!leadId,
          leadId: leadId || null,
          extractedData: extractedLead as any,
        },
      });

      return {
        success: true,
        message: leadId
          ? "Email processed and lead created"
          : "Email processed (no lead created)",
        leadId,
        extractedData: extractedLead,
      };
    } catch (error) {
      console.error("Email processing error:", error);
      return {
        success: false,
        message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Setup email integration and store credentials
   */
  static async setupEmailIntegration(
    companyId: string,
    email: string,
    imapPassword: string,
    imapHost: string,
    imapPort: number = 993
  ): Promise<{
    success: boolean;
    message: string;
    configId?: string;
  }> {
    try {
      // Test connection first
      const testEmails = await this.connectAndFetchEmails(
        email,
        imapPassword,
        imapHost,
        imapPort,
        1
      );

      // Store integration config (password should be encrypted in production)
      const config = await prisma.integrationConfig.create({
        data: {
          companyId,
          integrationType: "EMAIL",
          provider: "IMAP",
          apiKey: email,
          apiSecret: imapPassword, // TODO: Encrypt this
          config: {
            imapHost,
            imapPort,
            lastSyncAt: new Date(),
          },
          isActive: true,
        },
      });

      return {
        success: true,
        message: "Email integration configured successfully",
        configId: config.id,
      };
    } catch (error) {
      return {
        success: false,
        message: `Integration setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Sync emails for all active integrations
   */
  static async syncAllEmailIntegrations(autoCreateLeads: boolean = false): Promise<{
    totalProcessed: number;
    successCount: number;
    failureCount: number;
    leadsCreated: number;
  }> {
    let totalProcessed = 0;
    let successCount = 0;
    let failureCount = 0;
    let leadsCreated = 0;

    try {
      // Get all active email integrations
      const configs = await prisma.integrationConfig.findMany({
        where: {
          integrationType: "EMAIL",
          isActive: true,
        },
        include: { companyRef: true },
      });

      for (const config of configs) {
        try {
          if (!config.apiSecret) continue;

          const imapConfig = config.config as any;
          const emails = await this.connectAndFetchEmails(
            config.apiKey,
            config.apiSecret,
            imapConfig.imapHost || "imap.gmail.com",
            imapConfig.imapPort || 993,
            10
          );

          for (const email of emails) {
            // Get first admin user for assignment
            const admin = await prisma.user.findFirst({
              where: {
                companyId: config.companyId,
                role: "ADMIN",
              },
            });

            if (!admin) continue;

            const result = await this.processEmailForLead(
              config.companyId,
              admin.id,
              email,
              autoCreateLeads
            );

            totalProcessed++;
            if (result.success) {
              successCount++;
              if (result.leadId) leadsCreated++;
            } else {
              failureCount++;
            }
          }

          // Update last sync time
          await prisma.integrationConfig.update({
            where: { id: config.id },
            data: { lastSyncAt: new Date() },
          });
        } catch (error) {
          console.error(`Email sync error for config ${config.id}:`, error);
          failureCount++;
        }
      }
    } catch (error) {
      console.error("Email sync error:", error);
    }

    return {
      totalProcessed,
      successCount,
      failureCount,
      leadsCreated,
    };
  }

  /**
   * Send email via configured SMTP
   */
  static async sendEmail(
    to: string,
    subject: string,
    text: string,
    html?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || "587"),
        secure: process.env.SMTP_SECURE === "true",
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASSWORD,
        },
      });

      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to,
        subject,
        text,
        html,
      });

      return {
        success: true,
        message: "Email sent successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Send failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

export default EmailImportService;
