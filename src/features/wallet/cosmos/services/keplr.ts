/**
 * Keplr Wallet Provider — Cosmos & EVM
 * Dependencies: @cosmjs/stargate, @cosmjs/cosmwasm-stargate
 *
 * Handles:
 *   - connect(): Cosmos multi-chain + Keplr EVM
 *   - sendTransaction(): Cosmos native/IBC/CW20 sends
 *   - executeSkipMessages(): Cosmos IBC swap execution
 */

import { RpcService } from '../../../../shared/services/rpc'
import { PriceService } from '../../../../shared/services/price'
import type { ConnectedWallet } from '../../types/wallet.types'
import { EVM_CHAINS, ERC20_TOKENS, COSMOS_RPC_URLS } from '../../types/wallet.types'

const BASE_URL = import.meta.env.BASE_URL

// EIP-6963 discovered providers map (shared reference from walletStore)
let _discoveredProviders: Map<string, any> = new Map()
export function setDiscoveredProviders(map: Map<string, any>) {
    _discoveredProviders = map
}

const COSMOS_CHAINS = [
    { id: 'cosmoshub-4', rpcChain: 'COSMOS_HUB' as const, symbol: 'ATOM', name: 'Cosmos Hub' },
    { id: 'juno-1', rpcChain: 'JUNO' as const, symbol: 'JUNO', name: 'Juno Network' },
    { id: 'neutron-1', rpcChain: 'NEUTRON' as const, symbol: 'NTRN', name: 'Neutron' },
    { id: 'osmosis-1', rpcChain: 'OSMOSIS' as const, symbol: 'OSMO', name: 'Osmosis' },
    { id: 'atomone-1', rpcChain: 'ATOM_ONE' as const, symbol: 'ATONE', name: 'Atom One' },
    { id: 'stargaze-1', rpcChain: 'STARGAZE' as const, symbol: 'STARS', name: 'Stargaze' },
]

export const KeplrService = {

    // ----------------------------------------------------------------
    // connect() — Cosmos multi-chain + Keplr EVM
    // ----------------------------------------------------------------
    async connect(onWallet: (w: ConnectedWallet) => void): Promise<void> {
        if (!window.keplr) {
            alert('Keplr Wallet not detected! Please install it.')
            return
        }

        const prices = await PriceService.getPrices()

        // 1. Cosmos Chains
        for (const chainConfig of COSMOS_CHAINS) {
            try {
                await window.keplr.enable(chainConfig.id)
                const offlineSigner = window.keplr.getOfflineSigner(chainConfig.id)
                const accounts = await offlineSigner.getAccounts()
                const cosmosAddress = accounts[0].address

                const nativeBal = await RpcService.getBalance(chainConfig.rpcChain, cosmosAddress)
                const price = prices[chainConfig.symbol] || 0

                onWallet({
                    id: `${chainConfig.id}-${cosmosAddress.substr(-4)}`,
                    name: chainConfig.name,
                    chain: 'Cosmos',
                    address: cosmosAddress,
                    icon: `${BASE_URL}icons/keplr.png`,
                    balance: nativeBal * price,
                    nativeBalance: nativeBal,
                    symbol: chainConfig.symbol,
                    walletProvider: 'Keplr'
                })

                // PHMN Token (Juno CW20, Neutron IBC, Osmosis IBC)
                let phmnBal = 0
                let phmnType = ''
                if (chainConfig.id === 'juno-1') {
                    const PHMN_CONTRACT = 'juno1rws84uz7969aaa7pej303udhlkt3j9ca0l3egpcae98jwak9quzq8szn2l'
                    phmnBal = await RpcService.getCw20Balance('JUNO', PHMN_CONTRACT, cosmosAddress)
                    phmnType = 'Juno'
                } else if (chainConfig.id === 'neutron-1') {
                    phmnBal = await RpcService.getCosmosBalance('NEUTRON', cosmosAddress, 'ibc/4698B7C533CB50F4120691368F71A0E7161DA26F58376262ADF3F44AAAA6EF9E')
                    phmnType = 'Neutron'
                } else if (chainConfig.id === 'osmosis-1') {
                    phmnBal = await RpcService.getCosmosBalance('OSMOSIS', cosmosAddress, 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B')
                    phmnType = 'Osmosis'

                    // Dynamic USDC Discovery on Osmosis
                    try {
                        const { SkipService } = await import('../../../trade/cosmos/services/skip')
                        const osmoAssets = await SkipService.getAssets({ chainId: 'osmosis-1', includeCw20: true, includeEvm: false })
                        const usdcAssets = osmoAssets.filter((a: any) => a.symbol.toUpperCase().includes('USDC'))
                        let totalUsdc = 0
                        for (const asset of usdcAssets) {
                            const bal = await RpcService.getCosmosBalance('OSMOSIS', cosmosAddress, asset.denom)
                            if (bal > 0) totalUsdc += bal
                        }
                        if (totalUsdc > 0) {
                            onWallet({
                                id: `usdc-osmosis-1-${cosmosAddress.substr(-4)}`,
                                name: 'Osmosis (USDC)',
                                chain: 'Cosmos',
                                address: cosmosAddress,
                                icon: `${BASE_URL}icons/keplr.png`,
                                balance: totalUsdc * (prices['USDC'] || 1),
                                nativeBalance: totalUsdc,
                                symbol: 'USDC',
                                walletProvider: 'Keplr'
                            })
                        }
                    } catch (err) { console.error('[Keplr] Error detecting Osmosis USDC', err) }
                }

                if (phmnBal >= 0 && phmnType) {
                    onWallet({
                        id: `phmn-${chainConfig.id}-${cosmosAddress.substr(-4)}`,
                        name: `Posthuman (${phmnType})`,
                        chain: 'Cosmos',
                        address: cosmosAddress,
                        icon: `${BASE_URL}icons/keplr.png`,
                        balance: phmnBal * (prices['PHMN'] || 0),
                        nativeBalance: phmnBal,
                        symbol: 'PHMN',
                        walletProvider: 'Keplr'
                    })
                }

                // PHOTON (Atom One)
                if (chainConfig.id === 'atomone-1') {
                    const photonBal = await RpcService.getCosmosBalance('ATOM_ONE', cosmosAddress, 'uphoton')
                    if (photonBal > 0) {
                        onWallet({
                            id: `photon-${chainConfig.id}-${cosmosAddress.substr(-4)}`,
                            name: 'Atom One (Photon)',
                            chain: 'Cosmos',
                            address: cosmosAddress,
                            icon: `${BASE_URL}icons/keplr.png`,
                            balance: photonBal,
                            nativeBalance: photonBal,
                            symbol: 'PHOTON',
                            walletProvider: 'Keplr'
                        })
                    }
                }
            } catch (err) {
                console.error(`[Keplr] Failed to connect ${chainConfig.id}:`, err)
            }
        }

        // 2. Keplr EVM Support
        try {
            let keplrEvmProvider = null
            const discovered = _discoveredProviders.get('keplr')
            if (discovered) {
                keplrEvmProvider = discovered.provider
            } else if (typeof window.ethereum !== 'undefined' && (window.ethereum as any).isKeplr) {
                keplrEvmProvider = window.ethereum
            }

            if (keplrEvmProvider) {
                const accounts = await keplrEvmProvider.request({ method: 'eth_requestAccounts' })
                const evmAddress = accounts[0]

                for (const chainCfg of EVM_CHAINS) {
                    try {
                        const nativeBal = await RpcService.getBalance(chainCfg.rpc, evmAddress)
                        if (nativeBal > 0 || chainCfg.id === '0x1') {
                            onWallet({
                                id: `keplr-${chainCfg.id}-${evmAddress.substr(-4)}`,
                                name: `${chainCfg.name} (Keplr)`,
                                chain: 'EVM',
                                address: evmAddress,
                                icon: `${BASE_URL}icons/keplr.png`,
                                balance: nativeBal * (prices[chainCfg.symbol] || 0),
                                nativeBalance: nativeBal,
                                symbol: chainCfg.symbol,
                                chainId: chainCfg.id,
                                walletProvider: 'Keplr'
                            })
                        }

                        for (const token of ERC20_TOKENS) {
                            const contract = (token.contracts as any)[chainCfg.id]
                            if (contract) {
                                const tokenBal = await RpcService.getErc20Balance(chainCfg.rpc, contract, evmAddress)
                                if (tokenBal > 0) {
                                    onWallet({
                                        id: `keplr-${token.symbol}-${chainCfg.id}-${evmAddress.substr(-4)}`,
                                        name: `${token.symbol} on ${chainCfg.name} (Keplr)`,
                                        chain: 'EVM',
                                        address: evmAddress,
                                        icon: `${BASE_URL}icons/keplr.png`,
                                        balance: tokenBal * (prices[token.symbol] || 1),
                                        nativeBalance: tokenBal,
                                        symbol: token.symbol,
                                        chainId: chainCfg.id,
                                        walletProvider: 'Keplr'
                                    })
                                }
                            }
                        }
                    } catch (err) {
                        console.error(`[Keplr] Failed EVM discovery for ${chainCfg.name}:`, err)
                    }
                }
            }
        } catch (err) {
            console.warn('[Keplr] EVM connection failed or not accepted:', err)
        }
    },

    // ----------------------------------------------------------------
    // sendTransaction() — Cosmos native/IBC/CW20
    // ----------------------------------------------------------------
    async sendTransaction(wallet: ConnectedWallet, recipient: string, amount: string, memo?: string): Promise<string> {
        if (!window.keplr) throw new Error('Keplr not found')

        let chainId = ''
        if (wallet.id.startsWith('cosmoshub')) chainId = 'cosmoshub-4'
        else if (wallet.id.startsWith('juno')) chainId = 'juno-1'
        else if (wallet.id.startsWith('neutron')) chainId = 'neutron-1'
        else if (wallet.id.startsWith('osmosis')) chainId = 'osmosis-1'
        else if (wallet.id.startsWith('stargaze')) chainId = 'stargaze-1'
        else if (wallet.id.startsWith('phmn-juno')) chainId = 'juno-1'
        else if (wallet.id.startsWith('phmn-neutron')) chainId = 'neutron-1'
        else if (wallet.id.startsWith('phmn-osmosis')) chainId = 'osmosis-1'

        if (!chainId) throw new Error('Unknown chain ID for wallet')

        await window.keplr.enable(chainId)
        const offlineSigner = window.keplr.getOfflineSigner(chainId)

        // PHMN CW20 on Juno
        if (wallet.symbol === 'PHMN' && chainId === 'juno-1' && !wallet.id.includes('neutron') && !wallet.id.includes('osmosis')) {
            const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate')
            const client = await SigningCosmWasmClient.connectWithSigner(COSMOS_RPC_URLS['juno-1'], offlineSigner)
            const contract = 'juno1rws84uz7969aaa7pej303udhlkt3j9ca0l3egpcae98jwak9quzq8szn2l'
            const microAmount = (parseFloat(amount) * 1_000_000).toString()
            const fee = { amount: [{ denom: 'ujuno', amount: '5000' }], gas: '200000' }
            const result = await client.execute(wallet.address, contract, { transfer: { recipient, amount: microAmount } }, fee, memo || '')
            return result.transactionHash
        }

        // Native / IBC
        const { SigningStargateClient } = await import('@cosmjs/stargate')
        const client = await SigningStargateClient.connectWithSigner(COSMOS_RPC_URLS[chainId], offlineSigner)

        let denom = ''
        if (wallet.symbol === 'ATOM') denom = 'uatom'
        else if (wallet.symbol === 'JUNO') denom = 'ujuno'
        else if (wallet.symbol === 'OSMO') denom = 'uosmo'
        else if (wallet.symbol === 'NTRN') denom = 'untrn'
        else if (wallet.symbol === 'PHMN') {
            if (chainId === 'neutron-1') denom = 'ibc/4698B7C533CB50F4120691368F71A0E7161DA26F58376262ADF3F44AAAA6EF9E'
            else if (chainId === 'osmosis-1') denom = 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B'
        }

        if (!denom) throw new Error('Denom not found for symbol')

        const microAmount = (parseFloat(amount) * 1_000_000).toString()
        const feeDenom = chainId === 'juno-1' ? 'ujuno' : chainId === 'osmosis-1' ? 'uosmo' : chainId === 'neutron-1' ? 'untrn' : 'uatom'
        const fee = { amount: [{ denom: feeDenom, amount: '5000' }], gas: '200000' }
        const result = await client.sendTokens(wallet.address, recipient, [{ denom, amount: microAmount }], fee, memo || '')
        return result.transactionHash
    },

    // ----------------------------------------------------------------
    // executeSkipMessages() — IBC swap execution
    // ----------------------------------------------------------------
    async executeSkipMessages(messages: any[], wallets: ConnectedWallet[], getChainForWallet: (w: ConnectedWallet) => any): Promise<string[]> {
        const results: string[] = []

        for (let i = 0; i < messages.length; i++) {
            const m = messages[i]

            let chainId = m.chain_id
            let cosmosMsgWrapper = m.cosmos_msg

            if (m.multi_chain_msg) {
                chainId = m.multi_chain_msg.chain_id
                cosmosMsgWrapper = { msg: m.multi_chain_msg.msg, msg_type_url: m.multi_chain_msg.msg_type_url }
            } else if (m.cosmos_msg?.chain_id) {
                chainId = m.cosmos_msg.chain_id
            }

            if (!chainId) throw new Error(`Chain ID missing for message ${i}`)

            const wallet = wallets.find(w => getChainForWallet(w)?.chain_id === chainId)
            if (!wallet) throw new Error(`Wallet not connected for chain ${chainId}`)

            if (cosmosMsgWrapper) {
                if (!window.keplr) throw new Error('Keplr not found')
                await window.keplr.enable(chainId)
                const offlineSigner = window.keplr.getOfflineSigner(chainId)
                const rpcUrl = COSMOS_RPC_URLS[chainId] || `https://${chainId}-rpc.publicnode.com`
                const { SigningStargateClient, GasPrice } = await import('@cosmjs/stargate')
                const client = await SigningStargateClient.connectWithSigner(rpcUrl, offlineSigner, {
                    gasPrice: GasPrice.fromString('0.025uosmo')
                })
                const accounts = await offlineSigner.getAccounts()
                const senderAddress = accounts[0].address

                const rawMsg = typeof cosmosMsgWrapper.msg === 'string'
                    ? JSON.parse(cosmosMsgWrapper.msg)
                    : cosmosMsgWrapper.msg

                const msg = { typeUrl: cosmosMsgWrapper.msg_type_url, value: rawMsg }
                const fee = 'auto'
                const result = await client.signAndBroadcast(senderAddress, [msg], fee)
                results.push(result.transactionHash)
            } else if (m.evm_tx) {
                // EVM handled separately
                results.push('evm-tx-handled-separately')
            }
        }

        return results
    }
}
