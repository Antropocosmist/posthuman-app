import { OpenSeaSDK, Chain } from 'opensea-js'
import { ethers, formatUnits } from 'ethers'
import type { NFT, MarketplaceListing, NFTCollection, NFTFilters, NFTServiceInterface } from '../../types/types'

// OpenSea API configuration
const OPENSEA_API_KEY = import.meta.env.VITE_OPENSEA_API_KEY || ''
// Build: 2026-02-16 00:30 - Rabby wallet fix

/**
 * Get the correct EVM provider based on connected wallet
 * Rabby wallet uses window.rabby, others use window.ethereum
 */
/**
 * Get the correct EVM provider based on connected wallet
 * Rabby wallet uses window.rabby, others use window.ethereum
 */
import { waitForProvider } from '../../../wallet/utils/eip6963'

/**
 * Get the correct EVM provider based on connected wallet
 * Rabby wallet uses window.rabby, others use window.ethereum
 */
async function getEVMProvider(preferredProvider?: string): Promise<any> {
    // 1. Explicitly requested Keplr
    if (preferredProvider === 'Keplr') {
        // Try EIP-6963 first (most reliable for multiple wallets)
        // Wait up to 2 seconds for Keplr to announce
        try {
            const eipProvider = await waitForProvider('keplr', 2000);
            if (eipProvider) {
                console.log('[OpenSea] Found Keplr via EIP-6963');
                return eipProvider;
            }
        } catch (e) {
            console.warn('[OpenSea] EIP-6963 Keplr discovery timed out', e);
        }

        // If window.ethereum is Keplr, use it
        if ((window as any).ethereum?.isKeplr) {
            console.log('[OpenSea] Found Keplr via window.ethereum.isKeplr');
            return (window as any).ethereum;
        }

        console.warn('[OpenSea] Keplr requested but not found via EIP-6963 or window.ethereum');
    }

    // 2. Explicitly requested Rabby
    if ((preferredProvider === 'Rabby' || (window as any).rabby) && !preferredProvider) {
        // Check if Rabby is the active provider by checking if it has accounts
        try {
            // If window.rabby exists and is functional, use it
            return (window as any).rabby;
        } catch (e) {
            console.warn('[OpenSea] Rabby provider check failed, falling back to ethereum:', e);
        }
    }

    // 3. Fallback / Default
    // Fallback to standard window.ethereum for MetaMask and other wallets
    if (window.ethereum) {
        return window.ethereum;
    }

    throw new Error('No EVM wallet provider found. Please install MetaMask, Rabby, or another EVM wallet.');
}

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
        // OpenSea API v2 can return traits in different formats
        // Try 'traits' first, then 'attributes', then 'metadata.attributes'
        traits: (openseaNFT.traits || openseaNFT.attributes || openseaNFT.metadata?.attributes || []).map((trait: any) => ({
            trait_type: trait.trait_type || trait.key,
            value: trait.value,
            display_type: trait.display_type,
        })),
    }
}

// OpenSea NFT Service Implementation
export class OpenSeaNFTService implements NFTServiceInterface {
    // Note: We use the OpenSea API directly, not the SDK
    // The SDK has initialization issues and is not needed for basic NFT fetching

    /**
     * Batch fetch floor prices for a list of collection slugs
     */
    private async fetchFloorPrices(slugs: string[]): Promise<Record<string, string>> {
        const results: Record<string, string> = {}
        const chunks = []
        // Process in chunks of 5 to avoid rate limits
        for (let i = 0; i < slugs.length; i += 5) {
            chunks.push(slugs.slice(i, i + 5))
        }

        for (const chunk of chunks) {
            await Promise.all(chunk.map(async (slug) => {
                if (!slug) return

                try {
                    const response = await fetch(
                        `https://api.opensea.io/api/v2/collections/${slug}/stats`,
                        {
                            headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                        }
                    )

                    if (response.ok) {
                        const data = await response.json()
                        // V2 stats structure: usually { total: { floor_price: ... } }
                        const floor = data.total?.floor_price || data.floor_price
                        if (floor) {
                            results[slug] = String(floor)
                        }
                    }
                } catch (e) {
                    // Silent fail to not spam console
                }
            }))

            // Small delay between chunks
            if (chunks.length > 1) {
                await new Promise(resolve => setTimeout(resolve, 200))
            }
        }

        return results
    }

    /**
     * Fetch all NFTs owned by a specific address
     */
    async fetchUserNFTs(address: string, chain: 'ethereum' | 'polygon' | 'base' | 'bsc' | 'gnosis' | 'arbitrum' = 'ethereum'): Promise<NFT[]> {
        try {
            // Use OpenSea API to fetch NFTs (no SDK needed for this)
            // Include limit parameter for pagination and ensure we get all data
            const response = await fetch(
                `https://api.opensea.io/api/v2/chain/${chain}/account/${address}/nfts?limit=200`,
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

            console.log(`[OpenSea] Fetched ${nfts.length} NFTs for ${address} on ${chain}`)

            // Convert raw data to NFT objects first
            const convertedNFTs = nfts.map((nft: any) => convertOpenSeaNFT(nft, chain, address))

            // Extract unique collection slugs to fetch floor prices
            // We only care about collections that have a slug (id)
            const uniqueSlugs = [...new Set(convertedNFTs.map((n: NFT) => n.collection.id).filter((id: string) => id && !id.startsWith('0x')))] as string[]

            if (uniqueSlugs.length > 0) {
                console.log(`[OpenSea] Fetching floor prices for ${uniqueSlugs.length} collections...`)
                const floorPrices = await this.fetchFloorPrices(uniqueSlugs)

                // Update NFTs with floor prices
                convertedNFTs.forEach((nft: any) => {
                    if (floorPrices[nft.collection.id]) {
                        nft.collection.floorPrice = floorPrices[nft.collection.id]
                        // OpenSea stats are typically in ETH
                        nft.collection.floorPriceDenom = 'ETH'
                        nft.collection.floorPriceCurrency = 'ETH'
                    }
                })
            }

            return convertedNFTs
        } catch (error) {
            console.error('Error fetching user NFTs from OpenSea:', error)
            // Return empty array instead of throwing to allow graceful degradation
            return []
        }
    }

    /**
     * Fetch all active listings for a specific seller address
     * This is needed because the /account/{address}/nfts endpoint doesn't include sell_orders
     */
    async fetchUserListings(
        address: string,
        chain: 'ethereum' | 'polygon' | 'base' | 'bsc' | 'gnosis' | 'arbitrum' = 'ethereum'
    ): Promise<NFT[]> {
        try {
            // Use OpenSea orders API to fetch seller's listings
            const response = await fetch(
                `https://api.opensea.io/api/v2/orders/${chain}/seaport/listings?maker=${address}`,
                {
                    headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
                }
            )

            if (!response.ok) {
                console.warn(`OpenSea listings API error for ${chain}: ${response.statusText}`)
                return []
            }

            const data = await response.json()
            const orders = data.orders || []

            console.log(`[OpenSea] Found ${orders.length} active listings for ${address} on ${chain}`)

            // Convert orders to NFTs with isListed = true
            return orders.map((order: any) => {
                const nftData = order.maker_asset_bundle?.assets?.[0]
                    || order.protocol_data?.parameters?.offer?.[0]
                    || {}

                const nft = convertOpenSeaNFT(nftData, chain, address)

                // Get price from order
                const rawPrice = order.current_price || '0'
                let formattedPrice = '0'
                try {
                    formattedPrice = formatUnits(rawPrice, 18)
                } catch (e) {
                    console.error('[OpenSea] Price format error:', e)
                }

                // Override isListed and listing info
                return {
                    ...nft,
                    isListed: true,
                    listingPrice: formattedPrice,
                    listingCurrency: chain === 'polygon' ? 'WETH' : 'ETH',
                    listingId: order.order_hash
                }
            })
        } catch (error) {
            console.error('Error fetching user listings from OpenSea:', error)
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
            // Get the correct EVM provider (handles Rabby vs MetaMask)
            const evmProvider = await getEVMProvider();

            // Create ethers provider and signer
            const provider = new ethers.BrowserProvider(evmProvider)
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
    private async switchChain(chain: 'ethereum' | 'polygon', provider: any) {
        if (!provider) return

        const chainId = chain === 'ethereum' ? '0x1' : '0x89'

        try {
            await provider.request({
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
                    await provider.request({
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
            // Get the correct EVM provider (handles Rabby vs MetaMask)
            const evmProvider = await getEVMProvider();

            // Determine chain based on NFT data
            const nftChain = nft.chain === 'polygon' ? 'polygon' : 'ethereum'
            await this.switchChain(nftChain, evmProvider)

            // Create ethers provider and signer
            const provider = new ethers.BrowserProvider(evmProvider)
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
            // Get the correct EVM provider (handles Rabby vs MetaMask)
            const evmProvider = await getEVMProvider();

            const provider = new ethers.BrowserProvider(evmProvider)
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

            // 1. Ensure Wallet is Connected & Accounts are Available
            // We do this FIRST to ensure the provider is "hot" and ready for the SDK.
            console.log('[OpenSea] Requesting accounts...')
            const providerAccounts = await evmProvider.request({ method: 'eth_requestAccounts' }) as string[] || []
            const canonicalAccount = providerAccounts.find(a => a.toLowerCase() === signerAddress.toLowerCase())

            if (!canonicalAccount) {
                // If the specific signer address isn't in the active accounts, we can't proceed
                throw new Error(`Account ${signerAddress} is not active in your wallet. Please select it.`)
            }

            // 2. Force Network Switch if needed
            // The SDK requires the provider to be on the correct chain for transaction signing
            try {
                const currentNetwork = await provider.getNetwork()
                const currentChainIdHex = '0x' + currentNetwork.chainId.toString(16)

                // Only switch if we have a specific target rule and we aren't on it
                if (chainName && currentChainIdHex !== targetChainId) {
                    console.log(`[OpenSea] Switching network to ${chainName} (${targetChainId})...`)
                    await evmProvider.request({
                        method: 'wallet_switchEthereumChain',
                        params: [{ chainId: targetChainId }],
                    });
                }
            } catch (switchError) {
                console.warn('[OpenSea] Failed to switch network automatically:', switchError)
            }

            console.log('[OpenSea] Initializing SDK for cancellation on chain:', chain);
            console.log('[OpenSea] Provider type:', evmProvider === (window as any).rabby ? 'Rabby (window.rabby)' : 'Standard (window.ethereum)');
            console.log('[OpenSea] Canonical account:', canonicalAccount);

            // Note: We use the detected provider directly.
            // window.ethereum cannot be overridden reliably due to browser security.
            if (evmProvider === (window as any).rabby) {
                console.log('[OpenSea] Using Rabby wallet provider');
            }

            // Create a Proxy around the provider to ensure eth_accounts returns the canonical account
            // This bypasses the SDK's internal validation that fails for Rabby in some cases
            const providerProxy = new Proxy(evmProvider, {
                get: (target, prop, receiver) => {
                    // Debug logging to see what the SDK is looking for
                    if (typeof prop === 'string' && !['constructor', 'then', 'toJSON'].includes(prop)) {
                        console.log(`[OpenSea Proxy] Accessing: ${prop}`);
                    }

                    // Mock selectedAddress (legacy property often checked)
                    if (prop === 'selectedAddress') {
                        return canonicalAccount;
                    }

                    if (prop === 'request') {
                        return async (args: any) => {
                            console.log(`[OpenSea Proxy] Request:`, args);
                            // Intercept account requests and return the canonical account we already verified
                            if (args.method === 'eth_accounts' || args.method === 'eth_requestAccounts') {
                                console.log('[OpenSea Proxy] Intercepting account request, returning:', [canonicalAccount]);
                                return [canonicalAccount];
                            }
                            return target.request(args);
                        };
                    }

                    // Specific fix for sendAsync if it exists (legacy)
                    if (prop === 'sendAsync') {
                        return (payload: any, callback: any) => {
                            console.log('[OpenSea Proxy] sendAsync:', payload);
                            if (payload.method === 'eth_accounts') {
                                callback(null, { result: [canonicalAccount] });
                            } else {
                                target.sendAsync(payload, callback);
                            }
                        };
                    }

                    return Reflect.get(target, prop, receiver);
                }
            });

            // 3. Initialize OpenSea SDK with the correct provider
            // IMPORTANT: Wrap in ethers.BrowserProvider as SDK expects a high-level provider
            // This matches the working listNFT implementation
            const ethersProvider = new ethers.BrowserProvider(providerProxy);

            const sdk = new OpenSeaSDK(ethersProvider as any, {
                chain,
                apiKey: OPENSEA_API_KEY,
            })

            // 4. Cancel the order
            const result = await sdk.cancelOrder({
                orderHash: listingId,
                accountAddress: canonicalAccount,
            }) as any

            console.log('[OpenSea] Cancel order result:', result)

            const txHash = result?.hash || result?.transactionHash || result || 'listing-cancelled-confirmed'
            console.log('Cancel listing successful:', txHash)
            return typeof txHash === 'string' ? txHash : 'listing-cancelled'

        } catch (error) {
            console.error('Error canceling listing on OpenSea:', error)
            throw error
        }
    }

    /**
     * Transfer an NFT to another address
     */
    async transferNFT(nft: NFT, recipientAddress: string, senderAddress: string, walletProvider?: string): Promise<string> {
        try {
            // Get the correct EVM provider
            console.log(`[OpenSea] Transfer requested with provider: ${walletProvider}`);
            const evmProvider = await getEVMProvider(walletProvider);

            const provider = new ethers.BrowserProvider(evmProvider)
            const signer = await provider.getSigner()

            // Verify the sender address matches the signer
            const signerAddress = await signer.getAddress()
            if (signerAddress.toLowerCase() !== senderAddress.toLowerCase()) {
                throw new Error(`Connected wallet (${signerAddress}) does not match sender (${senderAddress})`)
            }

            // Determine chain and switch if needed
            const nftChain = nft.chain === 'polygon' ? 'polygon' : 'ethereum'
            await this.switchChain(nftChain, evmProvider)

            console.log(`[OpenSea] Transferring NFT ${nft.tokenId} on ${nftChain} to ${recipientAddress}`)

            // Minimal ABI for both ERC721 and ERC1155 safeTransferFrom
            const abi = [
                "function safeTransferFrom(address from, address to, uint256 tokenId)", // ERC721
                "function safeTransferFrom(address from, address to, uint256 id, uint256 amount, bytes data)" // ERC1155
            ]

            const contract = new ethers.Contract(nft.contractAddress, abi, signer)

            let tx;
            try {
                // Try ERC721 first (most common)
                console.log('[OpenSea] Attempting ERC721 transfer...')
                tx = await contract.safeTransferFrom(senderAddress, recipientAddress, nft.tokenId)
            } catch (erc721Error: any) {
                console.warn('[OpenSea] ERC721 transfer failed, attempting ERC1155...', erc721Error)
                try {
                    // ERC1155 requires amount (1 for NFT) and data (0x)
                    tx = await contract.safeTransferFrom(senderAddress, recipientAddress, nft.tokenId, 1, "0x")
                } catch (erc1155Error: any) {
                    console.error('[OpenSea] ERC1155 transfer failed:', erc1155Error)
                    throw new Error('Transfer failed. The contract might not support transfer or you may not be the owner.')
                }
            }

            console.log('[OpenSea] Transfer transaction sent:', tx.hash)
            await tx.wait()
            console.log('[OpenSea] Transfer confirmed')

            return tx.hash

        } catch (error) {
            console.error('Error transferring NFT on EVM:', error)
            throw error
        }
    }

    /**
     * Get collection stats
     */
    /**
     * Get collection stats
     */
    async getCollectionStats(contractAddress: string): Promise<NFTCollection> {
        try {
            // Try Ethereum first, then Polygon (matic/polygon)
            const chains = ['ethereum', 'matic', 'polygon']
            let collectionStats: any = null
            let slug = ''
            let foundChain = 'ethereum'
            let name = 'Unknown Collection'
            let description = ''
            let image = ''

            // 1. Find Collection Slug via Contract
            for (const c of chains) {
                try {
                    const url = `https://api.opensea.io/api/v2/chain/${c}/contract/${contractAddress}`
                    const response = await fetch(url, {
                        headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY, 'accept': 'application/json' } : { 'accept': 'application/json' },
                    })

                    if (response.ok) {
                        const data = await response.json()
                        if (data.collection) {
                            slug = data.collection;
                            foundChain = c;
                            break;
                        }
                    }
                } catch (e) {
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
            const collectionResponse = await fetch(`https://api.opensea.io/api/v2/collections/${slug}`, {
                headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
            })

            if (collectionResponse.ok) {
                const data = await collectionResponse.json()
                name = data.name || name
                description = data.description || description
                image = data.image_url || image
            }

            // 3. Fetch Stats
            const statsResponse = await fetch(`https://api.opensea.io/api/v2/collections/${slug}/stats`, {
                headers: OPENSEA_API_KEY ? { 'X-API-KEY': OPENSEA_API_KEY } : {},
            })

            if (statsResponse.ok) {
                const sData = await statsResponse.json()
                const floor = sData.total?.floor_price || sData.floor_price
                if (floor) {
                    collectionStats = { floor_price: floor, total_supply: sData.total?.total_supply }
                }
            }

            // Determine currency symbol based on chain
            // Polygon listings usually use WETH
            const isPolygon = foundChain === 'matic' || foundChain === 'polygon';
            const currency = isPolygon ? 'WETH' : 'ETH';

            return {
                id: slug,
                name: name,
                description: description,
                image: image,
                floorPrice: collectionStats?.floor_price ? String(collectionStats.floor_price) : undefined,
                floorPriceCurrency: currency,
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
