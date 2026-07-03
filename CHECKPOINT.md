# CHECKPOINT — Verify-Then-Pay Slice

Date: 2026-07-03

Repo: `https://github.com/LS2422/accountable-agent-market.git`
Branch: `codex/verify-then-pay`

## Summary

This branch implements the first verify-then-pay slice for the current TxODDS/TxLINE marketplace flow.
Before this work, the buyer released escrow immediately after seeing `DELIVERED`. Now the buyer re-executes
the objective TxLINE read, emits `VERIFIED` or `VERIFICATION_FAILED`, and releases escrow only when
verification passes.

This is intentionally scoped to the current hero service, `txline`. It does not yet implement the later
watcher/challenger, slashing, reputation PDA, or own-arbiter deployment phases.

## New Behavior Built

- Added market protocol messages:
  - `DELIVERED round=<n> <json>`
  - `VERIFIED round=<n> ok=1 code=<code> reason="<why>"`
  - `VERIFICATION_FAILED round=<n> ok=0 code=<code> reason="<why>"`
- Added buyer-side objective re-execution verifier:
  - File: `solana_coralOS-main/coral-agents/buyer-agent/src/verify.ts`
  - Tests: `solana_coralOS-main/coral-agents/buyer-agent/src/verify.test.ts`
  - Supports TxLINE `fixtures`, `odds <fixtureId>`, and `edge <fixtureId>` verification.
- Changed buyer release flow:
  - File: `solana_coralOS-main/coral-agents/buyer-agent/src/index.ts`
  - Buyer waits for `DELIVERED`, runs `verifyDelivery`, emits verification result, and only calls
    `release` / `arbitrateRelease` if `ok=true`.
  - Failed verification leaves funds in escrow for the existing refund-after-deadline path.
- Changed seller delivery formatting:
  - File: `solana_coralOS-main/coral-agents/seller-agent/src/index.ts`
  - Seller now uses the shared `formatDelivered` protocol helper.
- Updated dashboard/feed:
  - Feed folds `VERIFIED` into status `verified`.
  - Feed folds `VERIFICATION_FAILED` into status `verification_failed`.
  - Dashboard shows a compact verification line and status pill before release.
- Updated docs:
  - `README.md`
  - `DEMO.md`
  - `PLAN.md`
  - `solana_coralOS-main/examples/marketplace/README.md`
  - `solana_coralOS-main/coral-agents/buyer-agent/README.md`

## Important Files Changed

- Protocol:
  - `solana_coralOS-main/packages/agent-runtime/src/market/protocol.ts`
  - `solana_coralOS-main/packages/agent-runtime/src/market/index.ts`
  - `solana_coralOS-main/packages/agent-runtime/src/market/protocol.test.ts`
  - `solana_coralOS-main/packages/agent-runtime/src/market/round.e2e.test.ts`
- Buyer:
  - `solana_coralOS-main/coral-agents/buyer-agent/src/index.ts`
  - `solana_coralOS-main/coral-agents/buyer-agent/src/verify.ts`
  - `solana_coralOS-main/coral-agents/buyer-agent/src/verify.test.ts`
- Seller:
  - `solana_coralOS-main/coral-agents/seller-agent/src/index.ts`
- Feed/dashboard:
  - `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.ts`
  - `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.test.ts`
  - `solana_coralOS-main/examples/marketplace/web/src/types.ts`
  - `solana_coralOS-main/examples/marketplace/web/src/components/RoundCard.tsx`
  - `solana_coralOS-main/examples/marketplace/web/src/components/StatusPill.tsx`
  - `solana_coralOS-main/examples/marketplace/web/src/styles.css`
  - `solana_coralOS-main/examples/marketplace/web/tests/fixtures.ts`
  - `solana_coralOS-main/examples/marketplace/web/package.json`

## Checks Run

All of these passed:

```sh
cd solana_coralOS-main/packages/agent-runtime
npm test
# 41 tests passed

cd solana_coralOS-main/coral-agents/buyer-agent
npm test
npm run typecheck
# 17 tests passed

cd solana_coralOS-main/coral-agents/seller-agent
npm test
npm run typecheck
# 16 tests passed

cd solana_coralOS-main/examples/marketplace/feed
npm test
npm run typecheck
# 11 tests passed

cd solana_coralOS-main/examples/marketplace/web
npm test
npm run typecheck
# 6 tests passed

cd solana_coralOS-main/examples/marketplace
npm run typecheck

git diff --check
```

Notes:

- `marketplace/web` needed `@types/node` because its `tsconfig.json` already referenced Node types.
  This was added to `solana_coralOS-main/examples/marketplace/web/package.json`.
- Several `npm install --ignore-scripts` commands reported existing audit warnings in dependencies.
  No dependency audit fixes were attempted in this feature slice.
- Some test output included `bigint-buffer` falling back to pure JS. Tests still passed.

## Current Limits

- Live Docker/devnet settlement was not run in this checkpoint.
- Verification is implemented for the TxLINE objective data path only.
- The buyer still uses one LLM judgment over price and bid notes for winner selection.
- Watcher/challenger flow is not implemented yet.
- Slashing is not implemented yet.
- Reputation PDA is not implemented yet.
- Own arbiter deployment is not implemented yet.
- `jupiter_quote` remains a future service/verifier pair.

## Next Suggested Slice

The next high-value slice is either:

1. Add a scripted failed-verification demo path so the dashboard can visibly show `VERIFICATION_FAILED`
   without relying on a live bad seller, or
2. Add the `jupiter_quote` service plus its objective re-exec verifier, matching the PLAN roadmap.

## Follow-Up Slice Built

The scripted failed-verification path has now been added:

- `TXLINE_DELIVERY_MODE=bad_count` makes a seller return a TxLINE fixtures payload with the wrong
  `count`, so buyer-side re-exec emits `VERIFICATION_FAILED`.
- `DEMO_FAIL_VERIFICATION=1` in `examples/marketplace` launches a deterministic one-seller session
  using that bad delivery mode, so the demo does not rely on the LLM selecting a cheater.
- The default market remains unchanged unless `DEMO_FAIL_VERIFICATION=1` is set.

## Arbiter-Agent Slice Built

The opt-in third-party arbiter flow has now been added:

- `ARBITER_AGENT_ENABLED=1` adds `arbiter-agent` to the marketplace session graph and market thread.
- Buyer sends `ARBITER_REVIEW` after delivery instead of releasing itself.
- `arbiter-agent` re-executes the same shared TxLINE verifier, emits `ARBITER_VERIFIED` or
  `ARBITER_REJECTED`, and signs `ARBITER_RELEASED` on success.
- `ARBITER_REFUND_ON_REJECT=1` makes the arbiter attempt `ARBITER_REFUNDED` after rejection; the escrow
  deadline still applies.
- Watcher/challenger remains future work; this slice moves judgment from buyer-owned verification to a
  neutral arbiter agent in the CoralOS thread.
