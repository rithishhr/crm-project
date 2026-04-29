/**
 * AI Email Verifier
 * 
 * This service reads incoming emails and:
 * 1. Checks if the email is a real business inquiry (not spam/fraud)
 * 2. Extracts company name, contact, value, product interest
 * 3. Assigns a credibility score (0-100)
 * 4. Creates a new lead automatically if score > 40
 */

export interface ExtractedLead {
  company:     string
  contactName: string
  email:       string
  phone:       string
  industry:    string
  country:     string
  value:       number
  notes:       string
  aiScore:     number
  isFraud:     boolean
  aiNotes:     string
}

// Keywords that suggest a real business RFQ email
const RFQ_KEYWORDS = [
  'rfq', 'request for quotation', 'request for quote', 'quotation', 'proposal',
  'pricing', 'tender', 'bid', 'procurement', 'purchase order', 'po request',
  'interested in', 'looking for', 'require', 'need', 'solution', 'crm',
  'software', 'platform', 'system', 'enterprise', 'implementation', 'integration',
]

// Keywords that suggest spam or fraud
const FRAUD_KEYWORDS = [
  'lottery', 'winner', 'prize', 'million dollars', 'inheritance', 'nigerian prince',
  'crypto', 'bitcoin', 'investment opportunity', 'click here', 'unsubscribe',
  'free offer', 'limited time', '100% guaranteed', 'no risk', 'act now',
  'verify your account', 'suspended', 'urgent action required',
]

// Known spam domains
const SPAM_DOMAINS = [
  'tempmail.com', 'guerrillamail.com', 'mailinator.com', 'throwam.com',
  '10minutemail.com', 'yopmail.com', 'sharklasers.com', 'guerrillamailblock.com',
]

function isSpamDomain(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() || ''
  return SPAM_DOMAINS.some(d => domain.includes(d))
}

function countKeywords(text: string, keywords: string[]): number {
  const lower = text.toLowerCase()
  return keywords.filter(k => lower.includes(k)).length
}

function extractPhone(text: string): string {
  const match = text.match(/(\+?[\d\s\-()]{8,20})/g)
  if (!match) return ''
  // Filter out things that are clearly not phone numbers (too many dashes etc)
  return match.find(m => m.replace(/\D/g, '').length >= 7) || ''
}

function extractValue(text: string): number {
  // Look for dollar/AED amounts
  const patterns = [
    /AED\s*([\d,]+)/i,
    /USD\s*([\d,]+)/i,
    /\$\s*([\d,]+)/i,
    /budget[:\s]*([\d,]+)/i,
    /([\d,]+)\s*million/i,
    /([\d,]+)\s*k\b/i,
  ]
  for (const p of patterns) {
    const m = text.match(p)
    if (m) {
      const num = parseFloat(m[1].replace(/,/g, ''))
      if (text.toLowerCase().includes('million')) return num * 1000000
      if (text.toLowerCase().includes(' k')) return num * 1000
      return num
    }
  }
  return 0
}

function detectCountry(text: string): string {
  const countries: Record<string, string[]> = {
    'UAE':          ['uae', 'dubai', 'abu dhabi', 'sharjah', 'emirates', '.ae'],
    'Saudi Arabia': ['saudi', 'riyadh', 'jeddah', 'aramco', 'ksa', '.sa'],
    'Qatar':        ['qatar', 'doha', '.qa', 'qatarenergy'],
    'Kuwait':       ['kuwait', '.kw', 'koc'],
    'Bahrain':      ['bahrain', 'manama', '.bh', 'bapco'],
    'Oman':         ['oman', 'muscat', '.om'],
  }
  const lower = text.toLowerCase()
  for (const [country, hints] of Object.entries(countries)) {
    if (hints.some(h => lower.includes(h))) return country
  }
  return 'Unknown'
}

function detectIndustry(text: string): string {
  const industries: Record<string, string[]> = {
    'Oil & Gas':    ['oil', 'gas', 'petroleum', 'refinery', 'upstream', 'downstream', 'drilling', 'lng', 'pipeline'],
    'Energy':       ['energy', 'power', 'electricity', 'solar', 'renewable'],
    'Construction': ['construction', 'contractor', 'infrastructure', 'project'],
    'Finance':      ['bank', 'finance', 'investment', 'insurance', 'trading'],
    'Healthcare':   ['hospital', 'medical', 'health', 'pharma', 'clinic'],
    'Government':   ['ministry', 'government', 'municipal', 'authority', 'federal'],
  }
  const lower = text.toLowerCase()
  for (const [industry, hints] of Object.entries(industries)) {
    if (hints.some(h => lower.includes(h))) return industry
  }
  return 'General Business'
}

/**
 * Main AI verification function
 * Takes an email and returns whether it's a real lead + extracted data
 */
export function verifyEmailWithAI(
  fromEmail: string,
  fromName:  string,
  subject:   string,
  body:      string
): ExtractedLead {
  const fullText = `${subject} ${body}`
  
  // ── Fraud checks ─────────────────────────────────────────────────────────
  const fraudScore   = countKeywords(fullText, FRAUD_KEYWORDS)
  const rfqScore     = countKeywords(fullText, RFQ_KEYWORDS)
  const isSpam       = isSpamDomain(fromEmail)
  const hasRealEmail = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(fromEmail)
  const bodyLength   = body.trim().length

  // Determine if fraud
  const isFraud = (
    isSpam ||
    fraudScore >= 2 ||
    !hasRealEmail ||
    bodyLength < 30 ||
    (rfqScore === 0 && bodyLength < 100)
  )

  // ── AI credibility score (0-100) ─────────────────────────────────────────
  let score = 50 // base score

  // Positive signals
  if (rfqScore >= 1) score += 10
  if (rfqScore >= 3) score += 10
  if (bodyLength > 200) score += 10
  if (bodyLength > 500) score += 5
  if (fromEmail.includes('.com') || fromEmail.includes('.ae') || fromEmail.includes('.sa')) score += 5
  if (extractValue(fullText) > 0) score += 10
  if (extractPhone(body)) score += 5
  if (fromName && fromName.length > 3) score += 5

  // Negative signals
  if (fraudScore >= 1) score -= 20
  if (isSpam) score -= 50
  if (bodyLength < 50) score -= 20
  if (rfqScore === 0) score -= 15

  score = Math.max(0, Math.min(100, score))

  // ── Extract lead data ─────────────────────────────────────────────────────
  // Try to get company name from email domain or name
  const emailDomain = fromEmail.split('@')[1]?.split('.')[0] || ''
  const company = fromName?.includes(' ')
    ? fromName.split(' ').slice(-1)[0]  // last word of name often is company
    : emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1)

  const aiNotesList: string[] = []
  if (rfqScore > 0) aiNotesList.push(`Found ${rfqScore} RFQ keyword(s)`)
  if (fraudScore > 0) aiNotesList.push(`⚠️ Found ${fraudScore} suspicious keyword(s)`)
  if (isSpam) aiNotesList.push('⚠️ Known spam domain detected')
  if (extractValue(fullText) > 0) aiNotesList.push(`Estimated deal value: AED ${extractValue(fullText).toLocaleString()}`)
  if (score > 70) aiNotesList.push('High credibility — recommend immediate follow-up')
  else if (score > 40) aiNotesList.push('Medium credibility — requires manual review')
  else aiNotesList.push('Low credibility — likely not a real business inquiry')

  return {
    company:     company || 'Unknown Company',
    contactName: fromName || fromEmail.split('@')[0],
    email:       fromEmail,
    phone:       extractPhone(body),
    industry:    detectIndustry(fullText),
    country:     detectCountry(fullText),
    value:       extractValue(fullText),
    notes:       `[Auto-detected from email]\nSubject: ${subject}\n\n${body.slice(0, 500)}`,
    aiScore:     score,
    isFraud,
    aiNotes:     aiNotesList.join(' | '),
  }
}
