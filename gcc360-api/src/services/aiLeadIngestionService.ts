import { PrismaClient } from "@prisma/client";
import { Groq } from "groq-sdk";
import { extractJSON } from "../lib/aiUtils";
import * as fs from "fs";
import * as path from "path";
import { syncLeadToClientAndContact } from "../lib/leadSync";

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = require("pdf-parse") as (input: Buffer) => Promise<{ text: string }>;
  const pdfData = await pdfParse(buffer);
  return pdfData.text;
}

const prisma = new PrismaClient();
const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY,
});

interface ExtractedLeadData {
  contactName: string;
  company: string;
  email: string;
  phone?: string;
  title?: string;
  industry?: string;
  country?: string;
  value?: number;
  requirements?: string;
  internalNotes?: string;
  confidence: number;
}

/**
 * AI Lead Ingestion Service
 * Handles document parsing (PDF, Word, Text) and AI-powered lead extraction
 */
export class AILeadIngestionService {
  /**
   * Parse PDF file and extract text
   */
  static async parsePDF(filePath: string): Promise<string> {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      return await parsePdfBuffer(fileBuffer);
    } catch (error) {
      console.error("PDF parsing error:", error);
      throw new Error(
        `Failed to parse PDF: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse Word document (.docx) and extract text
   */
  static async parseWordDocument(filePath: string): Promise<string> {
    try {
      const fileBuffer = fs.readFileSync(filePath);
      const mammoth = require("mammoth") as {
        extractRawText: (input: { buffer: Buffer }) => Promise<{ value: string }>;
      };
      const result = await mammoth.extractRawText({ buffer: fileBuffer });
      return result.value;
    } catch (error) {
      console.error("Word document parsing error:", error);
      throw new Error(
        `Failed to parse Word document: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Parse text file
   */
  static async parseTextFile(filePath: string): Promise<string> {
    try {
      return fs.readFileSync(filePath, "utf-8");
    } catch (error) {
      console.error("Text file parsing error:", error);
      throw new Error(
        `Failed to parse text file: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }

  /**
   * Detect file type and parse accordingly
   */
  static async parseDocument(
    filePath: string
  ): Promise<{
    success: boolean;
    text: string;
    format: "pdf" | "docx" | "txt";
    message?: string;
  }> {
    try {
      const ext = path.extname(filePath).toLowerCase();

      let text = "";
      let format: "pdf" | "docx" | "txt" = "txt";

      switch (ext) {
        case ".pdf":
          text = await this.parsePDF(filePath);
          format = "pdf";
          break;
        case ".docx":
          text = await this.parseWordDocument(filePath);
          format = "docx";
          break;
        case ".txt":
          text = await this.parseTextFile(filePath);
          format = "txt";
          break;
        default:
          throw new Error(`Unsupported file format: ${ext}`);
      }

      return {
        success: true,
        text,
        format,
      };
    } catch (error) {
      return {
        success: false,
        text: "",
        format: "txt",
        message: `Document parsing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Use Groq LLM to extract and structure lead data from document text
   */
  static async extractLeadDataWithAI(
    documentText: string,
    companyContext?: string
  ): Promise<ExtractedLeadData | null> {
    try {
      const systemPrompt = `You are an expert lead extraction AI. Extract and structure lead information from the provided document text.

Return ONLY valid JSON (no markdown, no explanation) with these exact fields:
{
  "contactName": "Full name of the contact person",
  "company": "Company name",
  "email": "Email address",
  "phone": "Phone number (optional)",
  "title": "Job title of contact (optional)",
  "industry": "Industry category (optional)",
  "country": "Country (optional)",
  "value": "Estimated deal value in USD (optional, number)",
  "requirements": "Customer requirements or needs",
  "internalNotes": "Internal notes from document",
  "confidence": "Your confidence level 0-1 on how complete/valid this lead data is"
}

IMPORTANT:
- Only extract information that is explicitly mentioned or clearly inferable
- If a field cannot be found, use null instead of making up data
- confidence should be high (0.8+) only if you found most key fields (name, company, email, phone)
- For value field, extract if mentioned, otherwise use null
- Return ONLY the JSON object, nothing else`;

      const userPrompt = `${companyContext ? `Company Context: ${companyContext}\n\n` : ""}Extract lead information from this document:\n\n${documentText.substring(0, 5000)}`;

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

      // Parse JSON response
      const leadData = extractJSON(content) as ExtractedLeadData;

      // Validate required fields
      if (!leadData.contactName || !leadData.company || !leadData.email) {
        return null;
      }

      return leadData;
    } catch (error) {
      console.error("AI extraction error:", error);
      return null;
    }
  }

  /**
   * Verify lead credibility using AI
   */
  static async verifyLeadCredibility(leadData: ExtractedLeadData): Promise<{
    score: number;
    verified: boolean;
    fraudFlags: string[];
  }> {
    try {
      const systemPrompt = `You are a lead credibility verification AI. Analyze the following lead data and return a JSON with:
{
  "score": "credibility score from 0-100",
  "verified": "true if lead seems genuine, false if suspicious",
  "fraudFlags": ["array", "of", "suspicious", "indicators"]
}

Consider:
- Email format validity
- Company name reasonableness
- Phone number format
- Known patterns of fake leads
- Consistency of information

Return ONLY valid JSON.`;

      const userPrompt = `Verify this lead data:\n${JSON.stringify(leadData)}`;

      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
        temperature: 0.2,
        max_tokens: 512,
      });

      const content = response.choices[0]?.message?.content || "{}";
      const verification = extractJSON(content) || {};

      return {
        score: verification.score || 50,
        verified: verification.verified || false,
        fraudFlags: verification.fraudFlags || [],
      };
    } catch (error) {
      console.error("Credibility verification error:", error);
      return {
        score: 0,
        verified: false,
        fraudFlags: ["AI verification failed"],
      };
    }
  }

  /**
   * Process document and create lead
   */
  static async processDocumentAndCreateLead(
    filePath: string,
    companyId: string,
    userId: string,
    companyName?: string
  ): Promise<{
    success: boolean;
    leadId?: string;
    message: string;
    extractedData?: ExtractedLeadData;
    verification?: {
      score: number;
      verified: boolean;
      fraudFlags: string[];
    };
  }> {
    let tempFile = false;

    try {
      // Parse document
      const parseResult = await this.parseDocument(filePath);

      if (!parseResult.success) {
        return {
          success: false,
          message: parseResult.message || "Document parsing failed",
        };
      }

      // Extract lead data using AI
      const extractedData = await this.extractLeadDataWithAI(
        parseResult.text,
        companyName
      );

      if (!extractedData) {
        return {
          success: false,
          message:
            "Could not extract valid lead information from document. Document may not contain lead details.",
        };
      }

      // Verify lead credibility
      const verification = await this.verifyLeadCredibility(extractedData);

      // Create lead in database
      const lead = await prisma.lead.create({
        data: {
          contactName: extractedData.contactName,
          company: extractedData.company,
          email: extractedData.email,
          phone: extractedData.phone || null,
          title: extractedData.title || null,
          industry: extractedData.industry || null,
          country: extractedData.country || null,
          value: extractedData.value ? parseFloat(extractedData.value.toString()) : 0,
          requirements: extractedData.requirements || null,
          internalNotes: extractedData.internalNotes || null,
          companyId,
          assignedToId: userId,
          source: "document_upload",
          aiVerified: verification.verified,
          aiCredibilityScore: verification.score,
          aiFraudFlag: verification.fraudFlags.length > 0,
          aiNotes:
            verification.fraudFlags.length > 0
              ? `Fraud flags: ${verification.fraudFlags.join(", ")}`
              : "AI verified lead",
        },
      });
      await syncLeadToClientAndContact(prisma, lead);

      // Create document record
      await prisma.document.create({
        data: {
          fileName: path.basename(filePath),
          fileUrl: filePath,
          documentType: "LEAD_SOURCE",
          leadId: lead.id,
          userId,
        },
      });

      // Log extraction
      console.log(`Lead created from document: ${lead.id}`);

      return {
        success: true,
        leadId: lead.id,
        message: `Lead created successfully. Credibility score: ${verification.score}%`,
        extractedData,
        verification,
      };
    } catch (error) {
      return {
        success: false,
        message: `Processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    } finally {
      // Clean up temp file if created
      if (tempFile && fs.existsSync(filePath)) {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error("Failed to clean up temp file:", error);
        }
      }
    }
  }

  /**
   * Batch process multiple documents
   */
  static async batchProcessDocuments(
    filePaths: string[],
    companyId: string,
    userId: string
  ): Promise<{
    successful: string[];
    failed: Array<{ file: string; error: string }>;
    summary: {
      totalProcessed: number;
      successCount: number;
      failureCount: number;
    };
  }> {
    const successful: string[] = [];
    const failed: Array<{ file: string; error: string }> = [];

    for (const filePath of filePaths) {
      const result = await this.processDocumentAndCreateLead(
        filePath,
        companyId,
        userId
      );

      if (result.success && result.leadId) {
        successful.push(result.leadId);
      } else {
        failed.push({
          file: path.basename(filePath),
          error: result.message,
        });
      }
    }

    return {
      successful,
      failed,
      summary: {
        totalProcessed: filePaths.length,
        successCount: successful.length,
        failureCount: failed.length,
      },
    };
  }

  /**
   * Extract text with custom prompt
   */
  static async extractWithCustomPrompt(
    documentText: string,
    customPrompt: string
  ): Promise<string> {
    try {
      const response = await groq.chat.completions.create({
        model: "llama-3.3-70b-versatile",
        messages: [
          {
            role: "user",
            content: `${customPrompt}\n\nDocument text:\n${documentText}`,
          },
        ],
        temperature: 0.3,
        max_tokens: 2048,
      });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      throw new Error(
        `Custom extraction failed: ${error instanceof Error ? error.message : "Unknown error"}`
      );
    }
  }
}

export default AILeadIngestionService;
