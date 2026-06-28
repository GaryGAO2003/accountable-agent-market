<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/talking-to-coralos-the-agents-view -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/talking-to-coralos-the-agents-view.md).

# Talking to CoralOS: the agent's view

From inside an agent, CoralOS is invisible. You never open a socket, never hold a URL, never parse MCP. You get one object — `ctx` — with the verbs on it, and you write a loop.

### The whole setup is one call

```ts
import { startCoralAgent } from '@pay/agent-runtime'

await startCoralAgent({ agentName: 'seller-cheap' }, async (ctx) => {
  // ctx.waitForMention / reply / send / createThread — that's your whole world
})
```

`startCoralAgent` reads the injected `CORAL_CONNECTION_URL`, connects, discovers the verbs, and hands you `ctx`. Everything below the handoff — transport, tool discovery, reconnection — is done for you.

### An agent is just a loop over the verbs

The seller, talking only through CoralOS — it waits, decides, and speaks back:

```ts
await startCoralAgent({ agentName: NAME }, async (ctx) => {
  while (true) {
    const m = await ctx.waitForMention()         // wait until someone @s me
    if (!m) continue                             // null = timeout, keep waiting

    const want = parseWant(m.text)
    if (want) {
      const d = await decideBid(want, cfg)       // ← my LLM brain (code-enforced floor/budget)
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

The buyer is the same shape in reverse — it *starts* the conversation instead of waiting:

```ts
const thread = await ctx.createThread('market', SELLERS)              // open the market thread
await ctx.send(formatWant({ round, service, arg, budgetSol }), thread, SELLERS)   // broadcast a need
// …collect BIDs over a window, pick best value…
await ctx.send(formatAward(round, winner.by), thread, [winner.by])   // award the winner
// …deposit into escrow on-chain…
await ctx.send(formatDeposited({ round, reference, buyer, sig }), thread, [winner.by])
```

Notice: the only non-CoralOS lines are `decideBid` (the LLM brain) and `isFunded`/`deposit` (Solana escrow). Everything else is just waiting and speaking.

### The verbs, from the agent's seat

* **`ctx.waitForMention()`** — block until someone @s you. Returns `null` on timeout — loop and call again.
* **`ctx.reply(mention, text)`** — answer in the same thread, @mentioning whoever asked. (Sugar over `send`.)
* **`ctx.send(text, threadId, [mentions])`** — post into a specific thread. Used when *you* started it.
* **`ctx.createThread(name, [participants])`** — open a new conversation, get back a `threadId`.

Two extras for multi-agent code: **`waitForMentionInThread(threadId)`** (only hear *this* thread — for juggling several at once, like a broker quoting five sellers in parallel) and **`waitForAgent(name)`** (wait for a specific agent to come online before sending it work).

> **The mental shift:** you don't "call an API." You wait to be spoken to, and you speak back. An agent is a `while` loop over the verbs — CoralOS is the room, not a library you think about. The *protocol* (the words you send: `WANT`/`BID`/`AWARD`/`DEPOSITED`/`DELIVERED`) is yours to design; CoralOS just carries them.


---

