import { useEffect, useMemo } from 'react'
import { Search } from 'lucide-react'
import { useNFTStore } from '../store/nftStore'
import { NFTGrid } from '../components/nft/NFTGrid'
import { EcosystemFilter } from '../components/nft/EcosystemFilter'
import { NFTDetailModal } from '../components/nft/NFTDetailModal'

export function NFTs() {
    const {
        ownedNFTs,
        marketplaceNFTs,
        selectedNFT,
        activeEcosystem,
        activeView,
        searchQuery,
        isLoadingOwned,
        isLoadingMarketplace,
        hasMoreOwnedNFTs,
        error,
        fetchOwnedNFTs,
        fetchMarketplaceNFTs,
        loadMoreOwnedNFTs,
        setSelectedNFT,
        setActiveEcosystem,
        setActiveView,
        setSearchQuery,
        clearError,
    } = useNFTStore()

    // Load NFTs on mount and when view/ecosystem changes
    useEffect(() => {
        if (activeView === 'owned') {
            fetchOwnedNFTs()
        } else {
            fetchMarketplaceNFTs()
        }
    }, [activeView, activeEcosystem])

    // Filter NFTs based on search query
    const filteredNFTs = useMemo(() => {
        const nfts = activeView === 'owned'
            ? ownedNFTs
            : marketplaceNFTs.map(l => l.nft)

        if (!searchQuery) return nfts

        const query = searchQuery.toLowerCase()
        return nfts.filter(nft =>
            nft.name.toLowerCase().includes(query) ||
            nft.collection.name.toLowerCase().includes(query) ||
            nft.description.toLowerCase().includes(query)
        )
    }, [activeView, ownedNFTs, marketplaceNFTs, searchQuery])

    // Calculate NFT counts per ecosystem
    const nftCounts = useMemo(() => {
        const nfts = activeView === 'owned' ? ownedNFTs : marketplaceNFTs.map(l => l.nft)

        return {
            all: nfts.length,
            stargaze: nfts.filter(n => n.chain === 'stargaze').length,
            evm: nfts.filter(n => n.chain === 'ethereum' || n.chain === 'polygon').length,
            solana: nfts.filter(n => n.chain === 'solana').length,
        }
    }, [activeView, ownedNFTs, marketplaceNFTs])

    const isLoading = activeView === 'owned' ? isLoadingOwned : isLoadingMarketplace

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-8">
                <h1 className="text-4xl font-bold text-white mb-2">NFTs</h1>
                <p className="text-gray-400">
                    Browse, buy, and sell NFTs across multiple marketplaces
                </p>
            </div>

            {/* View Tabs */}
            <div className="flex gap-2 mb-6">
                <button
                    onClick={() => setActiveView('owned')}
                    className={`
                        px-6 py-3 rounded-xl font-bold transition-all
                        ${activeView === 'owned'
                            ? 'bg-white text-black shadow-lg'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    My NFTs
                    {ownedNFTs.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-black/10 text-xs">
                            {ownedNFTs.length}
                        </span>
                    )}
                </button>
                <button
                    onClick={() => setActiveView('marketplace')}
                    className={`
                        px-6 py-3 rounded-xl font-bold transition-all
                        ${activeView === 'marketplace'
                            ? 'bg-white text-black shadow-lg'
                            : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                        }
                    `}
                >
                    Explore Marketplace
                    {marketplaceNFTs.length > 0 && (
                        <span className="ml-2 px-2 py-0.5 rounded-full bg-black/10 text-xs">
                            {marketplaceNFTs.length}
                        </span>
                    )}
                </button>
            </div>

            {/* Ecosystem Filter */}
            <div className="mb-6">
                <EcosystemFilter
                    activeEcosystem={activeEcosystem}
                    onEcosystemChange={setActiveEcosystem}
                    nftCounts={nftCounts}
                />
            </div>

            {/* Search Bar */}
            <div className="mb-6">
                <div className="relative">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                    <input
                        type="text"
                        placeholder="Search NFTs by name or collection..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-12 pr-4 py-4 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:border-purple-500 focus:outline-none transition-colors"
                    />
                </div>
            </div>

            {/* Error Message */}
            {error && (
                <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-between">
                    <p className="text-red-400">{error}</p>
                    <button
                        onClick={clearError}
                        className="text-red-400 hover:text-red-300 text-sm font-medium"
                    >
                        Dismiss
                    </button>
                </div>
            )}

            {/* NFT Grid */}
            <NFTGrid
                nfts={filteredNFTs}
                isLoading={isLoading}
                onNFTClick={setSelectedNFT}
                emptyMessage={
                    activeView === 'owned'
                        ? 'No NFTs found. Connect a wallet to see your NFTs.'
                        : 'No marketplace listings found.'
                }
            />

            {/* Load More Button */}
            {activeView === 'owned' && hasMoreOwnedNFTs && !isLoading && (
                <div className="mt-8 flex justify-center">
                    <button
                        onClick={loadMoreOwnedNFTs}
                        disabled={isLoadingOwned}
                        className="px-8 py-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 hover:border-purple-500/50 text-white font-bold transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLoadingOwned ? 'Loading...' : 'Load More NFTs'}
                    </button>
                </div>
            )}

            {/* NFT Detail Modal */}
            <NFTDetailModal
                nft={selectedNFT}
                onClose={() => setSelectedNFT(null)}
            />
        </div>
    )
}
