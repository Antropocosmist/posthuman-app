import type { ChainType } from '../store/walletStore'

export interface NFT {
    id: string
    name: string
    image: string
    collectionName?: string
    description?: string
}

// ------------------------------------------------------------------
// Stargaze (Cosmos) - GraphQL
// ------------------------------------------------------------------
const STARGAZE_GRAPHQL = 'https://graphql.mainnet.stargaze-apis.com/graphql'

const fetchStargazeNFTs = async (address: string): Promise<NFT[]> => {
    // Correct Query: 'owner' argument + Nested 'tokens' selection
    const query = `
    query OwnedTokens($owner: String!) {
      tokens(owner: $owner, limit: 50) {
        tokens {
          tokenId
          name
          description
          media {
            url
          }
          collection {
            name
          }
        }
      }
    }
  `

    try {
        console.log(`[Stargaze] Fetching NFTs for ${address}...`)
        const res = await fetch(STARGAZE_GRAPHQL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { owner: address }
            })
        })

        const json = await res.json()

        if (json.errors) {
            console.error('[Stargaze] GraphQL Errors:', json.errors)
            return []
        }

        // Handle nested structure: data.tokens.tokens
        // The first 'tokens' is the result object (pagination etc), the second is the array.
        const items = json.data?.tokens?.tokens || []
        console.log(`[Stargaze] Found ${items.length} tokens`)

        return items.map((t: any) => ({
            id: t.tokenId,
            name: t.name || `Stargaze #${t.tokenId}`,
            image: t.media?.url || '', // Stargaze usually provides direct URLs
            collectionName: t.collection?.name,
            description: t.description
        })).filter((n: NFT) => n.image) // Filter out missing images
    } catch (e) {
        console.error('[Stargaze] Fetch Failed:', e)
        return []
    }
}

// ------------------------------------------------------------------
// Solana - DAS API (Placeholder / Configurable)
// ------------------------------------------------------------------
const fetchSolanaNFTs = async (_address: string): Promise<NFT[]> => {
    // Needs a Helius/Quicknode RPC that supports 'getAssetsByOwner'
    // const RPC = 'https://mainnet.helius-rpc.com/?api-key=...'

    // For now, return empty or mock if debugging, but let's keep it strictly empty to avoid fake data
    // unless we have a public DAS endpoint (rare).
    console.warn("Solana NFT fetching requires a DAS-enabled RPC key.")
    return []
}

// ------------------------------------------------------------------
// EVM - SimpleHash / Alchemy (Placeholder / Configurable)
// ------------------------------------------------------------------
const fetchEVMNFTs = async (_address: string, _chainId?: string): Promise<NFT[]> => {
    // Needs an Indexer API Key
    console.warn("EVM NFT fetching requires an Indexer API Key (SimpleHash/Alchemy).")
    return []
}

// ------------------------------------------------------------------
// Main Service
// ------------------------------------------------------------------
export const fetchNFTs = async (address: string, chain: ChainType, chainId?: string): Promise<NFT[]> => {
    if (chain === 'Cosmos') {
        // Simple check for Stargaze address
        if (address.startsWith('stars')) {
            return fetchStargazeNFTs(address)
        }
        // Could add others later (Omniflix, etc)
        return []
    }

    if (chain === 'Solana') {
        return fetchSolanaNFTs(address)
    }

    if (chain === 'EVM') {
        return fetchEVMNFTs(address, chainId)
    }

    return []
}
