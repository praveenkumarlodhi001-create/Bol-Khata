import { Text, View, ActivityIndicator, StyleSheet } from 'react-native'
import Icon from '../Icon'
import { LinearGradient } from 'expo-linear-gradient'
import { radius } from '../../theme/colors'
import { useTheme, useThemedStyles } from '../../theme/ThemeContext'
import PressScale from '../anim/PressScale'

// variant: 'primary' (gradient) | 'ghost' (outline)   icon: Icon.js ka naam (optional)   tone: 'danger' = laal button
export default function Button({ title, onPress, loading, disabled, variant = 'primary', icon, tone, style }) {
  const { colors } = useTheme()
  const { styles } = useThemedStyles(makeStyles)
  const off = loading || disabled
  const danger = tone === 'danger'
  const accent = danger ? colors.alert : colors.milk
  if (variant === 'ghost') {
    return (
      <PressScale onPress={onPress} disabled={off} style={style} innerStyle={[styles.ghost, { borderColor: accent }, off && styles.off]} accessibilityLabel={title}
      >
        {loading ? (
          <ActivityIndicator color={accent} />
        ) : (
          <View style={styles.content}>
            {icon ? <Icon name={icon} size={20} color={accent} /> : null}
            <Text style={[styles.ghostText, { color: accent }]}>{title}</Text>
          </View>
        )}
      </PressScale>
    )
  }
  return (
    <PressScale onPress={onPress} disabled={off} style={style} innerStyle={off && styles.off} accessibilityLabel={title}>
      <LinearGradient colors={danger ? [colors.alert, '#A83A2D'] : colors.gradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.btn}>
        {loading ? <ActivityIndicator color="#fff" /> : (
          <View style={styles.content}>
            {icon ? <Icon name={icon} size={20} color="#FFFFFF" /> : null}
            <Text style={styles.text}>{title}</Text>
          </View>
        )}
      </LinearGradient>
    </PressScale>
  )
}

function makeStyles(colors) { return StyleSheet.create({
  btn: { height: 50, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  text: { color: '#fff', fontWeight: '700', fontSize: 16 },
  ghost: {
    height: 50,
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderColor: colors.milk,
    alignItems: 'center',
    justifyContent: 'center'
  },
  ghostText: { color: colors.milk, fontWeight: '700', fontSize: 15 },
  content: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  off: { opacity: 0.6 }
}) }
