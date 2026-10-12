import { useEffect, useRef, useState } from 'react'
import { Animated, Easing } from 'react-native'

export default function AnimatedNumber({ value = 0, format = v => String(Math.round(v)), style, duration = 450 }) {
  const progress = useRef(new Animated.Value(0)).current
  const previous = useRef(Number(value) || 0)
  const [shown, setShown] = useState(Number(value) || 0)
  useEffect(() => {
    const from = previous.current; const to = Number(value) || 0
    progress.setValue(0)
    const id = progress.addListener(({ value: p }) => setShown(from + (to - from) * p))
    Animated.timing(progress, { toValue: 1, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start(({ finished }) => { if (finished) { previous.current = to; setShown(to) } })
    return () => { progress.removeListener(id); progress.stopAnimation() }
  }, [value, duration, progress])
  return <Animated.Text style={style}>{format(shown)}</Animated.Text>
}
