const { BRAND_NAME } = require('./brand')
const crypto = require('crypto')
const express = require('express')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const rateLimit = require('express-rate-limit')
const { ipKeyGenerator } = require('express-rate-limit')
const { User, Otp, Customer } = require('./models')
const { sendSms } = require('./sms')
const { VPA_RE } = require('./upi')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const PHONE_RE = /^[6-9]\d{9}$/
const OTP_TTL_MS = 5 * 60 * 1000
const OTP_RESEND_MS = 30 * 1000
const OTP_MAX_ATTEMPTS = 5
const TOKEN_TTL = '30d'

// Request body se aaya har value pehle string check se guzarta hai —
// warna {"$gt": ""} jaisa object daalkar query badli ja sakti hai (NoSQL injection).
const str = (v) => (typeof v === 'string' ? v : '')

// Email na milne par bhi bcrypt chalate hain, taaki response ka time dekhkar
// koi na jaan sake ki yeh email registered hai ya nahi.
const DUMMY_HASH = bcrypt.hashSync('dummy-password', 10)

function publicUser(u) {
  return { id: String(u._id), name: u.name || '', email: u.email || null, phone: u.phone || null, role: u.role || null, roleChosenAt: u.roleChosenAt || null, businessType: u.businessType || null, upiId: u.upiId || null, hasPhoto: !!u.hasPhoto, photoVersion: Number(u.photoVersion || 0) }
}

function fail(res, status, code, error) {
  return res.status(status).json({ code, error })
}

function createAuth(cfg) {
  const router = express.Router()

  const signToken = (user) => jwt.sign({ sub: String(user._id), ver: Number(user.tokenVersion || 0) }, cfg.jwtSecret, { expiresIn: TOKEN_TTL })
  const hashOtp = (phone, code) =>
    crypto.createHmac('sha256', cfg.jwtSecret).update(phone + ':' + code).digest('hex')
  const session = (user) => ({ token: signToken(user), user: publicUser(user) })

  const credentialLimiter = rateLimit({
    windowMs: cfg.credentialRateWindowMs || 15 * 60 * 1000,
    limit: cfg.credentialRateLimit || 10,
    keyGenerator: (req) => {
      const identity = str(req.body && (req.body.email || req.body.phone)).trim().toLowerCase() || 'unknown'
      return `${ipKeyGenerator(req.ip)}:${identity}`
    },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })
  // OTP bhejne par SMS kharch hota hai, isliye send ki limit kam rakhi hai.
  const otpSendLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })

  // Verify par har phone ke 5 guess ki limit alag se lagti hai (neeche), isliye IP limit khuli hai —
  // mobile networks me kai log ek IP share karte hain.
  const otpVerifyLimiter = rateLimit({
    windowMs: 10 * 60 * 1000,
    limit: 30,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })

  const passwordChangeLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })

  // ---------- Email + password ----------
  router.post('/signup', credentialLimiter, async (req, res) => {
    const name = str(req.body.name).trim()
    const email = str(req.body.email).trim().toLowerCase()
    const password = str(req.body.password)
    const role = str(req.body.role)
    if (!['seller', 'buyer'].includes(role)) return fail(res, 400, 'bad_role', 'Account type चुनें।')
    if (name.length < 2 || name.length > 60) return fail(res, 400, 'bad_name', 'अपना नाम डालो।')
    if (!EMAIL_RE.test(email) || email.length > 120) return fail(res, 400, 'bad_email', 'Email सही नहीं है।')
    if (password.length < 6) return fail(res, 400, 'weak_password', 'Password कम से कम 6 अक्षर का रखो।')
    if (password.length > 64) return fail(res, 400, 'long_password', 'Password 64 अक्षर से छोटा रखो।')
    try {
      const passwordHash = await bcrypt.hash(password, 10)
      const user = await User.create({ name, email, passwordHash, role, roleChosenAt: new Date() })
      res.status(201).json(session(user))
    } catch (e) {
      if (e && e.code === 11000)
        return fail(res, 409, 'email_taken', 'इस email से account पहले से बना है, Login करो।')
      console.error('signup:', e.message)
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  })

  router.post('/login', credentialLimiter, async (req, res) => {
    const email = str(req.body.email).trim().toLowerCase()
    const password = str(req.body.password)
    if (!EMAIL_RE.test(email) || !password) return fail(res, 400, 'bad_input', 'Email या password गलत है।')
    try {
      const user = await User.findOne({ email }).select('+passwordHash')
      const ok = await bcrypt.compare(password, user && user.passwordHash ? user.passwordHash : DUMMY_HASH)
      if (!user || !user.passwordHash || !ok)
        return fail(res, 401, 'bad_credentials', 'Email या password गलत है।')
      res.json(session(user))
    } catch (e) {
      console.error('login:', e.message)
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  })

  // ---------- Mobile OTP ----------
  router.post('/otp/send', otpSendLimiter, async (req, res) => {
    const phone = str(req.body.phone).trim()
    const purpose = str(req.body.purpose) === 'signup' ? 'signup' : 'login'
    const name = str(req.body.name).trim()
    const role = str(req.body.role)
    if (purpose === 'signup' && !['seller', 'buyer'].includes(role)) return fail(res, 400, 'bad_role', 'Account type चुनें।')
    if (!PHONE_RE.test(phone)) return fail(res, 400, 'bad_phone', 'मोबाइल नंबर सही नहीं है।')
    if (purpose === 'signup' && (name.length < 2 || name.length > 60)) return fail(res, 400, 'bad_name', 'अपना नाम डालो।')
    try {
      if (purpose === 'login' && !(await User.exists({ phone })))
        return fail(res, 404, 'account_missing', 'इस मोबाइल नंबर से account नहीं है। पहले Signup करो।')
      if (purpose === 'signup' && await User.exists({ phone })) {
        // Existing numbers get a generic success, but no SMS: avoids cost and number enumeration.
        return res.json({ ok: true, ...(cfg.devShowOtp ? { devOtp: null } : {}) })
      }
      const now = Date.now()
      const existing = await Otp.findOne({ phone })
      if (existing && now - existing.lastSentAt.getTime() < OTP_RESEND_MS)
        return fail(res, 429, 'otp_cooldown', 'थोड़ी देर बाद नया OTP मँगाओ।')

      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
      await Otp.updateOne(
        { phone },
        {
          $set: {
            codeHash: hashOtp(phone, code),
            attempts: 0,
            lastSentAt: new Date(now),
            expiresAt: new Date(now + OTP_TTL_MS),
            purpose,
            name: purpose === 'signup' ? name : '',
            role: purpose === 'signup' ? role : ''
          }
        },
        { upsert: true }
      )
      try {
        await sendSms(phone, `${BRAND_NAME} OTP: ${code} (5 मिनट के लिए)`)
      } catch (e) {
        await Otp.deleteOne({ phone })
        if (e.code === 'SMS_NOT_CONFIGURED')
          return fail(res, 503, 'sms_off', 'OTP login अभी चालू नहीं है, Email से login करो।')
        throw e
      }
      res.json({ ok: true, ...(cfg.devShowOtp ? { devOtp: code } : {}) })
    } catch (e) {
      console.error('otp/send:', e.message)
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  })

  router.post('/otp/verify', otpVerifyLimiter, async (req, res) => {
    const phone = str(req.body.phone).trim()
    const code = str(req.body.code).trim()
    const purpose = str(req.body.purpose) === 'signup' ? 'signup' : 'login'
    const name = str(req.body.name).trim()
    if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code))
      return fail(res, 400, 'bad_input', '6 अंक का OTP डालो।')
    try {
      // Attempts atomically badhte hain — ek saath kai guesses bhejkar bhi limit paar nahi hoti.
      const otp = await Otp.findOneAndUpdate(
        { phone, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } },
        { $inc: { attempts: 1 } },
        { new: true }
      )
      if (!otp) return fail(res, 400, 'otp_expired', 'OTP की समय-सीमा खत्म, नया OTP मँगाओ।')
      if ((otp.purpose || 'login') !== purpose) return fail(res, 400, 'otp_purpose', 'OTP का इस्तेमाल सही Signup/Login स्क्रीन पर करो।')

      const given = Buffer.from(hashOtp(phone, code), 'hex')
      const real = Buffer.from(otp.codeHash, 'hex')
      if (given.length !== real.length || !crypto.timingSafeEqual(given, real))
        return fail(res, 400, 'otp_wrong', 'OTP गलत है, दोबारा देखो।')

      await Otp.deleteOne({ phone })
      let user = await User.findOne({ phone })
      if (purpose === 'signup') {
        if (user) return fail(res, 409, 'phone_taken', 'इस नंबर से account पहले से बना है, Login करो।')
        const finalName = name || otp.name || ''
        if (finalName.trim().length < 2) return fail(res, 400, 'bad_name', 'अपना नाम डालो।')
        const finalRole = ['seller', 'buyer'].includes(otp.role) ? otp.role : ''
        if (!finalRole) return fail(res, 400, 'bad_role', 'Account type चुनें।')
        user = await User.create({ phone, name: finalName.trim(), role: finalRole, roleChosenAt: new Date() })
      } else if (!user) {
        return fail(res, 404, 'account_missing', 'इस मोबाइल नंबर से account नहीं है। पहले Signup करो।')
      }
      res.json(session(user))
    } catch (e) {
      console.error('otp/verify:', e.message)
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  })

  // ---------- Forgot password ----------
  // Password sirf email wale accounts me hota hai. Reset ka OTP account se jude mobile par jaata hai.
  // Response hamesha ek jaisa (ok:true) rehta hai, taaki koi jaan na sake ki kaun sa email/number registered hai.
  const resetSendLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, limit: 5, standardHeaders: true, legacyHeaders: false,
    keyGenerator: (req) => `${ipKeyGenerator(req.ip)}:${str(req.body && req.body.identifier).trim().toLowerCase() || 'unknown'}`,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हो गई, थोड़ी देर बाद फिर करो।')
  })
  const findResetUser = async (identifier) => {
    const id = str(identifier).trim().toLowerCase()
    let user = null
    if (EMAIL_RE.test(id)) user = await User.findOne({ email: id }).select('+passwordHash')
    else if (PHONE_RE.test(id)) user = await User.findOne({ phone: id }).select('+passwordHash')
    // Password reset ke liye account me password aur mobile dono hone chahiye.
    return user && user.passwordHash && user.phone ? user : null
  }

  router.post('/password/forgot', resetSendLimiter, async (req, res) => {
    const id = str(req.body && req.body.identifier).trim().toLowerCase()
    if (!EMAIL_RE.test(id) && !PHONE_RE.test(id)) return fail(res, 400, 'bad_input', 'सही email या मोबाइल नंबर डालो।')
    try {
      const user = await findResetUser(id)
      let devOtp = null
      if (user) {
        const phone = user.phone
        const old = await Otp.findOne({ phone })
        if (old && Date.now() - old.lastSentAt.getTime() < OTP_RESEND_MS)
          return fail(res, 429, 'otp_cooldown', 'थोड़ी देर बाद नया OTP मँगाओ।')
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
        const now = Date.now()
        await Otp.updateOne({ phone }, { $set: { codeHash: hashOtp(phone, code), attempts: 0, lastSentAt: new Date(now), expiresAt: new Date(now + OTP_TTL_MS), purpose: 'reset', name: '', role: '' } }, { upsert: true })
        try { await sendSms(phone, `${BRAND_NAME} password reset OTP: ${code} (5 मिनट के लिए)`) }
        catch (e) {
          await Otp.deleteOne({ phone })
          if (e.code === 'SMS_NOT_CONFIGURED') return fail(res, 503, 'sms_off', 'OTP अभी चालू नहीं है।')
          throw e
        }
        devOtp = code
      }
      const maskedPhone = user ? '******' + user.phone.slice(-4) : null
      res.json({ ok: true, ...(cfg.devShowOtp ? { devOtp } : {}) , ...(maskedPhone && EMAIL_RE.test(id) ? { maskedPhone } : {}) })
    } catch (e) { console.error('password/forgot:', e.message); fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।') }
  })

  router.post('/password/reset', otpVerifyLimiter, async (req, res) => {
    const id = str(req.body && req.body.identifier).trim().toLowerCase()
    const code = str(req.body && req.body.code).trim()
    const newPassword = str(req.body && req.body.newPassword)
    if (!/^\d{6}$/.test(code)) return fail(res, 400, 'bad_input', '6 अंक का OTP डालो।')
    if (newPassword.length < 6) return fail(res, 400, 'weak_password', 'Password कम से कम 6 अक्षर का रखो।')
    if (newPassword.length > 64) return fail(res, 400, 'long_password', 'Password 64 अक्षर से छोटा रखो।')
    try {
      const user = await findResetUser(id)
      // Account na ho to bhi wahi jawab jo galat OTP par aata hai.
      if (!user) return fail(res, 400, 'otp_wrong', 'OTP गलत है, दोबारा देखो।')
      const phone = user.phone
      const otp = await Otp.findOneAndUpdate({ phone, purpose: 'reset', expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true })
      if (!otp) return fail(res, 400, 'otp_expired', 'OTP की समय-सीमा खत्म, नया OTP मँगाओ।')
      const given = Buffer.from(hashOtp(phone, code), 'hex'), real = Buffer.from(otp.codeHash, 'hex')
      if (given.length !== real.length || !crypto.timingSafeEqual(given, real))
        return fail(res, 400, 'otp_wrong', 'OTP गलत है, दोबारा देखो।')
      await Otp.deleteOne({ phone })
      user.passwordHash = await bcrypt.hash(newPassword, 10)
      user.tokenVersion = Number(user.tokenVersion || 0) + 1 // purane sab sessions band
      await user.save()
      res.json({ ok: true })
    } catch (e) { console.error('password/reset:', e.message); fail(res, 500, 'server', 'Password बदला नहीं जा पाया।') }
  })

  // ---------- Session ----------
  const requireAuth = async (req, res, next) => {
    const header = req.headers.authorization || ''
    const token = header.startsWith('Bearer ') ? header.slice(7) : null
    if (!token) return fail(res, 401, 'no_token', 'Login ज़रूरी है।')
    try {
      const decoded = jwt.verify(token, cfg.jwtSecret)
      const user = await User.findById(decoded.sub).select('_id tokenVersion role roleChosenAt')
      if (!user || Number(decoded.ver || 0) !== Number(user.tokenVersion || 0))
        return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      if (!user.role) {
        const ownsCustomers = await Customer.exists({ ownerId: user._id })
        if (ownsCustomers) { user.role = 'seller'; user.roleChosenAt = new Date(); await user.save() }
      }
      req.uid = String(user._id)
      req.userRole = user.role || null
      next()
    } catch (e) {
      if (e && e.name === 'JsonWebTokenError' || e && e.name === 'TokenExpiredError' || e && e.name === 'NotBeforeError')
        return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      console.error('auth middleware:', e.message)
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  }


  router.patch('/role', requireAuth, async (req, res) => {
    const role = str(req.body && req.body.role)
    if (!['seller', 'buyer'].includes(role)) return fail(res, 400, 'bad_role', 'Account type चुनें।')
    try {
      const user = await User.findById(req.uid)
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया।')
      if (!user.roleChosenAt) { user.role = role; user.roleChosenAt = new Date(); await user.save() }
      else if (user.role !== role) {
        const owns = await Customer.exists({ ownerId: user._id })
        if (owns && role === 'buyer') return fail(res, 409, 'seller_has_ledger', 'पहले दुकान का हिसाब हटाना होगा।')
        user.role = role; await user.save()
      }
      res.json({ user: publicUser(user) })
    } catch (e) { console.error('role:', e.message); fail(res, 500, 'server', 'Server error') }
  })

  router.patch('/business', requireAuth, async (req, res) => {
    const type = str(req.body && req.body.businessType)
    const allowed = ['kirana', 'dairy', 'produce', 'medical', 'tea_snacks', 'hardware', 'clothing', 'other']
    if (!allowed.includes(type)) return fail(res, 400, 'bad_business_type', 'Business type सही नहीं है।')
    try {
      const user = await User.findById(req.uid)
      if (!user || user.role !== 'seller') return fail(res, 403, 'seller_only', 'यह सुविधा seller के लिए है।')
      user.businessType = type; await user.save(); res.json({ user: publicUser(user) })
    } catch (e) { console.error('business:', e.message); fail(res, 500, 'server', 'Server error') }
  })

  // ---------- Profile photo ----------
  const photoLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 12, standardHeaders: true, legacyHeaders: false,
    handler: (req, res) => fail(res, 429, 'rate_limited', 'बहुत बार कोशिश हुई, थोड़ी देर बाद फिर कोशिश करें।') })

  router.put('/profile/photo', requireAuth, photoLimiter, async (req, res) => {
    const encoded = str(req.body && req.body.photoBase64)
    if (!encoded || encoded.length > 82000) return fail(res, 413, 'photo_too_large', 'फोटो 60 KB से छोटी रखें।')
    let bytes
    try { bytes = Buffer.from(encoded, 'base64') } catch { return fail(res, 400, 'bad_photo', 'JPEG फोटो चुनें।') }
    if (!bytes.length || bytes.length > 60 * 1024 || encoded.replace(/=+$/, '').length < 4 ||
      bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff || bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9) {
      return fail(res, 400, 'bad_photo', 'केवल सही JPEG फोटो (अधिकतम 60 KB) स्वीकार है।')
    }
    try {
      const user = await User.findByIdAndUpdate(req.uid, { $set: { photo: bytes, hasPhoto: true }, $inc: { photoVersion: 1 } }, { new: true }).select('+photo')
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करें।')
      res.json({ user: publicUser(user) })
    } catch (e) { console.error('photo/save:', e.message); fail(res, 500, 'server', 'फोटो सेव नहीं हुई।') }
  })

  router.delete('/profile/photo', requireAuth, photoLimiter, async (req, res) => {
    try {
      const user = await User.findByIdAndUpdate(req.uid, { $unset: { photo: '' }, $set: { hasPhoto: false }, $inc: { photoVersion: 1 } }, { new: true })
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करें।')
      res.json({ user: publicUser(user) })
    } catch (e) { fail(res, 500, 'server', 'फोटो हटाई नहीं जा सकी।') }
  })

  router.get('/photo/:userId', async (req, res) => {
    if (!/^[a-f\d]{24}$/i.test(req.params.userId)) return fail(res, 404, 'photo_missing', 'फोटो नहीं मिली।')
    try {
      const user = await User.findById(req.params.userId).select('+photo photoVersion')
      if (!user || !user.photo) return fail(res, 404, 'photo_missing', 'फोटो नहीं मिली।')
      res.set('Content-Type', 'image/jpeg')
      res.set('Cache-Control', 'private, no-store')
      res.set('ETag', `"photo-${user.id}-${user.photoVersion}"`)
      if (req.query.v && Number(req.query.v) !== Number(user.photoVersion)) { /* current version is authoritative */ }
      return res.send(user.photo)
    } catch (e) { return fail(res, 500, 'server', 'फोटो नहीं मिल सकी।') }
  })

  router.get('/me', requireAuth, async (req, res) => {
    try {
      const user = await User.findById(req.uid)
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      res.json({ user: publicUser(user) })
    } catch (e) {
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  })

  // Dukaandaar apni UPI ID yahan rakhta hai (reminder me "yahan se pay karo" link ke liye). Khali bhejo to hat jaati hai.
  router.patch('/me', requireAuth, async (req, res) => {
    const body = req.body || {}
    if (body.upiId === undefined) return fail(res, 400, 'nothing', 'कुछ बदलने को नहीं मिला।')
    if (typeof body.upiId !== 'string') return fail(res, 400, 'bad_upi', 'UPI ID सही नहीं है (जैसे: naam@okaxis)।')
    const upiId = body.upiId.trim()
    if (upiId && !VPA_RE.test(upiId)) return fail(res, 400, 'bad_upi', 'UPI ID सही नहीं है (जैसे: naam@okaxis)।')
    try {
      const update = upiId ? { $set: { upiId } } : { $unset: { upiId: '' } }
      const r = await User.updateOne({ _id: req.uid }, update)
      if (!r.matchedCount) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      const user = await User.findById(req.uid)
      res.json({ user: publicUser(user) })
    } catch (e) {
      console.error('patch me:', e.message)
      fail(res, 500, 'server', 'Server में गड़बड़ हुई, फिर कोशिश करो।')
    }
  })


  // ---------- Profile/account controls ----------
  router.patch('/profile/name', requireAuth, async (req, res) => {
    const name = str(req.body.name).trim()
    if (name.length < 2 || name.length > 60) return fail(res, 400, 'bad_name', 'नाम 2 से 60 अक्षर का रखो।')
    try {
      const user = await User.findByIdAndUpdate(req.uid, { $set: { name } }, { new: true })
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      res.json({ user: publicUser(user) })
    } catch (e) { fail(res, 500, 'server', 'नाम सेव नहीं हो पाया।') }
  })

  router.patch('/profile/password', requireAuth, passwordChangeLimiter, async (req, res) => {
    const oldPassword = str(req.body.oldPassword)
    const newPassword = str(req.body.newPassword)
    if (newPassword.length < 6 || newPassword.length > 64) return fail(res, 400, 'weak_password', 'नया Password 6 से 64 अक्षर का रखो।')
    try {
      const user = await User.findById(req.uid).select('+passwordHash')
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया, फिर से Login करो।')
      if (user.passwordHash && !(await bcrypt.compare(oldPassword, user.passwordHash)))
        return fail(res, 401, 'bad_password', 'पुराना Password सही नहीं है।')
      user.passwordHash = await bcrypt.hash(newPassword, 10)
      user.tokenVersion = Number(user.tokenVersion || 0) + 1
      await user.save()
      res.json({ ok: true, reauthRequired: true })
    } catch (e) { fail(res, 500, 'server', 'Password बदला नहीं जा पाया।') }
  })

  router.post('/profile/phone/send', requireAuth, otpSendLimiter, async (req, res) => {
    const phone = str(req.body.phone).trim()
    if (!PHONE_RE.test(phone)) return fail(res, 400, 'bad_phone', 'मोबाइल नंबर सही नहीं है।')
    try {
      const exists = await User.findOne({ phone, _id: { $ne: req.uid } })
      if (exists) return fail(res, 409, 'phone_taken', 'यह मोबाइल नंबर दूसरे account से जुड़ा है।')
      const old = await Otp.findOne({ phone })
      if (old && Date.now() - old.lastSentAt.getTime() < OTP_RESEND_MS) return fail(res, 429, 'otp_cooldown', 'थोड़ी देर बाद नया OTP मँगाओ।')
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
      await Otp.updateOne({ phone }, { $set: { codeHash: hashOtp(phone, code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + OTP_TTL_MS), purpose: 'link', name: '' } }, { upsert: true })
      try { await sendSms(phone, `${BRAND_NAME} OTP: ${code} (5 मिनट के लिए)`) }
      catch (e) { await Otp.deleteOne({ phone }); if (e.code === 'SMS_NOT_CONFIGURED') return fail(res, 503, 'sms_off', 'OTP अभी चालू नहीं है।'); throw e }
      res.json({ ok: true, ...(cfg.devShowOtp ? { devOtp: code } : {}) })
    } catch (e) { console.error('phone/send:', e.message); fail(res, 500, 'server', 'OTP भेजा नहीं जा पाया।') }
  })

  router.post('/profile/phone/verify', requireAuth, async (req, res) => {
    const phone = str(req.body.phone).trim(), code = str(req.body.code).trim()
    if (!PHONE_RE.test(phone) || !/^\d{6}$/.test(code)) return fail(res, 400, 'bad_input', 'मोबाइल और 6 अंक का OTP डालो।')
    try {
      const otp = await Otp.findOneAndUpdate({ phone, expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true })
      if (!otp) return fail(res, 400, 'otp_expired', 'OTP खत्म हो गया, नया OTP मँगाओ।')
      if (otp.purpose !== 'link') return fail(res, 400, 'otp_purpose', 'OTP का इस्तेमाल सही स्क्रीन पर करो।')
      const given = Buffer.from(hashOtp(phone, code), 'hex'), real = Buffer.from(otp.codeHash, 'hex')
      if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) return fail(res, 400, 'otp_wrong', 'OTP गलत है।')
      const conflict = await User.findOne({ phone, _id: { $ne: req.uid } })
      if (conflict) return fail(res, 409, 'phone_taken', 'यह नंबर दूसरे account से जुड़ा है।')
      await User.updateOne({ _id: req.uid }, { $set: { phone } })
      await Otp.deleteOne({ phone })
      res.json({ user: publicUser(await User.findById(req.uid)) })
    } catch (e) { fail(res, 500, 'server', 'मोबाइल नंबर सेव नहीं हुआ।') }
  })

  router.post('/account/delete/send-otp', requireAuth, otpSendLimiter, async (req, res) => {
    try {
      const user = await User.findById(req.uid)
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया।')
      if (!user.phone) return fail(res, 400, 'phone_required', 'Account delete करने के लिए पहले mobile जोड़ो।')
      const phone = user.phone
      const old = await Otp.findOne({ phone })
      if (old && Date.now() - old.lastSentAt.getTime() < OTP_RESEND_MS) return fail(res, 429, 'otp_cooldown', 'थोड़ी देर बाद नया OTP मँगाओ।')
      const code = String(crypto.randomInt(0, 1000000)).padStart(6, '0')
      await Otp.updateOne({ phone }, { $set: { codeHash: hashOtp(phone, code), attempts: 0, lastSentAt: new Date(), expiresAt: new Date(Date.now() + OTP_TTL_MS), purpose: 'delete', name: '' } }, { upsert: true })
      try { await sendSms(phone, `${BRAND_NAME} account deletion OTP: ${code} (5 मिनट के लिए)`) }
      catch (e) { await Otp.deleteOne({ phone }); if (e.code === 'SMS_NOT_CONFIGURED') return fail(res, 503, 'sms_off', 'OTP अभी चालू नहीं है।'); throw e }
      res.json({ ok: true, ...(cfg.devShowOtp ? { devOtp: code } : {}) })
    } catch (e) { console.error('delete/send-otp:', e.message); fail(res, 500, 'server', 'OTP भेजा नहीं जा पाया।') }
  })

  router.delete('/account', requireAuth, async (req, res) => {
    const password = str(req.body && req.body.password)
    const code = str(req.body && req.body.otp).trim()
    try {
      const user = await User.findById(req.uid).select('+passwordHash')
      if (!user) return fail(res, 401, 'bad_token', 'Session खत्म हो गया।')
      if (user.passwordHash && user.email) {
        if (!password || !(await bcrypt.compare(password, user.passwordHash)))
          return fail(res, 401, 'confirm_required', 'Account delete करने के लिए सही password डालो।')
      } else {
        if (!user.phone || !/^\d{6}$/.test(code)) return fail(res, 400, 'confirm_required', 'Account delete करने के लिए OTP डालो।')
        const otp = await Otp.findOneAndUpdate({ phone: user.phone, purpose: 'delete', expiresAt: { $gt: new Date() }, attempts: { $lt: OTP_MAX_ATTEMPTS } }, { $inc: { attempts: 1 } }, { new: true })
        if (!otp) return fail(res, 400, 'otp_expired', 'OTP खत्म हो गया, नया OTP मँगाओ।')
        const given = Buffer.from(hashOtp(user.phone, code), 'hex'), real = Buffer.from(otp.codeHash, 'hex')
        if (given.length !== real.length || !crypto.timingSafeEqual(given, real)) return fail(res, 401, 'bad_password', 'OTP गलत है।')
        await Otp.deleteOne({ phone: user.phone })
      }
      const { Customer, Transaction } = require('./models')
      const customers = await Customer.find({ ownerId: req.uid }).select('_id')
      const ids = customers.map((c) => c._id)
      if (ids.length) await Transaction.deleteMany({ c: { $in: ids } })
      await Customer.deleteMany({ ownerId: req.uid })
      await Customer.updateMany({ linkedUserId: req.uid }, { $unset: { linkedUserId: '' } })
      await Otp.deleteMany({ phone: user.phone || '__no_phone__' })
      await User.deleteOne({ _id: req.uid })
      res.json({ ok: true })
    } catch (e) { console.error('account/delete:', e.message); fail(res, 500, 'server', 'Account delete nahi hua।') }
  })

  return { router, requireAuth }
}

module.exports = { createAuth }
