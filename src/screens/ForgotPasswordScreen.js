import { useEffect, useState } from 'react'
import { Text, TouchableOpacity, StyleSheet } from 'react-native'
import AuthLayout from '../components/ui/AuthLayout'
import Input from '../components/ui/Input'
import Button from '../components/ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { forgotPassword, resetPassword, authErrorMessage } from '../services/authService'
import { useT } from '../i18n'
import { usePopup } from '../components/Popup'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[6-9]\d{9}$/
const RESEND_SECS = 30

// Do kadam: (1) email/mobile daalo, OTP mangao  (2) OTP + naya password
export default function ForgotPasswordScreen({ go }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const popup = usePopup()
  const styles = makeStyles(colors)
  const [step, setStep] = useState(1)
  const [identifier, setIdentifier] = useState('')
  const [code, setCode] = useState('')
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [devOtp, setDevOtp] = useState(null)
  const [maskedPhone, setMaskedPhone] = useState(null)
  const [errors, setErrors] = useState({})
  const [formError, setFormError] = useState('')
  const [loading, setLoading] = useState(false)
  const [secs, setSecs] = useState(0)

  useEffect(() => {
    if (secs <= 0) return undefined
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secs])

  async function handleSend() {
    const id = identifier.trim()
    if (!EMAIL_RE.test(id) && !PHONE_RE.test(id)) {
      setErrors({ identifier: tr('identifierInvalid') })
      return
    }
    setErrors({}); setFormError(''); setLoading(true)
    try {
      const r = await forgotPassword(id)
      setDevOtp(r.devOtp); setMaskedPhone(r.maskedPhone)
      setStep(2); setSecs(RESEND_SECS)
    } catch (err) {
      setFormError(authErrorMessage(err))
    }
    setLoading(false)
  }

  async function handleReset() {
    const e = {}
    if (!/^\d{6}$/.test(code)) e.code = tr('otpInvalid')
    if (password.length < 6) e.password = tr('passwordTooShort')
    if (confirm !== password) e.confirm = tr('passwordMismatch')
    setErrors(e); setFormError('')
    if (Object.keys(e).length) return
    setLoading(true)
    try {
      await resetPassword(identifier, code, password)
      setLoading(false)
      await popup.notify({ tone: 'success', title: tr('resetDone') })
      go('login')
    } catch (err) {
      setFormError(authErrorMessage(err))
      setLoading(false)
    }
  }

  return (
    <AuthLayout
      title={tr('forgotTitle')}
      subtitle={step === 1 ? tr('forgotSubtitle') : (maskedPhone ? tr('resetSentTo', { phone: maskedPhone }) : tr('resetSent'))}
      footer={
        <TouchableOpacity onPress={() => go('login')}>
          <Text style={styles.link}>{tr('backToLogin')}</Text>
        </TouchableOpacity>
      }
    >
      {step === 1 ? (
        <>
          <Input
            label={tr('identifierLabel')}
            placeholder="aap@example.com / 98XXXXXXXX"
            autoCapitalize="none"
            autoCorrect={false}
            value={identifier}
            onChangeText={setIdentifier}
            error={errors.identifier}
          />
          {formError ? <Text style={styles.formError}>{formError}</Text> : null}
          <Button title={tr('sendResetOtp')} onPress={handleSend} loading={loading} />
          <Text style={styles.hint}>{tr('resetNoPhoneNote')}</Text>
        </>
      ) : (
        <>
          {devOtp ? <Text style={styles.testBox}>{tr('testOtp', { otp: devOtp })}</Text> : null}
          <Input
            label={tr('resetOtpLabel')}
            placeholder="••••••"
            keyboardType="number-pad"
            maxLength={6}
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, ''))}
            error={errors.code}
          />
          <Input
            label={tr('newPasswordLabel')}
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
          <Button title={tr('resetAction')} onPress={handleReset} loading={loading} />
          <TouchableOpacity disabled={secs > 0 || loading} onPress={handleSend} style={{ marginTop: 14, alignItems: 'center' }}>
            <Text style={[styles.link, secs > 0 && { opacity: 0.5 }]}>
              {secs > 0 ? tr('resendIn', { count: secs }) : tr('resendOtpAction')}
            </Text>
          </TouchableOpacity>
        </>
      )}
    </AuthLayout>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  link: { color: colors.milk, fontWeight: '700', fontSize: 13 },
  formError: { color: colors.alert, backgroundColor: colors.alertLight, padding: 10, borderRadius: radius.sm, fontSize: 13, marginBottom: 12 },
  hint: { textAlign: 'center', color: colors.inkSoft, fontSize: 12, marginTop: 14, lineHeight: 18 },
  testBox: { color: colors.milkDark, backgroundColor: colors.milkLight, padding: 10, borderRadius: radius.sm, fontSize: 13, marginBottom: 12, textAlign: 'center' }
})
