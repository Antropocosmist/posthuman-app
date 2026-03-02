# POSTHUMAN Coding Standards — Extended Reference

This document extends the `tech-stack-master` SKILL.md with deeper examples,
edge cases, and patterns specific to the POSTHUMAN app.

---

## Pattern Library

### Multi-Chain Wallet Pattern

POSTHUMAN supports three blockchain ecosystems. Always use a unified interface:

```typescript
// src/store/useWalletStore.ts — Multi-chain pattern
import { create } from 'zustand';

type Chain = 'cosmos' | 'solana' | 'evm';

interface ChainWallet {
  address: string;
  chain: Chain;
  isConnected: boolean;
}

interface WalletState {
  wallets: Record<Chain, ChainWallet | null>;
  activeChain: Chain | null;
  connect: (chain: Chain, address: string) => void;
  disconnect: (chain: Chain) => void;
  getActiveWallet: () => ChainWallet | null;
}

export const useWalletStore = create<WalletState>((set, get) => ({
  wallets: { cosmos: null, solana: null, evm: null },
  activeChain: null,
  connect: (chain, address) =>
    set((state) => ({
      wallets: { ...state.wallets, [chain]: { address, chain, isConnected: true } },
      activeChain: chain,
    })),
  disconnect: (chain) =>
    set((state) => ({
      wallets: { ...state.wallets, [chain]: null },
      activeChain: state.activeChain === chain ? null : state.activeChain,
    })),
  getActiveWallet: () => {
    const { wallets, activeChain } = get();
    return activeChain ? wallets[activeChain] : null;
  },
}));
```

---

### Async Data Loading Pattern

Use this pattern consistently for all data-fetching components:

```typescript
// src/components/NftGallery/NftGallery.tsx

type FetchState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };

export const NftGallery: FC<{ address: string }> = ({ address }) => {
  const [state, setState] = useState<FetchState<NftItem[]>>({ status: 'idle' });

  useEffect(() => {
    if (!address) return;

    let cancelled = false;

    const load = async () => {
      setState({ status: 'loading' });
      try {
        const data = await fetchNfts(address);
        if (!cancelled) setState({ status: 'success', data });
      } catch (err) {
        if (!cancelled) {
          const error = err instanceof Error ? err.message : 'Failed to load NFTs';
          setState({ status: 'error', error });
        }
      }
    };

    load();
    return () => { cancelled = true; };  // Cleanup: cancel stale requests
  }, [address]);

  if (state.status === 'idle' || state.status === 'loading') {
    return <LoadingSpinner />;
  }
  if (state.status === 'error') {
    return <ErrorMessage message={state.error} />;
  }
  return <NftGrid items={state.data} />;
};
```

---

### Route Structure Pattern

```typescript
// src/App.tsx — React Router v7
import { BrowserRouter, Routes, Route } from 'react-router-dom';

export const App: FC = () => (
  <BrowserRouter basename="/posthuman-app">  {/* GitHub Pages basename */}
    <Routes>
      <Route path="/" element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="nfts" element={<NftGalleryPage />} />
        <Route path="wallet" element={<WalletPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>
    </Routes>
  </BrowserRouter>
);
```

> [!IMPORTANT]
> Always use `basename="/posthuman-app"` in BrowserRouter for GitHub Pages deployment.
> Without this, routing breaks after a page refresh on GitHub Pages.

---

### Framer Motion Animation Patterns

```typescript
// Standard POSTHUMAN entrance animation
const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  transition: { duration: 0.4, ease: 'easeOut' },
};

// Usage
<motion.div {...fadeInUp}>
  <NftCard nft={nft} />
</motion.div>

// Staggered list items
const container = {
  animate: { transition: { staggerChildren: 0.05 } },
};

<motion.ul variants={container} animate="animate">
  {items.map((item) => (
    <motion.li key={item.id} variants={fadeInUp}>
      <Item data={item} />
    </motion.li>
  ))}
</motion.ul>
```

---

### cn() Utility Standard

Every project must have this utility. Create at `src/utils/cn.ts` if missing:

```typescript
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Merges Tailwind classes safely, resolving conflicts.
 * Example: cn('px-2 py-1', 'px-4') → 'py-1 px-4'
 */
export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
```

---

### Error Boundary Component

Add this to wrap any async-heavy feature:

```typescript
// src/components/ErrorBoundary/ErrorBoundary.tsx
import { Component, type ReactNode, type ErrorInfo } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[ErrorBoundary] Caught:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? (
        <div className="p-4 text-red-400 text-sm">
          Something went wrong: {this.state.error?.message}
        </div>
      );
    }
    return this.props.children;
  }
}
```

---

## Anti-Patterns to Avoid

| Anti-Pattern | Why Bad | Correct Pattern |
|---|---|---|
| `any` type | Loses type safety entirely | Use `unknown` and narrow |
| Direct state mutation | React won't re-render | Use `setState(prev => ...)` |
| Hardcoded RPC URLs | Breaks across environments | Use `import.meta.env.VITE_*` |
| No `await` on async | Silent promise failures | Always `await` or `.catch()` |
| `useEffect` without cleanup | Memory / stale closure leaks | Return cleanup function |
| Inline styles for layout | Breaks Tailwind purging | Use Tailwind utilities |
| Prop drilling >2 levels | Tight coupling | Use Zustand store |
| Multiple responsibility hooks | Hard to test/reuse | One concern per hook |
| `console.log` in production | Leaks internal info | Use `console.error` with guard |
