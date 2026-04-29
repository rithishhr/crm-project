import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import EmailImportService from "../services/emailImportService";
import authMiddleware from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/email-import/setup
 * Setup email integration (IMAP connection)
 * Body: { email, password, imapHost, imapPort }
 */
router.post("/setup", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { email, password, imapHost, imapPort } = req.body;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Company not identified",
      });
    }

    if (!email || !password || !imapHost) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: email, password, imapHost",
      });
    }

    const result = await EmailImportService.setupEmailIntegration(
      companyId,
      email,
      password,
      imapHost,
      imapPort || 993
    );

    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/email-import/sync
 * Manually trigger email sync
 * Body: { autoCreateLeads?: boolean }
 */
router.post("/sync", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { autoCreateLeads } = req.body;

    const result = await EmailImportService.syncAllEmailIntegrations(
      autoCreateLeads || false
    );

    res.json({
      success: true,
      message: "Email sync completed",
      data: result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Sync failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/email-import/process-email
 * Process a single email and extract lead
 * Body: { from, to, subject, text, messageId, autoCreate }
 */
router.post(
  "/process-email",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { from, to, subject, text, messageId, autoCreate } = req.body;
      const userId = req.user?.id;
      const companyId = req.user?.companyId;

      if (!userId || !companyId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!from || !subject || !text || !messageId) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: from, subject, text, messageId",
        });
      }

      const result = await EmailImportService.processEmailForLead(
        companyId,
        userId,
        {
          from,
          to: to || "",
          subject,
          text,
          messageId,
        },
        autoCreate || false
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/email-import/fetch-emails
 * Fetch emails from connected account
 * Body: { maxEmails?: number }
 */
router.post(
  "/fetch-emails",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { maxEmails } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "Company not identified",
        });
      }

      // Get email integration config
      const config = await prisma.integrationConfig.findFirst({
        where: {
          companyId,
          integrationType: "EMAIL",
          isActive: true,
        },
      });

      if (!config || !config.apiSecret) {
        return res.status(404).json({
          success: false,
          message: "Email integration not configured",
        });
      }

      const imapConfig = config.config as any;
      const emails = await EmailImportService.connectAndFetchEmails(
        config.apiKey,
        config.apiSecret,
        imapConfig.imapHost || "imap.gmail.com",
        imapConfig.imapPort || 993,
        maxEmails || 10
      );

      res.json({
        success: true,
        emailCount: emails.length,
        emails: emails.map((e) => ({
          from: e.from,
          to: e.to,
          subject: e.subject,
          preview: e.text.substring(0, 200),
          messageId: e.messageId,
        })),
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Fetch failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/email-import/test-connection
 * Test email connection
 * Body: { email, password, imapHost, imapPort }
 */
router.post(
  "/test-connection",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { email, password, imapHost, imapPort } = req.body;

      if (!email || !password || !imapHost) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields",
        });
      }

      const emails = await EmailImportService.connectAndFetchEmails(
        email,
        password,
        imapHost,
        imapPort || 993,
        1
      );

      res.json({
        success: true,
        message: "Connection successful",
        emailsFetched: emails.length,
      });
    } catch (error) {
      res.status(400).json({
        success: false,
        message: `Connection failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/email-import/logs
 * Get email import logs
 * Query: { limit, offset, status }
 */
router.get("/logs", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { limit = "20", offset = "0", status } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Company not identified",
      });
    }

    const where: any = { companyId };
    if (status) {
      where.status = status;
    }

    const logs = await prisma.emailImportLog.findMany({
      where,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.emailImportLog.count({ where });

    res.json({
      success: true,
      data: logs,
      pagination: {
        total,
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
      },
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch logs: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/email-import/send
 * Send email
 * Body: { to, subject, text, html }
 */
router.post("/send", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { to, subject, text, html } = req.body;

    if (!to || !subject || !text) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: to, subject, text",
      });
    }

    const result = await EmailImportService.sendEmail(
      to,
      subject,
      text,
      html
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Send failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

export default router;
