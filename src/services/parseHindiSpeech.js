/** Convert a spoken ledger instruction into a customer, amount, and transaction type. */
export function parseHindiSpeech(text) {
  const rawText = String(text || '').trim()
  const normalized = rawText.replace(/[₹]/g, ' ').replace(/\s+/g, ' ').trim()
  const amountMatch = normalized.match(/(?:^|\s)(\d[\d,]*(?:\.\d{1,2})?)(?=\s|$)/)
  const amount = amountMatch ? Number.parseFloat(amountMatch[1].replace(/,/g, '')) : null

  const lower = normalized.toLocaleLowerCase('en-IN')
  const paymentWords = ['दिए', 'दिया पैसा', 'जमा', 'भुगतान', 'वापस', 'चुकाया', 'मिले', 'लिए', 'paid', 'payment', 'received', 'collected', 'repaid']
  const isPayment = paymentWords.some((word) => lower.includes(word.toLocaleLowerCase('en-IN')))
  const type = isPayment ? 'payment' : 'udhar'

  let name = ''
  const hindiName = normalized.match(/^(.+?)\s+(?:को|ने)(?=\s|$)/u)
  if (hindiName) {
    name = hindiName[1].trim()
  } else {
    const beforeAmount = amountMatch ? normalized.slice(0, amountMatch.index + (normalized.slice(0, amountMatch.index).match(/\s*$/)?.[0].length || 0)).trim() : ''
    const afterAmount = amountMatch ? normalized.slice(amountMatch.index + amountMatch[0].length).trim() : ''
    const cleanedBefore = beforeAmount
      .replace(/^(?:please\s+)?(?:add|record|enter)\b\s*/i, '')
      .replace(/\b(?:credit|udhar|उधार|payment|paid|received|gave|give|rupees?|rs\.?|रुपये?|रुपया|जमा|दिए|दिया|मिले|भुगतान|चुकाया)\b/giu, '')
      .trim()
    const cleanedAfter = afterAmount
      .replace(/^(?:rupees?|rs\.?|रुपये?|रुपया|का|की|के|उधार|credit|payment|paid|received|जमा|दिए|दिया|मिले|भुगतान|चुकाया|को|ने)+/giu, '')
      .replace(/\b(?:credit|udhar|उधार|payment|paid|received|gave|give|rupees?|rs\.?|रुपये?|रुपया|जमा|दिए|दिया|मिले|भुगतान|चुकाया|please|add|record|entry|for|from|to)\b/giu, '')
      .trim()
    name = cleanedBefore || cleanedAfter || normalized
  }

  name = name
    .replace(/[,:;.!?₹]/g, ' ')
    .replace(/\b(?:rupees?|rs\.?|credit|payment|paid|received|gave|give|please|add|record|entry|for|from|to|udhar)\b/giu, ' ')
    .replace(/(?:रुपये?|रुपया|उधार|जमा|दिए|दिया|मिले|भुगतान|चुकाया|को|ने)/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  // Reject a transcript that contains no usable customer name or amount.
  if (!name || /^\d+(?:[.,]\d+)?$/.test(name)) name = ''
  return { name: name || null, amount: Number.isFinite(amount) && amount > 0 ? amount : null, type, rawText }
}
