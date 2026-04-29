import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import BiometricService from "../services/biometricService";
import { AuthRequest } from "../middleware/auth";
import authMiddleware from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/biometric/enroll
 * Enroll user's face for biometric authentication
 * Body: { userId, faceDescriptor: number[], confidence: number }
 */
router.post("/enroll", authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const { userId, faceDescriptor, confidence } = req.body;

    if (!userId || !faceDescriptor || confidence === undefined) {
      return res.status(400).json({
        success: false,
        message:
          "Missing required fields: userId, faceDescriptor, confidence",
      });
    }

    // Verify user owns the enrollment
    if (req.user?.id !== userId) {
      return res.status(403).json({
        success: false,
        message: "Cannot enroll biometric for another user",
      });
    }

    const result = await BiometricService.enrollBiometric(
      userId,
      faceDescriptor,
      confidence
    );

    res.status(result.success ? 201 : 400).json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Enrollment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/biometric/authenticate
 * Authenticate user with face recognition
 * Body: { userId, faceDescriptor: number[] }
 * Returns: { success, token, refreshToken }
 */
router.post("/authenticate", async (req: Request, res: Response) => {
  try {
    const { userId, faceDescriptor } = req.body;

    if (!userId || !faceDescriptor) {
      return res.status(400).json({
        success: false,
        message: "Missing required fields: userId, faceDescriptor",
      });
    }

    const result = await BiometricService.authenticateWithBiometric(
      userId,
      faceDescriptor
    );

    if (!result.success) {
      return res.status(401).json(result);
    }

    // Set refresh token in httpOnly cookie
    res.cookie("refreshToken", result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.json({
      success: true,
      message: result.message,
      token: result.token,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    });
  }
});

/**
 * POST /api/biometric/verify
 * Verify biometric without full authentication
 * Body: { userId, faceDescriptor: number[] }
 */
router.post(
  "/verify",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId, faceDescriptor } = req.body;

      if (!userId || !faceDescriptor) {
        return res.status(400).json({
          success: false,
          message: "Missing required fields: userId, faceDescriptor",
        });
      }

      const result = await BiometricService.verifyBiometric(
        userId,
        faceDescriptor
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        verified: false,
        confidence: 0,
        message: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/biometric/status/:userId
 * Get biometric status and statistics for user
 */
router.get(
  "/status/:userId",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { userId } = req.params;

      // Verify user accessing their own data
      if (req.user?.id !== userId) {
        return res.status(403).json({
          success: false,
          message: "Cannot access another user's biometric data",
        });
      }

      const stats = await BiometricService.getBiometricStats(userId);

      res.json({
        success: true,
        data: stats,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to get biometric status: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * DELETE /api/biometric/disable
 * Disable biometric authentication for user
 */
router.delete(
  "/disable",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const userId = req.user?.id;

      if (!userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const result = await BiometricService.disableBiometric(userId);

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to disable biometric: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/biometric/enrollment-check/:userId
 * Check if user has biometric enrollment
 */
router.get(
  "/enrollment-check/:userId",
  async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;

      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { biometricEnabled: true },
      });

      res.json({
        success: true,
        enrolled: user?.biometricEnabled || false,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Check failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

export default router;
