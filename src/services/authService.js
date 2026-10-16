import * as SecureStore from 'expo-secure-store'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { photoCacheKey } from './photoCache'
import { apiRequest, ApiError } from './api'

// Login ab hamare apne backend (MongoDB) se hota hai — Firebase nahi.
// Token SecureStore me (phone ki encrypted storage), profile ka chhota cache AsyncStorage me.
const TOKEN_KEY = 'bolkhata_token'
const USER_KEY = 'bolkhata_user'

let currentUser = null
let restorePromise = null
const listeners = new Set()

function emit() {
  listeners.forEach((cb) => cb(currentUser))
}

async function readToken() {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY)
  } catch (e) {
    return null
  }
}

async function startSession({ token, user }) {
  await SecureStore.setItemAsync(TOKEN_KEY, token)
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
  currentUser = user
  emit()
  return user
}

async function readCachedUser() {
  try {
    return JSON.parse((await AsyncStorage.getItem(USER_KEY)) || 'null')
  } catch (e) {
    return null
  }
}

// App khulte hi: purana login mila to turant dashboard, aur peeche se token ki jaanch.
async function restoreSession() {
  const token = await readToken()
  if (!token) return
  const cached = await readCachedUser()

  const verify = async () => {
    try {
      const { user } = await apiRequest('/api/auth/me', { token })
      currentUser = user
      await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
      emit()
    } catch (e) {
      if (e instanceof ApiError && e.status === 401) await logout()
    }
  }

  if (cached) {
    currentUser = cached
    verify() // background me; internet na ho to cached login bana rehta hai
  } else {
    await verify()
  }
}

export function onAuthChange(cb) {
  listeners.add(cb)
  if (!restorePromise) restorePromise = restoreSession().catch(() => {})
  restorePromise.then(() => cb(currentUser))
  return () => listeners.delete(cb)
}

export function authErrorMessage(e) {
  if (e instanceof ApiError && e.message) return e.message
  return 'Something went wrong. Please try again.'
}

export async function signUpWithEmail(name, email, password, role = 'seller') {
  const data = await apiRequest('/api/auth/signup', {
    method: 'POST',
    body: { name: name.trim(), email: email.trim(), password, role }
  })
  return startSession(data)
}

export async function loginWithEmail(email, password) {
  const data = await apiRequest('/api/auth/login', {
    method: 'POST',
    body: { email: email.trim(), password }
  })
  return startSession(data)
}

// phone10: sirf 10 digit. Return: { devOtp? } (devOtp sirf testing server par aata hai)
export async function sendOtp(phone10, purpose = 'login', name = '', role = 'seller') {
  const data = await apiRequest('/api/auth/otp/send', { method: 'POST', body: { phone: phone10, purpose, name, role } })
  return { devOtp: data.devOtp || null }
}

export async function confirmOtp(phone10, code, { purpose = 'login', name = '', role = 'seller' } = {}) {
  const data = await apiRequest('/api/auth/otp/verify', {
    method: 'POST',
    body: { phone: phone10, code, purpose, name, role }
  })
  return startSession(data)
}

export async function logout() {
  try {
    await SecureStore.deleteItemAsync(TOKEN_KEY)
  } catch (e) {
    // kuch nahi — neeche user to hat hi jaayega
  }
  await AsyncStorage.removeItem(USER_KEY).catch(() => {})
  currentUser = null
  emit()
}

// Dukaandaar ki UPI ID (reminder me "yahan se pay karo" link ke liye). Khali string = hata do.
export async function setUpiId(upiId) {
  const token = await readToken()
  const { user } = await apiRequest('/api/auth/me', { method: 'PATCH', body: { upiId }, token })
  currentUser = user
  await AsyncStorage.setItem(USER_KEY, JSON.stringify(user))
  emit()
  return user
}

export function getCurrentUserId() {
  return currentUser ? currentUser.id : null
}

// Ledger ke API calls ke liye login token
export function getToken() {
  return readToken()
}


async function saveUserResponse(path, body, method = 'PATCH') {
  const token = await readToken()
  const data = await apiRequest(path, { method, body, token })
  if (data.user) {
    currentUser = data.user
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    emit()
  }
  return data
}
export async function updateProfileName(name) {
  return (await saveUserResponse('/api/auth/profile/name', { name })).user
}
export async function updatePassword(oldPassword, newPassword) {
  const result = await saveUserResponse('/api/auth/profile/password', { oldPassword, newPassword })
  // Server invalidates all prior sessions after password change, including this device.
  await logout()
  return result
}
export async function sendPhoneOtp(phone) {
  const token = await readToken()
  return apiRequest('/api/auth/profile/phone/send', { method: 'POST', body: { phone }, token })
}
export async function verifyPhoneOtp(phone, code) {
  return (await saveUserResponse('/api/auth/profile/phone/verify', { phone, code }, 'POST')).user
}
export async function sendAccountDeleteOtp() {
  const token = await readToken()
  return apiRequest('/api/auth/account/delete/send-otp', { method: 'POST', token })
}

export async function removeAccount({ password = '', otp = '' } = {}) {
  const token = await readToken()
  const uid = currentUser?.id
  await apiRequest('/api/auth/account', { method: 'DELETE', body: { password, otp }, token })
  // Remove this account's offline queue and cached ledger as well as auth/session data.
  if (uid) {
    await Promise.all([
      AsyncStorage.removeItem(`vk_outbox_${uid}`),
      AsyncStorage.removeItem(`vk_cache_${uid}`),
      AsyncStorage.removeItem(`vk_daily_${uid}`),
      AsyncStorage.removeItem(photoCacheKey(uid))
    ]).catch(() => {})
  }
  await logout()
}


export async function uploadProfilePhoto(photoBase64) {
  const token = await readToken()
  const data = await apiRequest('/api/auth/profile/photo', { method: 'PUT', body: { photoBase64 }, token })
  if (data.user) {
    currentUser = data.user
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    if (currentUser.id) await AsyncStorage.setItem(photoCacheKey(currentUser.id), `data:image/jpeg;base64,${photoBase64}`)
    emit()
  }
  return data.user
}

export async function deleteProfilePhoto() {
  const token = await readToken()
  const data = await apiRequest('/api/auth/profile/photo', { method: 'DELETE', token })
  if (data.user) {
    currentUser = data.user
    await AsyncStorage.setItem(USER_KEY, JSON.stringify(currentUser))
    if (currentUser.id) await AsyncStorage.removeItem(photoCacheKey(currentUser.id))
    emit()
  }
  return data.user
}


// ---------- Forgot password ----------
export async function forgotPassword(identifier) {
  const data = await apiRequest('/api/auth/password/forgot', { method: 'POST', body: { identifier: identifier.trim() } })
  return { devOtp: data.devOtp || null, maskedPhone: data.maskedPhone || null }
}

export async function resetPassword(identifier, code, newPassword) {
  await apiRequest('/api/auth/password/reset', { method: 'POST', body: { identifier: identifier.trim(), code, newPassword } })
}

// ---------- Account type (seller / buyer) ----------
export async function setRole(role) {
  return (await saveUserResponse('/api/auth/role', { role })).user
}

// Seller ka business type (kirana, dairy …)
export async function setBusinessType(businessType) {
  return (await saveUserResponse('/api/auth/business', { businessType }, 'PATCH')).user
}
