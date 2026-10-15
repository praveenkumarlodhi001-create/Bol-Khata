import { useMemo } from 'react'
import { View } from 'react-native'
import { makeQr } from '../utils/qr'

// QR ko View se banata hai (react-native-svg ki zaroorat nahi). Hamesha safed background + kaala code, taaki scan ho.
export default function QrView({ text, size = 220 }) {
  const qr = useMemo(() => { try { return makeQr(text) } catch (e) { return null } }, [text])
  if (!qr) return null
  const quiet = 2
  const total = qr.size + quiet * 2
  const cell = Math.floor(size / total)
  const px = cell * total
  const runs = []
  for (let y = 0; y < qr.size; y++) {
    let x = 0
    while (x < qr.size) {
      if (!qr.get(x, y)) { x++; continue }
      let e = x
      while (e < qr.size && qr.get(e, y)) e++
      runs.push({ key: `${y}-${x}`, left: (x + quiet) * cell, top: (y + quiet) * cell, width: (e - x) * cell })
      x = e
    }
  }
  return (
    <View style={{ width: px, height: px, backgroundColor: '#FFFFFF' }} accessibilityLabel="QR code">
      {runs.map((r) => <View key={r.key} style={{ position: 'absolute', left: r.left, top: r.top, width: r.width, height: cell, backgroundColor: '#000000' }} />)}
    </View>
  )
}
