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
    return <div className="auth-page"><div className="auth-panel"><div className="auth-brand">SmartKey</div><p>Loading workspace...</p></div></div>
  }

  if (!auth.session) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}
