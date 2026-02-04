import { motion } from 'framer-motion'
import { ArrowRight, ExternalLink, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react'
import { useWalletStore } from '../../wallet/store/walletStore'
import { formatDistanceToNow } from 'date-fns'

export function TradeHistory() {
    const { trades } = useWalletStore()

    const getExplorerLink = (chainId: string, txHash: string) => {
        // Cosmos Chains (Mintscan)
        const mintscanSlugs: Record<string, string> = {
            'cosmoshub-4': 'cosmos',
            'osmosis-1': 'osmosis',
            'juno-1': 'juno',
            'neutron-1': 'neutron',
            'atomone-1': 'atomone', // Verify if supported or assume generic
            'stargaze-1': 'stargaze',
            'noble-1': 'noble',
            'chihuahua-1': 'chihuahua',
            'celestia': 'celestia',
            'dydx-mainnet-1': 'dydx'
        }

        if (mintscanSlugs[chainId]) {
            return `https://www.mintscan.io/${mintscanSlugs[chainId]}/tx/${txHash}`
        }

        // EVM Chains
        if (chainId === '0x1') return `https://etherscan.io/tx/${txHash}`
        if (chainId === '0x38') return `https://bscscan.com/tx/${txHash}`
        if (chainId === '0x89') return `https://polygonscan.com/tx/${txHash}`
        if (chainId === '0xa4b1') return `https://arbiscan.io/tx/${txHash}`
        if (chainId === '0x2105') return `https://basescan.org/tx/${txHash}`

        // Solana
        if (chainId === 'solana') return `https://solscan.io/tx/${txHash}`

        // Fallback for unknown Cosmos chains (try direct chainId or Mintscan search)
        // If it starts with 'osmo' etc we might guess, but the map covers main ones.
        return `https://www.mintscan.io/${chainId}/tx/${txHash}`
    }

    if (trades.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 text-gray-700">
                <Clock className="w-12 h-12 mb-4 opacity-20" />
                <div className="text-xs font-black uppercase tracking-widest opacity-50 text-center">No trades yet</div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {trades.map((trade) => (
                <motion.div
                    key={trade.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-5 rounded-[1.5rem] bg-[#14141b] border border-white/5 hover:border-white/10 transition-all group"
                >
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-2">
                            <span className={`px-2 py-1 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ${trade.status === 'completed' ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'
                                }`}>
                                {trade.status === 'completed' ? <CheckCircle2 className="w-3 h-3" /> : <AlertTriangle className="w-3 h-3" />}
                                {trade.status === 'completed' ? 'Success' : 'Failed'}
                            </span>
                            <span className="text-[10px] text-gray-600 font-bold">
                                {formatDistanceToNow(trade.timestamp, { addSuffix: true })}
                            </span>
                        </div>
                        {trade.txHash && (
                            <a
                                href={getExplorerLink(trade.sourceAsset.chainId, trade.txHash)}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-blue-500 hover:text-blue-400 transition-colors"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                    </div>

                    <div className="flex items-center justify-between">
                        {/* Source */}
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-black/40 border border-white/10">
                                    <img src={trade.sourceAsset.logo} className="w-full h-full object-cover" />
                                </div>
                                <span className="text-sm font-bold text-white">{trade.sourceAsset.symbol}</span>
                            </div>
                            <span className="text-xs font-mono text-gray-400 pl-8">
                                -{parseFloat(trade.sourceAsset.amount).toFixed(4)}
                            </span>
                        </div>

                        <ArrowRight className="w-4 h-4 text-gray-700" />

                        {/* Dest */}
                        <div className="flex flex-col gap-1 items-end">
                            <div className="flex items-center gap-2">
                                <span className="text-sm font-bold text-white">{trade.destAsset.symbol}</span>
                                <div className="w-6 h-6 rounded-full overflow-hidden bg-black/40 border border-white/10">
                                    <img src={trade.destAsset.logo} className="w-full h-full object-cover" />
                                </div>
                            </div>
                            <span className="text-xs font-mono text-blue-400 pr-8">
                                +{parseFloat(trade.destAsset.amount).toFixed(4)}
                            </span>
                        </div>
                    </div>

                    <div className="mt-4 pt-4 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[9px] font-black uppercase tracking-widest text-gray-600">Value at Trade</span>
                        <span className="text-xs font-bold text-gray-400">
                            {trade.usdValue.toLocaleString('en-US', { style: 'currency', currency: 'USD' })}
                        </span>
                    </div>
                </motion.div>
            ))}
        </div>
    )
}
