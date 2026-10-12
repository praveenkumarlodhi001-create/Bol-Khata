# v1.12.2 — Icons everywhere + animated popups

## Added
- `src/components/Icon.js` — font-free icon set (drawn with Views, so it shows even when the icon font does not load).
  Uses Ionicons names (`trash`, `camera`, `mic`, `checkmark-circle`, `repeat`, ...), plus `home`, `wallet`, `person`, `image`, `logout`, `info`, `warning`.
- `src/components/Popup.js` — animated popups replacing system `Alert`:
  `usePopup()` -> `confirm()`, `notify()`, `choose()`. Backdrop fade, card spring-in, icon "pop" + pulse ring, shake on danger/warn,
  haptics on buttons, respects "reduce motion". `<PopupHost />` is placed inside native Modals (CustomerDetail) so popups show on top on iOS too.
- `Button` accepts `icon` and `tone="danger"`.
- Toasts now show an icon (check / alert) with a pop animation.

## Changed
- All `@expo/vector-icons` (Ionicons) usage replaced by `Icon`. Bottom tabs use it too (Home / Khate / Profile).
- All `Alert.alert` calls replaced by popups: logout, delete entry, delete customer, delete account, profile photo choice,
  permission-denied, password changed, password reset done.

## Not verified here
- No device/Expo run. Icons and popups were rendered in a browser harness (static layout) and checked with a syntax build + undefined-name check.
  Animations (spring, pulse, shake) have not been seen on a device.
