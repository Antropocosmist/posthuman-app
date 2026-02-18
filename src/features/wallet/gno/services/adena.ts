/**
 * Adena Wallet Provider — Gno.land
 * Dependencies: none (uses window.adena browser extension API)
 *
 * Handles:
 *   - connect(): Gno.land connection via window.adena
 *   - sendTransaction(): stub (Gno transfers not yet implemented)
 */

import type { ConnectedWallet } from '../../types/wallet.types'

const BASE_URL = import.meta.env.BASE_URL

export const AdenaService = {

    // ----------------------------------------------------------------
    // connect() — Gno.land via window.adena
    // ----------------------------------------------------------------
    async connect(): Promise<ConnectedWallet[]> {
        if (!window.adena) {
            alert('Adena Wallet not detected! Redirecting to install page...')
            window.open('https://adena.app/', '_blank')
            return []
        }

        try {
            console.log('[Adena] Attempting to establish connection...')
            const est = await window.adena.AddEstablish('Posthuman')
            console.log('[Adena] Establish Result:', est)

            const isSuccess = est.status === 'success' || est.code === 0
            const isAlreadyConnected =
                (est.message && est.message.toLowerCase().includes('already connected')) ||
                est.type === 'ALREADY_CONNECTED' ||
                est.code === 4001

            if (isSuccess || isAlreadyConnected) {
                const acc = await window.adena.GetAccount()
                console.log('[Adena] GetAccount Result:', acc)

                if (acc.status === 'success' || acc.code === 0) {
                    const address = acc.data.address
                    const coins = acc.data.coins

                    let nativeBal = 0
                    if (coins && coins.includes('ugnot')) {
                        nativeBal = parseInt(coins.replace('ugnot', '')) / 1000000
                    }

                    return [{
                        id: `adena-${address.substr(-4)}`,
                        name: 'Adena',
                        chain: 'Gno',
                        address,
                        icon: `${BASE_URL}icons/adena.png`,
                        balance: 0,
                        nativeBalance: nativeBal,
                        symbol: 'GNOT',
                        walletProvider: 'Adena'
                    }]
                } else {
                    console.error('[Adena] GetAccount failed:', acc)
                    alert(`Failed to get Adena account: ${acc.message || 'Unknown error'}`)
                }
            } else {
                console.error('[Adena] Establish failed:', est)
                alert(`Adena connection rejected or failed: ${est.message || 'Unknown error'}`)
            }
        } catch (e: any) {
            console.error('[Adena] connection exception:', e)
            alert(`Adena error: ${e.message || e}`)
        }

        return []
    },

    // ----------------------------------------------------------------
    // sendTransaction() — Gno transfers (not yet implemented)
    // ----------------------------------------------------------------
    async sendTransaction(_wallet: ConnectedWallet, _recipient: string, _amount: string): Promise<string> {
        throw new Error('Gno (Adena) transfers are not yet implemented')
    }
}
