import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import VoiceCallService from "../services/voiceCallService";
import authMiddleware from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/voice/initiate-call
 * Initiate an outbound call
 * Body: { leadId, provider: "VAPI" | "TWILIO" }
 */
router.post(
  "/initiate-call",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { leadId, provider } = req.body;
      const userId = req.user?.id;
      const companyId = req.user?.companyId;

      if (!userId || !companyId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!leadId) {
        return res.status(400).json({
          success: false,
          message: "Lead ID is required",
        });
      }

      // Get lead with phone number
      const lead = await prisma.lead.findUnique({
        where: { id: leadId },
      });

      if (!lead || !lead.phone) {
        return res.status(400).json({
          success: false,
          message: "Lead not found or phone number not available",
        });
      }

      const result = await VoiceCallService.initiateCall(
        companyId,
        userId,
        leadId,
        lead.phone,
        provider || "VAPI"
      );

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Call initiation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/voice/complete-call
 * Mark call as complete and log results
 * Body: { callLogId, duration, transcript, recordingUrl }
 */
router.post(
  "/complete-call",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { callLogId, duration, transcript, recordingUrl } = req.body;

      if (!callLogId || duration === undefined) {
        return res.status(400).json({
          success: false,
          message: "Call Log ID and duration are required",
        });
      }

      const result = await VoiceCallService.completeCall(
        callLogId,
        duration,
        transcript,
        recordingUrl
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to complete call: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/voice/analyze-call
 * Analyze call transcript
 * Body: { transcript: string }
 */
router.post(
  "/analyze-call",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { transcript } = req.body;

      if (!transcript) {
        return res.status(400).json({
          success: false,
          message: "Transcript is required",
        });
      }

      const analysis = await VoiceCallService.analyzeCall(transcript);

      res.json({
        success: true,
        analysis,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/voice/call-history/:leadId
 * Get call history for a lead
 */
router.get(
  "/call-history/:leadId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { leadId } = req.params;

      const history = await VoiceCallService.getCallHistory(leadId);

      res.json({
        success: true,
        data: history,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to get call history: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/voice/schedule-follow-up
 * Schedule a follow-up call
 * Body: { leadId, scheduledFor, notes }
 */
router.post(
  "/schedule-follow-up",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { leadId, scheduledFor, notes } = req.body;
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      if (!leadId || !scheduledFor) {
        return res.status(400).json({
          success: false,
          message: "Lead ID and scheduled time are required",
        });
      }

      const result = await VoiceCallService.scheduleFollowUpCall(
        leadId,
        userId,
        new Date(scheduledFor),
        notes
      );

      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Scheduling failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/voice/vapi-webhook
 * Webhook for Vapi call events
 */
router.post("/vapi-webhook", async (req: Request, res: Response) => {
  try {
    const { event, data } = req.body;

    console.log(`Vapi webhook - Event: ${event}`, data);

    // Handle different event types
    switch (event) {
      case "call.started":
        console.log("Call started:", data.callId);
        break;
      case "call.ended":
        console.log("Call ended:", data.callId);
        if (data.transcript) {
          // Process transcript
        }
        break;
      case "call.failed":
        console.log("Call failed:", data.callId, data.reason);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Webhook processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/voice/twilio-webhook
 * Webhook for Twilio call events
 */
router.post("/twilio-webhook", async (req: Request, res: Response) => {
  try {
    const { CallSid, CallStatus, RecordingUrl, Transcript } = req.body;

    console.log(`Twilio webhook - Call: ${CallSid}, Status: ${CallStatus}`);

    // Handle different call statuses
    switch (CallStatus) {
      case "ringing":
        console.log("Call ringing:", CallSid);
        break;
      case "in-progress":
        console.log("Call in progress:", CallSid);
        break;
      case "completed":
        console.log("Call completed:", CallSid);
        if (RecordingUrl) {
          // Process recording
        }
        break;
      case "failed":
        console.log("Call failed:", CallSid);
        break;
    }

    res.json({ success: true });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Webhook processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * GET /api/voice/call-logs
 * Get call logs with filters
 * Query: { leadId, userId, limit, offset, status }
 */
router.get("/call-logs", authMiddleware, async (req: Request, res: Response) => {
  try {
    const { leadId, userId, limit = "20", offset = "0", status } = req.query;
    const companyId = req.user?.companyId;

    if (!companyId) {
      return res.status(401).json({
        success: false,
        message: "Company not identified",
      });
    }

    const where: any = { companyId };
    if (leadId) where.leadId = leadId;
    if (userId) where.userId = userId;
    if (status) where.status = status;

    const logs = await prisma.callLog.findMany({
      where,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
      orderBy: { createdAt: "desc" },
    });

    const total = await prisma.callLog.count({ where });

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
      message: `Failed to fetch call logs: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

export default router;
