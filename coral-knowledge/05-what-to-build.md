# 05 — What To Build & Provider Catalog

The rails (CoralOS coordination, escrow settlement, LLM reasoning) are done. What you change
sits *on top*, from a one-line edit to a new Rust instruction. **Seven surfaces, easiest → deepest.**

## The 7 expansion surfaces

### 1. `deliverService()` — what's sold *(the main fork)*
`coral-agents/seller-agent/src/service.ts` is the body of a paid endpoint: take a request,
**return a string** → monetized automatically. You touch no payment/coordination/escrow code.
```ts
case 'risk-score': return JSON.stringify({ wallet, risk: await scoreWallet(wallet) })
```
Ideas: a Helius wallet risk score, a CoinGecko price, a Jupiter quote, an LLM completion.

### 2. The persona — how a seller competes *(config, no code)*
A seller's strategy is config. Its `coral-agent.toml` sets three knobs; `decideBid`
(`bidder.ts`) turns them into LLM-driven bids, clamped to the floor in code:
```toml
PERSONA   = "an aggressive discounter who bids low to win volume"
FLOOR_SOL = 0.0002                # cost basis — LLM may never bid below this
SERVICES  = "jupiter,coingecko"   # inventory — bids only on these, sits out the rest
```
Change those three → a new competitor (discounter / premium specialist / surge-pricer),
sharing one Docker image.

### 3. The buyer — what it wants and how it judges
`coral-agents/buyer-agent/`. `BUYER_SERVICE`/`BUYER_ARG` = what it shops for;
`BUYER_MAX_SOL` = budget (enforced in code); `pickWinner`'s prompt decides *best value*:
```ts
const system = 'You are a buyer choosing the best-value bid. Reply JSON {"by","reason"}.'
```
Reshape into a threshold buyer, a quality-first buyer, or a **buy-enrich-resell** agent.

### 4. New agents — the graph
Registry auto-discovers any folder in `coral-agents/`. Build one with `startCoralAgent` +
runtime primitives + the escrow client, add it to the session graph in `marketplace/start.ts`
→ joins **next round**, no buyer changes. e.g. an **arbiter**, a **reseller**, an **oracle**.

### 5. The contract — the only Rust
`escrow/programs/escrow/src/lib.rs` = 3 instructions (`initialize`/`release`/`refund`). Extend:
- **disputes** → an `arbitrate` instruction + a bound arbiter (trustless three-party),
- **reputation** → a PDA per agent buyers check before escrowing,
- **staking/slashing** → sellers stake; bad delivery is slashed.
> The `solana-dev` skill scaffolds the Anchor change + LiteSVM tests.

### 6. The dashboard — the lens
`examples/marketplace/web/` is forkable + e2e-tested (Playwright vs the real feed). Edit
`RoundCard.tsx` for new fields; add a leaderboard / analytics — `foldRounds` already turns
the transcript into typed rounds.

### 7. The LLM — the brain *(swappable, one env var)*
Every agent reasons through one shim, `packages/agent-runtime/src/llm.ts`. Flip the whole
market between providers:
```sh
LLM_PROVIDER=openai   OPENAI_API_KEY=sk-...   # the sponsor's Codex key, zero code change
```
The runtime is **provider-modular**: runs on **Anthropic** *or* a **Codex/OpenAI** key with one
env var. The model *proposes* (bid, pick, refuse); code *disposes* (floor, budget, inventory)
— so the brain is swappable and a prompt injection can't break the economics.

> **Pick your depth.** Tiers 1–3 (service, persona, buyer) = config or a function, minutes to
> hours. Tiers 4–5 (a new agent, the contract) = where the prize-winning builds live. The
> single most on-thesis next step is **#4 + #5 together**: an arbiter agent backed by an
> `arbitrate` instruction.

---

## API Providers (data sources behind `deliverService`)

| Provider | Network | Env key | Status | What → what you can build |
|----------|---------|---------|--------|---------------------------|
| **CoinGecko** | off-chain | — | ✅ `coingecko` | Token price USD → price ticker, portfolio valuation |
| **Jupiter** | Mainnet | `JUPITER_API_KEY` (opt) | ✅ `jupiter` | Best swap route + Price API + token list → SOL→token quote, best-execution bot (**kit's default — copy this**) |
| **NewsAPI** | off-chain | `NEWS_API_KEY` | ✅ `news` | Top crypto headlines → market news digest |
| **Anthropic Claude** | off-chain | `ANTHROPIC_API_KEY` | ✅ `inference`/`claude` | A Claude completion (also the agents' bidding brain) → resell inference, AI analysis-as-a-service |
| **TxLine / TxODDS** | API (verifiable) | `TXLINE_API_KEY` | ✅ `txline` | Odds/scores/fixtures with Merkle roots on-chain → live odds feed, **match-resolution oracle** (free World Cup tier) |
| **Public RPC** | Devnet | — | ◻ build-for | Baseline JSON-RPC (balances, holdings, tx, accounts) → wallet portfolio, tx explainer. **Start here — no key** |
| **Helius** | Devnet | `HELIUS_API_KEY` | ◻ build-for | Enhanced RPC + DAS (tokens/NFTs, compressed) + parsed txns + webhooks → "explain this transaction", NFT portfolio |
| **Pyth Network** | Devnet | — | ◻ build-for | Pull-oracle price feeds with proof (Hermes) → verifiable price, an oracle for a market |

## Solana Infrastructure Providers

- **Helius** — enhanced Solana RPC. Faster/more reliable than public devnet, with real-time
  WebSocket account monitoring (`onAccountChange`). Optional: the payment loop runs on public
  RPC, but a free Helius key helps under load and powers the runtime's `HeliusMonitorStrategy`
  for "watch this account" services. Free tier: helius.dev.
- **Jupiter** — Solana's swap aggregator + price API. The seller's default service calls
  Jupiter's quote endpoint for a live SOL→USDC price. Read-only (a quote, not a trade), free
  without a key (key just raises rate limits). Can power: a price-quote agent, a best-route
  agent, an arbitrage agent (Jupiter vs CoinGecko), or a slippage/impact monitor.
