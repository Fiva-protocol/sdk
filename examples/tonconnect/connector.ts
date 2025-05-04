import TonConnect, { isWalletInfoRemote } from '@tonconnect/sdk';
import { FSStorage } from './storage';
import qrcode from 'qrcode-terminal';

export async function getConnector(storagePath: string, manifestUrl: string): Promise<TonConnect> {
    const connector = new TonConnect({
        manifestUrl: manifestUrl,
        storage: new FSStorage(storagePath),
    });
    await connector.restoreConnection();
    if (connector.connected) {
        return connector;
    }
    const walletsList = await connector.getWallets();
    const remoteWalletsList = walletsList.filter(isWalletInfoRemote);
    const walletInfo = remoteWalletsList.find((wallet) => wallet.appName === 'tonkeeper');
    const url = connector.connect({
        universalLink: walletInfo!.universalLink,
        bridgeUrl: walletInfo!.bridgeUrl,
    });
    qrcode.generate(url, { small: true });
    console.log(url);
    connector.onStatusChange((wallet) => {
        if (wallet) {
            console.log(wallet);
        }
    });

    return new Promise<TonConnect>((resolve) => {
        connector.onStatusChange((wallet) => {
            if (wallet) {
                resolve(connector);
            }
        });
    });
}
