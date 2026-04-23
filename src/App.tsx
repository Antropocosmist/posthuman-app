import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { Layout } from './shared/components/Layout'
import { Dashboard } from './features/dashboard/pages/Dashboard'
import { Trade } from './features/trade/pages/Trade'
import { Profile } from './features/profile/pages/Profile'
import { PHMN } from './features/phmn/pages/PHMN'
import { NFTs } from './features/nft/pages/NFTs'
import { Settings } from './features/profile/pages/Settings'

// Placeholder for Chat
const Chat = () => <div className="text-2xl font-bold">Chat System</div>

import { auth } from './shared/config/firebase'
import { onAuthStateChanged } from 'firebase/auth'

// ... imports remain ...

import { useWalletStore } from './features/wallet/store/walletStore'

function App() {
  const [isAuthProcessing, setIsAuthProcessing] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    // Firebase Auth Listener
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      console.log("🔥 Firebase Auth State Changed:", user ? user.email : "No User");

      if (user) {
        // Sync Trades (Standard Load)
        useWalletStore.getState().fetchTrades()
      } else {
        useWalletStore.getState().clearState()
      }
      setIsAuthProcessing(false)
    }, (error) => {
      console.error("Firebase Auth Error:", error);
      setAuthError(error.message);
      setIsAuthProcessing(false);
    });

    return () => unsubscribe();
  }, [])

  // 3. React to Hydration Completion
  const hasHydrated = useWalletStore(state => state.hasHydrated)
  useEffect(() => {
    if (hasHydrated) {
      console.log("💧 Storage hydrated, syncing trades...")
      useWalletStore.getState().fetchTrades()
    }
  }, [hasHydrated])

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
          <Route path="nfts" element={<NFTs />} />
          <Route path="chat" element={<Chat />} />
          <Route path="phmn" element={<PHMN />} />
          <Route path="settings" element={<Settings />} />
          <Route path="profile" element={<Profile />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Router>
  )
}

export default App
