# Bol-Khata v1.11.3 — seller/buyer linking clarification

- Documented the existing one-seller-to-many-buyers flow.
- A seller creates a separate customer ledger per buyer; each ledger has its own unique invite code.
- Each buyer enters the code to link that ledger. A seller can therefore have many linked buyer accounts.
- One customer ledger is linked to one buyer account at a time; one buyer can link multiple seller ledgers.
- No database schema change is required: existing `Customer.ownerId` and `Customer.linkedUserId` fields support this relationship.

## Verification note
This update clarifies existing backend behavior and documentation. Run the server test suite against the configured MongoDB and test with two distinct buyer accounts before production use.
