import { Linking, Platform, Share } from 'react-native'
import { fmt, fmtShort } from './format'
import { API_URL } from '../config'

import { BRAND_NAME } from '../config/brand'
// 10 अंक का mobile -> WhatsApp / SMS ke liye number
const cleanPhone = (p) => String(p || '').replace(/\D/g, '').slice(-10)

// "Yahan se pay karo" link. WhatsApp me `upi://` link aksar clickable nahi hota, `https://` hota hai —
// isliye deploy kiye hue server ka /pay page (https) jaata hai, jo seedha UPI app khol deta hai.
// Testing me (server http://laptop-ip par) seedha upi:// link banta hai.
export function payLink({ upiId, shopName, amount }) {
  if (!upiId) return ''
  const enc = encodeURIComponent
  const am = amount > 0 ? `&am=${Number(amount).toFixed(2)}` : ''
  const pn = shopName ? `&pn=${enc(String(shopName).slice(0, 40))}` : ''
  const tn = `&tn=${enc('Khata')}`
  if (/^https:\/\//i.test(API_URL || '')) return `${API_URL}/pay?pa=${enc(upiId)}${pn}${am}${tn}`
  return `upi://pay?pa=${enc(upiId).replace(/%40/g, '@')}${pn}${am}&cu=INR${tn}`
}

export function reminderText(shopName, customer, upiId) {
  const shop = shopName || 'हमारी दुकान'
  const link = payLink({ upiId, shopName, amount: customer.balance })
  const pay = link ? `\n💳 UPI से अभी भरें: ${link}\n(UPI ID: ${upiId})` : ''
  return (
    `नमस्ते ${customer.name} जी,\n` +
    `${shop} में आपका ${fmt(customer.balance)} बकाया है। कृपया जब सुविधा हो चुका दीजिए।` +
    `${pay}\n` +
    `धन्यवाद 🙏\n— ${BRAND_NAME}`
  )
}

// rows = history ki entries (naye se purane), rangeLabel = "सब" / "आज" / "पिछले 7 दिन" ...
export function statementText(shopName, customer, rows, rangeLabel) {
  const shop = shopName || 'हमारी दुकान'
  const lines = [`📒 ${shop} — ${customer.name} का हिसाब`, `(${rangeLabel})`, '']
  const ordered = [...rows].reverse() // purani entry upar
  let given = 0
  let paid = 0
  for (const t of ordered) {
    const udhar = t.type === 'udhar'
    if (udhar) given += t.amount
    else paid += t.amount
    lines.push(`${fmtShort(t.at)}  ${udhar ? '+' : '−'}${fmt(t.amount)}  ${t.reason || (udhar ? 'उधार' : 'जमा')}`)
  }
  if (!ordered.length) lines.push('इस अवधि में कोई entry नहीं।')
  lines.push('', `उधार: ${fmt(given)}`, `चुकाया: ${fmt(paid)}`)
  lines.push(
    customer.balance > 0
      ? `कुल बकाया: ${fmt(customer.balance)}`
      : customer.balance < 0
        ? `आपने ${fmt(customer.balance)} ज़्यादा दिए हैं`
        : 'हिसाब बराबर ✓'
  )
  if (customer.count > rows.length && rangeLabel === 'सब') lines.push('', `(आख़िरी ${rows.length} entries दिखाई हैं)`)
  return lines.join('\n')
}

// WhatsApp me bhejo; number na ho ya WhatsApp na khule to share sheet khulti hai
export async function sendWhatsApp(phone, text) {
  const p = cleanPhone(phone)
  if (p.length === 10) {
    try {
      await Linking.openURL(`https://wa.me/91${p}?text=${encodeURIComponent(text)}`)
      return
    } catch (e) {
      /* neeche share sheet */
    }
  }
  await Share.share({ message: text })
}

export async function sendSms(phone, text) {
  const p = cleanPhone(phone)
  if (p.length !== 10) return Share.share({ message: text })
  const sep = Platform.OS === 'ios' ? '&' : '?'
  try {
    await Linking.openURL(`sms:${p}${sep}body=${encodeURIComponent(text)}`)
  } catch (e) {
    await Share.share({ message: text })
  }
}

export const shareText = (text) => Share.share({ message: text })
