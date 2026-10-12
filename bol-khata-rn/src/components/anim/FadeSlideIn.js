import { useEffect, useRef } from 'react'
import { Animated, AccessibilityInfo } from 'react-native'

export default function FadeSlideIn({ children, delay = 0, style, distance = 12, duration = 260 }) {
  const progress = useRef(new Animated.Value(0)).current
  useEffect(() => {
    let active = true
    AccessibilityInfo.isReduceMotionEnabled().then(reduce => {
      if (!active) return
      Animated.timing(progress, { toValue: 1, delay: reduce ? 0 : delay, duration: reduce ? 100 : duration, useNativeDriver: true }).start()
    }).catch(() => Animated.timing(progress, { toValue: 1, delay, duration, useNativeDriver: true }).start())
    return () => { active = false; progress.stopAnimation() }
  }, [delay, duration, progress])
  return <Animated.View style={[style, { opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }) }] }]}>{children}</Animated.View>
}
