/**
 * Wallet Feature — Shared Types & Constants
 * Dependencies: none (pure TypeScript types)
 */

export type ChainType = 'EVM' | 'Cosmos' | 'Solana' | 'Gno' | 'Canton'

export interface Trade {
    id: string
    timestamp: number
    sourceAsset: { symbol: string, logo: string, amount: string, chainId: string }
    destAsset: { symbol: string, logo: string, amount: string, chainId: string }
    usdValue: number
    status: 'completed' | 'failed'
    txHash?: string
    user_id?: string
}

export interface ConnectedWallet {
    id: string
    name: string // e.g., "MetaMask", "Keplr"
    chain: ChainType
    address: string
    icon: string
    balance: number // USD value
    nativeBalance: number
    symbol: string
    chainId?: string // For EVM: e.g. "0x1", "0x2105"
    walletProvider: string // e.g., "Keplr", "MetaMask", "Rabby", "Phantom"
}

export const EVM_CHAINS = [
    { id: '0x1', rpc: 'ETHEREUM' as const, name: 'Ethereum', symbol: 'ETH' },
    { id: '0x2105', rpc: 'BASE' as const, name: 'Base', symbol: 'ETH' },
    { id: '0x89', rpc: 'POLYGON' as const, name: 'Polygon', symbol: 'POL' },
    { id: '0xa4b1', rpc: 'ARBITRUM' as const, name: 'Arbitrum', symbol: 'ETH' },
    { id: '0x38', rpc: 'BSC' as const, name: 'BSC', symbol: 'BNB' },
    { id: '0x64', rpc: 'GNOSIS' as const, name: 'Gnosis', symbol: 'XDAI' }
]

export const ERC20_TOKENS = [
    {
        symbol: 'USDC',
        name: 'USD Coin',
        contracts: {
            '0x1': '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            '0x2105': '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
            '0x89': '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359',
            '0xa4b1': '0xaf88d065e77c8cC2239327C5EDb3A432268e5831',
            '0x38': '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d'
        }
    },
    {
        symbol: 'USDT',
        name: 'Tether USD',
        contracts: {
            '0x1': '0xdAC17F958D2ee523a2206206994597C13D831ec7',
            '0x2105': '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2',
            '0x89': '0xc2132D05D31c914a87C6611C10748AEb04B58e8F',
            '0xa4b1': '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9',
            '0x38': '0x55d398326f99059fF775485246999027B3197955'
        }
    }
]

export const COSMOS_RPC_URLS: Record<string, string> = {
    'cosmoshub-4': 'https://cosmos-rpc.publicnode.com',
    'juno-1': 'https://juno-rpc.polkachu.com',
    'neutron-1': 'https://neutron-rpc.publicnode.com',
    'osmosis-1': 'https://osmosis-rpc.publicnode.com:443',
    'atomone-1': 'https://atomone-rpc.publicnode.com',
    'stargaze-1': 'https://stargaze-rpc.publicnode.com:443'
}
