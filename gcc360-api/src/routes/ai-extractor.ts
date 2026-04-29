import { Router } from 'express'
import multer from 'multer'
import { authenticate, AuthRequest } from '../middleware/auth'
import { prisma } from '../lib/prisma'
import { syncLeadToClientAndContact } from '../lib/leadSync'

export const aiExtractorRouter = Router()
aiExtractorRouter.use(authenticate)

// Setup multer for memory storage
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })

async function parsePdfBuffer(buffer: Buffer): Promise<string> {
  const pdfParse = require('pdf-parse') as (input: Buffer) => Promise<{ text: string }>
  const data = await pdfParse(buffer)
  return data.text
}

function getGroq() {
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  const Groq = require('groq-sdk')
  return new Groq({ apiKey: key })
}

aiExtractorRouter.post('/extract-file', upload.single('file'), async (req: AuthRequest, res) => {
  try {
    const file = req.file
    if (!file) {
      res.status(400).json({ error: 'No file uploaded' })
      return
    }

    let textContent = ''

    // Parse file based on mimetype
    if (file.mimetype === 'application/pdf') {
      textContent = await parsePdfBuffer(file.buffer)
    } else if (file.mimetype.includes('text') || file.mimetype.includes('csv')) {
      textContent = file.buffer.toString('utf-8')
    } else {
      res.status(400).json({ error: 'Unsupported file format. Please upload PDF, TXT, or CSV.' })
      return
    }

    // Truncate to avoid token limits
    textContent = textContent.slice(0, 15000)

    const prompt = `You are a B2B AI CRM Assistant for the GCC oil and gas industry.
Read the following extracted document text and extract any potential sales leads, companies, contacts, and requirements.

Text:
"""
${textContent}
"""

Return ONLY valid JSON in this exact structure (no markdown or explanation):
[
  {
    "company": "Company Name",
    "contactName": "Full Name",
    "email": "email@example.com",
    "phone": "+971...",
    "requirements": "Summary of what they need",
    "value": "estimated numeric value if found, otherwise 0",
    "country": "UAE/Saudi/etc"
  }
]`

    const groq = getGroq()
    const completion = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      messages: [
        { role: 'system', content: 'You are a JSON-only API.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.1
    })

    const raw = completion.choices[0]?.message?.content || '[]'
    
    let extractedLeads: any[] = []
    try {
      extractedLeads = JSON.parse(raw.replace(/```json|```/g, '').trim())
    } catch {
      res.status(500).json({ error: 'Failed to parse AI response' })
      return
    }

    if (!Array.isArray(extractedLeads)) {
      extractedLeads = [extractedLeads]
    }

    const createdLeads = []
    for (const lead of extractedLeads) {
      if (!lead.company) continue // Skip if missing required field
      
      const newLead = await prisma.lead.create({
        data: {
          company: lead.company,
          title: `Lead from Document: ${lead.company}`,
          contactName: lead.contactName || null,
          email: lead.email || null,
          phone: lead.phone || null,
          requirements: lead.requirements || null,
          value: parseFloat(lead.value) || 0,
          country: lead.country || null,
          source: 'FILE_IMPORT',
          companyId: req.user!.companyId,
          assignedToId: req.user!.userId,
          status: 'NEW',
          aiCredibilityScore: 75,
          aiNotes: 'Automatically extracted via AI Document Parser'
        }
      })
      await syncLeadToClientAndContact(prisma, newLead)
      createdLeads.push(newLead)
    }

    // Log the activity
    await prisma.activity.create({
      data: {
        type: 'NOTE',
        description: `AI extracted ${createdLeads.length} leads from uploaded file: ${file.originalname}`,
        createdById: req.user!.userId,
        companyId: req.user!.companyId,
      }
    }).catch(() => {})

    res.json({ success: true, count: createdLeads.length, leads: createdLeads })
  } catch (error: any) {
    console.error('File extraction error:', error)
    res.status(500).json({ error: error.message || 'Failed to process file' })
  }
})
