import { X } from 'lucide-react'
import { useState } from 'react'
import type { NFT } from '../../services/nft/types'
import { useNFTStore } from '../../store/nftStore'

interface NFTDetailModalProps {
    nft: NFT | null
    onClose: () => void
}

export function NFTDetailModal({ nft, onClose }: NFTDetailModalProps) {
    const [listPrice, setListPrice] = useState('')
    const { buyNFT, listNFT, cancelListing, isBuying, isListing, marketplaceNFTs } = useNFTStore()

    if (!nft) return null

    const listing = marketplaceNFTs.find(l => l.nft.id === nft.id)
    const isMarketplaceListing = !!listing
    const canBuy = isMarketplaceListing
    const canSell = !nft.isListed && !isMarketplaceListing

    const handleBuy = async () => {
        if (!listing) return

        try {
            await buyNFT(listing)
            onClose()
        } catch (error) {
            console.error('Buy failed:', error)
        }
    }

    const handleList = async () => {
        if (!listPrice) return

        try {
            const currency = nft.chain === 'stargaze' ? 'ustars' : 'eth'
            await listNFT(nft, listPrice, currency)
            onClose()
        } catch (error) {
            console.error('List failed:', error)
        }
    }

    const handleCancel = async () => {
        try {
            await cancelListing(nft)
            onClose()
        } catch (error) {
            console.error('Cancel failed:', error)
        }
    }

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-[#0a0a0a] rounded-3xl border border-white/10 shadow-2xl">
                {/* Close Button */}
                <button
                    onClick={onClose}
                    className="absolute top-4 right-4 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
                >
                    <X className="w-5 h-5 text-white" />
                </button>

                <div className="grid md:grid-cols-2 gap-6 p-6">
                    {/* Left: Image */}
                    <div className="relative">
                        <div className="aspect-square rounded-2xl overflow-hidden bg-black/20 border border-white/5">
                            {nft.image ? (
                                <img
                                    src={nft.image}
                                    alt={nft.name}
                                    className="w-full h-full object-cover"
                                />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-600">
                                    <span className="text-6xl">🖼️</span>
                                </div>
                            )}
                        </div>

                        {/* Marketplace Badge */}
                        {nft.marketplace && (
                            <div className="absolute top-4 right-4 px-3 py-2 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10">
                                <span className="text-sm font-medium text-white capitalize">
                                    {nft.marketplace}
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Right: Details */}
                    <div className="flex flex-col">
                        {/* Collection */}
                        <div className="mb-4">
                            <p className="text-sm text-purple-400 font-medium mb-1">
                                {nft.collection.name}
                            </p>
                            <h2 className="text-3xl font-bold text-white mb-2">
                                {nft.name}
                            </h2>
                            {nft.description && (
                                <p className="text-gray-400 text-sm">
                                    {nft.description}
                                </p>
                            )}
                        </div>

                        {/* Owner */}
                        <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/5">
                            <p className="text-xs text-gray-500 mb-1">Owner</p>
                            <p className="text-sm text-white font-mono truncate">
                                {nft.owner}
                            </p>
                        </div>

                        {/* Price Info */}
                        {nft.isListed && nft.listingPrice && (
                            <div className="mb-4 p-4 rounded-xl bg-purple-600/10 border border-purple-500/20">
                                <p className="text-xs text-purple-400 mb-1">Listed Price</p>
                                <p className="text-2xl font-bold text-white">
                                    {nft.listingPrice} {nft.listingCurrency?.toUpperCase() || 'STARS'}
                                </p>
                            </div>
                        )}

                        {nft.collection.floorPrice && (
                            <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-500 mb-1">Floor Price</p>
                                <p className="text-lg font-bold text-white">
                                    {nft.collection.floorPrice}
                                </p>
                            </div>
                        )}

                        {/* Traits */}
                        {nft.traits && nft.traits.length > 0 && (
                            <div className="mb-6">
                                <h3 className="text-sm font-bold text-white mb-3">Traits</h3>
                                <div className="grid grid-cols-2 gap-2">
                                    {nft.traits.map((trait, index) => (
                                        <div
                                            key={index}
                                            className="p-3 rounded-lg bg-white/5 border border-white/5"
                                        >
                                            <p className="text-xs text-gray-500 mb-1">
                                                {trait.trait_type}
                                            </p>
                                            <p className="text-sm text-white font-medium truncate">
                                                {trait.value}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Actions */}
                        <div className="mt-auto space-y-3">
                            {/* Buy Button */}
                            {canBuy && (
                                <button
                                    onClick={handleBuy}
                                    disabled={isBuying}
                                    className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {isBuying ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Buying...
                                        </>
                                    ) : (
                                        <>Buy Now</>
                                    )}
                                </button>
                            )}

                            {/* Sell/List Section */}
                            {canSell && (
                                <div className="space-y-2">
                                    <input
                                        type="text"
                                        placeholder="Enter price..."
                                        value={listPrice}
                                        onChange={(e) => setListPrice(e.target.value)}
                                        className="w-full px-4 py-3 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none"
                                    />
                                    <button
                                        onClick={handleList}
                                        disabled={!listPrice || isListing}
                                        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                    >
                                        {isListing ? (
                                            <>
                                                <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                Listing...
                                            </>
                                        ) : (
                                            <>List for Sale</>
                                        )}
                                    </button>
                                </div>
                            )}

                            {/* Cancel Listing Section */}
                            {nft.isListed && (
                                <button
                                    onClick={handleCancel}
                                    disabled={isListing}
                                    className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                >
                                    {isListing ? (
                                        <>
                                            <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                            Canceling...
                                        </>
                                    ) : (
                                        <>Cancel Listing</>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    )
}
