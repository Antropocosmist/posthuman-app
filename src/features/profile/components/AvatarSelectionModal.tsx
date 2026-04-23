import { useState, useRef } from 'react'
import { storage } from '../../../shared/config/firebase'
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage'
import { X, Upload, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useWalletStore } from '../../wallet/store/walletStore'
import type { NFT } from '../../nft/types/types'
import { stargazeNFTService } from '../../nft/cosmos/services/stargaze'
import { magicEdenNFTService } from '../../nft/solana/services/magiceden'
import { openSeaNFTService } from '../../nft/evm/services/opensea'

interface AvatarSelectionModalProps {
    isOpen: boolean
    onClose: () => void
    onSelect: (url: string) => void
    currentAvatar?: string
}

export function AvatarSelectionModal({ isOpen, onClose, onSelect }: AvatarSelectionModalProps) {
    const [activeTab, setActiveTab] = useState<'upload' | 'nft'>('upload')
    const [uploading, setUploading] = useState(false)
    const [uploadError, setUploadError] = useState<string | null>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)

    // NFT Logic
    const { wallets } = useWalletStore()
    const [nfts, setNfts] = useState<NFT[]>([])
    const [loadingNfts, setLoadingNfts] = useState(false)
    const [offset, setOffset] = useState(0)

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (!e.target.files || e.target.files.length === 0) return

        const file = e.target.files[0]
        const fileExt = file.name.split('.').pop()
        const fileName = `${Math.random().toString(36).substring(2)}.${fileExt}`
        const filePath = `avatars/${fileName}`

        setUploading(true)
        setUploadError(null)

        try {
            const storageRef = ref(storage, filePath)
            await uploadBytes(storageRef, file)
            const publicUrl = await getDownloadURL(storageRef)

            onSelect(publicUrl)
            onClose()
        } catch (error: any) {
            console.error('Upload failed:', error)
            setUploadError(error.message || 'Failed to upload image')
        } finally {
            setUploading(false)
        }
    }

    // Real NFT Fetcher
    const loadNfts = async (isLoadMore = false) => {
        setLoadingNfts(true)
        if (!isLoadMore) {
            setNfts([])
            setOffset(0)
        }

        try {
            const currentOffset = isLoadMore ? offset : 0

            // Map wallets to their respective service calls
            const promises = wallets.map(async (w) => {
                try {
                    if (w.chain === 'Cosmos' && w.address.startsWith('stars')) {
                        // Stargaze supports offset pagination (limit 100 default)
                        return await stargazeNFTService.fetchUserNFTs(w.address, 100, currentOffset)
                    }
                    if (w.chain === 'Solana') {
                        // Magic Eden service requires provider. If not available, might fail or return empty.
                        // Ideally needs connected provider, but for now we might skip or try passing null if service supports it
                        // Actually magicEdenNFTService.fetchUserNFTs takes address.
                        return await magicEdenNFTService.fetchUserNFTs(w.address)
                    }
                    if (w.chain === 'EVM') {
                        // OpenSea service needs chainId or chain name. 
                        // Assuming simple mapping or iterating supported chains
                        const evmChains = ['ethereum', 'polygon', 'base']
                        const chainPromises = evmChains.map(c => openSeaNFTService.fetchUserNFTs(w.address, c as any))
                        const results = await Promise.all(chainPromises)
                        return results.flat()
                    }
                    return []
                } catch (e) {
                    console.error(`Failed to fetch NFTs for ${w.address}:`, e)
                    return []
                }
            })

            const results = await Promise.all(promises)
            const newNfts = results.flat()

            if (isLoadMore) {
                setNfts(prev => [...prev, ...newNfts])
                setOffset(prev => prev + 100)
            } else {
                setNfts(newNfts)
                setOffset(100) // Next offset will be 100
            }
        } catch (err) {
            console.error("Failed to load NFTs", err)
        } finally {
            setLoadingNfts(false)
        }
    }

    if (!isOpen) return null

    return (
        <AnimatePresence>
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={onClose}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm" // Backdrop
                />

                <motion.div
                    initial={{ scale: 0.95, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.95, opacity: 0 }}
                    className="relative w-full max-w-lg bg-[#14141b] border border-white/10 rounded-3xl shadow-2xl overflow-hidden"
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/5">
                        <h2 className="text-xl font-bold text-white">Choose Avatar</h2>
                        <button onClick={onClose} className="text-gray-400 hover:text-white transition-colors">
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* Tabs */}
                    <div className="flex px-6 pt-6 gap-4">
                        <button
                            onClick={() => setActiveTab('upload')}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border ${activeTab === 'upload'
                                ? 'bg-blue-600/10 border-blue-600 text-blue-400'
                                : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                                }`}
                        >
                            Upload
                        </button>
                        <button
                            onClick={() => { setActiveTab('nft'); loadNfts(false); }}
                            className={`flex-1 py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all border ${activeTab === 'nft'
                                ? 'bg-purple-600/10 border-purple-600 text-purple-400'
                                : 'bg-white/5 border-transparent text-gray-500 hover:bg-white/10'
                                }`}
                        >
                            Select NFT
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                        {activeTab === 'upload' ? (
                            <div className="space-y-4">
                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/10 rounded-2xl p-8 flex flex-col items-center justify-center cursor-pointer hover:border-blue-500/50 hover:bg-white/5 transition-all min-h-[200px]"
                                >
                                    {uploading ? (
                                        <Loader2 className="w-10 h-10 text-blue-400 animate-spin mb-4" />
                                    ) : (
                                        <Upload className="w-10 h-10 text-gray-500 mb-4" />
                                    )}
                                    <div className="text-sm font-bold text-white mb-1">
                                        {uploading ? "Uploading..." : "Click to Upload Image"}
                                    </div>
                                    <div className="text-xs text-gray-500">JPG, PNG, GIF up to 5MB</div>
                                    <input
                                        type="file"
                                        ref={fileInputRef}
                                        className="hidden"
                                        onChange={handleFileSelect}
                                        accept="image/*"
                                    />
                                </div>
                                {uploadError && (
                                    <div className="text-red-400 text-xs font-bold text-center bg-red-500/10 p-3 rounded-lg border border-red-500/20">
                                        {uploadError}
                                    </div>
                                )}
                            </div>
                        ) : (
                            <div className="min-h-[200px] flex flex-col">
                                {loadingNfts && nfts.length === 0 ? (
                                    <div className="flex flex-col items-center justify-center h-[200px]">
                                        <Loader2 className="w-8 h-8 text-purple-400 animate-spin mb-2" />
                                        <div className="text-xs text-gray-500 font-bold uppercase tracking-widest">Loading NFTs...</div>
                                    </div>
                                ) : (
                                    <>
                                        <div className="grid grid-cols-3 gap-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                            {nfts
                                                .filter(nft => nft.image) // Filter for display only, keep raw count for pagination
                                                .map(nft => (
                                                    <div
                                                        key={nft.id}
                                                        onClick={() => { onSelect(nft.image); onClose(); }}
                                                        className="aspect-square rounded-xl overflow-hidden border border-white/10 cursor-pointer hover:border-purple-500 hover:scale-105 transition-all relative group"
                                                    >
                                                        <img src={nft.image} alt={nft.name} className="w-full h-full object-cover" />
                                                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                                                            <span className="text-xs font-bold text-white">Select</span>
                                                        </div>
                                                    </div>
                                                ))}
                                            {/* Empty State Mock */}
                                            {wallets.length === 0 && (
                                                <div className="col-span-3 text-center py-8 text-gray-500 text-xs">
                                                    Connect a wallet to see your NFTs
                                                </div>
                                            )}
                                        </div>

                                        {/* Load More Button */}
                                        {/* Show if count is non-zero and divisible by limit (implying potentially more pages) */}
                                        {nfts.length > 0 && nfts.length % 100 === 0 && (
                                            <button
                                                onClick={() => loadNfts(true)}
                                                disabled={loadingNfts}
                                                className="mt-4 w-full py-2 bg-white/5 hover:bg-white/10 text-white/50 hover:text-white rounded-xl text-xs font-bold uppercase tracking-wider transition-all disabled:opacity-50"
                                            >
                                                {loadingNfts ? "Loading..." : "Load More"}
                                            </button>
                                        )}
                                    </>
                                )}
                            </div>
                        )}
                    </div>

                </motion.div>
            </div>
        </AnimatePresence>
    )
}
