import { Address, beginCell, Cell, Contract, ContractProvider } from '@ton/core';
import { SYOp } from '../helpers/opcodes';

export class YTJettonMinter implements Contract {
    constructor(readonly address: Address) {}

    static createFromAddress(address: Address) {
        return new YTJettonMinter(address);
    }

    async getWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(owner).endCell() },
        ]);
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

    async getIndex(provider: ContractProvider): Promise<{ index: bigint; index_update_timestamp: bigint }> {
        const res = await provider.get('get_index', []);
        const index = res.stack.readBigNumber();
        const index_update_timestamp = res.stack.readBigNumber();
        return { index, index_update_timestamp };
    }

    async getJettonAddresses(
        provider: ContractProvider,
    ): Promise<{ syWalletAddress: Address; ptMinterAddress: Address; ptWalletAddress: Address }> {
        const res = await provider.get('get_jetton_addresses', []);
        const addrCell = res.stack.readCell();
        const cs = addrCell.beginParse();
        return {
            syWalletAddress: cs.loadAddress(),
            ptMinterAddress: cs.loadAddress(),
            ptWalletAddress: cs.loadAddress(),
        };
    }

    async getPtTotalSupply(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_pt_total_supply', []);
        return res.stack.readBigNumber();
    }

    async getMintYtPtOut(
        provider: ContractProvider,
        syAmount: bigint,
    ): Promise<{ yt_amount: bigint; pt_amount: bigint }> {
        const res = await provider.get('get_mint_yt_pt_out', [{ type: 'int', value: syAmount }]);
        return {
            yt_amount: res.stack.readBigNumber(),
            pt_amount: res.stack.readBigNumber(),
        };
    }

    async getRedeemSyOutBeforeMaturity(
        provider: ContractProvider,
        ytAmount: bigint,
        ptAmount: bigint,
    ): Promise<{ sy_amount: bigint; max_sy_available: bigint }> {
        const res = await provider.get('get_redeem_sy_out_before_maturity', [
            { type: 'int', value: ytAmount },
            { type: 'int', value: ptAmount },
        ]);
        return { sy_amount: res.stack.readBigNumber(), max_sy_available: res.stack.readBigNumber() };
    }

    async getRedeemSyOutAfterMaturity(
        provider: ContractProvider,
        ptAmount: bigint,
    ): Promise<{ sy_amount: bigint; max_sy_available: bigint }> {
        const res = await provider.get('get_redeem_sy_out_after_maturity', [{ type: 'int', value: ptAmount }]);
        return { sy_amount: res.stack.readBigNumber(), max_sy_available: res.stack.readBigNumber() };
    }

    async getClaimableInterest(
        provider: ContractProvider,
        ytAmount: bigint,
        lastCollectedIndex: bigint,
        acquiredAmount: bigint,
    ): Promise<{ interest: bigint; protocolFee: bigint }> {
        const res = await provider.get('get_claimable_interest', [
            { type: 'int', value: ytAmount },
            { type: 'int', value: lastCollectedIndex },
            { type: 'int', value: acquiredAmount },
        ]);
        return { interest: res.stack.readBigNumber(), protocolFee: res.stack.readBigNumber() };
    }

    static claimInterestAndUnwrap(recipient: Address, queryId: number): Cell {
        return (
            beginCell()
                .storeUint(SYOp.claim_interest_and_unwrap, 32)
                .storeUint(queryId, 64)
                .storeAddress(recipient)
                // .storeMaybeRef(null)
                .endCell()
        );
    }

    static redeemMessage(op: number, responseAddress: Address, queryId: number): Cell {
        return beginCell()
            .storeUint(op, 32)
            .storeUint(queryId, 64)
            .storeAddress(responseAddress)
            .storeCoins(0n)
            .endCell();
    }
}
