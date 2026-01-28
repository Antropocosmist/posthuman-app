import { useState } from 'react'
import { JumperTrade } from '../components/JumperTrade'
import { CosmosTrade } from '../components/CosmosTrade'

export function Trade() {
    const [tradeMode, setTradeMode] = useState<'cosmos' | 'evm'>('cosmos')

    return (
        <div className="max-w-md mx-auto relative pt-4 pb-20">
            {/* Top Level Tabs */}
            <div className="px-4 mb-6">
                <div className="flex p-1 bg-black/40 rounded-full border border-white/10">
                    <button
                        onClick={() => setTradeMode('cosmos')}
                        className={`flex-1 py-3 px-4 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${tradeMode === 'cosmos'
                                ? 'bg-blue-600 text-white shadow-lg'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Trade in Cosmos
                    </button>
                    <button
                        onClick={() => setTradeMode('evm')}
                        className={`flex-1 py-3 px-4 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${tradeMode === 'evm'
                                ? 'bg-purple-600 text-white shadow-lg'
                                : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Trade in EVM
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {tradeMode === 'cosmos' ? (
                <CosmosTrade />
            ) : (
                <div className="px-4">
                    <div className="text-center mb-6">
                        <h2 className="text-xl font-bold text-white mb-1">Cross-Chain Swap</h2>
                        <p className="text-xs text-purple-400 font-bold uppercase tracking-widest">Powered by Jumper</p>
                    </div>
                    <JumperTrade />
                </div>
            )}
        </div>
    )
}
