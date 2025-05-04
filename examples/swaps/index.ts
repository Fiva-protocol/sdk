import { FivaAsset, FivaClient } from '@fiva/sdk';
import { Address, toNano, TonClient4 } from '@ton/ton';
import { getConnector } from '../tonconnect/connector';
import path from 'path';

const USDT_EVAA_SY = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
const MANIFEST_URL =
    'https://raw.githubusercontent.com/Fiva-protocol/jettons-manifest/refs/heads/main/manifest/manifest.json';
const USDT_PRECISION = 1_000_000;
const FIVA_JETTON_PRECISION = 1_000_000_000;

async function main() {
    const tonClient = new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });
    const storagePath = path.join(require('path').resolve(__dirname, '..'), 'temp', 'ton-connect.json');
    const connector = await getConnector(storagePath, MANIFEST_URL);
    const fivaClient = new FivaClient({ connector, tonClient, syAddress: USDT_EVAA_SY });

    const queryId = Date.now();

    // Swap 1 USD for PT
    const expectedPtOut = await fivaClient.getExpectedSwapAmountOut(FivaAsset.Underlying, FivaAsset.PT, 1_000_000n);
    console.log(`Expected swap amount of 1 USDT for PT: ${Number(expectedPtOut) / USDT_PRECISION}`);
    const minPtOut = (expectedPtOut * 99n) / 100n; // slippage 1%
    await fivaClient.swapAssetForPt(1_000_000n, queryId, minPtOut);

    // Swap 1 USD for YT
    const expectedYtOut = await fivaClient.getExpectedSwapAmountOut(FivaAsset.Underlying, FivaAsset.YT, 1_000_000n);
    console.log(`Expected swap amount of 1 USDT for YT: ${Number(expectedPtOut) / USDT_PRECISION}`);
    const minYtOut = (expectedYtOut * 99n) / 100n; // slippage 1%
    await fivaClient.swapAssetForYt(1_000_000n, queryId, minYtOut);

    // Swap 1 PT for USDT
    let expectedUsdtOut = await fivaClient.getExpectedSwapAmountOut(FivaAsset.PT, FivaAsset.Underlying, toNano(1));
    console.log(`Expected swap amount of 1 PT for USDT: ${Number(expectedUsdtOut) / FIVA_JETTON_PRECISION}`);
    let minUsdtOut = (expectedUsdtOut * 99n) / 100n; // slippage 1%
    await fivaClient.swapPtForAsset(toNano(1), queryId, minUsdtOut);

    // Swap 10 YT for USDT
    expectedUsdtOut = await fivaClient.getExpectedSwapAmountOut(FivaAsset.YT, FivaAsset.Underlying, toNano(10));
    console.log(`Expected swap amount of 10 YT for USDT: ${Number(expectedUsdtOut) / FIVA_JETTON_PRECISION}`);
    minUsdtOut = (expectedUsdtOut * 99n) / 100n; // slippage 1%
    await fivaClient.swapYtForAsset(toNano(10), queryId, minUsdtOut);

    process.exit(0);
}

main();
