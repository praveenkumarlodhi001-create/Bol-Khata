const path = require('path')
const fs = require('fs')
const crypto = require('crypto')

// .env hamesha server/ folder se padho — chahe kisi bhi folder se server chalao.
require('dotenv').config({ path: path.join(__dirname, '..', '.env') })

const LOCAL_URI = 'mongodb://127.0.0.1:27017/bolkhata'

// Development me JWT_SECRET na ho to ek baar random bana kar file me rakh lete hain
// (taaki restart par sab logout na ho). Production me .env me dena hi padega.
function devSecret() {
  const file = path.join(__dirname, '..', '.dev-jwt-secret')
  try {
    const s = fs.readFileSync(file, 'utf8').trim()
    if (s.length >= 32) return s
  } catch (e) {
    // pehli baar — neeche banate hain
  }
  const s = crypto.randomBytes(48).toString('hex')
  try {
    fs.writeFileSync(file, s, { mode: 0o600 })
  } catch (e) {
    // likh nahi paye to is run ke liye chalega
  }
  return s
}

function load(env = process.env) {
  const isProd = env.NODE_ENV === 'production'
  return {
    port: Number(env.PORT) || 4000,
    // Dev me MONGODB_URI na ho to local MongoDB (127.0.0.1) maan lete hain.
    mongoUri: env.MONGODB_URI || (isProd ? '' : LOCAL_URI),
    jwtSecret: env.JWT_SECRET || (isProd ? '' : devSecret()),
    isProd,
    devShowOtp: env.DEV_SHOW_OTP === 'true' && !isProd,
    // Render sits behind a single trusted reverse proxy. Allow an explicit override;
    // otherwise trust one proxy hop in production and none during local development.
    trustProxy: env.TRUST_PROXY ? Number(env.TRUST_PROXY) : (isProd ? 1 : false),
    // Configurable for isolated integration tests; production defaults stay conservative.
    credentialRateLimit: Math.max(1, Number(env.AUTH_LOGIN_LIMIT) || 10),
    credentialRateWindowMs: Math.max(1000, Number(env.AUTH_LOGIN_WINDOW_MS) || 15 * 60 * 1000),
    // Atlas "querySrv ECONNREFUSED" aaye to .env me DNS_SERVERS=8.8.8.8,1.1.1.1 do
    dnsServers: (env.DNS_SERVERS || '').split(',').map((s) => s.trim()).filter(Boolean)
  }
}

function validate(cfg) {
  const problems = []
  if (!cfg.mongoUri) problems.push('MONGODB_URI .env me nahi hai')
  if (cfg.jwtSecret.length < 32) problems.push('JWT_SECRET kam se kam 32 akshar ka hona chahiye')
  return problems
}

module.exports = { load, validate, LOCAL_URI }
