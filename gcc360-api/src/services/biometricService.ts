import { PrismaClient } from "@prisma/client";
import { signAccessToken, signRefreshToken } from "../lib/jwt";

const prisma = new PrismaClient();

interface FaceDescriptor {
  descriptor: number[];
  confidence: number;
}

interface BiometricAuthRequest {
  userId: string;
  faceDescriptor: number[];
  confidence: number;
}

interface BiometricAuthResponse {
  success: boolean;
  message: string;
  token?: string;
  refreshToken?: string;
}

/**
 * Biometric Service - Handles face recognition authentication
 * Integrates with face-api.js from frontend
 */

export class BiometricService {
  /**
   * Enroll a new biometric face for a user
   */
  static async enrollBiometric(
    userId: string,
    faceDescriptor: number[],
    confidenceScore: number
  ): Promise<{
    success: boolean;
    message: string;
    recordId?: string;
  }> {
    try {
      if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
        return {
          success: false,
          message:
            "Invalid face descriptor. Must be a 128-dimensional array from face-api.js",
        };
      }

      if (confidenceScore < 0.6) {
        return {
          success: false,
          message: `Face confidence too low (${(confidenceScore * 100).toFixed(2)}%). Please try again with better lighting.`,
        };
      }

      // Check if user already has a biometric record
      const existingRecord = await prisma.biometricRecord.findFirst({
        where: { userId },
        orderBy: { createdAt: "desc" },
      });

      // If replacing, mark old one as inactive
      if (existingRecord) {
        await prisma.biometricRecord.update({
          where: { id: existingRecord.id },
          data: { status: "INACTIVE" },
        });
      }

      // Create new biometric record
      const record = await prisma.biometricRecord.create({
        data: {
          userId,
          faceDescriptor: faceDescriptor,
          confidenceScore,
          enrollmentDate: new Date(),
          status: "ACTIVE",
        },
      });

      // Enable biometric login for user
      await prisma.user.update({
        where: { id: userId },
        data: { biometricEnabled: true },
      });

      return {
        success: true,
        message: "Biometric enrollment successful",
        recordId: record.id,
      };
    } catch (error) {
      console.error("Biometric enrollment error:", error);
      return {
        success: false,
        message: `Enrollment failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Calculate Euclidean distance between two face descriptors
   * Used for matching - lower distance = better match
   */
  private static euclideanDistance(
    a: number[],
    b: number[]
  ): number {
    let sum = 0;
    for (let i = 0; i < a.length; i++) {
      const diff = a[i] - b[i];
      sum += diff * diff;
    }
    return Math.sqrt(sum);
  }

  /**
   * Authenticate user using facial recognition
   * Uses Euclidean distance threshold of 0.6 (industry standard)
   */
  static async authenticateWithBiometric(
    userId: string,
    faceDescriptor: number[]
  ): Promise<BiometricAuthResponse> {
    try {
      if (!Array.isArray(faceDescriptor) || faceDescriptor.length !== 128) {
        return {
          success: false,
          message:
            "Invalid face descriptor format. Expected 128-dimensional array.",
        };
      }

      // Get active biometric record for user
      const userRecord = await prisma.biometricRecord.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

      if (!userRecord) {
        return {
          success: false,
          message: "Biometric enrollment not found. Please enroll first.",
        };
      }

      // Calculate distance between submitted and stored descriptor
      const storedDescriptor = userRecord.faceDescriptor as number[];
      const distance = this.euclideanDistance(
        faceDescriptor,
        storedDescriptor
      );

      // Calibrated threshold for real-world webcam variance.
      // Keep strict enough to reject different faces while reducing false rejects for enrolled users.
      const DISTANCE_THRESHOLD = 0.75;
      const matchConfidence = Math.max(0, 1 - distance / DISTANCE_THRESHOLD);

      // Log authentication attempt
      await prisma.biometricRecord.update({
        where: { id: userRecord.id },
        data: {
          lastUsed: new Date(),
          ...(distance <= DISTANCE_THRESHOLD
            ? { successCount: { increment: 1 } }
            : { failureCount: { increment: 1 } }),
        },
      });

      // If distance is too large, authentication failed
      if (distance > DISTANCE_THRESHOLD) {
        console.log(
          `Face not recognized. Distance: ${distance.toFixed(4)}, Threshold: ${DISTANCE_THRESHOLD}`
        );
        return {
          success: false,
          message: `Face not recognized (confidence: ${(matchConfidence * 100).toFixed(1)}%). Please try again.`,
        };
      }

      // Get user details for token generation
      const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          companyId: true,
          isFirstLogin: true,
        },
      });

      if (!user) {
        return {
          success: false,
          message: "User not found",
        };
      }

      // Generate JWT tokens using shared helpers so payload shape and secrets match
      const payload = { userId: user.id, role: user.role, companyId: user.companyId, isFirstLogin: user.isFirstLogin }
      const accessToken = signAccessToken(payload)
      const refreshToken = signRefreshToken(payload)

      // Store refresh token (use upsert to avoid unique constraint errors)
      const expiresAt = new Date()
      expiresAt.setDate(expiresAt.getDate() + 7)

      await prisma.refreshToken.upsert({
        where: { token: refreshToken },
        update: { expiresAt },
        create: { token: refreshToken, userId, expiresAt },
      })

      // Update last login
      await prisma.user.update({
        where: { id: userId },
        data: { lastLogin: new Date() },
      });

      return {
        success: true,
        message: `Authentication successful (confidence: ${(matchConfidence * 100).toFixed(1)}%)`,
        token: accessToken,
        refreshToken: refreshToken,
      };
    } catch (error) {
      console.error("Biometric authentication error:", error);
      return {
        success: false,
        message: `Authentication failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Verify biometric match without full authentication
   * Useful for security confirmations, sensitive operations
   */
  static async verifyBiometric(
    userId: string,
    faceDescriptor: number[]
  ): Promise<{
    verified: boolean;
    confidence: number;
    message: string;
  }> {
    try {
      const userRecord = await prisma.biometricRecord.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

      if (!userRecord) {
        return {
          verified: false,
          confidence: 0,
          message: "No biometric record found",
        };
      }

      const storedDescriptor = userRecord.faceDescriptor as number[];
      const distance = this.euclideanDistance(
        faceDescriptor,
        storedDescriptor
      );
      const DISTANCE_THRESHOLD = 0.75;
      const confidence = Math.max(0, 1 - distance / DISTANCE_THRESHOLD);

      return {
        verified: distance <= DISTANCE_THRESHOLD,
        confidence,
        message:
          distance <= DISTANCE_THRESHOLD
            ? "Face verified"
            : "Face not recognized",
      };
    } catch (error) {
      console.error("Biometric verification error:", error);
      return {
        verified: false,
        confidence: 0,
        message: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Disable biometric authentication for user
   */
  static async disableBiometric(userId: string): Promise<{
    success: boolean;
    message: string;
  }> {
    try {
      await prisma.biometricRecord.updateMany({
        where: { userId },
        data: { status: "INACTIVE" },
      });

      await prisma.user.update({
        where: { id: userId },
        data: { biometricEnabled: false },
      });

      return {
        success: true,
        message: "Biometric authentication disabled",
      };
    } catch (error) {
      console.error("Disable biometric error:", error);
      return {
        success: false,
        message: `Failed to disable biometric: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Get biometric statistics for a user
   */
  static async getBiometricStats(userId: string): Promise<{
    enabled: boolean;
    enrollmentDate?: Date;
    successCount: number;
    failureCount: number;
    successRate: number;
    lastUsed?: Date;
  }> {
    try {
      const record = await prisma.biometricRecord.findFirst({
        where: { userId, status: "ACTIVE" },
        orderBy: { createdAt: "desc" },
      });

      if (!record) {
        return {
          enabled: false,
          successCount: 0,
          failureCount: 0,
          successRate: 0,
        };
      }

      const total = record.successCount + record.failureCount;
      const successRate = total > 0 ? record.successCount / total : 0;

      return {
        enabled: true,
        enrollmentDate: record.enrollmentDate,
        successCount: record.successCount,
        failureCount: record.failureCount,
        successRate: successRate * 100,
        lastUsed: record.lastUsed || undefined,
      };
    } catch (error) {
      console.error("Get biometric stats error:", error);
      return {
        enabled: false,
        successCount: 0,
        failureCount: 0,
        successRate: 0,
      };
    }
  }

  /**
   * Batch verify multiple users for security incidents
   * Flags suspicious activity
   */
  static async flagSuspiciousActivity(
    biometricRecordId: string
  ): Promise<void> {
    try {
      const record = await prisma.biometricRecord.findUnique({
        where: { id: biometricRecordId },
      });

      if (record && record.failureCount > 5) {
        await prisma.biometricRecord.update({
          where: { id: biometricRecordId },
          data: { status: "COMPROMISED" },
        });

        // Log security audit
        const user = await prisma.user.findUnique({
          where: { id: record.userId },
        });

        if (user) {
          await prisma.auditLog.create({
            data: {
              userId: record.userId,
              action: "BIOMETRIC_COMPROMISE_DETECTED",
              entityType: "BiometricRecord",
              entityId: biometricRecordId,
              details: {
                failureCount: record.failureCount,
                lastAttempt: new Date(),
              },
            },
          });
        }
      }
    } catch (error) {
      console.error("Flag suspicious activity error:", error);
    }
  }
}

export default BiometricService;
