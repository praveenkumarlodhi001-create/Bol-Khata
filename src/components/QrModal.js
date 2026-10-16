import { Modal, View, Text, TouchableOpacity, StyleSheet, Share } from 'react-native'
import QrView from './QrView'
import Button from './ui/Button'
import { radius } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { fmt } from '../utils/format'
import { upiUri } from '../utils/messages'

// Dukaan ka UPI QR dikhana aur share karna. amount > 0 ho to rakam bhi QR me jaati hai (grahak ke liye).
export default function QrModal({ visible, onClose, upiId, name, amount }) {
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const uri = upiId ? upiUri({ upiId, name, amount }) : ''
  return (
    <Modal visible={!!visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>{name || tr('shopQr')}</Text>
          {uri ? <View style={styles.qrBox}><QrView text={uri} size={240} /></View> : <Text style={styles.note}>{tr('noUpiYet')}</Text>}
          {upiId ? <Text style={styles.upi}>{upiId}</Text> : null}
          {amount > 0 ? <Text style={styles.amt}>{fmt(amount)}</Text> : null}
          <Text style={styles.note}>{tr('qrScanHelp')}</Text>
          {uri ? <Button title={tr('shareUpi')} variant="ghost" onPress={() => Share.share({ message: `${name ? name + '\n' : ''}UPI: ${upiId}${amount > 0 ? `\n${fmt(amount)}` : ''}\n${uri}` }).catch(() => {})} style={{ marginBottom: 8 }} /> : null}
          <TouchableOpacity onPress={onClose} style={styles.close}><Text style={styles.closeText}>{tr('close')}</Text></TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}
const makeStyles = (c) => StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 360, backgroundColor: c.panel, borderRadius: radius.lg, padding: 20, alignItems: 'stretch' },
  title: { fontSize: 18, fontWeight: '800', color: c.milkDark, textAlign: 'center', marginBottom: 14 },
  qrBox: { alignSelf: 'center', padding: 8, backgroundColor: '#fff', borderRadius: radius.md, borderWidth: 1, borderColor: c.line },
  upi: { textAlign: 'center', color: c.ink, fontWeight: '700', marginTop: 12 },
  amt: { textAlign: 'center', color: c.alert, fontWeight: '800', fontSize: 20, marginTop: 4 },
  note: { textAlign: 'center', color: c.inkSoft, fontSize: 12, marginVertical: 10, lineHeight: 18 },
  close: { alignItems: 'center', paddingVertical: 10 },
  closeText: { color: c.inkSoft, fontWeight: '700' }
})
