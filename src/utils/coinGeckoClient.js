const debug = require('debug')('liquality:agent:coingecko')
const _ = require('lodash')
const axios = require('axios')
const BN = require('bignumber.js')
const { assets } = require('@liquality/cryptoassets')

class CoinGecko {
  constructor(url = 'https://api.coingecko.com/api/v3') {
    this._axios = axios.create({ baseURL: url })
  }

  async getPrices(coinIds, vsCurrencies) {
    const formattedCoinIds = coinIds.join(',')
    const formattedVsCurrencies = vsCurrencies.map((c) => c.toLowerCase()).join(',') // Normalize to agent casing
    debug(
      `Getting rates from coingecko for /simple/price?ids=${formattedCoinIds}&vs_currencies=${formattedVsCurrencies} `
    )
    const { data } = await this._axios.get(
      `/simple/price?ids=${formattedCoinIds}&vs_currencies=${formattedVsCurrencies}`
    )
    console.log(
      'TACA ===> coinGeckoClient.js, getPrices, formattedCoinIds = ',
      formattedCoinIds,
      ', formattedVsCurrencies = ',
      formattedVsCurrencies
    )
    console.log('TACA ===> coinGeckoClient.js, getPrices, data = ', data)
    // Normalize to agent casing
    let formattedData = _.mapKeys(data, (v, coinGeckoId) =>
      _.findKey(assets, (asset) => asset.coinGeckoId === coinGeckoId)
    )
    formattedData = _.mapValues(formattedData, (rates) => _.mapKeys(rates, (v, k) => k.toUpperCase()))
    console.log('TACA ===> coinGeckoClient.js, getPrices, formattedData = ', formattedData)
    return formattedData
  }

  async getRates(markets, fixedUsdRates = {}) {
    const all = new Set([])

    markets.forEach((market) => {
      if (!fixedUsdRates[market.from]) {
        all.add(market.from)
      }

      if (!fixedUsdRates[market.to]) {
        all.add(market.to)
      }
    })
    console.log('TACA ===> coinGeckoClient.js, getRates, markets = ', markets, ', fixedUsdRates = ', fixedUsdRates)

    const coinIds = [...all].map((currency) => assets[currency].coinGeckoId)
    const rates = await this.getPrices(coinIds, ['USD', ...all])
    console.log('TACA ===> coinGeckoClient.js, getRates, rates = ', rates)

    for (const symbol of [...all]) {
      if (!rates[symbol] && assets[symbol].matchingAsset) {
        rates[symbol] = rates[assets[symbol].matchingAsset]
      }
    }

    Object.entries(fixedUsdRates).forEach(([asset, usdRate]) => {
      rates[asset] = { USD: usdRate }
    })

    return markets.map((market) => {
      let rate

      if (market.from in rates && market.to in rates[market.from]) {
        rate = BN(rates[market.from][market.to])
        console.log(
          'TACA ===> coinGeckoClient.js, getRates, market.from = ',
          market.from,
          ', market.to = ',
          market.to,
          ', rate = 1',
          rate
        )
      } else {
        rate = BN(rates[market.from].USD).div(rates[market.to].USD)
        console.log(
          'TACA ===> coinGeckoClient.js, getRates, market.from = ',
          market.from,
          ', market.to = ',
          market.to,
          ', rate = 2',
          rate
        )
      }

      return {
        from: market.from,
        to: market.to,
        rate,
        usd: {
          [market.from]: rates[market.from].USD,
          [market.to]: rates[market.to].USD
        }
      }
    })
  }
}

const coingecko = new CoinGecko()

module.exports = coingecko
