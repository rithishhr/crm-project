import { Router, Request, Response } from "express";
import multer from "multer";
import * as path from "path";
import * as fs from "fs";
import AILeadIngestionService from "../services/aiLeadIngestionService";
import { AuthRequest } from "../middleware/auth";
import authMiddleware from "../middleware/auth";

const router = Router();

// Setup multer for file uploads
const uploadDir = path.join(process.cwd(), "uploads", "documents");
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const timestamp = Date.now();
    const originalName = path.parse(file.originalname).name;
    const ext = path.extname(file.originalname);
    cb(null, `${originalName}-${timestamp}${ext}`);
  },
});

const fileFilter = (req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  const allowedMimes = [
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ];

  if (allowedMimes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(
      new Error(
        `Invalid file type. Allowed: PDF, DOCX, TXT. Received: ${file.mimetype}`
      )
    );
  }
};

const upload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
  },
});

/**
 * POST /api/ai-lead-ingestion/upload
 * Upload and process a single document
 */
router.post(
  "/upload",
  authMiddleware,
  upload.single("document"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file provided",
        });
      }

      const { companyName } = req.body;
      const userId = req.user?.id;
      const companyId = req.user?.companyId;

      if (!userId || !companyId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const filePath = req.file.path;

      const result = await AILeadIngestionService.processDocumentAndCreateLead(
        filePath,
        companyId,
        userId,
        companyName
      );

      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      if (!result.success) {
        return res.status(400).json(result);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Upload failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/ai-lead-ingestion/batch
 * Upload and process multiple documents
 */
router.post(
  "/batch",
  authMiddleware,
  upload.array("documents", 10),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.files || req.files.length === 0) {
        return res.status(400).json({
          success: false,
          message: "No files provided",
        });
      }

      const userId = req.user?.id;
      const companyId = req.user?.companyId;

      if (!userId || !companyId) {
        return res.status(401).json({
          success: false,
          message: "User not authenticated",
        });
      }

      const filePaths = (req.files as Express.Multer.File[]).map(
        (f) => f.path
      );

      const result = await AILeadIngestionService.batchProcessDocuments(
        filePaths,
        companyId,
        userId
      );

      // Clean up temp files
      for (const filePath of filePaths) {
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Batch processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/ai-lead-ingestion/extract-text
 * Extract text from document without creating lead
 */
router.post(
  "/extract-text",
  authMiddleware,
  upload.single("document"),
  async (req: AuthRequest, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({
          success: false,
          message: "No file provided",
        });
      }

      const filePath = req.file.path;

      const result = await AILeadIngestionService.parseDocument(filePath);

      // Clean up temp file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }

      res.json(result);
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Text extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/ai-lead-ingestion/extract-lead-data
 * Extract lead data from document text
 * Body: { documentText: string }
 */
router.post(
  "/extract-lead-data",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentText, companyContext } = req.body;

      if (!documentText) {
        return res.status(400).json({
          success: false,
          message: "Document text is required",
        });
      }

      const leadData =
        await AILeadIngestionService.extractLeadDataWithAI(
          documentText,
          companyContext
        );

      if (!leadData) {
        return res.status(400).json({
          success: false,
          message:
            "Could not extract valid lead data. Document may not contain required information.",
        });
      }

      // Verify credibility
      const verification =
        await AILeadIngestionService.verifyLeadCredibility(leadData);

      res.json({
        success: true,
        leadData,
        verification,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/ai-lead-ingestion/verify-lead
 * Verify credibility of extracted lead data
 * Body: { leadData: ExtractedLeadData }
 */
router.post(
  "/verify-lead",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { leadData } = req.body;

      if (!leadData) {
        return res.status(400).json({
          success: false,
          message: "Lead data is required",
        });
      }

      const verification =
        await AILeadIngestionService.verifyLeadCredibility(leadData);

      res.json({
        success: true,
        verification,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Verification failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

/**
 * POST /api/ai-lead-ingestion/custom-extract
 * Custom text extraction with user-provided prompt
 * Body: { documentText: string, customPrompt: string }
 */
router.post(
  "/custom-extract",
  authMiddleware,
  async (req: AuthRequest, res: Response) => {
    try {
      const { documentText, customPrompt } = req.body;

      if (!documentText || !customPrompt) {
        return res.status(400).json({
          success: false,
          message: "Document text and custom prompt are required",
        });
      }

      const result = await AILeadIngestionService.extractWithCustomPrompt(
        documentText,
        customPrompt
      );

      res.json({
        success: true,
        result,
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        message: `Custom extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      });
    }
  }
);

export default router;
