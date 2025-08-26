import React, { useState, useEffect } from 'react';
import { TonClient } from '@ton/ton';
import { Address } from '@ton/core';
import { FivaAsset, FivaClientAA } from '@fiva/sdk';
import { UsdtToUserRepr, JettonToUserRepr, UserReprToUsdt, UserReprToJetton } from '../../utils/converters';
import { TelegramAuthData, TelegramWebAppManager, applyTelegramTheme } from '../../utils/telegramAuth';
import { generateTurnkeyWalletFromTelegram, WalletInfo } from '../../utils/walletGeneration';
import './fivaDemo.css';

const ASSETS = {
    USDT_EVAA_SY: {
        address: Address.parse('EQBY5JE96x_U5fSSsAzBj8d-_ZbK-5AihJ2rzjTZAtNqsntL'),
        display_name: 'Evaa USDT (maturity 2025-09-01)',
        symbol: 'USDT',
        toUserRepr: UsdtToUserRepr,
        fromUserRepr: UserReprToUsdt
    },
    STORM_USD_SLP: {
        address: Address.parse('EQDLqPppdVfv4bVqV6bpCYwmDUVCsem2LV5zda3fMIKgCxkH'),
        display_name: 'Storm USDT-SLP (maturity 2025-09-01)',
        symbol: 'Storm USD SLP',
        toUserRepr: JettonToUserRepr,
        fromUserRepr: UserReprToJetton
    }
};

interface TurnkeyConfig {
    apiBaseUrl: string;
    apiPrivateKey: string;
    apiPublicKey: string;
    organizationId: string;
}

interface FivaDemoProps {
    telegramAuth: TelegramAuthData;
}

const FivaDemo: React.FC<FivaDemoProps> = ({ telegramAuth }) => {
    const [tgManager] = useState(() => TelegramWebAppManager.getInstance());

    const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

    const [fivaClient, setFivaClient] = useState<FivaClientAA | null>(null);
    const [isInitializingClient, setIsInitializingClient] = useState(false);
    const [clientError, setClientError] = useState<string>('');

    const [currentAsset, setCurrentAsset] = useState<keyof typeof ASSETS>('USDT_EVAA_SY');
    const [poolInfo, setPoolInfo] = useState<{
        lpAmount: string;
        syAmount: string;
        ptAmount: string;
        fixedApy: string;
        maturityDate: string;
    } | null>(null);

    const [buyAmount, setBuyAmount] = useState('');
    const [expectedBuyOut, setExpectedBuyOut] = useState('');
    const [sellAmount, setSellAmount] = useState('');
    const [expectedSellOut, setExpectedSellOut] = useState('');
    const [isTransactionPending, setIsTransactionPending] = useState(false);

    useEffect(() => {
        tgManager.initialize();
        applyTelegramTheme();
    }, [telegramAuth, tgManager]);

    const initializeFivaClient = async () => {
        setIsInitializingClient(true);
        setClientError('');

        tgManager.showMainButton('Initializing Fiva Client...', () => {
        });

        try {
            const turnkeyConfig: TurnkeyConfig = {
                apiBaseUrl: import.meta.env.VITE_TURNKEY_API_BASE_URL || 'https://api.turnkey.com',
                apiPrivateKey: import.meta.env.VITE_TURNKEY_API_PRIVATE_KEY || '',
                apiPublicKey: import.meta.env.VITE_TURNKEY_API_PUBLIC_KEY || '',
                organizationId: import.meta.env.VITE_TURNKEY_ORGANIZATION_ID || ''
            };

            if (!turnkeyConfig.apiPrivateKey || !turnkeyConfig.organizationId) {
                throw new Error('Turnkey configuration is incomplete. Please check your environment variables.');
            }

            const tonClient = new TonClient({
                endpoint: import.meta.env.VITE_TON_RPC_URL || 'https://toncenter.com/api/v2/jsonRPC',
                apiKey: import.meta.env.VITE_TON_API_KEY
            }) as any;

            const tempWallet = generateTurnkeyWalletFromTelegram(telegramAuth);
            const client = new FivaClientAA({
                turnkeyConfig,
                tonClient,
                syAddress: ASSETS[currentAsset].address,
                userAddress: tempWallet.address
            });

            await client.initializeWallet();
            const actualAddress = await client.getTurnkeyWalletAddress();

            setWalletInfo({
                address: actualAddress,
                workchain: 0,
                userId: telegramAuth.user.id,
                telegramUsername: telegramAuth.user.username || telegramAuth.user.first_name,
                createdAt: Date.now()
            });

            setFivaClient(client);
            await loadPoolInfo(client);
            tgManager.hideMainButton();
        } catch (error) {
            console.error('Failed to initialize FivaClientAA:', error);
            setClientError(error instanceof Error ? error.message : 'Failed to initialize client');
            tgManager.hideMainButton();
        } finally {
            setIsInitializingClient(false);
        }
    };

    const loadPoolInfo = async (client: FivaClientAA) => {
        try {
            const [poolBalances, fixedApy, maturityDate] = await Promise.all([
                client.getPoolBalances(),
                client.getFixedAPY(),
                client.getMaturityDate()
            ]);

            setPoolInfo({
                lpAmount: JettonToUserRepr(poolBalances.lp_amount),
                syAmount: JettonToUserRepr(poolBalances.sy_amount),
                ptAmount: JettonToUserRepr(poolBalances.pt_amount),
                fixedApy: fixedApy.toFixed(2),
                maturityDate: maturityDate.toDateString()
            });

        } catch (error) {
            console.error('Failed to load pool info:', error);
        }
    };

    const handleBuySubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fivaClient || !buyAmount || isTransactionPending) return;

        setIsTransactionPending(true);

        try {
            const amount = ASSETS[currentAsset].fromUserRepr(buyAmount);
            tgManager.hapticFeedback('impact', 'medium');

            await fivaClient.swapAssetForPt(
                amount,
                Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000),
                (amount * 99n) / 100n,
                walletInfo!.address
            );

            tgManager.hapticFeedback('notification', 'success');
            tgManager.showAlert(
                `✅ Transaction Successful!\n\nBought ${expectedBuyOut} PT tokens for ${buyAmount} ${ASSETS[currentAsset].symbol}\n\nTransaction has been submitted to the TON network.`,
                () => {
                    setBuyAmount('');
                    setExpectedBuyOut('');
                }
            );

        } catch (error) {
            console.error('Buy transaction failed:', error);

            tgManager.hapticFeedback('notification', 'error');
            let errorMessage = 'Unknown error occurred';
            if (error instanceof Error) {
                errorMessage = error.message;

                if (errorMessage.includes('exit code 5') || errorMessage.includes('insufficient')) {
                    errorMessage += '\n\n💡 This usually means:\n• Insufficient TON balance for gas fees\n• Insufficient asset balance to swap\n• Network connectivity issues';
                } else if (errorMessage.includes('Turnkey')) {
                    errorMessage += '\n\n💡 Turnkey signing issue - check your environment variables';
                }
            }

            tgManager.showAlert(`❌ Transaction Failed!\n\nError: ${errorMessage}`);
        } finally {
            setIsTransactionPending(false);
        }
    };

    const handleSellSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!fivaClient || !sellAmount || isTransactionPending) return;

        setIsTransactionPending(true);

        try {
            const amount = UserReprToJetton(sellAmount);
            tgManager.hapticFeedback('impact', 'medium');

            await fivaClient.swapPtForAsset(
                amount,
                Math.floor(Date.now() / 1000) * 1000 + Math.floor(Math.random() * 1000),
                (amount * 99n) / 100n,
                walletInfo!.address
            );

            tgManager.hapticFeedback('notification', 'success');
            tgManager.showAlert(
                `✅ Transaction Successful!\n\nSold ${sellAmount} PT tokens for ${expectedSellOut} ${ASSETS[currentAsset].symbol}\n\nTransaction has been submitted to the TON network.`,
                () => {
                    setSellAmount('');
                    setExpectedSellOut('');
                }
            );

        } catch (error) {
            console.error('Sell transaction failed:', error);
            tgManager.hapticFeedback('notification', 'error');
            tgManager.showAlert(`❌ Transaction Failed!\n\nError: ${error instanceof Error ? error.message : 'Unknown error'}`);
        } finally {
            setIsTransactionPending(false);
        }
    };

    const changeBuyAmount = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setBuyAmount(e.target.value);

        if (fivaClient && e.target.value !== '') {
            try {
                const assetAmount = ASSETS[currentAsset].fromUserRepr(e.target.value);
                const out = await fivaClient.getExpectedSwapAmountOut(
                    FivaAsset.Underlying,
                    FivaAsset.PT,
                    assetAmount
                );

                setExpectedBuyOut(JettonToUserRepr(out));
                tgManager.showMainButton(`Buy ${UsdtToUserRepr(out)} PT`, async () => {
                    const form = document.querySelector('.buy-form') as HTMLFormElement;
                    if (form) form.requestSubmit();
                });
            } catch (error) {
                console.error('Error calculating buy amount:', error);
                setExpectedBuyOut('Error calculating');
                tgManager.hideMainButton();
            }
        } else {
            setExpectedBuyOut('');
            tgManager.hideMainButton();
        }
    };

    const changeSellAmount = async (e: React.ChangeEvent<HTMLInputElement>) => {
        setSellAmount(e.target.value);

        if (fivaClient && e.target.value !== '') {
            try {
                const ptAmount = UserReprToJetton(e.target.value);
                const out = await fivaClient.getExpectedSwapAmountOut(
                    FivaAsset.PT,
                    FivaAsset.Underlying,
                    ptAmount
                );
                const expectedOut = ASSETS[currentAsset].toUserRepr(out);
                setExpectedSellOut(expectedOut);
                tgManager.showMainButton(`Sell for ${expectedOut} ${ASSETS[currentAsset].symbol}`, async () => {
                    const form = document.querySelector('.sell-form') as HTMLFormElement;
                    if (form) form.requestSubmit();
                });
            } catch (error) {
                console.error('Error calculating sell amount:', error);
                setExpectedSellOut('Error calculating');
                tgManager.hideMainButton();
            }
        } else {
            setExpectedSellOut('');
            if (!buyAmount) tgManager.hideMainButton();
        }
    };

    const changeAsset = (newAsset: keyof typeof ASSETS) => {
        setCurrentAsset(newAsset);
        setBuyAmount('');
        setSellAmount('');
        setExpectedBuyOut('');
        setExpectedSellOut('');
        setFivaClient(null);
        setPoolInfo(null);
        setClientError('');
        tgManager.hideMainButton();
    };

    return (
        <div className="fiva-demo">
            {/* Asset Selector - Show before client initialization */}
            <div className="asset-selector">
                <label htmlFor="asset-select">Select Asset:</label>
                <select
                    id="asset-select"
                    value={currentAsset}
                    onChange={(e) => changeAsset(e.target.value as keyof typeof ASSETS)}
                    className="asset-select"
                    disabled={isInitializingClient}
                >
                    {Object.entries(ASSETS).map(([key, asset]) => (
                        <option key={key} value={key}>
                            {asset.display_name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Initialize Client Section */}
            {!fivaClient && (
                <div className="init-section">
                    <button
                        className="init-button"
                        onClick={initializeFivaClient}
                        disabled={isInitializingClient}
                    >
                        {isInitializingClient ? 'Initializing FivaClientAA...' : 'Initialize Fiva Client'}
                    </button>

                    {clientError && (
                        <div className="error-message">
                            <p>❌ <strong>Client Initialization Failed:</strong></p>
                            <p>{clientError}</p>
                            {clientError.includes('Turnkey configuration') && (
                                <div className="setup-help">
                                    <p><strong>Setup Required:</strong></p>
                                    <ol>
                                        <li>Create a Turnkey organization at <a href="https://turnkey.com"
                                                                                target="_blank"
                                                                                rel="noopener noreferrer">turnkey.com</a>
                                        </li>
                                        <li>Generate API credentials</li>
                                        <li>Create a signing key</li>
                                        <li>Set environment variables in <code>.env</code></li>
                                    </ol>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}

            {walletInfo && fivaClient && (
                <div className="wallet-info">
                    <h3>Your TON Wallet</h3>
                    <div className="wallet-details">
                        <p><strong>Address:</strong> {walletInfo.address.toString()}</p>
                        <p><strong>Managed by:</strong> Turnkey (Telegram ID {telegramAuth.user.id})</p>
                    </div>
                </div>
            )}

            {poolInfo && (
                <div className="pool-info">
                    <h3>Pool Information</h3>
                    <div className="pool-stats">
                        <div className="stat">
                            <span>LP Tokens:</span>
                            <strong>{poolInfo.lpAmount}</strong>
                        </div>
                        <div className="stat">
                            <span>SY Amount:</span>
                            <strong>{poolInfo.syAmount}</strong>
                        </div>
                        <div className="stat">
                            <span>PT Amount:</span>
                            <strong>{poolInfo.ptAmount}</strong>
                        </div>
                        <div className="stat">
                            <span>Fixed APY:</span>
                            <strong>{poolInfo.fixedApy}%</strong>
                        </div>
                        <div className="stat">
                            <span>Maturity:</span>
                            <strong>{poolInfo.maturityDate}</strong>
                        </div>
                    </div>
                </div>
            )}

            {fivaClient && (
                <>
                    <form className="buy-form" onSubmit={handleBuySubmit}>
                        <h3>Buy PT Tokens</h3>
                        <div className="form-content">
                            <div className="input-group">
                                <input
                                    type="number"
                                    value={buyAmount}
                                    onChange={changeBuyAmount}
                                    placeholder={`Enter ${ASSETS[currentAsset].symbol} amount`}
                                    className="amount-input"
                                    step="0.001"
                                    min="0"
                                    disabled={isTransactionPending}
                                />
                                <button
                                    type="submit"
                                    className="buy-button"
                                    disabled={!buyAmount || isTransactionPending}
                                >
                                    {isTransactionPending ? 'Processing...' : 'Buy PT'}
                                </button>
                            </div>
                            {expectedBuyOut && (
                                <div className="expected-out">
                                    Expected to get: <strong>{expectedBuyOut} PT</strong>
                                    <small> (real-time calculation)</small>
                                </div>
                            )}
                        </div>
                    </form>

                    <form className="sell-form" onSubmit={handleSellSubmit}>
                        <h3>Sell PT Tokens</h3>
                        <div className="form-content">
                            <div className="input-group">
                                <input
                                    type="number"
                                    value={sellAmount}
                                    onChange={changeSellAmount}
                                    placeholder="Enter PT amount"
                                    className="amount-input"
                                    step="0.001"
                                    min="0"
                                    disabled={isTransactionPending}
                                />
                                <button
                                    type="submit"
                                    className="sell-button"
                                    disabled={!sellAmount || isTransactionPending}
                                >
                                    {isTransactionPending ? 'Processing...' : 'Sell PT'}
                                </button>
                            </div>
                            {expectedSellOut && (
                                <div className="expected-out">
                                    Expected to get: <strong>
                                    {expectedSellOut} {ASSETS[currentAsset].symbol}
                                </strong>
                                    <small> (real-time calculation)</small>
                                </div>
                            )}
                        </div>
                    </form>
                </>
            )}
        </div>
    );
};

export default FivaDemo;