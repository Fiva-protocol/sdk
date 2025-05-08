const INDEX_PRECISION = 1_000_000n;
const JETTON_PRECISION = 1_000_000_000n;
const USDT_PRECISION = 1_000_000n;

// Convert Evaa USDT to SY (intermediate FIVA asset)
export const evaaUsdtToSy = (amount: bigint, index: bigint): bigint => {
    return (amount * JETTON_PRECISION * INDEX_PRECISION) / index;
};

// Convert any other asset to SY
export const assetToSy = (amount: bigint, index: bigint): bigint => {
    return amount * JETTON_PRECISION;
};

// Convert SY to Evaa USDT back
export const syToEvaaUsdt = (amount: bigint, index: bigint): bigint => {
    return (amount * index) / INDEX_PRECISION / 1000n;
};

// Convert SY to any other asset
export const syToAsset = (amount: bigint): bigint => {
    return amount;
};

// Convert USDT to user representation
export const UsdtToUserRepr = (amount: bigint): string => {
    return (Number(amount) / Number(USDT_PRECISION)).toFixed(3);
};

// Convert any 9-digits jetton to user representation
export const JettonToUserRepr = (amount: bigint): string => {
    return (Number(amount) / Number(JETTON_PRECISION)).toFixed(3);
};

export const UserReprToUsdt = (amount: string): bigint => {
    return BigInt(Number(amount) * Number(USDT_PRECISION));
};

export const UserReprToJetton = (amount: string): bigint => {
    return BigInt(Number(amount) * Number(JETTON_PRECISION));
};
