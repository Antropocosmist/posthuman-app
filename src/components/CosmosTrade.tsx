import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown, RefreshCw, ChevronDown, CheckCircle2, Search, X, Info, AlertTriangle, Zap, Globe, Coins } from 'lucide-react'
import { useWalletStore } from '../store/walletStore'
import { SkipService } from '../services/skip'
import type { SkipChain, SkipAsset } from '../services/skip'
import { TradeHistory } from '../components/TradeHistory'
import { PriceService } from '../services/price'

export function CosmosTrade() {
    const { wallets, getChainForWallet, addTrade, executeSkipMessages, refreshBalances } = useWalletStore()

    // Tab State
    const [activeTab, setActiveTab] = useState<'swap' | 'history'>('swap')

    // Selection State
    const [sourceChain, setSourceChain] = useState<SkipChain | null>(null)
    const [sourceAsset, setSourceAsset] = useState<SkipAsset | null>(null)
    const [destChain, setDestChain] = useState<SkipChain | null>(null)
    const [destAsset, setDestAsset] = useState<SkipAsset | null>(null)

    // Data State
    const [allChains, setAllChains] = useState<SkipChain[]>([])
    const [sourceAssets, setSourceAssets] = useState<SkipAsset[]>([])
    const [destAssets, setDestAssets] = useState<SkipAsset[]>([])
    const [prices, setPrices] = useState<Record<string, number>>({})

    // UI/Interaction State
    const [amountIn, setAmountIn] = useState('')
    const [isSwapping, setIsSwapping] = useState(false)
    const [swapComplete, setSwapComplete] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectingFor, setSelectingFor] = useState<{ type: 'source' | 'dest', mode: 'chain' | 'asset' } | null>(null)
    const [isLoadingAssets, setIsLoadingAssets] = useState(false)
    const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)

    // Route State
    const [route, setRoute] = useState<any>(null)
    const [isFetchingRoute, setIsFetchingRoute] = useState(false)
    const [error, setError] = useState<string | null>(null)

    const loadAssetsForChain = async (chainId: string, side: 'source' | 'dest') => {
        setIsLoadingAssets(true)
        try {
            const assets = await SkipService.getAssets({ chainId, includeCw20: true, includeEvm: true })
            if (side === 'source') setSourceAssets(assets)
            else setDestAssets(assets)
        } finally {
            setIsLoadingAssets(false)
        }
    }

    // Initialize
    useEffect(() => {
        const init = async () => {
            const chains = await SkipService.getChains()
            setAllChains(chains)

            // Fetch Prices
            const p = await PriceService.getPrices()
            setPrices(p)

            if (wallets.length > 0) {
                const wallet = wallets[0]
                const walletChain = getChainForWallet(wallet)
                const sChain = chains.find(c => c.chain_id === walletChain?.chain_id)
                if (sChain && !sourceChain) {
                    setSourceChain(sChain)
                }
            }
        }
        init()
    }, [wallets, getChainForWallet])

    // Load assets when chains change
    useEffect(() => {
        if (sourceChain) loadAssetsForChain(sourceChain.chain_id, 'source')
    }, [sourceChain])

    useEffect(() => {
        if (destChain) loadAssetsForChain(destChain.chain_id, 'dest')
    }, [destChain])

    // Fetch Route from Skip Go
    useEffect(() => {
        const fetchRoute = async () => {
            if (!sourceAsset || !destAsset || !sourceChain || !destChain || !amountIn || isNaN(parseFloat(amountIn)) || parseFloat(amountIn) <= 0) {
                setRoute(null)
                return
            }

            setIsFetchingRoute(true)
            setError(null)

            try {
                // Skip Go uses base denoms. Simplified: 10^decimals
                const baseAmount = (parseFloat(amountIn) * Math.pow(10, sourceAsset.decimals)).toString().split('.')[0]

                const req = {
                    amount_in: baseAmount,
                    source_asset_denom: sourceAsset.denom,
                    source_asset_chain_id: sourceChain.chain_id,
                    dest_asset_denom: destAsset.denom,
                    dest_asset_chain_id: destChain.chain_id,
                    allow_multi_tx: true
                }

                const routeData = await SkipService.getRoute(req as any)
                if (routeData && (routeData.amount_out || routeData.estimated_amount_out)) {
                    setRoute(routeData)
                } else {
                    setError("No route found")
                    setRoute(null)
                }
            } catch (err) {
                console.error("Route error:", err)
                setError("Failed to find route")
                setRoute(null)
            } finally {
                setIsFetchingRoute(false)
            }
        }

        const debounce = setTimeout(fetchRoute, 500)
        return () => clearTimeout(debounce)
    }, [sourceAsset, destAsset, sourceChain, destChain, amountIn])

    const handleSwap = async () => {
        if (!route || !sourceChain || !sourceAsset || !destAsset || !destChain || !wallets.length) return
        setIsSwapping(true)
        setError(null)

        try {
            // 1. Collect required addresses
            const requiredChainIds = route.required_chain_addresses || []
            const addressList: Record<string, string> = {}

            for (const chainId of requiredChainIds) {
                const wallet = wallets.find(w => getChainForWallet(w)?.chain_id === chainId)
                if (!wallet) {
                    throw new Error(`Required wallet for ${chainId} not found. Please connect it.`)
                }
                addressList[chainId] = wallet.address
            }

            // 2. Get execution messages from Skip
            const addressArray = requiredChainIds.map((cid: string) => addressList[cid])
            const msgsResponse = await SkipService.getMessages(route, addressArray)

            if (!msgsResponse || !msgsResponse.msgs || msgsResponse.msgs.length === 0) {
                throw new Error(msgsResponse?.message || "No execution messages returned from Skip.")
            }

            // 3. Execute messages via Wallet Store
            const txHash = (await executeSkipMessages(msgsResponse.msgs))[0] // Get first hash

            setSwapComplete(true)
            setTimeout(async () => {
                setSwapComplete(false)
                setAmountIn('')
                setRoute(null)
                await refreshBalances()
            }, 3000)

            // Add to history
            const price = prices[sourceAsset.symbol] || 0
            const usdValue = parseFloat(amountIn) * price

            addTrade({
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                sourceAsset: {
                    symbol: sourceAsset.symbol,
                    logo: sourceAsset.logo_uri || '',
                    amount: amountIn,
                    chainId: sourceChain.chain_id
                },
                destAsset: {
                    symbol: destAsset.symbol,
                    logo: destAsset.logo_uri || '',
                    amount: (parseFloat(route.amount_out || route.estimated_amount_out) / Math.pow(10, destAsset.decimals)).toString(),
                    chainId: destChain.chain_id
                },
                usdValue,
                status: 'completed',
                txHash
            })

        } catch (err: any) {
            console.error("Swap failed", err)
            setError(err.message || "Swap execution failed")
        } finally {
            setIsSwapping(false)
        }
    }

    const swapAssets = () => {
        const tempChain = sourceChain
        const tempAsset = sourceAsset
        const tempAssets = sourceAssets

        setSourceChain(destChain)
        setSourceAsset(destAsset)
        setSourceAssets(destAssets)

        setDestChain(tempChain)
        setDestAsset(tempAsset)
        setDestAssets(tempAssets)
    }

    const filteredChains = allChains.filter(c =>
        c.pretty_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.chain_id.toLowerCase().includes(searchTerm.toLowerCase())
    )

    const assetsToDisplay = selectingFor?.type === 'source' ? sourceAssets : destAssets

    // Sort assets: Balance > 0 first (descending value), then others
    const sortedAssets = useMemo(() => {
        let assets = assetsToDisplay.filter(a =>
            a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
            a.name.toLowerCase().includes(searchTerm.toLowerCase())
        )

        const attachedChainId = selectingFor?.type === 'source' ? sourceChain?.chain_id : destChain?.chain_id

        return assets.sort((a, b) => {
            const walletA = wallets.find(w => w.symbol === a.symbol && (w.chainId === attachedChainId || getChainForWallet(w)?.chain_id === attachedChainId))
            const walletB = wallets.find(w => w.symbol === b.symbol && (w.chainId === attachedChainId || getChainForWallet(w)?.chain_id === attachedChainId))

            const balanceA = walletA ? walletA.nativeBalance : 0
            const balanceB = walletB ? walletB.nativeBalance : 0
            const valA = walletA ? walletA.balance : 0
            const valB = walletB ? walletB.balance : 0

            // If both have balance, sort by USD Value Desc
            if (balanceA > 0 && balanceB > 0) return valB - valA

            // If one has balance, it comes first
            if (balanceA > 0) return -1 // A has balance, B doesn't: A first
            if (balanceB > 0) return 1  // B has balance, A doesn't: B first
            return 0 // Neither has balance: Keep original order
        })
    }, [assetsToDisplay, searchTerm, wallets, sourceChain, destChain, selectingFor])

    const filteredAssets = sortedAssets

    return (
        <div className="max-w-md mx-auto relative pt-4 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 px-1">
                <div>
                    {/* Subheader already in parent or implicit */}
                </div>
                <div className="flex p-1 bg-white/5 rounded-full border border-white/5">
                    <button
                        onClick={() => setActiveTab('swap')}
                        className={`px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'swap' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        Swap
                    </button>
                    <button
                        onClick={() => setActiveTab('history')}
                        className={`flex items-center gap-2 px-4 py-2 rounded-full text-xs font-bold uppercase tracking-wider transition-all ${activeTab === 'history' ? 'bg-blue-600 text-white shadow-lg' : 'text-gray-400 hover:text-white'
                            }`}
                    >
                        History
                    </button>
                </div>
            </div>

            <AnimatePresence mode="wait">
                {activeTab === 'history' ? (
                    <TradeHistory key="history" />
                ) : (
                    <motion.div
                        key="swap"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="px-4"
                    >
                        {/* Source Chain/Asset */}
                        <div className="bg-white/5 p-4 rounded-3xl border border-white/5 mb-2 relative group hover:border-white/10 transition-colors">
                            <div className="flex justify-between mb-2">
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Pay with</span>
                                <div className="flex items-center gap-1 text-xs text-gray-400 font-bold">
                                    <Zap className="w-3 h-3 text-yellow-500" />
                                    <span>Available: {
                                        (wallets.find(w => w.symbol === sourceAsset?.symbol && (w.chainId === sourceChain?.chain_id || getChainForWallet(w)?.chain_id === sourceChain?.chain_id))?.nativeBalance || 0).toFixed(4)
                                    }</span>
                                    <button
                                        onClick={async () => {
                                            setIsRefreshingBalance(true)
                                            await refreshBalances()
                                            setTimeout(() => setIsRefreshingBalance(false), 1000)
                                        }}
                                        className="ml-2 hover:bg-white/10 rounded-full p-1"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <input
                                        type="number"
                                        placeholder="0.0"
                                        value={amountIn}
                                        onChange={(e) => setAmountIn(e.target.value)}
                                        className="w-full bg-transparent text-3xl font-black text-white outline-none placeholder:text-white/20"
                                    />
                                    <div className="text-xs text-gray-500 font-bold mt-1">
                                        ≈ ${(parseFloat(amountIn || '0') * (prices[sourceAsset?.symbol || ''] || 0)).toFixed(2)}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 items-end">
                                    <button
                                        onClick={() => setSelectingFor({ type: 'source', mode: 'chain' })}
                                        className="flex items-center gap-2 bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-full border border-white/10 transition-all group/btn"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-blue-500/20 flex items-center justify-center">
                                            {sourceChain?.logo_uri ? <img src={sourceChain.logo_uri} className="w-full h-full object-contain p-0.5" /> : <Globe className="w-3 h-3 text-blue-400" />}
                                        </div>
                                        <span className="text-xs font-bold text-gray-300 group-hover/btn:text-white">{sourceChain?.pretty_name || 'Select Chain'}</span>
                                        <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </button>

                                    <button
                                        onClick={() => setSelectingFor({ type: 'source', mode: 'asset' })}
                                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 pl-2 pr-3 py-1.5 rounded-full transition-all min-w-[120px] justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center overflow-hidden">
                                                {sourceAsset?.logo_uri ? <img src={sourceAsset.logo_uri} className="w-full h-full object-cover" /> : <Coins className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-sm font-bold text-white">{sourceAsset?.symbol || 'Select'}</span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-white/50" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Swap Arrow */}
                        <div className="flex justify-center -my-3 relative z-10">
                            <button
                                onClick={swapAssets}
                                className="bg-[#0D0D12] p-2 rounded-xl border border-white/10 text-gray-500 hover:text-white hover:border-blue-500/50 hover:bg-blue-500/10 transition-all shadow-xl"
                            >
                                <ArrowDown className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Destination Chain/Asset */}
                        <div className="bg-white/5 p-4 rounded-3xl border border-white/5 mt-2 mb-6 hover:border-white/10 transition-colors">
                            <div className="flex justify-between mb-2">
                                <span className="text-xs text-gray-500 font-bold uppercase tracking-wider">Receive</span>
                            </div>

                            <div className="flex items-center gap-3">
                                <div className="flex-1">
                                    <div className="text-3xl font-black text-white/50">
                                        {route ? (parseFloat(route.amount_out || route.estimated_amount_out) / Math.pow(10, destAsset?.decimals || 6)).toFixed(4) : '0.00'}
                                    </div>
                                    <div className="text-xs text-gray-500 font-bold mt-1">
                                        ≈ ${(parseFloat(route?.amount_out || route?.estimated_amount_out || '0') / Math.pow(10, destAsset?.decimals || 6) * (prices[destAsset?.symbol || ''] || 0)).toFixed(2)}
                                    </div>
                                </div>

                                <div className="flex flex-col gap-2 items-end">
                                    <button
                                        onClick={() => setSelectingFor({ type: 'dest', mode: 'chain' })}
                                        className="flex items-center gap-2 bg-black/40 hover:bg-black/60 px-3 py-1.5 rounded-full border border-white/10 transition-all group/btn"
                                    >
                                        <div className="w-5 h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                            {destChain?.logo_uri ? <img src={destChain.logo_uri} className="w-full h-full object-contain p-0.5" /> : <Globe className="w-3 h-3 text-purple-400" />}
                                        </div>
                                        <span className="text-xs font-bold text-gray-300 group-hover/btn:text-white">{destChain?.pretty_name || 'Select Chain'}</span>
                                        <ChevronDown className="w-3 h-3 text-gray-500" />
                                    </button>

                                    <button
                                        onClick={() => setSelectingFor({ type: 'dest', mode: 'asset' })}
                                        className="flex items-center gap-2 bg-white/10 hover:bg-white/20 pl-2 pr-3 py-1.5 rounded-full transition-all min-w-[120px] justify-between"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-6 h-6 rounded-full bg-black/40 flex items-center justify-center overflow-hidden">
                                                {destAsset?.logo_uri ? <img src={destAsset.logo_uri} className="w-full h-full object-cover" /> : <Coins className="w-3 h-3 text-white" />}
                                            </div>
                                            <span className="text-sm font-bold text-white">{destAsset?.symbol || 'Select'}</span>
                                        </div>
                                        <ChevronDown className="w-4 h-4 text-white/50" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Route Info / Error */}
                        <AnimatePresence>
                            {isFetchingRoute && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-4 bg-blue-500/10 border border-blue-500/20 rounded-xl p-3 flex items-center justify-center gap-2"
                                >
                                    <RefreshCw className="w-4 h-4 text-blue-400 animate-spin" />
                                    <span className="text-xs font-bold text-blue-300">Finding best route...</span>
                                </motion.div>
                            )}

                            {error && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-4 bg-red-500/10 border border-red-500/20 rounded-xl p-3 flex items-center gap-2"
                                >
                                    <AlertTriangle className="w-4 h-4 text-red-400" />
                                    <span className="text-xs font-bold text-red-300">{error}</span>
                                </motion.div>
                            )}

                            {route && (
                                <motion.div
                                    initial={{ opacity: 0, height: 0 }}
                                    animate={{ opacity: 1, height: 'auto' }}
                                    exit={{ opacity: 0, height: 0 }}
                                    className="mb-6 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-4"
                                >
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-4 h-4 text-emerald-400" />
                                            <span className="text-xs font-bold text-white">Best Route Found</span>
                                        </div>
                                        <div className="text-[10px] font-bold bg-emerald-500/20 text-emerald-300 px-2 py-1 rounded-md">
                                            ~5s
                                        </div>
                                    </div>

                                    <div className="space-y-2">
                                        {route.operations?.map((op: any, i: number) => (
                                            <div key={i} className="flex items-center gap-3 text-xs text-gray-400">
                                                <div className="w-1.5 h-1.5 rounded-full bg-emerald-500/50" />
                                                <span>{op.swap ? `Swap on ${op.swap.swap_venue?.name}` : 'Transfer'}</span>
                                            </div>
                                        ))}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action Button */}
                        <button
                            onClick={handleSwap}
                            disabled={!route || isSwapping}
                            className={`w-full py-5 rounded-[1.5rem] font-black text-lg uppercase tracking-wider shadow-xl transition-all relative overflow-hidden group ${route ? 'bg-blue-600 text-white hover:scale-[1.02] active:scale-[0.98]' : 'bg-white/5 text-gray-500 cursor-not-allowed'
                                }`}
                        >
                            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />
                            {isSwapping ? (
                                <div className="flex items-center justify-center gap-2">
                                    <RefreshCw className="w-5 h-5 animate-spin" />
                                    <span>Swapping...</span>
                                </div>
                            ) : swapComplete ? (
                                <div className="flex items-center justify-center gap-2 text-emerald-400">
                                    <CheckCircle2 className="w-6 h-6" />
                                    <span>Success!</span>
                                </div>
                            ) : (
                                "Swap Now"
                            )}
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Modal for Selecting Chain/Asset */}
            <AnimatePresence>
                {selectingFor && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/80 backdrop-blur-md p-4"
                    >
                        <motion.div
                            initial={{ y: '100%' }}
                            animate={{ y: 0 }}
                            exit={{ y: '100%' }}
                            transition={{ type: "spring", damping: 25, stiffness: 300 }}
                            className="w-full max-w-md bg-[#0D0D12] border border-white/10 rounded-[2rem] overflow-hidden max-h-[85vh] flex flex-col shadow-2xl"
                        >
                            <div className="p-6 border-b border-white/5 flex items-center justify-between">
                                <h2 className="text-sm font-black text-white uppercase tracking-widest">
                                    Select {selectingFor.mode === 'chain' ? 'Network' : 'Asset'}
                                </h2>
                                <button
                                    onClick={() => setSelectingFor(null)}
                                    className="p-2 bg-white/5 rounded-full hover:bg-white/10 transition-colors"
                                >
                                    <X className="w-4 h-4 text-gray-400" />
                                </button>
                            </div>

                            <div className="p-4 flex-1 overflow-hidden flex flex-col">
                                <div className="relative mb-6">
                                    <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-700" />
                                    <input
                                        type="text"
                                        placeholder={selectingFor.mode === 'chain' ? "Search networks..." : "Search assets..."}
                                        className="w-full bg-white/[0.03] border border-white/10 rounded-[1.5rem] py-4 pl-12 pr-6 text-sm text-white outline-none focus:border-blue-500/50 transition-all font-bold placeholder:text-gray-800"
                                        value={searchTerm}
                                        onChange={(e) => setSearchTerm(e.target.value)}
                                        autoFocus
                                    />
                                </div>

                                <div className="flex-1 overflow-y-auto pr-3 custom-scrollbar space-y-2">
                                    {selectingFor.mode === 'chain' ? (
                                        filteredChains.map(c => (
                                            <button
                                                key={c.chain_id}
                                                onClick={() => {
                                                    if (selectingFor.type === 'source') {
                                                        setSourceChain(c)
                                                        setSourceAsset(null)
                                                        setSelectingFor({ type: 'source', mode: 'asset' })
                                                    } else {
                                                        setDestChain(c)
                                                        setDestAsset(null)
                                                        setSelectingFor({ type: 'dest', mode: 'asset' })
                                                    }
                                                    setSearchTerm('')
                                                }}
                                                className="w-full flex items-center justify-between p-4 rounded-[1.5rem] hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-2xl overflow-hidden bg-black/40 border border-white/10 p-2 flex items-center justify-center group-hover:scale-110 transition-transform">
                                                        {c.logo_uri ? <img src={c.logo_uri} className="w-full h-full object-contain" /> : <Globe className="w-5 h-5 text-gray-600" />}
                                                    </div>
                                                    <div className="text-left">
                                                        <div className="text-sm font-black text-white group-hover:text-blue-400 transition-colors">{c.pretty_name}</div>
                                                        <div className="text-[10px] text-gray-600 font-bold uppercase tracking-widest">{c.chain_type}</div>
                                                    </div>
                                                </div>
                                            </button>
                                        ))
                                    ) : isLoadingAssets ? (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-700">
                                            <RefreshCw className="w-8 h-8 animate-spin mb-4 text-blue-500/50" />
                                            <div className="text-[10px] font-black uppercase tracking-widest">Discovering assets...</div>
                                        </div>
                                    ) : filteredAssets.length > 0 ? (
                                        filteredAssets.slice(0, 100).map(a => {
                                            const wallet = wallets.find(w =>
                                                w.symbol === a.symbol &&
                                                (w.chainId === (selectingFor?.type === 'source' ? sourceChain : destChain)?.chain_id ||
                                                    getChainForWallet(w)?.chain_id === (selectingFor?.type === 'source' ? sourceChain : destChain)?.chain_id)
                                            )
                                            const balance = wallet ? wallet.nativeBalance : 0
                                            const usdBalance = wallet ? wallet.balance : 0

                                            return (
                                                <button
                                                    key={a.denom + a.chain_id}
                                                    onClick={() => {
                                                        if (selectingFor.type === 'source') setSourceAsset(a)
                                                        else setDestAsset(a)
                                                        setSelectingFor(null)
                                                        setSearchTerm('')
                                                    }}
                                                    className="w-full flex items-center justify-between p-4 rounded-[1.5rem] hover:bg-white/5 transition-all group border border-transparent hover:border-white/5"
                                                >
                                                    <div className="flex items-center gap-4">
                                                        <div className="w-10 h-10 rounded-full overflow-hidden bg-black/40 border border-white/10 group-hover:rotate-[15deg] transition-transform">
                                                            {a.logo_uri ? <img src={a.logo_uri} className="w-full h-full object-cover" /> : <Coins className="w-6 h-6 text-gray-600 m-2" />}
                                                        </div>
                                                        <div className="text-left">
                                                            <div className="text-sm font-black text-white group-hover:text-blue-400 transition-colors uppercase tracking-tight">{a.symbol}</div>
                                                            <div className="text-[10px] text-gray-600 font-bold whitespace-nowrap overflow-hidden text-ellipsis max-w-[150px]">{a.name}</div>
                                                        </div>
                                                    </div>
                                                    {balance > 0 && (
                                                        <div className="text-right">
                                                            <div className="text-sm font-bold text-white">{balance.toLocaleString(undefined, { maximumFractionDigits: 6 })}</div>
                                                            <div className="text-[10px] text-gray-500 font-bold">${usdBalance.toFixed(2)}</div>
                                                        </div>
                                                    )}
                                                </button>
                                            )
                                        })
                                    ) : (
                                        <div className="flex flex-col items-center justify-center py-20 text-gray-800">
                                            <Info className="w-8 h-8 mb-4 opacity-20" />
                                            <div className="text-[10px] font-black uppercase tracking-widest opacity-50 text-center mb-4">No assets found on this network</div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
