import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import SocialLeadSyncService from "../services/socialLeadSyncService";
import authMiddleware from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/social/facebook-webhook
 * Webhook receiver for Facebook Lead Ads
 */
router.post("/facebook-webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-hub-signature-256"] as string;
    const payload = JSON.stringify(req.body);

    // Get Facebook integration config to verify signature
    const { entry } = req.body;

    if (!entry || !Array.isArray(entry) || entry.length === 0) {
      return res.sendStatus(200); // Return 200 even if no data
    }

    const firstEntry = entry[0];
    const leadData = firstEntry.changes?.[0]?.value;

    if (!leadData) {
      return res.sendStatus(200);
    }

    // Get company from lead form ID or configuration
    // In production, you'd map form IDs to company IDs
    const config = await prisma.integrationConfig.findFirst({
      where: {
        provider: "FACEBOOK",
        isActive: true,
      },
    });

    if (!config || !config.apiSecret) {
      console.error("Facebook config not found");
      return res.sendStatus(200);
    }

    // Verify signature
    const isValid = SocialLeadSyncService.verifyFacebookWebhookSignature(
      payload,
      signature,
      config.apiSecret
    );

    if (!isValid) {
      console.error("Invalid Facebook webhook signature");
      return res.sendStatus(401);
    }

    // Process lead
    const result = await SocialLeadSyncService.processFacebookLead(
      config.companyId,
      leadData,
      true // Auto-convert
    );

    console.log("Facebook lead processed:", result);

    res.sendStatus(200);
  } catch (error) {
    console.error("Facebook webhook error:", error);
    res.sendStatus(200); // Return 200 to prevent retries
  }
});

/**
 * POST /api/social/instagram-webhook
 * Webhook receiver for Instagram Lead Ads
 */
router.post("/instagram-webhook", async (req: Request, res: Response) => {
  try {
    const signature = req.headers["x-hub-signature-256"] as string;
    const payload = JSON.stringify(req.body);

    const { entry } = req.body;

    if (!entry || !Array.isArray(entry) || entry.length === 0) {
      return res.sendStatus(200);
    }

    const firstEntry = entry[0];
    const leadData = firstEntry.changes?.[0]?.value;

    if (!leadData) {
      return res.sendStatus(200);
    }

    const config = await prisma.integrationConfig.findFirst({
      where: {
        provider: "INSTAGRAM",
        isActive: true,
      },
    });

    if (!config || !config.apiSecret) {
      console.error("Instagram config not found");
      return res.sendStatus(200);
    }

    // Verify signature
    const isValid = SocialLeadSyncService.verifyFacebookWebhookSignature(
      payload,
      signature,
      config.apiSecret
    );

    if (!isValid) {
      console.error("Invalid Instagram webhook signature");
      return res.sendStatus(401);
    }

    // Process lead
    const result = await SocialLeadSyncService.processInstagramLead(
      config.companyId,
      leadData,
      true // Auto-convert
    );

    console.log("Instagram lead processed:", result);

    res.sendStatus(200);
  } catch (error) {
    console.error("Instagram webhook error:", error);
    res.sendStatus(200);
  }
});

/**
 * POST /api/social/setup-facebook
 * Setup Facebook Lead Ads integration
 * Body: { pageAccessToken, pageId, appSecret }
 */
router.post(
  "/setup-facebook",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { pageAccessToken, pageId, appSecret } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "Company not identified",
        });
      }

      if (!pageAccessToken || !pageId || !appSecret) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: pageAccessToken, pageId, appSecret",
        });
      }

      const result = await SocialLeadSyncService.setupFacebookIntegration(
        companyId,
        pageAccessToken,
        pageId,
        appSecret
      );

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/social/setup-instagram
 * Setup Instagram Lead Ads integration
 * Body: { businessAccessToken, businessId, appSecret }
 */
router.post(
  "/setup-instagram",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { businessAccessToken, businessId, appSecret } = req.body;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "Company not identified",
        });
      }

      if (!businessAccessToken || !businessId || !appSecret) {
        return res.status(400).json({
          success: false,
          message:
            "Missing required fields: businessAccessToken, businessId, appSecret",
        });
      }

      const result = await SocialLeadSyncService.setupInstagramIntegration(
        companyId,
        businessAccessToken,
        businessId,
        appSecret
      );

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/social/leads
 * Get social media leads
 * Query: { platform, status, limit, offset }
 */
router.get("/leads", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { platform, status, limit = "20", offset = "0" } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Company not identified",
      });
    }

    const result = await SocialLeadSyncService.getSocialMediaLeads(
      companyId,
      platform as string | undefined,
      status as string | undefined,
      parseInt(limit as string),
      parseInt(offset as string)
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Failed to fetch leads: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/social/convert-lead
 * Convert social media lead to CRM lead
 * Body: { socialLeadId }
 */
router.post(
  "/convert-lead",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { socialLeadId } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!socialLeadId) {
        return res.status(400).json({
          success: false,
          message: "Social lead ID is required",
        });
      }

      const result = await SocialLeadSyncService.convertSocialLeadToCRM(
        socialLeadId,
        userId
      );

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/social/stats
 * Get social lead statistics
 */
router.get(
  "/stats",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "Company not identified",
        });
      }

      const totalLeads = await prisma.socialMediaLead.count({
        where: { companyId },
      });

      const leadsByPlatform = await prisma.socialMediaLead.groupBy({
        by: ["platform"],
        where: { companyId },
        _count: { id: true },
      });

      const leadsByStatus = await prisma.socialMediaLead.groupBy({
        by: ["status"],
        where: { companyId },
        _count: { id: true },
      });

      const convertedLeads = await prisma.socialMediaLead.count({
        where: { companyId, status: "CONVERTED" },
      });

      res.json({
        success: true,
        data: {
          totalLeads,
          convertedLeads,
          conversionRate: totalLeads > 0 ? (convertedLeads / totalLeads * 100).toFixed(2) + '%' : '0%',
          byPlatform: leadsByPlatform,
          byStatus: leadsByStatus,
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to get stats: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

export default router;
