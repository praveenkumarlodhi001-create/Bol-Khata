import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Input from './ui/Input'
import Button from './ui/Button'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import Icon from './Icon'
import { useT } from '../i18n'
import { fmt } from '../utils/format'
import { getItems, getLastEntries } from '../services/dataService'
import { unitLabel } from '../data/catalog'

const QUICK_REASONS = ['दूध', 'राशन', 'नकद', 'सब्ज़ी', 'दवाई']

export default function ManualEntryForm({ onAdd, customers = [] }) {
  const { colors } = useTheme()
  const { tr, lang } = useT()
  const styles = makeStyles(colors)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState('udhar')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [lines, setLines] = useState([]) // [{ name, unit, qty:'', rate:'' }]
  const [last, setLast] = useState({})

  useEffect(() => {
    if (!open) return
    getItems().then(setCatalog).catch(() => {})
    getLastEntries().then(setLast).catch(() => {})
  }, [open])

  const q = name.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!q) return []
    return customers.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 5)
  }, [customers, q])
  const lastForName = last[name.trim()]
  const itemized = lines.length > 0
  const lineTotal = lines.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0)

  function pickCustomer(c) { setName(c.name); if (c.phone && !phone) setPhone(c.phone) }
  function addLine(it) {
    setType('udhar')
    setLines((ls) => [...ls, { name: it.name, unit: it.unit, qty: '1', rate: it.price != null ? String(it.price) : '' }])
  }
  const setLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  function repeat(entry) {
    setType(entry.type || 'udhar')
    setReason(entry.reason || '')
    if (entry.items && entry.items.length) { setLines(entry.items.map((x) => ({ name: x.name, unit: x.unit, qty: String(x.qty), rate: String(x.rate) }))); setAmount('') }
    else { setLines([]); setAmount(String(entry.amount)) }
  }

  async function handleSave() {
    const amt = itemized ? lineTotal : parseFloat(amount)
    const e = {}
    let items = null
    if (itemized) {
      items = lines.map((l) => ({ name: l.name, unit: l.unit || undefined, qty: parseFloat(l.qty), rate: parseFloat(l.rate) }))
      if (type !== 'udhar') e.items = tr('itemsOnlyCredit')
      else if (items.some((l) => !(l.qty > 0) || !Number.isFinite(l.rate) || l.rate < 0)) e.items = tr('itemLinesInvalid')
    }
    if (!name.trim()) e.name = tr('invalidName')
    if (isNaN(amt) || amt <= 0) e.amount = tr('invalidAmount')
    if (reason.trim().length > 60) e.reason = tr('invalidReason')
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) e.phone = tr('invalidPhone')
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const autoReason = !reason.trim() && itemized ? lines.map((l) => l.name).join(', ').slice(0, 60) : reason.trim()
    const ok = await onAdd(name.trim(), amt, type, autoReason, phone.trim(), items)
    setLoading(false)
    if (ok) {
      setName('')
      setAmount('')
      setReason('')
      setPhone('')
      setLines([])
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
          {suggestions.length > 0 ? <View style={styles.chips}>{suggestions.map((c) => <TouchableOpacity key={c.id} style={styles.chip} onPress={() => pickCustomer(c)}><Text style={styles.chipText}>{c.name}</Text></TouchableOpacity>)}</View> : null}
          {lastForName ? (
            <TouchableOpacity style={styles.repeat} onPress={() => repeat(lastForName)} activeOpacity={0.8}>
              <Text style={styles.repeatText}>↻ {tr('repeatLast')}: {lastForName.type === 'payment' ? tr('receivePayment') : tr('giveCredit')} {fmt(lastForName.amount)}{lastForName.reason ? ` · ${lastForName.reason}` : ''}</Text>
            </TouchableOpacity>
          ) : null}
          {itemized ? (
            <View style={styles.itemsBox}>
              {lines.map((l, i) => (
                <View key={i} style={styles.lineRow}>
                  <Text style={styles.lineName} numberOfLines={1}>{l.name}{l.unit ? ` (${unitLabel(l.unit, lang)})` : ''}</Text>
                  <View style={styles.lineInputs}>
                    <Input placeholder={tr('qty')} keyboardType="numeric" value={l.qty} onChangeText={(v) => setLine(i, { qty: v })} style={{ flex: 1 }} />
                    <Input placeholder={tr('itemRate')} prefix="₹" keyboardType="numeric" value={l.rate} onChangeText={(v) => setLine(i, { rate: v })} style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))} hitSlop={8}><Text style={styles.x}>✕</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
              {errors.items ? <Text style={styles.err}>{errors.items}</Text> : null}
              <Text style={styles.total}>{tr('total')}: {fmt(lineTotal)}</Text>
            </View>
          ) : (
            <Input
              label={tr('amountLabel')}
              prefix="₹"
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              error={errors.amount}
            />
          )}
          <Text style={styles.sub}>{tr('addFromItems')}</Text>
          <View style={styles.chips}>
            {catalog.slice(0, 24).map((it) => <TouchableOpacity key={it.id} style={styles.chip} onPress={() => addLine(it)}><Text style={styles.chipText}>+ {it.name}</Text></TouchableOpacity>)}
            {lines.length < 20 ? <TouchableOpacity style={styles.chip} onPress={() => addLine({ name: reason.trim() || tr('itemDefault'), unit: undefined, price: null })}><Text style={styles.chipText}>+ {tr('otherItem')}</Text></TouchableOpacity> : null}
          </View>
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
  chipText: { color: colors.milk, fontSize: 12, fontWeight: '600' },
  sub: { color: colors.inkSoft, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  repeat: { backgroundColor: colors.milkLight, borderRadius: radius.md, padding: 10, marginBottom: 12 },
  repeatText: { color: colors.milkDark, fontWeight: '700', fontSize: 13 },
  itemsBox: { marginBottom: 10 },
  lineRow: { marginBottom: 6 },
  lineName: { color: colors.ink, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  lineInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  x: { color: colors.alert, fontWeight: '800', fontSize: 16 },
  err: { color: colors.alert, fontSize: 12, marginBottom: 6 },
  total: { color: colors.milkDark, fontWeight: '800', fontSize: 16, textAlign: 'right', marginTop: 4 }
})
