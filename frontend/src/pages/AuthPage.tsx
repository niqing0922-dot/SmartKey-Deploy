import { useState } from 'react'
import type { FormEvent } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/auth/AuthProvider'

export function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const from = (location.state as any)?.from?.pathname || '/'

  if (auth.session) return <Navigate to={from} replace />

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await auth.signIn(email, password)
      } else {
        await auth.signUp(email, password)
      }
      await auth.refreshWorkspace().catch(() => undefined)
      navigate(from, { replace: true })
    } catch (err: any) {
      setError(err?.message || 'Authentication failed.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="auth-page">
      <form className="auth-panel" onSubmit={submit}>
        <div className="auth-brand">SmartKey</div>
        <h1>{mode === 'login' ? 'Sign in to your workspace' : 'Create your SmartKey account'}</h1>
        <p>Cloud collaboration stores keywords, articles, GEO drafts, and shared settings in your team workspace.</p>
        {error ? <div className="alert alert-danger">{error}</div> : null}
        <label>Email</label>
        <input className="input" type="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
        <label>Password</label>
        <input className="input" type="password" value={password} onChange={(event) => setPassword(event.target.value)} required minLength={6} />
        <button className="btn btn-primary" type="submit" disabled={submitting}>{submitting ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}</button>
        <button className="btn" type="button" onClick={() => navigate(mode === 'login' ? '/signup' : '/login')}>
          {mode === 'login' ? 'Create an account' : 'Use an existing account'}
        </button>
      </form>
    </div>
  )
}
