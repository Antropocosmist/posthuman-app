import { create } from "zustand";
import type {
  NFT,
  MarketplaceListing,
  NFTFilters,
} from "../services/nft/types";
import { stargazeNFTService } from "../services/nft/stargaze";
import { openSeaNFTService } from "../services/nft/opensea";
import { magicEdenNFTService } from "../services/nft/magiceden";
import { useWalletStore } from "./walletStore";

type EcosystemFilter = "stargaze" | "evm" | "solana" | "all";
type ViewMode = "owned" | "marketplace";

interface NFTStore {
  // NFT Data
  ownedNFTs: NFT[];
  marketplaceNFTs: MarketplaceListing[];
  selectedNFT: NFT | null;

  // UI State
  activeEcosystem: EcosystemFilter;
  activeView: ViewMode;
  searchQuery: string;
  filters: NFTFilters;

  // Pagination
  ownedNFTsOffset: number;
  hasMoreOwnedNFTs: boolean;

  // Loading States
  isLoadingOwned: boolean;
  isLoadingMarketplace: boolean;
  isBuying: boolean;
  isListing: boolean;

  // Error States
  error: string | null;
  currentRequestId: number;

  // Actions - Data Fetching
  fetchOwnedNFTs: (ecosystem?: EcosystemFilter) => Promise<void>;
  loadMoreOwnedNFTs: () => Promise<void>;
  fetchMarketplaceNFTs: (
    ecosystem?: EcosystemFilter,
    filters?: NFTFilters,
  ) => Promise<void>;
  refreshNFTs: () => Promise<void>;

  // Actions - NFT Operations
  buyNFT: (listing: MarketplaceListing) => Promise<void>;
  listNFT: (nft: NFT, price: string, currency: string) => Promise<void>;
  cancelListing: (listingId: string) => Promise<void>;

  // Actions - UI State
  setSelectedNFT: (nft: NFT | null) => void;
  setActiveEcosystem: (ecosystem: EcosystemFilter) => void;
  setActiveView: (view: ViewMode) => void;
  setSearchQuery: (query: string) => void;
  setFilters: (filters: NFTFilters) => void;
  clearError: () => void;
}

export const useNFTStore = create<NFTStore>((set, get) => ({
  // Initial State
  ownedNFTs: [],
  marketplaceNFTs: [],
  selectedNFT: null,

  activeEcosystem: "all",
  activeView: "owned",
  searchQuery: "",
  filters: {},

  ownedNFTsOffset: 0,
  hasMoreOwnedNFTs: false,

  isLoadingOwned: false,
  isLoadingMarketplace: false,
  isBuying: false,
  isListing: false,

  error: null,

  // Request tracking for cancellation
  currentRequestId: 0,

  // Fetch owned NFTs
  fetchOwnedNFTs: async (ecosystem?: EcosystemFilter) => {
    // 1. Setup Request ID and State
    const currentInternalId = get().currentRequestId + 1;
    set({
      isLoadingOwned: true,
      error: null,
      ownedNFTsOffset: 0,
      ownedNFTs: [], // Explicitly clear
      currentRequestId: currentInternalId,
    });

    const targetEcosystem = ecosystem || get().activeEcosystem;
    console.log(`[NFT Store] Fetching for ecosystem: ${targetEcosystem} (ID: ${currentInternalId})`);

    try {
      const walletStore = useWalletStore.getState();
      const wallets = walletStore.wallets;

      if (wallets.length === 0) {
        set({ ownedNFTs: [], isLoadingOwned: false, hasMoreOwnedNFTs: false });
        return;
      }

      let fetchedNFTs: NFT[] = [];

      // 2. Fetch Stargaze
      if (targetEcosystem === "all" || targetEcosystem === "stargaze") {
        const stargazeWallets = wallets.filter(
          (w) => (w.chain === "Cosmos" || w.chain === "Gno") && w.address.startsWith("stars")
        );
        const uniqueAddresses = [...new Set(stargazeWallets.map((w) => w.address))];

        for (const address of uniqueAddresses) {
          if (get().currentRequestId !== currentInternalId) return; // Early exit
          // ... (Existing Stargaze Fetch Logic - abbreviated for edit, utilizing imports)
          try {
            const { fetchNFTs } = await import("../services/nftService");
            const nfts = await fetchNFTs(address, "Cosmos", "stargaze-1", 0);
            const converted = nfts.map(nft => ({
              id: nft.id, tokenId: nft.id, name: nft.name, description: nft.description || "",
              image: nft.image, chain: "stargaze" as const, contractAddress: "", owner: address,
              collection: { id: "", name: nft.collectionName || "Unknown", image: nft.image },
              isListed: false, marketplace: undefined
            }));
            fetchedNFTs = [...fetchedNFTs, ...converted];
          } catch (e) { console.error("Stargaze fetch error", e); }
        }
      }

      // 3. Fetch EVM
      if (targetEcosystem === "all" || targetEcosystem === "evm") {
        if (get().currentRequestId !== currentInternalId) return;
        const evmWallets = wallets.filter((w) => w.chain === "EVM");
        const uniqueAddresses = [...new Set(evmWallets.map((w) => w.address.toLowerCase()))];
        const evmChains = ["ethereum", "polygon", "base", "bsc", "gnosis", "arbitrum"] as const;

        for (const address of uniqueAddresses) {
          console.log(`[NFT Store] Fetching EVM for ${address} (ID: ${currentInternalId})`);
          const promises = evmChains.map(async (chain) => {
            try {
              return await openSeaNFTService.fetchUserNFTs(address, chain);
            } catch (e) { return []; }
          });
          const results = await Promise.all(promises);
          fetchedNFTs = [...fetchedNFTs, ...results.flat()];
        }
      }

      // 4. Fetch Solana
      if (targetEcosystem === "all" || targetEcosystem === "solana") {
        if (get().currentRequestId !== currentInternalId) return;
        const solanaWallets = wallets.filter((w) => w.chain === "Solana");
        const uniqueAddresses = [...new Set(solanaWallets.map((w) => w.address))];
        for (const address of uniqueAddresses) {
          try {
            const nfts = await magicEdenNFTService.fetchUserNFTs(address);
            fetchedNFTs = [...fetchedNFTs, ...nfts];
          } catch (e) { console.error("Solana fetch error", e); }
        }
      }

      // 5. Final Safety Check (Race Condition)
      if (get().currentRequestId !== currentInternalId) {
        console.log(`[NFT Store] Ignoring stale request ${currentInternalId}`);
        return;
      }

      // 6. Strict ECOSYSTEM Filtering (Double check)
      // This ensures that even if logic leaked, we forcefully clean it.
      let filteredByType = fetchedNFTs;
      if (targetEcosystem === "stargaze") filteredByType = filteredByType.filter(n => n.chain === "stargaze");
      else if (targetEcosystem === "evm") filteredByType = filteredByType.filter(n => ["ethereum", "polygon", "base", "bsc", "gnosis", "arbitrum"].includes(n.chain));
      else if (targetEcosystem === "solana") filteredByType = filteredByType.filter(n => n.chain === "solana");

      // 7. Aggressive Deduplication (Content-Based)
      // We prioritize exact matches, then content matches (Name + TokenID) to merge cross-chain duplicates (like UD)
      const uniqueMap = new Map<string, NFT>();
      const contentMap = new Map<string, string>(); // Key: "name-tokenId", Value: fullKey

      filteredByType.forEach(nft => {
        const fullKey = `${nft.chain}-${nft.contractAddress}-${nft.tokenId}`.toLowerCase();

        // Special handling for Unstoppable Domains / ENS-like assets
        // If name and tokenId match, we treat them as the SAME asset to avoid cross-chain confusion.
        // We prioritize Ethereum version if available.
        const isEVM = ["ethereum", "polygon", "base", "bsc", "gnosis", "arbitrum"].includes(nft.chain);
        let contentKey = "";

        if (isEVM) {
          contentKey = `${nft.name}-${nft.tokenId}`.toLowerCase();
        }

        if (contentKey) {
          if (contentMap.has(contentKey)) {
            // We already have this asset (e.g. on another chain).
            // Check priority: Ethereum > others.
            const existingKey = contentMap.get(contentKey)!;
            const existingNFT = uniqueMap.get(existingKey)!;

            if (nft.chain === 'ethereum' && existingNFT.chain !== 'ethereum') {
              // Replace existing with Ethereum version
              uniqueMap.delete(existingKey);
              uniqueMap.set(fullKey, nft);
              contentMap.set(contentKey, fullKey);
            }
            // Else: Keep existing (first one wins or higher priority wins)
            return;
          }
          contentMap.set(contentKey, fullKey);
        }

        if (!uniqueMap.has(fullKey)) {
          uniqueMap.set(fullKey, nft);
        }
      });

      const finalNFTs = Array.from(uniqueMap.values());

      set({
        ownedNFTs: finalNFTs,
        isLoadingOwned: false,
        ownedNFTsOffset: 100,
        hasMoreOwnedNFTs: finalNFTs.length >= 100,
      });
      console.log(`[NFT Store] Set ownedNFTs: ${finalNFTs.length} items (ID: ${currentInternalId})`);

    } catch (error) {
      console.error("Error fetching owned NFTs:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to fetch NFTs",
        isLoadingOwned: false,
        hasMoreOwnedNFTs: false,
      });
    }
  },

  // Load more owned NFTs (pagination)
  loadMoreOwnedNFTs: async () => {
    const { isLoadingOwned, ownedNFTsOffset, activeEcosystem, ownedNFTs } =
      get();

    if (isLoadingOwned) return;

    set({ isLoadingOwned: true, error: null });

    try {
      const walletStore = useWalletStore.getState();
      const wallets = walletStore.wallets;

      if (wallets.length === 0) {
        set({ isLoadingOwned: false, hasMoreOwnedNFTs: false });
        return;
      }

      let newNFTs: NFT[] = [];

      // Fetch from Stargaze if applicable
      if (activeEcosystem === "all" || activeEcosystem === "stargaze") {
        const stargazeWallets = wallets.filter(
          (w) =>
            (w.chain === "Cosmos" || w.chain === "Gno") &&
            w.address.startsWith("stars"),
        );

        for (const wallet of stargazeWallets) {
          try {
            const { fetchNFTs } = await import("../services/nftService");
            const nfts = await fetchNFTs(
              wallet.address,
              wallet.chain,
              wallet.chainId,
              ownedNFTsOffset,
            );

            const convertedNFTs: NFT[] = nfts.map((nft) => ({
              id: nft.id,
              tokenId: nft.id,
              name: nft.name,
              description: nft.description || "",
              image: nft.image,
              chain: "stargaze" as const,
              contractAddress: "",
              owner: wallet.address,
              collection: {
                id: "",
                name: nft.collectionName || "Unknown Collection",
                image: nft.image,
              },
              isListed: false,
              marketplace: undefined,
            }));

            newNFTs = [...newNFTs, ...convertedNFTs];
          } catch (error) {
            console.error(
              `[NFT Store] Error loading more NFTs for ${wallet.address}:`,
              error,
            );
          }
        }
      }

      // TODO: Add pagination for EVM and Solana when needed

      set({
        ownedNFTs: [...ownedNFTs, ...newNFTs],
        isLoadingOwned: false,
        ownedNFTsOffset: ownedNFTsOffset + 100,
        hasMoreOwnedNFTs: newNFTs.length >= 100,
      });
    } catch (error) {
      console.error("Error loading more owned NFTs:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to load more NFTs",
        isLoadingOwned: false,
        hasMoreOwnedNFTs: false,
      });
    }
  },

  // Fetch marketplace listings
  fetchMarketplaceNFTs: async (
    ecosystem?: EcosystemFilter,
    filters?: NFTFilters,
  ) => {
    set({ isLoadingMarketplace: true, error: null });

    try {
      const targetEcosystem = ecosystem || get().activeEcosystem;
      const targetFilters = filters || get().filters;
      let allListings: MarketplaceListing[] = [];

      // Fetch from Stargaze marketplace
      if (targetEcosystem === "all" || targetEcosystem === "stargaze") {
        try {
          const listings =
            await stargazeNFTService.fetchMarketplaceListings(targetFilters);
          allListings = [...allListings, ...listings];
        } catch (error) {
          console.error("Error fetching Stargaze marketplace:", error);
        }
      }

      // Fetch from OpenSea marketplace
      if (targetEcosystem === "all" || targetEcosystem === "evm") {
        try {
          const listings =
            await openSeaNFTService.fetchMarketplaceListings(targetFilters);
          allListings = [...allListings, ...listings];
        } catch (error) {
          console.error("Error fetching OpenSea marketplace:", error);
        }
      }

      // Fetch from Magic Eden marketplace
      if (targetEcosystem === "all" || targetEcosystem === "solana") {
        try {
          const listings =
            await magicEdenNFTService.fetchMarketplaceListings(targetFilters);
          allListings = [...allListings, ...listings];
        } catch (error) {
          console.error("Error fetching Magic Eden marketplace:", error);
        }
      }

      set({ marketplaceNFTs: allListings, isLoadingMarketplace: false });
    } catch (error) {
      console.error("Error fetching marketplace NFTs:", error);
      set({
        error:
          error instanceof Error
            ? error.message
            : "Failed to fetch marketplace listings",
        isLoadingMarketplace: false,
      });
    }
  },

  // Refresh all NFTs
  refreshNFTs: async () => {
    const { activeView, activeEcosystem } = get();

    if (activeView === "owned") {
      await get().fetchOwnedNFTs(activeEcosystem);
    } else {
      await get().fetchMarketplaceNFTs(activeEcosystem);
    }
  },

  // Buy NFT from marketplace
  buyNFT: async (listing: MarketplaceListing) => {
    set({ isBuying: true, error: null });

    try {
      const walletStore = useWalletStore.getState();

      // Map NFT chain to wallet ChainType
      const getWalletChainType = (nftChain: string): string => {
        if (nftChain === "stargaze") return "Cosmos";
        if (nftChain === "ethereum" || nftChain === "polygon") return "EVM";
        if (nftChain === "solana") return "Solana";
        return nftChain;
      };

      const walletChainType = getWalletChainType(listing.nft.chain);
      const buyerWallet = walletStore.wallets.find(
        (w) => w.chain === walletChainType,
      );

      if (!buyerWallet) {
        throw new Error(`No wallet connected for ${listing.nft.chain}`);
      }

      let txHash: string;

      switch (listing.marketplace) {
        case "stargaze":
          txHash = await stargazeNFTService.buyNFT(
            listing,
            buyerWallet.address,
          );
          break;
        case "opensea":
          txHash = await openSeaNFTService.buyNFT(listing, buyerWallet.address);
          break;
        case "magiceden":
          txHash = await magicEdenNFTService.buyNFT(
            listing,
            buyerWallet.address,
          );
          break;
        default:
          throw new Error(
            `Marketplace ${listing.marketplace} not supported yet`,
          );
      }

      console.log("Buy transaction successful:", txHash);

      // Refresh NFTs after successful purchase
      await get().refreshNFTs();

      set({ isBuying: false });
    } catch (error) {
      console.error("Error buying NFT:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to buy NFT",
        isBuying: false,
      });
      throw error;
    }
  },

  // List NFT for sale
  listNFT: async (nft: NFT, price: string, currency: string) => {
    set({ isListing: true, error: null });

    try {
      const walletStore = useWalletStore.getState();

      // Map NFT chain to wallet ChainType
      const getWalletChainType = (nftChain: string): string => {
        if (nftChain === "stargaze") return "Cosmos";
        if (nftChain === "ethereum" || nftChain === "polygon") return "EVM";
        if (nftChain === "solana") return "Solana";
        return nftChain;
      };

      const walletChainType = getWalletChainType(nft.chain);
      const sellerWallet = walletStore.wallets.find(
        (w) => w.address === nft.owner && w.chain === walletChainType,
      );

      if (!sellerWallet) {
        throw new Error("You must own this NFT to list it");
      }

      let listingId: string;

      switch (nft.chain) {
        case "stargaze":
          listingId = await stargazeNFTService.listNFT(
            nft,
            price,
            currency,
            sellerWallet.address,
          );
          break;
        case "ethereum":
        case "polygon":
          listingId = await openSeaNFTService.listNFT(
            nft,
            price,
            currency,
            sellerWallet.address,
          );
          break;
        case "solana":
          listingId = await magicEdenNFTService.listNFT(
            nft,
            price,
            currency,
            sellerWallet.address,
          );
          break;
        default:
          throw new Error(`Chain ${nft.chain} not supported yet`);
      }

      console.log("Listing created:", listingId);

      // Refresh NFTs after successful listing
      await get().refreshNFTs();

      set({ isListing: false });
    } catch (error) {
      console.error("Error listing NFT:", error);
      set({
        error: error instanceof Error ? error.message : "Failed to list NFT",
        isListing: false,
      });
      throw error;
    }
  },

  // Cancel listing
  cancelListing: async (listingId: string) => {
    set({ isListing: true, error: null });

    try {
      const walletStore = useWalletStore.getState();
      const wallet = walletStore.wallets[0]; // TODO: Get correct wallet

      if (!wallet) {
        throw new Error("No wallet connected");
      }

      // TODO: Determine which service to use based on listing
      await stargazeNFTService.cancelListing(listingId, wallet.address);

      // Refresh NFTs after cancellation
      await get().refreshNFTs();

      set({ isListing: false });
    } catch (error) {
      console.error("Error canceling listing:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to cancel listing",
        isListing: false,
      });
      throw error;
    }
  },

  // UI State Actions
  setSelectedNFT: (nft) => set({ selectedNFT: nft }),

  setActiveEcosystem: (ecosystem) => {
    set({ activeEcosystem: ecosystem });
    // Auto-refresh when ecosystem changes
  },

  setActiveView: (view) => {
    set({ activeView: view });
    // Auto-refresh when view changes
  },

  setSearchQuery: (query) => set({ searchQuery: query }),

  setFilters: (filters) => {
    set({ filters });
    // Auto-refresh when filters change
    if (get().activeView === "marketplace") {
      get().fetchMarketplaceNFTs(get().activeEcosystem, filters);
    }
  },

  clearError: () => set({ error: null }),
}));
