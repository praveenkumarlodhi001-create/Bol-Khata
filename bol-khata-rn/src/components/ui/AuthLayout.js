import { View, Text, ScrollView, KeyboardAvoidingView, Platform, StyleSheet } from 'react-native'
import { LinearGradient } from 'expo-linear-gradient'
import { Image } from 'react-native'
import { radius, shadow } from '../../theme/colors'
import { useTheme, useThemedStyles } from '../../theme/ThemeContext'
import { useT } from '../../i18n'

import { BRAND_NAME } from '../../config/brand'
// Upar gradient header, neeche card — Login/Signup/Verify teeno me same
export default function AuthLayout({ title, subtitle, children, footer }) {
  const { colors } = useTheme()
  const { styles } = useThemedStyles(makeStyles)
  const { tr } = useT()
  return (
    <KeyboardAvoidingView
      style={[{ flex: 1, backgroundColor: colors.bg }, styles.root]}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
        <LinearGradient colors={colors.gradient} style={styles.header}>
          <Image source={require('../../../assets/icon.png')} style={styles.logo} resizeMode="cover" />
          <Text style={styles.brand}>{BRAND_NAME}</Text>
          <Text style={styles.tag}>{tr('appTagline')}</Text>
        </LinearGradient>

        <View style={[styles.card, shadow]}>
          <Text style={styles.title}>{title}</Text>
          {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
          {children}
        </View>

        {footer ? <View style={styles.footer}>{footer}</View> : null}
      </ScrollView>
    </KeyboardAvoidingView>
  )
}

function makeStyles(colors) { return StyleSheet.create({
  root: { backgroundColor: colors.bg },
  header: { paddingTop: 70, paddingBottom: 90, alignItems: 'center', borderBottomLeftRadius: 32, borderBottomRightRadius: 32 },
  logo: { width: 64, height: 64, borderRadius: 18 },
  brand: { color: '#fff', fontSize: 26, fontWeight: '800', marginTop: 8 },
  tag: { color: '#E1F0E9', fontSize: 13, marginTop: 2 },
  card: { backgroundColor: colors.panel, marginHorizontal: 20, marginTop: -56, borderRadius: radius.lg, padding: 22, borderColor: colors.line, borderWidth: 1 },
  title: { fontSize: 22, fontWeight: '800', color: colors.ink },
  subtitle: { fontSize: 13, color: colors.inkSoft, marginTop: 4, marginBottom: 18 },
  footer: { alignItems: 'center', paddingVertical: 22 }
}) }
