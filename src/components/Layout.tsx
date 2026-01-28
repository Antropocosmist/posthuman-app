import { Link, useLocation, Outlet } from 'react-router-dom'
import { LayoutDashboard, ArrowRightLeft, Wallet, User, Globe, Settings } from 'lucide-react'
import { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { ConnectWalletModal } from './ConnectWalletModal'
import { SendModal } from './SendModal'
import { ReceiveModal } from './ReceiveModal'
import { useWalletStore } from '../store/walletStore'
import { LoadingOverlay } from './LoadingOverlay'

export function Layout() {
    const location = useLocation()
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768)
    const {
        toggleModal,
        wallets,
        getTotalBalance,
        isSendModalOpen,
        toggleSendModal,
        isReceiveModalOpen,
        toggleReceiveModal
    } = useWalletStore()

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < 768)
        window.addEventListener('resize', handleResize)
        return () => window.removeEventListener('resize', handleResize)
    }, [])

    const navItems = [
        { icon: LayoutDashboard, label: 'Dashboard', path: '/' },
        { icon: ArrowRightLeft, label: 'Trade', path: '/trade' },
        { icon: Wallet, label: 'Wallet', path: '/wallet' },
        { icon: Globe, label: 'Browser', path: '/browser' },
        { icon: User, label: 'Profile', path: '/profile' },
    ]

    const isActive = (path: string) => location.pathname === path

    return (
        <div className="flex h-screen w-full bg-black text-white overflow-hidden font-sans">
            <LoadingOverlay />
            <ConnectWalletModal />
            <SendModal isOpen={isSendModalOpen} onClose={toggleSendModal} />
            <ReceiveModal isOpen={isReceiveModalOpen} onClose={toggleReceiveModal} />

            {/* Desktop Sidebar */}
            {!isMobile && (
                <div className="w-64 border-r border-white/10 flex flex-col p-6 bg-[#050505]">
                    <div className="flex items-center gap-3 mb-10">
                        <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Posthuman" className="w-10 h-10 object-contain" />
                        <span className="font-bold text-xl tracking-widest">POSTHUMAN</span>
                    </div>

                    <nav className="space-y-2 flex-1">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex items-center gap-3 p-3 rounded-xl transition-all duration-300 ${isActive(item.path)
                                    ? 'bg-white text-black shadow-lg shadow-white/10'
                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                    }`}
                            >
                                <item.icon className="w-5 h-5" />
                                <span className="font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </nav>

                    <div className="pt-6 border-t border-white/10">
                        <button className="flex items-center gap-3 w-full p-3 rounded-xl text-gray-400 hover:text-white hover:bg-white/5 transition-colors">
                            <Settings className="w-5 h-5" />
                            <span>Settings</span>
                        </button>
                    </div>
                </div>
            )}

            {/* Main Content Area */}
            <div className="flex-1 flex flex-col h-full relative overflow-y-auto custom-scrollbar">
                {/* Header (Mobile & Desktop) */}
                <header className="sticky top-0 z-30 flex items-center justify-between p-4 bg-black/80 backdrop-blur-md border-b border-white/5">
                    {isMobile && (
                        <div className="flex items-center gap-2">
                            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="Logo" className="w-8 h-8" />
                            <span className="font-bold tracking-wide">POSTHUMAN</span>
                        </div>
                    )}

                    <div className="ml-auto flex items-center gap-4">
                        <div className="hidden md:flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-xs text-green-400">
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                            Nodes Online
                        </div>

                        <button
                            onClick={toggleModal}
                            className={`px-4 py-2 rounded-lg font-bold text-sm hover:scale-105 transition-all flex items-center gap-2 ${wallets.length > 0
                                ? 'bg-purple-900/50 text-purple-200 border border-purple-500/50'
                                : 'bg-white text-black'
                                }`}
                        >
                            {wallets.length > 0 ? (
                                <>
                                    <Wallet className="w-4 h-4" />
                                    <span>{wallets.length} Connected</span>
                                    <span className="bg-black/20 px-2 py-0.5 rounded text-xs ml-1">{getTotalBalance()}</span>
                                </>
                            ) : (
                                'Connect Wallet'
                            )}
                        </button>
                    </div>
                </header>

                <main className="flex-1 p-4 pb-24 md:pb-4 max-w-7xl mx-auto w-full">
                    <Outlet />
                </main>
            </div>

            {/* Mobile Bottom Navigation */}
            {isMobile && (
                <div className="fixed bottom-0 left-0 right-0 bg-[#0a0a0a] border-t border-white/10 p-2 pb-6 z-40">
                    <div className="flex justify-around items-center">
                        {navItems.map((item) => (
                            <Link
                                key={item.path}
                                to={item.path}
                                className={`flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${isActive(item.path) ? 'text-white' : 'text-gray-500'
                                    }`}
                            >
                                <motion.div
                                    whileTap={{ scale: 0.9 }}
                                    className={`p-1 rounded-full ${isActive(item.path) ? 'bg-white/10' : ''}`}
                                >
                                    <item.icon className="w-6 h-6" />
                                </motion.div>
                                <span className="text-[10px] font-medium">{item.label}</span>
                            </Link>
                        ))}
                    </div>
                </div>
            )}
        </div>
    )
}
