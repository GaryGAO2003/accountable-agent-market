# 04 — The `sol_coralOS` Codebase Kit

> A working agent economy: a **seller agent** sells a service for SOL, a **buyer** (agent or
> human) pays for it on-chain. This page gets it running and explains what "running" means.

## Prereqs
- **Docker Desktop** (running) · **Node 20+** · a **Phantom** wallet (human checkout)
- `just` (optional one-shot command runner):
  - Windows: `winget install Casey.Just` (or `scoop install just`)
  - macOS: `brew install just`
  - Linux/Rust: `cargo install just`

## Fork + run (fastest path, ~20 min)
```sh
git clone https://github.com/<you>/sol_coralOS    # your fork
cd sol_coralOS
just dev                                           # ← the one command
```
`just dev` (or `node scripts/setup.js`) generates two devnet wallets → saves addresses to
**`WALLETS.txt`**. Fund both at **faucet.solana.com** (GitHub sign-in). Then open
**http://localhost:3010**.

### No `just`? Same thing by hand
```sh
cd scripts && npm install && cd ..
node scripts/setup.js          # makes wallets → .env, prints 2 addresses
# fund both at faucet.solana.com (GitHub sign-in)
bash build-agents.sh           # build seller / buyer / user-proxy images
docker compose up -d coral bridge
# open http://localhost:3010
```

## ⚠️ What "starting it up" actually means (the gotcha)

**`docker compose up` does NOT start the agents.** It starts two long-lived services:
- **coral-server** (`:5555`) — the coordination layer, sitting idle, waiting.
- **the bridge** (`:3010`) — an Express server that serves the demo UI and talks to coral.

At that point **no buyer or seller is running.** Agents are **not long-lived services** —
they're spawned **on demand, per session**.

### Where the agents come in
When you open `localhost:3010` and click **Run the agent↔agent demo** (Autonomous tab):
```
you click Run
  → bridge asks coral: "make a session with [buyer-agent, seller-agent]"
  → coral LAUNCHES both as Docker containers
  → each agent connects back to coral over MCP
  → buyer opens a thread, sends "request…", seller replies "pay…", buyer pays on-chain, seller delivers
```
> **Lifecycle:** coral + bridge run continuously; the agents **flicker into existence** when a
> session names them, do their trading, and that's the demo. (The **Checkout** tab is the same
> with *you* as the buyer paying via Phantom.)
> `just dev` boots the *infrastructure*; clicking **Run** brings the **agents** to life.

---

## The Agents (`coral-agents/`)

Each agent is a small TypeScript program built on `@pay/agent-runtime`. CoralOS launches them
per session; they talk over threads.

| Agent | Role | Fork point |
|-------|------|-----------|
| **seller-agent** | Fulfillment: `request → PAYMENT_REQUIRED → paid → DELIVERED`. Verifies payment on-chain, then delivers | `src/service.ts → deliverService()` |
| **buyer-agent** | Autonomous buyer: requests a service, decides to pay (LLM with code-enforced budget), pays on-chain, receives data | `src/{goal.ts, llm_buyer.ts}` |
| **echo-agent** | Minimal agent — echoes any mention. Connectivity check + **template to copy** | `src/index.ts` |

### The shape of every agent (echo-agent = the whole pattern)
```ts
// coral-agents/echo-agent/src/index.ts
import { startCoralAgent } from '@pay/agent-runtime'
await startCoralAgent({ agentName: 'echo-agent' }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()
    if (m) await ctx.reply(m, `echo: ${m.text}`)
  }
})
```
The seller and buyer are this same loop with real logic. **You only write `run`; CoralOS
handles spawning, connecting, routing.**

### Adding a new agent — 4 files in `coral-agents/<name>/`
**1. `src/index.ts`** — behavior (the `startCoralAgent` loop).
**2. `coral-agent.toml`** — the manifest CoralOS reads:
```toml
edition = 4
[agent]
name = "broker"
version = "0.1.0"
description = "Routes a request to the cheapest seller."
[agent.license]
type = "spdx"
expression = "MIT"
[options]
SOLANA_RPC_URL = { type = "string", default = "" }
[runtimes.docker]
image = "broker:0.1.0"
```
**3. `package.json`** — depend on the runtime:
```json
{ "name": "broker", "type": "module",
  "dependencies": { "@pay/agent-runtime": "file:../../packages/agent-runtime" } }
```
**4. `Dockerfile`** — same as the other agents (build from repo root so it bundles `packages/`).

**Then register + run:**
- `config/coral.toml` already scans `localAgents = ["/agents/*"]` → **auto-discovered**, no edit.
- Build the image: `docker build -f coral-agents/broker/Dockerfile -t broker:0.1.0 .`
- **Name it in a session**: `agents: [buyer-agent, broker, seller-agent]` → coral spawns all three.

> Model: **write a `startCoralAgent` loop, give it a manifest + image, name it in a session.**

---

## The Package: `@pay/agent-runtime` (`packages/`)

The kit's one shared library. Every TS agent depends on it via a local `file:` link. It owns
the agent loop, lifecycle, messaging, state, and the CoralOS connection — **you only write
behavior**.

```ts
import { startCoralAgent, BaseStrategy, AgentManager } from '@pay/agent-runtime'
```

### What it exports
| Export | What it is |
|--------|-----------|
| `startCoralAgent` | the entrypoint — connects an agent to CoralOS, hands you `ctx` (`waitForMention`, `reply`, `send`, `createThread`) |
| `CoralMcpAgent` | the MCP client underneath (StreamableHTTP transport, tool discovery) |
| `BaseStrategy` / `Strategy` | the behavior interface: `run(state, signal)` + `handleMessage(text, state)` |
| `AgentManager` | runs many agents in one process; owns the shared `bus` + `state` |
| `MessageBus` | broadcast / direct messaging between agents |
| `SharedState` | a versioned key-value blackboard all agents read/write |
| `WorkflowEngine` | a DAG of steps for multi-step jobs |
| `strategies/*` | ready templates: `Idle`, `RpcPoll`, `Weather`, `Transfer`, `Payment`, `HeliusMonitor` |

### Two ways to use it
**1. A CoralOS agent** (what `coral-agents/` does) — write the loop; runtime handles spawn/connect/route:
```ts
await startCoralAgent({ agentName: 'seller-agent' }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()
    if (m) await ctx.reply(m, 'PAYMENT_REQUIRED …')
  }
})
```
**2. A reusable Strategy** — for the `AgentManager`/HTTP side, or to share logic:
```ts
class RiskStrategy extends BaseStrategy {
  readonly name = 'risk'
  async run(state, signal) { while (!signal.aborted) { /* monitor */ } }   // respect the AbortSignal
  async handleMessage(text) { return assess(text) }
}
```
> **The rule: you build ON it, you don't edit it.** New data to sell → `deliverService`.
> New autonomous behavior → `startCoralAgent`. Reusable logic → `BaseStrategy`.
> Full reference in `packages/agent-runtime/README.md`.

### Extending — three paths (smallest first)
Example idea: *"an agent that sells a wallet's risk score."*

- **Path A — just a new service** (90% of projects). Add a branch to the seller's
  `deliverService`. **Zero CoralOS contact** — the seller's loop already does all messaging;
  you only write logic that returns a string. Set `SERVICE=risk-score`.
  ```ts
  case 'risk-score': return riskScore(request)
  ```
- **Path B — a whole new agent** (when you need new *behavior*, e.g. a broker). You touch
  CoralOS but only through `ctx` (`waitForMention`/`reply` **are** CoralOS MCP calls, wrapped).
  Auto-discovered via `coral.toml` scan, launched when a session names it.
- **Path C — a reusable Strategy** (`AgentManager`/HTTP side). **No CoralOS at all** — runs in-process.

---

## The Frontend

The default frontend is **one file** — `examples/agent-economy/bridge/web/index.html` — served
by the bridge at `localhost:3010`. **No framework, no build step:** vanilla JS + `@solana/web3.js`
from a CDN. Two tabs (**Autonomous** and **Checkout**), all talking to the bridge over `fetch`.

```
Browser (index.html)  ──fetch──▶  bridge (server.ts)  ──▶  CoralOS + Solana
```

### Bridge endpoints (`server.ts`, a small Express app that self-serves the UI)
```ts
app.use(express.static(webDir))        // serves web/index.html
app.post('/order', …)                  // inject "request" into coral, return the Solana Pay reference
app.post('/order/:reference/paid', …)  // submit proof (sig), return DELIVERED data
app.post('/autonomous/start', …)       // create a [buyer,seller] session
app.get('/autonomous/feed', …)         // read the conversation from coral's extended state
```

### The checkout flow (3 calls)
```js
const SERVER = location.origin
const order = await fetch(`${SERVER}/order`, {method:'POST', …, body: JSON.stringify({service})}).then(r=>r.json())
// …build the SystemProgram.transfer with order.reference, Phantom signs → sig…
const done = await fetch(`${SERVER}/order/${order.reference}/paid`, {method:'POST', …, body: JSON.stringify({sig})}).then(r=>r.json())
```

### Extending it — backend + frontend together
Every new feature = **one endpoint + one fetch**. e.g. show seller's live earnings:
```ts
app.get('/earnings', async (_req, res) => {
  const bal = await new Connection(RPC).getBalance(new PublicKey(SELLER_WALLET))
  res.json({ sol: bal / LAMPORTS_PER_SOL })
})
```
```html
<div id="earnings"></div>
<script>const e = await fetch('/earnings').then(r=>r.json()); earnings.textContent = `${e.sol} SOL`</script>
```
> **The rule: the frontend NEVER touches Solana or CoralOS directly** — it only calls the
> bridge. Extend by adding a bridge endpoint (which talks to coral/Solana) + a bit of UI.
> The bridge mounts `web/` as a volume → UI edits show on refresh, no rebuild.

### Going React (for a polished product)
Backend doesn't change — **the bridge is your API; React just calls the same endpoints**
(`/order`, `/order/:ref/paid`, `/autonomous/start`, `/autonomous/feed`).
- Stack: `npm create vite@latest web -- --template react-ts` + `@solana/web3.js` +
  `@solana/wallet-adapter-react` + `…-react-ui` + `…-wallets`.
- Dev: proxy `:3010` in `vite.config.ts` so `fetch('/order')` works (no CORS).
- Feed: a `useEffect` polling hook hitting `/autonomous/feed` every 2.5s.
- Checkout: wallet-adapter's `useWallet().sendTransaction` — same three calls; push the
  `reference` pubkey into `ix.keys` to bind the transfer to the order.
- Ship: `vite build → dist/`, point `express.static` at it (same-origin, no proxy in prod).
> **Principle:** React changes *how it looks*, not *how it works*.

## The marketplace example (the competitive market dashboard)
- `examples/marketplace/start.ts` — names the agent graph (1 buyer + N persona sellers).
- `examples/marketplace/web/` — the forkable, **Playwright e2e-tested** visualizer.
  - `RoundCard.tsx` — edit for new fields; add a leaderboard / analytics.
  - The feed's `foldRounds` turns the transcript into typed rounds you render.
- The feed server: `collectMessages → foldRounds` folds coral's extended-state transcript
  into typed rounds with on-chain links.
