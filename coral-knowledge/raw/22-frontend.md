<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/frontend -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/sol_coralos/frontend.md).

# Frontend

The frontend is **one file** — `examples/agent-economy/bridge/web/index.html` — served by the bridge at `localhost:3010`. No framework, no build step: vanilla JS, with `@solana/web3.js` loaded from a CDN. It has two tabs (**Autonomous** and **Checkout**) that all talk to the bridge over plain `fetch`.

```
Browser (index.html)  ──fetch──▶  bridge (server.ts)  ──▶  CoralOS + Solana
```

#### How it talks to the backend

Because the bridge serves the page, the API is same-origin:

```js
const SERVER = location.origin

// Checkout: ask the seller, pay with Phantom, submit the proof
const order = await fetch(`${SERVER}/order`, { method:'POST',
  headers:{'Content-Type':'application/json'}, body: JSON.stringify({ service }) }).then(r=>r.json())
// …build the transfer with order.reference, Phantom signs → sig…
const done = await fetch(`${SERVER}/order/${order.reference}/paid`, { method:'POST',
  headers:{'Content-Type':'application/json'}, body: JSON.stringify({ sig }) }).then(r=>r.json())

// Autonomous: start the agent loop, then poll the conversation
await fetch(`${SERVER}/autonomous/start`, { method:'POST' })
const { messages } = await fetch(`${SERVER}/autonomous/feed`).then(r=>r.json())
```

#### The backend it pairs with

`server.ts` is a small Express app that **self-serves the UI** and exposes those endpoints:

```ts
const app = express()
app.use(express.json())
app.use(express.static(webDir))        // serves web/index.html

app.post('/order', async (req, res) => { /* inject "request" into coral, return the Solana Pay reference */ })
app.post('/order/:reference/paid', async (req, res) => { /* submit proof, return DELIVERED data */ })
app.post('/autonomous/start', async (_req, res) => { /* create a [buyer,seller] session */ })
app.get('/autonomous/feed', async (_req, res) => { /* read the conversation from coral's extended state */ })
```

#### Expanding it — backend + frontend together

Every new feature is **one endpoint + one fetch**. Example: show the seller's live earnings.

**1. Add a backend route** (`server.ts`):

```ts
import { Connection, PublicKey, LAMPORTS_PER_SOL } from '@solana/web3.js'
app.get('/earnings', async (_req, res) => {
  const bal = await new Connection(RPC).getBalance(new PublicKey(SELLER_WALLET))
  res.json({ sol: bal / LAMPORTS_PER_SOL })
})
```

**2. Wire it in the UI** (`index.html`):

```html
<div id="earnings"></div>
<script>
  const e = await fetch('/earnings').then(r => r.json())
  earnings.textContent = `Seller has earned ${e.sol} SOL`
</script>
```

Refresh the page — done. (The bridge mounts `web/` as a volume, so UI edits show on refresh with no rebuild.)

#### What can be build on it

* **New services in the picker** — add a radio option whose `value` is a new `SERVICE` your seller handles.
* **A richer feed** — render payment amounts, running totals, per-agent stats from `/autonomous/feed`.
* **New front doors** — a Discord/CLI client, or a vertical storefront, all hitting the same `/order` + `/paid` endpoints.
* **A dashboard** — new read endpoints (earnings, order history, account watches) + UI to match.

The rule: **the frontend never touches Solana or CoralOS directly** — it only calls the bridge. So you extend by adding a bridge endpoint (which talks to coral/Solana) and a bit of UI that calls it.

* **For a polished product/showcase**: React (Vite or Next) is nicer — components, state, routing, real wallet-adapter UX.&#x20;


---

