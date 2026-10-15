import { fmt, fmtDate } from './format'
import { shareText } from './messages'
import { statementText } from './messages'

const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

export function statementHtml(shopName, customer, rows, rangeLabel) {
  const ordered = [...rows].reverse()
  let given = 0; let paid = 0
  const body = ordered.map((t) => {
    const u = t.type === 'udhar'
    if (u) given += t.amount; else paid += t.amount
    const items = t.items && t.items.length ? '<div class="it">' + t.items.map((x) => `${esc(x.name)} — ${x.qty}${x.unit ? ' ' + esc(x.unit) : ''} × ${fmt(x.rate)} = ${fmt(x.amount)}`).join('<br/>') + '</div>' : ''
    return `<tr><td>${esc(fmtDate(t.at))}</td><td>${esc(t.reason || (u ? 'उधार / Credit' : 'जमा / Payment'))}${items}</td><td class="r ${u ? 'd' : 'c'}">${u ? '+' : '−'}${fmt(t.amount)}</td></tr>`
  }).join('')
  const bal = customer.balance > 0 ? `कुल बकाया / Balance due: ${fmt(customer.balance)}` : customer.balance < 0 ? `ज़्यादा दिया / Advance: ${fmt(customer.balance)}` : 'हिसाब बराबर / Settled'
  return `<html><head><meta charset="utf-8"/><meta name="viewport" content="width=device-width, initial-scale=1.0"/><style>
body{font-family:sans-serif;padding:24px;color:#1E2A25}h1{margin:0;font-size:22px;color:#1F4D41}h2{margin:4px 0 16px;font-size:16px;font-weight:600}
table{width:100%;border-collapse:collapse;font-size:13px}td,th{border-bottom:1px solid #ddd;padding:8px 6px;text-align:left;vertical-align:top}th{background:#E3F1EC}
.r{text-align:right;white-space:nowrap}.d{color:#C24A3B}.c{color:#2E6E5E}.it{color:#59675F;font-size:11px;margin-top:3px}.sum{margin-top:16px;font-size:14px;line-height:1.7}
</style></head><body><h1>${esc(shopName || 'Bol-khata')}</h1><h2>${esc(customer.name)} — ${esc(rangeLabel)}</h2>
<table><tr><th>तारीख़</th><th>विवरण</th><th class="r">रकम</th></tr>${body || '<tr><td colspan="3">—</td></tr>'}</table>
<div class="sum">उधार / Credit: ${fmt(given)}<br/>चुकाया / Paid: ${fmt(paid)}<br/><b>${esc(bal)}</b></div></body></html>`
}

// PDF banakar share karta hai. expo-print / expo-sharing na mile to purana text share chalta hai.
export async function sharePdfStatement(shopName, customer, rows, rangeLabel) {
  let Print; let Sharing
  try { Print = require('expo-print'); Sharing = require('expo-sharing') } catch (e) { Print = null }
  if (!Print || !Sharing) return shareText(statementText(shopName, customer, rows, rangeLabel))
  const { uri } = await Print.printToFileAsync({ html: statementHtml(shopName, customer, rows, rangeLabel) })
  if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'application/pdf', dialogTitle: customer.name, UTI: 'com.adobe.pdf' })
  else await shareText(statementText(shopName, customer, rows, rangeLabel))
}
