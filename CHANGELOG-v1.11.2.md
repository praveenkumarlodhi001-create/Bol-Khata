# Bol-khata v1.11.2 maintenance fixes

- Pinned `express-rate-limit` to the 8.x API used by `ipKeyGenerator`.
- Added server-side logging for otherwise hidden Express errors (stack trace omitted in production).
- Removed generated local secrets, `.env`, Git internals, Expo cache/logs, and dependencies from the distributable ZIP.
- Added Expo ImagePicker native permission plugin and iOS usage descriptions.
- Profile photo endpoint remains intentionally usable for public avatars, but response caching is now `private, no-store` instead of a one-day public cache. If profile photos must be private, the endpoint and native image loading need authenticated requests together.

## Verification limits

No phone/device runtime test is claimed. Run `npm install && npm test` in `server/` against a real MongoDB, then run `npx expo install --fix` and `npx expo install --check` in `bol-khata-rn/`.
