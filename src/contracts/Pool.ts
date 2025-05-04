import { Address, beginCell, Cell, Contract, ContractProvider } from '@ton/core';
import { PoolOp, SYOp } from '../helpers/opcodes';

export enum PoolType {
    CONST_PRODUCT,
    CURVE_STABLE,
    CUBE_STABLE,
}

export class Pool implements Contract {
    constructor(
        readonly address: Address,
        readonly poolType: PoolType,
    ) {}

    static createFromAddress(address: Address) {
        return new Pool(address, PoolType.CUBE_STABLE);
    }

    async getLpWalletAddress(provider: ContractProvider, owner: Address): Promise<Address> {
        const res = await provider.get('get_wallet_address', [
            { type: 'slice', cell: beginCell().storeAddress(owner).endCell() },
        ]);
        return res.stack.readAddress();
    }

    async getPoolBalances(
        provider: ContractProvider,
    ): Promise<{ lp_amount: bigint; sy_amount: bigint; pt_amount: bigint }> {
        const res = await provider.get('get_pool_balances', []);
        return {
            lp_amount: res.stack.readBigNumber(),
            sy_amount: res.stack.readBigNumber(),
            pt_amount: res.stack.readBigNumber(),
        };
    }

    async getExpectedSwapAmountOut(
        provider: ContractProvider,
        fromAddr: Address,
        toAddr: Address,
        amountIn: bigint,
    ): Promise<bigint> {
        const res = await provider.get('get_expected_swap_amount_out', [
            {
                type: 'slice',
                cell: beginCell().storeAddress(fromAddr).endCell(),
            },
            {
                type: 'slice',
                cell: beginCell().storeAddress(toAddr).endCell(),
            },
            {
                type: 'int',
                value: amountIn,
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getLpOut(provider: ContractProvider, sy_amount: bigint, pt_amount: bigint): Promise<bigint> {
        const res = await provider.get('get_lp_out', [
            {
                type: 'int',
                value: sy_amount,
            },
            {
                type: 'int',
                value: pt_amount,
            },
        ]);
        return res.stack.readBigNumber();
    }

    async getSyPtOut(provider: ContractProvider, lpAmount: bigint): Promise<{ sy_amount: bigint; pt_amount: bigint }> {
        const res = await provider.get('get_sy_pt_out', [{ type: 'int', value: lpAmount }]);
        return {
            sy_amount: res.stack.readBigNumber(),
            pt_amount: res.stack.readBigNumber(),
        };
    }

    async getFeeEstimation(provider: ContractProvider, op: number): Promise<{ value: bigint; fwdValue: bigint }> {
        const res = await provider.get('get_fee_estimation', [
            { type: 'int', value: BigInt(op) },
            { type: 'int', value: 0n },
        ]);
        return {
            value: res.stack.readBigNumber(),
            fwdValue: res.stack.readBigNumber(),
        };
    }

    async getVersion(provider: ContractProvider): Promise<bigint> {
        const res = await provider.get('get_version', []);
        return res.stack.readBigNumber();
    }

    async getJettonAddresses(provider: ContractProvider): Promise<{
        syAddr: Address;
        ptAddr: Address;
        ytAddr: Address;
        ytMinterAddr: Address;
        syMinterAddr?: Address;
    }> {
        const res = await provider.get('get_jetton_addresses', []);
        const result: {
            syAddr: Address;
            ptAddr: Address;
            ytAddr: Address;
            ytMinterAddr: Address;
            syMinterAddr?: Address;
        } = {
            syAddr: res.stack.readAddress(),
            ptAddr: res.stack.readAddress(),
            ytAddr: res.stack.readAddress(),
            ytMinterAddr: res.stack.readAddress(),
        };

        try {
            result.syMinterAddr = res.stack.readAddress();
        } catch (e) {
            // If syMinterAddr is not present, it will be undefined
            result.syMinterAddr = undefined;
        }

        return result;
    }

    async getPoolConfig(provider: ContractProvider) {
        const res = await provider.get('get_pool_config', []);
        if (this.poolType === PoolType.CURVE_STABLE)
            return {
                ownerAddr: res.stack.readAddress(),
                maintainerAddr: res.stack.readAddress(),
                protocolFee: res.stack.readBigNumber(),
                lpFee: res.stack.readBigNumber(),
                refFee: res.stack.readBigNumber(),
                feeDivider: res.stack.readNumber(),
                feeTreasuryAddr: res.stack.readAddress(),
                amplificationCoefficient: res.stack.readBigNumber(),
            };
        return {
            ownerAddr: res.stack.readAddress(),
            maintainerAddr: res.stack.readAddress(),
            protocolFee: res.stack.readBigNumber(),
            lpFee: res.stack.readBigNumber(),
            refFee: res.stack.readBigNumber(),
            feeDivider: res.stack.readNumber(),
            feeTreasuryAddr: res.stack.readAddress(),
            index: res.stack.readBigNumber(),
            expectedIndex: res.stack.readBigNumber(),
            indexUpdaterAddr: res.stack.readAddress(),
        };
    }

    static addLiquidityMessage(receiverAddress: Address, minLpOut: bigint, queryId: number): Cell {
        return beginCell()
            .storeUint(SYOp.add_liquidity, 32)
            .storeUint(queryId, 64)
            .storeAddress(receiverAddress)
            .storeCoins(minLpOut)
            .storeUint(1, 1)
            .endCell();
    }

    static wrapAndAddLiquidityMessage(receiverAddress: Address, minLpOut: bigint): Cell {
        return beginCell()
            .storeUint(SYOp.wrap_and_add_liquidity, 32)
            .storeAddress(receiverAddress)
            .storeCoins(minLpOut)
            .endCell();
    }

    static redeemLpMessage() {
        return beginCell().storeUint(PoolOp.redeem_lp, 32).endCell();
    }
}
