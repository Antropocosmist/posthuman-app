import { useState } from 'react'

export function PHMN() {
    const [activeTab, setActiveTab] = useState<'liquidity' | 'quests' | 'shop'>('liquidity')

    return (
        <div className="max-w-md mx-auto relative pt-4 pb-20">
            {/* Top Level Tabs */}
            <div className="px-4 mb-6">
                <div className="flex p-1 bg-black/40 rounded-full border border-white/10">
                    <button
                        onClick={() => setActiveTab('liquidity')}
                        className={`flex-1 py-3 px-4 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'liquidity'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Liquidity
                    </button>
                    <button
                        onClick={() => setActiveTab('quests')}
                        className={`flex-1 py-3 px-4 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'quests'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Quests
                    </button>
                    <button
                        onClick={() => setActiveTab('shop')}
                        className={`flex-1 py-3 px-4 rounded-full text-sm font-bold uppercase tracking-wider transition-all ${activeTab === 'shop'
                            ? 'bg-purple-600 text-white shadow-lg'
                            : 'text-gray-500 hover:text-white hover:bg-white/5'
                            }`}
                    >
                        Shop
                    </button>
                </div>
            </div>

            {/* Content Area */}
            <div className="px-4">
                {activeTab === 'liquidity' && (
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-white mb-2">Liquidity Management</h2>
                        <p className="text-gray-400">Osmosis, Astroport, and other DEX integrations</p>
                    </div>
                )}
                {activeTab === 'quests' && (
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-white mb-2">Engagement Features</h2>
                        <p className="text-gray-400">Daily/weekly/monthly quests and tasks</p>
                    </div>
                )}
                {activeTab === 'shop' && (
                    <div className="text-center py-12">
                        <h2 className="text-2xl font-bold text-white mb-2">Shop</h2>
                        <p className="text-gray-400">Digital gallery and merchandise store</p>
                    </div>
                )}
            </div>
        </div>
    )
}
