import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, AccessibilityInfo, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Icon from './Icon'
import { parseHindiSpeech } from '../services/parseHindiSpeech'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'

// expo-speech-recognition ek native module hai jo Expo Go me maujood nahi hota.
// Isliye isko try/catch me load karte hain — Expo Go me safely "unavailable" ban
// jaata hai (crash nahi hota), aur development build me poora kaam karta hai.
let ExpoSpeechRecognitionModule = null
let useSpeechRecognitionEvent = () => {}
let speechModuleAvailable = false

try {
  const speechLib = require('expo-speech-recognition')
  ExpoSpeechRecognitionModule = speechLib.ExpoSpeechRecognitionModule
  useSpeechRecognitionEvent = speechLib.useSpeechRecognitionEvent
  speechModuleAvailable = true
} catch (e) {
  speechModuleAvailable = false
}

export default function VoiceEntry({ onAdd }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [listening, setListening] = useState(false)
  const [heard, setHeard] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const pulse = useRef(new Animated.Value(0)).current
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.35))).current
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => { let alive = true; AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduceMotion(v) }).catch(() => {}); return () => { alive = false; pulse.stopAnimation(); bars.forEach(v => v.stopAnimation()) } }, [pulse, bars])
  useEffect(() => { if (!listening || reduceMotion) { pulse.stopAnimation(); pulse.setValue(0); bars.forEach(v => { v.stopAnimation(); v.setValue(0.35) }); return } const ring = Animated.loop(Animated.sequence([Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.out(Easing.ease), useNativeDriver: true }), Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true })])); ring.start(); const loops = bars.map((v, i) => Animated.loop(Animated.sequence([Animated.timing(v, { toValue: 1, duration: 220 + i * 35, useNativeDriver: true }), Animated.timing(v, { toValue: 0.25, duration: 220 + i * 35, useNativeDriver: true })]))); loops.forEach((a, i) => a.start()); return () => { ring.stop(); loops.forEach(a => a.stop()) } }, [listening, reduceMotion, pulse, bars])

  useSpeechRecognitionEvent('start', () => setListening(true))
  useSpeechRecognitionEvent('end', () => setListening(false))
  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results?.[0]?.transcript
    if (text) {
      const parsed = parseHindiSpeech(text)
      setHeard(parsed)
    }
  })
  useSpeechRecognitionEvent('error', (event) => {
    setListening(false)
    setErrorMsg(tr('speechError'))
  })

  async function toggleListening() {
    if (!speechModuleAvailable) {
      setErrorMsg(
        tr('voiceUnavailable')
      )
      return
    }
    if (listening) {
      ExpoSpeechRecognitionModule.stop()
      return
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
    if (!permission.granted) {
      setErrorMsg(tr('micPermission'))
      return
    }
    setErrorMsg(null)
    setHeard(null)
    ExpoSpeechRecognitionModule.start({
      lang: 'hi-IN',
      interimResults: false,
      continuous: false
    })
  }

  async function confirmAdd() {
    if (heard && heard.name && heard.amount) {
      setSaving(true)
      await onAdd(heard.name, heard.amount, heard.type)
      setSaving(false)
    }
    setHeard(null)
  }

  return (
    <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, shadow]}>
      <View style={styles.micWrap}>
        {listening && !reduceMotion ? <Animated.View pointerEvents="none" style={[styles.pulseRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) }] }]} /> : null}
        <TouchableOpacity style={[styles.micBtn, listening && styles.micBtnListening]} onPress={toggleListening} accessibilityRole="button" accessibilityLabel={tr('micButton')} hitSlop={10}>
          <Icon name="mic" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {listening ? <View style={styles.waveform} accessibilityElementsHidden>{bars.slice(1, 4).map((bar, i) => <Animated.View key={i} style={[styles.waveBar, { transform: [{ scaleY: bar }] }]} />)}</View> : null}
      <Text style={styles.hint}>{tr('voiceHint')}</Text>
      <Text style={styles.example}>
        {tr('voiceExample')}
      </Text>

      {errorMsg && <Text style={styles.error}>{errorMsg}</Text>}

      {heard && (
        <View style={styles.heardBox}>
          <Text style={styles.heardText}>{tr('heard')}: {heard.rawText}</Text>
          <Text style={styles.parsedText}>
            {heard.name || '?'} — {heard.amount ? `₹${heard.amount}` : '?'} —{' '}
            {heard.type === 'udhar' ? tr('giveCredit') : tr('receivePayment')}
          </Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity style={styles.btnYes} onPress={confirmAdd} disabled={saving}>
              {saving ? (
                <ActivityIndicator color={colors.milkDark} />
              ) : (
                <Text style={styles.btnYesText}>{tr('correctAdd')}</Text>
              )}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnNo} onPress={() => setHeard(null)}>
              <Text style={styles.btnNoText}>{tr('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </LinearGradient>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  card: {
    borderRadius: radius.lg,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16
  },
  micWrap: { width: 104, height: 94, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#D9A441' },
  waveform: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 },
  waveBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: '#D9A441' },
  micBtn: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: 'rgba(255,255,255,0.5)',
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10
  },
  micBtnListening: {
    backgroundColor: colors.alert,
    borderColor: '#fff'
  },
  hint: { color: '#FFF9EC', fontSize: 15 },
  example: { color: '#FFF9EC', opacity: 0.75, fontSize: 12, marginTop: 4, textAlign: 'center' },
  error: { color: '#FFE1DB', fontSize: 12, marginTop: 10 },
  heardBox: {
    marginTop: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    borderRadius: radius.md,
    padding: 14,
    width: '100%'
  },
  heardText: { color: '#FFF9EC', fontSize: 14 },
  parsedText: { color: '#FFF9EC', fontWeight: '700', marginTop: 6, fontSize: 15 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnYes: { flex: 1, backgroundColor: '#fff', padding: 12, borderRadius: radius.sm, alignItems: 'center' },
  btnYesText: { color: colors.milkDark, fontWeight: '700' },
  btnNo: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', padding: 12, borderRadius: radius.sm, alignItems: 'center' },
  btnNoText: { color: '#fff', fontWeight: '700' }
})
