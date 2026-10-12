import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { AccessibilityInfo, Animated, Easing, Modal, Pressable, StyleSheet, Text, View } from 'react-native'
import Icon from './Icon'
import PressScale from './anim/PressScale'
import { radius, shadow } from '../theme/colors'
import { useThemedStyles } from '../theme/ThemeContext'
import { useT } from '../i18n'

// Animated popup — system Alert ki jagah.
//   const popup = usePopup()
//   if (await popup.confirm({ tone: 'danger', icon: 'trash', title: '…', message: '…', confirmText: 'हटाओ' })) { … }
//   await popup.notify({ tone: 'success', title: '…', message: '…' })
//   const key = await popup.choose({ title: '…', options: [{ key: 'edit', label: 'बदलो', icon: 'create-outline' }] })   // null = रद्द
// tone: 'info' (default) | 'success' | 'danger' | 'warn'

const PopupCtx = createContext(null)
const HostCtx = createContext(null)
let hostSeq = 0
export const usePopup = () => {
  const api = useContext(PopupCtx)
  if (!api) throw new Error('usePopup ko PopupProvider ke andar use karo')
  return api
}

const DEFAULT_ICON = { info: 'info', success: 'checkmark-circle', danger: 'warning', warn: 'warning' }
const EMPTY_RESULT = { confirm: false, notify: true, choose: null }

export function PopupProvider({ children }) {
  const [current, setCurrent] = useState(null)
  const [hosts, setHosts] = useState([])
  const active = useRef(null)
  const queue = useRef([])
  const seq = useRef(0)

  const present = useCallback((kind, opts) => new Promise((resolve) => {
    const entry = { id: ++seq.current, kind, opts: opts || {}, resolve }
    if (active.current) queue.current.push(entry)
    else { active.current = entry; setCurrent(entry) }
  }), [])

  const finish = useCallback((entry, result) => {
    entry.resolve(result === undefined ? EMPTY_RESULT[entry.kind] : result)
    const next = queue.current.shift() || null
    active.current = next
    setCurrent(next)
  }, [])

  // Popup hamesha sabse upar wale "host" me dikhta hai. Native Modal ke andar (jaise CustomerDetail) ek
  // <PopupHost /> lagao, warna iOS par popup us Modal ke peeche chhup sakta hai.
  const registerHost = useCallback((id) => {
    setHosts((h) => [...h, id])
    return () => setHosts((h) => h.filter((x) => x !== id))
  }, [])

  const api = useMemo(() => ({
    confirm: (o) => present('confirm', o),
    notify: (o) => present('notify', o),
    choose: (o) => present('choose', o)
  }), [present])
  const host = useMemo(() => ({ current, hosts, finish, registerHost }), [current, hosts, finish, registerHost])

  return (
    <PopupCtx.Provider value={api}>
      <HostCtx.Provider value={host}>
        {children}
        <PopupHost />
      </HostCtx.Provider>
    </PopupCtx.Provider>
  )
}

export function PopupHost() {
  const host = useContext(HostCtx)
  const idRef = useRef(null)
  if (!idRef.current) idRef.current = 'host' + ++hostSeq
  const register = host && host.registerHost
  useEffect(() => (register ? register(idRef.current) : undefined), [register])
  if (!host || !host.current || host.hosts[host.hosts.length - 1] !== idRef.current) return null
  return <PopupModal key={host.current.id} entry={host.current} onDone={host.finish} />
}

export function PopupModal({ entry, onDone }) {
  const { colors, styles } = useThemedStyles(makeStyles)
  const { lang, tr } = useT()
  const { kind, opts } = entry
  const tone = opts.tone || 'info'
  const toneColor = tone === 'danger' ? colors.alert : tone === 'warn' ? colors.gold : colors.milk
  const toneSoft = tone === 'danger' ? colors.alertLight : tone === 'warn' ? '#FBF1DC' : colors.milkLight
  const iconName = opts.icon || DEFAULT_ICON[tone]

  const backdrop = useRef(new Animated.Value(0)).current
  const p = useRef(new Animated.Value(0)).current        // card: aana / jaana
  const iconScale = useRef(new Animated.Value(0)).current // icon ka "pop"
  const pulse = useRef(new Animated.Value(0)).current     // icon ke peeche failti ring
  const shake = useRef(new Animated.Value(0)).current     // danger/warn me halka hilna
  const reduceRef = useRef(false)
  const closing = useRef(false)

  useEffect(() => {
    let alive = true
    const anims = []
    const run = (a, cb) => { anims.push(a); a.start(cb) }
    const play = (reduce) => {
      if (!alive) return
      reduceRef.current = reduce
      if (reduce) { backdrop.setValue(1); p.setValue(1); iconScale.setValue(1); return }
      run(Animated.parallel([
        Animated.timing(backdrop, { toValue: 1, duration: 200, useNativeDriver: true }),
        Animated.spring(p, { toValue: 1, speed: 15, bounciness: 9, useNativeDriver: true })
      ]))
      run(Animated.sequence([
        Animated.delay(150),
        Animated.spring(iconScale, { toValue: 1, speed: 13, bounciness: 17, useNativeDriver: true })
      ]), ({ finished }) => {
        if (!finished || !alive || (tone !== 'danger' && tone !== 'warn')) return
        run(Animated.sequence([-7, 7, -5, 5, -2, 0].map((v) => Animated.timing(shake, { toValue: v, duration: 55, useNativeDriver: true }))))
      })
      run(Animated.loop(Animated.timing(pulse, { toValue: 1, duration: 1300, easing: Easing.out(Easing.quad), useNativeDriver: true }), { iterations: 3 }))
    }
    AccessibilityInfo.isReduceMotionEnabled().then(play).catch(() => play(false))
    return () => { alive = false; anims.forEach((a) => a.stop()) }
  }, [backdrop, p, iconScale, pulse, shake, tone])

  function close(result) {
    if (closing.current) return
    closing.current = true
    if (reduceRef.current) return onDone(entry, result)
    Animated.parallel([
      Animated.timing(backdrop, { toValue: 0, duration: 160, useNativeDriver: true }),
      Animated.timing(p, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: true })
    ]).start(() => onDone(entry, result))
  }

  const cancelText = opts.cancelText || tr('cancel')
  const okText = opts.okText || (lang === 'hi' ? 'ठीक है' : 'OK')
  const yesText = opts.confirmText || (lang === 'hi' ? 'हाँ' : 'Yes')
  const dismiss = () => close(kind === 'notify' ? true : kind === 'confirm' ? false : null)

  const cardStyle = {
    opacity: p.interpolate({ inputRange: [0, 0.6, 1], outputRange: [0, 1, 1], extrapolate: 'clamp' }),
    transform: [
      { translateY: p.interpolate({ inputRange: [0, 1], outputRange: [46, 0] }) },
      { scale: p.interpolate({ inputRange: [0, 1], outputRange: [0.88, 1] }) }
    ]
  }

  return (
    <Modal visible transparent animationType="none" statusBarTranslucent onRequestClose={dismiss}>
      <View style={styles.root}>
        <Animated.View style={[StyleSheet.absoluteFill, styles.backdrop, { opacity: backdrop }]}>
          <Pressable style={{ flex: 1 }} onPress={dismiss} accessibilityLabel={cancelText} />
        </Animated.View>

        <Animated.View style={[styles.card, shadow, cardStyle]} accessibilityViewIsModal>
          <View style={styles.iconWrap}>
            <Animated.View style={[styles.pulse, { backgroundColor: toneColor, opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.32, 0] }), transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.9] }) }] }]} />
            <Animated.View style={[styles.badge, { backgroundColor: toneSoft, transform: [{ scale: iconScale }, { translateX: shake }] }]}>
              <Icon name={iconName} size={34} color={toneColor} cut={toneSoft} />
            </Animated.View>
          </View>

          {opts.title ? <Text style={styles.title}>{opts.title}</Text> : null}
          {opts.message ? <Text style={styles.message}>{opts.message}</Text> : null}

          {kind === 'choose' ? (
            <View style={styles.options}>
              {(opts.options || []).map((o) => {
                const c = o.tone === 'danger' ? colors.alert : colors.milk
                const soft = o.tone === 'danger' ? colors.alertLight : colors.milkLight
                return (
                  <PressScale key={o.key} style={styles.optionWrap} innerStyle={[styles.option, { backgroundColor: soft }]} onPress={() => close(o.key)} accessibilityLabel={o.label}>
                    {o.icon ? <Icon name={o.icon} size={22} color={c} cut={soft} /> : null}
                    <Text style={[styles.optionText, { color: c }]}>{o.label}</Text>
                  </PressScale>
                )
              })}
              <PressScale style={styles.optionWrap} innerStyle={styles.cancelOnly} onPress={() => close(null)} accessibilityLabel={cancelText}>
                <Text style={styles.cancelText}>{cancelText}</Text>
              </PressScale>
            </View>
          ) : (
            <View style={styles.row}>
              {kind === 'confirm' ? (
                <PressScale style={styles.btnWrap} innerStyle={[styles.btn, styles.btnGhost]} onPress={() => close(false)} accessibilityLabel={cancelText}>
                  <Text style={styles.btnGhostText}>{cancelText}</Text>
                </PressScale>
              ) : null}
              <PressScale style={styles.btnWrap} innerStyle={[styles.btn, { backgroundColor: toneColor }]} onPress={() => close(true)} accessibilityLabel={kind === 'confirm' ? yesText : okText}>
                <Text style={styles.btnText}>{kind === 'confirm' ? yesText : okText}</Text>
              </PressScale>
            </View>
          )}
        </Animated.View>
      </View>
    </Modal>
  )
}

const makeStyles = (colors) => StyleSheet.create({
  root: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 24 },
  backdrop: { backgroundColor: 'rgba(8,18,14,0.58)' },
  card: { width: '100%', maxWidth: 360, backgroundColor: colors.panel, borderRadius: radius.lg + 6, paddingHorizontal: 20, paddingTop: 26, paddingBottom: 18, alignItems: 'center' },
  iconWrap: { width: 74, height: 74, alignItems: 'center', justifyContent: 'center', marginBottom: 14 },
  pulse: { position: 'absolute', width: 74, height: 74, borderRadius: 37 },
  badge: { width: 74, height: 74, borderRadius: 37, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 19, fontWeight: '800', color: colors.ink, textAlign: 'center' },
  message: { fontSize: 14, lineHeight: 20, color: colors.inkSoft, textAlign: 'center', marginTop: 8 },
  row: { flexDirection: 'row', gap: 10, marginTop: 22, alignSelf: 'stretch' },
  btnWrap: { flex: 1 },
  btn: { height: 48, borderRadius: radius.md, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#FFFFFF', fontWeight: '800', fontSize: 15 },
  btnGhost: { backgroundColor: colors.bg, borderWidth: 1.5, borderColor: colors.line },
  btnGhostText: { color: colors.ink, fontWeight: '700', fontSize: 15 },
  options: { alignSelf: 'stretch', marginTop: 18, gap: 10 },
  optionWrap: { alignSelf: 'stretch' },
  option: { height: 50, borderRadius: radius.md, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 10 },
  optionText: { fontWeight: '800', fontSize: 15 },
  cancelOnly: { height: 44, alignItems: 'center', justifyContent: 'center' },
  cancelText: { color: colors.inkSoft, fontWeight: '700', fontSize: 14 }
})
