import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const index = readFileSync("index.html", "utf8");
const worker = readFileSync("service-worker.js", "utf8");
const manifest = JSON.parse(readFileSync("manifest.webmanifest", "utf8"));

assert.equal(manifest.display, "standalone");
assert.equal(manifest.icons.length, 2);
assert.match(index, /rel="manifest" href="\/manifest\.webmanifest"/);
assert.match(index, /serviceWorker\.register\("\/service-worker\.js"\)/);
assert.match(worker, /const APP_SHELL/);
assert.match(worker, /request\.destination === "image"/);
assert.match(index, /const CATALOG_STORAGE_KEY = "lacosechaCatalog"/);
assert.match(index, /saveCatalog\(data\)/);
assert.match(index, /const cachedCatalog = getCachedCatalog\(\)/);
assert.match(index, /products\.clear\(\)/);
assert.match(index, /categories\.replaceChildren\(\)/);
console.log("PWA cache checks passed.");

assert.match(index, /let canCheckout = navigator\.onLine/);
assert.match(index, /checkout\.hidden = !canCheckout/);
assert.match(index, /canCheckout = false;/);
assert.doesNotMatch(worker, /docs\.google\.com/);
assert.match(index, /if \(!canCheckout\) \{/);
assert.match(index, /Necesitás conexión para confirmar el pedido\./);
assert.match(index, /window\.addEventListener\("offline", \(\) => \{/);
console.log("Offline checkout checks passed.");
