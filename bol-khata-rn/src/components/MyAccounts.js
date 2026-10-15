import { useEffect, useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import Input from './ui/Input'
import Button from './ui/Button'
import TransactionHistory from './TransactionHistory'
import { radius, shadow } from '../theme/colors'
import { useThemedStyles } from '../theme/ThemeContext'
import Avatar from './Avatar'
import { fmt } from '../utils/format'
import { getMyAccounts, getMyHistory, linkByCode } from '../services/dataService'
import { useT } from '../i18n'
import { Linking } from 'react-native'
import QrModal from './QrModal'
import { upiUri } from '../utils/messages'
import { businessLabel } from '../data/catalog'

// Grahak ka view: "मेरे खाते" — अलग-अलग दुकानों में मेरा कितना बकाया है, और कोड से नया खाता जोड़ना.
export default function MyAccounts({ refreshKey, onToast }) {
  const { colors, styles } = useThemedStyles(makeStyles)
  const { tr, lang } = useT()
  const [qr, setQr] = useState(null)
  const [data, setData] = useState(null)
  const [error, setError] = useState('')
  const [code, setCode] = useState('')
  const [linking, setLinking] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [history, setHistory] = useState({})

  const load = useCallback(async () => {
    try {
      setError('')
      setData(await getMyAccounts())
    } catch (e) {
      setError(e.message || tr('accountsFailed'))
    }
  }, [])

  useEffect(() => {
    load()
  }, [load, refreshKey])

  async function link() {
    if (code.trim().length !== 6) return onToast(tr('codeInvalid'), 'err')
    setLinking(true)
    try {
      await linkByCode(code.trim())
      setCode('')
      onToast(tr('accountLinked'))
      await load()
    } catch (e) {
      onToast(e.message || tr('codeFailed'), 'err')
    }
    setLinking(false)
  }

  async function toggle(a) {
    if (openId === a.id) return setOpenId(null)
    setOpenId(a.id)
    setHistory((h) => ({ ...h, [a.id]: null }))
    try {
      const rows = await getMyHistory(a.id)
      setHistory((h) => ({ ...h, [a.id]: rows }))
    } catch (e) {
      setHistory((h) => ({ ...h, [a.id]: [] }))
    }
  }

  async function payUpi(a) {
    const uri = upiUri({ upiId: a.shopUpiId, name: a.shopName, amount: a.balance > 0 ? a.balance : 0 })
    try { await Linking.openURL(uri) } catch (e) { onToast(tr('noUpiApp'), 'err'); setQr(a) }
  }
  const accounts = data ? data.accounts : []
  const s = data ? data.summary : { owed: 0, paid: 0 }

  return (
    <View>
      <View style={[styles.linkBox, shadow]}>
        <Text style={styles.linkTitle}>{tr('linkCodeTitle')}</Text>
        <Input
          placeholder="e.g. K7M2QX"
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={6}
          value={code}
          onChangeText={setCode}
        />
        <Button title={tr('linkAccount')} icon="add" onPress={link} loading={linking} />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {data && (
        <View style={styles.sumRow}>
          <View style={[styles.sumBox, shadow]}>
            <Text style={styles.sumLabel}>{tr('iOwe')}</Text>
            <Text style={[styles.sumNum, { color: colors.alert }]}>{fmt(s.owed)}</Text>
          </View>
          <View style={[styles.sumBox, shadow]}>
            <Text style={styles.sumLabel}>{tr('iPaid')}</Text>
            <Text style={[styles.sumNum, { color: colors.milk }]}>{fmt(s.paid)}</Text>
          </View>
        </View>
      )}

      {data && accounts.length === 0 && (
        <Text style={styles.empty}>{tr('noAccounts')}</Text>
      )}

      {accounts.map((a) => {
        const owes = a.balance > 0
        return (
          <View key={a.id} style={[styles.card, shadow]}>
            <TouchableOpacity style={styles.row} onPress={() => toggle(a)} activeOpacity={0.7}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}><Avatar name={a.shopName} userId={a.shopOwnerId} hasPhoto={a.shopHasPhoto} photoVersion={a.shopPhotoVersion} size={34} /><Text style={styles.shop} numberOfLines={1}>{a.shopName}</Text></View>
                <Text style={styles.meta}>
                  {tr('given')} {fmt(a.given)} · {tr('received')} {fmt(a.paid)}
                </Text>
              </View>
              <Text style={[styles.bal, owes ? { color: colors.alert } : { color: colors.milk }]}>
                {owes ? `${fmt(a.balance)} ${tr('oweShort')}` : a.balance < 0 ? `${fmt(a.balance)} ${tr('overpaidShort')}` : tr('settled')}
              </Text>
            </TouchableOpacity>
            {openId === a.id && (
              <View style={{ marginTop: 10 }}>
                <View style={styles.shopBox}>
                  <Text style={styles.shopLine}>{a.shopName}{a.shopBusinessType ? ` · ${businessLabel(a.shopBusinessType, lang)}` : ''}</Text>
                  {a.shopPhone ? <TouchableOpacity onPress={() => Linking.openURL('tel:' + a.shopPhone).catch(() => {})}><Text style={styles.shopPhone}>📞 +91 {a.shopPhone}</Text></TouchableOpacity> : null}
                  {a.shopUpiId ? <Text style={styles.shopLine}>UPI: {a.shopUpiId}</Text> : <Text style={styles.meta}>{tr('shopNoUpi')}</Text>}
                  {a.shopUpiId ? (
                    <View style={{ flexDirection: 'row', gap: 10, marginTop: 10 }}>
                      <Button title={a.balance > 0 ? `${tr('payUpi')} ${fmt(a.balance)}` : tr('payUpi')} onPress={() => payUpi(a)} style={{ flex: 1 }} />
                      <Button title={tr('showQr')} variant="ghost" onPress={() => setQr(a)} style={{ flex: 1 }} />
                    </View>
                  ) : null}
                </View>
                <TransactionHistory items={history[a.id]} />
              </View>
            )}
          </View>
        )
      })}
      <QrModal visible={!!qr} onClose={() => setQr(null)} upiId={qr && qr.shopUpiId} name={qr && qr.shopName} amount={qr && qr.balance > 0 ? qr.balance : 0} />
    </View>
  )
}

function makeStyles(colors) { return StyleSheet.create({
  linkBox: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 16, marginBottom: 18 },
  linkTitle: { fontWeight: '700', color: colors.milkDark, marginBottom: 10 },
  error: { backgroundColor: colors.alertLight, color: colors.alert, padding: 12, borderRadius: radius.md, fontSize: 13, marginBottom: 14 },
  sumRow: { flexDirection: 'row', gap: 12, marginBottom: 16 },
  sumBox: { flex: 1, backgroundColor: colors.panel, borderRadius: radius.md, padding: 14 },
  sumLabel: { fontSize: 12, color: colors.inkSoft, fontWeight: '600' },
  sumNum: { fontSize: 22, fontWeight: '800', marginTop: 4 },
  empty: { textAlign: 'center', color: colors.inkSoft, fontSize: 13, lineHeight: 20, paddingVertical: 20 },
  card: { backgroundColor: colors.panel, borderRadius: radius.md, padding: 14, marginBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  shop: { fontWeight: '700', color: colors.ink, fontSize: 15, flexShrink: 1 },
  meta: { fontSize: 11, color: colors.inkSoft, marginTop: 2 },
  shopBox: { backgroundColor: colors.bg, borderRadius: radius.md, padding: 12, marginBottom: 8 },
  shopLine: { color: colors.ink, fontSize: 13, fontWeight: '600', marginBottom: 3 },
  shopPhone: { color: colors.milk, fontSize: 13, fontWeight: '700', marginBottom: 3 },
  bal: { fontWeight: '800', fontSize: 13 }
}) }
