import { X, ShoppingBag, Send, Flame, ChevronLeft, Tag } from 'lucide-react'
import { useState, useEffect } from 'react'
import type { NFT } from '../types/types'
import { useNFTStore } from '../store/nftStore'
import { useWalletStore } from '../../wallet/store/walletStore'
import { formatPrice } from '../../../shared/utils/currency'
import { validateAddress } from '../../../shared/utils/addressValidation'

interface NFTDetailModalProps {
    nft: NFT | null
    onClose: () => void
}

export function NFTDetailModal({ nft, onClose }: NFTDetailModalProps) {
    const [price, setPrice] = useState('')
    const [floorPriceDisplay, setFloorPriceDisplay] = useState<string | null>(null)
    const [listingCurrency, setListingCurrency] = useState<string>('')
    const [currencyCode, setCurrencyCode] = useState<string>('') // Display symbol (e.g. STARS, ATOM)
    const [activeAction, setActiveAction] = useState<'sell' | 'transfer' | 'burn' | null>(null)
    const [duration, setDuration] = useState<number>(30) // Default 30 days
    const [recipientAddress, setRecipientAddress] = useState<string>('')
    const [addressError, setAddressError] = useState<string>('')


    const {
        isListing,
        isBuying,
        isTransferring,
        isBurning,
        listNFT,
        buyNFT,
        cancelListing,
        transferNFT,
        burnNFT,
        marketplaceNFTs,
        fetchCollectionStats
    } = useNFTStore()

    const { wallets } = useWalletStore() // Moved up to satisfy Rules of Hooks

    // Determine currency and fetch stats on mount
    useEffect(() => {
        if (nft) {
            setPrice('')
            setFloorPriceDisplay(null)

            // Determine initial currency
            let code = 'STARS'
            let denom = 'ustars'

            if (nft.chain === 'stargaze') {
                code = 'STARS'
                denom = 'ustars'
            } else if (nft.chain === 'polygon') {
                code = 'WETH'
                denom = 'WETH'
            } else if (['ethereum', 'base', 'optimism', 'arbitrum'].includes(nft.chain)) {
                code = 'ETH'
                denom = 'ETH'
            } else if (nft.chain === 'solana') {
                code = 'SOL'
                denom = 'SOL'
            }
            setListingCurrency(denom) // Service expects the denom
            setCurrencyCode(code)

            // Fetch Floor Price
            const address = nft.contractAddress
            if (address) {
                fetchCollectionStats(address, nft.chain)
                    .then(stats => {
                        if (stats?.floorPrice) {
                            const val = stats.floorPrice

                            // Dynamic Currency from Stats (Stargaze)
                            // For Polygon/OpenSea, stats often return 'ETH' but we want to show 'WETH' for listings
                            if (stats.floorPriceCurrency) {
                                if (nft.chain === 'polygon' && stats.floorPriceCurrency === 'ETH') {
                                    code = 'WETH' // Enforce WETH for Polygon
                                } else {
                                    code = stats.floorPriceCurrency
                                }
                                setCurrencyCode(code)
                            }
                            if (stats.floorPriceDenom) {
                                // Same override for denom if needed, but usually Opensea doesn't return floorPriceDenom property like Stargaze
                                setListingCurrency(stats.floorPriceDenom)
                            }

                            // If value already includes currency code (e.g. from Stargaze service), don't append it
                            // Or if checks against the dynamic code we just fetched
                            if (val.toUpperCase().includes(code.toUpperCase())) {
                                setFloorPriceDisplay(val)
                            } else {
                                setFloorPriceDisplay(`${val} ${code}`)
                            }
                        } else {
                            setFloorPriceDisplay('N/A')
                        }
                    })
                    .catch((err) => {
                        console.error('Error fetching floor price:', err)
                        setFloorPriceDisplay('N/A')
                    })
            } else {
                setFloorPriceDisplay('N/A')
            }
        }
    }, [nft, fetchCollectionStats])

    if (!nft) return null

    const listing = marketplaceNFTs.find(l => l.nft.id === nft.id)
    const isMarketplaceListing = !!listing
    const canBuy = isMarketplaceListing
    const canSell = !nft.isListed && !isMarketplaceListing

    // wallets is now destructured at the top level

    const handleBuy = async () => {
        if (!listing) return

        // Prevent buying own listing
        const isOwner = wallets.some(w => w.address.toLowerCase() === listing.seller.toLowerCase())

        if (isOwner) {
            console.warn("Cannot buy your own listing")
            return
        }

        try {
            await buyNFT(listing)
            onClose()
        } catch (error) {
            console.error('Buy failed:', error)
        }
    }

    const handleList = async () => {
        if (!price) return

        try {
            await listNFT(nft, price, listingCurrency, duration * 24 * 60 * 60)
            onClose()
        } catch (error) {
            console.error('Failed to list NFT:', error)
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

    const handleTransfer = async () => {
        if (!recipientAddress) return

        // Validate address format
        const validation = validateAddress(recipientAddress, nft.chain)
        if (!validation.valid) {
            setAddressError(validation.error || 'Invalid address')
            return
        }

        try {
            await transferNFT(nft, recipientAddress)
            onClose()
        } catch (error) {
            console.error('Transfer failed:', error)
        }
    }

    const handleRecipientAddressChange = (value: string) => {
        setRecipientAddress(value)

        // Clear error when user starts typing
        if (addressError) {
            setAddressError('')
        }

        // Validate on change if address is not empty
        if (value.trim()) {
            const validation = validateAddress(value, nft.chain)
            if (!validation.valid) {
                setAddressError(validation.error || 'Invalid address')
            }
        }
    }

    const handleBurn = async () => {
        try {
            await burnNFT(nft)
            onClose()
        } catch (error) {
            console.error('Burn failed:', error)
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

                        {/* Price Info - Only for listed items */}
                        {(isMarketplaceListing || nft.isListed) && (
                            <div className="mb-4 p-4 rounded-xl bg-purple-600/10 border border-purple-500/20">
                                <p className="text-xs text-purple-400 mb-1">Listed Price</p>
                                <p className="text-2xl font-bold text-white">
                                    {formatPrice(nft.listingPrice, nft.listingCurrency)}
                                </p>
                            </div>
                        )}

                        {floorPriceDisplay && (
                            <div className="mb-4 p-4 rounded-xl bg-white/5 border border-white/5">
                                <p className="text-xs text-gray-500 mb-1">Floor Price</p>
                                <p className="text-lg font-bold text-white">
                                    {floorPriceDisplay}
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
                            {/* Buy Button - Only show if not the owner */}
                            {canBuy && !wallets.some(w => w.address.toLowerCase() === listing?.seller.toLowerCase()) && (
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
                                <div className="space-y-3">
                                    {/* Action Selection Grid */}
                                    {!activeAction && (
                                        <div className="grid grid-cols-2 gap-3">
                                            {/* Sell Button - Available on all chains */}
                                            <button
                                                onClick={() => setActiveAction('sell')}
                                                className="col-span-1 py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                                            >
                                                <ShoppingBag className="w-4 h-4" />
                                                Sell
                                            </button>


                                            {/* Transfer Button - Available on all chains */}
                                            <button
                                                onClick={() => setActiveAction('transfer')}
                                                className={`col-span-${nft.chain === 'stargaze' ? '1' : '1'} py-3 px-4 rounded-xl bg-purple-600 hover:bg-purple-700 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20`}
                                            >
                                                <Send className="w-4 h-4" />
                                                Send
                                            </button>

                                            {/* Stargaze Specific: Burn */}
                                            {nft.chain === 'stargaze' && (
                                                <button
                                                    onClick={() => setActiveAction('burn')}
                                                    className="col-span-1 py-3 px-4 rounded-xl bg-transparent border border-orange-500 text-orange-500 hover:bg-orange-500/10 font-bold transition-colors flex items-center justify-center gap-2"
                                                >
                                                    <Flame className="w-4 h-4" />
                                                    Burn
                                                </button>
                                            )}
                                        </div>
                                    )}

                                    {/* Sell View */}
                                    {activeAction === 'sell' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            {/* Prominent Back Button */}
                                            <button
                                                onClick={() => setActiveAction(null)}
                                                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                Back
                                            </button>

                                            <div className="space-y-2">
                                                {/* Price Input Header with Floor Price Context */}
                                                <div className="flex justify-between items-center px-1">
                                                    <label className="text-sm font-medium text-gray-300">Listing Price</label>
                                                    <span className="text-xs text-purple-400 bg-purple-500/10 px-2 py-1 rounded">
                                                        Floor: {floorPriceDisplay || 'Loading...'}
                                                    </span>
                                                </div>

                                                <div className="relative">
                                                    <input
                                                        type="text"
                                                        placeholder="0.00"
                                                        value={price}
                                                        onChange={(e) => setPrice(e.target.value)}
                                                        className="w-full px-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none text-lg font-mono"
                                                    />
                                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 flex items-center gap-2">
                                                        <span className="text-sm font-bold text-gray-400 border-l border-white/10 pl-3">
                                                            {currencyCode || (listingCurrency === 'ustars' ? 'STARS' : (listingCurrency || 'TOKEN'))}
                                                        </span>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Duration Selection */}
                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-300 px-1">Duration</label>
                                                <div className="grid grid-cols-3 gap-2">
                                                    {[1, 3, 7, 30, 90, 180].map((d) => (
                                                        <button
                                                            key={d}
                                                            onClick={() => setDuration(d)}
                                                            className={`py-2 px-3 rounded-lg text-xs font-medium transition-colors border ${duration === d
                                                                ? 'bg-purple-600 border-purple-500 text-white'
                                                                : 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10 hover:text-white'
                                                                }`}
                                                        >
                                                            {d === 1 ? '1 Day' : d === 30 ? '1 Month' : d === 90 ? '3 Months' : d === 180 ? '6 Months' : `${d} Days`}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            <p className="text-xs text-gray-500 px-1">
                                                Enter the amount you want to receive. Listing expires in {duration} days.
                                            </p>

                                            <button
                                                onClick={handleList}
                                                disabled={!price || isListing}
                                                className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-700 disabled:bg-gray-600 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-green-500/20"
                                            >
                                                {isListing ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                        Listing...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Tag className="w-4 h-4" />
                                                        List for Sale
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Transfer View */}
                                    {activeAction === 'transfer' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <button
                                                onClick={() => setActiveAction(null)}
                                                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                Back
                                            </button>

                                            <div className="space-y-2">
                                                <label className="text-sm font-medium text-gray-300 px-1">
                                                    Recipient Address
                                                </label>
                                                <input
                                                    type="text"
                                                    placeholder={nft.chain === 'stargaze' ? 'stars1...' : nft.chain === 'solana' ? 'Solana address...' : '0x...'}
                                                    value={recipientAddress}
                                                    onChange={(e) => handleRecipientAddressChange(e.target.value)}
                                                    className={`w-full px-4 py-4 rounded-xl bg-white/5 border ${addressError ? 'border-red-500' : 'border-white/10'} text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none font-mono text-sm`}
                                                />
                                                {addressError ? (
                                                    <p className="text-xs text-red-400 px-1">
                                                        ❌ {addressError}
                                                    </p>
                                                ) : (
                                                    <p className="text-xs text-gray-500 px-1">
                                                        ⚠️ Make sure the address is correct - transfers cannot be reversed!
                                                    </p>
                                                )}
                                            </div>

                                            <button
                                                onClick={handleTransfer}
                                                disabled={!recipientAddress || isTransferring || !!addressError}
                                                className="w-full py-4 rounded-xl bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 text-white font-bold transition-colors flex items-center justify-center gap-2 shadow-lg shadow-purple-500/20"
                                            >
                                                {isTransferring ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                        Sending...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Send className="w-4 h-4" />
                                                        Send NFT
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}

                                    {/* Burn View */}
                                    {activeAction === 'burn' && (
                                        <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4 duration-300">
                                            <button
                                                onClick={() => setActiveAction(null)}
                                                className="w-full py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white font-medium transition-colors flex items-center justify-center gap-2"
                                            >
                                                <ChevronLeft className="w-4 h-4" />
                                                Back
                                            </button>

                                            {/* Warning Messages */}
                                            <div className="space-y-3">
                                                <div className="p-4 rounded-xl bg-orange-500/10 border border-orange-500/30">
                                                    <div className="flex items-start gap-3">
                                                        <div className="text-orange-400 mt-0.5">⚠️</div>
                                                        <div>
                                                            <p className="text-sm font-bold text-orange-400 mb-1">
                                                                THIS IS NOT BURN-TO-MINT
                                                            </p>
                                                            <p className="text-xs text-orange-300">
                                                                Burn-to-mint is a different action that only happens through the Stargaze Launchpad. Burning a token via this action is irreversible.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="p-4 rounded-xl bg-red-500/10 border border-red-500/30">
                                                    <div className="flex items-start gap-3">
                                                        <div className="text-red-400 mt-0.5">🔥</div>
                                                        <div>
                                                            <p className="text-sm font-bold text-red-400 mb-1">
                                                                BURNING IS IRREVERSIBLE
                                                            </p>
                                                            <p className="text-xs text-red-300">
                                                                Burning is an irreversible action and deletes your item from the blockchain. Make sure you have selected the correct one, and intend to perform this action.
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>

                                            <button
                                                onClick={handleBurn}
                                                disabled={isBurning}
                                                className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-700 disabled:bg-gray-600 text-white font-bold transition-colors flex items-center justify-center gap-2"
                                            >
                                                {isBurning ? (
                                                    <>
                                                        <div className="w-5 h-5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                                                        Burning...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Flame className="w-4 h-4" />
                                                        Burn NFT
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    )}


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
