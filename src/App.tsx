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
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    const handleInitialAuth = async () => {
      const hash = window.location.hash

      // Relaxed check: Simply look for access_token.
      if (hash.includes('access_token')) {
        console.log("🔒 Auth Token detected in hash")

        try {
          // Aggressive cleanup: remove everything up to the first param
          const cleanHash = hash.substring(hash.indexOf('access_token'))
          const params = new URLSearchParams(cleanHash)

          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')

          if (access_token) {
            console.log("🔑 Access Token extracted. Refresh Token:", refresh_token ? "Found" : "Missing")

            const sessionParams: any = { access_token }
            if (refresh_token) sessionParams.refresh_token = refresh_token

            const { error } = await supabase.auth.setSession(sessionParams)

            if (error) throw error

            console.log("✅ Session established via manual parse!")
            localStorage.removeItem('posthuman_auth_redirect')
            window.location.hash = '#/profile'
            setIsAuthProcessing(false)
            return
          } else {
            throw new Error("Token present but could not be parsed.")
          }
        } catch (err: any) {
          console.error("❌ Auth Error:", err)
          setAuthError(err.message || "Authentication Failed")
          setTimeout(() => setIsAuthProcessing(false), 3000)
          return
        }
      }

      // 2. Standard Session Check (Fallback)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const wasLoggingIn = localStorage.getItem('posthuman_auth_redirect')
        if (wasLoggingIn === 'true') {
          console.log("🔄 Redirect flag found (Standard Check), going to profile...")
          localStorage.removeItem('posthuman_auth_redirect')
          window.location.hash = '#/profile'
          return
        }
      } else {
        if (localStorage.getItem('posthuman_auth_redirect') === 'true') {
          console.warn("⚠️ Redirect flag set but no session found.")
          localStorage.removeItem('posthuman_auth_redirect')
        }
      }

      setIsAuthProcessing(false)
    }

    handleInitialAuth()

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, _session) => {
      // Optional: Handle auth state changes if needed
    })

    return () => subscription.unsubscribe()
  }, [])

  if (isAuthProcessing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <p className="animate-pulse text-gray-400">{authError ? `Error: ${authError}` : 'Finalizing secure connection...'}</p>
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
