/**
 * RPC Service — Multi-Chain Balance & Token Queries
 * Dependencies: ethers, @solana/web3.js, @cosmjs/stargate, @cosmjs/cosmwasm-stargate
 * Used by: wallet provider submodules, nftStore.ts
 */

import { ethers } from 'ethers'
import { Connection, PublicKey } from '@solana/web3.js'
import { StargateClient } from '@cosmjs/stargate'
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate'

// RPC Endpoints
export const RPC_URLS = {
    // EVM
    ETHEREUM: 'https://ethereum-rpc.publicnode.com',
    BASE: 'https://base-rpc.publicnode.com',
    POLYGON: 'https://polygon-bor-rpc.publicnode.com',
    ARBITRUM: 'https://arb1.arbitrum.io/rpc',
    BSC: 'https://bsc-dataseed.binance.org',
    GNOSIS: 'https://rpc.gnosischain.com',

    // Solana
    SOLANA: 'https://solana-rpc.publicnode.com',

    // Cosmos (Tendermint RPC)
    COSMOS_HUB: 'https://cosmos-rpc.publicnode.com',
    JUNO: 'https://juno-rpc.polkachu.com',
    NEUTRON: 'https://neutron-rpc.publicnode.com',
    OSMOSIS: 'https://osmosis-rpc.publicnode.com:443',
    ATOM_ONE: 'https://atomone-rpc.publicnode.com',
    STARGAZE: 'https://stargaze-rpc.publicnode.com:443'
}

export const REST_URLS = {
    NEUTRON: 'https://rest.neutron.posthuman.digital'
}

export type SupportedChain = 'ETHEREUM' | 'BASE' | 'POLYGON' | 'ARBITRUM' | 'BSC' | 'GNOSIS' | 'SOLANA' | 'COSMOS_HUB' | 'JUNO' | 'NEUTRON' | 'OSMOSIS' | 'ATOM_ONE' | 'STARGAZE'

export const RpcService = {

    // ----------------------------------------------------------------
    // Generic Balance Fetcher (Native)
    // ----------------------------------------------------------------
    getBalance: async (chain: SupportedChain, address: string): Promise<number> => {
        try {
            switch (chain) {
                case 'ETHEREUM':
                case 'BASE':
                case 'POLYGON':
                case 'ARBITRUM':
                case 'BSC':
                case 'GNOSIS':
                    return await RpcService.getEvmBalance(chain, address)
                case 'SOLANA':
                    return await RpcService.getSolanaBalance(address)
                case 'COSMOS_HUB':
                case 'JUNO':
                case 'NEUTRON':
                case 'OSMOSIS':
                case 'ATOM_ONE':
                case 'STARGAZE':
                    return await RpcService.getCosmosBalance(chain, address)
                default:
                    return 0
            }
        } catch (error) {
            console.error(`Error fetching Mock balance for ${chain}:`, error)
            return 0
        }
    },

    // ----------------------------------------------------------------
    // EVM Logic
    // ----------------------------------------------------------------
    getEvmBalance: async (chain: 'ETHEREUM' | 'BASE' | 'POLYGON' | 'ARBITRUM' | 'BSC' | 'GNOSIS', address: string) => {
        const provider = new ethers.JsonRpcProvider(RPC_URLS[chain])
        const balanceWei = await provider.getBalance(address)
        const balanceEth = ethers.formatEther(balanceWei)
        return parseFloat(balanceEth)
    },

    // ----------------------------------------------------------------
    // Solana Logic
    // ----------------------------------------------------------------
    getSolanaBalance: async (address: string) => {
        const connection = new Connection(RPC_URLS.SOLANA)
        const publicKey = new PublicKey(address)
        const balanceLamports = await connection.getBalance(publicKey)
        return balanceLamports / 1_000_000_000 // Convert to SOL
    },

    getSplBalance: async (walletAddress: string, mintAddress: string) => {
        try {
            const connection = new Connection(RPC_URLS.SOLANA)
            const wallet = new PublicKey(walletAddress)
            const mint = new PublicKey(mintAddress)

            const response = await connection.getParsedTokenAccountsByOwner(wallet, { mint })

            let totalBalance = 0
            response.value.forEach((accountInfo) => {
                const parsedInfo = accountInfo.account.data.parsed.info
                totalBalance += parsedInfo.tokenAmount.uiAmount || 0
            })

            return totalBalance
        } catch (e) {
            console.error(`Error fetching SPL balance for ${mintAddress}:`, e)
            return 0
        }
    },

    // ----------------------------------------------------------------
    // Cosmos Logic (Native & IBC)
    // ----------------------------------------------------------------
    getCosmosBalance: async (chain: 'COSMOS_HUB' | 'JUNO' | 'NEUTRON' | 'OSMOSIS' | 'ATOM_ONE' | 'STARGAZE', address: string, customDenom?: string) => {
        const client = await StargateClient.connect(RPC_URLS[chain])

        let denom = customDenom
        if (!denom) {
            switch (chain) {
                case 'COSMOS_HUB': denom = 'uatom'; break;
                case 'JUNO': denom = 'ujuno'; break;
                case 'NEUTRON': denom = 'untrn'; break;
                case 'OSMOSIS': denom = 'uosmo'; break;
                case 'ATOM_ONE': denom = 'uatone'; break;
                case 'STARGAZE': denom = 'ustars'; break;
            }
        }

        if (!denom) return 0

        const coin = await client.getBalance(address, denom)
        return parseFloat(coin.amount) / 1_000_000
    },

    // ----------------------------------------------------------------
    // CosmWasm Logic (CW20)
    // ----------------------------------------------------------------
    getCw20Balance: async (chain: 'JUNO' | 'NEUTRON', contractAddress: string, walletAddress: string): Promise<number> => {
        try {
            const client = await CosmWasmClient.connect(RPC_URLS[chain])

            // Standard CW20 query
            const queryMsg = { balance: { address: walletAddress } }
            const response = await client.queryContractSmart(contractAddress, queryMsg)

            // CW20 response usually { balance: "123456" }
            const rawBalance = response.balance

            // Assuming 6 decimals for most Cosmos tokens, but ideally query token info
            return parseFloat(rawBalance) / 1_000_000
        } catch (error) {
            console.error(`Error fetching CW20 balance for ${contractAddress}:`, error)
            return 0
        }
    },

    // ----------------------------------------------------------------
    // ERC20 Logic
    // ----------------------------------------------------------------
    getErc20Balance: async (chain: 'ETHEREUM' | 'BASE' | 'POLYGON' | 'ARBITRUM' | 'BSC' | 'GNOSIS', contractAddress: string, walletAddress: string): Promise<number> => {
        try {
            const provider = new ethers.JsonRpcProvider(RPC_URLS[chain])
            const abi = ["function balance(address) view returns (uint256)", "function decimals() view returns (uint8)", "function balanceOf(address) view returns (uint256)"]
            const contract = new ethers.Contract(contractAddress, abi, provider)

            // Try balanceOf first
            const balance: bigint = await contract.balanceOf(walletAddress)
            const decimals: number = await contract.decimals().catch(() => 18)

            return parseFloat(ethers.formatUnits(balance, decimals))
        } catch (error) {
            console.error(`Error fetching ERC20 balance for ${contractAddress} on ${chain}:`, error)
            return 0
        }
    }
}
