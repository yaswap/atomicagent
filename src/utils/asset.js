const { ChainId, getChain, getAsset, getAllAssets, unitToCurrency, currencyToUnit } = require('@yaswap/cryptoassets')
// const { parseAsset } = require('@yaswap/wallet-core/dist/src/utils/chainify')
const config = require('../config')

function getAssetInfo(asset) {
  return getAsset(config.application.network, asset)
}

function getAllAssetsInfo() {
  return getAllAssets()[config.application.network]
}

function getAssetChain(asset) {
  const chainId = getAssetInfo(asset)?.chain
  return getChain(config.application.network, chainId)
}

function formatAddress(asset, address) {
  return getAssetChain(asset).formatAddress(address)
}

function convertUnitsToCurrency(asset, value) {
  const assetInfo = getAsset(config.application.network, asset)
  return unitToCurrency(assetInfo, value)
}

function convertCurrencyToUnits(asset, value) {
  const assetInfo = getAsset(config.application.network, asset)
  return currencyToUnit(assetInfo, value)
}

const parseAsset = (asset) => {
  if (asset.type === 'native') {
    return { ...asset, isNative: true } //as ChainifyAsset;
  } else {
    const chainifyAsset = {
      ...asset,
      isNative: false
    }

    // Avoid mutation on contractAddress to lower case
    switch (asset.chain) {
      case ChainId.Solana:
        return chainifyAsset //as ChainifyAsset;
      default:
        return {
          ...chainifyAsset,
          contractAddress: asset.contractAddress?.toLowerCase()
        } //as ChainifyAsset;
    }
  }
}

function getChainifyAsset(asset) {
  const assetInfo = getAsset(config.application.network, asset)
  return parseAsset(assetInfo)
}

function getNativeAsset(asset) {
  return getAssetChain(asset).code
}

module.exports = {
  getAssetInfo,
  getAllAssetsInfo,
  getAssetChain,
  formatAddress,
  convertUnitsToCurrency,
  convertCurrencyToUnits,
  getChainifyAsset,
  getNativeAsset
}
