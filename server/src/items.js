// Itemized entry (kitna doodh, kya rate): ek entry me <=20 lines. Total hamesha server nikaalta hai.
const MAX_LINES = 20
const UNITS = ['kg', 'litre', 'piece', 'packet']
const round2 = (n) => Math.round(n * 100) / 100
const round3 = (n) => Math.round(n * 1000) / 1000

// raw = [{ name, qty, rate, unit }]  ->  { items:[{n,q,p,u}], total } ya { error }
function parseLines(raw) {
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_LINES) return { error: 'bad_items' }
  const items = []
  let total = 0
  for (const x of raw) {
    if (!x || typeof x !== 'object') return { error: 'bad_items' }
    const n = typeof x.name === 'string' ? x.name.trim() : ''
    const q = x.qty
    const p = x.rate
    const u = x.unit === undefined || x.unit === null || x.unit === '' ? undefined : x.unit
    if (!n || n.length > 40) return { error: 'bad_items' }
    if (typeof q !== 'number' || !Number.isFinite(q) || q <= 0 || q > 100000) return { error: 'bad_items' }
    if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 10000000) return { error: 'bad_items' }
    if (u !== undefined && !UNITS.includes(u)) return { error: 'bad_items' }
    const line = round2(round3(q) * p)
    total = round2(total + line)
    items.push({ n, q: round3(q), p: round2(p), ...(u ? { u } : {}) })
  }
  return { items, total }
}

const lineAmount = (it) => round2(it.q * it.p)
const toRow = (it) => ({ name: it.n, qty: it.q, rate: it.p, unit: it.u || null, amount: lineAmount(it) })

module.exports = { parseLines, toRow, lineAmount, MAX_LINES, UNITS }
