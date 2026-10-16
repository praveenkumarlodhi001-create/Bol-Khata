import { useEffect, useMemo, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Modal, FlatList, TextInput, Alert, ActivityIndicator } from 'react-native'
import * as Contacts from 'expo-contacts'
import Input from './ui/Input'
import Button from './ui/Button'
import { radius, shadow } from '../theme/colors'
import { useTheme } from '../theme/ThemeContext'
import Icon from './Icon'
import { useT } from '../i18n'
import { fmt } from '../utils/format'
import { getItems, getLastEntries } from '../services/dataService'
import { unitLabel } from '../data/catalog'

const QUICK_REASONS = { hi: ['दूध', 'राशन', 'नकद', 'सब्ज़ी', 'दवाई'], en: ['Milk', 'Groceries', 'Cash', 'Vegetables', 'Medicine'] }

export default function ManualEntryForm({ onAdd, onImportContacts, customers = [] }) {
  const { colors } = useTheme()
  const { tr, lang } = useT()
  const styles = makeStyles(colors)
  const [open, setOpen] = useState(false)
  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [reason, setReason] = useState('')
  const [phone, setPhone] = useState('')
  const [type, setType] = useState('udhar')
  const [errors, setErrors] = useState({})
  const [loading, setLoading] = useState(false)
  const [catalog, setCatalog] = useState([])
  const [lines, setLines] = useState([]) // Each item line stores a name, unit, quantity, and unit rate.
  const [last, setLast] = useState({})
  const [contactsOpen, setContactsOpen] = useState(false)
  const [contactsLoading, setContactsLoading] = useState(false)
  const [deviceContacts, setDeviceContacts] = useState([])
  const [contactQuery, setContactQuery] = useState('')
  const [multiSelect, setMultiSelect] = useState(false)
  const [selectedContacts, setSelectedContacts] = useState([])
  const [importingContacts, setImportingContacts] = useState(false)

  useEffect(() => {
    if (!open) return
    getItems().then(setCatalog).catch(() => {})
    getLastEntries().then(setLast).catch(() => {})
  }, [open])

  const q = name.trim().toLowerCase()
  const suggestions = useMemo(() => {
    if (!q) return []
    return customers.filter((c) => c.name.toLowerCase().includes(q) && c.name.toLowerCase() !== q).slice(0, 5)
  }, [customers, q])
  const lastForName = last[name.trim()]
  const itemized = lines.length > 0
  const lineTotal = lines.reduce((sum, l) => sum + (parseFloat(l.qty) || 0) * (parseFloat(l.rate) || 0), 0)

  function pickCustomer(c) { setName(c.name); if (c.phone && !phone) setPhone(c.phone) }

  async function openDeviceContacts() {
    try {
      setContactsLoading(true)
      const permission = await Contacts.requestPermissionsAsync()
      if (permission.status !== 'granted') {
        Alert.alert(tr('contactPermissionTitle'), tr('contactPermissionMessage'))
        return
      }
      // Read all pages to avoid omitting contacts from large address books.
      const allContacts = []
      let pageOffset = 0
      let hasNextPage = true
      while (hasNextPage) {
        const result = await Contacts.getContactsAsync({
          fields: [Contacts.Fields.Name, Contacts.Fields.PhoneNumbers],
          sort: Contacts.SortTypes.FirstName,
          pageSize: 500,
          pageOffset,
        })
        allContacts.push(...(result.data || []))
        hasNextPage = !!result.hasNextPage
        pageOffset += (result.data || []).length
        if (!result.data || result.data.length === 0) break
      }
      const usable = allContacts
        .flatMap((contact) => (contact.phoneNumbers || [])
          .filter((item) => item.number)
          .map((phoneEntry, phoneIndex) => {
            if (!contact.name) return null
            const digits = String(phoneEntry.number).replace(/\D/g, '')
            const normalizedPhone = digits.length >= 10 ? digits.slice(-10) : digits
            if (normalizedPhone.length !== 10 || !/^[6-9]\d{9}$/.test(normalizedPhone)) return null
            return { id: `${contact.id}:${phoneIndex}`, contactId: contact.id, name: contact.name, phone: normalizedPhone, displayPhone: phoneEntry.number }
          }))
        .filter(Boolean)
        .sort((a, b) => a.name.localeCompare(b.name))
      setDeviceContacts(usable)
      setContactQuery('')
      setMultiSelect(false)
      setSelectedContacts([])
      setContactsOpen(true)
    } catch (error) {
      Alert.alert(tr('contactPermissionTitle'), tr('contactReadFailed'))
    } finally {
      setContactsLoading(false)
    }
  }

  const filteredContacts = useMemo(() => {
    const query = contactQuery.trim().toLowerCase()
    if (!query) return deviceContacts
    return deviceContacts.filter((contact) => contact.name.toLowerCase().includes(query) || contact.phone.includes(query))
  }, [deviceContacts, contactQuery])

  function toggleSelectedContact(contact) {
    setSelectedContacts((current) => current.some((item) => item.id === contact.id)
      ? current.filter((item) => item.id !== contact.id)
      : [...current, contact])
  }

  async function importSelectedContacts() {
    if (!selectedContacts.length || !onImportContacts) return
    try {
      setImportingContacts(true)
      const result = await onImportContacts(selectedContacts.map(({ name, phone }) => ({ name, phone })))
      if (result && result.ok) {
        Alert.alert(tr('contactImportTitle'), `${tr('contactImportSuccess', { count: result.added || 0 })}${result.skipped ? ` ${tr('contactImportSkipped', { count: result.skipped })}` : ''}`)
        setContactsOpen(false)
        setSelectedContacts([])
        setMultiSelect(false)
      }
    } finally {
      setImportingContacts(false)
    }
  }

  function chooseDeviceContact(contact) {
    setName(contact.name)
    setPhone(contact.phone)
    setErrors((current) => ({ ...current, name: undefined, phone: undefined }))
    setContactsOpen(false)
  }
  function addLine(it) {
    setType('udhar')
    setLines((ls) => [...ls, { name: it.name, unit: it.unit, qty: '1', rate: it.price != null ? String(it.price) : '' }])
  }
  const setLine = (i, patch) => setLines((ls) => ls.map((l, j) => (j === i ? { ...l, ...patch } : l)))
  function repeat(entry) {
    setType(entry.type || 'udhar')
    setReason(entry.reason || '')
    if (entry.items && entry.items.length) { setLines(entry.items.map((x) => ({ name: x.name, unit: x.unit, qty: String(x.qty), rate: String(x.rate) }))); setAmount('') }
    else { setLines([]); setAmount(String(entry.amount)) }
  }

  async function handleSave() {
    const amt = itemized ? lineTotal : parseFloat(amount)
    const e = {}
    let items = null
    if (itemized) {
      items = lines.map((l) => ({ name: l.name, unit: l.unit || undefined, qty: parseFloat(l.qty), rate: parseFloat(l.rate) }))
      if (type !== 'udhar') e.items = tr('itemsOnlyCredit')
      else if (items.some((l) => !(l.qty > 0) || !Number.isFinite(l.rate) || l.rate < 0)) e.items = tr('itemLinesInvalid')
    }
    if (!name.trim()) e.name = tr('invalidName')
    if (isNaN(amt) || amt <= 0) e.amount = tr('invalidAmount')
    if (reason.trim().length > 60) e.reason = tr('invalidReason')
    if (phone.trim() && !/^[6-9]\d{9}$/.test(phone.trim())) e.phone = tr('invalidPhone')
    setErrors(e)
    if (Object.keys(e).length) return

    setLoading(true)
    const autoReason = !reason.trim() && itemized ? lines.map((l) => l.name).join(', ').slice(0, 60) : reason.trim()
    const ok = await onAdd(name.trim(), amt, type, autoReason, phone.trim(), items)
    setLoading(false)
    if (ok) {
      setName('')
      setAmount('')
      setReason('')
      setPhone('')
      setLines([])
    }
  }

  return (
    <View>
      <TouchableOpacity onPress={() => setOpen(!open)} style={styles.toggle} activeOpacity={0.7}>
        <View style={styles.toggleInner}><Icon name={open ? 'close' : 'create-outline'} size={20} color={colors.milk}/><Text style={styles.toggleText}>{open ? tr('manualToggleOpen') : tr('manualToggleClosed')}</Text></View>
      </TouchableOpacity>

      {open && (
        <View style={[styles.form, shadow]}>
          <Input
            label={tr('customerName')}
            placeholder={tr('nameExample')}
            value={name}
            onChangeText={setName}
            error={errors.name}
          />
          <TouchableOpacity style={styles.contactsButton} onPress={openDeviceContacts} disabled={contactsLoading} activeOpacity={0.8}>
            {contactsLoading ? <ActivityIndicator size="small" color={colors.milk} /> : <Icon name="person" size={18} color={colors.milk} />}
            <Text style={styles.contactsButtonText}>{contactsLoading ? tr('contactsLoading') : tr('chooseFromContacts')}</Text>
          </TouchableOpacity>
          {suggestions.length > 0 ? <View style={styles.chips}>{suggestions.map((c) => <TouchableOpacity key={c.id} style={styles.chip} onPress={() => pickCustomer(c)}><Text style={styles.chipText}>{c.name}</Text></TouchableOpacity>)}</View> : null}
          {lastForName ? (
            <TouchableOpacity style={styles.repeat} onPress={() => repeat(lastForName)} activeOpacity={0.8}>
              <Text style={styles.repeatText}>↻ {tr('repeatLast')}: {lastForName.type === 'payment' ? tr('receivePayment') : tr('giveCredit')} {fmt(lastForName.amount)}{lastForName.reason ? ` · ${lastForName.reason}` : ''}</Text>
            </TouchableOpacity>
          ) : null}
          {itemized ? (
            <View style={styles.itemsBox}>
              {lines.map((l, i) => (
                <View key={i} style={styles.lineRow}>
                  <Text style={styles.lineName} numberOfLines={1}>{l.name}{l.unit ? ` (${unitLabel(l.unit, lang)})` : ''}</Text>
                  <View style={styles.lineInputs}>
                    <Input placeholder={tr('qty')} keyboardType="numeric" value={l.qty} onChangeText={(v) => setLine(i, { qty: v })} style={{ flex: 1 }} />
                    <Input placeholder={tr('itemRate')} prefix="₹" keyboardType="numeric" value={l.rate} onChangeText={(v) => setLine(i, { rate: v })} style={{ flex: 1 }} />
                    <TouchableOpacity onPress={() => setLines((ls) => ls.filter((_, j) => j !== i))} hitSlop={8}><Text style={styles.x}>✕</Text></TouchableOpacity>
                  </View>
                </View>
              ))}
              {errors.items ? <Text style={styles.err}>{errors.items}</Text> : null}
              <Text style={styles.total}>{tr('total')}: {fmt(lineTotal)}</Text>
            </View>
          ) : (
            <Input
              label={tr('amountLabel')}
              prefix="₹"
              placeholder="0"
              keyboardType="numeric"
              value={amount}
              onChangeText={setAmount}
              error={errors.amount}
            />
          )}
          <Text style={styles.sub}>{tr('addFromItems')}</Text>
          <View style={styles.chips}>
            {catalog.slice(0, 24).map((it) => <TouchableOpacity key={it.id} style={styles.chip} onPress={() => addLine(it)}><Text style={styles.chipText}>+ {it.name}</Text></TouchableOpacity>)}
            {lines.length < 20 ? <TouchableOpacity style={styles.chip} onPress={() => addLine({ name: reason.trim() || tr('itemDefault'), unit: undefined, price: null })}><Text style={styles.chipText}>+ {tr('otherItem')}</Text></TouchableOpacity> : null}
          </View>
          <View style={styles.typeRow}>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'udhar' && styles.typeBtnOwe]}
              onPress={() => setType('udhar')}
            >
              <Text style={type === 'udhar' ? styles.typeTextActive : styles.typeText}>{tr('giveCredit')}</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.typeBtn, type === 'payment' && styles.typeBtnPaid]}
              onPress={() => setType('payment')}
            >
              <Text style={type === 'payment' ? styles.typeTextActive : styles.typeText}>{tr('receivePayment')}</Text>
            </TouchableOpacity>
          </View>

          <Input
            label={tr('reasonLabel')}
            placeholder={tr('reasonExample')}
            value={reason}
            onChangeText={setReason}
            maxLength={60}
            error={errors.reason}
          />
          <View style={styles.chips}>
            {(QUICK_REASONS[lang] || QUICK_REASONS.hi).map((r) => (
              <TouchableOpacity key={r} style={styles.chip} onPress={() => setReason(r)} activeOpacity={0.7}>
                <Text style={styles.chipText}>{r}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Input
            label={tr('customerMobile')}
            placeholder={tr('mobileDigits')}
            keyboardType="phone-pad"
            maxLength={10}
            value={phone}
            onChangeText={setPhone}
            error={errors.phone}
          />
          <Button title={tr('add')} icon="add" onPress={handleSave} loading={loading} />
        </View>
      )}
      <Modal visible={contactsOpen} animationType="slide" transparent onRequestClose={() => setContactsOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.contactsModal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{tr('contactsTitle')}</Text>
                <Text style={styles.modalSubtitle}>{tr('contactsSubtitle')}</Text>
              </View>
              <TouchableOpacity onPress={() => setContactsOpen(false)} accessibilityLabel={tr('closeContactsLabel')} hitSlop={10}>
                <Icon name="close" size={24} color={colors.ink} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={styles.contactSearch}
              placeholder={tr('searchContacts')}
              placeholderTextColor={colors.inkSoft}
              value={contactQuery}
              onChangeText={setContactQuery}
              autoCorrect={false}
            />
            <View style={styles.contactActions}>
              <TouchableOpacity
                style={[styles.multiSelectButton, multiSelect && styles.multiSelectButtonActive]}
                onPress={() => { setMultiSelect((value) => !value); setSelectedContacts([]) }}
                activeOpacity={0.8}
              >
                <Icon name="square-outline" size={17} color={multiSelect ? '#FFFFFF' : colors.milk} />
                <Text style={[styles.multiSelectText, multiSelect && styles.multiSelectTextActive]}>{multiSelect ? tr('switchToSingleSelect') : tr('selectMultipleCustomers')}</Text>
              </TouchableOpacity>
              {multiSelect ? (
                <TouchableOpacity onPress={() => setSelectedContacts((current) => {
                  const visibleIds = new Set(filteredContacts.map((item) => item.id))
                  const allVisibleSelected = filteredContacts.length > 0 && filteredContacts.every((item) => current.some((picked) => picked.id === item.id))
                  return allVisibleSelected ? current.filter((item) => !visibleIds.has(item.id)) : [...current.filter((item) => !visibleIds.has(item.id)), ...filteredContacts]
                })}>
                  <Text style={styles.selectAllText}>{filteredContacts.length > 0 && filteredContacts.every((item) => selectedContacts.some((picked) => picked.id === item.id)) ? tr('deselectVisible') : tr('selectAllVisible')}</Text>
                </TouchableOpacity>
              ) : null}
            </View>
            {multiSelect ? <Text style={styles.selectionCount}>{tr('contactsSelected', { count: selectedContacts.length })}</Text> : null}
            <FlatList
              data={filteredContacts}
              keyExtractor={(item) => String(item.id)}
              keyboardShouldPersistTaps="handled"
              ListEmptyComponent={<Text style={styles.noContacts}>{deviceContacts.length ? tr('noContactsMatch') : tr('noContactsWithPhone')}</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={styles.contactRow} onPress={() => multiSelect ? toggleSelectedContact(item) : chooseDeviceContact(item)} activeOpacity={0.7}>
                  <View style={styles.contactAvatar}><Text style={styles.contactAvatarText}>{item.name.trim().charAt(0).toUpperCase()}</Text></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.contactName} numberOfLines={1}>{item.name}</Text>
                    <Text style={styles.contactPhone}>{item.displayPhone}</Text>
                  </View>
                  {multiSelect
                    ? <Icon name={selectedContacts.some((picked) => picked.id === item.id) ? 'checkmark-circle' : 'square-outline'} size={23} color={selectedContacts.some((picked) => picked.id === item.id) ? colors.milk : colors.inkSoft} />
                    : <Icon name="add-circle-outline" size={22} color={colors.milk} />}
                </TouchableOpacity>
              )}
            />
            {multiSelect ? (
              <TouchableOpacity style={[styles.importContactsButton, (!selectedContacts.length || importingContacts) && styles.importContactsButtonDisabled]} onPress={importSelectedContacts} disabled={!selectedContacts.length || importingContacts} activeOpacity={0.85}>
                {importingContacts ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Icon name="person" size={19} color="#FFFFFF" />}
                <Text style={styles.importContactsText}>{importingContacts ? tr('addingCustomers') : tr('importSelectedCustomers', { count: selectedContacts.length })}</Text>
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </Modal>
    </View>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  toggle: { alignItems: 'center', marginBottom: 18, paddingVertical: 4 },
  contactsButton: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 8, borderWidth: 1, borderColor: colors.milk, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9, marginTop: -5, marginBottom: 14 },
  contactsButtonText: { color: colors.milk, fontSize: 13, fontWeight: '700' },
  modalBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  contactsModal: { height: '82%', backgroundColor: colors.panel, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 18 },
  modalHeader: { flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 14 },
  modalTitle: { color: colors.ink, fontSize: 18, fontWeight: '800' },
  modalSubtitle: { color: colors.inkSoft, fontSize: 12, marginTop: 4 },
  contactSearch: { height: 44, borderWidth: 1, borderColor: colors.line, borderRadius: 12, paddingHorizontal: 12, color: colors.ink, marginBottom: 10 },
  contactActions: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 8 },
  multiSelectButton: { flexDirection: 'row', alignItems: 'center', gap: 7, borderWidth: 1, borderColor: colors.milk, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8 },
  multiSelectButtonActive: { backgroundColor: colors.milk, borderColor: colors.milk },
  multiSelectText: { color: colors.milk, fontSize: 12, fontWeight: '700' },
  multiSelectTextActive: { color: '#FFFFFF' },
  selectAllText: { color: colors.milk, fontSize: 12, fontWeight: '700' },
  selectionCount: { color: colors.inkSoft, fontSize: 11, marginBottom: 7 },
  importContactsButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: colors.milk, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 13, marginTop: 10 },
  importContactsButtonDisabled: { opacity: 0.45 },
  importContactsText: { color: '#FFFFFF', fontSize: 13, fontWeight: '800' },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  contactAvatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.milkLight, alignItems: 'center', justifyContent: 'center' },
  contactAvatarText: { color: colors.milkDark, fontWeight: '800', fontSize: 16 },
  contactName: { color: colors.ink, fontWeight: '700', fontSize: 14 },
  contactPhone: { color: colors.inkSoft, fontSize: 12, marginTop: 3 },
  noContacts: { color: colors.inkSoft, textAlign: 'center', paddingVertical: 28, fontSize: 13 },
  toggleInner: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  toggleText: { color: colors.milk, fontSize: 14, fontWeight: '600' },
  form: {
    backgroundColor: colors.panel,
    borderRadius: radius.lg,
    padding: 18,
    marginBottom: 20
  },
  typeRow: { flexDirection: 'row', gap: 10, marginBottom: 16 },
  typeBtn: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.line,
    borderRadius: radius.md,
    paddingVertical: 12,
    alignItems: 'center'
  },
  typeBtnOwe: { backgroundColor: colors.alert, borderColor: colors.alert },
  typeBtnPaid: { backgroundColor: colors.milk, borderColor: colors.milk },
  typeText: { color: colors.ink, fontWeight: '600' },
  typeTextActive: { color: '#fff', fontWeight: '700' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14, marginTop: -4 },
  chip: { backgroundColor: colors.milkLight, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20 },
  chipText: { color: colors.milk, fontSize: 12, fontWeight: '600' },
  sub: { color: colors.inkSoft, fontSize: 12, marginBottom: 8, fontWeight: '600' },
  repeat: { backgroundColor: colors.milkLight, borderRadius: radius.md, padding: 10, marginBottom: 12 },
  repeatText: { color: colors.milkDark, fontWeight: '700', fontSize: 13 },
  itemsBox: { marginBottom: 10 },
  lineRow: { marginBottom: 6 },
  lineName: { color: colors.ink, fontWeight: '700', fontSize: 13, marginBottom: 4 },
  lineInputs: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  x: { color: colors.alert, fontWeight: '800', fontSize: 16 },
  err: { color: colors.alert, fontSize: 12, marginBottom: 6 },
  total: { color: colors.milkDark, fontWeight: '800', fontSize: 16, textAlign: 'right', marginTop: 4 }
})
