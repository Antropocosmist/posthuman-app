
import { CosmWasmClient } from '@cosmjs/cosmwasm-stargate';

const RPC_ENDPOINT = 'https://rpc.stargaze-apis.com';
const GRAPHQL_ENDPOINT = 'https://graphql.mainnet.stargaze-apis.com/graphql';
const MARKETPLACE_CONTRACT = 'stars1e6g3yhasf7cr2vnae7qxytrys4e8v8wchyj377juvxfk9k6t695s38jkgw';

async function main() {
    console.log('Fetching sample data from GraphQL (trying "address" field)...');

    // Simple query to get ANY valid collection
    const query = `
        query GetSample {
            tokens(limit: 1) {
                tokens {
                    tokenId
                    collection {
                        contractAddress
                    }
                    owner {
                        address 
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
            // Try fallback if "address" is also wrong?
            // Common alternate is just returning string if owner is scalar? No error said "WalletAccount".
            return;
        }

        const sample = gqlData.data.tokens.tokens[0];
        const collectionAddr = sample.collection.contractAddress;
        const ownerAddr = sample.owner?.address || 'stars1...';

        console.log(`Found sample: Collection=${collectionAddr}, Owner=${ownerAddr}`);

        console.log('\nConnecting to Stargaze RPC...');
        const client = await CosmWasmClient.connect(RPC_ENDPOINT);
        console.log('Connected.');

        // Test 1: asks_by_creator_collection
        console.log(`\n--- Testing "asks_by_creator_collection" ---`);
        try {
            const response = await client.queryContractSmart(MARKETPLACE_CONTRACT, {
                asks_by_creator_collection: {
                    collection: collectionAddr,
                    creator: ownerAddr,
                    limit: 1
                }
            });
            console.log('Result:', JSON.stringify(response).slice(0, 500));
        } catch (e: any) {
            console.log('Error testing asks_by_creator_collection:', e.message);
        }

        // Test 2: asks_by_collection_denom
        console.log(`\n--- Testing "asks_by_collection_denom" ---`);
        try {
            // We need a denom. ustars is standard.
            // If collection has different denom, this returns empty.
            const response = await client.queryContractSmart(MARKETPLACE_CONTRACT, {
                asks_by_collection_denom: {
                    collection: collectionAddr,
                    denom: 'ustars',
                    limit: 1
                }
            });
            console.log('Result:', JSON.stringify(response).slice(0, 500));
        } catch (e: any) {
            console.log('Error testing asks_by_collection_denom:', e.message);
        }

    } catch (e) {
        console.error('Script failed:', e);
    }
}

main().catch(console.error);
