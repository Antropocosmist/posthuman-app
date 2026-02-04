
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';

const RPC_ENDPOINT = 'https://rpc.stargaze-apis.com';
const GRAPHQL_ENDPOINT = 'https://graphql.mainnet.stargaze-apis.com/graphql';
const MARKETPLACE_CONTRACT = 'stars1e6g3yhasf7cr2vnae7qxytrys4e8v8wchyj377juvxfk9k6t695s38jkgw';

async function main() {
    console.log('Fetching LISTED token from GraphQL to get a valid seller/collection...');

    // Using the NEW query structure I put in the code
    const query = `
        query GetSample {
            tokens(limit: 1, filterForSale: LISTED, sortBy: PRICE_ASC) {
                tokens {
                    tokenId
                    collection {
                        contractAddress
                    }
                    owner {
                        address 
                    }
                    listPrice {
                        amount
                        denom
                    }
                }
            }
        }
    `;

    try {
        const gqlResponse = await fetch(GRAPHQL_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query })
        });

        const gqlData = await gqlResponse.json();

        if (!gqlData.data?.tokens?.tokens?.length) {
            console.error('Failed to fetch sample token from GraphQL. Response:', JSON.stringify(gqlData));
            return;
        }

        const sample = gqlData.data.tokens.tokens[0];
        const collectionAddr = sample.collection.contractAddress;

        // IMPORTANT: In Stargaze V2, if listed, the "owner" returned by indexer might be the owner who listed it?
        // Or is it the escrow contract?
        // Let's print it.
        const sellerAddr = sample.owner?.address;

        console.log(`Found sample: Collection=${collectionAddr}, Seller=${sellerAddr}, TokenID=${sample.tokenId}`);

        if (!sellerAddr) {
            console.error('No seller address found in GraphQL response.');
            return;
        }

        console.log('\nConnecting to Stargaze RPC...');
        const client = await CosmWasmClient.connect(RPC_ENDPOINT);
        console.log('Connected.');

        // Test: asks_by_creator_collection
        console.log(`\n--- Testing "asks_by_creator_collection" for seller=${sellerAddr} ---`);
        try {
            const queryMsg = {
                asks_by_creator_collection: {
                    collection: collectionAddr,
                    creator: sellerAddr,
                    query_options: {
                        limit: 100
                    }
                }
            };
            console.log('Query payload:', JSON.stringify(queryMsg));

            const response = await client.queryContractSmart(MARKETPLACE_CONTRACT, queryMsg);
            console.log('SUCCESS! Response:', JSON.stringify(response).slice(0, 500));

            // Verify our token is in there
            const found = response.asks?.find((a: any) => String(a.token_id) === String(sample.tokenId));
            if (found) {
                console.log('SUCCESS: Found our token in the seller\'s asks!');
                console.log('Ask ID:', found.id);
            } else {
                console.warn('WARNING: Did not find the specific token in the asks. (Maybe pagination limit? or consistency issue?)');
            }

        } catch (e: any) {
            console.error('FAILED testing asks_by_creator_collection:', e.message);
        }

    } catch (e) {
        console.error('Script failed:', e);
    }
}

main().catch(console.error);
