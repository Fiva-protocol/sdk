import {
    Address,
    OpenedContract,
    Cell,
    beginCell,
    external,
    storeMessage,
    internal,
    MessageRelaxed,
    storeMessageRelaxed
} from '@ton/core';
import { JettonMaster, WalletContractV4, TonClient } from '@ton/ton';
import { Turnkey } from '@turnkey/sdk-server';
import { Pool, SYJettonMinter, YTJettonMinter, JettonWallet } from './contracts';
import { PoolOp, SYOp } from './helpers/opcodes';
import { withRetries } from './helpers/retry';
import { FivaAsset } from './FivaClient';

export { FivaAsset };

const FIVA_PRECISION = 1_000_000_000n;
const INDEX_PRECISION = 1_000_000n;

interface TurnkeyConfig {
    apiBaseUrl: string;
    apiPrivateKey: string;
    apiPublicKey: string;
    organizationId: string;
}

interface FivaClientAAOptions {
    turnkeyConfig: TurnkeyConfig;
    tonClient: TonClient;
    syAddress: Address;
    userAddress?: Address;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

export class FivaClientAA {
    private turnkey: Turnkey;
    private client: TonClient;
    private turnkeyConfig: TurnkeyConfig;

    private userAddress: Address;
    private contracts: ContractAddresses;
    private wallet: WalletContractV4 | undefined;

    constructor({ turnkeyConfig, tonClient, syAddress, userAddress }: FivaClientAAOptions) {
        if (!userAddress) {
            throw new Error('User address must be provided for account abstraction client');
        }

        this.turnkeyConfig = turnkeyConfig;

        try {
            this.turnkey = new Turnkey({
                apiBaseUrl: turnkeyConfig.apiBaseUrl,
                apiPrivateKey: turnkeyConfig.apiPrivateKey,
                apiPublicKey: turnkeyConfig.apiPublicKey,
                defaultOrganizationId: turnkeyConfig.organizationId
            });

        } catch (error) {
            throw new Error(`Turnkey initialization failed: ${error}`);
        }

        this.client = tonClient;
        this.contracts = { syMinter: syAddress };
        this.userAddress = userAddress;
    }

    async getTurnkeyWalletAddress(): Promise<Address> {
        await this.initializeWallet();
        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }
        return this.wallet.address;
    }

    private turnkeyWalletId: string | undefined;
    private turnkeyWalletAddress: string | undefined;

    async initializeWallet() {
        if (this.wallet) return;

        try {
            console.log('🔐 Initializing Turnkey wallet...');

            const walletNamePrefix = `fiva-wallet-${this.userAddress.toString().slice(-8)}`;

            try {
                const walletsResponse = await this.turnkey.apiClient().getWallets({
                    organizationId: this.turnkeyConfig.organizationId
                });

                const existingWallet = walletsResponse.wallets?.find(w =>
                    w.walletName?.startsWith(walletNamePrefix)
                );

                if (existingWallet && existingWallet.walletId) {
                    this.turnkeyWalletId = existingWallet.walletId;
                    
                    const accountsResponse = await this.turnkey.apiClient().getWalletAccounts({
                        walletId: this.turnkeyWalletId
                    });

                    if (accountsResponse.accounts && accountsResponse.accounts.length > 0) {
                        this.turnkeyWalletAddress = accountsResponse.accounts[0].address!;
                    } else {
                        throw new Error('No accounts found in existing wallet');
                    }
                } else {
                    const walletName = `${walletNamePrefix}`;
                    const createWalletResult = await this.turnkey.apiClient().createWallet({
                        walletName: walletName,
                        accounts: [{
                            curve: 'CURVE_ED25519',
                            pathFormat: 'PATH_FORMAT_BIP32',
                            path: 'm/44\'/607\'/0\'/0\'/0\'',
                            addressFormat: 'ADDRESS_FORMAT_TON_V4R2'
                        }]
                    });

                    this.turnkeyWalletId = createWalletResult.walletId;
                    this.turnkeyWalletAddress = createWalletResult.addresses[0];
                }
            } catch (listError) {
                const walletName = `${walletNamePrefix}`;
                const createWalletResult = await this.turnkey.apiClient().createWallet({
                    walletName: walletName,
                    accounts: [{
                        curve: 'CURVE_ED25519',
                        pathFormat: 'PATH_FORMAT_BIP32',
                        path: 'm/44\'/607\'/0\'/0\'/0\'',
                        addressFormat: 'ADDRESS_FORMAT_TON_V4R2'
                    }]
                });

                this.turnkeyWalletId = createWalletResult.walletId;
                this.turnkeyWalletAddress = createWalletResult.addresses[0];
            }

            const publicKeyResult = await this.turnkey.apiClient().getWalletAccounts({
                walletId: this.turnkeyWalletId
            });

            if (!publicKeyResult.accounts || publicKeyResult.accounts.length === 0) {
                throw new Error('No accounts found for the created wallet');
            }

            const publicKeyHex = publicKeyResult.accounts[0].publicKey;
            if (!publicKeyHex) {
                throw new Error('Public key not found for the wallet account');
            }

            const publicKey = Buffer.from(publicKeyHex, 'hex');
            const turnkeyAddress = Address.parse(this.turnkeyWalletAddress);

            this.wallet = WalletContractV4.create({
                workchain: 0,
                publicKey: publicKey
            });

            if (!this.wallet.address.equals(turnkeyAddress)) {
                (this.wallet as any)._address = turnkeyAddress;
            }

            this.userAddress = turnkeyAddress;

        } catch (error) {
            throw new Error(`Wallet initialization failed: ${error}`);
        }
    }

    private async signTransactionHash(hash: Buffer): Promise<Buffer> {
        if (!this.turnkey) {
            throw new Error('Turnkey SDK not initialized');
        }

        if (!this.turnkeyWalletAddress) {
            throw new Error('Turnkey wallet not initialized. Call initializeWallet() first.');
        }

        try {
            const payload = hash.toString('hex');
            console.log('🔐 Signing transaction hash with Turnkey...');
            console.log('📝 Hash (hex):', payload);

            const signResult = await this.turnkey.apiClient().signRawPayload({
                signWith: this.turnkeyWalletAddress,
                payload: payload,
                encoding: 'PAYLOAD_ENCODING_HEXADECIMAL',
                hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE'
            });

            let signatureBuffer: Buffer;

            if (signResult.r && signResult.s) {
                const rBuffer = Buffer.from(signResult.r, 'hex');
                const sBuffer = Buffer.from(signResult.s, 'hex');
                signatureBuffer = Buffer.concat([rBuffer, sBuffer]);
            } else if ((signResult as any).signature) {
                signatureBuffer = Buffer.from((signResult as any).signature, 'hex');
            } else {
                const activityResult = (signResult as any).activity?.result?.signRawPayloadResult;
                if (activityResult?.r && activityResult?.s) {
                    const rBuffer = Buffer.from(activityResult.r, 'hex');
                    const sBuffer = Buffer.from(activityResult.s, 'hex');
                    signatureBuffer = Buffer.concat([rBuffer, sBuffer]);
                } else {
                    throw new Error('Could not extract signature from Turnkey response');
                }
            }

            return signatureBuffer;

        } catch (error) {
            throw new Error(`Turnkey signing failed: ${error}`);
        }
    }

    private async sendTransaction(messages: {
        to: Address;
        value: bigint;
        body?: Cell
    } | Array<{
        to: Address;
        value: bigint;
        body?: Cell
    }>) {
        await this.initializeWallet();

        if (!this.wallet) {
            throw new Error('Wallet not initialized');
        }

        try {
            const walletContract = this.client.open(this.wallet);
            const seqno = await walletContract.getSeqno();
            await sleep(1000);
            
            await walletContract.getBalance();
            await sleep(1000);

            const messageList = Array.isArray(messages) ? messages : [messages];

            if (messageList.length > 4) {
                throw new Error('Maximum 4 messages per transaction allowed');
            }

            const internalMessages: MessageRelaxed[] = messageList.map(msg => internal({
                to: msg.to,
                value: msg.value,
                body: msg.body,
                bounce: false
            }));

            const signingMessageBuilder = beginCell()
                .storeUint(this.wallet.walletId, 32);

            if (seqno === 0) {
                for (let i = 0; i < 32; i++) {
                    signingMessageBuilder.storeBit(1);
                }
            } else {
                signingMessageBuilder.storeUint(Math.floor(Date.now() / 1000) + 60, 32);
            }

            signingMessageBuilder.storeUint(seqno, 32);

            if (internalMessages.length === 1) {
                signingMessageBuilder
                    .storeUint(0, 8)
                    .storeUint(128, 8)
                    .storeRef(beginCell().store(storeMessageRelaxed(internalMessages[0])));
            } else {
                signingMessageBuilder.storeUint(0, 8);

                for (const internalMessage of internalMessages) {
                    signingMessageBuilder
                        .storeUint(128, 8)
                        .storeRef(beginCell().store(storeMessageRelaxed(internalMessage)));
                }
            }

            const signingMessage = signingMessageBuilder.endCell();
            const hash = signingMessage.hash();

            const signature = await this.signTransactionHash(hash);

            const body = beginCell()
                .storeBuffer(signature)
                .storeSlice(signingMessage.beginParse())
                .endCell();

            const externalMessage = external({
                to: this.wallet.address,
                init: seqno === 0 ? this.wallet.init : null,
                body: body
            });

            const messageCell = beginCell().store(storeMessage(externalMessage)).endCell();
            const boc = messageCell.toBoc();

            await sleep(2000);
            await this.client.sendFile(boc);
            await sleep(2000);

        } catch (error) {
            throw new Error(`Transaction sending failed: ${error}`);
        }
    }

    getSyMinter(): OpenedContract<SYJettonMinter> {
        return this.client.open(SYJettonMinter.createFromAddress(this.contracts.syMinter));
    }

    async getYtMinter(): Promise<OpenedContract<YTJettonMinter>> {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();
        return this.client.open(YTJettonMinter.createFromAddress(this.contracts.ytMinter!));
    }

    async getPtMinter(): Promise<OpenedContract<JettonMaster>> {
        if (!this.contracts.ptMinter) await this.setPtMinterAddress();
        return this.client.open(JettonMaster.create(this.contracts.ptMinter!));
    }

    async getPool(): Promise<OpenedContract<Pool>> {
        if (!this.contracts.pool) await this.setPoolAddress();
        return this.client.open(Pool.createFromAddress(this.contracts.pool!));
    }

    async getUserAssetWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userAssetWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userAssetWallet!));
    }

    async getUserPtWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userPtWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userPtWallet!));
    }

    async getUserYtWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userYtWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userYtWallet!));
    }

    async getUserLpWallet(): Promise<OpenedContract<JettonWallet>> {
        if (!this.contracts.userLpWallet) await this.setUserAddresses();
        return this.client.open(JettonWallet.createFromAddress(this.contracts.userLpWallet!));
    }

    async getPoolWalletAddresses(): Promise<{ syAddr: Address; ptAddr: Address; ytAddr: Address }> {
        await this.setPoolWalletAddresses();
        return {
            syAddr: this.contracts.poolSyWallet!,
            ptAddr: this.contracts.poolPtWallet!,
            ytAddr: this.contracts.poolYtWallet!
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
            ytAddr: this.contracts.poolYtWallet
        } = await withRetries(pool.getJettonAddresses));
    }

    private async setUserAddresses() {
        if (!this.contracts.userAssetWallet) {
            const syMinterAssetAddr = await withRetries(this.getSyMinter().getUnderlyingAddress);
            const syMinterAssetWallet = this.client.open(JettonWallet.createFromAddress(syMinterAssetAddr));

            const { minterAddress: assetMinterAddr } = await withRetries(syMinterAssetWallet.getWalletData);
            const assetMinter = this.client.open(JettonMaster.create(assetMinterAddr));

            this.contracts.userAssetWallet = await withRetries(
                () => this.getWalletAddress(assetMinter, this.userAddress)
            );
        }

        if (!this.contracts.userSyWallet) {
            this.contracts.userSyWallet = await withRetries(
                () => this.getWalletAddress(this.getSyMinter(), this.userAddress)
            );
        }

        if (!this.contracts.userPtWallet) {
            const ptMinter = await this.getPtMinter();
            this.contracts.userPtWallet = await withRetries(
                () => this.getWalletAddress(ptMinter, this.userAddress)
            );
        }

        if (!this.contracts.userYtWallet) {
            const ytMinter = await this.getYtMinter();
            this.contracts.userYtWallet = await withRetries(
                () => this.getWalletAddress(ytMinter, this.userAddress)
            );
        }

        if (!this.contracts.userLpWallet) {
            const pool = await this.getPool();
            this.contracts.userLpWallet = await withRetries(
                () => this.getWalletAddress(pool, this.userAddress)
            );
        }
    }

    private async getWalletAddress(minter: any, userAddress: Address): Promise<Address> {
        if (minter.getWalletAddress) {
            return await withRetries(minter.getWalletAddress, userAddress);
        }
        if (minter.getLpWalletAddress) {
            return await withRetries(minter.getLpWalletAddress, userAddress);
        }
        throw new Error('Unsupported minter type for wallet address retrieval');
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

        const expectedOut = await withRetries(pool.getExpectedSwapAmountOut, fromAddr!, toAddr!, amountIn);

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
            acquiredInterest
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
        const assetAmount = BigInt(1 * 10 ** underlyingPrecision);

        const ptToAssetRatio = await this.getPtToAssetRatio(assetAmount, underlyingPrecision);

        const maturityDate = await this.getMaturityDate();
        const currentTimeSec = Math.floor(Date.now() / 1000);
        const maturityTimeSec = Math.floor(maturityDate.getTime() / 1000);
        const daysToMaturity = Math.floor((maturityTimeSec - currentTimeSec) / (60 * 60 * 24));

        return (ptToAssetRatio - 1) * (365 / daysToMaturity) * 100;
    }

    async getGain(assetAmount: bigint): Promise<number> {
        const underlyingPrecision = await this.getSyMinter().getUnderlyingPrecision();
        const ptToAssetRatio = await this.getPtToAssetRatio(assetAmount, underlyingPrecision);

        return (ptToAssetRatio - 1) * 100;
    }

    // Message creation methods
    private createWrapAndSwapToPtMessage(recipientAddress: Address, minAmountOut: bigint): Cell {
        return beginCell()
            .storeUint(SYOp.wrap_and_swap_sy_for_pt, 32)
            .storeAddress(recipientAddress)
            .storeCoins(minAmountOut)
            .endCell();
    }

    private createWrapAndSwapToYtMessage(recipientAddress: Address, minAmountOut: bigint): Cell {
        return beginCell()
            .storeUint(SYOp.wrap_and_swap_sy_for_yt, 32)
            .storeAddress(recipientAddress)
            .storeCoins(minAmountOut)
            .endCell();
    }

    private createSwapPtToSyAndUnwrapMessage(recipientAddress: Address, minAmountOut: bigint, queryId: number): Cell {
        return beginCell()
            .storeUint(SYOp.swap_pt_for_sy_and_unwrap, 32)
            .storeUint(queryId, 64)
            .storeAddress(recipientAddress)
            .storeCoins(minAmountOut)
            .endCell();
    }

    private createSwapYtToSyAndUnwrapMessage(recipientAddress: Address, minAmountOut: bigint, queryId: number): Cell {
        return beginCell()
            .storeUint(SYOp.swap_yt_for_sy_and_unwrap, 32)
            .storeUint(queryId, 64)
            .storeAddress(recipientAddress)
            .storeCoins(minAmountOut)
            .endCell();
    }

    private createWrapAndMintPtYtMessage(recipientAddress: Address): Cell {
        return beginCell()
            .storeUint(SYOp.wrap_and_mint_pt_yt, 32)
            .storeAddress(recipientAddress)
            .endCell();
    }

    async swapAssetForPt(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_swap_sy_for_pt);
        await this.setUserAddresses();

        const body = JettonWallet.transferMessage(
            amountToSwap,
            this.contracts.syMinter,
            this.userAddress,
            null,
            fees.fwdValue,
            this.createWrapAndSwapToPtMessage(recipientAddress, minAmountOut),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userAssetWallet!,
            value: fees.fwdValue,
            body
        });
    }

    async swapAssetForYt(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_swap_sy_for_yt);
        await this.setUserAddresses();

        const body = JettonWallet.transferMessage(
            amountToSwap,
            this.contracts.syMinter,
            this.userAddress,
            null,
            fees.fwdValue,
            this.createWrapAndSwapToYtMessage(recipientAddress, minAmountOut),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userAssetWallet!,
            value: fees.value,
            body
        });
    }

    async swapPtForAsset(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        if (!this.contracts.pool) await this.setPoolAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.swap_pt_for_sy_and_unwrap);

        const body = JettonWallet.transferMessage(
            amountToSwap,
            this.contracts.pool!,
            this.userAddress,
            null,
            fees.fwdValue,
            this.createSwapPtToSyAndUnwrapMessage(recipientAddress, minAmountOut, queryId),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userPtWallet!,
            value: fees.value,
            body
        });
    }

    async swapYtForAsset(
        amountToSwap: bigint,
        queryId: number = 0,
        minAmountOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        if (!this.contracts.pool) await this.setPoolAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.swap_yt_for_sy_and_unwrap);

        const body = JettonWallet.transferMessage(
            amountToSwap,
            this.contracts.pool!,
            this.userAddress,
            null,
            fees.fwdValue,
            this.createSwapYtToSyAndUnwrapMessage(recipientAddress, minAmountOut, queryId),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userYtWallet!,
            value: fees.value,
            body
        });
    }

    async mintPtAndYt(amountToMint: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_mint_pt_yt);
        await this.setUserAddresses();

        const body = JettonWallet.transferMessage(
            amountToMint,
            this.contracts.syMinter,
            this.userAddress,
            null,
            fees.fwdValue,
            this.createWrapAndMintPtYtMessage(recipientAddress),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userAssetWallet!,
            value: fees.value,
            body
        });
    }

    async sendRedeemPT(ptAmount: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);

        const body = JettonWallet.transferMessage(
            ptAmount,
            this.contracts.ytMinter!,
            this.userAddress,
            null,
            fees.fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userPtWallet!,
            value: fees.value,
            body
        });
    }

    async sendRedeemYT(ytAmount: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);

        const body = JettonWallet.transferMessage(
            ytAmount,
            this.contracts.ytMinter!,
            this.userAddress,
            null,
            fees.fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userYtWallet!,
            value: fees.value,
            body
        });
    }

    async redeemBatch(
        ptAmount: bigint,
        ytAmount: bigint,
        queryId: number = 0,
        recipientAddress: Address = this.userAddress
    ) {
        await this.setYtMinterAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);

        const ptBody = JettonWallet.transferMessage(
            ptAmount,
            this.contracts.ytMinter!,
            this.userAddress,
            null,
            fees.fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
            queryId
        );

        const ytBody = JettonWallet.transferMessage(
            ytAmount,
            this.contracts.ytMinter!,
            this.userAddress,
            null,
            fees.fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_and_unwrap, recipientAddress, queryId),
            queryId
        );

        await this.sendTransaction([
            {
                to: this.contracts.userPtWallet!,
                value: fees.value,
                body: ptBody
            },
            {
                to: this.contracts.userYtWallet!,
                value: fees.value,
                body: ytBody
            }
        ]);
    }

    async redeemAfterMaturity(ptAmount: bigint, queryId: number = 0, recipientAddress: Address = this.userAddress) {
        if (!this.contracts.ytMinter) await this.setYtMinterAddress();
        await this.setUserAddresses();

        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_after_maturity_and_unwrap);

        const body = JettonWallet.transferMessage(
            ptAmount,
            this.contracts.ytMinter!,
            this.userAddress,
            null,
            fees.fwdValue,
            YTJettonMinter.redeemMessage(SYOp.redeem_after_maturity_and_unwrap, recipientAddress, queryId),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userPtWallet!,
            value: fees.value,
            body
        });
    }

    async claimInterest(queryId: number = 0, recipientAddress: Address = this.userAddress) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.claim_interest_and_unwrap);
        await this.setUserAddresses();

        const body = YTJettonMinter.claimInterestAndUnwrap(recipientAddress, queryId);

        await this.sendTransaction({
            to: this.contracts.userYtWallet!,
            value: fees.value,
            body
        });
    }

    async addAssetLiquidity(
        assetAmount: bigint,
        queryId: number = 0,
        minLpOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        const assetFees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_add_liquidity);
        await this.setUserAddresses();

        const body = JettonWallet.transferMessage(
            assetAmount,
            this.contracts.syMinter,
            this.userAddress,
            null,
            assetFees.fwdValue,
            Pool.wrapAndAddLiquidityMessage(recipientAddress, minLpOut),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userAssetWallet!,
            value: assetFees.value,
            body
        });
    }

    async addPtLiquidity(
        ptAmount: bigint,
        queryId: number = 0,
        minLpOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        const pool = await this.getPool();
        await this.setUserAddresses();

        const ptFees = await pool.getFeesEstimation(PoolOp.add_liquidity);

        const body = JettonWallet.transferMessage(
            ptAmount,
            this.contracts.pool!,
            this.userAddress,
            null,
            ptFees.fwdValue,
            Pool.addLiquidityMessage(recipientAddress, minLpOut, queryId),
            queryId
        );

        await this.sendTransaction({
            to: this.contracts.userPtWallet!,
            value: ptFees.value,
            body
        });
    }

    async addLiquidityBatch(
        assetAmount: bigint,
        ptAmount: bigint,
        queryId: number = 0,
        minLpOut: bigint = 0n,
        recipientAddress: Address = this.userAddress
    ) {
        if (!this.contracts.userAssetWallet || !this.contracts.userPtWallet) await this.setUserAddresses();

        const assetFees = await this.getSyMinter().getFeesEstimation(SYOp.wrap_and_add_liquidity);
        const pool = await this.getPool();
        const ptFees = await pool.getFeesEstimation(PoolOp.add_liquidity);

        const assetBody = JettonWallet.transferMessage(
            assetAmount,
            this.contracts.syMinter,
            this.userAddress,
            null,
            assetFees.fwdValue,
            Pool.wrapAndAddLiquidityMessage(recipientAddress, minLpOut),
            queryId
        );

        const ptBody = JettonWallet.transferMessage(
            ptAmount,
            this.contracts.pool!,
            this.userAddress,
            null,
            ptFees.fwdValue,
            Pool.addLiquidityMessage(recipientAddress, minLpOut, queryId),
            queryId
        );

        await this.sendTransaction([
            {
                to: this.contracts.userAssetWallet!,
                value: assetFees.value,
                body: assetBody
            },
            {
                to: this.contracts.userPtWallet!,
                value: ptFees.value,
                body: ptBody
            }
        ]);
    }

    async redeemLiquidity(redeemAmount: bigint) {
        const fees = await this.getSyMinter().getFeesEstimation(SYOp.redeem_and_unwrap);
        await this.setUserAddresses();

        const body = JettonWallet.burnMessage(
            redeemAmount,
            this.userAddress,
            Pool.redeemLpMessage(),
            0
        );

        await this.sendTransaction({
            to: this.contracts.userLpWallet!,
            value: fees.value,
            body
        });
    }
}