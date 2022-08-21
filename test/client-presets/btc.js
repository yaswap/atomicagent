const { BitcoinEsploraBatchApiProvider } = require('@yaswap/bitcoin-esplora-batch-api-provider')
const { BitcoinJsWalletProvider } = require('@yaswap/bitcoin-js-wallet-provider')
const { BitcoinSwapProvider } = require('@yaswap/bitcoin-swap-provider')
const { BitcoinEsploraSwapFindProvider } = require('@yaswap/bitcoin-esplora-swap-find-provider')
const { BitcoinRpcFeeProvider } = require('@yaswap/bitcoin-rpc-fee-provider')
const { BitcoinNetworks } = require('@yaswap/bitcoin-networks')

module.exports = [
  {
    provider: BitcoinEsploraBatchApiProvider,
    args: (config) => [
      {
        batchUrl: config.assetConfig.batchApi.url,
        url: config.assetConfig.api.url,
        network: BitcoinNetworks.bitcoin_regtest,
        numberOfBlockConfirmation: config.assetConfig.feeNumberOfBlocks
      }
    ]
  },
  {
    provider: BitcoinJsWalletProvider,
    requires: ['mnemonic'],
    args: (config) => [
      {
        network: BitcoinNetworks.bitcoin_regtest,
        mnemonic: config.mnemonic,
        baseDerivationPath: `m/84'/${BitcoinNetworks.bitcoin_regtest.coinType}'/0'`
      }
    ]
  },
  {
    provider: BitcoinSwapProvider,
    args: [
      {
        network: BitcoinNetworks.bitcoin_regtest
      }
    ]
  },
  {
    provider: BitcoinEsploraSwapFindProvider,
    args: (config) => [config.assetConfig.api.url]
  },
  {
    provider: BitcoinRpcFeeProvider
  }
]
