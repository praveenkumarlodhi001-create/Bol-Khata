import { useState } from 'react'
import { View, Text, TextInput, StyleSheet } from 'react-native'
import { radius } from '../../theme/colors'
import { useThemedStyles } from '../../theme/ThemeContext'

export default function Input({ label, error, prefix, style, ...props }) {
  const [focused, setFocused] = useState(false)
  const { colors, styles } = useThemedStyles(makeStyles)
  return (
    <View style={[styles.wrap, style]}>
      {label ? <Text style={styles.label}>{label}</Text> : null}
      <View
        style={[
          styles.box,
          focused && styles.focused,
          error && styles.errorBox
        ]}
      >
        {prefix ? <Text style={styles.prefix}>{prefix}</Text> : null}
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.inkSoft}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          {...props}
        />
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
    </View>
  )
}

function makeStyles(colors) { return StyleSheet.create({
  wrap: { marginBottom: 14 },
  label: { fontSize: 13, fontWeight: '600', color: colors.ink, marginBottom: 6 },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 50,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    backgroundColor: colors.panel,
    paddingHorizontal: 14
  },
  focused: { borderColor: colors.milk, backgroundColor: colors.panel },
  errorBox: { borderColor: colors.alert, backgroundColor: colors.alertLight },
  prefix: { color: colors.ink, fontWeight: '600', marginRight: 8 },
  input: { flex: 1, color: colors.ink, fontSize: 15 },
  error: { color: colors.alert, fontSize: 12, marginTop: 5 }
}) }
