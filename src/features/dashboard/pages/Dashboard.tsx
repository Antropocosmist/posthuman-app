import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowUpRight, ArrowDownLeft, Wallet, ChevronDown, ChevronUp } from 'lucide-react'
import { useWalletStore } from '../../wallet/store/walletStore'

const DonutChart = ({ wallets }: { wallets: any[] }) => {
    const [isExpanded, setIsExpanded] = useState(false)

    // Aggregate assets by symbol
    const assetMap = wallets.reduce((acc: any, w: any) => {
        const value = w.balance
        if (value <= 0) return acc

        // Handle special cases or normalization if needed
        const symbol = w.symbol.toUpperCase()
        acc[symbol] = (acc[symbol] || 0) + value
        return acc
    }, {})

    // Convert to array and sort
    const data = Object.entries(assetMap)
        .map(([symbol, value]: [string, any]) => ({ symbol, value }))
        .sort((a, b) => b.value - a.value)

    const total = data.reduce((sum, item) => sum + item.value, 0)

    // Config
    const size = 160
    const strokeWidth = 20
    const center = size / 2
    const radius = (size - strokeWidth) / 2
    const circumference = 2 * Math.PI * radius

    // Colors
    const colors = [
        '#8b5cf6', // Violet
        '#3b82f6', // Blue
        '#06b6d4', // Cyan
        '#10b981', // Emerald
        '#f59e0b', // Amber
        '#ef4444', // Red
        '#ec4899', // Pink
    ]


    const visibleData = isExpanded ? data : data.slice(0, 4)

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="p-6 rounded-2xl border border-white/10 bg-[#16161e] flex flex-col items-center justify-center relative overflow-hidden"
        >
            <div className="absolute top-0 right-0 p-4 opacity-5">
                <img src={`${import.meta.env.BASE_URL}logo.png`} alt="bg" className="w-32 h-32 blur-xl" />
            </div>

            <h3 className="w-full text-sm font-bold text-gray-400 mb-6 flex items-center gap-2 z-10">
                <div className="w-2 h-2 rounded-full bg-purple-500"></div>
                Asset Allocation
            </h3>

            <div className="flex items-center w-full gap-8 z-10">
                {/* Chart */}
                <div className="relative w-40 h-40 flex-shrink-0">
                    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="transform -rotate-90">
                        {(() => {
                            let accumulatedAngle = 0
                            return data.map((item, i) => {
                                const percentage = item.value / total
                                const strokeDasharray = `${percentage * circumference} ${circumference}`
                                const color = colors[i % colors.length]
                                const startAngle = accumulatedAngle
                                accumulatedAngle += percentage

                                return (
                                    <circle
                                        key={item.symbol}
                                        cx={center}
                                        cy={center}
                                        r={radius}
                                        fill="transparent"
                                        stroke={color}
                                        strokeWidth={strokeWidth}
                                        strokeDasharray={strokeDasharray}
                                        strokeDashoffset={-startAngle * circumference}
                                        strokeLinecap="round"
                                        className="transition-all duration-500 ease-out hover:opacity-80"
                                    />
                                )
                            })
                        })()}
                    </svg>
                    {/* Center Text */}
                    <div className="absolute inset-0 flex items-center justify-center flex-col">
                        <span className="text-xs text-gray-500 font-medium">Top Asset</span>
                        <span className="text-white font-bold">{data[0]?.symbol || '-'}</span>
                    </div>
                </div>

                {/* Legend */}
                <div className="flex-1 space-y-3 min-w-0 transition-all duration-300">
                    {visibleData.map((item, i) => (
                        <div key={item.symbol} className="flex items-center justify-between text-sm animate-in fade-in slide-in-from-left-2 duration-300">
                            <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: colors[i % colors.length] }}></div>
                                <span className="font-medium text-gray-200">{item.symbol}</span>
                            </div>
                            <span className="text-gray-500">{((item.value / total) * 100).toFixed(1)}%</span>
                        </div>
                    ))}

                    {data.length > 4 && (
                        <button
                            onClick={() => setIsExpanded(!isExpanded)}
                            className="w-full flex items-center justify-center gap-1 text-xs text-gray-500 hover:text-white transition-colors pt-2 group"
                        >
                            {isExpanded ? (
                                <>Show Less <ChevronUp className="w-3 h-3 group-hover:-translate-y-0.5 transition-transform" /></>
                            ) : (
                                <>+ {data.length - 4} others <ChevronDown className="w-3 h-3 group-hover:translate-y-0.5 transition-transform" /></>
                            )}
                        </button>
                    )}
                </div>
            </div>
        </motion.div>
    )
}

export function Dashboard() {
    const { wallets, getTotalBalance, toggleSendModal, toggleReceiveModal, toggleModal } = useWalletStore()

    const totalBalance = getTotalBalance() === '$0.00' ? '$0' : getTotalBalance()

    // Determine display assets
    const displayAssets = wallets.map(w => ({
        id: w.id,
        chain: w.chain,
        symbol: w.symbol,
        name: w.name,
        balance: w.nativeBalance.toLocaleString('en-US', { maximumFractionDigits: 4 }),
        value: w.balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }),
        icon: w.icon,
        color: w.chain === 'EVM' ? 'from-blue-500/20 to-purple-500/20' :
            w.chain === 'Solana' ? 'from-emerald-900/20 to-teal-900/20' :
                'from-gray-700/50 to-gray-600/50'
    }))

    return (
        <div className="space-y-6">
            {/* Top Section: Balance & Chart */}
            {wallets.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Total Balance Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative p-6 rounded-2xl overflow-hidden border border-white/10 bg-gradient-to-br from-white/5 to-transparent backdrop-blur-xl flex flex-col justify-between"
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-20">
                            <img src={`${import.meta.env.BASE_URL}logo.png`} alt="bg" className="w-32 h-32 blur-xl" />
                        </div>

                        <div className="relative z-10 space-y-2 mb-6">
                            <div className="flex items-center gap-2 text-gray-400 text-sm">
                                <Wallet className="w-4 h-4" />
                                <span>Total Balance</span>
                            </div>
                            <h1 className="text-4xl font-bold tracking-tight text-white">{totalBalance}</h1>
                        </div>

                        <div className="flex gap-4">
                            <button
                                onClick={() => toggleSendModal()}
                                className="flex-1 flex items-center justify-center gap-2 bg-[#16161e] border border-white/10 hover:border-purple-500/50 py-3 rounded-xl text-white font-bold transition-all hover:shadow-[0_0_20px_rgba(168,85,247,0.15)] group text-sm"
                            >
                                <ArrowUpRight className="w-4 h-4 text-purple-400 group-hover:scale-110 transition-transform" />
                                Send
                            </button>
                            <button
                                onClick={() => toggleReceiveModal()}
                                className="flex-1 flex items-center justify-center gap-2 bg-[#16161e] border border-white/10 hover:border-blue-500/50 py-3 rounded-xl text-white font-bold transition-all hover:shadow-[0_0_20px_rgba(59,130,246,0.15)] group text-sm"
                            >
                                <ArrowDownLeft className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
                                Receive
                            </button>
                        </div>
                    </motion.div>

                    {/* Asset Allocation Chart */}
                    <DonutChart wallets={wallets} />
                </div>
            )}

            {/* Asset List */}
            <div className="space-y-4">
                <h2 className="text-xs font-bold text-gray-500 uppercase tracking-widest px-2">
                    {wallets.length > 0 ? 'Connected Assets' : ''}
                </h2>

                {wallets.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-12 px-4 space-y-6 text-center rounded-3xl border border-white/5 bg-gradient-to-b from-white/5 to-transparent backdrop-blur-md">
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-2">
                            <Wallet className="w-8 h-8 text-white/50" />
                        </div>
                        <p className="text-gray-400 max-w-sm text-lg font-medium leading-relaxed">
                            Connect your wallet to start using the <span className="text-white font-bold">POSTHUMAN App</span>
                        </p>
                        <button
                            onClick={() => toggleModal()}
                            className="flex items-center gap-2 bg-white text-black px-8 py-3 rounded-full font-bold hover:scale-105 hover:shadow-[0_0_20px_rgba(255,255,255,0.3)] transition-all active:scale-95"
                        >
                            <Wallet className="w-5 h-5" />
                            Connect Wallet
                        </button>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 gap-3 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                        {displayAssets.map((asset, i) => (
                            <motion.div
                                key={asset.id + i}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: i * 0.05 }}
                                onClick={() => toggleSendModal(asset.id)}
                                className={`flex items-center justify-between p-4 rounded-2xl border border-white/5 bg-gradient-to-r ${asset.color} hover:border-white/10 transition-all cursor-pointer group shadow-lg`}
                            >
                                <div className="flex items-center gap-4">
                                    <div className="w-12 h-12 rounded-full bg-black/40 flex items-center justify-center text-xl shadow-inner border border-white/5 overflow-hidden">
                                        {asset.icon && asset.icon.startsWith('/') ? (
                                            <img src={asset.icon} alt={asset.symbol} className="w-full h-full object-cover transform animate-image-reveal" />
                                        ) : (
                                            asset.icon
                                        )}
                                    </div>
                                    <div className="space-y-0.5">
                                        <h3 className="font-bold text-white group-hover:text-purple-400 transition-colors">{asset.symbol}</h3>
                                        <div className="text-[10px] text-gray-500 font-medium">
                                            {asset.chain === 'Cosmos' ? asset.name : `${asset.chain} • ${asset.name}`}
                                        </div>
                                    </div>
                                </div>

                                <div className="text-right">
                                    <div className="font-bold text-white text-lg leading-none">{asset.balance} <span className="text-[10px] text-gray-500">{asset.symbol}</span></div>
                                    <div className="text-xs text-gray-500 mt-1 font-mono">${asset.value}</div>
                                </div>
                            </motion.div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    )
}
