// Business type ke hisaab se taiyaar items (Hindi / English). Rate seller khud daalta hai — yahan sirf naam aur unit.
// unit: kg | litre | piece | packet  (server ke Item model jaisa)
export const BUSINESS_TYPES = [
  { key: 'kirana', icon: 'home', hi: 'किराना / जनरल स्टोर', en: 'Kirana / General store' },
  { key: 'dairy', icon: 'wallet', hi: 'डेयरी / दूध', en: 'Dairy / Milk' },
  { key: 'produce', icon: 'home', hi: 'सब्ज़ी / फल', en: 'Vegetables / Fruits' },
  { key: 'medical', icon: 'home', hi: 'मेडिकल स्टोर', en: 'Medical store' },
  { key: 'tea_snacks', icon: 'home', hi: 'चाय / नाश्ता', en: 'Tea / Snacks' },
  { key: 'hardware', icon: 'home', hi: 'हार्डवेयर', en: 'Hardware' },
  { key: 'clothing', icon: 'home', hi: 'कपड़े', en: 'Clothing' },
  { key: 'other', icon: 'home', hi: 'अन्य', en: 'Other' }
]

const I = (hi, en, unit) => ({ hi, en, unit })

export const CATALOG = {
  kirana: [
    I('चावल', 'Rice', 'kg'), I('आटा', 'Atta (wheat flour)', 'kg'), I('चीनी', 'Sugar', 'kg'), I('नमक', 'Salt', 'kg'),
    I('अरहर दाल', 'Arhar dal', 'kg'), I('मूंग दाल', 'Moong dal', 'kg'), I('चना दाल', 'Chana dal', 'kg'), I('सरसों तेल', 'Mustard oil', 'litre'),
    I('रिफाइंड तेल', 'Refined oil', 'litre'), I('चायपत्ती', 'Tea leaves', 'packet'), I('बिस्कुट', 'Biscuit', 'packet'), I('साबुन', 'Soap', 'piece'),
    I('माचिस', 'Matchbox', 'piece'), I('मैगी', 'Maggi', 'packet'), I('आलू', 'Potato', 'kg'), I('प्याज़', 'Onion', 'kg')
  ],
  dairy: [
    I('गाय का दूध', 'Cow milk', 'litre'), I('भैंस का दूध', 'Buffalo milk', 'litre'), I('दही', 'Curd', 'kg'), I('पनीर', 'Paneer', 'kg'),
    I('घी', 'Ghee', 'kg'), I('मक्खन', 'Butter', 'packet'), I('छाछ', 'Buttermilk', 'litre'), I('खोया', 'Khoya', 'kg'), I('क्रीम', 'Cream', 'packet')
  ],
  produce: [
    I('आलू', 'Potato', 'kg'), I('प्याज़', 'Onion', 'kg'), I('टमाटर', 'Tomato', 'kg'), I('हरी मिर्च', 'Green chilli', 'kg'),
    I('धनिया', 'Coriander', 'packet'), I('गोभी', 'Cauliflower', 'kg'), I('भिंडी', 'Okra', 'kg'), I('लौकी', 'Bottle gourd', 'kg'),
    I('केला', 'Banana', 'kg'), I('सेब', 'Apple', 'kg'), I('संतरा', 'Orange', 'kg'), I('नींबू', 'Lemon', 'kg')
  ],
  medical: [
    I('पैरासिटामोल', 'Paracetamol', 'packet'), I('बैंडेज', 'Bandage', 'piece'), I('ORS', 'ORS', 'packet'), I('कफ सिरप', 'Cough syrup', 'piece'),
    I('बाम', 'Balm', 'piece'), I('सैनिटाइज़र', 'Sanitizer', 'piece'), I('मास्क', 'Mask', 'packet'), I('कॉटन', 'Cotton', 'packet')
  ],
  tea_snacks: [
    I('चाय', 'Tea', 'piece'), I('कॉफ़ी', 'Coffee', 'piece'), I('समोसा', 'Samosa', 'piece'), I('कचौड़ी', 'Kachori', 'piece'),
    I('पकौड़ा', 'Pakora', 'packet'), I('बिस्कुट', 'Biscuit', 'packet'), I('ब्रेड', 'Bread', 'packet'), I('ब्रेड पकौड़ा', 'Bread pakora', 'piece')
  ],
  hardware: [
    I('सीमेंट', 'Cement', 'piece'), I('कील', 'Nails', 'kg'), I('पेंट', 'Paint', 'litre'), I('तार', 'Wire', 'kg'),
    I('बल्ब', 'Bulb', 'piece'), I('पाइप', 'Pipe', 'piece'), I('ताला', 'Lock', 'piece'), I('स्क्रू', 'Screws', 'packet')
  ],
  clothing: [
    I('शर्ट', 'Shirt', 'piece'), I('पैंट', 'Pant', 'piece'), I('साड़ी', 'Saree', 'piece'), I('कुर्ता', 'Kurta', 'piece'),
    I('दुपट्टा', 'Dupatta', 'piece'), I('बनियान', 'Vest', 'piece'), I('मोज़े', 'Socks', 'packet'), I('रुमाल', 'Handkerchief', 'piece')
  ],
  other: []
}

export const UNIT_LABEL = {
  kg: { hi: 'किलो', en: 'kg' }, litre: { hi: 'लीटर', en: 'litre' }, piece: { hi: 'नग', en: 'piece' }, packet: { hi: 'पैकेट', en: 'packet' }
}
export const UNITS = ['kg', 'litre', 'piece', 'packet']

export const businessLabel = (key, lang) => {
  const b = BUSINESS_TYPES.find((x) => x.key === key)
  return b ? b[lang === 'en' ? 'en' : 'hi'] : ''
}
export const unitLabel = (u, lang) => (UNIT_LABEL[u] ? UNIT_LABEL[u][lang === 'en' ? 'en' : 'hi'] : u || '')
export const catalogFor = (key, lang) =>
  (CATALOG[key] || []).map((x) => ({ name: lang === 'en' ? x.en : x.hi, unit: x.unit }))
