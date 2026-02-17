export interface EIP6963ProviderInfo {
    uuid: string;
    name: string;
    icon: string;
    rdns: string;
}

export interface EIP6963ProviderDetail {
    info: EIP6963ProviderInfo;
    provider: any;
}

interface EIP6963AnnounceProviderEvent extends CustomEvent {
    detail: {
        info: EIP6963ProviderInfo;
        provider: any;
    };
}

// Global map to store discovered providers
// We store by name (lowercase) and by rdns
const discoveredProviders = new Map<string, EIP6963ProviderDetail>();

// Initialize listener immediately
if (typeof window !== 'undefined') {
    window.addEventListener('eip6963:announceProvider', ((event: EIP6963AnnounceProviderEvent) => {
        const { info, provider } = event.detail;

        // Store by name (e.g. "keplr")
        discoveredProviders.set(info.name.toLowerCase(), { info, provider });

        // Store by rdns (e.g. "io.keplr")
        discoveredProviders.set(info.rdns, { info, provider });

        console.log(`[EIP-6963] Discovered Provider: ${info.name} (${info.rdns})`);
    }) as EventListener);

    // Initial request in case this module loads after some announcements
    setTimeout(() => {
        window.dispatchEvent(new Event('eip6963:requestProvider'));
    }, 100);
}

/**
 * Request providers to announce themselves again
 */
export function requestEIP6963Providers() {
    if (typeof window !== 'undefined') {
        window.dispatchEvent(new Event('eip6963:requestProvider'));
    }
}

/**
 * Get a discovered provider immediately
 * @param nameOrRdns Provider name (e.g. 'Keplr') or RDNS (e.g. 'io.keplr')
 */
export function getEIP6963Provider(nameOrRdns: string): any {
    const key = nameOrRdns.toLowerCase();
    // Try exact match first
    let detail = discoveredProviders.get(key);

    // If not found, try to search values if key is not rdns/name
    if (!detail) {
        // This linear search is fallback
        for (const d of discoveredProviders.values()) {
            if (d.info.name.toLowerCase() === key || d.info.rdns === key) {
                return d.provider;
            }
        }
    }

    return detail?.provider;
}

/**
 * Wait for a provider to be announced
 * @param nameOrRdns Provider name or RDNS
 * @param timeoutMs Max wait time in ms (default 1000)
 */
export async function waitForProvider(nameOrRdns: string, timeoutMs: number = 1000): Promise<any> {
    const provider = getEIP6963Provider(nameOrRdns);
    if (provider) return provider;

    return new Promise((resolve) => {
        // Trigger a request
        requestEIP6963Providers();

        const checkInterval = setInterval(() => {
            const p = getEIP6963Provider(nameOrRdns);
            if (p) {
                clearInterval(checkInterval);
                resolve(p);
            }
        }, 100);

        setTimeout(() => {
            clearInterval(checkInterval);
            // resolve undefined if not found
            resolve(getEIP6963Provider(nameOrRdns));
        }, timeoutMs);
    });
}
