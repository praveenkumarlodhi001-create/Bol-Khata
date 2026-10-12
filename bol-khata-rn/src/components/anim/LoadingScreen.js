import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Image, StyleSheet, Text, View } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { BRAND_NAME } from '../../config/brand'
import { useT } from '../../i18n'

export default function LoadingScreen({ dark = false }) {
  const { tr } = useT()
  const logo = useRef(new Animated.Value(0)).current
  const title = useRef(new Animated.Value(0)).current
  const tagline = useRef(new Animated.Value(0)).current
  const dots = useRef(new Animated.Value(0)).current
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setSlow(true), 5000)
    let alive = true
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!alive) return
      if (reduce) {
        Animated.parallel([Animated.timing(logo, { toValue: 1, duration: 140, useNativeDriver: true }), Animated.timing(title, { toValue: 1, duration: 180, useNativeDriver: true }), Animated.timing(tagline, { toValue: 1, duration: 180, useNativeDriver: true })]).start()
      } else {
        Animated.sequence([
          Animated.spring(logo, { toValue: 1, speed: 13, bounciness: 8, useNativeDriver: true }),
          Animated.timing(title, { toValue: 1, duration: 260, useNativeDriver: true }),
          Animated.timing(tagline, { toValue: 1, duration: 240, useNativeDriver: true })
        ]).start()
      }
      Animated.loop(Animated.sequence([Animated.timing(dots, { toValue: 1, duration: 500, useNativeDriver: true }), Animated.timing(dots, { toValue: 0, duration: 500, useNativeDriver: true })])).start()
    }).catch(() => Animated.timing(logo, { toValue: 1, duration: 180, useNativeDriver: true }).start())
    return () => { alive = false; clearTimeout(timer); [logo, title, tagline, dots].forEach(v => v.stopAnimation()) }
  }, [logo, title, tagline, dots])
  return <LinearGradient colors={dark ? ['#102B25', '#1F4D41'] : ['#2E6E5E', '#1F4D41']} style={styles.root}>
    <Animated.View style={{ opacity: logo, transform: [{ scale: logo.interpolate({ inputRange: [0, 1], outputRange: [0.72, 1] }) }, { translateY: logo.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] }}>
      <Image source={require('../../../assets/splash-icon.png')} style={styles.logo} resizeMode="contain" />
    </Animated.View>
    <Animated.View style={{ opacity: title, transform: [{ translateY: title.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}><Text style={styles.title}>{BRAND_NAME}</Text></Animated.View>
    <Animated.Text style={[styles.tagline, { opacity: tagline }]}>{tr('appTagline')}</Animated.Text>
    <Animated.View style={[styles.dots, { opacity: dots.interpolate({ inputRange: [0, 1], outputRange: [0.45, 1] }) }]}><Text style={styles.dotText}>●  ●  ●</Text></Animated.View>
    {slow ? <Text style={styles.waking}>{tr('serverWaking')}</Text> : null}
  </LinearGradient>
}
const styles = StyleSheet.create({ root: { flex: 1, alignItems: 'center', justifyContent: 'center' }, logo: { width: 190, height: 190 }, title: { color: '#FFFFFF', fontSize: 32, fontWeight: '800', marginTop: 16, letterSpacing: 0.2 }, tagline: { color: '#E1F0E9', fontSize: 15, marginTop: 8 }, dots: { marginTop: 30 }, dotText: { color: '#D9A441', fontSize: 14, letterSpacing: 4 }, waking: { color: '#FFFFFF', fontSize: 13, marginTop: 24, opacity: 0.9 } })
