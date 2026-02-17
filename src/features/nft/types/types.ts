// NFT Type Definitions for Multi-Chain Support

export interface NFTTrait {
    trait_type: string
    value: string | number
    display_type?: string
}

export interface NFTCollection {
    id: string
    name: string
    description?: string
    image?: string
    floorPrice?: string
    floorPriceCurrency?: string // Symbol (e.g. STARS, ATOM)
    floorPriceDenom?: string    // Denom (e.g. ustars, uatom)
    totalSupply?: number
    verified?: boolean
}

export interface NFT {
    // Core identifiers
    id: string
    tokenId: string
    contractAddress: string
    chain: 'stargaze' | 'ethereum' | 'polygon' | 'base' | 'bsc' | 'gnosis' | 'arbitrum' | 'solana'

    // Metadata
    name: string
    description: string
    image: string
    animationUrl?: string
    externalUrl?: string

    // Collection info
    collection: NFTCollection

    // Ownership
    owner: string

    // Marketplace info
    marketplace?: 'stargaze' | 'opensea' | 'magiceden'
    isListed: boolean
    listingPrice?: string
    listingCurrency?: string
    listingId?: string

    // Attributes
    traits?: NFTTrait[]

    // Additional metadata
    mintedAt?: Date
    lastSale?: {
        price: string
        currency: string
        date: Date
    }
}

export interface MarketplaceListing {
    nft: NFT
    price: string
    currency: string
    seller: string
    listingId: string
    marketplace: 'stargaze' | 'opensea' | 'magiceden'
    expiresAt?: Date
    createdAt: Date
}

export interface NFTFilters {
    ecosystem?: 'stargaze' | 'evm' | 'solana' | 'all'
    collection?: string
    minPrice?: string
    maxPrice?: string
    traits?: Record<string, string[]>
    sortBy?: 'price_asc' | 'price_desc' | 'recently_listed' | 'recently_sold'
    seller?: string
    search?: string
    chain?: string
}

export interface NFTServiceInterface {
    // Fetch user's owned NFTs
    fetchUserNFTs(address: string): Promise<NFT[]>

    // Fetch marketplace listings
    fetchMarketplaceListings(filters?: NFTFilters): Promise<MarketplaceListing[]>

    // Fetch single NFT details
    fetchNFTDetails(contractAddress: string, tokenId: string): Promise<NFT>

    // Buy NFT
    buyNFT(listing: MarketplaceListing, buyerAddress: string): Promise<string> // returns tx hash

    // List NFT for sale
    transferNFT(nft: NFT, recipientAddress: string, senderAddress: string, walletProvider?: string): Promise<string>
    burnNFT?(nft: NFT, ownerAddress: string): Promise<string>

    // Cancel listing
    cancelListing(listingId: string, sellerAddress: string, chain?: string): Promise<string> // returns tx hash

    // Fetch collection stats (floor price, etc)
    getCollectionStats(contractAddress: string): Promise<NFTCollection>
}

// Stargaze-specific types
export interface StargazeNFT {
    token_id: string
    owner: string
    name: string
    description: string
    image: string
    animation_url?: string
    external_url?: string
    attributes?: Array<{
        trait_type: string
        value: string
    }>
}

export interface StargazeCollection {
    collection_addr: string
    name: string
    description?: string
    image?: string
    floor_price?: string
}

export interface StargazeListing {
    id: string
    token_id: string
    collection_addr: string
    price: {
        amount: string
        denom: string
    }
    seller: string
    expires_at?: string
}
