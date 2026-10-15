const mongoose = require('mongoose')

// ---------- User ----------
const userSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, maxlength: 60, default: '' },
    role: { type: String, enum: ['seller', 'buyer'], default: undefined },
    roleChosenAt: { type: Date, default: null },
    businessType: { type: String, enum: ['kirana', 'dairy', 'produce', 'medical', 'tea_snacks', 'hardware', 'clothing', 'other'], default: null },
    email: { type: String, trim: true, lowercase: true, maxlength: 120, unique: true, sparse: true },
    phone: { type: String, trim: true, unique: true, sparse: true },
    passwordHash: { type: String, select: false },
    tokenVersion: { type: Number, default: 0 },
    upiId: { type: String, trim: true, maxlength: 100 },
    photo: { type: Buffer, select: false },
    hasPhoto: { type: Boolean, default: false },
    photoVersion: { type: Number, default: 0 }
  },
  { timestamps: true }
)
const User = mongoose.model('User', userSchema)

// ---------- OTP ----------
const otpSchema = new mongoose.Schema({
  phone: { type: String, required: true, unique: true },
  codeHash: { type: String, required: true },
  attempts: { type: Number, default: 0 },
  purpose: { type: String, enum: ['login', 'signup', 'link', 'delete', 'reset'], default: 'login' },
  name: { type: String, maxlength: 60, default: '' },
  role: { type: String, enum: ['seller', 'buyer', ''], default: '' },
  lastSentAt: { type: Date, required: true },
  expiresAt: { type: Date, required: true }
})
otpSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 })
const Otp = mongoose.model('Otp', otpSchema)

// ---------- Customer (ek dukaan-malik ka ek grahak) ----------
// ownerId      : jis dukaan-malik (User) ke khate me ye grahak hai
// linkedUserId : grahak ne invite code se apna account jod liya ho to uska User id
// phone        : malik ne grahak ka number daala ho to us number se OTP login karne wala grahak apne aap jud jaata hai
// given/paid/count/lastAt : transactions ka jod. Har entry jodne/badalne/hatane ke baad transactions se dobara
//                           nikala jaata hai (ledger.js: recompute), isliye kabhi galat nahi rehta aur har baar
//                           saari entries padhni nahi padti.
const customerSchema = new mongoose.Schema(
  {
    ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 60 },
    phone: { type: String, trim: true },
    inviteCode: { type: String, required: true, unique: true },
    linkedUserId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    given: { type: Number, default: 0 },
    paid: { type: Number, default: 0 },
    count: { type: Number, default: 0 },
    lastAt: { type: Date },
    // roz ki fixed entry (jaise doodh): da = rakam, dr = vajah. Dono na ho to is grahak ki roz ki entry nahi hai.
    da: { type: Number },
    dr: { type: String, trim: true, maxlength: 60 }
  },
  { versionKey: false }
)
customerSchema.index({ ownerId: 1, name: 1 }, { unique: true })
customerSchema.index({ linkedUserId: 1 }, { sparse: true })
customerSchema.index({ phone: 1 }, { sparse: true })
const Customer = mongoose.model('Customer', customerSchema)

// ---------- Transaction (sabse zyada badhne wali collection, isliye jaan-boojhkar chhoti rakhi hai) ----------
// Chhote field naam (har document me naam bhi jagah leta hai), koi ownerId / timestamps / __v nahi,
// aur sirf ek index. Free 512 MB me iska matlab pehle se kaafi zyada entries.
//   c = customerId, t = 0 udhar (malik ne grahak ko diya, bakaya badhta hai) / 1 payment (grahak ne diya),
//   a = amount, r = reason / vajah (optional, 60 akshar tak), d = date-time
const transactionSchema = new mongoose.Schema(
  {
    c: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    t: { type: Number, enum: [0, 1], required: true },
    a: { type: Number, required: true },
    r: { type: String, trim: true, maxlength: 60 },
    d: { type: Date, required: true, default: Date.now },
    // sirf "roz ki entry" par: d-<grahak id>-<din>. Ek grahak ki ek din ki entry ek hi baar judti hai,
    // chahe do phone se dabao. (Baaki entries par ye nahi hota, taaki storage na badhe.)
    k: { type: String, maxlength: 60 },
    // itemized entry (optional): [{ n naam, q matra, p rate, u unit }]. Sirf jab seller ne items se entry ki ho.
    i: { type: [new mongoose.Schema({ n: { type: String, maxlength: 40 }, q: Number, p: Number, u: { type: String, enum: ['kg', 'litre', 'piece', 'packet'] } }, { _id: false })], default: undefined }
  },
  { versionKey: false }
)
transactionSchema.index({ c: 1, d: -1 })
transactionSchema.index({ k: 1 }, { unique: true, sparse: true })
const Transaction = mongoose.model('Transaction', transactionSchema)

// Seller's saved catalog. Prices are optional because sellers may set them per entry.
const itemSchema = new mongoose.Schema({
  ownerId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
  name: { type: String, required: true, trim: true, maxlength: 40 },
  unit: { type: String, enum: ['kg', 'litre', 'piece', 'packet'], required: true },
  price: { type: Number, min: 0, max: 10000000 },
  active: { type: Boolean, default: true }
}, { timestamps: true })
itemSchema.index({ ownerId: 1, name: 1 }, { unique: true })
const Item = mongoose.model('Item', itemSchema)

// Purane (bhaari) version ke bekaar indexes hata do taaki storage na khayein. Na mile to koi baat nahi.
async function dropLegacyIndexes() {
  for (const name of ['ownerId_1', 'customerId_1_at_-1']) {
    try {
      await Transaction.collection.dropIndex(name)
    } catch (e) {
      /* index hai hi nahi */
    }
  }
}

async function syncIndexes() {
  await dropLegacyIndexes()
  await Promise.all([User.init(), Otp.init(), Customer.init(), Transaction.init(), Item.init()])
}

module.exports = { User, Otp, Customer, Transaction, Item, syncIndexes }
