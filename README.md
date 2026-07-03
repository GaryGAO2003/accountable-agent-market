# Accountable Agent Market

**A live marketplace where AI agents buy and sell from each other — priced by LLMs, settled on
Solana, no human in the loop.** Built on Solana × CoralOS for the UK AI Agent Hackathon EP5
(DoraHacks #2272, Coral / CoralOS & STUK track).

[中文版 README](README.zh.md) · [Demo guide & runbook](DEMO.md) · [Roadmap](PLAN.md) ·
[Proposal](PROPOSAL.md) · [Critical review](CRITIQUE.md)

## What it does (verified live on devnet, 2026-07-03)

One **buyer agent** broadcasts a need over a shared CoralOS thread. Four **LLM seller personas**
— `seller-cheap` (low-price volume), `seller-honest` (fair price), `seller-premium`
(high-confidence premium), and `seller-rogue` (**the villain**: wins bids, takes the escrow, never
delivers) — each decide with an LLM whether and how much to bid, bounded by their cost floors. The
buyer awards with a stated reason, locks payment in a **Solana escrow**, the winner delivers
**real TxODDS World Cup data**, and the escrow **releases on delivery**. When the rogue wins and
ghosts, the buyer waits out the on-chain deadline and **reclaims its funds with the escrow's
refund instruction** — the round turns red on the dashboard with its own Explorer link. Every hop
is a real devnet transaction; a React dashboard folds the transcript into a live auction timeline.

```
WANT → 4 LLM bids (persona-priced) → AWARD + reason → escrow deposit ─┬→ DELIVERED (real data) → RELEASED
                                                                      └→ no delivery → deadline → REFUNDED
```

Proof (click through to Solana Explorer, devnet — one live session, both outcomes):

- Round 1 **settled** — won by **seller-honest** at 0.0007 SOL over the rogue's 0.00025 (the LLM
  buyer weighs notes, not just price):
  [release tx](https://explorer.solana.com/tx/2vp5d5RCe3yMCRSiFCkD57JF4cPrVfx6BKhTFajmq7dxMkS6iMLTngCMs6vJnqeH7rTX2ykvgzetdGhdSiYtKUr7?cluster=devnet)
- Round 2 **refunded** — won by **seller-rogue** posing as a reputable vendor; escrow funded, no
  delivery, buyer reclaimed after the 45s deadline:
  [refund tx](https://explorer.solana.com/tx/5PLwHDBizrxadzF6ScVaCQG81xeFogbYgsp8aReZ2tyvVYQZW8LjTayZMuHtpaRQSq5tx9HECRrnmUTCokyAn7g5?cluster=devnet)
- Round 3 **refunded** — the rogue won again and earned **zero** again:
  [refund tx](https://explorer.solana.com/tx/4qiHDaqVLgcmJh7cmNCHvWbXF4Ek6gVd5fNAvxHsrkQ2rWBN7f57iwJNmSJBV3cRuK39VJRpPQHA4t93RsSo8bcw?cluster=devnet)
- Earlier happy-path session: [honest beats cheap on
  value](https://explorer.solana.com/tx/2nhjgoR8W3gJjm8Uxas1WtQbf722xsTdYcRBwxo5zh6gRYNqq1RoTZp2fA6CqwsvLy3LCXJVnu31ekh6n1T1mHrC?cluster=devnet)
  · [cheap wins on
  price](https://explorer.solana.com/tx/261BtQLUQv6WtPkQ9iokAXdycMLgXVVjv2VH1eE6yGXwd4Eojiy3cDqATpA4ri4WAFxYLHeApVviJz7BnGyvhEFr?cluster=devnet)

## Why "accountable"

Two days of running this market for real broke settlement **six different ways** — every failure
diagnosed and fixed in this repo's history (details in [DEMO.md](DEMO.md)):

1. The launcher referenced seller personas that didn't exist — sessions failed upstream.
2. The buyer crashed silently: the default arbiter settlement needs a key the launcher never forwarded.
3. The deployed devnet **arbiter program's global config is first-come-first-served** — every fork
   of the kit fails `NotArbiter` forever; funds locked behind a stranger's key.
4. A brand-new seller wallet can't receive payouts below Solana's rent floor — every round stalled.
5. Escrow payment references had no session component — re-runs collided with old escrow PDAs.
6. **The refund path existed on-chain but nobody had wired it** — a no-show seller stranded the
   buyer's deposit forever. We wired it and built `seller-rogue` to prove it live. Along the way,
   the DeepSeek buyer refused the rogue's pushy sales notes for 9 straight rounds — and fell for
   the same agent dressed as a calm institutional vendor. LLM prudence is a soft defense; the
   deadline refund is the hard one.

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
- **The accountability loop**: buyer-side deadline refund (`refund()` was deployed on-chain but
  never called), a `REFUNDED` protocol message, the `seller-rogue` persona with a `DELIVER_MODE`
  knob (`none`/`junk`), and a red refund badge with Explorer link in the dashboard.
- `ARBITER_RELEASED` folds as settled in the dashboard feed (default-mode settlements never showed).
- `ARBITER_KEYPAIR_B58` forwarded to the buyer; settlement mode configurable (`SETTLEMENT_MODE`).
- **DeepSeek** as a fourth LLM provider, with a token floor for reasoning models.
- Seller rent-floor preflight warning; per-run salt in escrow reference bindings.
- Tests green throughout: agent-runtime 37/37 · feed 10/10 · web 7/7 (+ typecheck everywhere).

## Roadmap (mapped to versions in [PLAN.md](PLAN.md))

`jupiter_quote` second service → risk-adjusted buyer selection → verification adapter
(verify-then-pay) → watcher/challenger → arbiter agent → **own on-chain arbitration + slashing**
(finding #3 makes the case) → reputation → full dashboard timeline.

## Repo map

| Path | What it is |
|---|---|
| `solana_coralOS-main/` | The vendored kit + our changes (agents, runtime, escrow programs, marketplace, dashboard) |
| `DEMO.md` | Demo storyboard, runbook, live artifacts, findings in detail |
| `PLAN.md` | Version-by-version roadmap |
| `PROPOSAL.md` / `PROPOSAL.zh.md` | The proposal |
| `CRITIQUE.md` | Adversarial review of the proposal (decision log) |
| `progress.md` | Working notes |
