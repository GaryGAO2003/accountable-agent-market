# Accountable Agent Market

**A live marketplace where AI agents buy and sell from each other — priced by LLMs, settled on
Solana, no human in the loop.** Built on Solana × CoralOS for the UK AI Agent Hackathon EP5
(DoraHacks #2272, Coral / CoralOS & STUK track).

[中文版 README](README.zh.md) · [Demo guide & runbook](DEMO.md) · [Roadmap](PLAN.md) ·
[Proposal](PROPOSAL.md) · [Critical review](CRITIQUE.md)

## What it does (verified live on devnet, 2026-07-03)

One **buyer agent** broadcasts a need over a shared CoralOS thread. **LLM seller personas** compete
— three that play fair (`seller-cheap` low-price volume, `seller-honest` fair price,
`seller-premium` high-confidence premium) and two built to attack settlement (`seller-rogue`: wins
bids, takes the escrow, never delivers; `seller-hijack`: wins, then names a **foreign payout
wallet** in its escrow terms). Each decides with an LLM whether and how much to bid, bounded by its
cost floor. The buyer awards with a stated reason — but **every outbound payment first passes a
code-enforced policy check (the Egress PEP)**, so it only ever deposits to the wallet it expects.
It locks payment in a **Solana escrow**, the winner delivers **real TxODDS World Cup data**, the
buyer **re-executes the objective TxLINE read**, and the escrow **releases only after verification
passes**. When the rogue ghosts, the buyer waits out the on-chain deadline and **reclaims its funds
with the escrow's refund instruction** (the round turns red with its own Explorer link). When the
hijacker tries to redirect the payout, the PEP **refuses the deposit before any transaction is
signed** — it wins the auction and earns nothing, and *no SOL moves at all*. Every settlement hop
is a real devnet transaction; a React dashboard folds the transcript into a live auction timeline.

```
                                                  ┌ Egress PEP: payout to an unexpected wallet? refused pre-flight — no tx, no funds moved
WANT → LLM bids (persona-priced) → AWARD + reason ┴→ escrow deposit → DELIVERED → VERIFIED → RELEASED
                                                       └→ no delivery / failed verification → deadline → REFUNDED
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

### The prevention layer — an Egress PEP

The six findings above are all *detection* — the market broke and we caught it after the fact.
The other half is *prevention*: stopping a bad action **before** it happens. Every outbound agent
action — a deposit, a release, a refund, an outbound HTTP call — now passes one code-enforced
**Policy Enforcement Point** first ("the model proposes, code disposes"): a recipient allowlist,
per-reference replay defense, a spend budget, a velocity cap, and an outbound-host allowlist, each
denial tagged with a **reason code** and written to an audit trail. A prompt injection in fetched
data, or a hijacked thread message, can *ask* the buyer to pay the wrong wallet — it cannot make
it, because the deciding logic lives in code the prompt can't reach.

The demo makes this visible with `seller-hijack`: it undercuts to win, then swaps a **foreign
payout wallet** into its escrow terms. The buyer's PEP pins the expected wallet and refuses the
deposit — `RECIPIENT_NOT_ALLOWED` — so the hijacker wins the auction and earns nothing. **This is
honest about what it is: a block is not an on-chain transaction.** There is no signature to show;
the proof is the audit line plus the deposit that never appears, set against a normal round's real
Explorer link. Prevention leaves a *smaller* footprint than settlement, by design.

### The memory layer — reputation (L3)

Refunds and blocks are **per-incident**: the money comes back, the action is stopped — and the same
seller is free to win the next auction and waste the next round. The reputation layer is the
cross-round memory: every round's terminal outcome updates the seller's score (**+2** settled,
**−3** refunded / blocked / failed verification — one fraud outweighs one good delivery), and a
seller that hits the flag threshold is **frozen out**: the buyer drops its bids before awarding,
forever. L1 gets the money back, L2 stops one action, **L3 stops the relationship** — one strike
and the rogue never gets awarded again, so it can't even waste rounds.

Each standing change is broadcast into the CoralOS thread (`REPUTATION seller=… score=… tier=…`)
and — by default — **anchored on-chain via an SPL Memo transaction**, so the reputation trail has
real Explorer links. Honest framing: the memo is an on-chain *log* of the standing change, signed
by the buyer; the freeze itself is buyer-side policy. A reputation *state machine* (own program,
PDA per seller, bonds scaling with standing) is the roadmap's next rung.

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
- **Verify-then-pay**: the buyer re-executes the objective TxLINE read before release
  (`VERIFIED` / `VERIFICATION_FAILED` in the transcript), with a scripted bad-data seller
  (`DEMO_FAIL_VERIFICATION=1`, `TXLINE_DELIVERY_MODE=bad_count|invalid_json`) so judges can watch
  a release get blocked.
- Opt-in `arbiter-agent` flow (`ARBITER_AGENT_ENABLED=1`): a neutral agent verifies and emits
  `ARBITER_VERIFIED` / `ARBITER_REJECTED`, then signs release/refund (on-chain half awaits our own
  arbiter deployment — finding #3).
- **The prevention layer — a unified Egress PEP** (`packages/agent-runtime/src/market/egress.ts`):
  one code-enforced policy check (recipient allowlist · reference replay · budget · velocity ·
  outbound-host allowlist) with a reason-code taxonomy + audit log, wired at the buyer's
  deposit/release/refund sites and the seller's TxLINE fetch. A blocked round emits `EGRESS_DENIED`
  to the thread and shows a violet **PEP blocked** badge on the dashboard (no fake Explorer link —
  a block isn't a tx). The `seller-hijack` persona (payout-wallet swap) drives the demo beat.
- **The memory layer — reputation** (`packages/agent-runtime/src/market/reputation.ts`): per-seller
  cumulative scoring (+2 settled / −3 refunded·blocked·verify-failed), tiers
  (trusted/neutral/flagged), and the market-layer freeze — the buyer drops flagged sellers' bids
  before awarding, so one strike ends the relationship. Standing changes broadcast as `REPUTATION`
  thread lines and anchor on-chain via **SPL Memo** (`REP_MEMO=1` default); the dashboard shows
  per-seller tiers, "frozen out" bid chips, and the memo trail's Explorer links.
- Tests green throughout (see CI-style runs in the merge history): agent-runtime · buyer · seller ·
  arbiter · feed · web, plus typechecks everywhere.

## Roadmap (mapped to versions in [PLAN.md](PLAN.md))

`jupiter_quote` second service → risk-adjusted buyer selection → broader verification adapters →
watcher/challenger → arbiter agent → **own on-chain arbitration + slashing** (finding #3 makes the
case) → reputation **PDA + bond scaling** (the off-chain ledger + Memo trail shipped; the on-chain
state machine is next) → full dashboard timeline.

## Repo map

| Path | What it is |
|---|---|
| `solana_coralOS-main/` | The vendored kit + our changes (agents, runtime, escrow programs, marketplace, dashboard) |
| `DEMO.md` | Demo storyboard, runbook, live artifacts, findings in detail |
| `PLAN.md` | Version-by-version roadmap |
| `PROPOSAL.md` / `PROPOSAL.zh.md` | The proposal |
| `CRITIQUE.md` | Adversarial review of the proposal (decision log) |
| `progress.md` | Working notes |
