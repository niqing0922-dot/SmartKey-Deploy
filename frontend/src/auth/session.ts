import { supabase } from '@/services/supabase'

const WORKSPACE_KEY = 'smartkey.cloud.workspaceId'
const CLOUD_ACTIVE_KEY = 'smartkey.cloud.active'

export function getStoredWorkspaceId() {
  return window.localStorage.getItem(WORKSPACE_KEY) || ''
}

export function cloudWorkspaceActive() {
  return window.localStorage.getItem(CLOUD_ACTIVE_KEY) === '1'
}

export function setStoredWorkspaceId(workspaceId: string) {
  if (workspaceId) {
    window.localStorage.setItem(WORKSPACE_KEY, workspaceId)
    window.localStorage.setItem(CLOUD_ACTIVE_KEY, '1')
  } else {
    window.localStorage.removeItem(WORKSPACE_KEY)
    window.localStorage.removeItem(CLOUD_ACTIVE_KEY)
  }
}

export async function getAccessToken() {
  const { data } = await supabase.auth.getSession()
  return data.session?.access_token || ''
}
