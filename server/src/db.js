const dns = require('dns')
const mongoose = require('mongoose')

// MongoDB ki aam errors ko seedhi bhasha me samjhata hai.
function diagnose(e, uri = '') {
  const msg = String((e && e.message) || e)
  const isLocal = /127\.0\.0\.1|localhost|\[::1\]/.test(uri) || /127\.0\.0\.1|::1/.test(msg)
  const hints = []

  if (/querySrv|ENOTFOUND.*_mongodb/i.test(msg)) {
    hints.push(
      'Atlas ka "mongodb+srv://" address DNS se nahi mila (WiFi/ISP ka DNS SRV record nahi de raha).',
      'Fix 1: server/.env me  DNS_SERVERS=8.8.8.8,1.1.1.1  likho.',
      'Fix 2: Atlas me Connect → Drivers → "Standard connection string" (mongodb://...) wala URI use karo.'
    )
  } else if (/bad auth|Authentication failed|AuthenticationFailed/i.test(msg)) {
    hints.push(
      'Username ya password galat hai (Atlas ke "Database Access" wala user, Atlas login nahi).',
      'Password me @ : / ? # jaise symbol hon to URL-encode karo (@ → %40), ya simple password rakho.'
    )
  } else if (/not authorized|requires authentication/i.test(msg)) {
    hints.push('User ko is database ka access nahi hai ya URI me username/password nahi diya.')
  } else if (isLocal && /ECONNREFUSED|timed out|Server selection/i.test(msg)) {
    hints.push(
      'Laptop par MongoDB chal hi nahi raha (port 27017 band hai). Pehle use start karo:',
      '  Windows : Win+R → services.msc → "MongoDB Server" → Start   (ya Admin terminal me: net start MongoDB)',
      '  macOS   : brew services start mongodb-community',
      '  Linux   : sudo systemctl start mongod',
      '  Docker  : docker run -d --name mongo -p 27017:27017 mongo:7',
      'MongoDB install nahi karna? Atlas ka free cluster lo aur uska URI .env me MONGODB_URI me daalo.'
    )
  } else if (/ECONNREFUSED|ENOTFOUND|ETIMEDOUT|timed out|Server selection|ReplicaSetNoPrimary/i.test(msg)) {
    hints.push(
      'Atlas tak pahunch nahi paye. Check karo:',
      '  1) Atlas → Network Access me aapka IP (ya testing ke liye 0.0.0.0/0) allowed hai',
      '  2) Internet chal raha hai / VPN band hai',
      '  3) Free cluster paused to nahi (inactivity par pause ho jaata hai)'
    )
  } else if (/Invalid scheme|Invalid connection string|must be of the form/i.test(msg)) {
    hints.push('MONGODB_URI galat hai. Wo mongodb:// ya mongodb+srv:// se shuru hona chahiye, bina quotes/space ke.')
  }
  return hints
}

function redact(uri) {
  return String(uri).replace(/\/\/([^:@/]+):([^@]*)@/, '//$1:****@')
}

async function connect(cfg) {
  if (cfg.dnsServers && cfg.dnsServers.length) dns.setServers(cfg.dnsServers)
  mongoose.connection.on('disconnected', () => console.warn('MongoDB se connection toot gaya (mongoose khud dobara try karega)'))
  mongoose.connection.on('reconnected', () => console.log('MongoDB dobara connect ho gaya'))
  await mongoose.connect(cfg.mongoUri, {
    serverSelectionTimeoutMS: 8000,
    // "localhost" kai laptops par ::1 (IPv6) par jaata hai jahan MongoDB nahi sunta — IPv4 force.
    family: 4
  })
}

module.exports = { connect, diagnose, redact }
