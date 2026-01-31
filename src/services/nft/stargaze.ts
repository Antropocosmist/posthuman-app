import { ApolloClient, InMemoryCache, gql, HttpLink } from '@apollo/client'
import { SigningStargateClient } from '@cosmjs/stargate'
import { toUtf8 } from '@cosmjs/encoding'
import type { NFT, NFTCollection, MarketplaceListing, NFTFilters, NFTServiceInterface } from './types'

const STARGAZE_GRAPHQL_ENDPOINT = 'https://graphql.mainnet.stargaze-apis.com/graphql'
const STARGAZE_RPC_ENDPOINT = 'https://rpc.stargaze-apis.com'
const STARGAZE_MARKETPLACE_CONTRACT = 'stars1fvhcnyddukcqfnt7nlwv3thm5we22lyxyxylr9h77cvgkcn43xfsvgv0pl' // Stargaze marketplace v2

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
    query GetUserNFTs($ownerAddr: String!) {
        tokens(ownerAddr: $ownerAddr) {
            tokens {
                tokenId
                name
                description
                image
                collection {
                    contractAddress
                    name
                    description
                    image
                }
                owner {
                    addr
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
    query GetMarketplaceListings($limit: Int, $offset: Int, $sortBy: String) {
        asks(limit: $limit, offset: $offset, sortBy: $sortBy) {
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
        collection(collectionAddr: $collectionAddr) {
            contractAddress
            name
            description
            image
            floorPrice
            totalSupply
        }
    }
`

// Helper function to convert Stargaze NFT to our NFT type
function convertStargazeNFT(stargazeNFT: any, collection: any): NFT {
    return {
        id: `${collection.contractAddress}-${stargazeNFT.tokenId}`,
        tokenId: stargazeNFT.tokenId,
        contractAddress: collection.contractAddress,
        chain: 'stargaze',
        name: stargazeNFT.name || `#${stargazeNFT.tokenId}`,
        description: stargazeNFT.description || '',
        image: stargazeNFT.image || '',
        animationUrl: stargazeNFT.animationUrl,
        externalUrl: stargazeNFT.externalUrl,
        collection: {
            id: collection.contractAddress,
            name: collection.name || 'Unknown Collection',
            description: collection.description,
            image: collection.image,
            floorPrice: collection.floorPrice,
            totalSupply: collection.totalSupply,
        },
        owner: stargazeNFT.owner?.addr || '',
        marketplace: stargazeNFT.forSale ? 'stargaze' : undefined,
        isListed: stargazeNFT.forSale || false,
        listingPrice: stargazeNFT.price?.amount,
        listingCurrency: stargazeNFT.price?.denom || 'ustars',
        traits: stargazeNFT.traits?.map((trait: any) => ({
            trait_type: trait.name,
            value: trait.value,
        })) || [],
    }
}

// Stargaze NFT Service Implementation
export class StargazeNFTService implements NFTServiceInterface {
    /**
     * Fetch all NFTs owned by a specific address
     */
    async fetchUserNFTs(address: string): Promise<NFT[]> {
        try {
            const { data } = await client.query<any>({
                query: GET_USER_NFTS,
                variables: { ownerAddr: address },
            })

            if (!data?.tokens?.tokens) {
                return []
            }

            return data.tokens.tokens.map((token: any) =>
                convertStargazeNFT(token, token.collection)
            )
        } catch (error) {
            console.error('Error fetching user NFTs from Stargaze:', error)
            throw new Error('Failed to fetch NFTs from Stargaze')
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

            // Create signing client
            const client = await SigningStargateClient.connectWithSigner(
                STARGAZE_RPC_ENDPOINT,
                offlineSigner
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
            const result = await client.signAndBroadcast(
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

            // Create signing client
            const client = await SigningStargateClient.connectWithSigner(
                STARGAZE_RPC_ENDPOINT,
                offlineSigner
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
            const listMsg = {
                set_ask: {
                    sale_type: 'fixed_price',
                    collection: nft.contractAddress,
                    token_id: nft.tokenId,
                    price: {
                        amount: price,
                        denom: currency || 'ustars',
                    },
                    // Optional: set expiration (e.g., 30 days from now)
                    expires: {
                        at_time: String(Date.now() * 1000000 + 30 * 24 * 60 * 60 * 1000000000), // nanoseconds
                    },
                }
            }

            const listExecuteMsg = {
                typeUrl: '/cosmwasm.wasm.v1.MsgExecuteContract',
                value: {
                    sender: sellerAddress,
                    contract: STARGAZE_MARKETPLACE_CONTRACT,
                    msg: toUtf8(JSON.stringify(listMsg)),
                    funds: [],
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

            // Create signing client
            const client = await SigningStargateClient.connectWithSigner(
                STARGAZE_RPC_ENDPOINT,
                offlineSigner
            )

            // Note: listingId in Stargaze is typically the collection + token_id
            // Parse it if needed, or use the listing data directly
            const cancelMsg = {
                remove_ask: {
                    collection: listingId.split('-')[0], // Assuming format: collection-tokenId
                    token_id: listingId.split('-')[1],
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
            const result = await client.signAndBroadcast(
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
    async getCollectionInfo(contractAddress: string): Promise<NFTCollection> {
        try {
            const { data } = await client.query<any>({
                query: GET_COLLECTION_INFO,
                variables: { collectionAddr: contractAddress },
            })

            if (!data?.collection) {
                throw new Error('Collection not found')
            }

            return {
                id: data.collection.contractAddress,
                name: data.collection.name,
                description: data.collection.description,
                image: data.collection.image,
                floorPrice: data.collection.floorPrice,
                totalSupply: data.collection.totalSupply,
            }
        } catch (error) {
            console.error('Error fetching collection info from Stargaze:', error)
            throw new Error('Failed to fetch collection info from Stargaze')
        }
    }
}

// Export singleton instance
export const stargazeNFTService = new StargazeNFTService()
