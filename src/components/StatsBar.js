import { View, Text, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { fmt } from '../utils/format'
import { useT } from '../i18n'
import AnimatedNumber from './anim/AnimatedNumber'
import FadeSlideIn from './anim/FadeSlideIn'

// summary = { customers, given, paid, owed, owingCount }  (server se)
export default function StatsBar({ summary }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const s = summary || { customers: 0, given: 0, paid: 0, owed: 0, owingCount: 0 }
  return (
    <View>
      <View style={styles.row}>
        <FadeSlideIn style={{ flex: 1 }}>
        <LinearGradient
          colors={[colors.alert, '#8F2F23']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.stat, shadow]}
        >
          <Text style={styles.labelLight}>{tr('statsOwed')}</Text>
          <AnimatedNumber value={s.owed} format={fmt} style={styles.numLight} />
          <Text style={styles.subLight}>{tr('owedCustomers', { count: s.owingCount })}</Text>
        </LinearGradient>
        </FadeSlideIn>

        <FadeSlideIn style={{ flex: 1 }}><View style={[styles.stat, styles.plain, shadow]}>
          <Text style={styles.label}>{tr('statsPaid')}</Text>
          <AnimatedNumber value={s.paid} format={fmt} style={[styles.num, { color: colors.milk }]} />
          <Text style={styles.sub}>{tr('statsGiven')} {fmt(s.given)}</Text>
        </View></FadeSlideIn>
      </View>
      <Text style={styles.count}>{tr('totalCustomers')}: {s.customers}</Text>
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  row: { flexDirection: 'row', gap: 12, marginBottom: 8 },
  stat: { flex: 1, borderRadius: radius.lg, padding: 16 },
  plain: { backgroundColor: colors.panel },
  label: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  num: { fontSize: 24, fontWeight: '800', color: colors.ink, marginTop: 4 },
  sub: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  labelLight: { fontSize: 12, color: '#FBE3DE', fontWeight: '600' },
  numLight: { fontSize: 24, fontWeight: '800', color: '#fff', marginTop: 4 },
  subLight: { fontSize: 11, color: '#FBE3DE', marginTop: 2 },
  count: { fontSize: 12, color: colors.inkSoft, marginBottom: 18, textAlign: 'right' }
})
