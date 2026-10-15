import { useState } from 'react'
import { ScrollView, StyleSheet, Text, View, TouchableOpacity } from 'react-native'
import * as ImagePicker from 'expo-image-picker'
import * as ImageManipulator from 'expo-image-manipulator'
import Input from './ui/Input'
import Button from './ui/Button'
import UpiCard from './UpiCard'
import BackupCard from './BackupCard'
import { radius } from '../theme/colors'
import { useTheme, useThemedStyles } from '../theme/ThemeContext'
import { useT, LANGS } from '../i18n'
import { useAuth } from '../context/AuthContext'
import { updateProfileName, updatePassword, sendPhoneOtp, verifyPhoneOtp, sendAccountDeleteOtp, removeAccount, logout, authErrorMessage, uploadProfilePhoto, deleteProfilePhoto } from '../services/authService'
import ItemsCard from './ItemsCard'
import SecurityCard from './SecurityCard'
import NotifyCard from './NotifyCard'
import QrModal from './QrModal'
import Avatar from './Avatar'
import Icon from './Icon'
import { usePopup } from './Popup'

export default function ProfileTab({pending=0,onSaveUpi,onData,onToast,onNotifyChanged}) {
 const {colors,styles}=useThemedStyles(makeStyles)
 const {mode,setMode,accent,setAccent}=useTheme()
 const {lang,setLang,tr}=useT()
 const {user}=useAuth()
 const popup=usePopup()
 const [name,setName]=useState(user?.name||'')
 const [oldPassword,setOldPassword]=useState('')
 const [newPassword,setNewPassword]=useState('')
 const [phone,setPhone]=useState(user?.phone||'')
 const [otp,setOtp]=useState('')
 const [devOtp,setDevOtp]=useState('')
 const [phoneStep,setPhoneStep]=useState(false)
 const [deletePassword,setDeletePassword]=useState('')
 const [deleteOtp,setDeleteOtp]=useState('')
 const [deleteDevOtp,setDeleteDevOtp]=useState('')
 const [deleteOtpSent,setDeleteOtpSent]=useState(false)
 const [busy,setBusy]=useState(false)
 const [photoBusy,setPhotoBusy]=useState(false)
 const [error,setError]=useState('')
 const [showQr,setShowQr]=useState(false)
 const accents=[['green','Green'],['blue','Blue'],['purple','Purple'],['orange','Orange']]
 async function choosePhoto(source) {
   try {
     setPhotoBusy(true)
     let result
     if (source === 'camera') {
       const permission = await ImagePicker.requestCameraPermissionsAsync()
       if (!permission.granted) { popup.notify({ tone: 'warn', icon: 'camera', title: tr('cameraPermissionTitle'), message: tr('cameraPermission') }); return }
       result = await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], quality: 1 })
     } else {
       const permission = await ImagePicker.requestMediaLibraryPermissionsAsync()
       if (!permission.granted) { popup.notify({ tone: 'warn', icon: 'image', title: tr('galleryPermissionTitle'), message: tr('galleryPermission') }); return }
       result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 1 })
     }
     if (result.canceled || !result.assets?.[0]?.uri) return
     const optimized = await ImageManipulator.manipulateAsync(result.assets[0].uri, [{ resize: { width: 256, height: 256 } }], { compress: 0.7, format: ImageManipulator.SaveFormat.JPEG, base64: true })
     if (!optimized.base64) throw new Error(tr('photoProcessError'))
     if (optimized.base64.length > 82000) throw new Error(tr('photoTooLarge'))
     await uploadProfilePhoto(optimized.base64)
     onToast?.(tr('photoSaved'))
   } catch (e) { setError(e.message || tr('photoUploadError')) }
   finally { setPhotoBusy(false) }
 }
 async function photoOptions() {
   const pick = await popup.choose({
     icon: 'camera',
     title: tr('profilePhoto'),
     message: tr('choosePhoto'),
     options: [
       { key: 'gallery', label: tr('gallery'), icon: 'image' },
       { key: 'camera', label: tr('camera'), icon: 'camera' },
       ...(user?.hasPhoto ? [{ key: 'remove', label: tr('removePhoto'), icon: 'trash', tone: 'danger' }] : [])
     ]
   })
   if (pick === 'gallery' || pick === 'camera') choosePhoto(pick)
   else if (pick === 'remove') run(async () => { await deleteProfilePhoto() }, tr('photoRemoved'))
 }
 async function run(fn, success) {
   setBusy(true);setError('')
   try { await fn(); onToast?.(success||tr('saved')); }
   catch(e){setError(authErrorMessage(e));}
   finally{setBusy(false)}
 }
 return <ScrollView contentContainerStyle={styles.wrap} keyboardShouldPersistTaps="handled">
  <Text style={styles.title}>{tr('profile')}</Text>
  <Text style={styles.help}>{tr('profileHelp')}</Text>
  <View style={[styles.card, styles.photoCard]}>
   <TouchableOpacity onPress={photoOptions} disabled={photoBusy} style={styles.photoTap} accessibilityLabel={tr('changePhoto')}>
    <View><Avatar name={user?.name} userId={user?.id} hasPhoto={user?.hasPhoto} photoVersion={user?.photoVersion} size={104}/><View style={[styles.cameraBadge,{backgroundColor:colors.milk}]}><Icon name="camera" size={16} color="#FFFFFF" cut={colors.milk} /></View></View>
    <View style={{flex:1,marginLeft:14}}><Text style={styles.section}>{user?.name || tr('profile')}</Text><Text style={styles.meta}>{user?.email || (user?.phone ? '+91 '+user.phone : '')}</Text><Text style={styles.photoAction}>{photoBusy ? tr('photoUploading') : tr('changePhoto')}</Text></View>
   </TouchableOpacity>
  </View>
  <View style={styles.card}>
   <Text style={styles.section}>{tr('account')}</Text>
   <Text style={styles.meta}>{user?.email || user?.phone || ''}</Text>
   <Input label={tr('name')} value={name} onChangeText={setName} placeholder={tr('name')} />
   <Button title={tr('save')} icon="checkmark" loading={busy} onPress={()=>run(async()=>{const u=await updateProfileName(name);setName(u.name)},tr('saved'))}/>
   <View style={styles.separator}/>
   <Text style={styles.section}>{tr('phone')}</Text>
   <Text style={styles.meta}>{user?.phone ? '+91 '+user.phone : tr('noPhone')}</Text>
   {phoneStep ? <>
    <Input label={tr('phone')} value={phone} onChangeText={setPhone} keyboardType="number-pad" maxLength={10} prefix="+91" placeholder="98XXXXXXXX"/>
    <Button title={tr('sendOtp')} loading={busy} onPress={()=>run(async()=>{const r=await sendPhoneOtp(phone);setDevOtp(r.devOtp||'');setOtp('')},tr('sendOtp'))}/>
    <Input label="OTP" value={otp} onChangeText={setOtp} keyboardType="number-pad" maxLength={6} placeholder="6 digit OTP"/>
    {devOtp ? <Text style={styles.meta}>Test OTP: {devOtp}</Text>:null}
    <Button title={tr('verify')} loading={busy} onPress={()=>run(async()=>{await verifyPhoneOtp(phone,otp);setPhoneStep(false)},tr('saved'))}/>
   </>:<Button title={tr('addPhone')} variant="ghost" onPress={()=>setPhoneStep(true)}/>}
   <View style={styles.separator}/>
   <Text style={styles.section}>{tr('password')}</Text>
   <Input label={tr('oldPassword')} value={oldPassword} onChangeText={setOldPassword} secureTextEntry placeholder="••••••"/>
   <Input label={tr('newPassword')} value={newPassword} onChangeText={setNewPassword} secureTextEntry placeholder={tr('passwordMinHint')}/>
   <Button title={tr('password')} loading={busy} onPress={()=>run(async()=>{await updatePassword(oldPassword,newPassword);setOldPassword('');setNewPassword('');popup.notify({tone:'success',title:tr('password'),message:tr('loginAgain')||'Password changed. Please log in again.'})},tr('saved'))}/>
  </View>
  <View style={styles.card}>
   <Text style={styles.section}>{tr('language')}</Text>
   <View style={styles.row}>{LANGS.map(x=><TouchableOpacity key={x.key} onPress={()=>setLang(x.key)} style={[styles.choice,lang===x.key&&styles.selected]} accessibilityRole="button"><Text style={[styles.choiceText,lang===x.key&&styles.choiceTextOn]}>{x.label}</Text></TouchableOpacity>)}</View>
   <Text style={styles.section}>{tr('theme')}</Text>
   <View style={styles.row}>{[['light',tr('light')],['dark',tr('dark')]].map(([k,v])=><TouchableOpacity key={k} onPress={()=>setMode(k)} style={[styles.choice,mode===k&&styles.selected]} accessibilityRole="button"><Text style={[styles.choiceText,mode===k&&styles.choiceTextOn]}>{v}</Text></TouchableOpacity>)}</View>
   <Text style={styles.section}>{tr('accent')}</Text>
   <View style={styles.row}>{accents.map(([k,v])=><TouchableOpacity key={k} onPress={()=>setAccent(k)} style={[styles.choice,accent===k&&styles.selected]} accessibilityRole="button"><Text style={[styles.choiceText,accent===k&&styles.choiceTextOn]}>{v}</Text></TouchableOpacity>)}</View>
  </View>
  {user?.role !== 'buyer' ? <View style={styles.card}>
   <UpiCard upiId={user?.upiId} onSave={onSaveUpi}/>
   {user?.upiId ? <Button title={tr('showMyQr')} variant="ghost" onPress={()=>setShowQr(true)} style={{marginTop:12}}/> : null}
   <BackupCard onData={onData} onToast={onToast}/>
  </View> : null}
  {user?.role !== 'buyer' ? <ItemsCard onToast={onToast}/> : null}
  {user?.role !== 'buyer' ? <NotifyCard onToast={onToast} onChanged={onNotifyChanged}/> : null}
  <SecurityCard onToast={onToast}/>
  <QrModal visible={showQr} onClose={()=>setShowQr(false)} upiId={user?.upiId} name={user?.name}/>
  {error ? <Text style={styles.error}>{error}</Text>:null}
  <View style={styles.card}>
   <Button title={tr('logout')} variant="ghost" icon="logout" onPress={async()=>{if(await popup.confirm({tone:'danger',icon:'logout',title:tr('logout'),message:tr('logout')+'?',confirmText:tr('logout')}))logout()}}/>
   <View style={{height:10}}/>
   <Text style={styles.meta}>{tr('deleteConfirm')}</Text>
   {user?.email ? <>
    <Input label={tr('confirmPassword')} value={deletePassword} onChangeText={setDeletePassword} secureTextEntry placeholder="••••••"/>
    <Button title={tr('yesDelete')} tone="danger" icon="trash" loading={busy} onPress={async()=>{if(await popup.confirm({tone:'danger',icon:'trash',title:tr('delete'),message:tr('deleteConfirm'),confirmText:tr('yesDelete')}))run(async()=>{await removeAccount({password:deletePassword});setDeletePassword('')},tr('delete'))}}/>
   </> : <>
    {user?.phone ? <>
     <Button title={deleteOtpSent ? tr('resendOtp') : tr('sendOtp')} loading={busy} onPress={()=>run(async()=>{const r=await sendAccountDeleteOtp();setDeleteDevOtp(r.devOtp||'');setDeleteOtpSent(true)},tr('sendOtp'))}/>
     {deleteDevOtp ? <Text style={styles.meta}>Test OTP: {deleteDevOtp}</Text> : null}
     <Input label="OTP" value={deleteOtp} onChangeText={setDeleteOtp} keyboardType="number-pad" maxLength={6} placeholder="6 digit OTP"/>
     <Button title={tr('yesDelete')} tone="danger" icon="trash" loading={busy} onPress={async()=>{if(await popup.confirm({tone:'danger',icon:'trash',title:tr('delete'),message:tr('deleteConfirm'),confirmText:tr('yesDelete')}))run(async()=>{await removeAccount({otp:deleteOtp})},tr('delete'))}}/>
    </> : <Text style={styles.error}>{tr('deleteNeedsPhone')}</Text>}
   </>}
  </View>
 </ScrollView>
}
function makeStyles(c){return StyleSheet.create({
 wrap:{paddingBottom:28,gap:14},photoCard:{paddingVertical:14},photoTap:{flexDirection:'row',alignItems:'center'},cameraBadge:{position:'absolute',right:0,bottom:0,width:30,height:30,borderRadius:15,alignItems:'center',justifyContent:'center',borderWidth:2,borderColor:c.panel},photoAction:{color:c.milk,fontSize:13,fontWeight:'800',marginTop:4},title:{fontSize:24,fontWeight:'800',color:c.milkDark},help:{color:c.inkSoft,fontSize:13,marginTop:-8},
 card:{backgroundColor:c.panel,borderColor:c.line,borderWidth:1,borderRadius:radius.lg,padding:16,marginBottom:2},
 section:{fontSize:15,fontWeight:'800',color:c.ink,marginBottom:10},meta:{fontSize:12,color:c.inkSoft,marginBottom:10},
 separator:{height:1,backgroundColor:c.line,marginVertical:16},row:{flexDirection:'row',flexWrap:'wrap',gap:8,marginBottom:14},
 choice:{overflow:'hidden',borderWidth:1,borderColor:c.line,borderRadius:10,paddingVertical:10,paddingHorizontal:14,minHeight:44,justifyContent:'center'},choiceText:{color:c.ink,fontWeight:'600',fontSize:14},choiceTextOn:{color:c.milkDark},
 selected:{backgroundColor:c.milkLight,borderColor:c.milk,color:c.milkDark},error:{color:c.alert,backgroundColor:c.alertLight,padding:10,borderRadius:radius.md}
})}
