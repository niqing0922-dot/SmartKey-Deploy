import { Navigate, useLocation } from 'react-router-dom'
import { supabaseConfigured } from '@/services/supabase'
import { useAuth } from './AuthProvider'

export function RequireAuth({ children }: { children: React.ReactElement }) {
  const auth = useAuth()
  const location = useLocation()

  if (!supabaseConfigured) {
    return (
      <div className="auth-page">
        <div className="auth-panel">
          <div className="auth-brand">SmartKey</div>
          <h1>Cloud configuration required</h1>
          <p>Set VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, SMARTKEY_CLOUD_ENABLED, SMARTKEY_DATABASE_URL, and SMARTKEY_SUPABASE_JWT_SECRET before using the collaborative app.</p>
        </div>
      </div>
    )
  }

  if (auth.loading) {
    const copy = auth.bootStatus === 'auth'
      ? 'Authenticating...'
      : auth.bootStatus === 'workspace'
        ? 'Loading workspace...'
        : 'Syncing cloud data...'

    return (
      <div className="boot-overlay" data-testid="boot.loading">
        <div className="boot-panel">
          <div className="boot-mark">
            <span className="boot-spinner" />
            <strong>SmartKey</strong>
          </div>
          <h1>Preparing your workspace</h1>
          <p>{copy}</p>
        </div>
      </div>
    )
  }

  if (auth.bootStatus === 'error') {
    return (
      <div className="boot-overlay" data-testid="boot.error">
        <div className="boot-panel">
          <div className="boot-mark">
            <strong>SmartKey</strong>
          </div>
          <h1>Workspace sync failed</h1>
          <p>{auth.bootError || 'The cloud workspace could not be loaded.'}</p>
          <button className="btn btn-primary" type="button" onClick={() => auth.refreshWorkspace().catch(() => undefined)}>
            Retry sync
          </button>
        </div>
      </div>
    )
  }

  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
