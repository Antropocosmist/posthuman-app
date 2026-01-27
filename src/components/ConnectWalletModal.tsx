import { motion, AnimatePresence } from 'framer-motion'
import { X, Wallet, Plus } from 'lucide-react'
import { useWalletStore, type ChainType } from '../store/walletStore'

export function ConnectWalletModal() {
    const { isModalOpen, toggleModal, connectWallet, wallets, disconnectWallet } = useWalletStore()

    // walletOptions replaced by inline array below

    return (
        <AnimatePresence>
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={toggleModal}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        exit={{ scale: 0.9, opacity: 0 }}
                        className="relative w-full max-w-md bg-[#0e0e12] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                    >
                        <div className="flex items-center justify-between p-6 border-b border-white/5">
                            <h2 className="text-xl font-bold text-white flex items-center gap-2">
                                <Wallet className="w-5 h-5 text-purple-500" /> Wallet Manager
                            </h2>
                            <button onClick={toggleModal} className="text-gray-400 hover:text-white transition-colors">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-6 max-h-[70vh] overflow-y-auto custom-scrollbar">
                            {/* Connected Wallets List */}
                            {wallets.length > 0 && (
                                <div className="space-y-3">
                                    <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">Connected</h3>
                                    <div className="space-y-2">
                                        {Array.from(new Set(wallets.map(w => w.walletProvider))).map(provider => {
                                            const providerWallets = wallets.filter(w => w.walletProvider === provider)
                                            const totalBalance = providerWallets.reduce((acc, w) => acc + w.balance, 0)
                                            const firstWallet = providerWallets[0]

                                            return (
                                                <div key={provider} className="flex items-center justify-between p-3 rounded-xl bg-white/5 border border-white/10 hover:border-white/20 transition-all">
                                                    <div className="flex items-center gap-3">
                                                        <div className="w-8 h-8 rounded-full bg-black/50 flex items-center justify-center text-lg overflow-hidden border border-white/5">
                                                            {firstWallet.icon.startsWith('/') ? (
                                                                <img src={firstWallet.icon} alt={provider} className="w-full h-full object-cover" />
                                                            ) : (
                                                                firstWallet.icon
                                                            )}
                                                        </div>
                                                        <div>
                                                            <div className="font-bold text-sm text-white leading-tight">{provider}</div>
                                                            <div className="text-[10px] text-gray-500 font-mono mt-0.5">{providerWallets.length} Addresses Connected</div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right">
                                                        <div className="font-bold text-green-400 text-sm leading-none">${totalBalance.toLocaleString('en-US', { maximumFractionDigits: 2 })}</div>
                                                        <button
                                                            onClick={() => disconnectWallet(provider)}
                                                            className="text-[10px] text-red-400/60 hover:text-red-400 underline mt-1 block w-full text-right"
                                                        >
                                                            Disconnect
                                                        </button>
                                                    </div>
                                                </div>
                                            )
                                        })}
                                    </div>
                                </div>
                            )}

                            {/* Connect New Options */}
                            <div className="space-y-4">
                                <h3 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-1">
                                    {wallets.length > 0 ? 'Add Another Account' : 'Connect Account'}
                                </h3>
                                <div className="grid grid-cols-1 gap-3">
                                    {[
                                        { name: 'MetaMask', chain: 'EVM' as ChainType, icon: '/icons/metamask.png', color: 'bg-orange-500/10 border-orange-500/20 hover:border-orange-500 hover:shadow-[0_0_20px_rgba(249,115,22,0.1)]' },
                                        { name: 'Rabby', chain: 'EVM' as ChainType, icon: '/icons/rabby.png', color: 'bg-blue-600/10 border-blue-600/20 hover:border-blue-600 hover:shadow-[0_0_20px_rgba(37,99,235,0.1)]' },
                                        { name: 'Phantom', chain: 'Solana' as ChainType, icon: '/icons/phantom.png', color: 'bg-purple-500/10 border-purple-500/20 hover:border-purple-500 hover:shadow-[0_0_20px_rgba(168,85,247,0.1)]' },
                                        { name: 'Solflare', chain: 'Solana' as ChainType, icon: '/icons/solflare.png', color: 'bg-orange-400/10 border-orange-400/20 hover:border-orange-400 hover:shadow-[0_0_20px_rgba(251,146,60,0.1)]' },
                                        { name: 'Keplr', chain: 'Cosmos' as ChainType, icon: '/icons/keplr.png', color: 'bg-blue-500/10 border-blue-500/20 hover:border-blue-500 hover:shadow-[0_0_20px_rgba(59,130,246,0.1)]' },
                                    ]
                                        .filter(option => !wallets.some(w => w.walletProvider === option.name)) // FILTER: Hide if already connected
                                        .map(option => (
                                            <button
                                                key={option.name}
                                                onClick={() => connectWallet(option.name, option.chain)}
                                                className={`flex items-center gap-4 p-4 rounded-2xl border transition-all duration-300 group ${option.color}`}
                                            >
                                                <div className="w-10 h-10 flex items-center justify-center p-1">
                                                    <img src={option.icon} alt={option.name} className="w-full h-full object-contain group-hover:scale-110 transition-transform" />
                                                </div>
                                                <div className="text-left flex-1">
                                                    <div className="font-bold text-white group-hover:text-purple-300 transition-colors text-lg">{option.name}</div>
                                                    <div className="text-xs text-gray-500 font-medium">{option.chain} Network</div>
                                                </div>
                                                <Plus className="w-6 h-6 text-gray-600 group-hover:text-white transition-colors" />
                                            </button>
                                        ))}
                                </div>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    )
}
