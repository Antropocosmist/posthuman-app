/// <reference types="vite/client" />

interface Window {
    ethereum?: any;
    solana?: any;
    keplr: any
    ethereum: any
    solflare: any
    phantom: any
    rabby: any
    adena: {
        AddEstablish: (appName: string) => Promise<any>
        GetAccount: () => Promise<any>
    };
    phantom?: any;
}
