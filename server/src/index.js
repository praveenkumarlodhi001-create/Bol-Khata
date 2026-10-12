const mongoose = require('mongoose')
const { load, validate } = require('./config')
const { connect, diagnose, redact } = require('./db')
const { createApp } = require('./app')

async function main() {
  const cfg = load()
  const problems = validate(cfg)
  if (problems.length) {
    console.error('Server shuru nahi ho sakta:\n - ' + problems.join('\n - '))
    console.error('server/.env.example dekho aur .env banao.')
    process.exit(1)
  }

  console.log('MongoDB se connect ho raha hai: ' + redact(cfg.mongoUri))
  try {
    await connect(cfg)
  } catch (e) {
    console.error('\nMongoDB connect nahi hua: ' + e.message)
    const hints = diagnose(e, cfg.mongoUri)
    if (hints.length) console.error('\nKya karna hai:\n' + hints.map((h) => '  ' + h).join('\n'))
    console.error('\n(Sirf connection jaanchna ho to:  npm run check-db)')
    process.exit(1)
  }
  console.log('MongoDB connected ✓')

  const { syncIndexes } = require('./models')
  try {
    await syncIndexes()
  } catch (e) {
    console.error('MongoDB indexes nahi ban paye: ' + e.message)
    process.exit(1)
  }

  const server = createApp(cfg).listen(cfg.port, '0.0.0.0', () =>
    console.log('Server chal raha hai, port ' + cfg.port)
  )
  server.on('error', (e) => {
    if (e.code === 'EADDRINUSE')
      console.error(`Port ${cfg.port} pehle se use me hai — purana server band karo ya .env me PORT badlo.`)
    else console.error('Server error:', e.message)
    process.exit(1)
  })

  const stop = () => server.close(() => mongoose.disconnect().finally(() => process.exit(0)))
  process.on('SIGINT', stop)
  process.on('SIGTERM', stop)
}

main().catch((e) => {
  console.error('Server shuru nahi hua:', e.message)
  process.exit(1)
})
