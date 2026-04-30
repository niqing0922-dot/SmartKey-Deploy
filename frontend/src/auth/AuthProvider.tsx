import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { cloudApi } from '@/services/api'
import { supabase, supabaseConfigured } from '@/services/supabase'
import { getStoredWorkspaceId, setStoredWorkspaceId } from './session'

type Workspace = {
  id: string
  name: string
  role: string
}

type AuthContextValue = {
  loading: boolean
  session: Session | null
  user: User | null
  workspace: Workspace | null
  workspaces: Workspace[]
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  refreshWorkspace: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState<Session | null>(null)
  const [workspace, setWorkspace] = useState<Workspace | null>(null)
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])

  const refreshWorkspace = useCallback(async () => {
    if (!supabaseConfigured) return
    try {
      const data = await cloudApi.bootstrap()
      const nextWorkspace = data.workspace
      setWorkspaces(data.workspaces)
      const storedWorkspaceId = getStoredWorkspaceId()
      const activeWorkspace = data.workspaces.find((item) => item.id === storedWorkspaceId) || nextWorkspace
      setWorkspace(activeWorkspace)
      setStoredWorkspaceId(activeWorkspace.id)
    } catch (error) {
      setWorkspace(null)
      setWorkspaces([])
      setStoredWorkspaceId('')
      throw error
    }
  }, [])

  useEffect(() => {
    let mounted = true
    supabase.auth.getSession().then(async ({ data }) => {
      if (!mounted) return
      setSession(data.session)
      if (data.session) {
        await refreshWorkspace().catch(() => undefined)
      }
      setLoading(false)
    })
    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      if (!nextSession) {
        setWorkspace(null)
        setWorkspaces([])
        setStoredWorkspaceId('')
      } else {
        setTimeout(() => {
          refreshWorkspace().catch(() => undefined)
        }, 0)
      }
    })
    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [refreshWorkspace])

  const value = useMemo<AuthContextValue>(() => ({
    loading,
    session,
    user: session?.user || null,
    workspace,
    workspaces,
    async signIn(email: string, password: string) {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
    },
    async signUp(email: string, password: string) {
      const { error } = await supabase.auth.signUp({ email, password })
      if (error) throw error
    },
    async signOut() {
      await supabase.auth.signOut()
      setStoredWorkspaceId('')
    },
    refreshWorkspace,
  }), [loading, refreshWorkspace, session, workspace, workspaces])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
