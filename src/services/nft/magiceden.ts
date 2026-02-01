import { PublicKey, Connection, VersionedTransaction } from '@solana/web3.js'
import type { NFT, NFTCollection, MarketplaceListing, NFTFilters, NFTServiceInterface } from './types'

// Magic Eden API configuration
const MAGICEDEN_API_KEY = import.meta.env.VITE_MAGICEDEN_API_KEY || ''
const MAGICEDEN_API_URL = 'https://api-mainnet.magiceden.dev/v2'
// Use a free public RPC that allows browser requests
// Official RPC blocks browser requests with 403
const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL || 'https://solana-mainnet.g.alchemy.com/v2/demo'

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
     * Fetch all NFTs owned by a specific address using direct Solana RPC
     * This method uses getParsedTokenAccountsByOwner which works with any public RPC
     * No special API keys required!
     */
    async fetchUserNFTs(address: string): Promise<NFT[]> {
        try {
            // Validate Solana address
            const ownerPubkey = new PublicKey(address)

            console.log('[Solana NFTs] Fetching NFTs for:', address)

            // Use public Solana RPC
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed')

            // Get all token accounts owned by this address
            // Filter for NFTs: amount = 1, decimals = 0
            const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA')

            const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
                ownerPubkey,
                { programId: TOKEN_PROGRAM_ID }
            )

            console.log('[Solana NFTs] Found', tokenAccounts.value.length, 'token accounts')

            // Filter for NFTs (amount = 1, decimals = 0)
            const nftAccounts = tokenAccounts.value.filter(account => {
                const tokenAmount = account.account.data.parsed.info.tokenAmount
                return tokenAmount.uiAmount === 1 && tokenAmount.decimals === 0
            })

            console.log('[Solana NFTs] Found', nftAccounts.length, 'NFT accounts')

            // Fetch metadata for each NFT
            const nfts: NFT[] = []

            for (const account of nftAccounts.slice(0, 100)) { // Limit to 100 for performance
                try {
                    const mintAddress = account.account.data.parsed.info.mint

                    // Try to fetch metadata from Metaplex
                    // Metadata PDA is derived from mint address
                    const METADATA_PROGRAM_ID = new PublicKey('metaqbxxUerdq28cj1RbAWkYQm3ybzjb6a8bt518x1s')
                    const [metadataPDA] = PublicKey.findProgramAddressSync(
                        [
                            Buffer.from('metadata'),
                            METADATA_PROGRAM_ID.toBuffer(),
                            new PublicKey(mintAddress).toBuffer(),
                        ],
                        METADATA_PROGRAM_ID
                    )

                    const metadataAccount = await connection.getAccountInfo(metadataPDA)

                    let name = `NFT ${mintAddress.slice(0, 8)}...`
                    let image = ''
                    let collectionName = 'Solana NFTs'

                    if (metadataAccount) {
                        // Parse basic metadata (simplified - full parsing would require borsh)
                        // For now, just show the mint address
                        name = `Solana NFT`
                    }

                    nfts.push({
                        id: mintAddress,
                        tokenId: mintAddress,
                        contractAddress: mintAddress,
                        chain: 'solana' as const,
                        name,
                        description: `Mint: ${mintAddress}`,
                        image,
                        collection: {
                            id: '',
                            name: collectionName,
                        },
                        owner: address,
                        marketplace: 'magiceden',
                        isListed: false,
                        traits: [],
                    })
                } catch (error) {
                    console.warn('[Solana NFTs] Error fetching metadata for NFT:', error)
                }
            }

            console.log('[Solana NFTs] Successfully loaded', nfts.length, 'NFTs')
            return nfts
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
