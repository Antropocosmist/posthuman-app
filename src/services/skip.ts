const SKIP_API_URL = 'https://api.skip.build'

export interface SkipChain {
    chain_id: string
    chain_name: string
    chain_type: 'cosmos' | 'evm' | 'svm'
    pretty_name: string
    logo_uri?: string
}

export interface SkipAsset {
    denom: string
    chain_id: string
    symbol: string
    name: string
    decimals: number
    logo_uri?: string
}

export interface SkipRouteRequest {
    amount_in: string
    source_asset_denom: string
    source_asset_chain_id: string
    dest_asset_denom: string
    dest_asset_chain_id: string
    allow_multi_tx?: boolean
}

export const SkipService = {
    getChains: async (): Promise<SkipChain[]> => {
        try {
            const resp = await fetch(`${SKIP_API_URL}/v1/info/chains`)
            const data = await resp.json()
            return data.chains
        } catch (error) {
            console.error('Error fetching Skip chains:', error)
            return []
        }
    },

    getAssets: async (options?: { chainId?: string, nativeOnly?: boolean, includeEvm?: boolean, includeCw20?: boolean }): Promise<SkipAsset[]> => {
        try {
            const params = new URLSearchParams()
            if (options?.chainId) params.append('chain_ids', options.chainId)
            if (options?.nativeOnly) params.append('native_only', 'true')
            if (options?.includeEvm) params.append('include_evm_assets', 'true')
            if (options?.includeCw20 ?? true) params.append('include_cw20_assets', 'true') // Default to true

            const url = `${SKIP_API_URL}/v2/fungible/assets?${params.toString()}`
            const resp = await fetch(url)
            const data = await resp.json()

            if (options?.chainId && data.chain_to_assets_map) {
                return data.chain_to_assets_map[options.chainId]?.assets || []
            }

            // If no chainId, flatten all (expensive but fallback)
            const allAssets: SkipAsset[] = []
            if (data.chain_to_assets_map) {
                Object.values(data.chain_to_assets_map).forEach((entry: any) => {
                    allAssets.push(...(entry.assets || []))
                })
            }
            return allAssets
        } catch (error) {
            console.error('Error fetching Skip assets:', error)
            return []
        }
    },

    getRoute: async (req: SkipRouteRequest) => {
        try {
            const resp = await fetch(`${SKIP_API_URL}/v2/fungible/route`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(req)
            })
            return await resp.json()
        } catch (error) {
            console.error('Error fetching Skip route:', error)
            return null
        }
    },

    getMessages: async (route: any, addressList: string[]) => {
        try {
            const resp = await fetch(`${SKIP_API_URL}/v2/fungible/msgs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    source_asset_denom: route.source_asset_denom,
                    source_asset_chain_id: route.source_asset_chain_id,
                    dest_asset_denom: route.dest_asset_denom,
                    dest_asset_chain_id: route.dest_asset_chain_id,
                    amount_in: route.amount_in,
                    amount_out: route.amount_out || route.estimated_amount_out,
                    address_list: addressList,
                    operations: route.operations,
                    slippage_tolerance_percent: "1"
                })
            })
            return await resp.json()
        } catch (error) {
            console.error('Error fetching Skip messages:', error)
            return null
        }
    }
}
