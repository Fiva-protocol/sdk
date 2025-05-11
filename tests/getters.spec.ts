import { Address, toNano, TonClient4 } from '@ton/ton';
import TonConnect from '@tonconnect/sdk';
import path from 'path';
import { getConnector } from '../examples/tonconnect/connector';
import { FivaAsset, FivaClient, SYOp } from '../src';

const MANIFEST_URL = 'https://ab6293cf51e6d12a43976b2abe6-app-dev.thefiva.com/tonconnect-manifest-dev.json';

describe('FIVA SCs addresses are properly calculated', () => {
    let fivaClient: FivaClient;
    let tonClient: TonClient4;
    let connector: TonConnect;
    let syMinterAddr = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');

    beforeAll(async () => {
        tonClient = new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });

        const storagePath = path.join(require('path').resolve(__dirname, '..'), 'temp', 'ton-connect.json');
        connector = await getConnector(storagePath, MANIFEST_URL);

        fivaClient = new FivaClient({ connector, tonClient, syAddress: syMinterAddr });
    }, 60000);

    it('Gas estimation returns valid data', async () => {
        const { value, fwdValue } = await fivaClient.getFeesEstimation(SYOp.wrap_and_swap_sy_for_pt);

        expect(value).toBeGreaterThanOrEqual(toNano(0.2));
        expect(fwdValue).toBeGreaterThanOrEqual(toNano(0.1));
    });

    it('Maturity getter returns valid date', async () => {
        const maturityDate = await fivaClient.getMaturityDate();

        expect(maturityDate > new Date('2025-06-01')).toBeTruthy();
        expect(maturityDate < new Date('2030-06-01')).toBeTruthy();
    });

    it('Index available for Evaa SY only', async () => {
        const syAddresses = [
            { addr: 'EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl', hasIndex: true },
            { addr: 'EQA0Pobx0rXc7MlfXvUAZlC_U4MRGJ4FKGq79dHbBJ7RsuyB', hasIndex: false },
            { addr: 'EQB9nQdgwdaTXG6F7mDEErPuuJza6lmCfQjun-PXK3iJXm2h', hasIndex: false },
            { addr: 'EQD5A2ygwSgAXXTqI-OkAOY72bXn8-mRgE9wOEFLKgu6ifbD', hasIndex: false },
        ];

        for (const sy of syAddresses) {
            const client = new FivaClient({ connector, tonClient, syAddress: Address.parse(sy.addr) });
            const syMinter = client.getSyMinter();

            const index = await syMinter.getIndex();

            if (sy.hasIndex) {
                expect(index).toBeGreaterThan(1_000_000n);
                expect(index).toBeLessThan(2_000_000n);
            } else {
                expect(index).toEqual(0n);
            }
        }
    });

    it('get expected amount out for PT -> USDT swaps', async () => {
        let usdtSyAddr = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
        const client = new FivaClient({ connector, tonClient, syAddress: usdtSyAddr });

        const gotUSD = await client.getExpectedSwapAmountOut(FivaAsset.PT, FivaAsset.Underlying, toNano(123));

        const approxExpOut = 123_000_000n;
        expect(Math.abs(Number(gotUSD - approxExpOut))).toBeLessThan(10_000_000n);
    });

    it('get expected amount out for PT -> underlying jetton swaps', async () => {
        let usdtSyAddr = Address.parse('EQB9nQdgwdaTXG6F7mDEErPuuJza6lmCfQjun-PXK3iJXm2h');
        const client = new FivaClient({ connector, tonClient, syAddress: usdtSyAddr });

        const gotUSD = await client.getExpectedSwapAmountOut(FivaAsset.PT, FivaAsset.Underlying, toNano(123));

        const approxExpOut = toNano(100);
        expect(Math.abs(Number(gotUSD - approxExpOut))).toBeLessThan(toNano(10));
    });

    it('get expected amount out for USDT -> PT swaps', async () => {
        let usdtSyAddr = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
        const client = new FivaClient({ connector, tonClient, syAddress: usdtSyAddr });

        const gotPT = await client.getExpectedSwapAmountOut(FivaAsset.Underlying, FivaAsset.PT, 123_000_000n);

        const approxExpOut = toNano(123);
        expect(Math.abs(Number(gotPT - approxExpOut))).toBeLessThan(toNano(10));
    });

    it('invalid asset combination should fail', async () => {
        const fromTo = [
            { from: FivaAsset.Underlying, to: FivaAsset.Underlying, err: 'From and to assets are the same' },
            { from: FivaAsset.PT, to: FivaAsset.PT, err: 'From and to assets are the same' },
            { from: FivaAsset.YT, to: FivaAsset.YT, err: 'From and to assets are the same' },
            { from: FivaAsset.PT, to: FivaAsset.YT, err: 'Swaps between PT and YT assets are not supported' },
            { from: FivaAsset.YT, to: FivaAsset.PT, err: 'Swaps between PT and YT assets are not supported' },
        ];

        for (const assets of fromTo) {
            const getFunc = async () => await fivaClient.getExpectedSwapAmountOut(assets.from, assets.to, toNano(123));
            await expect(getFunc).rejects.toThrowError(assets.err);
        }
    });

    it('realistic APY for assets', async () => {
        const syAddresses = [
            'EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl',
            'EQA0Pobx0rXc7MlfXvUAZlC_U4MRGJ4FKGq79dHbBJ7RsuyB',
            'EQB9nQdgwdaTXG6F7mDEErPuuJza6lmCfQjun-PXK3iJXm2h',
            'EQD5A2ygwSgAXXTqI-OkAOY72bXn8-mRgE9wOEFLKgu6ifbD',
        ];

        for (const syAddr of syAddresses) {
            const client = new FivaClient({ connector, tonClient, syAddress: Address.parse(syAddr) });

            const apy = await client.getFixedAPY();

            expect(apy).toBeGreaterThan(1);
            expect(apy).toBeLessThan(30);
        }
    });

    it('realistic gain for assets', async () => {
        const syAddresses = [
            { addr: 'EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl', amount: 100_000_000n },
            { addr: 'EQA0Pobx0rXc7MlfXvUAZlC_U4MRGJ4FKGq79dHbBJ7RsuyB', amount: toNano(100) },
            { addr: 'EQB9nQdgwdaTXG6F7mDEErPuuJza6lmCfQjun-PXK3iJXm2h', amount: toNano(100) },
            { addr: 'EQD5A2ygwSgAXXTqI-OkAOY72bXn8-mRgE9wOEFLKgu6ifbD', amount: toNano(100) },
        ];

        for (const sy of syAddresses) {
            const client = new FivaClient({ connector, tonClient, syAddress: Address.parse(sy.addr) });

            const gain = await client.getGain(sy.amount);

            expect(gain).toBeGreaterThan(0);
            expect(gain).toBeLessThan(10);
        }
    });
});
