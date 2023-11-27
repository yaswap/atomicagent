require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:3-agent-fund')

const Order = require('../../models/Order')
const { RescheduleError } = require('../../utils/errors')

async function process(job) {
  debug(job.data)

  const { orderId, toLastScannedBlock } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  if (order.status !== 'AGENT_CONTRACT_CREATED') {
    throw new Error(`Order has invalid status: ${orderId} / ${order.status}`)
  }

  const fromClient = await order.fromClient()

  let fromCurrentBlockNumber
  let fromCurrentBlock

  try {
    fromCurrentBlockNumber = await fromClient.chain.getBlockHeight()
    fromCurrentBlock = await fromClient.chain.getBlockByNumber(fromCurrentBlockNumber)
  } catch (e) {
    throw new RescheduleError(`Failed to get latest block height with error = ${e.message}`, order.from)
  }

  const stop =
    order.isQuoteExpired() || order.isSwapExpired(fromCurrentBlock) || order.isNodeSwapExpired(fromCurrentBlock)
  if (stop) {
    if (order.isQuoteExpired()) {
      debug(`Order ${orderId} expired due to expiresAt`)
      order.status = 'QUOTE_EXPIRED'
    }

    if (order.isSwapExpired(fromCurrentBlock)) {
      debug(`Order ${orderId} expired due to swapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    if (order.isNodeSwapExpired(fromCurrentBlock)) {
      debug(`Order ${orderId} expired due to nodeSwapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    await order.save()

    await order.log('FUND_SWAP', null, {
      fromBlock: fromCurrentBlockNumber
    })

    debug(`Stopping ${orderId} - ${order.status}`)

    return
  }

  const toSecondaryFundTx = await order.fundSwap()
  if (toSecondaryFundTx) {
    debug('Initiated secondary funding transaction', orderId, toSecondaryFundTx.hash)
    order.addTx('toSecondaryFundHash', toSecondaryFundTx)
  }

  order.status = 'AGENT_FUNDED'
  await order.save()

  const next = []

  if (toSecondaryFundTx) {
    next.push({
      name: 'verify-tx',
      data: {
        orderId,
        type: 'toSecondaryFundHash'
      }
    })
  }

  await order.log('FUND_SWAP', null, {
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  next.push({
    name: '4-find-user-claim-or-agent-refund',
    data: {
      orderId,
      toLastScannedBlock,
      asset: order.to
    },
    opts: {
      delay: 1000 * 15
    }
  })

  return { next }
}

module.exports = (job) => {
  return mongo
    .connect()
    .then(() => process(job))
    .finally(() => mongo.disconnect())
}
