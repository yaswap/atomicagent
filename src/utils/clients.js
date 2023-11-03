const { Client } = require('@yaswap/client')
const { ChainId } = require('@yaswap/cryptoassets')
const { getAssetChain } = require('./asset')
const { ChainNetworks } = require('@yaswap/wallet-core/dist/src/utils/networks')
const { getDerivationPath } = require('@yaswap/wallet-core/dist/src/utils/derivationPath')
const config = require('../config')

const secretManager = require('./secretManager')

const {
  BitcoinEsploraApiProvider,
  BitcoinFeeApiProvider,
  BitcoinHDWalletProvider,
  BitcoinSwapEsploraProvider
} = require('@yaswap/bitcoin')

const {
  YacoinEsploraApiProvider,
  YacoinFeeApiProvider,
  YacoinHDWalletProvider,
  YacoinSwapEsploraProvider,
  YacoinNftProvider
} = require('@yaswap/yacoin')

const {
  LitecoinEsploraApiProvider,
  LitecoinFeeApiProvider,
  LitecoinHDWalletProvider,
  LitecoinSwapEsploraProvider,
} = require('@yaswap/litecoin')

const {
  EIP1559FeeProvider,
  EvmChainProvider,
  EvmWalletProvider,
  EvmSwapProvider,
  OptimismChainProvider,
  RpcFeeProvider
} = require('@yaswap/evm')
const { StaticJsonRpcProvider } = require('@ethersproject/providers')
const { asL2Provider } = require('@eth-optimism/sdk')

const { NearChainProvider, NearSwapProvider, NearWalletProvider } = require('@yaswap/near')
const { SolanaChainProvider, SolanaNftProvider, SolanaWalletProvider } = require('@yaswap/solana')

async function createBtcClient(chainifyNetwork, derivationPath) {
  const btcConfig = config.assets.BTC
  const mnemonic = await secretManager.getMnemonic('BTC')
  const isMainnet = !chainifyNetwork.isTestnet

  // Create Chain provider
  const chainProvider = new BitcoinEsploraApiProvider({
    batchUrl: chainifyNetwork.batchScraperUrl,
    url: chainifyNetwork.scraperUrl,
    network: chainifyNetwork,
    numberOfBlockConfirmation: btcConfig.feeNumberOfBlocks
  })

  if (isMainnet) {
    const feeProvider = new BitcoinFeeApiProvider(chainifyNetwork.feeProviderUrl)
    chainProvider.setFeeProvider(feeProvider)
  }

  // Create swap provider
  const swapProvider = new BitcoinSwapEsploraProvider({
    network: chainifyNetwork,
    scraperUrl: chainifyNetwork.scraperUrl,
    mode: btcConfig.swapMode
  })

  // Create wallet provider
  const walletOptions = {
    network: chainifyNetwork,
    baseDerivationPath: derivationPath,
    mnemonic
  }

  const walletProvider = new BitcoinHDWalletProvider(walletOptions, chainProvider)
  swapProvider.setWallet(walletProvider)

  return new Client().connect(swapProvider)
}

async function createLtcClient(chainifyNetwork, derivationPath) {
  const ltcConfig = config.assets.LTC
  const mnemonic = await secretManager.getMnemonic('LTC')
  const isMainnet = !chainifyNetwork.isTestnet

  // Create Chain provider
  const chainProvider = new LitecoinEsploraApiProvider({
    batchUrl: chainifyNetwork.batchScraperUrl,
    url: chainifyNetwork.scraperUrl,
    network: chainifyNetwork,
    numberOfBlockConfirmation: ltcConfig.feeNumberOfBlocks
  })

  if (isMainnet) {
    const feeProvider = new LitecoinFeeApiProvider(chainifyNetwork.feeProviderUrl)
    chainProvider.setFeeProvider(feeProvider)
  }

  // Create swap provider
  const swapProvider = new LitecoinSwapEsploraProvider({
    network: chainifyNetwork,
    scraperUrl: chainifyNetwork.scraperUrl,
    mode: ltcConfig.swapMode
  })

  // Create wallet provider
  const walletOptions = {
    network: chainifyNetwork,
    baseDerivationPath: derivationPath,
    mnemonic
  }

  const walletProvider = new LitecoinHDWalletProvider(walletOptions, chainProvider)
  swapProvider.setWallet(walletProvider)

  return new Client().connect(swapProvider)
}

async function createYacClient(chainifyNetwork, derivationPath) {
  const yacConfig = config.assets.YAC
  const mnemonic = await secretManager.getMnemonic('YAC')
  const isMainnet = !chainifyNetwork.isTestnet

  // Create Chain provider
  const chainProvider = new YacoinEsploraApiProvider({
    batchUrl: chainifyNetwork.yacoinEsploraApis,
    url: chainifyNetwork.yacoinEsploraApis,
    network: chainifyNetwork,
    numberOfBlockConfirmation: yacConfig.feeNumberOfBlocks
  })

  if (isMainnet) {
    const feeProvider = new YacoinFeeApiProvider(chainifyNetwork.feeProviderUrl)
    chainProvider.setFeeProvider(feeProvider)
  }

  // Create swap provider
  const swapProvider = new YacoinSwapEsploraProvider({
    network: chainifyNetwork,
    scraperUrl: chainifyNetwork.yacoinEsploraSwapApis
  })

  // Create wallet provider
  const walletOptions = {
    network: chainifyNetwork,
    baseDerivationPath: derivationPath,
    mnemonic
  }
  const walletProvider = new YacoinHDWalletProvider(walletOptions, chainProvider)
  swapProvider.setWallet(walletProvider)
  const client = new Client().connect(swapProvider)

  // Create nft provider
  const nftProvider = new YacoinNftProvider(walletProvider)
  client.connect(nftProvider)

  return client
}

// --- BEGIN CREATE EVM CLIENT ---
function getFeeProvider(chain, provider) {
  if (chain.EIP1559) {
    return new EIP1559FeeProvider(provider)
  } else {
    return new RpcFeeProvider(provider, chain.feeMultiplier)
  }
}

function getEvmProvider(chain, chainifyNetwork) {
  const network = chainifyNetwork
  if (chain.isMultiLayered) {
    const provider = asL2Provider(new StaticJsonRpcProvider(network.rpcUrl, chain.network.chainId))
    return new OptimismChainProvider(
      {
        ...chainifyNetwork,
        chainId: chain.network.chainId
      },
      provider,
      chain.feeMultiplier
    )
  } else {
    const provider = new StaticJsonRpcProvider(network.rpcUrl, chain.network.chainId)
    const feeProvider = getFeeProvider(chain, provider)
    return new EvmChainProvider(chain.network, provider, feeProvider, chain.multicallSupport)
  }
}

async function createEvmClient(asset, chain, chainifyNetwork, derivationPath) {
  const mnemonic = await secretManager.getMnemonic(asset)

  // Get EVM Chain Provider
  const chainProvider = getEvmProvider(chain, chainifyNetwork)

  // Get EVM Wallet Provider
  const walletOptions = { derivationPath, mnemonic }
  const walletProvider = new EvmWalletProvider(walletOptions, chainProvider)

  // Add EVM swap provider
  const swapProvider = new EvmSwapProvider({
    // contractAddress: undefined, // TODO Deploy a specialized contract address used for atomic swap
    scraperUrl: chainifyNetwork.scraperUrl
  })
  swapProvider.setWallet(walletProvider)
  const client = new Client().connect(swapProvider)

  // NO NEED SUPPORT NFT AT THE MOMENT
  // if (chain.nftProviderType) {
  //   const nftProvider = getNftProvider(chain.nftProviderType, walletProvider, chainifyNetwork.isTestnet)
  //   client.connect(nftProvider)
  // }

  return client
}
// --- END CREATE EVM CLIENT ---

async function createNearClient(chainifyNetwork, derivationPath) {
  const mnemonic = await secretManager.getMnemonic('NEAR')

  const walletOptions = {
    mnemonic,
    derivationPath: derivationPath,
    helperUrl: chainifyNetwork.helperUrl
  }
  const chainProvider = new NearChainProvider(chainifyNetwork)
  const walletProvider = new NearWalletProvider(walletOptions, chainProvider)
  const swapProvider = new NearSwapProvider(chainifyNetwork.helperUrl, walletProvider)
  return new Client(chainProvider, walletProvider).connect(swapProvider)
}

async function createSolClient(chainifyNetwork, derivationPath) {
  const mnemonic = await secretManager.getMnemonic('SOL')

  const walletOptions = { mnemonic, derivationPath: derivationPath }
  const chainProvider = new SolanaChainProvider(chainifyNetwork)
  const walletProvider = new SolanaWalletProvider(walletOptions, chainProvider)
  const nftProvider = new SolanaNftProvider(walletProvider)

  return new Client(chainProvider, walletProvider).connect(nftProvider)
}

const clients = {}

async function createClient(asset) {
  const chain = getAssetChain(asset)
  const { network, id: chainId } = chain
  const { name, coinType, isTestnet, rpcUrls } = network
  const chainNetwork = ChainNetworks[chainId] ? ChainNetworks[chainId][config.application.network] : {} || {}
  let chainifyNetwork = {
    name,
    coinType,
    isTestnet,
    chainId,
    rpcUrl: rpcUrls && rpcUrls.length > 0 ? rpcUrls[0] : undefined,
    ...chainNetwork,
    custom: false
  }
  const derivationPath = getDerivationPath(chainId, config.application.network, 0, 'default')

  let client
  if (chain.isEVM) {
    const evmConfig = config.assets[asset]
    chainifyNetwork = {
      ...chainifyNetwork,
      scraperUrl: evmConfig.scraper.url,
      rpcUrl: evmConfig.rpc.url
    }
    client = createEvmClient(asset, chain, chainifyNetwork, derivationPath)
  } else {
    switch (chainId) {
      case ChainId.Bitcoin:
        chainifyNetwork = {
          ...chainifyNetwork,
          scraperUrl: config.assets.BTC.api.url,
          batchScraperUrl: config.assets.BTC.batchApi.url,
          feeProviderUrl: 'https://liquality.io/swap/mempool/v1/fees/recommended'
        }
        client = createBtcClient(chainifyNetwork, derivationPath)
        break
      case ChainId.Yacoin:
        chainifyNetwork = {
          ...chainifyNetwork,
          yacoinEsploraApis: config.assets.YAC.api.esploraUrl,
          yacoinEsploraSwapApis: config.assets.YAC.api.esploraSwapUrl,
          feeProviderUrl: 'https://liquality.io/swap/mempool/v1/fees/recommended'
        }
        client = createYacClient(chainifyNetwork, derivationPath)
        break
      case ChainId.Litecoin:
        chainifyNetwork = {
          ...chainifyNetwork,
          scraperUrl: config.assets.LTC.api.url,
          batchScraperUrl: config.assets.LTC.batchApi.url,
          feeProviderUrl: 'https://litecoinspace.org/api/v1/fees/recommended'
        }
        client = createLtcClient(chainifyNetwork, derivationPath)
        break
      case ChainId.Near:
        client = createNearClient(chainifyNetwork, derivationPath)
        break
      case ChainId.Solana:
        client = createSolClient(chainifyNetwork, derivationPath)
        break
      default:
        throw new Error(`Could not create client for asset ${asset}`)
    }
  }

  return client
}

async function getClient(asset) {
  if (asset in clients) return clients[asset]
  const client = await createClient(asset)
  clients[asset] = client
  return client
}

module.exports = { getClient }
