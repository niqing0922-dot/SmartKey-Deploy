import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter, HashRouter } from 'react-router-dom'
import App from './App'
import { AuthProvider } from '@/auth/AuthProvider'
import '@/app/styles.css'

const DesktopRouter =
  typeof window !== 'undefined' &&
  (window.location.protocol === 'file:' || window.smartKeyDesktop?.runtimeConfig?.mode === 'cloud-api')
    ? HashRouter
    : BrowserRouter

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <DesktopRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </DesktopRouter>
  </React.StrictMode>,
)
