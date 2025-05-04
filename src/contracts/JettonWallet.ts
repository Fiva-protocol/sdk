import { Address, beginCell, Cell, Contract, ContractProvider, Sender, SendMode } from '@ton/core';
import { JettonOp, SYOp } from '../helpers/opcodes';
import { Pool } from './Pool';
import { YTJettonMinter } from './YTMinter';

export class JettonWallet implements Contract {
    constructor(readonly address: Address) {}

    static createFromAddress(address: Address) {
        return new JettonWallet(address);
    }

    async getWalletData(provider: ContractProvider): Promise<{
        balance: bigint;
        ownerAddress: Address;
        minterAddress: Address;
        walletCode: Cell;
    }> {
        const result = await provider.get('get_wallet_data', []);

        const balance = result.stack.readBigNumber();
        const ownerAddress = result.stack.readAddress();
        const minterAddress = result.stack.readAddress();
        const walletCode = result.stack.readCell();

        return {
            balance,
            ownerAddress,
            minterAddress,
            walletCode,
        };
    }

    static transferMessage(
        jetton_amount: bigint,
        to: Address,
        responseAddress: Address,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null,
        queryId: number = 0,
    ): Cell {
        return beginCell()
            .storeUint(JettonOp.transfer, 32)
            .storeUint(queryId, 64)
            .storeCoins(jetton_amount)
            .storeAddress(to)
            .storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .storeCoins(forward_ton_amount)
            .storeMaybeRef(forwardPayload)
            .endCell();
    }

    async sendTransfer(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jetton_amount: bigint,
        to: Address,
        responseAddress: Address,
        customPayload: Cell | null,
        forward_ton_amount: bigint,
        forwardPayload: Cell | null,
        queryId: number = 0,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.transferMessage(
                jetton_amount,
                to,
                responseAddress,
                customPayload,
                forward_ton_amount,
                forwardPayload,
                queryId,
            ),
            value: value,
        });
    }

    static burnMessage(jettonAmount: bigint, responseAddress: Address, customPayload: Cell, queryId: number = 0) {
        return beginCell()
            .storeUint(JettonOp.burn, 32)
            .storeUint(queryId, 64)
            .storeCoins(jettonAmount)
            .storeAddress(responseAddress)
            .storeMaybeRef(customPayload)
            .endCell();
    }

    async sendBurn(
        provider: ContractProvider,
        via: Sender,
        value: bigint,
        jettonAmount: bigint,
        responseAddress: Address,
        customPayload: Cell,
    ) {
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: JettonWallet.burnMessage(jettonAmount, responseAddress, customPayload),
            value: value,
        });
    }

    async sendWrapAndSwapToPt(
        provider: ContractProvider,
        via: Sender,
        syMinterAddress: Address,
        receiverAddress: Address,
        jettonAmount: bigint,
        minPtOut: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        const fwdMsg = beginCell()
            .storeUint(SYOp.wrap_and_swap_sy_for_pt, 32)
            .storeAddress(receiverAddress)
            .storeCoins(minPtOut)
            .endCell();

        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            syMinterAddress,
            via.address,
            null,
            fwdValue,
            fwdMsg,
            queryId,
        );
    }

    async sendWrapAndSwapToYt(
        provider: ContractProvider,
        via: Sender,
        syMinterAddress: Address,
        receiverAddress: Address,
        jettonAmount: bigint,
        minYtOut: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        const fwdMsg = beginCell()
            .storeUint(SYOp.wrap_and_swap_sy_for_yt, 32)
            .storeAddress(receiverAddress)
            .storeCoins(minYtOut)
            .endCell();

        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            syMinterAddress,
            via.address,
            null,
            fwdValue,
            fwdMsg,
            queryId,
        );
    }

    async sendSwapPtToSyAndUnwrap(
        provider: ContractProvider,
        via: Sender,
        poolAddress: Address,
        receiverAddress: Address,
        jettonAmount: bigint,
        minSyOut: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }

        const fwdMsg = beginCell()
            .storeUint(SYOp.swap_pt_for_sy_and_unwrap, 32)
            .storeUint(queryId, 64) // query_id
            .storeAddress(receiverAddress)
            .storeCoins(minSyOut)
            .endCell();

        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            poolAddress,
            via.address,
            null,
            fwdValue,
            fwdMsg,
        );
    }

    async sendSwapYtToSyAndUnwrap(
        provider: ContractProvider,
        via: Sender,
        poolAddress: Address,
        receiverAddress: Address,
        jettonAmount: bigint,
        minSyOut: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        const fwdMsg = beginCell()
            .storeUint(SYOp.swap_yt_for_sy_and_unwrap, 32)
            .storeUint(queryId, 64)
            .storeAddress(receiverAddress)
            .storeCoins(minSyOut)
            .endCell();

        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            poolAddress,
            via.address,
            null,
            fwdValue,
            fwdMsg,
        );
    }

    async sendWrapAndMintPtYt(
        provider: ContractProvider,
        via: Sender,
        receiverAddress: Address,
        syMinterAddress: Address,
        jettonAmount: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        const fwdMsg = beginCell().storeUint(SYOp.wrap_and_mint_pt_yt, 32).storeAddress(receiverAddress).endCell();
        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            syMinterAddress,
            via.address,
            beginCell().endCell(),
            fwdValue,
            fwdMsg,
            queryId,
        );
    }

    async sendWrapAndAddLiquidity(
        provider: ContractProvider,
        via: Sender,
        receiverAddress: Address,
        syMinterAddress: Address,
        jettonAmount: bigint,
        minLpOut: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            syMinterAddress,
            via.address,
            null,
            fwdValue,
            Pool.wrapAndAddLiquidityMessage(receiverAddress, minLpOut),
            queryId,
        );
    }

    async sendAddLiquidity(
        provider: ContractProvider,
        via: Sender,
        poolAddress: Address,
        receiverAddress: Address,
        jettonAmount: bigint,
        minLpOut: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }

        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            poolAddress,
            via.address,
            null,
            fwdValue,
            Pool.addLiquidityMessage(receiverAddress, minLpOut, queryId),
        );
    }

    async sendClaimInterestAndUnwrap(
        provider: ContractProvider,
        via: Sender,
        recipient: Address,
        value: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        await provider.internal(via, {
            sendMode: SendMode.PAY_GAS_SEPARATELY,
            body: YTJettonMinter.claimInterestAndUnwrap(recipient, queryId),
            value: value,
        });
    }

    async sendRedeem(
        provider: ContractProvider,
        via: Sender,
        ytMinterAddress: Address,
        recipientAddress: Address,
        jettonAmount: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            ytMinterAddress,
            recipientAddress,
            null,
            fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
        );
    }

    async sendRedeemAfterMaturity(
        provider: ContractProvider,
        via: Sender,
        ytMinterAddress: Address,
        recipientAddress: Address,
        jettonAmount: bigint,
        value: bigint,
        fwdValue: bigint,
        queryId: number = 0,
    ) {
        if (!via.address) {
            throw Error('Sender address is not defined');
        }
        return await this.sendTransfer(
            provider,
            via,
            value,
            jettonAmount,
            ytMinterAddress,
            recipientAddress,
            null,
            fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_after_maturity_and_unwrap, recipientAddress, queryId),
        );
    }
}
