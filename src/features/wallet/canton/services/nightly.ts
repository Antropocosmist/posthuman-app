/**
 * Nightly Wallet Provider — Canton Network
 * Dependencies: none (uses window.nightly browser extension API)
 *
 * Handles:
 *   - connect(): Canton connection via window.nightly.canton
 *   - sendTransaction(): Canton transfer via Nightly signMessage
 *   - refreshBalance(): Canton balance via getHoldingUtxos
 */

import type { ConnectedWallet } from '../../types/wallet.types'

const BASE_URL = import.meta.env.BASE_URL

export const NightlyService = {

    // ----------------------------------------------------------------
    // connect() — Canton via window.nightly.canton
    // ----------------------------------------------------------------
    async connect(): Promise<ConnectedWallet[]> {
        const nightly = window.nightly?.canton
        if (!nightly) {
            alert('Nightly Wallet extension not detected! Please install it from https://nightly.app')
            return []
        }

        try {
            const account = await nightly.connect()
            if (account) {
                return [{
                    id: `nightly-${account.partyId.substring(account.partyId.length - 4)}`,
                    name: 'Nightly Wallet',
                    chain: 'Canton',
                    address: account.partyId,
                    icon: `${BASE_URL}icons/nightly.png`,
                    balance: 0,
                    nativeBalance: 0,
                    symbol: 'CC',
                    walletProvider: 'Nightly Wallet'
                }]
            }
        } catch (e: any) {
            console.error('[Nightly] connection exception:', e)
            alert(`Nightly Wallet error: ${e.message || e}`)
        }

        return []
    },

    // ----------------------------------------------------------------
    // sendTransaction() — Canton transfer via Nightly signMessage
    // ----------------------------------------------------------------
    async sendTransaction(wallet: ConnectedWallet, recipient: string, amount: string, memo?: string, expirationDate?: string): Promise<string> {
        const nightly = window.nightly?.canton
        if (!nightly) throw new Error('Nightly Wallet not found')

        const expirationMs = expirationDate ? parseInt(expirationDate) : 604800000
        const expireDateISO = new Date(Date.now() + expirationMs).toISOString()

        const transferRequest = {
            from: wallet.address,
            to: recipient,
            token: 'CC',
            amount,
            expireDate: expireDateISO,
            memo: memo || ''
        }

        const txMessage = JSON.stringify(transferRequest)

        return new Promise((resolve, reject) => {
            nightly.signMessage(txMessage, (response: any) => {
                if (response?.signature) {
                    resolve(response.signature)
                } else if (response?.error) {
                    reject(new Error(response.error))
                } else {
                    reject(new Error('Transaction signing failed'))
                }
            })
        })
    },

    // ----------------------------------------------------------------
    // refreshBalance() — Canton balance via getHoldingUtxos
    // ----------------------------------------------------------------
    async refreshBalance(): Promise<number> {
        const nightly = window.nightly?.canton
        if (!nightly) return 0

        try {
            const utxos = await nightly.getHoldingUtxos()
            if (!utxos || !Array.isArray(utxos)) return 0

            let totalBalance = 0
            for (const utxo of utxos) {
                const rawAmount = (utxo as any).amount || (utxo as any).value || (utxo as any).balance || 0
                let amount = 0
                if (typeof rawAmount === 'number') {
                    amount = rawAmount
                } else if (typeof rawAmount === 'string') {
                    if (rawAmount.match(/^[0-9a-fA-F]+$/)) {
                        amount = parseInt(rawAmount, 16)
                    } else {
                        amount = parseFloat(rawAmount) || 0
                    }
                }
                totalBalance += amount
            }

            return totalBalance / Math.pow(10, 10)
        } catch (e: any) {
            console.error('[Nightly] Balance fetch failed:', e)
            return 0
        }
    }
}
