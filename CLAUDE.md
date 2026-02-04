# POSTHUMAN App - Development Context for Claude

**Last Updated:** 2026-02-05  
**Project:** POSTHUMAN App - Multi-chain NFT & DeFi Platform  
**Repository:** https://github.com/Antropocosmist/posthuman-app.git  
**Latest Commit:** `9fd2385` (2026-02-05)

---

## Project Overview

POSTHUMAN App is a comprehensive multi-chain platform supporting:
- **NFT Management** (Stargaze, Ethereum, Polygon, Base, Solana)
- **DeFi Trading** (Swap, Bridge, IBC transfers)
- **Wallet Integration** (Keplr, Adena, MetaMask, Phantom)

**Tech Stack:**
- React + TypeScript + Vite
- Zustand (State Management)
- TailwindCSS (Styling)
- OpenSea SDK, Stargaze GraphQL, Magic Eden API

---

## Recent Work Summary (2026-02-05)

### 1. NFT Auction Functionality (Stargaze)
**Status:** ✅ Complete - Commit `1545916`

**What Was Built:**
- Two-message transaction system (Approve + Create Auction)
- Auction form UI with reserve price, currency selector (STARS/OSMO/ATOM), and duration options
- 5 STARS listing fee included in transaction
- Currency to IBC denom conversion
- Expiration time calculation with 5-minute buffer

**Files Modified:**
- `src/features/nft/cosmos/services/stargaze.ts` - Added `createAuction` method
- `src/features/nft/store/nftStore.ts` - Added `createAuction` action
- `src/features/nft/components/NFTDetailModal.tsx` - Added auction form UI

**Key Implementation Details:**
```typescript
// Auction contract and fee
const STARGAZE_AUCTION_CONTRACT = 'stars1lffsns76e9dg8tf2s779dvjyfu3sgn94l8e8vx24jy8s3lza0t3qf7ckxj'
const AUCTION_LISTING_FEE = '5000000' // 5 STARS in ustars

// Currency mapping
const CURRENCY_TO_DENOM = {
  'STARS': 'ustars',
  'OSMO': 'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518',
  'ATOM': 'ibc/9DF365E2C0EF4EA02FA771F638E6F566B96D7437704258E298F5670B8F804368'
}
```

---

### 2. EVM Listed NFTs Display Fix
**Status:** ✅ Complete - Commit `4bcc7f3`

**Problem:** EVM NFTs listed on OpenSea weren't showing in "Listed NFTs" tab

**Root Cause:** OpenSea `/account/{address}/nfts` endpoint doesn't include `sell_orders`

**Solution:**
- Added `fetchUserListings` method to fetch active listings separately
- Merged listings with owned NFTs to mark them as listed
- Handles escrowed NFTs (listed but not in wallet)

**Files Modified:**
- `src/features/nft/evm/services/opensea.ts` - Added `fetchUserListings` method
- `src/features/nft/store/nftStore.ts` - Updated EVM fetching to merge listings

**API Endpoints Used:**
```
GET https://api.opensea.io/api/v2/chain/{chain}/account/{address}/nfts
GET https://api.opensea.io/api/v2/orders/{chain}/seaport/listings?maker={address}
```

**Supported Chains:** Ethereum, Polygon, Base

---

### 3. EVM NFT Traits Display
**Status:** ✅ Complete - Commit `9fd2385`

**Problem:** EVM NFTs weren't showing traits in the NFT detail modal

**Root Cause:** OpenSea API returns traits in different formats (`traits`, `attributes`, `metadata.attributes`)

**Solution:**
- Enhanced traits extraction to handle all API response formats
- Added debug logging to track traits data structure
- Increased API limit to 200 NFTs per request

**Files Modified:**
- `src/features/nft/evm/services/opensea.ts` - Improved traits extraction

**Code Change:**
```typescript
// Before
traits: openseaNFT.traits?.map(...) || []

// After
traits: (openseaNFT.traits || openseaNFT.attributes || openseaNFT.metadata?.attributes || [])
  .map((trait: any) => ({
    trait_type: trait.trait_type || trait.key,
    value: trait.value,
    display_type: trait.display_type,
  }))
```

---

## Project Structure

```
posthuman-app/
├── src/
│   ├── features/
│   │   ├── nft/
│   │   │   ├── cosmos/services/stargaze.ts      # Stargaze NFT service
│   │   │   ├── evm/services/opensea.ts          # OpenSea NFT service
│   │   │   ├── solana/services/magiceden.ts     # Magic Eden service
│   │   │   ├── store/nftStore.ts                # NFT state management
│   │   │   ├── components/NFTDetailModal.tsx    # NFT detail modal
│   │   │   └── types/types.ts                   # NFT type definitions
│   │   ├── trader/ (DeFi features)
│   │   └── wallet/ (Wallet management)
│   ├── services/
│   │   ├── skip.ts                              # Skip Protocol (IBC)
│   │   └── rpc.ts                               # RPC endpoints
│   └── components/ (Shared UI components)
```

---

## Key Services & APIs

### Stargaze (Cosmos)
- **GraphQL:** `https://graphql.mainnet.stargaze-apis.com/graphql`
- **RPC:** `https://rpc.stargaze-apis.com`
- **Marketplace Contract:** `stars1e6g3yhasf7cr2vnae7qxytrys4e8v8wchyj377juvxfk9k6t695s38jkgw`
- **Auction Contract:** `stars1lffsns76e9dg8tf2s779dvjyfu3sgn94l8e8vx24jy8s3lza0t3qf7ckxj`

### OpenSea (EVM)
- **API:** `https://api.opensea.io/api/v2/`
- **API Key:** Required for listings endpoint
- **Supported Chains:** ethereum, polygon, base, bsc, arbitrum, gnosis

### Magic Eden (Solana)
- **API:** Magic Eden API v2

---

## NFT Features Status

### Implemented ✅
- [x] Fetch owned NFTs (Stargaze, EVM, Solana)
- [x] Fetch marketplace listings
- [x] Buy NFTs
- [x] List NFTs for sale
- [x] Cancel listings
- [x] Transfer NFTs
- [x] Burn NFTs (Stargaze)
- [x] Create auctions (Stargaze)
- [x] Display traits (All chains)
- [x] Display floor prices
- [x] Listed NFTs tab (All chains)

### Action Buttons by Chain

**Stargaze NFTs:**
- Sell (List on marketplace)
- Auction (Create auction)
- Send (Transfer)
- Burn (Destroy)

**EVM NFTs:**
- Sell (List on OpenSea)
- Send (Transfer)

**Solana NFTs:**
- Sell (List on Magic Eden)
- Send (Transfer)

---

## Important Implementation Patterns

### 1. Two-Message Transactions (Stargaze)
Used for auctions and some marketplace operations:
```typescript
const messages = [
  approveMessage,    // Approve contract to manage NFT
  actionMessage      // Perform the action (auction, list, etc.)
]
await signingClient.signAndBroadcast(address, messages, 'auto', memo)
```

### 2. Wallet Connection
- **Cosmos:** Keplr, Adena
- **EVM:** MetaMask (window.ethereum)
- **Solana:** Phantom

### 3. State Management (Zustand)
```typescript
// NFT Store
const useNFTStore = create<NFTStore>((set, get) => ({
  ownedNFTs: [],
  marketplaceNFTs: [],
  isLoadingOwned: false,
  // ... actions
}))
```

### 4. Chain-Specific Logic
```typescript
switch (nft.chain) {
  case "stargaze":
    return await stargazeNFTService.method(...)
  case "ethereum":
  case "polygon":
  case "base":
    return await openSeaNFTService.method(...)
  case "solana":
    return await magicEdenNFTService.method(...)
}
```

---

## Known Issues & Limitations

### Current Limitations
1. **OpenSea API Key Required** for fetching user listings (orders endpoint)
2. **Pagination** - Currently limited to 200 NFTs per chain
3. **Auction Management** - Can create auctions but can't cancel/update yet
4. **Bidding** - Not implemented yet

### Future Enhancements
- [ ] Auction bidding functionality
- [ ] Auction cancellation/updates
- [ ] Batch operations (list/transfer multiple NFTs)
- [ ] NFT analytics dashboard
- [ ] Trait-based filtering and search
- [ ] Collection-level stats and insights
- [ ] Support for more EVM chains (Optimism, Avalanche)

---

## Development Workflow

### Build & Deploy
```bash
npm run build          # Build for production
git add -A
git commit -m "..."
git push origin main   # Auto-deploys via GitHub Actions
```

### Testing
- Build verification after each change
- Manual testing in browser
- Console log inspection for API responses

### Commit Message Format
```
type(scope): description

- Detailed change 1
- Detailed change 2
- Technical details
```

**Types:** feat, fix, refactor, docs, style, test, chore

---

## Environment Variables

Required in `.env`:
```
VITE_OPENSEA_API_KEY=your_opensea_api_key
```

---

## User Preferences

Based on conversation history:
1. **Auto-apply edits** - Always push updates to GitHub
2. **Detailed commit messages** - Include technical details
3. **Comprehensive documentation** - Implementation plans and walkthroughs
4. **Match existing patterns** - Follow Stargaze implementation for new features

---

## Next Session Priorities

### Potential Tasks
1. **Auction Bidding** - Allow users to bid on Stargaze auctions
2. **Auction Management** - Cancel/update existing auctions
3. **More EVM Chains** - Add support for Optimism, Arbitrum (full support)
4. **NFT Analytics** - Collection stats, trait rarity, price history
5. **Batch Operations** - List/transfer multiple NFTs at once
6. **Mobile Optimization** - Improve mobile UX

### Quick Wins
- Add auction expiration countdown in UI
- Add "Copy Address" button in NFT detail modal
- Add NFT share functionality
- Improve error messages for failed transactions

---

## Useful Commands

```bash
# Development
npm run dev

# Build
npm run build

# Git
git status
git log --oneline -10
git diff

# Check latest deployment
# GitHub Actions automatically deploys on push to main
```

---

## Contact & Resources

- **GitHub Repo:** https://github.com/Antropocosmist/posthuman-app
- **Stargaze Docs:** https://docs.stargaze.zone/
- **OpenSea API Docs:** https://docs.opensea.io/reference/api-overview
- **Skip Protocol Docs:** https://docs.skip.build/

---

## Session Notes

**Date:** 2026-02-05  
**Duration:** ~2 hours  
**Commits:** 3 (1545916, 4bcc7f3, 9fd2385)  
**Features Completed:** 3 (Auctions, Listed NFTs fix, Traits display)  
**Status:** All builds successful, all changes deployed ✅

**Key Learnings:**
1. OpenSea API v2 has inconsistent response formats - always check multiple fields
2. Two-message transactions require careful expiration time management
3. IBC denoms are long and need to be mapped to user-friendly currency codes
4. Traits can be in `traits`, `attributes`, or `metadata.attributes` fields

---

**Ready for next session! 🚀**
