import AsyncStorage from '@react-native-async-storage/async-storage'

// Shaam ka reminder: "Aaj ₹X udhar gaya, ₹Y baaki hai." Phone par schedule hota hai (server nahi chahiye).
// `expo-notifications` install na ho ya Expo Go me na chale to chupchaap kuch nahi karta.
// Aaj ke aankde sirf tab jaate hain jab app aaj shaam se pehle khuli ho; baaki dino ka generic reminder.
const KEY = 'vk_notify'
const lib = () => { try { return require('expo-notifications') } catch (e) { return null } }

export async function readNotify() {
  try { return JSON.parse((await AsyncStorage.getItem(KEY)) || 'null') || { on: false, hour: 20 } } catch (e) { return { on: false, hour: 20 } }
}
export async function saveNotify(v) { await AsyncStorage.setItem(KEY, JSON.stringify(v)).catch(() => {}) }

export async function enableNotifications() {
  const N = lib(); if (!N) return false
  try {
    let p = await N.getPermissionsAsync()
    if (!p.granted) p = await N.requestPermissionsAsync()
    return !!p.granted
  } catch (e) { return false }
}

export async function cancelAll() { const N = lib(); if (N) try { await N.cancelAllScheduledNotificationsAsync() } catch (e) { /* ignore */ } }

// today = { given }, owed = kul baaki. text = { today(given, owed), generic }
export async function scheduleEvening({ given, owed, text }) {
  const N = lib(); if (!N) return false
  const s = await readNotify()
  if (!s.on) return false
  try {
    await N.cancelAllScheduledNotificationsAsync()
    const now = new Date()
    for (let i = 0; i < 7; i++) {
      const at = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i, s.hour, 0, 0, 0)
      if (at.getTime() <= now.getTime() + 60000) continue
      const body = i === 0 ? text.today(given, owed) : text.generic
      await N.scheduleNotificationAsync({ content: { title: text.title, body }, trigger: { type: 'date', date: at } })
    }
    return true
  } catch (e) { return false }
}
