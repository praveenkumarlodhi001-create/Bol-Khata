// Sirf MongoDB connection jaanchne ke liye:  npm run check-db
const mongoose = require('mongoose')
const { load } = require('./config')
const { connect, diagnose, redact } = require('./db')

;(async () => {
  const cfg = load()
  console.log('Try kar rahe hain: ' + redact(cfg.mongoUri))
  try {
    await connect(cfg)
    const info = await mongoose.connection.db.admin().serverInfo()
    console.log('✓ MongoDB connected (version ' + info.version + ', database: ' + mongoose.connection.name + ')')
    await mongoose.disconnect()
  } catch (e) {
    console.error('✗ Connect nahi hua: ' + e.message)
    const hints = diagnose(e, cfg.mongoUri)
    if (hints.length) console.error('\nKya karna hai:\n' + hints.map((h) => '  ' + h).join('\n'))
    process.exit(1)
  }
})()
