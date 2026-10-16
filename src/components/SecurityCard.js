import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Input from './ui/Input'
import Button from './ui/Button'
import { radius } from '../theme/colors'
import { useThemedStyles } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { readLock, setPin, removeLock, setBiometricFlag, checkPin, biometricAvailable } from '../services/security'

// PIN / fingerprint lock chalu-band karna (Profile me)
export default function SecurityCard({ onToast, onChange }) {
  const { styles } = useThemedStyles(makeStyles)
  const { tr } = useT()
  const { user } = useAuth()
  const uid = user && user.id
  const [lock, setLock] = useState(null)
  const [bioOk, setBioOk] = useState(false)
  const [mode, setMode] = useState(null) // 'set' | 'off'
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [err, setErr] = useState('')
  const reload = () => readLock(uid).then(setLock)
  useEffect(() => { reload(); biometricAvailable().then(setBioOk) }, [uid])

  async function save() {
    if (!/^\d{4}$/.test(a)) return setErr(tr('pinFourDigits'))
    if (a !== b) return setErr(tr('pinMismatch'))
    await setPin(uid, a, bioOk)
    setMode(null); setA(''); setB(''); setErr(''); await reload(); onChange?.(); onToast?.(tr('pinOn'))
  }
  async function off() {
    const r = await checkPin(uid, a)
    if (!r.ok) return setErr(r.wait ? tr('pinWait', { sec: r.wait }) : tr('pinWrong'))
    await removeLock(uid); setMode(null); setA(''); setErr(''); await reload(); onChange?.(); onToast?.(tr('pinOff'))
  }
  async function toggleBio() { await setBiometricFlag(uid, !lock.biometric); await reload() }

  return (
    <View style={styles.card}>
      <Text style={styles.title}>{tr('appLock')}</Text>
      <Text style={styles.hint}>{tr('appLockHelp')}</Text>
      {lock ? (
        <>
          {bioOk ? <TouchableOpacity onPress={toggleBio} style={styles.row}><Text style={styles.rowText}>{lock.biometric ? '✓ ' : '○ '}{tr('useFingerprint')}</Text></TouchableOpacity> : null}
          {mode === 'off' ? (
            <>
              <Input label={tr('enterPin')} value={a} onChangeText={setA} keyboardType="number-pad" maxLength={4} secureTextEntry error={err} />
              <Button title={tr('turnOffLock')} tone="danger" onPress={off} />
            </>
          ) : <Button title={tr('turnOffLock')} variant="ghost" tone="danger" onPress={() => { setMode('off'); setA(''); setErr('') }} />}
        </>
      ) : mode === 'set' ? (
        <>
          <Input label={tr('newPin')} value={a} onChangeText={setA} keyboardType="number-pad" maxLength={4} secureTextEntry />
          <Input label={tr('confirmPin')} value={b} onChangeText={setB} keyboardType="number-pad" maxLength={4} secureTextEntry error={err} />
          <Button title={tr('saveAction')} icon="checkmark" onPress={save} />
        </>
      ) : <Button title={tr('turnOnLock')} variant="ghost" onPress={() => { setMode('set'); setA(''); setB(''); setErr('') }} />}
    </View>
  )
}
const makeStyles = (c) => StyleSheet.create({
  card: { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: radius.lg, padding: 16 },
  title: { fontSize: 15, fontWeight: '800', color: c.ink },
  hint: { color: c.inkSoft, fontSize: 12, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  row: { paddingVertical: 10 },
  rowText: { color: c.ink, fontWeight: '600', fontSize: 14 }
})
