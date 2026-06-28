<!-- SOURCE: https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/what-to-build-and-why/what-you-expand -->

> For the complete documentation index, see [llms.txt](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/llms.txt). Markdown versions of documentation pages are available by appending `.md` to page URLs; this page is available as [Markdown](https://xforce-decentralised-protocols.gitbook.io/solanaxcoralos/the-build/what-to-build-and-why/what-you-expand.md).

# What You Expand

The rails — CoralOS coordination, escrow settlement, LLM reasoning — are done. What you change sits *on top* of them, from a one-line edit to a new Rust instruction. Here are the seven surfaces, easiest to deepest.

### 1. `deliverService()` — what's sold

The main fork. [`coral-agents/seller-agent/src/service.ts`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/coral-agents/seller-agent/src/service.ts) is the body of a paid endpoint: take a request, **return a string**, and it's monetized automatically. Anything you'd hide behind "pay to access this" goes here.

```ts
case 'risk-score': return JSON.stringify({ wallet, risk: await scoreWallet(wallet) })
```

A Helius wallet risk score, a CoinGecko price, a Jupiter quote, an LLM completion — whatever a buyer would pay for. You touch no payment, coordination, or escrow code.

### 2. The persona — how a seller competes

A seller's *strategy* is config, not code. Its [`coral-agent.toml`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/coral-agents/seller-cheap/coral-agent.toml) sets three knobs, and `decideBid` ([`bidder.ts`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/coral-agents/seller-agent/src/bidder.ts)) turns them into LLM-driven bids — clamped to the floor in code:

```toml
PERSONA   = "an aggressive discounter who bids low to win volume"
FLOOR_SOL = 0.0002      # cost basis — the LLM may never bid below this
SERVICES  = "jupiter,coingecko"   # inventory — it bids only on these, sits out the rest
```

Change those three values and you've created a new competitor — a discounter, a premium specialist, a surge-pricer — sharing one Docker image, no code.

### 3. The buyer — what it wants and how it judges

[`coral-agents/buyer-agent/`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/coral-agents/buyer-agent/src/index.ts) decides the demand side. `BUYER_SERVICE`/`BUYER_ARG` set what it shops for; `BUYER_MAX_SOL` is the budget (enforced in code); and `pickWinner`'s prompt decides *best value*, not just cheapest:

```ts
const system = 'You are a buyer choosing the best-value bid. Reply JSON {"by","reason"}.'
```

Reshape it into a threshold buyer, a quality-first buyer, or a **buy-enrich-resell** agent that buys raw data and sells an LLM-enriched version back into the market.

### 4. New agents — the graph

The registry auto-discovers any folder in `coral-agents/`. Build one with `startCoralAgent` + the runtime primitives + the escrow client, add it to the session graph in [`marketplace/start.ts`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/examples/marketplace/start.ts), and it joins **next round** — no buyer changes. This is how a pair becomes a market:

* an **arbiter** that settles disputed deliveries, a **reseller** that arbitrages, an **oracle** paid to verify another agent's work.

### 5. The contract — the only Rust

[`escrow/programs/escrow/src/lib.rs`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/examples/agent-economy/escrow/programs/escrow/src/lib.rs) is three instructions: `initialize` (deposit), `release`, `refund`. Extend it for the headline builds:

* **disputes** → an `arbitrate` instruction + a bound arbiter (trustless three-party settlement),
* **reputation** → a PDA per agent buyers check before escrowing,
* **staking/slashing** → sellers stake; bad delivery is slashed.

The `solana-dev` skill scaffolds the Anchor change + LiteSVM tests.

### 6. The dashboard — the lens

The visualizer ([`examples/marketplace/web/`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/examples/marketplace/web)) is forkable and **e2e-tested** (Playwright against the real feed). Edit [`RoundCard.tsx`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/examples/marketplace/web/src/components/RoundCard.tsx) for new fields, add a **leaderboard** or **analytics** — the feed's `foldRounds` already turns the transcript into typed rounds you render.

### 7. The LLM — the brain

Every agent reasons through one shim, [`llm.ts`](vscode-webview://06rovh67rnqe52v3609t6jk545cn22ogdv5sn0fo4du6atp3jhcc/packages/agent-runtime/src/llm.ts). Flip the whole market between providers with one env var:

```sh
LLM_PROVIDER=openai   OPENAI_API_KEY=sk-...   # the sponsor's Codex key, zero code change
```

The model *proposes* (bid, pick, refuse); code *disposes* (floor, budget, inventory) — so the brain is swappable and a prompt injection can't break the economics.

***

**Pick your depth.** Tiers 1–3 (service, persona, buyer) are config or a function — minutes to hours. Tiers 4–5 (a new agent, the contract) are where the differentiated, prize-winning builds live. The single most on-thesis next step is **#4 + #5 together**: an arbiter agent backed by an `arbitrate` instruction — the moment the economy needs *no one* to be trusted.


---

