# Bol-Khata v1.13.1 — deployment notes

## Included updates
- Production API URL points to `https://bol-khata.onrender.com`.
- Manual entry form has a **Mobile Contacts se chunein** option. It asks for permission only when tapped, lets the user search/select a contact, and fills the customer name and 10-digit mobile number. Contacts are processed on-device and are not uploaded as an address book.
- Render proxy configuration defaults to one trusted proxy hop in production (`TRUST_PROXY` can override it); `render.yaml` also sets `TRUST_PROXY=1`.
- Android Contacts permission and an explanatory permission prompt are configured.
- App version bumped to 1.13.1; Android package remains `com.vkhatabook.ledger`.

## Before pushing / building
1. In `bol-khata-rn`, run `npx expo install expo-contacts`. This chooses the version compatible with this project's Expo SDK and updates `package.json` and `package-lock.json`.
2. Run `npm install` in `server` and `npm test` to verify backend changes.
3. Commit and push the updated files to GitHub. Render should deploy the backend from that commit.
4. Verify `https://bol-khata.onrender.com/health` returns `{\"ok\":true}`.
5. In `bol-khata-rn`, run `npx expo config --type public`, then `npx eas-cli@latest build --platform android --profile production`.

The app asks for contacts permission only after the user taps the contact-selection button. If permission is denied, manual name/phone entry remains available.
