import { useEffect, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, View } from 'react-native'
import { useTheme } from '../../theme/ThemeContext'

export default function Skeleton({ style }) {
  const { colors } = useTheme()
  const opacity = useRef(new Animated.Value(0.45)).current
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => { let alive = true; AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduceMotion(v) }).catch(() => {}); return () => { alive = false; opacity.stopAnimation() } }, [opacity])
  useEffect(() => { if (reduceMotion) { opacity.setValue(0.6); return } const loop = Animated.loop(Animated.sequence([Animated.timing(opacity,{toValue:0.85,duration:650,useNativeDriver:true}),Animated.timing(opacity,{toValue:0.45,duration:650,useNativeDriver:true})])); loop.start(); return () => loop.stop() }, [reduceMotion, opacity])
  return <Animated.View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[{ height: 78, borderRadius: 14, marginBottom: 10, backgroundColor: colors.panel, borderColor: colors.line, borderWidth: 1, opacity }, style]}><View style={{ height: 12, width: '42%', borderRadius: 6, backgroundColor: colors.line, margin: 14 }} /><View style={{ height: 8, width: '65%', borderRadius: 4, backgroundColor: colors.line, marginHorizontal: 14 }} /></Animated.View>
}
