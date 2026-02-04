import type { ChainType } from '../../wallet/store/walletStore'

export interface NFT {
    id: string
    name: string
    image: string
    collectionName?: string
    description?: string
    contractAddress?: string
}

// ------------------------------------------------------------------
// Stargaze (Cosmos) - GraphQL
// ------------------------------------------------------------------
const STARGAZE_GRAPHQL = 'https://graphql.mainnet.stargaze-apis.com/graphql'

const formatIpfsUrl = (url: string): string => {
    if (!url) return ''

    // Handle ipfs:// protocol
    if (url.startsWith('ipfs://')) {
        return url.replace('ipfs://', 'https://ipfs.io/ipfs/')
    }

    // Handle Stargaze Gateway (Restricted/403) -> Switch to Public Gateway
    if (url.includes('ipfs-gw.stargaze-apis.com')) {
        return url.replace('ipfs-gw.stargaze-apis.com', 'ipfs.io')
    }

    return url
}

const fetchStargazeNFTs = async (address: string, offset: number = 0): Promise<NFT[]> => {
    // Correct Query: 'owner' argument + Nested 'tokens' selection + OFFSET
    const query = `
    query OwnedTokens($owner: String!, $offset: Int!) {
      tokens(owner: $owner, limit: 100, offset: $offset) {
        tokens {
          tokenId
          name
          description
          media {
            url
          }
          collection {
            name
            contractAddress
          }
        }
      }
    }
  `

    try {
        console.log(`[Stargaze] Fetching NFTs for ${address} (offset: ${offset})...`)
        const res = await fetch(STARGAZE_GRAPHQL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                query,
                variables: { owner: address, offset }
            })
        })

        const json = await res.json()

        if (json.errors) {
            console.error('[Stargaze] GraphQL Errors:', json.errors)
            return []
        }

        // Handle nested structure: data.tokens.tokens
        const items = json.data?.tokens?.tokens || []
        console.log(`[Stargaze] Found ${items.length} tokens`)

        // DEBUG: Find specific missing NFT
        const missing = items.find((t: any) => t.tokenId === '905' || t.name?.includes('#905'))
        if (missing) {
            console.log('[Debug 905] FOUND RAW TOKEN:', JSON.stringify(missing, null, 2))
            console.log('[Debug 905] Processed Image URL:', formatIpfsUrl(missing.media?.url))
        } else {
            // Only log this if we actually expected it to be in this batch (difficult to know without total count, but helpful context)
            console.log('[Debug 905] Token not found in this batch')
        }

        return items.map((t: any) => ({
            id: t.tokenId,
            name: t.name || `Stargaze #${t.tokenId}`,
            image: formatIpfsUrl(t.media?.url),
            collectionName: t.collection?.name,
            contractAddress: t.collection?.contractAddress,
            description: t.description
        }))
    } catch (e) {
        console.error('[Stargaze] Fetch Failed:', e)
        return []
    }
}

// ------------------------------------------------------------------
// Solana - DAS API (Placeholder / Configurable)
// ------------------------------------------------------------------
const fetchSolanaNFTs = async (): Promise<NFT[]> => {
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
const fetchEVMNFTs = async (): Promise<NFT[]> => {
    // Needs an Indexer API Key
    console.warn("EVM NFT fetching requires an Indexer API Key (SimpleHash/Alchemy).")
    return []
}

// ------------------------------------------------------------------
// Main Service
// ------------------------------------------------------------------
export const fetchNFTs = async (address: string, chain: ChainType, _chainId?: string, offset: number = 0): Promise<NFT[]> => {
    if (chain === 'Cosmos') {
        // Simple check for Stargaze address
        if (address.startsWith('stars')) {
            return fetchStargazeNFTs(address, offset)
        }
        // Could add others later (Omniflix, etc)
        return []
    }

    if (chain === 'Solana') {
        return fetchSolanaNFTs()
    }

    if (chain === 'EVM') {
        return fetchEVMNFTs()
    }

    return []
}
