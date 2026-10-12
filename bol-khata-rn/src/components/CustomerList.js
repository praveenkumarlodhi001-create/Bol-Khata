import { useMemo, useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { fmt, fmtShort } from '../utils/format'
import PressScale from './anim/PressScale'
import FadeSlideIn from './anim/FadeSlideIn'
import Avatar from './Avatar'
import Icon from './Icon'
import { useT } from '../i18n'


// customers = server ka array: [{ id, name, phone, linked, given, paid, balance, count }]
// Ek grahak par dabane se onOpen(customer) chalta hai (detail screen App.js kholta hai)
export default function CustomerList({ customers, onOpen }) {
  const { colors } = useTheme()
  const styles = makeStyles(colors)
  const { tr } = useT()
  const FILTERS = [{key:'all',label:tr('filterAll')},{key:'owe',label:tr('filterOwe')},{key:'clear',label:tr('filterClear')}]
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return customers.filter((c) => {
      if (needle && !c.name.toLowerCase().includes(needle) && !(c.phone || '').includes(needle)) return false
      if (filter === 'owe') return c.balance > 0
      if (filter === 'clear') return c.balance <= 0
      return true
    })
  }, [customers, q, filter])

  if (customers.length === 0) {
    return (
      <View style={styles.emptyBox}>
        <Text style={styles.emptyEmoji}>📒</Text>
        <Text style={styles.empty}>{tr('emptyCustomers')}</Text>
      </View>
    )
  }

  return (
    <View>
      <TextInput
        style={styles.search}
        placeholder={tr('searchCustomer')}
        placeholderTextColor={colors.inkSoft}
        value={q}
        onChangeText={setQ}
        autoCorrect={false}
      />
      <View style={styles.filters}>
        {FILTERS.map((f) => (
          <PressScale key={f.key} style={{ marginRight: 0 }} innerStyle={[styles.chip, filter === f.key && styles.chipOn]} onPress={() => setFilter(f.key)} accessibilityLabel={f.label}>
            <Text style={[styles.chipText, filter === f.key && styles.chipTextOn]}>{f.label}</Text>
          </PressScale>
        ))}
      </View>

      {shown.length === 0 && <Text style={styles.none}>{tr('noCustomerMatch')}</Text>}

      {shown.map((c, index) => {
        const isOwe = c.balance > 0
        const isClear = c.balance < 0
        const balText = isOwe ? `${fmt(c.balance)} ${tr('balanceOwed')}` : isClear ? `${fmt(Math.abs(c.balance))} ${tr('balanceExtra')}` : tr('balanceEven')
        return (
          <FadeSlideIn key={c.id} delay={Math.min(index * 50, 400)}><PressScale style={{ marginBottom: 10 }} innerStyle={[styles.card, shadow]} onPress={() => onOpen(c)} accessibilityLabel={`${c.name}, ${balText}`} >
            <Avatar name={c.name} size={44} />
            <View style={{ flex: 1 }}>
              <Text style={styles.name} numberOfLines={1}>
                {c.name}
              </Text>
              <Text style={styles.last}>{tr('lastActivity')}: {c.lastActivity ? fmtShort(c.lastActivity) : '—'}</Text>
              <View style={styles.badges}>{c.linked ? <View style={styles.badge}><Icon name="checkmark-circle" size={13} color={colors.milk}/></View> : null}{c.daily ? <View style={styles.badge}><Icon name="repeat" size={13} color={colors.inkSoft}/></View> : null}{c.pending ? <View style={styles.badge}><Icon name="time-outline" size={13} color={colors.gold}/></View> : null}</View>
            </View>
            <View style={[styles.pill, isOwe && styles.pillOwe, isClear && styles.pillClear]}>
              <Text style={[styles.bal, isOwe && styles.owe, isClear && styles.clear]}>{balText}</Text>
            </View>
          </PressScale></FadeSlideIn>
        )
      })}
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  search: {
    backgroundColor: colors.panel,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingHorizontal: 14,
    height: 46,
    color: colors.ink,
    fontSize: 14,
    marginBottom: 10
  },
  filters: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.panel, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.milk, borderColor: colors.milk },
  chipText: { color: colors.inkSoft, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  none: { color: colors.inkSoft, textAlign: 'center', paddingVertical: 20, fontSize: 13 },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', gap: 12 },
  name: { fontWeight: '700', color: colors.ink, fontSize: 15 },
  last: { fontSize: 12, color: colors.inkSoft, marginTop: 3 },
  pill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 20, backgroundColor: colors.bg },
  pillOwe: { backgroundColor: colors.alertLight },
  pillClear: { backgroundColor: colors.milkLight },
  bal: { fontWeight: '700', color: colors.inkSoft, fontSize: 12 },
  owe: { color: colors.alert },
  clear: { color: colors.milk },
  emptyBox: { alignItems: 'center', paddingVertical: 30 },
  badges: { flexDirection: 'row', gap: 5, marginTop: 4 },
  badge: { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 5, paddingVertical: 2 },
  emptyEmoji: { fontSize: 36, marginBottom: 8 },
  empty: { color: colors.inkSoft, textAlign: 'center', fontSize: 13 }
})
