/**
 * Canton RPC Service
 * Provides wallet-agnostic balance querying for Canton Network
 */

export class CantonRpcService {
    // Canton Network API endpoints
    private static readonly MAINNET_API = 'https://sync.global/api/scan/v0'
    private static readonly TESTNET_API = 'https://sync.global/api/scan/v0' // Update if different

    /**
     * Get balance for a Canton party ID
     * @param partyId - The Canton party ID (wallet address)
     * @param network - Network to query (mainnet or testnet)
     * @returns Balance in CC tokens
     */
    static async getBalance(partyId: string, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<number> {
        const apiUrl = network === 'mainnet' ? this.MAINNET_API : this.TESTNET_API

        try {
            // Use the holdings/summary endpoint
            const response = await fetch(`${apiUrl}/holdings/summary?party=${encodeURIComponent(partyId)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            })

            if (!response.ok) {
                console.error(`Canton balance API error: ${response.status} ${response.statusText}`)
                return 0
            }

            const data = await response.json()
            console.log('Canton holdings response:', data)

            // Parse the response to extract CC balance
            // The exact structure depends on the API response format
            if (data && data.holdings) {
                const ccHolding = data.holdings.find((h: any) => h.symbol === 'CC' || h.token === 'CC')
                if (ccHolding) {
                    return parseFloat(ccHolding.balance || ccHolding.amount || '0')
                }
            }

            // If no CC holding found, return 0
            return 0
        } catch (e) {
            console.error('Canton RPC balance query failed:', e)
            return 0
        }
    }

    /**
     * Get all token holdings for a Canton party ID
     * @param partyId - The Canton party ID (wallet address)
     * @param network - Network to query (mainnet or testnet)
     * @returns Array of token holdings
     */
    static async getAllHoldings(partyId: string, network: 'mainnet' | 'testnet' = 'mainnet'): Promise<any[]> {
        const apiUrl = network === 'mainnet' ? this.MAINNET_API : this.TESTNET_API

        try {
            const response = await fetch(`${apiUrl}/holdings/summary?party=${encodeURIComponent(partyId)}`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                }
            })

            if (!response.ok) {
                console.error(`Canton holdings API error: ${response.status} ${response.statusText}`)
                return []
            }

            const data = await response.json()
            return data.holdings || []
        } catch (e) {
            console.error('Canton RPC holdings query failed:', e)
            return []
        }
    }
}
