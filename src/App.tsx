import { createHashRouter, RouterProvider, Navigate, Outlet } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isConfigured } from './lib/supabase'
import { UnsavedProvider } from './context/UnsavedContext'
import Layout from './components/Layout'
import ConfigGate from './components/ConfigGate'
import Login from './pages/Login'
import ResetPassword from './pages/ResetPassword'
import Home from './pages/Home'
import Tippen from './pages/Tippen'
import Bonus from './pages/Bonus'
import Tippuebersicht from './pages/Tippuebersicht'
import Leaderboard from './pages/Leaderboard'
import Tables from './pages/Tables'
import Rules from './pages/Rules'
import Admin from './pages/Admin'
import Profile from './pages/Profile'
import Groups from './pages/Groups'

function FullSpinner() {
  return (
    <div style={{ display: 'grid', placeItems: 'center', minHeight: '100vh' }}>
      <div className="skeleton" style={{ width: 220, height: 14 }} />
    </div>
  )
}

// Data-Router (HashRouter-kompatibel für GitHub Pages). Wurzel = Layout, das via
// <Outlet/> die Seiten rendert — so steht useBlocker (Tipp-Warnung) zur Verfügung.
const router = createHashRouter([
  {
    element: <Layout><Outlet /></Layout>,
    children: [
      { path: '/', element: <Home /> },
      { path: '/tippen', element: <Tippen /> },
      { path: '/bonus', element: <Bonus /> },
      { path: '/tippuebersicht', element: <Tippuebersicht /> },
      { path: '/gesamtliste', element: <Leaderboard /> },
      { path: '/tabellen', element: <Tables /> },
      { path: '/regeln', element: <Rules /> },
      { path: '/admin', element: <Admin /> },
      { path: '/profil', element: <Profile /> },
      { path: '/gruppen', element: <Groups /> },
      { path: '*', element: <Navigate to="/" replace /> },
    ],
  },
])

export default function App() {
  const { session, loading, recovery } = useAuth()

  if (!isConfigured) return <ConfigGate />
  if (loading) return <FullSpinner />
  if (recovery) return <ResetPassword />
  if (!session) return <Login />

  return (
    <UnsavedProvider>
      <RouterProvider router={router} />
    </UnsavedProvider>
  )
}
