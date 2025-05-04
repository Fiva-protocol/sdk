<div align="center">
  <h1>FIVA SDK</h1>
</div>

[![TON](https://img.shields.io/badge/based%20on-TON-blue)](https://ton.org/)

TODO: links to license and npm package

FIVA SDK provides functionality for interaction with FIVA protocol.
It consists of contract classes which implement all major methods.
Apart from that FIVA SDK contains higher level wrapper - FivaClient
which should be used in most cases.

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

You can get all supported SY addresses at: #TBD

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

Get expected value after swap
```
const expectedOut = await fivaClient.getExpectedSwapAmountOut(fromAsset, toAsset, amountIn);
```
Here fromAsset/toAsset are instances of `FivaAsset` enum (for example: `FivaAsset.PT` or `FivaAsset.Underlying`)

Get operation ton fees estimation. I.e. amount which should be sent as message value and forward value
```
const { value, fwdValue } = await fivaClient.getFeesEstimation(<operation>);
```
Allowed operations defined in `SYOp` object (for example: `wrap_and_swap_sy_for_pt`)  
Note: in most cases you don't need this operation. It's used under the hood in FivaClient.
