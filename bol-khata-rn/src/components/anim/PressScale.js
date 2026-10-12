import { useEffect, useRef, useState } from 'react'
import { Animated, Pressable, AccessibilityInfo } from 'react-native'
import * as Haptics from 'expo-haptics'

export default function PressScale({ children, onPress, onPressIn, onPressOut, style, innerStyle, accessibilityRole = 'button', accessibilityLabel, hitSlop = 8, disabled = false, scaleTo = 0.96, accessibilityState }) {
  const scale = useRef(new Animated.Value(1)).current
  const [reduceMotion, setReduceMotion] = useState(false)
  useEffect(() => { let alive = true; AccessibilityInfo.isReduceMotionEnabled().then(v => { if (alive) setReduceMotion(v) }).catch(() => {}); const sub = AccessibilityInfo.addEventListener?.('reduceMotionChanged', setReduceMotion); return () => { alive = false; sub?.remove?.(); scale.stopAnimation() } }, [scale])
  const animate = (toValue) => { if (reduceMotion) { scale.setValue(1); return } Animated.spring(scale, { toValue, speed: 35, bounciness: 4, useNativeDriver: true }).start() }
  const pressIn = async (event) => { animate(scaleTo); try { await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light) } catch (_) {} onPressIn?.(event) }
  return <Animated.View style={[style, { transform: [{ scale }] }]}><Pressable style={innerStyle} onPress={onPress} disabled={disabled} hitSlop={hitSlop} accessibilityRole={accessibilityRole} accessibilityLabel={accessibilityLabel} accessibilityState={accessibilityState} onPressIn={pressIn} onPressOut={(e) => { animate(1); onPressOut?.(e) }}>{children}</Pressable></Animated.View>
}
