const debug = require('debug')('liquality:agent:yacoinexplorer')
const axios = require('axios')

class YacoinExplorer {
  constructor(url = 'http://73.43.56.247:3001') {
    this._axios = axios.create({ baseURL: url })
  }

  async getPrices() {
    debug(`Getting YAC rate from Yacoin Explorer`)
    const { data } = await this._axios.get(`/getprice`)

    return data['price']
  }
}

const yacoinExplorer = new YacoinExplorer()

module.exports = yacoinExplorer
