import { create } from 'zustand'
import type { NFT, MarketplaceListing, NFTFilters } from '../services/nft/types'
import { stargazeNFTService } from '../services/nft/stargaze'
import { openSeaNFTService } from '../services/nft/opensea'
import { magicEdenNFTService } from '../services/nft/magiceden'
import { useWalletStore } from './walletStore'

type EcosystemFilter = 'stargaze' | 'evm' | 'solana' | 'all'
type ViewMode = 'owned' | 'marketplace'

interface NFTStore {
    // NFT Data
    ownedNFTs: NFT[]
    marketplaceNFTs: MarketplaceListing[]
    selectedNFT: NFT | null

    // UI State
    activeEcosystem: EcosystemFilter
    activeView: ViewMode
    searchQuery: string
    filters: NFTFilters

    // Loading States
    isLoadingOwned: boolean
    isLoadingMarketplace: boolean
    isBuying: boolean
    isListing: boolean

    // Error States
    error: string | null

    // Actions - Data Fetching
    fetchOwnedNFTs: (ecosystem?: EcosystemFilter) => Promise<void>
    fetchMarketplaceNFTs: (ecosystem?: EcosystemFilter, filters?: NFTFilters) => Promise<void>
    refreshNFTs: () => Promise<void>

    // Actions - NFT Operations
    buyNFT: (listing: MarketplaceListing) => Promise<void>
    listNFT: (nft: NFT, price: string, currency: string) => Promise<void>
    cancelListing: (listingId: string) => Promise<void>

    // Actions - UI State
    setSelectedNFT: (nft: NFT | null) => void
    setActiveEcosystem: (ecosystem: EcosystemFilter) => void
    setActiveView: (view: ViewMode) => void
    setSearchQuery: (query: string) => void
    setFilters: (filters: NFTFilters) => void
    clearError: () => void
}

export const useNFTStore = create<NFTStore>((set, get) => ({
    // Initial State
    ownedNFTs: [],
    marketplaceNFTs: [],
    selectedNFT: null,

    activeEcosystem: 'all',
    activeView: 'owned',
    searchQuery: '',
    filters: {},

    isLoadingOwned: false,
    isLoadingMarketplace: false,
    isBuying: false,
    isListing: false,

    error: null,

    // Fetch owned NFTs
    fetchOwnedNFTs: async (ecosystem?: EcosystemFilter) => {
        set({ isLoadingOwned: true, error: null })

        try {
            const walletStore = useWalletStore.getState()
            const wallets = walletStore.wallets

            if (wallets.length === 0) {
                set({ ownedNFTs: [], isLoadingOwned: false })
                return
            }

            const targetEcosystem = ecosystem || get().activeEcosystem
            let allNFTs: NFT[] = []

            // Fetch from Stargaze if applicable
            if (targetEcosystem === 'all' || targetEcosystem === 'stargaze') {
                // Get Cosmos wallets (ChainType = 'Cosmos' or 'Gno' for Adena)
                // Adena wallet is classified as 'Gno' but can access Cosmos chains
                const cosmosWallets = wallets.filter(w => w.chain === 'Cosmos' || w.chain === 'Gno')

                console.log('[NFT Store] Total wallets:', wallets.length)
                console.log('[NFT Store] Cosmos/Gno wallets found:', cosmosWallets.length)
                console.log('[NFT Store] Cosmos/Gno wallet details:', cosmosWallets.map(w => ({
                    name: w.name,
                    chain: w.chain,
                    address: w.address,
                    symbol: w.symbol
                })))

                for (const wallet of cosmosWallets) {
                    try {
                        console.log(`[NFT Store] Fetching NFTs for ${wallet.name} (${wallet.address})...`)
                        const nfts = await stargazeNFTService.fetchUserNFTs(wallet.address)
                        console.log(`[NFT Store] Found ${nfts.length} NFTs for ${wallet.name}`)
                        allNFTs = [...allNFTs, ...nfts]
                    } catch (error) {
                        console.error(`[NFT Store] Error fetching NFTs for ${wallet.address}:`, error)
                    }
                }
            }

            // Fetch from EVM chains (OpenSea)
            if (targetEcosystem === 'all' || targetEcosystem === 'evm') {
                const evmWallets = wallets.filter(w => w.chain === 'EVM')

                for (const wallet of evmWallets) {
                    try {
                        // Fetch from Ethereum
                        const ethNFTs = await openSeaNFTService.fetchUserNFTs(wallet.address, 'ethereum')
                        allNFTs = [...allNFTs, ...ethNFTs]

                        // Fetch from Polygon
                        const polyNFTs = await openSeaNFTService.fetchUserNFTs(wallet.address, 'polygon')
                        allNFTs = [...allNFTs, ...polyNFTs]
                    } catch (error) {
                        console.error(`Error fetching EVM NFTs for ${wallet.address}:`, error)
                    }
                }
            }

            // Fetch from Solana (Magic Eden)
            if (targetEcosystem === 'all' || targetEcosystem === 'solana') {
                const solanaWallets = wallets.filter(w => w.chain === 'Solana')

                for (const wallet of solanaWallets) {
                    try {
                        const nfts = await magicEdenNFTService.fetchUserNFTs(wallet.address)
                        allNFTs = [...allNFTs, ...nfts]
                    } catch (error) {
                        console.error(`Error fetching Solana NFTs for ${wallet.address}:`, error)
                    }
                }
            }

            set({ ownedNFTs: allNFTs, isLoadingOwned: false })
        } catch (error) {
            console.error('Error fetching owned NFTs:', error)
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch NFTs',
                isLoadingOwned: false
            })
        }
    },

    // Fetch marketplace listings
    fetchMarketplaceNFTs: async (ecosystem?: EcosystemFilter, filters?: NFTFilters) => {
        set({ isLoadingMarketplace: true, error: null })

        try {
            const targetEcosystem = ecosystem || get().activeEcosystem
            const targetFilters = filters || get().filters
            let allListings: MarketplaceListing[] = []

            // Fetch from Stargaze marketplace
            if (targetEcosystem === 'all' || targetEcosystem === 'stargaze') {
                try {
                    const listings = await stargazeNFTService.fetchMarketplaceListings(targetFilters)
                    allListings = [...allListings, ...listings]
                } catch (error) {
                    console.error('Error fetching Stargaze marketplace:', error)
                }
            }

            // Fetch from OpenSea marketplace
            if (targetEcosystem === 'all' || targetEcosystem === 'evm') {
                try {
                    const listings = await openSeaNFTService.fetchMarketplaceListings(targetFilters)
                    allListings = [...allListings, ...listings]
                } catch (error) {
                    console.error('Error fetching OpenSea marketplace:', error)
                }
            }

            // Fetch from Magic Eden marketplace
            if (targetEcosystem === 'all' || targetEcosystem === 'solana') {
                try {
                    const listings = await magicEdenNFTService.fetchMarketplaceListings(targetFilters)
                    allListings = [...allListings, ...listings]
                } catch (error) {
                    console.error('Error fetching Magic Eden marketplace:', error)
                }
            }

            set({ marketplaceNFTs: allListings, isLoadingMarketplace: false })
        } catch (error) {
            console.error('Error fetching marketplace NFTs:', error)
            set({
                error: error instanceof Error ? error.message : 'Failed to fetch marketplace listings',
                isLoadingMarketplace: false
            })
        }
    },

    // Refresh all NFTs
    refreshNFTs: async () => {
        const { activeView, activeEcosystem } = get()

        if (activeView === 'owned') {
            await get().fetchOwnedNFTs(activeEcosystem)
        } else {
            await get().fetchMarketplaceNFTs(activeEcosystem)
        }
    },

    // Buy NFT from marketplace
    buyNFT: async (listing: MarketplaceListing) => {
        set({ isBuying: true, error: null })

        try {
            const walletStore = useWalletStore.getState()

            // Map NFT chain to wallet ChainType
            const getWalletChainType = (nftChain: string): string => {
                if (nftChain === 'stargaze') return 'Cosmos'
                if (nftChain === 'ethereum' || nftChain === 'polygon') return 'EVM'
                if (nftChain === 'solana') return 'Solana'
                return nftChain
            }

            const walletChainType = getWalletChainType(listing.nft.chain)
            const buyerWallet = walletStore.wallets.find(w => w.chain === walletChainType)

            if (!buyerWallet) {
                throw new Error(`No wallet connected for ${listing.nft.chain}`)
            }

            let txHash: string

            switch (listing.marketplace) {
                case 'stargaze':
                    txHash = await stargazeNFTService.buyNFT(listing, buyerWallet.address)
                    break
                case 'opensea':
                    txHash = await openSeaNFTService.buyNFT(listing, buyerWallet.address)
                    break
                case 'magiceden':
                    txHash = await magicEdenNFTService.buyNFT(listing, buyerWallet.address)
                    break
                default:
                    throw new Error(`Marketplace ${listing.marketplace} not supported yet`)
            }

            console.log('Buy transaction successful:', txHash)

            // Refresh NFTs after successful purchase
            await get().refreshNFTs()

            set({ isBuying: false })
        } catch (error) {
            console.error('Error buying NFT:', error)
            set({
                error: error instanceof Error ? error.message : 'Failed to buy NFT',
                isBuying: false
            })
            throw error
        }
    },

    // List NFT for sale
    listNFT: async (nft: NFT, price: string, currency: string) => {
        set({ isListing: true, error: null })

        try {
            const walletStore = useWalletStore.getState()

            // Map NFT chain to wallet ChainType
            const getWalletChainType = (nftChain: string): string => {
                if (nftChain === 'stargaze') return 'Cosmos'
                if (nftChain === 'ethereum' || nftChain === 'polygon') return 'EVM'
                if (nftChain === 'solana') return 'Solana'
                return nftChain
            }

            const walletChainType = getWalletChainType(nft.chain)
            const sellerWallet = walletStore.wallets.find(w =>
                w.address === nft.owner && w.chain === walletChainType
            )

            if (!sellerWallet) {
                throw new Error('You must own this NFT to list it')
            }

            let listingId: string

            switch (nft.chain) {
                case 'stargaze':
                    listingId = await stargazeNFTService.listNFT(nft, price, currency, sellerWallet.address)
                    break
                case 'ethereum':
                case 'polygon':
                    listingId = await openSeaNFTService.listNFT(nft, price, currency, sellerWallet.address)
                    break
                case 'solana':
                    listingId = await magicEdenNFTService.listNFT(nft, price, currency, sellerWallet.address)
                    break
                default:
                    throw new Error(`Chain ${nft.chain} not supported yet`)
            }

            console.log('Listing created:', listingId)

            // Refresh NFTs after successful listing
            await get().refreshNFTs()

            set({ isListing: false })
        } catch (error) {
            console.error('Error listing NFT:', error)
            set({
                error: error instanceof Error ? error.message : 'Failed to list NFT',
                isListing: false
            })
            throw error
        }
    },

    // Cancel listing
    cancelListing: async (listingId: string) => {
        set({ isListing: true, error: null })

        try {
            const walletStore = useWalletStore.getState()
            const wallet = walletStore.wallets[0] // TODO: Get correct wallet

            if (!wallet) {
                throw new Error('No wallet connected')
            }

            // TODO: Determine which service to use based on listing
            await stargazeNFTService.cancelListing(listingId, wallet.address)

            // Refresh NFTs after cancellation
            await get().refreshNFTs()

            set({ isListing: false })
        } catch (error) {
            console.error('Error canceling listing:', error)
            set({
                error: error instanceof Error ? error.message : 'Failed to cancel listing',
                isListing: false
            })
            throw error
        }
    },

    // UI State Actions
    setSelectedNFT: (nft) => set({ selectedNFT: nft }),

    setActiveEcosystem: (ecosystem) => {
        set({ activeEcosystem: ecosystem })
        // Auto-refresh when ecosystem changes
        get().refreshNFTs()
    },

    setActiveView: (view) => {
        set({ activeView: view })
        // Auto-refresh when view changes
        get().refreshNFTs()
    },

    setSearchQuery: (query) => set({ searchQuery: query }),

    setFilters: (filters) => {
        set({ filters })
        // Auto-refresh when filters change
        if (get().activeView === 'marketplace') {
            get().fetchMarketplaceNFTs(get().activeEcosystem, filters)
        }
    },

    clearError: () => set({ error: null }),
}))
