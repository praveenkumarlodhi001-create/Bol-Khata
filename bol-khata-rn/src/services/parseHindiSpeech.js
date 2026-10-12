// Bola gaya vaakya se naam, amount aur type (udhar/payment) nikaalta hai.
// Example input: "रामू को 200 रुपये उधार" ya "सीता ने 100 रुपये दिए"
export function parseHindiSpeech(text) {
  const t = text.trim()

  const amountMatch = t.match(/(\d+)/)
  const amount = amountMatch ? parseInt(amountMatch[1], 10) : null

  const paymentWords = ['दिए', 'दिया पैसा', 'जमा', 'भुगतान', 'लिए', 'वापस', 'चुकाया']
  const isPayment = paymentWords.some((w) => t.includes(w))
  const type = isPayment ? 'payment' : 'udhar'

  let name = null
  const m = t.match(/^([^\s]+)\s+(को|ने)/)
  if (m) {
    name = m[1]
  } else {
    const words = t.split(/\s+/)
    name = words[0]
  }

  return { name, amount, type, rawText: text }
}
