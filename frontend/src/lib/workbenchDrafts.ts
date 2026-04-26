import type { WorkbenchTaskDraft } from '@/types'

const DRAFTS_KEY = 'smartkey.workbench.drafts.v1'
const RECENT_ROUTES_KEY = 'smartkey.workbench.recent-routes.v1'

type DraftMap = Record<string, WorkbenchTaskDraft>

function isBrowser() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

function readDraftMap(): DraftMap {
  if (!isBrowser()) return {}
  try {
    const raw = window.sessionStorage.getItem(DRAFTS_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw)
    return parsed && typeof parsed === 'object' ? parsed as DraftMap : {}
  } catch {
    return {}
  }
}

function writeDraftMap(next: DraftMap) {
  if (!isBrowser()) return
  window.sessionStorage.setItem(DRAFTS_KEY, JSON.stringify(next))
}

export function routeToPageKey(route: string) {
  return route.replace(/^\//, '').replace(/[\\/]+/g, '.') || 'ai-home'
}

export function saveWorkbenchTaskDraft(draft: Omit<WorkbenchTaskDraft, 'pageKey'> & { pageKey?: string }) {
  const pageKey = draft.pageKey || routeToPageKey(draft.targetRoute)
  const current = readDraftMap()
  current[pageKey] = { ...draft, pageKey }
  writeDraftMap(current)
}

export function consumeWorkbenchTaskDraft(pageKey: string) {
  const current = readDraftMap()
  const draft = current[pageKey] || null
  if (!draft) return null
  delete current[pageKey]
  writeDraftMap(current)
  return draft
}

export function peekWorkbenchTaskDraft(pageKey: string) {
  const current = readDraftMap()
  return current[pageKey] || null
}

export function recordRecentRoute(route: string) {
  if (!isBrowser()) return
  if (!route || route === '/') return
  try {
    const raw = window.sessionStorage.getItem(RECENT_ROUTES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    const current = Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
    const next = [route, ...current.filter((item) => item !== route)].slice(0, 8)
    window.sessionStorage.setItem(RECENT_ROUTES_KEY, JSON.stringify(next))
  } catch {
    window.sessionStorage.removeItem(RECENT_ROUTES_KEY)
  }
}

export function readRecentRoutes() {
  if (!isBrowser()) return []
  try {
    const raw = window.sessionStorage.getItem(RECENT_ROUTES_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.filter((item) => typeof item === 'string') : []
  } catch {
    return []
  }
}
