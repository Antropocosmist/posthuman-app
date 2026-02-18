
/**
 * Known scam NFT mint addresses and collection IDs.
 * This list should be updated periodically from external sources like Phantom's blocklist.
 * For now, we seed it with common patterns and a mechanism to filter.
 */
export const SCAM_MINT_BLOCKLIST = new Set<string>([
    // Add specific known scam mints here if encountered
]);

/**
 * Keywords in NFT name or description that strongly indicate a scam/spam NFT.
 * Examples: "Visit site", "Claim reward", "Voucher", "Gasless"
 */
export const SCAM_KEYWORDS = [
    "visit site",
    "claim reward",
    "claim now",
    "gasless",
    "voucher",
    "whitelist",
    "airdrop",
    "free mint",
    "access pass",
    "official site",
    "burn to claim",
    "reward credential",
    "usdc voucher",
    "usdt voucher",
    "sol voucher"
];

/**
 * Checks if an NFT is likely a scam based on its metadata.
 * @param nft The NFT object to check
 * @returns true if the NFT is considered a scam/spam
 */
export function isScamNFT(nft: { id: string; name: string; description?: string; collection?: { name?: string } }): boolean {
    // 1. Check Blocklist (Exact Match)
    if (SCAM_MINT_BLOCKLIST.has(nft.id)) {
        return true;
    }

    // 2. Check Name and Description for Scam Keywords
    const text = `${nft.name} ${nft.description || ''} ${nft.collection?.name || ''}`.toLowerCase();

    for (const keyword of SCAM_KEYWORDS) {
        if (text.includes(keyword)) {
            return true;
        }
    }

    // 3. Heuristics for "Website" URLs in name (common in scams)
    // e.g. "Go to bit.ly/...", "Visit claiming-site.com"
    if (/\b(http|https|www|com|org|net|xyz)\b/.test(nft.name.toLowerCase())) {
        return true;
    }

    return false;
}
