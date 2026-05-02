import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authApi, cloudApi } from '@/services/api'
import { supabase, supabaseConfigured } from '@/services/supabase'
import type { BootStatus, CloudBootstrapData, WorkspaceSummary } from '@/types'
import { setStoredWorkspaceId } from './session'

type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  workspace: WorkspaceSummary | null
  workspaces: WorkspaceSummary[]
  bootStatus: BootStatus
  bootError: string
  bootstrapData: CloudBootstrapData | null
  lastSyncedAt: string
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshWorkspace: () => Promise<void>
  mutateBootstrapData: (updater: (current: CloudBootstrapData | null) => CloudBootstrapData | null) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

function readBootstrapError(error: unknown) {
  const issue = error as any
  return issue?.response?.data?.detail?.message || issue?.userMessage || issue?.message || 'Failed to load workspace.'
}

async function applySessionPayload(sessionPayload: any) {
  const accessToken = sessionPayload?.access_token || sessionPayload?.session?.access_token || ''
  const refreshToken = sessionPayload?.refresh_token || sessionPayload?.session?.refresh_token || ''
  if (!accessToken || !refreshToken) {
    throw new Error(sessionPayload?.message || 'Authentication succeeded but no session was returned.')
  }
  const { error } = await supabase.auth.setSession({
    access_token: accessToken,
    refresh_token: refreshToken,
  })
  if (error) throw error
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null)
  const [workspaces, setWorkspaces] = useState<WorkspaceSummary[]>([])
  const [bootStatus, setBootStatus] = useState<BootStatus>('idle')
  const [bootError, setBootError] = useState('')
  const [bootstrapData, setBootstrapData] = useState<CloudBootstrapData | null>(null)
  const [lastSyncedAt, setLastSyncedAt] = useState('')
  const initializedRef = useRef(false)
  const bootstrapTokenRef = useRef('')

  const mutateBootstrapData = useCallback((updater: (current: CloudBootstrapData | null) => CloudBootstrapData | null) => {
    setBootstrapData((current) => {
      const next = updater(current)
      if (next?.workspace) setWorkspace(next.workspace)
      if (next?.workspaces) setWorkspaces(next.workspaces)
      if (next?.sync_meta?.synced_at) setLastSyncedAt(next.sync_meta.synced_at)
      return next
    })
  }, [])

  const refreshWorkspace = useCallback(async () => {
    if (!supabaseConfigured || !session) return
    setBootError('')
    setBootStatus('workspace')
    setLoading(true)
    try {
      setBootStatus('syncing')
      const data = await cloudApi.bootstrap()
      setBootstrapData(data)
      setWorkspace(data.workspace)
      setWorkspaces(data.workspaces)
      setStoredWorkspaceId(data.workspace.id)
      setLastSyncedAt(data.sync_meta.synced_at)
      setBootStatus('ready')
    } catch (error) {
      setWorkspace(null)
      setWorkspaces([])
      setBootstrapData(null)
      setLastSyncedAt('')
      setStoredWorkspaceId('')
      setBootError(readBootstrapError(error))
      setBootStatus('error')
      throw error
    } finally {
      setLoading(false)
    }
  }, [session])

  useEffect(() => {
    let active = true
    if (initializedRef.current) return
    initializedRef.current = true
    setBootStatus('auth')
    setLoading(true)
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return
      setSession(data.session)
      if (!data.session) {
        setBootStatus('idle')
        setLoading(false)
      }
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        bootstrapTokenRef.current = ''
        setWorkspace(null)
        setWorkspaces([])
        setBootstrapData(null)
        setLastSyncedAt('')
        setStoredWorkspaceId('')
        setBootError('')
        setBootStatus('idle')
        setLoading(false)
      }
    })
    return () => {
      active = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (!session) return
    const token = session.access_token || ''
    if (!token || bootstrapTokenRef.current === token) return
    bootstrapTokenRef.current = token
    setBootStatus('auth')
    setLoading(true)
    refreshWorkspace().catch(() => undefined)
  }, [refreshWorkspace, session])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    user: session?.user || null,
    workspace,
    workspaces,
    bootStatus,
    bootError,
    bootstrapData,
    lastSyncedAt,
    async signIn(email: string, password: string) {
      const sessionPayload = await authApi.signIn({ email, password })
      await applySessionPayload(sessionPayload)
    },
    async signUp(email: string, password: string) {
      const sessionPayload = await authApi.signUp({ email, password })
      await applySessionPayload(sessionPayload)
    },
    async signOut() {
      await supabase.auth.signOut()
      setStoredWorkspaceId('')
    },
    refreshWorkspace,
    mutateBootstrapData,
  }), [bootError, bootStatus, bootstrapData, lastSyncedAt, loading, mutateBootstrapData, refreshWorkspace, session, workspace, workspaces])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
