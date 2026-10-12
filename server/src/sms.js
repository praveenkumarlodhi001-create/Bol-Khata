// OTP SMS bhejne ki jagah. Abhi koi SMS provider juda nahi hai.
//
// - Development (NODE_ENV != production): OTP server ke terminal me print hota hai,
//   isliye bina SMS kharch kiye Expo Go me test kar sakte ho.
// - Production: jab tak yahan apna provider (MSG91 / Fast2SMS / Twilio ...) nahi jodoge,
//   OTP login band rehta hai — OTP kabhi logs me nahi chhapta. Email login chalta rahega.
async function sendSms(phone, message) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[DEV SMS] +91${phone}: ${message}`)
    return
  }
  // TODO: yahan apne provider ki API call likho aur uske fail hone par throw karo.
  const err = new Error('SMS provider set nahi hai')
  err.code = 'SMS_NOT_CONFIGURED'
  throw err
}

module.exports = { sendSms }
