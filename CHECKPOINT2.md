# CHECKPOINT2 - Failed Verification + Arbiter-Agent Flow

Date: 2026-07-03

Repo working tree: `accountable-agent-market/solana_coralOS-main`
Branch observed: `codex/verify-then-pay`

## Summary

Since `CHECKPOINT.md`, two follow-up slices have been built on top of the verify-then-pay/objective
re-exec work:

1. A deterministic scripted failed-verification demo path.
2. An opt-in third-party `arbiter-agent` flow that moves objective verification and arbiter release
   out of the buyer and into a neutral CoralOS agent.

The default marketplace path remains compatible with the prior buyer-owned verify-then-pay flow. The
new arbiter-agent path is enabled with `ARBITER_AGENT_ENABLED=1`.

## What Is Built Now

### 1. Verify-Then-Pay / Objective Re-Exec

The buyer no longer releases escrow immediately after `DELIVERED`. It verifies the TxLINE delivery
first and releases only when verification passes.

Current protocol messages include:

```text
DELIVERED round=<n> <json>
VERIFIED round=<n> ok=1 code=<code> reason="<why>"
VERIFICATION_FAILED round=<n> ok=0 code=<code> reason="<why>"
```

The TxLINE verifier supports:

- `fixtures`
- `odds <fixtureId>`
- `edge <fixtureId>`

Important files:

- `solana_coralOS-main/packages/agent-runtime/src/market/verify.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/verify.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/index.ts`
- `solana_coralOS-main/packages/agent-runtime/src/market/protocol.ts`

Note: the verifier was moved into the shared runtime so both buyer and `arbiter-agent` can use the
same objective predicate. The buyer-local `verify.ts` is now a compatibility re-export.

### 2. Scripted Failed-Verification Demo Path

Added a deterministic way to make a seller deliver bad TxLINE evidence so the dashboard can visibly
show `VERIFICATION_FAILED`.

How it works:

- `TXLINE_DELIVERY_MODE=bad_count` makes a seller report a wrong fixture count.
- `TXLINE_DELIVERY_MODE=invalid_json` makes a seller return non-JSON delivery.
- `DEMO_FAIL_VERIFICATION=1` launches a one-seller demo session so the bad seller is always selected.

Run:

```sh
cd solana_coralOS-main/examples/marketplace
DEMO_FAIL_VERIFICATION=1 npm start
```

Expected transcript shape:

```text
WANT -> BID -> AWARD -> DEPOSITED -> DELIVERED -> VERIFICATION_FAILED
```

Important files:

- `solana_coralOS-main/coral-agents/seller-agent/src/service.ts`
- `solana_coralOS-main/coral-agents/seller-agent/src/service.test.ts`
- `solana_coralOS-main/examples/marketplace/start.ts`
- `solana_coralOS-main/examples/marketplace/feed/src/server.ts`
- `solana_coralOS-main/examples/marketplace/README.md`

### 3. Arbiter-Agent Flow

Added a new `arbiter-agent` package and protocol flow. This is opt-in and does not replace the
default buyer-owned verification path unless enabled.

New arbiter protocol messages:

```text
ARBITER_REVIEW round=<n> service=<name> arg="<arg>" reference=<R> seller=<addr> payer=<addr> delivery=<json>
ARBITER_VERIFIED round=<n> ok=1 code=<code> reason="<why>"
ARBITER_REJECTED round=<n> ok=0 code=<code> reason="<why>"
ARBITER_RELEASED round=<n> sig=<sig> settlement=arbiter
ARBITER_REFUNDED round=<n> sig=<sig> settlement=arbiter
```

Happy path:

```text
DELIVERED -> ARBITER_REVIEW -> ARBITER_VERIFIED -> ARBITER_RELEASED
```

Rejected path:

```text
DELIVERED -> ARBITER_REVIEW -> ARBITER_REJECTED
```

Optional refund attempt:

```sh
ARBITER_AGENT_ENABLED=1 ARBITER_REFUND_ON_REJECT=1 npm start
```

Important caveat: `arbitrate_refund` still obeys the escrow deadline. `ARBITER_REJECTED` is immediate;
`ARBITER_REFUNDED` may fail until the refund deadline is reached.

Run:

```sh
cd solana_coralOS-main/examples/marketplace
ARBITER_AGENT_ENABLED=1 npm start
```

Important files:

- `solana_coralOS-main/coral-agents/arbiter-agent/`
- `solana_coralOS-main/coral-agents/arbiter-agent/src/index.ts`
- `solana_coralOS-main/coral-agents/arbiter-agent/src/decision.ts`
- `solana_coralOS-main/coral-agents/arbiter-agent/src/settlement.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/index.ts`
- `solana_coralOS-main/examples/marketplace/start.ts`
- `solana_coralOS-main/packages/agent-runtime/src/market/protocol.ts`
- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.ts`

### 4. Feed / Dashboard Folding

The feed now folds these states:

- `VERIFIED` -> `verified`
- `VERIFICATION_FAILED` -> `verification_failed`
- `ARBITER_VERIFIED` -> `verified`
- `ARBITER_REJECTED` -> `verification_failed`
- `ARBITER_RELEASED` -> `settled`
- `ARBITER_REFUNDED` -> `refunded`

Important files:

- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.ts`
- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.test.ts`
- `solana_coralOS-main/examples/marketplace/web/src/types.ts`
- `solana_coralOS-main/examples/marketplace/web/src/components/RoundCard.tsx`
- `solana_coralOS-main/examples/marketplace/web/src/components/StatusPill.tsx`

## Checks Run

These passed during the latest work:

```sh
cd solana_coralOS-main/packages/agent-runtime
npm run build
npm test
# 43 tests passed

cd solana_coralOS-main/coral-agents/arbiter-agent
npm test
npm run typecheck
# 2 tests passed

cd solana_coralOS-main/coral-agents/buyer-agent
npm test
npm run typecheck
# 17 tests passed

cd solana_coralOS-main/coral-agents/seller-agent
npm test
npm run typecheck
# 17 tests passed

cd solana_coralOS-main/examples/marketplace/feed
npm test
npm run typecheck
# 13 tests passed

cd solana_coralOS-main/examples/marketplace
npm run typecheck

git diff --check
```

Previously reported verify-then-pay checks also included:

```sh
cd solana_coralOS-main/examples/marketplace/web
npm test
npm run typecheck
# 6 tests passed
```

Note: `marketplace/web` was not rerun after the arbiter-agent slice because the latest arbiter-agent
work changed feed folding and backend/session wiring, not React component behavior beyond already
tested status handling.

## Not Tested

The following have not been live-verified in this checkpoint:

- No live Docker/CoralOS session was run for `DEMO_FAIL_VERIFICATION=1`.
- No live Docker/CoralOS session was run for `ARBITER_AGENT_ENABLED=1`.
- No live devnet transaction was created by `arbiter-agent`.
- `ARBITER_REFUND_ON_REJECT=1` was not live-tested against the escrow deadline.
- `bash build-agents.sh` / Docker image build was not run after adding `arbiter-agent`.
- No live dashboard/browser run was performed after the arbiter-agent slice.
- No full repo-wide test command was run; checks were package-focused.

Dependency notes:

- `npm install --ignore-scripts --install-links` needed network approval for refreshed local package
  installs.
- npm reported existing audit warnings in dependencies.
- No `npm audit fix` or dependency remediation was attempted.
- Test output includes `bigint-buffer` falling back to pure JS. Tests still passed.

## Current Limits

- Verification is still TxLINE-only.
- `jupiter_quote` remains a future service/verifier pair.
- Watcher/challenger is not implemented.
- On-chain slashing is not implemented.
- Reputation PDA is not implemented.
- Own arbiter program deployment is not implemented; current code uses the existing deployed arbiter
  wrapper and its global config constraints still matter.
- `arbiter-agent` is a trusted-neutral verifier, not decentralized consensus.
- Buyer selection is still one LLM judgment over price and bid notes, with deterministic fallback.

## Suggested Next Steps

### Immediate Demo Validation

1. Build all agent images:

```sh
cd solana_coralOS-main
bash build-agents.sh
```

2. Run the scripted failed-verification demo:

```sh
cd examples/marketplace
DEMO_FAIL_VERIFICATION=1 npm start
```

3. Run the arbiter-agent happy path:

```sh
cd examples/marketplace
ARBITER_AGENT_ENABLED=1 npm start
```

4. Start feed/dashboard for both runs and capture:

- session id
- transcript screenshot
- deposit tx
- release tx for happy path
- no-release evidence for failed path

### Product / Architecture Next

1. Add a combined demo mode: `ARBITER_AGENT_ENABLED=1 DEMO_FAIL_VERIFICATION=1`, so the neutral arbiter
   visibly emits `ARBITER_REJECTED` for a scripted bad seller.
2. Add dashboard labels that distinguish buyer verification from arbiter verification, instead of both
   folding into the same `verified` / `verification_failed` presentation.
3. Add a small live-run checklist or script that prints the exact commands for:
   - happy buyer-owned verify-then-pay
   - scripted failed verification
   - arbiter-agent happy path
   - arbiter-agent rejection path
4. Add `jupiter_quote` only after the TxLINE demo paths have been recorded cleanly.
5. After the demo is stable, decide whether Phase 7 should be:
   - real Anchor slashing extension, or
   - demo-scope arbiter refund + reputation penalty.

## Git State Notes

At the time this checkpoint was written, the working tree still had many unstaged changes from the
verify-then-pay, failed-verification, and arbiter-agent slices.

Important untracked paths include:

- `solana_coralOS-main/coral-agents/arbiter-agent/`
- `solana_coralOS-main/packages/agent-runtime/src/market/verify.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/verify.ts`
- `solana_coralOS-main/coral-agents/buyer-agent/src/verify.test.ts`
- `CHECKPOINT.md`
- `CHECKPOINT2.md`

Before committing or handing off, review `git status --short` and stage intentionally.
