import { PublicKey, Connection, VersionedTransaction } from '@solana/web3.js'
import {
    createTransferCheckedInstruction,
    getAssociatedTokenAddress,
    createAssociatedTokenAccountInstruction,
    TOKEN_2022_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
} from '@solana/spl-token'
import type { DasResponse } from '../types/das.types'
import { isScamNFT } from '../utils/blocklist'

import type { NFT, NFTCollection, MarketplaceListing, NFTFilters, NFTServiceInterface } from '../../types/types'

// Magic Eden API configuration
const MAGICEDEN_API_KEY = import.meta.env.VITE_MAGICEDEN_API_KEY || ''
const MAGICEDEN_API_URL = 'https://api-mainnet.magiceden.dev/v2'
// Solana RPC: use env var if set, otherwise fall back to public node (no API key required)
const SOLANA_RPC_URL = import.meta.env.VITE_SOLANA_RPC_URL ||
    (import.meta.env.VITE_HELIUS_API_KEY
        ? `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_API_KEY}`
        : 'https://solana-rpc.publicnode.com')

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
    async getCollectionStats(contractAddress: string): Promise<NFTCollection> {
        // TODO: Implement Magic Eden collection stats fetch
        // For Solana, contractAddress is usually the update authority or collection symbol
        return {
            id: contractAddress,
            name: 'Solana Collection',
            floorPrice: '0',
        }
    }

    async transferNFT(nft: NFT, recipientAddress: string, senderAddress: string, walletProvider?: any): Promise<string> {
        try {
            console.log(`[Solana] Initializing transfer for NFT ${nft.tokenId} to ${recipientAddress}`)
            console.log(`[Solana] Sender: ${senderAddress}, ProviderType: ${walletProvider}`)

            // 1. Setup Connection & Keys
            const connection = new Connection(SOLANA_RPC_URL, 'confirmed')
            const senderPublicKey = new PublicKey(senderAddress)
            const recipientPublicKey = new PublicKey(recipientAddress)
            const mintPublicKey = new PublicKey(nft.contractAddress) // Contract address is Mint address on Solana

            // 2. Determine Program ID (Standard vs Token-2022)
            // We need to check account info of the mint to see its owner program
            const mintAccountInfo = await connection.getAccountInfo(mintPublicKey)
            if (!mintAccountInfo) throw new Error('Mint account not found on chain')

            const tokenProgramId = mintAccountInfo.owner
            const isToken2022 = tokenProgramId.equals(TOKEN_2022_PROGRAM_ID)

            console.log(`[Solana] Detected Token Program: ${isToken2022 ? 'Token-2022' : 'Standard Token Program'}`)

            // 3. Get Associated Token Addresses (ATA)
            // For Token-2022, we must explicitly pass the program ID
            const senderATA = await getAssociatedTokenAddress(
                mintPublicKey,
                senderPublicKey,
                false,
                tokenProgramId,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )

            const recipientATA = await getAssociatedTokenAddress(
                mintPublicKey,
                recipientPublicKey,
                false,
                tokenProgramId,
                ASSOCIATED_TOKEN_PROGRAM_ID
            )

            console.log(`[Solana] Sender ATA: ${senderATA.toBase58()}`)
            console.log(`[Solana] Recipient ATA: ${recipientATA.toBase58()}`)

            // 4. Build Transaction Instructions
            // We use VersionedTransaction for better compatibility (though legacy tx works too)
            // But first, let's collect instructions
            const instructions = []

            // Check if recipient ATA exists
            const recipientATAInfo = await connection.getAccountInfo(recipientATA)
            if (!recipientATAInfo) {
                console.log('[Solana] Recipient ATA does not exist. Adding create instruction.')
                instructions.push(
                    createAssociatedTokenAccountInstruction(
                        senderPublicKey, // Payer
                        recipientATA,
                        recipientPublicKey, // Owner
                        mintPublicKey,
                        tokenProgramId,
                        ASSOCIATED_TOKEN_PROGRAM_ID
                    )
                )
            }

            // Add Transfer Instruction
            // NFTs have decimals = 0, amount = 1
            instructions.push(
                createTransferCheckedInstruction(
                    senderATA, // Source
                    mintPublicKey, // Mint
                    recipientATA, // Destination
                    senderPublicKey, // Owner
                    1, // Amount
                    0, // Decimals
                    [], // Multi-signers
                    tokenProgramId
                )
            )

            // 5. Create & Send Transaction using the Provider
            // We need the 'walletProvider' object which should be the window.solana or window.phantom.solana object
            // If passed as string 'Phantom', 'Solflare', we need to find it in window

            // In posthuman-app, the walletStore passes the raw provider as 'walletProvider' property if available?
            // Actually, looking at Types, 'walletProvider' is a string. 
            // We need to find the actual provider object from window.

            let provider = null
            if (typeof window !== 'undefined') {
                if ('phantom' in window && (window as any).phantom?.solana?.isPhantom) {
                    // Prefer Phantom if connected
                    if (walletProvider === 'Phantom' || !walletProvider) provider = (window as any).phantom.solana;
                }

                if (!provider && 'solflare' in window && (window as any).solflare?.isSolflare) {
                    if (walletProvider === 'Solflare' || !walletProvider) provider = (window as any).solflare;
                }

                // Fallback to standard window.solana
                if (!provider && 'solana' in window) {
                    provider = (window as any).solana;
                }
            }

            if (!provider) throw new Error('Solana wallet provider not found')

            // Fetch latest blockhash
            const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash()

            // Construct Transaction
            // Using legacy Transaction because it's easier to ensure compatibility with all adapters 
            // for simple transfers without lookuptables
            const { Transaction } = await import('@solana/web3.js')
            const transaction = new Transaction({
                feePayer: senderPublicKey,
                blockhash,
                lastValidBlockHeight
            }).add(...instructions)

            // Sign and Send
            // Most adapters support 'signAndSendTransaction'
            const { signature } = await provider.signAndSendTransaction(transaction)

            console.log('[Solana] Transfer successful. Signature:', signature)

            // Wait for confirmation (optional but good UI UX)
            await connection.confirmTransaction({
                signature,
                blockhash,
                lastValidBlockHeight
            }, 'confirmed')

            return signature

        } catch (error) {
            console.error('[Solana] Transfer failed:', error)
            throw error
        }
    }

    /**
     * Fetch all NFTs owned by a specific address using Solana DAS API (Helius/QuickNode)
     * This ensures full coverage of Standard, pNFT, cNFT, and Token-2022.
     */
    async fetchUserNFTs(address: string): Promise<NFT[]> {
        try {
            // Validate Solana address
            new PublicKey(address) // Throws if invalid

            console.log('[Solana NFTs] Fetching via DAS API for:', address)

            const nfts: NFT[] = []
            let page = 1
            const limit = 1000 // DAS API max limit is usually 1000

            while (true) {
                const response = await fetch(SOLANA_RPC_URL, {
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
                            page: page,
                            limit: limit,
                            displayOptions: {
                                showFungible: false,
                                showNativeBalance: false,
                            },
                        },
                    }),
                })

                if (!response.ok) {
                    throw new Error(`RPC error: ${response.status} ${response.statusText}`)
                }

                const data: DasResponse = await response.json()

                // DAS API returns items in result.items
                const items = data.result?.items || []

                if (items.length === 0) break

                console.log(`[Solana NFTs] Page ${page}: Found ${items.length} assets`)

                for (const asset of items) {
                    // Map DasAsset to NFT
                    const nft: NFT = {
                        id: asset.id,
                        tokenId: asset.id,
                        contractAddress: asset.id, // Mint address
                        chain: 'solana',
                        name: asset.content.metadata.name || asset.content.metadata.symbol || 'Unknown NFT',
                        description: asset.content.metadata.description || '',
                        image: asset.content.links?.image || asset.content.files?.[0]?.uri || '',
                        collection: {
                            id: '',
                            name: 'Solana NFTs',
                        },
                        owner: address,
                        marketplace: 'magiceden',
                        isListed: false, // DAS doesn't explicitly give listing status usually, depends on ownership model
                        traits: asset.content.metadata.attributes?.map(attr => ({
                            trait_type: attr.trait_type,
                            value: attr.value,
                        })) || [],
                    }

                    // Resolving collection info from grouping
                    const collectionGroup = asset.grouping?.find(g => g.group_key === 'collection')
                    if (collectionGroup) {
                        nft.collection.id = collectionGroup.group_value
                        // We might not have the collection name here immediately unless we fetch it or it's in metadata
                        // DAS doesn't always populate collection name in grouping
                    }

                    // Use isScamNFT filter
                    if (!isScamNFT(nft)) {
                        nfts.push(nft)
                    }
                }

                // If less than limit, we're done
                if (items.length < limit) break

                // Next page
                page++
            }

            console.log(`[Solana NFTs] Total Valid NFTs loaded: ${nfts.length}`)
            return nfts

        } catch (error) {
            console.error('[Solana NFTs] Error fetching NFTs via DAS:', error)
            return []
        }
    }

    /**
     * Fetch marketplace listings with optional filters
     */
    async fetchMarketplaceListings(filters?: NFTFilters): Promise<MarketplaceListing[]> {
        try {
            let endpoint = `${MAGICEDEN_API_URL}/marketplace/popular_collections`

            // If seller is specified, fetch listings for that wallet
            if (filters?.seller) {
                // Magic Eden v2 doesn't have a direct "listings by wallet" endpoint in the public API 
                // that returns the exact same format as marketplace listings easily.
                // However, 'tokens' endpoint with listStatus=listed is a good proxy.
                endpoint = `${MAGICEDEN_API_URL}/wallets/${filters.seller}/tokens?listStatus=listed&limit=20`
            } else if (filters?.collection) {
                endpoint = `${MAGICEDEN_API_URL}/collections/${filters.collection}/listings`
            }

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
                seller: listing.seller || listing.owner || listing.ownerAddress || filters?.seller || '', // Owner matches seller for listed items
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
    async listNFT(nft: NFT, price: string, _currency: string, sellerAddress: string, _durationInSeconds?: number): Promise<string> {
        try {
            // Check if Phantom wallet is available
            if (!window.solana || !window.solana.isPhantom) {
                throw new Error('Please install Phantom wallet to list NFTs on Magic Eden')
            }

            // Connect to Phantom wallet
            const phantom = window.solana
            await phantom.connect()

            // Verify seller address - CASE INSENSITIVE CHECK
            const walletPublicKey = phantom.publicKey.toString()
            if (walletPublicKey.toLowerCase() !== sellerAddress.toLowerCase()) {
                console.error(`[MagicEden] Wallet mismatch: Connected ${walletPublicKey} vs Seller ${sellerAddress}`)
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
