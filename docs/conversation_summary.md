# Debugging Session Summary: OpenSea Listing Cancellation

## Context
- **App**: PostHuman App (Vite + React + Ethers v6).
- **Feature**: Canceling OpenSea NFT listings.
- **Chain**: Polygon (Matic).
- **Library**: `opensea-js` v8+, `ethers` v6.

## The Problem
When trying to cancel a listing on Polygon, the OpenSea SDK throws:
> `Error: Specified accountAddress is not available through wallet or provider: <ADDRESS>. Accounts available: none`

## Root Cause
The `opensea-js` SDK performs an internal check (`_requireAccountIsAvailable`) by querying the provider for accounts.
However, due to a compatibility issue or race condition, this internal query returns an empty list `[]`, even though `window.ethereum.request({ method: 'eth_requestAccounts' })` successfully returns the user's address in our own code.

## The Solution: Proxy Provider
To fix this, we must **force** the SDK to see the active account by wrapping `window.ethereum` in a `Proxy`. This Proxy intercepts `eth_accounts` calls and returns the known address, bypassing the faulty check.

## Status
- The text for the Proxy fix was prepared but **failed to apply/push** in the previous session due to a tool error.
- **IMMEDIATE ACTION REQUIRED**: The next agent must apply the Proxy implementation to `src/services/nft/opensea.ts`.

## Implementation Guide (Use this code)
In `cancelListing` method of `src/services/nft/opensea.ts`:

```typescript
// ... inside cancelListing, after verifying 'canonicalAccount' ...

// WRAP THE PROVIDER
const providerProxy = new Proxy(window.ethereum as any, {
    get(target, prop, receiver) {
        if (prop === 'request') {
            return async (args: any) => {
                // Intercept account requests
                if (args.method === 'eth_accounts' || args.method === 'eth_requestAccounts') {
                    return [canonicalAccount];
                }
                // Pass through everything else (signing, transactions)
                return target.request(args);
            };
        }
        return Reflect.get(target, prop, receiver);
    }
});

// INITIALIZE SDK WITH PROXY
const sdk = new OpenSeaSDK(providerProxy, {
    chain,
    apiKey: OPENSEA_API_KEY,
})

// EXECUTE
await sdk.cancelOrder({ orderHash: listingId, accountAddress: canonicalAccount });
```
