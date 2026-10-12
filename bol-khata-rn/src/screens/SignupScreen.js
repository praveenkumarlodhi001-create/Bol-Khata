import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import AuthLayout from '../components/ui/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { signUpWithEmail, sendOtp, authErrorMessage } from '../services/authService'
import { useT } from '../i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function SignupScreen({ go }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [name, setName] = useState('')
  const [role, setRole] = useState('seller')
  const [phoneMode, setPhoneMode] = useState(false)
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handlePhoneSignup() {
    const e = {}
    if (name.trim().length < 2) e.name = tr('nameRequired')
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = tr('phoneInvalid')
    setErrors(e); setFormError('')
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      const { devOtp } = await sendOtp(phone, 'signup', name, role)
      setLoading(false)
      go('verify', { phone, devOtp, purpose: 'signup', name: name.trim(), role })
    } catch (err) { setFormError(authErrorMessage(err)); setLoading(false) }
  }

  async function handleSignup() {
    const e = {}
    if (name.trim().length < 2) e.name = tr('nameRequired')
    if (!EMAIL_RE.test(email.trim())) e.email = tr('emailInvalid')
    if (password.length < 6) e.password = tr('passwordTooShort')
    if (confirm !== password) e.confirm = tr('passwordMismatch')
    setErrors(e)
    setFormError('')
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      await signUpWithEmail(name, email, password, role)
    } catch (err) {
      setFormError(authErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={tr('signupTitle')}
      subtitle={tr('signupSubtitle')}
      footer={
        <TouchableOpacity onPress={() => go('login')}>
          <Text style={styles.footText}>
            {tr('alreadyAccount')} <Text style={styles.link}>{tr('loginAction')}</Text>
          </Text>
        </TouchableOpacity>
      }
    >
      <TouchableOpacity onPress={() => { setPhoneMode((v) => !v); setFormError(''); setErrors({}) }} style={{ marginBottom: 12, alignItems: 'center' }}>
        <Text style={styles.hint}>{phoneMode ? tr('switchEmailSignup') : tr('switchPhoneSignup')}</Text>
      </TouchableOpacity>
      <View style={styles.roleWrap}><Text style={styles.hint}>{tr('accountType')}</Text><View style={styles.roleRow}>{[{ key: 'seller', label: tr('sellerRole') }, { key: 'buyer', label: tr('buyerRole') }].map((r) => <TouchableOpacity key={r.key} onPress={() => setRole(r.key)} style={[styles.roleChoice, role === r.key && styles.roleChoiceOn]}><Text style={[styles.roleText, role === r.key && styles.roleTextOn]}>{r.label}</Text></TouchableOpacity>)}</View></View>
      <Input label={tr('nameLabel')} placeholder={tr('yourName')} value={name} onChangeText={setName} error={errors.name} />
      {!phoneMode ? <>
      <Input
        label="Email"
        placeholder="aap@example.com"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        value={email}
        onChangeText={setEmail}
        error={errors.email}
      />
      <Input
        label="Password"
        placeholder={tr('passwordMinHint')}
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        error={errors.password}
      />
      <Input
        label={tr('confirmPasswordLabel')}
        placeholder="••••••"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        error={errors.confirm}
      />
      {formError ? <Text style={styles.formError}>{formError}</Text> : null}
      <Button title={tr('createAccount')} onPress={handleSignup} loading={loading} />
      </> : <>
        <Input label={tr('mobileNumber')} prefix="+91" placeholder="98XXXXXXXX" keyboardType="number-pad" maxLength={10} value={phone} onChangeText={setPhone} error={errors.phone} />
        {formError ? <Text style={styles.formError}>{formError}</Text> : null}
        <Button title={tr('signupWithOtp')} onPress={handlePhoneSignup} loading={loading} />
      </>}
      <TouchableOpacity onPress={() => go('login')} style={{ marginTop: 14, alignItems: 'center' }}>
        <Text style={styles.hint}>{tr('phoneLoginHint')}</Text>
      </TouchableOpacity>
    </AuthLayout>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  link: { color: colors.milk, fontWeight: '700' },
  roleWrap: { marginBottom: 12 },
  roleRow: { flexDirection: 'row', gap: 10, marginTop: 7 },
  roleChoice: { flex: 1, borderWidth: 1, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  roleChoiceOn: { backgroundColor: colors.milk, borderColor: colors.milk },
  roleText: { color: colors.ink, fontWeight: '600' },
  roleTextOn: { color: colors.onMilk || '#FFFFFF' },
  formError: {
    color: colors.alert,
    backgroundColor: colors.alertLight,
    padding: 10,
    borderRadius: radius.sm,
    fontSize: 13,
    marginBottom: 12
  },
  hint: { color: colors.inkSoft, fontSize: 12, textAlign: 'center' },
  footText: { color: colors.inkSoft, fontSize: 14 }
})
