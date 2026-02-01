import { PublicKey, Connection, VersionedTransaction } from '@solana/web3.js'
import type { NFT, NFTCollection, MarketplaceListing, NFTFilters, NFTServiceInterface } from './types'

// Magic Eden API configuration
const MAGICEDEN_API_KEY = import.meta.env.VITE_MAGICEDEN_API_KEY || ''
const MAGICEDEN_API_URL = 'https://api-mainnet.magiceden.dev/v2'
const SOLANA_RPC_URL = 'https://api.mainnet-beta.solana.com'

// Helper function to convert Magic Eden NFT to our NFT type
function convertMagicEdenNFT(meNFT: any): NFT {
    const collection = meNFT.collection || {}

    return {
        id: `${meNFT.mintAddress || meNFT.tokenMint}`,
        tokenId: meNFT.mintAddress || meNFT.tokenMint || '',
        contractAddress: meNFT.mintAddress || meNFT.tokenMint || '',
        chain: 'solana',
        name: meNFT.name || meNFT.title || 'Unknown NFT',
        description: meNFT.description || '',
        image: meNFT.image || meNFT.img || '',
        animationUrl: meNFT.animationUrl,
        externalUrl: meNFT.externalUrl,
        collection: {
            id: collection.symbol || collection.id || '',
            name: collection.name || 'Unknown Collection',
            description: collection.description,
            image: collection.image,
            floorPrice: collection.floorPrice?.toString() || meNFT.collection_floor_price?.toString(),
            totalSupply: collection.totalSupply,
        },
        owner: meNFT.owner || meNFT.ownerAddress || '',
        marketplace: 'magiceden',
        isListed: !!meNFT.price || !!meNFT.listStatus,
        listingPrice: meNFT.price?.toString(),
        listingCurrency: 'SOL',
        traits: meNFT.attributes?.map((attr: any) => ({
            trait_type: attr.trait_type,
            value: attr.value,
        })) || meNFT.traits || [],
    }
}

// Magic Eden NFT Service Implementation
export class MagicEdenNFTService implements NFTServiceInterface {
    /**
     * Fetch all NFTs owned by a specific address using Metaplex DAS API
     */
    async fetchUserNFTs(address: string): Promise<NFT[]> {
        try {
            // Validate Solana address
            new PublicKey(address)

            // Use Metaplex DAS (Digital Asset Standard) API via Helius
            // This is the standard way to fetch Solana NFTs
            const heliusApiKey = import.meta.env.VITE_HELIUS_API_KEY || 'demo-key'
            const url = `https://mainnet.helius-rpc.com/?api-key=${heliusApiKey}`

            console.log('[Solana NFTs] Fetching NFTs for:', address)

            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    jsonrpc: '2.0',
                    id: 'my-id',
                    method: 'getAssetsByOwner',
                    params: {
                        ownerAddress: address,
                        page: 1,
                        limit: 1000,
                        displayOptions: {
                            showFungible: false, // Only NFTs, not tokens
                        }
                    },
                }),
            })

            if (!response.ok) {
                if (response.status === 401) {
                    console.error('[Solana NFTs] Authentication required. Get a free API key at https://helius.dev')
                    console.error('[Solana NFTs] Set VITE_HELIUS_API_KEY in your .env file')
                }
                console.warn('[Solana NFTs] API error:', response.status, response.statusText)
                return []
            }

            const data = await response.json()

            // Check for RPC error response
            if (data.error) {
                console.error('[Solana NFTs] RPC error:', data.error.message || data.error)
                if (data.error.code === -32603 || data.error.message?.includes('Unauthorized')) {
                    console.error('[Solana NFTs] Get a free Helius API key at https://helius.dev')
                }
                return []
            }

            const assets = data.result?.items || []

            console.log('[Solana NFTs] Found', assets.length, 'NFTs')

            // Convert DAS format to our NFT format
            return assets.map((asset: any) => ({
                id: asset.id,
                tokenId: asset.id,
                contractAddress: asset.id,
                chain: 'solana' as const,
                name: asset.content?.metadata?.name || 'Unknown NFT',
                description: asset.content?.metadata?.description || '',
                image: asset.content?.links?.image || asset.content?.files?.[0]?.uri || '',
                animationUrl: asset.content?.files?.find((f: any) => f.mime?.includes('video'))?.uri,
                externalUrl: asset.content?.links?.external_url,
                collection: {
                    id: asset.grouping?.find((g: any) => g.group_key === 'collection')?.group_value || '',
                    name: asset.content?.metadata?.symbol || 'Unknown Collection',
                    image: asset.content?.links?.image,
                },
                owner: address,
                marketplace: 'magiceden',
                isListed: false, // DAS API doesn't include listing status
                traits: asset.content?.metadata?.attributes?.map((attr: any) => ({
                    trait_type: attr.trait_type,
                    value: attr.value,
                })) || [],
            }))
        } catch (error) {
            console.error('[Solana NFTs] Error fetching NFTs:', error)
            return []
        }
    }

    /**
     * Fetch marketplace listings with optional filters
     */
    async fetchMarketplaceListings(filters?: NFTFilters): Promise<MarketplaceListing[]> {
        try {
            // Fetch popular collections or specific collection listings
            const endpoint = filters?.collection
                ? `${MAGICEDEN_API_URL}/collections/${filters.collection}/listings`
                : `${MAGICEDEN_API_URL}/marketplace/popular_collections`

            const response = await fetch(endpoint, {
                headers: MAGICEDEN_API_KEY ? { 'Authorization': `Bearer ${MAGICEDEN_API_KEY}` } : {},
            })

            if (!response.ok) {
                console.warn('Magic Eden listings API error:', response.statusText)
                return []
            }

            const data = await response.json()
            const listings = Array.isArray(data) ? data : []

            return listings.slice(0, 50).map((listing: any) => ({
                nft: convertMagicEdenNFT(listing),
                price: listing.price?.toString() || '0',
                currency: 'SOL',
                seller: listing.seller || listing.sellerAddress || '',
                listingId: listing.tokenMint || listing.mintAddress || '',
                marketplace: 'magiceden' as const,
                createdAt: new Date(listing.createdAt || listing.listedAt || Date.now()),
                expiresAt: listing.expiresAt ? new Date(listing.expiresAt) : undefined,
            }))
        } catch (error) {
            console.error('Error fetching marketplace listings from Magic Eden:', error)
            return []
        }
    }

    /**
     * Fetch detailed information about a specific NFT
     */
    async fetchNFTDetails(mintAddress: string, _tokenId: string = ''): Promise<NFT> {
        try {
            // Validate mint address
            new PublicKey(mintAddress)

            const response = await fetch(
                `${MAGICEDEN_API_URL}/tokens/${mintAddress}`,
                {
                    headers: MAGICEDEN_API_KEY ? { 'Authorization': `Bearer ${MAGICEDEN_API_KEY}` } : {},
                }
            )

            if (!response.ok) {
                throw new Error('NFT not found')
            }

            const nft = await response.json()
            return convertMagicEdenNFT(nft)
        } catch (error) {
            console.error('Error fetching NFT details from Magic Eden:', error)
            throw new Error('Failed to fetch NFT details from Magic Eden')
        }
    }

    /**
     * Buy an NFT from the marketplace
     */
    async buyNFT(listing: MarketplaceListing, buyerAddress: string): Promise<string> {
        try {
            // Check if Phantom wallet is available
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('Please install Phantom wallet to buy NFTs on Magic Eden')
            }

            // Connect to Phantom wallet
            const phantom = window.solana
            await phantom.connect()

            // Verify buyer address
            const walletPublicKey = phantom.publicKey.toString()
            if (walletPublicKey !== buyerAddress) {
                throw new Error('Connected wallet does not match buyer address')
            }

            // Get buy instruction from Magic Eden API
            const params = new URLSearchParams({
                buyer: buyerAddress,
                seller: listing.seller,
                auctionHouseAddress: 'E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe', // Magic Eden v2
                tokenMint: listing.nft.contractAddress,
                tokenATA: listing.nft.contractAddress,
                price: listing.price,
            })

            const response = await fetch(
                `${MAGICEDEN_API_URL}/instructions/buy?${params.toString()}`,
                {
                    headers: MAGICEDEN_API_KEY ? { 'Authorization': `Bearer ${MAGICEDEN_API_KEY}` } : {},
                }
            )

            if (!response.ok) {
                throw new Error(`Magic Eden API error: ${response.statusText}`)
            }

            const { txSigned } = await response.json()

            // Decode and send the transaction
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
            const transaction = VersionedTransaction.deserialize(Buffer.from(txSigned, 'base64'))

            // Sign and send transaction
            const signedTx = await phantom.signTransaction(transaction)
            const signature = await connection.sendRawTransaction(signedTx.serialize())

            // Confirm transaction
            await connection.confirmTransaction(signature, 'confirmed')

            console.log('Buy transaction successful:', signature)
            return signature
        } catch (error) {
            console.error('Error buying NFT on Magic Eden:', error)
            throw error
        }
    }

    /**
     * List an NFT for sale on the marketplace
     */
    async listNFT(nft: NFT, price: string, _currency: string, sellerAddress: string): Promise<string> {
        try {
            // Check if Phantom wallet is available
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('Please install Phantom wallet to list NFTs on Magic Eden')
            }

            // Connect to Phantom wallet
            const phantom = window.solana
            await phantom.connect()

            // Verify seller address
            const walletPublicKey = phantom.publicKey.toString()
            if (walletPublicKey !== sellerAddress) {
                throw new Error('Connected wallet does not match seller address')
            }

            // Get sell instruction from Magic Eden API
            const params = new URLSearchParams({
                seller: sellerAddress,
                auctionHouseAddress: 'E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe',
                tokenMint: nft.contractAddress,
                tokenAccount: nft.contractAddress,
                price: price,
            })

            const response = await fetch(
                `${MAGICEDEN_API_URL}/instructions/sell?${params.toString()}`,
                {
                    headers: MAGICEDEN_API_KEY ? { 'Authorization': `Bearer ${MAGICEDEN_API_KEY}` } : {},
                }
            )

            if (!response.ok) {
                throw new Error(`Magic Eden API error: ${response.statusText}`)
            }

            const { txSigned } = await response.json()

            // Decode and send the transaction
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
            const transaction = VersionedTransaction.deserialize(Buffer.from(txSigned, 'base64'))

            // Sign and send transaction
            const signedTx = await phantom.signTransaction(transaction)
            const signature = await connection.sendRawTransaction(signedTx.serialize())

            // Confirm transaction
            await connection.confirmTransaction(signature, 'confirmed')

            console.log('List transaction successful:', signature)
            return signature
        } catch (error) {
            console.error('Error listing NFT on Magic Eden:', error)
            throw error
        }
    }

    /**
     * Cancel an existing listing
     */
    async cancelListing(listingId: string, sellerAddress: string): Promise<string> {
        try {
            // Check if Phantom wallet is available
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('Please install Phantom wallet to cancel listings on Magic Eden')
            }

            // Connect to Phantom wallet
            const phantom = window.solana
            await phantom.connect()

            // Verify seller address
            const walletPublicKey = phantom.publicKey.toString()
            if (walletPublicKey !== sellerAddress) {
                throw new Error('Connected wallet does not match seller address')
            }

            // Get cancel instruction from Magic Eden API
            const params = new URLSearchParams({
                seller: sellerAddress,
                auctionHouseAddress: 'E8cU1WiRWjanGxmn96ewBgk9vPTcL6AEZ1t6F6fkgUWe',
                tokenMint: listingId,
                tokenAccount: listingId,
                price: '0',
            })

            const response = await fetch(
                `${MAGICEDEN_API_URL}/instructions/sell_cancel?${params.toString()}`,
                {
                    headers: MAGICEDEN_API_KEY ? { 'Authorization': `Bearer ${MAGICEDEN_API_KEY}` } : {},
                }
            )

            if (!response.ok) {
                throw new Error(`Magic Eden API error: ${response.statusText}`)
            }

            const { txSigned } = await response.json()

            // Decode and send the transaction
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
            const transaction = VersionedTransaction.deserialize(Buffer.from(txSigned, 'base64'))

            // Sign and send transaction
            const signedTx = await phantom.signTransaction(transaction)
            const signature = await connection.sendRawTransaction(signedTx.serialize())

            // Confirm transaction
            await connection.confirmTransaction(signature, 'confirmed')

            console.log('Cancel listing successful:', signature)
            return signature
        } catch (error) {
            console.error('Error canceling listing on Magic Eden:', error)
            throw error
        }
    }

    /**
     * Get collection information
     */
    async getCollectionInfo(symbol: string): Promise<NFTCollection> {
        try {
            const response = await fetch(
                `${MAGICEDEN_API_URL}/collections/${symbol}/stats`,
                {
                    headers: MAGICEDEN_API_KEY ? { 'Authorization': `Bearer ${MAGICEDEN_API_KEY}` } : {},
                }
            )

            if (!response.ok) {
                throw new Error('Collection not found')
            }

            const stats = await response.json()

            return {
                id: symbol,
                name: stats.name || symbol,
                description: stats.description,
                image: stats.image,
                floorPrice: stats.floorPrice?.toString(),
                totalSupply: stats.totalSupply,
            }
        } catch (error) {
            console.error('Error fetching collection info from Magic Eden:', error)
            throw new Error('Failed to fetch collection info from Magic Eden')
        }
    }
}

// Export singleton instance
export const magicEdenNFTService = new MagicEdenNFTService()
