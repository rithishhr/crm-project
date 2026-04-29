import { Prisma, PrismaClient } from "@prisma/client";
import * as https from "https";
import Groq from "groq-sdk";

const prisma = new PrismaClient();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY || "DUMMY_KEY",
});

interface VapiCallConfig {
  assistantId?: string;
  customPrompt?: string;
  maxDuration?: number;
}

interface TwilioCallConfig {
  workspaceId?: string;
  assistantId?: string;
  maxDuration?: number;
}

/**
 * Voice/Call Agent Service
 * Handles integration with Vapi or Twilio for AI-powered phone calls
 */
export class VoiceCallService {
  /**
   * Initialize Vapi call (outbound)
   * https://api.vapi.ai/
   */
  static async initiateVapiCall(
    companyId: string,
    userId: string,
    leadId: string,
    phoneNumber: string,
    config: VapiCallConfig = {}
  ): Promise<{
    success: boolean;
    message: string;
    callId?: string;
  }> {
    try {
      const apiKey = process.env.VAPI_API_KEY;
      if (!apiKey) {
        return {
          success: false,
          message: "Vapi API key not configured",
        };
      }

      const assistantId =
        config.assistantId || process.env.VAPI_ASSISTANT_ID;
      if (!assistantId) {
        return {
          success: false,
          message: "Vapi Assistant not configured",
        };
      }

      // Get lead details
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const customPrompt =
        config.customPrompt ||
        `You are a professional sales representative. You're calling ${lead.contactName} from ${lead.company}. 
Your goal is to introduce our services and qualify their interest. Be friendly and professional.`;

      // Prepare Vapi request
      const vapiPayload = {
        phoneNumber: phoneNumber,
        assistantId: assistantId,
        assistantOverrides: {
          messages: [
            {
              role: "system",
              content: customPrompt,
            },
          ],
        },
        metadata: {
          leadId,
          companyId,
          userId,
          contactName: lead.contactName,
          companyName: lead.company,
        },
      };

      return new Promise((resolve) => {
        const req = https.request(
          {
            hostname: "api.vapi.ai",
            port: 443,
            path: "/call",
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${apiKey}`,
            },
          },
          (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", async () => {
              try {
                const response = JSON.parse(data);

                if (res.statusCode === 200 || res.statusCode === 201) {
                  // Log call
                  const callLog = await prisma.callLog.create({
                    data: {
                      companyId,
                      userId,
                      leadId,
                      phoneNumber,
                      externalCallId: response.id,
                      status: "OUTGOING",
                      provider: "VAPI",
                    },
                  });

                  resolve({
                    success: true,
                    message: "Call initiated successfully",
                    callId: callLog.id,
                  });
                } else {
                  resolve({
                    success: false,
                    message: `Vapi error: ${response.message || "Unknown error"}`,
                  });
                }
              } catch (error) {
                resolve({
                  success: false,
                  message: "Failed to parse Vapi response",
                });
              }
            });
          }
        );

        req.on("error", (error) => {
          resolve({
            success: false,
            message: `Request error: ${error.message}`,
          });
        });

        req.write(JSON.stringify(vapiPayload));
        req.end();
      });
    } catch (error) {
      return {
        success: false,
        message: `Call initiation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Initialize Twilio call
   * https://www.twilio.com/
   */
  static async initiateTwilioCall(
    companyId: string,
    userId: string,
    leadId: string,
    phoneNumber: string,
    config: TwilioCallConfig = {}
  ): Promise<{
    success: boolean;
    message: string;
    callId?: string;
  }> {
    try {
      const accountSid = process.env.TWILIO_ACCOUNT_SID;
      const authToken = process.env.TWILIO_AUTH_TOKEN;
      const fromNumber = process.env.TWILIO_PHONE_NUMBER;

      if (!accountSid || !authToken || !fromNumber) {
        return {
          success: false,
          message: "Twilio credentials not configured",
        };
      }

      // Get lead details
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const auth = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

      const payload = new URLSearchParams({
        To: phoneNumber,
        From: fromNumber,
        Url: `${process.env.BASE_URL}/api/voice/twilio-webhook`,
        Method: "POST",
      }).toString();

      return new Promise((resolve) => {
        const req = https.request(
          {
            hostname: "api.twilio.com",
            port: 443,
            path: `/2010-04-01/Accounts/${accountSid}/Calls.json`,
            method: "POST",
            headers: {
              Authorization: `Basic ${auth}`,
              "Content-Type": "application/x-www-form-urlencoded",
              "Content-Length": Buffer.byteLength(payload),
            },
          },
          (res) => {
            let data = "";

            res.on("data", (chunk) => {
              data += chunk;
            });

            res.on("end", async () => {
              try {
                const response = JSON.parse(data);

                if (res.statusCode === 201) {
                  // Log call
                  const callLog = await prisma.callLog.create({
                    data: {
                      companyId,
                      userId,
                      leadId,
                      phoneNumber,
                      externalCallId: response.sid,
                      status: "OUTGOING",
                      provider: "TWILIO",
                    },
                  });

                  resolve({
                    success: true,
                    message: "Call initiated successfully",
                    callId: callLog.id,
                  });
                } else {
                  resolve({
                    success: false,
                    message: `Twilio error: ${response.message || "Unknown error"}`,
                  });
                }
              } catch (error) {
                resolve({
                  success: false,
                  message: "Failed to parse Twilio response",
                });
              }
            });
          }
        );

        req.on("error", (error) => {
          resolve({
            success: false,
            message: `Request error: ${error.message}`,
          });
        });

        req.write(payload);
        req.end();
      });
    } catch (error) {
      return {
        success: false,
        message: `Call initiation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Generic call initiation (auto-detects provider)
   */
  static async initiateCall(
    companyId: string,
    userId: string,
    leadId: string,
    phoneNumber: string,
    provider: "VAPI" | "TWILIO" = "VAPI"
  ): Promise<{
    success: boolean;
    message: string;
    callId?: string;
  }> {
    if (provider === "TWILIO") {
      return this.initiateTwilioCall(companyId, userId, leadId, phoneNumber);
    } else {
      return this.initiateVapiCall(companyId, userId, leadId, phoneNumber);
    }
  }

  /**
   * Generate call transcript using AI
   */
  static async generateTranscript(
    audioUrl: string
  ): Promise<{
    success: boolean;
    transcript?: string;
    summary?: string;
    sentiment?: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
    actionItems?: string[];
  }> {
    try {
      // In production, use speech-to-text service (e.g., AWS Transcribe, Google Speech-to-Text)
      // For now, this is a placeholder

      return {
        success: true,
        transcript: "Call transcript would be generated from audio",
        summary: "Summary of call would be generated",
        sentiment: "POSITIVE",
        actionItems: [],
      };
    } catch (error) {
      return {
        success: false,
      };
    }
  }

  /**
   * Analyze call using AI
   */
  static async analyzeCall(transcript: string): Promise<{
    summary: string;
    sentiment: "POSITIVE" | "NEUTRAL" | "NEGATIVE";
    keyPoints: string[];
    actionItems: string[];
  }> {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "system",
            content: `Analyze this call transcript and provide:
1. A brief summary (2-3 sentences)
2. Overall sentiment (POSITIVE, NEUTRAL, or NEGATIVE)
3. Key discussion points (3-5 bullet points)
4. Action items (if any)

Return as JSON: {
  "summary": "...",
  "sentiment": "POSITIVE|NEUTRAL|NEGATIVE",
  "keyPoints": ["...", "..."],
  "actionItems": ["...", "..."]
}`,
          },
          {
            role: "user",
            content: `Call transcript:\n\n${transcript}`,
          },
        ],
        temperature: 0.5,
        max_tokens: 1024,
      });

      const content = response.choices[0]?.message?.content || "{}";
      return JSON.parse(content);
    } catch (error) {
      console.error("Call analysis error:", error);
      return {
        summary: "Analysis failed",
        sentiment: "NEUTRAL",
        keyPoints: [],
        actionItems: [],
      };
    }
  }

  /**
   * Log call completion and update status
   */
  static async completeCall(
    callLogId: string,
    duration: number,
    transcript?: string,
    recordingUrl?: string
  ): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      const callLog = await prisma.callLog.findUnique({
        where: { id: callLogId },
      });

      if (!callLog) {
        return {
          success: false,
          message: "Call log not found",
        };
      }

      let analysis = null;
      if (transcript) {
        analysis = await this.analyzeCall(transcript);
      }

      await prisma.callLog.update({
        where: { id: callLogId },
        data: {
          duration,
          status: "COMPLETED",
          recordingUrl: recordingUrl || null,
          transcript: transcript || null,
          summary: analysis?.summary || null,
          sentiment: analysis?.sentiment || null,
          actionItems: analysis?.actionItems || Prisma.JsonNull,
        },
      });

      // Create activity log
      if (callLog.leadId) {
        await prisma.activity.create({
          data: {
            type: "CALL",
            description: `Call completed with ${callLog.phoneNumber}. Duration: ${duration}s. ${analysis?.summary || ""}`,
            contact: callLog.phoneNumber,
            createdById: callLog.userId,
            companyId: callLog.companyId,
          },
        });
      }

      return {
        success: true,
        message: "Call logged successfully",
      };
    } catch (error) {
      return {
        success: false,
        message: `Failed to log call: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get call history for a lead
   */
  static async getCallHistory(
    leadId: string
  ): Promise<Array<{
    id: string;
    duration: number;
    status: string;
    createdAt: Date;
    summary?: string | null;
    sentiment?: string | null;
  }>> {
    try {
      const calls = await prisma.callLog.findMany({
        where: { leadId },
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          duration: true,
          status: true,
          createdAt: true,
          summary: true,
          sentiment: true,
        },
      });

      return calls;
    } catch (error) {
      console.error("Get call history error:", error);
      return [];
    }
  }

  /**
   * Schedule follow-up call
   */
  static async scheduleFollowUpCall(
    leadId: string,
    userId: string,
    scheduledFor: Date,
    notes?: string
  ): Promise<{
    success: boolean;
    message: string;
    taskId?: string;
  }> {
    try {
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead) {
        return {
          success: false,
          message: "Lead not found",
        };
      }

      const task = await prisma.task.create({
        data: {
          title: `Follow-up call with ${lead.contactName}`,
          dueDate: scheduledFor,
          priority: "HIGH",
          status: "TODO",
          relatedTo: leadId,
          assignedToId: userId,
          companyId: lead.companyId,
        },
      });

      return {
        success: true,
        message: "Follow-up call scheduled",
        taskId: task.id,
      };
    } catch (error) {
      return {
        success: false,
        message: `Scheduling failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }
}

export default VoiceCallService;
