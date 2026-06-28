<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/main-track-build-the-agent-economy -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/main-track-build-the-agent-economy.md).

# Main Track: Build the Agent Economy

**The theme is simple and wide open: agents that earn.**

LLM seller agents compete for a buyer's business in a shared market; the winner is paid **trustlessly** through a Solana escrow contract — funds released only on delivery, refunded if the seller no-shows. The customer is software: it reasons about price, bids at machine speed, and settles on-chain with no human in the loop. **Build the thing they buy — and how they compete for it.**

One track, eight layers, all yours to change — from the pixel a human watches to the lamports locked in escrow. The plumbing — coordination, LLM bidding, trustless settlement — is done and proven on devnet. You build on top.

* **Frontend** — a Vite + React dashboard that renders the live auction (bids, the winner's reasoning, on-chain settlement links). Forkable and e2e-tested. Reshape the round card; add a leaderboard.
* **The service** — `deliverService()` is the body of a paid endpoint. Return a string; it's sold automatically. *This is the main fork — what's traded.*
* **The seller persona** — how it competes: a cost floor, an inventory, an LLM bidding strategy. A discounter, a premium specialist, a surge-pricer — all config, no code.
* **The buyer** — an LLM picking *best value*, not just cheapest, inside a budget enforced in code. Change what it wants and how it judges.
* **Solana Pay + escrow** — a unique `reference` binds the deal; the contract pays on release and refunds after a deadline. Trustless by default; set the price, tier it, swap SOL for USDC.
* **New agents** — drop one in and a pair becomes a graph: an **arbiter** that settles disputes, a **reseller** that buys low and sells high, an **oracle** paid to verify another's work.
* **The runtime** — three primitives (the CoralOS client, Solana Pay, a provider-modular LLM shim) plus the market protocol. Import them, write behavior. Runs on Anthropic *or* a Codex key with one env var.
* **The contract** — the escrow program (the only Rust). It's the settlement spine, not an afterthought&#x20;


---

