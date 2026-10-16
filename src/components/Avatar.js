import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { API_URL } from '../config'
import { photoCacheKey } from '../services/photoCache'
import { useTheme } from '../theme/ThemeContext'

export default function Avatar({ name = '', userId, hasPhoto = false, photoVersion = 0, size = 44, localUri, style }) {
  const { colors } = useTheme()
  const [cached, setCached] = useState(localUri || '')
  const [remoteFailed, setRemoteFailed] = useState(false)
  useEffect(() => {
    let active = true
    if (localUri) { setCached(localUri); return () => { active = false } }
    if (!userId) { setCached(''); return () => { active = false } }
    setCached('')
    setRemoteFailed(false)
    AsyncStorage.getItem(photoCacheKey(userId)).then((value) => { if (active && value) setCached(value) }).catch(() => {})
    return () => { active = false }
  }, [userId, localUri, photoVersion])
  const remote = hasPhoto && userId && API_URL && !remoteFailed ? `${API_URL}/api/auth/photo/${userId}?v=${photoVersion || 0}` : ''
  const initials = String(name || '').trim().split(/\s+/).slice(0, 2).map((part) => part[0] || '').join('').toUpperCase() || '?'
  const frame = [styles.frame, { width: size, height: size, borderRadius: size / 2, backgroundColor: colors.milkLight, borderColor: colors.line }, style]
  if (cached) return <View style={frame}><Image source={{ uri: cached }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => { if (remote) setCached('') }} /></View>
  if (remote) return <View style={frame}><Image source={{ uri: remote }} style={{ width: size, height: size, borderRadius: size / 2 }} onError={() => setRemoteFailed(true)} /></View>
  return <View style={[frame, { alignItems: 'center', justifyContent: 'center' }]}><Text style={{ color: colors.milkDark, fontSize: Math.max(12, size * 0.34), fontWeight: '800' }}>{initials}</Text></View>
}
const styles = StyleSheet.create({ frame: { overflow: 'hidden', borderWidth: 1, alignItems: 'center', justifyContent: 'center' } })
