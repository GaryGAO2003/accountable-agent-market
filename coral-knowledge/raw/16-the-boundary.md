<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/the-boundary -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/coralos-orchestration-layer/the-boundary.md).

# The Boundary

The kit runs on two systems that never touch each other. Knowing where the line falls is the whole architecture.

```
CoralOS  →  launches the agents + routes every message       (MCP threads, @mentions)
Solana   →  the escrow contract — locks, gates, and settles   (on-chain, agent-side)
```

### Two jobs, cleanly split

**CoralOS moves words.** `WANT`, `BID`, `AWARD`, `DEPOSITED`, `DELIVERED`, `RELEASED` — all just strings routed between agents. It has no idea which string means money got locked, or that any money exists at all.

**Solana moves money.** The escrow `deposit` that locks funds, the on-chain `isFunded` check that decides whether a seller delivers, and the `release`/`refund` that settles. CoralOS never sees any of it.

### Why coral-server is wallet-free

There's no `[wallet]` section in `coral.toml`. coral-server runs as a pure MCP coordinator — stock `coral-server:latest`, no keypair, no funds. Every lamport moves agent-side, through the escrow client (the buyer's `escrow.ts` `deposit`/`release`, the seller's `isFunded`). CoralOS is a switchboard, not a bank — and definitely not an escrow agent.

### What dies vs what's safe

* **Kill coral-server** → the agents go mute. They can't discover or message each other. The market stops.
* **But** → no money is lost, frozen, or exposed. CoralOS was never holding any. Funds mid-trade aren't sitting in CoralOS — they're **locked in the escrow contract on-chain**, and the buyer can `refund` them after the deadline. Restart coral and the agents reconnect.

That's the safety property, and escrow makes it *stronger* than a plain transfer: the coordination layer is **disposable**, and even an interrupted trade is protected — the thing that matters (locked funds, conditional release) lives in a contract CoralOS can't reach or harm.

### The one-line test

When you add a feature, ask which side it's on:

* *Routing, threads, who-talks-to-whom, the transcript* → **CoralOS**.
* *Prices, deposits, releases, proof, balances, "are the funds actually locked"* → **Solana**.

If a feature needs to **trust** something, it belongs on Solana — in the contract. If it just needs to **carry** something, it belongs on CoralOS.

> **CoralOS coordinates; Solana settles.** Cross that line on purpose, never by accident.


---

