const Sentry = require('@sentry/node')

// Enable Sentry (for production only)
if (process.env.NODE_ENV === 'production') {
  Sentry.init({
    dsn: process.env.SENTRY_DSN
  })
}

const api = require('./api')
const worker = require('./worker')
const mongo = require('./utils/mongo')

mongo.connect()

const exit = () => {
  console.log("Force exit !!!")
  process.exit(0)
}

async function start() {
  await worker.start()
  api.start()
}

function stop(signal) {
  return async function () {
    console.log('Received', signal)

    setTimeout(function () {
      exit()
    }, 10000)

    if (signal === 'SIGINT')
    {
      console.log('Stop worker')
      await worker.stop()
      console.log('Stop api')
      await api.stop()
      console.log('Stop mongo')
      await mongo.disconnect()
      console.log('Exit ...')
      process.exit(0)
    }
    else
    {
      console.log('Stop mongo')
      await mongo.disconnect()
      console.log('Stop api')
      await api.stop()
      console.log('Stop worker')
      await worker.stop()
      console.log("Exit")
      process.exit(0)
    }
  }
}

switch (process.env.PROCESS_TYPE) {
  case 'migrate':
    require('./migrate').run()
    break

  default: {
    start()

    process.on('SIGTERM', stop('SIGTERM'))
    process.on('SIGINT', stop('SIGINT'))

    break
  }
}
