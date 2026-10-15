# v1.13.1

- Configured the production mobile app API URL to use `https://bol-khata.onrender.com`.
- Added mobile contact selection to the manual ledger entry form. When the user taps the contact button, the app requests permission, shows a searchable list of contacts with phone numbers, and fills the customer name and 10-digit phone number after selection. Contacts are read on-device only when the user asks to choose one; the app does not upload the address book.
- Added Android Contacts permission and an explanatory permission prompt.
- Kept Render's `TRUST_PROXY=1` environment configuration in `render.yaml`; the server reads this setting for Express proxy/rate-limit handling.
- Bumped app version to 1.13.1.

Before building: run `npx expo install expo-contacts` in `bol-khata-rn` to align the native module version with the installed Expo SDK, then commit the updated package lock file.
