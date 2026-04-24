import { useEffect, useRef, useState } from 'react'
import { aiApi } from '@/services/api'
import { useI18n } from '@/i18n/useI18n'

type ChatItem = { role: 'user' | 'assistant'; content: string }

export function ChatPage() {
  const { language, t } = useI18n()
  const copy = t.chat
  const [history, setHistory] = useState<ChatItem[]>([{ role: 'assistant', content: copy.starter }])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const listRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight }) }, [history])
  useEffect(() => { setHistory([{ role: 'assistant', content: copy.starter }]) }, [language, copy.starter])

  const send = async (preset?: string) => {
    const message = (preset ?? text).trim()
    if (!message || loading) return
    setText('')
    setLoading(true)
    setHistory((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: copy.thinking }])
    try {
      const result = await aiApi.chat({ message, history })
      setHistory((current) => { const next = [...current]; next[next.length - 1] = { role: 'assistant', content: result.reply || copy.emptyReply }; return next })
    } catch (issue: any) {
      setHistory((current) => { const next = [...current]; next[next.length - 1] = { role: 'assistant', content: issue?.response?.data?.detail?.message || issue.message || copy.sendFailed }; return next })
    } finally { setLoading(false) }
  }

  return <div id="page-chat" className="page page-active"><div className="page-header"><div><div className="page-title">{copy.title}</div><div className="page-desc">{copy.desc}</div></div><button className="btn btn-sm btn-ghost" onClick={() => setHistory([{ role: 'assistant', content: copy.cleared }])}><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/></svg>{copy.clear}</button></div><div className="chat-page-shell"><div id="chat-messages" ref={listRef} className="chat-messages">{history.map((item, index) => <div key={`${item.role}-${index}`} className={`chat-msg ${item.role === 'assistant' ? 'chat-ai' : 'chat-user'}`}><div className="chat-avatar">{item.role === 'assistant' ? 'AI' : copy.me}</div><div className="chat-bubble">{item.content}</div></div>)}</div><div id="chat-suggestions" className="chat-suggestions">{copy.suggestions.map((item) => <button key={item} className="btn btn-xs btn-ghost chat-suggestion" onClick={() => send(item)}>{item}</button>)}</div><div className="chat-input-row"><textarea id="chat-input" value={text} onChange={(event) => setText(event.target.value)} placeholder={copy.inputPlaceholder} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void send() } }} /><button className="btn btn-primary chat-send-btn" id="btn-chat-send" onClick={() => send()} disabled={loading}><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>{copy.send}</button></div></div></div>
}
