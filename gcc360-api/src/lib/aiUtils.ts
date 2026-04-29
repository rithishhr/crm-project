/**
 * Utility for AI processing and JSON extraction
 */

export function extractJSON(text: string): any {
  try {
    const firstBrace = text.indexOf('{')
    const firstBracket = text.indexOf('[')
    
    let start = -1
    let end = -1

    if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
      start = firstBrace
      end = text.lastIndexOf('}')
    } else if (firstBracket !== -1) {
      start = firstBracket
      end = text.lastIndexOf(']')
    }

    if (start === -1 || end === -1 || end < start) return null
    
    const jsonStr = text.substring(start, end + 1)
    return JSON.parse(jsonStr)
  } catch (err) {
    console.error('JSON Extraction failed:', err)
    return null
  }
}

export const MODELS = {
  LARGE: 'llama-3.3-70b-versatile',
  MIXTRAL: 'mixtral-8x7b-32768',
  SMALL: 'llama-3.1-8b-instant',
}
