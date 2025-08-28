import { Address } from '@ton/core';
import { TonClient4 } from '@ton/ton';
import { FivaClientAA, FivaAsset } from '../src/FivaClientAA';

describe('FivaClientAA', () => {
    let client: FivaClientAA;
    let mockTonClient: jest.Mocked<TonClient4>;
    let mockTurnkeyConfig: any;
    let mockSyAddress: Address;
    let mockUserAddress: Address;

    beforeEach(() => {
        // Create mock TonClient4
        mockTonClient = {
            open: jest.fn(),
            sendMessage: jest.fn(),
        } as any;

        // Mock Turnkey configuration
        mockTurnkeyConfig = {
            apiBaseUrl: 'https://api.turnkey.com',
            apiPrivateKey: 'mock-private-key',
            apiPublicKey: 'mock-public-key',
            organizationId: 'mock-org-id',
            privateKeyId: 'mock-private-key-id',
        };

        mockSyAddress = Address.parse('EQD__________________________________________0vo');
        mockUserAddress = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c');

        client = new FivaClientAA({
            turnkeyConfig: mockTurnkeyConfig,
            tonClient: mockTonClient,
            syAddress: mockSyAddress,
            userAddress: mockUserAddress,
        });
    });

    describe('Constructor', () => {
        it('should initialize with provided configuration', () => {
            expect(client).toBeInstanceOf(FivaClientAA);
        });

        it('should throw error if user address is not provided', () => {
            expect(() => {
                new FivaClientAA({
                    turnkeyConfig: mockTurnkeyConfig,
                    tonClient: mockTonClient,
                    syAddress: mockSyAddress,
                });
            }).toThrow('User address must be provided for account abstraction client');
        });
    });

    describe('Contract Getters', () => {
        it('should get SY minter', () => {
            const syMinter = client.getSyMinter();
            expect(mockTonClient.open).toHaveBeenCalled();
            expect(syMinter).toBeDefined();
        });

        it('should get YT minter', async () => {
            const mockYtMinter = {
                getYTMinterAddress: jest.fn().mockResolvedValue(mockSyAddress),
            };
            mockTonClient.open.mockReturnValue(mockYtMinter as any);

            const ytMinter = await client.getYtMinter();
            expect(ytMinter).toBeDefined();
        });

        it('should get PT minter', async () => {
            const mockYtMinter = {
                getYTMinterAddress: jest.fn().mockResolvedValue(mockSyAddress),
                getPtAddresses: jest.fn().mockResolvedValue({
                    ptMinterAddress: mockSyAddress,
                }),
            };
            const mockSyMinter = {
                getYTMinterAddress: jest.fn().mockResolvedValue(mockSyAddress),
            };
            
            mockTonClient.open.mockImplementation((contract) => {
                if (contract.address.equals(mockSyAddress)) {
                    return mockSyMinter as any;
                }
                return mockYtMinter as any;
            });

            const ptMinter = await client.getPtMinter();
            expect(ptMinter).toBeDefined();
        });

        it('should get pool', async () => {
            const mockSyMinter = {
                getPoolAddress: jest.fn().mockResolvedValue(mockSyAddress),
            };
            mockTonClient.open.mockReturnValue(mockSyMinter as any);

            const pool = await client.getPool();
            expect(pool).toBeDefined();
        });
    });

    describe('Wallet Initialization', () => {
        it('should initialize wallet with Turnkey', async () => {
            // Mock Turnkey SDK response
            const mockTurnkeyClient = {
                getPublicKey: jest.fn().mockResolvedValue({
                    publicKey: {
                        publicKeyUncompressed: '04' + '1'.repeat(64), // Mock public key
                    },
                }),
            };

            // Mock the Turnkey SDK
            (client as any).turnkey = {
                apiClient: () => mockTurnkeyClient,
            };

            await client.initializeWallet();
            expect((client as any).wallet).toBeDefined();
        });
    });

    describe('Asset Conversion', () => {
        beforeEach(() => {
            const mockSyMinter = {
                getIndex: jest.fn().mockResolvedValue(1000000n),
                getUnderlyingPrecision: jest.fn().mockResolvedValue(6),
            };
            mockTonClient.open.mockReturnValue(mockSyMinter as any);
        });

        it('should convert SY to underlying', async () => {
            const syAmount = 1000000000n;
            const result = await client.convertSyToUnderlying(syAmount);
            expect(result).toBeGreaterThan(0n);
        });

        it('should convert underlying to SY', async () => {
            const assetAmount = 1000000n;
            const result = await client.convertUnderlyingToSy(assetAmount);
            expect(result).toBeGreaterThan(0n);
        });
    });

    describe('Pool Operations', () => {
        beforeEach(() => {
            const mockPool = {
                getPoolBalances: jest.fn().mockResolvedValue({
                    lp_amount: 1000000n,
                    sy_amount: 500000n,
                    pt_amount: 500000n,
                }),
                getLpOut: jest.fn().mockResolvedValue(100000n),
                getExpectedSwapAmountOut: jest.fn().mockResolvedValue(95000n),
            };
            
            const mockSyMinter = {
                getPoolAddress: jest.fn().mockResolvedValue(mockSyAddress),
                getIndex: jest.fn().mockResolvedValue(1000000n),
                getUnderlyingPrecision: jest.fn().mockResolvedValue(6),
            };

            mockTonClient.open.mockImplementation((contract) => {
                if (contract.address && contract.address.equals) {
                    return mockSyMinter as any;
                }
                return mockPool as any;
            });
        });

        it('should get pool balances', async () => {
            const balances = await client.getPoolBalances();
            expect(balances).toEqual({
                lp_amount: 1000000n,
                sy_amount: 500000n,
                pt_amount: 500000n,
            });
        });

        it('should get expected LP out', async () => {
            const lpOut = await client.getExpectedLpOut(100000n, 100000n);
            expect(lpOut).toBe(100000n);
        });

        it('should get expected swap amount out', async () => {
            // Mock pool wallet addresses
            (client as any).contracts.poolSyWallet = mockSyAddress;
            (client as any).contracts.poolPtWallet = mockUserAddress;

            const amountOut = await client.getExpectedSwapAmountOut(
                FivaAsset.Underlying,
                FivaAsset.PT,
                100000n
            );
            expect(amountOut).toBeGreaterThan(0n);
        });
    });

    describe('Transaction Methods', () => {
        let mockSendTransaction: jest.SpyInstance;

        beforeEach(() => {
            // Mock the sendTransaction method
            mockSendTransaction = jest.spyOn(client as any, 'sendTransaction').mockResolvedValue(undefined);
            
            // Mock the fees estimation
            const mockSyMinter = {
                getFeesEstimation: jest.fn().mockResolvedValue({
                    value: 50000000n,
                    fwdValue: 10000000n,
                }),
            };
            mockTonClient.open.mockReturnValue(mockSyMinter as any);

            // Mock user addresses
            (client as any).contracts.userAssetWallet = mockUserAddress;
            (client as any).contracts.userPtWallet = mockUserAddress;
            (client as any).contracts.userYtWallet = mockUserAddress;
            (client as any).contracts.userLpWallet = mockUserAddress;
            (client as any).contracts.pool = mockSyAddress;
            (client as any).contracts.ytMinter = mockSyAddress;
        });

        it('should swap asset for PT', async () => {
            await client.swapAssetForPt(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should swap asset for YT', async () => {
            await client.swapAssetForYt(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should swap PT for asset', async () => {
            await client.swapPtForAsset(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should swap YT for asset', async () => {
            await client.swapYtForAsset(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should mint PT and YT', async () => {
            await client.mintPtAndYt(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should redeem PT', async () => {
            await client.sendRedeemPT(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should redeem YT', async () => {
            await client.sendRedeemYT(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should redeem batch', async () => {
            await client.redeemBatch(50000n, 50000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                }),
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ], 300000);
        });

        it('should claim interest', async () => {
            await client.claimInterest();
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should add asset liquidity', async () => {
            await client.addAssetLiquidity(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should add PT liquidity', async () => {
            const mockPool = {
                getFeesEstimation: jest.fn().mockResolvedValue({
                    value: 40000000n,
                    fwdValue: 8000000n,
                }),
            };
            mockTonClient.open.mockReturnValue(mockPool as any);

            await client.addPtLiquidity(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 40000000n,
                    body: expect.any(Object),
                })
            ]);
        });

        it('should add liquidity batch', async () => {
            const mockPool = {
                getFeesEstimation: jest.fn().mockResolvedValue({
                    value: 40000000n,
                    fwdValue: 8000000n,
                }),
            };
            
            mockTonClient.open.mockImplementation(() => {
                const syMinter = {
                    getFeesEstimation: jest.fn().mockResolvedValue({
                        value: 50000000n,
                        fwdValue: 10000000n,
                    }),
                };
                return Math.random() > 0.5 ? mockPool as any : syMinter as any;
            });

            await client.addLiquidityBatch(100000n, 100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    body: expect.any(Object),
                }),
                expect.objectContaining({
                    to: mockUserAddress,
                    body: expect.any(Object),
                })
            ], 300000);
        });

        it('should redeem liquidity', async () => {
            await client.redeemLiquidity(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });
    });

    describe('Error Handling', () => {
        it('should handle invalid asset swaps', async () => {
            await expect(async () => {
                await client.getExpectedSwapAmountOut(FivaAsset.PT, FivaAsset.PT, 100000n);
            }).rejects.toThrow('From and to assets are the same');

            await expect(async () => {
                await client.getExpectedSwapAmountOut(FivaAsset.PT, FivaAsset.YT, 100000n);
            }).rejects.toThrow('Swaps between PT and YT assets are not supported');
        });

        it('should handle missing addresses', async () => {
            // Mock empty pool addresses
            (client as any).contracts = { syMinter: mockSyAddress };

            await expect(async () => {
                await client.getExpectedSwapAmountOut(FivaAsset.Underlying, FivaAsset.PT, 100000n);
            }).rejects.toThrow();
        });
    });

    describe('Message Creation', () => {
        it('should create wrap and swap to PT message', () => {
            const message = (client as any).createWrapAndSwapToPtMessage(
                mockUserAddress,
                100000n,
                0
            );
            expect(message).toBeDefined();
            expect(message.toBoc).toBeDefined();
        });

        it('should create wrap and swap to YT message', () => {
            const message = (client as any).createWrapAndSwapToYtMessage(
                mockUserAddress,
                100000n,
                0
            );
            expect(message).toBeDefined();
            expect(message.toBoc).toBeDefined();
        });

        it('should create swap PT to SY and unwrap message', () => {
            const message = (client as any).createSwapPtToSyAndUnwrapMessage(
                mockUserAddress,
                100000n,
                0
            );
            expect(message).toBeDefined();
            expect(message.toBoc).toBeDefined();
        });

        it('should create swap YT to SY and unwrap message', () => {
            const message = (client as any).createSwapYtToSyAndUnwrapMessage(
                mockUserAddress,
                100000n,
                0
            );
            expect(message).toBeDefined();
            expect(message.toBoc).toBeDefined();
        });

        it('should create wrap and mint PT YT message', () => {
            const message = (client as any).createWrapAndMintPtYtMessage(
                mockUserAddress,
                0
            );
            expect(message).toBeDefined();
            expect(message.toBoc).toBeDefined();
        });
    });

    describe('Turnkey Integration', () => {
        it('should handle signing with Turnkey', async () => {
            const mockCell = { toBoc: () => Buffer.from('mock-cell') } as any;
            const mockTurnkeyClient = {
                signRawPayload: jest.fn().mockResolvedValue({
                    signature: '1234567890abcdef',
                }),
            };

            (client as any).turnkey = {
                apiClient: () => mockTurnkeyClient,
            };

            const signature = await (client as any).signMessage(mockCell);
            expect(signature).toBeInstanceOf(Buffer);
            expect(mockTurnkeyClient.signRawPayload).toHaveBeenCalledWith({
                privateKeyId: mockTurnkeyConfig.privateKeyId,
                payload: expect.any(String),
                hashFunction: 'HASH_FUNCTION_NOT_APPLICABLE',
                encoding: 'ENCODING_HEXADECIMAL',
            });
        });
    });
});