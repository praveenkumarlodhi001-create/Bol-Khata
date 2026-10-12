import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import AuthLayout from '../components/ui/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { loginWithEmail, sendOtp, authErrorMessage } from '../services/authService'
import { useT } from '../i18n'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export default function LoginScreen({ go }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [mode, setMode] = useState('email') // 'email' | 'phone'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [phone, setPhone] = useState('')
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(m) {
    setMode(m)
    setErrors({})
    setFormError('')
  }

  async function handleEmailLogin() {
    const e = {}
    if (!EMAIL_RE.test(email.trim())) e.email = tr('validEmail')
    if (password.length < 6) e.password = tr('passwordMin')
    setErrors(e)
    setFormError('')
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      await loginWithEmail(email, password)
      // success par AuthContext apne aap dashboard dikha deta hai
    } catch (err) {
      setFormError(authErrorMessage(err))
      setLoading(false)
    }
  }

  async function handleSendOtp() {
    const e = {}
    if (!/^[6-9]\d{9}$/.test(phone)) e.phone = tr('invalidPhone')
    setErrors(e)
    setFormError('')
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      const { devOtp } = await sendOtp(phone, 'login')
      setLoading(false)
      go('verify', { phone, devOtp, purpose: 'login' })
    } catch (err) {
      setFormError(authErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={tr('loginWelcome')}
      subtitle={tr('loginSubtitle')}
      footer={
        <TouchableOpacity onPress={() => go('signup')}>
          <Text style={styles.footText}>
            {tr('signupPrompt')}<Text style={styles.link}>{tr('signupAction')}</Text>
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.seg}>
        <TouchableOpacity
          style={[styles.segBtn, mode === 'email' && styles.segActive]}
          onPress={() => switchMode('email')}
        >
          <Text style={[styles.segText, mode === 'email' && styles.segTextActive]}>{tr('email')}</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.segBtn, mode === 'phone' && styles.segActive]}
          onPress={() => switchMode('phone')}
        >
          <Text style={[styles.segText, mode === 'phone' && styles.segTextActive]}>{tr('mobileOtp')}</Text>
        </TouchableOpacity>
      </View>

      {mode === 'email' ? (
        <>
          <Input
            label={tr('email')}
            placeholder="aap@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            value={email}
            onChangeText={setEmail}
            error={errors.email}
          />
          <Input
            label={tr('password')}
            placeholder="••••••"
            secureTextEntry
            value={password}
            onChangeText={setPassword}
            error={errors.password}
          />
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <Button title={tr('loginAction')} onPress={handleEmailLogin} loading={loading} />
          <TouchableOpacity onPress={() => go('forgot')} style={{ marginTop: 14, alignItems: 'center' }} accessibilityRole="button">
            <Text style={styles.link}>{tr('forgotPassword')}</Text>
          </TouchableOpacity>
        </>
      ) : (
        <>
          <Input
            label={tr('mobileNumber')}
            prefix="+91"
            placeholder="98XXXXXXXX"
            keyboardType="number-pad"
            maxLength={10}
            value={phone}
            onChangeText={(t) => setPhone(t.replace(/\D/g, ''))}
            error={errors.phone}
          />
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <Button title={tr('sendOtpAction')} onPress={handleSendOtp} loading={loading} />
          <Text style={styles.hint}>{tr('newNumberHint')}</Text>
        </>
      )}
    </AuthLayout>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  seg: {
    flexDirection: 'row',
    backgroundColor: colors.milkLight,
    borderRadius: radius.md,
    padding: 4,
    marginBottom: 18
  },
  segBtn: { flex: 1, paddingVertical: 10, borderRadius: radius.sm, alignItems: 'center' },
  segActive: { backgroundColor: '#fff', elevation: 2 },
  segText: { color: colors.inkSoft, fontWeight: '600' },
  segTextActive: { color: colors.milkDark },
  link: { color: colors.milk, fontWeight: '700', fontSize: 13 },
  formError: {
    color: colors.alert,
    backgroundColor: colors.alertLight,
    padding: 10,
    borderRadius: radius.sm,
    fontSize: 13,
    marginBottom: 12
  },
  hint: { textAlign: 'center', color: colors.inkSoft, fontSize: 12, marginTop: 12 },
  footText: { color: colors.inkSoft, fontSize: 14 }
})
