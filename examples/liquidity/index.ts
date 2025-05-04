import { FivaAsset, FivaClient } from '@fiva/sdk';
import { Address, toNano, TonClient4 } from '@ton/ton';
import { getConnector } from '../tonconnect/connector';
import path from 'path';

const USDT_EVAA_SY = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
const MANIFEST_URL =
    'https://raw.githubusercontent.com/Fiva-protocol/jettons-manifest/refs/heads/main/manifest/manifest.json';
const INDEX_PRECISION = 1_000_000n;

function evaaPtForUsd(usdtAmount: bigint, index: bigint, poolSy: bigint, poolPt: bigint): bigint {
    // NOTE: for non-evaa assets SY amount = underlying amount
    const syAmount = (usdtAmount * 1000n * INDEX_PRECISION) / index;
    return (syAmount * poolPt) / poolSy;
}

async function main() {
    const tonClient = new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });
    const storagePath = path.join(require('path').resolve(__dirname, '..'), 'temp', 'ton-connect.json');
    const connector = await getConnector(storagePath, MANIFEST_URL);
    const fivaClient = new FivaClient({ connector, tonClient, syAddress: USDT_EVAA_SY });

    const queryId = Date.now();
    const poolBalances = await fivaClient.getPoolBalances();
    const index = await fivaClient.getIndex();

    // Add 1 USD and proportional amount of PT
    const usdtAmount = 1_000_000n;
    // NOTE: for non-evaa assets SY amount = underlying amount
    const syAmount = (usdtAmount * 1000n * INDEX_PRECISION) / index!!;
    const ptAmount = (syAmount * poolBalances.pt_amount) / poolBalances.sy_amount;

    const expectedLpOut = await fivaClient.getExpectedLpOut(syAmount, ptAmount);
    // Send USDT and PT to the pool separately (in 2 transactions)
    // Slippage is 1%
    await fivaClient.addAssetLiquidity(usdtAmount, queryId, (expectedLpOut * 99n) / 100n);
    await fivaClient.addPtLiquidity(ptAmount, queryId, (expectedLpOut * 99n) / 100n);

    // The same operation but with batch method
    // Note: sending batch transactions may not be supported by some wallets (ton ledger)
    await fivaClient.addLiquidityBatch(usdtAmount, ptAmount, queryId, (expectedLpOut * 99n) / 100n);

    process.exit(0);
}

main();
