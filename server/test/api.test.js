// Integration test: asli MongoDB par chalta hai.
//   TEST_MONGODB_URI="mongodb://127.0.0.1:27017/bolkhata_test" npm test
// Sirf apne banaye test users/customers ko hatata hai — baaki data ko haath nahi lagata.
const test = require('node:test')
const assert = require('node:assert/strict')
const mongoose = require('mongoose')
const { createApp } = require('../src/app')
const { User, Otp, Customer, Transaction } = require('../src/models')
const { hasPhotoFlag } = require('../src/photoFlags')

test('shop avatar metadata uses selected hasPhoto flag', () => {
  assert.equal(hasPhotoFlag({ hasPhoto: true }), true)
  assert.equal(hasPhotoFlag({ hasPhoto: false }), false)
  assert.equal(hasPhotoFlag({ photo: Buffer.from([1]) }), false)
  assert.equal(hasPhotoFlag(null), false)
})

const URI = process.env.TEST_MONGODB_URI
// FerretDB jaise MongoDB-compatible test servers TTL index nahi samajhte; test me use hata dete hain.
const noTtl = !!process.env.SKIP_TTL_INDEX
if (noTtl) mongoose.set('autoIndex', false)
const run = String(Date.now())
const cfg = { jwtSecret: 'x'.repeat(48), devShowOtp: true, trustProxy: false, credentialRateLimit: Number(process.env.TEST_AUTH_LOGIN_LIMIT) || 1000, credentialRateWindowMs: Number(process.env.TEST_AUTH_LOGIN_WINDOW_MS) || 15 * 60 * 1000 }
const mkPhone = () => '9' + String(Math.floor(Math.random() * 1e9)).padStart(9, '0')
const phones = []
let server, base

async function call(method, path, { body, token, raw } = {}) {
  const res = await fetch(base + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: raw !== undefined ? raw : body ? JSON.stringify(body) : undefined
  })
  return { status: res.status, body: await res.json().catch(() => ({})) }
}

test('V-Khatabook API', { skip: !URI && 'TEST_MONGODB_URI set nahi hai' }, async (t) => {
  await mongoose.connect(URI, { serverSelectionTimeoutMS: 5000 })
  if (noTtl) {
    await User.createIndexes()
    await Otp.collection.createIndex({ phone: 1 }, { unique: true })
    await Customer.createIndexes()
    await Transaction.createIndexes()
  } else {
    await Promise.all([User.init(), Otp.init(), Customer.init(), Transaction.init()])
  }
  server = createApp(cfg).listen(0)
  base = 'http://127.0.0.1:' + server.address().port
  const emailA = `a${run}@test.example`
  const emailB = `b${run}@test.example`
  const emailC = `c${run}@test.example`

  t.after(async () => {
    server.close()
    const users = await User.find({ $or: [{ email: { $in: [emailA, emailB, emailC] } }, { phone: { $in: phones } }] })
    const ids = users.map((u) => u._id)
    const custIds = (await Customer.find({ ownerId: { $in: ids } }).select('_id').lean()).map((c) => c._id)
    await Transaction.deleteMany({ c: { $in: custIds } })
    await Customer.deleteMany({ ownerId: { $in: ids } })
    await User.deleteMany({ _id: { $in: ids } })
    await Otp.deleteMany({ phone: { $in: phones } })
    await mongoose.disconnect()
  })

  await t.test('signup: sahi data par token milta hai', async () => {
    const r = await call('POST', '/api/auth/signup', { body: { name: 'Asha', email: emailA, password: 'secret1', role: 'seller' } })
    assert.equal(r.status, 201)
    assert.ok(r.body.token)
    assert.equal(r.body.user.email, emailA)
    assert.equal(r.body.user.passwordHash, undefined)
    const b = await call('POST', '/api/auth/signup', { body: { name: 'Bunty', email: emailB, password: 'secret2', role: 'seller' } })
    assert.equal(b.status, 201)
  })

  await t.test('signup: duplicate, kamzor password, NoSQL-injection reject', async () => {
    const dup = await call('POST', '/api/auth/signup', { body: { name: 'Asha', email: emailA.toUpperCase(), password: 'secret1', role: 'seller' } })
    assert.equal(dup.status, 409)
    const weak = await call('POST', '/api/auth/signup', { body: { name: 'Asha', email: `c${run}@test.example`, password: '123', role: 'seller' } })
    assert.equal(weak.status, 400)
    const inj = await call('POST', '/api/auth/login', { body: { email: { $gt: '' }, password: { $gt: '' } } })
    assert.equal(inj.status, 400)
  })

  await t.test('login: sahi/galat password, /me', async () => {
    const ok = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })
    assert.equal(ok.status, 200)
    const bad = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'wrong-one' } })
    assert.equal(bad.status, 401)
    const ghost = await call('POST', '/api/auth/login', { body: { email: `nobody${run}@test.example`, password: 'secret1' } })
    assert.equal(ghost.status, 401)
    assert.equal(ghost.body.error, bad.body.error) // email registered hai ya nahi, pata nahi chalta
    const me = await call('GET', '/api/auth/me', { token: ok.body.token })
    assert.equal(me.body.user.email, emailA)
    const noTok = await call('GET', '/api/auth/me', { token: 'junk' })
    assert.equal(noTok.status, 401)
  })

  await t.test('OTP: bhejna, cooldown, galat code, sahi code, dobara use nahi', async () => {
    const phone = mkPhone()
    phones.push(phone)
    const send = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Test User', role: 'seller' } })
    assert.equal(send.status, 200)
    assert.match(send.body.devOtp, /^\d{6}$/)
    assert.equal((await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Test User', role: 'seller' } })).status, 429)
    // Signup OTP login screen par accept nahi hona chahiye.
    const wrongScreen = await call('POST', '/api/auth/otp/verify', { body: { phone, code: send.body.devOtp, purpose: 'login' } })
    assert.equal(wrongScreen.status, 400)
    assert.equal(wrongScreen.body.code, 'otp_purpose')
    const wrong = send.body.devOtp === '000000' ? '000001' : '000000'
    assert.equal((await call('POST', '/api/auth/otp/verify', { body: { phone, code: wrong, purpose: 'signup', name: 'Test User', role: 'seller' } })).status, 400)
    const ok = await call('POST', '/api/auth/otp/verify', { body: { phone, code: send.body.devOtp, purpose: 'signup', name: 'Test User', role: 'seller' } })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.user.phone, phone)
    assert.equal((await call('POST', '/api/auth/otp/verify', { body: { phone, code: send.body.devOtp, purpose: 'signup', name: 'Test User', role: 'seller' } })).status, 400)
    const again = await call('POST', '/api/auth/otp/verify', { body: { phone, code: '123456', purpose: 'signup', name: 'Test User', role: 'seller' } })
    assert.equal(again.status, 400)
    const loginOtp = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'login' } })
    assert.equal(loginOtp.status, 200)
    assert.match(loginOtp.body.devOtp, /^\d{6}$/)
    const login = await call('POST', '/api/auth/otp/verify', { body: { phone, code: loginOtp.body.devOtp, purpose: 'login' } })
    assert.equal(login.status, 200)
    assert.equal(login.body.user.phone, phone)
    const unknown = mkPhone(); phones.push(unknown)
    const missing = await call('POST', '/api/auth/otp/send', { body: { phone: unknown, purpose: 'login' } })
    assert.equal(missing.status, 404)
    assert.equal(missing.body.code, 'account_missing')
  })

  await t.test('OTP: 5 galat guess ke baad sahi code bhi band', async () => {
    const phone = mkPhone()
    phones.push(phone)
    const { body } = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Test User', role: 'seller' } })
    const wrong = body.devOtp === '000000' ? '000001' : '000000'
    for (let i = 0; i < 5; i++) await call('POST', '/api/auth/otp/verify', { body: { phone, code: wrong, purpose: 'signup', name: 'Test User', role: 'seller' } })
    const late = await call('POST', '/api/auth/otp/verify', { body: { phone, code: body.devOtp, purpose: 'signup', name: 'Test User', role: 'seller' } })
    assert.equal(late.status, 400)
    assert.equal(late.body.code, 'otp_expired')
  })

  await t.test('ledger: vajah ke saath entry, hisaab, history', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    assert.equal((await call('GET', '/api/customers')).status, 401)

    const a = await call('POST', '/api/transactions', {
      token: owner.token,
      body: { name: 'Ramu', amount: 500, type: 'udhar', reason: 'Doodh 10 litre' }
    })
    assert.equal(a.status, 201)
    const b = await call('POST', '/api/transactions', {
      token: owner.token,
      body: { name: 'Ramu', amount: 200, type: 'payment', reason: 'Nagad' }
    })
    const ramu = b.body.customers.find((c) => c.name === 'Ramu')
    assert.equal(ramu.given, 500)
    assert.equal(ramu.paid, 200)
    assert.equal(ramu.balance, 300)
    assert.equal(b.body.summary.owed, 300)
    assert.match(ramu.inviteCode, /^[A-HJ-NP-Z2-9]{6}$/)

    const hist = await call('GET', `/api/customers/${ramu.id}/transactions`, { token: owner.token })
    assert.equal(hist.body.transactions.length, 2)
    assert.ok(hist.body.transactions.some((x) => x.reason === 'Doodh 10 litre'))

    assert.equal((await call('POST', '/api/transactions', { token: owner.token, body: { name: 'Ramu', amount: -5, type: 'udhar' } })).status, 400)
    assert.equal((await call('POST', '/api/transactions', { token: owner.token, body: { name: { $gt: '' }, amount: 5, type: 'udhar' } })).status, 400)
  })

  await t.test('grahak linking: code se judta hai, doosre ka khata nahi dikhta', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const other = (await call('POST', '/api/auth/login', { body: { email: emailB, password: 'secret2' } })).body
    const ramu = (await call('GET', '/api/customers', { token: owner.token })).body.customers.find((c) => c.name === 'Ramu')

    assert.equal((await call('GET', '/api/my-accounts', { token: other.token })).body.accounts.length, 0)
    assert.equal((await call('GET', `/api/my-accounts/${ramu.id}/transactions`, { token: other.token })).status, 404)
    assert.equal((await call('POST', '/api/link', { token: other.token, body: { code: 'ZZZZZZ' } })).status, 404)
    assert.equal((await call('POST', '/api/link', { token: owner.token, body: { code: ramu.inviteCode } })).status, 400)

    assert.equal((await call('POST', '/api/link', { token: other.token, body: { code: ramu.inviteCode } })).status, 200)
    const mine = await call('GET', '/api/my-accounts', { token: other.token })
    assert.equal(mine.body.accounts.length, 1)
    assert.equal(mine.body.accounts[0].balance, 300)
    const h = await call('GET', `/api/my-accounts/${ramu.id}/transactions`, { token: other.token })
    assert.equal(h.body.transactions.length, 2)
  })

  await t.test('entry edit/delete, grahak edit, report', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const tk = owner.token
    await call('POST', '/api/transactions', { token: tk, body: { name: 'Sita', amount: 100, type: 'udhar', reason: 'Doodh' } })
    const o = await call('POST', '/api/transactions', { token: tk, body: { name: 'Sita', amount: 40, type: 'payment' } })
    const sita = o.body.customers.find((c) => c.name === 'Sita')
    assert.equal(sita.balance, 60)
    assert.equal((await call('POST', '/api/transactions', { token: tk, body: { name: 'Sita', amount: 5, type: 'udhar', reason: 'x'.repeat(61) } })).status, 400)

    const hist = (await call('GET', `/api/customers/${sita.id}/transactions`, { token: tk })).body.transactions
    const udhar = hist.find((x) => x.type === 'udhar')
    const edit = await call('PATCH', `/api/transactions/${udhar.id}`, { token: tk, body: { amount: 150, reason: 'Doodh + dahi' } })
    assert.equal(edit.status, 200)
    assert.equal(edit.body.customers.find((c) => c.name === 'Sita').balance, 110)
    assert.equal((await call('PATCH', `/api/transactions/${udhar.id}`, { token: tk, body: { amount: -1 } })).status, 400)

    // doosre malik ki entry nahi chhoo sakte
    const other = (await call('POST', '/api/auth/login', { body: { email: emailB, password: 'secret2' } })).body
    assert.equal((await call('PATCH', `/api/transactions/${udhar.id}`, { token: other.token, body: { amount: 1 } })).status, 404)
    assert.equal((await call('DELETE', `/api/transactions/${udhar.id}`, { token: other.token })).status, 404)

    const del = await call('DELETE', `/api/transactions/${udhar.id}`, { token: tk })
    const after = del.body.customers.find((c) => c.name === 'Sita')
    assert.equal(after.balance, -40)
    assert.equal(after.count, 1)

    const ren = await call('PATCH', `/api/customers/${sita.id}`, { token: tk, body: { name: 'Sita Devi', phone: '9876543210' } })
    assert.equal(ren.status, 200)
    assert.ok(ren.body.customers.find((c) => c.name === 'Sita Devi' && c.phone === '9876543210'))
    assert.equal((await call('PATCH', `/api/customers/${sita.id}`, { token: tk, body: { name: 'Ramu' } })).status, 409)
    assert.equal((await call('PATCH', `/api/customers/${sita.id}`, { token: tk, body: { phone: '123' } })).status, 400)

    const rep = await call('GET', '/api/report?days=7', { token: tk })
    assert.equal(rep.status, 200)
    assert.equal(rep.body.given, 500)
    assert.equal(rep.body.paid, 240)
    assert.equal(rep.body.daily.length, 1)
  })

  await t.test('backup aur restore', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const bk = await call('GET', '/api/backup', { token: owner.token })
    assert.equal(bk.status, 200)
    assert.equal(bk.body.v, 1)
    assert.equal(bk.body.app, 'Bol-khata')
    assert.equal(bk.body.t.length, 3)

    // doosre (khali) account me restore
    const other = (await call('POST', '/api/auth/login', { body: { email: emailB, password: 'secret2' } })).body
    const r1 = await call('POST', '/api/restore', { token: other.token, body: bk.body })
    assert.equal(r1.status, 200)
    assert.equal(r1.body.added, 3)
    assert.equal(r1.body.customers.find((c) => c.name === 'Ramu').balance, 300)
    // Legacy V-Khatabook backups remain restorable for existing users.
    const legacy = { ...bk.body, app: 'V-Khatabook' }
    const legacyRestore = await call('POST', '/api/restore', { token: (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body.token, body: legacy })
    assert.equal(legacyRestore.status, 200)
    // dobara daalne par double nahi hota
    const r2 = await call('POST', '/api/restore', { token: other.token, body: bk.body })
    assert.equal(r2.body.added, 0)
    assert.equal(r2.body.skipped, 3)
    // kharab backup reject
    assert.equal((await call('POST', '/api/restore', { token: other.token, body: { v: 1, c: [['A', '']], t: [[5, 0, 10, '', Date.now()]] } })).status, 400)
    assert.equal((await call('POST', '/api/restore', { token: other.token, body: { hello: 1 } })).status, 400)
  })

  await t.test('offline entry: wahi entry dobara aaye to ek hi baar judti hai', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const at = new Date(Date.now() - 3 * 3600 * 1000).toISOString() // 3 ghante pehle phone par likhi
    const body = { name: 'Offline Sita', amount: 120, type: 'udhar', reason: 'Doodh', at }
    // ek saath teen baar (net toota, app ne dobara bheji) — phir bhi ek hi entry
    const rs = await Promise.all([1, 2, 3].map(() => call('POST', '/api/transactions', { token: owner.token, body })))
    assert.ok(rs.every((r) => r.status === 201))
    const sita = (await call('GET', '/api/customers', { token: owner.token })).body.customers.find((c) => c.name === 'Offline Sita')
    assert.equal(sita.count, 1)
    assert.equal(sita.balance, 120)
    const hist = await call('GET', `/api/customers/${sita.id}/transactions`, { token: owner.token })
    assert.equal(hist.body.transactions[0].at, at) // entry ka asli samay bacha raha
    // dusri alag entry (alag samay) judti hai
    const later = new Date(Date.now() - 1000).toISOString()
    await call('POST', '/api/transactions', { token: owner.token, body: { ...body, at: later } })
    const again = (await call('GET', '/api/customers', { token: owner.token })).body.customers.find((c) => c.name === 'Offline Sita')
    assert.equal(again.count, 2)
    // galat / bahut purani / object wali tareekh nahi chalti, aage ki tareekh aaj par rok di jaati hai
    for (const bad of ['kal', new Date(Date.now() - 400 * 86400000).toISOString(), { $gt: '' }]) {
      const r = await call('POST', '/api/transactions', { token: owner.token, body: { ...body, at: bad } })
      assert.equal(r.status, 400)
    }
    const future = await call('POST', '/api/transactions', { token: owner.token, body: { name: 'Offline Sita', amount: 5, type: 'udhar', at: new Date(Date.now() + 5 * 60000).toISOString() } })
    assert.equal(future.status, 201)
  })

  await t.test('roz ki entry: set/hatao, aur ek din me ek hi baar judti hai', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const first = await call('POST', '/api/transactions', { token: owner.token, body: { name: 'Doodh Ramu', amount: 1, type: 'payment' } })
    const cust = first.body.customers.find((c) => c.name === 'Doodh Ramu')
    assert.equal(cust.daily, null)

    assert.equal((await call('PATCH', `/api/customers/${cust.id}`, { token: owner.token, body: { daily: { amount: -3 } } })).status, 400)
    assert.equal((await call('PATCH', `/api/customers/${cust.id}`, { token: owner.token, body: { daily: { amount: { $gt: 0 } } } })).status, 400)
    const set = await call('PATCH', `/api/customers/${cust.id}`, { token: owner.token, body: { daily: { amount: 120, reason: '2 litre' } } })
    assert.equal(set.status, 200)
    assert.deepEqual(set.body.customers.find((c) => c.id === cust.id).daily, { amount: 120, reason: '2 litre' })

    const day = '2026-10-08'
    const entry = { name: 'Doodh Ramu', amount: 120, type: 'udhar', reason: '2 litre', day }
    // do phone se ek saath dabaya — phir bhi ek hi entry
    await Promise.all([1, 2, 3].map(() => call('POST', '/api/transactions', { token: owner.token, body: entry })))
    let now = (await call('GET', '/api/customers', { token: owner.token })).body.customers.find((c) => c.id === cust.id)
    assert.equal(now.count, 2) // pehli 1 rupaye wali + aaj ki roz wali
    assert.equal(now.given, 120)
    // agle din ki entry judti hai
    await call('POST', '/api/transactions', { token: owner.token, body: { ...entry, day: '2026-10-09' } })
    now = (await call('GET', '/api/customers', { token: owner.token })).body.customers.find((c) => c.id === cust.id)
    assert.equal(now.given, 240)
    assert.equal((await call('POST', '/api/transactions', { token: owner.token, body: { ...entry, day: 'aaj' } })).status, 400)

    const off = await call('PATCH', `/api/customers/${cust.id}`, { token: owner.token, body: { daily: null } })
    assert.equal(off.body.customers.find((c) => c.id === cust.id).daily, null)
  })

  await t.test('UPI ID: dukaandaar rakh sakta hai, galat nahi chalti', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    assert.equal(owner.user.upiId, null)
    assert.equal((await call('PATCH', '/api/auth/me', { body: { upiId: 'a@okaxis' } })).status, 401)
    for (const bad of ['galat', 'a b@upi', 'x@', '<script>@upi', { $gt: '' }]) {
      const r = await call('PATCH', '/api/auth/me', { token: owner.token, body: { upiId: bad } })
      assert.equal(r.status, 400, JSON.stringify(bad))
    }
    const ok = await call('PATCH', '/api/auth/me', { token: owner.token, body: { upiId: ' ramu.shop@okaxis ' } })
    assert.equal(ok.body.user.upiId, 'ramu.shop@okaxis')
    assert.equal((await call('GET', '/api/auth/me', { token: owner.token })).body.user.upiId, 'ramu.shop@okaxis')
    const cleared = await call('PATCH', '/api/auth/me', { token: owner.token, body: { upiId: '' } })
    assert.equal(cleared.body.user.upiId, null)
  })

  await t.test('/pay page: UPI link banata hai, login nahi chahiye, kuch bhi chhupa nahi sakta', async () => {
    const res = await fetch(base + '/pay?pa=ramu.shop%40okaxis&pn=Ramu%20Dairy&am=250&tn=Khata')
    assert.equal(res.status, 200)
    const html = await res.text()
    assert.match(html, /upi:\/\/pay\?pa=ramu\.shop@okaxis&amp;pn=Ramu%20Dairy&amp;am=250&amp;cu=INR&amp;tn=Khata/)
    assert.match(res.headers.get('content-security-policy'), /default-src 'none'/)
    // galat UPI ID / galat rakam
    assert.equal((await fetch(base + '/pay?pa=hello')).status, 400)
    assert.equal((await fetch(base + '/pay')).status, 400)
    const noAmt = await (await fetch(base + '/pay?pa=a%40upi&am=-5')).text()
    assert.doesNotMatch(noAmt, /&amp;am=/)
    // naam me script daalne ki koshish
    const evil = await (await fetch(base + '/pay?pa=a%40upi&pn=' + encodeURIComponent('<script>alert(1)</script>"onmouseover="x'))).text()
    assert.doesNotMatch(evil, /<script>alert/)
    assert.doesNotMatch(evil, /"onmouseover/)
  })


  await t.test('profile photo: valid JPEG upload, invalid type, GET and delete', async () => {
    const login = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })
    assert.equal(login.status, 200)
    // Real 1x1 JPEG fixture.
    const jpeg = "/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDABALDA4MChAODQ4SERATGCgaGBYWGDEjJR0oOjM9PDkzODdASFxOQERXRTc4UG1RV19iZ2hnPk1xeXBkeFxlZ2P/2wBDARESEhgVGC8aGi9jQjhCY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2NjY2P/wAARCAABAAEDASIAAhEBAxEB/8QAHwAAAQUBAQEBAQEAAAAAAAAAAAECAwQFBgcICQoL/8QAtRAAAgEDAwIEAwUFBAQAAAF9AQIDAAQRBRIhMUEGE1FhByJxFDKBkaEII0KxwRVS0fAkM2JyggkKFhcYGRolJicoKSo0NTY3ODk6Q0RFRkdISUpTVFVWV1hZWmNkZWZnaGlqc3R1dnd4eXqDhIWGh4iJipKTlJWWl5iZmqKjpKWmp6ipqrKztLW2t7i5usLDxMXGx8jJytLT1NXW19jZ2uHi4+Tl5ufo6erx8vP09fb3+Pn6/8QAHwEAAwEBAQEBAQEBAQAAAAAAAAECAwQFBgcICQoL/8QAtREAAgECBAQDBAcFBAQAAQJ3AAECAxEEBSExBhJBUQdhcRMiMoEIFEKRobHBCSMzUvAVYnLRChYkNOEl8RcYGRomJygpKjU2Nzg5OkNERUZHSElKU1RVVldYWVpjZGVmZ2hpanN0dXZ3eHl6goOEhYaHiImKkpOUlZaXmJmaoqOkpaanqKmqsrO0tba3uLm6wsPExcbHyMnK0tPU1dbX2Nna4uPk5ebn6Onq8vP09fb3+Pn6/9oADAMBAAIRAxEAPwDKooopHkn/2Q=="
    const saved = await call('PUT', '/api/auth/profile/photo', { token: login.body.token, body: { photoBase64: jpeg } })
    assert.equal(saved.status, 200)
    assert.equal(saved.body.user.hasPhoto, true)
    assert.ok(saved.body.user.photoVersion >= 1)
    const bad = await call('PUT', '/api/auth/profile/photo', { token: login.body.token, body: { photoBase64: Buffer.from('not jpeg').toString('base64') } })
    assert.equal(bad.status, 400)
    const large = await call('PUT', '/api/auth/profile/photo', { token: login.body.token, body: { photoBase64: 'A'.repeat(83000) } })
    assert.equal(large.status, 413)
    const other = await call('POST', '/api/auth/login', { body: { email: emailB, password: 'secret2' } })
    const otherSaved = await call('PUT', '/api/auth/profile/photo', { token: other.body.token, body: { photoBase64: jpeg, userId: login.body.user.id } })
    assert.equal(otherSaved.status, 200)
    assert.equal(otherSaved.body.user.id, other.body.user.id) // userId body cannot target another account
    const got = await fetch(base + `/api/auth/photo/${login.body.user.id}?v=${saved.body.user.photoVersion}`)
    assert.equal(got.status, 200)
    assert.match(got.headers.get('content-type'), /image\/jpeg/)
    const removed = await call('DELETE', '/api/auth/profile/photo', { token: login.body.token })
    assert.equal(removed.status, 200)
    assert.equal(removed.body.user.hasPhoto, false)
  })

  await t.test('profile: naam badalna aur mobile linking OTP', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const renamed = await call('PATCH', '/api/auth/profile/name', { token: owner.token, body: { name: 'Asha Updated' } })
    assert.equal(renamed.status, 200)
    assert.equal(renamed.body.user.name, 'Asha Updated')
    assert.equal((await call('PATCH', '/api/auth/profile/name', { token: owner.token, body: { name: 'x' } })).status, 400)

    const phone = mkPhone(); phones.push(phone)
    const sent = await call('POST', '/api/auth/profile/phone/send', { token: owner.token, body: { phone } })
    assert.equal(sent.status, 200)
    assert.match(sent.body.devOtp, /^\d{6}$/)
    const bad = await call('POST', '/api/auth/profile/phone/verify', { token: owner.token, body: { phone, code: 'abcdef' } })
    assert.equal(bad.status, 400)
    const linked = await call('POST', '/api/auth/profile/phone/verify', { token: owner.token, body: { phone, code: sent.body.devOtp } })
    assert.equal(linked.status, 200)
    assert.equal(linked.body.user.phone, phone)
    // Existing number par signup request SMS/OTP issue nahi karta aur number status reveal nahi karta.
    const duplicateSignupOtp = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Another User', role: 'seller' } })
    assert.equal(duplicateSignupOtp.status, 200)
    assert.equal(duplicateSignupOtp.body.devOtp, null)
  })

  await t.test('password change: old token revoke, wrong old password reject, new login works', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const wrong = await call('PATCH', '/api/auth/profile/password', { token: owner.token, body: { oldPassword: 'not-right', newPassword: 'secret3' } })
    assert.equal(wrong.status, 401)
    const changed = await call('PATCH', '/api/auth/profile/password', { token: owner.token, body: { oldPassword: 'secret1', newPassword: 'secret3' } })
    assert.equal(changed.status, 200)
    assert.equal(changed.body.reauthRequired, true)
    assert.equal((await call('GET', '/api/customers', { token: owner.token })).status, 401)
    assert.equal((await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).status, 401)
    const newLogin = await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret3' } })
    assert.equal(newLogin.status, 200)
  })

  await t.test('mobile-only account delete: OTP required, records removed, old token revoked', async () => {
    const phone = mkPhone(); phones.push(phone)
    const sent = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Delete Test', role: 'seller' } })
    assert.equal(sent.status, 200)
    const signed = await call('POST', '/api/auth/otp/verify', { body: { phone, code: sent.body.devOtp, purpose: 'signup', name: 'Delete Test', role: 'seller' } })
    assert.equal(signed.status, 200)
    const token = signed.body.token
    const entry = await call('POST', '/api/transactions', { token, body: { name: 'Delete Customer', amount: 50, type: 'udhar' } })
    assert.equal(entry.status, 201)
    const customer = entry.body.customers.find((c) => c.name === 'Delete Customer')
    const delOtp = await call('POST', '/api/auth/account/delete/send-otp', { token })
    assert.equal(delOtp.status, 200)
    const wrong = await call('DELETE', '/api/auth/account', { token, body: { otp: '000000' === delOtp.body.devOtp ? '000001' : '000000' } })
    assert.equal(wrong.status, 401)
    const deleted = await call('DELETE', '/api/auth/account', { token, body: { otp: delOtp.body.devOtp } })
    assert.equal(deleted.status, 200)
    assert.equal((await call('GET', '/api/customers', { token })).status, 401)
    assert.equal(await Customer.countDocuments({ _id: customer.id }), 0)
    assert.equal(await Transaction.countDocuments({ c: customer.id }), 0)
    assert.equal(await User.exists({ phone }), null)
  })


  const otpLogin = async (phone) => {
    const sent = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'login' } })
    assert.equal(sent.status, 200)
    return (await call('POST', '/api/auth/otp/verify', { body: { phone, code: sent.body.devOtp, purpose: 'login' } })).body
  }

  await t.test('role: signup bina role ke reject, buyer ko shop APIs band', async () => {
    const noRole = await call('POST', '/api/auth/signup', { body: { name: 'NoRole', email: emailC, password: 'secret1' } })
    assert.equal(noRole.status, 400)
    assert.equal(noRole.body.code, 'bad_role')
    const phone = mkPhone(); phones.push(phone)
    const noRoleOtp = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Buyer One' } })
    assert.equal(noRoleOtp.body.code, 'bad_role')
    const sent = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'signup', name: 'Buyer One', role: 'buyer' } })
    const signed = await call('POST', '/api/auth/otp/verify', { body: { phone, code: sent.body.devOtp, purpose: 'signup' } })
    assert.equal(signed.status, 200)
    assert.equal(signed.body.user.role, 'buyer') // phone signup me bhi role save hona chahiye
    const token = signed.body.token
    assert.equal((await call('GET', '/api/customers', { token })).body.code, 'seller_only')
    assert.equal((await call('GET', '/api/items', { token })).status, 403)
    assert.equal((await call('POST', '/api/transactions', { token, body: { name: 'X', amount: 10, type: 'udhar' } })).status, 403)
    assert.equal((await call('PATCH', '/api/auth/business', { token, body: { businessType: 'kirana' } })).status, 403)
  })

  await t.test('role: purane role-less account ko ek baar role chunna padta hai', async () => {
    const phone = mkPhone(); phones.push(phone)
    await User.create({ name: 'Legacy', phone }) // role nahi
    const login = await otpLogin(phone)
    assert.equal(login.user.role, null)
    assert.equal((await call('PATCH', '/api/auth/role', { token: login.token, body: { role: 'admin' } })).status, 400)
    const chosen = await call('PATCH', '/api/auth/role', { token: login.token, body: { role: 'seller' } })
    assert.equal(chosen.status, 200)
    assert.equal(chosen.body.user.role, 'seller')
    assert.equal((await call('GET', '/api/customers', { token: login.token })).status, 200)
  })

  await t.test('role: ledger wale seller ko buyer nahi banaya ja sakta; business type', async () => {
    const owner = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    await call('POST', '/api/transactions', { token: owner.token, body: { name: 'Role Check', amount: 10, type: 'udhar' } })
    const flip = await call('PATCH', '/api/auth/role', { token: owner.token, body: { role: 'buyer' } })
    assert.equal(flip.status, 409)
    assert.equal(flip.body.code, 'seller_has_ledger')
    assert.equal((await call('PATCH', '/api/auth/business', { token: owner.token, body: { businessType: 'nope' } })).status, 400)
    const ok = await call('PATCH', '/api/auth/business', { token: owner.token, body: { businessType: 'dairy' } })
    assert.equal(ok.status, 200)
    assert.equal(ok.body.user.businessType, 'dairy')
  })

  await t.test('items: seller catalog banao, badlo, validation, dusre seller ko nahi dikhta', async () => {
    const a = (await call('POST', '/api/auth/login', { body: { email: emailA, password: 'secret1' } })).body
    const b = (await call('POST', '/api/auth/login', { body: { email: emailB, password: 'secret2' } })).body
    const made = await call('POST', '/api/items', { token: a.token, body: { name: 'Doodh', unit: 'litre', price: 60 } })
    assert.equal(made.status, 201)
    assert.equal(made.body.item.price, 60)
    assert.equal((await call('POST', '/api/items', { token: a.token, body: { name: 'Doodh', unit: 'litre' } })).status, 409)
    assert.equal((await call('POST', '/api/items', { token: a.token, body: { name: 'X', unit: 'bori' } })).body.code, 'bad_item_unit')
    assert.equal((await call('POST', '/api/items', { token: a.token, body: { name: 'Y', unit: 'kg', price: -1 } })).body.code, 'bad_item_price')
    const upd = await call('PATCH', '/api/items/' + made.body.item.id, { token: a.token, body: { price: 65 } })
    assert.equal(upd.body.item.price, 65)
    assert.equal((await call('GET', '/api/items', { token: a.token })).body.items.some((i) => i.name === 'Doodh'), true)
    assert.equal((await call('GET', '/api/items', { token: b.token })).body.items.some((i) => i.name === 'Doodh'), false)
    assert.equal((await call('PATCH', '/api/items/' + made.body.item.id, { token: b.token, body: { price: 1 } })).status, 404)
  })

  await t.test('forgot password: OTP se naya password, purana session band, OTP ek hi baar', async () => {
    const signed = await call('POST', '/api/auth/signup', { body: { name: 'Forgetful', email: emailC, password: 'oldpass1', role: 'seller' } })
    assert.equal(signed.status, 201)
    // mobile jodo (reset OTP isi number par jaata hai)
    const phone = mkPhone(); phones.push(phone)
    const link = await call('POST', '/api/auth/profile/phone/send', { token: signed.body.token, body: { phone } })
    assert.equal((await call('POST', '/api/auth/profile/phone/verify', { token: signed.body.token, body: { phone, code: link.body.devOtp } })).status, 200)
    // naye account ke liye cooldown na aaye
    await Otp.deleteMany({ phone })

    // jis account me mobile/password nahi, wahan bhi wahi jawab, par OTP nahi
    const ghost = await call('POST', '/api/auth/password/forgot', { body: { identifier: `ghost${run}@test.example` } })
    assert.equal(ghost.status, 200)
    assert.equal(ghost.body.devOtp, null)
    assert.equal((await call('POST', '/api/auth/password/forgot', { body: { identifier: 'junk' } })).status, 400)

    const forgot = await call('POST', '/api/auth/password/forgot', { body: { identifier: emailC } })
    assert.equal(forgot.status, 200)
    assert.match(forgot.body.devOtp, /^\d{6}$/)
    assert.equal(forgot.body.maskedPhone, '******' + phone.slice(-4))
    assert.equal((await call('POST', '/api/auth/password/forgot', { body: { identifier: emailC } })).status, 429) // cooldown

    const wrong = forgot.body.devOtp === '000000' ? '000001' : '000000'
    assert.equal((await call('POST', '/api/auth/password/reset', { body: { identifier: emailC, code: wrong, newPassword: 'newpass1' } })).body.code, 'otp_wrong')
    assert.equal((await call('POST', '/api/auth/password/reset', { body: { identifier: emailC, code: forgot.body.devOtp, newPassword: '123' } })).body.code, 'weak_password')
    const done = await call('POST', '/api/auth/password/reset', { body: { identifier: emailC, code: forgot.body.devOtp, newPassword: 'newpass1' } })
    assert.equal(done.status, 200)
    assert.equal((await call('POST', '/api/auth/password/reset', { body: { identifier: emailC, code: forgot.body.devOtp, newPassword: 'newpass2' } })).status, 400)
    assert.equal((await call('POST', '/api/auth/login', { body: { email: emailC, password: 'oldpass1' } })).status, 401)
    assert.equal((await call('POST', '/api/auth/login', { body: { email: emailC, password: 'newpass1' } })).status, 200)
    assert.equal((await call('GET', '/api/auth/me', { token: signed.body.token })).status, 401)
    // signup/login wale OTP se reset nahi hota
    const loginOtp = await call('POST', '/api/auth/otp/send', { body: { phone, purpose: 'login' } })
    const bad = await call('POST', '/api/auth/password/reset', { body: { identifier: emailC, code: loginOtp.body.devOtp, newPassword: 'hack123' } })
    assert.equal(bad.status, 400)
    assert.equal((await call('POST', '/api/auth/login', { body: { email: emailC, password: 'hack123' } })).status, 401)
  })

  await t.test('kharab JSON par JSON error aata hai', async () => {
    const r = await call('POST', '/api/auth/login', { raw: '{oops' })
    assert.equal(r.status, 400)
    assert.equal(r.body.code, 'bad_request')
  })
})
