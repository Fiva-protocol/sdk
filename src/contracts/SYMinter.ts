import { Address, beginCell, Cell, Contract, ContractProvider } from '@ton/core';

export class SYJettonMinter implements Contract {
    constructor(readonly address: Address) {}

    static createFromAddress(address: Address) {
        return new SYJettonMinter(address);
    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(owner).endCell() },
        ]);
        return res.stack.readAddress();
    }

    async getUnderlyingAddress(provider: ContractProvider): Promise<Address> {
        let res = await provider.get('get_underlying_address', []);
        return res.stack.readAddress();
    }

    async getPoolAddress(provider: ContractProvider): Promise<Address> {
        let res = await provider.get('get_pool_address', []);
        return res.stack.readAddress();
    }

    async getYTMinterAddress(provider: ContractProvider): Promise<Address> {
        let res = await provider.get('get_yt_minter_address', []);
        return res.stack.readAddress();
    }

    async getJettonData(
        provider: ContractProvider,
    ): Promise<{ totalSupply: bigint; mintable: boolean; adminAddress: Address; content: Cell; walletCode: Cell }> {
        let res = await provider.get('get_jetton_data', []);
        let totalSupply = res.stack.readBigNumber();
        let mintable = res.stack.readBoolean();
        let adminAddress = res.stack.readAddress();
        let content = res.stack.readCell();
        let walletCode = res.stack.readCell();
        return {
            totalSupply,
            mintable,
            adminAddress,
            content,
            walletCode,
        };
    }

    async getTotalSupply(provider: ContractProvider): Promise<bigint> {
        let res = await this.getJettonData(provider);
        return res.totalSupply;
    }

    async getMaxTotalSupply(provider: ContractProvider): Promise<{ maxTotalSupply: bigint; totalSupply: bigint }> {
        const res = await provider.get('get_max_total_supply', []);
        return {
            maxTotalSupply: res.stack.readBigNumber(),
            totalSupply: res.stack.readBigNumber(),
        };
    }

    async getFeesEstimation(provider: ContractProvider, op: number): Promise<{ value: bigint; fwdValue: bigint }> {
        const res = await provider.get('get_gas_estimation', [{ type: 'int', value: BigInt(op) }]);
        return {
            value: res.stack.readBigNumber(),
            fwdValue: res.stack.readBigNumber(),
        };
    }

    async getIndex(provider: ContractProvider): Promise<bigint> {
        try {
            const res = await provider.get('get_index', []);
            return res.stack.readBigNumber();
        } catch (e) {
            return 0n;
        }
    }

    async getUnderlyingPrecision(provider: ContractProvider): Promise<number> {
        let res = await provider.get('get_underlying_precision', []);
        return res.stack.readNumber();
    }
}
