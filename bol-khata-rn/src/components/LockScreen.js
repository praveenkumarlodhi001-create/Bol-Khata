import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { checkPin, biometricUnlock, readLock } from '../services/security'
import { BRAND_NAME } from '../config/brand'

// Poori screen ka PIN lock. Fingerprint chalu ho to khulte hi wahi poochta hai; "PIN bhool gaye" = logout (hisaab server par safe hai).
export default function LockScreen({ uid, name, onUnlock, onForgot }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [pin, setPin] = useState('')
  const [msg, setMsg] = useState('')
  const [canBio, setCanBio] = useState(false)
  const busy = useRef(false)

  async function tryBio() {
    if (await biometricUnlock(tr('unlockPrompt'))) onUnlock()
  }
  useEffect(() => {
    readLock(uid).then((l) => { if (l && l.biometric) { setCanBio(true); tryBio() } })
  }, [uid])

  async function press(d) {
    if (busy.current) return
    const next = (pin + d).slice(0, 4)
    setPin(next); setMsg('')
    if (next.length < 4) return
    busy.current = true
    const r = await checkPin(uid, next)
    busy.current = false
    if (r.ok) return onUnlock()
    setPin('')
    setMsg(r.wait ? tr('pinWait', { sec: r.wait }) : tr('pinWrong'))
  }
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', canBio ? '👆' : '', '0', '⌫']
  return (
    <SafeAreaView style={styles.root}>
      <Text style={styles.brand}>{name || BRAND_NAME}</Text>
      <Text style={styles.sub}>{tr('enterPin')}</Text>
      <View style={styles.dots}>{[0, 1, 2, 3].map((i) => <View key={i} style={[styles.dot, pin.length > i && styles.dotOn]} />)}</View>
      <Text style={styles.msg}>{msg}</Text>
      <View style={styles.pad}>
        {keys.map((k, i) => (
          <TouchableOpacity key={i} disabled={!k} style={styles.key} onPress={() => (k === '⌫' ? setPin((p) => p.slice(0, -1)) : k === '👆' ? tryBio() : press(k))} accessibilityLabel={k}>
            <Text style={styles.keyText}>{k}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <TouchableOpacity onPress={onForgot}><Text style={styles.forgot}>{tr('forgotPin')}</Text></TouchableOpacity>
    </SafeAreaView>
  )
}
const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg, alignItems: 'center', justifyContent: 'center', padding: 24 },
  brand: { fontSize: 24, fontWeight: '800', color: c.milkDark },
  sub: { color: c.inkSoft, marginTop: 6, marginBottom: 22 },
  dots: { flexDirection: 'row', gap: 16, marginBottom: 10 },
  dot: { width: 16, height: 16, borderRadius: 8, borderWidth: 2, borderColor: c.milk },
  dotOn: { backgroundColor: c.milk },
  msg: { color: c.alert, minHeight: 20, marginBottom: 12, fontSize: 13 },
  pad: { flexDirection: 'row', flexWrap: 'wrap', width: 264, justifyContent: 'center' },
  key: { width: 76, height: 64, margin: 6, borderRadius: 16, backgroundColor: c.panel, borderWidth: 1, borderColor: c.line, alignItems: 'center', justifyContent: 'center' },
  keyText: { fontSize: 24, fontWeight: '700', color: c.ink },
  forgot: { color: c.milk, fontWeight: '700', marginTop: 22 }
})
