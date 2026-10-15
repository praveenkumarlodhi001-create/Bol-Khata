# v1.13.2

- Updated contact loading to paginate through all available phone contacts instead of reading only the first page.
- Supports searching the complete loaded list by name or mobile number; each valid 10-digit Indian mobile number is shown as a selectable row.
- Preserved the default single-contact flow: tapping a contact fills the manual entry form without creating a ledger transaction.
- Added optional multi-select and select-visible contacts controls. Only contacts the seller explicitly selects are sent to Bol-Khata.
- Added authenticated seller endpoint `POST /api/customers/import` to create empty customer ledgers in bulk (up to 500 per request), skip existing names, and fill a missing phone number on an existing customer. It does not create any credit/payment transaction.
- Added UI feedback for successful bulk import and errors; full device address book is not uploaded automatically.
- Bumped app version to 1.13.2.

## Before Android build

From `bol-khata-rn`, run `npx expo install expo-contacts` and then `npm install` so `package-lock.json` records the SDK-compatible native module version. Then run `npx expo-doctor` and make a production EAS build. The updated backend route must also be deployed to Render before bulk import can work.
