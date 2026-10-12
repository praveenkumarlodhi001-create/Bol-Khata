import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Input from './ui/Input'
import Button from './ui/Button'
import { radius, shadow } from '../theme/colors'
import Icon from './Icon'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'

const VPA_RE = /^[a-zA-Z0-9._-]{2,64}@[a-zA-Z][a-zA-Z0-9]{1,30}$/

// Dukaandaar apni UPI ID daalta hai; WhatsApp reminder me "yahan se pay karo" link isi se banta hai.
export default function UpiCard({ upiId, onSave }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [editing, setEditing] = useState(!upiId)
  const [value, setValue] = useState(upiId || '')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    setValue(upiId || '')
    setEditing(!upiId)
  }, [upiId])

  async function save(next) {
    const v = next.trim()
    if (v && !VPA_RE.test(v)) return setError(tr('upiInvalid'))
    setError('')
    setBusy(true)
    const ok = await onSave(v)
    setBusy(false)
    if (ok) setEditing(!v)
  }

  return (
    <View style={[styles.card, shadow]}>
      <View style={styles.titleRow}><Icon name="card-outline" size={19} color={colors.milk}/><Text style={styles.title}>{tr('myUpi')}</Text></View>
      {!editing ? (
        <>
          <Text style={styles.id}>{upiId}</Text>
          <Text style={styles.hint}>{tr('upiReminder')}</Text>
          <View style={styles.row}>
            <TouchableOpacity onPress={() => setEditing(true)}>
              <View style={styles.linkRow}><Icon name="create-outline" size={16} color={colors.milk}/><Text style={styles.link}>{tr('changeAction')}</Text></View>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => save('')}>
              <Text style={[styles.link, { color: colors.alert }]}>{tr('removeAction')}</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.hint}>
            {tr('upiHelp')}
          </Text>
          <Input
            label="UPI ID"
            placeholder="e.g. name@okaxis"
            value={value}
            onChangeText={setValue}
            autoCapitalize="none"
            autoCorrect={false}
            error={error}
          />
          <Button title={tr('saveAction')} icon="checkmark" onPress={() => save(value)} loading={busy} />
        </>
      )}
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 16, marginTop: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: { fontSize: 16, fontWeight: '800', color: colors.milkDark, marginBottom: 6 },
  id: { fontSize: 15, fontWeight: '700', color: colors.ink },
  hint: { color: colors.inkSoft, fontSize: 12, marginTop: 4, marginBottom: 10, lineHeight: 18 },
  row: { flexDirection: 'row', gap: 22 },
  link: { color: colors.milk, fontWeight: '700', fontSize: 13 }
})
