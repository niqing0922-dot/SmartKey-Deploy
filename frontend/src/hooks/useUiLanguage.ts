import { useEffect, useState } from 'react'

export type UiLanguage = 'zh' | 'en'

const STORAGE_KEY = 'smartkey-ui-language'

function readLanguage(): UiLanguage {
  if (typeof window === 'undefined') return 'zh'
  const saved = window.localStorage.getItem(STORAGE_KEY)
  return saved === 'en' ? 'en' : 'zh'
}

export function setUiLanguage(value: UiLanguage) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, value)
  window.dispatchEvent(new CustomEvent('smartkey-language-change', { detail: value }))
}

export function useUiLanguage() {
  const [language, setLanguage] = useState<UiLanguage>(readLanguage())

  useEffect(() => {
    const sync = () => setLanguage(readLanguage())
    window.addEventListener('smartkey-language-change', sync as EventListener)
    window.addEventListener('storage', sync)
    return () => {
      window.removeEventListener('smartkey-language-change', sync as EventListener)
      window.removeEventListener('storage', sync)
    }
  }, [])

  return language
}
