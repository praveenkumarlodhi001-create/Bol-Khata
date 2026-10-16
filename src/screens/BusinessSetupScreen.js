import { useState } from 'react'
import { Text, TouchableOpacity, View, StyleSheet } from 'react-native'
import AuthLayout from '../components/ui/AuthLayout'
import Button from '../components/ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { BUSINESS_TYPES, catalogFor, unitLabel } from '../data/catalog'
import { setBusinessType, authErrorMessage, logout } from '../services/authService'
import { seedItems } from '../services/dataService'

// Seller ko ek baar: business type chuno -> taiyaar items me se jo chahiye wo chuno (baad me Profile me badal sakte hain).
export default function BusinessSetupScreen() {
  const { colors } = useTheme()
  const { tr, lang } = useT()
  const styles = makeStyles(colors)
  const [type, setType] = useState(null)
  const [step, setStep] = useState(1)
  const [off, setOff] = useState({}) // jo items nahi chahiye
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const list = type ? catalogFor(type, lang) : []

  async function finish() {
    setLoading(true); setError('')
    try {
      const chosen = list.filter((x) => !off[x.name])
      if (chosen.length) { try { await seedItems(chosen) } catch (e) { /* items baad me Profile se jod sakte hain */ } }
      await setBusinessType(type) // user update hote hi Root dashboard dikha deta hai
    } catch (e) { setError(authErrorMessage(e)); setLoading(false) }
  }
  function next() {
    if (!type) return setError(tr('chooseBusiness'))
    setError('')
    if (!list.length) return finish()
    setStep(2)
  }

  return (
    <AuthLayout
      title={step === 1 ? tr('businessTitle') : tr('pickItemsTitle')}
      subtitle={step === 1 ? tr('businessSubtitle') : tr('pickItemsSubtitle')}
      footer={<TouchableOpacity onPress={() => logout()}><Text style={styles.link}>{tr('logoutAction')}</Text></TouchableOpacity>}
    >
      {step === 1 ? BUSINESS_TYPES.map((b) => (
        <TouchableOpacity key={b.key} onPress={() => setType(b.key)} activeOpacity={0.85} accessibilityRole="radio" accessibilityState={{ selected: type === b.key }} style={[styles.option, type === b.key && styles.optionOn]}>
          <Text style={[styles.optTitle, type === b.key && styles.optTitleOn]}>{lang === 'en' ? b.en : b.hi}</Text>
        </TouchableOpacity>
      )) : (
        <View style={styles.chips}>
          {list.map((x) => (
            <TouchableOpacity key={x.name} onPress={() => setOff((o) => ({ ...o, [x.name]: !o[x.name] }))} style={[styles.chip, !off[x.name] && styles.chipOn]} accessibilityRole="checkbox" accessibilityState={{ checked: !off[x.name] }}>
              <Text style={[styles.chipText, !off[x.name] && styles.chipTextOn]}>{!off[x.name] ? '✓ ' : ''}{x.name} · {unitLabel(x.unit, lang)}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      {step === 1 ? <Button title={tr('continueAction')} onPress={next} loading={loading} /> : (
        <>
          <Button title={tr('startShop')} onPress={finish} loading={loading} />
          <Button title={tr('back')} variant="ghost" onPress={() => setStep(1)} style={{ marginTop: 10 }} />
        </>
      )}
    </AuthLayout>
  )
}

const makeStyles = (c) => StyleSheet.create({
  option: { borderWidth: 1.5, borderColor: c.line, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  optionOn: { borderColor: c.milk, backgroundColor: c.milkLight },
  optTitle: { fontSize: 15, fontWeight: '700', color: c.ink },
  optTitleOn: { color: c.milkDark },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { borderWidth: 1, borderColor: c.line, borderRadius: 20, paddingHorizontal: 12, paddingVertical: 8 },
  chipOn: { backgroundColor: c.milkLight, borderColor: c.milk },
  chipText: { color: c.inkSoft, fontSize: 13, fontWeight: '600' },
  chipTextOn: { color: c.milkDark },
  link: { color: c.milk, fontWeight: '700', fontSize: 13 },
  formError: { color: c.alert, backgroundColor: c.alertLight, padding: 10, borderRadius: radius.sm, fontSize: 13, marginBottom: 12 }
})
