## v1.12.3 — Play Store preparation
- Configured production API URL: `https://v-khatabook.onrender.com`.
- Android package ID and iOS bundle identifier: `com.bolkhata.app`.
- See `PLAY-STORE-RELEASE-CHECKLIST.md` at the project root before publishing.

## v1.11.2
- Added English/Hindi auth copy keys, additional translations for backup, UPI, reports, and linked accounts, and the microphone accessibility label.
- Toast feedback uses explicit kinds; entry-save checkmark and selected-tab icon animations respect reduced motion.
- Refined icon geometry and regenerated PNG assets.
- Server/device verification remains environment-dependent; see release notes provided with this archive.

# Bol-khata — React Native (Expo) App

यह वही ऐप है, अब असली Android app के रूप में — जिससे आप `.apk`/`.aab` बनाकर Play Store पर डाल सकते हो।

**ज़रूरी बात पहले:** APK बनाने के लिए internet चाहिए (Expo के cloud build service से बनता है) — यह मैं यहाँ नहीं कर सकता, लेकिन नीचे दिए commands आपके अपने कंप्यूटर पर चलाकर आप असली APK बना पाओगे।

## Expo Go में testing (सबसे तेज़ तरीका)

> पहले `server/` चालू करो (MongoDB के साथ) — देखो `../SETUP.md`। App का server address अपने आप मिल जाता है।

```bash
cd bol-khata-rn
npm install
npx expo start
```

Terminal में एक QR code दिखेगा — फ़ोन में **Expo Go app** (Play Store से install करो) खोलकर scan करो। ऐप खुल जाएगा और manual entry, customer list, stats — सब चलेगा।

**माइक बटन दबाओगे तो voice काम नहीं करेगा** (सिर्फ एक message दिखेगा) — यह normal है, Expo Go में native voice module सपोर्ट नहीं होता। पूरा voice feature टेस्ट करने के लिए नीचे "development build" बनाना होगा।

## Setup (पहली बार — पूरा build करने के लिए)

**ज़रूरी चीज़ें:**
- [Node.js](https://nodejs.org) (version 18+)
- एक फ्री [Expo account](https://expo.dev/signup)

```bash
# 1. इस folder में जाओ
cd bol-khata-rn

# 2. dependencies install करो
npm install

# 3. EAS CLI install करो (build tool)
npm install -g eas-cli

# 4. अपने Expo account से login करो
eas login
```

## Testing के लिए चलाना (Development)

रोज़-रोज़ के testing के लिए, पूरा APK बनाने की ज़रूरत नहीं — सीधे फ़ोन पर चला सकते हो:

```bash
npx expo start
```

**ध्यान दें:** इस ऐप में voice recognition के लिए एक "native module" (`expo-speech-recognition`) इस्तेमाल हुआ है, इसलिए सादा **Expo Go app से यह पूरा नहीं चलेगा** — माइक वाला feature टेस्ट करने के लिए आपको नीचे दिया "development build" बनाना होगा (एक बार):

```bash
eas build --profile development --platform android
```

यह एक installable APK देगा (link आपके terminal/email में आएगा) — उसे फ़ोन में install करो, फिर उसी के अंदर `npx expo start` से live development चलेगा।

## असली APK बनाना (टेस्ट/दोस्तों को भेजने के लिए)

```bash
eas build --profile preview --platform android
```

कुछ मिनट बाद एक download link मिलेगा — वो `.apk` file है, सीधे किसी भी Android फ़ोन में install हो जाएगी (Play Store की ज़रूरत नहीं, बस "unknown sources" install allow करना होगा फ़ोन में)।

## Play Store पर डालने के लिए (असली Publish)

Play Store `.apk` नहीं, `.aab` (Android App Bundle) माँगता है:

```bash
eas build --profile production --platform android
```

Play Store पर डालने के लिए इन चीज़ों की भी ज़रूरत पड़ेगी (ये सिर्फ code से नहीं होतीं):

1. **Google Play Console account** — एक बार का $25 (लगभग ₹2000) registration fee
2. **App का असली package name तय करना** — अब package ID `com.bolkhata.app` है। Play Console में इसी ID से app बनाएं; publish करने के बाद इसे बदलना संभव नहीं होता
3. **App icon और screenshots** — Play Store पर दिखाने के लिए (अभी placeholder हैं, असली icon `assets/icon.png` में डालना होगा)
4. **Privacy Policy link** — Play Store हर app के लिए यह माँगता है, भले app simple हो
5. Play Console में जाकर बना हुआ `.aab` upload करना, app की जानकारी भरना, फिर "Submit for review" — Google इसे review करता है (आमतौर पर कुछ दिन लगते हैं)

## Project Structure

```
bol-khata-rn/
├── App.js                    # मुख्य screen
├── app.json                  # App का नाम, package id, permissions
├── eas.json                  # Build settings (APK/AAB कैसे बनें)
├── src/
│   ├── components/
│   │   ├── VoiceEntry.js      # माइक + speech recognition
│   │   ├── ManualEntryForm.js
│   │   ├── CustomerList.js
│   │   └── StatsBar.js
│   ├── services/
│   │   ├── api.js             # server को call (timeout + Hindi errors)
│   │   ├── authService.js     # signup / login / OTP / logout
│   │   ├── dataService.js     # ग्राहक और entries (सिर्फ़ फ़ोन में, AsyncStorage)
│   │   └── parseHindiSpeech.js
│   └── theme/
│       └── colors.js
```

## Data और Login

Login account `server/` के ज़रिए MongoDB में रहता है; ledger (ग्राहक, उधार/पैसे, वजह) भी server के ज़रिए MongoDB में रहता है। Firebase इस्तेमाल नहीं होता। पूरा setup `../SETUP.md` में है।

## जानी हुई सीमाएँ

- `com.yourname.bolkhata` package name ज़रूर बदलना — Play Store पर unique होना चाहिए
- App icon अभी placeholder है — `assets/` folder में असली icon files डालनी होंगी (1024x1024 png)
- Voice recognition की accuracy फ़ोन के Android version और भाषा-pack पर निर्भर करती है — अलग-अलग फ़ोन पर टेस्ट करना ज़रूरी
- Login MongoDB में है, ledger सिर्फ़ फ़ोन में — uninstall करने पर ledger चला जाएगा (backup नहीं है)
- Real SMS OTP के लिए SMS provider जोड़ना बाकी है — SETUP.md में लिखा है


## v1.7.0 update

- Added a Profile tab for editing the account name, linking a mobile number by OTP, changing the password, and deleting the account.
- Added mobile-number Signup as a separate OTP flow. OTP Login now works only for an existing account; new users should use Signup first.
- Added Hindi/English preference, light/dark appearance, and accent-colour settings in Profile.
- Server additions: profile name/password/mobile endpoints and authenticated account deletion.
- The SMS provider must be configured on the server for production OTP delivery. A development OTP is shown only when the server's `DEV_SHOW_OTP` setting is enabled.


## Version 1.8.0 — account security and OTP fixes

- Fixed mobile-link OTP validation and restricted verification to the matching OTP purpose.
- Added API integration coverage for signup/login OTP, profile name, mobile linking, password changes, and account deletion.
- Revokes existing sessions after password changes and rejects tokens for deleted users.
- Requires password confirmation for password accounts and an SMS OTP for mobile-only account deletion.
- Removes account-specific offline queue/cache after successful deletion.
- Adds password-change and OTP verification rate limits; avoids sending signup OTPs to already registered numbers without revealing account status.

Validation note: server syntax checks are available locally; the MongoDB integration suite requires `TEST_MONGODB_URI` and installed server dependencies.


## Version 1.9.0 — profile avatar and navigation update

- Replaced the milk emoji header with the existing book-and-₹ app icon and a tappable account avatar.
- Added a bottom navigation bar for My shop, My accounts, and Profile.
- Added profile-photo selection (gallery/camera), square crop, 256×256 JPEG optimization, and a local base64 cache for offline display.
- Added authenticated photo upload/delete endpoints and a public cacheable photo endpoint. Uploads are limited to JPEG signatures and 60 KB; photo payload parsing is limited to the photo route only.
- Added shop-owner avatars to the customer-facing My accounts list.
- Made the authentication shell and StatusBar respond to light/dark theme.
- Login/signup rate limit now keys by IP + normalized account identifier, and test limits can be configured with `AUTH_LOGIN_LIMIT` / `AUTH_LOGIN_WINDOW_MS` (or test config values).

Before building, run this in `bol-khata-rn/` to let Expo resolve SDK-compatible package versions and refresh the lockfile:

```sh
npx expo install @expo/vector-icons expo-image-picker expo-image-manipulator
npm install
```

Validation in the patching environment was limited because npm registry DNS was unavailable; the new Expo packages could not be installed here, so an Expo bundle/runtime build still needs to be run after installing them. MongoDB-backed API tests also require `TEST_MONGODB_URI`.


## Version 1.10.0 — UI consistency pass

- Wired the theme context into StatsBar, CustomerList, VoiceEntry, ManualEntryForm, DailyCard, ReportCard, UpiCard, BackupCard, CustomerDetail, TransactionHistory, Login, Signup and OTP screens.
- Darkened secondary text for improved contrast and made profile preference choices real, larger touch targets.
- Replaced several emoji controls with Ionicons and improved customer rows with the shared Avatar component, activity date and compact status badges.
- Reordered the shop screen to show stats and customers first; moved entry tools behind an Add Entry action, moved reports to My Accounts, and removed duplicate UPI/backup cards from the home screen.
- Moved the toast above the bottom tab bar and made pending/offline status visually neutral.
- Added a logo-based splash asset, optimized app icon assets, and set a release-style Android/iOS identifier (`com.vkhatabook.ledger`).

Validation: JavaScript/JSX syntax transpilation passed. This environment did not run an Expo device build or visual tests; verify Light/Dark × Hindi/English on small and large devices before release. Full translation coverage, profile sub-screens, Undo, voice-result editing/pulse animation, biometric lock and navigation-stack migration remain follow-up work.


## v1.11.0 update notes

- Updated the app version to 1.11.0 in Expo and npm metadata.
- Moved entry-save toast rendering into the entry modal while it is open, so errors/success messages remain visible above the sheet.
- Added Hindi/English translation keys and wired Manual Entry, Voice Entry, and Daily Entry labels, hints, and validation messages to the selected language.

Validation in this delivery: JavaScript/JSX syntax parsing passed for 35 files. This is not a substitute for running the app on a device; Expo Go/development-build, server integration, offline sync, and UI combinations still need runtime testing.


## v1.11.1
- Fixed Render-safe server branding import and added current/legacy backup-name compatibility coverage.
- Wired reusable press, staggered card and count-up animations; added listening pulse/waveform and loading skeletons.
- Improved accessible tab/FAB/microphone controls, toast entrance, loading splash alignment and icon source artwork.
- Added interpolation support to Hindi/English translations and bumped package versions.
- Device/emulator verification is still required before production release.

- Haptics are optional until `expo-haptics` is installed; before a native release, run `npx expo install expo-haptics`, then rebuild the development client.
- `npm test` could not be completed in the build environment because server dependencies were unavailable; run it after `npm ci` in `server/`.


## v1.11.2 maintenance notes

- Expo image picker now has native camera/photo-library permission copy configured for development and production builds.
- Keep `.env`, `.dev-jwt-secret`, `.expo/`, `.git/`, and `node_modules/` out of shared ZIPs.
- Server dependency and error logging hardening are documented in the repository root changelog.
