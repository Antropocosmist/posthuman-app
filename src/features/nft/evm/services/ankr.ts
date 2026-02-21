import { AnkrProvider } from '@ankr.com/ankr.js'
import type { NFT } from '../../types/types'

const ANKR_API_URL = import.meta.env.VITE_ANKR_API_URL || 'https://rpc.ankr.com/multichain'
const ANKR_API_KEY = import.meta.env.VITE_ANKR_API_KEY || ''
// The provider needs the full URL including the API key if it's the premium endpoint
const providerUrl = ANKR_API_KEY ? `${ANKR_API_URL}/${ANKR_API_KEY}` : ANKR_API_URL

export class AnkrNFTService {
    private provider: AnkrProvider

    constructor() {
        this.provider = new AnkrProvider(providerUrl)
    }

    async fetchUserEVMNFTs(address: string): Promise<NFT[]> {
        if (!ANKR_API_KEY) {
            console.warn('[Ankr] VITE_ANKR_API_KEY is missing. Ankr Advanced API requires an API key to fetch NFTs. Set it in your .env file.')
            return []
        }

        try {
            console.log(`[Ankr] Fetching multi-chain EVM NFTs for ${address}...`)
            const { assets } = await this.provider.getNFTsByOwner({
                walletAddress: address,
                blockchain: ['eth', 'polygon', 'bsc', 'base', 'arbitrum', 'optimism']
            })

            console.log(`[Ankr] Found ${assets.length} EVM NFTs`)

            return assets.map(asset => {
                // map ankr blockchain string to our chain enum
                let chain: NFT['chain'] = 'ethereum'
                if (asset.blockchain === 'eth') chain = 'ethereum'
                else if (asset.blockchain === 'polygon') chain = 'polygon'
                else if (asset.blockchain === 'bsc') chain = 'bsc'
                else if (asset.blockchain === 'base') chain = 'base'
                else if (asset.blockchain === 'arbitrum') chain = 'arbitrum'
                else if (asset.blockchain === 'optimism') chain = 'optimism'

                return {
                    id: `${chain}-${asset.contractAddress}-${asset.tokenId}`,
                    tokenId: asset.tokenId,
                    contractAddress: asset.contractAddress,
                    chain,
                    name: asset.name || `${asset.symbol || 'NFT'} #${asset.tokenId}`,
                    description: '',
                    image: asset.imageUrl || '',
                    externalUrl: asset.tokenUrl || '',
                    collection: {
                        id: asset.contractAddress,
                        name: asset.collectionName || asset.symbol || 'Unknown Collection',
                    },
                    owner: address,
                    isListed: false
                }
            })
        } catch (error) {
            console.error('[Ankr] Failed to fetch NFTs:', error)
            return []
        }
    }
}

export const ankrService = new AnkrNFTService()
