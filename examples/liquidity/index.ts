import { FivaClient } from '@fiva/sdk';
import { Address, toNano, TonClient4 } from '@ton/ton';
import { getConnector } from '../tonconnect/connector';
import path from 'path';

const USDT_EVAA_SY = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
const MANIFEST_URL =
    'https://raw.githubusercontent.com/Fiva-protocol/jettons-manifest/refs/heads/main/manifest/manifest.json';
const INDEX_PRECISION = 1_000_000n;
const USDT_PRECISION = 1_000_000;
const FIVA_JETTON_PRECISION = 1_000_000_000;

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
    // Slippage is 1%
    const minLpOut = (expectedLpOut * 99n) / 100n;
    console.log(
        `Add ${Number(usdtAmount) / USDT_PRECISION} USDT and ${Number(ptAmount) / FIVA_JETTON_PRECISION} PT.
         Expected to get: ${Number(expectedLpOut) / FIVA_JETTON_PRECISION} LP
         Min amount to get: ${Number(minLpOut) / FIVA_JETTON_PRECISION} LP.`,
    );

    // Send USDT and PT to the pool separately (in 2 transactions)
    await fivaClient.addAssetLiquidity(usdtAmount, queryId, minLpOut);
    await fivaClient.addPtLiquidity(ptAmount, queryId, minLpOut);

    // The same operation but with batch method
    // Note: sending batch transactions may not be supported by some wallets (Ledger)
    await fivaClient.addLiquidityBatch(usdtAmount, ptAmount, queryId, minLpOut);

    // Redeem 1 LP to PT and USDT
    await fivaClient.redeemLiquidity(toNano(1));

    process.exit(0);
}

main();
