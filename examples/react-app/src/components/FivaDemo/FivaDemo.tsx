import React, { useState, useEffect } from 'react';
import { useTonConnectUI } from '@tonconnect/ui-react';
import { Address, TonClient4 } from '@ton/ton';
import { FivaAsset, FivaClient } from '@fiva/sdk';
import { UsdtToUserRepr, JettonToUserRepr, UserReprToUsdt, UserReprToJetton } from '../../utils/converters';
import './fivaDemo.css';

const ASSETS = {
    USDT_EVAA_SY: {
        address: Address.parse('EQDi9blCcyT-k8iMpFMYY0t7mHVyiCB50ZsRgyUECJDuGvIl'),
        display_name: 'Evaa USDT (maturity 2025-06-01)',
        symbol: 'USDT',
        toUserRepr: UsdtToUserRepr,
        fromUserRepr: UserReprToUsdt,
    },
    STORM_USD_SLP: {
        address: Address.parse('EQA0Pobx0rXc7MlfXvUAZlC_U4MRGJ4FKGq79dHbBJ7RsuyB'),
        display_name: 'Storm USDT-SLP (maturity 2025-06-01)',
        symbol: 'Storm USD SLP',
        toUserRepr: JettonToUserRepr,
        fromUserRepr: UserReprToJetton,
    },
    STORM_TON_SLP: {
        address: Address.parse('EQB9nQdgwdaTXG6F7mDEErPuuJza6lmCfQjun-PXK3iJXm2h'),
        display_name: 'Storm TON-SLP (maturity 2025-06-01)',
        symbol: 'Storm TON SLP',
        toUserRepr: JettonToUserRepr,
        fromUserRepr: UserReprToJetton,
    },
    STORM_NOT_SLP: {
        address: Address.parse('EQD5A2ygwSgAXXTqI-OkAOY72bXn8-mRgE9wOEFLKgu6ifbD'),
        display_name: 'Storm NOT-SLP (maturity 2025-06-01)',
        symbol: 'Storm NOT SLP',
        toUserRepr: JettonToUserRepr,
        fromUserRepr: UserReprToJetton,
    },
};

const FivaDemo: React.FC = () => {
    const [tonConnectUI] = useTonConnectUI();
    const [fivaClient, setFivaClient] = useState<FivaClient | null>(null);

    const [currentAsset, setCurrentAsset] = useState<keyof typeof ASSETS>('USDT_EVAA_SY');
    const [assetBalance, setAssetBalance] = useState<string>('');
    const [ptBalance, setPtBalance] = useState<string>('');
    const [buyAmount, setBuyAmount] = useState('');
    const [expectedBuyOut, setExpectedBuyOut] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [expectedSellOut, setExpectedSellOut] = useState('');

    useEffect(
        () =>
            tonConnectUI.onStatusChange(async (w) => {
                if (!w) {
                    return;
                }
                const fivaClient = new FivaClient({
                    connector: tonConnectUI.connector,
                    tonClient: new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' }),
                    syAddress: ASSETS[currentAsset].address,
                });
                setFivaClient(fivaClient);
            }),
        [tonConnectUI],
    );

    useEffect(() => {
        if (!fivaClient) {
            return;
        }
        fivaClient.getUserAssetWallet().then((w) => {
            w.getJettonBalance().then((b) => setAssetBalance(ASSETS[currentAsset].toUserRepr(b)));
        });
        fivaClient.getUserPtWallet().then((w) => {
            w.getJettonBalance().then((b) => setPtBalance(JettonToUserRepr(b)));
        });
    }, [fivaClient, currentAsset]);

    const handleBuySubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (fivaClient && buyAmount !== '') {
            const amount = ASSETS[currentAsset].fromUserRepr(buyAmount);
            fivaClient.swapAssetForPt(amount, Date.now(), (amount * 99n) / 100n);
        }
    };

    const handleSellSubmit = (e: React.FormEvent) => {
        e.preventDefault();

        if (fivaClient && sellAmount !== '') {
            const amount = UserReprToJetton(sellAmount);
            fivaClient.swapPtForAsset(amount, Date.now(), (amount * 99n) / 100n);
        }
    };

    const changeBuyAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
        setBuyAmount(e.target.value);
        if (fivaClient && e.target.value !== '') {
            const assetAmount = ASSETS[currentAsset].fromUserRepr(e.target.value);
            fivaClient
                .getExpectedSwapAmountOut(FivaAsset.Underlying, FivaAsset.PT, assetAmount)
                .then((out) => setExpectedBuyOut(out.toString()));
        }
    };

    const changeSellAmount = (e: React.ChangeEvent<HTMLInputElement>) => {
        setSellAmount(e.target.value);
        if (fivaClient && e.target.value !== '') {
            const ptAmount = UserReprToJetton(e.target.value);
            fivaClient.getExpectedSwapAmountOut(FivaAsset.PT, FivaAsset.Underlying, ptAmount).then((out) => {
                setExpectedSellOut(out.toString());
            });
        }
    };

    const changeAsset = (newAsset: keyof typeof ASSETS) => {
        setCurrentAsset(newAsset);
        setBuyAmount('');
        setSellAmount('');
        setExpectedBuyOut('');
        setExpectedSellOut('');

        const fivaClient = new FivaClient({
            connector: tonConnectUI.connector,
            tonClient: new TonClient4({ endpoint: 'https://mainnet-v4.tonhubapi.com' }),
            syAddress: ASSETS[newAsset].address,
        });
        setFivaClient(fivaClient);
    };

    return (
        <div className="fiva-demo">
            <div className="asset-selector">
                <select
                    id="asset-select"
                    value={currentAsset}
                    onChange={(e) => changeAsset(e.target.value as keyof typeof ASSETS)}
                    className="asset-select"
                >
                    {Object.entries(ASSETS).map(([key, asset]) => (
                        <option key={key} value={key}>
                            {asset.display_name}
                        </option>
                    ))}
                </select>
            </div>
            <form className="buy-form" onSubmit={handleBuySubmit}>
                <div className="form-content">
                    <div className="balance-asset">
                        Balance:{' '}
                        <strong>
                            {assetBalance} {ASSETS[currentAsset].symbol}
                        </strong>
                    </div>
                    <div className="input-group">
                        <input
                            type="number"
                            value={buyAmount}
                            onChange={changeBuyAmount}
                            placeholder="Enter amount"
                            className="amount-input"
                        />
                        <button type="submit" className="buy-button">
                            Buy PT
                        </button>
                    </div>
                    <div className="expected-out">
                        Expected to get: <strong>{JettonToUserRepr(BigInt(expectedBuyOut))} PT</strong>
                    </div>
                </div>
            </form>
            <form className="sell-form" onSubmit={handleSellSubmit}>
                <div className="form-content">
                    <div className="balance-asset">
                        Balance: <strong>{ptBalance} PT</strong>
                    </div>
                    <div className="input-group">
                        <input
                            type="number"
                            value={sellAmount}
                            onChange={changeSellAmount}
                            placeholder="Enter amount"
                            className="amount-input"
                        />
                        <button type="submit" className="sell-button">
                            Sell PT
                        </button>
                    </div>
                    <div className="expected-out">
                        Expected to get:{' '}
                        <strong>
                            {ASSETS[currentAsset].toUserRepr(BigInt(expectedSellOut))} {ASSETS[currentAsset].symbol}
                        </strong>
                    </div>
                </div>
            </form>
        </div>
    );
};

export default FivaDemo;
