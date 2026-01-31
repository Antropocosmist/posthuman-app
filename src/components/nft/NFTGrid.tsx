import type { NFT } from '../../services/nft/types'
import { NFTCard } from './NFTCard'

interface NFTGridProps {
    nfts: NFT[]
    isLoading: boolean
    onNFTClick: (nft: NFT) => void
    emptyMessage?: string
}

export function NFTGrid({ nfts, isLoading, onNFTClick, emptyMessage = 'No NFTs found' }: NFTGridProps) {
    if (isLoading) {
        return (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                {Array.from({ length: 10 }).map((_, i) => (
                    <div
                        key={i}
                        className="aspect-square bg-[#14141b] rounded-2xl border border-white/5 animate-pulse"
                    >
                        <div className="w-full h-full flex items-center justify-center">
                            <div className="w-12 h-12 border-4 border-purple-500/20 border-t-purple-500 rounded-full animate-spin" />
                        </div>
                    </div>
                ))}
            </div>
        )
    }

    if (nfts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <div className="w-24 h-24 rounded-full bg-white/5 flex items-center justify-center mb-4">
                    <span className="text-5xl">🖼️</span>
                </div>
                <p className="text-gray-400 text-lg">{emptyMessage}</p>
            </div>
        )
    }

    return (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {nfts.map((nft) => (
                <NFTCard
                    key={nft.id}
                    nft={nft}
                    onClick={() => onNFTClick(nft)}
                />
            ))}
        </div>
    )
}
