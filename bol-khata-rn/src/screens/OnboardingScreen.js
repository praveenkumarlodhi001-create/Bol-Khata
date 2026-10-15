import { useEffect, useRef, useState } from 'react'
import { View, Text, Image, Animated, TouchableOpacity, StyleSheet, Easing } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import Button from '../components/ui/Button'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { BRAND_NAME } from '../config/brand'

// Pehli baar app kholne par: app icon ka animation popup, phir 3 chhoti slides (skip kar sakte hain), phir login/signup.
export default function OnboardingScreen({ onDone }) {
  const { colors } = useTheme()
  const { tr, lang, setLang } = useT()
  const styles = makeStyles(colors)
  const [slide, setSlide] = useState(-1) // -1 = icon popup
  const pop = useRef(new Animated.Value(0)).current
  const fade = useRef(new Animated.Value(1)).current

  useEffect(() => {
    Animated.sequence([
      Animated.spring(pop, { toValue: 1, friction: 5, tension: 70, useNativeDriver: true }),
      Animated.delay(900)
    ]).start(({ finished }) => { if (finished) go(0) })
    return () => { pop.stopAnimation(); fade.stopAnimation() }
  }, [])
  function go(n) {
    Animated.timing(fade, { toValue: 0, duration: 140, easing: Easing.out(Easing.quad), useNativeDriver: true }).start(() => {
      setSlide(n)
      Animated.timing(fade, { toValue: 1, duration: 220, useNativeDriver: true }).start()
    })
  }
  const slides = [
    { icon: '📒', title: tr('ob1Title'), text: tr('ob1Text') },
    { icon: '🧾', title: tr('ob2Title'), text: tr('ob2Text') },
    { icon: '💳', title: tr('ob3Title'), text: tr('ob3Text') }
  ]
  const s = slides[slide]
  return (
    <LinearGradient colors={colors.gradient} style={styles.root}>
      {slide === -1 ? (
        <Animated.View style={[styles.center, { opacity: pop, transform: [{ scale: pop.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }, { rotate: pop.interpolate({ inputRange: [0, 1], outputRange: ['-25deg', '0deg'] }) }] }]}>
          <Image source={require('../../assets/icon.png')} style={styles.icon} />
          <Text style={styles.brand}>{BRAND_NAME}</Text>
        </Animated.View>
      ) : (
        <Animated.View style={[styles.center, { opacity: fade }]}>
          <TouchableOpacity style={styles.lang} onPress={() => setLang(lang === 'hi' ? 'en' : 'hi')}><Text style={styles.langText}>{lang === 'hi' ? 'English' : 'हिन्दी'}</Text></TouchableOpacity>
          <Text style={styles.emoji}>{s.icon}</Text>
          <Text style={styles.title}>{s.title}</Text>
          <Text style={styles.text}>{s.text}</Text>
          <View style={styles.dots}>{slides.map((_, i) => <View key={i} style={[styles.dot, i === slide && styles.dotOn]} />)}</View>
          <View style={{ width: '100%', gap: 10 }}>
            <Button title={slide === slides.length - 1 ? tr('getStarted') : tr('next')} onPress={() => (slide === slides.length - 1 ? onDone() : go(slide + 1))} />
            {slide < slides.length - 1 ? <TouchableOpacity onPress={onDone}><Text style={styles.skip}>{tr('skip')}</Text></TouchableOpacity> : null}
          </View>
        </Animated.View>
      )}
    </LinearGradient>
  )
}
const makeStyles = (c) => StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 },
  icon: { width: 120, height: 120, borderRadius: 30 },
  brand: { color: '#fff', fontSize: 30, fontWeight: '800', marginTop: 18 },
  emoji: { fontSize: 72, marginBottom: 18 },
  title: { color: '#fff', fontSize: 24, fontWeight: '800', textAlign: 'center', marginBottom: 10 },
  text: { color: 'rgba(255,255,255,0.9)', fontSize: 15, lineHeight: 22, textAlign: 'center', marginBottom: 26 },
  dots: { flexDirection: 'row', gap: 8, marginBottom: 26 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotOn: { width: 22, backgroundColor: '#fff' },
  skip: { color: '#fff', textAlign: 'center', fontWeight: '700', padding: 8 },
  lang: { position: 'absolute', top: 54, right: 22, paddingVertical: 6, paddingHorizontal: 12, borderRadius: 16, backgroundColor: 'rgba(255,255,255,0.2)' },
  langText: { color: '#fff', fontWeight: '700' }
})
