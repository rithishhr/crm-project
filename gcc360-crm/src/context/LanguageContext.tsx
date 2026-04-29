import React, { createContext, useContext, useState, useEffect } from 'react'
import { Language, translations } from '../locales/translations'

interface LanguageContextType {
  language: Language
  setLanguage: (lang: Language) => void
  t: (key: keyof typeof translations.en) => string
  direction: 'ltr' | 'rtl'
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined)

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(
    (localStorage.getItem('gcc360-lang') as Language) || 'en'
  )

  const setLanguage = (lang: Language) => {
    setLanguageState(lang)
    localStorage.setItem('gcc360-lang', lang)
  }

  const direction = language === 'ar' ? 'rtl' : 'ltr'

  useEffect(() => {
    document.documentElement.dir = direction
    document.documentElement.lang = language
  }, [direction, language])

  const t = (key: keyof typeof translations.en) => {
    return translations[language][key] || translations.en[key] || key
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, direction }}>
      <div dir={direction} className={direction}>
        {children}
      </div>
    </LanguageContext.Provider>
  )
}

export const useLanguage = () => {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}
