const { EthereumRpcProvider } = require('@yaswap/ethereum-rpc-provider')
const { EthereumJsWalletProvider } = require('@yaswap/ethereum-js-wallet-provider')
const { EthereumSwapProvider } = require('@yaswap/ethereum-swap-provider')
const { EthereumScraperSwapFindProvider } = require('@yaswap/ethereum-scraper-swap-find-provider')
const { EthereumRpcFeeProvider } = require('@yaswap/ethereum-rpc-fee-provider')
const { EthereumNetworks } = require('@yaswap/ethereum-networks')

let network = EthereumNetworks.local

network = {
  ...network,
  name: 'mainnet',
  chainId: 1337,
  networkId: 1337
}

module.exports = [
  {
    provider: EthereumRpcProvider,
    args: (config) => [
      {
        uri: config.assetConfig.rpc.url
      }
    ]
  },
  {
    provider: EthereumRpcFeeProvider
  },
  {
    provider: EthereumJsWalletProvider,
    requires: ['mnemonic'],
    args: (config) => [
      {
        network,
        mnemonic: config.mnemonic,
        derivationPath: `m/44'/${network.coinType}'/0'/0/0`
      }
    ]
  },
  {
    provider: EthereumSwapProvider
  },
  {
    provider: EthereumScraperSwapFindProvider,
    args: (config) => [config.assetConfig.scraper.url]
  }
]
