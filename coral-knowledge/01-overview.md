# 01 — Overview: The Agent Economy

## The thesis

**Agents are a new category of customer: software that holds value and pays for things.**
They transact at machine speed, in micro-amounts ($0.0001/call), with no human in the loop.

The kit (`sol_coralOS`) is a **working agent economy**:
- LLM **seller agents** compete for a buyer's business in a shared market.
- The **buyer is software** — it reasons about price, bids at machine speed, and settles on-chain.
- The winner is paid **trustlessly** through a Solana **escrow** contract — funds released
  only on delivery, refunded if the seller no-shows.

> Main-track theme: **"agents that earn."** Build the thing they sell — and how they compete for it.

## The three fixed rails (the "boring 80%" you never rebuild)

1. **CoralOS coordinates** — agents discover and message each other in a shared session.
   "Not a socket; a market."
2. **Solana escrow settles** — every trade is `deposit → deliver → release/refund`, on-chain,
   reference-bound. Strangers can transact.
3. **An LLM reasons** — sellers decide *whether and how much* to bid; the buyer judges
   *best value*. Guarded in code, so a prompt injection can't break the economics.

> **The shape of it:** the rails are done and trustless on devnet. Your build goes into the
> differentiated 20% — what your agent sells, how it competes, and the mechanism it invents.

## The 8 layers (all forkable, easiest → deepest)

| Layer | What it is | Fork point |
|-------|-----------|-----------|
| **Frontend** | Vite+React (or vanilla) dashboard rendering the live auction (bids, winner reasoning, on-chain links). Forkable + e2e-tested | round card, leaderboard, analytics |
| **The service** | `deliverService()` — body of a paid endpoint. Return a string → sold automatically. **The main fork** | `seller-agent/src/service.ts` |
| **The seller persona** | How it competes: cost floor, inventory, LLM bidding strategy. **All config, no code** | `coral-agent.toml` (PERSONA/FLOOR_SOL/SERVICES) |
| **The buyer** | An LLM picking *best value*, not just cheapest, inside a code-enforced budget | `buyer-agent/src/{goal.ts, llm_buyer.ts}` |
| **Solana Pay + escrow** | A unique `reference` binds the deal; contract pays on release, refunds after deadline | set price, tier it, SOL↔USDC |
| **New agents** | Drop one in → a pair becomes a graph: **arbiter**, **reseller**, **oracle** | folder in `coral-agents/` |
| **The runtime** | 3 primitives (CoralOS client, Solana Pay, provider-modular LLM shim) + market protocol | `@pay/agent-runtime` |
| **The contract** | The escrow program (the only Rust) — the settlement spine | `escrow/programs/escrow/src/lib.rs` |

## The headline build

An **LLM arbiter agent** — a fourth participant in the CoralOS session that reads a disputed
delivery, decides who's right, and calls `arbitrate(pay_seller)` on-chain. A reputation-staked
judge made of code. **The moment the economy needs *no one* to be trusted:**

- Agents coordinate (CoralOS) →
- funds are escrowed (the contract) →
- an agent reasons about the dispute (LLM) →
- the contract enforces the verdict (on-chain).

The most on-thesis next step = **a new agent (#6) + a contract change (#8) together**:
an arbiter agent backed by an `arbitrate` instruction.
