# 🚀 Vercel Downloader API Gateway

Ultra-lightweight API Router / Gateway jo Vercel par host hoga aur aapke Cloudflare Worker endpoints ko smart tarike se route karega.

---

## 💡 Iska Fayda (Kyu use kare?)

1. **Android App ko bar-bar update nahi karna padega:**
   - Future me agar aap Pinterest ke baad **Facebook, YouTube, TikTok** etc. add karte ho, toh aapko Play Store par naya APK/AAB update nahi nikalna padega.
   - Sirf is Vercel API ke `src/config.js` me 1 entry add karni hogi, aur saare app users ke liye turant naya platform chalne lagega!
2. **Smart Platform Detection:**
   - Android app ko ye batane ki bhi jarurat nahi hai ki link Instagram ka hai ya Pinterest ka.
   - App sirf `/api/download?url=...` bhejega, Gateway apne aap link dekhkar sahi Cloudflare endpoint par forward kar dega.
3. **Domain Protection & Backup:**
   - Agar Cloudflare Worker ka domain kabhi badalta hai, toh sirf Vercel ke `.env` me `PRIMARY_WORKER_URL` update karna hai. App band nahi hogi!

---

## 📡 Endpoints Overview

| Method | Endpoint | Description |
|---|---|---|
| `GET` | `/api/download?url={LINK}` | **Smart Universal Endpoint**: Kisi bhi platform ki link dalo, auto-route karega. |
| `GET` | `/api/download/:platform?url={LINK}` | **Explicit Endpoint**: Direct platform specify karke download karne ke liye (`instagram`, `threads`, `pinterest`). |
| `GET` | `/api/config` | Android app ko dynamically supported platforms aur worker details return karta hai. |
| `GET` | `/api/health` | Gateway server & worker status check. |

---

## 🛠️ Local Testing (Apne PC par chalaye)

1. Is folder me terminal open kare:
   ```bash
   cd vercel-gateway
   ```
2. Dependencies install kare:
   ```bash
   npm install
   ```
3. Server start kare:
   ```bash
   npm start
   ```
4. Browser ya Postman me test kare:
   ```http
   http://localhost:3000/api/download?url=https://pin.it/3001Q8B
   http://localhost:3000/api/download?url=https://www.instagram.com/reel/C8q7vP...
   http://localhost:3000/api/config
   ```

---

## 🚀 Vercel par Deploy Kaise Kare?

### Option 1: GitHub se (Recommended)
1. Is `vercel-gateway` folder ko apne GitHub repository me push kare (chahe alag repo banaye ya monorepo).
2. [Vercel Dashboard](https://vercel.com/) par jaye -> **"Add New Project"**.
3. Repository select kare aur **Deploy** par click kare.
4. (Optional) Settings -> **Environment Variables** me jakar:
   - `PRIMARY_WORKER_URL`: `https://alldownloader.solankipriyanshu94.workers.dev`

### Option 2: Vercel CLI se
```bash
cd vercel-gateway
npm i -g vercel
vercel
```

Deploy hone ke baad aapko aapka Vercel URL mil jayega, jaise:
`https://your-gateway-api.vercel.app`

---

## 📱 Android App (`igapp`) me Kaise Use Kare?

Apne Android app me `baseUrl` ko Cloudflare ki jagah Vercel Gateway par point kar de:

```javascript
// Android App (InstagramDownloaderService.js ya api.js)
const GATEWAY_URL = 'https://your-gateway-api.vercel.app';

export async function downloadMedia(pastedUrl) {
  // Sirf 1 endpoint call karein, platform batane ki bhi jarurat nahi!
  const endpoint = `${GATEWAY_URL}/api/download?url=${encodeURIComponent(pastedUrl)}`;
  const response = await fetch(endpoint);
  return await response.json();
}
```

---

## ➕ Future me Naya Platform Kaise Add Kare?

Agar future me aapko koi naya platform (jaise **Facebook**) add karna ho:
Bas [`src/config.js`](./src/config.js) open kare aur `PLATFORMS` object me 1 entry add kar de:

```javascript
facebook: {
  id: "facebook",
  name: "Facebook",
  regex: /(?:facebook\.com|fb\.watch)/i,
  endpoint: "/api/download/facebook",
  example: "https://fb.watch/...",
},
```

Aur commit karke push kare! **Zero Android app updates required!** 🎉
