---
name: tech-stack-master
description: |
  The authoritative style guide and coding standards knowledge package for the POSTHUMAN app.
  Contains formatting rules, architectural patterns, naming conventions, and best practices
  specific to the POSTHUMAN tech stack: React 19 + TypeScript + Vite + TailwindCSS + Zustand
  + Framer Motion + CosmJS + Solana/web3.js + Ethers.js + React Router v7.
  Use when: writing any new code for POSTHUMAN, reviewing code for style compliance,
  onboarding a new agent onto the project, setting up a code generation prompt, or when
  the user says "follow our style", "use our patterns", "POSTHUMAN conventions", or
  "consistent with existing code".
---

# Tech-Stack Master — POSTHUMAN Edition

You are the **Keeper of Standards** for the POSTHUMAN app. Every line of code you write or
review must conform to these guidelines. When in doubt, read existing code first and match it.

---

## 1. Project Identity

| Property | Value |
|---|---|
| **App Name** | posthuman-app |
| **Repo** | `Antropocosmist/posthuman-app` |
| **Deploy Target** | GitHub Pages (`https://antropocosmist.github.io/posthuman-app`) |
| **Package Manager** | `npm` |
| **Node Runtime** | Current LTS |

---

## 2. Tech Stack

| Layer | Technology | Version |
|---|---|---|
| **UI Framework** | React | ^19.2.0 |
| **Language** | TypeScript | ~5.9.3 |
| **Build Tool** | Vite | ^7.x |
| **Styling** | TailwindCSS | ^3.4.1 |
| **Animation** | Framer Motion | ^12.x |
| **Icons** | lucide-react | latest |
| **State Management** | Zustand | ^5.x |
| **Routing** | React Router | ^7.x |
| **Class Merging** | clsx + tailwind-merge | latest |
| **Cosmos Blockchain** | @cosmjs/cosmwasm-stargate, @cosmjs/stargate | ^0.38.x |
| **Solana Blockchain** | @solana/web3.js | ^1.x |
| **EVM Blockchain** | ethers | ^6.x |
| **QR Codes** | qrcode.react | ^4.x |

---

## 3. File & Folder Structure

```
src/
├── assets/          # Static assets (images, icons, fonts)
├── components/      # Reusable UI components (shared across pages)
│   └── ComponentName/
│       ├── index.ts          # Barrel export
│       ├── ComponentName.tsx # Main component
│       └── ComponentName.types.ts  # Local types (optional)
├── pages/           # Route-level page components
│   └── PageName/
│       └── PageName.tsx
├── services/        # External API calls, blockchain interactions, data fetching
│   └── feature.service.ts
├── store/           # Zustand stores
│   └── useFeatureStore.ts
├── App.tsx          # Root component + router
├── main.tsx         # Entry point
└── index.css        # Global styles + Tailwind directives
```

**Rules:**
- **One component per file** — never put two exported components in one `.tsx` file
- **Barrel exports** — every component folder should have an `index.ts`
- **Co-locate tests** — `ComponentName.test.tsx` next to `ComponentName.tsx` (when tests exist)

---

## 4. TypeScript Standards

### Strict Rules
```json
// tsconfig.app.json — respect these settings
{
  "strict": true,
  "noUnusedLocals": true,
  "noUnusedParameters": true
}
```

### Type Conventions
```typescript
// ✅ DO: Use explicit interfaces for props
interface NftCardProps {
  nft: NftItem;
  onClick?: (id: string) => void;
  className?: string;
}

// ❌ DON'T: Use `any`
const data: any = response; // Never

// ✅ DO: Use `unknown` when type is truly unknown, then narrow
const data: unknown = response;
if (typeof data === 'object' && data !== null) { ... }

// ✅ DO: Type return values on async functions
async function fetchNfts(address: string): Promise<NftItem[]> { ... }

// ✅ DO: Use discriminated unions for API states
type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
```

### Naming Conventions
| Entity | Convention | Example |
|---|---|---|
| Components | PascalCase | `NftGallery`, `WalletButton` |
| Hooks | camelCase + `use` prefix | `useWallet`, `useNftData` |
| Services | camelCase + `.service.ts` | `nft.service.ts` |
| Stores | camelCase + `use` prefix | `useWalletStore.ts` |
| Types/Interfaces | PascalCase | `NftItem`, `WalletState` |
| Constants | SCREAMING_SNAKE_CASE | `MAX_RETRIES`, `RPC_URL` |
| Event handlers | `handle` prefix | `handleWalletConnect`, `handleNftClick` |
| Boolean props | `is`/`has`/`can` prefix | `isLoading`, `hasError`, `canMint` |

---

## 5. React Component Standards

### Component Template
```typescript
import { type FC } from 'react';
import { cn } from '@/utils/cn'; // clsx + tailwind-merge

interface ExampleProps {
  title: string;
  isLoading?: boolean;
  className?: string;
}

export const Example: FC<ExampleProps> = ({ title, isLoading = false, className }) => {
  return (
    <div className={cn('base-classes', isLoading && 'opacity-50', className)}>
      <h2>{title}</h2>
    </div>
  );
};
```

### Hooks Rules
```typescript
// ✅ DO: Keep useEffect dependencies complete
useEffect(() => {
  fetchData(address);
}, [address, fetchData]); // Include ALL dependencies

// ✅ DO: Clean up subscriptions
useEffect(() => {
  const sub = store.subscribe(handler);
  return () => sub.unsubscribe();
}, []);

// ❌ DON'T: Mutate state directly
state.items.push(newItem); // Never

// ✅ DO: Use functional updates for derived state
setItems(prev => [...prev, newItem]);
```

### cn() Utility
Always merge classes using `cn()` (clsx + tailwind-merge):
```typescript
// Create this utility if missing:
// src/utils/cn.ts
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
```

---

## 6. Zustand Store Standards

```typescript
// src/store/useWalletStore.ts
import { create } from 'zustand';

interface WalletState {
  address: string | null;
  isConnected: boolean;
  connect: (address: string) => void;
  disconnect: () => void;
}

export const useWalletStore = create<WalletState>((set) => ({
  address: null,
  isConnected: false,
  connect: (address) => set({ address, isConnected: true }),
  disconnect: () => set({ address: null, isConnected: false }),
}));
```

**Rules:**
- **One store per feature domain** — `useWalletStore`, `useNftStore`, `useChainStore`
- **Never store derived state** — compute it with a selector instead
- **Actions are part of the store** — not separate hooks or callbacks

---

## 7. Service Layer Standards

```typescript
// src/services/nft.service.ts
// Pure async functions — no React, no hooks, no side effects beyond the API call

export async function fetchStargazeNfts(address: string): Promise<NftItem[]> {
  try {
    const response = await fetch(`${STARGAZE_API}/nfts/${address}`);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    return data.nfts ?? [];
  } catch (error) {
    console.error('[nft.service] fetchStargazeNfts failed:', error);
    throw error; // Re-throw — let the caller decide how to handle
  }
}
```

**Rules:**
- **No React in services** — services are framework-agnostic
- **Always log errors with context** — `[service-name] functionName failed:`
- **Re-throw errors** from services — let the UI layer decide on fallback behavior
- **Group by blockchain** — `cosmos.service.ts`, `solana.service.ts`, `evm.service.ts`

---

## 8. Blockchain Integration Standards

### CosmJS (Cosmos/POSTHUMAN chain)
```typescript
import { SigningCosmWasmClient } from '@cosmjs/cosmwasm-stargate';
import { GasPrice } from '@cosmjs/stargate';

// Always check wallet before calling
async function executeContract(msg: Record<string, unknown>) {
  const { address, isConnected } = useWalletStore.getState();
  if (!isConnected || !address) throw new Error('Wallet not connected');
  
  const client = await SigningCosmWasmClient.connectWithSigner(RPC_URL, signer, {
    gasPrice: GasPrice.fromString('0.025uatom'),
  });
  
  return client.execute(address, CONTRACT_ADDRESS, msg, 'auto');
}
```

### Solana (@solana/web3.js)
```typescript
import { Connection, PublicKey } from '@solana/web3.js';

// Always validate public keys before use
function validateSolanaAddress(address: string): PublicKey {
  try {
    return new PublicKey(address);
  } catch {
    throw new Error(`Invalid Solana address: ${address}`);
  }
}
```

### EVM (ethers v6)
```typescript
import { ethers } from 'ethers';

// Always check network before transactions
async function checkNetwork(expectedChainId: number) {
  const provider = new ethers.BrowserProvider(window.ethereum);
  const network = await provider.getNetwork();
  if (Number(network.chainId) !== expectedChainId) {
    throw new Error(`Wrong network. Expected chainId ${expectedChainId}`);
  }
}
```

---

## 9. Styling Standards (TailwindCSS)

```typescript
// ✅ DO: Use Tailwind utility classes
<div className="flex items-center gap-4 rounded-lg bg-white/10 p-4 backdrop-blur-sm">

// ✅ DO: Use cn() for conditional classes
<button className={cn(
  'rounded-md px-4 py-2 font-medium transition-colors',
  isActive ? 'bg-purple-600 text-white' : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
)}>

// ❌ DON'T: Use inline styles for layout
<div style={{ display: 'flex', gap: '16px' }}>  // No

// ✅ DO: Dark-first design (POSTHUMAN is a dark-mode app)
// Base colors: dark backgrounds, light text, purple/blue accents
```

**POSTHUMAN Color Palette:**
- Background: `bg-gray-900`, `bg-gray-800`, `bg-black`
- Cards: `bg-white/5`, `bg-white/10` (glassmorphism)
- Accent: `purple-500`, `purple-600`, `blue-500`
- Text: `text-white`, `text-gray-300`, `text-gray-400`
- Borders: `border-white/10`, `border-gray-700`

---

## 10. Error Handling Standards

```typescript
// ✅ DO: Wrap all async data fetching in try/catch
const [state, setState] = useState<FetchState<NftItem[]>>({ status: 'idle' });

async function loadNfts() {
  setState({ status: 'loading' });
  try {
    const data = await fetchStargazeNfts(address);
    setState({ status: 'success', data });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    setState({ status: 'error', error: message });
  }
}

// ✅ DO: Display user-friendly error messages in UI
{state.status === 'error' && (
  <div className="rounded-md bg-red-900/20 border border-red-500/30 p-3 text-red-400 text-sm">
    {state.error}
  </div>
)}
```

---

## 11. Git / Commit Standards

```bash
# Commit message format: <type>(<scope>): <description>
git commit -m "feat(nft): add Stargaze marketplace integration"
git commit -m "fix(wallet): handle disconnected state before tx"
git commit -m "refactor(store): split wallet store by chain"
git commit -m "style(ui): update NFT card glassmorphism effect"
git commit -m "chore(deps): update @cosmjs to 0.38.1"
```

**Types:** `feat`, `fix`, `refactor`, `style`, `docs`, `chore`, `test`
**Scopes:** `nft`, `wallet`, `cosmos`, `solana`, `evm`, `ui`, `store`, `router`, `deps`

---

## References

- See `references/coding-standards.md` for extended examples and edge cases
- See `legacy-code-auditor` skill for reviewing existing code against these standards
- See `environment-setup` skill for setting up the dev environment
