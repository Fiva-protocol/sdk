import { FivaClient, SYOp } from '../src';
import { JettonMaster, toNano, TonClient4 } from '@ton/ton';
import TonConnect from '@tonconnect/sdk';
import { Address } from '@ton/ton';
import { getConnector } from '../examples/tonconnect/connector';
import path from 'path';

const MANIFEST_URL = 'https://ab6293cf51e6d12a43976b2abe6-app-dev.thefiva.com/tonconnect-manifest-dev.json';

describe('FIVA SCs addresses are properly calculated', () => {
    let fivaClient: FivaClient;
    let tonClient: TonClient4;
    let connector: TonConnect;
    let syMinterAddr = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
    let ytMinterAddr = Address.parse('EQCwUSc2qrY5rn9BfFBG9ARAHePTUvITDl97UD0zOreWzLru');
    let ptMinterAddr = Address.parse('EQBzVrYkYPHx8D_HPfQacm1xONa4XSRxl826vHkx_laP2HOe');
    let poolAddr = Address.parse('EQBNlIZxIbQGQ78cXgG3VRcyl8A0kLn_6BM9kabiHHhWC4qY');
    let underlyingMinterAddr = Address.parse('EQCxE6mUtQJKFnGfaROTKOt1lZbDiiX1kCixRv7Nw2Id_sDs');

    beforeAll(async () => {
        tonClient = new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });

        const storagePath = path.join(require('path').resolve(__dirname, '..'), 'temp', 'ton-connect.json');
        connector = await getConnector(storagePath, MANIFEST_URL);

        fivaClient = new FivaClient({ connector, tonClient, syAddress: syMinterAddr });
    }, 60000);

    it('Sy Minter address is correct', async () => {
        expect(fivaClient.getSyMinter().address.toString()).toEqual(syMinterAddr.toString());
    });

    it('Yt Minter address is correct', async () => {
        const ytMinter = await fivaClient.getYtMinter();
        expect(ytMinter.address.toString()).toEqual(ytMinterAddr.toString());
    });

    it('Pool address is correct', async () => {
        const pool = await fivaClient.getPool();
        expect(pool.address.toString()).toEqual(poolAddr.toString());
    });

    it('User underlying address is correct', async () => {
        const assetWallet = await fivaClient.getUserAssetWallet();
        const assetMinter = tonClient.open(JettonMaster.create(underlyingMinterAddr));
        const userAddr = Address.parse(connector.account!!.address);

        const expectedWalletAddr = await assetMinter.getWalletAddress(userAddr);
        expect(assetWallet.address.toString()).toEqual(expectedWalletAddr.toString());
    });

    it('User PT address is correct', async () => {
        const ptWallet = await fivaClient.getUserPtWallet();
        const ptMinter = tonClient.open(JettonMaster.create(ptMinterAddr));
        const userAddr = Address.parse(connector.account!!.address);

        const expectedWalletAddr = await ptMinter.getWalletAddress(userAddr);
        expect(ptWallet.address.toString()).toEqual(expectedWalletAddr.toString());
    });

    it('User YT address is correct', async () => {
        const ytWallet = await fivaClient.getUserYtWallet();
        const ytMinter = tonClient.open(JettonMaster.create(ytMinterAddr));
        const userAddr = Address.parse(connector.account!!.address);

        const expectedWalletAddr = await ytMinter.getWalletAddress(userAddr);
        expect(ytWallet.address.toString()).toEqual(expectedWalletAddr.toString());
    });

    it('Pool wallets are correct', async () => {
        const { syAddr, ptAddr, ytAddr } = await fivaClient.getPoolWalletAddresses();
        const syMinter = tonClient.open(JettonMaster.create(syMinterAddr));
        const ptMinter = tonClient.open(JettonMaster.create(ptMinterAddr));
        const ytMinter = tonClient.open(JettonMaster.create(ytMinterAddr));

        expect(syAddr.toString()).toEqual((await syMinter.getWalletAddress(poolAddr)).toString());
        expect(ptAddr.toString()).toEqual((await ptMinter.getWalletAddress(poolAddr)).toString());
        expect(ytAddr.toString()).toEqual((await ytMinter.getWalletAddress(poolAddr)).toString());
    });

    it('Gas estimation returns valid data', async () => {
        const { value, fwdValue } = await fivaClient.getFeesEstimation(SYOp.wrap_and_swap_sy_for_pt);

        expect(value).toBeGreaterThanOrEqual(toNano(0.2));
        expect(fwdValue).toBeGreaterThanOrEqual(toNano(0.1));
    });
});
