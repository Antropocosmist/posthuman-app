import { OpenSeaSDK, Chain } from 'opensea-js'
import { ethers, formatUnits } from 'ethers'
import type { NFT, MarketplaceListing, NFTCollection, NFTFilters, NFTServiceInterface } from './types'

// OpenSea API configuration
const OPENSEA_API_KEY = import.meta.env.VITE_OPENSEA_API_KEY || ''

// Helper function to convert OpenSea NFT to our NFT type
function convertOpenSeaNFT(openseaNFT: any, chain: 'ethereum' | 'polygon' | 'base' | 'bsc' | 'gnosis' | 'arbitrum', ownerAddress?: string): NFT {
    // OpenSea API v2 can return 'contract' as string or object
    const contractRaw = openseaNFT.contract || openseaNFT.asset_contract
    const contractAddress = typeof contractRaw === 'string' ? contractRaw : (contractRaw?.address || '')

    // OpenSea API v2 can return 'collection' as string (slug) or object
    const collectionRaw = openseaNFT.collection
    const collectionSlug = typeof collectionRaw === 'string' ? collectionRaw : (collectionRaw?.slug || contractAddress)
    // Helper to format slug into Title Case (e.g. "wildcard-flair" -> "Wildcard Flair")
    const formatSlug = (s: string) => s.split('-').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')

    // If collection is a string (slug) or missing name, fallback to properly formatted slug, then contract name
    const collectionName = (typeof collectionRaw === 'object' ? collectionRaw.name : undefined)
        || (collectionSlug && collectionSlug !== contractAddress ? formatSlug(collectionSlug) : undefined)
        || contractRaw?.name
        || 'Unknown Collection'

    // Use identifier or token_id
    const tokenId = openseaNFT.identifier || openseaNFT.token_id || ''

    return {
        id: `${contractAddress}-${tokenId}`,
        tokenId,
        contractAddress,
        chain,
        name: openseaNFT.name || `#${tokenId}`,
        description: openseaNFT.description || '',
        image: openseaNFT.image_url || openseaNFT.image || '',
        animationUrl: openseaNFT.animation_url,
        externalUrl: openseaNFT.external_link || openseaNFT.permalink,
        collection: {
            id: collectionSlug,
            name: collectionName,
            description: typeof collectionRaw === 'object' ? collectionRaw.description : '',
            image: typeof collectionRaw === 'object' ? (collectionRaw.image_url || collectionRaw.featured_image_url) : '',
            // Floor price comes from collection stats, not usually in the NFT list response, but we might have it in stats
            floorPrice: typeof collectionRaw === 'object' ? collectionRaw.stats?.floor_price?.toString() : undefined,
            totalSupply: typeof collectionRaw === 'object' ? collectionRaw.stats?.total_supply : undefined,
        },
        owner: ownerAddress || openseaNFT.owner?.address || openseaNFT.top_ownerships?.[0]?.owner?.address || '',
        marketplace: 'opensea',
        isListed: !!openseaNFT.sell_orders?.length,
        listingPrice: openseaNFT.sell_orders?.[0]?.current_price,
        listingCurrency: 'ETH',
        listingId: openseaNFT.sell_orders?.[0]?.order_hash || openseaNFT.sell_orders?.[0]?.hash,
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
    async fetchUserNFTs(address: string, chain: 'ethereum' | 'polygon' | 'base' | 'bsc' | 'gnosis' | 'arbitrum' = 'ethereum'): Promise<NFT[]> {
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

            return nfts.map((nft: any) => convertOpenSeaNFT(nft, chain, address))
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
            // Determine chain: use filter if provided, otherwise default to ethereum
            const chain = filters?.chain || (filters?.ecosystem === 'evm' ? 'ethereum' : 'ethereum')

            let url = ''

            // Case 1: Fetching by Seller (My Listings)
            if (filters?.seller) {
                // Endpoint: https://api.opensea.io/api/v2/orders/${chain}/seaport/listings?maker=${address}
                url = `https://api.opensea.io/api/v2/orders/${chain}/seaport/listings?maker=${filters.seller}`
            }
            // Case 2: Fetching by Collection (if valid slug provided)
            else if (filters?.collection && filters.collection !== 'all') {
                url = `https://api.opensea.io/api/v2/listings/collection/${filters.collection}/all`
            }
            // Case 3: Fallback (unsupported generic 'all' fetch, returns empty or featured)
            else {
                // OpenSea doesn't support "get all listings for everything". 
                // We return empty to avoid 404s/400s or useless data.
                return []
            }

            console.log(`[OpenSea] Fetching listings from: ${url}`)

            const hasApiKey = !!OPENSEA_API_KEY;
            console.log(`[OpenSea] Using API Key: ${hasApiKey ? 'YES' : 'NO'}`);

            const response = await fetch(
                url,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (!response.ok) {
                console.error(`[OpenSea] listings API error (${url}): ${response.status} ${response.statusText}`);
                if (response.status === 401 || response.status === 403) {
                    console.error("[OpenSea] 🚨 API Key Missing or Invalid! The 'orders' endpoint likely requires a valid API Key.");
                }
                return []
            }

            const data = await response.json()
            console.log(`[OpenSea] Raw listings data for ${chain}:`, data)

            // Response structure differs slightly between 'orders' and 'listings' endpoints
            // 'orders' endpoint returns { orders: [...] }
            // 'listings' endpoint returns { listings: [...] }
            const listings = data.orders || data.listings || []
            console.log(`[OpenSea] Found ${listings.length} listings/orders`)

            return listings.map((item: any) => {
                // If it's an order object (from maker query), structure is flatter or different
                // If it's a listing object (from collection query), it might be different
                // Standardizing extraction:

                // Order object usually has 'maker' and 'current_price'
                // Listing object usually has 'price.current.value'

                // Extraction for Orders endpoint:
                // Check protocol_data if available
                const nftData = item.maker_asset_bundle?.assets?.[0]
                    || item.protocol_data?.parameters?.offer?.[0]
                    || {}

                // Price is usually in Wei for EVM chains
                const rawPrice = item.current_price
                    || item.price?.current?.value
                    || '0'

                // DEBUG: Inspect the item structure for price and maker issues
                if (item.order_hash || rawPrice === '0') {
                    console.log('[OpenSea] Processing Item:', {
                        hash: item.order_hash,
                        current_price: item.current_price,
                        rawPrice,
                        maker: item.maker
                    })
                }

                // Format price (assuming 18 decimals for ETH/WETH/MATIC default)
                let formattedPrice = '0'
                try {
                    formattedPrice = formatUnits(rawPrice, 18)
                } catch (e) {
                    console.error('[OpenSea] Price format error (ethers), using fallback:', e)
                    // Manual fallback for 18 decimals
                    try {
                        const val = rawPrice.padStart(19, '0')
                        const integer = val.slice(0, val.length - 18)
                        const decimal = val.slice(val.length - 18).replace(/0+$/, '')
                        formattedPrice = decimal ? `${integer}.${decimal}` : integer
                    } catch (fallbackError) {
                        formattedPrice = '0'
                    }
                }

                // Double check for "0.0" or "0" result from ethers if rawPrice was NOT 0
                if ((formattedPrice === '0' || formattedPrice === '0.0') && rawPrice !== '0') {
                    // Try manual fallback again if ethers returned 0 unexpectedly
                    const val = rawPrice.padStart(19, '0')
                    const integer = val.slice(0, val.length - 18)
                    const decimal = val.slice(val.length - 18).replace(/0+$/, '')
                    formattedPrice = decimal ? `${integer}.${decimal}` : integer
                }


                // Determine currency
                let currency = 'ETH'
                if (chain === 'polygon') currency = 'WETH' // Polygon listings usually WETH
                if (chain === 'base') currency = 'ETH'

                // Safely extract maker address (API can return string or object)
                const makerAddress = typeof item.maker === 'string' ? item.maker : (item.maker?.address || filters?.seller || '')

                return {
                    nft: convertOpenSeaNFT(nftData, chain as any),
                    price: formattedPrice,
                    currency: currency,
                    seller: makerAddress,
                    listingId: item.order_hash || '',
                    marketplace: 'opensea' as const,
                    createdAt: new Date(item.created_date || Date.now()),
                    expiresAt: item.expiration_time ? new Date(item.expiration_time * 1000) : undefined,
                }
            })
        } catch (error) {
            console.error('Error fetching marketplace listings from OpenSea:', error)
            return []
        }
    }

    /**
     * Fetch detailed information about a specific NFT
     */
    async fetchNFTDetails(contractAddress: string, tokenId: string, chain: 'ethereum' | 'polygon' | 'base' | 'bsc' | 'gnosis' | 'arbitrum' = 'ethereum'): Promise<NFT> {
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
     * Helper to switch chain
     */
    private async switchChain(chain: 'ethereum' | 'polygon') {
        if (!window.ethereum) return

        const chainId = chain === 'ethereum' ? '0x1' : '0x89'

        try {
            await window.ethereum.request({
                method: 'wallet_switchEthereumChain',
                params: [{ chainId }],
            })
        } catch (switchError: any) {
            // This error code 4902 indicates that the chain has not been added to MetaMask.
            if (switchError.code === 4902) {
                const chainParams = chain === 'ethereum'
                    ? {
                        chainId: '0x1',
                        chainName: 'Ethereum Mainnet',
                        nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
                        rpcUrls: ['https://eth.llamarpc.com'],
                        blockExplorerUrls: ['https://etherscan.io'],
                    }
                    : {
                        chainId: '0x89',
                        chainName: 'Polygon Mainnet',
                        nativeCurrency: { name: 'MATIC', symbol: 'POL', decimals: 18 },
                        rpcUrls: ['https://polygon-rpc.com'],
                        blockExplorerUrls: ['https://polygonscan.com'],
                    }

                try {
                    await window.ethereum.request({
                        method: 'wallet_addEthereumChain',
                        params: [chainParams],
                    })
                } catch (addError) {
                    console.error('Failed to add chain:', addError)
                    throw new Error(`Please switch to ${chain} manually`)
                }
            } else {
                console.error('Failed to switch chain:', switchError)
                throw new Error(`Please switch to ${chain} manually`)
            }
        }
    }

    /**
     * List an NFT for sale on the marketplace
     */
    async listNFT(nft: NFT, price: string, _currency: string, sellerAddress: string, durationInSeconds: number = 2592000): Promise<string> {
        try {
            // Check if MetaMask is available
            if (!window.ethereum) {
                throw new Error('Please install MetaMask to list NFTs on OpenSea')
            }

            // Determine chain based on NFT data
            const nftChain = nft.chain === 'polygon' ? 'polygon' : 'ethereum'
            await this.switchChain(nftChain)

            // Create ethers provider and signer
            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // Verify the seller address matches the signer
            const signerAddress = await signer.getAddress()
            if (signerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
                throw new Error('Connected wallet does not match seller address')
            }

            // Determine chain for SDK
            const chain = nftChain === 'ethereum' ? Chain.Mainnet : Chain.Polygon

            console.log('[OpenSea] Initializing SDK with:', { chain, hasApiKey: !!OPENSEA_API_KEY })
            try {
                console.log('[OpenSea] SDK Class:', OpenSeaSDK)
                // Initialize OpenSea SDK with provider
                // With node polyfills enabled, this should work correctly with ethers v6 provider
                const sdk = new OpenSeaSDK(provider as any, {
                    chain,
                    apiKey: OPENSEA_API_KEY,
                })

                // Convert price to wei (assuming price is in ETH/MATIC)
                const priceInWei = ethers.parseEther(price)

                console.log('[OpenSea] Creating listing for:', { token: nft.contractAddress, id: nft.tokenId, price })

                // Create listing using OpenSea SDK
                const listing = await sdk.createListing({
                    asset: {
                        tokenAddress: nft.contractAddress,
                        tokenId: nft.tokenId,
                    },
                    accountAddress: sellerAddress,
                    amount: ethers.formatEther(priceInWei),
                    expirationTime: Math.round(Date.now() / 1000 + durationInSeconds),
                }) as any

                const orderHash = listing.orderHash || listing.hash || listing
                console.log('Listing created successfully:', orderHash)
                return orderHash || 'listing-created'
            } catch (sdkError) {
                console.error('[OpenSea] SDK Error:', sdkError)
                throw sdkError
            }
        } catch (error) {
            console.error('Error listing NFT on OpenSea:', error)
            throw error
        }
    }

    /**
     * Cancel an existing listing
     */
    async cancelListing(listingId: string, sellerAddress: string, chainName?: string): Promise<string> {
        try {
            // Check if MetaMask is available
            if (!window.ethereum) {
                throw new Error('Please install MetaMask to cancel listings on OpenSea')
            }

            const provider = new ethers.BrowserProvider(window.ethereum)
            const signer = await provider.getSigner()

            // Verify the seller address matches the signer
            const signerAddress = await signer.getAddress()
            if (signerAddress.toLowerCase() !== sellerAddress.toLowerCase()) {
                throw new Error(`Connected wallet (${signerAddress}) does not match listing owner (${sellerAddress})`)
            }

            // Determine target chain enum and ID
            let chain = Chain.Mainnet
            let targetChainId = '0x1'

            if (chainName) {
                if (chainName === 'polygon') { chain = Chain.Polygon; targetChainId = '0x89'; }
                else if (chainName === 'base') { chain = Chain.Base; targetChainId = '0x2105'; }
                else if (chainName === 'arbitrum') { chain = Chain.Arbitrum; targetChainId = '0xa4b1'; }
                else if (chainName === 'optimism') { chain = Chain.Optimism; targetChainId = '0xa'; }
            } else {
                // Fallback if no chain name provided
                const network = await provider.getNetwork()
                chain = network.chainId === 137n ? Chain.Polygon : Chain.Mainnet
            }

            // 1. Force Network Switch if needed
            try {
                const currentNetwork = await provider.getNetwork()
                const currentChainIdHex = '0x' + currentNetwork.chainId.toString(16)

                // Only switch if we have a specific target rule and we aren't on it
                if (chainName && currentChainIdHex !== targetChainId) {
                    console.log(`[OpenSea] Switching network to ${chainName} (${targetChainId})...`)
                    await window.ethereum.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: targetChainId }],
                    });
                }
            } catch (switchError) {
                console.warn('[OpenSea] Failed to switch network automatically:', switchError)
            }

            console.log('[OpenSea] Initializing SDK for cancellation on chain:', chain)

            // 2. Initialize OpenSea SDK with window.ethereum (REQUIRED for Seaport transactions)
            // We revert to using the raw provider because 'signer' objects often lack the full JSON-RPC
            // methods required by the SDK to build and submit complex Seaport transactions.
            const sdk = new OpenSeaSDK(window.ethereum as any, {
                chain,
                apiKey: OPENSEA_API_KEY,
            })

            // 3. Resolve Payload Address
            // The SDK validates that 'accountAddress' exists in the provider's accounts.
            // We fetch the accounts directly to ensure we pass the EXACT string the provider knows.
            // This prevents "Account not available" errors due to case sensitivity (0xabc vs 0xABC).
            const providerAccounts = await window.ethereum.request({ method: 'eth_accounts' }) as string[] || []
            const canonicalAccount = providerAccounts.find(a => a.toLowerCase() === signerAddress.toLowerCase())

            if (!canonicalAccount) {
                // Should not happen if signer worked, but safety check
                throw new Error(`Account ${signerAddress} not found in wallet provider`)
            }

            console.log(`[OpenSea] Calling cancelOrder for: ${listingId} on account: ${canonicalAccount}`)

            // 4. Cancel the order
            const result = await sdk.cancelOrder({
                orderHash: listingId,
                accountAddress: canonicalAccount,
            }) as any

            console.log('[OpenSea] Cancel order result:', result)

            const txHash = result.hash || result.transactionHash || result
            console.log('Cancel listing successful:', txHash)
            return typeof txHash === 'string' ? txHash : 'listing-cancelled'

        } catch (error) {
            console.error('Error canceling listing on OpenSea:', error)
            throw error
        }
    }

    /**
     * Get collection stats
     */
    async getCollectionStats(contractAddress: string): Promise<NFTCollection> {
        try {
            // Try Ethereum first, then Polygon (matic/polygon)
            // OpenSea API sometimes uses 'matic', sometimes 'polygon'. We try both.
            const chains = ['ethereum', 'matic', 'polygon']
            let collectionStats: any = null
            let slug = ''
            let name = 'Unknown Collection'
            let description = ''
            let image = ''

            // 1. Find Collection Slug via Contract
            for (const c of chains) {
                try {
                    const url = `https://api.opensea.io/api/v2/chain/${c}/contract/${contractAddress}`
                    console.log(`[OpenSea] Fetching contract info from: ${url}`)

                    const response = await fetch(
                        url,
                        {
                            headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY, 'accept': 'application/json' } : { 'accept': 'application/json' },
                        }
                    )

                    if (response.ok) {
                        const data = await response.json()
                        // data is { address, chain, collection: "slug" }
                        console.log(`[OpenSea] Found collection data for ${c}:`, data)
                        if (data.collection) {
                            slug = data.collection;
                            break;
                        }
                    } else {
                        console.warn(`[OpenSea] Failed to fetch contract for ${c}: ${response.status} ${response.statusText}`)
                    }
                } catch (e) {
                    console.error(`[OpenSea] Exception fetching contract for ${c}:`, e)
                    continue
                }
            }

            if (!slug) {
                return {
                    id: contractAddress,
                    name: 'Unknown Collection',
                }
            }

            // 2. Fetch Collection Details
            const collectionResponse = await fetch(
                `https://api.opensea.io/api/v2/collections/${slug}`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (collectionResponse.ok) {
                const data = await collectionResponse.json()
                name = data.name || name
                description = data.description || description
                image = data.image_url || image

                // OpenSea V2 Collection Object often has stats
                // Need to check specific API response structure. 
                // However, safe fallback is to request stats endpoint if needed.
            }

            // 3. Fetch Stats
            const statsResponse = await fetch(
                `https://api.opensea.io/api/v2/collections/${slug}/stats`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (statsResponse.ok) {
                const sData = await statsResponse.json()
                // { total: { floor_price: ... } } structure usually for v2 stats
                const floor = sData.total?.floor_price || sData.floor_price
                if (floor) {
                    collectionStats = { floor_price: floor, total_supply: sData.total?.total_supply }
                }
            }

            return {
                id: contractAddress,
                name: name,
                description: description,
                image: image,
                floorPrice: collectionStats?.floor_price ? String(collectionStats.floor_price) : undefined,
                floorPriceCurrency: 'ETH', // OpenSea stats usually in ETH
                totalSupply: collectionStats?.total_supply
            }

        } catch (error) {
            console.error('Error fetching OpenSea collection stats:', error)
            return {
                id: contractAddress,
                name: 'Unknown Collection',
            }
        }
    }
}

// Export singleton instance
export const openSeaNFTService = new OpenSeaNFTService()
