import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowDown, ArrowUp, RefreshCw, ChevronDown, CheckCircle2, Search, X, Info, AlertTriangle, Clock, Zap, Globe, Coins, History } from 'lucide-react'
import { useWalletStore } from '../store/walletStore'
import { SkipService } from '../services/skip'
import type { SkipChain, SkipAsset } from '../services/skip'
import { TradeHistory } from '../components/TradeHistory'
import { PriceService } from '../services/price'

export function Trade() {
    const { wallets, getChainForWallet, addTrade } = useWalletStore()

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

    // UI/Interaction State
    const [amountIn, setAmountIn] = useState('')
    const [isSwapping, setIsSwapping] = useState(false)
    const [swapComplete, setSwapComplete] = useState(false)
    const [searchTerm, setSearchTerm] = useState('')
    const [selectingFor, setSelectingFor] = useState<{ type: 'source' | 'dest', mode: 'chain' | 'asset' } | null>(null)
    const [isLoadingAssets, setIsLoadingAssets] = useState(false)
    const [isRefreshingBalance, setIsRefreshingBalance] = useState(false)

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

    // Initialize with first wallet or defaults
    useEffect(() => {
        const init = async () => {
            const chains = await SkipService.getChains()
            setAllChains(chains)

            if (wallets.length > 0) {
                const wallet = wallets[0]
                const walletChain = getChainForWallet(wallet)
                const sChain = chains.find(c => c.chain_id === walletChain?.chain_id)
                if (sChain && !sourceChain) {
                    setSourceChain(sChain)
                    // loadAssetsForChain will be called by the useEffect below
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
                    setError(routeData?.message || "No route found for this pair.")
                }
            } catch (err) {
                setError("Failed to fetch swap route.")
            } finally {
                setIsFetchingRoute(false)
            }
        }

        const timer = setTimeout(fetchRoute, 500)
        return () => clearTimeout(timer)
    }, [sourceAsset, destAsset, sourceChain, destChain, amountIn])

    // Route State
    const [route, setRoute] = useState<any>(null)
    const [isFetchingRoute, setIsFetchingRoute] = useState(false)
    const [error, setError] = useState<string | null>(null)
    const [sourceBalance, setSourceBalance] = useState<number | null>(null)

    // Sync Balance
    useEffect(() => {
        if (sourceAsset && sourceChain) {
            const wallet = wallets.find(w =>
                getChainForWallet(w)?.chain_id === sourceChain.chain_id &&
                w.symbol === sourceAsset.symbol
            )
            setSourceBalance(wallet ? wallet.nativeBalance : 0)
        } else {
            setSourceBalance(null)
        }
    }, [sourceAsset, sourceChain, wallets, getChainForWallet])

    const handleSwapExecute = async () => {
        if (!route || isSwapping) return
        setIsSwapping(true)
        setError(null)

        try {
            console.log("Starting Swap Execution", { route })

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
            const txHash = (await useWalletStore.getState().executeSkipMessages(msgsResponse.msgs))[0] // Get first hash

            // 4. Save Trade to History
            if (sourceAsset && destAsset && sourceChain && destChain) {
                // Get Prices for USD Value
                const prices = await PriceService.getPrices()
                const price = prices[sourceAsset.symbol] || 0
                const usdValue = parseFloat(amountIn) * price

                addTrade({
                    id: Math.random().toString(36).substr(2, 9),
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
            }

            setSwapComplete(true)
            await useWalletStore.getState().refreshBalances()
            setTimeout(() => setSwapComplete(false), 5000)
        } catch (err: any) {
            console.error("Swap Error:", err)
            setError(err.message || "Swap execution failed. Check console for details.")
        } finally {
            setIsSwapping(false)
        }
    }

    const switchSide = () => {
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
    const filteredAssets = assetsToDisplay.filter(a =>
        a.symbol.toLowerCase().includes(searchTerm.toLowerCase()) ||
        a.name.toLowerCase().includes(searchTerm.toLowerCase())
    )

    return (
        <div className="max-w-md mx-auto relative pt-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between mb-8 px-1">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Trade</h1>
                    <p className="text-xs text-blue-400 font-black uppercase tracking-widest mt-1">Smarter Routing</p>
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
                        <History className="w-3 h-3" />
                        History
                    </button>
                </div>
            </div>

            {activeTab === 'history' ? (
                <TradeHistory />
            ) : (
                <>
                    {/* Swap Interface */}
                    <div className="relative space-y-2">
                        {/* Pay Card */}
                        <div className="p-6 rounded-3xl bg-[#14141b] border border-white/5 backdrop-blur-xl transition-all hover:border-white/10 shadow-2xl">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500">From</span>
                                <div className="flex gap-3 items-baseline">
                                    {sourceBalance !== null && (
                                        <span className="text-[10px] font-bold text-gray-600">
                                            Balance: <span className="text-gray-400">{sourceBalance.toFixed(4)}</span>
                                        </span>
                                    )}
                                    <button
                                        onClick={() => sourceBalance !== null && setAmountIn(sourceBalance.toString())}
                                        className="text-[10px] font-bold text-blue-400 hover:text-white transition-colors"
                                    >
                                        MAX
                                    </button>
                                    <button
                                        onClick={async () => {
                                            setIsRefreshingBalance(true)
                                            await useWalletStore.getState().refreshBalances()
                                            setTimeout(() => setIsRefreshingBalance(false), 1000)
                                        }}
                                        className="p-1 hover:bg-white/10 rounded-full text-gray-500 hover:text-white transition-colors"
                                        title="Refresh Balance"
                                    >
                                        <RefreshCw className={`w-3 h-3 ${isRefreshingBalance ? 'animate-spin' : ''}`} />
                                    </button>
                                </div>
                            </div>

                            <div className="flex items-center gap-4">
                                <input
                                    type="number"
                                    placeholder="0.0"
                                    className="bg-transparent text-4xl font-bold text-white outline-none w-full placeholder:text-white/5"
                                    value={amountIn}
                                    onChange={(e) => setAmountIn(e.target.value)}
                                />
                                <div className="flex flex-col gap-1 items-end">
                                    <button
                                        onClick={() => setSelectingFor({ type: 'source', mode: 'chain' })}
                                        className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[10px] text-gray-400 font-bold uppercase tracking-wider transition-all border border-white/5"
                                    >
                                        <Globe className="w-3 h-3" />
                                        {sourceChain?.pretty_name || 'Network'}
                                    </button>
                                    <button
                                        onClick={() => setSelectingFor({ type: 'source', mode: 'asset' })}
                                        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-bold transition-all shadow-lg min-w-[120px]"
                                    >
                                        {sourceAsset ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-black/50">
                                                    <img src={sourceAsset.logo_uri} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="text-sm">{sourceAsset.symbol}</span>
                                            </>
                                        ) : <span className="text-sm">Select</span>}
                                        <ChevronDown className="w-4 h-4 text-gray-500 ml-auto" />
                                    </button>
                                </div>
                            </div>
                        </div>

                        {/* Swap Arrow */}
                        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 pointer-events-none">
                            <button
                                onClick={switchSide}
                                className="pointer-events-auto p-3 rounded-2xl bg-[#0a0a0f] border-4 border-[#050505] text-blue-400 hover:text-white hover:scale-110 transition-all shadow-xl group flex flex-row items-center justify-center gap-[2px]"
                            >
                                <ArrowUp className="w-4 h-4" />
                                <ArrowDown className="w-4 h-4" />
                            </button>
                        </div>

                        {/* Receive Card */}
                        <div className="p-6 rounded-3xl bg-[#14141b] border border-white/5 backdrop-blur-xl transition-all hover:border-white/10 shadow-2xl">
                            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-gray-500 block mb-4">To</span>
                            <div className="flex items-center gap-4">
                                <div className={`text-4xl font-bold w-full truncate ${route ? 'text-white' : 'text-white/5'}`}>
                                    {route ? (parseFloat(route.amount_out || route.estimated_amount_out) / Math.pow(10, destAsset?.decimals || 6)).toFixed(4) : '0.00'}
                                </div>
                                <div className="flex flex-col gap-1 items-end">
                                    <button
                                        onClick={() => setSelectingFor({ type: 'dest', mode: 'chain' })}
                                        className="flex items-center gap-2 pl-2 pr-3 py-1 rounded-full bg-white/5 hover:bg-white/10 text-[10px] text-gray-400 font-bold uppercase tracking-wider transition-all border border-white/5"
                                    >
                                        <Globe className="w-3 h-3" />
                                        {destChain?.pretty_name || 'Network'}
                                    </button>
                                    <button
                                        onClick={() => setSelectingFor({ type: 'dest', mode: 'asset' })}
                                        className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-blue-600 hover:bg-blue-500 text-white font-bold transition-all shadow-lg min-w-[120px]"
                                    >
                                        {destAsset ? (
                                            <>
                                                <div className="w-6 h-6 rounded-full overflow-hidden border border-white/10 bg-black/50">
                                                    <img src={destAsset.logo_uri} className="w-full h-full object-cover" />
                                                </div>
                                                <span className="text-sm">{destAsset.symbol}</span>
                                            </>
                                        ) : <span className="text-sm">Select</span>}
                                        <ChevronDown className="w-4 h-4 text-white/50 ml-auto" />
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Route & Error Messages */}
                    <AnimatePresence mode="wait">
                        {error && (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.95 }}
                                animate={{ opacity: 1, scale: 1 }}
                                className="mt-4 p-4 rounded-2xl bg-red-950/20 border border-red-500/20 text-red-500 text-xs flex items-center gap-3 font-medium"
                            >
                                <AlertTriangle className="w-4 h-4 shrink-0" />
                                {error}
                            </motion.div>
                        )}

                        {route && !isSwapping && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="mt-6 space-y-3"
                            >
                                <div className="p-5 rounded-[2rem] border border-white/5 bg-white/[0.02] space-y-4">
                                    <div className="flex justify-between items-center text-[10px] font-bold uppercase tracking-widest text-gray-500">
                                        <div className="flex items-center gap-2">
                                            <Zap className="w-3 h-3 text-blue-400" />
                                            Optimized Route
                                        </div>
                                        <div className="font-mono text-white/30 truncate max-w-[180px]">
                                            1 {sourceAsset?.symbol} ≈ {(parseFloat(route.amount_out || route.estimated_amount_out) / Math.pow(10, destAsset?.decimals || 6) / parseFloat(amountIn)).toFixed(6)} {destAsset?.symbol}
                                        </div>
                                    </div>

                                    <div className="h-px bg-white/5 w-full" />

                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="space-y-1">
                                            <div className="text-[9px] text-gray-600 uppercase font-black tracking-[0.2em]">Gas Fees</div>
                                            <div className="text-xs text-white/80 font-bold flex items-center gap-1">
                                                ~$0.15 - $2.50 <Info className="w-3 h-3 text-gray-700" />
                                            </div>
                                        </div>
                                        <div className="space-y-1 text-right">
                                            <div className="text-[9px] text-gray-600 uppercase font-black tracking-[0.2em]">Arrival</div>
                                            <div className="text-xs text-white/80 font-bold flex items-center gap-1 justify-end">
                                                <Clock className="w-3 h-3 text-gray-700" />
                                                {sourceChain?.chain_type === 'evm' ? 'Fast (~30s)' : 'Insntant (<10s)'}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Swap Button */}
                    <button
                        disabled={!route || isSwapping || isFetchingRoute}
                        onClick={handleSwapExecute}
                        className={`w-full mt-6 py-5 rounded-[2rem] font-black text-lg transition-all flex items-center justify-center gap-3 active:scale-95 uppercase tracking-widest
                        ${(!route || isSwapping || isFetchingRoute) ? 'bg-white/5 text-gray-700 cursor-not-allowed border border-white/5' :
                                'bg-blue-600 text-white hover:bg-blue-500 shadow-[0_20px_40px_rgba(37,99,235,0.2)] border border-blue-400/20'}
                    `}
                    >
                        {isFetchingRoute ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                <span>Scanning Hubs...</span>
                            </>
                        ) : isSwapping ? (
                            <>
                                <RefreshCw className="w-5 h-5 animate-spin" />
                                <span>Transacting...</span>
                            </>
                        ) : swapComplete ? (
                            <>
                                <CheckCircle2 className="w-5 h-5" />
                                <span>Done!</span>
                            </>
                        ) : (
                            'Confirm Swap'
                        )}
                    </button>
                </>
            )}

            {/* Universal Selection Modal */}
            <AnimatePresence>
                {selectingFor && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/95 backdrop-blur-2xl"
                        onClick={() => setSelectingFor(null)}
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 10 }}
                            animate={{ scale: 1, y: 0 }}
                            className="w-full max-w-sm bg-[#0a0a0f] border border-white/10 rounded-[3rem] overflow-hidden p-8 flex flex-col h-[600px] shadow-[0_0_100px_rgba(37,99,235,0.1)] relative"
                            onClick={(e) => e.stopPropagation()}
                        >
                            <div className="flex items-center justify-between mb-8">
                                <h3 className="text-xs font-black text-gray-600 uppercase tracking-[0.3em]">
                                    {selectingFor.mode === 'chain' ? 'Select Network' : `Assets on ${selectingFor.type === 'source' ? sourceChain?.pretty_name : destChain?.pretty_name}`}
                                </h3>
                                <button onClick={() => setSelectingFor(null)} className="p-2 hover:bg-white/5 rounded-full text-gray-500 hover:text-white transition-colors">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

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
                                    filteredAssets.slice(0, 100).map(a => (
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
                                        </button>
                                    ))
                                ) : (
                                    <div className="flex flex-col items-center justify-center py-20 text-gray-800">
                                        <Info className="w-8 h-8 mb-4 opacity-20" />
                                        <div className="text-[10px] font-black uppercase tracking-widest opacity-50 text-center">No assets found on this network</div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    )
}
