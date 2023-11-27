const BaseError = require('standard-error')
const config = require('../config')

function createError(name) {
  class Err extends BaseError {}
  Err.prototype.name = name
  return Err
}

class RescheduleError extends BaseError {
  constructor(msg, asset, props) {
    super(msg, props)
    this.asset = asset
    this.name = 'RescheduleError'

    if (config.assets[asset].blockTimeInSeconds) {
      this.delay = config.assets[asset].blockTimeInSeconds * 1000
    }
  }
}

class PossibleTimelockError extends RescheduleError {}

module.exports.RescheduleError = RescheduleError
module.exports.PossibleTimelockError = PossibleTimelockError
module.exports.MarketNotFoundError = createError('MarketNotFoundError')
module.exports.MarketNotActiveError = createError('MarketNotActiveError')
module.exports.InvalidAmountError = createError('InvalidAmountError')
module.exports.CounterPartyInsufficientBalanceError = createError('CounterPartyInsufficientBalanceError')
module.exports.OrderNotFoundError = createError('OrderNotFoundError')
module.exports.UnauthorisedError = createError('UnauthorisedError')
module.exports.InvalidOrderStateError = createError('InvalidOrderStateError')
module.exports.InvalidHashError = createError('InvalidHashError')
module.exports.InvalidHTTPBodyError = createError('InvalidHTTPBodyError')
module.exports.DuplicateOrderError = createError('DuplicateOrderError')
