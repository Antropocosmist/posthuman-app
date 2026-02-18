
export interface DasAttribute {
    trait_type: string;
    value: string;
}

export interface DasFile {
    uri: string;
    cdn_uri?: string;
    mime: string;
}

export interface DasCreator {
    address: string;
    share: number;
    verified: boolean;
}

export interface DasGrouping {
    group_key: string;
    group_value: string;
}

export interface DasAsset {
    interface: string; // "V1_NFT", "V2_NFT", "ProgrammableNFT", "CompressedNFT"
    id: string;
    content: {
        $schema: string;
        json_uri: string;
        files: DasFile[];
        metadata: {
            attributes?: DasAttribute[];
            description: string;
            name: string;
            symbol: string;
        };
        links: {
            image?: string;
            external_url?: string;
        };
    };
    authorities?: {
        address: string;
        scopes: string[];
    }[];
    compression?: {
        eligible: boolean;
        compressed: boolean;
        data_hash: string;
        creator_hash: string;
        asset_hash: string;
        tree: string;
        seq: number;
        leaf_id: number;
    };
    grouping?: DasGrouping[];
    royalty?: {
        royalty_model: string;
        target: string;
        percent: number;
        basis_points: number;
        primary_sale_happened: boolean;
        locked: boolean;
    };
    creators?: DasCreator[];
    ownership: {
        frozen: boolean;
        delegated: boolean;
        forced_transfer: boolean;
        owner: string;
        ownership_model: string;
    };
    supply?: {
        print_max_supply: number;
        print_current_supply: number;
        edition_nonce: number;
    };
    mutable: boolean;
    burnt: boolean;
}

export interface DasResponse {
    result: {
        total: number;
        limit: number;
        page: number;
        items: DasAsset[];
    };
}
