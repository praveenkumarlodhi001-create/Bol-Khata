import Icon from './Icon'
import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { fmt, fmtDay } from '../utils/format'
import { getReport } from '../services/dataService'
import { useT } from '../i18n'

const RANGES = [
  { days: 1, labelKey: 'today' },
  { days: 7, labelKey: 'sevenDays' },
  { days: 30, labelKey: 'thirtyDays' }
]

// version badalne par (nayi entry, edit, delete) report dobara aati hai
export default function ReportCard({ version }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [open, setOpen] = useState(false)
  const [days, setDays] = useState(7)
  const [rep, setRep] = useState(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    if (!open) return
    let dead = false
    setRep(null)
    setErr('')
    getReport(days)
      .then((r) => !dead && setRep(r))
      .catch((e) => !dead && setErr(e.message || tr('reportFailed')))
    return () => {
      dead = true
    }
  }, [open, days, version])

  const biggest = rep ? Math.max(1, ...rep.daily.map((d) => Math.max(d.given, d.paid))) : 1

  return (
    <View style={{ marginBottom: 14 }}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.toggle} activeOpacity={0.7}>
        <Icon name={open ? 'close' : 'bar-chart-outline'} size={18} color={colors.milk}/><Text style={styles.toggleText}>{open ? tr('reportClose') : tr('reportOpen')}</Text>
      </TouchableOpacity>

      {open && (
        <View style={[styles.box, shadow]}>
          <View style={styles.chips}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r.days}
                style={[styles.chip, days === r.days && styles.chipOn]}
                onPress={() => setDays(r.days)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, days === r.days && styles.chipTextOn]}>{tr(r.labelKey)}</Text>
              </TouchableOpacity>
            ))}
          </View>

          {err ? <Text style={styles.err}>{err}</Text> : !rep ? <ActivityIndicator color={colors.milk} /> : (
            <>
              <View style={styles.sums}>
                <View style={styles.sum}>
                  <Text style={styles.sumLabel}>{tr('given')}</Text>
                  <Text style={[styles.sumNum, { color: colors.alert }]}>{fmt(rep.given)}</Text>
                </View>
                <View style={styles.sum}>
                  <Text style={styles.sumLabel}>{tr('received')}</Text>
                  <Text style={[styles.sumNum, { color: colors.milk }]}>{fmt(rep.paid)}</Text>
                </View>
              </View>
              <Text style={styles.small}>{rep.count} entries</Text>

              {rep.daily.length === 0 ? (
                <Text style={styles.small}>{tr('noEntriesPeriod')}</Text>
              ) : (
                [...rep.daily].reverse().map((d) => (
                  <View key={d.day} style={styles.day}>
                    <Text style={styles.dayName}>{fmtDay(d.day)}</Text>
                    <View style={{ flex: 1 }}>
                      <View style={[styles.bar, { backgroundColor: colors.alert, width: `${Math.max(2, (d.given / biggest) * 100)}%` }, d.given === 0 && { opacity: 0 }]} />
                      <View style={[styles.bar, { backgroundColor: colors.milk, width: `${Math.max(2, (d.paid / biggest) * 100)}%` }, d.paid === 0 && { opacity: 0 }]} />
                    </View>
                    <Text style={styles.dayNum}>
                      {d.given ? `+${fmt(d.given)}` : ''} {d.paid ? `−${fmt(d.paid)}` : ''}
                    </Text>
                  </View>
                ))
              )}
            </>
          )}
        </View>
      )}
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  toggle: { alignItems: 'center', paddingVertical: 4 },
  toggleText: { color: colors.milk, fontSize: 14, fontWeight: '600' },
  box: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 16, marginTop: 6 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 12 },
  chip: { backgroundColor: colors.bg, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20 },
  chipOn: { backgroundColor: colors.milk },
  chipText: { color: colors.inkSoft, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  sums: { flexDirection: 'row', gap: 12 },
  sum: { flex: 1 },
  sumLabel: { color: colors.inkSoft, fontSize: 12, fontWeight: '600' },
  sumNum: { fontSize: 22, fontWeight: '800', marginTop: 2 },
  small: { color: colors.inkSoft, fontSize: 12, marginTop: 6, marginBottom: 6 },
  err: { color: colors.alert, fontSize: 13 },
  day: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 5 },
  dayName: { width: 48, color: colors.ink, fontSize: 12, fontWeight: '600' },
  bar: { height: 6, borderRadius: 3, marginVertical: 1 },
  dayNum: { width: 110, textAlign: 'right', fontSize: 11, color: colors.inkSoft }
})
