import { Address } from '@ton/core';
import { TonClient4 } from '@ton/ton';
import { FivaClientAA, FivaAsset } from '../src/FivaClientAA';

describe('FivaClientAA Basic Tests', () => {
    let client: FivaClientAA;
    let mockTonClient: jest.Mocked<TonClient4>;
    let mockTurnkeyConfig: any;
    let mockSyAddress: Address;
    let mockUserAddress: Address;

    beforeEach(() => {
        // Create mock TonClient4
        mockTonClient = {
            open: jest.fn(),
            sendMessage: jest.fn().mockResolvedValue(undefined),
        } as any;

        // Mock Turnkey configuration
        mockTurnkeyConfig = {
            apiBaseUrl: 'https://api.turnkey.com',
            apiPrivateKey: 'mock-private-key',
            apiPublicKey: 'mock-public-key',
            organizationId: 'mock-org-id',
            signingKeyId: 'mock-signing-key-id',
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
            const mockSyMinter = { address: mockSyAddress };
            mockTonClient.open.mockReturnValue(mockSyMinter as any);
            
            const syMinter = client.getSyMinter();
            expect(mockTonClient.open).toHaveBeenCalled();
            expect(syMinter).toBeDefined();
        });
    });

    describe('Asset Type Enum', () => {
        it('should export FivaAsset enum correctly', () => {
            expect(FivaAsset.Underlying).toBe(0);
            expect(FivaAsset.PT).toBe(1);
            expect(FivaAsset.YT).toBe(2);
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

    describe('Error Handling', () => {
        it('should throw error when trying to initialize with invalid Turnkey keys', async () => {
            // The client should fail gracefully with invalid API keys
            await expect(async () => {
                await client.initializeWallet();
            }).rejects.toThrow('Wallet initialization failed');
        });

        it('should throw error when trying to sign with uninitialized wallet', async () => {
            const mockCell = { toBoc: () => Buffer.from('mock-cell') } as any;
            
            await expect(async () => {
                await (client as any).signMessage(mockCell);
            }).rejects.toThrow('Wallet not initialized');
        });
    });

    describe('Configuration', () => {
        it('should store Turnkey configuration correctly', () => {
            expect((client as any).turnkeyConfig).toEqual(mockTurnkeyConfig);
        });

        it('should store user address correctly', () => {
            expect((client as any).userAddress).toEqual(mockUserAddress);
        });

        it('should store SY address correctly', () => {
            expect((client as any).contracts.syMinter).toEqual(mockSyAddress);
        });
    });

    describe('Client Type Verification', () => {
        it('should be instance of FivaClientAA', () => {
            expect(client).toBeInstanceOf(FivaClientAA);
        });

        it('should have all required methods', () => {
            // Verify key methods exist
            expect(typeof client.getSyMinter).toBe('function');
            expect(typeof client.swapAssetForPt).toBe('function');
            expect(typeof client.swapAssetForYt).toBe('function');
            expect(typeof client.mintPtAndYt).toBe('function');
            expect(typeof client.redeemBatch).toBe('function');
            expect(typeof client.addLiquidityBatch).toBe('function');
            expect(typeof client.convertSyToUnderlying).toBe('function');
            expect(typeof client.convertUnderlyingToSy).toBe('function');
        });
    });
});