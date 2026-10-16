import { View } from 'react-native'

// Font ke bina chalne wale icons — sirf View se bane hain, isliye icon-font load na ho tab bhi hamesha dikhte hain.
// Ionicons ke naam hi chalte hain, to purane code me sirf import badalna padta hai.
//   <Icon name="trash" size={22} color={colors.alert} cut={colors.panel} />
// cut = icon ke peeche ka rang (jahan icon me "khaali jagah" dikhani ho: camera ka lens, warning ka !, wallet ka clasp)

const CUT_DEFAULT = 'rgba(0,0,0,0.38)'

export default function Icon({ name, size = 24, color = '#000', cut: cutProp, style }) {
  const s = size
  const cut = cutProp === undefined ? CUT_DEFAULT : cutProp
  const t = Math.max(1.7, s * 0.09) // line ki motai
  const abs = { position: 'absolute' }

  // line (x1,y1)->(x2,y2), saare numbers 0..1 (icon box ke hisaab se)
  const seg = (k, x1, y1, x2, y2, c = color, w = t) => {
    const X1 = x1 * s, Y1 = y1 * s, X2 = x2 * s, Y2 = y2 * s
    const len = Math.hypot(X2 - X1, Y2 - Y1) + w
    const cx = (X1 + X2) / 2, cy = (Y1 + Y2) / 2
    const ang = (Math.atan2(Y2 - Y1, X2 - X1) * 180) / Math.PI
    return (
      <View key={k} style={{ ...abs, left: cx - len / 2, top: cy - w / 2, width: len, height: w, borderRadius: w / 2, backgroundColor: c, transform: [{ rotate: `${ang}deg` }] }} />
    )
  }
  const box = (k, x, y, w, h, st) => <View key={k} style={{ ...abs, left: x * s, top: y * s, width: w * s, height: h * s, ...st }} />
  const dot = (k, cx, cy, d, c = color) => box(k, cx - d / 2, cy - d / 2, d, d, { borderRadius: (d * s) / 2, backgroundColor: c })
  const ring = (k, x, y, d, c = color, w = t) => box(k, x, y, d, d, { borderRadius: (d * s) / 2, borderWidth: w, borderColor: c })
  // chhota triangle: dir = 'left' | 'right' | 'up' | 'down'
  const tri = (k, cx, cy, size_, dir, c = color) => {
    const a = (size_ * s) / 2, b = size_ * s * 0.62
    const base = { ...abs, width: 0, height: 0, borderStyle: 'solid', borderColor: 'transparent' }
    const left = cx * s - (dir === 'left' ? b : dir === 'right' ? 0 : a)
    const top = cy * s - (dir === 'up' ? b : dir === 'down' ? 0 : a)
    const sides =
      dir === 'right' ? { borderTopWidth: a, borderBottomWidth: a, borderLeftWidth: b, borderLeftColor: c }
      : dir === 'left' ? { borderTopWidth: a, borderBottomWidth: a, borderRightWidth: b, borderRightColor: c }
      : dir === 'up' ? { borderLeftWidth: a, borderRightWidth: a, borderBottomWidth: b, borderBottomColor: c }
      : { borderLeftWidth: a, borderRightWidth: a, borderTopWidth: b, borderTopColor: c }
    return <View key={k} style={{ ...base, left, top, ...sides }} />
  }
  const check = (k, c, sc = 1, ox = 0, oy = 0) => [
    seg(k + 'a', 0.5 + (0.22 - 0.5) * sc + ox, 0.5 + (0.52 - 0.5) * sc + oy, 0.5 + (0.43 - 0.5) * sc + ox, 0.5 + (0.72 - 0.5) * sc + oy, c, t * 1.15),
    seg(k + 'b', 0.5 + (0.43 - 0.5) * sc + ox, 0.5 + (0.72 - 0.5) * sc + oy, 0.5 + (0.8 - 0.5) * sc + ox, 0.5 + (0.3 - 0.5) * sc + oy, c, t * 1.15)
  ]
  const cross = (k, c, r = 0.22, w = t) => [seg(k + 'a', 0.5 - r, 0.5 - r, 0.5 + r, 0.5 + r, c, w), seg(k + 'b', 0.5 + r, 0.5 - r, 0.5 - r, 0.5 + r, c, w)]

  let parts = null
  switch (name) {
    case 'close':
      parts = cross('x', color, 0.3, t * 1.1)
      break
    case 'add':
    case 'plus':
      parts = [seg('h', 0.18, 0.5, 0.82, 0.5, color, t * 1.1), seg('v', 0.5, 0.18, 0.5, 0.82, color, t * 1.1)]
      break
    case 'checkmark':
      parts = check('c', color)
      break
    case 'checkmark-circle':
      parts = [box('bg', 0.03, 0.03, 0.94, 0.94, { borderRadius: s, backgroundColor: color }), ...check('c', cutProp === undefined ? '#FFFFFF' : cutProp, 0.62)]
      break
    case 'add-circle-outline':
      parts = [ring('r', 0.05, 0.05, 0.9), seg('h', 0.3, 0.5, 0.7, 0.5), seg('v', 0.5, 0.3, 0.5, 0.7)]
      break
    case 'close-circle-outline':
      parts = [ring('r', 0.05, 0.05, 0.9), ...cross('x', color, 0.17)]
      break
    case 'alert-circle-outline':
    case 'alert':
      parts = [ring('r', 0.05, 0.05, 0.9), seg('b', 0.5, 0.27, 0.5, 0.56, color, t * 1.1), dot('d', 0.5, 0.72, t * 1.5 / s)]
      break
    case 'info':
      parts = [ring('r', 0.05, 0.05, 0.9), dot('d', 0.5, 0.29, (t * 1.5) / s), seg('b', 0.5, 0.44, 0.5, 0.73, color, t * 1.1)]
      break
    case 'time-outline':
    case 'time':
      parts = [ring('r', 0.05, 0.05, 0.9), seg('a', 0.5, 0.5, 0.5, 0.26), seg('b', 0.5, 0.5, 0.69, 0.6)]
      break
    case 'warning':
      parts = [
        <View key="t" style={{ ...abs, left: 0.03 * s, top: 0.08 * s, width: 0, height: 0, borderStyle: 'solid', borderLeftWidth: 0.47 * s, borderRightWidth: 0.47 * s, borderBottomWidth: 0.8 * s, borderLeftColor: 'transparent', borderRightColor: 'transparent', borderBottomColor: color }} />,
        seg('b', 0.5, 0.42, 0.5, 0.64, cut, t * 1.2),
        dot('d', 0.5, 0.78, (t * 1.5) / s, cut)
      ]
      break
    case 'square-outline':
      parts = [box('b', 0.12, 0.12, 0.76, 0.76, { borderWidth: t, borderColor: color, borderRadius: s * 0.16 })]
      break
    case 'card-outline':
    case 'card':
      parts = [box('b', 0.05, 0.18, 0.9, 0.64, { borderWidth: t, borderColor: color, borderRadius: s * 0.13 }), seg('s', 0.06, 0.4, 0.94, 0.4, color, t * 1.5), seg('n', 0.2, 0.64, 0.4, 0.64, color, t)]
      break
    case 'create-outline':
    case 'create':
      parts = [
        <View key="p" style={{ ...abs, left: 0.5 * s - 0.4 * s, top: 0.46 * s - 0.1 * s, width: 0.8 * s, height: 0.2 * s, flexDirection: 'row', alignItems: 'center', transform: [{ rotate: '-45deg' }] }}>
          <View style={{ width: 0, height: 0, borderStyle: 'solid', borderTopWidth: 0.1 * s, borderBottomWidth: 0.1 * s, borderRightWidth: 0.19 * s, borderTopColor: 'transparent', borderBottomColor: 'transparent', borderRightColor: color }} />
          <View style={{ width: 0.61 * s, height: 0.2 * s, backgroundColor: color, borderTopRightRadius: s * 0.06, borderBottomRightRadius: s * 0.06 }} />
        </View>,
        seg('l', 0.62, 0.88, 0.9, 0.88, color, t)
      ]
      break
    case 'save-outline':
    case 'save':
      parts = [
        box('b', 0.1, 0.1, 0.8, 0.8, { borderWidth: t, borderColor: color, borderRadius: s * 0.12 }),
        box('l', 0.28, 0.1, 0.36, 0.26, { borderWidth: t, borderColor: color, borderTopWidth: 0 }),
        box('f', 0.28, 0.56, 0.44, 0.3, { backgroundColor: color, borderTopLeftRadius: s * 0.05, borderTopRightRadius: s * 0.05 })
      ]
      break
    case 'bar-chart-outline':
    case 'bar-chart':
      parts = [
        box('a', 0.14, 0.52, 0.18, 0.34, { backgroundColor: color, borderRadius: s * 0.05 }),
        box('b', 0.41, 0.2, 0.18, 0.66, { backgroundColor: color, borderRadius: s * 0.05 }),
        box('c', 0.68, 0.38, 0.18, 0.48, { backgroundColor: color, borderRadius: s * 0.05 })
      ]
      break
    case 'repeat':
      parts = [
        seg('a', 0.2, 0.62, 0.2, 0.38), seg('b', 0.2, 0.38, 0.64, 0.38), tri('c', 0.74, 0.38, 0.26, 'right'),
        seg('d', 0.8, 0.38, 0.8, 0.62), seg('e', 0.8, 0.62, 0.36, 0.62), tri('f', 0.26, 0.62, 0.26, 'left')
      ]
      break
    case 'mic':
      parts = [
        box('m', 0.35, 0.06, 0.3, 0.5, { backgroundColor: color, borderRadius: s * 0.15 }),
        box('u', 0.21, 0.3, 0.58, 0.36, { borderWidth: t, borderColor: color, borderTopWidth: 0, borderBottomLeftRadius: s * 0.29, borderBottomRightRadius: s * 0.29 }),
        seg('s', 0.5, 0.66, 0.5, 0.86), seg('b', 0.34, 0.88, 0.66, 0.88)
      ]
      break
    case 'camera':
      parts = [
        box('t', 0.32, 0.16, 0.36, 0.16, { backgroundColor: color, borderRadius: s * 0.05 }),
        box('b', 0.05, 0.26, 0.9, 0.62, { backgroundColor: color, borderRadius: s * 0.13 }),
        ring('l', 0.34, 0.37, 0.32, cut, t * 1.15)
      ]
      break
    case 'image':
      parts = [
        box('b', 0.08, 0.14, 0.84, 0.72, { borderWidth: t, borderColor: color, borderRadius: s * 0.12 }),
        dot('s', 0.34, 0.37, 0.14),
        tri('m', 0.62, 0.64, 0.4, 'up')
      ]
      break
    case 'trash':
    case 'trash-outline':
      parts = [
        seg('l', 0.14, 0.26, 0.86, 0.26, color, t * 1.15),
        box('h', 0.36, 0.12, 0.28, 0.12, { borderWidth: t, borderColor: color, borderBottomWidth: 0, borderTopLeftRadius: s * 0.05, borderTopRightRadius: s * 0.05 }),
        box('b', 0.22, 0.32, 0.56, 0.58, { borderWidth: t, borderColor: color, borderBottomLeftRadius: s * 0.1, borderBottomRightRadius: s * 0.1 }),
        seg('a', 0.4, 0.46, 0.4, 0.74), seg('c', 0.6, 0.46, 0.6, 0.74)
      ]
      break
    case 'logout':
    case 'log-out-outline':
      parts = [
        box('d', 0.1, 0.12, 0.44, 0.76, { borderWidth: t, borderColor: color, borderRightWidth: 0, borderTopLeftRadius: s * 0.08, borderBottomLeftRadius: s * 0.08 }),
        seg('a', 0.36, 0.5, 0.88, 0.5), seg('b', 0.7, 0.32, 0.88, 0.5), seg('c', 0.7, 0.68, 0.88, 0.5)
      ]
      break
    case 'home':
      parts = [
        tri('r', 0.5, 0.5, 0.82, 'up'),
        box('b', 0.14, 0.46, 0.72, 0.46, { backgroundColor: color, borderBottomLeftRadius: s * 0.08, borderBottomRightRadius: s * 0.08 }),
        box('d', 0.4, 0.64, 0.2, 0.28, { backgroundColor: cut, borderTopLeftRadius: s * 0.1, borderTopRightRadius: s * 0.1 })
      ]
      break
    case 'wallet':
      parts = [
        box('b', 0, 0.16, 1, 0.68, { backgroundColor: color, borderRadius: s * 0.16 }),
        seg('l', 0.06, 0.3, 0.94, 0.3, cut, 2),
        box('c', 0.56, 0.42, 0.38, 0.26, { backgroundColor: cut, borderRadius: s * 0.1 }),
        dot('d', 0.67, 0.55, 0.1)
      ]
      break
    case 'person':
      parts = [
        dot('h', 0.5, 0.3, 0.4),
        box('b', 0.09, 0.56, 0.82, 0.4, { backgroundColor: color, borderTopLeftRadius: s * 0.41, borderTopRightRadius: s * 0.41, borderBottomLeftRadius: s * 0.08, borderBottomRightRadius: s * 0.08 })
      ]
      break
    default:
      parts = [dot('f', 0.5, 0.5, 0.35 * s)]
  }
  return (
    <View style={[{ width: s, height: s }, style]} pointerEvents="none" accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {parts}
    </View>
  )
}
