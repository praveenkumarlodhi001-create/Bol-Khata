const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function fmt(n) {
  return '₹' + Math.abs(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// "7 Oct, 3:45 PM"
export function fmtDate(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  let h = d.getHours()
  const ampm = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${d.getDate()} ${MONTHS[d.getMonth()]}, ${h}:${m} ${ampm}`
}

// "7 Oct"
export function fmtShort(iso) {
  const d = new Date(iso)
  if (isNaN(d.getTime())) return ''
  return `${d.getDate()} ${MONTHS[d.getMonth()]}`
}

// "2026-10-07" (server ke report ka din) -> "7 Oct"
export function fmtDay(ymd) {
  const [, m, d] = String(ymd).split('-').map(Number)
  return m && d ? `${d} ${MONTHS[m - 1]}` : ''
}
