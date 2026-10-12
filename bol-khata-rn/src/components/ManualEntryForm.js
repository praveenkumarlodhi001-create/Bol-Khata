import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Input from './ui/Input'
import Button from './ui/Button'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import Icon from './Icon'
import { useT } from '../i18n'

const QUICK_REASONS = ['दूध', 'राशन', 'नकद', 'सब्ज़ी', 'दवाई']

export default function ManualEntryForm({ onAdd }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState('udhar')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)

  async function handleSave() {
    const amt = parseFloat(amount)
    const e = {}
    if (!name.trim()) e.name = tr('invalidName')
    if (isNaN(amt) || amt <= 0) e.amount = tr('invalidAmount')
    if (reason.trim().length > 60) e.reason = tr('invalidReason')
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) e.phone = tr('invalidPhone')
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const ok = await onAdd(name.trim(), amt, type, reason.trim(), phone.trim())
    setLoading(false)
    if (ok) {
      setName('')
      setAmount('')
      setReason('')
      setPhone('')
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.toggle} activeOpacity={0.7}>
        <View style={styles.toggleInner}><Icon name={open ? 'close' : 'create-outline'} size={20} color={colors.milk}/><Text style={styles.toggleText}>{open ? tr('manualToggleOpen') : tr('manualToggleClosed')}</Text></View>
      </TouchableOpacity>

      {open && (
        <View style={[styles.form, shadow]}>
          <Input
            label={tr('customerName')}
            placeholder={tr('nameExample')}
            value={name}
            onChangeText={setName}
            error={errors.name}
          />
          <Input
            label={tr('amountLabel')}
            prefix="₹"
            placeholder="0"
            keyboardType="numeric"
            value={amount}
            onChangeText={setAmount}
            error={errors.amount}
          />
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'udhar' && styles.typeBtnOwe]}
              onPress={() => setType('udhar')}
            >
              <Text style={type === 'udhar' ? styles.typeTextActive : styles.typeText}>{tr('giveCredit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'payment' && styles.typeBtnPaid]}
              onPress={() => setType('payment')}
            >
              <Text style={type === 'payment' ? styles.typeTextActive : styles.typeText}>{tr('receivePayment')}</Text>
            </TouchableOpacity>
          </View>

          <Input
            label={tr('reasonLabel')}
            placeholder={tr('reasonExample')}
            value={reason}
            onChangeText={setReason}
            maxLength={60}
            error={errors.reason}
          />
          <View style={styles.chips}>
            {QUICK_REASONS.map((r) => (
              <TouchableOpacity key={r} style={styles.chip} onPress={() => setReason(r)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label={tr('customerMobile')}
            placeholder={tr('mobileDigits')}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
          />
          <Button title={tr('add')} icon="add" onPress={handleSave} loading={loading} />
        </View>
      )}
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  toggle: { alignItems: 'center', marginBottom: 18, paddingVertical: 4 },
  toggleInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { color: colors.milk, fontSize: 14, fontWeight: '600' },
  form: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 20
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center'
  },
  typeBtnOwe: { backgroundColor: colors.alert, borderColor: colors.alert },
  typeBtnPaid: { backgroundColor: colors.milk, borderColor: colors.milk },
  typeText: { color: colors.ink, fontWeight: '600' },
  typeTextActive: { color: '#fff', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: -4 },
  chip: { backgroundColor: colors.milkLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { color: colors.milk, fontSize: 12, fontWeight: '600' }
})
