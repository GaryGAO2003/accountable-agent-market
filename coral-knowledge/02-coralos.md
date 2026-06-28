# 02 — CoralOS: The Orchestration Layer (DEEP DIVE)

> CoralOS coordinates the agents. **This is the core of "learning Coral."**

## What CoralOS IS (and ISN'T)

CoralOS is **two familiar things fused into one**:

1. **A bot launcher** — like a tiny Kubernetes. It keeps a **registry** of your agents and,
   when a session starts, boots each one as a **Docker container** and hands it a callback
   URL ("a phone number to call back on").
2. **A group-chat server** — like **Slack for bots**. Agents are members; they talk in
   **threads** by `@mentioning` each other. CoralOS routes every message and keeps the
   whole transcript.

> **The whole job: CoralOS boots the agents and runs the chat room they talk in.**

### What it does NOT do
- It **never touches money**. No `[wallet]` section in `coral.toml`. Runs **stock** `coral-server:latest`,
  **no keypair, no funds** — "wallet-free."
- Settlement happens on Solana, **agent-side**, via the escrow contract. Funds mid-trade sit
  **in the contract**, never in CoralOS.
- **Kill coral-server** → agents go mute (can't discover/message), the market stops — but
  **no funds are lost, frozen, or exposed**. The coordination layer is **disposable**.

> **The boundary, in one line: CoralOS moves _messages_. Solana moves _money_.**

## The transport layer details

- CoralOS speaks **MCP over StreamableHTTP**.
- On connect, an agent calls `listTools()` and discovers **four verbs** (all just chat actions):

| Verb | Meaning |
|------|---------|
| `coral_create_thread` | start a group chat with these members |
| `coral_send_message` | post a message, `@mention` someone |
| `coral_wait_for_mention` | wait until someone `@`s me |
| `coral_wait_for_agent` | wait until *this* member shows up |

**Every agent in the kit is built from these four verbs and nothing more.**

The verbs move *words*. They know nothing about money. Whether a message is *honored* is
decided by Solana (the escrow contract), not CoralOS. Example:

```ts
const m = await ctx.waitForMention()                     // CoralOS: words come in
if (parseDeposited(m.text)) {
  const funded = await isFunded(program, buyer, seller, reference)  // Solana: on-chain check
  await ctx.reply(m, funded                              // CoralOS: words go out
    ? `DELIVERED ${await deliverService(req)}`
    : 'ERROR: escrow not funded')
}
```

> A buyer can `send("DEPOSITED … sig=0xfake")` all day — the message arrives fine. But
> `isFunded` reads the **chain**. Fake deposit → real `ERROR`.
> **CoralOS is the transport. Solana is the gate.**

## The lifecycle: from registry to running session

### 1. The registry (`config/coral.toml`)
```toml
[registry]
localAgents = ["/agents/*"]       # discover buyer-agent, seller-agent, seller-cheap/-premium/-lazy…
localAgentRescanTimer = "5s"      # re-scan every 5s — drop one in, it appears
[docker]
address = "host.docker.internal"  # launch each as a Docker container
```
Drop a new folder in `coral-agents/` with a `coral-agent.toml` → CoralOS auto-discovers it.
**No restart.** (Seller personas are config-only manifests reusing the seller image.)

### 2. Name the agent graph (`marketplace/start.ts`)
```ts
const agent = (name, options) => ({
  id: { name, version: '0.1.0', registrySourceId: { type: 'local' } },
  name, provider: { type: 'local', runtime: 'docker' }, options,
})
const seller = (name) => agent(name, { SELLER_WALLET, SOLANA_RPC_URL, AGENT_NAME: name, ...llmOpts })

await fetch(`${BASE}/api/v1/local/session`, {
  method: 'POST', headers: AUTH,
  body: JSON.stringify({
    agentGraphRequest: { agents: [
      agent('buyer-agent', buyerOpts),
      seller('seller-cheap'), seller('seller-premium'), seller('seller-lazy'),
    ] },
    namespaceProvider: { type: 'create_if_not_exists', namespaceRequest: { name: NS } },
    execution: { mode: 'immediate' },
  }),
})
```
You name the graph (one buyer, three competing sellers); CoralOS does the rest. **Add a 4th
seller to the array → it competes next round, no other changes.**

### 3. CoralOS boots containers + injects the callback URL
For each agent, CoralOS boots its Docker container and injects `CORAL_CONNECTION_URL`. The
agent doesn't know where CoralOS lives until this moment.

```ts
// inside every agent — startCoralAgent, from @pay/agent-runtime
const url = process.env.CORAL_CONNECTION_URL   // injected at boot
await agent.connect()                          // opens MCP, discovers the verbs
await run(ctx)                                 // your loop takes over
```

### Lifecycle one-liner
```
coral.toml          POST /session              spawn containers        connect back
 (registry)   ──▶   (name the graph)    ──▶    (+ inject URL)    ──▶   (verbs live) ──▶ bidding
```
> **You declare _which_ agents; CoralOS handles launching + wiring.** The difference between
> "a pair" and "a market" is just how many you list in the graph.

## Talking to CoralOS: the agent's view

From inside an agent, **CoralOS is invisible**. No socket, no URL, no MCP parsing. You get
one object — `ctx` — with the verbs, and you write a loop.

```ts
import { startCoralAgent } from '@pay/agent-runtime'
await startCoralAgent({ agentName: 'seller-cheap' }, async (ctx) => {
  // ctx.waitForMention / reply / send / createThread — that's your whole world
})
```

### The `ctx` API
| Method | What it does |
|--------|-------------|
| `ctx.waitForMention()` | block until someone `@`s you. Returns `null` on timeout — loop and call again |
| `ctx.reply(mention, text)` | answer in the same thread, `@mention`ing whoever asked (sugar over `send`) |
| `ctx.send(text, threadId, [mentions])` | post into a specific thread (when *you* started it) |
| `ctx.createThread(name, [participants])` | open a new conversation, get back a `threadId` |
| `ctx.waitForMentionInThread(threadId)` | only hear *this* thread — for juggling many at once (e.g. a broker quoting 5 sellers in parallel) |
| `ctx.waitForAgent(name)` | wait for a specific agent to come online before sending it work |

### The seller loop (full shape)
```ts
await startCoralAgent({ agentName: NAME }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()         // wait until someone @s me
    if (!m) continue                             // null = timeout, keep waiting
    const want = parseWant(m.text)
    if (want) {
      const d = await decideBid(want, cfg)       // ← LLM brain (code-enforced floor/budget)
      if (d.bid) await ctx.reply(m, formatBid({ round: want.round, priceSol: d.priceSol, by: NAME }))
      continue
    }
    if (parseAward(m.text)?.to === NAME) {        // I won → quote escrow terms
      await ctx.reply(m, formatEscrowRequired({ round, reference, seller: WALLET, amountSol, deadlineSecs }))
      continue
    }
    const dep = parseDeposited(m.text)
    if (dep && await isFunded(program, buyer, WALLET, reference)) {   // ← Solana, not CoralOS
      await ctx.reply(m, `DELIVERED ${await deliverService(req)}`)
    }
  }
})
```

### The buyer loop (same shape, reversed — it *starts* the conversation)
```ts
const thread = await ctx.createThread('market', SELLERS)                          // open market thread
await ctx.send(formatWant({ round, service, arg, budgetSol }), thread, SELLERS)   // broadcast a need
// …collect BIDs over a window, pick best value…
await ctx.send(formatAward(round, winner.by), thread, [winner.by])               // award the winner
// …deposit into escrow on-chain…
await ctx.send(formatDeposited({ round, reference, buyer, sig }), thread, [winner.by])
```

> **Mental shift:** you don't "call an API." You wait to be spoken to, and you speak back.
> An agent is a `while` loop over the verbs. The *protocol* (the words: `WANT`/`BID`/`AWARD`/
> `DEPOSITED`/`DELIVERED`) is **yours to design**; CoralOS just carries them.
> The only non-CoralOS lines are `decideBid` (LLM) and `isFunded`/`deposit` (Solana escrow).

## The Boundary (the whole architecture in one rule)

```
CoralOS  →  launches the agents + routes every message       (MCP threads, @mentions)
Solana   →  the escrow contract — locks, gates, and settles   (on-chain, agent-side)
```

- **CoralOS moves words**: `WANT`, `BID`, `AWARD`, `DEPOSITED`, `DELIVERED`, `RELEASED` —
  all just strings. It has no idea which string means money got locked.
- **Solana moves money**: the escrow `deposit`, the `isFunded` check, the `release`/`refund`.

**When you add a feature, ask which side it's on:**
- Routing, threads, who-talks-to-whom, the transcript → **CoralOS**.
- Prices, deposits, releases, proof, balances, "are the funds actually locked" → **Solana**.

> If a feature needs to **trust** something → Solana (the contract).
> If it just needs to **carry** something → CoralOS.
> **Cross that line on purpose, never by accident.**

## Expanding CoralOS (Pro)

CoralOS gives you three things: **launch**, **route**, **shared transcript**. Every
multi-agent mechanism is just a pattern of threads + mentions on top:

- **More agents in the graph** — registry auto-discovers any folder in `coral-agents/`.
  Drop in an arbiter / oracle / reseller, add it to the session graph → it competes next
  round, **zero buyer changes**.
- **Richer thread topology** — one agent can juggle many threads. `waitForMentionInThread`
  scopes a wait to one thread → a broker can open a private quote thread with each of 5
  sellers **in parallel** and correlate replies.
- **New entry points** — anything that launches a session is a front door: the dashboard's
  "Start a market" button (`POST /api/start`), a Discord bot, a cron agent, a webhook.
- **New coordination patterns** — shipped market = a **sealed-bid auction**
  (WANT → bids → award → settle). Same choreography gives **open-cry** bidding (sellers
  undercut each other), **request-for-quote**, **pipelines** (raw → enriched → report),
  or **voting/consensus** among a panel.
- **The session as a record** — extended state is an auditable transcript. The feed server
  (`collectMessages → foldRounds`) folds it into typed rounds; build **reputation**, a
  **leaderboard**, or **analytics** on the same source.

> **Thesis:** CoralOS gives you launching, messaging, and a shared log. Everything else —
> markets, auctions, pipelines, courts — is choreography you write on top.
