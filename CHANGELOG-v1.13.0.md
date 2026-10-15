# Bol-khata v1.13.0

## Naya
- **Home header**: ऐप का नाम/आइकन हटाकर यूज़र का नाम (दुकान/बिज़नेस का नाम) + बिज़नेस प्रकार + मोबाइल दिखता है।
- **Onboarding**: पहली बार खुलने पर आइकन का animation popup, फिर 3 slides (Skip / भाषा बदलना), फिर Login/Signup (मोबाइल या ईमेल + OTP — पहले जैसा)।
- **Business type + आइटम सूची**: seller पहली बार business type चुनता है → उस type के हिंदी/English तैयार आइटम (चुन/हटा सकता है) → Profile > "मेरे आइटम" में अपना आइटम (नाम, unit, रेट) जोड़ना/हटाना।
- **Itemized entry**: एंट्री में आइटम चुनो, मात्रा × रेट; कुल अपने-आप। Server कुल खुद निकालता है (≤20 आइटम)। History में आइटम दिखते हैं; offline queue में भी काम करता है। Backup/Restore में आइटम शामिल।
- **Buyer view**: जुड़े हुए दुकानदार का नाम, बिज़नेस, मोबाइल, UPI ID, खरीदे आइटम, बकाया; "UPI से भरें" (बकाया रकम के साथ) और "QR दिखाएँ"।
- **UPI QR**: Profile में "मेरा UPI QR दिखाएँ" + शेयर। QR बिना किसी library के बनता है (`src/utils/qr.js`).
- **PIN / fingerprint lock**: 4 अंक PIN (फ़ोन में salt+hash), 5 गलत के बाद रुकना, 20 सेकंड बैकग्राउंड के बाद दोबारा लॉक, fingerprint/face (अगर package हो), "PIN भूल गए" = logout.
- **शाम का notification**: "आज ₹X उधार गया, ₹Y बाकी है।" (7/8/9 PM), phone पर schedule होता है।
- **पिछली एंट्री दोहराओ + नाम suggestion** (ManualEntryForm).
- **PDF statement**: CustomerDetail में "हिसाब PDF share करो" (package न हो तो पुराना text share)।

## Server
- `Transaction.i` (items), `POST /transactions` में `items`, `POST /items/seed`, `/my-accounts` में `shopPhone/shopUpiId/shopBusinessType`.
- नया test: `server/test/items.test.js` (बिना database चलता है — pass).

## ज़रूरी: 4 नए packages (optional, पर features के लिए चाहिए)
```
cd bol-khata-rn
npx expo install expo-local-authentication expo-notifications expo-print expo-sharing
```
इनके बिना ऐप चलता है; बस fingerprint, notification, PDF काम नहीं करेंगे (PIN, QR, items फिर भी चलते हैं)।
Android Expo Go में notifications सीमित हो सकते हैं — development build पर पक्का चलेंगे।

## क्या जाँचा गया और क्या नहीं
- जाँचा: esbuild bundle (syntax/imports), undefined-name check, QR encoder (111 अलग लंबाइयाँ independent decoder से decode), SHA-256 (Node crypto से मिलान), items.js unit tests, server files `node --check`.
- **नहीं जाँचा**: ऐप फ़ोन/Expo Go पर नहीं चलाई जा सकी; server का MongoDB integration test (`api.test.js`) यहाँ नहीं चला (registry/Mongo blocked)। पहले अपने फ़ोन पर चलाकर देखें, कुछ अटके तो error भेजें।
- सीमा: PIN सिर्फ़ फ़ोन-लेवल लॉक है (4 अंक); seller का QR UPI ID से बनता है (अलग QR image upload नहीं)।
