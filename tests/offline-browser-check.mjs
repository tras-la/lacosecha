const debugPort = process.env.CHROME_DEBUG_PORT || "9222";
const endpoint = `http://127.0.0.1:${debugPort}/json/list`;

const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

async function pageTarget() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const targets = await (await fetch(endpoint)).json();
      const page = targets.find((target) => target.type === "page");
      if (page) return page;
    } catch {}
    await wait(250);
  }
  throw new Error("No se encontró Chromium con depuración remota.");
}

const target = await pageTarget();
const socket = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let sequence = 0;
const pending = new Map();
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (!pending.has(message.id)) return;
  const { resolve, reject } = pending.get(message.id);
  pending.delete(message.id);
  message.error ? reject(new Error(message.error.message)) : resolve(message.result);
});

function cdp(method, params = {}) {
  const id = ++sequence;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await cdp("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

async function waitForProducts() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    if (await evaluate("document.querySelectorAll('.product-card').length")) return;
    await wait(250);
  }
  throw new Error("El catálogo no se mostró.");
}

try {
  await cdp("Network.enable");
  await cdp("Page.navigate", { url: "http://127.0.0.1:4173/" });
  await waitForProducts();
  await evaluate("navigator.serviceWorker.ready");
  await cdp("Page.reload", { ignoreCache: true });
  await waitForProducts();

  await cdp("Network.emulateNetworkConditions", {
    offline: true,
    latency: 0,
    downloadThroughput: 0,
    uploadThroughput: 0,
    connectionType: "none",
  });
  await cdp("Page.reload", { ignoreCache: true });
  await waitForProducts();

  const offlineResult = await evaluate(`(() => {
    document.querySelector('.add-to-cart').click();
    document.querySelector('#cart-toggle').click();
    return {
      cartItems: JSON.parse(localStorage.getItem('lacosechaCartItems') || '[]').length,
      checkoutHidden: document.querySelector('#checkout').hidden,
      message: document.querySelector('#checkout-status').textContent,
    };
  })()`);

  if (offlineResult.cartItems !== 1 || !offlineResult.checkoutHidden ||
      offlineResult.message !== "Necesitás conexión para confirmar el pedido.") {
    throw new Error(`Falló el flujo offline: ${JSON.stringify(offlineResult)}`);
  }
  console.log("Chromium offline catalog and checkout checks passed.");
} finally {
  try {
    await cdp("Network.emulateNetworkConditions", {
      offline: false,
      latency: 0,
      downloadThroughput: -1,
      uploadThroughput: -1,
      connectionType: "none",
    });
  } catch {}
  socket.close();
}
