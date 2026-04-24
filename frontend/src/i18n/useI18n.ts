import { useMemo } from 'react'
import { useUiLanguage } from '@/hooks/useUiLanguage'
import { messages } from '@/i18n/messages'

export function useI18n() {
  const language = useUiLanguage()
  const t = useMemo(() => messages[language], [language])
  return { language, t }
}
