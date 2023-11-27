require('../../utils/sentry')
const mongo = require('../../utils/mongo')
const debug = require('debug')('liquality:agent:worker:2-agent-reciprocate')

const config = require('../../config')
const Check = require('../../models/Check')
const Order = require('../../models/Order')
const Asset = require('../../models/Asset')
const { RescheduleError } = require('../../utils/errors')

async function process(job) {
  debug(job.data)

  const { orderId } = job.data

  const order = await Order.findOne({ orderId }).exec()
  if (!order) {
    throw new Error(`Order not found: ${orderId}`)
  }
  if (order.status !== 'USER_FUNDED') {
    throw new Error(`Order has invalid status: ${orderId} / ${order.status}`)
  }

  const fromClient = await order.fromClient()
  const toClient = await order.toClient()

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
      debug(`Order ${order.orderId} expired due to expiresAt`)
      order.status = 'QUOTE_EXPIRED'
    }

    if (order.isSwapExpired(fromCurrentBlock)) {
      debug(`Order ${order.orderId} expired due to swapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    if (order.isNodeSwapExpired(fromCurrentBlock)) {
      debug(`Order ${order.orderId} expired due to nodeSwapExpiration`)
      order.status = 'SWAP_EXPIRED'
    }

    await order.save()

    await order.log('RECIPROCATE_INIT_SWAP', null, {
      fromBlock: fromCurrentBlockNumber
    })

    return
  }

  const check = await Check.getCheckForOrder(orderId)
  const flag = check.get('flags.reciprocate-init-swap') || {}

  if (flag.reject) {
    debug(`Rejected ${orderId}`, flag.message)
    return
  }

  // const withinUsdThreshold = order.fromAmountUsd > 0 && order.fromAmountUsd < config.threshold.manualAboveFromAmountUsd
  // if (!withinUsdThreshold) {
  //   if (!flag.approve) {
  //     throw new RescheduleError(`Reschedule ${orderId}: reciprocate-init-swap is not approved yet`, order.from)
  //   }

  //   debug(`Approved ${orderId}`, flag.message)
  // }

  const fromAsset = await Asset.findOne({ code: order.from }).exec()
  if (fromAsset['24hrUsdLimit']) {
    const yesterday = Date.now() - 1000 * 60 * 60 * 24
    const query = await Order.aggregate([
      {
        $match: {
          from: order.from,
          status: { $nin: ['QUOTE', 'QUOTE_EXPIRED'] },
          createdAt: { $gte: new Date(yesterday) }
        }
      },
      {
        $group: {
          _id: null,
          'sum:fromAmountUsd': { $sum: '$fromAmountUsd' }
        }
      }
    ]).exec()
    const fromAmountDaily = query[0]['sum:fromAmountUsd']
    if (fromAmountDaily > fromAsset['24hrUsdLimit']) {
      if (!flag.approve) {
        throw new RescheduleError(`Reschedule ${orderId}: reciprocate-init-swap is not approved yet`, order.from)
      }
      debug(`Approved ${orderId}`, flag.message)
    }
  }

  const type = 'reciprocate-init-swap'
  const action = 'approve'
  const message = `${order.fromAmountUsd} < ${config.threshold.manualAboveFromAmountUsd}`

  check.set(`flags.${type}`, {
    [action]: new Date(),
    message
  })

  await check.save()

  await order.log('AUTH', 'AUTO_APPROVED', { type, action, message })

  debug(`Auto-approved order ${orderId} worth $${order.fromAmountUsd}`)

  let toLastScannedBlock

  try {
    toLastScannedBlock = await toClient.chain.getBlockHeight()
  } catch (e) {
    throw new RescheduleError(e.message, order.to)
  }

  const toFundTx = await order.initiateSwap()

  debug('Created contract/funded with transaction', order.orderId, toFundTx.hash)

  order.addTx('toFundHash', toFundTx)
  order.status = 'AGENT_CONTRACT_CREATED'
  await order.save()

  await order.log('RECIPROCATE_INIT_SWAP', null, {
    toLastScannedBlock: toLastScannedBlock,
    toFundHash: toFundTx.hash,
    toSecondaryFundHash: order.toSecondaryFundHash
  })

  return {
    next: [
      {
        name: '3-agent-fund',
        data: { orderId, toLastScannedBlock, asset: order.to },
        opts: {
          delay: 1000 * 15
        }
      },
      {
        name: 'verify-tx',
        data: {
          orderId,
          type: 'toFundHash'
        }
      }
    ]
  }
}

module.exports = (job) => {
  return mongo
    .connect()
    .then(() => process(job))
    .finally(() => mongo.disconnect())
}
