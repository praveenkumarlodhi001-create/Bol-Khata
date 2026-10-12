import { API_URL } from '../config'

const TIMEOUT_MS = 45000

export class ApiError extends Error {
  constructor(message, { status = 0, code = '', network = false } = {}) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.network = network
  }
}

// Backend ko ek call. Server ka Hindi error message ApiError.message me aata hai.
export async function apiRequest(path, { method = 'GET', body, token, timeoutMs = TIMEOUT_MS } = {}) {
  if (!API_URL) {
    throw new ApiError('Server address is not configured. Check SETUP.md.', { network: true })
  }
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  let res
  try {
    res = await fetch(API_URL + path, {
      method,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: 'Bearer ' + token } : {})
      },
      body: body ? JSON.stringify(body) : undefined
    })
  } catch (e) {
    throw new ApiError(
      'Could not connect to the server. Check your internet connection and server status.',
      { network: true }
    )
  } finally {
    clearTimeout(timer)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new ApiError(data.error || 'Something went wrong. Please try again.', {
      status: res.status,
      code: data.code || ''
    })
  }
  return data
}
