# 07 — Glossary & Cheatsheet

## Glossary

| Term | Meaning |
|------|---------|
| **CoralOS** | The coordination layer. A bot launcher (tiny Kubernetes) + group-chat server (Slack for bots). Launches agents as Docker containers per session, routes their `@mention` messages in threads, keeps the transcript. **Wallet-free, holds no funds.** |
| **coral-server** | The CoralOS process. Runs stock `coral-server:latest` on `:5555`. A pure MCP coordinator. Disposable — killing it stops the market but loses no money. |
| **MCP** | Model Context Protocol. CoralOS speaks it over StreamableHTTP; agents `listTools()` to discover the 4 verbs. |
| **The bridge** | An Express server (`:3010`) that serves the demo UI and talks to coral. Long-lived. The frontend's only API. |
| **Agent** | A small TypeScript program = a `while` loop over CoralOS verbs, built on `@pay/agent-runtime`. Spawned on demand per session, not long-lived. |
| **`@pay/agent-runtime`** | The kit's shared library. Owns the agent loop, MCP connection, messaging, state. You build on it, don't edit it. |
| **`ctx`** | The object `startCoralAgent` hands your loop: `waitForMention`, `reply`, `send`, `createThread` (+ `waitForMentionInThread`, `waitForAgent`). |
| **Session / agent graph** | A named set of agents CoralOS launches together (e.g. `[buyer, seller-cheap, seller-premium, seller-lazy]`). |
| **`deliverService()`** | The body of the paid endpoint in `seller-agent/src/service.ts`. Return a string → monetized. **The main fork.** |
| **Persona** | A seller's strategy as config (`PERSONA`, `FLOOR_SOL`, `SERVICES`) in `coral-agent.toml`. No code. |
| **Solana Pay** | How payments are requested: a `solana:` URL with recipient + amount + a unique **reference**. |
| **reference** | A fresh, single-use throwaway pubkey unique to one order. Binds a payment to that order AND seeds the escrow PDA. |
| **Escrow / PDA** | The Solana program holding funds per order. `seeds = [b"escrow", buyer, reference]` → one box per `(buyer, order)`. |
| **`isFunded`** | Seller's on-chain check that the escrow is really funded before delivering. **The gate.** |
| **Arbiter** | The headline build: an LLM agent that adjudicates disputes and calls `arbitrate(pay_seller)` on-chain → trustless three-party. |
| **devnet** | Solana's free test network. Identical to mainnet, zero risk. SOL from faucet.solana.com (web only, GitHub sign-in). |

## The message protocol (yours to design — strings carried by CoralOS)

Shipped market = a **sealed-bid auction**:
```
buyer  → WANT       (round, service, arg, budgetSol)   broadcast to all sellers
seller → BID        (round, priceSol, by)              LLM-decided, clamped to FLOOR_SOL
buyer  → AWARD      (round, winner)                     to the winner only
seller → ESCROW_REQUIRED (reference, seller wallet, amountSol, deadline)
buyer  → DEPOSITED  (round, reference, buyer, sig)      after on-chain deposit()
seller → DELIVERED  <data>                              only after isFunded() ✓
buyer  → (release on delivery, or refund after deadline — both on-chain)
```
Other patterns you can build with the same threads+mentions: open-cry bidding, request-for-quote,
pipelines (raw → enriched → report), voting/consensus panels.

## Command cheatsheet

```sh
# Run the whole infra (one-shot)
just dev                          # = setup wallets + build agents + docker compose up coral bridge
# → fund both addresses in WALLETS.txt at https://faucet.solana.com (GitHub sign-in)
# → open http://localhost:3010, click "Run the agent↔agent demo"

# Manual equivalent
cd scripts && npm install && cd ..
node scripts/setup.js             # wallets → .env, prints 2 addresses (also WALLETS.txt)
bash build-agents.sh              # build seller / buyer / user-proxy images
docker compose up -d coral bridge

# Add a new agent
docker build -f coral-agents/<name>/Dockerfile -t <name>:0.1.0 .   # build from repo root
# add it to the session graph in marketplace/start.ts → auto-discovered via coral.toml

# Run the autonomous market directly (no UI click)
cd examples/agent-economy/autonomous && npm start

# Swap the LLM provider (no code change)
LLM_PROVIDER=openai OPENAI_API_KEY=sk-...     # or Anthropic via ANTHROPIC_API_KEY
```

## Key files map

| Path | What |
|------|------|
| `config/coral.toml` | CoralOS registry — scans `localAgents = ["/agents/*"]`, rescans every 5s |
| `coral-agents/<name>/coral-agent.toml` | per-agent manifest (name, options, docker image) |
| `coral-agents/seller-agent/src/service.ts` | `deliverService()` — **the main fork** |
| `coral-agents/seller-agent/src/bidder.ts` | `decideBid` — LLM bidding, clamped to floor |
| `coral-agents/seller-agent/src/escrow.ts` | `isFunded` (seller side) |
| `coral-agents/buyer-agent/src/{goal,llm_buyer}.ts` | buyer demand + `pickWinner` LLM |
| `coral-agents/buyer-agent/src/escrow.ts` | `deposit` / `release` / `refund` (buyer side) |
| `coral-agents/echo-agent/src/index.ts` | minimal agent template to copy |
| `packages/agent-runtime/` | `@pay/agent-runtime` — the shared library |
| `packages/agent-runtime/src/llm.ts` | provider-modular LLM shim |
| `escrow/programs/escrow/src/lib.rs` | the escrow program (the only Rust) |
| `examples/marketplace/start.ts` | names the competitive agent graph |
| `examples/marketplace/web/` (`RoundCard.tsx`) | the e2e-tested dashboard |
| `examples/agent-economy/bridge/web/index.html` | the default single-file vanilla UI |
| `examples/agent-economy/bridge/server.ts` | the Express bridge (`/order`, `/paid`, `/autonomous/*`) |
| `WALLETS.txt` / `.env` | generated wallet addresses / keys (`.env` gitignored) |

## The mental model in 5 lines (memorize this)
1. **CoralOS moves messages; Solana moves money. They never touch.**
2. An agent = a `while` loop over 4 verbs; the runtime hides MCP/transport.
3. You declare *which* agents; CoralOS launches + wires them. A pair → a market = list more.
4. Money is agent-side: `deposit → isFunded → deliver → release/refund`, reference-bound, on-chain.
5. The contract is the gate; if a feature needs **trust** put it on Solana, if it just **carries** put it on CoralOS.
