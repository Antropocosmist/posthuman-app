/**
 * EIP-6963 Multi-Injected Provider Discovery Types
 * Dependencies: none (pure TypeScript types)
 * Spec: https://eips.ethereum.org/EIPS/eip-6963
 */

export interface EIP6963ProviderInfo {
    uuid: string
    name: string
    icon: string
    rdns: string
}

export interface EIP6963ProviderDetail {
    info: EIP6963ProviderInfo
    provider: any
}

export interface EIP6963AnnounceProviderEvent extends CustomEvent {
    detail: {
        info: EIP6963ProviderInfo
        provider: any
    }
}
