import { Address } from '@ton/ton';
import { TelegramAuthData } from './telegramAuth';
import { sha256 } from '@noble/hashes/sha256';

export interface WalletInfo {
    address: Address;
    workchain: number;
    userId: number;
    telegramUsername?: string;
    createdAt: number;
}

export function generateTurnkeyWalletFromTelegram(telegramData: TelegramAuthData): WalletInfo {
    const seedString = `telegram_wallet_${telegramData.user.id}_${telegramData.user.first_name}`;
    const seedHash = sha256(new TextEncoder().encode(seedString));
    const addressBytes = new Uint8Array(32);
    addressBytes.set(seedHash.slice(0, 32));
    const address = Address.parseRaw(`0:${Buffer.from(addressBytes).toString('hex')}`);

    return {
        address,
        workchain: 0,
        userId: telegramData.user.id,
        telegramUsername: telegramData.user.username,
        createdAt: Date.now()
    };
}