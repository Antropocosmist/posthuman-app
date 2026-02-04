import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, Send, CheckCircle2, AlertCircle, RefreshCw, Search } from 'lucide-react'
import { useWalletStore } from '../../wallet/store/walletStore'

interface SendModalProps {
    isOpen: boolean
    onClose: () => void
}

export function SendModal({ isOpen, onClose }: SendModalProps) {
    const { wallets, sendTransaction, selectedAssetId } = useWalletStore()

    const [selectedToken, setSelectedToken] = useState(wallets[0] || null)

    // Sync with external selection
    useEffect(() => {
        if (isOpen && selectedAssetId) {
            const asset = wallets.find(w => w.id === selectedAssetId)
            if (asset) setSelectedToken(asset)
        } else if (isOpen && !selectedToken && wallets.length > 0) {
            setSelectedToken(wallets[0])
        }
    }, [isOpen, selectedAssetId, wallets])

    const [recipient, setRecipient] = useState('')
    const [amount, setAmount] = useState('')
    const [memo, setMemo] = useState('')
    const [isSelectingToken, setIsSelectingToken] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')

    const filteredWallets = wallets.filter(w =>
        w.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'error'>('idle')
    const [errorMsg, setErrorMsg] = useState('')
    const [txHash, setTxHash] = useState('')

    const isValidAddress = (addr: string) => {
        if (!addr) return true // Don't show error if empty
        if (!selectedToken) return true

        const chain = selectedToken.chain
        if (chain === 'EVM') return /^0x[a-fA-F0-9]{40}$/.test(addr)
        if (chain === 'Solana') return /^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(addr)
        if (chain === 'Cosmos') {
            const name = selectedToken.name.toLowerCase()
            if (name.includes('juno')) return /^juno1[a-z0-9]{38}$/.test(addr)
            if (name.includes('osmo')) return /^osmo1[a-z0-9]{38}$/.test(addr)
            if (name.includes('neutron')) return /^neutron1[a-z0-9]{38}$/.test(addr)
            if (name.includes('hub')) return /^cosmos1[a-z0-9]{38}$/.test(addr)
            return /^[a-z]{2,10}1[a-z0-9]{38}$/.test(addr)
        }
        return true
    }

    const isAddressRefused = recipient.length > 5 && !isValidAddress(recipient)

    const handleMax = () => {
        if (!selectedToken) return

        let max = selectedToken.nativeBalance

        // Subtract gas buffer
        if (selectedToken.chain === 'EVM') {
            const buffer = 0.0005 // Approx cost for standard transfer at moderate gwei
            max = Math.max(0, max - buffer)
        } else if (selectedToken.chain === 'Solana') {
            const buffer = 0.000005
            max = Math.max(0, max - buffer)
        } else if (selectedToken.chain === 'Cosmos') {
            const buffer = 0.005
            max = Math.max(0, max - buffer)
        }

        setAmount(max.toString())
    }

    const handleSend = async () => {
        if (!selectedToken || !recipient || !amount || isAddressRefused) return

        setStatus('loading')
        setErrorMsg('')
        try {
            const hash = await sendTransaction(selectedToken.id, recipient, amount, memo)
            setTxHash(hash)
            setStatus('success')

            await useWalletStore.getState().refreshBalances()

            setTimeout(() => {
                onClose()
                setStatus('idle')
                setAmount('')
                setRecipient('')
                setMemo('')
                setTxHash('')
            }, 5000)
        } catch (err: any) {
            console.error(err)
            setStatus('error')
            setErrorMsg(err.message || 'Transaction failed')
        }
    }

    if (!isOpen) return null

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={onClose}
        >
            <motion.div
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="w-full max-w-md bg-[#16161e] border border-white/10 rounded-3xl overflow-hidden shadow-2xl relative"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-white/5">
                    <h2 className="text-xl font-bold text-white flex items-center gap-2">
                        <Send className="w-5 h-5 text-purple-400" />
                        Send Asset
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-5">
                    {/* Token Selection */}
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">Select Asset</label>
                        <button
                            onClick={() => setIsSelectingToken(true)}
                            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-purple-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-3 text-left">
                                {selectedToken ? (
                                    <>
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-black/50">
                                            <img src={selectedToken.icon} className="w-full h-full object-cover" />
                                        </div>
                                        <div>
                                            <div className="font-bold text-white leading-none">{selectedToken.symbol}</div>
                                            <div className="text-[10px] text-gray-500 mt-1">{selectedToken.name}</div>
                                        </div>
                                    </>
                                ) : (
                                    <div className="text-gray-400">Choose a token</div>
                                )}
                            </div>
                            <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-purple-400" />
                        </button>
                    </div>

                    {/* Amount */}
                    <div>
                        <div className="flex justify-between mb-2">
                            <label className="text-[10px] uppercase tracking-widest text-gray-500">Amount</label>
                            {selectedToken && (
                                <span className="text-[10px] text-gray-400 cursor-pointer hover:text-purple-400 decoration-purple-400/30 underline-offset-4 hover:underline" onClick={handleMax}>
                                    Max: {selectedToken.nativeBalance.toFixed(4)} {selectedToken.symbol}
                                </span>
                            )}
                        </div>
                        <div className="relative">
                            <input
                                type="number"
                                placeholder="0.00"
                                className="w-full p-4 pr-16 rounded-2xl bg-white/5 border border-white/10 text-xl font-bold text-white outline-none focus:border-purple-500/50 transition-all font-mono"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                            />
                            <div className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-gray-500">
                                {selectedToken?.symbol}
                            </div>
                        </div>
                    </div>

                    {/* Recipient */}
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">Recipient Address</label>
                        <input
                            type="text"
                            placeholder="Enter address..."
                            className={`w-full p-4 rounded-2xl bg-white/5 border text-white outline-none transition-all text-sm font-mono
                                ${isAddressRefused ? 'border-red-500/50 focus:border-red-500 shadow-[0_0_10px_rgba(239,68,68,0.1)]' : 'border-white/10 focus:border-purple-500/50'}
                            `}
                            value={recipient}
                            onChange={(e) => setRecipient(e.target.value)}
                        />
                        {isAddressRefused && (
                            <div className="text-[10px] text-red-500 font-bold mt-2 animate-pulse flex items-center gap-1">
                                <AlertCircle className="w-3 h-3" />
                                Invalid address format! Transaction may fail!
                            </div>
                        )}
                    </div>

                    {/* Memo */}
                    {selectedToken?.chain === 'Cosmos' && (
                        <div>
                            <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">Memo (Optional)</label>
                            <input
                                type="text"
                                placeholder="Add a reference..."
                                className="w-full p-4 rounded-2xl bg-white/5 border border-white/10 text-white outline-none focus:border-purple-500/50 transition-all text-sm"
                                value={memo}
                                onChange={(e) => setMemo(e.target.value)}
                            />
                        </div>
                    )}

                    {/* Status Feedback */}
                    <AnimatePresence mode="wait">
                        {status === 'loading' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex items-center justify-center gap-3 py-4 text-purple-400">
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                <span className="text-sm font-bold">Waiting for wallet signature...</span>
                            </motion.div>
                        )}
                        {status === 'success' && (
                            <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }} className="flex flex-col items-center justify-center gap-2 py-4 text-green-400">
                                <CheckCircle2 className="w-8 h-8" />
                                <span className="text-sm font-bold uppercase tracking-widest">Transaction Sent!</span>
                                {txHash && (
                                    <div className="text-[10px] text-gray-500 font-mono mt-2 flex flex-col items-center">
                                        <span className="opacity-50">TX Hash:</span>
                                        <span className="truncate w-40 text-center text-xs">{txHash}</span>
                                    </div>
                                )}
                            </motion.div>
                        )}
                        {status === 'error' && (
                            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="flex flex-col gap-2 p-4 bg-red-500/10 border border-red-500/50 rounded-2xl text-red-400">
                                <div className="flex items-center gap-2">
                                    <AlertCircle className="w-5 h-5" />
                                    <span className="text-sm font-bold uppercase tracking-wider">Transaction Failed</span>
                                </div>
                                <span className="text-xs leading-relaxed opacity-90">{errorMsg}</span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Send Button */}
                    <button
                        disabled={!selectedToken || !recipient || !amount || status === 'loading' || isAddressRefused}
                        onClick={handleSend}
                        className={`w-full py-5 rounded-2xl font-bold text-lg transition-all shadow-xl
                            ${(!selectedToken || !recipient || !amount || status === 'loading' || isAddressRefused)
                                ? 'bg-white/5 text-gray-500 cursor-not-allowed border border-white/5'
                                : 'bg-gradient-to-r from-purple-600 to-blue-600 text-white hover:scale-[1.02] active:scale-[0.98] hover:shadow-[0_10px_40px_rgba(168,85,247,0.3)]'}
                        `}
                    >
                        {status === 'loading' ? 'Executing...' : 'Confirm & Send'}
                    </button>
                </div>

                {/* Inner Token Selector */}
                <AnimatePresence>
                    {isSelectingToken && (
                        <motion.div
                            initial={{ x: '100%' }}
                            animate={{ x: 0 }}
                            exit={{ x: '100%' }}
                            transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                            className="absolute inset-0 z-20 bg-[#121218] p-6 flex flex-col"
                        >
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Choose Asset</h3>
                                <button onClick={() => setIsSelectingToken(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="relative mb-4">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search by name or symbol..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-purple-500/50 transition-all font-medium"
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    autoFocus
                                />
                            </div>

                            <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                {filteredWallets.map(w => (
                                    <button
                                        key={w.id}
                                        onClick={() => { setSelectedToken(w); setIsSelectingToken(false); setSearchTerm(''); }}
                                        className="w-full flex items-center justify-between p-4 rounded-2xl hover:bg-white/5 transition-colors border border-transparent hover:border-white/10 group text-left"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="w-10 h-10 rounded-full overflow-hidden bg-black/50 border border-white/5">
                                                <img src={w.icon} className="w-full h-full object-cover" />
                                            </div>
                                            <div>
                                                <div className="font-bold text-white group-hover:text-purple-400 transition-colors">{w.symbol}</div>
                                                <div className="text-[10px] text-gray-500">{w.name}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-sm font-bold text-white">${w.balance.toFixed(2)}</div>
                                            <div className="text-[10px] text-gray-500">{w.nativeBalance.toFixed(4)} {w.symbol}</div>
                                        </div>
                                    </button>
                                ))}
                                {wallets.length === 0 && (
                                    <div className="text-center py-20 text-gray-600 italic text-sm">No assets found. Connect a wallet first.</div>
                                )}
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </motion.div>
        </div>
    )
}
