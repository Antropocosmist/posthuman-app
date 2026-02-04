# Debugging Session Summary: OpenSea Listing Cancellation

## Context
- **App**: PostHuman App (Vite + React + Ethers v6).
- **Feature**: Canceling OpenSea NFT listings.
- **Chain**: Polygon (Matic).
- **Library**: `opensea-js` v8+, `ethers` v6.

## The Problem
When trying to cancel a listing on Polygon, the OpenSea SDK throws the following error:
> `Error: Specified accountAddress is not available through wallet or provider: <CHECKSUMMED_ADDRESS>. Accounts available: none`

## Current Implementation State
- File: `src/services/nft/opensea.ts`
- Method: `cancelListing`
- We are initializing the SDK using `window.ethereum` (to support Seaport transactions).
- We explicitly call `eth_requestAccounts` and `wallet_switchEthereumChain` *before* initializing the SDK.
- We pass the **canonical address** (found from `eth_requestAccounts`) to the `cancelOrder` method.

## What We Have Tried
1.  **Using `signer`**: Passed `ethers.Signer` to `OpenSeaSDK`.
    *   *Result*: SDK initialized, but `cancelOrder` hung indefinitely (likely because `Signer` doesn't implement the full JSON-RPC provider methods needed for Seaport).
2.  **Using `window.ethereum`**: Passed `window.ethereum` to `OpenSeaSDK`.
    *   *Result*: "Specified accountAddress is not available".
3.  **Forcing Auth**: Manually called `eth_requestAccounts` before SDK init.
    *   *Result*: Same error. The log shows "Accounts available: none", implying the SDK's internal provider call to `eth_accounts` returns an empty list.

## Technical Findings
- We checked `node_modules/opensea-js/src/sdk.ts` and found the error comes from `_requireAccountIsAvailable`.
- It calls `this.web3.eth.getAccounts()` (or equivalent internal method) and checks if `accountAddress` is in the list.
- **Crucial Observation**: Even though we can fetch accounts in our code, the SDK *cannot* see them. This suggests a mismatch in the provider wrapper or a race condition where the SDK's internal provider state is stale/empty.

## Suggested Next Steps
1.  **Mock/Proxy the Provider**: Instead of passing `window.ethereum` directly, pass a Proxy object that intercepts `eth_accounts` and forces it to return the connected address. This bypasses the SDK's broken check.
2.  **Downgrade/Upgrade SDK**: Check if this is a known issue with `opensea-js` v8 + Ethers v6 compatibility.
3.  **Debug SDK Provider**: Add logs *inside* `node_modules/opensea-js` to see exactly what provider it is using and what `eth_accounts` returns at runtime.
