# Accountable Agent Market Progress

Last updated: 2026-07-03

## Workspace Context

Repository/workspace root:

```text
/Users/yiyangshen/Documents/UK AI Hackathon e.p.5
```

Important project inputs present in the workspace:

- `PROPOSAL.md`
- `coral-knowledge/`
- `solana_coralOS-main/`

The active prototype work is in `solana_coralOS-main/`.

## Architecture Inspection Notes

Key implementation locations identified:

- Buyer agent: `solana_coralOS-main/coral-agents/buyer-agent/src/index.ts`
- Seller agent: `solana_coralOS-main/coral-agents/seller-agent/src/index.ts`
- Seller service delivery: `solana_coralOS-main/coral-agents/seller-agent/src/service.ts`
- Seller bidding logic: `solana_coralOS-main/coral-agents/seller-agent/src/bidder.ts`
- CoralOS market protocol messages: `solana_coralOS-main/packages/agent-runtime/src/market/protocol.ts`
- Buyer escrow client: `solana_coralOS-main/coral-agents/buyer-agent/src/escrow.ts`
- Seller escrow reads/checks: `solana_coralOS-main/coral-agents/seller-agent/src/escrow.ts`
- Buyer arbiter client: `solana_coralOS-main/coral-agents/buyer-agent/src/arbiter.ts`
- Solana escrow program: `solana_coralOS-main/examples/txodds/escrow/programs/escrow/src/lib.rs`
- Solana arbiter program: `solana_coralOS-main/examples/txodds/escrow/programs/arbiter/src/lib.rs`
- Marketplace launcher: `solana_coralOS-main/examples/marketplace/start.ts`
- Marketplace feed folding: `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.ts`
- Dashboard round UI: `solana_coralOS-main/examples/marketplace/web/src/components/RoundCard.tsx`

Current product state from inspection:

- Buyer, seller, bidding, TxODDS/TxLINE delivery, CoralOS message parsing, escrow clients, Solana escrow/arbiter programs, and dashboard components exist.
- Active seller service delivery is TxODDS/TxLINE.
- `deliverService()` does not implement Jupiter quote delivery in the active path yet.
- Watcher/challenger, verification adapter, Solana slashing, and reputation are not yet implemented in the active market path.
- Buyer can emit `ARBITER_RELEASED` when arbiter settlement releases funds.

## Recent Changes Made

### Dashboard Feed Folding

Updated marketplace dashboard feed folding so `ARBITER_RELEASED` is treated as a settled/released state equivalent to `RELEASED` for dashboard state folding.

Changed file:

- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.ts`

The protocol semantics were not changed. The wire protocol parser remains untouched; only the dashboard/feed folding recognizes the additional already-emitted message type.

### Feed Folding Test

Added a focused test proving that an `ARBITER_RELEASED` feed message:

- extracts the release signature
- marks the round as `settled`
- does not require changing protocol semantics

Changed file:

- `solana_coralOS-main/examples/marketplace/feed/src/foldRounds.test.ts`

### Marketplace Seller Personas

Verified that `examples/marketplace/start.ts` launched `seller-cheap` and `seller-premium`, but corresponding manifest/config folders were missing.

Created minimal valid persona manifests using the existing `seller-agent:0.1.0` image/code path:

- `solana_coralOS-main/coral-agents/seller-cheap/coral-agent.toml`
- `solana_coralOS-main/coral-agents/seller-honest/coral-agent.toml`
- `solana_coralOS-main/coral-agents/seller-premium/coral-agent.toml`

Persona defaults:

- `CheapSeller`: low-price, volume-seeking TxODDS seller
- `HonestSeller`: fair-price, reliable TxODDS seller
- `PremiumSeller`: higher-price, high-confidence TxODDS seller

All three keep TxODDS/TxLINE as the hero service via:

```text
SERVICES=txline
SERVICE=txline
```

### Marketplace Launcher

Updated marketplace startup to use the three explicit seller personas:

- `seller-cheap`
- `seller-honest`
- `seller-premium`

Changed file:

- `solana_coralOS-main/examples/marketplace/start.ts`

This removes reliance on missing `seller-cheap` and `seller-premium` folders and keeps the seller roster aligned with real manifests.

### Dashboard and Fixture Alignment

Updated marketplace feed/dashboard defaults and tests from the older `seller-lazy`/`seller-worldcup` marketplace mix to the explicit marketplace personas where appropriate.

Changed files:

- `solana_coralOS-main/examples/marketplace/feed/src/server.ts`
- `solana_coralOS-main/examples/marketplace/web/tests/fixtures.ts`
- `solana_coralOS-main/examples/marketplace/web/tests/market.spec.ts`
- `solana_coralOS-main/examples/marketplace/web/src/components/RoundCard.test.tsx`
- `solana_coralOS-main/examples/marketplace/README.md`
- `solana_coralOS-main/coral-agents/README.md`

Intentional remaining old names:

- `seller-worldcup` remains documented as a TxODDS single-round specialist/example agent.
- Some recorded feed/session fixtures still include older seller names because they represent historical captured transcripts and are not the active marketplace roster.

## Verification Performed

### TOML Manifest Validation

Parsed all three new persona manifests with Python `tomllib`.

Validated:

- `seller-cheap ok`
- `seller-honest ok`
- `seller-premium ok`

### Test Attempt

Tried to run marketplace feed tests.

Result:

- Shell did not have `npm` on `PATH`.
- Bundled `pnpm` could download packages only with escalated network access.
- The ad hoc package install hit pnpm ignored-build-script policy.
- Direct Vitest invocation started, but failed collection because local package `@pay/agent-runtime` resolves to `dist/index.js`, and that local workspace package was not built in the ad hoc install.

Generated dependency artifacts from test attempts were cleaned up afterward.

Manual verification path once workspace dependencies are installed/built normally:

```sh
cd solana_coralOS-main/examples/marketplace/feed
npm test
```

or:

```sh
cd solana_coralOS-main/examples/marketplace/feed
pnpm run test
```

If tests still cannot resolve `@pay/agent-runtime`, build the root workspace/package first.

## Git State Note

From the workspace root, `solana_coralOS-main/` appears as an untracked directory in the parent git repository, so ordinary git diff from the parent does not show file-level changes inside it.

Observed parent-root status included:

```text
?? .DS_Store
?? PROPOSAL.md
?? coral-knowledge/
?? solana_coralOS-main/
```

## Phased Implementation Plan

### Phase 0: L0 Baseline Market

- Keep TxODDS/TxLINE as the hero service.
- Ensure buyer posts requests, sellers bid, buyer selects a bid, seller delivers, and buyer releases payment.
- Keep dashboard timeline accurate for `REQUESTED`, `BID`, `ACCEPTED`, `DELIVERED`, `RELEASED`, and `ARBITER_RELEASED`.
- Confirm marketplace start script and persona manifests launch cleanly.

### Phase 1: `jupiter_quote` `deliverService()`

- Add `jupiter_quote` as a second service behind the existing seller-agent delivery path.
- Preserve TxODDS/TxLINE as the demo default.
- Return structured quote payloads with enough fields for verification.
- Add service-level tests for both supported and unsupported services.

### Phase 2: Seller Personas

- Expand persona behavior beyond static env defaults.
- Tune bid pricing, latency, confidence, and delivery style per seller.
- Expose persona metadata to dashboard and feed.
- Keep all personas on the existing seller-agent image unless behavior needs separate runtime code.

### Phase 3: Buyer Risk-Adjusted Selection

- Replace cheapest-only or naive bid selection with a score using:
  - bid price
  - seller confidence
  - delivery latency
  - reputation
  - historical dispute/slash rate
- Emit transparent buyer selection rationale into CoralOS messages.
- Surface selection rationale in the dashboard timeline.

### Phase 4: Verification Adapter

- Add a verifier interface that can validate service outputs.
- Implement TxODDS/TxLINE verification first.
- Add Jupiter quote verification second.
- Store verification result, evidence, and confidence in structured messages.

### Phase 5: Watcher/Challenger

- Add an off-chain watcher that observes deliveries and verifier outputs.
- Add challenger behavior for invalid, stale, or malformed delivery.
- Emit challenge messages into the market feed.
- Keep challenge logic deterministic and evidence-backed for the demo.

### Phase 6: Arbiter Agent

- Add an arbiter agent that consumes dispute/challenge evidence.
- Decide release/refund/slash recommendations.
- Emit arbitration rationale into CoralOS messages.
- Connect decisions to the existing arbiter settlement client.

### Phase 7: Solana Arbitration and Slashing

- Extend or integrate Solana arbitration flow for slashing.
- Define slashable conditions clearly.
- Add tests for release, refund, challenge, and slash flows.
- Keep protocol semantics explicit and backwards compatible where possible.

### Phase 8: Reputation

- Maintain seller reputation from completed rounds, verified deliveries, challenges, arbitration outcomes, latency, and slashing.
- Feed reputation into buyer risk-adjusted selection.
- Display reputation in the dashboard.
- Keep reputation explainable rather than opaque.

### Phase 9: Dashboard Timeline

- Expand the timeline to include:
  - buyer selection rationale
  - verification result
  - watcher/challenger events
  - arbiter decision
  - Solana settlement/slashing signatures
  - reputation deltas
- Ensure folded feed state handles all terminal states consistently.
- Add dashboard tests for arbitration and challenge timelines.

## Potential Next Checks

- Build `packages/agent-runtime` and rerun feed tests from a clean dependency install.
- Verify marketplace launch end-to-end with `seller-cheap`, `seller-honest`, and `seller-premium`.
- Check whether `ARBITER_KEYPAIR_B58` is forwarded correctly in marketplace arbiter settlement mode.
- Confirm dashboard timeline rendering for an actual `ARBITER_RELEASED` transcript.
