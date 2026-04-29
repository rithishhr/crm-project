import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, Bot, User, Loader2, Mic, Languages } from 'lucide-react'
import { aiApi } from '../../lib/api'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function AIChatbot() {
  const STORAGE_KEY = 'gcc360-chat-history-v1'
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [language, setLanguage] = useState('en')
  const [typingPreview, setTypingPreview] = useState('')
  const [listening, setListening] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        setMessages(JSON.parse(stored))
      } else {
        setMessages([{ role: 'assistant', content: 'Hi! I am your GCC360 CRM Guide. Ask me how to use modules, workflows, and features.' }])
      }
    } catch {
      setMessages([{ role: 'assistant', content: 'Hi! I am your GCC360 CRM Guide. Ask me how to use modules, workflows, and features.' }])
    }
  }, [])

  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messages))
    }
  }, [messages])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMsg = input.trim()
    setInput('')
    setMessages(prev => [...prev, { role: 'user', content: userMsg }])
    setLoading(true)
    setTypingPreview('')

    try {
      const data = await aiApi.chatGuide(userMsg, messages, language)
      const finalReply = String(data.reply || 'I could not generate a response at the moment.')

      let i = 0
      const interval = window.setInterval(() => {
        i += 4
        setTypingPreview(finalReply.slice(0, i))
        if (i >= finalReply.length) {
          window.clearInterval(interval)
          setTypingPreview('')
          setMessages(prev => [...prev, { role: 'assistant', content: finalReply }])
        }
      }, 18)
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Sorry, I am having trouble connecting to my brain right now. Please try again later!' }])
    } finally {
      setLoading(false)
    }
  }

  const startVoiceInput = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    if (!SpeechRecognition || listening) return

    const recognition = new SpeechRecognition()
    recognition.lang = language === 'ar' ? 'ar-AE' : language === 'hi' ? 'hi-IN' : 'en-US'
    recognition.interimResults = false
    recognition.maxAlternatives = 1

    setListening(true)
    recognition.onresult = (event: any) => {
      const text = event.results?.[0]?.[0]?.transcript || ''
      if (text) setInput(prev => (prev ? `${prev} ${text}` : text))
    }
    recognition.onerror = () => setListening(false)
    recognition.onend = () => setListening(false)
    recognition.start()
  }

  return (
    <div className="fixed bottom-6 right-6 z-[60]">
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="mb-4 w-[380px] h-[520px] bg-[var(--bg-surface)] border border-[var(--border)] rounded-2xl shadow-2xl flex flex-col overflow-hidden"
          >
            {/* Header */}
            <div className="p-4 bg-teal-500 flex items-center justify-between text-white">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-white/20 flex items-center justify-center">
                  <Bot className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm font-bold">CRM Guide Bot</p>
                  <p className="text-[10px] opacity-80">How-to support, training, and business Q&A</p>
                </div>
              </div>
              <button onClick={() => setIsOpen(false)} className="hover:bg-white/10 p-1 rounded-lg transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Messages */}
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-hide">
              {messages.map((m, i) => (
                <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`flex gap-2 max-w-[85%] ${m.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                    <div className={`w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-1 ${
                      m.role === 'user' ? 'bg-blue-500/20 text-blue-400' : 'bg-teal-500/20 text-teal-400'
                    }`}>
                      {m.role === 'user' ? <User className="w-3.5 h-3.5" /> : <Bot className="w-3.5 h-3.5" />}
                    </div>
                    <div className={`p-3 rounded-2xl text-xs leading-relaxed ${
                      m.role === 'user' 
                        ? 'bg-blue-500/10 text-[var(--text-primary)] rounded-tr-none border border-blue-500/20' 
                        : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-tl-none border border-[var(--border)]'
                    }`}>
                      {m.content}
                    </div>
                  </div>
                </div>
              ))}
              {loading && (
                <div className="flex justify-start">
                  <div className="flex gap-2 items-center bg-[var(--bg-elevated)] p-3 rounded-2xl rounded-tl-none border border-[var(--border)]">
                    <Loader2 className="w-3 h-3 animate-spin text-teal-400" />
                    <span className="text-[10px] text-[var(--text-muted)]">AI is thinking...</span>
                  </div>
                </div>
              )}
              {typingPreview && (
                <div className="flex justify-start">
                  <div className="flex gap-2 max-w-[85%]">
                    <div className="w-6 h-6 rounded-md flex-shrink-0 flex items-center justify-center mt-1 bg-teal-500/20 text-teal-400">
                      <Bot className="w-3.5 h-3.5" />
                    </div>
                    <div className="p-3 rounded-2xl text-xs leading-relaxed bg-[var(--bg-elevated)] text-[var(--text-secondary)] rounded-tl-none border border-[var(--border)]">
                      {typingPreview}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Quick Actions */}
            {!loading && messages.length < 3 && (
              <div className="px-4 pb-2 flex flex-wrap gap-2">
                {['How to add a lead?', 'What is the pipeline?', 'How to mark a deal won?'].map(q => (
                  <button 
                    key={q} 
                    onClick={() => setInput(q)}
                    className="text-[10px] bg-[var(--bg-elevated)] hover:bg-[var(--bg-hover)] text-[var(--text-muted)] px-2 py-1 rounded-full border border-[var(--border)] transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}

            {/* Input */}
            <div className="p-4 border-t border-[var(--border)]">
              <div className="relative">
                <div className="flex items-center gap-1 mb-2">
                  <Languages className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />
                  <select
                    value={language}
                    onChange={(e) => setLanguage(e.target.value)}
                    className="text-[10px] bg-[var(--bg-elevated)] border border-[var(--border)] rounded px-1.5 py-1"
                    style={{ color: 'var(--text-secondary)' }}
                  >
                    <option value="en">English</option>
                    <option value="ar">Arabic</option>
                    <option value="hi">Hindi</option>
                  </select>
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSend()}
                  placeholder="Ask me anything..."
                  className="w-full bg-[var(--bg-elevated)] border border-[var(--border)] rounded-xl py-2.5 pl-4 pr-10 text-xs focus:border-teal-500 outline-none text-[var(--text-primary)]"
                />
                <button
                  type="button"
                  onClick={startVoiceInput}
                  className="absolute right-16 top-1.5 p-1.5 rounded-lg bg-[var(--bg-elevated)] text-[var(--text-muted)] border border-[var(--border)]"
                  title={listening ? 'Listening...' : 'Voice Input'}
                >
                  <Mic className={`w-3.5 h-3.5 ${listening ? 'text-teal-400' : ''}`} />
                </button>
                {/* attach/file upload button removed per UX request */}
                <button 
                  onClick={handleSend}
                  disabled={!input.trim() || loading}
                  className="absolute right-2 top-1.5 p-1.5 rounded-lg bg-teal-500 text-white disabled:opacity-50 transition-all hover:scale-105 active:scale-95"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setIsOpen(!isOpen)}
        className="w-14 h-14 rounded-2xl bg-teal-500 shadow-lg shadow-teal-500/30 flex items-center justify-center text-white relative group"
      >
        <AnimatePresence mode="wait">
          {isOpen ? (
            <motion.div key="close" initial={{ rotate: -90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: 90, opacity: 0 }}>
              <X className="w-6 h-6" />
            </motion.div>
          ) : (
            <motion.div key="chat" initial={{ rotate: 90, opacity: 0 }} animate={{ rotate: 0, opacity: 1 }} exit={{ rotate: -90, opacity: 0 }}>
              <MessageSquare className="w-6 h-6" />
            </motion.div>
          )}
        </AnimatePresence>
        
        {!isOpen && (
          <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full border-2 border-[var(--bg-base)] flex items-center justify-center">
            <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
          </div>
        )}
        
        <div className="absolute right-full mr-3 whitespace-nowrap bg-[var(--bg-surface)] border border-[var(--border)] text-xs text-[var(--text-primary)] px-3 py-1.5 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl">
          Ask AI Support
        </div>
      </motion.button>
    </div>
  )
}
