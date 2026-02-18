/**
 * Phantom Wallet Provider — Solana
 * Dependencies: @solana/web3.js
 *
 * Handles:
 *   - connect(): Solana connection via window.phantom.solana
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

export const PhantomService = {

    // ----------------------------------------------------------------
    // connect() — Solana via window.phantom.solana
    // ----------------------------------------------------------------
    async connect(): Promise<ConnectedWallet[]> {
        const phantomProvider = (window as any).phantom?.solana
        if (!phantomProvider) {
            alert('Phantom not detected! Check window.phantom.solana')
            return []
        }

        let address = ''
        try {
            const resp = await phantomProvider.connect()
            address = resp.publicKey.toString()
        } catch (e) {
            console.error('[Phantom] Connect Error:', e)
            return []
        }

        const prices = await PriceService.getPrices()
        const wallets: ConnectedWallet[] = []

        let realBalance = 0
        try {
            realBalance = await RpcService.getBalance('SOLANA', address)
        } catch (error) {
            console.error('[Phantom] Failed to fetch SOL balance:', error)
        }

        wallets.push({
            id: Math.random().toString(36).substr(2, 9),
            name: 'Phantom',
            chain: 'Solana',
            address,
            icon: `${BASE_URL}icons/phantom.png`,
            balance: realBalance * (prices['SOL'] || 0),
            nativeBalance: realBalance,
            symbol: 'SOL',
            walletProvider: 'Phantom'
        })

        for (const token of SOLANA_TOKENS) {
            try {
                const tokenBal = await RpcService.getSplBalance(address, token.mint)
                if (tokenBal > 0) {
                    wallets.push({
                        id: `${token.symbol}-SOL-${address.substr(-4)}`,
                        name: `${token.symbol} (Solana)`,
                        chain: 'Solana',
                        address,
                        icon: `${BASE_URL}icons/phantom.png`,
                        balance: tokenBal * (prices[token.symbol] || 1),
                        nativeBalance: tokenBal,
                        symbol: token.symbol,
                        walletProvider: 'Phantom'
                    })
                }
            } catch (e) {
                console.error(`[Phantom] Failed to fetch ${token.symbol}:`, e)
            }
        }

        return wallets
    },

    // ----------------------------------------------------------------
    // sendTransaction() — SOL native transfer
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

        const provider = (window as any).phantom?.solana || (window as any).solana
        if (!provider) throw new Error('Phantom wallet not found')

        const { signature } = await provider.signAndSendTransaction(transaction)
        return signature
    }
}
