// Keep avatar metadata derived from the selected boolean field, not an unselected binary photo field.
function hasPhotoFlag(user) {
  return !!(user && user.hasPhoto)
}
module.exports = { hasPhotoFlag }
