const { getAllAssetsInfo, getAssetChain } = require('./asset')
module.exports.formatTxHash = function (hash, asset) {
  if (!getAllAssetsInfo()[asset]) {
    return false
  }
  return getAssetChain(asset).formatTransactionHash(hash)
}
module.exports.isValidTxHash = function (hash, asset) {
  if (!getAllAssetsInfo()[asset]) {
    return false
  }
  return getAssetChain(asset).isValidTransactionHash(hash)
}

module.exports.isValidSecretHash = (secretHash) => /^([A-Fa-f0-9]{64})$/.test(secretHash)
