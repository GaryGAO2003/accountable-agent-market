# 06 — Hackathon Submission & Pitch Deck

> **Submit an agent that earns.** Build a clean standalone app or a fork of the kit's market
> dashboard. **Two rails are non-negotiable: it coordinates over CoralOS, and it settles real
> payments through Solana Pay on devnet.** Everything above that is yours.

## Required
- **A working app** — runs from the repo and settles **at least one real devnet transaction**.
  *If it doesn't move SOL on-chain, it isn't a submission.*
- **CoralOS integration** — agents coordinate over CoralOS (MCP). The request → deliver
  handshake happens in a **session thread**, not a private side-channel.
- **Solana Pay settlement** — payments requested + verified via Solana Pay: **recipient +
  amount + a unique reference**, settled on devnet.
- **On-chain proof** — Solana Explorer links (`?cluster=devnet`) to your settled payments.
- **Open-source repo** — public, with a README saying exactly how to run it (`just dev` or manual).
- **Pitch deck (3–6 slides):**
  - The problem / who's the customer — an agent or a human?
  - What your agent sells (the `deliverService`)
  - Why someone pays for it
  - The economy — one seller, a broker, a full marketplace?
  - The demo / on-chain proof
- **Demo video (≤ 3 min)** — show it settle **live**: a payment landing on-chain + data delivered.

## Bonus (strengthens an entry)
- A **live deployment** (or one-command run) a judge can try.
- **Multi-agent depth** — a broker, pipeline, or competitive marketplace: money flowing
  through a graph of agents.
- **Solana-native services** (on-chain devnet data) or a **smart contract** — the kit's
  **escrow** (deposit → deliver → release/refund) or an on-chain registry/reputation layer.
- **Agentic reasoning shown** — an LLM that *decides and justifies* (bids, picks, refuses),
  not a scripted call.
- A clear write-up of **what you built vs. what the kit handled**.

## Format
Submit: **repo link · deck (PDF/Figma) · demo video · Explorer links to your txs · team names.**
Email: **xforce94@gmail.com**

## How it's judged
1. Does it actually settle on-chain?
2. Is the service differentiated?
3. Is there agentic depth — an agent that decides *and* acts?
4. Can you demo it?
5. Bonus for Solana-native data, multi-agent graphs, or a smart contract.

> **The filter:** a working agent that does something useful and **gets paid for it on-chain** —
> coordinated over CoralOS, settled through Solana Pay, **shown live.**

## Pitch deck guidance
Goal: prove an **agent does something useful and gets paid on-chain.** Every slide serves that.

**Resources:**
- Narrative template — the story spine
  (docs.google.com/document/d/1MfQ8UeXEv3kGfd8rhdh7RklELBjZquQUHedqGqnv66o)
- Design template — drop content in
  (docs.google.com/presentation/d/1V9yq8B1nLpF8vPTL2buT_nlmsMwNJ_fRuyADs_k49Sg)
- solana.new — scaffold fast

**The slides:**
1. **The customer** — agent or human? Why now?
2. **What it sells** — your `deliverService`, in one line.
3. **Why they pay** — the value, and the price.
4. **The economy** — one seller? broker? marketplace? a graph of agents.
5. **Proof** — the payment settling live, Explorer link, data delivered. *This slide wins.*

**Rules:**
- Lead with the settlement.
- Name the moment the agent *decides* to pay.
- Don't pitch the plumbing — CoralOS and Solana Pay are rails, not the story.
- Make it tryable: one command, a judge can run it.

## Logistics pages (not captured in depth)
- Workshop 29/06/26 — Introduction to Agents, Solana and CoralOS
- Workshop 30/06/26 — Integrating Agents with TxOdds World Cup
- Ship With Tino — live help
