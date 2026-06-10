import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './i18n'
import './index.css'
import { AuthProvider } from './context/AuthContext'
import App from './App'

// Der HashRouter (createHashRouter) lebt jetzt in App.tsx — AuthProvider umschließt ihn.
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
