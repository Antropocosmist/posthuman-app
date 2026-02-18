/**
 * Console Wallet Provider — Canton Network
 * Dependencies: @console-wallet/dapp-sdk
 *
 * Handles:
 *   - connect(): Canton connection via Console Wallet SDK
 *   - sendTransaction(): Canton CC/CBTC/USDCx transfer
 *   - refreshBalance(): Canton balance via SDK
 */

import { consoleWallet } from '@console-wallet/dapp-sdk'
import type { CoinEnum } from '@console-wallet/dapp-sdk'
import type { ConnectedWallet } from '../../types/wallet.types'

const BASE_URL = import.meta.env.BASE_URL

export const ConsoleWalletService = {

    // ----------------------------------------------------------------
    // connect() — Canton via Console Wallet SDK
    // ----------------------------------------------------------------
    async connect(): Promise<ConnectedWallet[]> {
        try {
            const isAvailable = await consoleWallet.checkExtensionAvailability()
            if (!isAvailable) {
                alert('Console Wallet extension not detected! Please install it.')
                return []
            }

            await consoleWallet.connect({ name: 'POSTHUMAN App' })
            const account = await consoleWallet.getPrimaryAccount()

            if (account) {
                return [{
                    id: `console-${account.partyId.substr(-4)}`,
                    name: 'Console Wallet',
                    chain: 'Canton',
                    address: account.partyId,
                    icon: `${BASE_URL}icons/console.png`,
                    balance: 0,
                    nativeBalance: 0,
                    symbol: 'CC',
                    walletProvider: 'Console Wallet'
                }]
            }
        } catch (e: any) {
            console.error('[Console Wallet] connection exception:', e)
            alert(`Console Wallet error: ${e.message || e}`)
        }

        return []
    },

    // ----------------------------------------------------------------
    // sendTransaction() — Canton CC/CBTC/USDCx transfer
    // ----------------------------------------------------------------
    async sendTransaction(wallet: ConnectedWallet, recipient: string, amount: string, memo?: string, expirationDate?: string): Promise<string> {
        const expirationMs = expirationDate ? parseInt(expirationDate) : 604800000
        const expireDateISO = new Date(Date.now() + expirationMs).toISOString()

        let token: CoinEnum = 'CC' as CoinEnum
        if (wallet.symbol === 'CBTC') token = 'CBTC' as CoinEnum
        else if (wallet.symbol === 'USDCx') token = 'USDCx' as CoinEnum

        const transferRequest = {
            from: wallet.address,
            to: recipient,
            token,
            amount,
            expireDate: expireDateISO,
            memo: memo || ''
        }

        const response = await consoleWallet.submitCommands(transferRequest)
        if (response && response.status) {
            return response.signature || 'Canton transfer submitted'
        }
        throw new Error('Canton transfer failed')
    },

    // ----------------------------------------------------------------
    // refreshBalance() — Canton CC balance via SDK
    // ----------------------------------------------------------------
    async refreshBalance(address: string): Promise<number> {
        try {
            const isAvailable = await consoleWallet.checkExtensionAvailability()
            if (!isAvailable) return 0

            const account = await consoleWallet.getPrimaryAccount()
            if (!account || account.partyId !== address) return 0

            let balanceResponse
            try {
                balanceResponse = await consoleWallet.getCoinsBalance({
                    party: address,
                    network: 'CANTON_NETWORK' as any
                })
            } catch {
                const activeNetwork = await consoleWallet.getActiveNetwork()
                const networkId = activeNetwork?.id || 'CANTON_NETWORK'
                balanceResponse = await consoleWallet.getCoinsBalance({
                    party: address,
                    network: networkId as any
                })
            }

            if (!balanceResponse?.tokens) return 0

            const ccToken = balanceResponse.tokens.find((t: any) =>
                t.symbol === 'CC' || t.coin === 'CC' || t.name === 'Canton Coin' || t.symbol === 'CANTON'
            )

            return ccToken ? parseFloat(ccToken.balance || '0') : 0
        } catch (e: any) {
            console.error('[Console Wallet] Balance fetch failed:', e)
            return 0
        }
    }
}
