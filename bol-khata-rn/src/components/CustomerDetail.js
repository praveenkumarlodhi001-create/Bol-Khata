import Icon from './Icon'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { Modal, ScrollView, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import Input from './ui/Input'
import Button from './ui/Button'
import { usePopup, PopupHost } from './Popup'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import { useT } from '../i18n'
import { fmt, fmtDate } from '../utils/format'
import { reminderText, statementText, sendWhatsApp, sendSms, shareText } from '../utils/messages'
import { getHistory, editTransaction, deleteTransaction, editCustomer } from '../services/dataService'

import { BRAND_NAME } from '../config/brand'
const RANGES = [
  { key: 'all', label: 'सब', days: 0 },
  { key: 'today', label: 'आज', days: 1 },
  { key: '7', label: '7 दिन', days: 7 },
  { key: '30', label: '30 दिन', days: 30 }
]
const RANGE_NAME = { all: 'सब', today: 'आज', 7: 'पिछले 7 दिन', 30: 'पिछले 30 दिन' }

// "आज" = आज रात 12 बजे से; "7 दिन" = आज समेत 7 दिन
function sinceOf(days) {
  const d = new Date()
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() - (days - 1))
  return d.getTime()
}

// customer = server ka customer object (balance etc.), onData(naya {customers, summary}) se list ताज़ा होती है
export default function CustomerDetail({ customer, shopName, upiId, onClose, onData, onDelete }) {
  const popup = usePopup()
  const { colors } = useTheme()
  const { tr } = useT()
  const styles = makeStyles(colors)
  const [rows, setRows] = useState(null)
  const [range, setRange] = useState('all')
  const [msg, setMsg] = useState('')
  const [editEntry, setEditEntry] = useState(null) // { id, amount, reason, type }
  const [editCust, setEditCust] = useState(null) // { name, phone }
  const [editDaily, setEditDaily] = useState(null) // { amount, reason } — roz ki fixed entry
  const [busy, setBusy] = useState(false)

  const id = customer && customer.id
  const custName = customer && customer.name

  const load = useCallback(async () => {
    try {
      setRows(await getHistory(id, custName))
    } catch (e) {
      setRows([])
      setMsg(e.message || tr('historyLoadFailed'))
    }
  }, [id, custName, tr])

  useEffect(() => {
    setRows(null)
    setRange('all')
    setEditEntry(null)
    setEditCust(null)
    setEditDaily(null)
    setMsg('')
    if (id) load()
  }, [id, load])

  const shown = useMemo(() => {
    if (!rows) return null
    const r = RANGES.find((x) => x.key === range)
    if (!r.days) return rows
    const since = sinceOf(r.days)
    return rows.filter((t) => new Date(t.at).getTime() >= since)
  }, [rows, range])

  if (!customer) return null
  const c = customer
  const isOwe = c.balance > 0
  const isClear = c.balance < 0
  const balText = isOwe ? `${fmt(c.balance)} देना है` : isClear ? `${fmt(c.balance)} ज़्यादा दिया` : 'हिसाब बराबर'

  const rangeGiven = (shown || []).filter((t) => t.type === 'udhar').reduce((s, t) => s + t.amount, 0)
  const rangePaid = (shown || []).filter((t) => t.type === 'payment').reduce((s, t) => s + t.amount, 0)

  async function run(fn, okMsg) {
    setBusy(true)
    setMsg('')
    try {
      const data = await fn()
      if (data) onData(data)
      if (okMsg) setMsg(okMsg)
      return true
    } catch (e) {
      setMsg(e.message || tr('genericError'))
      return false
    } finally {
      setBusy(false)
    }
  }

  function remind(kind) {
    if (!(c.balance > 0)) return setMsg('इस ग्राहक का कोई बकाया नहीं है।')
    const text = reminderText(shopName, c, upiId)
    if (!c.phone) setMsg('मोबाइल नंबर जोड़ दो तो सीधे उसी को जाएगा; अभी share list खुलेगी।')
    ;(kind === 'wa' ? sendWhatsApp(c.phone, text) : sendSms(c.phone, text)).catch(() => {})
  }

  async function openEntry(t) {
    if (t.pending) return setMsg('ये entry अभी phone में है — server पर पहुँचने के बाद बदल या हटा पाओगे।')
    const udhar = t.type === 'udhar'
    const pick = await popup.choose({
      tone: udhar ? 'danger' : 'success',
      icon: udhar ? 'add-circle-outline' : 'checkmark-circle',
      title: `${udhar ? '+' : '−'}${fmt(t.amount)}`,
      message: t.reason || (udhar ? 'उधार' : 'पैसे मिले'),
      options: [
        { key: 'edit', label: 'बदलो', icon: 'create-outline' },
        { key: 'delete', label: 'हटाओ', icon: 'trash', tone: 'danger' }
      ],
      cancelText: 'रद्द करो'
    })
    if (pick === 'edit') {
      setEditEntry({ id: t.id, amount: String(t.amount), reason: t.reason, type: t.type })
    } else if (pick === 'delete') {
      const ok = await popup.confirm({
        tone: 'danger',
        icon: 'trash',
        title: 'Entry हटाओ',
        message: 'ये entry हमेशा के लिए हट जाएगी।',
        confirmText: 'हटाओ',
        cancelText: 'रद्द करो'
      })
      if (ok && (await run(() => deleteTransaction(t.id), 'Entry हट गई'))) load()
    }
  }

  async function saveEntry() {
    const amt = parseFloat(editEntry.amount)
    if (isNaN(amt) || amt <= 0) return setMsg('सही रकम डालो।')
    const ok = await run(
      () => editTransaction(editEntry.id, { amount: amt, reason: editEntry.reason.trim(), type: editEntry.type }),
      'Entry बदल गई'
    )
    if (ok) {
      setEditEntry(null)
      load()
    }
  }

  async function saveCustomer() {
    const name = editCust.name.trim()
    const phone = editCust.phone.trim()
    if (!name) return setMsg('ग्राहक का नाम डालो।')
    if (phone && !/^[6-9]\d{9}$/.test(phone)) return setMsg('10 अंक का सही मोबाइल नंबर डालो।')
    const ok = await run(() => editCustomer(c.id, { name, phone }), 'ग्राहक की जानकारी बदल गई')
    if (ok) setEditCust(null)
  }

  async function saveDaily() {
    const amt = parseFloat(editDaily.amount)
    if (isNaN(amt) || amt <= 0) return setMsg('रोज़ की सही रकम डालो।')
    const ok = await run(() => editCustomer(c.id, { daily: { amount: amt, reason: editDaily.reason.trim() } }), 'रोज़ की entry सेट हो गई')
    if (ok) setEditDaily(null)
  }

  async function clearDaily() {
    const ok = await run(() => editCustomer(c.id, { daily: null }), 'रोज़ की entry बंद कर दी')
    if (ok) setEditDaily(null)
  }

  async function confirmDelete() {
    const ok = await popup.confirm({
      tone: 'danger',
      icon: 'trash',
      title: 'ग्राहक हटाओ',
      message: `${c.name} और उसकी सारी entries हमेशा के लिए हट जाएँगी।`,
      confirmText: 'हटाओ',
      cancelText: 'रद्द करो'
    })
    if (ok) onDelete(c.id)
  }

  return (
    <Modal visible animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={styles.safe}>
        <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
          <View style={styles.top}>
            <TouchableOpacity onPress={onClose} style={styles.back} activeOpacity={0.7}>
              <Text style={styles.backText}>← वापस</Text>
            </TouchableOpacity>
          </View>

          <View style={[styles.head, shadow]}>
            <View style={{flexDirection:'row',alignItems:'center',gap:5}}><Text style={styles.name}>{c.name}</Text>{c.linked ? <Icon name="checkmark-circle" size={16} color={colors.milk}/> : null}</View>
            <Text style={styles.phone}>{c.phone ? `${c.phone}` : 'मोबाइल नंबर जुड़ा नहीं है'}</Text>
            <Text style={[styles.bal, isOwe && { color: colors.alert }, isClear && { color: colors.milk }]}>{balText}</Text>
            <Text style={styles.sub}>
              उधार {fmt(c.given)} · चुकाया {fmt(c.paid)} · {c.count} entry
            </Text>
            {c.daily ? (
              <Text style={styles.sub}>
                रोज़: {fmt(c.daily.amount)}{c.daily.reason ? ` · ${c.daily.reason}` : ''}
              </Text>
            ) : null}
          </View>

          {msg ? <Text style={[styles.msg, !!msg.startsWith('त्रुटि') && styles.msgErr]}>{msg}</Text> : null}

          <View style={styles.actions}>
            <TouchableOpacity style={styles.act} onPress={() => remind('wa')} activeOpacity={0.8}>
              <Text style={styles.actText}>WhatsApp याद दिलाओ</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.act} onPress={() => remind('sms')} activeOpacity={0.8}>
              <Text style={styles.actText}>✉️ SMS भेजो</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.act}
              onPress={() => shareText(statementText(shopName, c, shown || [], RANGE_NAME[range])).catch(() => {})}
              activeOpacity={0.8}
            >
              <Text style={styles.actText}>📤 हिसाब share करो</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.act}
              onPress={() => setEditCust({ name: c.name, phone: c.phone || '' })}
              activeOpacity={0.8}
            >
              <Text style={styles.actText}>नाम / मोबाइल बदलो</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.act}
              onPress={() => setEditDaily({ amount: c.daily ? String(c.daily.amount) : '', reason: c.daily ? c.daily.reason : '' })}
              activeOpacity={0.8}
            >
              <Text style={styles.actText}>रोज़ की entry {c.daily ? 'बदलो' : 'सेट करो'}</Text>
            </TouchableOpacity>
          </View>

          {editCust && (
            <View style={[styles.form, shadow]}>
              <Input label="ग्राहक का नाम" value={editCust.name} onChangeText={(v) => setEditCust({ ...editCust, name: v })} maxLength={60} />
              <Input
                label="मोबाइल (खाली छोड़ो तो हट जाएगा)"
                keyboardType="phone-pad"
                maxLength={10}
                value={editCust.phone}
                onChangeText={(v) => setEditCust({ ...editCust, phone: v })}
              />
              <View style={styles.twoBtns}>
                <Button title="रद्द" variant="ghost" onPress={() => setEditCust(null)} style={{ flex: 1 }} />
                <Button title="सेव करो" icon="checkmark" onPress={saveCustomer} loading={busy} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          {editDaily && (
            <View style={[styles.form, shadow]}>
              <Text style={styles.sub}>जैसे दूधवाले के लिए: रोज़ 2 लीटर, ₹120। होम स्क्रीन पर एक tap में सबकी आज की entry लगेगी।</Text>
              <Input
                label="रोज़ की रकम"
                prefix="₹"
                keyboardType="numeric"
                value={editDaily.amount}
                onChangeText={(v) => setEditDaily({ ...editDaily, amount: v })}
              />
              <Input
                label="वजह (ज़रूरी नहीं)"
                placeholder="जैसे: दूध 2 लीटर"
                value={editDaily.reason}
                onChangeText={(v) => setEditDaily({ ...editDaily, reason: v })}
                maxLength={60}
              />
              <View style={styles.twoBtns}>
                <Button title="रद्द" variant="ghost" onPress={() => setEditDaily(null)} style={{ flex: 1 }} />
                <Button title="सेव करो" icon="checkmark" onPress={saveDaily} loading={busy} style={{ flex: 1 }} />
              </View>
              {c.daily ? <Button title="रोज़ की entry बंद करो" variant="ghost" onPress={clearDaily} style={{ marginTop: 10 }} /> : null}
            </View>
          )}

          <Text style={styles.sec}>Entries</Text>
          <View style={styles.chips}>
            {RANGES.map((r) => (
              <TouchableOpacity
                key={r.key}
                style={[styles.chip, range === r.key && styles.chipOn]}
                onPress={() => setRange(r.key)}
                activeOpacity={0.8}
              >
                <Text style={[styles.chipText, range === r.key && styles.chipTextOn]}>{r.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {range !== 'all' && shown ? (
            <Text style={styles.rangeSum}>
              {RANGE_NAME[range]}: उधार {fmt(rangeGiven)} · चुकाया {fmt(rangePaid)}
            </Text>
          ) : null}

          {editEntry && (
            <View style={[styles.form, shadow]}>
              <Input
                label="रुपये"
                prefix="₹"
                keyboardType="numeric"
                value={editEntry.amount}
                onChangeText={(v) => setEditEntry({ ...editEntry, amount: v })}
              />
              <View style={styles.typeRow}>
                <TouchableOpacity
                  style={[styles.typeBtn, editEntry.type === 'udhar' && styles.typeOwe]}
                  onPress={() => setEditEntry({ ...editEntry, type: 'udhar' })}
                >
                  <Text style={editEntry.type === 'udhar' ? styles.typeOn : styles.typeOff}>उधार दिया</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.typeBtn, editEntry.type === 'payment' && styles.typePaid]}
                  onPress={() => setEditEntry({ ...editEntry, type: 'payment' })}
                >
                  <Text style={editEntry.type === 'payment' ? styles.typeOn : styles.typeOff}>पैसे लिए</Text>
                </TouchableOpacity>
              </View>
              <Input
                label="वजह (ज़रूरी नहीं)"
                value={editEntry.reason}
                onChangeText={(v) => setEditEntry({ ...editEntry, reason: v })}
                maxLength={60}
              />
              <View style={styles.twoBtns}>
                <Button title="रद्द" variant="ghost" onPress={() => setEditEntry(null)} style={{ flex: 1 }} />
                <Button title="सेव करो" icon="checkmark" onPress={saveEntry} loading={busy} style={{ flex: 1 }} />
              </View>
            </View>
          )}

          <View style={[styles.list, shadow]}>
            {!shown ? (
              <Text style={styles.note}>लोड हो रहा है…</Text>
            ) : shown.length === 0 ? (
              <Text style={styles.note}>इस अवधि में कोई entry नहीं।</Text>
            ) : (
              shown.map((t, i) => {
                const udhar = t.type === 'udhar'
                return (
                  <TouchableOpacity
                    key={t.id}
                    style={[styles.entry, i > 0 && styles.entryLine]}
                    onPress={() => openEntry(t)}
                    activeOpacity={0.6}
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.reason} numberOfLines={2}>
                        {t.reason || (udhar ? 'उधार (वजह नहीं लिखी)' : 'पैसे मिले (वजह नहीं लिखी)')}
                      </Text>
                      <Text style={styles.date}>
                        {t.pending ? 'भेजना बाकी · ' : ''}{udhar ? 'उधार दिया' : 'पैसे लिए'} · {fmtDate(t.at)}
                      </Text>
                    </View>
                    <Text style={[styles.amt, udhar ? { color: colors.alert } : { color: colors.milk }]}>
                      {udhar ? '+' : '−'}
                      {fmt(t.amount)}
                    </Text>
                  </TouchableOpacity>
                )
              })
            )}
          </View>
          <Text style={styles.hint}>किसी entry पर दबाओ — बदल या हटा सकते हो।</Text>

          <View style={styles.bottom}>
            <TouchableOpacity
              style={styles.act}
              onPress={() =>
                shareText(
                  `${shopName || 'हमारी दुकान'} के "${BRAND_NAME}" app में अपना हिसाब देखो।\n` +
                    `App खोलकर Login करो और ये कोड डालो: ${c.inviteCode}`
                ).catch(() => {})
              }
              activeOpacity={0.8}
            >
              <Text style={styles.actText}>{c.linked ? 'Account जुड़ा है' : `कोड ${c.inviteCode} भेजो`}</Text>
            </TouchableOpacity>
            <TouchableOpacity style={[styles.act, styles.del]} onPress={confirmDelete} activeOpacity={0.8}>
              <Text style={[styles.actText, { color: colors.alert }]}>🗑 ग्राहक हटाओ</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
        <PopupHost />
      </SafeAreaView>
    </Modal>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  wrap: { padding: 18, paddingBottom: 50 },
  top: { marginBottom: 10 },
  back: { alignSelf: 'flex-start', paddingVertical: 6 },
  backText: { color: colors.milk, fontWeight: '700', fontSize: 15 },
  head: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 18, marginBottom: 12 },
  name: { fontSize: 22, fontWeight: '800', color: colors.milkDark },
  phone: { color: colors.inkSoft, fontSize: 13, marginTop: 4 },
  bal: { fontSize: 20, fontWeight: '800', color: colors.inkSoft, marginTop: 10 },
  sub: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },
  msg: { backgroundColor: colors.milkLight, color: colors.milkDark, padding: 10, borderRadius: radius.sm, fontSize: 13, marginBottom: 12 },
  msgErr: { backgroundColor: colors.alertLight, color: colors.alert },
  actions: { gap: 8, marginBottom: 14 },
  act: { backgroundColor: colors.milkLight, paddingVertical: 12, borderRadius: radius.sm, alignItems: 'center' },
  actText: { color: colors.milkDark, fontWeight: '700', fontSize: 13 },
  del: { backgroundColor: colors.alertLight },
  form: { backgroundColor: colors.panel, borderRadius: radius.lg, padding: 16, marginBottom: 14 },
  twoBtns: { flexDirection: 'row', gap: 10 },
  sec: { fontSize: 17, fontWeight: '800', color: colors.milkDark, marginBottom: 8 },
  chips: { flexDirection: 'row', gap: 8, marginBottom: 8 },
  chip: { backgroundColor: colors.panel, paddingHorizontal: 14, paddingVertical: 7, borderRadius: 20, borderWidth: 1, borderColor: colors.line },
  chipOn: { backgroundColor: colors.milk, borderColor: colors.milk },
  chipText: { color: colors.inkSoft, fontWeight: '700', fontSize: 12 },
  chipTextOn: { color: '#fff' },
  rangeSum: { color: colors.inkSoft, fontSize: 12, marginBottom: 8 },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  typeBtn: { flex: 1, borderWidth: 1.5, borderColor: colors.line, borderRadius: radius.md, paddingVertical: 11, alignItems: 'center' },
  typeOwe: { backgroundColor: colors.alert, borderColor: colors.alert },
  typePaid: { backgroundColor: colors.milk, borderColor: colors.milk },
  typeOff: { color: colors.ink, fontWeight: '600' },
  typeOn: { color: '#fff', fontWeight: '700' },
  list: { backgroundColor: colors.panel, borderRadius: radius.md, paddingHorizontal: 14, paddingVertical: 4 },
  entry: { flexDirection: 'row', alignItems: 'center', paddingVertical: 11, gap: 10 },
  entryLine: { borderTopWidth: 1, borderTopColor: colors.line },
  reason: { color: colors.ink, fontSize: 13, fontWeight: '600' },
  date: { color: colors.inkSoft, fontSize: 11, marginTop: 2 },
  amt: { fontWeight: '800', fontSize: 14 },
  note: { color: colors.inkSoft, fontSize: 12, paddingVertical: 12 },
  hint: { color: colors.inkSoft, fontSize: 11, textAlign: 'center', marginTop: 8 },
  bottom: { gap: 8, marginTop: 20 }
})
