const { convertUnitsToCurrency, convertCurrencyToUnits } = require('./asset')

function calculateToAmount(from, to, fromAmount, rate) {
  const fromAmountBase = convertUnitsToCurrency(from, fromAmount)
  const toBaseAmount = fromAmountBase.times(rate).toNumber()
  const toAmount = Math.floor(convertCurrencyToUnits(to, toBaseAmount).toNumber())
  return toAmount
}

function calculateUsdAmount(asset, amount, usdRate) {
  return convertUnitsToCurrency(asset, amount).times(usdRate).dp(2).toNumber()
}

function calculateFeeUsdAmount(asset, fee, usdRate) {
  return convertUnitsToCurrency(asset, fee).times(usdRate).dp(2).toNumber()
}

module.exports = {
  calculateToAmount,
  calculateUsdAmount,
  calculateFeeUsdAmount
}
