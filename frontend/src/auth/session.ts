import { supabase } from '@/services/supabase'

const WORKSPACE_KEY = 'smartkey.cloud.workspaceId'

export function getStoredWorkspaceId() {
  return window.localStorage.getItem(WORKSPACE_KEY) || ''
}

export function setStoredWorkspaceId(workspaceId: string) {
  if (workspaceId) {
    window.localStorage.setItem(WORKSPACE_KEY, workspaceId)
  } else {
    window.localStorage.removeItem(WORKSPACE_KEY)
  }
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}
