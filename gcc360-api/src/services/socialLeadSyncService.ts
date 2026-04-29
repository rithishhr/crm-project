import { Prisma, PrismaClient } from "@prisma/client";
import * as crypto from "crypto";

const prisma = new PrismaClient();

interface FacebookLeadData {
  created_time: string;
  id: string;
  ad_id?: string;
  ad_name?: string;
  adset_id?: string;
  adset_name?: string;
  campaign_id?: string;
  campaign_name?: string;
  form_id?: string;
  form_name?: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

interface InstagramLeadData {
  created_time: string;
  id: string;
  campaign_id?: string;
  campaign_name?: string;
  field_data: Array<{
    name: string;
    values: string[];
  }>;
}

/**
 * Social Lead Sync Service
 * Handles Facebook/Instagram Lead Ads webhooks and lead creation
 */
export class SocialLeadSyncService {
  /**
   * Verify Facebook webhook signature
   */
  static verifyFacebookWebhookSignature(
    payload: string,
    signature: string,
    appSecret: string
  ): boolean {
    const hash = crypto
      .createHmac("sha256", appSecret)
      .update(payload)
      .digest("hex");

    return hash === signature;
  }

  /**
   * Process Facebook Lead Ads webhook
   */
  static async processFacebookLead(
    companyId: string,
    leadData: FacebookLeadData,
    autoConvert: boolean = false
  ): Promise<{
    success: boolean;
    leadId?: string;
    message: string;
  }> {
    try {
      // Extract field data
      const fieldMap: { [key: string]: string } = {};

      leadData.field_data.forEach((field) => {
        const value = field.values[0] || "";
        fieldMap[field.name.toLowerCase()] = value;
      });

      // Map Facebook fields to lead fields
      const firstName = fieldMap["first_name"] || "";
      const lastName = fieldMap["last_name"] || "";
      const email = fieldMap["email"] || "";
      const phone = fieldMap["phone_number"] || "";
      const companyName = fieldMap["company"] || fieldMap["business_name"] || "Unknown";

      if (!email && !phone) {
        return {
          success: false,
          message: "No email or phone number found in lead data",
        };
      }

      // Check for duplicate
      const existingLead = await prisma.socialMediaLead.findFirst({
        where: {
          platform: "FACEBOOK",
          externalLeadId: leadData.id,
        },
      });

      if (existingLead) {
        return {
          success: false,
          message: "Lead already processed",
        };
      }

      // Create social media lead record
      const socialLead = await prisma.socialMediaLead.create({
        data: {
          companyId,
          platform: "FACEBOOK",
          externalLeadId: leadData.id,
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          phone: phone || null,
          company: companyName,
          campaignId: leadData.campaign_id || null,
          campaignName: leadData.campaign_name || null,
          leadFormId: leadData.form_id || null,
          metadata: leadData as unknown as Prisma.InputJsonValue,
          receivedAt: new Date(leadData.created_time),
          status: "PENDING",
        },
      });

      let leadId: string | undefined;

      // Auto-convert to lead if enabled
      if (autoConvert && email) {
        // Get first admin for assignment
        const admin = await prisma.user.findFirst({
          where: {
            companyId,
            role: "ADMIN",
          },
        });

        if (admin) {
          const newLead = await prisma.lead.create({
            data: {
              contactName: `${firstName} ${lastName}`.trim() || "Via Facebook",
              company: companyName,
              email,
              phone: phone || null,
              companyId,
              assignedToId: admin.id,
              source: "facebook_lead_ads",
              aiCredibilityScore: 50, // Facebook leads are generally qualified
              aiVerified: true,
              tags: `facebook,${leadData.campaign_name || ""}`.trim(),
            },
          });

          leadId = newLead.id;

          // Update social lead record
          await prisma.socialMediaLead.update({
            where: { id: socialLead.id },
            data: {
              createdLeadId: leadId,
              syncedToLeads: true,
              status: "CONVERTED",
              processedAt: new Date(),
            },
          });
        }
      }

      return {
        success: true,
        leadId,
        message: leadId
          ? "Lead created from Facebook Lead Ad"
          : "Facebook lead recorded, awaiting conversion",
      };
    } catch (error) {
      return {
        success: false,
        message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Process Instagram Lead Ads webhook
   */
  static async processInstagramLead(
    companyId: string,
    leadData: InstagramLeadData,
    autoConvert: boolean = false
  ): Promise<{
    success: boolean;
    leadId?: string;
    message: string;
  }> {
    try {
      // Extract field data
      const fieldMap: { [key: string]: string } = {};

      leadData.field_data.forEach((field) => {
        const value = field.values[0] || "";
        fieldMap[field.name.toLowerCase()] = value;
      });

      // Map Instagram fields
      const firstName = fieldMap["first_name"] || fieldMap["name"] || "";
      const lastName = fieldMap["last_name"] || "";
      const email = fieldMap["email"] || "";
      const phone = fieldMap["phone_number"] || "";
      const companyName = fieldMap["company"] || fieldMap["business_name"] || "Unknown";

      if (!email && !phone) {
        return {
          success: false,
          message: "No email or phone number found in lead data",
        };
      }

      // Check for duplicate
      const existingLead = await prisma.socialMediaLead.findFirst({
        where: {
          platform: "INSTAGRAM",
          externalLeadId: leadData.id,
        },
      });

      if (existingLead) {
        return {
          success: false,
          message: "Lead already processed",
        };
      }

      // Create social media lead record
      const socialLead = await prisma.socialMediaLead.create({
        data: {
          companyId,
          platform: "INSTAGRAM",
          externalLeadId: leadData.id,
          firstName: firstName || null,
          lastName: lastName || null,
          email: email || null,
          phone: phone || null,
          company: companyName,
          campaignId: leadData.campaign_id || null,
          campaignName: leadData.campaign_name || null,
          metadata: leadData as unknown as Prisma.InputJsonValue,
          receivedAt: new Date(leadData.created_time),
          status: "PENDING",
        },
      });

      let leadId: string | undefined;

      // Auto-convert to lead if enabled
      if (autoConvert && email) {
        const admin = await prisma.user.findFirst({
          where: {
            companyId,
            role: "ADMIN",
          },
        });

        if (admin) {
          const newLead = await prisma.lead.create({
            data: {
              contactName: `${firstName} ${lastName}`.trim() || "Via Instagram",
              company: companyName,
              email,
              phone: phone || null,
              companyId,
              assignedToId: admin.id,
              source: "instagram_lead_ads",
              aiCredibilityScore: 45,
              aiVerified: true,
              tags: `instagram,${leadData.campaign_name || ""}`.trim(),
            },
          });

          leadId = newLead.id;

          await prisma.socialMediaLead.update({
            where: { id: socialLead.id },
            data: {
              createdLeadId: leadId,
              syncedToLeads: true,
              status: "CONVERTED",
              processedAt: new Date(),
            },
          });
        }
      }

      return {
        success: true,
        leadId,
        message: leadId
          ? "Lead created from Instagram Lead Ad"
          : "Instagram lead recorded, awaiting conversion",
      };
    } catch (error) {
      return {
        success: false,
        message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Setup Facebook Lead Ads integration
   */
  static async setupFacebookIntegration(
    companyId: string,
    pageAccessToken: string,
    pageId: string,
    appSecret: string
  ): Promise<{
    success: boolean;
    configId?: string;
    message: string;
  }> {
    try {
      // Verify token and get page details
      const config = await prisma.integrationConfig.create({
        data: {
          companyId,
          integrationType: "SOCIAL",
          provider: "FACEBOOK",
          apiKey: pageAccessToken,
          apiSecret: appSecret,
          webhookUrl: `${process.env.BASE_URL}/api/social/facebook-webhook`,
          config: {
            pageId,
            leadFormsConnected: [],
          },
          isActive: true,
        },
      });

      return {
        success: true,
        configId: config.id,
        message: "Facebook integration configured successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Setup Instagram Lead Ads integration
   */
  static async setupInstagramIntegration(
    companyId: string,
    businessAccessToken: string,
    businessId: string,
    appSecret: string
  ): Promise<{
    success: boolean,
    configId?: string;
    message: string;
  }> {
    try {
      const config = await prisma.integrationConfig.create({
        data: {
          companyId,
          integrationType: "SOCIAL",
          provider: "INSTAGRAM",
          apiKey: businessAccessToken,
          apiSecret: appSecret,
          webhookUrl: `${process.env.BASE_URL}/api/social/instagram-webhook`,
          config: {
            businessId,
          },
          isActive: true,
        },
      });

      return {
        success: true,
        configId: config.id,
        message: "Instagram integration configured successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Setup failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get social media leads for company
   */
  static async getSocialMediaLeads(
    companyId: string,
    platform?: string,
    status?: string,
    limit: number = 20,
    offset: number = 0
  ) {
    try {
      const where: any = { companyId };
      if (platform) where.platform = platform;
      if (status) where.status = status;

      const leads = await prisma.socialMediaLead.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: { receivedAt: "desc" },
      });

      const total = await prisma.socialMediaLead.count({ where });

      return {
        success: true,
        data: leads,
        pagination: { total, limit, offset },
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to fetch leads: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Convert social media lead to CRM lead
   */
  static async convertSocialLeadToCRM(
    socialLeadId: string,
    userId: string
  ): Promise<{
    success: boolean;
    leadId?: string;
    message: string;
  }> {
    try {
      const socialLead = await prisma.socialMediaLead.findUnique({
        where: { id: socialLeadId },
      });

      if (!socialLead) {
        return {
          success: false,
          message: "Social lead not found",
        };
      }

      if (!socialLead.email && !socialLead.phone) {
        return {
          success: false,
          message: "Lead missing email and phone number",
        };
      }

      // Check if already converted
      if (socialLead.createdLeadId) {
        return {
          success: true,
          leadId: socialLead.createdLeadId,
          message: "Lead already converted",
        };
      }

      // Create CRM lead
      const newLead = await prisma.lead.create({
        data: {
          contactName: `${socialLead.firstName || ""} ${socialLead.lastName || ""}`.trim() || "Via Social",
          company: socialLead.company || "Unknown",
          email: socialLead.email || "",
          phone: socialLead.phone || null,
          companyId: socialLead.companyId,
          assignedToId: userId,
          source: `${socialLead.platform.toLowerCase()}_lead_ads`,
          aiCredibilityScore: 50,
          aiVerified: true,
          tags: [
            socialLead.platform.toLowerCase(),
            socialLead.campaignName || "",
          ]
            .filter(Boolean)
            .join(","),
        },
      });

      // Update social lead
      await prisma.socialMediaLead.update({
        where: { id: socialLeadId },
        data: {
          createdLeadId: newLead.id,
          syncedToLeads: true,
          status: "CONVERTED",
          processedAt: new Date(),
        },
      });

      return {
        success: true,
        leadId: newLead.id,
        message: "Lead converted successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Conversion failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

export default SocialLeadSyncService;
