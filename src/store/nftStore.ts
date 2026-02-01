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
  // Fetch owned NFTs
  fetchOwnedNFTs: async (ecosystem?: EcosystemFilter) => {
    const requestId = get().currentRequestId + 1;
    set({
      isLoadingOwned: true,
      error: null,
      ownedNFTsOffset: 0,
      ownedNFTs: [],
      currentRequestId: requestId,
    });

    try {
      const walletStore = useWalletStore.getState();
      const wallets = walletStore.wallets;

      if (wallets.length === 0) {
        set({ ownedNFTs: [], isLoadingOwned: false, hasMoreOwnedNFTs: false });
        return;
      }

      const targetEcosystem = ecosystem || get().activeEcosystem;
      let allNFTs: NFT[] = [];

      // Fetch from Stargaze if applicable
      if (targetEcosystem === "all" || targetEcosystem === "stargaze") {
        // Get wallets with Stargaze addresses (start with 'stars')
        const stargazeWallets = wallets.filter(
          (w) =>
            (w.chain === "Cosmos" || w.chain === "Gno") &&
            w.address.startsWith("stars"),
        );

        // Deduplicate addresses
        const uniqueStargazeAddresses = [
          ...new Set(stargazeWallets.map((w) => w.address)),
        ];

        for (const address of uniqueStargazeAddresses) {
          try {
            const { fetchNFTs } = await import("../services/nftService");
            const nfts = await fetchNFTs(address, "Cosmos", "stargaze-1", 0); // offset 0 for initial fetch

            // Convert to NFT format expected by store
            const convertedNFTs: NFT[] = nfts.map((nft) => ({
              id: nft.id,
              tokenId: nft.id,
              name: nft.name,
              description: nft.description || "",
              image: nft.image,
              chain: "stargaze" as const,
              contractAddress: "", // Not provided by nftService
              owner: address,
              collection: {
                id: "",
                name: nft.collectionName || "Unknown Collection",
                image: nft.image,
              },
              isListed: false,
              marketplace: undefined,
            }));

            allNFTs = [...allNFTs, ...convertedNFTs];
          } catch (error) {
            console.error(
              `[NFT Store] Error fetching NFTs for ${address}:`,
              error,
            );
          }
        }
      }

      // Fetch from EVM chains (OpenSea)
      if (targetEcosystem === "all" || targetEcosystem === "evm") {
        const evmWallets = wallets.filter((w) => w.chain === "EVM");

        // Deduplicate addresses (normalize to lowercase)
        const uniqueAddresses = [
          ...new Set(evmWallets.map((w) => w.address.toLowerCase())),
        ];
        console.log(
          "[NFT Store] EVM wallets found:",
          evmWallets.length,
          "unique addresses:",
          uniqueAddresses.length,
        );

        for (const address of uniqueAddresses) {
          try {
            console.log(`[NFT Store] Fetching EVM NFTs for ${address}...`);

            // List of chains to fetch from
            const evmChains = [
              "ethereum",
              "polygon",
              "base",
              "bsc",
              "gnosis",
              "arbitrum",
            ] as const;

            // Fetch concurrently for better performance
            const promises = evmChains.map(async (chain) => {
              try {
                const nfts = await openSeaNFTService.fetchUserNFTs(
                  address,
                  chain,
                );
                console.log(`[NFT Store] Found ${nfts.length} ${chain} NFTs`);
                return nfts;
              } catch (e) {
                console.warn(`[NFT Store] Failed to fetch ${chain} NFTs:`, e);
                return [];
              }
            });

            const results = await Promise.all(promises);
            const failedCount = results.filter((r) => r.length === 0).length;
            const successCount = results.filter((r) => r.length > 0).length;
            console.log(
              `[NFT Store] EVM fetch complete. Success: ${successCount}, Empty/Failed: ${failedCount}`,
            );

            allNFTs = [...allNFTs, ...results.flat()];
          } catch (error) {
            console.error(
              `[NFT Store] Error fetching EVM NFTs for ${address}:`,
              error,
            );
          }
        }
      }

      // Fetch from Solana (Magic Eden)
      if (targetEcosystem === "all" || targetEcosystem === "solana") {
        const solanaWallets = wallets.filter((w) => w.chain === "Solana");
        console.log("[NFT Store] Solana wallets found:", solanaWallets.length);

        // Deduplicate addresses
        const uniqueSolanaAddresses = [
          ...new Set(solanaWallets.map((w) => w.address)),
        ];

        for (const address of uniqueSolanaAddresses) {
          try {
            console.log(`[NFT Store] Fetching Solana NFTs for ${address}...`);
            const nfts = await magicEdenNFTService.fetchUserNFTs(address);
            console.log(`[NFT Store] Found ${nfts.length} Solana NFTs`);
            allNFTs = [...allNFTs, ...nfts];
          } catch (error) {
            console.error(
              `[NFT Store] Error fetching Solana NFTs for ${address}:`,
              error,
            );
          }
        }
      }

      // Check cancellation
      if (get().currentRequestId !== requestId) return;

      // STRICT FILTER: Ensure we only keep NFTs that match the requested ecosystem
      if (targetEcosystem === "stargaze") {
        allNFTs = allNFTs.filter((n) => n.chain === "stargaze");
      } else if (targetEcosystem === "evm") {
        allNFTs = allNFTs.filter((n) =>
          ["ethereum", "polygon", "base", "bsc", "gnosis", "arbitrum"].includes(
            n.chain,
          ),
        );
      } else if (targetEcosystem === "solana") {
        allNFTs = allNFTs.filter((n) => n.chain === "solana");
      }

      // Final Deduplication & Cross-Chain Cleanup
      const uniqueNFTs = new Map<string, NFT>();

      allNFTs.forEach((nft) => {
        // 1. Full Key for exact matches
        const fullKey =
          `${nft.chain}-${nft.contractAddress}-${nft.tokenId}`.toLowerCase();

        // 2. Cross-chain Check for EVM
        // If we already have this asset (Same Contract + ID) from another EVM chain, skip it.
        // This handles OpenSea returning the same asset for multiple chain queries.
        const isEVM = [
          "ethereum",
          "polygon",
          "base",
          "bsc",
          "gnosis",
          "arbitrum",
        ].includes(nft.chain);

        if (isEVM && nft.contractAddress) {
          let duplicateFound = false;
          for (const existing of uniqueNFTs.values()) {
            if (
              [
                "ethereum",
                "polygon",
                "base",
                "bsc",
                "gnosis",
                "arbitrum",
              ].includes(existing.chain)
            ) {
              if (
                existing.contractAddress.toLowerCase() ===
                nft.contractAddress.toLowerCase() &&
                existing.tokenId === nft.tokenId
              ) {
                duplicateFound = true;
                break;
              }
            }
          }
          if (duplicateFound) return; // Skip this duplicate
        }

        if (!uniqueNFTs.has(fullKey)) {
          uniqueNFTs.set(fullKey, nft);
        }
      });

      const finalNFTs = Array.from(uniqueNFTs.values());

      // Check if we got a full batch (100 NFTs), indicating there might be more
      set({
        ownedNFTs: finalNFTs,
        isLoadingOwned: false,
        ownedNFTsOffset: 100,
        hasMoreOwnedNFTs: finalNFTs.length >= 100,
      });
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
