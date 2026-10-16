import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Button from './ui/Button'
import { radius } from '../theme/colors'
import { useThemedStyles } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { readNotify, saveNotify, enableNotifications, cancelAll } from '../services/notify'

const HOURS = [19, 20, 21]
// Shaam ka reminder chalu / band + samay chunna
export default function NotifyCard({ onToast, onChanged }) {
  const { styles } = useThemedStyles(makeStyles)
  const { tr } = useT()
  const [s, setS] = useState({ on: false, hour: 20 })
  useEffect(() => { readNotify().then(setS) }, [])
  async function toggle() {
    if (s.on) { const n = { ...s, on: false }; setS(n); await saveNotify(n); await cancelAll(); return }
    if (!(await enableNotifications())) return onToast?.(tr('notifyDenied'), 'err')
    const n = { ...s, on: true }; setS(n); await saveNotify(n); onChanged?.(); onToast?.(tr('notifyOn'))
  }
  async function hour(h) { const n = { ...s, hour: h }; setS(n); await saveNotify(n); if (n.on) onChanged?.() }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{tr('eveningReminder')}</Text>
      <Text style={styles.hint}>{tr('eveningReminderHelp')}</Text>
      {s.on ? <View style={styles.row}>{HOURS.map((h) => <TouchableOpacity key={h} onPress={() => hour(h)} style={[styles.chip, s.hour === h && styles.chipOn]}><Text style={[styles.chipText, s.hour === h && styles.chipTextOn]}>{h - 12}:00 PM</Text></TouchableOpacity>)}</View> : null}
      <Button title={s.on ? tr('turnOff') : tr('turnOn')} variant={s.on ? 'ghost' : 'primary'} onPress={toggle} />
    </View>
  )
}
const makeStyles = (c) => StyleSheet.create({
  card: { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: radius.lg, padding: 16 },
  title: { fontSize: 15, fontWeight: '800', color: c.ink },
  hint: { color: c.inkSoft, fontSize: 12, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  chipOn: { backgroundColor: c.milkLight, borderColor: c.milk },
  chipText: { color: c.ink, fontWeight: '600' },
  chipTextOn: { color: c.milkDark }
})
