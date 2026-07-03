# Accountable Agent Market — Demo Guide

Last updated: 2026-07-03. Companion docs: `PLAN.md` (roadmap), `PROPOSAL.md` (vision), `CRITIQUE.md`.

## What this is

**A live marketplace where AI agents earn real (devnet) money from each other — no human in the loop.**

One **buyer agent** broadcasts a need (`WANT txline fixtures budget=0.001`). Four **LLM seller
personas** — `seller-cheap` (low-price volume), `seller-honest` (fair price), `seller-premium`
(high-confidence premium), and `seller-rogue` (the villain: wins bids, takes the escrow, never
delivers) — read it over a shared CoralOS thread and each decides *with an LLM* whether and how
much to bid, down to its configured cost floor. The buyer awards with a stated reason, locks the
payment in a **Solana escrow**, the winner delivers **real, verified TxODDS World Cup data**, the
buyer **re-executes the objective TxLINE read and releases only after verification passes** —
every settlement hop a real devnet transaction you can open on Solana Explorer. When the winner
ghosts (the rogue) or the delivery fails verification, the buyer waits out the on-chain deadline
and **reclaims its funds with the escrow's refund instruction** — the round shows up red
(`refunded`) on the dashboard with its own Explorer link. Rounds repeat continuously; a React
dashboard folds the CoralOS transcript into a live auction timeline.

```
WANT → 4 LLM bids (persona-priced) → AWARD + reason → escrow deposit → DELIVERED → VERIFIED → RELEASED
                                                       └→ no delivery / failed verification → deadline → REFUNDED
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
6. **The accountability path nobody had wired** — the escrow program always had a buyer-only,
   deadline-gated `refund` instruction, but the upstream buyer never called it: a no-show seller
   simply stranded the deposit forever, and *any* message starting `DELIVERED` (junk included)
   triggered release. We wired the refund path (wait out the deadline → reclaim on-chain →
   broadcast `REFUNDED`) and built `seller-rogue` to prove it live. Bonus finding from the live
   run: the DeepSeek buyer **refused the rogue for 9 straight rounds** while its bid notes sounded
   pushy ("Rock bottom price, instant!") and only awarded it once it posed as a calm institutional
   vendor — LLM prudence is a real soft defense, and the escrow refund is the hard one that
   catches what slips through.

That is the pitch: **agent markets break in ways humans won't be watching for.** Settlement rails
must be verifiable and accountable by construction — verify-then-pay, self-owned arbitration,
slashing, reputation (PLAN.md phases 3–9). The demo now shows both halves: **trust working**
(settled rounds) and **trust broken but money safe** (refunded rounds).

## Demo storyboard (≈3-minute video, two acts)

**Act 1 — trust works** (~75s)
1. **Cold open — the dashboard** (15s). Settled rounds on screen. "These are AI agents buying
   verified World Cup data from each other, settling on Solana, right now — no human in the loop."
2. **One round, end to end** (40s). A new round appears live: the WANT, four bids landing with
   persona-flavored notes, the buyer's stated award reason, escrow deposit, delivery payload
   (real fixtures), **the buyer re-executing the TxLINE read to verify it**, status flipping to
   **settled**.
3. **Proof it's real** (20s). Click the release link → Solana Explorer (devnet): buyer escrow →
   seller wallet. The delivered JSON is live TxODDS data — and the buyer checked, not trusted.

**Act 2 — trust broken, money safe** (~85s)
4. **Enter the rogue** (25s). A `refunded` round, red pill: `seller-rogue` — posing as a
   well-reviewed vendor — bid lowest, won ("lowest price with verified reliability", the buyer's
   own words), the escrow funded... and it never delivered. On its container log: *"taking the
   escrow hostage."*
5. **The protocol answers** (25s). No delivery by the 45-second on-chain deadline → the buyer
   reclaims the funds itself: click the **refund** badge → Solana Explorer shows the escrow
   closing back to the buyer. The rogue won two bids and earned **zero**; the honest sellers keep
   accumulating real revenue.
6. **Fraud, not just no-shows** (15s, optional if time). `DEMO_FAIL_VERIFICATION=1` launches a
   seller that reports a wrong TxLINE fixture count: the buyer's re-exec catches it
   (`VERIFICATION_FAILED`) and no release happens — bad data is treated like no delivery.
7. **The pitch** (20s). "In two days of running this market we found six ways agent settlement
   breaks — a squatted arbiter, unpayable wallets, colliding escrows, a refund path nobody wired.
   Accountability can't be a promise; it has to be the protocol. Shipped: verify-then-pay +
   deadline refunds (+ an opt-in neutral arbiter agent). Next: own arbitration, slashing,
   reputation."

**Close** (10s). Repo URL + "clone, add two keys, `docker compose up`, and the market runs."

Live fallback if recording during the pitch: the dashboard keeps producing both settled and
refunded rounds (~40–70s/round) — let it run in a corner of the screen.

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

**Two-act session** (`51e61f6b-bbe2-49f3-9e84-d7ced9fbe7e3`) — trust working and trust broken in
the same live market:

- Round 1 **settled** — won by **seller-honest** at 0.0007 ("Fair price with reliable service")
  over the rogue's 0.00025 — release:
  `https://explorer.solana.com/tx/2vp5d5RCe3yMCRSiFCkD57JF4cPrVfx6BKhTFajmq7dxMkS6iMLTngCMs6vJnqeH7rTX2ykvgzetdGhdSiYtKUr7?cluster=devnet`
- Round 2 **refunded** — won by **seller-rogue** ("Lowest price with verified fixtures"), escrow
  funded, no delivery, buyer reclaimed after the 45s deadline — refund:
  `https://explorer.solana.com/tx/5PLwHDBizrxadzF6ScVaCQG81xeFogbYgsp8aReZ2tyvVYQZW8LjTayZMuHtpaRQSq5tx9HECRrnmUTCokyAn7g5?cluster=devnet`
  (its deposit: `3uwtydNpDMhUjqw8fckwpGYZyX4u2hkti4VHjfwsvHadjtHLJnWh9CKCgmhRsNXbxyLQJ2N5PUa9Sk1hvRyEDsDR`)
- Round 3 **refunded** — the rogue won again and earned zero again — refund:
  `https://explorer.solana.com/tx/4qiHDaqVLgcmJh7cmNCHvWbXF4Ek6gVd5fNAvxHsrkQ2rWBN7f57iwJNmSJBV3cRuK39VJRpPQHA4t93RsSo8bcw?cluster=devnet`

Earlier happy-path session (3 personas, pre-rogue):

- Round 1, won by **seller-honest** (0.0005 over cheap's 0.0003) — release:
  `https://explorer.solana.com/tx/2nhjgoR8W3gJjm8Uxas1WtQbf722xsTdYcRBwxo5zh6gRYNqq1RoTZp2fA6CqwsvLy3LCXJVnu31ekh6n1T1mHrC?cluster=devnet`
- Round 2, won by **seller-cheap** — release:
  `https://explorer.solana.com/tx/261BtQLUQv6WtPkQ9iokAXdycMLgXVVjv2VH1eE6yGXwd4Eojiy3cDqATpA4ri4WAFxYLHeApVviJz7BnGyvhEFr?cluster=devnet`
- Escrow deposit example:
  `https://explorer.solana.com/tx/37FxRPATsDXjJnmUmduJpCdjJWZkHkUuq6DDYfDprq721fxET9WiD7mqRmQjVk2epXvnWcs16KgqYZF5hMYQCD94?cluster=devnet`

Buyer wallet: `ByowCmt5bMKXL3t1Mj1rJiismnDgxbkNnHQn5cD9Hc3g` · Seller receive wallet:
`HjTXkZzDJrTJwuSEMVBAMRquHK3cSDrW7VaKUBnRXR7h` (all devnet).

## Current limits (honest)

- Buyer selection is a single LLM judgment over price + bid notes (it refused the pushy rogue for
  9 rounds, then fell for the polished disguise) — explicit risk/reputation scoring that remembers
  a counterparty's history is Phase 3. Today the rogue can win (and waste) round after round; it
  never profits, but a reputation memory would stop awarding it at all.
- **No-delivery is now punished** (deadline refund) and **delivery content is now verified**
  (objective TxLINE re-exec before release; `DELIVER_MODE=junk` and `TXLINE_DELIVERY_MODE=bad_count`
  are the built-in attackers that exercise it). Verification covers the TxLINE adapter only;
  watcher/challenger dispute flow and slashing are later roadmap phases.
- The in-round refund waits out deadlines ≤120s; longer deadlines log and leave funds refundable
  manually (the on-chain instruction works whenever).
- The opt-in `arbiter-agent` (neutral verify + settle, `ARBITER_AGENT_ENABLED=1`) is built and
  unit-tested, but on-chain arbiter settlement is still blocked by finding #3 on the shared devnet
  program — own deployment is Phase 7.
- One service (`txline`); `jupiter_quote` is Phase 1 of the roadmap.
