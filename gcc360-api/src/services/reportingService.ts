import { PrismaClient } from "@prisma/client";
import PDFDocument from "pdfkit";
import * as fs from "fs";
import * as path from "path";

const prisma = new PrismaClient();

interface ReportFilters {
  startDate?: Date;
  endDate?: Date;
  stage?: string;
  userId?: string;
  status?: string;
  minValue?: number;
  maxValue?: number;
}

/**
 * Automated Reporting Service
 * Generates professional PDF reports for various CRM metrics
 */
export class ReportingService {
  /**
   * Generate Deals Report
   */
  static async generateDealsReport(
    companyId: string,
    filters: ReportFilters = {}
  ): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    message: string;
  }> {
    try {
      // Fetch deals data
      const where: any = { companyId };

      if (filters.stage) where.stage = filters.stage;
      if (filters.userId) where.ownerId = filters.userId;
      if (filters.minValue)
        where.value = { gte: parseFloat(filters.minValue.toString()) };

      const deals = await prisma.deal.findMany({
        where,
        include: {
          companyRef: true,
        },
      });

      // Create PDF
      const fileName = `deals-report-${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), "uploads", fileName);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Deals Report", { align: "center" })
        .moveDown();

      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, {
        align: "right",
      });
      doc.moveDown();

      // Summary metrics
      const totalValue = deals.reduce((sum, d) => sum + Number(d.value), 0);
      const avgValue = deals.length > 0 ? totalValue / deals.length : 0;

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Summary Metrics")
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Total Deals: ${deals.length}`)
        .text(`Total Value: $${totalValue.toFixed(2)}`)
        .text(`Average Value: $${avgValue.toFixed(2)}`)
        .moveDown();

      // Deals table
      if (deals.length > 0) {
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("Deals Breakdown")
          .moveDown(0.5);

        doc.fontSize(10).font("Helvetica-Bold");
        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 150;
        const col3X = 250;
        const col4X = 350;
        const col5X = 450;

        doc.text("Deal", col1X, tableTop);
        doc.text("Company", col2X, tableTop);
        doc.text("Stage", col3X, tableTop);
        doc.text("Value", col4X, tableTop);
        doc.text("Close Date", col5X, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        doc.fontSize(9).font("Helvetica");
        let rowY = tableTop + 25;

        deals.forEach((deal) => {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          doc.text(deal.title.substring(0, 15), col1X, rowY);
          doc.text(deal.company.substring(0, 15), col2X, rowY);
          doc.text(deal.stage, col3X, rowY);
          doc.text(`$${Number(deal.value).toFixed(0)}`, col4X, rowY);
          doc.text(new Date(deal.closedDate).toLocaleDateString(), col5X, rowY);

          rowY += 20;
        });
      }

      doc.end();

      return new Promise((resolve) => {
        stream.on("finish", () => {
          resolve({
            success: true,
            filePath,
            fileName,
            message: "Deals report generated successfully",
          });
        });
        stream.on("error", (error) => {
          resolve({
            success: false,
            message: `Failed to write PDF: ${error.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Generate Finance Report
   */
  static async generateFinanceReport(
    companyId: string,
    filters: ReportFilters = {}
  ): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    message: string;
  }> {
    try {
      // Fetch invoices and deals data
      const invoices = await prisma.invoice.findMany({
        where: { companyId },
        include: { client: true },
      });

      const deals = await prisma.deal.findMany({
        where: { companyId },
      });

      const fileName = `finance-report-${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), "uploads", fileName);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Finance Report", { align: "center" })
        .moveDown();

      doc.fontSize(12).text(`Generated: ${new Date().toLocaleDateString()}`, {
        align: "right",
      });
      doc.moveDown();

      // Revenue metrics
      const totalRevenue = invoices.reduce((sum, inv) => sum + Number(inv.amount), 0);
      const totalDealsValue = deals.reduce((sum, d) => sum + Number(d.value), 0);

      const pendingInvoices = invoices.filter((i) => i.status === "PENDING");
      const paidInvoices = invoices.filter((i) => i.status === "PAID");

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Financial Metrics")
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Total Revenue (Invoiced): $${totalRevenue.toFixed(2)}`)
        .text(`Pipeline Value: $${totalDealsValue.toFixed(2)}`)
        .text(`Pending Invoices: ${pendingInvoices.length} ($${pendingInvoices.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)})`)
        .text(
          `Paid Invoices: ${paidInvoices.length} ($${paidInvoices.reduce((s, i) => s + Number(i.amount), 0).toFixed(2)})`
        )
        .moveDown();

      // Invoice breakdown
      if (invoices.length > 0) {
        doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Recent Invoices")
        .moveDown(0.5);

        doc.fontSize(10).font("Helvetica-Bold");
        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 180;
        const col3X = 300;
        const col4X = 400;
        const col5X = 480;

        doc.text("Invoice #", col1X, tableTop);
        doc.text("Client", col2X, tableTop);
        doc.text("Amount", col3X, tableTop);
        doc.text("Status", col4X, tableTop);
        doc.text("Due Date", col5X, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        doc.fontSize(9).font("Helvetica");
        let rowY = tableTop + 25;

        invoices.slice(0, 15).forEach((invoice) => {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          doc.text(invoice.invoiceNumber, col1X, rowY);
          doc.text(invoice.client?.name?.substring(0, 20) || "N/A", col2X, rowY);
          doc.text(`$${Number(invoice.amount).toFixed(0)}`, col3X, rowY);
          doc.text(invoice.status, col4X, rowY);
          doc.text(new Date(invoice.dueDate).toLocaleDateString(), col5X, rowY);

          rowY += 20;
        });
      }

      doc.end();

      return new Promise((resolve) => {
        stream.on("finish", () => {
          resolve({
            success: true,
            filePath,
            fileName,
            message: "Finance report generated successfully",
          });
        });
        stream.on("error", (error) => {
          resolve({
            success: false,
            message: `Failed to write PDF: ${error.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Generate Pipeline Report
   */
  static async generatePipelineReport(
    companyId: string,
    filters: ReportFilters = {}
  ): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    message: string;
  }> {
    try {
      // Fetch opportunities
      const opportunities = await prisma.opportunity.findMany({
        where: { companyId },
        include: { owner: true },
      });

      const fileName = `pipeline-report-${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), "uploads", fileName);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Sales Pipeline Report", { align: "center" })
        .moveDown();

      // Stage breakdown
      const stageBreakdown: { [key: string]: number } = {};
      opportunities.forEach((opp) => {
        stageBreakdown[opp.stage] = (stageBreakdown[opp.stage] || 0) + Number(opp.value);
      });

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Pipeline by Stage")
        .moveDown(0.5);

      doc.fontSize(11).font("Helvetica");
      Object.entries(stageBreakdown).forEach(([stage, value]) => {
        doc.text(`${stage}: $${value.toFixed(2)}`);
      });

      doc.moveDown();

      // Opportunities table
      if (opportunities.length > 0) {
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("All Opportunities")
          .moveDown(0.5);

        doc.fontSize(10).font("Helvetica-Bold");
        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 150;
        const col3X = 250;
        const col4X = 350;
        const col5X = 450;

        doc.text("Title", col1X, tableTop);
        doc.text("Stage", col2X, tableTop);
        doc.text("Value", col3X, tableTop);
        doc.text("Probability", col4X, tableTop);
        doc.text("Owner", col5X, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        doc.fontSize(9).font("Helvetica");
        let rowY = tableTop + 25;

        opportunities.forEach((opp) => {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          doc.text(opp.title.substring(0, 15), col1X, rowY);
          doc.text(opp.stage, col2X, rowY);
          doc.text(`$${Number(opp.value).toFixed(0)}`, col3X, rowY);
          doc.text(`${opp.probability}%`, col4X, rowY);
          doc.text(opp.owner?.name?.substring(0, 15) || "N/A", col5X, rowY);

          rowY += 20;
        });
      }

      doc.end();

      return new Promise((resolve) => {
        stream.on("finish", () => {
          resolve({
            success: true,
            filePath,
            fileName,
            message: "Pipeline report generated successfully",
          });
        });
        stream.on("error", (error) => {
          resolve({
            success: false,
            message: `Failed to write PDF: ${error.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Generate Customer Report
   */
  static async generateCustomerReport(
    companyId: string,
    filters: ReportFilters = {}
  ): Promise<{
    success: boolean;
    filePath?: string;
    fileName?: string;
    message: string;
  }> {
    try {
      const clients = await prisma.client.findMany({
        where: { companyId },
        include: { invoices: true, deals: true },
      });

      const fileName = `customer-report-${Date.now()}.pdf`;
      const filePath = path.join(process.cwd(), "uploads", fileName);

      const doc = new PDFDocument();
      const stream = fs.createWriteStream(filePath);

      doc.pipe(stream);

      // Header
      doc
        .fontSize(24)
        .font("Helvetica-Bold")
        .text("Customer Report", { align: "center" })
        .moveDown();

      // Summary
      const totalClients = clients.length;
      const totalRevenue = clients.reduce(
        (sum, c) => sum + Number(c.totalRevenue),
        0
      );

      doc
        .fontSize(14)
        .font("Helvetica-Bold")
        .text("Customer Metrics")
        .moveDown(0.5);

      doc
        .fontSize(11)
        .font("Helvetica")
        .text(`Total Customers: ${totalClients}`)
        .text(`Total Revenue: $${totalRevenue.toFixed(2)}`)
        .moveDown();

      // Clients table
      if (clients.length > 0) {
        doc
          .fontSize(14)
          .font("Helvetica-Bold")
          .text("Client Listing")
          .moveDown(0.5);

        doc.fontSize(10).font("Helvetica-Bold");
        const tableTop = doc.y;
        const col1X = 50;
        const col2X = 180;
        const col3X = 300;
        const col4X = 400;
        const col5X = 480;

        doc.text("Client", col1X, tableTop);
        doc.text("Contact", col2X, tableTop);
        doc.text("Status", col3X, tableTop);
        doc.text("Revenue", col4X, tableTop);
        doc.text("Tier", col5X, tableTop);

        doc.moveTo(50, tableTop + 15).lineTo(550, tableTop + 15).stroke();

        doc.fontSize(9).font("Helvetica");
        let rowY = tableTop + 25;

        clients.slice(0, 20).forEach((client) => {
          if (rowY > 750) {
            doc.addPage();
            rowY = 50;
          }

          doc.text(client.name.substring(0, 20), col1X, rowY);
          doc.text(
            client.contactPerson?.substring(0, 15) || "N/A",
            col2X,
            rowY
          );
          doc.text(client.customerStatus, col3X, rowY);
          doc.text(`$${Number(client.totalRevenue).toFixed(0)}`, col4X, rowY);
          doc.text(client.tier, col5X, rowY);

          rowY += 20;
        });
      }

      doc.end();

      return new Promise((resolve) => {
        stream.on("finish", () => {
          resolve({
            success: true,
            filePath,
            fileName,
            message: "Customer report generated successfully",
          });
        });
        stream.on("error", (error) => {
          resolve({
            success: false,
            message: `Failed to write PDF: ${error.message}`,
          });
        });
      });
    } catch (error) {
      return {
        success: false,
        message: `Report generation failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      };
    }
  }

  /**
   * Save generated report to database
   */
  static async saveReportRecord(
    companyId: string,
    templateId: string | null,
    title: string,
    reportType: string,
    filePath: string,
    generatedBy: string
  ): Promise<{
    success: boolean;
    reportId?: string;
  }> {
    try {
      const report = await prisma.generatedReport.create({
        data: {
          companyId,
          templateId: templateId || null,
          title,
          reportType,
          filePath,
          generatedBy,
        },
      });

      return {
        success: true,
        reportId: report.id,
      };
    } catch (error) {
      return {
        success: false,
      };
    }
  }
}

export default ReportingService;
