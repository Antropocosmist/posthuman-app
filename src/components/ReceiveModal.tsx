import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronDown, Copy, QrCode, Download, Share2, Search, CheckCircle2 } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import { useWalletStore } from '../store/walletStore'

interface ReceiveModalProps {
    isOpen: boolean
    onClose: () => void
}

export function ReceiveModal({ isOpen, onClose }: ReceiveModalProps) {
    const { wallets, selectedAssetId } = useWalletStore()
    const [selectedToken, setSelectedToken] = useState(wallets[0] || null)
    const [isSelectingToken, setIsSelectingToken] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [copied, setCopied] = useState(false)
    const qrRef = useRef<HTMLDivElement>(null)

    // Sync with external selection
    useEffect(() => {
        if (isOpen && selectedAssetId) {
            const asset = wallets.find(w => w.id === selectedAssetId)
            if (asset) setSelectedToken(asset)
        } else if (isOpen && !selectedToken && wallets.length > 0) {
            setSelectedToken(wallets[0])
        }
    }, [isOpen, selectedAssetId, wallets])

    const filteredWallets = wallets.filter(w =>
        w.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        w.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const handleCopy = () => {
        if (!selectedToken) return
        navigator.clipboard.writeText(selectedToken.address)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
    }

    const handleDownloadQR = () => {
        if (!qrRef.current) return
        const svg = qrRef.current.querySelector('svg')
        if (!svg) return

        const svgData = new XMLSerializer().serializeToString(svg)
        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d')
        const img = new Image()

        img.onload = () => {
            canvas.width = img.width + 40
            canvas.height = img.height + 40
            if (ctx) {
                ctx.fillStyle = 'white'
                ctx.fillRect(0, 0, canvas.width, canvas.height)
                ctx.drawImage(img, 20, 20)
                const pngFile = canvas.toDataURL('image/png')
                const downloadLink = document.createElement('a')
                downloadLink.download = `qr-${selectedToken?.symbol || 'address'}.png`
                downloadLink.href = pngFile
                downloadLink.click()
            }
        }
        img.src = 'data:image/svg+xml;base64,' + btoa(svgData)
    }

    const handleShare = async () => {
        if (!selectedToken) return
        const shareData = {
            title: `My ${selectedToken.symbol} Address`,
            text: `Here is my ${selectedToken.name} address: ${selectedToken.address}`,
            url: window.location.href
        }

        try {
            if (navigator.share) {
                await navigator.share(shareData)
            } else {
                // Fallback to email
                window.location.href = `mailto:?subject=My ${selectedToken.symbol} Address&body=${shareData.text}`
            }
        } catch (err) {
            console.error('Error sharing:', err)
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
                        <QrCode className="w-5 h-5 text-blue-400" />
                        Receive Asset
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Token Selection */}
                    <div>
                        <label className="text-[10px] uppercase tracking-widest text-gray-500 mb-2 block">Select Asset</label>
                        <button
                            onClick={() => setIsSelectingToken(true)}
                            className="w-full flex items-center justify-between p-4 rounded-2xl bg-white/5 border border-white/10 hover:border-blue-500/30 transition-all group"
                        >
                            <div className="flex items-center gap-3 text-left">
                                {selectedToken ? (
                                    <>
                                        <div className="w-8 h-8 rounded-full overflow-hidden bg-black/50 border border-white/10">
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
                            <ChevronDown className="w-5 h-5 text-gray-500 group-hover:text-blue-400" />
                        </button>
                    </div>

                    {/* QR Code Display */}
                    <AnimatePresence mode="wait">
                        {selectedToken && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="flex flex-col items-center gap-6"
                            >
                                <div
                                    ref={qrRef}
                                    className="p-4 bg-white rounded-2xl shadow-[0_0_30px_rgba(255,255,255,0.05)]"
                                >
                                    <QRCodeSVG
                                        value={selectedToken.address}
                                        size={200}
                                        level="H"
                                        includeMargin={false}
                                    />
                                </div>

                                <div className="w-full space-y-3">
                                    <label className="text-[10px] uppercase tracking-widest text-gray-500 block text-center">Your Deposit Address</label>
                                    <div className="flex items-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 group hover:border-white/20 transition-all">
                                        <code className="flex-1 text-xs text-blue-300 font-mono break-all leading-relaxed whitespace-pre-wrap">
                                            {selectedToken.address}
                                        </code>
                                    </div>
                                </div>

                                {/* Action Buttons */}
                                <div className="grid grid-cols-3 gap-3 w-full">
                                    <button
                                        onClick={handleCopy}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all group"
                                    >
                                        {copied ? <CheckCircle2 className="w-5 h-5 text-green-400" /> : <Copy className="w-5 h-5 text-gray-400 group-hover:text-blue-300" />}
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-white">Copy</span>
                                    </button>
                                    <button
                                        onClick={handleDownloadQR}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all group"
                                    >
                                        <Download className="w-5 h-5 text-gray-400 group-hover:text-blue-300" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-white">Save</span>
                                    </button>
                                    <button
                                        onClick={handleShare}
                                        className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl bg-white/5 border border-white/10 hover:bg-white/10 hover:border-blue-500/30 transition-all group"
                                    >
                                        <Share2 className="w-5 h-5 text-gray-400 group-hover:text-blue-300" />
                                        <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500 group-hover:text-white">Share</span>
                                    </button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
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
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="text-sm font-bold uppercase tracking-widest text-gray-500">Choose Deposit Asset</h3>
                                <button onClick={() => setIsSelectingToken(false)} className="p-2 hover:bg-white/5 rounded-full text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Search Bar */}
                            <div className="relative mb-6">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                <input
                                    type="text"
                                    placeholder="Search asset..."
                                    className="w-full bg-white/5 border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-medium"
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
                                                <div className="font-bold text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{w.symbol}</div>
                                                <div className="text-[10px] text-gray-500 font-medium">{w.chain === 'Cosmos' ? w.name : `${w.chain} • ${w.name}`}</div>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-[10px] text-gray-500 uppercase tracking-widest mb-1">{w.chain === 'Cosmos' ? '' : w.chain}</div>
                                            <div className="text-xs font-mono text-white/50">{w.address.slice(0, 6)}...{w.address.slice(-4)}</div>
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
