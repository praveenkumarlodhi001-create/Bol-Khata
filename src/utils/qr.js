// Chhota QR code banane wala (kisi library / native module ki zaroorat nahi, Expo Go me chalta hai).
// Byte mode, error-correction level M, version 1..10 (213 bytes tak) — UPI link ke liye kaafi.
// makeQr(text) -> { size, get(x, y) } ; get = true matlab kaala box.

const ECC_PER_BLOCK = [10, 16, 26, 18, 24, 16, 18, 22, 22, 26] // version 1..10, level M
const NUM_BLOCKS = [1, 1, 2, 2, 2, 4, 4, 4, 5, 5]

function utf8(text) {
  const out = []
  for (const ch of String(text)) {
    const c = ch.codePointAt(0)
    if (c < 0x80) out.push(c)
    else if (c < 0x800) out.push(0xc0 | (c >> 6), 0x80 | (c & 63))
    else if (c < 0x10000) out.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
    else out.push(0xf0 | (c >> 18), 0x80 | ((c >> 12) & 63), 0x80 | ((c >> 6) & 63), 0x80 | (c & 63))
  }
  return out
}

function alignmentPositions(ver) {
  if (ver === 1) return []
  const n = Math.floor(ver / 7) + 2
  const size = ver * 4 + 17
  const step = ver === 32 ? 26 : Math.ceil((ver * 4 + 4) / (n * 2 - 2)) * 2
  const res = [6]
  for (let pos = size - 7; res.length < n; pos -= step) res.splice(1, 0, pos)
  return res
}

function numRawModules(ver) {
  let r = (16 * ver + 128) * ver + 64
  if (ver >= 2) {
    const n = Math.floor(ver / 7) + 2
    r -= (25 * n - 10) * n - 55
    if (ver >= 7) r -= 36
  }
  return r
}
const numDataCodewords = (ver) => Math.floor(numRawModules(ver) / 8) - ECC_PER_BLOCK[ver - 1] * NUM_BLOCKS[ver - 1]

// Reed-Solomon (GF(256), polynomial 0x11D)
function rsDivisor(degree) {
  const result = new Array(degree).fill(0)
  result[degree - 1] = 1
  let root = 1
  for (let i = 0; i < degree; i++) {
    for (let j = 0; j < degree; j++) {
      result[j] = gfMul(result[j], root)
      if (j + 1 < degree) result[j] ^= result[j + 1]
    }
    root = gfMul(root, 2)
  }
  return result
}
function gfMul(x, y) {
  let z = 0
  for (let i = 7; i >= 0; i--) {
    z = (z << 1) ^ ((z >>> 7) * 0x11d)
    z ^= ((y >>> i) & 1) * x
  }
  return z
}
function rsRemainder(data, divisor) {
  const result = divisor.map(() => 0)
  for (const b of data) {
    const factor = b ^ result.shift()
    result.push(0)
    divisor.forEach((coef, i) => (result[i] ^= gfMul(coef, factor)))
  }
  return result
}

function buildCodewords(bytes, ver) {
  const cap = numDataCodewords(ver)
  const bits = []
  const put = (val, len) => { for (let i = len - 1; i >= 0; i--) bits.push((val >>> i) & 1) }
  put(4, 4) // byte mode
  put(bytes.length, ver < 10 ? 8 : 16)
  bytes.forEach((b) => put(b, 8))
  put(0, Math.min(4, cap * 8 - bits.length))
  while (bits.length % 8) bits.push(0)
  for (let pad = 0xec; bits.length < cap * 8; pad ^= 0xec ^ 0x11) put(pad, 8)
  const data = []
  for (let i = 0; i < bits.length; i += 8) data.push(parseInt(bits.slice(i, i + 8).join(''), 2))

  const nb = NUM_BLOCKS[ver - 1]
  const ecc = ECC_PER_BLOCK[ver - 1]
  const raw = Math.floor(numRawModules(ver) / 8)
  const shortBlocks = nb - (raw % nb)
  const shortLen = Math.floor(raw / nb)
  const div = rsDivisor(ecc)
  const blocks = []
  for (let i = 0, k = 0; i < nb; i++) {
    const len = shortLen - ecc + (i < shortBlocks ? 0 : 1)
    const d = data.slice(k, k + len)
    k += len
    const e = rsRemainder(d, div)
    if (i < shortBlocks) d.push(0) // placeholder (interleave me chhoda jaata hai)
    blocks.push(d.concat(e))
  }
  const out = []
  for (let i = 0; i < blocks[0].length; i++) {
    blocks.forEach((blk, j) => {
      if (i !== shortLen - ecc || j >= shortBlocks) out.push(blk[i])
    })
  }
  return out
}

export function makeQr(text) {
  const bytes = utf8(text)
  let ver = 1
  while (ver <= 10 && 4 + (ver < 10 ? 8 : 16) + bytes.length * 8 > numDataCodewords(ver) * 8) ver++
  if (ver > 10) throw new Error('QR text too long')
  const size = ver * 4 + 17
  const mods = Array.from({ length: size }, () => new Array(size).fill(false))
  const fn = Array.from({ length: size }, () => new Array(size).fill(false))
  const setFn = (x, y, dark) => { mods[y][x] = dark; fn[y][x] = true }

  for (let i = 0; i < size; i++) { setFn(6, i, i % 2 === 0); setFn(i, 6, i % 2 === 0) }
  const finder = (cx, cy) => {
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const d = Math.max(Math.abs(dx), Math.abs(dy)); const x = cx + dx; const y = cy + dy
      if (x >= 0 && x < size && y >= 0 && y < size) setFn(x, y, d !== 2 && d !== 4)
    }
  }
  finder(3, 3); finder(size - 4, 3); finder(3, size - 4)
  const al = alignmentPositions(ver)
  for (let i = 0; i < al.length; i++) for (let j = 0; j < al.length; j++) {
    if ((i === 0 && j === 0) || (i === 0 && j === al.length - 1) || (i === al.length - 1 && j === 0)) continue
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) setFn(al[i] + dx, al[j] + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
  }
  const drawFormat = (mask) => {
    const data = (0 << 3) | mask // level M = 00
    let rem = data
    for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
    const bits = ((data << 10) | rem) ^ 0x5412
    const b = (i) => ((bits >>> i) & 1) !== 0
    for (let i = 0; i <= 5; i++) setFn(8, i, b(i))
    setFn(8, 7, b(6)); setFn(8, 8, b(7)); setFn(7, 8, b(8))
    for (let i = 9; i < 15; i++) setFn(14 - i, 8, b(i))
    for (let i = 0; i < 8; i++) setFn(size - 1 - i, 8, b(i))
    for (let i = 8; i < 15; i++) setFn(8, size - 15 + i, b(i))
    setFn(8, size - 8, true)
  }
  drawFormat(0)
  if (ver >= 7) {
    let rem = ver
    for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
    const bits = (ver << 12) | rem
    for (let i = 0; i < 18; i++) {
      const a = size - 11 + (i % 3); const bb = Math.floor(i / 3)
      const dark = ((bits >>> i) & 1) !== 0
      setFn(a, bb, dark); setFn(bb, a, dark)
    }
  }

  // data bits ko zig-zag me rakhna
  const cw = buildCodewords(bytes, ver)
  let bi = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) for (let j = 0; j < 2; j++) {
      const x = right - j
      const upward = ((right + 1) & 2) === 0
      const y = upward ? size - 1 - vert : vert
      if (!fn[y][x] && bi < cw.length * 8) { mods[y][x] = ((cw[bi >>> 3] >>> (7 - (bi & 7))) & 1) !== 0; bi++ }
    }
  }

  const maskFn = [
    (x, y) => (x + y) % 2 === 0, (x, y) => y % 2 === 0, (x, y) => x % 3 === 0, (x, y) => (x + y) % 3 === 0,
    (x, y) => (Math.floor(x / 3) + Math.floor(y / 2)) % 2 === 0, (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
    (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0, (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
  ]
  const apply = (m) => { for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) if (!fn[y][x] && maskFn[m](x, y)) mods[y][x] = !mods[y][x] }

  const penalty = () => {
    let p = 0
    const line = (get) => {
      for (let a = 0; a < size; a++) {
        let run = 1
        for (let b = 1; b < size; b++) {
          if (get(a, b) === get(a, b - 1)) { run++; if (run === 5) p += 3; else if (run > 5) p++ } else run = 1
        }
        // finder-like pattern 1:1:3:1:1 with 4 light
        for (let b = 0; b + 10 < size + 0; b++) {
          const s = []; for (let k = 0; k < 11; k++) s.push(get(a, b + k) ? 1 : 0)
          const j = s.join('')
          if (j === '10111010000' || j === '00001011101') p += 40
        }
      }
    }
    line((a, b) => mods[a][b]); line((a, b) => mods[b][a])
    for (let y = 0; y < size - 1; y++) for (let x = 0; x < size - 1; x++) { const c = mods[y][x]; if (c === mods[y][x + 1] && c === mods[y + 1][x] && c === mods[y + 1][x + 1]) p += 3 }
    let dark = 0; for (const r of mods) for (const c of r) if (c) dark++
    p += Math.floor(Math.abs(dark * 20 - size * size * 10) / (size * size)) * 10 // approx (spec: k steps of 5%)
    return p
  }
  let best = 0; let bestP = Infinity
  for (let m = 0; m < 8; m++) { apply(m); drawFormat(m); const p = penalty(); if (p < bestP) { bestP = p; best = m } apply(m) }
  apply(best); drawFormat(best)
  return { size, get: (x, y) => mods[y][x] }
}
