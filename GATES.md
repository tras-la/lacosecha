# Gates: Offline-capable shop PWA

Scope: Make the standalone shop installable, cache a previously loaded catalog and app shell for offline browsing/cart use, and prevent checkout unless online.

- [x] G1: The site exposes a linked web-app manifest and a registered service worker that cache the page shell and required local assets.
  CHECK: test -f manifest.webmanifest && test -f service-worker.js && rg -q 'rel="manifest"' index.html && rg -q 'serviceWorker\.register' index.html && node --check service-worker.js && echo 'PWA assets present'
  EXPECT: PWA assets present
  EVIDENCE: PWA assets present

- [x] G2: After one online visit, the app shell and parsed Google Sheets catalog can be served without a network connection.
  CHECK: node tests/pwa-check.mjs
  EXPECT: PWA cache checks passed.
  EVIDENCE: PWA cache checks passed. | Offline checkout checks passed.

- [x] G3: Cart items remain usable offline and checkout is blocked while offline with clear Spanish feedback; no order request is sent.
  CHECK: node tests/pwa-check.mjs
  EXPECT: Offline checkout checks passed.
  EVIDENCE: PWA cache checks passed. | Offline checkout checks passed.

- [x] G4: In Chromium, an online-loaded catalog remains visible with network disabled, products can be added to cart, and checkout is unavailable until online.
  EVIDENCE: `CHROME_DEBUG_PORT=9223 node tests/offline-browser-check.mjs` → `Chromium offline catalog and checkout checks passed.`

- [x] G5: New PWA assets and checkout behavior pass syntax/static checks without regressing the current online order flow.
  CHECK: node --check /tmp/lacosecha-shop.js && node --check service-worker.js && git diff --check && echo 'Syntax and diff checks passed.'
  EXPECT: Syntax and diff checks passed.
  EVIDENCE: Syntax and diff checks passed.
