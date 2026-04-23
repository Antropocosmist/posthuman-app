import { motion } from 'framer-motion'
import { useWalletStore } from '../../features/wallet/store/walletStore'

export function LoadingOverlay() {
    const { isLoading } = useWalletStore()

    if (!isLoading) return null

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/80 backdrop-blur-sm">
            <motion.div
                animate={{
                    scale: [1, 1.2, 1],
                    opacity: [0.5, 1, 0.5],
                }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
                className="relative w-24 h-24 flex items-center justify-center"
            >
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-full" />
                <img
                    src={`${import.meta.env.BASE_URL}logo.png`}
                    alt="Loading..."
                    className="w-16 h-16 object-contain relative z-10"
                />
            </motion.div>
            <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="absolute mt-32 text-gray-400 font-medium tracking-wide animate-pulse"
            >
                Processing...
            </motion.p>
        </div>
    )
}
