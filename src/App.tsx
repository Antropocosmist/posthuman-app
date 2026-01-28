import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Trade } from './pages/Trade'
import { Profile } from './pages/Profile'

// Placeholders for remaining views
const Wallet = () => <div className="text-2xl font-bold">Wallet Manager</div>
const Browser = () => <div className="text-2xl font-bold">dApp Browser</div>

import { supabase } from './services/supa'

function App() {
  const [isAuthProcessing, setIsAuthProcessing] = useState(true) // Start true to check session first

  useEffect(() => {
    // 1. Check for active session immediately
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        // If no session, but we have a hash token, let's wait a bit
        if (window.location.hash.includes('access_token=')) {
          console.log("🔒 Hash token detected, waiting for Supabase to parse...")
          return
        }
        setIsAuthProcessing(false)
      } else {
        handleAuthRedirect()
        setIsAuthProcessing(false)
      }
    })

    // 2. Listen for auth changes (this handles the hash parsing)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      console.log(`Auth event: ${event}`, session?.user?.email)

      if (event === 'SIGNED_IN' && session) {
        handleAuthRedirect()
        setIsAuthProcessing(false)
      }

      if (event === 'SIGNED_OUT') {
        setIsAuthProcessing(false)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  const handleAuthRedirect = () => {
    const wasLoggingIn = localStorage.getItem('posthuman_auth_redirect')
    if (wasLoggingIn === 'true') {
      console.log("✅ Completing auth redirect flow -> Profile")
      localStorage.removeItem('posthuman_auth_redirect')
      // Force hash change to profile
      if (window.location.hash !== '#/profile') {
        window.location.hash = '#/profile'
      }
    }
  }

  if (isAuthProcessing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <p className="animate-pulse text-gray-400">Loading Posthuman...</p>
        </div>
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="trade" element={<Trade />} />
          <Route path="wallet" element={<Wallet />} />
          <Route path="browser" element={<Browser />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
