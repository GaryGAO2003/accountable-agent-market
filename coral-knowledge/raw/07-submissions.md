<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/submissions -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/submissions.md).

# Submissions

## Submit an agent that earns

Build whatever you want — a clean standalone app or a fork of the kit's market dashboard. **Two rails are non-negotiable: it coordinates over CoralOS, and it settles real payments through Solana Pay on devnet.** Everything above that — the service, the agents, the UI — is yours.

### Required

* **A working app** — runs from the repo and settles **at least one real devnet transaction**. If it doesn't move SOL on-chain, it isn't a submission.
* **CoralOS integration** — your agents coordinate over CoralOS (MCP). The request → deliver handshake happens in a **session thread**, not a private side-channel.
* **Solana Pay settlement** — payments are requested and verified through Solana Pay: **recipient + amount + a unique reference**, settled on devnet. (The reference is what binds a payment to one order — and what the escrow upgrade builds on.)
* **On-chain proof** — Solana Explorer links (`?cluster=devnet`) to your settled payments. This is the bar; the kit makes it the easy part.
* **Open-source repo** — public, built on or alongside the kit, with a README that says exactly how to run it (`just dev`, or the manual steps).
* **Pitch deck (3–6 slides):**
  * The problem / who's the customer — an agent or a human?
  * What your agent sells (the `deliverService`)
  * Why someone pays for it
  * The economy — one seller, a broker, a full marketplace?
  * The demo / on-chain proof
* **Demo video (≤ 3 min)** — show it settle **live**: a payment landing on-chain and the data delivered.

### Bonus (strengthens an entry)

* A **live deployment** (or one-command run) a judge can try.
* **Multi-agent depth** — a broker, pipeline, or competitive marketplace: money flowing through a graph of agents.
* **Solana-native services** (on-chain devnet data) or a **smart contract** — the kit's **escrow** (trustless deposit → deliver → release/refund) or an on-chain registry/reputation layer.
* **Agentic reasoning shown** — an LLM that *decides and justifies* (bids, picks, refuses), not a scripted call.
* A clear write-up of **what you built vs. what the kit handled**.

### Format

Submit: **repo link · deck (PDF/Figma) · demo video · Explorer links to your txs · team names.** Email: [**xforce94@gmail.com**](mailto:xforce94@gmail.com)

### How it's judged

1. Does it actually settle on-chain?
2. Is the service differentiated?
3. Is there agentic depth — an agent that decides *and* acts?
4. Can you demo it?
5. Bonus for Solana-native data, multi-agent graphs, or a smart contract.

**The filter, restated:** a working agent that does something useful and **gets paid for it on-chain** — coordinated over CoralOS, settled through Solana Pay, **shown live.** Everything else is supporting evidence.

<br>


---

