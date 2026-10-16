import Icon from './Icon'
import { useState } from 'react'
import { View, Text, TextInput, TouchableOpacity, Share, StyleSheet } from 'react-native'
import Button from './ui/Button'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { getBackup, restoreBackup } from '../services/dataService'
import { useT } from '../i18n'

import { BRAND_NAME } from '../config/brand'
// Backup = poora khata ek chhote text (JSON) me. Share list se WhatsApp ("खुद को"), Gmail, Drive, Notes —
// kahin bhi save kar lo. Naye phone par yahin paste karke wapas laao.
export default function BackupCard({ onData, onToast }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [open, setOpen] = useState(false)
  const [pasting, setPasting] = useState(false)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)

  async function doBackup() {
    setBusy(true)
    try {
      const data = await getBackup()
      if (!data.c.length) return onToast(tr('backupEmpty'), 'err')
      await Share.share({ title: `${BRAND_NAME} backup`, message: JSON.stringify(data) })
    } catch (e) {
      onToast(e.message || tr('backupFailed'), 'err')
    } finally {
      setBusy(false)
    }
  }

  async function doRestore() {
    // paste ke saath aaya extra text (jaise "Sent from…") hata kar sirf { … } lo
    const from = text.indexOf('{')
    const to = text.lastIndexOf('}')
    let backup
    try {
      backup = JSON.parse(text.slice(from, to + 1))
    } catch (e) {
      return onToast(tr('backupInvalid'), 'err')
    }
    setBusy(true)
    try {
      const r = await restoreBackup(backup)
      onData(r)
      onToast(tr('restoreSuccess', { count: r.added }) + (r.skipped ? ` (${r.skipped} skipped)` : ''))
      setText('')
      setPasting(false)
    } catch (e) {
      onToast(e.message || tr('restoreFailed'), 'err')
    } finally {
      setBusy(false)
    }
  }

  return (
    <View style={{ marginTop: 18 }}>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.toggle} activeOpacity={0.7}>
        <Icon name={open ? 'close' : 'save-outline'} size={18} color={colors.milk}/><Text style={styles.toggleText}>{open ? tr('backupToggleClose') : tr('backupToggle')}</Text>
      </TouchableOpacity>

      {open && (
        <View style={[styles.box, shadow]}>
          <Text style={styles.help}>
            {tr('backupHelp')}
          </Text>
          <Button title={tr('backupSend')} icon="save-outline" onPress={doBackup} loading={busy && !pasting} />
          <View style={{ height: 10 }} />
          {!pasting ? (
            <Button title={tr('backupRestore')} variant="ghost" onPress={() => setPasting(true)} />
          ) : (
            <>
              <TextInput
                style={styles.paste}
                multiline
                placeholder={tr('backupPaste')}
                placeholderTextColor={colors.inkSoft}
                value={text}
                onChangeText={setText}
                autoCorrect={false}
                autoCapitalize="none"
              />
              <Text style={styles.small}>{tr('backupDuplicates')}</Text>
              <View style={styles.two}>
                <Button title={tr('cancelAction')} variant="ghost" onPress={() => { setPasting(false); setText('') }} style={{ flex: 1 }} />
                <Button title={tr('restoreAction')} onPress={doRestore} loading={busy} disabled={!text.trim()} style={{ flex: 1 }} />
              </View>
            </>
          )}
        </View>
      )}
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  toggle: { alignItems: 'center', paddingVertical: 4 },
  toggleText: { color: colors.milk, fontSize: 14, fontWeight: '600' },
  box: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 16, marginTop: 6 },
  help: { color: colors.inkSoft, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  paste: {
    minHeight: 90,
    maxHeight: 160,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    padding: 12,
    color: colors.ink,
    fontSize: 12,
    textAlignVertical: 'top',
    backgroundColor: '#FBFCFB'
  },
  small: { color: colors.inkSoft, fontSize: 11, marginVertical: 8 },
  two: { flexDirection: 'row', gap: 10 }
})
