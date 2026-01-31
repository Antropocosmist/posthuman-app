import { OpenSeaSDK, Chain } from 'opensea-js'
import { ethers } from 'ethers'
import type { NFT, MarketplaceListing, NFTFilters, NFTServiceInterface } from './types'

// OpenSea API configuration
const OPENSEA_API_KEY = import.meta.env.VITE_OPENSEA_API_KEY || ''

// Helper function to convert OpenSea NFT to our NFT type
function convertOpenSeaNFT(openseaNFT: any, chain: 'ethereum' | 'polygon'): NFT {
    const collection = openseaNFT.collection || {}
    const contract = openseaNFT.contract || openseaNFT.asset_contract || {}

    return {
        id: `${contract.address}-${openseaNFT.identifier || openseaNFT.token_id}`,
        tokenId: openseaNFT.identifier || openseaNFT.token_id || '',
        contractAddress: contract.address || '',
        chain,
        name: openseaNFT.name || `#${openseaNFT.identifier || openseaNFT.token_id}`,
        description: openseaNFT.description || '',
        image: openseaNFT.image_url || openseaNFT.image || '',
        animationUrl: openseaNFT.animation_url,
        externalUrl: openseaNFT.external_link || openseaNFT.permalink,
        collection: {
            id: collection.slug || contract.address,
            name: collection.name || contract.name || 'Unknown Collection',
            description: collection.description,
            image: collection.image_url || collection.featured_image_url,
            floorPrice: collection.stats?.floor_price?.toString(),
            totalSupply: collection.stats?.total_supply,
        },
        owner: openseaNFT.owner?.address || openseaNFT.top_ownerships?.[0]?.owner?.address || '',
        marketplace: 'opensea',
        isListed: !!openseaNFT.sell_orders?.length,
        listingPrice: openseaNFT.sell_orders?.[0]?.current_price,
        listingCurrency: 'ETH',
        traits: openseaNFT.traits?.map((trait: any) => ({
            trait_type: trait.trait_type,
            value: trait.value,
            display_type: trait.display_type,
        })) || [],
    }
}

// OpenSea NFT Service Implementation
export class OpenSeaNFTService implements NFTServiceInterface {
    // Note: We use the OpenSea API directly, not the SDK
    // The SDK has initialization issues and is not needed for basic NFT fetching

    /**
     * Fetch all NFTs owned by a specific address
     */
    async fetchUserNFTs(address: string, chain: 'ethereum' | 'polygon' = 'ethereum'): Promise<NFT[]> {
        try {
            // Use OpenSea API to fetch NFTs (no SDK needed for this)
            const response = await fetch(
                `https://api.opensea.io/api/v2/chain/${chain}/account/${address}/nfts`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (!response.ok) {
                console.warn(`OpenSea API error for ${chain}: ${response.statusText}`)
                return []
            }

            const data = await response.json()
            const nfts = data.nfts || []

            return nfts.map((nft: any) => convertOpenSeaNFT(nft, chain))
        } catch (error) {
            console.error('Error fetching user NFTs from OpenSea:', error)
            // Return empty array instead of throwing to allow graceful degradation
            return []
        }
    }

    /**
     * Fetch marketplace listings with optional filters
     */
    async fetchMarketplaceListings(filters?: NFTFilters): Promise<MarketplaceListing[]> {
        try {
            // Use OpenSea API to fetch listings
            const chain = filters?.ecosystem === 'evm' ? 'ethereum' : 'ethereum'
            const response = await fetch(
                `https://api.opensea.io/api/v2/listings/collection/${filters?.collection || 'all'}/all`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (!response.ok) {
                console.warn('OpenSea listings API error:', response.statusText)
                return []
            }

            const data = await response.json()
            const listings = data.listings || []

            return listings.map((listing: any) => ({
                nft: convertOpenSeaNFT(listing.protocol_data?.parameters?.offer?.[0] || {}, chain as any),
                price: listing.price?.current?.value || '0',
                currency: listing.price?.current?.currency || 'ETH',
                seller: listing.maker?.address || '',
                listingId: listing.order_hash || '',
                marketplace: 'opensea' as const,
                createdAt: new Date(listing.created_date || Date.now()),
                expiresAt: listing.expiration_time ? new Date(listing.expiration_time * 1000) : undefined,
            }))
        } catch (error) {
            console.error('Error fetching marketplace listings from OpenSea:', error)
            return []
        }
    }

    /**
     * Fetch detailed information about a specific NFT
     */
    async fetchNFTDetails(contractAddress: string, tokenId: string, chain: 'ethereum' | 'polygon' = 'ethereum'): Promise<NFT> {
        try {
            const response = await fetch(
                `https://api.opensea.io/api/v2/chain/${chain}/contract/${contractAddress}/nfts/${tokenId}`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (!response.ok) {
                throw new Error('NFT not found')
            }

            const data = await response.json()
            return convertOpenSeaNFT(data.nft, chain)
        } catch (error) {
            console.error('Error fetching NFT details from OpenSea:', error)
            throw new Error('Failed to fetch NFT details from OpenSea')
        }
    }

    /**
     * Buy an NFT from the marketplace
     */
    async buyNFT(listing: MarketplaceListing, buyerAddress: string): Promise<string> {
        try {
            // Check if MetaMask is available
            if (!window.ethereum) {
                throw new Error('Please install MetaMask to buy NFTs on OpenSea')
            }

            // Create ethers provider and signer
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // Verify the buyer address matches the signer
            const signerAddress = await signer.getAddress()
            if (signerAddress.toLowerCase() !== buyerAddress.toLowerCase()) {
                throw new Error('Connected wallet does not match buyer address')
            }

            // Determine chain
            const network = await provider.getNetwork()
            const chain = network.chainId === 1n ? Chain.Mainnet : Chain.Polygon

            // Initialize OpenSea SDK with signer
            const sdk = new OpenSeaSDK(provider as any, {
                chain,
                apiKey: OPENSEA_API_KEY,
            })

            // Fetch the order from OpenSea API
            const orderResponse = await fetch(
                `https://api.opensea.io/api/v2/orders/chain/${listing.nft.chain}/protocol/seaport/listings/${listing.listingId}`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (!orderResponse.ok) {
                throw new Error('Failed to fetch order from OpenSea')
            }

            const orderData = await orderResponse.json()

            // Fulfill the order using OpenSea SDK
            const transaction = await sdk.fulfillOrder({
                order: orderData,
                accountAddress: buyerAddress,
            })

            // Wait for transaction confirmation (if result is a transaction object)
            const txHash = typeof transaction === 'string' ? transaction :
                (transaction as any).hash || (transaction as any).transactionHash || 'tx-pending'

            console.log('Buy transaction successful:', txHash)
            return txHash
        } catch (error) {
            console.error('Error buying NFT on OpenSea:', error)
            throw error
        }
    }

    /**
     * List an NFT for sale on the marketplace
     */
    async listNFT(nft: NFT, price: string, _currency: string, sellerAddress: string): Promise<string> {
        try {
            // Check if MetaMask is available
            if (!window.ethereum) {
                throw new Error('Please install MetaMask to list NFTs on OpenSea')
            }

            // Create ethers provider and signer
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // Verify the seller address matches the signer
            const signerAddress = await signer.getAddress()
            if (signerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
                throw new Error('Connected wallet does not match seller address')
            }

            // Determine chain
            const network = await provider.getNetwork()
            const chain = network.chainId === 1n ? Chain.Mainnet : Chain.Polygon

            // Initialize OpenSea SDK with signer
            const sdk = new OpenSeaSDK(provider as any, {
                chain,
                apiKey: OPENSEA_API_KEY,
            })

            // Convert price to wei (assuming price is in ETH/MATIC)
            const priceInWei = ethers.parseEther(price)

            // Create listing using OpenSea SDK
            // Note: Using 'amount' instead of 'startAmount' for v8
            const listing = await sdk.createListing({
                asset: {
                    tokenAddress: nft.contractAddress,
                    tokenId: nft.tokenId,
                },
                accountAddress: sellerAddress,
                amount: ethers.formatEther(priceInWei),
                // Optional: set expiration (e.g., 30 days from now)
                expirationTime: Math.floor(Date.now() / 1000) + 30 * 24 * 60 * 60,
            }) as any

            const orderHash = listing.orderHash || listing.hash || listing
            console.log('Listing created successfully:', orderHash)
            return orderHash || 'listing-created'
        } catch (error) {
            console.error('Error listing NFT on OpenSea:', error)
            throw error
        }
    }

    /**
     * Cancel an existing listing
     */
    async cancelListing(listingId: string, sellerAddress: string): Promise<string> {
        try {
            // Check if MetaMask is available
            if (!window.ethereum) {
                throw new Error('Please install MetaMask to cancel listings on OpenSea')
            }

            // Create ethers provider and signer
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // Verify the seller address matches the signer
            const signerAddress = await signer.getAddress()
            if (signerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
                throw new Error('Connected wallet does not match seller address')
            }

            // Determine chain
            const network = await provider.getNetwork()
            const chain = network.chainId === 1n ? Chain.Mainnet : Chain.Polygon

            // Initialize OpenSea SDK with signer
            const sdk = new OpenSeaSDK(provider as any, {
                chain,
                apiKey: OPENSEA_API_KEY,
            })

            // Cancel the order using OpenSea SDK
            const result = await sdk.cancelOrder({
                orderHash: listingId,
                accountAddress: sellerAddress,
            }) as any

            const txHash = result.hash || result.transactionHash || result
            console.log('Cancel listing successful:', txHash)
            return typeof txHash === 'string' ? txHash : 'listing-cancelled'
        } catch (error) {
            console.error('Error canceling listing on OpenSea:', error)
            throw error
        }
    }
}

// Export singleton instance
export const openSeaNFTService = new OpenSeaNFTService()
