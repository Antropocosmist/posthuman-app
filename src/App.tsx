import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './components/Layout'
import { Dashboard } from './pages/Dashboard'
import { Trade } from './pages/Trade'
import { Profile } from './pages/Profile'

// Placeholders for remaining views
const Wallet = () => <div className="text-2xl font-bold">Wallet Manager</div>
const Browser = () => <div className="text-2xl font-bold">dApp Browser</div>

function App() {
  const [isAuthProcessing, setIsAuthProcessing] = useState(false)

  useEffect(() => {
    // Check if we are coming back from Supabase Auth (Implicit Flow)
    if (window.location.hash.includes('access_token=') || window.location.hash.includes('error=')) {
      console.log("🔒 Auth redirect detected, pausing router...")
      setIsAuthProcessing(true)

      // Allow Supabase to process the hash
      const timer = setTimeout(() => {
        // Explicitly redirect to profile page after auth
        console.log("✅ Auth processing complete. Redirecting to Profile...")
        if (window.location.hash.includes('access_token=')) {
          window.location.hash = '#/profile'
        }
      }, 1500) // Give Supabase 1.5s to grab the session

      return () => clearTimeout(timer)
    }
  }, [])

  if (isAuthProcessing) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-black text-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 rounded-full border-4 border-purple-500 border-t-transparent animate-spin" />
          <p className="animate-pulse text-gray-400">Verifying Logic...</p>
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
