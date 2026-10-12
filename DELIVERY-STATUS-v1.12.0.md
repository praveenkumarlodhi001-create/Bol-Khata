# Bol-Khata v1.12.0 — delivery status (partial review build)

This archive contains the latest available working tree. It is **not feature-complete** and must not be treated as production-ready.

## Implemented in this working tree
- App/server package version bumped to 1.12.0.
- Avatar metadata uses `hasPhotoFlag` based on the stored `hasPhoto` flag; regression test covers true/false/null and ensures an unselected `photo` buffer is not treated as the flag.
- Expo permission descriptions include Hindi and English text.
- User model has seller/buyer role fields, role choice timestamps, and business type.
- Signup UI passes a seller/buyer choice for email and OTP signup.
- Server role/business-type endpoints and seller-only guards on selected ledger/report/backup operations.
- Owner-scoped item catalog endpoints with validation and 200-item cap.
- Photo endpoint decision documented in changelog: profile-photo endpoint remains publicly readable, with `Cache-Control: private, no-store`.

## Incomplete / not verified
1. **Dependency lockfile:** `server/package-lock.json` still needs regeneration in a network-enabled environment using `npm install express-rate-limit@^8.1.0`. Do not hand-edit it. `npm ci` is not verified.
2. **Server tests/runtime:** `npm test --prefix server` was attempted in this environment but failed before test execution because installed dependencies are incomplete (`mongoose` and `dotenv` missing). A clean install and `node -e "require('./src/app')"` are not verified.
3. **Role experience:** signup role choice exists, but first-time legacy role-selection flow and role-change UI in profile are not complete/verified. Buyer-only navigation (only “मेरे खाते” + Profile) is not complete/verified. Server permission guards need full endpoint-by-endpoint test coverage.
4. **Onboarding:** first-launch flag, animated icon popup, three slides, and skip flow are not implemented.
5. **Business setup/catalog UX:** business-type selection and pre-populated Hindi/English catalog per business type are not complete. Item API exists, but complete seller selection/custom-item UI is not complete.
6. **Itemized ledger:** transaction schema/UI for item quantities/prices, server-computed totals, max-20 item validation, offline queue idempotency for itemized entries, and buyer purchased-item history are not complete.
7. **UPI/QR:** app-generated QR, QR share screen, optional custom QR upload, buyer scoped seller UPI display, “Pay via UPI”, and “Show QR” are not complete.
8. **Translations/theme:** English-mode Hindi strings, WhatsApp reminder language, server error-code translation, and fixed-hex dark-mode cleanup are not fully addressed.
9. **Authentication fixes:** duplicate mobile signup OTP prevention and login with a password set by a mobile-only user are not complete/verified.
10. **Expo/lint:** Expo package compatibility/install fix, Oxlint warnings, Expo Android export, and module-load smoke tests are not verified.
11. **Production integrations:** real SMS provider, password recovery email service, real MongoDB tests, Render, EAS build, real-device checks, and camera permission verification are not done.
12. **Older requested features:** PIN lock, PDF statement, evening notification, repeat previous entry, and name suggestions are not implemented.

## Verification performed
- Added `hasPhotoFlag` regression assertions in `server/test/api.test.js`.
- Attempted `npm test --prefix server`; blocked by missing local dependencies (`mongoose`, `dotenv`).
- No claim is made that clean `npm ci`, server runtime, Expo export, MongoDB integration, physical-device behavior, Render, or EAS build passed.

## Photo privacy note
The profile photo endpoint remains public in this review build. `Cache-Control: private, no-store` does not make a public endpoint authenticated; do not store sensitive photos there.
