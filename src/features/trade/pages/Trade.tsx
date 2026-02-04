import { useState } from 'react'
import { JumperTrade } from '../components/JumperTrade'
import { CosmosTrade } from '../cosmos/components/CosmosTrade'

export function Trade() {
    const [tradeMode, setTradeMode] = useState<'cosmos' | 'evm' | 'solana' | 'refuel'>('cosmos')

    return (
        <div className="max-w-md mx-auto relative pt-4 pb-20">
            {/* Top Level Tabs */}
            <div className="px-4 mb-6">
                <div className="grid grid-cols-2 gap-2 p-1 bg-black/40 rounded-2xl border border-white/10">
                    <button
                        onClick={() => setTradeMode('cosmos')}
                        className={`py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${tradeMode === 'cosmos'
                            ? 'bg-blue-600 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Trade in Cosmos
                    </button>
                    <button
                        onClick={() => setTradeMode('evm')}
                        className={`py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${tradeMode === 'evm'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Trade in EVM
                    </button>
                    <button
                        onClick={() => setTradeMode('solana')}
                        className={`py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${tradeMode === 'solana'
                            ? 'bg-gradient-to-r from-purple-500 to-cyan-500 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Trade in Solana
                    </button>
                    <button
                        onClick={() => setTradeMode('refuel')}
                        className={`py-3 px-4 rounded-xl text-sm font-bold uppercase tracking-wider transition-all ${tradeMode === 'refuel'
                            ? 'bg-gradient-to-r from-orange-500 to-yellow-500 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Gas Refuel
                    </button>
                </div>
            </div>

            {/* Content Area */}
            {tradeMode === 'cosmos' ? (
                <CosmosTrade />
            ) : tradeMode === 'evm' ? (
                <div className="px-4">
                    <JumperTrade />
                </div>
            ) : tradeMode === 'solana' ? (
                <div className="px-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4">🚀</div>
                        <h3 className="text-xl font-bold text-white mb-2">Solana Trading</h3>
                        <p className="text-gray-400">Coming soon! Trade SOL and SPL tokens.</p>
                    </div>
                </div>
            ) : (
                <div className="px-4">
                    <div className="bg-white/5 border border-white/10 rounded-2xl p-8 text-center">
                        <div className="text-6xl mb-4">⛽</div>
                        <h3 className="text-xl font-bold text-white mb-2">Gas Refuel</h3>
                        <p className="text-gray-400">Coming soon! Refuel gas across multiple chains.</p>
                    </div>
                </div>
            )}
        </div>
    )
}
