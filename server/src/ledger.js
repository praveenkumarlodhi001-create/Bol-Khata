const { BRAND_NAME, isSupportedBackupApp } = require('./brand')
const crypto = require('crypto')
const express = require('express')
const mongoose = require('mongoose')
const rateLimit = require('express-rate-limit')
const { User, Customer, Transaction, Item } = require('./models')
const { hasPhotoFlag } = require('./photoFlags')
const { parseLines, toRow } = require('./items')

const PHONE_RE = /^[6-9]\d{9}$/
const CODE_RE = /^[A-HJ-NP-Z2-9]{6}$/
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // 0/O, 1/I jaise confusing akshar nahi
const MAX_AMOUNT = 10000000
const HISTORY_LIMIT = 200
const RESTORE_MAX_CUSTOMERS = 1000
const RESTORE_MAX_TXNS = 20000

const str = (v) => (typeof v === 'string' ? v : '')
const money = (n) => Math.round((Number(n) || 0) * 100) / 100
const fail = (res, status, code, error) => res.status(status).json({ code, error })
const serverError = (res, where, e) => {
  console.error(where + ':', e.message)
  fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
}

// URL se aayi id ko ObjectId tabhi maante hain jab wo sach me 24-hex ho (query injection se bachaav)
const toId = (v) => (typeof v === 'string' && /^[a-f0-9]{24}$/i.test(v) ? new mongoose.Types.ObjectId(v) : null)
const newCode = () => Array.from({ length: 6 }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('')

// Ek hi dukaan-malik ki do entries ek saath aayein (jaise offline entries ka ek saath sync) to check-aur-jodna
// ek ke baad ek chale, taaki duplicate na bane. (Ek server instance ke liye; Render free me ek hi hota hai.)
const locks = new Map()
async function withLock(key, fn) {
  const prev = locks.get(key) || Promise.resolve()
  let release
  const mine = new Promise((r) => (release = r))
  const tail = prev.then(() => mine)
  locks.set(key, tail)
  try {
    await prev
    return await fn()
  } finally {
    release()
    if (locks.get(key) === tail) locks.delete(key)
  }
}

const TYPE = { udhar: 0, payment: 1 }
const TYPE_NAME = ['udhar', 'payment']
const REASON_MAX = 60
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/
const MAX_FUTURE_MS = 10 * 60 * 1000 // phone ki ghadi thodi aage ho to chalega
const IST = 'Asia/Kolkata'
const IST_OFFSET_MS = 330 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000
const MAX_PAST_MS = 365 * DAY_MS

// Ek grahak ka jod (udhar, payment, entries, aakhri entry) transactions se dobara nikaalkar customer me rakhta hai.
async function recompute(customerId) {
  const [r] = await Transaction.aggregate([
    { $match: { c: customerId } },
    {
      $group: {
        _id: null,
        given: { $sum: { $cond: [{ $eq: ['$t', TYPE.udhar] }, '$a', 0] } },
        paid: { $sum: { $cond: [{ $eq: ['$t', TYPE.payment] }, '$a', 0] } },
        count: { $sum: 1 },
        lastAt: { $max: '$d' }
      }
    }
  ])
  await Customer.updateOne(
    { _id: customerId },
    { $set: { given: money(r && r.given), paid: money(r && r.paid), count: (r && r.count) || 0, lastAt: (r && r.lastAt) || null } }
  )
}

function figures(c) {
  const given = money(c && c.given)
  const paid = money(c && c.paid)
  return {
    given,
    paid,
    balance: money(given - paid), // + = grahak ko abhi dena hai, - = usne zyada de diya
    count: (c && c.count) || 0,
    lastAt: c && c.lastAt ? new Date(c.lastAt).toISOString() : null
  }
}

const createdAtOf = (c) => (c && c._id && c._id.getTimestamp ? c._id.getTimestamp().toISOString() : '')

const historyRow = (t) => ({
  id: String(t._id),
  type: TYPE_NAME[t.t],
  amount: money(t.a),
  reason: t.r || '',
  at: new Date(t.d).toISOString(),
  ...(t.i && t.i.length ? { items: t.i.map(toRow) } : {})
})

function sortRecent(a, b) {
  return (b.lastAt || b.createdAt || '').localeCompare(a.lastAt || a.createdAt || '')
}

// Entry badalne/hatane se pehle: entry aur uska grahak (sirf us malik ka) dhoondhta hai
async function ownedTransaction(req) {
  const id = toId(req.params.id)
  if (!id) return null
  const txn = await Transaction.findById(id)
  if (!txn) return null
  const cust = await Customer.findOne({ _id: txn.c, ownerId: toId(req.uid) })
  return cust ? { txn, cust } : null
}

// ---------- Malik ki taraf ----------
async function ownerOverview(ownerId) {
  const customers = await Customer.find({ ownerId }).lean()
  const list = customers
    .map((c) => ({
      id: String(c._id),
      name: c.name,
      phone: c.phone || null,
      inviteCode: c.inviteCode,
      linked: !!c.linkedUserId,
      daily: c.da > 0 ? { amount: c.da, reason: c.dr || '' } : null,
      createdAt: createdAtOf(c),
      ...figures(c)
    }))
    .sort(sortRecent)
  const summary = {
    customers: list.length,
    given: money(list.reduce((s, c) => s + c.given, 0)),
    paid: money(list.reduce((s, c) => s + c.paid, 0)),
    owed: money(list.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)),
    owingCount: list.filter((c) => c.balance > 0).length
  }
  return { customers: list, summary }
}

async function findOrCreateCustomer(ownerId, name, phone) {
  let cust = await Customer.findOne({ ownerId, name })
  if (!cust) {
    for (let i = 0; i < 6 && !cust; i++) {
      try {
        cust = await Customer.create({ ownerId, name, phone: phone || undefined, inviteCode: newCode() })
      } catch (e) {
        if (e && e.code === 11000) {
          // usi naam ka grahak doosri request ne bana diya, ya invite code takra gaya
          cust = await Customer.findOne({ ownerId, name })
          continue
        }
        throw e
      }
    }
    if (!cust) throw new Error('customer nahi ban paya')
  } else if (phone && !cust.phone) {
    cust.phone = phone
    await cust.save()
  }
  return cust
}

// ---------- Grahak ki taraf ----------
// Grahak ke khate: jo mere account se jude hain (invite code) ya jinme mera verified mobile number hai.
function myAccountsFilter(user) {
  const or = [{ linkedUserId: user._id }]
  if (user.phone) or.push({ phone: user.phone })
  return { $or: or, ownerId: { $ne: user._id } }
}

function createLedger(requireAuth) {
  const router = express.Router()
  router.use(requireAuth)

  // Only sellers may create/manage shop ledgers. Enforced on the server, not just in the UI.
  const sellerOnly = async (req, res, next) => {
    try { const user = await User.findById(req.uid).select('role'); if (!user || user.role !== 'seller') return fail(res, 403, 'seller_only', 'यह सुविधा seller account के लिए है।'); next() }
    catch (e) { serverError(res, 'seller permission', e) }
  }

  const linkLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 15,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })

  const restoreLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })

  const me = async (req) => User.findById(req.uid)

  // Seller catalog: scoped by authenticated owner, 200 items maximum.
  router.get('/items', sellerOnly, async (req, res) => {
    try { const items = await Item.find({ ownerId: req.uid, active: true }).sort({ name: 1 }).lean(); res.json({ items: items.map(i => ({ id: String(i._id), name: i.name, unit: i.unit, price: i.price ?? null, active: i.active })) }) }
    catch (e) { serverError(res, 'items list', e) }
  })
  router.post('/items', sellerOnly, async (req, res) => {
    const name = str(req.body && req.body.name).trim(); const unit = str(req.body && req.body.unit)
    const price = req.body && req.body.price
    if (name.length < 1 || name.length > 40) return fail(res, 400, 'bad_item_name', 'Item का नाम 1 से 40 अक्षर का रखें।')
    if (!['kg', 'litre', 'piece', 'packet'].includes(unit)) return fail(res, 400, 'bad_item_unit', 'Unit सही नहीं है।')
    if (price !== undefined && price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_AMOUNT)) return fail(res, 400, 'bad_item_price', 'कीमत सही नहीं है।')
    try {
      const count = await Item.countDocuments({ ownerId: req.uid })
      if (count >= 200) return fail(res, 413, 'item_limit', 'एक दुकान में अधिकतम 200 items रख सकते हैं।')
      const item = await Item.create({ ownerId: req.uid, name, unit, ...(price === undefined || price === null ? {} : { price }), active: true })
      res.status(201).json({ item: { id: String(item._id), name: item.name, unit: item.unit, price: item.price ?? null, active: item.active } })
    } catch (e) { if (e && e.code === 11000) return fail(res, 409, 'item_exists', 'यह item पहले से मौजूद है।'); serverError(res, 'item create', e) }
  })
  // Business type ki taiyaar list se ek saath items jodna (pehle se maujood naam chhod diye jaate hain; hataye hue wapas chalu ho jaate hain)
  router.post('/items/seed', sellerOnly, async (req, res) => {
    const raw = req.body && req.body.items
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 60) return fail(res, 400, 'bad_items', 'Items सही नहीं हैं।')
    const clean = []
    for (const x of raw) {
      const name = x && typeof x.name === 'string' ? x.name.trim() : ''
      const price = x ? x.price : undefined
      if (!name || name.length > 40 || !['kg', 'litre', 'piece', 'packet'].includes(x.unit)) return fail(res, 400, 'bad_items', 'Items सही नहीं हैं।')
      if (price !== undefined && price !== null && (typeof price !== 'number' || !Number.isFinite(price) || price < 0 || price > MAX_AMOUNT)) return fail(res, 400, 'bad_item_price', 'कीमत सही नहीं है।')
      clean.push({ name, unit: x.unit, price })
    }
    try {
      const have = await Item.find({ ownerId: req.uid }).select('name active').lean()
      const byName = new Map(have.map((i) => [i.name, i]))
      const fresh = clean.filter((c) => !byName.has(c.name))
      if (have.length + fresh.length > 200) return fail(res, 413, 'item_limit', 'एक दुकान में अधिकतम 200 items रख सकते हैं।')
      const ownerId = toId(req.uid)
      const seen = new Set()
      const ops = []
      for (const c of clean) {
        if (seen.has(c.name)) continue
        seen.add(c.name)
        const old = byName.get(c.name)
        if (!old) ops.push({ insertOne: { document: { ownerId, name: c.name, unit: c.unit, ...(c.price === undefined || c.price === null ? {} : { price: c.price }), active: true } } })
        else if (!old.active) ops.push({ updateOne: { filter: { ownerId, name: c.name }, update: { $set: { active: true } } } })
      }
      if (ops.length) await Item.bulkWrite(ops, { ordered: false })
      const items = await Item.find({ ownerId: req.uid, active: true }).sort({ name: 1 }).lean()
      res.status(201).json({ items: items.map(i => ({ id: String(i._id), name: i.name, unit: i.unit, price: i.price ?? null, active: i.active })) })
    } catch (e) { serverError(res, 'items seed', e) }
  })
  router.patch('/items/:id', sellerOnly, async (req, res) => {
    const id = toId(req.params.id); if (!id) return fail(res, 404, 'not_found', 'Item नहीं मिला।')
    const update = {}; const body = req.body || {}
    if (body.name !== undefined) { if (typeof body.name !== 'string' || !body.name.trim() || body.name.trim().length > 40) return fail(res, 400, 'bad_item_name', 'Item का नाम 1 से 40 अक्षर का रखें।'); update.name = body.name.trim() }
    if (body.unit !== undefined) { if (!['kg','litre','piece','packet'].includes(body.unit)) return fail(res, 400, 'bad_item_unit', 'Unit सही नहीं है।'); update.unit = body.unit }
    if (body.price !== undefined) { if (body.price !== null && (typeof body.price !== 'number' || !Number.isFinite(body.price) || body.price < 0 || body.price > MAX_AMOUNT)) return fail(res, 400, 'bad_item_price', 'कीमत सही नहीं है।'); update.price = body.price }
    if (body.active !== undefined) { if (typeof body.active !== 'boolean') return fail(res, 400, 'bad_active', 'Active value सही नहीं है।'); update.active = body.active }
    try { const item = await Item.findOneAndUpdate({ _id: id, ownerId: req.uid }, { $set: update }, { new: true, runValidators: true }); if (!item) return fail(res, 404, 'not_found', 'Item नहीं मिला।'); res.json({ item: { id: String(item._id), name: item.name, unit: item.unit, price: item.price ?? null, active: item.active } }) }
    catch (e) { if (e && e.code === 11000) return fail(res, 409, 'item_exists', 'यह item पहले से मौजूद है।'); serverError(res, 'item update', e) }
  })

  // ===== Malik (dukaan) =====
  // Import only explicitly selected device contacts; the app never uploads the full address book automatically.
  router.post('/customers/import', sellerOnly, async (req, res) => {
    const raw = req.body && req.body.contacts
    if (!Array.isArray(raw) || raw.length < 1 || raw.length > 500)
      return fail(res, 400, 'bad_contacts', 'एक बार में 1 से 500 चुने हुए contacts इम्पोर्ट करें।')
    const contacts = []
    for (const item of raw) {
      const name = str(item && item.name).trim()
      const phone = str(item && item.phone).trim()
      if (!name || name.length > 60 || !PHONE_RE.test(phone))
        return fail(res, 400, 'bad_contact', 'किसी contact का नाम या मोबाइल नंबर सही नहीं है।')
      contacts.push({ name, phone })
    }

    const ownerId = toId(req.uid)
    let added = 0
    let skipped = 0
    try {
      await withLock(String(ownerId), async () => {
        for (const contact of contacts) {
          const existing = await Customer.findOne({ ownerId, name: contact.name })
          if (existing) {
            if (!existing.phone) {
              existing.phone = contact.phone
              await existing.save()
            }
            skipped++
            continue
          }
          await findOrCreateCustomer(ownerId, contact.name, contact.phone)
          added++
        }
      })
      res.status(201).json({ added, skipped, ...(await ownerOverview(ownerId)) })
    } catch (e) {
      serverError(res, 'import contacts', e)
    }
  })

  router.get('/customers', sellerOnly, async (req, res) => {
    try {
      res.json(await ownerOverview(toId(req.uid)))
    } catch (e) {
      serverError(res, 'customers', e)
    }
  })

  router.post('/transactions', sellerOnly, async (req, res) => {
    const ownerId = toId(req.uid)
    const name = str(req.body.name).trim()
    const type = req.body.type
    let amount = money(req.body.amount)
    const reason = str(req.body.reason).trim()
    const phone = str(req.body.phone).trim()
    let lines = null
    if (req.body.items !== undefined && req.body.items !== null) {
      if (type !== 'udhar') return fail(res, 400, 'bad_items', 'Items सिर्फ़ उधार की entry में लग सकते हैं।')
      const parsed = parseLines(req.body.items)
      if (parsed.error) return fail(res, 400, 'bad_items', 'Items सही नहीं हैं (1 से 20, नाम / मात्रा / रेट देखें)।')
      lines = parsed.items
      amount = parsed.total // total server nikaalta hai
    }

    if (!name || name.length > 60) return fail(res, 400, 'bad_name', 'ग्राहक का नाम सही नहीं है।')
    if (type !== 'udhar' && type !== 'payment') return fail(res, 400, 'bad_type', 'Type सही नहीं है।')
    if (typeof req.body.amount === 'object' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT)
      return fail(res, 400, 'bad_amount', 'रकम सही नहीं है।')
    if (reason.length > REASON_MAX) return fail(res, 400, 'bad_reason', `वजह ${REASON_MAX} अक्षर से छोटी रखो।`)
    if (phone && !PHONE_RE.test(phone)) return fail(res, 400, 'bad_phone', 'ग्राहक का मोबाइल नंबर सही नहीं है।')

    // `at` = entry phone par kab likhi gayi (offline entry baad me sync hoti hai). Ye bhejne par wahi entry
    // dobara aaye (net toota, app ne dobara bheji) to ek hi baar judti hai.
    // `day` = "roz ki entry" ka din (YYYY-MM-DD): ek grahak ki ek din ki entry ek hi baar judti hai.
    const now = Date.now()
    let when = new Date(now)
    const hasAt = req.body.at !== undefined
    if (hasAt) {
      const t = new Date(str(req.body.at)).getTime()
      if (!Number.isFinite(t) || t > now + MAX_FUTURE_MS || t < now - MAX_PAST_MS)
        return fail(res, 400, 'bad_date', 'Entry की तारीख सही नहीं है।')
      when = new Date(Math.min(t, now))
    }
    const day = req.body.day === undefined ? '' : str(req.body.day)
    if (req.body.day !== undefined && !DAY_RE.test(day)) return fail(res, 400, 'bad_day', 'दिन सही नहीं है।')

    try {
      await withLock(String(ownerId), async () => {
        const cust = await findOrCreateCustomer(ownerId, name, phone)
        const filter = { c: cust._id, t: TYPE[type], a: amount, d: when }
        if (hasAt && (await Transaction.exists(filter))) return
        const doc = { c: cust._id, t: TYPE[type], a: amount, r: reason || undefined, d: when }
        if (lines) doc.i = lines
        if (day) doc.k = `d-${cust._id}-${day}`
        try {
          await Transaction.create(doc)
        } catch (e) {
          if (!(e && e.code === 11000 && day)) throw e // aaj ki roz ki entry pehle hi lag chuki hai
        }
        await recompute(cust._id)
      })
      res.status(201).json(await ownerOverview(ownerId))
    } catch (e) {
      serverError(res, 'transactions', e)
    }
  })

  router.get('/customers/:id/transactions', sellerOnly, async (req, res) => {
    const id = toId(req.params.id)
    if (!id) return fail(res, 404, 'not_found', 'ग्राहक नहीं मिला।')
    try {
      const cust = await Customer.findOne({ _id: id, ownerId: toId(req.uid) }).lean()
      if (!cust) return fail(res, 404, 'not_found', 'ग्राहक नहीं मिला।')
      const txns = await Transaction.find({ c: id }).sort({ d: -1 }).limit(HISTORY_LIMIT).lean()
      res.json({ transactions: txns.map(historyRow) })
    } catch (e) {
      serverError(res, 'history', e)
    }
  })

  router.delete('/customers/:id', sellerOnly, async (req, res) => {
    const id = toId(req.params.id)
    if (!id) return fail(res, 404, 'not_found', 'ग्राहक नहीं मिला।')
    const ownerId = toId(req.uid)
    try {
      const cust = await Customer.findOne({ _id: id, ownerId })
      if (!cust) return fail(res, 404, 'not_found', 'ग्राहक नहीं मिला।')
      await Transaction.deleteMany({ c: id })
      await Customer.deleteOne({ _id: id, ownerId })
      res.json(await ownerOverview(ownerId))
    } catch (e) {
      serverError(res, 'delete customer', e)
    }
  })

  // Ek entry ki rakam / vajah / type badalna
  router.patch('/transactions/:id', sellerOnly, async (req, res) => {
    try {
      const found = await ownedTransaction(req)
      if (!found) return fail(res, 404, 'not_found', 'Entry नहीं मिली।')
      const { txn, cust } = found
      const body = req.body || {}
      if (body.amount !== undefined) {
        const amount = money(body.amount)
        if (typeof body.amount === 'object' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT)
          return fail(res, 400, 'bad_amount', 'रकम सही नहीं है।')
        if (txn.i && txn.i.length && amount !== money(txn.a)) txn.i = undefined // rakam badli to purani item list galat ho jaati
        txn.a = amount
      }
      if (body.reason !== undefined) {
        const reason = str(body.reason).trim()
        if (reason.length > REASON_MAX) return fail(res, 400, 'bad_reason', `वजह ${REASON_MAX} अक्षर से छोटी रखो।`)
        txn.r = reason || undefined
      }
      if (body.type !== undefined) {
        if (body.type !== 'udhar' && body.type !== 'payment') return fail(res, 400, 'bad_type', 'Type सही नहीं है।')
        txn.t = TYPE[body.type]
        if (txn.t === TYPE.payment) txn.i = undefined // items sirf udhar me hote hain
      }
      await txn.save()
      await recompute(cust._id)
      res.json(await ownerOverview(toId(req.uid)))
    } catch (e) {
      serverError(res, 'edit transaction', e)
    }
  })

  router.delete('/transactions/:id', sellerOnly, async (req, res) => {
    try {
      const found = await ownedTransaction(req)
      if (!found) return fail(res, 404, 'not_found', 'Entry नहीं मिली।')
      await Transaction.deleteOne({ _id: found.txn._id })
      await recompute(found.cust._id)
      res.json(await ownerOverview(toId(req.uid)))
    } catch (e) {
      serverError(res, 'delete transaction', e)
    }
  })

  // Grahak ka naam / mobile number badalna (mobile khali bhejo to hat jaata hai)
  router.patch('/customers/:id', sellerOnly, async (req, res) => {
    const id = toId(req.params.id)
    if (!id) return fail(res, 404, 'not_found', 'ग्राहक नहीं मिला।')
    const ownerId = toId(req.uid)
    const body = req.body || {}
    const set = {}
    const unset = {}
    if (body.name !== undefined) {
      const name = str(body.name).trim()
      if (!name || name.length > 60) return fail(res, 400, 'bad_name', 'ग्राहक का नाम सही नहीं है।')
      set.name = name
    }
    if (body.phone !== undefined) {
      const phone = str(body.phone).trim()
      if (phone && !PHONE_RE.test(phone)) return fail(res, 400, 'bad_phone', 'ग्राहक का मोबाइल नंबर सही नहीं है।')
      if (phone) set.phone = phone
      else unset.phone = ''
    }
    if (body.daily !== undefined) {
      if (body.daily === null) {
        unset.da = ''
        unset.dr = ''
      } else {
        const d = body.daily && typeof body.daily === 'object' ? body.daily : {}
        const amount = money(d.amount)
        const reason = str(d.reason).trim()
        if (typeof d.amount === 'object' || !Number.isFinite(amount) || amount <= 0 || amount > MAX_AMOUNT)
          return fail(res, 400, 'bad_amount', 'रकम सही नहीं है।')
        if (reason.length > REASON_MAX) return fail(res, 400, 'bad_reason', `वजह ${REASON_MAX} अक्षर से छोटी रखो।`)
        set.da = amount
        if (reason) set.dr = reason
        else unset.dr = ''
      }
    }
    try {
      const update = {}
      if (Object.keys(set).length) update.$set = set
      if (Object.keys(unset).length) update.$unset = unset
      if (!update.$set && !update.$unset) return fail(res, 400, 'nothing', 'कुछ बदलने को नहीं मिला।')
      const r = await Customer.updateOne({ _id: id, ownerId }, update)
      if (!r.matchedCount) return fail(res, 404, 'not_found', 'ग्राहक नहीं मिला।')
      res.json(await ownerOverview(ownerId))
    } catch (e) {
      if (e && e.code === 11000) return fail(res, 409, 'name_taken', 'इस नाम का ग्राहक पहले से है।')
      serverError(res, 'edit customer', e)
    }
  })

  // Report: pichhle N din (1 = aaj) ka udhar/payment, din ke hisaab se (India time)
  router.get('/report', sellerOnly, async (req, res) => {
    const days = Math.min(366, Math.max(1, parseInt(req.query.days, 10) || 7))
    try {
      const ids = (await Customer.find({ ownerId: toId(req.uid) }).select('_id').lean()).map((c) => c._id)
      const todayStart = Math.floor((Date.now() + IST_OFFSET_MS) / DAY_MS) * DAY_MS - IST_OFFSET_MS
      const since = new Date(todayStart - (days - 1) * DAY_MS)
      const rows = ids.length
        ? await Transaction.aggregate([
            { $match: { c: { $in: ids }, d: { $gte: since } } },
            {
              $group: {
                _id: { $dateToString: { format: '%Y-%m-%d', date: '$d', timezone: IST } },
                given: { $sum: { $cond: [{ $eq: ['$t', TYPE.udhar] }, '$a', 0] } },
                paid: { $sum: { $cond: [{ $eq: ['$t', TYPE.payment] }, '$a', 0] } },
                count: { $sum: 1 }
              }
            },
            { $sort: { _id: 1 } }
          ])
        : []
      const daily = rows.map((r) => ({ day: r._id, given: money(r.given), paid: money(r.paid), count: r.count }))
      res.json({
        days,
        since: since.toISOString(),
        given: money(daily.reduce((s, r) => s + r.given, 0)),
        paid: money(daily.reduce((s, r) => s + r.paid, 0)),
        count: daily.reduce((s, r) => s + r.count, 0),
        daily
      })
    } catch (e) {
      serverError(res, 'report', e)
    }
  })

  // Backup: poora khata ek chhote JSON me (c = grahak [naam, mobile], t = entries [grahak#, type, rakam, vajah, ms])
  router.get('/backup', sellerOnly, async (req, res) => {
    try {
      const customers = await Customer.find({ ownerId: toId(req.uid) }).sort({ _id: 1 }).lean()
      const index = new Map(customers.map((c, i) => [String(c._id), i]))
      const txns = customers.length
        ? await Transaction.find({ c: { $in: customers.map((c) => c._id) } }).sort({ d: 1 }).lean()
        : []
      res.json({
        v: 1,
        app: BRAND_NAME,
        at: new Date().toISOString(),
        c: customers.map((c) => [c.name, c.phone || '']),
        t: txns.map((t) => [index.get(String(t.c)), t.t, money(t.a), t.r || '', new Date(t.d).getTime(), ...(t.i && t.i.length ? [t.i.map((x) => [x.n, x.q, x.p, x.u || ''])] : [])])
      })
    } catch (e) {
      serverError(res, 'backup', e)
    }
  })

  // Restore: backup se khata wapas laana. Jis grahak ki entries pehle se hain, uski entries dobara nahi jodte
  // (taaki backup do baar daalne par double na ho). Naye / khali grahak me entries jud jaati hain.
  router.post('/restore', restoreLimiter, sellerOnly, async (req, res) => {
    const body = req.body || {}
    if (body.v !== 1 || !isSupportedBackupApp(body.app) || !Array.isArray(body.c) || !Array.isArray(body.t))
      return fail(res, 400, 'bad_backup', 'यह Bol-khata की backup file नहीं लगती।')
    if (body.c.length > RESTORE_MAX_CUSTOMERS || body.t.length > RESTORE_MAX_TXNS)
      return fail(res, 413, 'too_big', 'Backup बहुत बड़ी है।')
    const ownerId = toId(req.uid)
    try {
      const customers = []
      for (const row of body.c) {
        const name = Array.isArray(row) ? str(row[0]).trim() : ''
        const phone = Array.isArray(row) ? str(row[1]).trim() : ''
        if (!name || name.length > 60) return fail(res, 400, 'bad_backup', 'Backup में ग्राहक का नाम सही नहीं है।')
        customers.push({ name, phone: PHONE_RE.test(phone) ? phone : '' })
      }
      const now = Date.now() + DAY_MS
      const byCustomer = customers.map(() => [])
      for (const row of body.t) {
        if (!Array.isArray(row)) return fail(res, 400, 'bad_backup', 'Backup की कोई entry सही नहीं है।')
        const [ci, t, a, r, d, rawItems] = row
        const amount = money(a)
        const reason = str(r).trim().slice(0, REASON_MAX)
        if (!Number.isInteger(ci) || ci < 0 || ci >= customers.length || (t !== 0 && t !== 1) ||
            typeof a !== 'number' || !(amount > 0) || amount > MAX_AMOUNT || !Number.isFinite(d) || d < 946684800000 || d > now)
          return fail(res, 400, 'bad_backup', 'Backup की कोई entry सही नहीं है।')
        let lines
        if (rawItems !== undefined) {
          const parsed = t === 0 && Array.isArray(rawItems)
            ? parseLines(rawItems.map((x) => (Array.isArray(x) ? { name: x[0], qty: x[1], rate: x[2], unit: x[3] || undefined } : null)))
            : { error: 'bad' }
          if (parsed.error) return fail(res, 400, 'bad_backup', 'Backup की कोई entry सही नहीं है।')
          lines = parsed.items
        }
        byCustomer[ci].push({ t, a: amount, r: reason || undefined, d: new Date(d), ...(lines ? { i: lines } : {}) })
      }

      let added = 0
      let skipped = 0
      for (let i = 0; i < customers.length; i++) {
        const cust = await findOrCreateCustomer(ownerId, customers[i].name, customers[i].phone)
        if (!byCustomer[i].length) continue
        if (cust.count > 0) {
          skipped += byCustomer[i].length
          continue
        }
        await Transaction.insertMany(byCustomer[i].map((x) => ({ ...x, c: cust._id })), { ordered: false })
        await recompute(cust._id)
        added += byCustomer[i].length
      }
      res.json({ added, skipped, ...(await ownerOverview(ownerId)) })
    } catch (e) {
      serverError(res, 'restore', e)
    }
  })

  // ===== Grahak (jiska khata kisi dukaan me hai) =====
  router.get('/my-accounts', async (req, res) => {
    try {
      const user = await me(req)
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      const customers = await Customer.find(myAccountsFilter(user)).lean()
      const owners = await User.find({ _id: { $in: customers.map((c) => c.ownerId) } }).select('name phone upiId businessType photoVersion hasPhoto').lean()
      const shopById = new Map(owners.map((o) => [String(o._id), { name: o.name || 'दुकान', phone: o.phone || null, upiId: o.upiId || null, businessType: o.businessType || null, photoVersion: Number(o.photoVersion || 0), hasPhoto: hasPhotoFlag(o) }]))
      const accounts = customers
        .map((c) => ({
          id: String(c._id),
          shopName: (shopById.get(String(c.ownerId)) || {}).name || 'दुकान',
          shopOwnerId: String(c.ownerId),
          shopPhone: (shopById.get(String(c.ownerId)) || {}).phone || null,
          shopUpiId: (shopById.get(String(c.ownerId)) || {}).upiId || null,
          shopBusinessType: (shopById.get(String(c.ownerId)) || {}).businessType || null,
          shopHasPhoto: !!(shopById.get(String(c.ownerId)) || {}).hasPhoto,
          shopPhotoVersion: Number((shopById.get(String(c.ownerId)) || {}).photoVersion || 0),
          myName: c.name,
          createdAt: createdAtOf(c),
          ...figures(c)
        }))
        .sort(sortRecent)
      const summary = {
        given: money(accounts.reduce((s, a) => s + a.given, 0)),
        paid: money(accounts.reduce((s, a) => s + a.paid, 0)),
        owed: money(accounts.reduce((s, a) => s + (a.balance > 0 ? a.balance : 0), 0))
      }
      res.json({ accounts, summary })
    } catch (e) {
      serverError(res, 'my-accounts', e)
    }
  })

  router.get('/my-accounts/:id/transactions', async (req, res) => {
    const id = toId(req.params.id)
    if (!id) return fail(res, 404, 'not_found', 'खाता नहीं मिला।')
    try {
      const user = await me(req)
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      const cust = await Customer.findOne({ $and: [{ _id: id }, myAccountsFilter(user)] }).lean()
      if (!cust) return fail(res, 404, 'not_found', 'खाता नहीं मिला।')
      const txns = await Transaction.find({ c: id }).sort({ d: -1 }).limit(HISTORY_LIMIT).lean()
      res.json({ transactions: txns.map(historyRow) })
    } catch (e) {
      serverError(res, 'my history', e)
    }
  })

  // Dukaan-malik se mila 6 akshar ka code daalkar apna khata apne account se jodna
  router.post('/link', linkLimiter, async (req, res) => {
    const code = str(req.body.code).trim().toUpperCase()
    if (!CODE_RE.test(code)) return fail(res, 400, 'bad_code', 'कोड 6 अक्षर का होता है, दोबारा देखो।')
    try {
      const user = await me(req)
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      const cust = await Customer.findOne({ inviteCode: code })
      if (!cust) return fail(res, 404, 'code_not_found', 'ये कोड सही नहीं है।')
      if (String(cust.ownerId) === String(user._id))
        return fail(res, 400, 'own_shop', 'अपनी ही दुकान के ग्राहक से खुद को नहीं जोड़ सकते।')
      if (cust.linkedUserId && String(cust.linkedUserId) === String(user._id)) return res.json({ ok: true })
      const r = await Customer.updateOne(
        { _id: cust._id, linkedUserId: { $exists: false } },
        { $set: { linkedUserId: user._id } }
      )
      if (!r.modifiedCount)
        return fail(res, 409, 'code_used', 'ये कोड पहले से किसी और के account से जुड़ चुका है।')
      res.json({ ok: true })
    } catch (e) {
      serverError(res, 'link', e)
    }
  })

  return router
}

module.exports = { createLedger }
