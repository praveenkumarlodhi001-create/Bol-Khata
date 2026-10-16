import Constants from 'expo-constants'

const extra = Constants.expoConfig?.extra || {}
const API_PORT = 4000

// Expo Go me test karte waqt laptop ka address Expo khud jaanta hai (QR wala wahi address).
// Isliye app.json me IP likhna zaroori nahi — server usi laptop par port 4000 par chale to
// app use apne aap dhoondh leti hai. (Tunnel mode me ye kaam nahi karta; tab apiUrl likho.)
function guessDevUrl() {
  const hostUri = Constants.expoConfig?.hostUri || Constants.expoGoConfig?.debuggerHost || ''
  const host = hostUri.split(':')[0]
  if (!host || /exp\.direct|ngrok|\.expo\.dev/i.test(host)) return ''
  return `http://${host}:${API_PORT}`
}

// app.json -> expo.extra.apiUrl : deploy kiye hue backend ka URL (khali chhodo to dev me auto-detect)
const configured = String(extra.apiUrl || '').trim().replace(/\/$/, '')
export const API_URL = configured && !/X\.X/i.test(configured) ? configured : guessDevUrl()
