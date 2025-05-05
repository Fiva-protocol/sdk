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
    const index = await fivaClient.getIndex();

    // Mint PT and YT from 1 USDT
    const usdtAmount = 1_000_000n;
    // NOTE: for non-evaa assets SY amount = underlying amount
    const syAmount = (usdtAmount * 1000n * INDEX_PRECISION) / index!!;

    const expectedPtYtOut = await fivaClient.getMintYtPtOut(syAmount);
    console.log(
        `Expected to get ${Number(expectedPtYtOut.pt_amount) / FIVA_JETTON_PRECISION} PT and YT from minting 1 USDT`,
    );

    // Send mint request for 1 USDT
    await fivaClient.mintPtAndYt(usdtAmount, queryId);

    const syOut = await fivaClient.getRedeemSyOutBeforeMaturity(toNano(1), toNano(1));
    const usdtAmoutOut = (syOut * index!!) / 1000n / INDEX_PRECISION;
    console.log(`Expected to get ${Number(usdtAmoutOut) / USDT_PRECISION} USDT after redeeming 1 PT and 1 YT`);

    // Send redeem for 1 PT and 1 YT in 2 transactions
    await fivaClient.sendRedeemPT(toNano(1), queryId);
    await fivaClient.sendRedeemYT(toNano(1), queryId);

    // The same operation but with batch method
    // Note: sending batch transactions may not be supported by some wallets (Ledger)
    await fivaClient.redeemBatch(toNano(1), toNano(1), queryId);

    process.exit(0);
}

main();
