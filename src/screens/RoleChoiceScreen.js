import { useState } from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import AuthLayout from '../components/ui/AuthLayout'
import Button from '../components/ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { setRole, logout, authErrorMessage } from '../services/authService'
import { useT } from '../i18n'

// Purane accounts (jinka role set nahi tha aur jinke paas koi grahak nahi) ko ek baar yahan role chunna hota hai.
export default function RoleChoiceScreen() {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [role, setChoice] = useState('seller')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function save() {
    setError(''); setLoading(true)
    try {
      await setRole(role) // user update hote hi Root apne aap sahi screen dikha deta hai
    } catch (e) {
      setError(authErrorMessage(e) || tr('roleSaveFailed'))
      setLoading(false)
    }
  }

  const options = [
    { key: 'seller', title: tr('sellerRole'), desc: tr('sellerDesc') },
    { key: 'buyer', title: tr('buyerRole'), desc: tr('buyerDesc') }
  ]

  return (
    <AuthLayout
      title={tr('chooseRoleTitle')}
      subtitle={tr('chooseRoleSubtitle')}
      footer={
        <TouchableOpacity onPress={() => logout()}>
          <Text style={styles.link}>{tr('logoutAction')}</Text>
        </TouchableOpacity>
      }
    >
      {options.map((o) => (
        <TouchableOpacity
          key={o.key}
          onPress={() => setChoice(o.key)}
          activeOpacity={0.85}
          accessibilityRole="radio"
          accessibilityState={{ selected: role === o.key }}
          style={[styles.option, role === o.key && styles.optionOn]}
        >
          <Text style={[styles.optTitle, role === o.key && styles.optTitleOn]}>{o.title}</Text>
          <Text style={styles.optDesc}>{o.desc}</Text>
        </TouchableOpacity>
      ))}
      {error ? <Text style={styles.formError}>{error}</Text> : null}
      <Button title={tr('continueAction')} onPress={save} loading={loading} />
    </AuthLayout>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  option: { borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, padding: 14, marginBottom: 12 },
  optionOn: { borderColor: colors.milk, backgroundColor: colors.milkLight },
  optTitle: { fontSize: 16, fontWeight: '700', color: colors.ink },
  optTitleOn: { color: colors.milkDark },
  optDesc: { fontSize: 13, color: colors.inkSoft, marginTop: 4, lineHeight: 18 },
  link: { color: colors.milk, fontWeight: '700', fontSize: 13 },
  formError: { color: colors.alert, backgroundColor: colors.alertLight, padding: 10, borderRadius: radius.sm, fontSize: 13, marginBottom: 12 }
})
