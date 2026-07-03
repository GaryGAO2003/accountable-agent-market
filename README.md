# Accountable Agent Market

**A live marketplace where AI agents buy and sell from each other — priced by LLMs, settled on
Solana, no human in the loop.** Built on Solana × CoralOS for the UK AI Agent Hackathon EP5
(DoraHacks #2272, Coral / CoralOS & STUK track).

[中文版 README](README.zh.md) · [Demo guide & runbook](DEMO.md) · [Roadmap](PLAN.md) ·
[Proposal](PROPOSAL.md) · [Critical review](CRITIQUE.md)

## What it does (verified live on devnet, 2026-07-03)

One **buyer agent** broadcasts a need over a shared CoralOS thread. Three **LLM seller personas**
— `seller-cheap` (low-price volume), `seller-honest` (fair price), `seller-premium`
(high-confidence premium) — each decide with an LLM whether and how much to bid, bounded by their
cost floors. The buyer awards with a stated reason, locks payment in a **Solana escrow**, the
winner delivers **real TxODDS World Cup data**, the buyer **re-executes the objective TxLINE read**,
and the escrow releases only after verification passes. Every settlement hop is a real devnet
transaction; a React dashboard folds the transcript into a live auction timeline.

```
WANT → 3 LLM bids → AWARD + reason → escrow deposit → DELIVERED → VERIFIED → RELEASED
```

Proof (click through to Solana Explorer, devnet):

- Round 1 — won by **seller-honest** at 0.0005 SOL over cheap's 0.0003 (the LLM buyer weighs notes,
  not just price):
  [release tx](https://explorer.solana.com/tx/2nhjgoR8W3gJjm8Uxas1WtQbf722xsTdYcRBwxo5zh6gRYNqq1RoTZp2fA6CqwsvLy3LCXJVnu31ekh6n1T1mHrC?cluster=devnet)
- Round 2 — won by **seller-cheap**:
  [release tx](https://explorer.solana.com/tx/261BtQLUQv6WtPkQ9iokAXdycMLgXVVjv2VH1eE6yGXwd4Eojiy3cDqATpA4ri4WAFxYLHeApVviJz7BnGyvhEFr?cluster=devnet)
- Round 3 — won by **seller-honest**:
  [release tx](https://explorer.solana.com/tx/2P5brUpoVGicuWuzwbpF8MgEUiZcjYSAQwBGEaE3ZXxAmXBiKTZH7NaBpxBktKVuW3dWiWkUPPAv14uUxZ7bx7hd?cluster=devnet)

## Why "accountable"

One day of running this market for real broke settlement **five different ways** — every failure
diagnosed and fixed in this repo's history (details in [DEMO.md](DEMO.md)):

1. The launcher referenced seller personas that didn't exist — sessions failed upstream.
2. The buyer crashed silently: the default arbiter settlement needs a key the launcher never forwarded.
3. The deployed devnet **arbiter program's global config is first-come-first-served** — every fork
   of the kit fails `NotArbiter` forever; funds locked behind a stranger's key.
4. A brand-new seller wallet can't receive payouts below Solana's rent floor — every round stalled.
5. Escrow payment references had no session component — re-runs collided with old escrow PDAs.

That is the thesis: **agent markets fail in ways humans won't be watching for.** Settlement needs
verification, self-owned arbitration, slashing, and reputation by construction — the
[roadmap](PLAN.md) (verify-then-pay pipeline per [PROPOSAL.md](PROPOSAL.md)).

## Quick start

Prereqs: Docker Desktop, Node ≥ 20, Git Bash on Windows. **Devnet only** — the runtime throws on a
mainnet RPC.

```sh
git clone https://github.com/GaryGAO2003/accountable-agent-market
cd accountable-agent-market/solana_coralOS-main

npm install --prefix scripts && node scripts/setup.js   # wallets → .env; fund the buyer (faucet.solana.com)
# .env: add an LLM key — DeepSeek/Venice/OpenAI/Anthropic all work, e.g.
#   LLM_PROVIDER=deepseek  DEEPSEEK_API_KEY=...  LLM_MODEL=deepseek-v4-flash
#   SETTLEMENT_MODE=direct          (see finding #3 above)
# send the seller WALLET ~0.01 devnet SOL once  (see finding #4 above)

(cd examples/txodds && npm install && npm run mint)     # TxLINE token — the product being sold
bash build-agents.sh && docker compose up -d coral      # agent images + coral-server
cd examples/marketplace && npm install && npm start     # prints the session id

# dashboard:  feed (:4000) + web (:5173) → http://localhost:5173/?session=<id>
```

Full runbook with per-step explanations: [DEMO.md](DEMO.md).

## What we changed on top of the upstream kit

Upstream: [trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS) @ `a8fd71a`,
vendored pristine in [`solana_coralOS-main/`](solana_coralOS-main/) — every change is its own
reviewable commit on top:

- Three seller persona manifests + launch roster fix (the stock marketplace could not start).
- `ARBITER_RELEASED` folds as settled in the dashboard feed (default-mode settlements never showed).
- `ARBITER_KEYPAIR_B58` forwarded to the buyer; settlement mode configurable (`SETTLEMENT_MODE`).
- **DeepSeek** as a fourth LLM provider, with a token floor for reasoning models.
- Seller rent-floor preflight warning; per-run salt in escrow reference bindings.
- TxLINE objective re-exec verification before release (`VERIFIED` / `VERIFICATION_FAILED` in the transcript).
- Scripted failed-verification demo mode (`DEMO_FAIL_VERIFICATION=1`) so judges can see release blocked.
- Opt-in `arbiter-agent` flow (`ARBITER_AGENT_ENABLED=1`) so a neutral agent emits
  `ARBITER_VERIFIED` / `ARBITER_REJECTED` and signs release/refund.
- Tests green in the touched packages: agent-runtime 43/43 · buyer 17/17 · seller 17/17 · arbiter 2/2 · feed 13/13 · web 6/6.

## Roadmap (mapped to versions in [PLAN.md](PLAN.md))

`jupiter_quote` second service → risk-adjusted buyer selection → broader verification adapters →
watcher/challenger → arbiter agent → **own on-chain arbitration + slashing** (finding #3 makes the
case) → reputation → full dashboard timeline.

## Repo map

| Path | What it is |
|---|---|
| `solana_coralOS-main/` | The vendored kit + our changes (agents, runtime, escrow programs, marketplace, dashboard) |
| `DEMO.md` | Demo storyboard, runbook, live artifacts, findings in detail |
| `PLAN.md` | Version-by-version roadmap |
| `PROPOSAL.md` / `PROPOSAL.zh.md` | The proposal |
| `CRITIQUE.md` | Adversarial review of the proposal (decision log) |
| `progress.md` | Working notes |
