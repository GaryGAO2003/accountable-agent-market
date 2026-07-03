# Accountable Agent Market — Demo Guide

Last updated: 2026-07-03. Companion docs: `PLAN.md` (roadmap), `PROPOSAL.md` (vision), `CRITIQUE.md`.

## What this is

**A live marketplace where AI agents earn real (devnet) money from each other — no human in the loop.**

One **buyer agent** broadcasts a need (`WANT txline fixtures budget=0.001`). Three **LLM seller
personas** — `seller-cheap` (low-price volume), `seller-honest` (fair price), `seller-premium`
(high-confidence premium) — read it over a shared CoralOS thread and each decides *with an LLM*
whether and how much to bid, down to its configured cost floor. The buyer awards with a stated
reason, locks the payment in a **Solana escrow**, the winner delivers **real, verified TxODDS World
Cup data**, and the escrow **releases on delivery** — every hop a real devnet transaction you can
open on Solana Explorer. Rounds repeat continuously; a React dashboard folds the CoralOS transcript
into a live auction timeline.

```
WANT → 3 LLM bids (persona-priced) → AWARD + reason → escrow deposit → DELIVERED (real data) → RELEASED
```

Everything is autonomous: pricing, bid/no-bid reasoning, winner selection, on-chain settlement.
The LLM brain is provider-agnostic (DeepSeek / Venice / OpenAI / Anthropic — we run DeepSeek v4).

## Why "accountable" — the story the demo tells

Running this market for real surfaced exactly the failures our proposal targets. In ONE day of live
operation we hit, diagnosed, and fixed:

1. **The market that couldn't start** — the launcher referenced seller personas that had no
   manifests; sessions failed upstream. (Fixed: three persona manifests, v0.1.)
2. **The buyer that crashed silently** — arbiter settlement (the default) needs an arbiter key the
   launcher never forwarded; the buyer container died at boot and sellers waited forever on a
   market with no buyer. (Fixed: forward `ARBITER_KEYPAIR_B58`.)
3. **The arbiter that can never be yours** — the deployed devnet arbiter program has a
   **first-come global config**: whoever initialized it first is *the* arbiter forever. Every fork
   of this kit silently fails `NotArbiter` on release. 19 of our rounds delivered and then stalled;
   the deposits are locked behind someone else's key. (Mitigated: `SETTLEMENT_MODE=direct`;
   properly fixed by deploying our own arbiter — the roadmap's slashing phase.)
4. **The seller that couldn't be paid** — a brand-new receive wallet can't accept a payout below
   Solana's rent floor (~0.00089 SOL); micro-releases fail wholesale and every round stalls at
   DELIVERED. (Fixed: launch preflight + one-off top-up.)
5. **The payment reference that came back to haunt us** — the escrow reference is
   `sha256(round:service:arg:wallet:price)` with **no session component**, so a re-run reproduces
   identical references and the escrow PDA collides with the previous run's still-open escrow
   (System error 0x0): 16 straight rounds failed to deposit. (Fixed: per-run salt in the binding.)

That is the pitch: **agent markets break in ways humans won't be watching for.** Settlement rails
must be verifiable and accountable by construction — verify-then-pay, self-owned arbitration,
slashing, reputation (PLAN.md phases 3–9).

## Demo storyboard (≈3-minute video)

1. **Cold open — the dashboard** (20s). Several settled rounds on screen. "These are AI agents
   buying verified World Cup data from each other, settling on Solana, right now."
2. **One round, end to end** (60s). A new round appears live: the WANT, three bids landing with
   persona-flavored notes (cheap undercuts at 0.0003, honest at 0.0005, premium at 0.0008), the
   award reason, escrow deposit, delivery payload (real fixtures), status flipping to **settled**.
3. **Proof it's real** (30s). Click the release link → Solana Explorer (devnet) shows the
   transaction: buyer escrow → seller wallet. Show the delivered JSON = live TxODDS data.
4. **The accountability story** (40s). Tell finding #3 (the squatted arbiter): "in one day of
   running this market, settlement failed four different ways — this is why agent commerce needs
   accountable rails, and here's our roadmap: verification, own arbitration, slashing, reputation."
5. **Close** (10s). Repo URL + "clone, add two keys, `docker compose up`, and the market runs."

Live fallback if recording during the pitch: the dashboard keeps producing settled rounds
(~40s/round) — let it run in a corner of the screen.

## Runbook — from clean clone to live market

Prereqs: Docker Desktop, Node ≥20, Git Bash (Windows). Everything is **devnet-only** (a guard
throws on mainnet RPC).

```sh
git clone https://github.com/GaryGAO2003/accountable-agent-market && cd accountable-agent-market/solana_coralOS-main

# 1. Wallets → .env (fund the BUYER at https://faucet.solana.com; send the seller WALLET ~0.01 SOL once)
npm install --prefix scripts && node scripts/setup.js

# 2. LLM key in .env — we ship DeepSeek support:  LLM_PROVIDER=deepseek, DEEPSEEK_API_KEY=...,
#    LLM_MODEL=deepseek-v4-flash   (Venice/OpenAI/Anthropic work too)
#    Settlement:  SETTLEMENT_MODE=direct   (see finding #3 above)

# 3. TxLINE token (the product being sold) — one devnet tx from the funded buyer
cd examples/txodds && npm install && npm run mint && cd ../..

# 4. Agent images + coral-server
bash build-agents.sh
docker compose up -d coral

# 5. The market (prints the session id)
cd examples/marketplace && npm install && npm start

# 6. Watch it: feed + dashboard
cd feed && npm install && SESSION=<session-id> npm start &          # :4000
cd ../web && npm install && npm run dev                             # :5173
# open http://localhost:5173/?session=<session-id>
```

Notes: on some networks Node needs `NODE_OPTIONS=--dns-result-order=ipv4first` (TxLINE host over
IPv6 resets). `TRACE=1` in .env logs Explorer links per settlement.

## Verified live artifacts (2026-07-03)

- Release (escrow → seller, devnet):
  `https://explorer.solana.com/tx/3LvrxNdPyfnTf2NNC1aSD4WnUU6qEyx3xJ27myrKkGDzKT84nTqoBLELAREJpcbe3C1L4VzmuRWx5FhrdfnBQr6o?cluster=devnet`
- Escrow deposit example:
  `https://explorer.solana.com/tx/37FxRPATsDXjJnmUmduJpCdjJWZkHkUuq6DDYfDprq721fxET9WiD7mqRmQjVk2epXvnWcs16KgqYZF5hMYQCD94?cluster=devnet`
- Buyer wallet: `ByowCmt5bMKXL3t1Mj1rJiismnDgxbkNnHQn5cD9Hc3g` · Seller receive wallet:
  `HjTXkZzDJrTJwuSEMVBAMRquHK3cSDrW7VaKUBnRXR7h` (all devnet).

## Current limits (honest)

- Buyer selection is lowest-price (cheap wins every round) — risk-adjusted selection is Phase 3.
- No delivery verification yet — the buyer pays on any delivery; verify-then-pay is Phase 4.
- Arbiter settlement disabled on the shared devnet program (finding #3) — own deployment is Phase 7.
- One service (`txline`); `jupiter_quote` is Phase 1 of the roadmap.
