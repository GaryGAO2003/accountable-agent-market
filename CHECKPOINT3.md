# CHECKPOINT3 - L1 Accountability Spine + Live Demo Validation

Date: 2026-07-04

Repo working tree: `accountable-agent-market-Test/solana_coralOS-main`

Source framing:

- `PROPOSAL.md`: L1 target is the accountable spine: bond + escrow + optimistic challenge +
  objective re-exec + slash.
- `PLAN.md`: earlier v0.1/v0.2 work restored the marketplace, personas, feed/dashboard folding, and
  verify-then-pay.
- `CHECKPOINT.md` and `CHECKPOINT2.md`: prior durable state for verify-then-pay,
  failed-verification demo, and arbiter-agent.

## Executive Summary

This checkpoint now records two different kinds of L1 evidence, and keeps them separate:

1. Earlier live-validated L1 demo paths on devnet.
2. Current strict L1 code completion after the post-audit challenger-agent work.
3. Pending full live revalidation of the four-role buyer/seller/challenger/arbiter path.

The earlier live sessions proved the original verify-then-pay, seller bond, refund, and seller-bond
slash paths:

```text
Earlier live honest direct release:
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> VERIFIED -> challenge window expires -> RELEASED

Earlier live bad-data seller-bond slash:
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED_BAD
  -> CHALLENGE_OPENED -> ARBITER_REVIEW -> ARBITER_REJECTED
  -> CHALLENGE_UPHELD -> ARBITER_SLASHED bond=seller

Earlier live no-delivery refund:
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED
  -> no delivery -> REFUNDED after escrow deadline
```

After the strict L1 audit, the code now implements the full four-role path:

```text
Strict L1, locally verified and still pending live revalidation:
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> CHALLENGE_REVIEW
  -> CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>
  -> ARBITER_REVIEW
  -> CHALLENGE_UPHELD / CHALLENGE_REJECTED
  -> ARBITER_SLASHED bond=seller|challenger
```

The bond path remains a simple, credible devnet transfer-backed implementation rather than an Anchor
program extension. The seller posts `SELLER_BOND_SOL`; the challenger posts `CHALLENGER_BOND_SOL`;
and the arbiter-agent transfers the loser bond after objective re-exec. The earlier live slash proves
seller-bond movement on devnet. The newer separate challenger role and two-sided loser-bond path are
implemented and locally verified, but still need a fresh live run with a checkout-owned
`ARBITER_PROGRAM_ID` before being claimed as live-validated.

## What Was Already Built Before This Checkpoint

### 1. v0.1 Marketplace Restoration

From `PLAN.md` / prior work:

- Fixed feed folding for `ARBITER_RELEASED` so arbiter-settled rounds can appear as `settled`.
- Added seller personas:
  - `seller-cheap`
  - `seller-honest`
  - `seller-premium`
- Aligned marketplace roster, feed defaults, dashboard fixtures, and docs around the persona set.
- Kept `seller-worldcup` as a specialist example.
- Verified package-focused gates for agent runtime, feed, marketplace typecheck, web tests/typecheck,
  and TOML parsing.

### 2. Verify-Then-Pay / Objective Re-Exec

From `CHECKPOINT.md`:

- Added shared market protocol messages:
  - `DELIVERED`
  - `VERIFIED`
  - `VERIFICATION_FAILED`
- Buyer no longer releases immediately after `DELIVERED`.
- Buyer re-executes the TxLINE objective predicate first and releases only if verification passes.
- TxLINE verifier supports:
  - `fixtures`
  - `odds <fixtureId>`
  - `edge <fixtureId>`
- Dashboard/feed can show `verified` and `verification_failed`.
- This established the first proposal spine: objective re-exec before payment.

### 3. Scripted Failed-Verification Demo

From `CHECKPOINT.md` / `CHECKPOINT2.md`:

- `TXLINE_DELIVERY_MODE=bad_count` makes a seller return a TxLINE fixtures payload with the wrong
  count.
- `TXLINE_DELIVERY_MODE=invalid_json` makes a seller return non-JSON delivery.
- `DEMO_FAIL_VERIFICATION=1` launches a deterministic one-seller failure demo so the bad seller is
  always selected.
- Expected earlier shape:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFICATION_FAILED
```

### 4. Arbiter-Agent Flow

From `CHECKPOINT2.md`:

- Added `coral-agents/arbiter-agent`.
- Added protocol flow:
  - `ARBITER_REVIEW`
  - `ARBITER_VERIFIED`
  - `ARBITER_REJECTED`
  - `ARBITER_RELEASED`
  - `ARBITER_REFUNDED`
- `ARBITER_AGENT_ENABLED=1` adds the arbiter-agent to the CoralOS session graph.
- Buyer can delegate objective re-exec and final decision to the neutral arbiter-agent.
- `ARBITER_REFUND_ON_REJECT=1` can attempt refund after rejection, subject to escrow deadline.
- This moved judgment from buyer-owned verification toward a neutral CoralOS agent.

## What Was Added In This Checkpoint

### 1. L1 Protocol Messages

Added backwards-compatible protocol support for:

```text
BOND_POSTED
CHALLENGE_REVIEW
CHALLENGE_OPENED
CHALLENGE_UPHELD
CHALLENGE_REJECTED
SLASHED
ARBITER_SLASHED bond=seller|challenger
```

`CHALLENGE_REVIEW` carries delivery evidence to a separate challenger. `CHALLENGE_OPENED` can now
identify the challenger wallet and challenger bond transaction:

```text
CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>
```

Important files:

- `solana_coralOS-main/packages/agent-runtime/src/market/protocol.ts`
- `solana_coralOS-main/packages/agent-runtime/src/market/index.ts`
- `solana_coralOS-main/packages/agent-runtime/src/market/protocol.test.ts`

### 2. Seller Bond Mechanics

Added transfer-backed seller bond posting:

- Seller posts `SELLER_BOND_SOL` before delivery.
- Bond holder is `BOND_HOLDER_WALLET`, normally `ARBITER_WALLET`.
- Seller emits `BOND_POSTED` with the devnet transaction signature.
- Bond posting can be disabled by setting the bond amount to `0` in local tests.

Important files:

- `solana_coralOS-main/coral-agents/seller-agent/src/bond.ts`
- `solana_coralOS-main/coral-agents/seller-agent/src/bond.test.ts`
- `solana_coralOS-main/coral-agents/seller-agent/src/index.ts`
- seller persona `coral-agent.toml` files
- `solana_coralOS-main/scripts/setup.js`
- `solana_coralOS-main/.env.example`

### 3. Challenger Bond + Separate Challenger Role

Added `coral-agents/challenger-agent`, a separate CoralOS participant for strict L1 disputes:

- Receives `CHALLENGE_REVIEW` during the optimistic window.
- Re-executes the objective TxLINE predicate independently from buyer and seller.
- Posts `CHALLENGER_BOND_SOL` to the arbiter/bond-holder wallet before opening a dispute.
- Emits `CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>` only when delivery
  mismatches objective re-exec.
- Reads `CHALLENGER_KEYPAIR_B58` from launcher/setup wiring so the challenger has its own wallet.
- Can disable bond posting in local tests by setting challenger bond amount to `0`.

Important files:

- `solana_coralOS-main/coral-agents/challenger-agent/src/decision.ts`
- `solana_coralOS-main/coral-agents/challenger-agent/src/bond.ts`
- `solana_coralOS-main/coral-agents/challenger-agent/src/index.ts`
- `solana_coralOS-main/coral-agents/challenger-agent/coral-agent.toml`
- `solana_coralOS-main/coral-agents/challenger-agent/README.md`

### 4. Optimistic Challenge Window

Added a configurable post-delivery challenge window:

- `CHALLENGE_WINDOW_MS` controls the wait after `DELIVERED`.
- If objective verification passes and no challenge appears, buyer releases after the window.
- With `CHALLENGER_AGENT_ENABLED=1`, buyer sends `CHALLENGE_REVIEW` to the separate challenger-agent
  and waits for that challenger to open the dispute.
- The legacy buyer-owned fallback remains available through `AUTO_CHALLENGE_ON_FAILED_VERIFY=1`, but
  the strict L1 path uses challenger-owned `CHALLENGE_OPENED`.

Important files:

- `solana_coralOS-main/coral-agents/buyer-agent/src/challenge.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/challenge.test.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/index.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/coral-agent.toml`

### 5. Arbiter Challenge Decision + Two-Sided Slash

Updated `arbiter-agent` to adjudicate challenges:

- Valid delivery:

```text
ARBITER_VERIFIED -> CHALLENGE_REJECTED -> ARBITER_RELEASED -> ARBITER_SLASHED bond=challenger
```

- Invalid delivery:

```text
ARBITER_REJECTED -> CHALLENGE_UPHELD -> ARBITER_SLASHED bond=seller
```

The L1 slash is a real devnet transfer from the arbiter-held loser bond:

- If the challenge is upheld, the seller bond moves to the challenger/buyer side.
- If the challenge is rejected, the challenger bond moves to the seller.

Important files:

- `solana_coralOS-main/coral-agents/arbiter-agent/src/index.ts`
- `solana_coralOS-main/coral-agents/arbiter-agent/src/slash.ts`
- `solana_coralOS-main/coral-agents/arbiter-agent/src/slash.test.ts`
- `solana_coralOS-main/coral-agents/arbiter-agent/coral-agent.toml`

### 6. Feed / Dashboard L1 State

Updated marketplace feed and dashboard to fold/render the visible challenge and settlement states:

- `BOND_POSTED`
- `CHALLENGE_OPENED`
- `ARBITER_VERIFIED`
- `ARBITER_REJECTED`
- `CHALLENGE_UPHELD`
- `CHALLENGE_REJECTED`
- `SLASHED`
- `ARBITER_SLASHED`
- `RELEASED`
- `ARBITER_RELEASED`
- `REFUNDED`
- `ARBITER_REFUNDED`

The protocol/runtime also includes `CHALLENGE_REVIEW`; feed/dashboard surfaces the resulting public
challenge and slash evidence, including challenger wallet propagation and `bond=seller|challenger`
slash labels where available.

Terminal states now include:

- `settled`
- `rejected`
- `refunded`
- `slashed`

Important files:

- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.ts`
- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.test.ts`
- `solana_coralOS-main/examples/marketplace/web/src/types.ts`
- `solana_coralOS-main/examples/marketplace/web/src/components/RoundCard.tsx`
- `solana_coralOS-main/examples/marketplace/web/src/components/StatusPill.tsx`
- `solana_coralOS-main/examples/marketplace/web/tests/fixtures.ts`
- `solana_coralOS-main/examples/marketplace/web/src/styles.css`

### 7. Demo Launcher / Docs Updates

Updated demo wiring:

- `ARBITER_WALLET` is written by `scripts/setup.js`.
- `CHALLENGER_KEYPAIR_B58` is propagated so challenger-agent has its own wallet.
- `SELLER_BOND_SOL`, `CHALLENGER_BOND_SOL`, `BOND_HOLDER_WALLET`, `CHALLENGE_WINDOW_MS`,
  `CHALLENGER_AGENT_ENABLED`, `CHALLENGER_AGENT_NAME`, and `AUTO_CHALLENGE_ON_FAILED_VERIFY` are
  passed into relevant agents.
- `build-agents.sh` includes `challenger-agent:0.1.0`.
- `MARKET_SELLERS=seller-rogue` can now narrow the market to the no-delivery refund demo.
- Launcher no longer injects `TXLINE_DELIVERY_MODE` into `seller-rogue`, because rogue uses
  `DELIVER_MODE=none` instead.

Important files:

- `solana_coralOS-main/examples/marketplace/start.ts`
- `solana_coralOS-main/examples/marketplace/README.md`
- `solana_coralOS-main/coral-agents/buyer-agent/README.md`
- `solana_coralOS-main/coral-agents/challenger-agent/README.md`
- `solana_coralOS-main/coral-agents/seller-agent/README.md`
- `solana_coralOS-main/coral-agents/arbiter-agent/README.md`
- `solana_coralOS-main/CHECKPOINT_L1.md`

## Local Verification Run

All passed:

```sh
cd solana_coralOS-main/packages/agent-runtime
npm test
npm run typecheck
npm run build
# 48 tests passed

cd solana_coralOS-main/coral-agents/challenger-agent
npm test
npm run typecheck
# 4 tests passed

cd solana_coralOS-main/coral-agents/buyer-agent
npm test
npm run typecheck
# 23 tests passed

cd solana_coralOS-main/coral-agents/arbiter-agent
npm test
npm run typecheck
# 3 tests passed

cd solana_coralOS-main/coral-agents/seller-agent
npm test
npm run typecheck
# 19 tests passed

cd solana_coralOS-main/examples/marketplace/feed
npm test
npm run typecheck
# 15 tests passed

cd solana_coralOS-main/examples/marketplace/web
npm test
npm run typecheck
# 13 tests passed

cd solana_coralOS-main/examples/marketplace
npm run typecheck

node --check scripts/setup.js
bash -n build-agents.sh
git diff --check
```

Notes:

- The first post-audit buyer-agent Vitest run passed its assertions, then hit a transient Node/V8
  teardown crash. An immediate clean rerun passed all 23 tests.
- Test output still includes `bigint-buffer` falling back to pure JS. Tests passed.
- npm/Docker installs still report existing dependency audit warnings. No audit remediation was
  attempted in this checkpoint.

## Live Demo Validation

### Wallets

- Buyer: `6S2d9aoUwtfdvgbpiDmE63Ua9rMaDaGwT5DgxwiSK8mD`
- Seller: `3XcNKLx9MMqxPqZBuKgKAdwQyrdHKLoMwWRJotrNK4Kv`
- Arbiter / bond holder: `45L93oJJ6JEr3mw1osLqjXEJmHeVdXQ4CQauSaEnFBJH`

### Live Prereqs Completed

- Buyer balance checked at `1 SOL`.
- Seller funded with `0.01 SOL`:
  `2sfDs5BUtvewVLJJp1p1E8J4xNDMHp8f8fwSavEe9wzJmv4VxHaanH6qrB1Xyw1zjFpHd33K5HZpP7Pz3ehh8CCh`
- Arbiter funded with `0.01 SOL`:
  `67F8T2x4enxKbxinLSaw6i3rdAbpjc8FUEnP58d8Xmt4CGW4u5ezv6AW8GWqqWoCiA1jYyQzUGHcG7EY4cAywJuC`
- `examples/txodds npm run mint` succeeded and wrote `TXLINE_API_KEY`.
- `bash build-agents.sh` rebuilt:
  - `seller-agent:0.1.0`
  - `buyer-agent:0.1.0`
  - `arbiter-agent:0.1.0`
- `docker compose up -d coral` started CoralOS.

### Session 1: Honest Direct Release

Command shape:

```sh
cd solana_coralOS-main/examples/marketplace
SETTLEMENT_MODE=direct CHALLENGE_WINDOW_MS=2000 npm start
```

Session:

```text
2f85e748-fb20-4144-8b5a-3e0b8c6659c7
```

Observed:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> VERIFIED -> challenge window timeout -> RELEASED
```

Evidence:

- `DEPOSITED`:
  `4oaLCCfFXEv3mbNPKFYGXwRxFfhLHMWTmCHc2xv4zLCH3oFxP25BmyajKkuY9JqQp4rCvMTRSaBxjpw22eCsXZmS`
- `BOND_POSTED`:
  `5piPdTnsG1JCPKFk66K8BxG53UAwZ3T6baJKw1Lh5ST8ApQee3ekWZyDeNP9UtbbYNFaQZgMDSW8CHKxEV9Fjdv8`
- `VERIFIED round=1 ok=1 code=txline_fixtures_match`
- `RELEASED`:
  `4H1VQMAnBC68FQazDkEMYA3Do9qrDwEmPMenEyvwFBfnuPtV6ufsD7HYRbRHTVewkaMmArU9TJ7nvo1STWD9HevR`

Explorer:

- `https://explorer.solana.com/tx/5piPdTnsG1JCPKFk66K8BxG53UAwZ3T6baJKw1Lh5ST8ApQee3ekWZyDeNP9UtbbYNFaQZgMDSW8CHKxEV9Fjdv8?cluster=devnet`
- `https://explorer.solana.com/tx/4H1VQMAnBC68FQazDkEMYA3Do9qrDwEmPMenEyvwFBfnuPtV6ufsD7HYRbRHTVewkaMmArU9TJ7nvo1STWD9HevR?cluster=devnet`

### Session 2: Rogue No-Delivery Refund

Command shape:

```sh
cd solana_coralOS-main/examples/marketplace
SETTLEMENT_MODE=direct MARKET_SELLERS=seller-rogue CHALLENGE_WINDOW_MS=2000 npm start
```

Session:

```text
410803a5-c425-4259-87ff-e541a7d910cf
```

Observed:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED
  -> seller-rogue DELIVER_MODE=none -> REFUNDED after escrow deadline
```

Evidence:

- `DEPOSITED`:
  `ZCRwxjmHHZyDFw2cHKhDFAsmrkm7xLVnmmnjBVdTyTDGVgarnAqyuGND323J3dB81TDPnc5GTsjyyRH5Un95Kea`
- `BOND_POSTED`:
  `kwddsjdnvvVmBv78WRSfCFNHMN2U9am6qqwsNwcTMY3h1qia625KqesQQVGEQVbf1ikp7QJuFx9Dp3wJw6jod1E`
- `REFUNDED`:
  `5qQWnnQ5rsSt53pzDrJ8aMo7fS8DxugjjovCB77YzpFewTEEboFL7eN2FUMX4tbeFs74ZduQiCrfgZTPBsktm83j`

Explorer:

- `https://explorer.solana.com/tx/kwddsjdnvvVmBv78WRSfCFNHMN2U9am6qqwsNwcTMY3h1qia625KqesQQVGEQVbf1ikp7QJuFx9Dp3wJw6jod1E?cluster=devnet`
- `https://explorer.solana.com/tx/5qQWnnQ5rsSt53pzDrJ8aMo7fS8DxugjjovCB77YzpFewTEEboFL7eN2FUMX4tbeFs74ZduQiCrfgZTPBsktm83j?cluster=devnet`

### Session 3: Bad-Data Arbiter Challenge + Slash

Command shape:

```sh
cd solana_coralOS-main/examples/marketplace
ARBITER_AGENT_ENABLED=1 DEMO_FAIL_VERIFICATION=1 TXLINE_DELIVERY_MODE=bad_count CHALLENGE_WINDOW_MS=2000 npm start
```

Session:

```text
11bde463-9eb7-45cd-b391-d248a6c6128f
```

Observed:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED_BAD
  -> CHALLENGE_OPENED -> ARBITER_REVIEW -> ARBITER_REJECTED
  -> CHALLENGE_UPHELD -> ARBITER_SLASHED bond=seller
```

This live session predates `challenger-agent`; challenge opening was still the earlier buyer-owned
path. It proves live seller-bond slashing on bad data, but it does not prove the newer full four-role
buyer/seller/challenger/arbiter path.

Evidence:

- `DEPOSITED`:
  `4kSbdhK8EpTWJcekXNrZ4yjBZR9F5stLcvZ86NiaTopDSLuWdVcyaRTpuKCHGLehB5wUCe6HUcw8c4zdQeA1nUfy`
- `BOND_POSTED`:
  `jXYpoBvkx7RZpVMXzEN8rFMaXH594BWXJb1Rrdp2zuWEaPaCEENDgqm4AQf5Sk6eV1wuw23tXDWXwiqpK6u5oaM`
- `CHALLENGE_OPENED reason="delivered count 13 != re-exec count 12"`
- `ARBITER_REJECTED code=txline_count_mismatch`
- `CHALLENGE_UPHELD code=txline_count_mismatch`
- `ARBITER_SLASHED`:
  `3Uc2XDsvvvtt7jueKxQaG4CLTa5i446tDaBsuco1qM5vdXafooqWNj5VsJfsFsSYGnP7rTvhpyG2cPYexki9pQmc`

Explorer:

- `https://explorer.solana.com/tx/jXYpoBvkx7RZpVMXzEN8rFMaXH594BWXJb1Rrdp2zuWEaPaCEENDgqm4AQf5Sk6eV1wuw23tXDWXwiqpK6u5oaM?cluster=devnet`
- `https://explorer.solana.com/tx/3Uc2XDsvvvtt7jueKxQaG4CLTa5i446tDaBsuco1qM5vdXafooqWNj5VsJfsFsSYGnP7rTvhpyG2cPYexki9pQmc?cluster=devnet`

## Post-Audit L1 Completion

After the July 4 live-validation pass, a stricter L1 audit found one gap: the protocol could represent
`CHALLENGE_OPENED by=<agent>`, but the runtime did not yet include a separate challenger agent with its
own bond. That gap is now implemented in code.

Added:

- `coral-agents/challenger-agent`: a separate CoralOS participant that receives `CHALLENGE_REVIEW`,
  independently re-executes the objective TxLINE predicate, posts `CHALLENGER_BOND_SOL`, and emits
  `CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>` only on mismatch.
- Runtime protocol support for `CHALLENGE_REVIEW`, challenger wallet propagation, and
  `ARBITER_SLASHED bond=seller|challenger` so the proof identifies which loser bond moved.
- Buyer wiring for `CHALLENGER_AGENT_ENABLED=1`: the buyer invites challenger-agent into the market
  thread, sends delivery evidence during the optimistic window, waits for a separate challenge, and
  passes the challenger wallet to the arbiter.
- Arbiter wiring for two-sided loser-bond slashing:
  - upheld challenge: seller bond moves to challenger / buyer side
  - rejected challenge: challenger bond moves to seller
- Launcher/setup/build/docs support for `CHALLENGER_KEYPAIR_B58`, `CHALLENGER_BOND_SOL`, and
  `challenger-agent:0.1.0`.

Strict L1 code path now matches:

```text
WANT -> BID -> AWARD -> DEPOSITED -> BOND_POSTED -> DELIVERED
  -> CHALLENGE_REVIEW
  -> CHALLENGE_OPENED by=challenger-agent challenger=<wallet> bondSig=<tx>
  -> ARBITER_REVIEW -> CHALLENGE_UPHELD / CHALLENGE_REJECTED
  -> ARBITER_SLASHED bond=seller|challenger
```

This post-audit addition is locally tested/typechecked but not yet live-revalidated. The earlier live
devnet slash proof remains valid for `bond=seller`; a fresh live run with a checkout-owned
`ARBITER_PROGRAM_ID` is still needed before claiming live honest `ARBITER_RELEASED` or the full
buyer/seller/challenger/arbiter path. No live devnet run or arbiter program/config change is claimed
for the post-audit challenger work.

## Known Limitations / Honest Tradeoffs

- Honest `ARBITER_RELEASED` was blocked by the public deployed arbiter program's global config:
  - deployed program expects arbiter `Ay2GqHyukwso14RLZWRPhnFMovGGPpVcBzZcnceEiG4Z`
  - this checkout's generated arbiter is `45L93oJJ6JEr3mw1osLqjXEJmHeVdXQ4CQauSaEnFBJH`
  - live arbiter-release attempt failed with `NotArbiter`
- Fix added after this checkpoint: arbiter clients now honor `ARBITER_PROGRAM_ID`, and buyer /
  arbiter-agent preflight the wrapper `Config` account before opening or signing an arbiter-settled
  round. Use a checkout-owned deployment initialized to `45L93o...` for live honest
  `ARBITER_RELEASED`; the squatted public deployment now fails early with a clear configured-vs-local
  arbiter error instead of failing late at release.
- Direct honest release and arbiter bad-data slash were live-validated.
- The slash is transfer-backed, not a custom Anchor slashing instruction.
- Reputation PDA is not implemented yet.
- Egress PEP / prevent layer is not implemented yet.
- `jupiter_quote` remains a future service/verifier pair.
- The current arbiter-agent is a trusted-neutral verifier, not decentralized consensus.

## Runtime State After Validation

- Demo agent containers were stopped after validation to avoid more devnet spend.
- The `coral` container was left running.
- `TXLINE_API_KEY` is now present in `solana_coralOS-main/.env`.
- `CHECKPOINT_L1.md` inside `solana_coralOS-main/` also contains the focused L1 live-validation
  evidence.

## Next Suggested Work

1. For final demo/video, use the three live-validated paths above as historical proof beats:
   - honest direct release
   - rogue no-delivery refund
   - bad-data seller-bond slash
2. Run a fresh full strict L1 live revalidation once this checkout has an arbiter config whose
   `ARBITER_PROGRAM_ID` is initialized to the checkout arbiter key:
   - seller bond
   - challenger bond
   - challenger-owned `CHALLENGE_OPENED`
   - upheld challenge slashing `bond=seller`
   - rejected challenge slashing `bond=challenger`
3. Decide whether to leave the transfer-backed slash as the hackathon implementation or invest in a
   small Anchor slashing extension.
4. If `ARBITER_RELEASED` must be shown live, use/deploy an arbiter config controlled by this checkout's
   arbiter key instead of the globally configured deployed arbiter.
5. Add L2 `Prevent + Optimistic-Verify` framing only if time remains:
   - egress allowlist
   - budget/velocity checks
   - replay nonce / audit log
6. Add L3 reputation PDA after the L1 proof slide/video is locked.
