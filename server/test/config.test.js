const test = require('node:test')
const assert = require('node:assert/strict')
const { load } = require('../src/config')
const { BRAND_NAME, isSupportedBackupApp } = require('../src/brand')

test('production never exposes development OTP mode', () => {
  const cfg = load({ NODE_ENV: 'production', DEV_SHOW_OTP: 'true', MONGODB_URI: 'mongodb://127.0.0.1/test', JWT_SECRET: 'x'.repeat(48) })
  assert.equal(cfg.isProd, true)
  assert.equal(cfg.devShowOtp, false)
})

test('shared brand constant is Bol-khata', () => {
  assert.equal(BRAND_NAME, 'Bol-khata')
})

test('backup restore accepts current and legacy app names', () => {
  assert.equal(isSupportedBackupApp('Bol-khata'), true)
  assert.equal(isSupportedBackupApp('V-Khatabook'), true)
  assert.equal(isSupportedBackupApp('Other app'), false)
})
