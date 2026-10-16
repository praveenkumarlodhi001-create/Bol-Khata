import { useCallback, useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Input from './ui/Input'
import Button from './ui/Button'
import { radius } from '../theme/colors'
import { useThemedStyles } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { UNITS, unitLabel } from '../data/catalog'
import { getItems, addItem, updateItem } from '../services/dataService'
import { fmt } from '../utils/format'

// Seller ka item catalog: dekho, apna item jodo (naam, unit, rate), hatao.
export default function ItemsCard({ onToast }) {
  const { styles } = useThemedStyles(makeStyles)
  const { tr, lang } = useT()
  const [items, setItems] = useState(null)
  const [name, setName] = useState('')
  const [unit, setUnit] = useState('kg')
  const [price, setPrice] = useState('')
  const [busy, setBusy] = useState(false)
  const [open, setOpen] = useState(false)
  const load = useCallback(async () => { try { setItems(await getItems()) } catch (e) { setItems([]) } }, [])
  useEffect(() => { load() }, [load])

  async function add() {
    const p = price.trim() === '' ? undefined : parseFloat(price)
    if (!name.trim()) return onToast?.(tr('itemNameRequired'), 'err')
    if (p !== undefined && (!Number.isFinite(p) || p < 0)) return onToast?.(tr('itemRateInvalid'), 'err')
    setBusy(true)
    try { await addItem({ name: name.trim(), unit, ...(p !== undefined ? { price: p } : {}) }); setName(''); setPrice(''); await load(); onToast?.(tr('itemAdded')) }
    catch (e) { onToast?.(e.message || tr('errorToast'), 'err') }
    setBusy(false)
  }
  async function remove(it) {
    try { await updateItem(it.id, { active: false }); await load() } catch (e) { onToast?.(e.message || tr('errorToast'), 'err') }
  }
  return (
    <View style={styles.card}>
      <Text style={styles.title}>{tr('myItems')}</Text>
      <Text style={styles.hint}>{tr('myItemsHelp')}</Text>
      {items === null ? <Text style={styles.hint}>…</Text> : items.length === 0 ? <Text style={styles.hint}>{tr('noItems')}</Text> : items.map((it) => (
        <View key={it.id} style={styles.row}>
          <Text style={styles.itemName} numberOfLines={1}>{it.name}</Text>
          <Text style={styles.itemMeta}>{it.price != null ? `${fmt(it.price)} / ` : ''}{unitLabel(it.unit, lang)}</Text>
          <TouchableOpacity onPress={() => remove(it)} hitSlop={8} accessibilityLabel={tr('removeAction')}><Text style={styles.x}>✕</Text></TouchableOpacity>
        </View>
      ))}
      {open ? (
        <View style={{ marginTop: 10 }}>
          <Input label={tr('itemName')} value={name} onChangeText={setName} maxLength={40} />
          <View style={styles.units}>{UNITS.map((u) => <TouchableOpacity key={u} onPress={() => setUnit(u)} style={[styles.unit, unit === u && styles.unitOn]}><Text style={[styles.unitText, unit === u && styles.unitTextOn]}>{unitLabel(u, lang)}</Text></TouchableOpacity>)}</View>
          <Input label={tr('itemRate')} prefix="₹" keyboardType="numeric" value={price} onChangeText={setPrice} placeholder="0" />
          <Button title={tr('add')} icon="add" onPress={add} loading={busy} />
        </View>
      ) : <Button title={tr('addItem')} variant="ghost" icon="add" onPress={() => setOpen(true)} style={{ marginTop: 10 }} />}
    </View>
  )
}
const makeStyles = (c) => StyleSheet.create({
  card: { backgroundColor: c.panel, borderColor: c.line, borderWidth: 1, borderRadius: radius.lg, padding: 16 },
  title: { fontSize: 15, fontWeight: '800', color: c.ink },
  hint: { color: c.inkSoft, fontSize: 12, marginTop: 4, marginBottom: 6, lineHeight: 18 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 9, borderTopWidth: 1, borderTopColor: c.line },
  itemName: { flex: 1, color: c.ink, fontWeight: '600', fontSize: 14 },
  itemMeta: { color: c.inkSoft, fontSize: 12 },
  x: { color: c.alert, fontWeight: '800', fontSize: 16, paddingHorizontal: 4 },
  units: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 },
  unit: { borderWidth: 1, borderColor: c.line, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  unitOn: { backgroundColor: c.milkLight, borderColor: c.milk },
  unitText: { color: c.ink, fontSize: 13, fontWeight: '600' },
  unitTextOn: { color: c.milkDark }
})
