import { ApolloClient, InMemoryCache, gql, HttpLink } from '@apollo/client'

import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate'
import { GasPrice } from '@cosmjs/stargate'
import { toUtf8 } from '@cosmjs/encoding'
import type { NFT, NFTCollection, MarketplaceListing, NFTFilters, NFTServiceInterface } from './types'

const STARGAZE_GRAPHQL_ENDPOINT = 'https://graphql.mainnet.stargaze-apis.com/graphql'
const STARGAZE_RPC_ENDPOINT = 'https://rpc.stargaze-apis.com'
const STARGAZE_MARKETPLACE_CONTRACT = 'stars1e6g3yhasf7cr2vnae7qxytrys4e8v8wchyj377juvxfk9k6t695s38jkgw' // Mainnet Marketplace V2

// Initialize Apollo Client for Stargaze
const client = new ApolloClient({
    link: new HttpLink({
        uri: STARGAZE_GRAPHQL_ENDPOINT,
    }),
    cache: new InMemoryCache(),
    defaultOptions: {
        query: {
            fetchPolicy: 'network-only',
        },
    },
})

// GraphQL Queries
const GET_USER_NFTS = gql`
    query GetUserNFTs($owner: String!, $limit: Int, $offset: Int) {
        tokens(owner: $owner, limit: $limit, offset: $offset) {
            tokens {
                tokenId
                name
                description
                imageUrl
                media {
                    url
                }
                collection {
                    contractAddress
                    name
                    description
                }
                traits {
                    name
                    value
                }
            }
        }
    }
`

const GET_MARKETPLACE_LISTINGS = gql`
    query GetMarketplaceListings($limit: Int, $offset: Int, $sortBy: String, $collectionAddr: String) {
        asks(limit: $limit, offset: $offset, sortBy: $sortBy, collectionAddr: $collectionAddr) {
            asks {
                id
                tokenId
                price {
                    amount
                    denom
                }
                seller
                collection {
                    contractAddress
                    name
                    image
                }
                token {
                    name
                    description
                    image
                    traits {
                        name
                        value
                    }
                }
            }
        }
    }
`

const GET_NFT_DETAILS = gql`
    query GetNFTDetails($collectionAddr: String!, $tokenId: String!) {
        token(collectionAddr: $collectionAddr, tokenId: $tokenId) {
            tokenId
            name
            description
            image
            animationUrl
            externalUrl
            owner {
                addr
            }
            collection {
                contractAddress
                name
                description
                image
                floorPrice
            }
            traits {
                name
                value
            }
            forSale
            price {
                amount
                denom
            }
        }
    }
`

const GET_COLLECTION_INFO = gql`
    query GetCollectionInfo($collectionAddr: String!) {
        tokens(collectionAddr: $collectionAddr, limit: 1) {
            tokens {
                collection {
                    contractAddress
                    name
                    floorPrice
                    tradingAsset {
                        symbol
                        denom
                    }
                }
            }
        }
    }
`

const GET_USER_ASKS = gql`
    query GetUserAsks($seller: String!) {
        tokens(sellerAddrOrName: $seller, limit: 100, filterForSale: LISTED) {
            tokens {
                tokenId
                name
                media {
                    url
                }
                imageUrl
                listPrice {
                    amount
                    denom
                }
                collection {
                    contractAddress
                    name
                    tradingAsset {
                        symbol
                        denom
                    }
                }
            }
        }
    }
`

// Helper to format IPFS URLs
function formatIpfsUrl(url: string): string {
    if (!url) return ''
    if (url.startsWith('ipfs://')) {
        return url.replace('ipfs://', 'https://ipfs.io/ipfs/')
    }
    // Handle Stargaze Gateway (Restricted) -> Switch to Public Gateway
    if (url.includes('ipfs-gw.stargaze-apis.com')) {
        return url.replace('ipfs-gw.stargaze-apis.com', 'ipfs.io')
    }
    return url
}

// Helper function to convert Stargaze NFT to our NFT type
function convertStargazeNFT(stargazeNFT: any, collection: any): NFT {
    // Handle image from various possible fields
    const rawImage = stargazeNFT.imageUrl || stargazeNFT.media?.url || stargazeNFT.image || ''
    const image = formatIpfsUrl(rawImage)

    // Handle listing info
    let listingPrice = stargazeNFT.price?.amount
    let listingCurrency = stargazeNFT.price?.denom || 'ustars'

    if (stargazeNFT.listPrice) {
        // listPrice from 'tokens' query is scalar (micro-amount)
        listingPrice = stargazeNFT.listPrice

        // Try to get currency from collection trading asset
        if (collection?.tradingAsset?.denom) {
            listingCurrency = collection.tradingAsset.denom
        }
    }

    return {
        id: `${collection.contractAddress}-${stargazeNFT.tokenId}`,
        tokenId: stargazeNFT.tokenId,
        contractAddress: collection.contractAddress,
        chain: 'stargaze',
        name: stargazeNFT.name || `#${stargazeNFT.tokenId}`,
        description: stargazeNFT.description || '',
        image: image,
        animationUrl: stargazeNFT.animationUrl,
        externalUrl: stargazeNFT.externalUrl,
        collection: {
            id: collection.contractAddress,
            name: collection.name || 'Unknown Collection',
            description: collection.description,
            image: formatIpfsUrl(collection.image),
            floorPrice: collection.floorPrice,
            totalSupply: collection.totalSupply,
            floorPriceCurrency: collection.tradingAsset?.symbol,
            floorPriceDenom: collection.tradingAsset?.denom
        },
        owner: stargazeNFT.owner?.addr || '',
        marketplace: (stargazeNFT.forSale || stargazeNFT.listPrice) ? 'stargaze' : undefined,
        isListed: !!(stargazeNFT.forSale || stargazeNFT.listPrice),
        listingPrice: listingPrice,
        listingCurrency: listingCurrency,
        traits: stargazeNFT.traits?.map((trait: any) => ({
            trait_type: trait.name,
            value: trait.value,
        })) || [],
    }
}


// Stargaze NFT Service Implementation
export class StargazeNFTService implements NFTServiceInterface {
    /**
     * Fetch all NFTs owned by a specific address, including those listed for sale
     */
    async fetchUserNFTs(address: string, limit: number = 100, offset: number = 0): Promise<NFT[]> {
        console.log(`[Stargaze] Fetching NFTs for ${address} (limit: ${limit}, offset: ${offset})`)
        try {
            // 1. Fetch tokens in wallet
            const tokensPromise = client.query<any>({
                query: GET_USER_NFTS,
                variables: { owner: address, limit, offset },
            })

            // 2. Fetch active asks (listings) - important because Stargaze escrows listed NFTs
            const asksPromise = client.query<any>({
                query: GET_USER_ASKS,
                variables: { seller: address },
                fetchPolicy: 'network-only', // Ensure fresh data
            })

            const [tokensResult, asksResult] = await Promise.all([tokensPromise, asksPromise])

            const tokens = tokensResult.data?.tokens?.tokens || []
            const asks = asksResult.data?.tokens?.tokens || []

            console.log(`[Stargaze] Found ${tokens.length} wallet tokens and ${asks.length} listed asks for ${address}`)
            if (asks.length > 0) {
                console.log('[Stargaze] First ask sample:', asks[0])
            }

            // Convert wallet tokens
            const walletNFTs: NFT[] = tokens.map((token: any) =>
                convertStargazeNFT(token, token.collection)
            )

            // Convert asks to NFTs
            const askNFTs: NFT[] = asks.map((token: any) => {
                // The 'token' object here is similar to wallet token, but has listPrice
                // We pass it to convertStargazeNFT.
                // Note: convertStargazeNFT handles listPrice if present.
                const nft = convertStargazeNFT(token, token.collection)
                // Explicitly set isListed because the query filters for listed items
                nft.isListed = true
                // The new GET_USER_ASKS query returns tokens directly with listPrice,
                // so we can derive listingId from contractAddress and tokenId.
                nft.listingId = `${token.collection.contractAddress}-${token.tokenId}`
                nft.listingPrice = token.listPrice?.amount
                nft.listingCurrency = token.listPrice?.denom
                nft.owner = address // User is the owner (seller)
                // Ensure ID matches what we expect
                nft.id = `${token.collection.contractAddress}-${token.tokenId}`
                nft.tokenId = token.tokenId // Ensure tokenId is set
                return nft
            })

            // Merge: If an NFT is in both (shouldn't happen often if escrowed), prefer the Ask version (listed)
            const nftMap = new Map<string, NFT>()

            // Add wallet NFTs first
            walletNFTs.forEach(nft => nftMap.set(nft.id, nft))

            // Add/Overwrite with Ask NFTs
            askNFTs.forEach(nft => nftMap.set(nft.id, nft))

            return Array.from(nftMap.values())
        } catch (error) {
            console.error('Error fetching user NFTs from Stargaze:', error)
            // Fallback to empty array prevents crashing the entire app if Stargaze API fails
            return []
        }
    }

    /**
     * Fetch marketplace listings with optional filters
     */
    async fetchMarketplaceListings(filters?: NFTFilters): Promise<MarketplaceListing[]> {
        try {
            const limit = 50
            const offset = 0
            const sortBy = filters?.sortBy || 'recently_listed'

            const { data } = await client.query<any>({
                query: GET_MARKETPLACE_LISTINGS,
                variables: { limit, offset, sortBy },
            })

            if (!data?.asks?.asks) {
                return []
            }

            return data.asks.asks.map((ask: any) => ({
                nft: convertStargazeNFT(ask.token, ask.collection),
                price: ask.price.amount,
                currency: ask.price.denom,
                seller: ask.seller,
                listingId: ask.id,
                marketplace: 'stargaze' as const,
                createdAt: new Date(), // TODO: Get actual creation date from API
            }))
        } catch (error) {
            console.error('Error fetching marketplace listings from Stargaze:', error)
            throw new Error('Failed to fetch marketplace listings from Stargaze')
        }
    }

    /**
     * Fetch detailed information about a specific NFT
     */
    async fetchNFTDetails(contractAddress: string, tokenId: string): Promise<NFT> {
        try {
            const { data } = await client.query<any>({
                query: GET_NFT_DETAILS,
                variables: {
                    collectionAddr: contractAddress,
                    tokenId: tokenId,
                },
            })

            if (!data?.token) {
                throw new Error('NFT not found')
            }

            return convertStargazeNFT(data.token, data.token.collection)
        } catch (error) {
            console.error('Error fetching NFT details from Stargaze:', error)
            throw new Error('Failed to fetch NFT details from Stargaze')
        }
    }

    /**
     * Buy an NFT from the marketplace
     * This will interact with the Stargaze marketplace contract
     */
    async buyNFT(listing: MarketplaceListing, buyerAddress: string): Promise<string> {
        try {
            // Get wallet from window (Keplr or Adena)
            if (!window.keplr && !(window as any).adena) {
                throw new Error('Please install Keplr or Adena wallet')
            }

            const wallet = window.keplr || (window as any).adena

            // Enable Stargaze chain
            await wallet.enable('stargaze-1')

            // Get offline signer
            const offlineSigner = await wallet.getOfflineSigner('stargaze-1')

            // Create signing client (CosmWasm)
            const signingClient = await SigningCosmWasmClient.connectWithSigner(
                STARGAZE_RPC_ENDPOINT,
                offlineSigner,
                { gasPrice: GasPrice.fromString('1ustars') }
            )

            // Parse price (assuming it's in ustars)
            const priceAmount = listing.price
            const priceDenom = listing.currency || 'ustars'

            // Create buy message for Stargaze marketplace
            const buyMsg = {
                buy_now: {
                    collection: listing.nft.contractAddress,
                    token_id: listing.nft.tokenId,
                }
            }

            // Execute contract
            const executeMsg = {
                typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                value: {
                    sender: buyerAddress,
                    contract: STARGAZE_MARKETPLACE_CONTRACT,
                    msg: toUtf8(JSON.stringify(buyMsg)),
                    funds: [{ denom: priceDenom, amount: priceAmount }],
                },
            }

            // Broadcast transaction
            const result = await signingClient.signAndBroadcast(
                buyerAddress,
                [executeMsg],
                'auto',
                'Buy NFT on Stargaze'
            )

            if (result.code !== 0) {
                throw new Error(`Transaction failed: ${result.rawLog}`)
            }

            console.log('Buy transaction successful:', result.transactionHash)
            return result.transactionHash
        } catch (error) {
            console.error('Error buying NFT on Stargaze:', error)
            throw error
        }
    }

    /**
     * List an NFT for sale on the marketplace
     */
    async listNFT(nft: NFT, price: string, currency: string, sellerAddress: string): Promise<string> {
        try {
            // Get wallet from window (Keplr or Adena)
            if (!window.keplr && !(window as any).adena) {
                throw new Error('Please install Keplr or Adena wallet')
            }

            const wallet = window.keplr || (window as any).adena

            // Enable Stargaze chain
            await wallet.enable('stargaze-1')

            // Get offline signer
            const offlineSigner = await wallet.getOfflineSigner('stargaze-1')

            // Create signing client (CosmWasm)
            const client = await SigningCosmWasmClient.connectWithSigner(
                STARGAZE_RPC_ENDPOINT,
                offlineSigner,
                { gasPrice: GasPrice.fromString('1ustars') }
            )

            // First, approve the NFT for the marketplace (if not already approved)
            const approveMsg = {
                approve: {
                    spender: STARGAZE_MARKETPLACE_CONTRACT,
                    token_id: nft.tokenId,
                }
            }

            const approveExecuteMsg = {
                typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                value: {
                    sender: sellerAddress,
                    contract: nft.contractAddress,
                    msg: toUtf8(JSON.stringify(approveMsg)),
                    funds: [],
                },
            }

            // Create listing message
            // User provided payload structure:
            // {"set_ask":{"collection":"...","token_id":"...","details":{"price":{"denom":"...","amount":"..."}}}}
            const listMsg = {
                set_ask: {
                    collection: nft.contractAddress,
                    token_id: nft.tokenId,
                    details: {
                        price: {
                            // Convert to micro-units (assume 6 decimals for Cosmos tokens like STARS, ATOM)
                            amount: Math.floor(parseFloat(price) * 1000000).toString(),
                            denom: currency || 'ustars',
                        }
                    }
                }
            }

            const listExecuteMsg = {
                typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                value: {
                    sender: sellerAddress,
                    contract: STARGAZE_MARKETPLACE_CONTRACT,
                    msg: toUtf8(JSON.stringify(listMsg)),
                    // Listing fee: 0.5 STARS (500,000 ustars)
                    funds: [{ denom: 'ustars', amount: '500000' }],
                },
            }

            // Execute both messages in one transaction
            const result = await client.signAndBroadcast(
                sellerAddress,
                [approveExecuteMsg, listExecuteMsg],
                'auto',
                'List NFT on Stargaze'
            )

            if (result.code !== 0) {
                throw new Error(`Transaction failed: ${result.rawLog}`)
            }

            console.log('List transaction successful:', result.transactionHash)
            // Return transaction hash as listing ID
            return result.transactionHash
        } catch (error) {
            console.error('Error listing NFT on Stargaze:', error)
            throw error
        }
    }

    /**
     * Cancel an existing listing
     */
    async cancelListing(listingId: string, sellerAddress: string): Promise<string> {
        try {
            // Get wallet from window (Keplr or Adena)
            if (!window.keplr && !(window as any).adena) {
                throw new Error('Please install Keplr or Adena wallet')
            }

            const wallet = window.keplr || (window as any).adena

            // Enable Stargaze chain
            await wallet.enable('stargaze-1')

            // Get offline signer
            const offlineSigner = await wallet.getOfflineSigner('stargaze-1')

            // Create signing client (CosmWasm)
            const signingClient = await SigningCosmWasmClient.connectWithSigner(
                STARGAZE_RPC_ENDPOINT,
                offlineSigner,
                { gasPrice: GasPrice.fromString('1ustars') }
            )

            // Note: listingId passed here might be "collection-tokenId" because our fetch query doesn't return Ask ID.
            // We need to resolve the numeric Ask ID first.
            let askId: number

            // Check if listingId is already numeric (improbable with current logic but good for safety)
            if (!isNaN(Number(listingId)) && !listingId.includes('-')) {
                askId = Number(listingId)
            } else {
                // It's likely collection-tokenId. We need to query the Ask ID.
                console.log(`[Stargaze] Resolving Ask ID for ${listingId} via contract query (asks_by_seller)...`)
                const collectionAddr = listingId.split('-')[0]
                const tokenId = listingId.split('-')[1]

                // Use "asks_by_seller" to find the listing. 
                // This is robust because it queries only the user's listings.
                try {
                    const queryMsg = {
                        asks_by_seller: {
                            seller: sellerAddress,
                            limit: 100 // Assume user has < 100 active listings, or we need pagination
                        }
                    }
                    console.log('[Stargaze] Querying contract for asks_by_seller:', queryMsg)

                    const response = await signingClient.queryContractSmart(
                        STARGAZE_MARKETPLACE_CONTRACT,
                        queryMsg
                    )

                    console.log('[Stargaze] Contract asks_by_seller response:', response)

                    const asks = response?.asks || []
                    // Find the ask that matches our collection and token_id
                    // Note: Stargaze token_id in response is likely string
                    const targetAsk = asks.find((a: any) =>
                        a.collection === collectionAddr &&
                        String(a.token_id) === String(tokenId)
                    )

                    if (!targetAsk) {
                        throw new Error(`Could not find active listing (Ask ID) for token ${tokenId} in your listings.`)
                    }

                    askId = targetAsk.id
                    console.log(`[Stargaze] Resolved Ask ID: ${askId}`)
                } catch (err) {
                    console.error('[Stargaze] Failed to resolve Ask ID via asks_by_seller:', err)
                    throw new Error(`Failed to resolve listing ID for token ${tokenId}. It might not be listed or the contract query failed.`)
                }
            }

            const cancelMsg = {
                remove_ask: {
                    id: askId
                }
            }

            const executeMsg = {
                typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                value: {
                    sender: sellerAddress,
                    contract: STARGAZE_MARKETPLACE_CONTRACT,
                    msg: toUtf8(JSON.stringify(cancelMsg)),
                    funds: [],
                },
            }

            // Broadcast transaction
            const result = await signingClient.signAndBroadcast(
                sellerAddress,
                [executeMsg],
                'auto',
                'Cancel NFT listing on Stargaze'
            )

            if (result.code !== 0) {
                throw new Error(`Transaction failed: ${result.rawLog}`)
            }

            console.log('Cancel listing successful:', result.transactionHash)
            return result.transactionHash
        } catch (error) {
            console.error('Error canceling listing on Stargaze:', error)
            throw error
        }
    }

    /**
     * Get collection information
     */
    async getCollectionStats(contractAddress: string): Promise<NFTCollection> {
        console.log(`[Stargaze] Fetching stats for contract: ${contractAddress}`)
        try {
            const { data } = await client.query<any>({
                query: GET_COLLECTION_INFO,
                variables: { collectionAddr: contractAddress },
                fetchPolicy: 'network-only', // Ensure fresh data
            })
            console.log(`[Stargaze] Stats Query raw data for ${contractAddress}:`, data)

            // Extract collection info from the first token's collection field
            const collectionData = data?.tokens?.tokens?.[0]?.collection
            let floorPrice = collectionData?.floorPrice

            // Fallback: If floor price is missing or 0, fetch lowest listing
            // NOTE: We wrap this in try-catch and simple log to avoid breaking the UI if GET_MARKETPLACE_LISTINGS fails
            if (!floorPrice || floorPrice === '0' || floorPrice === 0) {
                try {
                    const { data: askData } = await client.query<any>({
                        query: GET_MARKETPLACE_LISTINGS,
                        variables: {
                            sortBy: 'PRICE_ASC',
                            limit: 1,
                            collectionAddr: contractAddress
                        },
                    })

                    // Extract price from lowest listing
                    const cheapest = askData?.asks?.asks?.[0]
                    if (cheapest?.price?.amount) {
                        floorPrice = cheapest.price.amount
                    }
                } catch (e) {
                    console.warn('Fallback floor fetch failed (likely due to indexer issues):', e)
                }
            }

            // Simple version for now: Use what we have, but format it.
            // If raw integer (ustars), convert to STARS.
            // Heuristic: If > 1000000, likely ustars.
            // Dynamic Currency Support
            const symbol = collectionData?.tradingAsset?.symbol || 'STARS'
            const denom = collectionData?.tradingAsset?.denom || 'ustars'
            let formattedFloor = floorPrice ? String(floorPrice) : undefined

            if (floorPrice && !isNaN(Number(floorPrice))) {
                const num = Number(floorPrice)
                // Heuristic: If > 1000, assume microunits (uatom, ustars, etc are 6 decimals)
                // If it's a very low price (e.g. 0.5 STARS), it would be sent as 500000.
                // If it's literally "4" (4 units), it would be sent as 4000000.
                if (num > 1000) {
                    const val = num / 1000000
                    formattedFloor = val.toLocaleString(undefined, { maximumFractionDigits: 2 }) + ' ' + symbol
                } else {
                    formattedFloor = floorPrice + ' ' + symbol
                }
            }

            if (!collectionData) {
                // If main query failed but fallback worked? Unlikely as main query fetches metadata.
                // But we can return partial.
                if (formattedFloor) {
                    return {
                        id: contractAddress,
                        name: 'Collection',
                        floorPrice: formattedFloor,
                        floorPriceCurrency: symbol,
                        floorPriceDenom: denom,
                    }
                }
                throw new Error('Collection not found')
            }

            return {
                id: collectionData.contractAddress || contractAddress,
                name: collectionData.name,
                description: collectionData.description,
                image: collectionData.image,
                floorPrice: formattedFloor,
                floorPriceCurrency: symbol,
                floorPriceDenom: denom,
                totalSupply: collectionData.totalSupply,
            }
        } catch (error) {
            console.error('Error fetching collection info from Stargaze:', error)
            // Return stub to avoid UI crash, allowing NFT details to load
            return {
                id: contractAddress,
                name: 'Unknown Collection',
                floorPrice: undefined
            }
        }
    }
}

// Export singleton instance
export const stargazeNFTService = new StargazeNFTService()
