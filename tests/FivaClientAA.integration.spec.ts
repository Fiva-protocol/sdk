import { Address } from '@ton/core';
import { TonClient4 } from '@ton/ton';
import { FivaClient } from '../src/FivaClient';
import { FivaClientAA } from '../src/FivaClientAA';

describe('FivaClientAA Integration Tests', () => {
    const mockSyAddress = Address.parse('EQD__________________________________________0vo');
    const mockUserAddress = Address.parse('EQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAM9c');
    let mockTonClient: jest.Mocked<TonClient4>;

    beforeEach(() => {
        mockTonClient = {
            open: jest.fn(),
            sendMessage: jest.fn(),
        } as any;
    });

    describe('Account Abstraction vs Traditional Client', () => {
        it('should create FivaClient with TonConnect', () => {
            const mockConnector = {
                connected: true,
                account: { address: mockUserAddress.toString() },
                sendTransaction: jest.fn(),
            };

            const traditionalClient = new FivaClient({
                connector: mockConnector as any,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
            });

            expect(traditionalClient).toBeInstanceOf(FivaClient);
        });

        it('should create FivaClientAA with Turnkey', () => {
            const turnkeyConfig = {
                apiBaseUrl: 'https://api.turnkey.com',
                apiPrivateKey: 'mock-private-key',
                apiPublicKey: 'mock-public-key',
                organizationId: 'mock-org-id',
                privateKeyId: 'mock-private-key-id',
            };

            const aaClient = new FivaClientAA({
                turnkeyConfig,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
                userAddress: mockUserAddress,
            });

            expect(aaClient).toBeInstanceOf(FivaClientAA);
        });

        it('should handle transaction signing differently', async () => {
            // Traditional client uses TonConnect
            const mockConnector = {
                connected: true,
                account: { address: mockUserAddress.toString() },
                sendTransaction: jest.fn().mockResolvedValue(undefined),
            };

            const traditionalClient = new FivaClient({
                connector: mockConnector as any,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
            });

            // Mock the required contract methods
            const mockSyMinter = {
                getFeesEstimation: jest.fn().mockResolvedValue({
                    value: 50000000n,
                    fwdValue: 10000000n,
                }),
            };
            const mockUserWallet = {
                sendWrapAndSwapToPt: jest.fn().mockResolvedValue(undefined),
            };

            mockTonClient.open.mockImplementation(() => {
                if (Math.random() > 0.5) return mockSyMinter as any;
                return mockUserWallet as any;
            });

            // Traditional client transaction - uses TonConnect
            await traditionalClient.swapAssetForPt(100000n);
            expect(mockUserWallet.sendWrapAndSwapToPt).toHaveBeenCalled();

            // AA client uses Turnkey for signing
            const turnkeyConfig = {
                apiBaseUrl: 'https://api.turnkey.com',
                apiPrivateKey: 'mock-private-key',
                apiPublicKey: 'mock-public-key',
                organizationId: 'mock-org-id',
                privateKeyId: 'mock-private-key-id',
            };

            const aaClient = new FivaClientAA({
                turnkeyConfig,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
                userAddress: mockUserAddress,
            });

            // Mock the sendTransaction method for AA client
            const mockSendTransaction = jest.spyOn(aaClient as any, 'sendTransaction')
                .mockResolvedValue(undefined);

            // Mock user addresses
            (aaClient as any).contracts.userAssetWallet = mockUserAddress;
            (aaClient as any).contracts.syMinter = mockSyAddress;

            // AA client transaction - uses Turnkey signing
            await aaClient.swapAssetForPt(100000n);
            expect(mockSendTransaction).toHaveBeenCalledWith([
                expect.objectContaining({
                    to: mockUserAddress,
                    value: 50000000n,
                    body: expect.any(Object),
                })
            ]);
        });
    });

    describe('Wallet Management Differences', () => {
        it('should handle wallet creation differently', async () => {
            // Traditional client gets address from TonConnect
            const mockConnector = {
                connected: true,
                account: { address: mockUserAddress.toString() },
            };

            const traditionalClient = new FivaClient({
                connector: mockConnector as any,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
            });

            // The traditional client gets the address from connector
            expect((traditionalClient as any).userAddress).toEqual(mockUserAddress);

            // AA client requires explicit user address or derives from Turnkey wallet
            const turnkeyConfig = {
                apiBaseUrl: 'https://api.turnkey.com',
                apiPrivateKey: 'mock-private-key',
                apiPublicKey: 'mock-public-key',
                organizationId: 'mock-org-id',
                privateKeyId: 'mock-private-key-id',
            };

            const aaClient = new FivaClientAA({
                turnkeyConfig,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
                userAddress: mockUserAddress,
            });

            // Mock Turnkey initialization
            const mockTurnkeyClient = {
                getPublicKey: jest.fn().mockResolvedValue({
                    publicKey: {
                        publicKeyUncompressed: '04' + '1'.repeat(64),
                    },
                }),
            };

            (aaClient as any).turnkey = {
                apiClient: () => mockTurnkeyClient,
            };

            await aaClient.initializeWallet();
            expect((aaClient as any).wallet).toBeDefined();
            expect(mockTurnkeyClient.getPublicKey).toHaveBeenCalledWith({
                publicKeyId: turnkeyConfig.privateKeyId,
            });
        });
    });

    describe('Message Construction Compatibility', () => {
        it('should create compatible messages for same operations', () => {
            const turnkeyConfig = {
                apiBaseUrl: 'https://api.turnkey.com',
                apiPrivateKey: 'mock-private-key',
                apiPublicKey: 'mock-public-key',
                organizationId: 'mock-org-id',
                privateKeyId: 'mock-private-key-id',
            };

            const aaClient = new FivaClientAA({
                turnkeyConfig,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
                userAddress: mockUserAddress,
            });

            // Test that AA client creates the same message format as traditional client
            const swapMessage = (aaClient as any).createWrapAndSwapToPtMessage(
                mockUserAddress,
                100000n,
                0
            );

            expect(swapMessage).toBeDefined();
            expect(swapMessage.toBoc).toBeInstanceOf(Function);
            
            // The message structure should be compatible with the protocol
            const bocData = swapMessage.toBoc();
            expect(bocData).toBeInstanceOf(Buffer);
            expect(bocData.length).toBeGreaterThan(0);
        });
    });

    describe('Error Handling Consistency', () => {
        it('should handle similar errors consistently', async () => {
            // Traditional client
            const mockConnector = {
                connected: false,
                account: null,
            };

            expect(() => {
                new FivaClient({
                    connector: mockConnector as any,
                    tonClient: mockTonClient,
                    syAddress: mockSyAddress,
                });
            }).toThrow('provided connector is not connected');

            // AA client
            const turnkeyConfig = {
                apiBaseUrl: 'https://api.turnkey.com',
                apiPrivateKey: 'mock-private-key',
                apiPublicKey: 'mock-public-key',
                organizationId: 'mock-org-id',
                privateKeyId: 'mock-private-key-id',
            };

            expect(() => {
                new FivaClientAA({
                    turnkeyConfig,
                    tonClient: mockTonClient,
                    syAddress: mockSyAddress,
                    // userAddress is missing
                });
            }).toThrow('User address must be provided for account abstraction client');
        });
    });

    describe('Feature Parity', () => {
        let traditionalClient: FivaClient;
        let aaClient: FivaClientAA;

        beforeEach(() => {
            const mockConnector = {
                connected: true,
                account: { address: mockUserAddress.toString() },
                sendTransaction: jest.fn(),
            };

            traditionalClient = new FivaClient({
                connector: mockConnector as any,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
            });

            const turnkeyConfig = {
                apiBaseUrl: 'https://api.turnkey.com',
                apiPrivateKey: 'mock-private-key',
                apiPublicKey: 'mock-public-key',
                organizationId: 'mock-org-id',
                privateKeyId: 'mock-private-key-id',
            };

            aaClient = new FivaClientAA({
                turnkeyConfig,
                tonClient: mockTonClient,
                syAddress: mockSyAddress,
                userAddress: mockUserAddress,
            });
        });

        it('should have same contract getter methods', () => {
            // Both clients should have the same contract getter methods
            expect(typeof traditionalClient.getSyMinter).toBe('function');
            expect(typeof aaClient.getSyMinter).toBe('function');

            expect(typeof traditionalClient.getYtMinter).toBe('function');
            expect(typeof aaClient.getYtMinter).toBe('function');

            expect(typeof traditionalClient.getPtMinter).toBe('function');
            expect(typeof aaClient.getPtMinter).toBe('function');

            expect(typeof traditionalClient.getPool).toBe('function');
            expect(typeof aaClient.getPool).toBe('function');
        });

        it('should have same utility methods', () => {
            // Both clients should have the same utility methods
            expect(typeof traditionalClient.convertSyToUnderlying).toBe('function');
            expect(typeof aaClient.convertSyToUnderlying).toBe('function');

            expect(typeof traditionalClient.convertUnderlyingToSy).toBe('function');
            expect(typeof aaClient.convertUnderlyingToSy).toBe('function');

            expect(typeof traditionalClient.getExpectedSwapAmountOut).toBe('function');
            expect(typeof aaClient.getExpectedSwapAmountOut).toBe('function');
        });

        it('should have same transaction methods', () => {
            // Both clients should have the same transaction methods
            expect(typeof traditionalClient.swapAssetForPt).toBe('function');
            expect(typeof aaClient.swapAssetForPt).toBe('function');

            expect(typeof traditionalClient.swapAssetForYt).toBe('function');
            expect(typeof aaClient.swapAssetForYt).toBe('function');

            expect(typeof traditionalClient.mintPtAndYt).toBe('function');
            expect(typeof aaClient.mintPtAndYt).toBe('function');

            expect(typeof traditionalClient.addLiquidityBatch).toBe('function');
            expect(typeof aaClient.addLiquidityBatch).toBe('function');

            expect(typeof traditionalClient.redeemBatch).toBe('function');
            expect(typeof aaClient.redeemBatch).toBe('function');
        });

        it('should return same data types for getter methods', async () => {
            const mockSyMinter = {
                getMaxTotalSupply: jest.fn().mockResolvedValue({
                    maxTotalSupply: 1000000000n,
                    totalSupply: 500000000n,
                }),
            };
            mockTonClient.open.mockReturnValue(mockSyMinter as any);

            const traditionalResult = await traditionalClient.getMaxTotalSupply();
            const aaResult = await aaClient.getMaxTotalSupply();

            expect(typeof traditionalResult).toBe(typeof aaResult);
            expect(traditionalResult).toEqual(aaResult);
        });
    });
});