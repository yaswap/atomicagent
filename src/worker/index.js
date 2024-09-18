const debug = require('debug')('liquality:agent:worker')
const fs = require('fs').promises
const path = require('path')
const Queue = require('bull')
const Redis = require('ioredis')
const { getAssetInfo } = require('../utils/asset')
const { v4: uuidv4 } = require('uuid')

const config = require('../config')
const Order = require('../models/Order')
const reportError = require('../utils/reportError')

let client
let subscriber
let stopping = false

const bclients = []

let mainQueue
let verifyTxQueue
let updateMarketDataQueue
let updateMarketTimeoutAction
const updateMarketTimeout = 300000
const queueArr = []
const QUEUES_DIR = path.join(__dirname, 'queues')

const checkJobForRetry = (err, job) => {
  // retrying the timeout jobs only for the below specific jobs
  if (!err || !err.message || !job) return false

  if (err.message.includes('timeout of 60000ms exceeded'))
  {
    return true
  }

  if (
    ['4-find-user-claim-or-agent-refund'].includes(job.name) &&
    (err.message.includes('timeout of 30000ms exceeded') ||
      err.message.includes('Request failed with status code 400') ||
      err.message.includes('Request failed with status code 502') ||
      err.message.includes('connection timed out'))
  ) {
    return true
  }

  return false
}

const opts = {
  limiter: {
    max: 1,
    duration: 1000 * 30,
    groupKey: 'groupBy'
  },
  redis: { maxRetriesPerRequest: null, enableReadyCheck: false },
  settings: {
    lockDuration: 45000,
    lockRenewTime: 22500,
    stalledInterval: 30000,
    maxStalledCount: 1
  },
  defaultJobOptions: {
    stackTraceLimit: 20
  },
  createClient: function (type, redisOpts) {
    switch (type) {
      case 'client':
        if (!client) {
          client = new Redis(config.redis.uri, redisOpts)
        }
        return client
      case 'subscriber':
        if (!subscriber) {
          subscriber = new Redis(config.redis.uri, redisOpts)
        }
        return subscriber
      case 'bclient': {
        const client = new Redis(config.redis.uri, redisOpts)
        bclients.push(client)
        return client
      }
      default:
        throw new Error(`Unexpected connection type: "${type}"`)
    }
  }
}

// To avoid high number of requests to get coin balance, we are limiting the requests to 1 per minute
const updateMarketDataQueueOpts = {
  ...opts,
  limiter: {
    ...opts.limiter,
    duration: 1000 * 60
  }
}

const addUniqueJob = (q, name, data = {}, opts = {}) => {
  if (name === 'UpdateMarketData' || q.name === 'UpdateMarketData') {
    return updateMarketDataQueue.add(
      {
        groupBy: 'market-data'
      },
      {
        removeOnComplete: true,
        jobId: 'update-market-data-job'
      }
    )
  }

  if (name === 'verify-tx' || q.name === 'VerifyTx') {
    return verifyTxQueue.add(
      {
        ...data,
        groupBy: uuidv4()
      },
      {
        delay: 1000 * 20,
        removeOnComplete: true,
        jobId: `${name}:${data.orderId}`
      }
    )
  }

  const newOpts = {
    jobId: `${name}:${data.orderId}`,
    ...opts
  }

  if (data.asset) {
    data.groupBy = getAssetInfo(data.asset).chain
  }

  const arr = [name, data, newOpts]

  debug('addUniqueJob', ...arr)

  return mainQueue.add(...arr)
}

module.exports.addUniqueJob = addUniqueJob

const exit = () => {
  debug(`Self-terminate due to UpdateMarketData hangs in 5 minutes !!!`)
  process.kill(process.pid, "SIGTERM");
}

const setUpdateMarketTimer = (jobName, queueName) => {
  debug(`Delete timeout action ${updateMarketTimeoutAction} for job "${jobName}" in queue "${queueName}"`)
  clearTimeout(updateMarketTimeoutAction);
  updateMarketTimeoutAction = setTimeout(function(){
      exit()
  }, updateMarketTimeout);
  debug(`Add timeout action ${updateMarketTimeoutAction} for job "${jobName}" in queue "${queueName}"`)
}

module.exports.start = async () => {
  if (mainQueue) throw new Error('Worker is already running')

  const queues = (await fs.readdir(QUEUES_DIR)).filter((name) => name.endsWith('.js'))
  mainQueue = new Queue('AtomicAgent', opts)

  queues.forEach((queueFileName) => {
    const processorName = path.basename(queueFileName, '.js')
    const processorPath = path.join(QUEUES_DIR, queueFileName)

    if (queueFileName.startsWith('update-market-data')) {
      updateMarketDataQueue = new Queue('UpdateMarketData', updateMarketDataQueueOpts)
      updateMarketDataQueue.process(1, processorPath)
    } else if (queueFileName.startsWith('verify-tx')) {
      verifyTxQueue = new Queue('VerifyTx', opts)
      verifyTxQueue.process(1, processorPath)
    } else {
      mainQueue.process(processorName, 1, processorPath)
    }
  })

  queueArr.push(mainQueue, verifyTxQueue, updateMarketDataQueue)

  queueArr.forEach((q) => {
    q.on('completed', async (job, result) => {
      debug(`[completed] Job "${job.name}" in queue "${q.name}" was completed`)

      if (['UpdateMarketData'].includes(q.name)) {
        setUpdateMarketTimer(job.name, q.name)
      }

      if (!result?.next) return

      result.next.forEach((newJob) => {
        const { name, data = {}, opts = {} } = newJob
        addUniqueJob(q, name, data, opts)
      })
    })

    q.on('failed', async (job, err) => {
      debug(`[failed] Job "${job.name}" in queue "${q.name}" was failed`)
      debug(`err.name = "${err.name}"`)

      if (err.name !== 'RescheduleError') {
        reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
      }

      if (['VerifyTx'].includes(q.name)) {
        const order = await Order.findOne({ orderId: job.data?.orderId }).exec()
        if (order && !order.isAlreadySwapExpired()) {
          debug('Retrying natively', job)
          await job.retry()
        }

        return
      }
      else if (['UpdateMarketData'].includes(q.name)) {
        setUpdateMarketTimer(job.name, q.name)

        debug('Retrying natively', job)
        await job.retry()
        return
      }
      else if (checkJobForRetry(err, job)) {
        debug('Retrying natively', job)
        await job.retry()
        return
      }

      if (err.name !== 'RescheduleError') return

      const args = [
        job.name,
        job.data,
        {
          delay: err.delay || job.opts.delay
        }
      ]

      await job.remove()

      debug(`[Failed] Adding "${job.name}" due to ${err.name} (${err.message})`, ...args)

      addUniqueJob(q, ...args)
    })

    q.on('error', (err) => {
      debug(`[error] Queue "${q.name}" has error`)
      reportError(err, { queueName: q.name })
      if (['UpdateMarketData'].includes(q.name)) {
        setUpdateMarketTimer("empty job", q.name)
      }
    })

    q.on('stalled', async (job) => {
      const err = new Error('Job has stalled')
      reportError(err, { queueName: q.name, orderId: job.data?.orderId }, { job })
      if (['UpdateMarketData'].includes(q.name)) {
        setUpdateMarketTimer(job.name, q.name)
      }
    })
  })

  // kickoff market data update
  setUpdateMarketTimer("starting job", "UpdateMarketData")
  addUniqueJob(updateMarketDataQueue, 'UpdateMarketData')
}

module.exports.stop = async () => {
  if (stopping) return
  stopping = true

  await Promise.all(queueArr.map((q) => q.close()))
  await Promise.all([client, subscriber, ...bclients].map((c) => c.disconnect()))

  console.log('Closed worker')
}

module.exports.getQueues = () => [mainQueue, verifyTxQueue, updateMarketDataQueue]
module.exports.getAtomicAgentQueue = () => mainQueue
