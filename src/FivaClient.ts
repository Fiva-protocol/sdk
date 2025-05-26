import { Address, OpenedContract } from '@ton/core';
import { ITonConnect } from '@tonconnect/sdk';
import { JettonMaster, TonClient4 } from '@ton/ton';
import { Pool, SYJettonMinter, YTJettonMinter, JettonWallet } from './contracts';
import { PoolOp, SYOp } from './helpers/opcodes';
import { getSender } from './helpers/tonconnect';
import { withRetries } from './helpers/retry';

const DEFAULT_TTL = 5 * 60 * 1000;
const FIVA_PRECISION = 1_000_000_000n;
const INDEX_PRECISION = 1_000_000n;

interface FivaRouterOptions {
    connector: ITonConnect;
    tonClient: TonClient4;
    syAddress: Address;
}

export enum FivaAsset {
    Underlying,
    PT,
    YT,
}

interface ContractAddresses {
    syMinter: Address;
    assetMinter?: Address;
    ytMinter?: Address;
    ptMinter?: Address;
    pool?: Address;
    userSyWallet?: Address;
    userAssetWallet?: Address;
    userYtWallet?: Address;
    userPtWallet?: Address;
    userLpWallet?: Address;
    poolSyWallet?: Address;
    poolPtWallet?: Address;
    poolYtWallet?: Address;
}

export class FivaClient {
    private connector: ITonConnect;
    private client: TonClient4;

    private userAddress: Address;
    private contracts: ContractAddresses;

    constructor({ connector, tonClient, syAddress }: FivaRouterOptions) {
        if (!connector.connected || !connector.account) {
            throw Error('provided connector is not connected');
        }

        this.connector = connector;
        this.client = tonClient;

        this.userAddress = Address.parse(connector.account.address);
        this.contracts = { syMinter: syAddress };
    }

    getSyMinter(): OpenedContract<SYJettonMinter> {
        return this.client.open(SYJettonMinter.createFromAddress(this.contracts.syMinter));
    }

    async getYtMinter(): Promise<OpenedContract<YTJettonMinter>> {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();
        return this.client.open(YTJettonMinter.createFromAddress(this.contracts.ytMinter!!));
    }

    async getPtMinter(): Promise<OpenedContract<JettonMaster>> {
        if (!this.contracts.ptMinter) await this.setPtMinterAddress();
        return this.client.open(JettonMaster.create(this.contracts.ptMinter!!));
    }

    async getPool(): Promise<OpenedContract<Pool>> {
        if (!this.contracts.pool) await this.setPoolAddress();
        return this.client.open(Pool.createFromAddress(this.contracts.pool!!));
    }

    async getUserAssetWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userAssetWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userAssetWallet!!));
    }

    async getUserPtWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userPtWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userPtWallet!!));
    }

    async getUserYtWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userYtWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userYtWallet!!));
    }

    async getUserLpWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userLpWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userLpWallet!!));
    }

    async getPoolWalletAddresses(): Promise<{ syAddr: Address; ptAddr: Address; ytAddr: Address }> {
        await this.setPoolWalletAddresses();
        return {
            syAddr: this.contracts.poolSyWallet!!,
            ptAddr: this.contracts.poolPtWallet!!,
            ytAddr: this.contracts.poolYtWallet!!,
        };
    }

    async getPoolBalances(): Promise<{ lp_amount: bigint; sy_amount: bigint; pt_amount: bigint }> {
        const pool = await this.getPool();
        return await withRetries(pool.getPoolBalances);
    }

    async getExpectedLpOut(underlyingAmount: bigint, ptAmount: bigint): Promise<bigint> {
        const pool = await this.getPool();
        const syAmount = await this.convertUnderlyingToSy(underlyingAmount);

        return await withRetries(pool.getLpOut, syAmount, ptAmount);
    }

    private async setYtMinterAddress() {
        if (!this.contracts.ytMinter)
            this.contracts.ytMinter = await withRetries(this.getSyMinter().getYTMinterAddress);
    }

    private async setPtMinterAddress() {
        if (!this.contracts.ptMinter) {
            const ytMinter = await this.getYtMinter();
            const { ptMinterAddress } = await withRetries(ytMinter.getPtAddresses);
            this.contracts.ptMinter = ptMinterAddress;
        }
    }

    private async setPoolAddress() {
        if (!this.contracts.pool) this.contracts.pool = await withRetries(this.getSyMinter().getPoolAddress);
    }

    private async setPoolWalletAddresses() {
        if (this.contracts.poolSyWallet && this.contracts.poolPtWallet && this.contracts.poolYtWallet) return;

        const pool = await this.getPool();
        ({
            syAddr: this.contracts.poolSyWallet,
            ptAddr: this.contracts.poolPtWallet,
            ytAddr: this.contracts.poolYtWallet,
        } = await withRetries(pool.getJettonAddresses));
    }

    private async setUserAddresses() {
        if (!this.contracts.userAssetWallet) {
            const syMinterAssetAddr = await withRetries(this.getSyMinter().getUnderlyingAddress);
            const syMinterAssetWallet = this.client.open(JettonWallet.createFromAddress(syMinterAssetAddr));

            const { minterAddress: assetMinterAddr } = await withRetries(syMinterAssetWallet.getWalletData);
            const assetMinter = this.client.open(JettonMaster.create(assetMinterAddr));

            this.contracts.userAssetWallet = await withRetries(assetMinter.getWalletAddress, this.userAddress);
        }

        if (!this.contracts.userSyWallet) {
            this.contracts.userSyWallet = await withRetries(this.getSyMinter().getWalletAddress, this.userAddress);
        }

        if (!this.contracts.userPtWallet) {
            const ptMinter = await this.getPtMinter();
            this.contracts.userPtWallet = await withRetries(ptMinter.getWalletAddress, this.userAddress);
        }

        if (!this.contracts.userYtWallet) {
            const ytMinter = await this.getYtMinter();
            this.contracts.userYtWallet = await withRetries(ytMinter.getWalletAddress, this.userAddress);
        }

        if (!this.contracts.userLpWallet) {
            const pool = await this.getPool();
            this.contracts.userLpWallet = await withRetries(pool.getLpWalletAddress, this.userAddress);
        }
    }

    private assetToPoolAddress(asset: FivaAsset): Address | undefined {
        switch (asset) {
            case FivaAsset.Underlying:
                return this.contracts.poolSyWallet;
            case FivaAsset.PT:
                return this.contracts.poolPtWallet;
            case FivaAsset.YT:
                return this.contracts.poolPtWallet;
            default:
                return undefined;
        }
    }

    async convertSyToUnderlying(syAmount: bigint): Promise<bigint> {
        const syMinter = this.getSyMinter();
        const syIndex = await syMinter.getIndex();
        const underlyingPrecision = await syMinter.getUnderlyingPrecision();

        if (syIndex > 0) {
            return (syAmount * syIndex * BigInt(Math.pow(10, underlyingPrecision))) / FIVA_PRECISION / INDEX_PRECISION;
        }
        return (syAmount * BigInt(Math.pow(10, underlyingPrecision))) / FIVA_PRECISION;
    }

    async convertUnderlyingToSy(assetAmount: bigint): Promise<bigint> {
        const syMinter = this.getSyMinter();
        const syIndex = await syMinter.getIndex();
        const underlyingPrecision = await syMinter.getUnderlyingPrecision();

        if (syIndex > 0) {
            return (
                (assetAmount * INDEX_PRECISION * FIVA_PRECISION) / syIndex / BigInt(Math.pow(10, underlyingPrecision))
            );
        }
        return (assetAmount * FIVA_PRECISION) / BigInt(Math.pow(10, underlyingPrecision));
    }

    async getMaxTotalSupply(): Promise<{ maxTotalSupply: bigint; totalSupply: bigint }> {
        return await withRetries(this.getSyMinter().getMaxTotalSupply);
    }

    async getIndex(): Promise<bigint | undefined> {
        const pool = await this.getPool();
        const { index } = await pool.getPoolConfig();
        return index;
    }

    async getFeesEstimation(op: number): Promise<{ value: bigint; fwdValue: bigint }> {
        return await withRetries(this.getSyMinter().getFeesEstimation, op);
    }

    async getExpectedSwapAmountOut(fromAsset: FivaAsset, toAsset: FivaAsset, amountIn: bigint): Promise<bigint> {
        await this.setPoolWalletAddresses();
        const pool = await this.getPool();
        const fromAddr = this.assetToPoolAddress(fromAsset);
        const toAddr = this.assetToPoolAddress(toAsset);

        if (!fromAddr) throw new Error('From asset is not found');
        if (!toAddr) throw new Error('to asset is not found');
        if (fromAsset === toAsset) throw new Error('From and to assets are the same');
        if ([FivaAsset.PT, FivaAsset.YT].includes(fromAsset) && [FivaAsset.PT, FivaAsset.YT].includes(toAsset))
            throw new Error('Swaps between PT and YT assets are not supported');

        if (fromAsset === FivaAsset.Underlying) amountIn = await this.convertUnderlyingToSy(amountIn);

        const expectedOut = await withRetries(pool.getExpectedSwapAmountOut, fromAddr!!, toAddr!!, amountIn);

        if (toAsset === FivaAsset.Underlying) return this.convertSyToUnderlying(expectedOut);
        else return expectedOut;
    }

    async getMintYtPtOut(underlyingAmount: bigint): Promise<{ yt_amount: bigint; pt_amount: bigint }> {
        const ytMinter = await this.getYtMinter();
        const syAmount = await this.convertUnderlyingToSy(underlyingAmount);

        return await withRetries(ytMinter.getMintYtPtOut, syAmount);
    }

    async getClaimableInterest(): Promise<bigint> {
        const ytWallet = await this.getUserYtWallet();
        const ytMinter = await this.getYtMinter();

        const ytAmount = await withRetries(ytWallet.getJettonBalance);
        const lastCollectedInterestIndex = await withRetries(ytWallet.getLastCollectedInterestIndex);
        const acquiredInterest = await withRetries(ytWallet.getAcquiredAmount);

        const { interest } = await withRetries(
            ytMinter.getClaimableInterest,
            ytAmount,
            lastCollectedInterestIndex,
            acquiredInterest,
        );
        return interest;
    }

    async getRedeemAssetOutBeforeMaturity(ytAmount: bigint, ptAmount: bigint): Promise<bigint> {
        const ytMinter = await this.getYtMinter();
        const { sy_amount } = await withRetries(ytMinter.getRedeemSyOutBeforeMaturity, ytAmount, ptAmount);

        return await this.convertUnderlyingToSy(sy_amount);
    }

    async getRedeemAssetOutAfterMaturity(ptAmount: bigint): Promise<bigint> {
        const ytMinter = await this.getYtMinter();
        const { sy_amount } = await withRetries(ytMinter.getRedeemSyOutAfterMaturity, ptAmount);

        return await this.convertUnderlyingToSy(sy_amount);
    }

    async getMaturityDate(): Promise<Date> {
        const ytMinter = await this.getYtMinter();
        const timestamp = await withRetries(ytMinter.getMaturity);
        return new Date(Number(timestamp) * 1000);
    }

    async getPtToAssetRatio(assetAmount: bigint, underlyingPrecision: number): Promise<number> {
        const index = await (await this.getYtMinter()).getIndex();
        const underlyingAmount =
            underlyingPrecision === 6 ? assetAmount : (assetAmount * INDEX_PRECISION) / index.index;

        const ptOut = await this.getExpectedSwapAmountOut(FivaAsset.Underlying, FivaAsset.PT, underlyingAmount);

        return (Number(ptOut) * 10 ** underlyingPrecision) / Number(assetAmount) / Number(FIVA_PRECISION);
    }

    async getFixedAPY(): Promise<number> {
        const underlyingPrecision = await this.getSyMinter().getUnderlyingPrecision();
        // One asset (i.e. 1 USDT or 1 TON)
        const assetAmount = BigInt(1 * 10 ** underlyingPrecision);

        const ptToAssetRatio = await this.getPtToAssetRatio(assetAmount, underlyingPrecision);

        const maturityDate = await this.getMaturityDate();
        const currentTimeSec = Math.floor(Date.now() / 1000);
        const maturityTimeSec = Math.floor(maturityDate.getTime() / 1000);
        const daysToMaturity = Math.floor((maturityTimeSec - currentTimeSec) / (60 * 60 * 24));

        // annualized return in percent
        return (ptToAssetRatio - 1) * (365 / daysToMaturity) * 100;
    }

    async getGain(assetAmount: bigint): Promise<number> {
        const underlyingPrecision = await this.getSyMinter().getUnderlyingPrecision();
        const ptToAssetRatio = await this.getPtToAssetRatio(assetAmount, underlyingPrecision);

        // gain in percent
        return (ptToAssetRatio - 1) * 100;
    }

    async swapAssetForPt(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
    ) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_swap_sy_for_pt);
        const userWallet = await this.getUserAssetWallet();
        await userWallet.sendWrapAndSwapToPt(
            getSender(this.connector),
            this.contracts.syMinter,
            recipientAddress,
            amountToSwap,
            minAmountOut,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async swapAssetForYt(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
    ) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_swap_sy_for_yt);
        const userWallet = await this.getUserAssetWallet();
        await userWallet.sendWrapAndSwapToYt(
            getSender(this.connector),
            this.contracts.syMinter,
            recipientAddress,
            amountToSwap,
            minAmountOut,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async swapPtForAsset(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
    ) {
        if (!this.contracts.pool) await this.setPoolAddress();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.swap_pt_for_sy_and_unwrap);
        const userPtWallet = await this.getUserPtWallet();
        await userPtWallet.sendSwapPtToSyAndUnwrap(
            getSender(this.connector),
            this.contracts.pool!!,
            recipientAddress,
            amountToSwap,
            minAmountOut,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async swapYtForAsset(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
    ) {
        if (!this.contracts.pool) await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.swap_yt_for_sy_and_unwrap);
        const userYtWallet = await this.getUserYtWallet();
        await userYtWallet.sendSwapYtToSyAndUnwrap(
            getSender(this.connector),
            this.contracts.pool!!,
            recipientAddress,
            amountToSwap,
            minAmountOut,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async mintPtAndYt(amountToMint: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_mint_pt_yt);
        const userWallet = await this.getUserAssetWallet();
        await userWallet.sendWrapAndMintPtYt(
            getSender(this.connector),
            recipientAddress,
            this.contracts.syMinter,
            amountToMint,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async sendRedeemPT(ptAmount: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);
        const userPtWallet = await this.getUserPtWallet();
        await userPtWallet.sendRedeem(
            getSender(this.connector),
            this.contracts.ytMinter!!,
            recipientAddress,
            ptAmount,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async sendRedeemYT(ytAmount: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);
        const userYtWallet = await this.getUserYtWallet();
        await userYtWallet.sendRedeem(
            getSender(this.connector),
            this.contracts.ytMinter!!,
            recipientAddress,
            ytAmount,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async redeemBatch(
        ptAmount: bigint,
        ytAmount: bigint,
        queryId: number = 0,
        recipientAddress: Address = this.userAddress,
        ttl: number = DEFAULT_TTL,
    ) {
        await this.setYtMinterAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);

        await this.connector.sendTransaction({
            validUntil: Date.now() + ttl,
            messages: [
                {
                    address: this.contracts.userPtWallet!!.toString(),
                    amount: fees.value.toString(),
                    payload: JettonWallet.transferMessage(
                        ptAmount,
                        this.contracts.ytMinter!!,
                        this.userAddress,
                        null,
                        fees.fwdValue,
                        YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
                        queryId,
                    )
                        .toBoc()
                        .toString('base64'),
                },
                {
                    address: this.contracts.userYtWallet!!.toString(),
                    amount: fees.value.toString(),
                    payload: JettonWallet.transferMessage(
                        ytAmount,
                        this.contracts.ytMinter!!,
                        this.userAddress,
                        null,
                        fees.fwdValue,
                        YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
                        queryId,
                    )
                        .toBoc()
                        .toString('base64'),
                },
            ],
        });
    }

    async redeemAfterMaturity(ptAmount: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_after_maturity_and_unwrap);
        const userPtWallet = await this.getUserPtWallet();
        await userPtWallet.sendRedeemAfterMaturity(
            getSender(this.connector),
            this.contracts.ytMinter!!,
            recipientAddress,
            ptAmount,
            fees.value,
            fees.fwdValue,
            queryId,
        );
    }

    async claimInterest(queryId: number = 0, recipientAddress: Address = this.userAddress) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.claim_interest_and_unwrap);
        const userYtWallet = await this.getUserYtWallet();
        await userYtWallet.sendClaimInterestAndUnwrap(getSender(this.connector), recipientAddress, fees.value, queryId);
    }

    async addAssetLiquidity(
        assetAmount: bigint,
        queryId: number = 0,
        minLpOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
    ) {
        const assetFees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_add_liquidity);
        const userWallet = await this.getUserAssetWallet();
        await userWallet.sendWrapAndAddLiquidity(
            getSender(this.connector),
            recipientAddress,
            this.contracts.syMinter,
            assetAmount,
            minLpOut,
            assetFees.value,
            assetFees.fwdValue,
            queryId,
        );
    }

    async addPtLiquidity(
        ptAmount: bigint,
        queryId: number = 0,
        minLpOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
    ) {
        const pool = await this.getPool();

        const ptFees = await pool.getFeesEstimation(PoolOp.add_liquidity);
        const userPtWallet = await this.getUserPtWallet();
        await userPtWallet.sendAddLiquidity(
            getSender(this.connector),
            this.contracts.pool!!,
            recipientAddress,
            ptAmount,
            minLpOut,
            ptFees.value,
            ptFees.fwdValue,
            queryId,
        );
    }

    async addLiquidityBatch(
        assetAmount: bigint,
        ptAmount: bigint,
        queryId: number = 0,
        minLpOut: bigint = 0n,
        recipientAddress: Address = this.userAddress,
        ttl: number = DEFAULT_TTL,
    ) {
        if (!this.contracts.userAssetWallet || !this.contracts.userPtWallet) await this.setUserAddresses();

        const assetFees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_add_liquidity);
        const pool = await this.getPool();
        const ptFees = await pool.getFeesEstimation(PoolOp.add_liquidity);

        await this.connector.sendTransaction({
            validUntil: Date.now() + ttl,
            messages: [
                {
                    address: this.contracts.userAssetWallet!!.toString(),
                    amount: assetFees.value.toString(),
                    payload: JettonWallet.transferMessage(
                        assetAmount,
                        this.contracts.syMinter,
                        this.userAddress,
                        null,
                        assetFees.fwdValue,
                        Pool.wrapAndAddLiquidityMessage(recipientAddress, minLpOut),
                        queryId,
                    )
                        .toBoc()
                        .toString('base64'),
                },
                {
                    address: this.contracts.userPtWallet!!.toString(),
                    amount: ptFees.value.toString(),
                    payload: JettonWallet.transferMessage(
                        ptAmount,
                        this.contracts.pool!!,
                        this.userAddress,
                        null,
                        ptFees.fwdValue,
                        Pool.addLiquidityMessage(recipientAddress, minLpOut, queryId),
                        queryId,
                    )
                        .toBoc()
                        .toString('base64'),
                },
            ],
        });
    }

    async redeemLiquidity(redeemAmount: bigint) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);
        const userLpWallet = await this.getUserLpWallet();

        await userLpWallet.sendBurn(
            getSender(this.connector),
            fees.value,
            redeemAmount,
            this.userAddress,
            Pool.redeemLpMessage(),
        );
    }
}
