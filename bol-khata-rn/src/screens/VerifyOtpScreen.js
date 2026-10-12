import { useEffect, useRef, useState } from 'react'
import { Text, TextInput, TouchableOpacity, View, StyleSheet } from 'react-native'
import AuthLayout from '../components/ui/AuthLayout'
import Button from '../components/ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { confirmOtp, sendOtp, authErrorMessage } from '../services/authService'
import { useT } from '../i18n'

const LEN = 6
const RESEND_SECS = 30

export default function VerifyOtpScreen({ go, params }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const { phone, name = '', role = 'seller' } = params
  const purpose = params.purpose === 'signup' ? 'signup' : 'login'
  const [devOtp, setDevOtp] = useState(params.devOtp)
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [secs, setSecs] = useState(RESEND_SECS)
  const inputRef = useRef(null)

  useEffect(() => {
    if (secs <= 0) return
    const t = setTimeout(() => setSecs((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [secs])

  async function handleVerify() {
    if (code.length !== LEN) {
      setError(tr('otpInvalid'))
      return
    }
    setError('')
    setLoading(true)
    try {
      await confirmOtp(phone, code, { purpose, name, role })
      // success par dashboard apne aap khul jaata hai
    } catch (e) {
      setError(authErrorMessage(e))
      setLoading(false)
    }
  }

  async function handleResend() {
    setError('')
    try {
      const res = await sendOtp(phone, purpose, name, role)
      setDevOtp(res.devOtp)
      setCode('')
      setSecs(RESEND_SECS)
    } catch (e) {
      setError(authErrorMessage(e))
    }
  }

  return (
    <AuthLayout
      title={tr('otpTitle')}
      subtitle={tr('otpSubtitle', { phone })}
      footer={
        <TouchableOpacity onPress={() => go(purpose === 'signup' ? 'signup' : 'login')}>
          <Text style={styles.link}>{tr('changeNumber')}</Text>
        </TouchableOpacity>
      }
    >
      <TouchableOpacity activeOpacity={1} onPress={() => inputRef.current?.focus()}>
        <View style={styles.boxes}>
          {Array.from({ length: LEN }).map((_, i) => {
            const active = i === code.length
            return (
              <View
                key={i}
                style={[styles.box, active && styles.boxActive, error && styles.boxError]}
              >
                <Text style={styles.digit}>{code[i] || ''}</Text>
              </View>
            )
          })}
        </View>
      </TouchableOpacity>

      {/* Asli input chhupa hua hai; upar ke dibbe sirf dikhane ke liye */}
      <TextInput
        ref={inputRef}
        value={code}
        onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, LEN))}
        keyboardType="number-pad"
        maxLength={LEN}
        autoFocus
        textContentType="oneTimeCode"
        autoComplete="sms-otp"
        style={styles.hidden}
      />

      {devOtp ? (
        <Text style={styles.devBox}>{tr('testOtp', { otp: devOtp })}</Text>
      ) : null}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <Button title={tr('verifyOtp')} onPress={handleVerify} loading={loading} />

      <View style={{ marginTop: 16, alignItems: 'center' }}>
        {secs > 0 ? (
          <Text style={styles.hint}>{tr('resendIn', { count: secs })}</Text>
        ) : (
          <TouchableOpacity onPress={handleResend}>
            <Text style={styles.link}>{tr('resendOtpAction')}</Text>
          </TouchableOpacity>
        )}
      </View>
    </AuthLayout>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  boxes: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 },
  box: {
    width: 44,
    height: 54,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.line,
    backgroundColor: '#FBFCFB',
    alignItems: 'center',
    justifyContent: 'center'
  },
  boxActive: { borderColor: colors.milk, backgroundColor: '#fff' },
  boxError: { borderColor: colors.alert },
  digit: { fontSize: 22, fontWeight: '700', color: colors.ink },
  hidden: { position: 'absolute', opacity: 0, height: 1, width: 1 },
  error: {
    color: colors.alert,
    backgroundColor: colors.alertLight,
    padding: 10,
    borderRadius: radius.sm,
    fontSize: 13,
    marginBottom: 12
  },
  devBox: {
    color: colors.milkDark,
    backgroundColor: colors.milkLight,
    padding: 10,
    borderRadius: radius.sm,
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    marginBottom: 12
  },
  hint: { color: colors.inkSoft, fontSize: 12 },
  link: { color: colors.milk, fontWeight: '700', fontSize: 14 }
})
