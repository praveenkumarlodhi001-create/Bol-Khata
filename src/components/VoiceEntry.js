import { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet, Animated, AccessibilityInfo, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Icon from './Icon'
import { parseHindiSpeech } from '../services/parseHindiSpeech'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'

// Speech recognition requires a native development/production build; Expo Go does not include it.
let ExpoSpeechRecognitionModule = null
let useSpeechRecognitionEvent = () => {}
let speechModuleAvailable = false
try {
  const speechLib = require('expo-speech-recognition')
  ExpoSpeechRecognitionModule = speechLib.ExpoSpeechRecognitionModule
  useSpeechRecognitionEvent = speechLib.useSpeechRecognitionEvent || useSpeechRecognitionEvent
  speechModuleAvailable = Boolean(
    ExpoSpeechRecognitionModule &&
    typeof ExpoSpeechRecognitionModule.requestPermissionsAsync === 'function' &&
    typeof ExpoSpeechRecognitionModule.start === 'function'
  )
} catch (error) {
  speechModuleAvailable = false
}

export default function VoiceEntry({ onAdd }) {
  const { colors } = useTheme()
  const { tr, lang } = useT()
  const styles = makeStyles(colors)
  const [listening, setListening] = useState(false)
  const [starting, setStarting] = useState(false)
  const [heard, setHeard] = useState(null)
  const [errorMsg, setErrorMsg] = useState(null)
  const [saving, setSaving] = useState(false)
  const resultReceived = useRef(false)
  const pulse = useRef(new Animated.Value(0)).current
  const bars = useRef([0, 1, 2, 3, 4].map(() => new Animated.Value(0.35))).current
  const [reduceMotion, setReduceMotion] = useState(false)

  useEffect(() => {
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then((value) => { if (alive) setReduceMotion(value) }).catch(() => {})
    return () => {
      alive = false
      pulse.stopAnimation()
      bars.forEach((value) => value.stopAnimation())
    }
  }, [pulse, bars])

  useEffect(() => {
    if (!listening || reduceMotion) {
      pulse.stopAnimation()
      pulse.setValue(0)
      bars.forEach((value) => { value.stopAnimation(); value.setValue(0.35) })
      return undefined
    }
    const ring = Animated.loop(Animated.sequence([
      Animated.timing(pulse, { toValue: 1, duration: 850, easing: Easing.out(Easing.ease), useNativeDriver: true }),
      Animated.timing(pulse, { toValue: 0, duration: 0, useNativeDriver: true })
    ]))
    ring.start()
    const loops = bars.map((value, index) => Animated.loop(Animated.sequence([
      Animated.timing(value, { toValue: 1, duration: 220 + index * 35, useNativeDriver: true }),
      Animated.timing(value, { toValue: 0.25, duration: 220 + index * 35, useNativeDriver: true })
    ])))
    loops.forEach((animation) => animation.start())
    return () => { ring.stop(); loops.forEach((animation) => animation.stop()) }
  }, [listening, reduceMotion, pulse, bars])

  useSpeechRecognitionEvent('start', () => { setStarting(false); setListening(true) })
  useSpeechRecognitionEvent('end', () => {
    setStarting(false)
    setListening(false)
    if (!resultReceived.current) setErrorMsg((current) => current || tr('speechNoSpeech'))
  })
  useSpeechRecognitionEvent('result', (event) => {
    const results = event?.results || event?.finalResults || []
    const transcript = results.find?.((result) => result?.transcript)?.transcript || results[0]?.transcript
    if (!transcript) return
    resultReceived.current = true
    const parsed = parseHindiSpeech(transcript)
    setHeard(parsed)
    setErrorMsg(parsed.name && parsed.amount ? null : tr('voiceParseFailed'))
  })
  useSpeechRecognitionEvent('error', (event) => {
    setStarting(false)
    setListening(false)
    const code = event?.error
    const message = code === 'not-allowed' ? tr('micPermission')
      : code === 'no-speech' || code === 'speech-timeout' ? tr('speechNoSpeech')
      : code === 'language-not-supported' ? tr('speechLanguageUnsupported')
      : code === 'network' ? tr('speechNetworkError')
      : tr('speechError')
    setErrorMsg(message)
  })

  async function toggleListening() {
    if (!speechModuleAvailable) {
      setErrorMsg(tr('voiceUnavailable'))
      return
    }
    if (listening || starting) {
      try { ExpoSpeechRecognitionModule.stop() } catch (error) { setListening(false); setStarting(false); setErrorMsg(tr('speechError')) }
      return
    }
    setErrorMsg(null)
    setHeard(null)
    resultReceived.current = false
    setStarting(true)
    try {
      const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync()
      if (!permission?.granted) {
        setStarting(false)
        setErrorMsg(tr('micPermission'))
        return
      }
      if (typeof ExpoSpeechRecognitionModule.isRecognitionAvailable === 'function' && !ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setStarting(false)
        setErrorMsg(tr('speechUnavailableOnDevice'))
        return
      }
      ExpoSpeechRecognitionModule.start({
        lang: lang === 'en' ? 'en-IN' : 'hi-IN',
        interimResults: false,
        maxAlternatives: 1,
        continuous: false,
        addsPunctuation: false
      })
    } catch (error) {
      setStarting(false)
      setListening(false)
      setErrorMsg(tr('speechStartFailed'))
    }
  }

  async function confirmAdd() {
    if (!heard?.name || !heard?.amount || saving) {
      setErrorMsg(tr('voiceParseFailed'))
      return
    }
    setSaving(true)
    try {
      const saved = await onAdd(heard.name, heard.amount, heard.type)
      if (saved) { setHeard(null); setErrorMsg(null) }
      else setErrorMsg(tr('speechSaveFailed'))
    } catch (error) {
      setErrorMsg(tr('speechSaveFailed'))
    } finally {
      setSaving(false)
    }
  }

  const busy = listening || starting
  return (
    <LinearGradient colors={colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[styles.card, shadow]}>
      <View style={styles.micWrap}>
        {listening && !reduceMotion ? <Animated.View pointerEvents="none" style={[styles.pulseRing, { opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.55, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.65] }) }] }]} /> : null}
        <TouchableOpacity style={[styles.micBtn, busy && styles.micBtnListening]} onPress={toggleListening} disabled={saving} accessibilityRole="button" accessibilityLabel={tr('micButton')} accessibilityState={{ busy }} hitSlop={10}>
          <Icon name={busy ? 'mic' : 'mic'} size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </View>
      {listening && !reduceMotion ? <View style={styles.waveform} accessibilityElementsHidden>{bars.slice(1, 4).map((bar, index) => <Animated.View key={index} style={[styles.waveBar, { transform: [{ scaleY: bar }] }]} />)}</View> : null}
      <Text style={styles.hint}>{starting ? tr('voiceStarting') : listening ? tr('voiceListening') : tr('voiceHint')}</Text>
      <Text style={styles.example}>{tr('voiceExample')}</Text>
      {starting ? <ActivityIndicator color="#FFFFFF" style={{ marginTop: 8 }} /> : null}
      {errorMsg ? <Text accessibilityRole="alert" style={styles.error}>{errorMsg}</Text> : null}
      {heard ? (
        <View style={styles.heardBox}>
          <Text style={styles.heardText}>{tr('voiceRecognized')}: {heard.rawText}</Text>
          <Text style={styles.parsedText}>{heard.name || '—'} · {heard.amount ? `₹${heard.amount}` : '—'} · {heard.type === 'udhar' ? tr('giveCredit') : tr('receivePayment')}</Text>
          <View style={styles.confirmRow}>
            <TouchableOpacity style={[styles.btnYes, (!heard.name || !heard.amount) && styles.btnDisabled]} onPress={confirmAdd} disabled={saving || !heard.name || !heard.amount}>
              {saving ? <ActivityIndicator color={colors.milkDark} /> : <Text style={styles.btnYesText}>{tr('correctAdd')}</Text>}
            </TouchableOpacity>
            <TouchableOpacity style={styles.btnNo} onPress={() => { setHeard(null); setErrorMsg(null) }} disabled={saving}>
              <Text style={styles.btnNoText}>{tr('cancel')}</Text>
            </TouchableOpacity>
          </View>
        </View>
      ) : null}
    </LinearGradient>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  card: { borderRadius: radius.lg, padding: 24, alignItems: 'center', marginBottom: 16 },
  micWrap: { width: 104, height: 94, alignItems: 'center', justifyContent: 'center' },
  pulseRing: { position: 'absolute', width: 84, height: 84, borderRadius: 42, borderWidth: 2, borderColor: '#D9A441' },
  waveform: { height: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, marginBottom: 8 },
  waveBar: { width: 4, height: 16, borderRadius: 2, backgroundColor: '#D9A441' },
  micBtn: { width: 84, height: 84, borderRadius: 42, borderWidth: 3, borderColor: 'rgba(255,255,255,0.5)', backgroundColor: 'rgba(255,255,255,0.12)', alignItems: 'center', justifyContent: 'center', marginBottom: 10 },
  micBtnListening: { backgroundColor: colors.alert, borderColor: '#FFFFFF' },
  hint: { color: '#FFF9EC', fontSize: 15, fontWeight: '600', textAlign: 'center' },
  example: { color: '#FFF9EC', opacity: 0.85, fontSize: 12, marginTop: 6, textAlign: 'center', lineHeight: 18 },
  error: { color: '#FFE1DB', fontSize: 12, marginTop: 10, textAlign: 'center', lineHeight: 18 },
  heardBox: { marginTop: 14, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: radius.md, padding: 14, width: '100%' },
  heardText: { color: '#FFF9EC', fontSize: 13, lineHeight: 19 },
  parsedText: { color: '#FFFFFF', fontWeight: '700', marginTop: 6, fontSize: 15 },
  confirmRow: { flexDirection: 'row', gap: 8, marginTop: 12 },
  btnYes: { flex: 1, backgroundColor: '#FFFFFF', padding: 12, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnDisabled: { opacity: 0.45 },
  btnYesText: { color: colors.milkDark, fontWeight: '700', textAlign: 'center' },
  btnNo: { flex: 1, backgroundColor: 'rgba(255,255,255,0.18)', padding: 12, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', minHeight: 44 },
  btnNoText: { color: '#FFFFFF', fontWeight: '700', textAlign: 'center' }
})
