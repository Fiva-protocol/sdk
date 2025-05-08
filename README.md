<div align="center">
  <h1>FIVA SDK</h1>
</div>

[![TON](https://img.shields.io/badge/based%20on-TON-blue)](https://ton.org/)

NPM package: https://www.npmjs.com/package/@fiva/sdk

The FIVA SDK is designed for seamless integration with FIVA protocol on TON blockchain.
It contains a comprehensive set of tools, including instruments for trading Fiva assets,
liquidity provision, yield claiming and more.  
This SDK is intended to be used in TypeScript / JavaScript apps.

## Installation

### NPM

```bash
npm install @fiva/sdk
```

### Yarn

```bash
yarn add @fiva/sdk
```

### PNPM

```bash
pnpm install @fiva/sdk
```

### How to use

Initialize FivaClient from SDK with your wallet connector, ton client and SY you want to work with:
```
const fivaClient = new FivaClient({ connector, tonClient, syAddress: <SY address> });
```

You can get all supported SY addresses at:
- https://raw.githubusercontent.com/Fiva-protocol/assets/refs/heads/main/mainnet_SY.json - Mainnet
- https://raw.githubusercontent.com/Fiva-protocol/assets/refs/heads/main/testnet_SY.json - Testnet

#### Getters
Use get operations to retrieve all necessary information from protocol.

Get current asset index
```
await fivaClient.getIndex()
```

Get maximal allowed total supply
```
const { maxTotalSupply } = await fivaClient.getMaxTotalSupply();
```

Get operation ton fees estimation. I.e. amount which should be sent as message value and forward value
```
const { value, fwdValue } = await fivaClient.getFeesEstimation(<operation>);
```
Allowed operations defined in `SYOp` object (for example: `wrap_and_swap_sy_for_pt`)  
Note: in most cases you don't need this operation. It's used under the hood in FivaClient.

#### Swaps

Fiva SDK provides functionality for different kinds of swaps:
- `swapAssetForPt(amount)` - swap asset for PT jettons
- `swapPtForAsset(amount)` - swap PT jettons back to underlying asset
- `swapAssetForYt(amount)` - swap asset for YT jettons
- `swapYtForAsset(amount)` - swap YT jettons back to underlying asset

As additional arguments these methods accept:
- queryId - query id which will be used in all transaction messages (by default `0`)
- minOut - minimal amount which user expects to get after the swap.
If swap calculation plan to return lower value, transaction will be reverted and tokens will be returned back.
This parameter is used as a protection from pool volatility and malicious liquidity manipulations.
- recipient - address of jettons recipient (by default it's the same as sender).

Apart from that, it's possible to obtain expected swap result with the following method:
```
const expectedOut = await fivaClient.getExpectedSwapAmountOut(fromAsset, toAsset, amountIn);
```
fromAsset/toAsset are instances of `FivaAsset` enum (for example: `FivaAsset.PT` or `FivaAsset.Underlying`).

You can find a few working examples of swap methods usage in:
- https://github.com/Fiva-protocol/sdk/tree/main/examples/swaps/index.ts
- https://github.com/Fiva-protocol/sdk/tree/main/examples/react-app

#### Pool liquidity

Users can provide liquidity to FIVA pool and receive LP tokens.
In return, FIVA pays rewards proportional to LP amount.

FIVA pool accept liquidity in 2 jettons PT and SY (internal jetton which wraps underlying asset).
Amount of these jettons should be proportional to the existing pool balances. 
These balances can be retrieved via: `getPoolBalances()` method.

There are 2 different ways to add liquidity to the pool. 
The first one is to provide SY and PT liquidity separately:  
`addAssetLiquidity(amount)` - provide SY part of liquidity from underlying asset.
`addPtLiquidity(ptAmount)` - provide PT part of liquidity.

Another approach for liquidity provision is to use a single batch transaction:  
`addLiquidityBatch(assetAmount, ptAmount)`

This way is preferable for the most of the wallets, as user has to sign only one transaction. 
Note: some wallets (Ledger) may not support multiple messages sending.

User can redeem provided liquidity at any moment via the following method:  
`redeemLiquidity(lpAmount)`

Like swap methods, liquidity methods also support queryId, amountOut and recipient params.

To get expected amount of LP jettons from provided SY and PT, use:
- `getExpectedLpOut(syAmount, ptAmount)`


Example:
- https://github.com/Fiva-protocol/sdk/tree/main/examples/liquidity/index.ts


#### Mint and redeem

FIVA allows to mint PT and YT jettons from underlying asset. 
Amount of minted PT and YT depends on the amount of provided underlying asset and current index. 
It's not related to the current FIVA pool state.

The following methods can be used for mint functionality: 
- `getMintYtPtOut(syAmount)` - get expected amount of PT and YT jettons on mint
- `mintPtAndYt(assetAmount)` - mint PT and YT jettons from underlying asset

Redeem:
- `sendRedeemPT(ptAmount)` - start redeem flow, provide PT
- `sendRedeemYT(ytAmount)` - end redeem flow, provide YT
- `redeemBatch(ptAmount, ytAmount)` - redeem flow with a single transaction (preferable option)
- `getRedeemSyOutBeforeMaturity(ytAmount, ptAmount)` - get expected SY out on redeem before maturity
- `getRedeemSyOutAfterMaturity(ptAmount)` - get expected SY after maturity

Example:
- https://github.com/Fiva-protocol/sdk/tree/main/examples/mint_and_redeem/index.ts


#### Yield

Users holding YT jettons can claim their rewards periodically. 
Amount of rewards can be estimated via `getClaimableInterest()` method.

`claimInterest(queryId, recipient)` - claim rewards and send them to recipient address (sender by default).


Example:
- https://github.com/Fiva-protocol/sdk/tree/main/examples/claim_yield/index.ts
