import AsyncStorage from '@react-native-async-storage/async-storage'
import { apiRequest, ApiError } from './api'
import { getToken, getCurrentUserId } from './authService'

// Ledger server (MongoDB) par rehta hai, lekin ENTRY JODNA internet par nirbhar nahi hai:
//   1. entry pehle phone me "outbox" me save hoti hai (turant, net ho ya na ho)
//   2. phir server ko bheji jaati hai; net/server na mile to outbox me rukti hai aur baad me apne aap jaati hai
//   3. har entry par uska asli samay (`at`) jaata hai, aur server wahi entry dobara aane par ek hi baar jodta hai
//      — isliye net beech me toote ya app dobara bheje, entry double nahi hoti.
// Entry badalna / hatana / grahak badalna abhi internet maangta hai.

const WRITE_TIMEOUT_MS = 60000 // Render free server soye hue se uthne me ~1 minute le sakta hai

const qKey = (uid) => `vk_outbox_${uid}`
const cKey = (uid) => `vk_cache_${uid}`
const dKey = (uid) => `vk_daily_${uid}`
const EMPTY = { customers: [], summary: null }

function requireUid() {
  const uid = getCurrentUserId()
  if (!uid) throw new Error('Login is required.')
  return uid
}

async function call(path, opts = {}) {
  const token = await getToken()
  return apiRequest(path, { ...opts, token })
}

// ---------- phone ka storage ----------
// Kharab data ko chupchaap khali karke upar se likhne ki jagah error dete hain, taaki entries kho na jaayein.
async function readJson(key, fallback) {
  const raw = await AsyncStorage.getItem(key)
  if (!raw) return fallback
  return JSON.parse(raw)
}
const readQueue = async (uid) => {
  const q = await readJson(qKey(uid), [])
  if (!Array.isArray(q)) throw new Error('Local entry queue is invalid.')
  return q
}
const writeQueue = (uid, q) => AsyncStorage.setItem(qKey(uid), JSON.stringify(q))
const readCache = (uid) => readJson(cKey(uid), null).catch(() => null)
const writeCache = (uid, base) =>
  AsyncStorage.setItem(cKey(uid), JSON.stringify({ customers: base.customers, summary: base.summary })).catch(() => {})

// Outbox ko ek ke baad ek badalte hain, warna do entries jaldi-jaldi aayein to ek doosri ko mita sakti hai.
let chain = Promise.resolve()
function locked(task) {
  const run = chain.then(task, task)
  chain = run.catch(() => {})
  return run
}

const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100
const newId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 10)

// Din ki tareekh phone ke samay se: "2026-10-08"
export function todayKey(d = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

// Server jaise hi check (taaki galat entry outbox me jaakar atke nahi)
function validateEntry(name, amount, type, reason, phone) {
  const n = typeof name === 'string' ? name.trim() : ''
  const amt = round2(amount)
  const r = typeof reason === 'string' ? reason.trim() : ''
  const ph = typeof phone === 'string' ? phone.trim() : ''
  if (!n || n.length > 60) throw new Error('Enter a valid customer name.')
  if (!Number.isFinite(amt) || amt <= 0 || amt > 10000000) throw new Error('Enter a valid amount.')
  if (type !== 'udhar' && type !== 'payment') throw new Error('Entry type is invalid.')
  if (r.length > 60) throw new Error('Keep the reason under 60 characters.')
  if (ph && !/^[6-9]\d{9}$/.test(ph)) throw new Error('Enter a valid customer mobile number.')
  return { name: n, amount: amt, type, reason: r, phone: ph }
}

// ---------- bheji na gayi entries ko list me jodna ----------
// base = server ki list (ya phone me rakhi aakhri list); queue = abhi tak na bheji entries
export function applyPending(base, queue) {
  const list = (base.customers || []).map((c) => ({ ...c }))
  const byName = new Map(list.map((c) => [c.name, c]))
  let pending = 0
  for (const it of queue) {
    if (it.error) continue
    pending++
    let c = byName.get(it.name)
    if (!c) {
      c = {
        id: `local:${it.name}`,
        name: it.name,
        phone: it.phone || null,
        inviteCode: null,
        linked: false,
        daily: null,
        createdAt: it.at,
        given: 0,
        paid: 0,
        balance: 0,
        count: 0,
        lastAt: null,
        localOnly: true
      }
      list.push(c)
      byName.set(it.name, c)
    }
    if (it.type === 'udhar') c.given = round2(c.given + it.amount)
    else c.paid = round2(c.paid + it.amount)
    c.balance = round2(c.given - c.paid)
    c.count += 1
    if (!c.lastAt || it.at > c.lastAt) c.lastAt = it.at
    c.pending = (c.pending || 0) + 1
  }
  list.sort((a, b) => (b.lastAt || b.createdAt || '').localeCompare(a.lastAt || a.createdAt || ''))
  const summary = {
    customers: list.length,
    given: round2(list.reduce((s, c) => s + c.given, 0)),
    paid: round2(list.reduce((s, c) => s + c.paid, 0)),
    owed: round2(list.reduce((s, c) => s + (c.balance > 0 ? c.balance : 0), 0)),
    owingCount: list.filter((c) => c.balance > 0).length
  }
  return {
    ...base,
    customers: list,
    summary,
    pending,
    failed: queue.filter((i) => i.error).map((i) => ({ k: i.k, name: i.name, amount: i.amount, error: i.error }))
  }
}

// base ko queue ke saath milakar screen ke liye data banata hai
async function finalize(uid, base, { offline = false, fromServer = true } = {}) {
  if (fromServer) await writeCache(uid, base)
  const queue = await locked(() => readQueue(uid))
  return { ...applyPending(base, queue), offline }
}

// ---------- server ko bhejna ----------
let flushing = null
export function flushOutbox() {
  if (!flushing) flushing = doFlush().finally(() => (flushing = null))
  return flushing
}

const isRetryable = (e) =>
  !(e instanceof ApiError) || e.network || e.status === 401 || e.status === 408 || e.status === 429 || e.status >= 500

async function doFlush() {
  const uid = getCurrentUserId()
  if (!uid) return { overview: null, stalled: false }
  let overview = null
  for (;;) {
    const item = (await locked(() => readQueue(uid))).find((i) => !i.error)
    if (!item) return { overview, stalled: false }
    try {
      overview = await call('/api/transactions', {
        method: 'POST',
        timeoutMs: WRITE_TIMEOUT_MS,
        body: {
          name: item.name,
          amount: item.amount,
          type: item.type,
          reason: item.reason,
          phone: item.phone,
          at: item.at,
          ...(item.day ? { day: item.day } : {})
        }
      })
      await locked(async () => writeQueue(uid, (await readQueue(uid)).filter((i) => i.k !== item.k)))
    } catch (e) {
      if (isRetryable(e)) return { overview, stalled: true } // net / server nahi mila — baad me phir
      // Server ne is entry ko pakka mana kar diya — baaki entries ko mat roko, ise "nahi gayi" me daalo
      await locked(async () =>
        writeQueue(
          uid,
          (await readQueue(uid)).map((i) => (i.k === item.k ? { ...i, error: e.message || 'Server ne entry nahi li' } : i))
        )
      )
    }
  }
}

// Outbox bhejo, phir taaza list lo. Net na ho to phone me rakhi aakhri list + na gayi entries dikhti hain.
async function getCustomers() {
  const uid = requireUid()
  const { overview, stalled } = await flushOutbox()
  let base = overview
  let offline = stalled
  let fromServer = true
  if (!base) {
    try {
      base = await call('/api/customers')
    } catch (e) {
      if (!(e instanceof ApiError && e.network)) throw e
      base = (await readCache(uid)) || EMPTY
      offline = true
      fromServer = false
    }
  }
  return finalize(uid, base, { offline, fromServer })
}

// Ek hi samay par ek hi sync chalta hai; beech me koi naya kaam aaye to ek baar aur chalta hai.
let syncing = null
let again = false
export function syncNow() {
  if (syncing) {
    again = true
    return syncing
  }
  syncing = (async () => {
    let out
    do {
      again = false
      out = await getCustomers()
    } while (again)
    return out
  })().finally(() => (syncing = null))
  return syncing
}

// Phone me jo list abhi hai (bina internet ke) — app khulte hi turant dikhane ke liye
export async function getLocalView() {
  const uid = requireUid()
  return finalize(uid, (await readCache(uid)) || EMPTY, { offline: false, fromServer: false })
}

// ===== Malik (dukaan) =====
// Entry turant phone me save hoti hai aur uska hisaab dikh jaata hai; server ko bhejna `syncNow()` karta hai.
export async function addTransaction(name, amount, type, reason = '', phone = '') {
  const uid = requireUid()
  const v = validateEntry(name, amount, type, reason, phone)
  const item = { k: newId(), ...v, at: new Date().toISOString() }
  await locked(async () => writeQueue(uid, [...(await readQueue(uid)), item]))
  return getLocalView()
}

// "Roz ki entry": customers = [{ id, name, daily: { amount, reason } }]. Aaj ki entry ek grahak ki ek hi baar judti hai
// (phone par bhi aur server par bhi), isliye dobara dabane se double nahi hoti.
export async function addDailyEntries(customers) {
  const uid = requireUid()
  const day = todayKey()
  const at = new Date().toISOString()
  await locked(async () => {
    const queue = await readQueue(uid)
    const have = new Set(queue.map((i) => i.k))
    for (const c of customers) {
      const k = `daily-${c.id}-${day}`
      if (have.has(k) || !c.daily) continue
      const v = validateEntry(c.name, c.daily.amount, 'udhar', c.daily.reason, '')
      queue.push({ k, ...v, at, day })
    }
    await writeQueue(uid, queue)
    await AsyncStorage.setItem(dKey(uid), day)
  })
  return getLocalView()
}

// Is phone par roz ki entry aakhri baar kis din lagayi gayi thi ("2026-10-08" ya null)
export async function getDailyDoneDay() {
  return AsyncStorage.getItem(dKey(requireUid()))
}

// Jo entries server ne mana kar di, unhe hatao
export async function discardFailed() {
  const uid = requireUid()
  await locked(async () => writeQueue(uid, (await readQueue(uid)).filter((i) => !i.error)))
  return getLocalView()
}

// Server se aaya naya {customers, summary} + na bheji entries milakar
async function viaServer(path, opts) {
  const uid = requireUid()
  const r = await call(path, opts)
  return { ...r, ...(await finalize(uid, r)) }
}

// name = grahak ka naam (phone me rukti entries ko history ke upar dikhane ke liye)
export async function getHistory(customerId, name) {
  const uid = requireUid()
  const rows = (await call(`/api/customers/${customerId}/transactions`)).transactions
  const queue = await locked(() => readQueue(uid))
  const waiting = queue
    .filter((i) => !i.error && i.name === name)
    .map((i) => ({ id: 'p:' + i.k, type: i.type, amount: i.amount, reason: i.reason, at: i.at, pending: true }))
    .reverse()
  return [...waiting, ...rows]
}

export const deleteCustomer = (customerId) => viaServer(`/api/customers/${customerId}`, { method: 'DELETE' })

// ===== Grahak (jiska khata kisi dukaan me hai) =====
export const getMyAccounts = () => call('/api/my-accounts')

export const getMyHistory = (accountId) =>
  call(`/api/my-accounts/${accountId}/transactions`).then((r) => r.transactions)

export const linkByCode = (code) => call('/api/link', { method: 'POST', body: { code } })

// ===== Entry / grahak badalna, report, backup =====
// patch = { amount?, reason?, type? }  -> naya { customers, summary }
export const editTransaction = (id, patch) => viaServer(`/api/transactions/${id}`, { method: 'PATCH', body: patch })
export const deleteTransaction = (id) => viaServer(`/api/transactions/${id}`, { method: 'DELETE' })

// patch = { name?, phone?, daily? }  (phone '' = hata do; daily = { amount, reason } ya null = roz ki entry band)
export const editCustomer = (customerId, patch) => viaServer(`/api/customers/${customerId}`, { method: 'PATCH', body: patch })

// pichhle N din (1 = aaj) -> { given, paid, count, daily: [{ day, given, paid, count }] }
export const getReport = (days) => call(`/api/report?days=${days}`)

export const getBackup = () => call('/api/backup')
// -> { added, skipped, customers, summary }
export const restoreBackup = (backup) => viaServer('/api/restore', { method: 'POST', body: backup })
