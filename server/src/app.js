const express = require('express')
const cors = require('cors')
const { createAuth } = require('./auth')
const { createLedger } = require('./ledger')
const { createPay } = require('./pay')

// Server login/account aur ledger (grahak, udhar/payment, vajah) dono sambhalta hai — sab MongoDB me.
function createApp(cfg) {
  const app = express()
  
  // Render ke reverse proxy ke liye trust proxy yahan set hoga
  app.set('trust proxy', 1)
  if (cfg.trustProxy) app.set('trust proxy', cfg.trustProxy)

  app.use(cors())
  // Restore ke liye bada body; baaki sab jagah chhota. (Pehla parser chal jaaye to doosra use chhod deta hai.)
  app.use('/api/restore', express.json({ limit: '3mb' }))
  // Photo JSON is larger because a 256x256 JPEG is sent as base64; all other routes remain 10 KB.
  app.use('/api/auth/profile/photo', express.json({ limit: '100kb' }))
  app.use(express.json({ limit: '10kb' }))

  const { router: authRouter, requireAuth } = createAuth(cfg)

  app.get('/health', (req, res) => res.json({ ok: true }))
  app.use(createPay())
  app.use('/api/auth', authRouter)
  app.use('/api', createLedger(requireAuth))

  // Kharab JSON body etc. ke liye HTML ki jagah JSON error
  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    console.error('[http-error]', { method: req.method, path: req.originalUrl, status: err.status || 500, message: err.message, stack: process.env.NODE_ENV === 'production' ? undefined : err.stack })
    const status = err.status && err.status < 500 ? err.status : 500
    res.status(status).json({ code: 'bad_request', error: status === 500 ? 'Server error' : 'Request sahi nahi hai' })
  })

  return app
}

module.exports = { createApp }