/**
 * Wallet Store — Thin Orchestrator
 * Dependencies: zustand, firebase/firestore, firebase/auth
 *
 * This store is a thin router. All wallet-specific logic lives in submodules:
 *   cosmos/services/keplr.ts    — Keplr (Cosmos + EVM)
 *   evm/services/metamask.ts    — MetaMask
 *   evm/services/rabby.ts       — Rabby
 *   solana/services/phantom.ts  — Phantom
 *   solana/services/solflare.ts — Solflare
 *   gno/services/adena.ts       — Adena (Gno.land)
 *   canton/services/console.ts  — Console Wallet (Canton)
 *   canton/services/nightly.ts  — Nightly Wallet (Canton)
 */

import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RpcService } from '../../../shared/services/rpc'
import { PriceService } from '../../../shared/services/price'
import { db, auth } from '../../../shared/config/firebase'
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

import type { ChainType, ConnectedWallet, Trade } from '../types/wallet.types'
import { EVM_CHAINS, ERC20_TOKENS } from '../types/wallet.types'
import type { EIP6963ProviderDetail, EIP6963AnnounceProviderEvent } from '../types/eip6963.types'

// Submodule imports
import { KeplrService, setDiscoveredProviders } from '../cosmos/services/keplr'
import { MetaMaskService } from '../evm/services/metamask'
import { RabbyService } from '../evm/services/rabby'
import { PhantomService } from '../solana/services/phantom'
import { SolflareService } from '../solana/services/solflare'
import { AdenaService } from '../gno/services/adena'
import { ConsoleWalletService } from '../canton/services/console'
import { NightlyService } from '../canton/services/nightly'

// Re-export types for backward compatibility
export type { ChainType, ConnectedWallet, Trade }

// ----------------------------------------------------------------
// EIP-6963 Multi-Injected Provider Discovery
// ----------------------------------------------------------------
const discoveredProviders = new Map<string, EIP6963ProviderDetail>()

if (typeof window !== 'undefined') {
    window.addEventListener('eip6963:announceProvider', ((event: EIP6963AnnounceProviderEvent) => {
        const { info, provider } = event.detail
        discoveredProviders.set(info.name.toLowerCase(), { info, provider })
        console.log(`[WalletStore] Discovered EIP-6963 Provider: ${info.name}`)
    }) as EventListener)
    window.dispatchEvent(new Event('eip6963:requestProvider'))
    setDiscoveredProviders(discoveredProviders)
}



// Nightly Wallet TypeScript Declarations
declare global {
    interface Window {
        nightly?: {
            canton?: {
                connect: () => Promise<{ partyId: string; publicKey: string } | null>
                disconnect: () => Promise<void>
                signMessage: (message: string, onResponse: (response: any) => void) => void
                getPendingTransactions: () => Promise<unknown[] | null>
                getHoldingUtxos: () => Promise<unknown[] | null>
            }
        }
    }
}

// ----------------------------------------------------------------
// Store Interface
// ----------------------------------------------------------------
interface WalletState {
    wallets: ConnectedWallet[]
    isModalOpen: boolean
    isSendModalOpen: boolean
    isReceiveModalOpen: boolean
    selectedAssetId: string | null
    trades: Trade[]
    isLoading: boolean
    hasHydrated: boolean

    setIsLoading: (isLoading: boolean) => void
    setHasHydrated: (hydrated: boolean) => void
    clearState: () => void

    toggleModal: () => void
    toggleSendModal: (id?: string) => void
    toggleReceiveModal: (id?: string) => void
    connectWallet: (name: string, chain: ChainType) => Promise<void>
    disconnectWallet: (id: string) => void
    getTotalBalance: () => string
    sendTransaction: (walletId: string, recipient: string, amount: string, memo?: string, expirationDate?: string) => Promise<string>
    executeSkipMessages: (messages: any[]) => Promise<string[]>
    refreshBalances: () => Promise<void>
    getChainForWallet: (wallet: ConnectedWallet) => any
    addTrade: (trade: Trade) => void
    fetchTrades: () => Promise<void>
    _toCamelCase: (str: string) => string
    _convertKeysToCamelCase: (obj: any) => any
    _initAuthListener?: () => void
}



// ----------------------------------------------------------------
// Store
// ----------------------------------------------------------------
export const useWalletStore = create<WalletState>()(
    persist(
        (set, get) => ({
            wallets: [],
            isModalOpen: false,
            isSendModalOpen: false,
            isReceiveModalOpen: false,
            selectedAssetId: null,
            trades: [],
            isLoading: false,
            hasHydrated: false,

            _initAuthListener: () => {
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        console.log('👤 User signed in:', user.uid)
                        get().fetchTrades()
                    } else {
                        console.log('👋 User signed out')
                        get().clearState()
                    }
                })
            },

            setIsLoading: (isLoading) => set({ isLoading }),
            setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
            clearState: () => set({ trades: [], wallets: [], selectedAssetId: null, isModalOpen: false, isSendModalOpen: false, isReceiveModalOpen: false }),

            toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
            toggleSendModal: (id) => set((state) => ({ isSendModalOpen: !state.isSendModalOpen, selectedAssetId: id || null })),
            toggleReceiveModal: (id) => set((state) => ({ isReceiveModalOpen: !state.isReceiveModalOpen, selectedAssetId: id || null })),

            // ----------------------------------------------------------------
            // connectWallet — routes to the correct submodule
            // ----------------------------------------------------------------
            connectWallet: async (name, _chain) => {
                set({ isLoading: true })
                try {
                    // Helper: merge new wallets into state, deduplicating by id
                    const mergeWallets = (newWallets: ConnectedWallet[]) => {
                        const current = get().wallets
                        const unique = newWallets.filter(nw => !current.find(w => w.id === nw.id))
                        if (unique.length > 0) set((state) => ({ wallets: [...state.wallets, ...unique] }))
                    }

                    if (name === 'Keplr') {
                        // Keplr uses a callback-based API to stream wallets as they are discovered
                        await KeplrService.connect((wallet) => {
                            const current = get().wallets
                            if (!current.find(w => w.id === wallet.id)) {
                                set((state) => ({ wallets: [...state.wallets, wallet] }))
                            }
                        })
                    } else if (name === 'MetaMask') {
                        const wallets = await MetaMaskService.connect('MetaMask')
                        mergeWallets(wallets)
                    } else if (name === 'Rabby') {
                        const wallets = await RabbyService.connect()
                        mergeWallets(wallets)
                    } else if (name === 'Phantom') {
                        const wallets = await PhantomService.connect()
                        // Replace any existing Solana wallets for this address
                        if (wallets.length > 0) {
                            const address = wallets[0].address
                            const clean = get().wallets.filter(w => !(w.address === address && w.chain === 'Solana'))
                            set(() => ({ wallets: [...clean, ...wallets], isModalOpen: false }))
                            return
                        }
                    } else if (name === 'Solflare') {
                        const wallets = await SolflareService.connect()
                        if (wallets.length > 0) {
                            const address = wallets[0].address
                            const clean = get().wallets.filter(w => !(w.address === address && w.chain === 'Solana'))
                            set(() => ({ wallets: [...clean, ...wallets], isModalOpen: false }))
                            return
                        }
                    } else if (name === 'Adena') {
                        const wallets = await AdenaService.connect()
                        if (wallets.length > 0) {
                            const clean = get().wallets.filter(w => w.walletProvider !== 'Adena')
                            set({ wallets: [...clean, ...wallets], isModalOpen: false })
                            return
                        }
                    } else if (name === 'Console Wallet') {
                        const wallets = await ConsoleWalletService.connect()
                        if (wallets.length > 0) {
                            const clean = get().wallets.filter(w => w.walletProvider !== 'Console Wallet')
                            set({ wallets: [...clean, ...wallets], isModalOpen: false })
                            setTimeout(() => get().refreshBalances(), 500)
                            return
                        }
                    } else if (name === 'Nightly Wallet') {
                        const wallets = await NightlyService.connect()
                        if (wallets.length > 0) {
                            const clean = get().wallets.filter(w => w.walletProvider !== 'Nightly Wallet')
                            set({ wallets: [...clean, ...wallets], isModalOpen: false })
                            setTimeout(() => get().refreshBalances(), 500)
                            return
                        }
                    }

                    set({ isModalOpen: false })
                } catch (error) {
                    console.error('[WalletStore] Connection Failed:', error)
                    alert('Failed to connect wallet. Check console for details.')
                } finally {
                    set({ isLoading: false })
                }
            },

            disconnectWallet: (provider) => set((state) => ({
                wallets: state.wallets.filter(w => w.walletProvider !== provider)
            })),

            getTotalBalance: () => {
                const total = get().wallets.reduce((acc, w) => acc + w.balance, 0)
                return total.toLocaleString('en-US', { style: 'currency', currency: 'USD' })
            },

            // ----------------------------------------------------------------
            // sendTransaction — routes to the correct submodule
            // ----------------------------------------------------------------
            sendTransaction: async (walletId, recipient, amount, memo, expirationDate) => {
                set({ isLoading: true })
                try {
                    const wallet = get().wallets.find(w => w.id === walletId)
                    if (!wallet) throw new Error('Wallet not found')

                    if (wallet.chain === 'Cosmos') {
                        return await KeplrService.sendTransaction(wallet, recipient, amount, memo)
                    }

                    if (wallet.chain === 'EVM') {
                        if (wallet.walletProvider === 'Rabby') {
                            return await RabbyService.sendTransaction(wallet, recipient, amount)
                        }
                        return await MetaMaskService.sendTransaction(wallet, recipient, amount)
                    }

                    if (wallet.chain === 'Solana') {
                        if (wallet.walletProvider === 'Solflare') {
                            return await SolflareService.sendTransaction(wallet, recipient, amount)
                        }
                        return await PhantomService.sendTransaction(wallet, recipient, amount)
                    }

                    if (wallet.chain === 'Canton') {
                        if (wallet.walletProvider === 'Nightly Wallet') {
                            return await NightlyService.sendTransaction(wallet, recipient, amount, memo, expirationDate)
                        }
                        return await ConsoleWalletService.sendTransaction(wallet, recipient, amount, memo, expirationDate)
                    }

                    throw new Error(`Unsupported chain for sending: ${wallet.chain}`)
                } finally {
                    set({ isLoading: false })
                }
            },

            // ----------------------------------------------------------------
            // executeSkipMessages — delegates to KeplrService
            // ----------------------------------------------------------------
            executeSkipMessages: async (messages) => {
                set({ isLoading: true })
                try {
                    return await KeplrService.executeSkipMessages(messages, get().wallets, get().getChainForWallet)
                } finally {
                    set({ isLoading: false })
                }
            },

            // ----------------------------------------------------------------
            // getChainForWallet — chain metadata lookup
            // ----------------------------------------------------------------
            getChainForWallet: (wallet) => {
                if (wallet.chain === 'Solana') return { chain_id: 'solana', chain_name: 'solana', chain_type: 'svm' }
                if (wallet.chain === 'EVM') return EVM_CHAINS.find(c => c.id === wallet.chainId)
                if (wallet.chain === 'Cosmos') {
                    if (wallet.address.startsWith('cosmos')) return { chain_id: 'cosmoshub-4', chain_name: 'cosmos', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('juno')) return { chain_id: 'juno-1', chain_name: 'juno', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('neutron')) return { chain_id: 'neutron-1', chain_name: 'neutron', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('osmo')) return { chain_id: 'osmosis-1', chain_name: 'osmosis', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('atone')) return { chain_id: 'atomone-1', chain_name: 'atomone', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('stars')) return { chain_id: 'stargaze-1', chain_name: 'stargaze', chain_type: 'cosmos' }
                }
                if (wallet.chain === 'Canton') return { chain_id: 'canton', chain_name: 'Canton Network', chain_type: 'canton' }
                return null
            },

            // ----------------------------------------------------------------
            // addTrade / fetchTrades — Firebase persistence
            // ----------------------------------------------------------------
            addTrade: async (trade) => {
                set((state) => ({ trades: [trade, ...state.trades] }))
                const user = auth.currentUser
                if (user) {
                    try {
                        await addDoc(collection(db, 'trades'), {
                            id: trade.id,
                            user_id: user.uid,
                            source_symbol: trade.sourceAsset.symbol,
                            source_amount: trade.sourceAsset.amount,
                            source_logo: trade.sourceAsset.logo,
                            dest_symbol: trade.destAsset.symbol,
                            dest_amount: trade.destAsset.amount,
                            dest_logo: trade.destAsset.logo,
                            usd_value: trade.usdValue,
                            tx_hash: trade.txHash,
                            timestamp: trade.timestamp,
                            status: trade.status
                        })
                    } catch (e) {
                        console.error('[WalletStore] Firestore insert exception:', e)
                    }
                }
            },

            fetchTrades: async () => {
                const { hasHydrated } = get()
                if (!hasHydrated) return
                const user = auth.currentUser
                if (!user) return

                try {
                    const q = query(collection(db, 'trades'), where('user_id', '==', user.uid), orderBy('timestamp', 'desc'))
                    const querySnapshot = await getDocs(q)
                    const cloudTrades: Trade[] = []
                    querySnapshot.forEach((doc) => {
                        const t = doc.data()
                        cloudTrades.push({
                            id: t.id,
                            timestamp: Number(t.timestamp),
                            sourceAsset: { symbol: t.source_symbol, logo: t.source_logo || '', amount: t.source_amount, chainId: 'unknown' },
                            destAsset: { symbol: t.dest_symbol, logo: t.dest_logo || '', amount: t.dest_amount, chainId: 'unknown' },
                            usdValue: t.usd_value,
                            status: t.status,
                            txHash: t.tx_hash,
                            user_id: t.user_id
                        })
                    })
                    if (querySnapshot.size > 0) set({ trades: cloudTrades })
                } catch (error: any) {
                    console.error('[WalletStore] Failed to fetch trades:', error)
                }
            },

            // ----------------------------------------------------------------
            // refreshBalances — re-fetches all wallet balances via RpcService
            // ----------------------------------------------------------------
            refreshBalances: async () => {
                set({ isLoading: true })
                const { wallets } = get()
                if (wallets.length === 0) { set({ isLoading: false }); return }

                try {
                    const prices = await PriceService.getPrices()
                    const updatedWallets = [...wallets]

                    for (let i = 0; i < updatedWallets.length; i++) {
                        const w = updatedWallets[i]
                        let nativeBal = 0

                        try {
                            if (w.chain === 'EVM') {
                                const chainCfg = EVM_CHAINS.find(c => c.id === w.chainId)
                                if (chainCfg) {
                                    if (w.symbol === 'USDC' || w.symbol === 'USDT') {
                                        const token = ERC20_TOKENS.find(t => t.symbol === w.symbol)
                                        const contract = (token?.contracts as any)[w.chainId!]
                                        if (contract) nativeBal = await RpcService.getErc20Balance(chainCfg.rpc, contract, w.address)
                                    } else {
                                        nativeBal = await RpcService.getBalance(chainCfg.rpc, w.address)
                                    }
                                }
                            } else if (w.chain === 'Solana') {
                                nativeBal = await RpcService.getBalance('SOLANA', w.address)
                            } else if (w.chain === 'Cosmos') {
                                if (w.symbol === 'PHMN') {
                                    if (w.name.includes('Juno')) {
                                        nativeBal = await RpcService.getCw20Balance('JUNO', 'juno1rws84uz7969aaa7pej303udhlkt3j9ca0l3egpcae98jwak9quzq8szn2l', w.address)
                                    } else if (w.name.includes('Neutron')) {
                                        nativeBal = await RpcService.getCosmosBalance('NEUTRON', w.address, 'ibc/4698B7C533CB50F4120691368F71A0E7161DA26F58376262ADF3F44AAAA6EF9E')
                                    } else if (w.name.includes('Osmosis')) {
                                        nativeBal = await RpcService.getCosmosBalance('OSMOSIS', w.address, 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B')
                                    }
                                } else if (w.symbol === 'PHOTON') {
                                    nativeBal = await RpcService.getCosmosBalance('ATOM_ONE', w.address, 'uphoton')
                                } else {
                                    const chain = (w.name.includes('Hub') ? 'COSMOS_HUB' :
                                        w.name.includes('Juno') ? 'JUNO' :
                                            w.name.includes('Neutron') ? 'NEUTRON' :
                                                w.name.includes('Osmosis') ? 'OSMOSIS' :
                                                    w.name.includes('Atom One') ? 'ATOM_ONE' : null) as any
                                    if (chain) nativeBal = await RpcService.getBalance(chain, w.address)
                                }
                            } else if (w.chain === 'Canton') {
                                if (w.walletProvider === 'Console Wallet') {
                                    nativeBal = await ConsoleWalletService.refreshBalance(w.address)
                                } else if (w.walletProvider === 'Nightly Wallet') {
                                    nativeBal = await NightlyService.refreshBalance()
                                }
                            }

                            updatedWallets[i] = { ...w, nativeBalance: nativeBal, balance: nativeBal * (prices[w.symbol] || 0) }
                        } catch (e) {
                            console.error(`[WalletStore] Failed to refresh balance for ${w.symbol}:`, e)
                        }
                    }

                    set({ wallets: updatedWallets })
                } catch (err) {
                    console.error('[WalletStore] Failed to refresh balances:', err)
                } finally {
                    set({ isLoading: false })
                }
            },

            // ----------------------------------------------------------------
            // Helpers for CosmJS camelCase conversion (used by executeSkipMessages)
            // ----------------------------------------------------------------
            _toCamelCase: (str) => str.replace(/([-_][a-z])/g, (group) => group.toUpperCase().replace('-', '').replace('_', '')),

            _convertKeysToCamelCase: (obj) => {
                const { _convertKeysToCamelCase, _toCamelCase } = get()
                if (Array.isArray(obj)) return obj.map(v => _convertKeysToCamelCase(v))
                if (obj !== null && typeof obj === 'object') {
                    return Object.keys(obj).reduce((result, key) => ({
                        ...result,
                        [_toCamelCase(key)]: _convertKeysToCamelCase((obj as any)[key])
                    }), {})
                }
                return obj
            }
        }),
        {
            name: 'wallet-storage',
            partialize: (state) => ({ wallets: state.wallets, trades: state.trades }),
            onRehydrateStorage: () => (state) => {
                if (state) {
                    state.setHasHydrated(true)
                    state._initAuthListener?.()
                }
            }
        }
    )
)
