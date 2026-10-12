// Server-local branding: safe when Render uses server/ as rootDir.
const BRAND_NAME = 'Bol-khata'
const isSupportedBackupApp = (value) => [BRAND_NAME, 'V-Khatabook'].includes(value)
module.exports = { BRAND_NAME, isSupportedBackupApp }
