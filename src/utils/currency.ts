
// IBC Denom Mapping
const IBC_MAPPING: Record<string, string> = {
    // ATOM on Stargaze (channel-0) - Common hash
    'ibc/27394FB092D2ECCD56123C74F36E4C1F926001CEADA9CA97EA622B25F41E5EB2': 'ATOM',
    // User Reported Hash (likely specific channel/path)
    'ibc/9DF365E2C0EF4EA02FA771F638E6F566B96D7437704258E298F5670B8F804368': 'ATOM',
    // OSMO on Stargaze (channel-5)
    // OSMO on Stargaze (channel-5)
    'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE125678649524C4F84A58F9E': 'OSMO',
    // Lowercase version for safety
    'ibc/ed07a3391a112b175915cd8faf43a2da8e4790ede125678649524c4f84a58f9e': 'OSMO',
    'uatom': 'ATOM',
    'ustars': 'STARS',
    'uosmo': 'OSMO'
}

export const formatPrice = (amount: string | number | undefined, denom: string | undefined): string => {
    if (!amount) return ''

    let value = Number(amount)
    let symbol = denom || ''

    // Normalize denom (handle IBC hash casing if needed, though usually uppercase/lowercase mix)
    // We check exact match or case-insensitive match for basic denoms
    const normalizedDenom = denom?.toLowerCase() || ''

    // Check IBC Mapping
    // Try exact match first, then uppercase (standard IBC), then fully normalized (lowercase)
    let mappedSymbol = IBC_MAPPING[symbol] || IBC_MAPPING[symbol.toUpperCase()] || IBC_MAPPING[normalizedDenom];

    if (!mappedSymbol) {
        // Fallback checks
        if (normalizedDenom === 'ustars') mappedSymbol = 'STARS'
        if (normalizedDenom === 'uatom') mappedSymbol = 'ATOM'

        // Check for User's specific hash prefix if exact match failed (safety net)
        if (symbol.startsWith('ibc/9DF365E')) mappedSymbol = 'ATOM'

        // Safety check for OSMO (Stargaze)
        if (symbol.toUpperCase().startsWith('IBC/ED07A339')) mappedSymbol = 'OSMO'
    }

    if (mappedSymbol) {
        symbol = mappedSymbol
        // If it was a 'u' denom (micro), divide by 1M
        // Most IBC tokens on Cosmos are 6 decimals.
        // We assume conversion is needed if we mapped to STARS or ATOM from a raw hash/u-denom
        value = value / 1_000_000
    }

    // Format number: Max 2 decimals if integer-ish, else up to 6
    const formattedValue = value.toLocaleString(undefined, {
        maximumFractionDigits: value % 1 === 0 ? 0 : 2
    })

    return `${formattedValue} ${symbol}`
}
