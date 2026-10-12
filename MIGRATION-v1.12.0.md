# Migration notes — v1.12.0 review build

## Existing data
- No MongoDB schema or stored ledger data was changed by this partial build. Existing users and transactions should remain structurally compatible.
- The avatar metadata fix uses the already-stored `hasPhoto` boolean; no database migration is required for it.
- The photo endpoint remains public for uploaded profile photos. Do not put sensitive images there. A future privacy decision should explicitly choose authenticated access and update Avatar request headers accordingly.

## Before using this ZIP
1. In `server/`, run `npm install express-rate-limit@^8.1.0` in a network-enabled environment so npm regenerates `package-lock.json`; then verify `npm ci` in a clean extraction. This could not be done here because the npm registry returned `EAI_AGAIN`.
2. Run `npm test` with a configured test MongoDB URI (`TEST_MONGODB_URI`).
3. In `bol-khata-rn/`, install dependencies and run Expo export and Oxlint before using it on a device.
4. This ZIP contains partial buyer/seller role and item-catalog API work, but does not yet contain complete onboarding, buyer-only navigation, itemized transactions, QR generation or buyer UPI payment actions. Do not migrate production users expecting those features.

## Verification record
- `node --check` checks are run on server JavaScript source files as part of packaging.
- Clean `npm ci`, runtime `require('./src/app')`, server integration tests, Expo export, Oxlint, native-device testing and production build remain unverified in this environment.
