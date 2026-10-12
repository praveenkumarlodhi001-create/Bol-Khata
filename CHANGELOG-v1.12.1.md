# v1.12.1 — Delivery 1: Neev (foundation) + Forgot password

## Fixed
- **Signup screen crash**: `View` import missing in `SignupScreen.js` (screen crashed on render).
- **Lockfile**: `server/package-lock.json` was missing `ip-address` (needed by `express-rate-limit@8.1.0`). `npm ci` "passed" but the server failed at startup with `Cannot find module 'ip-address'`. Lockfile regenerated.
- **Phone (OTP) signup lost the role**: the chosen seller/buyer role was stored in the OTP record but never copied to the new user. Now saved.
- **Hindi strings**: `historyLoadFailed`, `genericError` were outside the Hindi dictionary; `accountType`, `sellerRole`, `buyerRole` had no Hindi text. Fixed.

## Added
- **Forgot password** (Login -> "Password bhool gaye?"): enter email or mobile, OTP goes to the mobile linked to the account, set a new password. Old sessions are revoked, OTP is one-time, 5 wrong tries lock it, responses don't reveal whether an account exists.
  - `POST /api/auth/password/forgot`, `POST /api/auth/password/reset`
  - Limitation: needs an account with BOTH password and mobile. Email-only accounts cannot reset yet (no email provider connected).
- **Role-choice screen** for old accounts with no role and no customers.
- **Buyer navigation**: buyers see only "My accounts" and "Profile"; no shop sync, no shop tab, no UPI/Backup cards.
- **Tests**: existing signup tests now send `role`; new tests for role rules, buyer blocked from shop APIs, legacy role choice, seller-with-ledger cannot become buyer, business type, items catalog, forgot/reset.

## Not verified here
- `npm test` needs MongoDB (`TEST_MONGODB_URI`); there is none in this build environment, so the integration tests were NOT run. The new auth routes were run against an in-memory fake DB (signup role, phone signup role, forgot/reset flow) and passed.
- No Expo / device run. UI files checked with a linter for undefined identifiers (it catches the old `View` bug) and a syntax build.
