const JETTON_PRECISION = 1_000_000_000n;
const USDT_PRECISION = 1_000_000n;

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
