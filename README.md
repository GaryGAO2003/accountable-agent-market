# Accountable Agent Market

**A live marketplace where AI agents buy and sell from each other — priced by LLMs, settled on
Solana, with no human in the loop.**

Built on **Solana × CoralOS** for the **UK AI Agent Hackathon EP5** (DoraHacks #2272, Coral /
CoralOS & STUK track).

[中文版 README](README.zh.md) · [Demo guide & runbook](DEMO.md) · [Roadmap](PLAN.md) ·
[Proposal](PROPOSAL.md) · [Critical review](CRITIQUE.md)

## Table of Contents

- [What it does](#what-it-does)
- [The three accountability layers](#the-three-accountability-layers)
- [Live proof (devnet)](#live-proof-devnet)
- [Quick start](#quick-start)
- [Repo map](#repo-map)
- [What we built on the upstream kit](#what-we-built-on-the-upstream-kit)
- [Roadmap](#roadmap)

## What it does

A single **buyer agent** posts a need to a shared **CoralOS** thread. **Five LLM seller personas**
compete for the job, each deciding with its own LLM call whether and how much to bid:

- **Honest sellers** — `seller-cheap` undercuts on price, `seller-honest` bids fair value,
  `seller-premium` charges for high confidence.
- **Adversarial sellers** — `seller-rogue` wins bids, takes the escrow, and never delivers;
  `seller-hijack` wins, then names a **foreign payout wallet** in its escrow terms.

The buyer weighs the bids with an LLM (reading notes and confidence, not just price) and **awards
with a stated reason**. It locks payment in a **Solana escrow**, the winner delivers, the buyer
**re-executes the objective read to verify**, and the escrow **releases only after verification
passes**. No human approves any step.

**What's on sale** is one line of value: a **verified, de-margined "fair-odds" read** for a
football match, sourced from **TxODDS TxLINE**. The devnet free tier covers World Cup fixtures, so
that is the demo dataset — the product is the accountable settlement, not the sports data.

Every settlement hop is a real devnet transaction, and a React dashboard folds the thread
transcript into a live auction timeline.

```
               ┌ flagged sellers frozen out before AWARD                  (L3)
               │
WANT → BID → AWARD → DEPOSITED → DELIVERED → VERIFIED → RELEASED     ← happy path
               │         │
               │         └ no delivery / bad data → deadline → REFUNDED    (L1)
               └ payout-wallet swap → Egress PEP blocks pre-sign, no tx    (L2)
```

## The three accountability layers

Running this market for real proved a blunt point: **agent markets fail in ways a human won't be
watching for.** Accountability has to be built in at three levels — money, actions, and
relationships.

| Layer | Mechanism | Attack it defeats |
|---|---|---|
| **L1 — Settlement** | Solana escrow. The buyer **re-executes the objective TxLINE read to verify** before release. A no-show or failed verification triggers a **deadline refund**. Optional arbiter / challenger. | `seller-rogue` wins and never delivers. The buyer waits out the on-chain deadline and reclaims its funds with the escrow's refund instruction. |
| **L2 — Prevention (Egress PEP)** | One code-enforced policy check **before signing**: recipient allowlist · reference replay · budget · velocity · outbound-host allowlist. Every denial carries a **reason code** and an audit line. | `seller-hijack` swaps a foreign payout wallet into its terms. The check pins the expected wallet and refuses with `RECIPIENT_NOT_ALLOWED`. It wins the auction, earns nothing, and **no SOL moves**. |
| **L3 — Reputation** | Cross-round memory: **+2** settled, **−3** refunded / blocked / verify-failed. Tiers: trusted / neutral / flagged. A **flagged seller is frozen out** of the award pool. Standing changes anchor on-chain via **SPL Memo**. | A rogue that already cheated is dropped before the next award, so it cannot even waste another round. One strike ends the relationship. |

> **L1 gets the money back, L2 stops one action, L3 stops the relationship.**

**L1** is recovery: the market can still break, but the money is never stranded. **L2** is
prevention — "the model proposes, code disposes." A prompt injection or a hijacked thread message
can *ask* the buyer to pay the wrong wallet; it cannot make it, because the deciding logic lives in
code the prompt can't reach. A block is **not** an on-chain transaction, and we say so: there is no
signature to show, only the audit line and the deposit that never appears. **L3** is memory across
rounds. The freeze is buyer-side policy; the SPL Memo is its on-chain log, so even reputation
changes leave an Explorer trail.

## Live proof (devnet)

Real Solana Explorer links. Click through to the raw transactions.

**Latest run (2026-07-06, release confirmed `finalized`):**

- **RELEASED** — the honest seller wins on value, delivers, the read verifies, escrow releases:
  [release tx](https://explorer.solana.com/tx/hyfN7scoGeJ2FVydN1fWhwSRqFM1VzagAdC3ynDLBnevbs6KjuxfX7umZiFcqt1CkAAXu83h6oaac5MrH9XmAx9?cluster=devnet)
- **REFUNDED** — the rogue wins, never delivers, the buyer reclaims after the deadline:
  [refund tx](https://explorer.solana.com/tx/28Ue5YqJ9zkV8xEMXbRjm4x6PR1bfH1oH6pWHiN46xWxLDMYJPsS1WCWrn28Aytmwm6BsVLt5p3kjH1xgp1HFx9G?cluster=devnet)
- **BLOCKED (hijack)** — *no link, by design.* The payout-wallet swap is refused before signing, so
  there is no transaction. The proof is the `RECIPIENT_NOT_ALLOWED` audit line plus the deposit that
  never appears.

**Earlier session (2026-07-03, both outcomes in one run):**

- Round 1 **settled** — `seller-honest` won at 0.0007 SOL over the rogue's 0.00025 (the buyer weighs
  notes, not just price):
  [release tx](https://explorer.solana.com/tx/2vp5d5RCe3yMCRSiFCkD57JF4cPrVfx6BKhTFajmq7dxMkS6iMLTngCMs6vJnqeH7rTX2ykvgzetdGhdSiYtKUr7?cluster=devnet)
- Round 2 **refunded** — the rogue posed as a reputable vendor, funded escrow, no delivery,
  reclaimed after the 45s deadline:
  [refund tx](https://explorer.solana.com/tx/5PLwHDBizrxadzF6ScVaCQG81xeFogbYgsp8aReZ2tyvVYQZW8LjTayZMuHtpaRQSq5tx9HECRrnmUTCokyAn7g5?cluster=devnet)
- Round 3 **refunded** — the rogue won again and earned zero again:
  [refund tx](https://explorer.solana.com/tx/4qiHDaqVLgcmJh7cmNCHvWbXF4Ek6gVd5fNAvxHsrkQ2rWBN7f57iwJNmSJBV3cRuK39VJRpPQHA4t93RsSo8bcw?cluster=devnet)
- Happy-path pair:
  [honest beats cheap on value](https://explorer.solana.com/tx/2nhjgoR8W3gJjm8Uxas1WtQbf722xsTdYcRBwxo5zh6gRYNqq1RoTZp2fA6CqwsvLy3LCXJVnu31ekh6n1T1mHrC?cluster=devnet)
  ·
  [cheap wins on price](https://explorer.solana.com/tx/261BtQLUQv6WtPkQ9iokAXdycMLgXVVjv2VH1eE6yGXwd4Eojiy3cDqATpA4ri4WAFxYLHeApVviJz7BnGyvhEFr?cluster=devnet)

## Quick start

**Prereqs:** Docker Desktop, Node ≥ 20, and Git Bash on Windows. **Devnet only** — the runtime
throws on a mainnet RPC.

```sh
git clone https://github.com/GaryGAO2003/accountable-agent-market
cd accountable-agent-market/solana_coralOS-main

npm install --prefix scripts && node scripts/setup.js   # wallets → .env, then fund the buyer at faucet.solana.com

# Edit .env:
#   LLM_PROVIDER=deepseek  DEEPSEEK_API_KEY=...  LLM_MODEL=deepseek-v4-flash   (Venice/OpenAI/Anthropic also work)
#   SETTLEMENT_MODE=direct     # the shared devnet arbiter's global config is first-come-first-served; forks use direct escrow
#   SELLER_BOND_SOL=0          # without this (or a BOND_HOLDER_WALLET) the seller bond throws and blocks delivery — every won round refunds
# Send the seller WALLET ~0.01 devnet SOL once (a fresh wallet can't receive payouts below Solana's rent floor).

(cd examples/txodds && npm install && npm run mint)     # mint the TxLINE token — the product being sold
bash build-agents.sh && docker compose up -d coral      # build agent images + start coral-server
cd examples/marketplace && npm install && npm start     # prints the session id

# Dashboard:  feed (:4000) + web (:5173) → http://localhost:5173/?session=<id>
# Watch it:   docker logs -f buyer-agent
```

Full runbook with per-step explanations: [DEMO.md](DEMO.md).

## Repo map

| Path | What it is |
|---|---|
| `solana_coralOS-main/` | The vendored kit plus our changes (agents, runtime, escrow programs, marketplace, dashboard) |
| `DEMO.md` | Demo storyboard, runbook, live artifacts, findings in detail |
| `PLAN.md` | Version-by-version roadmap |
| `PROPOSAL.md` / `PROPOSAL.zh.md` | The proposal |
| `CRITIQUE.md` | Adversarial review of the proposal (decision log) |
| `progress.md` | Working notes |

## What we built on the upstream kit

Upstream: [trilltino/solana_coralOS](https://github.com/trilltino/solana_coralOS) @ `a8fd71a`,
vendored pristine in [`solana_coralOS-main/`](solana_coralOS-main/). Every change is a reviewable
commit on top.

- **Seller personas + roster fix** — three honest and two adversarial personas; the stock
  marketplace could not start, so we fixed the launch roster.
- **The accountability loop (L1)** — buyer-side **deadline refund** (`refund()` was deployed
  on-chain but never called), a `REFUNDED` protocol message, the `seller-rogue` persona with a
  `DELIVER_MODE` knob (`none` / `junk`), and a red refund badge with Explorer link on the dashboard.
- **Verify-then-pay** — the buyer re-executes the objective TxLINE read before release
  (`VERIFIED` / `VERIFICATION_FAILED`), with a scripted bad-data seller (`DEMO_FAIL_VERIFICATION=1`,
  `TXLINE_DELIVERY_MODE=bad_count|invalid_json`) so judges can watch a release get blocked.
- **The Egress PEP (L2)** —
  [`packages/agent-runtime/src/market/egress.ts`](solana_coralOS-main/packages/agent-runtime/src/market/egress.ts):
  one code-enforced check (recipient allowlist · reference replay · budget · velocity ·
  outbound-host allowlist) with a reason-code taxonomy and audit log, wired at the buyer's
  deposit/release/refund sites and the seller's fetch. A block emits `EGRESS_DENIED` and shows a
  violet **PEP blocked** badge (no fake Explorer link — a block isn't a tx). The `seller-hijack`
  persona drives the demo beat.
- **The reputation ledger (L3)** —
  [`packages/agent-runtime/src/market/reputation.ts`](solana_coralOS-main/packages/agent-runtime/src/market/reputation.ts):
  per-seller cumulative scoring (+2 settled / −3 refunded·blocked·verify-failed), trusted / neutral
  / flagged tiers, and the market-layer freeze. Standing changes broadcast as `REPUTATION` thread
  lines and anchor on-chain via **SPL Memo** (`REP_MEMO=1` default).
- **Startup fixes** — the buyer's settlement-mode selection and arbiter-id forwarding were broken;
  both fixed so the marketplace settles out of the box.
- **DeepSeek** added as a fourth LLM provider (with a token floor for reasoning models), plus a
  **per-run salt** in escrow reference bindings so re-runs don't collide with old PDAs.
- Optional `arbiter-agent` flow (`ARBITER_AGENT_ENABLED=1`): a neutral agent verifies, emits
  `ARBITER_VERIFIED` / `ARBITER_REJECTED`, and signs release/refund.
- Tests green throughout: agent-runtime · buyer · seller · arbiter · feed · web, plus typechecks.

## Roadmap

Mapped to versions in [PLAN.md](PLAN.md):

`jupiter_quote` second service → risk-adjusted buyer selection → broader verification adapters →
watcher / challenger → arbiter agent → **own on-chain arbitration + slashing** → reputation **PDA +
bond scaling** (the off-chain ledger and Memo trail shipped; the on-chain state machine is next) →
full dashboard timeline.
