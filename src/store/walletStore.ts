import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { RpcService, RPC_URLS } from '../services/rpc'
import { PriceService } from '../services/price'
import { db, auth } from '../config/firebase'
import { collection, addDoc, getDocs, query, where, orderBy } from 'firebase/firestore'
import { onAuthStateChanged } from 'firebase/auth'

export type ChainType = 'EVM' | 'Cosmos' | 'Solana' | 'Gno'

export interface Trade {
    id: string
    timestamp: number
    sourceAsset: { symbol: string, logo: string, amount: string, chainId: string }
    destAsset: { symbol: string, logo: string, amount: string, chainId: string }
    usdValue: number
    status: 'completed' | 'failed'
    txHash?: string
    user_id?: string // Supabase user ID
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

const EVM_CHAINS = [
    { id: '0x1', rpc: 'ETHEREUM' as const, name: 'Ethereum', symbol: 'ETH' },
    { id: '0x2105', rpc: 'BASE' as const, name: 'Base', symbol: 'ETH' },
    { id: '0x89', rpc: 'POLYGON' as const, name: 'Polygon', symbol: 'POL' },
    { id: '0xa4b1', rpc: 'ARBITRUM' as const, name: 'Arbitrum', symbol: 'ETH' },
    { id: '0x38', rpc: 'BSC' as const, name: 'BSC', symbol: 'BNB' },
    { id: '0x64', rpc: 'GNOSIS' as const, name: 'Gnosis', symbol: 'XDAI' }
]

const ERC20_TOKENS = [
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
    sendTransaction: (walletId: string, recipient: string, amount: string, memo?: string) => Promise<string>
    executeSkipMessages: (messages: any[]) => Promise<string[]>
    refreshBalances: () => Promise<void>
    getChainForWallet: (wallet: ConnectedWallet) => any
    addTrade: (trade: Trade) => void
    fetchTrades: () => Promise<void>
    _toCamelCase: (str: string) => string
    _convertKeysToCamelCase: (obj: any) => any
    _initAuthListener?: () => void
}

// Define Base URL for assets
const BASE_URL = import.meta.env.BASE_URL

// EIP-6963 Interfaces
interface EIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
}

interface EIP6963ProviderDetail {
    info: EIP6963ProviderInfo;
    provider: any;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
    detail: {
        info: EIP6963ProviderInfo;
        provider: any;
    };
}

// Global map to store discovered providers
const discoveredProviders = new Map<string, EIP6963ProviderDetail>();

// Listen for EIP-6963 announcements
if (typeof window !== 'undefined') {
    window.addEventListener('eip6963:announceProvider', ((event: EIP6963AnnounceProviderEvent) => {
        const { info, provider } = event.detail;
        discoveredProviders.set(info.name.toLowerCase(), { info, provider });
        console.log(`[WalletStore] Discovered EIP-6963 Provider: ${info.name}`);
    }) as EventListener);

    // Request providers to announce themselves
    window.dispatchEvent(new Event('eip6963:requestProvider'));
}

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

            // Auth Listener to sync trades
            _initAuthListener: () => {
                onAuthStateChanged(auth, (user) => {
                    if (user) {
                        console.log("👤 User signed in:", user.uid)
                        get().fetchTrades()
                    } else {
                        console.log("👋 User signed out")
                        get().clearState()
                    }
                })
            },

            setIsLoading: (isLoading) => set({ isLoading }),
            setHasHydrated: (hydrated) => set({ hasHydrated: hydrated }),
            clearState: () => set({ trades: [], wallets: [], selectedAssetId: null, isModalOpen: false, isSendModalOpen: false, isReceiveModalOpen: false }),

            toggleModal: () => set((state) => ({ isModalOpen: !state.isModalOpen })),
            toggleSendModal: (id) => set((state) => ({
                isSendModalOpen: !state.isSendModalOpen,
                selectedAssetId: id || null
            })),
            toggleReceiveModal: (id) => set((state) => ({
                isReceiveModalOpen: !state.isReceiveModalOpen,
                selectedAssetId: id || null
            })),

            getChainForWallet: (wallet) => {
                if (wallet.chain === 'Solana') return { chain_id: 'solana', chain_name: 'solana', chain_type: 'svm' }
                if (wallet.chain === 'EVM') return EVM_CHAINS.find(c => c.id === wallet.chainId)
                // Cosmos mapping (improved via address prefix)
                if (wallet.chain === 'Cosmos') {
                    if (wallet.address.startsWith('cosmos')) return { chain_id: 'cosmoshub-4', chain_name: 'cosmos', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('juno')) return { chain_id: 'juno-1', chain_name: 'juno', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('neutron')) return { chain_id: 'neutron-1', chain_name: 'neutron', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('osmo')) return { chain_id: 'osmosis-1', chain_name: 'osmosis', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('atone')) return { chain_id: 'atomone-1', chain_name: 'atomone', chain_type: 'cosmos' }
                    if (wallet.address.startsWith('stars')) return { chain_id: 'stargaze-1', chain_name: 'stargaze', chain_type: 'cosmos' }
                }
                return null
            },

            addTrade: async (trade) => {
                // Optimistic UI Update
                set((state) => ({ trades: [trade, ...state.trades] }))

                const user = auth.currentUser;
                if (user) {
                    try {
                        await addDoc(collection(db, 'trades'), {
                            id: trade.id, // Send local ID to DB
                            user_id: user.uid,
                            source_symbol: trade.sourceAsset.symbol,
                            source_amount: trade.sourceAsset.amount,
                            source_logo: trade.sourceAsset.logo, // NEW
                            dest_symbol: trade.destAsset.symbol,
                            dest_amount: trade.destAsset.amount,
                            dest_logo: trade.destAsset.logo, // NEW
                            usd_value: trade.usdValue,
                            tx_hash: trade.txHash,
                            timestamp: trade.timestamp,
                            status: trade.status
                        })
                    } catch (e) {
                        console.error("Firestore insert exception:", e)
                    }
                }
            },

            fetchTrades: async () => {
                const { hasHydrated } = get()
                if (!hasHydrated) return

                const user = auth.currentUser;
                if (!user) return

                console.log("☁️ Fetching trades for user:", user.uid)
                try {
                    // Start with a simpler query to test permissions/indexing
                    // distinct query for debugging
                    const q = query(
                        collection(db, 'trades'),
                        where('user_id', '==', user.uid),
                        orderBy('timestamp', 'desc')
                    );

                    const querySnapshot = await getDocs(q);
                    console.log("☁️ Firestore Snapshot Size:", querySnapshot.size)

                    const cloudTrades: Trade[] = [];
                    querySnapshot.forEach((doc) => {
                        const t = doc.data();
                        // console.log("Fetched trade:", t.id) 
                        cloudTrades.push({
                            id: t.id,
                            timestamp: Number(t.timestamp),
                            sourceAsset: {
                                symbol: t.source_symbol,
                                logo: t.source_logo || '', // Ensure fallback
                                amount: t.source_amount,
                                chainId: 'unknown'
                            },
                            destAsset: {
                                symbol: t.dest_symbol,
                                logo: t.dest_logo || '', // Ensure fallback
                                amount: t.dest_amount,
                                chainId: 'unknown'
                            },
                            usdValue: t.usd_value,
                            status: t.status,
                            txHash: t.tx_hash,
                            user_id: t.user_id
                        });
                    });

                    if (querySnapshot.size > 0) {
                        console.log("✅ Hydrating trades from Cloud:", cloudTrades.length)
                        set({ trades: cloudTrades })
                    } else {
                        console.log("⚠️ No trades found for this user in Firestore.")
                    }

                } catch (error: any) {
                    console.error("❌ Failed to fetch trades from Firestore:", error)
                    if (error.code === 'failed-precondition') {
                        console.error("🔥 Likely missing Firestore Index. Check console for link to create it.")
                    }
                }
            },

            connectWallet: async (name, chain) => {
                if (get().isModalOpen) {
                    set({ isModalOpen: false }) // Close modal immediately to prevent double clicks? No, wait.
                    // Actually, let's keep it open until success/fail? 
                    // UI usually closes it or logic does.
                }

                try {
                    set({ isLoading: true })
                    // Fetch latest prices first
                    const prices = await PriceService.getPrices()

                    // ---------------------------------------------------------
                    // Cosmos (Keplr) - Multi-Chain Support
                    // ---------------------------------------------------------
                    if (chain === 'Cosmos') {
                        if (window.keplr) {
                            // 1. Cosmos Chains
                            const cosmosChains = [
                                { id: 'cosmoshub-4', rpcChain: 'COSMOS_HUB' as const, symbol: 'ATOM' },
                                { id: 'juno-1', rpcChain: 'JUNO' as const, symbol: 'JUNO' },
                                { id: 'neutron-1', rpcChain: 'NEUTRON' as const, symbol: 'NTRN' },
                                { id: 'osmosis-1', rpcChain: 'OSMOSIS' as const, symbol: 'OSMO' },
                                { id: 'atomone-1', rpcChain: 'ATOM_ONE' as const, symbol: 'ATONE' },
                                { id: 'stargaze-1', rpcChain: 'STARGAZE' as const, symbol: 'STARS' }
                            ]

                            for (const chainConfig of cosmosChains) {
                                try {
                                    await window.keplr.enable(chainConfig.id)
                                    const offlineSigner = window.keplr.getOfflineSigner(chainConfig.id)
                                    const accounts = await offlineSigner.getAccounts()
                                    const cosmosAddress = accounts[0].address

                                    const nativeBal = await RpcService.getBalance(chainConfig.rpcChain, cosmosAddress)

                                    // Real Price Integration
                                    const price = prices[chainConfig.symbol] || 0
                                    const usdBal = nativeBal * price

                                    // Main Native Asset Wallet
                                    const newWallet: ConnectedWallet = {
                                        id: `${chainConfig.id}-${cosmosAddress.substr(-4)}`,
                                        name: chainConfig.id === 'cosmoshub-4' ? 'Cosmos Hub' :
                                            chainConfig.id === 'juno-1' ? 'Juno Network' :
                                                chainConfig.id === 'osmosis-1' ? 'Osmosis' :
                                                    chainConfig.id === 'atomone-1' ? 'Atom One' :
                                                        chainConfig.id === 'stargaze-1' ? 'Stargaze' : 'Neutron',
                                        chain: 'Cosmos',
                                        address: cosmosAddress,
                                        icon: `${BASE_URL}icons/keplr.png`,
                                        balance: usdBal,
                                        nativeBalance: nativeBal,
                                        symbol: chainConfig.symbol,
                                        walletProvider: 'Keplr'
                                    }

                                    const currentWallets = get().wallets
                                    if (!currentWallets.find(w => w.address === cosmosAddress && w.symbol === chainConfig.symbol)) {
                                        set((state) => ({ wallets: [...state.wallets, newWallet] }))
                                    }

                                    // ----------------------------------------------------
                                    // PHMN Token Tracking (Multi-Chain)
                                    // ----------------------------------------------------
                                    let phmnBal = 0
                                    let phmnFound = false
                                    let phmnType = ''

                                    if (chainConfig.id === 'juno-1') {
                                        const PHMN_CONTRACT = 'juno1rws84uz7969aaa7pej303udhlkt3j9ca0l3egpcae98jwak9quzq8szn2l'
                                        phmnBal = await RpcService.getCw20Balance('JUNO', PHMN_CONTRACT, cosmosAddress)
                                        phmnType = 'Juno'
                                        phmnFound = true
                                    } else if (chainConfig.id === 'neutron-1') {
                                        const PHMN_IBC = 'ibc/4698B7C533CB50F4120691368F71A0E7161DA26F58376262ADF3F44AAAA6EF9E'
                                        phmnBal = await RpcService.getCosmosBalance('NEUTRON', cosmosAddress, PHMN_IBC)
                                        phmnType = 'Neutron'
                                        phmnFound = true
                                    } else if (chainConfig.id === 'osmosis-1') {
                                        const PHMN_IBC = 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B'
                                        phmnBal = await RpcService.getCosmosBalance('OSMOSIS', cosmosAddress, PHMN_IBC)
                                        phmnType = 'Osmosis'
                                        phmnFound = true

                                        // ----------------------------------------------------
                                        // Dynamic USDC Discovery on Osmosis
                                        // ----------------------------------------------------
                                        try {
                                            const { SkipService } = await import('../services/skip')
                                            const osmoAssets = await SkipService.getAssets({ chainId: 'osmosis-1', includeCw20: true, includeEvm: false })
                                            const usdcAssets = osmoAssets.filter(a => a.symbol.toUpperCase().includes('USDC'))
                                            let totalUsdc = 0
                                            console.log(`🔍 Found ${usdcAssets.length} USDC variants on Osmosis`, usdcAssets.map(a => a.denom))

                                            for (const asset of usdcAssets) {
                                                const bal = await RpcService.getCosmosBalance('OSMOSIS', cosmosAddress, asset.denom)
                                                if (bal > 0) totalUsdc += bal
                                            }

                                            if (totalUsdc > 0) {
                                                const usdcPrice = prices['USDC'] || 1
                                                const usdcWallet: ConnectedWallet = {
                                                    id: `usdc-osmosis-1-${cosmosAddress.substr(-4)}`,
                                                    name: `Osmosis (USDC)`,
                                                    chain: 'Cosmos',
                                                    address: cosmosAddress,
                                                    icon: `${BASE_URL}icons/keplr.png`,
                                                    balance: totalUsdc * usdcPrice,
                                                    nativeBalance: totalUsdc,
                                                    symbol: 'USDC',
                                                    walletProvider: 'Keplr'
                                                }
                                                if (!get().wallets.find(w => w.id === usdcWallet.id)) set((state) => ({ wallets: [...state.wallets, usdcWallet] }))
                                            }
                                        } catch (err) { console.error("Error detecting Osmosis USDC", err) }

                                    }

                                    if (phmnFound && phmnBal >= 0) {
                                        const phmnPrice = prices['PHMN'] || 0
                                        const phmnUsd = phmnBal * phmnPrice

                                        const phmnWallet: ConnectedWallet = {
                                            id: `phmn-${chainConfig.id}-${cosmosAddress.substr(-4)}`,
                                            name: `Posthuman (${phmnType})`,
                                            chain: 'Cosmos',
                                            address: cosmosAddress,
                                            icon: `${BASE_URL}icons/keplr.png`,
                                            balance: phmnUsd,
                                            nativeBalance: phmnBal,
                                            symbol: 'PHMN',
                                            walletProvider: 'Keplr'
                                        }

                                        if (!get().wallets.find(w => w.id === phmnWallet.id)) {
                                            set((state) => ({ wallets: [...state.wallets, phmnWallet] }))
                                        }
                                    }

                                    // ----------------------------------------------------
                                    // PHOTON (Atom One)
                                    // ----------------------------------------------------
                                    if (chainConfig.id === 'atomone-1') {
                                        const photonBal = await RpcService.getCosmosBalance('ATOM_ONE', cosmosAddress, 'uphoton')
                                        if (photonBal > 0) {
                                            const photonWallet: ConnectedWallet = {
                                                id: `photon-${chainConfig.id}-${cosmosAddress.substr(-4)}`,
                                                name: `Atom One (Photon)`,
                                                chain: 'Cosmos',
                                                address: cosmosAddress,
                                                icon: `${BASE_URL}icons/keplr.png`,
                                                balance: photonBal * 1, // Price unknown, default 1 or fetch
                                                nativeBalance: photonBal,
                                                symbol: 'PHOTON',
                                                walletProvider: 'Keplr'
                                            }

                                            if (!get().wallets.find(w => w.id === photonWallet.id)) {
                                                set((state) => ({ wallets: [...state.wallets, photonWallet] }))
                                            }
                                        }
                                    }
                                } catch (err) {
                                    console.error(`Failed to connect ${chainConfig.id}:`, err)
                                }
                            }

                            // 2. Keplr EVM Support
                            try {
                                let keplrEvmProvider = null;

                                // Priority 1: EIP-6963 Discovered Provider
                                const discovered = discoveredProviders.get('keplr');
                                if (discovered) {
                                    keplrEvmProvider = discovered.provider;
                                    console.log('[WalletStore] Using EIP-6963 Keplr Provider for EVM');
                                }
                                // Priority 2: Global window.ethereum if it claims to be Keplr
                                else if (typeof window.ethereum !== 'undefined' && (window.ethereum as any).isKeplr) {
                                    keplrEvmProvider = window.ethereum;
                                    console.log('[WalletStore] Using window.ethereum (isKeplr=true) for EVM');
                                }

                                if (keplrEvmProvider) {
                                    const accounts = await keplrEvmProvider.request({ method: 'eth_requestAccounts' })
                                    const evmAddress = accounts[0]

                                    for (const chainCfg of EVM_CHAINS) {
                                        try {
                                            // 1. Native Balance
                                            const nativeBal = await RpcService.getBalance(chainCfg.rpc, evmAddress)
                                            if (nativeBal > 0) {
                                                const price = prices[chainCfg.symbol] || 0
                                                const newWallet: ConnectedWallet = {
                                                    id: `keplr-${chainCfg.id}-${evmAddress.substr(-4)}`,
                                                    name: `${chainCfg.name} (Keplr)`,
                                                    chain: 'EVM',
                                                    address: evmAddress,
                                                    icon: `${BASE_URL}icons/keplr.png`,
                                                    balance: nativeBal * price,
                                                    nativeBalance: nativeBal,
                                                    symbol: chainCfg.symbol,
                                                    chainId: chainCfg.id,
                                                    walletProvider: 'Keplr'
                                                }

                                                const currentWallets = get().wallets
                                                if (!currentWallets.find(w => w.id === newWallet.id)) {
                                                    set((state) => ({ wallets: [...state.wallets, newWallet] }))
                                                }
                                            }

                                            // 2. ERC20 Discovery (USDC, USDT)
                                            for (const token of ERC20_TOKENS) {
                                                const contract = (token.contracts as any)[chainCfg.id]
                                                if (contract) {
                                                    const tokenBal = await RpcService.getErc20Balance(chainCfg.rpc, contract, evmAddress)
                                                    if (tokenBal > 0) { // Always show stablecoins
                                                        const tokenPrice = prices[token.symbol] || 1
                                                        const tokenWallet: ConnectedWallet = {
                                                            id: `keplr-${token.symbol}-${chainCfg.id}-${evmAddress.substr(-4)}`,
                                                            name: `${token.symbol} on ${chainCfg.name} (Keplr)`,
                                                            chain: 'EVM',
                                                            address: evmAddress,
                                                            icon: `${BASE_URL}icons/keplr.png`,
                                                            balance: tokenBal * tokenPrice,
                                                            nativeBalance: tokenBal,
                                                            symbol: token.symbol,
                                                            chainId: chainCfg.id,
                                                            walletProvider: 'Keplr'
                                                        }

                                                        if (!get().wallets.find(w => w.id === tokenWallet.id)) {
                                                            set((state) => ({ wallets: [...state.wallets, tokenWallet] }))
                                                        }
                                                    }
                                                }
                                            }

                                        } catch (err) {
                                            console.error(`Failed Keplr discovery for ${chainCfg.name}:`, err)
                                        }
                                    }
                                } else {
                                    console.log('[WalletStore] Keplr EVM provider not found. Skipping EVM connection.');
                                }
                            } catch (err) {
                                console.warn("Keplr EVM connection failed or not accepted:", err)
                            }
                        } else {
                            alert('Keplr Wallet not detected! Please install it.')
                            return
                        }
                    }

                    // ---------------------------------------------------------
                    // EVM & Solana (Specific Providers)
                    // ---------------------------------------------------------
                    else {
                        let address = ''

                        // EVM Handlers
                        if (chain === 'EVM') {
                            // Rabby usually injects window.rabby AND window.ethereum
                            // If name is Rabby, prioritize window.rabby if available, else standard ethereum
                            if (name === 'Rabby' && window.rabby) {
                                try {
                                    const accounts = await window.rabby.request({ method: 'eth_requestAccounts' })
                                    address = accounts[0]
                                } catch {
                                    // Fallback
                                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
                                    address = accounts[0]
                                }
                            } else {
                                // MetaMask or generic
                                if (typeof window.ethereum !== 'undefined') {
                                    const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' })
                                    address = accounts[0]
                                } else {
                                    alert('No EVM wallet detected!')
                                    return
                                }
                            }
                        }

                        // Solana Handlers
                        else if (chain === 'Solana') {
                            if (name === 'Solflare') {
                                if (window.solflare) {
                                    try {
                                        await window.solflare.connect()
                                        address = window.solflare.publicKey.toString()
                                    } catch (e) {
                                        console.error("Solflare Connect Error:", e)
                                        return
                                    }
                                } else {
                                    alert('Solflare not detected!')
                                    return
                                }
                            } else {
                                // Phantom (Solflare-style implementation)
                                // User requested to use "same method as Solflare"
                                // Solflare uses window.solflare, so we use window.phantom.solana
                                if ((window as any).phantom?.solana) {
                                    try {
                                        const provider = (window as any).phantom.solana
                                        const resp = await provider.connect()
                                        address = resp.publicKey.toString()
                                    } catch (e) {
                                        console.error("Phantom Connect Error:", e)
                                        return
                                    }
                                } else {
                                    alert('Phantom not detected! Check window.phantom.solana')
                                    return
                                }
                            }
                        }

                        // ----------------------------------------------------
                        // Multi-Chain & Token Discovery
                        // ----------------------------------------------------
                        const evmWallets: ConnectedWallet[] = []

                        if (chain === 'EVM') {
                            for (const chainCfg of EVM_CHAINS) {
                                try {
                                    // 1. Native Balance
                                    const nativeBal = await RpcService.getBalance(chainCfg.rpc, address)
                                    if (nativeBal > 0) {
                                        const price = prices[chainCfg.symbol] || 0
                                        evmWallets.push({
                                            id: `${name}-${chainCfg.name}-${address.substr(-4)}`,
                                            name: `${chainCfg.name} (${name})`,
                                            chain: 'EVM',
                                            address,
                                            icon: name === 'MetaMask' ? `${BASE_URL}icons/metamask.png` : `${BASE_URL}icons/rabby.png`,
                                            balance: nativeBal * price,
                                            nativeBalance: nativeBal,
                                            symbol: chainCfg.symbol,
                                            chainId: chainCfg.id,
                                            walletProvider: name
                                        })
                                    }

                                    // 2. ERC20 Tokens (USDC, USDT)
                                    for (const token of ERC20_TOKENS) {
                                        const contract = (token.contracts as any)[chainCfg.id]
                                        if (contract) {
                                            const tokenBal = await RpcService.getErc20Balance(chainCfg.rpc, contract, address)
                                            if (tokenBal > 0) {
                                                const tokenPrice = prices[token.symbol] || 1 // Fallback to 1 for stablecoins
                                                evmWallets.push({
                                                    id: `${token.symbol}-${chainCfg.name}-${address.substr(-4)}`,
                                                    name: `${token.symbol} on ${chainCfg.name}`,
                                                    chain: 'EVM',
                                                    address,
                                                    icon: name === 'MetaMask' ? `${BASE_URL}icons/metamask.png` : `${BASE_URL}icons/rabby.png`,
                                                    balance: tokenBal * tokenPrice,
                                                    nativeBalance: tokenBal,
                                                    symbol: token.symbol,
                                                    chainId: chainCfg.id,
                                                    walletProvider: name
                                                })
                                            }
                                        }
                                    }
                                } catch (e) {
                                    console.error(`Failed discovery for ${chainCfg.name}:`, e)
                                }
                            }

                            const currentWallets = get().wallets
                            const uniqueNewWallets = evmWallets.filter(nw => !currentWallets.find(w => w.id === nw.id))

                            set((state) => ({
                                wallets: [...state.wallets, ...uniqueNewWallets],
                                isModalOpen: false
                            }))
                            return
                        }

                        // Solana Handlers (Add to Store)
                        // Solana Handlers (Add to Store)
                        if (chain === 'Solana' && address) {
                            let realBalance = 0
                            let price = 0

                            try {
                                realBalance = await RpcService.getBalance('SOLANA', address)
                                price = prices['SOL'] || 0
                            } catch (error) {
                                console.error("Failed to fetch Solana details, defaulting to 0:", error)
                            }

                            const newWallet: ConnectedWallet = {
                                id: Math.random().toString(36).substr(2, 9),
                                name,
                                chain: 'Solana',
                                address,
                                icon: name === 'Phantom' ? `${BASE_URL}icons/phantom.png` : `${BASE_URL}icons/solflare.png`,
                                balance: realBalance * price,
                                nativeBalance: realBalance,
                                symbol: 'SOL',
                                walletProvider: name
                            }

                            // Replace logic: Remove ANY existing wallet with this address and chain
                            // This ensures no legacy state (like missing walletProvider) persists.
                            const cleanWallets = get().wallets.filter(w => !(w.address === address && w.chain === 'Solana'))

                            const newWalletsToAdd = [newWallet]

                            // --------------------------------------------------------
                            // Solana Token Discovery (USDC, USDT)
                            // --------------------------------------------------------
                            const SOLANA_TOKENS = [
                                { symbol: 'USDC', name: 'USD Coin', mint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v' },
                                { symbol: 'USDT', name: 'Tether USD', mint: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB' }
                            ]

                            for (const token of SOLANA_TOKENS) {
                                try {
                                    const tokenBal = await RpcService.getSplBalance(address, token.mint)
                                    if (tokenBal > 0) {
                                        const tokenPrice = prices[token.symbol] || 1
                                        newWalletsToAdd.push({
                                            id: `${token.symbol}-SOL-${address.substr(-4)}`,
                                            name: `${token.symbol} (Solana)`,
                                            chain: 'Solana',
                                            address,
                                            icon: name === 'Phantom' ? `${BASE_URL}icons/phantom.png` : `${BASE_URL}icons/solflare.png`,
                                            balance: tokenBal * tokenPrice,
                                            nativeBalance: tokenBal,
                                            symbol: token.symbol,
                                            walletProvider: name
                                        })
                                    }
                                } catch (e) {
                                    console.error(`Failed to fetch ${token.symbol} on Solana:`, e)
                                }
                            }

                            set(() => ({
                                wallets: [...cleanWallets, ...newWalletsToAdd],
                                isModalOpen: false
                            }))
                        } else if (chain === 'Solana' && !address) {
                            console.warn("Solana connection attempted but no address found.")
                        }


                        // ---------------------------------------------------------
                        // Gno.land (Adena)
                        // ---------------------------------------------------------

                        else if (chain === 'Gno') {
                            if (window.adena) {
                                try {
                                    console.log("[Adena] Attempting to establish connection...")
                                    // 1. Establish Connection
                                    const est = await window.adena.AddEstablish("Posthuman")
                                    console.log("[Adena] Establish Result:", est)

                                    // Check for success OR 'already connected' error
                                    const isSuccess = est.status === 'success' || est.code === 0
                                    const isAlreadyConnected =
                                        (est.message && est.message.toLowerCase().includes("already connected")) ||
                                        est.type === 'ALREADY_CONNECTED' ||
                                        est.code === 4001

                                    if (isSuccess || isAlreadyConnected) {
                                        // 2. Get Account Info
                                        const acc = await window.adena.GetAccount()
                                        console.log("[Adena] GetAccount Result:", acc)

                                        if (acc.status === 'success' || acc.code === 0) {
                                            const address = acc.data.address
                                            const coins = acc.data.coins // e.g. "1000000ugnot"

                                            // Parse balance (usually raw string like "123ugnot")
                                            let nativeBal = 0
                                            if (coins && coins.includes('ugnot')) {
                                                nativeBal = parseInt(coins.replace('ugnot', '')) / 1000000
                                            }

                                            const newWallet: ConnectedWallet = {
                                                id: `adena-${address.substr(-4)}`,
                                                name: 'Adena',
                                                chain: 'Gno',
                                                address: address,
                                                icon: `${BASE_URL}icons/adena.png`,
                                                balance: 0,
                                                nativeBalance: nativeBal,
                                                symbol: 'GNOT',
                                                walletProvider: 'Adena'
                                            }

                                            // Remove existing Adena wallets to prevent dups
                                            const cleanWallets = get().wallets.filter(w => w.walletProvider !== 'Adena')
                                            set({ wallets: [...cleanWallets, newWallet], isModalOpen: false })

                                        } else {
                                            console.error("Adena GetAccount failed:", acc)
                                            alert(`Failed to get Adena account: ${acc.message || 'Unknown error'}`)
                                        }
                                    } else {
                                        console.error("Adena Establish failed:", est)
                                        alert(`Adena connection rejected or failed: ${est.message || 'Unknown error'}`)
                                    }
                                } catch (e: any) {
                                    console.error("Adena connection exception:", e)
                                    alert(`Adena error: ${e.message || e}`)
                                }
                            } else {
                                alert("Adena Wallet not detected! Redirecting to install page...")
                                window.open("https://adena.app/", "_blank")
                            }
                        }
                    }
                } catch (error) {
                    console.error("Connection Failed:", error)
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

            sendTransaction: async (walletId, recipient, amount, memo) => {
                set({ isLoading: true })
                try {
                    const wallet = get().wallets.find(w => w.id === walletId)
                    if (!wallet) throw new Error("Wallet not found")

                    // ---------------------------------------------------------
                    // Cosmos (Keplr) - Native/IBC & CW20
                    // ---------------------------------------------------------
                    if (wallet.chain === 'Cosmos') {
                        if (!window.keplr) throw new Error("Keplr not found")

                        // Determine Chain ID from wallet ID (prefix)
                        let chainId = ''
                        if (wallet.id.startsWith('cosmoshub')) chainId = 'cosmoshub-4'
                        else if (wallet.id.startsWith('juno')) chainId = 'juno-1'
                        else if (wallet.id.startsWith('neutron')) chainId = 'neutron-1'
                        else if (wallet.id.startsWith('osmosis')) chainId = 'osmosis-1'
                        else if (wallet.id.startsWith('stargaze')) chainId = 'stargaze-1'
                        else if (wallet.id.startsWith('phmn-juno')) chainId = 'juno-1' // PHMN CW20
                        else if (wallet.id.startsWith('phmn-neutron')) chainId = 'neutron-1'
                        else if (wallet.id.startsWith('phmn-osmosis')) chainId = 'osmosis-1'

                        if (!chainId) throw new Error("Unknown chain ID for wallet")

                        await window.keplr.enable(chainId)
                        const offlineSigner = window.keplr.getOfflineSigner(chainId)

                        // 1. PHMN CW20 on Juno
                        if (wallet.symbol === 'PHMN' && chainId === 'juno-1' && !wallet.id.includes('neutron') && !wallet.id.includes('osmosis')) {
                            const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate')
                            const rpc = 'https://juno-rpc.polkachu.com'
                            const client = await SigningCosmWasmClient.connectWithSigner(rpc, offlineSigner)

                            const contract = 'juno1rws84uz7969aaa7pej303udhlkt3j9ca0l3egpcae98jwak9quzq8szn2l'
                            // CW20 Send amount is integer (6 decimals)
                            const microAmount = (parseFloat(amount) * 1_000_000).toString()

                            const msg = {
                                transfer: {
                                    recipient: recipient,
                                    amount: microAmount
                                }
                            }

                            const fee = { amount: [{ denom: 'ujuno', amount: '5000' }], gas: '200000' }
                            const result = await client.execute(wallet.address, contract, msg, fee, memo || '')
                            return result.transactionHash
                        }

                        // 2. Native / IBC (ATOM, JUNO, OSMO, NTRN, IBC PHMN)
                        else {
                            const { SigningStargateClient } = await import('@cosmjs/stargate')
                            const rpcs: Record<string, string> = {
                                'cosmoshub-4': 'https://cosmos-rpc.publicnode.com',
                                'juno-1': 'https://juno-rpc.polkachu.com',
                                'neutron-1': 'https://neutron-rpc.publicnode.com',
                                'osmosis-1': 'https://osmosis-rpc.publicnode.com:443',
                                'atomone-1': 'https://atomone-rpc.publicnode.com',
                                'stargaze-1': 'https://stargaze-rpc.publicnode.com:443'
                            }

                            const client = await SigningStargateClient.connectWithSigner(rpcs[chainId], offlineSigner)

                            // Determine denom
                            let denom = ''
                            if (wallet.symbol === 'ATOM') denom = 'uatom'
                            else if (wallet.symbol === 'JUNO') denom = 'ujuno'
                            else if (wallet.symbol === 'OSMO') denom = 'uosmo'
                            else if (wallet.symbol === 'NTRN') denom = 'untrn'
                            else if (wallet.symbol === 'PHMN') {
                                // IBC Denoms
                                if (chainId === 'neutron-1') denom = 'ibc/4698B7C533CB50F4120691368F71A0E7161DA26F58376262ADF3F44AAAA6EF9E'
                                else if (chainId === 'osmosis-1') denom = 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B'
                            }

                            if (!denom) throw new Error("Denom not found for symbol")

                            const microAmount = (parseFloat(amount) * 1_000_000).toString()
                            const fee = { amount: [{ denom: chainId === 'juno-1' ? 'ujuno' : chainId === 'osmosis-1' ? 'uosmo' : chainId === 'neutron-1' ? 'untrn' : 'uatom', amount: '5000' }], gas: '200000' }

                            const result = await client.sendTokens(wallet.address, recipient, [{ denom, amount: microAmount }], fee, memo || '')
                            return result.transactionHash
                        }
                    }

                    // ---------------------------------------------------------
                    // EVM (MetaMask/Rabby)
                    // ---------------------------------------------------------
                    if (wallet.chain === 'EVM') {
                        const { ethers } = await import('ethers')

                        // Explicitly select the provider based on the wallet name to avoid conflicts
                        let web3Provider: any;
                        if (wallet.name.toLowerCase().includes('rabby')) {
                            web3Provider = (window as any).rabby || (window as any).ethereum;
                        } else if (wallet.name.toLowerCase().includes('keplr')) {
                            web3Provider = (window as any).keplr?.ethereum || (window as any).ethereum;
                        } else {
                            // MetaMask or Generic
                            web3Provider = (window as any).ethereum;
                        }

                        if (!web3Provider) throw new Error("No EVM provider found for the selected wallet.");

                        // 1. Network Validation & Switching (Raw check to avoid ethers network mismatch error)
                        const targetChainId = wallet.chainId || '0x1';
                        const currentChainIdHex = await web3Provider.request({ method: 'eth_chainId' });

                        if (currentChainIdHex !== targetChainId) {
                            try {
                                await web3Provider.request({
                                    method: 'wallet_switchEthereumChain',
                                    params: [{ chainId: targetChainId }],
                                });
                            } catch (switchError: any) {
                                if (switchError.code === 4902) {
                                    const chainCfg = EVM_CHAINS.find(c => c.id === targetChainId)
                                    throw new Error(`Please add the ${chainCfg?.name || 'correct'} network to your wallet.`);
                                }
                                throw switchError;
                            }
                        }

                        // 2. Initialize Ethers after network is confirmed
                        const provider = new ethers.BrowserProvider(web3Provider)
                        const signer = await provider.getSigner()

                        try {
                            // 2. ERC20 Transfer
                            if (wallet.symbol === 'USDC' || wallet.symbol === 'USDT') {
                                const token = ERC20_TOKENS.find(t => t.symbol === wallet.symbol)
                                const contractAddr = (token?.contracts as any)[targetChainId]
                                if (!contractAddr) throw new Error(`Contract address not found for ${wallet.symbol} on this chain`)

                                const abi = ["function transfer(address, uint256) returns (bool)", "function decimals() view returns (uint8)"]
                                const contract = new ethers.Contract(contractAddr, abi, signer)

                                const decimals = await contract.decimals().catch(() => 6) // stablecoins often 6
                                const tx = await contract.transfer(recipient, ethers.parseUnits(amount.toString(), decimals))
                                return tx.hash
                            }

                            // 3. Native Transfer
                            else {
                                const tx = await signer.sendTransaction({
                                    to: recipient,
                                    value: ethers.parseUnits(amount.toString(), 18),
                                    gasLimit: 21000
                                })
                                return tx.hash
                            }
                        } catch (err: any) {
                            if (err.code === 'INSUFFICIENT_FUNDS' || err.message?.toLowerCase().includes('insufficient funds')) {
                                throw new Error(`Insufficient ${wallet.symbol} for transaction + gas fees.`);
                            }
                            throw err;
                        }
                    }

                    // ---------------------------------------------------------
                    // Solana (Phantom/Solflare)
                    // ---------------------------------------------------------
                    if (wallet.chain === 'Solana') {
                        const { Transaction, SystemProgram, LAMPORTS_PER_SOL, PublicKey, Connection } = await import('@solana/web3.js')

                        const connection = new Connection('https://solana-rpc.publicnode.com')
                        const fromPubkey = new PublicKey(wallet.address)

                        const transaction = new Transaction().add(
                            SystemProgram.transfer({
                                fromPubkey,
                                toPubkey: new PublicKey(recipient),
                                lamports: Math.floor(parseFloat(amount) * LAMPORTS_PER_SOL),
                            })
                        )

                        // Fix: Recent Blockhash and Fee Payer are required
                        const { blockhash } = await connection.getLatestBlockhash()
                        transaction.recentBlockhash = blockhash
                        transaction.feePayer = fromPubkey

                        // Select the correct provider based on the wallet name to avoid conflicts
                        let provider: any;
                        if (wallet.name === 'Solflare') {
                            provider = (window as any).solflare;
                        } else if (wallet.name === 'Phantom') {
                            provider = (window as any).solana;
                        } else {
                            // Fallback for any other or untracked Solana wallets
                            provider = (window as any).solana || (window as any).solflare;
                        }

                        if (!provider) throw new Error(`${wallet.name} wallet not found`);

                        const { signature } = await provider.signAndSendTransaction(transaction)
                        return signature
                    }

                    throw new Error(`Unsupported chain for sending: ${wallet.chain}`)
                } finally {
                    set({ isLoading: false })
                }
            },

            // Helper to convert snake_case to camelCase for CosmJS compatibility
            _toCamelCase: (str: string) => {
                return str.replace(/([-_][a-z])/g, (group) =>
                    group.toUpperCase()
                        .replace('-', '')
                        .replace('_', '')
                );
            },

            _convertKeysToCamelCase: (obj: any): any => {
                const { _convertKeysToCamelCase, _toCamelCase } = get()
                if (Array.isArray(obj)) {
                    return obj.map(v => _convertKeysToCamelCase(v));
                } else if (obj !== null && typeof obj === 'object') {
                    return Object.keys(obj).reduce(
                        (result, key) => ({
                            ...result,
                            [_toCamelCase(key)]: _convertKeysToCamelCase((obj as any)[key]),
                        }),
                        {},
                    );
                }
                return obj;
            },

            executeSkipMessages: async (messages: any[]) => {
                set({ isLoading: true })
                try {
                    console.log("🚀 Starting executeSkipMessages", { count: messages.length, messages })
                    const results: string[] = []
                    const { wallets, getChainForWallet } = get()

                    for (let i = 0; i < messages.length; i++) {
                        const m = messages[i]

                        // RESOLVE CHAIN ID AND MESSAGE CONTENT
                        let chainId = m.chain_id
                        let cosmosMsgWrapper = m.cosmos_msg

                        if (m.multi_chain_msg) {
                            console.log(`📦 Detected 'multi_chain_msg' wrapper`)
                            chainId = m.multi_chain_msg.chain_id
                            cosmosMsgWrapper = {
                                msg: m.multi_chain_msg.msg,
                                msg_type_url: m.multi_chain_msg.msg_type_url
                            }
                        } else if (m.cosmos_msg) {
                            if (m.cosmos_msg.chain_id) chainId = m.cosmos_msg.chain_id
                        }

                        console.log(`\n📦 Processing message ${i + 1}/${messages.length} for chain: ${chainId}`, m)

                        if (!chainId) {
                            console.error(`❌ Chain ID missing for message ${i}`, m)
                            throw new Error(`Chain ID missing for message ${i}`)
                        }

                        const wallet = wallets.find(w => getChainForWallet(w)?.chain_id === chainId)

                        if (!wallet) {
                            console.error(`❌ Wallet not connected for chain ${chainId}`)
                            throw new Error(`Wallet not connected for chain ${chainId}`)
                        }

                        console.log(`✅ Found wallet for ${chainId}:`, { address: wallet.address, name: wallet.name })

                        // ---------------------------------------------------------
                        // Cosmos Message Execution
                        // ---------------------------------------------------------
                        if (cosmosMsgWrapper) {
                            console.log(`🔷 Processing Cosmos message for ${chainId}`)

                            if (!window.keplr) {
                                console.error("❌ Keplr not found")
                                throw new Error("Keplr not found")
                            }

                            console.log(`🔓 Enabling Keplr for ${chainId}...`)
                            try {
                                await window.keplr.enable(chainId)
                                console.log(`✅ Keplr enabled for ${chainId}`)
                            } catch (err) {
                                console.error(`❌ Failed to enable Keplr for ${chainId}:`, err)
                                throw err
                            }

                            const offlineSigner = window.keplr.getOfflineSigner(chainId)
                            console.log(`✅ Got offline signer for ${chainId}`)

                            const { SigningStargateClient } = await import('@cosmjs/stargate')
                            const { SigningCosmWasmClient } = await import('@cosmjs/cosmwasm-stargate')

                            // Determine RPC via Chain ID mapping
                            const chainIdToRpcKey: Record<string, keyof typeof RPC_URLS> = {
                                'cosmoshub-4': 'COSMOS_HUB',
                                'juno-1': 'JUNO',
                                'neutron-1': 'NEUTRON',
                                'osmosis-1': 'OSMOSIS',
                                'atomone-1': 'ATOM_ONE'
                            }
                            const rpcKey = chainIdToRpcKey[chainId]
                            const rpc = rpcKey ? (RPC_URLS as any)[rpcKey] : `https://${chainId.split('-')[0]}-rpc.publicnode.com`
                            console.log(`🌐 Using RPC: ${rpc}`)

                            console.log(`📝 Raw message data:`, cosmosMsgWrapper.msg)
                            console.log(`📝 Message type:`, typeof cosmosMsgWrapper.msg)
                            console.log(`📝 Message type URL:`, cosmosMsgWrapper.msg_type_url)

                            // Handle both string and object formats from Skip Protocol
                            let msgObj: any
                            if (typeof cosmosMsgWrapper.msg === 'string') {
                                console.log(`🔄 Parsing message from JSON string...`)
                                try {
                                    msgObj = JSON.parse(cosmosMsgWrapper.msg)
                                } catch (parseErr) {
                                    console.error(`❌ Failed to parse message JSON:`, parseErr)
                                    throw new Error(`Invalid message format from Skip Protocol: ${parseErr}`)
                                }
                            } else {
                                console.log(`✅ Message already parsed as object`)
                                msgObj = cosmosMsgWrapper.msg
                            }
                            // FIX: Convert snake_case keys to camelCase for CosmJS compatibility
                            // BUT preserve the 'msg' field content (Contract Payload) from corruption!
                            const msgContent = msgObj.msg; // Save original

                            console.log(`🔄 Converting keys to camelCase (skipping internal 'msg' conversion)...`)
                            const camelMsgObj = (get() as any)._convertKeysToCamelCase(msgObj)

                            // Restore original msg content if it was an object (to prevent recursive camelCase)
                            if (msgContent && typeof msgContent === 'object') {
                                camelMsgObj.msg = msgContent
                            }

                            // FIX: Handle specific type requirements (e.g. Wasm msg as Uint8Array)
                            if (cosmosMsgWrapper.msg_type_url?.includes('wasm') || cosmosMsgWrapper.msg_type_url?.includes('MsgExecuteContract')) {
                                console.log(`⚙️ Handling Wasm message conversion (msg -> Uint8Array)...`)
                                // For MsgExecuteContract, the 'msg' field is a JSON object in Skip response
                                // but must be encoded as Uint8Array for CosmJS
                                if (camelMsgObj.msg) {
                                    const { toUtf8 } = await import('@cosmjs/encoding')
                                    // Use the RESTORED (snake_case) msgContent for stringify
                                    const msgString = typeof camelMsgObj.msg === 'string' ? camelMsgObj.msg : JSON.stringify(camelMsgObj.msg)
                                    camelMsgObj.msg = toUtf8(msgString)
                                    console.log(`✅ Converted 'msg' field to Uint8Array`)
                                }
                            }

                            console.log(`✅ Final message object (camelCase):`, JSON.stringify(camelMsgObj, null, 2))

                            // Create the encoded message for CosmJS
                            const encodeMsg = {
                                typeUrl: cosmosMsgWrapper.msg_type_url,
                                value: camelMsgObj
                            }
                            console.log(`📨 Encoded message for signing:`, JSON.stringify(encodeMsg, null, 2))

                            // If it's a wasm execute, use CosmWasm client
                            let txHash = ''
                            try {
                                // Create explicit fee instead of 'auto' to avoid gas estimation issues
                                const fee = {
                                    amount: [{ denom: chainId === 'osmosis-1' ? 'uosmo' : chainId === 'juno-1' ? 'ujuno' : chainId === 'neutron-1' ? 'untrn' : 'uatom', amount: '50000' }],
                                    gas: '500000'
                                }
                                console.log(`💰 Using fee:`, fee)

                                let result;
                                if (cosmosMsgWrapper.msg_type_url?.includes('cosmwasm')) {
                                    console.log(`🔧 Using CosmWasm client for wasm message`)
                                    const client = await SigningCosmWasmClient.connectWithSigner(rpc, offlineSigner)
                                    console.log(`✅ Connected CosmWasm client`)
                                    console.log(`✍️ Calling signAndBroadcast with explicit fee... (Keplr should prompt now)`)
                                    result = await client.signAndBroadcast(wallet.address, [encodeMsg], fee)
                                } else {
                                    console.log(`🔧 Using Stargate client for standard message`)
                                    const client = await SigningStargateClient.connectWithSigner(rpc, offlineSigner)
                                    console.log(`✅ Connected Stargate client`)
                                    console.log(`✍️ Calling signAndBroadcast with explicit fee... (Keplr should prompt now)`)
                                    result = await client.signAndBroadcast(wallet.address, [encodeMsg], fee)
                                }

                                if (result.code !== 0) {
                                    throw new Error(`Transaction failed with code ${result.code}: ${result.rawLog}`)
                                }

                                txHash = result.transactionHash
                                console.log(`✅ Transaction broadcast success! Hash: ${txHash}`)

                                results.push(txHash)
                            } catch (err: any) {
                                console.error(`❌ Error during signAndBroadcast:`, err)
                                console.error(`❌ Error details:`, {
                                    message: err.message,
                                    code: err.code,
                                    stack: err.stack
                                })
                                throw err
                            }
                        }

                        // ---------------------------------------------------------
                        // EVM Message Execution
                        // ---------------------------------------------------------
                        else if (m.evm_msg) {
                            console.log(`🔶 Processing EVM message`)
                            const { ethers } = await import('ethers')
                            let web3Provider = (window as any).ethereum
                            if (wallet.name.toLowerCase().includes('rabby')) web3Provider = (window as any).rabby || web3Provider

                            const provider = new ethers.BrowserProvider(web3Provider)
                            const signer = await provider.getSigner()

                            console.log(`✍️ Sending EVM transaction...`)
                            const tx = await signer.sendTransaction({
                                to: m.evm_msg.to,
                                data: m.evm_msg.data,
                                value: m.evm_msg.value
                            })

                            console.log(`⏳ Waiting for confirmation...`)
                            const receipt = await tx.wait()
                            if (receipt) {
                                console.log(`✅ EVM transaction confirmed! Hash: ${receipt.hash}`)
                                results.push(receipt.hash)
                            }
                        }
                    }

                    console.log(`🎉 All messages executed successfully!`, results)
                    return results
                } finally {
                    set({ isLoading: false })
                }
            },

            refreshBalances: async () => {
                set({ isLoading: true })
                const { wallets } = get()
                if (wallets.length === 0) {
                    set({ isLoading: false })
                    return
                }

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
                                        if (contract) {
                                            nativeBal = await RpcService.getErc20Balance(chainCfg.rpc, contract, w.address)
                                        }
                                    } else {
                                        nativeBal = await RpcService.getBalance(chainCfg.rpc, w.address)
                                    }
                                }
                            } else if (w.chain === 'Solana') {
                                nativeBal = await RpcService.getBalance('SOLANA', w.address)
                            } else if (w.chain === 'Cosmos') {
                                // Check if it's PHMN
                                if (w.symbol === 'PHMN') {
                                    if (w.name.includes('Juno')) {
                                        const PHMN_CONTRACT = 'juno1rws84uz7969aaa7pej303udhlkt3j9ca0l3egpcae98jwak9quzq8szn2l'
                                        nativeBal = await RpcService.getCw20Balance('JUNO', PHMN_CONTRACT, w.address)
                                    } else if (w.name.includes('Neutron')) {
                                        const PHMN_IBC = 'ibc/4698B7C533CB50F4120691368F71A0E7161DA26F58376262ADF3F44AAAA6EF9E'
                                        nativeBal = await RpcService.getCosmosBalance('NEUTRON', w.address, PHMN_IBC)
                                    } else if (w.name.includes('Osmosis')) {
                                        const PHMN_IBC = 'ibc/D3B574938631B0A1BA704879020C696E514CFADAA7643CDE4BD5EB010BDE327B'
                                        nativeBal = await RpcService.getCosmosBalance('OSMOSIS', w.address, PHMN_IBC)
                                    }
                                } else if (w.symbol === 'PHOTON') {
                                    if (w.name.includes('Atom One')) {
                                        nativeBal = await RpcService.getCosmosBalance('ATOM_ONE', w.address, 'uphoton')
                                    }
                                } else {
                                    // Native Cosmos
                                    const chain = (w.name.includes('Hub') ? 'COSMOS_HUB' :
                                        w.name.includes('Juno') ? 'JUNO' :
                                            w.name.includes('Neutron') ? 'NEUTRON' :
                                                w.name.includes('Osmosis') ? 'OSMOSIS' :
                                                    w.name.includes('Atom One') ? 'ATOM_ONE' : null) as any
                                    if (chain) {
                                        nativeBal = await RpcService.getBalance(chain, w.address)
                                    }
                                }
                            }

                            const price = prices[w.symbol] || 0
                            updatedWallets[i] = {
                                ...w,
                                nativeBalance: nativeBal,
                                balance: nativeBal * price
                            }
                        } catch (e) {
                            console.error(`Failed to refresh balance for ${w.symbol}:`, e)
                        }
                    }

                    set({ wallets: updatedWallets })
                } catch (err) {
                    console.error("Failed to refresh balances:", err)
                } finally {
                    set({ isLoading: false })
                }
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
