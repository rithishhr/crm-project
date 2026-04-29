import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";
import ReportingService from "../services/reportingService";
import authMiddleware from "../middleware/auth";

const router = Router();
const prisma = new PrismaClient();

/**
 * POST /api/reporting/generate-deals-report
 * Generate deals report
 * Body: { filters?: { stage, userId, minValue } }
 */
router.post(
  "/generate-deals-report",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { filters } = req.body;
      const companyId = req.user?.companyId;
      const userId = req.user?.id;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const result = await ReportingService.generateDealsReport(
        companyId,
        filters || {}
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Save report record
      await ReportingService.saveReportRecord(
        companyId,
        null,
        "Deals Report",
        "DEALS",
        result.filePath || "",
        userId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/reporting/generate-finance-report
 * Generate finance report
 */
router.post(
  "/generate-finance-report",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { filters } = req.body;
      const companyId = req.user?.companyId;
      const userId = req.user?.id;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const result = await ReportingService.generateFinanceReport(
        companyId,
        filters || {}
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Save report record
      await ReportingService.saveReportRecord(
        companyId,
        null,
        "Finance Report",
        "FINANCE",
        result.filePath || "",
        userId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/reporting/generate-pipeline-report
 * Generate pipeline report
 */
router.post(
  "/generate-pipeline-report",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { filters } = req.body;
      const companyId = req.user?.companyId;
      const userId = req.user?.id;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const result = await ReportingService.generatePipelineReport(
        companyId,
        filters || {}
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Save report record
      await ReportingService.saveReportRecord(
        companyId,
        null,
        "Pipeline Report",
        "PIPELINE",
        result.filePath || "",
        userId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/reporting/generate-customer-report
 * Generate customer report
 */
router.post(
  "/generate-customer-report",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { filters } = req.body;
      const companyId = req.user?.companyId;
      const userId = req.user?.id;

      if (!companyId || !userId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const result = await ReportingService.generateCustomerReport(
        companyId,
        filters || {}
      );

      if (!result.success) {
        return res.status(400).json(result);
      }

      // Save report record
      await ReportingService.saveReportRecord(
        companyId,
        null,
        "Customer Report",
        "CUSTOMER",
        result.filePath || "",
        userId
      );

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * GET /api/reporting/generated-reports
 * Get list of generated reports
 * Query: { reportType, limit, offset }
 */
router.get(
  "/generated-reports",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { reportType, limit = "20", offset = "0" } = req.query;
      const companyId = req.user?.companyId;

      if (!companyId) {
        return res.status(401).json({
          success: false,
          message: "Company not identified",
        });
      }

      const where: any = { companyId };
      if (reportType) {
        where.reportType = reportType;
      }

      const reports = await prisma.generatedReport.findMany({
        where,
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
        orderBy: { generatedAt: "desc" },
      });

      const total = await prisma.generatedReport.count({ where });

      res.json({
        success: true,
        data: reports,
        pagination: {
          total,
          limit: parseInt(limit as string),
          offset: parseInt(offset as string),
        },
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to fetch reports: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * DELETE /api/reporting/reports/:reportId
 * Delete a generated report
 */
router.delete(
  "/reports/:reportId",
  authMiddleware,
  async (req: Request, res: Response) => {
    try {
      const { reportId } = req.params;

      const report = await prisma.generatedReport.findUnique({
        where: { id: reportId },
      });

      if (!report) {
        return res.status(404).json({
          success: false,
          message: "Report not found",
        });
      }

      // Delete file
      const fs = await import("fs");
      if (fs.existsSync(report.filePath)) {
        fs.unlinkSync(report.filePath);
      }

      // Delete record
      await prisma.generatedReport.delete({
        where: { id: reportId },
      });

      res.json({
        success: true,
        message: "Report deleted successfully",
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Failed to delete report: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

export default router;
