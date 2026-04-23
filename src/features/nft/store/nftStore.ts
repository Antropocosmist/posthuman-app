import { create } from "zustand";
import type {
  NFT,
  MarketplaceListing,
  NFTFilters,
  NFTCollection,
} from "../types/types";
import { stargazeNFTService } from "../cosmos/services/stargaze";
import { openSeaNFTService } from "../evm/services/opensea";
import { magicEdenNFTService } from "../solana/services/magiceden";
import { useWalletStore } from "../../wallet/store/walletStore";

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
  isTransferring: boolean;
  isBurning: boolean;
  isCreatingAuction: boolean;

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
  listNFT: (nft: NFT, price: string, currency: string, durationInSeconds?: number) => Promise<void>;
  cancelListing: (nft: NFT) => Promise<void>;
  transferNFT: (nft: NFT, recipientAddress: string) => Promise<string>;
  burnNFT: (nft: NFT) => Promise<string>;
  createAuction: (nft: NFT, reservePrice: string, currency: string, durationInSeconds: number) => Promise<string>;
  fetchCollectionStats: (contractAddress: string, chain: string) => Promise<NFTCollection | null>;

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
  isTransferring: false,
  isBurning: false,
  isCreatingAuction: false,

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
            // Use the robust Stargaze service which handles listings (escrowed NFTs) correctly
            const nfts = await stargazeNFTService.fetchUserNFTs(address);
            fetchedNFTs = [...fetchedNFTs, ...nfts];
          } catch (e) {
            console.error("Stargaze fetch error", e);
          }
        }
      }

      // 3. Fetch EVM
      if (targetEcosystem === "all" || targetEcosystem === "evm") {
        if (get().currentRequestId !== currentInternalId) return;
        const evmWallets = wallets.filter((w) => w.chain === "EVM");
        const uniqueAddresses = [...new Set(evmWallets.map((w) => w.address.toLowerCase()))];
        // Focus on Ethereum, Polygon, Base, BSC, and Arbitrum for now (as per user request)
        const evmChains = ["ethereum", "polygon", "base", "bsc", "arbitrum"] as const;

        for (const address of uniqueAddresses) {
          console.log(`[NFT Store] Fetching EVM for ${address}(ID: ${currentInternalId})`);

          // Fetch owned NFTs
          const ownedPromises = evmChains.map(async (chain) => {
            try {
              return await openSeaNFTService.fetchUserNFTs(address, chain);
            } catch (e) { return []; }
          });

          // Fetch active listings
          const listingPromises = evmChains.map(async (chain) => {
            try {
              return await openSeaNFTService.fetchUserListings(address, chain);
            } catch (e) { return []; }
          });

          const [ownedResults, listingResults] = await Promise.all([
            Promise.all(ownedPromises),
            Promise.all(listingPromises)
          ]);

          const ownedNFTs = ownedResults.flat();
          const listedNFTs = listingResults.flat();

          console.log(`[NFT Store] EVM ${address}: ${ownedNFTs.length} owned, ${listedNFTs.length} listed`);

          // Merge: Update owned NFTs with listing info
          const mergedNFTs = ownedNFTs.map(nft => {
            const listing = listedNFTs.find(l =>
              l.contractAddress.toLowerCase() === nft.contractAddress.toLowerCase() &&
              l.tokenId === nft.tokenId
            );

            if (listing) {
              return {
                ...nft,
                isListed: true,
                listingPrice: listing.listingPrice,
                listingCurrency: listing.listingCurrency,
                listingId: listing.listingId
              };
            }

            return nft;
          });

          // Add any listed NFTs that aren't in owned (edge case: escrowed NFTs)
          const ownedIds = new Set(ownedNFTs.map(n => `${n.contractAddress}-${n.tokenId}`.toLowerCase()));
          const escrowedListings = listedNFTs.filter(l =>
            !ownedIds.has(`${l.contractAddress}-${l.tokenId}`.toLowerCase())
          );

          if (escrowedListings.length > 0) {
            console.log(`[NFT Store] Found ${escrowedListings.length} escrowed listings for ${address}`);
          }

          fetchedNFTs = [...fetchedNFTs, ...mergedNFTs, ...escrowedListings];
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
        console.log(`[NFT Store] Ignoring stale request ${currentInternalId} `);
        return;
      }

      // 6. Strict ECOSYSTEM Filtering (Double check)
      // This ensures that even if logic leaked, we forcefully clean it.
      let filteredByType = fetchedNFTs;
      if (targetEcosystem === "stargaze") filteredByType = filteredByType.filter(n => n.chain === "stargaze");
      else if (targetEcosystem === "evm") filteredByType = filteredByType.filter(n => ["ethereum", "polygon", "base", "bsc", "gnosis", "arbitrum", "optimism"].includes(n.chain));
      else if (targetEcosystem === "solana") filteredByType = filteredByType.filter(n => n.chain === "solana");

      // 7. Aggressive Deduplication (Content-Based)
      // We prioritize exact matches, then content matches (Name + TokenID) to merge cross-chain duplicates (like UD)
      const uniqueMap = new Map<string, NFT>();
      const contentMap = new Map<string, string>(); // Key: "name-tokenId", Value: fullKey

      filteredByType.forEach(nft => {
        // Find wallet info
        const wallet = wallets.find(w => w.address.toLowerCase() === nft.owner.toLowerCase());
        if (wallet) {
          nft.walletIcon = wallet.icon;
          nft.walletName = wallet.name;
        }

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
      console.log(`[NFT Store] Set ownedNFTs: ${finalNFTs.length} items(ID: ${currentInternalId})`);

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
            // Use the robust Stargaze service directly for consistent pagination & types
            const nfts = await stargazeNFTService.fetchUserNFTs(
              wallet.address,
              100,
              ownedNFTsOffset
            );

            newNFTs = [...newNFTs, ...nfts];
          } catch (error) {
            console.error(
              `[NFT Store] Error loading more NFTs for ${wallet.address}: `,
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
    console.log(`[NFT Store] fetchMarketplaceNFTs called for ecosystem: ${ecosystem || get().activeEcosystem}`);


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
      // If no specific collection/search is set, we fetch listings for the CONNECTED USER (My Listings)
      if (targetEcosystem === "all" || targetEcosystem === "evm") {
        try {
          // If viewing generic marketplace without filters, default to "My Listings" for now
          // or if user specifically asked for their listings (implicit in dashboard view)

          if (!targetFilters.collection && !targetFilters.search) {
            const walletStore = useWalletStore.getState();
            // Deduplicate wallets by address to prevent duplicate queries
            const evmWallets = walletStore.wallets.filter(w => w.chain === "EVM");
            const uniqueWallets = Array.from(new Map(evmWallets.map(w => [w.address.toLowerCase(), w])).values());

            console.log(`[NFT Store] DEBUG: Found ${evmWallets.length} EVM wallets, deduped to ${uniqueWallets.length}`);
            uniqueWallets.forEach(w => console.log(`[NFT Store] DEBUG: Wallet: ${w.address}`));

            // Chains supported by OpenSea Orders API
            const openseaChains = ["ethereum", "polygon", "base", "bsc", "arbitrum", "optimism"];

            for (const wallet of uniqueWallets) {
              // OpenSea makers query is chain-specific. We need to check all relevant chains.
              // We runs these in parallel for the wallet to speed it up
              const listingsPromises = openseaChains.map(chain =>
                openSeaNFTService.fetchMarketplaceListings({
                  ...targetFilters,
                  seller: wallet.address,
                  chain: chain
                }).then(results => {
                  console.log(`[NFT Store] DEBUG: Chain ${chain} returned ${results.length} listings`);
                  return results;
                }).catch(e => {
                  console.warn(`Failed to fetch listings for ${chain}:`, e);
                  return [];
                })
              );

              const results = await Promise.all(listingsPromises);
              const flattened = results.flat();
              console.log(`[NFT Store] DEBUG: Total listings for wallet ${wallet.address}: ${flattened.length}`);
              allListings = [...allListings, ...flattened];
            }
          } else {
            // Normal fetch with filters (e.g. collection specified)
            const listings = await openSeaNFTService.fetchMarketplaceListings(targetFilters);
            allListings = [...allListings, ...listings];
          }
        } catch (error) {
          console.error("Error fetching OpenSea marketplace:", error);
        }
      }

      // Fetch from Magic Eden marketplace
      if (targetEcosystem === "all" || targetEcosystem === "solana") {
        try {
          // If no specific collection/search, try to fetch user's listings
          if (!targetFilters.collection && !targetFilters.search) {
            const walletStore = useWalletStore.getState();
            const solanaWallet = walletStore.wallets.find(w => w.chain === "Solana");

            if (solanaWallet) {
              console.log(`[NFT Store] Fetching Magic Eden listings for wallet: ${solanaWallet.address}`);
              const listings = await magicEdenNFTService.fetchMarketplaceListings({
                ...targetFilters,
                seller: solanaWallet.address
              });
              allListings = [...allListings, ...listings];
            } else {
              // Fallback to popular if no wallet
              const listings = await magicEdenNFTService.fetchMarketplaceListings(targetFilters);
              allListings = [...allListings, ...listings];
            }
          } else {
            const listings = await magicEdenNFTService.fetchMarketplaceListings(targetFilters);
            allListings = [...allListings, ...listings];
          }
        } catch (error) {
          console.error("Error fetching Magic Eden marketplace:", error);
        }
      }

      // Deduplicate listings by listingId
      const uniqueListings = Array.from(new Map(allListings.map(l => [l.listingId, l])).values());

      set({ marketplaceNFTs: uniqueListings, isLoadingMarketplace: false });
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
            buyerWallet.walletProvider
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
  listNFT: async (nft: NFT, price: string, currency: string, durationInSeconds?: number) => {
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
      // First try to find exact wallet match
      let sellerWallet = walletStore.wallets.find(
        (w) => w.address === nft.owner && w.chain === walletChainType,
      );

      // Fallback: If strict match fails (e.g. casing differences or indexer lag), 
      // check if we have ANY wallet of this chain type connected.
      // Since the user is viewing "My NFTs", they likely own it.
      if (!sellerWallet) {
        sellerWallet = walletStore.wallets.find((w) => w.chain === walletChainType);
      }

      if (!sellerWallet) {
        throw new Error("You must own this NFT to list it (or connect the correct wallet)");
      }

      let listingId: string;

      switch (nft.chain) {
        case "stargaze":
          listingId = await stargazeNFTService.listNFT(
            nft,
            price,
            currency,
            sellerWallet.address,
            durationInSeconds
          );
          break;
        case "ethereum":
        case "polygon":
        case "base":
        case "bsc":
        case "gnosis":
        case "arbitrum":
        case "optimism":
          listingId = await openSeaNFTService.listNFT(
            nft,
            price,
            currency,
            sellerWallet.address,
            durationInSeconds,
            sellerWallet.walletProvider
          );
          break;
        case "solana":
          listingId = await magicEdenNFTService.listNFT(
            nft,
            price,
            currency,
            sellerWallet.address,
            durationInSeconds,
            sellerWallet.walletProvider
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
  cancelListing: async (nft: NFT) => {
    set({ isListing: true, error: null });

    try {
      const walletStore = useWalletStore.getState();

      // Helper to map NFT chain to wallet ChainType
      const getWalletChainType = (nftChain: string): string => {
        if (nftChain === "stargaze") return "Cosmos";
        if (nftChain === "ethereum" || nftChain === "polygon") return "EVM";
        if (nftChain === "solana") return "Solana";
        return nftChain;
      };

      const walletChainType = getWalletChainType(nft.chain);
      const sellerWallet = walletStore.wallets.find(
        (w) => w.address.toLowerCase() === nft.owner.toLowerCase() && w.chain === walletChainType,
      );

      // Fallback: Just try to find a wallet of the correct type if owner check fails (legacy data?)
      const wallet = sellerWallet || walletStore.wallets.find(w => w.chain === walletChainType);

      if (!wallet) {
        throw new Error(`No connected wallet found for ${nft.chain}`);
      }

      const listingId = nft.listingId;
      if (!listingId) {
        throw new Error("NFT listing ID not found. Cannot cancel.");
      }

      console.log(`[NFT Store] Canceling listing ${listingId} on ${nft.chain} `);

      switch (nft.chain) {
        case "stargaze":
          await stargazeNFTService.cancelListing(listingId, wallet.address);
          break;
        case "ethereum":
        case "polygon":
        case "base":
        case "bsc":
        case "gnosis":
        case "arbitrum":
        case "optimism":
          await openSeaNFTService.cancelListing(
            listingId,
            wallet.address,
            nft.chain,
            wallet.walletProvider
          );
          break;
        case "solana":
          await magicEdenNFTService.cancelListing(
            listingId,
            wallet.address,
            wallet.walletProvider
          );
          break;
        default:
          throw new Error(`Cancellation not supported for ${nft.chain} yet`);
      }

      // OPTIMISTIC UPDATE: Update state immediately without waiting for API
      // 1. Remove from marketplace listings if present
      const currentMarketplace = get().marketplaceNFTs;
      set({
        marketplaceNFTs: currentMarketplace.filter(item => item.listingId !== listingId)
      });

      // 2. Update owned NFTs state to reflect unlisting
      const currentOwned = get().ownedNFTs;
      set({
        ownedNFTs: currentOwned.map(item => {
          if (item.id === nft.id) {
            return {
              ...item,
              isListed: false,
              listingPrice: undefined,
              listingCurrency: undefined,
              marketplace: undefined,
              listingId: undefined
            };
          }
          return item;
        })
      });

      set({ isListing: false, selectedNFT: null }); // Close modal immediately

      // Refresh NFTs after cancellation in background (eventual consistency)
      get().refreshNFTs();

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

  transferNFT: async (nft: NFT, recipientAddress: string) => {
    set({ isTransferring: true, error: null });

    try {
      const walletStore = useWalletStore.getState();

      // Helper to map NFT chain to wallet ChainType
      const getWalletChainType = (nftChain: string): string => {
        if (nftChain === "stargaze") return "Cosmos";
        if (nftChain === "ethereum" || nftChain === "polygon") return "EVM";
        if (nftChain === "solana") return "Solana";
        return nftChain;
      };

      const walletChainType = getWalletChainType(nft.chain);
      const ownerWallet = walletStore.wallets.find(
        (w) => w.address.toLowerCase() === nft.owner.toLowerCase() && w.chain === walletChainType,
      );

      // Fallback: Just try to find a wallet of the correct type if owner check fails
      const wallet = ownerWallet || walletStore.wallets.find(w => w.chain === walletChainType);

      if (!wallet) {
        throw new Error(`No connected wallet found for ${nft.chain}`);
      }

      console.log(`[NFT Store] Transferring NFT ${nft.tokenId} on ${nft.chain} to ${recipientAddress}`);

      let txHash: string;

      switch (nft.chain) {
        case "stargaze":
          txHash = await stargazeNFTService.transferNFT(nft, recipientAddress, wallet.address);
          break;
        case "ethereum":
        case "polygon":
        case "base":
        case "arbitrum":
          txHash = await openSeaNFTService.transferNFT(nft, recipientAddress, wallet.address, wallet.walletProvider);
          break;
        case "solana":
          console.log(`[NFT Store] Delegating Solana transfer to magicEdenNFTService using provider: ${wallet.walletProvider}`);
          txHash = await magicEdenNFTService.transferNFT(nft, recipientAddress, wallet.address, wallet.walletProvider);
          break;
        default:
          console.error(`[NFT Store] Transfer generic error: Chain ${nft.chain} not supported`);
          throw new Error(`Transfer not supported for ${nft.chain} yet`);
      }

      console.log(`[NFT Store] Transfer successful: ${txHash}`);

      // OPTIMISTIC UPDATE: Remove NFT from owned list immediately
      const currentOwned = get().ownedNFTs;
      set({
        ownedNFTs: currentOwned.filter(item => item.id !== nft.id)
      });

      set({ isTransferring: false, selectedNFT: null }); // Close modal immediately

      // Refresh NFTs after transfer in background (eventual consistency)
      get().refreshNFTs();

      return txHash;
    } catch (error) {
      console.error("Error transferring NFT:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to transfer NFT",
        isTransferring: false,
      });
      throw error;
    }
  },

  burnNFT: async (nft: NFT) => {
    set({ isBurning: true, error: null });

    try {
      const walletStore = useWalletStore.getState();

      // Helper to map NFT chain to wallet ChainType
      const getWalletChainType = (nftChain: string): string => {
        if (nftChain === "stargaze") return "Cosmos";
        if (nftChain === "ethereum" || nftChain === "polygon") return "EVM";
        if (nftChain === "solana") return "Solana";
        return nftChain;
      };

      const walletChainType = getWalletChainType(nft.chain);
      const ownerWallet = walletStore.wallets.find(
        (w) => w.address.toLowerCase() === nft.owner.toLowerCase() && w.chain === walletChainType,
      );

      // Fallback: Just try to find a wallet of the correct type if owner check fails
      const wallet = ownerWallet || walletStore.wallets.find(w => w.chain === walletChainType);

      if (!wallet) {
        throw new Error(`No connected wallet found for ${nft.chain}`);
      }

      console.log(`[NFT Store] Burning NFT ${nft.tokenId} on ${nft.chain}`);

      let txHash: string;

      switch (nft.chain) {
        case "stargaze":
          txHash = await stargazeNFTService.burnNFT(nft, wallet.address);
          break;
        // Future: Add EVM and Solana support
        // case "ethereum":
        // case "polygon":
        //   txHash = await openSeaNFTService.burnNFT(nft, wallet.address);
        //   break;
        // case "solana":
        //   txHash = await magicEdenNFTService.burnNFT(nft, wallet.address);
        //   break;
        default:
          throw new Error(`Burn not supported for ${nft.chain} yet`);
      }

      console.log(`[NFT Store] Burn successful: ${txHash}`);

      // OPTIMISTIC UPDATE: Remove NFT from owned list immediately
      const currentOwned = get().ownedNFTs;
      set({
        ownedNFTs: currentOwned.filter(item => item.id !== nft.id)
      });

      set({ isBurning: false, selectedNFT: null }); // Close modal immediately

      // Refresh NFTs after burn in background (eventual consistency)
      get().refreshNFTs();

      return txHash;
    } catch (error) {
      console.error("Error burning NFT:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to burn NFT",
        isBurning: false,
      });
      throw error;
    }
  },

  createAuction: async (nft: NFT, reservePrice: string, currency: string, durationInSeconds: number) => {
    set({ isCreatingAuction: true, error: null });

    try {
      const walletStore = useWalletStore.getState();

      // Helper to map NFT chain to wallet ChainType
      const getWalletChainType = (nftChain: string): string => {
        if (nftChain === "stargaze") return "Cosmos";
        if (nftChain === "ethereum" || nftChain === "polygon") return "EVM";
        if (nftChain === "solana") return "Solana";
        return nftChain;
      };

      const walletChainType = getWalletChainType(nft.chain);
      const ownerWallet = walletStore.wallets.find(
        (w) => w.address.toLowerCase() === nft.owner.toLowerCase() && w.chain === walletChainType,
      );

      // Fallback: Just try to find a wallet of the correct type if owner check fails
      const wallet = ownerWallet || walletStore.wallets.find(w => w.chain === walletChainType);

      if (!wallet) {
        throw new Error(`No connected wallet found for ${nft.chain}`);
      }

      // Convert currency to denom and amount to micro-units
      const CURRENCY_TO_DENOM: Record<string, string> = {
        'STARS': 'ustars',
        'OSMO': 'ibc/ED07A3391A112B175915CD8FAF43A2DA8E4790EDE12566649D0C2F97716B8518',
        'ATOM': 'ibc/9DF365E2C0EF4EA02FA771F638E6F566B96D7437704258E298F5670B8F804368'
      };

      const denom = CURRENCY_TO_DENOM[currency] || 'ustars';

      // Convert price to micro-units (multiply by 1,000,000)
      const priceInMicroUnits = (parseFloat(reservePrice) * 1_000_000).toString();

      console.log(`[NFT Store] Creating auction for NFT ${nft.tokenId} on ${nft.chain}`);
      console.log(`Reserve price: ${priceInMicroUnits} ${denom}, Duration: ${durationInSeconds}s`);

      let txHash: string;

      switch (nft.chain) {
        case "stargaze":
          txHash = await stargazeNFTService.createAuction(
            nft,
            priceInMicroUnits,
            denom,
            durationInSeconds,
            wallet.address
          );
          break;
        // Future: Add EVM and Solana support
        default:
          throw new Error(`Auction not supported for ${nft.chain} yet`);
      }

      console.log(`[NFT Store] Auction created successfully: ${txHash}`);

      // Refresh NFTs after auction creation
      get().refreshNFTs();

      set({ isCreatingAuction: false, selectedNFT: null }); // Close modal

      return txHash;
    } catch (error) {
      console.error("Error creating auction:", error);
      set({
        error:
          error instanceof Error ? error.message : "Failed to create auction",
        isCreatingAuction: false,
      });
      throw error;
    }
  },

  fetchCollectionStats: async (contractAddress: string, chain: string) => {
    try {
      if (chain === 'stargaze') {
        return await stargazeNFTService.getCollectionStats(contractAddress);
      }
      // Fallback for EVM (OpenSea)
      // Note: OpenSea service currently has a stub for getCollectionStats
      if (['ethereum', 'polygon', 'base', 'bsc', 'arbitrum', 'optimism', 'avalanche'].includes(chain)) {
        return await openSeaNFTService.getCollectionStats(contractAddress);
      }
      return null;
    } catch (error) {
      console.error("Failed to fetch collection stats:", error);
      return null;
    }
  },
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
