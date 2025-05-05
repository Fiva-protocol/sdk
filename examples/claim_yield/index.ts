import { FivaClient } from '@fiva/sdk';
import { Address, TonClient4 } from '@ton/ton';
import { getConnector } from '../tonconnect/connector';
import path from 'path';

const USDT_EVAA_SY = Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl');
const MANIFEST_URL =
    'https://raw.githubusercontent.com/Fiva-protocol/jettons-manifest/refs/heads/main/manifest/manifest.json';

async function main() {
    const tonClient = new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' });
    const storagePath = path.join(require('path').resolve(__dirname, '..'), 'temp', 'ton-connect.json');
    const connector = await getConnector(storagePath, MANIFEST_URL);
    const fivaClient = new FivaClient({ connector, tonClient, syAddress: USDT_EVAA_SY });

    const queryId = Date.now();

    // Calculate amount of USDT to claim (depends on amount of YT and period of holding them)
    const claimableInterest = await fivaClient.getClaimableInterest();
    console.log(`${claimableInterest} USDT can be claimed`);

    // Claim all interest for holding YT
    await fivaClient.claimInterest(queryId);

    process.exit(0);
}

main();
