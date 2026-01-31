import type { NFT } from '../../services/nft/types'

interface NFTCardProps {
    nft: NFT
    onClick: () => void
}

export function NFTCard({ nft, onClick }: NFTCardProps) {
    return (
        <div
            onClick={onClick}
            className="group relative bg-[#14141b] rounded-2xl overflow-hidden border border-white/5 hover:border-purple-500/50 transition-all duration-300 cursor-pointer hover:scale-[1.02]"
        >
            {/* NFT Image */}
            <div className="aspect-square relative overflow-hidden bg-black/20">
                {nft.image ? (
                    <img
                        src={nft.image}
                        alt={nft.name}
                        className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        loading="lazy"
                    />
                ) : (
                    <div className="w-full h-full flex items-center justify-center text-gray-600">
                        <span className="text-4xl">🖼️</span>
                    </div>
                )}

                {/* Marketplace Badge */}
                {nft.marketplace && (
                    <div className="absolute top-2 right-2 px-2 py-1 rounded-lg bg-black/80 backdrop-blur-sm border border-white/10">
                        <span className="text-xs font-medium text-white capitalize">
                            {nft.marketplace}
                        </span>
                    </div>
                )}

                {/* Listed Badge */}
                {nft.isListed && nft.listingPrice && (
                    <div className="absolute bottom-2 left-2 px-3 py-1.5 rounded-lg bg-purple-600/90 backdrop-blur-sm">
                        <span className="text-xs font-bold text-white">
                            {nft.listingPrice} {nft.listingCurrency?.toUpperCase() || 'STARS'}
                        </span>
                    </div>
                )}
            </div>

            {/* NFT Info */}
            <div className="p-4">
                <h3 className="font-bold text-white text-sm mb-1 truncate group-hover:text-purple-400 transition-colors">
                    {nft.name}
                </h3>
                <p className="text-xs text-gray-400 truncate">
                    {nft.collection.name}
                </p>

                {/* Floor Price */}
                {nft.collection.floorPrice && (
                    <div className="mt-2 pt-2 border-t border-white/5">
                        <p className="text-xs text-gray-500">
                            Floor: <span className="text-white font-medium">{nft.collection.floorPrice}</span>
                        </p>
                    </div>
                )}
            </div>
        </div>
    )
}
