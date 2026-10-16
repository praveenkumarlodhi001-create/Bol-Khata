import { useEffect, useState, useCallback, useRef } from 'react'
import {
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  AppState,
  StyleSheet,
  StatusBar,
  Image,
  Modal,
  BackHandler,
  KeyboardAvoidingView,
  Platform,
  Animated,
  AccessibilityInfo
} from 'react-native'
import Icon from './src/components/Icon'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { AuthProvider, useAuth } from './src/context/AuthContext'
import AuthNavigator from './src/screens/AuthNavigator'
import VoiceEntry from './src/components/VoiceEntry'
import ManualEntryForm from './src/components/ManualEntryForm'
import StatsBar from './src/components/StatsBar'
import CustomerList from './src/components/CustomerList'
import MyAccounts from './src/components/MyAccounts'
import CustomerDetail from './src/components/CustomerDetail'
import ReportCard from './src/components/ReportCard'
import BackupCard from './src/components/BackupCard'
import DailyCard from './src/components/DailyCard'
import UpiCard from './src/components/UpiCard'
import ProfileTab from './src/components/ProfileTab'
import TabIcon from './src/components/TabIcon'
import { PopupProvider, usePopup } from './src/components/Popup'
import RoleChoiceScreen from './src/screens/RoleChoiceScreen'
import BusinessSetupScreen from './src/screens/BusinessSetupScreen'
import OnboardingScreen from './src/screens/OnboardingScreen'
import LockScreen from './src/components/LockScreen'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { isLockOn, removeLock } from './src/services/security'
import { scheduleEvening } from './src/services/notify'
import { getReport } from './src/services/dataService'
import { businessLabel } from './src/data/catalog'
import Avatar from './src/components/Avatar'
import { I18nProvider, useT } from './src/i18n'
import { ThemeProvider, useThemedStyles } from './src/theme/ThemeContext'
import {
  syncNow,
  getLocalView,
  addTransaction,
  addDailyEntries,
  importCustomersFromContacts,
  discardFailed,
  deleteCustomer
} from './src/services/dataService'
import { logout, setUpiId } from './src/services/authService'
import { radius, shadow } from './src/theme/colors'
import { useTheme } from './src/theme/ThemeContext'
import LoadingScreen from './src/components/anim/LoadingScreen'
import PressScale from './src/components/anim/PressScale'
import Skeleton from './src/components/anim/Skeleton'
import { BRAND_NAME } from './src/config/brand'

function Dashboard() {
  const { colors, styles } = useThemedStyles(createStyles)
  const { mode } = useTheme()
  const { tr, lang } = useT()
  const popup = usePopup()
  const { user } = useAuth()
  const isBuyer = user?.role === 'buyer' // grahak ke paas dukaan ka hisaab/sync nahi hota
  const homeTab = isBuyer ? 'mine' : 'shop'
  const [tab, setTab] = useState(homeTab) // shop | mine | profile
  const [reduceMotion, setReduceMotion] = useState(false)
  const [data, setData] = useState({ customers: [], summary: null })
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState(null)
  const toastTimerRef = useRef(null)
  const toastProgress = useRef(new Animated.Value(0)).current
  const [savedBurst, setSavedBurst] = useState(false)
  const burstScale = useRef(new Animated.Value(0.4)).current
  const burstOpacity = useRef(new Animated.Value(0)).current
  const tabIconScale = useRef(new Animated.Value(1)).current
  useEffect(() => () => { if (toastTimerRef.current) clearTimeout(toastTimerRef.current); toastProgress.stopAnimation(); burstScale.stopAnimation(); burstOpacity.stopAnimation(); tabIconScale.stopAnimation() }, [toastProgress, burstScale, burstOpacity, tabIconScale])
  useEffect(() => { const sub = AccessibilityInfo?.addEventListener?.('reduceMotionChanged', setReduceMotion); return () => sub?.remove?.() }, [])
  useEffect(() => { if (!toast) return; toastProgress.setValue(0); Animated.spring(toastProgress, { toValue: 1, speed: 22, bounciness: 5, useNativeDriver: true }).start(); return () => toastProgress.stopAnimation() }, [toast, toastProgress])
  const [refreshKey, setRefreshKey] = useState(0)
  useEffect(() => { if (reduceMotion) { tabIconScale.setValue(1); return } tabIconScale.setValue(0.82); Animated.spring(tabIconScale, { toValue: 1, speed: 18, bounciness: 8, useNativeDriver: true }).start() }, [tab, reduceMotion, tabIconScale])
  const [openId, setOpenId] = useState(null) // jis grahak ka detail khula hai
  const [showEntry, setShowEntry] = useState(false)

  function showToast(text, kind = 'ok') {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current)
    const prefix = kind === 'err' ? '⚠️ ' : kind === 'celebrate' ? '🎉 ' : '✅ '
    setToast({ text: `${prefix}${String(text).replace(/^(?:⚠️|🎉|✅)\s*/u, '')}`, kind })
    toastTimerRef.current = setTimeout(() => { setToast(null); toastTimerRef.current = null }, 2500)
  }

  // Server se milao: bheji na gayi entries bhejta hai, phir taaza list laata hai. Net na ho to phone me rakhi list dikhti hai.
  const pendingRef = useRef(0)
  useEffect(() => {
    pendingRef.current = data.pending || 0
  }, [data.pending])

  const runSync = useCallback(async (silent = true) => {
    const before = pendingRef.current
    try {
      const next = await syncNow()
      setData(next)
      setLoadError('')
      if (before > 0 && next.pending < before) showToast(tr('syncSuccess', { count: before - next.pending }), 'ok')
      return next
    } catch (e) {
      if (!silent) setLoadError(e.message || tr('loadingError'))
      return null
    }
  }, [])

  useEffect(() => {
    if (isBuyer) { setLoading(false); return undefined }
    let alive = true
    ;(async () => {
      try {
        // phone me rakhi list turant dikhao (net ke bina bhi app khulti hai), phir server se milao
        const local = await getLocalView()
        if (alive && (local.customers.length || local.pending)) {
          setData(local)
          setLoading(false)
        }
      } catch (e) {
        /* neeche sync dekhega */
      }
      await runSync(false)
      if (alive) setLoading(false)
    })()
    return () => {
      alive = false
    }
  }, [runSync, isBuyer])

  // App wapas khulte hi aur jab tak entries bheji nahi gayi, har 30 second me phir koshish
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active' && !isBuyer) runSync(true)
    })
    return () => sub.remove()
  }, [runSync, isBuyer])

  useEffect(() => {
    if (isBuyer || !(data.pending > 0)) return undefined
    const timer = setInterval(() => runSync(true), 30000)
    return () => clearInterval(timer)
  }, [data.pending, runSync, isBuyer])

  // Shaam ka reminder: aaj ka udhar + kul baaki, taaza aankdon ke saath dobara schedule
  const refreshReminder = useCallback(async (summary) => {
    if (isBuyer) return
    try {
      const r = await getReport(1)
      await scheduleEvening({
        given: r.given,
        owed: summary ? summary.owed : 0,
        text: {
          title: BRAND_NAME,
          today: (g, o) => tr('notifyToday', { given: '₹' + Math.round(g).toLocaleString('en-IN'), owed: '₹' + Math.round(o).toLocaleString('en-IN') }),
          generic: tr('notifyGeneric')
        }
      })
    } catch (e) { /* net na ho to purana schedule chalta rehta hai */ }
  }, [isBuyer, tr])
  useEffect(() => { if (data.summary && !data.offline) refreshReminder(data.summary) }, [data.summary && data.summary.owed, data.summary && data.summary.given, refreshReminder])

  async function onRefresh() {
    setRefreshing(true)
    await runSync(false)
    setRefreshKey((k) => k + 1)
    setRefreshing(false)
  }

  // true = save ho gaya, false = fail (form tab apna data bachakar rakhta hai)
  async function handleAdd(name, amount, type, reason = '', phone = '', items = null) {
    try {
      setData(await addTransaction(name, amount, type, reason, phone, items)) // phone me turant save, net ho ya na ho
      showToast(tr('savedToast', { name }), 'celebrate')
      if (!reduceMotion) { setSavedBurst(true); burstScale.setValue(0.4); burstOpacity.setValue(1); Animated.sequence([Animated.spring(burstScale, { toValue: 1.15, useNativeDriver: true }), Animated.timing(burstScale, { toValue: 1, duration: 120, useNativeDriver: true }), Animated.delay(260), Animated.timing(burstOpacity, { toValue: 0, duration: 180, useNativeDriver: true })]).start(({ finished }) => { if (finished) setSavedBurst(false) }) }
      runSync(true) // server ko bhejna peeche chalta hai
      return true
    } catch (e) {
      showToast(e.message || tr('errorToast'), 'err')
      return false
    }
  }

  async function handleImportContacts(contacts) {
    try {
      const result = await importCustomersFromContacts(contacts)
      setData(result)
      showToast(`${tr('contactImportSuccess', { count: result.added || 0 })}${result.skipped ? ` ${tr('contactImportSkipped', { count: result.skipped })}` : ''}`, 'ok')
      runSync(true)
      return { ok: true, added: result.added || 0, skipped: result.skipped || 0 }
    } catch (e) {
      showToast(e.message || tr('contactReadFailed'), 'err')
      return { ok: false }
    }
  }

  async function handleDelete(id) {
    try {
      setData(await deleteCustomer(id))
      setOpenId(null)
      showToast(tr('deleteCustomer'), 'ok')
    } catch (e) {
      showToast(e.message || tr('deleteCustomerError'), 'err')
    }
  }

  async function handleDaily(chosen) {
    try {
      setData(await addDailyEntries(chosen))
      showToast(tr('dailySaved', { count: chosen.length }), 'celebrate')
      runSync(true)
      return true
    } catch (e) {
      showToast(e.message || tr('dailyFailed'), 'err')
      return false
    }
  }

  async function handleUpi(upiId) {
    try {
      await setUpiId(upiId)
      showToast(upiId ? tr('upiSaved') : tr('upiRemoved'))
      return true
    } catch (e) {
      showToast(e.message || tr('upiSaveFailed'), 'err')
      return false
    }
  }

  async function handleDiscard() {
    try {
      setData(await discardFailed())
    } catch (e) {
      showToast(e.message || tr('discardFailed'), 'err')
    }
  }

  async function pushNow() {
    const next = await runSync(true)
    if (!next || next.offline) showToast(tr('serverOffline'), 'err')
  }

  async function confirmLogout() {
    const ok = await popup.confirm({
      tone: 'danger',
      icon: 'logout',
      title: tr('logoutTitle'),
      message: tr('logoutConfirm') + (data.pending > 0 ? tr('logoutPending', { count: data.pending }) : ''),
      confirmText: tr('logoutAction')
    })
    if (ok) logout()
  }

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (showEntry) { setShowEntry(false); return true }
      if (openId) { setOpenId(null); return true }
      if (tab !== homeTab) { setTab(homeTab); return true }
      return false
    })
    return () => sub.remove()
  }, [showEntry, openId, tab, homeTab])

  const opened = openId ? data.customers.find((c) => c.id === openId) : null
  const reportVersion = data.summary ? `${data.summary.given}|${data.summary.paid}|${data.summary.customers}` : ''
  const who = [user?.name, user?.email, user?.phone ? '+91 ' + user.phone : ''].filter(Boolean).join(' · ')

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.wrap}
        keyboardShouldPersistTaps="handled"
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.milk} />}
      >
        <View style={styles.topBar}>
          <View style={styles.brandRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.title} numberOfLines={1}>{user?.name || user?.email || (user?.phone ? '+91 ' + user.phone : BRAND_NAME)}</Text>
              <Text style={styles.who} numberOfLines={1}>{[isBuyer ? tr('buyerRole') : (user?.businessType ? businessLabel(user.businessType, lang) : tr('sellerRole')), user?.phone ? '+91 ' + user.phone : user?.email].filter(Boolean).join(' · ')}</Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setTab('profile')} activeOpacity={0.8} accessibilityRole="button" accessibilityLabel={tr('openProfile')} hitSlop={8}>
            <Avatar name={user?.name || user?.email || user?.phone} userId={user?.id} hasPhoto={user?.hasPhoto} photoVersion={user?.photoVersion} size={44} />
          </TouchableOpacity>
        </View>

        {(data.pending > 0 || data.offline || (data.failed && data.failed.length > 0)) && (
          <View style={styles.syncBox}>
            {data.failed && data.failed.length > 0 && (
              <View style={styles.syncRow}>
                <Icon name="alert-circle-outline" size={18} color={colors.alert} />
                <Text style={[styles.syncText, { color: colors.alert }]}>{tr('failedEntries', { count: data.failed.length, name: data.failed[0].name, error: data.failed[0].error })}</Text>
                <TouchableOpacity onPress={handleDiscard}>
                  <Text style={styles.syncBtn}>{tr('discard')}</Text>
                </TouchableOpacity>
              </View>
            )}
            {(data.pending > 0 || data.offline) && (
              <View style={styles.syncRow}>
                <Text style={styles.syncText}>
                  {data.pending > 0
                    ? data.offline
                      ? tr('pendingOffline', { count: data.pending })
                      : tr('pendingSending', { count: data.pending })
                    : tr('noInternetBanner')}
                </Text>
                {data.pending > 0 && (
                  <TouchableOpacity onPress={pushNow}>
                    <Text style={styles.syncBtn}>{tr('syncNow')}</Text>
                  </TouchableOpacity>
                )}
              </View>
            )}
          </View>
        )}

        {tab === 'shop' ? (
          <>
            {loading ? (
              <View style={styles.loader}>
                <Text style={styles.loaderText}>{tr('syncing')}</Text>
                {[0, 1, 2, 3].map((item) => <Skeleton key={item} />)}
              </View>
            ) : (
              <>
                {loadError ? <Text style={styles.loadError}>{loadError}</Text> : null}
                <StatsBar summary={data.summary} />
                <View style={styles.listHeader}>
                  <Text style={styles.listTitle}>{tr('customerList')}</Text>
                </View>
                <CustomerList
                  customers={data.customers}
                  onOpen={(c) =>
                    c.localOnly
                      ? showToast(tr('localOnlyCustomer'), 'err')
                      : setOpenId(c.id)
                  }
                />

              </>
            )}
          </>
        ) : tab === 'mine' ? (
          <><ReportCard version={reportVersion} /><MyAccounts refreshKey={refreshKey} onToast={showToast} /></>
        ) : (
          <ProfileTab pending={data.pending || 0} onSaveUpi={handleUpi} onData={setData} onToast={showToast} onNotifyChanged={() => refreshReminder(data.summary)} />
        )}

        {tab !== 'profile' ? <Text style={styles.footer}>{tr('footer')}</Text> : null}
      </ScrollView>

      {tab === 'shop' && !openId && (
        <PressScale style={styles.entryFabWrap} innerStyle={styles.entryFab} onPress={() => setShowEntry(true)} accessibilityRole="button" accessibilityLabel={tr('addEntry')} hitSlop={10}>
          <Icon name="add-circle-outline" size={24} color="#FFFFFF" />
          <Text style={styles.entryFabText}>{tr('addEntry')}</Text>
        </PressScale>
      )}

      <Modal visible={showEntry} transparent animationType="slide" onRequestClose={() => setShowEntry(false)}>
        <View style={styles.sheetBackdrop}>
          <TouchableOpacity style={styles.backdropTouch} activeOpacity={1} onPress={() => setShowEntry(false)} />
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.sheetWrap}>
            <View style={styles.sheetHandle} />
            <View style={styles.sheetHeader}>
              <Text style={styles.sheetTitle}>{tr('addEntry')}</Text>
              <TouchableOpacity onPress={() => setShowEntry(false)} accessibilityLabel={tr('close')}><Icon name="close-circle-outline" size={28} color={colors.inkSoft} /></TouchableOpacity>
            </View>
            {toast ? <Animated.View style={[styles.sheetToast, toast.kind === 'err' && styles.toastErr, shadow, { opacity: toastProgress, transform: [{ translateY: toastProgress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}><View style={styles.toastRow}><Animated.View style={{ transform: [{ scale: toastProgress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}><Icon name={toast.kind === 'err' ? 'alert-circle-outline' : 'checkmark-circle'} size={20} color="#FFFFFF" cut={toast.kind === 'err' ? colors.alert : colors.milkDark} /></Animated.View><Text style={[styles.toastText, { flexShrink: 1 }]}>{toast.text}</Text></View></Animated.View> : null}
            <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.sheetContent}>
              <VoiceEntry onAdd={async (...args) => { const ok = await handleAdd(...args); if (ok) setShowEntry(false); return ok }} />
              <ManualEntryForm customers={data.customers} onImportContacts={handleImportContacts} onAdd={async (...args) => { const ok = await handleAdd(...args); if (ok) setShowEntry(false); return ok }} />
              <DailyCard customers={data.customers} onApply={async (...args) => { const ok = await handleDaily(...args); if (ok) setShowEntry(false); return ok }} />
            </ScrollView>
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {savedBurst ? <Animated.View pointerEvents="none" style={{ position: 'absolute', bottom: 82, alignSelf: 'center', zIndex: 50, opacity: burstOpacity, transform: [{ scale: burstScale }] }}><View style={{ width: 58, height: 58, borderRadius: 29, backgroundColor: colors.milk, alignItems: 'center', justifyContent: 'center', elevation: 8 }}><Icon name="checkmark" size={34} color="#FFFFFF" /></View></Animated.View> : null}
      <View style={styles.bottomTabs}>
        {[
          { key: 'shop', label: tr('shopTab'), icon: 'home' },
          { key: 'mine', label: tr('mineTab'), icon: 'wallet' },
          { key: 'profile', label: tr('profile'), icon: 'person' }
        ].filter((item) => !(isBuyer && item.key === 'shop')).map((item) => (
          <PressScale key={item.key} style={styles.bottomTabWrap} innerStyle={styles.bottomTab} onPress={() => setTab(item.key)} accessibilityRole="tab" accessibilityLabel={item.label} accessibilityState={{ selected: tab === item.key }} hitSlop={6}>
            <View style={[styles.tabIndicator, tab === item.key && styles.tabIndicatorOn]} />
            <Animated.View style={{ transform: [{ scale: tab === item.key ? tabIconScale : 1 }] }}><TabIcon name={item.icon} size={26} color={tab === item.key ? colors.milk : colors.inkSoft} cut={colors.panel} /></Animated.View>
            <Text style={[styles.bottomTabText, tab === item.key && styles.bottomTabTextOn]}>{item.label}</Text>
          </PressScale>
        ))}
      </View>

      {opened && (
        <CustomerDetail
          customer={opened}
          shopName={user?.name}
          upiId={user?.upiId}
          onClose={() => setOpenId(null)}
          onData={setData}
          onDelete={handleDelete}
        />
      )}

      {toast && !showEntry && (
        <Animated.View style={[styles.toast, toast.kind === 'err' && styles.toastErr, shadow, { opacity: toastProgress, transform: [{ translateY: toastProgress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }] }]}>
          <View style={styles.toastRow}><Animated.View style={{ transform: [{ scale: toastProgress.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }) }] }}><Icon name={toast.kind === 'err' ? 'alert-circle-outline' : 'checkmark-circle'} size={20} color="#FFFFFF" cut={toast.kind === 'err' ? colors.alert : colors.milkDark} /></Animated.View><Text style={[styles.toastText, { flexShrink: 1 }]}>{toast.text}</Text></View>
        </Animated.View>
      )}
    </SafeAreaView>
  )
}

function Root() {
  const { colors, styles } = useThemedStyles(createStyles)
  const { mode } = useTheme()
  const { tr } = useT()
  const { user, initializing } = useAuth()
  const [minimumSplashDone, setMinimumSplashDone] = useState(false)
  const [onboarded, setOnboarded] = useState(null) // null = abhi padh rahe hain
  const [locked, setLocked] = useState(false)
  const bgAt = useRef(0)
  useEffect(() => {
    const timer = setTimeout(() => setMinimumSplashDone(true), 1800)
    AsyncStorage.getItem('vk_onboarded').then((v) => setOnboarded(v === '1')).catch(() => setOnboarded(true))
    return () => clearTimeout(timer)
  }, [])
  const uid = user && user.id
  useEffect(() => { if (uid) isLockOn(uid).then((on) => setLocked(on)); else setLocked(false) }, [uid])
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'background' || st === 'inactive') { if (!bgAt.current) bgAt.current = Date.now() }
      else if (st === 'active') {
        const away = bgAt.current ? Date.now() - bgAt.current : 0
        bgAt.current = 0
        if (uid && away > 20000) isLockOn(uid).then((on) => { if (on) setLocked(true) })
      }
    })
    return () => sub.remove()
  }, [uid])
  function finishOnboarding() { setOnboarded(true); AsyncStorage.setItem('vk_onboarded', '1').catch(() => {}) }
  if (initializing || !minimumSplashDone || onboarded === null) {
    return <><StatusBar barStyle="light-content" backgroundColor={mode === 'dark' ? '#102B25' : '#2E6E5E'} /><LoadingScreen dark={mode === 'dark'} /></>
  }
  if (!user && !onboarded) return <><StatusBar barStyle="light-content" backgroundColor={colors.milkDark} /><OnboardingScreen onDone={finishOnboarding} /></>
  if (user && locked) {
    return <LockScreen uid={uid} name={user.name} onUnlock={() => setLocked(false)} onForgot={async () => { await removeLock(uid); setLocked(false); logout() }} />
  }
  return (<>
    <StatusBar barStyle={mode === 'dark' ? 'light-content' : 'dark-content'} backgroundColor={colors.bg} />
    {user ? (!user.role ? <RoleChoiceScreen /> : user.role === 'seller' && !user.businessType ? <BusinessSetupScreen /> : <Dashboard key={user.role} />) : <AuthNavigator />}
  </>)
}

export default function App() {
  return (
    <SafeAreaProvider>
      <I18nProvider>
        <ThemeProvider>
          <PopupProvider>
            <AuthProvider>
              <Root />
            </AuthProvider>
          </PopupProvider>
        </ThemeProvider>
      </I18nProvider>
    </SafeAreaProvider>
  )
}

const createStyles = (colors) => StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.bg },
  splash: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: 18 },
  splashIcon: { width: 82, height: 82, borderRadius: 22 },
  wrap: { padding: 18, paddingBottom: 24 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, marginTop: 6, gap: 12 },
  brandRow: { flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10 },
  brandIcon: { width: 42, height: 42, borderRadius: 12 },
  title: { fontSize: 21, fontWeight: '800', color: colors.milkDark },
  who: { color: colors.inkSoft, fontSize: 12, marginTop: 2 },
  entryFabWrap: { position: 'absolute', right: 18, bottom: 78, zIndex: 5 },
  entryFab: { minHeight: 52, zIndex: 20, elevation: 8, flexDirection: 'row', alignItems: 'center', gap: 7, backgroundColor: colors.milk, borderRadius: 30, paddingHorizontal: 18, paddingVertical: 15, ...shadow },
  sheetBackdrop: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.45)' },
  sheetToast: { position: 'absolute', zIndex: 100, elevation: 30, left: 16, right: 16, bottom: '58%', backgroundColor: colors.milkDark, padding: 14, borderRadius: radius.md },
  backdropTouch: { flex: 1 },
  sheetWrap: { maxHeight: '88%', backgroundColor: colors.bg, borderTopLeftRadius: 24, borderTopRightRadius: 24, paddingTop: 10 },
  sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: colors.line, marginBottom: 10 },
  sheetHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 18, paddingBottom: 8 },
  sheetTitle: { fontSize: 18, fontWeight: '700', color: colors.ink },
  sheetContent: { padding: 16, paddingBottom: 30 },
  entryFabText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
  bottomTabs: { flexDirection: 'row', backgroundColor: colors.panel, borderTopWidth: 1, borderTopColor: colors.line, paddingTop: 9, paddingBottom: 7, paddingHorizontal: 12 },
  bottomTabWrap: { flex: 1 },
  tabIndicator: { height: 3, width: 24, borderRadius: 2, backgroundColor: 'transparent', marginBottom: 4 },
  tabIndicatorOn: { backgroundColor: colors.milk },
  bottomTab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 3, paddingVertical: 3 },
  bottomTabText: { fontSize: 11, fontWeight: '600', color: colors.inkSoft },
  bottomTabTextOn: { color: colors.milk, fontWeight: '800' },
  loader: { alignItems: 'center', paddingVertical: 40 },
  loaderText: { color: colors.inkSoft, marginTop: 10, fontSize: 13 },
  loadError: {
    backgroundColor: colors.alertLight,
    color: colors.alert,
    padding: 12,
    borderRadius: radius.md,
    fontSize: 13,
    marginBottom: 14
  },
  listHeader: { marginBottom: 12 },
  listTitle: { fontSize: 17, fontWeight: '800', color: colors.milkDark },
  footer: { textAlign: 'center', marginTop: 24, fontSize: 11, color: colors.inkSoft },
  syncBox: { marginBottom: 14, gap: 8 },
  syncRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.bg,
    borderWidth: 1,
    borderColor: colors.line,
    padding: 12,
    borderRadius: radius.md
  },
  syncText: { flex: 1, color: colors.ink, fontSize: 12, lineHeight: 18 },
  syncBtn: { color: colors.milk, fontWeight: '800', fontSize: 13 },
  toast: {
    position: 'absolute',
    bottom: 88,
    left: 24,
    right: 24,
    backgroundColor: colors.milkDark,
    padding: 14,
    borderRadius: radius.md,
    alignItems: 'center'
  },
  toastErr: { backgroundColor: colors.alert },
  toastText: { color: '#fff', fontWeight: '600' },
  toastRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 }
})
