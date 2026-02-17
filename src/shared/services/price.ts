// CoinGecko API IDs
const COIN_IDS = {
    ETH: 'ethereum',
    SOL: 'solana',
    ATOM: 'cosmos',
    JUNO: 'juno-network',
    NTRN: 'neutron-3', // Verifying if 'neutron' works, typical id
    OSMO: 'osmosis',
    PHMN: 'posthuman',
    USDC: 'usd-coin',
    CC: 'canton' // Canton Network token
}

export const PriceService = {
    // Cache to prevent hitting rate limits
    _cache: {} as Record<string, number>,
    _lastFetch: 0,
    CACHE_DURATION: 60000, // 1 minute

    getPrices: async (): Promise<Record<string, number>> => {
        const now = Date.now()
        // Return cached if fresh
        if (now - PriceService._lastFetch < PriceService.CACHE_DURATION && Object.keys(PriceService._cache).length > 0) {
            return PriceService._cache
        }

        try {
            const ids = Object.values(COIN_IDS).join(',')
            const response = await fetch(`https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd`)

            if (!response.ok) throw new Error('Price fetch failed')

            const data = await response.json()

            const prices: Record<string, number> = {
                ETH: data[COIN_IDS.ETH]?.usd || 0,
                SOL: data[COIN_IDS.SOL]?.usd || 0,
                ATOM: data[COIN_IDS.ATOM]?.usd || 0,
                JUNO: data[COIN_IDS.JUNO]?.usd || 0,
                NTRN: data[COIN_IDS.NTRN]?.usd || 0,
                OSMO: data[COIN_IDS.OSMO]?.usd || 0,
                PHMN: data[COIN_IDS.PHMN]?.usd || 0,
                CC: data[COIN_IDS.CC]?.usd || 0,
            }

            PriceService._cache = prices
            PriceService._lastFetch = now
            return prices

        } catch (error) {
            console.error("PriceService Error:", error)
            // Fallback to cache if available, else 0
            return PriceService._cache
        }
    }
}
