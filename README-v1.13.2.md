# Bol-Khata v1.13.2 — Contact access upgrade

## What changed

- Contacts permission is requested when the seller opens the contact picker.
- The app paginates the device contact store to load all available contacts that have a valid Indian 10-digit mobile number. Search by name or phone.
- Default behavior remains one-at-a-time: choose a contact and its name/phone fill the manual entry form. This does not add a ledger transaction until the seller completes the form.
- Optional multi-select lets the seller choose selected contacts and import them as empty customer ledgers. Existing customer names are skipped; no transaction amount is created.
- Only the selected contacts are sent to the server. The full phone address book is not uploaded automatically.

## Setup and build

1. Deploy the updated `server/` code to the existing Render service `https://bol-khata.onrender.com`. Bulk import requires the new `POST /api/customers/import` route.
2. In a terminal: `cd bol-khata-rn`
3. Run `npx expo install expo-contacts` to resolve the compatible version for this Expo SDK and update the lockfile.
4. Run `npm install` and `npx expo-doctor`.
5. Build Android: `npx eas-cli@latest build --platform android --profile production`.
6. Test on a real Android device: deny/allow Contacts permission, verify a list larger than 500 contacts loads, search, single-select, multi-select, duplicate skip, and server-offline behavior.

## Limitations to be aware of

- Bulk import needs an internet connection and the updated backend deployment.
- One contact with multiple numbers appears as multiple rows; because the ledger uses customer name as its uniqueness key, bulk import will create only one customer for a repeated name and skip subsequent entries with the same name.
- Contact import creates empty customer ledgers only; it never creates credit/payment transactions.
- This source update has not been run through a full Expo/EAS build or device test in this environment.
