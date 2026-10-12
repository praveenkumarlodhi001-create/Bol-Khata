const crypto = require('crypto')
const express = require('express')
const rateLimit = require('express-rate-limit')
const { VPA_RE } = require('./upi')

// WhatsApp me `upi://` link aksar clickable nahi hota, `https://` link hota hai.
// Isliye reminder me is server ka https link jaata hai (/pay?pa=..&am=..), ye page seedha UPI app khol deta hai.
// Page login ke bina khulta hai (grahak ke paas account nahi hota), isliye har cheez sakht check hoti hai.

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
// control characters hatao, lambai seemit karo
const clean = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>"'`\\]/g, '').trim().slice(0, max) : '')
const enc = (s) => encodeURIComponent(s)

function buildUpiUrl({ pa, pn, am, tn }) {
  let url = 'upi://pay?pa=' + enc(pa).replace(/%40/g, '@')
  if (pn) url += '&pn=' + enc(pn)
  if (am) url += '&am=' + am
  url += '&cu=INR'
  if (tn) url += '&tn=' + enc(tn)
  return url
}

function page(nonce, { pa, pn, am, upi }) {
  return `<!doctype html>
<html lang="hi"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>UPI से भुगतान</title>
<style nonce="${nonce}">
body{font-family:system-ui,sans-serif;background:#f4faf7;margin:0;padding:24px;color:#14352b;text-align:center}
.card{max-width:380px;margin:40px auto;background:#fff;border-radius:18px;padding:28px 22px;box-shadow:0 4px 20px rgba(0,0,0,.08)}
h1{font-size:20px;margin:0 0 6px}.amt{font-size:34px;font-weight:800;margin:10px 0}.sub{color:#5a7a6e;font-size:14px}
.btn{display:block;background:#1a8f6e;color:#fff;text-decoration:none;font-weight:700;padding:14px;border-radius:12px;margin:18px 0 10px;border:0;width:100%;font-size:16px}
.ghost{background:#e4f3ed;color:#14352b}.vpa{font-family:monospace;background:#f0f5f3;padding:6px 10px;border-radius:8px;display:inline-block;margin-top:6px}
</style></head><body><div class="card">
<h1>${pn ? esc(pn) + ' को भुगतान' : 'UPI से भुगतान'}</h1>
${am ? `<div class="amt">₹${esc(am)}</div>` : ''}
<div class="sub">UPI ID<br><span class="vpa" id="vpa">${esc(pa)}</span></div>
<a class="btn" id="go" href="${esc(upi)}">UPI app खोलो</a>
<button class="btn ghost" id="copy" type="button">UPI ID कॉपी करो</button>
<div class="sub">GPay, PhonePe, Paytm — जो भी app हो उसमें खुल जाएगा।</div>
</div>
<script nonce="${nonce}">
var go=document.getElementById('go');
setTimeout(function(){location.href=go.href},400);
document.getElementById('copy').onclick=function(){
  var t=document.getElementById('vpa').textContent;
  if(navigator.clipboard){navigator.clipboard.writeText(t).then(function(){document.getElementById('copy').textContent='कॉपी हो गया ✓'})}
  else{prompt('UPI ID कॉपी करो',t)}
};
</script></body></html>`
}

function createPay() {
  const router = express.Router()
  const limiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 60,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => res.status(429).type('text').send('थोड़ी देर बाद फिर कोशिश करो।')
  })

  router.get('/pay', limiter, (req, res) => {
    const pa = clean(req.query.pa, 100)
    res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' })
    if (!VPA_RE.test(pa)) return res.status(400).type('text').send('UPI ID सही नहीं है।')
    const pn = clean(req.query.pn, 40)
    const tn = clean(req.query.tn, 40)
    const amRaw = clean(req.query.am, 12)
    const am = /^\d{1,8}(\.\d{1,2})?$/.test(amRaw) && Number(amRaw) > 0 ? amRaw : ''
    const upi = buildUpiUrl({ pa, pn, am, tn })
    const nonce = crypto.randomBytes(16).toString('base64')
    res.set(
      'Content-Security-Policy',
      `default-src 'none'; style-src 'nonce-${nonce}'; script-src 'nonce-${nonce}'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'`
    )
    res.type('html').send(page(nonce, { pa, pn, am, upi }))
  })

  return router
}

module.exports = { createPay, buildUpiUrl }
