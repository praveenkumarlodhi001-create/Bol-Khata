# Play Store release checklist — Bol-Khata v1.12.3

## Applied in this archive
- Android package ID: `com.bolkhata.app`
- iOS bundle identifier: `com.bolkhata.app`
- Production API URL: `https://v-khatabook.onrender.com`
- App version: `1.12.3`
- EAS production profile builds an Android App Bundle (`.aab`) and auto-increments Android build number.

## Before publishing (must be checked by the owner)
1. Confirm the deployed Render service is live and has valid production environment variables: `MONGODB_URI`, a strong `JWT_SECRET` (32+ chars), and `NODE_ENV=production`. Do not set `DEV_SHOW_OTP=true` in production.
2. Verify the deployed API from a real Android device and test signup, login, OTP/reset flow, ledger creation, buyer linking, UPI, backup/restore, and error states.
3. Add a public privacy-policy URL and complete Play Console Data safety, app access, target audience, ads, and content-rating forms truthfully.
4. Replace/check app icon, screenshots, short/full descriptions, support email, and store listing.
5. Verify permissions are needed; the current config includes microphone/speech and photo/camera-related permissions via app plugins.
6. Run tests and inspect the release build. A successful cloud build is not proof that backend features or Play policy requirements pass.
7. Create the app in Play Console using exactly `com.bolkhata.app`. Package IDs are effectively permanent once published.

## Build commands
From `bol-khata-rn/`:
```bash
npm ci
npx expo-doctor
npx expo config --type public
npm install -g eas-cli
eas login
eas build --profile production --platform android
```
Upload the resulting `.aab` to an internal testing track first. Test on a physical Android device before production rollout.

## Important limitation
This archive contains configuration and documentation changes only. It does not contain a signed `.aab`, and production deployment, real-device testing, Play Console forms, privacy policy, and service credentials have not been verified here. Since the package ID changed from `com.vkhatabook.ledger`, Play Console treats it as a different app from any listing using the old ID.
