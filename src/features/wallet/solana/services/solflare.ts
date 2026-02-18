/**
 * Solflare Wallet Provider — Solana
 * Dependencies: @solana/web3.js
 *
 * Handles:
 *   - connect(): Solana connection via window.solflare (with publicKey retry)
 *     Returns wallet immediately with 0 balance; fetches balances in background.
 *   - sendTransaction(): SOL native transfer
 */

import { RpcService } from '../../../../shared/services/rpc'
import { PriceService } from '../../../../shared/services/price'
import type { ConnectedWallet } from '../../types/wallet.types'

const BASE_URL = import.meta.env.BASE_URL

const SOLANA_TOKENS = [
    { symbol: 'USDC', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
    { symbol: 'USDT', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }
]

export const SolflareService = {

    // ----------------------------------------------------------------
    // connect() — Solana via window.solflare (with publicKey retry)
    // Returns the wallet immediately (balance = 0), then fetches
    // balances in the background and calls onBalanceUpdate when ready.
    // ----------------------------------------------------------------
    async connect(onBalanceUpdate?: (wallets: ConnectedWallet[]) => void): Promise<ConnectedWallet[]> {
        if (!window.solflare) {
            alert('Solflare not detected!')
            return []
        }

        let address = ''
        try {
            console.log('[Solflare] Starting connect...')
            await window.solflare.connect()
            console.log('[Solflare] connect() resolved, isConnected:', window.solflare.isConnected, 'publicKey:', window.solflare.publicKey)

            // publicKey may not be immediately available after connect() — wait up to 3s
            if (!window.solflare.publicKey) {
                console.log('[Solflare] publicKey not yet available, waiting...')
                await new Promise<void>((resolve, reject) => {
                    let attempts = 0
                    const interval = setInterval(() => {
                        attempts++
                        if (window.solflare?.publicKey) {
                            clearInterval(interval)
                            resolve()
                        } else if (attempts >= 30) {
                            clearInterval(interval)
                            reject(new Error('Solflare publicKey not available after 3s'))
                        }
                    }, 100)
                })
            }

            if (!window.solflare.publicKey) throw new Error('Solflare publicKey is null after connect')
            address = window.solflare.publicKey.toString()
            console.log('[Solflare] Got address:', address)
        } catch (e) {
            console.error('[Solflare] Connect Error:', e)
            return []
        }

        // Return the wallet immediately with 0 balance so the UI is not blocked
        const solWallet: ConnectedWallet = {
            id: Math.random().toString(36).substr(2, 9),
            name: 'Solflare',
            chain: 'Solana',
            address,
            icon: `${BASE_URL}icons/solflare.png`,
            balance: 0,
            nativeBalance: 0,
            symbol: 'SOL',
            walletProvider: 'Solflare'
        }

        // Fetch balances in the background and notify via callback when done
        if (onBalanceUpdate) {
            ; (async () => {
                try {
                    const prices = await PriceService.getPrices()
                    const updatedWallets: ConnectedWallet[] = []

                    let realBalance = 0
                    try {
                        realBalance = await RpcService.getBalance('SOLANA', address)
                    } catch (error) {
                        console.error('[Solflare] Failed to fetch SOL balance:', error)
                    }

                    updatedWallets.push({
                        ...solWallet,
                        balance: realBalance * (prices['SOL'] || 0),
                        nativeBalance: realBalance
                    })

                    for (const token of SOLANA_TOKENS) {
                        try {
                            const tokenBal = await RpcService.getSplBalance(address, token.mint)
                            if (tokenBal > 0) {
                                updatedWallets.push({
                                    id: `${token.symbol}-SOL-${address.substr(-4)}`,
                                    name: `${token.symbol} (Solana)`,
                                    chain: 'Solana',
                                    address,
                                    icon: `${BASE_URL}icons/solflare.png`,
                                    balance: tokenBal * (prices[token.symbol] || 1),
                                    nativeBalance: tokenBal,
                                    symbol: token.symbol,
                                    walletProvider: 'Solflare'
                                })
                            }
                        } catch (e) {
                            console.error(`[Solflare] Failed to fetch ${token.symbol}:`, e)
                        }
                    }

                    onBalanceUpdate(updatedWallets)
                } catch (e) {
                    console.error('[Solflare] Background balance fetch failed:', e)
                }
            })()
        }

        return [solWallet]
    },

    // ----------------------------------------------------------------
    // sendTransaction() — SOL native transfer via window.solflare
    // ----------------------------------------------------------------
    async sendTransaction(wallet: ConnectedWallet, recipient: string, amount: string): Promise<string> {
        const { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey, Connection } = await import('@solana/web3.js')
        const connection = new Connection('https://solana-rpc.publicnode.com')
        const fromPubkey = new PublicKey(wallet.address)

        const transaction = new Transaction().add(
            SystemProgram.transfer({
                fromPubkey,
                toPubkey: new PublicKey(recipient),
                lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
            })
        )

        const { blockhash } = await connection.getLatestBlockhash()
        transaction.recentBlockhash = blockhash
        transaction.feePayer = fromPubkey

        const provider = (window as any).solflare
        if (!provider) throw new Error('Solflare wallet not found')

        const { signature } = await provider.signAndSendTransaction(transaction)
        return signature
    }
}
