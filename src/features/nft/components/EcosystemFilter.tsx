interface EcosystemFilterProps {
    activeEcosystem: 'stargaze' | 'evm' | 'solana' | 'all'
    onEcosystemChange: (ecosystem: 'stargaze' | 'evm' | 'solana' | 'all') => void
    nftCounts?: {
        stargaze: number
        evm: number
        solana: number
        all: number
    }
}

const ecosystems = [
    { id: 'all' as const, label: 'All Chains', icon: '🌐' },
    { id: 'stargaze' as const, label: 'Stargaze', icon: '⭐' },
    { id: 'evm' as const, label: 'EVM', icon: '⟠' },
    { id: 'solana' as const, label: 'Solana', icon: '◎' },
]

export function EcosystemFilter({ activeEcosystem, onEcosystemChange, nftCounts }: EcosystemFilterProps) {
    return (
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
            {ecosystems.map((ecosystem) => {
                const isActive = activeEcosystem === ecosystem.id
                const count = nftCounts?.[ecosystem.id]

                return (
                    <button
                        key={ecosystem.id}
                        onClick={() => onEcosystemChange(ecosystem.id)}
                        className={`
                            flex items-center gap-2 px-4 py-2.5 rounded-xl font-medium text-sm whitespace-nowrap transition-all
                            ${isActive
                                ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                                : 'bg-white/5 text-gray-400 hover:bg-white/10 hover:text-white'
                            }
                        `}
                    >
                        <span className="text-lg">{ecosystem.icon}</span>
                        <span>{ecosystem.label}</span>
                        {count !== undefined && count > 0 && (
                            <span className={`
                                px-2 py-0.5 rounded-full text-xs font-bold
                                ${isActive ? 'bg-white/20' : 'bg-white/10'}
                            `}>
                                {count}
                            </span>
                        )}
                    </button>
                )
            })}
        </div>
    )
}
