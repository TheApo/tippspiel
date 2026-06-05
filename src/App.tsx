import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { isConfigured } from './lib/supabase'
import Layout from './components/Layout'
import ConfigGate from './components/ConfigGate'
import Login from './pages/Login'
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

export default function App() {
  const { session, loading } = useAuth()

  if (!isConfigured) return <ConfigGate />
  if (loading) return <FullSpinner />
  if (!session) return <Login />

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/tippen" element={<Tippen />} />
        <Route path="/bonus" element={<Bonus />} />
        <Route path="/tippuebersicht" element={<Tippuebersicht />} />
        <Route path="/gesamtliste" element={<Leaderboard />} />
        <Route path="/tabellen" element={<Tables />} />
        <Route path="/regeln" element={<Rules />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/profil" element={<Profile />} />
        <Route path="/gruppen" element={<Groups />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  )
}
