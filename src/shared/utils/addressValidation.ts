/**
 * Address validation utilities for different blockchain networks
 */

/**
 * Validate Cosmos/Stargaze address (Bech32 format)
 * Format: stars1... (39-59 characters)
 */
export const validateStargazeAddress = (address: string): boolean => {
    if (!address) return false

    // Stargaze addresses start with "stars1"
    if (!address.startsWith('stars1')) return false

    // Bech32 addresses are typically 39-59 characters
    if (address.length < 39 || address.length > 59) return false

    // Bech32 uses lowercase alphanumeric characters (excluding 1, b, i, o)
    const bech32Regex = /^stars1[qpzry9x8gf2tvdw0s3jn54khce6mua7l]+$/
    return bech32Regex.test(address)
}

/**
 * Validate EVM address (Ethereum, Polygon, etc.)
 * Format: 0x... (42 characters, hexadecimal)
 */
export const validateEvmAddress = (address: string): boolean => {
    if (!address) return false

    // EVM addresses start with "0x" and are 42 characters long
    if (!address.startsWith('0x')) return false
    if (address.length !== 42) return false

    // Must be valid hexadecimal
    const hexRegex = /^0x[0-9a-fA-F]{40}$/
    return hexRegex.test(address)
}

/**
 * Validate Solana address (Base58 format)
 * Format: 32-44 characters, base58 encoded
 */
export const validateSolanaAddress = (address: string): boolean => {
    if (!address) return false

    // Solana addresses are typically 32-44 characters
    if (address.length < 32 || address.length > 44) return false

    // Base58 alphabet (no 0, O, I, l)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/
    return base58Regex.test(address)
}

/**
 * Validate address based on chain type
 */
export const validateAddress = (address: string, chain: string): { valid: boolean; error?: string } => {
    if (!address || !address.trim()) {
        return { valid: false, error: 'Address is required' }
    }

    const trimmedAddress = address.trim()

    switch (chain.toLowerCase()) {
        case 'stargaze':
            if (!validateStargazeAddress(trimmedAddress)) {
                return {
                    valid: false,
                    error: 'Invalid Stargaze address. Must start with "stars1" and be 39-59 characters.'
                }
            }
            return { valid: true }

        case 'ethereum':
        case 'polygon':
        case 'base':
        case 'arbitrum':
        case 'optimism':
        case 'bsc':
        case 'gnosis':
            if (!validateEvmAddress(trimmedAddress)) {
                return {
                    valid: false,
                    error: 'Invalid EVM address. Must start with "0x" and be 42 characters (hexadecimal).'
                }
            }
            return { valid: true }

        case 'solana':
            if (!validateSolanaAddress(trimmedAddress)) {
                return {
                    valid: false,
                    error: 'Invalid Solana address. Must be 32-44 characters (base58 encoded).'
                }
            }
            return { valid: true }

        default:
            return {
                valid: false,
                error: `Address validation not supported for ${chain}`
            }
    }
}
