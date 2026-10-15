import AsyncStorage from '@react-native-async-storage/async-storage'

// PIN lock: PIN phone me hi rehta hai (server par nahi). Salt + hash ke roop me rakhte hain, seedha PIN nahi.
// Fingerprint / face ke liye `expo-local-authentication` chahiye; install na ho to sirf PIN chalta hai.
const key = (uid) => `vk_pin_${uid}`
const failKey = (uid) => `vk_pinfail_${uid}`

function rotr(n, b) { return (n >>> b) | (n << (32 - b)) }
const K = [0x428a2f98,0x71374491,0xb5c0fbcf,0xe9b5dba5,0x3956c25b,0x59f111f1,0x923f82a4,0xab1c5ed5,0xd807aa98,0x12835b01,0x243185be,0x550c7dc3,0x72be5d74,0x80deb1fe,0x9bdc06a7,0xc19bf174,0xe49b69c1,0xefbe4786,0x0fc19dc6,0x240ca1cc,0x2de92c6f,0x4a7484aa,0x5cb0a9dc,0x76f988da,0x983e5152,0xa831c66d,0xb00327c8,0xbf597fc7,0xc6e00bf3,0xd5a79147,0x06ca6351,0x14292967,0x27b70a85,0x2e1b2138,0x4d2c6dfc,0x53380d13,0x650a7354,0x766a0abb,0x81c2c92e,0x92722c85,0xa2bfe8a1,0xa81a664b,0xc24b8b70,0xc76c51a3,0xd192e819,0xd6990624,0xf40e3585,0x106aa070,0x19a4c116,0x1e376c08,0x2748774c,0x34b0bcb5,0x391c0cb3,0x4ed8aa4a,0x5b9cca4f,0x682e6ff3,0x748f82ee,0x78a5636f,0x84c87814,0x8cc70208,0x90befffa,0xa4506ceb,0xbef9a3f7,0xc67178f2]
export function sha256(str) {
  const bytes = []
  for (const ch of unescape(encodeURIComponent(str))) bytes.push(ch.charCodeAt(0))
  const l = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)
  for (let i = 7; i >= 0; i--) bytes.push(i >= 4 ? 0 : (l >>> (i * 8)) & 255)
  let h = [0x6a09e667,0xbb67ae85,0x3c6ef372,0xa54ff53a,0x510e527f,0x9b05688c,0x1f83d9ab,0x5be0cd19]
  for (let o = 0; o < bytes.length; o += 64) {
    const w = new Array(64)
    for (let i = 0; i < 16; i++) w[i] = (bytes[o + i * 4] << 24) | (bytes[o + i * 4 + 1] << 16) | (bytes[o + i * 4 + 2] << 8) | bytes[o + i * 4 + 3]
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i++) {
      const t1 = (hh + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + w[i]) | 0
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0
      hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0
    }
    h = [(h[0] + a) | 0, (h[1] + b) | 0, (h[2] + c) | 0, (h[3] + d) | 0, (h[4] + e) | 0, (h[5] + f) | 0, (h[6] + g) | 0, (h[7] + hh) | 0]
  }
  return h.map((x) => (x >>> 0).toString(16).padStart(8, '0')).join('')
}

const hashPin = (pin, salt) => { let x = pin + ':' + salt; for (let i = 0; i < 2000; i++) x = sha256(x + salt); return x }
const newSalt = () => Math.random().toString(36).slice(2) + Date.now().toString(36)

export async function readLock(uid) {
  try { const raw = await AsyncStorage.getItem(key(uid)); return raw ? JSON.parse(raw) : null } catch (e) { return null }
}
export const isLockOn = async (uid) => !!(await readLock(uid))

export async function setPin(uid, pin, biometric = false) {
  if (!/^\d{4}$/.test(pin)) throw new Error('PIN must be 4 digits.')
  const salt = newSalt()
  await AsyncStorage.setItem(key(uid), JSON.stringify({ salt, hash: hashPin(pin, salt), biometric: !!biometric }))
  await AsyncStorage.removeItem(failKey(uid)).catch(() => {})
}
export async function setBiometricFlag(uid, on) {
  const l = await readLock(uid); if (!l) return
  await AsyncStorage.setItem(key(uid), JSON.stringify({ ...l, biometric: !!on }))
}
export async function removeLock(uid) {
  await AsyncStorage.multiRemove([key(uid), failKey(uid)]).catch(() => {})
}

// -> { ok } ya { ok:false, wait: seconds } (5 galat PIN ke baad rukna padta hai)
export async function checkPin(uid, pin) {
  const l = await readLock(uid)
  if (!l) return { ok: true }
  let f = { n: 0, until: 0 }
  try { f = JSON.parse((await AsyncStorage.getItem(failKey(uid))) || '') || f } catch (e) { /* naya */ }
  const now = Date.now()
  if (f.until > now) return { ok: false, wait: Math.ceil((f.until - now) / 1000) }
  if (hashPin(pin, l.salt) === l.hash) { await AsyncStorage.removeItem(failKey(uid)).catch(() => {}); return { ok: true } }
  f.n += 1
  if (f.n >= 5) { f.until = now + Math.min(30 * 2 ** (Math.floor(f.n / 5) - 1), 900) * 1000 }
  await AsyncStorage.setItem(failKey(uid), JSON.stringify(f)).catch(() => {})
  return { ok: false, wait: f.until > now ? Math.ceil((f.until - now) / 1000) : 0 }
}

function bio() { try { return require('expo-local-authentication') } catch (e) { return null } }
export async function biometricAvailable() {
  const m = bio(); if (!m) return false
  try { return (await m.hasHardwareAsync()) && (await m.isEnrolledAsync()) } catch (e) { return false }
}
export async function biometricUnlock(prompt) {
  const m = bio(); if (!m) return false
  try { const r = await m.authenticateAsync({ promptMessage: prompt, cancelLabel: 'PIN', disableDeviceFallback: true }); return !!r.success } catch (e) { return false }
}
