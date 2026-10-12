# Bol-khata — React Native (Expo Go) + MongoDB setup

Do hisse:
- `bol-khata-rn/` → mobile app (Expo SDK 57, Expo Go me chalti hai, development build ki zaroorat nahi)
- `server/`       → chhota Node backend — login, ledger aur UPI pay page (MongoDB me)

**Firebase nahi hai.** Kaun kahan rehta hai:
- User account (naam, email/phone, password hash) → MongoDB (server ke through)
- Ledger (customers, udhar, payment, vajah) → MongoDB (server ke through).
- **One seller → multiple buyer accounts supported:** seller har customer ka alag khata banata hai; har khate ka unique 6-character invite code hota hai. Har buyer apne account se us customer-record ka code enter karke link kar sakta hai. Is tarah ek seller ke kai buyer accounts link ho sakte hain. Har customer-record code ke zariye ek buyer account se link hota hai; ek buyer apne `मेरे खाते` section mein multiple sellers ke linked accounts dekh sakta hai.

App seedha MongoDB se connect nahi hoti (password phone me leak ho jaata), isliye beech me ye server hai.


## 1. MongoDB Atlas
1. cloud.mongodb.com → free cluster → Database Access me user banao.
2. Network Access → apna IP (shuru me `0.0.0.0/0`, baad me restrict karo).
3. Connect → Drivers se connection string copy karo.

## 2. Server chalana (laptop par)
```bash
cd server
npm install
cp .env.example .env
```
`.env` me bharo:
- `MONGODB_URI` — Atlas wali string
- `JWT_SECRET` — random key (kam se kam 32 akshar). Banane ke liye:
  `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"`
- `DEV_SHOW_OTP=true` — testing me OTP app ki screen par dikhega

```bash
npm start        # "Server chal raha hai, port 4000"
```

## 3. App chalana (Expo Go me test)
```bash
cd bol-khata-rn
npm install
npx expo start
```
Phone me **Expo Go** se QR scan karo (Android par Expo Go ke andar "Scan QR code" se, camera app se nahi).
Phone aur laptop **same WiFi** par hon.

**Zaroori — SDK match:** Expo Go ka SDK aur project ka SDK same hona chahiye. Ye project **SDK 57** par hai.
Agar Expo Go "incompatible" jaisa message dikhaye, to us message me likha SDK number bhej do — project us number par le aayenge.

- Server ka address app **apne aap** dhoondh leti hai (wahi laptop jahan `expo start` chal raha hai, port 4000).
  `app.json` me kuch likhna nahi padta.
- Agar `expo start --tunnel` use karte ho ya server kahin deploy hai, to `app.json` ke `expo.extra.apiUrl` me production URL set hai: `https://v-khatabook.onrender.com`. Local development ke liye is value ko temporarily khali kar sakte hain.
- Windows firewall port 4000 roke to "Allow" karo, warna app "Server se connect nahi hua" dikhayegi.
- Mic (voice) button Expo Go me kaam nahi karta — message dikhata hai. Baaki sab chalta hai.
  Voice ke liye baad me development build (`eas build --profile development`); code wahi rahega.

## Naye features (v1.5)
- **Grahak par dabao** → detail screen: poori history, date filter (आज / 7 / 30 दिन), entry badalna/hatana,
  naam-mobile badalna, WhatsApp / SMS se "baki paise" yaad dilana, hisaab (statement) share karna.
- **Search + filter** grahak list me (naam/mobile, बकाया वाले, चुकता).
- **📊 रिपोर्ट**: aaj / 7 din / 30 din ka udhar-payment, din ke hisaab se.
- **💾 Backup / वापस लाओ**: poora khata ek text me share karo (WhatsApp/Gmail/Drive), naye phone par paste karke wapas.

## MongoDB storage kam kaise rakha (free 512 MB)
- Entries ke field naam chhote hain, `__v`/timestamps/ownerId nahi, aur entries par sirf ek index.
- Grahak ka jod (udhar/paid/entries) grahak ke document me rehta hai, isliye list ke liye saari entries nahi padhni padti.
- Vajah (reason) ab 60 akshar tak.
- Server start hone par purane bhaari indexes (`ownerId_1`, `customerId_1_at_-1`) apne aap hat jaate hain.
- **Purana test data:** agar is se pehle ke version me entries daali thi, to wo naye format me nahi dikhengi.
  Atlas → Browse Collections me `transactions` aur `customers` collection khali kar do (users mat chhedna).

## Login kaise chalta hai
- **Email + password:** server password ko bcrypt se hash karke MongoDB me rakhta hai.
- **Mobile OTP:** development me OTP server ke terminal me print hota hai (aur `DEV_SHOW_OTP=true` ho to app me bhi).
  Naye number par account apne aap ban jaata hai.
- Login ke baad app ko ek token milta hai (phone ki SecureStore me, 30 din chalta hai).
  Login ke baad entry jodna internet ke bina bhi chalta hai (neeche "Internet ke bina entry" dekho).
- Brute-force se bachaav: login/signup par rate limit, OTP 5 galat guess ke baad band, OTP 30 sec me ek hi baar.

## Abhi kya nahi hai (jaan-boojhkar)
- **Real SMS:** koi SMS provider juda nahi hai. Production (`NODE_ENV=production`) me OTP login tab tak band rehta
  hai jab tak `server/src/sms.js` me apna provider (MSG91 / Fast2SMS / Twilio) nahi jodte. Email login chalta rahega.
  `DEV_SHOW_OTP` production me kabhi on nahi hota.
- **Password bhool gaye:** isme email bhejna padta hai, uske liye email service (Resend / SMTP) chahiye. Abhi nahi hai.

## Naye features (v1.6)

### 📴 Internet ke bina entry
- Entry jodte hi **phone me save** hoti hai aur hisaab turant dikh jaata hai — net ho ya na ho, server soya ho ya jaag raha ho.
- Phir peeche se server ko jaati hai: entry ke baad, app wapas kholne par, pull-to-refresh par, aur jab tak kuch baaki hai har 30 second me.
- Baaki entries ka ⏳ nishaan list me aur ek peeli patti upar dikhti hai ("N entry phone me save hain…"). **अभी भेजो** se turant koshish kar sakte ho.
- **Double entry nahi hoti:** har entry ke saath uska asli samay jaata hai, aur server wahi entry dobara aane par ek hi baar judta hai
  (net beech me toote, ya server ne le li par app ko jawab na mile — tab bhi).
- Agar server kisi entry ko pakka mana kar de to wo alag "nahi gayi" patti me aati hai (hatane ka button ke saath); baaki entries nahi rukti.
- App khulte hi phone me rakhi aakhri list dikhti hai, isliye gaon me net na ho tab bhi app khulti hai.
- **Abhi internet chahiye:** entry badalna/hatana, grahak ka naam/mobile badalna, report, backup, aur grahak wala "📒 मेरे खाते" tab.
  Naye grahak (jo abhi server par pahunche nahi) par dabane par "server par pahunchne ke baad khulega" dikhta hai.
- Logout karne par bhi na gayi entries phone me rehti hain aur agli baar usi account se login karte hi chali jaati hain.

### 💳 Reminder me UPI link
1. Home screen ke neeche **💳 मेरी UPI ID** me apni UPI ID daalo (jaise `naam@okaxis`). Ye server par account ke saath rehti hai.
2. Grahak ke detail me **WhatsApp याद दिलाओ / SMS** dabao — message me "UPI से अभी भरें: <link>" aur UPI ID ka text jaata hai, rakam bhari hui.
3. Link `https://<tumhara-server>/pay?...` hota hai (WhatsApp me `upi://` link aksar clickable nahi hota, `https://` hota hai).
   Ye page login ke bina khulta hai, aur seedha GPay/PhonePe/Paytm kholta hai; na khule to "UPI ID कॉपी करो" button hai.
- **Zaroori:** link tabhi chalega jab server internet par deploy ho (neeche Render). Laptop ke `http://192.168...` address par
  app seedha `upi://` link banati hai (apne phone par test ke liye theek, grahak ko bhejne ke liye nahi).

### 🔁 Roz ki fixed entry
1. Grahak ke detail me **🔁 रोज़ की entry सेट करो** → rakam (₹120) aur vajah ("दूध 2 लीटर"). List me us grahak ke naam ke aage 🔁 dikhta hai.
2. Home screen par **"आज की रोज़ की entry"** card aata hai: sab grahak tick hote hain, jo aaj nahi le raha use dabakar hata do,
   phir ek tap me sab ki aaj ki entry lag jaati hai (offline bhi chalta hai).
3. Ek grahak ki ek din ki entry **ek hi baar** judti hai — dobara dabao, ya doosre phone se dabao, double nahi hoti.

### 👥 Dukaandaar aur grahak, dono apna khata dekhein (pehle se tha)
- Dukaandaar grahak ka **mobile number** daale → wo grahak usi number se OTP login karke **📒 मेरे खाते** me apna khata dekhta hai.
- Ya grahak ke detail ka **6 akshar ka code** grahak ko do; wo apne account me code daalkar khata jod leta hai.

## Server deploy: Render (free)
Free me test ke liye kaafi hai. Dhyan rakho: free server kuch der use na hone par so jaata hai, aur pehli request par jaagne me
lagbhag ek minute lag sakta hai (offline-entry ka kaam isi liye phone me pehle save karke baad me bhejna hai).

1. Code ko GitHub par daalo (is poore folder ko; `.env` kabhi nahi — wo `.gitignore` me hai).
2. **MongoDB Atlas → Network Access**: Render ke address fixed nahi hote, isliye `0.0.0.0/0` allow karo (user/password mazboot rakho).
3. render.com → **New + → Blueprint** → apni repo chuno. Is folder ki `render.yaml` apne aap `server/` ko web service bana deti hai.
   (Haath se banana ho to: New Web Service, Root Directory `server`, Build `npm install`, Start `npm start`, Health Check Path `/health`.)
4. Environment variables bharo:
   - `MONGODB_URI` — Atlas wali string (database naam ke saath, jaise `.../vkhatabook?...`)
   - `JWT_SECRET` — Blueprint se apne aap ban jaata hai; haath se banao to kam se kam 32 akshar random
   - `TRUST_PROXY=1` (Blueprint me pehle se hai)
5. Deploy hone par URL milega, jaise `https://bol-khata-server.onrender.com`. Browser me `<URL>/health` kholo — `{"ok":true}` aana chahiye.
6. App ko batao: `bol-khata-rn/app.json` me `expo.extra.apiUrl` me wo URL likho, phir `npx expo start -c`.
7. Render par `NODE_ENV=production` hota hai, isliye **mobile OTP login band** rehta hai jab tak `server/src/sms.js` me SMS provider
   nahi jodte. **Email + password login chalta hai.** (Grahak ko apna khata dekhne ke liye OTP chahiye ya wo email se signup karke 6 akshar ka code daale.)
8. Jab free server ki neend se bachna ho to paid plan lo, ya UptimeRobot jaisi service se har 10 minute me `/health` ping karwao.

## Abhi nahi hai (agle kaam)
PIN lock, PDF statement, Hindi/English switch, roz shaam ka notification, aur "pichhli entry dobara jodo + naam suggestion".

## Build (Expo Go se aage)
Production me HTTPS URL hi use karo (Android release build plain `http://` block karta hai). `eas build --profile preview` se APK banta hai.

## v1.10.1 interaction fixes
- The Add Entry action is now a floating button above the bottom tab bar.
- Voice, manual, and daily entry controls open inside a modal bottom sheet so they are reachable without scrolling past the customer list.
- Android hardware back closes the entry sheet first, then customer detail, then returns from Profile/My Accounts to Shop before allowing app exit.
- Replaced remaining UI emoji icons in Backup, Report, UPI and authentication headings with vector icons or plain text. WhatsApp message emojis are intentionally preserved.
- Added translation keys for StatsBar, customer filters/empty state, and the app footer.

Runtime verification is still required in Expo Go/device. The full application has not been exercised against a live server/database as part of this archive build.


## Bol-khata 1.11.0 deployment notes
- Render sets `NODE_ENV=production`; `DEV_SHOW_OTP` must remain unset/false in production. Server config suppresses `devOtp` whenever production mode is enabled.
- Changing OTP SMS text may require DLT template/header re-approval by your Indian SMS provider before production delivery.
