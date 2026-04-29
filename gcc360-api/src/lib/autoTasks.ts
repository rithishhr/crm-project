import { prisma } from './prisma'
import Groq from 'groq-sdk'
import { MODELS, extractJSON } from './aiUtils'

let _groq: Groq | null = null
function getGroq() {
  if (_groq) return _groq
  const key = process.env.GROQ_API_KEY
  if (!key) throw new Error('GROQ_API_KEY not set')
  _groq = new Groq({ apiKey: key })
  return _groq
}

type RecordType = 'LEAD' | 'OPPORTUNITY' | 'DEAL_WON' | 'DEAL_LOST'

export async function generateAutoTask(
  type: RecordType,
  data: any,
  companyId: string,
  userId: string
) {
  try {
    const groq = getGroq()
    
    let prompt = ''
    if (type === 'LEAD') {
      prompt = `A new lead has been added:
      Company: ${data.company}
      Contact: ${data.contactName}
      Industry: ${data.industry || 'Unknown'}
      Value: ${data.value}
      Requirements: ${data.requirements || 'None'}
      
      Suggest ONE immediate action task for the sales person.
      Return ONLY valid JSON in this format: { "title": "...", "description": "..." }`
    } else if (type === 'OPPORTUNITY') {
      prompt = `An opportunity has been qualified:
      Title: ${data.title}
      Company: ${data.company}
      Value: ${data.value}
      
      Suggest ONE strategic follow-up task.
      Return ONLY valid JSON in this format: { "title": "...", "description": "..." }`
    } else if (type === 'DEAL_WON') {
      prompt = `A deal has been WON:
      Title: ${data.title}
      Company: ${data.company}
      Value: ${data.value}
      
      Suggest ONE post-sale/onboarding task.
      Return ONLY valid JSON in this format: { "title": "...", "description": "..." }`
    } else {
      prompt = `An opportunity was LOST:
      Title: ${data.title}
      Company: ${data.company}
      
      Suggest ONE post-mortem or re-engagement task for 6 months later.
      Return ONLY valid JSON in this format: { "title": "...", "description": "..." }`
    }

    const completion = await groq.chat.completions.create({
      model: MODELS.SMALL,
      messages: [
        { role: 'system', content: 'You are an automated CRM assistant. Return ONLY raw JSON.' },
        { role: 'user', content: prompt }
      ],
      temperature: 0.3
    })

    const raw = completion.choices[0]?.message?.content || '{}'
    const result = extractJSON(raw)
    
    if (result && result.title) {
      const dueDate = new Date()
      dueDate.setDate(dueDate.getDate() + 2) // Default 2 days later

      await prisma.task.create({
        data: {
          title: result.title,
          description: result.description || '',
          status: 'TODO',
          priority: 'MEDIUM',
          dueDate,
          relatedTo: data.company,
          assignedToId: userId,
          companyId: companyId
        }
      })
      console.log(`[AUTO-TASK]: Created for ${type} - ${data.company}`)
    }
  } catch (err: any) {
    console.error('[AUTO-TASK ERROR]:', err.message)
    // Fallback task if AI fails
    await prisma.task.create({
      data: {
        title: `Follow up on ${type.toLowerCase()}: ${data.company || data.title}`,
        description: 'Automatic follow-up task created.',
        status: 'TODO',
        priority: 'MEDIUM',
        dueDate: new Date(Date.now() + 86400000),
        relatedTo: data.company,
        assignedToId: userId,
        companyId: companyId
      }
    })
  }
}
