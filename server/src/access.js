// Kaun kiska khata / photo dekh sakta hai — ek hi jagah ka niyam, taaki ledger aur photo dono me same rahe.

// Grahak ke roop me mere khate: jahan mera account judaa hai (code se) ya mera verified mobile number match karta hai.
function myAccountsFilter(user) {
  const or = [{ linkedUserId: user._id }]
  if (user.phone) or.push({ phone: user.phone })
  return { $or: or, ownerId: { $ne: user._id } }
}

module.exports = { myAccountsFilter }
