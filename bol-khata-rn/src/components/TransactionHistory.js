import { View, Text, StyleSheet } from 'react-native'
import { useTheme } from '../theme/ThemeContext'
import { fmt, fmtDate } from '../utils/format'
import { useT } from '../i18n'
import { unitLabel } from '../data/catalog'

// Ek grahak ki entries — har entry ke saath uski वजह साफ़ दिखती है.
export default function TransactionHistory({ items }) {
  const { colors } = useTheme()
  const { lang } = useT()
  const styles = makeStyles(colors)
  if (!items) return <Text style={styles.note}>लोड हो रहा है…</Text>
  if (items.length === 0) return <Text style={styles.note}>अभी कोई entry नहीं।</Text>
  return (
    <View>
      {items.map((t) => {
        const isUdhar = t.type === 'udhar'
        return (
          <View key={t.id} style={styles.row}>
            <View style={{ flex: 1 }}>
              <Text style={styles.reason} numberOfLines={2}>
                {t.reason ? t.reason : isUdhar ? 'Credit (no reason provided)' : 'Payment (no reason provided)'}
              </Text>
              {t.items && t.items.length ? t.items.map((x, i) => (
                <Text key={i} style={styles.item}>• {x.name} — {x.qty}{x.unit ? ' ' + unitLabel(x.unit, lang) : ''} × {fmt(x.rate)} = {fmt(x.amount)}</Text>
              )) : null}
              <Text style={styles.date}>
                {isUdhar ? 'Credit given' : 'Payment received'} · {fmtDate(t.at)}
              </Text>
            </View>
            <Text style={[styles.amt, isUdhar ? styles.udhar : styles.paid]}>
              {isUdhar ? '+' : '−'}
              {fmt(t.amount)}
            </Text>
          </View>
        )
      })}
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    borderTopWidth: 1,
    borderTopColor: colors.line,
    gap: 10
  },
  reason: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  item: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  date: { color: colors.inkSoft, fontSize: 11, marginTop: 2 },
  amt: { fontWeight: '800', fontSize: 14 },
  udhar: { color: colors.alert },
  paid: { color: colors.milk },
  note: { color: colors.inkSoft, fontSize: 12, paddingVertical: 8 }
})
