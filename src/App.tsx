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
    const handleInitialAuth = async () => {
      // 1. Manually parse hash for access_token (HashRouter makes this tricky, but we can look at window.location.href)
      // The hash might be like: http://.../#/access_token=... OR http://.../#access_token=...

      const hash = window.location.hash
      if (hash.includes('access_token=') && hash.includes('refresh_token=')) {
        console.log("🔒 Manual Auth Detected: Parsing tokens...")

        // Extract tokens using regex or URLSearchParams (tricky with HashRouter)
        // Let's assume standard supabase return: #access_token=...&expires_in=...&refresh_token=...

        try {
          // Remove the starting # or #/ 
          const paramsString = hash.replace(/^#\/?/, '')
          const params = new URLSearchParams(paramsString)
          const access_token = params.get('access_token')
          const refresh_token = params.get('refresh_token')

          if (access_token && refresh_token) {
            console.log("🔑 Tokens found, setting session manually...")
            const { error } = await supabase.auth.setSession({
              access_token,
              refresh_token
            })

            if (error) throw error

            console.log("✅ Session established manually!")
            window.location.hash = '#/profile'
            localStorage.removeItem('posthuman_auth_redirect') // Clear flag
            setIsAuthProcessing(false)
            return
          }
        } catch (err) {
          console.error("❌ Manual auth parse failed:", err)
        }
      }

      // 2. Standard Session Check
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        const wasLoggingIn = localStorage.getItem('posthuman_auth_redirect')
        if (wasLoggingIn === 'true') {
          console.log("🔄 Redirect flag found, going to profile...")
          localStorage.removeItem('posthuman_auth_redirect')
          window.location.hash = '#/profile'
        }
      }

      setIsAuthProcessing(false)
    }

    handleInitialAuth()

    // Keep listener just in case, but rely on manual for the initial redirect
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session) {
        // Verify we aren't already there?
      }
    })

    return () => subscription.unsubscribe()
  }, [])

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
