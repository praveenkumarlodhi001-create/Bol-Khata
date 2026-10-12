import { useEffect, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Button from './ui/Button'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import Icon from './Icon'
import { fmt } from '../utils/format'
import { getDailyDoneDay, todayKey } from '../services/dataService'
import { useT } from '../i18n'
import FadeSlideIn from './anim/FadeSlideIn'

// "Roz ki entry": jinki roz ki fixed entry set hai (jaise Ramu — 2 litre — ₹120) un sab ki aaj ki entry ek tap me.
// Jo grahak aaj nahi lega, uspar dabakar hata do. Ek grahak ki aaj ki entry ek hi baar judti hai.
export default function DailyCard({ customers, onApply }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const plan = customers.filter((c) => c.daily && !c.localOnly)
  const [skip, setSkip] = useState({})
  const [doneDay, setDoneDay] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    getDailyDoneDay().then(setDoneDay).catch(() => {})
  }, [])

  if (!plan.length) return null
  const chosen = plan.filter((c) => !skip[c.id])
  const total = chosen.reduce((s, c) => s + c.daily.amount, 0)
  const done = doneDay === todayKey()

  async function apply() {
    setBusy(true)
    const ok = await onApply(chosen)
    setBusy(false)
    if (ok) setDoneDay(todayKey())
  }

  return (
    <FadeSlideIn><View style={[styles.card, shadow]}>
      <View style={styles.titleRow}><Icon name="repeat" size={19} color={colors.milk}/><Text style={styles.title}>{tr('dailyTitle')}</Text></View>
      {done ? (
        <Text style={styles.done}>{tr('dailyDone')}</Text>
      ) : (
        <>
          <Text style={styles.hint}>{tr('dailyHint')}</Text>
          {plan.map((c) => {
            const off = !!skip[c.id]
            return (
              <TouchableOpacity
                key={c.id}
                style={styles.row}
                onPress={() => setSkip({ ...skip, [c.id]: !off })}
                activeOpacity={0.7}
              >
                <Icon name={off ? 'square-outline' : 'checkmark-circle'} size={20} color={off ? colors.inkSoft : colors.milk} />
                <Text style={[styles.name, off && styles.off]} numberOfLines={1}>
                  {c.name}
                  {c.daily.reason ? ` · ${c.daily.reason}` : ''}
                </Text>
                <Text style={[styles.amt, off && styles.off]}>{fmt(c.daily.amount)}</Text>
              </TouchableOpacity>
            )
          })}
          <Button
            title={chosen.length ? `${tr('dailyAdd')} ${chosen.length} · ${fmt(total)}` : tr('noneSelected')}
            onPress={apply}
            loading={busy}
            disabled={!chosen.length}
            style={{ marginTop: 10 }}
          />
        </>
      )}
    </View></FadeSlideIn>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  card: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 16, marginBottom: 18 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 16, fontWeight: '800', color: colors.milkDark },
  hint: { color: colors.inkSoft, fontSize: 12, marginTop: 2, marginBottom: 8 },
  done: { color: colors.milk, fontWeight: '700', fontSize: 13, marginTop: 6 },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 10 },
  name: { flex: 1, color: colors.ink, fontWeight: '600', fontSize: 14 },
  amt: { color: colors.ink, fontWeight: '800', fontSize: 14 },
  off: { color: colors.inkSoft, textDecorationLine: 'line-through' }
})
